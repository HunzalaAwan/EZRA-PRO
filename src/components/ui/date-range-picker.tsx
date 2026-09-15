'use client'

import * as React from 'react'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import { DayPicker, type DateRange as DayPickerRange, type Matcher } from 'react-day-picker'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react'

import {
  addDays,
  cn,
  formatDateLong,
  formatDateShort,
  fromDateKey,
  isSameDay,
  startOfDay,
  startOfMonth,
  toDateKey,
} from '@/lib/utils'
import type { DateRange, RangePreset } from '@/types'

/* ==========================================================================
   DateRangePicker — the analytics / bookings date scope.

   `referenceDate` is required on purpose. Every preset ("Last 30 days") is
   relative to "now", and calling `new Date()` during render would desynchronise
   server and client HTML. Callers pass the app's single fixed reference clock.
   ========================================================================== */

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: 'qtd', label: 'Quarter to date' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'custom', label: 'Custom' },
]

const PRESET_LABEL = new Map(RANGE_PRESETS.map((p) => [p.value, p.label]))

/** Tolerant of both `"YYYY-MM-DD"` and full ISO datetimes. */
function parseRangeDate(value: string): Date {
  return fromDateKey(value.slice(0, 10))
}

function startOfQuarter(date: Date): Date {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1)
}

/**
 * Resolves a preset against the caller's reference "now".
 * Returns `null` for `'custom'`, which by definition has no derived range.
 */
export function rangeForPreset(preset: RangePreset, reference: Date): DateRange | null {
  const today = startOfDay(reference)
  const to = toDateKey(today)

  switch (preset) {
    case 'today':
      return { from: to, to }
    case '7d':
      return { from: toDateKey(addDays(today, -6)), to }
    case '30d':
      return { from: toDateKey(addDays(today, -29)), to }
    case '90d':
      return { from: toDateKey(addDays(today, -89)), to }
    case 'mtd':
      return { from: toDateKey(startOfMonth(today)), to }
    case 'qtd':
      return { from: toDateKey(startOfQuarter(today)), to }
    case 'ytd':
      return { from: toDateKey(new Date(today.getFullYear(), 0, 1)), to }
    case 'custom':
    default:
      return null
  }
}

/** Which preset (if any) a concrete range corresponds to. */
export function detectPreset(range: DateRange, reference: Date): RangePreset {
  for (const { value } of RANGE_PRESETS) {
    const candidate = rangeForPreset(value, reference)
    if (candidate && candidate.from === range.from && candidate.to === range.to) return value
  }
  return 'custom'
}

export function formatRangeLabel(range: DateRange): string {
  const from = parseRangeDate(range.from)
  const to = parseRangeDate(range.to)
  if (isSameDay(from, to)) return formatDateLong(from)

  const sameYear = from.getFullYear() === to.getFullYear()
  return sameYear
    ? `${formatDateShort(from)} – ${formatDateShort(to)}, ${to.getFullYear()}`
    : `${formatDateShort(from)}, ${from.getFullYear()} – ${formatDateShort(to)}, ${to.getFullYear()}`
}

/**
 * Only ever consulted inside the portalled popover, which mounts after
 * hydration — so there is no server/client divergence to guard against.
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false)

  React.useEffect(() => {
    const list = window.matchMedia(query)
    const update = () => setMatches(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return matches
}

function DayPickerChevron({
  orientation,
  className,
}: {
  orientation?: 'up' | 'down' | 'left' | 'right'
  className?: string
}) {
  const Icon =
    orientation === 'left'
      ? ChevronLeft
      : orientation === 'right'
        ? ChevronRight
        : orientation === 'up'
          ? ChevronUp
          : ChevronDown
  return <Icon aria-hidden="true" className={cn('size-4', className)} />
}

const NAV_BUTTON = cn(
  'grid size-7 place-items-center rounded-lg border border-line bg-surface text-muted',
  'transition-all duration-200 ease-[var(--ease-out-quint)] active:scale-[0.94]',
  'hover:border-line-strong hover:bg-surface-sunken hover:text-foreground',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
  'disabled:pointer-events-none disabled:opacity-40',
)

export interface DateRangePickerProps {
  value: DateRange
  /** Receives the committed range plus the preset it came from. */
  onChange: (range: DateRange, preset: RangePreset) => void
  /** The app's fixed "now". Required for deterministic preset maths. */
  referenceDate: Date
  /** Current preset. Derived from `value` when omitted. */
  preset?: RangePreset
  /** Restricts the rail. `'custom'` is always implied by the calendar itself. */
  presets?: RangePreset[]
  /** Months shown side by side on >= sm. Mobile always shows one. */
  numberOfMonths?: number
  minDate?: Date
  maxDate?: Date
  disabled?: boolean
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Replaces the default trigger button. */
  trigger?: React.ReactNode
  /** Accessible name for the default trigger. */
  label?: string
  className?: string
  contentClassName?: string
}

function DateRangePicker({
  value,
  onChange,
  referenceDate,
  preset,
  presets,
  numberOfMonths = 2,
  minDate,
  maxDate,
  disabled = false,
  align = 'end',
  side = 'bottom',
  trigger,
  label = 'Change date range',
  className,
  contentClassName,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [draft, setDraft] = React.useState<DayPickerRange | undefined>(undefined)
  const [draftPreset, setDraftPreset] = React.useState<RangePreset>('custom')
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(parseRangeDate(value.to)))

  const isWide = useMediaQuery('(min-width: 640px)')
  const visibleMonths = isWide ? Math.max(1, numberOfMonths) : 1

  const activePreset = preset ?? detectPreset(value, referenceDate)
  const railPresets = presets
    ? RANGE_PRESETS.filter((p) => presets.includes(p.value))
    : RANGE_PRESETS.filter((p) => p.value !== 'custom')

  // Re-seed the draft every time the popover opens so an abandoned edit never
  // leaks into the next session.
  React.useEffect(() => {
    if (!open) return
    const from = parseRangeDate(value.from)
    const to = parseRangeDate(value.to)
    setDraft({ from, to })
    setDraftPreset(activePreset)
    setMonth(startOfMonth(visibleMonths > 1 ? addDays(startOfMonth(to), -1) : to))
    // `activePreset` and `visibleMonths` are derived; opening is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const commit = (range: DateRange, nextPreset: RangePreset) => {
    onChange(range, nextPreset)
    setOpen(false)
  }

  const applyPreset = (nextPreset: RangePreset) => {
    const resolved = rangeForPreset(nextPreset, referenceDate)
    if (!resolved) {
      setDraftPreset('custom')
      return
    }
    setDraft({ from: parseRangeDate(resolved.from), to: parseRangeDate(resolved.to) })
    setDraftPreset(nextPreset)
    commit(resolved, nextPreset)
  }

  const applyDraft = () => {
    if (!draft?.from || !draft.to) return
    const range: DateRange = { from: toDateKey(draft.from), to: toDateKey(draft.to) }
    commit(range, detectPreset(range, referenceDate))
  }

  const disabledMatchers: Matcher[] = []
  if (minDate) disabledMatchers.push({ before: minDate })
  if (maxDate) disabledMatchers.push({ after: maxDate })

  const triggerLabel =
    activePreset !== 'custom'
      ? (PRESET_LABEL.get(activePreset) ?? formatRangeLabel(value))
      : formatRangeLabel(value)

  const draftSummary =
    draft?.from && draft.to
      ? formatRangeLabel({ from: toDateKey(draft.from), to: toDateKey(draft.to) })
      : draft?.from
        ? `${formatDateLong(draft.from)} — pick an end date`
        : 'Pick a start date'

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            disabled={disabled}
            aria-label={label}
            className={cn(
              'group inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-foreground',
              'transition-all duration-200 ease-[var(--ease-out-quint)] active:scale-[0.98]',
              'hover:border-line-strong hover:bg-surface-sunken',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              'disabled:pointer-events-none disabled:opacity-50',
              'data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/25',
              className,
            )}
          >
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-subtle" />
            <span className="truncate tabular-nums">{triggerLabel}</span>
            <ChevronDown
              aria-hidden="true"
              className="size-3.5 shrink-0 text-faint transition-transform duration-200 group-data-[state=open]:rotate-180"
            />
          </button>
        )}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          side={side}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            'z-50 w-[min(calc(100vw-1.5rem),44rem)] overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-xl',
            'origin-[var(--radix-popover-content-transform-origin)]',
            'data-[state=open]:animate-[ezra-pop-in_180ms_var(--ease-out-expo)]',
            'data-[state=closed]:animate-[ezra-pop-out_120ms_var(--ease-in-out-quart)]',
            contentClassName,
          )}
        >
          {/* Popover enter/exit keyframes. React 19 hoists and de-duplicates
              this by `href`, so it lands in <head> exactly once no matter how
              many pickers a screen renders. Radix only keeps the content
              mounted for an exit *animation* (it sniffs `animationName`), which
              is why this cannot be a plain transition. */}
          <style href="ezra-popover-motion" precedence="default">
            {POPOVER_KEYFRAMES}
          </style>

          <div className="flex flex-col sm:flex-row">
            <div
              className={cn(
                'flex shrink-0 gap-1 overflow-x-auto border-line-subtle p-2 no-scrollbar',
                'border-b sm:w-44 sm:flex-col sm:border-b-0 sm:border-r sm:overflow-x-visible',
              )}
            >
              {railPresets.map((option) => {
                const isActive = draftPreset === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => applyPreset(option.value)}
                    aria-pressed={isActive}
                    className={cn(
                      'shrink-0 rounded-lg px-3 py-2 text-left text-[0.8125rem] font-medium whitespace-nowrap',
                      'transition-colors duration-200 ease-[var(--ease-out-quint)]',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      isActive
                        ? 'bg-primary-soft text-primary'
                        : 'text-muted hover:bg-surface-sunken hover:text-foreground',
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <div className="min-w-0 flex-1">
              <DayPicker
                mode="range"
                selected={draft}
                onSelect={(range) => {
                  setDraft(range)
                  setDraftPreset('custom')
                }}
                month={month}
                onMonthChange={setMonth}
                numberOfMonths={visibleMonths}
                startMonth={minDate}
                endMonth={maxDate}
                disabled={disabledMatchers.length > 0 ? disabledMatchers : undefined}
                weekStartsOn={1}
                showOutsideDays
                classNames={DAY_PICKER_CLASS_NAMES}
                components={{ Chevron: DayPickerChevron }}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-subtle px-3 py-2.5">
                <p className="min-w-0 truncate text-xs tabular-nums text-subtle">{draftSummary}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={cn(
                      'rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted',
                      'transition-colors duration-200 hover:bg-surface-sunken hover:text-foreground',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={applyDraft}
                    disabled={!draft?.from || !draft.to}
                    className={cn(
                      'rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary shadow-xs',
                      'transition-all duration-200 ease-[var(--ease-out-quint)] active:scale-[0.97]',
                      'hover:bg-primary-hover',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      'disabled:pointer-events-none disabled:opacity-40',
                    )}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

const POPOVER_KEYFRAMES = `
@keyframes ezra-pop-in {
  from { opacity: 0; transform: scale(0.97) translateY(-4px); }
  to   { opacity: 1; transform: none; }
}
@keyframes ezra-pop-out {
  from { opacity: 1; transform: none; }
  to   { opacity: 0; transform: scale(0.98) translateY(-2px); }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes ezra-pop-in  { from { opacity: 1; } to { opacity: 1; } }
  @keyframes ezra-pop-out { from { opacity: 0; } to { opacity: 0; } }
}
`

/**
 * DayPicker is styled entirely through `classNames` — its own stylesheet is
 * never imported. Range banding lives on the day <td> while the pill lives on
 * the inner <button>, which is what keeps the band continuous across a week.
 */
const DAY_PICKER_CLASS_NAMES = {
  root: 'w-fit p-3',
  months: 'relative flex flex-col gap-5 sm:flex-row',
  month: 'flex flex-col gap-3',
  nav: 'absolute inset-x-0 top-0 z-10 flex items-center justify-between',
  button_previous: NAV_BUTTON,
  button_next: NAV_BUTTON,
  chevron: 'size-4',
  month_caption: 'flex h-7 items-center justify-center',
  caption_label: 'font-display text-sm font-semibold text-foreground',
  dropdowns: 'flex items-center gap-2',
  dropdown_root: 'relative',
  dropdown:
    'rounded-lg border border-line bg-surface px-2 py-1 text-sm font-medium text-foreground',
  month_grid: 'w-full border-collapse',
  weekdays: '',
  weekday:
    'size-9 pb-1 text-center text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-faint',
  weeks: '',
  week: '',
  week_number_header: 'size-9',
  week_number: 'size-9 text-center text-xs text-faint',
  day: 'relative size-9 p-0 text-center text-sm',
  day_button: cn(
    'grid size-9 place-items-center rounded-lg font-medium text-foreground',
    'transition-colors duration-150 ease-[var(--ease-out-quint)]',
    'hover:bg-surface-sunken',
    'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary',
    'disabled:pointer-events-none',
  ),
  selected: '[&>button]:font-semibold',
  range_start: 'rounded-l-lg bg-primary-soft/55 [&>button]:bg-primary [&>button]:text-on-primary',
  range_end: 'rounded-r-lg bg-primary-soft/55 [&>button]:bg-primary [&>button]:text-on-primary',
  range_middle: 'bg-primary-soft/55 [&>button]:text-primary [&>button]:hover:bg-primary-soft',
  today: '[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-info/60',
  outside: '[&>button]:text-faint [&>button]:opacity-70',
  disabled: '[&>button]:text-faint [&>button]:opacity-40',
  hidden: 'invisible',
  footer: 'pt-2 text-xs text-subtle',
}

export { DateRangePicker }
