import { initialState } from '@/features/redub/machine';
import { resetRateLimitsForTests, useRedub } from '@/features/redub/store';
import { appError } from '@/services/errors';

// jest.mock 会被提升到 import 之前执行

const mockSynthesize = jest.fn();
const mockTranscribe = jest.fn();
const mockCommit = jest.fn();
const mockProbe = jest.fn(async () => 3000 as number | null);
const mockWriteBytes = jest.fn(async () => undefined);

jest.mock('@/services/fish/tts', () => ({ synthesize: (...a: any[]) => mockSynthesize(...a) }));
jest.mock('@/services/fish/asr', () => ({ transcribe: (...a: any[]) => mockTranscribe(...a) }));
jest.mock('@/services/audio/probe', () => ({ probeDurationMs: (...a: any[]) => (mockProbe as any)(...a) }));
jest.mock('@/services/storage/paths', () => ({ docWorkDir: () => 'file:///doc/work/' }));
jest.mock('@/services/storage/fs', () => ({
  join: (...p: string[]) => p.join('/').replace(/\/+/g, '/').replace('file:/', 'file:///'),
  expoFs: { writeBytes: (...a: any[]) => (mockWriteBytes as any)(...a), remove: () => undefined },
}));
jest.mock('@/features/history/store', () => ({
  useHistory: { getState: () => ({ commit: (...a: any[]) => mockCommit(...a) }) },
}));
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `rec-${++n}` };
});

const audio = { id: 'src1', name: '录音', type: 'record' as const, uri: 'file:///doc/work/src1.m4a', ext: 'm4a', durationMs: 5000, sizeBytes: 1000 };
const flush = () => new Promise((r) => setTimeout(r, 0));
const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

async function toConfirmed() {
  mockTranscribe.mockResolvedValueOnce({ text: '你好世界', language: 'zh' });
  useRedub.getState().acceptSource(audio);
  await flush();
  useRedub.getState().editDraft('你好，世界。');
  useRedub.getState().confirmText();
}

const okCommit = (input: any) =>
  Promise.resolve({ kind: 'ok', record: input.record, sourceUri: 's', dubUri: 'd', sourceAvailable: true, dubAvailable: true });

beforeEach(() => {
  jest.clearAllMocks();
  mockProbe.mockImplementation(async () => 3000);
  mockWriteBytes.mockImplementation(async () => undefined);
  resetRateLimitsForTests();
  useRedub.setState(initialState);
});

describe('主流程 store', () => {
  it('新音源自动转写一次，取消后不会自动重发', async () => {
    const pending = deferred<any>();
    mockTranscribe.mockReturnValueOnce(pending.promise);
    useRedub.getState().acceptSource(audio);
    expect(mockTranscribe).toHaveBeenCalledTimes(1);
    useRedub.getState().cancelTranscribe();
    pending.resolve({ text: '迟到的结果' });
    await flush();
    expect(useRedub.getState().text.kind).toBe('cancelled');
    expect(mockTranscribe).toHaveBeenCalledTimes(1);
  });

  it('生成成功：使用确认后的文字与声音，写入历史', async () => {
    await toConfirmed();
    mockSynthesize.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    mockCommit.mockImplementationOnce(okCommit);
    await useRedub.getState().generate();
    expect(mockSynthesize).toHaveBeenCalledWith(expect.objectContaining({ text: '你好，世界。' }));
    expect(mockCommit.mock.calls[0][0].record).toMatchObject({ transcript: '你好世界', finalText: '你好，世界。' });
    expect(useRedub.getState().dub.kind).toBe('success');
  });

  it('换声音后：TTS 请求的 voiceId 与落库的声音都是新声音（阶段四审查 #3）', async () => {
    await toConfirmed();
    const adrian = 'bf322df2096a46f18c579d0baa36f41d';
    useRedub.getState().selectVoice(adrian);
    mockSynthesize.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    mockCommit.mockImplementationOnce(okCommit);
    await useRedub.getState().generate();
    expect(mockSynthesize).toHaveBeenCalledWith(expect.objectContaining({ voiceId: adrian, text: '你好，世界。' }));
    expect(mockCommit.mock.calls[0][0].record.voice).toEqual({ id: adrian, name: 'Adrian' });
    expect((useRedub.getState().dub as any).result.snapshot.voiceId).toBe(adrian);
  });

  it('保存失败后重试保存：不重发 TTS，沿用同一 recordId', async () => {
    await toConfirmed();
    mockSynthesize.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    mockCommit.mockRejectedValueOnce(appError('save_failed')).mockImplementationOnce(okCommit);
    await useRedub.getState().generate();
    expect(useRedub.getState().dub.kind).toBe('saveFailed');
    await useRedub.getState().retrySave();
    expect(mockSynthesize).toHaveBeenCalledTimes(1);
    expect(mockCommit).toHaveBeenCalledTimes(2);
    expect(mockCommit.mock.calls[1][0].record.id).toBe(mockCommit.mock.calls[0][0].record.id);
    expect(useRedub.getState().dub.kind).toBe('success');
  });

  it('取消生成后，迟到的音频不会写入历史', async () => {
    await toConfirmed();
    const pending = deferred<Uint8Array>();
    mockSynthesize.mockReturnValueOnce(pending.promise);
    const run = useRedub.getState().generate();
    useRedub.getState().cancelGenerate();
    pending.resolve(new Uint8Array([1]));
    await run;
    expect(mockCommit).not.toHaveBeenCalled();
    expect(useRedub.getState().dub.kind).toBe('idle');
  });

  it('请求失败进入 failed，可重新生成', async () => {
    await toConfirmed();
    mockSynthesize.mockRejectedValueOnce(appError('rate_limit', { retryAfterSec: 5 }));
    await useRedub.getState().generate();
    expect(useRedub.getState().dub).toMatchObject({ kind: 'failed', error: { code: 'rate_limit', retryAfterSec: 5 } });
  });

  it('工作文件写入失败后的内存兜底也必须通过解码校验，否则不落库（代码审查 #2）', async () => {
    await toConfirmed();
    mockSynthesize.mockResolvedValueOnce(new Uint8Array([0x49, 0x44, 0x33]));
    mockWriteBytes.mockRejectedValueOnce(new Error('磁盘已满')); // 首次写工作文件失败
    mockProbe.mockImplementation(async () => null); // 兜底写入后解码失败
    await useRedub.getState().generate();
    expect(mockCommit).not.toHaveBeenCalled();
    expect(useRedub.getState().dub).toMatchObject({ kind: 'failed', error: { code: 'incomplete_audio' } });
  });

  it('删除历史记录后，主页面引用它的结果失效（代码审查 #4）', async () => {
    await toConfirmed();
    mockSynthesize.mockResolvedValueOnce(new Uint8Array([1, 2, 3]));
    mockCommit.mockImplementationOnce(okCommit);
    await useRedub.getState().generate();
    const d = useRedub.getState().dub;
    expect(d.kind).toBe('success');
    useRedub.getState().forgetRecord((d as any).result.recordId);
    expect(useRedub.getState().dub.kind).toBe('idle');
  });

  it('转写被限流后，等待期内重试不会再发请求（代码审查 #5）', async () => {
    mockTranscribe.mockRejectedValueOnce(appError('rate_limit', { retryAfterSec: 30 }));
    useRedub.getState().acceptSource(audio);
    await flush();
    expect(useRedub.getState().text).toMatchObject({ kind: 'failed', error: { code: 'rate_limit' } });
    useRedub.getState().startTranscribe();
    expect(mockTranscribe).toHaveBeenCalledTimes(1);
    expect(useRedub.getState().text).toMatchObject({ kind: 'failed', error: { code: 'rate_limit' } });
  });

  it('配音被限流后，等待期内重试不会再发请求', async () => {
    await toConfirmed();
    mockSynthesize.mockRejectedValueOnce(appError('rate_limit', { retryAfterSec: 30 }));
    await useRedub.getState().generate();
    await useRedub.getState().generate();
    expect(mockSynthesize).toHaveBeenCalledTimes(1);
    expect(useRedub.getState().dub).toMatchObject({ kind: 'failed', error: { code: 'rate_limit' } });
  });

  it('重新开始：回到初始状态，进行中的请求迟到响应被丢弃', async () => {
    await toConfirmed();
    const pending = deferred<Uint8Array>();
    mockSynthesize.mockReturnValueOnce(pending.promise);
    const run = useRedub.getState().generate();
    useRedub.getState().reset();
    expect(useRedub.getState().source.kind).toBe('empty');
    expect(useRedub.getState().text.kind).toBe('locked');
    pending.resolve(new Uint8Array([1]));
    await run;
    expect(mockCommit).not.toHaveBeenCalled();
    expect(useRedub.getState().dub.kind).toBe('idle');
  });

  it('生成中不能更换音源', async () => {
    await toConfirmed();
    mockSynthesize.mockReturnValueOnce(new Promise(() => {}));
    void useRedub.getState().generate();
    expect(useRedub.getState().beginSourceChange()).toBe(false);
  });
});
