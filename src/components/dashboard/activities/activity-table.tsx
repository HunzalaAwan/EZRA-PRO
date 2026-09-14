'use client'

import * as React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  Archive,
  Copy,
  ExternalLink,
  MoreHorizontal,
  PencilLine,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'

import { cn, formatCurrency, formatDelta, formatDuration, formatNumber, titleCase } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/icon-button'
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
import {
  DIFFICULTY_LABEL,
  activityHref,
  primaryMedia,
  useActivityActions,
} from './activity-card'
import type { ActivitySummary } from './activity-data'

/* ==========================================================================
   SORTING — shared by the toolbar's sort control and the column headers so the
   grid and the table can never disagree about the order they are showing.
   ========================================================================== */

export type ActivitySortId =
  | 'name'
  | 'status'
  | 'price'
  | 'duration'
  | 'capacity'
  | 'bookings'
  | 'revenue'
  | 'rating'
  | 'occupancy'
  | 'updated'

const STATUS_RANK: Record<string, number> = { live: 0, draft: 1, paused: 2, archived: 3 }

function sortValue(summary: ActivitySummary, id: ActivitySortId): number | string {
  const { activity } = summary
  switch (id) {
    case 'name':
      return activity.name.toLowerCase()
    case 'status':
      return STATUS_RANK[activity.status] ?? 9
    case 'price':
      return summary.fromPrice
    case 'duration':
      return activity.durationMinutes
    case 'capacity':
      return activity.maxCapacity
    case 'bookings':
      return summary.bookings30d
    case 'revenue':
      return summary.revenue30d
    case 'rating':
      return activity.rating
    case 'occupancy':
      return summary.occupancy30d
    case 'updated':
    default:
      return activity.updatedAt
  }
}

export function sortSummaries(
  rows: ActivitySummary[],
  sort: { id: ActivitySortId; dir: 'asc' | 'desc' },
): ActivitySummary[] {
  return [...rows].sort((a, b) => {
    const av = sortValue(a, sort.id)
    const bv = sortValue(b, sort.id)
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    // Stable tiebreak keeps the order deterministic between renders.
    const tie = a.activity.name.localeCompare(b.activity.name)
    return (sort.dir === 'asc' ? cmp : -cmp) || tie
  })
}

/* ==========================================================================
   ROW MENU
   ========================================================================== */

function RowMenu({ summary, tenantSlug }: { summary: ActivitySummary; tenantSlug: string }) {
  const actions = useActivityActions(summary, tenantSlug)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
        <IconButton aria-label={`Actions for ${summary.activity.name}`} size="xs" variant="ghost">
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel>{summary.activity.name}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={actions.onEdit}>
          <PencilLine aria-hidden="true" />
          Edit activity
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onDuplicate}>
          <Copy aria-hidden="true" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={actions.onPreview}>
          <ExternalLink aria-hidden="true" />
          View on storefront
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={actions.onArchive}>
          <Archive aria-hidden="true" />
          Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ==========================================================================
   TABLE
   ========================================================================== */

export interface ActivityTableProps {
  rows: ActivitySummary[]
  tenantSlug: string
  sort: DataTableSort
  onSortChange: (sort: DataTableSort) => void
  onClearFilters?: () => void
  className?: string
}

export function ActivityTable({
  rows,
  tenantSlug,
  sort,
  onSortChange,
  onClearFilters,
  className,
}: ActivityTableProps) {
  const router = useRouter()

  const columns = React.useMemo<DataTableColumn<ActivitySummary>[]>(
    () => [
      {
        id: 'name',
        header: 'Activity',
        sortable: true,
        width: '24rem',
        cell: ({ activity }) => {
          const media = primaryMedia(activity)
          return (
            <div className="flex min-w-0 items-center gap-3">
              <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-surface-sunken ring-1 ring-line-subtle">
                {media ? (
                  <Image src={media.url} alt="" fill sizes="44px" className="object-cover" />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {activity.name}
                </span>
                <span className="block truncate text-xs text-subtle">
                  {titleCase(activity.category)} · {DIFFICULTY_LABEL[activity.difficulty]}
                  {activity.featured ? ' · Featured' : ''}
                </span>
              </span>
            </div>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        width: '9rem',
        cell: ({ activity }) => (
          <StatusBadge kind="activity" status={activity.status} size="sm" />
        ),
      },
      {
        id: 'price',
        header: 'Price from',
        sortable: true,
        align: 'right',
        numeric: true,
        defaultSortDir: 'desc',
        cell: (row) => (
          <span className="font-medium">{formatCurrency(row.fromPrice, row.activity.currency)}</span>
        ),
      },
      {
        id: 'duration',
        header: 'Duration',
        sortable: true,
        align: 'right',
        numeric: true,
        hideBelow: 'lg',
        cell: ({ activity }) => (
          <span className="text-muted">{formatDuration(activity.durationMinutes)}</span>
        ),
      },
      {
        id: 'capacity',
        header: 'Capacity',
        sortable: true,
        align: 'right',
        numeric: true,
        hideBelow: 'lg',
        defaultSortDir: 'desc',
        cell: ({ activity }) => (
          <span className="text-muted">
            {activity.minParticipants}–{activity.maxCapacity}
          </span>
        ),
      },
      {
        id: 'bookings',
        header: 'Bookings 30d',
        sortable: true,
        align: 'right',
        numeric: true,
        hideBelow: 'md',
        defaultSortDir: 'desc',
        cell: (row) => {
          const up = row.deltaBookingsPercent >= 0
          return (
            <span className="inline-flex items-center justify-end gap-2">
              <span className="font-medium">{formatNumber(row.bookings30d)}</span>
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-[0.6875rem] font-semibold',
                  up ? 'text-success' : 'text-danger',
                )}
              >
                {up ? (
                  <TrendingUp className="size-3" aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-3" aria-hidden="true" />
                )}
                {formatDelta(row.deltaBookingsPercent, 0)}
              </span>
            </span>
          )
        },
      },
      {
        id: 'revenue',
        header: 'Revenue 30d',
        sortable: true,
        align: 'right',
        numeric: true,
        defaultSortDir: 'desc',
        cell: (row) => (
          <span className="font-semibold">
            {formatCurrency(row.revenue30d, row.activity.currency, { compact: row.revenue30d >= 100_000 })}
          </span>
        ),
      },
      {
        id: 'rating',
        header: 'Rating',
        sortable: true,
        align: 'right',
        numeric: true,
        hideBelow: 'md',
        defaultSortDir: 'desc',
        cell: ({ activity }) => (
          <span className="inline-flex items-center justify-end gap-1.5">
            <Star className="size-3.5 fill-sunset-400 text-sunset-400" aria-hidden="true" />
            <span className="font-medium">{activity.rating.toFixed(2)}</span>
            <span className="text-xs text-faint">({formatNumber(activity.reviewCount)})</span>
          </span>
        ),
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        width: '1px',
        align: 'right',
        cell: (row) => <RowMenu summary={row} tenantSlug={tenantSlug} />,
      },
    ],
    [tenantSlug],
  )

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-line bg-surface', className)}>
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.activity.id}
        onRowClick={(row) => router.push(activityHref(row.activity.id))}
        sort={sort}
        onSortChange={onSortChange}
        stickyHeader
        ariaLabel="Activity catalog"
        getRowClassName={(row) => (row.activity.status === 'archived' ? 'opacity-60' : undefined)}
        empty={
          <EmptyState
            variant="no-results"
            size="sm"
            title="No activities match these filters"
            description="Try a different status, or clear the search to see the whole catalog."
            action={
              onClearFilters ? (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
                >
                  Clear all filters
                </button>
              ) : undefined
            }
          />
        }
      />
    </div>
  )
}
