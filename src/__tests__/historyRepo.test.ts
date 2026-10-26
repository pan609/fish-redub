import { isAppError } from '@/services/errors';
import { createFaultyFs, type StorageFault } from '@/services/storage/faults';
import { createHistoryRepo, type CommitInput } from '@/services/storage/historyRepo';

import { createMemoryFs } from './helpers/memoryFs';

const ROOT = 'file:///doc';

function setup(fault: StorageFault = 'none') {
  const mem = createMemoryFs();
  let current = fault;
  const fs = createFaultyFs(mem.fs, () => current);
  const repo = createHistoryRepo(fs, ROOT);
  mem.files.set('file:///doc/work/src.m4a', new Uint8Array([1, 2, 3]));
  mem.files.set('file:///doc/work/dub.mp3', new Uint8Array([4, 5, 6, 7]));
  return { ...mem, repo, setFault: (f: StorageFault) => (current = f) };
}

function input(id: string, createdAt = '2026-10-26T06:00:00.000Z'): CommitInput {
  return {
    record: {
      id,
      sourceName: '录音 2026-10-26 14:03',
      sourceType: 'record',
      sourceDurationMs: 12000,
      transcript: '你好世界',
      finalText: '你好，世界。',
      voice: { id: 'v1', name: 'Sarah' },
      createdAt,
    },
    sourceUri: 'file:///doc/work/src.m4a',
    sourceExt: 'm4a',
    dubUri: 'file:///doc/work/dub.mp3',
  };
}

const metaPath = (id: string) => `file:///doc/records/${id}/meta.json`;

describe('historyRepo', () => {
  it('提交后能加载出完整记录，文件路径基于记录目录', async () => {
    const { repo } = setup();
    await repo.commit(input('a'));
    const list = await repo.load();
    expect(list).toHaveLength(1);
    const r = list[0];
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.record.finalText).toBe('你好，世界。');
      expect(r.record.transcript).toBe('你好世界');
      expect(r.sourceUri).toBe('file:///doc/records/a/source.m4a');
      expect(r.dubAvailable && r.sourceAvailable).toBe(true);
    }
  });

  it('同一 id 重复提交是幂等的，不产生重复记录', async () => {
    const { repo } = setup();
    await repo.commit(input('a'));
    await repo.commit(input('a'));
    expect(await repo.load()).toHaveLength(1);
  });

  it.each<StorageFault>(['copy_source', 'copy_dub', 'write_meta', 'rename_meta'])(
    '存储故障 %s：返回 save_failed，不留下 meta.json，不影响已有记录',
    async (fault) => {
      const { repo, files, setFault } = setup();
      await repo.commit(input('old'));
      setFault(fault);
      const err = await repo.commit(input('new')).catch((e) => e);
      expect(isAppError(err) && err.code).toBe('save_failed');
      expect(files.has(metaPath('new'))).toBe(false);
      expect([...files.keys()].some((k) => k.includes('/records/new/'))).toBe(false);
      setFault('none');
      const list = await repo.load();
      expect(list.map((r) => r.kind === 'ok' && r.record.id)).toEqual(['old']);
    },
  );

  it('保存失败后重试保存（同一 id）成功，只有一条记录', async () => {
    const { repo, setFault } = setup('write_meta');
    await expect(repo.commit(input('a'))).rejects.toMatchObject({ code: 'save_failed' });
    setFault('none');
    await repo.commit(input('a'));
    expect(await repo.load()).toHaveLength(1);
  });

  it('meta.json 损坏的记录列为 broken 并保留目录，不被清理', async () => {
    const { repo, files } = setup();
    await repo.commit(input('a'));
    files.set(metaPath('a'), '{ 坏掉的 json');
    const list = await repo.load();
    expect(list[0].kind).toBe('broken');
    expect(files.has('file:///doc/records/a/dub.mp3')).toBe(true);
  });

  it('重命名前崩溃（只有完整的 meta.json.tmp）时自动恢复', async () => {
    const { repo, files } = setup();
    await repo.commit(input('a'));
    const meta = files.get(metaPath('a'))!;
    files.delete(metaPath('a'));
    files.set('file:///doc/records/a/meta.json.tmp', meta);
    const list = await repo.load();
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('ok');
    expect(files.has(metaPath('a'))).toBe(true);
  });

  it('没有任何元数据的残留目录在加载正常时被清理', async () => {
    const { repo, files, fs } = setup();
    fs.mkdir('file:///doc/records/half/');
    files.set('file:///doc/records/half/dub.mp3', new Uint8Array([1]));
    expect(await repo.load()).toHaveLength(0);
    expect(files.has('file:///doc/records/half/dub.mp3')).toBe(false);
  });

  it('加载过程中出现异常时跳过清理，不误删任何目录', async () => {
    const mem = createMemoryFs();
    const repo = createHistoryRepo(
      {
        ...mem.fs,
        exists: (uri) => {
          if (uri.includes('/records/boom/')) throw new Error('读取异常');
          return mem.fs.exists(uri);
        },
      },
      ROOT,
    );
    mem.fs.mkdir('file:///doc/records/boom/');
    mem.fs.mkdir('file:///doc/records/half/');
    mem.files.set('file:///doc/records/half/dub.mp3', new Uint8Array([1]));
    await repo.load();
    expect(mem.files.has('file:///doc/records/half/dub.mp3')).toBe(true);
  });

  it('恢复临时元数据时读取出错：保留目录，不删除音频（代码审查 #1）', async () => {
    const mem = createMemoryFs();
    const repo = createHistoryRepo(mem.fs, ROOT);
    mem.files.set('file:///doc/work/src.m4a', new Uint8Array([1]));
    mem.files.set('file:///doc/work/dub.mp3', new Uint8Array([2]));
    await repo.commit(input('a'));
    const meta = mem.files.get(metaPath('a'))!;
    mem.files.delete(metaPath('a'));
    mem.files.set('file:///doc/records/a/meta.json.tmp', meta);
    const flaky = createHistoryRepo(
      {
        ...mem.fs,
        readText: async (uri) => {
          if (uri.endsWith('meta.json.tmp')) throw new Error('I/O 错误');
          return mem.fs.readText(uri);
        },
      },
      ROOT,
    );
    await flaky.load();
    expect(mem.files.has('file:///doc/records/a/dub.mp3')).toBe(true);
    expect(mem.files.has('file:///doc/records/a/meta.json.tmp')).toBe(true);
    // I/O 恢复后再次加载可以正常恢复
    expect((await repo.load())[0].kind).toBe('ok');
  });

  it('meta.json 读取出错：列为损坏且本次不清理其他残留目录', async () => {
    const mem = createMemoryFs();
    const repo = createHistoryRepo(mem.fs, ROOT);
    mem.files.set('file:///doc/work/src.m4a', new Uint8Array([1]));
    mem.files.set('file:///doc/work/dub.mp3', new Uint8Array([2]));
    await repo.commit(input('a'));
    mem.fs.mkdir('file:///doc/records/half/');
    mem.files.set('file:///doc/records/half/dub.mp3', new Uint8Array([1]));
    const flaky = createHistoryRepo(
      {
        ...mem.fs,
        readText: async (uri) => {
          if (uri === metaPath('a')) throw new Error('I/O 错误');
          return mem.fs.readText(uri);
        },
      },
      ROOT,
    );
    const list = await flaky.load();
    expect(list.find((r) => r.kind === 'broken')).toBeTruthy();
    expect(mem.files.has('file:///doc/records/half/dub.mp3')).toBe(true);
  });

  it('列表按创建时间倒序', async () => {
    const { repo } = setup();
    await repo.commit(input('a', '2026-10-24T01:00:00.000Z'));
    await repo.commit(input('b', '2026-10-26T01:00:00.000Z'));
    const ids = (await repo.load()).map((r) => r.kind === 'ok' && r.record.id);
    expect(ids).toEqual(['b', 'a']);
  });

  it('删除只移除对应记录目录', async () => {
    const { repo } = setup();
    await repo.commit(input('a'));
    await repo.commit(input('b'));
    await repo.remove('a');
    expect((await repo.load()).map((r) => r.kind === 'ok' && r.record.id)).toEqual(['b']);
  });

  it('文件缺失的记录标记为不可用而不是丢弃', async () => {
    const { repo, files } = setup();
    await repo.commit(input('a'));
    files.delete('file:///doc/records/a/dub.mp3');
    const [r] = await repo.load();
    expect(r.kind === 'ok' && r.dubAvailable).toBe(false);
  });
});
