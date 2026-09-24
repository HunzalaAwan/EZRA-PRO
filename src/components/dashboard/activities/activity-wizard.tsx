'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarClock,
  Check,
  CircleAlert,
  Compass,
  DoorOpen,
  FileText,
  Gauge,
  Images,
  MapPin,
  Mountain,
  Plus,
  Rocket,
  RotateCcw,
  Route,
  Save,
  Sparkles,
  Star,
  Tag,
  Timer,
  TriangleAlert,
  Trash2,
  Users,
  UtensilsCrossed,
  Waves,
} from 'lucide-react'
import { z } from 'zod'

import type { Activity, ActivityKind, ActivityTheme, CurrencyCode, DifficultyLevel, GuestQuestion, Location, VerticalKey } from '@/types'
import { saveActivityOverride } from '@/lib/activity-overrides'
import {
  cn,
  formatCurrency,
  formatDuration,
  pluralize,
  slugify,
} from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Field } from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import { MediaManager, type DraftMedia } from './media-manager'
import {
  GuestPricePreview,
  PricingTierEditor,
  blankTier,
  type DraftTier,
} from './pricing-tier-editor'
import { AddonEditor, type DraftAddOn } from './addon-editor'
import { KindFields, KindPicker, LanguagePicker, RentalRatesEditor, RouteFields, defaultKindSettings, emptyRoute, normalizeKindSettings, type DraftKindSettings, type DraftRoute, type SharedBasics } from './kind-fields'
import { DurationField, DURATION_UNITS, unitFor, type DurationUnit } from './duration-field'
import { useCustomCategories } from '@/hooks/use-custom-categories'
import { GuestQuestionsEditor, type WaiverOption } from './guest-questions-editor'
import { PickupEditor, type DraftPickup, type PickupZoneOption } from './pickup-editor'
import {
  ACCESSIBILITY_OPTIONS,
  ACTIVITY_KIND_META,
  ACTIVITY_THEMES,
  crewName,
  vesselName,
  FUEL_LABEL,
  LESSON_LEVELS,
  LICENCE_LABEL,
  defaultTheme,
  rentalCategoryMeta,
  themeLabel,
  themeOf,
} from '@/lib/activity-kinds'
import {
  LocationsEditor,
  ScheduleEditor,
  defaultSchedule,
  describeSchedule,
  formatClock,
  previewDepartures,
  type DraftLocation,
  type DraftSchedule,
  type ScheduleSeats,
} from './schedule-editor'
import {
  BOOKING_MODE_OPTIONS,
  CHILDREN_OPTIONS,
  DINING_ADDON_PRESETS,
  DINING_BASICS,
  DINING_TIER_PRESETS,
  DRESS_OPTIONS,
  DiningBasicsFields,
  DiningBookingFields,
  DiningDietaryFields,
  DiningServiceEditor,
  FORMAT_OPTIONS,
  defaultDining,
  formatLabel,
  serviceStartTimes,
  type DiningDraft,
} from './dining-fields'

/* ==========================================================================
   DRAFT MODEL
   One object holds the whole wizard. It is mirrored into sessionStorage so a
   refresh — or a detour to check a competitor's price — never loses the work.
   ========================================================================== */

/** Where guests go: a guide meets them, they come to a venue, or there is no fixed place. */
export type ArrivalMode = 'meet' | 'venue' | 'pickup'

export const ARRIVAL_OPTIONS: { value: ArrivalMode; label: string; description: string; icon: typeof MapPin }[] = [
  { value: 'meet', label: 'Meeting point', description: 'A guide or skipper meets guests at a set place.', icon: MapPin },
  { value: 'venue', label: 'Guests come to you', description: 'They arrive at your shop, ranch, park or rental desk during opening hours.', icon: DoorOpen },
  { value: 'pickup', label: 'Pick up', description: 'You collect guests from their hotel or a stop. Set the zones and prices below.', icon: Route },
]

const defaultArrival = (category: VerticalKey): ArrivalMode =>
  category === 'restaurants' || category === 'wellness' ? 'venue' : 'meet'

export { DURATION_UNITS, type DurationUnit }

/** A crew member the operator can put on the activity by default. */
export interface WizardCrewMember {
  id: string
  name: string
  title: string
  avatarUrl: string
}

export interface ActivityDraft {
  name: string
  tagline: string
  category: VerticalKey
  difficulty: DifficultyLevel
  /** 0 = flexible. */
  durationMinutes: number
  /** How the duration is typed; the value is always stored in minutes. */
  durationUnit: DurationUnit
  minAge: number
  /** 0 = no seat limit. */
  maxCapacity: number
  minParticipants: number
  description: string
  highlights: string[]
  included: string[]
  excluded: string[]
  requirements: string[]
  /** Required text only when arrivalMode is meet or venue. */
  meetingPoint: string
  arrivalMode: ArrivalMode
  media: DraftMedia[]
  tiers: DraftTier[]
  addOns: DraftAddOn[]
  schedule: DraftSchedule
  featured: boolean
  freeCancellationHours: number
  /** Crew assigned to every departure by default. */
  crewIds: string[]
  /** Restaurant settings; only read while the category is Dining. */
  dining: DiningDraft
  /** What is sold: trip, charter, rental, lesson or pass. Ignored for Dining. */
  kind: ActivityKind
  kindSettings: DraftKindSettings
  /** Asked at checkout. */
  guestQuestions: GuestQuestion[]
  waiverId: string | null
  pickup: DraftPickup
  /** Languages the guide or instructor speaks. */
  languages: string[]
  /** Optional distance or track, for trips and activities. */
  route: DraftRoute
  /** The storefront category. */
  theme: ActivityTheme
  /** A category the business made itself; wins over the theme when set. */
  customCategory: string | null
  /** Accessibility and suitability facts. */
  accessibility: string[]
  /** What guests should bring. */
  bring: string[]
}

const STORAGE_KEY = 'ezra:activity-wizard:v8'

/** Dining is the one category whose product is a table, not a departure. */
export const isDining = (draft: Pick<ActivityDraft, 'category'>) => draft.category === 'restaurants'

/** Generic defaults the operator has not touched can be swapped when the category changes. */
const TOUR_BASICS = { durationMinutes: 0, maxCapacity: 0, minAge: 8 } as const

export function createDefaultDraft(category: VerticalKey, nowIso: string): ActivityDraft {
  const dining = defaultDining()
  const restaurant = category === 'restaurants'
  const schedule = defaultSchedule(nowIso)
  return {
    name: '',
    tagline: '',
    category,
    difficulty: 'easy',
    durationMinutes: restaurant ? DINING_BASICS.durationMinutes : TOUR_BASICS.durationMinutes,
    durationUnit: restaurant ? 'minutes' : 'hours',
    minAge: restaurant ? DINING_BASICS.minAge : TOUR_BASICS.minAge,
    maxCapacity: restaurant ? DINING_BASICS.maxCapacity : TOUR_BASICS.maxCapacity,
    minParticipants: 1,
    description: '',
    highlights: [''],
    included: [''],
    excluded: [],
    requirements: [],
    meetingPoint: '',
    arrivalMode: defaultArrival(category),
    media: [],
    tiers: [restaurant ? blankTier('Tasting menu', 8500) : blankTier('Adult', 14900)],
    addOns: [],
    schedule: restaurant
      ? { ...schedule, startTimes: serviceStartTimes(dining.services), capacity: DINING_BASICS.maxCapacity }
      : schedule,
    featured: false,
    kind: 'trip',
    kindSettings: defaultKindSettings(),
    guestQuestions: [],
    waiverId: null,
    pickup: { enabled: false, zoneIds: [], required: false },
    languages: ['English'],
    route: emptyRoute(),
    theme: defaultTheme(category),
    customCategory: null,
    accessibility: [],
    bring: [],
    freeCancellationHours: 24,
    crewIds: [],
    dining,
  }
}

/** The editor, filled in from an activity that already exists. */
/** The kind-specific settings an edit saves, shaped like the domain model. */
function kindOverride(draft: ActivityDraft) {
  const kind = draft.kind ?? 'trip'
  const settings = normalizeKindSettings(draft.kindSettings)
  if (kind === 'rental') {
    const r = settings.rental
    const meta = rentalCategoryMeta(r.category)
    const hourly = r.modes.includes('hour')
    const daily = r.modes.includes('day')
    const rate = (tierId: string) => r.rates[tierId] ?? { hour: 0, day: 0 }
    // With one location the opening hours are the pick-up and return window; several locations use the first.
    const hours = draft.schedule.locations.length > 1 ? (draft.schedule.locations[0]?.schedule ?? draft.schedule) : draft.schedule
    return {
      rental: {
        category: r.category,
        modes: r.modes,
        billing: daily && !hourly ? ('day' as const) : ('length' as const),
        units: r.units,
        bufferMinutes: r.bufferMinutes,
        damageDeposit: r.damageDeposit,
        durations: draft.tiers.map((tier) => ({ tierId: tier.id, minutes: hourly ? r.minHours * 60 : 1440 })),
        rates: draft.tiers.map((tier) => ({ tierId: tier.id, ...(hourly ? { hour: rate(tier.id).hour } : {}), ...(daily ? { day: rate(tier.id).day } : {}) })),
        seatsPerUnit: r.seatsPerUnit,
        licence: r.licence,
        ...(meta.fuel ? { fuel: r.fuel } : {}),
        ...(meta.mileage ? { kmPerDay: r.kmPerDay } : {}),
        ...(hourly ? { minHours: r.minHours, maxHours: r.maxHours } : {}),
        ...(daily ? { minDays: r.minDays, maxDays: r.maxDays } : {}),
        pickupTime: hours.opensAt,
        returnTime: hours.closesAt,
      },
    }
  }
  if (kind === 'charter') {
    const { minutes: _minutes, vesselLabel, crewLabel, ...rest } = settings.charter
    return {
      charter: {
        ...rest,
        ...(rest.vessel === 'other' ? { vesselLabel: vesselLabel.trim() || 'Charter', crewLabel: crewLabel.trim() || 'Crew' } : {}),
      },
    }
  }
  if (kind === 'lesson') {
    const { certification, ...rest } = settings.lesson
    return { lesson: { ...rest, ...(certification.trim() ? { certification: certification.trim() } : {}) } }
  }
  if (kind === 'pass') return { pass: { ...settings.pass } }
  if (kind === 'activity') {
    const { minHeightCm, maxWeightKg } = settings.activity
    return { ride: { ...(minHeightCm > 0 ? { minHeightCm } : {}), ...(maxWeightKg > 0 ? { maxWeightKg } : {}) } }
  }
  return {}
}

/** The route an edit saves; null when the operator switched it off or the kind has none. */
function routeOverride(draft: ActivityDraft) {
  const kind = draft.kind ?? 'trip'
  const route = draft.route ?? emptyRoute()
  if ((kind !== 'trip' && kind !== 'activity') || !route.enabled || route.distance <= 0) return null
  return {
    distance: route.distance,
    unit: route.unit,
    ...(route.track.trim() ? { track: route.track.trim() } : {}),
    ...(route.elevationM > 0 ? { elevationM: route.elevationM } : {}),
  }
}

const LEVEL_DIFFICULTY: Record<DraftKindSettings['lesson']['level'], DifficultyLevel> = {
  all: 'easy',
  beginner: 'easy',
  intermediate: 'moderate',
  advanced: 'challenging',
}

/** For a rental, how the opening hours read in Schedule: pick-up and return, and whether start times matter. */
function rentalHoursFor(draft: ActivityDraft): { hourly: boolean; daily: boolean } | undefined {
  if (isDining(draft) || (draft.kind ?? 'trip') !== 'rental') return undefined
  const modes = normalizeKindSettings(draft.kindSettings).rental.modes
  return { hourly: modes.includes('hour'), daily: modes.includes('day') }
}

/** What one departure, day or date sells, in the kind's own words. Set once, in Basics. */
export function seatsFor(draft: ActivityDraft): ScheduleSeats {
  const kind = draft.kind ?? 'trip'
  const settings = normalizeKindSettings(draft.kindSettings)
  const n = draft.maxCapacity
  if (kind === 'rental') {
    const meta = rentalCategoryMeta(settings.rental.category)
    const units = settings.rental.units
    return { capacity: units, one: meta.unit, many: meta.units, summary: `${units} ${units === 1 ? meta.unit : meta.units} at a time` }
  }
  if (kind === 'charter') {
    return { capacity: 1, one: 'charter', many: 'charters', summary: `One group each, up to ${settings.charter.maxGuests} guests` }
  }
  if (kind === 'lesson') return { capacity: n, one: 'place', many: 'places', summary: `${n} ${pluralize(n, 'student')} per class` }
  if (kind === 'pass') return { capacity: n, one: 'ticket', many: 'tickets', summary: n > 0 ? `${n} tickets per day` : 'No ticket limit' }
  if (kind === 'activity') return { capacity: n, one: 'place', many: 'places', summary: `${n} ${pluralize(n, 'rider')} per time slot` }
  return { capacity: n, one: 'seat', many: 'seats', summary: n > 0 ? `${n} seats per departure` : 'No seat limit' }
}

/**
 * Keeps the numbers every activity carries in step with the kind's own
 * settings: a rental's capacity is its fleet, a charter's is its group,
 * a lesson's difficulty is its level. The schedule reads the result.
 */
export function deriveForKind(draft: ActivityDraft): ActivityDraft {
  if (isDining(draft)) return draft
  const kind = draft.kind ?? 'trip'
  const settings = normalizeKindSettings(draft.kindSettings)
  const next: ActivityDraft = { ...draft, kindSettings: settings, languages: draft.languages ?? [] }
  // Drafts saved before Pick up replaced No fixed place.
  if ((next.arrivalMode as string) === 'none') next.arrivalMode = 'pickup'
  if (kind === 'rental') {
    const r = settings.rental
    const hourly = r.modes.includes('hour')
    next.maxCapacity = r.units
    next.minParticipants = 1
    next.difficulty = 'easy'
    next.durationMinutes = hourly ? r.minHours * 60 : 1440
    // A rental's tiers are what can be rented; the headline price is the hourly rate, or the daily one.
    next.tiers = draft.tiers.map((tier) => {
      const rate = r.rates[tier.id]
      if (!rate) return tier
      const price = hourly ? rate.hour : rate.day
      return price === tier.price ? tier : { ...tier, price, minQuantity: 0 }
    })
    // Hourly: the last start leaves room for the fewest hours before the return time.
    const last = hourly ? r.minHours * 60 : 0
    if (next.schedule.lastEntryMinutes !== last) {
      next.schedule = { ...next.schedule, lastEntryMinutes: last, locations: next.schedule.locations.map((site) => ({ ...site, schedule: { ...site.schedule, lastEntryMinutes: last } })) }
    }
  } else if (kind === 'charter') {
    next.maxCapacity = settings.charter.maxGuests
    next.difficulty = 'easy'
    if (next.minParticipants > next.maxCapacity) next.minParticipants = next.maxCapacity
  } else if (kind === 'lesson') {
    next.difficulty = LEVEL_DIFFICULTY[settings.lesson.level]
  } else if (kind === 'pass') {
    next.difficulty = 'easy'
    next.minParticipants = 1
  } else if (kind === 'activity') {
    next.minParticipants = 1
  }
  next.route = draft.route ?? emptyRoute()
  const capacity = seatsFor(next).capacity
  const stale = next.schedule.capacity !== capacity || next.schedule.locations.some((site) => site.schedule.capacity !== capacity)
  if (stale) {
    next.schedule = {
      ...next.schedule,
      capacity,
      locations: next.schedule.locations.map((site) => ({ ...site, schedule: { ...site.schedule, capacity } })),
    }
  }
  return next
}

/** A draft that has not picked a location yet starts on the business's default one. */
export function withHomeLocation(draft: ActivityDraft, locations: Location[]): ActivityDraft {
  const current = draft.schedule.locations ?? []
  if (current.length > 0 || locations.length === 0) return draft
  const home = locations.find((site) => site.isDefault) ?? locations[0]
  return { ...draft, schedule: { ...draft.schedule, locations: [{ locationId: home.id, schedule: { ...draft.schedule, locations: [] } }] } }
}

/** The activity's rule, with each location's own days and times laid over it. */
function scheduleFromActivity(activity: Activity, base: DraftSchedule, homeTimes: string[]): DraftSchedule {
  const shared: DraftSchedule = {
    ...base,
    mode: activity.format === 'open' ? 'hours' : activity.format === 'dates' ? 'dates' : 'times',
    capacity: activity.maxCapacity,
    startTimes: homeTimes.length > 0 ? homeTimes : base.startTimes,
    weekdays: activity.locations[0]?.weekdays ?? base.weekdays,
    locations: [],
  }
  const sites: DraftLocation[] = activity.locations.map((site) => ({
    locationId: site.locationId,
    schedule: {
      ...shared,
      startTimes: site.times.length > 0 ? site.times : shared.startTimes,
      weekdays: site.weekdays ?? shared.weekdays,
    },
  }))
  return { ...shared, locations: sites }
}

export function draftFromActivity(activity: Activity, nowIso: string): ActivityDraft {
  const base = createDefaultDraft(activity.category, nowIso)
  const restaurant = activity.category === 'restaurants'
  const homeTimes = activity.locations[0]?.times ?? []
  return {
    ...base,
    name: activity.name,
    tagline: activity.tagline,
    difficulty: activity.difficulty,
    durationMinutes: activity.durationMinutes,
    durationUnit: unitFor(activity.durationMinutes),
    minAge: activity.minAge,
    maxCapacity: activity.maxCapacity,
    minParticipants: activity.minParticipants || 1,
    description: activity.description,
    highlights: activity.highlights.length > 0 ? [...activity.highlights] : [''],
    included: activity.included.length > 0 ? [...activity.included] : [''],
    excluded: [...activity.excluded],
    requirements: [...activity.requirements],
    meetingPoint: activity.meetingPoint,
    arrivalMode: activity.pickup?.required ? 'pickup' : restaurant || activity.category === 'wellness' ? 'venue' : 'meet',
    media: activity.media.map((item) => ({ id: item.id, url: item.url, alt: item.alt, isPrimary: item.isPrimary })),
    tiers: activity.priceTiers.map((tier) => ({
      id: tier.id,
      label: tier.label,
      price: tier.price,
      compareAtPrice: tier.compareAtPrice ?? null,
      minQuantity: tier.minQuantity,
      maxQuantity: tier.maxQuantity,
      description: tier.description ?? '',
      countsTowardCapacity: tier.countsTowardCapacity,
    })),
    addOns: activity.addOns.map((addOn) => ({
      id: addOn.id,
      label: addOn.label,
      price: addOn.price,
      description: addOn.description,
      maxPerBooking: addOn.maxPerBooking,
      required: addOn.required,
    })),
    schedule: scheduleFromActivity(activity, base.schedule, homeTimes),
    featured: activity.featured,
    freeCancellationHours: activity.cancellationPolicy.freeCancellationHours,
    kind: activity.kind ?? 'trip',
    guestQuestions: (activity.guestQuestions ?? []).map((question) => ({ ...question })),
    waiverId: activity.waiverId ?? null,
    pickup: activity.pickup
      ? { enabled: true, zoneIds: [...activity.pickup.zoneIds], required: activity.pickup.required, prices: { ...activity.pickup.prices } }
      : { enabled: false, zoneIds: [], required: false },
    languages: [...(activity.languages ?? ['English'])],
    theme: themeOf(activity),
    customCategory: activity.customCategory ?? null,
    accessibility: [...(activity.accessibility ?? [])],
    bring: [...(activity.bring ?? [])],
    route: activity.route
      ? { enabled: true, distance: activity.route.distance, unit: activity.route.unit, track: activity.route.track ?? '', elevationM: activity.route.elevationM ?? 0 }
      : emptyRoute(),
    kindSettings: (() => {
      const blank = defaultKindSettings()
      const rental = activity.rental
      const charter = activity.charter
      return {
        rental: rental
          ? (() => {
              const { durations, rates, modes, ...rest } = rental
              return {
                ...blank.rental,
                ...rest,
                minutes: Object.fromEntries(durations.map((entry) => [entry.tierId, entry.minutes])),
                modes: modes && modes.length > 0 ? [...modes] : rental.billing === 'day' ? ['day' as const] : ['hour' as const],
                rates: Object.fromEntries(
                  activity.priceTiers.map((tier) => {
                    const rate = rates?.find((entry) => entry.tierId === tier.id)
                    return [tier.id, { hour: rate?.hour ?? (rental.billing === 'day' ? 0 : tier.price), day: rate?.day ?? (rental.billing === 'day' ? tier.price : tier.price * 4) }]
                  }),
                ),
              }
            })()
          : blank.rental,
        charter: charter
          ? (() => {
              const { durations, ...rest } = charter
              const fallback = Object.fromEntries(activity.priceTiers.map((tier) => [tier.id, activity.durationMinutes || 180]))
              return { ...blank.charter, ...rest, minutes: durations ? Object.fromEntries(durations.map((entry) => [entry.tierId, entry.minutes])) : fallback }
            })()
          : { ...blank.charter, maxGuests: activity.maxCapacity },
        lesson: activity.lesson ? { ...blank.lesson, ...activity.lesson, certification: activity.lesson.certification ?? '' } : blank.lesson,
        pass: activity.pass ? { ...blank.pass, ...activity.pass } : blank.pass,
        activity: { minHeightCm: activity.ride?.minHeightCm ?? 0, maxWeightKg: activity.ride?.maxWeightKg ?? 0 },
      }
    })(),
  }
}

/**
 * Switching category re-seeds the numbers a tour and a restaurant disagree
 * on, but only where the operator has left the defaults alone.
 */
export function withCategory(draft: ActivityDraft, category: VerticalKey): ActivityDraft {
  const wasDining = isDining(draft)
  const willBeDining = category === 'restaurants'
  if (wasDining === willBeDining) return { ...draft, category }

  const from = wasDining ? DINING_BASICS : TOUR_BASICS
  const to = willBeDining ? DINING_BASICS : TOUR_BASICS
  const untouched =
    draft.durationMinutes === from.durationMinutes && draft.maxCapacity === from.maxCapacity && draft.minAge === from.minAge

  const next: ActivityDraft = { ...draft, category }
  if (untouched) Object.assign(next, to)
  if (willBeDining) {
    next.schedule = {
      ...draft.schedule,
      startTimes: serviceStartTimes(draft.dining.services),
      capacity: untouched ? DINING_BASICS.maxCapacity : draft.schedule.capacity,
    }
    if (draft.tiers.length === 1 && draft.tiers[0].label === 'Adult' && draft.tiers[0].price === 14900) {
      next.tiers = [blankTier('Tasting menu', 8500)]
    }
  } else if (draft.tiers.length === 1 && draft.tiers[0].label === 'Tasting menu' && draft.tiers[0].price === 8500) {
    next.tiers = [blankTier('Adult', 14900)]
  }
  return next
}

const CATEGORY_OPTIONS: { value: VerticalKey; label: string; hint: string }[] = [
  { value: 'watersports', label: 'Watersports', hint: 'Snorkel, dive, surf, paddle' },
  { value: 'tours', label: 'Tours', hint: 'Sightseeing, culture, food' },
  { value: 'island', label: 'Island & boat', hint: 'Day trips, charters, transfers' },
  { value: 'adventure', label: 'Adventure', hint: 'Hike, bike, climb, ride' },
  { value: 'restaurants', label: 'Dining', hint: 'Tastings, chef tables, seatings' },
  { value: 'wellness', label: 'Wellness', hint: 'Retreats, spa, yoga' },
]

const DIFFICULTY_OPTIONS: {
  value: DifficultyLevel
  label: string
  description: string
  icon: React.ReactNode
}[] = [
  {
    value: 'easy',
    label: 'Easy',
    description: 'Anyone can join. No experience needed.',
    icon: <Waves />,
  },
  {
    value: 'moderate',
    label: 'Moderate',
    description: 'Reasonable fitness, some balance required.',
    icon: <Gauge />,
  },
  {
    value: 'challenging',
    label: 'Challenging',
    description: 'Good fitness and prior experience expected.',
    icon: <Mountain />,
  },
  {
    value: 'extreme',
    label: 'Extreme',
    description: 'Certification or a briefing is mandatory.',
    icon: <TriangleAlert />,
  },
]

/* ==========================================================================
   STEPS + VALIDATION
   ========================================================================== */

const TOUR_STEPS = [
  { id: 'basics', label: 'Basics', hint: 'What you sell and its setup', icon: Compass },
  { id: 'description', label: 'Description', hint: 'The copy guests read', icon: FileText },
  { id: 'media', label: 'Media', hint: 'Photography', icon: Images },
  { id: 'pricing', label: 'Pricing', hint: 'Tiers and add-ons', icon: Tag },
  { id: 'schedule', label: 'Schedule', hint: 'When it runs', icon: CalendarClock },
  { id: 'review', label: 'Review', hint: 'Publish', icon: Rocket },
] as const

const DINING_STEPS = [
  { id: 'basics', label: 'Basics', hint: 'Name, format, covers', icon: UtensilsCrossed },
  { id: 'description', label: 'Description', hint: 'Menu and venue', icon: FileText },
  { id: 'media', label: 'Media', hint: 'The room and the plate', icon: Images },
  { id: 'pricing', label: 'Pricing', hint: 'Menus and deposits', icon: Tag },
  { id: 'schedule', label: 'Services', hint: 'Sittings and hours', icon: CalendarClock },
  { id: 'review', label: 'Review', hint: 'Publish', icon: Rocket },
] as const

interface WizardStep {
  id: string
  label: string
  hint: string
  icon: typeof Compass
}
const STEPS: readonly WizardStep[] = TOUR_STEPS
const stepsFor = (dining: boolean): readonly WizardStep[] => (dining ? DINING_STEPS : TOUR_STEPS)

const nonEmptyList = (min: number, message: string) =>
  z
    .array(z.string())
    .transform((items) => items.filter((item) => item.trim().length > 0))
    .refine((items) => items.length >= min, { message })

const STEP_SCHEMAS = [
  z
    .object({
      name: z.string().trim().min(3, 'Give this activity a name guests will recognise'),
      tagline: z
        .string()
        .trim()
        .min(12, 'Write a one-line hook of at least 12 characters')
        .max(120, 'Keep the tagline under 120 characters'),
      durationMinutes: z
        .number()
        .int()
        .min(0)
        .max(43200, 'Keep it under 30 days')
        .refine((minutes) => minutes === 0 || minutes >= 15, 'Give it at least 15 minutes, or leave it flexible'),
      minAge: z.number().int().min(0).max(99),
      maxCapacity: z.number().int().min(0).max(500, 'Keep seats per departure under 500, or remove the limit'),
      minParticipants: z.number().int().min(1, 'At least one guest must be required'),
    })
    .refine((draft) => draft.maxCapacity === 0 || draft.minParticipants <= draft.maxCapacity, {
      message: 'Minimum participants cannot exceed the seat limit',
      path: ['minParticipants'],
    }),

  z.object({
    description: z
      .string()
      .trim()
      .min(80, 'Describe the experience in at least 80 characters — this is the storefront copy'),
    highlights: z.array(z.string()),
    included: z.array(z.string()),
    meetingPoint: z.string().trim(),
    arrivalMode: z.enum(['meet', 'venue', 'pickup']),
  }).superRefine((draft, ctx) => {
    if (draft.arrivalMode !== 'pickup' && draft.meetingPoint.length < 10) {
      ctx.addIssue({
        code: 'custom',
        path: ['meetingPoint'],
        message: draft.arrivalMode === 'meet' ? 'Tell guests exactly where to meet you' : 'Give the address and the entrance to use',
      })
    }
  }),

  z.object({
    media: z
      .array(
        z.object({
          alt: z.string().trim().min(3, 'Alt text is required — it drives accessibility and SEO'),
        }),
      )
      .min(1, 'Add at least one image before publishing'),
  }),

  z.object({
    tiers: z
      .array(
        z
          .object({
            label: z.string().trim().min(2, 'Name this tier'),
            price: z.number().int().min(0),
            minQuantity: z.number().int().min(0),
            maxQuantity: z.number().int().min(1),
          })
          .refine((tier) => tier.maxQuantity >= tier.minQuantity, {
            message: 'Maximum must be at least the minimum',
            path: ['maxQuantity'],
          }),
      )
      .min(1, 'Keep at least one price tier'),
    addOns: z.array(
      z.object({ label: z.string().trim().min(2, 'Name this add-on, or remove it') }),
    ),
  }),

  z
    .object({
      schedule: z.object({
        mode: z.enum(['times', 'hours', 'dates']),
        weekdays: z.array(z.number()),
        startTimes: z.array(z.string()),
        capacity: z.number().int().min(0).max(500),
        seasonStart: z.string(),
        seasonEnd: z.string(),
        opensAt: z.string(),
        closesAt: z.string(),
        lastEntryMinutes: z.number().int().min(0),
        entryInterval: z.number().int().min(0),
        dates: z.array(z.object({ dateKey: z.string(), time: z.string() })),
        locations: z.array(z.object({ locationId: z.string(), schedule: z.custom<DraftSchedule>() })),
      }),
    })
    .superRefine(({ schedule }, ctx) => {
      const issue = (key: string, message: string) => ctx.addIssue({ code: 'custom', path: ['schedule', key], message })
      if (schedule.locations.length === 0) issue('locations', 'Tick at least one location this runs from')
      if (schedule.locations.length > 1) {
        // Each location carries its own rule; the shared one below is not used.
        for (const site of schedule.locations) {
          const rule = site.schedule
          const key = (field: string) => `location.${site.locationId}.${field}`
          if (schedule.mode === 'dates') {
            if (rule.dates.length === 0) issue(key('dates'), 'Add at least one date at this location')
            continue
          }
          if (rule.weekdays.length === 0) issue(key('weekdays'), 'Pick at least one day at this location')
          if (rule.seasonStart && rule.seasonEnd && rule.seasonEnd < rule.seasonStart) issue(key('seasonEnd'), 'The end date must come after the start date')
          if (schedule.mode === 'times' && rule.startTimes.length === 0) issue(key('startTimes'), 'Add at least one start time at this location')
          if (schedule.mode === 'hours' && rule.closesAt <= rule.opensAt) issue(key('closesAt'), 'Closing must come after opening')
        }
        return
      }
      if (schedule.mode === 'dates') {
        if (schedule.dates.length === 0) issue('dates', 'Add at least one date')
        return
      }
      if (schedule.weekdays.length === 0) issue('weekdays', schedule.mode === 'hours' ? 'Pick at least one open day' : 'Pick at least one day of the week')
      if (schedule.seasonStart && schedule.seasonEnd && schedule.seasonEnd < schedule.seasonStart) issue('seasonEnd', 'The end date must come after the start date')
      if (schedule.mode === 'times' && schedule.startTimes.length === 0) issue('startTimes', 'Add at least one start time')
      if (schedule.mode === 'hours') {
        if (!/^\d{2}:\d{2}$/.test(schedule.opensAt)) issue('opensAt', 'Pick an opening time')
        if (!/^\d{2}:\d{2}$/.test(schedule.closesAt)) issue('closesAt', 'Pick a closing time')
        if (schedule.closesAt <= schedule.opensAt) issue('closesAt', 'Closing must come after opening')
      }
    }),
]

const CLOCK = /^\d{2}:\d{2}$/

/** What a restaurant must get right before a table goes on sale. */
const DINING_STEP_SCHEMAS = [
  z
    .object({
      name: z.string().trim().min(3, 'Give this experience a name guests will recognise'),
      tagline: z
        .string()
        .trim()
        .min(12, 'Write a one-line hook of at least 12 characters')
        .max(120, 'Keep the tagline under 120 characters'),
      durationMinutes: z
        .number()
        .int()
        .min(30, 'Give each table at least 30 minutes')
        .max(600, 'A table time over ten hours looks like a mistake'),
      maxCapacity: z.number().int().min(1, 'A sitting needs at least one cover').max(1000, 'Keep covers per sitting under 1,000'),
      dining: z.object({
        cuisine: z.string().trim().min(2, 'Name the cuisine, for example Modern Greek'),
        seating: z.array(z.string()).min(1, 'Pick at least one seating area'),
        minPartySize: z.number().int().min(1, 'Parties start at one guest'),
        maxPartySize: z.number().int().min(1, 'Allow at least one guest'),
      }),
    })
    .superRefine((draft, ctx) => {
      if (draft.dining.maxPartySize < draft.dining.minPartySize) {
        ctx.addIssue({ code: 'custom', path: ['dining', 'maxPartySize'], message: 'The largest party cannot be smaller than the smallest' })
      } else if (draft.dining.maxPartySize > draft.maxCapacity) {
        ctx.addIssue({ code: 'custom', path: ['dining', 'maxPartySize'], message: 'The largest party cannot exceed the covers in a sitting' })
      }
    }),

  z.object({
    description: z
      .string()
      .trim()
      .min(80, 'Describe the food, the room and the evening in at least 80 characters'),
    highlights: nonEmptyList(3, 'Add at least three highlights'),
    included: nonEmptyList(1, 'List at least one thing on the menu or included'),
    meetingPoint: z.string().trim().min(10, 'Tell guests where the venue is and how to arrive'),
  }),

  z.object({
    media: z
      .array(z.object({ alt: z.string().trim().min(3, 'Alt text is required — it drives accessibility and SEO') }))
      .min(1, 'Add at least one image before publishing'),
  }),

  z
    .object({
      tiers: z.array(
        z
          .object({
            label: z.string().trim().min(2, 'Name this menu price'),
            price: z.number().int().min(0),
            minQuantity: z.number().int().min(0),
            maxQuantity: z.number().int().min(1),
          })
          .refine((tier) => tier.maxQuantity >= tier.minQuantity, { message: 'Maximum must be at least the minimum', path: ['maxQuantity'] }),
      ),
      addOns: z.array(z.object({ label: z.string().trim().min(2, 'Name this extra, or remove it') })),
      dining: z.object({
        bookingMode: z.enum(['card_hold', 'deposit', 'prepaid']),
        depositPerGuest: z.number().int().min(0),
        noShowFeePerGuest: z.number().int().min(0),
      }),
    })
    .superRefine((draft, ctx) => {
      if (draft.dining.bookingMode !== 'card_hold' && draft.tiers.length === 0) {
        ctx.addIssue({ code: 'custom', path: ['tiers'], message: 'Add at least one menu price per guest, or switch to a card hold' })
      }
      if (draft.dining.bookingMode === 'deposit' && draft.dining.depositPerGuest <= 0) {
        ctx.addIssue({ code: 'custom', path: ['dining', 'depositPerGuest'], message: 'Set a deposit, or switch to a card hold' })
      }
    }),

  z
    .object({
      schedule: z.object({
        weekdays: z.array(z.number()).min(1, 'Pick at least one open day'),
        startTimes: z.array(z.string()).min(1, 'No sitting times yet — check the first and last seating on each service'),
        capacity: z.number().int().min(1).max(1000),
        seasonStart: z.string(),
        seasonEnd: z.string(),
      }),
      dining: z.object({
        services: z
          .array(
            z.object({
              label: z.string().trim().min(1, 'Name this service'),
              from: z.string().regex(CLOCK, 'Pick a first seating'),
              to: z.string().regex(CLOCK, 'Pick a last seating'),
            }),
          )
          .min(1, 'Add at least one service'),
      }),
    })
    .superRefine((draft, ctx) => {
      draft.dining.services.forEach((service, index) => {
        if (service.to < service.from) {
          ctx.addIssue({ code: 'custom', path: ['dining', 'services', index, 'to'], message: 'Last seating must come after the first' })
        }
      })
    }),
]

type FieldErrors = Record<string, string>

function validateSchemaStep(step: number, draft: ActivityDraft): FieldErrors {
  const schema = (isDining(draft) ? DINING_STEP_SCHEMAS : STEP_SCHEMAS)[step]
  if (!schema) return {}
  const result = schema.safeParse(draft)
  if (result.success) return {}

  const errors: FieldErrors = {}
  for (const issue of result.error.issues) {
    // Schedule fields are nested one level; flatten so editors can look them up
    // by their own field name ("weekdays"), not the draft path.
    const path = issue.path.map(String)
    const key = path[0] === 'schedule' ? path.slice(1).join('.') : path.join('.')
    if (!errors[key || 'form']) errors[key || 'form'] = issue.message
  }
  return errors
}

function validateStep(step: number, draft: ActivityDraft): FieldErrors {
  const errors = validateSchemaStep(step, draft)
  // A rental prices each item per hour and/or per day; every rate that is on needs a price.
  if (step === 3 && !isDining(draft) && (draft.kind ?? 'trip') === 'rental') {
    const r = normalizeKindSettings(draft.kindSettings).rental
    for (const tier of draft.tiers) {
      const rate = r.rates[tier.id] ?? { hour: tier.price, day: tier.price * 4 }
      if (r.modes.includes('hour') && rate.hour <= 0) errors[`rate.${tier.id}.hour`] = 'Set an hourly price'
      if (r.modes.includes('day') && rate.day <= 0) errors[`rate.${tier.id}.day`] = 'Set a daily price'
    }
  }
  // With a location on the activity, its address is the meeting place; the note is optional.
  if (step === 1 && !isDining(draft) && draft.schedule.locations.length > 0) delete errors.meetingPoint
  if (step !== 0 || isDining(draft)) return errors
  const kind = draft.kind ?? 'trip'
  const settings = normalizeKindSettings(draft.kindSettings)
  if (kind === 'rental' && settings.rental.units < 1) errors['rental.units'] = 'At least one unit has to be available'
  if (kind === 'rental' && settings.rental.modes.includes('day') && settings.rental.maxDays < settings.rental.minDays) errors['rental.maxDays'] = 'Most days cannot be fewer than the fewest'
  if (kind === 'rental' && settings.rental.modes.includes('hour') && settings.rental.maxHours < settings.rental.minHours) errors['rental.maxHours'] = 'Most hours cannot be fewer than the fewest'
  if (kind === 'lesson' && draft.maxCapacity < 1) errors.maxCapacity = 'A class needs at least one place'
  if (kind === 'activity' && draft.maxCapacity < 1) errors.maxCapacity = 'A slot needs at least one rider'
  if (kind === 'activity' && draft.durationMinutes < 5) errors.durationMinutes = 'Give each slot a length'
  if (kind === 'lesson' && draft.durationMinutes < 15) errors.durationMinutes = 'Give each session at least 15 minutes'
  if (kind === 'charter' && settings.charter.maxGuests < 1) errors['charter.maxGuests'] = 'A charter carries at least one guest'
  if (kind === 'lesson') {
    if (settings.lesson.sessions < 1) errors['lesson.sessions'] = 'A course has at least one session'
    if (settings.lesson.ratio < 1) errors['lesson.ratio'] = 'At least one student per instructor'
  }
  return errors
}

/* ==========================================================================
   LIST EDITOR — highlights / included / excluded / requirements
   ========================================================================== */

function ListEditor({
  legend,
  description,
  items,
  onChange,
  placeholder,
  tone = 'positive',
  error,
}: {
  legend: string
  description?: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  tone?: 'positive' | 'negative' | 'warning'
  error?: string
}) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([])

  const update = (index: number, value: string) => {
    onChange(items.map((item, i) => (i === index ? value : item)))
  }

  const add = (afterIndex?: number) => {
    const next = [...items]
    const at = afterIndex === undefined ? next.length : afterIndex + 1
    next.splice(at, 0, '')
    onChange(next)
    // Focus the row the operator just created.
    window.requestAnimationFrame(() => inputRefs.current[at]?.focus())
  }

  const Icon = tone === 'positive' ? Check : tone === 'negative' ? Ban : TriangleAlert

  return (
    <fieldset className="min-w-0">
      <legend className="text-[0.8125rem] font-medium text-foreground">{legend}</legend>
      {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}

      <ul className="mt-2.5 flex list-none flex-col gap-2 p-0">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full',
                tone === 'positive' && 'bg-success-soft text-success',
                tone === 'negative' && 'bg-surface-sunken text-faint',
                tone === 'warning' && 'bg-warning-soft text-warning',
              )}
            >
              <Icon className="size-3" strokeWidth={2.75} />
            </span>
            <Input
              ref={(element) => {
                inputRefs.current[index] = element
              }}
              value={item}
              size="sm"
              className="flex-1"
              placeholder={placeholder}
              aria-label={`${legend} item ${index + 1}`}
              onChange={(event) => update(index, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  add(index)
                }
              }}
            />
            <IconButton
              type="button"
              aria-label={`Remove ${legend.toLowerCase()} item ${index + 1}`}
              size="xs"
              variant="ghost"
              className="text-danger hover:bg-danger-soft"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
            >
              <Trash2 />
            </IconButton>
          </li>
        ))}
      </ul>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mt-2"
        leftIcon={<Plus />}
        onClick={() => add()}
      >
        Add {legend.toLowerCase().replace(/s$/, '')}
      </Button>

      {error ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-danger">
          <CircleAlert className="size-3.5" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

/* ==========================================================================
   STEP PROGRESS
   ========================================================================== */

function StepProgress({
  steps,
  current,
  furthest,
  onJump,
}: {
  steps: readonly WizardStep[]
  current: number
  furthest: number
  onJump: (index: number) => void
}) {
  const STEPS = steps
  const progress = (current / (STEPS.length - 1)) * 100

  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-xs">
      {/* mobile */}
      <div className="sm:hidden">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold">
            {current + 1}. {STEPS[current].label}
          </p>
          <span className="text-xs text-subtle tabular">
            Step {current + 1} of {STEPS.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted">{STEPS[current].hint}</p>
      </div>

      {/* desktop */}
      <ol className="hidden list-none items-start gap-1 p-0 sm:flex">
        {STEPS.map((step, index) => {
          const state = index < current ? 'done' : index === current ? 'active' : 'todo'
          const reachable = index <= furthest
          const Icon = step.icon

          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-start gap-1">
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onJump(index)}
                className={cn(
                  'group/step flex min-w-0 flex-1 flex-col items-start gap-1.5 rounded-lg px-2 py-1.5 text-left',
                  'transition-colors duration-200',
                  reachable ? 'cursor-pointer hover:bg-surface-sunken' : 'cursor-not-allowed',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                )}
                aria-current={state === 'active' ? 'step' : undefined}
              >
                <span className="flex w-full items-center gap-2">
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                      'transition-all duration-300 ease-[var(--ease-out-expo)]',
                      state === 'done' && 'border-primary bg-primary text-on-primary',
                      state === 'active' &&
                        'border-primary bg-primary-soft text-primary ring-4 ring-primary/15',
                      state === 'todo' && 'border-line bg-surface text-faint',
                    )}
                  >
                    {state === 'done' ? (
                      <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                    ) : (
                      <Icon className="size-3.5" aria-hidden="true" />
                    )}
                  </span>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'hidden h-px flex-1 origin-left rounded-full transition-colors duration-500 lg:block',
                      index === STEPS.length - 1 && 'lg:hidden',
                      index < current ? 'bg-primary' : 'bg-line',
                    )}
                  />
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block truncate text-xs font-semibold',
                      state === 'todo' ? 'text-faint' : 'text-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="hidden truncate text-xs text-faint xl:block">
                    {step.hint}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/* ==========================================================================
   LIVE PREVIEW
   ========================================================================== */

function StorefrontPreview({
  draft,
  currency,
  tenantSlug,
  nowIso,
  compact = false,
}: {
  draft: ActivityDraft
  currency: CurrencyCode
  tenantSlug: string
  nowIso: string
  compact?: boolean
}) {
  const primary = draft.media.find((item) => item.isPrimary) ?? draft.media[0] ?? null
  const priced = draft.tiers.filter((tier) => tier.label.trim().length > 0)
  const fromPrice = priced.length === 0 ? 0 : Math.min(...priced.map((tier) => tier.price))
  const upcoming = previewDepartures(draft.schedule, nowIso, 10).slice(0, 3)
  const highlights = draft.highlights.filter((item) => item.trim().length > 0).slice(0, 3)
  const dining = isDining(draft)

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-line-subtle bg-surface-sunken px-3 py-2">
        <span aria-hidden="true" className="flex gap-1">
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-1 font-mono text-xs text-faint">
          {tenantSlug}.ezrapro.com/{slugify(draft.name) || 'new-activity'}
        </span>
      </div>

      <div className="relative aspect-[16/10] w-full bg-surface-sunken">
        {primary ? (
          // Draft media can be an object URL or any host — a plain img is correct.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={primary.url} alt={primary.alt} className="size-full object-cover" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-faint">
            <Images className="size-6" aria-hidden="true" />
            <span className="text-xs">Your hero image lands here</span>
          </div>
        )}
        {draft.featured ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-sunset-400/90 px-2 py-0.5 text-xs font-semibold text-ink-950">
            <Star className="size-3 fill-current" aria-hidden="true" />
            Featured
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <h3 className="font-display text-base leading-snug font-semibold text-balance">
            {draft.name || 'Untitled activity'}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
            {draft.tagline || 'Your one-line hook appears here.'}
          </p>
        </div>

        {dining ? null : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-subtle">
            {kindFacts(draft).map((fact) => (
              <span key={fact} className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-faint" aria-hidden="true" />
                {fact}
              </span>
            ))}
          </div>
        )}
        <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-subtle', !dining && 'hidden')}>
          <span className="inline-flex items-center gap-1.5">
            <Timer className="size-3.5 text-faint" aria-hidden="true" />
            {draft.durationMinutes > 0 ? formatDuration(draft.durationMinutes) : 'Flexible'}
            {dining ? ' table' : ''}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5 text-faint" aria-hidden="true" />
            {dining ? `Parties of ${draft.dining.minPartySize}–${draft.dining.maxPartySize}` : draft.maxCapacity > 0 ? `Up to ${draft.maxCapacity}` : 'No seat limit'}
          </span>
          {dining ? (
            <span className="inline-flex items-center gap-1.5">
              <UtensilsCrossed className="size-3.5 text-faint" aria-hidden="true" />
              {draft.dining.cuisine || formatLabel(FORMAT_OPTIONS, draft.dining.format)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Gauge className="size-3.5 text-faint" aria-hidden="true" />
              {draft.difficulty}
            </span>
          )}
        </div>

        {highlights.length > 0 && !compact ? (
          <ul className="flex list-none flex-col gap-1.5 p-0">
            {highlights.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-muted">
                <Check className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden="true" />
                <span className="line-clamp-1">{item}</span>
              </li>
            ))}
          </ul>
        ) : null}

        {upcoming.length > 0 ? (
          <div className="rounded-lg bg-surface-sunken p-2.5">
            <p className="text-xs font-semibold tracking-wide text-faint uppercase">
              {dining ? 'Next sittings' : 'Next available'}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {upcoming.map((day) => (
                <span
                  key={day.dateKey}
                  className="rounded-md bg-surface px-1.5 py-1 text-xs font-medium text-muted tabular"
                >
                  {new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric' }).format(
                    new Date(`${day.dateKey}T00:00:00`),
                  )}{' '}
                  · {day.open ? `${formatClock(day.open.from)}–${formatClock(day.open.to)}` : formatClock(day.times[0])}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-end justify-between gap-3 border-t border-line-subtle pt-3">
          <div>
            <p className="text-xs tracking-wide text-faint uppercase">From</p>
            <p className="font-display text-lg leading-tight font-semibold">
              {formatCurrency(fromPrice, currency)}
            </p>
          </div>
          <span className="pointer-events-none inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[0.8125rem] font-semibold text-on-primary shadow-sm">
            {dining ? 'Reserve a table' : 'Check availability'}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   WIZARD
   ========================================================================== */

export interface ActivityWizardProps {
  currency: CurrencyCode
  tenantName: string
  tenantSlug: string
  defaultCategory: VerticalKey
  /** The frozen demo clock, serialised from the server. */
  nowIso: string
  /** Bookable people in the workspace, offered as default crew. */
  crew?: WizardCrewMember[]
  /** Editing an existing activity: the draft starts from it and saving writes back to it. */
  mode?: 'create' | 'edit'
  activityId?: string
  /** The activity being edited; the draft is built from it on the client. */
  activity?: Activity
  initialDraft?: ActivityDraft
  /** The business's locations; the schedule step asks which this runs from. */
  locations?: Location[]
  /** The business's waiver templates, for the Guest details card. */
  waivers?: WaiverOption[]
  /** The business's pickup zones, for the Hotel pickup card. */
  pickupZones?: PickupZoneOption[]
}

export function ActivityWizard({
  currency,
  tenantName,
  tenantSlug,
  defaultCategory,
  nowIso,
  crew = [],
  locations = [],
  waivers = [],
  pickupZones = [],
  mode = 'create',
  activityId,
  activity,
  initialDraft,
}: ActivityWizardProps) {
  const router = useRouter()
  const reduceMotion = useReducedMotionSafe()
  const editing = mode === 'edit' && Boolean(activityId)
  const storageKey = editing ? `ezra:activity-wizard:edit:${activityId}` : STORAGE_KEY
  const exitHref = editing ? `/dashboard/activities/${activityId}` : '/dashboard/activities'

  const initial = React.useMemo(
    () => {
      const start = deriveForKind(withHomeLocation(initialDraft ?? (activity ? draftFromActivity(activity, nowIso) : createDefaultDraft(defaultCategory, nowIso)), locations))
      return !activity && !start.waiverId && waivers[0] ? { ...start, waiverId: waivers[0].id } : start
    },
    [initialDraft, activity, defaultCategory, nowIso],
  )

  const [draft, setDraft] = React.useState<ActivityDraft>(initial)
  const [step, setStep] = React.useState(0)
  const [furthest, setFurthest] = React.useState(0)
  const [direction, setDirection] = React.useState(1)
  const [errors, setErrors] = React.useState<FieldErrors>({})
  const [showErrors, setShowErrors] = React.useState(false)
  const [submitting, setSubmitting] = React.useState<'draft' | 'live' | null>(null)
  const [restored, setRestored] = React.useState(false)

  /* ---- sessionStorage: read once after mount so SSR and hydration match ---- */
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.sessionStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as { draft?: Partial<ActivityDraft>; step?: number }
      if (parsed.draft) {
        setDraft((current) => deriveForKind({ ...current, ...parsed.draft }))
        setRestored(true)
      }
      if (typeof parsed.step === 'number') {
        const next = Math.min(Math.max(parsed.step, 0), STEPS.length - 1)
        setStep(next)
        setFurthest(next)
      }
    } catch {
      // A corrupt or blocked store simply means starting fresh.
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify({ draft, step }))
    } catch {
      // Private mode or a full quota — the wizard still works in memory.
    }
  }, [draft, step, storageKey])

  const patch = React.useCallback((changes: Partial<ActivityDraft>) => {
    setDraft((current) => deriveForKind({ ...current, ...changes }))
  }, [])

  // Re-validate live once the operator has been told what is missing.
  React.useEffect(() => {
    if (!showErrors) return
    setErrors(validateStep(step, draft))
  }, [draft, step, showErrors])

  const goTo = (next: number, dir: number) => {
    setDirection(dir)
    setStep(next)
    setFurthest((value) => Math.max(value, next))
    setShowErrors(false)
    setErrors({})
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const back = () => {
    if (step === 0) {
      router.push(exitHref)
      return
    }
    goTo(step - 1, -1)
  }

  const advance = () => {
    const found = validateStep(step, draft)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      setShowErrors(true)
      toast.error('A few fields need attention', {
        description: Object.values(found)[0],
      })
      return
    }
    if (step === STEPS.length - 1) return
    goTo(step + 1, 1)
  }

  const reset = () => {
    setDraft(editing ? initial : deriveForKind(withHomeLocation(createDefaultDraft(defaultCategory, nowIso), locations)))
    setStep(0)
    setFurthest(0)
    setErrors({})
    setShowErrors(false)
    setRestored(false)
    try {
      window.sessionStorage.removeItem(storageKey)
    } catch {
      /* nothing to clear */
    }
    toast(editing ? 'Changes discarded' : 'Draft discarded')
  }

  const submit = (mode: 'draft' | 'live') => {
    // Publishing runs every step's schema, not just the current one.
    for (let index = 0; index < STEP_SCHEMAS.length; index++) {
      const found = validateStep(index, draft)
      if (Object.keys(found).length > 0) {
        // goTo clears the error state, so re-apply it for the step we land on.
        goTo(index, index < step ? -1 : 1)
        setErrors(found)
        setShowErrors(true)
        toast.error(`Step ${index + 1} needs attention`, { description: Object.values(found)[0] })
        return
      }
    }

    setSubmitting(mode)
    window.setTimeout(() => {
      try {
        window.sessionStorage.removeItem(storageKey)
      } catch {
        /* already gone */
      }
      if (editing && activityId) {
        saveActivityOverride(activityId, {
          name: draft.name,
          tagline: draft.tagline,
          description: draft.description,
          highlights: draft.highlights,
          included: draft.included,
          excluded: draft.excluded,
          requirements: draft.requirements,
          meetingPoint: draft.meetingPoint,
          difficulty: draft.difficulty,
          durationMinutes: draft.durationMinutes,
          maxCapacity: draft.maxCapacity,
          minAge: draft.minAge,
          minParticipants: draft.minParticipants,
          featured: draft.featured,
          languages: draft.languages ?? [],
          theme: draft.theme ?? defaultTheme(draft.category),
          customCategory: draft.customCategory?.trim() || null,
          accessibility: draft.accessibility ?? [],
          bring: (draft.bring ?? []).map((item) => item.trim()).filter(Boolean),
          route: routeOverride(draft),
          kind: draft.kind ?? 'trip',
          ...kindOverride(draft),
          crewIds: draft.crewIds,
          guestQuestions: (draft.guestQuestions ?? []).filter((question) => question.label.trim().length > 0),
          waiverId: draft.waiverId ?? null,
          pickup:
            (draft.pickup?.enabled || draft.arrivalMode === 'pickup') && draft.pickup.zoneIds.length > 0
              ? {
                  zoneIds: draft.pickup.zoneIds,
                  required: draft.arrivalMode === 'pickup',
                  // Every chosen zone gets a price on save, so a later change to the zone's own fee does not move it.
                  prices: Object.fromEntries(
                    draft.pickup.zoneIds.map((id) => {
                      const zone = pickupZones.find((entry) => entry.id === id)
                      return [id, draft.pickup.prices?.[id] ?? { fee: zone?.fee ?? 0, per: 'guest' as const }]
                    }),
                  ),
                }
              : null,
          locations: draft.schedule.locations.map((site) => {
            const rule = draft.schedule.locations.length > 1 ? site.schedule : draft.schedule
            return { locationId: site.locationId, times: rule.startTimes, weekdays: rule.weekdays }
          }),
        })
        toast.success('Changes saved', { description: `${draft.name} is updated on the storefront.` })
        router.push(exitHref)
        return
      }
      if (mode === 'live') {
        toast.success(`${draft.name} is live`, {
          description: `Bookable now at ${tenantSlug}.ezrapro.com/${slugify(draft.name)}`,
        })
      } else {
        toast.success('Draft saved', {
          description: 'Nothing is visible to guests until you publish it.',
        })
      }
      router.push('/dashboard/activities')
    }, 700)
  }

  const slideVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 36 : -36, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -36 : 36, opacity: 0 }),
  }

  const dining = isDining(draft)
  const steps = stepsFor(dining)
  const currentStep = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="flex flex-col gap-5">
      <StepProgress steps={steps} current={step} furthest={furthest} onJump={(index) => goTo(index, index > step ? 1 : -1)} />

      {restored && step === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-info/30 bg-info-soft/60 px-4 py-2.5">
          <p className="flex items-center gap-2 text-[0.8125rem] text-foreground">
            <RotateCcw className="size-4 text-info" aria-hidden="true" />
            We restored the draft you started earlier in this session.
          </p>
          <Button type="button" variant="ghost" size="xs" onClick={reset}>
            Start over
          </Button>
        </div>
      ) : null}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        {/* ---------- form column ---------- */}
        <div className="min-w-0">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle className="text-base">
                  {step + 1}. {currentStep.label}
                </CardTitle>
                <CardDescription>{(dining ? DINING_STEP_COPY : STEP_COPY)[step]}</CardDescription>
              </div>
            </CardHeader>

            <CardContent className="min-w-0">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div
                  key={currentStep.id}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.32, ease: [0.16, 1, 0.3, 1] }
                  }
                  className="min-w-0"
                >
                  {step === 0 ? (
                    <BasicsStep draft={draft} patch={patch} errors={errors} currency={currency} tenantSlug={tenantSlug} />
                  ) : null}
                  {step === 1 ? (
                    <DescriptionStep
                      draft={draft}
                      patch={patch}
                      errors={errors}
                      locationNames={locations.filter((site) => draft.schedule.locations.some((entry) => entry.locationId === site.id)).map((site) => site.name)}
                      pickupEditor={
                        <PickupEditor
                          variant={draft.arrivalMode === 'pickup' ? 'only' : 'optional'}
                          value={draft.pickup ?? { enabled: false, zoneIds: [], required: false }}
                          onChange={(pickup) => patch({ pickup })}
                          zones={pickupZones}
                          currencySymbol={currencySymbol(currency)}
                        />
                      }
                      allZoneIds={pickupZones.map((zone) => zone.id)}
                    />
                  ) : null}
                  {step === 1 && !dining ? (
                    <GuestQuestionsEditor
                      questions={draft.guestQuestions ?? []}
                      onChange={(guestQuestions) => patch({ guestQuestions })}
                      waiverId={draft.waiverId ?? null}
                      onWaiverChange={(waiverId) => patch({ waiverId })}
                      waivers={waivers}
                    />
                  ) : null}

                  {step === 2 ? (
                    <div className="flex flex-col gap-3">
                      <MediaManager
                        media={draft.media}
                        onChange={(media) => patch({ media })}
                        errors={errors}
                      />
                      {errors.media ? (
                        <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
                          <CircleAlert className="size-3.5" aria-hidden="true" />
                          {errors.media}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {step === 3 ? (
                    <div className="flex flex-col gap-6">
                      {dining ? (
                        <>
                          <DiningBookingFields
                            dining={draft.dining}
                            onChange={(next) => patch({ dining: next })}
                            errors={errors}
                            currency={currency}
                          />
                          <Separator />
                        </>
                      ) : null}

                      {!dining && (draft.kind ?? 'trip') === 'rental' ? (
                      <section>
                        <h3 className="text-sm font-semibold">Rates</h3>
                        <p className="mt-0.5 mb-3 text-xs text-muted">Everything you rent out, with its price per hour and per day. The cheapest sets the “from” price.</p>
                        <RentalRatesEditor
                          tiers={draft.tiers}
                          onTiers={(tiers) => patch({ tiers })}
                          settings={draft.kindSettings}
                          onSettings={(kindSettings) => patch({ kindSettings })}
                          currencySymbol={currencySymbol(currency)}
                          errors={errors}
                          newTier={(label) => ({ ...blankTier(label, 0), minQuantity: 0 })}
                        />
                      </section>
                      ) : (
                      <section>
                        <h3 className="text-sm font-semibold">{dining ? 'Menu prices per guest' : 'Price tiers'}</h3>
                        <p className="mt-0.5 mb-3 text-xs text-muted">
                          {dining
                            ? draft.dining.bookingMode === 'card_hold'
                              ? 'Optional for à la carte. Add menus here if guests choose one when they reserve.'
                              : 'Each guest picks a menu when the table is reserved. The first sets the “from” price.'
                            : 'The first tier sets the “from” price on every storefront tile.'}
                        </p>
                        <PricingTierEditor
                          tiers={draft.tiers}
                          onChange={(tiers) => patch({ tiers })}
                          currency={currency}
                          errors={errors}
                          presets={dining ? DINING_TIER_PRESETS : undefined}
                        />
                        {errors.tiers ? (
                          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-danger">
                            <CircleAlert className="size-3.5" aria-hidden="true" />
                            {errors.tiers}
                          </p>
                        ) : null}
                      </section>
                      )}

                      <Separator />

                      <section>
                        <h3 className="text-sm font-semibold">{dining ? 'Pairings and extras' : 'Add-ons'}</h3>
                        <p className="mt-0.5 mb-3 text-xs text-muted">
                          {dining
                            ? 'Offered once the table is picked: pairings, a bottle on arrival, a cake for the birthday.'
                            : 'Optional extras offered once the guest has picked a time.'}
                        </p>
                        <AddonEditor
                          addOns={draft.addOns}
                          onChange={(addOns) => patch({ addOns })}
                          currency={currency}
                          errors={errors}
                          presets={dining ? DINING_ADDON_PRESETS : undefined}
                        />
                      </section>

                      {(draft.kind ?? 'trip') === 'rental' && !dining ? null : <GuestPricePreview
                        tiers={draft.tiers}
                        addOns={draft.addOns}
                        currency={currency}
                      />}
                    </div>
                  ) : null}
                  {step === 4 ? (
                    dining ? (
                      <DiningServiceEditor
                        dining={draft.dining}
                        onChange={(next) => patch({ dining: next })}
                        schedule={draft.schedule}
                        onSchedule={(schedule) => patch({ schedule })}
                        nowIso={nowIso}
                        errors={errors}
                      />
                    ) : (
                      <div className="flex flex-col gap-6">
                        {locations.length > 0 ? (
                          <LocationsEditor
                            rental={rentalHoursFor(draft)}
                            seats={{ ...seatsFor(draft), onEdit: () => goTo(0, -1) }}
                            schedule={draft.schedule}
                            onChange={(schedule) => patch({ schedule })}
                            locations={locations}
                            nowIso={nowIso}
                            errors={errors}
                          />
                        ) : null}
                        {draft.schedule.locations.length > 1 ? null : (
                          <ScheduleEditor
                            rental={rentalHoursFor(draft)}
                            seats={{ ...seatsFor(draft), onEdit: () => goTo(0, -1) }}
                            schedule={draft.schedule}
                            onChange={(schedule) => patch({ schedule })}
                            nowIso={nowIso}
                            errors={errors}
                          />
                        )}
                      </div>
                    )
                  ) : null}
                  {step === 4 && crew.length > 0 ? (
                    <CrewPicker
                      crew={crew}
                      selected={draft.crewIds}
                      onChange={(crewIds) => patch({ crewIds })}
                      dining={dining}
                    />
                  ) : null}
                  {step === 5 ? (
                    <ReviewStep
                      draft={draft}
                      locations={locations}
                      waivers={waivers}
                      crew={crew}
                      currency={currency}
                      tenantName={tenantName}
                      tenantSlug={tenantSlug}
                      nowIso={nowIso}
                      patch={patch}
                      onJump={(index) => goTo(index, -1)}
                    />
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </CardContent>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-sunken/50 px-5 py-4 sm:px-6">
              <Button type="button" variant="ghost" leftIcon={<ArrowLeft />} onClick={back}>
                {step === 0 ? 'Cancel' : `Back to ${steps[step - 1].label.toLowerCase()}`}
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                {editing ? null : (
                  <Button
                    type="button"
                    variant="secondary"
                    leftIcon={<Save />}
                    loading={submitting === 'draft'}
                    disabled={submitting !== null}
                    onClick={() => submit('draft')}
                  >
                    Save as draft
                  </Button>
                )}
                {isLast ? (
                  <Button
                    type="button"
                    variant="primary"
                    leftIcon={<Rocket />}
                    loading={submitting === 'live'}
                    disabled={submitting !== null}
                    onClick={() => submit('live')}
                  >
                    {editing ? 'Save changes' : dining ? 'Open the book' : 'Publish activity'}
                  </Button>
                ) : (
                  <Button type="button" variant="primary" rightIcon={<ArrowRight />} onClick={advance}>
                    Continue
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* ---------- live preview ---------- */}
        <aside className="hidden min-w-0 lg:block">
          <div className="sticky top-6 flex flex-col gap-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-subtle uppercase">
              <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
              Live preview
            </p>
            <StorefrontPreview
              draft={draft}
              currency={currency}
              tenantSlug={tenantSlug}
              nowIso={nowIso}
            />
            <p className="text-xs leading-relaxed text-faint">
              This is how the listing renders on {tenantName}&rsquo;s storefront and inside the
              booking widget. It updates as you type.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

const STEP_COPY = [
  'What you sell, who it is for, and the settings that kind of product needs.',
  'The copy guests read before they book. Specific beats clever.',
  'Photography does most of the selling. Landscape frames, no logos, no text overlays.',
  'Ticket tiers and the extras you upsell once a time is picked.',
  'The rule that generates departures on the calendar.',
  'One last read-through, then publish.',
] as const

const DINING_STEP_COPY = [
  'What you serve, the room, and how many covers a sitting carries.',
  'The copy guests read before they reserve. Lead with the food.',
  'Photography sells the room and the plate. Landscape frames, no logos, no text overlays.',
  'How the table is secured, menu prices per guest, and the extras you upsell.',
  'Your services and sitting times, and the covers each one sells.',
  'One last read-through, then open the book.',
] as const

/* ==========================================================================
   STEPS
   ========================================================================== */

interface StepProps {
  draft: ActivityDraft
  patch: (changes: Partial<ActivityDraft>) => void
  errors: FieldErrors
  currency?: CurrencyCode
}

/** "$" for USD, "€" for EUR, and so on. */
function currencySymbol(currency: CurrencyCode | undefined) {
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency: currency ?? 'USD' })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? '$'
    )
  } catch {
    return '$'
  }
}

/** One line each, the facts a guest reads on the listing card, in the kind's own terms. */
function kindFacts(draft: ActivityDraft): string[] {
  const kind = draft.kind ?? 'trip'
  const s = normalizeKindSettings(draft.kindSettings)
  const age = draft.minAge > 0 ? `Ages ${draft.minAge}+` : 'All ages'
  const langs = (draft.languages ?? []).length > 0 ? (draft.languages ?? []).join(', ') : null
  if (kind === 'rental') {
    const r = s.rental
    const meta = rentalCategoryMeta(r.category)
    return [
      [r.modes.includes('hour') ? `By the hour · ${r.minHours}–${r.maxHours} h` : null, r.modes.includes('day') ? `By the day · ${r.minDays}–${r.maxDays} days` : null].filter(Boolean).join(' or '),
      `${r.units} ${r.units === 1 ? meta.unit : meta.units} · ${r.seatsPerUnit} per ${meta.unit}`,
      r.licence === 'none' ? age : `${LICENCE_LABEL[r.licence]} · ${age.toLowerCase()}`,
      ...(meta.fuel ? [FUEL_LABEL[r.fuel]] : []),
      ...(meta.mileage ? [r.kmPerDay > 0 ? `${r.kmPerDay} km a day` : 'Unlimited km'] : []),
      ...(r.damageDeposit > 0 ? ['Damage deposit held'] : []),
    ]
  }
  if (kind === 'charter') {
    const c = s.charter
    return [
      `${vesselName(c)} · ${c.crewed ? `${crewName(c)} included` : 'Self-skippered'}`,
      draft.durationMinutes > 0 ? formatDuration(draft.durationMinutes) : 'Length to agree',
      `${draft.minParticipants}–${c.maxGuests} guests`,
      `${c.noticeHours}h notice`,
      c.requestToBook ? 'Request to book' : 'Instant booking',
      age,
      ...(langs ? [langs] : []),
    ]
  }
  if (kind === 'lesson') {
    const l = s.lesson
    return [
      LESSON_LEVELS.find((entry) => entry.value === l.level)?.label ?? 'All levels',
      `${l.sessions > 1 ? `${l.sessions} sessions of ` : ''}${formatDuration(draft.durationMinutes)}`,
      `${draft.maxCapacity} per class · ${l.ratio} per instructor`,
      age,
      ...(l.equipmentIncluded ? ['Equipment included'] : []),
      ...(langs ? [langs] : []),
    ]
  }
  const route = draft.route ?? emptyRoute()
  const routeFact = route.enabled && route.distance > 0 ? [`${route.distance} ${route.unit}${route.track.trim() ? ` · ${route.track.trim()}` : ''}`] : []
  if (kind === 'activity') {
    return [
      `${formatDuration(draft.durationMinutes)} slots`,
      `${draft.maxCapacity} per slot`,
      draft.difficulty.charAt(0).toUpperCase() + draft.difficulty.slice(1),
      age,
      ...(s.activity.minHeightCm > 0 ? [`${s.activity.minHeightCm} cm+`] : []),
      ...(s.activity.maxWeightKg > 0 ? [`Up to ${s.activity.maxWeightKg} kg`] : []),
      ...routeFact,
    ]
  }
  if (kind === 'pass') {
    return [
      s.pass.validDays > 1 ? `Valid ${s.pass.validDays} days` : 'Valid all day',
      draft.maxCapacity > 0 ? `${draft.maxCapacity} tickets a day` : 'No ticket limit',
      s.pass.reentry ? 'Re-entry allowed' : 'Single entry',
      age,
    ]
  }
  return [
    draft.difficulty.charAt(0).toUpperCase() + draft.difficulty.slice(1),
    draft.durationMinutes > 0 ? formatDuration(draft.durationMinutes) : 'Flexible length',
    draft.maxCapacity > 0 ? `${draft.minParticipants}–${draft.maxCapacity} guests` : 'No seat limit',
    age,
    ...routeFact,
    ...(langs ? [langs] : []),
  ]
}

/** A tier nobody has renamed yet follows the kind, so a rental does not start with "Adult". */
const STARTER_TIER: Record<ActivityKind, string> = {
  trip: 'Adult',
  activity: 'Rider',
  charter: 'Half-day charter',
  rental: 'Standard',
  lesson: 'Student',
  pass: 'Day ticket',
}

const NEW_CATEGORY = '__new'

/** Built-in categories, the business's own, and a way to add one without leaving the form. */
function CategoryField({ draft, patch, tenantSlug }: { draft: ActivityDraft; patch: StepProps['patch']; tenantSlug: string }) {
  const custom = useCustomCategories(tenantSlug)
  const [creating, setCreating] = React.useState(false)
  const [name, setName] = React.useState('')
  const [hint, setHint] = React.useState('')
  const taken = (label: string) =>
    [...ACTIVITY_THEMES.map((entry) => entry.label), ...custom.categories.map((entry) => entry.label)].some((entry) => entry.toLowerCase() === label.trim().toLowerCase())
  const problem = name.trim().length < 2 ? 'Give it a name of at least two letters' : name.trim().length > 40 ? 'Keep it under 40 characters' : taken(name) ? 'There is already a category with that name' : null
  const value = draft.customCategory ? `custom:${draft.customCategory}` : (draft.theme ?? defaultTheme(draft.category))

  const add = () => {
    if (problem) return
    const label = name.trim()
    custom.add({ label, hint: hint.trim() })
    patch({ customCategory: label })
    setCreating(false)
    setName('')
    setHint('')
    toast.success(`${label} added`, { description: 'It is saved for your business and shows in every activity form.' })
  }

  return (
    <div className="flex flex-col gap-2">
      <Field label="Category" description="Where guests find it on your storefront and in search. Pick one of ours or make your own.">
        <Select
          value={value}
          onValueChange={(next) => {
            if (next === NEW_CATEGORY) return setCreating(true)
            if (next.startsWith('custom:')) return patch({ customCategory: next.slice(7) })
            patch({ theme: next as ActivityTheme, customCategory: null })
          }}
        >
          <SelectTrigger aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {custom.categories.length > 0 || (draft.customCategory && !custom.categories.some((entry) => entry.label === draft.customCategory)) ? (
              <>
                <SelectGroup>
                  <SelectLabel>Your categories</SelectLabel>
                  {custom.categories.map((entry) => (
                    <SelectItem key={entry.label} value={`custom:${entry.label}`} description={entry.hint || undefined}>
                      {entry.label}
                    </SelectItem>
                  ))}
                  {draft.customCategory && !custom.categories.some((entry) => entry.label === draft.customCategory) ? (
                    <SelectItem value={`custom:${draft.customCategory}`}>{draft.customCategory}</SelectItem>
                  ) : null}
                </SelectGroup>
                <SelectSeparator />
              </>
            ) : null}
            <SelectGroup>
              <SelectLabel>Standard categories</SelectLabel>
              {ACTIVITY_THEMES.map((option) => (
                <SelectItem key={option.value} value={option.value} description={option.hint}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
            <SelectSeparator />
            <SelectItem value={NEW_CATEGORY} description="A name that fits how you sell">
              + Create a category
            </SelectItem>
          </SelectContent>
        </Select>
      </Field>

      {creating ? (
        <form
          className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary-soft/20 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            add()
          }}
        >
          <p className="text-[0.8125rem] font-semibold">New category</p>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <Field label="Name" required error={name && problem ? problem : undefined}>
              {(control) => <Input {...control} autoFocus value={name} placeholder="Sunset specials" onChange={(event) => setName(event.target.value)} />}
            </Field>
            <Field label="Short description" optional>
              {(control) => <Input {...control} value={hint} placeholder="Golden-hour sails, sunset paddles" onChange={(event) => setHint(event.target.value.slice(0, 60))} />}
            </Field>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={Boolean(problem)}>
              Add category
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setCreating(false); setName(''); setHint('') }}>
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {custom.categories.length > 0 && !creating ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-subtle">Your categories:</span>
          {custom.categories.map((entry) => (
            <span key={entry.label} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pr-1 pl-2.5 text-xs font-medium text-muted">
              {entry.label}
              <button
                type="button"
                aria-label={`Remove ${entry.label}`}
                className="grid size-4 place-items-center rounded-full text-faint hover:bg-surface-sunken hover:text-danger"
                onClick={() => {
                  custom.remove(entry.label)
                  if (draft.customCategory === entry.label) patch({ customCategory: null })
                  toast(`${entry.label} removed`, { description: 'Activities already in it keep the name until you change them.' })
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function BasicsStep({ draft, patch, errors, currency, tenantSlug = '' }: StepProps & { tenantSlug?: string }) {
  const dining = isDining(draft)
  const kind = draft.kind ?? 'trip'
  const settings = normalizeKindSettings(draft.kindSettings)
  const pickKind = (next: ActivityKind) => {
    const mode = ACTIVITY_KIND_META[next].defaultFormat === 'open' ? 'hours' : 'times'
    const starter = draft.tiers.length === 1 && Object.values(STARTER_TIER).includes(draft.tiers[0].label)
    const arrival: ArrivalMode = next === 'pass' || next === 'rental' || next === 'activity' ? 'venue' : 'meet'
    patch({
      kind: next,
      schedule: { ...draft.schedule, mode },
      ...(draft.meetingPoint.trim() ? {} : { arrivalMode: arrival }),
      ...(starter ? { tiers: [{ ...draft.tiers[0], label: STARTER_TIER[next] }] } : {}),
      ...(next === 'lesson' && draft.maxCapacity < 1 ? { maxCapacity: 8, durationMinutes: draft.durationMinutes || 120 } : {}),
      ...(next === 'charter' && draft.durationMinutes < 60 ? { durationMinutes: 240, durationUnit: 'hours' as const } : {}),
      ...(next === 'activity'
        ? {
            schedule: { ...draft.schedule, mode: 'hours' as const, entryInterval: draft.schedule.entryInterval || 30 },
            ...(draft.maxCapacity < 1 ? { maxCapacity: 8 } : {}),
            ...(draft.durationMinutes < 15 ? { durationMinutes: 30, durationUnit: 'minutes' as const } : {}),
          }
        : {}),
    })
  }
  const shared: SharedBasics = {
    maxCapacity: draft.maxCapacity,
    minParticipants: draft.minParticipants,
    minAge: draft.minAge,
    durationMinutes: draft.durationMinutes,
    durationUnit: draft.durationUnit,
    languages: draft.languages ?? [],
    difficulty: draft.difficulty,
    route: draft.route ?? emptyRoute(),
  }
  return (
    <div className="flex flex-col gap-5">
      {dining ? null : <KindPicker value={kind} onChange={pickKind} />}
      <Field
        label={dining ? 'Experience name' : 'Activity name'}
        required
        error={errors.name}
        description={
          draft.name
            ? `Storefront URL: /${slugify(draft.name)}`
            : 'Guests see this everywhere — search, checkout, confirmation emails.'
        }
      >
        <Input
          placeholder={dining ? 'Sunset Tasting Menu on the Terrace' : kind === 'rental' ? 'Island Jeep Rental' : kind === 'charter' ? 'Private Sportfishing Charter' : kind === 'lesson' ? 'Beginner Surf Lesson' : kind === 'pass' ? 'Beach Club Day Pass' : kind === 'activity' ? 'Upcountry Horseback Ride' : 'Molokini Crater Dawn Patrol'}
          value={draft.name}
          onChange={(event) => patch({ name: event.target.value })}
        />
      </Field>

      <Field
        label="Tagline"
        required
        error={errors.tagline}
        hint={`${draft.tagline.length}/120`}
        description="One line that earns the click."
      >
        <Input
          placeholder={dining ? 'Seven courses as the caldera goes gold' : 'First boat on the water, before the crowds and the wind'}
          value={draft.tagline}
          maxLength={120}
          onChange={(event) => patch({ tagline: event.target.value })}
        />
      </Field>

      {dining ? null : <CategoryField draft={draft} patch={patch} tenantSlug={tenantSlug} />}

      {dining ? (
        <DiningBasicsFields
          dining={draft.dining}
          onChange={(next) => patch({ dining: next })}
          errors={errors}
          durationMinutes={draft.durationMinutes}
          maxCapacity={draft.maxCapacity}
          onDuration={(durationMinutes) => patch({ durationMinutes })}
          onCapacity={(maxCapacity) => patch({ maxCapacity, schedule: { ...draft.schedule, capacity: maxCapacity } })}
        />
      ) : kind === 'trip' ? (
        <TourBasicsFields draft={draft} patch={patch} errors={errors} />
      ) : (
        <KindFields
          kind={kind}
          settings={settings}
          onChange={(kindSettings) => patch({ kindSettings })}
          tiers={draft.tiers}
          currencySymbol={currencySymbol(currency)}
          errors={errors}
          shared={shared}
          onShared={(changes) => patch(changes)}
          tenantSlug={tenantSlug}
        />
      )}
    </div>
  )
}

/** A scheduled trip: seats on a departure, a length, a fitness level. */
function TourBasicsFields({ draft, patch, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface-sunken/40 p-4">
      <p className="text-[0.8125rem] font-medium">Scheduled trip settings</p>
      <fieldset>
        <legend className="text-[0.8125rem] font-medium">Difficulty</legend>
        <p className="mt-0.5 mb-2.5 text-xs text-muted">
          Sets expectations and filters out the bookings you do not want.
        </p>
        <RadioGroup
          value={draft.difficulty}
          onValueChange={(value) => patch({ difficulty: value as DifficultyLevel })}
          className="grid gap-2.5 sm:grid-cols-2"
        >
          {DIFFICULTY_OPTIONS.map((option) => (
            <RadioGroupCard
              key={option.value}
              value={option.value}
              label={option.label}
              description={option.description}
              icon={option.icon}
            />
          ))}
        </RadioGroup>
      </fieldset>

      <DurationField
        error={errors.durationMinutes}
        description="Leave it flexible if guests set their own pace."
        minutes={draft.durationMinutes}
        unit={draft.durationUnit}
        onChange={(durationMinutes, durationUnit) => patch({ durationMinutes, durationUnit })}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Seats per departure"
          error={errors.maxCapacity}
          description="Empty for no limit. The schedule uses this."
        >
          <Input
            type="number"
            min={1}
            value={draft.maxCapacity > 0 ? draft.maxCapacity : ''}
            placeholder="16"
            suffix="seats"
            onChange={(event) => patch({ maxCapacity: Number.parseInt(event.target.value, 10) || 0 })}
          />
        </Field>
        <Field
          label="Fewest to run"
          error={errors.minParticipants}
          description="Below this, the departure does not run."
        >
          <Input
            type="number"
            min={1}
            value={draft.minParticipants}
            suffix={pluralize(draft.minParticipants, 'guest')}
            onChange={(event) =>
              patch({ minParticipants: Number.parseInt(event.target.value, 10) || 0 })
            }
          />
        </Field>
        <Field label="Minimum age" error={errors.minAge} description="0 means all ages welcome.">
          <Input
            type="number"
            min={0}
            max={99}
            value={draft.minAge}
            suffix="years"
            onChange={(event) => patch({ minAge: Number.parseInt(event.target.value, 10) || 0 })}
          />
        </Field>
      </div>

      <div>
        <p className="text-[0.8125rem] font-medium">Guided in</p>
        <p className="mt-0.5 mb-2 text-xs text-muted">Shown on the listing, so guests know they will follow along.</p>
        <LanguagePicker value={draft.languages ?? []} onChange={(languages) => patch({ languages })} />
      </div>

      <div>
        <p className="mb-2 text-[0.8125rem] font-medium">Distance or track</p>
        <RouteFields value={draft.route ?? emptyRoute()} onChange={(route) => patch({ route })} />
      </div>
    </div>
  )
}

/* ==========================================================================
   CREW — who is on it by default. Changed per departure from the calendar.
   ========================================================================== */

function CrewPicker({
  crew,
  selected,
  onChange,
  dining,
}: {
  crew: WizardCrewMember[]
  selected: string[]
  onChange: (ids: string[]) => void
  dining: boolean
}) {
  return (
    <section className="mt-6 border-t border-line-subtle pt-6">
      <p className="text-[0.8125rem] font-medium">Who runs it</p>
      <p className="mt-0.5 mb-2.5 text-xs text-muted">
        Assigned to every {dining ? 'service' : 'departure'} by default and shown on the manifest. Change it for any
        single day from the calendar.
      </p>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {crew.map((member) => {
          const checked = selected.includes(member.id)
          return (
            <label
              key={member.id}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 transition-colors duration-150',
                checked ? 'border-primary/45 bg-primary-soft/50' : 'border-line hover:bg-surface-sunken',
              )}
            >
              <Checkbox
                size="sm"
                checked={checked}
                onCheckedChange={(value) =>
                  onChange(value === true ? [...selected, member.id] : selected.filter((id) => id !== member.id))
                }
              />
              <Avatar name={member.name} src={member.avatarUrl} size="xs" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-medium text-foreground">{member.name}</span>
                <span className="block truncate text-xs text-subtle">{member.title}</span>
              </span>
            </label>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-subtle">
        {selected.length === 0 ? 'Nobody yet. Leave it empty to assign crew departure by departure.' : `${selected.length} ${pluralize(selected.length, 'person', 'people')} on every one.`}
      </p>
    </section>
  )
}

/** Field copy per mode: a restaurant reads "menu" where a tour reads "included". */
const DESCRIPTION_COPY = {
  tour: {
    descriptionHelp: 'Two or three short paragraphs. Lead with what the guest will actually see and feel.',
    descriptionPlaceholder: 'We leave the harbour before sunrise, when the water inside the crater is still glass…',
    highlightPlaceholder: 'Glass-flat water and the best visibility of the day',
    included: 'Included',
    includedPlaceholder: 'Snorkel gear and wetsuit',
    excludedPlaceholder: 'Gratuity',
    requirements: 'Requirements',
    requirementsHelp: 'Shown at checkout and repeated in the confirmation email.',
    requirementsPlaceholder: 'Comfortable swimming in open water',
    venue: 'Meeting point',
    venueHelp: 'Exact enough that a guest with no local knowledge finds it in the dark.',
    venuePlaceholder: 'Māʻalaea Harbor, Slip 42 — park in the public lot and walk to the far end of the pier.',
  },
  dining: {
    descriptionHelp: 'Two or three short paragraphs. The food first, then the room, then the evening.',
    descriptionPlaceholder: 'Seven courses built around the morning catch, served on the lower terrace as the light turns…',
    highlightPlaceholder: 'Caldera-edge terrace with every table facing west',
    included: 'On the menu and included',
    includedPlaceholder: 'Seven-course tasting menu with bread and amuse-bouche',
    excludedPlaceholder: 'Drinks and wine pairing',
    requirements: 'Good to know',
    requirementsHelp: 'House rules shown at checkout and repeated in the confirmation email.',
    requirementsPlaceholder: 'Tables are held for 15 minutes past the reservation time',
    venue: 'Venue and arrival',
    venueHelp: 'The address, the entrance to use, and where to park or be dropped off.',
    venuePlaceholder: 'Nikolaou Nomikou 24, Oia — take the outside steps down to the lower terrace; taxis drop at the top of the lane.',
  },
} as const

function DescriptionStep({
  draft,
  patch,
  errors,
  locationNames = [],
  pickupEditor,
  allZoneIds = [],
}: StepProps & { locationNames?: string[]; pickupEditor?: React.ReactNode; allZoneIds?: string[] }) {
  const dining = isDining(draft)
  const copy = dining ? DESCRIPTION_COPY.dining : DESCRIPTION_COPY.tour
  // The location already carries the address; here the operator only adds where exactly to meet.
  const located = !dining && locationNames.length > 0
  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Description"
        required
        error={errors.description}
        hint={`${draft.description.trim().length} characters`}
        description={copy.descriptionHelp}
      >
        <Textarea
          rows={7}
          value={draft.description}
          placeholder={copy.descriptionPlaceholder}
          onChange={(event) => patch({ description: event.target.value })}
        />
      </Field>

      <ListEditor
        legend="Highlights"
        description="Optional. Three to five short bullets work best, shown right under the price."
        items={draft.highlights}
        onChange={(highlights) => patch({ highlights })}
        placeholder={copy.highlightPlaceholder}
        error={errors.highlights}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <ListEditor
          legend={copy.included}
          description={dining ? undefined : 'Optional, but guests compare on this.'}
          items={draft.included}
          onChange={(included) => patch({ included })}
          placeholder={copy.includedPlaceholder}
          error={errors.included}
        />
        <ListEditor
          legend="Not included"
          tone="negative"
          items={draft.excluded}
          onChange={(excluded) => patch({ excluded })}
          placeholder={copy.excludedPlaceholder}
        />
      </div>

      {dining ? <DiningDietaryFields dining={draft.dining} onChange={(next) => patch({ dining: next })} /> : null}

      <ListEditor
        legend={copy.requirements}
        tone="warning"
        description={dining ? copy.requirementsHelp : 'Optional. Anything not already covered by the age, licence and rider limits you set in Basics.'}
        items={draft.requirements}
        onChange={(requirements) => patch({ requirements })}
        placeholder={copy.requirementsPlaceholder}
      />

      {dining ? null : (
        <>
          <ListEditor
            legend="What to bring"
            description="Optional. Leave it empty and guests see a sensible list for the category."
            items={draft.bring ?? []}
            onChange={(bring) => patch({ bring })}
            placeholder="Reef-safe sunscreen"
          />
          <fieldset>
            <legend className="text-[0.8125rem] font-medium">Good to know</legend>
            <p className="mt-0.5 mb-2.5 text-xs text-muted">Optional. Tick what applies; guests filter by these on booking sites.</p>
            <div className="flex flex-wrap gap-1.5">
              {ACCESSIBILITY_OPTIONS.map((option) => {
                const on = (draft.accessibility ?? []).includes(option)
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      patch({ accessibility: on ? (draft.accessibility ?? []).filter((entry) => entry !== option) : [...(draft.accessibility ?? []), option] })
                    }
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200',
                      on ? 'border-primary/50 bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:text-foreground',
                    )}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </fieldset>
        </>
      )}

      {dining ? (
        <Field label={copy.venue} required error={errors.meetingPoint} description={copy.venueHelp}>
          <Textarea
            rows={3}
            value={draft.meetingPoint}
            placeholder={copy.venuePlaceholder}
            onChange={(event) => patch({ meetingPoint: event.target.value })}
          />
        </Field>
      ) : (
        <>
          <fieldset>
            <legend className="text-[0.8125rem] font-medium">Where guests go</legend>
            <p className="mt-0.5 mb-2.5 text-xs text-muted">
              A guided trip has a meeting point. A rental desk, a park or a time-slot activity has guests come to you. Pick up
              collects them from their hotel.
            </p>
            <RadioGroup
              value={draft.arrivalMode}
              onValueChange={(value) => {
                const mode = value as ArrivalMode
                const pickup = draft.pickup ?? { enabled: false, zoneIds: [], required: false }
                patch({
                  arrivalMode: mode,
                  // Pick up turns the zones on; leaving it keeps pickup only if it was an extra already.
                  pickup:
                    mode === 'pickup'
                      ? { ...pickup, enabled: true, required: true, zoneIds: pickup.zoneIds.length > 0 ? pickup.zoneIds : allZoneIds }
                      : { ...pickup, required: false, enabled: draft.arrivalMode === 'pickup' ? false : pickup.enabled },
                })
              }}
              className="grid gap-2.5 lg:grid-cols-3"
            >
              {ARRIVAL_OPTIONS.map((option) => (
                <RadioGroupCard
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  description={option.description}
                  icon={<option.icon aria-hidden="true" />}
                />
              ))}
            </RadioGroup>
          </fieldset>

          {located && draft.arrivalMode !== 'pickup' ? (
            <Field
              label={draft.arrivalMode === 'meet' ? 'Where exactly to meet' : 'Arrival notes'}
              optional
              error={errors.meetingPoint}
              description={`The address comes from ${locationNames.join(', ')}, set in Schedule. Add the exact spot: a slip, a sign, a desk or where to park.`}
            >
              <Textarea
                rows={2}
                value={draft.meetingPoint}
                placeholder={draft.arrivalMode === 'meet' ? 'Slip 61, by the blue Blue Horizon flag. Check in 20 minutes early.' : 'Main gate, free parking by the entrance.'}
                onChange={(event) => patch({ meetingPoint: event.target.value })}
              />
            </Field>
          ) : draft.arrivalMode === 'meet' ? (
            <Field label="Meeting point" required error={errors.meetingPoint} description={copy.venueHelp}>
              <Textarea
                rows={3}
                value={draft.meetingPoint}
                placeholder={copy.venuePlaceholder}
                onChange={(event) => patch({ meetingPoint: event.target.value })}
              />
            </Field>
          ) : draft.arrivalMode === 'venue' ? (
            <Field
              label="Venue address"
              required
              error={errors.meetingPoint}
              description="The address, the entrance to use, and where to park or be dropped off."
            >
              <Textarea
                rows={3}
                value={draft.meetingPoint}
                placeholder="Kihei Adventure Park, 120 Piilani Hwy — main gate; free parking by the entrance."
                onChange={(event) => patch({ meetingPoint: event.target.value })}
              />
            </Field>
          ) : (
            <Field
              label="Pickup notes"
              optional
              error={errors.meetingPoint}
              description="Where the driver waits and how they reach guests on the day."
            >
              <Textarea
                rows={2}
                value={draft.meetingPoint}
                placeholder="We collect you from your hotel lobby. The driver texts 15 minutes before."
                onChange={(event) => patch({ meetingPoint: event.target.value })}
              />
            </Field>
          )}
          {pickupEditor ? (
            <div className={cn(draft.arrivalMode === 'pickup' && 'rounded-xl border border-primary/30 bg-primary-soft/10 p-4')}>{pickupEditor}</div>
          ) : null}
        </>
      )}
    </div>
  )
}

function ReviewStep({
  draft,
  locations = [],
  waivers = [],
  crew,
  currency,
  tenantName,
  tenantSlug,
  nowIso,
  patch,
  onJump,
}: {
  draft: ActivityDraft
  locations?: Location[]
  waivers?: WaiverOption[]
  crew: WizardCrewMember[]
  currency: CurrencyCode
  tenantName: string
  tenantSlug: string
  nowIso: string
  patch: (changes: Partial<ActivityDraft>) => void
  onJump: (index: number) => void
}) {
  const crewNames = crew.filter((member) => draft.crewIds.includes(member.id)).map((member) => member.name)
  const crewRow = { label: 'Crew', value: crewNames.length > 0 ? crewNames.join(', ') : 'Assigned per departure', step: 4 }
  const priced = draft.tiers.filter((tier) => tier.label.trim().length > 0)
  const fromPrice = priced.length === 0 ? 0 : Math.min(...priced.map((tier) => tier.price))
  const generated = previewDepartures(draft.schedule, nowIso, 14)
  const departures = generated.reduce((acc, day) => acc + (day.open ? 1 : day.times.length), 0)
  const locationNames = draft.schedule.locations
    .map((site) => {
      const found = locations.find((entry) => entry.id === site.locationId)
      return found ? (draft.schedule.locations.length > 1 ? `${found.name}: ${describeSchedule(site.schedule, seatsFor(draft))}` : found.name) : null
    })
    .filter((name): name is string => Boolean(name))
  const seats = generated.reduce((acc, day) => acc + day.seats, 0)
  const dining = isDining(draft)
  const d = draft.dining

  const securing =
    d.bookingMode === 'deposit'
      ? `Deposit ${formatCurrency(d.depositPerGuest, currency)} per guest · no-show fee ${formatCurrency(d.noShowFeePerGuest, currency)}`
      : d.bookingMode === 'card_hold'
        ? `Card hold · no-show fee ${formatCurrency(d.noShowFeePerGuest, currency)} per guest`
        : 'Prepaid menu at booking'

  const rows: { label: string; value: React.ReactNode; step: number }[] = dining
    ? [
        { label: 'Name', value: draft.name, step: 0 },
        { label: 'Format', value: `${formatLabel(FORMAT_OPTIONS, d.format)}${d.cuisine ? ` · ${d.cuisine}` : ''}`, step: 0 },
        { label: 'Table time', value: formatDuration(draft.durationMinutes), step: 0 },
        { label: 'Covers', value: `${draft.maxCapacity} per sitting · parties of ${d.minPartySize}–${d.maxPartySize}`, step: 0 },
        { label: 'Seating', value: d.seating.length > 0 ? `${d.seating.length} ${pluralize(d.seating.length, 'area')}` : '', step: 0 },
        { label: 'House rules', value: `${formatLabel(DRESS_OPTIONS, d.dressCode)} · ${formatLabel(CHILDREN_OPTIONS, d.children)}`, step: 0 },
        { label: 'Dietary', value: `${d.dietary.length} ${pluralize(d.dietary.length, 'option')}${d.askAllergies ? ' · allergies asked at booking' : ''}`, step: 1 },
        { label: 'Venue', value: draft.meetingPoint, step: 1 },
        { label: 'Media', value: `${draft.media.length} ${pluralize(draft.media.length, 'image')}`, step: 2 },
        { label: 'Securing', value: securing, step: 3 },
        {
          label: 'Menus',
          value: priced.length === 0 ? 'À la carte on the night' : `${priced.length} ${pluralize(priced.length, 'menu')} from ${formatCurrency(fromPrice, currency)} per guest · ${draft.addOns.length} ${pluralize(draft.addOns.length, 'extra')}`,
          step: 3,
        },
        {
          label: 'Services',
          value: `${d.services.length} ${pluralize(d.services.length, 'service')} · ${draft.schedule.startTimes.length} ${pluralize(draft.schedule.startTimes.length, 'sitting')} a day on ${draft.schedule.weekdays.length} ${pluralize(draft.schedule.weekdays.length, 'day')} · ${draft.schedule.capacity} covers each`,
          step: 4,
        },
        crewRow,
      ]
    : [
        { label: 'Name', value: draft.name, step: 0 },
        { label: 'Type', value: ACTIVITY_KIND_META[draft.kind ?? 'trip'].label, step: 0 },
        {
          label: 'Guest details',
          value: `${(draft.guestQuestions ?? []).length} ${pluralize((draft.guestQuestions ?? []).length, 'question')} · ${waivers.find((waiver) => waiver.id === draft.waiverId)?.title ?? 'no waiver'}`,
          step: 1,
        },
        { label: 'Category', value: draft.customCategory || themeLabel(draft.theme ?? defaultTheme(draft.category)), step: 0 },
        ...((draft.accessibility ?? []).length > 0 ? [{ label: 'Good to know', value: (draft.accessibility ?? []).join(', '), step: 1 }] : []),
        { label: 'Setup', value: kindFacts(draft).join(' · '), step: 0 },
        { label: 'Highlights', value: `${draft.highlights.filter(Boolean).length} bullets`, step: 1 },
        {
          label: draft.arrivalMode === 'meet' ? 'Meeting point' : draft.arrivalMode === 'venue' ? 'Venue' : 'Arrival',
          value: draft.meetingPoint || 'No fixed place',
          step: 1,
        },
        { label: 'Media', value: `${draft.media.length} ${pluralize(draft.media.length, 'image')}`, step: 2 },
        {
          label: 'Pricing',
          value: `${priced.length} ${pluralize(priced.length, 'tier')} from ${formatCurrency(fromPrice, currency)} · ${draft.addOns.length} ${pluralize(draft.addOns.length, 'add-on')}`,
          step: 3,
        },
        ...(locations.length > 0
          ? [{ label: 'Runs from', value: locationNames.length > 0 ? locationNames.join(', ') : 'No location picked', step: 4 }]
          : []),
        { label: 'Schedule', value: describeSchedule(draft.schedule, seatsFor(draft)), step: 4 },
        crewRow,
      ]

  const stats = dining
    ? [
        { label: 'Sittings · next 14 days', value: departures.toString(), icon: CalendarClock },
        { label: 'Covers on sale', value: seats.toString(), icon: Users },
        { label: priced.length === 0 ? 'Securing' : 'Menu from', value: priced.length === 0 ? formatLabel(BOOKING_MODE_OPTIONS, d.bookingMode) : formatCurrency(fromPrice, currency), icon: Tag },
      ]
    : [
        {
          label: draft.schedule.mode === 'hours' ? 'Open days · next 14 days' : draft.schedule.mode === 'dates' ? 'Dates listed' : 'Departures · next 14 days',
          value: departures.toString(),
          icon: CalendarClock,
        },
        {
          label: `${seatsFor(draft).many.charAt(0).toUpperCase()}${seatsFor(draft).many.slice(1)} on sale`,
          value: seatsFor(draft).capacity > 0 ? previewDepartures({ ...draft.schedule, capacity: seatsFor(draft).capacity }, nowIso, 14).reduce((acc, day) => acc + day.seats, 0).toString() : 'No limit',
          icon: Users,
        },
        { label: 'Lead price', value: formatCurrency(fromPrice, currency), icon: Tag },
      ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-xl border border-line bg-surface p-4">
              <p className="flex items-center gap-1.5 text-xs text-subtle">
                <Icon className="size-3.5 text-faint" aria-hidden="true" />
                {item.label}
              </p>
              <p className="mt-1 font-display text-xl font-semibold tabular">{item.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-line">
          <dl className="divide-y divide-line-subtle">
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-start gap-3 bg-surface px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto]"
              >
                <dt className="text-xs text-subtle">{row.label}</dt>
                <dd className="min-w-0 text-[0.8125rem] break-words text-foreground">
                  {row.value || <span className="text-faint">Not set</span>}
                </dd>
                <button
                  type="button"
                  onClick={() => onJump(row.step)}
                  className="rounded-md text-xs font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Edit
                </button>
              </div>
            ))}
          </dl>
        </div>

        <div className="lg:hidden xl:block">
          <StorefrontPreview
            draft={draft}
            currency={currency}
            tenantSlug={tenantSlug}
            nowIso={nowIso}
            compact
          />
        </div>
      </div>

      <div className="rounded-xl border border-line bg-surface p-4">
        <h3 className="text-sm font-semibold">Publish settings</h3>
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex cursor-pointer items-start justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-[0.8125rem] font-medium">
                Feature on the {tenantName} storefront
              </span>
              <span className="block text-xs text-muted">
                Featured activities lead the homepage and the booking widget.
              </span>
            </span>
            <Switch
              checked={draft.featured}
              onCheckedChange={(checked) => patch({ featured: checked })}
              aria-label="Feature on the storefront"
            />
          </label>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[0.8125rem] font-medium">Free cancellation window</span>
              <span className="block text-xs text-muted">
                {dining
                  ? 'Guests get their deposit back up to this many hours before the sitting.'
                  : 'Guests get a full refund up to this many hours before departure.'}
              </span>
            </span>
            <div className="flex gap-1.5">
              {[0, 12, 24, 48, 72].map((hours) => (
                <button
                  key={hours}
                  type="button"
                  onClick={() => patch({ freeCancellationHours: hours })}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200',
                    draft.freeCancellationHours === hours
                      ? 'border-primary/50 bg-primary-soft text-primary'
                      : 'border-line bg-surface text-muted hover:text-foreground',
                  )}
                >
                  {hours === 0 ? 'None' : `${hours}h`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-sunken/60 p-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <MapPin className="size-4" aria-hidden="true" />
        </span>
        <p className="text-xs leading-relaxed text-muted">
          Publishing makes this activity bookable immediately at{' '}
          <span className="font-medium text-foreground">
            {tenantSlug}.ezrapro.com/{slugify(draft.name) || 'new-activity'}
          </span>
          . {dining ? 'Sittings are generated from your services' : 'Departures are generated from your schedule rule'} for the next 180 days and appear on the
          calendar straight away.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="success" size="sm">
          <Check className="size-3" aria-hidden="true" />
          Every step validated
        </Badge>
      </div>
    </div>
  )
}
