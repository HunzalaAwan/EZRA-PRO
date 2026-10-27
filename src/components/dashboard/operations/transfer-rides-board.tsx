'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlarmClock, ArrowRight, Car, CheckCircle2, ExternalLink, MessageSquareText, MoreHorizontal, Phone, Plane, Printer, UserRound, UserX } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { toast } from '@/components/ui/toaster'
import { useBookingLedger } from '@/hooks/use-booking-ledger'
import { useRideAssignments } from '@/hooks/use-transfer-rides'
import type { LedgerStore } from '@/lib/booking-ledger'
import type { TransferRideSheet } from '@/lib/operations'
import { RIDE_STAGE_LABEL, driversMissing, nextStage, ridesOf, vehicleUnitsOf, type RideAssignment, type RideStage, type TransferRide } from '@/lib/transfer-rides'
import { flightLine, hhmm } from '@/lib/transfer-changes'
import { directionLabel } from '@/lib/transfers'
import { cn, pluralize } from '@/lib/utils'
import type { Activity, TransferBookingDetails } from '@/types'

/* ==========================================================================
   RIDES — the transfer day as a plain to-do list. One row per ride (a round
   trip's return is its own row, on its own day), in pickup order. Each row
   gets a driver and a vehicle, and one button that moves it along: On the
   way → Picked up → Done. Everything else (no-show, text the guest, running
   late, the booking) sits in the row's menu. Prints as a list per driver.
   ========================================================================== */

type Filter = 'all' | 'arrivals' | 'departures' | 'other'

export interface RideDriver {
  id: string
  name: string
}

/* ---------- this browser's bookings and changes, laid over the seeded rides ---------- */

/**
 * The rides on one day: the server's seeded rides (any days; only `dayKey`'s
 * are kept) with this browser's changes laid over them (a changed ride is
 * worked out again from `changes[reference].transfer`; a cancelled one drops
 * off), plus every ride booked in this browser (ledger entries with a ride).
 * In pickup order.
 */
export function mergeLedgerRides(activities: Activity[], serverRides: TransferRide[], store: LedgerStore, dayKey: string): TransferRide[] {
  const byId = new Map(activities.map((activity) => [activity.id, activity]))
  const bySlug = new Map(activities.map((activity) => [activity.slug, activity]))
  const out = new Map<string, TransferRide>()
  const changed = new Set<string>()
  for (const ride of serverRides) {
    const change = store.changes[ride.reference]
    if (change?.cancelled) continue
    const activity = byId.get(ride.activityId)
    if (change?.transfer && activity) {
      if (changed.has(ride.reference)) continue
      changed.add(ride.reference)
      for (const next of ridesOf({
        activity,
        reference: ride.reference,
        bookingId: ride.bookingId,
        details: change.transfer,
        guestName: ride.guestName,
        phone: ride.phone,
        status: ride.status,
        extras: ride.extras.map(parseExtra),
      })) {
        out.set(next.id, next)
      }
      continue
    }
    out.set(ride.id, ride)
  }
  for (const entry of store.entries) {
    if (!entry.transfer) continue
    const activity = bySlug.get(entry.activitySlug)
    if (!activity) continue
    const change = store.changes[entry.reference] ?? store.changes[entry.id]
    if (change?.cancelled) continue
    const details: TransferBookingDetails = change?.transfer ?? entry.transfer
    for (const ride of ridesOf({ activity, reference: entry.reference, details, guestName: entry.name || 'Guest', phone: entry.phone ?? '', status: 'confirmed' })) {
      out.set(ride.id, ride)
    }
  }
  return [...out.values()]
    .filter((ride) => ride.pickupAt.slice(0, 10) === dayKey && ride.status !== 'cancelled' && ride.status !== 'refunded')
    .sort((a, b) => (a.pickupAt < b.pickupAt ? -1 : a.pickupAt > b.pickupAt ? 1 : a.id.localeCompare(b.id)))
}

/** "Child seat × 2" back to its label and count. */
function parseExtra(text: string): { label: string; qty: number } {
  const match = /^(.*) × (\d+)$/.exec(text)
  return match ? { label: match[1], qty: Number(match[2]) } : { label: text, qty: 1 }
}

/* ---------- words ---------- */

const dayLabel = (dayKey: string, index: number) =>
  index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${dayKey}T12:00:00`))
const shortDate = (dayKey: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${dayKey}T12:00:00`))
const plusMinutes = (iso: string, minutes: number) => {
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() + minutes)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name
const filterOf = (ride: TransferRide): Exclude<Filter, 'all'> => (ride.direction === 'from_hub' ? 'arrivals' : ride.direction === 'to_hub' ? 'departures' : 'other')
const vehicleWords = (ride: TransferRide) => ride.vehicles.map((line) => (line.qty > 1 ? `${line.qty} × ${line.name}` : line.name)).join(' and ')

const NEXT_LABEL: Partial<Record<RideStage, string>> = { todo: 'On the way', on_way: 'Picked up', picked_up: 'Done' }

/* ==========================================================================
   <TransferRidesBoard>
   ========================================================================== */

export function TransferRidesBoard({
  sheets,
  activities,
  drivers,
  units,
  tenantSlug,
  todayKey,
}: {
  /** A week of seeded rides, today first. */
  sheets: TransferRideSheet[]
  /** The tenant's transfer activities. */
  activities: Activity[]
  /** Team members who can drive. */
  drivers: RideDriver[]
  /** Each vehicle resource's units by resource id: "Hiace 1"… */
  units: Record<string, string[]>
  tenantSlug: string
  /** The demo's today, "YYYY-MM-DD". */
  todayKey: string
}) {
  const [dayIndex, setDayIndex] = React.useState(0)
  const [filter, setFilter] = React.useState<Filter>('all')
  const ledger = useBookingLedger(tenantSlug)
  const { assignments, save } = useRideAssignments(tenantSlug)

  const allServer = React.useMemo(() => sheets.flatMap((sheet) => sheet.rides), [sheets])
  const days = React.useMemo(() => sheets.map((sheet) => ({ dayKey: sheet.dayKey, rides: mergeLedgerRides(activities, allServer, ledger, sheet.dayKey) })), [sheets, activities, allServer, ledger])
  const day = days[dayIndex] ?? days[0]
  const past = day.dayKey < todayKey

  /** A ride's assignment; a past ride nobody touched, or a completed booking, reads as done. */
  const assignmentOf = (ride: TransferRide): RideAssignment => {
    const saved = assignments[ride.id]
    if (saved) return saved
    if (ride.status === 'no_show') return { stage: 'no_show' }
    if (past || ride.status === 'completed') return { stage: 'done' }
    return { stage: 'todo' }
  }

  const shown = day.rides.filter((ride) => filter === 'all' || filterOf(ride) === filter)
  const live = day.rides.filter((ride) => assignmentOf(ride).stage !== 'no_show')
  const passengers = live.reduce((sum, ride) => sum + ride.passengers, 0)
  // A group in two vehicles needs two drivers.
  const noDriver = live.filter((ride) => assignmentOf(ride).stage !== 'done' && driversMissing(ride, assignmentOf(ride)) > 0).length
  const first = live[0]
  const count = (key: Exclude<Filter, 'all'>) => day.rides.filter((ride) => filterOf(ride) === key).length
  const driverName = (id: string | undefined) => drivers.find((driver) => driver.id === id)?.name

  const tiles = [
    { label: 'Rides', value: String(day.rides.length), note: `${count('arrivals')} ${pluralize(count('arrivals'), 'arrival')} · ${count('departures')} ${pluralize(count('departures'), 'departure')}`, warn: false },
    { label: 'Passengers', value: String(passengers), note: `${live.reduce((sum, ride) => sum + ride.bags, 0)} suitcases`, warn: false },
    { label: 'First pickup', value: first ? hhmm(first.pickupAt) : '—', note: first ? first.from : 'Nothing booked', warn: false },
    { label: 'Without a driver', value: String(noDriver), note: noDriver > 0 ? 'Pick a driver on each' : day.rides.length > 0 ? 'All have a driver' : 'None', warn: noDriver > 0 },
  ]

  /* ---------- the print sheet: one list per driver ---------- */
  const byDriver = React.useMemo(() => {
    const map = new Map<string, TransferRide[]>()
    for (const ride of day.rides) {
      const a = assignments[ride.id]
      if (a?.stage === 'no_show') continue
      // On each of its drivers' lists (a group in two vehicles has two).
      const ids = [a?.driverId, ...(a?.more ?? []).map((entry) => entry.driverId)].slice(0, Math.max(1, vehicleUnitsOf(ride).length))
      for (const key of new Set(ids.map((id) => driverName(id) ?? 'No driver yet'))) map.set(key, [...(map.get(key) ?? []), ride])
    }
    return [...map.entries()].sort(([a], [b]) => (a === 'No driver yet' ? 1 : b === 'No driver yet' ? -1 : a.localeCompare(b)))
    // driverName reads `drivers`, which never changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.rides, assignments])

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- days ---------- */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 print:hidden" role="tablist" aria-label="Day">
        {days.map((entry, index) => {
          const on = index === dayIndex
          const people = entry.rides.reduce((sum, ride) => sum + ride.passengers, 0)
          return (
            <button
              key={entry.dayKey}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setDayIndex(index)}
              className={cn(
                'flex min-w-[7.5rem] shrink-0 flex-col items-start rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                on ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className="text-sm font-semibold">{dayLabel(entry.dayKey, index)}</span>
              <span className={cn('text-xs', on ? 'text-on-primary/80' : 'text-subtle')}>{shortDate(entry.dayKey)}</span>
              <span className={cn('mt-1 text-xs font-medium tabular-nums', on ? 'text-on-primary' : entry.rides.length > 0 ? 'text-muted' : 'text-faint')}>
                {entry.rides.length > 0 ? `${entry.rides.length} ${pluralize(entry.rides.length, 'ride')} · ${people} ${pluralize(people, 'passenger')}` : 'No rides'}
              </span>
            </button>
          )
        })}
      </div>

      {/* ---------- the day in numbers ---------- */}
      <div className="grid grid-cols-2 gap-3 print:hidden lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface px-4 py-3.5">
            <p className="text-xs font-medium text-muted">{tile.label}</p>
            <p className={cn('mt-1 font-display text-2xl font-semibold tabular-nums', tile.warn && 'text-warning')}>{tile.value}</p>
            <p className={cn('truncate text-xs', tile.warn ? 'font-medium text-warning' : 'text-subtle')}>{tile.note}</p>
          </div>
        ))}
      </div>

      {day.rides.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center print:hidden">
          <Car className="size-6 text-faint" aria-hidden="true" />
          <p className="text-sm font-semibold">No rides {dayIndex === 0 ? 'today' : `on ${dayLabel(day.dayKey, dayIndex)} ${shortDate(day.dayKey)}`}</p>
          <p className="max-w-md text-sm text-muted">Transfer bookings show here on the day of each pickup.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
              <Segmented
                label="Show"
                value={filter}
                onValueChange={setFilter}
                className="min-w-max"
                options={[
                  { value: 'all', label: 'All', count: day.rides.length },
                  { value: 'arrivals', label: 'Arrivals', count: count('arrivals') },
                  { value: 'departures', label: 'Departures', count: count('departures') },
                  { value: 'other', label: 'Other', count: count('other') },
                ]}
              />
            </div>
            <Button variant="secondary" leftIcon={<Printer />} onClick={() => window.print()}>
              Print
            </Button>
          </div>

          {shown.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-surface px-6 py-8 text-center text-sm text-muted print:hidden">Nothing here on this day.</p>
          ) : (
            <ol className="flex list-none flex-col divide-y divide-line-subtle overflow-hidden rounded-2xl border border-line bg-surface p-0 print:hidden">
              {shown.map((ride) => (
                <RideRow
                  key={ride.id}
                  ride={ride}
                  activity={activities.find((activity) => activity.id === ride.activityId)}
                  assignment={assignmentOf(ride)}
                  drivers={drivers}
                  units={[...new Set(ride.vehicles.flatMap((line) => (line.resourceId ? (units[line.resourceId] ?? []) : [])))]}
                  onSave={(patch) => save(ride.id, { ...assignmentOf(ride), ...patch })}
                />
              ))}
            </ol>
          )}

          {/* ---------- print: one clean list per driver ---------- */}
          <div className="hidden flex-col gap-6 print:flex">
            <p className="text-lg font-semibold">
              Rides · {dayLabel(day.dayKey, dayIndex)} {shortDate(day.dayKey)} · {day.rides.length} rides · {passengers} passengers
            </p>
            {byDriver.map(([driver, rides]) => (
              <section key={driver} className="break-inside-avoid">
                <h3 className="border-b border-line pb-1 text-base font-semibold">{driver}</h3>
                <table className="mt-1 w-full text-sm">
                  <tbody>
                    {rides.map((ride) => {
                      const a = assignments[ride.id]
                      return (
                        <tr key={ride.id} className="border-b border-line-subtle align-top">
                          <td className="w-16 py-1.5 font-semibold tabular-nums">{a?.lateMinutes ? plusMinutes(ride.pickupAt, a.lateMinutes) : hhmm(ride.pickupAt)}</td>
                          <td className="py-1.5">
                            {ride.guestName} · {ride.passengers} · {ride.bags} bags · {ride.phone}
                            <br />
                            {ride.from} → {ride.to}
                            {flightLine(ride) ? ` · ${flightLine(ride)}` : ''}
                          </td>
                          <td className="py-1.5 text-right">{a?.vehicle || vehicleWords(ride)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ==========================================================================
   One ride: time, who, where, the flight; driver and vehicle; one button.
   ========================================================================== */

function RideRow({
  ride,
  activity,
  assignment,
  drivers,
  units,
  onSave,
}: {
  ride: TransferRide
  activity?: Activity
  assignment: RideAssignment
  drivers: RideDriver[]
  units: string[]
  onSave: (patch: Partial<RideAssignment>) => void
}) {
  const stage = assignment.stage
  const next = nextStage(stage)
  const late = assignment.lateMinutes ?? 0
  const pickup = late ? plusMinutes(ride.pickupAt, late) : hhmm(ride.pickupAt)
  const flight = flightLine(ride, activity?.transfer?.hub?.kind)
  const driver = drivers.find((entry) => entry.id === assignment.driverId)
  const greyed = stage === 'no_show'
  const guest = firstName(ride.guestName)
  const vehicle = assignment.vehicle?.trim() || (ride.vehicles[0]?.name ?? 'vehicle')
  /** One driver and vehicle picker per vehicle the group takes. */
  const vehicleUnits = vehicleUnitsOf(ride).length > 0 ? vehicleUnitsOf(ride) : [vehicle]

  const textGuest = () => {
    const who = driver ? `your driver ${firstName(driver.name)}` : 'your driver'
    const message =
      stage === 'on_way'
        ? `${who} is on the way in ${assignment.vehicle?.trim() ? `the ${vehicle}` : `a ${vehicle.toLowerCase()}`}.`
        : `${who} picks you up at ${pickup} from ${ride.from}.`
    toast.success(`Texted ${guest}: ${message}`)
  }

  const runLate = (minutes: number) => {
    onSave({ lateMinutes: minutes })
    toast.success(`Texted ${guest}: running ${minutes} minutes late, pickup now ${plusMinutes(ride.pickupAt, minutes)}.`)
  }

  return (
    <li className={cn('flex flex-col gap-3 px-4 py-3.5 sm:px-5', greyed && 'opacity-55', stage === 'done' && 'bg-success-soft/20')}>
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-14 shrink-0">
          <p className="font-display text-lg font-semibold tabular-nums text-foreground">{pickup}</p>
          {late ? <p className="text-xs text-subtle line-through tabular-nums">{hhmm(ride.pickupAt)}</p> : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <Badge size="sm" variant={ride.direction === 'from_hub' ? 'info' : ride.direction === 'to_hub' ? 'accent' : 'neutral'}>
              {directionLabel(ride.direction)}
            </Badge>
            <span className="font-semibold text-foreground">{ride.guestName}</span>
            <span className="text-muted">
              {ride.passengers} {pluralize(ride.passengers, 'passenger')} · {ride.bags} {pluralize(ride.bags, 'bag')}
            </span>
          </p>
          <p className="mt-1 flex min-w-0 items-center gap-1.5 text-sm text-muted">
            <span className="truncate">{ride.from}</span>
            <ArrowRight className="size-3.5 shrink-0 text-faint" aria-label="to" />
            <span className="truncate">{ride.to}</span>
          </p>
          <p className="mt-0.5 text-xs text-subtle">
            {vehicleWords(ride)}
            {ride.extras.length > 0 ? ` · ${ride.extras.join(' · ')}` : ''}
            {ride.note ? ` · ${ride.note}` : ''}
          </p>
        </div>
        {flight ? (
          <p className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-foreground tabular-nums sm:inline-flex">
            <Plane className="size-3.5 text-faint" aria-hidden="true" />
            {flight}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:pl-[4.5rem]">
        {flight ? (
          <p className="inline-flex w-full items-center gap-1.5 text-xs font-medium text-muted tabular-nums sm:hidden">
            <Plane className="size-3.5 text-faint" aria-hidden="true" />
            {flight}
          </p>
        ) : null}
        {vehicleUnits.map((name, index) => {
          // The first vehicle's driver and unit are the ride's own; the others sit in `more`.
          const own = index === 0 ? { driverId: assignment.driverId, vehicle: assignment.vehicle } : (assignment.more?.[index - 1] ?? {})
          const set = (patch: { driverId?: string; vehicle?: string }) => {
            if (index === 0) return onSave(patch)
            const more = Array.from({ length: vehicleUnits.length - 1 }, (_, at) => assignment.more?.[at] ?? {})
            more[index - 1] = { ...more[index - 1], ...patch }
            onSave({ more })
          }
          const which = vehicleUnits.length > 1 ? ` ${index + 1}` : ''
          return (
            <div key={index} className="flex flex-wrap items-center gap-2">
              {vehicleUnits.length > 1 ? <span className="w-full text-xs font-medium text-subtle sm:w-auto">{name}</span> : null}
              <Select value={own.driverId ?? ''} onValueChange={(value) => set({ driverId: value })} disabled={greyed}>
                <SelectTrigger size="sm" className={cn('w-40', !own.driverId && stage !== 'done' && !greyed && 'border-warning/60')} aria-label={`Driver${which} for ${ride.guestName}`} icon={<UserRound />}>
                  <SelectValue placeholder="Driver" />
                </SelectTrigger>
                <SelectContent>
                  {drivers.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {units.length > 0 ? (
                <Select value={own.vehicle ?? ''} onValueChange={(value) => set({ vehicle: value })} disabled={greyed}>
                  <SelectTrigger size="sm" className="w-36" aria-label={`Vehicle${which} for ${ride.guestName}`} icon={<Car />}>
                    <SelectValue placeholder="Vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <VehicleInput value={own.vehicle ?? ''} label={`Vehicle${which} for ${ride.guestName}`} disabled={greyed} onSave={(vehicle) => set({ vehicle })} />
              )}
            </div>
          )
        })}

        <div className="ml-auto flex items-center gap-2">
          {stage === 'no_show' ? (
            <Badge variant="danger" size="sm">
              No-show
            </Badge>
          ) : stage === 'done' ? (
            <Badge variant="success" size="sm" dot>
              Done
            </Badge>
          ) : next ? (
            <Button
              size="sm"
              variant={stage === 'todo' ? 'primary' : 'secondary'}
              className="min-w-28"
              leftIcon={next === 'done' ? <CheckCircle2 /> : undefined}
              onClick={() => onSave({ stage: next })}
            >
              {NEXT_LABEL[stage]}
            </Button>
          ) : null}
          {stage !== 'todo' && stage !== 'no_show' && stage !== 'done' ? <span className="sr-only">Now: {RIDE_STAGE_LABEL[stage]}</span> : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton aria-label={`More for ${ride.guestName}`} size="sm" variant="ghost">
                <MoreHorizontal />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={textGuest} disabled={greyed}>
                <MessageSquareText aria-hidden="true" />
                Text guest
              </DropdownMenuItem>
              {ride.phone ? (
                <DropdownMenuItem asChild>
                  <a href={`tel:${ride.phone.replace(/[^\d+]/g, '')}`}>
                    <Phone aria-hidden="true" />
                    Call {guest}
                  </a>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={() => runLate(15)} disabled={greyed || stage === 'done'}>
                <AlarmClock aria-hidden="true" />
                Running 15 min late
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => runLate(30)} disabled={greyed || stage === 'done'}>
                <AlarmClock aria-hidden="true" />
                Running 30 min late
              </DropdownMenuItem>
              {ride.bookingId ? (
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/bookings/${ride.bookingId}`}>
                    <ExternalLink aria-hidden="true" />
                    Open booking
                  </Link>
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              {stage === 'no_show' ? (
                <DropdownMenuItem onSelect={() => onSave({ stage: 'todo' })}>
                  <UserX aria-hidden="true" />
                  Undo no-show
                </DropdownMenuItem>
              ) : stage === 'done' ? (
                <DropdownMenuItem onSelect={() => onSave({ stage: 'todo' })}>
                  <UserX aria-hidden="true" />
                  Back to to do
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  tone="danger"
                  onSelect={() => {
                    onSave({ stage: 'no_show' })
                    toast(`${ride.guestName} marked a no-show`)
                  }}
                >
                  <UserX aria-hidden="true" />
                  No-show
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  )
}

/** A vehicle typed in, saved when the field is left. */
function VehicleInput({ value, label, disabled, onSave }: { value: string; label: string; disabled?: boolean; onSave: (value: string) => void }) {
  const [text, setText] = React.useState(value)
  React.useEffect(() => setText(value), [value])
  return (
    <Input
      value={text}
      disabled={disabled}
      aria-label={label}
      placeholder="Vehicle"
      className="h-9 w-36"
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (text.trim() !== value) onSave(text.trim())
      }}
    />
  )
}

/* ==========================================================================
   The Pickups page's switch: Rides, and Shuttle runs when the business has
   pickup zones too.
   ========================================================================== */

export function PickupsTabs({ rides, runs }: { rides: React.ReactNode; runs?: React.ReactNode }) {
  const [tab, setTab] = React.useState<'rides' | 'runs'>('rides')
  if (!runs) return <>{rides}</>
  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Pickups"
        value={tab}
        onValueChange={setTab}
        className="self-start print:hidden"
        options={[
          { value: 'rides', label: 'Rides' },
          { value: 'runs', label: 'Shuttle runs' },
        ]}
      />
      {tab === 'rides' ? rides : runs}
    </div>
  )
}
