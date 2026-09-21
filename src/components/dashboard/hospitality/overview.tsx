import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

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
  type Order,
  type TableReservation,
} from '@/lib/hospitality/types'
import { cn, formatCurrency, formatDateLong, formatNumber } from '@/lib/utils'
import type { WorkspaceProfile } from '@/lib/workspace-profile'
import type { Tenant } from '@/types'

import { guestName } from './format'
import { StatTile, StatusWord } from './shared'

/* ==========================================================================
   Hospitality overview — the morning read for a restaurant or a hotel.

   Restaurant: covers on the book, the pass, the room, what sold.
   Hotel: the same, with the front desk and housekeeping on top.
   A server component: it reads the seam directly and hands the client
   tiles plain values.
   ========================================================================== */

const NOW_TIME = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`

function greeting(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function HospitalityOverview({ tenant, profile }: { tenant: Tenant; profile: WorkspaceProfile }) {
  const owner = getUsersByTenant(tenant.id).find((u) => u.role === 'owner') ?? CURRENT_USER
  const firstName = owner.name.split(' ')[0]
  const dining = getDining(tenant)
  const diningCounts = getDiningCounts(tenant)
  const live = getLiveOrders(tenant)
  const lodging = profile.modules.lodging ? getLodging(tenant) : null
  const lodgingCounts = profile.modules.lodging ? getLodgingCounts(tenant) : null
  const currency = tenant.currency

  /* ---------- dining numbers ---------- */

  const today = dining.reservations.filter((r) => r.date === TODAY_KEY)
  const upcoming = today
    .filter((r) => (r.status === 'booked' || r.status === 'confirmed' || r.status === 'arrived') && hm(r.time) >= hm(NOW_TIME) - 15)
    .sort((a, b) => a.time.localeCompare(b.time))
  const last30 = dining.reservations.filter((r) => r.date < TODAY_KEY && (r.status === 'finished' || r.status === 'no_show'))
  const noShowRate = last30.length ? Math.round((last30.filter((r) => r.status === 'no_show').length / last30.length) * 100) : 0
  const ordersToday = dining.orders.filter((o) => o.placedAt.startsWith(TODAY_KEY) && o.status !== 'cancelled' && o.status !== 'refunded')
  const revenueToday = ordersToday.filter((o) => o.status === 'completed').reduce((s, o) => s + o.total, 0)
  const weekStart = new Date(NOW)
  weekStart.setDate(weekStart.getDate() - 6)
  const weekKey = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, '0')}-${String(weekStart.getDate()).padStart(2, '0')}`
  const weekOrders = dining.orders.filter((o) => o.placedAt.slice(0, 10) >= weekKey && o.status === 'completed')
  const weekByType = (['dine_in', 'pickup', 'delivery'] as Order['type'][]).map((t) => {
    const rows = weekOrders.filter((o) => o.type === t)
    return { t, n: rows.length, revenue: rows.reduce((s, o) => s + o.total, 0) }
  })
  const weekTotal = weekByType.reduce((s, b) => s + b.revenue, 0)
  const topDishes = [...dining.menu.items].sort((a, b) => b.sold30d - a.sold30d).slice(0, 6)
  const topMax = topDishes[0]?.sold30d ?? 1
  const tableById = new Map(dining.tables.map((t) => [t.id, t]))

  const dinner = dining.settings.periods[dining.settings.periods.length - 1]
  const tonightCovers = today.filter((r) => r.period === dinner.id && r.status !== 'cancelled' && r.status !== 'no_show' && r.status !== 'waitlist').reduce((s, r) => s + r.partySize, 0)

  /* ---------- headline ---------- */

  const headline = lodging && lodgingCounts
    ? `${formatDateLong(NOW)} · ${lodgingCounts.arrivalsToday} arriving, ${lodgingCounts.departuresToday} leaving, ${lodgingCounts.occupancyTonight}% tonight · ${tonightCovers} covers at dinner`
    : `${formatDateLong(NOW)} · ${formatNumber(diningCounts.coversToday)} covers still to come, ${tonightCovers} of them at dinner · ${live.length} live ${live.length === 1 ? 'order' : 'orders'}`

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting(NOW.getHours())}, ${firstName}`}
        description={headline}
        className="mb-0"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href={lodging ? '/dashboard/front-desk' : '/dashboard/floor'}>{lodging ? 'Front desk' : 'Floor plan'}</Link>
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
          <StatTile label="Occupancy tonight" value={`${lodgingCounts.occupancyTonight}%`} line={`${lodging.rooms.filter((r) => r.housekeeping !== 'out_of_order').length} rooms in sale`} tone="bg-success" />
          <StatTile label="Arrivals" hint={`from ${lodging.settings.checkInFrom}`} value={lodgingCounts.arrivalsToday} line={`${lodging.stays.filter((s) => s.checkIn === TODAY_KEY && !s.roomId && s.status !== 'in_house').length} still need a room`} tone="bg-warning" />
          <StatTile label="Departures" hint={`by ${lodging.settings.checkOutBy}`} value={lodgingCounts.departuresToday} line={`${lodging.stays.filter((s) => s.checkOut === TODAY_KEY && s.status === 'checked_out').length} already out`} tone="bg-primary" />
          <StatTile label="Rooms to clean" value={lodgingCounts.roomsToClean} line={`${lodging.housekeeping.filter((t) => t.priority === 'rush' && t.status !== 'done').length} rush turnovers`} tone="bg-danger" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Covers today" hint={`${diningCounts.reservationsToday} reservations`} value={diningCounts.coversToday} line={`${tonightCovers} at dinner · ${dinner.startTime}–${dinner.endTime}`} tone="bg-success" />
          <StatTile label="Live orders" hint="on the pass" value={live.length} line={`${live.filter((o) => o.late).length} running late · ${live.filter((o) => o.scheduledFor).length} scheduled`} tone="bg-primary" />
          <StatTile label="Taken today" hint={`${ordersToday.filter((o) => o.status === 'completed').length} orders done`} value={formatCurrency(revenueToday, currency, { compact: true })} line={`Week so far ${formatCurrency(weekTotal, currency, { compact: true })}`} />
          <StatTile label="No-shows" hint="last 30 days" value={`${noShowRate}%`} line={`${last30.filter((r) => r.status === 'no_show').length} of ${last30.length} finished reservations`} tone={noShowRate > 6 ? 'bg-warning' : 'bg-line-strong'} />
        </div>
      )}

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
      ) : null}

      {/* ---------- dining: the book and the pass ---------- */}
      <div className="grid gap-5 xl:grid-cols-12">
        <Card className="min-w-0 xl:col-span-7">
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">{lodging ? 'Table reservations next' : 'Next on the book'}</CardTitle>
              <CardDescription>
                {upcoming.length} {upcoming.length === 1 ? 'party' : 'parties'} due from {NOW_TIME}.
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

      {/* ---------- the room, what sold, the week ---------- */}
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
            {weekByType.map((b) => (
              <div key={b.t} className="text-[0.8125rem]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-foreground">{ORDER_TYPE_LABEL[b.t]}</span>
                  <span className="text-muted tabular-nums">
                    {b.n} <span className="text-faint">· {formatCurrency(b.revenue, currency, { compact: true })}</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                  <div className="h-full rounded-full bg-primary/70" style={{ width: `${weekTotal ? Math.round((b.revenue / weekTotal) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
            <p className="pt-1 text-xs text-subtle">
              {formatCurrency(weekTotal, currency)} across {weekOrders.length} orders. Reservations and tasting menus settle through Payments.
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
