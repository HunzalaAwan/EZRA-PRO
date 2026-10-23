'use client'

/**
 * NewDepartureDialog — "Add a time slot": start times on one day, or on
 * chosen weekdays until a date, for any activity. Saved as an `add` change
 * on that activity's schedule (`upsertScheduleChange`), so the storefront
 * sells it, the activity's Schedule tab lists it and the Schedule step shows
 * it under its changes. Times the schedule already has on a day aren't counted
 * again, and a repeat skips closed days (one day picked on its own opens it).
 * Validation is zod-first; the UI renders what zod reports.
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { CalendarPlus, Clock, Plus, Repeat, X } from 'lucide-react'

import { cn, addDays, formatDateLong, formatDuration, fromDateKey, pluralize, toDateKey } from '@/lib/utils'
import { NOW, getActivitiesByTenant, getLocationsByTenant, tenantById } from '@/lib/demo-core'
import { applyActivityOverride, parseActivityOverrides, readActivityOverridesRaw, saveScheduleOverride, upsertScheduleChange } from '@/lib/activity-overrides'
import { cancelChangeId, clockTime, defaultSpots, expandDays, scheduleContextOf, shortDay, sortTimes, usualSpotsOn } from '@/lib/activity-schedule'
import { useActivityOverrides } from '@/hooks/use-pricing-override'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { useLocations } from '@/hooks/use-locations'
import type { CurrencyCode, ScheduleChange } from '@/types'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { EVENT_SOLID, eventVar } from '@/components/dashboard/calendar/departure-chip'

/* ==========================================================================
   SCHEMA
   ========================================================================== */

const TODAY_KEY = toDateKey(NOW)
const NOW_TIME = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`
/** The most days one entry adds. */
const MAX_DAYS = 366

/** The start time a new form offers: 09:00, or on today the next full hour still ahead. */
function firstTimeFor(dateKey: string): string {
  if (dateKey !== TODAY_KEY) return '09:00'
  const hour = Math.min(23, NOW.getHours() + 1)
  return `${String(hour).padStart(2, '0')}:00`
}

/** Today only keeps the start times still ahead; every other day keeps them all. */
const timesOnDay = (dateKey: string, times: string[]) => (dateKey === TODAY_KEY ? times.filter((time) => time > NOW_TIME) : times)

const schema = z
  .object({
    activityId: z.string().min(1, 'Choose an activity'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
    times: z.array(z.string()).min(1, 'Add at least one start time'),
    spots: z.number().int('Use a whole number').min(1, 'At least one spot').max(500, 'That looks too high'),
    repeat: z.boolean(),
    weekdays: z.array(z.number()),
    until: z.string(),
  })
  .refine((value) => value.date >= TODAY_KEY, { message: 'Pick today or later', path: ['date'] })
  .refine((value) => value.date !== TODAY_KEY || value.repeat || value.times.some((time) => time > NOW_TIME), {
    message: 'These start times have passed today',
    path: ['times'],
  })
  .refine((value) => !value.repeat || value.weekdays.length > 0, {
    message: 'Pick at least one day',
    path: ['weekdays'],
  })
  .refine((value) => !value.repeat || (value.until.length > 0 && value.until > value.date), {
    message: 'Pick a date after the first day',
    path: ['until'],
  })

const WEEKDAY_OPTIONS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

/** The days a time slot lands on: the day itself, or each chosen weekday up to `until`. */
function datesFor(date: string, repeat: boolean, until: string, weekdays: number[]): string[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return []
  if (!repeat) return [date]
  if (!until || until <= date || weekdays.length === 0) return []
  const set = new Set(weekdays)
  const end = fromDateKey(until)
  const out: string[] = []
  for (let cursor = fromDateKey(date); cursor <= end && out.length <= MAX_DAYS; cursor = addDays(cursor, 1)) {
    if (set.has(cursor.getDay())) out.push(toDateKey(cursor))
  }
  return out
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export interface NewDepartureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  /** Kept for callers; prices aren't set here (they come from the activity). */
  currency?: CurrencyCode
  /** Prefilled from the calendar cell or grid slot that was clicked. */
  initialDate?: Date | null
  initialTime?: string | null
  initialActivityId?: string | null
  initialLocationId?: string | null
}

interface FormErrors {
  [key: string]: string | undefined
}

export function NewDepartureDialog({
  open,
  onOpenChange,
  tenantId,
  initialDate,
  initialTime,
  initialActivityId,
  initialLocationId,
}: NewDepartureDialogProps) {
  const router = useRouter()

  // Packages have no times of their own: they book onto their activities' times.
  const seeded = React.useMemo(
    () => getActivitiesByTenant(tenantId).filter((activity) => activity.status !== 'archived' && activity.kind !== 'package'),
    [tenantId],
  )
  const overrides = useActivityOverrides()
  const activities = React.useMemo(
    () => seeded.map((activity) => applyActivityOverride(activity, overrides[activity.id])).sort((a, b) => a.name.localeCompare(b.name)),
    [seeded, overrides],
  )
  const activitiesRef = React.useRef(activities)
  activitiesRef.current = activities

  const seededSites = React.useMemo(() => getLocationsByTenant(tenantId), [tenantId])
  const { locations: sites } = useLocations(tenantId, seededSites)
  const { defaults } = useBookingDefaults(tenantById.get(tenantId)?.slug ?? '')

  const [activityId, setActivityId] = React.useState(initialActivityId ?? '')
  const [locationId, setLocationId] = React.useState(initialLocationId ?? '')
  const [date, setDate] = React.useState(toDateKey(initialDate ?? NOW))
  const [times, setTimes] = React.useState<string[]>(initialTime ? [initialTime] : ['09:00'])
  const [timeDraft, setTimeDraft] = React.useState('')
  const [spots, setSpots] = React.useState('')
  const [repeat, setRepeat] = React.useState(false)
  const [weekdays, setWeekdays] = React.useState<number[]>([])
  const [until, setUntil] = React.useState(toDateKey(addDays(initialDate ?? NOW, 28)))
  const [errors, setErrors] = React.useState<FormErrors>({})

  const activity = activities.find((item) => item.id === activityId)
  const isCharter = activity?.kind === 'charter'
  const baseSpots = activity ? defaultSpots(activity) : 0
  // The day's own usual spots (its weekday's, when set), filled in for it.
  const dayUsual = activity ? usualSpotsOn(activity, date) : 0
  // Every time slot sells at least one spot: never filled in as 0.
  const spotsText = (value: number) => (value >= 1 ? String(value) : '')
  // The same words as the Schedule step: rentals count items, passes count tickets.
  const spotWord = activity?.kind === 'rental' ? 'item' : activity?.kind === 'pass' ? 'ticket' : 'spot'
  const spotsLabel = activity?.kind === 'rental' ? 'Items' : activity?.kind === 'pass' ? 'Tickets' : 'Spots'
  const activitySites = (activity?.locations ?? []).map((site) => site.locationId).filter(Boolean)
  const multiSite = activitySites.length > 1
  const siteName = (id: string) => sites.find((site) => site.id === id)?.name ?? 'Location'

  // Reset to the caller's prefill every time the dialog is opened.
  React.useEffect(() => {
    if (!open) return
    const list = activitiesRef.current
    const seedDate = initialDate ?? NOW
    const seed = list.find((item) => item.id === initialActivityId) ?? list[0]
    const seedSites = (seed?.locations ?? []).map((site) => site.locationId).filter(Boolean)
    setActivityId(seed?.id ?? '')
    setLocationId(initialLocationId && seedSites.includes(initialLocationId) ? initialLocationId : (seedSites[0] ?? ''))
    setDate(toDateKey(seedDate))
    setTimes([initialTime ?? firstTimeFor(toDateKey(seedDate))])
    setTimeDraft('')
    setSpots(seed ? spotsText(usualSpotsOn(seed, toDateKey(seedDate))) : '')
    setRepeat(false)
    setWeekdays([seedDate.getDay()])
    setUntil(toDateKey(addDays(seedDate, 28)))
    setErrors({})
  }, [open, initialDate, initialTime, initialActivityId, initialLocationId])

  const handleActivityChange = (next: string) => {
    setActivityId(next)
    const picked = activities.find((item) => item.id === next)
    if (picked) {
      setSpots(spotsText(usualSpotsOn(picked, date)))
      setLocationId(picked.locations.map((site) => site.locationId).filter(Boolean)[0] ?? '')
    }
    setErrors((current) => ({ ...current, activityId: undefined, spots: undefined }))
  }

  const addTime = () => {
    const value = timeDraft.trim()
    if (!/^\d{2}:\d{2}$/.test(value)) return
    setTimes((current) => sortTimes([...current, value]))
    setTimeDraft('')
    setErrors((current) => ({ ...current, times: undefined }))
  }

  const picked = React.useMemo(() => datesFor(date, repeat, until, weekdays), [date, repeat, until, weekdays])
  // A start time typed but not added with "Add time" still counts.
  const draftTime = /^\d{2}:\d{2}$/.test(timeDraft) ? timeDraft : ''
  const allTimes = React.useMemo(() => [...new Set(sortTimes(draftTime ? [...times, draftTime] : times))], [times, draftTime])

  // What the schedule already runs on those days, so a time it has isn't added (or counted) twice,
  // and the days that are closed (a closed day, a business closed day, a public holiday).
  const { existing, closedDays } = React.useMemo(() => {
    const set = new Set<string>()
    const shut = new Set<string>()
    if (!activity || picked.length === 0) return { existing: set, closedDays: shut }
    try {
      const ctx = { ...scheduleContextOf(defaults), ...(multiSite && locationId ? { locationId } : {}) }
      for (const day of expandDays(activity, picked[0], picked[picked.length - 1], ctx)) {
        if (day.closed) shut.add(day.dateKey)
        for (const slot of day.slots) set.add(`${slot.dateKey}|${slot.time}`)
      }
    } catch {
      /* a broken saved edit: every time counts as new */
    }
    return { existing: set, closedDays: shut }
  }, [activity, picked, defaults, multiSite, locationId])
  // A repeat skips closed days; one day picked on its own opens it.
  const dates = React.useMemo(() => (repeat ? picked.filter((day) => !closedDays.has(day)) : picked), [repeat, picked, closedDays])
  const skipped = picked.length - dates.length
  // Every chosen start time on today has passed already (today is the only day picked).
  const allPassed = dates.length === 1 && dates[0] === TODAY_KEY && allTimes.length > 0 && timesOnDay(TODAY_KEY, allTimes).length === 0
  const total = dates.reduce((sum, day) => sum + timesOnDay(day, allTimes).filter((time) => !existing.has(`${day}|${time}`)).length, 0)
  const already = dates.reduce((sum, day) => sum + timesOnDay(day, allTimes).filter((time) => existing.has(`${day}|${time}`)).length, 0)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const parsedSpots = isCharter ? 1 : Number(spots)
    const result = schema.safeParse({
      activityId,
      date,
      times: draftTime ? [...times, draftTime] : times,
      spots: Number.isFinite(parsedSpots) && spots.trim() !== '' ? parsedSpots : isCharter ? 1 : -1,
      repeat,
      weekdays,
      until,
    })

    const next: FormErrors = {}
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        if (!next[key]) next[key] = issue.message
      }
    }
    if (activity?.kind === 'rental' && parsedSpots > baseSpots) next.spots = `You have ${baseSpots} to rent`
    if (result.success && picked.length > MAX_DAYS) next.until = 'Up to a year at a time'
    if (result.success && repeat && picked.length === 0) next.weekdays = 'None of these days fall in that range'
    else if (result.success && repeat && dates.length === 0) next.weekdays = 'These days are all closed'
    if (result.success && dates.length > 0 && allTimes.length > 0 && total === 0) {
      next.times = allPassed ? 'These start times have passed today' : dates.length === 1 ? 'Already on the schedule that day' : 'Already on the schedule on these days'
    }
    if (!activity) next.activityId = next.activityId ?? 'Choose an activity'
    if (Object.keys(next).length > 0 || !activity) {
      setErrors(next)
      return
    }

    const seededActivity = seeded.find((item) => item.id === activity.id) ?? activity
    // A time cancelled from its sheet and now added back: the cancel goes, so it runs and can be cancelled again.
    const siteId = multiSite ? locationId || undefined : activity.locations[0]?.locationId
    const lifted = new Set<string>()
    for (const day of dates) {
      for (const time of timesOnDay(day, allTimes)) {
        if (existing.has(`${day}|${time}`)) continue
        lifted.add(cancelChangeId(day, time, siteId))
        lifted.add(cancelChangeId(day, time))
      }
    }
    const saved = parseActivityOverrides(readActivityOverridesRaw())[seededActivity.id]?.scheduleChanges ?? seededActivity.scheduleChanges ?? []
    const isLifted = (change: ScheduleChange) => change.action === 'closed' && lifted.has(change.id)
    if (saved.some(isLifted)) saveScheduleOverride(seededActivity, { scheduleChanges: saved.filter((change) => !isLifted(change)) })

    const base = `add_${Date.now().toString(36)}`
    const shared = {
      action: 'add' as const,
      // Spots only when they differ from the day's usual ones, so a later change to its spots (or a weekday's) still applies.
      ...(isCharter || parsedSpots === dayUsual ? {} : { spots: parsedSpots }),
      ...(multiSite && locationId ? { locationId } : {}),
    }
    // Today gets only the start times still ahead, so a repeat that starts today never adds a past time slot.
    const todayTimes = dates.includes(TODAY_KEY) ? timesOnDay(TODAY_KEY, allTimes) : allTimes
    const changes: ScheduleChange[] =
      todayTimes.length === allTimes.length
        ? [{ id: base, dates, times: allTimes, ...shared }]
        : [
            ...(todayTimes.length > 0 ? [{ id: `${base}_t`, dates: [TODAY_KEY], times: todayTimes, ...shared }] : []),
            ...(dates.length > 1 ? [{ id: base, dates: dates.filter((day) => day !== TODAY_KEY), times: allTimes, ...shared }] : []),
          ]
    for (const change of changes) upsertScheduleChange(seededActivity, change)

    setErrors({})
    setTimeDraft('')
    onOpenChange(false)
    toast.success(total === 1 ? 'Time slot added' : `${total} time slots added`, {
      description: [
        activity.name,
        sortTimes([...new Set(changes.flatMap((change) => change.times ?? []))]).map(clockTime).join(', '),
        dates.length === 1 ? formatDateLong(fromDateKey(dates[0])) : `${dates.length} days to ${shortDay(dates[dates.length - 1])}`,
      ]
        .filter(Boolean)
        .join(' · '),
      action: { label: 'Open activity', onClick: () => router.push(`/dashboard/activities/${activity.id}`) },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[min(46rem,calc(100dvh-2rem))]">
        <DialogHeader divider>
          <DialogTitle>Add a time slot</DialogTitle>
          <DialogDescription>Added to the activity’s schedule and on sale straight away.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="flex flex-col gap-5 py-5">
            {/* Activity */}
            <Field label="Activity" error={errors.activityId} required>
              {(control) => (
                <Select value={activityId} onValueChange={handleActivityChange}>
                  <SelectTrigger
                    id={control.id}
                    aria-describedby={control['aria-describedby']}
                    error={Boolean(errors.activityId)}
                    className="w-full"
                  >
                    <SelectValue placeholder="Choose an activity" />
                  </SelectTrigger>
                  <SelectContent>
                    {activities.map((item) => (
                      <SelectItem
                        key={item.id}
                        value={item.id}
                        description={item.durationMinutes > 0 ? formatDuration(item.durationMinutes) : undefined}
                        icon={<span aria-hidden="true" className={cn('size-2.5 rounded-full', eventVar(item.colorKey), EVENT_SOLID)} />}
                      >
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            {multiSite ? (
              <Field label="Location" required>
                {(control) => (
                  <Select value={locationId} onValueChange={setLocationId}>
                    <SelectTrigger id={control.id} aria-describedby={control['aria-describedby']} className="w-full">
                      <SelectValue placeholder="Choose a location" />
                    </SelectTrigger>
                    <SelectContent>
                      {activitySites.map((id) => (
                        <SelectItem key={id} value={id}>
                          {siteName(id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={repeat ? 'First day' : 'Date'} error={errors.date} required>
                <Input
                  type="date"
                  min={TODAY_KEY}
                  value={date}
                  onChange={(event) => {
                    const next = event.target.value
                    // Spots still at the old day's usual number follow the new day's.
                    if (activity && spots === spotsText(dayUsual)) setSpots(spotsText(usualSpotsOn(activity, next)))
                    setDate(next)
                    setErrors((current) => ({ ...current, date: undefined, times: undefined }))
                  }}
                />
              </Field>

              {!isCharter ? (
                <Field
                  label={spotsLabel}
                  error={errors.spots}
                  required
                  hint={activity && baseSpots >= 1 ? (activity.kind === 'rental' ? `${baseSpots} in stock` : `usually ${baseSpots}`) : undefined}
                >
                  <Input
                    type="number"
                    min={1}
                    max={activity?.kind === 'rental' ? baseSpots : 500}
                    inputMode="numeric"
                    value={spots}
                    suffix={pluralize(Number(spots) || 0, spotWord)}
                    onChange={(event) => {
                      setSpots(event.target.value)
                      setErrors((current) => ({ ...current, spots: undefined }))
                    }}
                  />
                </Field>
              ) : null}
            </div>

            {/* Start times */}
            <Field label="Start times" error={errors.times} required>
              {(control) => (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {times.map((time) => (
                      <span
                        key={time}
                        className="tabular inline-flex items-center gap-1 rounded-full border border-line bg-surface-sunken py-1 pr-1 pl-2.5 text-xs font-medium text-foreground"
                      >
                        <Clock aria-hidden="true" className="size-3 text-subtle" />
                        {clockTime(time)}
                        <button
                          type="button"
                          aria-label={`Remove ${clockTime(time)}`}
                          onClick={() => setTimes((current) => current.filter((value) => value !== time))}
                          className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                        >
                          <X aria-hidden="true" className="size-3" />
                        </button>
                      </span>
                    ))}
                    {times.length === 0 ? <span className="text-xs text-subtle">No times yet</span> : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      id={control.id}
                      type="time"
                      size="sm"
                      value={timeDraft}
                      onChange={(event) => setTimeDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          addTime()
                        }
                      }}
                      className="w-36"
                      aria-label="New start time"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      leftIcon={<Plus aria-hidden="true" />}
                      onClick={addTime}
                      disabled={!/^\d{2}:\d{2}$/.test(timeDraft)}
                    >
                      Add time
                    </Button>
                  </div>
                </div>
              )}
            </Field>

            {/* Repeat */}
            <div className="rounded-xl border border-line bg-surface-sunken/40 p-3.5">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-surface text-subtle shadow-xs">
                    <Repeat aria-hidden="true" className="size-4" />
                  </span>
                  <span className="text-[0.8125rem] font-semibold text-foreground">Repeat</span>
                </span>
                <Switch checked={repeat} onCheckedChange={setRepeat} />
              </label>

              {repeat ? (
                <div className="mt-4 flex flex-col gap-4 border-t border-line-subtle pt-4">
                  <Field label="On" error={errors.weekdays} required>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAY_OPTIONS.map((day) => {
                        const active = weekdays.includes(day.value)
                        return (
                          <button
                            key={day.value}
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                              setWeekdays((current) =>
                                current.includes(day.value) ? current.filter((value) => value !== day.value) : [...current, day.value],
                              )
                              setErrors((current) => ({ ...current, weekdays: undefined }))
                            }}
                            className={cn(
                              'h-8 min-w-11 rounded-lg border px-2 text-xs font-semibold',
                              'transition-colors duration-150',
                              active
                                ? 'border-primary bg-primary text-on-primary'
                                : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
                            )}
                          >
                            {day.label}
                          </button>
                        )
                      })}
                    </div>
                  </Field>

                  <Field label="Until" error={errors.until} required className="sm:max-w-xs">
                    <Input
                      type="date"
                      min={date || TODAY_KEY}
                      value={until}
                      onChange={(event) => {
                        setUntil(event.target.value)
                        setErrors((current) => ({ ...current, until: undefined }))
                      }}
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter divider className="items-center">
            <p className="tabular mr-auto hidden text-xs text-subtle sm:block">
              {total > 0 ? (
                <>
                  <span className="font-semibold text-foreground">{total}</span> new {pluralize(total, 'time slot')}
                  {repeat ? ` on ${dates.length} ${pluralize(dates.length, 'day')}` : ''}
                  {already > 0 ? ` · ${already} already on the schedule` : ''}
                  {skipped > 0 ? ` · ${skipped} closed ${pluralize(skipped, 'day')} skipped` : ''}
                </>
              ) : allPassed ? (
                'These start times have passed today'
              ) : repeat && picked.length > 0 && dates.length === 0 ? (
                'These days are all closed'
              ) : allTimes.length > 0 && dates.length > 0 ? (
                'Already on the schedule'
              ) : (
                'Nothing to add yet'
              )}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" leftIcon={<CalendarPlus aria-hidden="true" />}>
              {total > 1 ? `Add ${total} time slots` : 'Add time slot'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
