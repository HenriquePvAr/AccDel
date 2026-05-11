import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
})

export type LoginPayload = z.infer<typeof loginSchema>
