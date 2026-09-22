'use client'

import * as React from 'react'
import {
  Bookmark,
  CalendarClock,
  CircleDollarSign,
  Globe,
  Hourglass,
  Layers,
  ListFilter,
  RotateCcw,
  Ship,
  Sparkles,
  Waves,
  X,
  type LucideIcon,
} from 'lucide-react'

import type {
  Activity,
  BookingChannel,
  BookingStatus,
  DateRange,
  PaymentStatus,
} from '@/types'
import { CHANNEL_LABELS, NOW, TODAY_KEY } from '@/lib/demo-core'
import { addDays, cn, toDateKey } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DateRangePicker,
  formatRangeLabel,
  rangeForPreset,
} from '@/components/ui/date-range-picker'

/* ==========================================================================
   FILTER MODEL
   The reservations desk filters live here so the page, the table and the
   saved-view rail all agree on one shape.
   ========================================================================== */

/** The six tabs across the top of the reservations desk. */
export type BookingStatusTab =
  | 'all'
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'completed'
  | 'cancelled'

/** Cancelled is a bucket, not a single status — no-shows and refunds land here too. */
export const STATUS_TAB_MATCH: Record<BookingStatusTab, BookingStatus[]> = {
  all: [],
  pending: ['pending'],
  confirmed: ['confirmed'],
  checked_in: ['checked_in'],
  completed: ['completed'],
  cancelled: ['cancelled', 'no_show', 'refunded'],
}

export const STATUS_TAB_LABEL: Record<BookingStatusTab, string> = {
  all: 'All',
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const STATUS_TAB_ORDER: BookingStatusTab[] = [
  'all',
  'pending',
  'confirmed',
  'checked_in',
  'completed',
  'cancelled',
]

export interface BookingFilters {
  /** Matches reference, guest name or guest email. */
  search: string
  activityId: string | 'all'
  channel: BookingChannel | 'all'
  payment: PaymentStatus | 'all'
  /** `null` means "any date" — the picker still shows a sensible default range. */
  range: DateRange | null
}

export const DEFAULT_BOOKING_FILTERS: BookingFilters = {
  search: '',
  activityId: 'all',
  channel: 'all',
  payment: 'all',
  range: null,
}

export function isDefaultFilters(filters: BookingFilters) {
  return (
    filters.search.trim() === '' &&
    filters.activityId === 'all' &&
    filters.channel === 'all' &&
    filters.payment === 'all' &&
    filters.range === null
  )
}

const PAYMENT_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'paid', label: 'Paid in full' },
  { value: 'deposit_paid', label: 'Deposit paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partially_refunded', label: 'Part refunded' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'failed', label: 'Payment failed' },
]

const PAYMENT_LABEL = new Map(PAYMENT_OPTIONS.map((p) => [p.value, p.label]))

/* --------------------------------------------------------------------------
   SAVED VIEWS — the shortcuts a reservations lead actually keeps pinned
   -------------------------------------------------------------------------- */

export interface SavedView {
  id: string
  label: string
  hint: string
  icon: LucideIcon
  status: BookingStatusTab
  filters: BookingFilters
}

const TODAY_RANGE: DateRange = { from: TODAY_KEY, to: TODAY_KEY }
const NEXT_7: DateRange = { from: TODAY_KEY, to: toDateKey(addDays(NOW, 7)) }
/** Everything still to sail — the desk's default, since the past can wait. */
const UPCOMING: DateRange = { from: TODAY_KEY, to: toDateKey(addDays(NOW, 400)) }

export const SAVED_VIEWS: SavedView[] = [
  {
    id: 'upcoming',
    label: 'Upcoming',
    hint: 'From today, soonest first',
    icon: CalendarClock,
    status: 'all',
    filters: { ...DEFAULT_BOOKING_FILTERS, range: UPCOMING },
  },
  {
    id: 'all',
    label: 'All reservations',
    hint: 'Everything on the books',
    icon: Layers,
    status: 'all',
    filters: DEFAULT_BOOKING_FILTERS,
  },
  {
    id: 'needs-action',
    label: 'Needs action',
    hint: 'Pending confirmation',
    icon: Hourglass,
    status: 'pending',
    filters: DEFAULT_BOOKING_FILTERS,
  },
  {
    id: 'balance-due',
    label: 'Balance due',
    hint: 'Unpaid at departure',
    icon: CircleDollarSign,
    status: 'all',
    filters: { ...DEFAULT_BOOKING_FILTERS, payment: 'unpaid' },
  },
  {
    id: 'sailing-today',
    label: 'Sailing today',
    hint: "Today's departures",
    icon: Waves,
    status: 'all',
    filters: { ...DEFAULT_BOOKING_FILTERS, range: TODAY_RANGE },
  },
  {
    id: 'next-7',
    label: 'Next 7 days',
    hint: 'The week ahead',
    icon: CalendarClock,
    status: 'all',
    filters: { ...DEFAULT_BOOKING_FILTERS, range: NEXT_7 },
  },
  {
    id: 'ota',
    label: 'OTA marketplace',
    hint: 'Viator, GetYourGuide, Expedia',
    icon: Globe,
    status: 'all',
    filters: { ...DEFAULT_BOOKING_FILTERS, channel: 'ota' },
  },
  {
    id: 'cancellations',
    label: 'Cancellations',
    hint: 'Cancelled, refunded, no-show',
    icon: RotateCcw,
    status: 'cancelled',
    filters: DEFAULT_BOOKING_FILTERS,
  },
]

/* --------------------------------------------------------------------------
   ACTIVE CHIPS
   -------------------------------------------------------------------------- */

interface ActiveChip {
  key: string
  prefix: string
  label: string
  clear: () => void
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export interface BookingsFiltersProps {
  filters: BookingFilters
  onFiltersChange: (next: BookingFilters) => void
  activities: Activity[]
  /** Id of the saved view currently applied, or `null` for a hand-rolled filter. */
  activeViewId: string | null
  onApplyView: (view: SavedView) => void
  /** Rendered next to the reset control, e.g. "1,284 of 13,268". */
  resultSummary?: React.ReactNode
  className?: string
}

export function BookingsFilters({
  filters,
  onFiltersChange,
  activities,
  activeViewId,
  onApplyView,
  resultSummary,
  className,
}: BookingsFiltersProps) {
  const set = React.useCallback(
    <K extends keyof BookingFilters>(key: K, value: BookingFilters[K]) => {
      onFiltersChange({ ...filters, [key]: value })
    },
    [filters, onFiltersChange],
  )

  const activityName = React.useMemo(() => {
    if (filters.activityId === 'all') return null
    return activities.find((a) => a.id === filters.activityId)?.name ?? null
  }, [activities, filters.activityId])

  const chips: ActiveChip[] = []
  if (filters.search.trim()) {
    chips.push({
      key: 'search',
      prefix: 'Search',
      label: `"${filters.search.trim()}"`,
      clear: () => set('search', ''),
    })
  }
  if (activityName) {
    chips.push({
      key: 'activity',
      prefix: 'Experience',
      label: activityName,
      clear: () => set('activityId', 'all'),
    })
  }
  if (filters.channel !== 'all') {
    chips.push({
      key: 'channel',
      prefix: 'Channel',
      label: CHANNEL_LABELS[filters.channel],
      clear: () => set('channel', 'all'),
    })
  }
  if (filters.payment !== 'all') {
    chips.push({
      key: 'payment',
      prefix: 'Payment',
      label: PAYMENT_LABEL.get(filters.payment) ?? filters.payment,
      clear: () => set('payment', 'all'),
    })
  }
  if (filters.range) {
    chips.push({
      key: 'range',
      prefix: 'Departing',
      label: formatRangeLabel(filters.range),
      clear: () => set('range', null),
    })
  }

  const fallbackRange = React.useMemo(
    () => rangeForPreset('30d', NOW) ?? { from: TODAY_KEY, to: TODAY_KEY },
    [],
  )

  const sortedActivities = React.useMemo(
    () => [...activities].sort((a, b) => a.name.localeCompare(b.name)),
    [activities],
  )

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* ---------------------------------------------------------------
          Saved views
          --------------------------------------------------------------- */}
      <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 no-scrollbar">
        <span className="hidden shrink-0 items-center gap-1.5 pr-1 text-xs font-semibold tracking-wider text-faint uppercase sm:inline-flex">
          <Bookmark aria-hidden="true" className="size-3.5" />
          Views
        </span>
        {SAVED_VIEWS.map((view) => {
          const Icon = view.icon
          const active = activeViewId === view.id
          return (
            <button
              key={view.id}
              type="button"
              onClick={() => onApplyView(view)}
              aria-pressed={active}
              title={view.hint}
              className={cn(
                'group/view inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3',
                'text-[0.8125rem] font-medium whitespace-nowrap',
                'transition-[color,background-color,border-color,transform] duration-200 ease-[var(--ease-out-expo)]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                'active:scale-[0.97] motion-reduce:active:scale-100',
                active
                  ? 'border-[color-mix(in_oklab,var(--info)_40%,transparent)] bg-info-soft text-info shadow-xs'
                  : 'border-line bg-surface text-muted hover:border-line-strong hover:bg-surface-sunken hover:text-foreground',
              )}
            >
              <Icon
                aria-hidden="true"
                className={cn('size-3.5 shrink-0', active ? 'text-info' : 'text-faint')}
              />
              {view.label}
            </button>
          )
        })}
      </div>

      {/* ---------------------------------------------------------------
          Controls
          --------------------------------------------------------------- */}
      <div className="flex flex-col gap-2.5 rounded-2xl border border-line bg-surface p-2.5 sm:flex-row sm:items-center sm:gap-2">
        <div className="min-w-0 flex-1 sm:max-w-sm">
          <SearchInput
            value={filters.search}
            onValueChange={(value) => set('search', value)}
            debounceMs={180}
            tone="sunken"
            label="Search reservations"
            placeholder="Reference, guest name or email…"
            shortcut={false}
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Select
            value={filters.activityId}
            onValueChange={(value) => set('activityId', value)}
          >
            <SelectTrigger
              className="w-full sm:w-[11.5rem]"
              aria-label="Filter by experience"
              icon={<Ship className="size-4" />}
            >
              <SelectValue placeholder="Experience" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Experience</SelectLabel>
                <SelectItem value="all">All experiences</SelectItem>
                {sortedActivities.map((activity) => (
                  <SelectItem key={activity.id} value={activity.id}>
                    {activity.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={filters.channel}
            onValueChange={(value) => set('channel', value as BookingChannel | 'all')}
          >
            <SelectTrigger
              className="w-full sm:w-[10.5rem]"
              aria-label="Filter by booking channel"
              icon={<Globe className="size-4" />}
            >
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Channel</SelectLabel>
                <SelectItem value="all">All channels</SelectItem>
                {(Object.keys(CHANNEL_LABELS) as BookingChannel[]).map((channel) => (
                  <SelectItem key={channel} value={channel}>
                    {CHANNEL_LABELS[channel]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select
            value={filters.payment}
            onValueChange={(value) => set('payment', value as PaymentStatus | 'all')}
          >
            <SelectTrigger
              className="w-full sm:w-[10rem]"
              aria-label="Filter by payment status"
              icon={<CircleDollarSign className="size-4" />}
            >
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Payment</SelectLabel>
                <SelectItem value="all">Any payment state</SelectItem>
                {PAYMENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          <DateRangePicker
            value={filters.range ?? fallbackRange}
            referenceDate={NOW}
            onChange={(range) => set('range', range)}
            numberOfMonths={2}
            align="end"
            label="Filter by departure date"
            trigger={
              <button
                type="button"
                className={cn(
                  'group inline-flex h-10 w-full items-center gap-2 rounded-xl border px-3 text-sm font-medium sm:w-auto',
                  'transition-[color,background-color,border-color] duration-200 ease-[var(--ease-out-quint)]',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  'data-[state=open]:border-primary data-[state=open]:ring-2 data-[state=open]:ring-primary/25',
                  filters.range
                    ? 'border-[color-mix(in_oklab,var(--info)_40%,transparent)] bg-info-soft text-info'
                    : 'border-line bg-surface text-foreground hover:border-line-strong hover:bg-surface-sunken',
                )}
              >
                <CalendarClock
                  aria-hidden="true"
                  className={cn('size-4 shrink-0', filters.range ? 'text-info' : 'text-subtle')}
                />
                <span className="truncate tabular-nums">
                  {filters.range ? formatRangeLabel(filters.range) : 'Any date'}
                </span>
              </button>
            }
          />
        </div>
      </div>

      {/* ---------------------------------------------------------------
          Active chips
          --------------------------------------------------------------- */}
      {(chips.length > 0 || resultSummary) && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.length > 0 && (
            <ListFilter aria-hidden="true" className="size-3.5 shrink-0 text-faint" />
          )}

          {chips.map((chip) => (
            <Badge
              key={chip.key}
              variant="outline"
              className="h-7 gap-1.5 border-line bg-surface pr-1 pl-2.5 text-foreground"
            >
              <span className="text-faint">{chip.prefix}</span>
              <span className="max-w-[12rem] truncate font-medium">{chip.label}</span>
              <button
                type="button"
                onClick={chip.clear}
                aria-label={`Remove ${chip.prefix} filter`}
                className={cn(
                  'ml-0.5 grid size-5 shrink-0 place-items-center rounded-full text-faint',
                  'transition-colors duration-150 hover:bg-surface-sunken hover:text-danger',
                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                )}
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </Badge>
          ))}

          {chips.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onFiltersChange(DEFAULT_BOOKING_FILTERS)}
              leftIcon={<RotateCcw />}
            >
              Reset
            </Button>
          )}

          {resultSummary ? (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-subtle tabular-nums">
              <Sparkles aria-hidden="true" className="size-3.5 text-faint" />
              {resultSummary}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
