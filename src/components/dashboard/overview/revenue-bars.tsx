'use client'

import * as React from 'react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { CHART_INK, ChartDeltaChip, ChartLegend } from '@/components/charts/chart-container'
import { CHART_CURSOR_BAND, ChartTooltip } from '@/components/charts/chart-tooltip'
import { Card, CardDescription, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card'
import { Segmented, type SegmentedOption } from '@/components/ui/segmented'
import {
  cn,
  formatCompactCurrency,
  formatCurrency,
  formatDateLong,
  formatDateShort,
  fromDateKey,
  percentChange,
  sum,
} from '@/lib/utils'
import type { CurrencyCode, TimeSeriesPoint } from '@/types'

/* ==========================================================================
   RevenueBars — this period against the last, day by day.

   Two thin pill bars per day: the current period in the revenue colour and
   the same day of the previous period in a hatched grey, so "are we ahead?"
   is answered by which bar is taller, not by reading two numbers. The
   single best day carries a direct label; everything else is in the tooltip.
   ========================================================================== */

type WindowSize = '7' | '14'

const WINDOW_OPTIONS: SegmentedOption<WindowSize>[] = [
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days' },
]

const CURRENT = 'var(--series-revenue)'
const HATCH_ID = 'ezra-hatch-previous'

interface PeakLabelProps {
  x?: number
  y?: number
  width?: number
  value?: number
  index?: number
  peakIndex: number
  currency: CurrencyCode
}

/** A dark pill above the tallest bar — the one number worth labelling. */
function PeakLabel({ x = 0, y = 0, width = 0, value = 0, index, peakIndex, currency }: PeakLabelProps) {
  if (index !== peakIndex) return null
  const label = formatCompactCurrency(value, currency)
  const w = label.length * 6.6 + 14
  const cx = x + width / 2
  return (
    <g transform={`translate(${cx - w / 2}, ${y - 28})`} aria-hidden="true">
      <rect width={w} height={20} rx={10} fill="var(--fg)" />
      <text x={w / 2} y={13.5} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--bg)">
        {label}
      </text>
      <path d={`M${w / 2 - 4},20 L${w / 2},24 L${w / 2 + 4},20 Z`} fill="var(--fg)" />
    </g>
  )
}

export interface RevenueBarsProps {
  points: TimeSeriesPoint[]
  currency: CurrencyCode
  className?: string
}

export function RevenueBars({ points, currency, className }: RevenueBarsProps) {
  const reduced = useReducedMotionSafe()
  const [windowSize, setWindowSize] = React.useState<WindowSize>('14')
  const days = Number(windowSize)

  const data = React.useMemo(() => points.slice(-days), [points, days])
  const totals = React.useMemo(() => {
    const current = sum(data.map((p) => p.revenue))
    const previous = sum(data.map((p) => p.prevRevenue))
    return { current, previous, delta: percentChange(current, previous) }
  }, [data])
  const peakIndex = React.useMemo(
    () => data.reduce((best, p, i) => (p.revenue > (data[best]?.revenue ?? -1) ? i : best), 0),
    [data],
  )

  const rangeLabel =
    data.length > 0
      ? `${formatDateShort(fromDateKey(data[0].date))} – ${formatDateShort(fromDateKey(data[data.length - 1].date))}`
      : ''

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Revenue vs previous period</CardTitle>
          <CardDescription>
            <span className="font-semibold text-foreground tabular-nums">
              {formatCurrency(totals.current, currency)}
            </span>{' '}
            over the last {days} days ·{' '}
            <ChartDeltaChip value={totals.delta} size="xs" bare className="align-middle" /> against{' '}
            {formatCurrency(totals.previous, currency)}
          </CardDescription>
        </div>
        <CardToolbar>
          <Segmented
            size="sm"
            label="Window"
            options={WINDOW_OPTIONS}
            value={windowSize}
            onValueChange={setWindowSize}
          />
        </CardToolbar>
      </CardHeader>

      <div className="px-5 pb-2 sm:px-6">
        <ChartLegend
          items={[
            { key: 'revenue', label: 'This period', color: CURRENT, shape: 'square' },
            { key: 'prevRevenue', label: 'Previous period', color: 'var(--fg-faint)', shape: 'square' },
          ]}
          hidden={[]}
          onToggle={() => undefined}
        />
      </div>

      <div className="min-h-[280px] flex-1 px-2 pb-4" role="img" aria-label={`Daily revenue for ${rangeLabel} against the previous period.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 32, right: 8, bottom: 0, left: 0 }} barCategoryGap="24%" barGap={3}>
            <defs>
              <pattern id={HATCH_ID} patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
                <rect width="5" height="5" fill="var(--surface-sunken)" />
                <line x1="0" y1="0" x2="0" y2="5" stroke="var(--fg-faint)" strokeWidth="1.5" />
              </pattern>
            </defs>
            <CartesianGrid vertical={false} stroke={CHART_INK.grid} strokeWidth={1} />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tickMargin={10}
              interval="preserveStartEnd"
              minTickGap={22}
              tick={{ fill: CHART_INK.tick, fontSize: 11 }}
              tickFormatter={(value: string) => formatDateShort(fromDateKey(value))}
            />
            <YAxis
              width={48}
              axisLine={false}
              tickLine={false}
              tickCount={5}
              tick={{ fill: CHART_INK.tick, fontSize: 11 }}
              tickFormatter={(value: number) => formatCompactCurrency(value, currency)}
            />
            <Tooltip
              cursor={CHART_CURSOR_BAND}
              isAnimationActive={false}
              content={
                <ChartTooltip
                  formatLabel={(label) => formatDateLong(fromDateKey(String(label)))}
                  formatValue={(value) => formatCurrency(value, currency)}
                  formatName={(entry) => (entry.dataKey === 'prevRevenue' ? 'Previous period' : 'This period')}
                  delta={(datum) => ({
                    value: percentChange(Number(datum.revenue ?? 0), Number(datum.prevRevenue ?? 0)),
                    label: 'vs same day last period',
                  })}
                />
              }
            />
            <Bar
              dataKey="prevRevenue"
              name="Previous period"
              fill={`url(#${HATCH_ID})`}
              stroke="var(--border-strong)"
              strokeWidth={1}
              radius={6}
              maxBarSize={14}
              isAnimationActive={!reduced}
              animationDuration={700}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="revenue"
              name="This period"
              fill={CURRENT}
              radius={6}
              maxBarSize={14}
              isAnimationActive={!reduced}
              animationDuration={800}
              animationBegin={120}
              animationEasing="ease-out"
            >
              <LabelList
                dataKey="revenue"
                content={(props) => <PeakLabel {...(props as PeakLabelProps)} peakIndex={peakIndex} currency={currency} />}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
