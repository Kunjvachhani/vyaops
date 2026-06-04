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
