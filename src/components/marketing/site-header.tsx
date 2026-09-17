'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { ArrowRight, ChevronDown, Menu, Truck, X } from 'lucide-react'

import { MARKETING_NAV, type NavGroup } from '@/lib/site-config'
import { cn } from '@/lib/utils'
import { DURATION, EASE_OUT_EXPO } from '@/lib/motion'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { ScrollProgress } from '@/components/motion/scroll-progress'
import { Logo } from '@/components/marketing/logo'
import { ThemeToggle } from '@/components/marketing/theme-toggle'
import { MobileNav, navIcon } from '@/components/marketing/mobile-nav'

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

/** Bumping the suffix re-shows the strip to everyone who dismissed the last one. */
const ANNOUNCEMENT_KEY = 'ezra-announcement:migration-2026'

const ANNOUNCEMENT = {
  full: 'Free migration from FareHarbor & Peek Pro — live in a weekend',
  short: 'Free migration — live in a weekend',
  linkLabel: 'See how it works',
  href: '/switch',
} as const

/** Pixels of scroll before the bar takes on its glass chrome. */
const SCROLL_THRESHOLD = 24

/** How long the pointer may be off the nav before an open panel closes. */
const CLOSE_DELAY_MS = 140

/**
 * The scrolled chrome, written out rather than using the `glass-strong`
 * utility: that utility also sets a border on all four sides, which would draw
 * a hairline across the top of a full-bleed bar.
 */
const GLASS_CHROME =
  'bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] backdrop-blur-[24px] backdrop-saturate-[190%]'

/**
 * Reads storage before the browser paints, so a dismissed announcement never
 * flashes. `useLayoutEffect` warns during SSR, hence the swap.
 */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

function panelIdFor(label: string) {
  return `ezra-mega-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

/* ==========================================================================
   <SiteHeader>
   ========================================================================== */

export interface SiteHeaderProps {
  className?: string
}

/**
 * Marketing navigation.
 *
 * Layering, from the top of the viewport down: the reading-progress hairline, a
 * dismissible announcement strip, then the bar itself. The strip and
 * the bar share one fixed wrapper and the bar is offset with a *transform*
 * rather than flow — dismissing the strip therefore slides the bar up without
 * moving a pixel of page content, and the layout's static top padding never has
 * to change.
 *
 * The bar is transparent over the hero and crossfades its glass chrome in past
 * {@link SCROLL_THRESHOLD}px.
 */
export function SiteHeader({ className }: SiteHeaderProps) {
  const pathname = usePathname()
  const reducedMotion = useReducedMotionSafe()

  const [scrolled, setScrolled] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  /* ---------- announcement strip ---------- */

  const [bannerOpen, setBannerOpen] = React.useState(true)
  // Suppresses the chrome transitions for the first paint, so the pre-paint
  // correction below lands instantly instead of sliding in on every load.
  const [chromeReady, setChromeReady] = React.useState(false)

  useIsomorphicLayoutEffect(() => {
    try {
      if (window.localStorage.getItem(ANNOUNCEMENT_KEY) === 'dismissed') setBannerOpen(false)
    } catch {
      // Storage blocked — keep the strip; it stays dismissible for this session.
    }
  }, [])

  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setChromeReady(true))
    return () => window.cancelAnimationFrame(frame)
  }, [])

  const dismissBanner = React.useCallback(() => {
    setBannerOpen(false)
    try {
      window.localStorage.setItem(ANNOUNCEMENT_KEY, 'dismissed')
    } catch {
      // Non-fatal: the strip stays hidden for this session either way.
    }
  }, [])

  /* ---------- scroll chrome ---------- */

  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, 'change', (value) => {
    // A little hysteresis so a pointer parked on the threshold cannot flicker.
    setScrolled((previous) => (previous ? value > SCROLL_THRESHOLD - 8 : value > SCROLL_THRESHOLD))
  })

  // Restored scroll positions and hash landings start below the threshold.
  React.useEffect(() => {
    setScrolled(window.scrollY > SCROLL_THRESHOLD)
  }, [])

  /* ---------- mega menu ---------- */

  const [openKey, setOpenKey] = React.useState<string | null>(null)
  const [hoverKey, setHoverKey] = React.useState<string | null>(null)
  const triggerRefs = React.useRef<Record<string, HTMLElement | null>>({})
  const closeTimer = React.useRef<number | null>(null)

  const cancelClose = React.useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const scheduleClose = React.useCallback(() => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => setOpenKey(null), CLOSE_DELAY_MS)
  }, [cancelClose])

  React.useEffect(() => () => cancelClose(), [cancelClose])

  // Any navigation dismisses whatever is open.
  React.useEffect(() => {
    setOpenKey(null)
    setMobileOpen(false)
  }, [pathname])

  const closeAndRefocus = React.useCallback(() => {
    setOpenKey((current) => {
      if (current) triggerRefs.current[current]?.focus()
      return null
    })
  }, [])

  React.useEffect(() => {
    if (!openKey) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAndRefocus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [openKey, closeAndRefocus])

  /**
   * Panels are queried by id rather than held in a ref: while one group's panel
   * animates out the next one is already mounted, and a shared ref would be
   * nulled by the outgoing panel's cleanup.
   */
  const panelItems = React.useCallback((label: string) => {
    const panel = document.getElementById(panelIdFor(label))
    return Array.from(panel?.querySelectorAll<HTMLElement>('[data-mega-item]') ?? [])
  }, [])

  const focusPanelItem = React.useCallback(
    (label: string, index: number) => {
      const items = panelItems(label)
      if (!items.length) return
      items[((index % items.length) + items.length) % items.length]?.focus()
    },
    [panelItems],
  )

  const handleTriggerKeyDown = React.useCallback(
    (event: React.KeyboardEvent, group: NavGroup, index: number) => {
      if (event.key === 'Escape') {
        setOpenKey(null)
        return
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault()
        const step = event.key === 'ArrowRight' ? 1 : -1
        const target = MARKETING_NAV[(index + step + MARKETING_NAV.length) % MARKETING_NAV.length]
        setOpenKey(null)
        triggerRefs.current[target.label]?.focus()
        return
      }
      if (!group.items?.length) return
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setOpenKey(group.label)
        // The panel mounts on the next commit; wait a frame before reaching in.
        window.requestAnimationFrame(() => focusPanelItem(group.label, 0))
      }
    },
    [focusPanelItem],
  )

  const handlePanelKeyDown = React.useCallback(
    (event: React.KeyboardEvent, label: string) => {
      const items = panelItems(label)
      if (!items.length) return
      const current = items.indexOf(document.activeElement as HTMLElement)

      switch (event.key) {
        case 'Escape':
          event.preventDefault()
          closeAndRefocus()
          break
        case 'ArrowDown':
          event.preventDefault()
          focusPanelItem(label, current + 1)
          break
        case 'ArrowUp':
          event.preventDefault()
          if (current <= 0) closeAndRefocus()
          else focusPanelItem(label, current - 1)
          break
        case 'Home':
          event.preventDefault()
          focusPanelItem(label, 0)
          break
        case 'End':
          event.preventDefault()
          focusPanelItem(label, items.length - 1)
          break
        default:
          break
      }
    },
    [closeAndRefocus, focusPanelItem, panelItems],
  )

  // Tabbing or clicking clean out of the nav closes the panel behind you.
  const handleNavBlur = React.useCallback((event: React.FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as Node | null
    if (next && event.currentTarget.contains(next)) return
    setOpenKey(null)
  }, [])

  const pillKey = openKey ?? hoverKey

  return (
    <>
      <ScrollProgress className="z-[70]" />

      <div className={cn('fixed inset-x-0 top-0 z-50', className)}>
        {/* ---------- announcement strip ---------- */}
        <div
          aria-hidden={!bannerOpen}
          inert={!bannerOpen}
          className={cn(
            'absolute inset-x-0 top-0 z-10 h-9 overflow-hidden',
            'bg-navy-deep',
            chromeReady && 'transition-[transform,opacity] duration-500 ease-[var(--ease-out-expo)]',
            bannerOpen
              ? 'translate-y-0 opacity-100'
              : 'pointer-events-none -translate-y-full opacity-0',
          )}
        >
          <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Truck aria-hidden="true" className="hidden size-3.5 shrink-0 text-accent sm:block" />
            <p className="min-w-0 flex-1 truncate text-[0.78125rem] font-medium text-ink-50">
              <span className="hidden sm:inline">{ANNOUNCEMENT.full}</span>
              <span className="sm:hidden">{ANNOUNCEMENT.short}</span>
            </p>
            <Link
              href={ANNOUNCEMENT.href}
              className={cn(
                'group/ann hidden shrink-0 items-center gap-1 sm:inline-flex',
                'text-[0.78125rem] font-semibold text-accent underline decoration-accent/50 underline-offset-4',
                'transition-colors duration-200 ease-[var(--ease-out-expo)] hover:decoration-accent',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50',
              )}
            >
              {ANNOUNCEMENT.linkLabel}
              <ArrowRight
                aria-hidden="true"
                className="size-3.5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover/ann:translate-x-0.5"
              />
            </Link>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss announcement"
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full text-ink-50/85',
                'transition-colors duration-200 ease-[var(--ease-out-expo)]',
                'hover:bg-ink-950/25 hover:text-ink-50',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50',
              )}
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        </div>

        {/* ---------- bar ---------- */}
        <header
          className={cn(
            'relative isolate z-20',
            chromeReady && 'transition-transform duration-500 ease-[var(--ease-out-expo)]',
            bannerOpen ? 'translate-y-9' : 'translate-y-0',
          )}
        >
          {/* Crossfaded rather than class-swapped: backdrop-filter cannot be
              transitioned on its own, but the layer carrying it can. */}
          <div
            aria-hidden="true"
            className={cn(
              'absolute inset-0 -z-10 border-b border-line',
              GLASS_CHROME,
              'shadow-[0_12px_36px_-20px_color-mix(in_oklab,var(--fg)_55%,transparent)]',
              'transition-opacity duration-500 ease-[var(--ease-out-expo)]',
              scrolled ? 'opacity-100' : 'opacity-0',
            )}
          />
          <div
            aria-hidden="true"
            className={cn(
              'absolute inset-x-0 bottom-0 -z-10 h-px',
              'bg-line-strong',
              'transition-opacity duration-500 ease-[var(--ease-out-expo)]',
              scrolled ? 'opacity-100' : 'opacity-0',
            )}
          />

          <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:h-18 lg:px-8">
            <Link
              href="/"
              aria-label="EZRA Pro home"
              className={cn(
                'shrink-0 rounded-lg transition-transform duration-300 ease-[var(--ease-out-expo)]',
                'hover:-translate-y-px motion-reduce:hover:translate-y-0',
              )}
            >
              <Logo size="md" />
            </Link>

            {/* ---------- desktop nav ---------- */}
            <nav
              aria-label="Main"
              className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:block"
              onMouseEnter={cancelClose}
              onMouseLeave={() => {
                scheduleClose()
                setHoverKey(null)
              }}
              onBlur={handleNavBlur}
            >
              <ul className="flex items-center gap-0.5">
                {MARKETING_NAV.map((group, index) => {
                  const hasPanel = Boolean(group.items?.length)
                  const isOpen = openKey === group.label
                  const panelId = panelIdFor(group.label)

                  return (
                    <li
                      key={group.label}
                      onMouseEnter={() => {
                        cancelClose()
                        setHoverKey(group.label)
                        setOpenKey(hasPanel ? group.label : null)
                      }}
                    >
                      {hasPanel ? (
                        <button
                          type="button"
                          ref={(node) => {
                            triggerRefs.current[group.label] = node
                          }}
                          aria-expanded={isOpen}
                          aria-controls={isOpen ? panelId : undefined}
                          aria-haspopup="true"
                          onClick={() => setOpenKey(isOpen ? null : group.label)}
                          // Keyboard focus opens the panel; a mouse click does
                          // not (it never matches :focus-visible), which leaves
                          // the click free to act as a plain toggle.
                          onFocus={(event) => {
                            if (event.currentTarget.matches(':focus-visible')) {
                              setOpenKey(group.label)
                            }
                          }}
                          onKeyDown={(event) => handleTriggerKeyDown(event, group, index)}
                          className={cn(NAV_TRIGGER_CLASS, isOpen && 'text-foreground')}
                        >
                          <NavPill active={pillKey === group.label} reducedMotion={reducedMotion} />
                          <span className="relative">{group.label}</span>
                          <ChevronDown
                            aria-hidden="true"
                            className={cn(
                              'relative size-3.5 text-faint',
                              'transition-transform duration-300 ease-[var(--ease-out-expo)]',
                              isOpen && 'rotate-180 text-primary',
                            )}
                          />
                        </button>
                      ) : (
                        <Link
                          href={group.href ?? '/'}
                          ref={(node) => {
                            triggerRefs.current[group.label] = node
                          }}
                          onFocus={() => setOpenKey(null)}
                          onKeyDown={(event) => handleTriggerKeyDown(event, group, index)}
                          className={NAV_TRIGGER_CLASS}
                        >
                          <NavPill active={pillKey === group.label} reducedMotion={reducedMotion} />
                          <span className="relative">{group.label}</span>
                        </Link>
                      )}

                      <AnimatePresence>
                        {hasPanel && isOpen ? (
                          <motion.div
                            key={panelId}
                            id={panelId}
                            onKeyDown={(event) => handlePanelKeyDown(event, group.label)}
                            // The top padding doubles as a hover bridge between
                            // the trigger and the panel.
                            className="absolute left-1/2 top-full z-40 pt-3"
                            style={{ x: '-50%' }}
                            initial={
                              reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.97 }
                            }
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={
                              reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }
                            }
                            transition={{
                              duration: reducedMotion ? DURATION.instant : DURATION.quick,
                              ease: EASE_OUT_EXPO,
                            }}
                          >
                            <MegaPanel group={group} onNavigate={() => setOpenKey(null)} />
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* ---------- actions ---------- */}
            <div className="ml-auto flex shrink-0 items-center gap-1.5 lg:gap-2">
              <ThemeToggle size="sm" className="lg:size-10" />
              <Button asChild variant="ghost" size="sm" className="hidden rounded-full lg:inline-flex">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button
                asChild
                variant="primary"
                size="sm"
                className="hidden rounded-full px-4 lg:inline-flex"
                rightIcon={<ArrowRight />}
              >
                <Link href="/signup">Start free</Link>
              </Button>
              <IconButton
                type="button"
                variant="ghost"
                size="sm"
                shape="circle"
                aria-label="Open menu"
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(true)}
                className="lg:hidden"
              >
                <Menu aria-hidden="true" />
              </IconButton>
            </div>
          </div>
        </header>
      </div>

      <MobileNav open={mobileOpen} onOpenChange={setMobileOpen} />
    </>
  )
}

/* ==========================================================================
   PIECES
   ========================================================================== */

const NAV_TRIGGER_CLASS = cn(
  'relative flex h-9 cursor-pointer items-center gap-1 rounded-lg px-3',
  'text-sm font-medium text-muted transition-colors duration-200 ease-[var(--ease-out-expo)]',
  'hover:text-foreground',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
)

/** One lozenge shared by every nav item — it glides between them on hover. */
function NavPill({ active, reducedMotion }: { active: boolean; reducedMotion: boolean }) {
  if (!active) return null

  if (reducedMotion) {
    return <span aria-hidden="true" className="absolute inset-0 rounded-lg bg-surface-sunken" />
  }

  return (
    <motion.span
      aria-hidden="true"
      layoutId="ezra-nav-pill"
      className="absolute inset-0 rounded-lg border border-line-subtle bg-surface-sunken"
      transition={{ duration: DURATION.quick, ease: EASE_OUT_EXPO }}
    />
  )
}

function MegaPanel({ group, onNavigate }: { group: NavGroup; onNavigate: () => void }) {
  const items = group.items ?? []
  const feature = group.feature
  const FeatureIcon = navIcon(feature?.icon)

  return (
    <div
      className={cn(
        'glass-strong overflow-hidden rounded-2xl shadow-2xl',
        feature
          ? 'grid w-[min(58rem,calc(100vw-3rem))] grid-cols-[minmax(0,1fr)_17.5rem]'
          : 'w-[min(53rem,calc(100vw-3rem))]',
      )}
    >
      <div className={cn('grid gap-1 p-3', feature ? 'grid-cols-2' : 'grid-cols-3')}>
        {items.map((item) => {
          const Icon = navIcon(item.icon)
          return (
            <Link
              key={item.href}
              href={item.href}
              data-mega-item=""
              onClick={onNavigate}
              className={cn(
                'group/row flex items-start gap-3 rounded-xl p-3',
                'transition-colors duration-200 ease-[var(--ease-out-expo)]',
                'hover:bg-surface-sunken',
                'focus-visible:bg-surface-sunken focus-visible:outline focus-visible:outline-2',
                'focus-visible:-outline-offset-2 focus-visible:outline-primary',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg',
                  'border border-line-subtle bg-surface text-primary',
                  'transition-all duration-300 ease-[var(--ease-out-expo)]',
                  'group-hover/row:border-[color-mix(in_oklab,var(--primary)_38%,transparent)]',
                  'group-hover/row:bg-primary-soft group-hover/row:shadow-glow-lagoon',
                )}
              >
                <Icon className="size-4.5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  {item.label}
                  {item.badge ? (
                    <Badge size="sm" variant="accent">
                      {item.badge}
                    </Badge>
                  ) : null}
                </span>
                {item.description ? (
                  <span className="mt-1 block text-xs leading-relaxed text-muted">
                    {item.description}
                  </span>
                ) : null}
              </span>
            </Link>
          )
        })}
      </div>

      {feature ? (
        <div
          className={cn(
            'relative border-l border-line-subtle p-3',
            'bg-primary-soft/50',
          )}
        >
          <Link
            href={feature.href}
            data-mega-item=""
            onClick={onNavigate}
            className={cn(
              'group/feature flex h-full flex-col rounded-xl p-4',
              'transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-surface/60',
              'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2',
              'focus-visible:outline-primary',
            )}
          >
            <span className="grid size-10 place-items-center rounded-xl bg-primary text-on-primary shadow-md">
              <FeatureIcon className="size-5" aria-hidden="true" />
            </span>
            <span className="mt-4 font-display text-base font-semibold tracking-tight text-foreground">
              {feature.title}
            </span>
            <span className="mt-1.5 text-xs leading-relaxed text-muted">{feature.description}</span>
            <span className="mt-auto inline-flex items-center gap-1 pt-4 text-xs font-semibold text-primary">
              Learn more
              <ArrowRight
                aria-hidden="true"
                className="size-3.5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover/feature:translate-x-0.5"
              />
            </span>
          </Link>
        </div>
      ) : null}
    </div>
  )
}
