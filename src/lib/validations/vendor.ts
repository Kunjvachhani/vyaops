import { z } from 'zod'
import { indianPhoneSchema, paiseAmountSchema, uuidSchema } from './common'

const gstinSchema = z
  .string()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN')

export const createVendorSchema = z.object({
  name: z.string().min(1).max(200),
  company_name: z.string().max(200).optional(),
  phone: indianPhoneSchema.optional(),
  email: z.string().email().max(255).optional(),
  gstin: gstinSchema.optional(),
  address: z.string().max(500).optional(),
  materials_supplied: z.array(z.string().min(1).max(100)).max(50).optional(),
  payment_terms_days: z.number().int().min(0).max(365).default(30),
  rating: z.number().min(0).max(5).optional(),
  notes: z.string().max(1000).optional(),
})

export const updateVendorSchema = createVendorSchema
  .omit({ payment_terms_days: true })
  .partial()
  .extend({
    payment_terms_days: z.number().int().min(0).max(365).optional(),
    version: z.number().int().min(1),
  })

// DB CHECK (after migration 20260623000002) allows these statuses:
const PO_STATUSES = [
  'draft',
  'sent',
  'acknowledged',
  'in_transit',
  'received',
  'partially_received',
  'cancelled',
  'paid',
] as const

export const createPurchaseOrderSchema = z.object({
  material_name: z.string().min(1).max(200),
  quantity: z.number().positive(),
  unit: z.string().min(1).max(50).default('tons'),
  unit_price_paise: paiseAmountSchema.optional(),
  expected_date: z.string().date().optional(),
  triggered_by_order_id: uuidSchema.optional(),
  notes: z.string().max(1000).optional(),
})

export const updatePurchaseOrderSchema = z.object({
  version: z.number().int().min(1),
  status: z.enum(PO_STATUSES).optional(),
  received_quantity: z.number().min(0).optional(),
  received_date: z.string().date().optional(),
  quality_status: z.enum(['pending', 'approved', 'rejected']).optional(),
  expected_date: z.string().date().optional(),
  unit_price_paise: paiseAmountSchema.optional(),
  notes: z.string().max(1000).optional(),
})

export type CreateVendorInput = z.infer<typeof createVendorSchema>
export type UpdateVendorInput = z.infer<typeof updateVendorSchema>
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>
export type UpdatePurchaseOrderInput = z.infer<typeof updatePurchaseOrderSchema>
