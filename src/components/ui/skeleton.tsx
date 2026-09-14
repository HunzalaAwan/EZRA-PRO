import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn, createRng, hashSeed, rngInt } from '@/lib/utils'

/* ==========================================================================
   BASE
   `shimmer` (globals.css) supplies the travelling sheen and already collapses
   under prefers-reduced-motion, so the placeholder degrades to a flat block.
   ========================================================================== */

export const skeletonVariants = cva('relative overflow-hidden bg-surface-sunken', {
  variants: {
    shape: {
      line: 'h-3 w-full rounded-full',
      block: 'rounded-xl',
      circle: 'aspect-square rounded-full',
      pill: 'h-7 w-24 rounded-full',
    },
    animated: {
      true: 'shimmer',
      false: '',
    },
  },
  defaultVariants: { shape: 'block', animated: true },
})

export type SkeletonVariants = VariantProps<typeof skeletonVariants>

export interface SkeletonProps
  extends React.HTMLAttributes<HTMLDivElement>,
    SkeletonVariants {}

function Skeleton({ className, shape, animated, ...props }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(skeletonVariants({ shape, animated }), className)}
      {...props}
    />
  )
}

/**
 * Wraps a loading block with the right live-region semantics. Screen readers
 * hear "Loading…" once instead of narrating a wall of empty boxes.
 */
function SkeletonRegion({
  className,
  label = 'Loading',
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { label?: string }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className} {...props}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

/* ==========================================================================
   COMPOSITIONS
   Line widths are seeded rather than random so server and client agree.
   ========================================================================== */

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number
  /** Stable seed — vary it when two text blocks sit side by side. */
  seed?: string
  /** Width of the final line, as a percentage. */
  lastLineWidth?: number
}

function SkeletonText({
  className,
  lines = 3,
  seed = 'ezra-skeleton-text',
  lastLineWidth = 62,
  ...props
}: SkeletonTextProps) {
  const rng = createRng(hashSeed(seed))
  const widths = Array.from({ length: Math.max(lines, 1) }, (_, index) =>
    index === lines - 1 ? lastLineWidth : rngInt(rng, 82, 100),
  )

  return (
    <div className={cn('flex w-full flex-col gap-2.5', className)} {...props}>
      {widths.map((width, index) => (
        <Skeleton key={index} shape="line" style={{ width: `${width}%` }} />
      ))}
    </div>
  )
}

export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Show the leading media block — matches the activity and departure cards. */
  media?: boolean
  lines?: number
  /** Show the trailing action row. */
  footer?: boolean
  seed?: string
}

function SkeletonCard({
  className,
  media = true,
  lines = 2,
  footer = true,
  seed = 'ezra-skeleton-card',
  ...props
}: SkeletonCardProps) {
  return (
    <SkeletonRegion
      className={cn('overflow-hidden rounded-2xl border border-line bg-surface', className)}
      {...props}
    >
      {media ? <Skeleton shape="block" className="h-40 w-full rounded-none" /> : null}
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-2.5">
          <Skeleton shape="line" className="h-4 w-1/2" />
          <SkeletonText lines={lines} seed={`${seed}-body`} />
        </div>
        {footer ? (
          <div className="flex items-center justify-between gap-4 border-t border-line-subtle pt-4">
            <Skeleton shape="line" className="h-4 w-20" />
            <Skeleton shape="pill" className="w-28" />
          </div>
        ) : null}
      </div>
    </SkeletonRegion>
  )
}

export interface SkeletonTableProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number
  columns?: number
  /** Render the header strip above the rows. */
  header?: boolean
  seed?: string
}

function SkeletonTable({
  className,
  rows = 6,
  columns = 5,
  header = true,
  seed = 'ezra-skeleton-table',
  ...props
}: SkeletonTableProps) {
  const rng = createRng(hashSeed(seed))
  // Pre-compute every cell width so the grid looks like real, ragged data.
  const cellWidths = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => rngInt(rng, 44, 92)),
  )
  const gridTemplate = `minmax(0,1.6fr) repeat(${Math.max(columns - 1, 1)}, minmax(0,1fr))`

  return (
    <SkeletonRegion
      className={cn('overflow-hidden rounded-2xl border border-line bg-surface', className)}
      {...props}
    >
      {header ? (
        <div
          className="grid gap-4 border-b border-line bg-surface-sunken px-5 py-3"
          style={{ gridTemplateColumns: gridTemplate }}
        >
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton key={index} shape="line" className="h-2.5 w-16" />
          ))}
        </div>
      ) : null}

      <div className="divide-y divide-line-subtle">
        {cellWidths.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="grid items-center gap-4 px-5 py-4"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {row.map((width, columnIndex) => (
              <div key={columnIndex} className="flex items-center gap-3">
                {columnIndex === 0 ? <Skeleton shape="circle" className="size-8 shrink-0" /> : null}
                <Skeleton shape="line" style={{ width: `${width}%` }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </SkeletonRegion>
  )
}

export interface SkeletonChartProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of placeholder columns. */
  bars?: number
  /** Chart plot height in pixels. */
  height?: number
  /** Show the title / legend strip above the plot. */
  header?: boolean
  seed?: string
}

function SkeletonChart({
  className,
  bars = 12,
  height = 220,
  header = true,
  seed = 'ezra-skeleton-chart',
  ...props
}: SkeletonChartProps) {
  const rng = createRng(hashSeed(seed))
  const heights = Array.from({ length: Math.max(bars, 1) }, () => rngInt(rng, 26, 100))

  return (
    <SkeletonRegion
      className={cn('rounded-2xl border border-line bg-surface p-5', className)}
      {...props}
    >
      {header ? (
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2.5">
            <Skeleton shape="line" className="h-3 w-28" />
            <Skeleton shape="line" className="h-6 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton shape="pill" className="w-16" />
            <Skeleton shape="pill" className="w-16" />
          </div>
        </div>
      ) : null}

      <div className="flex items-end gap-2" style={{ height }}>
        {heights.map((value, index) => (
          <Skeleton
            key={index}
            shape="block"
            className="min-w-0 flex-1 rounded-md rounded-b-none"
            style={{ height: `${value}%` }}
          />
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line-subtle pt-3">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} shape="line" className="h-2.5 w-10" />
        ))}
      </div>
    </SkeletonRegion>
  )
}

export { Skeleton, SkeletonRegion, SkeletonText, SkeletonCard, SkeletonTable, SkeletonChart }
