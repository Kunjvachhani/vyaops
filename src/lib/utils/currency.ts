const PAISE_PER_RUPEE = 100

export function paiseToCurrency(paise: number): string {
  const rupees = paise / PAISE_PER_RUPEE
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(rupees)
}

export function rupeeStringToPaise(value: string): number {
  const numeric = parseFloat(value.replace(/[^0-9.]/g, ''))
  if (isNaN(numeric)) throw new Error(`Invalid rupee value: ${value}`)
  return Math.round(numeric * PAISE_PER_RUPEE)
}

/**
 * Formats paise as a fixed 2-decimal Indian-grouped amount with the ₹ symbol,
 * e.g. 15000000 → "₹1,50,000.00". Used on invoices where decimals are mandatory.
 */
export function paiseToInvoiceAmount(paise: number): string {
  const rupees = paise / PAISE_PER_RUPEE
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees)
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
]
const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
]

// Converts a number below 1000 into words.
function belowThousandToWords(n: number): string {
  const parts: string[] = []
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`)
    n %= 100
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)])
    n %= 10
  }
  if (n > 0) parts.push(ONES[n])
  return parts.join(' ')
}

// Converts an integer into Indian-system words (Crore / Lakh / Thousand).
function integerToIndianWords(num: number): string {
  if (num === 0) return 'Zero'
  const groups: { value: number; label: string }[] = [
    { value: Math.floor(num / 10000000), label: 'Crore' },
    { value: Math.floor((num % 10000000) / 100000), label: 'Lakh' },
    { value: Math.floor((num % 100000) / 1000), label: 'Thousand' },
    { value: num % 1000, label: '' },
  ]
  const words = groups
    .filter((g) => g.value > 0)
    .map((g) => `${belowThousandToWords(g.value)}${g.label ? ` ${g.label}` : ''}`)
  return words.join(' ').trim()
}

/**
 * Converts paise into an Indian-English amount-in-words string for invoices,
 * e.g. 15000000 → "Rupees One Lakh Fifty Thousand Only".
 * Includes paise when present: "... and Fifty Paise Only".
 */
export function paiseToWords(paise: number): string {
  const rupees = Math.floor(paise / PAISE_PER_RUPEE)
  const remainder = paise % PAISE_PER_RUPEE
  const rupeeWords = `Rupees ${integerToIndianWords(rupees)}`
  if (remainder > 0) {
    return `${rupeeWords} and ${integerToIndianWords(remainder)} Paise Only`
  }
  return `${rupeeWords} Only`
}
