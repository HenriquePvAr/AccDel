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

export const createPublicOrderSchema = z
  .object({
    customerName: z.string().trim().min(2).max(120),
    customerPhone: z.string().trim().min(8).max(32),
    address: z.string().trim().max(180).optional(),
    neighborhood: z.string().trim().max(80).optional(),
    complement: z.string().trim().max(120).optional(),
    reference: z.string().trim().max(160).optional(),
    notes: z.string().trim().max(360).optional(),
    orderMode: z.enum(['delivery', 'pickup']),
    paymentMethodId: z.string().trim().min(1),
    items: z
      .array(
        z.object({
          productId: z.string().trim().min(1),
          quantity: z.number().int().positive().max(99),
          notes: z.string().trim().max(280).optional(),
          selectedOptions: z
            .array(
              z.object({
                groupId: z.string().trim().min(1),
                optionId: z.string().trim().min(1),
                quantity: z.number().int().positive().default(1),
              }),
            )
            .default([]),
        }),
      )
      .min(1),
  })
  .superRefine((payload, ctx) => {
    if (payload.orderMode !== 'delivery') {
      return
    }

    if (!payload.address?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['address'],
        message: 'Informe o endereco para delivery.',
      })
    }

    if (!payload.neighborhood?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['neighborhood'],
        message: 'Informe o bairro para delivery.',
      })
    }
  })

export const updateOrderStatusSchema = z.object({
  action: z.enum(['accept', 'start_preparation', 'ready', 'dispatch', 'complete', 'cancel']),
  driverId: z.string().optional(),
})

export const repeatOrderSchema = z.object({
  paymentMethod: paymentMethodSchema,
})

export const confirmOrderPaymentSchema = z
  .object({
    status: z.enum(['paid', 'failed', 'cancelled', 'refunded']),
    externalReference: z.string().trim().min(3).max(160).optional(),
    reason: z.string().trim().min(2).max(500).optional(),
  })
  .superRefine((value, context) => {
    if (value.status === 'refunded' && !value.reason) {
      context.addIssue({
        code: 'custom',
        path: ['reason'],
        message: 'Informe o motivo do reembolso.',
      })
    }
  })

export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>
export type CreateOrderPayload = z.infer<typeof createOrderSchema>
export type CreatePublicOrderPayload = z.infer<typeof createPublicOrderSchema>
export type UpdateOrderStatusPayload = z.infer<typeof updateOrderStatusSchema>
export type RepeatOrderPayload = z.infer<typeof repeatOrderSchema>
export type ConfirmOrderPaymentPayload = z.infer<typeof confirmOrderPaymentSchema>
