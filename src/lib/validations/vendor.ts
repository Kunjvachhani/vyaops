import { z } from 'zod'
import { uuidSchema, indianPhoneSchema } from './common'

export const createVendorSchema = z.object({
  organizationId: uuidSchema,
  name: z.string().min(1).max(200),
  phone: indianPhoneSchema.optional(),
  gstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .optional(),
  materialCategory: z.string().max(100).optional(),
})

export type CreateVendorInput = z.infer<typeof createVendorSchema>
