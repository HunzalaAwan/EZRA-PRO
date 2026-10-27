'use client'

import * as React from 'react'
import { CheckCircle2, Clock, Minus, Phone, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { TransportPicker } from '@/components/storefront/transport-picker'
import { useTransport } from '@/hooks/use-transport'
import { REASON_LABEL, TIME_WINDOWS } from '@/lib/booking-method'
import { priceTransport } from '@/lib/price-engine'
import { choiceErrors, cleanChoice, defaultChoice, requestTransportLine, requestTransportOf, type TransportChoice, type TransportSetup } from '@/lib/transport'
import { cn, formatCurrency } from '@/lib/utils'
import type { Activity, ActivityPickup, BookingSettings, CurrencyCode, PickupZone, RequestReason, TransferBookingDetails } from '@/types'

/* ==========================================================================
   Requests from the storefront — one form for every reason a guest asks
   instead of booking: the activity is request-to-book, the group is bigger
   than online booking allows, they want another date, it is sooner than the
   notice, or they want something custom. Everything lands in Custom
   requests with what they picked, so the business can confirm with a quote
   and a payment link in one step.
   ========================================================================== */

const EMAIL = /^\S+@\S+\.\S+$/

export interface RequestContext {
  reason: RequestReason
  /** A time they picked on the schedule. */
  slot?: { departureId: string; startsAt: string }
  /** What they picked, at list prices, so the quote can start from it. */
  lines?: { label: string; qty: number; unit: number }[]
  party?: number
  /** Ask for a date and a time of day. */
  askDate?: boolean
  /** Ask how many people. */
  askParty?: boolean
  /** The earliest date they can ask for, yyyy-mm-dd. */
  minDate?: string
  /** Transfers: the ride they asked for (trip, where, passengers, suitcases, times, vehicles), kept on the request. */
  transfer?: TransferBookingDetails
}

/**
 * Transport on the activity, for a request: the guest's choice from the
 * Getting there step (the widget), or, without one, the form asks (the
 * enquiry panel). Priced by the engine like a booking.
 */
export interface RequestFormTransport {
  setup: TransportSetup
  /** The pickup zones the activity serves, as the business has them now. */
  zones: PickupZone[]
  /** The activity's transport as saved, for the price. */
  pickup: ActivityPickup
  meetingPoint: string
  /** Chosen on the Getting there step; absent: the form asks. */
  choice?: TransportChoice
}

const PROMPT: Record<RequestReason, string> = {
  booking: 'Anything we should know? The occasion, who is coming, questions.',
  group: 'Tell us about your group: ages, the occasion, anything special.',
  date: 'Which day and time would suit you best?',
  sooner: 'When would you like to go?',
  quote: 'What would you like? A private version, a special occasion, something else.',
  message: 'What would you like to ask or arrange?',
}

export function RequestForm({
  activity,
  tenantSlug,
  currency,
  context,
  replyHours,
  title,
  onCancel,
  className,
  transport,
}: {
  activity: Pick<Activity, 'slug' | 'name' | 'minParticipants' | 'maxCapacity'>
  tenantSlug: string
  currency: CurrencyCode
  context: RequestContext
  replyHours: number
  title?: string
  onCancel?: () => void
  className?: string
  transport?: RequestFormTransport
}) {
  const transportId = React.useId()
  const [form, setForm] = React.useState({
    date: '',
    when: 'Any time' as string,
    party: Math.max(1, context.party ?? Math.max(activity.minParticipants, 2)),
    name: '',
    email: '',
    phone: '',
    message: '',
  })
  const [sent, setSent] = React.useState(false)
  const [tried, setTried] = React.useState(false)
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }))
  /* ---------- transport: the widget's choice, or asked here ---------- */
  const setup = transport?.setup
  const zones = transport?.zones
  const [asked, setAsked] = React.useState<TransportChoice>(() => defaultChoice(setup))
  React.useEffect(() => {
    if (!setup || !zones) return
    setAsked((current) => {
      const next = cleanChoice(setup, current, zones)
      return JSON.stringify(next) === JSON.stringify(current) ? current : next
    })
  }, [setup, zones])
  const choice = transport ? (transport.choice ?? asked) : undefined
  const zoneName = choice ? zones?.find((zone) => zone.id === choice.zoneId)?.name : undefined
  // What it adds at list prices, per guest or per booking, as a line of the request.
  const ride = transport && choice ? priceTransport({ pickup: transport.pickup }, choice, form.party, zoneName) : null
  const lines = [...(context.lines ?? []), ...(ride ? [{ label: ride.label, qty: ride.quantity, unit: ride.unitPrice }] : [])]
  const asking = transport && choice ? requestTransportOf(transport.setup, choice, transport.zones) : undefined
  const transportProblem = transport && choice ? Object.values(choiceErrors(transport.setup, choice))[0] : undefined
  const estimate = lines.reduce((sum, line) => sum + line.qty * line.unit, 0)
  const problems = {
    name: form.name.trim().length < 2,
    email: !EMAIL.test(form.email.trim()),
    date: Boolean(context.askDate) && !form.date,
    transport: Boolean(transportProblem),
  }
  const reply = replyHours <= 1 ? 'within the hour' : replyHours < 24 ? `within ${replyHours} hours` : replyHours === 24 ? 'within a day' : `within ${Math.round(replyHours / 24)} days`

  if (sent) {
    return (
      <div role="status" className={cn('rounded-xl border border-success/40 bg-success-soft px-4 py-3.5 text-sm', className)}>
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
          Request sent
        </p>
        <p className="mt-1 text-muted">
          We reply {reply} to {form.email}. If it works, you get the price and a link to pay. Nothing is charged until then.
        </p>
      </div>
    )
  }

  return (
    <form
      className={cn('flex flex-col gap-2.5 rounded-xl border border-line p-3.5', className)}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        setTried(true)
        if (problems.name || problems.email || problems.date || problems.transport) return
        try {
          const key = `ezra:charter-requests:${tenantSlug}`
          const list = JSON.parse(window.localStorage.getItem(key) ?? '[]') as unknown[]
          list.unshift({
            id: `req_${Date.now().toString(36)}`,
            activitySlug: activity.slug,
            departureId: context.slot?.departureId,
            startsAt: context.slot?.startsAt ?? (form.date ? `${form.date}T12:00:00` : ''),
            ...(context.askDate ? { when: form.when } : {}),
            party: form.party,
            lines: lines.length > 0 ? lines : undefined,
            reason: context.reason,
            ...(context.transfer ? { transfer: context.transfer } : {}),
            ...(asking ? { transport: asking } : {}),
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            message: form.message.trim(),
            createdAt: new Date().toISOString(),
          })
          window.localStorage.setItem(key, JSON.stringify(list.slice(0, 50)))
        } catch {
          /* storage blocked: the request still shows as sent */
        }
        setSent(true)
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{title ?? REASON_LABEL[context.reason]}</p>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="text-xs font-medium text-subtle hover:text-foreground">
            Cancel
          </button>
        ) : null}
      </div>
      {lines.length > 0 || (asking && transport?.choice) ? (
        <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted">
          {lines.map((line) => `${line.qty} × ${line.label}`).join(', ')}
          {/* Free or included transport adds no line: the choice still shows. */}
          {asking && transport?.choice && !ride ? `${lines.length > 0 ? ', ' : ''}${requestTransportLine(asking)}` : null}
          {estimate > 0 ? <span className="text-subtle"> · about {formatCurrency(estimate, currency)} at list prices</span> : null}
        </p>
      ) : null}
      {context.askDate ? (
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" aria-label="Preferred date" min={context.minDate} value={form.date} aria-invalid={tried && problems.date ? true : undefined} onChange={(e) => set({ date: e.target.value })} />
          <select
            aria-label="Time of day"
            value={form.when}
            onChange={(e) => set({ when: e.target.value })}
            className="h-10 rounded-lg border border-line bg-surface px-3 text-sm text-foreground"
          >
            {TIME_WINDOWS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
      ) : null}
      {context.askParty ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
          <span className="text-sm text-foreground">How many people</span>
          <span className="flex items-center gap-2">
            <IconButton type="button" aria-label="Fewer people" size="sm" variant="outline" disabled={form.party <= 1} onClick={() => set({ party: form.party - 1 })}>
              <Minus aria-hidden="true" />
            </IconButton>
            <span className="w-7 text-center text-sm font-semibold tabular-nums">{form.party}</span>
            <IconButton type="button" aria-label="More people" size="sm" variant="outline" onClick={() => set({ party: form.party + 1 })}>
              <Plus aria-hidden="true" />
            </IconButton>
          </span>
        </div>
      ) : null}
      {transport && !transport.choice ? (
        <div className="flex flex-col gap-2 rounded-lg border border-line px-3 py-2.5">
          <p className="text-[0.8125rem] font-semibold text-foreground">Getting there</p>
          <TransportPicker
            setup={transport.setup}
            zones={transport.zones}
            value={asked}
            onChange={setAsked}
            currency={currency}
            guests={Math.max(1, form.party)}
            meetingPoint={transport.meetingPoint}
            errors={tried ? choiceErrors(transport.setup, asked) : {}}
            idPrefix={`request${transportId.replace(/:/g, '')}`}
          />
        </div>
      ) : null}
      <Input placeholder="Your name" aria-label="Your name" autoComplete="name" value={form.name} aria-invalid={tried && problems.name ? true : undefined} onChange={(e) => set({ name: e.target.value })} />
      <div className="grid grid-cols-2 gap-2">
        <Input type="email" placeholder="Email" aria-label="Email" autoComplete="email" value={form.email} aria-invalid={tried && problems.email ? true : undefined} onChange={(e) => set({ email: e.target.value })} />
        <Input type="tel" placeholder="Mobile (optional)" aria-label="Mobile" autoComplete="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
      </div>
      <Textarea rows={3} placeholder={PROMPT[context.reason]} aria-label="Message" value={form.message} onChange={(e) => set({ message: e.target.value })} />
      {tried && (problems.name || problems.email || problems.date || problems.transport) ? (
        <p className="text-xs font-medium text-danger">
          {problems.date ? 'Pick a date. ' : ''}
          {/* Chosen on the Getting there step above: say where to fix it. */}
          {transportProblem ? `${transportProblem}${transport?.choice ? ' under Getting there' : ''}. ` : ''}
          {problems.name ? 'Add your name. ' : ''}
          {problems.email ? 'Add a valid email.' : ''}
        </p>
      ) : null}
      <Button type="submit" size="lg" fullWidth>
        Send request
      </Button>
      <p className="text-center text-xs text-subtle">We reply {reply}. Nothing is charged until you confirm.</p>
    </form>
  )
}

/* --------------------------------------------------------------------------
   Enquiry panel — request to book with no set schedule: no date picker and
   no checkout; a request form, and a number to call if the business has one.
   -------------------------------------------------------------------------- */

export function EnquiryPanel({
  activity,
  tenantSlug,
  currency,
  settings,
  businessPhone,
  minDate,
  priceUnit,
  className,
  pickupZones,
}: {
  activity: Pick<Activity, 'slug' | 'name' | 'minParticipants' | 'maxCapacity' | 'basePrice' | 'kind' | 'pickup' | 'tenantId' | 'meetingPoint'>
  tenantSlug: string
  currency: CurrencyCode
  settings: BookingSettings
  businessPhone: string
  minDate: string
  priceUnit: string
  className?: string
  /** The business's pickup zones, for transport on the activity. */
  pickupZones?: PickupZone[]
}) {
  const phone = settings.phone.trim() || businessPhone
  const { setup, zones } = useTransport(activity, pickupZones)
  return (
    <section aria-label="How to book" className={cn('flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-lg', className)}>
      <div>
        <p className="text-xs font-semibold tracking-[0.12em] text-faint uppercase">From</p>
        <p className="font-display text-3xl font-semibold tracking-tight text-foreground tabular">
          {formatCurrency(activity.basePrice, currency)}
          <span className="ml-1.5 text-sm font-medium text-subtle">{priceUnit}</span>
        </p>
      </div>

      <ol className="flex list-none flex-col gap-1.5 p-0 text-sm text-muted">
        {['Tell us the day and your group.', `We reply ${settings.replyHours <= 24 ? 'within a day' : 'soon'} with the price.`, 'Pay the link to confirm.'].map((step, index) => (
          <li key={step} className="flex gap-2">
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>

      <RequestForm
        activity={activity}
        tenantSlug={tenantSlug}
        currency={currency}
        context={{ reason: 'booking', askDate: true, askParty: true, minDate }}
        replyHours={settings.replyHours}
        title="Request a date"
        transport={setup && activity.pickup ? { setup, zones, pickup: activity.pickup, meetingPoint: activity.meetingPoint } : undefined}
      />

      {phone ? (
        <div className="flex flex-col gap-1.5 border-t border-line-subtle pt-4">
          <p className="text-center text-xs text-subtle">Prefer to talk it through?</p>
          <Button asChild size="lg" variant="outline" fullWidth leftIcon={<Phone />}>
            <a href={`tel:${phone.replace(/[^\d+]/g, '')}`}>Call {phone}</a>
          </Button>
          {settings.callHours ? (
            <p className="flex items-center justify-center gap-1.5 text-xs text-subtle">
              <Clock className="size-3.5" aria-hidden="true" />
              {settings.callHours}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
