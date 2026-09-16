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
  /** null = unlimited. */
  maxPerBooking: number | null
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
    maxPerBooking: 4,
    required: false,
  }
}

export interface AddOnPreset {
  label: string
  price: number
  description: string
  icon: typeof Camera
}

const ADDON_PRESETS: AddOnPreset[] = [
  {
    label: 'Photo package',
    price: 4500,
    description: 'Edited gallery delivered the same evening.',
    icon: Camera,
  },
  {
    label: 'Hotel pickup',
    price: 2500,
    description: 'Air-conditioned transfer from anywhere in the resort strip.',
    icon: Car,
  },
  {
    label: 'Lunch & drinks',
    price: 3200,
    description: 'Island plate, fruit and cold drinks on board.',
    icon: Sandwich,
  },
  {
    label: 'Wetsuit hire',
    price: 1500,
    description: 'Full-length 3mm suit, sized at the dock.',
    icon: Waves,
  },
  {
    label: 'Gift wrap',
    price: 900,
    description: 'Printed voucher in a keepsake envelope.',
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
  const attachRate = addOns.length === 0 ? 0 : Math.min(12 + addOns.length * 6, 34)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {addOns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong bg-surface-sunken/40 px-4 py-6 text-center">
          <span className="mx-auto grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
            <ShoppingBag className="size-4.5" aria-hidden="true" />
          </span>
          <p className="mt-2.5 text-sm font-semibold">No add-ons yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted">
            Add-ons are offered after the guest picks a time. One well-chosen extra typically lifts
            average order value by around 12%.
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
                    placeholder="Add-on name, e.g. Photo package"
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
                  <span className="flex items-center gap-2 text-xs text-muted">
                    Max per booking
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      size="sm"
                      className="w-20"
                      disabled={addOn.maxPerBooking === null}
                      value={addOn.maxPerBooking ?? 1}
                      aria-label={`Maximum per booking for ${addOn.label || `add-on ${index + 1}`}`}
                      onChange={(event) => {
                        const parsed = Number.parseInt(event.target.value, 10)
                        update(index, { maxPerBooking: Number.isFinite(parsed) ? parsed : 1 })
                      }}
                    />
                  </span>

                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                    <Switch
                      size="sm"
                      checked={addOn.maxPerBooking === null}
                      onCheckedChange={(checked) =>
                        update(index, { maxPerBooking: checked ? null : 4 })
                      }
                      aria-label={`No limit for ${addOn.label || `add-on ${index + 1}`}`}
                    />
                    No limit
                  </label>

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

              <SimpleTooltip label="Remove add-on">
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
          Add an add-on
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

      {addOns.length > 0 ? (
        <p className="text-xs text-faint">
          Projected attach rate ≈ {attachRate}% of bookings, based on operators selling a comparable
          mix.
        </p>
      ) : null}
    </div>
  )
}
