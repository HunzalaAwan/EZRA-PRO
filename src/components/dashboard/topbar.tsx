'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, MoonStar, Plus, Search, SunMedium } from 'lucide-react'

import { DASHBOARD_NAV } from '@/lib/site-config'
import type { NotificationItem } from '@/types'
import type { NavCounts } from '@/components/dashboard/sidebar'
import { CURRENT_TENANT, NOW } from '@/lib/demo-core'
import { cn, formatDateLong, titleCase } from '@/lib/utils'
import { useTheme } from '@/components/providers/theme-provider'
import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { KbdGroup } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { useCommandPalette } from '@/components/dashboard/command-palette'
import { MobileSidebar } from '@/components/dashboard/mobile-sidebar'
import { NotificationsMenu } from '@/components/dashboard/notifications-menu'
import { UserMenu } from '@/components/dashboard/user-menu'

/* ==========================================================================
   ROUTE BREADCRUMB

   Labels come from DASHBOARD_NAV wherever a route is a known page; deeper
   segments fall back to a humanised form, and record ids (act_…, bkg_…) are
   collapsed to "Details" rather than shown raw.
   ========================================================================== */

const NAV_LABEL_BY_HREF: Record<string, string> = Object.fromEntries(
  DASHBOARD_NAV.flatMap((section) => section.items.map((item) => [item.href, item.label])),
)

const EXTRA_SEGMENT_LABEL: Record<string, string> = {
  new: 'New',
  edit: 'Edit',
  billing: 'Billing',
  payouts: 'Payouts',
  integrations: 'Integrations',
  notifications: 'Notifications',
}

const RECORD_ID = /^[a-z]{2,6}_[a-z0-9]+$/i

interface Crumb {
  label: string
  href: string
}

export function buildBreadcrumb(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: Crumb[] = []
  let href = ''

  for (const segment of segments) {
    href += `/${segment}`
    const label =
      NAV_LABEL_BY_HREF[href] ??
      EXTRA_SEGMENT_LABEL[segment] ??
      (RECORD_ID.test(segment) ? 'Details' : titleCase(decodeURIComponent(segment)))
    crumbs.push({ label, href })
  }

  // The trail always starts at the overview, whether or not the route nests
  // under /dashboard.
  if (segments[0] === 'dashboard') {
    crumbs[0] = { label: 'Overview', href: '/dashboard' }
  } else {
    crumbs.unshift({ label: 'Overview', href: '/dashboard' })
  }

  return crumbs
}

function RouteBreadcrumb({ className }: { className?: string }) {
  const pathname = usePathname() ?? '/dashboard'
  const crumbs = buildBreadcrumb(pathname)

  if (crumbs.length <= 1) {
    return (
      <p className={cn('truncate text-[0.8125rem] font-medium text-foreground', className)}>
        {crumbs[0]?.label ?? 'Overview'}
      </p>
    )
  }

  // Keep the first and the last two — the middle collapses into an ellipsis.
  const collapsed = crumbs.length > 3
  const shown = collapsed ? [crumbs[0], ...crumbs.slice(-2)] : crumbs

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="flex-nowrap">
        {shown.map((crumb, index) => {
          const isLast = index === shown.length - 1
          return (
            <React.Fragment key={crumb.href}>
              {collapsed && index === 1 ? (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbEllipsis />
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              ) : null}
              <BreadcrumbItem className="min-w-0">
                {isLast ? (
                  <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href} className="truncate">
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? <BreadcrumbSeparator /> : null}
            </React.Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

/* ==========================================================================
   TOPBAR
   ========================================================================== */

export function Topbar({ navCounts, notifications, className }: { navCounts: NavCounts; notifications: NotificationItem[]; className?: string }) {
  const { setOpen, setNewBookingOpen } = useCommandPalette()
  const { toggleTheme } = useTheme()

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-line',
        'bg-surface/75 px-3 backdrop-blur-xl backdrop-saturate-150 sm:px-4 lg:px-6',
        className,
      )}
    >
      {/* Left — navigation context */}
      <div className="flex min-w-0 shrink items-center gap-1.5">
        <MobileSidebar navCounts={navCounts} />
        <RouteBreadcrumb className="hidden min-w-0 md:flex" />
      </div>

      {/* Centre — search */}
      <div className="flex min-w-0 flex-1 justify-center px-1 sm:px-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            'group hidden h-9 w-full max-w-md items-center gap-2.5 rounded-lg border border-line',
            'bg-surface-sunken px-3 text-sm text-faint transition-all duration-200 ease-[var(--ease-out-expo)]',
            'hover:border-line-strong hover:bg-surface hover:text-subtle',
            'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            'sm:flex',
          )}
        >
          <Search aria-hidden="true" className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left">Search…</span>
          <KbdGroup keys={['⌘', 'K']} size="sm" className="shrink-0" />
        </button>
      </div>

      {/* Right — status and actions */}
      <div className="flex shrink-0 items-center gap-1">
        <SimpleTooltip
          label={`Today in ${CURRENT_TENANT.city}, ${CURRENT_TENANT.country} — open the calendar`}
          side="bottom"
        >
          <Link
            href="/dashboard/calendar"
            className={cn(
              'hidden h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5',
              'text-xs font-medium text-muted transition-colors xl:inline-flex',
              'hover:border-line-strong hover:text-foreground',
              'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            <CalendarDays aria-hidden="true" className="size-3.5 text-subtle" />
            {formatDateLong(NOW)}
          </Link>
        </SimpleTooltip>

        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Search"
          onClick={() => setOpen(true)}
          className="sm:hidden"
        >
          <Search aria-hidden="true" />
        </IconButton>

        <NotificationsMenu items={notifications} now={NOW} />

        {/* The `.dark` class is applied before first paint, so CSS — not state —
            picks the glyph. No flash, no hydration branch. */}
        <IconButton variant="ghost" size="sm" aria-label="Toggle colour theme" onClick={toggleTheme}>
          <>
            <SunMedium aria-hidden="true" className="hidden dark:block" />
            <MoonStar aria-hidden="true" className="dark:hidden" />
          </>
        </IconButton>

        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />

        <Button
          size="sm"
          onClick={() => setNewBookingOpen(true)}
          leftIcon={<Plus aria-hidden="true" />}
          className="hidden sm:inline-flex"
        >
          New booking
        </Button>

        <IconButton
          size="sm"
          aria-label="New booking"
          onClick={() => setNewBookingOpen(true)}
          className="sm:hidden"
        >
          <Plus aria-hidden="true" />
        </IconButton>

        <div className="ml-1">
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
