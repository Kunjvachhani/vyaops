/**
 * Normalize a phone number to a bare digit string without country code prefix
 * ambiguity. Strips +, spaces, dashes, and standardizes Indian numbers:
 *   +91 9876543210 → 919876543210
 *   91-9876543210  → 919876543210
 *   09876543210    → 919876543210  (leading 0 → assume India)
 *   9876543210     → 919876543210  (10 digits → assume India)
 *
 * Use this for ALL phone comparisons in the codebase.
 */
export function normalizePhone(raw: string): string {
  // Strip everything except digits
  let digits = raw.replace(/\D/g, '')

  // Leading zero (local Indian format) → prepend 91
  if (digits.startsWith('0') && digits.length === 11) {
    digits = '91' + digits.slice(1)
  }

  // Bare 10-digit Indian number → prepend 91
  if (digits.length === 10) {
    digits = '91' + digits
  }

  return digits
}

/**
 * Returns true when two phone strings refer to the same number
 * after normalization.
 */
export function phonesMatch(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b)
}
