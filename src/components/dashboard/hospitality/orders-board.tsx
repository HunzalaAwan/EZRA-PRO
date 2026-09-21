'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  Bike,
  ChefHat,
  Columns3,
  List,
  MapPin,
  Phone,
  Printer,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toaster'
import { hm } from '@/lib/hospitality/floor'
import {
  LIVE_ORDER_STATUSES,
  ORDER_SOURCE_LABEL,
  ORDER_STATUS_META,
  ORDER_TYPE_LABEL,
  type DiningTable,
  type Order,
  type OrderStatus,
  type OrderType,
} from '@/lib/hospitality/types'
import { cn, formatCurrency, formatDateShort, formatNumber } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import { StatTile, StatusWord, clock, guestName, minutesBetween, shortDuration } from './shared'

/* ==========================================================================
   <OrdersBoard> — the pass.

   Live orders move left to right: New → In the kitchen → Ready → On the way
   → Done. A card is one order: number, where it is going, what is on it,
   when it was promised. Tap it for the ticket. Everything from the last
   two weeks sits in the list underneath.
   ========================================================================== */

type TypeFilter = 'all' | OrderType
type View = 'board' | 'list'

const TYPE_ICON: Record<OrderType, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>> = {
  dine_in: UtensilsCrossed,
  pickup: ShoppingBag,
  delivery: Bike,
}

interface Column {
  key: string
  title: string
  statuses: OrderStatus[]
  hint: string
}

const COLUMNS: Column[] = [
  { key: 'new', title: 'New', statuses: ['new'], hint: 'Accept or turn down' },
  { key: 'kitchen', title: 'In the kitchen', statuses: ['accepted', 'preparing'], hint: 'On the pass' },
  { key: 'ready', title: 'Ready', statuses: ['ready'], hint: 'Waiting for the guest or the courier' },
  { key: 'road', title: 'On the way', statuses: ['out_for_delivery'], hint: 'With a courier' },
]

/** The one next step for an order, by type and status. */
function nextStep(order: Order): { label: string; status: OrderStatus } | null {
  switch (order.status) {
    case 'new':
      return { label: 'Accept', status: 'accepted' }
    case 'accepted':
      return { label: 'Start cooking', status: 'preparing' }
    case 'preparing':
      return { label: 'Ready', status: 'ready' }
    case 'ready':
      return order.type === 'delivery' ? { label: 'Dispatch', status: 'out_for_delivery' } : order.type === 'pickup' ? { label: 'Handed over', status: 'completed' } : { label: 'Served', status: 'completed' }
    case 'out_for_delivery':
      return { label: 'Delivered', status: 'completed' }
    default:
      return null
  }
}

export interface OrdersBoardProps {
  orders: Order[]
  tables: DiningTable[]
  currency: CurrencyCode
  todayKey: string
  nowIso: string
}

export function OrdersBoard({ orders: initial, tables, currency, todayKey, nowIso }: OrdersBoardProps) {
  const [orders, setOrders] = React.useState(initial)
  const [type, setType] = React.useState<TypeFilter>('all')
  const [view, setView] = React.useState<View>('board')
  const [query, setQuery] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [sort, setSort] = React.useState<DataTableSort>({ id: 'placed', dir: 'desc' })
  const [limit, setLimit] = React.useState(60)

  const tableById = React.useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables])
  const nowMin = hm(nowIso.slice(11, 16))

  const byType = React.useMemo(() => orders.filter((o) => (type === 'all' ? true : o.type === type)), [orders, type])
  const live = React.useMemo(() => byType.filter((o) => LIVE_ORDER_STATUSES.includes(o.status)), [byType])
  const today = React.useMemo(() => orders.filter((o) => o.placedAt.startsWith(todayKey)), [orders, todayKey])

  const stats = React.useMemo(() => {
    const liveAll = orders.filter((o) => LIVE_ORDER_STATUSES.includes(o.status))
    const doneToday = today.filter((o) => o.status === 'completed')
    const revenueToday = doneToday.reduce((s, o) => s + o.total, 0)
    const prep = doneToday.filter((o) => o.readyAt).map((o) => minutesBetween(o.placedAt, o.readyAt as string))
    const avgPrep = prep.length ? Math.round(prep.reduce((a, b) => a + b, 0) / prep.length) : 0
    const late = liveAll.filter((o) => o.late).length
    const scheduled = liveAll.filter((o) => o.scheduledFor).length
    const mix = (['dine_in', 'pickup', 'delivery'] as OrderType[]).map((t) => ({ t, n: today.filter((o) => o.type === t && o.status !== 'cancelled').length }))
    return { live: liveAll.length, late, scheduled, revenueToday, doneToday: doneToday.length, avgPrep, mix }
  }, [orders, today])

  const history = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = byType.filter((o) => {
      if (!needle) return true
      return o.number.includes(needle) || guestName(o.customer).toLowerCase().includes(needle) || o.lines.some((l) => l.name.toLowerCase().includes(needle))
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      switch (sort.id) {
        case 'total':
          return (a.total - b.total) * dir
        case 'guest':
          return guestName(a.customer).localeCompare(guestName(b.customer)) * dir
        case 'status':
          return a.status.localeCompare(b.status) * dir
        default:
          return a.placedAt.localeCompare(b.placedAt) * dir
      }
    })
  }, [byType, query, sort])

  /* ---------- actions ---------- */

  const advance = (order: Order, status: OrderStatus) => {
    const stamp = nowIso
    setOrders((current) =>
      current.map((o) =>
        o.id === order.id
          ? {
              ...o,
              status,
              late: false,
              readyAt: status === 'ready' ? stamp : o.readyAt,
              completedAt: status === 'completed' ? stamp : o.completedAt,
              courier: status === 'out_for_delivery' && !o.courier ? { name: 'Next available', status: 'picking_up', etaMinutes: 18 } : status === 'completed' && o.courier ? { ...o.courier, status: 'delivered', etaMinutes: 0 } : o.courier,
              paymentStatus: status === 'refunded' ? 'refunded' : status === 'completed' && o.paymentStatus === 'pay_at_counter' ? 'paid' : o.paymentStatus,
            }
          : o,
      ),
    )
    const messages: Partial<Record<OrderStatus, string>> = {
      accepted: `${order.number} accepted`,
      preparing: `${order.number} is on the pass`,
      ready: `${order.number} ready · ${order.type === 'pickup' ? 'guest texted' : order.type === 'delivery' ? 'courier called' : `runner to ${order.tableId ? tableById.get(order.tableId)?.name : 'the table'}`}`,
      out_for_delivery: `${order.number} out for delivery`,
      completed: `${order.number} done`,
      cancelled: `${order.number} cancelled`,
      refunded: `${order.number} refunded ${formatCurrency(order.total, currency)}`,
    }
    toast(messages[status] ?? order.number)
  }

  const selected = selectedId ? orders.find((o) => o.id === selectedId) ?? null : null

  /* ---------- list columns ---------- */

  const columns = React.useMemo<DataTableColumn<Order>[]>(
    () => [
      { id: 'number', header: 'Order', width: '5rem', cell: (o) => <span className="text-[0.8125rem] text-foreground tabular-nums">{o.number}</span> },
      {
        id: 'placed',
        header: 'Placed',
        sortable: true,
        defaultSortDir: 'desc',
        width: '8.5rem',
        cellClassName: 'whitespace-nowrap',
        cell: (o) => (
          <span className="text-[0.8125rem] text-foreground tabular-nums">
            {formatDateShort(o.placedAt)} <span className="text-subtle">· {clock(o.placedAt)}</span>
          </span>
        ),
      },
      {
        id: 'type',
        header: 'Type',
        width: '6.5rem',
        cell: (o) => {
          const Icon = TYPE_ICON[o.type]
          return (
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted">
              <Icon className="size-3.5 text-faint" aria-hidden="true" />
              {ORDER_TYPE_LABEL[o.type]}
            </span>
          )
        },
      },
      {
        id: 'guest',
        header: 'Guest',
        sortable: true,
        cell: (o) => (
          <span className="flex min-w-[9rem] max-w-[14rem] items-center gap-2.5">
            <Avatar name={guestName(o.customer)} src={o.customer.avatarUrl} size="xs" />
            <span className="truncate text-[0.8125rem] text-foreground">{guestName(o.customer)}</span>
          </span>
        ),
      },
      {
        id: 'items',
        header: 'Items',
        hideBelow: 'lg',
        cell: (o) => <span className="block max-w-[20rem] truncate text-[0.8125rem] text-muted">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}</span>,
      },
      { id: 'source', header: 'Source', hideBelow: 'xl', width: '7rem', cell: (o) => <span className="text-[0.8125rem] text-muted">{ORDER_SOURCE_LABEL[o.source]}</span> },
      {
        id: 'total',
        header: 'Total',
        sortable: true,
        align: 'right',
        numeric: true,
        width: '6rem',
        cell: (o) => <span className={cn('text-[0.8125rem] tabular-nums', o.status === 'refunded' || o.status === 'cancelled' ? 'text-subtle line-through' : 'text-foreground')}>{formatCurrency(o.total, currency)}</span>,
      },
      { id: 'status', header: 'Status', sortable: true, width: '8rem', cell: (o) => <StatusWord label={ORDER_STATUS_META[o.status].label} tone={ORDER_STATUS_META[o.status].tone} /> },
    ],
    [currency],
  )

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- numbers ---------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Live" hint="on the board" value={stats.live} line={stats.scheduled ? `${stats.scheduled} scheduled for later` : 'All for now'} tone="bg-primary" />
        <StatTile label="Running late" hint="past the promise" value={stats.late} line={stats.late ? 'Call the guest before they call you' : 'Everything on time'} tone={stats.late ? 'bg-danger' : 'bg-success'} />
        <StatTile label="Today so far" hint={`${stats.doneToday} done`} value={formatCurrency(stats.revenueToday, currency, { compact: true })} line={stats.mix.map((m) => `${ORDER_TYPE_LABEL[m.t]} ${m.n}`).join(' · ')} />
        <StatTile label="Kitchen time" hint="order to ready, today" value={stats.avgPrep ? shortDuration(stats.avgPrep) : '—'} line="Promise is prep plus five minutes" />
      </div>

      <Card className="min-w-0">
        {/* ---------- toolbar ---------- */}
        <div className="flex flex-col gap-3 border-b border-line-subtle px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              label="Order type"
              options={[
                { value: 'all', label: 'All' },
                { value: 'dine_in', label: 'Dine-in', icon: UtensilsCrossed },
                { value: 'pickup', label: 'Pickup', icon: ShoppingBag },
                { value: 'delivery', label: 'Delivery', icon: Bike },
              ]}
              value={type}
              onValueChange={setType}
              hideLabelsOnMobile
            />
            {view === 'list' ? <SearchInput value={query} onValueChange={setQuery} placeholder="Order, guest or dish…" size="sm" aria-label="Search orders" fieldClassName="w-full sm:w-56" /> : null}
          </div>
          <Segmented
            size="sm"
            label="View"
            options={[
              { value: 'board', label: 'Board', icon: Columns3 },
              { value: 'list', label: 'History', icon: List },
            ]}
            value={view}
            onValueChange={setView}
            hideLabelsOnMobile
          />
        </div>

        {view === 'board' ? (
          <CardContent className="p-3 sm:p-4">
            {live.length === 0 ? (
              <EmptyState variant="no-data" size="sm" icon={ChefHat} title="Nothing on the pass" description="New orders land here the moment a guest pays." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {COLUMNS.map((column) => {
                  const cards = live.filter((o) => column.statuses.includes(o.status)).sort((a, b) => a.promisedAt.localeCompare(b.promisedAt))
                  if (column.key === 'road' && type !== 'all' && type !== 'delivery') return null
                  return (
                    <section key={column.key} aria-label={column.title} className="flex min-w-0 flex-col rounded-xl bg-surface-sunken/60 p-2">
                      <header className="flex items-center justify-between px-1.5 pt-1 pb-2">
                        <span className="text-xs font-medium text-muted">{column.title}</span>
                        <span className="text-xs text-faint tabular-nums">{cards.length}</span>
                      </header>
                      <div className="flex flex-col gap-2">
                        {cards.length === 0 ? <p className="px-1.5 py-6 text-center text-xs text-faint">{column.hint}</p> : null}
                        {cards.map((o) => (
                          <OrderCard key={o.id} order={o} currency={currency} nowMin={nowMin} tableName={o.tableId ? tableById.get(o.tableId)?.name : undefined} onOpen={() => setSelectedId(o.id)} onAdvance={advance} />
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            )}
          </CardContent>
        ) : (
          <CardContent className="p-0">
            <DataTable columns={columns} rows={history.slice(0, limit)} getRowId={(o) => o.id} onRowClick={(o) => setSelectedId(o.id)} sort={sort} onSortChange={setSort} stickyHeader rowHeight="compact" ariaLabel="Orders" getRowClassName={(o) => (o.status === 'cancelled' || o.status === 'refunded' ? 'opacity-60' : undefined)} empty={<EmptyState variant="no-results" size="sm" title="No orders match" description="Try another type or search." />} />
            {history.length > limit ? (
              <div className="border-t border-line-subtle p-3 text-center">
                <Button size="sm" variant="ghost" onClick={() => setLimit(limit + 60)}>
                  Show {Math.min(60, history.length - limit)} more of {formatNumber(history.length)}
                </Button>
              </div>
            ) : null}
          </CardContent>
        )}
      </Card>

      <OrderSheet order={selected} currency={currency} tableName={selected?.tableId ? tableById.get(selected.tableId)?.name : undefined} onClose={() => setSelectedId(null)} onAdvance={advance} />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Card
   -------------------------------------------------------------------------- */

function OrderCard({ order: o, currency, nowMin, tableName, onOpen, onAdvance }: { order: Order; currency: CurrencyCode; nowMin: number; tableName?: string; onOpen: () => void; onAdvance: (order: Order, status: OrderStatus) => void }) {
  const Icon = TYPE_ICON[o.type]
  const step = nextStep(o)
  const promised = hm(o.promisedAt.slice(11, 16))
  const sameDay = o.promisedAt.slice(0, 10) === o.placedAt.slice(0, 10)
  const minutesLeft = promised - nowMin
  const where = o.type === 'dine_in' ? (o.roomNumber ? `Room ${o.roomNumber}` : tableName ?? 'Table') : o.type === 'delivery' ? o.address?.area ?? 'Delivery' : 'Pickup'
  const timing = o.scheduledFor ? `for ${clock(o.scheduledFor)}` : o.late ? `${shortDuration(-minutesLeft)} late` : minutesLeft <= 0 ? 'due now' : `${shortDuration(minutesLeft)} left`
  return (
    <article className={cn('rounded-lg border bg-surface p-3', o.late ? 'border-danger/50' : 'border-line')}>
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.8125rem] text-foreground tabular-nums">{o.number}</span>
          <span className={cn('text-xs tabular-nums', o.late ? 'text-danger' : 'text-subtle')}>{sameDay ? timing : formatDateShort(o.promisedAt)}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <Icon className="size-3.5 text-faint" aria-hidden="true" />
          <span className="truncate">{where}</span>
          <span className="text-faint">·</span>
          <span className="truncate">{guestName(o.customer)}</span>
        </div>
        <ul className="mt-2 flex flex-col gap-0.5 text-[0.8125rem] text-foreground">
          {o.lines.slice(0, 3).map((l) => (
            <li key={l.id} className="flex gap-2">
              <span className="w-5 shrink-0 text-subtle tabular-nums">{l.qty}×</span>
              <span className="truncate">{l.name}</span>
            </li>
          ))}
          {o.lines.length > 3 ? <li className="pl-7 text-xs text-subtle">+{o.lines.length - 3} more</li> : null}
        </ul>
        {o.notes ? <p className="mt-2 truncate text-xs text-warning">{o.notes}</p> : null}
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted tabular-nums">{formatCurrency(o.total, currency)}</span>
        {step ? (
          <Button size="xs" variant={o.status === 'new' ? 'primary' : 'secondary'} onClick={() => onAdvance(o, step.status)}>
            {step.label}
          </Button>
        ) : null}
      </div>
    </article>
  )
}

/* --------------------------------------------------------------------------
   Ticket
   -------------------------------------------------------------------------- */

function OrderSheet({ order: o, currency, tableName, onClose, onAdvance }: { order: Order | null; currency: CurrencyCode; tableName?: string; onClose: () => void; onAdvance: (order: Order, status: OrderStatus) => void }) {
  const step = o ? nextStep(o) : null
  const isLive = o ? LIVE_ORDER_STATUSES.includes(o.status) : false
  return (
    <Sheet open={o !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" size="md">
        {o ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span className="tabular-nums">{o.number}</span>
                <StatusWord label={ORDER_STATUS_META[o.status].label} tone={ORDER_STATUS_META[o.status].tone} />
              </SheetTitle>
              <SheetDescription>
                {ORDER_TYPE_LABEL[o.type]} · {ORDER_SOURCE_LABEL[o.source]} · placed {clock(o.placedAt)}
                {o.scheduledFor ? ` · scheduled for ${clock(o.scheduledFor)}` : ''}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <Avatar name={guestName(o.customer)} src={o.customer.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] text-foreground">{guestName(o.customer)}</p>
                  <p className="truncate text-xs text-subtle">{o.customer.phone}</p>
                </div>
                <Button asChild size="xs" variant="ghost" leftIcon={<Phone />}>
                  <a href={`tel:${o.customer.phone.replace(/[^+\d]/g, '')}`}>Call</a>
                </Button>
              </div>

              {o.type === 'delivery' && o.address ? (
                <div className="flex items-start gap-2 text-[0.8125rem]">
                  <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-faint" />
                  <div className="min-w-0">
                    <p className="text-foreground">{o.address.line}</p>
                    <p className="text-muted">
                      {o.address.area}
                      {o.address.instructions ? ` · ${o.address.instructions}` : ''}
                    </p>
                    {o.courier ? (
                      <p className="mt-1 text-xs text-subtle">
                        Courier {o.courier.name} · {o.courier.status.replace(/_/g, ' ')}
                        {o.courier.etaMinutes ? ` · ${o.courier.etaMinutes} min` : ''}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {o.type === 'dine_in' ? <p className="text-[0.8125rem] text-muted">{o.roomNumber ? `Room service · room ${o.roomNumber}` : `Table ${tableName ?? '—'}`}</p> : null}

              <ul className="divide-y divide-line-subtle rounded-lg border border-line">
                {o.lines.map((l) => (
                  <li key={l.id} className="flex items-start gap-3 px-3 py-2.5 text-[0.8125rem]">
                    <span className="w-6 shrink-0 text-subtle tabular-nums">{l.qty}×</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground">{l.name}</p>
                      {l.modifiers.length ? <p className="text-xs text-muted">{l.modifiers.join(' · ')}</p> : null}
                      {l.note ? <p className="text-xs text-warning">{l.note}</p> : null}
                    </div>
                    <span className="shrink-0 text-muted tabular-nums">{formatCurrency(l.total, currency)}</span>
                  </li>
                ))}
              </ul>

              <dl className="flex flex-col gap-1 text-[0.8125rem] text-muted">
                <Line term="Subtotal" value={formatCurrency(o.subtotal, currency)} />
                {o.discount ? <Line term="Discount" value={`−${formatCurrency(o.discount, currency)}`} /> : null}
                {o.deliveryFee ? <Line term="Delivery" value={formatCurrency(o.deliveryFee, currency)} /> : null}
                {o.serviceFee ? <Line term="Service fee" value={formatCurrency(o.serviceFee, currency)} /> : null}
                <Line term="Tax" value={formatCurrency(o.tax, currency)} />
                {o.tip ? <Line term="Tip" value={formatCurrency(o.tip, currency)} /> : null}
                <Line term="Total" value={formatCurrency(o.total, currency)} strong />
                <Line term="Payment" value={`${o.paymentStatus.replace(/_/g, ' ')} · ${o.paymentMethod.replace(/_/g, ' ')}`} />
              </dl>
              {o.notes ? <p className="rounded-lg bg-warning-soft/50 px-3 py-2 text-[0.8125rem] text-foreground">{o.notes}</p> : null}
            </SheetBody>
            <SheetFooter className="flex-wrap gap-2">
              {step ? (
                <Button size="sm" onClick={() => onAdvance(o, step.status)}>
                  {step.label}
                </Button>
              ) : null}
              {isLive ? (
                <Button size="sm" variant="outline" onClick={() => onAdvance(o, 'cancelled')}>
                  Cancel order
                </Button>
              ) : o.status === 'completed' && o.paymentStatus === 'paid' ? (
                <Button size="sm" variant="outline" onClick={() => onAdvance(o, 'refunded')}>
                  Refund
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" leftIcon={<Printer />} onClick={() => toast('Ticket sent to the kitchen printer')}>
                Print
              </Button>
              <Button asChild size="sm" variant="ghost" className="ml-auto" rightIcon={<ArrowUpRight />}>
                <Link href={`/dashboard/customers/${o.customer.id}`}>Guest</Link>
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function Line({ term, value, strong = false }: { term: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className={strong ? 'text-foreground' : undefined}>{term}</dt>
      <dd className={cn('tabular-nums', strong ? 'text-foreground' : undefined)}>{value}</dd>
    </div>
  )
}

export const __count = formatNumber
