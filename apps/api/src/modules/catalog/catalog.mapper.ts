import type { Prisma } from '@prisma/client'

import { toNumber } from '@/shared/mappers/number'

type ProductWithAvailability = Prisma.ProductGetPayload<{
  include: {
    availability: true
  }
}>

export function mapCategory(category: {
  id: string
  name: string
  description: string
  sortOrder: number
}) {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    sortOrder: category.sortOrder,
  }
}

export function mapProduct(product: ProductWithAvailability) {
  return {
    id: product.id,
    categoryId: product.categoryId,
    name: product.name,
    description: product.description,
    price: toNumber(product.price),
    image: product.image,
    featured: product.featured,
    active: product.active,
    preparationStation: product.preparationStation,
    tags: product.tags,
    availability: product.availability.map((entry) => ({
      channel: entry.channel,
      available: entry.available,
      visible: entry.visible,
      soldOut: entry.soldOut,
      priceOverride: entry.priceOverride ? toNumber(entry.priceOverride) : undefined,
    })),
  }
}
