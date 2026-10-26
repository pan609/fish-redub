import { appError } from '@/services/errors';

const mockSynthesize = jest.fn();
const mockTranscribe = jest.fn();
const mockCommit = jest.fn();

jest.mock('@/services/fish/tts', () => ({ synthesize: (...a: any[]) => mockSynthesize(...a) }));
jest.mock('@/services/fish/asr', () => ({ transcribe: (...a: any[]) => mockTranscribe(...a) }));
jest.mock('@/services/audio/probe', () => ({ probeDurationMs: async () => 3000 }));
jest.mock('@/services/storage/paths', () => ({ docWorkDir: () => 'file:///doc/work/' }));
jest.mock('@/services/storage/fs', () => ({
  join: (...p: string[]) => p.join('/').replace(/\/+/g, '/').replace('file:/', 'file:///'),
  expoFs: { writeBytes: async () => undefined, remove: () => undefined },
}));
jest.mock('@/features/history/store', () => ({
  useHistory: { getState: () => ({ commit: (...a: any[]) => mockCommit(...a) }) },
}));
jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `rec-${++n}` };
});

import { useRedub } from '@/features/redub/store';
import { initialState } from '@/features/redub/machine';

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

  it('生成中不能更换音源', async () => {
    await toConfirmed();
    mockSynthesize.mockReturnValueOnce(new Promise(() => {}));
    void useRedub.getState().generate();
    expect(useRedub.getState().beginSourceChange()).toBe(false);
  });
});
