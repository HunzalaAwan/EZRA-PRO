'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  ArrowUpRight,
  Ban,
  CheckCheck,
  CircleX,
  Download,
  MessageSquare,
  MoreHorizontal,
  RotateCcw,
  Send,
  Users,
  X,
  SlidersHorizontal,
} from 'lucide-react'

import type { BookingRow } from '@/lib/demo'
import { CHANNEL_LABELS, getLocationById } from '@/lib/demo-core'
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
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/ui/icon-button'
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
} from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'

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

  const quiet = booking.paymentStatus === 'paid' || closed
  return (
    <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap text-[0.8125rem] tabular-nums">
      <span className={cn('text-foreground', closed && 'line-through decoration-line-strong text-subtle')}>
        {formatCurrency(booking.total, currency)}
      </span>
      {!quiet ? (
        <span className={cn('text-xs', note.tone)}>
          {due > 0 ? `${formatCurrency(due, currency)} due` : note.label}
        </span>
      ) : null}
    </span>
  )
}

/* --------------------------------------------------------------------------
   Status — a dot and a word, no pill.
   -------------------------------------------------------------------------- */

const STATUS_DOT: Record<string, { label: string; tone: string }> = {
  confirmed: { label: 'Confirmed', tone: 'bg-success' },
  checked_in: { label: 'Checked in', tone: 'bg-info' },
  completed: { label: 'Completed', tone: 'bg-line-strong' },
  pending: { label: 'Pending', tone: 'bg-warning' },
  cancelled: { label: 'Cancelled', tone: 'bg-danger' },
  no_show: { label: 'No show', tone: 'bg-danger' },
  refunded: { label: 'Refunded', tone: 'bg-line-strong' },
}

function StatusDot({ status }: { status: string }) {
  const meta = STATUS_DOT[status] ?? {
    label: status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()),
    tone: 'bg-line-strong',
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8125rem] text-muted">
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', meta.tone)} />
      {meta.label}
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
      <div className="flex min-w-0 items-center gap-2 text-xs">
        {relative ? <span className={cn('font-medium', relative === 'Today' ? 'text-primary' : 'text-muted')}>{relative}</span> : null}
        {relative ? <span className="text-faint">·</span> : null}
        <span className={cn('truncate', past ? 'text-subtle' : 'text-muted')}>
          {WEEKDAYS[date.getDay()]}, {formatDateShort(date)}
        </span>
      </div>
      <span className="hidden shrink-0 text-xs text-faint tabular-nums sm:inline">
        {formatNumber(guests)} {guests === 1 ? 'guest' : 'guests'} · {formatCurrency(takings, currency)}
        {rows.length > live ? ` · ${rows.length - live} cancelled` : null}
      </span>
    </div>
  )
}

/* ==========================================================================
   BULK ACTION BAR
   Slides up from the bottom of the viewport once rows are ticked — the desk
   never loses the table while acting on a selection.
   ========================================================================== */

export type BulkBookingAction = 'confirm' | 'message' | 'refund' | 'export' | 'cancel'
export type BookingRowAction = 'open' | 'message' | 'refund' | 'cancel'

interface BulkActionBarProps {
  count: number
  onClear: () => void
  onAction: (action: BulkBookingAction) => void
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
              <span className="grid size-6 place-items-center rounded-full bg-primary text-xs font-bold text-on-primary tabular-nums">
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
            <Button size="sm" variant="secondary" leftIcon={<RotateCcw />} onClick={() => onAction('refund')}>
              Refund
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
   ROW MENU — the actions a desk takes without opening the record.
   ========================================================================== */

const CLOSED_STATUSES = new Set(['cancelled', 'refunded', 'completed', 'no_show'])

function RowMenu({ row, onAction }: { row: BookingRow; onAction: (action: BookingRowAction, row: BookingRow) => void }) {
  const { booking, customer } = row
  const refundable = booking.amountPaid - (booking.refundAmount ?? 0) > 0
  const closed = CLOSED_STATUSES.has(booking.status)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          variant="ghost"
          size="xs"
          aria-label={`Actions for ${booking.reference}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel>
          {booking.reference} · {customer.firstName} {customer.lastName}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onAction('open', row)}>
          <ArrowUpRight />
          Open reservation
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction('message', row)}>
          <MessageSquare />
          Message guest
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onAction('refund', row)} disabled={!refundable}>
          <RotateCcw />
          {refundable ? 'Refund…' : 'Nothing to refund'}
        </DropdownMenuItem>
        <DropdownMenuItem tone="danger" onSelect={() => onAction('cancel', row)} disabled={closed}>
          <Ban />
          Cancel reservation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
          <span className="text-xs text-subtle tabular-nums">{booking.reference}</span>
          <StatusDot status={booking.status} />
        </div>

        <div className="mt-2.5 flex items-center gap-2.5">
          <Avatar name={name} src={customer.avatarUrl} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm text-foreground">{name}</span>
            <span className="block truncate text-xs text-subtle">{customer.email}</span>
          </span>
        </div>

        <p className="mt-2.5 flex items-center gap-2 truncate text-[0.8125rem] text-foreground">
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
          <span className={cn('text-xs', PAYMENT_NOTE[booking.paymentStatus].tone)}>{PAYMENT_NOTE[booking.paymentStatus].label}</span>
          <span className="text-sm text-foreground tabular-nums">{formatCurrency(booking.total, currency)}</span>
        </div>
      </div>
    </li>
  )
}

/* ==========================================================================
   TABLE
   ========================================================================== */

export type Density = 'comfortable' | 'compact'

/** Nine columns need the narrower gutter; the shared table keeps its roomier default. */
function dense(columns: DataTableColumn<BookingRow>[]): DataTableColumn<BookingRow>[] {
  return columns.map((column) => ({
    ...column,
    headerClassName: cn('px-2.5', column.headerClassName),
    cellClassName: cn('px-2.5', column.cellClassName),
  }))
}

/* ==========================================================================
   DISPLAY MENU
   Row density and day grouping, tucked behind one button in the toolbar.
   ========================================================================== */

export interface BookingsDisplayMenuProps {
  density: Density
  onDensityChange: (density: Density) => void
  groupByDay: boolean
  onGroupByDayChange: (on: boolean) => void
  /** Days only make sense when the list runs in departure order. */
  canGroup: boolean
  className?: string
}

export function BookingsDisplayMenu({
  density,
  onDensityChange,
  groupByDay,
  onGroupByDayChange,
  canGroup,
  className,
}: BookingsDisplayMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" leftIcon={<SlidersHorizontal />} className={className}>
          Display
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Rows</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={density}
          onValueChange={(value) => onDensityChange(value as Density)}
        >
          <DropdownMenuRadioItem value="compact" onSelect={(event) => event.preventDefault()}>
            Compact
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="comfortable" onSelect={(event) => event.preventDefault()}>
            Comfortable
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={groupByDay}
          disabled={!canGroup}
          onCheckedChange={(checked) => onGroupByDayChange(checked === true)}
          onSelect={(event) => event.preventDefault()}
        >
          Group by day
        </DropdownMenuCheckboxItem>
        {!canGroup ? (
          <p className="px-2.5 pt-0.5 pb-1.5 text-xs text-faint">Sort by time to group by day.</p>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

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
  /** Row-menu actions; refunds and cancellations are handled by the page. */
  onRowAction?: (action: BookingRowAction, row: BookingRow) => void
  onBulkAction: (action: BulkBookingAction, ids: string[]) => void
  page: number
  pageCount: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  onClearFilters: () => void
  /** Row height, from the Display menu. */
  density: Density
  /** Day sections, from the Display menu; ignored unless sorted by departure. */
  groupByDay: boolean
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
  onRowAction,
  onBulkAction,
  page,
  pageCount,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  onClearFilters,
  density,
  groupByDay,
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
        cell: ({ customer }) => {
          const name = `${customer.firstName} ${customer.lastName}`
          return (
            <span className="flex min-w-[8.5rem] max-w-[13rem] items-center gap-2.5">
              <Avatar name={name} src={customer.avatarUrl} size={density === 'compact' ? 'xs' : 'sm'} />
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[0.8125rem] text-foreground">{name}</span>
                {customer.segment === 'vip' ? (
                  <span className="shrink-0 text-xs tracking-[0.08em] text-subtle uppercase">VIP</span>
                ) : null}
              </span>
            </span>
          )
        },
      },
      {
        id: 'reference',
        header: 'Reference',
        sortable: true,
        hideBelow: 'xl',
        width: '6.5rem',
        cellClassName: 'whitespace-nowrap',
        cell: ({ booking }) => (
          <span className="text-[0.8125rem] text-muted tabular-nums">{booking.reference}</span>
        ),
      },
      {
        id: 'email',
        header: 'Email',
        hideBelow: 'wide',
        cell: ({ customer }) => (
          <span className="block min-w-[8rem] max-w-[13rem] truncate text-[0.8125rem] text-muted" title={customer.email}>
            {customer.email}
          </span>
        ),
      },
      {
        id: 'activity',
        header: 'Experience',
        sortable: true,
        hideBelow: 'lg',
        cell: ({ activity, departure }) => (
          <span className="flex min-w-[9rem] max-w-[19rem] items-center gap-2.5">
            <span
              aria-hidden="true"
              className="h-4 w-1 shrink-0 rounded-full"
              style={{ background: ACTIVITY_COLOR_VAR[activity.colorKey] }}
            />
            <span className="truncate text-[0.8125rem] text-foreground">{activity.name}</span>
            {activity.locations.length > 1 && departure.locationId ? (
              <span className="hidden max-w-[8rem] shrink-0 truncate text-xs text-faint xl:inline">· {getLocationById(departure.locationId)?.name}</span>
            ) : null}
            {departure.status === 'cancelled' || departure.status === 'weather_hold' ? (
              <StatusBadge kind="departure" status={departure.status} size="sm" showIcon={false} className="shrink-0" />
            ) : null}
          </span>
        ),
      },
      {
        id: 'departure',
        header: grouped ? 'Time' : 'Departure',
        sortable: true,
        numeric: true,
        width: grouped ? '7rem' : '9rem',
        defaultSortDir: 'desc',
        cell: ({ departure, activity }) => (
          <span className="whitespace-nowrap text-[0.8125rem] tabular-nums">
            <span className="text-foreground">
              {grouped ? formatTime(departure.startsAt) : formatDateShort(departure.startsAt)}
            </span>
            <span className="text-subtle"> · {grouped ? formatDuration(activity.durationMinutes) : formatTime(departure.startsAt)}</span>
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
          <span className="text-[0.8125rem] text-foreground tabular-nums">{booking.partySize}</span>
        ),
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
        width: '6rem',
        cell: ({ booking }) => <StatusDot status={booking.status} />,
      },
      {
        id: 'open',
        header: <span className="sr-only">Actions</span>,
        width: '3.5rem',
        align: 'right',
        cellClassName: 'pl-0',
        cell: (row) => (
          <span className="inline-flex items-center justify-end">
            {onRowAction ? <RowMenu row={row} onAction={onRowAction} /> : null}
          </span>
        ),
      },
    ]),
    [currency, density, grouped, onRowAction],
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
    <div className={cn('flex flex-col gap-3', className)}>
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
