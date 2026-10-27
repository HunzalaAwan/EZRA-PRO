import type { AddOn, PriceTier } from '@/types'

/* ==========================================================================
   Places per ticket — shared by the storefront widget, checkout (server)
   and the seat counts. Browser- and server-safe.
   ========================================================================== */

/** Places one ticket takes on the departure: 0 for a ticket that takes none. */
export const placesOf = (tier: Pick<PriceTier, 'countsTowardCapacity' | 'seats'>) => (tier.countsTowardCapacity ? Math.max(1, tier.seats ?? 1) : 0)

/** People one ticket is for. */
export const peopleOf = (tier: Pick<PriceTier, 'seats'>) => Math.max(1, tier.seats ?? 1)

/** The most of an 'each' extra one booking can take. */
const eachMost = (addOn: Pick<AddOn, 'maxQty'>) => (typeof addOn.maxQty === 'number' && Number.isFinite(addOn.maxQty) && addOn.maxQty >= 0 ? Math.floor(addOn.maxQty) : 9)

/**
 * How many of an extra a booking takes: one for each guest, one for the
 * booking, or ('each') as many as the guest picks (`chosen`, default 1), up to `maxQty`.
 */
export const addOnUnits = (addOn: Pick<AddOn, 'per' | 'maxQty'>, guests: number, chosen?: number) => {
  if (addOn.per === 'each') {
    const picked = typeof chosen === 'number' && Number.isFinite(chosen) ? Math.floor(chosen) : 1
    return Math.min(eachMost(addOn), Math.max(0, picked))
  }
  return addOn.per === 'booking' ? 1 : Math.max(1, guests)
}

/** "per guest", "per booking", "each". */
export const addOnPer = (addOn: Pick<AddOn, 'per'>) => (addOn.per === 'each' ? 'each' : addOn.per === 'booking' ? 'per booking' : 'per guest')
