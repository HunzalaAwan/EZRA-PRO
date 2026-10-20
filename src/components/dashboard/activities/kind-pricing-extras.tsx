'use client'

import * as React from 'react'

import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { ActivityKind, CurrencyCode, PrivateOption } from '@/types'

import { MoneyInput } from './pricing-tier-editor'

/* ==========================================================================
   Pricing by kind — what each kind of product needs beyond its price
   list. Trips, activities and lessons can be booked privately for one
   group price. Charters price per group and can charge for guests over a
   number. Date, day and demand changes live in the Pricing step's own
   Price changes list.
   ========================================================================== */

export const KIND_PRICING: Record<ActivityKind, { title: string; text: (sessions: number) => string }> = {
  trip: { title: 'Ticket prices', text: () => 'The first paid price is the “from” price.' },
  activity: { title: 'Ticket prices', text: () => 'The first paid price is the “from” price.' },
  charter: { title: 'Charter options', text: () => 'One price for the whole group, per option.' },
  rental: { title: 'Items and prices', text: () => 'Set on each item.' },
  lesson: {
    title: 'Prices per student',
    text: (sessions) => (sessions > 1 ? `One price for the whole ${sessions}-day course.` : 'One price per student, per lesson.'),
  },
  pass: { title: 'Ticket types', text: () => 'Entry for the day, per ticket.' },
  package: { title: 'Package prices', text: () => 'One price per person for every part together.' },
}

/** Kinds that can be booked privately for one group price. */
export const canBookPrivately = (kind: ActivityKind) => kind === 'trip' || kind === 'activity' || kind === 'lesson'

const whole = (value: string) => Math.max(0, Math.floor(Number(value)) || 0)
const label = 'flex flex-col gap-1 text-xs text-subtle'

/** Private booking: one group has the whole time to themselves, at one price. */
export function PrivateBookingFields({
  kind,
  currency,
  value,
  onChange,
  maxGuests,
  leadPrice,
}: {
  kind: ActivityKind
  currency: CurrencyCode
  value: PrivateOption
  onChange: (next: PrivateOption) => void
  /** Spots per time slot. */
  maxGuests: number
  leadPrice: number
}) {
  const set = (patch: Partial<PrivateOption>) => onChange({ ...value, ...patch })
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line px-3.5 py-3">
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-medium">{kind === 'lesson' ? 'Private lessons' : 'Private booking'}</span>
          <span className="block text-xs text-subtle">{kind === 'lesson' ? 'The instructor to themselves, at one price.' : 'A whole time slot for one group, at one price.'}</span>
        </span>
        <Switch
          checked={value.enabled}
          onCheckedChange={(enabled) => set({ enabled, price: value.price || leadPrice * Math.max(2, Math.min(4, value.includedGuests)) })}
          aria-label={kind === 'lesson' ? 'Private lessons' : 'Private booking'}
        />
      </label>
      {value.enabled ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <label className={label}>
            Price for the group
            <MoneyInput value={value.price} onValueChange={(price) => set({ price })} currency={currency} size="sm" ariaLabel="Private price for the group" />
          </label>
          <label className={label}>
            Covers up to
            <Input type="number" size="sm" min={1} max={maxGuests > 0 ? maxGuests : undefined} suffix="guests" inputClassName="tabular" value={value.includedGuests || ''} onChange={(event) => set({ includedGuests: Math.min(Math.max(1, maxGuests || 99), Math.max(1, whole(event.target.value))) })} />
          </label>
          <label className={label}>
            Each guest over
            <MoneyInput value={value.extraGuest} onValueChange={(extraGuest) => set({ extraGuest })} currency={currency} size="sm" allowEmpty placeholder="Not allowed" ariaLabel="Private price for each guest over" />
          </label>
        </div>
      ) : null}
    </section>
  )
}

/** Charters: the price covers a number of guests; each one over pays a set amount. */
export function CharterGroupFields({
  currency,
  maxGuests,
  included,
  extra,
  onChange,
}: {
  currency: CurrencyCode
  /** The most guests the charter carries. */
  maxGuests: number
  included: number
  extra: number
  onChange: (included: number, extra: number) => void
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line px-3.5 py-3">
      <div>
        <span className="block text-sm font-medium">Bigger groups</span>
        <span className="block text-xs text-subtle">Up to {maxGuests} guests per charter.</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <label className={label}>
          The price covers
          <Input type="number" size="sm" min={0} max={maxGuests} placeholder={`All ${maxGuests}`} suffix="guests" inputClassName="tabular" value={included || ''} onChange={(event) => onChange(Math.min(maxGuests, whole(event.target.value)), extra)} />
        </label>
        <label className={label}>
          Each guest over
          <MoneyInput value={extra} onValueChange={(next) => onChange(included, next)} currency={currency} size="sm" allowEmpty placeholder="Free" ariaLabel="Each guest over" />
        </label>
      </div>
    </section>
  )
}

/** Both pieces as one block; kept for older callers. The Pricing step places them on their own. */
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
  return (
    <div className="flex flex-col gap-3">
      {canBookPrivately(kind) ? (
        <PrivateBookingFields kind={kind} currency={currency} value={privateOption} onChange={onPrivateOption} maxGuests={maxGuests} leadPrice={leadPrice} />
      ) : null}
      {kind === 'charter' ? <CharterGroupFields currency={currency} maxGuests={maxGuests} included={charterIncluded} extra={charterExtra} onChange={onCharter} /> : null}
    </div>
  )
}
