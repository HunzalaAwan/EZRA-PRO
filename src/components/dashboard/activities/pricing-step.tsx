'use client'

import * as React from 'react'
import { CircleAlert, Clock, KeyRound, User, Users, type LucideIcon } from 'lucide-react'

import type { ActivityKind, CharterConfig, ChargeBy, CurrencyCode, GroupDiscount, GroupPrice, PaymentTerms, PriceChange, PriceTier, PrivateOption } from '@/types'
import { defaultChargeBy, fromPrice, groupTierOf, type PricedActivity } from '@/lib/price-engine'
import { cn, currencySymbol, formatCurrency, pluralize } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

import { AddonEditor, type DraftAddOn } from './addon-editor'
import { DINING_ADDON_PRESETS, DINING_TIER_PRESETS, DiningBookingFields, type DiningDraft } from './dining-fields'
import { RentalChargingFields, RentalRatesEditor, draftItemOf, normalizeKindSettings, type DraftKindSettings } from './kind-fields'
import { ExtraGuestFields, KIND_PRICING, PRIVATE_PER_PERSON_PRICING, PrivateBookingFields, canBookPrivately } from './kind-pricing-extras'
import { PaymentTermsEditor } from './payment-terms-editor'
import { GuestPricePreview, KIND_TIER_PRESETS, MoneyInput, PricingTierEditor, TIER_PRESETS, blankTier, leadTierId, tierOfDraft, type DraftTier } from './pricing-tier-editor'

/* ==========================================================================
   THE PRICING STEP — how it charges (where there is a choice), the prices,
   private booking, a price cap and tips, extras, and how guests pay.
   Shared and private activities both charge per person or per group:
     - shared, per person: a price for each guest
     - shared, per group: one price for the group, what it covers and each
       extra guest (`groupPrice`)
     - private, per person: a price for each guest; the group still has the
       time slot to itself
     - private, per group: options, each one price for the whole group, with
       what they cover and each extra guest (`charter.includedGuests` /
       `extraGuestPrice`)
   Seasons, busy days, early bookings and bigger groups are price rules,
   set once on Pricing → Price rules and given to the activities they fit.
   ========================================================================== */

/** The parts of the wizard draft this step reads and writes. */
export interface PricingDraft {
  kind: ActivityKind
  tiers: DraftTier[]
  addOns: DraftAddOn[]
  kindSettings: DraftKindSettings
  /** Spots per time slot; for a private activity, the most guests. */
  maxCapacity: number
  privateOption: PrivateOption
  priceCap: number
  tips: boolean
  payment: PaymentTerms
  dining: DiningDraft
  /** null or absent: the kind's own way (a private activity: per group). */
  chargeBy?: ChargeBy | null
  /** Shared, per group: the price, the guests it covers (0: everyone) and each extra guest. */
  groupPrice?: GroupPrice
  /** Private, per group: the guests every option covers. 0: everyone. */
  charterIncluded?: number
  /** Private, per group: each guest over that, minor units. 0: none. */
  charterExtra?: number
  /**
   * A private activity's rows for its other way of charging (the tickets while
   * it is per group, the options while it is per person), set aside by a
   * switch so switching back brings them back. Only while the draft is open:
   * never saved.
   */
  otherTiers?: DraftTier[] | null
  /** No longer set on an activity: saved empty. */
  groupDiscounts?: GroupDiscount[]
  /** No longer set on an activity: saved as none. */
  minimumCharge?: number
  /** No longer set on an activity: saved empty. */
  priceChanges?: PriceChange[]
}

/* ---------- draft ↔ activity ---------- */

/** The pricing fields of a draft, as a new one starts them and an open one reads them. */
interface PricingDraftFields {
  chargeBy: ChargeBy | null
  groupPrice: GroupPrice
  charterIncluded: number
  charterExtra: number
  otherTiers: DraftTier[] | null
  groupDiscounts: GroupDiscount[]
  minimumCharge: number
  priceChanges: PriceChange[]
}

/** A new draft's pricing: the kind's own way of charging, and a group price that covers everyone. */
export function defaultPricingDraft(): PricingDraftFields {
  return {
    chargeBy: null,
    groupPrice: { price: 0, includedGuests: 0, extraGuest: 0, maxGuests: 0 },
    charterIncluded: 0,
    charterExtra: 0,
    otherTiers: null,
    groupDiscounts: [],
    minimumCharge: 0,
    priceChanges: [],
  }
}

/** The pricing fields of an activity, as the draft holds them. */
export function pricingDraftOf(activity: {
  chargeBy?: ChargeBy
  groupPrice?: GroupPrice
  charter?: Pick<CharterConfig, 'includedGuests' | 'extraGuestPrice'>
  groupDiscounts?: GroupDiscount[]
  minimumCharge?: number
  priceChanges?: PriceChange[]
}): PricingDraftFields {
  const blank = defaultPricingDraft()
  // An extra-guest charge is the number covered and the price together; one without the other opens as none.
  const group = activity.groupPrice ? savedGroupPrice(activity.groupPrice) : blank.groupPrice
  const extras = extraGuestsOf(activity.charter?.includedGuests ?? 0, activity.charter?.extraGuestPrice ?? 0)
  return {
    chargeBy: activity.chargeBy ?? null,
    groupPrice: group,
    charterIncluded: extras.included,
    charterExtra: extras.extra,
    otherTiers: null,
    groupDiscounts: (activity.groupDiscounts ?? []).map((rung) => ({ ...rung })),
    minimumCharge: activity.minimumCharge ?? 0,
    priceChanges: (activity.priceChanges ?? []).map((change) => ({ ...change, effect: { ...change.effect } })),
  }
}

/**
 * The ways each kind can charge. Shared and private activities and lessons
 * charge per person or per group; rentals choose by the hour, by length or by
 * the day instead.
 */
export function chargeOptions(kind: ActivityKind): ChargeBy[] {
  switch (kind) {
    case 'rental':
      return []
    case 'package':
    case 'pass':
      return ['person']
    default:
      return ['person', 'group']
  }
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

/**
 * Is the draft a shared activity priced per group? One price for the group;
 * guests only say how many are coming. The per-person prices stay in the
 * draft while it is open, so going back to per person brings them back.
 */
export const isGroupPriced = (draft: Pick<PricingDraft, 'kind' | 'chargeBy' | 'kindSettings'>, dining = false) =>
  !dining && (draft.kind ?? 'trip') !== 'charter' && effectiveChargeBy(draft) === 'group'

/** Is the draft a private activity priced per group? Its rows are options, each one price for the whole group. */
export const isPrivateGroupPriced = (draft: Pick<PricingDraft, 'kind' | 'chargeBy' | 'kindSettings'>, dining = false) =>
  !dining && (draft.kind ?? 'trip') === 'charter' && effectiveChargeBy(draft) === 'group'

/** Per group: the price row every guest is booked on, as the storefront picks it (see `groupTierOf`). */
export function groupTierIdOf(draft: Pick<PricingDraft, 'tiers'>): string | undefined {
  return groupTierOf({ priceTiers: draft.tiers.map(tierOfDraft) })?.id
}

/**
 * The price rows a save keeps. Shared per group only the row guests are
 * booked on: the other prices are hidden there, so a save doesn't keep them.
 * The rows a private activity set aside are never saved.
 */
export function savedTiersOf(draft: Pick<PricingDraft, 'kind' | 'chargeBy' | 'kindSettings' | 'tiers'>, dining = false): DraftTier[] {
  if (!isGroupPriced(draft, dining)) return draft.tiers
  const id = groupTierIdOf(draft)
  return draft.tiers.filter((tier) => tier.id === id)
}

/** The longest group price description. */
const GROUP_NOTE_MAX = 80

/** "Covers up to" and "Each extra guest" count together: both set, or neither. */
function extraGuestsOf(included: number, extra: number): { included: number; extra: number } {
  const covers = Math.max(0, Math.floor(included || 0))
  const each = Math.max(0, Math.round(extra || 0))
  return covers > 0 && each > 0 ? { included: covers, extra: each } : { included: 0, extra: 0 }
}

/** Private, per group: the extra-guest charge a save writes on `charter`. Nothing when it is not set, or the activity is per person. */
export function charterExtrasOf(draft: Pick<PricingDraft, 'kind' | 'chargeBy' | 'kindSettings' | 'charterIncluded' | 'charterExtra'>): Pick<CharterConfig, 'includedGuests' | 'extraGuestPrice'> {
  if (!isPrivateGroupPriced(draft)) return {}
  const { included, extra } = extraGuestsOf(draft.charterIncluded ?? 0, draft.charterExtra ?? 0)
  return included > 0 ? { includedGuests: included, extraGuestPrice: extra } : {}
}

/** The group price as it is edited: whole numbers, the description kept as typed. The most guests is the activity's spots. */
function cleanGroupPrice(group: GroupPrice | undefined): GroupPrice {
  return {
    price: Math.max(0, Math.round(group?.price ?? 0)),
    includedGuests: Math.max(0, Math.floor(group?.includedGuests ?? 0)),
    extraGuest: Math.max(0, Math.round(group?.extraGuest ?? 0)),
    maxGuests: 0,
    ...(group?.note ? { note: group.note } : {}),
  }
}

/** The group price as saved: an extra-guest charge only with both its numbers, the description trimmed and left off when empty. */
function savedGroupPrice(group: GroupPrice | undefined): GroupPrice {
  const { note, ...rest } = cleanGroupPrice(group)
  const { included, extra } = extraGuestsOf(rest.includedGuests, rest.extraGuest)
  const trimmed = (note ?? '').trim().slice(0, GROUP_NOTE_MAX)
  return { ...rest, includedGuests: included, extraGuest: extra, ...(trimmed ? { note: trimmed } : {}) }
}

/** What the Pricing step must have before moving on. Keys match the fields that show them. */
export function pricingErrors(draft: PricingDraft, dining = false): Record<string, string> {
  const errors: Record<string, string> = {}
  if (dining) return errors
  const kind = draft.kind ?? 'trip'
  const grouped = isGroupPriced(draft)
  const options = isPrivateGroupPriced(draft)
  if (grouped && (draft.groupPrice?.price ?? 0) <= 0) errors['groupPrice.price'] = 'Set a price for the group'
  // An extra-guest price counts from the guests the price covers.
  if (grouped && (draft.groupPrice?.extraGuest ?? 0) > 0 && (draft.groupPrice?.includedGuests ?? 0) <= 0) errors['groupPrice.includedGuests'] = 'Set how many guests the price covers'
  if (options && (draft.charterExtra ?? 0) > 0 && (draft.charterIncluded ?? 0) <= 0) errors.charterIncluded = 'Set how many guests the price covers'
  // Ages the wrong way round would save as one age ("12–12"). Only prices per guest have ages; per group they are hidden, so not checked.
  if (!grouped && !options && kind !== 'rental') {
    draft.tiers.forEach((tier, index) => {
      if ((tier.ageMin ?? 0) > 0 && (tier.ageMax ?? 0) > 0 && tier.ageMax! < tier.ageMin!) errors[`tiers.${index}.ageMax`] = 'The oldest age is under the youngest'
    })
  }
  return errors
}

/**
 * What a save writes for pricing. Group discounts, a minimum charge and the
 * activity's own price changes are no longer set here (price rules do that
 * job), so they are saved cleared and nothing unseen moves a price. A private
 * activity's extra-guest charge is saved on `charter` (see `charterExtrasOf`).
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
  return {
    chargeBy: dining || chargeBy === defaultChargeBy(kind) ? null : chargeBy,
    groupPrice: isGroupPriced(draft, dining) ? savedGroupPrice(draft.groupPrice) : null,
    groupDiscounts: [],
    minimumCharge: 0,
    priceChanges: [],
  }
}

/* ---------- switching shared ↔ private, per person ↔ per group ---------- */

/** The one row a new draft starts with, by kind. Renamed with the kind or the way of charging until the owner renames it. */
export const STARTER_LABEL: Record<ActivityKind, string> = {
  trip: 'Adult',
  activity: 'Rider',
  charter: 'Private group',
  rental: 'Standard',
  lesson: 'Student',
  pass: 'Day ticket',
  package: 'Adult',
}

const isStarterRow = (tiers: DraftTier[]) => tiers.length === 1 && Object.values(STARTER_LABEL).includes(tiers[0].label)

/** The rows are options, each one price for the whole group: a private activity priced per group. */
const usesOptions = (kind: ActivityKind, chargeBy: ChargeBy) => kind === 'charter' && chargeBy === 'group'

/** A first group price is about what four guests pay; a first per-guest price, a quarter of a group price. */
const groupOf = (guests: number) => Math.max(1, Math.min(4, guests || 4))
const wholeUnits = (minor: number) => Math.max(0, Math.round(minor / 100) * 100)

/**
 * The pricing a draft moves to when it switches between shared and private,
 * or per person and per group. Tickets stay tickets. A shared group price
 * becomes a private activity's one option, with its extra-guest charge, and
 * back. Between a private activity's tickets and options, the rows it leaves
 * are set aside (`otherTiers`) so switching back brings them back; with none
 * set aside, a first row is priced from the other way. A starter row follows
 * the new way's name. `chargeBy` is passed through as given: null keeps the
 * new kind's own way (a private activity: per group).
 */
export function repriceDraft(
  draft: PricingDraft,
  to: { kind: ActivityKind; chargeBy: ChargeBy | null },
  /** What a private activity's tickets are named after: a tour's "Adult", an activity's "Rider". */
  ticketKind: ActivityKind = 'trip',
): Partial<PricingDraft> {
  const fromKind = draft.kind ?? 'trip'
  const from = effectiveChargeBy(draft)
  const method = effectiveChargeBy({ kind: to.kind, chargeBy: to.chargeBy, kindSettings: draft.kindSettings })
  const wasOptions = usesOptions(fromKind, from)
  const toOptions = usesOptions(to.kind, method)
  const guests = groupOf(draft.maxCapacity)
  const taken = [...draft.tiers, ...(draft.otherTiers ?? [])]
  const setAside = draft.otherTiers && draft.otherTiers.length > 0 ? draft.otherTiers : null
  const ticketsAs: ActivityKind = to.kind === 'charter' ? ticketKind : to.kind
  const named = (tiers: DraftTier[], kind: ActivityKind) => (isStarterRow(tiers) && tiers[0].label !== STARTER_LABEL[kind] ? [{ ...tiers[0], label: STARTER_LABEL[kind] }] : tiers)
  const cheapest = (tiers: DraftTier[]) => tiers.find((tier) => tier.id === leadTierId(tiers, 'charter'))
  // A private activity switching per person ↔ per group: the first new row takes the place of the first row it replaces,
  // so a saved activity still sells it (the storefront sells the rows an activity was set up with, by id).
  const inPlace = (row: DraftTier): DraftTier => (to.kind === fromKind && draft.tiers[0] ? { ...row, id: draft.tiers[0].id } : row)
  const changes: Partial<PricingDraft> = { chargeBy: to.chargeBy }

  if (!wasOptions && toOptions) {
    if (isGroupPriced(draft)) {
      // The shared group price is the one option, and its extra-guest charge carries over.
      const group = savedGroupPrice(draft.groupPrice)
      const unchanged = setAside && cheapest(setAside)?.price === group.price
      changes.tiers = unchanged ? setAside : [{ ...blankTier(STARTER_LABEL.charter, group.price, taken), description: group.note ?? '' }]
      changes.charterIncluded = group.includedGuests
      changes.charterExtra = group.extraGuest
    } else {
      const lead = draft.tiers.find((tier) => tier.id === leadTierId(draft.tiers, 'trip'))
      changes.tiers = setAside ?? [inPlace(blankTier(STARTER_LABEL.charter, wholeUnits((lead?.price ?? 0) * guests), taken))]
    }
    changes.otherTiers = draft.tiers
    return changes
  }

  if (wasOptions && !toOptions) {
    const lead = cheapest(draft.tiers)
    changes.tiers = named(setAside ?? [inPlace({ ...blankTier(STARTER_LABEL[ticketsAs], wholeUnits((lead?.price ?? 0) / guests), taken), minQuantity: to.kind === 'rental' ? 0 : 1 })], ticketsAs)
    changes.otherTiers = draft.tiers
    if (to.kind !== 'charter' && method === 'group') {
      // A shared group price: the lowest option, with the same extra-guest charge.
      const note = lead?.description.trim()
      changes.groupPrice = savedGroupPrice({ price: lead?.price ?? 0, includedGuests: draft.charterIncluded ?? 0, extraGuest: draft.charterExtra ?? 0, maxGuests: 0, ...(note ? { note } : {}) })
    }
    return changes
  }

  // Tickets stay tickets, options stay options.
  if (to.kind !== fromKind) changes.tiers = named(draft.tiers, toOptions ? 'charter' : ticketsAs)
  if (to.kind !== 'charter' && method === 'group' && from !== 'group' && (draft.groupPrice?.price ?? 0) <= 0) {
    // A first group price: about what four guests pay.
    const lead = draft.tiers.find((tier) => tier.id === leadTierId(draft.tiers, 'trip'))
    changes.groupPrice = { ...cleanGroupPrice(draft.groupPrice), price: (lead?.price ?? 0) * guests }
  }
  return changes
}

/* ---------- the price engine's view ---------- */

/** The draft as the price engine reads it: the same numbers the storefront will use once saved. */
export function pricedFromDraft(draft: PricingDraft, options: { currency: CurrencyCode; slug: string; dining?: boolean }): PricedActivity {
  const dining = Boolean(options.dining)
  const kind: ActivityKind = dining ? 'trip' : (draft.kind ?? 'trip')
  const chargeBy = dining ? 'person' : effectiveChargeBy(draft)
  const priceTiers: PriceTier[] = savedTiersOf(draft, dining).map(tierOfDraft)
  // The same numbers a save writes (see pricingFieldsOfDraft).
  const saved = pricingFieldsOfDraft(draft, dining)
  const activity: PricedActivity = {
    slug: options.slug,
    kind,
    currency: options.currency,
    priceTiers,
    chargeBy,
    groupPrice: saved.groupPrice ?? undefined,
    groupDiscounts: [],
    priceChanges: [],
    priceCap: draft.priceCap && draft.priceCap > 0 ? draft.priceCap : undefined,
    privateOption: canBookPrivately(kind) && chargeBy === 'person' && draft.privateOption?.enabled ? draft.privateOption : undefined,
  }
  if (kind === 'charter') {
    // The time slot is the group's, per person or per group; per group the options can charge for extra guests.
    activity.charter = { maxGuests: normalizeKindSettings(draft.kindSettings).charter.maxGuests, requestToBook: false, noticeHours: 0, ...charterExtrasOf(draft) }
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

/** One line for the Review step: "3 prices from $89 · 1 extra", "Per group, $400 · $40 each guest over 6 · 2 extras". */
export function pricingSummary(draft: PricingDraft, currency: CurrencyCode, dining = false): string {
  const kind = draft.kind ?? 'trip'
  const money = (value: number) => formatCurrency(value, currency)
  const named = draft.tiers.filter((tier) => tier.label.trim().length > 0).length
  const from = money(draftFromPrice(draft, currency, dining))
  const over = (included: number, extra: number) => (included > 0 && extra > 0 ? `${money(extra)} each guest over ${included}` : null)
  const group = savedGroupPrice(draft.groupPrice)
  const charter = charterExtrasOf(draft)
  const head = isGroupPriced(draft, dining)
    ? [`Per group, ${money(group.price)}`, over(group.includedGuests, group.extraGuest)]
    : kind === 'rental'
      ? [`${named} ${pluralize(named, 'item')} from ${from}`]
      : isPrivateGroupPriced(draft, dining)
        ? [`${named} group ${pluralize(named, 'price')} from ${from}`, over(charter.includedGuests ?? 0, charter.extraGuestPrice ?? 0)]
        : kind === 'charter' && !dining
          ? [`Per person, ${named} ${pluralize(named, 'price')} from ${from}`]
          : [`${named} ${pluralize(named, 'price')} from ${from}`]
  return [...head, `${draft.addOns.length} ${pluralize(draft.addOns.length, 'extra')}`].filter(Boolean).join(' · ')
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
  /** The storefront slug. */
  activitySlug: string
  /** What guests pay: the activity's own terms, or the business default it follows. */
  payment: PaymentTerms
}

export function PricingStep({ draft, patch, errors, currency, dining = false, activitySlug, payment }: PricingStepProps) {
  const kind = draft.kind ?? 'trip'
  const settings = normalizeKindSettings(draft.kindSettings)
  const chargeBy = dining ? 'person' : effectiveChargeBy(draft)
  const grouped = isGroupPriced(draft, dining)
  const options = isPrivateGroupPriced(draft, dining)
  const perPerson = chargeBy === 'person'
  // A private activity priced per person sells tickets like a shared one.
  const rowsKind: ActivityKind = kind === 'charter' && perPerson ? 'trip' : kind
  const symbol = currencySymbol(currency)
  // The "from" price, for the payment example.
  const examplePrice = React.useMemo(
    () => fromPrice(pricedFromDraft(draft, { currency, slug: activitySlug, dining })),
    // The fields the engine reads; the rest of the draft does not move a price.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft.tiers, draft.kind, draft.chargeBy, draft.groupPrice, draft.charterIncluded, draft.charterExtra, draft.maxCapacity, draft.priceCap, draft.privateOption, draft.kindSettings, currency, activitySlug, dining],
  )
  const leadPrice = draft.tiers.find((tier) => tier.id === leadTierId(draft.tiers, rowsKind))?.price ?? 0
  const tierError = errors.tiers ? (
    <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
      <CircleAlert className="size-3.5" aria-hidden="true" />
      {errors.tiers}
    </p>
  ) : null
  // Per group the price rows are hidden: a check that still fails on one of them.
  const hiddenTierError = grouped ? (errors.tiers ?? Object.entries(errors).find(([key]) => key.startsWith('tiers.'))?.[1]) : undefined

  const pickCharge = (next: ChargeBy) => {
    if (next === chargeBy) return
    patch(repriceDraft(draft, { kind, chargeBy: next }))
  }
  const setTiers = (tiers: DraftTier[]) => patch({ tiers })
  const group = draft.groupPrice ?? defaultPricingDraft().groupPrice
  const setGroup = (changes: Partial<GroupPrice>) => patch({ groupPrice: { ...cleanGroupPrice(group), ...changes } })

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

  const pricingCopy = kind === 'charter' && perPerson ? { title: PRIVATE_PER_PERSON_PRICING.title, text: () => PRIVATE_PER_PERSON_PRICING.text } : KIND_PRICING[kind]
  const privateShown = perPerson && canBookPrivately(kind)
  // One price for the group leaves nothing to cap; a cap set before stays editable so it never applies unseen.
  const capShown = (perPerson || kind === 'rental') || (draft.priceCap ?? 0) > 0

  return (
    <div className="flex flex-col">
      {/* How do you charge */}
      {kind === 'rental' ? (
        <Block>
          <RentalChargingFields settings={draft.kindSettings} onSettings={(kindSettings) => patch({ kindSettings })} currencySymbol={symbol} errors={errors} />
        </Block>
      ) : chargeOptions(kind).length > 1 ? (
        <Block title="How do you charge?">
          <ChargeCards options={chargeOptions(kind)} value={chargeBy} onChange={pickCharge} />
        </Block>
      ) : null}

      {/* Prices */}
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
        <Block title="Group price" hint="One price for the whole group. Guests say how many are coming.">
          {/* Three across only when the block itself has the room (it sits in narrow form columns too). */}
          <div className="@container">
            <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3">
              <label className="col-span-2 flex flex-col gap-1 text-xs text-subtle @lg:col-span-1">
                Price for the group
                <MoneyInput value={group.price} onValueChange={(price) => setGroup({ price })} currency={currency} size="sm" ariaLabel="Price for the group" />
                {group.price > 0 ? null : <span className={cn('font-medium', errors['groupPrice.price'] ? 'text-danger' : 'text-warning')}>{errors['groupPrice.price'] ?? 'Set a price'}</span>}
              </label>
              <ExtraGuestFields
                currency={currency}
                included={group.includedGuests}
                extra={group.extraGuest}
                onChange={({ included, extra }) => setGroup({ includedGuests: included, extraGuest: extra })}
                limit={draft.maxCapacity}
                error={errors['groupPrice.includedGuests']}
              />
            </div>
          </div>
          <label className="flex flex-col gap-1 text-xs text-subtle">
            Description (optional)
            <Input
              value={group.note ?? ''}
              onChange={(event) => setGroup({ note: event.target.value.slice(0, GROUP_NOTE_MAX) })}
              placeholder="Gear and drinks included"
              aria-label="Group price description"
              maxLength={GROUP_NOTE_MAX}
              size="sm"
            />
          </label>
          {/* The per-person prices are hidden here but still checked on save: say where to fix one. */}
          {hiddenTierError ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
              <CircleAlert className="size-3.5" aria-hidden="true" />
              {hiddenTierError.replace(/\.$/, '')}. Switch to Per person to fix it.
            </p>
          ) : null}
        </Block>
      ) : (
        <Block title={pricingCopy.title} hint={pricingCopy.text(settings.lesson.sessions)}>
          <PricingTierEditor
            tiers={draft.tiers}
            onChange={setTiers}
            currency={currency}
            errors={errors}
            kind={rowsKind}
            presets={rowsKind === kind ? KIND_TIER_PRESETS[kind] : TIER_PRESETS}
            noun="price"
          />
          {tierError}
          {/* Private, per group: what every option covers, and each guest over that. */}
          {options ? (
            <div className="@container">
              <div className="grid grid-cols-2 gap-3 @lg:max-w-md">
                <ExtraGuestFields
                  currency={currency}
                  included={draft.charterIncluded ?? 0}
                  extra={draft.charterExtra ?? 0}
                  onChange={({ included, extra }) => patch({ charterIncluded: included, charterExtra: extra })}
                  limit={settings.charter.maxGuests}
                  error={errors.charterIncluded}
                />
              </div>
            </div>
          ) : null}
        </Block>
      )}

      {/* Private booking, the price cap and tips */}
      <Block>
        {privateShown ? (
          <PrivateBookingFields
            kind={kind}
            currency={currency}
            value={draft.privateOption ?? { enabled: false, price: 0, includedGuests: 6, extraGuest: 0 }}
            onChange={(privateOption) => patch({ privateOption })}
            maxGuests={draft.maxCapacity}
            leadPrice={leadPrice}
          />
        ) : null}
        {capShown ? (
          <OptionRow title="Booking price cap" hint={kind === 'rental' ? 'The most one booking pays for its items.' : 'The most one booking pays, however many guests.'}>
            <MoneyInput value={draft.priceCap ?? 0} onValueChange={(priceCap) => patch({ priceCap })} currency={currency} allowEmpty placeholder="No cap" ariaLabel="Booking price cap" className="sm:w-40" />
          </OptionRow>
        ) : null}
        <TipsRow value={Boolean(draft.tips)} onChange={(tips) => patch({ tips })} />
      </Block>

      {/* Extras */}
      <Block title="Extras" hint="Offered once a time slot is picked.">
        <AddonEditor addOns={draft.addOns} onChange={(addOns) => patch({ addOns })} currency={currency} errors={errors} />
      </Block>

      {/* Payment: the terms guests get. Untouched it follows the business default; a change makes them this activity's own. */}
      <Block>
        <PaymentTermsEditor
          value={payment}
          onChange={(next) => patch({ payment: { ...next, useDefault: false } })}
          currency={currency}
          examplePrice={examplePrice}
          wholeGroup={kind === 'charter' || kind === 'rental' || grouped}
          followsDefault={Boolean(draft.payment?.useDefault)}
        />
      </Block>
    </div>
  )
}
