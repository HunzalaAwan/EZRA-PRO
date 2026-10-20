'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { formatCurrency } from '@/lib/utils'
import type { ActivityKind, CurrencyCode, PrivateOption } from '@/types'

/* ==========================================================================
   Pricing by kind — what each kind of product needs beyond its price
   list, and nothing else. Trips, activities and lessons can be booked
   privately for one group price. Charters price per group and can charge
   for guests over a number. Prices that change by date, day or group size
   are set once for the whole business in Pricing rules, so they are linked
   here, not repeated.
   ========================================================================== */

export const KIND_PRICING: Record<ActivityKind, { title: string; text: (sessions: number) => string }> = {
  trip: { title: 'Ticket prices', text: () => 'One price per person, by type: adults, children, seniors, a family ticket. The first sets the “from” price.' },
  activity: { title: 'Prices per rider', text: () => 'Per rider, or per ride for two or three together. A tandem ticket takes two spots in the time slot.' },
  charter: { title: 'Charter options', text: () => 'One price for the whole group, per option: a half day, a full day, a sunset cruise. How long each one lasts is set on Basics.' },
  rental: { title: 'Items and prices', text: () => 'Set on each item.' },
  lesson: {
    title: 'Prices per student',
    text: (sessions) => (sessions > 1 ? `One price for the whole ${sessions}-day course. Students book once.` : 'One price per student, per lesson.'),
  },
  pass: { title: 'Ticket types', text: () => 'Entry for the day, per ticket. A family ticket can cover four spots at one price.' },
  package: { title: 'Package prices', text: () => 'One price per person for every part together. Show the saving against booking them apart.' },
}

export function KindPricingExtras({
  kind,
  currency,
  privateOption,
  onPrivateOption,
  maxGuests,
  charterIncluded,
  charterExtra,
  onCharter,
  leadPrice,
}: {
  kind: ActivityKind
  currency: CurrencyCode
  privateOption: PrivateOption
  onPrivateOption: (next: PrivateOption) => void
  /** Seats per time, or the most a charter carries. */
  maxGuests: number
  charterIncluded: number
  charterExtra: number
  onCharter: (included: number, extra: number) => void
  leadPrice: number
}) {
  const symbol = formatCurrency(0, currency).replace(/[\d.,\s]/g, '') || '$'
  const money = (value: string) => Math.max(0, Math.round(Number(value) * 100) || 0)
  const setPrivate = (patch: Partial<PrivateOption>) => onPrivateOption({ ...privateOption, ...patch })
  const canPrivate = kind === 'trip' || kind === 'activity' || kind === 'lesson'

  return (
    <div className="flex flex-col gap-3">
      {canPrivate ? (
        <section className="flex flex-col gap-3 rounded-xl border border-line px-3.5 py-3">
          <label className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">{kind === 'lesson' ? 'Private lessons' : 'Private bookings'}</span>
              <span className="block text-xs text-subtle">
                {kind === 'lesson'
                  ? 'A student or a family can have the instructor to themselves, at one price.'
                  : 'A group can have a whole time to themselves, at one price. Offered only on times nobody else has booked.'}
              </span>
            </span>
            <Switch
              checked={privateOption.enabled}
              onCheckedChange={(enabled) => setPrivate({ enabled, price: privateOption.price || leadPrice * Math.max(2, Math.min(4, privateOption.includedGuests)) })}
              aria-label="Private bookings"
            />
          </label>
          {privateOption.enabled ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Price for the group" labelSize="sm">
                {(control) => <Input {...control} type="number" min={0} leftIcon={<span className="text-sm font-medium">{symbol}</span>} value={privateOption.price / 100 || ''} onChange={(event) => setPrivate({ price: money(event.target.value) })} />}
              </Field>
              <Field label="Covers up to" labelSize="sm">
                {(control) => <Input {...control} type="number" min={1} max={Math.max(1, maxGuests)} suffix="guests" value={privateOption.includedGuests} onChange={(event) => setPrivate({ includedGuests: Math.min(Math.max(1, maxGuests || 99), Math.max(1, Math.floor(Number(event.target.value)) || 1)) })} />}
              </Field>
              <Field label="Each guest over" labelSize="sm" optional description="Empty: the group cannot be bigger.">
                {(control) => <Input {...control} type="number" min={0} placeholder="Not allowed" leftIcon={<span className="text-sm font-medium">{symbol}</span>} value={privateOption.extraGuest ? privateOption.extraGuest / 100 : ''} onChange={(event) => setPrivate({ extraGuest: money(event.target.value) })} />}
              </Field>
            </div>
          ) : null}
        </section>
      ) : null}

      {kind === 'charter' ? (
        <section className="flex flex-col gap-3 rounded-xl border border-line px-3.5 py-3">
          <div>
            <span className="block text-sm font-medium">Bigger groups</span>
            <span className="block text-xs text-subtle">The price covers a number of guests; each one over pays a set amount, up to the {maxGuests} the {kind} carries.</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="The price covers" labelSize="sm" optional description="Empty: everyone is included.">
              {(control) => <Input {...control} type="number" min={0} max={maxGuests} placeholder={`All ${maxGuests}`} suffix="guests" value={charterIncluded || ''} onChange={(event) => onCharter(Math.min(maxGuests, Math.max(0, Math.floor(Number(event.target.value)) || 0)), charterExtra)} />}
            </Field>
            <Field label="Each guest over" labelSize="sm" optional>
              {(control) => <Input {...control} type="number" min={0} placeholder="Free" leftIcon={<span className="text-sm font-medium">{symbol}</span>} value={charterExtra ? charterExtra / 100 : ''} onChange={(event) => onCharter(charterIncluded, money(event.target.value))} />}
            </Field>
          </div>
        </section>
      ) : null}

      {kind !== 'rental' ? (
        <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
          Seasons, weekends, early-bird, last-minute and group discounts are set once for every activity in
          <Link href="/dashboard/pricing" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
            Pricing rules
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </Link>
        </p>
      ) : null}
    </div>
  )
}
