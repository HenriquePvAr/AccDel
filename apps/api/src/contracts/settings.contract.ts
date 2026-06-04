import { z } from 'zod'

export const updateOperationalSettingsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  tradeName: z.string().trim().min(2).max(120).optional(),
  logoUrl: z.string().trim().url().max(500).nullable().optional(),
  phone: z.string().trim().max(32).nullable().optional(),
  publicWhatsapp: z.string().trim().max(32).nullable().optional(),
  addressLine: z.string().trim().max(240).nullable().optional(),
  city: z.string().trim().min(2).max(80).optional(),
  state: z.string().trim().min(2).max(40).optional(),
  neighborhood: z.string().trim().max(120).nullable().optional(),
  businessHours: z.string().trim().max(500).nullable().optional(),
  businessDays: z.array(z.string().trim().min(2).max(20)).max(7).optional(),
  greetingMessage: z.string().trim().max(500).nullable().optional(),
  outOfHoursMessage: z.string().trim().max(500).nullable().optional(),
  cancellationPolicy: z.string().trim().max(1000).nullable().optional(),
  generalNotes: z.string().trim().max(1000).nullable().optional(),
  defaultDeliveryFee: z.number().min(0).max(999).optional(),
  minimumOrderAmount: z.number().min(0).max(9999).optional(),
  deliveryEnabled: z.boolean().optional(),
  pickupEnabled: z.boolean().optional(),
  counterEnabled: z.boolean().optional(),
  dineInEnabled: z.boolean().optional(),
  digitalMenuEnabled: z.boolean().optional(),
  whatsappAiEnabled: z.boolean().optional(),
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

export const saveDeliveryZoneSchema = z.object({
  id: z.string().uuid().optional(),
  neighborhood: z.string().trim().min(2).max(120),
  fee: z.number().min(0).max(999),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  estimatedDeliveryTimeMinutes: z.number().int().positive().max(360).nullable().optional(),
})

export type UpdateOperationalSettingsPayload = z.infer<
  typeof updateOperationalSettingsSchema
>
export type SavePaymentMethodConfigPayload = z.infer<typeof savePaymentMethodConfigSchema>
export type SaveDeliveryZonePayload = z.infer<typeof saveDeliveryZoneSchema>
