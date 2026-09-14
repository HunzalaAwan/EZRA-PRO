'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, GripVertical, Plus, Tag, Trash2, Users } from 'lucide-react'

import type { CurrencyCode } from '@/types'
import { cn, currencySymbol, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { SimpleTooltip } from '@/components/ui/tooltip'
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
}

let tierCounter = 0

export function blankTier(label = '', price = 0): DraftTier {
  tierCounter += 1
  return {
    id: `tier_draft_${tierCounter}`,
    label,
    price,
    compareAtPrice: null,
    minQuantity: 1,
    maxQuantity: 8,
    description: '',
    countsTowardCapacity: true,
  }
}

const TIER_PRESETS: { label: string; price: number; description: string; counts?: boolean }[] = [
  { label: 'Adult', price: 14900, description: 'Ages 18 and over' },
  { label: 'Child (4–12)', price: 8900, description: 'Must be accompanied by an adult' },
  { label: 'Senior (65+)', price: 12900, description: '' },
  { label: 'Infant (under 4)', price: 0, description: 'Lap seat, no equipment', counts: false },
  { label: 'Private charter', price: 89900, description: 'Exclusive use of the vessel' },
]

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

function NumberField({
  value,
  onValueChange,
  ariaLabel,
  min = 0,
  max = 999,
}: {
  value: number
  onValueChange: (value: number) => void
  ariaLabel: string
  min?: number
  max?: number
}) {
  return (
    <Input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      size="sm"
      aria-label={ariaLabel}
      inputClassName="tabular"
      onChange={(event) => {
        const parsed = Number.parseInt(event.target.value, 10)
        onValueChange(Number.isFinite(parsed) ? parsed : 0)
      }}
    />
  )
}

/* ==========================================================================
   TIER EDITOR
   ========================================================================== */

export interface PricingTierEditorProps {
  tiers: DraftTier[]
  onChange: (tiers: DraftTier[]) => void
  currency: CurrencyCode
  /** Keyed by `tiers.<index>.<field>`. */
  errors?: Record<string, string>
  className?: string
}

export function PricingTierEditor({
  tiers,
  onChange,
  currency,
  errors,
  className,
}: PricingTierEditorProps) {
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

  const usedPresets = new Set(tiers.map((tier) => tier.label.toLowerCase()))

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {tiers.map((tier, index) => (
        <div
          key={tier.id}
          className={cn(
            'rounded-xl border border-line bg-surface p-3.5 shadow-xs',
            'transition-[border-color,box-shadow] duration-200 hover:border-line-strong',
          )}
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-2.5 hidden text-faint sm:block" aria-hidden="true">
              <GripVertical className="size-4" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Input
                  value={tier.label}
                  onChange={(event) => update(index, { label: event.target.value })}
                  placeholder="Tier name, e.g. Adult"
                  aria-label={`Tier ${index + 1} name`}
                  size="sm"
                  className="flex-1"
                  inputClassName="font-medium"
                  error={errors?.[`tiers.${index}.label`]}
                />
                {index === 0 ? (
                  <Badge size="sm" variant="primary">
                    Lead price
                  </Badge>
                ) : null}
              </div>
              {errors?.[`tiers.${index}.label`] ? (
                <p className="mt-1 text-xs font-medium text-danger">
                  {errors[`tiers.${index}.label`]}
                </p>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Field label="Price" labelSize="sm">
                  <MoneyInput
                    value={tier.price}
                    onValueChange={(price) => update(index, { price })}
                    currency={currency}
                    size="sm"
                    ariaLabel={`Price for ${tier.label || `tier ${index + 1}`}`}
                  />
                </Field>
                <Field label="Compare at" labelSize="sm">
                  <MoneyInput
                    value={tier.compareAtPrice ?? 0}
                    onValueChange={(price) =>
                      update(index, { compareAtPrice: price === 0 ? null : price })
                    }
                    currency={currency}
                    size="sm"
                    allowEmpty
                    placeholder="Optional"
                    ariaLabel={`Compare-at price for ${tier.label || `tier ${index + 1}`}`}
                  />
                </Field>
                <Field label="Min qty" labelSize="sm">
                  <NumberField
                    value={tier.minQuantity}
                    onValueChange={(minQuantity) => update(index, { minQuantity })}
                    ariaLabel={`Minimum quantity for ${tier.label || `tier ${index + 1}`}`}
                  />
                </Field>
                <Field label="Max qty" labelSize="sm">
                  <NumberField
                    value={tier.maxQuantity}
                    onValueChange={(maxQuantity) => update(index, { maxQuantity })}
                    ariaLabel={`Maximum quantity for ${tier.label || `tier ${index + 1}`}`}
                  />
                </Field>
              </div>

              <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <Input
                  value={tier.description}
                  onChange={(event) => update(index, { description: event.target.value })}
                  placeholder="Short note shown under the tier (optional)"
                  aria-label={`Description for ${tier.label || `tier ${index + 1}`}`}
                  size="sm"
                  className="flex-1"
                />
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted">
                  <Switch
                    checked={tier.countsTowardCapacity}
                    onCheckedChange={(checked) => update(index, { countsTowardCapacity: checked })}
                    size="sm"
                    aria-label={`Count ${tier.label || `tier ${index + 1}`} toward capacity`}
                  />
                  Counts toward capacity
                </label>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-1">
              <SimpleTooltip label="Move up">
                <IconButton
                  type="button"
                  aria-label={`Move ${tier.label || `tier ${index + 1}`} up`}
                  size="xs"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp />
                </IconButton>
              </SimpleTooltip>
              <SimpleTooltip label="Move down">
                <IconButton
                  type="button"
                  aria-label={`Move ${tier.label || `tier ${index + 1}`} down`}
                  size="xs"
                  variant="ghost"
                  disabled={index === tiers.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown />
                </IconButton>
              </SimpleTooltip>
              <SimpleTooltip label="Remove tier">
                <IconButton
                  type="button"
                  aria-label={`Remove ${tier.label || `tier ${index + 1}`}`}
                  size="xs"
                  variant="ghost"
                  className="text-danger hover:bg-danger-soft"
                  disabled={tiers.length === 1}
                  onClick={() => onChange(tiers.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </IconButton>
              </SimpleTooltip>
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={<Plus />}
          onClick={() => onChange([...tiers, blankTier()])}
        >
          Add tier
        </Button>
        <span className="text-xs text-faint">or start from</span>
        {TIER_PRESETS.filter((preset) => !usedPresets.has(preset.label.toLowerCase())).map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => {
              const tier = blankTier(preset.label, preset.price)
              tier.description = preset.description
              tier.countsTowardCapacity = preset.counts ?? true
              onChange([...tiers, tier])
            }}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1',
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
   The exact arithmetic the storefront will run, shown while the operator edits.
   ========================================================================== */

export interface GuestPricePreviewProps {
  tiers: DraftTier[]
  addOns: DraftAddOn[]
  currency: CurrencyCode
  className?: string
}

export function GuestPricePreview({ tiers, addOns, currency, className }: GuestPricePreviewProps) {
  const priced = tiers.filter((tier) => tier.label.trim().length > 0)
  // A representative cart: two of the lead tier, one of the next.
  const sample = priced.map((tier, index) => ({
    tier,
    quantity: index === 0 ? 2 : index === 1 ? 1 : 0,
  }))
  const requiredAddOns = addOns.filter((addOn) => addOn.required && addOn.label.trim().length > 0)

  const ticketTotal = sample.reduce((acc, row) => acc + row.tier.price * row.quantity, 0)
  const guests = sample.reduce(
    (acc, row) => acc + (row.tier.countsTowardCapacity ? row.quantity : 0),
    0,
  )
  const addOnTotal = requiredAddOns.reduce((acc, addOn) => acc + addOn.price * Math.max(guests, 1), 0)
  const total = ticketTotal + addOnTotal
  const fromPrice = priced.length === 0 ? 0 : Math.min(...priced.map((tier) => tier.price || 0))
  const compareAt = priced.find((tier) => tier.compareAtPrice)?.compareAtPrice ?? null

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
        <span className="font-display text-2xl font-semibold">
          {formatCurrency(fromPrice, currency)}
        </span>
        {compareAt && compareAt > fromPrice ? (
          <span className="text-sm text-faint line-through">
            {formatCurrency(compareAt, currency)}
          </span>
        ) : null}
        <span className="text-xs text-muted">per guest, from</span>
      </div>

      <ul className="mt-3 flex list-none flex-col gap-1.5 p-0 text-sm">
        {sample.map(({ tier, quantity }) => (
          <li
            key={tier.id}
            className={cn(
              'flex items-baseline justify-between gap-3',
              quantity === 0 && 'text-faint',
            )}
          >
            <span className="min-w-0 truncate">
              <span className="tabular">{quantity} ×</span> {tier.label}
            </span>
            <span className="shrink-0 tabular">
              {formatCurrency(tier.price * quantity, currency)}
            </span>
          </li>
        ))}
        {requiredAddOns.map((addOn) => (
          <li key={addOn.id} className="flex items-baseline justify-between gap-3 text-muted">
            <span className="min-w-0 truncate">
              {addOn.label} <span className="text-faint">(required)</span>
            </span>
            <span className="shrink-0 tabular">
              {formatCurrency(addOn.price * Math.max(guests, 1), currency)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="size-3.5 text-faint" aria-hidden="true" />
          {guests} {guests === 1 ? 'guest' : 'guests'}
        </span>
        <span className="font-display text-lg font-semibold tabular">
          {formatCurrency(total, currency)}
        </span>
      </div>
    </div>
  )
}
