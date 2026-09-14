'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, Award, Repeat2, Sparkles, UserPlus, Users } from 'lucide-react'

import { CohortGrid } from '@/components/charts/cohort-grid'
import { GeoBars, type GeoMetric } from '@/components/charts/geo-bars'
import { Sparkline } from '@/components/charts/sparkline'
import { ChartDeltaChip } from '@/components/charts/chart-container'
import { CountUp } from '@/components/motion/count-up'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { average, cn, formatNumber, formatPercent, sum } from '@/lib/utils'
import type { CohortRow, CurrencyCode, GeoSource, KpiMetric } from '@/types'

/* ==========================================================================
   RetentionSection

   Acquisition is the expensive half of this business; the cohort matrix is
   where an operator finds out whether the guests they bought last month are
   still worth anything this month.
   ========================================================================== */

type ComparisonMode = 'previous' | 'year'

const GEO_OPTIONS: { value: GeoMetric; label: string }[] = [
  { value: 'bookings', label: 'Bookings' },
  { value: 'revenue', label: 'Revenue' },
]

/** Pretty-prints the "YYYY-MM" cohort key the snapshot ships. */
function cohortLabel(key: string): string {
  const [year, month] = key.split('-').map(Number)
  if (!year || !month) return key
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
    new Date(year, month - 1, 1),
  )
}

interface LoyaltyRow {
  key: string
  icon: typeof Users
  label: string
  value: string
  detail: string
  tone: 'primary' | 'success' | 'info' | 'accent'
}

const TONE_CHIP: Record<LoyaltyRow['tone'], string> = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  info: 'bg-info-soft text-info',
  accent: 'bg-accent-soft text-accent',
}

export interface RetentionSectionProps {
  cohorts: CohortRow[]
  geo: GeoSource[]
  /** The `repeat_rate` KPI from the same snapshot. */
  repeatRate?: KpiMetric
  currency: CurrencyCode
  comparison: ComparisonMode
  rangeLabel: string
  loading?: boolean
  className?: string
}

export function RetentionSection({
  cohorts,
  geo,
  repeatRate,
  currency,
  comparison,
  rangeLabel,
  loading = false,
  className,
}: RetentionSectionProps) {
  const [geoMetric, setGeoMetric] = React.useState<GeoMetric>('bookings')

  const loyalty = React.useMemo(() => {
    const sized = cohorts.filter((c) => c.size > 0)
    if (sized.length === 0) return null

    const monthOne = sized
      .map((c) => c.retention[1])
      .filter((v): v is number => typeof v === 'number')
    const monthThree = sized
      .map((c) => c.retention[3])
      .filter((v): v is number => typeof v === 'number')

    const strongest = sized.reduce((best, row) =>
      (row.retention[1] ?? -1) > (best.retention[1] ?? -1) ? row : best,
    )
    const largest = sized.reduce((best, row) => (row.size > best.size ? row : best))
    const newest = sized[sized.length - 1]

    return {
      guests: sum(sized.map((c) => c.size)),
      monthOne: monthOne.length > 0 ? average(monthOne) : 0,
      monthThree: monthThree.length > 0 ? average(monthThree) : null,
      strongest,
      largest,
      newest,
      cohortCount: sized.length,
    }
  }, [cohorts])

  const rows = React.useMemo<LoyaltyRow[]>(() => {
    if (!loyalty) return []
    return [
      {
        key: 'guests',
        icon: Users,
        label: 'Guests acquired',
        value: formatNumber(loyalty.guests),
        detail: `First-time bookers across the last ${loyalty.cohortCount} monthly cohorts`,
        tone: 'primary',
      },
      {
        key: 'm1',
        icon: Repeat2,
        label: 'Month-1 retention',
        value: formatPercent(loyalty.monthOne, 1),
        detail: 'Share of a cohort that books again in the month after they joined',
        tone: 'success',
      },
      {
        key: 'm3',
        icon: Sparkles,
        label: 'Month-3 retention',
        value: loyalty.monthThree === null ? '—' : formatPercent(loyalty.monthThree, 1),
        detail:
          loyalty.monthThree === null
            ? 'Needs a cohort with four months behind it'
            : 'Where a seasonal guest base settles into its true repeat rate',
        tone: 'info',
      },
      {
        key: 'best',
        icon: Award,
        label: 'Strongest cohort',
        value: cohortLabel(loyalty.strongest.cohort),
        detail: `${formatNumber(loyalty.strongest.size)} guests, ${formatPercent(
          loyalty.strongest.retention[1] ?? 0,
          1,
        )} back the following month`,
        tone: 'accent',
      },
      {
        key: 'newest',
        icon: UserPlus,
        label: 'Newest cohort',
        value: formatNumber(loyalty.newest.size),
        detail: `${cohortLabel(loyalty.newest.cohort)} — still filling out, so its later columns are thin`,
        tone: 'primary',
      },
    ]
  }, [loyalty])

  const suppressed =
    comparison === 'year' || repeatRate?.comparisonLabel === 'no comparable prior period'

  return (
    <section className={cn('space-y-4', className)} aria-label="Guest retention and markets">
      <div className="grid gap-4 xl:grid-cols-3">
        {/* ---------- cohort matrix ---------- */}
        <div className="xl:col-span-2">
          <CohortGrid
            rows={cohorts}
            loading={loading}
            title="Guest retention by cohort"
            description="Each row is the month a guest first booked; each column is how many of them came back."
          />
        </div>

        {/* ---------- repeat guest rate ---------- */}
        <div className="flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Repeat guest rate</h3>
              <p className="mt-0.5 text-xs text-muted">{rangeLabel}</p>
            </div>
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-reef-400/12 text-info ring-1 ring-inset ring-reef-400/25">
              <Repeat2 aria-hidden="true" className="size-4" strokeWidth={1.9} />
            </span>
          </div>

          {loading || !repeatRate ? (
            <div className="mt-5 space-y-3">
              <Skeleton shape="block" className="h-10 w-32 rounded-lg" />
              <Skeleton shape="line" className="h-2.5 w-40" />
              <Skeleton shape="block" className="h-20 rounded-xl" />
            </div>
          ) : (
            <>
              <p className="mt-4 font-display text-[2.5rem] font-semibold leading-none tracking-[-0.035em] tabular-nums text-foreground">
                <CountUp value={repeatRate.value} format="percent" decimals={1} duration={1.1} />
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                {suppressed ? (
                  <span className="text-[0.6875rem] text-subtle">
                    — no comparable prior {comparison === 'year' ? 'year' : 'period'}
                  </span>
                ) : (
                  <>
                    <ChartDeltaChip
                      value={repeatRate.deltaPercent}
                      higherIsBetter={repeatRate.higherIsBetter}
                      size="sm"
                    />
                    <span className="text-[0.6875rem] text-subtle">
                      {repeatRate.comparisonLabel}
                    </span>
                  </>
                )}
              </div>

              {repeatRate.sparkline.length > 1 ? (
                <div className="mt-5 rounded-xl border border-line-subtle bg-surface-sunken/60 p-3">
                  <Sparkline
                    values={repeatRate.sparkline}
                    width={320}
                    height={76}
                    color="var(--chart-3)"
                    fill
                    showLastDot
                    strokeWidth={2}
                    className="h-auto w-full"
                    ariaLabel={`Repeat guest rate trend across ${rangeLabel.toLowerCase()}, ending at ${formatPercent(
                      repeatRate.value,
                      1,
                    )}.`}
                  />
                  <div className="mt-2 flex items-center justify-between text-[0.625rem] uppercase tracking-[0.06em] text-faint">
                    <span>Start of range</span>
                    <span>Today</span>
                  </div>
                </div>
              ) : null}

              <p className="mt-4 text-xs leading-relaxed text-subtle">
                {repeatRate.hint}
                {loyalty
                  ? ` Across the last ${loyalty.cohortCount} cohorts, ${formatPercent(
                      loyalty.monthOne,
                      1,
                    )} of new guests book again within a month.`
                  : ''}
              </p>

              <Link
                href="/dashboard/customers"
                className="mt-auto inline-flex items-center gap-1 pt-4 text-[0.8125rem] font-semibold text-primary transition-colors hover:text-primary-hover"
              >
                Open the guest list
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {/* ---------- source markets ---------- */}
        <div className="xl:col-span-2">
          <GeoBars
            sources={geo}
            metric={geoMetric}
            currency={currency}
            limit={8}
            loading={loading}
            title="Source markets"
            description="Where your guests are travelling from — the input to every paid-acquisition decision."
            toolbar={
              <Segmented
                size="sm"
                label="Market metric"
                value={geoMetric}
                onValueChange={(next) => setGeoMetric(next)}
                options={GEO_OPTIONS}
              />
            }
          />
        </div>

        {/* ---------- loyalty snapshot ---------- */}
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">Loyalty snapshot</h3>
          <p className="mt-0.5 text-xs text-muted">
            Read straight off the cohort matrix beside it.
          </p>

          {loading || rows.length === 0 ? (
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} shape="block" className="h-14 rounded-xl" />
              ))}
            </div>
          ) : (
            <dl className="mt-4 space-y-2">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="flex items-start gap-3 rounded-xl border border-line-subtle bg-surface-sunken/45 p-3 transition-colors hover:border-line hover:bg-surface-sunken"
                >
                  <span
                    className={cn(
                      'mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg',
                      TONE_CHIP[row.tone],
                    )}
                  >
                    <row.icon aria-hidden="true" className="size-3.5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <dt className="truncate text-xs font-medium text-muted">{row.label}</dt>
                      <dd className="shrink-0 text-[0.8125rem] font-semibold tabular-nums text-foreground">
                        {row.value}
                      </dd>
                    </div>
                    <p className="mt-1 text-[0.6875rem] leading-relaxed text-subtle">
                      {row.detail}
                    </p>
                  </div>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </section>
  )
}
