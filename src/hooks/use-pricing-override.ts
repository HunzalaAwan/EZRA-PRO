'use client'

import * as React from 'react'

import {
  ACTIVITY_OVERRIDES_EVENT,
  applyPricingOverride,
  parseActivityOverrides,
  readActivityOverridesRaw,
  type ActivityOverride,
} from '@/lib/activity-overrides'
import type { Activity } from '@/types'

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(ACTIVITY_OVERRIDES_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(ACTIVITY_OVERRIDES_EVENT, onChange)
  }
}

/** Every saved activity edit, by activity id. Empty on the server and before hydration. */
export function useActivityOverrides(): Record<string, ActivityOverride> {
  const raw = React.useSyncExternalStore(subscribe, readActivityOverridesRaw, () => '')
  return React.useMemo(() => parseActivityOverrides(raw), [raw])
}

/**
 * The activity with the prices saved in the editor laid over it (tier and
 * extra prices, rates, group and private prices, minimum charge, its own
 * price changes). Ids stay the seeded ones, so checkout links keep working.
 */
export function usePricingOverride<T extends Activity>(activity: T): T {
  const overrides = useActivityOverrides()
  const override = overrides[activity.id]
  return React.useMemo(() => applyPricingOverride(activity, override), [activity, override])
}
