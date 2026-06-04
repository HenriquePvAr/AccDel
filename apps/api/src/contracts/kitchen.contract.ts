import { z } from 'zod'

import { optionalBooleanQuerySchema } from './common'
import { orderChannelSchema } from './orders.contract'

export const kitchenQueueQuerySchema = z.object({
  channel: z.union([orderChannelSchema, z.literal('all')]).optional(),
  urgentOnly: optionalBooleanQuerySchema,
  priorityOnly: optionalBooleanQuerySchema,
})

export const markKitchenOrderReadySchema = z.object({
  actor: z.string().optional(),
})

export const moveKitchenOrderSchema = z.object({
  action: z.enum(['accept', 'start_preparation', 'ready', 'dispatch', 'complete']),
  actor: z.string().optional(),
  driverId: z.string().optional(),
})

export type KitchenQueueQuery = z.infer<typeof kitchenQueueQuerySchema>
export type MarkKitchenOrderReadyPayload = z.infer<typeof markKitchenOrderReadySchema>
export type MoveKitchenOrderPayload = z.infer<typeof moveKitchenOrderSchema>
