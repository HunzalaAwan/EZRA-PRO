'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  List,
  MoreHorizontal,
  Plus,
  Rows3,
  Send,
  StickyNote,
  X,
} from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { hm, mh, seatingTimes, turnMinutesFor } from '@/lib/hospitality/floor'
import {
  OCCASION_LABEL,
  RESERVATION_SOURCE_LABEL,
  RESERVATION_STATUS_META,
  type DiningSettings,
  type DiningTable,
  type FloorZone,
  type Occasion,
  type ReservationStatus,
  type ServiceKey,
  type ServicePeriod,
  type TableReservation,
} from '@/lib/hospitality/types'
import { addDays, cn, formatCurrency, formatDateShort, formatNumber, fromDateKey, toDateKey } from '@/lib/utils'
import type { CurrencyCode, Customer } from '@/types'

import { BandHeader, Dot, StatTile, StatusWord, Stepper, guestName } from './shared'

/* ==========================================================================
   <ReservationsClient> — the book for one day.

   A strip of days, the service periods as tabs, then either the list (who,
   when, how many, which table, where they came from, where they are) or the
   timeline (tables down the side, the evening across the top). Every status
   change is one click and applied in memory with a toast.
   ========================================================================== */

type PeriodFilter = 'all' | ServiceKey
type StatusFilter = 'all' | 'upcoming' | 'here' | 'finished' | 'waitlist' | 'cancelled'
type View = 'list' | 'timeline'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'here', label: 'Here now' },
  { value: 'finished', label: 'Finished' },
  { value: 'waitlist', label: 'Waitlist' },
  { value: 'cancelled', label: 'Cancelled' },
]

const UPCOMING: ReservationStatus[] = ['booked', 'confirmed']
const HERE: ReservationStatus[] = ['arrived', 'seated']
const CLOSED: ReservationStatus[] = ['finished', 'no_show', 'cancelled']

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface ReservationsClientProps {
  reservations: TableReservation[]
  tables: DiningTable[]
  zones: FloorZone[]
  settings: DiningSettings
  currency: CurrencyCode
  todayKey: string
  /** "HH:MM" on the frozen clock. */
  nowTime: string
  /** Lead guests the new-reservation form can suggest. */
  recentGuests: Customer[]
  openNew?: boolean
  hotel?: boolean
}

export function ReservationsClient({ reservations: initial, tables, zones, settings, currency, todayKey, nowTime, recentGuests, openNew = false, hotel = false }: ReservationsClientProps) {
  const router = useRouter()
  const [rows, setRows] = React.useState(initial)
  const [dateKey, setDateKey] = React.useState(todayKey)
  const [period, setPeriod] = React.useState<PeriodFilter>('all')
  const [status, setStatus] = React.useState<StatusFilter>('all')
  const [query, setQuery] = React.useState('')
  const [view, setView] = React.useState<View>('list')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [newOpen, setNewOpen] = React.useState(openNew)

  const tableById = React.useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables])
  const zoneById = React.useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones])
  const periodById = React.useMemo(() => new Map(settings.periods.map((p) => [p.id, p])), [settings.periods])

  /* ---------- the day ---------- */

  const day = React.useMemo(() => rows.filter((r) => r.date === dateKey), [rows, dateKey])
  const live = React.useMemo(() => day.filter((r) => r.status !== 'cancelled' && r.status !== 'waitlist'), [day])
  const isToday = dateKey === todayKey
  const nowMin = hm(nowTime)

  const dayStats = React.useMemo(() => {
    const covers = live.filter((r) => r.status !== 'no_show').reduce((sum, r) => sum + r.partySize, 0)
    const byPeriod = settings.periods.map((p) => ({
      period: p,
      count: live.filter((r) => r.period === p.id && r.status !== 'no_show').length,
      covers: live.filter((r) => r.period === p.id && r.status !== 'no_show').reduce((sum, r) => sum + r.partySize, 0),
    }))
    const seatsPerService = tables.filter((t) => t.shape !== 'high').reduce((sum, t) => sum + t.seats, 0)
    const here = day.filter((r) => HERE.includes(r.status))
    const noShows = day.filter((r) => r.status === 'no_show').length
    const waitlist = day.filter((r) => r.status === 'waitlist').length
    const deposits = live.filter((r) => r.deposit && r.deposit.status === 'held').reduce((sum, r) => sum + (r.deposit?.amount ?? 0), 0)
    const unconfirmed = live.filter((r) => r.status === 'booked' && (r.source === 'online' || r.source === 'google')).length
    return { covers, byPeriod, seatsPerService, hereCovers: here.reduce((s, r) => s + r.partySize, 0), noShows, waitlist, deposits, unconfirmed }
  }, [day, live, settings.periods, tables])

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return day
      .filter((r) => (period === 'all' ? true : r.period === period))
      .filter((r) => {
        switch (status) {
          case 'upcoming':
            return UPCOMING.includes(r.status)
          case 'here':
            return HERE.includes(r.status)
          case 'finished':
            return r.status === 'finished' || r.status === 'no_show'
          case 'waitlist':
            return r.status === 'waitlist'
          case 'cancelled':
            return r.status === 'cancelled'
          default:
            return r.status !== 'cancelled'
        }
      })
      .filter((r) => {
        if (!needle) return true
        const name = guestName(r.customer).toLowerCase()
        return name.includes(needle) || r.customer.phone.includes(needle) || r.tableIds.some((id) => tableById.get(id)?.name.toLowerCase().includes(needle))
      })
      .sort((a, b) => a.time.localeCompare(b.time) || b.partySize - a.partySize)
  }, [day, period, status, query, tableById])

  /* ---------- actions ---------- */

  const update = (id: string, change: (row: TableReservation) => TableReservation) =>
    setRows((current) => current.map((row) => (row.id === id ? change(row) : row)))

  const setStatusFor = (row: TableReservation, next: ReservationStatus) => {
    const stamp = `${dateKey}T${nowTime}:00`
    update(row.id, (r) => ({
      ...r,
      status: next,
      seatedAt: next === 'seated' ? stamp : r.seatedAt,
      finishedAt: next === 'finished' ? stamp : r.finishedAt,
      deposit: r.deposit ? { ...r.deposit, status: next === 'no_show' ? 'charged' : next === 'cancelled' ? 'refunded' : r.deposit.status } : r.deposit,
    }))
    const name = guestName(row.customer)
    const messages: Record<ReservationStatus, string> = {
      booked: `${name} offered a table`,
      confirmed: `${name} confirmed`,
      arrived: `${name} has arrived`,
      seated: `${name} seated`,
      finished: `${name} finished`,
      no_show: `${name} marked as a no-show`,
      cancelled: `${name} cancelled`,
      waitlist: `${name} moved to the waitlist`,
    }
    toast(messages[next], {
      description:
        next === 'no_show' && row.deposit
          ? `The ${formatCurrency(row.deposit.amount, currency)} deposit is charged.`
          : next === 'seated' && row.tableIds.length
            ? `On ${row.tableIds.map((id) => tableById.get(id)?.name ?? id).join(' + ')}.`
            : undefined,
    })
  }

  const moveTable = (row: TableReservation, tableId: string) => {
    update(row.id, (r) => ({ ...r, tableIds: [tableId] }))
    toast.success(`${guestName(row.customer)} moved to ${tableById.get(tableId)?.name ?? 'another table'}`)
  }

  const remind = (ids: string[]) => {
    toast.success(ids.length === 1 ? 'Reminder sent' : `Reminders sent to ${ids.length} guests`, {
      description: 'A text with the time, the party size and a one-tap confirm.',
    })
  }

  const addReservation = (row: TableReservation) => {
    setRows((current) => [...current, row])
    setDateKey(row.date)
    setNewOpen(false)
    if (openNew) router.replace(hotel ? '/dashboard/reservations' : '/dashboard/reservations')
    toast.success(`Booked ${guestName(row.customer)}, party of ${row.partySize}`, {
      description: `${formatDateShort(row.startsAt)} at ${row.time}${row.tableIds.length ? ` · ${row.tableIds.map((id) => tableById.get(id)?.name).join(' + ')}` : ''}`,
    })
  }

  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null

  /* ---------- columns ---------- */

  const tableLabel = (r: TableReservation) => (r.tableIds.length ? r.tableIds.map((id) => tableById.get(id)?.name ?? '?').join(' + ') : '—')

  const columns = React.useMemo<DataTableColumn<TableReservation>[]>(
    () => [
      {
        id: 'time',
        header: 'Time',
        width: '4.5rem',
        cellClassName: 'whitespace-nowrap',
        cell: (r) => <span className="text-[0.8125rem] text-foreground tabular-nums">{r.time}</span>,
      },
      {
        id: 'guest',
        header: 'Guest',
        cell: (r) => (
          <span className="flex min-w-[10rem] max-w-[16rem] items-center gap-2.5">
            <Avatar name={guestName(r.customer)} src={r.customer.avatarUrl} size="xs" />
            <span className="truncate text-[0.8125rem] text-foreground" title={r.customer.email}>
              {guestName(r.customer)}
            </span>
            {r.occasion ? <span className="hidden shrink-0 text-xs text-subtle lg:inline">· {OCCASION_LABEL[r.occasion]}</span> : null}
            {r.notes || r.allergies ? <StickyNote aria-hidden="true" className="size-3.5 shrink-0 text-faint" /> : null}
            {r.allergies ? <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0 text-warning" /> : null}
          </span>
        ),
      },
      {
        id: 'party',
        header: 'Party',
        align: 'right',
        numeric: true,
        width: '3.5rem',
        cell: (r) => <span className="text-[0.8125rem] text-foreground tabular-nums">{r.partySize}</span>,
      },
      {
        id: 'table',
        header: 'Table',
        width: '6rem',
        cellClassName: 'whitespace-nowrap',
        cell: (r) => <span className="text-[0.8125rem] text-muted">{tableLabel(r)}</span>,
      },
      {
        id: 'source',
        header: 'Source',
        hideBelow: 'lg',
        width: '7rem',
        cell: (r) => <span className="text-[0.8125rem] text-muted">{RESERVATION_SOURCE_LABEL[r.source]}</span>,
      },
      {
        id: 'deposit',
        header: 'Deposit',
        hideBelow: 'xl',
        align: 'right',
        numeric: true,
        width: '6rem',
        cell: (r) => (r.deposit ? <span className="text-[0.8125rem] text-muted tabular-nums">{formatCurrency(r.deposit.amount, currency)}</span> : <span className="text-[0.8125rem] text-faint">—</span>),
      },
      {
        id: 'status',
        header: 'Status',
        width: '7.5rem',
        cell: (r) => <StatusWord label={RESERVATION_STATUS_META[r.status].label} tone={RESERVATION_STATUS_META[r.status].tone} />,
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        width: '3rem',
        cellClassName: 'pl-0',
        cell: (r) => <RowMenu row={r} onStatus={setStatusFor} onOpen={() => setSelectedId(r.id)} onRemind={() => remind([r.id])} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currency, tableById],
  )

  /* ---------- day strip ---------- */

  const days = React.useMemo(() => {
    const start = addDays(fromDateKey(todayKey), -3)
    return Array.from({ length: 18 }, (_, i) => {
      const d = addDays(start, i)
      const key = toDateKey(d)
      const covers = rows.filter((r) => r.date === key && r.status !== 'cancelled' && r.status !== 'waitlist' && r.status !== 'no_show').reduce((s, r) => s + r.partySize, 0)
      return { key, weekday: WEEKDAY[d.getDay()], dayOfMonth: d.getDate(), covers }
    })
  }, [rows, todayKey])

  const periodOptions = [{ value: 'all' as PeriodFilter, label: 'All day' }, ...settings.periods.map((p) => ({ value: p.id as PeriodFilter, label: p.name, count: dayStats.byPeriod.find((b) => b.period.id === p.id)?.covers }))]

  const timelinePeriod: ServicePeriod = periodById.get(period === 'all' ? (nowMin >= hm(settings.periods[settings.periods.length - 1].startTime) - 60 ? settings.periods[settings.periods.length - 1].id : settings.periods.find((p) => hm(p.endTime) > nowMin)?.id ?? settings.periods[0].id) : period) ?? settings.periods[0]

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- numbers ---------- */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label={isToday ? 'Covers today' : 'Covers'} hint={`${live.filter((r) => r.status !== 'no_show').length} ${live.length === 1 ? 'reservation' : 'reservations'}`} value={dayStats.covers} line={dayStats.byPeriod.map((b) => `${b.period.name} ${b.covers}`).join(' · ')} />
        <StatTile label="Here now" hint="seated or arrived" value={dayStats.hereCovers} line={isToday ? `${settings.periods.find((p) => hm(p.startTime) <= nowMin && hm(p.endTime) > nowMin)?.name ?? 'Between services'} · ${nowTime}` : 'Only live on today'} tone="bg-primary" />
        <StatTile label="Waitlist" hint="want a table" value={dayStats.waitlist} line={dayStats.waitlist ? 'Offer a table when one frees up' : 'Nobody waiting'} tone="bg-warning" active={status === 'waitlist'} onClick={() => setStatus(status === 'waitlist' ? 'all' : 'waitlist')} />
        <StatTile label="To confirm" hint="not yet confirmed" value={dayStats.unconfirmed} line={dayStats.deposits ? `${formatCurrency(dayStats.deposits, currency)} in deposits held` : 'No deposits held'} tone="bg-info" active={status === 'upcoming'} onClick={() => setStatus(status === 'upcoming' ? 'all' : 'upcoming')} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="min-w-0">
          {/* ---------- day strip ---------- */}
          <div className="flex items-center gap-2 border-b border-line-subtle px-3 py-3 sm:px-4">
            <IconButton variant="ghost" size="xs" aria-label="Previous day" onClick={() => setDateKey(toDateKey(addDays(fromDateKey(dateKey), -1)))}>
              <ChevronLeft />
            </IconButton>
            <div className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto">
              {days.map((d) => {
                const active = d.key === dateKey
                const today = d.key === todayKey
                return (
                  <button
                    key={d.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDateKey(d.key)}
                    className={cn(
                      'flex w-14 shrink-0 flex-col items-center rounded-lg px-1 py-1.5 text-center transition-colors',
                      active ? 'bg-primary text-on-primary' : 'text-muted hover:bg-surface-sunken',
                    )}
                  >
                    <span className={cn('text-[0.625rem] uppercase tracking-[0.08em]', active ? 'text-on-primary/80' : today ? 'text-primary' : 'text-subtle')}>{today ? 'Today' : d.weekday}</span>
                    <span className="text-sm tabular-nums">{d.dayOfMonth}</span>
                    <span className={cn('text-[0.625rem] tabular-nums', active ? 'text-on-primary/80' : 'text-faint')}>{d.covers}</span>
                  </button>
                )
              })}
            </div>
            <IconButton variant="ghost" size="xs" aria-label="Next day" onClick={() => setDateKey(toDateKey(addDays(fromDateKey(dateKey), 1)))}>
              <ChevronRight />
            </IconButton>
            <Input type="date" size="sm" value={dateKey} onChange={(e) => e.target.value && setDateKey(e.target.value)} aria-label="Pick a date" className="hidden w-[9.5rem] shrink-0 md:flex" />
          </div>

          {/* ---------- toolbar ---------- */}
          <div className="flex flex-col gap-3 border-b border-line-subtle px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Segmented size="sm" label="Service" options={periodOptions} value={period} onValueChange={setPeriod} />
              <Segmented size="sm" label="Status" options={STATUS_FILTERS} value={status} onValueChange={setStatus} hideLabelsOnMobile={false} className="hidden md:inline-flex" />
              <SearchInput value={query} onValueChange={setQuery} placeholder="Guest, phone or table…" size="sm" aria-label="Search reservations" fieldClassName="w-full sm:w-52" />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Segmented
                size="sm"
                label="View"
                options={[
                  { value: 'list', label: 'List', icon: List },
                  { value: 'timeline', label: 'Timeline', icon: Rows3 },
                ]}
                value={view}
                onValueChange={setView}
                hideLabelsOnMobile
              />
              <Button size="sm" leftIcon={<Plus />} onClick={() => setNewOpen(true)}>
                New reservation
              </Button>
            </div>
          </div>

          {/* ---------- body ---------- */}
          {view === 'list' ? (
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                rows={filtered}
                getRowId={(r) => r.id}
                onRowClick={(r) => setSelectedId(r.id)}
                stickyHeader
                rowHeight="compact"
                ariaLabel="Reservations"
                groupBy={(r) => r.period}
                renderGroupHeader={(key, group) => {
                  const p = periodById.get(key as ServiceKey)
                  const covers = group.reduce((s, r) => s + r.partySize, 0)
                  return <BandHeader title={`${p?.name ?? key} · ${p?.startTime}–${p?.endTime}`} right={`${group.length} · ${covers} covers`} />
                }}
                getRowClassName={(r) => (CLOSED.includes(r.status) || r.status === 'cancelled' ? 'opacity-60' : undefined)}
                empty={
                  <EmptyState
                    variant="no-results"
                    size="sm"
                    title={day.length === 0 ? `Nothing in the book for ${formatDateShort(fromDateKey(dateKey))}` : 'Nothing matches'}
                    description={day.length === 0 ? 'Add a reservation, or pick another day.' : 'Try another service or status.'}
                  />
                }
              />
            </CardContent>
          ) : (
            <CardContent className="p-0">
              <Timeline period={timelinePeriod} tables={tables} zones={zones} reservations={day.filter((r) => r.period === timelinePeriod.id && r.status !== 'cancelled' && r.status !== 'waitlist')} nowMin={isToday ? nowMin : null} onSelect={(id) => setSelectedId(id)} />
            </CardContent>
          )}
        </Card>

        {/* ---------- rail ---------- */}
        <div className="flex flex-col gap-4">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">{isToday ? 'Today' : formatDateShort(fromDateKey(dateKey))}</CardTitle>
              <CardDescription>Covers by service against the room.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {dayStats.byPeriod.map((b) => {
                const pct = dayStats.seatsPerService ? Math.min(100, Math.round((b.covers / dayStats.seatsPerService) * 100)) : 0
                return (
                  <div key={b.period.id}>
                    <div className="flex items-center justify-between text-[0.8125rem]">
                      <span className="text-foreground">{b.period.name}</span>
                      <span className="text-muted tabular-nums">
                        {b.covers} <span className="text-faint">/ {dayStats.seatsPerService}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
              <p className="text-xs text-subtle">
                {dayStats.noShows ? `${dayStats.noShows} no-show${dayStats.noShows === 1 ? '' : 's'} so far. ` : ''}
                Tables turn in {settings.periods[settings.periods.length - 1].turnMinutes.upTo2}–{settings.periods[settings.periods.length - 1].turnMinutes.larger} minutes at dinner.
              </p>
              <Button asChild variant="outline" size="sm" className="self-start">
                <Link href="/dashboard/hours">Hours and capacity</Link>
              </Button>
            </CardContent>
          </Card>

          {day.some((r) => r.status === 'waitlist') ? (
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-sm">Waitlist</CardTitle>
                <CardDescription>Offer a table the moment one frees up.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col divide-y divide-line-subtle">
                {day
                  .filter((r) => r.status === 'waitlist')
                  .map((r) => (
                    <div key={r.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <Avatar name={guestName(r.customer)} src={r.customer.avatarUrl} size="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] text-foreground">{guestName(r.customer)}</p>
                        <p className="text-xs text-subtle tabular-nums">
                          {r.time} · party of {r.partySize}
                        </p>
                      </div>
                      <Button size="xs" variant="secondary" onClick={() => setStatusFor(r, 'booked')}>
                        Offer table
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          ) : null}

          {dayStats.unconfirmed > 0 && isToday ? (
            <Card className="h-fit">
              <CardContent className="flex items-start gap-3 pt-5">
                <Send aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
                <div className="min-w-0 flex-1 text-[0.8125rem] text-muted">
                  <p className="text-foreground">{dayStats.unconfirmed} online bookings have not confirmed.</p>
                  <p className="mt-1 text-xs text-subtle">A text goes out three hours before the seating. Send it now instead.</p>
                  <Button size="xs" variant="outline" className="mt-3" onClick={() => remind(live.filter((r) => r.status === 'booked').map((r) => r.id))}>
                    Send reminders
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* ---------- detail sheet ---------- */}
      <ReservationSheet
        reservation={selected}
        tables={tables}
        zoneById={zoneById}
        currency={currency}
        onClose={() => setSelectedId(null)}
        onStatus={setStatusFor}
        onMove={moveTable}
        onRemind={(r) => remind([r.id])}
      />

      {/* ---------- new reservation ---------- */}
      <NewReservationDialog
        open={newOpen}
        onOpenChange={(open) => {
          setNewOpen(open)
          if (!open && openNew) router.replace('/dashboard/reservations')
        }}
        settings={settings}
        tables={tables}
        rows={rows}
        defaultDate={dateKey}
        todayKey={todayKey}
        guests={recentGuests}
        currency={currency}
        onCreate={addReservation}
      />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Row menu
   -------------------------------------------------------------------------- */

function actionsFor(status: ReservationStatus): { label: string; next: ReservationStatus; danger?: boolean }[] {
  switch (status) {
    case 'booked':
      return [
        { label: 'Confirm', next: 'confirmed' },
        { label: 'Mark arrived', next: 'arrived' },
        { label: 'Seat now', next: 'seated' },
        { label: 'Cancel', next: 'cancelled', danger: true },
      ]
    case 'confirmed':
      return [
        { label: 'Mark arrived', next: 'arrived' },
        { label: 'Seat now', next: 'seated' },
        { label: 'No-show', next: 'no_show', danger: true },
        { label: 'Cancel', next: 'cancelled', danger: true },
      ]
    case 'arrived':
      return [
        { label: 'Seat', next: 'seated' },
        { label: 'Cancel', next: 'cancelled', danger: true },
      ]
    case 'seated':
      return [{ label: 'Finish', next: 'finished' }]
    case 'waitlist':
      return [
        { label: 'Offer a table', next: 'booked' },
        { label: 'Remove', next: 'cancelled', danger: true },
      ]
    case 'no_show':
    case 'cancelled':
      return [{ label: 'Reinstate', next: 'booked' }]
    default:
      return []
  }
}

function RowMenu({ row, onStatus, onOpen, onRemind }: { row: TableReservation; onStatus: (row: TableReservation, next: ReservationStatus) => void; onOpen: () => void; onRemind: () => void }) {
  const actions = actionsFor(row.status)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton variant="ghost" size="xs" aria-label={`Actions for ${guestName(row.customer)}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {actions.map((a) => (
          <DropdownMenuItem key={a.next} tone={a.danger ? 'danger' : undefined} onSelect={() => onStatus(row, a.next)}>
            {a.label}
          </DropdownMenuItem>
        ))}
        {actions.length ? <DropdownMenuSeparator /> : null}
        {UPCOMING.includes(row.status) ? <DropdownMenuItem onSelect={onRemind}>Send reminder</DropdownMenuItem> : null}
        <DropdownMenuItem onSelect={onOpen}>Open details</DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/customers/${row.customer.id}`}>
            <ArrowUpRight />
            Guest profile
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* --------------------------------------------------------------------------
   Timeline — tables down, the service across
   -------------------------------------------------------------------------- */

function Timeline({ period, tables, zones, reservations, nowMin, onSelect }: { period: ServicePeriod; tables: DiningTable[]; zones: FloorZone[]; reservations: TableReservation[]; nowMin: number | null; onSelect: (id: string) => void }) {
  const start = hm(period.startTime)
  const end = hm(period.endTime) + 30
  const span = end - start
  const ticks: number[] = []
  for (let t = start; t <= end; t += 30) ticks.push(t)
  const byTable = new Map<string, TableReservation[]>()
  for (const r of reservations) for (const id of r.tableIds) byTable.set(id, [...(byTable.get(id) ?? []), r])
  const unassigned = reservations.filter((r) => r.tableIds.length === 0)
  const pct = (min: number) => `${((min - start) / span) * 100}%`

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[56rem]">
        <div className="sticky top-0 z-10 grid grid-cols-[7rem_minmax(0,1fr)] border-b border-line-subtle bg-surface text-xs text-subtle">
          <div className="px-3 py-2">{period.name}</div>
          <div className="relative h-8">
            {ticks.map((t) => (
              <span key={t} className="absolute top-2 -translate-x-1/2 tabular-nums" style={{ left: pct(t) }}>
                {mh(t)}
              </span>
            ))}
          </div>
        </div>
        {zones.map((zone) => {
          const zoneTables = tables.filter((t) => t.zoneId === zone.id && t.shape !== 'high')
          if (zoneTables.length === 0) return null
          return (
            <div key={zone.id}>
              <div className="border-b border-line-subtle bg-surface-sunken/60 px-3 py-1.5 text-xs font-medium text-muted">{zone.name}</div>
              {zoneTables.map((table) => (
                <div key={table.id} className="grid grid-cols-[7rem_minmax(0,1fr)] border-b border-line-subtle">
                  <div className="flex items-center gap-2 px-3 py-2 text-[0.8125rem] text-foreground">
                    <span>{table.name}</span>
                    <span className="text-xs text-faint tabular-nums">{table.seats}</span>
                  </div>
                  <div className="relative h-10">
                    {ticks.map((t) => (
                      <span key={t} aria-hidden="true" className="absolute inset-y-0 border-l border-line-subtle" style={{ left: pct(t) }} />
                    ))}
                    {nowMin !== null && nowMin >= start && nowMin <= end ? <span aria-hidden="true" className="absolute inset-y-0 z-10 border-l-2 border-primary" style={{ left: pct(nowMin) }} /> : null}
                    {(byTable.get(table.id) ?? []).map((r) => {
                      const s = hm(r.time)
                      const e = Math.min(end, s + r.durationMinutes)
                      const meta = RESERVATION_STATUS_META[r.status]
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => onSelect(r.id)}
                          title={`${guestName(r.customer)} · ${r.time} · party of ${r.partySize}`}
                          className={cn(
                            'absolute inset-y-1.5 flex items-center gap-1.5 overflow-hidden rounded-md border border-line bg-surface px-2 text-left text-xs text-foreground hover:border-line-strong',
                            (r.status === 'finished' || r.status === 'no_show') && 'opacity-55',
                          )}
                          style={{ left: pct(s), width: `calc(${((e - s) / span) * 100}% - 2px)` }}
                        >
                          <Dot tone={meta.tone} />
                          <span className="truncate">{guestName(r.customer)}</span>
                          <span className="shrink-0 text-faint tabular-nums">{r.partySize}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
        {unassigned.length ? (
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] border-b border-line-subtle">
            <div className="px-3 py-2 text-[0.8125rem] text-warning">No table</div>
            <div className="relative h-10">
              {unassigned.map((r, i) => (
                <button key={r.id} type="button" onClick={() => onSelect(r.id)} className="absolute inset-y-1.5 flex items-center gap-1.5 rounded-md border border-dashed border-warning/60 bg-warning-soft/40 px-2 text-xs text-foreground" style={{ left: pct(hm(r.time)), width: `calc(${(r.durationMinutes / span) * 100}% - 2px)`, top: `${6 + (i % 2) * 0}px` }}>
                  <span className="truncate">{guestName(r.customer)}</span>
                  <span className="shrink-0 text-faint tabular-nums">{r.partySize}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Detail sheet
   -------------------------------------------------------------------------- */

function ReservationSheet({ reservation: r, tables, zoneById, currency, onClose, onStatus, onMove, onRemind }: { reservation: TableReservation | null; tables: DiningTable[]; zoneById: Map<string, FloorZone>; currency: CurrencyCode; onClose: () => void; onStatus: (row: TableReservation, next: ReservationStatus) => void; onMove: (row: TableReservation, tableId: string) => void; onRemind: (row: TableReservation) => void }) {
  const open = r !== null
  const actions = r ? actionsFor(r.status) : []
  const tableById = new Map(tables.map((t) => [t.id, t]))
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" size="md">
        {r ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <Avatar name={guestName(r.customer)} src={r.customer.avatarUrl} size="md" />
                <div className="min-w-0">
                  <SheetTitle className="truncate">{guestName(r.customer)}</SheetTitle>
                  <SheetDescription className="truncate">
                    {r.customer.email} · {r.customer.phone}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[0.8125rem]">
                <Row term="When" value={`${formatDateShort(r.startsAt)} · ${r.time}`} />
                <Row term="Party" value={`${r.partySize} ${r.partySize === 1 ? 'guest' : 'guests'}${r.highChairs ? ` · ${r.highChairs} high chair` : ''}`} />
                <Row term="Status" value={<StatusWord label={RESERVATION_STATUS_META[r.status].label} tone={RESERVATION_STATUS_META[r.status].tone} />} />
                <Row term="Source" value={RESERVATION_SOURCE_LABEL[r.source]} />
                <Row term="Held for" value={`${r.durationMinutes} min`} />
                <Row term="Occasion" value={r.occasion ? OCCASION_LABEL[r.occasion] : '—'} />
                <Row term="Deposit" value={r.deposit ? `${formatCurrency(r.deposit.amount, currency)} · ${r.deposit.status}` : 'None'} />
                <Row term="Booked" value={formatDateShort(r.createdAt)} />
              </dl>

              <div>
                <p className="text-xs font-medium text-muted">Table</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Select value={r.tableIds[0] ?? ''} onValueChange={(value) => onMove(r, value)}>
                    <SelectTrigger size="sm" className="w-56" aria-label="Move to a table">
                      <SelectValue placeholder="Assign a table" />
                    </SelectTrigger>
                    <SelectContent>
                      {tables
                        .filter((t) => t.shape !== 'high')
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name} · {t.seats} seats · {zoneById.get(t.zoneId)?.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {r.tableIds.length > 1 ? <span className="text-xs text-subtle">Joined: {r.tableIds.map((id) => tableById.get(id)?.name).join(' + ')}</span> : null}
                </div>
              </div>

              {r.allergies ? (
                <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft/40 p-3 text-[0.8125rem]">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span className="text-foreground">Allergy: {r.allergies}. Flag to the kitchen on every course.</span>
                </div>
              ) : null}
              {r.notes ? (
                <div>
                  <p className="text-xs font-medium text-muted">Guest note</p>
                  <p className="mt-1 text-[0.8125rem] text-foreground">{r.notes}</p>
                </div>
              ) : null}
              {r.customer.notes ? (
                <div>
                  <p className="text-xs font-medium text-muted">On the profile</p>
                  <p className="mt-1 text-[0.8125rem] text-muted">{r.customer.notes}</p>
                </div>
              ) : null}
              <p className="text-xs text-subtle">
                {r.customer.totalBookings > 1 ? `${r.customer.totalBookings} visits · ${formatCurrency(r.customer.lifetimeValue, currency)} lifetime.` : 'First visit.'}
              </p>
            </SheetBody>
            <SheetFooter className="flex-wrap gap-2">
              {actions.map((a) => (
                <Button key={a.next} size="sm" variant={a.danger ? 'outline' : actions[0] === a ? 'primary' : 'secondary'} onClick={() => onStatus(r, a.next)}>
                  {a.label}
                </Button>
              ))}
              {UPCOMING.includes(r.status) ? (
                <Button size="sm" variant="ghost" leftIcon={<Send />} onClick={() => onRemind(r)}>
                  Remind
                </Button>
              ) : null}
              <Button asChild size="sm" variant="ghost" className="ml-auto">
                <Link href={`/dashboard/customers/${r.customer.id}`}>Guest profile</Link>
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function Row({ term, value }: { term: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-subtle">{term}</dt>
      <dd className="mt-0.5 truncate text-foreground">{value}</dd>
    </div>
  )
}

/* --------------------------------------------------------------------------
   New reservation
   -------------------------------------------------------------------------- */

function NewReservationDialog({ open, onOpenChange, settings, tables, rows, defaultDate, todayKey, guests, currency, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; settings: DiningSettings; tables: DiningTable[]; rows: TableReservation[]; defaultDate: string; todayKey: string; guests: Customer[]; currency: CurrencyCode; onCreate: (row: TableReservation) => void }) {
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [party, setParty] = React.useState(2)
  const [date, setDate] = React.useState(defaultDate)
  const [periodId, setPeriodId] = React.useState<ServiceKey>(settings.periods[settings.periods.length - 1].id)
  const [time, setTime] = React.useState('')
  const [tableId, setTableId] = React.useState('')
  const [occasion, setOccasion] = React.useState<Occasion | 'none'>('none')
  const [notes, setNotes] = React.useState('')
  const [pick, setPick] = React.useState<Customer | null>(null)

  React.useEffect(() => {
    if (open) setDate(defaultDate)
  }, [open, defaultDate])

  const period = settings.periods.find((p) => p.id === periodId) ?? settings.periods[0]
  const times = seatingTimes(period)
  const weekday = fromDateKey(date).getDay()
  const closed = !period.weekdays.includes(weekday) || settings.closures.some((c) => c.date === date)

  React.useEffect(() => {
    if (!times.includes(time)) setTime(times[Math.floor(times.length / 2)] ?? '')
  }, [periodId, times, time])

  /** Tables that fit and are not held across this time. */
  const freeTables = React.useMemo(() => {
    if (!time) return []
    const start = hm(time)
    const end = start + turnMinutesFor(period, party)
    const busy = new Set<string>()
    for (const r of rows) {
      if (r.date !== date || r.status === 'cancelled' || r.status === 'waitlist' || r.status === 'no_show' || r.status === 'finished') continue
      const s = hm(r.time)
      const e = s + r.durationMinutes
      if (start < e && end > s) for (const id of r.tableIds) busy.add(id)
    }
    return tables.filter((t) => t.shape !== 'high' && t.seats >= party && t.minSeats <= party && !busy.has(t.id)).sort((a, b) => a.seats - b.seats)
  }, [rows, tables, date, time, party, period])

  React.useEffect(() => {
    if (!freeTables.some((t) => t.id === tableId)) setTableId(freeTables[0]?.id ?? '')
  }, [freeTables, tableId])

  const suggestions = name.trim().length >= 2 && !pick ? guests.filter((g) => guestName(g).toLowerCase().includes(name.trim().toLowerCase())).slice(0, 4) : []
  const deposit = party >= settings.depositFromParty ? settings.depositPerCover * party : 0
  const canSubmit = name.trim().length >= 2 && time && !closed

  const reset = () => {
    setName('')
    setPhone('')
    setParty(2)
    setOccasion('none')
    setNotes('')
    setPick(null)
  }

  const submit = () => {
    if (!canSubmit) return
    const [first, ...rest] = name.trim().split(/\s+/)
    const customer: Customer = pick ?? {
      id: `cus_new_${Date.now().toString(36)}`,
      tenantId: tables[0]?.tenantId ?? '',
      firstName: first,
      lastName: rest.join(' ') || '',
      email: '',
      phone,
      country: '',
      createdAt: `${todayKey}T09:00:00`,
      totalBookings: 0,
      lifetimeValue: 0,
      lastBookingAt: null,
      tags: [],
      marketingOptIn: false,
      segment: 'new',
    }
    onCreate({
      id: `rsv_new_${Date.now().toString(36)}`,
      tenantId: customer.tenantId,
      customer,
      partySize: party,
      date,
      time,
      startsAt: `${date}T${time}:00`,
      durationMinutes: turnMinutesFor(period, party),
      period: period.id,
      tableIds: tableId ? [tableId] : [],
      status: 'booked',
      source: 'phone',
      occasion: occasion === 'none' ? null : occasion,
      notes: notes.trim() || null,
      allergies: null,
      highChairs: 0,
      deposit: deposit ? { amount: deposit, status: 'held' } : null,
      stayId: null,
      createdAt: `${todayKey}T09:00:00`,
      seatedAt: null,
      finishedAt: null,
    })
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader divider>
          <DialogTitle>New reservation</DialogTitle>
          <DialogDescription>Taken over the phone or at the door. Online bookings arrive here on their own.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="relative">
              <Field label="Guest name" required>
                {(control) => (
                  <Input
                    {...control}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      setPick(null)
                    }}
                    placeholder="Elena Marinou"
                    autoComplete="off"
                  />
                )}
              </Field>
              {suggestions.length ? (
                <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-surface-raised shadow-lg">
                  {suggestions.map((g) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.8125rem] hover:bg-surface-sunken"
                        onClick={() => {
                          setPick(g)
                          setName(guestName(g))
                          setPhone(g.phone)
                        }}
                      >
                        <Avatar name={guestName(g)} src={g.avatarUrl} size="xs" />
                        <span className="min-w-0 flex-1 truncate text-foreground">{guestName(g)}</span>
                        <span className="shrink-0 text-xs text-subtle">
                          {g.totalBookings} {g.totalBookings === 1 ? 'visit' : 'visits'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <Field label="Phone">{(control) => <Input {...control} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+30 …" inputMode="tel" />}</Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Party">
              <Stepper value={party} min={1} max={settings.maxOnlineParty + 8} onChange={setParty} label="guests" />
            </Field>
            <Field label="Date" error={closed ? 'Closed for this service' : undefined}>
              {(control) => <Input {...control} type="date" value={date} min={todayKey} onChange={(e) => e.target.value && setDate(e.target.value)} />}
            </Field>
            <Field label="Service">
              <Select value={periodId} onValueChange={(v) => setPeriodId(v as ServiceKey)}>
                <SelectTrigger aria-label="Service">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {settings.periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.startTime}–{p.endTime}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Time" description={`Tables are held ${turnMinutesFor(period, party)} minutes for a party of ${party}.`}>
            <div className="flex flex-wrap gap-1.5">
              {times.map((t) => {
                const active = t === time
                return (
                  <button key={t} type="button" aria-pressed={active} onClick={() => setTime(t)} className={cn('rounded-md border px-2.5 py-1.5 text-[0.8125rem] tabular-nums transition-colors', active ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground')}>
                    {t}
                  </button>
                )
              })}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Table" description={freeTables.length ? `${freeTables.length} free at ${time}` : time ? 'Nothing free — the reservation goes on without a table.' : undefined}>
              <Select value={tableId} onValueChange={setTableId} disabled={freeTables.length === 0}>
                <SelectTrigger aria-label="Table">
                  <SelectValue placeholder="No table yet" />
                </SelectTrigger>
                <SelectContent>
                  {freeTables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} · {t.seats} seats
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Occasion" optional>
              <Select value={occasion} onValueChange={(v) => setOccasion(v as Occasion | 'none')}>
                <SelectTrigger aria-label="Occasion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(Object.keys(OCCASION_LABEL) as Occasion[]).map((o) => (
                    <SelectItem key={o} value={o}>
                      {OCCASION_LABEL[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Notes" optional>
            {(control) => <Textarea {...control} value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Allergies, a pram, a birthday candle…" />}
          </Field>

          {deposit ? (
            <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted">
              Parties of {settings.depositFromParty} or more pay a {formatCurrency(settings.depositPerCover, currency)} deposit per cover: {formatCurrency(deposit, currency)}, taken by card link after you save.
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter divider className="sm:justify-between">
          <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" leftIcon={<Check />} disabled={!canSubmit} onClick={submit}>
            Book {party} at {time || '—'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const __test = { formatNumber }
