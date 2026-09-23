'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileSignature,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  Send,
  Users,
  XCircle,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { TicketQr, ticketPayload } from '@/components/ui/ticket-qr'
import type { AvailabilityDay } from '@/components/storefront/booking-widget'
import {
  EMPTY_WAIVER,
  GuestDetailsStep,
  WaiverStep,
  validateGuestDetails,
  type TravellerState,
  type WaiverState,
} from '@/components/storefront/checkout-guest-details'
import { sendGuestMessage, useInbox } from '@/hooks/use-inbox'
import type { InboxThread } from '@/lib/inbox'
import { answerProblem } from '@/lib/guest-requirements'
import { cn, formatCurrency, formatDateLong, formatRelative, formatTime, pluralize } from '@/lib/utils'
import type { ActivityKind, BookingStatus, CurrencyCode, GuestQuestion, WaiverTemplate } from '@/types'

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
          freeCancellationHours: number
          lateRefundPercent: number
          pricePerGuest: number
          guestQuestions: GuestQuestion[]
          kind: ActivityKind
        }
        departure: { id: string; startsAt: string; endsAt: string; seatsLeft: number }
        waiver?: WaiverTemplate
        days: AvailabilityDay[]
        thread?: InboxThread
        nowIso: string
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

function ManageBookingInner({ tenant, booking, guest, activity, departure, waiver, days, thread, nowIso }: InnerProps) {
  const [state, update] = useManageState(tenant.slug, booking.reference)
  const [open, setOpen] = React.useState<'waiver' | 'details' | 'move' | 'guests' | 'cancel' | null>(null)
  const now = React.useMemo(() => new Date(nowIso), [nowIso])
  const currency = tenant.currency

  const startsAt = state.movedTo ?? departure.startsAt
  const hoursToGo = (new Date(startsAt).getTime() - now.getTime()) / 3_600_000
  const past = hoursToGo < 0
  const cancelled = state.cancelled || booking.status === 'cancelled' || booking.status === 'refunded'
  const freeWindow = hoursToGo >= activity.freeCancellationHours
  const partySize = booking.partySize + state.addedGuests
  const extra = state.addedGuests * activity.pricePerGuest
  const balance = state.balancePaid ? 0 : Math.max(0, booking.total + extra - booking.amountPaid)
  const unsigned = state.waiversSigned ? 0 : booking.participants.filter((participant) => !participant.waiverSigned).length
  const missingDetails = state.detailsDone
    ? 0
    : booking.participants.reduce(
        (sum, participant) => sum + activity.guestQuestions.filter((question) => question.scope === 'guest' && answerProblem(question, participant.answers[question.id])).length,
        0,
      )
  const refund = Math.round(booking.amountPaid * (freeWindow ? 1 : activity.lateRefundPercent / 100))

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
  const bookable = days.filter((day) => day.slots.some((slot) => !slot.soldOut && slot.seatsLeft >= partySize && slot.departureId !== departure.id))
  const dayChoice = days.find((day) => day.dateKey === moveDay)

  /* add guests */
  const [adding, setAdding] = React.useState(1)

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
    missingDetails > 0 ? { key: 'details' as const, icon: ClipboardList, title: 'Add guest details', detail: `${missingDetails} ${pluralize(missingDetails, 'answer')} the crew needs` } : null,
    balance > 0 ? { key: 'balance' as const, icon: CreditCard, title: `Pay the balance of ${formatCurrency(balance, currency)}`, detail: 'Due before the day' } : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item))

  const section = 'rounded-2xl border border-line bg-surface p-5'

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.12em] text-faint uppercase">Your booking with {tenant.name}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{activity.name}</h1>
      <p className="mt-1 text-muted">Hi {guest.firstName}, everything about your trip is here.</p>

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
                <dd className="font-medium">{formatDateLong(new Date(startsAt))} · {formatTime(startsAt)}</dd>
                {state.movedTo ? <dd className="text-xs text-success">Moved from {formatDateLong(new Date(departure.startsAt))}</dd> : null}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Users className="mt-0.5 size-4 text-primary" aria-hidden="true" />
              <div>
                <dt className="text-xs text-subtle">Guests</dt>
                <dd className="font-medium">{partySize} {pluralize(partySize, 'guest')}</dd>
              </div>
            </div>
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
          </dl>
          <div className="shrink-0">
            {cancelled ? <Badge variant="neutral">Cancelled</Badge> : past ? <Badge variant="neutral">Completed</Badge> : <Badge variant="success">Confirmed</Badge>}
          </div>
        </div>
      </div>

      {cancelled ? (
        <div role="status" className="mt-6 rounded-2xl border border-line bg-surface-sunken px-5 py-4 text-sm">
          This booking is cancelled{state.refunded ? `. ${formatCurrency(state.refunded, currency)} is on its way back to your card.` : '.'} We hope to see you another time.
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
                toast.success('Details saved', { description: 'The crew has what it needs.' })
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
          <p className="mt-0.5 text-xs text-subtle">
            {freeWindow
              ? `Free changes and cancellation until ${activity.freeCancellationHours} hours before the start.`
              : `Inside ${activity.freeCancellationHours} hours, changes go through the crew: call ${tenant.phone} or send a message below.`}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" leftIcon={<CalendarDays />} disabled={!freeWindow} onClick={() => setOpen(open === 'move' ? null : 'move')}>Reschedule</Button>
            {activity.kind !== 'charter' ? (
              <Button variant="secondary" leftIcon={<Users />} disabled={departure.seatsLeft <= 0} onClick={() => setOpen(open === 'guests' ? null : 'guests')}>Add guests</Button>
            ) : null}
            <Button variant="ghost" leftIcon={<XCircle />} onClick={() => setOpen(open === 'cancel' ? null : 'cancel')}>Cancel booking</Button>
          </div>

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
                    .filter((slot) => !slot.soldOut && slot.seatsLeft >= partySize && slot.departureId !== departure.id)
                    .map((slot) => (
                      <button
                        key={slot.departureId}
                        type="button"
                        onClick={() => setMoveSlot(slot.startsAt)}
                        className={cn('rounded-xl border px-3 py-2 text-sm font-medium', moveSlot === slot.startsAt ? 'border-primary bg-primary-soft/40' : 'border-line')}
                      >
                        {formatTime(slot.startsAt)}
                      </button>
                    ))}
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button
                  disabled={!moveSlot}
                  onClick={() => {
                    update({ movedTo: moveSlot })
                    setOpen(null)
                    toast.success('Booking moved', { description: `${formatDateLong(new Date(moveSlot))} at ${formatTime(moveSlot)}. A new confirmation is on its way.` })
                  }}
                >
                  Move my booking
                </Button>
              </div>
            </div>
          ) : null}

          {open === 'guests' ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-4">
              <div className="flex items-center gap-3">
                <IconButton aria-label="Fewer guests" size="sm" variant="outline" disabled={adding <= 1} onClick={() => setAdding((n) => n - 1)}><Minus aria-hidden="true" /></IconButton>
                <span className="w-6 text-center text-base font-semibold tabular-nums">{adding}</span>
                <IconButton aria-label="More guests" size="sm" variant="outline" disabled={adding >= departure.seatsLeft} onClick={() => setAdding((n) => n + 1)}><Plus aria-hidden="true" /></IconButton>
                <span className="text-sm text-muted">more at {formatCurrency(activity.pricePerGuest, currency)} each · {departure.seatsLeft} seats left</span>
              </div>
              <Button
                onClick={() => {
                  update({ addedGuests: state.addedGuests + adding, balancePaid: true })
                  setOpen(null)
                  toast.success(`${adding} ${pluralize(adding, 'guest')} added`, { description: `Paid ${formatCurrency(adding * activity.pricePerGuest, currency)}. Add their details above.` })
                }}
              >
                Add and pay {formatCurrency(adding * activity.pricePerGuest, currency)}
              </Button>
            </div>
          ) : null}

          {open === 'cancel' ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-4">
              <p className="text-sm text-muted">
                {refund > 0 ? `You get ${formatCurrency(refund, currency)} back${freeWindow ? ', the full amount' : ` (${activity.lateRefundPercent}% inside ${activity.freeCancellationHours} hours)`}.` : `Inside ${activity.freeCancellationHours} hours there is no refund, but you can still move to another day by messaging the crew.`}
              </p>
              <Button
                variant="danger"
                onClick={() => {
                  update({ cancelled: true, refunded: refund })
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
          Message the crew
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
          <p className="mt-1 text-xs text-subtle">Questions about the day, the pickup or your group? The crew usually replies within the hour.</p>
        )}
        <form
          className="mt-3 flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!message.trim()) return
            sendGuestMessage(tenant.slug, threadMeta, message.trim())
            setMessage('')
            toast.success('Message sent', { description: 'The crew will reply here and by email.' })
          }}
        >
          <Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message" aria-label="Message the crew" className="flex-1" />
          <Button type="submit" leftIcon={<Send />} disabled={!message.trim()}>Send</Button>
        </form>
      </section>
    </div>
  )
}
