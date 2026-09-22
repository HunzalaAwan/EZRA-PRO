import { getWorkspaceProfile } from '@/lib/workspace-profile'
import type { Tenant } from '@/types'

import { getLiveOrders } from './dining'
import { getLodgingCounts } from './lodging'

export * from './types'
export { getMenu, getMenuItem } from './menu'
export { getDiningSettings, hm, mh, windowOpen } from './hours'
export { getDining, getLiveOrders, getDiningCounts } from './dining'
export { getLodging, getLodgingCounts, availableRooms } from './lodging'
export { LODGING_SETTINGS, RATE_PLANS, nightlyRate, seasonMultiplier, nightKeys, quoteStay } from './lodging-settings'

/* ==========================================================================
   Hospitality — the sidebar counts for a restaurant or hotel workspace.
   Zero for a business that has neither module, so the layout can ask
   without checking first.
   ========================================================================== */

export interface HospitalityCounts {
  liveOrders: number
  arrivalsToday: number
  roomsToClean: number
}

export function getHospitalityCounts(tenant: Tenant): HospitalityCounts {
  const profile = getWorkspaceProfile(tenant.vertical)
  const counts: HospitalityCounts = { liveOrders: 0, arrivalsToday: 0, roomsToClean: 0 }
  if (profile.modules.dining) counts.liveOrders = getLiveOrders(tenant).length
  if (profile.modules.lodging) {
    const lodging = getLodgingCounts(tenant)
    counts.arrivalsToday = lodging.arrivalsToday
    counts.roomsToClean = lodging.roomsToClean
  }
  return counts
}
