import { File } from 'expo-file-system';

import { appError } from '@/services/errors';

import { fishRequest } from './client';

export const ASR_TIMEOUT_MS = 30_000;

export type AsrResult = {
  /** 已去除首尾空白；为空表示未识别到有效语音 */
  text: string;
  language?: string;
  durationSec?: number;
};

/** POST /v1/asr：multipart 上传本地音频文件 */
export function transcribe(params: { uri: string; signal?: AbortSignal }): Promise<AsrResult> {
  const form = new FormData();
  // SDK 58 的全局 fetch 是 expo/fetch：multipart 文件需要实现 bytes() 的对象（expo-file-system 的 File），
  // 不支持 RN 传统的 { uri, name, type } 写法（M2 真机自检发现）
  form.append('audio', new File(params.uri) as any);
  form.append('ignore_timestamps', 'true');

  return fishRequest({
    method: 'POST',
    path: '/v1/asr',
    body: form,
    timeoutMs: ASR_TIMEOUT_MS,
    signal: params.signal,
    bodyErrorCode: 'server',
    read: async (res) => parseAsrResponse(await res.json()),
  });
}

export function parseAsrResponse(json: any): AsrResult {
  if (!json || typeof json.text !== 'string') throw appError('server', { detail: 'ASR 响应缺少 text' });
  const code = typeof json.language_code === 'string' ? json.language_code : undefined;
  return {
    text: json.text.trim(),
    language: code && code !== 'None' ? code : undefined,
    durationSec: typeof json.duration === 'number' ? json.duration : undefined,
  };
}
