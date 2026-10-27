'use client'

import * as React from 'react'

import { usePickupZones } from '@/hooks/use-pickup-zones'
import { transportOf } from '@/lib/transport'
import type { Activity, PickupZone } from '@/types'

const NO_ZONES: PickupZone[] = []

/**
 * Transport on an activity as it is sold (storefront, checkout, the manage
 * page, requests and the walk-in desk): the setup kept to the pickup zones
 * still served (the business's live edits), and those zones.
 */
export function useTransport(activity: Pick<Activity, 'kind' | 'pickup' | 'tenantId'> | undefined, zones: PickupZone[] = NO_ZONES) {
  const live = usePickupZones(activity?.tenantId ?? '', zones).zones
  const ids = activity?.pickup?.zoneIds
  const served = React.useMemo(() => live.filter((zone) => zone.active && (ids ?? []).includes(zone.id)), [live, ids])
  const kind = activity?.kind
  const pickup = activity?.pickup
  const setup = React.useMemo(
    () => (!pickup || kind === 'transfer' ? undefined : transportOf({ ...pickup, zoneIds: pickup.zoneIds.filter((id) => served.some((zone) => zone.id === id)) })),
    [kind, pickup, served],
  )
  return { setup, zones: served }
}
