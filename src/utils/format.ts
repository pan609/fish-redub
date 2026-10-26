/** 毫秒 → mm:ss */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 字节 → "0.2MB" */
export function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb < 0.1 ? mb.toFixed(2) : mb.toFixed(1)}MB`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** 录音默认名称："录音 2026-10-26 14:03" */
export function recordingName(date: Date): string {
  return `录音 ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 历史列表时间：今天显示 14:05，否则 10-24 14:05，跨年加年份 */
export function formatListTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (d.toDateString() === now.toDateString()) return time;
  const md = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return d.getFullYear() === now.getFullYear() ? `${md} ${time}` : `${d.getFullYear()}-${md} ${time}`;
}

/** 完整时间：2026-10-26 14:05 */
export function formatFullTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 导出文件名：redub_Sarah_20261026_1405.mp3（去掉文件名非法字符） */
export function exportFileName(voiceName: string, iso: string): string {
  const d = new Date(iso);
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const safe = voiceName.replace(/[\\/:*?"<>|\s]+/g, '_');
  return `redub_${safe}_${stamp}.mp3`;
}
