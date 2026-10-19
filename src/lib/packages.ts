import type { AvailabilityDay, AvailabilitySlot } from '@/components/storefront/booking-widget'

/* ==========================================================================
   Packages — the parts of a package as the storefront sees them, and the
   one rule that keeps them bookable: every part has room for the group, and
   no part starts before the one before it has finished plus the gap.
   Browser-safe.
   ========================================================================== */

export interface PackagePartView {
  activityId: string
  slug: string
  name: string
  /** What guests see: the part's own label or the activity's name. */
  label: string
  durationMinutes: number
  meetingPoint: string
  /** What the part costs booked on its own, per person. */
  basePrice: number
  /** The times guests can pick, "HH:mm". Empty: any. */
  times: string[]
  /** The part's own availability, only at the times the package allows. */
  days: AvailabilityDay[]
}

export const timeOf = (iso: string) => iso.slice(11, 16)

const ms = (iso: string) => new Date(iso).getTime()

/** True when two picked slots do not overlap, with the gap between them. */
export function apart(a: Pick<AvailabilitySlot, 'startsAt' | 'endsAt'>, b: Pick<AvailabilitySlot, 'startsAt' | 'endsAt'>, gapMinutes: number) {
  const gap = gapMinutes * 60_000
  return ms(a.endsAt) + gap <= ms(b.startsAt) || ms(b.endsAt) + gap <= ms(a.startsAt)
}

/** Every picked slot is clear of every other one. */
export function fits(slots: Pick<AvailabilitySlot, 'startsAt' | 'endsAt'>[], gapMinutes: number) {
  for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) if (!apart(slots[i], slots[j], gapMinutes)) return false
  return true
}

/** The open slots of one part on a day, with room for the group. */
export function openSlots(part: PackagePartView, dateKey: string, party: number): AvailabilitySlot[] {
  return (part.days.find((day) => day.dateKey === dateKey)?.slots ?? []).filter((slot) => !slot.soldOut && slot.seatsLeft >= party)
}

/**
 * The first combination that works, one slot per part, every part on the
 * dates given. Parts are tried in order, earliest times first.
 */
export function firstCombo(parts: PackagePartView[], dateKeys: string[], party: number, gapMinutes: number): AvailabilitySlot[] | null {
  const pick = (index: number, chosen: AvailabilitySlot[]): AvailabilitySlot[] | null => {
    if (index === parts.length) return chosen
    for (const slot of openSlots(parts[index], dateKeys[index], party)) {
      if (!fits([...chosen, slot], gapMinutes)) continue
      const found = pick(index + 1, [...chosen, slot])
      if (found) return found
    }
    return null
  }
  return pick(0, [])
}

/** "11:00 AM" from a local ISO. */
export function clock(iso: string) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso))
}

/** A local ISO plus some minutes, still local. */
export function addMinutesIso(iso: string, minutes: number) {
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() + minutes)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

/**
 * A package on its own schedule: the parts run back to back from the
 * package's start, with the gap between them. Offsets in minutes; with a
 * start time, the clock times too.
 */
export function itinerary<T extends { label: string; durationMinutes: number }>(parts: T[], gapMinutes: number, startIso?: string) {
  let offset = 0
  return parts.map((part) => {
    const at = offset
    offset += part.durationMinutes + gapMinutes
    return {
      ...part,
      offset: at,
      ...(startIso ? { startsAt: addMinutesIso(startIso, at), endsAt: addMinutesIso(startIso, at + part.durationMinutes) } : {}),
    }
  })
}

/** "+1h 30m" from the start. */
export function offsetLabel(minutes: number) {
  if (minutes === 0) return 'At the start'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `+${h ? `${h}h` : ''}${h && m ? ' ' : ''}${m ? `${m}m` : ''}`
}
