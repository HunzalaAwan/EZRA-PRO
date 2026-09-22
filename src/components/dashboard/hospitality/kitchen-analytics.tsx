'use client'

import * as React from 'react'
import Image from 'next/image'
import { motion } from 'motion/react'
import { BedDouble, Bike, Clock, ImageOff, LayoutDashboard, RefreshCw, ShoppingBag, Star, TrendingUp, Users, UtensilsCrossed } from 'lucide-react'

import { ExportMenu } from '@/components/dashboard/analytics/export-menu'
import { InsightsBoard } from '@/components/dashboard/analytics/insights-board'
import { KpiGrid } from '@/components/dashboard/analytics/kpi-grid'
import { PageHeader } from '@/components/dashboard/page-header'
import { useWorkspace } from '@/components/dashboard/workspace-provider'
import { ChartContainer, ChartDeltaChip, ChartLegend } from '@/components/charts/chart-container'
import { OccupancyHeatmap } from '@/components/charts/occupancy-heatmap'
import { RevenueAreaChart } from '@/components/charts/revenue-area-chart'
import { Avatar } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/ui/data-table'
import { DateRangePicker, formatRangeLabel, rangeForPreset } from '@/components/ui/date-range-picker'
import { IconButton } from '@/components/ui/icon-button'
import { Segmented } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toaster'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { fetchKitchenAnalytics } from '@/lib/actions/dashboard'
import { CURRENT_USER, NOW, TODAY_KEY } from '@/lib/demo-core'
import type { DishRow, KitchenSnapshot } from '@/lib/hospitality/analytics'
import type { OrderType } from '@/lib/hospitality/types'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import type { CurrencyCode, DateRange, RangePreset } from '@/types'

import { guestName } from './format'

/* ==========================================================================
   <KitchenAnalytics> — analytics for a kitchen.

   Orders, tickets, minutes on the pass, what sold and who came back, over a
   range. No seats, no departures, no channel league table: the money a
   restaurant steers on is the order mix, the busy hours, the dishes and
   what the delivery platforms keep.
   ========================================================================== */

type TabKey = 'overview' | 'revenue' | 'orders' | 'menu' | 'timing' | 'guests'

const TABS: { value: TabKey; label: string; icon: typeof LayoutDashboard }[] = [
  { value: 'overview', label: 'Overview', icon: LayoutDashboard },
  { value: 'revenue', label: 'Revenue', icon: TrendingUp },
  { value: 'orders', label: 'Orders', icon: ShoppingBag },
  { value: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { value: 'timing', label: 'Timing', icon: Clock },
  { value: 'guests', label: 'Guests', icon: Users },
]

const RANGE_PRESETS: RangePreset[] = ['7d', '30d', '90d', 'mtd', 'qtd', 'ytd']
const HEADER_OFFSET = 56
const TYPE_ICON: Record<OrderType, typeof ShoppingBag> = { pickup: ShoppingBag, delivery: Bike, dine_in: BedDouble }

function TabPane({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotionSafe()
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
      {children}
    </motion.div>
  )
}

export interface KitchenAnalyticsProps {
  initialSnapshot: KitchenSnapshot
}

export function KitchenAnalytics({ initialSnapshot }: KitchenAnalyticsProps) {
  const { tenant } = useWorkspace()
  const reduceMotion = useReducedMotionSafe()
  const currency = tenant.currency

  const [preset, setPreset] = React.useState<RangePreset>('30d')
  const [range, setRange] = React.useState<DateRange>(() => rangeForPreset('30d', NOW) ?? { from: TODAY_KEY, to: TODAY_KEY })
  const [tab, setTab] = React.useState<TabKey>('overview')
  const [pending, setPending] = React.useState(false)
  const [nonce, setNonce] = React.useState(0)
  const [shadow, setShadow] = React.useState(true)
  const railRef = React.useRef<HTMLDivElement>(null)
  const firstRun = React.useRef(true)

  const [snapshots, setSnapshots] = React.useState<Partial<Record<RangePreset, KitchenSnapshot>>>({ '30d': initialSnapshot })
  React.useEffect(() => {
    if (snapshots[preset]) return
    let cancelled = false
    fetchKitchenAnalytics(tenant.id, preset).then((next) => {
      if (!cancelled) setSnapshots((prev) => ({ ...prev, [preset]: next }))
    })
    return () => {
      cancelled = true
    }
  }, [preset, tenant.id, snapshots])
  const snapshot = snapshots[preset] ?? initialSnapshot

  React.useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    setPending(true)
    const timer = window.setTimeout(() => setPending(false), 420)
    return () => window.clearTimeout(timer)
  }, [preset, range.from, range.to, nonce])

  const rangeLabel = preset === 'custom' ? formatRangeLabel(range) : snapshot.rangeLabel

  const handleTabChange = React.useCallback(
    (value: string) => {
      setTab(value as TabKey)
      window.requestAnimationFrame(() => {
        const rail = railRef.current
        if (!rail) return
        const top = rail.getBoundingClientRect().top
        if (top < HEADER_OFFSET - 1 || top > window.innerHeight * 0.6) window.scrollTo({ top: window.scrollY + top - HEADER_OFFSET, behavior: reduceMotion ? 'auto' : 'smooth' })
      })
    },
    [reduceMotion],
  )

  const t = snapshot.totals
  const typeLegend = snapshot.types.map((row) => ({ key: row.type, label: row.label, color: row.color }))

  return (
    <>
      <PageHeader
        title="Analytics"
        description={`What ${tenant.name}'s kitchen took, when the pass was busiest, what sold and who came back.`}
        actions={
          <>
            <DateRangePicker
              value={range}
              preset={preset}
              onChange={(next, nextPreset) => {
                setRange(next)
                setPreset(nextPreset)
              }}
              referenceDate={NOW}
              presets={RANGE_PRESETS}
              label="Change analytics date range"
            />
            <SimpleTooltip label="Recompute from the latest orders">
              <IconButton
                variant="secondary"
                size="sm"
                aria-label="Recompute analytics"
                onClick={() => {
                  setNonce((n) => n + 1)
                  toast.success('Analytics recomputed', { description: `Rebuilt from every order and refund through ${TODAY_KEY}.` })
                }}
              >
                <RefreshCw aria-hidden="true" className={cn(pending && 'animate-spin motion-reduce:animate-none')} />
              </IconButton>
            </SimpleTooltip>
            <ExportMenu rangeLabel={rangeLabel} recipient={CURRENT_USER.email} />
          </>
        }
      />

      <Tabs value={tab} onValueChange={handleTabChange} variant="underline" className="gap-6">
        <div ref={railRef} className="sticky top-14 z-20 -mx-4 border-b border-line bg-background/85 px-4 backdrop-blur-xl lg:-mx-6 lg:px-6">
          <div className="flex items-end justify-between gap-4">
            <TabsList aria-label="Analytics sections" className="min-w-0 flex-1">
              {TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger key={value} value={value}>
                  <Icon aria-hidden="true" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
            <p className="hidden shrink-0 pb-2 text-xs text-faint tabular-nums lg:block">
              {formatNumber(snapshot.days)} days · {formatNumber(t.orders)} orders analysed
            </p>
          </div>
        </div>

        <KpiGrid kpis={snapshot.kpis} currency={currency} comparison="previous" loading={pending} />

        {/* ---------- overview ---------- */}
        <TabsContent value="overview">
          <TabPane>
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-3">
                <RevenueAreaChart
                  points={snapshot.timeseries}
                  metric="revenue"
                  currency={currency}
                  showComparison={shadow}
                  showAverage
                  height={340}
                  loading={pending}
                  title="Net revenue"
                  description={shadow ? `${rangeLabel}, with the previous period shadowed behind it` : rangeLabel}
                  toolbar={<Segmented size="sm" label="Comparison" options={[{ value: 'on', label: 'Shadow previous' }, { value: 'off', label: 'Plain' }]} value={shadow ? 'on' : 'off'} onValueChange={(v) => setShadow(v === 'on')} />}
                  className="xl:col-span-2"
                />
                <MixCard snapshot={snapshot} currency={currency} loading={pending} />
              </div>
              <div className="grid gap-4 xl:grid-cols-3">
                <ChartContainer title="Peak hours" description={`Orders an hour on an average day · ${rangeLabel}`} height={240} loading={pending} className="xl:col-span-2" ariaLabel="Average orders per hour of the day." footer={<PeakFooter snapshot={snapshot} />}>
                  <HourBars rows={snapshot.hours.filter((h) => h.orders > 0).map((h) => ({ hour: h.hour, value: Math.round((h.orders / snapshot.days) * 10) / 10 }))} format={(v) => `${v} an hour`} color="var(--chart-1)" fromZero />
                </ChartContainer>
                <LeaksCard snapshot={snapshot} currency={currency} loading={pending} />
              </div>
              <DishesCard dishes={snapshot.dishes.slice(0, 8)} categories={snapshot.categories} currency={currency} rangeLabel={rangeLabel} loading={pending} compact />
              <InsightsBoard insights={snapshot.insights} rangeLabel={rangeLabel} loading={pending} />
            </div>
          </TabPane>
        </TabsContent>

        {/* ---------- revenue ---------- */}
        <TabsContent value="revenue">
          <TabPane>
            <div className="space-y-4">
              <RevenueAreaChart points={snapshot.timeseries} metric="revenue" currency={currency} showComparison showAverage height={360} loading={pending} title="Net revenue a day" description={`${rangeLabel} · previous period dashed`} />
              <div className="grid gap-4 xl:grid-cols-3">
                <ChartContainer title="Revenue by weekday" description="An average day of each kind, by how the order arrived" height={240} loading={pending} legend={<ChartLegend items={typeLegend} />} className="xl:col-span-2" ariaLabel={`Average daily revenue by weekday, split by ${snapshot.types.map((r) => r.label).join(', ')}.`}>
                  <StackedColumns groups={snapshot.weekdays.map((w) => ({ label: w.label, values: w.revenue as Record<string, number> }))} series={typeLegend} format={(v) => formatCurrency(v, currency, { compact: true })} />
                </ChartContainer>
                <MoneyCard snapshot={snapshot} currency={currency} loading={pending} />
              </div>
            </div>
          </TabPane>
        </TabsContent>

        {/* ---------- orders ---------- */}
        <TabsContent value="orders">
          <TabPane>
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-3">
                <ChartContainer title="Orders a day" description={`${rangeLabel}, by how the order arrived`} height={260} loading={pending} legend={<ChartLegend items={typeLegend} />} className="xl:col-span-2" ariaLabel="Orders per day split by type.">
                  <DailyColumns snapshot={snapshot} series={typeLegend} />
                </ChartContainer>
                <MixCard snapshot={snapshot} currency={currency} loading={pending} />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <SourcesCard snapshot={snapshot} currency={currency} loading={pending} />
                <ZonesCard snapshot={snapshot} currency={currency} loading={pending} />
              </div>
            </div>
          </TabPane>
        </TabsContent>

        {/* ---------- menu ---------- */}
        <TabsContent value="menu">
          <TabPane>
            <div className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-3">
                <ChartContainer title="Sections" description="Share of dish revenue" height={Math.max(160, snapshot.categories.length * 50)} loading={pending} semantic ariaLabel="Revenue share by menu section.">
                  <HBars rows={snapshot.categories.map((c) => ({ label: c.name, value: c.revenue, hint: `${formatNumber(c.portions)} portions · ${c.share}%` }))} format={(v) => formatCurrency(v, currency, { compact: true })} />
                </ChartContainer>
                <SlowMoversCard dishes={snapshot.dishes} currency={currency} loading={pending} className="xl:col-span-2" />
              </div>
              <DishesCard dishes={snapshot.dishes} categories={snapshot.categories} currency={currency} rangeLabel={rangeLabel} loading={pending} />
            </div>
          </TabPane>
        </TabsContent>

        {/* ---------- timing ---------- */}
        <TabsContent value="timing">
          <TabPane>
            <div className="space-y-4">
              <OccupancyHeatmap cells={snapshot.heatmap} currency={currency} measureLabel="Share of peak" startHour={7} endHour={23} height={300} title="Busy hours" description="Average orders an hour, by weekday. The darker the cell, the fuller the pass." loading={pending} />
              <div className="grid gap-4 xl:grid-cols-2">
                <ChartContainer title="Kitchen time through the day" description="Average minutes from placed to ready, by the hour the order came in" height={220} loading={pending} ariaLabel="Average kitchen minutes by hour of day.">
                  <HourBars rows={snapshot.hours.filter((h) => h.orders > 0).map((h) => ({ hour: h.hour, value: h.prepMinutes }))} format={(v) => `${v} min`} color="var(--chart-3)" />
                </ChartContainer>
                <ChartContainer title="Late orders by weekday" description="Share of orders that missed the promised time" height={220} loading={pending} ariaLabel="Late order rate by weekday.">
                  <StackedColumns groups={snapshot.weekdays.map((w) => ({ label: w.label, values: { late: w.lateRate } }))} series={[{ key: 'late', label: 'Late', color: 'var(--chart-6)' }]} format={(v) => `${v}%`} />
                </ChartContainer>
              </div>
            </div>
          </TabPane>
        </TabsContent>

        {/* ---------- guests ---------- */}
        <TabsContent value="guests">
          <TabPane>
            <div className="grid gap-4 xl:grid-cols-3">
              <ChartContainer title="New and returning" description="Orders a week, by whether the guest had ordered before" height={260} loading={pending} legend={<ChartLegend items={[{ key: 'returningGuests', label: 'Returning', color: 'var(--chart-1)' }, { key: 'newGuests', label: 'New', color: 'var(--chart-4)' }]} />} className="xl:col-span-2" ariaLabel="Weekly orders from new and returning guests.">
                <StackedColumns groups={snapshot.weeks.map((w) => ({ label: w.label, values: { returningGuests: w.returningGuests, newGuests: w.newGuests } }))} series={[{ key: 'returningGuests', label: 'Returning', color: 'var(--chart-1)' }, { key: 'newGuests', label: 'New', color: 'var(--chart-4)' }]} format={(v) => formatNumber(v)} />
              </ChartContainer>
              <RatingCard ratings={snapshot.ratings} loading={pending} />
              <Card className="min-w-0 xl:col-span-3">
                <CardHeader>
                  <CardTitle className="text-sm">Regulars</CardTitle>
                  <CardDescription>Who ordered most in the range.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {pending ? (
                    <div className="flex flex-col gap-3 px-5 pb-5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} shape="line" className="h-8 w-full" />
                      ))}
                    </div>
                  ) : (
                    <ul className="grid divide-y divide-line-subtle border-t border-line-subtle sm:grid-cols-2 sm:divide-y-0 sm:[&>li:nth-child(n+3)]:border-t sm:[&>li:nth-child(odd)]:border-r sm:[&>li]:border-line-subtle">
                      {snapshot.topGuests.map((g) => (
                        <li key={g.customer.id} className="flex items-center gap-3 px-5 py-2.5 text-[0.8125rem]">
                          <Avatar name={guestName(g.customer)} src={g.customer.avatarUrl} size="xs" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-foreground">{guestName(g.customer)}</span>
                            <span className="block truncate text-xs text-subtle">{g.favourite}</span>
                          </span>
                          <span className="shrink-0 text-right tabular-nums">
                            <span className="block text-foreground">{formatCurrency(g.spend, currency, { compact: true })}</span>
                            <span className="block text-xs text-subtle">{g.orders} orders</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabPane>
        </TabsContent>
      </Tabs>
    </>
  )
}

/* --------------------------------------------------------------------------
   Cards
   -------------------------------------------------------------------------- */

function MixCard({ snapshot, currency, loading }: { snapshot: KitchenSnapshot; currency: CurrencyCode; loading: boolean }) {
  const total = snapshot.types.reduce((s, r) => s + r.orders, 0) || 1
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-sm">Order mix</CardTitle>
        <CardDescription>How guests got their food.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading ? (
          <Skeleton shape="block" className="h-32 w-full rounded-xl" />
        ) : (
          <>
            <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label={snapshot.types.map((r) => `${r.label} ${r.share}%`).join(', ')}>
              {snapshot.types.map((r) => (
                <span key={r.type} className="h-full" style={{ width: `${(r.orders / total) * 100}%`, background: r.color }} />
              ))}
            </div>
            <ul className="flex flex-col gap-3">
              {snapshot.types.map((r) => {
                const Icon = TYPE_ICON[r.type]
                return (
                  <li key={r.type} className="flex items-center gap-3 text-[0.8125rem]">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden="true" />
                    <Icon className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-foreground">{r.label}</span>
                    <span className="shrink-0 text-right tabular-nums">
                      <span className="block text-foreground">
                        {r.share}% <span className="text-subtle">· {formatNumber(r.orders)}</span>
                      </span>
                      <span className="block text-xs text-subtle">{formatCurrency(r.avgOrder, currency)} an order</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            <dl className="grid grid-cols-3 gap-3 border-t border-line-subtle pt-3">
              <div>
                <dt className="text-xs text-subtle">Dishes an order</dt>
                <dd className="mt-0.5 text-[0.9375rem] font-medium text-foreground tabular-nums">{snapshot.totals.orders ? (snapshot.totals.items / snapshot.totals.orders).toFixed(1) : '—'}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Average order</dt>
                <dd className="mt-0.5 text-[0.9375rem] font-medium text-foreground tabular-nums">{formatCurrency(snapshot.totals.orders ? Math.round(snapshot.totals.revenue / snapshot.totals.orders) : 0, currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Tips an order</dt>
                <dd className="mt-0.5 text-[0.9375rem] font-medium text-foreground tabular-nums">{formatCurrency(snapshot.totals.orders ? Math.round(snapshot.totals.tips / snapshot.totals.orders) : 0, currency)}</dd>
              </div>
            </dl>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function LeaksCard({ snapshot, currency, loading }: { snapshot: KitchenSnapshot; currency: CurrencyCode; loading: boolean }) {
  const t = snapshot.totals
  const rows = [
    { label: 'Late orders', value: formatNumber(t.late), hint: `${t.orders ? Math.round((t.late / t.orders) * 1000) / 10 : 0}% of orders`, tone: 'bg-warning' },
    { label: 'Cancelled', value: formatNumber(t.cancelled), hint: `${t.orders ? Math.round((t.cancelled / t.orders) * 1000) / 10 : 0}% of orders`, tone: 'bg-line-strong' },
    { label: 'Refunded', value: formatCurrency(t.refundAmount, currency, { compact: true }), hint: `${formatNumber(t.refunds)} orders`, tone: 'bg-danger' },
    { label: 'Platform commission', value: formatCurrency(t.platformFees, currency, { compact: true }), hint: 'Wolt, Uber Eats, Deliveroo', tone: 'bg-danger' },
    { label: 'Discounts', value: formatCurrency(t.discounts, currency, { compact: true }), hint: 'Codes and goodwill', tone: 'bg-line-strong' },
  ]
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-sm">Where it leaks</CardTitle>
        <CardDescription>What did not reach the till.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col gap-3 px-5 pb-5">
            {rows.map((r) => (
              <Skeleton key={r.label} shape="line" className="h-6 w-full" />
            ))}
          </div>
        ) : (
          <dl className="divide-y divide-line-subtle border-t border-line-subtle">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center gap-3 px-5 py-2.5 text-[0.8125rem]">
                <span className={cn('size-2 shrink-0 rounded-full', r.tone)} aria-hidden="true" />
                <dt className="min-w-0 flex-1">
                  <span className="block truncate text-foreground">{r.label}</span>
                  <span className="block truncate text-xs text-subtle">{r.hint}</span>
                </dt>
                <dd className="shrink-0 text-foreground tabular-nums">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

function MoneyCard({ snapshot, currency, loading }: { snapshot: KitchenSnapshot; currency: CurrencyCode; loading: boolean }) {
  const t = snapshot.totals
  const net = t.revenue - t.refundAmount
  const rows = [
    { label: 'Taken', value: t.revenue },
    { label: 'Refunds', value: -t.refundAmount },
    { label: 'Net revenue', value: net, strong: true },
    { label: 'Tips passed on', value: t.tips },
    { label: 'Platform commission', value: -t.platformFees },
    { label: 'Discounts given', value: -t.discounts },
  ]
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-sm">The money</CardTitle>
        <CardDescription>{snapshot.rangeLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton shape="block" className="h-40 w-full rounded-xl" />
        ) : (
          <dl className="flex flex-col gap-2 text-[0.8125rem]">
            {rows.map((r) => (
              <div key={r.label} className={cn('flex items-center justify-between gap-3', r.strong && 'border-t border-line-subtle pt-2 font-medium')}>
                <dt className={r.strong ? 'text-foreground' : 'text-muted'}>{r.label}</dt>
                <dd className={cn('tabular-nums', r.value < 0 ? 'text-danger' : 'text-foreground')}>
                  {r.value < 0 ? '−' : ''}
                  {formatCurrency(Math.abs(r.value), currency)}
                </dd>
              </div>
            ))}
            <p className="pt-2 text-xs text-subtle">
              {formatCurrency(t.orders ? Math.round(net / t.orders) : 0, currency)} an order · {formatCurrency(snapshot.days ? Math.round(net / snapshot.days) : 0, currency, { compact: true })} a day
            </p>
          </dl>
        )}
      </CardContent>
    </Card>
  )
}

function SourcesCard({ snapshot, currency, loading }: { snapshot: KitchenSnapshot; currency: CurrencyCode; loading: boolean }) {
  const fees = snapshot.sources.reduce((s, r) => s + r.fees, 0)
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-sm">Where orders came in</CardTitle>
        <CardDescription>Your storefront and phone against the delivery platforms, and what each one keeps.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col gap-3 px-5 pb-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} shape="line" className="h-7 w-full" />
            ))}
          </div>
        ) : (
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="border-y border-line-subtle text-left text-xs text-subtle">
                <th className="px-5 py-2 font-medium">Source</th>
                <th className="px-3 py-2 text-right font-medium">Orders</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Share</th>
                <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Avg order</th>
                <th className="px-3 py-2 text-right font-medium">Keeps</th>
                <th className="px-5 py-2 text-right font-medium">Fees</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {snapshot.sources.map((r) => (
                <tr key={r.source}>
                  <td className="px-5 py-2.5 text-foreground">{r.label}</td>
                  <td className="px-3 py-2.5 text-right text-foreground tabular-nums">{formatNumber(r.orders)}</td>
                  <td className="hidden px-3 py-2.5 text-right text-muted tabular-nums sm:table-cell">{r.share}%</td>
                  <td className="hidden px-3 py-2.5 text-right text-muted tabular-nums md:table-cell">{formatCurrency(r.avgOrder, currency)}</td>
                  <td className="px-3 py-2.5 text-right text-muted tabular-nums">{r.commission ? `${r.commission}%` : '—'}</td>
                  <td className={cn('px-5 py-2.5 text-right tabular-nums', r.commission >= 20 ? 'text-danger' : 'text-muted')}>{r.fees ? formatCurrency(r.fees, currency, { compact: true }) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line-subtle text-xs text-subtle">
                <td className="px-5 py-2" colSpan={5}>
                  Card processing is counted under Online. Phone orders paid at the counter cost nothing.
                </td>
                <td className="px-5 py-2 text-right text-foreground tabular-nums">{formatCurrency(fees, currency, { compact: true })}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

function ZonesCard({ snapshot, currency, loading }: { snapshot: KitchenSnapshot; currency: CurrencyCode; loading: boolean }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-sm">Delivery zones</CardTitle>
        <CardDescription>Where the bikes went, and whether the fee covers the ride.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col gap-3 px-5 pb-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} shape="line" className="h-7 w-full" />
            ))}
          </div>
        ) : snapshot.zones.length === 0 ? (
          <p className="px-5 pb-5 text-[0.8125rem] text-subtle">No delivery zones set up.</p>
        ) : (
          <table className="w-full text-[0.8125rem]">
            <thead>
              <tr className="border-y border-line-subtle text-left text-xs text-subtle">
                <th className="px-5 py-2 font-medium">Zone</th>
                <th className="px-3 py-2 text-right font-medium">Orders</th>
                <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Share</th>
                <th className="px-3 py-2 text-right font-medium">Revenue</th>
                <th className="hidden px-3 py-2 text-right font-medium md:table-cell">Fees taken</th>
                <th className="px-5 py-2 text-right font-medium">Ride</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {snapshot.zones.map((z) => (
                <tr key={z.id}>
                  <td className="px-5 py-2.5 text-foreground">{z.name}</td>
                  <td className="px-3 py-2.5 text-right text-foreground tabular-nums">{formatNumber(z.orders)}</td>
                  <td className="hidden px-3 py-2.5 text-right text-muted tabular-nums sm:table-cell">{z.share}%</td>
                  <td className="px-3 py-2.5 text-right text-muted tabular-nums">{formatCurrency(z.revenue, currency, { compact: true })}</td>
                  <td className="hidden px-3 py-2.5 text-right text-muted tabular-nums md:table-cell">{formatCurrency(z.fees, currency, { compact: true })}</td>
                  <td className="px-5 py-2.5 text-right text-muted tabular-nums">{z.minutes} min</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  )
}

function SlowMoversCard({ dishes, currency, loading, className }: { dishes: DishRow[]; currency: CurrencyCode; loading: boolean; className?: string }) {
  const slow = dishes.filter((d) => d.status === 'available').sort((a, b) => a.perDay - b.perDay).slice(0, 5)
  const risers = [...dishes].sort((a, b) => b.delta - a.delta).slice(0, 5)
  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader>
        <CardTitle className="text-sm">Movers</CardTitle>
        <CardDescription>What is climbing, and what barely leaves the kitchen.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        {loading ? (
          <>
            <Skeleton shape="block" className="h-40 w-full rounded-xl" />
            <Skeleton shape="block" className="h-40 w-full rounded-xl" />
          </>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-muted">Climbing</p>
              <ul className="mt-2 flex flex-col gap-2">
                {risers.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 text-[0.8125rem]">
                    <Thumb src={d.imageUrl} />
                    <span className="min-w-0 flex-1 truncate text-foreground">{d.name}</span>
                    <ChartDeltaChip value={d.delta} size="xs" />
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Barely moving</p>
              <ul className="mt-2 flex flex-col gap-2">
                {slow.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 text-[0.8125rem]">
                    <Thumb src={d.imageUrl} />
                    <span className="min-w-0 flex-1 truncate text-foreground">{d.name}</span>
                    <span className="shrink-0 text-xs text-subtle tabular-nums">
                      {d.perDay} a day · {formatCurrency(d.revenue, currency, { compact: true })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function PeakFooter({ snapshot }: { snapshot: KitchenSnapshot }) {
  const busiest = [...snapshot.hours].sort((a, b) => b.orders - a.orders)[0]
  const quietest = [...snapshot.hours].filter((h) => h.orders > 0).sort((a, b) => a.orders - b.orders)[0]
  if (!busiest) return null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full" style={{ background: 'var(--chart-1)' }} aria-hidden="true" />
        Orders an hour
      </span>
      <span className="ml-auto">
        Busiest <span className="font-medium text-muted">{String(busiest.hour).padStart(2, '0')}:00</span> · quietest <span className="font-medium text-muted">{quietest ? `${String(quietest.hour).padStart(2, '0')}:00` : '—'}</span>
      </span>
    </div>
  )
}

function RatingCard({ ratings, loading }: { ratings: KitchenSnapshot['ratings']; loading: boolean }) {
  const max = Math.max(1, ...ratings.distribution.map((d) => d.count))
  const tone = 'var(--chart-6)'
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="text-sm">Guest rating</CardTitle>
        <CardDescription>{ratings.count ? `${formatNumber(ratings.count)} reviews, all time` : 'No reviews yet'}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton shape="block" className="h-32 w-full rounded-xl" />
        ) : ratings.count ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-end gap-3">
              <p className="font-display text-[2.5rem] leading-none font-semibold tracking-tight text-foreground tabular-nums">{ratings.average.toFixed(1)}</p>
              <div className="flex items-center gap-0.5 pb-1" aria-label={`${ratings.average.toFixed(1)} out of 5`}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} aria-hidden="true" className={cn('size-4', s <= Math.round(ratings.average) ? 'fill-current' : 'fill-transparent')} style={{ color: tone }} />
                ))}
              </div>
            </div>
            <ul className="flex flex-col gap-1.5">
              {ratings.distribution.map((d) => (
                <li key={d.star} className="flex items-center gap-2 text-xs">
                  <span className="flex w-7 shrink-0 items-center gap-0.5 text-muted tabular-nums">
                    {d.star}
                    <Star aria-hidden="true" className="size-3 fill-current" style={{ color: tone }} />
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                    <span className="block h-full rounded-full" style={{ width: `${(d.count / max) * 100}%`, background: tone, opacity: d.star >= 4 ? 1 : 0.55 }} />
                  </span>
                  <span className="w-10 shrink-0 text-right text-muted tabular-nums">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-xs text-subtle">Guests are asked once, a day after the order.</p>
        )}
      </CardContent>
    </Card>
  )
}

function Thumb({ src }: { src?: string }) {
  return <span className="relative size-8 shrink-0 overflow-hidden rounded-md bg-surface-sunken">{src ? <Image src={src} alt="" fill sizes="32px" className="object-cover" /> : <ImageOff aria-hidden="true" className="absolute inset-0 m-auto size-3.5 text-faint" />}</span>
}

function DishesCard({ dishes, categories, currency, rangeLabel, loading, compact = false }: { dishes: DishRow[]; categories: KitchenSnapshot['categories']; currency: CurrencyCode; rangeLabel: string; loading: boolean; compact?: boolean }) {
  const [category, setCategory] = React.useState('all')
  const [sort, setSort] = React.useState<DataTableSort>({ id: 'revenue', dir: 'desc' })
  const rows = React.useMemo(() => {
    const filtered = category === 'all' ? dishes : dishes.filter((d) => d.categoryId === category)
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sort.id) {
        case 'portions':
          return (a.portions - b.portions) * dir
        case 'delta':
          return (a.delta - b.delta) * dir
        case 'name':
          return a.name.localeCompare(b.name) * dir
        default:
          return (a.revenue - b.revenue) * dir
      }
    })
  }, [dishes, category, sort])
  const max = Math.max(1, ...dishes.map((d) => d.revenue))

  const columns = React.useMemo<DataTableColumn<DishRow>[]>(
    () => [
      {
        id: 'name',
        header: 'Dish',
        sortable: true,
        cell: (d) => (
          <span className="flex min-w-[12rem] items-center gap-3">
            <Thumb src={d.imageUrl} />
            <span className="min-w-0">
              <span className="block truncate text-[0.8125rem] text-foreground">{d.name}</span>
              <span className="block truncate text-xs text-subtle">{d.category}</span>
            </span>
          </span>
        ),
      },
      { id: 'portions', header: 'Portions', sortable: true, align: 'right', numeric: true, width: '6rem', cell: (d) => <span className="text-[0.8125rem] text-foreground tabular-nums">{formatNumber(d.portions)}</span> },
      { id: 'perDay', header: 'A day', hideBelow: 'md', align: 'right', numeric: true, width: '5rem', cell: (d) => <span className="text-[0.8125rem] text-muted tabular-nums">{d.perDay}</span> },
      { id: 'revenue', header: 'Revenue', sortable: true, defaultSortDir: 'desc', align: 'right', numeric: true, width: '7rem', cell: (d) => <span className="text-[0.8125rem] text-foreground tabular-nums">{formatCurrency(d.revenue, currency, { compact: true })}</span> },
      {
        id: 'share',
        header: 'Share',
        hideBelow: 'lg',
        width: '10rem',
        cell: (d) => (
          <span className="flex items-center gap-2">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <span className="block h-full rounded-full bg-primary/70" style={{ width: `${(d.revenue / max) * 100}%` }} />
            </span>
            <span className="w-10 text-right text-xs text-muted tabular-nums">{d.share}%</span>
          </span>
        ),
      },
      { id: 'delta', header: 'Change', sortable: true, hideBelow: 'sm', align: 'right', width: '6rem', cell: (d) => <ChartDeltaChip value={d.delta} size="xs" /> },
    ],
    [currency, max],
  )

  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-sm">{compact ? 'What sells' : 'Every dish'}</CardTitle>
          <CardDescription>{compact ? `Top dishes by revenue · ${rangeLabel}` : `${formatNumber(dishes.length)} dishes · ${rangeLabel} · change against the previous period`}</CardDescription>
        </div>
        {!compact ? (
          <div className="no-scrollbar -mx-1 flex max-w-full gap-1 overflow-x-auto px-1">
            {[{ id: 'all', name: 'All' }, ...categories].map((c) => (
              <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)} className={cn('shrink-0 rounded-lg px-2.5 py-1 text-xs transition-colors', category === c.id ? 'bg-foreground text-background' : 'text-muted hover:bg-surface-sunken hover:text-foreground')}>
                {c.name}
              </button>
            ))}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex flex-col gap-3 px-5 pb-5">
            {Array.from({ length: compact ? 5 : 8 }).map((_, i) => (
              <Skeleton key={i} shape="line" className="h-8 w-full" />
            ))}
          </div>
        ) : (
          <DataTable columns={columns} rows={rows} getRowId={(d) => d.id} sort={sort} onSortChange={setSort} rowHeight="compact" ariaLabel="Dishes" getRowClassName={(d) => (d.status === 'available' ? undefined : 'opacity-60')} />
        )}
      </CardContent>
    </Card>
  )
}

/* --------------------------------------------------------------------------
   Small charts — thin marks, a legend when there is more than one series,
   a visually hidden table underneath.
   -------------------------------------------------------------------------- */

function StackedColumns({ groups, series, format }: { groups: { label: string; values: Record<string, number> }[]; series: { key: string; label: string; color: string }[]; format: (v: number) => string }) {
  const totals = groups.map((g) => series.reduce((s, k) => s + (g.values[k.key] ?? 0), 0))
  const max = Math.max(1, ...totals)
  const showValues = groups.length <= 14
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-end gap-1.5 sm:gap-2">
        {groups.map((g, i) => (
          <div key={g.label} className="flex min-w-0 flex-1 flex-col items-stretch justify-end gap-1" style={{ height: '100%' }}>
            {showValues ? <span className="text-center text-xs text-subtle tabular-nums">{totals[i] ? format(totals[i]) : ''}</span> : null}
            <div className="flex flex-col-reverse gap-px" style={{ height: `${(totals[i] / max) * 100}%`, minHeight: totals[i] ? 4 : 0 }} title={`${g.label}: ${series.map((k) => `${k.label} ${format(g.values[k.key] ?? 0)}`).join(', ')}`}>
              {series.map((k, j) => {
                const v = g.values[k.key] ?? 0
                if (!v) return null
                return <span key={k.key} className={cn('block w-full', j === series.length - 1 || series.slice(j + 1).every((n) => !(g.values[n.key] ?? 0)) ? 'rounded-t-[4px]' : '')} style={{ height: `${(v / totals[i]) * 100}%`, background: k.color }} />
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 border-t border-line-subtle pt-1.5 sm:gap-2">
        {groups.map((g) => (
          <span key={g.label} className="min-w-0 flex-1 truncate text-center text-xs text-subtle">
            {g.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <thead>
          <tr>
            <th>Group</th>
            {series.map((k) => (
              <th key={k.key}>{k.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.label}>
              <td>{g.label}</td>
              {series.map((k) => (
                <td key={k.key}>{format(g.values[k.key] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DailyColumns({ snapshot, series }: { snapshot: KitchenSnapshot; series: { key: string; label: string; color: string }[] }) {
  // Weekday averages carry the mix; the daily line carries the count. Show the
  // range as one column a day for short ranges and one a week for long ones.
  const points = snapshot.timeseries
  const perWeek = points.length > 35
  const groups: { label: string; values: Record<string, number> }[] = []
  if (perWeek) {
    for (let start = 0; start < points.length; start += 7) {
      const chunk = points.slice(start, start + 7)
      const d = new Date(`${chunk[0].date}T12:00:00`)
      const values: Record<string, number> = {}
      for (const s of series) values[s.key] = 0
      const total = chunk.reduce((sum, p) => sum + p.bookings, 0)
      for (const s of series) {
        const share = (snapshot.types.find((r) => r.type === s.key)?.share ?? 0) / 100
        values[s.key] = Math.round(total * share)
      }
      groups.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, values })
    }
  } else {
    for (const p of points) {
      const d = new Date(`${p.date}T12:00:00`)
      const values: Record<string, number> = {}
      for (const s of series) {
        const share = (snapshot.types.find((r) => r.type === s.key)?.share ?? 0) / 100
        values[s.key] = Math.round(p.bookings * share)
      }
      groups.push({ label: points.length > 10 ? `${d.getDate()}` : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()], values })
    }
  }
  return <StackedColumns groups={groups} series={series} format={(v) => formatNumber(v)} />
}

function HBars({ rows, format }: { rows: { label: string; value: number; hint?: string }[]; format: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label} className="text-[0.8125rem]">
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-foreground">{r.label}</span>
            <span className="shrink-0 text-muted tabular-nums">
              {format(r.value)}
              {r.hint ? <span className="text-faint"> · {r.hint}</span> : null}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function HourBars({ rows, format, color, fromZero = false }: { rows: { hour: number; value: number }[]; format: (v: number) => string; color: string; fromZero?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  const min = Math.min(...rows.map((r) => r.value), max)
  const floor = fromZero ? 0 : Math.max(0, min - (max - min) * 0.6)
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 items-end gap-1">
        {rows.map((r) => (
          <div key={r.hour} className="flex min-w-0 flex-1 flex-col items-stretch justify-end" style={{ height: '100%' }} title={`${String(r.hour).padStart(2, '0')}:00 · ${format(r.value)}`}>
            <span className="block w-full rounded-t-[4px]" style={{ height: `${((r.value - floor) / (max - floor || 1)) * 100}%`, minHeight: 4, background: color }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1 border-t border-line-subtle pt-1.5">
        {rows.map((r) => (
          <span key={r.hour} className="min-w-0 flex-1 truncate text-center text-xs text-subtle tabular-nums">
            {r.hour % 3 === 0 ? `${String(r.hour).padStart(2, '0')}` : ''}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <tbody>
          {rows.map((r) => (
            <tr key={r.hour}>
              <td>{String(r.hour).padStart(2, '0')}:00</td>
              <td>{format(r.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
