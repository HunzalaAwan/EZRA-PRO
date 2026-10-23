'use client'

import * as React from 'react'

import { NOW, TODAY_KEY } from '@/lib/data/constants'
import { CURRENT_TENANT, getActivitiesByTenant } from '@/lib/demo-core'
import { applyActivityOverride, type ActivityOverride } from '@/lib/activity-overrides'
import {
  defaultSpots,
  departureFromSlotId,
  plusExtraSpots,
  expandDays,
  expandSchedules,
  isCancelledSlot,
  isGeneratedSlotId,
  parseSlotId,
  scheduleContextOf,
  shiftDayKey,
  slotId,
  type ScheduleContext,
  type ScheduledSlot,
} from '@/lib/activity-schedule'
import { useActivityOverrides } from '@/hooks/use-pricing-override'
import { slotExtraSpotsOf } from '@/lib/extra-spots'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import type { CalendarEvent } from '@/lib/demo'
import type { Activity, DepartureStatus } from '@/types'

/* ==========================================================================
   The calendar with the schedules saved in this browser. The server only
   has the seeded time slots, so times added from the calendar or the
   Schedule step are laid in here, and times the owner closed (or the
   business is shut for) show as cancelled. Past the days the server seeds,
   every activity's times come from its schedule. Days before today stay as
   the server has them. The first render is the server's list; saved edits
   are read from the store after hydration.
   ========================================================================== */

/** An event the schedule no longer has that still runs for the guests booked on it. */
export type ScheduledCalendarEvent = CalendarEvent & { outsideSchedule?: boolean }

/** The last day the demo seeds time slots for (src/lib/demo.ts): 60 days ahead for the main business, 45 for the others. */
export function seededHorizonKey(tenantId: string): string {
  return shiftDayKey(TODAY_KEY, tenantId === CURRENT_TENANT.id ? 60 : 45)
}

const pad = (n: number) => String(n).padStart(2, '0')
const LOCAL_NOW = `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-${pad(NOW.getDate())}T${pad(NOW.getHours())}:${pad(NOW.getMinutes())}:00`

const matchKey = (dateKey: string, time: string, locationId: string | undefined) => `${dateKey}|${time}|${locationId ?? ''}`
const slotKey = (slot: ScheduledSlot, primary?: string) => matchKey(slot.dateKey, slot.time, slot.locationId ?? primary)
const eventKey = (event: CalendarEvent, primary?: string) =>
  matchKey(event.departure.startsAt.slice(0, 10), event.departure.startsAt.slice(11, 16), event.departure.locationId ?? primary)
const dayOf = (event: CalendarEvent) => event.departure.startsAt.slice(0, 10)

/** A time slot that only exists on the saved schedule, with the gen_ id checkout and the time slot sheet understand. Its extra spots are on sale too. */
function generatedEvent(base: Activity, edited: Activity, slot: ScheduledSlot, status: DepartureStatus): CalendarEvent | null {
  const built = departureFromSlotId(edited, slotId(edited.id, slot.dateKey, slot.time, slot.locationId))
  if (!built) return null
  const capacity = plusExtraSpots(slot.capacity, slotExtraSpotsOf(edited))
  return { departure: { ...built, capacity, status }, activity: base, seatsLeft: capacity, fillRate: 0, revenue: 0, paid: 0 }
}

/**
 * A seeded time slot with the spots the schedule now gives it (its own usual
 * spots unless the edit set them) and the edit's extra spots on top; what is
 * sold stays sold.
 */
function withSpots(event: CalendarEvent, slot: ScheduledSlot, spotsChanged: boolean, extraWas: number, extraNow: number): CalendarEvent {
  const { departure } = event
  if (departure.status === 'cancelled' || departure.status === 'completed') return event
  const was = Math.max(0, departure.capacity - extraWas)
  const spots = plusExtraSpots(was === slot.capacity || !(slot.capacitySet || spotsChanged) ? was : slot.capacity, extraNow)
  if (spots === departure.capacity) return event
  const capacity = Math.max(spots, departure.booked)
  const status: DepartureStatus =
    departure.status === 'sold_out' && capacity > departure.booked ? 'scheduled' : departure.status === 'scheduled' && departure.booked >= capacity ? 'sold_out' : departure.status
  return {
    ...event,
    departure: { ...departure, capacity, status },
    seatsLeft: Math.max(0, capacity - departure.booked - departure.held),
    fillRate: capacity > 0 ? departure.booked / capacity : 0,
  }
}

/** One activity's time slots in the range, rebuilt from its saved schedule. */
function rebuildActivity(
  base: Activity,
  edited: Activity,
  events: CalendarEvent[],
  fromKey: string,
  toKey: string,
  ctx: Pick<ScheduleContext, 'closures' | 'holidays'>,
  delta: Record<string, number>,
  /** The last day the server has seeded time slots for; absent: the whole range. */
  seededToKey?: string,
): CalendarEvent[] {
  const primary = edited.locations[0]?.locationId ?? base.locations[0]?.locationId
  const days = expandDays(edited, fromKey, toKey, ctx)
  const plan = days.flatMap((day) => day.slots)
  const planned = new Set(plan.map((slot) => slotKey(slot, primary)))
  // Whole days closed by a change, a business closed day or a public holiday.
  const closedDays = new Set(days.filter((day) => day.closed).map((day) => `${day.dateKey}|${day.locationId ?? primary ?? ''}`))
  // What would run with nothing closed: the difference is what the owner closed or the business is shut for.
  const unclosed = { ...edited, scheduleChanges: (edited.scheduleChanges ?? []).filter((change) => change.action !== 'closed') }
  const closed = new Map<string, ScheduledSlot>()
  for (const slot of expandSchedules(unclosed, fromKey, toKey)) {
    const key = slotKey(slot, primary)
    if (!planned.has(key) && !closed.has(key)) closed.set(key, slot)
  }
  // What the seeded time slots were made from: a time it had but the server doesn't show isn't new.
  // Only where the server has seeded time slots: past them, or for an activity it never seeded, every time is new.
  const legacyTo = seededToKey !== undefined && seededToKey < toKey ? seededToKey : toKey
  const legacy = new Set(base.status === 'live' && fromKey <= legacyTo ? expandSchedules(base, fromKey, legacyTo).map((slot) => slotKey(slot, primary)) : [])
  const byKey = new Map<string, CalendarEvent>()
  for (const event of events) {
    const key = eventKey(event, primary)
    const had = byKey.get(key)
    if (!had || (had.departure.status === 'cancelled' && event.departure.status !== 'cancelled')) byKey.set(key, event)
  }
  const spotsChanged = defaultSpots(edited) !== defaultSpots(base)
  const extraWas = slotExtraSpotsOf(base)
  const extraNow = slotExtraSpotsOf(edited)
  const ahead = (slot: ScheduledSlot) => `${slot.dateKey}T${slot.time}:00` >= LOCAL_NOW

  const out: ScheduledCalendarEvent[] = []
  const used = new Set<string>()
  for (const slot of plan) {
    const key = slotKey(slot, primary)
    const match = byKey.get(key)
    if (match) {
      used.add(match.departure.id)
      out.push(withSpots(match, slot, spotsChanged, extraWas, extraNow))
      continue
    }
    if (legacy.has(key) || !ahead(slot)) continue
    const event = generatedEvent(base, edited, slot, 'scheduled')
    if (event) out.push(event)
  }
  for (const event of events) {
    if (used.has(event.departure.id)) continue
    const { departure } = event
    if (departure.status === 'cancelled' || departure.status === 'completed') {
      out.push(event)
      continue
    }
    const key = eventKey(event, primary)
    const booked = departure.booked + (delta[departure.id] ?? 0)
    const calledOff = isCancelledSlot(edited, departure.startsAt, departure.locationId)
    if (calledOff || closed.has(key) || closedDays.has(`${dayOf(event)}|${departure.locationId ?? primary ?? ''}`)) {
      // Closed: cancelled, unless guests are still booked on it (a closed day keeps its booked time slots running).
      out.push(calledOff || booked <= 0 ? { ...event, departure: { ...departure, status: 'cancelled' } } : { ...event, outsideSchedule: true })
      continue
    }
    // Off the weekly times after an edit: it still runs for its guests; an empty one is gone. One-off time slots stay.
    if (!legacy.has(key)) out.push(event)
    else if (booked > 0) out.push({ ...event, outsideSchedule: true })
  }
  // Added times that were closed again (cancelled from the calendar, or on a closed day).
  for (const [key, slot] of closed) {
    if (byKey.has(key) || legacy.has(key) || !ahead(slot)) continue
    const event = generatedEvent(base, edited, slot, 'cancelled')
    if (!event) continue
    const { departure } = event
    // Guests booked on it keep it running on a closed day, unless it was called off.
    const runs = (delta[departure.id] ?? 0) > 0 && !isCancelledSlot(edited, departure.startsAt, departure.locationId)
    out.push(runs ? { ...event, departure: { ...departure, status: 'scheduled' }, outsideSchedule: true } : event)
  }
  // Booked added times the schedule no longer has (removed, or a season edited): they still run for their guests.
  const shown = new Set(out.map((event) => event.departure.id))
  const running = new Set(out.filter((event) => event.departure.status !== 'cancelled').map((event) => eventKey(event, primary)))
  for (const [id, seats] of Object.entries(delta)) {
    if (seats <= 0 || shown.has(id) || !isGeneratedSlotId(id)) continue
    const parsed = parseSlotId(id)
    if (!parsed || parsed.activityId !== edited.id || parsed.dateKey < fromKey || parsed.dateKey > toKey) continue
    const built = departureFromSlotId(edited, id)
    if (!built) continue
    // The server books a generated id onto a seeded time slot at the same start time.
    if (running.has(matchKey(parsed.dateKey, parsed.time, built.locationId ?? primary))) continue
    const calledOff = isCancelledSlot(edited, built.startsAt, built.locationId)
    const status: DepartureStatus = calledOff ? 'cancelled' : built.startsAt < LOCAL_NOW ? 'completed' : 'scheduled'
    // Never fewer spots than are booked, so every guest shows.
    const capacity = Math.max(built.capacity, seats)
    out.push({ departure: { ...built, capacity, status }, activity: base, seatsLeft: capacity, fillRate: 0, revenue: 0, paid: 0, outsideSchedule: true })
  }
  return out
}

/**
 * The calendar's events with the saved schedules laid over them, for the
 * days from `fromKey` to `toKey` (never before today). Activities with no
 * saved edit and no business closed days come back untouched, except past
 * `seededToKey`, where their times come from their schedule. Booked
 * generated time slots the schedule no longer has stay.
 */
export function scheduleCalendarEvents(
  events: CalendarEvent[],
  opts: {
    activities: Activity[]
    overrides: Record<string, ActivityOverride>
    ctx: Pick<ScheduleContext, 'closures' | 'holidays'>
    fromKey: string
    toKey: string
    delta: Record<string, number>
    /** The last day the server seeds time slots for. Past it, every live activity's times come from its schedule. */
    seededToKey?: string
  },
): CalendarEvent[] {
  const fromKey = opts.fromKey < TODAY_KEY ? TODAY_KEY : opts.fromKey
  const { toKey, ctx } = opts
  if (fromKey > toKey) return events
  const closuresOn = (ctx.closures?.length ?? 0) > 0 || Boolean(ctx.holidays?.enabled)
  const inRange = (event: CalendarEvent) => dayOf(event) >= fromKey && dayOf(event) <= toKey

  const bases = new Map<string, Activity>()
  for (const activity of opts.activities) bases.set(activity.id, activity)
  const byActivity = new Map<string, CalendarEvent[]>()
  for (const event of events) {
    if (!inRange(event)) continue
    if (!bases.has(event.activity.id)) bases.set(event.activity.id, event.activity)
    const list = byActivity.get(event.departure.activityId)
    if (list) list.push(event)
    else byActivity.set(event.departure.activityId, [event])
  }

  // The seeded days, or further when the server's list reaches past them.
  let seededTo = opts.seededToKey
  if (seededTo !== undefined) for (const event of events) if (dayOf(event) > seededTo) seededTo = dayOf(event)
  const pastSeeded = seededTo !== undefined && seededTo < toKey ? shiftDayKey(seededTo, 1) : undefined
  // Activities with time slots booked in this browser that only the schedule made.
  const bookedGenerated = new Set<string>()
  for (const [id, seats] of Object.entries(opts.delta)) {
    if (seats <= 0 || !isGeneratedSlotId(id)) continue
    const parsed = parseSlotId(id)
    if (parsed && parsed.dateKey >= fromKey && parsed.dateKey <= toKey) bookedGenerated.add(parsed.activityId)
  }

  /** Activity id → the first day rebuilt. */
  const touched = new Map<string, string>()
  const rebuilt: CalendarEvent[] = []
  for (const [id, base] of bases) {
    if ((base.kind ?? 'trip') === 'package') continue
    const override = opts.overrides[id]
    const own = byActivity.get(id) ?? []
    // Business closed days only change activities with time slots in view.
    const custom = Boolean(override || base.schedules || base.scheduleChanges || base.spotsByWeekday || (closuresOn && own.length > 0) || bookedGenerated.has(id))
    // The rest only past the seeded days, where the server has nothing.
    const from = custom ? fromKey : pastSeeded === undefined ? undefined : pastSeeded > fromKey ? pastSeeded : fromKey
    if (from === undefined) continue
    const edited = applyActivityOverride(base, override)
    if (edited.status === 'draft' || edited.status === 'archived') continue
    // Never seeded and not live here either: it has no time slots anywhere.
    if (edited.status !== 'live' && base.status !== 'live') continue
    touched.set(id, from)
    rebuilt.push(...rebuildActivity(base, edited, from === fromKey ? own : own.filter((event) => dayOf(event) >= from), from, toKey, ctx, opts.delta, seededTo))
  }
  if (touched.size === 0) return events
  const kept = events.filter((event) => {
    const from = touched.get(event.departure.activityId)
    return from === undefined || dayOf(event) < from || dayOf(event) > toKey
  })
  return [...kept, ...rebuilt].sort((a, b) => (a.departure.startsAt < b.departure.startsAt ? -1 : a.departure.startsAt > b.departure.startsAt ? 1 : 0))
}

/** The calendar's events with this browser's saved schedules and the business's closed days applied. */
export function useScheduledEvents(
  events: CalendarEvent[],
  opts: { tenantId: string; tenantSlug: string; fromKey: string; toKey: string; delta: Record<string, number> },
): CalendarEvent[] {
  // Both stores read empty on the server and during hydration, so the first render matches the server's.
  const overrides = useActivityOverrides()
  const { defaults } = useBookingDefaults(opts.tenantSlug)
  const activities = React.useMemo(() => getActivitiesByTenant(opts.tenantId), [opts.tenantId])
  const { fromKey, toKey, delta } = opts
  return React.useMemo(() => {
    try {
      return scheduleCalendarEvents(events, { activities, overrides, ctx: scheduleContextOf(defaults), fromKey, toKey, delta, seededToKey: seededHorizonKey(opts.tenantId) })
    } catch {
      // A broken saved edit never takes the calendar down: the server's time slots still show.
      return events
    }
  }, [events, activities, overrides, defaults, fromKey, toKey, delta, opts.tenantId])
}
