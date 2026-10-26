import {
  AudioQuality,
  getRecordingPermissionsAsync,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
  type RecordingStatus,
} from 'expo-audio';
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { RECORD_MESSAGES } from '@/copy/strings';
import type { SourceAudio } from '@/features/redub/machine';
import { audioCoordinator, enterPlaybackMode, enterRecordingMode } from '@/services/audio/coordinator';
import { probeDurationMs } from '@/services/audio/probe';
import { docWorkDir, moveInto } from '@/services/storage/paths';
import { recordingName } from '@/utils/format';

export const MAX_RECORD_MS = 60_000;
export const MIN_RECORD_MS = 1_000;
const PREPARE_TIMEOUT_MS = 5_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

// PRD R10：M4A / AAC / 单声道 / 44.1kHz / 64kbps，开启电平用于波形
const RECORDING_OPTIONS: RecordingOptions = {
  extension: '.m4a',
  sampleRate: 44100,
  numberOfChannels: 1,
  bitRate: 64000,
  isMeteringEnabled: true,
  android: { outputFormat: 'mpeg4', audioEncoder: 'aac' },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.HIGH },
  web: { mimeType: 'audio/webm', bitsPerSecond: 64000 },
};

export type FinalizeReason = 'manual' | 'limit' | 'background' | 'interrupted';

export type RecorderPhase =
  | { kind: 'checking' }
  | { kind: 'permissionPrompt' }
  | { kind: 'denied' }
  | { kind: 'idle' }
  /** 正在准备录音（切换音频会话、prepare），期间按钮不可点，防止重复启动 */
  | { kind: 'starting' }
  | { kind: 'recording' }
  | { kind: 'finalizing' }
  | { kind: 'preview'; uri: string; durationMs: number; sizeBytes: number; createdAt: Date; notice?: string }
  | { kind: 'invalid'; message: string };

const NOTICE: Partial<Record<FinalizeReason, string>> = {
  limit: RECORD_MESSAGES.autoStopped,
  background: RECORD_MESSAGES.backgrounded,
  interrupted: RECORD_MESSAGES.interrupted,
};

const waitForActive = () =>
  new Promise<void>((resolve) => {
    if (AppState.currentState === 'active') return resolve();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        sub.remove();
        resolve();
      }
    });
  });

const deleteQuietly = (uri?: string | null) => {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // 工作目录会在启动时清理
  }
};

export function useRecorderSession() {
  const [phase, setPhaseState] = useState<RecorderPhase>({ kind: 'checking' });
  // phaseRef 与 state 同步更新，异步回调（原生状态、AppState）读取最新阶段
  const phaseRef = useRef<RecorderPhase>(phase);
  const setPhase = useCallback((next: RecorderPhase | ((cur: RecorderPhase) => RecorderPhase)) => {
    const value = typeof next === 'function' ? next(phaseRef.current) : next;
    phaseRef.current = value;
    setPhaseState(value);
  }, []);
  const finalizing = useRef(false);
  // 原生回调与 AppState 监听通过 ref 调用最新的 finalize
  const finalizeRef = useRef<(reason: FinalizeReason) => Promise<void>>(async () => undefined);
  const startedAt = useRef<Date>(new Date());
  const wasRecording = useRef(false);

  const onStatus = useCallback((status: RecordingStatus) => {
    // 原生 forDuration 到时自动停止，或系统中断（来电、媒体服务重置）
    if (phaseRef.current.kind !== 'recording') return;
    if (status.hasError || status.mediaServicesDidReset) void finalizeRef.current('interrupted');
    else if (status.isFinished) void finalizeRef.current('limit');
  }, []);

  const recorder = useAudioRecorder(RECORDING_OPTIONS, onStatus);
  const state = useAudioRecorderState(recorder, 100);

  /* ---------- 权限 ---------- */

  const checkPermission = useCallback(
    () =>
      getRecordingPermissionsAsync().then((p) => {
        if (p.granted) setPhase((cur) => (cur.kind === 'checking' || cur.kind === 'denied' || cur.kind === 'permissionPrompt' ? { kind: 'idle' } : cur));
        else setPhase(p.canAskAgain ? { kind: 'permissionPrompt' } : { kind: 'denied' });
      }),
    [setPhase],
  );

  useEffect(() => {
    checkPermission().catch(() => setPhase({ kind: 'permissionPrompt' }));
  }, [checkPermission, setPhase]);

  /** 首次使用：说明后再弹系统授权（PRD R1） */
  const requestPermission = async () => {
    const p = await requestRecordingPermissionsAsync();
    setPhase(p.granted ? { kind: 'idle' } : { kind: 'denied' });
  };

  /** 拒绝后提供恢复入口（PRD R2），从设置返回时自动重新检查 */
  const openSettings = () => void Linking.openSettings();

  /* ---------- 收尾（停止、60 秒、后台、中断共用，防重入） ---------- */

  const finalize = async (reason: FinalizeReason) => {
    if (finalizing.current || phaseRef.current.kind !== 'recording') return;
    finalizing.current = true;
    setPhase({ kind: 'finalizing' });
    const elapsed = recorder.currentTime * 1000;
    try {
      try {
        await recorder.stop();
      } catch {
        // 原生已自动停止时 stop 可能抛错，继续检查文件
      }
      await enterPlaybackMode().catch(() => undefined);
      const uri = recorder.uri;
      const file = uri ? new File(uri) : null;
      const size = file?.exists ? (file.size ?? 0) : 0;
      if (!uri || size <= 0) {
        setPhase({ kind: 'invalid', message: reason === 'background' ? RECORD_MESSAGES.backgroundedInvalid : RECORD_MESSAGES.saveFailed });
        return;
      }
      // 后台时播放器无法可靠加载，回到前台再读取时长
      await waitForActive();
      const durationMs = (await probeDurationMs(uri)) ?? 0;
      if (durationMs < MIN_RECORD_MS) {
        deleteQuietly(uri);
        const short = durationMs > 0 || elapsed < MIN_RECORD_MS;
        setPhase({
          kind: 'invalid',
          message: reason === 'background' ? RECORD_MESSAGES.backgroundedInvalid : short ? RECORD_MESSAGES.tooShort : RECORD_MESSAGES.saveFailed,
        });
        return;
      }
      setPhase({
        kind: 'preview',
        uri,
        durationMs: Math.min(durationMs, MAX_RECORD_MS),
        sizeBytes: size,
        createdAt: startedAt.current,
        notice: NOTICE[reason],
      });
    } finally {
      finalizing.current = false;
    }
  };
  useEffect(() => {
    finalizeRef.current = finalize;
  });

  /* ---------- 录音控制 ---------- */

  const start = async () => {
    const cur = phaseRef.current.kind;
    if (cur === 'starting' || cur === 'recording' || cur === 'finalizing') return;
    audioCoordinator.stopAll(); // PRD R7：开始录音前停止所有播放
    if (phaseRef.current.kind === 'preview') deleteQuietly(phaseRef.current.uri);
    setPhase({ kind: 'starting' });
    try {
      await enterRecordingMode();
      // 准备录音偶尔会卡住（例如系统麦克风授权未完成），设超时避免界面无响应
      await withTimeout(recorder.prepareToRecordAsync(), PREPARE_TIMEOUT_MS);
      startedAt.current = new Date();
      wasRecording.current = false;
      recorder.record({ forDuration: MAX_RECORD_MS / 1000 }); // 原生保证 60 秒上限
      setPhase({ kind: 'recording' });
    } catch {
      await enterPlaybackMode().catch(() => undefined);
      setPhase({ kind: 'invalid', message: RECORD_MESSAGES.startFailed });
    }
  };

  const stop = () => finalize('manual');

  // JS 兜底：原生回调缺失时，计时到达上限或录音已停止也会触发收尾
  useEffect(() => {
    if (phase.kind !== 'recording') return;
    if (state.isRecording) wasRecording.current = true;
    if (state.durationMillis >= MAX_RECORD_MS || (wasRecording.current && !state.isRecording)) {
      void finalizeRef.current('limit');
    }
  }, [phase.kind, state.isRecording, state.durationMillis]);

  // PRD R8：录音中进入后台立即结束
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' && phaseRef.current.kind === 'recording') void finalizeRef.current('background');
      if (s === 'active' && (phaseRef.current.kind === 'denied' || phaseRef.current.kind === 'permissionPrompt')) void checkPermission();
    });
    return () => sub.remove();
  }, [checkPermission]);

  /** 放弃本次录音（关闭弹层时） */
  const discard = async () => {
    const cur = phaseRef.current;
    if (cur.kind === 'recording') {
      finalizing.current = true;
      try {
        await recorder.stop();
      } catch {
        // 忽略
      }
      await enterPlaybackMode().catch(() => undefined);
      deleteQuietly(recorder.uri);
      finalizing.current = false;
    } else if (cur.kind === 'preview') {
      deleteQuietly(cur.uri);
    }
  };

  // 弹层被关闭时兜底：仍在录音则停止并丢弃
  useEffect(() => {
    return () => {
      if (phaseRef.current.kind === 'recording') {
        recorder.stop().catch(() => undefined);
        enterPlaybackMode().catch(() => undefined);
      }
    };
  }, [recorder]);

  const retake = () => {
    if (phaseRef.current.kind === 'preview') deleteQuietly(phaseRef.current.uri);
    setPhase({ kind: 'idle' });
  };

  /** 确认使用：移入 document/work（PRD R10），生成音源描述 */
  const accept = async (): Promise<SourceAudio | null> => {
    const cur = phaseRef.current;
    if (cur.kind !== 'preview') return null;
    const id = randomUUID();
    try {
      const uri = await moveInto(cur.uri, docWorkDir(), `${id}.m4a`);
      return { id, name: recordingName(cur.createdAt), type: 'record', uri, ext: 'm4a', durationMs: cur.durationMs, sizeBytes: cur.sizeBytes };
    } catch {
      setPhase({ kind: 'invalid', message: RECORD_MESSAGES.saveFailed });
      return null;
    }
  };

  return {
    phase,
    elapsedMs: phase.kind === 'recording' ? state.durationMillis : 0,
    metering: state.metering,
    requestPermission,
    openSettings,
    start,
    stop,
    retake,
    accept,
    discard,
  };
}
