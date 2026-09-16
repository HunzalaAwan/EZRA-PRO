'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Archive,
  Camera,
  CheckCircle2,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Wrench,
  X,
} from 'lucide-react'

import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { SimpleTooltip } from '@/components/ui/tooltip'
import { cn, formatNumber, pluralize } from '@/lib/utils'
import type { Activity, Resource, ResourceKind } from '@/types'
import { RESOURCE_KIND_META, STATUS_META, Thumb, type ResourceImage } from './resource-grid'

/* ==========================================================================
   ResourceTable — the inventory ledger.

   One row per resource, grouped by what it is, sortable by what matters and
   selectable so a whole rack of kit can change status in one go. The row
   opens the detail panel; the menu on the right does the quick things a
   yard manager does a dozen times a day without opening anything.
   ========================================================================== */

export type ResourceRowAction = 'open' | 'edit' | 'photo' | 'service' | 'maintenance' | 'retire' | 'duplicate'
export type ResourceBulkAction = 'service' | 'maintenance' | 'retire' | 'export'

const KIND_ORDER: ResourceKind[] = ['vessel', 'vehicle', 'equipment', 'table', 'room', 'guide']

export function sortResources(rows: Resource[], sort: DataTableSort, upcomingUse: Record<string, number>): Resource[] {
  const dir = sort.dir === 'asc' ? 1 : -1
  const value = (r: Resource): number | string => {
    switch (sort.id) {
      case 'capacity':
        return r.capacity
      case 'quantity':
        return r.quantity
      case 'seats':
        return r.capacity * r.quantity
      case 'upcoming':
        return upcomingUse[r.id] ?? 0
      case 'status':
        return r.status === 'available' ? 0 : r.status === 'maintenance' ? 1 : 2
      default:
        return r.name.toLowerCase()
    }
  }
  return [...rows].sort((a, b) => {
    const av = value(a)
    const bv = value(b)
    if (av === bv) return a.name.localeCompare(b.name)
    return (av < bv ? -1 : 1) * dir
  })
}

/* --------------------------------------------------------------------------
   Row menu
   -------------------------------------------------------------------------- */

function RowMenu({ resource, onAction }: { resource: Resource; onAction: (action: ResourceRowAction, resource: Resource) => void }) {
  const inService = resource.status === 'available'
  const retired = resource.status === 'retired'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton variant="ghost" size="xs" aria-label={`Actions for ${resource.name}`} onClick={(event) => event.stopPropagation()}>
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel className="truncate">{resource.name}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onAction('edit', resource)}>
          <Pencil />
          Edit details
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction('photo', resource)}>
          <Camera />
          {resource.imageUrl ? 'Change photo' : 'Add a photo'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction('duplicate', resource)}>
          <Copy />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {inService ? (
          <DropdownMenuItem onSelect={() => onAction('maintenance', resource)}>
            <Wrench />
            Send to maintenance
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => onAction('service', resource)}>
            <CheckCircle2 />
            Return to service
          </DropdownMenuItem>
        )}
        <DropdownMenuItem tone="danger" onSelect={() => onAction('retire', resource)} disabled={retired}>
          <Archive />
          {retired ? 'Already retired' : 'Retire'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* --------------------------------------------------------------------------
   Bulk bar
   -------------------------------------------------------------------------- */

export function ResourceBulkBar({
  count,
  onClear,
  onAction,
}: {
  count: number
  onClear: () => void
  onAction: (action: ResourceBulkAction) => void
}) {
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
              'pointer-events-auto flex w-full max-w-[40rem] items-center gap-2 overflow-x-auto',
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
            <Button size="sm" variant="primary" leftIcon={<CheckCircle2 />} onClick={() => onAction('service')}>
              In service
            </Button>
            <Button size="sm" variant="secondary" leftIcon={<Wrench />} onClick={() => onAction('maintenance')}>
              Maintenance
            </Button>
            <Button size="sm" variant="secondary" leftIcon={<Download />} onClick={() => onAction('export')}>
              Export
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<Archive />}
              className="text-danger hover:bg-danger-soft hover:text-danger"
              onClick={() => onAction('retire')}
            >
              Retire
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

/* --------------------------------------------------------------------------
   Table
   -------------------------------------------------------------------------- */

export interface ResourceTableProps {
  rows: Resource[]
  dependents: Record<string, Activity[]>
  upcomingUse: Record<string, number>
  peakUse: number
  imageFor: (resource: Resource) => ResourceImage | null
  sort: DataTableSort
  onSortChange: (sort: DataTableSort) => void
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
  onOpen: (resource: Resource) => void
  onAction: (action: ResourceRowAction, resource: Resource) => void
  onAdd: (kind: ResourceKind) => void
  /** Empty-state action when nothing matches the filters. */
  onClearFilters: () => void
  className?: string
}

export function ResourceTable({
  rows,
  dependents,
  upcomingUse,
  peakUse,
  imageFor,
  sort,
  onSortChange,
  selectedIds,
  onSelectionChange,
  onOpen,
  onAction,
  onAdd,
  onClearFilters,
  className,
}: ResourceTableProps) {
  // Groups keep the catalogue order (boats first) whatever the sort inside them.
  const ordered = React.useMemo(() => {
    const sorted = sortResources(rows, sort, upcomingUse)
    return KIND_ORDER.flatMap((kind) => sorted.filter((r) => r.kind === kind))
  }, [rows, sort, upcomingUse])

  const groupBy = React.useCallback((row: Resource) => row.kind, [])
  const renderGroupHeader = React.useCallback(
    (key: string, groupRows: Resource[]) => {
      const kind = key as ResourceKind
      const meta = RESOURCE_KIND_META[kind]
      const Icon = meta.icon
      const seats = groupRows.filter((r) => r.status === 'available').reduce((sum, r) => sum + r.capacity * r.quantity, 0)
      const units = groupRows.reduce((sum, r) => sum + r.quantity, 0)
      const down = groupRows.filter((r) => r.status !== 'available').length
      return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={cn('grid size-6 place-items-center rounded-md', meta.tile)}>
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          <span className="text-[0.8125rem] font-semibold text-foreground">{meta.plural}</span>
          <span className="text-xs text-subtle tabular-nums">
            {groupRows.length} {pluralize(groupRows.length, 'resource')} · {formatNumber(units)} {pluralize(units, 'unit')} ·{' '}
            {formatNumber(seats)} seats at once
            {down > 0 ? <span className="text-warning"> · {down} out of service</span> : null}
          </span>
          <Button variant="ghost" size="xs" leftIcon={<Plus />} className="ml-auto" onClick={() => onAdd(kind)}>
            Add {meta.label.toLowerCase()}
          </Button>
        </div>
      )
    },
    [onAdd],
  )

  const columns = React.useMemo<DataTableColumn<Resource>[]>(
    () => [
      {
        id: 'name',
        header: 'Resource',
        sortable: true,
        cell: (r) => (
          <div className="flex min-w-0 items-center gap-3">
            <Thumb image={imageFor(r)} kind={r.kind} className="h-14 w-[5.75rem] shrink-0 rounded-xl ring-1 ring-black/5 dark:ring-white/10" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{r.name}</p>
              <p className="mt-0.5 truncate text-xs text-subtle">{r.location ?? RESOURCE_KIND_META[r.kind].label}</p>
            </div>
          </div>
        ),
        cellClassName: 'min-w-[18rem] px-4 py-2.5',
        headerClassName: 'px-3',
      },
      {
        id: 'capacity',
        header: 'Per unit',
        sortable: true,
        numeric: true,
        align: 'right',
        width: '6rem',
        cell: (r) => (
          <span className="text-sm text-foreground">
            {formatNumber(r.capacity)} <span className="text-faint">{pluralize(r.capacity, 'seat')}</span>
          </span>
        ),
        cellClassName: 'px-3',
        headerClassName: 'px-3',
      },
      {
        id: 'quantity',
        header: 'Units',
        sortable: true,
        numeric: true,
        align: 'right',
        width: '4.5rem',
        cell: (r) => <span className="text-sm text-foreground">{formatNumber(r.quantity)}</span>,
        cellClassName: 'px-3',
        headerClassName: 'px-3',
      },
      {
        id: 'dependents',
        header: 'Required by',
        hideBelow: 'lg',
        cell: (r) => {
          const deps = dependents[r.id] ?? []
          if (deps.length === 0) return <span className="text-[0.75rem] text-faint">Nothing yet</span>
          const rest = deps.slice(1)
          return (
            <span className="flex min-w-0 items-center gap-1.5 text-[0.75rem] text-muted">
              <span className="truncate">{deps[0].name}</span>
              {rest.length > 0 ? (
                <SimpleTooltip label={rest.map((a) => a.name).join(' · ')}>
                  <Badge variant="neutral" size="sm" tabIndex={0} className="shrink-0 cursor-default">
                    +{rest.length}
                  </Badge>
                </SimpleTooltip>
              ) : null}
            </span>
          )
        },
        cellClassName: 'max-w-[18rem] px-3',
        headerClassName: 'px-3',
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        width: '7.5rem',
        cell: (r) => {
          const status = STATUS_META[r.status]
          return (
            <Badge variant={status.variant} size="sm" dot>
              {status.label}
            </Badge>
          )
        },
        cellClassName: 'px-3',
        headerClassName: 'px-3',
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        width: '1px',
        cell: (r) => <RowMenu resource={r} onAction={onAction} />,
        cellClassName: 'pr-3 pl-1',
      },
    ],
    [dependents, imageFor, onAction, peakUse, upcomingUse],
  )

  return (
    <DataTable<Resource>
      columns={columns}
      rows={ordered}
      getRowId={(r) => r.id}
      onRowClick={onOpen}
      sort={sort}
      onSortChange={onSortChange}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      rowHeight="comfortable"
      stickyHeader
      groupBy={groupBy}
      renderGroupHeader={renderGroupHeader}
      getRowClassName={(r) => (r.status === 'retired' ? 'opacity-60' : undefined)}
      ariaLabel="Resources"
      containerClassName="rounded-2xl border border-line bg-surface"
      empty={
        <EmptyState
          variant="no-results"
          title="No resources match"
          description="Try another word, or clear the filters to see the whole inventory."
          action={
            <Button size="sm" variant="secondary" onClick={onClearFilters}>
              Clear filters
            </Button>
          }
        />
      }
      className={className}
    />
  )
}
