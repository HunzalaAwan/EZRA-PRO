import type { Activity, ActivityFormat, ActivityKind, ActivityTheme, CharterConfig, RentalCategory, RentalConfig, RouteInfo } from '@/types'
import { formatDuration } from '@/lib/utils'

/* ==========================================================================
   Activity kinds — what an operator is selling. One niche (Tours &
   Activities) covers boats, tours, adventure and island operators; the kind
   decides the setup fields, the storefront widget and the day-of tools.
   Browser-safe: icons are lucide export names resolved by the caller.
   ========================================================================== */

export interface ActivityKindMeta {
  label: string
  /** Short chip text. */
  short: string
  /** One line for the wizard's picker. */
  hint: string
  examples: string
  icon: 'Route' | 'Zap' | 'Anchor' | 'KeyRound' | 'GraduationCap' | 'Ticket' | 'Layers'
  /** What a single bookable instance is called. */
  unit: string
  units: string
  /** How the storefront sells it. */
  booksBy: string
  /** The schedule format a new activity of this kind starts with. */
  defaultFormat: ActivityFormat
}

export const ACTIVITY_KINDS: ActivityKind[] = ['trip', 'activity', 'charter', 'rental', 'lesson', 'pass', 'package']

export const ACTIVITY_KIND_META: Record<ActivityKind, ActivityKindMeta> = {
  trip: {
    label: 'Scheduled trip',
    short: 'Trip',
    hint: 'Guests join a group at set start times.',
    examples: 'Snorkel trips, city tours, zipline runs, whale watching',
    icon: 'Route',
    unit: 'start time',
    units: 'start times',
    booksBy: 'Guests per start time',
    defaultFormat: 'departures',
  },
  activity: {
    label: 'Activity',
    short: 'Activity',
    hint: 'Guests book a time and turn up, in small groups or one by one.',
    examples: 'Horse rides, ATV rides, ziplines, parasailing, jet ski rides',
    icon: 'Zap',
    unit: 'time',
    units: 'times',
    booksBy: 'Guests per time',
    defaultFormat: 'open',
  },
  charter: {
    label: 'Private charter',
    short: 'Charter',
    hint: 'The whole boat, vehicle, venue or guide for one group.',
    examples: 'Fishing charters, private tours, yacht hire, private guiding',
    icon: 'Anchor',
    unit: 'charter',
    units: 'charters',
    booksBy: 'One group per time, priced per group',
    defaultFormat: 'departures',
  },
  rental: {
    label: 'Rental',
    short: 'Rental',
    hint: 'By the hour, or by the day for cars and multi-day hire.',
    examples: 'Jet skis, cars and jeeps, e-bikes, kayaks, SUPs, gear',
    icon: 'KeyRound',
    unit: 'start time',
    units: 'start times',
    booksBy: 'Units for a chosen length of time',
    defaultFormat: 'open',
  },
  lesson: {
    label: 'Lesson or course',
    short: 'Lesson',
    hint: 'Coached sessions with a level and a student ratio.',
    examples: 'Surf lessons, dive courses, climbing, kitesurf, ski school',
    icon: 'GraduationCap',
    unit: 'class',
    units: 'classes',
    booksBy: 'Places in a class or course',
    defaultFormat: 'departures',
  },
  pass: {
    label: 'Pass or admission',
    short: 'Pass',
    hint: 'Entry for the day, no set start time.',
    examples: 'Park entry, beach club, aqua park, attraction tickets',
    icon: 'Ticket',
    unit: 'day',
    units: 'days',
    booksBy: 'Tickets for a day',
    defaultFormat: 'open',
  },
  package: {
    label: 'Package',
    short: 'Package',
    hint: 'Two or more of your activities sold as one booking.',
    examples: 'Combo days, adventure bundles, ride and fly, multi-day trips',
    icon: 'Layers',
    unit: 'package',
    units: 'packages',
    booksBy: 'A time for each activity inside it',
    defaultFormat: 'departures',
  },
}

export const LESSON_LEVELS = [
  { value: 'all', label: 'All levels' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const

export const RENTAL_LENGTHS = [
  { minutes: 30, label: '30 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 90, label: '90 minutes' },
  { minutes: 120, label: '2 hours' },
  { minutes: 180, label: '3 hours' },
  { minutes: 240, label: 'Half day (4 hours)' },
  { minutes: 480, label: 'Full day (8 hours)' },
] as const

/** What is rented, and what each one needs asked by default. */
export const RENTAL_CATEGORIES: {
  value: RentalCategory
  label: string
  hint: string
  unit: string
  units: string
  licence: NonNullable<RentalConfig['licence']>
  seatsPerUnit: number
  billing: NonNullable<RentalConfig['billing']>
  fuel: boolean
  mileage: boolean
}[] = [
  { value: 'gear', label: 'Equipment', hint: 'Boards, kayaks, tools, cameras, sports gear', unit: 'item', units: 'items', licence: 'none', seatsPerUnit: 1, billing: 'length', fuel: false, mileage: false },
  { value: 'watercraft', label: 'Boats and watercraft', hint: 'Boats, jet skis, pontoons', unit: 'craft', units: 'craft', licence: 'boat', seatsPerUnit: 2, billing: 'length', fuel: true, mileage: false },
  { value: 'vehicle', label: 'Vehicles', hint: 'Cars, scooters, vans, buggies', unit: 'vehicle', units: 'vehicles', licence: 'driver', seatsPerUnit: 5, billing: 'day', fuel: true, mileage: true },
  { value: 'bike', label: 'Bikes', hint: 'Bikes, e-bikes, kick scooters', unit: 'bike', units: 'bikes', licence: 'none', seatsPerUnit: 1, billing: 'length', fuel: false, mileage: false },
  { value: 'space', label: 'Spaces', hint: 'Rooms, desks, courts, lockers, cabanas', unit: 'space', units: 'spaces', licence: 'none', seatsPerUnit: 4, billing: 'length', fuel: false, mileage: false },
]

export const rentalCategoryMeta = (category: RentalCategory | undefined) =>
  RENTAL_CATEGORIES.find((entry) => entry.value === (category ?? 'gear')) ?? RENTAL_CATEGORIES[0]

export const LICENCE_LABEL: Record<NonNullable<RentalConfig['licence']>, string> = {
  none: 'No licence needed',
  driver: "Driver's licence",
  boat: 'Boat licence or boater card',
}

export const FUEL_LABEL: Record<NonNullable<RentalConfig['fuel']>, string> = {
  included: 'Fuel included',
  full_to_full: 'Full to full',
  charged: 'Charged for what you use',
}

export const CHARTER_VESSELS: { value: Exclude<NonNullable<CharterConfig['vessel']>, 'other'>; label: string; crew: string }[] = [
  { value: 'boat', label: 'Boat', crew: 'Captain' },
  { value: 'yacht', label: 'Yacht or catamaran', crew: 'Captain and crew' },
  { value: 'vehicle', label: 'Vehicle', crew: 'Driver' },
  { value: 'guide', label: 'Private guide', crew: 'Guide' },
  { value: 'aircraft', label: 'Helicopter or plane', crew: 'Pilot' },
]

export const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Japanese', 'Mandarin', 'Korean', 'Hawaiian'] as const

/** Day rentals sell by the day; everything else by the length on each tier. */
export const isDayRental = (activity: Pick<Activity, 'kind' | 'rental'>) =>
  (activity.kind ?? 'trip') === 'rental' && (activity.rental?.modes ? activity.rental.modes.length === 1 && activity.rental.modes[0] === 'day' : activity.rental?.billing === 'day')

/** "2 jet skis", "6 guests", "1 vehicle": what a booking of this kind is counted in. */
export function partyLabel(activity: Pick<Activity, 'kind' | 'rental'>, count: number): string {
  if ((activity.kind ?? 'trip') === 'rental') {
    if ((activity.rental?.items?.length ?? 0) > 0) return `${count} ${count === 1 ? 'item' : 'items'}`
    const meta = rentalCategoryMeta(activity.rental?.category)
    return `${count} ${count === 1 ? meta.unit : meta.units}`
  }
  return `${count} ${count === 1 ? 'guest' : 'guests'}`
}

export function rentalLengthLabel(minutes: number): string {
  return RENTAL_LENGTHS.find((option) => option.minutes === minutes)?.label ?? `${minutes} minutes`
}

export function kindOf(activity: { kind?: ActivityKind }): ActivityKind {
  return activity.kind ?? 'trip'
}

/** The chip on a storefront card: what it is at a glance. */
export function kindChipLabel(activity: Pick<Activity, 'kind' | 'durationMinutes' | 'maxCapacity' | 'rental' | 'charter' | 'lesson' | 'pass' | 'package'>): string {
  switch (activity.kind ?? 'trip') {
    case 'rental': {
      const modes = activity.rental?.modes
      if (modes && modes.length > 1) return 'Rental · by the hour or day'
      if (modes?.[0] === 'hour') return `Rental · from ${activity.rental?.minHours ?? 1}h`
      if (activity.rental?.billing === 'day' || modes?.[0] === 'day') return 'Rental · by the day'
      const shortest = Math.min(...(activity.rental?.durations.map((entry) => entry.minutes) ?? [activity.durationMinutes]))
      return `Rental · from ${formatDuration(shortest)}`
    }
    case 'activity':
      return `${formatDuration(activity.durationMinutes)} ride`
    case 'charter':
      return `Private · up to ${activity.charter?.maxGuests ?? activity.maxCapacity}`
    case 'lesson': {
      const sessions = activity.lesson?.sessions ?? 1
      return sessions > 1 ? `${sessions}-day course` : `Lesson · ${formatDuration(activity.durationMinutes)}`
    }
    case 'pass': {
      const days = activity.pass?.validDays ?? 1
      return days > 1 ? `${days}-day pass` : 'Day pass'
    }
    case 'package':
      return `Package · ${activity.package?.parts.length ?? 2} activities`
    default:
      return formatDuration(activity.durationMinutes)
  }
}

const DIFFICULTY_WORD: Record<Activity['difficulty'], string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  challenging: 'Challenging',
  extreme: 'Extreme',
}

/** The badge on a listing: difficulty for a trip, what it is for everything else. */
export function kindBadge(activity: Pick<Activity, 'kind' | 'difficulty' | 'rental' | 'lesson' | 'pass'>): string {
  switch (activity.kind ?? 'trip') {
    case 'rental':
      return 'Rental'
    case 'activity':
      return DIFFICULTY_WORD[activity.difficulty]
    case 'charter':
      return 'Private charter'
    case 'lesson':
      return LESSON_LEVELS.find((entry) => entry.value === activity.lesson?.level)?.label ?? 'Lesson'
    case 'pass':
      return (activity.pass?.validDays ?? 1) > 1 ? `${activity.pass?.validDays}-day pass` : 'Day pass'
    case 'package':
      return 'Package'
    default:
      return DIFFICULTY_WORD[activity.difficulty]
  }
}

/** Two or three short facts for a listing card, in the kind's own terms. */
export function kindCardFacts(activity: Pick<Activity, 'kind' | 'difficulty' | 'maxCapacity' | 'minAge' | 'rental' | 'charter' | 'lesson' | 'pass' | 'route' | 'package'>): string[] {
  const age = activity.minAge > 0 ? `Ages ${activity.minAge}+` : 'All ages'
  switch (activity.kind ?? 'trip') {
    case 'activity':
      return [`${activity.maxCapacity} per slot`, activity.route ? routeLabel(activity.route) : DIFFICULTY_WORD[activity.difficulty], age]
    case 'rental': {
      const meta = rentalCategoryMeta(activity.rental?.category)
      const licence = activity.rental?.licence && activity.rental.licence !== 'none' ? `Licence, ${activity.minAge}+` : age
      const modes = activity.rental?.modes
      const how = modes && modes.length > 1 ? 'Hour or day' : modes?.[0] === 'day' || activity.rental?.billing === 'day' ? 'By the day' : 'By the hour'
      const kinds = activity.rental?.items?.length ?? 0
      return [how, kinds > 1 ? `${kinds} items to choose from` : `Fits ${activity.rental?.seatsPerUnit ?? 1}`, licence]
    }
    case 'charter':
      return [`Up to ${activity.charter?.maxGuests ?? activity.maxCapacity} guests`, activity.charter?.crewed === false ? 'Self-skippered' : 'Crew included', age]
    case 'lesson':
      return [`${activity.lesson?.ratio ?? 4} per instructor`, (activity.lesson?.sessions ?? 1) > 1 ? `${activity.lesson?.sessions} sessions` : 'Single lesson', age]
    case 'pass':
      return [activity.pass?.reentry ? 'Re-entry allowed' : 'Single entry', age]
    case 'package':
      return [`${activity.package?.parts.length ?? 2} activities, one booking`, activity.package?.timing === 'own' ? `Up to ${activity.maxCapacity}, set times` : activity.package?.sameDay === false ? `Over ${activity.package.withinDays} days` : 'All on one day', age]
    default:
      return [`Up to ${activity.maxCapacity}`, activity.route ? routeLabel(activity.route) : DIFFICULTY_WORD[activity.difficulty], age]
  }
}

/** The "good to know" line on the detail page for kinds that have no difficulty. */
export function kindNote(activity: Pick<Activity, 'kind' | 'minAge' | 'rental' | 'charter' | 'lesson' | 'pass' | 'ride' | 'difficulty' | 'package'>): { title: string; body: string } | null {
  const age = activity.minAge > 0 ? `Minimum age ${activity.minAge}.` : 'All ages welcome.'
  switch (activity.kind ?? 'trip') {
    case 'activity': {
      const limits = [
        activity.ride?.minHeightCm ? `Riders at least ${activity.ride.minHeightCm} cm tall.` : null,
        activity.ride?.maxWeightKg ? `Up to ${activity.ride.maxWeightKg} kg per rider.` : null,
      ].filter(Boolean)
      return { title: `${DIFFICULTY_WORD[activity.difficulty]}.`, body: [age, ...limits, 'Arrive 15 minutes before your time slot.'].join(' ') }
    }
    case 'rental': {
      const r = activity.rental
      const meta = rentalCategoryMeta(r?.category)
      const parts = [
        r?.licence && r.licence !== 'none' ? `Bring your ${LICENCE_LABEL[r.licence].toLowerCase()}; the main ${r.licence === 'driver' ? 'driver' : 'operator'} must be ${activity.minAge} or over.` : age,
        (r?.modes?.includes('day') || r?.billing === 'day') && r?.pickupTime && r?.returnTime ? `Pick up after ${r.pickupTime}, return before ${r.returnTime}.` : null,
        meta.fuel && r?.fuel ? `${FUEL_LABEL[r.fuel]}.` : null,
        meta.mileage ? (r?.kmPerDay ? `${r.kmPerDay} km a day included.` : 'Unlimited kilometres.') : null,
      ]
      return { title: "Before you rent.", body: parts.filter(Boolean).join(' ') }
    }
    case 'charter': {
      return {
        title: `Private ${vesselName(activity.charter).toLowerCase()} charter.`,
        body: `${activity.charter?.crewed === false ? 'Self-skippered: you need the right licence.' : `${crewName(activity.charter)} included.`} Only your group aboard. ${age}`,
      }
    }
    case 'lesson': {
      const level = LESSON_LEVELS.find((entry) => entry.value === activity.lesson?.level)?.label ?? 'All levels'
      return { title: `${level}.`, body: `${activity.lesson?.ratio ?? 4} students per instructor${activity.lesson?.equipmentIncluded ? ', all equipment included' : ''}. ${age}` }
    }
    case 'pass':
      return { title: 'Day pass.', body: `${activity.pass?.reentry ? 'Come and go as you like.' : 'Single entry.'} ${age}` }
    case 'package':
      return activity.package?.timing === 'own'
        ? { title: 'One day, run for the package.', body: `Pick a start time; every part follows on at set times, with the same group throughout. ${age}` }
        : { title: 'One booking, every part.', body: `Pick a time for each part and we hold your places on all of them. ${age}` }
    default:
      return null
  }
}

/** "6.5 km · Ranch loop", "12 mi". */
export function routeLabel(route: RouteInfo): string {
  const distance = `${Math.round(route.distance * 10) / 10} ${route.unit}`
  return route.track ? `${distance} · ${route.track}` : distance
}

/** How the storefront groups its catalogue: one shelf per kind, in this order. */
export const STOREFRONT_GROUPS: Record<ActivityKind, { label: string; blurb: string }> = {
  trip: { label: 'Tours & trips', blurb: 'Set departures with a guide or crew.' },
  activity: { label: 'Activities', blurb: 'Pick a time slot and turn up.' },
  charter: { label: 'Private charters', blurb: 'The whole boat or guide, just your group.' },
  rental: { label: 'Rentals', blurb: 'Take it out yourself, by the hour or the day.' },
  lesson: { label: 'Lessons & courses', blurb: 'Coached, with a level and a small class.' },
  pass: { label: 'Passes & tickets', blurb: 'Entry for the day. Come and go.' },
  package: { label: 'Packages & combos', blurb: 'More than one activity, one booking, a better price.' },
}

/** "per person", "per bike", "per vehicle a day", "per group". */
export function priceUnit(activity: Pick<Activity, 'kind' | 'rental'>): string {
  switch (activity.kind ?? 'trip') {
    case 'rental':
      return `per ${rentalCategoryMeta(activity.rental?.category).unit}${activity.rental?.billing === 'day' ? ' a day' : ''}`
    case 'charter':
      return 'per group'
    case 'pass':
      return 'per ticket'
    default:
      return 'per person'
  }
}

/* ==========================================================================
   CATEGORIES — what the experience is about, in the terms guests search by
   on Viator, GetYourGuide and Google. Separate from the kind (how it is
   sold) and from the business's vertical (which dashboard it gets).
   ========================================================================== */

export const ACTIVITY_THEMES: { value: ActivityTheme; label: string; hint: string }[] = [
  { value: 'water', label: 'Water activities', hint: 'Snorkel, dive, surf, paddle, jet ski' },
  { value: 'boat', label: 'Boat trips & cruises', hint: 'Sailing, sunset cruises, fishing, island hops' },
  { value: 'wildlife', label: 'Wildlife & nature', hint: 'Whale watching, eco tours, safaris, birding' },
  { value: 'sightseeing', label: 'Sightseeing & city tours', hint: 'Walking, bus, cultural, historical' },
  { value: 'food', label: 'Food & drink tours', hint: 'Tastings, winery, brewery, market tours' },
  { value: 'adventure', label: 'Adventure & outdoors', hint: 'Hiking, climbing, canyoning, zipline, bungee' },
  { value: 'cycling', label: 'Bike & e-bike', hint: 'Guided rides, trails, downhill' },
  { value: 'offroad', label: 'Off-road & motorsport', hint: 'ATV, buggy, jeep safari, 4x4, snowmobile' },
  { value: 'air', label: 'Air & sky', hint: 'Helicopter, skydive, paraglide, balloon, parasail' },
  { value: 'horse', label: 'Horse riding', hint: 'Trail rides, beach rides, ranch days' },
  { value: 'snow', label: 'Snow & mountain', hint: 'Ski, snowboard, snowshoe, dog sled' },
  { value: 'attractions', label: 'Attractions & tickets', hint: 'Parks, beach clubs, museums, aquariums' },
  { value: 'transfers', label: 'Transfers & transport', hint: 'Shuttles, ferries, airport runs' },
]

export const themeLabel = (theme: ActivityTheme) => ACTIVITY_THEMES.find((entry) => entry.value === theme)?.label ?? 'Tours & activities'

/** The category a new activity starts in, from the business's vertical. */
export function defaultTheme(vertical: string): ActivityTheme {
  if (vertical === 'watersports') return 'water'
  if (vertical === 'island') return 'boat'
  if (vertical === 'adventure') return 'adventure'
  return 'sightseeing'
}

/** An activity's category: the one it was given, or the best guess from what it is. */
export function themeOf(activity: Pick<Activity, 'theme' | 'slug' | 'kind' | 'rental' | 'category'>): ActivityTheme {
  if (activity.theme) return activity.theme
  const slug = activity.slug
  if (activity.kind === 'pass') return 'attractions'
  if (activity.kind === 'rental') {
    const category = activity.rental?.category
    return category === 'vehicle' ? 'offroad' : category === 'bike' ? 'cycling' : 'water'
  }
  if (/horse|ranch/.test(slug)) return 'horse'
  if (/heli|parasail|skydiv|balloon|paraglid/.test(slug)) return 'air'
  if (/whale|manta|turtle|eco|safari-wild|bird/.test(slug)) return 'wildlife'
  if (/e-bike|bike|cycle/.test(slug)) return 'cycling'
  if (/atv|buggy|jeep|4x4|off-road/.test(slug)) return 'offroad'
  if (/food|tasting|wine|brew/.test(slug)) return 'food'
  if (/hike|ascent|climb|canyon|swing|bungee|zip/.test(slug)) return 'adventure'
  if (/charter|cruise|sail|catamaran|crossing|reef-day|liveaboard|fishing/.test(slug)) return 'boat'
  if (/snorkel|dive|surf|sup|kayak|jet|paddle|freedive/.test(slug)) return 'water'
  return defaultTheme(activity.category)
}

/** "Good to know" facts guests filter by. Optional on every activity. */
export const ACCESSIBILITY_OPTIONS = [
  'Wheelchair accessible',
  'Stroller or pram friendly',
  'Infants can sit on laps',
  'Service animals welcome',
  'Near public transport',
  'Not suitable for pregnant travellers',
  'Not suitable with back or neck problems',
] as const

/** The category guests see: the business's own one if set, otherwise the built-in theme. */
export const categoryLabel = (activity: Pick<Activity, 'theme' | 'customCategory' | 'slug' | 'kind' | 'rental' | 'category'>) =>
  activity.customCategory?.trim() || themeLabel(themeOf(activity))

/** What is chartered, in words: a standard vessel or the business's own. */
export function vesselName(charter: Pick<CharterConfig, 'vessel' | 'vesselLabel'> | undefined): string {
  if (charter?.vessel === 'other') return charter.vesselLabel?.trim() || 'Charter'
  return CHARTER_VESSELS.find((entry) => entry.value === charter?.vessel)?.label ?? 'Charter'
}

/** Who comes with it: "Captain", "Driver", or the business's own words. */
export function crewName(charter: Pick<CharterConfig, 'vessel' | 'crewLabel'> | undefined): string {
  if (charter?.vessel === 'other') return charter.crewLabel?.trim() || 'Crew'
  return CHARTER_VESSELS.find((entry) => entry.value === charter?.vessel)?.crew ?? 'Crew'
}

export type RentalMode = 'hour' | 'day' | 'length'

/** How a rental is sold. Empty for an older rental whose tiers are fixed lengths. */
export function rentalModes(activity: Pick<Activity, 'kind' | 'rental'>): RentalMode[] {
  if ((activity.kind ?? 'trip') !== 'rental') return []
  if (activity.rental?.modes && activity.rental.modes.length > 0) return activity.rental.modes
  return activity.rental?.billing === 'day' ? ['day'] : []
}

/** A tier's price per hour or per day; the tier price for an older day rental. */
export function rateFor(activity: Pick<Activity, 'rental' | 'priceTiers'>, tierId: string, mode: RentalMode, lengthId?: string): number | undefined {
  const rate = activity.rental?.rates?.find((entry) => entry.tierId === tierId)
  if (mode === 'length') {
    // Without a length picked yet, the shortest one is the "from" price.
    const id = lengthId ?? activity.rental?.lengths?.[0]?.id
    return id ? rate?.lengths?.[id] : undefined
  }
  if (rate) return mode === 'hour' ? rate.hour : rate.day
  if (mode === 'day' && activity.rental?.billing === 'day') return activity.priceTiers.find((tier) => tier.id === tierId)?.price
  return undefined
}
