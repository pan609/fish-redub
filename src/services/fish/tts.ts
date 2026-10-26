import { TEXT_LIMIT } from '@/copy/strings';
import { appError } from '@/services/errors';
import { isMpegFrameSync } from '@/services/audio/sniff';

import { fishRequest, type ResponseLike } from './client';

export const TTS_TIMEOUT_MS = 60_000;

/** 客户端前置拦截：空白或超长文本不发请求（PRD G5：空文本时接口会返回静音而不报错） */
export function validateTtsText(text: string): 'empty' | 'too_long' | null {
  const t = text.trim();
  if (!t) return 'empty';
  if (t.length > TEXT_LIMIT) return 'too_long';
  return null;
}

/** POST /v1/tts：返回完整且通过校验的 MP3 字节 */
export async function synthesize(params: { text: string; voiceId: string; signal?: AbortSignal }): Promise<Uint8Array> {
  if (validateTtsText(params.text)) throw appError('bad_request', { detail: '文本为空或超长' });
  return fishRequest({
    method: 'POST',
    path: '/v1/tts',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: params.text.trim(), reference_id: params.voiceId, format: 'mp3' }),
    timeoutMs: TTS_TIMEOUT_MS,
    signal: params.signal,
    bodyErrorCode: 'incomplete_audio',
    read: readTtsAudio,
  });
}

async function readTtsAudio(res: ResponseLike): Promise<Uint8Array> {
  const bytes = new Uint8Array(await res.arrayBuffer());
  const problem = checkTtsAudio(bytes, res.headers.get('content-length'), res.headers.get('content-type'));
  if (problem) throw appError('incomplete_audio', { detail: problem });
  return bytes;
}

/**
 * 完整性校验（PRD §7.1 / §7.3）：能发现明显不完整的音频。
 * 返回问题描述，通过时返回 null。
 */
export function checkTtsAudio(bytes: Uint8Array, contentLength: string | null, contentType: string | null): string | null {
  if (bytes.length === 0) return '响应体为空';
  if (contentType && !/audio|octet-stream/i.test(contentType)) return `Content-Type 非音频：${contentType}`;
  const declared = contentLength ? Number(contentLength) : NaN;
  if (Number.isFinite(declared) && declared > 0 && declared !== bytes.length) {
    return `字节数不符：声明 ${declared}，实收 ${bytes.length}`;
  }
  const isId3 = bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33;
  if (!isId3 && !(bytes.length >= 2 && isMpegFrameSync(bytes[0], bytes[1]))) return '文件头不是 MP3';
  return null;
}
