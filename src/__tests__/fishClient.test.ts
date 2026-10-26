import { parseAsrResponse } from '@/services/fish/asr';
import { setFetchImpl, type FetchLike } from '@/services/fish/client';
import { createFaultyFetch, fakeResponse, type NetworkFault } from '@/services/fish/faults';
import { checkTtsAudio, synthesize, validateTtsText } from '@/services/fish/tts';

// 一段最小的合法 MP3：ID3 头 + 若干字节
const MP3 = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0, 0, 0, 0, 0, 0, 0xff, 0xfb, 0x90, 0x64, 1, 2, 3, 4]);
const okTts: FetchLike = async () =>
  fakeResponse(MP3, { headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(MP3.length) } });

const run = (fault: NetworkFault, real: FetchLike = okTts) => {
  setFetchImpl(createFaultyFetch(real, () => fault));
  return synthesize({ text: '你好', voiceId: 'v1' });
};

describe('TTS 文本校验', () => {
  it('空白文本与超长文本被拦截', () => {
    expect(validateTtsText('   \n ')).toBe('empty');
    expect(validateTtsText('a'.repeat(1001))).toBe('too_long');
    expect(validateTtsText(' 你好 ')).toBeNull();
  });

  it('空白文本不会发起请求', async () => {
    const spy = jest.fn(okTts);
    setFetchImpl(spy);
    await expect(synthesize({ text: '  ', voiceId: 'v1' })).rejects.toMatchObject({ code: 'bad_request' });
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('TTS 完整性校验', () => {
  it('合法 MP3 通过', () => expect(checkTtsAudio(MP3, String(MP3.length), 'audio/mpeg')).toBeNull());
  it('空内容', () => expect(checkTtsAudio(new Uint8Array(0), null, 'audio/mpeg')).not.toBeNull());
  it('字节数与 Content-Length 不符', () => expect(checkTtsAudio(MP3, '999', 'audio/mpeg')).not.toBeNull());
  it('非音频 Content-Type', () => expect(checkTtsAudio(MP3, null, 'text/html')).not.toBeNull());
  it('文件头不是 MP3', () => expect(checkTtsAudio(new Uint8Array([1, 2, 3, 4]), null, 'audio/mpeg')).not.toBeNull());
  it('没有 Content-Length 时只做其余检查', () => expect(checkTtsAudio(MP3, null, 'audio/mpeg')).toBeNull());
});

describe('网络错误归一化（经由故障注入走真实路径）', () => {
  it('正常返回字节', async () => {
    await expect(run('none')).resolves.toHaveLength(MP3.length);
  });

  it.each<[NetworkFault, string, boolean]>([
    ['offline', 'offline', true],
    ['auth', 'auth', false],
    ['quota', 'quota', false],
    ['server', 'server', true],
    ['truncated', 'incomplete_audio', true],
    ['not_audio', 'incomplete_audio', true],
    ['empty_body', 'incomplete_audio', true],
  ])('%s → %s', async (fault, code, retryable) => {
    await expect(run(fault)).rejects.toMatchObject({ code, retryable });
  });

  it('429 读取 Retry-After', async () => {
    await expect(run('rate_limit')).rejects.toMatchObject({ code: 'rate_limit', retryAfterSec: 8 });
  });

  it('400 invalid_audio 归为 bad_audio', async () => {
    setFetchImpl(async () =>
      fakeResponse(JSON.stringify({ status: 400, code: 'invalid_audio', message: 'Invalid audio input' }), { status: 400 }),
    );
    await expect(synthesize({ text: 'hi', voiceId: 'v1' })).rejects.toMatchObject({ code: 'bad_audio' });
  });

  it('响应体读取中断归为 incomplete_audio', async () => {
    setFetchImpl(async () => ({
      ...fakeResponse(MP3, { headers: { 'Content-Type': 'audio/mpeg' } }),
      arrayBuffer: () => Promise.reject(new Error('stream closed')),
    }));
    await expect(synthesize({ text: 'hi', voiceId: 'v1' })).rejects.toMatchObject({ code: 'incomplete_audio' });
  });

  it('超时（包括响应体慢读）归为 timeout', async () => {
    jest.useFakeTimers();
    setFetchImpl(async () => ({
      ...fakeResponse(MP3),
      arrayBuffer: () => new Promise<ArrayBuffer>(() => {}),
    }));
    const p = synthesize({ text: 'hi', voiceId: 'v1' });
    const assertion = expect(p).rejects.toMatchObject({ code: 'timeout' });
    await jest.advanceTimersByTimeAsync(60_001);
    await assertion;
    jest.useRealTimers();
  });

  it('用户取消归为 cancelled，而不是超时或网络错误', async () => {
    setFetchImpl(createFaultyFetch(okTts, () => 'timeout'));
    const controller = new AbortController();
    const p = synthesize({ text: 'hi', voiceId: 'v1', signal: controller.signal });
    controller.abort();
    await expect(p).rejects.toMatchObject({ code: 'cancelled' });
  });
});

describe('ASR 响应解析', () => {
  it('去除首尾空白并识别语言', () => {
    expect(parseAsrResponse({ text: ' 你好。 ', language_code: 'zh', duration: 3.3 })).toEqual({
      text: '你好。',
      language: 'zh',
      durationSec: 3.3,
    });
  });
  it('静音返回空文本（实测 language 为 None）', () => {
    expect(parseAsrResponse({ text: '', language: 'None' }).text).toBe('');
  });
  it('缺少 text 视为服务错误', () => {
    expect(() => parseAsrResponse({})).toThrow();
  });
});
