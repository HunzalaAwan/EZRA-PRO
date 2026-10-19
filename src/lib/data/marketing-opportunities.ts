import { DEPARTURES, getActivitiesByTenant, getBookingRows, getCustomersByTenant } from '@/lib/demo'
import { recipeById } from '@/lib/flows/recipes'
import type { Tenant } from '@/types'

/* ==========================================================================
   Opportunities right now — worked out on the server from the bookings,
   start times, guests and reviews as they stand, for the marketing overview.
   Each one points at the recipe that deals with it. Plain data only, so it
   crosses to the browser as is.
   ========================================================================== */

const DAY = 86_400_000

/** How far each look reaches. Kept in step with the recipes' own defaults. */
export const OPPORTUNITY_WINDOWS = {
  /** Start times (trips or visits) in the next week below this share full. */
  fillDays: 7,
  fillBelow: 0.5,
  /** Guests who have not booked in this many days. */
  lapsedDays: 120,
  /** Trips in the next few days with waivers still to sign. */
  waiverDays: 3,
  /** 4 and 5 star reviews from trips that ended in this many days. */
  reviewDays: 14,
} as const

export interface OpportunityRecipe {
  id: string
  name: string
}

export interface MarketingOpportunities {
  underFilled: {
    /** Trips or visits (start times) under half full in the next week. */
    count: number
    /** Seats still open across them. */
    emptySeats: number
    top: { id: string; activityName: string; startsAt: string; booked: number; capacity: number }[]
    recipe: OpportunityRecipe
  }
  lapsed: {
    /** Opted-in guests with no booking in 120 days or more. */
    count: number
    /** The ones away longest, as examples. */
    top: { id: string; name: string; lastBookingAt: string }[]
    recipe: OpportunityRecipe
  }
  waivers: {
    /** Bookings starting in the next 3 days with at least one waiver unsigned. */
    bookings: number
    /** Signatures still missing on those bookings (one per booking when the booker signs for everyone). */
    guests: number
    top: { reference: string; guestName: string; activityName: string; startsAt: string; missing: number }[]
    recipe: OpportunityRecipe
  }
  reviews: {
    /** 4 and 5 star reviews from trips that ended in the last 14 days. */
    count: number
    fiveStar: number
    top: { reference: string; guestName: string; activityName: string; rating: number; endsAt: string }[]
    recipe: OpportunityRecipe
  }
}

function recipe(id: string): OpportunityRecipe {
  return { id, name: recipeById(id)?.name ?? id }
}

const standing = (status: string) => status !== 'cancelled' && status !== 'refunded' && status !== 'no_show'

/** `nowIso` is the demo clock as local ISO (no zone), the same shape departures carry. */
export function getMarketingOpportunities(tenant: Pick<Tenant, 'id'>, nowIso: string): MarketingOpportunities {
  const nowMs = new Date(nowIso).getTime()
  const activities = getActivitiesByTenant(tenant.id)
  const activityById = new Map(activities.map((activity) => [activity.id, activity]))

  /* ---- start times under half full in the next week ---- */
  const fillUntil = nowMs + OPPORTUNITY_WINDOWS.fillDays * DAY
  const thin: MarketingOpportunities['underFilled']['top'] = []
  let emptySeats = 0
  for (const departure of DEPARTURES) {
    if (departure.tenantId !== tenant.id) continue
    if (departure.status !== 'scheduled' && departure.status !== 'confirmed') continue
    if (departure.capacity <= 0) continue
    const startMs = new Date(departure.startsAt).getTime()
    if (startMs <= nowMs || startMs > fillUntil) continue
    if (departure.booked / departure.capacity >= OPPORTUNITY_WINDOWS.fillBelow) continue
    const activity = activityById.get(departure.activityId)
    if (!activity || activity.status === 'archived') continue
    emptySeats += Math.max(0, departure.capacity - departure.booked)
    thin.push({ id: departure.id, activityName: activity.name, startsAt: departure.startsAt, booked: departure.booked, capacity: departure.capacity })
  }
  // The emptiest first; the sooner one when two are as empty.
  thin.sort((a, b) => b.capacity - b.booked - (a.capacity - a.booked) || a.startsAt.localeCompare(b.startsAt))

  /* ---- guests who have not been back ---- */
  const lapsedBefore = nowMs - OPPORTUNITY_WINDOWS.lapsedDays * DAY
  const away: MarketingOpportunities['lapsed']['top'] = []
  for (const customer of getCustomersByTenant(tenant.id)) {
    if (!customer.marketingOptIn || !customer.lastBookingAt) continue
    if (new Date(customer.lastBookingAt).getTime() <= lapsedBefore) {
      away.push({ id: customer.id, name: `${customer.firstName} ${customer.lastName}`.trim(), lastBookingAt: customer.lastBookingAt })
    }
  }
  away.sort((a, b) => a.lastBookingAt.localeCompare(b.lastBookingAt))

  /* ---- waivers and reviews, from the bookings ---- */
  const waiverUntil = nowMs + OPPORTUNITY_WINDOWS.waiverDays * DAY
  const reviewSince = nowMs - OPPORTUNITY_WINDOWS.reviewDays * DAY
  const unsigned: MarketingOpportunities['waivers']['top'] = []
  let unsignedGuests = 0
  const reviews: MarketingOpportunities['reviews']['top'] = []
  for (const { booking, activity, customer, departure } of getBookingRows(tenant.id)) {
    const startMs = new Date(departure.startsAt).getTime()
    const guestName = `${customer.firstName} ${customer.lastName}`.trim()
    // Only trips that ask for a waiver. The rule matches the Waiver chaser: any guest on the booking unsigned.
    if (activity.waiverId && standing(booking.status) && startMs > nowMs && startMs <= waiverUntil) {
      const unsignedCount = booking.participants.filter((participant) => !participant.waiverSigned).length
      // When the booker signs for everyone, one signature settles the booking.
      const missing = unsignedCount > 0 && activity.waiverSigning !== 'each' ? 1 : unsignedCount
      if (missing > 0) {
        unsignedGuests += missing
        unsigned.push({ reference: booking.reference, guestName, activityName: activity.name, startsAt: departure.startsAt, missing })
      }
    }
    if (booking.rating !== undefined && booking.rating >= 4) {
      const endMs = new Date(departure.endsAt).getTime()
      if (endMs <= nowMs && endMs > reviewSince) {
        reviews.push({ reference: booking.reference, guestName, activityName: activity.name, rating: booking.rating, endsAt: departure.endsAt })
      }
    }
  }
  unsigned.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || b.missing - a.missing)
  reviews.sort((a, b) => b.endsAt.localeCompare(a.endsAt))

  return {
    underFilled: { count: thin.length, emptySeats, top: thin.slice(0, 3), recipe: recipe('fill-empty-seats') },
    lapsed: { count: away.length, top: away.slice(0, 3), recipe: recipe('win-back') },
    waivers: { bookings: unsigned.length, guests: unsignedGuests, top: unsigned.slice(0, 3), recipe: recipe('waiver-chaser') },
    reviews: { count: reviews.length, fiveStar: reviews.filter((entry) => entry.rating === 5).length, top: reviews.slice(0, 3), recipe: recipe('thank-happy-reviewers') },
  }
}
