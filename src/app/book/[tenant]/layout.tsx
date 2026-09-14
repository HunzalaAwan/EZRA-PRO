import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { TENANTS, getStorefront } from '@/lib/demo'
import type { Tenant } from '@/types'
import { StorefrontFooter } from '@/components/storefront/storefront-footer'
import { StorefrontHeader } from '@/components/storefront/storefront-header'

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
  const description = `Book ${activities.length} guided experiences with ${tenant.name} in ${tenant.city}. Live availability, instant confirmation and free cancellation.`

  return {
    title: { absolute: `${tenant.name} — Book online` },
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
   COLOUR MATHS
   Hex in, WCAG-aware token set out. If a tenant ships an unparseable colour we
   simply emit nothing and the default EZRA tokens stay in force.
   ========================================================================== */

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i

function parseHex(value: string | undefined): string | null {
  if (!value) return null
  const match = HEX.exec(value.trim())
  if (!match) return null
  const body = match[1]
  const full =
    body.length === 3
      ? body
          .split('')
          .map((c) => c + c)
          .join('')
      : body
  return `#${full.toLowerCase()}`
}

function srgbChannel(value: number) {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG relative luminance, 0 (black) → 1 (white). */
function luminance(hex: string) {
  const r = srgbChannel(parseInt(hex.slice(1, 3), 16))
  const g = srgbChannel(parseInt(hex.slice(3, 5), 16))
  const b = srgbChannel(parseInt(hex.slice(5, 7), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: number, b: number) {
  const hi = Math.max(a, b)
  const lo = Math.min(a, b)
  return (hi + 0.05) / (lo + 0.05)
}

/** Ink that is legible on top of `hex` — white or deep-sea, whichever wins. */
function readableOn(hex: string) {
  const l = luminance(hex)
  const ink = '#0b1417'
  return contrast(l, 1) >= contrast(l, luminance(ink)) ? '#ffffff' : ink
}

function brandTokens(tenant: Tenant) {
  const primary = parseHex(tenant.branding.primaryColor)
  const accent = parseHex(tenant.branding.accentColor)
  if (!primary && !accent) return null

  const scope = `[data-storefront="${tenant.slug}"]`
  const light: string[] = []
  const dark: string[] = []

  if (primary) {
    light.push(
      `--brand-primary:${primary}`,
      `--primary:${primary}`,
      `--primary-hover:color-mix(in oklab, ${primary} 82%, #000)`,
      `--primary-soft:color-mix(in oklab, ${primary} 11%, var(--surface))`,
      `--on-primary:${readableOn(primary)}`,
    )
    // Dark mode needs the hue lifted off the background or `text-primary` dies.
    dark.push(
      `--primary:color-mix(in oklab, ${primary} 46%, #fff)`,
      `--primary-hover:color-mix(in oklab, ${primary} 28%, #fff)`,
      `--primary-soft:color-mix(in oklab, ${primary} 46%, var(--surface))`,
      `--on-primary:#0b1417`,
    )
  }

  if (accent) {
    light.push(
      `--brand-accent:${accent}`,
      `--accent:${accent}`,
      `--accent-hover:color-mix(in oklab, ${accent} 84%, #000)`,
      `--accent-soft:color-mix(in oklab, ${accent} 13%, var(--surface))`,
      `--on-accent:${readableOn(accent)}`,
    )
    dark.push(
      `--accent:color-mix(in oklab, ${accent} 74%, #fff)`,
      `--accent-hover:color-mix(in oklab, ${accent} 58%, #fff)`,
      `--accent-soft:color-mix(in oklab, ${accent} 42%, var(--surface))`,
      `--on-accent:#0b1417`,
    )
  }

  /*
   * Four rules, not two. Radix portals (the lightbox, the mobile booking sheet,
   * every menu) mount on <body>, *outside* the storefront wrapper — so the
   * tokens are also hoisted to :root whenever a storefront is on the page.
   * The rules are emitted separately because an unsupported `:has()` would
   * invalidate an entire selector list, taking the wrapper rule down with it.
   */
  const rules = [`${scope}{${light.join(';')}}`, `:root:has(${scope}){${light.join(';')}}`]
  if (dark.length > 0) {
    rules.push(`.dark ${scope}{${dark.join(';')}}`, `:root.dark:has(${scope}){${dark.join(';')}}`)
  }
  return rules.join('')
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
  const tokens = brandTokens(tenant)

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

      <a
        href="#storefront-main"
        className="sr-only left-4 top-4 z-[70] rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary focus:not-sr-only focus:absolute"
      >
        Skip to content
      </a>

      <StorefrontHeader tenant={tenant} />

      <main id="storefront-main" className="flex-1">
        {children}
      </main>

      <StorefrontFooter tenant={tenant} />
    </div>
  )
}
