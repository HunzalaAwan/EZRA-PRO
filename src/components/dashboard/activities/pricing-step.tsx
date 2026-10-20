'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, ChevronDown, CircleAlert, Clock, KeyRound, Plus, Trash2, User, Users, type LucideIcon } from 'lucide-react'

import type { ActivityKind, ActivitySchedule, ChargeBy, CurrencyCode, GroupDiscount, GroupPrice, PaymentTerms, PriceChange, PriceChangeKind, PriceTier, PrivateOption, ScheduleChange } from '@/types'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { usePricing } from '@/hooks/use-pricing'
import type { PricingRule } from '@/lib/pricing'
import { DEFAULT_PAYMENT } from '@/lib/booking-policy'
import { WEEKDAY_KEYS, addMonthsKey, closingGapOf, expandSchedules, scheduleContextOf, shiftDayKey, sortTimes, timesForWeekday, type ScheduleContext, type ScheduleSource } from '@/lib/activity-schedule'
import { defaultChargeBy, effectLabel, fromPrice, shortDay, type PricedActivity } from '@/lib/price-engine'
import { cn, currencySymbol, formatCurrency, pluralize } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

import { AddonEditor, type DraftAddOn } from './addon-editor'
import { DINING_ADDON_PRESETS, DINING_TIER_PRESETS, DiningBookingFields, type DiningDraft } from './dining-fields'
import { RentalChargingFields, RentalRatesEditor, draftItemOf, normalizeKindSettings, type DraftKindSettings } from './kind-fields'
import { CharterGroupFields, KIND_PRICING, PrivateBookingFields, canBookPrivately } from './kind-pricing-extras'
import { PaymentTermsEditor } from './payment-terms-editor'
import { PriceChangesEditor, isCompleteChange } from './price-changes-editor'
import { PriceCheck } from './price-check'
import { GuestPricePreview, KIND_TIER_PRESETS, MoneyInput, PricingTierEditor, blankTier, leadTierId, tierOfDraft, type DraftTier } from './pricing-tier-editor'
import type { PickMode } from './schedule-draft'
import type { DraftSchedule } from './schedule-editor'

/* ==========================================================================
   THE PRICING STEP — top to bottom: how it charges, the prices, group
   discounts, a minimum charge and private booking, the activity's own
   price changes, the price rules that also apply, a price check on any
   day (and a year of prices), then the cap, tips, extras and payment.
   ========================================================================== */

/** The parts of the wizard draft this step reads and writes. */
export interface PricingDraft {
  kind: ActivityKind
  tiers: DraftTier[]
  addOns: DraftAddOn[]
  kindSettings: DraftKindSettings
  /** Spots per time slot. */
  maxCapacity: number
  privateOption: PrivateOption
  charterIncluded: number
  charterExtra: number
  priceCap: number
  tips: boolean
  payment: PaymentTerms
  dining: DiningDraft
  /** null or absent: the kind's own way. */
  chargeBy?: ChargeBy | null
  groupPrice?: GroupPrice
  groupDiscounts?: GroupDiscount[]
  minimumCharge?: number
  priceChanges?: PriceChange[]
  /* The Schedule step's fields, when the draft has them: each day's own start times for the price check. */
  scheduleMode?: PickMode
  schedules?: ActivitySchedule[]
  scheduleChanges?: ScheduleChange[]
  runsOnClosures?: boolean
  /** Read for the locations it runs from. */
  schedule?: DraftSchedule
  /** How long it runs: opening hours leave this long before closing for the last start time. */
  durationMinutes?: number
}

/* ---------- draft ↔ activity ---------- */

/** A new draft's pricing: the kind's own way, no ladder, no minimum, no changes. */
export function defaultPricingDraft(): { chargeBy: ChargeBy | null; groupPrice: GroupPrice; groupDiscounts: GroupDiscount[]; minimumCharge: number; priceChanges: PriceChange[] } {
  return { chargeBy: null, groupPrice: { price: 0, includedGuests: 6, extraGuest: 0, maxGuests: 0 }, groupDiscounts: [], minimumCharge: 0, priceChanges: [] }
}

/** The pricing fields of an activity, as the draft holds them. */
export function pricingDraftOf(activity: { chargeBy?: ChargeBy; groupPrice?: GroupPrice; groupDiscounts?: GroupDiscount[]; minimumCharge?: number; priceChanges?: PriceChange[]; maxCapacity?: number }) {
  const blank = defaultPricingDraft()
  return {
    chargeBy: activity.chargeBy ?? null,
    groupPrice: activity.groupPrice ? { ...activity.groupPrice } : { ...blank.groupPrice, includedGuests: Math.min(6, activity.maxCapacity || 6) },
    groupDiscounts: (activity.groupDiscounts ?? []).map((rung) => ({ ...rung })),
    minimumCharge: activity.minimumCharge ?? 0,
    priceChanges: (activity.priceChanges ?? []).map((change) => ({ ...change, effect: { ...change.effect } })),
  }
}

/** The ways each kind can charge. Rentals choose by the hour, by length or by the day instead. */
export function chargeOptions(kind: ActivityKind): ChargeBy[] {
  switch (kind) {
    case 'charter':
      return ['group']
    case 'rental':
      return []
    case 'package':
    case 'pass':
      return ['person']
    default:
      return ['person', 'group']
  }
}

/**
 * Every start time the draft's schedule gives, for time-of-day changes and the
 * price check: its seasons once it has them, else the older per-location
 * times, plus any extra times added on given days.
 */
export function draftStartTimes(draft: {
  kind?: ActivityKind
  durationMinutes?: number
  schedules?: ActivitySchedule[]
  scheduleMode?: string
  scheduleChanges?: { action: string; times?: string[] }[]
  schedule?: { mode?: string; startTimes?: string[]; dates?: { time: string }[]; locations?: { schedule?: { startTimes?: string[] } }[] }
}): string[] {
  const out: string[] = []
  const gap = closingGapOf(draft)
  if (Array.isArray(draft.schedules)) {
    if (draft.scheduleMode !== 'dates') for (const season of draft.schedules) for (const key of WEEKDAY_KEYS) out.push(...timesForWeekday(season, key, gap))
  } else if (draft.schedule && draft.schedule.mode !== 'hours') {
    out.push(...(draft.schedule.startTimes ?? []), ...(draft.schedule.dates ?? []).map((entry) => entry.time))
    for (const site of draft.schedule.locations ?? []) out.push(...(site.schedule?.startTimes ?? []))
  }
  for (const change of draft.scheduleChanges ?? []) if (change.action === 'add' || change.action === 'times') out.push(...(change.times ?? []))
  return sortTimes(out)
}

/**
 * Each day's own start times from the draft's seasons and changes, with the
 * business's closed days taken out, for the year of prices from the month of
 * `todayKey` (a day past it is worked out when asked). Undefined when the
 * draft has no seasons to read.
 */
export function draftTimesOn(
  draft: Pick<PricingDraft, 'kind' | 'maxCapacity' | 'scheduleMode' | 'schedules' | 'scheduleChanges' | 'runsOnClosures' | 'schedule' | 'durationMinutes'>,
  todayKey: string,
  ctx: Pick<ScheduleContext, 'closures' | 'holidays'> = {},
): ((dateKey: string) => string[]) | undefined {
  if (!Array.isArray(draft.schedules)) return undefined
  const source: ScheduleSource = {
    id: 'draft',
    locations: (draft.schedule?.locations ?? []).map((site) => ({ locationId: site.locationId, times: [] })),
    maxCapacity: Math.max(1, draft.maxCapacity || 1),
    kind: draft.kind ?? 'trip',
    durationMinutes: draft.durationMinutes,
    schedules: draft.scheduleMode === 'dates' ? [] : draft.schedules,
    scheduleChanges: draft.scheduleChanges ?? [],
    runsOnClosures: Boolean(draft.runsOnClosures),
  }
  const byDay = new Map<string, string[]>()
  const collect = (fromKey: string, toKey: string) => {
    for (const slot of expandSchedules(source, fromKey, toKey, ctx)) {
      const list = byDay.get(slot.dateKey)
      if (!list) byDay.set(slot.dateKey, [slot.time])
      else if (!list.includes(slot.time)) list.push(slot.time)
    }
  }
  const fromKey = `${todayKey.slice(0, 7)}-01`
  const toKey = shiftDayKey(addMonthsKey(fromKey, 12), -1)
  collect(fromKey, toKey)
  return (dateKey) => {
    if (dateKey < fromKey || dateKey > toKey) {
      if (!byDay.has(dateKey)) {
        collect(dateKey, dateKey)
        if (!byDay.has(dateKey)) byDay.set(dateKey, [])
      }
    }
    return sortTimes(byDay.get(dateKey) ?? [])
  }
}

/**
 * Price changes kept in step with the prices they name: a removed price drops
 * out of "Only for", and a change left naming none is switched off rather
 * than widened to every price. `null` keeps every change as it is: per group
 * the engine leaves a change for some prices off the group price, and the
 * prices it names are kept for when the activity goes back to per person.
 * The same list back when nothing moved.
 */
export function retargetChanges(changes: PriceChange[] | undefined, tierIds: string[] | null): PriceChange[] {
  const list = changes ?? []
  if (tierIds === null) return list
  const next = list.map((change) => {
    const named = change.tierIds ?? []
    if (named.length === 0) return change
    const kept = named.filter((id) => tierIds.includes(id))
    if (kept.length === named.length) return change
    return kept.length > 0 ? { ...change, tierIds: kept } : { ...change, tierIds: undefined, active: false }
  })
  return next.some((change, index) => change !== list[index]) ? next : list
}

/** Is the draft priced per group (one price for the group, guests counted by type)? */
const isGroupPriced = (draft: Pick<PricingDraft, 'kind' | 'chargeBy' | 'kindSettings'>, dining: boolean) =>
  !dining && (draft.kind ?? 'trip') !== 'charter' && effectiveChargeBy(draft) === 'group'

/**
 * The price changes the engine and the save use: in step with the prices, and
 * none where the step hides them. Per group the rows are the guest types, so a
 * change for some of them keeps its targeting and leaves the group price alone.
 */
function changesOfDraft(draft: PricingDraft, dining: boolean): PriceChange[] {
  if (dining || (draft.kind ?? 'trip') === 'package') return []
  return retargetChanges(draft.priceChanges, draft.tiers.map((tier) => tier.id))
}

/** A change that names some prices: per group it moves nothing. */
const namesTiers = (change: PriceChange) => (change.tierIds ?? []).length > 0

/** What the Pricing step must have before moving on. Keys match the fields that show them. */
export function pricingErrors(draft: PricingDraft, dining = false): Record<string, string> {
  const errors: Record<string, string> = {}
  if (isGroupPriced(draft, dining) && (draft.groupPrice?.price ?? 0) <= 0) errors['groupPrice.price'] = 'Set a price for the group'
  const minimum = !dining && (draft.kind ?? 'trip') !== 'package' ? (draft.minimumCharge ?? 0) : 0
  if (minimum > 0 && (draft.priceCap ?? 0) > 0 && minimum > draft.priceCap) errors.minimumCharge = 'The minimum charge is more than the price cap'
  // Ages the wrong way round would save as one age ("12–12").
  if (!dining && (draft.kind ?? 'trip') !== 'charter' && (draft.kind ?? 'trip') !== 'rental') {
    draft.tiers.forEach((tier, index) => {
      if ((tier.ageMin ?? 0) > 0 && (tier.ageMax ?? 0) > 0 && tier.ageMax! < tier.ageMin!) errors[`tiers.${index}.ageMax`] = 'The oldest age is under the youngest'
    })
  }
  return errors
}

/** How the draft charges: its choice when the kind allows it, else the kind's own way. A rental sold only by length is "by length". */
export function effectiveChargeBy(draft: Pick<PricingDraft, 'kind' | 'chargeBy' | 'kindSettings'>): ChargeBy {
  const kind = draft.kind ?? 'trip'
  if (kind === 'rental') {
    const modes = normalizeKindSettings(draft.kindSettings).rental.modes
    return modes.length === 1 && modes[0] === 'length' ? 'duration' : 'item'
  }
  const options = chargeOptions(kind)
  return draft.chargeBy && options.includes(draft.chargeBy) ? draft.chargeBy : defaultChargeBy(kind)
}

/** The ladder as saved: real rungs only, smallest group first, one per size. */
export function cleanLadder(ladder: GroupDiscount[] | undefined): GroupDiscount[] {
  const rungs = (ladder ?? [])
    .map((rung) => ({ fromGuests: Math.floor(rung.fromGuests), percentOff: Math.min(90, Math.round(rung.percentOff * 10) / 10) }))
    .filter((rung) => rung.fromGuests >= 2 && rung.percentOff > 0)
    .sort((a, b) => a.fromGuests - b.fromGuests)
  return rungs.filter((rung, index) => rungs.findIndex((entry) => entry.fromGuests === rung.fromGuests) === index)
}

function cleanGroupPrice(group: GroupPrice | undefined): GroupPrice {
  const includedGuests = Math.max(1, Math.floor(group?.includedGuests ?? 6))
  const maxGuests = Math.max(0, Math.floor(group?.maxGuests ?? 0))
  return {
    price: Math.max(0, Math.round(group?.price ?? 0)),
    includedGuests,
    extraGuest: Math.max(0, Math.round(group?.extraGuest ?? 0)),
    maxGuests: maxGuests > 0 ? Math.max(maxGuests, includedGuests) : 0,
  }
}

/**
 * What a save writes for pricing. Unfinished price changes are kept but
 * switched off, so the storefront never shows a "+0%".
 */
export function pricingFieldsOfDraft(draft: PricingDraft, dining = false): {
  chargeBy: ChargeBy | null
  groupPrice: GroupPrice | null
  groupDiscounts: GroupDiscount[]
  minimumCharge: number
  priceChanges: PriceChange[]
} {
  const kind = draft.kind ?? 'trip'
  const chargeBy = dining ? 'person' : effectiveChargeBy(draft)
  // What the step hides for this kind is saved cleared, so nothing unseen moves a price.
  const shown = !dining && kind !== 'package'
  return {
    chargeBy: dining || chargeBy === defaultChargeBy(kind) ? null : chargeBy,
    groupPrice: isGroupPriced(draft, dining) ? cleanGroupPrice(draft.groupPrice) : null,
    groupDiscounts: shown && chargeBy === 'person' ? cleanLadder(draft.groupDiscounts) : [],
    minimumCharge: shown ? Math.max(0, Math.round(draft.minimumCharge ?? 0)) : 0,
    priceChanges: changesOfDraft(draft, dining).map((change) => (isCompleteChange(change) ? change : { ...change, active: false })),
  }
}

/** The draft as the price engine reads it: the same numbers the storefront will use once saved. */
export function pricedFromDraft(draft: PricingDraft, options: { currency: CurrencyCode; slug: string; dining?: boolean }): PricedActivity {
  const dining = Boolean(options.dining)
  const kind: ActivityKind = dining ? 'trip' : (draft.kind ?? 'trip')
  const chargeBy = dining ? 'person' : effectiveChargeBy(draft)
  const priceTiers: PriceTier[] = draft.tiers.map(tierOfDraft)
  // The same numbers a save writes (see pricingFieldsOfDraft).
  const saved = pricingFieldsOfDraft(draft, dining)
  const activity: PricedActivity = {
    slug: options.slug,
    kind,
    currency: options.currency,
    priceTiers,
    chargeBy,
    groupPrice: saved.groupPrice ?? undefined,
    groupDiscounts: saved.groupDiscounts,
    minimumCharge: saved.minimumCharge > 0 ? saved.minimumCharge : undefined,
    priceChanges: saved.priceChanges.filter((change) => change.active),
    priceCap: draft.priceCap && draft.priceCap > 0 ? draft.priceCap : undefined,
    privateOption: canBookPrivately(kind) && chargeBy === 'person' && draft.privateOption?.enabled ? draft.privateOption : undefined,
  }
  if (kind === 'charter') {
    const charter = normalizeKindSettings(draft.kindSettings).charter
    activity.charter = {
      maxGuests: charter.maxGuests,
      requestToBook: false,
      noticeHours: 0,
      ...(draft.charterIncluded > 0 && draft.charterExtra > 0 ? { includedGuests: draft.charterIncluded, extraGuestPrice: draft.charterExtra } : {}),
    }
  }
  if (kind === 'rental') {
    const r = normalizeKindSettings(draft.kindSettings).rental
    const items = draft.tiers.map((tier) => {
      const item = draftItemOf(r, tier.id)
      return { tierId: tier.id, stock: Math.max(1, item.stock), holds: Math.max(1, item.holds), deposit: item.deposit, ...(item.cap > 0 ? { cap: item.cap } : {}) }
    })
    activity.rental = {
      modes: r.modes,
      billing: r.modes.length === 1 && r.modes[0] === 'day' ? 'day' : 'length',
      lengths: r.lengths,
      minHours: r.minHours,
      maxHours: r.maxHours,
      minDays: r.minDays,
      maxDays: r.maxDays,
      rates: draft.tiers.map((tier) => {
        const rate = r.rates[tier.id] ?? { hour: 0, day: 0, lengths: {} }
        return { tierId: tier.id, hour: rate.hour, day: rate.day, lengths: { ...rate.lengths } }
      }),
      items,
      units: items.reduce((sum, item) => sum + item.stock, 0),
      bufferMinutes: r.bufferMinutes,
      damageDeposit: 0,
      durations: [],
    }
  }
  return activity
}

/** The "from" price the storefront will show for the draft. */
export function draftFromPrice(draft: PricingDraft, currency: CurrencyCode, dining = false): number {
  return fromPrice(pricedFromDraft(draft, { currency, slug: '', dining }))
}

/** One line for the Review step: "3 prices from $89 · 2 price changes · 1 extra". */
export function pricingSummary(draft: PricingDraft, currency: CurrencyCode, dining = false): string {
  const kind = draft.kind ?? 'trip'
  const chargeBy = dining ? 'person' : effectiveChargeBy(draft)
  const money = (value: number) => formatCurrency(value, currency)
  const named = draft.tiers.filter((tier) => tier.label.trim().length > 0).length
  const from = money(draftFromPrice(draft, currency, dining))
  const group = cleanGroupPrice(draft.groupPrice)
  const head =
    !dining && chargeBy === 'group' && kind !== 'charter'
      ? `Per group, ${money(group.price)} for up to ${group.includedGuests}`
      : kind === 'rental'
        ? `${named} ${pluralize(named, 'item')} from ${from}`
        : kind === 'charter'
          ? `${named} ${pluralize(named, 'option')} from ${from}`
          : `${named} ${pluralize(named, 'price')} from ${from}`
  const saved = pricingFieldsOfDraft(draft, dining)
  const grouped = isGroupPriced(draft, dining)
  const changes = saved.priceChanges.filter((change) => change.active && !(grouped && namesTiers(change))).length
  const rungs = saved.groupDiscounts.length
  return [
    head,
    changes > 0 ? `${changes} ${pluralize(changes, 'price change')}` : null,
    rungs > 0 ? `${rungs} ${pluralize(rungs, 'group discount')}` : null,
    saved.minimumCharge > 0 ? `at least ${money(saved.minimumCharge)}` : null,
    `${draft.addOns.length} ${pluralize(draft.addOns.length, 'extra')}`,
  ]
    .filter(Boolean)
    .join(' · ')
}

/* ---------- small layout pieces ---------- */

function Block({ title, hint, action, children, className }: { title?: string; hint?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3 border-t border-line-subtle py-6 first:border-t-0 first:pt-0 last:pb-0', className)}>
      {title ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{title}</h3>
            {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

/** A bordered row: a title and one line on the left, the control on the right. */
function OptionRow({ title, hint, error, children }: { title: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className={cn('flex flex-col gap-2.5 rounded-xl border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between', error ? 'border-danger/50' : 'border-line')}>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        {error ? <span className="block text-xs font-medium text-danger">{error}</span> : hint ? <span className="block text-xs text-subtle">{hint}</span> : null}
      </span>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

const CHARGE_META: Record<ChargeBy, { label: string; hint: string; icon: LucideIcon }> = {
  person: { label: 'Per person', hint: 'A price for each guest', icon: User },
  group: { label: 'Per group', hint: 'One price for the whole group', icon: Users },
  item: { label: 'Per item', hint: 'Each item has its own rate', icon: KeyRound },
  duration: { label: 'By length', hint: 'One price per length', icon: Clock },
}

function ChargeCards({ options, value, onChange }: { options: ChargeBy[]; value: ChargeBy; onChange: (next: ChargeBy) => void }) {
  return (
    <div role="radiogroup" aria-label="How do you charge" className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const meta = CHARGE_META[option]
        const on = option === value
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={options.length === 1}
            onClick={() => onChange(option)}
            className={cn(
              'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-default',
              on ? 'border-primary bg-primary-soft/30' : 'border-line bg-surface hover:border-line-strong',
            )}
          >
            <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', on ? 'bg-primary-soft text-primary' : 'bg-surface-sunken text-faint')} aria-hidden="true">
              <meta.icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">{meta.label}</span>
              <span className="block text-xs text-subtle">{meta.hint}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

const whole = (value: string) => Math.max(0, Number.parseInt(value, 10) || 0)

function GroupPriceFields({ value, onChange, currency, spots, error }: { value: GroupPrice; onChange: (next: GroupPrice) => void; currency: CurrencyCode; spots: number; error?: string }) {
  const set = (patch: Partial<GroupPrice>) => onChange({ ...value, ...patch })
  // Four across only when the block itself has the room (it sits in narrow form columns too).
  return (
    <div className="@container">
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-3.5 @xl:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-subtle">
          Group price
          <MoneyInput value={value.price} onValueChange={(price) => set({ price })} currency={currency} size="sm" ariaLabel="Group price" />
          {value.price > 0 ? null : <span className={cn('font-medium', error ? 'text-danger' : 'text-warning')}>{error ?? 'Set a price'}</span>}
        </label>
        <label className="flex flex-col gap-1 text-xs text-subtle">
          Covers up to
          <Input type="number" size="sm" min={1} suffix="guests" inputClassName="tabular" value={value.includedGuests || ''} onChange={(event) => set({ includedGuests: whole(event.target.value) })} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-subtle">
          Each extra guest
          <MoneyInput value={value.extraGuest} onValueChange={(extraGuest) => set({ extraGuest })} currency={currency} size="sm" allowEmpty placeholder={value.maxGuests > value.includedGuests ? 'Free' : 'Not allowed'} ariaLabel="Each extra guest" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-subtle">
          Most guests
          <Input type="number" size="sm" min={1} inputClassName="tabular" placeholder={value.extraGuest > 0 ? (spots > 0 ? String(spots) : 'No limit') : String(value.includedGuests || 1)} value={value.maxGuests || ''} onChange={(event) => set({ maxGuests: whole(event.target.value) })} />
        </label>
      </div>
    </div>
  )
}

function GroupDiscountsEditor({ value, onChange }: { value: GroupDiscount[]; onChange: (next: GroupDiscount[]) => void }) {
  const set = (index: number, patch: Partial<GroupDiscount>) => onChange(value.map((rung, i) => (i === index ? { ...rung, ...patch } : rung)))
  const add = () => {
    const last = value.at(-1)
    onChange([...value, last ? { fromGuests: last.fromGuests + 4, percentOff: Math.min(90, last.percentOff + 5) } : { fromGuests: 6, percentOff: 10 }])
  }
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm font-medium">Group discounts</span>
          <span className="block text-xs text-subtle">Bigger groups pay less per ticket.</span>
        </span>
        <Button type="button" size="xs" variant="secondary" leftIcon={<Plus />} onClick={add}>
          Add
        </Button>
      </div>
      {value.length > 0 ? (
        <ul className="flex list-none flex-col gap-2 p-0">
          {value.map((rung, index) => (
            <li key={index} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">From</span>
              <Input type="number" size="sm" min={2} className="w-28" inputClassName="tabular" suffix="guests" aria-label="From this many guests" value={rung.fromGuests || ''} onChange={(event) => set(index, { fromGuests: whole(event.target.value) })} />
              <Input type="number" size="sm" min={1} max={90} className="w-20" inputClassName="tabular" suffix="%" aria-label="Percent off" value={rung.percentOff || ''} onChange={(event) => set(index, { percentOff: Math.min(90, whole(event.target.value)) })} />
              <span className="text-muted">off</span>
              <IconButton type="button" size="xs" variant="ghost" aria-label="Remove this discount" className="text-faint hover:bg-danger-soft hover:text-danger" onClick={() => onChange(value.filter((_, i) => i !== index))}>
                <Trash2 />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Dec 18 – Jan 4", "Sat, Sun", "Booked 30 days ahead". */
function ruleWhen(rule: PricingRule): string {
  switch (rule.kind) {
    case 'season':
      return rule.from && rule.to ? `${shortDay(rule.from)} – ${shortDay(rule.to)}` : 'Season'
    case 'weekday':
      return (rule.weekdays ?? []).map((day) => WEEKDAY[day]).join(', ')
    case 'early_bird':
      return `Booked ${rule.daysAhead ?? 30} days ahead`
    case 'last_minute':
      return `Within ${rule.hoursWithin ?? 24} hours`
    case 'group':
      return `${rule.minGuests ?? 8}+ guests`
    default:
      return ''
  }
}

function TipsRow({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
      <span>
        <span className="block text-sm font-medium">Offer tips at checkout</span>
        <span className="block text-xs text-subtle">Guests can add a tip for your team.</span>
        {value ? (
          <span className="mt-2 flex flex-wrap gap-1.5" aria-hidden="true">
            {['No tip', '5%', '10%', '15%', '20%', '25%', 'Custom'].map((chip) => (
              <span key={chip} className="rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-muted">
                {chip}
              </span>
            ))}
          </span>
        ) : null}
      </span>
      <Switch checked={value} onCheckedChange={onChange} aria-label="Offer tips at checkout" />
    </label>
  )
}

/* ---------- the step ---------- */

export interface PricingStepProps {
  draft: PricingDraft
  patch: (changes: Partial<PricingDraft>) => void
  errors: Record<string, string>
  currency: CurrencyCode
  /** Restaurants: menus, extras and tips only. */
  dining?: boolean
  tenantSlug: string
  /** The storefront slug business rules are matched on. */
  activitySlug: string
  /** The demo clock. */
  nowIso: string
  /** The activity's start times, for time-of-day changes and the price check. */
  startTimes?: string[]
  /** What guests pay: the activity's own terms, or the business default it follows. */
  payment: PaymentTerms
  /** One line on how the business default collects payment. */
  paymentSummary: string
}

export function PricingStep({ draft, patch, errors, currency, dining = false, tenantSlug, activitySlug, nowIso, startTimes = [], payment, paymentSummary }: PricingStepProps) {
  const kind = draft.kind ?? 'trip'
  const { rules } = usePricing(tenantSlug)
  const { defaults } = useBookingDefaults(tenantSlug)
  const settings = normalizeKindSettings(draft.kindSettings)
  const chargeBy = dining ? 'person' : effectiveChargeBy(draft)
  const grouped = !dining && chargeBy === 'group' && kind !== 'charter'
  const perPerson = chargeBy === 'person'
  const symbol = currencySymbol(currency)
  const todayKey = nowIso.slice(0, 10)
  // Keyed on the text, so a fresh array with the same times doesn't redo the year of prices.
  const timesKey = sortTimes(startTimes).join(',')
  const times = React.useMemo(() => (timesKey ? timesKey.split(',') : []), [timesKey])
  // Each day's own start times, so the price check prices a day only at the times it runs.
  const closures = defaults.closures
  const holidays = defaults.holidays
  const timesOn = React.useMemo(
    () => (dining ? undefined : draftTimesOn(draft, todayKey, scheduleContextOf({ closures, holidays }))),
    // The schedule fields only; the rest of the draft does not move a start time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dining, draft.kind, draft.maxCapacity, draft.scheduleMode, draft.schedules, draft.scheduleChanges, draft.runsOnClosures, draft.schedule?.locations, todayKey, closures, holidays],
  )

  const priced = React.useMemo(
    () => pricedFromDraft(draft, { currency, slug: activitySlug, dining }),
    // The fields the engine reads; the rest of the draft does not move a price.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.tiers, draft.kind, draft.chargeBy, draft.groupPrice, draft.groupDiscounts, draft.minimumCharge, draft.priceChanges, draft.priceCap, draft.privateOption, draft.charterIncluded, draft.charterExtra, draft.kindSettings, currency, activitySlug, dining],
  )
  const appliesHere = React.useMemo(
    () => rules.filter((rule) => rule.active && (rule.activitySlugs.length === 0 || rule.activitySlugs.includes(activitySlug))),
    [rules, activitySlug],
  )
  const leadPrice = draft.tiers.find((tier) => tier.id === leadTierId(draft.tiers, kind))?.price ?? 0
  const tierOptions = draft.tiers.map((tier) => ({ id: tier.id, label: tier.label.trim() }))
  const tierError = errors.tiers ? (
    <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
      <CircleAlert className="size-3.5" aria-hidden="true" />
      {errors.tiers}
    </p>
  ) : null

  const pickCharge = (next: ChargeBy) => {
    if (next !== 'group' || (draft.groupPrice?.price ?? 0) > 0) return patch({ chargeBy: next })
    // A first group price: about what four tickets cost.
    const includedGuests = Math.max(1, draft.groupPrice?.includedGuests || Math.min(6, draft.maxCapacity || 6))
    patch({ chargeBy: next, groupPrice: { ...cleanGroupPrice(draft.groupPrice), includedGuests, price: leadPrice * Math.min(4, includedGuests) } })
  }

  // A removed price (per group: a guest type) also leaves the price changes that named it.
  const setTiers = (tiers: DraftTier[]) => {
    const priceChanges = retargetChanges(draft.priceChanges, tiers.map((tier) => tier.id))
    patch(priceChanges === draft.priceChanges ? { tiers } : { tiers, priceChanges })
  }

  const minimumShown = kind !== 'package'
  // Open when something in it is set, also when a saved edit arrives after the step is shown. Never closes by itself.
  const moreSet = (draft.priceCap ?? 0) > 0 || (minimumShown && (draft.minimumCharge ?? 0) > 0)
  const [moreOpen, setMoreOpen] = React.useState(moreSet)
  React.useEffect(() => {
    if (moreSet) setMoreOpen(true)
  }, [moreSet])
  const moreSummary = [
    minimumShown && (draft.minimumCharge ?? 0) > 0 ? `At least ${formatCurrency(draft.minimumCharge ?? 0, currency)}` : null,
    draft.priceCap > 0 ? `At most ${formatCurrency(draft.priceCap, currency)}` : null,
    draft.tips ? 'Tips on' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  /* ---------- restaurants ---------- */
  if (dining) {
    return (
      <div className="flex flex-col">
        <Block>
          <DiningBookingFields dining={draft.dining} onChange={(next) => patch({ dining: next })} errors={errors} currency={currency} />
        </Block>
        <Block
          title="Menu prices per guest"
          hint={draft.dining.bookingMode === 'card_hold' ? 'Optional for à la carte.' : 'Each guest picks a menu when the table is reserved.'}
        >
          <PricingTierEditor tiers={draft.tiers} onChange={(tiers) => patch({ tiers })} currency={currency} errors={errors} kind="trip" hidePlaces presets={DINING_TIER_PRESETS} noun="menu" />
          {tierError}
        </Block>
        <Block title="Pairings and extras" hint="Offered once the table is picked.">
          <AddonEditor addOns={draft.addOns} onChange={(addOns) => patch({ addOns })} currency={currency} errors={errors} presets={DINING_ADDON_PRESETS} />
        </Block>
        <Block>
          <TipsRow value={Boolean(draft.tips)} onChange={(tips) => patch({ tips })} />
          <GuestPricePreview kind="trip" tiers={draft.tiers} addOns={draft.addOns} currency={currency} />
        </Block>
      </div>
    )
  }

  // How full a time slot is means nothing for a charter (one booking fills it), or before spots are set in Basics.
  const changeKinds: PriceChangeKind[] | undefined =
    kind === 'charter' || draft.maxCapacity <= 0 ? ['season', 'weekdays', 'time_of_day', 'dates', 'early_bird', 'last_minute'] : undefined
  const pricingCopy = KIND_PRICING[kind]

  return (
    <div className="flex flex-col">
      {/* 1. How do you charge */}
      {kind === 'rental' ? (
        <Block>
          <RentalChargingFields settings={draft.kindSettings} onSettings={(kindSettings) => patch({ kindSettings })} currencySymbol={symbol} errors={errors} />
        </Block>
      ) : chargeOptions(kind).length > 1 ? (
        <Block title="How do you charge?">
          <ChargeCards options={chargeOptions(kind)} value={chargeBy} onChange={pickCharge} />
        </Block>
      ) : null}

      {/* 2. Prices */}
      {kind === 'rental' ? (
        <Block title="Items and prices" hint="The lowest rate is the “from” price.">
          <RentalRatesEditor
            tiers={draft.tiers}
            onTiers={setTiers}
            settings={draft.kindSettings}
            onSettings={(kindSettings) => patch({ kindSettings })}
            currencySymbol={symbol}
            errors={errors}
            newTier={(label) => ({ ...blankTier(label, 0, draft.tiers), minQuantity: 0 })}
          />
        </Block>
      ) : grouped ? (
        <Block title="Group price" hint="One price for the group. Guests still say who is coming.">
          <GroupPriceFields
            value={draft.groupPrice ?? defaultPricingDraft().groupPrice}
            onChange={(groupPrice) => patch({ groupPrice })}
            currency={currency}
            spots={draft.maxCapacity}
            error={errors['groupPrice.price']}
          />
          <PricingTierEditor tiers={draft.tiers} onChange={setTiers} currency={currency} errors={errors} kind={kind} presets={KIND_TIER_PRESETS[kind]} priceless noun="guest type" />
          {tierError}
        </Block>
      ) : (
        <Block title={pricingCopy.title} hint={pricingCopy.text(settings.lesson.sessions)}>
          <PricingTierEditor
            tiers={draft.tiers}
            onChange={setTiers}
            currency={currency}
            errors={errors}
            kind={kind}
            presets={KIND_TIER_PRESETS[kind]}
            noun={kind === 'charter' ? 'option' : 'price'}
          />
          {tierError}
          {kind === 'charter' ? (
            <CharterGroupFields currency={currency} maxGuests={settings.charter.maxGuests} included={draft.charterIncluded ?? 0} extra={draft.charterExtra ?? 0} onChange={(charterIncluded, charterExtra) => patch({ charterIncluded, charterExtra })} />
          ) : null}
        </Block>
      )}

      {/* 3. Group discounts and private booking (per person). The minimum charge sits with the cap below. */}
      {kind === 'package' || !perPerson ? null : (
        <Block>
          <GroupDiscountsEditor value={draft.groupDiscounts ?? []} onChange={(groupDiscounts) => patch({ groupDiscounts })} />
          {canBookPrivately(kind) ? (
            <PrivateBookingFields
              kind={kind}
              currency={currency}
              value={draft.privateOption ?? { enabled: false, price: 0, includedGuests: 6, extraGuest: 0 }}
              onChange={(privateOption) => patch({ privateOption })}
              maxGuests={draft.maxCapacity}
              leadPrice={leadPrice}
            />
          ) : null}
        </Block>
      )}

      {/* 6. Price changes */}
      {kind === 'package' ? null : (
        <Block title="Price changes" hint="Up or down by season, day, time or how full it is.">
          <PriceChangesEditor
            changes={draft.priceChanges ?? []}
            onChange={(priceChanges) => patch({ priceChanges })}
            tiers={tierOptions}
            perGroup={grouped}
            currency={currency}
            todayKey={todayKey}
            startTimes={times}
            kinds={changeKinds}
          />
        </Block>
      )}

      {/* 7. Price rules (Pricing → Price rules) */}
      {kind === 'package' || appliesHere.length === 0 ? null : (
        <Block
          title="Price rules that also apply"
          action={
            <Link href="/dashboard/pricing" className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline">
              Edit price rules
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </Link>
          }
        >
          <ul className="flex list-none flex-col divide-y divide-line-subtle rounded-xl border border-line p-0">
            {appliesHere.map((rule) => (
              <li key={rule.id} className="flex items-center justify-between gap-3 px-3.5 py-2 text-[0.8125rem]">
                <span className="min-w-0 truncate">
                  {rule.name}
                  {ruleWhen(rule) ? <span className="text-subtle"> · {ruleWhen(rule)}</span> : null}
                </span>
                <span className={cn('shrink-0 font-medium tabular', rule.percent < 0 ? 'text-success' : 'text-foreground')}>{effectLabel({ type: 'percent', value: rule.percent })}</span>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/* 8. Price check */}
      {kind === 'package' ? (
        <Block>
          <GuestPricePreview kind="package" tiers={draft.tiers} addOns={draft.addOns} currency={currency} />
        </Block>
      ) : (
        <Block title="Price check">
          <PriceCheck
            activity={priced}
            currency={currency}
            nowIso={nowIso}
            startTimes={times}
            timesOn={timesOn}
            businessRules={appliesHere}
            capacity={kind === 'charter' ? 1 : draft.maxCapacity}
            maxGuests={kind === 'charter' ? settings.charter.maxGuests : undefined}
          />
        </Block>
      )}

      {/* 9. More pricing options */}
      <Block>
        <Collapsible open={moreOpen || Boolean(errors.minimumCharge)} onOpenChange={setMoreOpen}>
          <CollapsibleTrigger className="group flex-wrap text-left">
            <ChevronDown className="size-4 transition-transform duration-200 group-data-[state=open]:rotate-180" aria-hidden="true" />
            More pricing options
            {moreSummary ? <span className="text-xs font-normal text-subtle">· {moreSummary}</span> : null}
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-3 pt-3">
            {minimumShown ? (
              <OptionRow title="Minimum charge" error={errors.minimumCharge} hint={kind === 'rental' ? 'The least one booking pays for its items.' : 'The least one booking pays for its tickets.'}>
                <MoneyInput value={draft.minimumCharge ?? 0} onValueChange={(minimumCharge) => patch({ minimumCharge })} currency={currency} allowEmpty placeholder="None" ariaLabel="Minimum charge" className="sm:w-40" />
              </OptionRow>
            ) : null}
            <OptionRow
              title="Booking price cap"
              hint={kind === 'rental' ? 'The most one booking pays for its items.' : kind === 'charter' ? 'The most one booking pays, whichever option.' : 'The most one booking pays for its tickets.'}
            >
              <MoneyInput value={draft.priceCap ?? 0} onValueChange={(priceCap) => patch({ priceCap })} currency={currency} allowEmpty placeholder="No cap" ariaLabel="Booking price cap" className="sm:w-40" />
            </OptionRow>
            <TipsRow value={Boolean(draft.tips)} onChange={(tips) => patch({ tips })} />
          </CollapsibleContent>
        </Collapsible>
      </Block>

      {/* 10. Extras */}
      <Block title="Extras" hint="Offered once a time slot is picked.">
        <AddonEditor addOns={draft.addOns} onChange={(addOns) => patch({ addOns })} currency={currency} errors={errors} />
      </Block>

      {/* 11. Payment */}
      <Block title="Payment">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
          <span>
            <span className="block text-sm font-medium">Use the business default</span>
            <span className="block text-xs text-subtle">
              {draft.payment?.useDefault ? paymentSummary : 'This activity has its own payment terms.'}{' '}
              <Link href="/dashboard/settings/booking" className="font-medium text-primary hover:underline">
                Change the default
              </Link>
            </span>
          </span>
          <Switch checked={Boolean(draft.payment?.useDefault)} onCheckedChange={(on) => patch({ payment: { ...payment, useDefault: on } })} aria-label="Use the business default for payment" />
        </label>
        {draft.payment?.useDefault ? null : (
          <PaymentTermsEditor
            value={draft.payment ?? DEFAULT_PAYMENT}
            onChange={(next) => patch({ payment: { ...next, useDefault: false } })}
            currency={currency}
            // Per group, "a booking for two" would double the group price: no example then.
            examplePrice={grouped ? 0 : fromPrice(priced)}
            wholeGroup={kind === 'charter' || kind === 'rental'}
          />
        )}
      </Block>
    </div>
  )
}
