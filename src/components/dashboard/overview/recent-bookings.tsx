'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Inbox } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Badge, StatusBadge, bookingStatusMeta } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn, formatCurrency, formatDateTime, formatNumber, formatRelative, pluralize } from '@/lib/utils'
import type { BookingRow } from '@/lib/demo'
import type { BookingChannel, BookingStatus } from '@/types'

/* ==========================================================================
   RecentBookings — the newest eight, joined to guest, activity and departure.

   A row of status pills above the table narrows it in place — the same
   gesture as the bookings page, on the handful of rows that matter today.
   Each row is reachable through one stretched `<Link>` in the first cell,
   which keeps it keyboard-navigable and leaves the table semantics intact.
   Below `md` the same rows render as cards.
   ========================================================================== */

export interface RecentBookingsProps {
  rows: BookingRow[]
  /** Local ISO "now" — relative times are measured from the frozen clock. */
  nowIso: string
  /** `CHANNEL_LABELS` from the data seam, passed in so this stays a leaf. */
  channelLabels: Record<BookingChannel, string>
  className?: string
}

/** Channel chips borrow the neutral/outline end of the badge scale on purpose:
 *  status is the signal in this table, provenance is context. */
const CHANNEL_VARIANT: Partial<Record<BookingChannel, 'neutral' | 'outline' | 'info' | 'primary'>> = {
  website_widget: 'primary',
  direct: 'info',
  ota: 'neutral',
  phone: 'neutral',
  walk_in: 'outline',
  reseller: 'outline',
  concierge: 'neutral',
  google: 'outline',
}

type Filter = 'all' | BookingStatus

export function RecentBookings({ rows, nowIso, channelLabels, className }: RecentBookingsProps) {
  const now = new Date(nowIso)
  const [filter, setFilter] = React.useState<Filter>('all')

  // Only the statuses actually present, in the seam's canonical order.
  const filters = React.useMemo(() => {
    const counts = new Map<BookingStatus, number>()
    for (const row of rows) counts.set(row.booking.status, (counts.get(row.booking.status) ?? 0) + 1)
    const present = (Object.keys(bookingStatusMeta) as BookingStatus[]).filter((s) => counts.has(s))
    return [
      { key: 'all' as Filter, label: 'All', count: rows.length },
      ...present.map((s) => ({ key: s as Filter, label: bookingStatusMeta[s].label, count: counts.get(s) ?? 0 })),
    ]
  }, [rows])

  const visible = filter === 'all' ? rows : rows.filter((r) => r.booking.status === filter)

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader flush={rows.length > 0}>
        <div className="min-w-0">
          <CardTitle>Recent bookings</CardTitle>
          <CardDescription>
            {rows.length === 0
              ? 'Nothing has come in yet.'
              : `The last ${formatNumber(rows.length)} reservations across every channel.`}
          </CardDescription>
        </div>
        <CardToolbar>
          {rows.length > 0 ? (
            <div className="hidden flex-wrap items-center gap-1 sm:flex" role="group" aria-label="Filter by status">
              {filters.map((f) => {
                const active = f.key === filter
                return (
                  <button
                    key={f.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(f.key)}
                    className={cn(
                      'inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-[0.75rem] font-medium transition-colors duration-200',
                      active
                        ? 'bg-foreground text-background'
                        : 'text-muted hover:bg-surface-sunken hover:text-foreground',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    )}
                  >
                    {f.label}
                    <span className={cn('tabular-nums', active ? 'text-background/70' : 'text-faint')}>{f.count}</span>
                  </button>
                )
              })}
            </div>
          ) : null}
          <Button asChild variant="ghost" size="sm" rightIcon={<ArrowRight />}>
            <Link href="/dashboard/bookings">All bookings</Link>
          </Button>
        </CardToolbar>
      </CardHeader>

      {rows.length === 0 ? (
        <CardContent>
          <EmptyState
            variant="no-data"
            icon={Inbox}
            title="No bookings yet"
            description="New reservations land here the moment they are taken — on the widget, over the phone or at the desk."
            action={
              <Button asChild size="sm">
                <Link href="/dashboard/bookings?new=1">Take a booking</Link>
              </Button>
            }
          />
        </CardContent>
      ) : (
        <>
          {/* ---- mobile: stacked cards ---------------------------------- */}
          <ul className="divide-y divide-line-subtle border-t border-line-subtle md:hidden">
            {visible.map(({ booking, activity, customer }) => {
              const guest = `${customer.firstName} ${customer.lastName}`
              return (
                <li key={booking.id}>
                  <Link
                    href={`/dashboard/bookings?ref=${booking.reference}`}
                    className="flex gap-3 px-5 py-3.5 transition-colors duration-200 hover:bg-surface-sunken/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                  >
                    <Avatar name={guest} src={customer.avatarUrl} size="sm" className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[0.8125rem] font-semibold text-foreground">{guest}</p>
                        <span className="shrink-0 text-[0.8125rem] font-semibold text-foreground tabular-nums">
                          {formatCurrency(booking.total, booking.currency)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">{activity.name}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <StatusBadge kind="booking" status={booking.status} size="sm" />
                        <Badge variant={CHANNEL_VARIANT[booking.channel] ?? 'neutral'} size="sm">
                          {channelLabels[booking.channel]}
                        </Badge>
                        <span className="text-[0.6875rem] text-faint">
                          {booking.partySize} {pluralize(booking.partySize, 'guest')} ·{' '}
                          {formatRelative(booking.createdAt, now)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* ---- md and up: table --------------------------------------- */}
          <div className="hidden md:block">
            <Table density="compact" containerClassName="border-t border-line-subtle">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5 sm:pl-6">Guest</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead align="right" numeric>
                    Party
                  </TableHead>
                  <TableHead align="right" numeric>
                    Total
                  </TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead align="right" className="pr-5 sm:pr-6">
                    Booked
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {visible.map(({ booking, activity, customer, departure }) => {
                  const guest = `${customer.firstName} ${customer.lastName}`
                  return (
                    <TableRow key={booking.id} interactive className="group relative">
                      <TableCell className="pl-5 sm:pl-6">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={guest} src={customer.avatarUrl} size="sm" className="shrink-0" />
                          <div className="min-w-0">
                            <Link
                              href={`/dashboard/bookings?ref=${booking.reference}`}
                              className={cn(
                                'block truncate text-[0.8125rem] font-semibold text-foreground',
                                'transition-colors duration-200 group-hover:text-primary',
                                'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                                // Stretched hit area — the whole row opens the booking.
                                'after:absolute after:inset-0 after:content-[""]',
                              )}
                            >
                              {guest}
                            </Link>
                            <p className="truncate font-mono text-[0.6875rem] text-faint">
                              {booking.reference}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        <p className="max-w-[15rem] truncate text-[0.8125rem] text-foreground">
                          {activity.name}
                        </p>
                        <p className="truncate text-[0.6875rem] text-faint tabular-nums">
                          {formatDateTime(departure.startsAt)}
                        </p>
                      </TableCell>

                      <TableCell align="right" numeric className="text-[0.8125rem]">
                        {booking.partySize}
                      </TableCell>

                      <TableCell align="right" numeric className="text-[0.8125rem]">
                        {formatCurrency(booking.total, booking.currency)}
                      </TableCell>

                      <TableCell>
                        <Badge variant={CHANNEL_VARIANT[booking.channel] ?? 'neutral'} size="sm">
                          {channelLabels[booking.channel]}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <StatusBadge kind="booking" status={booking.status} size="sm" />
                      </TableCell>

                      <TableCell align="right" className="pr-5 whitespace-nowrap sm:pr-6">
                        <span className="text-[0.6875rem] text-subtle">
                          {formatRelative(booking.createdAt, now)}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {visible.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-subtle">
                      No {filter === 'all' ? '' : bookingStatusMeta[filter as BookingStatus].label.toLowerCase()} bookings
                      in the last {formatNumber(rows.length)}.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Card>
  )
}
