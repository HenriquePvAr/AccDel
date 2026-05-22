import { z } from 'zod'

import { optionalBooleanQuerySchema, paginationQuerySchema } from './common'

export const orderChannelSchema = z.enum([
  'delivery',
  'dine_in',
  'counter',
  'pickup',
  'digital_menu',
  'whatsapp',
])

export const orderStatusSchema = z.enum([
  'in_analysis',
  'in_preparation',
  'ready',
  'out_for_delivery',
  'completed',
  'cancelled',
])

export const paymentMethodSchema = z.enum([
  'pix',
  'credit_card',
  'debit_card',
  'cash',
  'meal_voucher',
  'payment_link',
])

export const listOrdersQuerySchema = paginationQuerySchema.extend({
  search: z.string().optional(),
  source: z.union([orderChannelSchema, z.literal('all')]).optional(),
  status: z.union([orderStatusSchema, z.literal('all')]).optional(),
  paymentMethod: z.union([paymentMethodSchema, z.literal('all')]).optional(),
  delayedOnly: optionalBooleanQuerySchema,
})

export const createOrderSchema = z.object({
  channel: orderChannelSchema,
  customerId: z.string().nullable().optional(),
  addressId: z.string().nullable().optional(),
  tableId: z.string().nullable().optional(),
  paymentMethod: paymentMethodSchema,
  couponCode: z.string().trim().min(2).optional(),
  notes: z.string().optional(),
  sendToProduction: z.boolean().default(false),
  items: z
    .array(
      z.object({
        productId: z.string(),
        quantity: z.number().int().positive(),
        notes: z.string().trim().max(280).optional(),
        options: z
          .array(
            z.object({
              groupId: z.string().trim().min(1),
              optionId: z.string().trim().min(1),
              quantity: z.number().int().positive().default(1),
            }),
          )
          .optional(),
      }),
    )
    .min(1),
})

export const updateOrderStatusSchema = z.object({
  action: z.enum(['accept', 'start_preparation', 'ready', 'dispatch', 'complete', 'cancel']),
  actor: z.string().optional(),
  driverId: z.string().optional(),
})

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>
export type CreateOrderPayload = z.infer<typeof createOrderSchema>
export type UpdateOrderStatusPayload = z.infer<typeof updateOrderStatusSchema>
