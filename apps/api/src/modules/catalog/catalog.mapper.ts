import type { Prisma } from '@prisma/client'

import { toNumber } from '@/shared/mappers/number'

type ProductWithAvailability = Prisma.ProductGetPayload<{
  include: {
    availability: true
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

export function mapCategory(category: {
  id: string
  name: string
  description: string
  active: boolean
  icon: string | null
  color: string | null
  visibleOnPos: boolean
  visibleOnDigitalMenu: boolean
  sortOrder: number
  _count?: {
    products: number
  }
}) {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    active: category.active,
    icon: category.icon ?? undefined,
    color: category.color ?? undefined,
    visibleOnPos: category.visibleOnPos,
    visibleOnDigitalMenu: category.visibleOnDigitalMenu,
    sortOrder: category.sortOrder,
    productCount: category._count?.products ?? 0,
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
    sortOrder: product.sortOrder,
    tags: product.tags,
    availability: product.availability.map((entry) => ({
      channel: entry.channel,
      available: entry.available,
      visible: entry.visible,
      soldOut: entry.soldOut,
      priceOverride: entry.priceOverride ? toNumber(entry.priceOverride) : undefined,
    })),
    optionGroups: product.optionGroups
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((link) => ({
        id: link.group.id,
        name: link.group.name,
        description: link.description ?? link.group.description ?? undefined,
        required: link.required,
        minSelections: link.minSelections,
        maxSelections: link.maxSelections,
        sortOrder: link.sortOrder,
        autoApplied: link.autoApplied,
        options: link.group.options
          .filter((option) => option.active)
          .slice()
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((option) => ({
            id: option.id,
            name: option.name,
            description: option.description ?? undefined,
            image: option.image ?? undefined,
            priceDelta: toNumber(option.priceDelta),
            active: option.active,
            available: option.available,
            soldOut: option.soldOut,
            sortOrder: option.sortOrder,
          })),
      })),
  }
}

export function mapOptionGroup(group: Prisma.ProductOptionGroupGetPayload<{
  include: {
    options: true
    categoryLinks: true
    productLinks: true
  }
}>) {
  return {
    id: group.id,
    name: group.name,
    description: group.description ?? undefined,
    sortOrder: group.sortOrder,
    options: group.options
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
      .map((option) => ({
        id: option.id,
        name: option.name,
        description: option.description ?? undefined,
        image: option.image ?? undefined,
        priceDelta: toNumber(option.priceDelta),
        active: option.active,
        available: option.available,
        soldOut: option.soldOut,
        sortOrder: option.sortOrder,
      })),
    categoryLinks: group.categoryLinks.map((link) => ({
      categoryId: link.categoryId,
      required: link.required,
      minSelections: link.minSelections,
      maxSelections: link.maxSelections,
      sortOrder: link.sortOrder,
      description: link.description ?? undefined,
      autoApply: link.autoApply,
    })),
    productLinks: group.productLinks.map((link) => ({
      productId: link.productId,
      required: link.required,
      minSelections: link.minSelections,
      maxSelections: link.maxSelections,
      sortOrder: link.sortOrder,
      description: link.description ?? undefined,
      autoApplied: link.autoApplied,
    })),
  }
}

export function mapPromotion(promotion: {
  id: string
  name: string
  description: string | null
  type: 'percent' | 'fixed' | 'combo'
  discountValue: Prisma.Decimal | null
  status: 'active' | 'inactive' | 'scheduled' | 'expired'
  startsAt: Date | null
  endsAt: Date | null
  channels: Array<'dine_in' | 'delivery' | 'digital_menu' | 'counter'>
  productIds: string[]
  categoryIds: string[]
  rules: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: promotion.id,
    name: promotion.name,
    description: promotion.description ?? undefined,
    type: promotion.type,
    discountValue: promotion.discountValue ? toNumber(promotion.discountValue) : undefined,
    status: promotion.status,
    startsAt: promotion.startsAt?.toISOString(),
    endsAt: promotion.endsAt?.toISOString(),
    channels: promotion.channels,
    productIds: promotion.productIds,
    categoryIds: promotion.categoryIds,
    rules:
      promotion.rules && typeof promotion.rules === 'object' && !Array.isArray(promotion.rules)
        ? promotion.rules
        : undefined,
    createdAt: promotion.createdAt.toISOString(),
    updatedAt: promotion.updatedAt.toISOString(),
  }
}

export function mapCoupon(coupon: {
  id: string
  code: string
  description: string | null
  type: 'percent' | 'fixed'
  value: Prisma.Decimal
  minOrderAmount: Prisma.Decimal
  maxUses: number | null
  uses: number
  status: 'active' | 'inactive' | 'scheduled' | 'expired'
  validFrom: Date | null
  validUntil: Date | null
  channels: Array<'dine_in' | 'delivery' | 'digital_menu' | 'counter'>
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description ?? undefined,
    type: coupon.type,
    value: toNumber(coupon.value),
    minOrderAmount: toNumber(coupon.minOrderAmount),
    maxUses: coupon.maxUses ?? undefined,
    uses: coupon.uses,
    status: coupon.status,
    validFrom: coupon.validFrom?.toISOString(),
    validUntil: coupon.validUntil?.toISOString(),
    channels: coupon.channels,
    createdAt: coupon.createdAt.toISOString(),
    updatedAt: coupon.updatedAt.toISOString(),
  }
}
