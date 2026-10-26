import type { FsAdapter } from './fs';

// 开发构建的存储层故障注入（PLAN §3.9）：让"保存失败"走真实的回滚路径
export type StorageFault = 'none' | 'copy_source' | 'copy_dub' | 'write_meta' | 'rename_meta';

export const STORAGE_FAULT_LABELS: Record<StorageFault, string> = {
  none: '无',
  copy_source: '复制原音失败',
  copy_dub: '写入配音失败',
  write_meta: '写入元数据失败',
  rename_meta: '提交元数据失败',
};

export function createFaultyFs(real: FsAdapter, getFault: () => StorageFault): FsAdapter {
  const fail = (what: string) => {
    throw new Error(`injected storage fault: ${what}`);
  };
  return {
    ...real,
    copy: async (from, to) => {
      const f = getFault();
      if (f === 'copy_source' && /\/source\.[a-z0-9]+$/.test(to)) fail('copy_source');
      if (f === 'copy_dub' && to.endsWith('/dub.mp3')) fail('copy_dub');
      return real.copy(from, to);
    },
    writeText: async (uri, text) => {
      if (getFault() === 'write_meta' && uri.endsWith('meta.json.tmp')) fail('write_meta');
      return real.writeText(uri, text);
    },
    rename: (uri, newName) => {
      if (getFault() === 'rename_meta' && newName === 'meta.json') fail('rename_meta');
      return real.rename(uri, newName);
    },
  };
}
