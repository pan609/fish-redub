import { randomUUID } from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

import { IMPORT_MESSAGES } from '@/copy/strings';
import type { SourceAudio } from '@/features/redub/machine';
import { probeDurationMs } from '@/services/audio/probe';
import { detectContainer, extensionOf, isSupportedExtension } from '@/services/audio/sniff';
import { docWorkDir, moveInto } from '@/services/storage/paths';

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MIN_DURATION_MS = 1000;
/** 60 秒上限，容忍编码器带来的几十毫秒误差 */
export const MAX_DURATION_MS = 60_049;

export type ImportResult = { kind: 'cancelled' } | { kind: 'ok'; audio: SourceAudio } | { kind: 'invalid'; message: string };

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);
const sec = (ms: number) => (ms / 1000).toFixed(1).replace(/\.0$/, '');

function readHeader(uri: string): Uint8Array {
  const handle = new File(uri).open();
  try {
    return handle.readBytesSync(16);
  } finally {
    handle.close();
  }
}

/**
 * 系统文件选择器导入（PRD I1–I4）。用户取消返回 cancelled（不提示错误）；
 * 校验顺序：格式（扩展名）→ 空文件 → 大小 → 文件头 → 可读性 → 时长。
 */
export async function pickAndValidateAudio(): Promise<ImportResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['audio/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.length) return { kind: 'cancelled' };

  const asset = picked.assets[0];
  const name = asset.name || '未命名音频';
  const ext = extensionOf(name);
  // 有扩展名时先按扩展名拦截；没有扩展名（部分 Android 提供方）时交给文件头判断
  if (ext && !isSupportedExtension(ext)) return { kind: 'invalid', message: IMPORT_MESSAGES.format };
  if (typeof asset.size === 'number' && asset.size > MAX_IMPORT_BYTES) {
    return { kind: 'invalid', message: IMPORT_MESSAGES.tooLarge(mb(asset.size)) };
  }

  const id = randomUUID();
  let uri: string;
  try {
    uri = await moveInto(asset.uri, docWorkDir(), `${id}.${ext || 'bin'}`);
  } catch {
    return { kind: 'invalid', message: IMPORT_MESSAGES.unreadable };
  }

  const fail = (message: string): ImportResult => {
    try {
      new File(uri).delete();
    } catch {
      // 工作目录启动时会清空
    }
    return { kind: 'invalid', message };
  };

  // 实测大小：选择器给出的大小可能缺失
  const size = new File(uri).size ?? 0;
  if (size <= 0) return fail(IMPORT_MESSAGES.empty);
  if (size > MAX_IMPORT_BYTES) return fail(IMPORT_MESSAGES.tooLarge(mb(size)));

  let container: ReturnType<typeof detectContainer>;
  try {
    container = detectContainer(readHeader(uri));
  } catch {
    return fail(IMPORT_MESSAGES.unreadable);
  }
  if (!container) return fail(IMPORT_MESSAGES.format);

  const durationMs = await probeDurationMs(uri);
  if (!durationMs) return fail(IMPORT_MESSAGES.unreadable);
  if (durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) return fail(IMPORT_MESSAGES.duration(sec(durationMs)));

  // 文件按真实容器命名，后续上传和保存都以此为准
  let finalUri = uri;
  if (ext !== container) {
    try {
      finalUri = await moveInto(uri, docWorkDir(), `${id}.${container}`);
    } catch {
      return fail(IMPORT_MESSAGES.unreadable);
    }
  }

  return {
    kind: 'ok',
    audio: { id, name, type: 'import', uri: finalUri, ext: container, durationMs, sizeBytes: size },
  };
}
