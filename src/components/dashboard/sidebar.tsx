'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import {
  BedDouble,
  Brush,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChartSpline,
  Circle,
  ClipboardList,
  Clock,
  Compass,
  ConciergeBell,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Ship,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tags,
  Ticket,
  UserCog,
  Users,
  Utensils,
  UtensilsCrossed,
  Waves,
  Zap,
  Bus,
  Inbox,
  KeyRound,
  ScanLine,
  CloudSun,
  Gauge,
  Sunrise,
  MessageCircle,
  Banknote,
} from 'lucide-react'

import type { DashboardNavItem } from '@/lib/site-config'
import type { PlanTier } from '@/types'
import { useWorkspace } from '@/components/dashboard/workspace-provider'
import { cn, formatNumber } from '@/lib/utils'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Logo } from '@/components/marketing/logo'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Progress } from '@/components/ui/progress'
import { SimpleTooltip, TooltipProvider } from '@/components/ui/tooltip'
import { TenantSwitcher } from '@/components/dashboard/tenant-switcher'

/* ==========================================================================
   SIDEBAR

   A fixed rail that collapses to an icon strip. The collapsed preference is
   persisted, but it is only applied after mount — the server has no way to
   know it, and guessing would tear the first paint.
   ========================================================================== */

export const SIDEBAR_WIDTH_EXPANDED = '16.5rem' // 264px
export const SIDEBAR_WIDTH_COLLAPSED = '4.5rem' // 72px

const STORAGE_KEY = 'ezra-sidebar-collapsed'

/* --------------------------------------------------------------------------
   Icons — site-config stores lucide NAMES so it can stay a plain data module.
   -------------------------------------------------------------------------- */

type IconComponent = React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>

/**
 * Every icon name DASHBOARD_NAV can reference — explicit and named, not a
 * `import * as Icons` barrel. A namespace import defeats tree-shaking the
 * moment it's indexed by a runtime string (`Icons[name]`), because the
 * bundler can no longer prove which icons are unused: the entire ~1500-module
 * lucide-react package ends up in the client bundle for every dashboard
 * route. This map costs exactly the 14 icons the nav actually uses.
 */
const REGISTRY: Record<string, IconComponent> = {
  Banknote,
  MessageCircle,
  ScanLine,
  CloudSun,
  Gauge,
  Sunrise,
  Bus,
  Inbox,
  KeyRound,
  BedDouble,
  Brush,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ChartSpline,
  ClipboardList,
  Clock,
  Compass,
  ConciergeBell,
  CreditCard,
  LayoutDashboard,
  LayoutGrid,
  Settings,
  Ship,
  ShoppingBag,
  ShoppingCart,
  Star,
  Store,
  Tags,
  Ticket,
  UserCog,
  Users,
  Utensils,
  UtensilsCrossed,
  Waves,
}

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Resolved = REGISTRY[name] ?? Circle
  return <Resolved className={className} aria-hidden="true" />
}

/* --------------------------------------------------------------------------
   Count chips — resolved once from the frozen demo dataset, so server and
   client always agree.
   -------------------------------------------------------------------------- */

export type NavCountKey = NonNullable<DashboardNavItem['countKey']>

/**
 * Computed server-side (see the dashboard layout) and threaded down as a
 * prop — this file never imports `@/lib/demo` itself, which is what keeps
 * the full dataset out of the always-mounted shell's client bundle.
 */
export type NavCounts = Record<NavCountKey, number>

/* --------------------------------------------------------------------------
   Route matching
   -------------------------------------------------------------------------- */

export function isNavItemActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/* --------------------------------------------------------------------------
   NAV LIST — shared by the desktop rail and the mobile sheet.
   -------------------------------------------------------------------------- */

export interface DashboardNavListProps {
  collapsed?: boolean
  /** Scopes the sliding indicator so two mounted navs never fight over it. */
  layoutId: string
  navCounts: NavCounts
  onNavigate?: () => void
  className?: string
}

export function DashboardNavList({
  collapsed = false,
  layoutId,
  navCounts,
  onNavigate,
  className,
}: DashboardNavListProps) {
  const pathname = usePathname() ?? '/dashboard'
  const reduceMotion = useReducedMotionSafe()
  const { profile } = useWorkspace()

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {profile.nav.map((section, sectionIndex) => (
        <div key={section.heading ?? `section-${sectionIndex}`}>
          {section.heading ? (
            collapsed ? (
              <div aria-hidden="true" className="mx-auto mb-2 h-px w-6 rounded-full bg-line" />
            ) : (
              <p className="mb-2 px-2.5 text-[0.8125rem] font-semibold tracking-[0.09em] text-faint uppercase">
                {section.heading}
              </p>
            )
          ) : null}

          <ul className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const active = isNavItemActive(pathname, item.href)
              const count = item.countKey ? navCounts[item.countKey] : 0
              const showCount = Boolean(item.countKey) && count > 0

              const link = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'group/nav relative flex items-center rounded-lg text-sm font-medium',
                    'transition-colors duration-200 ease-[var(--ease-out-expo)]',
                    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
                    collapsed ? 'h-10 w-10 justify-center' : 'gap-2.5 px-2.5 py-2',
                    active
                      ? 'bg-info-soft text-info'
                      : 'text-muted hover:bg-surface-sunken hover:text-foreground',
                  )}
                >
                  {active ? (
                    reduceMotion ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-1.5 -left-3 w-[3px] rounded-r-full bg-info"
                      />
                    ) : (
                      <motion.span
                        aria-hidden="true"
                        layoutId={layoutId}
                        className="absolute inset-y-1.5 -left-3 w-[3px] rounded-r-full bg-info"
                        transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.7 }}
                      />
                    )
                  ) : null}

                  <span className="relative flex shrink-0 items-center">
                    <NavIcon
                      name={item.icon}
                      className={cn(
                        'size-[1.125rem] transition-colors',
                        active ? 'text-primary' : 'text-subtle group-hover/nav:text-foreground',
                      )}
                    />
                    {collapsed && showCount ? (
                      <span
                        aria-hidden="true"
                        className="absolute -top-0.5 -right-0.5 size-[0.4375rem] rounded-full bg-accent ring-2 ring-surface"
                      />
                    ) : null}
                  </span>

                  {!collapsed ? (
                    <>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {showCount ? (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[0.8125rem] font-semibold tabular-nums',
                            active
                              ? 'bg-primary/15 text-primary'
                              : 'bg-surface-sunken text-subtle group-hover/nav:bg-surface group-hover/nav:text-foreground',
                          )}
                        >
                          {count > 99 ? '99+' : count}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </Link>
              )

              return (
                <li key={item.href} className={collapsed ? 'flex justify-center' : undefined}>
                  {collapsed ? (
                    <SimpleTooltip
                      side="right"
                      provider={false}
                      label={
                        <span className="flex items-center gap-2">
                          {item.label}
                          {showCount ? (
                            <span className="rounded-full bg-surface-sunken px-2 text-[0.8125rem] font-semibold text-foreground tabular-nums">
                              {count}
                            </span>
                          ) : null}
                        </span>
                      }
                    >
                      {link}
                    </SimpleTooltip>
                  ) : (
                    link
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/* --------------------------------------------------------------------------
   PLAN / USAGE CARD
   -------------------------------------------------------------------------- */

/** Monthly booking allowance per tier — the number the usage bar fills against. */
const PLAN_BOOKING_QUOTA: Record<PlanTier, number> = {
  starter: 400,
  growth: 3_000,
  scale: 12_000,
  enterprise: 40_000,
}

export function PlanUsageCard({ className }: { className?: string }) {
  const { tenant, profile } = useWorkspace()
  const used = tenant.stats.monthlyBookings
  const quota = PLAN_BOOKING_QUOTA[tenant.plan]
  const unitLabel = `${profile.vocab.bookings.charAt(0).toUpperCase()}${profile.vocab.bookings.slice(1)} this month`
  const percent = Math.min(100, Math.round((used / quota) * 100))
  const tone = percent >= 90 ? 'danger' : percent >= 75 ? 'warning' : 'primary'

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-line bg-surface-sunken p-3',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -right-8 size-24 rounded-full bg-primary-soft opacity-70 blur-2xl"
      />

      <div className="relative flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground capitalize">
          <Sparkles aria-hidden="true" className="size-3.5 text-primary" />
          {tenant.plan} plan
        </span>
        <span className="text-[0.8125rem] font-semibold text-subtle tabular-nums">{percent}%</span>
      </div>

      <p className="relative mt-2 text-[0.8125rem] text-subtle">{unitLabel}</p>
      <p className="relative mt-0.5 text-base font-semibold text-foreground tabular-nums">
        {formatNumber(used)}
        <span className="font-normal text-faint"> / {formatNumber(quota)}</span>
      </p>

      <Progress
        value={percent}
        tone={tone}
        size="xs"
        className="relative mt-2.5"
        aria-label={`${percent}% of the monthly booking allowance used`}
      />

      <Button
        asChild
        size="xs"
        variant="outline"
        fullWidth
        className="relative mt-3"
        leftIcon={<Zap aria-hidden="true" />}
      >
        <Link href="/dashboard/settings">Upgrade plan</Link>
      </Button>
    </div>
  )
}

/* --------------------------------------------------------------------------
   SIDEBAR
   -------------------------------------------------------------------------- */

export function Sidebar({ navCounts, className }: { navCounts: NavCounts; className?: string }) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      // Storage can be blocked — the rail simply stays expanded.
    }
    setMounted(true)
  }, [])

  const toggle = React.useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        // Non-fatal.
      }
      return next
    })
  }, [])

  // ⌘B / Ctrl+B mirrors every editor-class app.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'b' && (event.metaKey || event.ctrlKey) && !event.shiftKey) {
        event.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [toggle])

  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={400}>
      <aside
        data-collapsed={collapsed || undefined}
        style={{ width: collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
        className={cn(
          'type-nav sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface lg:flex',
          mounted && 'transition-[width] duration-300 ease-[var(--ease-out-expo)]',
          className,
        )}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex h-14 shrink-0 items-center border-b border-line-subtle',
            collapsed ? 'justify-center px-2' : 'px-4',
          )}
        >
          <Link
            href="/dashboard"
            aria-label="EZRA Pro dashboard home"
            className="rounded-lg transition-opacity hover:opacity-85 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <Logo size="sm" markOnly={collapsed} />
          </Link>
        </div>

        {/* Workspace */}
        <div className={cn('shrink-0 px-3 pt-3 pb-1', collapsed && 'px-2')}>
          <TenantSwitcher collapsed={collapsed} />
        </div>

        {/* Navigation */}
        <nav
          aria-label="Dashboard"
          className={cn('min-h-0 flex-1 overflow-y-auto py-3 no-scrollbar', collapsed ? 'px-2' : 'px-3')}
        >
          <DashboardNavList collapsed={collapsed} layoutId="sidebar-nav-indicator" navCounts={navCounts} />
        </nav>

        {/* Footer */}
        <div
          className={cn(
            'shrink-0 border-t border-line-subtle',
            collapsed ? 'px-2 py-2' : 'space-y-2 px-3 py-3',
          )}
        >
          {!collapsed ? <PlanUsageCard /> : null}

          {collapsed ? (
            <SimpleTooltip label="Expand sidebar" side="right" provider={false}>
              <button
                type="button"
                onClick={toggle}
                aria-label="Expand sidebar"
                aria-expanded={false}
                className="mx-auto grid size-10 place-items-center rounded-lg text-subtle transition-colors hover:bg-surface-sunken hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              >
                <PanelLeftOpen aria-hidden="true" className="size-[1.125rem]" />
              </button>
            </SimpleTooltip>
          ) : (
            <button
              type="button"
              onClick={toggle}
              aria-label="Collapse sidebar"
              aria-expanded
              className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.9375rem] font-medium text-subtle transition-colors hover:bg-surface-sunken hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <PanelLeftClose aria-hidden="true" className="size-[1.125rem] shrink-0" />
              <span className="flex-1 text-left">Collapse</span>
              <Kbd size="sm" className="opacity-0 transition-opacity group-hover:opacity-100">
                ⌘B
              </Kbd>
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  )
}
