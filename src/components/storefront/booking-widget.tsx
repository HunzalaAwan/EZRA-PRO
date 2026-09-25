'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import {
  Anchor,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  GraduationCap,
  Info,
  KeyRound,
  MapPin,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Zap,
  Route as RouteIcon,
} from 'lucide-react'

import {
  cn,
  clamp,
  formatCurrency,
  formatTime,
  fromDateKey,
  pluralize,
} from '@/lib/utils'
import type { Activity, CurrencyCode, DepartureStatus, Location, VerticalKey } from '@/types'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { crewName, FUEL_LABEL, LESSON_LEVELS, LICENCE_LABEL, isDayRental, partyLabel, rateFor, rentalCategoryMeta, rentalModes, routeLabel, type RentalMode } from '@/lib/activity-kinds'
import { applyRules } from '@/lib/pricing'
import { usePricing } from '@/hooks/use-pricing'
import { IconButton } from '@/components/ui/icon-button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { TrustSeal } from '@/components/storefront/trust-bar'
import { locationAddress } from '@/lib/locations'

/* ==========================================================================
   AVAILABILITY CONTRACT

   The server flattens `getStorefrontAvailability()` into these plain shapes so
   the widget never pulls the demo module — and therefore the 4,800-line data
   seam — into the client bundle.
   ========================================================================== */

export interface AvailabilitySlot {
  departureId: string
  /** Local ISO, "YYYY-MM-DDTHH:mm:ss". */
  startsAt: string
  endsAt: string
  capacity: number
  seatsLeft: number
  status: DepartureStatus
  /** Dynamic-pricing multiplier for this departure; 1 when none applies. */
  priceMultiplier: number
  /** Lead-tier price after the multiplier, minor units. */
  leadPrice: number
  /** The location this run leaves from; absent on single-site businesses. */
  locationId?: string
  soldOut: boolean
}

export interface AvailabilityDay {
  /** "YYYY-MM-DD" — matches `toDateKey()`. */
  dateKey: string
  slots: AvailabilitySlot[]
  /** Cheapest lead price across the day's slots; 0 when nothing runs. */
  fromPrice: number
  seatsLeft: number
  soldOut: boolean
}

/* ==========================================================================
   PRICING

   Mirrors the maths in `@/lib/demo` so a quote produced here reconciles with
   the bookings the operator sees in the dashboard: 6% booking fee on the net,
   then card processing at cost on top.
   ========================================================================== */

export const BOOKING_FEE_RATE = 0.06

/** Card processing, passed through at cost: what Stripe charges on a card payment. */
export const PROCESSING_FEE = { rate: 0.025, label: 'Card processing (2.5%)' } as const

/** Kept for callers that looked fees up by tenant; every tenant now carries the same processing line. */
export const TAX_BY_TENANT: Record<string, { rate: number; label: string }> = {
  'blue-horizon': PROCESSING_FEE,
  'coral-cay': PROCESSING_FEE,
  saltline: PROCESSING_FEE,
  ridgeline: PROCESSING_FEE,
}

/** One plain label everywhere; the harbour levies and service charges are folded into it. */
const FEE_LABEL: Partial<Record<VerticalKey, string>> = {}

export interface QuoteSelection {
  tiers: { tierId: string; qty: number }[]
  addOns: { addOnId: string; qty: number }[]
}

export interface QuoteLine {
  id: string
  label: string
  kind: 'ticket' | 'addon' | 'fee' | 'tax'
  quantity: number
  unitPrice: number
  total: number
}

export interface Quote {
  ticketLines: QuoteLine[]
  addOnLines: QuoteLine[]
  subtotal: number
  feeTotal: number
  feeLabel: string
  taxTotal: number
  taxLabel: string
  total: number
  /** Tickets that consume a seat. */
  seats: number
  /** Every ticket, including comp/ride-along tiers. */
  headcount: number
  /** Day rentals: how many days each unit is out. 1 otherwise. */
  days: number
  /** Hourly rentals: how many hours. */
  hours?: number
  /** People on the booking: the charter group, or the headcount. */
  party: number
  /** "2 jet skis", "6 guests": what the booking is counted in. */
  countLabel: string
}

export interface QuoteOptions {
  /** Day rentals: every tier is priced per day. */
  days?: number
  /** Charters: the group size, which the per-group price does not count. */
  party?: number
  /** Rentals with rates: priced per hour or per day. */
  rentalMode?: RentalMode
  hours?: number
}

/** Deterministic, integer-only money maths — minor units in, minor units out. */
export function buildQuote(
  activity: Activity,
  tenantSlug: string,
  selection: QuoteSelection,
  priceMultiplier = 1,
  options: QuoteOptions = {},
): Quote {
  const days = Math.max(1, Math.floor(options.days ?? 1))
  const tax = TAX_BY_TENANT[tenantSlug] ?? PROCESSING_FEE
  const ticketLines: QuoteLine[] = []
  let seats = 0
  let headcount = 0
  let subtotal = 0

  for (const tier of activity.priceTiers) {
    const qty = selection.tiers.find((t) => t.tierId === tier.id)?.qty ?? 0
    if (qty <= 0) continue
    // A rental with rates prices each item per hour or per day; everything else uses the tier price.
    const rated = (activity.kind ?? 'trip') === 'rental' && options.rentalMode && (activity.rental?.rates?.length ?? 0) > 0
    const hours = Math.max(1, Math.floor(options.hours ?? 1))
    const base = rated ? (rateFor(activity, tier.id, options.rentalMode!) ?? tier.price) : tier.price
    const span = rated && options.rentalMode === 'hour' ? hours : days
    const unitPrice = Math.round(base * priceMultiplier) * span
    const total = unitPrice * qty
    ticketLines.push({
      id: tier.id,
      label:
        rated && options.rentalMode === 'hour'
          ? `${tier.label} · ${hours} ${hours === 1 ? 'hour' : 'hours'}`
          : days > 1
            ? `${tier.label} · ${days} days`
            : tier.label,
      kind: 'ticket',
      quantity: qty,
      unitPrice,
      total,
    })
    subtotal += total
    headcount += qty
    if (tier.countsTowardCapacity) seats += qty
  }

  const addOnLines: QuoteLine[] = []
  for (const addOn of activity.addOns) {
    const qty = selection.addOns.find((a) => a.addOnId === addOn.id)?.qty ?? 0
    if (qty <= 0) continue
    const total = addOn.price * qty
    addOnLines.push({
      id: addOn.id,
      label: addOn.label,
      kind: 'addon',
      quantity: qty,
      unitPrice: addOn.price,
      total,
    })
    subtotal += total
  }

  const feeTotal = Math.round(subtotal * BOOKING_FEE_RATE)
  const taxTotal = Math.round(subtotal * tax.rate)

  return {
    ticketLines,
    addOnLines,
    subtotal,
    feeTotal,
    feeLabel: FEE_LABEL[activity.category] ?? 'Booking fee',
    taxTotal,
    taxLabel: tax.label,
    total: subtotal + feeTotal + taxTotal,
    seats,
    headcount,
    days,
    ...(options.rentalMode === 'hour' ? { hours: Math.max(1, Math.floor(options.hours ?? 1)) } : {}),
    party: (activity.kind ?? 'trip') === 'charter' ? Math.max(1, options.party ?? headcount) : headcount,
    countLabel: partyLabel(activity, (activity.kind ?? 'trip') === 'charter' ? Math.max(1, options.party ?? headcount) : headcount),
  }
}

/** The canonical checkout URL for a selection. Parsed back by the checkout page. */
export function checkoutHref(
  checkoutPath: string,
  activitySlug: string,
  departureId: string,
  selection: QuoteSelection,
  extra: Record<string, string | number | undefined> = {},
) {
  const params = new URLSearchParams()
  params.set('activity', activitySlug)
  params.set('d', departureId)
  const tiers = selection.tiers.filter((t) => t.qty > 0)
  if (tiers.length > 0) params.set('t', tiers.map((t) => `${t.tierId}:${t.qty}`).join('|'))
  const addOns = selection.addOns.filter((a) => a.qty > 0)
  if (addOns.length > 0) params.set('a', addOns.map((a) => `${a.addOnId}:${a.qty}`).join('|'))
  for (const [key, value] of Object.entries(extra)) if (value !== undefined) params.set(key, String(value))
  return `${checkoutPath}?${params.toString()}`
}

/* ==========================================================================
   <BookingWidget>
   ========================================================================== */

export interface BookingWidgetProps {
  activity: Activity
  tenantSlug: string
  currency: CurrencyCode
  days: AvailabilityDay[]
  /** The business's locations. With more than one on the activity, guests pick one first. */
  locations?: Location[]
  checkoutPath: string
  initialDateKey?: string
  initialGuests?: number
  /** The demo clock, so early-bird and last-minute rules price correctly. */
  nowIso?: string
  /** `sheet` drops the card chrome for the mobile bottom sheet. */
  variant?: 'rail' | 'sheet'
  className?: string
}

export function BookingWidget({
  activity,
  tenantSlug,
  currency,
  days: allDays,
  locations = [],
  checkoutPath,
  initialDateKey,
  initialGuests,
  nowIso,
  variant = 'rail',
  className,
}: BookingWidgetProps) {
  const router = useRouter()
  const reducedMotion = useReducedMotionSafe()
  const stripRef = React.useRef<HTMLDivElement>(null)

  /* ---------- location ---------- */

  const sites = React.useMemo(
    () =>
      activity.locations
        .map((site) => ({ ...site, location: locations.find((entry) => entry.id === site.locationId) }))
        .filter((site): site is typeof site & { location: Location } => Boolean(site.location)),
    [activity.locations, locations],
  )
  const multiSite = sites.length > 1
  const [locationId, setLocationId] = React.useState<string>(() => sites[0]?.locationId ?? '')
  /* ---------- kind ---------- */

  const kind = activity.kind ?? 'trip'
  const modes = rentalModes(activity)
  const rated = modes.length > 0 && (activity.rental?.rates?.length ?? 0) > 0
  const [rentalMode, setRentalMode] = React.useState<RentalMode>(() => modes[0] ?? (isDayRental(activity) ? 'day' : 'hour'))
  const dayRental = kind === 'rental' && (modes.length > 0 ? rentalMode === 'day' : isDayRental(activity))
  const hourRental = kind === 'rental' && rated && rentalMode === 'hour'
  const minHours = Math.max(1, activity.rental?.minHours ?? 1)
  const maxHours = Math.max(minHours, activity.rental?.maxHours ?? 4)
  const [rentHours, setRentHours] = React.useState(minHours)
  const rentalMeta = rentalCategoryMeta(activity.rental?.category)
  const minDays = Math.max(1, activity.rental?.minDays ?? 1)
  const maxDays = Math.max(minDays, activity.rental?.maxDays ?? 14)
  const [rentDays, setRentDays] = React.useState(minDays)
  const showTime = kind !== 'pass' && !dayRental
  const stepList = [multiSite ? 'location' : null, 'date', showTime ? 'time' : null, 'guests', 'extras'].filter(
    (step): step is string => Boolean(step),
  )
  const stepOf = (id: string) => stepList.indexOf(id) + 1
  const requestMode = kind === 'charter' && Boolean(activity.charter?.requestToBook)
  const [party, setParty] = React.useState(() => Math.max(2, activity.minParticipants || 1))
  const [requestOpen, setRequestOpen] = React.useState(false)
  const [requestSent, setRequestSent] = React.useState(false)
  const [request, setRequest] = React.useState({ name: '', email: '', message: '' })

  /* Only the chosen location's runs, with the day totals recomputed. */
  const days = React.useMemo(() => {
    if (!multiSite) return allDays
    return allDays.map((day) => {
      const slots = day.slots.filter((slot) => !slot.locationId || slot.locationId === locationId)
      const open = slots.filter((slot) => !slot.soldOut)
      return {
        ...day,
        slots,
        fromPrice: open.length > 0 ? Math.min(...open.map((slot) => slot.leadPrice)) : 0,
        seatsLeft: open.reduce((total, slot) => total + slot.seatsLeft, 0),
        soldOut: slots.length > 0 && open.length === 0,
      }
    })
  }, [allDays, multiSite, locationId])

  const bookableDays = React.useMemo(() => days.filter((d) => !d.soldOut && d.slots.length > 0), [days])

  // A new location means a new strip: land on its first bookable day.
  const previousLocation = React.useRef(locationId)
  React.useEffect(() => {
    if (previousLocation.current === locationId) return
    previousLocation.current = locationId
    setDateKey(bookableDays[0]?.dateKey ?? days[0]?.dateKey ?? '')
  }, [locationId, bookableDays, days])

  const [dateKey, setDateKey] = React.useState<string>(() => {
    const requested = initialDateKey && days.find((d) => d.dateKey === initialDateKey)
    if (requested && !requested.soldOut && requested.slots.length > 0) return requested.dateKey
    return bookableDays[0]?.dateKey ?? days[0]?.dateKey ?? ''
  })

  const day = days.find((d) => d.dateKey === dateKey)
  const openSlots = React.useMemo(
    () => (day?.slots ?? []).filter((s) => !s.soldOut),
    [day],
  )

  const [departureId, setDepartureId] = React.useState<string>(
    () => openSlots[0]?.departureId ?? day?.slots[0]?.departureId ?? '',
  )

  // Keep the time selection valid whenever the day changes.
  React.useEffect(() => {
    const stillValid = openSlots.some((s) => s.departureId === departureId)
    if (!stillValid) setDepartureId(openSlots[0]?.departureId ?? '')
  }, [openSlots, departureId])

  const slot = day?.slots.find((s) => s.departureId === departureId)

  /* ---------- tier quantities ---------- */

  const [tierQty, setTierQty] = React.useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {}
    activity.priceTiers.forEach((tier, index) => {
      if (index === 0) {
        const wanted = (activity.kind ?? 'trip') === 'rental' ? 1 : (initialGuests ?? Math.max(tier.minQuantity, 2))
        seed[tier.id] = clamp(wanted, Math.max(tier.minQuantity, 1), tier.maxQuantity)
      } else {
        seed[tier.id] = tier.minQuantity
      }
    })
    return seed
  })

  const [addOnOn, setAddOnOn] = React.useState<Record<string, boolean>>(() => {
    const seed: Record<string, boolean> = {}
    for (const addOn of activity.addOns) seed[addOn.id] = addOn.required
    return seed
  })

  const seatsUsed = activity.priceTiers.reduce(
    (total, tier) => total + (tier.countsTowardCapacity ? (tierQty[tier.id] ?? 0) : 0),
    0,
  )
  const headcount = activity.priceTiers.reduce((total, tier) => total + (tierQty[tier.id] ?? 0), 0)
  /** Day rentals: a unit is free only if it is free every day of the span. */
  const spanLeft = React.useMemo(() => {
    if (!dayRental || !slot) return slot?.seatsLeft ?? 0
    const start = days.findIndex((entry) => entry.dateKey === dateKey)
    if (start < 0) return 0
    let least = Number.POSITIVE_INFINITY
    for (let offset = 0; offset < rentDays; offset++) {
      const entry = days[start + offset]
      if (!entry) break
      const open = entry.slots.filter((item) => !item.soldOut)
      least = Math.min(least, open.length > 0 ? Math.max(...open.map((item) => item.seatsLeft)) : 0)
    }
    return Number.isFinite(least) ? least : 0
  }, [dayRental, slot, days, dateKey, rentDays])
  const seatsLeft = dayRental ? spanLeft : (slot?.seatsLeft ?? 0)
  const overCapacity = slot ? seatsUsed > seatsLeft : false

  const selection: QuoteSelection = React.useMemo(
    () => ({
      tiers: activity.priceTiers.map((tier) => ({ tierId: tier.id, qty: tierQty[tier.id] ?? 0 })),
      addOns: activity.addOns.map((addOn) => ({
        addOnId: addOn.id,
        qty: addOnOn[addOn.id]
          ? clamp(Math.max(1, headcount), 1, addOn.maxPerBooking ?? Math.max(1, headcount))
          : 0,
      })),
    }),
    [activity.priceTiers, activity.addOns, tierQty, addOnOn, headcount],
  )

  const { rules } = usePricing(tenantSlug)
  const ruleResult = React.useMemo(
    () =>
      slot
        ? applyRules(rules, { activitySlug: activity.slug, startsAt: slot.startsAt, nowIso: nowIso ?? slot.startsAt, guests: Math.max(1, headcount) })
        : { multiplier: 1, applied: [] },
    [rules, slot, activity.slug, nowIso, headcount],
  )

  const quote = React.useMemo(
    () =>
      buildQuote(activity, tenantSlug, selection, (slot?.priceMultiplier ?? 1) * ruleResult.multiplier, {
        days: dayRental ? rentDays : 1,
        party,
        ...(rated ? { rentalMode, hours: rentHours } : {}),
      }),
    [activity, tenantSlug, selection, slot, ruleResult.multiplier, dayRental, rentDays, party, rated, rentalMode, rentHours],
  )

  // Per-person kinds: every tier's minimum per booking has to be met. Charters and rentals pick one option.
  const perPerson = kind !== 'charter' && kind !== 'rental'
  const shortTiers = perPerson ? activity.priceTiers.filter((tier) => (tierQty[tier.id] ?? 0) < tier.minQuantity) : []
  const canReserve =
    shortTiers.length === 0 &&
    Boolean(slot) && !overCapacity && seatsUsed >= (kind === 'charter' || kind === 'rental' ? 1 : Math.max(1, activity.minParticipants)) && (kind !== 'charter' || party >= Math.max(1, activity.minParticipants))

  const reserve = () => {
    if (!slot || !canReserve) return
    router.push(
      checkoutHref(checkoutPath, activity.slug, slot.departureId, selection, {
        n: dayRental ? rentDays : undefined,
        m: rated ? rentalMode : undefined,
        h: hourRental ? rentHours : undefined,
        g: kind === 'charter' ? party : undefined,
      }),
    )
  }

  const scrollStrip = (direction: 1 | -1) => {
    stripRef.current?.scrollBy({ left: direction * 264, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  const fromPrice = Math.min(
    ...[activity.basePrice, ...bookableDays.map((d) => d.fromPrice).filter((p) => p > 0)],
  )

  /* ---------- per-kind blocks ---------- */

  const multiplier = slot?.priceMultiplier ?? 1
  const chosenTier = activity.priceTiers.find((tier) => (tierQty[tier.id] ?? 0) > 0) ?? activity.priceTiers[0]
  const chosenQty = chosenTier ? (tierQty[chosenTier.id] ?? 0) : 0
  const pickTier = (tierId: string, qty: number) =>
    setTierQty(Object.fromEntries(activity.priceTiers.map((tier) => [tier.id, tier.id === tierId ? qty : 0])))
  const shortDate = (key: string, offset: number) => {
    const date = fromDateKey(key)
    date.setDate(date.getDate() + offset)
    return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date)
  }

  const addMinutes = (hhmm: string, minutes: number) => {
    const [h, m] = hhmm.split(':').map(Number)
    const total = h * 60 + (m || 0) + minutes
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }
  const clock = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    const hour = ((h + 11) % 12) + 1
    return `${hour}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  }

  const optionButton = (tierId: string, label: string, price: string, note: string | undefined) => {
    const on = chosenTier?.id === tierId
    return (
      <button
        key={tierId}
        type="button"
        role="radio"
        aria-checked={on}
        onClick={() => pickTier(tierId, Math.max(1, kind === 'charter' ? 1 : chosenQty))}
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-200',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          on ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong',
        )}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">{label}</span>
          {note ? <span className="block truncate text-xs text-subtle">{note}</span> : null}
        </span>
        <span className="shrink-0 text-sm font-semibold text-foreground tabular">{price}</span>
      </button>
    )
  }

  const stepper = (value: number, min: number, max: number, onChange: (next: number) => void, label: string) => (
    <div className="flex items-center gap-2">
      <IconButton aria-label={`Fewer ${label}`} size="sm" variant="outline" disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus aria-hidden="true" />
      </IconButton>
      <span className="w-6 text-center text-sm font-semibold tabular" aria-live="polite">{value}</span>
      <IconButton aria-label={`More ${label}`} size="sm" variant="outline" disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus aria-hidden="true" />
      </IconButton>
    </div>
  )

  let kindBlock: React.ReactNode = null
  if (kind === 'rental') {
    const rental = activity.rental
    const units = rental?.units ?? activity.maxCapacity
    const deposit = rental?.damageDeposit ?? 0
    const lengthOf = (tierId: string) => rental?.durations.find((entry) => entry.tierId === tierId)?.minutes
    const rules = [
      rental?.licence && rental.licence !== 'none' ? `${LICENCE_LABEL[rental.licence]} needed${activity.minAge > 0 ? `, ${activity.minAge}+` : ''}` : null,
      rental?.seatsPerUnit ? `${rental.seatsPerUnit} ${rental.seatsPerUnit === 1 ? 'person' : 'people'} per ${rentalMeta.unit}` : null,
      rental?.fuel && rentalMeta.fuel ? FUEL_LABEL[rental.fuel] : null,
      rentalMeta.mileage ? (rental?.kmPerDay ? `${rental.kmPerDay} km a day included` : 'Unlimited km') : null,
    ].filter((entry): entry is string => Boolean(entry))
    kindBlock = (
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">
            {stepOf('guests')} · {dayRental ? `Your ${rentalMeta.unit} and days` : rated ? `Your ${rentalMeta.unit} and hours` : 'How long, and how many'}
          </h3>
          {slot ? (
            <span className={cn('text-xs font-medium tabular', seatsLeft <= 2 ? 'text-warning' : 'text-subtle')}>
              {seatsLeft} of {units} free{dayRental && rentDays > 1 ? ' every day' : ''}
            </span>
          ) : null}
        </div>
        {modes.length > 1 ? (
          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-surface-sunken p-1" role="radiogroup" aria-label="Rent by">
            {modes.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={rentalMode === mode}
                onClick={() => {
                  setRentalMode(mode)
                  // Keep a choice that has a price in the new mode.
                  if (chosenTier && rateFor(activity, chosenTier.id, mode) === undefined) {
                    const first = activity.priceTiers.find((tier) => rateFor(activity, tier.id, mode) !== undefined)
                    if (first) pickTier(first.id, Math.max(1, chosenQty))
                  }
                }}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                  rentalMode === mode ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground',
                )}
              >
                By the {mode}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-3 grid gap-2" role="radiogroup" aria-label={rated ? `What to rent` : dayRental ? 'Model' : 'Rental length'}>
          {activity.priceTiers
            .filter((tier) => !rated || rateFor(activity, tier.id, rentalMode) !== undefined)
            .map((tier) => {
              const minutes = lengthOf(tier.id)
              const price = rated ? (rateFor(activity, tier.id, rentalMode) ?? tier.price) : tier.price
              const note = tier.description || (!rated && !dayRental && minutes ? `${Math.round((minutes / 60) * 10) / 10} hours` : undefined)
              return optionButton(tier.id, tier.label, `${formatCurrency(Math.round(price * multiplier), currency)}${dayRental ? ' a day' : hourRental ? ' an hour' : ''}`, note || undefined)
            })}
        </div>
        {hourRental ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
            <span>
              <span className="block text-sm font-medium text-foreground">How many hours</span>
              <span className="block text-xs text-subtle">
                {slot ? `${formatTime(slot.startsAt)} to ${clock(addMinutes(slot.startsAt.slice(11, 16), rentHours * 60))}` : `${minHours} to ${maxHours} hours`}
              </span>
            </span>
            {stepper(rentHours, minHours, maxHours, setRentHours, 'hours')}
          </div>
        ) : null}
        {dayRental ? (
          <div className="mt-3 rounded-xl border border-line">
            <div className="flex items-center justify-between gap-3 px-3.5 py-3">
              <span>
                <span className="block text-sm font-medium text-foreground">How many days</span>
                <span className="block text-xs text-subtle">{minDays === maxDays ? `${minDays} days` : `${minDays} to ${maxDays} days`}</span>
              </span>
              {stepper(rentDays, minDays, maxDays, setRentDays, 'days')}
            </div>
            {dateKey ? (
              <dl className="grid grid-cols-2 gap-3 border-t border-line-subtle px-3.5 py-3 text-xs">
                <div>
                  <dt className="text-subtle">Pick up after</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{shortDate(dateKey, 0)} · {clock(rental?.pickupTime ?? '09:00')}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Return before</dt>
                  <dd className="mt-0.5 font-medium text-foreground">{shortDate(dateKey, rentDays)} · {clock(rental?.returnTime ?? '17:00')}</dd>
                </div>
              </dl>
            ) : null}
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
          <span>
            <span className="block text-sm font-medium text-foreground">How many {rentalMeta.units}</span>
            <span className="block text-xs text-subtle">Priced per {rentalMeta.unit}{dayRental ? ', per day' : hourRental ? ', per hour' : ''}</span>
          </span>
          {stepper(Math.max(1, chosenQty), 1, Math.max(1, seatsLeft), (next) => chosenTier && pickTier(chosenTier.id, next), rentalMeta.units)}
        </div>
        {overCapacity ? (
          <p className="mt-2 flex items-center gap-2 text-xs font-medium text-danger">
            <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
            Only {seatsLeft} free {dayRental && rentDays > 1 ? 'for all those days' : 'at this time'}.
          </p>
        ) : null}
        {rules.length > 0 ? (
          <ul className="mt-2 flex list-none flex-wrap gap-1.5 p-0">
            {rules.map((rule) => (
              <li key={rule} className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-muted">
                {rule}
              </li>
            ))}
          </ul>
        ) : null}
        {deposit > 0 ? (
          <p className="mt-2 text-xs text-subtle">A refundable {formatCurrency(deposit, currency)} deposit per {rentalMeta.unit} is held when you collect.</p>
        ) : null}
      </div>
    )
  } else if (kind === 'charter') {
    const maxGuests = activity.charter?.maxGuests ?? activity.maxCapacity
    kindBlock = (
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">{stepOf('guests')} · Your charter</h3>
          {slot ? <span className={cn('text-xs font-medium', seatsLeft > 0 ? 'text-success' : 'text-danger')}>{seatsLeft > 0 ? 'Available' : 'Booked'}</span> : null}
        </div>
        <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Charter option">
          {activity.priceTiers.map((tier) => {
            const minutes = activity.charter?.durations?.find((entry) => entry.tierId === tier.id)?.minutes
            const note = [minutes ? (minutes >= 1440 ? 'Full day' : `${Math.round((minutes / 60) * 10) / 10} hours`) : null, tier.description].filter(Boolean).join(' · ')
            return optionButton(tier.id, tier.label, formatCurrency(Math.round(tier.price * multiplier), currency), note || undefined)
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
          <span>
            <span className="block text-sm font-medium text-foreground">Guests in your group</span>
            <span className="block text-xs text-subtle">
              {activity.minParticipants > 1 ? `${activity.minParticipants} to ${maxGuests}` : `Up to ${maxGuests}`}; the price is for the whole group
            </span>
          </span>
          {stepper(party, Math.max(1, activity.minParticipants), maxGuests, setParty, 'guests')}
        </div>
        <ul className="mt-2 flex list-none flex-wrap gap-1.5 p-0">
          {[
            activity.charter?.crewed === false
              ? 'Self-skippered'
              : `${crewName(activity.charter)} included`,
            activity.charter?.noticeHours ? `Book ${activity.charter.noticeHours}h ahead` : null,
            (activity.languages ?? []).length > 0 ? (activity.languages ?? []).join(', ') : null,
          ]
            .filter((entry): entry is string => Boolean(entry))
            .map((entry) => (
              <li key={entry} className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-muted">
                {entry}
              </li>
            ))}
        </ul>
      </div>
    )
  }

  let kindNote: React.ReactNode = null
  if (kind === 'activity') {
    const limits = [
      activity.minAge > 0 ? `Ages ${activity.minAge}+` : null,
      activity.ride?.minHeightCm ? `at least ${activity.ride.minHeightCm} cm tall` : null,
      activity.ride?.maxWeightKg ? `up to ${activity.ride.maxWeightKg} kg` : null,
    ].filter(Boolean)
    kindNote = (
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-sunken/50 px-3.5 py-3">
        <Zap className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 text-xs text-muted">
          <p className="text-sm font-medium text-foreground">{formatDurationShort(activity.durationMinutes)} per slot · arrive 15 minutes early</p>
          {limits.length > 0 ? <p className="mt-1">Every rider: {limits.join(', ')}.</p> : null}
          {activity.route ? <p className="mt-1">{routeLabel(activity.route)}{activity.route.elevationM ? ` · ${activity.route.elevationM} m climb` : ''}</p> : null}
        </div>
      </div>
    )
  } else if (kind === 'trip' && activity.route) {
    kindNote = (
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-sunken/50 px-3.5 py-3">
        <RouteIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">
          {routeLabel(activity.route)}
          {activity.route.elevationM ? <span className="block text-xs font-normal text-muted">{activity.route.elevationM} m climb</span> : null}
        </p>
      </div>
    )
  }
  if (kindNote) {
    /* set above */
  } else if (kind === 'lesson' && activity.lesson) {
    const { sessions, ratio, level, certification } = activity.lesson
    kindNote = (
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-sunken/50 px-3.5 py-3">
        <GraduationCap className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 text-xs text-muted">
          <p className="text-sm font-medium text-foreground">
            {sessions > 1 ? `${sessions}-session course` : 'Single lesson'} · {LESSON_LEVELS.find((entry) => entry.value === level)?.label} · {ratio} per instructor
          </p>
          {sessions > 1 && dateKey ? (
            <p className="mt-1">Sessions {Array.from({ length: sessions }, (_, index) => shortDate(dateKey, index)).join(', ')}, same time each day.</p>
          ) : null}
          {certification ? <p className="mt-1">Leads to {certification}.</p> : null}
          {activity.lesson.equipmentIncluded ? <p className="mt-1">All equipment included.</p> : null}
          {(activity.languages ?? []).length > 0 ? <p className="mt-1">Taught in {(activity.languages ?? []).join(', ')}.</p> : null}
        </div>
      </div>
    )
  } else if (kind === 'pass') {
    const days = activity.pass?.validDays ?? 1
    kindNote = (
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-sunken/50 px-3.5 py-3">
        <Ticket className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-xs text-muted">
          <span className="block text-sm font-medium text-foreground">{days > 1 ? `Valid ${days} days` : 'Valid all day'}{dateKey ? ` from ${shortDate(dateKey, 0)}` : ''}</span>
          {activity.pass?.reentry ? 'Come and go as you like.' : 'Single entry.'}
        </p>
      </div>
    )
  }

  const shell =
    variant === 'rail'
      ? 'rounded-2xl border border-line bg-surface shadow-xl'
      : 'rounded-none border-0 bg-transparent shadow-none'

  return (
    <section
      aria-label={`Book ${activity.name}`}
      className={cn('flex flex-col overflow-hidden', shell, className)}
    >
      {/* ---------- price header ---------- */}
      <header
        className={cn(
          'flex items-end justify-between gap-4 border-b border-line-subtle px-5 py-4',
          variant === 'rail' &&
            'bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_9%,var(--surface)),var(--surface))]',
        )}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">
            From
          </p>
          <p className="mt-0.5 font-display text-2xl font-semibold tabular tracking-tight text-foreground">
            {formatCurrency(fromPrice, currency)}
            <span className="ml-1.5 text-xs font-medium text-subtle">{kind === 'rental' ? `per ${rentalMeta.unit}${dayRental ? ' a day' : rated ? ' an hour' : ''}` : kind === 'charter' ? 'per group' : kind === 'pass' ? 'per ticket' : 'per person'}</span>
          </p>
        </div>
        {slot && slot.priceMultiplier > 1 ? (
          <SimpleTooltip label="This departure is in high demand, so pricing has stepped up.">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
              <Sparkles className="size-3" aria-hidden="true" />
              Peak time
            </span>
          </SimpleTooltip>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Free cancellation
          </span>
        )}
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        {/* ---------- location ---------- */}
        {multiSite ? (
          <div>
            <h3 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">1 · Choose a location</h3>
            <div className="mt-3 grid gap-2" role="radiogroup" aria-label="Location">
              {sites.map((site) => {
                const on = site.locationId === locationId
                const runs = allDays.reduce(
                  (total, day) => total + day.slots.filter((slot) => slot.locationId === site.locationId && !slot.soldOut).length,
                  0,
                )
                return (
                  <button
                    key={site.locationId}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setLocationId(site.locationId)}
                    className={cn(
                      'flex w-full min-w-0 items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-200',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      on ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong',
                    )}
                  >
                    <MapPin className={cn('mt-0.5 size-4 shrink-0', on ? 'text-primary' : 'text-faint')} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-foreground">{site.location.name}</span>
                      <span className="block truncate text-xs text-subtle">{locationAddress(site.location)}</span>
                    </span>
                    <span className="shrink-0 pt-0.5 text-xs text-subtle tabular-nums">
                      {runs} {pluralize(runs, activity.format === 'open' ? 'slot' : 'departure')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* ---------- date strip ---------- */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">
              {stepOf('date')} · {dayRental ? 'Choose a pick-up day' : kind === 'pass' ? 'Choose a day' : kind === 'lesson' && (activity.lesson?.sessions ?? 1) > 1 ? 'Choose a start date' : 'Choose a date'}
            </h3>
            <div className="flex items-center gap-1">
              <IconButton
                aria-label="Earlier dates"
                size="xs"
                variant="ghost"
                onClick={() => scrollStrip(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </IconButton>
              <IconButton
                aria-label="Later dates"
                size="xs"
                variant="ghost"
                onClick={() => scrollStrip(1)}
              >
                <ChevronRight aria-hidden="true" />
              </IconButton>
            </div>
          </div>

          <div
            ref={stripRef}
            className="no-scrollbar -mx-1 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-1 pb-1"
            role="group"
            aria-label="Available dates"
          >
            {days.map((entry) => (
              <DateChip
                key={entry.dateKey}
                day={entry}
                currency={currency}
                selected={entry.dateKey === dateKey}
                onSelect={() => setDateKey(entry.dateKey)}
                emptyLabel={kind === 'trip' ? 'No trips' : kind === 'lesson' ? 'No class' : kind === 'activity' ? 'No slots' : 'Closed'}
              />
            ))}
          </div>
        </div>

        {kindNote}

        {/* ---------- time slots ---------- */}
        {showTime ? (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">
              {stepOf('time')} · {kind === 'activity' ? 'Choose a time slot' : kind === 'rental' ? 'Choose a start time' : activity.format === 'open' ? 'Choose an arrival time' : 'Choose a time'}
            </h3>
            {day && day.slots.length > 0 ? (
              <span className="text-xs text-subtle">
                {day.slots.length} {pluralize(day.slots.length, kind === 'activity' ? 'time slot' : kind === 'rental' ? 'start time' : kind === 'lesson' ? 'class' : kind === 'charter' ? 'charter' : activity.format === 'open' ? 'arrival slot' : activity.format === 'dates' ? 'time' : 'departure')}
              </span>
            ) : null}
          </div>

          {day && day.slots.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {day.slots.map((entry) => (
                <TimeChip
                  key={entry.departureId}
                  slot={entry}
                  wholeGroup={kind === 'charter'}
                  noun={kind === 'rental' ? rentalMeta.units : kind === 'lesson' || kind === 'activity' ? 'places' : 'seats'}
                  selected={entry.departureId === departureId}
                  onSelect={() => setDepartureId(entry.departureId)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-line-strong bg-surface-sunken px-4 py-5 text-center text-sm text-muted">
              Nothing scheduled on this date. Pick another day, or call us and we will look at
              putting a private departure on.
            </p>
          )}
        </div>
        ) : null}

        {/* ---------- tickets ---------- */}
        {kindBlock ?? (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">
              {stepOf('guests')} · Who is coming
            </h3>
            {slot ? (
              <span
                className={cn(
                  'text-xs font-medium tabular',
                  seatsLeft <= 4 ? 'text-warning' : 'text-subtle',
                )}
              >
                {seatsLeft} {pluralize(seatsLeft, kind === 'activity' || kind === 'lesson' ? 'place' : 'seat')} left
              </span>
            ) : null}
          </div>

          <div className="mt-3 divide-y divide-line-subtle rounded-xl border border-line">
            {activity.priceTiers.map((tier) => {
              const qty = tierQty[tier.id] ?? 0
              const unit = Math.round(tier.price * (slot?.priceMultiplier ?? 1))
              const seatRoom = tier.countsTowardCapacity
                ? seatsLeft - (seatsUsed - qty)
                : tier.maxQuantity
              const max = Math.min(tier.maxQuantity, Math.max(0, seatRoom))

              return (
                <div key={tier.id} className="flex items-center gap-3 px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{tier.label}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
                      <span className="tabular font-medium text-muted">
                        {formatCurrency(unit, currency)}
                      </span>
                      {tier.description ? <span className="truncate">· {tier.description}</span> : null}
                      {!tier.countsTowardCapacity ? (
                        <span className="text-faint">· does not use a seat</span>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <IconButton
                      aria-label={`Remove one ${tier.label}`}
                      size="xs"
                      variant="outline"
                      shape="circle"
                      disabled={qty <= tier.minQuantity}
                      onClick={() =>
                        setTierQty((prev) => ({
                          ...prev,
                          [tier.id]: Math.max(tier.minQuantity, (prev[tier.id] ?? 0) - 1),
                        }))
                      }
                    >
                      <Minus aria-hidden="true" />
                    </IconButton>
                    <span
                      className={cn(
                        'w-7 text-center text-sm font-semibold tabular',
                        qty === 0 ? 'text-faint' : 'text-foreground',
                      )}
                    >
                      {qty}
                    </span>
                    <IconButton
                      aria-label={`Add one ${tier.label}`}
                      size="xs"
                      variant="outline"
                      shape="circle"
                      disabled={qty >= max}
                      onClick={() =>
                        setTierQty((prev) => ({
                          ...prev,
                          [tier.id]: Math.min(max, (prev[tier.id] ?? 0) + 1),
                        }))
                      }
                    >
                      <Plus aria-hidden="true" />
                    </IconButton>
                  </div>
                </div>
              )
            })}
          </div>

          <AnimatePresence initial={false}>
            {overCapacity ? (
              <motion.p
                initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 flex items-center gap-2 overflow-hidden text-xs font-medium text-danger"
              >
                <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                Only {seatsLeft} {pluralize(seatsLeft, kind === 'activity' || kind === 'lesson' ? 'place' : 'seat')} left {kind === 'activity' ? 'in this time slot' : 'on this departure'}.
              </motion.p>
            ) : null}
          </AnimatePresence>

          {activity.priceTiers.some((tier) => tier.minQuantity > 0) ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-subtle">
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
              Every booking includes at least {activity.priceTiers.filter((tier) => tier.minQuantity > 0).map((tier) => `${tier.minQuantity} ${tier.label}`).join(' and ')}.
            </p>
          ) : null}
          {activity.minParticipants > 1 ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-subtle">
              <Users className="size-3.5 shrink-0" aria-hidden="true" />
              Minimum {activity.minParticipants} guests for this experience.
            </p>
          ) : null}
        </div>
        )}

        {/* ---------- add-ons ---------- */}
        {activity.addOns.length > 0 ? (
          <div>
            <h3 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">
              {stepOf('extras')} · Make it better
            </h3>
            <div className="mt-3 space-y-2">
              {activity.addOns.map((addOn) => {
                const checked = Boolean(addOnOn[addOn.id])
                const qty = clamp(
                  Math.max(1, headcount),
                  1,
                  addOn.maxPerBooking ?? Math.max(1, headcount),
                )
                const id = `addon-${addOn.id}`
                return (
                  <label
                    key={addOn.id}
                    htmlFor={id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-all duration-200 ease-[var(--ease-out-expo)]',
                      checked
                        ? 'border-primary bg-primary-soft/60 shadow-xs'
                        : 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(value) =>
                        setAddOnOn((prev) => ({ ...prev, [addOn.id]: value === true }))
                      }
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">{addOn.label}</span>
                        <span className="shrink-0 text-sm font-semibold tabular text-foreground">
                          {formatCurrency(addOn.price, currency)}
                          {checked && qty > 1 ? (
                            <span className="ml-1 text-xs font-medium text-subtle">× {qty}</span>
                          ) : null}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-subtle">
                        {addOn.description}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* ---------- breakdown ---------- */}
        <div className="rounded-xl bg-surface-sunken p-4">
          <ul className="space-y-2 text-sm">
            <AnimatePresence initial={false} mode="popLayout">
              {[...quote.ticketLines, ...quote.addOnLines].map((line) => (
                <motion.li
                  key={line.id}
                  layout={!reducedMotion}
                  initial={reducedMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="min-w-0 truncate text-muted">
                    {line.label}
                    <span className="ml-1.5 text-xs text-faint">
                      {line.quantity} × {formatCurrency(line.unitPrice, currency)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular font-medium text-foreground">
                    {formatCurrency(line.total, currency)}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>

            {quote.ticketLines.length === 0 ? (
              <li className="text-sm text-subtle">Add a guest to see your total.</li>
            ) : null}
          </ul>

          <div className="mt-3 space-y-2 border-t border-line pt-3 text-xs">
            <div className="flex items-baseline justify-between gap-3 text-muted">
              <span className="inline-flex items-center gap-1.5">
                {quote.feeLabel}
                <SimpleTooltip label="Covers card processing, ticketing and the harbour or site access levy.">
                  <button
                    type="button"
                    aria-label="What is this fee?"
                    className="inline-grid place-items-center rounded-full text-faint transition-colors hover:text-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Info className="size-3" aria-hidden="true" />
                  </button>
                </SimpleTooltip>
              </span>
              <span className="tabular">{formatCurrency(quote.feeTotal, currency)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-muted">
              <span>{quote.taxLabel}</span>
              <span className="tabular">{formatCurrency(quote.taxTotal, currency)}</span>
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between gap-3 border-t border-line pt-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">
                Total
              </p>
              <p className="text-xs text-subtle">
                {quote.countLabel}{dayRental ? ` · ${rentDays} ${pluralize(rentDays, 'day')}` : hourRental ? ` · ${rentHours} ${pluralize(rentHours, 'hour')}` : ''} · all taxes included
              </p>
            </div>
            <AnimatedTotal value={quote.total} currency={currency} reducedMotion={reducedMotion} />
          </div>
        </div>

        {ruleResult.applied.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" aria-label="Price adjustments">
            {ruleResult.applied.map((rule) => (
              <span key={rule.id} className={cn('rounded-full px-2.5 py-1 text-xs font-medium', rule.percent < 0 ? 'bg-success-soft text-success' : 'bg-surface-sunken text-muted')}>
                {rule.name} {rule.percent > 0 ? `+${rule.percent}%` : `${rule.percent}%`}
              </span>
            ))}
          </div>
        ) : null}

        {/* ---------- reserve ---------- */}
        <div className="space-y-3">
          {requestSent ? (
            <div role="status" className="rounded-xl border border-success/40 bg-success-soft px-4 py-3.5 text-sm">
              <p className="flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                Request sent
              </p>
              <p className="mt-1 text-muted">
                We reply within a few hours with a quote and a payment link to {request.email || 'your email'}.
              </p>
            </div>
          ) : requestOpen ? (
            <form
              className="flex flex-col gap-2.5 rounded-xl border border-line p-3.5"
              onSubmit={(event) => {
                event.preventDefault()
                if (!slot || request.name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(request.email)) return
                try {
                  const key = `ezra:charter-requests:${tenantSlug}`
                  const list = JSON.parse(window.localStorage.getItem(key) ?? '[]') as unknown[]
                  list.unshift({
                    id: `req_${Date.now().toString(36)}`,
                    activitySlug: activity.slug,
                    departureId: slot.departureId,
                    startsAt: slot.startsAt,
                    tierId: selection.tiers.find((tier) => tier.qty > 0)?.tierId,
                    party,
                    ...request,
                    createdAt: new Date().toISOString(),
                  })
                  window.localStorage.setItem(key, JSON.stringify(list.slice(0, 50)))
                } catch {
                  /* storage blocked: the request still shows as sent */
                }
                setRequestSent(true)
              }}
            >
              <p className="text-sm font-semibold text-foreground">Tell us about your group</p>
              <Input placeholder="Your name" aria-label="Your name" value={request.name} onChange={(e) => setRequest((r) => ({ ...r, name: e.target.value }))} />
              <Input type="email" placeholder="Email" aria-label="Email" value={request.email} onChange={(e) => setRequest((r) => ({ ...r, email: e.target.value }))} />
              <Textarea rows={3} placeholder="The occasion, the plan, catering or anything else" aria-label="Your plan" value={request.message} onChange={(e) => setRequest((r) => ({ ...r, message: e.target.value }))} />
              <Button type="submit" size="lg" fullWidth disabled={!slot || request.name.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(request.email)}>
                Send request
              </Button>
            </form>
          ) : (
          <Button
            size="lg"
            fullWidth
            onClick={requestMode ? () => setRequestOpen(true) : reserve}
            disabled={!canReserve}
            className="h-12 text-[0.9375rem]"
          >
            {!slot ? (kind === 'rental' ? 'Choose a start time' : 'Choose a departure') : requestMode ? 'Request a quote' : kind === 'rental' ? 'Rent now' : 'Reserve now'}
          </Button>
          )}
          {!requestMode && !requestOpen && !requestSent ? (
            <button type="button" onClick={() => setRequestOpen(true)} className="w-full text-center text-sm font-medium text-primary hover:underline">
              Planning something bigger? Ask for a custom quote
            </button>
          ) : null}
          <TrustSeal freeCancellationHours={activity.cancellationPolicy.freeCancellationHours} />
          <p className="text-center text-xs text-faint">
            You will not be charged until the final step.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ==========================================================================
   PARTS
   ========================================================================== */

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function DateChip({
  day,
  currency,
  selected,
  onSelect,
  emptyLabel = 'No trips',
}: {
  emptyLabel?: string
  day: AvailabilityDay
  currency: CurrencyCode
  selected: boolean
  onSelect: () => void
}) {
  const date = fromDateKey(day.dateKey)
  const unavailable = day.slots.length === 0 || day.soldOut

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={unavailable}
      aria-pressed={selected}
      className={cn(
        'group flex w-[4.75rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5',
        'transition-all duration-200 ease-[var(--ease-out-expo)]',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected
          ? 'border-primary bg-primary text-on-primary shadow-md'
          : unavailable
            ? 'cursor-not-allowed border-line-subtle bg-surface-sunken text-faint'
            : 'border-line bg-surface text-foreground hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm',
      )}
    >
      <span
        className={cn(
          'text-xs font-semibold uppercase tracking-[0.1em]',
          selected ? 'text-on-primary/75' : unavailable ? 'text-faint' : 'text-subtle',
        )}
      >
        {WEEKDAY[date.getDay()]}
      </span>
      <span className="font-display text-lg font-semibold leading-none tabular">
        {date.getDate()}
      </span>
      <span
        className={cn(
          'text-xs font-medium',
          selected ? 'text-on-primary/70' : 'text-faint',
        )}
      >
        {MONTH[date.getMonth()]}
      </span>
      <span
        className={cn(
          'mt-1 w-full truncate rounded-md px-1 py-0.5 text-center text-xs font-semibold tabular',
          selected
            ? 'bg-white/18 text-on-primary'
            : unavailable
              ? 'text-faint'
              : 'bg-surface-sunken text-muted',
        )}
      >
        {day.slots.length === 0
          ? emptyLabel
          : day.soldOut
            ? 'Sold out'
            : formatCurrency(day.fromPrice, currency, { compact: true })}
      </span>
    </button>
  )
}

function TimeChip({
  slot,
  noun = 'seats',
  wholeGroup = false,
  selected,
  onSelect,
}: {
  /** A private charter sells once: say Available, not a seat count. */
  wholeGroup?: boolean
  /** What the count is of: seats, bikes, places. */
  noun?: string
  slot: AvailabilitySlot
  selected: boolean
  onSelect: () => void
}) {
  const urgent = !wholeGroup && !slot.soldOut && slot.seatsLeft <= 3
  const filling = !slot.soldOut && !urgent && slot.seatsLeft <= 6

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={slot.soldOut}
      aria-pressed={selected}
      className={cn(
        'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left',
        'transition-all duration-200 ease-[var(--ease-out-expo)]',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected
          ? 'border-primary bg-primary text-on-primary shadow-md'
          : slot.soldOut
            ? 'cursor-not-allowed border-line-subtle bg-surface-sunken text-faint line-through decoration-line-strong'
            : 'border-line bg-surface text-foreground hover:border-primary/50 hover:shadow-sm',
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular">
        <Clock
          className={cn('size-3.5', selected ? 'text-on-primary/70' : 'text-faint')}
          aria-hidden="true"
        />
        {formatTime(slot.startsAt)}
      </span>
      <span
        className={cn(
          'text-xs font-medium',
          selected
            ? 'text-on-primary/75'
            : slot.soldOut
              ? 'text-faint no-underline'
              : urgent
                ? 'text-danger'
                : filling
                  ? 'text-warning'
                  : 'text-subtle',
        )}
      >
        {slot.soldOut
          ? 'Sold out'
          : urgent
            ? wholeGroup ? 'Available' : `Only ${slot.seatsLeft} left`
            : wholeGroup ? 'Available' : `${slot.seatsLeft} ${noun}`}
      </span>
    </button>
  )
}

function AnimatedTotal({
  value,
  currency,
  reducedMotion,
}: {
  value: number
  currency: CurrencyCode
  reducedMotion: boolean
}) {
  return (
    <span className="relative block overflow-hidden text-right">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={reducedMotion ? false : { y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reducedMotion ? undefined : { y: -14, opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="block font-display text-2xl font-semibold tabular tracking-tight text-foreground"
        >
          {formatCurrency(value, currency, { decimals: true })}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/** "90 min", "2h", "2h 30m". */
function formatDurationShort(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
