'use client'

import * as React from 'react'
import { motion } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  ChartPie,
  Filter,
  Gauge,
  LayoutDashboard,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react'

import { PageHeader } from '@/components/dashboard/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Segmented } from '@/components/ui/segmented'
import { IconButton } from '@/components/ui/icon-button'
import { DateRangePicker, formatRangeLabel, rangeForPreset } from '@/components/ui/date-range-picker'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toaster'

import { KpiGrid } from './kpi-grid'
import { RevenueSection } from './revenue-section'
import { ChannelSection } from './channel-section'
import { OccupancySection } from './occupancy-section'
import { FunnelSection } from './funnel-section'
import { RetentionSection } from './retention-section'
import { InsightsBoard } from './insights-board'
import { ExportMenu } from './export-menu'

import { CURRENT_TENANT, CURRENT_USER, NOW, TODAY_KEY } from '@/lib/demo-core'
import { fetchAnalytics } from '@/lib/actions/dashboard'
import { cn, formatNumber, sum } from '@/lib/utils'
import type { AnalyticsSnapshot, DateRange, RangePreset } from '@/types'

/* ==========================================================================
   AnalyticsShell

   Owns the two pieces of state the whole screen is a function of — the range
   and the comparison basis — and hands the resulting snapshot down. Changing
   either flashes a short skeleton before the new numbers land, because an
   instant swap reads as a static mock rather than a recomputation.
   ========================================================================== */

export type ComparisonMode = 'previous' | 'year'

type TabKey = 'overview' | 'revenue' | 'channels' | 'occupancy' | 'funnel' | 'retention'

const TABS: { value: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'revenue', label: 'Revenue', icon: TrendingUp },
  { value: 'channels', label: 'Channels', icon: ChartPie },
  { value: 'occupancy', label: 'Occupancy', icon: Gauge },
  { value: 'funnel', label: 'Funnel', icon: Filter },
  { value: 'retention', label: 'Retention', icon: Users },
]

const COMPARISON_OPTIONS: { value: ComparisonMode; label: string }[] = [
  { value: 'previous', label: 'vs previous' },
  { value: 'year', label: 'vs last year' },
]

/* `today` is deliberately absent — a one-day analytics range is a manifest, not a trend. */
const RANGE_PRESETS: RangePreset[] = ['7d', '30d', '90d', 'mtd', 'qtd', 'ytd']

/** Height of the sticky dashboard header the tab rail parks beneath. */
const HEADER_OFFSET = 56

/** Each tab mounts fresh, so a short rise-in makes the switch read as a new page. */
function TabPane({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotionSafe()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}

function SectionLabel({ eyebrow, title, hint }: { eyebrow: string; title: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-2">
      <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-primary">
        {eyebrow}
      </span>
      <h2 className="font-display text-base font-semibold tracking-[-0.02em] text-foreground">
        {title}
      </h2>
      <p className="text-xs text-subtle">{hint}</p>
    </div>
  )
}

export interface AnalyticsShellProps {
  /** The 30-day snapshot, computed on the server. Other ranges load via a Server Action. */
  initialSnapshot: AnalyticsSnapshot
}

export function AnalyticsShell({ initialSnapshot }: AnalyticsShellProps) {
  const tenant = CURRENT_TENANT
  const reduceMotion = useReducedMotionSafe()

  const [preset, setPreset] = React.useState<RangePreset>('30d')
  const [range, setRange] = React.useState<DateRange>(
    () => rangeForPreset('30d', NOW) ?? { from: TODAY_KEY, to: TODAY_KEY },
  )
  const [comparison, setComparison] = React.useState<ComparisonMode>('previous')
  const [tab, setTab] = React.useState<TabKey>('overview')
  const [pending, setPending] = React.useState(false)
  const [nonce, setNonce] = React.useState(0)

  const railRef = React.useRef<HTMLDivElement>(null)
  const firstRun = React.useRef(true)

  const [snapshots, setSnapshots] = React.useState<Partial<Record<RangePreset, AnalyticsSnapshot>>>({
    '30d': initialSnapshot,
  })
  React.useEffect(() => {
    if (snapshots[preset]) return
    let cancelled = false
    fetchAnalytics(tenant.id, preset).then((next) => {
      if (!cancelled) setSnapshots((prev) => ({ ...prev, [preset]: next }))
    })
    return () => {
      cancelled = true
    }
  }, [preset, tenant.id, snapshots])
  // Fall back to the last loaded snapshot while a new range is in flight.
  const snapshot = snapshots[preset] ?? initialSnapshot

  /* A short, deliberate settle so a range change reads as a recomputation. */
  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    setPending(true)
    const timer = window.setTimeout(() => setPending(false), 420)
    return () => window.clearTimeout(timer)
  }, [preset, range.from, range.to, comparison, nonce])

  const kpiByKey = React.useMemo(
    () => new Map(snapshot.kpis.map((metric) => [metric.key, metric])),
    [snapshot],
  )

  const rangeLabel = preset === 'custom' ? formatRangeLabel(range) : snapshot.rangeLabel
  const totalBookings = React.useMemo(
    () => sum(snapshot.timeseries.map((point) => point.bookings)),
    [snapshot],
  )

  const occupancy = kpiByKey.get('occupancy')?.value ?? 0
  const aov = kpiByKey.get('aov')?.value ?? 0
  const repeatRate = kpiByKey.get('repeat_rate')

  const handleRangeChange = React.useCallback((next: DateRange, nextPreset: RangePreset) => {
    setRange(next)
    setPreset(nextPreset)
  }, [])

  const handleTabChange = React.useCallback(
    (value: string) => {
      setTab(value as TabKey)
      // Jumping from the long overview into a focused tab otherwise strands the
      // reader half-way down an empty page.
      window.requestAnimationFrame(() => {
        const rail = railRef.current
        if (!rail) return
        const top = rail.getBoundingClientRect().top
        if (top < HEADER_OFFSET - 1 || top > window.innerHeight * 0.6) {
          window.scrollTo({
            top: window.scrollY + top - HEADER_OFFSET,
            behavior: reduceMotion ? 'auto' : 'smooth',
          })
        }
      })
    },
    [reduceMotion],
  )

  const handleRefresh = React.useCallback(() => {
    setNonce((n) => n + 1)
    toast.success('Analytics recomputed', {
      description: `Rebuilt from every booking, departure and payment through ${TODAY_KEY}.`,
    })
  }, [])

  /* ---------- sections ---------- */

  const revenue = (
    <RevenueSection
      points={snapshot.timeseries}
      currency={tenant.currency}
      comparison={comparison}
      rangeLabel={rangeLabel}
      loading={pending}
    />
  )

  const channels = (
    <ChannelSection
      channels={snapshot.channels}
      currency={tenant.currency}
      rangeLabel={rangeLabel}
      loading={pending}
    />
  )

  const occupancySection = (
    <OccupancySection
      heatmap={snapshot.heatmap}
      topActivities={snapshot.topActivities}
      utilisation={occupancy}
      currency={tenant.currency}
      rangeLabel={rangeLabel}
      loading={pending}
    />
  )

  const funnel = (
    <FunnelSection
      stages={snapshot.funnel}
      aov={aov}
      currency={tenant.currency}
      rangeLabel={rangeLabel}
      loading={pending}
    />
  )

  const retention = (
    <RetentionSection
      cohorts={snapshot.cohorts}
      geo={snapshot.geo}
      repeatRate={repeatRate}
      currency={tenant.currency}
      comparison={comparison}
      rangeLabel={rangeLabel}
      loading={pending}
    />
  )

  const insights = (
    <InsightsBoard insights={snapshot.insights} rangeLabel={rangeLabel} loading={pending} />
  )

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`Where ${tenant.name}'s money comes from, where it leaks, and what to change next.`}
        actions={
          <>
            <Segmented
              size="sm"
              label="Comparison basis"
              value={comparison}
              onValueChange={(next) => setComparison(next)}
              options={COMPARISON_OPTIONS}
            />
            <DateRangePicker
              value={range}
              preset={preset}
              onChange={handleRangeChange}
              referenceDate={NOW}
              presets={RANGE_PRESETS}
              label="Change analytics date range"
            />
            <SimpleTooltip label="Recompute from the latest bookings">
              <IconButton
                variant="secondary"
                size="sm"
                aria-label="Recompute analytics"
                onClick={handleRefresh}
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn(pending && 'animate-spin motion-reduce:animate-none')}
                />
              </IconButton>
            </SimpleTooltip>
            <ExportMenu rangeLabel={rangeLabel} recipient={CURRENT_USER.email} />
          </>
        }
      />

      <Tabs value={tab} onValueChange={handleTabChange} variant="underline" className="gap-6">
        {/* ---------- sticky rail ---------- */}
        <div
          ref={railRef}
          className="sticky top-14 z-20 -mx-4 border-b border-line bg-background/85 px-4 backdrop-blur-xl lg:-mx-6 lg:px-6"
        >
          <div className="flex items-end justify-between gap-4">
            <TabsList aria-label="Analytics sections" className="min-w-0 flex-1">
              {TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value}>
                  <Icon aria-hidden="true" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <p className="hidden shrink-0 pb-2 text-[0.6875rem] tabular-nums text-faint lg:block">
              {formatNumber(snapshot.timeseries.length)} days ·{' '}
              {formatNumber(totalBookings)} bookings analysed
            </p>
          </div>
        </div>

        {/* ---------- KPI band — always on, whichever tab is open ---------- */}
        <KpiGrid
          kpis={snapshot.kpis}
          currency={tenant.currency}
          comparison={comparison}
          loading={pending}
        />

        {/* ---------- panels ---------- */}
        <TabsContent value="overview">
          <TabPane>
            <div className="space-y-6">
              {insights}
              <div className="space-y-4">
                <SectionLabel
                  eyebrow="Revenue"
                  title="What you sold"
                  hint="Daily net revenue against the period before it — channels, occupancy, funnel and retention each have their own tab"
                />
                {revenue}
              </div>
            </div>
          </TabPane>
        </TabsContent>

        <TabsContent value="revenue"><TabPane>{revenue}</TabPane></TabsContent>
        <TabsContent value="channels"><TabPane>{channels}</TabPane></TabsContent>
        <TabsContent value="occupancy"><TabPane>{occupancySection}</TabPane></TabsContent>
        <TabsContent value="funnel"><TabPane>{funnel}</TabPane></TabsContent>
        <TabsContent value="retention"><TabPane>{retention}</TabPane></TabsContent>
      </Tabs>
    </>
  )
}
