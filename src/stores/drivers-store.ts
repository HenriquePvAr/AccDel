import { createAppJSONStorage } from '@/lib/storage'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DriversState {
  selectedDriverId: string | null
  activeOnly: boolean
  setSelectedDriverId: (value: string | null) => void
  toggleActiveOnly: () => void
}

export const useDriversStore = create<DriversState>()(
  persist(
    (set) => ({
      selectedDriverId: null,
      activeOnly: false,
      setSelectedDriverId: (value) => set({ selectedDriverId: value }),
      toggleActiveOnly: () => set((state) => ({ activeOnly: !state.activeOnly })),
    }),
    {
      name: 'cain-admin-drivers-ui',
      storage: createAppJSONStorage(),
    },
  ),
)
