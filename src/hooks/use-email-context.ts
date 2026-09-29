'use client'

import * as React from 'react'

import { useChannels } from '@/hooks/use-channels'
import { storefrontHost } from '@/lib/channels'
import type { EmailActivity, EmailContext } from '@/lib/email-design'
import type { Tenant } from '@/types'

/* ==========================================================================
   What the email designer and previews need about the business: its name,
   address, trips (with photos and prices), its storefront address and the
   sample guest's placeholders.
   ========================================================================== */

export function useEmailContext(tenant: Tenant, activities: EmailActivity[], vars: EmailContext['vars']): EmailContext {
  const { settings: channels } = useChannels(tenant)
  const host = storefrontHost(channels, tenant.slug)
  const key = JSON.stringify(vars)
  return React.useMemo(
    () => ({
      vars: { business: tenant.name, book_link: host, ...vars },
      business: tenant.name,
      logoText: tenant.name,
      address: tenant.contact.addressLine,
      activities,
      storefrontUrl: `https://${host}`,
    }),
    // vars is compared by value so a fresh object each render does not rebuild every preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tenant.name, tenant.branding.logoText, tenant.contact.addressLine, activities, host, key],
  )
}

/** The business's own colours, first in the designer's swatches. */
export function brandColors(tenant: Tenant): string[] {
  return [tenant.branding.primaryColor, tenant.branding.accentColor].filter((color) => /^#[0-9a-f]{6}$/i.test(color))
}
