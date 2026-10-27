'use client'

import * as React from 'react'
import { Banknote, CircleAlert, CreditCard, Minus, Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { buildQuote, type AvailabilityDay, type Quote } from '@/components/storefront/booking-widget'
import { useTransferHolds } from '@/hooks/use-transfer-holds'
import { usePricing } from '@/hooks/use-pricing'
import { recordBooking, type LedgerEntry } from '@/lib/booking-ledger'
import { addOnUnits, peopleOf, placesOf } from '@/lib/places'
import type { PricingRule } from '@/lib/pricing'
import {
  airlineOf,
  biggestVehicle,
  bookingDetailsOf,
  legsFor,
  planFits,
  planVehicles,
  pricingOf,
  requestErrors,
  searchZones,
  timeFieldLabels,
  transferOf,
  transferSlotId,
  tripLabel,
  tripsOffered,
  vehiclesLeftAt,
  vehiclesSentence,
  zoneById,
  type PlannedLeg,
  type TransferHold,
  type TransferRequest,
  type VehiclePlan,
} from '@/lib/transfers'
import { EMPTY_GUEST, type WalkInRecord } from '@/lib/walk-ins'
import { cn, formatCurrency, pluralize } from '@/lib/utils'
import type { Activity, CurrencyCode, TransferBookingDetails, TransferFlight, TransferTrip } from '@/types'

/* ==========================================================================
   TRANSFER TILL — the airport desk: a ride sold now or later today, cash or
   card. Trip, where they are going, how many and their suitcases; the
   vehicle is picked for them from what is free. Paying records the walk-in
   and a booking with the ride on it, so it is on Pickups → Rides and holds
   its vehicle. The notice period is for online guests, not the desk.
   ========================================================================== */

const pad = (n: number) => String(n).padStart(2, '0')
const PHONE = /^[+()\-\s\d]{7,}$/

const plusMinutes = (iso: string, minutes: number) => {
  const [date, time] = iso.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const out = new Date(y, m - 1, d, hh, mm + minutes, 0, 0)
  return `${out.getFullYear()}-${pad(out.getMonth() + 1)}-${pad(out.getDate())}T${pad(out.getHours())}:${pad(out.getMinutes())}:00`
}

/** Half-hour times from the next half hour (from `nowIso`) to 23:30. The first is "now". */
export function deskTimes(nowIso: string): string[] {
  const [h, m] = nowIso.slice(11, 16).split(':').map(Number)
  const start = Math.ceil((h * 60 + m) / 30) * 30
  const out: string[] = []
  for (let minutes = start; minutes <= 23 * 60 + 30; minutes += 30) out.push(`${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`)
  return out
}

const ALL_TIMES = Array.from({ length: 48 }, (_, index) => `${pad(Math.floor(index / 2))}:${index % 2 ? '30' : '00'}`)

/**
 * The rides a request makes and the vehicles free for all of them: each leg
 * from its pickup for its busy time, the tighter leg deciding. The plan is
 * the cheapest set of free vehicles; `busy` when vehicles would fit but are
 * all out, `tooBig` when the group needs more than one booking takes.
 */
export function deskPlan(
  activity: Activity,
  request: TransferRequest,
  holds: TransferHold[],
): { legs: PlannedLeg[]; left: Record<string, number>; best: VehiclePlan | null; tooBig: boolean; busy: boolean } {
  const legs = legsFor(activity, request)
  const config = transferOf(activity)
  // Nothing to plan until it is priced: a destination (and a drop-off for hotel to hotel), or the hours.
  const unpriced = request.trip !== 'hourly' && (!request.zoneId || (request.trip === 'between' && !request.toZoneId))
  if (!config || config.service === 'shared' || legs.length === 0 || unpriced) return { legs, left: {}, best: null, tooBig: false, busy: false }
  const left: Record<string, number> = {}
  for (const leg of legs) {
    const free = vehiclesLeftAt(activity, holds, leg.pickupAt, leg.busyMinutes)
    for (const [tierId, count] of Object.entries(free)) left[tierId] = Math.min(left[tierId] ?? Number.POSITIVE_INFINITY, count)
  }
  const need = { passengers: request.passengers, bags: request.bags }
  const plan = planVehicles(activity, need, pricingOf(request), left)
  return { legs, left, best: plan.best, tooBig: plan.tooBig, busy: !plan.best && !plan.tooBig }
}

/**
 * Everything a desk sale of a ride records: the quote (the same engine and
 * table as the storefront; transfers carry no booking fee), the ride as the
 * booking keeps it, the ledger entry that puts it on the board and holds its
 * vehicles, and whether it can be sold (the request is sound, the vehicles
 * carry the group and are free on every leg; a shared run has the seats).
 */
export function walkInTransferSale(args: {
  activity: Activity
  tenantSlug: string
  request: TransferRequest
  lines: { tierId: string; qty: number }[]
  addOns: { addOnId: string; qty: number }[]
  holds: TransferHold[]
  nowIso: string
  reference: string
  guest: { name: string; phone: string; email?: string }
  /** The first hub leg's flight. */
  flight?: { number: string; airline?: string }
  /** One per leg, in leg order; overrides `flight`. */
  flights?: ({ number: string; airline?: string } | undefined)[]
  note?: string
  businessRules?: PricingRule[]
  /** Shared runs: seats left on the run sold. */
  seatsLeft?: number
  /** Shared runs: the run's own time slot id (from the strip), so online sales count the seats sold here. */
  runId?: string
}): { quote: Quote; details: TransferBookingDetails; entry: LedgerEntry; legs: PlannedLeg[]; errors: Record<string, string>; fits: boolean } {
  const { activity, request, nowIso } = args
  const config = transferOf(activity)
  const shared = config?.service === 'shared'
  const legs = legsFor(activity, request)
  // Staff sell inside the notice period: only the hours driven, the past and missing details stop a sale.
  const errors = requestErrors({ ...activity, noticeHours: 0 }, request, nowIso)
  const lines = args.lines.filter((line) => line.qty > 0)
  const quote = buildQuote(activity, args.tenantSlug, { tiers: lines, addOns: args.addOns }, 1, {
    party: request.passengers,
    transfer: pricingOf(request),
    startsAt: legs[0]?.pickupAt,
    nowIso,
    businessRules: args.businessRules,
  })
  const flights: (TransferFlight | undefined)[] = legs.map((leg, index) => {
    const typed = args.flights ? args.flights[index] : index === 0 ? args.flight : undefined
    if (!typed || !typed.number.trim() || !leg.flightAt) return undefined
    return { number: typed.number, ...(typed.airline?.trim() ? { airline: typed.airline.trim() } : {}), at: leg.flightAt }
  })
  const details = bookingDetailsOf(activity, request, {
    vehicles: lines,
    departureIds: legs.map((leg, index) => (index === 0 && shared && args.runId ? args.runId : transferSlotId(activity, leg.slotStartsAt))),
    flights,
    place: request.place ?? '',
    dropOff: request.dropOff,
    note: args.note,
  })
  const tierOf = (tierId: string) => activity.priceTiers.find((tier) => tier.id === tierId)
  const seats = lines.reduce((sum, line) => sum + line.qty * placesOf(tierOf(line.tierId) ?? { countsTowardCapacity: true }), 0)
  const vehicles = lines.reduce((sum, line) => sum + line.qty, 0)
  let fits = lines.length > 0 && legs.length > 0 && Object.keys(errors).length === 0 && quote.ticketLines.length > 0
  if (fits && shared) fits = seats >= 1 && (args.seatsLeft === undefined || seats <= args.seatsLeft)
  if (fits && !shared) {
    fits =
      planFits(activity, lines, { passengers: request.passengers, bags: request.bags }) &&
      legs.every((leg) => {
        const left = vehiclesLeftAt(activity, args.holds, leg.pickupAt, leg.busyMinutes)
        return lines.every((line) => (left[line.tierId] ?? 0) >= line.qty)
      })
  }
  const first = legs[0]
  const entry: LedgerEntry = {
    id: args.reference,
    reference: args.reference,
    activitySlug: activity.slug,
    activityName: activity.name,
    departureId: details.legs[0]?.departureId ?? '',
    startsAt: first?.pickupAt ?? request.at,
    endsAt: first ? plusMinutes(first.pickupAt, first.busyMinutes) : request.at,
    // A ride counts vehicles (a shared run its seats); the passengers are on the ride.
    party: Math.max(1, shared ? seats : vehicles),
    source: 'dashboard',
    transfer: details,
    name: args.guest.name.trim(),
    email: args.guest.email?.trim() ?? '',
    phone: args.guest.phone.trim(),
    total: quote.total,
    paidNow: quote.total,
    currency: activity.currency,
    createdAt: nowIso.slice(0, 19),
  }
  return { quote, details, entry, legs, errors, fits }
}

/* ==========================================================================
   <TransferTill>
   ========================================================================== */

export function TransferTill({
  activity,
  tenantSlug,
  currency,
  nowIso,
  holds: serverHolds,
  days,
  staff,
  onSold,
}: {
  /** With its saved edit (prices, schedule, the price table). */
  activity: Activity
  tenantSlug: string
  currency: CurrencyCode
  nowIso: string
  /** Seeded rides' vehicle holds around today. */
  holds: TransferHold[]
  /** Today and tomorrow, for a shared shuttle's seats per run. */
  days: AvailabilityDay[]
  staff: string[]
  onSold: (record: WalkInRecord) => void
}) {
  const config = transferOf(activity)
  const pricing = usePricing(tenantSlug)
  const holds = useTransferHolds(activity, tenantSlug, serverHolds)
  const service = config?.service ?? 'private'
  const shared = service === 'shared'
  const hourly = service === 'hourly'
  const trips = config ? tripsOffered(config) : []
  const todayKey = nowIso.slice(0, 10)
  const times = React.useMemo(() => deskTimes(nowIso), [nowIso])
  const labels = timeFieldLabels(config?.hub)

  const [trip, setTrip] = React.useState<TransferTrip>(trips[0] ?? 'from_hub')
  const [zoneId, setZoneId] = React.useState('')
  const [toZoneId, setToZoneId] = React.useState('')
  const [place, setPlace] = React.useState('')
  const [dropOff, setDropOff] = React.useState('')
  const [passengers, setPassengers] = React.useState(2)
  const [bags, setBags] = React.useState(2)
  const [tickets, setTickets] = React.useState<Record<string, number>>(() => Object.fromEntries(activity.priceTiers.map((tier, index) => [tier.id, index === 0 ? 1 : 0])))
  const [time, setTime] = React.useState(times[0] ?? '23:30')
  const [returnDate, setReturnDate] = React.useState('')
  const [returnTime, setReturnTime] = React.useState('12:00')
  const [hours, setHours] = React.useState(Math.max(1, config?.minHours ?? 1))
  const [extras, setExtras] = React.useState<Record<string, number>>({})
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [flightNumber, setFlightNumber] = React.useState('')
  const [airline, setAirline] = React.useState('')
  const [returnFlight, setReturnFlight] = React.useState('')
  const [note, setNote] = React.useState('')
  const [seller, setSeller] = React.useState(staff[0] ?? 'Desk')
  const [method, setMethod] = React.useState<'card' | 'cash'>('card')
  const [tendered, setTendered] = React.useState('')
  const [processing, setProcessing] = React.useState(false)
  const [touched, setTouched] = React.useState(false)

  // Shared runs: the run times today that go this way, from now on.
  const runs = React.useMemo(() => {
    if (!shared) return []
    const way = trip === 'to_hub' ? config?.shared?.toHubTimes : config?.shared?.fromHubTimes
    const today = days.find((day) => day.dateKey === todayKey)?.slots ?? []
    const known = [...new Set([...(way ?? []), ...today.map((slot) => slot.startsAt.slice(11, 16))])].sort()
    return known
      .filter((run) => (!way || way.includes(run)) && run >= nowIso.slice(11, 16))
      .map((run) => {
        const slot = today.find((entry) => entry.startsAt.slice(11, 16) === run)
        return { time: run, seatsLeft: slot ? (slot.soldOut ? 0 : slot.seatsLeft) : activity.maxCapacity, departureId: slot?.departureId }
      })
  }, [shared, trip, config, days, todayKey, nowIso, activity.maxCapacity])
  React.useEffect(() => {
    if (shared && runs.length > 0 && !runs.some((run) => run.time === time)) setTime(runs[0].time)
  }, [shared, runs, time])

  const headcount = activity.priceTiers.reduce((sum, tier) => sum + (tickets[tier.id] ?? 0) * peopleOf(tier), 0)
  const people = shared ? headcount : passengers
  const request: TransferRequest = {
    trip,
    ...(trip !== 'hourly' && zoneId ? { zoneId } : {}),
    ...(trip === 'between' && toZoneId ? { toZoneId } : {}),
    passengers: people,
    bags,
    at: `${todayKey}T${time}:00`,
    ...(trip === 'round_trip' && returnDate ? { returnAt: `${returnDate}T${returnTime}:00` } : {}),
    ...(trip === 'hourly' ? { hours } : {}),
    ...(place.trim() ? { place: place.trim() } : {}),
    ...(dropOff.trim() ? { dropOff: dropOff.trim() } : {}),
  }
  const plan = deskPlan(activity, request, holds)
  const lines = shared ? activity.priceTiers.map((tier) => ({ tierId: tier.id, qty: tickets[tier.id] ?? 0 })) : (plan.best?.lines ?? [])
  const addOns = activity.addOns.map((addOn) => ({
    addOnId: addOn.id,
    qty: addOn.per === 'each' ? addOnUnits(addOn, people, extras[addOn.id] ?? 0) : (extras[addOn.id] ?? 0) > 0 || addOn.required ? addOnUnits(addOn, people) : 0,
  }))
  const flights = [
    flightNumber.trim() ? { number: flightNumber, airline: airline || airlineOf(flightNumber) } : undefined,
    trip === 'round_trip' && returnFlight.trim() ? { number: returnFlight, airline: airlineOf(returnFlight) } : undefined,
  ]
  const run = shared ? runs.find((entry) => entry.time === time) : undefined
  const seatsLeft = run?.seatsLeft
  const sale = walkInTransferSale({
    activity,
    tenantSlug,
    request,
    lines,
    addOns,
    holds,
    nowIso,
    reference: 'preview',
    guest: { name, phone },
    flights,
    note,
    businessRules: pricing.rules,
    seatsLeft,
    ...(run?.departureId ? { runId: run.departureId } : {}),
  })
  const total = sale.quote.total
  const change = method === 'cash' && tendered ? Math.round(Number(tendered) * 100) - total : 0
  const nameMissing = name.trim().length < 2
  const phoneBad = !PHONE.test(phone.trim())
  const placeMissing = hourly && !place.trim()
  const askFlight = Boolean(config?.askFlight) && (trip === 'from_hub' || trip === 'to_hub' || trip === 'round_trip')
  const canPay = sale.fits && !nameMissing && !phoneBad && !placeMissing && (method === 'card' || change >= 0)

  const most = Math.max(1, (config?.maxVehicles ?? 4) * Math.max(1, biggestVehicle(activity)))
  const zone = zoneById(config, zoneId)

  const complete = () => {
    setTouched(true)
    if (!canPay) return
    setProcessing(true)
    window.setTimeout(
      () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        const reference = `EZR-${Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`
        const final = walkInTransferSale({ activity, tenantSlug, request, lines, addOns, holds, nowIso, reference, guest: { name, phone }, flights, note, businessRules: pricing.rules, seatsLeft, ...(run?.departureId ? { runId: run.departureId } : {}) })
        const soldAt = `${nowIso.slice(0, 16)}:${pad(new Date().getSeconds())}`
        recordBooking(tenantSlug, [{ ...final.entry, createdAt: soldAt }])
        const record: WalkInRecord = {
          reference,
          activitySlug: activity.slug,
          activityName: activity.name,
          kind: 'transfer',
          startsAt: final.entry.startsAt,
          soldAt,
          guests: people,
          lines: [...final.quote.ticketLines, ...final.quote.addOnLines].map((line) => ({ label: `${line.quantity} × ${line.label}`, total: line.total })),
          subtotal: final.quote.subtotal,
          discount: 0,
          total: final.quote.total,
          method,
          guest: { ...EMPTY_GUEST, name: name.trim(), phone: phone.trim() },
          status: 'paid',
          staff: seller,
          transfer: final.details,
        }
        onSold(record)
        setProcessing(false)
        toast.success(`Sold · ${formatCurrency(record.total, currency)}`, {
          description: `${record.guest.name}, pickup ${final.entry.startsAt.slice(11, 16)}${method === 'cash' && change > 0 ? ` · change ${formatCurrency(change, currency)}` : ''}`,
        })
      },
      method === 'card' ? 1500 : 400,
    )
  }

  const stepper = (value: number, min: number, max: number, onChange: (next: number) => void, label: string) => (
    <span className="flex items-center gap-2">
      <IconButton aria-label={`Fewer ${label}`} size="sm" variant="outline" disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus aria-hidden="true" />
      </IconButton>
      <span className="w-6 text-center text-base font-semibold tabular-nums" aria-live="polite">{value}</span>
      <IconButton aria-label={`More ${label}`} size="sm" variant="outline" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus aria-hidden="true" />
      </IconButton>
    </span>
  )
  const error = (key: string) => (touched || key !== 'zone') && sale.errors[key] ? <p className="mt-1.5 text-xs font-medium text-danger">{sale.errors[key]}</p> : null

  const timeLabel = trip === 'from_hub' || trip === 'round_trip' ? labels.arrives : trip === 'to_hub' ? labels.leaves : trip === 'hourly' ? 'Start at' : 'Pickup at'
  const firstLeg = sale.legs[0]

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
          {/* trip */}
          {trips.length > 1 ? (
            <div>
              <p className="text-sm font-semibold">Trip</p>
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-surface-sunken p-1 sm:grid-cols-4" role="radiogroup" aria-label="Trip">
                {trips.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    role="radio"
                    aria-checked={trip === entry}
                    onClick={() => setTrip(entry)}
                    className={cn('rounded-lg px-3 py-2 text-sm font-semibold transition-colors', trip === entry ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground')}
                  >
                    {tripLabel(entry, config?.hub)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* where */}
          {hourly ? (
            <Field label="Pick up from" required error={touched && placeMissing ? 'Add where the driver collects them' : undefined}>
              {(control) => <Input {...control} value={place} placeholder="Hotel or address" onChange={(e) => setPlace(e.target.value)} />}
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <ZonePicker
                label={trip === 'between' ? 'Pick up from' : 'Where to'}
                config={config}
                zoneId={zoneId}
                onPick={(id, hotel) => {
                  setZoneId(id)
                  if (hotel) setPlace(hotel)
                }}
              />
              {trip === 'between' ? (
                <ZonePicker
                  label="Drop off at"
                  config={config}
                  zoneId={toZoneId}
                  onPick={(id, hotel) => {
                    setToZoneId(id)
                    if (hotel) setDropOff(hotel)
                  }}
                />
              ) : null}
              <div className="sm:col-span-2">{error('zone')}</div>
            </div>
          )}

          {/* who */}
          <div>
            <p className="text-sm font-semibold">Who&rsquo;s travelling</p>
            <ul className="mt-2 flex list-none flex-col divide-y divide-line-subtle rounded-xl border border-line p-0">
              {shared ? (
                activity.priceTiers.map((tier) => (
                  <li key={tier.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <span className="text-sm font-medium">{tier.label}</span>
                    {stepper(tickets[tier.id] ?? 0, 0, tier.maxQuantity, (next) => setTickets((current) => ({ ...current, [tier.id]: next })), tier.label)}
                  </li>
                ))
              ) : (
                <li className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="text-sm font-medium">Passengers</span>
                  {stepper(passengers, 1, most, setPassengers, 'passengers')}
                </li>
              )}
              <li className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <span className="text-sm font-medium">Suitcases</span>
                {stepper(bags, 0, 60, setBags, 'suitcases')}
              </li>
            </ul>
            {error('passengers')}
            {!shared && plan.best ? (
              <p className="mt-2 rounded-xl bg-surface-sunken px-3.5 py-2.5 text-sm">
                <span className="font-semibold text-foreground">{vehiclesSentence(activity, plan.best.lines)}</span>
                <span className="text-subtle"> · fits {plan.best.seats} and {plan.best.bagRoom} {pluralize(plan.best.bagRoom, 'suitcase')}</span>
              </p>
            ) : !shared && plan.tooBig ? (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                That&rsquo;s more than we take in one booking.
              </p>
            ) : !shared && plan.busy && (zoneId || hourly) ? (
              <p className="mt-2 flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm">
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                All our vehicles are out then. Try a later time.
              </p>
            ) : null}
          </div>

          {/* when */}
          <div className="grid gap-4 sm:grid-cols-2">
            {shared ? (
              <div className="sm:col-span-2">
                <p className="text-sm font-semibold">{trip === 'to_hub' ? `Run to the ${config?.hub?.code ?? 'airport'}` : 'Run'}</p>
                {runs.length === 0 ? (
                  <p className="mt-2 text-sm text-muted">No more runs today.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {runs.map((run) => (
                      <button
                        key={run.time}
                        type="button"
                        aria-pressed={time === run.time}
                        disabled={run.seatsLeft <= 0}
                        onClick={() => setTime(run.time)}
                        className={cn(
                          'rounded-xl border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50',
                          time === run.time ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong',
                        )}
                      >
                        <span className="block text-sm font-semibold tabular-nums">{run.time}</span>
                        <span className="block text-xs text-subtle">{run.seatsLeft > 0 ? `${run.seatsLeft} left` : 'Full'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Field label={timeLabel}>
                {(control) => (
                  <Select value={time} onValueChange={setTime}>
                    <SelectTrigger id={control.id} aria-invalid={control['aria-invalid']}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {times.map((entry, index) => (
                        <SelectItem key={entry} value={entry}>
                          {index === 0 ? `Now · ${entry}` : entry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}
            {hourly ? (
              <div>
                <p className="text-sm font-medium">How many hours</p>
                <div className="mt-2">{stepper(hours, Math.max(1, config?.minHours ?? 1), Math.max(1, config?.maxHours ?? 10), setHours, 'hours')}</div>
              </div>
            ) : null}
            {trip === 'round_trip' ? (
              <>
                <Field label="Leaving on" error={touched ? sale.errors.returnAt : undefined}>
                  <Input type="date" min={todayKey} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </Field>
                <Field label={labels.leaves}>
                  {(control) => (
                    <Select value={returnTime} onValueChange={setReturnTime}>
                      <SelectTrigger id={control.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_TIMES.map((entry) => (
                          <SelectItem key={entry} value={entry}>
                            {entry}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </>
            ) : null}
            <div className="sm:col-span-2">
              {error('at')}
              {error('hours')}
              {firstLeg && !sale.errors.at ? (
                <p className="text-xs text-subtle">
                  Pickup {firstLeg.pickupAt.slice(11, 16)}
                  {sale.legs[1] ? ` · return pickup ${sale.legs[1].pickupAt.slice(5, 10).replace('-', '/')} ${sale.legs[1].pickupAt.slice(11, 16)}` : ''}
                </p>
              ) : null}
            </div>
          </div>

          {/* extras */}
          {activity.addOns.length > 0 ? (
            <div>
              <p className="text-sm font-semibold">Extras</p>
              <div className="mt-2 flex flex-col gap-2">
                {activity.addOns.map((addOn) =>
                  addOn.per === 'each' ? (
                    <div key={addOn.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm">
                      <span>
                        {addOn.label} <span className="text-subtle tabular-nums">· {formatCurrency(addOn.price, currency)} each</span>
                      </span>
                      {stepper(extras[addOn.id] ?? 0, 0, addOn.maxQty ?? 9, (next) => setExtras((current) => ({ ...current, [addOn.id]: next })), addOn.label)}
                    </div>
                  ) : (
                    <label key={addOn.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm">
                      <span className="flex items-center gap-3">
                        <Checkbox checked={(extras[addOn.id] ?? 0) > 0 || addOn.required} disabled={addOn.required} onCheckedChange={(checked) => setExtras((current) => ({ ...current, [addOn.id]: checked === true ? 1 : 0 }))} />
                        {addOn.label}
                      </span>
                      <span className="text-subtle tabular-nums">
                        {formatCurrency(addOn.price, currency)} {addOn.per === 'booking' ? 'per booking' : 'per person'}
                      </span>
                    </label>
                  ),
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* guest */}
        <div className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2">
          <Field label="Name" required error={touched && nameMissing ? 'Add the guest name' : undefined}>
            {(control) => <Input {...control} value={name} placeholder="Lead guest" autoComplete="off" onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Mobile" required error={touched && phoneBad ? 'Add a number the driver can reach' : undefined}>
            {(control) => <Input {...control} type="tel" value={phone} placeholder="+1 555 0134" autoComplete="off" onChange={(e) => setPhone(e.target.value)} />}
          </Field>
          {!hourly ? (
            <Field label={trip === 'between' ? 'Pick up address' : 'Hotel'} description={zone && !place ? zone.name : undefined}>
              {(control) => <Input {...control} value={place} placeholder="Hotel name or address" autoComplete="off" onChange={(e) => setPlace(e.target.value)} />}
            </Field>
          ) : null}
          {trip === 'between' ? (
            <Field label="Drop off address">
              {(control) => <Input {...control} value={dropOff} placeholder="Hotel name or address" autoComplete="off" onChange={(e) => setDropOff(e.target.value)} />}
            </Field>
          ) : null}
          {askFlight ? (
            <>
              <Field label="Flight number" optional>
                {(control) => (
                  <Input
                    {...control}
                    value={flightNumber}
                    placeholder="AA 1234"
                    autoComplete="off"
                    className="uppercase"
                    onChange={(e) => {
                      setFlightNumber(e.target.value)
                      setAirline(airlineOf(e.target.value) ?? '')
                    }}
                  />
                )}
              </Field>
              <Field label="Airline" optional>
                {(control) => <Input {...control} value={airline} autoComplete="off" onChange={(e) => setAirline(e.target.value)} />}
              </Field>
              {trip === 'round_trip' ? (
                <Field label="Return flight" optional>
                  {(control) => <Input {...control} value={returnFlight} placeholder="AA 1235" autoComplete="off" className="uppercase" onChange={(e) => setReturnFlight(e.target.value)} />}
                </Field>
              ) : null}
            </>
          ) : null}
          <Field label="Note for the driver" optional className="sm:col-span-2">
            {(control) => <Input {...control} value={note} placeholder="A stroller, a surfboard…" autoComplete="off" onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
      </div>

      {/* total and payment */}
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm font-semibold">Total</p>
          <ul className="mt-2 flex list-none flex-col gap-1 p-0 text-sm">
            {[...sale.quote.ticketLines, ...sale.quote.addOnLines].map((line) => (
              <li key={line.id} className="flex justify-between gap-2">
                <span className="truncate text-muted">
                  {line.quantity} × {line.label}
                </span>
                <span className="tabular-nums">{formatCurrency(line.total, currency)}</span>
              </li>
            ))}
            {sale.quote.ticketLines.length === 0 ? <li className="text-xs text-subtle">Pick where they are going.</li> : null}
          </ul>
          <p className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-sm text-muted">To pay</span>
            <span className="font-display text-3xl font-semibold tabular-nums">{formatCurrency(total, currency)}</span>
          </p>
          <p className="mt-1 text-xs text-subtle">All fees included.</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment">
            {([['card', 'Card', CreditCard], ['cash', 'Cash', Banknote]] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" role="radio" aria-checked={method === value} onClick={() => setMethod(value)} className={cn('flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold', method === value ? 'border-primary bg-primary-soft text-primary' : 'border-line')}>
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          {method === 'cash' ? (
            <div className="mt-3 flex flex-col gap-2">
              <Input type="number" min={0} value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder="Cash handed over" aria-label="Cash handed over" />
              {tendered ? (
                <p className={cn('text-sm font-semibold tabular-nums', change < 0 ? 'text-danger' : 'text-success')}>
                  {change < 0 ? `${formatCurrency(-change, currency)} short` : `Change ${formatCurrency(change, currency)}`}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-subtle">{processing ? 'Waiting for the card on the reader…' : 'Tap, insert or swipe on the reader when you charge.'}</p>
          )}
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-subtle">Sold by</span>
            <Select value={seller} onValueChange={setSeller}>
              <SelectTrigger size="sm" className="w-36" aria-label="Sold by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(staff.length > 0 ? staff : ['Desk']).map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="lg" fullWidth className="mt-4" loading={processing} disabled={processing} onClick={complete}>
            {method === 'card' ? `Charge ${formatCurrency(total, currency)}` : `Take ${formatCurrency(total, currency)} cash`}
          </Button>
          {touched && !canPay ? (
            <p className="mt-2 text-xs font-medium text-danger">
              {Object.values(sale.errors)[0] ??
                (nameMissing
                  ? 'Add the guest name first.'
                  : phoneBad
                    ? 'Add a mobile number.'
                    : placeMissing
                      ? 'Add where the driver collects them.'
                    : !shared && plan.tooBig
                      ? 'Too many for one booking.'
                      : !shared && !plan.best
                        ? 'No vehicle free then.'
                        : shared && seatsLeft !== undefined && headcount > seatsLeft
                          ? 'Not enough seats on this run.'
                          : method === 'cash' && change < 0
                            ? 'Not enough cash handed over.'
                            : 'Add at least one passenger.')}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** A destination search: type a hotel or area, pick a row; the zone and, for a hotel, the place are filled in. */
function ZonePicker({
  label,
  config,
  zoneId,
  onPick,
}: {
  label: string
  config: ReturnType<typeof transferOf>
  zoneId: string
  onPick: (zoneId: string, place?: string) => void
}) {
  const id = React.useId()
  const [query, setQuery] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const picked = zoneById(config, zoneId)
  const matches = config ? searchZones(config, query, 8) : []
  const total = config ? searchZones(config, '', Number.MAX_SAFE_INTEGER).length : 0
  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="text-sm font-medium">
        {label}
      </label>
      <Input
        id={`${id}-input`}
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        className="mt-1.5"
        leftIcon={<Search />}
        value={open ? query : (picked?.name ?? query)}
        placeholder="Hotel name or area"
        autoComplete="off"
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
      />
      {open ? (
        <ul id={`${id}-list`} role="listbox" aria-label={label} className="absolute inset-x-0 top-full z-20 mt-1 flex max-h-72 list-none flex-col overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted">{total === 0 ? 'No destinations set up.' : 'Nothing found. Pick the nearest area.'}</li>
          ) : (
            matches.map((match) => (
              <li key={`${match.zone.id}|${match.place ?? ''}`} role="option" aria-selected={match.zone.id === zoneId && !match.place}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onPick(match.zone.id, match.place)
                    setQuery('')
                    setOpen(false)
                  }}
                  className="w-full rounded-lg px-3 py-2 text-left hover:bg-surface-sunken"
                >
                  <span className="block text-sm font-semibold text-foreground">{match.zone.name}</span>
                  {match.place ? <span className="block truncate text-xs text-subtle">{match.place}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
