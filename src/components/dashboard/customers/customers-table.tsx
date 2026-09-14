'use client'

/**
 * The guest CRM surface: segment cards on top, a searchable / sortable /
 * paginated roster beneath, and a card list that takes over below `md` so the
 * table never side-scrolls on a phone.
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

import { cn, formatCurrency, formatDateShort, formatNumber, formatRelative } from '@/lib/utils'
import { NOW } from '@/lib/demo-core'
import { countryFlag } from '@/components/charts/geo-bars'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

const PAGE_SIZES = [10, 25, 50]

function SegmentChip({ segment }: { segment: CustomerRow['segment'] }) {
  const meta = SEGMENT_META[segment]
  const Icon = meta.icon
  return (
    <Badge size="sm" variant="neutral" className={cn('border-transparent', meta.soft, meta.text)}>
      <Icon aria-hidden="true" />
      {meta.label}
    </Badge>
  )
}

function TagList({ tags, max = 2 }: { tags: string[]; max?: number }) {
  if (tags.length === 0) return <span className="text-xs text-faint">—</span>
  const shown = tags.slice(0, max)
  const rest = tags.length - shown.length
  return (
    <span className="flex flex-wrap items-center gap-1">
      {shown.map((tag) => (
        <Badge key={tag} size="sm" variant="outline" className="font-normal">
          {tag}
        </Badge>
      ))}
      {rest > 0 ? (
        <Badge size="sm" variant="neutral" className="font-normal" title={tags.slice(max).join(', ')}>
          +{rest}
        </Badge>
      ) : null}
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

  const columns = React.useMemo<DataTableColumn<CustomerRow>[]>(
    () => [
      {
        id: 'guest',
        header: 'Guest',
        sortable: true,
        width: '26%',
        cell: (row) => (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={row.name} src={row.avatarUrl} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-[0.8125rem] font-medium text-foreground">{row.name}</p>
              <p className="truncate text-xs text-subtle">{row.email}</p>
            </div>
          </div>
        ),
      },
      {
        id: 'country',
        header: 'Country',
        sortable: true,
        hideBelow: 'lg',
        width: '12%',
        cell: (row) => (
          <span className="flex items-center gap-2 text-xs text-muted">
            <span aria-hidden="true" className="text-sm leading-none">
              {countryFlag(row.countryCode)}
            </span>
            <span className="truncate">{row.countryName}</span>
          </span>
        ),
      },
      {
        id: 'segment',
        header: 'Segment',
        sortable: true,
        hideBelow: 'md',
        width: '10%',
        cell: (row) => <SegmentChip segment={row.segment} />,
      },
      {
        id: 'bookings',
        header: 'Trips',
        sortable: true,
        align: 'right',
        numeric: true,
        defaultSortDir: 'desc',
        width: '7%',
        cell: (row) => (
          <span className="text-[0.8125rem] font-medium text-foreground">{row.totalBookings}</span>
        ),
      },
      {
        id: 'value',
        header: 'Lifetime value',
        sortable: true,
        align: 'right',
        numeric: true,
        defaultSortDir: 'desc',
        width: '13%',
        cell: (row) => (
          <span className="text-[0.8125rem] font-semibold text-foreground">
            {formatCurrency(row.lifetimeValue, currency)}
          </span>
        ),
      },
      {
        id: 'lastBooking',
        header: 'Last booking',
        sortable: true,
        defaultSortDir: 'desc',
        hideBelow: 'md',
        width: '13%',
        cell: (row) => (
          <span className="text-xs text-muted">
            {row.lastBookingAt ? formatRelative(row.lastBookingAt, NOW) : 'Never'}
          </span>
        ),
      },
      {
        id: 'tags',
        header: 'Tags',
        hideBelow: 'lg',
        width: '14%',
        cell: (row) => <TagList tags={row.tags} />,
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        width: '1px',
        cell: (row) => <RowMenu row={row} />,
      },
    ],
    [currency],
  )

  const selectedCount = selectedIds.length
  const filterLabel =
    segment === 'all' ? 'All segments' : `${SEGMENT_META[segment].label} guests`

  return (
    <div className={cn('space-y-5', className)}>
      <SegmentCards
        segments={segments}
        currency={currency}
        value={segment}
        onValueChange={setSegment}
      />

      <Card>
        {/* ---- toolbar ---- */}
        <div className="flex flex-col gap-3 border-b border-line-subtle px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search name, email, phone or tag…"
              size="sm"
              aria-label="Search guests"
              fieldClassName="w-full sm:w-72"
            />
            <Select
              value={segment}
              onValueChange={(next) => setSegment(next as SegmentFilter)}
            >
              <SelectTrigger size="sm" className="w-full sm:w-44" aria-label="Filter by segment">
                <SelectValue placeholder="All segments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All segments</SelectItem>
                {SEGMENT_ORDER.map((key) => (
                  <SelectItem key={key} value={key} description={SEGMENT_META[key].blurb}>
                    {SEGMENT_META[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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

          <div className="flex shrink-0 items-center gap-2">
            <p className="tabular hidden text-xs text-subtle sm:block">
              <span className="font-medium text-foreground">{formatNumber(sorted.length)}</span> of{' '}
              {formatNumber(totalCount)} guests
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
            <span className="tabular text-xs font-semibold text-primary">
              {formatNumber(selectedCount)} selected
            </span>
            <span className="h-4 w-px bg-line" aria-hidden="true" />
            <Button
              variant="ghost"
              size="xs"
              leftIcon={<Mail className="size-3.5" />}
              onClick={() =>
                toast.success(`Campaign drafted for ${formatNumber(selectedCount)} guests`)
              }
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
            <Button
              variant="ghost"
              size="xs"
              className="ml-auto"
              onClick={() => setSelectedIds([])}
            >
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
            ariaLabel="Guests"
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
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
                        <span aria-hidden="true" className="shrink-0 text-xs leading-none">
                          {countryFlag(row.countryCode)}
                        </span>
                      </div>
                      <p className="truncate text-xs text-subtle">{row.email}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <SegmentChip segment={row.segment} />
                        <span className="tabular text-[0.6875rem] text-muted">
                          {row.totalBookings} {row.totalBookings === 1 ? 'trip' : 'trips'}
                        </span>
                        <span className="text-[0.6875rem] text-faint" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-[0.6875rem] text-muted">
                          {row.lastBookingAt ? formatDateShort(row.lastBookingAt) : 'Never'}
                        </span>
                      </div>
                    </div>
                    <span className="tabular shrink-0 text-sm font-semibold text-foreground">
                      {formatCurrency(row.lifetimeValue, currency, { compact: true })}
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
          <p className="flex items-center gap-1.5 text-[0.6875rem] text-faint">
            <Users className="size-3" aria-hidden="true" />
            Working set: the {formatNumber(rows.length)} highest-value and most recently active
            guests of {formatNumber(totalCount)} on file.
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
            description: 'Drop a CSV from FareHarbor, Peek or Rezdy — we map the columns for you.',
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
