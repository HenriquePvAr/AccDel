import { createJSONStorage, type StateStorage } from 'zustand/middleware'

const memoryStorage = new Map<string, string>()

function getStorage(): Storage | StateStorage {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage
  }

  return {
    getItem: (name) => memoryStorage.get(name) ?? null,
    setItem: (name, value) => {
      memoryStorage.set(name, value)
    },
    removeItem: (name) => {
      memoryStorage.delete(name)
    },
  }
}

export function readStorage<T>(key: string): T | null {
  const raw = getStorage().getItem(key)

  if (raw instanceof Promise) {
    return null
  }

  if (!raw) {
    return null
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function writeStorage<T>(key: string, value: T) {
  getStorage().setItem(key, JSON.stringify(value))
}

export function removeStorage(key: string) {
  getStorage().removeItem(key)
}

export function createAppJSONStorage<T>() {
  return createJSONStorage<T>(() => getStorage())
}
