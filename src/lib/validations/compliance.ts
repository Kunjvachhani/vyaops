import { z } from 'zod'

export const COMPLIANCE_CATEGORIES = [
  'gst', 'tds', 'pf', 'esi', 'factory', 'pollution', 'fire', 'electrical', 'custom',
] as const

export const COMPLIANCE_FREQUENCIES = [
  'monthly', 'quarterly', 'annual', 'biannual',
] as const

export const COMPLIANCE_STATUSES = [
  'pending', 'in_progress', 'completed', 'overdue', 'na',
] as const

export type ComplianceCategory = (typeof COMPLIANCE_CATEGORIES)[number]
export type ComplianceFrequency = (typeof COMPLIANCE_FREQUENCIES)[number]
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number]

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')

export const createComplianceTaskSchema = z.object({
  task_name: z.string().min(1, 'Task name is required').max(200),
  category: z.enum(COMPLIANCE_CATEGORIES),
  frequency: z.enum(COMPLIANCE_FREQUENCIES),
  due_date: dateString,
  notes: z.string().max(500).optional(),
})

export const updateComplianceTaskSchema = z.object({
  task_name: z.string().min(1).max(200).optional(),
  category: z.enum(COMPLIANCE_CATEGORIES).optional(),
  frequency: z.enum(COMPLIANCE_FREQUENCIES).optional(),
  due_date: dateString.optional(),
  status: z.enum(COMPLIANCE_STATUSES).optional(),
  completed_date: dateString.nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

export type CreateComplianceTask = z.infer<typeof createComplianceTaskSchema>
export type UpdateComplianceTask = z.infer<typeof updateComplianceTaskSchema>
