import { VOICES } from '@/config/voices';
import { appError } from '@/services/errors';
import * as M from '@/features/redub/machine';

const audio = (id = 'src1'): M.SourceAudio => ({
  id,
  name: '录音 2026-10-26 14:03',
  type: 'record',
  uri: `file:///doc/work/${id}.m4a`,
  ext: 'm4a',
  durationMs: 12000,
  sizeBytes: 200000,
});

const zhVoice = VOICES.find((v) => v.language === 'zh')!;
const enVoice = VOICES.find((v) => v.language === 'en')!;

/** 走到"文字已确认"的状态 */
function confirmed(text = '你好，世界。') {
  let s = M.sourceAccepted(M.initialState, audio());
  s = M.transcribeStarted(s, 1);
  s = M.transcribeSucceeded(s, 1, { text: '你好世界', language: 'zh' });
  s = M.editDraft(s, text);
  return M.confirmText(s);
}

function success() {
  let s = confirmed();
  const snap = M.currentSnapshot(s)!;
  s = M.generateStarted(s, 1, snap);
  const pending: M.PendingDub = { recordId: 'r1', snapshot: snap, audioUri: 'file:///doc/work/r1.mp3', durationMs: 3000, createdAt: 'now' };
  s = M.audioReceived(s, 1, pending);
  return M.saveSucceeded(s, { recordId: 'r1', snapshot: snap, sourceUri: 's', dubUri: 'd', durationMs: 3000, createdAt: 'now' });
}

describe('音源', () => {
  it('新音源清空旧的文字与结果', () => {
    const s = M.sourceAccepted(success(), audio('src2'));
    expect(s.text.kind).toBe('cancelled');
    expect(s.dub.kind).toBe('idle');
  });

  it('新音源校验失败或取消时保留原状态（安全替换）', () => {
    const before = success();
    const after = M.sourceChangeFailed(M.beginSourceChange(before), appError('bad_audio'));
    expect(after.source).toEqual(before.source);
    expect(after.text).toEqual(before.text);
    expect(after.dub).toEqual(before.dub);
    expect(after.sourceError?.code).toBe('bad_audio');
  });
});

describe('转写', () => {
  it('结果为空 → empty，不会进入确认', () => {
    let s = M.transcribeStarted(M.sourceAccepted(M.initialState, audio()), 1);
    s = M.transcribeSucceeded(s, 1, { text: '   ' });
    expect(s.text.kind).toBe('empty');
    expect(M.canGenerate(s)).toBe(false);
  });

  it('迟到的旧响应被丢弃', () => {
    let s = M.transcribeStarted(M.sourceAccepted(M.initialState, audio()), 1);
    s = M.transcribeCancelled(s);
    s = M.transcribeStarted(s, 2);
    s = M.transcribeSucceeded(s, 1, { text: '旧的结果' });
    expect(s.text).toEqual({ kind: 'transcribing', requestId: 2 });
  });

  it('识别字数远超语速上限（静音幻觉）按未识别处理', () => {
    let s = M.transcribeStarted(M.sourceAccepted(M.initialState, audio()), 1); // 时长 12 秒 → 上限 300 字
    s = M.transcribeSucceeded(s, 1, { text: 'no, '.repeat(800) });
    expect(s.text.kind).toBe('empty');
    expect(M.isPlausibleTranscript('正常的一句话', 3000)).toBe(true);
    expect(M.isPlausibleTranscript('字'.repeat(61), 1000)).toBe(false);
  });

  it('取消后进入待转写，不自动重发', () => {
    const s = M.transcribeCancelled(M.transcribeStarted(M.sourceAccepted(M.initialState, audio()), 1));
    expect(s.text.kind).toBe('cancelled');
  });

  it('失败保留音源，可重试', () => {
    let s = M.transcribeStarted(M.sourceAccepted(M.initialState, audio()), 1);
    s = M.transcribeFailed(s, 1, appError('offline'));
    expect(s.text.kind).toBe('failed');
    expect(s.source.kind).toBe('ready');
  });

  it('按识别语言默认选择声音，用户手动选过后不再自动切换', () => {
    let s = M.transcribeStarted(M.sourceAccepted(M.initialState, audio()), 1);
    s = M.transcribeSucceeded(s, 1, { text: 'hello', language: 'en' });
    expect(s.voiceId).toBe(enVoice.id);
    s = M.selectVoice(s, zhVoice.id);
    s = M.transcribeStarted(M.sourceAccepted(s, audio('src2')), 2);
    s = M.transcribeSucceeded(s, 2, { text: 'hello again', language: 'en' });
    expect(s.voiceId).toBe(zhVoice.id);
  });

  it('转写为空时可手动输入，原始转写保持为空', () => {
    let s = M.transcribeStarted(M.sourceAccepted(M.initialState, audio()), 1);
    s = M.startManualInput(M.transcribeSucceeded(s, 1, { text: '' }));
    s = M.confirmText(M.editDraft(s, '手动输入的文字'));
    expect(s.text).toMatchObject({ kind: 'confirmed', transcript: '', finalText: '手动输入的文字' });
  });
});

describe('文字', () => {
  it('纯空白不能确认', () => {
    let s = M.transcribeStarted(M.sourceAccepted(M.initialState, audio()), 1);
    s = M.transcribeSucceeded(s, 1, { text: '你好' });
    s = M.confirmText(M.editDraft(s, ' \n\t '));
    expect(s.text.kind).toBe('editing');
  });

  it('超过 1000 字不能确认', () => {
    expect(M.validateDraft('字'.repeat(1001))).toBe('too_long');
  });

  it('确认时去除首尾空白，恢复原文回到转写结果', () => {
    expect((confirmed('  你好  ').text as any).finalText).toBe('你好');
    let s = M.transcribeSucceeded(M.transcribeStarted(M.sourceAccepted(M.initialState, audio()), 1), 1, { text: '原文' });
    s = M.restoreTranscript(M.editDraft(s, '改过'));
    expect((s.text as any).draft).toBe('原文');
  });
});

describe('配音', () => {
  it('请求使用确认后的文字和当前声音', () => {
    const s = M.selectVoice(confirmed('最终文字'), enVoice.id);
    expect(M.currentSnapshot(s)).toMatchObject({ finalText: '最终文字', voiceId: enVoice.id, transcript: '你好世界' });
  });

  it('文字未确认时不能生成', () => {
    const s = M.reopenText(confirmed());
    expect(M.canGenerate(s)).toBe(false);
  });

  it('生成中锁定文字、声音与音源', () => {
    let s = confirmed();
    s = M.generateStarted(s, 1, M.currentSnapshot(s)!);
    expect(M.selectVoice(s, enVoice.id).voiceId).toBe(s.voiceId);
    expect(M.reopenText(s).text.kind).toBe('confirmed');
    expect(M.beginSourceChange(s).sourceBusy).toBe(false);
    expect(M.generateStarted(s, 2, M.currentSnapshot(s)!)).toBe(s);
  });

  it('取消生成恢复上一次结果', () => {
    let s = success();
    s = M.selectVoice(s, enVoice.id);
    s = M.generateStarted(s, 2, M.currentSnapshot(s)!);
    s = M.generateCancelled(s);
    expect(s.dub.kind).toBe('success');
    expect((s.dub as any).result.recordId).toBe('r1');
  });

  it('取消后旧请求的响应被丢弃', () => {
    let s = confirmed();
    const snap = M.currentSnapshot(s)!;
    s = M.generateCancelled(M.generateStarted(s, 1, snap));
    const late = M.audioReceived(s, 1, { recordId: 'x', snapshot: snap, durationMs: 1, createdAt: 'now' });
    expect(late).toBe(s);
  });

  it('请求失败保留快照与上一次结果', () => {
    let s = success();
    s = M.selectVoice(s, enVoice.id);
    s = M.generateFailed(M.generateStarted(s, 2, M.currentSnapshot(s)!), 2, appError('timeout'));
    expect(s.dub).toMatchObject({ kind: 'failed', snapshot: { voiceId: enVoice.id }, previous: { recordId: 'r1' } });
    expect(M.visibleResult(s)?.recordId).toBe('r1');
  });

  it('保存失败后"重试保存"沿用同一 recordId', () => {
    let s = confirmed();
    const snap = M.currentSnapshot(s)!;
    s = M.generateStarted(s, 1, snap);
    s = M.audioReceived(s, 1, { recordId: 'r9', snapshot: snap, durationMs: 1, createdAt: 'now' });
    s = M.saveFailed(s, 'r9', appError('save_failed'));
    expect(s.dub.kind).toBe('saveFailed');
    s = M.saveRetried(s, 2);
    expect(s.dub).toMatchObject({ kind: 'saving', pending: { recordId: 'r9' } });
  });
});

describe('生成入口与记录删除', () => {
  it('保存失败后修改了声音：提供按新内容生成的入口（代码审查 #3）', () => {
    let s = confirmed();
    const snap = M.currentSnapshot(s)!;
    s = M.generateStarted(s, 1, snap);
    s = M.audioReceived(s, 1, { recordId: 'r1', snapshot: snap, durationMs: 1, createdAt: 'now' });
    s = M.saveFailed(s, 'r1', appError('save_failed'));
    expect(M.shouldOfferGenerate(s)).toBe(false);
    s = M.selectVoice(s, VOICES.find((v) => v.id !== s.voiceId)!.id);
    expect(M.shouldOfferGenerate(s)).toBe(true);
    expect(M.generateStarted(s, 2, M.currentSnapshot(s)!).dub.kind).toBe('generating');
  });

  it('删除的记录若是当前结果，结果失效；其他记录不受影响', () => {
    const s = success();
    expect(M.recordRemoved(s, 'other')).toBe(s);
    expect(M.recordRemoved(s, 'r1').dub.kind).toBe('idle');
  });

  it('待保存音频解码失败回到请求失败状态，不能重试保存', () => {
    let s = confirmed();
    const snap = M.currentSnapshot(s)!;
    s = M.audioReceived(M.generateStarted(s, 1, snap), 1, { recordId: 'r1', snapshot: snap, durationMs: 0, createdAt: 'now' });
    s = M.pendingRejected(s, 'r1', appError('incomplete_audio'));
    expect(s.dub.kind).toBe('failed');
  });
});

describe('结果过期（实时计算）', () => {
  it('刚生成时不过期', () => {
    const s = success();
    expect(M.isResultExpired(s, M.visibleResult(s)!)).toBe(false);
  });
  it('修改文字后过期', () => {
    const s = M.reopenText(success());
    expect(M.isResultExpired(s, M.visibleResult(s)!)).toBe(true);
  });
  it('换声音后过期，换回原声音后恢复', () => {
    const s0 = success();
    const s1 = M.selectVoice(s0, VOICES.find((v) => v.id !== s0.voiceId)!.id);
    expect(M.isResultExpired(s1, M.visibleResult(s1)!)).toBe(true);
    const s2 = M.selectVoice(s1, s0.voiceId);
    expect(M.isResultExpired(s2, M.visibleResult(s2)!)).toBe(false);
  });
});
