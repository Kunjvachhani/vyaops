// GST computation for Indian tax invoices.
// All monetary values are integers in PAISE. Rounding follows the rule:
// total tax = round(subtotal * rate / 100); for intrastate the total is split
// CGST/SGST so the two halves always sum back to the total (no rounding drift).

export type GstBreakdown = {
  /** true when supply is within the same state (CGST + SGST), false for IGST. */
  intrastate: boolean
  /** effective GST percentage applied (e.g. 18). */
  taxRate: number
  /** CGST amount in paise (0 for interstate). */
  cgstPaise: number
  /** SGST amount in paise (0 for interstate). */
  sgstPaise: number
  /** IGST amount in paise (0 for intrastate). */
  igstPaise: number
  /** total tax in paise (cgst + sgst, or igst). */
  totalTaxPaise: number
}

/**
 * Extracts the 2-digit state code from a GSTIN.
 * GSTIN format: first 2 chars = numeric state code (e.g. "24" = Gujarat).
 * Returns null if the GSTIN is missing or malformed.
 */
export function gstinStateCode(gstin: string | null | undefined): string | null {
  if (!gstin) return null
  const code = gstin.trim().slice(0, 2)
  return /^[0-9]{2}$/.test(code) ? code : null
}

/**
 * Determines whether a supply is intrastate (CGST + SGST) or interstate (IGST).
 *
 * Rule: compare the supplier (org) state code with the customer state code.
 *  - Same state code           → intrastate.
 *  - Different state codes      → interstate.
 *  - Customer GSTIN missing/    → treated as intrastate (unregistered local buyer;
 *    unparseable                  CGST + SGST is the safe default for a Gujarat MSME).
 *  - Supplier GSTIN missing     → intrastate (cannot prove interstate).
 */
export function isIntrastate(
  orgGstin: string | null | undefined,
  customerGstin: string | null | undefined
): boolean {
  const orgCode = gstinStateCode(orgGstin)
  const customerCode = gstinStateCode(customerGstin)
  if (!orgCode || !customerCode) return true
  return orgCode === customerCode
}

/**
 * Computes the GST breakdown for an invoice.
 *
 * @param subtotalPaise taxable value in paise (integer).
 * @param taxRate       total GST percentage (e.g. 18).
 * @param intrastate    true → split CGST/SGST; false → single IGST line.
 */
export function computeGst(
  subtotalPaise: number,
  taxRate: number,
  intrastate: boolean
): GstBreakdown {
  const totalTaxPaise = Math.round((subtotalPaise * taxRate) / 100)

  if (intrastate) {
    const cgstPaise = Math.round(totalTaxPaise / 2)
    const sgstPaise = totalTaxPaise - cgstPaise // remainder keeps the sum exact
    return {
      intrastate: true,
      taxRate,
      cgstPaise,
      sgstPaise,
      igstPaise: 0,
      totalTaxPaise,
    }
  }

  return {
    intrastate: false,
    taxRate,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: totalTaxPaise,
    totalTaxPaise,
  }
}
