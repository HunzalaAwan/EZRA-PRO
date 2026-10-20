'use client'

import * as React from 'react'
import { CalendarOff, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { isDayKey, shiftDayKey } from '@/lib/activity-schedule'
import type { BookingDefaults } from '@/lib/booking-defaults'
import { HOLIDAY_COUNTRIES, holidayCountryOf, holidaysFor } from '@/lib/holidays'
import { cn, fromDateKey, pluralize } from '@/lib/utils'
import type { BusinessClosure, Tenant } from '@/types'

/* ==========================================================================
   Closed days & holidays — the days the whole business is closed. Saved in
   the business's booking defaults (`closures`, `holidays`), which the
   schedule engine reads for every activity that doesn't run on closed days.
   ========================================================================== */

/** The longest closure added at once. */
const MAX_DAYS = 366

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Dec 25". */
const monthDay = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${Number(key.slice(8, 10))}`
/** "Fri, Dec 25". */
const weekdayDay = (key: string) => `${WEEKDAYS[fromDateKey(key).getDay()]}, ${monthDay(key)}`

/** Every day from one key to another, inclusive. */
function daysFrom(fromKey: string, toKey: string): string[] {
  const out: string[] = []
  for (let key = fromKey; key <= toKey && out.length <= MAX_DAYS; key = shiftDayKey(key, 1)) out.push(key)
  return out
}

const isRun = (dates: string[]) => dates.every((date, index) => index === 0 || shiftDayKey(dates[index - 1], 1) === date)

/** "Fri, Dec 25, 2026", "Dec 24 – 26, 2026", "Dec 30, 2026 – Jan 2, 2027", "Dec 24 and 2 more days". */
function closureLabel(dates: string[]): string {
  const first = dates[0]
  const last = dates[dates.length - 1]
  if (dates.length === 1) return `${weekdayDay(first)}, ${first.slice(0, 4)}`
  if (!isRun(dates)) return `${monthDay(first)} and ${dates.length - 1} more ${dates.length === 2 ? 'day' : 'days'}`
  if (first.slice(0, 4) !== last.slice(0, 4)) return `${monthDay(first)}, ${first.slice(0, 4)} – ${monthDay(last)}, ${last.slice(0, 4)}`
  if (first.slice(0, 7) === last.slice(0, 7)) return `${monthDay(first)} – ${Number(last.slice(8, 10))}, ${first.slice(0, 4)}`
  return `${monthDay(first)} – ${monthDay(last)}, ${first.slice(0, 4)}`
}

export interface ClosedDaysCardProps {
  tenant: Tenant
  todayKey: string
  /** Booked time slots per day ahead: they still run when the day is closed. */
  bookedByDay?: Record<string, number>
  /** Opens the add form on first render (Overview → Close a day). */
  openAdd?: boolean
}

export function ClosedDaysCard({ tenant, todayKey, bookedByDay, openAdd = false }: ClosedDaysCardProps) {
  const { defaults, save } = useBookingDefaults(tenant.slug)
  // The latest settings, for an undo that runs after other changes were saved.
  const latest = React.useRef<BookingDefaults>(defaults)
  latest.current = defaults

  const closures = React.useMemo(
    () => [...(defaults.closures ?? [])].sort((a, b) => (a.dates[0] < b.dates[0] ? -1 : a.dates[0] > b.dates[0] ? 1 : 0)),
    [defaults.closures],
  )

  /* ---------- add closed days ---------- */

  const [adding, setAdding] = React.useState(openAdd)
  const [from, setFrom] = React.useState(todayKey)
  const [to, setTo] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const formRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (openAdd) formRef.current?.scrollIntoView({ block: 'center' })
  }, [openAdd])

  const openForm = () => {
    setFrom(todayKey)
    setTo('')
    setReason('')
    setError(null)
    setAdding(true)
  }

  // The days the form would close, and how many booked time slots fall on them (they still run).
  const pending = React.useMemo(() => {
    if (!isDayKey(from)) return []
    const end = to && isDayKey(to) && to >= from ? to : from
    return daysFrom(from, end)
  }, [from, to])
  const bookedIn = (dates: string[]) => dates.reduce((sum, dateKey) => sum + (bookedByDay?.[dateKey] ?? 0), 0)
  const pendingBooked = bookedIn(pending)

  const add = () => {
    if (!isDayKey(from)) return setError('Pick a date')
    if (from < todayKey) return setError('Pick today or later')
    const end = to && isDayKey(to) ? to : from
    if (end < from) return setError('The end is before the start')
    const dates = daysFrom(from, end)
    if (dates.length > MAX_DAYS) return setError('Up to a year at a time')
    const current = latest.current
    const closedAlready = new Set((current.closures ?? []).flatMap((entry) => entry.dates))
    if (dates.every((dateKey) => closedAlready.has(dateKey))) return setError(dates.length === 1 ? 'Already closed that day' : 'Already closed on these days')
    const closure: BusinessClosure = { id: `closure_${Date.now().toString(36)}`, dates, reason: reason.trim() }
    if (!save({ ...current, closures: [...(current.closures ?? []), closure] })) return
    const booked = bookedIn(dates)
    toast.success(dates.length === 1 ? 'Closed day added' : `${dates.length} closed days added`, {
      description: booked > 0 ? `${closureLabel(dates)} · ${booked} booked ${pluralize(booked, 'time slot')} still ${booked === 1 ? 'runs' : 'run'}` : closureLabel(dates),
    })
    setAdding(false)
  }

  const remove = (closure: BusinessClosure) => {
    const current = latest.current
    if (!save({ ...current, closures: (current.closures ?? []).filter((entry) => entry.id !== closure.id) })) return
    toast('Closed days removed', {
      description: closureLabel(closure.dates),
      action: {
        label: 'Undo',
        onClick: () => {
          const now = latest.current
          if (!(now.closures ?? []).some((entry) => entry.id === closure.id)) save({ ...now, closures: [...(now.closures ?? []), closure] })
        },
      },
    })
  }

  /* ---------- public holidays ---------- */

  const country = holidayCountryOf(tenant.country)
  const countryName = HOLIDAY_COUNTRIES.find((entry) => entry.code === country)?.name ?? tenant.country
  const holidaysOn = Boolean(country && defaults.holidays?.enabled)
  const thisYear = Number(todayKey.slice(0, 4))
  const [year, setYear] = React.useState(thisYear)
  const [showList, setShowList] = React.useState(false)
  const holidays = React.useMemo(() => (country ? holidaysFor(country, year) : []), [country, year])
  const holidaysThisYear = React.useMemo(() => (country ? holidaysFor(country, thisYear).length : 0), [country, thisYear])

  const setHolidays = (enabled: boolean) => {
    if (!country) return
    const current = latest.current
    if (!save({ ...current, holidays: { country, enabled } })) return
    if (enabled) toast.success('Closed on public holidays', { description: countryName })
    else toast('Open on public holidays')
  }

  return (
    <Card>
      <CardHeader className="flex-col sm:flex-row">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            <CalendarOff className="size-4 text-primary" aria-hidden="true" />
            Closed days &amp; holidays
          </CardTitle>
          <CardDescription>Applies to every activity unless it runs on closed days.</CardDescription>
        </div>
        {!adding ? (
          <Button variant="outline" size="sm" leftIcon={<Plus />} onClick={openForm}>
            Add closed days
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="flex flex-col gap-5 pt-0">
        {adding ? (
          <div ref={formRef} className="flex flex-col gap-2">
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-sunken/50 p-3.5 lg:flex-row lg:items-end">
              <div className="grid grid-cols-2 gap-3 lg:w-80 lg:shrink-0">
                <Field label="From" error={error ?? undefined}>
                  {(control) => (
                    <Input
                      {...control}
                      type="date"
                      min={todayKey}
                      value={from}
                      autoFocus
                      onChange={(event) => {
                        setFrom(event.target.value)
                        setError(null)
                      }}
                    />
                  )}
                </Field>
                <Field label="To" optional>
                  {(control) => (
                    <Input
                      {...control}
                      type="date"
                      min={from || todayKey}
                      value={to}
                      onChange={(event) => {
                        setTo(event.target.value)
                        setError(null)
                      }}
                    />
                  )}
                </Field>
              </div>
              <Field label="Reason" optional className="min-w-0 flex-1">
                {(control) => (
                  <Input
                    {...control}
                    value={reason}
                    maxLength={80}
                    placeholder="e.g. Team training day"
                    onChange={(event) => setReason(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        add()
                      }
                    }}
                  />
                )}
              </Field>
              <div className="flex items-center gap-2 lg:pb-px">
                <Button size="sm" onClick={add}>
                  Add
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                  Cancel
                </Button>
              </div>
            </div>
            {pendingBooked > 0 ? (
              <p className="px-1 text-xs text-muted">
                {pendingBooked} booked {pluralize(pendingBooked, 'time slot')} on {pending.length === 1 ? 'this day' : 'these days'} still {pendingBooked === 1 ? 'runs' : 'run'}. New bookings stop.
              </p>
            ) : null}
          </div>
        ) : null}

        {closures.length > 0 ? (
          <ul className="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line">
            {closures.map((closure) => {
              const first = closure.dates[0]
              const past = closure.dates[closure.dates.length - 1] < todayKey
              const label = closureLabel(closure.dates)
              return (
                <li key={closure.id} className={cn('flex items-center gap-3 bg-surface px-3.5 py-3', past && 'opacity-60')}>
                  <span aria-hidden="true" className="flex size-10 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-sunken leading-none">
                    <span className="text-xs font-medium text-subtle">{MONTHS[Number(first.slice(5, 7)) - 1]}</span>
                    <span className="mt-0.5 text-sm font-semibold text-foreground tabular">{Number(first.slice(8, 10))}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{label}</p>
                    <p className="truncate text-xs text-muted">
                      {closure.reason.trim() || 'Closed'}
                      {closure.dates.length > 1 ? ` · ${closure.dates.length} days` : ''}
                    </p>
                  </div>
                  <IconButton variant="ghost" size="sm" aria-label={`Remove ${label}`} onClick={() => remove(closure)}>
                    <Trash2 />
                  </IconButton>
                </li>
              )
            })}
          </ul>
        ) : !adding ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-center text-sm text-subtle">No closed days</p>
        ) : null}

        <Separator />

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Close on public holidays</p>
              <p className="text-xs text-subtle">
                {country ? (
                  <>
                    {countryName} · {holidaysThisYear} days in {thisYear} ·{' '}
                    <button
                      type="button"
                      aria-expanded={showList}
                      onClick={() => setShowList((open) => !open)}
                      className="font-medium text-primary hover:underline"
                    >
                      {showList ? 'Hide' : 'See them'}
                    </button>
                  </>
                ) : (
                  `No holiday list for ${tenant.country} yet`
                )}
              </p>
            </div>
            <Switch checked={holidaysOn} disabled={!country} onCheckedChange={setHolidays} aria-label="Close on public holidays" />
          </div>

          {country && showList ? (
            <>
              <Segmented
                size="sm"
                label="Year"
                className="self-start"
                value={String(year)}
                onValueChange={(value) => setYear(Number(value))}
                options={[thisYear, thisYear + 1].map((entry) => ({ value: String(entry), label: String(entry) }))}
              />
              <ul className={cn('grid gap-x-8 gap-y-2 sm:grid-cols-2', !holidaysOn && 'text-muted')}>
                {holidays.map((holiday) => (
                  <li key={holiday.dateKey} className={cn('flex min-w-0 items-baseline gap-3', holiday.dateKey < todayKey && 'opacity-50')}>
                    <span className="w-24 shrink-0 text-xs text-subtle tabular">{weekdayDay(holiday.dateKey)}</span>
                    <span className={cn('truncate text-sm', holidaysOn && 'text-foreground')}>{holiday.name}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
