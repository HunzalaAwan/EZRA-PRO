'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, type Variants } from 'motion/react'
import {
  Building2,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Compass,
  DollarSign,
  Globe2,
  Landmark,
  Mail,
  MapPin,
  Mountain,
  Palette,
  Plus,
  Rocket,
  Sparkles,
  Ticket,
  TreePalm,
  Trash2,
  Users,
  UsersRound,
  UtensilsCrossed,
  Waves,
  type LucideIcon,
  BedDouble,
} from 'lucide-react'
import { z } from 'zod'

import {
  addDays,
  cn,
  currencySymbol,
  formatCurrency,
  formatDateShort,
  formatDuration,
  initials,
  slugify,
  startOfWeek,
} from '@/lib/utils'
import { DURATION, EASE_OUT_EXPO } from '@/lib/motion'
import { NOW } from '@/lib/data/constants'
import { VERTICALS } from '@/lib/data/verticals'
import type { CurrencyCode, VerticalKey } from '@/types'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

/* ==========================================================================
   REFERENCE DATA
   Local to the wizard: these are the pickers a new tenant fills in once, not
   part of the domain model every other screen reads from.
   ========================================================================== */

const VERTICAL_ICONS: Record<string, LucideIcon> = {
  BedDouble,
  Waves,
  Compass,
  UtensilsCrossed,
  Mountain,
  Palmtree: TreePalm,
  Sparkles,
}

const COUNTRIES = [
  'Australia',
  'Bahamas',
  'Belize',
  'Canada',
  'Costa Rica',
  'Croatia',
  'Fiji',
  'France',
  'Greece',
  'Iceland',
  'Indonesia',
  'Italy',
  'Maldives',
  'Mexico',
  'New Zealand',
  'Norway',
  'Portugal',
  'Seychelles',
  'South Africa',
  'Spain',
  'Thailand',
  'United Kingdom',
  'United States',
] as const

const TIMEZONES: { value: string; label: string; region: string }[] = [
  { value: 'Pacific/Honolulu', label: 'Honolulu', region: 'Hawaii · UTC−10' },
  { value: 'America/Anchorage', label: 'Anchorage', region: 'Alaska · UTC−9' },
  { value: 'America/Los_Angeles', label: 'Los Angeles', region: 'US Pacific · UTC−8' },
  { value: 'America/Denver', label: 'Denver', region: 'US Mountain · UTC−7' },
  { value: 'America/Cancun', label: 'Cancún', region: 'Caribbean coast · UTC−5' },
  { value: 'America/New_York', label: 'New York', region: 'US Eastern · UTC−5' },
  { value: 'America/Costa_Rica', label: 'San José', region: 'Central America · UTC−6' },
  { value: 'Atlantic/Bermuda', label: 'Bermuda', region: 'Atlantic · UTC−4' },
  { value: 'Atlantic/Canary', label: 'Canary Islands', region: 'Atlantic · UTC+0' },
  { value: 'Europe/London', label: 'London', region: 'UK · UTC+0' },
  { value: 'Europe/Lisbon', label: 'Lisbon', region: 'Portugal · UTC+0' },
  { value: 'Europe/Madrid', label: 'Madrid', region: 'Central Europe · UTC+1' },
  { value: 'Europe/Rome', label: 'Rome', region: 'Central Europe · UTC+1' },
  { value: 'Europe/Athens', label: 'Athens', region: 'Eastern Europe · UTC+2' },
  { value: 'Africa/Johannesburg', label: 'Cape Town', region: 'South Africa · UTC+2' },
  { value: 'Indian/Mahe', label: 'Victoria', region: 'Seychelles · UTC+4' },
  { value: 'Indian/Maldives', label: 'Malé', region: 'Maldives · UTC+5' },
  { value: 'Asia/Bangkok', label: 'Bangkok', region: 'Thailand · UTC+7' },
  { value: 'Asia/Makassar', label: 'Bali', region: 'Indonesia · UTC+8' },
  { value: 'Australia/Brisbane', label: 'Brisbane', region: 'Queensland · UTC+10' },
  { value: 'Australia/Sydney', label: 'Sydney', region: 'Australia East · UTC+10' },
  { value: 'Pacific/Fiji', label: 'Suva', region: 'Fiji · UTC+12' },
  { value: 'Pacific/Auckland', label: 'Auckland', region: 'New Zealand · UTC+12' },
]

const CURRENCIES: { value: CurrencyCode; label: string }[] = [
  { value: 'USD', label: 'US Dollar' },
  { value: 'EUR', label: 'Euro' },
  { value: 'GBP', label: 'Pound Sterling' },
  { value: 'AUD', label: 'Australian Dollar' },
  { value: 'NZD', label: 'New Zealand Dollar' },
  { value: 'CAD', label: 'Canadian Dollar' },
]

const CURRENCY_CODES: CurrencyCode[] = CURRENCIES.map((entry) => entry.value)
const VERTICAL_KEYS: VerticalKey[] = VERTICALS.map((vertical) => vertical.key)

const INVITE_ROLES: { value: string; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Everything except billing' },
  { value: 'manager', label: 'Manager', description: 'Schedule, pricing and staff' },
  { value: 'staff', label: 'Front desk', description: 'Take bookings and check guests in' },
  { value: 'guide', label: 'Guide', description: 'Their own manifests, on mobile' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only reporting access' },
]

/** 0 = Monday, matching `startOfWeek` and the dashboard calendar grid. */
const WEEKDAYS = [
  { index: 0, short: 'Mon', long: 'Monday' },
  { index: 1, short: 'Tue', long: 'Tuesday' },
  { index: 2, short: 'Wed', long: 'Wednesday' },
  { index: 3, short: 'Thu', long: 'Thursday' },
  { index: 4, short: 'Fri', long: 'Friday' },
  { index: 5, short: 'Sat', long: 'Saturday' },
  { index: 6, short: 'Sun', long: 'Sunday' },
] as const

const BRAND_PRESETS = [
  { key: 'lagoon', label: 'Lagoon', value: 'var(--color-lagoon-500)', swatch: 'bg-lagoon-500' },
  { key: 'coral', label: 'Coral', value: 'var(--color-coral-500)', swatch: 'bg-coral-500' },
  { key: 'sunset', label: 'Sunset', value: 'var(--color-sunset-500)', swatch: 'bg-sunset-500' },
  { key: 'reef', label: 'Reef', value: 'var(--color-reef-500)', swatch: 'bg-reef-500' },
] as const

const BRAND_KEYS = [...BRAND_PRESETS.map((preset) => preset.key), 'custom'] as const

const HEX_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const DURATION_PRESETS = [45, 60, 90, 120, 180, 240]

/* ==========================================================================
   STATE
   ========================================================================== */

export interface OnboardingTimeRow {
  id: string
  value: string
}

export interface OnboardingInviteRow {
  id: string
  email: string
  role: string
}

/**
 * Everything the wizard collects. Unions (vertical, currency, colour, role)
 * are held as plain strings so a restored session can never blow up on a value
 * the build no longer recognises — the step schemas are what enforce them.
 */
export interface OnboardingData {
  business: {
    name: string
    legalName: string
    vertical: string
    country: string
    city: string
    timezone: string
    currency: string
  }
  branding: {
    logoText: string
    colorKey: string
    customHex: string
  }
  activity: {
    name: string
    duration: string
    capacity: string
    price: string
    description: string
  }
  availability: {
    weekdays: number[]
    startTimes: OnboardingTimeRow[]
  }
  team: {
    invites: OnboardingInviteRow[]
  }
}

const INITIAL_DATA: OnboardingData = {
  business: {
    name: '',
    legalName: '',
    vertical: '',
    country: '',
    city: '',
    timezone: '',
    currency: 'USD',
  },
  branding: { logoText: '', colorKey: 'lagoon', customHex: '' },
  activity: { name: '', duration: '120', capacity: '12', price: '', description: '' },
  availability: {
    weekdays: [0, 1, 2, 3, 4, 5],
    startTimes: [
      { id: 'time-a', value: '09:00' },
      { id: 'time-b', value: '14:00' },
    ],
  },
  team: { invites: [{ id: 'invite-a', email: '', role: 'manager' }] },
}

/** Row ids only ever come from event handlers, so a module counter is stable. */
let rowSequence = 0
function nextRowId(prefix: string) {
  rowSequence += 1
  return `${prefix}-${rowSequence}`
}

/* ==========================================================================
   PERSISTENCE
   ========================================================================== */

const STORAGE_KEY = 'ezra:onboarding:v1'
/** Written by `signup-form.tsx` so step one arrives pre-filled. */
const SEED_STORAGE_KEY = 'ezra:onboarding:seed:v1'

const persistedSchema = z.object({
  step: z.number().int().min(0).max(4),
  data: z.object({
    business: z.object({
      name: z.string(),
      legalName: z.string(),
      vertical: z.string(),
      country: z.string(),
      city: z.string(),
      timezone: z.string(),
      currency: z.string(),
    }),
    branding: z.object({
      logoText: z.string(),
      colorKey: z.string(),
      customHex: z.string(),
    }),
    activity: z.object({
      name: z.string(),
      duration: z.string(),
      capacity: z.string(),
      price: z.string(),
      description: z.string(),
    }),
    availability: z.object({
      weekdays: z.array(z.number().int().min(0).max(6)),
      startTimes: z.array(z.object({ id: z.string(), value: z.string() })),
    }),
    team: z.object({
      invites: z.array(z.object({ id: z.string(), email: z.string(), role: z.string() })),
    }),
  }),
})

const seedSchema = z.object({
  ownerName: z.string().optional(),
  ownerEmail: z.string().optional(),
  businessName: z.string().optional(),
  vertical: z.string().optional(),
})

/* ==========================================================================
   VALIDATION — one schema per step
   ========================================================================== */

/** A whole-number field held as a string, with its own copy. */
function wholeNumber(options: { required: string; invalid: string; min: number; max: number }) {
  return z
    .string()
    .trim()
    .min(1, options.required)
    .refine((value) => /^\d+$/.test(value), options.invalid)
    .refine((value) => {
      const parsed = Number(value)
      return parsed >= options.min && parsed <= options.max
    }, options.invalid)
}

const businessSchema = z.object({
  name: z.string().trim().min(2, 'Enter the name guests will recognise'),
  legalName: z.string().trim().min(2, 'Enter the registered entity that takes payment'),
  vertical: z.enum(VERTICAL_KEYS, 'Choose the option closest to what you run'),
  country: z.string().min(1, 'Select the country you operate in'),
  city: z.string().trim().min(2, 'Enter your main operating city'),
  timezone: z.string().min(1, 'Select the timezone departures run in'),
  currency: z.enum(CURRENCY_CODES, 'Select the currency you sell in'),
})

const brandingSchema = z
  .object({
    logoText: z
      .string()
      .trim()
      .min(2, 'Your storefront needs a name')
      .max(24, 'Keep it to 24 characters so it fits the header'),
    colorKey: z.enum(BRAND_KEYS, 'Pick a colour'),
    customHex: z.string(),
  })
  .refine(
    (value) => value.colorKey !== 'custom' || HEX_PATTERN.test(value.customHex.trim()),
    { error: 'Enter a hex value such as #0E9AA7', path: ['customHex'] },
  )

const activitySchema = z.object({
  name: z.string().trim().min(3, 'Give the experience a name guests will search for'),
  duration: wholeNumber({
    required: 'Enter how long it runs',
    invalid: 'Use a whole number between 15 and 1440 minutes',
    min: 15,
    max: 1440,
  }),
  capacity: wholeNumber({
    required: 'Enter how many guests fit',
    invalid: 'Use a whole number between 1 and 500',
    min: 1,
    max: 500,
  }),
  price: z
    .string()
    .trim()
    .min(1, 'Enter your headline price')
    .refine((value) => /^\d+(?:\.\d{1,2})?$/.test(value), 'Use a number such as 129 or 129.50')
    .refine((value) => Number(value) > 0, 'Price must be more than zero'),
  description: z
    .string()
    .trim()
    .min(24, 'Write at least a sentence — this is what sells the seat')
    .max(600, 'Keep it under 600 characters'),
})

const availabilitySchema = z
  .object({
    weekdays: z.array(z.number()).min(1, 'Select at least one day you run'),
    startTimes: z
      .array(z.object({ id: z.string(), value: z.string() }))
      .min(1, 'Add at least one departure time'),
  })
  .refine((value) => value.startTimes.every((row) => /^\d{2}:\d{2}$/.test(row.value)), {
    error: 'Every departure needs a valid time',
    path: ['startTimes'],
  })
  .refine(
    (value) => new Set(value.startTimes.map((row) => row.value)).size === value.startTimes.length,
    { error: 'Two departures share the same time', path: ['startTimes'] },
  )

const inviteEmail = z.email()

const teamSchema = z.object({
  invites: z
    .array(z.object({ id: z.string(), email: z.string(), role: z.string() }))
    .refine(
      (rows) =>
        rows.every((row) => row.email.trim() === '' || inviteEmail.safeParse(row.email.trim()).success),
      { error: 'One of these addresses is not a valid email', path: ['invites'] },
    ),
})

type StepErrors = Record<string, string>

/**
 * Structural rather than `z.ZodError<T>` so one helper can read the issues of
 * five differently-shaped schemas without a cast.
 */
interface IssueBag {
  readonly issues: readonly { readonly path: PropertyKey[]; readonly message: string }[]
}

function issuesToErrors(error: IssueBag): StepErrors {
  const result: StepErrors = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    const field = typeof key === 'string' ? key : '_form'
    if (!(field in result)) result[field] = issue.message
  }
  return result
}

function validateStep(step: number, data: OnboardingData): StepErrors {
  switch (step) {
    case 0: {
      const parsed = businessSchema.safeParse(data.business)
      return parsed.success ? {} : issuesToErrors(parsed.error)
    }
    case 1: {
      const parsed = brandingSchema.safeParse(data.branding)
      return parsed.success ? {} : issuesToErrors(parsed.error)
    }
    case 2: {
      const parsed = activitySchema.safeParse(data.activity)
      return parsed.success ? {} : issuesToErrors(parsed.error)
    }
    case 3: {
      const parsed = availabilitySchema.safeParse(data.availability)
      return parsed.success ? {} : issuesToErrors(parsed.error)
    }
    case 4: {
      const parsed = teamSchema.safeParse(data.team)
      return parsed.success ? {} : issuesToErrors(parsed.error)
    }
    default:
      return {}
  }
}

/* ==========================================================================
   DERIVED HELPERS
   ========================================================================== */

function resolveBrandColor(branding: OnboardingData['branding']): string {
  if (branding.colorKey === 'custom') {
    const hex = branding.customHex.trim()
    return HEX_PATTERN.test(hex) ? hex : 'var(--color-lagoon-500)'
  }
  const preset = BRAND_PRESETS.find((entry) => entry.key === branding.colorKey)
  return preset?.value ?? 'var(--color-lagoon-500)'
}

/** Custom properties the previews paint from. */
function brandStyle(color: string): React.CSSProperties {
  return {
    '--brand': color,
    '--brand-ink': `color-mix(in oklab, ${color} 14%, var(--color-ink-50))`,
    '--brand-soft': `color-mix(in oklab, ${color} 12%, transparent)`,
    '--brand-line': `color-mix(in oklab, ${color} 32%, transparent)`,
  } as React.CSSProperties
}

function asCurrency(value: string): CurrencyCode {
  return (CURRENCY_CODES as string[]).includes(value) ? (value as CurrencyCode) : 'USD'
}

function verticalIcon(key: string): LucideIcon {
  const vertical = VERTICALS.find((entry) => entry.key === key)
  return (vertical && VERTICAL_ICONS[vertical.icon]) || Sparkles
}

/* ==========================================================================
   STEP DEFINITIONS
   ========================================================================== */

const STEPS = [
  {
    id: 'business',
    label: 'Business',
    title: 'Tell us who you are',
    blurb: 'This sets your invoices, tax handling and the clock every departure runs on.',
    icon: Building2,
  },
  {
    id: 'branding',
    label: 'Branding',
    title: 'Make the storefront yours',
    blurb: 'Guests should never feel handed off to someone else’s booking page.',
    icon: Palette,
  },
  {
    id: 'activity',
    label: 'First activity',
    title: 'Add your first experience',
    blurb: 'One is enough to go live. Everything here can be edited later.',
    icon: Ticket,
  },
  {
    id: 'availability',
    label: 'Availability',
    title: 'When does it run?',
    blurb: 'We generate departures from this pattern and keep them stocked.',
    icon: CalendarClock,
  },
  {
    id: 'team',
    label: 'Team',
    title: 'Bring your crew in',
    blurb: 'Invite now or later — you can run the whole season on your own.',
    icon: UsersRound,
  },
] as const

const LAUNCH_TASKS = [
  'Creating your workspace',
  'Publishing your first experience',
  'Generating this week’s departures',
  'Opening your dashboard',
] as const

/* ==========================================================================
   PROGRESS RAIL
   ========================================================================== */

interface StepRailProps {
  current: number
  furthest: number
  onSelect: (index: number) => void
}

function StepRail({ current, furthest, onSelect }: StepRailProps) {
  const reducedMotion = useReducedMotionSafe()

  return (
    <nav aria-label="Setup progress">
      <ol className="flex items-start gap-1.5 sm:gap-2.5">
        {STEPS.map((step, index) => {
          const complete = index < current
          const active = index === current
          const reachable = index <= furthest

          return (
            <li key={step.id} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => reachable && onSelect(index)}
                disabled={!reachable}
                aria-current={active ? 'step' : undefined}
                className={cn(
                  'group/step w-full rounded-lg text-left',
                  'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background',
                  reachable ? 'cursor-pointer' : 'cursor-not-allowed',
                )}
              >
                <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                  <motion.span
                    className={cn(
                      'absolute inset-0 origin-left rounded-full',
                      complete ? 'bg-primary' : 'bg-primary/70',
                    )}
                    initial={false}
                    animate={{ scaleX: complete ? 1 : active ? 0.45 : 0 }}
                    transition={
                      reducedMotion ? { duration: 0 } : { duration: DURATION.slow, ease: EASE_OUT_EXPO }
                    }
                  />
                </span>

                <span className="mt-2.5 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ease-[var(--ease-out-expo)]',
                      complete
                        ? 'bg-primary text-on-primary'
                        : active
                          ? 'bg-primary-soft text-primary ring-1 ring-primary/40'
                          : 'bg-surface-sunken text-faint',
                    )}
                  >
                    {complete ? <Check className="size-3" strokeWidth={3} /> : index + 1}
                  </span>
                  <span
                    className={cn(
                      'hidden truncate text-xs font-medium transition-colors duration-200 sm:inline',
                      active ? 'text-foreground' : complete ? 'text-muted' : 'text-faint',
                    )}
                  >
                    {step.label}
                  </span>
                </span>

                <span className="sr-only">
                  {`Step ${index + 1}: ${step.label}${complete ? ' (complete)' : active ? ' (current)' : ''}`}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ==========================================================================
   STEP 1 — BUSINESS
   ========================================================================== */

interface StepProps {
  data: OnboardingData
  errors: StepErrors
  onChange: (next: OnboardingData) => void
  touch: (field: string) => void
}

function BusinessStep({ data, errors, onChange, touch }: StepProps) {
  const value = data.business

  function set<K extends keyof OnboardingData['business']>(
    key: K,
    next: OnboardingData['business'][K],
  ) {
    onChange({ ...data, business: { ...value, [key]: next } })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Trading name" error={errors.name} required>
          {(control) => (
            <Input
              {...control}
              size="lg"
              placeholder="Blue Horizon Watersports"
              leftIcon={<Building2 />}
              value={value.name}
              onBlur={() => touch('name')}
              onChange={(event) => set('name', event.target.value)}
            />
          )}
        </Field>

        <Field
          label="Legal entity"
          error={errors.legalName}
          required
          description="Appears on invoices and payouts."
        >
          {(control) => (
            <Input
              {...control}
              size="lg"
              placeholder="Blue Horizon Marine Ltd."
              leftIcon={<Landmark />}
              value={value.legalName}
              onBlur={() => touch('legalName')}
              onChange={(event) => set('legalName', event.target.value)}
            />
          )}
        </Field>
      </div>

      <fieldset className="min-w-0">
        <legend className="text-[0.8125rem] leading-none font-medium text-foreground">
          Industry
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
          <span className="sr-only">(required)</span>
        </legend>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Sets your activity templates, waiver defaults and the fields on your manifest.
        </p>

        <RadioGroup
          className="mt-3 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3"
          value={value.vertical}
          aria-invalid={errors.vertical ? true : undefined}
          onValueChange={(next) => {
            set('vertical', next)
            touch('vertical')
          }}
        >
          {VERTICALS.map((vertical) => {
            const Icon = VERTICAL_ICONS[vertical.icon] ?? Sparkles
            return (
              <RadioGroupCard
                key={vertical.key}
                value={vertical.key}
                label={vertical.label}
                description={vertical.sampleActivities[0]}
                icon={<Icon aria-hidden="true" />}
                className="p-3.5"
              />
            )
          })}
        </RadioGroup>

        {errors.vertical ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-danger animate-in-up">
            <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            {errors.vertical}
          </p>
        ) : null}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Country" error={errors.country} required>
          {(control) => (
            <Select
              value={value.country}
              onValueChange={(next) => {
                set('country', next)
                touch('country')
              }}
            >
              <SelectTrigger {...control} size="lg" icon={<Globe2 />} error={errors.country}>
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>

        <Field label="City" error={errors.city} required>
          {(control) => (
            <Input
              {...control}
              size="lg"
              placeholder="Kailua-Kona"
              leftIcon={<MapPin />}
              value={value.city}
              onBlur={() => touch('city')}
              onChange={(event) => set('city', event.target.value)}
            />
          )}
        </Field>

        <Field
          label="Timezone"
          error={errors.timezone}
          required
          description="Every departure time you enter is local to this."
        >
          {(control) => (
            <Select
              value={value.timezone}
              onValueChange={(next) => {
                set('timezone', next)
                touch('timezone')
              }}
            >
              <SelectTrigger {...control} size="lg" icon={<Clock />} error={errors.timezone}>
                <SelectValue placeholder="Select a timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((zone) => (
                  <SelectItem key={zone.value} value={zone.value} description={zone.region}>
                    {zone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>

        <Field
          label="Currency"
          error={errors.currency}
          required
          description="What guests are charged in at checkout."
        >
          {(control) => (
            <Select
              value={value.currency}
              onValueChange={(next) => {
                set('currency', next)
                touch('currency')
              }}
            >
              <SelectTrigger {...control} size="lg" icon={<DollarSign />} error={errors.currency}>
                <SelectValue placeholder="Select a currency" />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((currency) => (
                  <SelectItem
                    key={currency.value}
                    value={currency.value}
                    description={currency.label}
                  >
                    {`${currency.value} · ${currencySymbol(currency.value)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
    </div>
  )
}

/* ==========================================================================
   STEP 2 — BRANDING
   ========================================================================== */

function StorefrontPreview({ data }: { data: OnboardingData }) {
  const color = resolveBrandColor(data.branding)
  const name = data.branding.logoText.trim() || data.business.name.trim() || 'Your storefront'
  const city = data.business.city.trim() || 'your harbour'
  const slug = slugify(data.business.name || name) || 'your-business'

  return (
    <div
      style={brandStyle(color)}
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lg"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-3 border-b border-line-subtle bg-surface-sunken px-3.5 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-surface px-2.5 py-1 text-xs text-faint">
          book.ezra.pro/{slug}
        </span>
      </div>

      {/* Storefront header */}
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle bg-surface px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            {initials(name)}
          </span>
          <span className="truncate font-display text-sm font-semibold tracking-[-0.02em] text-foreground">
            {name}
          </span>
        </div>

        <nav aria-hidden="true" className="hidden items-center gap-4 text-xs text-muted sm:flex">
          <span>Experiences</span>
          <span>Gift cards</span>
          <span>Contact</span>
        </nav>

        <span
          aria-hidden="true"
          className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold"
          style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
        >
          Book now
        </span>
      </div>

      {/* Hero strip */}
      <div
        className="relative overflow-hidden px-5 py-7"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in oklab, var(--brand) 20%, var(--surface)) 0%, var(--surface) 65%)',
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-12 -right-10 size-40 rounded-full blur-2xl"
          style={{ background: 'var(--brand)', opacity: 0.22 }}
        />
        <p
          className="relative text-xs font-semibold tracking-[0.14em] uppercase"
          style={{ color: 'var(--brand)' }}
        >
          Book direct
        </p>
        <p className="relative mt-2 max-w-[22rem] font-display text-lg leading-tight font-semibold tracking-[-0.025em] text-balance text-foreground">
          Experiences in {city}, straight from the people who run them.
        </p>
        <div className="relative mt-4 flex items-center gap-2">
          <span
            aria-hidden="true"
            className="rounded-lg px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            See availability
          </span>
          <span
            aria-hidden="true"
            className="rounded-lg border px-3 py-1.5 text-xs font-medium text-muted"
            style={{ borderColor: 'var(--brand-line)' }}
          >
            Gift a trip
          </span>
        </div>
      </div>
    </div>
  )
}

function BrandingStep({ data, errors, onChange, touch }: StepProps) {
  const value = data.branding

  function set<K extends keyof OnboardingData['branding']>(
    key: K,
    next: OnboardingData['branding'][K],
  ) {
    onChange({ ...data, branding: { ...value, [key]: next } })
  }

  const customValid = HEX_PATTERN.test(value.customHex.trim())

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8">
      <div className="flex flex-col gap-5">
        <Field
          label="Storefront name"
          error={errors.logoText}
          required
          hint={`${value.logoText.length}/24`}
          description="What guests see in the header and on their confirmation email."
        >
          {(control) => (
            <Input
              {...control}
              size="lg"
              maxLength={24}
              placeholder={data.business.name || 'Blue Horizon'}
              value={value.logoText}
              onBlur={() => touch('logoText')}
              onChange={(event) => set('logoText', event.target.value)}
            />
          )}
        </Field>

        <fieldset className="min-w-0">
          <legend className="text-[0.8125rem] leading-none font-medium text-foreground">
            Primary colour
          </legend>
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            Used for buttons, availability highlights and your confirmation emails.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {BRAND_PRESETS.map((preset) => {
              const selected = value.colorKey === preset.key
              return (
                <button
                  key={preset.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => set('colorKey', preset.key)}
                  className={cn(
                    'group/swatch flex items-center gap-2.5 rounded-xl border p-2.5 text-left',
                    'transition-all duration-200 ease-[var(--ease-out-expo)]',
                    'focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-primary/25',
                    selected
                      ? 'border-primary bg-primary-soft/40 shadow-[0_8px_22px_-14px_color-mix(in_oklab,var(--primary)_80%,transparent)]'
                      : 'border-line bg-surface hover:border-line-strong hover:shadow-sm',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-lg shadow-xs transition-transform duration-200 ease-[var(--ease-spring)]',
                      preset.swatch,
                      selected ? 'scale-100' : 'scale-95 group-hover/swatch:scale-100',
                    )}
                  >
                    <Check
                      className={cn(
                        'size-3.5 text-ink-50 transition-opacity duration-200',
                        selected ? 'opacity-100' : 'opacity-0',
                      )}
                      strokeWidth={3}
                    />
                  </span>
                  <span className="truncate text-xs font-medium text-foreground">
                    {preset.label}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-2.5 flex flex-col gap-2.5 rounded-xl border border-line bg-surface-sunken/60 p-3 sm:flex-row sm:items-center">
            <button
              type="button"
              aria-pressed={value.colorKey === 'custom'}
              onClick={() => set('colorKey', 'custom')}
              className={cn(
                'flex shrink-0 items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs font-medium',
                'transition-colors duration-200 focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-primary/25',
                value.colorKey === 'custom'
                  ? 'bg-primary-soft text-primary'
                  : 'text-muted hover:text-foreground',
              )}
            >
              <span
                aria-hidden="true"
                className="size-5 rounded-md border border-line-strong shadow-xs"
                style={{
                  background: customValid
                    ? value.customHex.trim()
                    : 'repeating-linear-gradient(45deg, var(--surface) 0 4px, var(--surface-sunken) 4px 8px)',
                }}
              />
              Custom hex
            </button>

            <div className="min-w-0 flex-1">
              <label htmlFor="onboarding-custom-hex" className="sr-only">
                Custom brand colour, as a hex value
              </label>
              <Input
                id="onboarding-custom-hex"
                size="sm"
                placeholder="#0E9AA7"
                spellCheck={false}
                autoCapitalize="none"
                maxLength={7}
                value={value.customHex}
                error={value.colorKey === 'custom' ? errors.customHex : undefined}
                onBlur={() => touch('customHex')}
                onChange={(event) => {
                  const next = event.target.value
                  onChange({
                    ...data,
                    branding: { ...value, customHex: next, colorKey: 'custom' },
                  })
                }}
              />
            </div>
          </div>

          {value.colorKey === 'custom' && errors.customHex ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-danger animate-in-up">
              <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
              {errors.customHex}
            </p>
          ) : null}
        </fieldset>
      </div>

      <div className="min-w-0">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-faint uppercase">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
          Live preview
        </p>
        <StorefrontPreview data={data} />
      </div>
    </div>
  )
}

/* ==========================================================================
   STEP 3 — FIRST ACTIVITY
   ========================================================================== */

function ActivityPreview({ data }: { data: OnboardingData }) {
  const color = resolveBrandColor(data.branding)
  const currency = asCurrency(data.business.currency)
  const Icon = verticalIcon(data.business.vertical)

  const name = data.activity.name.trim() || 'Your first experience'
  const description =
    data.activity.description.trim() ||
    'Add a description and guests will see it right here, exactly as written.'
  const minutes = Number(data.activity.duration)
  const capacity = Number(data.activity.capacity)
  const price = Number(data.activity.price)

  return (
    <div
      style={brandStyle(color)}
      className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lg"
    >
      <div
        className="relative flex h-32 items-center justify-center"
        style={{
          background:
            'linear-gradient(135deg, color-mix(in oklab, var(--brand) 78%, var(--color-ink-950)) 0%, color-mix(in oklab, var(--brand) 34%, var(--color-ink-950)) 100%)',
        }}
      >
        <Icon aria-hidden="true" className="size-9 text-ink-50/70" strokeWidth={1.5} />
        <span className="absolute bottom-2.5 left-3 rounded-md bg-ink-950/45 px-2 py-1 text-xs font-medium tracking-wide text-ink-50/80 uppercase backdrop-blur-sm">
          Add photos before you go live
        </span>
      </div>

      <div className="p-4">
        <h4 className="truncate font-display text-[0.9375rem] font-semibold tracking-[-0.02em] text-foreground">
          {name}
        </h4>
        <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted">{description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-muted">
            <Clock aria-hidden="true" className="size-3" />
            {Number.isFinite(minutes) && minutes > 0 ? formatDuration(minutes) : '—'}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-muted">
            <Users aria-hidden="true" className="size-3" />
            {Number.isFinite(capacity) && capacity > 0 ? `Up to ${capacity}` : '—'}
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-line-subtle pt-3.5">
          <div className="min-w-0">
            <p className="font-display text-lg leading-none font-semibold tracking-[-0.025em] text-foreground tabular">
              {Number.isFinite(price) && price > 0
                ? formatCurrency(Math.round(price * 100), currency)
                : '—'}
            </p>
            <p className="mt-1 text-xs text-faint">per guest</p>
          </div>
          <span
            aria-hidden="true"
            className="shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold"
            style={{ background: 'var(--brand)', color: 'var(--brand-ink)' }}
          >
            Check dates
          </span>
        </div>
      </div>
    </div>
  )
}

function ActivityStep({ data, errors, onChange, touch }: StepProps) {
  const value = data.activity
  const currency = asCurrency(data.business.currency)
  const suggestions = VERTICALS.find((entry) => entry.key === data.business.vertical)?.sampleActivities

  function set<K extends keyof OnboardingData['activity']>(
    key: K,
    next: OnboardingData['activity'][K],
  ) {
    onChange({ ...data, activity: { ...value, [key]: next } })
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-8">
      <div className="flex flex-col gap-5">
        <Field label="Experience name" error={errors.name} required>
          {(control) => (
            <Input
              {...control}
              size="lg"
              placeholder={suggestions?.[0] ?? 'Sunset Catamaran Sail'}
              leftIcon={<Ticket />}
              value={value.name}
              onBlur={() => touch('name')}
              onChange={(event) => set('name', event.target.value)}
            />
          )}
        </Field>

        {suggestions && suggestions.length > 0 ? (
          <div className="-mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-faint">Common for you:</span>
            {suggestions.slice(0, 3).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => {
                  set('name', suggestion)
                  touch('name')
                }}
                className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-muted transition-all duration-200 hover:border-primary/50 hover:bg-primary-soft/50 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Duration" error={errors.duration} required>
            {(control) => (
              <Input
                {...control}
                size="lg"
                type="number"
                inputMode="numeric"
                min={15}
                max={1440}
                step={5}
                placeholder="120"
                suffix="min"
                value={value.duration}
                onBlur={() => touch('duration')}
                onChange={(event) => set('duration', event.target.value)}
              />
            )}
          </Field>

          <Field label="Capacity" error={errors.capacity} required>
            {(control) => (
              <Input
                {...control}
                size="lg"
                type="number"
                inputMode="numeric"
                min={1}
                max={500}
                placeholder="12"
                suffix="guests"
                value={value.capacity}
                onBlur={() => touch('capacity')}
                onChange={(event) => set('capacity', event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="-mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-faint">Duration presets:</span>
          {DURATION_PRESETS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              aria-pressed={value.duration === String(minutes)}
              onClick={() => {
                set('duration', String(minutes))
                touch('duration')
              }}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-all duration-200',
                'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
                value.duration === String(minutes)
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
              )}
            >
              {formatDuration(minutes)}
            </button>
          ))}
        </div>

        <Field
          label="Base price"
          error={errors.price}
          required
          description="Your headline adult price. Add child, senior and private tiers later."
        >
          {(control) => (
            <Input
              {...control}
              size="lg"
              inputMode="decimal"
              placeholder="129"
              leftIcon={<span className="text-sm font-medium">{currencySymbol(currency)}</span>}
              suffix={currency}
              value={value.price}
              onBlur={() => touch('price')}
              onChange={(event) => set('price', event.target.value)}
            />
          )}
        </Field>

        <Field
          label="Description"
          error={errors.description}
          required
          hint={`${value.description.length}/600`}
          description="Two or three sentences. What happens, what is included, why it is worth it."
        >
          {(control) => (
            <Textarea
              {...control}
              size="lg"
              maxLength={600}
              placeholder="Sail out as the light drops, anchor off the reef and watch the sun go down with a drink in hand. Crewed by skippers who have run this stretch of coast for a decade."
              value={value.description}
              onBlur={() => touch('description')}
              onChange={(event) => set('description', event.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="min-w-0">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-faint uppercase">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
          How guests will see it
        </p>
        <ActivityPreview data={data} />
      </div>
    </div>
  )
}

/* ==========================================================================
   STEP 4 — AVAILABILITY
   ========================================================================== */

function AvailabilityStep({ data, errors, onChange, touch }: StepProps) {
  const value = data.availability
  const reducedMotion = useReducedMotionSafe()

  const capacity = Number(data.activity.capacity)
  const seatCount = Number.isFinite(capacity) && capacity > 0 ? capacity : 0

  const validTimes = value.startTimes
    .map((row) => row.value)
    .filter((time) => /^\d{2}:\d{2}$/.test(time))
    .sort()

  const departuresPerWeek = value.weekdays.length * validTimes.length
  const seatsPerWeek = departuresPerWeek * seatCount

  /** Next Monday from the demo clock — a real date, not a placeholder. */
  const weekStart = startOfWeek(addDays(NOW, 7))

  function setAvailability(next: OnboardingData['availability']) {
    onChange({ ...data, availability: next })
  }

  function toggleWeekday(index: number) {
    const weekdays = value.weekdays.includes(index)
      ? value.weekdays.filter((day) => day !== index)
      : [...value.weekdays, index].sort((a, b) => a - b)
    setAvailability({ ...value, weekdays })
    touch('weekdays')
  }

  function updateTime(id: string, next: string) {
    setAvailability({
      ...value,
      startTimes: value.startTimes.map((row) => (row.id === id ? { ...row, value: next } : row)),
    })
  }

  function addTime() {
    setAvailability({
      ...value,
      startTimes: [...value.startTimes, { id: nextRowId('time'), value: '' }],
    })
  }

  function removeTime(id: string) {
    setAvailability({ ...value, startTimes: value.startTimes.filter((row) => row.id !== id) })
    touch('startTimes')
  }

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="min-w-0">
        <legend className="text-[0.8125rem] leading-none font-medium text-foreground">
          Days you run
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
          <span className="sr-only">(required)</span>
        </legend>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Blackout dates, seasons and one-off closures come later — this is the normal week.
        </p>

        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {WEEKDAYS.map((day) => {
            const on = value.weekdays.includes(day.index)
            return (
              <button
                key={day.index}
                type="button"
                aria-pressed={on}
                onClick={() => toggleWeekday(day.index)}
                className={cn(
                  'h-11 rounded-xl border text-sm font-medium',
                  'transition-all duration-200 ease-[var(--ease-out-expo)]',
                  'focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-primary/25',
                  on
                    ? 'border-primary bg-primary text-on-primary shadow-[0_8px_20px_-12px_color-mix(in_oklab,var(--primary)_85%,transparent)]'
                    : 'border-line bg-surface text-subtle hover:border-line-strong hover:text-foreground',
                )}
              >
                <span className="sr-only">{day.long}</span>
                <span aria-hidden="true">{day.short}</span>
              </button>
            )
          })}
        </div>

        {errors.weekdays ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-danger animate-in-up">
            <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            {errors.weekdays}
          </p>
        ) : null}
      </fieldset>

      <div className="min-w-0">
        <p className="text-[0.8125rem] leading-none font-medium text-foreground">
          Departure times
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
          <span className="sr-only">(required)</span>
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Each time runs on every selected day. Local to{' '}
          {data.business.timezone || 'your chosen timezone'}.
        </p>

        <ul className="mt-3 flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {value.startTimes.map((row, index) => (
              <motion.li
                key={row.id}
                initial={reducedMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={reducedMotion ? { duration: 0 } : { duration: DURATION.quick, ease: EASE_OUT_EXPO }}
                className="flex items-center gap-2.5"
              >
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-xs font-semibold text-subtle tabular"
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <label htmlFor={`departure-time-${row.id}`} className="sr-only">
                    {`Departure time ${index + 1}`}
                  </label>
                  <Input
                    id={`departure-time-${row.id}`}
                    type="time"
                    size="lg"
                    value={row.value}
                    onBlur={() => touch('startTimes')}
                    onChange={(event) => updateTime(row.id, event.target.value)}
                  />
                </div>

                <IconButton
                  type="button"
                  size="lg"
                  variant="ghost"
                  aria-label={`Remove departure time ${index + 1}`}
                  disabled={value.startTimes.length <= 1}
                  onClick={() => removeTime(row.id)}
                  className="shrink-0 hover:text-danger"
                >
                  <Trash2 aria-hidden="true" />
                </IconButton>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          leftIcon={<Plus />}
          disabled={value.startTimes.length >= 12}
          onClick={addTime}
        >
          Add a departure time
        </Button>

        {errors.startTimes ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-danger animate-in-up">
            <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            {errors.startTimes}
          </p>
        ) : null}
      </div>

      {/* ---------- Generated week ---------- */}
      <div className="rounded-2xl border border-line bg-surface-sunken/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-faint uppercase">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
              Week of {formatDateShort(weekStart)}
            </p>
            <p className="mt-2 font-display text-lg leading-none font-semibold tracking-[-0.025em] text-foreground tabular">
              {departuresPerWeek} departures
              <span className="ml-2 text-sm font-normal text-muted">
                {seatsPerWeek > 0 ? `· ${seatsPerWeek} seats` : ''}
              </span>
            </p>
          </div>
          <p className="max-w-[18rem] text-xs leading-relaxed text-muted">
            We keep generating these 90 days ahead so guests can always book the next trip.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {WEEKDAYS.map((day) => {
            const on = value.weekdays.includes(day.index)
            const date = addDays(weekStart, day.index)

            return (
              <div
                key={day.index}
                className={cn(
                  'min-w-0 rounded-xl border p-2.5 transition-colors duration-300',
                  on ? 'border-line bg-surface' : 'border-line-subtle bg-transparent',
                )}
              >
                <p
                  className={cn(
                    'text-xs font-semibold',
                    on ? 'text-foreground' : 'text-faint',
                  )}
                >
                  {day.short}
                </p>
                <p className="mt-0.5 text-xs text-faint tabular">
                  {formatDateShort(date)}
                </p>

                <div className="mt-2 flex flex-col gap-1">
                  {on && validTimes.length > 0 ? (
                    validTimes.map((time) => (
                      <span
                        key={time}
                        className="rounded-md bg-primary-soft px-1.5 py-1 text-center text-xs font-medium text-primary tabular"
                      >
                        {time}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-md border border-dashed border-line px-1.5 py-1 text-center text-xs text-faint">
                      Closed
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   STEP 5 — TEAM
   ========================================================================== */

function TeamStep({ data, errors, onChange, touch }: StepProps) {
  const value = data.team
  const reducedMotion = useReducedMotionSafe()

  const currency = asCurrency(data.business.currency)
  const price = Number(data.activity.price)
  const capacity = Number(data.activity.capacity)
  const validTimes = data.availability.startTimes.filter((row) => /^\d{2}:\d{2}$/.test(row.value))
  const departures = data.availability.weekdays.length * validTimes.length

  function setInvites(invites: OnboardingInviteRow[]) {
    onChange({ ...data, team: { invites } })
  }

  function updateInvite(id: string, patch: Partial<OnboardingInviteRow>) {
    setInvites(value.invites.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  }

  const summary = [
    { label: 'Workspace', value: data.business.name || '—' },
    {
      label: 'Storefront',
      value: `book.ezra.pro/${slugify(data.business.name) || 'your-business'}`,
    },
    { label: 'First experience', value: data.activity.name || '—' },
    {
      label: 'Launch price',
      value:
        Number.isFinite(price) && price > 0
          ? `${formatCurrency(Math.round(price * 100), currency)} · up to ${Number.isFinite(capacity) ? capacity : 0} guests`
          : '—',
    },
    { label: 'Weekly departures', value: `${departures} across ${data.availability.weekdays.length} days` },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="min-w-0">
        <p className="text-[0.8125rem] leading-none font-medium text-foreground">
          Invite your team
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          Optional. Leave it blank and launch on your own — you can invite anyone from Settings
          later.
        </p>

        <ul className="mt-3 flex flex-col gap-2.5">
          <AnimatePresence initial={false}>
            {value.invites.map((row, index) => (
              <motion.li
                key={row.id}
                initial={reducedMotion ? false : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={reducedMotion ? { duration: 0 } : { duration: DURATION.quick, ease: EASE_OUT_EXPO }}
                className="flex flex-col gap-2.5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <label htmlFor={`invite-email-${row.id}`} className="sr-only">
                    {`Team member ${index + 1} email address`}
                  </label>
                  <Input
                    id={`invite-email-${row.id}`}
                    type="email"
                    inputMode="email"
                    size="lg"
                    placeholder="crew@yourcompany.com"
                    leftIcon={<Mail />}
                    value={row.email}
                    onBlur={() => touch('invites')}
                    onChange={(event) => updateInvite(row.id, { email: event.target.value })}
                  />
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
                    <label htmlFor={`invite-role-${row.id}`} className="sr-only">
                      {`Team member ${index + 1} role`}
                    </label>
                    <Select
                      value={row.role}
                      onValueChange={(next) => updateInvite(row.id, { role: next })}
                    >
                      <SelectTrigger id={`invite-role-${row.id}`} size="lg">
                        <SelectValue placeholder="Role" />
                      </SelectTrigger>
                      <SelectContent width="auto">
                        {INVITE_ROLES.map((role) => (
                          <SelectItem
                            key={role.value}
                            value={role.value}
                            description={role.description}
                          >
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <IconButton
                    type="button"
                    size="lg"
                    variant="ghost"
                    aria-label={`Remove team member ${index + 1}`}
                    disabled={value.invites.length <= 1}
                    onClick={() => setInvites(value.invites.filter((entry) => entry.id !== row.id))}
                    className="shrink-0 hover:text-danger"
                  >
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          leftIcon={<Plus />}
          disabled={value.invites.length >= 10}
          onClick={() =>
            setInvites([...value.invites, { id: nextRowId('invite'), email: '', role: 'staff' }])
          }
        >
          Add another
        </Button>

        {errors.invites ? (
          <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-danger animate-in-up">
            <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            {errors.invites}
          </p>
        ) : null}
      </div>

      {/* ---------- Recap ---------- */}
      <div className="rounded-2xl border border-line bg-surface-sunken/50 p-4 sm:p-5">
        <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.1em] text-faint uppercase">
          <Rocket aria-hidden="true" className="size-3.5" />
          About to go live
        </p>
        <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {summary.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-xs text-faint">{item.label}</dt>
              <dd className="mt-0.5 truncate text-[0.8125rem] font-medium text-foreground">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

/* ==========================================================================
   LAUNCH PANEL
   ========================================================================== */

function LaunchPanel({ progress }: { progress: number }) {
  const reducedMotion = useReducedMotionSafe()

  return (
    <div className="flex flex-col items-center py-10 text-center">
      <span
        aria-hidden="true"
        className="relative flex size-16 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-[0_18px_40px_-18px_color-mix(in_oklab,var(--primary)_90%,transparent)]"
      >
        <Rocket className="size-7" />
        {!reducedMotion ? (
          <span className="absolute inset-0 animate-pulse-ring rounded-2xl border-2 border-primary" />
        ) : null}
      </span>

      <h3 className="mt-6 font-display text-xl font-semibold tracking-[-0.025em] text-foreground">
        Launching your storefront
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
        Hang on a moment. We are wiring up availability, checkout and your first departures.
      </p>

      <ul className="mt-7 flex w-full max-w-xs flex-col gap-2.5" aria-live="polite">
        {LAUNCH_TASKS.map((task, index) => {
          const done = index < progress
          const active = index === progress

          return (
            <li
              key={task}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[0.8125rem] transition-all duration-300 ease-[var(--ease-out-expo)]',
                done
                  ? 'bg-success-soft/50 text-foreground'
                  : active
                    ? 'bg-surface-sunken text-foreground'
                    : 'text-faint',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'flex size-4.5 shrink-0 items-center justify-center rounded-full border transition-colors duration-300',
                  done
                    ? 'border-success bg-success text-background'
                    : active
                      ? 'border-primary'
                      : 'border-line-strong',
                )}
              >
                {done ? (
                  <Check className="size-2.5" strokeWidth={3.5} />
                ) : active && !reducedMotion ? (
                  <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                ) : null}
              </span>
              {task}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ==========================================================================
   WIZARD
   ========================================================================== */

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction >= 0 ? 56 : -56,
    opacity: 0,
    filter: 'blur(6px)',
  }),
  center: { x: 0, opacity: 1, filter: 'blur(0px)' },
  exit: (direction: number) => ({
    x: direction >= 0 ? -56 : 56,
    opacity: 0,
    filter: 'blur(6px)',
  }),
}

export interface OnboardingWizardProps extends React.ComponentProps<'div'> {
  /** Where "Launch my storefront" lands. */
  redirectTo?: string
}

/**
 * Five steps between a signed-up operator and a live storefront.
 *
 * State lives in one object, mirrored into sessionStorage on every change so a
 * refresh mid-setup costs nothing. Each step validates through its own zod
 * schema; Continue stays disabled until that schema passes, and the same check
 * runs on Enter so the whole flow is reachable from the keyboard alone.
 */
export function OnboardingWizard({
  redirectTo = '/dashboard',
  className,
  ...props
}: OnboardingWizardProps) {
  const router = useRouter()
  const reducedMotion = useReducedMotionSafe()

  const [step, setStep] = React.useState(0)
  const [furthest, setFurthest] = React.useState(0)
  const [direction, setDirection] = React.useState(1)
  const [data, setData] = React.useState<OnboardingData>(INITIAL_DATA)
  const [touched, setTouched] = React.useState<Record<string, boolean>>({})
  const [attempted, setAttempted] = React.useState(false)
  const [restored, setRestored] = React.useState(false)
  const [launching, setLaunching] = React.useState(false)
  const [launchProgress, setLaunchProgress] = React.useState(0)

  /** Set when navigating, consumed by the next heading's ref callback. */
  const focusNextHeading = React.useRef(false)

  /* ---------- Restore ---------- */
  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = persistedSchema.safeParse(JSON.parse(raw))
        if (parsed.success) {
          setData(parsed.data.data)
          setStep(parsed.data.step)
          setFurthest(parsed.data.step)
          setRestored(true)
          return
        }
      }

      const seedRaw = window.sessionStorage.getItem(SEED_STORAGE_KEY)
      if (seedRaw) {
        const seed = seedSchema.safeParse(JSON.parse(seedRaw))
        if (seed.success) {
          setData((current) => ({
            ...current,
            business: {
              ...current.business,
              name: seed.data.businessName ?? current.business.name,
              vertical: seed.data.vertical ?? current.business.vertical,
            },
            branding: {
              ...current.branding,
              logoText: (seed.data.businessName ?? '').slice(0, 24),
            },
          }))
        }
      }
    } catch {
      // Storage unavailable (private mode, blocked cookies) — start clean.
    }
    setRestored(true)
  }, [])

  /* ---------- Persist ---------- */
  React.useEffect(() => {
    if (!restored) return
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ step, data }))
    } catch {
      // Quota or private mode — persistence is a convenience, never a blocker.
    }
  }, [restored, step, data])

  /* ---------- Validation ---------- */
  const allErrors = React.useMemo(() => validateStep(step, data), [step, data])
  const stepValid = Object.keys(allErrors).length === 0

  const visibleErrors = React.useMemo(() => {
    if (attempted) return allErrors
    const result: StepErrors = {}
    for (const [field, message] of Object.entries(allErrors)) {
      if (touched[`${step}:${field}`]) result[field] = message
    }
    return result
  }, [allErrors, attempted, step, touched])

  const touch = React.useCallback(
    (field: string) => {
      setTouched((current) => ({ ...current, [`${step}:${field}`]: true }))
    },
    [step],
  )

  /* ---------- Navigation ---------- */
  const goTo = React.useCallback(
    (next: number) => {
      setDirection(next >= step ? 1 : -1)
      setStep(next)
      setFurthest((current) => Math.max(current, next))
      setAttempted(false)
      // `mode="wait"` mounts the next panel only after the current one has left,
      // so the heading claims focus from its own ref callback rather than from a
      // timer we would have to keep in step with the exit duration.
      focusNextHeading.current = true
    },
    [step],
  )

  async function launch() {
    setLaunching(true)

    for (let index = 0; index < LAUNCH_TASKS.length; index += 1) {
      setLaunchProgress(index)
      await new Promise((resolve) => setTimeout(resolve, 420))
    }
    setLaunchProgress(LAUNCH_TASKS.length)

    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
      window.sessionStorage.removeItem(SEED_STORAGE_KEY)
    } catch {
      // Nothing to clear.
    }

    await new Promise((resolve) => setTimeout(resolve, 380))
    router.push(redirectTo)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (launching) return

    if (!stepValid) {
      setAttempted(true)
      return
    }

    if (step === STEPS.length - 1) {
      void launch()
      return
    }

    // Leaving step one, seed the storefront name from the trading name. The
    // operator can still change it — they just should not have to type it twice.
    if (step === 0 && data.branding.logoText.trim() === '') {
      setData((current) => ({
        ...current,
        branding: { ...current.branding, logoText: current.business.name.trim().slice(0, 24) },
      }))
    }

    goTo(step + 1)
  }

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]
  const StepIcon = current.icon

  const stepProps: StepProps = {
    data,
    errors: visibleErrors,
    onChange: setData,
    touch,
  }

  const stepContent = [
    <BusinessStep key="business" {...stepProps} />,
    <BrandingStep key="branding" {...stepProps} />,
    <ActivityStep key="activity" {...stepProps} />,
    <AvailabilityStep key="availability" {...stepProps} />,
    <TeamStep key="team" {...stepProps} />,
  ][step]

  return (
    <div className={cn('w-full', className)} {...props}>
      <StepRail current={step} furthest={furthest} onSelect={goTo} />

      <form noValidate onSubmit={handleSubmit} className="mt-8">
        <div className="rounded-3xl border border-line bg-surface p-5 shadow-lg sm:p-7 lg:p-8">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            {launching ? (
              <motion.div
                key="launching"
                initial={reducedMotion ? false : { opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={reducedMotion ? { duration: 0 } : { duration: DURATION.base, ease: EASE_OUT_EXPO }}
              >
                <LaunchPanel progress={launchProgress} />
              </motion.div>
            ) : (
              <motion.div
                key={current.id}
                custom={direction}
                variants={reducedMotion ? undefined : slideVariants}
                initial={reducedMotion ? false : 'enter'}
                animate={reducedMotion ? undefined : 'center'}
                exit={reducedMotion ? undefined : 'exit'}
                transition={{ duration: DURATION.base, ease: EASE_OUT_EXPO }}
                className="gpu"
              >
                <header className="mb-6 flex items-start gap-3.5">
                  <span
                    aria-hidden="true"
                    className="hidden size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary sm:flex"
                  >
                    <StepIcon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      ref={(node) => {
                        if (node && focusNextHeading.current) {
                          focusNextHeading.current = false
                          node.focus()
                        }
                      }}
                      tabIndex={-1}
                      className="font-display text-xl leading-tight font-semibold tracking-[-0.025em] text-balance text-foreground outline-hidden sm:text-2xl"
                    >
                      {current.title}
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted">
                      {current.blurb}
                    </p>
                  </div>
                </header>

                {stepContent}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ---------- Navigation ---------- */}
        {!launching ? (
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                leftIcon={<ChevronLeft />}
                disabled={step === 0}
                onClick={() => goTo(step - 1)}
              >
                Back
              </Button>

              <div className="flex items-center gap-2 sm:gap-3">
                {isLast ? (
                  <Button type="button" variant="ghost" size="lg" onClick={() => void launch()}>
                    Skip for now
                  </Button>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  disabled={!stepValid}
                  rightIcon={isLast ? <Rocket /> : <ChevronRight />}
                >
                  {isLast ? 'Launch my storefront' : 'Continue'}
                </Button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {!stepValid ? (
                <motion.p
                  key="hint"
                  initial={reducedMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { duration: DURATION.fast, ease: EASE_OUT_EXPO }}
                  className="text-right text-xs text-faint"
                >
                  Complete the required fields to continue.
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </form>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-faint">
        <Check aria-hidden="true" className="size-3.5 text-success" />
        Progress is saved automatically — you can close this and come back.
      </p>
    </div>
  )
}
