import { getWorkspaceProfile } from '@/lib/workspace-profile'
import type { Tenant } from '@/types'

import { getDiningCounts, getLiveOrders } from './dining'
import { getLodgingCounts } from './lodging'

export * from './types'
export { getMenu, getMenuItem } from './menu'
export { getFloor, getDiningSettings, seatingTimes, turnMinutesFor, hm, mh } from './floor'
export { getDining, getReservationsForDay, getLiveOrders, getDiningCounts } from './dining'
export { getLodging, getLodgingCounts, availableRooms } from './lodging'
export { LODGING_SETTINGS, RATE_PLANS, nightlyRate, seasonMultiplier, nightKeys, quoteStay } from './lodging-settings'

/* ==========================================================================
   Hospitality — the sidebar counts for a restaurant or hotel workspace.
   Zero for a business that has neither module, so the layout can ask
   without checking first.
   ========================================================================== */

export interface HospitalityCounts {
  reservationsToday: number
  liveOrders: number
  arrivalsToday: number
  roomsToClean: number
}

export function getHospitalityCounts(tenant: Tenant): HospitalityCounts {
  const profile = getWorkspaceProfile(tenant.vertical)
  const counts: HospitalityCounts = { reservationsToday: 0, liveOrders: 0, arrivalsToday: 0, roomsToClean: 0 }
  if (profile.modules.dining) {
    const dining = getDiningCounts(tenant)
    counts.reservationsToday = dining.reservationsToday
    counts.liveOrders = getLiveOrders(tenant).length
  }
  if (profile.modules.lodging) {
    const lodging = getLodgingCounts(tenant)
    counts.arrivalsToday = lodging.arrivalsToday
    counts.roomsToClean = lodging.roomsToClean
  }
  return counts
}
