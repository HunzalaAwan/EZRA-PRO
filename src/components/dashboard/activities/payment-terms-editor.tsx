'use client'

import * as React from 'react'
import { CreditCard, PiggyBank, Wallet } from 'lucide-react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { splitPayment } from '@/lib/booking-policy'
import { cn, formatCurrency } from '@/lib/utils'
import type { CurrencyCode, PaymentTerms } from '@/types'

/* ==========================================================================
   How guests pay — on the Pricing step, next to the prices it applies to.
   In full now, a deposit now and the rest charged before the day, or
   nothing now and pay on arrival with the card kept on file.
   ========================================================================== */

const OPTIONS: { value: PaymentTerms['collect']; title: string; text: string; icon: typeof CreditCard }[] = [
  { value: 'full', title: 'Pay in full', text: 'The whole price at checkout.', icon: CreditCard },
  { value: 'deposit', title: 'Deposit now', text: 'Part now, the rest charged before the day.', icon: PiggyBank },
  { value: 'later', title: 'Pay on the day', text: 'Nothing now. The card is kept to hold the booking.', icon: Wallet },
]

export function PaymentTermsEditor({
  value,
  onChange,
  currency,
  examplePrice,
  wholeGroup = false,
  businessWide = false,
}: {
  value: PaymentTerms
  onChange: (next: PaymentTerms) => void
  currency: CurrencyCode
  /** The lead price, for the worked example. */
  examplePrice: number
  /** Charters and rentals: a booking is one group, so "per guest" reads oddly. */
  wholeGroup?: boolean
  /** Settings → Booking flow: the default for every activity, not one activity's own. */
  businessWide?: boolean
}) {
  const set = (patch: Partial<PaymentTerms>) => onChange({ ...value, ...patch })
  const symbol = formatCurrency(0, currency).replace(/[\d.,\s]/g, '') || '$'
  const party = wholeGroup ? 1 : 2
  const total = examplePrice * party
  const split = splitPayment(value, total, party)

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line p-4">
      <div>
        <h3 className="text-sm font-semibold">How guests pay</h3>
        <p className="mt-0.5 text-xs text-subtle">{businessWide ? 'Refunds follow the cancellation policy below.' : 'For this activity only. Refunds follow the cancellation policy on the Booking step.'}</p>
      </div>

      <div role="radiogroup" aria-label="How guests pay" className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map((option) => {
          const on = value.collect === option.value
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set({ collect: option.value })}
              className={cn('flex flex-col gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors', on ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong')}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <option.icon className={cn('size-4', on ? 'text-primary' : 'text-faint')} aria-hidden="true" />
                {option.title}
              </span>
              <span className="text-xs text-subtle">{option.text}</span>
            </button>
          )
        })}
      </div>

      {value.collect === 'deposit' ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Deposit">
            {({ id }) => (
              <Select value={value.depositType} onValueChange={(depositType) => set({ depositType: depositType as PaymentTerms['depositType'], depositValue: depositType === 'percent' ? 25 : 5000 })}>
                <SelectTrigger id={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">A share of the total</SelectItem>
                  {wholeGroup ? null : <SelectItem value="per_guest">A set amount per guest</SelectItem>}
                  <SelectItem value="per_booking">A set amount per booking</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label={value.depositType === 'percent' ? 'Share' : 'Amount'}>
            {(control) =>
              value.depositType === 'percent' ? (
                <Input {...control} type="number" min={5} max={95} step={5} suffix="%" value={value.depositValue} onChange={(event) => set({ depositValue: Math.min(95, Math.max(5, Math.round(Number(event.target.value)) || 25)) })} />
              ) : (
                <Input {...control} type="number" min={1} leftIcon={<span className="text-sm font-medium">{symbol}</span>} value={value.depositValue / 100 || ''} onChange={(event) => set({ depositValue: Math.max(0, Math.round(Number(event.target.value) * 100) || 0) })} />
              )
            }
          </Field>
          <Field label="Charge the rest" description="To the card saved at checkout.">
            {({ id }) => (
              <Select value={String(value.balanceDueDays)} onValueChange={(days) => set({ balanceDueDays: Number(days) })}>
                <SelectTrigger id={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">On the day</SelectItem>
                  {[1, 2, 3, 7, 14, 30].map((days) => (
                    <SelectItem key={days} value={String(days)}>
                      {days} {days === 1 ? 'day' : 'days'} before
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
        </div>
      ) : null}

      {value.collect !== 'full' ? (
        <label className="flex items-start justify-between gap-3">
          <span>
            <span className="block text-sm font-medium">Guests can pay in full instead</span>
            <span className="block text-xs text-subtle">A choice at checkout, for guests who would rather settle it now.</span>
          </span>
          <Switch checked={value.allowPayInFull} onCheckedChange={(allowPayInFull) => set({ allowPayInFull })} aria-label="Guests can pay in full instead" />
        </label>
      ) : null}

      {examplePrice > 0 ? (
        <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted">
          Example: a {formatCurrency(total, currency)} booking{wholeGroup ? '' : ' for two'} pays{' '}
          <strong className="font-semibold text-foreground">{formatCurrency(split.now, currency)}</strong> at checkout
          {split.later > 0 ? (
            <>
              {' '}and <strong className="font-semibold text-foreground">{formatCurrency(split.later, currency)}</strong>{' '}
              {value.collect === 'later' || value.balanceDueDays === 0 ? 'on the day' : `${value.balanceDueDays} ${value.balanceDueDays === 1 ? 'day' : 'days'} before`}
            </>
          ) : null}
          .
        </p>
      ) : null}
    </section>
  )
}
