'use client'

import * as React from 'react'
import { ChevronDown, ClipboardPaste, Plus, Trash2 } from 'lucide-react'

import type { CurrencyCode, TransferZone } from '@/types'
import { cn, currencySymbol } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

import { MoneyInput, type DraftTier } from './pricing-tier-editor'
import { rateKey, type DraftTransfer } from './transfer-draft'

/* ==========================================================================
   THE TRANSFER PRICE TABLE — on the Pricing step, laid out like an owner's
   price sheet: a row per destination (its drive time and the hotels in it),
   a column per vehicle (a shared shuttle: per ticket), one way and round
   trip. An empty round trip is twice the one way; an empty price is not
   sold there. A driver by the hour has a price per hour instead. Rows can
   be pasted in from a spreadsheet. On a phone each destination is a card.
   ========================================================================== */

export interface TransferPriceTableProps {
  value: DraftTransfer
  /** Vehicle sizes or tickets, in column order. */
  tiers: DraftTier[]
  onChange: (value: DraftTransfer) => void
  currency: CurrencyCode
  errors: Record<string, string>
}

let zoneCounter = 0
/** A new destination's id. Only called from event handlers. */
function freshZoneId(taken: TransferZone[]): string {
  let id = ''
  do {
    zoneCounter += 1
    id = `tz_${Date.now().toString(36)}${zoneCounter.toString(36)}`
  } while (taken.some((zone) => zone.id === id))
  return id
}

const minutes = (value: string) => Math.min(600, Math.max(0, Math.floor(Number(value)) || 0))

/** Money typed or pasted ("$1,250.50", "95") in minor units; 0 when there is none. */
const moneyOf = (text: string) => {
  const parsed = Number.parseFloat(text.replace(/[^0-9.]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0
}

/**
 * Rows pasted from a sheet: a destination name, then prices in column order
 * (each vehicle's one way, then its round trip when round trips are sold).
 * Cells split on tabs, semicolons or two or more spaces. A header row is skipped.
 */
export function parsePastedPrices(text: string): { name: string; prices: number[] }[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.split(/\t|;|\s{2,}/).map((cell) => cell.trim()))
    .filter((cells) => cells[0] && cells.slice(1).some((cell) => /\d/.test(cell)))
    .map((cells) => ({ name: cells[0], prices: cells.slice(1).map(moneyOf) }))
}

/** The table with pasted rows laid in: a destination with the same name is updated, a new one added (the empty starter row is used first). */
export function withPastedPrices(value: DraftTransfer, tiers: Pick<DraftTier, 'id'>[], rows: { name: string; prices: number[] }[], roundTrips: boolean): DraftTransfer {
  let zones = [...value.zones]
  const rates = { ...value.rates }
  const step = roundTrips ? 2 : 1
  for (const row of rows) {
    let zone = zones.find((entry) => entry.name.trim().toLowerCase() === row.name.toLowerCase())
    if (!zone) {
      const blank = zones.find((entry) => !entry.name.trim() && !tiers.some((tier) => (rates[rateKey(entry.id, tier.id)]?.oneWay ?? 0) > 0))
      zone = blank ? { ...blank, name: row.name } : { id: freshZoneId(zones), name: row.name, places: [], driveMinutes: 30 }
      zones = blank ? zones.map((entry) => (entry.id === blank.id ? zone! : entry)) : [...zones, zone]
    }
    tiers.forEach((tier, index) => {
      const oneWay = row.prices[index * step] ?? 0
      const roundTrip = roundTrips ? (row.prices[index * step + 1] ?? 0) : (rates[rateKey(zone!.id, tier.id)]?.roundTrip ?? 0)
      if (oneWay > 0 || roundTrip > 0) rates[rateKey(zone!.id, tier.id)] = { oneWay, roundTrip }
    })
  }
  return { ...value, zones, rates }
}

export function TransferPriceTable(props: TransferPriceTableProps) {
  return props.value.service === 'hourly' ? <HourlyPrices {...props} /> : <ZonePrices {...props} />
}

/** Private and shared: destinations × vehicles (or tickets) × one way and round trip. */
function ZonePrices({ value, tiers, onChange, currency, errors }: TransferPriceTableProps) {
  const shared = value.service === 'shared'
  const roundTrips = !value.noHub && value.trips.includes('round_trip')
  const between = value.trips.includes('between')
  const [open, setOpen] = React.useState<Record<string, boolean>>({})
  const [pasting, setPasting] = React.useState(false)
  const [pasted, setPasted] = React.useState('')

  const setZone = (id: string, patch: Partial<TransferZone>) => onChange({ ...value, zones: value.zones.map((zone) => (zone.id === id ? { ...zone, ...patch } : zone)) })
  const rateOf = (zoneId: string, tierId: string) => value.rates[rateKey(zoneId, tierId)] ?? { oneWay: 0, roundTrip: 0 }
  const setRate = (zoneId: string, tierId: string, patch: Partial<{ oneWay: number; roundTrip: number }>) =>
    onChange({ ...value, rates: { ...value.rates, [rateKey(zoneId, tierId)]: { ...rateOf(zoneId, tierId), ...patch } } })
  const removeZone = (id: string) =>
    onChange({
      ...value,
      zones: value.zones.filter((zone) => zone.id !== id),
      rates: Object.fromEntries(Object.entries(value.rates).filter(([key]) => !key.startsWith(`${id}|`))),
    })
  const addZone = () => onChange({ ...value, zones: [...value.zones, { id: freshZoneId(value.zones), name: '', places: [], driveMinutes: 30 }] })
  const toggle = (id: string) => setOpen((current) => ({ ...current, [id]: !current[id] }))
  const zoneName = (zone: TransferZone, index: number) => zone.name.trim() || `destination ${index + 1}`
  const tierName = (tier: DraftTier, index: number) => tier.label.trim() || (shared ? `ticket ${index + 1}` : `vehicle ${index + 1}`)

  /** One way, and round trip when sold: one input each. */
  const priceCells = (zone: TransferZone, zoneIndex: number, tier: DraftTier, tierIndex: number): React.ReactElement[] => {
    const rate = rateOf(zone.id, tier.id)
    const where = `${tierName(tier, tierIndex)}, ${zoneName(zone, zoneIndex)}`
    const oneWay = <MoneyInput key="one" value={rate.oneWay} onValueChange={(next) => setRate(zone.id, tier.id, { oneWay: next })} currency={currency} size="sm" allowEmpty placeholder="—" ariaLabel={`One way, ${where}`} />
    if (!roundTrips) return [oneWay]
    return [
      oneWay,
      <MoneyInput
        key="round"
        value={rate.roundTrip}
        onValueChange={(next) => setRate(zone.id, tier.id, { roundTrip: next })}
        currency={currency}
        size="sm"
        allowEmpty
        placeholder={rate.oneWay > 0 ? String((rate.oneWay * 2) / 100) : '—'}
        ariaLabel={`Round trip, ${where}`}
      />,
    ]
  }

  const placesButton = (zone: TransferZone) => (
    <button type="button" aria-expanded={Boolean(open[zone.id])} onClick={() => toggle(zone.id)} className="inline-flex max-w-full items-center gap-1 text-left text-xs text-subtle hover:text-foreground">
      <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', open[zone.id] && 'rotate-180')} aria-hidden="true" />
      <span className="truncate">{zone.places.length > 0 ? `Hotels and areas: ${zone.places.slice(0, 3).join(', ')}${zone.places.length > 3 ? '…' : ''}` : 'Add hotels and areas'}</span>
    </button>
  )

  const rowError = (zone: TransferZone) => errors[`transfer.zone.${zone.id}.name`] ?? errors[`transfer.rate.${zone.id}`]

  return (
    <div className="flex flex-col gap-3">
      {/* ---- sm and up: the sheet ---- */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-max border-separate border-spacing-x-1.5 border-spacing-y-1 text-left">
          <thead>
            <tr className="text-xs text-subtle">
              <th scope="col" rowSpan={roundTrips ? 2 : 1} className="w-40 align-bottom font-medium">
                Destination
              </th>
              <th scope="col" rowSpan={roundTrips ? 2 : 1} className="w-24 align-bottom font-medium">
                Drive
              </th>
              {tiers.map((tier, index) => (
                <th key={tier.id} scope="colgroup" colSpan={roundTrips ? 2 : 1} className="font-semibold text-foreground">
                  {tierName(tier, index)}
                </th>
              ))}
              <th rowSpan={roundTrips ? 2 : 1} className="w-9">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
            {roundTrips ? (
              <tr className="text-xs text-subtle">
                {tiers.map((tier) => (
                  <React.Fragment key={tier.id}>
                    <th scope="col" className="w-[5.25rem] font-medium">
                      One way
                    </th>
                    <th scope="col" className="w-[5.25rem] font-medium">
                      Round trip
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {value.zones.map((zone, zoneIndex) => (
              <React.Fragment key={zone.id}>
                <tr className="align-top">
                  <td>
                    <Input size="sm" aria-label={`Destination ${zoneIndex + 1}`} value={zone.name} placeholder="Playa del Carmen" error={Boolean(errors[`transfer.zone.${zone.id}.name`])} onChange={(event) => setZone(zone.id, { name: event.target.value })} />
                    {/* The hotels line is cut short so it never widens the column. */}
                    <div className="mt-1 max-w-40 truncate px-0.5">{placesButton(zone)}</div>
                  </td>
                  <td>
                    <Input size="sm" type="number" min={0} max={600} step={5} suffix="min" inputClassName="tabular" aria-label={`Drive to ${zoneName(zone, zoneIndex)}, minutes`} value={zone.driveMinutes} onChange={(event) => setZone(zone.id, { driveMinutes: minutes(event.target.value) })} />
                  </td>
                  {tiers.map((tier, tierIndex) => priceCells(zone, zoneIndex, tier, tierIndex).map((cell) => <td key={`${tier.id}-${cell.key}`}>{cell}</td>))}
                  <td>
                    <IconButton type="button" size="xs" variant="ghost" className="mt-1 text-danger hover:bg-danger-soft" aria-label={`Remove ${zoneName(zone, zoneIndex)}`} disabled={value.zones.length === 1} onClick={() => removeZone(zone.id)}>
                      <Trash2 />
                    </IconButton>
                  </td>
                </tr>
                {open[zone.id] ? (
                  <tr>
                    <td colSpan={2 + tiers.length * (roundTrips ? 2 : 1) + 1}>
                      <PlacesEditor zone={zone} onPlaces={(places) => setZone(zone.id, { places })} />
                    </td>
                  </tr>
                ) : null}
                {rowError(zone) ? (
                  <tr>
                    <td colSpan={2 + tiers.length * (roundTrips ? 2 : 1) + 1} className="text-xs font-medium text-danger">
                      {zoneName(zone, zoneIndex)}: {rowError(zone)}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* ---- phones: a card per destination ---- */}
      <ul className="flex list-none flex-col gap-3 p-0 sm:hidden">
        {value.zones.map((zone, zoneIndex) => (
          <li key={zone.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3">
            <div className="flex items-start gap-2">
              <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_6.5rem] gap-2">
                <Input size="sm" aria-label={`Destination ${zoneIndex + 1}`} value={zone.name} placeholder="Playa del Carmen" error={Boolean(errors[`transfer.zone.${zone.id}.name`])} onChange={(event) => setZone(zone.id, { name: event.target.value })} />
                <Input size="sm" type="number" min={0} max={600} step={5} suffix="min" inputClassName="tabular" aria-label={`Drive to ${zoneName(zone, zoneIndex)}, minutes`} value={zone.driveMinutes} onChange={(event) => setZone(zone.id, { driveMinutes: minutes(event.target.value) })} />
              </div>
              <IconButton type="button" size="xs" variant="ghost" className="mt-1 text-danger hover:bg-danger-soft" aria-label={`Remove ${zoneName(zone, zoneIndex)}`} disabled={value.zones.length === 1} onClick={() => removeZone(zone.id)}>
                <Trash2 />
              </IconButton>
            </div>
            <div className="flex flex-col gap-2">
              {roundTrips ? (
                <div aria-hidden="true" className="grid grid-cols-[minmax(0,1fr)_6.5rem_6.5rem] gap-2 text-xs text-subtle">
                  <span />
                  <span>One way</span>
                  <span>Round trip</span>
                </div>
              ) : null}
              {tiers.map((tier, tierIndex) => (
                <div key={tier.id} className={cn('grid items-center gap-2', roundTrips ? 'grid-cols-[minmax(0,1fr)_6.5rem_6.5rem]' : 'grid-cols-[minmax(0,1fr)_7rem]')}>
                  <span className="truncate text-sm">{tierName(tier, tierIndex)}</span>
                  {priceCells(zone, zoneIndex, tier, tierIndex)}
                </div>
              ))}
            </div>
            <div>{placesButton(zone)}</div>
            {open[zone.id] ? <PlacesEditor zone={zone} onPlaces={(places) => setZone(zone.id, { places })} /> : null}
            {rowError(zone) ? <p className="text-xs font-medium text-danger">{rowError(zone)}</p> : null}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" size="sm" leftIcon={<Plus />} onClick={addZone}>
          Add destination
        </Button>
        <Button type="button" variant="ghost" size="sm" leftIcon={<ClipboardPaste />} aria-expanded={pasting} onClick={() => setPasting((current) => !current)}>
          Paste prices
        </Button>
      </div>
      {errors['transfer.zones'] ? <p className="text-xs font-medium text-danger">{errors['transfer.zones']}</p> : null}

      {pasting ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <Field
            label="Rows from your price sheet"
            description={`One destination per line: the name, then ${tiers.map((tier, index) => (roundTrips ? `${tierName(tier, index)} one way and round trip` : tierName(tier, index))).join(', then ')}. Copy them from a spreadsheet.`}
          >
            <Textarea rows={4} value={pasted} placeholder={`Playa del Carmen\t75\t140\t95\t180`} onChange={(event) => setPasted(event.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={parsePastedPrices(pasted).length === 0}
              onClick={() => {
                onChange(withPastedPrices(value, tiers, parsePastedPrices(pasted), roundTrips))
                setPasted('')
                setPasting(false)
              }}
            >
              Fill the table
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPasting(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-xs text-subtle">
        {shared ? 'Leave a price empty to not sell that ticket there.' : 'Guests see the price for the vehicle that fits their group. Leave a price empty to not offer it there.'}
        {roundTrips ? ' An empty round trip is twice the one way.' : ''}
      </p>
      {between && !shared ? <p className="text-xs text-subtle">Hotel to hotel costs the higher of the two destinations.</p> : null}
    </div>
  )
}

/** The hotels and areas in a destination, so guests find where they stay. Typed as a list, one per line or comma-separated. */
function PlacesEditor({ zone, onPlaces }: { zone: TransferZone; onPlaces: (places: string[]) => void }) {
  const [text, setText] = React.useState(() => zone.places.join(', '))
  return (
    <Field label={`Hotels and areas in ${zone.name.trim() || 'this destination'}`} labelSize="sm" description="Comma-separated. Guests search these.">
      <Textarea
        rows={2}
        value={text}
        placeholder="Grand Hyatt Playa del Carmen, Playacar, The Fives Beach Hotel"
        onChange={(event) => {
          setText(event.target.value)
          onPlaces([
            ...new Set(
              event.target.value
                .split(/[,\n]/)
                .map((place) => place.trim())
                .filter(Boolean),
            ),
          ])
        }}
      />
    </Field>
  )
}

/** A driver by the hour: a price per hour for each vehicle, and the fewest and most hours. */
function HourlyPrices({ value, tiers, onChange, currency, errors }: TransferPriceTableProps) {
  const set = (patch: Partial<DraftTransfer>) => onChange({ ...value, ...patch })
  const hoursInput = (key: 'minHours' | 'maxHours', label: string) => (
    <Field label={label} error={key === 'maxHours' ? errors['transfer.hours'] : undefined}>
      {(control) => (
        <Input {...control} type="number" min={1} max={24} suffix="hours" inputClassName="tabular" value={value[key]} onChange={(event) => set({ [key]: Math.min(24, Math.max(1, Math.floor(Number(event.target.value)) || 1)) })} />
      )}
    </Field>
  )
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex list-none flex-col gap-2 p-0">
        {tiers.map((tier, index) => (
          <li key={tier.id} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-3">
            <span className="truncate text-sm font-medium">{tier.label.trim() || `Vehicle ${index + 1}`}</span>
            <MoneyInput value={value.hourly[tier.id] ?? 0} onValueChange={(hour) => set({ hourly: { ...value.hourly, [tier.id]: hour } })} currency={currency} size="sm" allowEmpty placeholder="—" ariaLabel={`Per hour, ${tier.label || `vehicle ${index + 1}`}`} />
          </li>
        ))}
      </ul>
      {errors['transfer.hourly'] ? <p className="text-xs font-medium text-danger">{errors['transfer.hourly']}</p> : null}
      <div className="grid gap-4 sm:max-w-md sm:grid-cols-2">
        {hoursInput('minHours', 'Fewest hours')}
        {hoursInput('maxHours', 'Most hours')}
      </div>
      <p className="text-xs text-subtle">Per vehicle, per hour ({currencySymbol(currency)}). Leave a price empty to not offer that vehicle.</p>
    </div>
  )
}
