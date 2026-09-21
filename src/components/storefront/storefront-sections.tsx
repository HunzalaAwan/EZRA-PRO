'use client'

import * as React from 'react'

import { useStorefrontSettings } from '@/hooks/use-storefront-settings'
import type { StorefrontSectionKey } from '@/lib/storefront-settings'
import { cn } from '@/lib/utils'
import type { VerticalKey } from '@/types'

/* ==========================================================================
   <StorefrontSections> — the homepage, showing the sections the operator
   switched on.

   The page renders every section on the server and wraps each in a
   <StorefrontSection id="…">. This client parent reads the saved settings
   and keeps the ones that are on; the hero and the catalogue always show.
   ========================================================================== */

type SectionId = StorefrontSectionKey | 'hero' | 'catalogue'

export function StorefrontSection({ id, children }: { id: SectionId; children: React.ReactNode }) {
  return <>{children}</>
}

export function StorefrontSections({
  slug,
  vertical,
  children,
}: {
  slug: string
  vertical: VerticalKey
  children: React.ReactNode
}) {
  const { settings } = useStorefrontSettings(slug, vertical)

  const visible = (id: SectionId) =>
    id === 'hero' || id === 'catalogue' || id === 'menu' || id === 'rooms' ? true : settings.sections[id]

  const items = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<{ id: SectionId }> =>
      React.isValidElement<{ id: SectionId }>(child) && visible(child.props.id),
  )

  return (
    <>
      {items.map((child) =>
        child.props.id === 'trust' ? (
          <div key={child.key ?? 'trust'} className={cn(!settings.trustOnPhones && 'hidden md:block')}>
            {child}
          </div>
        ) : (
          child
        ),
      )}
    </>
  )
}
