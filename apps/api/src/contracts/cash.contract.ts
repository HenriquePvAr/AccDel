import { z } from 'zod'

export const openCashRegisterSchema = z.object({
  openingAmount: z.number().nonnegative().default(0),
})

export const registerCashMovementSchema = z.object({
  type: z.enum(['sale', 'withdrawal', 'supply', 'adjustment', 'refund']),
  amount: z.number().positive(),
  label: z.string().min(2),
})

export const closeCashRegisterSchema = z.object({
  countedAmount: z.number().nonnegative().optional(),
})

export type OpenCashRegisterPayload = z.infer<typeof openCashRegisterSchema>
export type RegisterCashMovementPayload = z.infer<typeof registerCashMovementSchema>
export type CloseCashRegisterPayload = z.infer<typeof closeCashRegisterSchema>
