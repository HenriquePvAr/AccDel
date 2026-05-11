import { diningAreasMock, tableSessionsMock, tablesMock } from '@/mocks'
import { create } from 'zustand'

interface DiningState {
  areas: typeof diningAreasMock
  tables: typeof tablesMock
  sessions: typeof tableSessionsMock
}

export const useDiningStore = create<DiningState>(() => ({
  areas: structuredClone(diningAreasMock),
  tables: structuredClone(tablesMock),
  sessions: structuredClone(tableSessionsMock),
}))
