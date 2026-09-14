'use client'

/**
 * CalendarFilters — the popover that narrows every calendar view at once.
 *
 * The filter *state* and the pure `filterEvents` reducer live here too, so the
 * shell, the views and the popover can never disagree about what "filtered"
 * means.
 */

import * as React from 'react'
import { ListFilter, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { getActivitiesByTenant, getUsersByTenant } from '@/lib/demo-core'
import type { CalendarEvent } from '@/lib/demo'
import type { DepartureStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge, departureStatusMeta } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar } from '@/components/ui/avatar'
import { EVENT_SOLID, eventVar } from '@/components/dashboard/calendar/departure-chip'

/* ==========================================================================
   STATE
   ========================================================================== */

export interface CalendarFilterState {
  /** Empty means "every activity". */
  activityIds: string[]
  statuses: DepartureStatus[]
  staffIds: string[]
  showCancelled: boolean
}

export const DEFAULT_CALENDAR_FILTERS: CalendarFilterState = {
  activityIds: [],
  statuses: [],
  staffIds: [],
  showCancelled: true,
}

const FILTERABLE_STATUSES: DepartureStatus[] = [
  'scheduled',
  'confirmed',
  'sold_out',
  'weather_hold',
  'completed',
  'cancelled',
]

export function activeFilterCount(filters: CalendarFilterState): number {
  return (
    filters.activityIds.length +
    filters.statuses.length +
    filters.staffIds.length +
    (filters.showCancelled ? 0 : 1)
  )
}

/** Pure, allocation-light reducer used by every view. */
export function filterEvents(
  events: CalendarEvent[],
  filters: CalendarFilterState,
): CalendarEvent[] {
  const byActivity = filters.activityIds.length > 0 ? new Set(filters.activityIds) : null
  const byStatus = filters.statuses.length > 0 ? new Set<string>(filters.statuses) : null
  const byStaff = filters.staffIds.length > 0 ? new Set(filters.staffIds) : null

  if (!byActivity && !byStatus && !byStaff && filters.showCancelled) return events

  return events.filter(({ departure }) => {
    if (!filters.showCancelled && departure.status === 'cancelled') return false
    if (byActivity && !byActivity.has(departure.activityId)) return false
    if (byStatus && !byStatus.has(departure.status)) return false
    if (byStaff && !departure.assignedStaffIds.some((id) => byStaff.has(id))) return false
    return true
  })
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

/* ==========================================================================
   PIECES
   ========================================================================== */

function Section({
  title,
  count,
  children,
}: {
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-line-subtle px-3 py-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between px-1">
        <h4 className="text-[0.6875rem] font-semibold tracking-wider text-faint uppercase">
          {title}
        </h4>
        {count ? (
          <Badge size="sm" variant="primary">
            {count}
          </Badge>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function FilterRow({
  checked,
  onCheckedChange,
  children,
  id,
}: {
  checked: boolean
  onCheckedChange: (next: boolean) => void
  children: React.ReactNode
  id: string
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5',
        'text-[0.8125rem] text-foreground transition-colors duration-150',
        'hover:bg-surface-sunken has-[:focus-visible]:bg-surface-sunken',
      )}
    >
      <Checkbox
        id={id}
        size="sm"
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      {children}
    </label>
  )
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export interface CalendarFiltersProps {
  tenantId: string
  filters: CalendarFilterState
  onChange: (next: CalendarFilterState) => void
  className?: string
}

export function CalendarFilters({ tenantId, filters, onChange, className }: CalendarFiltersProps) {
  const [open, setOpen] = React.useState(false)
  const reactId = React.useId()

  const activities = React.useMemo(
    () =>
      getActivitiesByTenant(tenantId)
        .filter((activity) => activity.status !== 'archived')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tenantId],
  )

  const staff = React.useMemo(
    () => getUsersByTenant(tenantId).filter((user) => user.isBookable),
    [tenantId],
  )

  const count = activeFilterCount(filters)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={count > 0 ? 'secondary' : 'outline'}
          size="sm"
          leftIcon={<ListFilter aria-hidden="true" />}
          className={cn('shrink-0', className)}
          aria-label={count > 0 ? `Filters, ${count} active` : 'Filters'}
        >
          <span className="hidden sm:inline">Filters</span>
          {count > 0 ? (
            <span className="tabular ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[0.625rem] font-bold text-on-primary">
              {count}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        padding="none"
        width="auto"
        className="w-[min(21rem,calc(100vw-2rem))] overflow-hidden"
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Filter departures</p>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_CALENDAR_FILTERS)}
            disabled={count === 0}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors duration-150',
              count === 0
                ? 'cursor-not-allowed text-faint'
                : 'text-primary hover:bg-primary-soft',
            )}
          >
            Clear all
          </button>
        </div>

        <ScrollArea className="max-h-[26rem]" viewportClassName="max-h-[26rem]">
          <Section title="Activity" count={filters.activityIds.length}>
            <div className="flex flex-col">
              {activities.map((activity) => (
                <FilterRow
                  key={activity.id}
                  id={`${reactId}-act-${activity.id}`}
                  checked={filters.activityIds.includes(activity.id)}
                  onCheckedChange={() =>
                    onChange({ ...filters, activityIds: toggle(filters.activityIds, activity.id) })
                  }
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'size-2.5 shrink-0 rounded-full',
                      eventVar(activity.colorKey),
                      EVENT_SOLID,
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">{activity.name}</span>
                  {activity.status !== 'live' ? (
                    <Badge size="sm" variant="outline" className="shrink-0">
                      {activity.status}
                    </Badge>
                  ) : null}
                </FilterRow>
              ))}
            </div>
          </Section>

          <Section title="Status" count={filters.statuses.length}>
            <div className="flex flex-col">
              {FILTERABLE_STATUSES.map((status) => {
                const meta = departureStatusMeta[status]
                const Icon = meta.icon
                return (
                  <FilterRow
                    key={status}
                    id={`${reactId}-status-${status}`}
                    checked={filters.statuses.includes(status)}
                    onCheckedChange={() =>
                      onChange({
                        ...filters,
                        statuses: toggle(filters.statuses, status) as DepartureStatus[],
                      })
                    }
                  >
                    <Icon aria-hidden="true" className="size-3.5 shrink-0 text-subtle" />
                    <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                  </FilterRow>
                )
              })}
            </div>
          </Section>

          <Section title="Crew" count={filters.staffIds.length}>
            <div className="flex flex-col">
              {staff.map((user) => (
                <FilterRow
                  key={user.id}
                  id={`${reactId}-staff-${user.id}`}
                  checked={filters.staffIds.includes(user.id)}
                  onCheckedChange={() =>
                    onChange({ ...filters, staffIds: toggle(filters.staffIds, user.id) })
                  }
                >
                  <Avatar name={user.name} src={user.avatarUrl} size="xs" />
                  <span className="min-w-0 flex-1 truncate">{user.name}</span>
                  <span className="shrink-0 text-[0.6875rem] text-faint">{user.role}</span>
                </FilterRow>
              ))}
            </div>
          </Section>

          <Section title="Options">
            <label
              htmlFor={`${reactId}-cancelled`}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-surface-sunken"
            >
              <span className="flex flex-col">
                <span className="text-[0.8125rem] font-medium text-foreground">
                  Show cancelled
                </span>
                <span className="text-[0.6875rem] text-subtle">
                  Keep cancelled departures visible on the grid
                </span>
              </span>
              <Switch
                id={`${reactId}-cancelled`}
                size="sm"
                checked={filters.showCancelled}
                onCheckedChange={(value) => onChange({ ...filters, showCancelled: value })}
              />
            </label>
          </Section>
        </ScrollArea>

        <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-sunken/60 px-3 py-2.5">
          <p className="text-[0.6875rem] text-subtle">
            {count === 0 ? 'No filters applied' : `${count} filter${count === 1 ? '' : 's'} applied`}
          </p>
          <Button size="xs" variant="secondary" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ==========================================================================
   ACTIVE FILTER PILLS — rendered by the shell under the toolbar
   ========================================================================== */

export interface ActiveFilterPillsProps {
  tenantId: string
  filters: CalendarFilterState
  onChange: (next: CalendarFilterState) => void
}

export function ActiveFilterPills({ tenantId, filters, onChange }: ActiveFilterPillsProps) {
  const count = activeFilterCount(filters)
  if (count === 0) return null

  const activityNames = new Map(
    getActivitiesByTenant(tenantId).map((activity) => [activity.id, activity.name]),
  )
  const staffNames = new Map(getUsersByTenant(tenantId).map((user) => [user.id, user.name]))

  const pills: { key: string; label: string; onRemove: () => void }[] = [
    ...filters.activityIds.map((id) => ({
      key: `act-${id}`,
      label: activityNames.get(id) ?? 'Activity',
      onRemove: () =>
        onChange({ ...filters, activityIds: filters.activityIds.filter((v) => v !== id) }),
    })),
    ...filters.statuses.map((status) => ({
      key: `status-${status}`,
      label: departureStatusMeta[status].label,
      onRemove: () =>
        onChange({ ...filters, statuses: filters.statuses.filter((v) => v !== status) }),
    })),
    ...filters.staffIds.map((id) => ({
      key: `staff-${id}`,
      label: staffNames.get(id) ?? 'Crew',
      onRemove: () => onChange({ ...filters, staffIds: filters.staffIds.filter((v) => v !== id) }),
    })),
  ]

  if (!filters.showCancelled) {
    pills.push({
      key: 'cancelled',
      label: 'Cancelled hidden',
      onRemove: () => onChange({ ...filters, showCancelled: true }),
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {pills.map((pill) => (
        <button
          key={pill.key}
          type="button"
          onClick={pill.onRemove}
          className={cn(
            'group/pill inline-flex items-center gap-1.5 rounded-full border border-line',
            'bg-surface py-1 pr-1.5 pl-2.5 text-[0.6875rem] font-medium text-muted',
            'transition-colors duration-150 hover:border-line-strong hover:text-foreground',
          )}
        >
          {pill.label}
          <X aria-hidden="true" className="size-3 text-faint group-hover/pill:text-danger" />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(DEFAULT_CALENDAR_FILTERS)}
        className="rounded-full px-2 py-1 text-[0.6875rem] font-semibold text-primary transition-colors hover:bg-primary-soft"
      >
        Clear all
      </button>
    </div>
  )
}
