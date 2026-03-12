import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SyncActionType = 'SYMPTOM_LOG' | 'PATIENT_UPDATE';

export interface SyncJob {
  id: string;
  type: SyncActionType;
  endpoint: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  payload: any;
  timestamp: number;
}

interface SyncState {
  queue: SyncJob[];
  isSyncing: boolean;
  enqueue: (job: Omit<SyncJob, 'id' | 'timestamp'>) => void;
  dequeue: (id: string) => void;
  setSyncing: (status: boolean) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      queue: [],
      isSyncing: false,

      enqueue: (job) => {
        const newJob: SyncJob = {
          ...job,
          id: Math.random().toString(36).substring(2) + Date.now().toString(36),
          timestamp: Date.now(),
        };
        set((state) => ({ queue: [...state.queue, newJob] }));
      },

      dequeue: (id) => {
        set((state) => ({
          queue: state.queue.filter((job) => job.id !== id),
        }));
      },

      setSyncing: (status) => set({ isSyncing: status }),
    }),
    {
      name: 'maternal-sync-queue',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
