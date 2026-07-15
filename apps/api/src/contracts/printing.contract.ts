import { z } from 'zod'

import { paginationQuerySchema } from './common'

const idSchema = z.string().trim().min(1).max(128)
const safeNameSchema = z.string().trim().min(2).max(120)
const stationCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(32)
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Use apenas letras, numeros e underscore.')
  .transform((value) => value.toUpperCase())

export const printConnectionTypeSchema = z.enum([
  'NETWORK_TCP',
  'WINDOWS_PRINTER',
  'FILE_OR_VIRTUAL',
])

export const printJobStatusSchema = z.enum([
  'PENDING',
  'CLAIMED',
  'PRINTING',
  'PRINTED',
  'RETRY_WAIT',
  'FAILED',
  'CANCELLED',
  'PRINT_RESULT_UNKNOWN',
])

export const printJobTypeSchema = z.enum([
  'ORDER_INITIAL',
  'ORDER_ADDITION',
  'ORDER_REMOVAL',
  'ORDER_CORRECTION',
  'ORDER_CANCELLATION',
  'CASHIER_RECEIPT',
  'DISPATCH_ORDER',
  'CUSTOMER_RECEIPT',
  'TEST_PAGE',
  'REPRINT',
])

export const savePrinterStationSchema = z.object({
  code: stationCodeSchema,
  name: safeNameSchema,
  enabled: z.boolean().default(true),
})

export const savePrinterSchema = z
  .object({
    name: safeNameSchema,
    stationId: idSchema,
    agentId: idSchema.nullable().optional(),
    connectionType: printConnectionTypeSchema,
    address: z.string().trim().min(1).max(255),
    port: z.number().int().min(1).max(65535).nullable().optional(),
    paperWidth: z.union([z.literal(58), z.literal(80)]),
    encoding: z.enum(['CP860', 'CP850', 'ASCII']).default('CP860'),
    enabled: z.boolean().default(true),
    isDefault: z.boolean().default(false),
  })
  .superRefine((value, context) => {
    if (value.connectionType === 'NETWORK_TCP' && !value.port) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['port'],
        message: 'Informe a porta da impressora de rede.',
      })
    }

    if (value.connectionType !== 'NETWORK_TCP' && value.port != null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['port'],
        message: 'Porta e permitida apenas para conexao TCP.',
      })
    }
  })

export const updatePrintingSettingsSchema = z.object({
  enabled: z.boolean(),
  fallbackPolicy: z.enum(['DEFAULT_STATION', 'BLOCK']),
  fallbackStationId: idSchema.nullable(),
  printOrderReady: z.boolean(),
  printPaymentConfirmed: z.boolean(),
  printCancellation: z.boolean(),
  customerReceiptEnabled: z.boolean(),
  defaultMaxAttempts: z.number().int().min(1).max(20),
  leaseDurationSeconds: z.number().int().min(15).max(300),
})

export const savePrinterRoutingRuleSchema = z
  .object({
    scope: z.enum(['PRODUCT', 'CATEGORY']),
    productId: idSchema.nullable().optional(),
    categoryId: idSchema.nullable().optional(),
    stationId: idSchema,
    priority: z.number().int().min(-100).max(100).default(0),
    enabled: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    const validProduct = value.scope === 'PRODUCT' && value.productId && !value.categoryId
    const validCategory = value.scope === 'CATEGORY' && value.categoryId && !value.productId

    if (!validProduct && !validCategory) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A regra deve apontar para exatamente um produto ou categoria.',
      })
    }
  })

export const listPrintJobsQuerySchema = paginationQuerySchema.extend({
  status: z.union([printJobStatusSchema, z.literal('all')]).optional(),
  type: z.union([printJobTypeSchema, z.literal('all')]).optional(),
  stationId: idSchema.optional(),
  printerId: idSchema.optional(),
  orderId: idSchema.optional(),
})

export const printReasonSchema = z.object({
  reason: z.string().trim().min(5).max(240),
})

export const provisionPrintAgentSchema = z.object({
  name: safeNameSchema,
  deviceName: safeNameSchema,
})

export const printAgentHeartbeatSchema = z.object({
  version: z.string().trim().min(1).max(40),
  availablePrinterIds: z.array(idSchema).max(100).default([]),
})

export const printAgentClaimSchema = z.object({
  limit: z.number().int().min(1).max(20).default(1),
  availablePrinterIds: z.array(idSchema).max(100).default([]),
})

const leaseTokenSchema = z.string().trim().min(32).max(256)

export const printAgentStartedSchema = z.object({
  leaseToken: leaseTokenSchema,
})

export const printAgentSuccessSchema = z.object({
  leaseToken: leaseTokenSchema,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  durationMs: z.number().int().min(0).max(3_600_000),
})

export const printAgentFailureSchema = z.object({
  leaseToken: leaseTokenSchema,
  retryable: z.boolean(),
  errorCode: z.string().trim().regex(/^[A-Z0-9_]{2,64}$/),
  errorMessage: z.string().trim().min(1).max(500),
  durationMs: z.number().int().min(0).max(3_600_000),
})

export const printAgentUnknownSchema = z.object({
  leaseToken: leaseTokenSchema,
  errorCode: z.string().trim().regex(/^[A-Z0-9_]{2,64}$/),
  errorMessage: z.string().trim().min(1).max(500),
})

export type SavePrinterStationPayload = z.infer<typeof savePrinterStationSchema>
export type SavePrinterPayload = z.infer<typeof savePrinterSchema>
export type UpdatePrintingSettingsPayload = z.infer<typeof updatePrintingSettingsSchema>
export type SavePrinterRoutingRulePayload = z.infer<typeof savePrinterRoutingRuleSchema>
export type ListPrintJobsQuery = z.infer<typeof listPrintJobsQuerySchema>
export type PrintReasonPayload = z.infer<typeof printReasonSchema>
export type ProvisionPrintAgentPayload = z.infer<typeof provisionPrintAgentSchema>
export type PrintAgentHeartbeatPayload = z.infer<typeof printAgentHeartbeatSchema>
export type PrintAgentClaimPayload = z.infer<typeof printAgentClaimSchema>
export type PrintAgentStartedPayload = z.infer<typeof printAgentStartedSchema>
export type PrintAgentSuccessPayload = z.infer<typeof printAgentSuccessSchema>
export type PrintAgentFailurePayload = z.infer<typeof printAgentFailureSchema>
export type PrintAgentUnknownPayload = z.infer<typeof printAgentUnknownSchema>
