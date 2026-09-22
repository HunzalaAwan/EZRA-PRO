import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { TENANTS, getStorefront } from '@/lib/demo'
import { getWorkspaceProfile } from '@/lib/workspace-profile'
import type { Tenant } from '@/types'
import { StorefrontFooter } from '@/components/storefront/storefront-footer'
import { StorefrontHeader } from '@/components/storefront/storefront-header'
import { StorefrontBrandOverrides } from '@/components/storefront/storefront-brand'
import { brandTokenCss } from '@/lib/brand-colors'

/* ==========================================================================
   MULTI-TENANT STOREFRONT SHELL

   One route tree renders four completely different businesses. Everything that
   differs between them — name, currency, timezone, contact details, palette —
   is read from the Tenant record, never hard-coded.

   Branding is applied by *re-pointing the semantic tokens* on a scoped wrapper:
   every `bg-primary`, `text-accent`, `ring-primary` inside the storefront picks
   up the operator's colours without a single component knowing about tenants.
   ========================================================================== */

interface TenantParams {
  tenant: string
}

export function generateStaticParams() {
  return TENANTS.map((tenant) => ({ tenant: tenant.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<TenantParams>
}): Promise<Metadata> {
  const { tenant: slug } = await params
  const storefront = getStorefront(slug)

  if (!storefront) {
    return { title: { absolute: 'Storefront not found' } }
  }

  const { tenant, activities } = storefront
  const kind = getWorkspaceProfile(tenant.vertical).storefront
  const description =
    kind === 'restaurant'
      ? `${tenant.name} in ${tenant.city}: reserve a table, order for pickup or delivery, and book the tasting menu. Live availability and instant confirmation.`
      : kind === 'hotel'
        ? `${tenant.name} in ${tenant.city}: rooms, the restaurant and experiences, booked direct with instant confirmation and the best rate.`
        : `Book ${activities.length} guided experiences with ${tenant.name} in ${tenant.city}. Live availability, instant confirmation and free cancellation.`

  return {
    title: { absolute: kind === 'restaurant' ? `${tenant.name} — Reserve & order` : kind === 'hotel' ? `${tenant.name} — Book a stay` : `${tenant.name} — Book online` },
    description,
    applicationName: tenant.name,
    keywords: [tenant.name, tenant.city, tenant.vertical, 'book online', 'tickets', 'tours'],
    openGraph: {
      type: 'website',
      siteName: tenant.name,
      title: `${tenant.name} — Book online`,
      description,
      locale: tenant.locale.replace('-', '_'),
      images: tenant.branding.coverImage
        ? [{ url: tenant.branding.coverImage, alt: `${tenant.name} in ${tenant.city}` }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${tenant.name} — Book online`,
      description,
    },
    alternates: { canonical: `/book/${tenant.slug}` },
  }
}


/* ==========================================================================
   LAYOUT
   ========================================================================== */

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<TenantParams>
}) {
  const { tenant: slug } = await params
  const storefront = getStorefront(slug)
  if (!storefront) notFound()

  const { tenant } = storefront
  const tokens = brandTokenCss(tenant.slug, tenant.branding.primaryColor, tenant.branding.accentColor)

  return (
    <div
      data-storefront={tenant.slug}
      className="relative isolate flex min-h-dvh flex-col bg-background text-foreground"
    >
      {tokens ? (
        <style href={`ezra-brand-${tenant.slug}`} precedence="high">
          {tokens}
        </style>
      ) : null}
      <StorefrontBrandOverrides tenant={tenant} />

      <a
        href="#storefront-main"
        className="sr-only left-4 top-4 z-[70] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary focus:not-sr-only focus:absolute"
      >
        Skip to content
      </a>

      <StorefrontHeader tenant={tenant} kind={getWorkspaceProfile(tenant.vertical).storefront} />

      <main id="storefront-main" className="flex-1">
        {children}
      </main>

      <StorefrontFooter tenant={tenant} />
    </div>
  )
}
