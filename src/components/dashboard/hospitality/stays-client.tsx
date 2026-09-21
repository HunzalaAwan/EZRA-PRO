'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { BedDouble, Check, Columns3, KeyRound, List, Plus, X } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/ui/data-table'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { nightKeys, quoteStay } from '@/lib/hospitality/lodging-settings'
import {
  STAY_CHANNEL_LABEL,
  STAY_STATUS_META,
  type LodgingSettings,
  type Room,
  type RoomType,
  type Stay,
  type StayChannel,
  type StayStatus,
} from '@/lib/hospitality/types'
import { addDays, cn, formatCurrency, formatDateShort, formatNumber, fromDateKey, toDateKey } from '@/lib/utils'
import type { CurrencyCode, Customer } from '@/types'

import { AssignRoomDialog } from './front-desk'
import { StatTile, StatusWord, Stepper, guestName } from './shared'
import { StaySheet } from './stay-sheet'

/* ==========================================================================
   <StaysClient> — every reservation, as a list or as the tape chart
   (rooms down the side, the next two weeks across the top).
   ========================================================================== */

type StatusFilter = 'all' | StayStatus
type View = 'list' | 'chart'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'booked', label: 'Booked' },
  { value: 'arriving', label: 'Arriving' },
  { value: 'in_house', label: 'In house' },
  { value: 'departing', label: 'Departing' },
  { value: 'checked_out', label: 'Checked out' },
  { value: 'cancelled', label: 'Cancelled' },
]

const CHART_DAYS = 14

export interface StaysClientProps {
  stays: Stay[]
  rooms: Room[]
  roomTypes: RoomType[]
  settings: LodgingSettings
  currency: CurrencyCode
  todayKey: string
  recentGuests: Customer[]
  openNew?: boolean
}

export function StaysClient({ stays: initial, rooms: initialRooms, roomTypes, settings, currency, todayKey, recentGuests, openNew = false }: StaysClientProps) {
  const router = useRouter()
  const [stays, setStays] = React.useState(initial)
  const [rooms, setRooms] = React.useState(initialRooms)
  const [view, setView] = React.useState<View>('list')
  const [status, setStatus] = React.useState<StatusFilter>('all')
  const [channel, setChannel] = React.useState<'all' | StayChannel>('all')
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<DataTableSort>({ id: 'checkIn', dir: 'asc' })
  const [limit, setLimit] = React.useState(60)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [assigningId, setAssigningId] = React.useState<string | null>(null)
  const [newOpen, setNewOpen] = React.useState(openNew)

  const roomById = React.useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms])
  const typeById = React.useMemo(() => new Map(roomTypes.map((t) => [t.id, t])), [roomTypes])
  const planById = React.useMemo(() => new Map(settings.ratePlans.map((p) => [p.id, p])), [settings.ratePlans])

  /* ---------- numbers ---------- */

  const stats = React.useMemo(() => {
    const sellable = rooms.filter((r) => r.housekeeping !== 'out_of_order').length
    const weekEnd = toDateKey(addDays(fromDateKey(todayKey), 7))
    const arriving = stays.filter((s) => s.checkIn >= todayKey && s.checkIn < weekEnd && (s.status === 'booked' || s.status === 'arriving'))
    const tonight = stays.filter((s) => s.checkIn <= todayKey && s.checkOut > todayKey && s.status !== 'cancelled' && s.status !== 'no_show' && s.status !== 'checked_out').length
    const start = toDateKey(addDays(fromDateKey(todayKey), -30))
    let nights = 0
    let revenue = 0
    for (const s of stays) {
      if (s.status === 'cancelled' || s.status === 'no_show') continue
      for (const key of nightKeys(s.checkIn, s.checkOut)) {
        if (key >= start && key < todayKey) {
          nights++
          revenue += s.nightlyRate
        }
      }
    }
    return {
      arriving: arriving.length,
      arrivingValue: arriving.reduce((sum, s) => sum + s.total, 0),
      occupancy: sellable ? Math.round((tonight / sellable) * 100) : 0,
      tonight,
      sellable,
      adr: nights ? Math.round(revenue / nights) : 0,
      revpar: sellable ? Math.round(revenue / (sellable * 30)) : 0,
      onBooks: stays.filter((s) => s.checkIn >= todayKey && (s.status === 'booked' || s.status === 'arriving')).reduce((sum, s) => sum + s.total, 0),
    }
  }, [stays, rooms, todayKey])

  /* ---------- filter ---------- */

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = stays.filter((s) => (status === 'all' ? s.status !== 'cancelled' && s.status !== 'no_show' : s.status === status)).filter((s) => (channel === 'all' ? true : s.channel === channel)).filter((s) => {
      if (!needle) return true
      return guestName(s.customer).toLowerCase().includes(needle) || s.reference.toLowerCase().includes(needle) || (s.roomId ? roomById.get(s.roomId)?.number.includes(needle) : false)
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    return rows.sort((a, b) => {
      switch (sort.id) {
        case 'guest':
          return guestName(a.customer).localeCompare(guestName(b.customer)) * dir
        case 'total':
          return (a.total - b.total) * dir
        case 'status':
          return a.status.localeCompare(b.status) * dir
        case 'nights':
          return (a.nights - b.nights) * dir
        default:
          return (a.checkIn.localeCompare(b.checkIn) || a.reference.localeCompare(b.reference)) * dir
      }
    })
  }, [stays, status, channel, query, sort, roomById])

  /* ---------- actions ---------- */

  const setStay = (id: string, change: (s: Stay) => Stay) => setStays((current) => current.map((s) => (s.id === id ? change(s) : s)))

  const assign = (stay: Stay, room: Room) => {
    setStay(stay.id, (s) => ({ ...s, roomId: room.id }))
    setRooms((current) => current.map((r) => (r.id === room.id ? { ...r, arrivingStayId: stay.id } : r.arrivingStayId === stay.id ? { ...r, arrivingStayId: null } : r)))
    setAssigningId(null)
    toast.success(`${guestName(stay.customer)} in room ${room.number}`)
  }

  const cancel = (stay: Stay) => {
    const plan = planById.get(stay.ratePlanId)
    const refund = plan?.kind === 'non_refundable' ? 0 : stay.paid
    setStay(stay.id, (s) => ({ ...s, status: 'cancelled', roomId: null }))
    setSelectedId(null)
    toast(`${guestName(stay.customer)} cancelled`, { description: refund ? `${formatCurrency(refund, currency)} refunded to the card.` : 'Non-refundable rate; nothing is returned.' })
  }

  const addNight = (stay: Stay) => {
    const next = toDateKey(addDays(fromDateKey(stay.checkOut), 1))
    const extra = stay.nightlyRate + settings.cityTaxPerNight * stay.adults
    setStay(stay.id, (s) => ({ ...s, checkOut: next, nights: s.nights + 1, roomTotal: s.roomTotal + s.nightlyRate, total: s.total + extra, balance: s.balance + extra }))
    toast.success(`One more night for ${guestName(stay.customer)}`, { description: `Now leaving ${formatDateShort(`${next}T12:00:00`)}.` })
  }

  const create = (stay: Stay) => {
    setStays((current) => [...current, stay])
    setNewOpen(false)
    if (openNew) router.replace('/dashboard/stays')
    toast.success(`${guestName(stay.customer)} booked`, { description: `${typeById.get(stay.roomTypeId)?.name}, ${stay.nights} ${stay.nights === 1 ? 'night' : 'nights'} from ${formatDateShort(`${stay.checkIn}T12:00:00`)} · ${formatCurrency(stay.total, currency)}.` })
  }

  const selected = selectedId ? stays.find((s) => s.id === selectedId) ?? null : null
  const assigning = assigningId ? stays.find((s) => s.id === assigningId) ?? null : null

  /* ---------- columns ---------- */

  const columns = React.useMemo<DataTableColumn<Stay>[]>(
    () => [
      { id: 'reference', header: 'Ref', width: '6.5rem', cellClassName: 'whitespace-nowrap', cell: (s) => <span className="text-[0.8125rem] text-muted tabular-nums">{s.reference}</span> },
      {
        id: 'guest',
        header: 'Guest',
        sortable: true,
        cell: (s) => (
          <span className="flex min-w-[10rem] max-w-[16rem] items-center gap-2.5">
            <Avatar name={guestName(s.customer)} src={s.customer.avatarUrl} size="xs" />
            <span className="truncate text-[0.8125rem] text-foreground">{guestName(s.customer)}</span>
          </span>
        ),
      },
      {
        id: 'checkIn',
        header: 'Dates',
        sortable: true,
        cellClassName: 'whitespace-nowrap',
        cell: (s) => (
          <span className="text-[0.8125rem] text-foreground tabular-nums">
            {formatDateShort(`${s.checkIn}T12:00:00`)} <span className="text-subtle">→</span> {formatDateShort(`${s.checkOut}T12:00:00`)}
          </span>
        ),
      },
      { id: 'nights', header: 'Nights', sortable: true, align: 'right', numeric: true, width: '4.5rem', cell: (s) => <span className="text-[0.8125rem] text-muted tabular-nums">{s.nights}</span> },
      {
        id: 'room',
        header: 'Room',
        width: '8rem',
        cell: (s) => {
          const room = s.roomId ? roomById.get(s.roomId) : null
          return room ? (
            <span className="text-[0.8125rem] text-foreground tabular-nums">
              {room.number} <span className="text-subtle">· {typeById.get(s.roomTypeId)?.name.split(' ')[0]}</span>
            </span>
          ) : s.status === 'booked' || s.status === 'arriving' ? (
            <span className="text-[0.8125rem] text-muted">{typeById.get(s.roomTypeId)?.name}</span>
          ) : (
            <span className="text-[0.8125rem] text-faint">—</span>
          )
        },
      },
      { id: 'guests', header: 'Guests', hideBelow: 'lg', align: 'right', numeric: true, width: '4.5rem', cell: (s) => <span className="text-[0.8125rem] text-muted tabular-nums">{s.adults}{s.children ? ` + ${s.children}` : ''}</span> },
      { id: 'plan', header: 'Rate', hideBelow: 'xl', width: '8rem', cell: (s) => <span className="truncate text-[0.8125rem] text-muted">{planById.get(s.ratePlanId)?.name}</span> },
      { id: 'channel', header: 'Via', hideBelow: 'lg', width: '6.5rem', cell: (s) => <span className="text-[0.8125rem] text-muted">{STAY_CHANNEL_LABEL[s.channel]}</span> },
      {
        id: 'total',
        header: 'Total',
        sortable: true,
        align: 'right',
        numeric: true,
        width: '7rem',
        cell: (s) => (
          <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap text-[0.8125rem] tabular-nums">
            <span className={cn(s.status === 'cancelled' ? 'text-subtle line-through' : 'text-foreground')}>{formatCurrency(s.total, currency)}</span>
            {s.balance > 0 && s.status !== 'cancelled' ? <span className="text-xs text-warning">{formatCurrency(s.balance, currency)} due</span> : null}
          </span>
        ),
      },
      { id: 'status', header: 'Status', sortable: true, width: '7rem', cell: (s) => <StatusWord label={STAY_STATUS_META[s.status].label} tone={STAY_STATUS_META[s.status].tone} /> },
    ],
    [currency, roomById, typeById, planById],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Arriving this week" hint="next 7 days" value={stats.arriving} line={`${formatCurrency(stats.arrivingValue, currency, { compact: true })} in stays`} tone="bg-warning" />
        <StatTile label="Occupancy tonight" value={`${stats.occupancy}%`} line={`${stats.tonight} of ${stats.sellable} rooms`} tone="bg-success" />
        <StatTile label="Average rate" hint="last 30 nights" value={formatCurrency(stats.adr, currency)} line={`RevPAR ${formatCurrency(stats.revpar, currency)}`} />
        <StatTile label="On the books" hint="future stays" value={formatCurrency(stats.onBooks, currency, { compact: true })} line={`${formatNumber(stays.filter((s) => s.checkIn >= todayKey && (s.status === 'booked' || s.status === 'arriving')).length)} reservations ahead`} />
      </div>

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line-subtle px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Segmented size="sm" label="Status" options={STATUS_FILTERS} value={status} onValueChange={setStatus} className="hidden md:inline-flex" />
            <Select value={channel} onValueChange={(v) => setChannel(v as 'all' | StayChannel)}>
              <SelectTrigger size="sm" className="w-36" aria-label="Channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {(Object.keys(STAY_CHANNEL_LABEL) as StayChannel[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {STAY_CHANNEL_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SearchInput value={query} onValueChange={setQuery} placeholder="Guest, reference or room…" size="sm" aria-label="Search reservations" fieldClassName="w-full sm:w-56" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Segmented
              size="sm"
              label="View"
              options={[
                { value: 'list', label: 'List', icon: List },
                { value: 'chart', label: 'Rooms', icon: Columns3 },
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

        {view === 'list' ? (
          <CardContent className="p-0">
            <DataTable columns={columns} rows={filtered.slice(0, limit)} getRowId={(s) => s.id} onRowClick={(s) => setSelectedId(s.id)} sort={sort} onSortChange={setSort} stickyHeader rowHeight="compact" ariaLabel="Reservations" getRowClassName={(s) => (s.status === 'cancelled' || s.status === 'checked_out' || s.status === 'no_show' ? 'opacity-60' : undefined)} empty={<EmptyState variant="no-results" size="sm" title="No reservations match" description="Try another status, channel or search." />} />
            {filtered.length > limit ? (
              <div className="border-t border-line-subtle p-3 text-center">
                <Button size="sm" variant="ghost" onClick={() => setLimit(limit + 60)}>
                  Show {Math.min(60, filtered.length - limit)} more of {formatNumber(filtered.length)}
                </Button>
              </div>
            ) : null}
          </CardContent>
        ) : (
          <CardContent className="p-0">
            <TapeChart stays={stays} rooms={rooms} roomTypes={roomTypes} todayKey={todayKey} onSelect={setSelectedId} onAssign={setAssigningId} />
          </CardContent>
        )}
      </Card>

      <StaySheet
        stay={selected}
        room={selected?.roomId ? roomById.get(selected.roomId) ?? null : null}
        roomType={selected ? typeById.get(selected.roomTypeId) ?? null : null}
        plan={selected ? planById.get(selected.ratePlanId) ?? null : null}
        currency={currency}
        onClose={() => setSelectedId(null)}
        actions={
          selected && (selected.status === 'booked' || selected.status === 'arriving') ? (
            <>
              <Button size="sm" variant="secondary" leftIcon={<BedDouble />} onClick={() => setAssigningId(selected.id)}>
                {selected.roomId ? 'Move room' : 'Assign room'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => addNight(selected)}>
                Add a night
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => cancel(selected)}>
                Cancel stay
              </Button>
            </>
          ) : selected && (selected.status === 'in_house' || selected.status === 'departing') ? (
            <Button size="sm" variant="secondary" onClick={() => addNight(selected)}>
              Add a night
            </Button>
          ) : null
        }
      />

      <AssignRoomDialog stay={assigning} rooms={rooms} roomTypes={roomTypes} onClose={() => setAssigningId(null)} onAssign={assign} />

      <NewStayDialog
        open={newOpen}
        onOpenChange={(open) => {
          setNewOpen(open)
          if (!open && openNew) router.replace('/dashboard/stays')
        }}
        stays={stays}
        rooms={rooms}
        roomTypes={roomTypes}
        settings={settings}
        currency={currency}
        todayKey={todayKey}
        guests={recentGuests}
        onCreate={create}
      />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Tape chart
   -------------------------------------------------------------------------- */

const WEEKDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function TapeChart({ stays, rooms, roomTypes, todayKey, onSelect, onAssign }: { stays: Stay[]; rooms: Room[]; roomTypes: RoomType[]; todayKey: string; onSelect: (id: string) => void; onAssign: (id: string) => void }) {
  const start = addDays(fromDateKey(todayKey), -2)
  const days = Array.from({ length: CHART_DAYS }, (_, i) => addDays(start, i))
  const startKey = toDateKey(start)
  const endKey = toDateKey(addDays(start, CHART_DAYS))
  const typeById = new Map(roomTypes.map((t) => [t.id, t]))
  const byRoom = new Map<string, Stay[]>()
  for (const s of stays) {
    if (!s.roomId || s.status === 'cancelled' || s.status === 'no_show') continue
    if (s.checkOut <= startKey || s.checkIn >= endKey) continue
    byRoom.set(s.roomId, [...(byRoom.get(s.roomId) ?? []), s])
  }
  const unassigned = stays.filter((s) => !s.roomId && (s.status === 'booked' || s.status === 'arriving') && s.checkIn < endKey && s.checkOut > startKey).sort((a, b) => a.checkIn.localeCompare(b.checkIn))
  const dayIndex = (key: string) => Math.round((fromDateKey(key).getTime() - start.getTime()) / 86_400_000)
  const floors = [...new Set(rooms.map((r) => r.floor))].sort()

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[64rem]">
        <div className="sticky top-0 z-10 grid border-b border-line-subtle bg-surface text-xs text-subtle" style={{ gridTemplateColumns: `8rem repeat(${CHART_DAYS}, minmax(0, 1fr))` }}>
          <div className="px-3 py-2">Room</div>
          {days.map((d) => {
            const key = toDateKey(d)
            const today = key === todayKey
            return (
              <div key={key} className={cn('border-l border-line-subtle px-1 py-2 text-center tabular-nums', today && 'bg-primary-soft/40 text-primary')}>
                {WEEKDAY[d.getDay()]} {d.getDate()}
              </div>
            )
          })}
        </div>
        {floors.map((floor) => (
          <div key={floor}>
            <div className="border-b border-line-subtle bg-surface-sunken/60 px-3 py-1.5 text-xs font-medium text-muted">Floor {floor}</div>
            {rooms
              .filter((r) => r.floor === floor)
              .map((room) => (
                <div key={room.id} className="grid border-b border-line-subtle" style={{ gridTemplateColumns: `8rem repeat(${CHART_DAYS}, minmax(0, 1fr))` }}>
                  <div className="flex items-center gap-2 px-3 py-2 text-[0.8125rem]">
                    <span className="text-foreground tabular-nums">{room.number}</span>
                    <span className="truncate text-xs text-subtle">{typeById.get(room.typeId)?.name.split(' ')[0]}</span>
                  </div>
                  <div className="relative col-span-full col-start-2 h-10" style={{ gridColumn: `2 / span ${CHART_DAYS}` }}>
                    {days.map((d, i) => (
                      <span key={i} aria-hidden="true" className={cn('absolute inset-y-0 border-l border-line-subtle', toDateKey(d) === todayKey && 'bg-primary-soft/30')} style={{ left: `${(i / CHART_DAYS) * 100}%`, width: `${100 / CHART_DAYS}%` }} />
                    ))}
                    {room.housekeeping === 'out_of_order' ? <span className="absolute inset-y-2 inset-x-1 rounded-md bg-[repeating-linear-gradient(45deg,var(--line)_0_4px,transparent_4px_10px)] opacity-60" aria-label="Out of order" /> : null}
                    {(byRoom.get(room.id) ?? []).map((s) => {
                      const from = Math.max(0, dayIndex(s.checkIn))
                      const to = Math.min(CHART_DAYS, dayIndex(s.checkOut))
                      if (to <= from) return null
                      const meta = STAY_STATUS_META[s.status]
                      return (
                        <button key={s.id} type="button" onClick={() => onSelect(s.id)} title={`${guestName(s.customer)} · ${s.checkIn} → ${s.checkOut}`} className={cn('absolute inset-y-1.5 flex items-center gap-1.5 overflow-hidden rounded-md border border-line bg-surface px-2 text-left text-xs text-foreground hover:border-line-strong', s.status === 'checked_out' && 'opacity-55')} style={{ left: `calc(${(from / CHART_DAYS) * 100}% + 2px)`, width: `calc(${((to - from) / CHART_DAYS) * 100}% - 4px)` }}>
                          <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', meta.tone)} />
                          <span className="truncate">{s.customer.lastName}</span>
                          <span className="shrink-0 text-faint tabular-nums">{s.adults + s.children}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
          </div>
        ))}
        {unassigned.length ? (
          <div className="border-t border-line-subtle bg-warning-soft/20 px-3 py-3">
            <p className="text-xs font-medium text-muted">No room yet · {unassigned.length}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {unassigned.map((s) => (
                <button key={s.id} type="button" onClick={() => onAssign(s.id)} className="inline-flex items-center gap-2 rounded-md border border-dashed border-warning/60 bg-surface px-2.5 py-1.5 text-xs text-foreground hover:border-warning">
                  {guestName(s.customer)}
                  <span className="text-subtle tabular-nums">
                    {formatDateShort(`${s.checkIn}T12:00:00`)} · {s.nights}n · {typeById.get(s.roomTypeId)?.name.split(' ')[0]}
                  </span>
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
   New reservation
   -------------------------------------------------------------------------- */

function NewStayDialog({ open, onOpenChange, stays, rooms, roomTypes, settings, currency, todayKey, guests, onCreate }: { open: boolean; onOpenChange: (open: boolean) => void; stays: Stay[]; rooms: Room[]; roomTypes: RoomType[]; settings: LodgingSettings; currency: CurrencyCode; todayKey: string; guests: Customer[]; onCreate: (stay: Stay) => void }) {
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [pick, setPick] = React.useState<Customer | null>(null)
  const [checkIn, setCheckIn] = React.useState(toDateKey(addDays(fromDateKey(todayKey), 1)))
  const [checkOut, setCheckOut] = React.useState(toDateKey(addDays(fromDateKey(todayKey), 3)))
  const [adults, setAdults] = React.useState(2)
  const [children, setChildren] = React.useState(0)
  const [typeId, setTypeId] = React.useState(roomTypes[0]?.id ?? '')
  const [planId, setPlanId] = React.useState(settings.ratePlans[0]?.id ?? '')
  const [extraIds, setExtraIds] = React.useState<string[]>([])
  const [requests, setRequests] = React.useState('')

  const nights = nightKeys(checkIn, checkOut).length
  const validDates = nights >= 1 && checkIn >= todayKey

  const availability = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const t of roomTypes) {
      const ofType = rooms.filter((r) => r.typeId === t.id && r.housekeeping !== 'out_of_order')
      const busy = new Set(stays.filter((s) => s.roomTypeId === t.id && s.roomId && s.status !== 'cancelled' && s.status !== 'no_show' && s.checkIn < checkOut && s.checkOut > checkIn).map((s) => s.roomId))
      const unassigned = stays.filter((s) => s.roomTypeId === t.id && !s.roomId && (s.status === 'booked' || s.status === 'arriving') && s.checkIn < checkOut && s.checkOut > checkIn).length
      map.set(t.id, Math.max(0, ofType.filter((r) => !busy.has(r.id)).length - unassigned))
    }
    return map
  }, [roomTypes, rooms, stays, checkIn, checkOut])

  const type = roomTypes.find((t) => t.id === typeId) ?? roomTypes[0]
  const plans = settings.ratePlans.filter((p) => nights >= p.minNights)
  const plan = plans.find((p) => p.id === planId) ?? plans[0]
  React.useEffect(() => {
    if (plan && plan.id !== planId) setPlanId(plan.id)
  }, [plan, planId])

  const quote = type && plan && validDates ? quoteStay({ type, plan, checkIn, checkOut, adults, children, extraIds, settings }) : null
  const suggestions = name.trim().length >= 2 && !pick ? guests.filter((g) => guestName(g).toLowerCase().includes(name.trim().toLowerCase())).slice(0, 4) : []
  const canSubmit = name.trim().length >= 2 && validDates && type && plan && (availability.get(type.id) ?? 0) > 0 && adults + children <= type.maxGuests

  const submit = () => {
    if (!canSubmit || !quote || !type || !plan) return
    const [first, ...rest] = name.trim().split(/\s+/)
    const customer: Customer = pick ?? {
      id: `cus_new_${Date.now().toString(36)}`,
      tenantId: type.tenantId,
      firstName: first,
      lastName: rest.join(' '),
      email,
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
      id: `stay_new_${Date.now().toString(36)}`,
      tenantId: type.tenantId,
      reference: `CV-${Date.now().toString(36).slice(-4).toUpperCase()}`,
      customer,
      roomTypeId: type.id,
      roomId: null,
      checkIn,
      checkOut,
      nights: quote.nights,
      adults,
      children,
      ratePlanId: plan.id,
      nightlyRate: quote.nightly,
      roomTotal: quote.roomTotal,
      extras: quote.extras.map((e) => ({ ...e, qty: 1 })),
      cityTax: quote.cityTax,
      total: quote.total,
      paid: quote.dueNow,
      balance: quote.total - quote.dueNow,
      status: checkIn === todayKey ? 'arriving' : 'booked',
      channel: 'phone',
      specialRequests: requests.trim() || null,
      eta: null,
      flags: [],
      createdAt: `${todayKey}T09:00:00`,
      checkedInAt: null,
      checkedOutAt: null,
    })
    setName('')
    setEmail('')
    setPhone('')
    setPick(null)
    setRequests('')
    setExtraIds([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[min(46rem,calc(100dvh-2rem))]">
        <DialogHeader divider>
          <DialogTitle>New reservation</DialogTitle>
          <DialogDescription>Taken by phone or at the desk. The rate is what the storefront would quote for the same dates.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-6 py-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="relative sm:col-span-1">
                <Field label="Guest" required>
                  {(c) => <Input {...c} value={name} onChange={(e) => { setName(e.target.value); setPick(null) }} placeholder="Full name" autoComplete="off" />}
                </Field>
                {suggestions.length ? (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-surface-raised shadow-lg">
                    {suggestions.map((g) => (
                      <li key={g.id}>
                        <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.8125rem] hover:bg-surface-sunken" onClick={() => { setPick(g); setName(guestName(g)); setEmail(g.email); setPhone(g.phone) }}>
                          <Avatar name={guestName(g)} src={g.avatarUrl} size="xs" />
                          <span className="min-w-0 flex-1 truncate text-foreground">{guestName(g)}</span>
                          <span className="shrink-0 text-xs text-subtle">{g.totalBookings} stays</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <Field label="Email">{(c) => <Input {...c} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="For the confirmation" />}</Field>
              <Field label="Phone">{(c) => <Input {...c} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+351 …" inputMode="tel" />}</Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
              <Field label="Check-in" error={!validDates && checkIn < todayKey ? 'In the past' : undefined}>{(c) => <Input {...c} type="date" min={todayKey} value={checkIn} onChange={(e) => e.target.value && setCheckIn(e.target.value)} />}</Field>
              <Field label="Check-out" error={!validDates && checkOut <= checkIn ? 'After check-in' : undefined} description={validDates ? `${nights} ${nights === 1 ? 'night' : 'nights'}` : undefined}>{(c) => <Input {...c} type="date" min={checkIn} value={checkOut} onChange={(e) => e.target.value && setCheckOut(e.target.value)} />}</Field>
              <Field label="Adults">
                <Stepper value={adults} min={1} max={4} onChange={setAdults} label="adults" />
              </Field>
              <Field label="Children">
                <Stepper value={children} min={0} max={3} onChange={setChildren} label="children" />
              </Field>
            </div>
            <Field label="Room type" error={type && adults + children > type.maxGuests ? `Sleeps ${type.maxGuests}` : undefined}>
              <div className="grid gap-2 sm:grid-cols-2">
                {roomTypes.map((t) => {
                  const free = availability.get(t.id) ?? 0
                  const active = t.id === typeId
                  const q = plan && validDates ? quoteStay({ type: t, plan, checkIn, checkOut, adults, children, extraIds: [], settings }) : null
                  return (
                    <button key={t.id} type="button" aria-pressed={active} disabled={free === 0} onClick={() => setTypeId(t.id)} className={cn('flex flex-col rounded-lg border p-3 text-left transition-colors disabled:opacity-50', active ? 'border-primary bg-primary-soft/40' : 'border-line bg-surface hover:border-line-strong')}>
                      <span className="flex items-center justify-between gap-2 text-[0.8125rem]">
                        <span className="text-foreground">{t.name}</span>
                        <span className="text-muted tabular-nums">{q ? `${formatCurrency(q.nightly, currency)}/night` : ''}</span>
                      </span>
                      <span className="mt-0.5 text-xs text-subtle">
                        {t.highlights.join(' · ')} · {free === 0 ? 'none free' : `${free} free`}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rate plan">
                <Select value={plan?.id ?? ''} onValueChange={setPlanId}>
                  <SelectTrigger aria-label="Rate plan">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} · {p.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Extras">
                <div className="flex flex-col gap-1.5">
                  {settings.extras.filter((e) => e.price > 0 || e.id === 'ex_cot').map((e) => (
                    <label key={e.id} className="flex items-center gap-2.5 text-[0.8125rem] text-foreground">
                      <Checkbox checked={extraIds.includes(e.id)} onCheckedChange={(v) => setExtraIds(v ? [...extraIds, e.id] : extraIds.filter((x) => x !== e.id))} />
                      <span className="min-w-0 flex-1 truncate">{e.label}</span>
                      <span className="text-xs text-subtle tabular-nums">{e.price ? `${formatCurrency(e.price, currency)} ${e.per === 'person' ? 'pp/night' : e.per === 'night' ? '/night' : ''}` : 'Free'}</span>
                    </label>
                  ))}
                </div>
              </Field>
            </div>
            <Field label="Requests" optional>{(c) => <Input {...c} value={requests} onChange={(e) => setRequests(e.target.value)} placeholder="High floor, quiet room, a cot…" />}</Field>
          </div>

          <aside className="rounded-xl bg-surface-sunken p-4 text-[0.8125rem]">
            <p className="text-xs font-medium text-muted">Quote</p>
            {quote && type && plan ? (
              <dl className="mt-3 flex flex-col gap-1.5 text-muted">
                <div className="flex justify-between gap-3">
                  <dt>{type.name}</dt>
                  <dd className="text-foreground tabular-nums">{quote.nights} × {formatCurrency(quote.nightly, currency)}</dd>
                </div>
                {quote.extras.map((e) => (
                  <div key={e.id} className="flex justify-between gap-3">
                    <dt>{e.label}</dt>
                    <dd className="tabular-nums">{formatCurrency(e.amount, currency)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3">
                  <dt>{settings.cityTaxLabel}</dt>
                  <dd className="tabular-nums">{formatCurrency(quote.cityTax, currency)}</dd>
                </div>
                <div className="mt-1 flex justify-between gap-3 border-t border-line pt-2 text-foreground">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatCurrency(quote.total, currency)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Due now</dt>
                  <dd className="tabular-nums">{formatCurrency(quote.dueNow, currency)}</dd>
                </div>
                <p className="mt-2 text-xs text-subtle">{plan.cancellation}</p>
              </dl>
            ) : (
              <p className="mt-3 text-subtle">Pick dates to see the rate.</p>
            )}
          </aside>
        </DialogBody>
        <DialogFooter divider className="sm:justify-between">
          <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" leftIcon={<Check />} disabled={!canSubmit} onClick={submit}>
            Book {quote ? formatCurrency(quote.total, currency) : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export const __icons = { KeyRound }
