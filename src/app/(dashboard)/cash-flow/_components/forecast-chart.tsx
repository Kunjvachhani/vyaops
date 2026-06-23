'use client'

import { useTranslations } from 'next-intl'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'

interface ForecastPoint {
  date: string
  inflow_paise: number
  outflow_paise: number
  net_paise: number
}

interface ForecastTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function paiseToRupees(paise: number): number {
  return paise / 100
}

function formatRupees(paise: number): string {
  const rupees = paiseToRupees(paise)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rupees)
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
}

function ForecastTooltip({ active, payload, label }: ForecastTooltipProps) {
  const t = useTranslations('pages.cashFlow.forecast')
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md text-sm space-y-1">
      <p className="font-semibold text-foreground">{label ? formatDateLabel(label) : ''}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name === 'inflow_paise' ? t('inflow') : entry.name === 'outflow_paise' ? t('outflow') : t('net')}:{' '}
          {formatRupees(entry.value)}
        </p>
      ))}
    </div>
  )
}

function YAxisTickFormatter(value: number): string {
  const rupees = value / 100
  if (Math.abs(rupees) >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`
  if (Math.abs(rupees) >= 1000) return `₹${(rupees / 1000).toFixed(0)}K`
  return `₹${rupees}`
}

// Only show every 5th date label so x-axis doesn't crowd
function XAxisTickFormatter(_value: string, index: number): string {
  if (index % 5 !== 0) return ''
  return formatDateLabel(_value)
}

export function ForecastChart({ data }: { data: ForecastPoint[] }) {
  const t = useTranslations('pages.cashFlow.forecast')

  const hasData = data.some((d) => d.inflow_paise > 0 || d.outflow_paise > 0)

  if (!hasData) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{t('noData')}</p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
          <XAxis
            dataKey="date"
            tickFormatter={XAxisTickFormatter}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={YAxisTickFormatter}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<ForecastTooltip />} />
          <Legend
            formatter={(value) =>
              value === 'inflow_paise' ? t('inflow') : value === 'outflow_paise' ? t('outflow') : t('net')
            }
            iconType="square"
            iconSize={10}
            wrapperStyle={{ fontSize: 12 }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--border))" />
          <Bar dataKey="inflow_paise" name="inflow_paise" fill="hsl(142 76% 36%)" radius={[2, 2, 0, 0]} maxBarSize={24} />
          <Bar dataKey="outflow_paise" name="outflow_paise" fill="hsl(0 84% 60%)" radius={[2, 2, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
