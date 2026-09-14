'use client'

import Link from 'next/link'
import { ArrowRight, Inbox } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Badge, StatusBadge } from '@/components/ui/badge'
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
import type { BookingChannel } from '@/types'

/* ==========================================================================
   RecentBookings — the newest eight, joined to guest, activity and departure.

   No client JavaScript: the whole row is reachable through one stretched
   `<Link>` in the first cell, which keeps it keyboard-navigable and leaves the
   table semantics intact. Below `md` the same rows render as cards.
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

export function RecentBookings({ rows, nowIso, channelLabels, className }: RecentBookingsProps) {
  const now = new Date(nowIso)

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
            {rows.map(({ booking, activity, customer }) => {
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
                {rows.map(({ booking, activity, customer, departure }) => {
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
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Card>
  )
}
