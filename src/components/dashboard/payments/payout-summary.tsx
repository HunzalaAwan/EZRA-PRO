'use client'

/**
 * Money in, money out. The balance row answers "what do I actually have?", the
 * callout answers "when does it land?", and the chart splits every dollar taken
 * into the part the operator keeps and the part the processor does.
 */

import * as React from 'react'
import {
  ArrowDownToLine,
  Banknote,
  CalendarClock,
  Landmark,
  Percent,
  Receipt,
  Timer,
  Wallet,
} from 'lucide-react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import {
  cn,
  average,
  formatCompactCurrency,
  formatCurrency,
  formatDateLong,
  formatDateShort,
  formatNumber,
  formatPercent,
  fromDateKey,
  sum,
} from '@/lib/utils'
import {
  CHART_INK,
  ChartContainer,
  ChartLegend,
  type ChartLegendItem,
} from '@/components/charts/chart-container'
import { CHART_CURSOR_BAND, ChartTooltip } from '@/components/charts/chart-tooltip'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { StatCard, StatGrid } from '@/components/ui/stat'
import { toast } from '@/components/ui/toaster'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   BALANCE ROW
   ========================================================================== */

export interface PayoutBalance {
  /** Minor units. Settled but not yet batched. */
  available: number
  /** Minor units. Batched and on its way to the bank. */
  inTransit: number
  inTransitTransactions: number
  /** Minor units, calendar month to date. */
  paidOutThisMonth: number
  paidOutBatches: number
  /** Minor units, trailing 30 days. */
  processingFees: number
  /** Processor fees as a percent of gross, trailing 30 days. */
  feeRate: number
  /** Minor units, trailing 30 days. */
  grossLast30: number
  /** Percent change on the trailing 30 days vs the 30 before. */
  grossDelta: number
  feeDelta: number
  nextPayoutAt: string
  nextPayoutAmount: number
  destination: string
}

export interface PayoutSummaryProps {
  balance: PayoutBalance
  currency: CurrencyCode
  className?: string
}

export function PayoutSummary({ balance, currency, className }: PayoutSummaryProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <StatGrid columns={4}>
        <StatCard
          icon={Wallet}
          accent="lagoon"
          stat={{
            label: 'Available balance',
            value: balance.available,
            format: 'currency',
            currency,
            hint: 'Takings from trips that have already run this week. They go out in the next weekly batch.',
          }}
          footer={
            <span className="flex items-center gap-1.5">
              <Timer className="size-3 text-faint" aria-hidden="true" />
              Batched weekly, paid the following Friday
            </span>
          }
        />

        <StatCard
          icon={ArrowDownToLine}
          accent="reef"
          stat={{
            label: 'In transit',
            value: balance.inTransit,
            format: 'currency',
            currency,
            hint: 'Last week’s trips, already sent to your bank — typically lands within one business day.',
          }}
          footer={
            <span className="flex items-center gap-1.5">
              <Landmark className="size-3 text-faint" aria-hidden="true" />
              {formatNumber(balance.inTransitTransactions)} transactions · {balance.destination}
            </span>
          }
        />

        <StatCard
          icon={Banknote}
          accent="sunset"
          stat={{
            label: 'Paid out this month',
            value: balance.paidOutThisMonth,
            format: 'currency',
            currency,
            deltaPercent: balance.grossDelta,
            direction: balance.grossDelta > 0 ? 'up' : balance.grossDelta < 0 ? 'down' : 'flat',
            higherIsBetter: true,
            comparisonLabel: 'volume vs prior 30 days',
          }}
          footer={
            <span className="flex items-center gap-1.5">
              <Receipt className="size-3 text-faint" aria-hidden="true" />
              {formatNumber(balance.paidOutBatches)} settled{' '}
              {balance.paidOutBatches === 1 ? 'batch' : 'batches'}
            </span>
          }
        />

        <StatCard
          icon={Percent}
          accent="coral"
          stat={{
            label: 'Processing fees',
            value: balance.processingFees,
            format: 'currency',
            currency,
            deltaPercent: balance.feeDelta,
            direction: balance.feeDelta > 0 ? 'up' : balance.feeDelta < 0 ? 'down' : 'flat',
            higherIsBetter: false,
            comparisonLabel: 'last 30 days',
          }}
          footer={
            <span className="flex items-center gap-1.5">
              <Percent className="size-3 text-faint" aria-hidden="true" />
              {formatPercent(balance.feeRate, 2)} of{' '}
              {formatCurrency(balance.grossLast30, currency, { compact: true })} gross
            </span>
          }
        />
      </StatGrid>

      {/* ---- next payout ---- */}
      <Card variant="gradient">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary ring-1 ring-primary/20 ring-inset">
              <CalendarClock className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-semibold tracking-[0.08em] text-subtle uppercase">
                Next payout
              </p>
              <p className="mt-1 text-sm text-foreground">
                <span className="tabular font-display text-lg font-semibold tracking-tight">
                  {formatCurrency(balance.nextPayoutAmount, currency)}
                </span>{' '}
                <span className="text-muted">
                  arrives {formatDateLong(balance.nextPayoutAt)} in {balance.destination}
                </span>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast.info('Payout schedule', {
                  description: 'Weekly. Each Monday–Sunday of trips is paid the Friday after it closes.',
                })
              }
            >
              Payout schedule
            </Button>
            <Button
              size="sm"
              leftIcon={<Banknote className="size-4" />}
              onClick={() =>
                toast.success('Instant payout requested', {
                  description: `${formatCurrency(balance.available, currency)} — arrives within 30 minutes for a 1% fee.`,
                })
              }
            >
              Pay out now
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}

/* ==========================================================================
   REVENUE vs FEES
   ========================================================================== */

export interface RevenueFeePoint {
  /** "YYYY-MM-DD". */
  date: string
  /** Minor units. */
  gross: number
  fee: number
  net: number
  refunds: number
  count: number
}

export interface RevenueFeesChartProps {
  /** One point per day, oldest first. */
  points: RevenueFeePoint[]
  currency: CurrencyCode
  className?: string
}

type Grain = 'daily' | 'weekly'

interface ChartDatum extends RevenueFeePoint {
  label: string
}

function toWeekly(points: RevenueFeePoint[]): RevenueFeePoint[] {
  const out: RevenueFeePoint[] = []
  for (let i = 0; i < points.length; i += 7) {
    const slice = points.slice(i, i + 7)
    out.push({
      date: slice[0].date,
      gross: sum(slice.map((p) => p.gross)),
      fee: sum(slice.map((p) => p.fee)),
      net: sum(slice.map((p) => p.net)),
      refunds: sum(slice.map((p) => p.refunds)),
      count: sum(slice.map((p) => p.count)),
    })
  }
  return out
}

export function RevenueFeesChart({ points, currency, className }: RevenueFeesChartProps) {
  const reduceMotion = useReducedMotionSafe()
  const [grain, setGrain] = React.useState<Grain>('daily')
  const [hidden, setHidden] = React.useState<string[]>([])

  const data = React.useMemo<ChartDatum[]>(() => {
    const source = grain === 'weekly' ? toWeekly(points) : points
    return source.map((point) => ({ ...point, label: formatDateShort(fromDateKey(point.date)) }))
  }, [points, grain])

  const totals = React.useMemo(
    () => ({
      gross: sum(points.map((p) => p.gross)),
      fee: sum(points.map((p) => p.fee)),
      net: sum(points.map((p) => p.net)),
      refunds: sum(points.map((p) => p.refunds)),
      count: sum(points.map((p) => p.count)),
    }),
    [points],
  )

  const meanGross = React.useMemo(() => average(data.map((d) => d.gross)), [data])
  const effectiveRate = totals.gross === 0 ? 0 : (totals.fee / totals.gross) * 100

  const legendItems: ChartLegendItem[] = [
    {
      key: 'net',
      label: 'Net to you',
      color: 'var(--chart-4)',
      shape: 'square',
      value: formatCurrency(totals.net, currency, { compact: true }),
    },
    {
      key: 'fee',
      label: 'Processing fees',
      color: 'var(--chart-6)',
      shape: 'square',
      value: formatCurrency(totals.fee, currency, { compact: true }),
    },
    {
      key: 'average',
      label: `${grain === 'weekly' ? 'Weekly' : 'Daily'} average`,
      color: 'var(--fg-faint)',
      shape: 'dashed',
      value: formatCompactCurrency(meanGross, currency),
    },
  ]

  const isHidden = (key: string) => hidden.includes(key)

  return (
    <ChartContainer
      className={className}
      title="Revenue and fees"
      description={`${formatCurrency(totals.gross, currency)} settled across ${formatNumber(totals.count)} charges${
        points.length > 0 ? `, through ${formatDateShort(fromDateKey(points[points.length - 1].date))}` : ''
      }`}
      ariaLabel={`Gross settled volume split into net payout and processing fees, by ${grain === 'weekly' ? 'week' : 'day'}. Effective fee rate ${effectiveRate.toFixed(2)} percent.`}
      height={300}
      toolbar={
        <Segmented
          label="Chart grain"
          size="sm"
          value={grain}
          onValueChange={(next) => setGrain(next as Grain)}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
          ]}
        />
      }
      legend={
        <ChartLegend items={legendItems} hidden={hidden} onToggle={(_, next) => setHidden(next)} />
      }
      empty={points.length === 0}
      footer={
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-subtle">
          <span>
            Effective rate{' '}
            <span className="tabular font-medium text-foreground">
              {effectiveRate.toFixed(2)}%
            </span>
          </span>
          <span>
            Refunded{' '}
            <span className="tabular font-medium text-foreground">
              {formatCurrency(totals.refunds, currency)}
            </span>
          </span>
          <span>
            Net{' '}
            <span className="tabular font-medium text-foreground">
              {formatCurrency(totals.net, currency)}
            </span>
          </span>
        </div>
      }
      dataTable={
        <table>
          <caption>Settled volume, processing fees and net payout</caption>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Gross</th>
              <th scope="col">Fees</th>
              <th scope="col">Net</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.date}>
                <th scope="row">{formatDateLong(fromDateKey(point.date))}</th>
                <td>{formatCurrency(point.gross, currency)}</td>
                <td>{formatCurrency(point.fee, currency)}</td>
                <td>{formatCurrency(point.net, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: 0 }} barCategoryGap="18%">
          <CartesianGrid vertical={false} stroke={CHART_INK.grid} strokeWidth={1} />

          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={22}
            tick={{ fill: CHART_INK.tick, fontSize: 11 }}
          />
          <YAxis
            width={58}
            tickCount={5}
            tickFormatter={(value: number) => formatCompactCurrency(value, currency)}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={{ fill: CHART_INK.tick, fontSize: 11 }}
          />

          {!isHidden('average') ? (
            <ReferenceLine
              y={meanGross}
              stroke={CHART_INK.reference}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
          ) : null}

          <Tooltip
            cursor={CHART_CURSOR_BAND}
            isAnimationActive={false}
            content={
              <ChartTooltip
                formatLabel={(label) => String(label ?? '')}
                formatValue={(value) => formatCurrency(value, currency)}
                showTotal
                totalLabel="Gross"
                footer={(datum) =>
                  `${formatNumber(Number(datum.count ?? 0))} charges${
                    Number(datum.refunds ?? 0) > 0
                      ? ` · ${formatCurrency(Number(datum.refunds), currency)} refunded`
                      : ''
                  }`
                }
              />
            }
          />

          <Bar
            dataKey="net"
            name="Net to you"
            stackId="gross"
            fill="var(--chart-4)"
            radius={[0, 0, 3, 3]}
            hide={isHidden('net')}
            isAnimationActive={!reduceMotion}
            animationDuration={620}
          />
          <Bar
            dataKey="fee"
            name="Processing fees"
            stackId="gross"
            fill="var(--chart-6)"
            radius={[3, 3, 0, 0]}
            hide={isHidden('fee')}
            isAnimationActive={!reduceMotion}
            animationDuration={620}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
