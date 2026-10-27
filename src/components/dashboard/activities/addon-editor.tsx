'use client'

import * as React from 'react'
import { Baby, Backpack, Camera, Car, Clock, Gift, GlassWater, Luggage, MapPin, Plus, Sandwich, ShoppingBag, Trash2 } from 'lucide-react'

import type { CurrencyCode } from '@/types'
import { cn, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { MoneyInput } from './pricing-tier-editor'

/* ==========================================================================
   TYPES
   ========================================================================== */

export interface DraftAddOn {
  id: string
  label: string
  /** Minor units. */
  price: number
  description: string
  /** Charged once for each guest, once for the booking, or for each one the guest picks. */
  per: 'guest' | 'booking' | 'each'
  /** 'each': the most one booking can take. Absent: 9. */
  maxQty?: number
  required: boolean
  icon?: string
}

/** The most of an 'each' extra a booking can take, when none is set. */
export const EACH_DEFAULT_MAX = 9

let addOnCounter = 0

/** A new extra. Pass the extras already there: the counter starts over on every page load, and a saved edit can already hold "add_draft_1". */
export function blankAddOn(label = '', price = 0, taken: readonly { id: string }[] = []): DraftAddOn {
  addOnCounter += 1
  while (taken.some((addOn) => addOn.id === `add_draft_${addOnCounter}`)) addOnCounter += 1
  return {
    id: `add_draft_${addOnCounter}`,
    label,
    price,
    description: '',
    per: 'guest',
    required: false,
  }
}

export interface AddOnPreset {
  label: string
  price: number
  description: string
  /** Absent: per guest. */
  per?: DraftAddOn['per']
  /** 'each': the most a booking can take. */
  maxQty?: number
  icon: typeof Camera
}

/** Extras most businesses offer; each can be renamed or priced. */
const ADDON_PRESETS: AddOnPreset[] = [
  { label: 'Photos', price: 4500, description: 'Edited photos sent after.', per: 'booking', icon: Camera },
  { label: 'Pickup', price: 2500, description: 'From where you are staying.', per: 'guest', icon: Car },
  { label: 'Food & drinks', price: 3200, description: 'A light meal and drinks.', per: 'guest', icon: Sandwich },
  { label: 'Equipment', price: 1500, description: 'Ready when you arrive.', per: 'guest', icon: Backpack },
  { label: 'Gift wrap', price: 900, description: 'A printed voucher in an envelope.', per: 'booking', icon: Gift },
]

/** Extras a transfer usually sells; the ones guests pick a number of are charged each. */
export const TRANSFER_ADDON_PRESETS: AddOnPreset[] = [
  { label: 'Child seat', price: 1000, description: 'Tell us the ages.', per: 'each', maxQty: 3, icon: Baby },
  { label: 'Extra stop', price: 1500, description: 'A quick stop on the way.', per: 'each', maxQty: 2, icon: MapPin },
  { label: 'Extra waiting time (30 min)', price: 1500, description: 'Each 30 minutes past the free wait.', per: 'each', maxQty: 4, icon: Clock },
  { label: 'Oversized item', price: 1000, description: 'A surfboard, golf bag or bike.', per: 'each', maxQty: 3, icon: Luggage },
  { label: 'Welcome drinks', price: 2000, description: 'Cold drinks and water on board.', per: 'booking', icon: GlassWater },
]

const PER_CHOICES = [
  ['guest', 'Per guest'],
  ['booking', 'Per booking'],
  ['each', 'Each'],
] as const

const PER_HINT: Record<DraftAddOn['per'], string> = {
  guest: 'Charged for every guest on the booking.',
  booking: 'Charged once, whatever the group size.',
  each: 'Guests pick how many.',
}

/* ==========================================================================
   EDITOR
   ========================================================================== */

export interface AddonEditorProps {
  addOns: DraftAddOn[]
  onChange: (addOns: DraftAddOn[]) => void
  currency: CurrencyCode
  errors?: Record<string, string>
  /** One-click starting points; defaults to a set most businesses offer. */
  presets?: AddOnPreset[]
  /** "Each" (guests pick how many) is offered. Only where the storefront asks for a number: transfers. An extra already sold that way keeps it. */
  allowEach?: boolean
  className?: string
}

export function AddonEditor({ addOns, onChange, currency, errors, presets = ADDON_PRESETS, allowEach = false, className }: AddonEditorProps) {
  const update = (index: number, patch: Partial<DraftAddOn>) => {
    onChange(addOns.map((addOn, i) => (i === index ? { ...addOn, ...patch } : addOn)))
  }

  const used = new Set(addOns.map((addOn) => addOn.label.toLowerCase()))

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {addOns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface-sunken/40 px-4 py-6 text-center">
          <span className="mx-auto grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
            <ShoppingBag className="size-4.5" aria-hidden="true" />
          </span>
          <p className="mt-2.5 text-sm font-semibold">No extras yet</p>
        </div>
      ) : (
        addOns.map((addOn, index) => (
          <div
            key={addOn.id}
            className="rounded-xl border border-line bg-surface p-3.5 shadow-xs transition-[border-color] duration-200 hover:border-line-strong"
          >
            <div className="flex items-start gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <Input
                    value={addOn.label}
                    onChange={(event) => update(index, { label: event.target.value })}
                    placeholder="Extra, e.g. Photos"
                    aria-label={`Extra ${index + 1} name`}
                    size="sm"
                    className="flex-1"
                    inputClassName="font-medium"
                    error={errors?.[`addOns.${index}.label`]}
                  />
                  <div className="w-full sm:w-32">
                    <MoneyInput
                      value={addOn.price}
                      onValueChange={(price) => update(index, { price })}
                      currency={currency}
                      size="sm"
                      ariaLabel={`Price for ${addOn.label || `extra ${index + 1}`}`}
                    />
                  </div>
                </div>
                {errors?.[`addOns.${index}.label`] ? (
                  <p className="mt-1 text-xs font-medium text-danger">
                    {errors[`addOns.${index}.label`]}
                  </p>
                ) : null}

                <Input
                  value={addOn.description}
                  onChange={(event) => update(index, { description: event.target.value })}
                  placeholder="One line the guest reads at checkout"
                  aria-label={`Description for ${addOn.label || `extra ${index + 1}`}`}
                  size="sm"
                  className="mt-2.5"
                />

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2.5">
                  <div
                    role="radiogroup"
                    aria-label={`How ${addOn.label || `extra ${index + 1}`} is charged`}
                    className="inline-flex h-8 items-center rounded-lg border border-line bg-surface-sunken p-0.5"
                  >
                    {PER_CHOICES.filter(([per]) => per !== 'each' || allowEach || addOn.per === 'each').map(([per, label]) => {
                      const on = addOn.per === per
                      return (
                        <button
                          key={per}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => update(index, per === 'each' ? { per, maxQty: addOn.maxQty ?? EACH_DEFAULT_MAX } : { per })}
                          className={cn('h-full rounded-md px-2.5 text-xs font-medium transition-colors', on ? 'bg-surface text-foreground shadow-xs' : 'text-muted hover:text-foreground')}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  {addOn.per === 'each' ? (
                    <label className="inline-flex items-center gap-2 text-xs text-muted">
                      Most
                      <Input
                        type="number"
                        size="sm"
                        min={1}
                        max={20}
                        className="w-20"
                        inputClassName="tabular"
                        aria-label={`Most ${addOn.label || `of extra ${index + 1}`} per booking`}
                        value={addOn.maxQty ?? EACH_DEFAULT_MAX}
                        onChange={(event) => update(index, { maxQty: Math.min(20, Math.max(1, Math.floor(Number(event.target.value)) || 1)) })}
                      />
                    </label>
                  ) : null}
                  <span className="text-xs text-subtle">{PER_HINT[addOn.per] ?? PER_HINT.guest}</span>

                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                    <Switch
                      size="sm"
                      checked={addOn.required}
                      onCheckedChange={(checked) => update(index, { required: checked })}
                      aria-label={`Require ${addOn.label || `extra ${index + 1}`}`}
                    />
                    Required
                  </label>

                  {addOn.required ? (
                    <Badge size="sm" variant="warning">
                      Added to every booking
                    </Badge>
                  ) : null}
                </div>
              </div>

              <SimpleTooltip label="Remove extra">
                <IconButton
                  type="button"
                  aria-label={`Remove ${addOn.label || `extra ${index + 1}`}`}
                  size="xs"
                  variant="ghost"
                  className="shrink-0 text-danger hover:bg-danger-soft"
                  onClick={() => onChange(addOns.filter((_, i) => i !== index))}
                >
                  <Trash2 />
                </IconButton>
              </SimpleTooltip>
            </div>
          </div>
        ))
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leftIcon={<Plus />}
          onClick={() => onChange([...addOns, blankAddOn('', 0, addOns)])}
        >
          Add an extra
        </Button>
        {presets.filter((preset) => !used.has(preset.label.toLowerCase())).map((preset) => {
          const Icon = preset.icon
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                const addOn = blankAddOn(preset.label, preset.price, addOns)
                addOn.description = preset.description
                addOn.per = preset.per ?? 'guest'
                if (addOn.per === 'each') addOn.maxQty = preset.maxQty ?? EACH_DEFAULT_MAX
                onChange([...addOns, addOn])
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1',
                'text-xs font-medium text-muted transition-colors duration-200',
                'hover:border-accent/50 hover:bg-accent-soft/50 hover:text-accent',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              )}
            >
              <Icon className="size-3" aria-hidden="true" />
              {preset.label}
              <span className="text-faint">{formatCurrency(preset.price, currency)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
