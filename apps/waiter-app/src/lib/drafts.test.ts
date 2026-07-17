import { describe, expect, it, vi } from 'vitest'

import type { DraftItem } from '@/types'
import { clearUserDrafts, draftKey, loadDraft, saveDraft } from './drafts'

const item: DraftItem = {
  clientId: 'client-a',
  productId: 'product-a',
  name: 'Hambúrguer',
  quantity: 1,
  unitPrice: 29.9,
  options: [],
  optionLabels: [],
}

describe('rascunho temporário por mesa', () => {
  it('isola loja, usuário e mesa', () => {
    const tableA = draftKey('store-a', 'waiter-a', 'table-a')
    const tableB = draftKey('store-a', 'waiter-a', 'table-b')
    const otherWaiter = draftKey('store-a', 'waiter-b', 'table-a')
    saveDraft(tableA, [item])

    expect(loadDraft(tableA)).toEqual([item])
    expect(loadDraft(tableB)).toEqual([])
    expect(loadDraft(otherWaiter)).toEqual([])
  })

  it('expira sem usar seleção antiga como fonte da verdade', () => {
    const key = draftKey('store-a', 'waiter-a', 'table-a')
    vi.spyOn(Date, 'now').mockReturnValueOnce(1_000)
    saveDraft(key, [item])
    vi.spyOn(Date, 'now').mockReturnValueOnce(1_000 + 9 * 60 * 60 * 1_000)

    expect(loadDraft(key)).toEqual([])
    expect(localStorage.getItem(key)).toBeNull()
    vi.restoreAllMocks()
  })

  it('limpa somente rascunhos do usuário que saiu', () => {
    const owned = draftKey('store-a', 'waiter-a', 'table-a')
    const other = draftKey('store-a', 'waiter-b', 'table-a')
    saveDraft(owned, [item])
    saveDraft(other, [item])

    clearUserDrafts('store-a', 'waiter-a')

    expect(localStorage.getItem(owned)).toBeNull()
    expect(loadDraft(other)).toHaveLength(1)
  })
})
