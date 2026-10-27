'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  CalendarDays,
  Car,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileSignature,
  MapPin,
  MessageCircle,
  Minus,
  Plane,
  Plus,
  Send,
  Users,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { TicketQr, ticketPayload } from '@/components/ui/ticket-qr'
import type { AvailabilityDay } from '@/components/storefront/booking-widget'
import { bookedOn } from '@/components/storefront/checkout-selection'
import {
  EMPTY_WAIVER,
  GuestDetailsStep,
  WaiverStep,
  validateGuestDetails,
  type TravellerState,
  type WaiverState,
} from '@/components/storefront/checkout-guest-details'
import { sendGuestMessage, useInbox } from '@/hooks/use-inbox'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { resolveTerms } from '@/lib/booking-defaults'
import type { InboxThread } from '@/lib/inbox'
import { answerProblem } from '@/lib/guest-requirements'
import { cn, formatCurrency, formatDateLong, formatRelative, formatTime, pluralize } from '@/lib/utils'
import { useBookingLedger } from '@/hooks/use-booking-ledger'
import { useScheduledDays } from '@/hooks/use-scheduled-days'
import { forSlot } from '@/lib/extra-spots'
import { usePricingOverride } from '@/hooks/use-pricing-override'
import { usePricing } from '@/hooks/use-pricing'
import { extraSpotPrice, groupPriced, guestLimitOf, privatePerPerson, unitPrice, usualSpotsLeft, type PriceContext } from '@/lib/price-engine'
import { changeBooking, changeStartOf, withLedger } from '@/lib/booking-ledger'
import { changesSummary, hoursLabel, refundFor, splitPayment } from '@/lib/booking-policy'
import { useTransferHolds } from '@/hooks/use-transfer-holds'
import { FLIGHT_NUMBER, airlineOf, directionLabel, timeFieldLabels, transferOf, type TransferHold } from '@/lib/transfers'
import { applyRideEdit, askedTimeOf, flightLine, hhmm, isHubLeg, movedToOf, partyLine, returnTooSoon, rideFits, rideHeadline, type RideEdit } from '@/lib/transfer-changes'
import type { Activity, ActivityKind, BookingStatus, CancellationPolicy, ChangeRules, CurrencyCode, GuestQuestion, PaymentTerms, TransferBookingDetails, WaiverTemplate } from '@/types'

/* ==========================================================================
   MANAGE BOOKING — the guest's own page, from the link in every message.
   Sign waivers, add details, pay the balance, reschedule, add guests,
   cancel under the policy, and message the crew. Changes are kept in the
   browser for the demo, keyed by the booking reference.
   ========================================================================== */

interface ManageTenant {
  slug: string
  name: string
  phone: string
  currency: CurrencyCode
}

interface ManageState {
  waiversSigned: boolean
  detailsDone: boolean
  balancePaid: boolean
  movedTo?: string
  addedGuests: number
  cancelled: boolean
  refunded?: number
}

const EMPTY_STATE: ManageState = { waiversSigned: false, detailsDone: false, balancePaid: false, addedGuests: 0, cancelled: false }

function useManageState(slug: string, reference: string) {
  const key = `ezra:manage:${slug}:${reference}`
  const [state, setState] = React.useState<ManageState>(EMPTY_STATE)
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) setState({ ...EMPTY_STATE, ...JSON.parse(raw) })
    } catch {
      /* storage blocked */
    }
  }, [key])
  const update = (patch: Partial<ManageState>) =>
    setState((current) => {
      const next = { ...current, ...patch }
      try {
        window.localStorage.setItem(key, JSON.stringify(next))
      } catch {
        /* storage blocked */
      }
      return next
    })
  return [state, update] as const
}

export function ManageBooking(
  props:
    | { notFoundReference: string; tenant: ManageTenant }
    | {
        notFoundReference?: undefined
        tenant: ManageTenant
        booking: {
          id: string
          reference: string
          status: BookingStatus
          partySize: number
          total: number
          amountPaid: number
          answers: Record<string, string>
          pickup?: { zoneId: string; stop: string; time: string }
          participants: { id: string; firstName: string; lastName: string; waiverSigned: boolean; answers: Record<string, string> }[]
        }
        guest: { firstName: string; lastName: string; email: string; phone: string; avatarUrl?: string }
        activity: {
          slug: string
          name: string
          image: string
          meetingPoint: string
          locationName?: string
          policy: Pick<CancellationPolicy, 'freeCancellationHours' | 'lateRefundPercent' | 'keepDeposit' | 'summary' | 'useDefault'>
          changes: ChangeRules
          payment: PaymentTerms
          pricePerGuest: number
          guestQuestions: GuestQuestion[]
          kind: ActivityKind
        }
        departure: { id: string; startsAt: string; endsAt: string; seatsLeft: number; capacity?: number; priceMultiplier?: number }
        /** The activity as seeded, so the saved schedule and prices count here as on the storefront. */
        source: Activity
        waiver?: WaiverTemplate
        days: AvailabilityDay[]
        thread?: InboxThread
        nowIso: string
        /** Transfers: the ride as booked, and the seeded rides' vehicle holds. */
        transfer?: { details: TransferBookingDetails; holds: TransferHold[] }
      },
) {
  const shell = 'mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6'
  if (props.notFoundReference !== undefined) {
    return (
      <div className={shell}>
        <h1 className="font-display text-2xl font-semibold tracking-tight">We could not find booking {props.notFoundReference}</h1>
        <p className="mt-2 text-muted">Check the code in your confirmation email, or call {props.tenant.name} on {props.tenant.phone}.</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={`/book/${props.tenant.slug}`}>Back to {props.tenant.name}</Link>
        </Button>
      </div>
    )
  }
  return <ManageBookingInner {...props} />
}

type InnerProps = Exclude<Parameters<typeof ManageBooking>[0], { notFoundReference: string }>

/**
 * Adding guests to a booking, as the manage page counts it: what growing the
 * party costs (each new guest a ticket, nothing per group, or the extra-spot
 * price once in an extra spot) and how many more can come (a private group up
 * to its most guests plus its extra spots; shared, the spots left, extra spots
 * included). `ctx` is the booking's time slot: its spots (extra spots
 * included) and what is booked on it, this booking's guests too.
 */
export function addGuestsPlan(priced: Activity, ctx: PriceContext, { partySize, seatsLeft, pricePerGuest: fallback }: { partySize: number; seatsLeft: number; pricePerGuest: number }) {
  const leadTier = priced.priceTiers[0]
  const privateGroup = (priced.kind ?? 'trip') === 'charter'
  /** Per group (shared, or a private group's options): the price is for the whole group, so a guest in a usual spot adds nothing. */
  const perGroup = groupPriced(priced) || (privateGroup && !privatePerPerson(priced))
  /** Each extra spot at this time slot's price (0: none sold). */
  const extraEach = extraSpotPrice(priced, ctx, privateGroup ? leadTier?.id : undefined)
  const pricePerGuest = perGroup ? 0 : leadTier ? unitPrice(priced, leadTier.id, ctx) : fallback
  /** The usual spots this booking's guests can be in: a private group's most guests; shared, the time slot's usual spots less everyone else's. */
  const usual = privateGroup ? usualSpotsLeft(priced) : usualSpotsLeft(priced, { capacity: ctx.capacity, booked: Math.max(0, (ctx.booked ?? partySize) - partySize) })
  /** What growing the party from one size to another costs. */
  const cost = (from: number, to: number) => {
    let total = 0
    for (let guest = from + 1; guest <= to; guest++) total += extraEach > 0 && guest > usual ? extraEach : pricePerGuest
    return total
  }
  // A private group has the time to itself: it can grow to its most guests plus its extra spots. Shared, the spots left decide.
  const limit = guestLimitOf(priced)
  const privateMost = Math.max(1, limit)
  const room = privateGroup ? Math.max(0, privateMost - partySize) : Math.max(0, Math.min(seatsLeft, limit - partySize))
  /** The price, not the spots left, is what stops the group. */
  const priceStops = privateGroup || limit - partySize <= seatsLeft
  return { privateGroup, perGroup, extraEach, pricePerGuest, usual, cost, limit, privateMost, room, priceStops }
}

/** One leg's fields in "Change flight details". */
interface RideLegForm {
  flightNumber: string
  airline: string
  /** "HH:MM": the flight's time (hub legs) or the pickup. */
  time: string
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function ManageBookingInner({ tenant, booking, guest, activity: given, departure, source, waiver, days: rawDays, thread, nowIso, transfer }: InnerProps) {
  // Its own cancellation and payment terms, or the business defaults it follows.
  const { defaults: bookingDefaults } = useBookingDefaults(tenant.slug)
  const activity = React.useMemo(() => ({ ...given, ...resolveTerms({ policy: given.policy, payment: given.payment }, bookingDefaults) }), [given, bookingDefaults])
  const [state, update] = useManageState(tenant.slug, booking.reference)
  const [open, setOpen] = React.useState<'waiver' | 'details' | 'move' | 'guests' | 'cancel' | 'ride' | null>(null)
  const now = React.useMemo(() => new Date(nowIso), [nowIso])
  const currency = tenant.currency
  const money = (minor: number) => formatCurrency(minor, currency)

  // Moves, cancellations and added guests live in the shared booking ledger, so the
  // dashboard and every availability count see them the moment the guest makes them.
  const ledger = useBookingLedger(tenant.slug)
  const change = ledger.changes[booking.reference]
  // A ride's time slot counts vehicles (a shared run: seats), so its changes start from those.
  const start = changeStartOf({ departureId: departure.id, startsAt: departure.startsAt, partySize: booking.partySize, transfer: transfer?.details })
  /** The ride as it stands: changed here (a new flight, time or hotel), or as booked. */
  const ride = transfer ? (change?.transfer ?? transfer.details) : undefined
  // The schedule the owner saved (cancelled and closed times, added ones) over the seeded days, then this browser's changes.
  const scheduledDays = useScheduledDays(source, rawDays, { tenantSlug: tenant.slug, nowIso, delta: ledger.delta })
  const days = React.useMemo(
    () => scheduledDays.map((day) => ({ ...day, slots: day.slots.map((slot) => (slot.outsideSchedule ? slot : withLedger(slot, ledger.delta))) })),
    [scheduledDays, ledger.delta],
  )
  const currentDepartureId = change?.movedTo?.departureId ?? departure.id
  // A ride starts at its first pickup.
  const startsAt = ride?.legs[0]?.pickupAt ?? change?.movedTo?.startsAt ?? departure.startsAt
  // Added guests pay the first ticket's price on the time slot the booking is on: saved prices, price changes and the business's rules.
  // Per group (shared or private) the group price covers the guests in the usual spots. Guests in extra spots pay the extra-spot price.
  const priced = usePricingOverride(source)
  const { rules: priceRules } = usePricing(tenant.slug)
  const onSlot = days.flatMap((day) => day.slots).find((slot) => slot.departureId === currentDepartureId)
  const leadTier = priced.priceTiers[0]
  const priceCtx = {
    startsAt,
    nowIso,
    capacity: onSlot?.capacity ?? departure.capacity,
    booked: onSlot ? bookedOn(onSlot, ledger.delta) : undefined,
    priceMultiplier: onSlot?.priceMultiplier ?? departure.priceMultiplier ?? 1,
    businessRules: priceRules,
  }
  const partySize = change?.party ?? booking.partySize
  // The spots left as the strip has them (the saved schedule, extra spots included); a time slot off the schedule, as the server has it.
  const seatsLeftNow = onSlot && !onSlot.outsideSchedule ? onSlot.seatsLeft : Math.max(0, departure.seatsLeft - (ledger.delta[currentDepartureId] ?? 0))
  // The time slot's own day: its extra spots and a private group's size (a weekday's or a date's).
  const plan = addGuestsPlan(forSlot(priced, onSlot), priceCtx, { partySize, seatsLeft: seatsLeftNow, pricePerGuest: given.pricePerGuest })
  const { privateGroup, perGroup, extraEach, pricePerGuest, usual: usualForBooking, cost: addCost, limit: groupLimit, privateMost, room: roomNow, priceStops } = plan
  /* ---------- a ride: its legs, and a new flight, time or hotel ---------- */
  const rideHolds = useTransferHolds(priced, tenant.slug, transfer?.holds)
  const rideConfig = ride ? transferOf(priced) : undefined
  const rideShared = rideConfig?.service === 'shared'
  const [rideForm, setRideForm] = React.useState<{ legs: RideLegForm[]; place: string }>({ legs: [], place: '' })
  const [rideErrors, setRideErrors] = React.useState<Record<string, string>>({})
  /** A leg can change until the reschedule cutoff before its pickup. */
  const legOpen = (pickupAt: string) => (new Date(pickupAt).getTime() - now.getTime()) / 3_600_000 >= activity.changes.rescheduleHours
  const rideChangeable = Boolean(ride && ride.legs.some((leg) => legOpen(leg.pickupAt)))
  const openRide = () => {
    if (!ride) return
    setRideForm({
      legs: ride.legs.map((leg) => ({ flightNumber: leg.flight?.number ?? '', airline: leg.flight?.airline ?? '', time: hhmm(askedTimeOf(priced, ride, leg)) })),
      place: ride.place,
    })
    setRideErrors({})
    setOpen(open === 'ride' ? null : 'ride')
  }
  const saveRide = () => {
    if (!ride) return
    const found: Record<string, string> = {}
    ride.legs.forEach((leg, index) => {
      if (!legOpen(leg.pickupAt)) return
      const form = rideForm.legs[index]
      if (rideConfig?.askFlight && isHubLeg(leg.direction) && !FLIGHT_NUMBER.test((form?.flightNumber ?? '').trim())) found[`flight.${index}`] = 'Add your flight number, like AA 1234.'
      if (!rideShared && !TIME.test(form?.time ?? '')) found[`time.${index}`] = 'Add the time, like 14:35.'
    })
    if (!rideForm.place.trim()) found.place = 'Add the hotel or address.'
    if (Object.keys(found).length > 0) {
      setRideErrors(found)
      return
    }
    const edit: RideEdit = {
      legs: ride.legs.map((leg, index) => {
        if (!legOpen(leg.pickupAt)) return undefined
        const form = rideForm.legs[index]
        const day = askedTimeOf(priced, ride, leg).slice(0, 10)
        return { flightNumber: form.flightNumber, airline: form.airline, ...(rideShared ? {} : { at: `${day}T${form.time}:00` }) }
      }),
      place: rideForm.place,
    }
    const next = applyRideEdit(priced, ride, edit)
    if (returnTooSoon(priced, next)) {
      setRideErrors({ 'time.1': 'Your return has to be after you arrive.' })
      return
    }
    if (next.legs.some((leg, index) => leg.pickupAt < nowIso && leg.pickupAt !== ride.legs[index]?.pickupAt)) {
      setRideErrors({ form: "Pick a time that hasn't passed." })
      return
    }
    if (!rideFits(priced, rideHolds, next, booking.reference)) {
      setRideErrors({ form: "No vehicles free at the new time. Message us and we'll sort it." })
      return
    }
    const moved = movedToOf(ride, next)
    changeBooking(tenant.slug, booking.reference, start, { transfer: next, ...(moved ? { movedTo: moved } : {}) }, { by: 'guest', what: 'Flight details changed' })
    setOpen(null)
    toast.success('Ride updated', { description: next.legs.map((leg) => `${directionLabel(leg.direction, rideConfig?.hub)}: pickup ${formatDateLong(new Date(leg.pickupAt))} at ${hhmm(leg.pickupAt)}`).join('. ') })
  }

  const hoursToGo = (new Date(startsAt).getTime() - now.getTime()) / 3_600_000
  const past = hoursToGo < 0
  const cancelled = Boolean(change?.cancelled) || booking.status === 'cancelled' || booking.status === 'refunded'
  const rules = activity.changes
  const moves = change?.moves ?? 0
  const canMove = rules.reschedule && hoursToGo >= rules.rescheduleHours && (rules.maxReschedules === 0 || moves < rules.maxReschedules)
  const freeWindow = activity.policy.freeCancellationHours > 0 && hoursToGo >= activity.policy.freeCancellationHours
  const extra = addCost(booking.partySize, partySize)
  const deposit = activity.payment.collect === 'deposit' ? splitPayment(activity.payment, booking.total, booking.partySize).now : 0
  const balance = state.balancePaid ? 0 : Math.max(0, booking.total + extra - booking.amountPaid)
  const unsigned = state.waiversSigned ? 0 : booking.participants.filter((participant) => !participant.waiverSigned).length
  const missingDetails = state.detailsDone
    ? 0
    : booking.participants.reduce(
        (sum, participant) => sum + activity.guestQuestions.filter((question) => question.scope === 'guest' && answerProblem(question, participant.answers[question.id])).length,
        0,
      )
  const refund = refundFor(activity.policy, booking.amountPaid, hoursToGo, deposit)

  /* waiver + details forms */
  const [waiverState, setWaiverState] = React.useState<WaiverState>(EMPTY_WAIVER)
  const [travellers, setTravellers] = React.useState<TravellerState[]>(() =>
    booking.participants.map((participant) => ({ firstName: participant.firstName, lastName: participant.lastName, minor: false, answers: { ...participant.answers } })),
  )
  const [bookingAnswers, setBookingAnswers] = React.useState<Record<string, string>>(booking.answers)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  /* reschedule */
  const [moveDay, setMoveDay] = React.useState<string>('')
  const [moveSlot, setMoveSlot] = React.useState<string>('')
  const bookable = days.filter((day) => day.slots.some((slot) => !slot.soldOut && slot.seatsLeft >= partySize && slot.departureId !== currentDepartureId))
  const dayChoice = days.find((day) => day.dateKey === moveDay)

  /* add guests */
  const [adding, setAdding] = React.useState(1)
  /** What the guests being added cost. */
  const addingCost = addCost(partySize, partySize + adding)

  /* messages */
  const threadMeta = React.useMemo(
    () => ({
      id: `thr_${booking.reference}`,
      bookingId: booking.id,
      reference: booking.reference,
      guestName: `${guest.firstName} ${guest.lastName}`,
      avatarUrl: guest.avatarUrl,
      phone: guest.phone,
      email: guest.email,
      activityName: activity.name,
      startsAt,
      channel: 'email' as const,
    }),
    [booking, guest, activity.name, startsAt],
  )
  const seededThreads = React.useMemo(() => (thread ? [thread] : []), [thread])
  const { threads } = useInbox(tenant.slug, seededThreads)
  const conversation = threads.find((entry) => entry.id === threadMeta.id)
  const [message, setMessage] = React.useState('')

  const todo = [
    waiver && unsigned > 0 ? { key: 'waiver' as const, icon: FileSignature, title: `Sign the waiver`, detail: `${unsigned} of ${booking.participants.length} ${pluralize(booking.participants.length, 'guest')} still to sign` } : null,
    missingDetails > 0 ? { key: 'details' as const, icon: ClipboardList, title: 'Add guest details', detail: `${missingDetails} ${pluralize(missingDetails, 'answer')} our team needs` } : null,
    balance > 0 ? { key: 'balance' as const, icon: CreditCard, title: `Pay the balance of ${formatCurrency(balance, currency)}`, detail: 'Due before the day' } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item))

  const section = 'rounded-2xl border border-line bg-surface p-5'

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.12em] text-faint uppercase">Your booking with {tenant.name}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{activity.name}</h1>
      <p className="mt-1 text-muted">Hi {guest.firstName}, everything about your booking is here.</p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
        {activity.image ? (
          <div className="relative aspect-[16/6] bg-surface-sunken">
            <Image src={activity.image} alt="" fill priority sizes="(max-width: 780px) 100vw, 736px" className="object-cover" />
          </div>
        ) : null}
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-1.5">
            <TicketQr value={ticketPayload(booking.reference)} size={120} className="border border-line" />
            <span className="font-mono text-sm font-semibold tracking-wider">{booking.reference}</span>
          </div>
          <dl className="grid flex-1 gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-4 text-primary" aria-hidden="true" />
              <div>
                <dt className="text-xs text-subtle">When</dt>
                <dd className="font-medium">{formatDateLong(new Date(startsAt))} · {ride ? `Pickup ${hhmm(startsAt)}` : formatTime(startsAt)}</dd>
                {change?.movedTo && !ride ? <dd className="text-xs text-success">Moved from {formatDateLong(new Date(departure.startsAt))} · {formatTime(departure.startsAt)}</dd> : null}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 size-4 text-primary" aria-hidden="true" />
              <div>
                <dt className="text-xs text-subtle">{ride ? 'Passengers' : 'Guests'}</dt>
                <dd className="font-medium">{ride ? partyLine(ride) : `${partySize} ${pluralize(partySize, 'guest')}`}</dd>
              </div>
            </div>
            {ride ? (
              <div className="flex items-start gap-2 sm:col-span-2">
                <Car className="mt-0.5 size-4 text-primary" aria-hidden="true" />
                <div>
                  <dt className="text-xs text-subtle">Trip</dt>
                  <dd className="font-medium">{rideHeadline(priced, ride)}</dd>
                </div>
              </div>
            ) : (
            <div className="flex items-start gap-2 sm:col-span-2">
              <MapPin className="mt-0.5 size-4 text-primary" aria-hidden="true" />
              <div>
                <dt className="text-xs text-subtle">{booking.pickup ? 'Pickup' : 'Meet'}</dt>
                <dd className="font-medium">
                  {booking.pickup ? `${formatTime(booking.pickup.time)} from ${booking.pickup.stop}` : activity.meetingPoint}
                </dd>
                {activity.locationName && !booking.pickup ? <dd className="text-xs text-subtle">{activity.locationName}</dd> : null}
              </div>
            </div>
            )}
          </dl>
          <div className="shrink-0">
            {cancelled ? <Badge variant="neutral">Cancelled</Badge> : past ? <Badge variant="neutral">Completed</Badge> : <Badge variant="success">Confirmed</Badge>}
          </div>
        </div>
      </div>

      {ride ? (
        <section className={cn(section, 'mt-6')} aria-labelledby="your-rides">
          <h2 id="your-rides" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Car className="size-4 text-primary" aria-hidden="true" />
            {ride.legs.length > 1 ? 'Your rides' : 'Your ride'}
          </h2>
          <ol className="mt-3 flex list-none flex-col divide-y divide-line-subtle p-0">
            {ride.legs.map((leg, index) => {
              const flight = flightLine(leg, rideConfig?.hub?.kind)
              const meet = leg.direction === 'from_hub' ? rideConfig?.hub?.meetingNote || activity.meetingPoint : `We collect you at ${leg.from}`
              return (
                <li key={`${leg.direction}-${index}`} className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0">
                  <p className="text-sm font-semibold text-foreground">
                    {directionLabel(leg.direction, rideConfig?.hub)}
                    <span className="font-normal text-subtle"> · {formatDateLong(new Date(leg.pickupAt))}</span>
                  </p>
                  <p className="text-sm text-foreground tabular">
                    Pickup {hhmm(leg.pickupAt)}
                    {flight ? (
                      <span className="text-muted">
                        {' '}
                        · <Plane className="inline size-3.5 align-[-2px]" aria-hidden="true" /> {flight}
                      </span>
                    ) : null}
                  </p>
                  {leg.from || leg.to ? <p className="text-xs text-muted">{leg.from} → {leg.to}</p> : null}
                  <p className="text-xs text-subtle">{meet}</p>
                </li>
              )
            })}
          </ol>
          {ride.note ? <p className="mt-3 text-xs text-muted">Note for the driver: {ride.note}</p> : null}
        </section>
      ) : null}

      {cancelled ? (
        <div role="status" className="mt-6 rounded-2xl border border-line bg-surface-sunken px-5 py-4 text-sm">
          This booking is cancelled{change?.refund ? `. ${formatCurrency(change.refund, currency)} is on its way back to your card.` : '.'} We hope to see you another time.
        </div>
      ) : null}

      {!cancelled && todo.length > 0 ? (
        <section className="mt-6 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Before the day</h2>
          {todo.map((item) => (
            <div key={item.key} className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning-soft/40 px-4 py-3">
              <item.icon className="size-5 shrink-0 text-warning" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                <span className="block text-xs text-muted">{item.detail}</span>
              </span>
              <Button
                size="sm"
                onClick={() => {
                  if (item.key === 'balance') {
                    update({ balancePaid: true })
                    toast.success(`Paid ${formatCurrency(balance, currency)}`, { description: 'A receipt is on its way.' })
                  } else setOpen(item.key)
                }}
              >
                {item.key === 'balance' ? 'Pay now' : item.key === 'waiver' ? 'Sign' : 'Add'}
              </Button>
            </div>
          ))}
        </section>
      ) : !cancelled && !past ? (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-success/40 bg-success-soft/40 px-4 py-3 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          You are all set. Waivers, details and payment are done.
        </p>
      ) : null}

      {open === 'waiver' && waiver ? (
        <div className={cn(section, 'mt-4')}>
          <WaiverStep template={waiver} waiver={waiverState} setWaiver={setWaiverState} hasMinors={false} errors={errors} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(null)}>Later</Button>
            <Button
              onClick={() => {
                const found = validateGuestDetails({ questions: [], travellers: [], bookingAnswers: {}, waiver: waiverState, template: waiver })
                setErrors(found)
                if (Object.keys(found).length > 0) return
                update({ waiversSigned: true })
                setOpen(null)
                toast.success('Waiver signed for everyone in your booking')
              }}
            >
              Sign for {booking.participants.length} {pluralize(booking.participants.length, 'guest')}
            </Button>
          </div>
        </div>
      ) : null}

      {open === 'details' ? (
        <div className={cn(section, 'mt-4')}>
          <GuestDetailsStep
            questions={activity.guestQuestions}
            travellers={travellers}
            setTravellers={setTravellers}
            bookingAnswers={bookingAnswers}
            setBookingAnswers={setBookingAnswers}
            leadName={`${guest.firstName} ${guest.lastName}`}
            minorAge={waiver?.minorAge ?? 18}
            errors={errors}
          />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(null)}>Later</Button>
            <Button
              onClick={() => {
                const found = validateGuestDetails({ questions: activity.guestQuestions, travellers, bookingAnswers, waiver: EMPTY_WAIVER })
                setErrors(found)
                if (Object.keys(found).length > 0) return
                update({ detailsDone: true })
                setOpen(null)
                toast.success('Details saved', { description: 'Our team has what it needs.' })
              }}
            >
              Save details
            </Button>
          </div>
        </div>
      ) : null}

      {!cancelled && !past ? (
        <section className={cn(section, 'mt-6')}>
          <h2 className="text-sm font-semibold text-foreground">Change your booking</h2>
          <ul className="mt-1.5 flex list-none flex-col gap-0.5 p-0 text-xs text-subtle">
            <li>{activity.policy.summary}</li>
            <li>
              {changesSummary(rules, money)}
              {rules.reschedule && rules.maxReschedules > 0 ? ` Moved ${moves} of ${rules.maxReschedules}.` : ''}
            </li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            {ride ? (
              <Button variant="secondary" leftIcon={<Plane />} disabled={!rideChangeable} onClick={openRide}>
                Change flight details
              </Button>
            ) : null}
            {rules.reschedule && !ride ? (
              <Button variant="secondary" leftIcon={<CalendarDays />} disabled={!canMove} onClick={() => setOpen(open === 'move' ? null : 'move')}>
                {rules.rescheduleFee > 0 ? `Move for ${money(rules.rescheduleFee)}` : 'Move to another time'}
              </Button>
            ) : null}
            {rules.addGuests && !ride ? (
              <Button variant="secondary" leftIcon={<Users />} disabled={roomNow <= 0} onClick={() => setOpen(open === 'guests' ? null : 'guests')}>Add guests</Button>
            ) : null}
            {rules.cancelOnline ? (
              <Button variant="ghost" leftIcon={<XCircle />} onClick={() => setOpen(open === 'cancel' ? null : 'cancel')}>Cancel booking</Button>
            ) : null}
          </div>
          {ride && !rideChangeable ? <p className="mt-2 text-xs text-muted">Message us to change it.</p> : null}
          {rules.reschedule && !canMove && !ride ? (
            <p className="mt-2 text-xs text-muted">
              {rules.maxReschedules > 0 && moves >= rules.maxReschedules
                ? 'This booking has been moved as many times as allowed.'
                : `Moves close ${hoursLabel(rules.rescheduleHours)} before the start.`}{' '}
              Call {tenant.phone} or send a message below and the team will help.
            </p>
          ) : null}
          {!rules.cancelOnline ? <p className="mt-2 text-xs text-muted">To cancel, call {tenant.phone} or send a message below.</p> : null}

          {open === 'ride' && ride ? (
            <div className="mt-4 flex flex-col gap-4 border-t border-line-subtle pt-4">
              {ride.legs.map((leg, index) => {
                const form = rideForm.legs[index] ?? { flightNumber: '', airline: '', time: '' }
                const editable = legOpen(leg.pickupAt)
                const hubLeg = isHubLeg(leg.direction)
                const labels = timeFieldLabels(rideConfig?.hub)
                const setLeg = (patch: Partial<RideLegForm>) => setRideForm((current) => ({ ...current, legs: current.legs.map((entry, at) => (at === index ? { ...entry, ...patch } : entry)) }))
                return (
                  <fieldset key={`${leg.direction}-${index}`} disabled={!editable} className="flex flex-col gap-3">
                    <legend className="text-sm font-semibold text-foreground">
                      {directionLabel(leg.direction, rideConfig?.hub)}
                      <span className="font-normal text-subtle"> · {formatDateLong(new Date(askedTimeOf(priced, ride, leg)))}</span>
                    </legend>
                    {editable ? null : <p className="text-xs text-muted">Message us to change it.</p>}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {hubLeg && rideConfig?.askFlight ? (
                        <>
                          <Field label="Flight number" required error={rideErrors[`flight.${index}`]}>
                            <Input
                              value={form.flightNumber}
                              placeholder="AA 1234"
                              autoComplete="off"
                              onChange={(e) => {
                                const value = e.target.value.toUpperCase()
                                const airline = airlineOf(value)
                                setLeg({ flightNumber: value, ...(airline ? { airline } : {}) })
                              }}
                            />
                          </Field>
                          <Field label="Airline" optional>
                            <Input value={form.airline} autoComplete="off" onChange={(e) => setLeg({ airline: e.target.value })} />
                          </Field>
                        </>
                      ) : null}
                      {rideShared ? null : (
                        <Field label={hubLeg ? (leg.direction === 'from_hub' ? labels.arrives : labels.leaves) : 'Pickup at'} required error={rideErrors[`time.${index}`]}>
                          <Input type="time" step={300} value={form.time} onChange={(e) => setLeg({ time: e.target.value })} />
                        </Field>
                      )}
                    </div>
                  </fieldset>
                )
              })}
              <Field label={ride.trip === 'between' || ride.trip === 'hourly' ? 'Pick up from' : 'Hotel name'} required error={rideErrors.place}>
                <Input value={rideForm.place} autoComplete="off" onChange={(e) => setRideForm((current) => ({ ...current, place: e.target.value }))} />
              </Field>
              {rideErrors.form ? (
                <p role="alert" className="text-sm font-medium text-danger">
                  {rideErrors.form}
                </p>
              ) : null}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(null)}>
                  Keep as is
                </Button>
                <Button onClick={saveRide}>Save changes</Button>
              </div>
            </div>
          ) : null}

          {open === 'move' ? (
            <div className="mt-4 flex flex-col gap-3 border-t border-line-subtle pt-4">
              <p className="text-sm font-medium">Pick a new day</p>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
                {bookable.slice(0, 21).map((day) => (
                  <button
                    key={day.dateKey}
                    type="button"
                    onClick={() => { setMoveDay(day.dateKey); setMoveSlot('') }}
                    className={cn('flex shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-xs', moveDay === day.dateKey ? 'border-primary bg-primary-soft text-primary' : 'border-line')}
                  >
                    <span className="font-semibold uppercase">{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${day.dateKey}T12:00:00`))}</span>
                    <span className="text-base font-semibold">{Number(day.dateKey.slice(8))}</span>
                  </button>
                ))}
              </div>
              {dayChoice ? (
                <div className="flex flex-wrap gap-2">
                  {dayChoice.slots
                    .filter((slot) => !slot.soldOut && slot.seatsLeft >= partySize && slot.departureId !== currentDepartureId)
                    .map((slot) => (
                      <button
                        key={slot.departureId}
                        type="button"
                        onClick={() => setMoveSlot(slot.departureId)}
                        className={cn('rounded-xl border px-3 py-2 text-sm font-medium', moveSlot === slot.departureId ? 'border-primary bg-primary-soft/40' : 'border-line')}
                      >
                        {formatTime(slot.startsAt)}
                        <span className="block text-xs font-normal text-subtle">{slot.seatsLeft} left</span>
                      </button>
                    ))}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  disabled={!moveSlot}
                  onClick={() => {
                    const slot = days.flatMap((day) => day.slots).find((entry) => entry.departureId === moveSlot)
                    if (!slot) return
                    changeBooking(
                      tenant.slug,
                      booking.reference,
                      start,
                      { movedTo: { departureId: slot.departureId, startsAt: slot.startsAt }, moves: moves + 1, fee: (change?.fee ?? 0) + rules.rescheduleFee },
                      { by: 'guest', what: `Moved to ${formatDateLong(new Date(slot.startsAt))} at ${formatTime(slot.startsAt)}` },
                    )
                    setOpen(null)
                    setMoveSlot('')
                    toast.success('Booking moved', { description: `${formatDateLong(new Date(slot.startsAt))} at ${formatTime(slot.startsAt)}.${rules.rescheduleFee > 0 ? ` ${money(rules.rescheduleFee)} charged.` : ''} A new confirmation is on its way.` })
                  }}
                >
                  {rules.rescheduleFee > 0 ? `Move and pay ${money(rules.rescheduleFee)}` : 'Move my booking'}
                </Button>
              </div>
            </div>
          ) : null}

          {open === 'guests' ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-4">
              <div className="flex items-center gap-3">
                <IconButton aria-label="Fewer guests" size="sm" variant="outline" disabled={adding <= 1} onClick={() => setAdding((n) => n - 1)}><Minus aria-hidden="true" /></IconButton>
                <span className="w-6 text-center text-base font-semibold tabular-nums">{adding}</span>
                <IconButton aria-label="More guests" size="sm" variant="outline" disabled={adding >= roomNow} onClick={() => setAdding((n) => n + 1)}><Plus aria-hidden="true" /></IconButton>
                <span className="text-sm text-muted">
                  {(() => {
                    // Guests past the usual spots are in extra spots, at their own price.
                    const inExtra = extraEach > 0 ? Math.max(0, partySize + adding - Math.max(partySize, usualForBooking)) : 0
                    const extraWords = `in extra spots at ${formatCurrency(extraEach, currency)} each`
                    if (inExtra === adding) return `more ${extraWords}`
                    const usual = perGroup ? 'more, in the group price' : `more at ${formatCurrency(pricePerGuest, currency)} each`
                    return inExtra > 0 ? `${usual} · ${inExtra} ${extraWords}` : usual
                  })()}{' '}
                  · {privateGroup ? `up to ${privateMost} ${pluralize(privateMost, 'guest')}` : priceStops ? `up to ${groupLimit} ${pluralize(groupLimit, 'guest')}` : `${roomNow} ${pluralize(roomNow, 'spot')} left`}
                </span>
              </div>
              <Button
                onClick={() => {
                  changeBooking(tenant.slug, booking.reference, start, { party: partySize + adding }, { by: 'guest', what: `Added ${adding} ${pluralize(adding, 'guest')}` })
                  // Nothing to pay in the group price: any balance still due stays due.
                  if (addingCost > 0) update({ balancePaid: true })
                  setOpen(null)
                  setAdding(1)
                  toast.success(`${adding} ${pluralize(adding, 'guest')} added`, { description: addingCost > 0 ? `Paid ${formatCurrency(addingCost, currency)}. Add their details above.` : 'Add their details above.' })
                }}
              >
                {addingCost > 0 ? `Add and pay ${formatCurrency(addingCost, currency)}` : `Add ${adding} ${pluralize(adding, 'guest')}`}
              </Button>
            </div>
          ) : null}

          {open === 'cancel' ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-4">
              <p className="text-sm text-muted">
                {refund > 0
                  ? `You get ${formatCurrency(refund, currency)} back${freeWindow ? (deposit > 0 && activity.policy.keepDeposit ? ', everything but the deposit' : ', the full amount') : ` (${activity.policy.lateRefundPercent}% this close to the start)`}.`
                  : `There is no refund now.${canMove ? ' You can still move to another time instead.' : ''}`}
              </p>
              <Button
                variant="danger"
                onClick={() => {
                  changeBooking(tenant.slug, booking.reference, start, { cancelled: true, refund }, { by: 'guest', what: refund > 0 ? `Cancelled, ${money(refund)} refunded` : 'Cancelled, no refund' })
                  setOpen(null)
                  toast('Booking cancelled', { description: refund > 0 ? `${formatCurrency(refund, currency)} refunded to your card.` : undefined })
                }}
              >
                Cancel booking
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className={cn(section, 'mt-6')}>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <MessageCircle className="size-4 text-primary" aria-hidden="true" />
          Message the team
        </h2>
        {conversation && conversation.messages.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2.5">
            {conversation.messages.map((entry) => (
              <div key={entry.id} className={cn('flex flex-col', entry.from === 'guest' ? 'items-end' : 'items-start')}>
                <p className={cn('max-w-[28rem] rounded-2xl px-3.5 py-2 text-sm', entry.from === 'guest' ? 'rounded-br-md bg-primary text-on-primary' : 'rounded-bl-md bg-surface-sunken text-foreground')}>
                  {entry.body}
                </p>
                <span className="mt-0.5 text-xs text-faint">{entry.from === 'staff' ? `${entry.author ?? tenant.name} · ` : ''}{formatRelative(entry.at, now)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs text-subtle">Questions about the day, the pickup or your group? Our team usually replies within the hour.</p>
        )}
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!message.trim()) return
            sendGuestMessage(tenant.slug, threadMeta, message.trim())
            setMessage('')
            toast.success('Message sent', { description: 'Our team will reply here and by email.' })
          }}
        >
          <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message" aria-label="Message the team" className="flex-1" />
          <Button type="submit" leftIcon={<Send />} disabled={!message.trim()}>Send</Button>
        </form>
      </section>
    </div>
  )
}
