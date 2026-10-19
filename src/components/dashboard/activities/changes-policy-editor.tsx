'use client'

import * as React from 'react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { CANCEL_PRESETS, changesSummary, policySummary, type CancelPreset } from '@/lib/booking-policy'
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

export function ChangesPolicyEditor({
  cancellation,
  onCancellation,
  changes,
  onChanges,
  payment,
  currency,
  wholeGroup = false,
}: {
  cancellation: DraftCancellation
  onCancellation: (next: DraftCancellation) => void
  changes: ChangeRules
  onChanges: (next: ChangeRules) => void
  payment: PaymentTerms
  currency: CurrencyCode
  /** Charters: there is one group, so no "add people". */
  wholeGroup?: boolean
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
        <p className="text-[0.8125rem] font-medium">Cancellation policy</p>
        <div role="radiogroup" aria-label="Cancellation policy" className="mt-2 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {CANCEL_PRESETS.map((preset) => {
            const on = cancellation.preset === preset.value
            return (
              <button
                key={preset.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() =>
                  setCancel(
                    preset.value === 'custom'
                      ? { preset: 'custom' }
                      : { preset: preset.value, freeCancellationHours: preset.freeHours, lateRefundPercent: preset.lateRefund },
                  )
                }
                className={cn('flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors', on ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong')}
              >
                <span className="text-sm font-medium text-foreground">{preset.label}</span>
                <span className="text-xs text-subtle">{preset.text}</span>
              </button>
            )
          })}
        </div>
        {cancellation.preset === 'custom' ? (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <Field label="Full refund until" description="0: no free cancellation.">
              {(control) => <Input {...control} type="number" min={0} suffix="hours before" value={cancellation.freeCancellationHours} onChange={(event) => setCancel({ freeCancellationHours: Math.max(0, Math.floor(Number(event.target.value)) || 0) })} />}
            </Field>
            <Field label="After that, refund">
              {(control) => <Input {...control} type="number" min={0} max={100} step={5} suffix="%" value={cancellation.lateRefundPercent} onChange={(event) => setCancel({ lateRefundPercent: Math.min(100, Math.max(0, Math.round(Number(event.target.value)) || 0)) })} />}
            </Field>
          </div>
        ) : null}
        {payment.collect === 'deposit' ? (
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
        <Toggle title="Move to another time" text="They pick a new time with room for the group; the old seats go back on sale." checked={changes.reschedule} onChange={(reschedule) => setChanges({ reschedule })}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Until" labelSize="sm">
              {(control) => <Input {...control} type="number" min={0} suffix="hours before" value={changes.rescheduleHours} onChange={(event) => setChanges({ rescheduleHours: Math.max(0, Math.floor(Number(event.target.value)) || 0) })} />}
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
