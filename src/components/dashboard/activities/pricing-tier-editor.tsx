'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronDown, MoreHorizontal, Plus, Tag, Trash2, Users } from 'lucide-react'

import type { CurrencyCode, ActivityKind, PriceTier } from '@/types'
import { cn, currencySymbol, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { DraftAddOn } from './addon-editor'

/* ==========================================================================
   TYPES
   ========================================================================== */

export interface DraftTier {
  id: string
  label: string
  /** Minor units, like every other price in EZRA. */
  price: number
  compareAtPrice: number | null
  minQuantity: number
  maxQuantity: number
  description: string
  countsTowardCapacity: boolean
  /** Places one ticket takes: 2 for a tandem, 4 for a family ticket. Absent: 1. */
  seats?: number
  /** Optional age range shown with the name: "Child · 4–12". */
  ageMin?: number
  ageMax?: number
}

/** A tier with no maximum: the seats left decide how many can book. */
export const NO_LIMIT = 99

let tierCounter = 0

/**
 * A new, empty price row. Pass the rows already there: the counter starts over
 * on every page load, and a saved edit can already hold "tier_draft_1".
 */
export function blankTier(label = '', price = 0, taken: readonly { id: string }[] = []): DraftTier {
  tierCounter += 1
  while (taken.some((tier) => tier.id === `tier_draft_${tierCounter}`)) tierCounter += 1
  return {
    id: `tier_draft_${tierCounter}`,
    label,
    price,
    compareAtPrice: null,
    // How many can book is the spots set on the Booking step; tiers carry no limits of their own.
    minQuantity: 0,
    maxQuantity: 99,
    description: '',
    countsTowardCapacity: true,
  }
}

/** A draft row as the activity stores it. */
export function tierOfDraft(tier: DraftTier): PriceTier {
  return {
    id: tier.id,
    label: tier.label,
    price: tier.price,
    ...(tier.compareAtPrice ? { compareAtPrice: tier.compareAtPrice } : {}),
    minQuantity: tier.minQuantity,
    maxQuantity: NO_LIMIT,
    ...(tier.description.trim() ? { description: tier.description.trim() } : {}),
    countsTowardCapacity: tier.countsTowardCapacity,
    ...(tier.countsTowardCapacity && (tier.seats ?? 1) > 1 ? { seats: tier.seats } : {}),
    ...ageFields(tier),
  }
}

/** The age range to save: only the ends that are set. */
export function ageFields(tier: Pick<DraftTier, 'ageMin' | 'ageMax'>): Pick<PriceTier, 'ageMin' | 'ageMax'> {
  const min = tier.ageMin && tier.ageMin > 0 ? Math.floor(tier.ageMin) : undefined
  const max = tier.ageMax && tier.ageMax > 0 ? Math.floor(tier.ageMax) : undefined
  return { ...(min !== undefined ? { ageMin: min } : {}), ...(max !== undefined ? { ageMax: Math.max(max, min ?? 0) } : {}) }
}

/** "4–12", "Under 4", "65+": a tier's age range, when it has one. */
export function tierAgeLabel(tier: Pick<DraftTier, 'ageMin' | 'ageMax'>): string {
  const { ageMin: min, ageMax: max } = ageFields(tier)
  if (min !== undefined && max !== undefined) return `${min}–${max}`
  if (max !== undefined) return `Under ${max + 1}`
  if (min !== undefined) return `${min}+`
  return ''
}

/**
 * The lead ("from") price row: the first paid price that takes a spot. A
 * charter's options are picked one of, so its cheapest paid option leads.
 */
export function leadTierId(tiers: Pick<DraftTier, 'id' | 'price' | 'countsTowardCapacity'>[], kind?: ActivityKind): string | undefined {
  const paid = tiers.filter((tier) => tier.price > 0)
  if (kind === 'charter') return paid.reduce<(typeof paid)[number] | undefined>((min, tier) => (!min || tier.price < min.price ? tier : min), undefined)?.id
  return (paid.find((tier) => tier.countsTowardCapacity) ?? paid[0])?.id
}

export interface TierPreset {
  label: string
  price: number
  description: string
  counts?: boolean
  /** Places one ticket takes. */
  seats?: number
  ageMin?: number
  ageMax?: number
  /** Price as a share of the lead price (0.6 = 60%), rounded to a whole unit; `price` when there is no lead yet. */
  ratio?: number
}

/** Quick-add prices for anything sold per person. */
export const TIER_PRESETS: TierPreset[] = [
  { label: 'Adult', price: 14900, description: '', ageMin: 13 },
  { label: 'Child', price: 8900, description: '', ageMin: 4, ageMax: 12, ratio: 0.6 },
  { label: 'Infant', price: 0, description: '', counts: false, ageMax: 3 },
  { label: 'Senior', price: 12900, description: '', ageMin: 65, ratio: 0.85 },
  { label: 'Student', price: 12900, description: 'Student ID at check-in', ratio: 0.85 },
  { label: 'Family', price: 44900, description: '2 adults, 2 children', seats: 4, ratio: 3 },
  { label: 'Local', price: 12900, description: 'Local ID at check-in', ratio: 0.85 },
]

/** Starting points that fit how each kind is sold. */
export const KIND_TIER_PRESETS: Partial<Record<ActivityKind, TierPreset[]>> = {
  trip: TIER_PRESETS,
  activity: TIER_PRESETS,
  // A private activity: one price for the whole group, per length.
  charter: [
    { label: '1 hour', price: 19900, description: '' },
    { label: '2 hours', price: 34900, description: '' },
    { label: 'Half day', price: 59900, description: '' },
    { label: 'Full day', price: 99900, description: '' },
  ],
  lesson: [
    { label: 'Student', price: 12900, description: '' },
    { label: 'Junior', price: 9900, description: '', ageMin: 8, ageMax: 15, ratio: 0.75 },
    { label: 'Local', price: 10900, description: 'Local ID at check-in', ratio: 0.85 },
  ],
  pass: [
    { label: 'Day ticket', price: 4900, description: '' },
    { label: 'Child', price: 2900, description: '', ageMin: 3, ageMax: 12, ratio: 0.6 },
    { label: 'Senior', price: 3900, description: '', ageMin: 65, ratio: 0.85 },
    { label: 'Family', price: 14900, description: '2 adults, 2 children', seats: 4, ratio: 3 },
    { label: 'Infant', price: 0, description: '', counts: false, ageMax: 2 },
    { label: 'Local', price: 3900, description: 'Local ID at check-in', ratio: 0.85 },
  ],
  // A shared shuttle's tickets: prices are set per destination in the price table.
  transfer: [
    { label: 'Adult', price: 0, description: '', ageMin: 12 },
    { label: 'Child', price: 0, description: '', ageMin: 3, ageMax: 11 },
    { label: 'Infant', price: 0, description: 'On a lap, no seat', counts: false, ageMax: 2 },
    { label: 'Senior', price: 0, description: '', ageMin: 65 },
  ],
  package: [
    { label: 'Adult', price: 22900, description: '', ageMin: 13 },
    { label: 'Child', price: 18900, description: '', ageMin: 4, ageMax: 12, ratio: 0.8 },
    { label: 'Senior', price: 19900, description: '', ageMin: 65, ratio: 0.9 },
  ],
}

/* ==========================================================================
   MONEY INPUT — stores minor units, edits in major units
   ========================================================================== */

export interface MoneyInputProps {
  value: number
  onValueChange: (minorUnits: number) => void
  currency: CurrencyCode
  placeholder?: string
  ariaLabel: string
  size?: 'sm' | 'md'
  className?: string
  allowEmpty?: boolean
  disabled?: boolean
}

export function MoneyInput({
  value,
  onValueChange,
  currency,
  placeholder = '0.00',
  ariaLabel,
  size = 'md',
  className,
  allowEmpty = false,
  disabled = false,
}: MoneyInputProps) {
  const toText = React.useCallback(
    (minor: number) => (minor === 0 && allowEmpty ? '' : (minor / 100).toString()),
    [allowEmpty],
  )
  const [text, setText] = React.useState(() => toText(value))
  const [focused, setFocused] = React.useState(false)

  // Only mirror external changes while the field is idle, so typing "12." works.
  React.useEffect(() => {
    if (!focused) setText(toText(value))
  }, [value, focused, toText])

  return (
    <Input
      value={text}
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={placeholder}
      size={size}
      className={className}
      disabled={disabled}
      inputClassName="tabular"
      leftIcon={<span className="text-xs font-medium text-subtle">{currencySymbol(currency)}</span>}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        setText(toText(value))
      }}
      onChange={(event) => {
        const raw = event.target.value.replace(/[^0-9.]/g, '')
        setText(raw)
        const parsed = Number.parseFloat(raw)
        onValueChange(Number.isFinite(parsed) ? Math.round(parsed * 100) : 0)
      }}
    />
  )
}

/** A whole number, empty when unset. */
function CountInput({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  max = 120,
  className,
  error,
}: {
  value: number | undefined
  onValueChange: (value: number | undefined) => void
  ariaLabel: string
  placeholder?: string
  max?: number
  className?: string
  error?: string
}) {
  return (
    <Input
      type="number"
      min={0}
      max={max}
      size="sm"
      value={value && value > 0 ? value : ''}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className}
      error={error}
      inputClassName="tabular"
      onChange={(event) => {
        const parsed = Number.parseInt(event.target.value, 10)
        onValueChange(Number.isFinite(parsed) && parsed > 0 ? Math.min(max, parsed) : undefined)
      }}
    />
  )
}

/* ==========================================================================
   TIER EDITOR — one slim row per price: name, price, ages. "More" holds the
   rest (a struck-through Was price, the fewest per booking and a short note).
   How many spots one ticket takes is kept as a preset set it (an infant
   takes none, a family ticket four); it is not edited here.
   ========================================================================== */

export interface PricingTierEditorProps {
  tiers: DraftTier[]
  onChange: (tiers: DraftTier[]) => void
  currency: CurrencyCode
  /** Keyed by `tiers.<index>.<field>`. */
  errors?: Record<string, string>
  /** One-click starting points; defaults to the per-person set. */
  presets?: TierPreset[]
  /**
   * 'charter': a private activity's options, each one price for the whole group: no ages or "at least",
   * and the note is the option's description. A private activity priced per person passes its shared kind.
   */
  kind?: ActivityKind
  /** Menus and other lists where a place is not counted per ticket. */
  hidePlaces?: boolean
  /** Per group: the rows only say who is counted, the group price is set elsewhere. */
  priceless?: boolean
  /** The word for one row: "price", "menu", "guest type". */
  noun?: string
  className?: string
}

export function PricingTierEditor({
  tiers,
  onChange,
  currency,
  errors,
  presets = TIER_PRESETS,
  kind = 'trip',
  hidePlaces = false,
  priceless = false,
  noun = 'price',
  className,
}: PricingTierEditorProps) {
  const perGroup = kind === 'charter' || hidePlaces
  const [open, setOpen] = React.useState<Record<string, boolean>>({})
  const update = (index: number, patch: Partial<DraftTier>) => {
    onChange(tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)))
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= tiers.length) return
    const next = [...tiers]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const used = new Set(tiers.map((tier) => tier.label.trim().toLowerCase()))
  const lead = priceless ? undefined : leadTierId(tiers, kind)
  const leadPrice = tiers.find((tier) => tier.id === lead)?.price ?? 0
  const showAges = !perGroup
  // Columns follow the editor's own width (it sits in narrow form columns too): one line from 36rem,
  // below that the name and actions, then the price and the ages each on their own line.
  const cols = priceless
    ? '@xl:grid-cols-[minmax(0,1fr)_9rem_auto]'
    : showAges
      ? '@xl:grid-cols-[minmax(0,1fr)_8.5rem_9rem_auto]'
      : '@xl:grid-cols-[minmax(0,1fr)_8.5rem_auto]'

  const addPreset = (preset: TierPreset) => {
    const tier = blankTier(preset.label, preset.ratio !== undefined && leadPrice > 0 ? Math.max(100, Math.round((leadPrice * preset.ratio) / 100) * 100) : preset.price, tiers)
    tier.description = preset.description
    tier.countsTowardCapacity = preset.counts ?? true
    if (preset.seats) tier.seats = preset.seats
    if (preset.ageMin) tier.ageMin = preset.ageMin
    if (preset.ageMax) tier.ageMax = preset.ageMax
    onChange([...tiers, tier])
  }

  return (
    <div className={cn('@container flex flex-col gap-2', className)}>
      {tiers.length > 0 ? (
        <div className={cn('hidden gap-2 px-3 text-xs text-subtle @xl:grid', cols)} aria-hidden="true">
          <span>Name</span>
          {priceless ? null : <span>Price</span>}
          {showAges ? <span>Ages (optional)</span> : null}
          <span className="w-28" />
        </div>
      ) : null}

      <ul className="flex list-none flex-col gap-2 p-0">
        {tiers.map((tier, index) => {
          const name = tier.label || `${noun} ${index + 1}`
          const more = Boolean(open[tier.id])
          const hasMore = Boolean(tier.compareAtPrice) || tier.minQuantity > 0 || tier.description.trim().length > 0
          const labelError = errors?.[`tiers.${index}.label`]
          const ageError = errors?.[`tiers.${index}.ageMax`]
          return (
            <li key={tier.id} className="rounded-xl border border-line bg-surface p-2.5 transition-colors duration-200 hover:border-line-strong">
              <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2', cols)}>
                <Input
                  value={tier.label}
                  onChange={(event) => update(index, { label: event.target.value })}
                  placeholder={noun === 'menu' ? 'Tasting menu' : kind === 'charter' ? 'Half day' : 'Adult'}
                  aria-label={`Name of ${noun} ${index + 1}`}
                  size="sm"
                  inputClassName="font-medium"
                  error={labelError}
                  suffix={tier.id === lead && tiers.length > 1 ? <Badge size="sm" variant="primary">From</Badge> : undefined}
                />
                {priceless ? null : (
                  <MoneyInput
                    value={tier.price}
                    onValueChange={(price) => update(index, { price })}
                    currency={currency}
                    size="sm"
                    ariaLabel={`Price for ${name}`}
                    className="order-3 @xl:order-none"
                  />
                )}
                {showAges ? (
                  <div className="order-4 col-span-2 flex min-w-0 items-center gap-1.5 @xl:order-none @xl:col-span-1">
                    {/* The column heading is hidden on narrow widths. */}
                    <span className="text-xs text-subtle @xl:hidden">Ages</span>
                    <CountInput value={tier.ageMin} onValueChange={(ageMin) => update(index, { ageMin })} ariaLabel={`Youngest age for ${name}`} placeholder="Any" max={99} className="min-w-0 flex-1" error={ageError} />
                    <span className="text-xs text-faint" aria-hidden="true">–</span>
                    <CountInput value={tier.ageMax} onValueChange={(ageMax) => update(index, { ageMax })} ariaLabel={`Oldest age for ${name}`} placeholder="Any" max={99} className="min-w-0 flex-1" error={ageError} />
                  </div>
                ) : null}
                <div className="order-2 flex items-center justify-end gap-0.5 @xl:order-none @xl:w-28">
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    aria-expanded={more}
                    onClick={() => setOpen((current) => ({ ...current, [tier.id]: !more }))}
                    rightIcon={<ChevronDown className={cn('transition-transform duration-200', more && 'rotate-180')} />}
                  >
                    More
                    {hasMore && !more ? <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" /> : null}
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton type="button" size="xs" variant="ghost" aria-label={`Actions for ${name}`}>
                        <MoreHorizontal />
                      </IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem disabled={index === 0} onSelect={() => move(index, index - 1)}>
                        <ArrowUp aria-hidden="true" />
                        Move up
                      </DropdownMenuItem>
                      <DropdownMenuItem disabled={index === tiers.length - 1} onSelect={() => move(index, index + 1)}>
                        <ArrowDown aria-hidden="true" />
                        Move down
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem tone="danger" disabled={tiers.length === 1} onSelect={() => onChange(tiers.filter((_, i) => i !== index))}>
                        <Trash2 aria-hidden="true" />
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {labelError ? <p className="mt-1 px-0.5 text-xs font-medium text-danger">{labelError}</p> : null}
              {ageError && showAges ? <p className="mt-1 px-0.5 text-xs font-medium text-danger">{ageError}</p> : null}

              {more ? (
                <div className="mt-2.5 grid gap-2.5 border-t border-line-subtle pt-2.5 @md:grid-cols-2">
                  {priceless ? null : (
                    <label className="flex flex-col gap-1 text-xs text-subtle">
                      Was price
                      <MoneyInput
                        value={tier.compareAtPrice ?? 0}
                        onValueChange={(price) => update(index, { compareAtPrice: price === 0 ? null : price })}
                        currency={currency}
                        size="sm"
                        allowEmpty
                        placeholder="Shown crossed out"
                        ariaLabel={`Was price for ${name}`}
                      />
                    </label>
                  )}
                  {kind === 'charter' ? null : (
                    <label className="flex flex-col gap-1 text-xs text-subtle">
                      Fewest per booking
                      <CountInput value={tier.minQuantity} onValueChange={(minQuantity) => update(index, { minQuantity: minQuantity ?? 0 })} ariaLabel={`Fewest ${name} per booking`} placeholder="None" max={50} />
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-xs text-subtle">
                    {kind === 'charter' ? 'Description' : 'Note'}
                    <Input
                      value={tier.description}
                      onChange={(event) => update(index, { description: event.target.value })}
                      placeholder={kind === 'charter' ? 'Gear and drinks included' : 'Shown under the name'}
                      aria-label={`${kind === 'charter' ? 'Description' : 'Note'} for ${name}`}
                      size="sm"
                    />
                  </label>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" variant="secondary" size="xs" leftIcon={<Plus />} onClick={() => onChange([...tiers, blankTier('', 0, tiers)])}>
          Add {/^[aeiou]/.test(noun) ? 'an' : 'a'} {noun}
        </Button>
        {presets
          .filter((preset) => !used.has(preset.label.toLowerCase()))
          .map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => addPreset(preset)}
              className={cn(
                'inline-flex h-7 items-center gap-1 rounded-full border border-line bg-surface px-2.5',
                'text-xs font-medium text-muted transition-colors duration-200',
                'hover:border-primary/50 hover:bg-primary-soft/50 hover:text-primary',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              )}
            >
              <Plus className="size-3" aria-hidden="true" />
              {preset.label}
            </button>
          ))}
      </div>
    </div>
  )
}

/* ==========================================================================
   GUEST PRICE PREVIEW
   A sample order at the set prices, for menus and packages (no date changes).
   ========================================================================== */

export interface GuestPricePreviewProps {
  tiers: DraftTier[]
  addOns: DraftAddOn[]
  currency: CurrencyCode
  /** Decides the unit and the example order. */
  kind?: ActivityKind
  className?: string
}

const PREVIEW_UNIT: Partial<Record<ActivityKind, string>> = { charter: 'per group, from', lesson: 'per person, from', pass: 'per ticket, from', package: 'per person, from', transfer: 'per vehicle, from' }

export function GuestPricePreview({ tiers, addOns, currency, kind = 'trip', className }: GuestPricePreviewProps) {
  const priced = tiers.filter((tier) => tier.label.trim().length > 0)
  // A representative cart: two of the lead tier, one of the next. A private activity is one price for one group.
  const sample = priced.map((tier, index) => ({
    tier,
    quantity: kind === 'charter' ? (index === 0 ? 1 : 0) : index === 0 ? 2 : index === 1 ? 1 : 0,
  }))
  const requiredAddOns = addOns.filter((addOn) => addOn.required && addOn.label.trim().length > 0)

  const ticketTotal = sample.reduce((acc, row) => acc + row.tier.price * row.quantity, 0)
  const guests = sample.reduce((acc, row) => acc + (row.tier.countsTowardCapacity ? row.quantity : 0), 0)
  const unitsOf = (addOn: DraftAddOn) => (addOn.per === 'booking' || addOn.per === 'each' ? 1 : Math.max(guests, 1))
  const addOnTotal = requiredAddOns.reduce((acc, addOn) => acc + addOn.price * unitsOf(addOn), 0)
  const total = ticketTotal + addOnTotal
  const leadId = leadTierId(priced, kind)
  const fromPrice = priced.find((tier) => tier.id === leadId)?.price ?? 0
  const compareAt = priced.find((tier) => tier.id === leadId)?.compareAtPrice ?? null

  return (
    <div className={cn('rounded-xl border border-line bg-surface-sunken/60 p-4', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-subtle uppercase">
          <Tag className="size-3.5" aria-hidden="true" />
          What the guest sees
        </p>
        <span className="text-xs text-faint">Example order</span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold">{formatCurrency(fromPrice, currency)}</span>
        {compareAt && compareAt > fromPrice ? <span className="text-sm text-faint line-through">{formatCurrency(compareAt, currency)}</span> : null}
        <span className="text-xs text-muted">{PREVIEW_UNIT[kind] ?? 'per guest, from'}</span>
      </div>

      <ul className="mt-3 flex list-none flex-col gap-1.5 p-0 text-sm">
        {sample.map(({ tier, quantity }) => (
          <li key={tier.id} className={cn('flex items-baseline justify-between gap-3', quantity === 0 && 'text-faint')}>
            <span className="min-w-0 truncate">
              <span className="tabular">{quantity} ×</span> {tier.label}
            </span>
            <span className="shrink-0 tabular">{formatCurrency(tier.price * quantity, currency)}</span>
          </li>
        ))}
        {requiredAddOns.map((addOn) => (
          <li key={addOn.id} className="flex items-baseline justify-between gap-3 text-muted">
            <span className="min-w-0 truncate">
              {addOn.label} <span className="text-faint">(required)</span>
            </span>
            <span className="shrink-0 tabular">{formatCurrency(addOn.price * unitsOf(addOn), currency)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="size-3.5 text-faint" aria-hidden="true" />
          {guests} {guests === 1 ? 'guest' : 'guests'}
        </span>
        <span className="font-display text-lg font-semibold tabular">{formatCurrency(total, currency)}</span>
      </div>
    </div>
  )
}
