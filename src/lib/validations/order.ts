import { z } from 'zod'
import { uuidSchema, paiseAmountSchema } from './common'

export const ORDER_STATUSES = [
  'draft',
  'confirmed',
  'in_production',
  'completed',
  'dispatched',
  'cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

// Forward-only transitions; cancellation allowed from non-terminal states only.
export const STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['in_production', 'cancelled'],
  in_production: ['completed', 'cancelled'],
  completed: ['dispatched'],
  dispatched: [],
  cancelled: [],
} as const

export const createOrderSchema = z.object({
  customer_id: uuidSchema,
  product_id: uuidSchema,
  quantity: z.number().int().positive(),
  unit_price_paise: z.number().int().min(1, 'Price must be at least 1 paise'),
  delivery_date: z.string().date().optional(),
  notes: z.string().max(1000).optional(),
  status: z.enum(['draft', 'confirmed']).default('confirmed'),
})

export const updateOrderSchema = z
  .object({
    // updated_at required for optimistic locking — client sends back what it last received.
    updated_at: z.string().datetime({ offset: true, message: 'updated_at is required for optimistic locking' }),
    status: z.enum(ORDER_STATUSES).optional(),
    notes: z.string().max(1000).nullish(),
    quantity: z.number().int().positive().optional(),
    unit_price_paise: paiseAmountSchema.pipe(z.number().min(1)).optional(),
    delivery_date: z.string().date().nullish(),
  })
  .refine(
    (v) => {
      // If quantity or unit_price_paise is being changed, both must be positive integers
      // (already enforced by schema; this guard is a belt-and-suspenders check)
      if (v.quantity !== undefined && v.quantity <= 0) return false
      if (v.unit_price_paise !== undefined && v.unit_price_paise <= 0) return false
      return true
    },
    { message: 'Quantities and amounts must be positive integers in paise' }
  )

export type CreateOrderInput = z.infer<typeof createOrderSchema>
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>
