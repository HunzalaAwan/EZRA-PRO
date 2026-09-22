'use client'

/**
 * Bookings per day, with cancellations stacked on top so the gross/net gap is
 * visible without a second chart. Weekends carry most of the revenue in every
 * vertical we sell to, so weekend columns are emphasised — by fill weight *and*
 * a tick marker, never by colour alone.
 */

import { useMemo, useState, type ReactNode } from 'react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { XAxisTickContentProps } from 'recharts'
import {
  average,
  formatCurrency,
  formatDateLong,
  formatDateShort,
  formatNumber,
  formatPercent,
  fromDateKey,
  sum,
} from '@/lib/utils'
import type { CurrencyCode, TimeSeriesPoint } from '@/types'
import { CHART_INK, ChartContainer, ChartLegend, type ChartLegendItem } from './chart-container'
import { CHART_CURSOR_BAND, ChartTooltip } from './chart-tooltip'

const BOOKINGS_COLOR = 'var(--series-bookings)'
const CANCELLED_COLOR = 'var(--series-cancellations)'

/** Saturday or Sunday in local time — `fromDateKey` avoids the UTC shift. */
function isWeekendKey(dateKey: string): boolean {
  const day = fromDateKey(dateKey).getDay()
  return day === 0 || day === 6
}

interface BarPoint extends TimeSeriesPoint {
  weekend: boolean
}

/** Tick that flags weekends with a dot under the label as well as extra weight. */
function WeekendAwareTick({ x, y, payload }: XAxisTickContentProps) {
  const value = String(payload.value)
  const weekend = isWeekendKey(value)
  const cx = Number(x)
  const cy = Number(y)

  return (
    <g transform={`translate(${cx},${cy})`}>
      <text
        x={0}
        y={0}
        dy={14}
        textAnchor="middle"
        fill={weekend ? 'var(--fg-muted)' : CHART_INK.tick}
        fontSize={12}
        fontWeight={weekend ? 600 : 400}
      >
        {formatDateShort(fromDateKey(value))}
      </text>
      {weekend ? <circle cx={0} cy={22} r={1.75} fill={BOOKINGS_COLOR} /> : null}
    </g>
  )
}

export interface BookingsBarChartProps {
  points: TimeSeriesPoint[]
  height?: number
  title?: string
  description?: string
  currency?: CurrencyCode
  /** Range switchers rendered in the card header. */
  toolbar?: ReactNode
  loading?: boolean
  className?: string
}

export function BookingsBarChart({
  points,
  height = 300,
  title = 'Bookings per day',
  description,
  currency = 'USD',
  toolbar,
  loading = false,
  className,
}: BookingsBarChartProps) {
  const reduced = useReducedMotionSafe()
  const [hidden, setHidden] = useState<string[]>([])

  const data: BarPoint[] = useMemo(
    () => points.map((point) => ({ ...point, weekend: isWeekendKey(point.date) })),
    [points],
  )

  const stats = useMemo(() => {
    const weekend = data.filter((d) => d.weekend)
    const weekday = data.filter((d) => !d.weekend)
    return {
      bookings: sum(data.map((d) => d.bookings)),
      cancellations: sum(data.map((d) => d.cancellations)),
      weekendAvg: average(weekend.map((d) => d.bookings)),
      weekdayAvg: average(weekday.map((d) => d.bookings)),
    }
  }, [data])

  const summary = useMemo(() => {
    if (data.length === 0) return ''
    const first = formatDateLong(fromDateKey(data[0].date))
    const last = formatDateLong(fromDateKey(data[data.length - 1].date))
    const lift =
      stats.weekdayAvg > 0
        ? ` Weekends average ${formatNumber(stats.weekendAvg, { decimals: 1 })} bookings a day versus ${formatNumber(
            stats.weekdayAvg,
            { decimals: 1 },
          )} on weekdays.`
        : ''
    return `Bookings per day from ${first} to ${last}. ${formatNumber(stats.bookings)} bookings and ${formatNumber(
      stats.cancellations,
    )} cancellations in total.${lift}`
  }, [data, stats])

  const legendItems: ChartLegendItem[] = useMemo(
    () => [
      {
        key: 'bookings',
        label: 'Bookings',
        color: BOOKINGS_COLOR,
        shape: 'square',
        value: formatNumber(stats.bookings),
      },
      {
        key: 'cancellations',
        label: 'Cancellations',
        color: CANCELLED_COLOR,
        shape: 'square',
        value: formatNumber(stats.cancellations),
      },
    ],
    [stats],
  )

  return (
    <ChartContainer
      title={title}
      description={description}
      ariaLabel={summary}
      height={height}
      toolbar={toolbar}
      loading={loading}
      empty={data.length === 0}
      className={className}
      legend={
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <ChartLegend items={legendItems} hidden={hidden} onToggle={(_key, next) => setHidden(next)} />
          <span className="flex items-center gap-1.5 text-xs text-subtle">
            <span className="size-1.5 rounded-full" style={{ background: BOOKINGS_COLOR }} aria-hidden="true" />
            Marked columns are weekends
          </span>
        </div>
      }
      dataTable={
        <table>
          <caption>{summary}</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Bookings</th>
              <th scope="col">Cancellations</th>
              <th scope="col">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.date}>
                <th scope="row">
                  {formatDateLong(fromDateKey(point.date))}
                  {point.weekend ? ' (weekend)' : ''}
                </th>
                <td>{formatNumber(point.bookings)}</td>
                <td>{formatNumber(point.cancellations)}</td>
                <td>{formatCurrency(point.revenue, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, bottom: 6, left: 0 }} barCategoryGap="24%" maxBarSize={38}>
          <CartesianGrid vertical={false} stroke={CHART_INK.grid} strokeWidth={1} />

          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={4}
            minTickGap={16}
            interval="preserveStartEnd"
            tick={WeekendAwareTick}
          />
          <YAxis
            width={48}
            tickCount={5}
            allowDecimals={false}
            tickFormatter={(value: number) => formatNumber(value, { compact: true })}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={{ fill: CHART_INK.tick, fontSize: 12 }}
          />

          <Tooltip
            cursor={CHART_CURSOR_BAND}
            isAnimationActive={false}
            content={
              <ChartTooltip
                formatLabel={(label) => formatDateLong(fromDateKey(String(label)))}
                formatValue={(value) => formatNumber(value)}
                sublabel={(datum) => (datum.weekend ? 'Weekend departure day' : 'Weekday')}
                footer={(datum) => {
                  const booked = Number(datum.bookings ?? 0)
                  const cancelled = Number(datum.cancellations ?? 0)
                  const gross = booked + cancelled
                  return (
                    <span className="flex items-center justify-between gap-3">
                      <span>Cancellation rate</span>
                      <span className="tabular font-medium text-muted">
                        {formatPercent(gross === 0 ? 0 : (cancelled / gross) * 100, 1)}
                      </span>
                    </span>
                  )
                }}
              />
            }
          />

          <Bar
            dataKey="bookings"
            name="Bookings"
            stackId="day"
            hide={hidden.includes('bookings')}
            fill={BOOKINGS_COLOR}
            radius={[4, 4, 0, 0]}
            isAnimationActive={!reduced}
            animationDuration={620}
            animationEasing="cubic-bezier(0.16,1,0.3,1)"
          >
            {/* Weekday columns recede so the weekend rhythm reads instantly. */}
            {data.map((point) => (
              <Cell key={point.date} fillOpacity={point.weekend ? 1 : 0.55} />
            ))}
          </Bar>

          <Bar
            dataKey="cancellations"
            name="Cancellations"
            stackId="day"
            hide={hidden.includes('cancellations')}
            fill={CANCELLED_COLOR}
            fillOpacity={0.5}
            radius={[4, 4, 0, 0]}
            isAnimationActive={!reduced}
            animationDuration={620}
            animationBegin={120}
            animationEasing="cubic-bezier(0.16,1,0.3,1)"
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
