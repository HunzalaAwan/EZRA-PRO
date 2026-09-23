import type { Activity, ActivityFormat, ActivityKind, CharterConfig, RentalCategory, RentalConfig, RouteInfo } from '@/types'
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
  icon: 'Route' | 'Zap' | 'Anchor' | 'KeyRound' | 'GraduationCap' | 'Ticket'
  /** What a single bookable instance is called. */
  unit: string
  units: string
  /** How the storefront sells it. */
  booksBy: string
  /** The schedule format a new activity of this kind starts with. */
  defaultFormat: ActivityFormat
}

export const ACTIVITY_KINDS: ActivityKind[] = ['trip', 'activity', 'charter', 'rental', 'lesson', 'pass']

export const ACTIVITY_KIND_META: Record<ActivityKind, ActivityKindMeta> = {
  trip: {
    label: 'Scheduled trip',
    short: 'Trip',
    hint: 'Seats on a departure at set times.',
    examples: 'Snorkel trips, city tours, zipline runs, whale watching',
    icon: 'Route',
    unit: 'departure',
    units: 'departures',
    booksBy: 'Seats per departure',
    defaultFormat: 'departures',
  },
  activity: {
    label: 'Activity',
    short: 'Activity',
    hint: 'Guests book a time slot and turn up. No departure.',
    examples: 'Horse rides, ATV rides, ziplines, parasailing, jet ski rides',
    icon: 'Zap',
    unit: 'time slot',
    units: 'time slots',
    booksBy: 'Places in a time slot',
    defaultFormat: 'open',
  },
  charter: {
    label: 'Private charter',
    short: 'Charter',
    hint: 'The whole boat, vehicle or guide for one group.',
    examples: 'Fishing charters, private tours, yacht hire, private guiding',
    icon: 'Anchor',
    unit: 'charter',
    units: 'charters',
    booksBy: 'One group per departure, priced per group',
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
  { value: 'watercraft', label: 'Watercraft', hint: 'Jet skis, boats, pontoons', unit: 'craft', units: 'craft', licence: 'boat', seatsPerUnit: 2, billing: 'length', fuel: true, mileage: false },
  { value: 'vehicle', label: 'Vehicle', hint: 'Cars, jeeps, scooters, ATVs', unit: 'vehicle', units: 'vehicles', licence: 'driver', seatsPerUnit: 5, billing: 'day', fuel: true, mileage: true },
  { value: 'bike', label: 'Bike or e-bike', hint: 'Road, mountain, e-bikes', unit: 'bike', units: 'bikes', licence: 'none', seatsPerUnit: 1, billing: 'length', fuel: false, mileage: false },
  { value: 'gear', label: 'Gear', hint: 'Kayaks, SUPs, surfboards, snorkel sets', unit: 'item', units: 'items', licence: 'none', seatsPerUnit: 1, billing: 'length', fuel: false, mileage: false },
]

export const rentalCategoryMeta = (category: RentalCategory | undefined) =>
  RENTAL_CATEGORIES.find((entry) => entry.value === (category ?? 'gear')) ?? RENTAL_CATEGORIES[3]

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

export const CHARTER_VESSELS: { value: NonNullable<CharterConfig['vessel']>; label: string; crew: string }[] = [
  { value: 'boat', label: 'Boat', crew: 'Captain' },
  { value: 'yacht', label: 'Yacht or catamaran', crew: 'Captain and crew' },
  { value: 'vehicle', label: 'Vehicle', crew: 'Driver' },
  { value: 'guide', label: 'Private guide', crew: 'Guide' },
  { value: 'aircraft', label: 'Helicopter or plane', crew: 'Pilot' },
]

export const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Japanese', 'Mandarin', 'Korean', 'Hawaiian'] as const

/** Day rentals sell by the day; everything else by the length on each tier. */
export const isDayRental = (activity: Pick<Activity, 'kind' | 'rental'>) =>
  (activity.kind ?? 'trip') === 'rental' && activity.rental?.billing === 'day'

/** "2 jet skis", "6 guests", "1 vehicle": what a booking of this kind is counted in. */
export function partyLabel(activity: Pick<Activity, 'kind' | 'rental'>, count: number): string {
  if ((activity.kind ?? 'trip') === 'rental') {
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
export function kindChipLabel(activity: Pick<Activity, 'kind' | 'durationMinutes' | 'maxCapacity' | 'rental' | 'charter' | 'lesson' | 'pass'>): string {
  switch (activity.kind ?? 'trip') {
    case 'rental': {
      if (activity.rental?.billing === 'day') return 'Rental · by the day'
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
      return `${rentalCategoryMeta(activity.rental?.category).label} rental`
    case 'activity':
      return DIFFICULTY_WORD[activity.difficulty]
    case 'charter':
      return 'Private charter'
    case 'lesson':
      return LESSON_LEVELS.find((entry) => entry.value === activity.lesson?.level)?.label ?? 'Lesson'
    case 'pass':
      return (activity.pass?.validDays ?? 1) > 1 ? `${activity.pass?.validDays}-day pass` : 'Day pass'
    default:
      return DIFFICULTY_WORD[activity.difficulty]
  }
}

/** Two or three short facts for a listing card, in the kind's own terms. */
export function kindCardFacts(activity: Pick<Activity, 'kind' | 'difficulty' | 'maxCapacity' | 'minAge' | 'rental' | 'charter' | 'lesson' | 'pass' | 'route'>): string[] {
  const age = activity.minAge > 0 ? `Ages ${activity.minAge}+` : 'All ages'
  switch (activity.kind ?? 'trip') {
    case 'activity':
      return [`${activity.maxCapacity} per slot`, activity.route ? routeLabel(activity.route) : DIFFICULTY_WORD[activity.difficulty], age]
    case 'rental': {
      const meta = rentalCategoryMeta(activity.rental?.category)
      const licence = activity.rental?.licence && activity.rental.licence !== 'none' ? `Licence, ${activity.minAge}+` : age
      return [activity.rental?.billing === 'day' ? 'By the day' : 'By the hour', `${activity.rental?.seatsPerUnit ?? 1} per ${meta.unit}`, licence]
    }
    case 'charter':
      return [`Up to ${activity.charter?.maxGuests ?? activity.maxCapacity} guests`, activity.charter?.crewed === false ? 'Self-skippered' : 'Crew included', age]
    case 'lesson':
      return [`${activity.lesson?.ratio ?? 4} per instructor`, (activity.lesson?.sessions ?? 1) > 1 ? `${activity.lesson?.sessions} sessions` : 'Single lesson', age]
    case 'pass':
      return [activity.pass?.reentry ? 'Re-entry allowed' : 'Single entry', age]
    default:
      return [`Up to ${activity.maxCapacity}`, activity.route ? routeLabel(activity.route) : DIFFICULTY_WORD[activity.difficulty], age]
  }
}

/** The "good to know" line on the detail page for kinds that have no difficulty. */
export function kindNote(activity: Pick<Activity, 'kind' | 'minAge' | 'rental' | 'charter' | 'lesson' | 'pass' | 'ride' | 'difficulty'>): { title: string; body: string } | null {
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
        r?.billing === 'day' && r.pickupTime && r.returnTime ? `Pick up from ${r.pickupTime}, return by ${r.returnTime} on your last day.` : null,
        meta.fuel && r?.fuel ? `${FUEL_LABEL[r.fuel]}.` : null,
        meta.mileage ? (r?.kmPerDay ? `${r.kmPerDay} km a day included.` : 'Unlimited kilometres.') : null,
      ]
      return { title: `${meta.label} rental.`, body: parts.filter(Boolean).join(' ') }
    }
    case 'charter': {
      const vessel = CHARTER_VESSELS.find((entry) => entry.value === activity.charter?.vessel)
      return {
        title: 'Private charter.',
        body: `${activity.charter?.crewed === false ? 'Self-skippered: you need the right licence.' : `${vessel?.crew ?? 'Crew'} included.`} Only your group aboard. ${age}`,
      }
    }
    case 'lesson': {
      const level = LESSON_LEVELS.find((entry) => entry.value === activity.lesson?.level)?.label ?? 'All levels'
      return { title: `${level}.`, body: `${activity.lesson?.ratio ?? 4} students per instructor${activity.lesson?.equipmentIncluded ? ', all equipment included' : ''}. ${age}` }
    }
    case 'pass':
      return { title: 'Day pass.', body: `${activity.pass?.reentry ? 'Come and go as you like.' : 'Single entry.'} ${age}` }
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
