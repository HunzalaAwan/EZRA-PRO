import type { DashboardNavItem, DashboardNavSection } from '@/lib/site-config'
import { DASHBOARD_NAV } from '@/lib/site-config'
import type { VerticalKey } from '@/types'

/* ==========================================================================
   Workspace profile — how the dashboard is shaped for the kind of business
   that owns it.

   A dive shop, a tour operator and a climbing outfit all run on departures
   and seats, so they share one profile. A restaurant runs on tables, covers
   and orders; a hotel runs on rooms, arrivals and housekeeping, usually with
   a restaurant downstairs. Those two get a hospitality profile that swaps
   the nav, the words and the storefront — while guests, payments, reviews,
   analytics, team and settings stay shared.

   Plain data, safe on the server and in the browser.
   ========================================================================== */

export type WorkspaceFamily = 'experiences' | 'hospitality'
export type StorefrontKind = 'experiences' | 'restaurant' | 'hotel'

export interface WorkspaceVocab {
  /** "booking" / "reservation" */
  booking: string
  bookings: string
  /** The thing in the catalogue: "experience" / "dish" / "room" */
  item: string
  items: string
  /** Nav word for the catalogue page. */
  catalogue: string
  /** "seat" / "cover" / "room" — the unit that sells out. */
  unit: string
  units: string
  /** "departure" / "seating" / "arrival" */
  slot: string
  slots: string
  /** "Crew" / "Staff" */
  team: string
  /** Label on the topbar's primary button. */
  newBooking: string
  /** Where the topbar button goes. */
  newBookingHref: string
}

export interface WorkspaceModules {
  /** Orders and a menu. */
  dining: boolean
  /** Rooms, stays, housekeeping, rates. */
  lodging: boolean
  /** Departure-based experiences (also true for hotels that sell dinners and tours). */
  experiences: boolean
}

export interface WorkspaceProfile {
  family: WorkspaceFamily
  storefront: StorefrontKind
  modules: WorkspaceModules
  nav: DashboardNavSection[]
  vocab: WorkspaceVocab
  /**
   * Routes that belong to the other family, mapped onto this profile's
   * equivalent so an old bookmark never lands a restaurant on a boat
   * manifest.
   */
  redirects: Record<string, string>
  /** One line for the overview masthead. */
  overviewHint: string
}

/* --------------------------------------------------------------------------
   Shared tails: Grow and Workspace are the same for everyone.
   -------------------------------------------------------------------------- */

const GROW = (guestsLabel: string): DashboardNavSection => ({
  heading: 'Grow',
  items: [
    { label: 'Analytics', href: '/dashboard/analytics', icon: 'ChartSpline' },
    { label: guestsLabel, href: '/dashboard/customers', icon: 'Users' },
    { label: 'Abandoned carts', href: '/dashboard/abandoned', icon: 'ShoppingCart', countKey: 'abandonedCarts' },
    { label: 'Payments', href: '/dashboard/payments', icon: 'CreditCard' },
    { label: 'Reviews', href: '/dashboard/reviews', icon: 'Star' },
  ],
})

const WORKSPACE: DashboardNavSection = {
  heading: 'Workspace',
  items: [
    { label: 'Team', href: '/dashboard/team', icon: 'UserCog' },
    { label: 'Storefront', href: '/dashboard/storefront', icon: 'Store' },
    { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
  ],
}

/* --------------------------------------------------------------------------
   Experiences — the profile the product started with.
   -------------------------------------------------------------------------- */

const EXPERIENCES: WorkspaceProfile = {
  family: 'experiences',
  storefront: 'experiences',
  modules: { dining: false, lodging: false, experiences: true },
  nav: DASHBOARD_NAV,
  vocab: {
    booking: 'booking',
    bookings: 'bookings',
    item: 'experience',
    items: 'experiences',
    catalogue: 'Activities',
    unit: 'seat',
    units: 'seats',
    slot: 'departure',
    slots: 'departures',
    team: 'Crew',
    newBooking: 'New booking',
    newBookingHref: '/dashboard/bookings?new=1',
  },
  redirects: {
    '/dashboard/reservations': '/dashboard/bookings',
    '/dashboard/orders': '/dashboard/bookings',
    '/dashboard/floor': '/dashboard/manifest',
    '/dashboard/menu': '/dashboard/activities',
    '/dashboard/hours': '/dashboard/availability',
    '/dashboard/front-desk': '/dashboard/manifest',
    '/dashboard/stays': '/dashboard/bookings',
    '/dashboard/rooms': '/dashboard/resources',
    '/dashboard/housekeeping': '/dashboard/manifest',
    '/dashboard/rates': '/dashboard/availability',
  },
  overviewHint: 'departures',
}

/* --------------------------------------------------------------------------
   Restaurant — the pass, the menu and the hours. Tables are booked by
   phone, so there is no book and no floor plan here.
   -------------------------------------------------------------------------- */

const RESTAURANT_TODAY: DashboardNavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Orders', href: '/dashboard/orders', icon: 'ShoppingBag', countKey: 'liveOrders' },
]

const RESTAURANT: WorkspaceProfile = {
  family: 'hospitality',
  storefront: 'restaurant',
  modules: { dining: true, lodging: false, experiences: true },
  nav: [
    { items: RESTAURANT_TODAY },
    {
      heading: 'Kitchen',
      items: [
        { label: 'Menu', href: '/dashboard/menu', icon: 'UtensilsCrossed' },
        { label: 'Hours', href: '/dashboard/hours', icon: 'Clock' },
      ],
    },
    GROW('Guests'),
    WORKSPACE,
  ],
  vocab: {
    booking: 'order',
    bookings: 'orders',
    item: 'dish',
    items: 'dishes',
    catalogue: 'Menu',
    unit: 'order',
    units: 'orders',
    slot: 'service',
    slots: 'services',
    team: 'Staff',
    newBooking: 'New order',
    newBookingHref: '/dashboard/orders?new=1',
  },
  redirects: {
    '/dashboard/bookings': '/dashboard/orders',
    '/dashboard/manifest': '/dashboard/orders',
    '/dashboard/calendar': '/dashboard/hours',
    '/dashboard/resources': '/dashboard/menu',
    '/dashboard/availability': '/dashboard/hours',
    '/dashboard/reservations': '/dashboard/orders',
    '/dashboard/floor': '/dashboard/orders',
    '/dashboard/front-desk': '/dashboard/orders',
    '/dashboard/stays': '/dashboard/orders',
    '/dashboard/rooms': '/dashboard/menu',
    '/dashboard/housekeeping': '/dashboard/orders',
    '/dashboard/rates': '/dashboard/hours',
  },
  overviewHint: 'orders',
}

/* --------------------------------------------------------------------------
   Hotel — the front desk first, then the kitchen downstairs: orders to
   rooms, pickup, and the menu. Tables are booked by phone.
   -------------------------------------------------------------------------- */

const HOTEL: WorkspaceProfile = {
  family: 'hospitality',
  storefront: 'hotel',
  modules: { dining: true, lodging: true, experiences: true },
  nav: [
    {
      items: [
        { label: 'Overview', href: '/dashboard', icon: 'LayoutDashboard' },
        { label: 'Front desk', href: '/dashboard/front-desk', icon: 'ConciergeBell', countKey: 'arrivalsToday' },
        { label: 'Reservations', href: '/dashboard/stays', icon: 'CalendarCheck' },
        { label: 'Rooms', href: '/dashboard/rooms', icon: 'BedDouble' },
        { label: 'Housekeeping', href: '/dashboard/housekeeping', icon: 'Brush', countKey: 'roomsToClean' },
      ],
    },
    {
      heading: 'Dining',
      items: [
        { label: 'Orders', href: '/dashboard/orders', icon: 'ShoppingBag', countKey: 'liveOrders' },
        { label: 'Menu', href: '/dashboard/menu', icon: 'UtensilsCrossed' },
        { label: 'Hours', href: '/dashboard/hours', icon: 'Clock' },
      ],
    },
    {
      heading: 'Revenue',
      items: [
        { label: 'Rates & availability', href: '/dashboard/rates', icon: 'Tags' },
        { label: 'Experiences', href: '/dashboard/activities', icon: 'Compass' },
      ],
    },
    GROW('Guests'),
    WORKSPACE,
  ],
  vocab: {
    booking: 'reservation',
    bookings: 'reservations',
    item: 'room',
    items: 'rooms',
    catalogue: 'Rooms',
    unit: 'room',
    units: 'rooms',
    slot: 'arrival',
    slots: 'arrivals',
    team: 'Staff',
    newBooking: 'New reservation',
    newBookingHref: '/dashboard/stays?new=1',
  },
  redirects: {
    '/dashboard/bookings': '/dashboard/stays',
    '/dashboard/manifest': '/dashboard/front-desk',
    '/dashboard/calendar': '/dashboard/stays',
    '/dashboard/resources': '/dashboard/rooms',
    '/dashboard/availability': '/dashboard/rates',
    '/dashboard/floor': '/dashboard/orders',
    '/dashboard/reservations': '/dashboard/orders',
  },
  overviewHint: 'arrivals',
}

/* --------------------------------------------------------------------------
   Lookup
   -------------------------------------------------------------------------- */

const PROFILES: Record<VerticalKey, WorkspaceProfile> = {
  watersports: EXPERIENCES,
  tours: EXPERIENCES,
  island: EXPERIENCES,
  adventure: EXPERIENCES,
  wellness: EXPERIENCES,
  restaurants: RESTAURANT,
  hotels: HOTEL,
}

export function getWorkspaceProfile(vertical: VerticalKey): WorkspaceProfile {
  return PROFILES[vertical]
}

export function isHospitality(vertical: VerticalKey): boolean {
  return PROFILES[vertical].family === 'hospitality'
}

/** Every nav item across every profile, for breadcrumbs and the command palette. */
export function flattenNav(nav: DashboardNavSection[]) {
  return nav.flatMap((section) =>
    section.items.map((item) => ({
      label: item.label,
      href: item.href,
      icon: item.icon,
      section: section.heading ?? 'Today',
    })),
  )
}
