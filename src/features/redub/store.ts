import { randomUUID } from 'expo-crypto';
import { create } from 'zustand';

import { useHistory } from '@/features/history/store';
import { probeDurationMs } from '@/services/audio/probe';
import { appError, toAppError, type AppError } from '@/services/errors';
import { transcribe } from '@/services/fish/asr';
import { synthesize } from '@/services/fish/tts';
import { expoFs, join } from '@/services/storage/fs';
import { docWorkDir } from '@/services/storage/paths';

import * as M from './machine';

// 主流程 store：状态迁移全部交给 machine.ts，这里只负责调用服务、
// 维护任务代次（requestId）与 AbortController（PLAN §3.1）。

type Actions = {
  /** 开始更换音源（录音或导入）；生成中返回 false */
  beginSourceChange: () => boolean;
  /** 用户取消或校验失败：回到更换前状态 */
  endSourceChange: (error?: AppError) => void;
  /** 新音源校验通过：替换并自动发起一次转写 */
  acceptSource: (audio: M.SourceAudio) => void;
  startTranscribe: () => void;
  cancelTranscribe: () => void;
  startManualInput: () => void;
  editDraft: (draft: string) => void;
  restoreTranscript: () => void;
  confirmText: () => void;
  reopenText: () => void;
  selectVoice: (voiceId: string) => void;
  generate: () => Promise<void>;
  cancelGenerate: () => void;
  retrySave: () => Promise<void>;
};

export type RedubStore = M.RedubState & Actions;

let transcribeSeq = 0;
let transcribeCtrl: AbortController | null = null;
let generateSeq = 0;
let generateCtrl: AbortController | null = null;

const removeQuietly = (uri?: string) => {
  if (!uri) return;
  try {
    expoFs.remove(uri);
  } catch {
    // 工作目录启动时会整体清空
  }
};

export const useRedub = create<RedubStore>((set, get) => {
  const apply = (next: M.RedubState) => set(next);

  const isCurrentDub = (requestId: number) => {
    const d = get().dub;
    return (d.kind === 'generating' || d.kind === 'saving') && d.requestId === requestId;
  };

  /** 持久化：沿用 PendingDub 的 recordId，重试幂等（PLAN §3.5） */
  const persist = async (pending: M.PendingDub) => {
    const s = get();
    const { recordId, snapshot } = pending;
    try {
      if (s.source.kind !== 'ready' || s.source.audio.id !== snapshot.sourceId) {
        throw appError('save_failed', { detail: '音源已变化' });
      }
      const audio = s.source.audio;
      let dubUri = pending.audioUri;
      if (!dubUri && pending.audioBytes) {
        dubUri = join(docWorkDir(), `${recordId}.mp3`);
        await expoFs.writeBytes(dubUri, pending.audioBytes);
      }
      if (!dubUri) throw appError('save_failed', { detail: '没有可保存的配音数据' });

      const loaded = await useHistory.getState().commit({
        record: {
          id: recordId,
          sourceName: audio.name,
          sourceType: audio.type,
          sourceDurationMs: audio.durationMs,
          transcript: snapshot.transcript,
          finalText: snapshot.finalText,
          voice: { id: snapshot.voiceId, name: snapshot.voiceName },
          language: s.text.kind === 'confirmed' ? s.text.language : undefined,
          createdAt: pending.createdAt,
          dubDurationMs: pending.durationMs || undefined,
        },
        sourceUri: audio.uri,
        sourceExt: audio.ext,
        dubUri,
      });
      if (loaded.kind !== 'ok') throw appError('save_failed');
      apply(
        M.saveSucceeded(get(), {
          recordId,
          snapshot,
          sourceUri: loaded.sourceUri,
          dubUri: loaded.dubUri,
          durationMs: pending.durationMs,
          createdAt: pending.createdAt,
        }),
      );
    } catch (e) {
      apply(M.saveFailed(get(), recordId, toAppError(e, 'save_failed')));
    }
  };

  return {
    ...M.initialState,

    beginSourceChange: () => {
      const s = get();
      if (M.isDubLocked(s)) return false;
      apply(M.beginSourceChange(s));
      return true;
    },

    endSourceChange: (error) => apply(M.sourceChangeFailed(get(), error)),

    acceptSource: (audio) => {
      const prev = get().source;
      transcribeSeq++;
      transcribeCtrl?.abort();
      const next = M.sourceAccepted(get(), audio);
      if (next.source.kind !== 'ready' || next.source.audio.id !== audio.id) {
        apply(next);
        return;
      }
      apply(next);
      if (prev.kind === 'ready' && prev.audio.id !== audio.id) removeQuietly(prev.audio.uri);
      get().startTranscribe();
    },

    startTranscribe: () => {
      const s = get();
      if (s.source.kind !== 'ready') return;
      const requestId = ++transcribeSeq;
      transcribeCtrl?.abort();
      const ctrl = new AbortController();
      transcribeCtrl = ctrl;
      apply(M.transcribeStarted(s, requestId));
      transcribe({ uri: s.source.audio.uri, signal: ctrl.signal })
        .then((r) => apply(M.transcribeSucceeded(get(), requestId, r)))
        .catch((e) => apply(M.transcribeFailed(get(), requestId, toAppError(e))));
    },

    cancelTranscribe: () => {
      transcribeSeq++;
      transcribeCtrl?.abort();
      apply(M.transcribeCancelled(get()));
    },

    startManualInput: () => apply(M.startManualInput(get())),
    editDraft: (draft) => apply(M.editDraft(get(), draft)),
    restoreTranscript: () => apply(M.restoreTranscript(get())),
    confirmText: () => apply(M.confirmText(get())),
    reopenText: () => apply(M.reopenText(get())),
    selectVoice: (voiceId) => apply(M.selectVoice(get(), voiceId)),

    generate: async () => {
      const s = get();
      const snapshot = M.currentSnapshot(s);
      if (!snapshot || !M.canGenerate(s)) return;
      const requestId = ++generateSeq;
      generateCtrl?.abort();
      const ctrl = new AbortController();
      generateCtrl = ctrl;
      apply(M.generateStarted(s, requestId, snapshot));

      let bytes: Uint8Array;
      try {
        bytes = await synthesize({ text: snapshot.finalText, voiceId: snapshot.voiceId, signal: ctrl.signal });
      } catch (e) {
        apply(M.generateFailed(get(), requestId, toAppError(e)));
        return;
      }
      if (!isCurrentDub(requestId)) return;

      // 收到后立即写入工作文件；失败则暂存内存，交给"重试保存"
      const recordId = randomUUID();
      let audioUri: string | undefined = join(docWorkDir(), `${recordId}.mp3`);
      let audioBytes: Uint8Array | undefined;
      try {
        await expoFs.writeBytes(audioUri, bytes);
      } catch {
        audioUri = undefined;
        audioBytes = bytes;
      }

      // 用播放器加载确认音频可播放（完整性校验的最后一步）
      let durationMs = 0;
      if (audioUri) {
        const probed = await probeDurationMs(audioUri);
        if (!isCurrentDub(requestId)) {
          removeQuietly(audioUri);
          return;
        }
        if (!probed) {
          removeQuietly(audioUri);
          apply(M.generateFailed(get(), requestId, appError('incomplete_audio', { detail: '播放器无法加载生成的音频' })));
          return;
        }
        durationMs = probed;
      }
      if (!isCurrentDub(requestId)) return;

      const pending: M.PendingDub = { recordId, snapshot, audioUri, audioBytes, durationMs, createdAt: new Date().toISOString() };
      apply(M.audioReceived(get(), requestId, pending));
      await persist(pending);
    },

    cancelGenerate: () => {
      if (get().dub.kind !== 'generating') return;
      generateSeq++;
      generateCtrl?.abort();
      apply(M.generateCancelled(get()));
    },

    retrySave: async () => {
      const d = get().dub;
      if (d.kind !== 'saveFailed') return;
      apply(M.saveRetried(get(), ++generateSeq));
      await persist(d.pending);
    },
  };
});
