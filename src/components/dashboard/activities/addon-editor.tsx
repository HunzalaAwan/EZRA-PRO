'use client'

import * as React from 'react'
import { Camera, Car, Gift, Plus, Sandwich, ShoppingBag, Trash2, Waves } from 'lucide-react'

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
  /** Charged once for each guest, or once for the booking. */
  per: 'guest' | 'booking'
  required: boolean
  icon?: string
}

let addOnCounter = 0

export function blankAddOn(label = '', price = 0): DraftAddOn {
  addOnCounter += 1
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
  icon: typeof Camera
}

const ADDON_PRESETS: AddOnPreset[] = [
  {
    label: 'Photo package',
    price: 4500,
    description: 'Edited gallery delivered the same evening.',
    per: 'booking',
    icon: Camera,
  },
  {
    label: 'Hotel pickup',
    price: 2500,
    description: 'Air-conditioned transfer from anywhere in the resort strip.',
    per: 'guest',
    icon: Car,
  },
  {
    label: 'Lunch & drinks',
    price: 3200,
    description: 'A light lunch and cold drinks.',
    per: 'guest',
    icon: Sandwich,
  },
  {
    label: 'Wetsuit hire',
    price: 1500,
    description: 'Full-length 3mm suit, sized at the dock.',
    per: 'guest',
    icon: Waves,
  },
  {
    label: 'Gift wrap',
    price: 900,
    description: 'Printed voucher in a keepsake envelope.',
    per: 'booking',
    icon: Gift,
  },
]

/* ==========================================================================
   EDITOR
   ========================================================================== */

export interface AddonEditorProps {
  addOns: DraftAddOn[]
  onChange: (addOns: DraftAddOn[]) => void
  currency: CurrencyCode
  errors?: Record<string, string>
  /** One-click starting points; defaults to the tour-operator set. */
  presets?: AddOnPreset[]
  className?: string
}

export function AddonEditor({ addOns, onChange, currency, errors, presets = ADDON_PRESETS, className }: AddonEditorProps) {
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
          <p className="mt-2.5 text-sm font-semibold">No add-ons yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            Add-ons are offered after the guest picks a time slot. One well-chosen extra typically lifts
            average booking value by around 12%.
          </p>
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
                    placeholder="Extra, e.g. Photo package"
                    aria-label={`Add-on ${index + 1} name`}
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
                      ariaLabel={`Price for ${addOn.label || `add-on ${index + 1}`}`}
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
                  aria-label={`Description for ${addOn.label || `add-on ${index + 1}`}`}
                  size="sm"
                  className="mt-2.5"
                />

                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2.5">
                  <div
                    role="radiogroup"
                    aria-label={`How ${addOn.label || `add-on ${index + 1}`} is charged`}
                    className="inline-flex h-8 items-center rounded-lg border border-line bg-surface-sunken p-0.5"
                  >
                    {([
                      ['guest', 'Per guest'],
                      ['booking', 'Per booking'],
                    ] as const).map(([per, label]) => {
                      const on = addOn.per === per
                      return (
                        <button
                          key={per}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => update(index, { per })}
                          className={cn('h-full rounded-md px-2.5 text-xs font-medium transition-colors', on ? 'bg-surface text-foreground shadow-xs' : 'text-muted hover:text-foreground')}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                  <span className="text-xs text-subtle">
                    {addOn.per === 'booking' ? 'Charged once, whatever the group size.' : 'Charged for every guest on the booking.'}
                  </span>

                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                    <Switch
                      size="sm"
                      checked={addOn.required}
                      onCheckedChange={(checked) => update(index, { required: checked })}
                      aria-label={`Require ${addOn.label || `add-on ${index + 1}`}`}
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
                  aria-label={`Remove ${addOn.label || `add-on ${index + 1}`}`}
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
          onClick={() => onChange([...addOns, blankAddOn()])}
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
                const addOn = blankAddOn(preset.label, preset.price)
                addOn.description = preset.description
                addOn.per = preset.per ?? 'guest'
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
