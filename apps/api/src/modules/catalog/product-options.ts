import { BadRequestException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'

type ProductWithOptionGroups = Prisma.ProductGetPayload<{
  include: {
    optionGroups: {
      include: {
        group: {
          include: {
            options: true
          }
        }
      }
    }
  }
}>

export interface SelectedProductOptionInput {
  groupId: string
  optionId: string
  quantity?: number
}

export interface ResolvedProductOption {
  groupId: string
  groupName: string
  optionId: string
  name: string
  quantity: number
  price: number
}

export function toProductOptionsJson(options: ResolvedProductOption[]): Prisma.InputJsonArray {
  return options.map(
    (option): Prisma.InputJsonObject => ({
      groupId: option.groupId,
      groupName: option.groupName,
      optionId: option.optionId,
      name: option.name,
      quantity: option.quantity,
      price: option.price,
    }),
  )
}

export function resolveProductOptionSelection(
  product: ProductWithOptionGroups,
  selectedOptions: SelectedProductOptionInput[] = [],
) {
  if (!product.optionGroups.length && selectedOptions.length) {
    throw new BadRequestException(`Produto ${product.name} nao aceita opcoes.`)
  }

  const normalizedSelections = selectedOptions.map((option) => ({
    groupId: option.groupId,
    optionId: option.optionId,
    quantity: Math.max(1, option.quantity ?? 1),
  }))
  const productGroupIds = new Set(product.optionGroups.map((link) => link.groupId))
  const resolvedOptions: ResolvedProductOption[] = []

  for (const selection of normalizedSelections) {
    if (!productGroupIds.has(selection.groupId)) {
      throw new BadRequestException(`Opcao invalida para ${product.name}.`)
    }
  }

  for (const link of product.optionGroups) {
    const selectionsForGroup = normalizedSelections.filter(
      (selection) => selection.groupId === link.groupId,
    )
    const selectionCount = selectionsForGroup.reduce(
      (sum, selection) => sum + selection.quantity,
      0,
    )

    if (selectionCount < link.minSelections) {
      throw new BadRequestException(buildMinimumMessage(product.name, link.group.name))
    }

    if (selectionCount > link.maxSelections) {
      throw new BadRequestException(buildMaximumMessage(product.name, link.maxSelections))
    }

    for (const selection of selectionsForGroup) {
      const option = link.group.options.find(
        (entry) => entry.id === selection.optionId && entry.active,
      )

      if (!option) {
        throw new BadRequestException(`Opcao invalida para ${product.name}.`)
      }

      resolvedOptions.push({
        groupId: link.groupId,
        groupName: link.group.name,
        optionId: option.id,
        name: option.name,
        quantity: selection.quantity,
        price: option.priceDelta.toNumber(),
      })
    }
  }

  return {
    options: resolvedOptions,
    optionsTotal: resolvedOptions.reduce(
      (sum, option) => sum + option.price * option.quantity,
      0,
    ),
  }
}

function buildMinimumMessage(productName: string, groupName: string) {
  const normalizedProduct = normalizeText(productName)
  const normalizedGroup = normalizeText(groupName)

  if (normalizedProduct.includes('pizza') && normalizedGroup.includes('sabor')) {
    return 'Escolha pelo menos 1 sabor para esta pizza.'
  }

  if (normalizedProduct.includes('suco') && normalizedGroup.includes('sabor')) {
    return 'Escolha o sabor do suco.'
  }

  if (normalizedProduct.includes('lasanha') && normalizedGroup.includes('sabor')) {
    return 'Escolha o sabor da lasanha.'
  }

  if (normalizedProduct.includes('sorvete') && normalizedGroup.includes('sabor')) {
    return 'Escolha pelo menos 1 sabor.'
  }

  return `Escolha uma opção em ${groupName}.`
}

function buildMaximumMessage(productName: string, maxSelections: number) {
  const normalizedProduct = normalizeText(productName)

  if (normalizedProduct.includes('pizza') || normalizedProduct.includes('sorvete')) {
    return `Esse tamanho permite até ${maxSelections} sabores.`
  }

  return `Esse item permite até ${maxSelections} opções.`
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}
