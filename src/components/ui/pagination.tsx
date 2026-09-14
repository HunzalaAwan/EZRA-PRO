'use client'

import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

import { cn, clamp, formatNumber, pluralize } from '@/lib/utils'

/* ==========================================================================
   Pagination — list footer for Bookings / Customers / Activities.
   ========================================================================== */

export type PaginationSlot = number | 'ellipsis-left' | 'ellipsis-right'

/** Inclusive integer run. */
function pageRun(start: number, end: number): number[] {
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => start + i)
}

/**
 * Builds the visible page slots: always the first and last page, `siblingCount`
 * neighbours either side of the current page, and ellipses for the gaps.
 *
 * The slot count is held constant on purpose — near an edge the freed-up
 * ellipsis is spent on extra page numbers rather than left blank, so the
 * control never changes width as the user steps through.
 */
export function paginationRange(
  page: number,
  pageCount: number,
  siblingCount = 1,
): PaginationSlot[] {
  if (pageCount <= 0) return []

  // first + last + current + 2 x siblings + 2 ellipses
  const maxSlots = siblingCount * 2 + 5
  if (pageCount <= maxSlots) return pageRun(1, pageCount)

  const current = clamp(page, 1, pageCount)
  const leftSibling = Math.max(current - siblingCount, 1)
  const rightSibling = Math.min(current + siblingCount, pageCount)
  // An ellipsis only earns its place when it hides more than one page.
  const showLeftEllipsis = leftSibling > 2
  const showRightEllipsis = rightSibling < pageCount - 1
  const edgeRun = siblingCount * 2 + 3

  if (!showLeftEllipsis && showRightEllipsis) {
    return [...pageRun(1, edgeRun), 'ellipsis-right', pageCount]
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    return [1, 'ellipsis-left', ...pageRun(pageCount - edgeRun + 1, pageCount)]
  }
  if (!showLeftEllipsis && !showRightEllipsis) {
    return pageRun(1, pageCount)
  }
  return [
    1,
    'ellipsis-left',
    ...pageRun(leftSibling, rightSibling),
    'ellipsis-right',
    pageCount,
  ]
}

const pageButtonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-1 rounded-lg border text-sm font-medium tabular-nums',
    'transition-all duration-200 ease-[var(--ease-out-quint)]',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    'disabled:pointer-events-none disabled:opacity-40',
    'active:scale-[0.96]',
  ],
  {
    variants: {
      state: {
        idle: 'border-line bg-surface text-muted hover:border-line-strong hover:bg-surface-sunken hover:text-foreground',
        active:
          'border-primary bg-primary text-on-primary shadow-sm hover:border-primary-hover hover:bg-primary-hover',
        ghost:
          'border-transparent bg-transparent text-muted hover:bg-surface-sunken hover:text-foreground',
      },
      size: {
        sm: 'h-8 min-w-8 px-2',
        md: 'h-9 min-w-9 px-2.5',
      },
    },
    defaultVariants: { state: 'idle', size: 'md' },
  },
)

export type PaginationVariants = VariantProps<typeof pageButtonVariants>

export interface PaginationProps extends Omit<React.ComponentProps<'nav'>, 'onChange'> {
  /** 1-indexed current page. */
  page: number
  /** Total number of pages. Values below 1 render nothing. */
  pageCount: number
  onPageChange: (page: number) => void
  /** How many pages to show either side of the current one. */
  siblingCount?: number
  size?: NonNullable<PaginationVariants['size']>
  /** Enables the "Showing x-y of n" summary. */
  totalItems?: number
  pageSize?: number
  /** Renders a page-size select when this and `onPageSizeChange` are both set. */
  pageSizeOptions?: number[]
  onPageSizeChange?: (pageSize: number) => void
  /** Adds jump-to-first / jump-to-last buttons. */
  showEdgeButtons?: boolean
  /** Noun used in the summary, e.g. "booking". */
  itemNoun?: string
  /** Drops the numbered buttons — useful inside narrow drawers. */
  compact?: boolean
}

function Pagination({
  className,
  page,
  pageCount,
  onPageChange,
  siblingCount = 1,
  size = 'md',
  totalItems,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  showEdgeButtons = false,
  itemNoun = 'result',
  compact = false,
  ...props
}: PaginationProps) {
  const selectId = React.useId()

  if (pageCount < 1) return null

  const current = clamp(page, 1, pageCount)
  const slots = paginationRange(current, pageCount, siblingCount)

  const goTo = (next: number) => {
    const target = clamp(next, 1, pageCount)
    if (target !== current) onPageChange(target)
  }

  const rangeStart = pageSize ? (current - 1) * pageSize + 1 : null
  const rangeEnd = pageSize
    ? totalItems != null
      ? Math.min(current * pageSize, totalItems)
      : current * pageSize
    : null

  return (
    <nav
      data-slot="pagination"
      aria-label="Pagination"
      className={cn(
        'flex flex-col-reverse items-center justify-between gap-3 sm:flex-row sm:gap-4',
        className,
      )}
      {...props}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {totalItems != null && rangeStart != null && rangeEnd != null ? (
          <p className="text-xs tabular-nums text-subtle" aria-live="polite">
            Showing{' '}
            <span className="font-medium text-foreground">
              {formatNumber(Math.min(rangeStart, totalItems))}&ndash;{formatNumber(rangeEnd)}
            </span>{' '}
            of <span className="font-medium text-foreground">{formatNumber(totalItems)}</span>{' '}
            {pluralize(totalItems, itemNoun)}
          </p>
        ) : (
          <p className="text-xs tabular-nums text-subtle" aria-live="polite">
            Page <span className="font-medium text-foreground">{formatNumber(current)}</span> of{' '}
            <span className="font-medium text-foreground">{formatNumber(pageCount)}</span>
          </p>
        )}

        {pageSizeOptions && onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <label htmlFor={selectId} className="text-xs text-subtle">
              Per page
            </label>
            <div className="relative">
              <select
                id={selectId}
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.currentTarget.value))}
                className={cn(
                  'h-8 appearance-none rounded-lg border border-line bg-surface py-0 pl-2.5 pr-7',
                  'text-xs font-medium tabular-nums text-foreground',
                  'transition-colors duration-200 hover:border-line-strong',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                )}
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-faint"
              />
            </div>
          </div>
        ) : null}
      </div>

      <ul className="flex items-center gap-1">
        {showEdgeButtons ? (
          <li>
            <button
              type="button"
              onClick={() => goTo(1)}
              disabled={current === 1}
              aria-label="Go to first page"
              className={cn(pageButtonVariants({ state: 'ghost', size }))}
            >
              <ChevronsLeft aria-hidden="true" className="size-4" />
            </button>
          </li>
        ) : null}

        <li>
          <button
            type="button"
            onClick={() => goTo(current - 1)}
            disabled={current === 1}
            aria-label="Go to previous page"
            className={cn(pageButtonVariants({ state: 'idle', size }), 'px-2.5')}
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            <span className="sr-only sm:not-sr-only sm:text-xs">Prev</span>
          </button>
        </li>

        {!compact &&
          slots.map((slot) =>
            typeof slot === 'number' ? (
              <li key={slot} className="hidden sm:block">
                <button
                  type="button"
                  onClick={() => goTo(slot)}
                  aria-current={slot === current ? 'page' : undefined}
                  aria-label={`Go to page ${slot}`}
                  className={cn(
                    pageButtonVariants({ state: slot === current ? 'active' : 'ghost', size }),
                  )}
                >
                  {slot}
                </button>
              </li>
            ) : (
              <li key={slot} aria-hidden="true" className="hidden sm:block">
                <span className="inline-flex h-9 w-6 items-center justify-center text-sm text-faint">
                  &hellip;
                </span>
              </li>
            ),
          )}

        <li>
          <button
            type="button"
            onClick={() => goTo(current + 1)}
            disabled={current === pageCount}
            aria-label="Go to next page"
            className={cn(pageButtonVariants({ state: 'idle', size }), 'px-2.5')}
          >
            <span className="sr-only sm:not-sr-only sm:text-xs">Next</span>
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </li>

        {showEdgeButtons ? (
          <li>
            <button
              type="button"
              onClick={() => goTo(pageCount)}
              disabled={current === pageCount}
              aria-label="Go to last page"
              className={cn(pageButtonVariants({ state: 'ghost', size }))}
            >
              <ChevronsRight aria-hidden="true" className="size-4" />
            </button>
          </li>
        ) : null}
      </ul>
    </nav>
  )
}

export { Pagination, pageButtonVariants }
