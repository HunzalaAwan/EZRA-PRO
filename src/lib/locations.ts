import type { Location } from '@/types'

/* ==========================================================================
   Locations store — the operator's edits to the business's bases, kept in
   the browser because the demo has no backend. The seeded bases come from
   the server; additions, changes and removals are layered over them here,
   the same way storefront settings and activity edits work.
   ========================================================================== */

export const LOCATIONS_EVENT = 'ezra:locations'

export const locationsStorageKey = (tenantId: string) => `ezra:locations:${tenantId}`

/** Edits layered over the seeded bases. */
export interface LocationEdits {
  added: Location[]
  updated: Record<string, Partial<Location>>
  removed: string[]
  /** Set when the operator moved the default to another base. */
  defaultId?: string
}

export const EMPTY_LOCATION_EDITS: LocationEdits = { added: [], updated: {}, removed: [] }

export function readLocationEditsRaw(tenantId: string): string {
  try {
    return window.localStorage.getItem(locationsStorageKey(tenantId)) ?? ''
  } catch {
    return ''
  }
}

export function parseLocationEdits(raw: string): LocationEdits {
  if (!raw) return EMPTY_LOCATION_EDITS
  try {
    const parsed = JSON.parse(raw) as Partial<LocationEdits> | null
    if (!parsed || typeof parsed !== 'object') return EMPTY_LOCATION_EDITS
    return {
      added: Array.isArray(parsed.added) ? parsed.added : [],
      updated: parsed.updated && typeof parsed.updated === 'object' ? parsed.updated : {},
      removed: Array.isArray(parsed.removed) ? parsed.removed : [],
      defaultId: typeof parsed.defaultId === 'string' ? parsed.defaultId : undefined,
    }
  } catch {
    return EMPTY_LOCATION_EDITS
  }
}

export function writeLocationEdits(tenantId: string, edits: LocationEdits | null) {
  try {
    if (edits) window.localStorage.setItem(locationsStorageKey(tenantId), JSON.stringify(edits))
    else window.localStorage.removeItem(locationsStorageKey(tenantId))
  } catch {
    /* blocked storage: the edit lives for this page only */
  }
  window.dispatchEvent(new Event(LOCATIONS_EVENT))
}

/** The seeded bases with the operator's edits laid over them; exactly one is the default. */
export function mergeLocations(seeded: Location[], edits: LocationEdits): Location[] {
  const removed = new Set(edits.removed)
  const list: Location[] = [
    ...seeded.filter((site) => !removed.has(site.id)).map((site) => ({ ...site, ...edits.updated[site.id] })),
    ...edits.added.filter((site) => !removed.has(site.id)).map((site) => ({ ...site, ...edits.updated[site.id] })),
  ]
  const defaultId =
    edits.defaultId && list.some((site) => site.id === edits.defaultId)
      ? edits.defaultId
      : (list.find((site) => site.isDefault) ?? list[0])?.id
  return list.map((site) => ({ ...site, isDefault: site.id === defaultId }))
}

/** "Address, City" for a base. */
export function locationAddress(location: Pick<Location, 'addressLine' | 'city'>): string {
  return [location.addressLine, location.city].filter(Boolean).join(', ')
}

export function newLocationId(): string {
  return `loc_new_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function slugifyLocation(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
