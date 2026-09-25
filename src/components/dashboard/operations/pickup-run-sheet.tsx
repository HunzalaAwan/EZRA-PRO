'use client'

import * as React from 'react'
import { AlarmClock, Bus, CheckCircle2, MessageSquareText, Phone, Printer, UserRound, UserX } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import type { PickupRunSheet as Sheet, PickupStop } from '@/lib/operations'
import { cn, formatTime, pluralize } from '@/lib/utils'

/* ==========================================================================
   PICKUPS — the shuttle's day, and the days after it
   Pick a day. Stops are grouped by shuttle run (the trip they are going
   to), in collection order. Each run gets a driver, a one-tap text with
   everyone's pickup time and a running-late button. On the day, each party
   is ticked on board or marked a no-show. Prints clean for the driver.
   ========================================================================== */

type StopStatus = 'waiting' | 'onboard' | 'noshow'
type View = 'runs' | 'time'

const driversKey = (slug: string) => `ezra:pickup-drivers:${slug}`

function dayLabel(dayKey: string, index: number) {
  if (index === 0) return 'Today'
  if (index === 1) return 'Tomorrow'
  return new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(`${dayKey}T12:00:00`))
}

const shortDate = (dayKey: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${dayKey}T12:00:00`))
const later = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60_000)

export function PickupRunSheet({ sheets, drivers, tenantSlug }: { sheets: Sheet[]; drivers: string[]; tenantSlug: string }) {
  const [dayIndex, setDayIndex] = React.useState(0)
  const [view, setView] = React.useState<View>('runs')
  const [zone, setZone] = React.useState<string>('all')
  const [status, setStatus] = React.useState<Record<string, StopStatus>>({})
  const [delays, setDelays] = React.useState<Record<string, number>>({})
  const [assigned, setAssigned] = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    try {
      setAssigned(JSON.parse(window.localStorage.getItem(driversKey(tenantSlug)) ?? '{}'))
    } catch {
      /* storage blocked */
    }
  }, [tenantSlug])

  const assign = (departureId: string, driver: string) =>
    setAssigned((current) => {
      const next = { ...current, [departureId]: driver }
      try {
        window.localStorage.setItem(driversKey(tenantSlug), JSON.stringify(next))
      } catch {
        /* storage blocked */
      }
      return next
    })

  const sheet = sheets[dayIndex] ?? sheets[0]
  const today = dayIndex === 0
  const zoneName = (id: string) => sheet.zones.find((entry) => entry.id === id)?.name ?? 'Zone'
  const stops = sheet.stops.filter((stop) => zone === 'all' || stop.zoneId === zone)
  const stateOf = (stop: PickupStop): StopStatus => status[stop.bookingId] ?? 'waiting'

  /* ---------- runs: one per departure, in the order the first pickup happens ---------- */
  const runs = React.useMemo(() => {
    const map = new Map<string, PickupStop[]>()
    for (const stop of stops) map.set(stop.departureId, [...(map.get(stop.departureId) ?? []), stop])
    return [...map.entries()]
      .map(([departureId, list]) => ({ departureId, stops: list, activityName: list[0].activityName, departureAt: list[0].departureAt }))
      .sort((a, b) => a.stops[0].time.localeCompare(b.stops[0].time))
  }, [stops])

  const guests = stops.reduce((sum, stop) => sum + stop.party, 0)
  const aboard = stops.filter((stop) => stateOf(stop) === 'onboard').reduce((sum, stop) => sum + stop.party, 0)
  const noShows = stops.filter((stop) => stateOf(stop) === 'noshow').length
  const unassigned = runs.filter((run) => !assigned[run.departureId]).length
  const first = stops[0]

  const textRun = (runStops: PickupStop[], delay = 0) => {
    const waiting = runStops.filter((stop) => stateOf(stop) === 'waiting')
    toast.success(delay ? `Texted ${waiting.length} ${pluralize(waiting.length, 'party', 'parties')}: running ${delay} min late` : `Texted ${runStops.length} ${pluralize(runStops.length, 'party', 'parties')} their pickup time`, {
      description: waiting[0] ? `“Your pickup at ${waiting[0].stop} is ${formatTime(later(waiting[0].time, delay))}. Wait in the lobby.”` : undefined,
    })
  }

  const tiles = [
    { label: 'Pickups', value: String(stops.length), note: `${new Set(stops.map((stop) => stop.zoneId)).size} ${pluralize(new Set(stops.map((stop) => stop.zoneId)).size, 'zone')}` },
    { label: today ? 'Guests on board' : 'Guests to collect', value: today ? `${aboard} of ${guests}` : String(guests), note: today && noShows > 0 ? `${noShows} no-show` : `${stops.length} ${pluralize(stops.length, 'party', 'parties')}` },
    { label: 'First pickup', value: first ? formatTime(first.time) : '—', note: first ? first.stop : 'Nothing booked' },
    { label: 'Shuttle runs', value: String(runs.length), note: unassigned > 0 ? `${unassigned} without a driver` : runs.length > 0 ? 'All have a driver' : 'None' },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- days ---------- */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 print:hidden" role="tablist" aria-label="Day">
        {sheets.map((entry, index) => {
          const on = index === dayIndex
          const count = entry.stops.length
          const people = entry.stops.reduce((sum, stop) => sum + stop.party, 0)
          return (
            <button
              key={entry.dayKey}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => {
                setDayIndex(index)
                setZone('all')
              }}
              className={cn(
                'flex min-w-[7.5rem] shrink-0 flex-col items-start rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                on ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className="text-sm font-semibold">{dayLabel(entry.dayKey, index)}</span>
              <span className={cn('text-xs', on ? 'text-on-primary/80' : 'text-subtle')}>{shortDate(entry.dayKey)}</span>
              <span className={cn('mt-1 text-xs font-medium tabular-nums', on ? 'text-on-primary' : count > 0 ? 'text-muted' : 'text-faint')}>
                {count > 0 ? `${count} ${pluralize(count, 'pickup')} · ${people} guests` : 'No pickups'}
              </span>
            </button>
          )
        })}
      </div>

      {/* ---------- the day in numbers ---------- */}
      <div className="grid grid-cols-2 gap-3 print:hidden lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface px-4 py-3.5">
            <p className="text-xs font-medium text-muted">{tile.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{tile.value}</p>
            <p className={cn('truncate text-xs', tile.label === 'Shuttle runs' && unassigned > 0 ? 'font-medium text-warning' : 'text-subtle')}>{tile.note}</p>
          </div>
        ))}
      </div>

      {/* ---------- print header ---------- */}
      <p className="hidden text-lg font-semibold print:block">
        Pickups · {dayLabel(sheet.dayKey, dayIndex)} {shortDate(sheet.dayKey)} · {stops.length} stops · {guests} guests
      </p>

      {sheet.stops.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <Bus className="size-6 text-faint" aria-hidden="true" />
          <p className="text-sm font-semibold">No pickups {today ? 'today' : `on ${dayLabel(sheet.dayKey, dayIndex)} ${shortDate(sheet.dayKey)}`}</p>
          <p className="max-w-md text-sm text-muted">Guests who choose hotel pickup at checkout appear here in collection order, grouped by the trip they are going to.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                label="View"
                value={view}
                onValueChange={setView}
                options={[
                  { value: 'runs', label: 'By shuttle run' },
                  { value: 'time', label: 'All stops by time' },
                ]}
              />
              <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
                <Segmented
                  label="Zone"
                  value={zone}
                  onValueChange={setZone}
                  className="min-w-max"
                  options={[
                    { value: 'all', label: 'All zones', count: sheet.stops.length },
                    ...sheet.zones
                      .map((entry) => ({ value: entry.id, label: entry.name, count: sheet.stops.filter((stop) => stop.zoneId === entry.id).length }))
                      .filter((entry) => entry.count > 0),
                  ]}
                />
              </div>
            </div>
            <Button variant="secondary" leftIcon={<Printer />} onClick={() => window.print()}>
              Print run sheet
            </Button>
          </div>

          {view === 'runs' ? (
            <div className="flex flex-col gap-4">
              {runs.map((run) => {
                const delay = delays[run.departureId] ?? 0
                const people = run.stops.reduce((sum, stop) => sum + stop.party, 0)
                const inRun = run.stops.filter((stop) => stateOf(stop) === 'onboard').reduce((sum, stop) => sum + stop.party, 0)
                return (
                  <section key={run.departureId} className="overflow-hidden rounded-2xl border border-line bg-surface print:break-inside-avoid">
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-semibold">{run.activityName}</h3>
                        <p className="text-xs text-muted">
                          Departs {formatTime(run.departureAt)} · {run.stops.length} {pluralize(run.stops.length, 'stop')} · {people} guests · first pickup {formatTime(later(run.stops[0].time, delay))}
                          {delay ? <span className="font-medium text-warning"> · running {delay} min late</span> : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 print:hidden">
                        <Select value={assigned[run.departureId] ?? ''} onValueChange={(value) => assign(run.departureId, value)}>
                          <SelectTrigger size="sm" className={cn('w-44', !assigned[run.departureId] && 'border-warning/60')} aria-label="Driver" icon={<UserRound />}>
                            <SelectValue placeholder="Assign a driver" />
                          </SelectTrigger>
                          <SelectContent>
                            {(drivers.length > 0 ? drivers : ['Driver']).map((name) => (
                              <SelectItem key={name} value={name}>
                                {name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="secondary" size="sm" leftIcon={<MessageSquareText />} onClick={() => textRun(run.stops, delay)}>
                          Text pickup times
                        </Button>
                        {today ? (
                          <Select
                            value=""
                            onValueChange={(value) => {
                              const minutes = Number(value)
                              setDelays((current) => ({ ...current, [run.departureId]: minutes }))
                              if (minutes > 0) textRun(run.stops, minutes)
                              else toast('Back on time')
                            }}
                          >
                            <SelectTrigger size="sm" className="w-36" aria-label="Running late" icon={<AlarmClock />}>
                              <SelectValue placeholder="Running late" />
                            </SelectTrigger>
                            <SelectContent>
                              {[10, 15, 20, 30].map((minutes) => (
                                <SelectItem key={minutes} value={String(minutes)}>
                                  {minutes} min late
                                </SelectItem>
                              ))}
                              <SelectItem value="0">Back on time</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : null}
                      </div>
                      <p className="hidden text-sm print:block">Driver: {assigned[run.departureId] ?? '________'}</p>
                    </header>
                    <ol className="flex list-none flex-col divide-y divide-line-subtle p-0">
                      {run.stops.map((stop, index) => (
                        <StopRow key={stop.bookingId} stop={stop} order={index + 1} delay={delay} today={today} state={stateOf(stop)} zoneName={zoneName(stop.zoneId)} onState={(next) => setStatus((current) => ({ ...current, [stop.bookingId]: next }))} />
                      ))}
                    </ol>
                    {today ? (
                      <footer className="border-t border-line-subtle bg-surface-sunken/40 px-4 py-2 text-xs text-muted sm:px-5 print:hidden">
                        {inRun === people ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-success"><CheckCircle2 className="size-3.5" aria-hidden="true" />Everyone on board</span>
                        ) : (
                          `${inRun} of ${people} guests on board`
                        )}
                      </footer>
                    ) : null}
                  </section>
                )
              })}
            </div>
          ) : (
            <ol className="flex list-none flex-col divide-y divide-line-subtle overflow-hidden rounded-2xl border border-line bg-surface p-0">
              {stops.map((stop, index) => (
                <StopRow key={stop.bookingId} stop={stop} order={index + 1} delay={delays[stop.departureId] ?? 0} today={today} state={stateOf(stop)} zoneName={zoneName(stop.zoneId)} showRun onState={(next) => setStatus((current) => ({ ...current, [stop.bookingId]: next }))} />
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  )
}

function StopRow({
  stop,
  order,
  delay,
  today,
  state,
  zoneName,
  showRun = false,
  onState,
}: {
  stop: PickupStop
  order: number
  delay: number
  today: boolean
  state: StopStatus
  zoneName: string
  showRun?: boolean
  onState: (state: StopStatus) => void
}) {
  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-5 print:break-inside-avoid',
        state === 'onboard' && 'bg-success-soft/30',
        state === 'noshow' && 'bg-danger-soft/25',
      )}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs font-semibold text-muted tabular-nums">{order}</span>
      <div className="w-24 shrink-0">
        <p className="font-display text-lg font-semibold tabular-nums text-foreground">{formatTime(later(stop.time, delay))}</p>
        {delay ? <p className="text-xs text-subtle line-through tabular-nums">{formatTime(stop.time)}</p> : <p className="truncate text-xs text-subtle">{zoneName}</p>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{stop.stop}</p>
        <p className="truncate text-sm text-muted">
          {stop.guestName} <span className="text-subtle">× {stop.party}</span> · {stop.reference}
        </p>
        {showRun ? (
          <p className="truncate text-xs text-subtle">
            {stop.activityName} · departs {formatTime(stop.departureAt)}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2 print:hidden">
        {stop.phone ? (
          <Button asChild variant="ghost" size="sm" aria-label={`Call ${stop.guestName}`}>
            <a href={`tel:${stop.phone.replace(/[^\d+]/g, '')}`}>
              <Phone className="size-4" aria-hidden="true" />
            </a>
          </Button>
        ) : null}
        {today ? (
          <>
            {state === 'noshow' ? (
              <Badge variant="danger" size="sm">No-show</Badge>
            ) : (
              <label className="inline-flex items-center gap-2 text-sm font-medium text-muted">
                <Checkbox checked={state === 'onboard'} onCheckedChange={(checked) => onState(checked === true ? 'onboard' : 'waiting')} />
                On board
              </label>
            )}
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<UserX />}
              onClick={() => {
                onState(state === 'noshow' ? 'waiting' : 'noshow')
                if (state !== 'noshow') toast(`${stop.guestName} marked a no-show`, { description: 'The booking is flagged so the office can follow up.' })
              }}
            >
              {state === 'noshow' ? 'Undo' : 'No-show'}
            </Button>
          </>
        ) : (
          <span className="text-xs text-subtle">Reminder goes out the evening before</span>
        )}
      </div>
      <span className="hidden w-16 shrink-0 text-center text-sm print:block">☐</span>
    </li>
  )
}
