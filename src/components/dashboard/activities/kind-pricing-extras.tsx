'use client'

import * as React from 'react'

import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { ActivityKind, CurrencyCode, PrivateOption } from '@/types'

import { MoneyInput } from './pricing-tier-editor'

/* ==========================================================================
   Pricing by kind — the title and one line over each kind's prices, private
   booking (shared activities and lessons can be booked by one group for one
   price), and the extra-guest charge of a price for the whole group.
   ========================================================================== */

export const KIND_PRICING: Record<ActivityKind, { title: string; text: (sessions: number) => string }> = {
  trip: { title: 'Prices', text: () => 'Per person. The first paid price is the “from” price.' },
  activity: { title: 'Prices', text: () => 'Per person. The first paid price is the “from” price.' },
  charter: { title: 'Prices', text: () => 'Each one is a price for the whole group.' },
  rental: { title: 'Items and prices', text: () => 'Set on each item.' },
  lesson: { title: 'Prices', text: (sessions) => (sessions > 1 ? `Per person, for the whole ${sessions}-day course.` : 'Per person, per lesson.') },
  pass: { title: 'Prices', text: () => 'Per ticket, for the day.' },
  package: { title: 'Prices', text: () => 'Per person, for every part together.' },
}

/** A private activity priced per person: a price for each guest, the time slot still the group's own. */
export const PRIVATE_PER_PERSON_PRICING = { title: 'Prices', text: 'Per person. The group has the time slot to itself.' }

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

/**
 * A price for the whole group: how many guests it covers (empty: everyone) and
 * what each guest over that pays (empty: nothing). Two labelled fields, for the
 * caller's own grid.
 */
export function ExtraGuestFields({
  currency,
  included,
  extra,
  onChange,
  limit,
  error,
}: {
  currency: CurrencyCode
  /** Guests the price covers. 0: everyone. */
  included: number
  /** Minor units for each guest over `included`. */
  extra: number
  onChange: (next: { included: number; extra: number }) => void
  /** The most guests one booking can have, for the placeholder. 0: not set yet. */
  limit: number
  error?: string
}) {
  // An extra-guest price needs a number to count from.
  const missing = extra > 0 && included <= 0
  return (
    <>
      <label className={label}>
        Covers up to
        <Input
          type="number"
          size="sm"
          min={1}
          placeholder={limit > 0 ? `All ${limit}` : 'All'}
          suffix="guests"
          inputClassName="tabular"
          aria-label="Guests the price covers"
          error={missing && error ? error : undefined}
          value={included > 0 ? included : ''}
          onChange={(event) => onChange({ included: Math.min(999, whole(event.target.value)), extra })}
        />
        {missing ? <span className={error ? 'font-medium text-danger' : 'font-medium text-warning'}>{error ?? 'Set how many'}</span> : null}
      </label>
      <label className={label}>
        Each extra guest
        <MoneyInput value={extra} onValueChange={(next) => onChange({ included, extra: next })} currency={currency} size="sm" allowEmpty placeholder="Free" ariaLabel="Each extra guest" />
      </label>
    </>
  )
}
