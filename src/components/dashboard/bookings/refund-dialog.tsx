'use client'

import * as React from 'react'
import { Landmark, RotateCcw } from 'lucide-react'

import { cn, formatCurrency, formatDateShort } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import type { BookingStatus, CurrencyCode } from '@/types'

/* ==========================================================================
   RefundDialog — one refund flow, reached from the reservations list, the
   booking record and the guest's profile.

   It answers the four questions a desk asks before money goes back: how much,
   why, does the seat go too, and does the guest hear about it. Amounts are in
   minor units everywhere except the one input the operator types into.
   ========================================================================== */

export type RefundReason =
  | 'guest_request'
  | 'weather'
  | 'operator_cancelled'
  | 'overbooked'
  | 'duplicate'
  | 'goodwill'
  | 'other'

export const REFUND_REASONS: { value: RefundReason; label: string }[] = [
  { value: 'guest_request', label: 'Guest asked to cancel' },
  { value: 'weather', label: 'Weather or sea state' },
  { value: 'operator_cancelled', label: 'We cancelled the departure' },
  { value: 'overbooked', label: 'Overbooked' },
  { value: 'duplicate', label: 'Duplicate charge' },
  { value: 'goodwill', label: 'Goodwill after a complaint' },
  { value: 'other', label: 'Something else' },
]

export interface RefundTarget {
  id: string
  reference: string
  guestName: string
  activityName: string
  departureAt: string
  partySize: number
  status: BookingStatus
  /** Minor units. */
  total: number
  /** Minor units actually collected. */
  amountPaid: number
  /** Minor units already returned. */
  refunded: number
  /** Processing fee kept by the processor, minor units. */
  fee?: number
  /** e.g. "Visa ···· 6048". */
  paymentMethodLabel?: string
}

export interface RefundResult {
  refunds: { id: string; amount: number }[]
  reason: RefundReason
  note: string
  cancelBooking: boolean
  notifyGuest: boolean
}

export interface RefundDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  targets: RefundTarget[]
  currency: CurrencyCode
  onConfirm: (result: RefundResult) => void
}

const CLOSED: BookingStatus[] = ['cancelled', 'refunded', 'completed', 'no_show']

export function refundableAmount(target: Pick<RefundTarget, 'amountPaid' | 'refunded'>) {
  return Math.max(0, target.amountPaid - target.refunded)
}

function toMajor(minor: number) {
  return (minor / 100).toFixed(2)
}

function toMinor(text: string) {
  const value = Number.parseFloat(text.replace(/[^0-9.]/g, ''))
  return Number.isFinite(value) ? Math.round(value * 100) : Number.NaN
}

export function RefundDialog({ open, onOpenChange, targets, currency, onConfirm }: RefundDialogProps) {
  const single = targets.length === 1 ? targets[0] : null
  const refundable = single ? refundableAmount(single) : targets.reduce((sum, t) => sum + refundableAmount(t), 0)
  const seats = targets.reduce((sum, t) => sum + (CLOSED.includes(t.status) ? 0 : t.partySize), 0)
  const canRelease = targets.some((t) => !CLOSED.includes(t.status))

  const [mode, setMode] = React.useState<'full' | 'partial'>('full')
  const [amountText, setAmountText] = React.useState('')
  const [reason, setReason] = React.useState<RefundReason>('guest_request')
  const [note, setNote] = React.useState('')
  const [cancelBooking, setCancelBooking] = React.useState(true)
  const [notifyGuest, setNotifyGuest] = React.useState(true)

  // Start clean for every booking that comes through the door.
  React.useEffect(() => {
    if (!open) return
    setMode('full')
    setAmountText(toMajor(refundable))
    setReason('guest_request')
    setNote('')
    setCancelBooking(canRelease)
    setNotifyGuest(true)
  }, [open, refundable, canRelease])

  const partialMinor = toMinor(amountText)
  const amount = mode === 'full' || !single ? refundable : partialMinor
  const amountError =
    mode === 'partial' && single
      ? Number.isNaN(partialMinor) || partialMinor <= 0
        ? 'Enter an amount above zero.'
        : partialMinor > refundable
          ? `You can return up to ${formatCurrency(refundable, currency)}.`
          : undefined
      : undefined
  const valid = refundable > 0 && amount > 0 && !amountError

  const alreadyRefunded = targets.reduce((sum, t) => sum + t.refunded, 0)
  const feeKept = targets.reduce((sum, t) => sum + (t.fee ?? 0), 0)
  const releaseAllowed = canRelease && (mode === 'full' || !single)

  const confirm = () => {
    if (!valid) return
    onConfirm({
      refunds: single
        ? [{ id: single.id, amount }]
        : targets.map((t) => ({ id: t.id, amount: refundableAmount(t) })).filter((r) => r.amount > 0),
      reason,
      note: note.trim(),
      cancelBooking: releaseAllowed && cancelBooking,
      notifyGuest,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{single ? `Refund ${single.guestName}` : `Refund ${targets.length} reservations`}</DialogTitle>
          <DialogDescription>
            {single
              ? `${single.reference} · ${single.activityName} · ${formatDateShort(single.departureAt)}`
              : 'Each guest is refunded in full to the payment method they used.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-5">
          {refundable <= 0 ? (
            <p className="rounded-xl border border-line bg-surface-sunken px-3.5 py-3 text-sm text-muted">
              Nothing is left to return on {single ? 'this reservation' : 'these reservations'}: every dollar
              collected has already been refunded.
            </p>
          ) : null}

          {single && refundable > 0 ? (
            <>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'full' | 'partial')} gap="sm">
                <RadioGroupCard
                  value="full"
                  label="Full refund"
                  description="Everything collected goes back."
                  trailing={<span className="text-sm font-semibold tabular-nums">{formatCurrency(refundable, currency)}</span>}
                />
                <RadioGroupCard
                  value="partial"
                  label="Partial refund"
                  description="Return part of it; the rest stays with you and the seats stay booked."
                />
              </RadioGroup>

              {mode === 'partial' ? (
                <Field label="Amount to refund" error={amountError} hint={`Up to ${formatCurrency(refundable, currency)}`}>
                  <Input
                    inputMode="decimal"
                    value={amountText}
                    onChange={(event) => setAmountText(event.target.value)}
                    suffix={currency}
                    autoFocus
                  />
                </Field>
              ) : null}
            </>
          ) : null}

          {!single ? (
            <ul className="max-h-48 divide-y divide-line-subtle overflow-y-auto rounded-xl border border-line">
              {targets.map((t) => {
                const amt = refundableAmount(t)
                return (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{t.guestName}</span>
                      <span className="block truncate text-xs text-subtle">
                        <span className="font-mono">{t.reference}</span> · {t.activityName}
                      </span>
                    </span>
                    <span className={cn('shrink-0 font-semibold tabular-nums', amt === 0 ? 'text-faint' : 'text-foreground')}>
                      {amt === 0 ? 'Nothing owed' : formatCurrency(amt, currency)}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="refund-reason" className="text-[0.8125rem] font-medium text-foreground">
                Reason
              </label>
              <Select value={reason} onValueChange={(v) => setReason(v as RefundReason)}>
                <SelectTrigger id="refund-reason" aria-label="Refund reason">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REFUND_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Note to the guest" optional>
              <Textarea
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Shown on the refund receipt."
              />
            </Field>
          </div>

          {/* ---------- the money ---------- */}
          <dl className="divide-y divide-line-subtle rounded-xl bg-surface-sunken px-3.5 text-sm">
            <div className="flex items-center justify-between py-2">
              <dt className="text-muted">Collected</dt>
              <dd className="tabular-nums">{formatCurrency(targets.reduce((s, t) => s + t.amountPaid, 0), currency)}</dd>
            </div>
            {alreadyRefunded > 0 ? (
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted">Already refunded</dt>
                <dd className="tabular-nums">−{formatCurrency(alreadyRefunded, currency)}</dd>
              </div>
            ) : null}
            {feeKept > 0 ? (
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted">Processing fee, not returned</dt>
                <dd className="tabular-nums text-subtle">{formatCurrency(feeKept, currency)}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between py-2.5">
              <dt className="font-semibold text-foreground">Refund now</dt>
              <dd className="font-display text-lg font-semibold tabular-nums text-foreground">
                {valid ? formatCurrency(amount, currency) : '—'}
              </dd>
            </div>
            <div className="flex items-center gap-2 py-2 text-xs text-subtle">
              <Landmark aria-hidden="true" className="size-3.5" />
              Back to {single?.paymentMethodLabel ?? 'the original payment method'} · 5–10 business days
            </div>
          </dl>

          {/* ---------- what else happens ---------- */}
          <div className="space-y-3">
            <label
              className={cn('flex items-start gap-3', !releaseAllowed && 'opacity-50')}
              title={releaseAllowed ? undefined : 'Partial refunds keep the reservation in place.'}
            >
              <Switch
                size="sm"
                checked={releaseAllowed && cancelBooking}
                onCheckedChange={setCancelBooking}
                disabled={!releaseAllowed}
                className="mt-0.5"
              />
              <span className="text-sm">
                <span className="block font-medium text-foreground">Cancel the reservation too</span>
                <span className="block text-xs text-muted">
                  {seats > 0
                    ? `Releases ${seats} ${seats === 1 ? 'seat' : 'seats'} back to the departure.`
                    : 'Nothing to release: the reservation is already closed.'}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <Switch size="sm" checked={notifyGuest} onCheckedChange={setNotifyGuest} className="mt-0.5" />
              <span className="text-sm">
                <span className="block font-medium text-foreground">Email a refund receipt</span>
                <span className="block text-xs text-muted">Includes your note and when the money should land.</span>
              </span>
            </label>
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Not now
          </Button>
          <Button variant="primary" leftIcon={<RotateCcw />} disabled={!valid} onClick={confirm}>
            {valid ? `Refund ${formatCurrency(amount, currency)}` : 'Refund'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
