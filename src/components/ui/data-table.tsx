'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { motion, useReducedMotion } from 'motion/react'
import { ArrowUp, Check, ChevronsUpDown, Minus } from 'lucide-react'

import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  tableRowVariants,
} from '@/components/ui/table'

/* ==========================================================================
   DataTable — the generic list surface behind Bookings, Customers and
   Activities.

   Deliberately *presentational*: sorting, selection and paging are all
   controlled from outside so the same table can be driven by URL state,
   a zustand store, or plain local state without forking the component.
   ========================================================================== */

export interface DataTableColumn<T> {
  id: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  /** Any CSS width — `'12rem'`, `'25%'`, `'1px'` for shrink-to-fit. */
  width?: string
  /** Hides the column below this breakpoint. */
  hideBelow?: 'sm' | 'md' | 'lg'
  /** Renders the cell with `tabular-nums` — use for money, counts, dates. */
  numeric?: boolean
  /** First click on this header sorts in this direction. Defaults to `'asc'`. */
  defaultSortDir?: 'asc' | 'desc'
  headerClassName?: string
  cellClassName?: string
}

export interface DataTableSort {
  id: string
  dir: 'asc' | 'desc'
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  onRowClick?: (row: T) => void
  sort?: DataTableSort
  onSortChange?: (sort: DataTableSort) => void
  selectable?: boolean
  selectedIds?: string[]
  onSelectionChange?: (ids: string[]) => void
  loading?: boolean
  /** Skeleton rows drawn while `loading`. */
  loadingRowCount?: number
  /** Replaces the default EmptyState when there are no rows. */
  empty?: React.ReactNode
  stickyHeader?: boolean
  rowHeight?: 'compact' | 'comfortable'
  /** Visible caption. Omit and pass `ariaLabel` for a silent table. */
  caption?: React.ReactNode
  /** Accessible name when there is no visible caption. */
  ariaLabel?: string
  /** Per-row styling hook — dim cancelled rows, flag overbooked ones, etc. */
  getRowClassName?: (row: T) => string | undefined
  className?: string
  containerClassName?: string
}

const HIDE_BELOW = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
} as const

/** Deterministic skeleton widths — never Math.random(), which would desync SSR. */
const SKELETON_WIDTHS = ['72%', '54%', '84%', '46%', '66%', '38%'] as const

function DataTable<T>({
  columns,
  rows,
  getRowId,
  onRowClick,
  sort,
  onSortChange,
  selectable = false,
  selectedIds,
  onSelectionChange,
  loading = false,
  loadingRowCount = 6,
  empty,
  stickyHeader = false,
  rowHeight = 'comfortable',
  caption,
  ariaLabel,
  getRowClassName,
  className,
  containerClassName,
}: DataTableProps<T>) {
  const reduceMotion = useReducedMotion()

  const pageIds = React.useMemo(() => rows.map(getRowId), [rows, getRowId])
  const selectedSet = React.useMemo(() => new Set(selectedIds ?? []), [selectedIds])

  const selectedOnPage = pageIds.filter((id) => selectedSet.has(id)).length
  const allOnPageSelected = pageIds.length > 0 && selectedOnPage === pageIds.length
  const someOnPageSelected = selectedOnPage > 0 && !allOnPageSelected

  const columnCount = columns.length + (selectable ? 1 : 0)

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable || !onSortChange) return
    const isActive = sort?.id === column.id
    const nextDir: 'asc' | 'desc' = isActive
      ? sort.dir === 'asc'
        ? 'desc'
        : 'asc'
      : (column.defaultSortDir ?? 'asc')
    onSortChange({ id: column.id, dir: nextDir })
  }

  /**
   * The header checkbox only ever acts on the rows currently rendered, so a
   * selection made on page 1 survives paging to page 2 and back.
   */
  const toggleAll = () => {
    if (!onSelectionChange) return
    if (allOnPageSelected) {
      const pageSet = new Set(pageIds)
      onSelectionChange((selectedIds ?? []).filter((id) => !pageSet.has(id)))
    } else {
      const next = new Set(selectedIds ?? [])
      pageIds.forEach((id) => next.add(id))
      onSelectionChange(Array.from(next))
    }
  }

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return
    const next = new Set(selectedIds ?? [])
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectionChange(Array.from(next))
  }

  const density = rowHeight === 'compact' ? 'compact' : 'comfortable'

  return (
    <Table
      density={density}
      aria-label={caption ? undefined : ariaLabel}
      aria-busy={loading || undefined}
      className={className}
      containerClassName={containerClassName}
    >
      {caption ? <TableCaption>{caption}</TableCaption> : null}

      <TableHeader sticky={stickyHeader}>
        <TableRow className="hover:bg-transparent">
          {selectable ? (
            <TableHead className="w-10 pr-0">
              <SelectionCheckbox
                checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                onCheckedChange={toggleAll}
                disabled={pageIds.length === 0}
                label={allOnPageSelected ? 'Clear selection' : 'Select all rows on this page'}
              />
            </TableHead>
          ) : null}

          {columns.map((column) => {
            const isActive = sort?.id === column.id
            const ariaSort: React.AriaAttributes['aria-sort'] = !column.sortable
              ? undefined
              : isActive
                ? sort.dir === 'asc'
                  ? 'ascending'
                  : 'descending'
                : 'none'

            return (
              <TableHead
                key={column.id}
                align={column.align}
                numeric={column.numeric}
                aria-sort={ariaSort}
                style={column.width ? { width: column.width } : undefined}
                className={cn(
                  column.hideBelow && HIDE_BELOW[column.hideBelow],
                  column.headerClassName,
                )}
              >
                {column.sortable && onSortChange ? (
                  <button
                    type="button"
                    onClick={() => handleSort(column)}
                    className={cn(
                      'group/th -mx-1.5 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1',
                      'uppercase tracking-[0.08em] transition-colors duration-200 ease-[var(--ease-out-quint)]',
                      'hover:bg-surface-sunken hover:text-foreground',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                      isActive && 'text-foreground',
                      column.align === 'right' && 'flex-row-reverse',
                    )}
                  >
                    <span>{column.header}</span>
                    <SortCaret
                      active={isActive}
                      dir={isActive ? sort.dir : 'asc'}
                      reduceMotion={Boolean(reduceMotion)}
                    />
                  </button>
                ) : (
                  column.header
                )}
              </TableHead>
            )
          })}
        </TableRow>
      </TableHeader>

      <TableBody>
        {loading ? (
          Array.from({ length: loadingRowCount }, (_, rowIndex) => (
            <TableRow key={`skeleton-${rowIndex}`} className="hover:bg-transparent">
              {selectable ? (
                <TableCell className="w-10 pr-0">
                  <div className="size-4 rounded-[0.3rem] bg-surface-sunken shimmer" />
                </TableCell>
              ) : null}
              {columns.map((column, colIndex) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  className={cn(column.hideBelow && HIDE_BELOW[column.hideBelow])}
                >
                  <div
                    className={cn(
                      'h-3 rounded-full bg-surface-sunken shimmer',
                      column.align === 'right' && 'ml-auto',
                      column.align === 'center' && 'mx-auto',
                    )}
                    style={{
                      width: SKELETON_WIDTHS[(rowIndex + colIndex) % SKELETON_WIDTHS.length],
                    }}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : rows.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={columnCount} className="p-0">
              {empty ?? (
                <EmptyState
                  variant="no-results"
                  size="sm"
                  title="Nothing here yet"
                  description="Try clearing a filter or widening the date range."
                />
              )}
            </TableCell>
          </TableRow>
        ) : (
          rows.map((row, index) => {
            const id = getRowId(row)
            const isSelected = selectedSet.has(id)

            return (
              <motion.tr
                key={id}
                data-slot="table-row"
                data-state={isSelected ? 'selected' : undefined}
                // `initial` must NOT depend on useReducedMotion(): it reads false
                // during SSR and true on a reduced-motion client, which would
                // hydrate a different inline style. Reduced motion is honoured by
                // zeroing the duration instead, so the row simply snaps in.
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                // Cap the stagger so a 200-row page does not take 4s to settle.
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : {
                        duration: 0.32,
                        delay: Math.min(index, 14) * 0.022,
                        ease: [0.16, 1, 0.3, 1],
                      }
                }
                className={cn(
                  tableRowVariants({ interactive: Boolean(onRowClick) }),
                  getRowClassName?.(row),
                )}
                {...(onRowClick
                  ? {
                      role: 'button' as const,
                      tabIndex: 0,
                      onClick: () => onRowClick(row),
                      onKeyDown: (event: React.KeyboardEvent<HTMLTableRowElement>) => {
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        // Let controls inside the row keep their own key handling.
                        if (event.target !== event.currentTarget) return
                        event.preventDefault()
                        onRowClick(row)
                      },
                    }
                  : {})}
              >
                {selectable ? (
                  <TableCell
                    className="w-10 pr-0"
                    // Selecting must not also open the row.
                    onClick={(event) => event.stopPropagation()}
                  >
                    <SelectionCheckbox
                      checked={isSelected}
                      onCheckedChange={() => toggleRow(id)}
                      label={isSelected ? 'Deselect row' : 'Select row'}
                    />
                  </TableCell>
                ) : null}

                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    align={column.align}
                    numeric={column.numeric}
                    className={cn(
                      column.hideBelow && HIDE_BELOW[column.hideBelow],
                      column.cellClassName,
                    )}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </motion.tr>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}

/* --------------------------------------------------------------------------
   Internals
   -------------------------------------------------------------------------- */

function SortCaret({
  active,
  dir,
  reduceMotion,
}: {
  active: boolean
  dir: 'asc' | 'desc'
  reduceMotion: boolean
}) {
  if (!active) {
    return (
      <ChevronsUpDown
        aria-hidden="true"
        className="size-3.5 text-faint opacity-0 transition-opacity duration-200 group-hover/th:opacity-100 group-focus-visible/th:opacity-100"
      />
    )
  }

  return (
    <motion.span
      aria-hidden="true"
      className="inline-flex"
      animate={{ rotate: dir === 'desc' ? 180 : 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
    >
      <ArrowUp className="size-3.5 text-primary" strokeWidth={2.5} />
    </motion.span>
  )
}

function SelectionCheckbox({
  checked,
  onCheckedChange,
  disabled,
  label,
}: {
  checked: CheckboxPrimitive.CheckedState
  onCheckedChange: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'peer grid size-4 shrink-0 place-items-center rounded-[0.3rem] border border-line-strong bg-surface',
        'transition-all duration-200 ease-[var(--ease-out-quint)] active:scale-[0.92]',
        'hover:border-primary/70',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'disabled:pointer-events-none disabled:opacity-40',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
        'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary',
      )}
    >
      <CheckboxPrimitive.Indicator className="grid place-items-center text-on-primary">
        {checked === 'indeterminate' ? (
          <Minus aria-hidden="true" className="size-3" strokeWidth={3} />
        ) : (
          <Check aria-hidden="true" className="size-3" strokeWidth={3.25} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { DataTable }
