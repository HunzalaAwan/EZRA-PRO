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
import type { Activity, CurrencyCode, DepartureStatus, Location, PriceTier, VerticalKey } from '@/types'
import { Switch } from '@/components/ui/switch'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { withBookingDefaults } from '@/lib/booking-defaults'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { hasItems, rentalItemsOf } from '@/lib/rental-items'
import { bookingOf, groupUnit, showsSchedule } from '@/lib/booking-method'
import { EnquiryPanel, RequestForm, type RequestContext } from '@/components/storefront/booking-request'
import type { BookingSettings } from '@/types'
import { useRentalService } from '@/hooks/use-rental-service'
import { priceUnit } from '@/lib/activity-kinds'
import { LESSON_LEVELS, isDayRental, partyLabel, rateFor, rentalCategoryMeta, rentalModes, routeLabel, type RentalMode } from '@/lib/activity-kinds'
import { bodyLimitLines } from '@/lib/guest-requirements'
import type { PricingRule } from '@/lib/pricing'
import {
  chargeByOf,
  extraSpotPrice,
  extraSpotWords,
  fromPrice,
  groupPriced,
  guestLimitOf,
  groupTierOf,
  leadPrice,
  priceBooking,
  privatePerPerson,
  unitPriceDetail,
  usualSpotsLeft,
  type AppliedChange,
  type PriceContext,
  type RentalPricing,
} from '@/lib/price-engine'
import { forSlot, slotExtraSpotsOf, usualSpotsOf } from '@/lib/extra-spots'
import { useActivityOverrides, usePricingOverride } from '@/hooks/use-pricing-override'
import { useLocations } from '@/hooks/use-locations'
import { applyScheduleOverride } from '@/lib/activity-overrides'
import { usePricing } from '@/hooks/use-pricing'
import { IconButton } from '@/components/ui/icon-button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { TrustSeal } from '@/components/storefront/trust-bar'
import { locationAddress } from '@/lib/locations'
import { useBookingLedger } from '@/hooks/use-booking-ledger'
import { addOnPer, addOnUnits, peopleOf, placesOf } from '@/lib/places'
import { withLedger } from '@/lib/booking-ledger'
import { useScheduledDays } from '@/hooks/use-scheduled-days'
import { bookedOn } from '@/components/storefront/checkout-selection'
import type { PackagePartView } from '@/lib/packages'
import { PackageWidget } from '@/components/storefront/package-widget'

/* ==========================================================================
   AVAILABILITY CONTRACT

   The server flattens `getStorefrontAvailability()` into these plain shapes so
   the widget never pulls the demo module — and therefore the 4,800-line data
   seam — into the client bundle.
   ========================================================================== */

export interface AvailabilitySlot {
  /** Rentals with items: how many of each are still free at this time. */
  itemsLeft?: Record<string, number>
  departureId: string
  /** Local ISO, "YYYY-MM-DDTHH:mm:ss". */
  startsAt: string
  endsAt: string
  capacity: number
  seatsLeft: number
  /** Spots booked on the server, without carts in progress or the daily limit. Absent: capacity minus seats left. */
  booked?: number
  status: DepartureStatus
  /** Dynamic-pricing multiplier for this departure; 1 when none applies. */
  priceMultiplier: number
  /** Lead-tier price after the multiplier, minor units. */
  leadPrice: number
  /** Its day's own extra spots (a weekday's or a date's; a private group: guests over its size). Absent: the activity's. */
  extraSpots?: number
  /** A private group's size that day, when its weekday or date has its own. Absent: the activity's. */
  groupSize?: number
  /** The location this run leaves from; absent on single-site businesses. */
  locationId?: string
  soldOut: boolean
  /** Booked, but no longer on the saved schedule: it runs for its guests and takes no new bookings. */
  outsideSchedule?: boolean
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
  /** Tickets: the price before any change, for the same span. */
  baseUnitPrice?: number
  /** Tickets: what moved the price, "Summer +15%". */
  applied?: string[]
  /** A group price line: the owner's description, "Up to 6 guests, gear included", or a private group's option note. */
  note?: string
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
  /** Length rentals: the length picked, in words. */
  lengthLabel?: string
  /** What the price caps took off, minor units. 0 when no cap was reached. */
  capped: number
  /** People on the booking: the charter group, or the headcount. */
  party: number
  /** "2 jet skis", "6 guests": what the booking is counted in. */
  countLabel: string
  /** Every change that moved a ticket price: the activity's own, group discounts, business rules, dynamic pricing. */
  appliedChanges: AppliedChange[]
}

export interface QuoteOptions {
  /** Day rentals: every tier is priced per day. */
  days?: number
  /** Charters: the group size, which the per-group price does not count. */
  party?: number
  /** Rentals with rates: priced per hour, per day or per set length. */
  rentalMode?: RentalMode
  hours?: number
  /** Length rentals: which length was picked. */
  lengthId?: string
  /** The private option: one price for the group, the whole time to themselves. */
  private?: boolean
  /** The time slot's start: dates, seasons and demand changes price from it. */
  startsAt?: string
  /** The demo clock: book early and last minute count from it. */
  nowIso?: string
  /** Spots at the time slot and how many are already taken, for filling up and quiet times. */
  capacity?: number
  booked?: number
  /** The business's price rules (Pricing → Price rules), applied after the activity's own changes. */
  businessRules?: PricingRule[]
}

/**
 * Deterministic, integer-only money maths — minor units in, minor units out.
 * Tickets come from the price engine (`@/lib/price-engine`): the activity's
 * own price changes, group discounts, the time slot's dynamic pricing
 * (`priceMultiplier`, nothing else) and `options.businessRules`, then the
 * price cap and the minimum charge. Extras, the booking fee and card
 * processing are added here.
 */
export function buildQuote(
  activity: Activity,
  tenantSlug: string,
  selection: QuoteSelection,
  priceMultiplier = 1,
  options: QuoteOptions = {},
): Quote {
  const days = Math.max(1, Math.floor(options.days ?? 1))
  const tax = TAX_BY_TENANT[tenantSlug] ?? PROCESSING_FEE
  const priced = priceBooking({
    activity,
    lines: selection.tiers,
    startsAt: options.startsAt,
    nowIso: options.nowIso,
    capacity: options.capacity,
    booked: options.booked,
    priceMultiplier,
    businessRules: options.businessRules,
    private: options.private,
    party: options.party,
    rental: { mode: options.rentalMode, hours: options.hours, days, lengthId: options.lengthId },
  })
  // The description the owner wrote for a group price: the shared group price's, or a private group's option's.
  const optionsPriced = (activity.kind ?? 'trip') === 'charter' && !privatePerPerson(activity)
  const noteOf = (line: (typeof priced.ticketLines)[number]) =>
    (line.id === 'group' ? activity.groupPrice?.note : optionsPriced && line.tierId ? activity.priceTiers.find((tier) => tier.id === line.tierId)?.description : undefined)?.trim()
  const ticketLines: QuoteLine[] = [
    ...priced.ticketLines.map((line) => {
      const note = noteOf(line)
      return {
        id: line.id,
        label: line.label,
        kind: 'ticket' as const,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        total: line.total,
        baseUnitPrice: line.baseUnitPrice,
        // The time slot's dynamic pricing shows as "Peak time", not on the line.
        applied: line.applied.filter((change) => change.source !== 'dynamic').map((change) => change.label),
        ...(note ? { note } : {}),
      }
    }),
    // The price cap (negative) and the minimum charge (positive).
    ...priced.adjustments.map((entry) => ({ id: entry.id, label: entry.label, kind: 'ticket' as const, quantity: 1, unitPrice: entry.amount, total: entry.amount })),
  ]
  let subtotal = priced.subtotalTickets

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
    seats: priced.seats,
    headcount: priced.headcount,
    days,
    ...(options.rentalMode === 'hour' ? { hours: Math.max(1, Math.floor(options.hours ?? 1)) } : {}),
    ...(options.rentalMode === 'length'
      ? (() => {
          const length = activity.rental?.lengths?.find((entry) => entry.id === options.lengthId)
          return length ? { hours: length.hours, lengthLabel: length.label } : {}
        })()
      : {}),
    capped: priced.capped,
    // People on the booking: a charter's party, or the headcount.
    party: priced.guests,
    countLabel: partyLabel(activity, priced.guests),
    appliedChanges: priced.appliedChanges,
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
   THE STRIP AS GUESTS SEE IT — shared by the widget and the activity page,
   so the "From" price, the next start time and the time slots agree.
   ========================================================================== */

/**
 * The day strip with the schedule the owner saved (seasons, changes, closed
 * days) laid over the seeded days, then this browser's bookings, moves and
 * cancellations. Pass the activity as the server sent it.
 */
export function useStorefrontDays(activity: Activity, seededDays: AvailabilityDay[], opts: { tenantSlug: string; nowIso?: string }): AvailabilityDay[] {
  const ledger = useBookingLedger(opts.tenantSlug)
  const scheduledDays = useScheduledDays(activity, seededDays, { tenantSlug: opts.tenantSlug, nowIso: opts.nowIso, delta: ledger.delta })
  return React.useMemo(
    () =>
      scheduledDays.map((day) => {
        if (!day.slots.some((slot) => ledger.delta[slot.departureId])) return day
        // A time slot off the schedule stays closed, even when a booking on it is cancelled or moved here.
        const slots = day.slots.map((slot) => (slot.outsideSchedule ? slot : withLedger(slot, ledger.delta)))
        const open = slots.filter((slot) => !slot.soldOut)
        return { ...day, slots, seatsLeft: open.reduce((sum, slot) => sum + slot.seatsLeft, 0), soldOut: slots.length > 0 && open.length === 0 }
      }),
    [scheduledDays, ledger.delta],
  )
}

/** The rental mode and length the strip is priced in; the first the activity offers when none is picked. Undefined without rates. */
export function stripRentalOf(activity: Activity, rentalMode?: RentalMode, lengthId?: string): RentalPricing | undefined {
  const modes = rentalModes(activity)
  if ((activity.kind ?? 'trip') !== 'rental' || modes.length === 0 || (activity.rental?.rates?.length ?? 0) === 0) return undefined
  const mode = rentalMode ?? modes[0]
  const lengths = activity.rental?.lengths ?? []
  const length = lengths.find((entry) => entry.id === lengthId) ?? lengths[0]
  return { mode, lengthId: mode === 'length' ? length?.id : undefined }
}

/**
 * Each time slot priced by the engine (saved prices, price changes, business
 * rules), with the day totals worked out again. `locationId`: only that
 * location's time slots. `delta`: this browser's bookings (the ledger), so
 * filling-up and quiet-time prices count them as checkout does.
 */
export function priceStripDays(
  activity: Activity,
  days: AvailabilityDay[],
  ctx: { nowIso?: string; businessRules?: PricingRule[]; rental?: RentalPricing; locationId?: string; delta?: Record<string, number> },
): AvailabilityDay[] {
  return days.map((day) => {
    const slots = (ctx.locationId !== undefined ? day.slots.filter((slot) => !slot.locationId || slot.locationId === ctx.locationId) : day.slots).map((slot) => ({
      ...slot,
      // Its day's own extra spots decide when filling-up prices start, as on the time slot itself.
      leadPrice: leadPrice(forSlot(activity, slot), {
        startsAt: slot.startsAt,
        nowIso: ctx.nowIso,
        capacity: slot.capacity,
        booked: bookedOn(slot, ctx.delta),
        priceMultiplier: slot.priceMultiplier,
        businessRules: ctx.businessRules,
        rental: ctx.rental,
      }),
    }))
    const open = slots.filter((slot) => !slot.soldOut)
    return {
      ...day,
      slots,
      fromPrice: open.length > 0 ? Math.min(...open.map((slot) => slot.leadPrice)) : 0,
      seatsLeft: open.reduce((total, slot) => total + slot.seatsLeft, 0),
      soldOut: slots.length > 0 && open.length === 0,
    }
  })
}

/** "From": the plain from price (lowest tier, or a rental's rate in this mode and length), or a cheaper open day in a priced strip. */
export function shownFromPrice(activity: Activity, pricedDays: AvailabilityDay[], rental?: RentalPricing): number {
  const plain = rental?.mode === 'length' && rental.lengthId ? leadPrice(activity, { rental: { mode: 'length', lengthId: rental.lengthId } }) : fromPrice(activity, rental?.mode)
  const open = pricedDays.filter((day) => !day.soldOut && day.slots.length > 0).map((day) => day.fromPrice).filter((price) => price > 0)
  return Math.min(plain || activity.basePrice, ...open)
}

/** What the "From" price is for: "per person", "per group", "per kayak an hour". */
export function fromUnitLabel(activity: Activity, rentalMode?: RentalMode, lengthId?: string): string {
  const kind = activity.kind ?? 'trip'
  if (kind === 'rental') {
    const modes = rentalModes(activity)
    const rental = stripRentalOf(activity, rentalMode, lengthId)
    const day = modes.length > 0 ? (rentalMode ?? modes[0]) === 'day' : isDayRental(activity)
    const length = rental?.mode === 'length' ? activity.rental?.lengths?.find((entry) => entry.id === rental.lengthId) : undefined
    const suffix = day ? ' a day' : rental?.mode === 'hour' ? ' an hour' : length ? ` · ${length.label.toLowerCase()}` : ''
    return `per ${rentalCategoryMeta(activity.rental?.category).unit}${suffix}`
  }
  // A private group's options are each a price for the group; priced per person, its tickets are per guest.
  if ((kind === 'charter' && !privatePerPerson(activity)) || groupPriced(activity)) return 'per group'
  return kind === 'pass' ? 'per ticket' : 'per person'
}

const NO_LOCATIONS: Location[] = []

/**
 * The places an activity runs from as the owner saved them, each with its
 * business location (Settings → Locations edits included). Only places with
 * a known location are listed.
 */
export function useActivitySites(activity: Activity, locations: Location[] = NO_LOCATIONS) {
  const overrides = useActivityOverrides()
  const runsFrom = applyScheduleOverride(activity, overrides[activity.id]).locations
  const { locations: live } = useLocations(activity.tenantId, locations)
  return React.useMemo(
    () =>
      runsFrom
        .map((site) => ({ ...site, location: live.find((entry) => entry.id === site.locationId) }))
        .filter((site): site is typeof site & { location: Location } => Boolean(site.location)),
    [runsFrom, live],
  )
}

/* ==========================================================================
   <BookingWidget>
   ========================================================================== */

export interface BookingWidgetProps {
  /** As the server sent it: the saved edit's prices and schedule are laid over it here, once. */
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
  /** For call to book, and the call line under requests. */
  businessPhone?: string
  /** Packages: each part with its own availability. */
  packageParts?: PackagePartView[]
}

/**
 * Picks the panel for how the activity is booked: the date and time picker
 * for instant booking and request to book on a schedule, or a call and
 * request panel when it is booked by phone or has no set schedule.
 */
export function BookingWidget(rawProps: BookingWidgetProps) {
  // The schedule the owner saved (seasons, changes, closed days) over the seeded time slots,
  // and the bookings, moves and cancellations made in this browser.
  const days = useStorefrontDays(rawProps.activity, rawProps.days, { tenantSlug: rawProps.tenantSlug, nowIso: rawProps.nowIso })
  const { defaults } = useBookingDefaults(rawProps.tenantSlug)
  // Prices saved in the editor (tier prices, rates, price changes) count here and at checkout alike.
  const priced = usePricingOverride(rawProps.activity)
  const activity = React.useMemo(() => withBookingDefaults(priced, defaults), [priced, defaults])
  const props = { ...rawProps, days, activity }
  if (props.activity.kind === 'package') {
    return (
      <PackageWidget
        activity={props.activity}
        tenantSlug={props.tenantSlug}
        currency={props.currency}
        parts={props.packageParts ?? []}
        checkoutPath={props.checkoutPath}
        initialDateKey={props.initialDateKey}
        initialGuests={props.initialGuests}
        nowIso={props.nowIso}
        variant={props.variant}
        className={props.className}
      />
    )
  }
  const settings = bookingOf(props.activity)
  if (!showsSchedule(settings)) {
    const today = (props.nowIso ?? new Date().toISOString()).slice(0, 10)
    return (
      <EnquiryPanel
        activity={props.activity}
        tenantSlug={props.tenantSlug}
        currency={props.currency}
        settings={settings}
        businessPhone={props.businessPhone ?? ''}
        minDate={today}
        priceUnit={priceUnit(props.activity)}
        className={props.className}
      />
    )
  }
  return <BookingWidgetInner {...props} settings={settings} />
}

function BookingWidgetInner({
  settings,
  activity,
  tenantSlug,
  currency,
  days: allDays,
  locations = NO_LOCATIONS,
  checkoutPath,
  initialDateKey,
  initialGuests,
  nowIso,
  variant = 'rail',
  className,
  businessPhone,
}: BookingWidgetProps & { settings: BookingSettings }) {
  const router = useRouter()
  const reducedMotion = useReducedMotionSafe()
  const stripRef = React.useRef<HTMLDivElement>(null)

  /* ---------- location ---------- */

  // The places it runs from as the owner saved them, so the location step matches the time slots.
  const sites = useActivitySites(activity, locations)
  const multiSite = sites.length > 1
  const [locationId, setLocationId] = React.useState<string>(() => sites[0]?.locationId ?? '')
  // The saved places arrive after the first render; a place that was taken off is never the one picked.
  React.useEffect(() => {
    if (sites.length > 0 && !sites.some((site) => site.locationId === locationId)) setLocationId(sites[0].locationId)
  }, [sites, locationId])
  /* ---------- kind ---------- */

  const kind = activity.kind ?? 'trip'
  const modes = rentalModes(activity)
  const rated = modes.length > 0 && (activity.rental?.rates?.length ?? 0) > 0
  const [rentalMode, setRentalMode] = React.useState<RentalMode>(() => modes[0] ?? (isDayRental(activity) ? 'day' : 'hour'))
  const dayRental = kind === 'rental' && (modes.length > 0 ? rentalMode === 'day' : isDayRental(activity))
  const hourRental = kind === 'rental' && rated && rentalMode === 'hour'
  const minHours = Math.max(1, activity.rental?.minHours ?? 1)
  const maxHours = Math.max(minHours, activity.rental?.maxHours || 12)
  const [rentHours, setRentHours] = React.useState(minHours)
  // By length: one set length, at one price per item.
  const lengths = activity.rental?.lengths ?? []
  const [lengthId, setLengthId] = React.useState(lengths[0]?.id ?? '')
  const byLength = kind === 'rental' && rated && rentalMode === 'length'
  const length = lengths.find((entry) => entry.id === lengthId) ?? lengths[0]
  const lengthHours = byLength && length ? length.hours : 0
  const rentalMeta = rentalCategoryMeta(activity.rental?.category)
  const minDays = Math.max(1, activity.rental?.minDays ?? 1)
  const maxDays = Math.max(minDays, activity.rental?.maxDays || 30)
  const [rentDays, setRentDays] = React.useState(minDays)
  // How it is charged, as saved in the editor, arrives after the first render: the mode, length and span stay within what is offered.
  React.useEffect(() => {
    if (modes.length > 0 && !modes.includes(rentalMode)) setRentalMode(modes[0])
  }, [modes, rentalMode])
  React.useEffect(() => {
    if (lengths.length > 0 && !lengths.some((entry) => entry.id === lengthId)) setLengthId(lengths[0].id)
  }, [lengths, lengthId])
  React.useEffect(() => {
    setRentHours((current) => clamp(current, minHours, maxHours))
  }, [minHours, maxHours])
  React.useEffect(() => {
    setRentDays((current) => clamp(current, minDays, maxDays))
  }, [minDays, maxDays])
  const showTime = kind !== 'pass' && !dayRental
  const stepList = [multiSite ? 'location' : null, 'date', showTime ? 'time' : null, 'guests', 'extras'].filter(
    (step): step is string => Boolean(step),
  )
  const stepOf = (id: string) => stepList.indexOf(id) + 1
  // Request to book: the guest picks a time and sends it; the business confirms with a payment link.
  const requestMode = settings.method === 'request'
  /* ---------- private: per group, one of its options and how many are coming; per person, a ticket each ---------- */
  const privateTickets = privatePerPerson(activity)
  /** A private group priced per group: its prices are options, one picked. */
  const privateOptions = kind === 'charter' && !privateTickets
  /** A private group's guests when priced per group (per person, its tickets count them). */
  const [partyCount, setParty] = React.useState(() => Math.max(2, activity.minParticipants || 1))
  /** Which request form is open, if any. */
  const [asking, setAsking] = React.useState<RequestContext['reason'] | null>(null)

  const { rules } = usePricing(tenantSlug)
  // This browser's bookings: filling-up and quiet-time prices count them, as checkout does.
  const { delta } = useBookingLedger(tenantSlug)
  /* Only the chosen location's runs, each time slot priced by the engine, with the day totals recomputed. */
  const stripRental = React.useMemo(() => stripRentalOf(activity, rentalMode, lengthId), [activity, rentalMode, lengthId])
  const days = React.useMemo(
    () => priceStripDays(activity, allDays, { nowIso, businessRules: rules, rental: stripRental, locationId: multiSite ? locationId : undefined, delta }),
    [allDays, multiSite, locationId, activity, nowIso, rules, stripRental, delta],
  )

  const bookableDays = React.useMemo(() => days.filter((d) => !d.soldOut && d.slots.length > 0), [days])

  const [dateKey, setDateKey] = React.useState<string>(() => {
    const requested = initialDateKey && days.find((d) => d.dateKey === initialDateKey)
    if (requested && !requested.soldOut && requested.slots.length > 0) return requested.dateKey
    return bookableDays[0]?.dateKey ?? days[0]?.dateKey ?? ''
  })
  // Until the guest picks a day, the strip follows the saved schedule as it arrives:
  // the day asked for once it can be booked, or the first day that can.
  const pickedDay = React.useRef(false)
  const pickDay = (key: string) => {
    pickedDay.current = true
    setDateKey(key)
  }
  const previousLocation = React.useRef(locationId)
  React.useEffect(() => {
    // A new location means a new strip: land on its first bookable day.
    if (previousLocation.current !== locationId) {
      previousLocation.current = locationId
      setDateKey(bookableDays[0]?.dateKey ?? days[0]?.dateKey ?? '')
      return
    }
    if (pickedDay.current) return
    const requested = initialDateKey ? bookableDays.find((d) => d.dateKey === initialDateKey) : undefined
    const current = bookableDays.find((d) => d.dateKey === dateKey)
    const next = requested?.dateKey ?? current?.dateKey ?? bookableDays[0]?.dateKey
    if (next && next !== dateKey) setDateKey(next)
  }, [locationId, bookableDays, days, dateKey, initialDateKey])
  // The strip can run months ahead: keep the picked day in view.
  React.useEffect(() => {
    const strip = stripRef.current
    const chip = strip?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!strip || !chip) return
    const box = strip.getBoundingClientRect()
    const at = chip.getBoundingClientRect()
    if (at.left < box.left || at.right > box.right) strip.scrollBy({ left: at.left - box.left - 4, behavior: 'auto' })
  }, [dateKey])

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
  /** The activity as the picked time slot sells it: its day's extra spots and a private group's size (a weekday's or a date's). */
  const slotActivity = React.useMemo(() => forSlot(activity, slot), [activity, slot])
  /** The most guests a private group can be that day: its size and its extra spots. */
  const privateMost = Math.max(1, guestLimitOf(slotActivity))

  /* ---------- per group: one price for the group; guests only say how many are coming, all on one tier ---------- */
  const groupPrice = chargeByOf(activity) === 'group' && kind !== 'charter' ? activity.groupPrice : undefined
  const groupTier = groupPrice ? groupTierOf(activity) : undefined
  /** A per-group count, kept between one guest and what the group tier allows (the spots left decide the rest). */
  const groupCount = (wanted: number) => clamp(wanted, 1, Math.max(1, groupTier?.maxQuantity ?? Number.POSITIVE_INFINITY))

  /* ---------- tier quantities ---------- */

  const [tierQty, setTierQty] = React.useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {}
    activity.priceTiers.forEach((tier, index) => {
      if (groupTier) {
        seed[tier.id] = tier.id === groupTier.id ? groupCount(initialGuests ?? Math.max(2, activity.minParticipants || 1)) : 0
      } else if (privateOptions) {
        // A private group per group books one option, once: the first.
        seed[tier.id] = index === 0 ? 1 : 0
      } else if (index === 0) {
        const wanted = (activity.kind ?? 'trip') === 'rental' ? 1 : (initialGuests ?? Math.max(tier.minQuantity, 2))
        seed[tier.id] = clamp(wanted, Math.max(tier.minQuantity, 1), tier.maxQuantity)
      } else {
        seed[tier.id] = tier.minQuantity
      }
    })
    return seed
  })

  // Prices saved in the editor arrive after the first render: a new price starts at its minimum, and each count stays within its limits.
  // Per group, the guests counted so far move onto the group's tier, and every other tier is left at none.
  const tiersKey = `${activity.priceTiers.map((tier) => `${tier.id}:${tier.minQuantity}:${tier.maxQuantity}`).join('|')}|group:${groupTier?.id ?? ''}|tickets:${privateTickets}`
  React.useEffect(() => {
    if (groupTier) {
      setTierQty((current) => {
        const people = activity.priceTiers.reduce((sum, tier) => sum + (current[tier.id] ?? 0) * peopleOf(tier), 0)
        const count = groupCount(people > 0 ? people : (initialGuests ?? Math.max(2, activity.minParticipants || 1)))
        const next: Record<string, number> = Object.fromEntries(activity.priceTiers.map((tier) => [tier.id, tier.id === groupTier.id ? count : 0]))
        return activity.priceTiers.some((tier) => next[tier.id] !== current[tier.id]) ? next : current
      })
      return
    }
    if (privateOptions) {
      // A private group per group books one option, once: the one picked, else the first.
      setTierQty((current) => {
        const picked = activity.priceTiers.find((tier) => (current[tier.id] ?? 0) > 0) ?? activity.priceTiers[0]
        const next: Record<string, number> = Object.fromEntries(activity.priceTiers.map((tier) => [tier.id, tier.id === picked?.id ? 1 : 0]))
        return activity.priceTiers.some((tier) => next[tier.id] !== current[tier.id]) ? next : current
      })
      return
    }
    // A private group priced per person counts tickets like any per-person activity; per group it picks one option.
    const perPerson = (kind !== 'charter' || privateTickets) && kind !== 'rental'
    setTierQty((current) => {
      const known = activity.priceTiers.some((tier) => current[tier.id] !== undefined)
      const next = { ...current }
      activity.priceTiers.forEach((tier, index) => {
        const had = current[tier.id]
        const wanted = had ?? (index === 0 && !known ? (kind === 'rental' ? 1 : (initialGuests ?? Math.max(tier.minQuantity, 2))) : tier.minQuantity)
        const least = perPerson || had === undefined ? tier.minQuantity : 0
        next[tier.id] = clamp(wanted, least, Math.max(least, tier.maxQuantity))
      })
      return activity.priceTiers.some((tier) => next[tier.id] !== current[tier.id]) ? next : current
    })
    // Runs when the tiers or their limits change, read through tiersKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiersKey])

  const [addOnOn, setAddOnOn] = React.useState<Record<string, boolean>>(() => {
    const seed: Record<string, boolean> = {}
    for (const addOn of activity.addOns) seed[addOn.id] = addOn.required
    return seed
  })
  // An extra the editor made required is always on.
  const requiredKey = activity.addOns.filter((addOn) => addOn.required).map((addOn) => addOn.id).join('|')
  React.useEffect(() => {
    if (!requiredKey) return
    setAddOnOn((current) => (activity.addOns.every((addOn) => !addOn.required || current[addOn.id]) ? current : { ...current, ...Object.fromEntries(activity.addOns.filter((addOn) => addOn.required).map((addOn) => [addOn.id, true])) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requiredKey])

  const headcount = activity.priceTiers.reduce((total, tier) => total + peopleOf(tier) * (tierQty[tier.id] ?? 0), 0)
  // A private group has the time slot to itself: priced per person, its tickets take that one slot, not a spot each.
  const seatsUsed = privateTickets
    ? headcount > 0
      ? 1
      : 0
    : activity.priceTiers.reduce((total, tier) => total + placesOf(tier) * (tierQty[tier.id] ?? 0), 0)
  /** People on the booking: a private group's count (never over its most), or its tickets when priced per person. */
  const party = privateTickets ? Math.max(1, headcount) : privateOptions ? Math.min(partyCount, privateMost) : partyCount
  /* ---------- private: the whole time for one group, while nobody else is on it ---------- */
  const privateOffer = activity.privateOption?.enabled ? activity.privateOption : undefined
  const privateOpen = Boolean(privateOffer && slot && slot.seatsLeft >= slot.capacity && slot.capacity > 0)
  const [privateOn, setPrivateOn] = React.useState(false)
  const goPrivate = privateOn && privateOpen
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
  /* ---------- rentals with items: each item counted on its own ---------- */
  const itemMode = hasItems(activity)
  const items = React.useMemo(() => (itemMode ? rentalItemsOf(activity) : []), [itemMode, activity])
  const service = useRentalService(tenantSlug)
  /** Free of one item at this time; day rentals need it free every day of the span. Out of service set on the Rentals page counts too. */
  const itemLeft = (tierId: string) => {
    if (!slot) return 0
    const item = items.find((entry) => entry.tierId === tierId)
    const seeded = item?.outOfService ?? 0
    const extra = item ? service.get(activity.id, tierId, { count: seeded, note: '' }).count - seeded : 0
    let free = slot.itemsLeft?.[tierId] ?? 0
    if (dayRental) {
      const start = days.findIndex((entry) => entry.dateKey === dateKey)
      for (let offset = 0; start >= 0 && offset < rentDays; offset++) {
        const entry = days[start + offset]
        if (!entry) break
        const open = entry.slots.filter((other) => !other.soldOut)
        free = Math.min(free, open.length > 0 ? Math.max(...open.map((other) => other.itemsLeft?.[tierId] ?? 0)) : 0)
      }
    } else if ((hourRental || byLength) && day) {
      // Longer than the shortest rental: it has to be free at every start time it covers.
      const until = new Date(slot.startsAt).getTime() + (byLength ? lengthHours : rentHours) * 3_600_000
      for (const other of day.slots) {
        const at = new Date(other.startsAt).getTime()
        if (at > new Date(slot.startsAt).getTime() && at < until) free = Math.min(free, other.itemsLeft?.[tierId] ?? 0)
      }
    }
    return Math.max(0, free - extra)
  }
  // A new time or length: trim what is no longer free, and if nothing is picked, start with the first item that is.
  // Only items with a price in the chosen mode can be picked.
  const priced = (tierId: string) => !rated || rateFor(activity, tierId, rentalMode, byLength ? length?.id : undefined) !== undefined
  const itemsKey = itemMode && slot ? items.map((item) => `${item.tierId}:${priced(item.tierId) ? itemLeft(item.tierId) : 0}`).join('|') : ''
  React.useEffect(() => {
    if (!itemsKey) return
    setTierQty((current) => {
      const next = { ...current }
      for (const item of items) next[item.tierId] = priced(item.tierId) ? Math.min(current[item.tierId] ?? 0, itemLeft(item.tierId)) : 0
      if (items.every((item) => (next[item.tierId] ?? 0) === 0)) {
        const first = items.find((item) => priced(item.tierId) && itemLeft(item.tierId) > 0)
        if (first) next[first.tierId] = 1
      }
      return items.some((item) => next[item.tierId] !== current[item.tierId]) ? next : current
    })
    // itemLeft is read through itemsKey, which changes whenever any count does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey])
  const seatsLeft = itemMode ? items.reduce((sum, item) => sum + itemLeft(item.tierId), 0) : dayRental ? spanLeft : (slot?.seatsLeft ?? 0)
  const overCapacity = slot
    ? itemMode
      ? items.some((item) => (tierQty[item.tierId] ?? 0) > itemLeft(item.tierId))
      : seatsUsed > seatsLeft || (privateTickets && headcount > privateMost)
    : false

  const selection: QuoteSelection = React.useMemo(
    () => ({
      tiers: activity.priceTiers.map((tier) => ({ tierId: tier.id, qty: tierQty[tier.id] ?? 0 })),
      addOns: activity.addOns.map((addOn) => ({
        addOnId: addOn.id,
        qty: addOnOn[addOn.id] ? addOnUnits(addOn, kind === 'charter' ? party : headcount) : 0,
      })),
    }),
    [activity.priceTiers, activity.addOns, tierQty, addOnOn, headcount, kind, party],
  )

  /*
   * What prices this time slot, for the rows and the quote alike: its date and
   * start, the clock, how full it is, its dynamic pricing, the business's
   * rules, and the people on the booking (a charter: its party).
   */
  const slotBooked = slot ? bookedOn(slot, delta) : undefined
  const priceCtx: PriceContext = React.useMemo(
    () => ({
      startsAt: slot?.startsAt,
      nowIso,
      capacity: slot?.capacity,
      booked: slotBooked,
      priceMultiplier: slot?.priceMultiplier ?? 1,
      businessRules: rules,
      guests: Math.max(1, kind === 'charter' ? party : headcount),
      rental: rated ? { mode: rentalMode, lengthId: byLength ? length?.id : undefined } : undefined,
    }),
    [slot, nowIso, slotBooked, rules, kind, party, headcount, rated, rentalMode, byLength, length],
  )

  const quote = React.useMemo(
    () =>
      buildQuote(slotActivity, tenantSlug, selection, slot?.priceMultiplier ?? 1, {
        days: dayRental ? rentDays : 1,
        party,
        private: goPrivate,
        ...(rated ? { rentalMode, hours: rentHours, lengthId: byLength ? length?.id : undefined } : {}),
        startsAt: slot?.startsAt,
        nowIso,
        capacity: slot?.capacity,
        booked: slotBooked,
        businessRules: rules,
      }),
    [slotActivity, tenantSlug, selection, slot, slotBooked, nowIso, rules, dayRental, rentDays, party, rated, rentalMode, rentHours, byLength, length, goPrivate],
  )
  /** What moved the price, as chips under the total; dynamic pricing shows as "Peak time" instead. */
  const priceChips = quote.appliedChanges.filter((change) => change.source !== 'dynamic')

  // Per-person kinds: every tier's minimum per booking has to be met. A private group per group and rentals pick one option.
  const perPerson = (kind !== 'charter' || privateTickets) && kind !== 'rental'
  // Per group there is one count, so no tier has a minimum of its own.
  const shortTiers = perPerson && !groupTier ? activity.priceTiers.filter((tier) => (tierQty[tier.id] ?? 0) < tier.minQuantity) : []
  const canReserve =
    shortTiers.length === 0 &&
    Boolean(slot) && !overCapacity && seatsUsed >= (kind === 'charter' || kind === 'rental' ? 1 : Math.max(1, activity.minParticipants)) && (kind !== 'charter' || party >= Math.max(1, activity.minParticipants))

  // Instant booking with a group limit: bigger groups send a request instead of paying.
  // Counted in the unit the business set it in: people, or for rentals what is rented.
  const group = groupUnit(kind, activity.rental?.category, settings.groupCountBy)
  const groupSize =
    kind === 'charter'
      ? party
      : group.byUnits
        ? activity.priceTiers.reduce((total, tier) => total + (tierQty[tier.id] ?? 0), 0)
        : kind === 'rental'
          ? activity.priceTiers.reduce((total, tier) => total + (activity.rental?.items?.find((item) => item.tierId === tier.id)?.holds ?? peopleOf(tier)) * (tierQty[tier.id] ?? 0), 0)
          : headcount
  const overGroup = settings.method === 'instant' && settings.groupLimit > 0 && groupSize > settings.groupLimit

  const reserve = () => {
    if (!slot || !canReserve) return
    router.push(
      checkoutHref(checkoutPath, activity.slug, slot.departureId, selection, {
        n: dayRental ? rentDays : undefined,
        m: rated ? rentalMode : undefined,
        h: hourRental ? rentHours : undefined,
        l: byLength ? length?.id : undefined,
        g: kind === 'charter' ? party : undefined,
        p: goPrivate ? 1 : undefined,
      }),
    )
  }

  const scrollStrip = (direction: 1 | -1) => {
    stripRef.current?.scrollBy({ left: direction * 264, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  // "From": the plain from price (lowest tier, or a rental's lowest rate in this mode and length), or a cheaper day in the strip.
  const fromShown = shownFromPrice(activity, bookableDays, stripRental)

  /* ---------- per-kind blocks ---------- */

  /** A price on this time slot: a tier's ticket, a rental's rate in this mode, or 'private'. */
  const priceOn = (tierId: string) => unitPriceDetail(slotActivity, tierId, priceCtx)
  /** The struck-through "Was": the tier's own compare-at price, or its price before a discount. 0: none. */
  const wasPrice = (tierId: string, detail: { price: number; base: number }) => {
    const compareAt = rated ? 0 : (activity.priceTiers.find((tier) => tier.id === tierId)?.compareAtPrice ?? 0)
    const was = Math.max(compareAt, detail.base)
    return was > detail.price ? was : 0
  }
  const wasTag = (amount: number) =>
    amount > 0 ? (
      <s className="text-xs font-normal text-faint tabular">
        <span className="sr-only">Was </span>
        {formatCurrency(amount, currency)}
      </s>
    ) : null
  const chosenTier = activity.priceTiers.find((tier) => (tierQty[tier.id] ?? 0) > 0) ?? activity.priceTiers[0]
  const chosenQty = chosenTier ? (tierQty[chosenTier.id] ?? 0) : 0
  /** Each extra spot on this time slot (0: none sold), and the usual spots: a private group's most guests. */
  const extraEach = extraSpotPrice(slotActivity, priceCtx, privateOptions ? chosenTier?.id : undefined)
  const usualSpots = usualSpotsOf(slotActivity)
  /** A shared time slot whose usual spots are full: only extra spots are left. */
  const extraOnly = Boolean(slot) && kind !== 'charter' && extraEach > 0 && seatsLeft > 0 && usualSpotsLeft(slotActivity, { capacity: slot?.capacity, booked: slotBooked }) <= 0
  /** A time's chip says when its usual spots are full and only extra spots are left (each time with its own day's extra spots). */
  const extraLabelOn = (entry: AvailabilitySlot) => {
    if (kind === 'charter') return undefined
    const own = forSlot(activity, entry)
    const each = own === slotActivity ? extraEach : extraSpotPrice(own, { ...priceCtx, startsAt: entry.startsAt })
    return each > 0 && usualSpotsLeft(own, { capacity: entry.capacity, booked: bookedOn(entry, delta) }) <= 0 ? extraSpotWords(each, currency) : undefined
  }
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
  if (kind === 'rental' && itemMode) {
    const rental = activity.rental
    const shown = items.filter((item) => !rated || rateFor(activity, item.tierId, rentalMode, byLength ? length?.id : undefined) !== undefined)
    const chosen = shown.filter((item) => (tierQty[item.tierId] ?? 0) > 0)
    const count = chosen.reduce((sum, item) => sum + (tierQty[item.tierId] ?? 0), 0)
    const fits = chosen.reduce((sum, item) => sum + (tierQty[item.tierId] ?? 0) * item.holds, 0)
    const deposit = chosen.reduce((sum, item) => sum + (tierQty[item.tierId] ?? 0) * item.deposit, 0)
    const per = dayRental ? ' a day' : hourRental ? ' an hour' : byLength && length ? ` · ${length.label.toLowerCase()}` : ''
    const lateFee = rental?.lateFee ?? 0
    const rules = [
      lateFee > 0 ? `Late return ${formatCurrency(lateFee, currency)} an hour` : null,
    ].filter((entry): entry is string => Boolean(entry))
    const setQty = (tierId: string, qty: number) => setTierQty((current) => ({ ...current, [tierId]: qty }))
    kindBlock = (
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">{stepOf('guests')} · What would you like?</h3>
          {slot ? (
            <span className={cn('text-xs font-medium tabular', seatsLeft <= 2 ? 'text-warning' : 'text-subtle')}>
              {seatsLeft} free{dayRental && rentDays > 1 ? ' every day' : ''}
            </span>
          ) : null}
        </div>
        {modes.length > 1 ? (
          <div className={cn('mt-3 grid gap-1 rounded-xl bg-surface-sunken p-1', modes.length === 3 ? 'grid-cols-3' : 'grid-cols-2')} role="radiogroup" aria-label="Rent by">
            {modes.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={rentalMode === mode}
                onClick={() => setRentalMode(mode)}
                className={cn('rounded-lg px-3 py-2 text-sm font-semibold transition-colors', rentalMode === mode ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground')}
              >
                {mode === 'length' ? 'By length' : `By the ${mode}`}
              </button>
            ))}
          </div>
        ) : null}
        {byLength && lengths.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="How long">
            {lengths.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="radio"
                aria-checked={length?.id === entry.id}
                onClick={() => setLengthId(entry.id)}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  length?.id === entry.id ? 'border-primary bg-primary-soft/40 text-foreground' : 'border-line text-muted hover:text-foreground',
                )}
              >
                {entry.label}
              </button>
            ))}
          </div>
        ) : null}
        <ul className="mt-3 flex list-none flex-col gap-2 p-0" aria-label="Items">
          {shown.map((item) => {
            const left = itemLeft(item.tierId)
            const qty = tierQty[item.tierId] ?? 0
            const itemPrice = priceOn(item.tierId)
            const max = Math.min(left, item.maxPerBooking)
            return (
              <li key={item.tierId} className={cn('rounded-xl border px-3.5 py-3 transition-colors', qty > 0 ? 'border-primary bg-primary-soft/20' : 'border-line', slot && left === 0 && qty === 0 && 'opacity-60')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{item.name}</p>
                    <p className="mt-0.5 text-xs text-subtle">{[item.description, `Fits ${item.holds}`].filter(Boolean).join(' · ')}</p>
                    <p className="mt-1 text-sm font-medium text-foreground tabular">
                      {formatCurrency(itemPrice.price, currency)}
                      <span className="text-xs font-normal text-subtle">{per}</span>
                      {wasPrice(item.tierId, itemPrice) > 0 ? <> {wasTag(wasPrice(item.tierId, itemPrice))}</> : null}
                      {item.cap && (hourRental || dayRental) ? <span className="text-xs font-normal text-subtle"> · never more than {formatCurrency(item.cap, currency)}</span> : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {stepper(qty, 0, Math.max(qty, max), (next) => setQty(item.tierId, next), item.name)}
                    <span className={cn('text-xs font-medium tabular', !slot ? 'text-subtle' : left === 0 ? 'text-danger' : left <= 2 ? 'text-warning' : 'text-subtle')}>
                      {!slot ? 'Pick a time' : left === 0 ? 'None left' : `${left} left`}
                    </span>
                  </div>
                </div>
                {slot && qty > left ? (
                  <p className="mt-1.5 text-xs font-medium text-danger">
                    {left === 0 ? "None left" : `Only ${left} left`} {dayRental && rentDays > 1 ? "for all those days" : "at this time"}. Lower it or pick another time.
                  </p>
                ) : null}
              </li>
            )
          })}
        </ul>
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
        <p className="mt-2 text-xs text-muted">
          {count > 0
            ? `${count} ${count === 1 ? 'item' : 'items'} · fits ${fits} ${fits === 1 ? 'person' : 'people'}${deposit > 0 ? ` · ${formatCurrency(deposit, currency)} refundable deposit held at pick-up` : ''}`
            : 'Add at least one item.'}
        </p>
        {rules.length > 0 ? (
          <ul className="mt-2 flex list-none flex-wrap gap-1.5 p-0">
            {rules.map((rule) => (
              <li key={rule} className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-muted">
                {rule}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    )

  } else if (kind === 'rental') {
    const rental = activity.rental
    const units = rental?.units ?? activity.maxCapacity
    const deposit = rental?.damageDeposit ?? 0
    const lengthOf = (tierId: string) => rental?.durations.find((entry) => entry.tierId === tierId)?.minutes
    const rules = [
      rental?.seatsPerUnit ? `${rental.seatsPerUnit} ${rental.seatsPerUnit === 1 ? 'person' : 'people'} per ${rentalMeta.unit}` : null,
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
              const note = tier.description || (!rated && !dayRental && minutes ? `${Math.round((minutes / 60) * 10) / 10} hours` : undefined)
              return optionButton(tier.id, tier.label, `${formatCurrency(priceOn(tier.id).price, currency)}${dayRental ? ' a day' : hourRental ? ' an hour' : ''}`, note || undefined)
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
  } else if (privateOptions) {
    const maxGuests = privateMost
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
            return optionButton(tier.id, tier.label, formatCurrency(priceOn(tier.id).price, currency), note || undefined)
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
          <span>
            <span className="block text-sm font-medium text-foreground">Guests in your group</span>
            <span className="block text-xs text-subtle">
              {activity.minParticipants > 1 ? `${activity.minParticipants} to ${maxGuests}` : `Up to ${maxGuests}`};{' '}
              {extraEach > 0 ? `the price is for ${usualSpots}, then ${formatCurrency(extraEach, currency)} each` : 'the price is for the whole group'}
            </span>
          </span>
          {stepper(party, Math.max(1, activity.minParticipants), maxGuests, setParty, 'guests')}
        </div>
        <ul className="mt-2 flex list-none flex-wrap gap-1.5 p-0">
          {[
            'Only your group',
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
      // The Guests step's Height and Weight limits, or a seeded rider limit.
      ...bodyLimitLines(activity),
    ].filter(Boolean)
    kindNote = (
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-sunken/50 px-3.5 py-3">
        <Zap className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <div className="min-w-0 text-xs text-muted">
          <p className="text-sm font-medium text-foreground">{formatDurationShort(activity.durationMinutes)} per time slot · arrive 15 minutes early</p>
          {limits.length > 0 ? <p className="mt-1">Every guest: {limits.join(', ')}.</p> : null}
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
            {sessions > 1 ? `${sessions}-lesson course` : 'Single lesson'} · {LESSON_LEVELS.find((entry) => entry.value === level)?.label}{ratio > 0 ? ` · ${ratio} per instructor` : ''}
          </p>
          {sessions > 1 && dateKey ? (
            <p className="mt-1">Lessons on {Array.from({ length: sessions }, (_, index) => shortDate(dateKey, index)).join(', ')}, same time each day.</p>
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
          {activity.pass?.reentry ? 'Come and go as you like.' : null}
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
            {formatCurrency(fromShown, currency)}
            <span className="ml-1.5 text-xs font-medium text-subtle">{fromUnitLabel(activity, rentalMode, lengthId)}</span>
          </p>
        </div>
        {slot && slot.priceMultiplier > 1 ? (
          <SimpleTooltip label="This time slot is in high demand, so pricing has stepped up.">
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
                      {runs} {pluralize(runs, 'time slot')}
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
                onSelect={() => pickDay(entry.dateKey)}
                emptyLabel={kind === 'trip' ? 'No times' : kind === 'lesson' ? 'No class' : kind === 'activity' ? 'No slots' : 'Closed'}
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
                {day.slots.length} {pluralize(day.slots.length, kind === 'activity' ? 'time slot' : kind === 'rental' ? 'start time' : kind === 'lesson' ? 'class' : kind === 'charter' ? 'charter' : activity.format === 'open' ? 'arrival slot' : activity.format === 'dates' ? 'time' : 'time slot')}
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
                  noun={kind === 'rental' ? rentalMeta.units : 'spots'}
                  // The usual spots are full: only extra spots are left, at their own price.
                  extraLabel={extraLabelOn(entry)}
                  selected={entry.departureId === departureId}
                  onSelect={() => setDepartureId(entry.departureId)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-line-strong bg-surface-sunken px-4 py-5 text-center text-sm text-muted">
              Nothing scheduled on this date. Pick another day, or call us and we will look at
              adding a private time.
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
            {slot && privateTickets ? (
              // A private group books the whole time slot: say Available, not a spot count.
              <span className={cn('text-xs font-medium', seatsLeft > 0 ? 'text-success' : 'text-danger')}>{seatsLeft > 0 ? 'Available' : 'Booked'}</span>
            ) : slot ? (
              <span
                className={cn(
                  'text-xs font-medium tabular',
                  seatsLeft <= 4 || extraOnly ? 'text-warning' : 'text-subtle',
                )}
              >
                {/* The usual spots are full: what is left is extra spots, at their own price. */}
                {extraOnly ? `${seatsLeft} extra ${pluralize(seatsLeft, 'spot')} · ${formatCurrency(extraEach, currency)} each` : `${seatsLeft} ${pluralize(seatsLeft, 'spot')} left`}
              </span>
            ) : null}
          </div>

          {privateOffer ? (
            <label className={cn('mt-3 flex items-start justify-between gap-3 rounded-xl border px-3.5 py-3', privateOn && privateOpen ? 'border-primary bg-primary-soft/30' : 'border-line', !privateOpen && 'opacity-60')}>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">Make it private</span>
                <span className="block text-xs text-subtle">
                  {privateOpen
                    ? `Just your group: ${formatCurrency(priceOn('private').price, currency)} for up to ${privateOffer.includedGuests}${privateOffer.extraGuest > 0 ? `, then ${formatCurrency(priceOn('private').extraGuest ?? privateOffer.extraGuest, currency)} each` : ''}.`
                    : slot
                      ? 'Others are already booked on this time. Pick an empty time to go private.'
                      : 'Pick a time first.'}
                </span>
              </span>
              <Switch checked={privateOn && privateOpen} disabled={!privateOpen} onCheckedChange={setPrivateOn} aria-label="Make it private" />
            </label>
          ) : null}

          {groupPrice && groupTier ? (
            (() => {
              // Per group: one count of guests, on the group's tier. The price is for the whole group.
              const count = tierQty[groupTier.id] ?? 0
              const places = placesOf(groupTier)
              const room = places > 0 ? Math.floor(seatsLeft / places) : groupTier.maxQuantity
              const most = Math.max(0, Math.min(room, groupTier.maxQuantity))
              const groupDetail = priceOn('group')
              const note = groupPrice.note?.trim()
              // The price is for the group in the usual spots; each guest in an extra spot adds the extra-spot price.
              const covered = extraEach > 0 ? `for the group · extra spots ${formatCurrency(extraEach, currency)} each` : 'for the group'
              return (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">Guests</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
                      <span>
                        <span className="tabular font-medium text-muted">{formatCurrency(groupDetail.price, currency)}</span> {covered}
                      </span>
                      {wasTag(wasPrice('group', groupDetail))}
                      {note ? <span>· {note}</span> : null}
                    </p>
                  </div>
                  {stepper(count, Math.max(1, activity.minParticipants || 1), Math.max(1, most), (next) => setTierQty((prev) => ({ ...prev, [groupTier.id]: groupCount(next) })), 'guests')}
                </div>
              )
            })()
          ) : (
          <div className="mt-3 divide-y divide-line-subtle rounded-xl border border-line">
            {activity.priceTiers.map((tier) => {
              const qty = tierQty[tier.id] ?? 0
              // The date's price for this ticket, and what it was before a discount.
              const tierPrice = priceOn(tier.id)
              const unit = tierPrice.price
              const was = wasPrice(tier.id, tierPrice)
              const places = placesOf(tier)
              // A private group priced per person: up to its most guests, counted in people.
              // Private: the group can be as big as the time, or as the price allows.
              const roomLeft = privateTickets
                ? privateMost - (headcount - qty * peopleOf(tier))
                : goPrivate
                  ? Math.min(slot ? slot.capacity - slotExtraSpotsOf(slotActivity) : seatsLeft, privateOffer && privateOffer.extraGuest === 0 ? privateOffer.includedGuests : Number.POSITIVE_INFINITY) - (seatsUsed - qty * places)
                  : seatsLeft - (seatsUsed - qty * places)
              const seatRoom = privateTickets ? (slot && seatsLeft > 0 ? Math.floor(roomLeft / peopleOf(tier)) : 0) : places > 0 ? Math.floor(roomLeft / places) : tier.maxQuantity
              const max = Math.min(tier.maxQuantity, Math.max(0, seatRoom))

              return (
                <div key={tier.id} className="flex items-center gap-3 px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {tier.label}
                      {tierAges(tier) ? <span className="font-normal text-subtle"> · {tierAges(tier)}</span> : null}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
                      <span className="tabular font-medium text-muted">
                        {formatCurrency(unit, currency)}
                      </span>
                      {wasTag(was)}
                      {tier.description ? <span className="truncate">· {tier.description}</span> : null}
                      {privateTickets ? null : !tier.countsTowardCapacity ? (
                        <span className="text-faint">· does not use a spot</span>
                      ) : (tier.seats ?? 1) > 1 ? (
                        <span className="text-faint">· for {tier.seats}</span>
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
          )}

          <AnimatePresence initial={false}>
            {overCapacity ? (
              <motion.p
                initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 flex items-center gap-2 overflow-hidden text-xs font-medium text-danger"
              >
                <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                {privateTickets
                  ? seatsLeft > 0
                    ? `Up to ${privateMost} guests.`
                    : 'This time is booked.'
                  : `Only ${seatsLeft} ${pluralize(seatsLeft, 'spot')} left in this time slot.`}
              </motion.p>
            ) : null}
          </AnimatePresence>

          {!groupTier && activity.priceTiers.some((tier) => tier.minQuantity > 0) ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-subtle">
              <Info className="size-3.5 shrink-0" aria-hidden="true" />
              Every booking includes at least {activity.priceTiers.filter((tier) => tier.minQuantity > 0).map((tier) => `${tier.minQuantity} ${tier.label}`).join(' and ')}.
            </p>
          ) : null}
          {privateTickets ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-subtle">
              <Users className="size-3.5 shrink-0" aria-hidden="true" />
              {activity.minParticipants > 1 ? `${activity.minParticipants} to ${privateMost}` : `Up to ${privateMost}`} guests.
              {extraEach > 0 ? ` Over ${usualSpots}, ${formatCurrency(extraEach, currency)} each.` : ''} The time is just for your group.
            </p>
          ) : activity.minParticipants > 1 ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-subtle">
              <Users className="size-3.5 shrink-0" aria-hidden="true" />
              Minimum {activity.minParticipants} guests for this activity.
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
                const qty = addOnUnits(addOn, kind === 'charter' ? party : headcount)
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
                          <span className="ml-1 text-xs font-medium text-subtle">{checked && qty > 1 ? `× ${qty}` : addOnPer(addOn)}</span>
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
                    {line.total >= 0 && line.id !== 'minimum' ? (
                      <span className="ml-1.5 text-xs text-faint">
                        {line.quantity} × {formatCurrency(line.unitPrice, currency)}
                      </span>
                    ) : null}
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

        {priceChips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" aria-label="Price adjustments">
            {priceChips.map((change) => (
              <span
                key={change.id}
                className={cn('rounded-full px-2.5 py-1 text-xs font-medium', change.effect.type !== 'set' && change.effect.value < 0 ? 'bg-success-soft text-success' : 'bg-surface-sunken text-muted')}
              >
                {change.label}
              </span>
            ))}
          </div>
        ) : null}

        {/* ---------- reserve ---------- */}
        <div className="space-y-3">
          {asking ? (
            <RequestForm
              activity={activity}
              tenantSlug={tenantSlug}
              currency={currency}
              replyHours={settings.replyHours}
              onCancel={() => setAsking(null)}
              context={
                asking === 'date' || asking === 'sooner'
                  ? { reason: asking, askDate: true, askParty: true, party: headcount, minDate: (nowIso ?? new Date().toISOString()).slice(0, 10) }
                  : asking === 'quote'
                    ? { reason: 'quote', askDate: !slot, askParty: true, party: headcount, slot: slot ? { departureId: slot.departureId, startsAt: slot.startsAt } : undefined }
                    : {
                        reason: asking,
                        slot: slot ? { departureId: slot.departureId, startsAt: slot.startsAt } : undefined,
                        party: kind === 'charter' ? party : headcount,
                        lines: quote.ticketLines.filter((line) => line.total > 0).map((line) => ({ label: line.label, qty: line.quantity, unit: line.unitPrice })),
                      }
              }
            />
          ) : (
            <>
              {overGroup ? (
                <p className="rounded-xl bg-surface-sunken px-3.5 py-2.5 text-sm text-muted">
                  Bookings of more than {settings.groupLimit} {group.many} go by request. Send the details and we confirm with the price.
                </p>
              ) : null}
              <Button
                size="lg"
                fullWidth
                onClick={requestMode ? () => setAsking('booking') : overGroup ? () => setAsking('group') : reserve}
                disabled={requestMode || overGroup ? !slot || headcount < 1 : !canReserve}
                className="h-12 text-[0.9375rem]"
              >
                {!slot
                  ? kind === 'rental'
                    ? 'Choose a start time'
                    : 'Choose a time'
                  : requestMode
                    ? 'Send request'
                    : overGroup
                      ? 'Send a group request'
                      : kind === 'rental'
                        ? 'Rent now'
                        : 'Reserve now'}
              </Button>
              {requestMode ? <p className="text-center text-xs text-subtle">Nothing is charged now. We confirm and send a payment link.</p> : null}
              <div className="flex flex-col items-center gap-1.5">
                {settings.otherDates ? (
                  <button type="button" onClick={() => setAsking('date')} className="text-sm font-medium text-primary hover:underline">
                    Can&rsquo;t find your date? Ask for another day
                  </button>
                ) : null}
                {(activity.noticeHours ?? 0) > 0 ? (
                  <button type="button" onClick={() => setAsking('sooner')} className="text-sm font-medium text-primary hover:underline">
                    Need it within {activity.noticeHours} hours? Ask us
                  </button>
                ) : null}
                {settings.customQuote ? (
                  <button type="button" onClick={() => setAsking('quote')} className="text-sm font-medium text-primary hover:underline">
                    Planning something special? Ask for a custom quote
                  </button>
                ) : null}
                {(settings.phone || businessPhone) && (requestMode || settings.otherDates || settings.groupLimit > 0) ? (
                  <a href={`tel:${(settings.phone || businessPhone || '').replace(/[^\d+]/g, '')}`} className="text-xs text-subtle hover:text-foreground">
                    Or call {settings.phone || businessPhone}{settings.callHours ? ` · ${settings.callHours}` : ''}
                  </a>
                ) : null}
              </div>
            </>
          )}
          <TrustSeal freeCancellationHours={activity.cancellationPolicy.freeCancellationHours} byRequest={requestMode} />
          {requestMode ? null : (
            <p className="text-center text-xs text-faint">
              You will not be charged until the final step.
            </p>
          )}
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

export function DateChip({
  day,
  currency,
  selected,
  onSelect,
  emptyLabel = 'No times',
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

export function TimeChip({
  slot,
  noun = 'spots',
  wholeGroup = false,
  extraLabel,
  selected,
  onSelect,
}: {
  /** A private charter sells once: say Available, not a seat count. */
  wholeGroup?: boolean
  /** The usual spots are full: "Extra spots · $40 each" in place of the count. */
  extraLabel?: string
  /** What the count is of: seats, bikes, places. */
  noun?: string
  slot: AvailabilitySlot
  selected: boolean
  onSelect: () => void
}) {
  const urgent = !wholeGroup && !slot.soldOut && slot.seatsLeft <= 3
  const filling = !slot.soldOut && !urgent && (slot.seatsLeft <= 6 || Boolean(extraLabel))

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
          : extraLabel && !wholeGroup
            ? extraLabel
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

/** "4–12", "Under 3", "65+": a tier's age range, when it has one. */
function tierAges(tier: Pick<PriceTier, 'ageMin' | 'ageMax'>): string {
  const min = tier.ageMin && tier.ageMin > 0 ? tier.ageMin : undefined
  const max = tier.ageMax && tier.ageMax > 0 ? tier.ageMax : undefined
  if (min !== undefined && max !== undefined) return `${min}–${max}`
  if (max !== undefined) return `Under ${max + 1}`
  if (min !== undefined) return `${min}+`
  return ''
}

/** "90 min", "2h", "2h 30m". */
function formatDurationShort(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
