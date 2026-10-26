import { Directory, File, Paths } from 'expo-file-system';

import { join } from './fs';

// 存储位置（PLAN §3.5）
// - cacheWork：未确认的录音、导入副本、分享用的临时副本
// - docWork：已确认音源、待保存配音；每次启动清空（会话状态不跨重启）
// - records：成功记录，由 historyRepo 管理
export const storageRoot = () => Paths.document.uri;
export const cacheWorkDir = () => join(Paths.cache.uri, 'work') + '/';
export const docWorkDir = () => join(Paths.document.uri, 'work') + '/';
export const shareDir = () => join(Paths.cache.uri, 'share') + '/';

function ensureEmptyDir(uri: string) {
  const dir = new Directory(uri);
  try {
    if (dir.exists) dir.delete();
  } catch {
    // 删除失败不阻塞启动
  }
  if (!dir.exists) dir.create({ intermediates: true });
}

/** 启动时重建工作目录 */
export function resetWorkDirs() {
  ensureEmptyDir(docWorkDir());
  ensureEmptyDir(cacheWorkDir());
  ensureEmptyDir(shareDir());
}

/** 把文件移动（或复制后删除）到目标目录，返回新 URI */
export async function moveInto(fromUri: string, dirUri: string, name: string): Promise<string> {
  const dir = new Directory(dirUri);
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(join(dirUri, name));
  if (target.exists) target.delete();
  const src = new File(fromUri);
  try {
    await src.move(target);
  } catch {
    // 跨卷或只读来源（例如选择器缓存）时退化为复制
    await src.copy(target);
  }
  return target.uri;
}
