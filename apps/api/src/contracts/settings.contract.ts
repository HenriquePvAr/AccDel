import { z } from 'zod'

export const updateOperationalSettingsSchema = z.object({
  autoAcceptEnabled: z.boolean().optional(),
  estimatedPrepTimeMinutes: z.number().int().positive().max(240).optional(),
  estimatedDeliveryTimeMinutes: z.number().int().positive().max(360).optional(),
  estimatedDineInTimeMinutes: z.number().int().positive().max(240).optional(),
  estimatedCounterTimeMinutes: z.number().int().positive().max(180).optional(),
  estimatedPickupTimeMinutes: z.number().int().positive().max(180).optional(),
})

export type UpdateOperationalSettingsPayload = z.infer<
  typeof updateOperationalSettingsSchema
>
