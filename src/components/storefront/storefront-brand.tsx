'use client'

import * as React from 'react'

import { useStorefrontSettings } from '@/hooks/use-storefront-settings'
import { brandTokenCss } from '@/lib/brand-colors'
import { resolveBrand, type ResolvedBrand } from '@/lib/storefront-settings'
import type { Tenant } from '@/types'

/* ==========================================================================
   The operator's look, live.

   The Storefront page in the dashboard writes colours, wordmark, logo, cover
   and hero copy into the storefront settings; the public site reads them
   here and lays them over the tenant record. Colours re-point the same
   semantic tokens the shell sets on the server, one precedence later, so
   every `bg-primary` and `text-accent` follows without a component knowing.
   ========================================================================== */

export function useStorefrontBrand(tenant: Tenant): ResolvedBrand {
  const { settings } = useStorefrontSettings(tenant.slug, tenant.vertical)
  return React.useMemo(() => resolveBrand(tenant, settings.brand), [tenant, settings.brand])
}

/** Re-themes the storefront when the operator has picked colours that differ from the published ones. */
export function StorefrontBrandOverrides({ tenant }: { tenant: Tenant }) {
  const brand = useStorefrontBrand(tenant)
  if (!brand.recoloured) return null
  const css = brandTokenCss(tenant.slug, brand.primaryColor, brand.accentColor)
  if (!css) return null
  return (
    <style href={`ezra-brand-live-${tenant.slug}`} precedence="higher">
      {css}
    </style>
  )
}

/** Hosts `next/image` is allowed to optimise; anything else (uploads, other CDNs) renders as is. */
export function imageIsOptimisable(src: string | undefined) {
  return !!src && /^https:\/\/(images\.unsplash\.com|images\.pexels\.com|i\.pravatar\.cc)\//.test(src)
}
