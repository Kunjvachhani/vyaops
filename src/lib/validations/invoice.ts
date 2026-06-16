import { z } from 'zod'
import { uuidSchema, paiseAmountSchema } from './common'

// Statuses persisted in the DB. 'overdue' is NOT stored — it is derived at read
// time (due_date < today AND status is unpaid). The DB CHECK still permits it,
// but the application never writes it.
export const INVOICE_STATUSES = [
  'draft',
  'sent',
  'paid',
  'partially_paid',
  'overdue',
  'cancelled',
] as const

export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

// Statuses an owner may set manually via PATCH. paid / partially_paid are reached
// only by recording a payment, never by a direct status edit.
export const MANUAL_INVOICE_STATUSES = ['draft', 'sent', 'cancelled'] as const
export type ManualInvoiceStatus = (typeof MANUAL_INVOICE_STATUSES)[number]

// Forward-only manual transitions. Payment recording handles paid/partially_paid.
export const INVOICE_STATUS_TRANSITIONS: Readonly<
  Record<ManualInvoiceStatus, readonly ManualInvoiceStatus[]>
> = {
  draft: ['sent', 'cancelled'],
  sent: ['cancelled'],
  cancelled: [],
} as const

export const PAYMENT_METHODS = ['upi', 'bank_transfer', 'cash', 'cheque'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

// GST rates permitted on an invoice (standard Indian slabs).
const taxRateSchema = z
  .number()
  .min(0, 'Tax rate cannot be negative')
  .max(28, 'Tax rate cannot exceed 28%')

// POST /api/invoices — create an invoice from a completed order.
// subtotalPaise is optional: when omitted the order's total is used; when given
// it overrides (owner adjusted the amount before saving).
export const createInvoiceSchema = z.object({
  orderId: uuidSchema,
  taxRate: taxRateSchema.default(18),
  dueDate: z.string().date(),
  subtotalPaise: paiseAmountSchema.pipe(z.number().int().positive()).optional(),
  notes: z.string().max(1000).optional(),
})

// A single payment recorded against an invoice.
export const recordPaymentSchema = z.object({
  amountPaise: paiseAmountSchema.pipe(z.number().int().positive()),
  paymentDate: z.string().date(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
})

// PATCH /api/invoices/[id] — either a manual status/notes edit OR a payment record.
// updated_at drives optimistic locking, mirroring the orders PATCH contract.
export const updateInvoiceSchema = z
  .object({
    updated_at: z.string().datetime({
      offset: true,
      message: 'updated_at is required for optimistic locking',
    }),
    status: z.enum(MANUAL_INVOICE_STATUSES).optional(),
    notes: z.string().max(1000).nullish(),
    payment: recordPaymentSchema.optional(),
  })
  .refine((v) => v.status !== undefined || v.notes !== undefined || v.payment !== undefined, {
    message: 'At least one of status, notes, or payment must be provided',
  })
  .refine((v) => !(v.payment !== undefined && v.status !== undefined), {
    message: 'Cannot change status and record a payment in the same request',
  })

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>
