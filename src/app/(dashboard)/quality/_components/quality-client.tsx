'use client'

import { useTranslations } from 'next-intl'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  BarChart,
  Bar,
  Cell,
  ResponsiveContainer,
} from 'recharts'
import { TrendingDown, TrendingUp, Package2, Star, Factory, IndianRupee } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { paiseToCurrency } from '@/lib/utils/currency'

export interface QualityData {
  thisMonthRate: number
  lastMonthRate: number
  thisMonthProduced: number
  bestProduct: { name: string; rate: number } | null
  savedPaise: number
  trendData: Array<{ date: string; rate: number }>
  defectData: Array<{ type: string; count: number; percentage: number }>
  productData: Array<{ name: string; produced: number; rejected: number; rate: number }>
}

const DEFECT_LABELS: Record<string, string> = {
  sand_holes: 'Sand Holes',
  dimensional: 'Dimensional',
  porosity: 'Porosity',
  shrinkage: 'Shrinkage',
  cold_shut: 'Cold Shut',
  surface_defect: 'Surface Defect',
  other: 'Other',
}

const PARETO_COLORS = ['#ef4444', '#f97316', '#eab308', '#94a3b8']
const TARGET_RATE = 5

type TooltipProps = {
  active?: boolean
  payload?: Array<{ value: number; payload: { label: string; count: number; percentage: number } }>
  label?: string
}

function TrendTooltipContent({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded border bg-background p-2 text-xs shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-red-500">{payload[0].value}% rejection</p>
    </div>
  )
}

function ParetoTooltipContent({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded border bg-background p-2 text-xs shadow-md">
      <p className="font-medium">{d.label}</p>
      <p>
        {d.count} pcs ({d.percentage}%)
      </p>
    </div>
  )
}

export function QualityClient({ data }: { data: QualityData }) {
  const t = useTranslations('pages.quality')

  const rateDelta = data.lastMonthRate > 0 ? data.thisMonthRate - data.lastMonthRate : null
  const improved = rateDelta !== null && rateDelta < 0
  const worsened = rateDelta !== null && rateDelta > 0

  const paretoChartData = data.defectData.map((d) => ({
    ...d,
    label: DEFECT_LABELS[d.type] ?? d.type,
  }))

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{t('metrics.rejectionRate')}</p>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-3xl font-bold">
              {data.thisMonthProduced > 0 ? `${data.thisMonthRate}%` : '—'}
            </p>
            {rateDelta !== null ? (
              <p
                className={cn(
                  'mt-1 flex items-center gap-1 text-xs',
                  improved ? 'text-green-600' : worsened ? 'text-red-600' : 'text-muted-foreground'
                )}
              >
                {improved ? (
                  <TrendingDown className="h-3 w-3" />
                ) : worsened ? (
                  <TrendingUp className="h-3 w-3" />
                ) : null}
                {Math.abs(rateDelta).toFixed(1)}% {t('metrics.vsLastMonth')}
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{t('metrics.thisMonth')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{t('metrics.rsSaved')}</p>
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-3xl font-bold text-green-600">
              {data.savedPaise > 0 ? paiseToCurrency(data.savedPaise) : '—'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t('metrics.savingsDesc')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{t('metrics.totalProduced')}</p>
              <Package2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-3xl font-bold">
              {data.thisMonthProduced.toLocaleString('en-IN')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t('metrics.thisMonth')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{t('metrics.bestProduct')}</p>
              <Star className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-xl font-bold truncate">
              {data.bestProduct?.name ?? '—'}
            </p>
            {data.bestProduct && (
              <p className="mt-1 text-xs text-green-600">
                {data.bestProduct.rate}% {t('metrics.lowestRejection')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Rejection Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('trend.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.trendData.every((d) => d.rate === 0) ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{t('noData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={data.trendData} margin={{ top: 4, right: 40, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    interval={6}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: number) => `${v}%`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<TrendTooltipContent />} />
                  <ReferenceLine
                    y={TARGET_RATE}
                    stroke="#94a3b8"
                    strokeDasharray="5 5"
                    label={{
                      value: t('trend.targetLabel'),
                      position: 'right',
                      fontSize: 10,
                      fill: '#94a3b8',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    name={t('trend.rateLabel')}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Defect Pareto */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('pareto.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {paretoChartData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">{t('pareto.noData')}</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={paretoChartData}
                  layout="vertical"
                  margin={{ top: 4, right: 32, left: 4, bottom: 16 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    label={{
                      value: t('pareto.countLabel'),
                      position: 'insideBottom',
                      offset: -8,
                      fontSize: 10,
                      fill: 'hsl(var(--muted-foreground))',
                    }}
                  />
                  <YAxis
                    type="category"
                    dataKey="label"
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    width={85}
                  />
                  <Tooltip content={<ParetoTooltipContent />} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {paretoChartData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={PARETO_COLORS[Math.min(i, PARETO_COLORS.length - 1)]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Product Rejection Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('productTable.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.productData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('productTable.noData')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('productTable.product')}</TableHead>
                  <TableHead className="text-right">{t('productTable.produced')}</TableHead>
                  <TableHead className="text-right">{t('productTable.rejected')}</TableHead>
                  <TableHead className="text-right">{t('productTable.rate')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.productData.map((p, i) => (
                  <TableRow
                    key={i}
                    className={cn(p.rate > TARGET_RATE && 'bg-red-50 dark:bg-red-950/20')}
                  >
                    <TableCell className="font-medium">
                      {p.name}
                      {p.rate > TARGET_RATE && (
                        <Badge variant="destructive" className="ml-2 text-xs">
                          {t('productTable.highRisk')}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.produced.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.rejected.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-medium',
                        p.rate > TARGET_RATE ? 'text-red-600' : 'text-green-600'
                      )}
                    >
                      {p.rate}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Savings Explanation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('savings.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.lastMonthRate === 0 && data.thisMonthRate === 0 ? (
            <p className="text-sm text-muted-foreground">{t('savings.noData')}</p>
          ) : data.savedPaise > 0 ? (
            <>
              <p className="text-sm text-muted-foreground">
                {t('savings.improved', {
                  prev: data.lastMonthRate.toFixed(1),
                  curr: data.thisMonthRate.toFixed(1),
                })}
              </p>
              <p className="rounded bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
                {t('savings.formula', {
                  prev: data.lastMonthRate.toFixed(1),
                  curr: data.thisMonthRate.toFixed(1),
                  produced: data.thisMonthProduced.toLocaleString('en-IN'),
                })}
              </p>
              <p className="text-lg font-bold text-green-600">
                {t('savings.amount', { amount: paiseToCurrency(data.savedPaise) })}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('savings.noImprovement')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
