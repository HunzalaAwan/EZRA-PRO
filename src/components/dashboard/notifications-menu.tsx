'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Bell,
  BellOff,
  CalendarX2,
  CheckCheck,
  CreditCard,
  Star,
  Ticket,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import type { NotificationItem } from '@/types'
import { cn, formatRelative } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Segmented } from '@/components/ui/segmented'

/* ==========================================================================
   NOTIFICATIONS

   The list is real data built from real rows. "Read" is local session state —
   nothing persists, but the interaction behaves exactly as it would.
   ========================================================================== */

const KIND_ICON: Record<NotificationItem['kind'], LucideIcon> = {
  booking: Ticket,
  cancellation: CalendarX2,
  payment: CreditCard,
  review: Star,
  system: Wrench,
  capacity: Users,
}

const SEVERITY_TINT: Record<NotificationItem['severity'], string> = {
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
}

type NotificationTab = 'all' | 'unread'

function NotificationRow({
  item,
  unread,
  now,
  onActivate,
}: {
  item: NotificationItem
  unread: boolean
  now: Date
  onActivate: () => void
}) {
  const Icon = KIND_ICON[item.kind]

  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl',
          SEVERITY_TINT[item.severity],
        )}
      >
        <Icon className="size-[1.125rem]" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-start gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 text-[0.8125rem] leading-snug tracking-[-0.01em]',
              unread ? 'font-semibold text-foreground' : 'font-medium text-muted',
            )}
          >
            {item.title}
          </span>
          {unread ? (
            <span
              aria-label="Unread"
              className="mt-1.5 size-2 shrink-0 rounded-full bg-accent"
            />
          ) : null}
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-subtle line-clamp-2">
          {item.body}
        </span>
        <span className="mt-1.5 block text-xs text-faint">
          {formatRelative(item.createdAt, now)}
        </span>
      </span>
    </>
  )

  const className = cn(
    'flex w-full gap-3 px-3 py-3 text-left transition-colors duration-150',
    'hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-hidden',
    unread && 'bg-primary-soft/35',
  )

  if (item.href) {
    return (
      <Link href={item.href} onClick={onActivate} className={className}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onActivate} className={className}>
      {content}
    </button>
  )
}

export interface NotificationsMenuProps {
  /** Fetched server-side — this file never imports `@/lib/demo` itself. */
  items: NotificationItem[]
  now: Date
  className?: string
}

export function NotificationsMenu({ items, now: NOW, className }: NotificationsMenuProps) {
  const [readIds, setReadIds] = React.useState<ReadonlyArray<string>>([])
  const [tab, setTab] = React.useState<NotificationTab>('all')
  const [open, setOpen] = React.useState(false)

  const isUnread = React.useCallback(
    (item: NotificationItem) => !item.read && !readIds.includes(item.id),
    [readIds],
  )

  const unreadCount = items.filter(isUnread).length
  const visible = tab === 'unread' ? items.filter(isUnread) : items

  const markAllRead = () => setReadIds(items.map((item) => item.id))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label={
            unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications, none unread'
          }
          className={cn('relative', className)}
        >
          <Bell aria-hidden="true" />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 grid min-w-[1.125rem] place-items-center rounded-full bg-accent px-1 text-xs leading-[1.125rem] font-bold text-on-accent ring-2 ring-surface tabular-nums"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </IconButton>
      </PopoverTrigger>

      <PopoverContent align="end" padding="none" width="auto" className="w-[24rem] max-w-[calc(100vw-1.5rem)]">
        <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-3 py-2.5">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-sm font-semibold tracking-tight">Notifications</h2>
            {unreadCount > 0 ? (
              <Badge variant="accent" size="sm">
                {unreadCount} new
              </Badge>
            ) : null}
          </div>
          <Button
            size="xs"
            variant="ghost"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            leftIcon={<CheckCheck aria-hidden="true" />}
          >
            Mark all read
          </Button>
        </div>

        <div className="border-b border-line-subtle px-3 py-2">
          <Segmented<NotificationTab>
            label="Filter notifications"
            size="sm"
            value={tab}
            onValueChange={setTab}
            options={[
              { value: 'all', label: 'All', count: items.length },
              { value: 'unread', label: 'Unread', count: unreadCount },
            ]}
          />
        </div>

        {visible.length > 0 ? (
          <ScrollArea className="max-h-[24rem]" viewportClassName="max-h-[24rem]">
            <ul className="divide-y divide-line-subtle">
              {visible.map((item) => (
                <li key={item.id}>
                  <NotificationRow
                    item={item}
                    unread={isUnread(item)}
                    now={NOW}
                    onActivate={() => {
                      setReadIds((previous) =>
                        previous.includes(item.id) ? previous : [...previous, item.id],
                      )
                      if (item.href) setOpen(false)
                    }}
                  />
                </li>
              ))}
            </ul>
          </ScrollArea>
        ) : (
          <EmptyState
            size="sm"
            variant="no-results"
            icon={BellOff}
            title="You're all caught up"
            description={
              tab === 'unread'
                ? 'Every notification has been read.'
                : 'New bookings, reviews and payouts will land here.'
            }
          />
        )}

        <div className="border-t border-line-subtle px-3 py-2">
          <Button asChild size="xs" variant="ghost" fullWidth>
            <Link href="/dashboard" onClick={() => setOpen(false)}>
              View all activity
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
