import { z } from 'zod'

import { optionalBooleanQuerySchema, paginationQuerySchema } from './common'

export const productChannelSchema = z.enum(['dine_in', 'delivery', 'digital_menu', 'counter'])
export const commercialStatusSchema = z.enum(['active', 'inactive', 'scheduled', 'expired'])

const availabilitySchema = z.object({
  channel: productChannelSchema,
  available: z.boolean(),
  visible: z.boolean(),
  soldOut: z.boolean(),
  priceOverride: z.number().nullable().optional(),
})

export const listProductsQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  categoryId: z.union([z.string(), z.literal('all')]).optional(),
  status: z.enum(['all', 'active', 'inactive']).optional(),
  channel: z.union([productChannelSchema, z.literal('all')]).optional(),
  activeOnly: optionalBooleanQuerySchema,
})

export const catalogMenuSourceQuerySchema = z.object({
  channel: productChannelSchema.default('digital_menu'),
  includeUnavailable: optionalBooleanQuerySchema,
})

export const saveProductSchema = z.object({
  product: z.object({
    id: z.string().optional(),
    categoryId: z.string(),
    name: z.string().min(2),
    description: z.string().min(2),
    price: z.number().nonnegative(),
    image: z.string().url().or(z.string().min(1)),
    featured: z.boolean().default(false),
    active: z.boolean().default(true),
    preparationStation: z.string().min(1),
    tags: z.array(z.string()).default([]),
    sortOrder: z.number().int().nonnegative().default(0),
    availability: z.array(availabilitySchema).optional(),
  }),
})

export const saveCategorySchema = z.object({
  category: z.object({
    id: z.string().optional(),
    name: z.string().min(2),
    description: z.string().default(''),
    active: z.boolean().default(true),
    icon: z.string().nullable().optional(),
    color: z.string().nullable().optional(),
    visibleOnPos: z.boolean().default(true),
    visibleOnDigitalMenu: z.boolean().default(true),
    sortOrder: z.number().int().nonnegative().default(0),
  }),
})

export const reorderCategorySchema = z.object({
  sortOrder: z.number().int().nonnegative(),
})

export const soldOutSchema = z.object({
  channel: productChannelSchema.default('delivery'),
})

export const channelAvailabilitySchema = z.object({
  channel: productChannelSchema,
  available: z.boolean().optional(),
  visible: z.boolean().optional(),
  soldOut: z.boolean().optional(),
})

export const categorySoldOutSchema = z.object({
  channels: z.array(productChannelSchema).min(1),
  soldOut: z.boolean(),
})

const optionSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2),
  description: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
  priceDelta: z.number().default(0),
  active: z.boolean().default(true),
  available: z.boolean().default(true),
  soldOut: z.boolean().default(false),
  sortOrder: z.number().int().nonnegative().default(0),
})

export const saveOptionGroupSchema = z.object({
  group: z.object({
    id: z.string().optional(),
    name: z.string().trim().min(2),
    description: z.string().nullable().optional(),
    sortOrder: z.number().int().nonnegative().default(0),
    options: z.array(optionSchema).default([]),
  }),
})

export const optionAvailabilitySchema = z.object({
  active: z.boolean().optional(),
  available: z.boolean().optional(),
  soldOut: z.boolean().optional(),
})

export const applyOptionGroupToCategorySchema = z.object({
  categoryId: z.string().trim().min(1),
  required: z.boolean().default(false),
  minSelections: z.number().int().nonnegative().default(0),
  maxSelections: z.number().int().positive().default(1),
  sortOrder: z.number().int().nonnegative().default(0),
  description: z.string().nullable().optional(),
})

export const productOptionGroupLinkSchema = z.object({
  enabled: z.boolean(),
  required: z.boolean().default(false),
  minSelections: z.number().int().nonnegative().default(0),
  maxSelections: z.number().int().positive().default(1),
  sortOrder: z.number().int().nonnegative().default(0),
  description: z.string().nullable().optional(),
})

export const promotionRuleSchema = z.object({
  requiredItems: z.number().int().positive().default(1),
  participantType: z.enum(['category', 'product']).default('category'),
  participantId: z.string().optional(),
  sizeLabel: z.string().optional(),
  flavorLimitPerItem: z.number().int().nonnegative().optional(),
  finalPrice: z.number().nonnegative().optional(),
  notes: z.string().optional(),
})

export const savePromotionSchema = z.object({
  promotion: z.object({
    id: z.string().optional(),
    name: z.string().min(2),
    description: z.string().nullable().optional(),
    type: z.enum(['percent', 'fixed', 'combo']),
    discountValue: z.number().nonnegative().nullable().optional(),
    status: commercialStatusSchema.default('inactive'),
    startsAt: z.string().nullable().optional(),
    endsAt: z.string().nullable().optional(),
    channels: z.array(productChannelSchema).default([]),
    productIds: z.array(z.string()).default([]),
    categoryIds: z.array(z.string()).default([]),
    rules: promotionRuleSchema.nullable().optional(),
  }),
})

export const listCommercialQuerySchema = paginationQuerySchema.extend({
  status: z.union([commercialStatusSchema, z.literal('all')]).optional(),
  search: z.string().optional(),
})

export const saveCouponSchema = z.object({
  coupon: z.object({
    id: z.string().optional(),
    code: z.string().min(2),
    description: z.string().nullable().optional(),
    type: z.enum(['percent', 'fixed']),
    value: z.number().positive(),
    minOrderAmount: z.number().nonnegative().default(0),
    maxUses: z.number().int().positive().nullable().optional(),
    uses: z.number().int().nonnegative().default(0),
    status: commercialStatusSchema.default('inactive'),
    validFrom: z.string().nullable().optional(),
    validUntil: z.string().nullable().optional(),
    channels: z.array(productChannelSchema).default([]),
  }),
})

export const validateCouponSchema = z.object({
  code: z.string().min(2),
  orderTotal: z.number().nonnegative(),
  channel: productChannelSchema,
})

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>
export type CatalogMenuSourceQuery = z.infer<typeof catalogMenuSourceQuerySchema>
export type SaveProductPayload = z.infer<typeof saveProductSchema>
export type SaveCategoryPayload = z.infer<typeof saveCategorySchema>
export type ReorderCategoryPayload = z.infer<typeof reorderCategorySchema>
export type SoldOutPayload = z.infer<typeof soldOutSchema>
export type ChannelAvailabilityPayload = z.infer<typeof channelAvailabilitySchema>
export type CategorySoldOutPayload = z.infer<typeof categorySoldOutSchema>
export type SaveOptionGroupPayload = z.infer<typeof saveOptionGroupSchema>
export type OptionAvailabilityPayload = z.infer<typeof optionAvailabilitySchema>
export type ApplyOptionGroupToCategoryPayload = z.infer<typeof applyOptionGroupToCategorySchema>
export type ProductOptionGroupLinkPayload = z.infer<typeof productOptionGroupLinkSchema>
export type PromotionRulePayload = z.infer<typeof promotionRuleSchema>
export type SavePromotionPayload = z.infer<typeof savePromotionSchema>
export type ListCommercialQuery = z.infer<typeof listCommercialQuerySchema>
export type SaveCouponPayload = z.infer<typeof saveCouponSchema>
export type ValidateCouponPayload = z.infer<typeof validateCouponSchema>
