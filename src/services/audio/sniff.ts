// 通过文件头判断真实音频容器（PRD I3：扩展名和 MIME 都不可靠）
export type AudioContainer = 'mp3' | 'wav' | 'm4a';

export const SUPPORTED_EXTENSIONS = ['mp3', 'wav', 'm4a'] as const;

const ascii = (bytes: Uint8Array, start: number, len: number) =>
  String.fromCharCode(...Array.from(bytes.subarray(start, start + len)));

/** MPEG 音频帧同步：11 位全 1，且 layer 位不为 00（00 是 AAC ADTS） */
export function isMpegFrameSync(b0: number, b1: number): boolean {
  return b0 === 0xff && (b1 & 0xe0) === 0xe0 && ((b1 >> 1) & 0x03) !== 0;
}

export function detectContainer(bytes: Uint8Array): AudioContainer | null {
  if (bytes.length < 12) return null;
  if (ascii(bytes, 0, 3) === 'ID3' || isMpegFrameSync(bytes[0], bytes[1])) return 'mp3';
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WAVE') return 'wav';
  if (ascii(bytes, 4, 4) === 'ftyp') return 'm4a';
  return null;
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function isSupportedExtension(ext: string): ext is AudioContainer {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}
