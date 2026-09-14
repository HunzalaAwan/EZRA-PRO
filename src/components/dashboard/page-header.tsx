import * as React from 'react'
import Link from 'next/link'

import { cn } from '@/lib/utils'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

/* ==========================================================================
   PageHeader — the masthead every dashboard screen starts with.

   Deliberately layout-only and hook-free so it can be rendered from a server
   component or a client one. The API is a contract shared across the product:
   title / description / actions / tabs / breadcrumb, nothing else.
   ========================================================================== */

export interface PageHeaderProps {
  title: string
  description?: string
  /** Right-aligned action slot. Stacks beneath the title on narrow screens. */
  actions?: React.ReactNode
  /** Rendered in a full-bleed row beneath the header, over a hairline. */
  tabs?: React.ReactNode
  breadcrumb?: { label: string; href?: string }[]
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  tabs,
  breadcrumb,
  className,
}: PageHeaderProps) {
  const crumbs = breadcrumb ?? []

  return (
    <header className={cn('mb-6 flex flex-col gap-4 sm:gap-5', className)}>
      {crumbs.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1
              return (
                <React.Fragment key={`${crumb.label}-${index}`}>
                  <BreadcrumbItem>
                    {crumb.href && !isLast ? (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {!isLast ? <BreadcrumbSeparator /> : null}
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
        <div className="min-w-0 max-w-3xl">
          <h1 className="font-display text-display-sm font-semibold text-balance text-foreground">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-[0.9375rem] leading-relaxed text-muted text-pretty">
              {description}
            </p>
          ) : null}
        </div>

        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end sm:pb-1">
            {actions}
          </div>
        ) : null}
      </div>

      {tabs ? (
        <div className="-mx-4 overflow-x-auto border-b border-line px-4 no-scrollbar sm:mx-0 sm:px-0">
          {tabs}
        </div>
      ) : null}
    </header>
  )
}
