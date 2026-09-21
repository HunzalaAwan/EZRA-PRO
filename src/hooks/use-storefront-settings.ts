'use client'

import * as React from 'react'

import {
  STOREFRONT_SETTINGS_EVENT,
  defaultStorefrontSettings,
  mergeStorefrontSettings,
  readStorefrontSettingsRaw,
  writeStorefrontSettings,
  type StorefrontSettings,
} from '@/lib/storefront-settings'
import type { VerticalKey } from '@/types'

/* ==========================================================================
   useStorefrontSettings — the operator's storefront settings, live.

   Backed by `useSyncExternalStore` over localStorage: the server renders the
   trade's defaults, the client swaps in the saved settings after hydration
   without a mismatch, and any change made in another tab (the dashboard,
   say) arrives through the `storage` event.
   ========================================================================== */

export function useStorefrontSettings(slug: string, vertical: VerticalKey) {
  const defaults = React.useMemo(() => defaultStorefrontSettings(vertical), [vertical])

  const subscribe = React.useCallback((onChange: () => void) => {
    window.addEventListener('storage', onChange)
    window.addEventListener(STOREFRONT_SETTINGS_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(STOREFRONT_SETTINGS_EVENT, onChange)
    }
  }, [])

  const raw = React.useSyncExternalStore(
    subscribe,
    () => readStorefrontSettingsRaw(slug),
    () => '',
  )

  const settings = React.useMemo(() => mergeStorefrontSettings(defaults, raw), [defaults, raw])

  const update = React.useCallback(
    (patch: Partial<StorefrontSettings> | ((current: StorefrontSettings) => StorefrontSettings)) => {
      const next = typeof patch === 'function' ? patch(settings) : { ...settings, ...patch }
      writeStorefrontSettings(slug, next)
    },
    [settings, slug],
  )

  const reset = React.useCallback(() => writeStorefrontSettings(slug, null), [slug])

  return { settings, update, reset, isDefault: raw === '' }
}
