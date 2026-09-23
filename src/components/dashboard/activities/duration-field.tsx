'use client'

import * as React from 'react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatDuration, pluralize } from '@/lib/utils'

/* ==========================================================================
   Duration: typed in minutes, hours or days, stored in minutes, with a row
   of common lengths underneath. Shared by trips and lessons.
   ========================================================================== */

export type DurationUnit = 'minutes' | 'hours' | 'days'

export const DURATION_UNITS: { value: DurationUnit; label: string; factor: number; placeholder: string }[] = [
  { value: 'minutes', label: 'minutes', factor: 1, placeholder: '90' },
  { value: 'hours', label: 'hours', factor: 60, placeholder: '2' },
  { value: 'days', label: 'days', factor: 1440, placeholder: '3' },
]

export const unitFor = (minutes: number): DurationUnit =>
  minutes > 0 && minutes % 1440 === 0 ? 'days' : minutes > 0 && minutes % 60 === 0 ? 'hours' : 'minutes'

function typed(minutes: number, unit: DurationUnit): string {
  if (minutes <= 0) return ''
  const factor = DURATION_UNITS.find((entry) => entry.value === unit)?.factor ?? 1
  return String(Math.round((minutes / factor) * 100) / 100)
}

const presetLabel = (minutes: number) =>
  minutes >= 1440 ? `${minutes / 1440} ${pluralize(minutes / 1440, 'day')}` : formatDuration(minutes)

export function DurationField({
  label = 'Duration',
  description,
  error,
  minutes,
  unit,
  onChange,
  presets = [60, 90, 120, 180, 240, 480, 1440, 4320],
  allowFlexible = true,
}: {
  label?: string
  description?: string
  error?: string
  minutes: number
  unit: DurationUnit
  onChange: (minutes: number, unit: DurationUnit) => void
  presets?: number[]
  /** Offer "Flexible" (0 minutes) for open-ended trips. */
  allowFlexible?: boolean
}) {
  const factor = DURATION_UNITS.find((entry) => entry.value === unit)?.factor ?? 1
  const chip = (on: boolean) =>
    cn(
      'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200',
      on ? 'border-primary/50 bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:text-foreground',
    )
  return (
    <Field label={label} error={error} description={description}>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            step={unit === 'minutes' ? 15 : 0.5}
            value={typed(minutes, unit)}
            placeholder={allowFlexible ? 'Flexible' : DURATION_UNITS.find((entry) => entry.value === unit)?.placeholder}
            className="flex-1"
            aria-label={label}
            onChange={(event) => {
              const amount = Number.parseFloat(event.target.value)
              onChange(Number.isFinite(amount) && amount > 0 ? Math.round(amount * factor) : 0, unit)
            }}
          />
          <Select value={unit} onValueChange={(value) => onChange(minutes, value as DurationUnit)}>
            <SelectTrigger className="w-32 shrink-0" aria-label={`${label} unit`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_UNITS.map((entry) => (
                <SelectItem key={entry.value} value={entry.value}>
                  {entry.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {allowFlexible ? (
            <button type="button" onClick={() => onChange(0, unit)} className={chip(minutes === 0)}>
              Flexible
            </button>
          ) : null}
          {presets.map((value) => (
            <button key={value} type="button" onClick={() => onChange(value, unitFor(value))} className={chip(minutes === value)}>
              {presetLabel(value)}
            </button>
          ))}
        </div>
      </div>
    </Field>
  )
}
