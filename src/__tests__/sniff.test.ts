import { readFileSync } from 'fs';
import { join } from 'path';

import { detectContainer, extensionOf, isSupportedExtension } from '@/services/audio/sniff';
import { exportFileName, formatDuration, formatSize } from '@/utils/format';

const head = (name: string) => new Uint8Array(readFileSync(join(__dirname, '../../test-assets', name)).subarray(0, 16));

describe('文件头识别（使用 test-assets 中的真实文件）', () => {
  it.each([
    ['zh-short.mp3', 'mp3'],
    ['en-short.wav', 'wav'],
    ['en-short.m4a', 'm4a'],
    ['silence.wav', 'wav'],
  ])('%s → %s', (file, expected) => expect(detectContainer(head(file))).toBe(expected));

  it.each(['corrupt.mp3', 'fake-ext.mp3'])('%s 无法识别为支持的格式', (file) => {
    expect(detectContainer(head(file))).toBeNull();
  });

  it('空数据', () => expect(detectContainer(new Uint8Array(0))).toBeNull());
});

describe('扩展名', () => {
  it('大小写不敏感', () => expect(extensionOf('Voice.M4A')).toBe('m4a'));
  it('ogg 不支持', () => expect(isSupportedExtension(extensionOf('a.ogg'))).toBe(false));
});

describe('格式化', () => {
  it('时长', () => expect(formatDuration(65_400)).toBe('01:05'));
  it('大小', () => expect(formatSize(11_136_078)).toBe('10.6MB'));
  it('导出文件名去掉非法字符', () =>
    expect(exportFileName('温柔 女声/1', '2026-10-26T06:05:00.000Z')).toMatch(/^redub_温柔_女声_1_20261026_\d{4}\.mp3$/));
});
