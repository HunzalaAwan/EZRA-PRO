import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/* ==========================================================================
   Table — low-level styled primitives.

   Row rhythm is driven by a `--row-py` custom property set on <table> by the
   `density` variant, so cells stay in sync without every consumer threading a
   size prop down. Sticky headers work because <Table> owns the scroll
   container: `position: sticky` needs a scrolling ancestor, not a page scroll.
   ========================================================================== */

const tableVariants = cva('w-full caption-bottom border-collapse text-sm', {
  variants: {
    density: {
      compact: '[--row-py:0.5rem]',
      comfortable: '[--row-py:0.875rem]',
      relaxed: '[--row-py:1.125rem]',
    },
  },
  defaultVariants: { density: 'comfortable' },
})

export type TableVariants = VariantProps<typeof tableVariants>

export interface TableProps extends React.ComponentProps<'table'>, TableVariants {
  /** Classes for the scroll container that wraps the table. */
  containerClassName?: string
}

function Table({ className, containerClassName, density, ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      className={cn(
        'relative w-full overflow-x-auto overscroll-x-contain rounded-[inherit]',
        containerClassName,
      )}
    >
      <table data-slot="table" className={cn(tableVariants({ density }), className)} {...props} />
    </div>
  )
}

export interface TableHeaderProps extends React.ComponentProps<'thead'> {
  /** Pins the header to the top of the scroll container. */
  sticky?: boolean
}

function TableHeader({ className, sticky = false, ...props }: TableHeaderProps) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        '[&_tr]:border-b [&_tr]:border-line',
        // A blue-grey head row, a step below the card, so columns read as a band.
        !sticky && 'bg-well',
        // The blur + translucent fill keeps rows legible as they scroll under it.
        sticky &&
          'sticky top-0 z-20 bg-surface/85 backdrop-blur-md supports-[not(backdrop-filter:blur(0))]:bg-surface',
        className,
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        'border-t border-line bg-surface-sunken/70 font-medium [&>tr]:last:border-b-0',
        className,
      )}
      {...props}
    />
  )
}

/**
 * Exported so surfaces that must own their own <tr> element — DataTable wraps
 * rows in `motion.tr` for the entrance stagger — stay visually identical to a
 * plain <TableRow> without copying the recipe.
 */
const tableRowVariants = cva(
  [
    'border-b border-line-subtle transition-colors duration-150 ease-[var(--ease-out-quint)]',
    'hover:bg-surface-sunken/60',
    'data-[state=selected]:bg-primary-soft/45 data-[state=selected]:hover:bg-primary-soft/60',
  ],
  {
    variants: {
      interactive: {
        true: 'cursor-pointer',
        false: '',
      },
    },
    defaultVariants: { interactive: false },
  },
)

export type TableRowVariants = VariantProps<typeof tableRowVariants>

export interface TableRowProps extends React.ComponentProps<'tr'>, TableRowVariants {}

function TableRow({ className, interactive, ...props }: TableRowProps) {
  return (
    <tr
      data-slot="table-row"
      className={cn(tableRowVariants({ interactive }), className)}
      {...props}
    />
  )
}

const cellAlignVariants = cva('', {
  variants: {
    align: {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    },
    numeric: {
      true: 'tabular-nums',
      false: '',
    },
  },
  defaultVariants: { align: 'left', numeric: false },
})

export type TableCellAlignVariants = VariantProps<typeof cellAlignVariants>

export interface TableHeadProps
  extends Omit<React.ComponentProps<'th'>, 'align'>,
    TableCellAlignVariants {}

function TableHead({ className, align, numeric, scope = 'col', ...props }: TableHeadProps) {
  return (
    <th
      data-slot="table-head"
      scope={scope}
      className={cn(
        'h-11 px-4 align-middle text-[0.6875rem] font-semibold uppercase tracking-[0.08em] whitespace-nowrap text-subtle',
        cellAlignVariants({ align, numeric }),
        className,
      )}
      {...props}
    />
  )
}

export interface TableCellProps
  extends Omit<React.ComponentProps<'td'>, 'align'>,
    TableCellAlignVariants {}

function TableCell({ className, align, numeric, ...props }: TableCellProps) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        'px-4 py-[var(--row-py,0.875rem)] align-middle text-foreground',
        numeric && 'font-medium',
        cellAlignVariants({ align, numeric }),
        className,
      )}
      {...props}
    />
  )
}

function TableCaption({ className, ...props }: React.ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-3 text-xs text-subtle', className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  tableVariants,
  tableRowVariants,
  cellAlignVariants,
}
