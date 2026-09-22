import type { VerticalKey } from '@/types'

/* ==========================================================================
   Storefront settings — what an operator's public booking site shows, and
   how the experiences are laid out on a phone and on a desktop.

   Kept in the browser (localStorage, one key per tenant) because the demo
   has no backend: the dashboard writes, the storefront reads, and both stay
   in step across tabs through the `storage` event. Defaults come from the
   trade: only tour operators start with the "Next departures" strip on.
   ========================================================================== */

export type StorefrontSectionKey =
  | 'trust'
  | 'departures'
  | 'about'
  | 'reviews'
  | 'contact'
  /* restaurants */
  | 'menu'
  | 'reserve'
  | 'tastings'
  /* hotels */
  | 'rooms'
  | 'dining'
  | 'experiences'
export type MobileLayout = 'cards' | 'grid' | 'list'
export type DesktopLayout = 'grid' | 'list'

export interface StorefrontSettings {
  version: 1
  /** Which optional sections the homepage shows. The hero and the experiences always show. */
  sections: Record<StorefrontSectionKey, boolean>
  /** The trust strip is desktop-only unless this is on. */
  trustOnPhones: boolean
  mobileLayout: MobileLayout
  desktopLayout: DesktopLayout
}

export const SECTION_META: { key: StorefrontSectionKey; label: string; hint: string }[] = [
  { key: 'trust', label: 'Trust strip', hint: 'Secure checkout, instant confirmation, cancellation, rating.' },
  { key: 'departures', label: 'Next departures', hint: 'A live strip of the next six departures. Built for tour operators.' },
  { key: 'about', label: 'About and crew', hint: 'Your story, the numbers, and the people on the day.' },
  { key: 'reviews', label: 'Guest reviews', hint: 'Six recent reviews with the overall rating.' },
  { key: 'contact', label: 'Contact and directions', hint: 'Phone, email, hours and the meeting point.' },
]

/** The sections a restaurant storefront can switch on and off. The menu always shows. */
export const RESTAURANT_SECTION_META: { key: StorefrontSectionKey; label: string; hint: string }[] = [
  { key: 'tastings', label: 'Tasting menus and events', hint: 'Prepaid seatings with their own dates and deposits.' },
  { key: 'about', label: 'About the kitchen', hint: 'Your story and the people behind the pass.' },
  { key: 'reviews', label: 'Guest reviews', hint: 'Six recent reviews with the overall rating.' },
  { key: 'contact', label: 'Hours and directions', hint: 'Service hours, delivery zones, phone and the map.' },
]

/** The sections a hotel storefront can switch on and off. Rooms always show. */
export const HOTEL_SECTION_META: { key: StorefrontSectionKey; label: string; hint: string }[] = [
  { key: 'dining', label: 'Menu and room service', hint: 'The kitchen’s menu, orderable to the room or for pickup.' },
  { key: 'experiences', label: 'Experiences', hint: 'Dinners, walks and the spa, bookable by guests and visitors.' },
  { key: 'about', label: 'About the house', hint: 'Your story and the people at the desk.' },
  { key: 'reviews', label: 'Guest reviews', hint: 'Six recent reviews with the overall rating.' },
  { key: 'contact', label: 'Location and contact', hint: 'Address, check-in hours, phone and the map.' },
]

export function sectionMetaFor(vertical: VerticalKey) {
  if (vertical === 'restaurants') return RESTAURANT_SECTION_META
  if (vertical === 'hotels') return HOTEL_SECTION_META
  return SECTION_META
}

export const MOBILE_LAYOUTS: { value: MobileLayout; label: string; hint: string }[] = [
  { value: 'cards', label: 'Cards', hint: 'One tall photo card per experience.' },
  { value: 'grid', label: 'Grid', hint: 'Two compact cards per row.' },
  { value: 'list', label: 'List', hint: 'Photo on the left, details on the right.' },
]

export const DESKTOP_LAYOUTS: { value: DesktopLayout; label: string; hint: string }[] = [
  { value: 'grid', label: 'Grid', hint: 'Three cards per row.' },
  { value: 'list', label: 'List', hint: 'One wide row per experience.' },
]

export function defaultStorefrontSettings(vertical: VerticalKey): StorefrontSettings {
  return {
    version: 1,
    sections: {
      trust: true,
      departures: vertical === 'tours',
      about: true,
      reviews: true,
      contact: true,
      menu: true,
      reserve: true,
      tastings: true,
      rooms: true,
      dining: true,
      experiences: true,
    },
    trustOnPhones: false,
    mobileLayout: 'cards',
    desktopLayout: 'grid',
  }
}

export const STOREFRONT_SETTINGS_EVENT = 'ezra:storefront-settings'

export function storefrontSettingsKey(slug: string) {
  return `ezra:storefront-settings:${slug}`
}

/** Parse a stored value over the defaults, so a new field never breaks an old save. */
export function mergeStorefrontSettings(defaults: StorefrontSettings, raw: string): StorefrontSettings {
  if (!raw) return defaults
  try {
    const parsed = JSON.parse(raw) as Partial<StorefrontSettings>
    return {
      ...defaults,
      ...parsed,
      version: 1,
      sections: { ...defaults.sections, ...(parsed.sections ?? {}) },
    }
  } catch {
    return defaults
  }
}

export function readStorefrontSettingsRaw(slug: string): string {
  try {
    return window.localStorage.getItem(storefrontSettingsKey(slug)) ?? ''
  } catch {
    return ''
  }
}

export function writeStorefrontSettings(slug: string, settings: StorefrontSettings | null) {
  try {
    const key = storefrontSettingsKey(slug)
    if (settings) window.localStorage.setItem(key, JSON.stringify(settings))
    else window.localStorage.removeItem(key)
  } catch {
    /* private mode or blocked storage: the page simply keeps its defaults */
  }
  window.dispatchEvent(new Event(STOREFRONT_SETTINGS_EVENT))
}
