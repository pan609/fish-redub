import { create } from 'zustand';

import { getFetchImpl, setFetchImpl } from '@/services/fish/client';
import { createFaultyFetch, type NetworkFault } from '@/services/fish/faults';
import { createFaultyFs, type StorageFault } from '@/services/storage/faults';
import { expoFs, type FsAdapter } from '@/services/storage/fs';

// 开发构建的故障开关（PLAN §3.9）。生产构建中始终为 none，且调试面板入口不渲染。
type FaultState = {
  network: NetworkFault;
  storage: StorageFault;
  setNetwork: (f: NetworkFault) => void;
  setStorage: (f: StorageFault) => void;
};

export const useFaults = create<FaultState>((set) => ({
  network: 'none',
  storage: 'none',
  setNetwork: (network) => set({ network }),
  setStorage: (storage) => set({ storage }),
}));

let installed = false;

/** 在开发构建中包装网络层；返回存储层要使用的文件系统适配器 */
export function installFaultInjection(): FsAdapter {
  if (!__DEV__) return expoFs;
  if (!installed) {
    setFetchImpl(createFaultyFetch(getFetchImpl(), () => useFaults.getState().network));
    installed = true;
  }
  return createFaultyFs(expoFs, () => useFaults.getState().storage);
}
