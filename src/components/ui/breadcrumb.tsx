'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { ChevronRight, Ellipsis } from 'lucide-react'

import { cn } from '@/lib/utils'

/* ==========================================================================
   Breadcrumb — dashboard wayfinding.

   `BreadcrumbLink` supports `asChild` so consumers wrap next/link without
   nesting anchors. The trail is a real <nav aria-label="Breadcrumb"> over an
   <ol>, and the current page is <span aria-current="page"> rather than a link,
   matching the WAI-ARIA breadcrumb pattern.
   ========================================================================== */

function Breadcrumb({ className, ...props }: React.ComponentProps<'nav'>) {
  return (
    <nav
      data-slot="breadcrumb"
      aria-label="Breadcrumb"
      className={cn('w-full', className)}
      {...props}
    />
  )
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      data-slot="breadcrumb-list"
      className={cn(
        'flex flex-wrap items-center gap-1 text-sm text-muted sm:gap-1.5',
        className,
      )}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-item"
      className={cn('inline-flex items-center gap-1.5', className)}
      {...props}
    />
  )
}

export interface BreadcrumbLinkProps extends React.ComponentProps<'a'> {
  asChild?: boolean
}

function BreadcrumbLink({ className, asChild = false, ...props }: BreadcrumbLinkProps) {
  const Comp = asChild ? Slot : 'a'
  return (
    <Comp
      data-slot="breadcrumb-link"
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm px-1 py-0.5 -mx-1 font-medium text-muted',
        'transition-colors duration-200 ease-[var(--ease-out-quint)] hover:text-foreground hover:bg-surface-sunken',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      )}
      {...props}
    />
  )
}

function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-page"
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('font-semibold text-foreground', className)}
      {...props}
    />
  )
}

function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li
      data-slot="breadcrumb-separator"
      role="presentation"
      aria-hidden="true"
      className={cn('text-faint [&>svg]:size-3.5', className)}
      {...props}
    >
      {children ?? <ChevronRight strokeWidth={2.25} />}
    </li>
  )
}

/** Collapsed middle of a long trail. Pair with a dropdown for the hidden crumbs. */
function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      data-slot="breadcrumb-ellipsis"
      role="presentation"
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-md text-faint transition-colors duration-150 hover:bg-surface-sunken hover:text-muted',
        className,
      )}
      {...props}
    >
      <Ellipsis aria-hidden="true" className="size-4" />
      <span className="sr-only">More pages</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
