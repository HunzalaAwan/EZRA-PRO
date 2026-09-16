'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Coins, Globe, Mail, ShieldCheck } from 'lucide-react'

import { FOOTER_NAV, SITE, SOCIAL_LINKS, type NavLink } from '@/lib/site-config'
import { cn } from '@/lib/utils'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { WaveDivider } from '@/components/motion/backgrounds'
import { Reveal } from '@/components/motion/reveal'
import { Logo } from '@/components/marketing/logo'

/* ==========================================================================
   BRAND GLYPHS

   lucide dropped its brand marks, so the four social icons are drawn here as
   single filled paths on a shared 24-unit grid — they stay optically matched
   to the lucide icons used everywhere else in the footer.
   ========================================================================== */

const SOCIAL_PATHS: Record<string, string> = {
  Twitter:
    'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117Z',
  Linkedin:
    'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 1 1 0-4.124 2.062 2.062 0 0 1 0 4.124Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z',
  Instagram:
    'M12 2c2.717 0 3.056.01 4.122.06 1.065.05 1.79.217 2.428.465.66.254 1.216.598 1.772 1.153a4.9 4.9 0 0 1 1.153 1.772c.247.637.415 1.363.465 2.428.047 1.066.06 1.405.06 4.122s-.013 3.056-.06 4.122c-.05 1.065-.218 1.79-.465 2.428a4.88 4.88 0 0 1-1.153 1.772 4.9 4.9 0 0 1-1.772 1.153c-.637.247-1.363.415-2.428.465-1.066.047-1.405.06-4.122.06s-3.056-.013-4.122-.06c-1.065-.05-1.79-.218-2.428-.465a4.89 4.89 0 0 1-1.772-1.153 4.9 4.9 0 0 1-1.153-1.772c-.248-.637-.415-1.363-.465-2.428C2.013 15.056 2 14.717 2 12s.01-3.056.06-4.122c.05-1.066.217-1.79.465-2.428a4.9 4.9 0 0 1 1.153-1.772A4.9 4.9 0 0 1 5.45 2.525c.638-.248 1.362-.415 2.428-.465C8.944 2.013 9.283 2 12 2Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm6.5-.25a1.25 1.25 0 1 0-2.5 0 1.25 1.25 0 0 0 2.5 0ZM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  Youtube:
    'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z',
}

function SocialGlyph({ name, className }: { name?: string; className?: string }) {
  const path = name ? SOCIAL_PATHS[name] : undefined
  if (!path) return <Globe className={className} aria-hidden="true" />

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d={path} />
    </svg>
  )
}

/* ==========================================================================
   STATIC OPTIONS
   ========================================================================== */

const LOCALES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'es-ES', label: 'Español' },
  { value: 'fr-FR', label: 'Français' },
  { value: 'de-DE', label: 'Deutsch' },
] as const

const CURRENCIES = [
  { value: 'USD', label: 'USD $' },
  { value: 'EUR', label: 'EUR €' },
  { value: 'GBP', label: 'GBP £' },
  { value: 'AUD', label: 'AUD $' },
  { value: 'NZD', label: 'NZD $' },
  { value: 'CAD', label: 'CAD $' },
] as const

const TRUST_MARKS = ['SOC 2 Type II', 'PCI DSS Level 1', 'GDPR'] as const

/**
 * Rendered on the server and on the first client pass, then corrected after
 * mount — reading the clock during render is how hydration mismatches start.
 */
const COPYRIGHT_FALLBACK_YEAR = 2026

/* ==========================================================================
   <SiteFooter>
   ========================================================================== */

export interface SiteFooterProps {
  className?: string
}

/**
 * The marketing footer: a newsletter band, the full sitemap, and a legal bar.
 *
 * The wave seam is the one place on the page where the
 * ocean side of the brand is allowed to be literal.
 */
export function SiteFooter({ className }: SiteFooterProps) {
  const [email, setEmail] = React.useState('')
  const [locale, setLocale] = React.useState<string>(LOCALES[0].value)
  const [currency, setCurrency] = React.useState<string>(CURRENCIES[0].value)
  const [year, setYear] = React.useState(COPYRIGHT_FALLBACK_YEAR)

  React.useEffect(() => {
    setYear(new Date().getFullYear())
  }, [])

  const handleSubscribe = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const address = email.trim()
      if (!address) return
      setEmail('')
      toast.success('You are on the list', {
        description: `The next issue goes to ${address}.`,
      })
    },
    [email],
  )

  return (
    <footer className={cn('relative isolate', className)}>
      {/* Seam: the page colour spills into the footer as a tide line. */}
      <WaveDivider flip color="text-background" height={72} className="bg-surface-sunken" />

      {/* `isolate` is load-bearing: the orbs sit at -z-10, and without a
          stacking context here they would paint behind this element's own
          background instead of in front of it. */}
      <div className="relative isolate overflow-hidden bg-surface-sunken">

        {/* ---------- newsletter band ---------- */}
        <div className="mx-auto max-w-7xl px-5 pb-14 pt-10 sm:px-6 lg:px-8 lg:pb-16 lg:pt-14">
          <Reveal blur distance={18}>
            <div className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 shadow-xl sm:p-8 lg:p-10">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-primary-soft/40"
              />
              <div className="relative grid gap-8 lg:grid-cols-[1.1fr_minmax(0,1fr)] lg:items-center lg:gap-14">
                <div>
                  <Badge variant="primary" size="sm" dot>
                    Every other Tuesday
                  </Badge>
                  <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                    The operator briefing
                  </h2>
                  <p className="mt-2.5 max-w-md text-sm leading-relaxed text-muted">
                    Pricing experiments, capacity tactics and channel benchmarks pulled from live
                    operators. Short, specific, and written for people who run departures.
                  </p>
                </div>

                <form onSubmit={handleSubscribe} className="flex flex-col gap-3">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <label htmlFor="ezra-footer-email" className="sr-only">
                      Work email
                    </label>
                    <Input
                      id="ezra-footer-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      size="lg"
                      className="min-w-0 flex-1"
                      placeholder="you@youroperation.com"
                      leftIcon={<Mail />}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                    <Button type="submit" variant="accent" size="lg" rightIcon={<ArrowRight />}>
                      Subscribe
                    </Button>
                  </div>
                  <p className="text-xs text-subtle">
                    No noise. Unsubscribe in one click, any time.
                  </p>
                </form>
              </div>
            </div>
          </Reveal>
        </div>

        {/* ---------- sitemap ---------- */}
        <div className="mx-auto max-w-7xl px-5 pb-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-16">
            <div>
              <Link
                href="/"
                aria-label="EZRA Pro home"
                className="inline-flex rounded-lg transition-transform duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-px motion-reduce:hover:translate-y-0"
              >
                <Logo size="md" />
              </Link>

              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
                {SITE.description}
              </p>

              <ul className="mt-5 flex items-center gap-1.5">
                {SOCIAL_LINKS.map((social) => (
                  <li key={social.label}>
                    <IconButton
                      asChild
                      variant="ghost"
                      size="sm"
                      shape="circle"
                      aria-label={`EZRA Pro on ${social.label}`}
                      className="text-subtle hover:text-primary"
                    >
                      <a href={social.href} target="_blank" rel="noopener noreferrer">
                        <SocialGlyph name={social.icon} className="size-4" />
                      </a>
                    </IconButton>
                  </li>
                ))}
              </ul>

              <div className="mt-6 flex flex-col gap-1.5 text-sm">
                <a
                  href={`mailto:${SITE.supportEmail}`}
                  className="w-fit text-muted transition-colors duration-200 hover:text-primary"
                >
                  {SITE.supportEmail}
                </a>
                <a
                  href={`tel:${SITE.phone.replace(/[^+\d]/g, '')}`}
                  className="w-fit text-muted transition-colors duration-200 hover:text-primary"
                >
                  {SITE.phone}
                </a>
              </div>
            </div>

            {/* Two renderings of one sitemap: columns where there is room, a
                stack of disclosures where there is not. */}
            <div>
              <div className="hidden grid-cols-2 gap-x-6 gap-y-10 sm:grid md:grid-cols-3 lg:grid-cols-5">
                {FOOTER_NAV.map((section) => (
                  <nav key={section.heading} aria-label={section.heading}>
                    <h3 className="font-display text-[0.8125rem] font-semibold tracking-wide text-foreground">
                      {section.heading}
                    </h3>
                    <ul className="mt-4 flex flex-col gap-2.5">
                      {section.links.map((link) => (
                        <li key={link.href}>
                          <FooterLink link={link} />
                        </li>
                      ))}
                    </ul>
                  </nav>
                ))}
              </div>

              <Accordion type="multiple" variant="plain" className="sm:hidden">
                {FOOTER_NAV.map((section) => (
                  <AccordionItem key={section.heading} value={section.heading}>
                    <AccordionTrigger className="py-3.5 font-display text-sm font-semibold">
                      {section.heading}
                    </AccordionTrigger>
                    <AccordionContent className="pb-4">
                      <ul className="flex flex-col gap-3">
                        {section.links.map((link) => (
                          <li key={link.href}>
                            <FooterLink link={link} />
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </div>

        {/* ---------- legal bar ---------- */}
        <div className="border-t border-line-subtle">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <p className="order-3 text-xs text-subtle lg:order-1">
              © {year} EZRA Pro. All rights reserved.
            </p>

            <p className="order-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle lg:order-2">
              <ShieldCheck aria-hidden="true" className="size-3.5 shrink-0 text-success" />
              {TRUST_MARKS.map((mark, index) => (
                <React.Fragment key={mark}>
                  {index > 0 ? (
                    <span aria-hidden="true" className="text-faint">
                      ·
                    </span>
                  ) : null}
                  <span>{mark}</span>
                </React.Fragment>
              ))}
            </p>

            <div className="order-2 flex items-center gap-2 lg:order-3">
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger
                  size="sm"
                  icon={<Globe />}
                  aria-label="Language"
                  className="w-[9.75rem] bg-transparent"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent width="auto">
                  {LOCALES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger
                  size="sm"
                  icon={<Coins />}
                  aria-label="Currency"
                  className="w-[7.25rem] bg-transparent"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent width="auto">
                  {CURRENCIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterLink({ link }: { link: NavLink }) {
  return (
    <Link
      href={link.href}
      className={cn(
        'group/footer-link inline-flex items-center gap-2 text-sm text-muted',
        'transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-primary',
      )}
    >
      <span className="relative">
        {link.label}
        <span
          aria-hidden="true"
          className={cn(
            'absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-primary',
            'transition-transform duration-300 ease-[var(--ease-out-expo)]',
            'group-hover/footer-link:scale-x-100 motion-reduce:transition-none',
          )}
        />
      </span>
      {link.badge ? (
        <Badge size="sm" variant="success">
          {link.badge}
        </Badge>
      ) : null}
    </Link>
  )
}
