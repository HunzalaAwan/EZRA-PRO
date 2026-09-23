/**
 * Navigation and static site metadata.
 * Icon fields hold lucide-react icon NAMES, resolved at render time so this
 * module stays a plain data file usable from both server and client components.
 */

export const SITE = {
  name: 'EZRA Pro',
  tagline: 'Booking software for experiences that sell out',
  description:
    'The booking and revenue platform for watersports, tours, adventure and hospitality operators.',
  url: 'https://ezrapro.com',
  supportEmail: 'hello@ezrapro.com',
  phone: '+1 (808) 555-0142',
} as const

/* ==========================================================================
   MARKETING NAVIGATION
   ========================================================================== */

export interface NavLink {
  label: string
  href: string
  description?: string
  icon?: string
  badge?: string
  external?: boolean
}

export interface NavGroup {
  label: string
  /** Rendered as a mega-menu when items are present. */
  items?: NavLink[]
  href?: string
  /** Optional promoted card inside the mega-menu. */
  feature?: { title: string; description: string; href: string; icon: string }
}

export const MARKETING_NAV: NavGroup[] = [
  {
    label: 'Product',
    items: [
      {
        label: 'Online booking',
        href: '/product/booking',
        description: 'A checkout guests finish — on any device, in under 60 seconds.',
        icon: 'ShoppingCart',
      },
      {
        label: 'Scheduling & calendar',
        href: '/product/scheduling',
        description: 'Departures, capacity, staff and equipment on one timeline.',
        icon: 'CalendarDays',
      },
      {
        label: 'Analytics',
        href: '/product/analytics',
        description: 'Know which slot to cut and which to add. Weekly.',
        icon: 'ChartSpline',
        badge: 'New',
      },
      {
        label: 'Payments & payouts',
        href: '/product/payments',
        description: 'Take deposits, split tips, get paid next day.',
        icon: 'CreditCard',
      },
      {
        label: 'Guest CRM',
        href: '/product/crm',
        description: 'Every guest, every trip, every review in one profile.',
        icon: 'Users',
      },
      {
        label: 'Channel manager',
        href: '/product/channels',
        description: 'Viator, GetYourGuide and Expedia stay in sync automatically.',
        icon: 'Share2',
      },
    ],
  },
  {
    label: 'Solutions',
    items: [
      { label: 'Watersports & marine', href: '/solutions/watersports', description: 'Charters, dives, jet skis, surf schools.', icon: 'Waves' },
      { label: 'Tours & sightseeing', href: '/solutions/tours', description: 'Walking, bus, boat and food tours.', icon: 'Compass' },
      { label: 'Island & resort', href: '/solutions/island', description: 'Multi-activity resorts and excursion desks.', icon: 'Palmtree' },
      { label: 'Adventure & outdoor', href: '/solutions/adventure', description: 'Rafting, climbing, ziplines, heli tours.', icon: 'Mountain' },
      { label: 'Restaurants & venues', href: '/solutions/restaurants', description: 'Seatings, tasting menus, private events.', icon: 'UtensilsCrossed' },
      { label: 'Wellness & retreats', href: '/solutions/wellness', description: 'Classes, spa slots, multi-day retreats.', icon: 'Sparkles' },
    ],
  },
  { label: 'Pricing', href: '/pricing' },
]

export const FOOTER_NAV: { heading: string; links: NavLink[] }[] = [
  {
    heading: 'Product',
    links: [
      { label: 'Online booking', href: '/product/booking' },
      { label: 'Scheduling', href: '/product/scheduling' },
      { label: 'Analytics', href: '/product/analytics' },
      { label: 'Payments', href: '/product/payments' },
      { label: 'Guest CRM', href: '/product/crm' },
      { label: 'Channel manager', href: '/product/channels' },
    ],
  },
  {
    heading: 'Solutions',
    links: [
      { label: 'Watersports', href: '/solutions/watersports' },
      { label: 'Tours', href: '/solutions/tours' },
      { label: 'Island & resort', href: '/solutions/island' },
      { label: 'Adventure', href: '/solutions/adventure' },
      { label: 'Restaurants', href: '/solutions/restaurants' },
      { label: 'Wellness', href: '/solutions/wellness' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Careers', href: '/careers', badge: 'Hiring' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '/legal/privacy' },
      { label: 'Terms', href: '/legal/terms' },
      { label: 'Security', href: '/legal/security' },
    ],
  },
]

/* ==========================================================================
   DASHBOARD NAVIGATION
   ========================================================================== */

export interface DashboardNavItem {
  label: string
  href: string
  icon: string
  /** Shown as a count chip; resolved at render time from live data. */
  countKey?:
    | 'pendingBookings'
    | 'todayDepartures'
    | 'unreadMessages'
    | 'abandonedCarts'
    | 'liveOrders'
    | 'arrivalsToday'
    | 'roomsToClean'
    | 'openConversations'
  children?: { label: string; href: string }[]
  /** Hidden unless the tenant's plan enables this feature. */
  requiresFeature?: string
}

export interface DashboardNavSection {
  heading?: string
  items: DashboardNavItem[]
}

export const DASHBOARD_NAV: DashboardNavSection[] = [
  {
    items: [
      { label: 'Overview', href: '/dashboard', icon: 'LayoutDashboard' },
      { label: 'Calendar', href: '/dashboard/calendar', icon: 'CalendarDays', countKey: 'todayDepartures' },
      { label: 'Bookings', href: '/dashboard/bookings', icon: 'Ticket', countKey: 'pendingBookings' },
      { label: 'Inbox', href: '/dashboard/inbox', icon: 'MessageCircle', countKey: 'openConversations' },
      { label: 'Manifest', href: '/dashboard/manifest', icon: 'ClipboardList' },
    ],
  },
  {
    heading: 'Operations',
    items: [
      { label: 'Rentals', href: '/dashboard/rentals', icon: 'KeyRound' },
      { label: 'Charter requests', href: '/dashboard/requests', icon: 'Inbox' },
      { label: 'Pickups', href: '/dashboard/pickups', icon: 'Bus' },
      { label: 'Check-in', href: '/dashboard/check-in', icon: 'ScanLine' },
      { label: 'Weather', href: '/dashboard/weather', icon: 'CloudSun' },
      { label: 'Capacity', href: '/dashboard/capacity', icon: 'Gauge' },
      { label: 'My day', href: '/dashboard/my-day', icon: 'Sunrise' },
    ],
  },
  {
    heading: 'Catalog',
    items: [
      { label: 'Activities', href: '/dashboard/activities', icon: 'Waves' },
      { label: 'Resources', href: '/dashboard/resources', icon: 'Ship' },
      { label: 'Availability', href: '/dashboard/availability', icon: 'CalendarClock' },
    ],
  },
  {
    heading: 'Grow',
    items: [
      { label: 'Analytics', href: '/dashboard/analytics', icon: 'ChartSpline' },
      { label: 'Customers', href: '/dashboard/customers', icon: 'Users' },
      { label: 'Abandoned carts', href: '/dashboard/abandoned', icon: 'ShoppingCart', countKey: 'abandonedCarts' },
      { label: 'Payments', href: '/dashboard/payments', icon: 'CreditCard' },
      { label: 'Reviews', href: '/dashboard/reviews', icon: 'Star' },
    ],
  },
  {
    heading: 'Workspace',
    items: [
      { label: 'Team', href: '/dashboard/team', icon: 'UserCog' },
      { label: 'Storefront', href: '/dashboard/storefront', icon: 'Store' },
      { label: 'Settings', href: '/dashboard/settings', icon: 'Settings' },
    ],
  },
]

/* ==========================================================================
   MISC
   ========================================================================== */

export const SOCIAL_LINKS: NavLink[] = [
  { label: 'X', href: 'https://x.com', icon: 'Twitter', external: true },
  { label: 'LinkedIn', href: 'https://linkedin.com', icon: 'Linkedin', external: true },
  { label: 'Instagram', href: 'https://instagram.com', icon: 'Instagram', external: true },
  { label: 'YouTube', href: 'https://youtube.com', icon: 'Youtube', external: true },
]

