import { Directory, File } from 'expo-file-system';

/**
 * 存储层依赖的最小文件系统接口。真实实现基于 expo-file-system，
 * 测试与故障注入时可替换（PLAN §3.9）。路径均为 file:// URI。
 */
export interface FsAdapter {
  exists(uri: string): boolean;
  /** 列出目录下的子目录名 */
  listDirs(uri: string): string[];
  mkdir(uri: string): void;
  readText(uri: string): Promise<string>;
  writeText(uri: string, text: string): Promise<void>;
  writeBytes(uri: string, bytes: Uint8Array): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  /** 同目录内重命名（目标必须不存在） */
  rename(uri: string, newName: string): void;
  size(uri: string): number;
  /** 删除文件或目录（不存在时忽略） */
  remove(uri: string): void;
}

const isDirUri = (uri: string) => uri.endsWith('/');

export const expoFs: FsAdapter = {
  exists: (uri) => (isDirUri(uri) ? new Directory(uri).exists : new File(uri).exists),
  listDirs: (uri) => {
    const dir = new Directory(uri);
    if (!dir.exists) return [];
    return dir
      .list()
      .filter((e): e is Directory => e instanceof Directory)
      .map((d) => d.name);
  },
  mkdir: (uri) => {
    const dir = new Directory(uri);
    if (!dir.exists) dir.create({ intermediates: true });
  },
  readText: (uri) => new File(uri).text(),
  writeText: async (uri, text) => {
    const f = new File(uri);
    if (!f.exists) f.create({ intermediates: true });
    await f.write(text);
  },
  writeBytes: async (uri, bytes) => {
    const f = new File(uri);
    if (!f.exists) f.create({ intermediates: true });
    await f.write(bytes);
  },
  copy: (from, to) => new File(from).copy(new File(to)),
  rename: (uri, newName) => new File(uri).rename(newName),
  size: (uri) => {
    const f = new File(uri);
    return f.exists ? (f.size ?? 0) : 0;
  },
  remove: (uri) => {
    const entry = isDirUri(uri) ? new Directory(uri) : new File(uri);
    if (entry.exists) entry.delete();
  },
};

/** 拼接目录 URI 与子路径；目录以 / 结尾 */
export function join(dir: string, ...parts: string[]): string {
  return [dir.replace(/\/+$/, ''), ...parts].join('/');
}
