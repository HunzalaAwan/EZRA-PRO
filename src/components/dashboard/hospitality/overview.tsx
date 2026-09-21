import Link from 'next/link'
import { ArrowRight, Phone } from 'lucide-react'

import { PageHeader } from '@/components/dashboard/page-header'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NOW, TODAY_KEY, getUsersByTenant, CURRENT_USER } from '@/lib/demo'
import { getDining, getDiningCounts, getLiveOrders, getLodging, getLodgingCounts } from '@/lib/hospitality'
import { hm } from '@/lib/hospitality/floor'
import {
  HOUSEKEEPING_META,
  ORDER_STATUS_META,
  ORDER_TYPE_LABEL,
  RESERVATION_STATUS_META,
  STAY_STATUS_META,
  TABLE_STATUS_META,
  type DiningData,
  type Order,
  type TableReservation,
} from '@/lib/hospitality/types'
import { cn, formatCurrency, formatDateLong, formatNumber } from '@/lib/utils'
import type { WorkspaceProfile } from '@/lib/workspace-profile'
import type { Tenant } from '@/types'

import { guestName, shortDuration } from './format'
import { Dot, StatTile, StatusWord } from './shared'

/* ==========================================================================
   Hospitality overview — the morning read.

   Restaurant (orders only): the pass, today's hours, what sold, the week.
   Hotel: the front desk and housekeeping on top, then the restaurant's
   book, the pass and the room. A server component: it reads the seam
   directly and hands the client tiles plain values.
   ========================================================================== */

const NOW_TIME = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function weekOf(dining: DiningData) {
  const weekStart = new Date(NOW)
  weekStart.setDate(weekStart.getDate() - 6)
  const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
  const weekOrders = dining.orders.filter((o) => o.placedAt.slice(0, 10) >= weekKey && o.status === 'completed')
  const byType = (['dine_in', 'pickup', 'delivery'] as Order['type'][])
    .map((t) => {
      const rows = weekOrders.filter((o) => o.type === t)
      return { t, n: rows.length, revenue: rows.reduce((s, o) => s + o.total, 0) }
    })
    .filter((b) => b.n > 0)
  return { weekOrders, byType, total: byType.reduce((s, b) => s + b.revenue, 0) }
}

export function HospitalityOverview({ tenant, profile }: { tenant: Tenant; profile: WorkspaceProfile }) {
  const owner = getUsersByTenant(tenant.id).find((u) => u.role === 'owner') ?? CURRENT_USER
  const firstName = owner.name.split(' ')[0]
  const dining = getDining(tenant)
  const live = getLiveOrders(tenant)
  if (!profile.modules.reservations) return <RestaurantOverview tenant={tenant} profile={profile} firstName={firstName} dining={dining} live={live} />
  return <HotelOverview tenant={tenant} profile={profile} firstName={firstName} dining={dining} live={live} />
}

/* --------------------------------------------------------------------------
   Restaurant — orders, hours, what sold
   -------------------------------------------------------------------------- */

function RestaurantOverview({ tenant, profile, firstName, dining, live }: { tenant: Tenant; profile: WorkspaceProfile; firstName: string; dining: DiningData; live: Order[] }) {
  const currency = tenant.currency
  const ordersToday = dining.orders.filter((o) => o.placedAt.startsWith(TODAY_KEY) && o.status !== 'cancelled' && o.status !== 'refunded')
  const doneToday = ordersToday.filter((o) => o.status === 'completed')
  const revenueToday = doneToday.reduce((s, o) => s + o.total, 0)
  const prep = doneToday.filter((o) => o.readyAt).map((o) => Math.round((new Date(o.readyAt as string).getTime() - new Date(o.placedAt).getTime()) / 60_000))
  const avgPrep = prep.length ? Math.round(prep.reduce((a, b) => a + b, 0) / prep.length) : 0
  const week = weekOf(dining)
  const topDishes = [...dining.menu.items].sort((a, b) => b.sold30d - a.sold30d).slice(0, 6)
  const topMax = topDishes[0]?.sold30d ?? 1
  const soldOut = dining.menu.items.filter((i) => i.status === 'sold_out').length
  const onSale = dining.menu.items.filter((i) => i.status === 'available').length
  const onDelivery = dining.menu.items.filter((i) => i.status === 'available' && i.channels.includes('delivery')).length
  const scheduled = live.filter((o) => o.scheduledFor).sort((a, b) => (a.scheduledFor ?? '').localeCompare(b.scheduledFor ?? ''))
  const now = hm(NOW_TIME)
  const weekday = NOW.getDay()
  const current = dining.settings.periods.find((p) => p.weekdays.includes(weekday) && hm(p.startTime) <= now && hm(p.endTime) > now)
  const next = dining.settings.periods.find((p) => p.weekdays.includes(weekday) && hm(p.startTime) > now)
  const closure = dining.settings.closures.find((c) => c.date >= TODAY_KEY)

  const headline = `${formatDateLong(NOW)} · ${current ? `${current.name} until ${current.endTime}` : next ? `${next.name} opens ${next.startTime}` : 'kitchen closed'} · ${live.length} live ${live.length === 1 ? 'order' : 'orders'}${scheduled.length ? `, ${scheduled.length} scheduled` : ''}`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting(NOW.getHours())}, ${firstName}`}
        description={headline}
        className="mb-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/menu">Menu</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={profile.vocab.newBookingHref}>{profile.vocab.newBooking}</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Live orders" hint="on the pass" value={live.length} line={`${live.filter((o) => o.late).length} running late · ${scheduled.length} scheduled for later`} tone="bg-primary" />
        <StatTile label="Taken today" hint={`${doneToday.length} orders done`} value={formatCurrency(revenueToday, currency, { compact: true })} line={`Week so far ${formatCurrency(week.total, currency, { compact: true })} across ${week.weekOrders.length} orders`} tone="bg-success" />
        <StatTile label="Kitchen time" hint="order to ready, today" value={avgPrep ? shortDuration(avgPrep) : '—'} line={`Pickup promise ${dining.settings.ordering.pickup.leadMinutes} min · delivery ${dining.settings.ordering.delivery.leadMinutes} min plus the ride`} />
        <StatTile label="Menu" hint="dishes on sale" value={onSale} line={soldOut ? `${soldOut} sold out today · ${onDelivery} on delivery` : `Nothing sold out · ${onDelivery} on delivery`} tone={soldOut ? 'bg-danger' : 'bg-success'} />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="min-w-0 xl:col-span-7">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">On the pass</CardTitle>
              <CardDescription>{live.length ? `${live.length} live · oldest placed ${live[live.length - 1]?.placedAt.slice(11, 16)}` : 'Nothing live'}</CardDescription>
            </div>
            <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/orders">Orders</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-line-subtle border-t border-line-subtle">
              {live.slice(0, 8).map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-2.5 text-[0.8125rem]">
                  <span className="w-12 shrink-0 text-foreground tabular-nums">{o.number}</span>
                  <span className="w-16 shrink-0 text-muted">{ORDER_TYPE_LABEL[o.type]}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}</span>
                  <span className={cn('shrink-0 text-xs tabular-nums', o.late ? 'text-danger' : 'text-subtle')}>{o.scheduledFor ? `for ${o.scheduledFor.slice(11, 16)}` : o.late ? 'late' : o.promisedAt.slice(11, 16)}</span>
                  <StatusWord label={ORDER_STATUS_META[o.status].label} tone={ORDER_STATUS_META[o.status].tone} className="hidden sm:inline-flex" />
                </li>
              ))}
              {live.length === 0 ? <li className="px-5 py-4 text-[0.8125rem] text-subtle">New orders appear here the moment a guest pays, or when you take one on the phone.</li> : null}
            </ul>
          </CardContent>
        </Card>

        <Card className="min-w-0 xl:col-span-5">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Today</CardTitle>
              <CardDescription>{DAY_NAMES[weekday]} · as the storefront tells it</CardDescription>
            </div>
            <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/hours">Hours</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-[0.8125rem]">
            <ul className="flex flex-col gap-2">
              {dining.settings.periods.map((p) => {
                const open = p.weekdays.includes(weekday)
                const state = !open ? 'Closed today' : now < hm(p.startTime) ? `Opens ${p.startTime}` : now < hm(p.endTime) ? `Open until ${p.endTime}` : 'Finished'
                const tone = !open || now >= hm(p.endTime) ? 'bg-line-strong' : now < hm(p.startTime) ? 'bg-info' : 'bg-success'
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-foreground">
                      <Dot tone={tone} />
                      {p.name}
                    </span>
                    <span className="text-muted tabular-nums">
                      {p.startTime}–{p.endTime} <span className="text-subtle">· {state}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
            <dl className="flex flex-col gap-1.5 border-t border-line-subtle pt-3 text-xs text-muted">
              <div className="flex justify-between gap-3">
                <dt>Pickup</dt>
                <dd className="text-foreground tabular-nums">
                  {dining.settings.ordering.pickup.startTime}–{dining.settings.ordering.pickup.endTime}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Delivery</dt>
                <dd className="text-foreground tabular-nums">
                  {dining.settings.ordering.delivery.startTime}–{dining.settings.ordering.delivery.endTime} · {dining.settings.ordering.delivery.zones.length} zones
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Tables</dt>
                <dd className="inline-flex items-center gap-1.5 text-foreground">
                  <Phone className="size-3" aria-hidden="true" />
                  By phone · {tenant.contact.phone}
                </dd>
              </div>
              {closure ? (
                <div className="flex justify-between gap-3">
                  <dt>Next closure</dt>
                  <dd className="text-foreground">
                    {closure.date.slice(5).replace('-', '/')} · {closure.reason}
                  </dd>
                </div>
              ) : null}
            </dl>
            {scheduled.length ? (
              <div className="border-t border-line-subtle pt-3">
                <p className="text-xs font-medium text-muted">Scheduled for later</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {scheduled.slice(0, 4).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 text-xs">
                      <span className="truncate text-foreground">
                        {o.number} · {ORDER_TYPE_LABEL[o.type]} · {guestName(o.customer)}
                      </span>
                      <span className="shrink-0 text-muted tabular-nums">{o.scheduledFor?.slice(11, 16)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="min-w-0 xl:col-span-6">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">What sold</CardTitle>
              <CardDescription>Portions in the last 30 days.</CardDescription>
            </div>
            <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/menu">Menu</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {topDishes.map((d) => (
              <div key={d.id} className="text-[0.8125rem]">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-foreground">{d.name}</span>
                  <span className="shrink-0 text-muted tabular-nums">
                    {formatNumber(d.sold30d)} <span className="text-faint">· {formatCurrency(d.revenue30d, currency, { compact: true })}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.round((d.sold30d / topMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0 xl:col-span-6">
          <CardHeader>
            <CardTitle className="text-sm">This week</CardTitle>
            <CardDescription>Completed orders, last seven days.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {week.byType.map((b) => (
              <div key={b.t} className="text-[0.8125rem]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-foreground">{ORDER_TYPE_LABEL[b.t]}</span>
                  <span className="text-muted tabular-nums">
                    {b.n} <span className="text-faint">· {formatCurrency(b.revenue, currency, { compact: true })}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${week.total ? Math.round((b.revenue / week.total) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
            <p className="pt-1 text-xs text-subtle">
              {formatCurrency(week.total, currency)} across {week.weekOrders.length} orders. Tasting menus and events settle through Payments.
            </p>
            <Button asChild size="xs" variant="outline" className="self-start">
              <Link href="/dashboard/analytics">Analytics</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Hotel — the desk, housekeeping, then the restaurant
   -------------------------------------------------------------------------- */

function HotelOverview({ tenant, profile, firstName, dining, live }: { tenant: Tenant; profile: WorkspaceProfile; firstName: string; dining: DiningData; live: Order[] }) {
  const diningCounts = getDiningCounts(tenant)
  const lodging = getLodging(tenant)
  const lodgingCounts = getLodgingCounts(tenant)
  const currency = tenant.currency

  const today = dining.reservations.filter((r) => r.date === TODAY_KEY)
  const upcoming = today
    .filter((r) => (r.status === 'booked' || r.status === 'confirmed' || r.status === 'arrived') && hm(r.time) >= hm(NOW_TIME) - 15)
    .sort((a, b) => a.time.localeCompare(b.time))
  const week = weekOf(dining)
  const topDishes = [...dining.menu.items].sort((a, b) => b.sold30d - a.sold30d).slice(0, 6)
  const topMax = topDishes[0]?.sold30d ?? 1
  const tableById = new Map(dining.tables.map((t) => [t.id, t]))
  const dinner = dining.settings.periods[dining.settings.periods.length - 1]
  const tonightCovers = today.filter((r) => r.period === dinner.id && r.status !== 'cancelled' && r.status !== 'no_show' && r.status !== 'waitlist').reduce((s, r) => s + r.partySize, 0)

  const headline = `${formatDateLong(NOW)} · ${lodgingCounts.arrivalsToday} arriving, ${lodgingCounts.departuresToday} leaving, ${lodgingCounts.occupancyTonight}% tonight · ${tonightCovers} covers at dinner`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting(NOW.getHours())}, ${firstName}`}
        description={headline}
        className="mb-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/front-desk">Front desk</Link>
            </Button>
            <Button asChild size="sm">
              <Link href={profile.vocab.newBookingHref}>{profile.vocab.newBooking}</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Occupancy tonight" value={`${lodgingCounts.occupancyTonight}%`} line={`${lodging.rooms.filter((r) => r.housekeeping !== 'out_of_order').length} rooms in sale`} tone="bg-success" />
        <StatTile label="Arrivals" hint={`from ${lodging.settings.checkInFrom}`} value={lodgingCounts.arrivalsToday} line={`${lodging.stays.filter((s) => s.checkIn === TODAY_KEY && !s.roomId && s.status !== 'in_house').length} still need a room`} tone="bg-warning" />
        <StatTile label="Departures" hint={`by ${lodging.settings.checkOutBy}`} value={lodgingCounts.departuresToday} line={`${lodging.stays.filter((s) => s.checkOut === TODAY_KEY && s.status === 'checked_out').length} already out`} tone="bg-primary" />
        <StatTile label="Rooms to clean" value={lodgingCounts.roomsToClean} line={`${lodging.housekeeping.filter((t) => t.priority === 'rush' && t.status !== 'done').length} rush turnovers`} tone="bg-danger" />
      </div>

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
              const room = lodging.rooms.find((r) => r.id === t.roomId)
              return {
                id: t.id,
                lead: `by ${t.dueBy}`,
                name: `Room ${room?.number ?? ''}`,
                detail: `${t.kind.replace(/_/g, ' ')}${t.priority === 'rush' ? ' · rush' : ''}${t.note ? ` · ${t.note}` : ''}`,
                status: room ? HOUSEKEEPING_META[room.housekeeping] : { label: t.status, tone: 'bg-line-strong' },
              }
            })}
          empty="Every room is done."
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="min-w-0 xl:col-span-7">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">Table reservations next</CardTitle>
              <CardDescription>
                {upcoming.length} {upcoming.length === 1 ? 'party' : 'parties'} due from {NOW_TIME} · {diningCounts.coversToday} covers still to come today.
              </CardDescription>
            </div>
            <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/reservations">Open the book</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {upcoming.length === 0 ? (
              <p className="px-5 pb-5 text-[0.8125rem] text-subtle">Nothing more booked today.</p>
            ) : (
              <ul className="divide-y divide-line-subtle border-t border-line-subtle">
                {upcoming.slice(0, 8).map((r: TableReservation) => (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-[0.8125rem]">
                    <span className="w-12 shrink-0 text-foreground tabular-nums">{r.time}</span>
                    <Avatar name={guestName(r.customer)} src={r.customer.avatarUrl} size="xs" />
                    <span className="min-w-0 flex-1 truncate text-foreground">{guestName(r.customer)}</span>
                    <span className="hidden shrink-0 text-muted tabular-nums sm:inline">
                      {r.partySize} · {r.tableIds.length ? r.tableIds.map((id) => tableById.get(id)?.name).join(' + ') : 'no table'}
                    </span>
                    <StatusWord label={RESERVATION_STATUS_META[r.status].label} tone={RESERVATION_STATUS_META[r.status].tone} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="min-w-0 xl:col-span-5">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">On the pass</CardTitle>
              <CardDescription>{live.length ? `${live.length} live · oldest ${live[live.length - 1]?.placedAt.slice(11, 16)}` : 'Nothing live'}</CardDescription>
            </div>
            <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/orders">Orders</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-line-subtle border-t border-line-subtle">
              {live.slice(0, 6).map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-5 py-2.5 text-[0.8125rem]">
                  <span className="w-12 shrink-0 text-foreground tabular-nums">{o.number}</span>
                  <span className="min-w-0 flex-1 truncate text-muted">
                    {ORDER_TYPE_LABEL[o.type]} · {o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}
                  </span>
                  <span className={cn('shrink-0 text-xs tabular-nums', o.late ? 'text-danger' : 'text-subtle')}>{o.scheduledFor ? `for ${o.scheduledFor.slice(11, 16)}` : o.late ? 'late' : o.promisedAt.slice(11, 16)}</span>
                  <StatusWord label={ORDER_STATUS_META[o.status].label} tone={ORDER_STATUS_META[o.status].tone} className="hidden sm:inline-flex" />
                </li>
              ))}
              {live.length === 0 ? <li className="px-5 py-4 text-[0.8125rem] text-subtle">New orders appear here the moment a guest pays.</li> : null}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="min-w-0 xl:col-span-4">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">The room now</CardTitle>
              <CardDescription>{dining.tables.filter((t) => t.status === 'seated' || t.status === 'ordered' || t.status === 'bill').length} of {dining.tables.length} tables seated.</CardDescription>
            </div>
            <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/floor">Floor</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {dining.zones.map((z) => {
              const tables = dining.tables.filter((t) => t.zoneId === z.id)
              const seated = tables.filter((t) => t.status === 'seated' || t.status === 'ordered' || t.status === 'bill').length
              return (
                <div key={z.id}>
                  <div className="flex items-center justify-between text-[0.8125rem]">
                    <span className="text-foreground">{z.name}</span>
                    <span className="text-muted tabular-nums">
                      {seated} <span className="text-faint">/ {tables.length}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {tables.map((t) => (
                      <span key={t.id} title={`${t.name} · ${TABLE_STATUS_META[t.status].label}`} className={cn('h-1.5 flex-1 rounded-full', TABLE_STATUS_META[t.status].tone)} />
                    ))}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card className="min-w-0 xl:col-span-4">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">What sold</CardTitle>
              <CardDescription>Portions in the last 30 days.</CardDescription>
            </div>
            <Button asChild size="xs" variant="ghost" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/menu">Menu</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            {topDishes.map((d) => (
              <div key={d.id} className="text-[0.8125rem]">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate text-foreground">{d.name}</span>
                  <span className="shrink-0 text-muted tabular-nums">
                    {formatNumber(d.sold30d)} <span className="text-faint">· {formatCurrency(d.revenue30d, currency, { compact: true })}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.round((d.sold30d / topMax) * 100)}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="min-w-0 xl:col-span-4">
          <CardHeader>
            <CardTitle className="text-sm">This week</CardTitle>
            <CardDescription>Completed orders, last seven days.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {week.byType.map((b) => (
              <div key={b.t} className="text-[0.8125rem]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-foreground">{ORDER_TYPE_LABEL[b.t]}</span>
                  <span className="text-muted tabular-nums">
                    {b.n} <span className="text-faint">· {formatCurrency(b.revenue, currency, { compact: true })}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${week.total ? Math.round((b.revenue / week.total) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
            <p className="pt-1 text-xs text-subtle">
              {formatCurrency(week.total, currency)} across {week.weekOrders.length} orders. Rooms and experiences settle through Payments.
            </p>
            <Button asChild size="xs" variant="outline" className="self-start">
              <Link href="/dashboard/analytics">Analytics</Link>
            </Button>
          </CardContent>
        </Card>
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
