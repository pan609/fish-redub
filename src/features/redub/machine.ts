import { TEXT_LIMIT } from '@/copy/strings';
import { defaultVoiceFor, VOICES } from '@/config/voices';
import type { AppError } from '@/services/errors';

// 主流程状态机（PRD §5、PLAN §3.1）：全部为纯函数，由单元测试覆盖。
// 迁移函数在条件不满足时原样返回 state，调用方无需重复判断。

export type SourceAudio = {
  id: string;
  name: string;
  type: 'record' | 'import';
  /** 已确认音源位于 Paths.document/work/ */
  uri: string;
  ext: string;
  durationMs: number;
  sizeBytes: number;
};

export type SourceState = { kind: 'empty' } | { kind: 'ready'; audio: SourceAudio };

export type TextState =
  | { kind: 'locked' }
  | { kind: 'transcribing'; requestId: number }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: AppError }
  | { kind: 'empty' }
  | { kind: 'editing'; transcript: string; draft: string; language?: string }
  | { kind: 'confirmed'; transcript: string; finalText: string; language?: string };

export type DubSnapshot = { sourceId: string; transcript: string; finalText: string; voiceId: string; voiceName: string };

export type PendingDub = {
  recordId: string;
  snapshot: DubSnapshot;
  /** 配音已写入 Paths.document/work/ 时的位置 */
  audioUri?: string;
  /** 写工作文件失败时暂存在内存，供"重试保存" */
  audioBytes?: Uint8Array;
  durationMs: number;
  createdAt: string;
};

export type DubResult = {
  recordId: string;
  snapshot: DubSnapshot;
  sourceUri: string;
  dubUri: string;
  durationMs: number;
  createdAt: string;
};

export type DubState =
  | { kind: 'idle' }
  | { kind: 'generating'; requestId: number; snapshot: DubSnapshot; previous?: DubResult }
  | { kind: 'failed'; error: AppError; snapshot: DubSnapshot; previous?: DubResult }
  | { kind: 'saving'; requestId: number; pending: PendingDub; previous?: DubResult }
  | { kind: 'saveFailed'; error: AppError; pending: PendingDub; previous?: DubResult }
  | { kind: 'success'; result: DubResult };

export type RedubState = {
  source: SourceState;
  /** 正在导入或校验新音源；期间旧的音源、文字和结果保持不变 */
  sourceBusy: boolean;
  /** 新音源校验失败的原因，展示在第 ① 步 */
  sourceError?: AppError;
  text: TextState;
  voiceId: string;
  /** 用户手动选过声音后，不再按语言自动切换 */
  voiceTouched: boolean;
  dub: DubState;
};

export const initialState: RedubState = {
  source: { kind: 'empty' },
  sourceBusy: false,
  text: { kind: 'locked' },
  voiceId: VOICES[0].id,
  voiceTouched: false,
  dub: { kind: 'idle' },
};

/* ---------- 音源 ---------- */

export function beginSourceChange(s: RedubState): RedubState {
  if (isDubLocked(s)) return s;
  return { ...s, sourceBusy: true, sourceError: undefined };
}

/** 新音源校验失败或用户取消：回到更换前的状态（PRD §5.1 安全替换） */
export function sourceChangeFailed(s: RedubState, error?: AppError): RedubState {
  return { ...s, sourceBusy: false, sourceError: error };
}

/** 新音源就绪：清空旧的文字与结果，进入待转写（由调用方立即发起转写） */
export function sourceAccepted(s: RedubState, audio: SourceAudio): RedubState {
  if (isDubLocked(s)) return { ...s, sourceBusy: false };
  return {
    ...s,
    source: { kind: 'ready', audio },
    sourceBusy: false,
    sourceError: undefined,
    text: { kind: 'cancelled' },
    dub: { kind: 'idle' },
  };
}

/* ---------- 转写 ---------- */

export function transcribeStarted(s: RedubState, requestId: number): RedubState {
  if (s.source.kind !== 'ready') return s;
  return { ...s, text: { kind: 'transcribing', requestId } };
}

const isCurrentTranscribe = (s: RedubState, requestId: number) =>
  s.text.kind === 'transcribing' && s.text.requestId === requestId;

/**
 * 转写合理性检查：识别字数远超人类语速上限时视为无效识别（阶段四发现：
 * 对纯静音，ASR 偶尔返回数千字的重复幻觉文本）。每秒 25 个字符已高于中英文正常语速，
 * 并给短音频留出至少 60 字的余量。
 */
export const MAX_CHARS_PER_SECOND = 25;
export function isPlausibleTranscript(text: string, durationMs: number): boolean {
  const t = text.trim();
  if (!t) return false;
  const limit = Math.max(60, (durationMs / 1000) * MAX_CHARS_PER_SECOND);
  return t.length <= limit;
}

export function transcribeSucceeded(
  s: RedubState,
  requestId: number,
  result: { text: string; language?: string },
): RedubState {
  if (!isCurrentTranscribe(s, requestId)) return s;
  const durationMs = s.source.kind === 'ready' ? s.source.audio.durationMs : 0;
  if (!isPlausibleTranscript(result.text, durationMs)) return { ...s, text: { kind: 'empty' } };
  const voiceId = s.voiceTouched ? s.voiceId : defaultVoiceFor(result.language).id;
  return {
    ...s,
    voiceId,
    text: { kind: 'editing', transcript: result.text, draft: result.text, language: result.language },
  };
}

export function transcribeFailed(s: RedubState, requestId: number, error: AppError): RedubState {
  if (!isCurrentTranscribe(s, requestId)) return s;
  return { ...s, text: error.code === 'cancelled' ? { kind: 'cancelled' } : { kind: 'failed', error } };
}

/** 取消转写：进入待转写，不自动重发（PRD §5.2） */
export function transcribeCancelled(s: RedubState): RedubState {
  return s.text.kind === 'transcribing' ? { ...s, text: { kind: 'cancelled' } } : s;
}

/* ---------- 文字 ---------- */

/** 转写为空时手动输入（PRD D3），原始转写保持为空 */
export function startManualInput(s: RedubState): RedubState {
  if (s.text.kind !== 'empty' && s.text.kind !== 'failed') return s;
  return { ...s, text: { kind: 'editing', transcript: '', draft: '' } };
}

export function editDraft(s: RedubState, draft: string): RedubState {
  if (isDubLocked(s)) return s;
  if (s.text.kind === 'editing') return { ...s, text: { ...s.text, draft } };
  return s;
}

export function restoreTranscript(s: RedubState): RedubState {
  if (s.text.kind !== 'editing' || isDubLocked(s)) return s;
  return { ...s, text: { ...s.text, draft: s.text.transcript } };
}

export type TextProblem = 'empty' | 'too_long' | null;

export function validateDraft(draft: string): TextProblem {
  const t = draft.trim();
  if (!t) return 'empty';
  if (t.length > TEXT_LIMIT) return 'too_long';
  return null;
}

export function confirmText(s: RedubState): RedubState {
  if (s.text.kind !== 'editing' || validateDraft(s.text.draft)) return s;
  const { transcript, draft, language } = s.text;
  return { ...s, text: { kind: 'confirmed', transcript, finalText: draft.trim(), language } };
}

/** 再次编辑已确认的文字：回到未确认；已有结果在界面上显示为"已过期" */
export function reopenText(s: RedubState): RedubState {
  if (s.text.kind !== 'confirmed' || isDubLocked(s)) return s;
  const { transcript, finalText, language } = s.text;
  return { ...s, text: { kind: 'editing', transcript, draft: finalText, language } };
}

/* ---------- 声音 ---------- */

/** 选择即生效（PRD V2） */
export function selectVoice(s: RedubState, voiceId: string): RedubState {
  if (isDubLocked(s) || !VOICES.some((v) => v.id === voiceId)) return s;
  return { ...s, voiceId, voiceTouched: true };
}

/* ---------- 配音 ---------- */

/** 生成或保存进行中：锁定音源、文字和声音（PRD §5.1） */
export function isDubLocked(s: RedubState): boolean {
  return s.dub.kind === 'generating' || s.dub.kind === 'saving';
}

const lastResult = (d: DubState): DubResult | undefined => (d.kind === 'success' ? d.result : 'previous' in d ? d.previous : undefined);

export function currentSnapshot(s: RedubState): DubSnapshot | null {
  if (s.source.kind !== 'ready' || s.text.kind !== 'confirmed') return null;
  const voice = VOICES.find((v) => v.id === s.voiceId);
  if (!voice) return null;
  return {
    sourceId: s.source.audio.id,
    transcript: s.text.transcript,
    finalText: s.text.finalText,
    voiceId: voice.id,
    voiceName: voice.name,
  };
}

export function canGenerate(s: RedubState): boolean {
  return !isDubLocked(s) && !s.sourceBusy && currentSnapshot(s) !== null;
}

/** 生成请求锁定快照；重试沿用快照，但音源 / 文字 / 声音变化后旧快照作废 */
export function generateStarted(s: RedubState, requestId: number, snapshot: DubSnapshot): RedubState {
  if (!canGenerate(s)) return s;
  return { ...s, dub: { kind: 'generating', requestId, snapshot, previous: lastResult(s.dub) } };
}

export function generateFailed(s: RedubState, requestId: number, error: AppError): RedubState {
  if (s.dub.kind !== 'generating' || s.dub.requestId !== requestId) return s;
  return { ...s, dub: { kind: 'failed', error, snapshot: s.dub.snapshot, previous: s.dub.previous } };
}

/** 取消生成：回到可生成，并恢复上一次的结果（PRD §5.2） */
export function generateCancelled(s: RedubState): RedubState {
  if (s.dub.kind !== 'generating') return s;
  const prev = s.dub.previous;
  return { ...s, dub: prev ? { kind: 'success', result: prev } : { kind: 'idle' } };
}

/** 音频已到手，进入保存；从这里开始不可取消 */
export function audioReceived(s: RedubState, requestId: number, pending: PendingDub): RedubState {
  if (s.dub.kind !== 'generating' || s.dub.requestId !== requestId) return s;
  return { ...s, dub: { kind: 'saving', requestId, pending, previous: s.dub.previous } };
}

/** 待保存的音频未通过解码校验：不得落库，回到"请求失败"，重试会重新生成（代码审查 #2） */
export function pendingRejected(s: RedubState, recordId: string, error: AppError): RedubState {
  if (s.dub.kind !== 'saving' || s.dub.pending.recordId !== recordId) return s;
  return { ...s, dub: { kind: 'failed', error, snapshot: s.dub.pending.snapshot, previous: s.dub.previous } };
}

export function saveFailed(s: RedubState, recordId: string, error: AppError): RedubState {
  if (s.dub.kind !== 'saving' || s.dub.pending.recordId !== recordId) return s;
  return { ...s, dub: { kind: 'saveFailed', error, pending: s.dub.pending, previous: s.dub.previous } };
}

/** 重试保存：沿用同一 PendingDub（同一 recordId），不重发 TTS */
export function saveRetried(s: RedubState, requestId: number): RedubState {
  if (s.dub.kind !== 'saveFailed') return s;
  return { ...s, dub: { kind: 'saving', requestId, pending: s.dub.pending, previous: s.dub.previous } };
}

export function saveSucceeded(s: RedubState, result: DubResult): RedubState {
  if (s.dub.kind !== 'saving' || s.dub.pending.recordId !== result.recordId) return s;
  return { ...s, dub: { kind: 'success', result } };
}

/** 限流等待期内拦截请求，直接给出带剩余秒数的失败状态（PRD §7.2，代码审查 #5） */
export function transcribeBlocked(s: RedubState, error: AppError): RedubState {
  if (s.source.kind !== 'ready') return s;
  return { ...s, text: { kind: 'failed', error } };
}

export function generateBlocked(s: RedubState, snapshot: DubSnapshot, error: AppError): RedubState {
  if (isDubLocked(s)) return s;
  return { ...s, dub: { kind: 'failed', error, snapshot, previous: lastResult(s.dub) } };
}

/** 历史中删除了某条记录：当前页面引用它的结果随之失效（代码审查 #4） */
export function recordRemoved(s: RedubState, recordId: string): RedubState {
  const d = s.dub;
  if (d.kind === 'success') return d.result.recordId === recordId ? { ...s, dub: { kind: 'idle' } } : s;
  if ('previous' in d && d.previous?.recordId === recordId) return { ...s, dub: { ...d, previous: undefined } };
  return s;
}

/**
 * 是否提供"生成配音"入口。除常规情况外，保存失败后用户已修改文字或声音时，
 * 也要允许按新内容生成，不能强制先保存已放弃的旧结果（代码审查 #3）。
 */
export function shouldOfferGenerate(s: RedubState): boolean {
  if (!canGenerate(s)) return false;
  const d = s.dub;
  if (d.kind === 'idle') return true;
  if (d.kind === 'success') return isResultExpired(s, d.result);
  if (d.kind === 'failed') return !d.error.retryable || snapshotDiffers(s, d.snapshot);
  if (d.kind === 'saveFailed') return snapshotDiffers(s, d.pending.snapshot);
  return false;
}

function snapshotDiffers(s: RedubState, snap: DubSnapshot): boolean {
  const cur = currentSnapshot(s);
  return !cur || cur.sourceId !== snap.sourceId || cur.finalText !== snap.finalText || cur.voiceId !== snap.voiceId;
}

/** 当前展示的结果（成功，或失败 / 生成中时保留的上一次结果） */
export function visibleResult(s: RedubState): DubResult | undefined {
  return lastResult(s.dub);
}

/** 过期不存储、实时计算：结果快照与当前音源 / 文字 / 声音不一致 */
export function isResultExpired(s: RedubState, result: DubResult): boolean {
  if (s.source.kind !== 'ready' || s.source.audio.id !== result.snapshot.sourceId) return true;
  if (s.voiceId !== result.snapshot.voiceId) return true;
  if (s.text.kind !== 'confirmed') return true;
  return s.text.finalText !== result.snapshot.finalText;
}
