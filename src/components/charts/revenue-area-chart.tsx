'use client'

/**
 * The headline trend chart. A flat-washed area for the selected metric, a dashed
 * prior-period line for context, and a period-average reference so an operator
 * can see at a glance which days beat their own baseline.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  average,
  formatCompactCurrency,
  formatCurrency,
  formatDateLong,
  formatDateShort,
  formatDelta,
  formatNumber,
  formatPercent,
  fromDateKey,
  percentChange,
  sum,
} from '@/lib/utils'
import { seriesVar } from '@/lib/metric-colors'
import type { CurrencyCode, TimeSeriesPoint } from '@/types'
import { CHART_INK, ChartContainer, ChartLegend, type ChartLegendItem } from './chart-container'
import { CHART_CURSOR_LINE, ChartTooltip } from './chart-tooltip'

export type RevenueMetric = 'revenue' | 'bookings' | 'guests' | 'occupancy'

interface MetricConfig {
  label: string
  /** Formats a value for the tooltip and the data table. */
  format: (value: number, currency: CurrencyCode) => string
  /** Compact formatting for Y-axis ticks. */
  tick: (value: number, currency: CurrencyCode) => string
  /** Fixed axis domain, where the metric has natural bounds. */
  domain?: [number, number]
  /** Only revenue carries a prior-period series in the domain model. */
  comparable: boolean
}

const METRICS: Record<RevenueMetric, MetricConfig> = {
  revenue: {
    label: 'Revenue',
    format: (v, currency) => formatCurrency(v, currency),
    tick: (v, currency) => formatCompactCurrency(v, currency),
    comparable: true,
  },
  bookings: {
    label: 'Bookings',
    format: (v) => formatNumber(v),
    tick: (v) => formatNumber(v, { compact: true }),
    comparable: false,
  },
  guests: {
    label: 'Guests',
    format: (v) => formatNumber(v),
    tick: (v) => formatNumber(v, { compact: true }),
    comparable: false,
  },
  occupancy: {
    label: 'Occupancy',
    format: (v) => formatPercent(v, 1),
    tick: (v) => formatPercent(v),
    domain: [0, 100],
    comparable: false,
  },
}

const COMPARE_COLOR = 'var(--series-compare)'

export interface RevenueAreaChartProps {
  points: TimeSeriesPoint[]
  /** Which series is plotted. Defaults to revenue. */
  metric?: RevenueMetric
  currency?: CurrencyCode
  /** Dashed prior-period line. Ignored for metrics with no comparison series. */
  showComparison?: boolean
  /** Dashed horizontal rule at the period average. */
  showAverage?: boolean
  height?: number
  title?: string
  description?: string
  /** Range/metric switchers rendered in the card header. */
  toolbar?: ReactNode
  loading?: boolean
  /** Series colour. Defaults to the metric's own `--series-*` token. */
  color?: string
  className?: string
}

export function RevenueAreaChart({
  points,
  metric = 'revenue',
  currency = 'USD',
  showComparison = true,
  showAverage = true,
  height = 300,
  title,
  description,
  toolbar,
  loading = false,
  color,
  className,
}: RevenueAreaChartProps) {
  const reduced = useReducedMotionSafe()
  const SERIES_COLOR = color ?? seriesVar(metric)
  const [hidden, setHidden] = useState<string[]>([])

  const config = METRICS[metric]
  const comparing = showComparison && config.comparable
  const values = useMemo(() => points.map((p) => p[metric]), [points, metric])
  const periodAverage = useMemo(() => average(values), [values])

  const summary = useMemo(() => {
    if (points.length === 0) return ''
    const total = sum(values)
    const first = formatDateLong(fromDateKey(points[0].date))
    const last = formatDateLong(fromDateKey(points[points.length - 1].date))
    const totalLabel = metric === 'occupancy' ? formatPercent(periodAverage, 1) : config.format(total, currency)
    const change = comparing
      ? `, ${formatDelta(percentChange(total, sum(points.map((p) => p.prevRevenue))))} versus the previous period`
      : ''
    return `${config.label} by day from ${first} to ${last}. ${
      metric === 'occupancy' ? 'Average' : 'Total'
    } ${totalLabel}${change}.`
  }, [points, values, metric, config, currency, comparing, periodAverage])

  const legendItems: ChartLegendItem[] = useMemo(() => {
    const items: ChartLegendItem[] = [
      { key: metric, label: config.label, color: SERIES_COLOR, shape: 'line' },
    ]
    if (comparing) {
      items.push({ key: 'prevRevenue', label: 'Previous period', color: COMPARE_COLOR, shape: 'dashed' })
    }
    if (showAverage) {
      items.push({
        key: 'average',
        label: 'Period average',
        color: 'var(--fg-faint)',
        shape: 'dashed',
        value: config.format(periodAverage, currency),
      })
    }
    return items
  }, [metric, config, comparing, showAverage, periodAverage, currency])

  const isHidden = (key: string) => hidden.includes(key)

  return (
    <ChartContainer
      title={title ?? `${config.label} trend`}
      description={description}
      ariaLabel={summary}
      height={height}
      toolbar={toolbar}
      loading={loading}
      empty={points.length === 0}
      className={className}
      legend={<ChartLegend items={legendItems} hidden={hidden} onToggle={(_, next) => setHidden(next)} />}
      dataTable={
        <table>
          <caption>{summary}</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">{config.label}</th>
              {comparing ? <th scope="col">Previous period</th> : null}
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date}>
                <th scope="row">{formatDateLong(fromDateKey(point.date))}</th>
                <td>{config.format(point[metric], currency)}</td>
                {comparing ? <td>{formatCurrency(point.prevRevenue, currency)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
          {/* Horizontal rules only — vertical gridlines fight the crosshair. */}
          <CartesianGrid vertical={false} stroke={CHART_INK.grid} strokeWidth={1} />

          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => formatDateShort(fromDateKey(value))}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={28}
            tick={{ fill: CHART_INK.tick, fontSize: 12 }}
          />
          <YAxis
            width={58}
            tickCount={5}
            domain={config.domain}
            tickFormatter={(value: number) => config.tick(value, currency)}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={{ fill: CHART_INK.tick, fontSize: 12 }}
          />

          <Tooltip
            cursor={CHART_CURSOR_LINE}
            isAnimationActive={false}
            content={
              <ChartTooltip
                formatLabel={(label) => formatDateLong(fromDateKey(String(label)))}
                formatValue={(value) => config.format(value, currency)}
                dashedKeys={['prevRevenue']}
                delta={
                  comparing
                    ? (datum) => {
                        const current = Number(datum[metric] ?? 0)
                        const previous = Number(datum.prevRevenue ?? 0)
                        return { value: percentChange(current, previous), label: 'vs previous period' }
                      }
                    : undefined
                }
              />
            }
          />

          {showAverage && !isHidden('average') ? (
            <ReferenceLine
              y={periodAverage}
              stroke={CHART_INK.reference}
              strokeDasharray="5 5"
              strokeWidth={1}
              ifOverflow="extendDomain"
              label={{
                value: `Avg ${config.tick(periodAverage, currency)}`,
                position: 'insideTopRight',
                fill: CHART_INK.tick,
                fontSize: 12,
              }}
            />
          ) : null}

          <Area
            type="monotone"
            dataKey={metric}
            name={config.label}
            hide={isHidden(metric)}
            stroke={SERIES_COLOR}
            strokeWidth={2}
            fill={SERIES_COLOR}
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)', fill: SERIES_COLOR }}
            isAnimationActive={!reduced}
            animationDuration={760}
            animationEasing="cubic-bezier(0.16,1,0.3,1)"
          />

          {comparing ? (
            <Line
              type="monotone"
              dataKey="prevRevenue"
              name="Previous period"
              hide={isHidden('prevRevenue')}
              stroke={COMPARE_COLOR}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 3, strokeWidth: 2, stroke: 'var(--surface)', fill: COMPARE_COLOR }}
              isAnimationActive={!reduced}
              animationDuration={760}
              animationBegin={120}
              animationEasing="cubic-bezier(0.16,1,0.3,1)"
            />
          ) : null}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
