'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, BedDouble, Check, KeyRound, LogOut, MessageSquare, Plus } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Segmented } from '@/components/ui/segmented'
import { toast } from '@/components/ui/toaster'
import {
  HOUSEKEEPING_META,
  STAY_CHANNEL_LABEL,
  STAY_FLAG_LABEL,
  STAY_STATUS_META,
  type LodgingSettings,
  type Room,
  type RoomType,
  type Stay,
} from '@/lib/hospitality/types'
import { cn, formatCurrency, formatDateShort } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import { StatTile, StatusWord, guestName } from './shared'
import { StaySheet } from './stay-sheet'

/* ==========================================================================
   <FrontDesk> — today at the desk.

   Three lists: who is arriving, who is leaving, who is in the house. Each
   row has the one thing the desk does next — assign a room, check in,
   settle and check out. A rail on the right lists what needs a hand before
   the first guest walks in.
   ========================================================================== */

type Tab = 'arrivals' | 'departures' | 'inhouse'

const READY = new Set(['clean', 'inspected'])

export interface FrontDeskProps {
  stays: Stay[]
  rooms: Room[]
  roomTypes: RoomType[]
  settings: LodgingSettings
  currency: CurrencyCode
  todayKey: string
  nowTime: string
}

export function FrontDesk({ stays: initialStays, rooms: initialRooms, roomTypes, settings, currency, todayKey, nowTime }: FrontDeskProps) {
  const [stays, setStays] = React.useState(initialStays)
  const [rooms, setRooms] = React.useState(initialRooms)
  const [tab, setTab] = React.useState<Tab>('arrivals')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [assigningId, setAssigningId] = React.useState<string | null>(null)

  const roomById = React.useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms])
  const typeById = React.useMemo(() => new Map(roomTypes.map((t) => [t.id, t])), [roomTypes])
  const planById = React.useMemo(() => new Map(settings.ratePlans.map((p) => [p.id, p])), [settings.ratePlans])

  const arrivals = React.useMemo(() => stays.filter((s) => s.checkIn === todayKey && (s.status === 'arriving' || s.status === 'booked' || (s.status === 'in_house' && s.checkedInAt?.startsWith(todayKey)))).sort((a, b) => (a.eta ?? '99').localeCompare(b.eta ?? '99')), [stays, todayKey])
  const departures = React.useMemo(() => stays.filter((s) => s.checkOut === todayKey && (s.status === 'departing' || s.status === 'checked_out')).sort((a, b) => (a.status === b.status ? (roomById.get(a.roomId ?? '')?.number ?? '').localeCompare(roomById.get(b.roomId ?? '')?.number ?? '') : a.status === 'departing' ? -1 : 1)), [stays, todayKey, roomById])
  const inHouse = React.useMemo(() => stays.filter((s) => s.status === 'in_house' || s.status === 'departing').sort((a, b) => (roomById.get(a.roomId ?? '')?.number ?? '').localeCompare(roomById.get(b.roomId ?? '')?.number ?? '')), [stays, roomById])

  const sellable = rooms.filter((r) => r.housekeeping !== 'out_of_order').length
  const tonight = stays.filter((s) => s.checkIn <= todayKey && s.checkOut > todayKey && (s.status === 'in_house' || s.status === 'arriving' || s.status === 'booked')).length
  const unassigned = arrivals.filter((s) => !s.roomId && s.status !== 'in_house')
  const roomsReady = arrivals.filter((s) => s.roomId && READY.has(roomById.get(s.roomId)?.housekeeping ?? 'dirty')).length
  const checkedOut = departures.filter((s) => s.status === 'checked_out').length

  /* ---------- actions ---------- */

  const setStay = (id: string, change: (s: Stay) => Stay) => setStays((current) => current.map((s) => (s.id === id ? change(s) : s)))
  const setRoom = (id: string, change: (r: Room) => Room) => setRooms((current) => current.map((r) => (r.id === id ? change(r) : r)))

  const assign = (stay: Stay, room: Room) => {
    if (stay.roomId) setRoom(stay.roomId, (r) => ({ ...r, arrivingStayId: null, occupancy: r.currentStayId ? 'departing' : 'vacant' }))
    setStay(stay.id, (s) => ({ ...s, roomId: room.id }))
    setRoom(room.id, (r) => ({ ...r, arrivingStayId: stay.id, occupancy: r.currentStayId ? 'turnover' : 'arriving' }))
    setAssigningId(null)
    toast.success(`${guestName(stay.customer)} in room ${room.number}`, { description: READY.has(room.housekeeping) ? 'The room is ready.' : `Housekeeping still has it: ${HOUSEKEEPING_META[room.housekeeping].label.toLowerCase()}.` })
  }

  const checkIn = (stay: Stay) => {
    const room = stay.roomId ? roomById.get(stay.roomId) : null
    if (!room) {
      setAssigningId(stay.id)
      return
    }
    if (!READY.has(room.housekeeping)) {
      toast.error(`Room ${room.number} is not ready`, { description: `Housekeeping: ${HOUSEKEEPING_META[room.housekeeping].label.toLowerCase()}. Ask them to rush it, or move the guest.` })
      return
    }
    setStay(stay.id, (s) => ({ ...s, status: 'in_house', checkedInAt: `${todayKey}T${nowTime}:00` }))
    setRoom(room.id, (r) => ({ ...r, occupancy: 'stayover', currentStayId: stay.id, arrivingStayId: null }))
    toast.success(`${guestName(stay.customer)} checked in to ${room.number}`, { description: stay.balance > 0 ? `${formatCurrency(stay.balance, currency)} to settle at checkout.` : 'Paid in full.' })
  }

  const checkOut = (stay: Stay) => {
    const room = stay.roomId ? roomById.get(stay.roomId) : null
    setStay(stay.id, (s) => ({ ...s, status: 'checked_out', checkedOutAt: `${todayKey}T${nowTime}:00`, paid: s.total, balance: 0 }))
    if (room) setRoom(room.id, (r) => ({ ...r, housekeeping: 'dirty', occupancy: r.arrivingStayId ? 'turnover' : 'departing', currentStayId: null }))
    toast.success(`${guestName(stay.customer)} checked out${room ? ` of ${room.number}` : ''}`, { description: stay.balance > 0 ? `${formatCurrency(stay.balance, currency)} charged to the card on file. Receipt emailed.` : 'Nothing owed. Receipt emailed.' })
  }

  const extend = (stay: Stay) => {
    const next = new Date(`${stay.checkOut}T12:00:00`)
    next.setDate(next.getDate() + 1)
    const checkOutKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`
    setStay(stay.id, (s) => ({ ...s, checkOut: checkOutKey, nights: s.nights + 1, roomTotal: s.roomTotal + s.nightlyRate, total: s.total + s.nightlyRate + settings.cityTaxPerNight * s.adults, balance: s.balance + s.nightlyRate + settings.cityTaxPerNight * s.adults, status: s.status === 'departing' ? 'in_house' : s.status }))
    toast.success(`${guestName(stay.customer)} extended to ${formatDateShort(`${checkOutKey}T12:00:00`)}`, { description: `One more night at ${formatCurrency(stay.nightlyRate, currency)}.` })
  }

  const message = (stay: Stay) => toast.success(`Message sent to ${guestName(stay.customer)}`, { description: 'Check-in details, the door code and the rooftop breakfast hours.' })

  const selected = selectedId ? stays.find((s) => s.id === selectedId) ?? null : null
  const assigning = assigningId ? stays.find((s) => s.id === assigningId) ?? null : null

  /* ---------- columns ---------- */

  const guestCell = (s: Stay) => (
    <span className="flex min-w-[11rem] max-w-[18rem] items-center gap-2.5">
      <Avatar name={guestName(s.customer)} src={s.customer.avatarUrl} size="xs" />
      <span className="min-w-0">
        <span className="block truncate text-[0.8125rem] text-foreground">{guestName(s.customer)}</span>
        {s.flags.length ? <span className="block truncate text-xs text-subtle">{s.flags.map((f) => STAY_FLAG_LABEL[f]).join(' · ')}</span> : null}
      </span>
    </span>
  )
  const roomCell = (s: Stay) => {
    const room = s.roomId ? roomById.get(s.roomId) : null
    if (!room)
      return (
        <Button size="xs" variant="outline" leftIcon={<BedDouble />} onClick={(e) => { e.stopPropagation(); setAssigningId(s.id) }}>
          Assign
        </Button>
      )
    return (
      <span className="inline-flex items-center gap-2 text-[0.8125rem] text-foreground tabular-nums">
        {room.number}
        {s.status !== 'in_house' && s.status !== 'departing' && s.status !== 'checked_out' ? <StatusWord label={HOUSEKEEPING_META[room.housekeeping].label} tone={HOUSEKEEPING_META[room.housekeeping].tone} className="text-xs" /> : null}
      </span>
    )
  }
  const nightsCell = (s: Stay) => (
    <span className="whitespace-nowrap text-[0.8125rem] text-muted tabular-nums">
      {s.nights} {s.nights === 1 ? 'night' : 'nights'} <span className="text-subtle">· to {formatDateShort(`${s.checkOut}T12:00:00`)}</span>
    </span>
  )
  const guestsCell = (s: Stay) => <span className="text-[0.8125rem] text-muted tabular-nums">{s.adults}{s.children ? ` + ${s.children}` : ''}</span>
  const balanceCell = (s: Stay) => (s.balance > 0 ? <span className="text-[0.8125rem] text-warning tabular-nums">{formatCurrency(s.balance, currency)} due</span> : <span className="text-[0.8125rem] text-muted">Paid</span>)
  const statusCell = (s: Stay) => <StatusWord label={STAY_STATUS_META[s.status].label} tone={STAY_STATUS_META[s.status].tone} />

  const arrivalColumns: DataTableColumn<Stay>[] = [
    { id: 'eta', header: 'ETA', width: '4.5rem', cell: (s) => <span className="text-[0.8125rem] text-foreground tabular-nums">{s.status === 'in_house' ? s.checkedInAt?.slice(11, 16) : s.eta ?? '—'}</span> },
    { id: 'guest', header: 'Guest', cell: guestCell },
    { id: 'room', header: 'Room', width: '9rem', cell: roomCell },
    { id: 'type', header: 'Type', hideBelow: 'lg', width: '9rem', cell: (s) => <span className="truncate text-[0.8125rem] text-muted">{typeById.get(s.roomTypeId)?.name}</span> },
    { id: 'nights', header: 'Stay', hideBelow: 'md', cell: nightsCell },
    { id: 'guests', header: 'Guests', hideBelow: 'xl', align: 'right', numeric: true, width: '4.5rem', cell: guestsCell },
    { id: 'plan', header: 'Rate', hideBelow: 'xl', width: '8rem', cell: (s) => <span className="text-[0.8125rem] text-muted">{planById.get(s.ratePlanId)?.name}</span> },
    { id: 'balance', header: 'Balance', align: 'right', numeric: true, width: '6.5rem', cell: balanceCell },
    { id: 'channel', header: 'Via', hideBelow: 'xl', width: '6.5rem', cell: (s) => <span className="text-[0.8125rem] text-muted">{STAY_CHANNEL_LABEL[s.channel]}</span> },
    { id: 'status', header: 'Status', width: '6.5rem', cell: statusCell },
    {
      id: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      width: '7rem',
      cell: (s) =>
        s.status === 'in_house' ? (
          <span className="text-xs text-subtle">Checked in</span>
        ) : (
          <Button size="xs" variant={s.roomId ? 'primary' : 'secondary'} leftIcon={<KeyRound />} onClick={(e) => { e.stopPropagation(); checkIn(s) }}>
            Check in
          </Button>
        ),
    },
  ]

  const departureColumns: DataTableColumn<Stay>[] = [
    { id: 'room', header: 'Room', width: '5rem', cell: (s) => <span className="text-[0.8125rem] text-foreground tabular-nums">{s.roomId ? roomById.get(s.roomId)?.number : '—'}</span> },
    { id: 'guest', header: 'Guest', cell: guestCell },
    { id: 'nights', header: 'Stayed', hideBelow: 'md', cell: (s) => <span className="text-[0.8125rem] text-muted tabular-nums">{s.nights} {s.nights === 1 ? 'night' : 'nights'} <span className="text-subtle">· since {formatDateShort(`${s.checkIn}T12:00:00`)}</span></span> },
    { id: 'by', header: 'Out by', width: '7rem', cell: (s) => <span className="text-[0.8125rem] text-muted tabular-nums">{s.status === 'checked_out' ? `left ${s.checkedOutAt?.slice(11, 16)}` : s.flags.includes('late_checkout') ? '14:00' : settings.checkOutBy}</span> },
    { id: 'balance', header: 'Balance', align: 'right', numeric: true, width: '6.5rem', cell: balanceCell },
    { id: 'channel', header: 'Via', hideBelow: 'xl', width: '6.5rem', cell: (s) => <span className="text-[0.8125rem] text-muted">{STAY_CHANNEL_LABEL[s.channel]}</span> },
    { id: 'status', header: 'Status', width: '7rem', cell: statusCell },
    {
      id: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      width: '9rem',
      cell: (s) =>
        s.status === 'checked_out' ? (
          <span className="text-xs text-subtle">Done</span>
        ) : (
          <Button size="xs" variant={s.balance > 0 ? 'primary' : 'secondary'} leftIcon={<LogOut />} onClick={(e) => { e.stopPropagation(); checkOut(s) }}>
            {s.balance > 0 ? 'Settle & check out' : 'Check out'}
          </Button>
        ),
    },
  ]

  const inHouseColumns: DataTableColumn<Stay>[] = [
    { id: 'room', header: 'Room', width: '5rem', cell: (s) => <span className="text-[0.8125rem] text-foreground tabular-nums">{s.roomId ? roomById.get(s.roomId)?.number : '—'}</span> },
    { id: 'guest', header: 'Guest', cell: guestCell },
    { id: 'type', header: 'Type', hideBelow: 'lg', width: '9rem', cell: (s) => <span className="truncate text-[0.8125rem] text-muted">{typeById.get(s.roomTypeId)?.name}</span> },
    { id: 'until', header: 'Until', cell: (s) => <span className="text-[0.8125rem] text-muted tabular-nums">{formatDateShort(`${s.checkOut}T12:00:00`)} <span className="text-subtle">· {s.checkOut === todayKey ? 'today' : `${Math.max(1, Math.round((new Date(`${s.checkOut}T12:00:00`).getTime() - new Date(`${todayKey}T12:00:00`).getTime()) / 86_400_000))} more`}</span></span> },
    { id: 'guests', header: 'Guests', hideBelow: 'xl', align: 'right', numeric: true, width: '4.5rem', cell: guestsCell },
    { id: 'balance', header: 'Balance', align: 'right', numeric: true, width: '6.5rem', cell: balanceCell },
    { id: 'status', header: 'Status', width: '6.5rem', cell: statusCell },
    {
      id: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      width: '9rem',
      cell: (s) => (
        <span className="inline-flex gap-1">
          <Button size="xs" variant="ghost" leftIcon={<Plus />} onClick={(e) => { e.stopPropagation(); extend(s) }}>
            Night
          </Button>
          <Button size="xs" variant="ghost" leftIcon={<MessageSquare />} aria-label="Message guest" onClick={(e) => { e.stopPropagation(); message(s) }} />
        </span>
      ),
    },
  ]

  const rows = tab === 'arrivals' ? arrivals : tab === 'departures' ? departures : inHouse
  const columns = tab === 'arrivals' ? arrivalColumns : tab === 'departures' ? departureColumns : inHouseColumns

  /* ---------- attention ---------- */

  const attention: { key: string; text: string; tone: string; stay: Stay }[] = []
  for (const s of unassigned) attention.push({ key: `${s.id}-room`, text: `${guestName(s.customer)} has no room yet${s.eta ? ` · arriving ${s.eta}` : ''}`, tone: 'bg-warning', stay: s })
  for (const s of arrivals) {
    const room = s.roomId ? roomById.get(s.roomId) : null
    if (room && !READY.has(room.housekeeping) && s.status !== 'in_house') attention.push({ key: `${s.id}-hk`, text: `Room ${room.number} is ${HOUSEKEEPING_META[room.housekeeping].label.toLowerCase()} for ${guestName(s.customer)}${s.eta ? ` (${s.eta})` : ''}`, tone: 'bg-danger', stay: s })
    if (s.flags.includes('vip')) attention.push({ key: `${s.id}-vip`, text: `${guestName(s.customer)} is a VIP · flowers and a card`, tone: 'bg-info', stay: s })
    if (s.flags.includes('early_checkin')) attention.push({ key: `${s.id}-early`, text: `${guestName(s.customer)} asked for an early check-in`, tone: 'bg-info', stay: s })
  }
  for (const s of departures) if (s.status === 'departing' && s.balance > 0) attention.push({ key: `${s.id}-bal`, text: `${guestName(s.customer)} owes ${formatCurrency(s.balance, currency)} at checkout`, tone: 'bg-warning', stay: s })

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Arrivals" hint={unassigned.length ? `${unassigned.length} without a room` : 'all assigned'} value={arrivals.length} line={`Check-in from ${settings.checkInFrom} · ${roomsReady} rooms ready`} tone="bg-warning" active={tab === 'arrivals'} onClick={() => setTab('arrivals')} />
        <StatTile label="Departures" hint={`${checkedOut} already out`} value={departures.length} line={`Check-out by ${settings.checkOutBy}`} tone="bg-primary" active={tab === 'departures'} onClick={() => setTab('departures')} />
        <StatTile label="In house" hint="right now" value={inHouse.length} line={`${tonight} of ${sellable} rooms tonight · ${sellable ? Math.round((tonight / sellable) * 100) : 0}%`} tone="bg-success" active={tab === 'inhouse'} onClick={() => setTab('inhouse')} />
        <StatTile label="Needs a hand" hint="before 15:00" value={attention.length} line={attention.length ? attention[0].text : 'Nothing outstanding'} tone={attention.length ? 'bg-danger' : 'bg-line-strong'} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <Card className="min-w-0">
          <div className="flex flex-col gap-3 border-b border-line-subtle px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
            <Segmented
              size="sm"
              label="Front desk list"
              options={[
                { value: 'arrivals', label: 'Arrivals', count: arrivals.length },
                { value: 'departures', label: 'Departures', count: departures.length },
                { value: 'inhouse', label: 'In house', count: inHouse.length },
              ]}
              value={tab}
              onValueChange={setTab}
            />
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/housekeeping">Housekeeping</Link>
              </Button>
              <Button asChild size="sm" leftIcon={<Plus />}>
                <Link href="/dashboard/stays?new=1">New reservation</Link>
              </Button>
            </div>
          </div>
          <CardContent className="p-0">
            <DataTable
              columns={columns}
              rows={rows}
              getRowId={(s) => s.id}
              onRowClick={(s) => setSelectedId(s.id)}
              stickyHeader
              rowHeight="compact"
              ariaLabel={tab}
              getRowClassName={(s) => (s.status === 'checked_out' || (tab === 'arrivals' && s.status === 'in_house') ? 'opacity-60' : undefined)}
              empty={<EmptyState variant="no-data" size="sm" title={tab === 'arrivals' ? 'No arrivals today' : tab === 'departures' ? 'No departures today' : 'Nobody in the house'} description="A quiet day at the desk." />}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-sm">Before the first arrival</CardTitle>
              <CardDescription>Rooms, balances and requests to sort out.</CardDescription>
            </CardHeader>
            <CardContent>
              {attention.length === 0 ? (
                <p className="flex items-center gap-2 text-[0.8125rem] text-muted">
                  <Check aria-hidden="true" className="size-4 text-success" /> Everything is in hand.
                </p>
              ) : (
                <ul className="flex flex-col divide-y divide-line-subtle">
                  {attention.slice(0, 8).map((a) => (
                    <li key={a.key}>
                      <button type="button" onClick={() => setSelectedId(a.stay.id)} className="flex w-full items-start gap-2.5 py-2.5 text-left first:pt-0 last:pb-0">
                        <span aria-hidden="true" className={cn('mt-1.5 size-1.5 shrink-0 rounded-full', a.tone)} />
                        <span className="text-[0.8125rem] text-muted">{a.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardContent className="flex items-start gap-3 pt-5 text-[0.8125rem] text-muted">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-faint" />
              <p>
                Room 303 is out of order until 15 September. {rooms.filter((r) => r.occupancy === 'vacant' && READY.has(r.housekeeping)).length} rooms are ready and free tonight for walk-ins.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <StaySheet
        stay={selected}
        room={selected?.roomId ? roomById.get(selected.roomId) ?? null : null}
        roomType={selected ? typeById.get(selected.roomTypeId) ?? null : null}
        plan={selected ? planById.get(selected.ratePlanId) ?? null : null}
        currency={currency}
        onClose={() => setSelectedId(null)}
        actions={
          selected ? (
            <>
              {selected.status === 'arriving' || selected.status === 'booked' ? (
                <>
                  <Button size="sm" leftIcon={<KeyRound />} onClick={() => { checkIn(selected); if (selected.roomId) setSelectedId(null) }}>
                    Check in
                  </Button>
                  <Button size="sm" variant="secondary" leftIcon={<BedDouble />} onClick={() => setAssigningId(selected.id)}>
                    {selected.roomId ? 'Move room' : 'Assign room'}
                  </Button>
                </>
              ) : null}
              {selected.status === 'in_house' || selected.status === 'departing' ? (
                <>
                  <Button size="sm" leftIcon={<LogOut />} onClick={() => { checkOut(selected); setSelectedId(null) }}>
                    {selected.balance > 0 ? 'Settle & check out' : 'Check out'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => extend(selected)}>
                    Add a night
                  </Button>
                </>
              ) : null}
              <Button size="sm" variant="ghost" leftIcon={<MessageSquare />} onClick={() => message(selected)}>
                Message
              </Button>
            </>
          ) : null
        }
      />

      <AssignRoomDialog stay={assigning} rooms={rooms} roomTypes={roomTypes} onClose={() => setAssigningId(null)} onAssign={assign} />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Assign a room
   -------------------------------------------------------------------------- */

export function AssignRoomDialog({ stay, rooms, roomTypes, onClose, onAssign }: { stay: Stay | null; rooms: Room[]; roomTypes: RoomType[]; onClose: () => void; onAssign: (stay: Stay, room: Room) => void }) {
  const typeById = new Map(roomTypes.map((t) => [t.id, t]))
  const wanted = stay ? typeById.get(stay.roomTypeId) : null
  const candidates = stay
    ? rooms
        .filter((r) => r.housekeeping !== 'out_of_order' && !r.currentStayId && (!r.arrivingStayId || r.arrivingStayId === stay.id))
        .filter((r) => (typeById.get(r.typeId)?.maxGuests ?? 0) >= stay.adults + stay.children)
        .sort((a, b) => {
          const aMatch = a.typeId === stay.roomTypeId ? 0 : 1
          const bMatch = b.typeId === stay.roomTypeId ? 0 : 1
          if (aMatch !== bMatch) return aMatch - bMatch
          const aReady = READY.has(a.housekeeping) ? 0 : 1
          const bReady = READY.has(b.housekeeping) ? 0 : 1
          return aReady - bReady || a.number.localeCompare(b.number)
        })
    : []
  return (
    <Dialog open={stay !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader divider>
          <DialogTitle>{stay ? `Room for ${guestName(stay.customer)}` : 'Assign a room'}</DialogTitle>
          <DialogDescription>
            {wanted ? `Booked a ${wanted.name}` : ''}
            {stay ? ` for ${stay.adults}${stay.children ? ` + ${stay.children}` : ''}, ${stay.nights} ${stay.nights === 1 ? 'night' : 'nights'}. Same type first, ready rooms first; anything else is an upgrade.` : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="py-4">
          {candidates.length === 0 ? (
            <p className="text-[0.8125rem] text-muted">Nothing free that fits. Check departures, or ask housekeeping to rush a room.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {candidates.slice(0, 12).map((r) => {
                const type = typeById.get(r.typeId)
                const upgrade = stay && r.typeId !== stay.roomTypeId
                return (
                  <button key={r.id} type="button" onClick={() => stay && onAssign(stay, r)} className="flex flex-col rounded-lg border border-line bg-surface p-3 text-left transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground tabular-nums">{r.number}</span>
                      <StatusWord label={HOUSEKEEPING_META[r.housekeeping].label} tone={HOUSEKEEPING_META[r.housekeeping].tone} className="text-xs" />
                    </span>
                    <span className="mt-1 truncate text-xs text-muted">{type?.name}</span>
                    <span className="truncate text-xs text-subtle">{upgrade ? 'Upgrade' : r.features.join(' · ') || `Floor ${r.floor}`}</span>
                  </button>
                )
              })}
            </div>
          )}
        </DialogBody>
        <DialogFooter divider>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
