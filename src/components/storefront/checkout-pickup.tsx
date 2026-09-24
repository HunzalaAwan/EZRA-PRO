'use client'

import * as React from 'react'
import { Bus, MapPin } from 'lucide-react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCurrency, formatTime } from '@/lib/utils'
import type { CurrencyCode, PickupZone } from '@/types'

/* ==========================================================================
   Checkout — hotel pickup. Meet at the harbour, or pick a zone and a hotel
   and see the pickup time and the fee straight away.
   ========================================================================== */

export interface PickupChoice {
  mode: 'meet' | 'pickup'
  zoneId: string
  stop: string
  other: string
}

export const EMPTY_PICKUP: PickupChoice = { mode: 'meet', zoneId: '', stop: '', other: '' }

const OTHER = '__other__'

export function pickupTime(startsAt: string, zone: PickupZone | undefined): string | null {
  if (!zone) return null
  const d = new Date(new Date(startsAt).getTime() - zone.offsetMinutes * 60_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

export function validatePickup(choice: PickupChoice, required: boolean): Record<string, string> {
  const errors: Record<string, string> = {}
  if (choice.mode === 'meet' && !required) return errors
  if (!choice.zoneId) errors['pickup.zone'] = 'Pick your area'
  if (!choice.stop || (choice.stop === OTHER && choice.other.trim().length < 4)) errors['pickup.stop'] = 'Tell us where to collect you'
  return errors
}

export function CheckoutPickup({
  zones,
  required,
  meetingPoint,
  startsAt,
  guests,
  currency,
  choice,
  setChoice,
  errors,
}: {
  zones: PickupZone[]
  required: boolean
  meetingPoint: string
  startsAt: string
  guests: number
  currency: CurrencyCode
  choice: PickupChoice
  setChoice: React.Dispatch<React.SetStateAction<PickupChoice>>
  errors: Record<string, string>
}) {
  const zone = zones.find((entry) => entry.id === choice.zoneId)
  const time = pickupTime(startsAt, zone)
  const mode = required ? 'pickup' : choice.mode

  const card = (value: PickupChoice['mode'], title: string, detail: string, Icon: typeof Bus) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      onClick={() => setChoice((current) => ({ ...current, mode: value }))}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
        mode === value ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong',
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', mode === value ? 'text-primary' : 'text-faint')} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-subtle">{detail}</span>
      </span>
    </button>
  )

  return (
    <section aria-labelledby="step-pickup" className="space-y-5">
      <div>
        <h2 id="step-pickup" className="font-display text-xl font-semibold tracking-tight">
          Getting there
        </h2>
        <p className="mt-1.5 text-sm text-muted">{required ? 'This trip collects every guest from their hotel.' : 'Meet us there, or let the shuttle collect you.'}</p>
      </div>

      {required ? null : (
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="How you get there">
          {card('meet', 'I will meet you there', meetingPoint.split(' — ')[0], MapPin)}
          {card('pickup', 'Pick me up', 'From your hotel, in the zones below', Bus)}
        </div>
      )}

      {mode === 'pickup' ? (
        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5">
          <Field label="Area" required error={errors['pickup.zone']}>
            {(control) => (
              <Select value={choice.zoneId || undefined} onValueChange={(value) => setChoice((current) => ({ ...current, zoneId: value, stop: '' }))}>
                <SelectTrigger id={control.id} aria-invalid={control['aria-invalid']}>
                  <SelectValue placeholder="Choose your area" />
                </SelectTrigger>
                <SelectContent>
                  {zones.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id} description={entry.fee > 0 ? `${formatCurrency(entry.fee, currency)} per ${entry.feePer === 'booking' ? 'booking' : 'guest'}` : 'Free pickup'}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <Field label="Hotel or address" required error={errors['pickup.stop']}>
            {(control) => (
              <Select value={choice.stop || undefined} onValueChange={(value) => setChoice((current) => ({ ...current, stop: value }))} disabled={!zone}>
                <SelectTrigger id={control.id} aria-invalid={control['aria-invalid']}>
                  <SelectValue placeholder={zone ? 'Choose your hotel' : 'Pick an area first'} />
                </SelectTrigger>
                <SelectContent>
                  {(zone?.stops ?? []).map((stop) => (
                    <SelectItem key={stop} value={stop}>
                      {stop}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER}>Somewhere else in this area</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Field>
          {choice.stop === OTHER ? (
            <Field label="Address" required className="sm:col-span-2">
              {(control) => <Input {...control} value={choice.other} onChange={(e) => setChoice((current) => ({ ...current, other: e.target.value }))} placeholder="Street and number, or the condo name" />}
            </Field>
          ) : null}
          {zone && time ? (
            <p className="rounded-xl bg-surface-sunken px-3.5 py-2.5 text-sm text-foreground sm:col-span-2">
              Pickup at <span className="font-semibold tabular-nums">{formatTime(time)}</span> from the lobby
              {zone.fee > 0 ? (
                <span className="text-muted">
                  {' '}· {zone.feePer === 'booking' ? `${formatCurrency(zone.fee, currency)} for your group` : `${formatCurrency(zone.fee * guests, currency)} for ${guests} ${guests === 1 ? 'guest' : 'guests'}`}, added to your total
                </span>
              ) : (
                <span className="text-muted"> · included</span>
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export { OTHER as PICKUP_OTHER }
