'use client'

import * as React from 'react'
import Link from 'next/link'
import { Plus, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { TRANSPORT_TRIPS, TRIP_WORDS, cleanDropOffs, transportOf, transportSummary } from '@/lib/transport'
import type { ActivityPickup, CurrencyCode, DropOffPoint, PickupPrice, TransportCharge, TransportFare, TransportTrip } from '@/types'

/* ==========================================================================
   Transport for one activity, on the Guests step: none, included (every
   guest is collected) or optional (guests add it). The pickup points (the
   business's pickup zones), the trips (pickup, drop-off, both ways), where
   guests are dropped (back at the pickup point, or the activity's own
   drop-off points) and, when optional, the price: free, per guest or per
   booking, one way and both ways, optionally different per pickup point.
   ========================================================================== */

export interface PickupZoneOption {
  id: string
  name: string
  detail: string
  /** The zone's own fee per guest, minor units; the starting price here. */
  fee: number
}

export interface DraftPickup {
  /** Transport is on. Pick up (on Where guests go) turns it on too. */
  enabled: boolean
  zoneIds: string[]
  required: boolean
  /** Older drafts: price per zone, pickup only. Read once into `zoneFares`. */
  prices?: Record<string, PickupPrice>
  mode?: 'included' | 'optional'
  trips?: TransportTrip[]
  /** Drop guests at these points, not back at their pickup point. */
  ownDropOffs?: boolean
  dropOffs?: DropOffPoint[]
  charge?: TransportCharge
  fare?: TransportFare
  /** The price table by pickup point is open. */
  perZone?: boolean
  zoneFares?: Record<string, TransportFare>
}

export const NO_PICKUP: DraftPickup = { enabled: false, zoneIds: [], required: false }

/** The editor's draft of an activity's transport (an older save opens with its zone prices in the table). */
export function draftOfPickup(pickup: ActivityPickup | undefined): DraftPickup {
  if (!pickup) return NO_PICKUP
  const setup = transportOf(pickup)
  if (!setup) return { ...NO_PICKUP, enabled: true, zoneIds: [...pickup.zoneIds], required: pickup.required, mode: pickup.mode ?? 'optional', trips: pickup.trips ?? ['pickup'] }
  return {
    enabled: true,
    zoneIds: [...pickup.zoneIds],
    required: pickup.required,
    mode: setup.mode,
    trips: [...setup.trips],
    ownDropOffs: setup.dropOffs.length > 0,
    dropOffs: setup.dropOffs.map((point) => ({ ...point })),
    charge: setup.charge,
    fare: { ...setup.fare },
    perZone: Object.keys(setup.zoneFares).length > 0,
    zoneFares: Object.fromEntries(Object.entries(setup.zoneFares).map(([id, fare]) => [id, { ...fare }])),
  }
}

/**
 * The one trip included, from the trips ticked: both ways when both ways (or
 * pickup and drop-off) are ticked, else the first in the order guests see them.
 */
export function includedTrip(trips: TransportTrip[] | undefined): TransportTrip {
  const ticked = trips ?? []
  if (ticked.includes('both') || (ticked.includes('pickup') && ticked.includes('dropoff'))) return 'both'
  return TRANSPORT_TRIPS.find((trip) => ticked.includes(trip)) ?? 'pickup'
}

/** True when the draft has transport: switched on, or Pick up on Where guests go. */
export const transportOn = (value: DraftPickup | undefined, arrivalMode: string) => Boolean(value?.enabled) || arrivalMode === 'pickup'

/** What is saved on the activity, or null for no transport. Pick up on Where guests go means no meet-there option. */
export function pickupOfDraft(value: DraftPickup | undefined, arrivalMode: string): ActivityPickup | null {
  if (!value || !transportOn(value, arrivalMode)) return null
  const mode = value.mode ?? 'optional'
  // Saved in one order (pickup, drop-off, both), however they were ticked.
  const offered = TRANSPORT_TRIPS.filter((trip) => (value.trips ?? ['pickup']).includes(trip))
  const trips: TransportTrip[] = mode === 'included' ? [includedTrip(offered)] : offered.length > 0 ? offered : ['pickup']
  const dropping = trips.some((trip) => trip !== 'pickup')
  const dropOffs = dropping && value.ownDropOffs ? cleanDropOffs(value.dropOffs) : []
  const zoneIds = [...new Set(value.zoneIds)]
  const charge: TransportCharge = mode === 'included' ? 'free' : (value.charge ?? 'free')
  const fare = charge === 'free' ? undefined : cleanFare(value.fare)
  const zoneFares =
    charge === 'free' || !value.perZone
      ? undefined
      : Object.fromEntries(zoneIds.flatMap((id) => {
          const own = cleanFare(value.zoneFares?.[id])
          return own.oneWay !== undefined || own.return !== undefined ? [[id, own]] : []
        }))
  const saved: ActivityPickup = {
    zoneIds,
    required: arrivalMode === 'pickup',
    mode,
    trips,
    ...(dropOffs.length > 0 ? { dropOffs } : {}),
    ...(mode === 'optional' ? { charge } : {}),
    ...(fare && (fare.oneWay !== undefined || fare.return !== undefined) ? { fare } : {}),
    ...(zoneFares && Object.keys(zoneFares).length > 0 ? { zoneFares } : {}),
  }
  // Nothing to run (no pickup points, and no drop-off points for a drop-off): no transport.
  return transportOf(saved) ? saved : null
}

function cleanFare(fare: TransportFare | undefined): TransportFare {
  const keep = (value: number | undefined) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined)
  const oneWay = keep(fare?.oneWay)
  const back = keep(fare?.return)
  return { ...(oneWay !== undefined ? { oneWay } : {}), ...(back !== undefined ? { return: back } : {}) }
}

const major = (minor: number | undefined) => (minor === undefined ? '' : String(minor / 100))
const minor = (typed: string): number | undefined => {
  if (typed.trim() === '') return undefined
  const value = Number(typed)
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : undefined
}

type TransportMode = 'none' | 'included' | 'optional'

function MoneyInput({ value, onChange, label, placeholder, symbol }: { value: number | undefined; onChange: (value: number | undefined) => void; label: string; placeholder?: string; symbol: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm text-muted" aria-hidden="true">
        {symbol}
      </span>
      <Input type="number" size="sm" min={0} step={1} inputMode="decimal" className="w-full min-w-0" aria-label={label} placeholder={placeholder} value={major(value)} onChange={(event) => onChange(minor(event.target.value))} />
    </div>
  )
}

export function PickupEditor({
  value,
  onChange,
  zones,
  currency = 'USD',
  currencySymbol = '$',
  arrivalMode,
}: {
  value: DraftPickup
  onChange: (value: DraftPickup) => void
  zones: PickupZoneOption[]
  currency?: CurrencyCode
  currencySymbol?: string
  /** Pick up on Where guests go: every guest is collected, so there is always transport. */
  arrivalMode: string
}) {
  const collectsEveryone = arrivalMode === 'pickup'
  const on = transportOn(value, arrivalMode)
  const mode: TransportMode = on ? (value.mode ?? 'optional') : 'none'
  const trips = value.trips ?? ['pickup']
  const included = mode === 'included'
  const charge = included ? 'free' : (value.charge ?? 'free')
  const dropping = trips.some((trip) => trip !== 'pickup')
  const chosen = zones.filter((zone) => value.zoneIds.includes(zone.id))
  const set = (patch: Partial<DraftPickup>) => onChange({ ...value, ...patch })
  const fare = value.fare ?? {}
  const twice = (oneWay: number | undefined) => (oneWay === undefined ? undefined : `${(oneWay * 2) / 100}`)

  const setMode = (next: TransportMode) => {
    if (next === 'none') return set({ enabled: false })
    set({
      enabled: true,
      mode: next,
      // Turning it on starts with every pickup point, so there is something to choose from.
      zoneIds: value.zoneIds.length > 0 ? value.zoneIds : zones.map((zone) => zone.id),
      trips: next === 'included' ? [includedTrip(trips)] : trips,
    })
  }
  const toggleTrip = (trip: TransportTrip) => {
    if (included) return set({ trips: [trip] })
    const next = trips.includes(trip) ? trips.filter((entry) => entry !== trip) : [...trips, trip]
    if (next.length > 0) set({ trips: next })
  }
  const setCharge = (next: TransportCharge) =>
    set({
      charge: next,
      // A first price to start from: the first pickup point's own fee, both ways twice that.
      fare: next !== 'free' && fare.oneWay === undefined ? { oneWay: chosen.find((zone) => zone.fee > 0)?.fee ?? 1500 } : fare,
    })
  const setDropOff = (index: number, patch: Partial<DropOffPoint>) =>
    set({ dropOffs: (value.dropOffs ?? []).map((point, at) => (at === index ? { ...point, ...patch } : point)) })
  const addDropOff = () => {
    const list = value.dropOffs ?? []
    let n = list.length + 1
    while (list.some((point) => point.id === `dp_${n}`)) n++
    set({ ownDropOffs: true, dropOffs: [...list, { id: `dp_${n}`, name: '', afterMinutes: 20 }] })
  }
  const setZoneFare = (id: string, patch: TransportFare) =>
    set({ zoneFares: { ...value.zoneFares, [id]: { ...value.zoneFares?.[id], ...patch } } })

  const saved = pickupOfDraft(value, arrivalMode)
  const summary = transportSummary(transportOf(saved), currency)
  const oneWayShown = trips.includes('pickup') || trips.includes('dropoff')
  const bothShown = trips.includes('both')
  const noPoints = on && value.zoneIds.length === 0 && !(trips.includes('dropoff') && value.ownDropOffs && (value.dropOffs ?? []).some((point) => point.name.trim()))

  return (
    <div role="group" aria-labelledby="transport-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p id="transport-title" className="text-[0.8125rem] font-medium">
          Transport
        </p>
        <Segmented
          label="Transport"
          value={mode}
          onValueChange={setMode}
          className="max-w-full"
          options={[
            { value: 'none', label: 'No transport', disabled: collectsEveryone },
            { value: 'included', label: 'Included' },
            { value: 'optional', label: 'Optional' },
          ]}
        />
      </div>
      {on ? (
        <p className="-mt-2 text-xs text-muted">
          {included
            ? `Part of the price. Guests pick where to be ${includedTrip(trips) === 'dropoff' ? 'dropped' : 'collected'}.`
            : collectsEveryone
              ? trips.some((trip) => trip !== 'dropoff')
                ? 'Every guest is collected. They pick a trip and pay for it.'
                : 'Every guest books a trip and pays for it.'
              : 'Guests can meet you there, or add a ride.'}
        </p>
      ) : null}

      {on ? (
        <>
          {/* ---------- trips ---------- */}
          <div>
            <p className="text-xs font-medium text-muted">{included ? 'What is included' : 'Trips guests can book'}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5" role={included ? 'radiogroup' : 'group'} aria-label={included ? 'What is included' : 'Trips guests can book'}>
              {(['pickup', 'dropoff', 'both'] as const).map((trip) => {
                const picked = included ? includedTrip(trips) === trip : trips.includes(trip)
                return (
                  <button
                    key={trip}
                    type="button"
                    role={included ? 'radio' : 'checkbox'}
                    aria-checked={picked}
                    onClick={() => toggleTrip(trip)}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      picked ? 'border-primary bg-primary-soft/40 text-foreground' : 'border-line text-muted hover:text-foreground',
                    )}
                  >
                    {trip === 'pickup' ? 'Pickup only' : trip === 'dropoff' ? 'Drop-off only' : 'Both ways'}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ---------- pickup points ---------- */}
          <div>
            <p className="text-xs font-medium text-muted">Pickup points</p>
            {zones.length === 0 ? (
              <p className="mt-1.5 text-sm text-subtle">
                No pickup zones yet.{' '}
                <Link href="/dashboard/settings/pickup" className="font-medium text-primary hover:underline">
                  Add pickup zones
                </Link>
              </p>
            ) : (
              <ul className="mt-1.5 grid list-none gap-2 p-0 sm:grid-cols-2">
                {zones.map((zone) => {
                  const picked = value.zoneIds.includes(zone.id)
                  return (
                    <li key={zone.id}>
                      <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors', picked ? 'border-primary/40 bg-primary-soft/20' : 'border-line')}>
                        <Checkbox
                          checked={picked}
                          className="mt-0.5"
                          onCheckedChange={(checked) => set({ zoneIds: checked === true ? [...value.zoneIds, zone.id] : value.zoneIds.filter((id) => id !== zone.id) })}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{zone.name}</span>
                          <span className="block text-xs text-subtle">{zone.detail}</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            {noPoints ? <p className="mt-1.5 text-xs font-medium text-warning">Choose at least one pickup point.</p> : null}
            <Link href="/dashboard/settings/pickup" className="mt-1.5 inline-block text-xs font-medium text-primary hover:underline">
              Manage pickup zones
            </Link>
          </div>

          {/* ---------- drop-off ---------- */}
          {dropping ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted">Drop-off</p>
                <Segmented
                  label="Drop-off"
                  size="sm"
                  className="max-w-full overflow-x-auto"
                  value={value.ownDropOffs ? 'own' : 'back'}
                  onValueChange={(next) => (next === 'own' && (value.dropOffs ?? []).length === 0 ? addDropOff() : set({ ownDropOffs: next === 'own' }))}
                  options={[
                    { value: 'back', label: 'Back to the pickup point' },
                    { value: 'own', label: 'Drop-off points' },
                  ]}
                />
              </div>
              {value.ownDropOffs ? (
                <div className="mt-2 flex flex-col gap-2">
                  {(value.dropOffs ?? []).map((point, index) => (
                    <div key={point.id} className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-center gap-2">
                      <Input size="sm" aria-label={`Drop-off point ${index + 1}`} placeholder="Front Street, Lahaina" value={point.name} onChange={(event) => setDropOff(index, { name: event.target.value })} />
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          size="sm"
                          min={0}
                          step={5}
                          className="w-full min-w-0"
                          aria-label={`Minutes after the end, drop-off point ${index + 1}`}
                          value={point.afterMinutes}
                          onChange={(event) => setDropOff(index, { afterMinutes: Math.max(0, Math.round(Number(event.target.value) || 0)) })}
                        />
                        <span className="text-xs text-subtle">min</span>
                      </div>
                      <IconButton aria-label={`Remove drop-off point ${index + 1}`} size="sm" variant="ghost" onClick={() => set({ dropOffs: (value.dropOffs ?? []).filter((_, at) => at !== index) })}>
                        <X aria-hidden="true" />
                      </IconButton>
                    </div>
                  ))}
                  <p className="text-xs text-subtle">Minutes after the end that guests get there.</p>
                  <Button type="button" variant="ghost" size="sm" className="self-start" leftIcon={<Plus />} onClick={addDropOff}>
                    Add drop-off point
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ---------- price ---------- */}
          {included ? null : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted">Price</p>
                <Segmented
                  label="Transport price"
                  size="sm"
                  value={charge}
                  onValueChange={setCharge}
                  options={[
                    { value: 'free', label: 'Free' },
                    { value: 'guest', label: 'Per guest' },
                    { value: 'booking', label: 'Per booking' },
                  ]}
                />
              </div>
              {charge !== 'free' ? (
                <div className="mt-2 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
                    {oneWayShown ? (
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-subtle">One way</span>
                        <MoneyInput symbol={currencySymbol} label="One way price" value={fare.oneWay} onChange={(oneWay) => set({ fare: { ...fare, oneWay } })} />
                      </label>
                    ) : null}
                    {bothShown ? (
                      <label className="flex flex-col gap-1">
                        <span className="text-xs text-subtle">Both ways</span>
                        <MoneyInput symbol={currencySymbol} label="Both ways price" placeholder={twice(fare.oneWay)} value={fare.return} onChange={(back) => set({ fare: { ...fare, return: back } })} />
                      </label>
                    ) : null}
                  </div>
                  {chosen.length > 1 || (chosen.length === 1 && value.perZone) ? (
                    <label className="inline-flex items-center gap-2 text-sm text-muted">
                      <Switch size="sm" checked={Boolean(value.perZone)} onCheckedChange={(checked) => set({ perZone: checked })} />
                      Different price per pickup point
                    </label>
                  ) : null}
                  {value.perZone && chosen.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-line">
                      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2 border-b border-line-subtle bg-surface-sunken/50 px-3 py-2 text-xs font-medium text-muted sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">
                        <span>Pickup point</span>
                        <span>{oneWayShown ? 'One way' : ''}</span>
                        <span>{bothShown ? 'Both ways' : ''}</span>
                      </div>
                      <ul className="list-none divide-y divide-line-subtle p-0">
                        {chosen.map((zone) => {
                          const own = value.zoneFares?.[zone.id] ?? {}
                          return (
                            <li key={zone.id} className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] items-center gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">
                              <span className="truncate text-sm">{zone.name}</span>
                              {oneWayShown ? (
                                <MoneyInput symbol={currencySymbol} label={`One way from ${zone.name}`} placeholder={major(fare.oneWay)} value={own.oneWay} onChange={(oneWay) => setZoneFare(zone.id, { oneWay })} />
                              ) : (
                                <span />
                              )}
                              {bothShown ? (
                                <MoneyInput
                                  symbol={currencySymbol}
                                  label={`Both ways from ${zone.name}`}
                                  placeholder={own.oneWay !== undefined ? twice(own.oneWay) : fare.return !== undefined ? major(fare.return) : twice(fare.oneWay)}
                                  value={own.return}
                                  onChange={(back) => setZoneFare(zone.id, { return: back })}
                                />
                              ) : (
                                <span />
                              )}
                            </li>
                          )
                        })}
                      </ul>
                      <p className="border-t border-line-subtle px-3 py-2 text-xs text-subtle">Empty uses the price above. 0 is free.</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {saved ? (
            <p className="text-xs text-muted">
              <span className="font-medium text-foreground">Guests see:</span> {summary}
              {collectsEveryone || included ? null : ` · or ${TRIP_WORDS.meet.toLowerCase()}`}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
