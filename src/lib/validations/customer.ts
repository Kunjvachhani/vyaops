import { z } from 'zod'
import { indianPhoneSchema, paiseAmountSchema } from './common'

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  company_name: z.string().max(255).optional(),
  phone: indianPhoneSchema.optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional().default('Gujarat'),
  gstin: z
    .string()
    .regex(GSTIN_REGEX, 'Invalid GSTIN format (e.g. 24AABCU9603R1ZX)')
    .optional()
    .or(z.literal('')),
  aliases: z.array(z.string().max(100)).max(20).optional().default([]),
  credit_limit_paise: paiseAmountSchema.optional().default(0),
  payment_terms_days: z
    .number()
    .int()
    .min(0, 'Must be 0 or more days')
    .max(365, 'Max 365 days')
    .optional()
    .default(30),
  notes: z.string().max(1000).optional(),
})

export const updateCustomerSchema = z.object({
  updated_at: z.string().datetime({ offset: true, message: 'updated_at required for optimistic locking' }),
  name: z.string().min(1).max(255).optional(),
  company_name: z.string().max(255).nullish(),
  phone: indianPhoneSchema.nullish(),
  email: z.string().email('Invalid email').nullish().or(z.literal('')),
  city: z.string().max(100).nullish(),
  state: z.string().max(100).optional(),
  gstin: z
    .string()
    .regex(GSTIN_REGEX, 'Invalid GSTIN format')
    .nullish()
    .or(z.literal('')),
  aliases: z.array(z.string().max(100)).max(20).optional(),
  credit_limit_paise: paiseAmountSchema.optional(),
  payment_terms_days: z.number().int().min(0).max(365).optional(),
  notes: z.string().max(1000).nullish(),
})

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
