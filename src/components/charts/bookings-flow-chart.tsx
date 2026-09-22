'use client'

/**
 * BookingsFlowChart — bookings in, cancellations out, on one baseline.
 *
 * The mirrored layout is the point: what came in stands above zero, what
 * went back out hangs below it, so a bad week reads as a visible bite out of
 * the bottom rather than a slightly smaller bar. Bars grow from the baseline
 * on entry; the tooltip shows the day's net.
 */

import { useMemo, type ReactNode } from 'react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatDateLong, formatDateShort, formatNumber, fromDateKey, sum } from '@/lib/utils'
import type { TimeSeriesPoint } from '@/types'
import { CHART_INK, ChartContainer, ChartLegend, type ChartLegendItem } from './chart-container'
import { CHART_CURSOR_BAND, ChartTooltip } from './chart-tooltip'

const IN_COLOR = 'var(--series-bookings)'
const OUT_COLOR = 'var(--series-cancellations)'

interface FlowPoint {
  date: string
  bookings: number
  /** Stored negative so it renders below the baseline. */
  cancellations: number
}

export interface BookingsFlowChartProps {
  points: TimeSeriesPoint[]
  height?: number
  title?: string
  description?: string
  toolbar?: ReactNode
  loading?: boolean
  className?: string
}

export function BookingsFlowChart({
  points,
  height = 260,
  title = 'Bookings flow',
  description,
  toolbar,
  loading = false,
  className,
}: BookingsFlowChartProps) {
  const reduced = useReducedMotionSafe()

  const data = useMemo<FlowPoint[]>(
    () =>
      points.map((p) => ({
        date: p.date,
        bookings: p.bookings,
        cancellations: -p.cancellations,
      })),
    [points],
  )

  const totals = useMemo(() => {
    const inbound = sum(points.map((p) => p.bookings))
    const outbound = sum(points.map((p) => p.cancellations))
    return { inbound, outbound, net: inbound - outbound }
  }, [points])

  const legend: ChartLegendItem[] = [
    { key: 'bookings', label: 'Bookings', color: IN_COLOR, value: formatNumber(totals.inbound) },
    { key: 'cancellations', label: 'Cancelled', color: OUT_COLOR, value: formatNumber(totals.outbound) },
  ]

  const range =
    points.length > 0
      ? `${formatDateShort(fromDateKey(points[0].date))} – ${formatDateShort(
          fromDateKey(points[points.length - 1].date),
        )}`
      : ''

  return (
    <ChartContainer
      title={title}
      description={description ?? `Bookings in, cancellations out · ${range}`}
      ariaLabel={`${title}. ${formatNumber(totals.inbound)} bookings and ${formatNumber(
        totals.outbound,
      )} cancellations, net ${formatNumber(totals.net)}, ${range}.`}
      height={height}
      toolbar={toolbar}
      loading={loading}
      empty={points.length === 0}
      className={className}
      legend={
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-subtle">Net bookings</p>
            <p className="mt-0.5 font-display text-2xl leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums">
              {formatNumber(totals.net)}
            </p>
          </div>
          <ChartLegend items={legend} align="end" />
        </div>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          stackOffset="sign"
          margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
          barCategoryGap="32%"
          maxBarSize={22}
        >
          <CartesianGrid vertical={false} stroke={CHART_INK.grid} strokeWidth={1} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
            tick={{ fill: CHART_INK.tick, fontSize: 12 }}
            tickFormatter={(value: string) => formatDateShort(fromDateKey(value))}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={36}
            tickCount={5}
            tick={{ fill: CHART_INK.tick, fontSize: 12 }}
            tickFormatter={(value: number) => formatNumber(Math.abs(value), { compact: true })}
          />
          <ReferenceLine y={0} stroke={CHART_INK.reference} strokeWidth={1} />
          <Tooltip
            cursor={CHART_CURSOR_BAND}
            isAnimationActive={false}
            content={
              <ChartTooltip
                formatLabel={(label) => formatDateLong(fromDateKey(String(label)))}
                formatValue={(value) => formatNumber(Math.abs(value))}
                formatName={(entry) => (entry.dataKey === 'cancellations' ? 'Cancelled' : 'Bookings')}
                footer={(datum) => {
                  const inbound = Number(datum.bookings ?? 0)
                  const outbound = Math.abs(Number(datum.cancellations ?? 0))
                  return (
                    <span className="text-xs font-semibold text-foreground tabular-nums">
                      Net {formatNumber(inbound - outbound)}
                    </span>
                  )
                }}
              />
            }
          />
          <Bar
            dataKey="bookings"
            name="Bookings"
            stackId="flow"
            fill={IN_COLOR}
            radius={[4, 4, 0, 0]}
            isAnimationActive={!reduced}
            animationDuration={720}
            animationEasing="ease-out"
          />
          <Bar
            dataKey="cancellations"
            name="Cancelled"
            stackId="flow"
            fill={OUT_COLOR}
            radius={[0, 0, 4, 4]}
            isAnimationActive={!reduced}
            animationDuration={720}
            animationEasing="ease-out"
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
