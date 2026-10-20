'use client'

import * as React from 'react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { changesSummary, policySummary, type CancelPreset } from '@/lib/booking-policy'
import { cn, formatCurrency } from '@/lib/utils'
import type { ChangeRules, CurrencyCode, PaymentTerms } from '@/types'

/* ==========================================================================
   Changes and cancellations — on the Booking step. One standard policy to
   pick (or your own numbers), then what guests can do themselves from
   their booking page: move to another time, add people, cancel.
   ========================================================================== */

export interface DraftCancellation {
  preset: CancelPreset
  freeCancellationHours: number
  lateRefundPercent: number
  keepDeposit: boolean
  /** Follows the business default in Settings → Booking flow. */
  useDefault?: boolean
}

function Toggle({ title, text, checked, onChange, children }: { title: string; text: string; checked: boolean; onChange: (value: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-subtle">{text}</span>
        </span>
        <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
      </label>
      {checked && children ? children : null}
    </div>
  )
}

/** A length of time before the start, typed in hours or days, kept in hours. */
/** A length before the start, typed in hours or days and stored in hours. */
export function BeforeInput({ id, hours, onHours, className }: { id?: string; hours: number; onHours: (hours: number) => void; className?: string }) {
  const [unit, setUnit] = React.useState<'hours' | 'days'>(() => (hours >= 24 && hours % 24 === 0 ? 'days' : 'hours'))
  const shown = unit === 'days' ? hours / 24 : hours
  return (
    <div className={cn('flex gap-2', className)}>
      <Input
        id={id}
        type="number"
        min={0}
        step={unit === 'days' ? 0.5 : 1}
        className="min-w-0 flex-1"
        value={Number.isInteger(shown) ? shown : Number(shown.toFixed(1))}
        onChange={(event) => {
          const value = Math.max(0, Number(event.target.value) || 0)
          onHours(Math.round(unit === 'days' ? value * 24 : value))
        }}
      />
      <select
        aria-label="Hours or days"
        value={unit}
        onChange={(event) => setUnit(event.target.value as 'hours' | 'days')}
        className="h-10 shrink-0 rounded-lg border border-line bg-surface px-3 text-sm text-foreground"
      >
        <option value="hours">hours</option>
        <option value="days">days</option>
      </select>
    </div>
  )
}

export function ChangesPolicyEditor({
  cancellation,
  onCancellation,
  changes,
  onChanges,
  payment,
  currency,
  wholeGroup = false,
  cancellationDefault,
}: {
  cancellation: DraftCancellation
  onCancellation: (next: DraftCancellation) => void
  changes: ChangeRules
  onChanges: (next: ChangeRules) => void
  payment: PaymentTerms
  currency: CurrencyCode
  /** Charters: there is one group, so no "add people". */
  wholeGroup?: boolean
  /** Offer the business default from Settings → Booking flow instead of numbers of its own. */
  cancellationDefault?: { on: boolean; onChange: (on: boolean) => void }
}) {
  const setCancel = (patch: Partial<DraftCancellation>) => onCancellation({ ...cancellation, ...patch })
  const setChanges = (patch: Partial<ChangeRules>) => onChanges({ ...changes, ...patch })
  const symbol = formatCurrency(0, currency).replace(/[\d.,\s]/g, '') || '$'
  const money = (minor: number) => formatCurrency(minor, currency)

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-line p-4">
      <div>
        <h3 className="text-sm font-semibold">Changes and cancellations</h3>
        <p className="mt-0.5 text-xs text-subtle">Shown on the activity page, at checkout and in every confirmation. Bookings already made keep the policy they were booked on.</p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.8125rem] font-medium">Cancellation policy</p>
          {cancellationDefault ? (
            <label className="flex items-center gap-2 text-xs text-muted">
              Use business default
              <Switch checked={cancellationDefault.on} onCheckedChange={cancellationDefault.onChange} aria-label="Use the business default cancellation policy" />
            </label>
          ) : null}
        </div>
        {cancellationDefault?.on ? (
          <p className="mt-2 rounded-lg bg-surface-sunken px-3 py-2.5 text-xs text-muted">
            {policySummary(cancellation, payment)}{' '}
            <a href="/dashboard/settings/booking" className="font-medium text-primary hover:underline">
              Change the default
            </a>
          </p>
        ) : (
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <Field label="Full refund until" description="Before the start. 0: no free cancellation.">
            {({ id }) => <BeforeInput id={id} hours={cancellation.freeCancellationHours} onHours={(freeCancellationHours) => setCancel({ freeCancellationHours, preset: 'custom' })} />}
          </Field>
          <Field label="After that, refund" description="0: nothing back once the free window has passed.">
            {(control) => <Input {...control} type="number" min={0} max={100} step={5} suffix="%" value={cancellation.lateRefundPercent} onChange={(event) => setCancel({ lateRefundPercent: Math.min(100, Math.max(0, Math.round(Number(event.target.value)) || 0)), preset: 'custom' })} />}
          </Field>
        </div>
        )}
        {payment.collect === 'deposit' && !cancellationDefault?.on ? (
          <label className="mt-3 flex items-start justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">Keep the deposit</span>
              <span className="block text-xs text-subtle">The deposit is not refunded, even when guests cancel in time.</span>
            </span>
            <Switch checked={cancellation.keepDeposit} onCheckedChange={(keepDeposit) => setCancel({ keepDeposit })} aria-label="Keep the deposit" />
          </label>
        ) : null}
      </div>

      <div className="flex flex-col divide-y divide-line-subtle border-t border-line-subtle pt-4">
        <p className="pb-3 text-[0.8125rem] font-medium">What guests can do from their booking page</p>
        <Toggle title="Move to another time slot" text="They pick a new time slot with room for the group; the old spots go back on sale." checked={changes.reschedule} onChange={(reschedule) => setChanges({ reschedule })}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Until" labelSize="sm" description="Before the start.">
              {({ id }) => <BeforeInput id={id} hours={changes.rescheduleHours} onHours={(rescheduleHours) => setChanges({ rescheduleHours })} />}
            </Field>
            <Field label="How many times" labelSize="sm" description="0: no limit.">
              {(control) => <Input {...control} type="number" min={0} value={changes.maxReschedules} onChange={(event) => setChanges({ maxReschedules: Math.max(0, Math.floor(Number(event.target.value)) || 0) })} />}
            </Field>
            <Field label="Fee per move" labelSize="sm" optional>
              {(control) => <Input {...control} type="number" min={0} placeholder="Free" leftIcon={<span className="text-sm font-medium">{symbol}</span>} value={changes.rescheduleFee ? changes.rescheduleFee / 100 : ''} onChange={(event) => setChanges({ rescheduleFee: Math.max(0, Math.round(Number(event.target.value) * 100) || 0) })} />}
            </Field>
          </div>
        </Toggle>
        {wholeGroup ? null : (
          <Toggle title="Add people" text="While there is room, charged at today's price." checked={changes.addGuests} onChange={(addGuests) => setChanges({ addGuests })} />
        )}
        <Toggle title="Cancel online" text="Refunded by the policy above. Off: they message or call you to cancel." checked={changes.cancelOnline} onChange={(cancelOnline) => setChanges({ cancelOnline })} />
      </div>

      <div className="rounded-lg bg-surface-sunken px-3 py-2.5 text-xs text-muted">
        <p className="font-semibold text-foreground">Guests read</p>
        <p className="mt-0.5">{policySummary(cancellation, payment)}</p>
        <p className="mt-0.5">{changesSummary(changes, money)}</p>
      </div>
    </section>
  )
}
