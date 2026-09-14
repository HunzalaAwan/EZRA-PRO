'use client'

import * as React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  CheckCheck,
  CircleX,
  Download,
  Send,
  Users,
  X,
} from 'lucide-react'

import type { BookingRow } from '@/lib/demo'
import { CHANNEL_LABELS } from '@/lib/demo-core'
import type { BadgeVariant } from '@/components/ui/badge'
import type { BookingChannel, CurrencyCode } from '@/types'
import { cn, formatCurrency, formatDateShort, formatTime } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'

/* ==========================================================================
   CHANNEL CHIP
   One tint per acquisition channel so the mix is readable at a glance down
   the column.
   ========================================================================== */

const CHANNEL_VARIANT: Record<BookingChannel, BadgeVariant> = {
  website_widget: 'primary',
  direct: 'info',
  ota: 'accent',
  phone: 'neutral',
  walk_in: 'success',
  reseller: 'warning',
  concierge: 'info',
  google: 'outline',
}

export function ChannelBadge({ channel }: { channel: BookingChannel }) {
  return (
    <Badge variant={CHANNEL_VARIANT[channel]} size="sm" dot>
      {CHANNEL_LABELS[channel]}
    </Badge>
  )
}

/* ==========================================================================
   BULK ACTION BAR
   Slides up from the bottom of the viewport once rows are ticked — the desk
   never loses the table while acting on a selection.
   ========================================================================== */

interface BulkActionBarProps {
  count: number
  onClear: () => void
  onAction: (action: 'confirm' | 'message' | 'export' | 'cancel') => void
}

function BulkActionBar({ count, onClear, onAction }: BulkActionBarProps) {
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
          transition={
            reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }
          }
          className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4 print:hidden"
        >
          <div
            role="status"
            aria-live="polite"
            className={cn(
              'pointer-events-auto flex w-full max-w-[44rem] items-center gap-2 overflow-x-auto',
              'glass-strong rounded-2xl border border-line-strong px-2.5 py-2 shadow-2xl no-scrollbar',
            )}
          >
            <span className="ml-1 inline-flex shrink-0 items-center gap-2 pr-1 text-sm font-semibold text-foreground">
              <span className="grid size-6 place-items-center rounded-full bg-primary text-[0.6875rem] font-bold text-on-primary tabular-nums">
                {count > 99 ? '99+' : count}
              </span>
              <span className="hidden sm:inline">selected</span>
            </span>

            <span aria-hidden="true" className="h-6 w-px shrink-0 bg-line" />

            <Button size="sm" variant="primary" leftIcon={<CheckCheck />} onClick={() => onAction('confirm')}>
              Confirm
            </Button>
            <Button size="sm" variant="secondary" leftIcon={<Send />} onClick={() => onAction('message')}>
              Message
            </Button>
            <Button size="sm" variant="secondary" leftIcon={<Download />} onClick={() => onAction('export')}>
              Export
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<CircleX />}
              className="text-danger hover:bg-danger-soft hover:text-danger"
              onClick={() => onAction('cancel')}
            >
              Cancel
            </Button>

            <button
              type="button"
              onClick={onClear}
              aria-label="Clear selection"
              className={cn(
                'ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-subtle',
                'transition-colors duration-150 hover:bg-surface-sunken hover:text-foreground',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              )}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/* ==========================================================================
   MOBILE CARD
   Phones get stacked cards instead of a table that scrolls sideways.
   ========================================================================== */

function BookingCard({
  row,
  selected,
  onToggle,
  onOpen,
  currency,
}: {
  row: BookingRow
  selected: boolean
  onToggle: () => void
  onOpen: () => void
  currency: CurrencyCode
}) {
  const { booking, activity, customer, departure } = row
  const name = `${customer.firstName} ${customer.lastName}`

  return (
    <li
      className={cn(
        'relative flex items-stretch gap-2 rounded-2xl border bg-surface p-3',
        'transition-[border-color,box-shadow,background-color] duration-200 ease-[var(--ease-out-expo)]',
        'has-[button:focus-visible]:ring-2 has-[button:focus-visible]:ring-primary',
        selected ? 'border-primary/55 bg-primary-soft/25 shadow-sm' : 'border-line',
      )}
    >
      {/* Whole-card target, painted under the controls so the checkbox still wins. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open booking ${booking.reference}`}
        className="absolute inset-0 rounded-2xl focus:outline-none"
      />

      <div className="relative z-10 flex shrink-0 items-start pt-0.5">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          aria-label={`Select booking ${booking.reference}`}
        />
      </div>

      <div className="pointer-events-none relative min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[0.8125rem] font-semibold tracking-tight text-foreground">
            {booking.reference}
          </span>
          <StatusBadge kind="booking" status={booking.status} size="sm" showIcon={false} />
        </div>

        <div className="mt-2.5 flex items-center gap-2.5">
          <Avatar name={name} src={customer.avatarUrl} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{name}</span>
            <span className="block truncate text-xs text-subtle">{customer.email}</span>
          </span>
        </div>

        <p className="mt-2.5 truncate text-[0.8125rem] font-medium text-foreground">
          {activity.name}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
          <span className="tabular-nums">
            {formatDateShort(departure.startsAt)} · {formatTime(departure.startsAt)}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Users aria-hidden="true" className="size-3.5 text-faint" />
            {booking.partySize}
          </span>
          <ChannelBadge channel={booking.channel} />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-subtle pt-2.5">
          <StatusBadge kind="payment" status={booking.paymentStatus} size="sm" />
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {formatCurrency(booking.total, currency)}
          </span>
        </div>
      </div>

    </li>
  )
}

/* ==========================================================================
   TABLE
   ========================================================================== */

export interface BookingsTableProps {
  /** Rows for the current page only. */
  rows: BookingRow[]
  currency: CurrencyCode
  sort: DataTableSort
  onSortChange: (sort: DataTableSort) => void
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onRowClick: (row: BookingRow) => void
  onBulkAction: (action: 'confirm' | 'message' | 'export' | 'cancel', ids: string[]) => void
  page: number
  pageCount: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onClearFilters: () => void
  loading?: boolean
  className?: string
}

export function BookingsTable({
  rows,
  currency,
  sort,
  onSortChange,
  selectedIds,
  onSelectionChange,
  onRowClick,
  onBulkAction,
  page,
  pageCount,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  onClearFilters,
  loading = false,
  className,
}: BookingsTableProps) {
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds])

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(Array.from(next))
  }

  const columns = React.useMemo<DataTableColumn<BookingRow>[]>(
    () => [
      {
        id: 'reference',
        header: 'Reference',
        sortable: true,
        width: '9.5rem',
        cell: ({ booking }) => (
          <span className="flex flex-col">
            <span className="font-mono text-[0.8125rem] font-semibold tracking-tight text-foreground">
              {booking.reference}
            </span>
            {booking.promoCode ? (
              <span className="font-mono text-[0.6875rem] text-accent">{booking.promoCode}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'guest',
        header: 'Guest',
        sortable: true,
        width: '17rem',
        cell: ({ customer }) => {
          const name = `${customer.firstName} ${customer.lastName}`
          return (
            <span className="flex min-w-0 items-center gap-2.5">
              <Avatar name={name} src={customer.avatarUrl} size="sm" />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[0.8125rem] font-medium text-foreground">
                    {name}
                  </span>
                  {customer.segment === 'vip' ? (
                    <Badge variant="accent" size="sm">
                      VIP
                    </Badge>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-subtle">{customer.email}</span>
              </span>
            </span>
          )
        },
      },
      {
        id: 'activity',
        header: 'Experience',
        sortable: true,
        hideBelow: 'lg',
        cell: ({ activity, departure }) => (
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'h-6 w-1 shrink-0 rounded-full',
                activity.colorKey === 'lagoon' && 'bg-chart-1',
                activity.colorKey === 'coral' && 'bg-chart-2',
                activity.colorKey === 'sunset' && 'bg-chart-4',
                activity.colorKey === 'reef' && 'bg-chart-3',
                activity.colorKey === 'info' && 'bg-chart-5',
                activity.colorKey === 'success' && 'bg-chart-6',
              )}
            />
            <span className="min-w-0">
              <span className="block truncate text-[0.8125rem] font-medium text-foreground">
                {activity.name}
              </span>
              {departure.status === 'cancelled' || departure.status === 'weather_hold' ? (
                <StatusBadge
                  kind="departure"
                  status={departure.status}
                  size="sm"
                  showIcon={false}
                  className="mt-0.5"
                />
              ) : (
                <span className="block truncate text-xs text-subtle">{activity.meetingPoint}</span>
              )}
            </span>
          </span>
        ),
      },
      {
        id: 'departure',
        header: 'Departure',
        sortable: true,
        numeric: true,
        width: '9rem',
        defaultSortDir: 'desc',
        cell: ({ departure }) => (
          <span className="flex flex-col">
            <span className="text-[0.8125rem] font-medium text-foreground">
              {formatDateShort(departure.startsAt)}
            </span>
            <span className="text-xs text-subtle">{formatTime(departure.startsAt)}</span>
          </span>
        ),
      },
      {
        id: 'party',
        header: 'Party',
        sortable: true,
        align: 'right',
        numeric: true,
        width: '5rem',
        defaultSortDir: 'desc',
        hideBelow: 'sm',
        cell: ({ booking }) => (
          <span className="inline-flex items-center justify-end gap-1 text-[0.8125rem] font-medium text-foreground">
            <Users aria-hidden="true" className="size-3.5 text-faint" />
            {booking.partySize}
          </span>
        ),
      },
      {
        id: 'channel',
        header: 'Channel',
        hideBelow: 'lg',
        width: '9.5rem',
        cell: ({ booking }) => <ChannelBadge channel={booking.channel} />,
      },
      {
        id: 'total',
        header: 'Total',
        sortable: true,
        align: 'right',
        numeric: true,
        width: '7rem',
        defaultSortDir: 'desc',
        cell: ({ booking }) => (
          <span className="flex flex-col items-end">
            <span className="text-[0.8125rem] font-semibold text-foreground">
              {formatCurrency(booking.total, currency)}
            </span>
            {booking.amountPaid < booking.total && booking.status !== 'cancelled' ? (
              <span className="text-[0.6875rem] font-medium text-warning">
                {formatCurrency(booking.total - booking.amountPaid, currency)} due
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'payment',
        header: 'Payment',
        hideBelow: 'md',
        width: '8.5rem',
        cell: ({ booking }) => (
          <StatusBadge kind="payment" status={booking.paymentStatus} size="sm" />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        width: '8.5rem',
        cell: ({ booking }) => <StatusBadge kind="booking" status={booking.status} size="sm" />,
      },
    ],
    [currency],
  )

  const empty = (
    <EmptyState
      variant="no-results"
      title="No reservations match these filters"
      description="Try widening the date range, clearing the channel filter, or searching by confirmation reference instead."
      action={
        <Button variant="secondary" onClick={onClearFilters} leftIcon={<X />}>
          Clear all filters
        </Button>
      }
    />
  )

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Desktop table */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row.booking.id}
          onRowClick={onRowClick}
          sort={sort}
          onSortChange={onSortChange}
          selectable
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          loading={loading}
          loadingRowCount={8}
          empty={empty}
          stickyHeader
          ariaLabel="Reservations"
          containerClassName="rounded-2xl border border-line bg-surface"
          getRowClassName={(row) =>
            row.booking.status === 'cancelled' || row.booking.status === 'refunded'
              ? 'opacity-65'
              : undefined
          }
        />
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {rows.length === 0 && !loading ? (
          <div className="rounded-2xl border border-line bg-surface">{empty}</div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {rows.map((row) => (
              <BookingCard
                key={row.booking.id}
                row={row}
                currency={currency}
                selected={selectedSet.has(row.booking.id)}
                onToggle={() => toggleOne(row.booking.id)}
                onOpen={() => onRowClick(row)}
              />
            ))}
          </ul>
        )}
      </div>

      {pageCount > 1 ? (
        <Pagination
          page={page}
          pageCount={pageCount}
          onPageChange={onPageChange}
          totalItems={totalItems}
          pageSize={pageSize}
          pageSizeOptions={[25, 50, 100]}
          onPageSizeChange={onPageSizeChange}
          showEdgeButtons
          itemNoun="booking"
          className="print:hidden"
        />
      ) : null}

      <BulkActionBar
        count={selectedIds.length}
        onClear={() => onSelectionChange([])}
        onAction={(action) => onBulkAction(action, selectedIds)}
      />
    </div>
  )
}
