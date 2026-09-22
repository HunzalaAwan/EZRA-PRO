'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { Check, Globe, Lock, Menu, Phone, ShieldCheck, Sparkles } from 'lucide-react'

import { cn, initials } from '@/lib/utils'
import type { Tenant } from '@/types'
import type { StorefrontKind } from '@/lib/workspace-profile'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { useStorefrontBrand } from '@/components/storefront/storefront-brand'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

/** Pixels of scroll before the bar leaves its transparent hero state. */
const SCROLL_THRESHOLD = 28

/**
 * Written out rather than using `.glass-strong`, which sets a border on all
 * four sides — that would draw a hairline across the top of a full-bleed bar.
 */
const GLASS_CHROME =
  'bg-[color-mix(in_oklab,var(--surface)_86%,transparent)] backdrop-blur-[22px] backdrop-saturate-[180%] border-b border-line-subtle shadow-sm'

const LANGUAGES = [
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'es', short: 'ES', label: 'Español' },
  { code: 'de', short: 'DE', label: 'Deutsch' },
  { code: 'fr', short: 'FR', label: 'Français' },
  { code: 'ja', short: 'JA', label: '日本語' },
] as const

/** The operator's own locale, mapped onto the picker's default selection. */
function defaultLanguage(locale: string) {
  const base = locale.slice(0, 2).toLowerCase()
  return LANGUAGES.find((l) => l.code === base)?.code ?? 'en'
}

export interface StorefrontHeaderProps {
  tenant: Tenant
  /** What the business sells; decides the links and the button. */
  kind?: StorefrontKind
}

/* ==========================================================================
   <StorefrontHeader>

   The operator's chrome, not EZRA's. Transparent over the hero photograph,
   glass once the page moves, and stripped back to a trust bar on checkout.
   ========================================================================== */

export function StorefrontHeader({ tenant, kind = 'experiences' }: StorefrontHeaderProps) {
  const pathname = usePathname()
  const base = `/book/${tenant.slug}`

  const isHome = pathname === base || pathname === `${base}/`
  const isCheckout = [`${base}/checkout`, `${base}/order`, `${base}/reserve`, `${base}/stay`].some((p) => pathname.startsWith(p))

  const [scrolled, setScrolled] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [language, setLanguage] = React.useState<string>(() => defaultLanguage(tenant.locale))

  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', (value) => {
    setScrolled(value > SCROLL_THRESHOLD)
  })

  const brand = useStorefrontBrand(tenant)

  /** Transparent chrome is only safe where a dark hero image sits behind it. */
  const overHero = isHome && !scrolled && !menuOpen

  const nav =
    kind === 'restaurant'
      ? [
          { label: 'Menu', href: `${base}#menu` },
          { label: 'About', href: `${base}#about` },
          { label: 'Contact', href: `${base}#contact` },
        ]
      : kind === 'hotel'
        ? [
            { label: 'Rooms', href: `${base}#rooms` },
            { label: 'Menu', href: `${base}#menu` },
            { label: 'Experiences', href: `${base}#experiences` },
            { label: 'Contact', href: `${base}#contact` },
          ]
        : [
            { label: 'Experiences', href: `${base}#experiences` },
            { label: 'About', href: `${base}#about` },
            { label: 'Contact', href: `${base}#contact` },
          ]
  const cta =
    kind === 'restaurant'
      ? { label: 'Order online', href: `${base}#menu`, browse: 'See the menu', browseHref: `${base}#menu` }
      : kind === 'hotel'
        ? { label: 'Book a stay', href: `${base}#rooms`, browse: 'See the rooms', browseHref: `${base}#rooms` }
        : { label: brand.ctaLabel ?? 'Book now', href: `${base}#experiences`, browse: 'Browse experiences', browseHref: `${base}#experiences` }

  const activeLanguage = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0]

  return (
    <header
      data-over-hero={overHero || undefined}
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color,backdrop-filter] duration-400 ease-[var(--ease-out-expo)]',
        overHero ? 'border-b border-transparent bg-transparent' : GLASS_CHROME,
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[88rem] items-center gap-3 px-4 sm:h-[4.5rem] sm:px-6 lg:px-10">
        {/* ---------- brand ---------- */}
        <Link
          href={base}
          className="group/brand -ml-1 flex shrink-0 items-center gap-2.5 rounded-xl px-1 py-1 outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {brand.logoImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoImage} alt="" className="h-9 w-auto max-w-[9rem] shrink-0 object-contain" />
          ) : (
            <span
              aria-hidden="true"
              className={cn(
                'relative grid size-9 place-items-center overflow-hidden rounded-[0.7rem] font-display text-[0.8125rem] font-bold tracking-tight',
                'bg-[linear-gradient(145deg,var(--primary),color-mix(in_oklab,var(--accent)_72%,var(--primary)))] text-on-primary',
                'shadow-[0_6px_18px_-8px_color-mix(in_oklab,var(--primary)_75%,transparent)]',
                'transition-transform duration-400 ease-[var(--ease-out-expo)] group-hover/brand:scale-105',
              )}
            >
              <span className="absolute inset-x-0 top-0 h-1/2 bg-white/18" />
              <span className="relative">{initials(brand.logoText)}</span>
            </span>
          )}
          <span className="flex min-w-0 flex-col leading-none">
            <span
              className={cn(
                'truncate font-display text-[0.9375rem] font-semibold tracking-tight transition-colors duration-300 sm:text-base',
                overHero ? 'text-white' : 'text-foreground',
              )}
            >
              {brand.logoText}
            </span>
            <span
              className={cn(
                'mt-1 hidden truncate text-xs font-medium tracking-[0.14em] uppercase transition-colors duration-300 sm:block',
                overHero ? 'text-white/65' : 'text-faint',
              )}
            >
              {tenant.city}
            </span>
          </span>
        </Link>

        {/* ---------- checkout: trust chrome instead of navigation ---------- */}
        {isCheckout ? (
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 text-xs font-medium text-muted sm:inline-flex">
              <Lock className="size-3.5 text-success" aria-hidden="true" />
              Secure checkout · 256-bit TLS
            </span>
            <Separator orientation="vertical" className="hidden h-5 sm:block" />
            <a
              href={`tel:${tenant.contact.phone.replace(/[^+\d]/g, '')}`}
              className="inline-flex items-center gap-2 text-xs font-semibold text-foreground transition-colors hover:text-primary sm:text-[0.8125rem]"
            >
              <Phone className="size-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">{tenant.contact.phone}</span>
              <span className="sm:hidden">Call us</span>
            </a>
          </div>
        ) : (
          <>
            {/* ---------- desktop nav ---------- */}
            <nav aria-label="Storefront" className="ml-6 hidden items-center gap-1 lg:flex">
              {nav.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    'relative rounded-lg px-3 py-2 text-[0.8125rem] font-medium transition-colors duration-200',
                    'outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
                    overHero
                      ? 'text-white/80 hover:bg-white/10 hover:text-white'
                      : 'text-muted hover:bg-surface-sunken hover:text-foreground',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
              {/* ---------- language / currency ---------- */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold tracking-tight transition-all duration-200 md:inline-flex',
                      'outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      overHero
                        ? 'border-white/25 bg-white/10 text-white hover:bg-white/18'
                        : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
                    )}
                  >
                    <Globe className="size-3.5" aria-hidden="true" />
                    {activeLanguage.short}
                    <span className={overHero ? 'text-white/45' : 'text-faint'}>·</span>
                    {tenant.currency}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Language</DropdownMenuLabel>
                  {LANGUAGES.map((item) => (
                    <DropdownMenuItem
                      key={item.code}
                      onSelect={() => setLanguage(item.code)}
                      className="justify-between"
                    >
                      {item.label}
                      {item.code === language ? (
                        <Check className="size-4 text-primary" aria-hidden="true" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Currency</DropdownMenuLabel>
                  <DropdownMenuItem disabled className="justify-between">
                    {tenant.currency} — settlement currency
                    <Check className="size-4 text-primary" aria-hidden="true" />
                  </DropdownMenuItem>
                  <p className="px-2.5 pb-1 pt-1.5 text-xs leading-relaxed text-faint">
                    Your card is charged in {tenant.currency}. Your bank converts at its own rate.
                  </p>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* ---------- phone ---------- */}
              <a
                href={`tel:${tenant.contact.phone.replace(/[^+\d]/g, '')}`}
                className={cn(
                  'hidden items-center gap-2 rounded-lg px-2.5 py-2 text-[0.8125rem] font-semibold tabular transition-colors duration-200 xl:inline-flex',
                  'outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
                  overHero ? 'text-white hover:bg-white/10' : 'text-foreground hover:text-primary',
                )}
              >
                <Phone className="size-4" aria-hidden="true" />
                {tenant.contact.phone}
              </a>

              <Button
                asChild
                size="sm"
                variant={overHero ? 'glass' : 'primary'}
                className={cn('hidden sm:inline-flex', overHero && 'text-white')}
              >
                <Link href={cta.href}>{cta.label}</Link>
              </Button>

              {/* ---------- mobile ---------- */}
              <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
                <SheetTrigger asChild>
                  <IconButton
                    aria-label="Open menu"
                    size="sm"
                    variant={overHero ? 'glass' : 'outline'}
                    className={cn('lg:hidden', overHero && 'text-white')}
                  >
                    <Menu aria-hidden="true" />
                  </IconButton>
                </SheetTrigger>
                <SheetContent side="right" size="sm" className="p-0">
                  <SheetHeader className="px-6 pb-4 pt-6">
                    <SheetTitle className="font-display text-lg">
                      {brand.logoText}
                    </SheetTitle>
                    <SheetDescription>{tenant.city}</SheetDescription>
                  </SheetHeader>
                  <SheetBody className="px-6 pb-8">
                    <nav aria-label="Storefront" className="flex flex-col">
                      {nav.map((item, i) => (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={() => setMenuOpen(false)}
                          className={cn(
                            'flex items-center justify-between border-b border-line-subtle py-4 font-display text-lg font-semibold tracking-tight',
                            'transition-colors duration-200 hover:text-primary',
                            i === 0 && 'border-t',
                          )}
                        >
                          {item.label}
                          <Sparkles className="size-4 text-faint" aria-hidden="true" />
                        </Link>
                      ))}
                    </nav>

                    <div className="mt-7 space-y-3">
                      <Button asChild fullWidth size="lg" onClick={() => setMenuOpen(false)}>
                        <Link href={cta.browseHref}>{cta.browse}</Link>
                      </Button>
                      <Button
                        asChild
                        fullWidth
                        size="lg"
                        variant="outline"
                        leftIcon={<Phone aria-hidden="true" />}
                      >
                        <a href={`tel:${tenant.contact.phone.replace(/[^+\d]/g, '')}`}>
                          {tenant.contact.phone}
                        </a>
                      </Button>
                    </div>

                    <div className="mt-7 flex items-center gap-2 rounded-xl bg-surface-sunken px-3.5 py-3 text-xs text-muted">
                      <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                      Secure checkout · instant confirmation · prices in {tenant.currency}
                    </div>
                  </SheetBody>
                </SheetContent>
              </Sheet>
            </div>
          </>
        )}
      </div>

      {/* A hairline that fades in with the chrome — keeps the bar anchored once
          the page scrolls without adding a border to the transparent state. */}
      <AnimatePresence initial={false}>
        {!overHero && !isCheckout ? (
          <motion.div
            key="rule"
            aria-hidden="true"
            initial={{ opacity: 0, scaleX: 0.85 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="h-px origin-left bg-[linear-gradient(90deg,transparent,color-mix(in_oklab,var(--primary)_45%,transparent),transparent)]"
          />
        ) : null}
      </AnimatePresence>
    </header>
  )
}
