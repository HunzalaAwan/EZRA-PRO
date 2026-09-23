'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import {
  Building2,
  ChevronRight,
  CreditCard,
  MapPin,
  Plug,
  ReceiptText,
  TicketCheck,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'

/* ==========================================================================
   SETTINGS SUB-NAVIGATION

   A left rail on desktop, a horizontally scrolling chip row above the content
   on mobile. The active marker is a shared-layout element so moving between
   sections slides rather than blinks.
   ========================================================================== */

export interface SettingsNavItem {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    href: '/dashboard/settings',
    label: 'General',
    description: 'Business profile, contact and locale',
    icon: Building2,
  },
  {
    href: '/dashboard/settings/locations',
    label: 'Locations',
    description: 'The bases you run from',
    icon: MapPin,
  },
  {
    href: '/dashboard/settings/booking',
    label: 'Booking flow',
    description: 'Cancellation, deposits and guest details',
    icon: TicketCheck,
  },
  {
    href: '/dashboard/settings/payments',
    label: 'Payments',
    description: 'Processor, payouts, tax and tipping',
    icon: CreditCard,
  },
  {
    href: '/dashboard/settings/integrations',
    label: 'Integrations',
    description: 'Connected apps and marketplaces',
    icon: Plug,
  },
  {
    href: '/dashboard/settings/billing',
    label: 'Billing',
    description: 'Plan, usage, invoices and payment method',
    icon: ReceiptText,
  },
]

function isActive(pathname: string, href: string) {
  // The index route must not light up for "/dashboard/settings/branding".
  return href === '/dashboard/settings'
    ? pathname === '/dashboard/settings'
    : pathname.startsWith(href)
}

export interface SettingsNavProps {
  className?: string
}

export function SettingsNav({ className }: SettingsNavProps) {
  const pathname = usePathname()
  const reduceMotion = useReducedMotionSafe()

  return (
    <nav aria-label="Settings sections" className={className}>
      {/* ---------- Mobile: scrolling chip row ---------- */}
      <div className="no-scrollbar -mx-4 overflow-x-auto px-4 lg:hidden">
        <ul className="flex w-max items-center gap-1.5 rounded-xl border border-line-subtle bg-surface-sunken p-1">
          {SETTINGS_NAV.map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative isolate inline-flex items-center gap-2 rounded-lg px-3 py-2',
                    'text-[0.8125rem] font-medium whitespace-nowrap transition-colors duration-200',
                    active ? 'text-foreground' : 'text-muted hover:text-foreground',
                  )}
                >
                  {active ? (
                    <motion.span
                      aria-hidden="true"
                      layoutId="settings-nav-chip"
                      className="absolute inset-0 -z-10 rounded-lg bg-surface-raised shadow-sm ring-1 ring-line-subtle"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 480, damping: 38, mass: 0.7 }
                      }
                    />
                  ) : null}
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>

      {/* ---------- Desktop: descriptive rail ---------- */}
      <ul className="hidden lg:sticky lg:top-20 lg:flex lg:flex-col lg:gap-1">
        {SETTINGS_NAV.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative isolate flex items-start gap-3 rounded-xl px-3 py-2.5',
                  'transition-colors duration-200 ease-[var(--ease-out-expo)]',
                  active ? 'text-foreground' : 'text-muted hover:text-foreground',
                )}
              >
                {active ? (
                  <motion.span
                    aria-hidden="true"
                    layoutId="settings-nav-rail"
                    className={cn(
                      'absolute inset-0 -z-10 rounded-xl border border-line-subtle bg-surface',
                      'shadow-sm',
                    )}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 460, damping: 40, mass: 0.8 }
                    }
                  />
                ) : null}

                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-px grid size-8 shrink-0 place-items-center rounded-lg transition-colors duration-200',
                    active
                      ? 'bg-primary-soft text-primary'
                      : 'bg-surface-sunken text-subtle group-hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                </span>

                <span className="min-w-0 flex-1 py-0.5">
                  <span className="block text-sm font-medium tracking-[-0.01em]">{item.label}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-subtle">
                    {item.description}
                  </span>
                </span>

                <ChevronRight
                  aria-hidden="true"
                  className={cn(
                    'mt-2 size-4 shrink-0 transition-all duration-200',
                    active
                      ? 'translate-x-0 text-primary opacity-100'
                      : '-translate-x-1 text-faint opacity-0 group-hover:translate-x-0 group-hover:opacity-100',
                  )}
                />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
