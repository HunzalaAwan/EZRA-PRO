'use client'

import * as React from 'react'
import { CircleDollarSign, Globe, ListFilter, MapPin, RotateCcw, Ship, Tag, X } from 'lucide-react'

import type { Activity, BookingChannel, BookingStatus, DateRange, PaymentStatus } from '@/types'
import { CHANNEL_LABELS } from '@/lib/demo-core'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SearchInput } from '@/components/ui/search-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BookingDatePicker } from '@/components/dashboard/bookings/booking-date-picker'

/* ==========================================================================
   THE RESERVATIONS DESK — views and filters

   Views answer the questions a desk asks all day, one tab each: what is on
   today, what is coming, what just came in, what needs me, what fell
   through, everything. The calendar picks any day or range. Everything
   else (status, experience, location, channel, payment) sits behind one
   Filters button, and whatever is on shows as a chip that can be removed.
   ========================================================================== */

export type DeskView = 'today' | 'upcoming' | 'recent' | 'attention' | 'cancelled' | 'all'

export const DESK_VIEWS: { id: DeskView; label: string; hint: string }[] = [
  { id: 'today', label: 'Today', hint: 'Every booking for today, by start time' },
  { id: 'upcoming', label: 'Next 7 days', hint: 'Today to a week out, soonest first. Pick any later date on the calendar.' },
  { id: 'recent', label: 'Recently booked', hint: 'Made in the last 7 days, newest first' },
  { id: 'attention', label: 'Needs attention', hint: 'This week: waiting to be confirmed, or money still to collect' },
  { id: 'cancelled', label: 'Cancelled', hint: 'Cancelled, refunded and no-shows' },
  { id: 'all', label: 'All', hint: 'Every booking, past and future' },
]

export type StatusFilter = 'all' | 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled'

/** Cancelled is a bucket, not a single status: no-shows and refunds land here too. */
export const STATUS_MATCH: Record<StatusFilter, BookingStatus[]> = {
  all: [],
  pending: ['pending'],
  confirmed: ['confirmed'],
  checked_in: ['checked_in'],
  completed: ['completed'],
  cancelled: ['cancelled', 'no_show', 'refunded'],
}

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'Any status',
  pending: 'Pending',
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export interface BookingFilters {
  /** Matches reference, guest name or guest email. */
  search: string
  status: StatusFilter
  activityId: string | 'all'
  channel: BookingChannel | 'all'
  payment: PaymentStatus | 'all'
  /** The location the departure leaves from, or every location. */
  locationId: string | 'all'
  /** The days the bookings run on; null is any date. */
  range: DateRange | null
}

export const DEFAULT_BOOKING_FILTERS: BookingFilters = {
  search: '',
  status: 'all',
  activityId: 'all',
  channel: 'all',
  payment: 'all',
  locationId: 'all',
  range: null,
}

/** Filters behind the Filters button that are on. */
export function activeFilterCount(filters: BookingFilters) {
  return (['status', 'activityId', 'channel', 'payment', 'locationId'] as const).filter((key) => filters[key] !== 'all').length
}

const PAYMENT_OPTIONS: { value: PaymentStatus; label: string }[] = [
  { value: 'paid', label: 'Paid in full' },
  { value: 'deposit_paid', label: 'Deposit paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'partially_refunded', label: 'Part refunded' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'failed', label: 'Payment failed' },
]

function triggerClass(active: boolean) {
  return cn(
    'group inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium whitespace-nowrap shadow-xs',
    'transition-[color,background-color,border-color] duration-200 ease-[var(--ease-out-quint)]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'data-[state=open]:border-primary data-[state=open]:ring-3 data-[state=open]:ring-primary/20',
    active ? 'border-[color-mix(in_oklab,var(--info)_40%,transparent)] bg-info-soft text-info' : 'border-line bg-surface text-foreground hover:border-line-strong',
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
  locations: { id: string; name: string }[]
}

function FiltersPopover({ filters, onFiltersChange, activities, locations }: FiltersPopoverProps) {
  const set = <K extends keyof BookingFilters>(key: K, value: BookingFilters[K]) => onFiltersChange({ ...filters, [key]: value })
  const count = activeFilterCount(filters)
  const sortedActivities = React.useMemo(() => [...activities].sort((a, b) => a.name.localeCompare(b.name)), [activities])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={triggerClass(count > 0)} aria-label={count > 0 ? `Filters, ${count} on` : 'Filters'}>
          <ListFilter aria-hidden="true" className={cn('size-4 shrink-0', count > 0 ? 'text-info' : 'text-subtle')} />
          Filters
          {count > 0 ? <span className="grid size-5 place-items-center rounded-full bg-info text-xs font-semibold text-on-primary tabular-nums">{count}</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" width="md" padding="sm" className="flex flex-col gap-3">
        <div className="flex h-7 items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Filters</p>
          {count > 0 ? (
            <Button variant="ghost" size="xs" onClick={() => onFiltersChange({ ...filters, status: 'all', activityId: 'all', channel: 'all', payment: 'all', locationId: 'all' })}>
              Clear
            </Button>
          ) : null}
        </div>

        <FilterField label="Status">
          <Select value={filters.status} onValueChange={(value) => set('status', value as StatusFilter)}>
            <SelectTrigger aria-label="Filter by status" icon={<Tag className="size-4" />}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Activity">
          <Select value={filters.activityId} onValueChange={(value) => set('activityId', value)}>
            <SelectTrigger aria-label="Filter by activity" icon={<Ship className="size-4" />}>
              <SelectValue placeholder="Activity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All activities</SelectItem>
              {sortedActivities.map((activity) => (
                <SelectItem key={activity.id} value={activity.id}>
                  {activity.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        {locations.length > 1 ? (
          <FilterField label="Location">
            <Select value={filters.locationId} onValueChange={(value) => set('locationId', value)}>
              <SelectTrigger aria-label="Filter by location" icon={<MapPin className="size-4" />}>
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All locations</SelectItem>
                {locations.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <FilterField label="Booked through">
            <Select value={filters.channel} onValueChange={(value) => set('channel', value as BookingChannel | 'all')}>
              <SelectTrigger aria-label="Filter by booking channel" icon={<Globe className="size-4" />}>
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Anywhere</SelectItem>
                {(Object.keys(CHANNEL_LABELS) as BookingChannel[]).map((channel) => (
                  <SelectItem key={channel} value={channel}>
                    {CHANNEL_LABELS[channel]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Payment">
            <Select value={filters.payment} onValueChange={(value) => set('payment', value as PaymentStatus | 'all')}>
              <SelectTrigger aria-label="Filter by payment status" icon={<CircleDollarSign className="size-4" />}>
                <SelectValue placeholder="Payment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any payment</SelectItem>
                {PAYMENT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** What is on, as chips that can be taken off one at a time. */
function ActiveChips({ filters, onFiltersChange, activities, locations }: FiltersPopoverProps) {
  const chips = [
    filters.status !== 'all' ? { key: 'status' as const, label: STATUS_LABEL[filters.status] } : null,
    filters.activityId !== 'all' ? { key: 'activityId' as const, label: activities.find((entry) => entry.id === filters.activityId)?.name ?? 'Activity' } : null,
    filters.locationId !== 'all' ? { key: 'locationId' as const, label: locations.find((entry) => entry.id === filters.locationId)?.name ?? 'Location' } : null,
    filters.channel !== 'all' ? { key: 'channel' as const, label: CHANNEL_LABELS[filters.channel] } : null,
    filters.payment !== 'all' ? { key: 'payment' as const, label: PAYMENT_OPTIONS.find((entry) => entry.value === filters.payment)?.label ?? 'Payment' } : null,
  ].filter((chip): chip is NonNullable<typeof chip> => chip !== null)
  if (chips.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span key={chip.key} className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface pr-1 pl-3 text-xs font-medium text-foreground">
          {chip.label}
          <button
            type="button"
            aria-label={`Remove ${chip.label}`}
            onClick={() => onFiltersChange({ ...filters, [chip.key]: 'all' })}
            className="grid size-6 place-items-center rounded-full text-subtle hover:bg-surface-sunken hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  )
}

export interface BookingsFiltersProps {
  filters: BookingFilters
  onFiltersChange: (next: BookingFilters) => void
  /** The calendar: any day or range, separate so the page can switch views with it. */
  onRangeChange: (range: DateRange | null) => void
  activities: Activity[]
  locations?: { id: string; name: string }[]
  todayKey: string
  /** Days with bookings, dotted on the calendar. */
  bookedDays?: Set<string>
  resettable?: boolean
  onReset?: () => void
  resultSummary?: React.ReactNode
  trailing?: React.ReactNode
  className?: string
}

export function BookingsFilters({
  filters,
  onFiltersChange,
  onRangeChange,
  activities,
  locations = [],
  todayKey,
  bookedDays,
  resettable = false,
  onReset,
  resultSummary,
  trailing,
  className,
}: BookingsFiltersProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <SearchInput
        value={filters.search}
        onValueChange={(value) => onFiltersChange({ ...filters, search: value })}
        debounceMs={180}
        label="Search bookings"
        placeholder="Reference, guest name or email…"
        shortcut={false}
        fieldClassName="w-full rounded-lg sm:w-64"
      />
      <BookingDatePicker value={filters.range} onChange={onRangeChange} todayKey={todayKey} bookedDays={bookedDays} />
      <FiltersPopover filters={filters} onFiltersChange={onFiltersChange} activities={activities} locations={locations} />
      <ActiveChips filters={filters} onFiltersChange={onFiltersChange} activities={activities} locations={locations} />
      {resettable && onReset ? (
        <Button variant="ghost" size="sm" onClick={onReset} leftIcon={<RotateCcw />}>
          Reset
        </Button>
      ) : null}
      {resultSummary || trailing ? (
        <div className="flex items-center gap-3 sm:ml-auto">
          {resultSummary ? <span className="text-sm text-subtle tabular-nums">{resultSummary}</span> : null}
          {trailing}
        </div>
      ) : null}
    </div>
  )
}
