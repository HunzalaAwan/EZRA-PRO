import type { Customer } from '@/types'

/* ==========================================================================
   Plain helpers shared by the hospitality screens — no 'use client', so a
   server component can call them too.
   ========================================================================== */

export function guestName(customer: Pick<Customer, 'firstName' | 'lastName'>) {
  return `${customer.firstName} ${customer.lastName}`.trim()
}

/** "19:30" from a local ISO datetime. */
export function clock(iso: string) {
  return iso.slice(11, 16)
}

/** Minutes between two local ISO datetimes. */
export function minutesBetween(fromIso: string, toIso: string) {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60_000)
}

/** "12 min", "1 h 05". */
export function shortDuration(minutes: number) {
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, '0')}`
}
