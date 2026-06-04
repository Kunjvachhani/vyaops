import { z } from 'zod'

export const uuidSchema = z.string().uuid()

export const paiseAmountSchema = z
  .number()
  .int('Amount must be in paise (integer)')
  .nonnegative('Amount cannot be negative')

export const indianPhoneSchema = z
  .string()
  .regex(/^(\+91)?[6-9]\d{9}$/, 'Invalid Indian phone number')

export const orgIdSchema = uuidSchema

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
})

export type Pagination = z.infer<typeof paginationSchema>
