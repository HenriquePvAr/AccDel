import { z } from 'zod'

const entityIdSchema = z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/)
const versionSchema = z.number().int().positive().max(2_147_483_647)

const waiterOptionSelectionSchema = z.object({
  groupId: entityIdSchema,
  optionId: entityIdSchema,
  quantity: z.number().int().positive().max(20).default(1),
})

export const waiterOpenSessionSchema = z.object({
  guestCount: z.number().int().min(1).max(20),
  expectedTableVersion: versionSchema,
})

export const waiterSendItemsSchema = z.object({
  expectedVersion: versionSchema,
  items: z
    .array(
      z.object({
        productId: entityIdSchema,
        quantity: z.number().int().min(1).max(20),
        notes: z.string().trim().max(280).optional(),
        options: z.array(waiterOptionSelectionSchema).max(40).default([]),
      }),
    )
    .min(1)
    .max(30),
})

export const waiterExpectedVersionSchema = z.object({
  expectedVersion: versionSchema,
})

export const waiterCancelItemSchema = waiterExpectedVersionSchema.extend({
  reason: z.string().trim().min(3).max(180),
})

export const waiterTransferSessionSchema = waiterExpectedVersionSchema.extend({
  targetTableId: entityIdSchema,
  expectedTargetTableVersion: versionSchema,
})

export type WaiterOpenSessionPayload = z.infer<typeof waiterOpenSessionSchema>
export type WaiterSendItemsPayload = z.infer<typeof waiterSendItemsSchema>
export type WaiterExpectedVersionPayload = z.infer<typeof waiterExpectedVersionSchema>
export type WaiterCancelItemPayload = z.infer<typeof waiterCancelItemSchema>
export type WaiterTransferSessionPayload = z.infer<typeof waiterTransferSessionSchema>
