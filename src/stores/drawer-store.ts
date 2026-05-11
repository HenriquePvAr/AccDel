import { create } from 'zustand'

export type DrawerName = 'order' | 'table' | 'product' | 'confirm' | null

interface DrawerState {
  activeDrawer: DrawerName
  payload: unknown
  openDrawer: (drawer: Exclude<DrawerName, null>, payload?: unknown) => void
  closeDrawer: () => void
}

export const useDrawerStore = create<DrawerState>((set) => ({
  activeDrawer: null,
  payload: null,
  openDrawer: (drawer, payload = null) => set({ activeDrawer: drawer, payload }),
  closeDrawer: () => set({ activeDrawer: null, payload: null }),
}))
