import Link from 'next/link'
import { ExternalLink, Mail, MapPin, Phone, ShieldCheck } from 'lucide-react'

import { getStorefront } from '@/lib/demo'
import { SITE } from '@/lib/site-config'
import { cn, initials } from '@/lib/utils'
import type { Tenant } from '@/types'
import { Logo } from '@/components/marketing/logo'
import { Separator } from '@/components/ui/separator'

/* ==========================================================================
   SOCIAL MARKS
   lucide-react dropped its brand glyphs, so these are drawn inline. Each is a
   single path on a 24-grid using `currentColor`, so they inherit the theme.
   ========================================================================== */

const SOCIALS = [
  {
    label: 'Instagram',
    path: 'M12 2.2c3.2 0 3.6 0 4.9.07 1.2.05 1.8.25 2.2.42.6.22 1 .48 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c0 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2 0-1.8-.2-2.2-.4a3.9 3.9 0 0 1-1.4-.9 3.9 3.9 0 0 1-.9-1.4c-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c0-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2Zm0 1.8c-3.1 0-3.5 0-4.8.07-1.1.05-1.7.24-2.1.4-.5.2-.9.44-1.2.78-.35.34-.58.7-.78 1.2-.16.4-.35 1-.4 2.1C2.65 9.85 2.64 10.2 2.64 12s0 2.15.08 3.45c.05 1.1.24 1.7.4 2.1.2.5.43.86.78 1.2.34.34.7.58 1.2.78.4.16 1 .35 2.1.4 1.3.06 1.7.07 4.8.07s3.5 0 4.8-.07c1.1-.05 1.7-.24 2.1-.4.5-.2.86-.44 1.2-.78.35-.34.58-.7.78-1.2.16-.4.35-1 .4-2.1.07-1.3.08-1.65.08-3.45s0-2.15-.08-3.45c-.05-1.1-.24-1.7-.4-2.1a3.2 3.2 0 0 0-.78-1.2 3.2 3.2 0 0 0-1.2-.78c-.4-.16-1-.35-2.1-.4C15.5 4.02 15.1 4 12 4Zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8Zm0 1.8a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Zm5.1-2.4a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z',
  },
  {
    label: 'Facebook',
    path: 'M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.9h2.54V9.85c0-2.52 1.5-3.92 3.77-3.92 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.9h2.78l-.45 2.9h-2.33V22A10 10 0 0 0 22 12.06Z',
  },
  {
    label: 'YouTube',
    path: 'M21.6 7.2a2.5 2.5 0 0 0-1.77-1.77C18.25 5 12 5 12 5s-6.25 0-7.83.43A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.77 1.77C5.75 19 12 19 12 19s6.25 0 7.83-.43a2.5 2.5 0 0 0 1.77-1.77C22 15.2 22 12 22 12s0-3.2-.4-4.8ZM10 15.1V8.9l5.2 3.1-5.2 3.1Z',
  },
  {
    label: 'TikTok',
    path: 'M16.6 2h-3.1v13.1a2.5 2.5 0 1 1-2.2-2.5v-3.1a5.6 5.6 0 1 0 5.3 5.6V8.9a6.4 6.4 0 0 0 3.9 1.3V7.1a3.6 3.6 0 0 1-2.6-1.2 3.6 3.6 0 0 1-1.3-2.6V2Z',
  },
] as const

/* ==========================================================================
   <StorefrontFooter>
   ========================================================================== */

export interface StorefrontFooterProps {
  tenant: Tenant
  className?: string
}

export function StorefrontFooter({ tenant, className }: StorefrontFooterProps) {
  const base = `/book/${tenant.slug}`
  const storefront = getStorefront(tenant.slug)
  const experiences = (storefront?.activities ?? []).slice(0, 6)
  const websiteHost = tenant.contact.website.replace(/^https?:\/\//, '')
  const foundedYear = new Date(tenant.createdAt).getFullYear()

  const policies = [
    { label: 'Booking terms', href: `${base}#about` },
    { label: 'Cancellation policy', href: `${base}#about` },
    { label: 'Privacy', href: `${base}#about` },
    { label: 'Safety & accessibility', href: `${base}#about` },
  ]

  return (
    <footer
      className={cn(
        'relative mt-auto overflow-hidden border-t border-line bg-surface-sunken',
        className,
      )}
    >
      {/* A single brand-tinted wash so the footer reads as part of the operator's
          site rather than a neutral slab bolted on the bottom. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(60%_100%_at_50%_100%,color-mix(in_oklab,var(--primary)_16%,transparent),transparent)]"
      />

      <div className="relative mx-auto w-full max-w-[88rem] px-4 py-14 sm:px-6 lg:px-10 lg:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:gap-8">
          {/* ---------- identity + contact ---------- */}
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="relative grid size-11 place-items-center overflow-hidden rounded-xl bg-[linear-gradient(145deg,var(--primary),color-mix(in_oklab,var(--accent)_72%,var(--primary)))] font-display text-sm font-bold text-on-primary shadow-md"
              >
                <span className="absolute inset-x-0 top-0 h-1/2 bg-white/18" />
                <span className="relative">{initials(tenant.branding.logoText)}</span>
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-semibold tracking-tight text-foreground">
                  {tenant.name}
                </p>
                <p className="text-xs text-subtle">
                  {tenant.legalName} · est. {foundedYear}
                </p>
              </div>
            </div>

            <address className="mt-6 space-y-3 not-italic">
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(tenant.contact.addressLine)}`}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-2.5 text-sm text-muted transition-colors hover:text-foreground"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0">{tenant.contact.addressLine}</span>
              </a>
              <a
                href={`tel:${tenant.contact.phone.replace(/[^+\d]/g, '')}`}
                className="flex items-center gap-2.5 text-sm tabular text-muted transition-colors hover:text-foreground"
              >
                <Phone className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {tenant.contact.phone}
              </a>
              <a
                href={`mailto:${tenant.contact.email}`}
                className="flex items-center gap-2.5 text-sm text-muted transition-colors hover:text-foreground"
              >
                <Mail className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {tenant.contact.email}
              </a>
              <a
                href={tenant.contact.website}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2.5 text-sm text-muted transition-colors hover:text-foreground"
              >
                <ExternalLink className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {websiteHost}
              </a>
            </address>

            <div className="mt-6 flex items-center gap-2">
              {SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href={tenant.contact.website}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${tenant.name} on ${social.label}`}
                  className={cn(
                    'grid size-9 place-items-center rounded-lg border border-line bg-surface text-subtle',
                    'transition-all duration-200 ease-[var(--ease-out-expo)]',
                    'hover:-translate-y-0.5 hover:border-primary/45 hover:text-primary hover:shadow-sm',
                    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-[1.05rem]"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d={social.path} />
                  </svg>
                </a>
              ))}
            </div>
          </div>

          {/* ---------- experiences ---------- */}
          <nav aria-label="Experiences" className="min-w-0">
            <h2 className="font-display text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-faint">
              Experiences
            </h2>
            <ul className="mt-4 space-y-2.5">
              {experiences.map((activity) => (
                <li key={activity.id}>
                  <Link
                    href={`${base}/${activity.slug}`}
                    className="block truncate text-sm text-muted transition-colors hover:text-primary"
                  >
                    {activity.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={`${base}#experiences`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary-hover"
                >
                  See all {storefront?.activities.length ?? 0}
                </Link>
              </li>
            </ul>
          </nav>

          {/* ---------- company ---------- */}
          <nav aria-label="Company" className="min-w-0">
            <h2 className="font-display text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-faint">
              {tenant.branding.logoText}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {[
                { label: 'About us', href: `${base}#about` },
                { label: 'Guest reviews', href: `${base}#reviews` },
                { label: 'Contact & directions', href: `${base}#contact` },
                { label: 'Gift cards', href: `${base}/gift-cards` },
                { label: 'Group & private charters', href: `${base}#contact` },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted transition-colors hover:text-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* ---------- policies ---------- */}
          <nav aria-label="Policies" className="min-w-0">
            <h2 className="font-display text-[0.8125rem] font-semibold uppercase tracking-[0.12em] text-faint">
              Good to know
            </h2>
            <ul className="mt-4 space-y-2.5">
              {policies.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted transition-colors hover:text-primary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-line-subtle bg-surface px-3.5 py-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <p className="text-xs leading-relaxed text-subtle">
                Licensed operator. All bookings are protected and refundable under the policy shown
                at checkout.
              </p>
            </div>
          </nav>
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-subtle">
            © {foundedYear === 2026 ? 2026 : `${foundedYear}–2026`} {tenant.legalName}. All rights
            reserved. Prices in {tenant.currency}. Times shown in {tenant.timezone.split('/').pop()?.replace(/_/g, ' ')}.
          </p>

          {/* The one place EZRA is allowed to sign its own work. */}
          <a
            href={SITE.url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'group inline-flex items-center gap-2 self-start rounded-full border border-line-subtle bg-surface px-3 py-1.5',
              'text-xs font-medium text-faint transition-all duration-200 ease-[var(--ease-out-expo)]',
              'hover:border-line hover:text-muted hover:shadow-xs sm:self-auto',
            )}
          >
            Powered by
            {/* markOnly: the wordmark's accent is bound to `--primary`, which the
                storefront has re-pointed at the operator's colour. */}
            <Logo
              size="sm"
              markOnly
              className="scale-[0.8] opacity-85 transition-opacity group-hover:opacity-100"
            />
            <span className="font-display font-semibold tracking-tight text-muted">EZRA Pro</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
