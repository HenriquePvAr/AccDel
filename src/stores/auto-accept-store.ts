import { createAppJSONStorage } from '@/lib/storage'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AutoAcceptState {
  enabled: boolean
  setEnabled: (value: boolean) => void
  toggle: () => void
}

export const useAutoAcceptStore = create<AutoAcceptState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (value) => set({ enabled: value }),
      toggle: () => set((state) => ({ enabled: !state.enabled })),
    }),
    {
      name: 'cain-admin-auto-accept',
      storage: createAppJSONStorage(),
    },
  ),
)
