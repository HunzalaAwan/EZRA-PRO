'use client'

import Link from 'next/link'
import {
  ArrowRight,
  CircleX,
  CreditCard,
  Radio,
  Settings2,
  Star,
  Ticket,
  Users,
  type LucideIcon,
} from 'lucide-react'

import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Avatar } from '@/components/ui/avatar'
import { Card, CardDescription, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { cn, formatCurrency, formatRelative } from '@/lib/utils'
import type { ActivityFeedItem, NotificationItem } from '@/types'

/* ==========================================================================
   ActivityFeed — the pulse of the business.

   Every item is a real booking, cancellation or review from the seam. The
   avatar column doubles as the timeline rail: a hairline runs the full height
   of each row behind an opaque avatar, so consecutive rows join into one
   continuous thread with no per-row connector maths.
   ========================================================================== */

interface KindLook {
  icon: LucideIcon
  badge: string
  label: string
}

const KIND: Record<NotificationItem['kind'], KindLook> = {
  booking: { icon: Ticket, badge: 'bg-info text-on-primary', label: 'New booking' },
  payment: { icon: CreditCard, badge: 'bg-success text-on-primary', label: 'Payment' },
  cancellation: { icon: CircleX, badge: 'bg-danger text-on-primary', label: 'Cancellation' },
  review: { icon: Star, badge: 'bg-warning text-on-accent', label: 'Review' },
  capacity: { icon: Users, badge: 'bg-accent text-on-accent', label: 'Capacity' },
  system: { icon: Settings2, badge: 'bg-faint text-on-primary', label: 'System' },
}

export interface ActivityFeedProps {
  items: ActivityFeedItem[]
  /** Local ISO "now" — relative times are measured from the frozen clock. */
  nowIso: string
  className?: string
}

export function ActivityFeed({ items, nowIso, className }: ActivityFeedProps) {
  const now = new Date(nowIso)

  return (
    <Card className={cn('flex h-full flex-col overflow-hidden', className)}>
      <CardHeader flush={items.length > 0}>
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2">
            Live activity
            <span className="relative inline-flex size-1.5 shrink-0">
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-success motion-safe:animate-pulse-ring"
              />
              <span aria-hidden="true" className="relative size-1.5 rounded-full bg-success" />
            </span>
          </CardTitle>
          <CardDescription>Bookings, payments, reviews and cancellations as they land.</CardDescription>
        </div>
        <CardToolbar>
          <Link
            href="/dashboard/bookings"
            className={cn(
              'group inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-muted',
              'transition-colors duration-200 hover:text-foreground',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            )}
          >
            View all
            <ArrowRight
              aria-hidden="true"
              className="size-3.5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5"
            />
          </Link>
        </CardToolbar>
      </CardHeader>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-5 pb-6">
          <EmptyState
            size="sm"
            variant="no-data"
            icon={Radio}
            title="Nothing has happened yet"
            description="Bookings, payments and reviews stream in here the moment they occur."
          />
        </div>
      ) : (
        <StaggerGroup
          as="ol"
          stagger={0.035}
          className="min-h-0 flex-1 overflow-y-auto py-2 no-scrollbar"
        >
          {items.map((item) => {
            const look = KIND[item.kind]
            const Icon = look.icon

            return (
              <StaggerItem
                as="li"
                key={item.id}
                distance={10}
                className="flex gap-3 px-5 hover:bg-surface-sunken/40"
              >
                {/* rail + actor */}
                <div className="relative flex w-8 shrink-0 justify-center">
                  <span aria-hidden="true" className="absolute inset-y-0 w-px bg-line-subtle" />
                  <span className="relative mt-3 grid size-8 shrink-0 place-items-center rounded-full bg-surface">
                    <Avatar name={item.actor} src={item.actorAvatar} size="sm" />
                    <span
                      className={cn(
                        'absolute -right-0.5 -bottom-0.5 grid size-4 place-items-center rounded-full ring-2 ring-surface',
                        look.badge,
                      )}
                    >
                      <Icon aria-hidden="true" className="size-2.5" strokeWidth={2.6} />
                      <span className="sr-only">{look.label}</span>
                    </span>
                  </span>
                </div>

                {/* body */}
                <div className="min-w-0 flex-1 py-3">
                  <p className="text-[0.8125rem] leading-snug text-muted">
                    <span className="font-semibold text-foreground">{item.actor}</span> {item.verb}{' '}
                    <span className="font-medium text-foreground">{item.target}</span>
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <time
                      dateTime={item.createdAt}
                      className="text-[0.6875rem] text-faint tabular-nums"
                    >
                      {formatRelative(item.createdAt, now)}
                    </time>

                    {typeof item.amount === 'number' && item.amount !== 0 ? (
                      <span
                        className={cn(
                          'rounded-md px-1.5 py-0.5 text-[0.6875rem] font-semibold tabular-nums',
                          item.kind === 'cancellation'
                            ? 'bg-danger-soft text-danger'
                            : 'bg-success-soft text-success',
                        )}
                      >
                        {item.kind === 'cancellation' ? '−' : '+'}
                        {formatCurrency(Math.abs(item.amount), item.currency)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      )}
    </Card>
  )
}
