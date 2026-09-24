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

const keyFor = (slug: string) => `ezra:custom-categories:${slug}`
const EVENT = 'ezra:custom-categories'

function read(slug: string): CustomCategory[] {
  try {
    const raw = window.localStorage.getItem(keyFor(slug))
    const list = raw ? (JSON.parse(raw) as CustomCategory[]) : []
    return Array.isArray(list) ? list.filter((entry) => entry && typeof entry.label === 'string') : []
  } catch {
    return []
  }
}

export function useCustomCategories(tenantSlug: string) {
  const [categories, setCategories] = React.useState<CustomCategory[]>([])

  React.useEffect(() => {
    setCategories(read(tenantSlug))
    const sync = () => setCategories(read(tenantSlug))
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [tenantSlug])

  const write = (next: CustomCategory[]) => {
    setCategories(next)
    try {
      window.localStorage.setItem(keyFor(tenantSlug), JSON.stringify(next))
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
