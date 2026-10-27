import { NOW } from '@/lib/data/constants'
import type { CurrencyCode, TransferBookingDetails } from '@/types'

/* ==========================================================================
   Booking ledger — what changed after the demo data was built: bookings
   made at checkout or by staff, and moves, cancellations and party changes
   on any booking. Kept in the browser (`ezra:ledger:<slug>`), so the
   storefront, the guest's page and the dashboard all count the same seats.
   A package books one entry per part, under one reference.
   ========================================================================== */

export const LEDGER_EVENT = 'ezra:ledger'
const keyFor = (slug: string) => `ezra:ledger:${slug}`

export interface LedgerEntry {
  /** Unique per part: the reference, plus the part number for packages. */
  id: string
  reference: string
  activitySlug: string
  activityName: string
  departureId: string
  startsAt: string
  endsAt: string
  party: number
  source: 'storefront' | 'dashboard'
  /** Set when the entry is one part of a package booking. */
  packageSlug?: string
  packageName?: string
  /**
   * Transfers: the ride. One entry per booking, not per leg; `party` is the
   * vehicles (a shared shuttle: its seats), and `peopleOfEntry` the passengers.
   */
  transfer?: TransferBookingDetails
  name: string
  email: string
  phone?: string
  /** What the whole booking costs and what was paid now, minor units. On the first part only. */
  total: number
  paidNow: number
  currency: CurrencyCode
  createdAt: string
}

export interface ChangeEvent {
  at: string
  by: 'guest' | 'staff'
  what: string
}

/** Changes to one booking, keyed by reference. Seeded bookings carry where they started. */
export interface BookingChange {
  /** Where the booking started and with how many, so seat counts can be moved. */
  fromDepartureId: string
  fromStartsAt: string
  fromParty: number
  /**
   * Transfers: the time slots of the ride's later legs as booked (a round
   * trip's return), which hold the same `fromParty` as the first. `transfer`
   * replaces them once the ride is changed.
   */
  fromLegDepartureIds?: string[]
  movedTo?: { departureId: string; startsAt: string }
  moves: number
  party?: number
  cancelled?: boolean
  refund?: number
  fee?: number
  /** Transfers: the ride as changed (a new flight, time or hotel). Its first leg's slot moves with `movedTo`. */
  transfer?: TransferBookingDetails
  history: ChangeEvent[]
}

export interface LedgerStore {
  entries: LedgerEntry[]
  changes: Record<string, BookingChange>
}

const EMPTY: LedgerStore = { entries: [], changes: {} }

export function parseLedger(raw: string | null): LedgerStore {
  if (!raw) return EMPTY
  try {
    const parsed = JSON.parse(raw) as Partial<LedgerStore>
    return { entries: parsed.entries ?? [], changes: parsed.changes ?? {} }
  } catch {
    return EMPTY
  }
}

export function readLedger(slug: string): LedgerStore {
  try {
    return parseLedger(window.localStorage.getItem(keyFor(slug)))
  } catch {
    return EMPTY
  }
}

export function writeLedger(slug: string, store: LedgerStore) {
  try {
    window.localStorage.setItem(keyFor(slug), JSON.stringify(store))
  } catch {
    /* storage blocked: the change still shows until the page reloads */
  }
  window.dispatchEvent(new Event(LEDGER_EVENT))
}

export const ledgerKey = keyFor

/** Changes are stamped on the demo clock, so they sit in the right place on every timeline. */
const stamp = () => {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-${pad(NOW.getDate())}T${pad(NOW.getHours())}:${pad(NOW.getMinutes())}:${pad(new Date().getSeconds())}`
}

/** Record a new booking: one entry, or one per part of a package. */
export function recordBooking(slug: string, entries: LedgerEntry[]) {
  const store = readLedger(slug)
  const ids = new Set(entries.map((entry) => entry.id))
  writeLedger(slug, { ...store, entries: [...entries, ...store.entries.filter((entry) => !ids.has(entry.id))] })
}

/** Apply a change to a booking, starting its record from where it began. */
export function changeBooking(
  slug: string,
  reference: string,
  start: Pick<BookingChange, 'fromDepartureId' | 'fromStartsAt' | 'fromParty' | 'fromLegDepartureIds'>,
  patch: Partial<Omit<BookingChange, 'history' | 'fromDepartureId' | 'fromStartsAt' | 'fromParty'>>,
  event: Omit<ChangeEvent, 'at'>,
) {
  const store = readLedger(slug)
  const current: BookingChange = store.changes[reference] ?? { ...start, moves: 0, history: [] }
  writeLedger(slug, {
    ...store,
    changes: { ...store.changes, [reference]: { ...current, ...patch, history: [...current.history, { ...event, at: stamp() }] } },
  })
}

/** A ride's later legs' time slots (a round trip's return): they hold the same as the first leg. */
const laterLegSlots = (details: TransferBookingDetails | undefined): string[] =>
  (details?.legs ?? []).slice(1).map((leg) => leg.departureId).filter(Boolean)

/**
 * Seats each departure gains or loses from the ledger: new bookings take
 * seats, cancellations give them back, a move gives back the old time and
 * takes the new one. A ride takes its vehicles (or seats) on every leg's
 * time slot, so a round trip's return counts on its own slot.
 */
export function seatDeltas(store: LedgerStore): Record<string, number> {
  const delta: Record<string, number> = {}
  const add = (id: string, seats: number) => {
    delta[id] = (delta[id] ?? 0) + seats
  }
  for (const entry of store.entries) {
    add(entry.departureId, entry.party)
    for (const id of laterLegSlots(entry.transfer)) add(id, entry.party)
  }
  for (const change of Object.values(store.changes)) {
    add(change.fromDepartureId, -change.fromParty)
    for (const id of change.fromLegDepartureIds ?? []) add(id, -change.fromParty)
    if (change.cancelled) continue
    const party = change.party ?? change.fromParty
    add(change.movedTo?.departureId ?? change.fromDepartureId, party)
    for (const id of change.transfer ? laterLegSlots(change.transfer) : (change.fromLegDepartureIds ?? [])) add(id, party)
  }
  return delta
}

/**
 * Where a booking's changes start from: its time slot, and what it holds
 * there. A ride holds its vehicles (a shared run: its seats) on every leg.
 */
export function changeStartOf(booking: {
  departureId: string
  startsAt: string
  partySize: number
  transfer?: TransferBookingDetails
}): Pick<BookingChange, 'fromDepartureId' | 'fromStartsAt' | 'fromParty' | 'fromLegDepartureIds'> {
  const start = { fromDepartureId: booking.departureId, fromStartsAt: booking.startsAt, fromParty: booking.partySize }
  const ride = booking.transfer
  if (!ride) return start
  const later = laterLegSlots(ride)
  const fromParty = ride.service === 'shared' ? booking.partySize : Math.max(1, ride.vehicles.reduce((sum, line) => sum + line.qty, 0))
  return { ...start, fromParty, ...(later.length > 0 ? { fromLegDepartureIds: later } : {}) }
}

/** Ledger entries on one departure, with their changes applied. A ride is on every leg's time slot. */
export function entriesOn(store: LedgerStore, departureId: string) {
  return store.entries
    .map((entry) => {
      const change = store.changes[entry.id]
      if (!change) return entry
      if (change.cancelled) return null
      return {
        ...entry,
        departureId: change.movedTo?.departureId ?? entry.departureId,
        startsAt: change.movedTo?.startsAt ?? entry.startsAt,
        party: change.party ?? entry.party,
        ...(change.transfer ? { transfer: change.transfer } : {}),
      }
    })
    .filter((entry): entry is LedgerEntry => entry !== null && (entry.departureId === departureId || laterLegSlots(entry.transfer).includes(departureId)))
}

/** People on an entry: a transfer's passengers (its `party` counts vehicles or seats), else its party. */
export function peopleOfEntry(entry: LedgerEntry): number {
  return entry.transfer ? entry.transfer.passengers : entry.party
}

/** Slots with the ledger applied: fewer seats where it booked, more where it gave back. */
export function withLedger<T extends { departureId: string; seatsLeft: number; capacity: number; soldOut: boolean; status?: string }>(slot: T, delta: Record<string, number>): T {
  const change = delta[slot.departureId]
  if (!change) return slot
  const seatsLeft = Math.max(0, Math.min(slot.capacity, slot.seatsLeft - change))
  return { ...slot, seatsLeft, soldOut: seatsLeft <= 0 || slot.status === 'sold_out' }
}
