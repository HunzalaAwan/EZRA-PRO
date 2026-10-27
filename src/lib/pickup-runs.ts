import type { LedgerStore } from '@/lib/booking-ledger'
import type { PickupRunSheet, PickupStop } from '@/lib/operations'
import { plusMinutes, stopsOfPickup } from '@/lib/transport'

/* ==========================================================================
   The pickup run sheets with this browser's bookings and changes on them:
   new bookings with transport, cancellations, moves (every stop moves with
   the time slot) and a changed pickup point. Pure, so the board and the
   checks read the same thing.
   ========================================================================== */

const minutesBetween = (from: string, to: string) => Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000)

const byTime = (a: PickupStop, b: PickupStop) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.stop.localeCompare(b.stop))

/** One booking's stops after its changes, or none when it is cancelled. */
function changedStops(list: PickupStop[], store: LedgerStore): PickupStop[] {
  const base = list[0]
  const change = store.changes[base.reference]
  if (!change) return list
  if (change.cancelled) return []
  const departureId = change.movedTo?.departureId ?? base.departureId
  const departureAt = change.movedTo?.startsAt ?? base.departureAt
  const party = change.party ?? base.party
  // A new pickup point: its stops as saved, worked out at the booking's time then; moved since, they move as far as the start did.
  if (change.pickup) {
    const since = minutesBetween(change.pickupFor ?? departureAt, departureAt)
    return stopsOfPickup(change.pickup).map((entry) => ({
      ...base,
      ...entry,
      id: `${base.bookingId}:${entry.kind}`,
      time: since ? plusMinutes(entry.time, since) : entry.time,
      departureId,
      departureAt,
      party,
    }))
  }
  // Moved: every stop moves as far as the start did.
  const shift = change.movedTo ? minutesBetween(base.departureAt, change.movedTo.startsAt) : 0
  return list.map((entry) => ({ ...entry, time: shift ? plusMinutes(entry.time, shift) : entry.time, departureId, departureAt, party }))
}

export function liveRunSheets(sheets: PickupRunSheet[], store: LedgerStore): PickupRunSheet[] {
  const byBooking = new Map<string, PickupStop[]>()
  for (const sheet of sheets) for (const stop of sheet.stops) byBooking.set(stop.bookingId, [...(byBooking.get(stop.bookingId) ?? []), stop])
  // Bookings made in this browser with transport: their stops, from the first part.
  for (const entry of store.entries) {
    if (!entry.pickup || byBooking.has(entry.id)) continue
    const stops = stopsOfPickup(entry.pickup).map<PickupStop>((stop) => ({
      ...stop,
      id: `${entry.id}:${stop.kind}`,
      bookingId: entry.id,
      reference: entry.reference,
      guestName: entry.name || 'Guest',
      phone: entry.phone ?? '',
      party: entry.party,
      activityName: entry.packageName ?? entry.activityName,
      departureId: entry.departureId,
      departureAt: entry.startsAt,
      status: 'confirmed',
    }))
    if (stops.length > 0) byBooking.set(entry.id, stops)
  }
  const days = new Map(sheets.map((sheet) => [sheet.dayKey, [] as PickupStop[]]))
  // On the day the stop happens: a package's drop-off can be days after its first part starts.
  for (const list of byBooking.values()) for (const stop of changedStops(list, store)) days.get((stop.time || stop.departureAt).slice(0, 10))?.push(stop)
  return sheets.map((sheet) => ({ ...sheet, stops: (days.get(sheet.dayKey) ?? []).sort(byTime) }))
}
