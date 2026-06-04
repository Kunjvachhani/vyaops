import { z } from 'zod'
import { uuidSchema } from './common'

export const createInvoiceSchema = z.object({
  organizationId: uuidSchema,
  orderId: uuidSchema,
  dueDate: z.string().datetime(),
  notes: z.string().max(1000).optional(),
})

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>
