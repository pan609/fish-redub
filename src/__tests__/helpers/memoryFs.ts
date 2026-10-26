import type { FsAdapter } from '@/services/storage/fs';

/** 内存版文件系统，用于存储层单元测试 */
export function createMemoryFs() {
  const files = new Map<string, Uint8Array | string>();
  const dirs = new Set<string>();
  const norm = (u: string) => u.replace(/\/+$/, '');
  const parent = (u: string) => norm(u).slice(0, norm(u).lastIndexOf('/'));

  const fs: FsAdapter = {
    exists: (uri) => files.has(norm(uri)) || dirs.has(norm(uri)),
    listDirs: (uri) => {
      const base = norm(uri) + '/';
      return [...dirs].filter((d) => d.startsWith(base) && !d.slice(base.length).includes('/')).map((d) => d.slice(base.length));
    },
    mkdir: (uri) => {
      let cur = norm(uri);
      while (cur && !dirs.has(cur)) {
        dirs.add(cur);
        cur = parent(cur);
      }
    },
    readText: async (uri) => {
      const v = files.get(norm(uri));
      if (v === undefined) throw new Error('not found ' + uri);
      return typeof v === 'string' ? v : Buffer.from(v).toString('utf8');
    },
    writeText: async (uri, text) => {
      fs.mkdir(parent(uri));
      files.set(norm(uri), text);
    },
    writeBytes: async (uri, bytes) => {
      fs.mkdir(parent(uri));
      files.set(norm(uri), bytes);
    },
    copy: async (from, to) => {
      const v = files.get(norm(from));
      if (v === undefined) throw new Error('copy source missing ' + from);
      fs.mkdir(parent(to));
      files.set(norm(to), v);
    },
    rename: (uri, newName) => {
      const v = files.get(norm(uri));
      if (v === undefined) throw new Error('rename source missing');
      const target = parent(uri) + '/' + newName;
      if (files.has(target)) throw new Error('rename target exists');
      files.delete(norm(uri));
      files.set(target, v);
    },
    size: (uri) => {
      const v = files.get(norm(uri));
      return v === undefined ? 0 : typeof v === 'string' ? v.length : v.length;
    },
    remove: (uri) => {
      const n = norm(uri);
      files.delete(n);
      for (const k of [...files.keys()]) if (k.startsWith(n + '/')) files.delete(k);
      for (const d of [...dirs]) if (d === n || d.startsWith(n + '/')) dirs.delete(d);
    },
  };
  return { fs, files, dirs };
}
