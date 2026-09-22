'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, Flame, Snowflake, Target, Wand2 } from 'lucide-react'

import { OccupancyHeatmap } from '@/components/charts/occupancy-heatmap'
import { RadialGauge } from '@/components/charts/radial-gauge'
import { ActivityPerformanceChart } from '@/components/charts/activity-performance-chart'
import { CountUp } from '@/components/motion/count-up'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  average,
  clamp,
  cn,
  formatCurrency,
  formatNumber,
  formatPercent,
  sum,
} from '@/lib/utils'
import type { ActivityPerformance, CurrencyCode, HeatmapCell } from '@/types'

/* ==========================================================================
   OccupancySection

   The heatmap is the picture; the underfilled-slot list is the answer. Every
   row below is a real weekday/hour cell from the trailing 90 days of
   departures, scored against the average utilisation the business already
   achieves over the selected range.
   ========================================================================== */

/** Heatmap weekday index is 0 = Monday, matching the calendar grid. */
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? 'pm' : 'am'
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}${suffix}`
}

interface SlotOpportunity {
  key: string
  cell: HeatmapCell
  gap: number
  monthly: number
}

interface Analysis {
  benchmark: number
  slots: SlotOpportunity[]
  /** Sum of the shortlist that is actually on screen — never the long tail. */
  shortlistMonthly: number
  candidateCount: number
  peak: HeatmapCell
  quietest: HeatmapCell
  analysed: number
}

/** How many slots the board is willing to put in front of an operator at once. */
const SHORTLIST = 6

/**
 * `utilisation` is the operator's own average for the range. Using it as the
 * target keeps the model conservative and intelligible: the ask is "bring the
 * laggards up to what the rest of the business already does", not "run every
 * Tuesday morning like a Saturday sunset".
 */
function analyse(cells: HeatmapCell[], utilisation: number): Analysis | null {
  const active = cells.filter((c) => c.bookings > 0)
  if (active.length < 4) return null

  const ranked = [...active].sort((a, b) => b.occupancy - a.occupancy)
  const fallback = average(ranked.map((c) => c.occupancy))
  const benchmark = clamp(utilisation > 0 ? utilisation : fallback, 55, 92)

  const busy = active.filter((c) => c.bookings >= 8)
  const pool = busy.length >= 4 ? busy : active

  const slots = pool
    // Ten points clear of the average, with enough volume to be a pattern
    // rather than one quiet week.
    .filter((c) => c.occupancy >= 20 && c.occupancy <= benchmark - 10)
    .map((c) => {
      // Revenue scales with occupancy at fixed capacity. The lift is capped at
      // +60% so a thin slot never projects a fantasy number.
      const lift = Math.min((benchmark - c.occupancy) / c.occupancy, 0.6)
      return {
        key: `${c.weekday}:${c.hour}`,
        cell: c,
        gap: benchmark - c.occupancy,
        // The heatmap window is 90 days; express the prize per month.
        monthly: Math.round((c.revenue / 3) * lift),
      }
    })
    .sort((a, b) => b.monthly - a.monthly)

  const shortlist = slots.slice(0, SHORTLIST)

  return {
    benchmark,
    slots: shortlist,
    shortlistMonthly: sum(shortlist.map((s) => s.monthly)),
    candidateCount: slots.length,
    peak: ranked[0],
    quietest: ranked[ranked.length - 1],
    analysed: active.length,
  }
}

export interface OccupancySectionProps {
  heatmap: HeatmapCell[]
  topActivities: ActivityPerformance[]
  /** Overall capacity utilisation for the range, 0-100. */
  utilisation: number
  currency: CurrencyCode
  rangeLabel: string
  loading?: boolean
  className?: string
}

export function OccupancySection({
  heatmap,
  topActivities,
  utilisation,
  currency,
  rangeLabel,
  loading = false,
  className,
}: OccupancySectionProps) {
  const analysis = React.useMemo(() => analyse(heatmap, utilisation), [heatmap, utilisation])

  return (
    <section className={cn('space-y-4', className)} aria-label="Capacity and occupancy">
      <div className="grid gap-4 xl:grid-cols-3">
        {/* ---------- heatmap ---------- */}
        <div className="xl:col-span-2">
          <OccupancyHeatmap
            cells={heatmap}
            currency={currency}
            height={300}
            loading={loading}
            title="Occupancy by day and time"
            description="Seats sold as a share of seats offered, across the trailing 90 days of departures."
          />
        </div>

        {/* ---------- utilisation gauge ---------- */}
        <div className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Capacity utilisation</h3>
            <p className="mt-0.5 text-xs text-muted">{rangeLabel}</p>
          </div>

          <div className="flex flex-1 items-center justify-center py-4">
            {loading ? (
              <Skeleton shape="circle" className="size-[168px]" />
            ) : (
              <RadialGauge
                value={utilisation}
                size={168}
                thickness={13}
                sublabel="of seats offered"
                ariaLabel={`Capacity utilisation ${formatPercent(utilisation, 1)} of seats offered across ${rangeLabel.toLowerCase()}.`}
              />
            )}
          </div>

          {analysis && !loading ? (
            <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line-subtle bg-line-subtle">
              <div className="flex items-center gap-2.5 bg-surface px-3 py-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-success-soft text-success">
                  <Flame aria-hidden="true" className="size-3.5" />
                </span>
                <dt className="text-xs text-muted">Peak slot</dt>
                <dd className="ml-auto text-right text-xs font-medium tabular-nums text-foreground">
                  {WEEKDAYS_SHORT[analysis.peak.weekday]} {hourLabel(analysis.peak.hour)} ·{' '}
                  {formatPercent(analysis.peak.occupancy, 0)}
                </dd>
              </div>
              <div className="flex items-center gap-2.5 bg-surface px-3 py-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-info-soft text-info">
                  <Snowflake aria-hidden="true" className="size-3.5" />
                </span>
                <dt className="text-xs text-muted">Quietest slot</dt>
                <dd className="ml-auto text-right text-xs font-medium tabular-nums text-foreground">
                  {WEEKDAYS_SHORT[analysis.quietest.weekday]} {hourLabel(analysis.quietest.hour)} ·{' '}
                  {formatPercent(analysis.quietest.occupancy, 0)}
                </dd>
              </div>
              <div className="flex items-center gap-2.5 bg-surface px-3 py-2.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                  <Target aria-hidden="true" className="size-3.5" />
                </span>
                <dt className="text-xs text-muted">Target for laggards</dt>
                <dd className="ml-auto text-right text-xs font-medium tabular-nums text-foreground">
                  {formatPercent(analysis.benchmark, 0)} · your average
                </dd>
              </div>
            </dl>
          ) : (
            <div className="space-y-2">
              <Skeleton shape="line" className="h-8 rounded-xl" />
              <Skeleton shape="line" className="h-8 rounded-xl" />
              <Skeleton shape="line" className="h-8 rounded-xl" />
            </div>
          )}
        </div>
      </div>

      {/* ---------- the money shot: underfilled slots ---------- */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="relative isolate overflow-hidden rounded-2xl border border-line bg-surface shadow-md xl:col-span-2">

          <header className="flex flex-wrap items-start justify-between gap-4 px-5 pb-4 pt-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-primary text-on-primary shadow-sm">
                  <Wand2 aria-hidden="true" className="size-4" strokeWidth={2} />
                </span>
                <h3 className="font-display text-base font-semibold tracking-[-0.02em] text-foreground">
                  Underfilled slots
                </h3>
              </div>
              <p className="mt-2 max-w-xl text-[0.8125rem] leading-relaxed text-muted">
                {analysis
                  ? `${analysis.candidateCount} recurring weekday-and-hour combinations run at least ten points under your own ${formatPercent(
                      analysis.benchmark,
                      0,
                    )} average. Each one is a departure you are already crewing and fuelling. These are the ${analysis.slots.length} worth the most.`
                  : 'Not enough departure history in this window to score individual slots yet.'}
              </p>
            </div>

            {analysis && analysis.slots.length > 0 ? (
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold uppercase tracking-[0.07em] text-faint">
                  Recoverable
                </p>
                <p className="font-display text-2xl font-semibold tracking-[-0.03em] text-primary">
                  <CountUp
                    value={analysis.shortlistMonthly}
                    format="currency"
                    currency={currency}
                    duration={1.1}
                  />
                </p>
                <p className="text-xs text-subtle">
                  per month · these {analysis.slots.length} slots
                </p>
              </div>
            ) : null}
          </header>

          {loading ? (
            <div className="space-y-2 px-5 pb-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} shape="block" className="h-[4.25rem] rounded-xl" />
              ))}
            </div>
          ) : analysis && analysis.slots.length > 0 ? (
            <StaggerGroup as="ul" stagger={0.05} className="space-y-2 px-5 pb-5">
              {analysis.slots.map((slot) => (
                <StaggerItem
                  as="li"
                  key={slot.key}
                  className="group flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-surface/85 px-3.5 py-3 backdrop-blur-sm transition-colors hover:border-primary/45 hover:bg-surface"
                >
                  <div className="flex min-w-[8.5rem] shrink-0 flex-col">
                    <span className="text-[0.8125rem] font-semibold text-foreground">
                      {WEEKDAYS[slot.cell.weekday]}
                    </span>
                    <span className="text-xs tabular-nums text-subtle">
                      {hourLabel(slot.cell.hour)} departures
                    </span>
                  </div>

                  <div className="min-w-[10rem] flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium tabular-nums text-foreground">
                        {formatPercent(slot.cell.occupancy, 0)} full
                      </span>
                      <span className="tabular-nums text-faint">
                        target {formatPercent(analysis.benchmark, 0)}
                      </span>
                    </div>
                    <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full bg-surface"
                        style={{ width: `${clamp(slot.cell.occupancy, 2, 100)}%` }}
                      />
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-0 w-0.5 rounded-full bg-primary"
                        style={{ left: `${clamp(analysis.benchmark, 0, 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-subtle">
                      {formatNumber(slot.cell.bookings)} bookings in the window ·{' '}
                      {slot.gap.toFixed(0)} points below target
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="font-display text-base font-semibold tabular-nums text-success">
                      +{formatCurrency(slot.monthly, currency)}
                    </p>
                    <p className="text-xs text-subtle">per month</p>
                  </div>

                  <Button
                    asChild
                    size="xs"
                    variant="outline"
                    className="shrink-0 opacity-90 transition-opacity group-hover:opacity-100"
                  >
                    <Link
                      href="/dashboard/calendar"
                      aria-label={`Open the calendar on ${WEEKDAYS[slot.cell.weekday]} ${hourLabel(
                        slot.cell.hour,
                      )} departures`}
                    >
                      Fix slot
                      <ArrowUpRight aria-hidden="true" />
                    </Link>
                  </Button>
                </StaggerItem>
              ))}
            </StaggerGroup>
          ) : (
            <p className="px-5 pb-6 text-sm text-subtle">
              Every slot with meaningful volume is within eight points of your benchmark. There is
              no idle capacity worth chasing in this window.
            </p>
          )}

          {analysis && analysis.slots.length > 0 ? (
            <footer className="border-t border-line-subtle px-5 py-3 text-xs leading-relaxed text-faint">
              Scored across {formatNumber(analysis.analysed)} active slots. Each one is measured
              on the trailing 90 days of departures and scaled up to your
              selected range&rsquo;s average occupancy at unchanged capacity, then normalised
              from the 90-day window to a month. Lift is capped at +60% per slot, and the headline
              totals only the slots listed here — filling every soft slot at once is not a plan
              anyone can run.
            </footer>
          ) : null}
        </div>

        {/* ---------- activity performance ---------- */}
        <ActivityPerformanceChart
          items={topActivities}
          currency={currency}
          limit={7}
          loading={loading}
          title="Activities by revenue"
          description="Occupancy and rating alongside the money, so a busy product that guests dislike cannot hide."
        />
      </div>
    </section>
  )
}
