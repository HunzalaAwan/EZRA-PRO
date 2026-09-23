'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'

import { useWorkspace } from '@/components/dashboard/workspace-provider'
import { cn } from '@/lib/utils'
import { IconButton } from '@/components/ui/icon-button'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Logo } from '@/components/marketing/logo'
import { DashboardNavList, PlanUsageCard, type NavCounts } from '@/components/dashboard/sidebar'
import { TenantSwitcher } from '@/components/dashboard/tenant-switcher'

/* ==========================================================================
   MOBILE SIDEBAR

   Below `lg` the rail is replaced by a left sheet carrying the identical nav.
   The sheet closes on navigation — App Router keeps the layout mounted across
   route changes, so nothing else would dismiss it.
   ========================================================================== */

export function MobileSidebar({ navCounts, className }: { navCounts: NavCounts; className?: string }) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const { tenant } = useWorkspace()

  React.useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label="Open navigation"
          className={cn('lg:hidden', className)}
        >
          <Menu aria-hidden="true" />
        </IconButton>
      </SheetTrigger>

      <SheetContent side="left" size="sm" className="type-nav w-[19rem] p-0 sm:max-w-[19rem]">
        <SheetHeader className="py-3.5 pl-4">
          <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Jump to any section of the {tenant.name} workspace.
          </SheetDescription>
          <Link
            href="/dashboard"
            aria-label="EZRA Pro dashboard home"
            className="flex w-fit items-center rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-raised"
          >
            <Logo size="sm" />
          </Link>
        </SheetHeader>

        <SheetBody className="px-3 py-3">
          <TenantSwitcher />
          <div className="mt-4">
            <DashboardNavList layoutId="mobile-nav-indicator" navCounts={navCounts} onNavigate={() => setOpen(false)} />
          </div>
        </SheetBody>

        <div className="shrink-0 border-t border-line-subtle p-3">
          <PlanUsageCard />
        </div>
      </SheetContent>
    </Sheet>
  )
}
