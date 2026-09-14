'use server'

import {
  getActivityById,
  getAnalytics,
  getBookingDetail,
  getBookingsByDeparture,
  getCalendarEvents,
  getCustomerById,
  getDepartureById,
  getManifest,
  getResourcesByTenant,
  getStorefrontAvailability,
  getUsersByTenant,
  searchEverything,
  type BookingRow,
  type CalendarEvent,
  type ManifestRow,
} from '@/lib/demo'
import type {
  Activity,
  AnalyticsSnapshot,
  Booking,
  Customer,
  Departure,
  Payment,
  RangePreset,
  Resource,
  User,
} from '@/types'

/**
 * Server Actions — the dashboard's only bridges into `@/lib/demo`'s full
 * dataset from interactive (client) components.
 *
 * A Server Action's body, and everything it imports, runs exclusively on the
 * server; the client receives a small RPC stub. Interactive screens that need
 * data on demand (paging the calendar, opening a departure, changing an
 * analytics range) call these instead of importing the module — which is what
 * keeps the multi-thousand-row generation out of every client bundle.
 *
 * Everything returned is plain data (React Flight serialises Dates and
 * de-duplicates repeated object references), so a page of calendar events
 * carries each Activity once, not once per departure.
 */

export async function fetchCalendarEvents(tenantId: string, from: Date, to: Date): Promise<CalendarEvent[]> {
  return getCalendarEvents(tenantId, from, to)
}

export interface DepartureDetail {
  departure: Departure
  activity: Activity
  guests: { booking: Booking; customer: Customer }[]
  crew: User[]
  resources: Resource[]
  /** Gross booked value, excluding cancelled and refunded rows. Minor units. */
  gross: number
  /** Cash actually collected, excluding cancelled rows. Minor units. */
  paid: number
}

export async function fetchDepartureDetail(departureId: string): Promise<DepartureDetail | null> {
  const departure = getDepartureById(departureId)
  if (!departure) return null
  const activity = getActivityById(departure.activityId)
  if (!activity) return null

  const guests: DepartureDetail['guests'] = []
  let gross = 0
  let paid = 0
  for (const booking of getBookingsByDeparture(departure.id)) {
    const customer = getCustomerById(booking.customerId)
    if (customer) guests.push({ booking, customer })
    if (booking.status !== 'cancelled') paid += booking.amountPaid
    if (booking.status !== 'cancelled' && booking.status !== 'refunded') gross += booking.total
  }

  const staffIds = new Set(departure.assignedStaffIds)
  const resourceIds = new Set(departure.assignedResourceIds)

  return {
    departure,
    activity,
    guests,
    crew: getUsersByTenant(departure.tenantId).filter((user) => staffIds.has(user.id)),
    resources: getResourcesByTenant(departure.tenantId).filter((r) => resourceIds.has(r.id)),
    gross,
    paid,
  }
}

export async function fetchStorefrontAvailability(activityId: string, days = 45): Promise<CalendarEvent[]> {
  return getStorefrontAvailability(activityId, days)
}

export async function searchCustomers(tenantId: string, query: string): Promise<Customer[]> {
  return searchEverything(tenantId, query).customers
}

export async function fetchManifest(tenantId: string, day: Date): Promise<ManifestRow[]> {
  return getManifest(tenantId, day)
}

export async function fetchAnalytics(tenantId: string, preset: RangePreset): Promise<AnalyticsSnapshot> {
  return getAnalytics(tenantId, preset)
}

export type BookingDetailData = BookingRow & { payments: Payment[] }

export async function fetchBookingDetail(bookingId: string): Promise<BookingDetailData | null> {
  return getBookingDetail(bookingId) ?? null
}
