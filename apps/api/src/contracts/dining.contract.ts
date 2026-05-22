import { z } from 'zod'

export const diningTableStatusSchema = z.enum([
  'free',
  'occupied',
  'reserved',
  'closing',
  'closed',
])

export const tableSessionStatusSchema = z.enum(['open', 'awaiting_close', 'closed'])

export const paymentMethodSchema = z.enum([
  'pix',
  'credit_card',
  'debit_card',
  'cash',
  'meal_voucher',
  'payment_link',
])

export const saveDiningTableSchema = z.object({
  table: z.object({
    id: z.string().optional(),
    code: z.string().trim().min(1),
    areaId: z.string().trim().min(1),
    capacity: z.number().int().min(1).max(20),
    status: diningTableStatusSchema.optional(),
    notes: z.string().trim().max(280).optional(),
  }),
})

export const updateDiningTableStatusSchema = z.object({
  status: diningTableStatusSchema,
})

export const openTableSessionSchema = z.object({
  guestCount: z.number().int().min(1).max(20),
  waiterId: z.string().optional(),
  notes: z.string().trim().max(280).optional(),
})

export const addTableSessionItemSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.number().int().min(1).max(20),
  notes: z.string().trim().max(280).optional(),
  waiterId: z.string().optional(),
  options: z
    .array(
      z.object({
        groupId: z.string().trim().min(1),
        optionId: z.string().trim().min(1),
        quantity: z.number().int().positive().default(1),
      }),
    )
    .optional(),
})

export const addTableSessionItemsSchema = z.object({
  items: z.array(addTableSessionItemSchema).min(1).max(30),
})

export const updateTableSessionSchema = z.object({
  waiterId: z.string().nullable().optional(),
  guestCount: z.number().int().min(1).max(20).optional(),
  notes: z.string().trim().max(280).optional(),
  status: z.enum(['open', 'awaiting_close']).optional(),
})

export const closeTableSessionSchema = z.object({
  paymentMethod: paymentMethodSchema,
  discount: z.number().min(0).max(99999).optional(),
  serviceFee: z.number().min(0).max(99999).optional(),
  actor: z.string().trim().max(120).optional(),
})

export const transferTableSessionSchema = z.object({
  targetTableId: z.string().trim().min(1),
  actor: z.string().trim().max(120).optional(),
})

export const splitTableSessionSchema = z.object({
  itemIds: z.array(z.string().trim().min(1)).min(1),
  paymentMethod: paymentMethodSchema,
  actor: z.string().trim().max(120).optional(),
})

export type SaveDiningTablePayload = z.infer<typeof saveDiningTableSchema>
export type UpdateDiningTableStatusPayload = z.infer<typeof updateDiningTableStatusSchema>
export type OpenTableSessionPayload = z.infer<typeof openTableSessionSchema>
export type AddTableSessionItemPayload = z.infer<typeof addTableSessionItemSchema>
export type AddTableSessionItemsPayload = z.infer<typeof addTableSessionItemsSchema>
export type UpdateTableSessionPayload = z.infer<typeof updateTableSessionSchema>
export type CloseTableSessionPayload = z.infer<typeof closeTableSessionSchema>
export type TransferTableSessionPayload = z.infer<typeof transferTableSessionSchema>
export type SplitTableSessionPayload = z.infer<typeof splitTableSessionSchema>
