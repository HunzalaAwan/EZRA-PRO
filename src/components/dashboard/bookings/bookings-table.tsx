'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  CheckCheck,
  ChevronRight,
  CircleX,
  Download,
  Send,
  Users,
  X,
} from 'lucide-react'

import type { BookingRow } from '@/lib/demo'
import { CHANNEL_LABELS } from '@/lib/demo-core'
import { ACTIVITY_COLOR_VAR } from '@/components/charts/chart-container'
import type { BookingChannel, CurrencyCode, PaymentStatus } from '@/types'
import {
  cn,
  formatCurrency,
  formatDateShort,
  formatDuration,
  formatNumber,
  formatTime,
  fromDateKey,
  toDateKey,
} from '@/lib/utils'
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
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'

/* ==========================================================================
   The reservations list.

   Built for volume: one line per booking, numbers right-aligned in tabular
   figures, colour reserved for state. When the list is ordered by departure
   it is cut into days, each with its own count, headcount and takings, so an
   operator reads a week the way they think about it: one day at a time.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Channel — a quiet label with a tone dot, so the column reads as a texture
   rather than eight competing badges.
   -------------------------------------------------------------------------- */

const CHANNEL_TONE: Record<BookingChannel, string> = {
  website_widget: 'var(--primary)',
  direct: 'var(--info)',
  ota: 'var(--accent)',
  phone: 'var(--fg-subtle)',
  walk_in: 'var(--success)',
  reseller: 'var(--warning)',
  concierge: 'var(--chart-3)',
  google: 'var(--chart-6)',
}

const CHANNEL_SHORT: Record<BookingChannel, string> = {
  website_widget: 'Website',
  direct: 'Direct',
  ota: 'OTA',
  phone: 'Phone',
  walk_in: 'Walk-in',
  reseller: 'Reseller',
  concierge: 'Concierge',
  google: 'Google',
}

export function ChannelBadge({ channel, short = false }: { channel: BookingChannel; short?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-muted"
      title={CHANNEL_LABELS[channel]}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: CHANNEL_TONE[channel] }} />
      {short ? CHANNEL_SHORT[channel] : CHANNEL_LABELS[channel]}
    </span>
  )
}

/* --------------------------------------------------------------------------
   Payment — the total, and under it the one thing that matters about it.
   -------------------------------------------------------------------------- */

const PAYMENT_NOTE: Record<PaymentStatus, { label: string; tone: string }> = {
  paid: { label: 'Paid', tone: 'text-success' },
  deposit_paid: { label: 'Deposit', tone: 'text-warning' },
  unpaid: { label: 'Unpaid', tone: 'text-warning' },
  partially_refunded: { label: 'Part refund', tone: 'text-subtle' },
  refunded: { label: 'Refunded', tone: 'text-subtle' },
  failed: { label: 'Failed', tone: 'text-danger' },
}

function PaymentCell({ row, currency }: { row: BookingRow; currency: CurrencyCode }) {
  const { booking } = row
  const closed = booking.status === 'cancelled' || booking.status === 'refunded'
  const due = booking.total - booking.amountPaid
  const note = PAYMENT_NOTE[booking.paymentStatus]

  return (
    <span className="flex flex-col items-end leading-tight">
      <span className={cn('text-[0.8125rem] font-semibold tabular-nums text-foreground', closed && 'line-through decoration-line-strong')}>
        {formatCurrency(booking.total, currency)}
      </span>
      {!closed && due > 0 ? (
        <span className="text-[0.6875rem] font-semibold tabular-nums text-warning">
          {formatCurrency(due, currency)} due
        </span>
      ) : (
        <span className={cn('text-[0.6875rem] font-medium', note.tone)}>{note.label}</span>
      )}
    </span>
  )
}

/* --------------------------------------------------------------------------
   Day header — one line per day with what the day is worth.
   -------------------------------------------------------------------------- */

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function shiftKey(key: string, days: number) {
  const d = fromDateKey(key)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

function DayHeader({
  dayKey,
  rows,
  todayKey,
  currency,
}: {
  dayKey: string
  rows: BookingRow[]
  todayKey: string
  currency: CurrencyCode
}) {
  const date = fromDateKey(dayKey)
  const relative =
    dayKey === todayKey
      ? 'Today'
      : dayKey === shiftKey(todayKey, 1)
        ? 'Tomorrow'
        : dayKey === shiftKey(todayKey, -1)
          ? 'Yesterday'
          : null
  const past = dayKey < todayKey

  let guests = 0
  let takings = 0
  let live = 0
  for (const { booking } of rows) {
    if (booking.status === 'cancelled' || booking.status === 'refunded' || booking.status === 'no_show') continue
    live += 1
    guests += booking.partySize
    takings += booking.total
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {relative ? (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[0.625rem] font-bold tracking-[0.08em] uppercase',
              relative === 'Today' ? 'bg-primary text-on-primary' : 'bg-surface text-muted ring-1 ring-line',
            )}
          >
            {relative}
          </span>
        ) : null}
        <span className={cn('truncate text-[0.8125rem] font-semibold', past ? 'text-muted' : 'text-foreground')}>
          {WEEKDAYS[date.getDay()]}, {formatDateShort(date)}
        </span>
      </div>
      <span className="hidden shrink-0 text-xs text-subtle tabular-nums sm:inline">
        {formatNumber(live)} {live === 1 ? 'booking' : 'bookings'} · {formatNumber(guests)}{' '}
        {guests === 1 ? 'guest' : 'guests'} · {formatCurrency(takings, currency)}
        {rows.length > live ? <span className="text-faint"> · {rows.length - live} cancelled</span> : null}
      </span>
    </div>
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
  const reduceMotion = useReducedMotionSafe()

  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.97 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
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
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open booking ${booking.reference}`}
        className="absolute inset-0 rounded-2xl focus:outline-none"
      />

      <div className="relative z-10 flex shrink-0 items-start pt-0.5">
        <Checkbox checked={selected} onCheckedChange={onToggle} aria-label={`Select booking ${booking.reference}`} />
      </div>

      <div className="pointer-events-none relative min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[0.75rem] font-semibold tracking-tight text-muted">{booking.reference}</span>
          <StatusBadge kind="booking" status={booking.status} size="sm" showIcon={false} />
        </div>

        <div className="mt-2.5 flex items-center gap-2.5">
          <Avatar name={name} src={customer.avatarUrl} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-foreground">{name}</span>
            <span className="block truncate text-xs text-subtle">{customer.email}</span>
          </span>
        </div>

        <p className="mt-2.5 flex items-center gap-2 truncate text-[0.8125rem] font-medium text-foreground">
          <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full" style={{ background: ACTIVITY_COLOR_VAR[activity.colorKey] }} />
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
          <ChannelBadge channel={booking.channel} short />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-subtle pt-2.5">
          <StatusBadge kind="payment" status={booking.paymentStatus} size="sm" />
          <span className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(booking.total, currency)}</span>
        </div>
      </div>
    </li>
  )
}

/* ==========================================================================
   TABLE
   ========================================================================== */

type Density = 'comfortable' | 'compact'

/** Nine columns need the narrower gutter; the shared table keeps its roomier default. */
function dense(columns: DataTableColumn<BookingRow>[]): DataTableColumn<BookingRow>[] {
  return columns.map((column) => ({
    ...column,
    headerClassName: cn('px-3', column.headerClassName),
    cellClassName: cn('px-3', column.cellClassName),
  }))
}

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
]

export interface BookingsTableProps {
  /** Rows for the current page only. */
  rows: BookingRow[]
  currency: CurrencyCode
  /** Today's date key, so day sections can say "Today" and "Tomorrow". */
  todayKey: string
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
  todayKey,
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
  const [density, setDensity] = React.useState<Density>('compact')
  const [groupByDay, setGroupByDay] = React.useState(true)

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds])
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(Array.from(next))
  }

  /* Days only make sense when the list runs in departure order. */
  const canGroup = sort.id === 'departure'
  const grouped = groupByDay && canGroup

  const groupBy = React.useCallback((row: BookingRow) => toDateKey(row.departure.startsAt), [])
  const renderGroupHeader = React.useCallback(
    (key: string, groupRows: BookingRow[]) => (
      <DayHeader dayKey={key} rows={groupRows} todayKey={todayKey} currency={currency} />
    ),
    [todayKey, currency],
  )

  const columns = React.useMemo<DataTableColumn<BookingRow>[]>(
    () => dense([
      {
        id: 'guest',
        header: 'Guest',
        sortable: true,
        cell: ({ customer, booking }) => {
          const name = `${customer.firstName} ${customer.lastName}`
          return (
            <span className="flex min-w-[11rem] max-w-[13.5rem] items-center gap-2.5">
              <Avatar name={name} src={customer.avatarUrl} size={density === 'compact' ? 'xs' : 'sm'} />
              <span className="min-w-0 leading-tight">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[0.8125rem] font-semibold text-foreground">{name}</span>
                  {customer.segment === 'vip' ? (
                    <Badge variant="accent" size="sm">
                      VIP
                    </Badge>
                  ) : null}
                </span>
                <span className="block truncate text-[0.6875rem] text-subtle">
                  <span className="font-mono font-medium tracking-tight text-muted">{booking.reference}</span>
                  <span className="text-faint"> · </span>
                  {customer.email}
                </span>
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
          <span className="flex min-w-[11rem] max-w-[16rem] items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-5 w-1 shrink-0 rounded-full"
              style={{ background: ACTIVITY_COLOR_VAR[activity.colorKey] }}
            />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[0.8125rem] font-medium text-foreground">{activity.name}</span>
              {departure.status === 'cancelled' || departure.status === 'weather_hold' ? (
                <StatusBadge kind="departure" status={departure.status} size="sm" showIcon={false} className="mt-0.5" />
              ) : (
                <span className="block truncate text-[0.6875rem] text-subtle">{activity.meetingPoint}</span>
              )}
            </span>
          </span>
        ),
      },
      {
        id: 'departure',
        header: grouped ? 'Time' : 'Departure',
        sortable: true,
        numeric: true,
        width: grouped ? '5.5rem' : '8rem',
        defaultSortDir: 'desc',
        cell: ({ departure, activity }) => (
          <span className="flex flex-col leading-tight whitespace-nowrap">
            <span className="text-[0.8125rem] font-semibold text-foreground tabular-nums">
              {grouped ? formatTime(departure.startsAt) : formatDateShort(departure.startsAt)}
            </span>
            <span className="text-[0.6875rem] text-subtle tabular-nums">
              {grouped ? formatDuration(activity.durationMinutes) : formatTime(departure.startsAt)}
            </span>
          </span>
        ),
      },
      {
        id: 'party',
        header: 'Party',
        sortable: true,
        align: 'right',
        numeric: true,
        width: '3.5rem',
        defaultSortDir: 'desc',
        hideBelow: 'md',
        cell: ({ booking }) => (
          <span className="inline-flex items-center justify-end gap-1 text-[0.8125rem] font-medium text-foreground tabular-nums">
            <Users aria-hidden="true" className="size-3.5 text-faint" />
            {booking.partySize}
          </span>
        ),
      },
      {
        id: 'channel',
        header: 'Channel',
        hideBelow: '2xl',
        width: '6rem',
        cell: ({ booking }) => <ChannelBadge channel={booking.channel} short />,
      },
      {
        id: 'total',
        header: 'Payment',
        sortable: true,
        align: 'right',
        numeric: true,
        width: '6rem',
        cellClassName: 'whitespace-nowrap',
        defaultSortDir: 'desc',
        cell: (row) => <PaymentCell row={row} currency={currency} />,
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        width: '6.5rem',
        cell: ({ booking }) => <StatusBadge kind="booking" status={booking.status} size="sm" />,
      },
      {
        id: 'open',
        header: <span className="sr-only">Open</span>,
        width: '2rem',
        align: 'right',
        cellClassName: 'pl-0',
        cell: () => <ChevronRight aria-hidden="true" className="size-4 text-faint" />,
      },
    ]),
    [currency, density, grouped],
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

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalItems)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* ---------- toolbar ---------- */}
      <div className="hidden items-center justify-between gap-3 md:flex">
        <p className="text-xs text-subtle tabular-nums">
          {totalItems === 0 ? 'No reservations' : `Showing ${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(totalItems)}`}
          {sort.id === 'departure' ? (
            <span className="text-faint"> · {sort.dir === 'desc' ? 'latest departure first' : 'earliest departure first'}</span>
          ) : null}
        </p>

        <div className="flex items-center gap-4">
          <label
            className={cn(
              'inline-flex items-center gap-2 text-xs font-medium text-muted',
              !canGroup && 'opacity-50',
            )}
            title={canGroup ? undefined : 'Sort by departure to group by day'}
          >
            <Switch size="sm" checked={groupByDay} onCheckedChange={setGroupByDay} disabled={!canGroup} />
            Group by day
          </label>
          <Segmented size="sm" label="Row density" options={DENSITY_OPTIONS} value={density} onValueChange={setDensity} />
        </div>
      </div>

      {/* ---------- desktop table ---------- */}
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
          loadingRowCount={10}
          empty={empty}
          stickyHeader
          rowHeight={density}
          ariaLabel="Reservations"
          containerClassName="rounded-2xl border border-line bg-surface"
          groupBy={grouped ? groupBy : undefined}
          renderGroupHeader={renderGroupHeader}
          getRowClassName={(row) =>
            row.booking.status === 'cancelled' || row.booking.status === 'refunded' ? 'opacity-60' : undefined
          }
        />
      </div>

      {/* ---------- mobile cards ---------- */}
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
