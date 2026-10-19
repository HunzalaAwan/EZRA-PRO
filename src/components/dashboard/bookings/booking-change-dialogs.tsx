'use client'

import * as React from 'react'
import { Minus, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { sendToGuests, type MessageRecipient } from '@/components/dashboard/bookings/message-composer'
import { useBookingLedger } from '@/hooks/use-booking-ledger'
import { useMessageTemplates } from '@/hooks/use-message-templates'
import { fetchStorefrontAvailability } from '@/lib/actions/dashboard'
import { changeBooking } from '@/lib/booking-ledger'
import { hoursLabel, refundFor, splitPayment } from '@/lib/booking-policy'
import { cn, formatCurrency, formatDateLong, formatTime } from '@/lib/utils'
import type { CancellationPolicy, ChangeRules, CurrencyCode, PaymentTerms } from '@/types'

/* ==========================================================================
   Changing a booking from the dashboard — move it to another time, change
   how many are coming, or cancel it with the refund the policy gives (or
   another amount). Every change goes in the booking ledger, so seats move
   on the calendar at once, and the guest can be told in the same step.
   ========================================================================== */

export interface ChangeTarget {
  reference: string
  bookingId?: string
  /** Where the booking started, for the seat counts. */
  fromDepartureId: string
  fromStartsAt: string
  fromParty: number
  /** Where it is now, after any earlier move. */
  departureId: string
  startsAt: string
  party: number
  moves: number
}

const SWITCH_ROW = 'flex items-start justify-between gap-3 rounded-xl border border-line px-3.5 py-3'

export function ChangeBookingDialog({
  open,
  onOpenChange,
  target,
  activity,
  recipient,
  tenantId,
  tenantSlug,
  business,
  currency,
  nowIso,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: ChangeTarget
  activity: { id: string; name: string; kind: string; changes: ChangeRules }
  recipient: MessageRecipient
  tenantId: string
  tenantSlug: string
  business: string
  currency: CurrencyCode
  nowIso: string
}) {
  const ledger = useBookingLedger(tenantSlug)
  const { templates } = useMessageTemplates(tenantId)
  const [events, setEvents] = React.useState<{ departureId: string; startsAt: string; seatsLeft: number }[] | null>(null)
  const [party, setParty] = React.useState(target.party)
  const [dayKey, setDayKey] = React.useState(target.startsAt.slice(0, 10))
  const [picked, setPicked] = React.useState(target.departureId)
  const [chargeFee, setChargeFee] = React.useState(false)
  const [notify, setNotify] = React.useState(true)

  React.useEffect(() => {
    if (!open) return
    setParty(target.party)
    setDayKey(target.startsAt.slice(0, 10))
    setPicked(target.departureId)
    setChargeFee(false)
    setNotify(true)
    let live = true
    fetchStorefrontAvailability(activity.id, 60).then((rows) => {
      if (live) setEvents(rows.map((row) => ({ departureId: row.departure.id, startsAt: row.departure.startsAt, seatsLeft: row.seatsLeft })))
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activity.id, target.reference, target.departureId])

  // Seats each time has for this booking: what is left, plus this booking's own seats where it sits now.
  const room = (row: { departureId: string; seatsLeft: number }) =>
    Math.max(0, row.seatsLeft - (ledger.delta[row.departureId] ?? 0)) + (row.departureId === target.departureId ? target.party : 0)
  const future = (events ?? []).filter((row) => row.startsAt > nowIso)
  const days = [...new Set(future.map((row) => row.startsAt.slice(0, 10)))].slice(0, 28)
  const times = future.filter((row) => row.startsAt.startsWith(dayKey))
  const choice = future.find((row) => row.departureId === picked)
  const fits = choice ? room(choice) >= party : false
  const moved = picked !== target.departureId
  const changed = moved || party !== target.party
  const fee = moved && chargeFee ? activity.changes.rescheduleFee : 0
  const wholeGroup = activity.kind === 'charter' || activity.kind === 'rental'

  const save = () => {
    if (!choice || !fits || !changed) return
    const what = [moved ? `Moved to ${formatDateLong(new Date(choice.startsAt))} at ${formatTime(choice.startsAt)}` : null, party !== target.party ? `${party} guests (was ${target.party})` : null].filter(Boolean).join(' · ')
    changeBooking(
      tenantSlug,
      target.reference,
      { fromDepartureId: target.fromDepartureId, fromStartsAt: target.fromStartsAt, fromParty: target.fromParty },
      {
        ...(moved ? { movedTo: { departureId: choice.departureId, startsAt: choice.startsAt }, moves: target.moves + 1 } : {}),
        ...(party !== target.fromParty || party !== target.party ? { party } : {}),
        ...(fee > 0 ? { fee } : {}),
      },
      { by: 'staff', what },
    )
    const template = templates.find((entry) => entry.key === 'rescheduled')
    if (notify && template) {
      sendToGuests([{ ...recipient, startsAt: choice.startsAt, party }], { tenantSlug, business, subject: template.subject, body: template.body })
    }
    onOpenChange(false)
    toast.success('Booking changed', { description: `${what}${notify ? '. The guest has been told.' : '.'}` })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Change {target.reference}</DialogTitle>
          <DialogDescription>
            {activity.name}, now {formatDateLong(new Date(target.startsAt))} at {formatTime(target.startsAt)} for {target.party}. Only times with room for the group are offered.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5">
          {wholeGroup ? null : (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5">
              <span className="text-sm font-medium">Guests</span>
              <span className="flex items-center gap-2">
                <IconButton type="button" size="sm" variant="outline" aria-label="Fewer guests" disabled={party <= 1} onClick={() => setParty(party - 1)}>
                  <Minus aria-hidden="true" />
                </IconButton>
                <span className="w-7 text-center text-sm font-semibold tabular-nums">{party}</span>
                <IconButton type="button" size="sm" variant="outline" aria-label="More guests" onClick={() => setParty(party + 1)}>
                  <Plus aria-hidden="true" />
                </IconButton>
              </span>
            </div>
          )}

          <div>
            <p className="text-sm font-medium">Day</p>
            {events === null ? <p className="mt-2 text-sm text-muted">Loading times…</p> : null}
            <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {days.map((key) => {
                const open = future.some((row) => row.startsAt.startsWith(key) && room(row) >= party)
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!open}
                    aria-pressed={key === dayKey}
                    onClick={() => setDayKey(key)}
                    className={cn(
                      'flex shrink-0 flex-col items-center rounded-xl border px-3 py-1.5 text-xs',
                      key === dayKey ? 'border-primary bg-primary text-on-primary' : open ? 'border-line hover:border-line-strong' : 'cursor-not-allowed border-line-subtle text-faint',
                    )}
                  >
                    <span className="font-semibold uppercase">{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${key}T12:00:00`))}</span>
                    <span className="text-base font-semibold tabular">{Number(key.slice(8))}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium">Time</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {times.map((row) => {
                const left = room(row)
                const ok = left >= party
                const current = row.departureId === target.departureId
                return (
                  <button
                    key={row.departureId}
                    type="button"
                    disabled={!ok}
                    aria-pressed={picked === row.departureId}
                    onClick={() => setPicked(row.departureId)}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left',
                      picked === row.departureId ? 'border-primary bg-primary-soft/40' : ok ? 'border-line hover:border-line-strong' : 'cursor-not-allowed border-line-subtle text-faint',
                    )}
                  >
                    <span className="block text-sm font-semibold tabular">{formatTime(row.startsAt)}</span>
                    <span className="block text-xs text-subtle">{current ? 'Current' : ok ? `${left} left` : 'No room'}</span>
                  </button>
                )
              })}
              {events !== null && times.length === 0 ? <p className="col-span-full text-sm text-muted">Not running this day.</p> : null}
            </div>
          </div>

          {moved && activity.changes.rescheduleFee > 0 ? (
            <label className={SWITCH_ROW}>
              <span>
                <span className="block text-sm font-medium">Charge the move fee</span>
                <span className="block text-xs text-subtle">{formatCurrency(activity.changes.rescheduleFee, currency)}, as the activity&rsquo;s rules say. Leave off when the move is your call.</span>
              </span>
              <Switch checked={chargeFee} onCheckedChange={setChargeFee} aria-label="Charge the move fee" />
            </label>
          ) : null}
          <label className={SWITCH_ROW}>
            <span>
              <span className="block text-sm font-medium">Tell the guest</span>
              <span className="block text-xs text-subtle">Sends &ldquo;Booking moved&rdquo; with the new details. Edit it in Marketing, Automations.</span>
            </span>
            <Switch checked={notify} onCheckedChange={setNotify} aria-label="Tell the guest" />
          </label>
        </DialogBody>
        <DialogFooter divider>
          <DialogClose asChild>
            <Button variant="secondary">Keep as is</Button>
          </DialogClose>
          <Button onClick={save} disabled={!changed || !fits}>
            {fee > 0 ? `Save and charge ${formatCurrency(fee, currency)}` : 'Save change'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const REASONS = ['Guest asked', 'Weather or conditions', 'Not enough guests', 'We cannot run it', 'Booked by mistake', 'Other'] as const

export function CancelBookingDialog({
  open,
  onOpenChange,
  target,
  amountPaid,
  total,
  policy,
  payment,
  recipient,
  tenantId,
  tenantSlug,
  business,
  currency,
  nowIso,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: ChangeTarget
  amountPaid: number
  total: number
  policy: Pick<CancellationPolicy, 'freeCancellationHours' | 'lateRefundPercent' | 'keepDeposit'>
  payment: PaymentTerms
  recipient: MessageRecipient
  tenantId: string
  tenantSlug: string
  business: string
  currency: CurrencyCode
  nowIso: string
}) {
  const { templates } = useMessageTemplates(tenantId)
  const hoursToGo = (new Date(target.startsAt).getTime() - new Date(nowIso).getTime()) / 3_600_000
  const deposit = payment.collect === 'deposit' ? splitPayment(payment, total, target.fromParty).now : 0
  const byPolicy = refundFor(policy, amountPaid, hoursToGo, deposit)
  const [mode, setMode] = React.useState<'policy' | 'full' | 'none' | 'custom'>('policy')
  const [custom, setCustom] = React.useState('')
  const [reason, setReason] = React.useState<string>(REASONS[0])
  const [notify, setNotify] = React.useState(true)

  React.useEffect(() => {
    if (!open) return
    setMode('policy')
    setCustom('')
    setReason(REASONS[0])
    setNotify(true)
  }, [open])

  const refund = mode === 'full' ? amountPaid : mode === 'none' ? 0 : mode === 'custom' ? Math.min(amountPaid, Math.max(0, Math.round(Number(custom) * 100) || 0)) : byPolicy
  const money = (minor: number) => formatCurrency(minor, currency, { decimals: true })
  const options = [
    { value: 'policy' as const, title: `By the policy · ${money(byPolicy)}`, text: hoursToGo >= policy.freeCancellationHours && policy.freeCancellationHours > 0 ? `More than ${hoursLabel(policy.freeCancellationHours)} to go: a full refund${policy.keepDeposit && deposit > 0 ? ' less the deposit' : ''}.` : `${policy.lateRefundPercent}% this close to the start.` },
    { value: 'full' as const, title: `Full refund · ${money(amountPaid)}`, text: 'Everything paid goes back. Use it when you cancel.' },
    { value: 'none' as const, title: 'No refund', text: 'Nothing goes back.' },
    { value: 'custom' as const, title: 'Another amount', text: 'A goodwill amount of your choosing.' },
  ]

  const save = () => {
    changeBooking(
      tenantSlug,
      target.reference,
      { fromDepartureId: target.fromDepartureId, fromStartsAt: target.fromStartsAt, fromParty: target.fromParty },
      { cancelled: true, refund },
      { by: 'staff', what: `Cancelled: ${reason}${refund > 0 ? `, ${money(refund)} refunded` : ', no refund'}` },
    )
    const template = templates.find((entry) => entry.key === 'cancelled')
    if (notify && template) {
      sendToGuests([recipient], {
        tenantSlug,
        business,
        subject: template.subject,
        body: template.body,
        extra: { refund_line: refund > 0 ? `We have refunded ${money(refund)} to your card; it shows in 5 to 10 days.` : '' },
      })
    }
    onOpenChange(false)
    toast.success(`${target.reference} cancelled`, {
      description: `${target.party} ${target.party === 1 ? 'seat' : 'seats'} back on sale${refund > 0 ? `, ${money(refund)} refunded` : ''}${notify ? '. The guest has been told.' : '.'}`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Cancel {target.reference}</DialogTitle>
          <DialogDescription>
            {recipient.firstName} {recipient.lastName}, {recipient.activityName} on {formatDateLong(new Date(target.startsAt))}. {money(amountPaid)} paid so far. Their seats go back on sale.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <div role="radiogroup" aria-label="Refund" className="grid gap-2 sm:grid-cols-2">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={mode === option.value}
                onClick={() => setMode(option.value)}
                className={cn('rounded-xl border px-3.5 py-2.5 text-left', mode === option.value ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong')}
              >
                <span className="block text-sm font-medium">{option.title}</span>
                <span className="block text-xs text-subtle">{option.text}</span>
              </button>
            ))}
          </div>
          {mode === 'custom' ? (
            <Field label="Refund" className="sm:max-w-xs">
              {(control) => <Input {...control} type="number" min={0} placeholder="0" value={custom} onChange={(event) => setCustom(event.target.value)} />}
            </Field>
          ) : null}
          <Field label="Why">
            {({ id }) => (
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger id={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      {entry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <label className={SWITCH_ROW}>
            <span>
              <span className="block text-sm font-medium">Tell the guest</span>
              <span className="block text-xs text-subtle">Sends &ldquo;Booking cancelled&rdquo; with the refund.</span>
            </span>
            <Switch checked={notify} onCheckedChange={setNotify} aria-label="Tell the guest" />
          </label>
        </DialogBody>
        <DialogFooter divider>
          <DialogClose asChild>
            <Button variant="secondary">Keep the booking</Button>
          </DialogClose>
          <Button variant="danger" onClick={save}>
            {refund > 0 ? `Cancel and refund ${money(refund)}` : 'Cancel booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
