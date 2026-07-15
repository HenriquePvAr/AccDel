import type { DraftItem } from '@/types'

const draftVersion = 1
const maxDraftAgeMs = 8 * 60 * 60 * 1000

interface StoredDraft {
  version: number
  expiresAt: number
  items: DraftItem[]
}

export function draftKey(storeId: string, userId: string, tableId: string) {
  return `cain-waiter:draft:${storeId}:${userId}:${tableId}`
}

export function loadDraft(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null') as StoredDraft | null
    if (!parsed || parsed.version !== draftVersion || parsed.expiresAt <= Date.now()) {
      localStorage.removeItem(key)
      return []
    }
    return Array.isArray(parsed.items) ? parsed.items : []
  } catch {
    localStorage.removeItem(key)
    return []
  }
}

export function saveDraft(key: string, items: DraftItem[]) {
  if (!items.length) {
    localStorage.removeItem(key)
    return
  }
  const payload: StoredDraft = {
    version: draftVersion,
    expiresAt: Date.now() + maxDraftAgeMs,
    items,
  }
  localStorage.setItem(key, JSON.stringify(payload))
}

export function clearDraft(key: string) {
  localStorage.removeItem(key)
}

export function clearUserDrafts(storeId: string, userId: string) {
  const prefix = `cain-waiter:draft:${storeId}:${userId}:`
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (key?.startsWith(prefix)) localStorage.removeItem(key)
  }
}
