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
  Waves,
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
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SearchInput } from '@/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
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
   saved views all agree on one shape.
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

/* ==========================================================================
   SAVED VIEW SELECT
   One control instead of a rail of chips: the active view by name, or
   "Custom view" once the operator has touched a tab or a filter.
   ========================================================================== */

export interface SavedViewSelectProps {
  /** Id of the saved view currently applied, or `null` for a hand-rolled filter. */
  activeViewId: string | null
  onApplyView: (view: SavedView) => void
  className?: string
}

export function SavedViewSelect({ activeViewId, onApplyView, className }: SavedViewSelectProps) {
  const active = SAVED_VIEWS.find((view) => view.id === activeViewId) ?? null
  const Icon = active?.icon ?? Bookmark
  return (
    <Select
      value={activeViewId ?? ''}
      onValueChange={(id) => {
        const view = SAVED_VIEWS.find((v) => v.id === id)
        if (view) onApplyView(view)
      }}
    >
      <SelectTrigger
        className={cn('w-full sm:w-[12.5rem]', className)}
        aria-label="Saved view"
        icon={<Icon className={cn('size-4', active ? 'text-primary' : 'text-subtle')} />}
      >
        <SelectValue placeholder="Custom view" />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[17rem]">
        {SAVED_VIEWS.map((view) => {
          const ViewIcon = view.icon
          return (
            <SelectItem
              key={view.id}
              value={view.id}
              icon={<ViewIcon className="size-4" />}
              description={view.hint}
            >
              {view.label}
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

/* ==========================================================================
   TOOLBAR
   Search, the departure dates, one Filters button for the rest, and a Reset
   that only appears once the desk has left a saved view.
   ========================================================================== */

/** Shell shared by the date and Filters triggers so they sit level with the selects. */
function triggerClass(active: boolean) {
  return cn(
    'group inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium whitespace-nowrap shadow-xs',
    'transition-[color,background-color,border-color] duration-200 ease-[var(--ease-out-quint)]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'data-[state=open]:border-primary data-[state=open]:ring-3 data-[state=open]:ring-primary/20',
    active
      ? 'border-[color-mix(in_oklab,var(--info)_40%,transparent)] bg-info-soft text-info'
      : 'border-line bg-surface text-foreground hover:border-line-strong',
  )
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </div>
  )
}

interface FiltersPopoverProps {
  filters: BookingFilters
  onFiltersChange: (next: BookingFilters) => void
  activities: Activity[]
}

function FiltersPopover({ filters, onFiltersChange, activities }: FiltersPopoverProps) {
  const set = <K extends keyof BookingFilters>(key: K, value: BookingFilters[K]) =>
    onFiltersChange({ ...filters, [key]: value })

  const count =
    (filters.activityId !== 'all' ? 1 : 0) +
    (filters.channel !== 'all' ? 1 : 0) +
    (filters.payment !== 'all' ? 1 : 0)

  const sortedActivities = React.useMemo(
    () => [...activities].sort((a, b) => a.name.localeCompare(b.name)),
    [activities],
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={triggerClass(count > 0)}
          aria-label={count > 0 ? `Filters, ${count} active` : 'Filters'}
        >
          <ListFilter
            aria-hidden="true"
            className={cn('size-4 shrink-0', count > 0 ? 'text-info' : 'text-subtle')}
          />
          Filters
          {count > 0 ? (
            <span className="grid size-5 place-items-center rounded-full bg-info text-xs font-semibold text-on-primary tabular-nums">
              {count}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" width="md" padding="sm" className="flex flex-col gap-3">
        <div className="flex h-7 items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Filters</p>
          {count > 0 ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() =>
                onFiltersChange({ ...filters, activityId: 'all', channel: 'all', payment: 'all' })
              }
            >
              Clear
            </Button>
          ) : null}
        </div>

        <FilterField label="Experience">
          <Select value={filters.activityId} onValueChange={(value) => set('activityId', value)}>
            <SelectTrigger aria-label="Filter by experience" icon={<Ship className="size-4" />}>
              <SelectValue placeholder="Experience" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All experiences</SelectItem>
              {sortedActivities.map((activity) => (
                <SelectItem key={activity.id} value={activity.id}>
                  {activity.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Channel">
          <Select
            value={filters.channel}
            onValueChange={(value) => set('channel', value as BookingChannel | 'all')}
          >
            <SelectTrigger aria-label="Filter by booking channel" icon={<Globe className="size-4" />}>
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All channels</SelectItem>
              {(Object.keys(CHANNEL_LABELS) as BookingChannel[]).map((channel) => (
                <SelectItem key={channel} value={channel}>
                  {CHANNEL_LABELS[channel]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Payment">
          <Select
            value={filters.payment}
            onValueChange={(value) => set('payment', value as PaymentStatus | 'all')}
          >
            <SelectTrigger
              aria-label="Filter by payment status"
              icon={<CircleDollarSign className="size-4" />}
            >
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any payment state</SelectItem>
              {PAYMENT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </PopoverContent>
    </Popover>
  )
}

export interface BookingsFiltersProps {
  filters: BookingFilters
  onFiltersChange: (next: BookingFilters) => void
  activities: Activity[]
  /** Shows the Reset control; the page decides when the desk has drifted from a view. */
  resettable?: boolean
  onReset?: () => void
  /** Rendered at the right, e.g. "1,284 of 13,268 reservations". */
  resultSummary?: React.ReactNode
  /** Display controls rendered after the summary. */
  trailing?: React.ReactNode
  className?: string
}

export function BookingsFilters({
  filters,
  onFiltersChange,
  activities,
  resettable = false,
  onReset,
  resultSummary,
  trailing,
  className,
}: BookingsFiltersProps) {
  const set = React.useCallback(
    <K extends keyof BookingFilters>(key: K, value: BookingFilters[K]) => {
      onFiltersChange({ ...filters, [key]: value })
    },
    [filters, onFiltersChange],
  )

  const fallbackRange = React.useMemo(
    () => rangeForPreset('30d', NOW) ?? { from: TODAY_KEY, to: TODAY_KEY },
    [],
  )

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <SearchInput
        value={filters.search}
        onValueChange={(value) => set('search', value)}
        debounceMs={180}
        label="Search reservations"
        placeholder="Reference, guest name or email…"
        shortcut={false}
        fieldClassName="w-full rounded-lg sm:w-72"
      />

      <DateRangePicker
        value={filters.range ?? fallbackRange}
        referenceDate={NOW}
        onChange={(range) => set('range', range)}
        numberOfMonths={2}
        align="start"
        label="Filter by departure date"
        trigger={
          <button type="button" className={triggerClass(Boolean(filters.range))}>
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

      <FiltersPopover filters={filters} onFiltersChange={onFiltersChange} activities={activities} />

      {resettable && onReset ? (
        <Button variant="ghost" size="sm" onClick={onReset} leftIcon={<RotateCcw />}>
          Reset
        </Button>
      ) : null}

      {resultSummary || trailing ? (
        <div className="flex items-center gap-3 sm:ml-auto">
          {resultSummary ? (
            <span className="text-sm text-subtle tabular-nums">{resultSummary}</span>
          ) : null}
          {trailing}
        </div>
      ) : null}
    </div>
  )
}
