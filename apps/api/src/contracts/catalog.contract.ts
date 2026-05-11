import { z } from 'zod'

import { optionalBooleanQuerySchema, paginationQuerySchema } from './common'

export const productChannelSchema = z.enum(['dine_in', 'delivery', 'digital_menu', 'counter'])

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
    availability: z.array(availabilitySchema).optional(),
  }),
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

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>
export type SaveProductPayload = z.infer<typeof saveProductSchema>
export type SoldOutPayload = z.infer<typeof soldOutSchema>
export type ChannelAvailabilityPayload = z.infer<typeof channelAvailabilitySchema>
