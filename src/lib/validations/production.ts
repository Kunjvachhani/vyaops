import { z } from 'zod'
import { uuidSchema } from './common'

export const logProductionSchema = z.object({
  organizationId: uuidSchema,
  productId: uuidSchema,
  quantityProduced: z.number().int().positive(),
  quantityRejected: z.number().int().nonnegative(),
  operatorId: uuidSchema.optional(),
  notes: z.string().max(1000).optional(),
})

export type LogProductionInput = z.infer<typeof logProductionSchema>
