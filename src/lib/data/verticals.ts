/**
 * The six industry verticals EZRA Pro sells into.
 *
 * Drives the marketing-site vertical switcher, the onboarding picker, and the
 * category taxonomy every Activity is filed under. `icon` is a lucide-react
 * export name resolved at render time so this module stays server-safe.
 */

import type { Vertical, VerticalKey } from '@/types'

export const VERTICALS: Vertical[] = [
  {
    key: 'watersports',
    label: 'Watersports',
    tagline: 'Sell every seat on every hull — tides, weather and all.',
    icon: 'Waves',
    sampleActivities: [
      'Sunset Catamaran Sail',
      'Reef Snorkel Tour',
      'Jet Ski Safari',
      'Beginner Surf Lesson',
      'Two-Tank Reef Dive',
      'Private Sportfishing Charter',
    ],
    accent: 'lagoon',
  },
  {
    key: 'tours',
    label: 'Tours & Sightseeing',
    tagline: 'Multi-departure day tours that fill themselves.',
    icon: 'Compass',
    sampleActivities: [
      'Old Town Walking Tour',
      'Vineyard Day Trip',
      'Hop-On Coastal Loop',
      'Sunrise Volcano Drive',
      'Street Food Crawl',
    ],
    accent: 'sunset',
  },
  {
    key: 'restaurants',
    label: 'Restaurants & Tasting',
    tagline: 'Covers, prepayments and no-shows, finally under control.',
    icon: 'UtensilsCrossed',
    sampleActivities: [
      'Sunset Tasting Menu',
      "Chef's Counter Seating",
      'Cellar Wine Flight',
      'Long Lunch Terrace',
      'Private Dining Room',
    ],
    accent: 'coral',
  },
  {
    key: 'hotels',
    label: 'Hotels & Stays',
    tagline: 'Rooms, arrivals, housekeeping and the restaurant downstairs, in one front desk.',
    icon: 'BedDouble',
    sampleActivities: [
      'River View Suite',
      'Terrace Room',
      'Rooftop Sunset Dinner',
      'Spa Ritual',
      'Late checkout',
    ],
    accent: 'sunset',
  },
  {
    key: 'adventure',
    label: 'Adventure & Outdoors',
    tagline: 'Guides, gear and vehicles scheduled in one pass.',
    icon: 'Mountain',
    sampleActivities: [
      'Alpine Guided Climb',
      'Canyon Jet Boat',
      'Whitewater Raft Expedition',
      'Heli Glacier Landing',
      'Summit Trek',
      'E-Bike & Picnic Ride',
    ],
    accent: 'reef',
  },
  {
    key: 'island',
    label: 'Island & Reef',
    tagline: 'Reef days, liveaboards and transfers on one manifest.',
    icon: 'Palmtree',
    sampleActivities: [
      'Outer Reef Dive Day',
      'Liveaboard Expedition',
      'Island Hopping Cruise',
      'Glass-Bottom Reef Tour',
      'Sandbank Picnic Sail',
    ],
    accent: 'lagoon',
  },
  {
    key: 'wellness',
    label: 'Wellness & Retreats',
    tagline: 'Classes, memberships and retreats with real retention data.',
    icon: 'Sparkles',
    sampleActivities: [
      'Sunrise Beach Yoga',
      'Breathwork & Ice Bath',
      'Coastal Sound Bath',
      'Weekend Reset Retreat',
      'Thermal Spa Circuit',
    ],
    accent: 'reef',
  },
]

const VERTICALS_BY_KEY: Record<VerticalKey, Vertical> = VERTICALS.reduce(
  (acc, vertical) => {
    acc[vertical.key] = vertical
    return acc
  },
  {} as Record<VerticalKey, Vertical>,
)

/**
 * Total by construction — VERTICALS covers every VerticalKey, so callers never
 * have to null-check a category lookup.
 */
export function getVertical(key: VerticalKey): Vertical {
  return VERTICALS_BY_KEY[key]
}

/* ==========================================================================
   NICHES — how a business chooses what it is. Watersports, tours, adventure
   and island operators are one niche, Tours & Activities: the same dashboard,
   with activity kinds (trip, charter, rental, lesson, pass) doing the work
   the separate verticals used to. Tenants keep their vertical key.
   ========================================================================== */

export const ACTIVITY_VERTICALS: VerticalKey[] = ['watersports', 'tours', 'adventure', 'island']

export interface Niche {
  /** The vertical stored when this niche is picked. */
  key: VerticalKey
  label: string
  tagline: string
  icon: string
  sample: string
  members: VerticalKey[]
}

export const NICHES: Niche[] = [
  {
    key: 'watersports',
    label: 'Tours & Activities',
    tagline: 'Trips, charters, rentals, lessons and passes, on water, land or air.',
    icon: 'Compass',
    sample: 'Boat trips, city tours, jet ski rental, surf school, zipline',
    members: ACTIVITY_VERTICALS,
  },
  ...VERTICALS.filter((vertical) => !ACTIVITY_VERTICALS.includes(vertical.key)).map((vertical) => ({
    key: vertical.key,
    label: vertical.label,
    tagline: vertical.tagline,
    icon: vertical.icon,
    sample: vertical.sampleActivities[0] ?? '',
    members: [vertical.key],
  })),
]

/** The niche a vertical belongs to. */
export function nicheOf(vertical: VerticalKey): Niche {
  return NICHES.find((niche) => niche.members.includes(vertical)) ?? NICHES[0]
}
