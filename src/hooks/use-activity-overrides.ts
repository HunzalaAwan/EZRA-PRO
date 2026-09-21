'use client'

import * as React from 'react'

import {
  ACTIVITY_OVERRIDES_EVENT,
  applyActivityOverride,
  parseActivityOverrides,
  readActivityOverridesRaw,
} from '@/lib/activity-overrides'
import type { Activity } from '@/types'

/** The activity as last saved in the editor, or the seeded one when nothing was edited. */
export function useActivityOverride<T extends Activity>(activity: T): T {
  const subscribe = React.useCallback((onChange: () => void) => {
    window.addEventListener('storage', onChange)
    window.addEventListener(ACTIVITY_OVERRIDES_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(ACTIVITY_OVERRIDES_EVENT, onChange)
    }
  }, [])

  const raw = React.useSyncExternalStore(subscribe, readActivityOverridesRaw, () => '')

  return React.useMemo(() => {
    const override = parseActivityOverrides(raw)[activity.id]
    return applyActivityOverride(activity, override)
  }, [activity, raw])
}
