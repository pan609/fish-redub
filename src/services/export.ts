import { Directory, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { appError } from '@/services/errors';
import { join } from '@/services/storage/fs';
import { shareDir } from '@/services/storage/paths';

export type ExportOutcome = 'shared' | 'saved' | 'cancelled';

/** 复制为友好文件名后再交给系统，接收方看到的是 redub_xxx.mp3 */
async function stageForShare(uri: string, fileName: string): Promise<string> {
  const dir = new Directory(shareDir());
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(join(shareDir(), fileName));
  if (target.exists) target.delete();
  await new File(uri).copy(target);
  return target.uri;
}

/**
 * 系统分享面板（双端）。关闭面板不代表成功或失败，统一返回 'shared'，
 * 界面不提示"已保存"（PRD S4）。
 */
export async function shareAudio(uri: string, fileName: string): Promise<ExportOutcome> {
  if (!(await Sharing.isAvailableAsync())) throw appError('unknown', { detail: '系统分享不可用' });
  const staged = await stageForShare(uri, fileName);
  await Sharing.shareAsync(staged, { mimeType: 'audio/mpeg', UTI: 'public.mp3', dialogTitle: '分享配音' });
  return 'shared';
}

const isPickerCancel = (e: unknown) => /cancel/i.test(String((e as any)?.code ?? '') + String((e as any)?.message ?? ''));

/**
 * 导出到设备：iOS 走分享面板（用户选"存储到文件"）；
 * Android 用 SAF 目录选择器，由用户选择保存位置（PRD S2）。
 */
export async function exportAudio(uri: string, fileName: string): Promise<ExportOutcome> {
  if (Platform.OS !== 'android') return shareAudio(uri, fileName);

  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch (e) {
    if (isPickerCancel(e)) return 'cancelled';
    throw appError('save_failed', { detail: String(e) });
  }
  try {
    const bytes = await new File(uri).bytes();
    // 同名文件由系统 DocumentsProvider 自动加序号
    const target = dir.createFile(fileName, 'audio/mpeg');
    await target.write(bytes);
    return 'saved';
  } catch (e) {
    throw appError('save_failed', { detail: String(e) });
  }
}
