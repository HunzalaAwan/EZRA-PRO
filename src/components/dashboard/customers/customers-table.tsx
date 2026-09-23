'use client'

/**
 * The guest CRM surface: segment cards on top, a searchable / sortable /
 * paginated roster beneath, and a card list that takes over below `md` so the
 * table never side-scrolls on a phone.
 *
 * Built like the reservations list: one line per guest, numbers right-aligned
 * in tabular figures, colour reserved for the segment chip. When the roster is
 * ordered by last booking it is cut into recency bands, so "who has gone
 * quiet" is a heading rather than a calculation.
 *
 * Everything here operates on a pre-joined, pre-trimmed working set handed down
 * from the server page — the tenant's full book is tens of thousands of guests
 * and has no business crossing the network.
 */

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowUpRight,
  CalendarPlus,
  Copy,
  Download,
  Mail,
  MoreHorizontal,
  Tag,
  Trash2,
  Upload,
  UserRoundPlus,
  UserRoundSearch,
  Users,
  X,
} from 'lucide-react'

import { cn, formatCurrency, formatNumber, formatRelative } from '@/lib/utils'
import { NOW } from '@/lib/demo-core'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Pagination } from '@/components/ui/pagination'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { toast } from '@/components/ui/toaster'
import {
  SEGMENT_META,
  SEGMENT_ORDER,
  SegmentCards,
  type SegmentFilter,
  type SegmentSummary,
} from '@/components/dashboard/customers/segment-cards'
import type { CurrencyCode } from '@/types'

export interface CustomerRow {
  id: string
  name: string
  email: string
  phone: string
  avatarUrl?: string
  countryCode: string
  countryName: string
  segment: SegmentSummary['segment']
  totalBookings: number
  /** Minor units. */
  lifetimeValue: number
  lastBookingAt: string | null
  tags: string[]
}

export interface CustomersTableProps {
  rows: CustomerRow[]
  segments: SegmentSummary[]
  /** Size of the tenant's whole guest book, not of `rows`. */
  totalCount: number
  currency: CurrencyCode
  className?: string
}

const PAGE_SIZES = [25, 50, 100]

/* --------------------------------------------------------------------------
   Cells
   -------------------------------------------------------------------------- */

function SegmentChip({ segment }: { segment: CustomerRow['segment'] }) {
  const meta = SEGMENT_META[segment]
  const Icon = meta.icon
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      <Icon className={cn('size-3.5', meta.text)} aria-hidden="true" />
      {meta.label}
    </span>
  )
}

function RowMenu({ row }: { row: CustomerRow }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton
          variant="ghost"
          size="xs"
          aria-label={`Actions for ${row.name}`}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel>{row.name}</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/customers/${row.id}`}>
            <ArrowUpRight />
            Open profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toast.success(`Booking draft started for ${row.name}`)}>
          <CalendarPlus />
          New booking
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toast.success(`Message composer opened for ${row.name}`)}>
          <Mail />
          Send message
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => toast.success('Email address copied', { description: row.email })}>
          <Copy />
          Copy email
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => toast.success(`Tag editor opened for ${row.name}`)}>
          <Tag />
          Manage tags
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          tone="danger"
          onSelect={() => toast.warning(`${row.name} archived`, { description: 'Restore from the archive filter.' })}
        >
          <Trash2 />
          Archive guest
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* --------------------------------------------------------------------------
   Recency bands — the roster's natural chapters when sorted by last booking.
   -------------------------------------------------------------------------- */

const BANDS = [
  { key: '0-week', label: 'Booked this week', maxDays: 7 },
  { key: '1-month', label: 'Booked this month', maxDays: 30 },
  { key: '2-quarter', label: 'Booked in the last 90 days', maxDays: 90 },
  { key: '3-older', label: 'Quiet for more than 90 days', maxDays: Infinity },
] as const

const NEVER_BAND = { key: '4-never', label: 'Never booked' } as const

function recencyKey(iso: string | null) {
  if (!iso) return NEVER_BAND.key
  const days = (NOW.getTime() - new Date(iso).getTime()) / 86_400_000
  return (BANDS.find((band) => days <= band.maxDays) ?? BANDS[BANDS.length - 1]).key
}

function bandLabel(key: string) {
  return key === NEVER_BAND.key ? NEVER_BAND.label : (BANDS.find((b) => b.key === key)?.label ?? key)
}

function BandHeader({ bandKey, rows, currency }: { bandKey: string; rows: CustomerRow[]; currency: CurrencyCode }) {
  const value = rows.reduce((sum, row) => sum + row.lifetimeValue, 0)
  const quiet = bandKey === '3-older' || bandKey === NEVER_BAND.key
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={cn('text-[0.8125rem] font-medium', quiet ? 'text-subtle' : 'text-muted')}>{bandLabel(bandKey)}</span>
      <span className="hidden text-[0.8125rem] text-faint tabular-nums sm:inline">
        {formatNumber(rows.length)} · {formatCurrency(value, currency, { compact: true })}
      </span>
    </div>
  )
}

/** Nine columns need the narrower gutter; the shared table keeps its roomier default. */
function dense(columns: DataTableColumn<CustomerRow>[]): DataTableColumn<CustomerRow>[] {
  return columns.map((column) => ({
    ...column,
    headerClassName: cn('px-3', column.headerClassName),
    cellClassName: cn('px-3', column.cellClassName),
  }))
}

/* ==========================================================================
   TABLE
   ========================================================================== */

export function CustomersTable({
  rows,
  segments,
  totalCount,
  currency,
  className,
}: CustomersTableProps) {
  const router = useRouter()

  const [segment, setSegment] = React.useState<SegmentFilter>('all')
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<DataTableSort>({ id: 'lastBooking', dir: 'desc' })
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (segment !== 'all' && row.segment !== segment) return false
      if (!needle) return true
      return (
        row.name.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        row.phone.toLowerCase().includes(needle) ||
        row.countryName.toLowerCase().includes(needle) ||
        row.tags.some((tag) => tag.toLowerCase().includes(needle))
      )
    })
  }, [rows, segment, query])

  const sorted = React.useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    const key = sort.id
    return [...filtered].sort((a, b) => {
      switch (key) {
        case 'guest':
          return a.name.localeCompare(b.name) * dir
        case 'country':
          return a.countryName.localeCompare(b.countryName) * dir
        case 'segment':
          return (SEGMENT_ORDER.indexOf(a.segment) - SEGMENT_ORDER.indexOf(b.segment)) * dir
        case 'bookings':
          return (a.totalBookings - b.totalBookings) * dir
        case 'value':
          return (a.lifetimeValue - b.lifetimeValue) * dir
        case 'lastBooking':
        default:
          return ((a.lastBookingAt ?? '') < (b.lastBookingAt ?? '') ? -1 : 1) * dir
      }
    })
  }, [filtered, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paged = React.useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  )

  // Any change to the result set puts the reader back at the top of it.
  React.useEffect(() => {
    setPage(1)
  }, [segment, query, pageSize, sort])

  const openCustomer = React.useCallback(
    (row: CustomerRow) => router.push(`/dashboard/customers/${row.id}`),
    [router],
  )

  /* Recency bands only make sense in last-booking order. */
  const banded = sort.id === 'lastBooking'
  const groupBy = React.useCallback((row: CustomerRow) => recencyKey(row.lastBookingAt), [])
  const renderGroupHeader = React.useCallback(
    (key: string, groupRows: CustomerRow[]) => <BandHeader bandKey={key} rows={groupRows} currency={currency} />,
    [currency],
  )

  const columns = React.useMemo<DataTableColumn<CustomerRow>[]>(
    () =>
      dense([
        {
          id: 'guest',
          header: 'Guest',
          sortable: true,
          cell: (row) => (
            <div className="flex min-w-[11rem] max-w-[17rem] items-center gap-2.5">
              <Avatar name={row.name} src={row.avatarUrl} size="xs" />
              <p className="min-w-0 truncate text-sm text-foreground" title={row.email}>
                {row.name}
              </p>
            </div>
          ),
        },
        {
          id: 'segment',
          header: 'Segment',
          sortable: true,
          hideBelow: 'md',
          width: '6.5rem',
          cell: (row) => <SegmentChip segment={row.segment} />,
        },
        {
          id: 'bookings',
          header: 'Trips',
          sortable: true,
          align: 'right',
          numeric: true,
          defaultSortDir: 'desc',
          width: '3.5rem',
          cell: (row) => <span className="text-sm text-foreground tabular-nums">{row.totalBookings}</span>,
        },
        {
          id: 'value',
          header: 'Lifetime value',
          sortable: true,
          align: 'right',
          numeric: true,
          defaultSortDir: 'desc',
          width: '6.5rem',
          cellClassName: 'whitespace-nowrap',
          cell: (row) => (
            <span className="text-sm text-foreground tabular-nums">{formatCurrency(row.lifetimeValue, currency)}</span>
          ),
        },
        {
          id: 'lastBooking',
          header: 'Last booking',
          sortable: true,
          defaultSortDir: 'desc',
          hideBelow: 'md',
          width: '8rem',
          cellClassName: 'whitespace-nowrap',
          cell: (row) =>
            row.lastBookingAt ? (
              <span className="text-sm text-muted">{formatRelative(row.lastBookingAt, NOW)}</span>
            ) : (
              <span className="text-sm text-faint">Never</span>
            ),
        },
        {
          id: 'actions',
          header: <span className="sr-only">Actions</span>,
          align: 'right',
          width: '3rem',
          cellClassName: 'pl-0',
          cell: (row) => <RowMenu row={row} />,
        },
      ]),
    [currency],
  )

  const selectedCount = selectedIds.length
  const filterLabel = segment === 'all' ? 'All segments' : `${SEGMENT_META[segment].label} guests`
  const from = sorted.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const to = Math.min(currentPage * pageSize, sorted.length)

  const segmentOptions = [
    { value: 'all' as SegmentFilter, label: 'All', ariaLabel: 'All segments' },
    ...SEGMENT_ORDER.map((key) => ({
      value: key as SegmentFilter,
      label: SEGMENT_META[key].label,
      icon: SEGMENT_META[key].icon,
      ariaLabel: SEGMENT_META[key].label,
    })),
  ]

  return (
    <div className={cn('space-y-5', className)}>
      <SegmentCards segments={segments} currency={currency} value={segment} onValueChange={setSegment} />

      <Card>
        {/* ---- toolbar ---- */}
        <div className="flex flex-col gap-3 border-b border-line-subtle px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search name, email, phone or tag…"
              size="sm"
              aria-label="Search guests"
              fieldClassName="w-full sm:w-72"
            />
            <Segmented
              size="sm"
              hideLabelsOnMobile
              label="Filter by segment"
              options={segmentOptions}
              value={segment}
              onValueChange={setSegment}
            />

            {segment !== 'all' || query ? (
              <Button
                variant="ghost"
                size="xs"
                leftIcon={<X className="size-3.5" />}
                onClick={() => {
                  setSegment('all')
                  setQuery('')
                }}
              >
                Clear
              </Button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <p className="hidden text-[0.8125rem] text-subtle tabular-nums sm:block">
              {sorted.length === 0
                ? 'No guests'
                : `Showing ${formatNumber(from)}–${formatNumber(to)} of ${formatNumber(sorted.length)}`}
              {banded ? <span className="text-faint"> · {sort.dir === 'desc' ? 'most recent first' : 'quietest first'}</span> : null}
            </p>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="size-4" />}
              onClick={() =>
                toast.success('Export queued', {
                  description: `${formatNumber(sorted.length)} guests — ${filterLabel}. We’ll email the CSV when it’s ready.`,
                })
              }
            >
              Export
            </Button>
          </div>
        </div>

        {/* ---- bulk action bar ---- */}
        {selectedCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-line-subtle bg-primary-soft/50 px-4 py-2.5 sm:px-5">
            <span className="text-[0.8125rem] font-semibold text-primary tabular-nums">{formatNumber(selectedCount)} selected</span>
            <span className="h-4 w-px bg-line" aria-hidden="true" />
            <Button
              variant="ghost"
              size="xs"
              leftIcon={<Mail className="size-3.5" />}
              onClick={() => toast.success(`Campaign drafted for ${formatNumber(selectedCount)} guests`)}
            >
              Email
            </Button>
            <Button
              variant="ghost"
              size="xs"
              leftIcon={<Tag className="size-3.5" />}
              onClick={() => toast.success(`Tag applied to ${formatNumber(selectedCount)} guests`)}
            >
              Tag
            </Button>
            <Button
              variant="ghost"
              size="xs"
              leftIcon={<Download className="size-3.5" />}
              onClick={() => toast.success('Selection exported')}
            >
              Export
            </Button>
            <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setSelectedIds([])}>
              Clear selection
            </Button>
          </div>
        ) : null}

        {/* ---- desktop table ---- */}
        <CardContent bleed className="hidden md:block">
          <DataTable
            columns={columns}
            rows={paged}
            getRowId={(row) => row.id}
            onRowClick={openCustomer}
            sort={sort}
            onSortChange={setSort}
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            stickyHeader
            rowHeight="compact"
            ariaLabel="Guests"
            containerClassName="[&_th]:text-[0.8125rem]"
            groupBy={banded ? groupBy : undefined}
            renderGroupHeader={renderGroupHeader}
            empty={
              <EmptyState
                variant="no-results"
                size="sm"
                icon={UserRoundSearch}
                title="No guests match those filters"
                description="Try a different segment, or search by email address instead."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSegment('all')
                      setQuery('')
                    }}
                  >
                    Reset filters
                  </Button>
                }
              />
            }
          />
        </CardContent>

        {/* ---- mobile cards ---- */}
        <CardContent className="md:hidden">
          {paged.length === 0 ? (
            <EmptyState
              variant="no-results"
              size="sm"
              icon={UserRoundSearch}
              title="No guests match"
              description="Try a different segment or search term."
            />
          ) : (
            <ul className="divide-y divide-line-subtle">
              {paged.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/dashboard/customers/${row.id}`}
                    className="flex items-center gap-3 py-3 transition-colors duration-200 hover:bg-surface-sunken/60 focus-visible:bg-surface-sunken/60"
                  >
                    <Avatar name={row.name} src={row.avatarUrl} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground">{row.name}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] text-muted">
                        <SegmentChip segment={row.segment} />
                        <span aria-hidden="true" className="text-faint">·</span>
                        <span>{row.lastBookingAt ? formatRelative(row.lastBookingAt, NOW) : 'Never booked'}</span>
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-medium text-foreground tabular-nums">
                      {formatCurrency(row.lifetimeValue, currency)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>

        <CardFooter separated className="flex-col items-stretch gap-3">
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            totalItems={sorted.length}
            pageSize={pageSize}
            pageSizeOptions={PAGE_SIZES}
            onPageSizeChange={setPageSize}
            itemNoun="guest"
            size="sm"
          />
          <p className="flex items-center gap-1.5 text-[0.8125rem] text-faint">
            <Users className="size-3" aria-hidden="true" />
            Working set: the {formatNumber(rows.length)} highest-value and most recently active guests of{' '}
            {formatNumber(totalCount)} on file.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

/* ==========================================================================
   Header actions — lives here so the page itself can stay a server component.
   ========================================================================== */

export function CustomersPageActions({ totalCount }: { totalCount: number }) {
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<Upload className="size-4" />}
        onClick={() =>
          toast.info('Import guests', {
            description: 'Drop a CSV from your old system — we map the columns for you.',
          })
        }
      >
        Import
      </Button>
      <Button
        variant="outline"
        size="sm"
        leftIcon={<Download className="size-4" />}
        onClick={() =>
          toast.success('Export queued', {
            description: `${formatNumber(totalCount)} guest records. We’ll email the CSV when it’s ready.`,
          })
        }
      >
        Export
      </Button>
      <Button
        size="sm"
        leftIcon={<UserRoundPlus className="size-4" />}
        onClick={() => toast.success('New guest form opened')}
      >
        New customer
      </Button>
    </>
  )
}
