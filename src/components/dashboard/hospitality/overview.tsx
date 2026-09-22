import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BedDouble, Bike, ImageOff, Phone, ShoppingBag, Star } from 'lucide-react'

import { PageHeader } from '@/components/dashboard/page-header'
import { ChartDeltaChip } from '@/components/charts/chart-container'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NOW, TODAY_KEY, getBookingRows, getUsersByTenant, CURRENT_USER } from '@/lib/demo'
import { getDining, getLiveOrders, getLodging, getLodgingCounts } from '@/lib/hospitality'
import { hm } from '@/lib/hospitality/hours'
import { HOUSEKEEPING_META, ORDER_STATUS_META, ORDER_TYPE_LABEL, STAY_STATUS_META, type DiningData, type Order, type OrderType } from '@/lib/hospitality/types'
import { addDays, cn, formatCurrency, formatDateLong, formatNumber, toDateKey } from '@/lib/utils'
import type { WorkspaceProfile } from '@/lib/workspace-profile'
import type { Tenant } from '@/types'

import { guestName, shortDuration } from './format'
import { StatusWord } from './shared'

/* ==========================================================================
   Hospitality overview — the morning read, in pictures.

   Four numbers, each with a fortnight drawn under it. The pass as a
   pipeline, the day as a timeline, the busy hours as bars, what guests
   said as stars, what sold as a short table, the week as columns. One
   hue per number, one hue per order type, the rest in ink. Hotels put
   the desk and housekeeping above the kitchen. A server component.
   ========================================================================== */

const NOW_TIME = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`
const NOW_MIN = hm(NOW_TIME)
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TYPE_TONE: Record<OrderType, string> = { pickup: 'var(--chart-1)', delivery: 'var(--chart-6)', dine_in: 'var(--chart-3)' }
const TYPE_ICON: Record<OrderType, typeof ShoppingBag> = { pickup: ShoppingBag, delivery: Bike, dine_in: BedDouble }
/** The hue each headline number owns, kept apart from the order-type hues. */
const TONE = { orders: 'var(--chart-1)', revenue: 'var(--chart-4)', kitchen: 'var(--chart-3)', rating: 'var(--chart-6)', rooms: 'var(--chart-4)', clean: 'var(--chart-2)' }

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Daily figures for the last fourteen days, oldest first. */
function fortnight(dining: DiningData) {
  const days = Array.from({ length: 14 }, (_, i) => toDateKey(addDays(NOW, i - 13)))
  return days.map((date) => {
    const rows = dining.orders.filter((o) => o.placedAt.startsWith(date))
    const done = rows.filter((o) => o.status === 'completed')
    const prep = done.filter((o) => o.readyAt).map((o) => Math.round((new Date(o.readyAt as string).getTime() - new Date(o.placedAt).getTime()) / 60_000))
    const revenue: Record<OrderType, number> = { pickup: 0, delivery: 0, dine_in: 0 }
    for (const o of done) revenue[o.type] += o.total
    return {
      date,
      weekday: new Date(`${date}T12:00:00`).getDay(),
      orders: rows.filter((o) => o.status !== 'cancelled').length,
      revenue,
      total: done.reduce((s, o) => s + o.total, 0),
      items: done.reduce((s, o) => s + o.lines.reduce((n, l) => n + l.qty, 0), 0),
      prep: prep.length ? prep.reduce((a, b) => a + b, 0) / prep.length : 0,
    }
  })
}

/** What guests have said: the score, its spread and its drift by week. */
function feedback(tenantId: string) {
  const rated = getBookingRows(tenantId).filter((r) => typeof r.booking.rating === 'number')
  const ratings = rated.map((r) => r.booking.rating as number)
  const count = ratings.length
  const average = count ? Math.round((ratings.reduce((a, b) => a + b, 0) / count) * 10) / 10 : 0
  const distribution = [5, 4, 3, 2, 1].map((star) => ({ star, count: ratings.filter((v) => v === star).length }))
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const from = addDays(NOW, (i - 7) * 7 - 6)
    const to = addDays(NOW, (i - 7) * 7)
    const inWeek = rated.filter((r) => {
      const d = new Date(r.booking.createdAt)
      return d >= from && d <= to
    })
    return inWeek.length ? inWeek.reduce((s, r) => s + (r.booking.rating as number), 0) / inWeek.length : average
  })
  const recent = rated.filter((r) => new Date(r.booking.createdAt) >= addDays(NOW, -30)).length
  return { count, average, distribution, weeks, recent, low: distribution.filter((d) => d.star <= 2).reduce((s, d) => s + d.count, 0) }
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const delta = (now: number, before: number) => (before ? Math.round(((now - before) / before) * 1000) / 10 : 0)

export function HospitalityOverview({ tenant, profile }: { tenant: Tenant; profile: WorkspaceProfile }) {
  const owner = getUsersByTenant(tenant.id).find((u) => u.role === 'owner') ?? CURRENT_USER
  const firstName = owner.name.split(' ')[0]
  const dining = getDining(tenant)
  const live = getLiveOrders(tenant)
  const lodging = profile.modules.lodging ? getLodging(tenant) : null
  const lodgingCounts = profile.modules.lodging ? getLodgingCounts(tenant) : null
  const currency = tenant.currency

  /* ---------- kitchen numbers ---------- */

  const days = fortnight(dining)
  const thisWeek = days.slice(7)
  const lastWeek = days.slice(0, 7)
  const todayRow = days[days.length - 1]
  const yesterdayRow = days[days.length - 2]
  const doneToday = dining.orders.filter((o) => o.placedAt.startsWith(TODAY_KEY) && o.status === 'completed')
  const avgPrepToday = todayRow.prep ? Math.round(todayRow.prep) : 0
  const said = feedback(tenant.id)
  const hourly = Array.from({ length: 24 }, (_, h) => dining.orders.filter((o) => !o.placedAt.startsWith(TODAY_KEY) && new Date(o.placedAt).getHours() === h && o.status !== 'cancelled').length / 13)
  const topDishes = [...dining.menu.items].sort((a, b) => b.sold30d - a.sold30d).slice(0, 6)
  const dishRevenue = sum(dining.menu.items.map((i) => i.revenue30d)) || 1
  const scheduled = live.filter((o) => o.scheduledFor).length
  const weekday = NOW.getDay()
  const current = dining.settings.periods.find((p) => p.weekdays.includes(weekday) && hm(p.startTime) <= NOW_MIN && hm(p.endTime) > NOW_MIN)
  const next = dining.settings.periods.find((p) => p.weekdays.includes(weekday) && hm(p.startTime) > NOW_MIN)
  const closure = dining.settings.closures.find((c) => c.date >= TODAY_KEY)
  const room = dining.settings.ordering.roomService
  const typesInPlay = (['dine_in', 'pickup', 'delivery'] as OrderType[]).filter((t) => days.some((d) => d.revenue[t] > 0))

  const kitchenLine = `${current ? `${current.name} until ${current.endTime}` : next ? `${next.name} opens ${next.startTime}` : 'kitchen closed'} · ${live.length} live`
  const headline = lodging && lodgingCounts ? `${formatDateLong(NOW)} · ${lodgingCounts.arrivalsToday} arriving, ${lodgingCounts.departuresToday} leaving, ${lodgingCounts.occupancyTonight}% tonight · ${kitchenLine}` : `${formatDateLong(NOW)} · ${kitchenLine}`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting(NOW.getHours())}, ${firstName}`}
        description={headline}
        className="mb-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={lodging ? '/dashboard/front-desk' : '/dashboard/menu'}>{lodging ? 'Front desk' : 'Menu'}</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={profile.vocab.newBookingHref}>{profile.vocab.newBooking}</Link>
            </Button>
          </div>
        }
      />

      {/* ---------- numbers ---------- */}
      {lodging && lodgingCounts ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Tile label="Occupancy tonight" value={`${lodgingCounts.occupancyTonight}%`} hint={`${lodging.rooms.filter((r) => r.housekeeping !== 'out_of_order').length} rooms in sale`} tone={TONE.rooms} />
          <Tile label="Arrivals" value={lodgingCounts.arrivalsToday} hint={`from ${lodging.settings.checkInFrom}`} tone={TONE.orders} />
          <Tile label="Departures" value={lodgingCounts.departuresToday} hint={`by ${lodging.settings.checkOutBy}`} tone={TONE.kitchen} />
          <Tile label="Rooms to clean" value={lodgingCounts.roomsToClean} hint={`${lodging.housekeeping.filter((t) => t.priority === 'rush' && t.status !== 'done').length} rush`} tone={TONE.clean} />
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Orders today" value={todayRow.orders} hint={`${live.length} live${scheduled ? ` · ${scheduled} for later` : ''}`} series={days.map((d) => d.orders)} tone={TONE.orders} delta={delta(sum(thisWeek.map((d) => d.orders)), sum(lastWeek.map((d) => d.orders)))} seriesLabel="orders a day, 14 days" />
        <Tile label="Taken today" value={formatCurrency(todayRow.total, currency, { compact: true })} hint={`${doneToday.length} orders done`} series={days.map((d) => d.total)} tone={TONE.revenue} delta={delta(sum(thisWeek.map((d) => d.total)), sum(lastWeek.map((d) => d.total)))} seriesLabel="revenue a day, 14 days" />
        <Tile label="Kitchen time" value={avgPrepToday ? shortDuration(avgPrepToday) : '—'} hint="order to ready" series={days.map((d) => Math.round(d.prep))} tone={TONE.kitchen} delta={yesterdayRow.prep ? delta(todayRow.prep, yesterdayRow.prep) : undefined} higherIsBetter={false} seriesLabel="minutes a day, 14 days" />
        <Tile label="Guest rating" value={said.count ? said.average.toFixed(1) : '—'} hint={said.count ? `${formatNumber(said.count)} reviews` : 'No reviews yet'} series={said.count ? said.weeks : undefined} tone={TONE.rating} seriesLabel="weekly average, 8 weeks" floor={3.5} ceiling={5} />
      </div>

      {/* ---------- hotel: the desk today ---------- */}
      {lodging ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <DeskList
            title="Arriving today"
            href="/dashboard/front-desk"
            rows={lodging.stays
              .filter((s) => s.checkIn === TODAY_KEY && (s.status === 'arriving' || s.status === 'booked' || s.status === 'in_house'))
              .sort((a, b) => (a.eta ?? '99').localeCompare(b.eta ?? '99'))
              .slice(0, 6)
              .map((s) => ({
                id: s.id,
                lead: s.status === 'in_house' ? s.checkedInAt?.slice(11, 16) ?? '' : s.eta ?? '—',
                name: guestName(s.customer),
                avatar: s.customer.avatarUrl,
                detail: `${s.roomId ? `Room ${lodging.rooms.find((r) => r.id === s.roomId)?.number}` : lodging.roomTypes.find((t) => t.id === s.roomTypeId)?.name ?? ''} · ${s.nights} ${s.nights === 1 ? 'night' : 'nights'}`,
                status: STAY_STATUS_META[s.status],
              }))}
            empty="No arrivals today."
          />
          <DeskList
            title="Housekeeping"
            href="/dashboard/housekeeping"
            rows={lodging.housekeeping
              .filter((t) => t.status !== 'done' && t.status !== 'skipped')
              .slice(0, 6)
              .map((t) => {
                const r = lodging.rooms.find((x) => x.id === t.roomId)
                return {
                  id: t.id,
                  lead: `by ${t.dueBy}`,
                  name: `Room ${r?.number ?? ''}`,
                  detail: `${t.kind.replace(/_/g, ' ')}${t.priority === 'rush' ? ' · rush' : ''}`,
                  status: r ? HOUSEKEEPING_META[r.housekeeping] : { label: t.status, tone: 'bg-line-strong' },
                }
              })}
            empty="Every room is done."
          />
        </div>
      ) : null}

      {/* ---------- the pass and the day ---------- */}
      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="min-w-0 xl:col-span-7">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">On the pass</CardTitle>
              <CardDescription>{live.length ? `${live.length} live${scheduled ? ` · ${scheduled} scheduled for later` : ''}` : 'Nothing live'}</CardDescription>
            </div>
            <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/orders">Orders</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Pipeline live={live} />
            <DueList live={live} />
          </CardContent>
        </Card>

        <Card className="min-w-0 xl:col-span-5">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Today</CardTitle>
              <CardDescription>
                {DAY_NAMES[weekday]} · {NOW_TIME}
              </CardDescription>
            </div>
            <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/hours">Hours</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DayTimeline dining={dining} weekday={weekday} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line-subtle pt-3 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-3" aria-hidden="true" />
                Tables by phone
              </span>
              {room.enabled ? <span>Room service up in {room.leadMinutes} min</span> : <span>Pickup ready in {dining.settings.ordering.pickup.leadMinutes} min</span>}
              {closure ? (
                <span className="ml-auto">
                  Closed {closure.date.slice(5).replace('-', '/')} · {closure.reason}
                </span>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---------- busy hours and what guests said ---------- */}
      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="min-w-0 xl:col-span-7">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Peak hours</CardTitle>
              <CardDescription>Orders an hour on an average day, last two weeks</CardDescription>
            </div>
            <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/analytics">Analytics</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <PeakHours hourly={hourly} tone={TONE.orders} />
          </CardContent>
        </Card>

        <Card className="min-w-0 xl:col-span-5">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Guest feedback</CardTitle>
              <CardDescription>{said.count ? `${formatNumber(said.count)} reviews · ${said.recent} in the last 30 days` : 'Reviews appear here after the first orders'}</CardDescription>
            </div>
            <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/reviews">Reviews</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Feedback said={said} tone={TONE.rating} />
          </CardContent>
        </Card>
      </div>

      {/* ---------- best sellers and the week ---------- */}
      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="min-w-0 xl:col-span-7">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Best sellers</CardTitle>
              <CardDescription>Last 30 days</CardDescription>
            </div>
            <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/menu">Menu</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-[0.8125rem]">
              <thead>
                <tr className="border-y border-line-subtle text-left text-xs font-medium tracking-wide text-subtle uppercase">
                  <th className="px-5 py-2 sm:px-6">Dish</th>
                  <th className="px-3 py-2 text-right">Sold</th>
                  <th className="px-3 py-2 text-right">Revenue</th>
                  <th className="hidden w-40 px-5 py-2 text-right sm:table-cell sm:px-6">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {topDishes.map((d) => {
                  const share = Math.round((d.revenue30d / dishRevenue) * 1000) / 10
                  const topRevenue = Math.max(1, ...topDishes.map((x) => x.revenue30d))
                  return (
                    <tr key={d.id}>
                      <td className="px-5 py-2.5 sm:px-6">
                        <span className="flex items-center gap-3">
                          <span className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">{d.imageUrl ? <Image src={d.imageUrl} alt="" fill sizes="36px" className="object-cover" /> : <ImageOff aria-hidden="true" className="absolute inset-0 m-auto size-3.5 text-faint" />}</span>
                          <span className="min-w-0">
                            <span className="block truncate text-foreground">{d.name}</span>
                            <span className="block truncate text-xs text-subtle">{dining.menu.categories.find((c) => c.id === d.categoryId)?.name}</span>
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right text-foreground tabular-nums">{formatNumber(d.sold30d)}</td>
                      <td className="px-3 py-2.5 text-right text-muted tabular-nums">{formatCurrency(d.revenue30d, currency, { compact: true })}</td>
                      <td className="hidden px-5 py-2.5 sm:table-cell sm:px-6">
                        <span className="flex items-center gap-2">
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                            <span className="block h-full rounded-full" style={{ width: `${Math.round((d.revenue30d / topRevenue) * 100)}%`, background: TONE.revenue }} />
                          </span>
                          <span className="w-10 text-right text-xs text-muted tabular-nums">{share}%</span>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="min-w-0 xl:col-span-5">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">This week</CardTitle>
              <CardDescription>
                {formatCurrency(sum(thisWeek.map((d) => d.total)), currency, { compact: true })} across {formatNumber(sum(thisWeek.map((d) => d.orders)))} orders
              </CardDescription>
            </div>
            <span className="flex items-center gap-3 text-xs text-muted">
              {typesInPlay.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: TYPE_TONE[t] }} aria-hidden="true" />
                  {ORDER_TYPE_LABEL[t]}
                </span>
              ))}
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <WeekColumns days={thisWeek} types={typesInPlay} currency={currency} />
            <div className="flex items-center justify-between border-t border-line-subtle pt-3 text-xs text-muted">
              <span className="inline-flex items-center gap-2">
                <ChartDeltaChip value={delta(sum(thisWeek.map((d) => d.total)), sum(lastWeek.map((d) => d.total)))} size="xs" />
                vs last week
              </span>
              <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
                <Link href="/dashboard/analytics">Analytics</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   A number with a fortnight drawn under it
   -------------------------------------------------------------------------- */

function Tile({ label, value, hint, series, tone, delta: change, higherIsBetter = true, seriesLabel, floor, ceiling }: { label: string; value: string | number; hint: string; series?: number[]; tone: string; delta?: number; higherIsBetter?: boolean; seriesLabel?: string; floor?: number; ceiling?: number }) {
  const drawn = series && series.some((v) => v > 0)
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-2 px-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <p className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-muted">
            <span className="size-2 shrink-0 rounded-full" style={{ background: tone }} aria-hidden="true" />
            <span className="truncate">{label}</span>
          </p>
          {change !== undefined ? <ChartDeltaChip value={change} higherIsBetter={higherIsBetter} size="xs" /> : null}
        </div>
        <p className="font-display text-[1.875rem] leading-none font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
        <p className="truncate text-xs text-subtle">{hint}</p>
      </div>
      {drawn ? <div className="mt-3 h-12"><Wave values={series as number[]} tone={tone} label={seriesLabel ? `${label}, ${seriesLabel}` : undefined} floor={floor} ceiling={ceiling} /></div> : <div className="h-4" />}
    </Card>
  )
}

/** A filled line that stretches to the card, the way the reference dashboards draw it. */
function Wave({ values, tone, label, floor, ceiling }: { values: number[]; tone: string; label?: string; floor?: number; ceiling?: number }) {
  const w = 100
  const h = 32
  const min = floor ?? Math.min(...values)
  const max = ceiling ?? Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * w, 3 + (h - 6) * (1 - (v - min) / span)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')
  const area = `${line} L${w} ${h} L0 ${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block h-full w-full" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      <path d={area} fill={tone} fillOpacity={0.16} />
      <path d={line} fill="none" stroke={tone} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/* --------------------------------------------------------------------------
   The pass as a pipeline
   -------------------------------------------------------------------------- */

const PIPE = [
  { key: 'new', label: 'New', statuses: ['new'], tone: 'var(--chart-6)' },
  { key: 'kitchen', label: 'In the kitchen', statuses: ['accepted', 'preparing'], tone: 'var(--chart-1)' },
  { key: 'ready', label: 'Ready', statuses: ['ready'], tone: 'var(--chart-4)' },
  { key: 'road', label: 'On the way', statuses: ['out_for_delivery'], tone: 'var(--chart-3)' },
] as const

function Pipeline({ live }: { live: Order[] }) {
  const counts = PIPE.map((p) => live.filter((o) => (p.statuses as readonly string[]).includes(o.status)).length)
  const total = Math.max(1, sum(counts))
  return (
    <div>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-sunken" role="img" aria-label={PIPE.map((p, i) => `${p.label} ${counts[i]}`).join(', ')}>
        {PIPE.map((p, i) =>
          counts[i] ? <span key={p.key} className="h-full" style={{ width: `${Math.max(4, (counts[i] / total) * 100)}%`, background: p.tone }} /> : null,
        )}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {PIPE.map((p, i) => (
          <div key={p.key} className="min-w-0">
            <p className="font-display text-xl leading-none font-semibold text-foreground tabular-nums">{counts[i]}</p>
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted">
              <span className="size-1.5 shrink-0 rounded-full" style={{ background: p.tone }} aria-hidden="true" />
              {p.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function DueList({ live }: { live: Order[] }) {
  const due = [...live].filter((o) => !o.scheduledFor).sort((a, b) => a.promisedAt.localeCompare(b.promisedAt)).slice(0, 5)
  if (due.length === 0) return <p className="border-t border-line-subtle pt-3 text-xs text-subtle">New orders appear here the moment a guest pays, or when you take one on the phone.</p>
  return (
    <ul className="divide-y divide-line-subtle border-t border-line-subtle">
      {due.map((o) => {
        const Icon = TYPE_ICON[o.type]
        const left = hm(o.promisedAt.slice(11, 16)) - NOW_MIN
        return (
          <li key={o.id} className="flex items-center gap-3 py-2 text-[0.8125rem]">
            <span className="w-12 shrink-0 text-foreground tabular-nums">{o.number}</span>
            <Icon className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-muted">
              {o.type === 'dine_in' ? `Room ${o.roomNumber}` : o.type === 'delivery' ? o.address?.area ?? 'Delivery' : 'Pickup'} · {guestName(o.customer)}
            </span>
            <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-xs tabular-nums', o.late ? 'bg-danger-soft text-danger' : left <= 5 ? 'bg-warning-soft text-warning' : 'bg-surface-sunken text-muted')}>{o.late ? `${shortDuration(-left)} late` : left <= 0 ? 'due now' : `${shortDuration(left)}`}</span>
            <StatusWord label={ORDER_STATUS_META[o.status].label} tone={ORDER_STATUS_META[o.status].tone} className="hidden w-24 sm:inline-flex" />
          </li>
        )
      })}
    </ul>
  )
}

/* --------------------------------------------------------------------------
   The day as a timeline
   -------------------------------------------------------------------------- */

const DAY_START = 7 * 60
const DAY_END = 24 * 60

function pos(minutes: number) {
  return `${Math.max(0, Math.min(100, ((minutes - DAY_START) / (DAY_END - DAY_START)) * 100))}%`
}

function DayTimeline({ dining, weekday }: { dining: DiningData; weekday: number }) {
  const { periods, ordering } = dining.settings
  const tracks: { label: string; segments: { from: number; to: number; label?: string; tone: string; off?: boolean }[] }[] = [
    {
      label: 'Kitchen',
      segments: periods.map((p) => ({ from: hm(p.startTime), to: hm(p.endTime), label: p.name, tone: 'var(--chart-1)', off: !p.weekdays.includes(weekday) })),
    },
    { label: 'Pickup', segments: ordering.pickup.enabled ? [{ from: hm(ordering.pickup.startTime), to: hm(ordering.pickup.endTime), tone: 'var(--chart-4)' }] : [] },
    { label: 'Delivery', segments: ordering.delivery.enabled ? [{ from: hm(ordering.delivery.startTime), to: hm(ordering.delivery.endTime), tone: 'var(--chart-6)' }] : [] },
    ...(ordering.roomService.enabled ? [{ label: 'Room service', segments: [{ from: hm(ordering.roomService.startTime), to: hm(ordering.roomService.endTime), tone: 'var(--chart-3)' }] }] : []),
  ]
  const ticks = [8, 12, 16, 20, 24]
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-xs" role="img" aria-label={tracks.map((t) => `${t.label}: ${t.segments.map((s) => `${s.label ? `${s.label} ` : ''}${Math.floor(s.from / 60)}:${String(s.from % 60).padStart(2, '0')} to ${Math.floor(s.to / 60)}:${String(s.to % 60).padStart(2, '0')}`).join(', ') || 'off'}`).join('. ')}>
      <span aria-hidden="true" />
      <div className="relative h-3.5">
        {tracks[0].segments.map((s) => (
          <span key={`${s.from}-label`} className={cn('absolute top-0 text-xs whitespace-nowrap text-muted', s.off && 'opacity-40')} style={{ left: pos(s.from) }}>
            {s.label}
          </span>
        ))}
      </div>
      {tracks.map((track, i) => (
        <div key={track.label} className="contents">
          <span className="self-center truncate text-muted">{track.label}</span>
          <div className={cn('relative h-5 rounded-md bg-surface-sunken/70', i === 0 && 'h-6')}>
            {track.segments.map((s) => (
              <span
                key={`${s.from}-${s.to}`}
                className={cn('absolute inset-y-0.5 rounded', s.off && 'opacity-30')}
                style={{ left: pos(s.from), width: `calc(${pos(s.to)} - ${pos(s.from)})`, background: s.tone }}
                title={`${s.label ?? track.label} · ${Math.floor(s.from / 60)}:${String(s.from % 60).padStart(2, '0')}–${Math.floor(s.to / 60)}:${String(s.to % 60).padStart(2, '0')}`}
              />
            ))}
            {i === 0 ? <span aria-hidden="true" className="absolute -top-1 -bottom-1 w-0.5 rounded-full bg-foreground" style={{ left: pos(NOW_MIN) }} /> : null}
          </div>
        </div>
      ))}
      <span aria-hidden="true" />
      <div className="relative h-4">
        {ticks
          .filter((h) => Math.abs(h * 60 - NOW_MIN) > 80)
          .map((h) => (
            <span key={h} className="absolute -translate-x-1/2 text-xs text-faint tabular-nums" style={{ left: pos(h * 60) }}>
              {h === 24 ? '00' : String(h).padStart(2, '0')}
            </span>
          ))}
        <span className="absolute -translate-x-1/2 rounded bg-foreground px-1 text-xs font-medium text-background tabular-nums" style={{ left: pos(NOW_MIN), top: -2 }}>
          {NOW_TIME}
        </span>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Peak hours — one hue, the current hour in ink
   -------------------------------------------------------------------------- */

function PeakHours({ hourly, tone }: { hourly: number[]; tone: string }) {
  const hours = Array.from({ length: 17 }, (_, i) => i + 7)
  const max = Math.max(1, ...hours.map((h) => hourly[h]))
  const peak = hours.reduce((best, h) => (hourly[h] > hourly[best] ? h : best), hours[0])
  const nowHour = NOW.getHours()
  return (
    <div>
      <div className="flex h-40 items-end gap-1.5" role="img" aria-label={`Average orders an hour: ${hours.map((h) => `${h}:00 ${hourly[h].toFixed(1)}`).join(', ')}`}>
        {hours.map((h) => (
          <div key={h} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${String(h).padStart(2, '0')}:00 · ${hourly[h].toFixed(1)} orders an hour`}>
            <span className={cn('block w-full rounded-t-[4px]', h === nowHour && 'bg-foreground')} style={{ height: `${(hourly[h] / max) * 100}%`, minHeight: hourly[h] ? 3 : 0, ...(h === nowHour ? {} : { background: tone, opacity: 0.85 }) }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1.5 border-t border-line-subtle pt-1.5">
        {hours.map((h) => (
          <span key={h} className={cn('min-w-0 flex-1 overflow-visible text-center text-xs whitespace-nowrap tabular-nums', h === nowHour ? 'font-semibold text-foreground' : 'text-subtle')}>
            {h % 3 === 0 || h === nowHour ? String(h).padStart(2, '0') : ''}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: tone }} aria-hidden="true" />
          Orders an hour
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-foreground" aria-hidden="true" />
          Now
        </span>
        <span className="ml-auto">
          Busiest {String(peak).padStart(2, '0')}:00 · {hourly[peak].toFixed(1)} an hour
        </span>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   What guests said
   -------------------------------------------------------------------------- */

function Feedback({ said, tone }: { said: ReturnType<typeof feedback>; tone: string }) {
  if (!said.count) return <p className="text-xs text-subtle">Ratings arrive with the receipt: guests are asked once, a day after the order.</p>
  const max = Math.max(1, ...said.distribution.map((d) => d.count))
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
      <div className="shrink-0">
        <p className="font-display text-[2.5rem] leading-none font-semibold tracking-tight text-foreground tabular-nums">{said.average.toFixed(1)}</p>
        <div className="mt-2 flex items-center gap-0.5" aria-label={`${said.average.toFixed(1)} out of 5`}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Star key={s} aria-hidden="true" className={cn('size-4', s <= Math.round(said.average) ? 'fill-current' : 'fill-transparent')} style={{ color: tone }} />
          ))}
        </div>
        <p className="mt-2 text-xs text-subtle">{said.low ? `${said.low} low ${said.low === 1 ? 'rating' : 'ratings'} to answer` : 'No low ratings'}</p>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {said.distribution.map((d) => (
          <li key={d.star} className="flex items-center gap-2 text-xs">
            <span className="flex w-7 shrink-0 items-center gap-0.5 text-muted tabular-nums">
              {d.star}
              <Star aria-hidden="true" className="size-3 fill-current" style={{ color: tone }} />
            </span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-sunken">
              <span className="block h-full rounded-full" style={{ width: `${(d.count / max) * 100}%`, background: tone, opacity: d.star >= 4 ? 1 : 0.55 }} />
            </span>
            <span className="w-8 shrink-0 text-right text-muted tabular-nums">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Seven columns
   -------------------------------------------------------------------------- */

function WeekColumns({ days, types, currency }: { days: ReturnType<typeof fortnight>; types: OrderType[]; currency: string }) {
  const max = Math.max(1, ...days.map((d) => d.total))
  return (
    <div>
      <div className="flex h-36 items-end gap-2">
        {days.map((d) => (
          <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1" title={`${SHORT_DAYS[d.weekday]} · ${formatCurrency(d.total, currency as never)} · ${d.orders} orders`}>
            <span className="text-center text-xs text-subtle tabular-nums">{d.total ? formatCurrency(d.total, currency as never, { compact: true }) : ''}</span>
            <div className="flex flex-col-reverse gap-px" style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total ? 4 : 0 }}>
              {types.map((t, j) => {
                const v = d.revenue[t]
                if (!v) return null
                const last = types.slice(j + 1).every((n) => !d.revenue[n])
                return <span key={t} className={cn('block w-full', last && 'rounded-t-[4px]')} style={{ height: `${(v / d.total) * 100}%`, background: TYPE_TONE[t] }} />
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-line-subtle pt-1.5">
        {days.map((d) => (
          <span key={d.date} className={cn('min-w-0 flex-1 truncate text-center text-xs tabular-nums', d.date === TODAY_KEY ? 'font-semibold text-foreground' : 'text-subtle')}>
            {SHORT_DAYS[d.weekday]}
          </span>
        ))}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   A small list for the desk
   -------------------------------------------------------------------------- */

interface DeskRow {
  id: string
  lead: string
  name: string
  avatar?: string
  detail: string
  status: { label: string; tone: string }
}

function DeskList({ title, href, rows, empty }: { title: string; href: string; rows: DeskRow[]; empty: string }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <CardTitle className="text-sm">{title}</CardTitle>
        <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
          <Link href={href}>Open</Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="px-5 pb-5 text-[0.8125rem] text-subtle">{empty}</p>
        ) : (
          <ul className="divide-y divide-line-subtle border-t border-line-subtle">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-[0.8125rem]">
                <span className="w-14 shrink-0 text-foreground tabular-nums">{r.lead}</span>
                {r.avatar !== undefined ? <Avatar name={r.name} src={r.avatar} size="xs" /> : null}
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-foreground">{r.name}</span>
                  <span className="text-subtle"> · {r.detail}</span>
                </span>
                <StatusWord label={r.status.label} tone={r.status.tone} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
