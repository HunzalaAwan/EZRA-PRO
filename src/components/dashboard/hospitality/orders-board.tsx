'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRightLeft, ArrowUpRight, BedDouble, Bike, Check, ChefHat, Columns3, List, MapPin, Phone, Plus, Printer, ShoppingBag } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/ui/data-table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toaster'
import { hm } from '@/lib/hospitality/hours'
import { LIVE_ORDER_STATUSES, ORDER_SOURCE_LABEL, ORDER_STATUS_META, ORDER_TYPE_LABEL, type Menu, type Order, type OrderStatus, type OrderType, type OrderingHours } from '@/lib/hospitality/types'
import { cn, formatCurrency, formatDateShort, formatNumber } from '@/lib/utils'
import type { CurrencyCode, Customer } from '@/types'

import { NewOrderDialog } from './new-order-dialog'
import { StatTile, StatusWord, clock, guestName, minutesBetween, shortDuration } from './shared'

/* ==========================================================================
   <OrdersBoard> — the pass.

   Live orders move left to right: New → In the kitchen → Ready → On the way
   → Done. A card is one order: number, where it is going (a pickup, a
   delivery area, a room), what is on it, when it was promised. Drag a card
   to any column, or pick the column from its Move menu; the button on the
   card still names the one usual next step. Tap the card for the ticket.
   Everything from the last two weeks sits in the list underneath.
   ========================================================================== */

type TypeFilter = 'all' | OrderType
type View = 'board' | 'list'
type StageKey = 'new' | 'kitchen' | 'ready' | 'road' | 'done'

const TYPE_ICON: Record<OrderType, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>> = {
  dine_in: BedDouble,
  pickup: ShoppingBag,
  delivery: Bike,
}

interface Stage {
  key: StageKey
  title: string
  statuses: OrderStatus[]
  hint: string
  /** The status an order takes when it lands here; null when this stage does not apply to it. */
  landing: (order: Order) => OrderStatus | null
}

const STAGES: Stage[] = [
  { key: 'new', title: 'New', statuses: ['new'], hint: 'Accept or turn down', landing: () => 'new' },
  { key: 'kitchen', title: 'In the kitchen', statuses: ['accepted', 'preparing'], hint: 'On the pass', landing: (o) => (o.status === 'new' ? 'accepted' : 'preparing') },
  { key: 'ready', title: 'Ready', statuses: ['ready'], hint: 'Waiting for the guest, the courier or the runner', landing: () => 'ready' },
  { key: 'road', title: 'On the way', statuses: ['out_for_delivery'], hint: 'With a courier', landing: (o) => (o.type === 'delivery' ? 'out_for_delivery' : null) },
  { key: 'done', title: 'Done', statuses: ['completed'], hint: 'Drop an order here when it is out the door', landing: () => 'completed' },
]

function stageOf(order: Order): StageKey | null {
  return STAGES.find((s) => s.statuses.includes(order.status))?.key ?? null
}

/** The one usual next step for an order, by type and status. */
function nextStep(order: Order): { label: string; status: OrderStatus } | null {
  switch (order.status) {
    case 'new':
      return { label: 'Accept', status: 'accepted' }
    case 'accepted':
      return { label: 'Start cooking', status: 'preparing' }
    case 'preparing':
      return { label: 'Ready', status: 'ready' }
    case 'ready':
      return order.type === 'delivery' ? { label: 'Dispatch', status: 'out_for_delivery' } : order.type === 'pickup' ? { label: 'Handed over', status: 'completed' } : { label: 'Sent up', status: 'completed' }
    case 'out_for_delivery':
      return { label: 'Delivered', status: 'completed' }
    default:
      return null
  }
}

function whereTo(o: Order) {
  return o.type === 'dine_in' ? `Room ${o.roomNumber ?? '—'}` : o.type === 'delivery' ? o.address?.area ?? 'Delivery' : 'Pickup'
}

export interface OrdersBoardProps {
  orders: Order[]
  menu: Menu
  ordering: OrderingHours
  taxRate: number
  /** The next ticket number for a phone order. */
  nextNumber: number
  recentGuests: Customer[]
  currency: CurrencyCode
  todayKey: string
  nowIso: string
  openNew?: boolean
}

export function OrdersBoard({ orders: initial, menu, ordering, taxRate, nextNumber, recentGuests, currency, todayKey, nowIso, openNew = false }: OrdersBoardProps) {
  const router = useRouter()
  const [orders, setOrders] = React.useState(initial)
  const [newOpen, setNewOpen] = React.useState(openNew)
  const roomService = ordering.roomService.enabled
  const typeOptions: { value: TypeFilter; label: string; icon?: typeof ShoppingBag }[] = [
    { value: 'all', label: 'All' },
    ...(roomService ? [{ value: 'dine_in' as TypeFilter, label: 'Room service', icon: BedDouble }] : []),
    { value: 'pickup', label: 'Pickup', icon: ShoppingBag },
    { value: 'delivery', label: 'Delivery', icon: Bike },
  ]
  const [type, setType] = React.useState<TypeFilter>('all')
  const [view, setView] = React.useState<View>('board')
  const [query, setQuery] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [sort, setSort] = React.useState<DataTableSort>({ id: 'placed', dir: 'desc' })
  const [limit, setLimit] = React.useState(60)
  const [dragId, setDragId] = React.useState<string | null>(null)
  const [overKey, setOverKey] = React.useState<StageKey | null>(null)

  const nowMin = hm(nowIso.slice(11, 16))

  const byType = React.useMemo(() => orders.filter((o) => (type === 'all' ? true : o.type === type)), [orders, type])
  const live = React.useMemo(() => byType.filter((o) => LIVE_ORDER_STATUSES.includes(o.status)), [byType])
  const doneToday = React.useMemo(() => byType.filter((o) => o.status === 'completed' && (o.completedAt ?? o.placedAt).startsWith(todayKey)).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')), [byType, todayKey])
  const today = React.useMemo(() => orders.filter((o) => o.placedAt.startsWith(todayKey)), [orders, todayKey])

  const stats = React.useMemo(() => {
    const liveAll = orders.filter((o) => LIVE_ORDER_STATUSES.includes(o.status))
    const done = today.filter((o) => o.status === 'completed')
    const revenueToday = done.reduce((s, o) => s + o.total, 0)
    const prep = done.filter((o) => o.readyAt).map((o) => minutesBetween(o.placedAt, o.readyAt as string))
    const avgPrep = prep.length ? Math.round(prep.reduce((a, b) => a + b, 0) / prep.length) : 0
    const late = liveAll.filter((o) => o.late).length
    const scheduled = liveAll.filter((o) => o.scheduledFor).length
    const mix = (['dine_in', 'pickup', 'delivery'] as OrderType[]).map((t) => ({ t, n: today.filter((o) => o.type === t && o.status !== 'cancelled').length })).filter((m) => m.n > 0)
    return { live: liveAll.length, late, scheduled, revenueToday, doneToday: done.length, avgPrep, mix }
  }, [orders, today])

  const history = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = byType.filter((o) => {
      if (!needle) return true
      return o.number.includes(needle) || guestName(o.customer).toLowerCase().includes(needle) || o.lines.some((l) => l.name.toLowerCase().includes(needle)) || (o.roomNumber ?? '').includes(needle)
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

  const advance = React.useCallback(
    (order: Order, status: OrderStatus) => {
      const stamp = nowIso
      setOrders((current) =>
        current.map((o) =>
          o.id === order.id
            ? {
                ...o,
                status,
                late: false,
                readyAt: status === 'ready' ? stamp : status === 'new' || status === 'accepted' || status === 'preparing' ? null : o.readyAt,
                completedAt: status === 'completed' ? stamp : status === 'cancelled' || status === 'refunded' ? o.completedAt : null,
                courier: status === 'out_for_delivery' && !o.courier ? { name: 'Next available', status: 'picking_up', etaMinutes: 18 } : status === 'completed' && o.courier ? { ...o.courier, status: 'delivered', etaMinutes: 0 } : o.courier,
                paymentStatus: status === 'refunded' ? 'refunded' : status === 'completed' && o.paymentStatus === 'pay_at_counter' ? 'paid' : o.paymentStatus,
              }
            : o,
        ),
      )
      const messages: Partial<Record<OrderStatus, string>> = {
        new: `${order.number} back in New`,
        accepted: `${order.number} accepted`,
        preparing: `${order.number} is on the pass`,
        ready: `${order.number} ready · ${order.type === 'pickup' ? 'guest texted' : order.type === 'delivery' ? 'courier called' : `runner to room ${order.roomNumber ?? ''}`}`,
        out_for_delivery: `${order.number} out for delivery`,
        completed: `${order.number} done`,
        cancelled: `${order.number} cancelled`,
        refunded: `${order.number} refunded ${formatCurrency(order.total, currency)}`,
      }
      toast(messages[status] ?? order.number)
    },
    [currency, nowIso],
  )

  /** Put an order in a column, whatever column it is in now. */
  const moveTo = React.useCallback(
    (order: Order, key: StageKey) => {
      const stage = STAGES.find((s) => s.key === key)
      if (!stage || stageOf(order) === key) return
      const status = stage.landing(order)
      if (!status) {
        toast(`${order.number} is a ${ORDER_TYPE_LABEL[order.type].toLowerCase()} order`, { description: 'Only delivery orders go on the way.' })
        return
      }
      advance(order, status)
    },
    [advance],
  )

  const create = (order: Order) => {
    setOrders((current) => [order, ...current])
    setNewOpen(false)
    if (openNew) router.replace('/dashboard/orders')
    toast.success(`${order.number} taken over the phone`, {
      description: `${order.type === 'dine_in' ? `Room ${order.roomNumber}` : ORDER_TYPE_LABEL[order.type]} · ${order.scheduledFor ? `for ${clock(order.scheduledFor)}` : `ready around ${clock(order.promisedAt)}`} · ${formatCurrency(order.total, currency)}`,
    })
  }

  const selected = selectedId ? orders.find((o) => o.id === selectedId) ?? null : null

  /* ---------- drag and drop ---------- */

  const dropOn = (key: StageKey, event: React.DragEvent) => {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain') || dragId
    const order = id ? orders.find((o) => o.id === id) : null
    if (order) moveTo(order, key)
    setOverKey(null)
    setDragId(null)
  }

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
        width: '7.5rem',
        cell: (o) => {
          const Icon = TYPE_ICON[o.type]
          return (
            <span className="inline-flex items-center gap-1.5 text-[0.8125rem] text-muted">
              <Icon className="size-3.5 text-faint" aria-hidden="true" />
              {whereTo(o)}
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

  const visibleStages = STAGES.filter((s) => !(s.key === 'road' && type !== 'all' && type !== 'delivery'))

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- numbers ---------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Live" hint="on the board" value={stats.live} line={stats.scheduled ? `${stats.scheduled} scheduled for later` : 'All for now'} tone="bg-primary" />
        <StatTile label="Running late" hint="past the promise" value={stats.late} line={stats.late ? 'Call the guest before they call you' : 'Everything on time'} tone={stats.late ? 'bg-danger' : 'bg-success'} />
        <StatTile label="Today so far" hint={`${stats.doneToday} done`} value={formatCurrency(stats.revenueToday, currency, { compact: true })} line={stats.mix.map((m) => `${ORDER_TYPE_LABEL[m.t]} ${m.n}`).join(' · ') || 'Nothing yet today'} />
        <StatTile label="Kitchen time" hint="order to ready, today" value={stats.avgPrep ? shortDuration(stats.avgPrep) : '—'} line={roomService ? `Room service promise ${ordering.roomService.leadMinutes} min` : 'Promise is prep plus five minutes'} />
      </div>

      <Card className="min-w-0">
        {/* ---------- toolbar ---------- */}
        <div className="flex flex-col gap-3 border-b border-line-subtle px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Segmented size="sm" label="Order type" options={typeOptions} value={type} onValueChange={setType} hideLabelsOnMobile />
            {view === 'list' ? <SearchInput value={query} onValueChange={setQuery} placeholder={roomService ? 'Order, guest, room or dish…' : 'Order, guest or dish…'} size="sm" aria-label="Search orders" fieldClassName="w-full sm:w-56" /> : <p className="hidden text-xs text-subtle xl:block">Drag a card to any column, or use its Move menu.</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
            <Button size="sm" leftIcon={<Plus />} onClick={() => setNewOpen(true)}>
              New order
            </Button>
          </div>
        </div>

        {view === 'board' ? (
          <CardContent className="p-3 sm:p-4">
            {live.length === 0 && doneToday.length === 0 ? (
              <EmptyState variant="no-data" size="sm" icon={ChefHat} title="Nothing on the pass" description="New orders land here the moment a guest pays, or when you take one on the phone." />
            ) : (
              <div className={cn('grid gap-3 md:grid-cols-2', visibleStages.length === 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4')}>
                {visibleStages.map((stage) => {
                  const cards = stage.key === 'done' ? doneToday.slice(0, 6) : live.filter((o) => stage.statuses.includes(o.status)).sort((a, b) => a.promisedAt.localeCompare(b.promisedAt))
                  const count = stage.key === 'done' ? doneToday.length : cards.length
                  const over = overKey === stage.key && dragId !== null
                  return (
                    <section
                      key={stage.key}
                      aria-label={stage.title}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        if (overKey !== stage.key) setOverKey(stage.key)
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverKey((k) => (k === stage.key ? null : k))
                      }}
                      onDrop={(e) => dropOn(stage.key, e)}
                      className={cn('flex min-w-0 flex-col rounded-xl p-2 transition-colors', over ? 'bg-primary-soft/50 ring-2 ring-primary/40 ring-inset' : 'bg-surface-sunken/60', stage.key === 'done' && !over && 'bg-surface-sunken/30')}
                    >
                      <header className="flex items-center justify-between px-1.5 pt-1 pb-2">
                        <span className="text-xs font-medium text-muted">{stage.title}</span>
                        <span className="text-xs text-faint tabular-nums">{count}</span>
                      </header>
                      <div className="flex min-h-[6rem] flex-1 flex-col gap-2">
                        {cards.length === 0 ? <p className="px-1.5 py-6 text-center text-xs text-faint">{over ? 'Drop to move here' : stage.hint}</p> : null}
                        {cards.map((o) => (
                          <OrderCard
                            key={o.id}
                            order={o}
                            currency={currency}
                            nowMin={nowMin}
                            dragging={dragId === o.id}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', o.id)
                              e.dataTransfer.effectAllowed = 'move'
                              setDragId(o.id)
                            }}
                            onDragEnd={() => {
                              setDragId(null)
                              setOverKey(null)
                            }}
                            onOpen={() => setSelectedId(o.id)}
                            onAdvance={advance}
                            onMove={moveTo}
                          />
                        ))}
                        {stage.key === 'done' && doneToday.length > 6 ? (
                          <button type="button" className="px-1.5 py-2 text-center text-xs text-muted hover:text-foreground" onClick={() => setView('list')}>
                            {doneToday.length - 6} more in History
                          </button>
                        ) : null}
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

      <OrderSheet order={selected} currency={currency} onClose={() => setSelectedId(null)} onAdvance={advance} onMove={moveTo} />
      <NewOrderDialog
        open={newOpen}
        onOpenChange={(open) => {
          setNewOpen(open)
          if (!open && openNew) router.replace('/dashboard/orders')
        }}
        menu={menu}
        ordering={ordering}
        currency={currency}
        taxRate={taxRate}
        nextNumber={nextNumber + orders.length - initial.length}
        guests={recentGuests}
        todayKey={todayKey}
        nowIso={nowIso}
        tenantId={orders[0]?.tenantId ?? menu.items[0]?.tenantId ?? ''}
        onCreate={create}
      />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Move menu — every column, with the one the order is in ticked
   -------------------------------------------------------------------------- */

function MoveMenu({ order, size = 'xs', label, onMove, onAdvance }: { order: Order; size?: 'xs' | 'sm'; label?: string; onMove: (order: Order, key: StageKey) => void; onAdvance: (order: Order, status: OrderStatus) => void }) {
  const current = stageOf(order)
  const isLive = LIVE_ORDER_STATUSES.includes(order.status)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {label ? (
          <Button size={size} variant="outline" leftIcon={<ArrowRightLeft />}>
            {label}
          </Button>
        ) : (
          <IconButton size={size} variant="ghost" aria-label={`Move ${order.number}`}>
            <ArrowRightLeft />
          </IconButton>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {STAGES.map((stage) => {
          const here = stage.key === current
          const status = stage.landing(order)
          return (
            <DropdownMenuItem key={stage.key} disabled={here || status === null} onSelect={() => onMove(order, stage.key)}>
              <span className="flex w-full items-center justify-between gap-4">
                <span>{stage.title}</span>
                {here ? <Check className="size-3.5 text-muted" aria-hidden="true" /> : status ? <span className="text-xs text-subtle">{ORDER_STATUS_META[status].label}</span> : <span className="text-xs text-faint">delivery only</span>}
              </span>
            </DropdownMenuItem>
          )
        })}
        {isLive ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem tone="danger" onSelect={() => onAdvance(order, 'cancelled')}>
              Cancel order
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* --------------------------------------------------------------------------
   Card
   -------------------------------------------------------------------------- */

function OrderCard({ order: o, currency, nowMin, dragging, onDragStart, onDragEnd, onOpen, onAdvance, onMove }: { order: Order; currency: CurrencyCode; nowMin: number; dragging: boolean; onDragStart: (e: React.DragEvent) => void; onDragEnd: () => void; onOpen: () => void; onAdvance: (order: Order, status: OrderStatus) => void; onMove: (order: Order, key: StageKey) => void }) {
  const Icon = TYPE_ICON[o.type]
  const step = nextStep(o)
  const promised = hm(o.promisedAt.slice(11, 16))
  const sameDay = o.promisedAt.slice(0, 10) === o.placedAt.slice(0, 10)
  const minutesLeft = promised - nowMin
  const done = o.status === 'completed'
  const timing = done ? `done ${o.completedAt ? clock(o.completedAt) : ''}` : o.scheduledFor ? `for ${clock(o.scheduledFor)}` : o.late ? `${shortDuration(-minutesLeft)} late` : minutesLeft <= 0 ? 'due now' : `${shortDuration(minutesLeft)} left`
  return (
    <article draggable onDragStart={onDragStart} onDragEnd={onDragEnd} className={cn('cursor-grab rounded-lg border bg-surface p-3 transition-opacity active:cursor-grabbing', o.late ? 'border-danger/50' : 'border-line', dragging && 'opacity-40', done && 'opacity-80')}>
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[0.8125rem] text-foreground tabular-nums">{o.number}</span>
          <span className={cn('text-xs tabular-nums', o.late && !done ? 'text-danger' : 'text-subtle')}>{sameDay || done ? timing : formatDateShort(o.promisedAt)}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          <Icon className="size-3.5 text-faint" aria-hidden="true" />
          <span className="truncate">{whereTo(o)}</span>
          <span className="text-faint">·</span>
          <span className="truncate">{guestName(o.customer)}</span>
        </div>
        {!done ? (
          <ul className="mt-2 flex flex-col gap-0.5 text-[0.8125rem] text-foreground">
            {o.lines.slice(0, 3).map((l) => (
              <li key={l.id} className="flex gap-2">
                <span className="w-5 shrink-0 text-subtle tabular-nums">{l.qty}×</span>
                <span className="truncate">{l.name}</span>
              </li>
            ))}
            {o.lines.length > 3 ? <li className="pl-7 text-xs text-subtle">+{o.lines.length - 3} more</li> : null}
          </ul>
        ) : (
          <p className="mt-1.5 truncate text-xs text-subtle">{o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}</p>
        )}
        {o.notes && !done ? <p className="mt-2 truncate text-xs text-warning">{o.notes}</p> : null}
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs text-muted tabular-nums">{formatCurrency(o.total, currency)}</span>
        <span className="flex items-center gap-1">
          <MoveMenu order={o} onMove={onMove} onAdvance={onAdvance} />
          {step ? (
            <Button size="xs" variant={o.status === 'new' ? 'primary' : 'secondary'} onClick={() => onAdvance(o, step.status)}>
              {step.label}
            </Button>
          ) : null}
        </span>
      </div>
    </article>
  )
}

/* --------------------------------------------------------------------------
   Ticket
   -------------------------------------------------------------------------- */

function OrderSheet({ order: o, currency, onClose, onAdvance, onMove }: { order: Order | null; currency: CurrencyCode; onClose: () => void; onAdvance: (order: Order, status: OrderStatus) => void; onMove: (order: Order, key: StageKey) => void }) {
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
              {o.type === 'dine_in' ? (
                <div className="flex items-start gap-2 text-[0.8125rem]">
                  <BedDouble aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-faint" />
                  <p className="text-muted">
                    Room service · room {o.roomNumber ?? '—'}
                    {o.paymentStatus === 'room_charge' ? ' · charged to the folio' : ''}
                  </p>
                </div>
              ) : null}

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
                {o.serviceFee ? <Line term={o.type === 'dine_in' ? 'Tray charge' : 'Service fee'} value={formatCurrency(o.serviceFee, currency)} /> : null}
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
              {isLive || o.status === 'completed' ? <MoveMenu order={o} size="sm" label="Move to" onMove={onMove} onAdvance={onAdvance} /> : null}
              {!isLive && o.status === 'completed' && o.paymentStatus === 'paid' ? (
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
