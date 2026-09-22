'use client'

/**
 * AnalyticsShowcase — "Analytics that tell you what to do next".
 *
 * The headline claim against the incumbents, so it is argued with the
 * product rather than described: the panel inside the `<AppFrame>` is the real
 * chart library (`RevenueAreaChart`, `StatCard`, `OccupancyHeatmap`) fed with
 * demo data shaped like an actual seasonal, weekend-peaked charter business.
 *
 * All of that data is generated once at module scope from
 * `createRng(hashSeed(...))`, so the server and the client produce byte-identical
 * numbers — no `Math.random()`, no `Date.now()`, no hydration drift.
 *
 * The charts sit in their loading state until the panel scrolls into view, at
 * which point they mount for real and run their own entrance animations.
 */

import { useRef } from 'react'
import Link from 'next/link'
import { useInView } from 'motion/react'
import {
  ArrowRight,
  CalendarClock,
  Check,
  Lightbulb,
  Share2,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

import { AppFrame } from '@/components/marketing/app-frame'
import { OccupancyHeatmap } from '@/components/charts/occupancy-heatmap'
import { RevenueAreaChart } from '@/components/charts/revenue-area-chart'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard, type StatAccent } from '@/components/ui/stat'
import { FEATURE_BLOCKS } from '@/content/marketing'
import {
  addDays,
  average,
  clamp,
  cn,
  createRng,
  hashSeed,
  percentChange,
  sum,
  toDateKey,
} from '@/lib/utils'
import type { HeatmapCell, Insight, KpiMetric, TimeSeriesPoint } from '@/types'

/* ==========================================================================
   DEMO DATA
   A 90-day window for a Maui charter operator: weekend-peaked, gently growing
   through the late-summer season, with a real Tuesday problem.
   ========================================================================== */

/** Sunday 13 September 2026 — the last day of the modelled window. */
const ANCHOR = new Date(2026, 8, 13)
const SERIES_DAYS = 90
/** Baseline gross per day, in minor units ($8,800). */
const BASE_DAY = 880_000
/** Same business one period earlier — lands the year-on-year lift near +17%. */
const PREV_PERIOD_FACTOR = 0.95

/** Demand by weekday, indexed 0 = Monday to match `HeatmapCell.weekday`. */
const WEEKDAY_LIFT = [0.62, 0.56, 0.74, 0.88, 1.06, 1.42, 1.26] as const

/** 0 = Monday … 6 = Sunday, from a JS `Date`. */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

function buildTimeseries(): TimeSeriesPoint[] {
  const rng = createRng(hashSeed('ezra-analytics-timeseries-90d'))
  const start = addDays(ANCHOR, -(SERIES_DAYS - 1))
  const points: TimeSeriesPoint[] = []

  for (let index = 0; index < SERIES_DAYS; index += 1) {
    const date = addDays(start, index)
    const lift = WEEKDAY_LIFT[mondayIndex(date)]

    // A single seasonal arc across the window plus steady period-on-period growth.
    const season = 0.88 + 0.2 * Math.sin(((index + 10) / SERIES_DAYS) * Math.PI)
    const seasonPrev = 0.89 + 0.19 * Math.sin(((index + 16) / SERIES_DAYS) * Math.PI)
    const growth = 1 + (index / SERIES_DAYS) * 0.18

    const jitter = 0.9 + rng() * 0.2
    const prevJitter = 0.9 + rng() * 0.2
    const aovJitter = rng()
    const guestJitter = rng()
    const cancelJitter = rng()
    const occupancyJitter = rng()

    const revenue = Math.round((BASE_DAY * lift * season * growth * jitter) / 100) * 100
    const prevRevenue = Math.round((BASE_DAY * PREV_PERIOD_FACTOR * lift * seasonPrev * prevJitter) / 100) * 100
    const avgOrderValue = Math.round((18_000 + aovJitter * 9_000) / 100) * 100
    const bookings = Math.max(1, Math.round(revenue / avgOrderValue))

    points.push({
      date: toDateKey(date),
      revenue,
      prevRevenue,
      bookings,
      guests: Math.round(bookings * (2.2 + guestJitter * 0.8)),
      occupancy: clamp(
        Math.round(30 + (lift - 0.5) * 54 + (occupancyJitter - 0.5) * 9),
        24,
        98,
      ),
      cancellations: Math.round(bookings * (0.015 + cancelJitter * 0.045)),
      avgOrderValue,
    })
  }

  return points
}

const POINTS = buildTimeseries()

/** Twelve trailing weekly buckets — the shape every KPI sparkline is built on. */
function weeklyBuckets<T>(reduce: (window: TimeSeriesPoint[]) => T): T[] {
  const weeks = 12
  const offset = SERIES_DAYS - weeks * 7
  return Array.from({ length: weeks }, (_, week) =>
    reduce(POINTS.slice(offset + week * 7, offset + week * 7 + 7)),
  )
}

const TOTAL_REVENUE = sum(POINTS.map((point) => point.revenue))
const TOTAL_PREV_REVENUE = sum(POINTS.map((point) => point.prevRevenue))
const AVG_OCCUPANCY = average(POINTS.map((point) => point.occupancy))

const REVENUE_SPARK = weeklyBuckets((window) => sum(window.map((p) => p.revenue)))
const OCCUPANCY_SPARK = weeklyBuckets((window) => average(window.map((p) => p.occupancy)))
const DIRECT_SPARK = (() => {
  const rng = createRng(hashSeed('ezra-analytics-direct-share'))
  return Array.from({ length: 12 }, (_, week) => 56 + week * 1.1 + (rng() - 0.5) * 4)
})()

/**
 * Sparklines are deliberately left off the in-frame tiles: at preview scale the
 * trend is already carried by the revenue chart directly beneath them, and the
 * figure deserves the width. The full series is kept on the metric so the same
 * objects drop straight into the dashboard's wider KPI row.
 */
const KPIS: { metric: KpiMetric; accent: StatAccent }[] = [
  {
    accent: 'lagoon',
    metric: {
      key: 'revenue',
      label: 'Revenue',
      value: TOTAL_REVENUE,
      format: 'currency',
      currency: 'USD',
      deltaPercent: percentChange(TOTAL_REVENUE, TOTAL_PREV_REVENUE),
      direction: 'up',
      higherIsBetter: true,
      comparisonLabel: 'vs prior 90 days',
      sparkline: REVENUE_SPARK,
    },
  },
  {
    accent: 'reef',
    metric: {
      key: 'occupancy',
      label: 'Avg occupancy',
      value: AVG_OCCUPANCY,
      format: 'percent',
      deltaPercent: 7.4,
      direction: 'up',
      higherIsBetter: true,
      comparisonLabel: 'vs prior 90 days',
      sparkline: OCCUPANCY_SPARK,
    },
  },
  {
    accent: 'coral',
    metric: {
      key: 'direct-share',
      label: 'Direct share',
      value: DIRECT_SPARK[DIRECT_SPARK.length - 1],
      format: 'percent',
      deltaPercent: 9.1,
      direction: 'up',
      higherIsBetter: true,
      comparisonLabel: 'vs prior 90 days',
      sparkline: DIRECT_SPARK,
      hint: 'Share of bookings taken on your own site, widget and desk rather than an OTA.',
    },
  },
]

const HEATMAP_START_HOUR = 9
const HEATMAP_END_HOUR = 16

/**
 * The operator's actual timetable: which weekdays run a departure at each hour,
 * how many seats it holds and what it sells for. Hours with no entry for a day
 * render as an empty slot, which is exactly what the dashboard does.
 */
const HOUR_PLAN: Record<
  number,
  { weekdays: number[]; capacity: number; price: number; factor: number }
> = {
  9: { weekdays: [0, 1, 2, 3, 4, 5, 6], capacity: 16, price: 11_900, factor: 0.86 },
  10: { weekdays: [0, 1, 2, 3, 4, 5, 6], capacity: 26, price: 12_900, factor: 1.0 },
  11: { weekdays: [0, 1, 2, 3, 4, 5, 6], capacity: 12, price: 9_900, factor: 0.78 },
  12: { weekdays: [5, 6], capacity: 20, price: 13_900, factor: 1.04 },
  13: { weekdays: [0, 1, 2, 3, 4, 5, 6], capacity: 16, price: 11_900, factor: 0.84 },
  14: { weekdays: [0, 2, 4, 5, 6], capacity: 12, price: 8_900, factor: 0.72 },
  15: { weekdays: [4, 5, 6], capacity: 18, price: 10_900, factor: 0.92 },
  16: { weekdays: [0, 1, 2, 3, 4, 5, 6], capacity: 38, price: 8_900, factor: 1.12 },
}

/** The two slots the headline insight names. Data and copy must never disagree. */
const FORCED_OCCUPANCY: Record<string, number> = {
  '5:10': 96,
  '1:10': 41,
}

function buildHeatmap(): HeatmapCell[] {
  const rng = createRng(hashSeed('ezra-analytics-heatmap'))
  const cells: HeatmapCell[] = []
  // ~13 occurrences of each weekly slot inside a 90-day window.
  const occurrences = 13

  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (let hour = HEATMAP_START_HOUR; hour <= HEATMAP_END_HOUR; hour += 1) {
      const plan = HOUR_PLAN[hour]
      if (!plan || !plan.weekdays.includes(weekday)) continue

      const lift = WEEKDAY_LIFT[weekday]
      const noise = (rng() - 0.5) * 11
      const modelled = clamp(Math.round(28 + (lift - 0.5) * 56 * plan.factor + noise), 16, 98)
      const occupancy = FORCED_OCCUPANCY[`${weekday}:${hour}`] ?? modelled
      const bookings = Math.round((plan.capacity * occupancy * occurrences) / 100)

      cells.push({ weekday, hour, occupancy, bookings, revenue: bookings * plan.price })
    }
  }

  return cells
}

const HEATMAP_CELLS = buildHeatmap()

/* ==========================================================================
   INSIGHTS — the differentiator. Written in the product's voice, with the
   dollar impact attached and a deep link into the screen that fixes it.
   ========================================================================== */

const INSIGHTS: Insight[] = [
  {
    id: 'insight-tuesday',
    severity: 'warning',
    title: 'Move one Tuesday departure to Saturday',
    body: 'Saturday 10:00 runs at 96% while Tuesday 10:00 sits at 41%. Shifting a single Tuesday slot onto the Saturday grid absorbs demand you are already turning away at the dock.',
    metric: '+$4,200/mo',
    href: '/dashboard/calendar',
    actionLabel: 'Open the schedule',
  },
  {
    id: 'insight-sunset',
    severity: 'positive',
    title: 'The 16:30 sunset sail is underpriced',
    body: 'It has sold out 11 of the last 14 evenings, and 38% of those seats went inside the final 48 hours. A $12 rise tests clean against your own demand curve.',
    metric: '+$3,100/mo',
    href: '/dashboard/activities',
    actionLabel: 'Review pricing',
  },
  {
    id: 'insight-channel',
    severity: 'critical',
    title: 'OTAs are quietly taking your margin',
    body: 'Resellers sent 28% of bookings but only 19% of margin after commission. A returning-guest code on the confirmation email pulls the second trip back to direct.',
    metric: '+$1,900/mo',
    href: '/dashboard/analytics',
    actionLabel: 'See channel mix',
  },
]

const INSIGHT_ICON: Record<string, LucideIcon> = {
  'insight-tuesday': CalendarClock,
  'insight-sunset': TrendingUp,
  'insight-channel': Share2,
}

const SEVERITY: Record<
  Insight['severity'],
  { label: string; chip: string; metric: string; rule: string; glow: string }
> = {
  positive: {
    label: 'Opportunity',
    chip: 'bg-success-soft text-success ring-success/25',
    metric: 'text-success',
    rule: 'bg-success',
    glow: 'group-hover/insight:shadow-[0_18px_40px_-20px_color-mix(in_oklab,var(--success)_65%,transparent)]',
  },
  neutral: {
    label: 'Note',
    chip: 'bg-info-soft text-info ring-info/25',
    metric: 'text-info',
    rule: 'bg-info',
    glow: 'group-hover/insight:shadow-[0_18px_40px_-20px_color-mix(in_oklab,var(--info)_65%,transparent)]',
  },
  warning: {
    label: 'Act this week',
    chip: 'bg-warning-soft text-warning ring-warning/25',
    metric: 'text-warning',
    rule: 'bg-warning',
    glow: 'group-hover/insight:shadow-[0_18px_40px_-20px_color-mix(in_oklab,var(--warning)_65%,transparent)]',
  },
  critical: {
    label: 'Losing money',
    chip: 'bg-danger-soft text-danger ring-danger/25',
    metric: 'text-danger',
    rule: 'bg-danger',
    glow: 'group-hover/insight:shadow-[0_18px_40px_-20px_color-mix(in_oklab,var(--danger)_65%,transparent)]',
  },
}

const ANALYTICS_BLOCK = FEATURE_BLOCKS.find((block) => block.id === 'feat-analytics')

const RANGE_PILLS = ['7d', '30d', '90d'] as const

/* ==========================================================================
   SECTION
   ========================================================================== */

export function AnalyticsShowcase({ className }: { className?: string }) {
  const panelRef = useRef<HTMLDivElement>(null)
  // Once only: charts should animate on arrival, not every time you scroll past.
  const inView = useInView(panelRef, { once: true, margin: '-12%' })

  return (
    <section
      id="analytics"
      aria-labelledby="analytics-showcase-heading"
      className={cn(
        'relative isolate overflow-hidden bg-background-subtle py-14 sm:py-16',
        className,
      )}
    >
      {/* Decorative ground: one reef-tinted bloom, masked so it never fights the data. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-[0.35] mask-fade-b"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-10%] -z-10 size-[34rem] rounded-full bg-reef-400 opacity-[0.08] blur-3xl"
      />

      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-14">
          {/* ---------- Copy ---------- */}
          <div className="lg:col-span-5">
            <Reveal direction="up" blur className="lg:sticky lg:top-28">
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold tracking-[0.1em] text-accent uppercase shadow-xs">
                <Sparkles aria-hidden="true" className="size-3" />
                {ANALYTICS_BLOCK?.eyebrow ?? 'Revenue'}
              </p>

              <h2
                id="analytics-showcase-heading"
                className="mt-5 text-display-sm text-balance text-foreground sm:text-display-md"
              >
                {ANALYTICS_BLOCK?.title ?? 'Analytics that tell you what to do next'}
              </h2>

              {ANALYTICS_BLOCK ? (
                <p className="mt-5 text-base leading-relaxed text-pretty text-muted sm:text-lg">
                  {ANALYTICS_BLOCK.description}
                </p>
              ) : null}

              <ul className="mt-8 space-y-3.5">
                {(ANALYTICS_BLOCK?.bullets ?? []).map((bullet) => (
                  <li key={bullet} className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary-soft text-primary ring-1 ring-primary/20 ring-inset">
                      <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                    </span>
                    <span className="text-[0.9375rem] leading-relaxed text-pretty text-muted">
                      {bullet}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button asChild variant="primary" size="lg" rightIcon={<ArrowRight aria-hidden="true" />}>
                  <Link href="/product/analytics">Tour the analytics</Link>
                </Button>
                <Button asChild variant="ghost" size="lg">
                  <Link href="/dashboard/analytics">Open the live demo</Link>
                </Button>
              </div>

              <p className="mt-8 border-t border-line pt-6 text-sm leading-relaxed text-subtle">
                Other platforms hand you a report. EZRA Pro hands you a decision — with the
                slot, the number and the dollar impact already worked out.
              </p>
            </Reveal>
          </div>

          {/* ---------- Live analytics panel ---------- */}
          <div className="lg:col-span-7">
            <Reveal direction="up" blur duration={0.9} distance={28}>
              <AppFrame
                url="app.ezra.pro/blue-horizon/analytics"
                variant="dark"
                glow="reef"
                actions={
                  <span
                    aria-hidden="true"
                    className="hidden size-6 place-items-center rounded-full bg-surface-sunken text-xs font-bold text-subtle sm:grid"
                  >
                    KR
                  </span>
                }
              >
                <div ref={panelRef} className="space-y-3 p-3 sm:space-y-4 sm:p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-sm leading-tight font-semibold text-foreground">
                        Performance
                      </p>
                      <p className="truncate text-xs text-subtle">
                        Last 90 days · compared with the prior 90
                      </p>
                    </div>
                    <div
                      aria-hidden="true"
                      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-surface-sunken p-0.5"
                    >
                      {RANGE_PILLS.map((pill) => (
                        <span
                          key={pill}
                          className={cn(
                            'tabular rounded-md px-1.5 py-0.5 text-xs font-medium',
                            pill === '90d' ? 'bg-surface text-foreground shadow-xs' : 'text-subtle',
                          )}
                        >
                          {pill}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {KPIS.map(({ metric, accent }) =>
                      inView ? (
                        <StatCard
                          key={metric.key}
                          size="sm"
                          accent={accent}
                          compact={metric.format === 'currency'}
                          metric={{ ...metric, sparkline: [] }}
                        />
                      ) : (
                        <Skeleton key={metric.key} shape="block" className="h-[5.75rem] rounded-2xl" />
                      ),
                    )}
                  </div>

                  <RevenueAreaChart
                    points={POINTS}
                    metric="revenue"
                    currency="USD"
                    height={160}
                    showComparison
                    showAverage={false}
                    loading={!inView}
                    title="Revenue trend"
                    description="Daily gross against the same stretch last season."
                  />

                  <OccupancyHeatmap
                    cells={HEATMAP_CELLS}
                    currency="USD"
                    startHour={HEATMAP_START_HOUR}
                    endHour={HEATMAP_END_HOUR}
                    height={168}
                    loading={!inView}
                    title="Occupancy by day and time"
                    description="Where the seats actually sell — and where they do not."
                  />
                </div>
              </AppFrame>
            </Reveal>
          </div>
        </div>

        {/* ---------- Insights strip ---------- */}
        <div className="mt-14 sm:mt-16 lg:mt-20">
          <Reveal direction="up" className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold tracking-[0.1em] text-accent uppercase">
                <Lightbulb aria-hidden="true" className="size-3" />
                The part no one else ships
              </p>
              <h3 className="mt-4 font-display text-2xl leading-tight font-semibold tracking-[-0.025em] text-balance text-foreground sm:text-3xl">
                What EZRA Pro told this operator to do next
              </h3>
            </div>
            <Badge variant="neutral" className="shrink-0">
              Regenerated every Monday
            </Badge>
          </Reveal>

          <StaggerGroup as="ul" stagger={0.09} className="mt-7 grid gap-4 md:grid-cols-3">
            {INSIGHTS.map((insight) => {
              const tone = SEVERITY[insight.severity]
              const Icon = INSIGHT_ICON[insight.id] ?? Lightbulb

              return (
                <StaggerItem as="li" key={insight.id} className="min-w-0">
                  <article
                    className={cn(
                      'group/insight relative flex h-full flex-col overflow-hidden rounded-2xl',
                      'border border-line bg-surface p-5 shadow-sm sm:p-6',
                      'transition-[transform,box-shadow,border-color] duration-400 ease-[var(--ease-out-expo)]',
                      'hover:-translate-y-1 hover:border-line-strong',
                      'motion-reduce:transform-none motion-reduce:transition-none',
                      tone.glow,
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn('absolute inset-x-0 top-0 h-0.5', tone.rule)}
                    />

                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={cn(
                          'grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset',
                          tone.chip,
                        )}
                      >
                        <Icon aria-hidden="true" className="size-4.5" strokeWidth={1.9} />
                      </span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold tracking-[0.08em] uppercase ring-1 ring-inset',
                          tone.chip,
                        )}
                      >
                        {tone.label}
                      </span>
                    </div>

                    <p
                      className={cn(
                        'tabular mt-5 font-display text-3xl leading-none font-semibold tracking-[-0.03em]',
                        tone.metric,
                      )}
                    >
                      {insight.metric}
                    </p>

                    <h4 className="mt-3 text-balance text-[0.9375rem] leading-snug font-semibold text-foreground">
                      {insight.title}
                    </h4>
                    <p className="mt-2 flex-1 text-[0.8125rem] leading-relaxed text-pretty text-muted">
                      {insight.body}
                    </p>

                    {insight.href && insight.actionLabel ? (
                      <Link
                        href={insight.href}
                        className={cn(
                          'mt-5 inline-flex items-center gap-1.5 self-start rounded-md text-[0.8125rem] font-semibold text-primary',
                          'transition-colors duration-200 hover:text-primary-hover',
                        )}
                      >
                        {insight.actionLabel}
                        <ArrowRight
                          aria-hidden="true"
                          className="size-3.5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover/insight:translate-x-0.5 motion-reduce:transition-none"
                        />
                      </Link>
                    ) : null}
                  </article>
                </StaggerItem>
              )
            })}
          </StaggerGroup>
        </div>
      </div>
    </section>
  )
}
