import { z } from 'zod'
import { uuidSchema } from './common'

export const SHIFTS = ['shift_1', 'shift_2', 'shift_3'] as const
export type Shift = (typeof SHIFTS)[number]

export const createProductionBatchSchema = z
  .object({
    order_id: uuidSchema.optional(),
    product_id: uuidSchema.optional(),
    quantity_produced: z.number().int().positive(),
    quantity_rejected: z.number().int().nonnegative().default(0),
    defect_type: z.string().max(200).optional(),
    shift: z.enum(SHIFTS).optional(),
    notes: z.string().max(1000).optional(),
    source_message_id: z.string().max(500).optional(),
  })
  .refine((d) => d.order_id !== undefined || d.product_id !== undefined, {
    message: 'Either order_id or product_id must be provided',
  })

export type CreateProductionBatchInput = z.infer<typeof createProductionBatchSchema>
