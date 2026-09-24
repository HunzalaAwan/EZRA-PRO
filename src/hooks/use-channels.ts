'use client'

import * as React from 'react'

import { defaultChannels, type ChannelSettings } from '@/lib/channels'

/* ==========================================================================
   Domains and numbers for one business, kept in the browser for the demo.
   Every screen that shows a sender, a link or a number reads it from here,
   and hears about changes made on another screen or in another tab.
   ========================================================================== */

const keyFor = (slug: string) => `ezra:channels:${slug}`
const EVENT = 'ezra:channels'

type TenantLike = Parameters<typeof defaultChannels>[0]

function read(tenant: TenantLike): ChannelSettings {
  const base = defaultChannels(tenant)
  try {
    const raw = window.localStorage.getItem(keyFor(tenant.slug))
    if (!raw) return base
    const saved = JSON.parse(raw) as Partial<ChannelSettings>
    return {
      email: { ...base.email, ...saved.email },
      storefront: { ...base.storefront, ...saved.storefront },
      phone: {
        ...base.phone,
        ...saved.phone,
        own: { ...base.phone.own, ...saved.phone?.own },
        hours: { ...base.phone.hours, ...saved.phone?.hours },
        registration: { ...base.phone.registration, ...saved.phone?.registration },
      },
    }
  } catch {
    return base
  }
}

export function useChannels(tenant: TenantLike) {
  const [settings, setSettings] = React.useState<ChannelSettings>(() => defaultChannels(tenant))
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    setSettings(read(tenant))
    setReady(true)
    const sync = () => setSettings(read(tenant))
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.slug])

  const save = React.useCallback(
    (next: ChannelSettings | ((current: ChannelSettings) => ChannelSettings)) =>
      setSettings((current) => {
        const value = typeof next === 'function' ? next(current) : next
        try {
          window.localStorage.setItem(keyFor(tenant.slug), JSON.stringify(value))
          window.setTimeout(() => window.dispatchEvent(new Event(EVENT)), 0)
        } catch {
          /* storage blocked: lives until reload */
        }
        return value
      }),
    [tenant.slug],
  )

  return { settings, save, ready }
}
