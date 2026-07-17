import type { Prisma } from '@prisma/client'

import type { SelectedProductOptionInput } from '@/modules/catalog/product-options'

export interface HistoricalRepeatItem {
  id: string
  productId: string | null
  name: string
  quantity: number
  options: Prisma.JsonValue
}

export interface RepeatItemSelection {
  orderItemId: string
  productId: string
  quantity: number
  options: SelectedProductOptionInput[]
}

export function extractRepeatItemSelections(items: HistoricalRepeatItem[]) {
  const issues: Array<{
    orderItemId: string
    productId: string | null
    itemName: string
    reason: string
  }> = []
  const selections: RepeatItemSelection[] = []

  for (const item of items) {
    if (!item.productId) {
      issues.push({
        orderItemId: item.id,
        productId: null,
        itemName: item.name,
        reason: 'Produto removido do catalogo atual.',
      })
      continue
    }

    try {
      selections.push({
        orderItemId: item.id,
        productId: item.productId,
        quantity: item.quantity,
        options: readHistoricalOptionSelection(item.options),
      })
    } catch (error) {
      issues.push({
        orderItemId: item.id,
        productId: item.productId,
        itemName: item.name,
        reason: error instanceof Error ? error.message : 'Adicionais invalidos.',
      })
    }
  }

  return { selections, issues }
}

export function readHistoricalOptionSelection(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((entry) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      typeof entry.groupId !== 'string' ||
      typeof entry.optionId !== 'string'
    ) {
      throw new Error('Adicional historico sem identificador valido.')
    }

    return {
      groupId: entry.groupId,
      optionId: entry.optionId,
      quantity:
        typeof entry.quantity === 'number' && Number.isInteger(entry.quantity)
          ? entry.quantity
          : 1,
    }
  })
}
