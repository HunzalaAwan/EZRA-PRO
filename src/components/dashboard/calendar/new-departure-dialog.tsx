'use client'

/**
 * NewDepartureDialog — schedule one departure, a set of times, or a repeating
 * pattern. Validation is zod-first so the same rules could move server-side
 * untouched; the UI only renders what zod reports.
 */

import * as React from 'react'
import { z } from 'zod'
import { CalendarPlus, Clock, Plus, Repeat, X } from 'lucide-react'

import {
  cn,
  addDays,
  currencySymbol,
  formatCurrency,
  formatDuration,
  fromDateKey,
  toDateKey,
} from '@/lib/utils'
import { NOW, getActivitiesByTenant, getUsersByTenant } from '@/lib/demo-core'
import type { CurrencyCode } from '@/types'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { Avatar } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
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

const schema = z
  .object({
    activityId: z.string().min(1, 'Choose an activity'),
    date: z.string().min(1, 'Pick a date'),
    times: z.array(z.string()).min(1, 'Add at least one start time'),
    capacity: z
      .number()
      .min(1, 'Capacity must be at least one seat')
      .max(500, 'Capacity looks too high — check the vessel'),
    staffIds: z.array(z.string()).min(1, 'Assign at least one crew member'),
    priceOverride: z.number().min(0, 'Price cannot be negative').nullable(),
    repeat: z.boolean(),
    weekdays: z.array(z.number()),
    until: z.string(),
  })
  .refine((value) => !value.repeat || value.weekdays.length > 0, {
    message: 'Pick at least one weekday to repeat on',
    path: ['weekdays'],
  })
  .refine((value) => !value.repeat || (value.until.length > 0 && value.until > value.date), {
    message: 'The repeat end date must be after the first departure',
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

function countOccurrences(date: string, until: string, weekdays: number[]) {
  if (!date || !until || weekdays.length === 0 || until <= date) return 0
  const start = fromDateKey(date)
  const end = fromDateKey(until)
  const set = new Set(weekdays)
  let count = 0
  for (let cursor = start; cursor <= end && count < 400; cursor = addDays(cursor, 1)) {
    if (set.has(cursor.getDay())) count += 1
  }
  return count
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export interface NewDepartureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  currency: CurrencyCode
  /** Prefilled from the calendar cell or grid slot that was clicked. */
  initialDate?: Date | null
  initialTime?: string | null
  initialActivityId?: string | null
}

interface FormErrors {
  [key: string]: string | undefined
}

export function NewDepartureDialog({
  open,
  onOpenChange,
  tenantId,
  currency,
  initialDate,
  initialTime,
  initialActivityId,
}: NewDepartureDialogProps) {
  const activities = React.useMemo(
    () =>
      getActivitiesByTenant(tenantId)
        .filter((activity) => activity.status !== 'archived')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [tenantId],
  )

  const crew = React.useMemo(
    () => getUsersByTenant(tenantId).filter((user) => user.isBookable),
    [tenantId],
  )

  const [activityId, setActivityId] = React.useState(initialActivityId ?? activities[0]?.id ?? '')
  const [date, setDate] = React.useState(toDateKey(initialDate ?? NOW))
  const [times, setTimes] = React.useState<string[]>(initialTime ? [initialTime] : ['09:00'])
  const [timeDraft, setTimeDraft] = React.useState('')
  const [capacity, setCapacity] = React.useState('')
  const [staffIds, setStaffIds] = React.useState<string[]>([])
  const [price, setPrice] = React.useState('')
  const [repeat, setRepeat] = React.useState(false)
  const [weekdays, setWeekdays] = React.useState<number[]>([])
  const [until, setUntil] = React.useState(toDateKey(addDays(initialDate ?? NOW, 28)))
  const [errors, setErrors] = React.useState<FormErrors>({})
  const [submitting, setSubmitting] = React.useState(false)
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const activity = activities.find((item) => item.id === activityId)

  // Reset to the caller's prefill every time the dialog is opened.
  React.useEffect(() => {
    if (!open) return
    const seedDate = initialDate ?? NOW
    const seedActivity = initialActivityId ?? activities[0]?.id ?? ''
    const seed = activities.find((item) => item.id === seedActivity)
    setActivityId(seedActivity)
    setDate(toDateKey(seedDate))
    setTimes(initialTime ? [initialTime] : ['09:00'])
    setTimeDraft('')
    setCapacity(seed ? String(seed.maxCapacity) : '')
    setStaffIds([])
    setPrice('')
    setRepeat(false)
    setWeekdays([seedDate.getDay()])
    setUntil(toDateKey(addDays(seedDate, 28)))
    setErrors({})
    setSubmitting(false)
  }, [open, initialDate, initialTime, initialActivityId, activities])

  React.useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const handleActivityChange = (next: string) => {
    setActivityId(next)
    const picked = activities.find((item) => item.id === next)
    if (picked) setCapacity(String(picked.maxCapacity))
    setErrors((current) => ({ ...current, activityId: undefined, capacity: undefined }))
  }

  const addTime = () => {
    const value = timeDraft.trim()
    if (!/^\d{2}:\d{2}$/.test(value)) return
    setTimes((current) => (current.includes(value) ? current : [...current, value].sort()))
    setTimeDraft('')
    setErrors((current) => ({ ...current, times: undefined }))
  }

  const occurrences = repeat ? countOccurrences(date, until, weekdays) : 1
  const totalDepartures = times.length * Math.max(occurrences, 0)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    const parsedCapacity = Number.parseInt(capacity, 10)
    const parsedPrice = price.trim() === '' ? null : Number.parseFloat(price)

    const result = schema.safeParse({
      activityId,
      date,
      times,
      capacity: Number.isNaN(parsedCapacity) ? -1 : parsedCapacity,
      staffIds,
      priceOverride: parsedPrice !== null && Number.isNaN(parsedPrice) ? -1 : parsedPrice,
      repeat,
      weekdays,
      until,
    })

    if (!result.success) {
      const next: FormErrors = {}
      for (const issue of result.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        if (!next[key]) next[key] = issue.message
      }
      setErrors(next)
      return
    }

    setErrors({})
    setSubmitting(true)
    timer.current = setTimeout(() => {
      setSubmitting(false)
      onOpenChange(false)
      toast.success(
        totalDepartures === 1 ? 'Availability added' : `${totalDepartures} slots added`,
        {
          description: `${activity?.name ?? 'Activity'} · ${times.join(', ')} · ${
            repeat ? `repeating until ${until}` : date
          }`,
        },
      )
    }, 420)
  }

  const symbol = currencySymbol(currency)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" className="max-h-[min(46rem,calc(100dvh-2rem))]">
        <DialogHeader divider>
          <DialogTitle>Add availability</DialogTitle>
          <DialogDescription>
            One time slot or a repeating pattern, for a departure, a sitting, a class or an event.
            Capacity, crew and pricing can differ from the activity defaults.
          </DialogDescription>
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
                        description={`${formatDuration(item.durationMinutes)} · up to ${item.maxCapacity} guests · ${formatCurrency(item.basePrice, currency)}`}
                        icon={
                          <span
                            aria-hidden="true"
                            className={cn(
                              'size-2.5 rounded-full',
                              eventVar(item.colorKey),
                              EVENT_SOLID,
                            )}
                          />
                        }
                      >
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Date" error={errors.date} required>
                <Input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </Field>

              <Field
                label="Capacity"
                error={errors.capacity}
                required
                hint={activity ? `default ${activity.maxCapacity}` : undefined}
              >
                <Input
                  type="number"
                  min={1}
                  max={500}
                  inputMode="numeric"
                  value={capacity}
                  suffix="seats"
                  onChange={(event) => setCapacity(event.target.value)}
                />
              </Field>
            </div>

            {/* Start times */}
            <Field
              label="Start times"
              error={errors.times}
              required
              description="Each time creates its own slot on the selected date."
            >
              {(control) => (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {times.map((time) => (
                      <span
                        key={time}
                        className="tabular inline-flex items-center gap-1 rounded-full border border-line bg-surface-sunken py-1 pr-1 pl-2.5 text-[0.75rem] font-medium text-foreground"
                      >
                        <Clock aria-hidden="true" className="size-3 text-subtle" />
                        {time}
                        <button
                          type="button"
                          aria-label={`Remove ${time}`}
                          onClick={() => setTimes((current) => current.filter((v) => v !== time))}
                          className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full text-faint transition-colors hover:bg-danger-soft hover:text-danger"
                        >
                          <X aria-hidden="true" className="size-3" />
                        </button>
                      </span>
                    ))}
                    {times.length === 0 ? (
                      <span className="text-[0.75rem] text-subtle">No times yet.</span>
                    ) : null}
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

            <Separator />

            {/* Crew */}
            <Field
              label="Crew"
              error={errors.staffIds}
              required
              description="Assigned crew appear on the manifest and the day rail."
            >
              <div className="grid gap-1.5 sm:grid-cols-2">
                {crew.map((user) => {
                  const checked = staffIds.includes(user.id)
                  return (
                    <label
                      key={user.id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2',
                        'transition-colors duration-150',
                        checked
                          ? 'border-primary/45 bg-primary-soft/50'
                          : 'border-line hover:bg-surface-sunken',
                      )}
                    >
                      <Checkbox
                        size="sm"
                        checked={checked}
                        onCheckedChange={(value) => {
                          setStaffIds((current) =>
                            value === true
                              ? [...current, user.id]
                              : current.filter((id) => id !== user.id),
                          )
                          setErrors((current) => ({ ...current, staffIds: undefined }))
                        }}
                      />
                      <Avatar name={user.name} src={user.avatarUrl} size="xs" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] font-medium text-foreground">
                          {user.name}
                        </span>
                        <span className="block truncate text-[0.6875rem] text-subtle">
                          {user.title}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </Field>

            {/* Price override */}
            <Field
              label="Price override"
              optional
              error={errors.priceOverride}
              description={
                activity
                  ? `Leave blank to use the activity base price of ${formatCurrency(activity.basePrice, currency)}.`
                  : 'Leave blank to use the activity base price.'
              }
            >
              <Input
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder={activity ? String(Math.round(activity.basePrice / 100)) : '0'}
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                leftIcon={<span className="text-xs font-semibold">{symbol}</span>}
                suffix="per guest"
                className="sm:max-w-xs"
              />
            </Field>

            <Separator />

            {/* Repeat */}
            <div className="rounded-xl border border-line bg-surface-sunken/40 p-3.5">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-surface text-subtle shadow-xs">
                    <Repeat aria-hidden="true" className="size-4" />
                  </span>
                  <span>
                    <span className="block text-[0.8125rem] font-semibold text-foreground">
                      Repeat this schedule
                    </span>
                    <span className="block text-[0.6875rem] text-subtle">
                      Generate the same times across a weekly pattern
                    </span>
                  </span>
                </span>
                <Switch checked={repeat} onCheckedChange={setRepeat} />
              </label>

              {repeat ? (
                <div className="mt-4 flex flex-col gap-4 border-t border-line-subtle pt-4">
                  <Field label="Repeat on" error={errors.weekdays} required>
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
                                current.includes(day.value)
                                  ? current.filter((v) => v !== day.value)
                                  : [...current, day.value],
                              )
                              setErrors((current) => ({ ...current, weekdays: undefined }))
                            }}
                            className={cn(
                              'h-8 min-w-11 rounded-lg border px-2 text-[0.75rem] font-semibold',
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
                      value={until}
                      onChange={(event) => setUntil(event.target.value)}
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          </DialogBody>

          <DialogFooter divider className="items-center">
            <p className="tabular mr-auto hidden text-[0.75rem] text-subtle sm:block">
              {totalDepartures > 0 ? (
                <>
                  <span className="font-semibold text-foreground">{totalDepartures}</span> slot
                  {totalDepartures === 1 ? '' : 's'} will be created
                  {repeat ? ` across ${occurrences} day${occurrences === 1 ? '' : 's'}` : ''}
                </>
              ) : (
                'Nothing to schedule yet'
              )}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={submitting}
              leftIcon={<CalendarPlus aria-hidden="true" />}
            >
              {totalDepartures > 1 ? `Add ${totalDepartures} slots` : 'Add availability'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
