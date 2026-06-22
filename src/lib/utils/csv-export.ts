const BOM = '﻿'

function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function buildCsvResponse(
  headers: string[],
  rows: string[][],
  filename: string
): Response {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','))
  const csv = BOM + lines.join('\r\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
