import { z } from 'zod'

export const waiterStatusSchema = z.enum(['available', 'serving', 'paused'])

export const saveWaiterSchema = z.object({
  waiter: z.object({
    id: z.string().optional(),
    name: z.string().min(2),
    email: z.string().trim().email(),
    phone: z.string().min(8),
    active: z.boolean().default(true),
    status: waiterStatusSchema.default('available'),
  }),
})

export const updateWaiterStatusSchema = z.object({
  active: z.boolean(),
  status: waiterStatusSchema.optional(),
})

export type SaveWaiterPayload = z.infer<typeof saveWaiterSchema>
export type UpdateWaiterStatusPayload = z.infer<typeof updateWaiterStatusSchema>
