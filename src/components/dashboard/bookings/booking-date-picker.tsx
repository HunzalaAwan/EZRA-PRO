'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { DayPicker, type DateRange as DayPickerRange } from 'react-day-picker'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

import { Segmented } from '@/components/ui/segmented'
import { DAY_PICKER_CLASS_NAMES, DayPickerChevron, POPOVER_KEYFRAMES, formatRangeLabel } from '@/components/ui/date-range-picker'
import { addDays, cn, fromDateKey, startOfMonth, toDateKey } from '@/lib/utils'
import type { DateRange } from '@/types'

/* ==========================================================================
   Booking date picker — the reservations desk's calendar. Click any day to
   see that day's bookings, or switch to a range. Quick picks look forward
   (tomorrow, this weekend, next 7 days), arrows step a day or a range at a
   time, and days with bookings carry a dot so empty days are obvious.
   ========================================================================== */

type Quick = { id: string; label: string; range: (today: Date) => DateRange | null }

const key = (date: Date) => toDateKey(date)

const QUICK: Quick[] = [
  { id: 'today', label: 'Today', range: (t) => ({ from: key(t), to: key(t) }) },
  { id: 'tomorrow', label: 'Tomorrow', range: (t) => ({ from: key(addDays(t, 1)), to: key(addDays(t, 1)) }) },
  {
    id: 'weekend',
    label: 'This weekend',
    range: (t) => {
      const toSat = (6 - t.getDay() + 7) % 7
      const sat = addDays(t, t.getDay() === 0 ? -1 : toSat)
      return { from: key(t.getDay() === 0 ? t : sat), to: key(addDays(sat, 1)) }
    },
  },
  { id: 'next7', label: 'Next 7 days', range: (t) => ({ from: key(t), to: key(addDays(t, 6)) }) },
  { id: 'month', label: 'This month', range: (t) => ({ from: key(startOfMonth(t)), to: key(new Date(t.getFullYear(), t.getMonth() + 1, 0)) }) },
  { id: 'nextmonth', label: 'Next month', range: (t) => ({ from: key(new Date(t.getFullYear(), t.getMonth() + 1, 1)), to: key(new Date(t.getFullYear(), t.getMonth() + 2, 0)) }) },
  { id: 'last7', label: 'Last 7 days', range: (t) => ({ from: key(addDays(t, -6)), to: key(t) }) },
  { id: 'any', label: 'Any date', range: () => null },
]

const days = (range: DateRange) => Math.round((fromDateKey(range.to).getTime() - fromDateKey(range.from).getTime()) / 86_400_000) + 1

export function labelFor(range: DateRange | null, todayKey: string) {
  if (!range) return 'Any date'
  if (range.from === range.to) {
    const date = fromDateKey(range.from)
    const name = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(date)
    if (range.from === todayKey) return `Today, ${name.split(', ').slice(1).join(', ')}`
    if (range.from === key(addDays(fromDateKey(todayKey), 1))) return `Tomorrow, ${name.split(', ').slice(1).join(', ')}`
    return name
  }
  return formatRangeLabel(range)
}

export function BookingDatePicker({
  value,
  onChange,
  todayKey,
  bookedDays,
  className,
}: {
  value: DateRange | null
  onChange: (range: DateRange | null) => void
  todayKey: string
  /** Days that have bookings, "yyyy-mm-dd": marked with a dot. */
  bookedDays?: Set<string>
  className?: string
}) {
  const today = React.useMemo(() => fromDateKey(todayKey), [todayKey])
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<'day' | 'range'>('day')
  const [draft, setDraft] = React.useState<DayPickerRange | undefined>(undefined)
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(value ? fromDateKey(value.from) : today))

  React.useEffect(() => {
    if (!open) return
    setMode(value && value.from !== value.to ? 'range' : 'day')
    setDraft(value ? { from: fromDateKey(value.from), to: fromDateKey(value.to) } : undefined)
    setMonth(startOfMonth(value ? fromDateKey(value.from) : today))
    // Opening is the trigger; value and today are read as they are then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const commit = (range: DateRange | null) => {
    onChange(range)
    setOpen(false)
  }
  /** Arrows: a day at a time for one day, the length of the range for a range. */
  const step = (by: 1 | -1) => {
    if (!value) return
    const span = days(value)
    onChange({ from: key(addDays(fromDateKey(value.from), by * span)), to: key(addDays(fromDateKey(value.to), by * span)) })
  }
  const activeQuick = QUICK.find((quick) => {
    const range = quick.range(today)
    return range === null ? value === null : value !== null && range.from === value.from && range.to === value.to
  })?.id
  const booked = React.useMemo(() => [...(bookedDays ?? [])].map((entry) => fromDateKey(entry)), [bookedDays])

  const arrow = 'grid size-10 shrink-0 place-items-center text-muted transition-colors hover:bg-surface-sunken hover:text-foreground disabled:pointer-events-none disabled:opacity-40'

  return (
    <div className={cn('inline-flex h-10 items-stretch overflow-hidden rounded-lg border border-line bg-surface shadow-xs', value && 'border-[color-mix(in_oklab,var(--info)_40%,transparent)]', className)}>
      {value ? (
        <button type="button" onClick={() => step(-1)} aria-label={value.from === value.to ? 'Previous day' : 'Previous period'} className={cn(arrow, 'border-r border-line-subtle')}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
      ) : null}
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label="Choose the dates to show"
            className={cn(
              'group inline-flex min-w-0 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap transition-colors hover:bg-surface-sunken',
              value ? 'bg-info-soft/60 text-info' : 'text-foreground',
            )}
          >
            <CalendarDays className={cn('size-4 shrink-0', value ? 'text-info' : 'text-subtle')} aria-hidden="true" />
            <span className="truncate tabular-nums">{labelFor(value, todayKey)}</span>
            <ChevronDown className="size-3.5 shrink-0 text-faint transition-transform group-data-[state=open]:rotate-180" aria-hidden="true" />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className={cn(
              'z-50 w-[min(calc(100vw-1.5rem),36rem)] overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-xl',
              'origin-[var(--radix-popover-content-transform-origin)] data-[state=open]:animate-[ezra-pop-in_180ms_var(--ease-out-expo)] data-[state=closed]:animate-[ezra-pop-out_120ms_var(--ease-in-out-quart)]',
            )}
          >
            <style href="ezra-popover-motion" precedence="default">
              {POPOVER_KEYFRAMES}
            </style>
            <div className="flex flex-col sm:flex-row">
              <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-line-subtle p-2 no-scrollbar sm:w-40 sm:flex-col sm:border-r sm:border-b-0">
                {QUICK.map((quick) => (
                  <button
                    key={quick.id}
                    type="button"
                    aria-pressed={activeQuick === quick.id}
                    onClick={() => commit(quick.range(today))}
                    className={cn(
                      'shrink-0 rounded-lg px-3 py-2 text-left text-[0.8125rem] font-medium whitespace-nowrap transition-colors',
                      activeQuick === quick.id ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-sunken hover:text-foreground',
                    )}
                  >
                    {quick.label}
                  </button>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-3 py-2">
                  <Segmented
                    label="Pick a day or a range"
                    size="sm"
                    value={mode}
                    onValueChange={(next) => {
                      setMode(next)
                      setDraft(undefined)
                    }}
                    options={[
                      { value: 'day', label: 'One day' },
                      { value: 'range', label: 'Date range' },
                    ]}
                  />
                  {bookedDays ? (
                    <span className="flex items-center gap-1.5 text-xs text-subtle">
                      <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                      Has bookings
                    </span>
                  ) : null}
                </div>
                {mode === 'day' ? (
                  <DayPicker
                    mode="single"
                    selected={value && value.from === value.to ? fromDateKey(value.from) : undefined}
                    onSelect={(date) => {
                      if (date) commit({ from: key(date), to: key(date) })
                    }}
                    month={month}
                    onMonthChange={setMonth}
                    weekStartsOn={1}
                    showOutsideDays
                    modifiers={{ booked }}
                    modifiersClassNames={{ booked: BOOKED_DOT }}
                    classNames={{ ...DAY_PICKER_CLASS_NAMES, selected: '[&>button]:bg-primary [&>button]:text-on-primary [&>button]:font-semibold' }}
                    components={{ Chevron: DayPickerChevron }}
                  />
                ) : (
                  <>
                    <DayPicker
                      mode="range"
                      selected={draft}
                      onSelect={setDraft}
                      month={month}
                      onMonthChange={setMonth}
                      weekStartsOn={1}
                      showOutsideDays
                      modifiers={{ booked }}
                      modifiersClassNames={{ booked: BOOKED_DOT }}
                      classNames={DAY_PICKER_CLASS_NAMES}
                      components={{ Chevron: DayPickerChevron }}
                    />
                    <div className="flex items-center justify-between gap-2 border-t border-line-subtle px-3 py-2.5">
                      <p className="min-w-0 truncate text-xs text-subtle tabular-nums">
                        {draft?.from && draft.to ? formatRangeLabel({ from: key(draft.from), to: key(draft.to) }) : draft?.from ? 'Now pick the last day' : 'Pick the first day'}
                      </p>
                      <button
                        type="button"
                        disabled={!draft?.from}
                        onClick={() => draft?.from && commit({ from: key(draft.from), to: key(draft.to ?? draft.from) })}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-xs hover:bg-primary-hover disabled:pointer-events-none disabled:opacity-40"
                      >
                        Show these dates
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
      {value ? (
        <button type="button" onClick={() => step(1)} aria-label={value.from === value.to ? 'Next day' : 'Next period'} className={cn(arrow, 'border-l border-line-subtle')}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}

/** A small dot under the day number. */
const BOOKED_DOT = "[&>button]:relative [&>button]:after:absolute [&>button]:after:bottom-1 [&>button]:after:left-1/2 [&>button]:after:size-1 [&>button]:after:-translate-x-1/2 [&>button]:after:rounded-full [&>button]:after:bg-primary [&>button]:after:content-['']"
