'use client'

import * as React from 'react'
import Link from 'next/link'
import { Plus, X } from 'lucide-react'

import type { ScheduleChange } from '@/types'
import { shortDay } from '@/lib/activity-schedule'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { daysBetween, describeChange, describeDates, type PickMode } from './schedule-draft'

/* ==========================================================================
   CLOSED DAYS & CHANGES — every day-by-day change in one list (date, what,
   why) with a remove button, a quick "Add closed days", and the business's
   public holidays and closed days with this activity's opt-out.
   ========================================================================== */

export interface ScheduleChangesListProps {
  changes: ScheduleChange[]
  mode: PickMode
  todayKey: string
  /** "spots", "items". */
  spotWord: string
  /** The location a change is for, when the activity runs from more than one. */
  locationName?: (locationId: string | undefined) => string | null
  onRemove: (id: string) => void
  onAddClosed: (dates: string[], reason: string) => void
  /** Public holidays that close the business in the next year; null when they are off. */
  holidays: { country: string; days: { dateKey: string; name: string }[] } | null
  /** The business's own closed days in the next year. */
  closures: { dateKey: string; reason: string }[]
  runsOnClosures: boolean
  onRunsOnClosures: (on: boolean) => void
  error?: string
}

const SHOWN = 6

export function ScheduleChangesList({
  changes,
  mode,
  todayKey,
  spotWord,
  locationName,
  onRemove,
  onAddClosed,
  holidays,
  closures,
  runsOnClosures,
  onRunsOnClosures,
  error,
}: ScheduleChangesListProps) {
  const [showAll, setShowAll] = React.useState(false)
  const [adding, setAdding] = React.useState(false)
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [reason, setReason] = React.useState('')

  // Changes still ahead, soonest first; ones wholly in the past drop out of the list.
  const upcoming = React.useMemo(
    () =>
      changes
        .map((change) => ({ change, first: [...change.dates].sort().find((key) => key >= todayKey) }))
        .filter((entry): entry is { change: ScheduleChange; first: string } => Boolean(entry.first))
        .sort((a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : 0)),
    [changes, todayKey],
  )
  const shown = showAll ? upcoming : upcoming.slice(0, SHOWN)
  const bad = adding && from !== '' && to !== '' && to < from

  const add = () => {
    if (!from || bad) return
    const dates = daysBetween(from, to || from).filter((key) => key >= todayKey)
    if (dates.length === 0) return
    onAddClosed(dates, reason)
    setAdding(false)
    setFrom('')
    setTo('')
    setReason('')
  }

  const offDays = [...(holidays?.days ?? []).map((entry) => ({ dateKey: entry.dateKey, label: entry.name })), ...closures.map((entry) => ({ dateKey: entry.dateKey, label: entry.reason || 'Closed' }))].sort((a, b) =>
    a.dateKey < b.dateKey ? -1 : 1,
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{mode === 'dates' ? 'Dates and changes' : 'Closed days & changes'}</h3>
        {/* With specific dates nothing runs unless added, so there is nothing to close. */}
        {adding || mode === 'dates' ? null : (
          <Button type="button" variant="ghost" size="xs" leftIcon={<Plus />} onClick={() => setAdding(true)}>
            Add closed days
          </Button>
        )}
      </div>

      {adding ? (
        <form
          className="flex flex-col gap-3 rounded-xl border border-line bg-surface-sunken/40 p-3"
          onSubmit={(event) => {
            event.preventDefault()
            add()
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" size="sm" className="w-40" value={from} min={todayKey} aria-label="First closed day" onChange={(event) => setFrom(event.target.value)} />
            <span className="text-xs text-subtle">to</span>
            <Input type="date" size="sm" className="w-40" value={to} min={from || todayKey} error={bad} aria-label="Last closed day (optional)" onChange={(event) => setTo(event.target.value)} />
            <Input size="sm" className="min-w-40 flex-1" value={reason} maxLength={60} placeholder="Reason (optional)" aria-label="Reason" onChange={(event) => setReason(event.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={!from || bad}>
              Close {from && to && to > from ? `${daysBetween(from, to).length} days` : 'this day'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            {bad ? <span className="text-xs font-medium text-danger">The last day comes before the first</span> : null}
          </div>
        </form>
      ) : null}

      {upcoming.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-xs text-muted">
          {mode === 'dates' ? 'No dates yet. Click a day on the calendar to add one.' : 'No changes yet. Click a day on the calendar to change it.'}
        </p>
      ) : (
        <ul className="flex list-none flex-col divide-y divide-line-subtle rounded-xl border border-line p-0">
          {shown.map(({ change }) => {
            const place = locationName?.(change.locationId)
            return (
              <li key={change.id} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5">
                <span className="truncate text-[0.8125rem] font-medium tabular">{describeDates(change.dates.filter((key) => key >= todayKey))}</span>
                <span className="min-w-0 truncate text-[0.8125rem] text-foreground">
                  <span className={cn(change.action === 'closed' && !(change.times?.length) && 'text-danger')}>{describeChange(change, mode, spotWord)}</span>
                  {change.reason ? <span className="text-subtle"> · {change.reason}</span> : null}
                  {place ? <span className="text-subtle"> · {place}</span> : null}
                </span>
                <button
                  type="button"
                  aria-label={`Remove the change on ${describeDates(change.dates)}`}
                  onClick={() => onRemove(change.id)}
                  className="grid size-7 place-items-center rounded-md text-faint transition-colors hover:bg-danger-soft hover:text-danger focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {upcoming.length > SHOWN ? (
        <button type="button" onClick={() => setShowAll((value) => !value)} className="self-start text-xs font-medium text-primary hover:underline">
          {showAll ? 'Show fewer' : `Show all ${upcoming.length}`}
        </button>
      ) : null}
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}

      {/* ---- the business's closed days and public holidays (set once, in Availability) ---- */}
      {offDays.length === 0 && !runsOnClosures ? (
        <p className="text-xs text-subtle">
          No business closed days or public holidays in the next year.{' '}
          <Link href="/dashboard/availability" className="font-medium text-primary hover:underline">
            Set them in Availability
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-line p-3.5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[0.8125rem] font-medium">{holidays ? `Business closed days and ${holidays.country} holidays` : 'Business closed days'}</p>
            <Link href="/dashboard/availability" className="text-xs font-medium text-primary hover:underline">
              Edit in Availability
            </Link>
          </div>
          {offDays.length > 0 ? (
            <div className={cn('flex flex-wrap gap-1.5', runsOnClosures && 'opacity-60')}>
              {offDays.slice(0, 5).map((entry) => (
                <span key={`${entry.dateKey}-${entry.label}`} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-muted">
                  {entry.label} · {shortDay(entry.dateKey)}
                </span>
              ))}
              {offDays.length > 5 ? <span className="px-1 py-0.5 text-xs text-subtle">+{offDays.length - 5} more</span> : null}
            </div>
          ) : null}
          <label className="flex items-center justify-between gap-3 border-t border-line-subtle pt-3">
            <span className="text-sm font-medium">Run on these days anyway</span>
            <Switch checked={runsOnClosures} onCheckedChange={onRunsOnClosures} aria-label="Run on the business's closed days and holidays anyway" />
          </label>
        </div>
      )}
    </div>
  )
}
