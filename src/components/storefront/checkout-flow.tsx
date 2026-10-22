'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  Download,
  Lock,
  MapPin,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { z } from 'zod'

import {
  cn,
  currencySymbol,
  formatCurrency,
  formatDateLong,
  formatDuration,
  formatTime,
  pluralize,
} from '@/lib/utils'
import type { Activity, GuestQuestion, PickupZone, Tenant, WaiverTemplate } from '@/types'
import { useIsHydrated, useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { useActivityWithDefaults, useBookingDefaults } from '@/hooks/use-booking-defaults'
import type { CheckoutFields } from '@/lib/booking-defaults'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/toaster'
import { buildQuote, type AvailabilityDay, type QuoteSelection } from '@/components/storefront/booking-widget'
import { bookedOn, checkoutParty, resolveRental, resolveSelection, type RentalRequest } from '@/components/storefront/checkout-selection'
import {
  EMPTY_WAIVER,
  GuestDetailsStep,
  WaiverStep,
  makeTravellers,
  signerDefaults,
  validateGuestDetails,
  type TravellerState,
  type WaiverState,
} from '@/components/storefront/checkout-guest-details'
import { CheckoutPickup, EMPTY_PICKUP, PICKUP_OTHER, validatePickup, type PickupChoice } from '@/components/storefront/checkout-pickup'
import { TicketQr, ticketPayload } from '@/components/ui/ticket-qr'
import { CheckoutDiscounts } from '@/components/storefront/checkout-discounts'
import { findPromo, giftProblem, promoDiscount, promoProblem } from '@/lib/pricing'
import { useActivityOverrides, usePricingOverride } from '@/hooks/use-pricing-override'
import { applyScheduleOverride } from '@/lib/activity-overrides'
import { guestDetailsOf } from '@/lib/guest-requirements'
import { CheckoutOptIn, useCheckoutOptIn } from '@/components/storefront/storefront-marketing'
import type { RentalMode } from '@/lib/activity-kinds'
import { usePricing } from '@/hooks/use-pricing'
import { recordBooking, seatDeltas, withLedger } from '@/lib/booking-ledger'
import { useBookingLedger } from '@/hooks/use-booking-ledger'
import { useScheduledDays } from '@/hooks/use-scheduled-days'
import { depositLabel, hoursLabel, paymentOf, splitPayment } from '@/lib/booking-policy'
import { groupPriced } from '@/lib/price-engine'
import type { PaymentTerms } from '@/types'

/* ==========================================================================
   TYPES
   ========================================================================== */

export interface CheckoutDeparture {
  id: string
  startsAt: string
  endsAt: string
  seatsLeft: number
  priceMultiplier: number
  /** Spots at the time slot, so filling-up and quiet-time prices match the widget. */
  capacity?: number
  /** Spots booked on the server, without carts in progress or the daily limit. */
  booked?: number
  /** The time slot's own start, when `startsAt` is moved (a day rental's pick-up): prices count from it. */
  slotStartsAt?: string
  /** The time slot's own end, before a rental's hours or return move `endsAt`. */
  slotEndsAt?: string
  /** The location the time slot runs from, so its meeting point follows the saved edit. */
  locationId?: string
  /** Day rentals: when the units come back. The span is startsAt to returnsAt. */
  returnsAt?: string
  /** The location this run leaves from, when the business has more than one. */
  location?: { name: string; addressLine: string; meetingPoint: string }
  /** Packages: each part, in order, with its own time and place. */
  legs?: CheckoutLeg[]
}

export interface CheckoutLeg {
  departureId: string
  activitySlug: string
  activityName: string
  label: string
  startsAt: string
  endsAt: string
  meetingPoint: string
}

/** A package's parts, one line each: what, when, where. */
function LegList({ legs, compact = false }: { legs: CheckoutLeg[]; compact?: boolean }) {
  return (
    <ol className="flex list-none flex-col gap-2 p-0">
      {legs.map((leg, index) => (
        <li key={leg.departureId} className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            <span className="mr-1 text-subtle tabular">{index + 1}.</span>
            {leg.label}
          </p>
          <p className="text-xs text-subtle tabular">
            {formatDateLong(leg.startsAt)} · {formatTime(leg.startsAt)} – {formatTime(leg.endsAt)}
          </p>
          {compact ? null : <p className="text-xs leading-relaxed text-muted">{leg.meetingPoint}</p>}
        </li>
      ))}
    </ol>
  )
}

/** Where to meet for this run: the location's own note, or the activity's. */
function meetingPointFor(activity: Activity, departure: CheckoutDeparture) {
  return departure.location?.meetingPoint || activity.meetingPoint || departure.location?.addressLine || ''
}

export interface CheckoutFlowProps {
  /** The demo clock, for pricing rules and code validity. */
  nowIso?: string
  /** The activity's waiver, signed at checkout. */
  waiver?: WaiverTemplate
  /** Pickup zones this activity serves; empty when it has no pickup. */
  pickupZones?: PickupZone[]
  tenant: Tenant
  activity: Activity
  departure: CheckoutDeparture
  selection: QuoteSelection
  /** Day rentals: days each unit is out. */
  rentalDays?: number
  /** Rentals with rates: by the hour or by the day, and the hours. */
  rentalMode?: RentalMode
  rentalHours?: number
  /** Length rentals: the length picked. */
  rentalLength?: string
  /** The link's rental values, checked again here against the saved edit (modes, hours, days, pick-up and return). */
  rentalRequest?: RentalRequest
  /** Charters: the group size. */
  party?: number
  /** The private option: one group price, the whole time to themselves. Prefer `requestedPrivate`, checked here against the priced activity. */
  privateBooking?: boolean
  /** The guest asked for the private option (the widget's `p=1`). */
  requestedPrivate?: boolean
  /** Nobody is booked on the time slot, as the server sees it; used when the slot isn't in `seededDays`. */
  slotEmpty?: boolean
  /** The strip the widget was given, rebuilt here from the saved schedule so spots and seats match the widget. */
  seededDays?: AvailabilityDay[]
  /** The time slot the guest picked, as in the link (a generated id stays generated). */
  slotId?: string
  /** The link's tickets and extras, checked again here against the rebuilt time slot. */
  request?: { tiers?: string; addOns?: string }
  basePath: string
  /** Deterministic confirmation code, generated on the server. */
  reference: string
}

/* ==========================================================================
   VALIDATION
   ========================================================================== */

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const PHONE = /^[+()\-\s\d]{7,}$/

/** The guest form's checks, following Settings → Booking flow: required, optional (checked only when filled in) or not asked. */
function guestSchemaFor(fields: CheckoutFields) {
  const phone = z.string().trim().regex(PHONE, 'Add a number we can reach you on')
  const requests = z.string().max(500, 'Keep it under 500 characters')
  return z.object({
    firstName: z.string().trim().min(2, 'Tell us your first name'),
    lastName: z.string().trim().min(2, 'Tell us your last name'),
    email: z.string().trim().regex(EMAIL, 'That email does not look right'),
    phone: fields.phone === 'required' ? phone : fields.phone === 'optional' ? z.union([z.literal(''), phone]) : z.string(),
    country: fields.country === 'required' ? z.string().min(2, 'Pick your country') : z.string(),
    requests: fields.requests === 'required' ? requests.trim().min(2, 'Tell us a little here') : requests.optional(),
  })
}

const paymentSchema = z.object({
  cardName: z.string().trim().min(3, 'Name as printed on the card'),
  cardNumber: z
    .string()
    .refine((value) => luhn(value.replace(/\s/g, '')), 'Check the card number'),
  expiry: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\s?\/\s?\d{2}$/, 'MM / YY')
    .refine((value) => {
      const [mm, yy] = value.split('/').map((part) => Number(part.trim()))
      // The demo clock is frozen in September 2026.
      return yy > 26 || (yy === 26 && mm >= 9)
    }, 'That card has expired'),
  cvc: z.string().regex(/^\d{3,4}$/, '3 or 4 digits'),
  billingCountry: z.string().min(2, 'Pick a billing country'),
})

type Errors = Record<string, string>

function collectErrors(issues: { path: PropertyKey[]; message: string }[]): Errors {
  const out: Errors = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.')
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/* ==========================================================================
   CARDS
   ========================================================================== */

function luhn(digits: string) {
  if (!/^\d{13,19}$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let value = digits.charCodeAt(i) - 48
    if (double) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
    double = !double
  }
  return sum % 10 === 0
}

type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown'

const BRAND_META: Record<CardBrand, { label: string; className: string }> = {
  visa: { label: 'VISA', className: 'text-info' },
  mastercard: { label: 'MC', className: 'text-accent' },
  amex: { label: 'AMEX', className: 'text-primary' },
  discover: { label: 'DISC', className: 'text-warning' },
  unknown: { label: '', className: '' },
}

function detectBrand(value: string): CardBrand {
  const digits = value.replace(/\D/g, '')
  if (/^4/.test(digits)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard'
  if (/^3[47]/.test(digits)) return 'amex'
  if (/^6(?:011|5)/.test(digits)) return 'discover'
  return 'unknown'
}

function formatCardNumber(value: string, brand: CardBrand) {
  const digits = value.replace(/\D/g, '').slice(0, brand === 'amex' ? 15 : 19)
  const groups = brand === 'amex' ? [4, 6, 5] : [4, 4, 4, 4, 3]
  const parts: string[] = []
  let cursor = 0
  for (const size of groups) {
    if (cursor >= digits.length) break
    parts.push(digits.slice(cursor, cursor + size))
    cursor += size
  }
  return parts.join(' ')
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`
}

const DEMO_CARD = '4242 4242 4242 4242'

/* ==========================================================================
   COUNTRIES
   ========================================================================== */

const COUNTRIES = [
  'Australia',
  'Austria',
  'Belgium',
  'Brazil',
  'Canada',
  'China',
  'Denmark',
  'France',
  'Germany',
  'Greece',
  'India',
  'Ireland',
  'Italy',
  'Japan',
  'Mexico',
  'Netherlands',
  'New Zealand',
  'Norway',
  'Poland',
  'Portugal',
  'Singapore',
  'South Korea',
  'Spain',
  'Sweden',
  'Switzerland',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
]

/**
 * Direction-aware step transition. The travel direction is read from
 * `AnimatePresence`'s `custom`, so the *exiting* panel always leaves toward the
 * side the user came from — even after a back-then-forward sequence.
 */
/* ==========================================================================
   <CheckoutFlow>
   ========================================================================== */

const NO_DAYS: AvailabilityDay[] = []

export function CheckoutFlow({
  waiver: waiverTemplate,
  nowIso,
  pickupZones = [],
  tenant,
  activity: given,
  departure: givenDeparture,
  selection: serverSelection,
  rentalDays: rentalDaysGiven = 1,
  rentalMode: rentalModeGiven,
  rentalHours: rentalHoursGiven,
  rentalLength: rentalLengthGiven,
  rentalRequest,
  party: partyGiven,
  privateBooking: privateGiven = false,
  requestedPrivate,
  slotEmpty,
  seededDays,
  slotId,
  request,
  basePath,
  reference,
}: CheckoutFlowProps) {
  const reducedMotion = useReducedMotionSafe()
  // The activity's own payment and cancellation terms, or the business defaults it follows, plus the business's own questions.
  // Prices saved in the editor count here exactly as in the widget.
  const pricedActivity = usePricingOverride(given)
  const activity = useActivityWithDefaults(pricedActivity, tenant.slug)
  // A private group's size, checked again against the saved edit: never over what its price lets come.
  const party = partyGiven === undefined ? undefined : checkoutParty(activity, partyGiven)
  const { defaults: bookingDefaults } = useBookingDefaults(tenant.slug)
  const fields = bookingDefaults.checkout

  /* ---------- the rental and the meeting point, as the owner saved them ---------- */

  // How a rental is charged (its modes, hours, days, pick-up and return) follows the saved edit, as in the widget.
  const rentalPlan = React.useMemo(
    () =>
      rentalRequest && !givenDeparture.legs && (activity.kind ?? 'trip') === 'rental'
        ? resolveRental(activity, rentalRequest, {
            startsAt: givenDeparture.slotStartsAt ?? givenDeparture.startsAt,
            endsAt: givenDeparture.slotEndsAt ?? givenDeparture.endsAt,
          })
        : undefined,
    [rentalRequest, givenDeparture, activity],
  )
  const overrides = useActivityOverrides()
  const savedSites = applyScheduleOverride(given, overrides[given.id]).locations
  const departure = React.useMemo<CheckoutDeparture>(() => {
    let next = givenDeparture
    if (rentalPlan) next = { ...next, startsAt: rentalPlan.startsAt, endsAt: rentalPlan.endsAt, returnsAt: rentalPlan.returnsAt }
    // A location's own meeting point as saved in the editor (one added there has nothing on the server).
    const meeting = next.location && next.locationId ? savedSites.find((site) => site.locationId === next.locationId)?.meetingPoint?.trim() : undefined
    if (meeting && next.location && meeting !== next.location.meetingPoint) next = { ...next, location: { ...next.location, meetingPoint: meeting } }
    return next
  }, [givenDeparture, rentalPlan, savedSites])
  const rentalMode = rentalPlan ? rentalPlan.mode : rentalModeGiven
  const rentalHours = rentalPlan ? rentalPlan.hours : rentalHoursGiven
  const rentalDays = rentalPlan ? rentalPlan.days : rentalDaysGiven
  const rentalLength = rentalPlan ? rentalPlan.lengthId : rentalLengthGiven

  /* ---------- the time slot as the widget showed it ---------- */

  // The server only knows the seeded spots: rebuild the widget's strip from the saved schedule, with this browser's bookings, and read the slot from it.
  const ledger = useBookingLedger(tenant.slug)
  // This browser's other bookings: this one, once paid, never counts against itself (so the confirmation keeps its price).
  const delta = React.useMemo(() => {
    const own = new Set(ledger.entries.filter((entry) => entry.reference === reference).map((entry) => entry.id))
    if (own.size === 0) return ledger.delta
    const changes = Object.fromEntries(Object.entries(ledger.changes).filter(([key]) => !own.has(key)))
    return seatDeltas({ entries: ledger.entries.filter((entry) => !own.has(entry.id)), changes })
  }, [ledger, reference])
  const scheduledDays = useScheduledDays(given, seededDays ?? NO_DAYS, { tenantSlug: tenant.slug, nowIso, delta })
  const rebuilt = React.useMemo(() => {
    if (departure.legs || !seededDays) return undefined
    const slots = scheduledDays.flatMap((day) => day.slots)
    for (const id of [slotId, departure.id]) {
      const found = id ? slots.find((slot) => slot.departureId === id) : undefined
      // A time slot off the schedule stays closed, even when a booking on it is cancelled here.
      if (found) return { slot: found, live: found.outsideSchedule ? found : withLedger(found, delta) }
    }
    return undefined
  }, [departure.legs, departure.id, seededDays, scheduledDays, slotId, delta])
  const liveSlot = rebuilt?.live
  const ownDelta = departure.legs ? 0 : (delta[departure.id] ?? 0)
  const seatsLeft = liveSlot
    ? liveSlot.seatsLeft
    : ownDelta
      ? Math.max(0, Math.min(departure.capacity ?? Number.POSITIVE_INFINITY, departure.seatsLeft - ownDelta))
      : departure.seatsLeft
  const capacity = liveSlot ? liveSlot.capacity : departure.capacity
  // Filling up and quiet times count real bookings (the server's and this browser's), not carts in progress or the daily limit.
  const booked = rebuilt
    ? bookedOn(rebuilt.slot, delta)
    : departure.capacity !== undefined
      ? bookedOn({ departureId: departure.id, capacity: departure.capacity, seatsLeft: departure.seatsLeft, booked: departure.booked }, delta)
      : undefined

  // The link's tickets checked against the seats the guest saw, with the editor's tiers and extras. Per group the saved
  // price decides how many can come, so a link is checked against it on a time slot further out than the strip too.
  const itemsLeft = liveSlot?.itemsLeft
  const selection = React.useMemo(
    () => (request && (liveSlot || groupPriced(activity)) ? resolveSelection(activity, request.tiers, request.addOns, Math.max(1, seatsLeft), itemsLeft, party) : serverSelection),
    [request, liveSlot, activity, seatsLeft, itemsLeft, party, serverSelection],
  )

  // Checked once the browser has read the saved schedule: a time slot it took off (cancelled, closed, its time removed) can't be booked.
  // Only within the days rebuilt; a time slot further out is left to the server.
  const hydrated = useIsHydrated()
  const stripFrom = scheduledDays[0]?.dateKey
  const stripTo = scheduledDays[scheduledDays.length - 1]?.dateKey
  const slotDay = (departure.slotStartsAt ?? departure.startsAt).slice(0, 10)
  const unavailable =
    hydrated &&
    !departure.legs &&
    Boolean(seededDays) &&
    (rebuilt ? Boolean(rebuilt.slot.outsideSchedule) : Boolean(stripFrom && stripTo && slotDay >= stripFrom && slotDay <= stripTo))

  // Private only when the priced activity offers it and nobody is booked on the time slot, the same check as the widget.
  const slotIsEmpty = liveSlot ? liveSlot.capacity > 0 && liveSlot.seatsLeft >= liveSlot.capacity : (slotEmpty ?? privateGiven)
  const privateBooking = (requestedPrivate ?? privateGiven) && Boolean(activity.privateOption?.enabled) && slotIsEmpty

  const pricing = usePricing(tenant.slug)
  // The same engine and inputs as the widget: the slot's start, the clock, how full it is, its dynamic pricing and the business's rules.
  // Group rules count people (a charter: its party), worked out by the engine.
  const quote = React.useMemo(
    () => buildQuote(activity, tenant.slug, selection, departure.priceMultiplier, {
      days: rentalDays,
      party,
      private: privateBooking,
      ...(rentalMode ? { rentalMode, hours: rentalHours, lengthId: rentalLength } : {}),
      startsAt: departure.slotStartsAt ?? departure.startsAt,
      nowIso,
      capacity,
      booked,
      businessRules: pricing.rules,
    }),
    [activity, tenant.slug, selection, departure.priceMultiplier, departure.slotStartsAt, departure.startsAt, capacity, booked, nowIso, pricing.rules, rentalDays, party, rentalMode, rentalHours, rentalLength, privateBooking],
  )

  const [errors, setErrors] = React.useState<Errors>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [confirmed, setConfirmed] = React.useState(false)
  const [summaryOpen, setSummaryOpen] = React.useState(false)

  /* ---------- form state ---------- */

  const [guest, setGuest] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: COUNTRIES.includes(tenant.country) ? tenant.country : 'United States',
    requests: '',
  })

  const [payment, setPayment] = React.useState({
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
    billingCountry: COUNTRIES.includes(tenant.country) ? tenant.country : 'United States',
  })

  const brand = detectBrand(payment.cardNumber)

  /* ---------- guests and waiver ---------- */

  const details = React.useMemo(() => guestDetailsOf(activity), [activity])
  const signing = activity.waiverSigning ?? 'booker'
  // With guest details off, each-guest questions are asked once, of the person booking.
  const questions = React.useMemo(() => {
    const all = [...(activity.guestQuestions ?? []), ...riderQuestions(activity)]
    return details.enabled ? all : all.map((question) => (question.scope === 'guest' ? { ...question, scope: 'booking' as const } : question))
  }, [activity, details.enabled])
  const travellerCount = Math.max(1, details.enabled && (activity.kind ?? 'trip') !== 'rental' ? quote.party : 1)
  const [travellers, setTravellers] = React.useState<TravellerState[]>(() => makeTravellers(travellerCount))
  // The party can change once the saved schedule and prices load: one card per guest, keeping what is filled in.
  React.useEffect(() => {
    setTravellers((current) =>
      current.length === travellerCount
        ? current
        : current.length > travellerCount
          ? current.slice(0, travellerCount)
          : [...current, ...makeTravellers(travellerCount - current.length)],
    )
  }, [travellerCount])
  const [bookingAnswers, setBookingAnswers] = React.useState<Record<string, string>>({})
  const [waiver, setWaiver] = React.useState<WaiverState>(EMPTY_WAIVER)
  const signers = waiverTemplate && signing === 'each' ? signerDefaults(travellers, Math.max(1, quote.party)) : []
  /** Guest cards only when there is something to ask beyond the booker's own contact details. */
  const showGuests =
    details.enabled &&
    (travellers.length > 1 || questions.some((question) => question.scope === 'guest') || details.fields.some((field) => field.key === 'dateOfBirth' || field.key === 'country'))
  const needsDetails = questions.length > 0 || Boolean(waiverTemplate) || showGuests

  /* ---------- pickup ---------- */

  const pickupRequired = Boolean(activity.pickup?.required)
  const [pickup, setPickup] = React.useState<PickupChoice>(() => ({ ...EMPTY_PICKUP, mode: pickupRequired ? 'pickup' : 'meet' }))
  const pickupZone = pickupZones.find((zone) => zone.id === pickup.zoneId)
  const pickupPerBooking = pickupZone?.feePer === 'booking'
  const pickupFee = (pickup.mode === 'pickup' || pickupRequired) && pickupZone ? pickupZone.fee * (pickupPerBooking ? 1 : quote.party) : 0
  /** The quote with the pickup fee on it, for the summary and the pay button. */
  const withPickup = React.useMemo(
    () =>
      pickupFee > 0 && pickupZone
        ? {
            ...quote,
            addOnLines: [
              ...quote.addOnLines,
              { id: 'pickup', label: `Hotel pickup · ${pickupZone.name}`, kind: 'addon' as const, quantity: pickupPerBooking ? 1 : quote.party, unitPrice: pickupZone.fee, total: pickupFee },
            ],
            subtotal: quote.subtotal + pickupFee,
            total: quote.total + pickupFee,
          }
        : quote,
    [quote, pickupFee, pickupZone, pickupPerBooking],
  )

  /* ---------- promo code and gift card ---------- */

  const todayKey = (nowIso ?? departure.startsAt).slice(0, 10)
  const [promoCode, setPromoCode] = React.useState<string | null>(null)
  const [giftCode, setGiftCode] = React.useState<string | null>(null)
  const promo = findPromo(pricing.promos, promoCode)
  const card = pricing.giftCards.find((entry) => entry.code === giftCode)
  const itemsSubtotal = [...quote.ticketLines, ...quote.addOnLines].reduce((sum, line) => sum + line.total, 0)
  const promoOff = promo && !promoProblem(promo, { activitySlug: activity.slug, subtotal: itemsSubtotal, todayKey }) ? promoDiscount(promo, itemsSubtotal) : 0
  /* ---------- tip, on what the guest is buying, after any promo code ---------- */
  const [tipChoice, setTipChoice] = React.useState<TipChoice>('none')
  const [customTip, setCustomTip] = React.useState('')
  const tipBase = Math.max(0, itemsSubtotal - promoOff)
  const tip = !activity.tips
    ? 0
    : tipChoice === 'custom'
      ? // Typed in dollars (major units); kept in cents like every other amount.
        Math.max(0, Math.round((Number.parseFloat(customTip) || 0) * 100))
      : tipChoice === 'none'
        ? 0
        : Math.round((tipBase * Number(tipChoice)) / 100)
  const giftOff = card && !giftProblem(card, todayKey) ? Math.min(card.balance, Math.max(0, withPickup.total + tip - promoOff)) : 0
  const displayQuote = React.useMemo(() => {
    if (promoOff === 0 && giftOff === 0 && tip === 0) return withPickup
    const lines = [...withPickup.addOnLines]
    if (tip > 0) lines.push({ id: 'tip', label: tipChoice === 'custom' ? 'Tip for the team' : `Tip for the team · ${tipChoice}%`, kind: 'addon' as const, quantity: 1, unitPrice: tip, total: tip })
    if (promoOff > 0 && promo) lines.push({ id: 'promo', label: `Code ${promo.code}`, kind: 'addon' as const, quantity: 1, unitPrice: -promoOff, total: -promoOff })
    if (giftOff > 0 && card) lines.push({ id: 'gift', label: `Gift card …${card.code.slice(-4)}`, kind: 'addon' as const, quantity: 1, unitPrice: -giftOff, total: -giftOff })
    return { ...withPickup, addOnLines: lines, subtotal: withPickup.subtotal + tip, total: Math.max(0, withPickup.total + tip - promoOff - giftOff) }
  }, [withPickup, promoOff, giftOff, promo, card, tip, tipChoice])
  /* ---------- how they pay: in full, a deposit, or on the day ---------- */
  const offered = paymentOf(activity)
  // Booked after the balance would be due: everything is paid now.
  const lateForDeposit =
    offered.collect === 'deposit' && new Date(departure.startsAt).getTime() - offered.balanceDueDays * 86_400_000 <= new Date(nowIso ?? departure.startsAt).getTime()
  const terms = lateForDeposit ? { ...offered, collect: 'full' as const } : offered
  const [payInFull, setPayInFull] = React.useState(false)
  const split = splitPayment(terms, displayQuote.total, Math.max(1, quote.party), payInFull)
  const balanceDate = (() => {
    const date = new Date(departure.startsAt)
    if (terms.collect === 'deposit') date.setDate(date.getDate() - terms.balanceDueDays)
    return date.toISOString()
  })()
  const balanceWhen = terms.collect === 'later' || terms.balanceDueDays === 0 ? 'on the day' : `on ${formatDateLong(balanceDate)}`
  const optIn = useCheckoutOptIn(tenant)
  const finishPayment = () => {
    // Take the seats: one entry per part for a package, so each activity's own count drops.
    const legs = departure.legs ?? [{ departureId: departure.id, activitySlug: activity.slug, activityName: activity.name, label: activity.name, startsAt: departure.startsAt, endsAt: departure.endsAt, meetingPoint: meetingPointFor(activity, departure) }]
    recordBooking(
      tenant.slug,
      legs.map((leg, index) => ({
        id: legs.length > 1 ? `${reference}-${index + 1}` : reference,
        reference,
        activitySlug: leg.activitySlug,
        activityName: leg.activityName,
        departureId: leg.departureId,
        startsAt: leg.startsAt,
        endsAt: leg.endsAt,
        // A private booking takes the whole time, so nobody else can book onto it.
        party: privateBooking ? Math.max(quote.party, seatsLeft) : Math.max(1, quote.party),
        source: 'storefront' as const,
        ...(departure.legs ? { packageSlug: activity.slug, packageName: activity.name } : {}),
        name: `${guest.firstName} ${guest.lastName}`.trim(),
        email: guest.email,
        phone: guest.phone,
        total: index === 0 ? displayQuote.total : 0,
        paidNow: index === 0 ? split.now : 0,
        currency: tenant.currency,
        createdAt: nowIso ?? new Date().toISOString().slice(0, 19),
      })),
    )
    optIn.record(guest.email, guest.phone)
    pricing.recordRedemption(promoOff > 0 ? promo?.code : undefined, giftOff > 0 && card ? { code: card.code, amount: giftOff } : undefined)
    setConfirmed(true)
  }
  void PICKUP_OTHER

  /* ---------- validation and payment, one page ---------- */

  const focusFirstInvalid = () => {
    window.requestAnimationFrame(() => {
      const control = document.querySelector<HTMLElement>('[aria-invalid="true"]')
      control?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' })
      control?.focus({ preventScroll: true })
    })
  }

  /** Both schemas at once, so a guest sees every problem in one pass. */
  const validate = (scope: 'guest' | 'all'): boolean => {
    const next: Errors = {}
    const guestResult = guestSchemaFor(fields).safeParse(guest)
    if (!guestResult.success) Object.assign(next, collectErrors(guestResult.error.issues))
    Object.assign(
      next,
      validateGuestDetails({
        questions,
        travellers: showGuests ? travellers : travellers.slice(0, 1),
        bookingAnswers,
        waiver,
        template: waiverTemplate,
        fields: details.fields,
        signing,
        signers,
      }),
    )
    if (pickupZones.length > 0) Object.assign(next, validatePickup(pickup, pickupRequired))
    if (scope === 'all' && displayQuote.total > 0) {
      const paymentResult = paymentSchema.safeParse(payment)
      if (!paymentResult.success) Object.assign(next, collectErrors(paymentResult.error.issues))
    }
    setErrors(next)
    if (Object.keys(next).length > 0) {
      focusFirstInvalid()
      return false
    }
    return true
  }

  const pay = () => {
    if (!validate('all')) return
    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      finishPayment()
      window.scrollTo({ top: 0, behavior: 'auto' })
    }, 1400)
  }

  const expressPay = (method: string) => {
    if (!validate('guest')) {
      toast.error('Add your contact details first, so we know where to send the tickets')
      return
    }
    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      finishPayment()
      toast.success(`Paid with ${method}`)
    }, 1100)
  }

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(reference)
      toast.success('Confirmation code copied')
    } catch {
      toast.error('Could not copy — write it down instead')
    }
  }

  if (confirmed) {
    return (
      <Confirmation
        paid={split}
        balanceWhen={balanceWhen}
        tenant={tenant}
        activity={activity}
        departure={departure}
        quote={displayQuote}
        guest={guest}
        reference={reference}
        basePath={basePath}
        onCopy={copyReference}
        reducedMotion={reducedMotion}
      />
    )
  }

  if (unavailable) {
    return (
      <div className="mx-auto w-full max-w-[88rem] px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:px-10">
        <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-8 text-center">
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">This time is no longer available</h1>
          <p className="text-sm text-muted">Pick another time for {activity.name}.</p>
          <Button asChild className="mt-2" leftIcon={<ArrowLeft aria-hidden="true" />}>
            <Link href={`${basePath}/${activity.slug}`}>See other times</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-[88rem] px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:px-10">
      {/* ---------- breadcrumb ---------- */}
      <Link
        href={`${basePath}/${activity.slug}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to {activity.name}
      </Link>

      <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* ==================== form column ==================== */}
        <div className="min-w-0">
          <h1 className="font-display text-display-sm font-semibold tracking-tight text-foreground">
            Secure checkout
          </h1>
          <p className="mt-2 text-sm text-muted">
            Your details and payment on one page. Your spots are held for the next 15 minutes.
          </p>

          {/* ---------- mobile summary ---------- */}
          <MobileSummary
            open={summaryOpen}
            onToggle={() => setSummaryOpen((value) => !value)}
            activity={activity}
            tenant={tenant}
            departure={departure}
            quote={displayQuote}
            reducedMotion={reducedMotion}
          />

          {/* ---------- details, then payment, one page ---------- */}
          <div className="mt-8 space-y-10">
            <div className="space-y-4">
              <GuestStep guest={guest} setGuest={setGuest} errors={errors} fields={fields} />
              <CheckoutOptIn optIn={optIn} />
            </div>
            <CheckoutDiscounts
              promos={pricing.promos}
              giftCards={pricing.giftCards}
              activitySlug={activity.slug}
              subtotal={itemsSubtotal}
              todayKey={todayKey}
              currency={tenant.currency}
              promoCode={promoCode}
              giftCode={giftCode}
              onPromo={setPromoCode}
              onGift={setGiftCode}
              promoOff={promoOff}
              giftOff={giftOff}
              rules={pricing.rules.filter((rule) => quote.appliedChanges.some((change) => change.source === 'business' && change.id === rule.id))}
            />
            {pickupZones.length > 0 ? (
              <div className="border-t border-line-subtle pt-10">
                <CheckoutPickup
                  zones={pickupZones}
                  required={pickupRequired}
                  meetingPoint={departure.location?.meetingPoint ?? activity.meetingPoint}
                  startsAt={departure.startsAt}
                  guests={quote.party}
                  currency={tenant.currency}
                  choice={pickup}
                  setChoice={setPickup}
                  errors={errors}
                />
              </div>
            ) : null}
            {needsDetails ? (
              <div className="space-y-10 border-t border-line-subtle pt-10">
                <GuestDetailsStep
                  questions={questions}
                  travellers={travellers}
                  setTravellers={setTravellers}
                  bookingAnswers={bookingAnswers}
                  setBookingAnswers={setBookingAnswers}
                  leadName={`${guest.firstName} ${guest.lastName}`}
                  minorAge={waiverTemplate?.minorAge ?? 18}
                  errors={errors}
                  fields={details.fields}
                  showGuests={showGuests}
                  showMinor={Boolean(waiverTemplate)}
                  onDate={departure.startsAt}
                />
                {waiverTemplate ? (
                  <WaiverStep
                    template={waiverTemplate}
                    waiver={waiver}
                    setWaiver={setWaiver}
                    hasMinors={travellers.some((traveller) => traveller.minor)}
                    errors={errors}
                    signing={signing}
                    signers={signers}
                  />
                ) : null}
              </div>
            ) : null}
            {activity.tips ? (
              <div className="border-t border-line-subtle pt-10">
                <TipStep
                  base={tipBase}
                  currency={tenant.currency}
                  choice={tipChoice}
                  setChoice={setTipChoice}
                  customTip={customTip}
                  setCustomTip={setCustomTip}
                  tip={tip}
                />
              </div>
            ) : null}
            {terms.collect !== 'full' && displayQuote.total > 0 ? (
              <div className="border-t border-line-subtle pt-10">
                <PayWhenStep
                  terms={terms}
                  total={displayQuote.total}
                  split={splitPayment(terms, displayQuote.total, Math.max(1, quote.party), false)}
                  payInFull={payInFull}
                  setPayInFull={setPayInFull}
                  balanceWhen={balanceWhen}
                  currency={tenant.currency}
                />
              </div>
            ) : null}
            <div className="border-t border-line-subtle pt-10">
              <PaymentStep
                later={split.later}
                balanceWhen={balanceWhen}
                payment={payment}
                setPayment={setPayment}
                errors={errors}
                brand={brand}
                activity={activity}
                tenant={tenant}
                total={split.now}
                submitting={submitting}
                onExpressPay={expressPay}
              />
            </div>
          </div>

          {activity.customRequests ? (
            <div className="mt-8 lg:hidden">
              <CustomQuoteCard activity={activity} tenantSlug={tenant.slug} departure={departure} guest={guest} />
            </div>
          ) : null}

          {/* ---------- actions ---------- */}
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button asChild variant="ghost" leftIcon={<ArrowLeft aria-hidden="true" />}>
              <Link href={`${basePath}/${activity.slug}`}>Change booking</Link>
            </Button>
            <Button
              size="lg"
              onClick={pay}
              loading={submitting}
              leftIcon={<Lock aria-hidden="true" />}
              className="sm:min-w-52"
            >
              {split.now > 0
                ? `Pay ${formatCurrency(split.now, tenant.currency, { decimals: true })}${split.later > 0 ? ' now' : ''}`
                : 'Confirm booking'}
            </Button>
          </div>
        </div>

        {/* ==================== summary rail ==================== */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <OrderSummary
              activity={activity}
              tenant={tenant}
              departure={departure}
              quote={displayQuote}
              split={split}
              balanceWhen={balanceWhen}
            />
            {activity.customRequests ? <CustomQuoteCard activity={activity} tenantSlug={tenant.slug} departure={departure} guest={guest} /> : null}
          </div>
        </aside>
      </div>
    </div>
  )
}

/* ==========================================================================
   TIP — optional, on the tickets and extras after any promo code. The
   percentages show what they come to; Custom takes any amount.
   ========================================================================== */

const TIP_PERCENTS = ['5', '10', '15', '20', '25'] as const
type TipChoice = 'none' | 'custom' | (typeof TIP_PERCENTS)[number]

function TipStep({
  base,
  currency,
  choice,
  setChoice,
  customTip,
  setCustomTip,
  tip,
}: {
  base: number
  currency: Tenant['currency']
  choice: TipChoice
  setChoice: (choice: TipChoice) => void
  customTip: string
  setCustomTip: (value: string) => void
  tip: number
}) {
  const money = (amount: number) => formatCurrency(amount, currency, { decimals: amount % 100 !== 0 })
  const chip = (active: boolean) =>
    cn(
      'flex min-h-14 flex-col items-center justify-center rounded-xl border px-2 py-2 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
      active ? 'border-primary bg-primary-soft/40 text-foreground' : 'border-line bg-surface text-foreground hover:border-line-strong',
    )
  return (
    <section aria-labelledby="step-tip" className="space-y-4">
      <div>
        <h2 id="step-tip" className="font-display text-xl font-semibold tracking-tight">
          Add a tip for the team
        </h2>
        <p className="mt-1.5 text-sm text-muted">Optional. Every cent goes to the team who look after you on the day.</p>
      </div>
      <div role="radiogroup" aria-label="Tip" className="grid grid-cols-3 gap-2 sm:grid-cols-7">
        <button type="button" role="radio" aria-checked={choice === 'none'} className={chip(choice === 'none')} onClick={() => setChoice('none')}>
          <span className="text-sm font-semibold">No tip</span>
        </button>
        {TIP_PERCENTS.map((percent) => (
          <button key={percent} type="button" role="radio" aria-checked={choice === percent} className={chip(choice === percent)} onClick={() => setChoice(percent)}>
            <span className="text-sm font-semibold">{percent}%</span>
            <span className="text-xs text-muted">{money(Math.round((base * Number(percent)) / 100))}</span>
          </button>
        ))}
        <button type="button" role="radio" aria-checked={choice === 'custom'} className={chip(choice === 'custom')} onClick={() => setChoice('custom')}>
          <span className="text-sm font-semibold">Custom</span>
        </button>
      </div>
      {choice === 'custom' ? (
        <Field label="Tip amount" description="Any amount you like.">
          {(control) => (
            <Input
              {...control}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              className="sm:w-56"
              leftIcon={<span className="text-sm text-muted">{currencySymbol(currency)}</span>}
              value={customTip}
              placeholder="0"
              onChange={(e) => setCustomTip(e.target.value)}
            />
          )}
        </Field>
      ) : null}
      {tip > 0 ? <p className="text-sm text-muted">Thank you. {money(tip)} is added to your total.</p> : null}
    </section>
  )
}

/* ==========================================================================
   CUSTOM QUOTE — when the activity accepts custom requests, a guest can ask
   for something different instead of paying now. Lands in Custom requests.
   ========================================================================== */

function CustomQuoteCard({
  activity,
  tenantSlug,
  departure,
  guest,
}: {
  activity: Activity
  tenantSlug: string
  departure: CheckoutDeparture
  guest: { firstName: string; lastName: string; email: string; phone: string }
}) {
  const [open, setOpen] = React.useState(false)
  const [sent, setSent] = React.useState(false)
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')
  const name = `${guest.firstName} ${guest.lastName}`.trim()

  const send = () => {
    if (name.length < 2 || !/^S+@S+.S+$/.test(guest.email)) return setError('Add your name and email in Your details first.')
    if (message.trim().length < 5) return setError('Tell us what you have in mind.')
    try {
      const key = `ezra:charter-requests:${tenantSlug}`
      const list = JSON.parse(window.localStorage.getItem(key) ?? '[]') as unknown[]
      list.unshift({
        id: `req_${Date.now().toString(36)}`,
        activitySlug: activity.slug,
        departureId: departure.id,
        startsAt: departure.startsAt,
        party: 1,
        name,
        email: guest.email,
        phone: guest.phone,
        message: message.trim(),
        createdAt: new Date().toISOString(),
      })
      window.localStorage.setItem(key, JSON.stringify(list.slice(0, 50)))
    } catch {
      /* storage blocked: the request still shows as sent */
    }
    setSent(true)
  }

  return (
    <div className="mt-4 rounded-xl border border-line bg-surface p-4">
      {sent ? (
        <>
          <p className="text-sm font-semibold text-foreground">Request sent</p>
          <p className="mt-1 text-xs text-muted">We&rsquo;ll reply to {guest.email} with a quote. You haven&rsquo;t been charged.</p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-foreground">Want something different?</p>
          <p className="mt-1 text-xs text-muted">A bigger group, a private version or another date. Ask for a custom quote instead of paying now.</p>
          {open ? (
            <div className="mt-3 space-y-2">
              <Textarea
                rows={3}
                value={message}
                onChange={(event) => { setMessage(event.target.value); setError('') }}
                placeholder="What would you like?"
                aria-label="What would you like?"
              />
              {error ? <p className="text-xs text-danger">{error}</p> : null}
              <div className="flex gap-2">
                <Button size="sm" onClick={send}>Send request</Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
              Ask for a custom quote
            </Button>
          )}
        </>
      )}
    </div>
  )
}

/* ==========================================================================
   STEP 1 — GUEST DETAILS
   ========================================================================== */

type GuestState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  requests: string
}

function GuestStep({
  guest,
  setGuest,
  errors,
  fields,
}: {
  guest: GuestState
  setGuest: React.Dispatch<React.SetStateAction<GuestState>>
  errors: Errors
  fields: CheckoutFields
}) {
  const set = (key: keyof GuestState) => (value: string) =>
    setGuest((prev) => ({ ...prev, [key]: value }))

  return (
    <section aria-labelledby="step-guest" className="space-y-5">
      <div>
        <h2 id="step-guest" className="font-display text-xl font-semibold tracking-tight">
          Who is the booking for?
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          We send the tickets and any weather updates here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.firstName} required>
          <Input
            value={guest.firstName}
            onChange={(e) => set('firstName')(e.target.value)}
            autoComplete="given-name"
            placeholder="Maia"
          />
        </Field>
        <Field label="Last name" error={errors.lastName} required>
          <Input
            value={guest.lastName}
            onChange={(e) => set('lastName')(e.target.value)}
            autoComplete="family-name"
            placeholder="Fletcher"
          />
        </Field>
        <Field
          label="Email"
          error={errors.email}
          description="Your confirmation lands here in seconds."
          required
        >
          <Input
            type="email"
            inputMode="email"
            value={guest.email}
            onChange={(e) => set('email')(e.target.value)}
            autoComplete="email"
            placeholder="maia@example.com"
          />
        </Field>
        {fields.phone === 'off' ? null : (
          <Field label="Mobile" error={errors.phone} description="For day-of updates only." required={fields.phone === 'required'} optional={fields.phone === 'optional'}>
            <Input
              type="tel"
              inputMode="tel"
              value={guest.phone}
              onChange={(e) => set('phone')(e.target.value)}
              autoComplete="tel"
              placeholder="+1 808 555 0134"
            />
          </Field>
        )}
      </div>

      {fields.country === 'off' ? null : (
      <Field label="Country of residence" error={errors.country} required={fields.country === 'required'} optional={fields.country === 'optional'}>
        {(control) => (
          <Select value={guest.country} onValueChange={set('country')}>
            <SelectTrigger id={control.id} aria-invalid={control['aria-invalid']}>
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((country) => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>
      )}

      {fields.requests === 'off' ? null : (
      <Field
        label="Anything we should know?"
        optional={fields.requests === 'optional'}
        required={fields.requests === 'required'}
        error={errors.requests}
        description="Allergies, nervous swimmers, birthdays, accessibility needs."
        hint={`${guest.requests.length}/500`}
      >
        <Textarea
          value={guest.requests}
          onChange={(e) => set('requests')(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="Celebrating our anniversary — no fuss needed, we're just happy to be here."
        />
      </Field>
      )}
    </section>
  )
}

/* ==========================================================================
   STEP 3 — PAYMENT
   ========================================================================== */

type PaymentState = {
  cardName: string
  cardNumber: string
  expiry: string
  cvc: string
  billingCountry: string
}

function PaymentStep({
  payment,
  setPayment,
  errors,
  brand,
  activity,
  tenant,
  total,
  submitting,
  onExpressPay,
  later = 0,
  balanceWhen = 'later',
}: {
  /** What is left to pay after today, and when. */
  later?: number
  balanceWhen?: string
  payment: PaymentState
  setPayment: React.Dispatch<React.SetStateAction<PaymentState>>
  errors: Errors
  brand: CardBrand
  activity: Activity
  tenant: Tenant
  total: number
  submitting: boolean
  onExpressPay: (method: string) => void
}) {
  const set = (key: keyof PaymentState) => (value: string) =>
    setPayment((prev) => ({ ...prev, [key]: value }))

  return (
    <section aria-labelledby="step-payment" className="space-y-6">
      <div>
        <h2 id="step-payment" className="font-display text-xl font-semibold tracking-tight">
          Payment
        </h2>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
          <Lock className="size-3.5 text-success" aria-hidden="true" />
          Encrypted end to end. We never store your card.
        </p>
      </div>

      {/* ---------- express ---------- */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => onExpressPay('Apple Pay')}
          className={cn(
            'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-semibold text-white',
            'transition-all duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:shadow-lg',
            'disabled:pointer-events-none disabled:opacity-50',
            'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
        >
          <AppleMark />
          Pay
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => onExpressPay('Google Pay')}
          className={cn(
            'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-sm font-semibold text-foreground',
            'transition-all duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:shadow-lg',
            'disabled:pointer-events-none disabled:opacity-50',
            'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
        >
          <GoogleMark />
          Pay
        </button>
      </div>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs font-medium uppercase tracking-[0.1em] text-faint">
          or pay by card
        </span>
        <Separator className="flex-1" />
      </div>

      {/* ---------- card ---------- */}
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <Field label="Name on card" error={errors.cardName} required>
          <Input
            value={payment.cardName}
            onChange={(e) => set('cardName')(e.target.value)}
            autoComplete="cc-name"
            placeholder="M FLETCHER"
          />
        </Field>

        <Field
          label="Card number"
          error={errors.cardNumber}
          required
          hint={
            <button
              type="button"
              onClick={() => set('cardNumber')(DEMO_CARD)}
              className="text-xs font-semibold text-primary transition-colors hover:text-primary-hover"
            >
              Use demo card
            </button>
          }
        >
          <Input
            value={payment.cardNumber}
            onChange={(e) => set('cardNumber')(formatCardNumber(e.target.value, detectBrand(e.target.value)))}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            leftIcon={<CreditCard aria-hidden="true" />}
            suffix={
              brand === 'unknown' ? null : (
                <span
                  className={cn(
                    'rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-bold tracking-wider',
                    BRAND_META[brand].className,
                  )}
                >
                  {BRAND_META[brand].label}
                </span>
              )
            }
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Expiry" error={errors.expiry} required>
            <Input
              value={payment.expiry}
              onChange={(e) => set('expiry')(formatExpiry(e.target.value))}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="09 / 29"
            />
          </Field>
          <Field label="CVC" error={errors.cvc} required>
            <Input
              value={payment.cvc}
              onChange={(e) => set('cvc')(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
            />
          </Field>
        </div>

        <Field label="Billing country" error={errors.billingCountry} required>
          {(control) => (
            <Select value={payment.billingCountry} onValueChange={set('billingCountry')}>
              <SelectTrigger id={control.id} aria-invalid={control['aria-invalid']}>
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>

      {/* ---------- policy restated ---------- */}
      <div className="rounded-2xl bg-surface-sunken p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="size-4 text-success" aria-hidden="true" />
          {activity.cancellationPolicy.freeCancellationHours > 0
            ? `Free cancellation up to ${hoursLabel(activity.cancellationPolicy.freeCancellationHours)} before`
            : 'Non-refundable'}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          {activity.cancellationPolicy.summary}{' '}
          {total > 0 ? (
            <>
              Your card is charged {formatCurrency(total, tenant.currency, { decimals: true })} today
              {later > 0 ? ` and ${formatCurrency(later, tenant.currency, { decimals: true })} ${balanceWhen}` : ''} in {tenant.currency} by {tenant.legalName}.
            </>
          ) : (
            <>Nothing is charged today; the card holds the booking and {formatCurrency(later, tenant.currency, { decimals: true })} is paid {balanceWhen}.</>
          )}{' '}
          By booking you accept the liability waiver on behalf of everyone in your party.
        </p>
      </div>
    </section>
  )
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.8c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.7 0-1.6-.8-2.7-.7-1.4 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1-.1 1.4-.6 2.6-.6s1.5.6 2.6.6 1.8-1 2.4-2c.8-1.1 1.1-2.2 1.1-2.3 0 0-2.1-.8-2.1-3.2ZM14.5 6.4c.6-.7 1-1.6.9-2.6-.8 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.5.9.1 1.8-.4 2.5-1.2Z" />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"
        className="fill-info"
      />
      <path
        d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
        className="fill-success"
      />
      <path
        d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z"
        className="fill-warning"
      />
      <path
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.6 9.4 5.9 12 5.9Z"
        className="fill-danger"
      />
    </svg>
  )
}

/* ==========================================================================
   ORDER SUMMARY
   ========================================================================== */

type QuoteShape = ReturnType<typeof buildQuote>

function SummaryLines({
  quote,
  tenant,
}: {
  quote: QuoteShape
  tenant: Tenant
}) {
  return (
    <>
      <ul className="space-y-2 text-sm">
        {[...quote.ticketLines, ...quote.addOnLines].map((line) => (
          <li key={line.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-muted">
              {line.label}
              {line.total >= 0 && line.id !== 'tip' && line.id !== 'minimum' ? (
                <span className="ml-1.5 text-xs text-faint">
                  {line.quantity} × {formatCurrency(line.unitPrice, tenant.currency)}
                </span>
              ) : null}
              {/* The group price's description, as the owner wrote it. */}
              {line.note ? <span className="block truncate text-xs text-subtle">{line.note}</span> : null}
            </span>
            <span className="shrink-0 tabular font-medium text-foreground">
              {formatCurrency(line.total, tenant.currency)}
            </span>
          </li>
        ))}
      </ul>
      {/* The activity's own price changes: "Summer +15% · Book early −10%". Business rules are listed under the discounts; dynamic pricing is left out. */}
      {quote.appliedChanges.some((change) => change.source === 'activity') ? (
        <p className="mt-2 text-xs text-subtle">
          {quote.appliedChanges
            .filter((change) => change.source === 'activity')
            .map((change) => change.label)
            .join(' · ')}
        </p>
      ) : null}

      <div className="mt-3 space-y-1.5 border-t border-line-subtle pt-3 text-xs text-muted">
        <div className="flex items-baseline justify-between gap-3">
          <span>Subtotal</span>
          <span className="tabular">{formatCurrency(quote.subtotal, tenant.currency)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span>{quote.feeLabel}</span>
          <span className="tabular">{formatCurrency(quote.feeTotal, tenant.currency)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span>{quote.taxLabel}</span>
          <span className="tabular">{formatCurrency(quote.taxTotal, tenant.currency)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
        <span className="text-sm font-semibold text-foreground">Total</span>
        <span className="font-display text-xl font-semibold tabular tracking-tight text-foreground">
          {formatCurrency(quote.total, tenant.currency, { decimals: true })}
        </span>
      </div>
    </>
  )
}

function OrderSummary({
  activity,
  tenant,
  departure,
  quote,
  split,
  balanceWhen = 'later',
}: {
  activity: Activity
  tenant: Tenant
  departure: CheckoutDeparture
  quote: QuoteShape
  /** What is paid today and what is left, when not everything is paid now. */
  split?: { now: number; later: number }
  balanceWhen?: string
}) {
  const media = activity.media.find((m) => m.isPrimary) ?? activity.media[0]

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
      <div className="flex gap-3 border-b border-line-subtle p-4">
        <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface-sunken">
          {media ? (
            <Image src={media.url} alt={media.alt} fill sizes="80px" className="object-cover" />
          ) : null}
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {activity.name}
          </p>
          <p className="mt-1 truncate text-xs text-subtle">{tenant.name}</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted">
            <Clock className="size-3" aria-hidden="true" />
            {departure.returnsAt ? `${quote.days}-day rental` : quote.lengthLabel ? quote.lengthLabel : quote.hours ? `${quote.hours}-hour rental` : formatDuration(activity.durationMinutes)}
          </p>
        </div>
      </div>

      <dl className="space-y-2.5 border-b border-line-subtle p-4 text-sm">
        <div className="flex items-start gap-2.5">
          <CalendarPlus className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="sr-only">Date and time</dt>
            {departure.legs ? (
              <dd>
                <LegList legs={departure.legs} compact />
              </dd>
            ) : departure.returnsAt ? (
              <>
                <dd className="font-medium text-foreground">Pick up {formatDateLong(departure.startsAt)} · {formatTime(departure.startsAt)}</dd>
                <dd className="font-medium text-foreground">Return {formatDateLong(departure.returnsAt)} · {formatTime(departure.returnsAt)}</dd>
              </>
            ) : (
              <>
                <dd className="font-medium text-foreground">{formatDateLong(departure.startsAt)}</dd>
                <dd className="text-xs text-subtle tabular">
                  {formatTime(departure.startsAt)} – {formatTime(departure.endsAt)} ·{' '}
                  {tenant.timezone.split('/').pop()?.replace(/_/g, ' ')}
                </dd>
              </>
            )}
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Users className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="sr-only">Party</dt>
            <dd className="text-muted">{quote.countLabel}</dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="sr-only">Meeting point</dt>
            <dd className="text-xs leading-relaxed text-muted">
              {departure.legs ? 'Each part meets at its own place, listed above.' : (
                <>
                  {departure.location ? <span className="block font-medium text-foreground">{departure.location.name}</span> : null}
                  {meetingPointFor(activity, departure)}
                </>
              )}
            </dd>
          </div>
        </div>
      </dl>

      <div className="p-4">
        <SummaryLines quote={quote} tenant={tenant} />
        {split && split.later > 0 ? (
          <dl className="mt-3 space-y-1 border-t border-line-subtle pt-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="font-semibold text-foreground">Due today</dt>
              <dd className="font-semibold tabular text-foreground">{formatCurrency(split.now, tenant.currency, { decimals: true })}</dd>
            </div>
            <div className="flex justify-between gap-3 text-muted">
              <dt>Due {balanceWhen}</dt>
              <dd className="tabular">{formatCurrency(split.later, tenant.currency, { decimals: true })}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div className="flex items-center gap-2 border-t border-line-subtle bg-surface-sunken px-4 py-3">
        <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted">
          {activity.cancellationPolicy.freeCancellationHours > 0 ? `Free cancellation up to ${hoursLabel(activity.cancellationPolicy.freeCancellationHours)} before` : 'Non-refundable'} ·
          instant confirmation
        </p>
      </div>
    </div>
  )
}

function MobileSummary({
  open,
  onToggle,
  activity,
  tenant,
  departure,
  quote,
  reducedMotion,
}: {
  open: boolean
  onToggle: () => void
  activity: Activity
  tenant: Tenant
  departure: CheckoutDeparture
  quote: QuoteShape
  reducedMotion: boolean
}) {
  const media = activity.media.find((m) => m.isPrimary) ?? activity.media[0]

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface lg:hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
          {media ? (
            <Image src={media.url} alt="" fill sizes="48px" className="object-cover" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {activity.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-subtle tabular">
            {formatDateLong(departure.startsAt)} · {formatTime(departure.startsAt)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-base font-semibold tabular text-foreground">
            {formatCurrency(quote.total, tenant.currency)}
          </span>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            {open ? 'Hide' : 'Details'}
            <ChevronDown
              className={cn('size-3 transition-transform duration-300', open && 'rotate-180')}
              aria-hidden="true"
            />
          </span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-line-subtle p-4">
              <SummaryLines quote={quote} tenant={tenant} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/* ==========================================================================
   CONFIRMATION
   ========================================================================== */

/** Fixed offsets — a seeded burst, never Math.random, so SSR and client agree. */
const BURST = [
  { x: -74, y: -34, d: 0.02, tone: 'bg-primary' },
  { x: 68, y: -48, d: 0.06, tone: 'bg-accent' },
  { x: -96, y: 26, d: 0.1, tone: 'bg-warning' },
  { x: 92, y: 18, d: 0.14, tone: 'bg-success' },
  { x: -42, y: -76, d: 0.18, tone: 'bg-accent' },
  { x: 46, y: -80, d: 0.22, tone: 'bg-primary' },
  { x: -110, y: -8, d: 0.26, tone: 'bg-success' },
  { x: 112, y: -14, d: 0.3, tone: 'bg-warning' },
]

function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** "2026-09-18T07:30:00" → "20260918T073000" */
function icsStamp(localIso: string) {
  return localIso.replace(/[-:]/g, '').slice(0, 15)
}

function Confirmation({
  paid,
  balanceWhen = 'later',
  tenant,
  activity,
  departure,
  quote,
  guest,
  reference,
  basePath,
  onCopy,
  reducedMotion,
}: {
  tenant: Tenant
  activity: Activity
  departure: CheckoutDeparture
  quote: QuoteShape
  guest: GuestState
  reference: string
  basePath: string
  onCopy: () => void
  reducedMotion: boolean
  paid?: { now: number; later: number }
  balanceWhen?: string
}) {
  const download = (filename: string, mime: string, content: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const addToCalendar = () => {
    const now = new Date()
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
      now.getUTCHours(),
    )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//EZRA Pro//Storefront//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${reference}@ezrapro.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${tenant.timezone}:${icsStamp(departure.startsAt)}`,
      `DTEND;TZID=${tenant.timezone}:${icsStamp(departure.endsAt)}`,
      `SUMMARY:${activity.name} — ${tenant.name}`,
      `LOCATION:${tenant.contact.addressLine.replace(/,/g, '\\,')}`,
      `DESCRIPTION:Confirmation ${reference}. ${meetingPointFor(activity, departure).replace(/,/g, '\\,')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    download(`${reference}.ics`, 'text/calendar;charset=utf-8', ics)
    toast.success('Calendar invite downloaded')
  }

  const downloadTicket = () => {
    const rows = [...quote.ticketLines, ...quote.addOnLines]
      .map(
        (line) =>
          `<tr><td>${line.label} × ${line.quantity}</td><td style="text-align:right">${formatCurrency(
            line.total,
            tenant.currency,
          )}</td></tr>`,
      )
      .join('')

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${reference} — ${activity.name}</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;margin:0;padding:40px;background:#f6f8f9;color:#12212a}
.ticket{max-width:640px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px -24px rgba(18,33,42,.25)}
.head{background:${tenant.branding.primaryColor};color:#fff;padding:28px 32px}
.code{font-family:ui-monospace,monospace;font-size:30px;letter-spacing:.12em;margin:6px 0 0}
.body{padding:28px 32px}h1{font-size:20px;margin:0 0 4px}p{margin:2px 0;color:#4a5c66;font-size:14px}
table{width:100%;border-collapse:collapse;margin-top:20px;font-size:14px}
td{padding:7px 0;border-bottom:1px solid #e6ecef}
.total{font-weight:700;font-size:18px;border-top:2px solid #12212a;padding-top:12px;margin-top:12px;display:flex;justify-content:space-between}
</style></head><body><div class="ticket">
<div class="head"><div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;opacity:.8">${tenant.name}</div><div class="code">${reference}</div></div>
<div class="body"><h1>${activity.name}</h1>
<p>${formatDateLong(departure.startsAt)} · ${formatTime(departure.startsAt)}–${formatTime(departure.endsAt)}</p>
<p>${departure.location ? `${departure.location.name} — ` : ''}${meetingPointFor(activity, departure)}</p>
<p>${quote.countLabel} · Lead guest: ${guest.firstName} ${guest.lastName}</p>
<table>${rows}</table>
<div class="total"><span>Total paid</span><span>${formatCurrency(quote.total, tenant.currency, { decimals: true })}</span></div>
<p style="margin-top:20px">${activity.cancellationPolicy.summary}</p>
<p>${tenant.contact.phone} · ${tenant.contact.email}</p>
</div></div></body></html>`

    download(`${reference}.html`, 'text/html;charset=utf-8', html)
    toast.success('Ticket downloaded')
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      {/* ---------- success mark ---------- */}
      <div className="relative flex justify-center">
        {!reducedMotion
          ? BURST.map((dot, i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                animate={{ opacity: [0, 1, 0], x: dot.x, y: dot.y, scale: [0.4, 1, 0.7] }}
                transition={{ duration: 1.1, delay: 0.25 + dot.d, ease: [0.16, 1, 0.3, 1] }}
                className={cn('absolute top-9 size-2 rounded-full', dot.tone)}
              />
            ))
          : null}

        <motion.div
          initial={reducedMotion ? false : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative grid size-20 place-items-center rounded-full bg-success-soft"
        >
          <svg viewBox="0 0 52 52" className="size-11" fill="none" aria-hidden="true">
            <motion.circle
              cx="26"
              cy="26"
              r="22"
              className="stroke-success"
              strokeWidth="3"
              strokeLinecap="round"
              initial={reducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.path
              d="M16 27.5 L23 34 L37 19"
              className="stroke-success"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
        </motion.div>
      </div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="mt-7 text-center"
      >
        <h1 className="font-display text-display-sm font-semibold tracking-tight text-foreground">
          You are booked, {guest.firstName || 'friend'}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-muted">
          We have emailed your tickets to{' '}
          <span className="font-medium text-foreground">{guest.email || 'your inbox'}</span>. Show
          the code below at the meeting point — a screenshot is fine.
        </p>
      </motion.div>

      {/* ---------- reference ---------- */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-lg sm:p-6"
      >
        <div className="flex flex-col items-center gap-4 border-b border-dashed border-line pb-5 sm:flex-row sm:justify-between">
          <TicketQr value={ticketPayload(reference)} size={112} label={`Ticket QR code for ${reference}`} className="shrink-0 border border-line" />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
              Confirmation code
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-[0.14em] text-foreground">
              {reference}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onCopy}
            leftIcon={<Copy aria-hidden="true" />}
          >
            Copy code
          </Button>
        </div>

        <dl className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">
              Activity
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">{activity.name}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">
              When
            </dt>
            <dd className="mt-1 text-sm font-medium tabular text-foreground">
              {departure.legs ? <LegList legs={departure.legs} compact /> : <>{formatDateLong(departure.startsAt)} · {formatTime(departure.startsAt)}{departure.returnsAt ? ` to ${formatDateLong(departure.returnsAt)} · ${formatTime(departure.returnsAt)}` : ""}</>}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">
              Guests
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {quote.countLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">
              {paid && paid.later > 0 ? 'Paid today' : 'Paid'}
            </dt>
            <dd className="mt-1 text-sm font-medium tabular text-foreground">
              {formatCurrency(paid ? paid.now : quote.total, tenant.currency, { decimals: true })}
              {paid && paid.later > 0 ? <span className="block text-xs font-normal text-subtle">{formatCurrency(paid.later, tenant.currency, { decimals: true })} due {balanceWhen}</span> : null}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-faint">
              Meeting point
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">
              {departure.legs ? (
                <LegList legs={departure.legs} />
              ) : (
                <>
                  {departure.location ? <span className="block font-medium text-foreground">{departure.location.name}</span> : null}
                  {meetingPointFor(activity, departure)}
                  {departure.location ? <span className="block text-xs text-subtle">{departure.location.addressLine}</span> : null}
                </>
              )}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2.5 border-t border-line-subtle pt-5 sm:flex-row">
          <Button
            fullWidth
            onClick={addToCalendar}
            leftIcon={<CalendarPlus aria-hidden="true" />}
          >
            Add to calendar
          </Button>
          <Button
            fullWidth
            variant="secondary"
            onClick={downloadTicket}
            leftIcon={<Download aria-hidden="true" />}
          >
            Download ticket
          </Button>
        </div>
      </motion.div>

      {/* ---------- receipt ---------- */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
        className="mt-5 rounded-2xl border border-line bg-surface p-5"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Receipt className="size-4 text-primary" aria-hidden="true" />
          Receipt
        </p>
        <div className="mt-4">
          <SummaryLines quote={quote} tenant={tenant} />
        </div>
      </motion.div>

      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted">
          Questions before the day? Call{' '}
          <a
            href={`tel:${tenant.contact.phone.replace(/[^+\d]/g, '')}`}
            className="font-semibold text-primary hover:underline"
          >
            {tenant.contact.phone}
          </a>
        </p>
        <Button asChild variant="ghost">
          <Link href={basePath}>Back to {tenant.branding.logoText}</Link>
        </Button>
      </div>
    </div>
  )
}

/** An activity with a height or weight limit asks every rider, and stops the booking outside it. */
function riderQuestions(activity: Activity): GuestQuestion[] {
  if ((activity.kind ?? 'trip') !== 'activity' || !activity.ride) return []
  const out: GuestQuestion[] = []
  const known = new Set((activity.guestQuestions ?? []).map((question) => question.preset ?? question.id))
  if (activity.ride.minHeightCm && !known.has('height')) {
    out.push({
      id: 'q_rider_height',
      label: 'Height',
      kind: 'number',
      scope: 'guest',
      required: true,
      unit: 'cm',
      min: activity.ride.minHeightCm,
      limitMessage: `Riders must be at least ${activity.ride.minHeightCm} cm tall.`,
    })
  }
  if (activity.ride.maxWeightKg && !known.has('weight')) {
    out.push({
      id: 'q_rider_weight',
      label: 'Weight',
      kind: 'number',
      scope: 'guest',
      required: true,
      unit: 'kg',
      max: activity.ride.maxWeightKg,
      limitMessage: `The limit is ${activity.ride.maxWeightKg} kg per rider.`,
      help: 'Only our team sees this. It keeps the harness and the horse safe.',
    })
  }
  return out
}

/* ==========================================================================
   WHEN YOU PAY — a deposit now and the rest later, or pay on the day, with
   the choice to settle it all now when the activity allows it.
   ========================================================================== */

function PayWhenStep({
  terms,
  total,
  split,
  payInFull,
  setPayInFull,
  balanceWhen,
  currency,
}: {
  terms: PaymentTerms
  total: number
  split: { now: number; later: number }
  payInFull: boolean
  setPayInFull: (value: boolean) => void
  balanceWhen: string
  currency: Tenant['currency']
}) {
  const money = (minor: number) => formatCurrency(minor, currency, { decimals: true })
  const options = [
    {
      key: 'split',
      on: !payInFull,
      title: terms.collect === 'later' ? 'Pay on the day' : `Pay a ${depositLabel(terms, (minor) => formatCurrency(minor, currency))} deposit`,
      text: terms.collect === 'later' ? `Nothing today. ${money(total)} is paid ${balanceWhen}.` : `${money(split.now)} today, ${money(split.later)} ${balanceWhen} to the same card.`,
    },
    ...(terms.allowPayInFull ? [{ key: 'full', on: payInFull, title: 'Pay in full now', text: `${money(total)} today, nothing later.` }] : []),
  ]
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">When you pay</h2>
        <p className="mt-1 text-sm text-muted">Your spot is held either way.</p>
      </div>
      <div role="radiogroup" aria-label="When you pay" className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            role="radio"
            aria-checked={option.on}
            onClick={() => setPayInFull(option.key === 'full')}
            className={cn('rounded-xl border px-4 py-3 text-left transition-colors', option.on ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong')}
          >
            <span className="block text-sm font-semibold text-foreground">{option.title}</span>
            <span className="mt-0.5 block text-xs text-muted">{option.text}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
