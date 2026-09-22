'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  CalendarOff,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Sun,
  Trash2,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { NOW } from '@/lib/demo-core'
import type { ObservedHours } from '@/components/dashboard/availability/derive'
import {
  addDays,
  buildMonthGrid,
  cn,
  formatDateLong,
  fromDateKey,
  isSameDay,
  startOfMonth,
  toDateKey,
} from '@/lib/utils'

/* ==========================================================================
   WEEKLY HOURS — seeded from the earliest and latest departure actually run
   on each weekday over the trailing 90 days.
   ========================================================================== */

const WEEKDAYS = [
  { index: 1, short: 'Mon', long: 'Monday' },
  { index: 2, short: 'Tue', long: 'Tuesday' },
  { index: 3, short: 'Wed', long: 'Wednesday' },
  { index: 4, short: 'Thu', long: 'Thursday' },
  { index: 5, short: 'Fri', long: 'Friday' },
  { index: 6, short: 'Sat', long: 'Saturday' },
  { index: 0, short: 'Sun', long: 'Sunday' },
] as const

export interface TimeRange {
  id: string
  open: string
  close: string
}

export interface DayHours {
  weekday: number
  enabled: boolean
  ranges: TimeRange[]
}

function minutesToHhmm(total: number) {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Seeds the weekly hours from what the calendar actually ran over the last 90 days. */
function initialHoursFor(observedHours: ObservedHours): DayHours[] {
  return WEEKDAYS.map(({ index }) => {
  const observed = observedHours[index]
  const first = observed ? Math.max(0, Math.floor(observed.first / 30) * 30) : 7 * 60
  const last = observed ? Math.min(1439, Math.ceil(observed.last / 30) * 30) : 19 * 60
  // Midday break on the quietest day gives the crew a genuine service window.
  const split = index === 2
  return {
    weekday: index,
    enabled: true,
    ranges: split
      ? [
          { id: `${index}-a`, open: minutesToHhmm(first), close: '12:30' },
          { id: `${index}-b`, open: '15:00', close: minutesToHhmm(last) },
        ]
      : [{ id: `${index}-a`, open: minutesToHhmm(first), close: minutesToHhmm(last) }],
  }
  })
}

/* ==========================================================================
   BLACKOUTS & SEASONS
   ========================================================================== */

export interface Blackout {
  dateKey: string
  reason: string
}

const INITIAL_BLACKOUTS: Blackout[] = [
  { dateKey: toDateKey(addDays(NOW, 12)), reason: 'Annual hull inspection — Alii Nui out of water' },
  { dateKey: toDateKey(addDays(NOW, 13)), reason: 'Annual hull inspection — Alii Nui out of water' },
  { dateKey: toDateKey(addDays(NOW, 27)), reason: 'Crew training day — no public departures' },
  { dateKey: toDateKey(addDays(NOW, 46)), reason: 'Private charter buyout, Maui Ocean Center' },
]

interface Season {
  id: string
  name: string
  start: Date
  end: Date
  note: string
  multiplier: string
}

const SEASONS: Season[] = [
  {
    id: 'peak',
    name: 'Peak summer',
    start: new Date(2026, 5, 1),
    end: new Date(2026, 8, 15),
    note: 'Full timetable, two extra sunset sails a week.',
    multiplier: '+18% on evening departures',
  },
  {
    id: 'shoulder',
    name: 'Autumn shoulder',
    start: new Date(2026, 8, 16),
    end: new Date(2026, 10, 30),
    note: 'Dawn patrol drops to four mornings a week.',
    multiplier: 'Standard pricing',
  },
  {
    id: 'whale',
    name: 'Whale season',
    start: new Date(2026, 11, 1),
    end: new Date(2027, 3, 15),
    note: 'Whale watch eco cruise returns; snorkel moves inshore.',
    multiplier: '+12% on morning departures',
  },
]

/* ==========================================================================
   EDITOR
   ========================================================================== */

export interface AvailabilityEditorProps {
  /** Observed first/last departure minutes per weekday, computed server-side. */
  observedHours: ObservedHours
}

export function AvailabilityEditor({ observedHours }: AvailabilityEditorProps) {
  const reduceMotion = useReducedMotionSafe()

  const [hours, setHours] = React.useState<DayHours[]>(() => initialHoursFor(observedHours))
  // Monotonic so a removed-then-added window never reuses a React key.
  const rangeSeq = React.useRef(0)
  const [blackouts, setBlackouts] = React.useState<Blackout[]>(INITIAL_BLACKOUTS)
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(NOW))
  const [draftReason, setDraftReason] = React.useState('Closed — maintenance')

  const blackoutMap = React.useMemo(() => {
    const map = new Map<string, Blackout>()
    for (const b of blackouts) map.set(b.dateKey, b)
    return map
  }, [blackouts])

  /* ---------- weekly hours ---------- */

  function toggleDay(weekday: number, enabled: boolean) {
    setHours((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, enabled } : d)))
  }

  function updateRange(weekday: number, rangeId: string, patch: Partial<TimeRange>) {
    setHours((prev) =>
      prev.map((d) =>
        d.weekday === weekday
          ? {
              ...d,
              ranges: d.ranges.map((r) => (r.id === rangeId ? { ...r, ...patch } : r)),
            }
          : d,
      ),
    )
  }

  function addRange(weekday: number) {
    setHours((prev) =>
      prev.map((d) =>
        d.weekday === weekday
          ? {
              ...d,
              enabled: true,
              ranges: [
                ...d.ranges,
                { id: `${weekday}-new-${++rangeSeq.current}`, open: '15:00', close: '18:00' },
              ],
            }
          : d,
      ),
    )
  }

  function removeRange(weekday: number, rangeId: string) {
    setHours((prev) =>
      prev.map((d) =>
        d.weekday === weekday
          ? { ...d, ranges: d.ranges.filter((r) => r.id !== rangeId) }
          : d,
      ),
    )
  }

  function copyMondayToAll() {
    const monday = hours.find((d) => d.weekday === 1)
    if (!monday) return
    setHours((prev) =>
      prev.map((d) => ({
        ...d,
        enabled: monday.enabled,
        ranges: monday.ranges.map((r, i) => ({ ...r, id: `${d.weekday}-copy-${i}` })),
      })),
    )
    toast.success('Monday copied to every day', {
      description: 'Adjust the weekend rows if they run longer.',
    })
  }

  /* ---------- blackouts ---------- */

  function toggleBlackout(day: Date) {
    const key = toDateKey(day)
    setBlackouts((prev) => {
      if (prev.some((b) => b.dateKey === key)) return prev.filter((b) => b.dateKey !== key)
      return [...prev, { dateKey: key, reason: draftReason }].sort((a, b) =>
        a.dateKey < b.dateKey ? -1 : 1,
      )
    })
  }

  function updateReason(dateKey: string, reason: string) {
    setBlackouts((prev) => prev.map((b) => (b.dateKey === dateKey ? { ...b, reason } : b)))
  }

  const grid = React.useMemo(() => buildMonthGrid(month), [month])
  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(month)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* ==================== WEEKLY HOURS ==================== */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-primary" aria-hidden="true" />
              Weekly operating hours
            </CardTitle>
            <CardDescription>
              Departures can only be generated inside these windows. Seeded from the last 90 days
              of trips you actually ran.
            </CardDescription>
          </div>
          <CardToolbar>
            <Button variant="ghost" size="sm" onClick={copyMondayToAll}>
              Copy Monday to all
            </Button>
          </CardToolbar>
        </CardHeader>

        <CardContent className="flex flex-col gap-2 pt-0">
          {WEEKDAYS.map(({ index, short, long }) => {
            const day = hours.find((d) => d.weekday === index)
            if (!day) return null
            const switchId = `operating-${index}`

            return (
              <div
                key={index}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-start',
                  'transition-colors duration-200',
                  day.enabled ? 'border-line bg-surface' : 'border-line-subtle bg-surface-sunken/60',
                )}
              >
                <div className="flex w-full items-center gap-3 sm:w-40 sm:shrink-0">
                  <Switch
                    id={switchId}
                    size="sm"
                    checked={day.enabled}
                    onCheckedChange={(v) => toggleDay(index, v)}
                  />
                  <Label htmlFor={switchId} className="cursor-pointer">
                    <span className="sm:hidden">{long}</span>
                    <span className="hidden sm:inline">{short}</span>
                  </Label>
                  {!day.enabled ? (
                    <Badge variant="neutral" size="sm" className="ml-auto sm:ml-0">
                      Closed
                    </Badge>
                  ) : null}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {day.enabled ? (
                      day.ranges.length === 0 ? (
                        <p className="text-xs text-subtle">
                          No windows yet — add one to open this day.
                        </p>
                      ) : (
                        day.ranges.map((range) => (
                          <motion.div
                            key={range.id}
                            layout={!reduceMotion}
                            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                            transition={{ duration: reduceMotion ? 0 : 0.2 }}
                            className="flex flex-wrap items-center gap-2"
                          >
                            <Input
                              size="sm"
                              type="time"
                              step={900}
                              value={range.open}
                              aria-label={`${long} opens`}
                              onChange={(e) =>
                                updateRange(index, range.id, { open: e.target.value })
                              }
                              className="w-32"
                            />
                            <span aria-hidden="true" className="text-xs text-faint">
                              to
                            </span>
                            <Input
                              size="sm"
                              type="time"
                              step={900}
                              value={range.close}
                              aria-label={`${long} closes`}
                              onChange={(e) =>
                                updateRange(index, range.id, { close: e.target.value })
                              }
                              className="w-32"
                            />
                            <IconButton
                              variant="ghost"
                              size="sm"
                              aria-label={`Remove this ${long} window`}
                              onClick={() => removeRange(index, range.id)}
                            >
                              <X />
                            </IconButton>
                          </motion.div>
                        ))
                      )
                    ) : null}
                  </AnimatePresence>
                </div>

                <Button
                  variant="ghost"
                  size="xs"
                  leftIcon={<Plus />}
                  onClick={() => addRange(index)}
                  className="self-start sm:shrink-0"
                >
                  Window
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* ==================== BLACKOUTS ==================== */}
      <Card>
        <CardHeader>
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <CalendarOff className="size-4 text-primary" aria-hidden="true" />
              Blackout dates
            </CardTitle>
            <CardDescription>
              Click a day to close it. Existing bookings are never touched — the date simply stops
              generating and selling new departures.
            </CardDescription>
          </div>
          <CardToolbar>
            <IconButton
              variant="outline"
              size="sm"
              aria-label="Previous month"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
            >
              <ChevronLeft />
            </IconButton>
            <span className="min-w-36 text-center text-sm font-medium text-foreground">
              {monthLabel}
            </span>
            <IconButton
              variant="outline"
              size="sm"
              aria-label="Next month"
              onClick={() => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
            >
              <ChevronRight />
            </IconButton>
          </CardToolbar>
        </CardHeader>

        <CardContent className="grid gap-5 pt-0 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          {/* Calendar */}
          <div>
            <div className="grid grid-cols-7 gap-1 pb-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <span
                  key={`${d}-${i}`}
                  className="text-center text-xs font-semibold text-faint"
                >
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((day) => {
                const key = toDateKey(day)
                const inMonth = day.getMonth() === month.getMonth()
                const isBlackout = blackoutMap.has(key)
                const isToday = isSameDay(day, NOW)
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleBlackout(day)}
                    aria-pressed={isBlackout}
                    aria-label={`${formatDateLong(day)}${isBlackout ? ' — blacked out' : ''}`}
                    className={cn(
                      'relative grid aspect-square place-items-center rounded-lg text-xs font-medium',
                      'transition-all duration-200 ease-[var(--ease-out-expo)]',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      inMonth ? 'text-foreground' : 'text-faint',
                      isBlackout
                        ? 'bg-danger-soft text-danger ring-1 ring-danger/40'
                        : 'hover:bg-surface-sunken',
                      isToday && !isBlackout && 'ring-1 ring-primary/50',
                    )}
                  >
                    {day.getDate()}
                    {isBlackout ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 rotate-[-24deg] bg-danger/60"
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>

            <div className="mt-3">
              <Label htmlFor="blackout-reason" size="sm">
                Reason applied to the next date you click
              </Label>
              <Input
                id="blackout-reason"
                size="sm"
                className="mt-1.5"
                value={draftReason}
                onChange={(e) => setDraftReason(e.target.value)}
              />
            </div>
          </div>

          {/* List */}
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-xs font-semibold tracking-[0.08em] text-subtle uppercase">
              {blackouts.length} closed {blackouts.length === 1 ? 'date' : 'dates'}
            </p>

            {blackouts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-subtle">
                Nothing is blacked out. Your calendar runs every day inside the hours above.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {blackouts.map((blackout) => (
                    <motion.li
                      key={blackout.dateKey}
                      layout={!reduceMotion}
                      initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
                      transition={{ duration: reduceMotion ? 0 : 0.2 }}
                      className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-10 shrink-0 place-items-center rounded-lg bg-danger-soft text-center text-danger"
                      >
                        <span className="text-sm leading-none font-bold">
                          {fromDateKey(blackout.dateKey).getDate()}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-foreground">
                          {formatDateLong(fromDateKey(blackout.dateKey))}
                        </p>
                        <Input
                          size="sm"
                          value={blackout.reason}
                          aria-label={`Reason for ${blackout.dateKey}`}
                          onChange={(e) => updateReason(blackout.dateKey, e.target.value)}
                          className="mt-1 border-transparent bg-transparent shadow-none"
                        />
                      </div>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove blackout on ${blackout.dateKey}`}
                        onClick={() => toggleBlackout(fromDateKey(blackout.dateKey))}
                      >
                        <Trash2 />
                      </IconButton>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ==================== SEASONS ==================== */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="size-4 text-primary" aria-hidden="true" />
            Seasonal schedules
          </CardTitle>
          <CardDescription>
            Each season swaps in its own timetable and pricing multipliers on the date it starts.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-3 pt-0 md:grid-cols-3">
          {SEASONS.map((season) => {
            const active = NOW >= season.start && NOW <= season.end
            const upcoming = NOW < season.start
            return (
              <div
                key={season.id}
                className={cn(
                  'flex flex-col gap-2 rounded-xl border p-4',
                  'transition-all duration-300 ease-[var(--ease-out-expo)]',
                  active
                    ? 'border-primary/45 bg-primary-soft/25 shadow-sm'
                    : 'border-line bg-surface hover:border-line-strong',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Sun className="size-3.5 text-warning" aria-hidden="true" />
                    {season.name}
                  </h4>
                  <Badge
                    variant={active ? 'primary' : upcoming ? 'info' : 'outline'}
                    size="sm"
                  >
                    {active ? 'Running' : upcoming ? 'Upcoming' : 'Past'}
                  </Badge>
                </div>

                <p className="text-xs text-muted tabular">
                  {formatDateLong(season.start)} — {formatDateLong(season.end)}
                </p>
                <p className="text-xs leading-relaxed text-muted">{season.note}</p>
                <Badge variant="outline" size="sm" className="w-fit">
                  {season.multiplier}
                </Badge>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
