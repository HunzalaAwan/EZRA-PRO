'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, Info, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn, formatCurrency, formatDuration } from '@/lib/utils'
import type { CurrencyCode, PackageConfig, PackagePart } from '@/types'

/* ==========================================================================
   What's in the package — pick the activities it is made of, the times
   guests can choose for each, and where each one runs. Seats, prices on
   their own and schedules all come from those activities, so a package
   never needs a schedule or a seat count of its own.
   ========================================================================== */

export interface PackageOption {
  id: string
  name: string
  durationMinutes: number
  maxCapacity: number
  basePrice: number
  /** Every start time it runs at, "HH:mm", across its locations. */
  times: string[]
  locations: { id: string; name: string }[]
}

export const EMPTY_PACKAGE: PackageConfig = { parts: [], gapMinutes: 30, sameDay: true, withinDays: 2 }

const clockLabel = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function packageSeats(config: PackageConfig, options: PackageOption[]) {
  const caps = config.parts.map((part) => options.find((option) => option.id === part.activityId)?.maxCapacity ?? 0).filter((cap) => cap > 0)
  return caps.length > 0 ? Math.min(...caps) : 0
}

export function packageApartPrice(config: PackageConfig, options: PackageOption[]) {
  return config.parts.reduce((sum, part) => sum + (options.find((option) => option.id === part.activityId)?.basePrice ?? 0), 0)
}

export function PackagePartsEditor({
  value,
  onChange,
  options,
  currency,
  error,
}: {
  value: PackageConfig
  onChange: (next: PackageConfig) => void
  options: PackageOption[]
  currency: CurrencyCode
  error?: string
}) {
  const set = (patch: Partial<PackageConfig>) => onChange({ ...value, ...patch })
  const setPart = (index: number, patch: Partial<PackagePart>) => set({ parts: value.parts.map((part, at) => (at === index ? { ...part, ...patch } : part)) })
  const move = (index: number, by: number) => {
    const parts = [...value.parts]
    const [item] = parts.splice(index, 1)
    parts.splice(index + by, 0, item)
    set({ parts })
  }
  const unused = options.filter((option) => !value.parts.some((part) => part.activityId === option.id))
  const seats = packageSeats(value, options)
  const apart = packageApartPrice(value, options)

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line p-4">
      <div>
        <h3 className="text-sm font-semibold">What&rsquo;s in the package</h3>
        <p className="mt-0.5 text-xs text-subtle">
          Pick two or more of your activities. Each booking takes a place on every one of them, so they can never be oversold when they are also sold on their own.
        </p>
      </div>

      <ol className="flex list-none flex-col gap-3 p-0">
        {value.parts.map((part, index) => {
          const option = options.find((entry) => entry.id === part.activityId)
          return (
            <li key={`${part.activityId}-${index}`} className="rounded-xl border border-line-subtle bg-surface-sunken/40 p-3.5">
              <div className="flex items-end gap-2">
                <span className="mb-2 grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary tabular">{index + 1}</span>
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                  <Field label="Activity" labelSize="sm">
                    {({ id }) => (
                      <Select value={part.activityId} onValueChange={(activityId) => setPart(index, { activityId, times: [], locationId: undefined })}>
                        <SelectTrigger id={id}>
                          <SelectValue placeholder="Pick an activity" />
                        </SelectTrigger>
                        <SelectContent>
                          {[...(option ? [option] : []), ...unused].map((entry) => (
                            <SelectItem key={entry.id} value={entry.id} description={`${formatDuration(entry.durationMinutes)} · ${formatCurrency(entry.basePrice, currency)} alone`}>
                              {entry.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Field>
                  <Field label="Name in the package" labelSize="sm" optional>
                    {(control) => <Input {...control} placeholder={option?.name ?? 'Beach ride'} value={part.label ?? ''} onChange={(event) => setPart(index, { label: event.target.value })} />}
                  </Field>
                </div>
                <div className="mb-0.5 flex shrink-0 items-center gap-0.5">
                  <IconButton type="button" size="sm" variant="ghost" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowUp aria-hidden="true" />
                  </IconButton>
                  <IconButton type="button" size="sm" variant="ghost" aria-label="Move down" disabled={index === value.parts.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDown aria-hidden="true" />
                  </IconButton>
                  <IconButton type="button" size="sm" variant="ghost" aria-label="Remove" onClick={() => set({ parts: value.parts.filter((_, at) => at !== index) })}>
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </div>
              </div>

              {option ? (
                <div className="mt-3 flex flex-col gap-3 pl-8">
                  <div>
                    <p className="text-[0.8125rem] font-medium">Times guests can pick</p>
                    <p className="text-xs text-subtle">None picked: any time it runs that day.</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {option.times.map((time) => {
                        const on = part.times.includes(time)
                        return (
                          <button
                            key={time}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setPart(index, { times: on ? part.times.filter((entry) => entry !== time) : [...part.times, time].sort() })}
                            className={cn('rounded-lg border px-2.5 py-1 text-xs font-medium tabular transition-colors', on ? 'border-primary bg-primary text-on-primary' : 'border-line text-muted hover:border-line-strong')}
                          >
                            {clockLabel(time)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {option.locations.length > 1 ? (
                    <Field label="Where" labelSize="sm" className="sm:max-w-xs">
                      {({ id }) => (
                        <Select value={part.locationId ?? 'any'} onValueChange={(next) => setPart(index, { locationId: next === 'any' ? undefined : next })}>
                          <SelectTrigger id={id}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any of its locations</SelectItem>
                            {option.locations.map((site) => (
                              <SelectItem key={site.id} value={site.id}>
                                {site.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </Field>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>

      {unused.length > 0 ? (
        <Button type="button" variant="secondary" size="sm" leftIcon={<Plus />} className="self-start" onClick={() => set({ parts: [...value.parts, { activityId: unused[0].id, times: [] }] })}>
          Add an activity
        </Button>
      ) : null}
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}

      <div className="grid gap-4 border-t border-line-subtle pt-4 sm:grid-cols-2">
        <Field label="Time between parts" description="Travel, changing, a meal. Times closer than this are not offered together.">
          {(control) => <Input {...control} type="number" min={0} step={15} suffix="minutes" value={value.gapMinutes} onChange={(event) => set({ gapMinutes: Math.max(0, Math.floor(Number(event.target.value)) || 0) })} />}
        </Field>
        <div className="flex flex-col gap-2">
          <label className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">All on one day</span>
              <span className="block text-xs text-subtle">Off: guests can spread the parts over a few days.</span>
            </span>
            <Switch checked={value.sameDay} onCheckedChange={(sameDay) => set({ sameDay })} aria-label="All on one day" />
          </label>
          {value.sameDay ? null : (
            <Field label="Within" labelSize="sm">
              {(control) => <Input {...control} type="number" min={2} max={14} suffix="days" className="sm:w-40" value={value.withinDays} onChange={(event) => set({ withinDays: Math.min(14, Math.max(2, Math.floor(Number(event.target.value)) || 2)) })} />}
            </Field>
          )}
        </div>
      </div>

      {value.parts.length >= 2 ? (
        <p className="flex items-start gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-xs text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0 text-info" aria-hidden="true" />
          Up to {seats} people per booking, the size of the smallest part. Booked apart, these cost {formatCurrency(apart, currency)} per person; set the package price on the Pricing step.
        </p>
      ) : null}
    </section>
  )
}
