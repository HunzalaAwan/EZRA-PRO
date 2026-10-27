'use server'

import { getActivityById } from '@/lib/demo'
import { buildTransferAvailability } from '@/lib/storefront-availability'
import type { TransferHold } from '@/lib/transfers'

/**
 * A transfer's seeded rides as vehicle holds, for screens that change a ride
 * in the browser (the booking's Edit ride) and need to know which vehicles
 * are out. Empty for anything that is not a transfer.
 */
export async function fetchTransferHolds(activityId: string): Promise<TransferHold[]> {
  if (typeof activityId !== 'string') return []
  const activity = getActivityById(activityId)
  if (!activity || activity.kind !== 'transfer') return []
  return buildTransferAvailability(activity).holds
}
