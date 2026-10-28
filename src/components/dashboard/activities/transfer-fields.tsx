'use client'

import * as React from 'react'
import { Bus, Car, Check, Clock, Plus, Trash2, type LucideIcon } from 'lucide-react'

import type { TransferHubKind, TransferService } from '@/types'
import { HUB_KINDS, TRANSFER_SERVICES, hubWord, tripLabel } from '@/lib/transfers'
import { clockTime } from '@/lib/activity-schedule'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import { DriverChoice } from './kind-fields'
import { KIND_TIER_PRESETS, blankTier, type DraftTier } from './pricing-tier-editor'
import {
  TRANSFER_VEHICLE_PRESETS,
  TRIP_ORDER,
  fleetOfDraft,
  runDirections,
  vehicleOf,
  vehicleTier,
  withHubKind,
  type DraftTransfer,
  type DraftTrip,
  type DraftVehicle,
} from './transfer-draft'

export { TRANSFER_VEHICLE_PRESETS }

/* ==========================================================================
   TRANSFERS IN THE WIZARD — the Basics card (what you run, where rides
   start or end, the trips guests can book, the vehicles or tickets), the
   Booking step's ride timing and shuttle run directions, and the Guests
   step's fixed checkout fields. The price table is on Pricing
   (transfer-price-table.tsx); the model is in transfer-draft.ts.
   ========================================================================== */

const SERVICE_ICONS: Record<TransferService, LucideIcon> = { private: Car, shared: Bus, hourly: Clock }

const whole = (value: string, min = 0, max = 999) => Math.min(max, Math.max(min, Math.floor(Number(value)) || 0))

function Section({ title, hint, error, children }: { title: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line-subtle pt-4 first:border-t-0 first:pt-0">
      <div>
        <h4 className="text-[0.8125rem] font-semibold text-foreground">{title}</h4>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      {children}
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </section>
  )
}

/** A small chip that adds a row: "+ Van · 9". */
function AddChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface px-3 text-xs font-medium text-muted transition-colors duration-200',
        'hover:border-line-strong hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
      )}
    >
      <Plus className="size-3" aria-hidden="true" />
      {label}
    </button>
  )
}

/* ---------- Basics: Rental settings, with a driver ---------- */

export interface TransferFieldsProps {
  value: DraftTransfer
  /** The vehicle sizes (private, by the hour) or tickets (shared): the activity's price tiers. */
  tiers: DraftTier[]
  /** The settings changed; `tiers` when a vehicle or ticket row was added, renamed or removed. */
  onChange: (value: DraftTransfer, tiers?: DraftTier[]) => void
  /** What is run changed: the wizard swaps the rows and the schedule with it. */
  onService: (service: TransferService) => void
  /** "Self-drive or gear": the wizard turns it back into a plain rental. */
  onSelfDrive?: () => void
  errors: Record<string, string>
}

export function TransferFields({ value, tiers, onChange, onService, onSelfDrive, errors }: TransferFieldsProps) {
  const service = value.service
  const hub = value.noHub ? undefined : value.hub
  const set = (patch: Partial<DraftTransfer>) => onChange({ ...value, ...patch })
  const toggleTrip = (trip: DraftTrip) => set({ trips: value.trips.includes(trip) ? value.trips.filter((entry) => entry !== trip) : TRIP_ORDER.filter((entry) => entry === trip || value.trips.includes(entry)) })
  const trips = value.noHub ? (['between'] as DraftTrip[]) : TRIP_ORDER

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-sunken/40 p-4">
      <p className="text-[0.8125rem] font-medium">Rental settings</p>
      {onSelfDrive ? <DriverChoice driver onChange={(driver) => (driver ? undefined : onSelfDrive())} /> : null}

      <Section title="How it’s charged">
        <div role="radiogroup" aria-label="How it’s charged" className="grid gap-2 lg:grid-cols-3">
          {TRANSFER_SERVICES.map((choice) => {
            const on = choice.value === service
            const Icon = SERVICE_ICONS[choice.value]
            return (
              <button
                key={choice.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => (on ? undefined : onService(choice.value))}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-200',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  on ? 'border-primary bg-primary-soft/30' : 'border-line bg-surface hover:border-line-strong',
                )}
              >
                <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', on ? 'bg-primary-soft text-primary' : 'bg-surface-sunken text-faint')} aria-hidden="true">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{choice.label}</span>
                  <span className="block text-xs text-subtle">{choice.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </Section>

      {service === 'hourly' ? null : (
        <Section title="Rides start or end at" error={errors['transfer.hub']}>
          {value.noHub ? null : (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,11rem)]">
              <Field label="Name" labelSize="sm" error={errors['transfer.hub'] ? true : undefined}>
                {(control) => <Input {...control} value={value.hub.name} placeholder="Cancun International Airport" onChange={(event) => set({ hub: { ...value.hub, name: event.target.value } })} />}
              </Field>
              <Field label="Code" labelSize="sm" optional>
                {(control) => <Input {...control} value={value.hub.code ?? ''} placeholder="CUN" maxLength={8} onChange={(event) => set({ hub: { ...value.hub, code: event.target.value.toUpperCase() } })} />}
              </Field>
              <Field label="Type" labelSize="sm">
                <Select value={value.hub.kind} onValueChange={(kind) => onChange(withHubKind(value, kind as TransferHubKind))}>
                  <SelectTrigger aria-label="Type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HUB_KINDS.map((kind) => (
                      <SelectItem key={kind.value} value={kind.value}>
                        {kind.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )}
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
            <Checkbox
              size="sm"
              checked={value.noHub}
              onCheckedChange={(checked) => set({ noHub: checked === true, ...(checked === true && !value.trips.includes('between') ? { trips: [...value.trips, 'between'] } : {}) })}
            />
            No airport or port: rides between areas only
          </label>
        </Section>
      )}

      {service === 'hourly' ? null : (
        <Section title="Trips guests can book" error={errors['transfer.trips']}>
          <div role="group" aria-label="Trips guests can book" className="flex flex-wrap gap-2">
            {trips
              .filter((trip) => service !== 'shared' || trip !== 'between')
              .map((trip) => {
                const on = value.trips.includes(trip)
                return (
                  <button
                    key={trip}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTrip(trip)}
                    className={cn(
                      'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[0.8125rem] font-medium transition-colors duration-150',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      on ? 'border-primary/50 bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
                    )}
                  >
                    {on ? <Check className="size-3.5" aria-hidden="true" /> : <Plus className="size-3.5" aria-hidden="true" />}
                    {tripLabel(trip, hub)}
                  </button>
                )
              })}
          </div>
        </Section>
      )}

      {service === 'shared' ? (
        <TicketRows value={value} tiers={tiers} onChange={onChange} errors={errors} />
      ) : (
        <VehicleRows value={value} tiers={tiers} onChange={onChange} errors={errors} />
      )}
    </div>
  )
}

/** The vehicle sizes: a name (the price tier), passengers, suitcases and how many the business has. */
function VehicleRows({ value, tiers, onChange, errors }: Pick<TransferFieldsProps, 'value' | 'tiers' | 'onChange' | 'errors'>) {
  const setVehicle = (tierId: string, patch: Partial<DraftVehicle>) => onChange({ ...value, vehicles: { ...value.vehicles, [tierId]: { ...vehicleOf(value, tierId), ...patch } } })
  const rename = (tierId: string, label: string) => onChange(value, tiers.map((tier) => (tier.id === tierId ? { ...tier, label } : tier)))
  const remove = (tierId: string) => {
    const { [tierId]: _gone, ...vehicles } = value.vehicles
    onChange({ ...value, vehicles }, tiers.filter((tier) => tier.id !== tierId))
  }
  const add = (preset: (typeof TRANSFER_VEHICLE_PRESETS)[number]) => {
    const row = vehicleTier(preset, tiers)
    onChange({ ...value, vehicles: { ...value.vehicles, [row.tier.id]: row.vehicle } }, [...tiers, row.tier])
  }
  const fleet = fleetOfDraft(value, tiers)
  const numbers: { key: 'passengers' | 'bags' | 'fleet'; label: string; min: number }[] = [
    { key: 'passengers', label: 'Passengers', min: 1 },
    { key: 'bags', label: 'Suitcases', min: 0 },
    { key: 'fleet', label: 'How many', min: 0 },
  ]

  return (
    <Section title="Vehicles" hint="Bigger groups get a bigger vehicle, or more than one." error={errors['transfer.vehicles']}>
      <div className="flex flex-col gap-2">
        <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_2rem] gap-2 px-0.5 text-xs font-medium text-subtle sm:grid">
          <span>Name</span>
          {numbers.map((entry) => (
            <span key={entry.key}>{entry.label}</span>
          ))}
          <span />
        </div>
        <ul className="flex list-none flex-col gap-2 p-0">
          {tiers.map((tier, index) => {
            const vehicle = vehicleOf(value, tier.id)
            const name = tier.label || `vehicle ${index + 1}`
            return (
              <li key={tier.id} className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-2.5 sm:grid sm:grid-cols-[minmax(0,1fr)_6rem_6rem_6rem_2rem] sm:items-start sm:border-0 sm:bg-transparent sm:p-0">
                <div className="flex items-start gap-2">
                  <Input
                    size="sm"
                    className="flex-1"
                    aria-label={`Vehicle ${index + 1} name`}
                    value={tier.label}
                    placeholder="Private van"
                    error={errors[`tiers.${index}.label`]}
                    onChange={(event) => rename(tier.id, event.target.value)}
                  />
                  <IconButton type="button" size="xs" variant="ghost" className="text-danger hover:bg-danger-soft sm:hidden" aria-label={`Remove ${name}`} disabled={tiers.length === 1} onClick={() => remove(tier.id)}>
                    <Trash2 />
                  </IconButton>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:contents">
                  {numbers.map((entry) => (
                    <label key={entry.key} className="flex flex-col gap-1 text-xs text-subtle sm:block">
                      <span className="sm:hidden">{entry.label}</span>
                      <Input
                        size="sm"
                        type="number"
                        inputMode="numeric"
                        min={entry.min}
                        max={entry.key === 'fleet' ? 500 : 99}
                        inputClassName="tabular"
                        aria-label={`${entry.label} for ${name}`}
                        value={vehicle[entry.key]}
                        onChange={(event) => setVehicle(tier.id, { [entry.key]: whole(event.target.value, entry.min, entry.key === 'fleet' ? 500 : 99) })}
                      />
                    </label>
                  ))}
                </div>
                <IconButton type="button" size="xs" variant="ghost" className="mt-1 hidden text-danger hover:bg-danger-soft sm:inline-flex" aria-label={`Remove ${name}`} disabled={tiers.length === 1} onClick={() => remove(tier.id)}>
                  <Trash2 />
                </IconButton>
                {errors[`tiers.${index}.label`] ? <p className="text-xs font-medium text-danger sm:col-span-5">{errors[`tiers.${index}.label`]}</p> : null}
              </li>
            )
          })}
        </ul>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {TRANSFER_VEHICLE_PRESETS.map((preset) => (
          <AddChip key={preset.short} label={`${preset.short} · ${preset.passengers}`} onClick={() => add(preset)} />
        ))}
      </div>
      <p className="text-xs text-subtle tabular">
        {fleet} {fleet === 1 ? 'vehicle' : 'vehicles'} in all
      </p>
    </Section>
  )
}

/** A shared shuttle's tickets: a name and whether it takes a seat. Prices per destination are on Pricing. */
function TicketRows({ value, tiers, onChange, errors }: Pick<TransferFieldsProps, 'value' | 'tiers' | 'onChange' | 'errors'>) {
  const setTier = (tierId: string, patch: Partial<DraftTier>) => onChange(value, tiers.map((tier) => (tier.id === tierId ? { ...tier, ...patch } : tier)))
  const presets = (KIND_TIER_PRESETS.transfer ?? []).filter((preset) => !tiers.some((tier) => tier.label.trim().toLowerCase() === preset.label.toLowerCase()))
  return (
    <Section title="Tickets" hint="Prices for each destination are set on Pricing." error={errors['transfer.tickets']}>
      <ul className="flex list-none flex-col gap-2 p-0">
        {tiers.map((tier, index) => (
          <li key={tier.id} className="flex flex-wrap items-center gap-2">
            <Input size="sm" className="min-w-0 flex-1" aria-label={`Ticket ${index + 1} name`} value={tier.label} placeholder="Adult" error={errors[`tiers.${index}.label`]} onChange={(event) => setTier(tier.id, { label: event.target.value })} />
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
              <Switch size="sm" checked={tier.countsTowardCapacity} onCheckedChange={(countsTowardCapacity) => setTier(tier.id, { countsTowardCapacity })} aria-label={`${tier.label || 'Ticket'} takes a seat`} />
              Takes a seat
            </label>
            <IconButton type="button" size="xs" variant="ghost" className="text-danger hover:bg-danger-soft" aria-label={`Remove ${tier.label || `ticket ${index + 1}`}`} disabled={tiers.length === 1} onClick={() => onChange(value, tiers.filter((entry) => entry.id !== tier.id))}>
              <Trash2 />
            </IconButton>
          </li>
        ))}
      </ul>
      {presets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {presets.map((preset) => (
            <AddChip
              key={preset.label}
              label={preset.label}
              onClick={() =>
                onChange(value, [
                  ...tiers,
                  { ...blankTier(preset.label, 0, tiers), description: preset.description, countsTowardCapacity: preset.counts !== false, ...(preset.ageMin ? { ageMin: preset.ageMin } : {}), ...(preset.ageMax ? { ageMax: preset.ageMax } : {}) },
                ])
              }
            />
          ))}
        </div>
      ) : null}
    </Section>
  )
}

/* ---------- Booking step ---------- */

/** "10 vehicles: 6 Private car, 4 Private van." in place of the capacity box for private rides and drivers by the hour. */
export function FleetLine({ value, tiers, onBasics }: { value: DraftTransfer; tiers: DraftTier[]; onBasics?: () => void }) {
  const fleet = fleetOfDraft(value, tiers)
  const parts = tiers.map((tier) => `${Math.max(0, vehicleOf(value, tier.id).fleet - vehicleOf(value, tier.id).outOfService)} ${tier.label || 'unnamed'}`)
  return (
    <section className="flex flex-col gap-1 rounded-xl border border-line p-4">
      <h3 className="text-sm font-semibold">Capacity</h3>
      <p className="text-sm text-foreground tabular">
        {fleet} {fleet === 1 ? 'vehicle' : 'vehicles'}
        {parts.length > 0 ? `: ${parts.join(', ')}.` : '.'}{' '}
        {onBasics ? (
          <button type="button" onClick={onBasics} className="text-xs font-medium text-primary hover:underline">
            Change them on Basics
          </button>
        ) : null}
      </p>
      <p className="text-xs text-subtle">Each ride holds its vehicle from pickup until it is back.</p>
    </section>
  )
}

const FLIGHT_WORDS: Record<TransferHubKind, { ask: string; arrives: string; leaves: string }> = {
  airport: { ask: 'Ask for a flight number', arrives: 'Free waiting after it lands', leaves: 'before the flight' },
  port: { ask: 'Ask for the ferry name', arrives: 'Free waiting after it docks', leaves: 'before it sails' },
  station: { ask: 'Ask for the train or bus number', arrives: 'Free waiting after it arrives', leaves: 'before it leaves' },
  other: { ask: 'Ask for a reference number', arrives: 'Free waiting after it arrives', leaves: 'before it leaves' },
}

/** Ride timing, with a hub: free waiting for arrivals, time at the hub before a departure, the most vehicles, the flight number. */
export function RideTiming({ value, onChange }: { value: DraftTransfer; onChange: (value: DraftTransfer) => void }) {
  if (value.service === 'hourly' || value.noHub) return null
  const words = FLIGHT_WORDS[value.hub.kind] ?? FLIGHT_WORDS.airport
  const set = (patch: Partial<DraftTransfer>) => onChange({ ...value, ...patch })
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line p-4">
      <h3 className="text-sm font-semibold">Ride timing</h3>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label={words.arrives}>
          {(control) => <Input {...control} type="number" min={0} max={600} step={5} suffix="min" inputClassName="tabular" value={value.freeWaitMinutes} onChange={(event) => set({ freeWaitMinutes: whole(event.target.value, 0, 600) })} />}
        </Field>
        <Field label={`At the ${hubWord(value.hub)} ${words.leaves}`} description="Pickup = flight time, less this, less the drive.">
          {(control) => <Input {...control} type="number" min={0} max={600} step={5} suffix="min" inputClassName="tabular" value={value.checkInMinutes} onChange={(event) => set({ checkInMinutes: whole(event.target.value, 0, 600) })} />}
        </Field>
        {value.service === 'private' ? (
          <Field label="Most vehicles per booking" description="More sends a request.">
            {(control) => <Input {...control} type="number" min={1} max={20} inputClassName="tabular" suffix={value.maxVehicles === 1 ? 'vehicle' : 'vehicles'} value={value.maxVehicles} onChange={(event) => set({ maxVehicles: whole(event.target.value, 1, 20) })} />}
          </Field>
        ) : null}
      </div>
      <label className="flex items-center justify-between gap-3 border-t border-line-subtle pt-3">
        <span className="text-sm font-medium">{words.ask}</span>
        <Switch checked={value.askFlight} onCheckedChange={(askFlight) => set({ askFlight })} aria-label={words.ask} />
      </label>
    </section>
  )
}

/** A shared shuttle's runs: which go from the hub and which go to it. */
export function SharedRunDirections({ value, runTimes, onChange }: { value: DraftTransfer; runTimes: string[]; onChange: (value: DraftTransfer) => void }) {
  if (value.service !== 'shared' || value.noHub || runTimes.length === 0) return null
  const word = hubWord(value.hub)
  const times = [...new Set(runTimes)].sort()
  const toggle = (time: string, way: 'from' | 'to') => {
    const ways = times.map((entry) => ({ time: entry, ...runDirections(value.shared, entry) }))
    const next = ways.map((entry) => (entry.time === time ? { ...entry, [way]: !entry[way] } : entry))
    // Every run goes at least one way.
    if (next.some((entry) => !entry.from && !entry.to)) return
    onChange({ ...value, shared: { fromHubTimes: next.filter((entry) => entry.from).map((entry) => entry.time), toHubTimes: next.filter((entry) => entry.to).map((entry) => entry.time) } })
  }
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
      <div>
        <h3 className="text-sm font-semibold">Which way each run goes</h3>
        <p className="mt-0.5 text-xs text-subtle">A run both ways shares its seats.</p>
      </div>
      <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
        {times.map((time) => {
          const ways = runDirections(value.shared, time)
          return (
            <li key={time} className="flex flex-wrap items-center gap-x-5 gap-y-2 py-2 first:pt-0 last:pb-0">
              <span className="w-20 text-sm font-medium tabular">{clockTime(time)}</span>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                <Checkbox size="sm" checked={ways.from} onCheckedChange={() => toggle(time, 'from')} aria-label={`${clockTime(time)} from the ${word}`} />
                From {word}
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
                <Checkbox size="sm" checked={ways.to} onCheckedChange={() => toggle(time, 'to')} aria-label={`${clockTime(time)} to the ${word}`} />
                To {word}
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/* ---------- Guests step ---------- */

/** What checkout asks for every ride (fixed), and where the driver meets arrivals. */
export function TransferCheckoutFields({ value, meetingPoint, onMeetingPoint, error }: { value: DraftTransfer; meetingPoint: string; onMeetingPoint: (next: string) => void; error?: string }) {
  const hub = value.service !== 'hourly' && !value.noHub
  const flightWord = value.hub.kind === 'port' ? 'Ferry name and time' : value.hub.kind === 'station' ? 'Train or bus number and time' : value.hub.kind === 'other' ? 'Reference number and time' : 'Flight number and time'
  const asks = [
    'Name',
    'Mobile number',
    value.service === 'hourly' ? 'Pickup address' : 'Hotel or address',
    ...(hub && value.askFlight ? [flightWord] : []),
    value.service === 'shared' ? 'Tickets and suitcases' : 'Passengers and suitcases',
    'Note for the driver (optional)',
  ]
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2 rounded-xl border border-line p-4">
        <h3 className="text-sm font-semibold">Checkout asks for</h3>
        <ul className="grid list-none gap-x-6 gap-y-1.5 p-0 sm:grid-cols-2">
          {asks.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-foreground">
              <Check className="size-3.5 shrink-0 text-success" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </section>
      {hub ? (
        <Field label="Where the driver meets arrivals" optional error={error} description="Shown on the booking confirmation.">
          <Textarea rows={2} value={meetingPoint} placeholder="Outside arrivals, holding a sign with your name." onChange={(event) => onMeetingPoint(event.target.value)} />
        </Field>
      ) : null}
    </div>
  )
}
