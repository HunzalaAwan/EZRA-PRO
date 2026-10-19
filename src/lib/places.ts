import type { AddOn, PriceTier } from '@/types'

/* ==========================================================================
   Places per ticket — shared by the storefront widget, checkout (server)
   and the seat counts. Browser- and server-safe.
   ========================================================================== */

/** Places one ticket takes on the departure: 0 for a ticket that takes none. */
export const placesOf = (tier: Pick<PriceTier, 'countsTowardCapacity' | 'seats'>) => (tier.countsTowardCapacity ? Math.max(1, tier.seats ?? 1) : 0)

/** People one ticket is for. */
export const peopleOf = (tier: Pick<PriceTier, 'seats'>) => Math.max(1, tier.seats ?? 1)

/** How many of an extra a booking takes: one for each guest, or one for the booking. */
export const addOnUnits = (addOn: Pick<AddOn, 'per'>, guests: number) => (addOn.per === 'booking' ? 1 : Math.max(1, guests))

/** "per guest", "per booking". */
export const addOnPer = (addOn: Pick<AddOn, 'per'>) => (addOn.per === 'booking' ? 'per booking' : 'per guest')
