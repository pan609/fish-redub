import { appError } from '@/services/errors';

import { join, type FsAdapter } from './fs';

// History 存储（PLAN §3.5 / PRD §6.1）：每条记录一个目录，meta.json 存在才算完整记录。
// 记录创建后只读；删除即删除目录。存储层从不覆盖写。

export type HistoryRecord = {
  version: 1;
  id: string;
  sourceName: string;
  sourceType: 'record' | 'import';
  sourceDurationMs: number;
  /** 原始转写文字 */
  transcript: string;
  /** 本次实际用于配音的文字 */
  finalText: string;
  voice: { id: string; name: string };
  language?: string;
  createdAt: string;
  /** 相对记录目录的文件名 */
  sourceFile: string;
  dubFile: string;
  dubDurationMs?: number;
};

export type LoadedRecord =
  | {
      kind: 'ok';
      record: HistoryRecord;
      sourceUri: string;
      dubUri: string;
      sourceAvailable: boolean;
      dubAvailable: boolean;
    }
  /** meta.json 损坏：保留目录，不删除 */
  | { kind: 'broken'; id: string; dirUri: string };

export type CommitInput = {
  record: Omit<HistoryRecord, 'version' | 'sourceFile' | 'dubFile'>;
  sourceUri: string;
  sourceExt: string;
  dubUri: string;
};

const META = 'meta.json';
const META_TMP = 'meta.json.tmp';

export function createHistoryRepo(fs: FsAdapter, rootUri: string) {
  const recordsUri = join(rootUri, 'records') + '/';
  const dirOf = (id: string) => join(recordsUri, id) + '/';

  // 串行队列：commit / remove / load 依次执行，避免同一目录的并发操作
  let queue: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };

  const toLoaded = (record: HistoryRecord): LoadedRecord => {
    const dir = dirOf(record.id);
    const sourceUri = join(dir, record.sourceFile);
    const dubUri = join(dir, record.dubFile);
    return {
      kind: 'ok',
      record,
      sourceUri,
      dubUri,
      sourceAvailable: fs.exists(sourceUri),
      dubAvailable: fs.exists(dubUri),
    };
  };

  const parseMeta = async (uri: string): Promise<HistoryRecord | null> => {
    try {
      const data = JSON.parse(await fs.readText(uri));
      if (data && data.version === 1 && typeof data.id === 'string' && typeof data.finalText === 'string') return data;
      return null;
    } catch {
      return null;
    }
  };

  /**
   * 启动加载与恢复。只有整个遍历没有异常时，才清理"保存到一半"的残留目录；
   * meta.json 损坏的目录列为 broken 并保留。
   */
  async function load(): Promise<LoadedRecord[]> {
    return enqueue(async () => {
      fs.mkdir(recordsUri);
      const results: LoadedRecord[] = [];
      const incomplete: string[] = [];
      let healthy = true;

      for (const id of fs.listDirs(recordsUri)) {
        const dir = dirOf(id);
        try {
          const metaUri = join(dir, META);
          const tmpUri = join(dir, META_TMP);
          if (fs.exists(metaUri)) {
            const rec = await parseMeta(metaUri);
            results.push(rec && rec.id === id ? toLoaded(rec) : { kind: 'broken', id, dirUri: dir });
          } else if (fs.exists(tmpUri)) {
            // 第 4 步（重命名）之前崩溃：临时元数据完整就补做重命名
            const rec = await parseMeta(tmpUri);
            if (rec && rec.id === id && fs.exists(join(dir, rec.sourceFile)) && fs.exists(join(dir, rec.dubFile))) {
              fs.rename(tmpUri, META);
              results.push(toLoaded(rec));
            } else {
              incomplete.push(dir);
            }
          } else {
            incomplete.push(dir);
          }
        } catch {
          healthy = false;
        }
      }

      if (healthy) {
        for (const dir of incomplete) {
          try {
            fs.remove(dir);
          } catch {
            // 清理失败不影响使用，下次启动再试
          }
        }
      }

      return results.sort((a, b) =>
        a.kind === 'ok' && b.kind === 'ok' ? b.record.createdAt.localeCompare(a.record.createdAt) : a.kind === 'ok' ? -1 : 1,
      );
    });
  }

  /** 幂等提交：同一 id 重试不会产生重复记录（PLAN §3.5 保存协议） */
  async function commit(input: CommitInput): Promise<LoadedRecord> {
    return enqueue(async () => {
      const { id } = input.record;
      const dir = dirOf(id);
      const metaUri = join(dir, META);

      // 1. 已提交 → 直接返回
      if (fs.exists(metaUri)) {
        const existing = await parseMeta(metaUri);
        if (existing) return toLoaded(existing);
      }

      const record: HistoryRecord = {
        ...input.record,
        version: 1,
        sourceFile: `source.${input.sourceExt}`,
        dubFile: 'dub.mp3',
      };

      try {
        // 清掉上一次失败可能留下的半成品
        fs.remove(dir);
        fs.mkdir(dir);

        // 2. 复制音频并校验
        const sourceDest = join(dir, record.sourceFile);
        const dubDest = join(dir, record.dubFile);
        await fs.copy(input.sourceUri, sourceDest);
        await fs.copy(input.dubUri, dubDest);
        if (fs.size(sourceDest) <= 0 || fs.size(dubDest) <= 0) throw new Error('复制后的文件为空');

        // 3. 写临时元数据并读回校验
        const tmpUri = join(dir, META_TMP);
        await fs.writeText(tmpUri, JSON.stringify(record));
        const check = await parseMeta(tmpUri);
        if (!check || check.id !== id) throw new Error('元数据读回校验失败');

        // 4. 重命名为 meta.json（目标不存在，同目录原子重命名）→ 提交成功
        fs.rename(tmpUri, META);
      } catch (e) {
        // 5. 失败回滚：此时没有 meta.json，删除不影响任何已提交记录
        try {
          fs.remove(dir);
        } catch {
          // 留给下次启动清理
        }
        throw appError('save_failed', { detail: e instanceof Error ? e.message : String(e) });
      }
      return toLoaded(record);
    });
  }

  async function remove(id: string): Promise<void> {
    return enqueue(async () => {
      fs.remove(dirOf(id));
    });
  }

  return { load, commit, remove, recordsUri };
}

export type HistoryRepo = ReturnType<typeof createHistoryRepo>;
