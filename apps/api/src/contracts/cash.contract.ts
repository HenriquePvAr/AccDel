import { z } from 'zod'

const optionalTextSchema = z.string().trim().max(500).optional()
const requiredReasonSchema = z.string().trim().min(2).max(500)

export const openCashRegisterSchema = z.object({
  terminalId: z.string().trim().min(1).max(120).optional(),
  openingAmount: z.number().nonnegative().default(0),
  note: optionalTextSchema,
})

export const registerCashMovementSchema = z.object({
  type: z.enum([
    'sale',
    'withdrawal',
    'supply',
    'adjustment',
    'refund',
    'CASH_SUPPLY',
    'CASH_WITHDRAWAL',
    'CASH_ADJUSTMENT',
    'CASH_REFUND',
  ]),
  amount: z.number().positive(),
  label: z.string().trim().min(2).max(160),
  reason: requiredReasonSchema.optional(),
  originalMovementId: z.string().trim().min(1).max(120).optional(),
})

export const closeCashRegisterSchema = z.object({
  countedAmount: z.number().nonnegative(),
  note: optionalTextSchema,
  differenceReason: optionalTextSchema,
})

export const supplyCashRegisterSchema = z.object({
  amount: z.number().positive(),
  reason: requiredReasonSchema,
})

export const withdrawCashRegisterSchema = z.object({
  amount: z.number().positive(),
  reason: requiredReasonSchema,
  approvedByUserId: z.string().trim().min(1).max(120).optional(),
})

export const adjustCashMovementSchema = z.object({
  originalMovementId: z.string().trim().min(1).max(120),
  amount: z.number().positive(),
  direction: z.enum(['increase', 'decrease']),
  reason: requiredReasonSchema,
})

export const cashRegisterHistoryQuerySchema = z.object({
  status: z.enum(['open', 'closing', 'closed', 'all']).optional(),
  terminalId: z.string().trim().min(1).max(120).optional(),
  operatorId: z.string().trim().min(1).max(120).optional(),
  from: z.string().trim().min(1).max(40).optional(),
  to: z.string().trim().min(1).max(40).optional(),
})

export type OpenCashRegisterPayload = z.infer<typeof openCashRegisterSchema>
export type RegisterCashMovementPayload = z.infer<typeof registerCashMovementSchema>
export type CloseCashRegisterPayload = z.infer<typeof closeCashRegisterSchema>
export type SupplyCashRegisterPayload = z.infer<typeof supplyCashRegisterSchema>
export type WithdrawCashRegisterPayload = z.infer<typeof withdrawCashRegisterSchema>
export type AdjustCashMovementPayload = z.infer<typeof adjustCashMovementSchema>
export type CashRegisterHistoryQuery = z.infer<typeof cashRegisterHistoryQuerySchema>
