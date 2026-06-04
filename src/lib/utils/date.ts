const IST_TZ = 'Asia/Kolkata'

export function toIST(utcDate: Date): Date {
  return new Date(utcDate.toLocaleString('en-US', { timeZone: IST_TZ }))
}

export function formatIST(date: Date): string {
  return date.toLocaleString('en-IN', {
    timeZone: IST_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatISTDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    timeZone: IST_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
