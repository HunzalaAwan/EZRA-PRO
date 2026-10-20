'use client'

import * as React from 'react'
import { CalendarDays, CalendarRange, ChevronDown, Clock, Hourglass, Plus, Sun, Timer, Trash2, TrendingDown, TrendingUp, X, type LucideIcon } from 'lucide-react'

import type { CurrencyCode, PriceChange, PriceChangeKind } from '@/types'
import { describePriceChange, shortDay } from '@/lib/price-engine'
import { cn, currencySymbol } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/* ==========================================================================
   PRICE CHANGES — the activity's own ups and downs, each one a sentence:
   "From Jun 1 to Aug 31 prices go up 15%", "Booked 30 days ahead, 10% off".
   The price engine applies them (one date change a day, a start-time change
   on top, and at most one demand change: the best for the guest).
   ========================================================================== */

export const PRICE_CHANGE_PRESETS: { kind: PriceChangeKind; label: string; hint: string; icon: LucideIcon }[] = [
  { kind: 'season', label: 'Season', hint: 'A date range, like summer', icon: Sun },
  { kind: 'weekdays', label: 'Weekends', hint: 'Days of the week', icon: CalendarDays },
  { kind: 'time_of_day', label: 'Time of day', hint: 'Set start times', icon: Clock },
  { kind: 'dates', label: 'Specific dates', hint: 'Holidays and events', icon: CalendarRange },
  { kind: 'early_bird', label: 'Book early', hint: 'Booked well ahead', icon: Hourglass },
  { kind: 'last_minute', label: 'Last minute', hint: 'Close to the start', icon: Timer },
  { kind: 'filling_up', label: 'Filling up', hint: 'When nearly full', icon: TrendingUp },
  { kind: 'slow_time', label: 'Quiet times', hint: 'When few have booked', icon: TrendingDown },
]

const ICON: Record<PriceChangeKind, LucideIcon> = Object.fromEntries(PRICE_CHANGE_PRESETS.map((entry) => [entry.kind, entry.icon])) as Record<PriceChangeKind, LucideIcon>

/** Kinds whose sentence works on a date, so a set price makes sense. */
const DATED = new Set<PriceChangeKind>(['season', 'weekdays', 'time_of_day', 'dates'])

let changeCounter = 0

/** A new change with a sensible start, ready to edit. */
export function newPriceChange(kind: PriceChangeKind, startTimes: string[] = []): PriceChange {
  changeCounter += 1
  const id = `pc_${Date.now().toString(36)}_${changeCounter}`
  const base = { id, kind, active: true }
  switch (kind) {
    case 'season':
      return { ...base, from: '06-01', to: '08-31', effect: { type: 'percent', value: 15 } }
    case 'weekdays':
      return { ...base, weekdays: [0, 6], effect: { type: 'amount', value: 1000 } }
    case 'time_of_day':
      return { ...base, times: [startTimes.at(-1) ?? '17:30'], effect: { type: 'amount', value: 1500 } }
    case 'dates':
      return { ...base, dates: [], effect: { type: 'percent', value: 20 } }
    case 'early_bird':
      return { ...base, daysAhead: 30, effect: { type: 'percent', value: -10 } }
    case 'last_minute':
      return { ...base, hoursBefore: 24, effect: { type: 'percent', value: -15 } }
    case 'filling_up':
      return { ...base, soldPercent: 80, effect: { type: 'percent', value: 10 } }
    case 'slow_time':
      return { ...base, soldPercent: 50, hoursBefore: 24, effect: { type: 'percent', value: -20 } }
  }
}

/** Has everything its sentence needs and moves the price. Unfinished ones are saved switched off. */
export function isCompleteChange(change: PriceChange): boolean {
  // A set price of nothing would give tickets away: it needs a price.
  const moves = change.effect.value !== 0
  if (!moves) return false
  switch (change.kind) {
    case 'season':
      return Boolean(change.from && change.to)
    case 'weekdays':
      return (change.weekdays ?? []).length > 0
    case 'time_of_day':
      return (change.times ?? []).length > 0
    case 'dates':
      return (change.dates ?? []).length > 0
    default:
      return true
  }
}

/* ---------- small blanks ---------- */

const blank = 'h-9 rounded-md border border-line bg-surface px-2 text-[0.8125rem] text-foreground shadow-xs transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary'

/** A number typed as text, so "12." and an empty field work while typing. */
function NumericInput({
  value,
  onValue,
  decimals = false,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  ...rest
}: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & { value: number | undefined; onValue: (value: number | undefined) => void; decimals?: boolean; min?: number; max?: number }) {
  const format = (next: number | undefined) => (next === undefined || Number.isNaN(next) ? '' : String(next))
  const [text, setText] = React.useState(() => format(value))
  const [focused, setFocused] = React.useState(false)
  React.useEffect(() => {
    if (!focused) setText(format(value))
  }, [value, focused])
  return (
    <Input
      {...rest}
      size="sm"
      inputMode={decimals ? 'decimal' : 'numeric'}
      inputClassName="tabular"
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false)
        setText(format(value))
      }}
      onChange={(event) => {
        const raw = event.target.value.replace(decimals ? /[^0-9.]/g : /[^0-9]/g, '')
        setText(raw)
        const parsed = decimals ? Number.parseFloat(raw) : Number.parseInt(raw, 10)
        onValue(Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : undefined)
      }}
    />
  )
}

function NumberBlank({ value, onChange, label, min = 0, max = 999, suffix, className }: { value: number | undefined; onChange: (value: number | undefined) => void; label: string; min?: number; max?: number; suffix?: string; className?: string }) {
  return (
    <NumericInput
      value={value}
      onValue={onChange}
      min={min}
      max={max}
      aria-label={label}
      className={cn('w-28', className)}
      suffix={suffix ? <span className="text-xs text-subtle">{suffix}</span> : undefined}
    />
  )
}

/** "go up by [15] [%]", "go down by [$10]", "are [$199]". */
function EffectBlank({ effect, onChange, currency, allowSet }: { effect: PriceChange['effect']; onChange: (effect: PriceChange['effect']) => void; currency: CurrencyCode; allowSet: boolean }) {
  // A cleared number has no sign, so the way it goes is remembered while it is blank.
  const [lean, setLean] = React.useState<'up' | 'down'>(effect.value < 0 ? 'down' : 'up')
  const direction = effect.type === 'set' ? 'set' : effect.value < 0 ? 'down' : effect.value > 0 ? 'up' : lean
  const unit = effect.type === 'amount' ? 'amount' : 'percent'
  const magnitude = Math.abs(effect.value)
  const shown = effect.type === 'percent' ? magnitude : magnitude / 100
  const symbol = currencySymbol(currency)
  const build = (dir: string, nextUnit: string, size: number): PriceChange['effect'] => {
    if (dir === 'set') return { type: 'set', value: Math.max(0, Math.round(size * 100)) }
    const sign = dir === 'down' ? -1 : 1
    return nextUnit === 'percent' ? { type: 'percent', value: sign * Math.min(dir === 'down' ? 100 : 300, Math.round(size * 10) / 10) } : { type: 'amount', value: sign * Math.round(size * 100) }
  }
  // Up and down keep the number. A set price and a change don't share one: a set price starts blank,
  // and leaving one starts at 10% (0% would lose which way it goes).
  const turn = (dir: string) => {
    if (dir === 'up' || dir === 'down') setLean(dir)
    if (dir === 'set') return onChange(effect.type === 'amount' ? build('set', unit, shown) : { type: 'set', value: 0 })
    if (direction === 'set') return onChange(build(dir, 'percent', 10))
    onChange(build(dir, unit, shown || 10))
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-muted">prices</span>
      <select aria-label="Up or down" className={blank} value={direction} onChange={(event) => turn(event.target.value)}>
        <option value="up">go up by</option>
        <option value="down">go down by</option>
        {allowSet ? <option value="set">are</option> : null}
      </select>
      {direction === 'set' ? (
        <NumericInput
          decimals
          aria-label="Price"
          className="w-28"
          leftIcon={<span className="text-xs font-medium text-subtle">{symbol}</span>}
          value={shown || undefined}
          onValue={(next) => onChange(build('set', unit, next ?? 0))}
        />
      ) : (
        <>
          <NumericInput
            decimals
            aria-label={unit === 'percent' ? 'Percent' : 'Amount'}
            className="w-20"
            value={shown || undefined}
            onValue={(next) => onChange(build(direction, unit, next ?? 0))}
          />
          <select aria-label="Percent or amount" className={blank} value={unit} onChange={(event) => onChange(build(direction, event.target.value, shown))}>
            <option value="percent">%</option>
            <option value="amount">{symbol}</option>
          </select>
        </>
      )}
    </span>
  )
}

const WEEK: { day: number; label: string }[] = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
]

function Chip({ children, onRemove, label }: { children: React.ReactNode; onRemove: () => void; label: string }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface py-0.5 pr-1 pl-2.5 text-[0.8125rem] font-medium tabular">
      {children}
      <button type="button" aria-label={label} onClick={onRemove} className="grid size-5 place-items-center rounded-full text-faint hover:bg-surface-sunken hover:text-danger">
        <X className="size-3" aria-hidden="true" />
      </button>
    </span>
  )
}

/** Day keys from today on; "MM-DD" turned into the next time it comes round. */
function datedKey(mmdd: string, todayKey: string): string {
  const year = Number(todayKey.slice(0, 4))
  const key = `${year}-${mmdd}`
  return key < todayKey ? `${year + 1}-${mmdd}` : key
}

/**
 * A yearly season ("MM-DD" ends) as real dates for the date fields: the run
 * going on now, or the next one. One that wraps past New Year starts the year
 * before its end.
 */
function yearlyRun(from: string, to: string, todayKey: string): { from: string; to: string } {
  const year = Number(todayKey.slice(0, 4))
  const today = todayKey.slice(5)
  if (from <= to) {
    const runYear = to < today ? year + 1 : year
    return { from: `${runYear}-${from}`, to: `${runYear}-${to}` }
  }
  return today <= to ? { from: `${year - 1}-${from}`, to: `${year}-${to}` } : { from: `${year}-${from}`, to: `${year + 1}-${to}` }
}

/* ---------- one change's sentence ---------- */

function ChangeSentence({
  change,
  onChange,
  currency,
  todayKey,
  startTimes,
}: {
  change: PriceChange
  onChange: (change: PriceChange) => void
  currency: CurrencyCode
  todayKey: string
  startTimes: string[]
}) {
  const set = (patch: Partial<PriceChange>) => onChange({ ...change, ...patch })
  const [time, setTime] = React.useState('')
  const [date, setDate] = React.useState('')
  const row = 'flex flex-wrap items-center gap-2 text-sm'

  if (change.kind === 'season') {
    const yearly = (change.from ?? change.to ?? '').length === 5
    const store = (key: string) => (yearly ? key.slice(5) : key)
    // Yearly ends are shown as the run going on now or the next one, never one already over.
    const run = yearly && change.from && change.to ? yearlyRun(change.from, change.to, todayKey) : undefined
    const shown = (value: string | undefined, end: 'from' | 'to') => (!value ? '' : run ? run[end] : value.length === 5 ? datedKey(value, todayKey) : value)
    const toggleYearly = (on: boolean) => {
      const fromDay = change.from?.slice(-5)
      const toDay = change.to?.slice(-5)
      if (on) return set({ from: fromDay, to: toDay })
      if (!fromDay || !toDay) return set({ from: fromDay && datedKey(fromDay, todayKey), to: toDay && datedKey(toDay, todayKey) })
      set(yearlyRun(fromDay, toDay, todayKey))
    }
    return (
      <div className="flex flex-col gap-2.5">
        <div className={row}>
          <span className="text-muted">From</span>
          <Input type="date" size="sm" className="w-40" aria-label="First day" value={shown(change.from, 'from')} onChange={(event) => event.target.value && set({ from: store(event.target.value) })} />
          <span className="text-muted">to</span>
          <Input type="date" size="sm" className="w-40" aria-label="Last day" value={shown(change.to, 'to')} onChange={(event) => event.target.value && set({ to: store(event.target.value) })} />
          <label className="ml-1 inline-flex items-center gap-2 text-[0.8125rem] text-muted">
            <Switch size="sm" checked={yearly} onCheckedChange={toggleYearly} aria-label="Every year" />
            Every year
          </label>
        </div>
        <div className={row}>
          <EffectBlank effect={change.effect} onChange={(effect) => set({ effect })} currency={currency} allowSet />
        </div>
      </div>
    )
  }

  if (change.kind === 'weekdays') {
    const days = change.weekdays ?? []
    return (
      <div className="flex flex-col gap-2.5">
        <div className={row}>
          <span className="text-muted">On</span>
          <div role="group" aria-label="Days" className="flex flex-wrap gap-1">
            {WEEK.map(({ day, label }) => {
              const on = days.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ weekdays: on ? days.filter((entry) => entry !== day) : [...days, day].sort((a, b) => a - b) })}
                  className={cn(
                    'h-8 min-w-11 rounded-full border px-2 text-xs font-medium transition-colors duration-150',
                    on ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
        <div className={row}>
          <EffectBlank effect={change.effect} onChange={(effect) => set({ effect })} currency={currency} allowSet />
        </div>
      </div>
    )
  }

  if (change.kind === 'time_of_day') {
    const times = change.times ?? []
    const add = (value: string) => {
      if (!/^\d{1,2}:\d{2}$/.test(value) || times.includes(value)) return
      set({ times: [...times, value].sort() })
      setTime('')
    }
    // The activity's own start times as one-tap chips; opening hours give too many, so those get a time field.
    const offered = startTimes.length <= 8 ? startTimes.filter((entry) => !times.includes(entry)) : []
    return (
      <div className="flex flex-col gap-2.5">
        <div className={row}>
          <span className="text-muted">At</span>
          {times.map((entry) => (
            <Chip key={entry} label={`Remove ${entry}`} onRemove={() => set({ times: times.filter((value) => value !== entry) })}>
              {entry}
            </Chip>
          ))}
          {offered.length > 0 ? (
            offered.map((entry) => (
              <button key={entry} type="button" onClick={() => add(entry)} className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 text-[0.8125rem] text-muted tabular hover:border-primary/50 hover:text-primary">
                <Plus className="size-3" aria-hidden="true" />
                {entry}
              </button>
            ))
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Input type="time" size="sm" className="w-32" aria-label="Start time" value={time} onChange={(event) => setTime(event.target.value)} />
              <Button type="button" size="xs" variant="secondary" disabled={!time} onClick={() => add(time)}>
                Add
              </Button>
            </span>
          )}
          <span className="text-muted">start times</span>
        </div>
        <div className={row}>
          <EffectBlank effect={change.effect} onChange={(effect) => set({ effect })} currency={currency} allowSet />
        </div>
      </div>
    )
  }

  if (change.kind === 'dates') {
    const dates = change.dates ?? []
    const yearly = dates.length > 0 && dates.every((entry) => entry.length === 5)
    const add = (value: string) => {
      if (!value) return
      const key = yearly ? value.slice(5) : value
      if (!dates.includes(key)) set({ dates: [...dates, key].sort() })
      setDate('')
    }
    const toggleYearly = (on: boolean) =>
      set({ dates: [...new Set(dates.map((entry) => (on ? entry.slice(-5) : entry.length === 5 ? datedKey(entry, todayKey) : entry)))].sort() })
    return (
      <div className="flex flex-col gap-2.5">
        <div className={row}>
          <span className="text-muted">On</span>
          {dates.map((entry) => (
            <Chip key={entry} label={`Remove ${shortDay(entry)}`} onRemove={() => set({ dates: dates.filter((value) => value !== entry) })}>
              {shortDay(entry)}
              {entry.length === 10 && entry.slice(0, 4) !== todayKey.slice(0, 4) ? <span className="text-faint">{entry.slice(0, 4)}</span> : null}
            </Chip>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <Input type="date" size="sm" className="w-40" aria-label="Add a date" value={date} onChange={(event) => setDate(event.target.value)} />
            <Button type="button" size="xs" variant="secondary" disabled={!date} onClick={() => add(date)}>
              Add
            </Button>
          </span>
          {dates.length > 0 ? (
            <label className="ml-1 inline-flex items-center gap-2 text-[0.8125rem] text-muted">
              <Switch size="sm" checked={yearly} onCheckedChange={toggleYearly} aria-label="Every year" />
              Every year
            </label>
          ) : null}
        </div>
        <div className={row}>
          <EffectBlank effect={change.effect} onChange={(effect) => set({ effect })} currency={currency} allowSet />
        </div>
      </div>
    )
  }

  // Demand: book early, last minute, filling up, quiet times.
  return (
    <div className="flex flex-col gap-2.5">
      <div className={row}>
        {change.kind === 'early_bird' ? (
          <>
            <span className="text-muted">Booked</span>
            <NumberBlank value={change.daysAhead} onChange={(daysAhead) => set({ daysAhead })} label="Days ahead" min={1} max={365} suffix="days" />
            <span className="text-muted">or more ahead</span>
          </>
        ) : change.kind === 'last_minute' ? (
          <>
            <span className="text-muted">Booked within</span>
            <NumberBlank value={change.hoursBefore} onChange={(hoursBefore) => set({ hoursBefore })} label="Hours before the start" min={1} max={336} suffix="hours" />
            <span className="text-muted">of the start</span>
          </>
        ) : change.kind === 'filling_up' ? (
          <>
            <span className="text-muted">When</span>
            <NumberBlank value={change.soldPercent} onChange={(soldPercent) => set({ soldPercent })} label="Percent booked" min={1} max={100} suffix="%" />
            <span className="text-muted">of spots are booked</span>
          </>
        ) : (
          <>
            <span className="text-muted">When under</span>
            <NumberBlank value={change.soldPercent} onChange={(soldPercent) => set({ soldPercent })} label="Percent booked" min={1} max={100} suffix="%" />
            <span className="text-muted">booked, within</span>
            <NumberBlank value={change.hoursBefore || undefined} onChange={(hoursBefore) => set({ hoursBefore: hoursBefore || undefined })} label="Hours before the start" min={0} max={336} suffix="hours" />
          </>
        )}
      </div>
      <div className={row}>
        <EffectBlank effect={change.effect} onChange={(effect) => set({ effect })} currency={currency} allowSet={DATED.has(change.kind)} />
      </div>
    </div>
  )
}

/* ---------- "Only for" ---------- */

function OnlyFor({ tierIds, tiers, onChange }: { tierIds: string[]; tiers: { id: string; label: string }[]; onChange: (ids: string[]) => void }) {
  const chosen = tierIds.filter((id) => tiers.some((tier) => tier.id === id))
  const text = chosen.length === 0 ? 'All prices' : chosen.map((id) => tiers.find((tier) => tier.id === id)?.label || 'Unnamed').join(', ')
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="text-muted">Only for</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={cn(blank, 'inline-flex max-w-56 items-center gap-1.5')}>
            <span className="truncate">{text}</span>
            <ChevronDown className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuCheckboxItem checked={chosen.length === 0} onSelect={(event) => event.preventDefault()} onCheckedChange={() => onChange([])}>
            All prices
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          {tiers.map((tier) => (
            <DropdownMenuCheckboxItem
              key={tier.id}
              checked={chosen.includes(tier.id)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(on) => onChange(on ? [...chosen, tier.id] : chosen.filter((id) => id !== tier.id))}
            >
              {tier.label || 'Unnamed'}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}

/* ---------- the list ---------- */

export interface PriceChangesEditorProps {
  changes: PriceChange[]
  onChange: (changes: PriceChange[]) => void
  /** The prices a change can be limited to. */
  tiers: { id: string; label: string }[]
  currency: CurrencyCode
  /** The demo's today, YYYY-MM-DD. */
  todayKey: string
  /** The activity's start times, offered for time-of-day changes. */
  startTimes?: string[]
  /** The kinds offered; absent: all of them. */
  kinds?: PriceChangeKind[]
  /** Priced per group: one price, so a change for some guest types only moves nothing. */
  perGroup?: boolean
}

export function PriceChangesEditor({ changes, onChange, tiers, currency, todayKey, startTimes = [], kinds, perGroup = false }: PriceChangesEditorProps) {
  const [openId, setOpenId] = React.useState<string | null>(null)
  const presets = PRICE_CHANGE_PRESETS.filter((entry) => !kinds || kinds.includes(entry.kind))
  const tierLabels = Object.fromEntries(tiers.map((tier) => [tier.id, tier.label || 'Unnamed']))
  const update = (id: string, next: PriceChange) => onChange(changes.map((entry) => (entry.id === id ? next : entry)))
  const add = (kind: PriceChangeKind) => {
    const change = newPriceChange(kind, [...startTimes].sort())
    onChange([...changes, change])
    setOpenId(change.id)
  }

  return (
    <div className="flex flex-col gap-2">
      {changes.length > 0 ? (
        <ul className="flex list-none flex-col gap-2 p-0">
          {changes.map((change) => {
            const Icon = ICON[change.kind]
            const open = openId === change.id
            const complete = isCompleteChange(change)
            // Only the prices still listed.
            const named = (change.tierIds ?? []).filter((id) => id in tierLabels)
            const shown = named.length === (change.tierIds ?? []).length ? change : { ...change, tierIds: named }
            // Per group, a change for some guest types only is kept for per person but moves nothing.
            const idle = perGroup && named.length > 0
            return (
              <li key={change.id} className={cn('rounded-xl border bg-surface', open ? 'border-line-strong' : 'border-line')}>
                <div className="flex items-center gap-3 px-3 py-2.5">
                  <span className={cn('hidden size-8 shrink-0 place-items-center rounded-lg sm:grid', change.active && complete && !idle ? 'bg-primary-soft text-primary' : 'bg-surface-sunken text-faint')} aria-hidden="true">
                    <Icon className="size-4" />
                  </span>
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? null : change.id)}
                    className="group/edit flex min-w-0 flex-1 items-center gap-1.5 rounded-md text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <span className="min-w-0">
                      {change.name?.trim() ? <span className="font-medium text-foreground">{change.name.trim()} · </span> : null}
                      <span className={cn(change.active ? 'text-foreground' : 'text-subtle')}>{describePriceChange(shown, currency, tierLabels)}</span>
                    </span>
                    <ChevronDown className={cn('size-4 shrink-0 text-faint transition-transform duration-200 group-hover/edit:text-foreground', open && 'rotate-180')} aria-hidden="true" />
                  </button>
                  {complete ? (
                    idle ? (
                      <Badge size="sm" variant="neutral">
                        Not used per group
                      </Badge>
                    ) : null
                  ) : (
                    <Badge size="sm" variant="warning">
                      Not finished
                    </Badge>
                  )}
                  <Switch size="sm" checked={change.active} onCheckedChange={(active) => update(change.id, { ...change, active })} aria-label={`${change.active ? 'Turn off' : 'Turn on'} this price change`} />
                  <IconButton
                    type="button"
                    size="xs"
                    variant="ghost"
                    aria-label="Remove this price change"
                    className="text-faint hover:bg-danger-soft hover:text-danger"
                    onClick={() => onChange(changes.filter((entry) => entry.id !== change.id))}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
                {open ? (
                  <div className="flex flex-col gap-3 border-t border-line-subtle bg-surface-sunken/40 px-3 py-3">
                    <ChangeSentence change={change} onChange={(next) => update(change.id, next)} currency={currency} todayKey={todayKey} startTimes={startTimes} />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-subtle pt-3">
                      <Input
                        size="sm"
                        className="w-44"
                        aria-label="Name"
                        placeholder="Name (optional)"
                        value={change.name ?? ''}
                        onChange={(event) => update(change.id, { ...change, name: event.target.value.slice(0, 40) || undefined })}
                      />
                      {(perGroup ? idle : tiers.length > 1) ? <OnlyFor tierIds={change.tierIds ?? []} tiers={tiers} onChange={(tierIds) => update(change.id, { ...change, tierIds: tierIds.length > 0 ? tierIds : undefined })} /> : null}
                      {idle ? <span className="text-xs text-subtle">Pick All prices to use it on the group price.</span> : null}
                      <Button type="button" size="xs" variant="secondary" className="ml-auto" onClick={() => setOpenId(null)}>
                        Done
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="secondary" size="xs" className="self-start" leftIcon={<Plus />} rightIcon={<ChevronDown />}>
            Add a price change
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          {presets.map((preset) => (
            <DropdownMenuItem key={preset.kind} onSelect={() => add(preset.kind)}>
              <preset.icon aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm">{preset.label}</span>
                <span className="block text-xs text-subtle">{preset.hint}</span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
