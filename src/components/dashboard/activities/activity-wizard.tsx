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

import type { Activity, CurrencyCode, DifficultyLevel, Location, VerticalKey } from '@/types'
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
  SelectItem,
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
import {
  LocationsEditor,
  ScheduleEditor,
  defaultSchedule,
  describeSchedule,
  formatClock,
  previewDepartures,
  type DraftSchedule,
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
export type ArrivalMode = 'meet' | 'venue' | 'none'

export const ARRIVAL_OPTIONS: { value: ArrivalMode; label: string; description: string; icon: typeof MapPin }[] = [
  { value: 'meet', label: 'Meeting point', description: 'A guide or skipper meets guests at a set place.', icon: MapPin },
  { value: 'venue', label: 'Venue address', description: 'Guests come to you during opening hours. Parks, studios, restaurants.', icon: DoorOpen },
  { value: 'none', label: 'No fixed place', description: 'Pickup only, mobile, or the location is confirmed after booking.', icon: Route },
]

const defaultArrival = (category: VerticalKey): ArrivalMode =>
  category === 'restaurants' || category === 'wellness' ? 'venue' : 'meet'

export type DurationUnit = 'minutes' | 'hours' | 'days'
export const DURATION_UNITS: { value: DurationUnit; label: string; factor: number; placeholder: string }[] = [
  { value: 'minutes', label: 'minutes', factor: 1, placeholder: '90' },
  { value: 'hours', label: 'hours', factor: 60, placeholder: '2' },
  { value: 'days', label: 'days', factor: 1440, placeholder: '3' },
]
const unitFor = (minutes: number): DurationUnit =>
  minutes > 0 && minutes % 1440 === 0 ? 'days' : minutes > 0 && minutes % 60 === 0 ? 'hours' : 'minutes'

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
}

const STORAGE_KEY = 'ezra:activity-wizard:v3'

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
    freeCancellationHours: 24,
    crewIds: [],
    dining,
  }
}

/** The editor, filled in from an activity that already exists. */
/** A draft that has not picked a location yet starts on the business's default one. */
export function withHomeLocation(draft: ActivityDraft, locations: Location[]): ActivityDraft {
  const current = draft.schedule.locations ?? []
  if (current.length > 0 || locations.length === 0) return draft
  const home = locations.find((site) => site.isDefault) ?? locations[0]
  return { ...draft, schedule: { ...draft.schedule, locations: [{ locationId: home.id, ownTimes: false, startTimes: [] }] } }
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
    arrivalMode: activity.meetingPoint ? (restaurant || activity.category === 'wellness' ? 'venue' : 'meet') : 'none',
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
    schedule: {
      ...base.schedule,
      mode: activity.format === 'open' ? 'hours' : activity.format === 'dates' ? 'dates' : 'times',
      capacity: activity.maxCapacity,
      startTimes: homeTimes.length > 0 ? homeTimes : base.schedule.startTimes,
      locations: activity.locations.map((site, index) => ({
        locationId: site.locationId,
        ownTimes: index > 0 && site.times.join(',') !== homeTimes.join(','),
        startTimes: site.times,
      })),
    },
    featured: activity.featured,
    freeCancellationHours: activity.cancellationPolicy.freeCancellationHours,
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
  { id: 'basics', label: 'Basics', hint: 'Name, category, capacity', icon: Compass },
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
    highlights: nonEmptyList(3, 'Add at least three highlights'),
    included: nonEmptyList(1, 'List at least one thing that is included'),
    meetingPoint: z.string().trim(),
    arrivalMode: z.enum(['meet', 'venue', 'none']),
  }).superRefine((draft, ctx) => {
    if (draft.arrivalMode !== 'none' && draft.meetingPoint.length < 10) {
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
        locations: z.array(z.object({ locationId: z.string(), ownTimes: z.boolean(), startTimes: z.array(z.string()) })),
      }),
    })
    .superRefine(({ schedule }, ctx) => {
      const issue = (key: string, message: string) => ctx.addIssue({ code: 'custom', path: ['schedule', key], message })
      if (schedule.locations.length === 0) issue('locations', 'Tick at least one location this runs from')
      if (schedule.mode === 'times') {
        for (const site of schedule.locations) {
          if (site.ownTimes && site.startTimes.length === 0) issue(`location.${site.locationId}`, 'Add a start time for this location, or use the usual times')
        }
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

function validateStep(step: number, draft: ActivityDraft): FieldErrors {
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

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-subtle">
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
}

export function ActivityWizard({
  currency,
  tenantName,
  tenantSlug,
  defaultCategory,
  nowIso,
  crew = [],
  locations = [],
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
    () => withHomeLocation(initialDraft ?? (activity ? draftFromActivity(activity, nowIso) : createDefaultDraft(defaultCategory, nowIso)), locations),
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
        setDraft((current) => ({ ...current, ...parsed.draft }))
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
    setDraft((current) => ({ ...current, ...changes }))
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
    setDraft(editing ? initial : withHomeLocation(createDefaultDraft(defaultCategory, nowIso), locations))
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
          meetingPoint: draft.arrivalMode === 'none' ? '' : draft.meetingPoint,
          difficulty: draft.difficulty,
          durationMinutes: draft.durationMinutes,
          maxCapacity: draft.maxCapacity,
          minAge: draft.minAge,
          minParticipants: draft.minParticipants,
          featured: draft.featured,
          crewIds: draft.crewIds,
          locations: draft.schedule.locations.map((site) => ({
            locationId: site.locationId,
            times: site.ownTimes ? site.startTimes : draft.schedule.startTimes,
          })),
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
                    <BasicsStep draft={draft} patch={patch} errors={errors} />
                  ) : null}
                  {step === 1 ? (
                    <DescriptionStep draft={draft} patch={patch} errors={errors} />
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

                      <GuestPricePreview
                        tiers={draft.tiers}
                        addOns={draft.addOns}
                        currency={currency}
                      />
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
                            schedule={draft.schedule}
                            onChange={(schedule) => patch({ schedule })}
                            locations={locations}
                            errors={errors}
                          />
                        ) : null}
                        <ScheduleEditor
                          schedule={draft.schedule}
                          onChange={(schedule) => patch({ schedule })}
                          nowIso={nowIso}
                          errors={errors}
                        />
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
  'What you sell, who it is for, and how many seats a departure carries.',
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
}

function BasicsStep({ draft, patch, errors }: StepProps) {
  const dining = isDining(draft)
  return (
    <div className="flex flex-col gap-5">
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
          placeholder={dining ? 'Sunset Tasting Menu on the Terrace' : 'Molokini Crater Dawn Patrol'}
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

      <Field
        label="Category"
        description={
          dining
            ? 'Dining switches the wizard to tables, covers, menus and services.'
            : 'Drives storefront filters and the reporting rollup. Pick Dining for restaurant fields.'
        }
      >
        <Select
          value={draft.category}
          onValueChange={(value) => patch(withCategory(draft, value as VerticalKey))}
        >
          <SelectTrigger aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value} description={option.hint}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

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
      ) : (
        <TourBasicsFields draft={draft} patch={patch} errors={errors} />
      )}
    </div>
  )
}

/** The duration as typed in the chosen unit; empty while flexible. */
function durationValue(draft: Pick<ActivityDraft, 'durationMinutes' | 'durationUnit'>): string {
  if (draft.durationMinutes <= 0) return ''
  const factor = DURATION_UNITS.find((unit) => unit.value === draft.durationUnit)?.factor ?? 1
  const amount = draft.durationMinutes / factor
  return String(Math.round(amount * 100) / 100)
}

function TourBasicsFields({ draft, patch, errors }: StepProps) {
  return (
    <>
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Duration"
          error={errors.durationMinutes}
          description="Leave it empty for open-ended activities: a park pass, a rental, a self-guided ride."
        >
          <div className="flex gap-2">
            <Input
              type="number"
              min={0}
              step={draft.durationUnit === 'minutes' ? 15 : 0.5}
              value={durationValue(draft)}
              placeholder={DURATION_UNITS.find((unit) => unit.value === draft.durationUnit)?.placeholder}
              className="flex-1"
              onChange={(event) => {
                const amount = Number.parseFloat(event.target.value)
                const factor = DURATION_UNITS.find((unit) => unit.value === draft.durationUnit)?.factor ?? 1
                patch({ durationMinutes: Number.isFinite(amount) && amount > 0 ? Math.round(amount * factor) : 0 })
              }}
            />
            <Select value={draft.durationUnit} onValueChange={(value) => patch({ durationUnit: value as DurationUnit })}>
              <SelectTrigger className="w-32 shrink-0" aria-label="Duration unit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_UNITS.map((unit) => (
                  <SelectItem key={unit.value} value={unit.value}>
                    {unit.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
        <Field
          label="Seats per departure"
          error={errors.maxCapacity}
          description="Leave it empty for no seat limit."
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
          label="Minimum participants"
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
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => patch({ durationMinutes: 0 })}
          className={cn(
            'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200',
            draft.durationMinutes === 0
              ? 'border-primary/50 bg-primary-soft text-primary'
              : 'border-line bg-surface text-muted hover:text-foreground',
          )}
        >
          Flexible
        </button>
        {[60, 90, 120, 180, 240, 480, 1440, 4320].map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => patch({ durationMinutes: minutes, durationUnit: unitFor(minutes) })}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200',
              draft.durationMinutes === minutes
                ? 'border-primary/50 bg-primary-soft text-primary'
                : 'border-line bg-surface text-muted hover:text-foreground',
            )}
          >
            {minutes >= 1440 ? `${minutes / 1440} ${pluralize(minutes / 1440, 'day')}` : formatDuration(minutes)}
          </button>
        ))}
      </div>
    </>
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

function DescriptionStep({ draft, patch, errors }: StepProps) {
  const dining = isDining(draft)
  const copy = dining ? DESCRIPTION_COPY.dining : DESCRIPTION_COPY.tour
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
        description="Three to five bullets, shown directly under the price."
        items={draft.highlights}
        onChange={(highlights) => patch({ highlights })}
        placeholder={copy.highlightPlaceholder}
        error={errors.highlights}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <ListEditor
          legend={copy.included}
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
        description={copy.requirementsHelp}
        items={draft.requirements}
        onChange={(requirements) => patch({ requirements })}
        placeholder={copy.requirementsPlaceholder}
      />

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
              A guided trip needs a meeting point. A park, a studio or a walk-in activity only needs an
              address. A pickup or mobile service needs neither.
            </p>
            <RadioGroup
              value={draft.arrivalMode}
              onValueChange={(value) => patch({ arrivalMode: value as ArrivalMode })}
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

          {draft.arrivalMode === 'meet' ? (
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
              label="How guests find you"
              error={errors.meetingPoint}
              description="Optional. Pickup arrangements, a number to call on the day, or a note that the spot is confirmed after booking."
            >
              <Textarea
                rows={2}
                value={draft.meetingPoint}
                placeholder="We collect you from your hotel lobby. The driver texts 15 minutes before."
                onChange={(event) => patch({ meetingPoint: event.target.value })}
              />
            </Field>
          )}
        </>
      )}
    </div>
  )
}

function ReviewStep({
  draft,
  locations = [],
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
      return found ? `${found.name}${site.ownTimes ? ' (own times)' : ''}` : null
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
        { label: 'Category', value: CATEGORY_OPTIONS.find((c) => c.value === draft.category)?.label, step: 0 },
        { label: 'Difficulty', value: draft.difficulty.charAt(0).toUpperCase() + draft.difficulty.slice(1), step: 0 },
        { label: 'Duration', value: draft.durationMinutes > 0 ? formatDuration(draft.durationMinutes) : 'Flexible', step: 0 },
        {
          label: 'Capacity',
          value:
            draft.maxCapacity > 0
              ? `${draft.minParticipants}–${draft.maxCapacity} guests · ages ${draft.minAge}+`
              : `From ${draft.minParticipants} ${pluralize(draft.minParticipants, 'guest')} · no seat limit · ages ${draft.minAge}+`,
          step: 0,
        },
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
        { label: 'Schedule', value: describeSchedule(draft.schedule), step: 4 },
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
        { label: 'Seats on sale', value: draft.schedule.capacity > 0 ? seats.toString() : 'No limit', icon: Users },
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
