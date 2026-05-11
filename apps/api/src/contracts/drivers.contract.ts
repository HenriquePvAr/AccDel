import { z } from 'zod'

export const driverAvailabilitySchema = z.enum(['available', 'delivering', 'paused'])
export const driverLocationSourceSchema = z.enum([
  'gps',
  'app',
  'admin',
  'simulator',
  'fallback',
])

export const saveDriverSchema = z.object({
  driver: z.object({
    id: z.string().optional(),
    name: z.string().min(2),
    email: z.string().trim().email(),
    phone: z.string().min(8),
    vehicle: z.string().min(2),
    active: z.boolean().default(true),
    availability: driverAvailabilitySchema.default('available'),
  }),
})

export const saveDriverLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speedKmh: z.number().min(0).max(220).optional(),
  heading: z.number().min(0).max(360).optional(),
  accuracyMeters: z.number().min(0).max(10000).optional(),
  capturedAt: z.string().datetime().optional(),
  source: driverLocationSourceSchema.default('gps'),
  status: driverAvailabilitySchema.optional(),
  currentOrderId: z.string().optional(),
  currentAssignmentId: z.string().optional(),
})

export const simulateDriverLocationSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  speedKmh: z.number().min(0).max(220).optional(),
})

export const updateDriverAvailabilitySchema = z.object({
  availability: driverAvailabilitySchema,
})

export const updateDriverQueueSchema = z.object({
  orderIds: z.array(z.string()).min(1),
})

export const previewDriverRouteSchema = z.object({
  previewOrderId: z.string().optional(),
  insertionSequence: z.number().int().min(1).optional(),
  proposedOrderIds: z.array(z.string()).optional(),
})

export type SaveDriverPayload = z.infer<typeof saveDriverSchema>
export type SaveDriverLocationPayload = z.infer<typeof saveDriverLocationSchema>
export type SimulateDriverLocationPayload = z.infer<typeof simulateDriverLocationSchema>
export type UpdateDriverAvailabilityPayload = z.infer<
  typeof updateDriverAvailabilitySchema
>
export type UpdateDriverQueuePayload = z.infer<typeof updateDriverQueueSchema>
export type PreviewDriverRoutePayload = z.infer<typeof previewDriverRouteSchema>
