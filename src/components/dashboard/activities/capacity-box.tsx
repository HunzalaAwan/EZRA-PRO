'use client'

import * as React from 'react'
import { RotateCcw } from 'lucide-react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { sellsExtraSpots } from '@/lib/extra-spots'
import { cn } from '@/lib/utils'
import type { ActivityKind, WeekdayKey } from '@/types'

/* ==========================================================================
   CAPACITY — how many each time slot takes, on the Booking step right under
   the regular times. One usual number in the kind's own words (spots, a
   private group's size, spots per class, tickets per day, a rental's items
   out at once), the extra spots sold once those are full at one price, and
   "Different on some days" for a Mon–Sun table. A single date is changed on
   the calendar below; a date beats its weekday, which beats the usual number.
   ========================================================================== */

export type WeekMap = Partial<Record<WeekdayKey, number>>

export interface CapacityValue {
  /** The usual number. A rental: its items out at once (0: all of its stock). */
  spots: number
  /** Extra spots each time slot sells once the usual ones are full (a private group: guests over its size). */
  extraCount: number
  /** Each extra spot, minor units. */
  extraPrice: number
  /** Weekdays with their own number. null: the same every day (the switch is off). */
  spotsByWeekday: WeekMap | null
  /** Weekdays with their own extra spots (0: none that day). null: the same every day. */
  extraByWeekday: WeekMap | null
}

/** The words for one kind's capacity: the field, the table's column and the unit. */
export function capacityWords(kind: ActivityKind): { label: string; column: string; unit: [string, string]; placeholder: string } {
  switch (kind) {
    case 'charter':
      return { label: 'Group size', column: 'Group size', unit: ['guest', 'guests'], placeholder: '6' }
    case 'lesson':
      return { label: 'Spots per class', column: 'Spots', unit: ['spot', 'spots'], placeholder: '8' }
    case 'pass':
      return { label: 'Tickets per day', column: 'Tickets', unit: ['ticket', 'tickets'], placeholder: '60' }
    case 'rental':
      return { label: 'Items out at once', column: 'Items out', unit: ['item', 'items'], placeholder: '6' }
    default:
      return { label: 'Spots per time slot', column: 'Spots', unit: ['spot', 'spots'], placeholder: '16' }
  }
}

/** Monday first, the way owners think of a week. */
const WEEK: { key: WeekdayKey; short: string; long: string }[] = [
  { key: '1', short: 'Mon', long: 'Monday' },
  { key: '2', short: 'Tue', long: 'Tuesday' },
  { key: '3', short: 'Wed', long: 'Wednesday' },
  { key: '4', short: 'Thu', long: 'Thursday' },
  { key: '5', short: 'Fri', long: 'Friday' },
  { key: '6', short: 'Sat', long: 'Saturday' },
  { key: '0', short: 'Sun', long: 'Sunday' },
]

const num = (value: string, min = 0) => Math.max(min, Math.round(Number(value) || 0))
const cents = (value: string) => Math.max(0, Math.round(Number(value) * 100) || 0)
const plural = (n: number, [one, many]: [string, string]) => (n === 1 ? one : many)

/** Extra spots set anywhere in the box: the usual number or a weekday's. */
export const boxHasExtra = (value: Pick<CapacityValue, 'extraCount' | 'extraByWeekday'>) =>
  value.extraCount > 0 || Object.values(value.extraByWeekday ?? {}).some((extra) => typeof extra === 'number' && extra > 0)

export function CapacityBox({
  kind,
  value,
  onChange,
  stock = 0,
  currencySymbol,
  errors,
  weekly = true,
  extraElsewhere = false,
  sharedNote,
  fewest,
}: {
  kind: ActivityKind
  value: CapacityValue
  onChange: (patch: Partial<CapacityValue>) => void
  /** A rental's stock across its items (set per item on Pricing): items out can't be more. */
  stock?: number
  currencySymbol: string
  errors: Record<string, string>
  /** "Different on some days" is offered (not for a request with no set schedule). */
  weekly?: boolean
  /** Some dates on the calendar have extra spots of their own: the price is needed. */
  extraElsewhere?: boolean
  /** "Every location": with several locations, the numbers here are the same at each (a date is changed per location). */
  sharedNote?: string
  /** The fewest guests a time slot needs to go ahead, beside the spots (not for rentals, passes or packages). */
  fewest?: { label: string; value: number; onChange: (next: number) => void }
}) {
  const headingId = React.useId()
  const words = capacityWords(kind)
  const rental = kind === 'rental'
  const extraSold = sellsExtraSpots(kind)
  const charter = kind === 'charter'
  // A rental's usual items out: its cap, or all of its stock.
  const usual = rental ? (value.spots >= 1 ? Math.min(value.spots, Math.max(1, stock)) : stock) : value.spots
  const most = rental ? Math.max(1, stock) : 500
  const anyExtra = boxHasExtra(value) || extraElsewhere
  const on = weekly && (value.spotsByWeekday != null || value.extraByWeekday != null)
  const switchLabel = 'Different on some days'

  const setUsual = (next: number) => onChange({ spots: rental ? (next >= stock ? 0 : next) : next })
  // What is being typed: a rental's field shows its stock when empty, so the text is kept until it is left.
  const [typing, setTyping] = React.useState<string | null>(null)
  const setDay = (field: 'spotsByWeekday' | 'extraByWeekday', key: WeekdayKey, next: number | undefined, base: number) => {
    const map = { ...(value[field] ?? {}) }
    if (next === undefined || next === base) delete map[key]
    else map[key] = next
    onChange({ [field]: map })
  }
  const resetDay = (key: WeekdayKey) => {
    const spots = { ...(value.spotsByWeekday ?? {}) }
    const extra = { ...(value.extraByWeekday ?? {}) }
    delete spots[key]
    delete extra[key]
    onChange({ spotsByWeekday: spots, extraByWeekday: extra })
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-line p-4" aria-labelledby={headingId}>
      <h3 id={headingId} className="flex items-baseline gap-2 text-sm font-semibold">
        Capacity
        {sharedNote ? <span className="text-xs font-normal text-subtle">{sharedNote}</span> : null}
      </h3>
      <div className={cn('grid gap-4 sm:grid-cols-2', (extraSold ? 3 : 1) + (fewest ? 1 : 0) > 2 && 'xl:grid-cols-4')}>
        <Field label={words.label} required error={errors.maxCapacity} description={rental ? `Up to the ${stock} in stock.` : undefined}>
          {(control) => (
            <Input
              {...control}
              type="number"
              min={1}
              max={most}
              value={typing ?? (usual > 0 ? String(usual) : '')}
              placeholder={words.placeholder}
              suffix={rental ? `of ${stock}` : plural(usual, words.unit)}
              onChange={(event) => {
                const text = event.target.value
                setTyping(text)
                // Cleared on a rental: nothing changes until a number is typed (empty would mean all of the stock).
                if (rental && text.trim() === '') return
                setUsual(Math.min(most, num(text)))
              }}
              onBlur={() => setTyping(null)}
            />
          )}
        </Field>
        {fewest ? (
          <Field label={fewest.label} error={errors.minParticipants}>
            {(control) => (
              <Input
                {...control}
                type="number"
                min={1}
                value={fewest.value}
                suffix={fewest.value === 1 ? 'guest' : 'guests'}
                onChange={(event) => fewest.onChange(Math.max(1, num(event.target.value)))}
              />
            )}
          </Field>
        ) : null}
        {extraSold ? (
          <>
            <Field
              label="Extra spots"
              optional
              error={errors['extraSpots.count']}
              description={charter ? `Guests above ${usual > 0 ? usual : 'the group size'}` : `Sold once the ${usual > 0 ? `${usual} ` : ''}are full`}
            >
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={0}
                  max={500}
                  placeholder="None"
                  suffix={plural(value.extraCount, ['spot', 'spots'])}
                  value={value.extraCount > 0 ? value.extraCount : ''}
                  onChange={(event) => onChange({ extraCount: Math.min(500, num(event.target.value)) })}
                />
              )}
            </Field>
            <Field label="Price per extra spot" required={anyExtra} disabled={!anyExtra} error={errors['extraSpots.price']}>
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={0}
                  disabled={!anyExtra}
                  placeholder={anyExtra ? '0' : 'No extra spots'}
                  leftIcon={<span className="text-sm font-medium">{currencySymbol}</span>}
                  value={anyExtra && value.extraPrice > 0 ? value.extraPrice / 100 : ''}
                  onChange={(event) => onChange({ extraPrice: cents(event.target.value) })}
                />
              )}
            </Field>
          </>
        ) : null}
      </div>

      {weekly ? (
        <div className="flex flex-col gap-3 border-t border-line-subtle pt-4">
          <label className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-sm font-medium">{switchLabel}</span>
              <span className="block text-xs text-subtle">Like more on weekends. For one date, click it on the calendar below.</span>
            </span>
            <Switch
              checked={on}
              onCheckedChange={(next) => onChange(next ? { spotsByWeekday: value.spotsByWeekday ?? {}, extraByWeekday: value.extraByWeekday ?? {} } : { spotsByWeekday: null, extraByWeekday: null })}
              aria-label={switchLabel}
            />
          </label>
          {on ? (
            <table className="w-full max-w-md table-fixed border-separate border-spacing-y-1 text-left">
              <thead>
                <tr className="text-xs text-subtle">
                  <th scope="col" className="w-14 font-medium">
                    Day
                  </th>
                  <th scope="col" className="font-medium">
                    {words.column}
                  </th>
                  {extraSold ? (
                    <th scope="col" className="font-medium">
                      Extra spots
                    </th>
                  ) : null}
                  <th scope="col" className="w-10">
                    <span className="sr-only">Reset</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {WEEK.map((day) => {
                  const ownSpots = value.spotsByWeekday?.[day.key]
                  const ownExtra = value.extraByWeekday?.[day.key]
                  const spotsChanged = ownSpots !== undefined && ownSpots !== usual
                  const extraChanged = extraSold && ownExtra !== undefined && ownExtra !== value.extraCount
                  const changed = spotsChanged || extraChanged
                  return (
                    <tr key={day.key}>
                      <th scope="row" className={cn('pr-2 text-sm', changed ? 'font-semibold text-foreground' : 'font-normal text-muted')}>
                        {day.short}
                      </th>
                      <td className="pr-2">
                        <DayCell
                          label={`${words.column} on ${day.long}`}
                          own={ownSpots}
                          usual={usual}
                          min={1}
                          max={most}
                          onValue={(next) => setDay('spotsByWeekday', day.key, next, usual)}
                        />
                      </td>
                      {extraSold ? (
                        <td className="pr-2">
                          <DayCell
                            label={`Extra spots on ${day.long}`}
                            own={ownExtra}
                            usual={value.extraCount}
                            min={0}
                            max={500}
                            onValue={(next) => setDay('extraByWeekday', day.key, next, value.extraCount)}
                          />
                        </td>
                      ) : null}
                      <td>
                        {changed ? (
                          <button
                            type="button"
                            onClick={() => resetDay(day.key)}
                            aria-label={`Reset ${day.long}`}
                            className="grid size-8 place-items-center rounded-lg text-faint transition-colors hover:bg-surface-sunken hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
                          >
                            <RotateCcw className="size-3.5" aria-hidden="true" />
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/** One weekday's number: shows the usual one until changed (then highlighted); cleared while typing, it goes back to it. */
function DayCell({ label, own, usual, min, max, onValue }: { label: string; own: number | undefined; usual: number; min: number; max: number; onValue: (next: number | undefined) => void }) {
  const [typing, setTyping] = React.useState<string | null>(null)
  const changed = own !== undefined && own !== usual
  const shown = typing ?? String(own ?? (usual >= min ? usual : ''))
  return (
    <Input
      type="number"
      size="sm"
      min={min}
      max={max}
      aria-label={label}
      value={shown}
      placeholder={usual >= min ? String(usual) : ''}
      className={cn('max-w-[6rem]', changed && 'border-primary/60 bg-primary-soft/30')}
      onFocus={() => setTyping(shown)}
      onChange={(event) => {
        const text = event.target.value
        setTyping(text)
        const next = Math.floor(Number(text))
        if (text.trim() === '') onValue(undefined)
        else if (Number.isFinite(next) && next >= min) onValue(Math.min(max, next))
      }}
      onBlur={() => setTyping(null)}
    />
  )
}
