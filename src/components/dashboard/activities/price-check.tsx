'use client'

import * as React from 'react'
import { Minus, Plus } from 'lucide-react'

import type { CurrencyCode } from '@/types'
import type { PricingRule } from '@/lib/pricing'
import { rentalModes, type RentalMode } from '@/lib/activity-kinds'
import { chargeByOf, explainPrice, fromPrice, priceBooking, priceCalendar, shortDay, unitPriceDetail, type PricedActivity, type PriceContext, type RentalPricing } from '@/lib/price-engine'
import { addMonthsKey, shiftDayKey } from '@/lib/activity-schedule'
import { cn, formatCurrency } from '@/lib/utils'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'

/* ==========================================================================
   PRICE CHECK — what a booking costs on any day, worked out by the same
   price engine the storefront and checkout use, with each step named; and
   a year of prices, each day tinted lower, usual or higher.
   ========================================================================== */

const pad = (n: number) => String(n).padStart(2, '0')
const keyOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const addDays = (key: string, days: number) => {
  const date = new Date(`${key}T12:00:00`)
  date.setDate(date.getDate() + days)
  return keyOf(date)
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
/** Weeks start on Monday, like the dashboard's date pickers and the Schedule step's calendar. */
const WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MODE_LABEL: Record<RentalMode, string> = { hour: 'By the hour', day: 'By the day', length: 'By length' }

export interface PriceCheckProps {
  activity: PricedActivity
  currency: CurrencyCode
  /** The demo clock: bookings in the check are made now. */
  nowIso: string
  /** The activity's start times. */
  startTimes: string[]
  /** The start times one day actually has, from the schedule. Absent: every day has all of `startTimes`. */
  timesOn?: (dateKey: string) => string[]
  /** The business's price rules (Pricing → Price rules). */
  businessRules: PricingRule[]
  /** Spots per time slot, for filling up and quiet times. */
  capacity: number
  /** Charters: the most guests one carries. */
  maxGuests?: number
}

export function PriceCheck(props: PriceCheckProps) {
  const todayKey = props.nowIso.slice(0, 10)
  const [view, setView] = React.useState<'booking' | 'year'>('booking')
  const [dateKey, setDateKey] = React.useState(() => addDays(todayKey, 7))
  const rental = props.activity.kind === 'rental' ? rentalModes({ kind: 'rental', rental: props.activity.rental }) : []
  const [mode, setMode] = React.useState<RentalMode | undefined>(rental[0])
  const rentalMode = mode && rental.includes(mode) ? mode : rental[0]

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-sunken/40 p-3.5">
      <Segmented
        size="sm"
        label="Price check view"
        value={view}
        onValueChange={setView}
        options={[
          { value: 'booking', label: 'Try a booking' },
          { value: 'year', label: 'Next 12 months' },
        ]}
        className="self-start"
      />
      {rental.length > 1 ? (
        <Segmented
          size="sm"
          label="How it is rented"
          value={rentalMode ?? rental[0]}
          onValueChange={(next) => setMode(next)}
          options={rental.map((entry) => ({ value: entry, label: MODE_LABEL[entry] }))}
          className="self-start"
        />
      ) : null}
      {view === 'booking' ? (
        <BookingCheck {...props} todayKey={todayKey} dateKey={dateKey} onDate={setDateKey} rentalMode={rentalMode} />
      ) : (
        <YearPrices
          {...props}
          todayKey={todayKey}
          selected={dateKey}
          rentalMode={rentalMode}
          onPick={(key) => {
            setDateKey(key)
            setView('booking')
          }}
        />
      )}
    </div>
  )
}

/* ---------- one booking ---------- */

function Stepper({ value, onChange, label, min = 0, max = 99 }: { value: number; onChange: (value: number) => void; label: string; min?: number; max?: number }) {
  return (
    <span className="inline-flex h-9 shrink-0 items-center gap-1.5">
      <IconButton type="button" size="xs" variant="outline" shape="circle" aria-label={`One fewer ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}>
        <Minus />
      </IconButton>
      <span className="w-6 text-center text-sm font-semibold tabular" aria-live="polite">
        {value}
      </span>
      <IconButton type="button" size="xs" variant="outline" shape="circle" aria-label={`One more ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}>
        <Plus />
      </IconButton>
    </span>
  )
}

function BookingCheck({
  activity,
  currency,
  nowIso,
  startTimes,
  timesOn,
  businessRules,
  capacity,
  maxGuests,
  todayKey,
  dateKey,
  onDate,
  rentalMode,
}: PriceCheckProps & { todayKey: string; dateKey: string; onDate: (key: string) => void; rentalMode?: RentalMode }) {
  const kind = activity.kind ?? 'trip'
  // The day's own start times when the schedule gives some, else every start time.
  const dayTimes = timesOn?.(dateKey) ?? []
  const times = [...new Set(dayTimes.length > 0 ? dayTimes : startTimes)].sort()
  const [time, setTime] = React.useState(times[0] ?? '10:00')
  const shownTime = times.length > 0 && !times.includes(time) ? times[0] : time
  const [qty, setQty] = React.useState<Record<string, number>>({})
  const [bookedSet, setBooked] = React.useState(0)
  const [privateOn, setGoPrivate] = React.useState(false)
  // Switched on here, then private booking was switched off above: back to tickets.
  const goPrivate = privateOn && Boolean(activity.privateOption?.enabled)
  const [partySet, setParty] = React.useState(() => Math.min(4, Math.max(1, maxGuests ?? 4)))
  const party = Math.min(partySet, Math.max(1, maxGuests ?? 99))
  const [span, setSpan] = React.useState({ hours: Math.max(1, activity.rental?.minHours ?? 2), days: Math.max(1, activity.rental?.minDays ?? 1) })
  const [lengthId, setLengthId] = React.useState<string | undefined>(undefined)
  const lengths = activity.rental?.lengths ?? []
  const pickedLength = lengths.find((entry) => entry.id === lengthId)?.id ?? lengths[0]?.id

  const one = kind === 'charter' || kind === 'rental'
  const qtyOf = (tierId: string, index: number) => qty[tierId] ?? (index === 0 ? (one ? 1 : 2) : 0)
  const lines = activity.priceTiers.map((tier, index) => ({ tierId: tier.id, qty: qtyOf(tier.id, index) }))
  const rentalCtx: RentalPricing | undefined = rentalMode ? { mode: rentalMode, hours: span.hours, days: span.days, lengthId: rentalMode === 'length' ? pickedLength : undefined } : undefined
  const startsAt = `${dateKey}T${shownTime || '10:00'}:00`
  const demand = (activity.priceChanges ?? []).some((change) => change.active && (change.kind === 'filling_up' || change.kind === 'slow_time'))
  // Only a filling-up or quiet-times change reads it, and never past the spots there are.
  const booked = demand && capacity > 0 ? Math.min(bookedSet, capacity) : 0
  const result = priceBooking({
    activity,
    lines,
    startsAt,
    nowIso,
    capacity: capacity > 0 ? capacity : undefined,
    booked,
    businessRules,
    private: goPrivate,
    party: kind === 'charter' ? party : undefined,
    rental: rentalCtx,
  })
  const ctx: PriceContext = { startsAt, nowIso, capacity: capacity > 0 ? capacity : undefined, booked, businessRules, guests: result.guests, rental: rentalCtx }
  const grouped = chargeByOf(activity) === 'group' && kind !== 'charter' && Boolean(activity.groupPrice)
  const steps = explainPrice(result, currency)
  const money = (value: number) => formatCurrency(value, currency, { decimals: value % 100 !== 0 })
  const past = dateKey < todayKey

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-subtle">
          Date
          <Input type="date" size="sm" className="w-40" value={dateKey} min={todayKey} onChange={(event) => event.target.value && onDate(event.target.value)} />
        </label>
        {rentalMode === 'day' ? null : (
          <label className="flex flex-col gap-1 text-xs text-subtle">
            Start time
            {times.length > 0 ? (
              <select value={shownTime} onChange={(event) => setTime(event.target.value)} className="h-9 rounded-md border border-line bg-surface px-2 text-[0.8125rem] text-foreground tabular shadow-xs">
                {times.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            ) : (
              <Input type="time" size="sm" className="w-32" value={shownTime} onChange={(event) => setTime(event.target.value || '10:00')} />
            )}
          </label>
        )}
        {rentalMode === 'hour' ? (
          <div role="group" aria-label="Hours" className="flex flex-col gap-1 text-xs text-subtle">
            <span aria-hidden="true">Hours</span>
            <Stepper value={span.hours} onChange={(hours) => setSpan((current) => ({ ...current, hours }))} label="hour" min={1} max={24} />
          </div>
        ) : null}
        {rentalMode === 'day' ? (
          <div role="group" aria-label="Days" className="flex flex-col gap-1 text-xs text-subtle">
            <span aria-hidden="true">Days</span>
            <Stepper value={span.days} onChange={(days) => setSpan((current) => ({ ...current, days }))} label="day" min={1} max={30} />
          </div>
        ) : null}
        {rentalMode === 'length' && lengths.length > 0 ? (
          <label className="flex flex-col gap-1 text-xs text-subtle">
            Length
            <select value={pickedLength} onChange={(event) => setLengthId(event.target.value)} className="h-9 rounded-md border border-line bg-surface px-2 text-[0.8125rem] text-foreground shadow-xs">
              {lengths.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {kind === 'charter' ? (
          <div role="group" aria-label="Guests" className="flex flex-col gap-1 text-xs text-subtle">
            <span aria-hidden="true">Guests</span>
            <Stepper value={party} onChange={setParty} label="guest" min={1} max={Math.max(1, maxGuests ?? 99)} />
          </div>
        ) : null}
        {demand && capacity > 0 ? (
          <div role="group" aria-label="Already booked" className="flex flex-col gap-1 text-xs text-subtle">
            <span aria-hidden="true">Already booked</span>
            <Stepper value={booked} onChange={setBooked} label="booked spot" max={capacity} />
          </div>
        ) : null}
      </div>

      <ul className="flex list-none flex-col divide-y divide-line-subtle rounded-lg border border-line bg-surface p-0">
        {activity.priceTiers.map((tier, index) => {
          const detail = unitPriceDetail(activity, tier.id, ctx)
          return (
            <li key={tier.id} className="flex items-center gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-sm">{tier.label || 'Unnamed'}</span>
              {grouped || goPrivate ? null : (
                <span className="shrink-0 text-[0.8125rem] tabular">
                  {detail.price !== detail.base ? <span className="mr-1.5 text-faint line-through">{money(detail.base)}</span> : null}
                  {money(detail.price)}
                </span>
              )}
              <Stepper value={qtyOf(tier.id, index)} onChange={(value) => setQty((current) => ({ ...current, [tier.id]: value }))} label={tier.label || 'ticket'} />
            </li>
          )
        })}
      </ul>

      {activity.privateOption?.enabled ? (
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Private booking</span>
          <Switch size="sm" checked={goPrivate} onCheckedChange={setGoPrivate} aria-label="Private booking" />
        </label>
      ) : null}

      <div className="rounded-lg border border-line bg-surface px-3 py-2.5">
        <ul className="flex list-none flex-col gap-1 p-0 text-[0.8125rem]">
          {result.ticketLines.map((line) => (
            <li key={line.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-muted">
                <span className="tabular">{line.quantity} ×</span> {line.label}
              </span>
              <span className="shrink-0 tabular">{money(line.total)}</span>
            </li>
          ))}
          {result.adjustments.map((entry) => (
            <li key={entry.id} className="flex items-baseline justify-between gap-3 text-muted">
              <span>{entry.label}</span>
              <span className="shrink-0 tabular">{entry.amount < 0 ? `−${money(-entry.amount)}` : `+${money(entry.amount)}`}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line-subtle pt-2">
          <span className="text-sm font-semibold">
            {shortDay(dateKey)}
            {rentalMode === 'day' ? '' : `, ${shownTime}`}
          </span>
          <span className="font-display text-lg font-semibold tabular">{money(result.subtotalTickets)}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {steps.length > 0 ? (
            steps.map((step) => (
              <span key={step} className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-muted">
                {step}
              </span>
            ))
          ) : (
            <span className="text-xs text-faint">{past ? 'This day has passed.' : 'Usual prices on this day.'}</span>
          )}
          <span className="ml-auto text-xs text-faint">Before extras and fees</span>
        </div>
      </div>
    </div>
  )
}

/* ---------- a year of prices ---------- */

const TINT: Record<'low' | 'base' | 'high', string> = {
  low: 'bg-success-soft text-success',
  base: 'text-muted hover:bg-surface-sunken',
  high: 'bg-warning-soft text-warning',
}

function YearPrices({
  activity,
  currency,
  startTimes,
  timesOn,
  businessRules,
  todayKey,
  selected,
  rentalMode,
  onPick,
}: PriceCheckProps & { todayKey: string; selected: string; rentalMode?: RentalMode; onPick: (key: string) => void }) {
  // Start times only matter to a start-time change; without one, each day is priced once.
  // With the schedule's own times, each day is priced only at the times it runs.
  const timed = (activity.priceChanges ?? []).some((change) => change.active && change.kind === 'time_of_day')
  const times = React.useMemo(() => (timed ? [...new Set(startTimes)].sort() : []), [startTimes, timed])
  const days = React.useMemo(
    () =>
      priceCalendar(activity, todayKey, 12, {
        businessRules,
        times: times.length > 0 ? times : undefined,
        timesOn: timed ? timesOn : undefined,
        rental: rentalMode ? { mode: rentalMode } : undefined,
      }),
    [activity, todayKey, businessRules, times, timed, timesOn, rentalMode],
  )
  const months = React.useMemo(() => {
    const out: { key: string; label: string; lead: number; days: typeof days }[] = []
    for (const day of days) {
      const key = day.dateKey.slice(0, 7)
      let month = out.at(-1)
      if (!month || month.key !== key) {
        const [year, index] = key.split('-').map(Number)
        month = { key, label: `${MONTHS[index - 1]} ${year}`, lead: (new Date(`${key}-01T12:00:00`).getDay() + 6) % 7, days: [] }
        out.push(month)
      }
      month.days.push(day)
    }
    return out
  }, [days])
  const usual = rentalMode ? fromPrice(activity, rentalMode) : fromPrice(activity)
  const money = (value: number) => formatCurrency(value, currency, { decimals: value % 100 !== 0 })
  const counts = days.reduce(
    (acc, day) => (day.dateKey < todayKey ? acc : { ...acc, [day.level]: acc[day.level] + 1 }),
    { low: 0, base: 0, high: 0 } as Record<'low' | 'base' | 'high', number>,
  )

  /* One tab stop for the whole year: arrows move a day or a week, Page Up / Page Down a month, Home / End the week. */
  const gridRef = React.useRef<HTMLDivElement>(null)
  const [focusKey, setFocusKey] = React.useState<string | null>(null)
  const firstKey = days.find((day) => day.dateKey >= todayKey)?.dateKey
  const lastKey = days.at(-1)?.dateKey
  const inYear = (key: string | null | undefined): key is string => Boolean(key && firstKey && lastKey && key >= firstKey && key <= lastKey)
  const tabStop = inYear(focusKey) ? focusKey : inYear(selected) ? selected : firstKey
  const moveFrom = (event: React.KeyboardEvent, dateKey: string) => {
    const weekday = (new Date(`${dateKey}T12:00:00`).getDay() + 6) % 7
    const next =
      event.key === 'ArrowLeft' ? shiftDayKey(dateKey, -1)
      : event.key === 'ArrowRight' ? shiftDayKey(dateKey, 1)
      : event.key === 'ArrowUp' ? shiftDayKey(dateKey, -7)
      : event.key === 'ArrowDown' ? shiftDayKey(dateKey, 7)
      : event.key === 'PageUp' ? addMonthsKey(dateKey, -1)
      : event.key === 'PageDown' ? addMonthsKey(dateKey, 1)
      : event.key === 'Home' ? shiftDayKey(dateKey, -weekday)
      : event.key === 'End' ? shiftDayKey(dateKey, 6 - weekday)
      : undefined
    if (!next || !firstKey || !lastKey) return
    event.preventDefault()
    const key = next < firstKey ? firstKey : next > lastKey ? lastKey : next
    setFocusKey(key)
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${key}"]`)?.focus()
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-subtle">
        <span>
          Usual price <span className="font-semibold text-foreground tabular">{money(usual)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-success-soft ring-1 ring-success/30" aria-hidden="true" />
          Lower · {counts.low} days
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-warning-soft ring-1 ring-warning/30" aria-hidden="true" />
          Higher · {counts.high} days
        </span>
        <span className="ml-auto text-faint">Pick a day to try it</span>
      </div>
      <div ref={gridRef} className="grid grid-cols-2 gap-x-3 gap-y-4 xl:grid-cols-3">
        {months.map((month) => (
          <div key={month.key} className="min-w-0">
            <p className="mb-1 text-xs font-semibold text-foreground">{month.label}</p>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAY_LETTERS.map((letter, index) => (
                <span key={index} className="text-xs text-faint" aria-hidden="true">
                  {letter}
                </span>
              ))}
              {Array.from({ length: month.lead }, (_, index) => (
                <span key={`gap-${index}`} aria-hidden="true" />
              ))}
              {month.days.map((day) => {
                const gone = day.dateKey < todayKey
                const label = `${shortDay(day.dateKey)}: ${money(day.leadPrice)}${day.changes.length > 0 ? ` (${day.changes.join(', ')})` : ''}`
                return (
                  <button
                    key={day.dateKey}
                    type="button"
                    disabled={gone}
                    data-day={day.dateKey}
                    tabIndex={day.dateKey === tabStop ? 0 : -1}
                    title={label}
                    aria-label={label}
                    aria-pressed={day.dateKey === selected}
                    onClick={() => {
                      setFocusKey(day.dateKey)
                      onPick(day.dateKey)
                    }}
                    onKeyDown={(event) => moveFrom(event, day.dateKey)}
                    className={cn(
                      'h-7 rounded-md text-xs tabular transition-colors duration-150',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                      gone ? 'cursor-default text-faint/60' : TINT[day.level],
                      day.dateKey === todayKey && 'font-semibold ring-1 ring-line-strong',
                      day.dateKey === selected && !gone && 'ring-2 ring-primary',
                    )}
                  >
                    {Number(day.dateKey.slice(8))}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
