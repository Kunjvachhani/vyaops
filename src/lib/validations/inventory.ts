import { z } from 'zod'
import { uuidSchema } from './common'

export const ADJUSTMENT_REASONS = [
  'vendor_receipt',
  'damaged',
  'physical_count',
  'return',
  'other',
] as const
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number]

export const manualAdjustmentSchema = z.object({
  change_quantity: z
    .number()
    .refine((v) => v !== 0, { message: 'change_quantity cannot be zero' }),
  reason: z.enum(ADJUSTMENT_REASONS),
})
export type ManualAdjustmentInput = z.infer<typeof manualAdjustmentSchema>

export const bulkAdjustmentSchema = z.object({
  adjustments: z
    .array(
      z.object({
        inventory_id: uuidSchema,
        change_quantity: z
          .number()
          .refine((v) => v !== 0, { message: 'change_quantity cannot be zero' }),
        reason: z.enum(ADJUSTMENT_REASONS),
      })
    )
    .min(1)
    .max(50),
})
export type BulkAdjustmentInput = z.infer<typeof bulkAdjustmentSchema>
