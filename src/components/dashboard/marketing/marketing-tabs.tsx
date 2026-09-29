'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

/* ==========================================================================
   Marketing sub-navigation: one row of tabs under the page title. Scrolls
   sideways on a phone.
   ========================================================================== */

export const MARKETING_TABS = [
  { href: '/dashboard/marketing', label: 'Overview' },
  { href: '/dashboard/marketing/automations', label: 'Automations' },
  { href: '/dashboard/marketing/campaigns', label: 'Campaigns' },
  { href: '/dashboard/marketing/audiences', label: 'Audiences' },
  { href: '/dashboard/marketing/forms', label: 'Sign-up forms' },
  { href: '/dashboard/marketing/templates', label: 'Email templates' },
  { href: '/dashboard/marketing/settings', label: 'Settings' },
] as const

export function MarketingTabs() {
  const pathname = usePathname()
  return (
    <nav aria-label="Marketing" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max list-none gap-1 border-b border-line p-0">
        {MARKETING_TABS.map((tab) => {
          const active = tab.href === '/dashboard/marketing' ? pathname === tab.href : pathname.startsWith(tab.href)
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  '-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap transition-colors',
                  active ? 'border-primary text-foreground' : 'border-transparent text-muted hover:text-foreground',
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
