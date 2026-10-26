import { create } from 'zustand';

import { installFaultInjection } from '@/features/debug/faults';
import { toAppError, type AppError } from '@/services/errors';
import { createHistoryRepo, type CommitInput, type HistoryRepo, type LoadedRecord } from '@/services/storage/historyRepo';
import { storageRoot } from '@/services/storage/paths';

type HistoryState = {
  ready: boolean;
  records: LoadedRecord[];
  loadError?: AppError;
  load: () => Promise<void>;
  commit: (input: CommitInput) => Promise<LoadedRecord>;
  remove: (id: string) => Promise<void>;
};

let repo: HistoryRepo | null = null;
const getRepo = () => (repo ??= createHistoryRepo(installFaultInjection(), storageRoot()));

export const useHistory = create<HistoryState>((set, get) => ({
  ready: false,
  records: [],
  load: async () => {
    try {
      const records = await getRepo().load();
      set({ records, ready: true, loadError: undefined });
    } catch (e) {
      // 读取失败不阻塞 App；repo 在异常时不会清理任何目录
      set({ ready: true, loadError: toAppError(e) });
    }
  },
  commit: async (input) => {
    const loaded = await getRepo().commit(input);
    const others = get().records.filter((r) => !(r.kind === 'ok' && r.record.id === input.record.id));
    set({ records: [loaded, ...others] });
    return loaded;
  },
  remove: async (id) => {
    await getRepo().remove(id);
    set({ records: get().records.filter((r) => (r.kind === 'ok' ? r.record.id : r.id) !== id) });
  },
}));

export function findRecord(records: LoadedRecord[], id: string): LoadedRecord | undefined {
  return records.find((r) => (r.kind === 'ok' ? r.record.id : r.id) === id);
}
