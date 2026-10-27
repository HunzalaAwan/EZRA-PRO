'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { CircleAlert, Clock, MapPin, Minus, Plus, ShieldCheck, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { RequestForm, type RequestContext } from '@/components/storefront/booking-request'
import { TrustSeal } from '@/components/storefront/trust-bar'
import { buildQuote, checkoutHref, type AvailabilitySlot, type BookingWidgetProps } from '@/components/storefront/booking-widget'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { useActivityOverrides } from '@/hooks/use-pricing-override'
import { usePricing } from '@/hooks/use-pricing'
import { useTransferHolds } from '@/hooks/use-transfer-holds'
import { applyScheduleOverride } from '@/lib/activity-overrides'
import { expandDays, scheduleContextOf } from '@/lib/activity-schedule'
import { hoursLabel } from '@/lib/booking-policy'
import { NOW } from '@/lib/data/constants'
import { addOnPer, addOnUnits, peopleOf, placesOf } from '@/lib/places'
import { fromPrice } from '@/lib/price-engine'
import {
  bookingDetailsOf,
  encodeTransferQuery,
  legsFor,
  planFits,
  planVehicles,
  pricingOf,
  requestErrors,
  searchZones,
  timeFieldLabels,
  transferOf,
  transferRateFor,
  transferSlotId,
  transferUnit,
  tripLabel,
  tripsOffered,
  vehiclesLeftAt,
  vehiclesOf,
  vehiclesSentence,
  zoneById,
  type PlannedLeg,
  type TransferHold,
  type TransferRequest,
  type VehiclePlan,
} from '@/lib/transfers'
import type { TransferAvailability } from '@/lib/storefront-availability'
import { cn, formatCurrency, fromDateKey } from '@/lib/utils'
import type { Activity, BookingSettings, TransferConfig, TransferTrip, TransferZone } from '@/types'

/* ==========================================================================
   Transfer widget — rides from one place to another. Guests say which way
   (to the hotel, to the airport, both, hotel to hotel, or by the hour),
   where they stay, how many they are with how many suitcases, and when
   their flight lands or takes off. The vehicles come from the cheapest set
   that fits and is free then; the price comes from the owner's table.
   Guests never pick a time slot: the ride sits in the slot its pickup falls
   in. A shared shuttle sells seats on set runs instead.
   ========================================================================== */

const pad2 = (n: number) => String(n).padStart(2, '0')
/** The demo clock as a local ISO, like every startsAt. */
const LOCAL_NOW = `${NOW.getFullYear()}-${pad2(NOW.getMonth() + 1)}-${pad2(NOW.getDate())}T${pad2(NOW.getHours())}:${pad2(NOW.getMinutes())}:00`
const DAYS_SHOWN = 60
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const keyPlus = (dateKey: string, days: number) => {
  const date = fromDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
const hhmmOf = (minutes: number) => {
  const day = ((minutes % 1440) + 1440) % 1440
  return `${pad2(Math.floor(day / 60))}:${pad2(day % 60)}`
}
/** "2026-10-31T14:35:00" → "14:35". */
const clockOf = (iso: string | undefined) => (iso ? iso.slice(11, 16) : '')
const isoAt = (dateKey: string, hhmm: string) => `${dateKey}T${hhmm}:00`
const isHhmm = (value: string | undefined): value is string => Boolean(value && /^\d{2}:\d{2}$/.test(value))

/**
 * What a request needs on the road: its legs, the vehicles of each size free
 * for every leg (the tighter leg decides), and the cheapest set that fits.
 */
export function transferPlanFor(
  activity: Activity,
  request: TransferRequest,
  holds: TransferHold[],
): { legs: PlannedLeg[]; left: Record<string, number>; plan: ReturnType<typeof planVehicles> } {
  const legs = legsFor(activity, request)
  const left: Record<string, number> = {}
  for (const vehicle of vehiclesOf(activity)) {
    left[vehicle.tierId] = legs.reduce((least, leg) => Math.min(least, vehiclesLeftAt(activity, holds, leg.pickupAt, leg.busyMinutes)[vehicle.tierId] ?? 0), vehicle.rentable)
  }
  const plan = planVehicles(activity, { passengers: request.passengers, bags: request.bags }, pricingOf(request), left)
  return { legs, left, plan }
}

/** The line under the "From" price: what the price is for. */
export function transferPriceNote(activity: Pick<Activity, 'kind' | 'transfer'>): string {
  switch (transferOf(activity)?.service) {
    case 'shared':
      return 'Per person, shared shuttle.'
    case 'hourly':
      return 'Per vehicle, per hour.'
    default:
      return 'Prices per vehicle, not per person.'
  }
}

export type TransferWidgetProps = BookingWidgetProps & {
  settings: BookingSettings
  availability?: TransferAvailability
  /** A ride to start from: a link from the storefront, or a test. */
  initialRequest?: Partial<TransferRequest>
}

const NO_HOLDS: TransferHold[] = []

export function TransferWidget({
  activity,
  tenantSlug,
  currency,
  days,
  checkoutPath,
  nowIso: givenNow,
  variant = 'rail',
  className,
  businessPhone,
  settings,
  availability,
  initialRequest,
}: TransferWidgetProps) {
  const router = useRouter()
  const reducedMotion = useReducedMotionSafe()
  const nowIso = (givenNow ?? LOCAL_NOW).slice(0, 19)
  const todayKey = nowIso.slice(0, 10)

  // The schedule the owner saved (hours driven, closed days) and the business's closed days.
  const overrides = useActivityOverrides()
  const scheduled = React.useMemo(() => applyScheduleOverride(activity, overrides[activity.id]), [activity, overrides])
  const { defaults } = useBookingDefaults(tenantSlug)
  const config = transferOf(activity) as TransferConfig | undefined
  const service = config?.service ?? 'private'
  const shared = service === 'shared'
  const hourly = service === 'hourly'
  const hub = config?.hub
  const labels = timeFieldLabels(hub)
  const trips = React.useMemo(() => (config ? tripsOffered(config) : []), [config])

  /* ---------- the request, as the guest builds it ---------- */

  const firstTrip = (initialRequest?.trip && trips.includes(initialRequest.trip) ? initialRequest.trip : trips[0]) ?? 'from_hub'
  const [trip, setTrip] = React.useState<TransferTrip>(firstTrip)
  const [zoneId, setZoneId] = React.useState(initialRequest?.zoneId ?? '')
  const [toZoneId, setToZoneId] = React.useState(initialRequest?.toZoneId ?? '')
  const [place, setPlace] = React.useState(initialRequest?.place ?? '')
  const [dropOff, setDropOff] = React.useState(initialRequest?.dropOff ?? '')
  const [passengersRaw, setPassengers] = React.useState(Math.max(1, initialRequest?.passengers ?? 2))
  const [bagsRaw, setBags] = React.useState<number | null>(initialRequest?.bags ?? null)
  const [hours, setHours] = React.useState(Math.max(config?.minHours ?? 1, initialRequest?.hours ?? config?.minHours ?? 1))
  // Shared: tickets per tier, the lead one at two.
  const [tickets, setTickets] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(activity.priceTiers.map((tier, index) => [tier.id, index === 0 ? Math.max(tier.minQuantity, initialRequest?.passengers ?? 2) : tier.minQuantity])),
  )
  const atKey = initialRequest?.at?.slice(0, 10)
  const atTime = clockOf(initialRequest?.at)
  const backKey = initialRequest?.returnAt?.slice(0, 10)
  const backTime = clockOf(initialRequest?.returnAt)

  /* ---------- open days: the next 60 within the hours driven and the booking window ---------- */

  const dayKeys = React.useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, index) => keyPlus(todayKey, index)), [todayKey])
  const scheduleCtx = React.useMemo(() => scheduleContextOf(defaults), [defaults])
  const openTimes = React.useMemo(() => {
    const out = new Map<string, string[]>()
    if (shared) return out
    for (const day of expandDays(scheduled, dayKeys[0], dayKeys[dayKeys.length - 1], scheduleCtx)) {
      const times = [...new Set(day.slots.map((slot) => slot.time))].sort()
      if (times.length > 0) out.set(day.dateKey, times)
    }
    return out
  }, [shared, scheduled, dayKeys, scheduleCtx])
  const bookableEnd = React.useMemo(() => {
    if (shared) return dayKeys[dayKeys.length - 1]
    const open = expandDays(scheduled, dayKeys[0], dayKeys[dayKeys.length - 1], { ...scheduleCtx, bookable: { nowIso, maxAdvanceDays: defaults.maxAdvanceDays } })
    return open.length > 0 ? open[open.length - 1].dateKey : todayKey
  }, [shared, scheduled, dayKeys, scheduleCtx, nowIso, defaults.maxAdvanceDays, todayKey])
  /** Shared: the runs each day, from the strip (this browser's bookings counted). */
  const runDays = React.useMemo(() => new Map(days.map((day) => [day.dateKey, day])), [days])
  const dayOpen = React.useCallback(
    (key: string) => (shared ? (runDays.get(key)?.slots.length ?? 0) > 0 : openTimes.has(key) && key <= bookableEnd),
    [shared, runDays, openTimes, bookableEnd],
  )
  const firstOpen = dayKeys.find(dayOpen) ?? todayKey
  const [dateKey, setDateKey] = React.useState(atKey ?? firstOpen)
  const [time, setTime] = React.useState(isHhmm(atTime) ? atTime : '14:00')
  const [returnKey, setReturnKey] = React.useState(backKey ?? keyPlus(atKey ?? firstOpen, 7))
  const [returnTime, setReturnTime] = React.useState(isHhmm(backTime) ? backTime : '15:00')
  // Shared: the flight's own time, and the run picked each way.
  const [flightTime, setFlightTime] = React.useState(shared && isHhmm(atTime) ? hhmmOf(minutesOf(atTime) - (firstTrip === 'to_hub' ? -(config?.checkInMinutes ?? 0) : 60)) : '12:00')
  const [returnFlightTime, setReturnFlightTime] = React.useState('15:00')
  const [runId, setRunId] = React.useState('')
  const [returnRunId, setReturnRunId] = React.useState('')
  // The saved schedule arrives after the first render: a day it closed is never the one picked.
  const picked = React.useRef(Boolean(atKey))
  React.useEffect(() => {
    if (!picked.current && !dayOpen(dateKey) && firstOpen !== dateKey) setDateKey(firstOpen)
  }, [dayOpen, dateKey, firstOpen])
  const pickDate = (key: string) => {
    picked.current = true
    setDateKey(key)
    if (returnKey < key) setReturnKey(keyPlus(key, Math.min(7, Math.max(1, DAYS_SHOWN - 1))))
  }

  const zone = zoneById(config, zoneId)
  // Shared: a ticket with a price but none for this destination isn't sold there (its count is left out).
  const ticketSold = (tier: Activity['priceTiers'][number]) =>
    !shared || !zone || tier.price <= 0 || transferRateFor(config, tier.id, pricingOf({ trip: hourly ? 'hourly' : trip, zoneId, toZoneId, hours })) !== undefined
  const ticketQty = (tier: Activity['priceTiers'][number]) => (ticketSold(tier) ? (tickets[tier.id] ?? 0) : 0)
  const passengers = shared ? Math.max(0, activity.priceTiers.reduce((sum, tier) => sum + peopleOf(tier) * ticketQty(tier), 0)) : passengersRaw
  const bags = bagsRaw ?? passengers
  const seatsNeeded = shared ? activity.priceTiers.reduce((sum, tier) => sum + placesOf(tier) * ticketQty(tier), 0) : 0
  const drive = zone?.driveMinutes ?? 0
  const checkIn = config?.checkInMinutes ?? 120

  /* ---------- shared runs: each way's times, the ones that work with the flight ---------- */

  const runsFor = React.useCallback(
    (key: string, direction: 'from_hub' | 'to_hub', flight: string) => {
      const day = runDays.get(key)
      const list = direction === 'from_hub' ? config?.shared?.fromHubTimes : config?.shared?.toHubTimes
      return (day?.slots ?? [])
        .filter((slot) => !list || list.includes(slot.startsAt.slice(11, 16)))
        .map((slot) => {
          const at = minutesOf(slot.startsAt.slice(11, 16))
          // Arrivals: a run at least 30 minutes after landing. Departures: at the hub in time for the flight.
          const fits = direction === 'from_hub' ? at >= minutesOf(flight) + 30 : at <= minutesOf(flight) - checkIn
          const full = slot.soldOut || slot.seatsLeft < Math.max(1, seatsNeeded)
          return { slot, fits, full, pickup: direction === 'to_hub' ? hhmmOf(at - drive - ((at - drive) % 5 + 5) % 5) : slot.startsAt.slice(11, 16) }
        })
    },
    [runDays, config, checkIn, seatsNeeded, drive],
  )
  const outRuns = shared ? runsFor(dateKey, trip === 'to_hub' ? 'to_hub' : 'from_hub', flightTime) : []
  const backRuns = shared && trip === 'round_trip' ? runsFor(returnKey, 'to_hub', returnFlightTime) : []
  // Keep a run that still works; else the first that does.
  const outRun = outRuns.find((run) => run.slot.departureId === runId && run.fits && !run.full) ?? outRuns.find((run) => run.fits && !run.full)
  const backRun = backRuns.find((run) => run.slot.departureId === returnRunId && run.fits && !run.full) ?? backRuns.find((run) => run.fits && !run.full)

  /* ---------- the request ---------- */

  const firstAt = shared ? (outRun ? `${outRun.slot.startsAt.slice(0, 16)}:00` : '') : isoAt(dateKey, time)
  const returnAt = trip === 'round_trip' ? (shared ? (backRun ? `${backRun.slot.startsAt.slice(0, 16)}:00` : '') : isoAt(returnKey, returnTime)) : undefined
  const request: TransferRequest = React.useMemo(
    () => ({
      trip: hourly ? 'hourly' : trip,
      ...(hourly ? {} : zoneId ? { zoneId } : {}),
      ...(trip === 'between' && toZoneId ? { toZoneId } : {}),
      passengers: Math.max(1, passengers),
      bags,
      at: firstAt,
      ...(returnAt ? { returnAt } : {}),
      ...(hourly ? { hours } : {}),
      ...(place.trim() ? { place: place.trim() } : {}),
      ...(dropOff.trim() ? { dropOff: dropOff.trim() } : {}),
    }),
    [hourly, trip, zoneId, toZoneId, passengers, bags, firstAt, returnAt, hours, place, dropOff],
  )

  const errors = React.useMemo(() => {
    const found = requestErrors(scheduled, request, nowIso)
    if (shared) {
      // Shared: a missing run reads as its own message, not a parse error.
      if (!outRun) found.at = outRuns.length === 0 ? 'No runs this day. Pick another day.' : outRuns.some((run) => run.fits) ? 'Those runs are full. Pick another day.' : 'No run fits that time. Pick another day or send a request.'
      if (trip === 'round_trip' && !backRun) found.returnAt = backRuns.some((run) => run.fits) ? 'Those runs are full. Pick another day.' : 'No run fits that time. Pick another day or send a request.'
    }
    return found
  }, [scheduled, request, nowIso, shared, outRun, outRuns, trip, backRun, backRuns])
  const notice = [errors.at, errors.returnAt].some((message) => message?.startsWith('Book at least'))

  /* ---------- vehicles: free at every leg, the cheapest set that fits ---------- */

  const holds = useTransferHolds(activity, tenantSlug, availability?.holds ?? NO_HOLDS)
  const located = hourly || Boolean(zone && (trip !== 'between' || zoneById(config, toZoneId)))
  const { legs, left, plan } = React.useMemo(() => transferPlanFor(scheduled, request, holds), [scheduled, request, holds])
  const [chosen, setChosen] = React.useState<VehiclePlan['lines'] | null>(null)
  const [choosing, setChoosing] = React.useState(false)
  const need = { passengers: request.passengers, bags }
  const chosenFits = chosen ? planFits(activity, chosen, need) && chosen.every((line) => line.qty <= (left[line.tierId] ?? 0)) : false
  const lines = shared ? [] : chosenFits && chosen ? chosen : (plan.best?.lines ?? [])
  // A destination without prices (from an old link) says so, rather than "too many".
  const unpriced = located && Boolean(errors.zone)
  // Too big only once there is somewhere to price the ride to (no destination yet: nothing is priced).
  const tooBig = shared ? seatsNeeded > Math.max(1, activity.maxCapacity) : located && plan.tooBig && !unpriced
  const timed = !errors.at && !errors.returnAt && !errors.hours
  const vehiclesOut = !shared && located && timed && !tooBig && !unpriced && !plan.best

  /* ---------- extras ---------- */

  const [extraQty, setExtraQty] = React.useState<Record<string, number>>(() => Object.fromEntries(activity.addOns.map((addOn) => [addOn.id, addOn.required ? 1 : 0])))
  const addOnsSelected = activity.addOns.map((addOn) => {
    const on = addOn.required || (extraQty[addOn.id] ?? 0) > 0
    if (!on) return { addOnId: addOn.id, qty: 0 }
    return { addOnId: addOn.id, qty: addOn.per === 'each' ? addOnUnits(addOn, passengers, extraQty[addOn.id] ?? 0) : addOnUnits(addOn, passengers) }
  })

  /* ---------- the price: the same engine and inputs as checkout ---------- */

  const { rules } = usePricing(tenantSlug)
  const tiers = shared ? activity.priceTiers.map((tier) => ({ tierId: tier.id, qty: ticketQty(tier) })) : lines
  const quote = React.useMemo(
    () =>
      buildQuote(activity, tenantSlug, { tiers, addOns: addOnsSelected }, 1, {
        startsAt: legs[0]?.pickupAt,
        nowIso,
        party: request.passengers,
        transfer: pricingOf(request),
        businessRules: rules,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activity, tenantSlug, JSON.stringify(tiers), JSON.stringify(addOnsSelected), legs, nowIso, request, rules],
  )

  /* ---------- book or ask ---------- */

  const [tried, setTried] = React.useState(false)
  const [asking, setAsking] = React.useState<RequestContext['reason'] | null>(null)
  const requestOnly = settings.method !== 'instant'
  const byRequest = requestOnly || tooBig || notice
  const ready = located && passengers >= 1 && Object.keys(errors).length === 0 && (shared ? seatsNeeded >= 1 : lines.length > 0)
  const askReason: RequestContext['reason'] = tooBig ? 'group' : notice ? 'sooner' : 'booking'

  const departureIds = shared ? [outRun?.slot.departureId ?? '', backRun?.slot.departureId ?? ''].filter(Boolean) : legs.map((leg) => transferSlotId(scheduled, leg.slotStartsAt))
  // A request can still ask for a time inside the notice, outside the hours driven or on a run that doesn't fit; nothing else wrong goes through.
  const askable = (key: string, message: string) =>
    (key === 'at' || key === 'returnAt') && (message.startsWith('Book at least') || message.startsWith("We don't drive at") || message.startsWith('No run') || message.startsWith('Those runs'))
  const wrong = Object.entries(errors).some(([key, message]) => !askable(key, message))
  const go = () => {
    setTried(true)
    if (byRequest) {
      if (tooBig || (located && !wrong)) setAsking(askReason)
      return
    }
    if (!ready) return
    router.push(
      checkoutHref(checkoutPath, activity.slug, departureIds[0], { tiers, addOns: addOnsSelected }, { ...encodeTransferQuery(request), d2: departureIds[1] }),
    )
  }

  /* ---------- nearest free times (hotel to hotel and hourly) ---------- */

  const flightLed = !hourly && trip !== 'between'
  const suggestions = React.useMemo(() => {
    if (!vehiclesOut || flightLed) return []
    const times = openTimes.get(dateKey) ?? []
    const at = minutesOf(time)
    return times
      .filter((entry) => entry !== time)
      .sort((a, b) => Math.abs(minutesOf(a) - at) - Math.abs(minutesOf(b) - at))
      .filter((entry) => {
        const other = { ...request, at: isoAt(dateKey, entry) }
        return Object.keys(requestErrors(scheduled, other, nowIso)).length === 0 && Boolean(transferPlanFor(scheduled, other, holds).plan.best)
      })
      .slice(0, 3)
  }, [vehiclesOut, flightLed, openTimes, dateKey, time, request, scheduled, nowIso, holds])

  /* ---------- the parts ---------- */

  const steps = [!hourly && trips.length > 1 ? 'trip' : null, 'where', 'who', 'when', activity.addOns.length > 0 ? 'extras' : null].filter((step): step is string => Boolean(step))
  const stepOf = (id: string) => steps.indexOf(id) + 1
  const heading = (id: string, text: string) => (
    <h3 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">
      {stepOf(id)} · {text}
    </h3>
  )
  const fieldError = (message: string | undefined) =>
    message ? (
      <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-danger" role="alert">
        <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        {message}
      </p>
    ) : null
  const stepper = (value: number, min: number, max: number, onChange: (next: number) => void, label: string) => (
    <div className="flex shrink-0 items-center gap-1.5">
      <IconButton type="button" aria-label={`Fewer ${label}`} size="xs" variant="outline" shape="circle" disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus aria-hidden="true" />
      </IconButton>
      <span className="w-7 text-center text-sm font-semibold tabular" aria-live="polite">
        {value}
      </span>
      <IconButton type="button" aria-label={`More ${label}`} size="xs" variant="outline" shape="circle" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus aria-hidden="true" />
      </IconButton>
    </div>
  )
  const dayStrip = (label: string, value: string, onPick: (key: string) => void, from = todayKey) => (
    <div>
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="no-scrollbar -mx-1 mt-1.5 flex snap-x gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label={label}>
        {dayKeys
          .filter((key) => key >= from)
          .map((key) => (
            <DayChip key={key} dateKey={key} open={dayOpen(key)} selected={key === value} onSelect={() => onPick(key)} />
          ))}
      </div>
    </div>
  )
  const timeInput = (id: string, label: string, value: string, onChange: (next: string) => void, error?: string) => (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
      <Input
        id={id}
        type="time"
        step={300}
        value={value}
        onChange={(event) => isHhmm(event.target.value) && onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        className="w-32"
        inputClassName="tabular"
      />
    </div>
  )
  const slotSelect = (id: string, label: string, value: string, onChange: (next: string) => void) => {
    const times = openTimes.get(dateKey) ?? []
    const options = times.includes(value) ? times : [value, ...times].sort()
    return (
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm text-foreground">
          {label}
        </label>
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-32 rounded-lg border border-line bg-surface px-3 text-sm tabular text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    )
  }
  const pickupLine = (leg: PlannedLeg | undefined) =>
    leg && leg.direction === 'to_hub' && !shared ? (
      <p className="flex items-center gap-1.5 text-xs text-subtle">
        <Clock className="size-3.5 shrink-0" aria-hidden="true" />
        Pickup from your hotel at <span className="font-semibold text-foreground tabular">{clockOf(leg.pickupAt)}</span>
        {/* An early flight: the pickup is the evening before. */}
        {leg.flightAt && leg.pickupAt.slice(0, 10) < leg.flightAt.slice(0, 10) ? ' the day before' : null}
      </p>
    ) : null
  const runChips = (runs: ReturnType<typeof runsFor>, selected: string | undefined, onPick: (id: string) => void, label: string, departing: boolean) =>
    runs.length === 0 ? (
      <p className="text-sm text-muted">No runs this day.</p>
    ) : (
      <div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label={label}>
          {runs.map((run) => (
            <RunChip
              key={run.slot.departureId}
              slot={run.slot}
              fits={run.fits}
              full={run.full}
              offLabel={departing ? 'Too late' : 'Too early'}
              selected={run.slot.departureId === selected}
              pickupNote={departing && zone ? `Pickup ${run.pickup}` : undefined}
              onSelect={() => onPick(run.slot.departureId)}
            />
          ))}
        </div>
        {departing && zone ? <p className="mt-2 text-xs text-subtle">Pickup from {zone.name}, at the time on the run.</p> : null}
      </div>
    )
  const outLeg = legs[0]
  const backLeg = trip === 'round_trip' ? legs.find((leg) => leg.direction === 'to_hub') : undefined
  const fromShown = fromPrice(activity)
  const freeWait = config?.freeWaitMinutes ?? 60

  const shell = variant === 'rail' ? 'rounded-2xl border border-line bg-surface shadow-xl' : 'rounded-none border-0 bg-transparent shadow-none'

  return (
    <section aria-label={`Book ${activity.name}`} className={cn('flex flex-col overflow-hidden', shell, className)}>
      {/* ---------- price header ---------- */}
      <header className={cn('flex items-end justify-between gap-4 border-b border-line-subtle px-5 py-4', variant === 'rail' && 'bg-surface-sunken/60')}>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">From</p>
          <p className="mt-0.5 font-display text-2xl font-semibold tabular tracking-tight text-foreground">
            {formatCurrency(fromShown, currency)}
            <span className="ml-1.5 text-xs font-medium text-subtle">{transferUnit(activity)}</span>
          </p>
          <p className="mt-0.5 text-xs text-subtle">{transferPriceNote(activity)}</p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
          <ShieldCheck className="size-3" aria-hidden="true" />
          Free cancellation
        </span>
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        {/* ---------- 1 · trip ---------- */}
        {steps.includes('trip') ? (
          <div>
            {heading('trip', 'Your trip')}
            <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-surface-sunken p-1" role="radiogroup" aria-label="Your trip">
              {trips.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  role="radio"
                  aria-checked={trip === entry}
                  onClick={() => setTrip(entry)}
                  className={cn(
                    'rounded-lg px-2 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    trip === entry ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground',
                  )}
                >
                  {tripLabel(entry, hub)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* ---------- 2 · where ---------- */}
        <div>
          {heading('where', hourly ? 'Where we collect you' : trip === 'between' ? 'Where to' : 'Where are you staying?')}
          <div className="mt-3 flex flex-col gap-3">
            {hourly ? (
              <div>
                <label htmlFor={`${activity.id}-pickup`} className="text-xs font-medium text-muted">
                  Pick up from
                </label>
                <Input id={`${activity.id}-pickup`} className="mt-1.5" value={place} onChange={(event) => setPlace(event.target.value)} placeholder="Hotel name or address" autoComplete="street-address" leftIcon={<MapPin />} />
              </div>
            ) : config ? (
              <>
                <ZonePicker
                  id={`${activity.id}-zone`}
                  label={trip === 'between' ? 'Pick up from' : 'Where are you staying?'}
                  hideLabel={trip !== 'between'}
                  config={config}
                  zoneId={zoneId}
                  place={place}
                  invalid={tried && Boolean(errors.zone) && !zone}
                  onPick={(zone, picked) => {
                    setZoneId(zone.id)
                    setPlace(picked)
                  }}
                  onAsk={() => setAsking('booking')}
                />
                {trip === 'between' ? (
                  <ZonePicker
                    id={`${activity.id}-to-zone`}
                    label="Drop off at"
                    config={config}
                    zoneId={toZoneId}
                    place={dropOff}
                    invalid={tried && Boolean(errors.zone) && !zoneById(config, toZoneId)}
                    onPick={(zone, picked) => {
                      setToZoneId(zone.id)
                      setDropOff(picked)
                    }}
                    onAsk={() => setAsking('booking')}
                  />
                ) : null}
                {tried || unpriced ? fieldError(errors.zone) : null}
              </>
            ) : null}
          </div>
        </div>

        {/* ---------- 3 · who ---------- */}
        <div>
          {heading('who', "Who's travelling")}
          <div className="mt-3 divide-y divide-line-subtle rounded-xl border border-line">
            {shared ? (
              activity.priceTiers.map((tier) => {
                const sold = ticketSold(tier)
                const qty = ticketQty(tier)
                const rate = located ? transferRateFor(config, tier.id, pricingOf(request)) : undefined
                const price = rate ?? (tier.price > 0 ? tier.price : 0)
                return (
                  <div key={tier.id} className="flex items-center gap-3 px-3.5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{tier.label}</p>
                      <p className="mt-0.5 text-xs text-subtle tabular">
                        {!sold ? `Not sold to ${zone?.name ?? 'this area'}` : price > 0 ? `${located ? '' : 'From '}${formatCurrency(price, currency)}` : 'Free'}
                        {sold && tier.description ? ` · ${tier.description}` : ''}
                      </p>
                    </div>
                    {stepper(qty, sold ? tier.minQuantity : 0, sold ? Math.max(tier.minQuantity, tier.maxQuantity) : 0, (next) => setTickets((current) => ({ ...current, [tier.id]: Math.max(tier.minQuantity, next) })), tier.label)}
                  </div>
                )
              })
            ) : (
              <div className="flex items-center gap-3 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Passengers</p>
                  <p className="mt-0.5 text-xs text-subtle">Babies count too</p>
                </div>
                {stepper(passengersRaw, 1, 99, setPassengers, 'passengers')}
              </div>
            )}
            <div className="flex items-center gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Suitcases</p>
                <p className="mt-0.5 text-xs text-subtle">Big bags. Carry-ons are fine.</p>
              </div>
              {stepper(bags, 0, 60, (next) => setBags(next), 'suitcases')}
            </div>
          </div>

          {!shared && located && plan.best && !tooBig ? (
            <VehicleCard
              activity={activity}
              lines={lines}
              plan={chosenFits ? null : plan.best}
              options={[plan.best, ...plan.options].filter((option, index, all) => all.findIndex((other) => sameLines(other.lines, option.lines)) === index)}
              choosing={choosing}
              onToggle={() => setChoosing((value) => !value)}
              onPick={(option) => {
                setChosen(option.lines)
                setChoosing(false)
              }}
              currency={currency}
            />
          ) : null}
          {tooBig ? (
            <div className="mt-3 flex flex-col gap-2 rounded-xl bg-warning-soft px-3.5 py-3 text-sm text-foreground">
              <p className="flex items-start gap-2">
                <Users className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                That&rsquo;s more than we take in one booking.
              </p>
              <Button type="button" size="sm" variant="outline" className="self-start" onClick={() => setAsking('group')}>
                Send a request
              </Button>
            </div>
          ) : null}
          {tried ? fieldError(errors.passengers) : null}
        </div>

        {/* ---------- 4 · when ---------- */}
        <div>
          {heading('when', 'When')}
          <div className="mt-3 flex flex-col gap-4">
            {hourly ? (
              <>
                {dayStrip('Day', dateKey, pickDate)}
                {slotSelect(`${activity.id}-start`, 'Start at', time, setTime)}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">How many hours</span>
                  {stepper(hours, config?.minHours ?? 1, config?.maxHours ?? 12, setHours, 'hours')}
                </div>
                <p className="flex items-center gap-1.5 text-xs text-subtle">
                  <Clock className="size-3.5 shrink-0" aria-hidden="true" />
                  Until <span className="font-semibold text-foreground tabular">{hhmmOf(minutesOf(time) + hours * 60)}</span>
                </p>
                {fieldError(errors.hours)}
                {fieldError(errors.at)}
              </>
            ) : trip === 'between' ? (
              <>
                {dayStrip('Day', dateKey, pickDate)}
                {slotSelect(`${activity.id}-pickup-at`, 'Pickup at', time, setTime)}
                {fieldError(errors.at)}
              </>
            ) : shared ? (
              <>
                {dayStrip(trip === 'to_hub' ? 'Leaving' : 'Arriving', dateKey, pickDate)}
                {timeInput(`${activity.id}-flight`, trip === 'to_hub' ? labels.leaves : labels.arrives, flightTime, setFlightTime)}
                {runChips(outRuns, outRun?.slot.departureId, setRunId, 'Runs', trip === 'to_hub')}
                {fieldError(errors.at)}
                {trip === 'round_trip' ? (
                  <>
                    {dayStrip('Leaving', returnKey, setReturnKey, dateKey)}
                    {timeInput(`${activity.id}-return-flight`, labels.leaves, returnFlightTime, setReturnFlightTime)}
                    {runChips(backRuns, backRun?.slot.departureId, setReturnRunId, 'Return runs', true)}
                    {fieldError(errors.returnAt)}
                  </>
                ) : null}
              </>
            ) : (
              <>
                {dayStrip(trip === 'to_hub' ? 'Leaving' : 'Arriving', dateKey, pickDate)}
                {timeInput(`${activity.id}-time`, trip === 'to_hub' ? labels.leaves : labels.arrives, time, setTime, errors.at)}
                {trip === 'to_hub' ? pickupLine(outLeg) : freeWait > 0 ? <p className="text-xs text-subtle">Your driver waits up to {freeWait} minutes after landing, free.</p> : null}
                {fieldError(errors.at)}
                {trip === 'round_trip' ? (
                  <>
                    {dayStrip('Leaving', returnKey, setReturnKey, dateKey)}
                    {timeInput(`${activity.id}-return`, labels.leaves, returnTime, setReturnTime, errors.returnAt)}
                    {pickupLine(backLeg)}
                    {fieldError(errors.returnAt)}
                  </>
                ) : null}
              </>
            )}

            {vehiclesOut ? (
              <div className="flex flex-col gap-2 rounded-xl bg-warning-soft px-3.5 py-3 text-sm text-foreground">
                <p className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  All our vehicles are out then.
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((entry) => (
                    <Button key={entry} type="button" size="sm" variant="outline" onClick={() => setTime(entry)}>
                      Try {entry}
                    </Button>
                  ))}
                  {suggestions.length === 0 ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => setAsking('booking')}>
                      Send a request
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ---------- 5 · extras ---------- */}
        {steps.includes('extras') ? (
          <div>
            {heading('extras', 'Extras')}
            <div className="mt-3 space-y-2">
              {activity.addOns.map((addOn) => {
                const qty = extraQty[addOn.id] ?? 0
                if (addOn.per === 'each') {
                  const max = Math.max(0, addOn.maxQty ?? 9)
                  return (
                    <div key={addOn.id} className={cn('flex items-center gap-3 rounded-xl border px-3.5 py-3', qty > 0 ? 'border-primary bg-primary-soft/40' : 'border-line')}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {addOn.label} · <span className="tabular">{formatCurrency(addOn.price, currency)}</span> each
                        </p>
                        {addOn.description ? <p className="mt-0.5 text-xs leading-relaxed text-subtle">{addOn.description}</p> : null}
                      </div>
                      {stepper(qty, addOn.required ? 1 : 0, max, (next) => setExtraQty((current) => ({ ...current, [addOn.id]: next })), addOn.label)}
                    </div>
                  )
                }
                const on = addOn.required || qty > 0
                const units = addOnUnits(addOn, passengers)
                const id = `${activity.id}-addon-${addOn.id}`
                return (
                  <label key={addOn.id} htmlFor={id} className={cn('flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3', on ? 'border-primary bg-primary-soft/40' : 'border-line hover:border-line-strong')}>
                    <Checkbox id={id} checked={on} disabled={addOn.required} onCheckedChange={(value) => setExtraQty((current) => ({ ...current, [addOn.id]: value === true ? 1 : 0 }))} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">{addOn.label}</span>
                        <span className="shrink-0 text-sm font-semibold tabular text-foreground">
                          {formatCurrency(addOn.price, currency)}
                          <span className="ml-1 text-xs font-medium text-subtle">{on && units > 1 ? `× ${units}` : addOnPer(addOn)}</span>
                        </span>
                      </span>
                      {addOn.description ? <span className="mt-0.5 block text-xs leading-relaxed text-subtle">{addOn.description}</span> : null}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* ---------- summary ---------- */}
        <div className="rounded-xl bg-surface-sunken p-4">
          <ul className="space-y-2 text-sm">
            {[...quote.ticketLines, ...quote.addOnLines].map((line) => (
              <li key={line.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-muted">
                  {line.label}
                  {line.quantity > 1 ? <span className="ml-1.5 text-xs text-faint tabular">× {line.quantity}</span> : null}
                </span>
                <span className="shrink-0 tabular font-medium text-foreground">{formatCurrency(line.total, currency)}</span>
              </li>
            ))}
            {quote.ticketLines.length === 0 ? <li className="text-sm text-subtle">{located ? 'Pick a time to see your total.' : "Pick where you're going to see your total."}</li> : null}
          </ul>
          <div className="mt-3 flex items-end justify-between gap-3 border-t border-line pt-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">Total</p>
              <p className="text-xs text-subtle">{quote.countLabel} · all fees included</p>
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={quote.total}
                initial={reducedMotion ? false : { y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reducedMotion ? undefined : { y: -14, opacity: 0 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                className="block font-display text-2xl font-semibold tabular tracking-tight text-foreground"
              >
                {formatCurrency(quote.total, currency, { decimals: true })}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>

        {/* ---------- book ---------- */}
        <div className="space-y-3">
          {asking ? (
            <RequestForm
              activity={activity}
              tenantSlug={tenantSlug}
              currency={currency}
              replyHours={settings.replyHours}
              onCancel={() => setAsking(null)}
              context={{
                reason: asking,
                party: request.passengers,
                lines: quote.ticketLines.filter((line) => line.total > 0).map((line) => ({ label: line.label, qty: line.quantity, unit: line.unitPrice })),
                ...(located && request.at
                  ? { transfer: bookingDetailsOf(scheduled, request, { vehicles: lines, departureIds: [], place: request.place ?? '', dropOff: request.dropOff }) }
                  : {}),
                ...(legs[0] ? { slot: { departureId: '', startsAt: legs[0].pickupAt } } : { askDate: true, minDate: todayKey }),
              }}
            />
          ) : (
            <>
              <Button size="lg" fullWidth onClick={go} disabled={!byRequest && (vehiclesOut || (tried && !ready))} className="h-12 text-[0.9375rem]">
                {byRequest ? 'Send request' : 'Continue'}
              </Button>
              {byRequest ? <p className="text-center text-xs text-subtle">Nothing is charged now. We confirm and send a payment link.</p> : null}
              {settings.phone || businessPhone ? (
                <p className="text-center">
                  <a href={`tel:${(settings.phone || businessPhone || '').replace(/[^\d+]/g, '')}`} className="text-xs text-subtle hover:text-foreground">
                    Or call {settings.phone || businessPhone}
                  </a>
                </p>
              ) : null}
            </>
          )}
          {activity.cancellationPolicy.freeCancellationHours > 0 ? (
            <p className="text-center text-xs text-muted">Free cancellation up to {hoursLabel(activity.cancellationPolicy.freeCancellationHours)} before pickup.</p>
          ) : null}
          <TrustSeal freeCancellationHours={activity.cancellationPolicy.freeCancellationHours} byRequest={byRequest} />
        </div>
      </div>
    </section>
  )
}

/* ==========================================================================
   PARTS
   ========================================================================== */

const sameLines = (a: VehiclePlan['lines'], b: VehiclePlan['lines']) =>
  a.length === b.length && a.every((line) => b.some((other) => other.tierId === line.tierId && other.qty === line.qty))

function DayChip({ dateKey, open, selected, onSelect }: { dateKey: string; open: boolean; selected: boolean; onSelect: () => void }) {
  const date = fromDateKey(dateKey)
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!open}
      aria-pressed={selected}
      aria-label={new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(date)}
      className={cn(
        'flex w-14 shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl border px-1.5 py-2 transition-colors',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected ? 'border-primary bg-primary text-on-primary' : open ? 'border-line bg-surface text-foreground hover:border-primary/50' : 'cursor-not-allowed border-line-subtle bg-surface-sunken text-faint',
      )}
    >
      <span className={cn('text-xs font-semibold uppercase', selected ? 'text-on-primary/75' : 'text-subtle')}>{WEEKDAY[date.getDay()]}</span>
      <span className="font-display text-lg font-semibold leading-none tabular">{date.getDate()}</span>
      <span className={cn('text-xs', selected ? 'text-on-primary/70' : 'text-faint')}>{MONTH[date.getMonth()]}</span>
    </button>
  )
}

function RunChip({ slot, fits, full, offLabel, selected, pickupNote, onSelect }: { slot: AvailabilitySlot; fits: boolean; full: boolean; offLabel: string; selected: boolean; pickupNote?: string; onSelect: () => void }) {
  const off = !fits || full
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={off}
      aria-pressed={selected}
      className={cn(
        'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected ? 'border-primary bg-primary text-on-primary' : off ? 'cursor-not-allowed border-line-subtle bg-surface-sunken text-faint' : 'border-line bg-surface text-foreground hover:border-primary/50',
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular">
        <Clock className={cn('size-3.5', selected ? 'text-on-primary/70' : 'text-faint')} aria-hidden="true" />
        {slot.startsAt.slice(11, 16)}
      </span>
      <span className={cn('text-xs font-medium', selected ? 'text-on-primary/75' : full ? 'text-danger' : 'text-subtle')}>
        {full ? 'Full' : !fits ? offLabel : pickupNote ?? `${slot.seatsLeft} seats`}
      </span>
    </button>
  )
}

function VehicleCard({
  activity,
  lines,
  plan,
  options,
  choosing,
  onToggle,
  onPick,
  currency,
}: {
  activity: Activity
  lines: VehiclePlan['lines']
  /** The plan shown, when it is the best one (null: a picked option). */
  plan: VehiclePlan | null
  options: VehiclePlan[]
  choosing: boolean
  onToggle: () => void
  onPick: (option: VehiclePlan) => void
  currency: BookingWidgetProps['currency']
}) {
  const vehicles = vehiclesOf(activity)
  const count = lines.reduce((sum, line) => sum + line.qty, 0)
  const one = count === 1 ? vehicles.find((vehicle) => vehicle.tierId === lines[0]?.tierId) : undefined
  const listId = `${activity.id}-vehicle-options`
  void plan
  return (
    <div className="mt-3 rounded-xl border border-primary/40 bg-primary-soft/30 px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{one ? one.name : `${count} vehicles`}</p>
          <p className="mt-0.5 text-xs text-subtle">{one ? `Fits ${one.passengers} passengers and ${one.bags} suitcases` : vehiclesSentence(activity, lines)}</p>
        </div>
        {options.length > 1 ? (
          <button type="button" onClick={onToggle} aria-expanded={choosing} aria-controls={listId} className="shrink-0 text-xs font-semibold text-primary hover:underline">
            Choose another
          </button>
        ) : null}
      </div>
      {choosing ? (
        <ul id={listId} className="mt-2.5 flex list-none flex-col gap-1.5 p-0">
          {options.map((option) => {
            const on = sameLines(option.lines, lines)
            return (
              <li key={option.lines.map((line) => `${line.tierId}:${line.qty}`).join('|')}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onPick(option)}
                  className={cn('flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm', on ? 'border-primary bg-surface' : 'border-line bg-surface hover:border-line-strong')}
                >
                  <span className="min-w-0 text-foreground">{vehiclesSentence(activity, option.lines)}</span>
                  <span className="shrink-0 font-semibold tabular text-foreground">{formatCurrency(option.price, currency)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

/* ---------- where: a search box over the destinations and their hotels ---------- */

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

function ZonePicker({
  id,
  label,
  hideLabel = false,
  config,
  zoneId,
  place,
  invalid,
  onPick,
  onAsk,
}: {
  id: string
  label: string
  hideLabel?: boolean
  config: TransferConfig
  zoneId: string
  place: string
  invalid?: boolean
  onPick: (zone: TransferZone, place: string) => void
  onAsk: () => void
}) {
  const zone = zoneById(config, zoneId)
  const shown = place || zone?.name || ''
  const [query, setQuery] = React.useState(shown)
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(0)
  // A pick from outside (a link) shows in the box.
  React.useEffect(() => {
    setQuery(shown)
  }, [shown])
  const matches = React.useMemo(() => searchZones(config, query === shown ? '' : query, 6), [config, query, shown])
  const nothing = matches.length === 0
  const rows = nothing ? searchZones(config, '', 8) : matches
  const listId = `${id}-list`
  const pick = (index: number) => {
    const row = rows[index]
    if (!row) return
    const typed = query.trim()
    // A hotel that matched is the place; picking an area for something typed keeps what was typed.
    const picked = row.place ?? (typed && typed !== shown && !fold(row.zone.name).includes(fold(typed)) ? typed : '')
    onPick(row.zone, picked)
    setQuery(picked || row.zone.name)
    setOpen(false)
  }
  return (
    <div className="relative">
      <label htmlFor={id} className={cn('text-xs font-medium text-muted', hideLabel && 'sr-only')}>
        {label}
      </label>
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && rows[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid ? true : undefined}
        autoComplete="off"
        className={cn(!hideLabel && 'mt-1.5')}
        leftIcon={<MapPin />}
        placeholder="Hotel name or area"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            setActive((value) => Math.min(rows.length - 1, value + 1))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setActive((value) => Math.max(0, value - 1))
          } else if (event.key === 'Enter' && open) {
            event.preventDefault()
            pick(active)
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {zone && !open ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-subtle">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            <span className="font-semibold text-foreground">{zone.name}</span>
            {place ? ` · ${place}` : ''}
          </span>
        </p>
      ) : null}
      {open ? (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
          {nothing ? (
            <p className="border-b border-line-subtle px-3.5 py-2.5 text-xs text-subtle">
              Can&rsquo;t find it? Pick the nearest area, or{' '}
              <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={onAsk} className="font-semibold text-primary hover:underline">
                send us a request
              </button>
              .
            </p>
          ) : null}
          <ul id={listId} role="listbox" aria-label={label} className="max-h-72 list-none overflow-y-auto p-1">
            {rows.map((row, index) => (
              <li
                key={`${row.zone.id}|${row.place ?? ''}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(index)}
                className={cn('cursor-pointer rounded-lg px-2.5 py-2', index === active ? 'bg-surface-sunken' : '')}
              >
                <span className="block text-sm font-semibold text-foreground">{row.zone.name}</span>
                {row.place ? <span className="block truncate text-xs text-subtle">{row.place}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
