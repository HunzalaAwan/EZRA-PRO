import type { Activity, ActivityFormat, ActivityKind, ActivityTheme, RentalCategory, RentalConfig, RouteInfo } from '@/types'
import { formatDuration } from '@/lib/utils'
import { privateMostOf, type SpotsSource } from '@/lib/extra-spots'
import { biggestVehicle, serviceOf, transferUnit } from '@/lib/transfers'

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
  icon: 'Route' | 'Zap' | 'Anchor' | 'KeyRound' | 'GraduationCap' | 'Ticket' | 'Layers' | 'Car'
  /** What a single bookable instance is called. */
  unit: string
  units: string
  /** How the storefront sells it. */
  booksBy: string
  /** The schedule format a new activity of this kind starts with. */
  defaultFormat: ActivityFormat
}

export const ACTIVITY_KINDS: ActivityKind[] = ['trip', 'activity', 'charter', 'rental', 'lesson', 'pass', 'package', 'transfer']

/**
 * Group activity, activity and private charter are set up the same way, so
 * the wizard offers them as one "Activity or tour", shared or private.
 * Private saves as a charter (one group per time slot, priced per group).
 */
export const TIMED_KINDS: ActivityKind[] = ['trip', 'activity', 'charter']
export const isTimedKind = (kind: ActivityKind | undefined) => TIMED_KINDS.includes(kind ?? 'trip')

/**
 * A rental with a driver (pickup and drop-off, by the hour, shared seats) is
 * set up under Rental and saves as a 'transfer'; owners and guests see one
 * Rental type, shelf and filter.
 */
export const RENTAL_KINDS: ActivityKind[] = ['rental', 'transfer']
export const isRentalKind = (kind: ActivityKind | undefined) => RENTAL_KINDS.includes(kind ?? 'trip')

/** The kind as one type: an older "activity" reads as an activity or tour (trip), a rental with a driver as a rental. */
export const sharedKindOf = (kind: ActivityKind | undefined): ActivityKind => (kind === 'activity' ? 'trip' : kind === 'transfer' ? 'rental' : (kind ?? 'trip'))

export const ACTIVITY_KIND_META: Record<ActivityKind, ActivityKindMeta> = {
  trip: {
    label: 'Activity or tour',
    short: 'Activity',
    hint: 'Guests join a group at set start times.',
    examples: 'Snorkelling, city walks, ziplines, whale watching',
    icon: 'Route',
    unit: 'time slot',
    units: 'time slots',
    booksBy: 'Guests per time slot',
    defaultFormat: 'departures',
  },
  activity: {
    label: 'Activity or tour',
    short: 'Activity',
    hint: 'Guests book a time and turn up, in small groups or one by one.',
    examples: 'Horse rides, ATV rides, ziplines, parasailing, jet ski rides',
    icon: 'Zap',
    unit: 'time slot',
    units: 'time slots',
    booksBy: 'Guests per time slot',
    defaultFormat: 'open',
  },
  charter: {
    label: 'Private activity',
    short: 'Private',
    hint: 'The whole boat, vehicle, venue or guide for one group.',
    examples: 'Fishing charters, private guiding, yacht hire, private drivers',
    icon: 'Anchor',
    unit: 'charter',
    units: 'charters',
    booksBy: 'One group per time, priced per group',
    defaultFormat: 'departures',
  },
  rental: {
    label: 'Rental',
    short: 'Rental',
    hint: 'Gear, vehicles, or vehicles with a driver.',
    examples: 'Jet skis, cars, e-bikes, kayaks, airport transfers, private drivers',
    icon: 'KeyRound',
    unit: 'time slot',
    units: 'time slots',
    booksBy: 'Units for a chosen length of time',
    defaultFormat: 'open',
  },
  lesson: {
    label: 'Lesson or course',
    short: 'Lesson',
    hint: 'Coached lessons with a level and a student ratio.',
    examples: 'Surf lessons, dive courses, climbing, kitesurf, ski school',
    icon: 'GraduationCap',
    unit: 'class',
    units: 'classes',
    booksBy: 'Spots in a class or course',
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
    examples: 'Combo days, adventure bundles, ride and fly, multi-day bundles',
    icon: 'Layers',
    unit: 'package',
    units: 'packages',
    booksBy: 'A time for each activity inside it',
    defaultFormat: 'departures',
  },
  transfer: {
    label: 'Rental with a driver',
    short: 'Rental',
    hint: 'A vehicle and driver: pickup and drop-off, by the hour or shared seats.',
    examples: 'Airport transfers, private drivers, shuttles',
    icon: 'Car',
    unit: 'ride',
    units: 'rides',
    booksBy: 'A vehicle, or seats, for a ride',
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

/** Day rentals sell by the day; everything else by the length on each tier. */
export const isDayRental = (activity: Pick<Activity, 'kind' | 'rental'>) =>
  (activity.kind ?? 'trip') === 'rental' && (activity.rental?.modes ? activity.rental.modes.length === 1 && activity.rental.modes[0] === 'day' : activity.rental?.billing === 'day')

/** "2 jet skis", "6 guests", "1 vehicle", "4 passengers": what a booking of this kind is counted in. */
export function partyLabel(activity: Pick<Activity, 'kind' | 'rental'>, count: number): string {
  if (activity.kind === 'transfer') return `${count} ${count === 1 ? 'passenger' : 'passengers'}`
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

/** The most guests a private group can be: its most guests and its extra spots (the price engine's `guestLimitOf`). */
const privateMost = (activity: SpotsSource) => privateMostOf(activity)

/** The chip on a storefront card: what it is at a glance. */
export function kindChipLabel(
  activity: Pick<Activity, 'kind' | 'durationMinutes' | 'maxCapacity' | 'rental' | 'charter' | 'lesson' | 'pass' | 'package'> & Partial<Pick<Activity, 'chargeBy' | 'groupPrice' | 'extraSpots' | 'transfer'>>,
): string {
  switch (activity.kind ?? 'trip') {
    case 'transfer': {
      const service = serviceOf(activity)
      if (service === 'shared') return 'Rental · shared seats'
      if (service === 'hourly') return `Rental · driver from ${activity.transfer?.minHours ?? 1}h`
      return 'Rental · with a driver'
    }
    case 'rental': {
      const modes = activity.rental?.modes
      if (modes && modes.length > 1) return 'Rental · by the hour or day'
      if (modes?.[0] === 'hour') return `Rental · from ${activity.rental?.minHours ?? 1}h`
      if (activity.rental?.billing === 'day' || modes?.[0] === 'day') return 'Rental · by the day'
      const shortest = Math.min(...(activity.rental?.durations.map((entry) => entry.minutes) ?? [activity.durationMinutes]))
      return `Rental · from ${formatDuration(shortest)}`
    }
    case 'activity':
      return formatDuration(activity.durationMinutes)
    case 'charter':
      return `Private · up to ${privateMost(activity)}`
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
    case 'transfer':
    case 'rental':
      return 'Rental'
    case 'activity':
      return DIFFICULTY_WORD[activity.difficulty]
    case 'charter':
      return 'Private'
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

/** Two or three short facts for a listing card, in the kind's own terms. Age only when one is set. */
export function kindCardFacts(
  activity: Pick<Activity, 'kind' | 'difficulty' | 'maxCapacity' | 'minAge' | 'rental' | 'charter' | 'lesson' | 'pass' | 'route' | 'package'> &
    Partial<Pick<Activity, 'chargeBy' | 'groupPrice' | 'extraSpots' | 'transfer' | 'priceTiers' | 'schedules' | 'locations'>>,
): string[] {
  const age = activity.minAge > 0 ? [`Ages ${activity.minAge}+`] : []
  switch (activity.kind ?? 'trip') {
    case 'transfer': {
      const service = serviceOf(activity)
      const most = biggestVehicle({ kind: activity.kind, transfer: activity.transfer, priceTiers: activity.priceTiers ?? [] }) || activity.maxCapacity
      if (service === 'shared') return ['Per seat', `${sharedRunsADay(activity)} runs a day`]
      if (service === 'hourly') return [`From ${activity.transfer?.minHours ?? 1} hours`, `Up to ${most} passengers`]
      const code = activity.transfer?.hub?.code?.trim()
      return ['Price per vehicle', `Up to ${most} per vehicle`, ...(code ? [code] : [])]
    }
    case 'activity':
      return [`${activity.maxCapacity} per slot`, activity.route ? routeLabel(activity.route) : DIFFICULTY_WORD[activity.difficulty], ...age]
    case 'rental': {
      const modes = activity.rental?.modes
      const how = modes && modes.length > 1 ? 'Hour or day' : modes?.[0] === 'day' || activity.rental?.billing === 'day' ? 'By the day' : 'By the hour'
      const kinds = activity.rental?.items?.length ?? 0
      return [how, kinds > 1 ? `${kinds} items to choose from` : `Fits ${activity.rental?.seatsPerUnit ?? 1}`, ...age]
    }
    case 'charter':
      return [`Up to ${privateMost(activity)} guests`, 'Private group', ...age]
    case 'lesson':
      return [
        activity.lesson?.ratio ? `${activity.lesson.ratio} per instructor` : `Up to ${activity.maxCapacity} per class`,
        (activity.lesson?.sessions ?? 1) > 1 ? `${activity.lesson?.sessions}-day course` : 'Single lesson',
        ...age,
      ]
    case 'pass':
      return [(activity.pass?.validDays ?? 1) > 1 ? `Valid ${activity.pass?.validDays} days` : 'Valid all day', ...(activity.pass?.reentry ? ['Re-entry allowed'] : []), ...age]
    case 'package':
      return [`${activity.package?.parts.length ?? 2} activities, one booking`, activity.package?.sameDay === false ? `Over ${activity.package.withinDays} days` : 'All on one day', ...age]
    default:
      return [`Up to ${activity.maxCapacity}`, activity.route ? routeLabel(activity.route) : DIFFICULTY_WORD[activity.difficulty], ...age]
  }
}

/** A shared shuttle's runs a day: its run times (either way), else the most start times of its first season, else its base's. */
function sharedRunsADay(activity: Partial<Pick<Activity, 'transfer' | 'schedules' | 'locations'>>): number {
  const shared = activity.transfer?.shared
  if (shared) return new Set([...shared.fromHubTimes, ...shared.toHubTimes]).size
  const season = activity.schedules?.[0]
  if (season?.mode === 'times') return Math.max(0, ...Object.values(season.days ?? {}).map((times) => new Set(times).size))
  return activity.locations?.[0]?.times.length ?? 0
}

/**
 * The "good to know" line on the detail page for kinds that have no difficulty.
 * Says only what the activity sets: an age when there is one, never "All ages".
 * Height and weight limits show in the Requirements section.
 */
export function kindNote(
  activity: Pick<Activity, 'kind' | 'minAge' | 'maxCapacity' | 'rental' | 'charter' | 'lesson' | 'pass' | 'ride' | 'difficulty' | 'package'> & Partial<Pick<Activity, 'transfer'>>,
): { title: string; body: string } | null {
  const age = activity.minAge > 0 ? `Minimum age ${activity.minAge}.` : null
  const join = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' ')
  switch (activity.kind ?? 'trip') {
    case 'transfer': {
      const service = serviceOf(activity)
      if (service === 'shared') return { title: 'Shared shuttle.', body: 'You share the ride with other guests. Be at the meeting point 10 minutes early.' }
      if (service === 'hourly') return { title: 'By the hour.', body: 'The driver is yours for the hours you book. Extra time is charged by the hour.' }
      const config = activity.transfer
      const wait = Math.max(0, config?.freeWaitMinutes ?? 60)
      const waitWords = wait === 60 ? 'an hour' : wait % 60 === 0 ? `${wait / 60} hours` : `${wait} minutes`
      const hub = Boolean(config?.hub?.name?.trim())
      return { title: 'Private.', body: join(['Only your group in the vehicle.', hub && wait > 0 ? `We track your flight and wait ${waitWords} after it lands, free.` : null]) }
    }
    case 'activity':
      return { title: `${DIFFICULTY_WORD[activity.difficulty]}.`, body: join([age, 'Arrive 15 minutes before your time slot.']) }
    case 'rental': {
      const r = activity.rental
      const returnBy = (r?.modes?.includes('day') || r?.billing === 'day') && r?.pickupTime && r?.returnTime ? `Pick up after ${r.pickupTime}, return before ${r.returnTime}.` : 'Bring it back by the end of your rental time.'
      return { title: 'Before you rent.', body: join([age, returnBy]) }
    }
    case 'charter': {
      return { title: 'Private.', body: join(['Only your group on this time slot.', age]) }
    }
    case 'lesson': {
      const level = LESSON_LEVELS.find((entry) => entry.value === activity.lesson?.level)?.label ?? 'All levels'
      const ratio = activity.lesson?.ratio ? `${activity.lesson.ratio} students per instructor` : `Up to ${activity.maxCapacity} students per class`
      return { title: `${level}.`, body: join([`${ratio}${activity.lesson?.equipmentIncluded ? ', all equipment included' : ''}.`, age]) }
    }
    case 'pass': {
      const days = activity.pass?.validDays ?? 1
      return {
        title: days > 1 ? `${days}-day pass.` : 'Day pass.',
        body: join([days > 1 ? `Valid ${days} days from the date you pick.` : 'Valid all day on the date you pick.', activity.pass?.reentry ? 'Come and go as you like.' : null, age]),
      }
    }
    case 'package':
      return { title: 'One booking, every part.', body: join(['Pick a time for each part and we hold your spots on all of them.', age]) }
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
  trip: { label: 'Activities & tours', blurb: 'Pick a time and join the group.' },
  activity: { label: 'Activities & tours', blurb: 'Pick a time and join the group.' },
  charter: { label: 'Private', blurb: 'The time slot is just for your group.' },
  rental: { label: 'Rentals', blurb: 'Take it out yourself, by the hour or the day.' },
  lesson: { label: 'Lessons & courses', blurb: 'Coached, with a level and a small class.' },
  pass: { label: 'Passes & tickets', blurb: 'Entry for the day. Come and go.' },
  package: { label: 'Packages & combos', blurb: 'More than one activity, one booking, a better price.' },
  transfer: { label: 'Rentals', blurb: 'With a driver: pickup and drop-off, or by the hour.' },
}

/** A shelf's heading and line: the Rentals shelf says so when some of it comes with a driver. */
export function storefrontGroup(kind: ActivityKind, items: Pick<Activity, 'kind'>[]): { label: string; blurb: string } {
  if (kind !== 'rental') return STOREFRONT_GROUPS[kind]
  const driven = items.filter((activity) => activity.kind === 'transfer').length
  if (driven === 0) return STOREFRONT_GROUPS.rental
  if (driven === items.length) return STOREFRONT_GROUPS.transfer
  return { label: 'Rentals', blurb: 'Take it out yourself, or with a driver.' }
}

/**
 * "per person", "per bike", "per vehicle a day", "per group". It follows how
 * the activity charges: a private one per group (its own way) or per person,
 * a shared one per person or, with a group price, per group.
 */
export function priceUnit(activity: Pick<Activity, 'kind' | 'rental'> & Partial<Pick<Activity, 'chargeBy' | 'groupPrice' | 'transfer'>>): string {
  const kind = activity.kind ?? 'trip'
  if (kind === 'transfer') return transferUnit(activity)
  if (kind === 'rental') return `per ${rentalCategoryMeta(activity.rental?.category).unit}${activity.rental?.billing === 'day' ? ' a day' : ''}`
  if (kind === 'charter') return activity.chargeBy === 'person' ? 'per person' : 'per group'
  if (activity.chargeBy === 'group' && activity.groupPrice) return 'per group'
  return kind === 'pass' ? 'per ticket' : 'per person'
}

/* ==========================================================================
   CATEGORIES — what the experience is about, in the terms guests search by
   on Viator, GetYourGuide and Google. Separate from the kind (how it is
   sold) and from the business's vertical (which dashboard it gets).
   ========================================================================== */

export const ACTIVITY_THEMES: { value: ActivityTheme; label: string; hint: string }[] = [
  { value: 'water', label: 'Water activities', hint: 'Snorkel, dive, surf, paddle, jet ski' },
  { value: 'boat', label: 'Boats & cruises', hint: 'Sailing, sunset cruises, fishing, island hops' },
  { value: 'wildlife', label: 'Wildlife & nature', hint: 'Whale watching, eco walks, safaris, birding' },
  { value: 'sightseeing', label: 'Sightseeing & city walks', hint: 'Walking, bus, cultural, historical' },
  { value: 'food', label: 'Food & drink', hint: 'Tastings, winery, brewery, markets' },
  { value: 'adventure', label: 'Adventure & outdoors', hint: 'Hiking, climbing, canyoning, zipline, bungee' },
  { value: 'cycling', label: 'Bike & e-bike', hint: 'Guided rides, trails, downhill' },
  { value: 'offroad', label: 'Off-road & motorsport', hint: 'ATV, buggy, jeep safari, 4x4, snowmobile' },
  { value: 'air', label: 'Air & sky', hint: 'Helicopter, skydive, paraglide, balloon, parasail' },
  { value: 'horse', label: 'Horse riding', hint: 'Trail rides, beach rides, ranch days' },
  { value: 'snow', label: 'Snow & mountain', hint: 'Ski, snowboard, snowshoe, dog sled' },
  { value: 'attractions', label: 'Attractions & tickets', hint: 'Parks, beach clubs, museums, aquariums' },
  { value: 'transfers', label: 'Transfers & transport', hint: 'Shuttles, ferries, airport runs' },
]

export const themeLabel = (theme: ActivityTheme) => ACTIVITY_THEMES.find((entry) => entry.value === theme)?.label ?? 'Activities'

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
  if (activity.kind === 'transfer') return 'transfers'
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

/** The category guests see: the business's own one if set, otherwise the built-in theme. */
export const categoryLabel = (activity: Pick<Activity, 'theme' | 'customCategory' | 'slug' | 'kind' | 'rental' | 'category'>) =>
  activity.customCategory?.trim() || themeLabel(themeOf(activity))


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
