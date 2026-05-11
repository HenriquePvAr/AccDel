import { z } from 'zod'

export const reportsPeriodSchema = z.enum(['today', '7d', '30d'])
export const reportsChannelSchema = z.enum([
  'delivery',
  'dine_in',
  'counter',
  'pickup',
  'digital_menu',
  'whatsapp',
  'all',
])
export const reportsStatusSchema = z.enum([
  'in_analysis',
  'in_preparation',
  'ready',
  'out_for_delivery',
  'completed',
  'cancelled',
  'all',
])

export const operationalReportsQuerySchema = z.object({
  period: reportsPeriodSchema.optional(),
  channel: reportsChannelSchema.optional(),
  status: reportsStatusSchema.optional(),
})

export type OperationalReportsQuery = z.infer<typeof operationalReportsQuerySchema>
