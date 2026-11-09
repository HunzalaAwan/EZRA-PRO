import type { Menu } from './types'

/* ==========================================================================
   Menu store — the owner's menu edits, kept in this browser per business so
   the dashboard and the ordering page read the same menu. Nothing saved =
   the seeded menu. Browser-safe; read it through useMenu.
   ========================================================================== */

export const MENU_EVENT = 'ezra:menu'

interface StoredMenu {
  version: 1
  menu: Menu
}

export function menuKey(tenantId: string): string {
  return `ezra:menu:${tenantId}`
}

/** '' when nothing is saved or storage is blocked. */
export function readMenuRaw(tenantId: string): string {
  try {
    return window.localStorage.getItem(menuKey(tenantId)) ?? ''
  } catch {
    return ''
  }
}

/** null = back to the seeded menu. */
export function writeMenu(tenantId: string, menu: Menu | null): void {
  try {
    if (menu) {
      const stored: StoredMenu = { version: 1, menu }
      window.localStorage.setItem(menuKey(tenantId), JSON.stringify(stored))
    } else {
      window.localStorage.removeItem(menuKey(tenantId))
    }
  } catch {
    /* blocked storage: the edit lives until the page reloads */
  }
  window.dispatchEvent(new Event(MENU_EVENT))
}

/** The saved menu wins; 30-day sales come from the seed for dishes it knows. Anything unreadable gives the seed. */
export function mergeMenu(seed: Menu, raw: string): Menu {
  if (!raw) return seed
  try {
    const parsed = JSON.parse(raw) as Partial<StoredMenu> | null
    const saved = parsed?.menu
    if (!parsed || parsed.version !== 1 || !saved || !Array.isArray(saved.items) || !Array.isArray(saved.categories)) return seed
    const sales = new Map(seed.items.map((item) => [item.id, item]))
    return {
      categories: saved.categories,
      items: saved.items.map((item) => {
        const known = sales.get(item.id)
        const withDefaults = { ...item, tags: item.tags ?? [], channels: item.channels ?? [], modifiers: item.modifiers ?? [] }
        return known ? { ...withDefaults, sold30d: known.sold30d, revenue30d: known.revenue30d } : { ...withDefaults, sold30d: item.sold30d ?? 0, revenue30d: item.revenue30d ?? 0 }
      }),
      sharedGroups: Array.isArray(saved.sharedGroups) ? saved.sharedGroups : seed.sharedGroups ?? [],
    }
  } catch {
    return seed
  }
}
