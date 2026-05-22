import { z } from 'zod'

export const updateOperationalSettingsSchema = z.object({
  autoAcceptEnabled: z.boolean().optional(),
  estimatedPrepTimeMinutes: z.number().int().positive().max(240).optional(),
  estimatedDeliveryTimeMinutes: z.number().int().positive().max(360).optional(),
  estimatedDineInTimeMinutes: z.number().int().positive().max(240).optional(),
  estimatedCounterTimeMinutes: z.number().int().positive().max(180).optional(),
  estimatedPickupTimeMinutes: z.number().int().positive().max(180).optional(),
})

export const paymentProviderSchema = z.enum(['manual', 'pix', 'picpay'])

export const paymentMethodSchema = z.enum([
  'pix',
  'credit_card',
  'debit_card',
  'cash',
  'meal_voucher',
  'payment_link',
])

export const paymentChannelSchema = z.enum([
  'delivery',
  'counter',
  'dine_in',
  'digital_menu',
])

export const savePaymentMethodConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(80),
  method: paymentMethodSchema.nullable().optional(),
  provider: paymentProviderSchema,
  active: z.boolean(),
  fixed: z.boolean().optional(),
  requiresReceipt: z.boolean(),
  autoCashEntry: z.boolean(),
  channels: z.array(paymentChannelSchema).min(1),
  sortOrder: z.number().int().min(0).max(999),
  externalEnabled: z.boolean().optional(),
})

export type UpdateOperationalSettingsPayload = z.infer<
  typeof updateOperationalSettingsSchema
>
export type SavePaymentMethodConfigPayload = z.infer<typeof savePaymentMethodConfigSchema>
