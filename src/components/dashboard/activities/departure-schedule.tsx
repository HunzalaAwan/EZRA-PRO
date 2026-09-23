'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, CalendarClock, CalendarPlus, Check, MapPin, Minus, Plus, Users, X } from 'lucide-react'

import { Avatar, AvatarGroup } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CapacityBar } from '@/components/ui/progress'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toaster'
import { ACTIVITY_FORMAT_META } from '@/lib/activity-format'
import { cn, formatDateLong, formatDuration, formatNumber, formatRelative, formatTime, pluralize, titleCase } from '@/lib/utils'
import type { ActivityFormat, DepartureStatus, WeatherSnapshot } from '@/types'

import type { DepartureRowLite } from './activity-data'

/* ==========================================================================
   <DepartureSchedule> — the runs of one experience, and the hands on them.

   Departures leave as a group: each one has seats, crew, kit and, close
   to the day, a weather call. Open entry has no group, so the same panel
   speaks of arrival slots and does not nag about crew. Every row opens a
   sheet where seats move, crew is ticked on, a run is held for weather,
   cancelled, reinstated or marked away. Add a run when the boat is full.
   ========================================================================== */

type RangeKey = '7d' | '14d' | '30d'
type SeatFilter = 'all' | 'open' | 'nearly' | 'full' | 'cancelled'

export interface CrewOption {
  id: string
  name: string
  avatarUrl: string
  title: string
}

export interface DepartureScheduleProps {
  rows: DepartureRowLite[]
  crew: CrewOption[]
  format: ActivityFormat
  activityName: string
  maxCapacity: number
  minParticipants: number
  durationMinutes: number
  usualTimes: string[]
  /** The locations this runs from; with more than one, rows say which and the list can filter. */
  locations?: { id: string; name: string }[]
  nowIso: string
  todayKey: string
}

const fillOf = (r: DepartureRowLite) => (r.capacity ? Math.round((r.booked / r.capacity) * 100) : 0)
const dateKeyOf = (iso: string) => iso.slice(0, 10)
const addDaysKey = (todayKey: string, days: number) => {
  const d = new Date(`${todayKey}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dayLabel = (dateKey: string, todayKey: string) => {
  const diff = Math.round((new Date(`${dateKey}T12:00:00`).getTime() - new Date(`${todayKey}T12:00:00`).getTime()) / 86_400_000)
  const long = formatDateLong(new Date(`${dateKey}T12:00:00`))
  return diff === 0 ? `Today · ${long}` : diff === 1 ? `Tomorrow · ${long}` : long
}

export function DepartureSchedule({ rows: initial, crew, format, activityName, maxCapacity, minParticipants, durationMinutes, usualTimes, locations = [], nowIso, todayKey }: DepartureScheduleProps) {
  const [rows, setRows] = React.useState(initial)
  const [range, setRange] = React.useState<RangeKey>('7d')
  const [seats, setSeats] = React.useState<SeatFilter>('all')
  const [site, setSite] = React.useState<string>('all')
  const multiSite = locations.length > 1
  const siteName = (id: string | undefined) => locations.find((entry) => entry.id === id)?.name ?? locations[0]?.name ?? ''
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [adding, setAdding] = React.useState(false)
  const open = format === 'open'
  const meta = ACTIVITY_FORMAT_META[format]
  const noun = open ? 'arrival slot' : 'departure'
  const now = React.useMemo(() => new Date(nowIso), [nowIso])

  const endKey = addDaysKey(todayKey, range === '7d' ? 7 : range === '14d' ? 14 : 30)
  const visible = React.useMemo(
    () =>
      rows.filter((r) => {
        const key = dateKeyOf(r.startsAt)
        if (key < todayKey || key >= endKey) return false
        if (site !== 'all' && (r.locationId ?? locations[0]?.id) !== site) return false
        const fill = fillOf(r)
        if (seats === 'open' && (fill >= 85 || r.status === 'cancelled')) return false
        if (seats === 'nearly' && (fill < 85 || fill >= 100 || r.status === 'cancelled')) return false
        if (seats === 'full' && (fill < 100 || r.status === 'cancelled')) return false
        if (seats === 'cancelled' && r.status !== 'cancelled') return false
        return true
      }),
    [rows, todayKey, endKey, seats, site, locations],
  )
  const days = React.useMemo(() => {
    const map = new Map<string, DepartureRowLite[]>()
    for (const r of visible) {
      const key = dateKeyOf(r.startsAt)
      map.set(key, [...(map.get(key) ?? []), r])
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [visible])

  const live = rows.filter((r) => dateKeyOf(r.startsAt) >= todayKey && dateKeyOf(r.startsAt) < endKey && r.status !== 'cancelled')
  const booked = live.reduce((s, r) => s + r.booked, 0)
  const capacity = live.reduce((s, r) => s + r.capacity, 0)
  const noCrew = open ? 0 : live.filter((r) => r.staff.length === 0 && new Date(r.startsAt) > now).length
  const nearly = live.filter((r) => fillOf(r) >= 85).length

  /* ---------- actions ---------- */
  const patch = (id: string, change: (r: DepartureRowLite) => DepartureRowLite) => setRows((current) => current.map((r) => (r.id === id ? change(r) : r)))

  const setStatus = (row: DepartureRowLite, status: DepartureStatus) => {
    patch(row.id, (r) => ({ ...r, status }))
    const when = `${formatTime(row.startsAt)} ${titleCase(noun)}`
    toast(
      status === 'cancelled' ? `${when} cancelled` : status === 'weather_hold' ? `${when} on weather hold` : status === 'confirmed' ? `${when} confirmed to run` : status === 'completed' ? `${when} marked away` : `${when} back on sale`,
      { description: status === 'cancelled' ? `${row.booked} ${pluralize(row.booked, 'guest')} emailed with a refund or a new date.` : status === 'weather_hold' ? 'Guests get a message now and a decision two hours before.' : status === 'confirmed' ? 'Crew and guests get the confirmation.' : undefined },
    )
  }

  const changeSeats = (row: DepartureRowLite, delta: number) => {
    const next = Math.max(row.booked, row.capacity + delta)
    if (next === row.capacity) return
    patch(row.id, (r) => ({ ...r, capacity: next, status: r.status === 'sold_out' && next > r.booked ? 'scheduled' : r.booked >= next && r.status === 'scheduled' ? 'sold_out' : r.status }))
  }

  const toggleCrew = (row: DepartureRowLite, member: CrewOption) =>
    patch(row.id, (r) => ({ ...r, staff: r.staff.some((s) => s.id === member.id) ? r.staff.filter((s) => s.id !== member.id) : [...r.staff, { id: member.id, name: member.name, avatarUrl: member.avatarUrl }] }))

  const add = (row: DepartureRowLite) => {
    setRows((current) => [...current, row].sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
    setAdding(false)
    toast.success(`${titleCase(noun)} added`, { description: `${dayLabel(dateKeyOf(row.startsAt), todayKey).replace(/ · .*$/, '')} at ${formatTime(row.startsAt)} · ${row.capacity} ${pluralize(row.capacity, 'seat')} · on sale now.` })
  }

  const selected = selectedId ? rows.find((r) => r.id === selectedId) ?? null : null

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- head ---------- */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{open ? 'Arrival slots' : format === 'dates' ? 'Fixed dates' : 'Departures'}</p>
          <p className="mt-0.5 text-xs text-muted">{meta.hint}</p>
          <p className="mt-2 text-xs text-subtle tabular-nums">
            {formatNumber(live.length)} {pluralize(live.length, noun)} in the next {range.replace('d', ' days')} · {formatNumber(booked)} of {formatNumber(capacity)} seats sold
            {nearly ? ` · ${nearly} nearly full` : ''}
            {noCrew ? ` · ${noCrew} without crew` : ''}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" asChild rightIcon={<ArrowUpRight />}>
            <Link href="/dashboard/calendar">Calendar</Link>
          </Button>
          <Button size="sm" leftIcon={<CalendarPlus />} onClick={() => setAdding(true)}>
            {open ? 'Add a slot' : 'Add a departure'}
          </Button>
        </div>
      </div>

      {/* ---------- filters ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented
          size="sm"
          label="Range"
          options={[
            { value: '7d', label: '7 days' },
            { value: '14d', label: '14 days' },
            { value: '30d', label: '30 days' },
          ]}
          value={range}
          onValueChange={setRange}
        />
        {multiSite ? (
          <Segmented
            size="sm"
            label="Location"
            options={[{ value: 'all', label: 'All locations' }, ...locations.map((entry) => ({ value: entry.id, label: entry.name }))]}
            value={site}
            onValueChange={setSite}
          />
        ) : null}
        <Segmented
          size="sm"
          label="Seats"
          options={[
            { value: 'all', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'nearly', label: 'Nearly full' },
            { value: 'full', label: 'Full' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
          value={seats}
          onValueChange={setSeats}
        />
      </div>

      {/* ---------- days ---------- */}
      {days.length === 0 ? (
        <EmptyState surface="dashed" size="sm" icon={CalendarClock} title={`Nothing ${seats === 'all' ? 'scheduled' : 'matches'}`} description={seats === 'all' ? `No ${pluralize(2, noun)} in this window. Add one, or widen the range.` : 'Try another seat filter.'} />
      ) : (
        days.map(([dateKey, list]) => {
          const dayBooked = list.reduce((s, r) => s + (r.status === 'cancelled' ? 0 : r.booked), 0)
          const dayCapacity = list.reduce((s, r) => s + (r.status === 'cancelled' ? 0 : r.capacity), 0)
          return (
            <section key={dateKey} aria-label={dayLabel(dateKey, todayKey)}>
              <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
                <h3 className="text-[0.8125rem] font-medium text-foreground">{dayLabel(dateKey, todayKey)}</h3>
                <span className="text-xs text-subtle tabular-nums">
                  {list.length} {pluralize(list.length, noun)} · {dayBooked} of {dayCapacity} seats
                </span>
              </div>
              <ul className="flex list-none flex-col gap-2 p-0">
                {list.map((r) => {
                  const fill = fillOf(r)
                  const upcoming = new Date(r.startsAt) > now
                  const dead = r.status === 'cancelled' || r.status === 'completed'
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        className={cn(
                          'flex w-full flex-col gap-3 rounded-xl border border-line bg-surface p-3.5 text-left transition-[border-color,box-shadow] duration-300 hover:border-primary/40 hover:shadow-sm sm:flex-row sm:items-center',
                          dead && 'opacity-60',
                        )}
                      >
                        <div className="flex shrink-0 items-center gap-3 sm:w-48">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">
                              {formatTime(r.startsAt)}
                              <span className="text-faint"> – {formatTime(r.endsAt)}</span>
                            </p>
                            <p className={cn('text-xs', upcoming && dateKey === todayKey && new Date(r.startsAt).getTime() - now.getTime() < 2 * 3_600_000 && !dead ? 'text-warning' : 'text-subtle')}>{dead && r.status === 'completed' ? 'Away' : formatRelative(r.startsAt, now)}</p>
                            {multiSite ? (
                              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted">
                                <MapPin className="size-3" aria-hidden="true" />
                                {siteName(r.locationId)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <CapacityBar booked={r.booked} capacity={r.capacity} held={r.held} size="sm" />
                        </div>
                        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                          {r.weather ? <WeatherPill weather={r.weather} /> : null}
                          {open ? null : r.staff.length > 0 ? (
                            <AvatarGroup size="xs" max={3} label="Assigned crew" avatars={r.staff.map((m) => ({ id: m.id, name: m.name, src: m.avatarUrl }))} />
                          ) : !dead ? (
                            <span className="inline-flex items-center gap-1 text-xs text-warning">
                              <AlertTriangle className="size-3" aria-hidden="true" />
                              No crew
                            </span>
                          ) : null}
                          <StatusBadge kind="departure" status={r.status} size="sm" />
                          {fill >= 100 && r.status !== 'cancelled' ? null : fill >= 85 && r.status !== 'cancelled' ? <span className="hidden text-xs text-warning lg:inline">{r.capacity - r.booked} left</span> : null}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })
      )}

      <RunSheet row={selected} crew={crew} open={open} noun={noun} minParticipants={minParticipants} now={now} todayKey={todayKey} onClose={() => setSelectedId(null)} onStatus={setStatus} onSeats={changeSeats} onCrew={toggleCrew} />
      <AddRunDialog open={adding} onOpenChange={setAdding} noun={noun} isOpenEntry={open} activityName={activityName} maxCapacity={maxCapacity} durationMinutes={durationMinutes} usualTimes={usualTimes} crew={crew} locations={locations} todayKey={todayKey} onAdd={add} />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Pieces
   -------------------------------------------------------------------------- */

function WeatherPill({ weather }: { weather: WeatherSnapshot }) {
  return (
    <SimpleTooltip label={`${titleCase(weather.condition)} · ${weather.tempC}°C · ${weather.windKts} kts · ${weather.goConfidence}% likely to run`}>
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium tabular-nums', weather.goConfidence >= 75 ? 'bg-success-soft text-success' : weather.goConfidence >= 50 ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger')}>{weather.goConfidence}%</span>
    </SimpleTooltip>
  )
}

function RunSheet({ row: r, crew, open, noun, minParticipants, now, todayKey, onClose, onStatus, onSeats, onCrew }: { row: DepartureRowLite | null; crew: CrewOption[]; open: boolean; noun: string; minParticipants: number; now: Date; todayKey: string; onClose: () => void; onStatus: (row: DepartureRowLite, status: DepartureStatus) => void; onSeats: (row: DepartureRowLite, delta: number) => void; onCrew: (row: DepartureRowLite, member: CrewOption) => void }) {
  const upcoming = r ? new Date(r.startsAt) > now : false
  const live = r ? r.status !== 'cancelled' && r.status !== 'completed' : false
  const fill = r ? fillOf(r) : 0
  return (
    <Sheet open={r !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" size="md">
        {r ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span>
                  {formatTime(r.startsAt)} {noun}
                </span>
                <StatusBadge kind="departure" status={r.status} size="sm" />
              </SheetTitle>
              <SheetDescription>
                {dayLabel(dateKeyOf(r.startsAt), todayKey)} · until {formatTime(r.endsAt)} · {formatRelative(r.startsAt, now)}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-5">
              <div className="rounded-xl border border-line p-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted">Seats</p>
                    <p className="mt-0.5 font-display text-2xl leading-none font-semibold text-foreground tabular-nums">
                      {r.booked}
                      <span className="text-base text-subtle"> / {r.capacity}</span>
                    </p>
                    <p className="mt-1 text-xs text-subtle">
                      {r.held ? `${r.held} held in carts · ` : ''}
                      {r.booked < minParticipants ? `${minParticipants - r.booked} more to reach the minimum` : `${Math.max(0, r.capacity - r.booked)} left`}
                    </p>
                  </div>
                  {live ? (
                    <span className="inline-flex items-center rounded-full border border-line">
                      <button type="button" aria-label="Remove a seat" className="grid size-8 place-items-center text-muted disabled:opacity-40" disabled={r.capacity <= r.booked} onClick={() => onSeats(r, -1)}>
                        <Minus className="size-3.5" />
                      </button>
                      <span className="min-w-[2rem] text-center text-sm tabular-nums">{r.capacity}</span>
                      <button type="button" aria-label="Add a seat" className="grid size-8 place-items-center text-muted" onClick={() => onSeats(r, 1)}>
                        <Plus className="size-3.5" />
                      </button>
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-sunken">
                  <div className={cn('h-full rounded-full', fill >= 100 ? 'bg-primary' : fill >= 85 ? 'bg-warning' : 'bg-success')} style={{ width: `${Math.min(100, fill)}%` }} />
                </div>
              </div>

              {!open ? (
                <div>
                  <p className="text-xs font-medium text-muted">Crew</p>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {crew.map((m) => {
                      const on = r.staff.some((s) => s.id === m.id)
                      return (
                        <li key={m.id}>
                          <label className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-[0.8125rem] transition-colors', on ? 'border-primary/40 bg-primary-soft/30' : 'border-line hover:border-line-strong')}>
                            <Checkbox checked={on} disabled={!live} onCheckedChange={() => onCrew(r, m)} aria-label={`${m.name} on this ${noun}`} />
                            <Avatar name={m.name} src={m.avatarUrl} size="xs" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-foreground">{m.name}</span>
                              <span className="block truncate text-xs text-subtle">{m.title}</span>
                            </span>
                            {on ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : null}
                          </label>
                        </li>
                      )
                    })}
                    {crew.length === 0 ? <li className="text-xs text-subtle">No bookable crew yet. Add them under Team.</li> : null}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-subtle">Open entry: guests arrive any time in this slot, so there is no group to crew. Adjust the seats to widen or narrow it.</p>
              )}

              {r.weather ? (
                <div>
                  <p className="text-xs text-muted">Weather</p>
                  <p className={cn('mt-0.5 text-[0.8125rem]', r.weather.goConfidence < 60 ? 'text-warning' : 'text-foreground')}>
                    {titleCase(r.weather.condition)} · {r.weather.tempC}° · {r.weather.windKts} kts wind{r.weather.swellM ? ` · ${r.weather.swellM} m swell` : ''} · {r.weather.goConfidence}% likely to run
                  </p>
                </div>
              ) : null}
            </SheetBody>
            <SheetFooter className="flex-wrap gap-2">
              {live && upcoming && r.status !== 'confirmed' && !open ? (
                <Button size="sm" onClick={() => onStatus(r, 'confirmed')}>
                  Confirm it runs
                </Button>
              ) : null}
              {live && upcoming && r.status !== 'weather_hold' ? (
                <Button size="sm" variant="outline" onClick={() => onStatus(r, 'weather_hold')}>
                  Weather hold
                </Button>
              ) : null}
              {r.status === 'weather_hold' ? (
                <Button size="sm" variant="outline" onClick={() => onStatus(r, 'scheduled')}>
                  Release hold
                </Button>
              ) : null}
              {live && !upcoming && !open ? (
                <Button size="sm" variant="outline" onClick={() => onStatus(r, 'completed')}>
                  Mark away
                </Button>
              ) : null}
              {live ? (
                <Button size="sm" variant="ghost" className="text-danger" leftIcon={<X />} onClick={() => onStatus(r, 'cancelled')}>
                  Cancel {noun}
                </Button>
              ) : r.status === 'cancelled' && upcoming ? (
                <Button size="sm" variant="outline" onClick={() => onStatus(r, 'scheduled')}>
                  Reinstate
                </Button>
              ) : null}
              <Button asChild size="sm" variant="ghost" className="ml-auto" rightIcon={<ArrowUpRight />}>
                <Link href={dateKeyOf(r.startsAt) === todayKey ? '/dashboard/manifest' : '/dashboard/calendar'}>{dateKeyOf(r.startsAt) === todayKey ? 'Manifest' : 'Calendar'}</Link>
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function AddRunDialog({ open, onOpenChange, noun, isOpenEntry, activityName, maxCapacity, durationMinutes, usualTimes, crew, locations = [], todayKey, onAdd }: { open: boolean; onOpenChange: (open: boolean) => void; noun: string; isOpenEntry: boolean; activityName: string; maxCapacity: number; durationMinutes: number; usualTimes: string[]; crew: CrewOption[]; locations?: { id: string; name: string }[]; todayKey: string; onAdd: (row: DepartureRowLite) => void }) {
  const [date, setDate] = React.useState(todayKey)
  const [time, setTime] = React.useState(usualTimes[0] ?? '09:00')
  const [capacity, setCapacity] = React.useState(maxCapacity)
  const [crewIds, setCrewIds] = React.useState<string[]>([])
  const [locationId, setLocationId] = React.useState(locations[0]?.id ?? '')

  React.useEffect(() => {
    if (!open) return
    setDate(todayKey)
    setTime(usualTimes[0] ?? '09:00')
    setCapacity(maxCapacity)
    setCrewIds([])
    setLocationId(locations[0]?.id ?? '')
  }, [open, todayKey, usualTimes, maxCapacity, locations])

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) && capacity > 0
  const submit = () => {
    if (!valid) return
    const startsAt = `${date}T${time}:00`
    const end = new Date(new Date(startsAt).getTime() + durationMinutes * 60_000)
    const endsAt = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}T${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}:00`
    onAdd({ id: `dep_new_${Date.now().toString(36)}`, startsAt, endsAt, locationId: locations.length > 0 ? locationId : undefined, capacity, booked: 0, held: 0, status: 'scheduled', staff: crew.filter((c) => crewIds.includes(c.id)).map((c) => ({ id: c.id, name: c.name, avatarUrl: c.avatarUrl })), resources: [], weather: null })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader divider>
          <DialogTitle>{isOpenEntry ? 'Add an arrival slot' : 'Add a departure'}</DialogTitle>
          <DialogDescription>{isOpenEntry ? `An extra window for ${activityName}. Guests can pick it on the storefront straight away.` : `An extra run of ${activityName}. It goes on sale on the storefront the moment you add it.`}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Date" required>{(control) => <Input {...control} type="date" min={todayKey} value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
            <Field label="Time" required description={usualTimes.length ? `Usually ${usualTimes.slice(0, 4).join(', ')}${usualTimes.length > 4 ? '…' : ''}` : undefined}>{(control) => <Input {...control} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          </div>
          {locations.length > 1 ? (
            <Field label="Location" required>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger aria-label="Location" icon={<MapPin className="size-4" />}>
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field label="Seats" required description={`${activityName} normally takes ${maxCapacity}.`}>{(control) => <Input {...control} type="number" inputMode="numeric" min={1} max={500} value={capacity} onChange={(e) => setCapacity(Math.max(0, Number(e.target.value || 0)))} leftIcon={<Users />} />}</Field>
          {!isOpenEntry && crew.length ? (
            <Field label="Crew" optional>
              <div className="flex flex-wrap gap-1.5">
                {crew.map((m) => {
                  const on = crewIds.includes(m.id)
                  return (
                    <button key={m.id} type="button" aria-pressed={on} onClick={() => setCrewIds((ids) => (on ? ids.filter((x) => x !== m.id) : [...ids, m.id]))} className={cn('inline-flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-xs transition-colors', on ? 'border-primary bg-primary-soft/40 text-foreground' : 'border-line text-muted hover:border-line-strong')}>
                      <Avatar name={m.name} src={m.avatarUrl} size="xs" />
                      {m.name.split(' ')[0]}
                    </button>
                  )
                })}
              </div>
            </Field>
          ) : null}
          <Field label="Note for the crew" optional>{(control) => <Textarea {...control} rows={2} placeholder="Charter for the Okada family, pick up at the north pier…" />}</Field>
        </DialogBody>
        <DialogFooter divider>
          <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" leftIcon={<Check />} disabled={!valid} onClick={submit}>
            Add {noun}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
