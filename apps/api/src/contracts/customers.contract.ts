import { z } from 'zod'

import { paginationQuerySchema } from './common'

export const listCustomersQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().optional(),
  search: z.string().trim().optional(),
  phone: z.string().trim().optional(),
})

const customerAddressSchema = z.object({
  label: z.string().trim().min(1).max(80).default('Principal'),
  street: z.string().trim().min(1).max(160),
  number: z.string().trim().min(1).max(24),
  district: z.string().trim().min(1).max(80),
  complement: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().min(2).max(2),
  reference: z.string().trim().max(160).optional(),
})

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(32),
  notes: z.string().trim().max(500).optional(),
  address: customerAddressSchema.optional(),
})

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().min(8).max(32).optional(),
  notes: z.string().trim().max(500).optional(),
  address: customerAddressSchema.optional(),
})

export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>
export type CreateCustomerPayload = z.infer<typeof createCustomerSchema>
export type UpdateCustomerPayload = z.infer<typeof updateCustomerSchema>

export type CustomerSegment = 'new' | 'recurring' | 'vip' | 'inactive'
