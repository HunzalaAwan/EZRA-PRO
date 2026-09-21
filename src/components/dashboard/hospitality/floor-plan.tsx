'use client'

import * as React from 'react'
import Link from 'next/link'
import { Armchair, Check, Plus, X } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toaster'
import { hm } from '@/lib/hospitality/floor'
import {
  RESERVATION_STATUS_META,
  TABLE_STATUS_META,
  type DiningTable,
  type FloorZone,
  type Order,
  type ServicePeriod,
  type TableReservation,
  type TableStatus,
} from '@/lib/hospitality/types'
import { cn, formatCurrency } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import { Dot, StatTile, StatusWord, Stepper, guestName, shortDuration } from './shared'

/* ==========================================================================
   <FloorPlan> — the room, right now.

   Each zone is a small grid of tables in the shape of the room. A table
   shows its name, its seats, its state, and who is on it or due next. Tap a
   table to seat a walk-in, ask for the bill, clear it, or take it out of
   the book for the night.
   ========================================================================== */

export interface FloorPlanProps {
  zones: FloorZone[]
  tables: DiningTable[]
  /** Today's reservations, all statuses. */
  reservations: TableReservation[]
  /** Live dine-in orders. */
  orders: Order[]
  periods: ServicePeriod[]
  currency: CurrencyCode
  todayKey: string
  nowTime: string
}

export function FloorPlan({ zones, tables: initialTables, reservations: initialReservations, orders, periods, currency, todayKey, nowTime }: FloorPlanProps) {
  const [tables, setTables] = React.useState(initialTables)
  const [reservations, setReservations] = React.useState(initialReservations)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [walkInOpen, setWalkInOpen] = React.useState(false)

  const nowMin = hm(nowTime)
  const reservationById = React.useMemo(() => new Map(reservations.map((r) => [r.id, r])), [reservations])
  const ordersByTable = React.useMemo(() => {
    const map = new Map<string, Order[]>()
    for (const o of orders) if (o.tableId) map.set(o.tableId, [...(map.get(o.tableId) ?? []), o])
    return map
  }, [orders])

  const service = periods.find((p) => hm(p.startTime) <= nowMin && hm(p.endTime) > nowMin) ?? null
  const nextService = periods.find((p) => hm(p.startTime) > nowMin) ?? null

  const stats = React.useMemo(() => {
    const seated = tables.filter((t) => t.status === 'seated' || t.status === 'ordered' || t.status === 'bill')
    const seatedCovers = seated.reduce((sum, t) => sum + (t.currentReservationId ? reservationById.get(t.currentReservationId)?.partySize ?? 0 : 0), 0)
    const free = tables.filter((t) => t.status === 'free').length
    const arrivingSoon = reservations.filter((r) => (r.status === 'booked' || r.status === 'confirmed') && hm(r.time) > nowMin && hm(r.time) - nowMin <= 60)
    const reset = tables.filter((t) => t.status === 'needs_reset').length
    const bills = tables.filter((t) => t.status === 'bill').length
    return { seatedTables: seated.length, seatedCovers, free, arriving: arrivingSoon.length, arrivingCovers: arrivingSoon.reduce((s, r) => s + r.partySize, 0), reset, bills }
  }, [tables, reservations, reservationById, nowMin])

  /* ---------- actions ---------- */

  const setTable = (id: string, change: (t: DiningTable) => DiningTable) => setTables((current) => current.map((t) => (t.id === id ? change(t) : t)))
  const setReservation = (id: string, change: (r: TableReservation) => TableReservation) => setReservations((current) => current.map((r) => (r.id === id ? change(r) : r)))

  const seatWalkIn = (table: DiningTable, party: number, name: string) => {
    const [first, ...rest] = (name.trim() || 'Walk-in').split(/\s+/)
    const id = `rsv_walkin_${Date.now().toString(36)}`
    const row: TableReservation = {
      id,
      tenantId: table.tenantId,
      customer: {
        id: `cus_walkin_${Date.now().toString(36)}`,
        tenantId: table.tenantId,
        firstName: first,
        lastName: rest.join(' '),
        email: '',
        phone: '',
        country: '',
        createdAt: `${todayKey}T${nowTime}:00`,
        totalBookings: 0,
        lifetimeValue: 0,
        lastBookingAt: null,
        tags: [],
        marketingOptIn: false,
        segment: 'new',
      },
      partySize: party,
      date: todayKey,
      time: nowTime,
      startsAt: `${todayKey}T${nowTime}:00`,
      durationMinutes: 90,
      period: service?.id ?? nextService?.id ?? periods[0].id,
      tableIds: [table.id],
      status: 'seated',
      source: 'walk_in',
      occasion: null,
      notes: null,
      allergies: null,
      highChairs: 0,
      deposit: null,
      stayId: null,
      createdAt: `${todayKey}T${nowTime}:00`,
      seatedAt: `${todayKey}T${nowTime}:00`,
      finishedAt: null,
    }
    setReservations((current) => [...current, row])
    setTable(table.id, (t) => ({ ...t, status: 'seated', currentReservationId: id }))
    setWalkInOpen(false)
    setSelectedId(null)
    toast.success(`Party of ${party} seated on ${table.name}`)
  }

  const seatReservation = (table: DiningTable, reservation: TableReservation) => {
    setReservation(reservation.id, (r) => ({ ...r, status: 'seated', seatedAt: `${todayKey}T${nowTime}:00`, tableIds: [table.id] }))
    setTable(table.id, (t) => ({ ...t, status: 'seated', currentReservationId: reservation.id, nextReservationId: null }))
    toast.success(`${guestName(reservation.customer)} seated on ${table.name}`)
  }

  const askBill = (table: DiningTable) => {
    setTable(table.id, (t) => ({ ...t, status: 'bill' }))
    toast(`${table.name} on the bill`)
  }

  const clear = (table: DiningTable) => {
    if (table.currentReservationId) setReservation(table.currentReservationId, (r) => ({ ...r, status: 'finished', finishedAt: `${todayKey}T${nowTime}:00` }))
    setTable(table.id, (t) => ({ ...t, status: 'needs_reset', currentReservationId: null }))
    toast(`${table.name} cleared · needs a reset`)
  }

  const reset = (table: DiningTable) => {
    const next = table.nextReservationId ? reservationById.get(table.nextReservationId) : null
    setTable(table.id, (t) => ({ ...t, status: next && hm(next.time) - nowMin <= 60 ? 'reserved' : 'free' }))
    toast.success(`${table.name} reset and ready`)
  }

  const toggleBlock = (table: DiningTable) => {
    const blocked = table.status === 'blocked'
    setTable(table.id, (t) => ({ ...t, status: blocked ? 'free' : 'blocked' }))
    toast(blocked ? `${table.name} back in the book` : `${table.name} blocked for tonight`)
  }

  const selected = selectedId ? tables.find((t) => t.id === selectedId) ?? null : null
  const maxCols = (zone: FloorZone) => Math.max(...tables.filter((t) => t.zoneId === zone.id).map((t) => t.col + t.colSpan - 1), 1)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Seated" hint={`${stats.seatedTables} ${stats.seatedTables === 1 ? 'table' : 'tables'}`} value={stats.seatedCovers} line={service ? `${service.name} · ${service.startTime}–${service.endTime}` : nextService ? `Between services · ${nextService.name} at ${nextService.startTime}` : 'Closed'} tone="bg-success" />
        <StatTile label="Free" hint="no one due in the hour" value={stats.free} line={`${tables.length} tables · ${tables.reduce((s, t) => s + t.seats, 0)} seats in the room`} tone="bg-line-strong" />
        <StatTile label="Arriving" hint="next 60 minutes" value={stats.arriving} line={stats.arriving ? `${stats.arrivingCovers} covers to seat` : 'Nobody due'} tone="bg-info" />
        <StatTile label="Needs a hand" hint="bills and resets" value={stats.bills + stats.reset} line={`${stats.bills} on the bill · ${stats.reset} to reset`} tone={stats.bills + stats.reset ? 'bg-warning' : 'bg-line-strong'} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-line-subtle px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {(Object.keys(TABLE_STATUS_META) as TableStatus[]).map((s) => (
              <li key={s}>
                <StatusWord label={TABLE_STATUS_META[s].label} tone={TABLE_STATUS_META[s].tone} title={TABLE_STATUS_META[s].hint} className="text-xs" />
              </li>
            ))}
          </ul>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/reservations">Open the book</Link>
            </Button>
            <Button size="sm" leftIcon={<Plus />} onClick={() => setWalkInOpen(true)}>
              Seat a walk-in
            </Button>
          </div>
        </div>

        <CardContent className="flex flex-col gap-8 p-4 sm:p-5">
          {zones.map((zone) => {
            const zoneTables = tables.filter((t) => t.zoneId === zone.id)
            const seated = zoneTables.filter((t) => t.status === 'seated' || t.status === 'ordered' || t.status === 'bill').length
            return (
              <section key={zone.id} aria-label={zone.name}>
                <header className="mb-3 flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-medium text-foreground">{zone.name}</h2>
                    <p className="truncate text-xs text-subtle">{zone.description}</p>
                  </div>
                  <span className="shrink-0 text-xs text-subtle tabular-nums">
                    {seated} / {zoneTables.length} seated{zone.outdoor ? ' · outdoor' : ''}
                  </span>
                </header>
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(4, maxCols(zone))}, minmax(0, 1fr))` }}>
                  {zoneTables.map((t) => (
                    <TableCard key={t.id} table={t} reservation={t.currentReservationId ? reservationById.get(t.currentReservationId) ?? null : null} next={t.nextReservationId ? reservationById.get(t.nextReservationId) ?? null : null} hasOrder={(ordersByTable.get(t.id) ?? []).length > 0} nowMin={nowMin} onClick={() => setSelectedId(t.id)} />
                  ))}
                </div>
              </section>
            )
          })}
        </CardContent>
      </Card>

      <TableSheet
        table={selected}
        zone={selected ? zones.find((z) => z.id === selected.zoneId) ?? null : null}
        reservation={selected?.currentReservationId ? reservationById.get(selected.currentReservationId) ?? null : null}
        next={selected?.nextReservationId ? reservationById.get(selected.nextReservationId) ?? null : null}
        orders={selected ? ordersByTable.get(selected.id) ?? [] : []}
        currency={currency}
        nowMin={nowMin}
        onClose={() => setSelectedId(null)}
        onSeatWalkIn={seatWalkIn}
        onSeatReservation={seatReservation}
        onBill={askBill}
        onClear={clear}
        onReset={reset}
        onToggleBlock={toggleBlock}
      />

      <WalkInDialog open={walkInOpen} onOpenChange={setWalkInOpen} tables={tables} zones={zones} onSeat={seatWalkIn} />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Table card
   -------------------------------------------------------------------------- */

const SHAPE_CLASS = {
  round: 'rounded-[1.5rem]',
  square: 'rounded-xl',
  rect: 'rounded-xl',
  high: 'rounded-xl border-dashed',
} as const

function TableCard({ table: t, reservation, next, hasOrder, nowMin, onClick }: { table: DiningTable; reservation: TableReservation | null; next: TableReservation | null; hasOrder: boolean; nowMin: number; onClick: () => void }) {
  const meta = TABLE_STATUS_META[t.status]
  const occupied = t.status === 'seated' || t.status === 'ordered' || t.status === 'bill'
  const since = reservation?.seatedAt ? nowMin - hm(reservation.seatedAt.slice(11, 16)) : null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${t.name}, ${t.seats} seats, ${meta.label}`}
      style={{ gridColumn: `${t.col} / span ${t.colSpan}`, gridRow: `${t.row} / span ${t.rowSpan}` }}
      className={cn(
        'flex min-h-[5.5rem] flex-col justify-between border bg-surface p-2.5 text-left transition-colors hover:border-line-strong',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        SHAPE_CLASS[t.shape],
        occupied ? 'border-line-strong' : 'border-line',
        t.status === 'blocked' && 'opacity-50',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-[0.8125rem] text-foreground">{t.name}</span>
        <span className="text-xs text-faint tabular-nums">{t.seats}</span>
      </div>
      <div className="min-w-0">
        {reservation ? (
          <>
            <p className="truncate text-xs text-foreground">{guestName(reservation.customer)}</p>
            <p className="truncate text-[0.6875rem] text-subtle tabular-nums">
              {reservation.partySize} · {since !== null && since >= 0 ? shortDuration(since) : reservation.time}
              {hasOrder ? ' · ordered' : ''}
            </p>
          </>
        ) : next ? (
          <>
            <p className="truncate text-xs text-muted">{guestName(next.customer)}</p>
            <p className="truncate text-[0.6875rem] text-subtle tabular-nums">
              {next.partySize} at {next.time}
            </p>
          </>
        ) : (
          <p className="text-[0.6875rem] text-faint">{t.status === 'blocked' ? 'Out of the book' : t.status === 'needs_reset' ? 'Clear and relay' : 'Open'}</p>
        )}
      </div>
      <span className="inline-flex items-center gap-1.5 text-[0.6875rem] text-muted">
        <Dot tone={meta.tone} />
        {meta.label}
      </span>
    </button>
  )
}

/* --------------------------------------------------------------------------
   Table sheet
   -------------------------------------------------------------------------- */

function TableSheet({ table: t, zone, reservation, next, orders, currency, nowMin, onClose, onSeatWalkIn, onSeatReservation, onBill, onClear, onReset, onToggleBlock }: { table: DiningTable | null; zone: FloorZone | null; reservation: TableReservation | null; next: TableReservation | null; orders: Order[]; currency: CurrencyCode; nowMin: number; onClose: () => void; onSeatWalkIn: (table: DiningTable, party: number, name: string) => void; onSeatReservation: (table: DiningTable, reservation: TableReservation) => void; onBill: (table: DiningTable) => void; onClear: (table: DiningTable) => void; onReset: (table: DiningTable) => void; onToggleBlock: (table: DiningTable) => void }) {
  const [party, setParty] = React.useState(2)
  const [name, setName] = React.useState('')
  React.useEffect(() => {
    if (t) {
      setParty(Math.min(2, t.seats))
      setName('')
    }
  }, [t])
  if (!t) return <Sheet open={false} onOpenChange={() => undefined} />
  const meta = TABLE_STATUS_META[t.status]
  const occupied = t.status === 'seated' || t.status === 'ordered' || t.status === 'bill'
  const openTotal = orders.reduce((s, o) => s + o.total, 0)
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" size="md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {t.name}
            <StatusWord label={meta.label} tone={meta.tone} />
          </SheetTitle>
          <SheetDescription>
            {zone?.name} · {t.seats} seats · seats parties of {t.minSeats}–{t.seats}
            {t.joinable ? ' · joins with a neighbour' : ''}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-5">
          {reservation ? (
            <div className="rounded-lg border border-line p-3">
              <div className="flex items-center gap-3">
                <Avatar name={guestName(reservation.customer)} src={reservation.customer.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] text-foreground">{guestName(reservation.customer)}</p>
                  <p className="text-xs text-subtle tabular-nums">
                    Party of {reservation.partySize} · booked {reservation.time}
                    {reservation.seatedAt ? ` · seated ${reservation.seatedAt.slice(11, 16)} (${shortDuration(nowMin - hm(reservation.seatedAt.slice(11, 16)))})` : ''}
                  </p>
                </div>
                <StatusWord label={RESERVATION_STATUS_META[reservation.status].label} tone={RESERVATION_STATUS_META[reservation.status].tone} />
              </div>
              {reservation.allergies ? <p className="mt-2 text-xs text-warning">Allergy: {reservation.allergies}</p> : null}
              {reservation.notes ? <p className="mt-2 text-xs text-muted">{reservation.notes}</p> : null}
              {orders.length ? (
                <ul className="mt-3 divide-y divide-line-subtle border-t border-line-subtle text-xs">
                  {orders.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="truncate text-muted">
                        {o.number} · {o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}
                      </span>
                      <span className="shrink-0 text-foreground tabular-nums">{formatCurrency(o.total, currency)}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between gap-2 py-1.5 text-foreground">
                    <span>Open on the table</span>
                    <span className="tabular-nums">{formatCurrency(openTotal, currency)}</span>
                  </li>
                </ul>
              ) : null}
            </div>
          ) : null}

          {next ? (
            <div className="text-[0.8125rem]">
              <p className="text-xs font-medium text-muted">Next on this table</p>
              <div className="mt-1.5 flex items-center gap-3">
                <Avatar name={guestName(next.customer)} src={next.customer.avatarUrl} size="xs" />
                <span className="min-w-0 flex-1 truncate text-foreground">{guestName(next.customer)}</span>
                <span className="shrink-0 text-muted tabular-nums">
                  {next.partySize} at {next.time}
                </span>
                {!occupied && hm(next.time) - nowMin <= 30 ? (
                  <Button size="xs" variant="secondary" onClick={() => onSeatReservation(t, next)}>
                    Seat
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}

          {!occupied && t.status !== 'blocked' ? (
            <div className="rounded-lg bg-surface-sunken p-3">
              <p className="text-xs font-medium text-muted">Seat a walk-in here</p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <Stepper value={party} min={1} max={t.seats} onChange={setParty} label="guests" />
                <Input size="sm" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" aria-label="Walk-in name" className="w-40" />
                <Button size="sm" leftIcon={<Armchair />} onClick={() => onSeatWalkIn(t, party, name)}>
                  Seat {party}
                </Button>
              </div>
            </div>
          ) : null}
        </SheetBody>
        <SheetFooter className="flex-wrap gap-2">
          {t.status === 'seated' || t.status === 'ordered' ? (
            <Button size="sm" onClick={() => onBill(t)}>
              Ask for the bill
            </Button>
          ) : null}
          {occupied ? (
            <Button size="sm" variant={t.status === 'bill' ? 'primary' : 'secondary'} onClick={() => onClear(t)}>
              Clear table
            </Button>
          ) : null}
          {t.status === 'needs_reset' ? (
            <Button size="sm" leftIcon={<Check />} onClick={() => onReset(t)}>
              Reset done
            </Button>
          ) : null}
          {!occupied ? (
            <Button size="sm" variant="ghost" onClick={() => onToggleBlock(t)}>
              {t.status === 'blocked' ? 'Put back in the book' : 'Block for tonight'}
            </Button>
          ) : null}
          {reservation ? (
            <Button asChild size="sm" variant="ghost" className="ml-auto">
              <Link href={`/dashboard/customers/${reservation.customer.id}`}>Guest profile</Link>
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* --------------------------------------------------------------------------
   Walk-in dialog
   -------------------------------------------------------------------------- */

function WalkInDialog({ open, onOpenChange, tables, zones, onSeat }: { open: boolean; onOpenChange: (open: boolean) => void; tables: DiningTable[]; zones: FloorZone[]; onSeat: (table: DiningTable, party: number, name: string) => void }) {
  const [party, setParty] = React.useState(2)
  const [name, setName] = React.useState('')
  const [tableId, setTableId] = React.useState('')
  const zoneById = new Map(zones.map((z) => [z.id, z]))
  const fits = tables.filter((t) => (t.status === 'free' || t.status === 'reserved') && t.seats >= party && t.minSeats <= party).sort((a, b) => (a.status === b.status ? a.seats - b.seats : a.status === 'free' ? -1 : 1))
  React.useEffect(() => {
    if (!fits.some((t) => t.id === tableId)) setTableId(fits[0]?.id ?? '')
  }, [fits, tableId])
  const table = fits.find((t) => t.id === tableId)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader divider>
          <DialogTitle>Seat a walk-in</DialogTitle>
          <DialogDescription>Free tables that fit the party, smallest first. Reserved tables are shown when the next party is more than an hour away.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-4">
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Party">
              <Stepper value={party} min={1} max={12} onChange={setParty} label="guests" />
            </Field>
            <Field label="Name" optional className="min-w-0 flex-1">
              {(control) => <Input {...control} value={name} onChange={(e) => setName(e.target.value)} placeholder="If they gave one" />}
            </Field>
          </div>
          <Field label="Table" description={fits.length ? `${fits.length} tables fit a party of ${party}` : 'Nothing fits right now — add them to the waitlist from the book.'}>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {fits.slice(0, 12).map((t) => {
                const active = t.id === tableId
                return (
                  <button key={t.id} type="button" aria-pressed={active} onClick={() => setTableId(t.id)} className={cn('flex flex-col rounded-lg border p-2 text-left transition-colors', active ? 'border-primary bg-primary-soft/40' : 'border-line bg-surface hover:border-line-strong')}>
                    <span className="text-[0.8125rem] text-foreground">{t.name}</span>
                    <span className="truncate text-[0.6875rem] text-subtle">
                      {t.seats} seats · {zoneById.get(t.zoneId)?.name}
                    </span>
                    <span className="mt-1 inline-flex items-center gap-1 text-[0.6875rem] text-muted">
                      <Dot tone={TABLE_STATUS_META[t.status].tone} />
                      {TABLE_STATUS_META[t.status].label}
                    </span>
                  </button>
                )
              })}
            </div>
          </Field>
        </DialogBody>
        <DialogFooter divider className="sm:justify-between">
          <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" leftIcon={<Armchair />} disabled={!table} onClick={() => table && onSeat(table, party, name)}>
            Seat on {table?.name ?? '—'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function FloorPlanFooter() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">How the floor reads</CardTitle>
        <CardDescription>The floor updates itself from the book and the pass; you only touch it for walk-ins, bills and resets.</CardDescription>
      </CardHeader>
    </Card>
  )
}
