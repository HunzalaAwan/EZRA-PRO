'use client'

import * as React from 'react'

/* ==========================================================================
   Categories a business makes for itself ("Sunset specials", "Kids' club"),
   next to the built-in ones. Kept per business in the browser for the demo;
   every activity form and list reads the same list.
   ========================================================================== */

export interface CustomCategory {
  label: string
  hint: string
}

const keyFor = (slug: string, list: string) => `ezra:custom-${list}:${slug}`
const EVENT = 'ezra:custom-lists'

function read(slug: string, list: string): CustomCategory[] {
  try {
    const raw = window.localStorage.getItem(keyFor(slug, list))
    const items = raw ? (JSON.parse(raw) as CustomCategory[]) : []
    return Array.isArray(items) ? items.filter((entry) => entry && typeof entry.label === 'string') : []
  } catch {
    return []
  }
}

/** A business's own entries for a pick list; "categories" by default, "charter-vessels" for charters. */
export function useCustomCategories(tenantSlug: string, list = 'categories') {
  const [categories, setCategories] = React.useState<CustomCategory[]>([])

  React.useEffect(() => {
    setCategories(read(tenantSlug, list))
    const sync = () => setCategories(read(tenantSlug, list))
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [tenantSlug, list])

  const write = (next: CustomCategory[]) => {
    setCategories(next)
    try {
      window.localStorage.setItem(keyFor(tenantSlug, list), JSON.stringify(next))
      window.setTimeout(() => window.dispatchEvent(new Event(EVENT)), 0)
    } catch {
      /* storage blocked: lives until reload */
    }
  }

  return {
    categories,
    add: (category: CustomCategory) => write([...categories, category]),
    remove: (label: string) => write(categories.filter((entry) => entry.label !== label)),
  }
}
