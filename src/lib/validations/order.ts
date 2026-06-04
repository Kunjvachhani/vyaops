import { z } from 'zod'
import { uuidSchema, paiseAmountSchema } from './common'

export const createOrderSchema = z.object({
  organizationId: uuidSchema,
  customerId: uuidSchema,
  items: z
    .array(
      z.object({
        productId: uuidSchema,
        quantity: z.number().int().positive(),
        unitPricePaise: paiseAmountSchema,
      })
    )
    .min(1),
  notes: z.string().max(1000).optional(),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
