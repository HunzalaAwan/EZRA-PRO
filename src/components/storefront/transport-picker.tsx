'use client'

import * as React from 'react'
import { Bus, MapPin } from 'lucide-react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCurrency, formatTime } from '@/lib/utils'
import {
  TRIP_WORDS,
  collects,
  drops,
  fareOf,
  fareWords,
  guestOptions,
  needsDropOffPoint,
  needsPlace,
  plusMinutes,
  searchPoints,
  type TransportChoice,
  type TransportSetup,
} from '@/lib/transport'
import type { CurrencyCode, PickupZone, TransportTrip } from '@/types'

/* ==========================================================================
   Getting there — the guest's transport choice, in the booking widget, at
   checkout and on the manage page: meet there or a trip (only what is
   offered), where to be collected (a search over the pickup zones and their
   hotels), where to be dropped, and the times and price that follow.
   ========================================================================== */

/** What the choice adds, in words: "Included", "Free", "$40 for 2 guests", "$45 for your group". */
export function transportPriceWords(setup: TransportSetup, choice: TransportChoice, guests: number, currency: CurrencyCode): string {
  if (choice.trip === 'meet') return ''
  if (setup.mode === 'included') return 'Included'
  const zoneId = choice.trip === 'dropoff' && setup.dropOffs.length > 0 ? undefined : choice.zoneId || undefined
  const unit = fareOf(setup, zoneId, choice.trip)
  if (unit === 0) return 'Free'
  return setup.charge === 'booking' ? `${formatCurrency(unit, currency)} for your group` : `${formatCurrency(unit * guests, currency)} for ${guests} ${guests === 1 ? 'guest' : 'guests'}`
}

export function TransportPicker({
  setup,
  zones,
  value,
  onChange,
  currency,
  startsAt,
  endsAt,
  guests,
  meetingPoint,
  errors = {},
  idPrefix = 'transport',
  wide = false,
}: {
  setup: TransportSetup
  /** The pickup zones this activity serves, as the business has them now. */
  zones: PickupZone[]
  value: TransportChoice
  onChange: (next: TransportChoice) => void
  currency: CurrencyCode
  /** The time slot, for the pickup and drop-off times. Empty: no time picked yet. */
  startsAt?: string
  endsAt?: string
  guests: number
  meetingPoint: string
  errors?: Record<string, string>
  idPrefix?: string
  /** Two columns from small screens up (checkout); the widget stacks. */
  wide?: boolean
}) {
  const options = guestOptions(setup)
  const zone = zones.find((entry) => entry.id === value.zoneId)
  const zoneIds = zones.map((entry) => entry.id)
  const trip = value.trip
  const pick = (next: TransportTrip | 'meet') => onChange({ ...value, trip: next, dropOffId: needsDropOffPoint(setup, next) ? value.dropOffId : '' })
  const point = setup.dropOffs.find((entry) => entry.id === value.dropOffId)
  const pickupAt = startsAt && zone && collects(trip) ? plusMinutes(startsAt, -zone.offsetMinutes) : ''
  const dropAt = endsAt && drops(trip) ? (point ? plusMinutes(endsAt, point.afterMinutes) : zone ? plusMinutes(endsAt, zone.offsetMinutes) : '') : ''
  const priceWords = transportPriceWords(setup, value, guests, currency)

  return (
    <div className="flex flex-col gap-3">
      {setup.mode === 'included' ? (
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Bus className="size-4 shrink-0 text-primary" aria-hidden="true" />
          {TRIP_WORDS[setup.trips[0]]} included
        </p>
      ) : options.length > 1 ? (
        <div className={cn('grid gap-2', wide && 'sm:grid-cols-2')} role="radiogroup" aria-label="Getting there">
          {options.map((option) => {
            const on = trip === option
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pick(option)}
                className={cn(
                  'flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  on ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong',
                )}
              >
                {option === 'meet' ? (
                  <MapPin className={cn('mt-0.5 size-4 shrink-0', on ? 'text-primary' : 'text-faint')} aria-hidden="true" />
                ) : (
                  <Bus className={cn('mt-0.5 size-4 shrink-0', on ? 'text-primary' : 'text-faint')} aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{TRIP_WORDS[option]}</span>
                    {option === 'meet' ? null : (
                      <span className="shrink-0 text-xs font-semibold text-foreground tabular">{fareWords(setup, option, currency, on && zone && !(option === 'dropoff' && setup.dropOffs.length > 0) ? zone.id : undefined, zoneIds)}</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-subtle">
                    {option === 'meet' ? meetingPoint.split(' — ')[0] : option === 'pickup' ? 'Before the start' : option === 'dropoff' ? 'After the end' : 'There and back'}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      {trip !== 'meet' ? (
        <div className={cn('grid grid-cols-1 gap-3', wide && 'rounded-2xl border border-line bg-surface p-4 sm:grid-cols-2 sm:p-5')}>
          {needsPlace(setup, trip) ? (
            <PointSearch
              id={`${idPrefix}-place`}
              label={collects(trip) ? 'Pickup point' : 'Drop-off point'}
              zones={zones}
              zoneId={value.zoneId}
              stop={value.stop}
              error={errors['transport.place']}
              onPick={(zoneId, stop) => onChange({ ...value, zoneId, stop })}
              onStop={(stop) => onChange({ ...value, stop })}
            />
          ) : null}
          {needsDropOffPoint(setup, trip) ? (
            <Field label="Drop-off point" required error={errors['transport.dropOff']}>
              {(control) => (
                <Select value={value.dropOffId || undefined} onValueChange={(dropOffId) => onChange({ ...value, dropOffId })}>
                  <SelectTrigger id={control.id} aria-invalid={control['aria-invalid']}>
                    <SelectValue placeholder="Choose where to be dropped" />
                  </SelectTrigger>
                  <SelectContent>
                    {setup.dropOffs.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id} description={endsAt ? `About ${formatTime(plusMinutes(endsAt, entry.afterMinutes))}` : `${entry.afterMinutes} min after the end`}>
                        {entry.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          ) : null}
          {pickupAt || dropAt || priceWords ? (
            <ul className={cn('flex list-none flex-col gap-1 rounded-xl bg-surface-sunken px-3.5 py-2.5 text-sm text-foreground', wide && 'sm:col-span-2')} aria-live="polite">
              {pickupAt ? (
                <li>
                  Pickup <span className="font-semibold tabular">{formatTime(pickupAt)}</span>
                  <span className="text-muted"> · {value.stop.trim() || zone?.name}</span>
                </li>
              ) : null}
              {dropAt ? (
                <li>
                  Drop-off about <span className="font-semibold tabular">{formatTime(dropAt)}</span>
                  <span className="text-muted"> · {point ? point.name : value.stop.trim() || zone?.name}</span>
                </li>
              ) : null}
              {priceWords ? <li className="text-muted">{priceWords}</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* ---------- a search box over the pickup zones and their hotels ---------- */

function PointSearch({
  id,
  label,
  zones,
  zoneId,
  stop,
  error,
  onPick,
  onStop,
}: {
  id: string
  label: string
  zones: PickupZone[]
  zoneId: string
  stop: string
  error?: string
  onPick: (zoneId: string, stop: string) => void
  onStop: (stop: string) => void
}) {
  const zone = zones.find((entry) => entry.id === zoneId)
  const shown = stop || zone?.name || ''
  const [query, setQuery] = React.useState(shown)
  const [open, setOpen] = React.useState(false)
  const [active, setActive] = React.useState(0)
  // A pick from outside (a link, the saved booking) shows in the box.
  React.useEffect(() => {
    setQuery(shown)
  }, [shown])
  const typed = query === shown ? '' : query
  const rows = React.useMemo(() => {
    const found = searchPoints(zones, typed, 8)
    return found.length > 0 ? found : searchPoints(zones, '', 8)
  }, [zones, typed])
  const nothing = typed.trim() !== '' && searchPoints(zones, typed, 1).length === 0
  const listId = `${id}-list`
  const choose = (index: number) => {
    const row = rows[index]
    if (!row) return
    // A hotel picked is the stop; an area picked keeps what was typed as the address (or asks for it).
    const words = typed.trim()
    const next = row.stop ?? (words && !row.zone.name.toLowerCase().includes(words.toLowerCase()) ? words : '')
    onPick(row.zone.id, next)
    setQuery(next || row.zone.name)
    setOpen(false)
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <label htmlFor={id} className="text-[0.8125rem] font-medium text-foreground">
          {label}
        </label>
        <Input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && rows[active] ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          autoComplete="off"
          className="mt-1.5"
          leftIcon={<MapPin />}
          placeholder="Hotel name or area"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
              setActive((index) => Math.min(rows.length - 1, index + 1))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((index) => Math.max(0, index - 1))
            } else if (event.key === 'Enter' && open) {
              event.preventDefault()
              choose(active)
            } else if (event.key === 'Escape') {
              setOpen(false)
            }
          }}
        />
        {zone && !open ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-subtle">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              <span className="font-semibold text-foreground">{zone.name}</span>
              {stop ? ` · ${stop}` : ''}
            </span>
          </p>
        ) : null}
        {error ? (
          <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-danger">
            {error}
          </p>
        ) : null}
        {open ? (
          <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            {nothing ? <p className="border-b border-line-subtle px-3.5 py-2.5 text-xs text-subtle">Not on the list? Pick the nearest area and add your address.</p> : null}
            <ul id={listId} role="listbox" aria-label={label} className="max-h-72 list-none overflow-y-auto p-1">
              {rows.map((row, index) => (
                <li
                  key={`${row.zone.id}|${row.stop ?? ''}`}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                  className={cn('cursor-pointer rounded-lg px-2.5 py-2', index === active ? 'bg-surface-sunken' : '')}
                >
                  <span className="block text-sm font-semibold text-foreground">{row.stop ?? row.zone.name}</span>
                  <span className="block truncate text-xs text-subtle">{row.stop ? row.zone.name : 'Somewhere else in this area'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
      {zone && !zone.stops.includes(stop) && !open ? (
        <Field label="Hotel or address" required>
          <Input value={stop} onChange={(event) => onStop(event.target.value)} placeholder="Street and number, or the condo name" />
        </Field>
      ) : null}
    </div>
  )
}
