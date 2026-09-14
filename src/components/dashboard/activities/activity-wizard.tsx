'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CalendarClock,
  Check,
  CircleAlert,
  Compass,
  FileText,
  Gauge,
  Images,
  MapPin,
  Mountain,
  Plus,
  Rocket,
  RotateCcw,
  Save,
  Sparkles,
  Star,
  Tag,
  Timer,
  TriangleAlert,
  Trash2,
  Users,
  Waves,
} from 'lucide-react'
import { z } from 'zod'

import type { CurrencyCode, DifficultyLevel, VerticalKey } from '@/types'
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
  ScheduleEditor,
  defaultSchedule,
  formatClock,
  previewDepartures,
  type DraftSchedule,
} from './schedule-editor'

/* ==========================================================================
   DRAFT MODEL
   One object holds the whole wizard. It is mirrored into sessionStorage so a
   refresh — or a detour to check a competitor's price — never loses the work.
   ========================================================================== */

export interface ActivityDraft {
  name: string
  tagline: string
  category: VerticalKey
  difficulty: DifficultyLevel
  durationMinutes: number
  minAge: number
  maxCapacity: number
  minParticipants: number
  description: string
  highlights: string[]
  included: string[]
  excluded: string[]
  requirements: string[]
  meetingPoint: string
  media: DraftMedia[]
  tiers: DraftTier[]
  addOns: DraftAddOn[]
  schedule: DraftSchedule
  featured: boolean
  freeCancellationHours: number
}

const STORAGE_KEY = 'ezra:activity-wizard:v1'

export function createDefaultDraft(category: VerticalKey, nowIso: string): ActivityDraft {
  return {
    name: '',
    tagline: '',
    category,
    difficulty: 'easy',
    durationMinutes: 120,
    minAge: 8,
    maxCapacity: 16,
    minParticipants: 1,
    description: '',
    highlights: [''],
    included: [''],
    excluded: [],
    requirements: [],
    meetingPoint: '',
    media: [],
    tiers: [blankTier('Adult', 14900)],
    addOns: [],
    schedule: defaultSchedule(nowIso),
    featured: false,
    freeCancellationHours: 24,
  }
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

const STEPS = [
  { id: 'basics', label: 'Basics', hint: 'Name, category, capacity', icon: Compass },
  { id: 'description', label: 'Description', hint: 'The copy guests read', icon: FileText },
  { id: 'media', label: 'Media', hint: 'Photography', icon: Images },
  { id: 'pricing', label: 'Pricing', hint: 'Tiers and add-ons', icon: Tag },
  { id: 'schedule', label: 'Schedule', hint: 'When it runs', icon: CalendarClock },
  { id: 'review', label: 'Review', hint: 'Publish', icon: Rocket },
] as const

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
        .min(15, 'Departures run for at least 15 minutes')
        .max(1440, 'Use multi-day products for anything over 24 hours'),
      minAge: z.number().int().min(0).max(99),
      maxCapacity: z.number().int().min(1, 'A departure needs at least one seat').max(500),
      minParticipants: z.number().int().min(1, 'At least one guest must be required'),
    })
    .refine((draft) => draft.minParticipants <= draft.maxCapacity, {
      message: 'Minimum participants cannot exceed the capacity',
      path: ['minParticipants'],
    }),

  z.object({
    description: z
      .string()
      .trim()
      .min(80, 'Describe the experience in at least 80 characters — this is the storefront copy'),
    highlights: nonEmptyList(3, 'Add at least three highlights'),
    included: nonEmptyList(1, 'List at least one thing that is included'),
    meetingPoint: z.string().trim().min(10, 'Tell guests exactly where to meet you'),
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

  z.object({
    schedule: z.object({
      weekdays: z.array(z.number()).min(1, 'Pick at least one day of the week'),
      startTimes: z.array(z.string()).min(1, 'Add at least one start time'),
      capacity: z.number().int().min(1).max(500),
      seasonStart: z.string().min(1, 'Choose a season start'),
      seasonEnd: z.string().min(1, 'Choose a season end'),
    }),
  }),
]

type FieldErrors = Record<string, string>

function validateStep(step: number, draft: ActivityDraft): FieldErrors {
  const schema = STEP_SCHEMAS[step]
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
  current,
  furthest,
  onJump,
}: {
  current: number
  furthest: number
  onJump: (index: number) => void
}) {
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
                  <span className="hidden truncate text-[0.6875rem] text-faint xl:block">
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

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-line-subtle bg-surface-sunken px-3 py-2">
        <span aria-hidden="true" className="flex gap-1">
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
          <span className="size-2 rounded-full bg-line-strong" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-surface px-2 py-1 font-mono text-[0.625rem] text-faint">
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
          <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-sunset-400/90 px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-950">
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
            {formatDuration(draft.durationMinutes)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5 text-faint" aria-hidden="true" />
            Up to {draft.maxCapacity}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Gauge className="size-3.5 text-faint" aria-hidden="true" />
            {draft.difficulty}
          </span>
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
            <p className="text-[0.625rem] font-semibold tracking-wide text-faint uppercase">
              Next available
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {upcoming.map((day) => (
                <span
                  key={day.dateKey}
                  className="rounded-md bg-surface px-1.5 py-1 text-[0.6875rem] font-medium text-muted tabular"
                >
                  {new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric' }).format(
                    new Date(`${day.dateKey}T00:00:00`),
                  )}{' '}
                  · {formatClock(day.times[0])}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-end justify-between gap-3 border-t border-line-subtle pt-3">
          <div>
            <p className="text-[0.625rem] tracking-wide text-faint uppercase">From</p>
            <p className="font-display text-lg leading-tight font-semibold">
              {formatCurrency(fromPrice, currency)}
            </p>
          </div>
          <span className="pointer-events-none inline-flex h-9 items-center rounded-lg bg-primary px-4 text-[0.8125rem] font-semibold text-on-primary shadow-sm">
            Check availability
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
}

export function ActivityWizard({
  currency,
  tenantName,
  tenantSlug,
  defaultCategory,
  nowIso,
}: ActivityWizardProps) {
  const router = useRouter()
  const reduceMotion = useReducedMotion()

  const initial = React.useMemo(
    () => createDefaultDraft(defaultCategory, nowIso),
    [defaultCategory, nowIso],
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
      const raw = window.sessionStorage.getItem(STORAGE_KEY)
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
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ draft, step }))
    } catch {
      // Private mode or a full quota — the wizard still works in memory.
    }
  }, [draft, step])

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
      router.push('/dashboard/activities')
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
    setDraft(createDefaultDraft(defaultCategory, nowIso))
    setStep(0)
    setFurthest(0)
    setErrors({})
    setShowErrors(false)
    setRestored(false)
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* nothing to clear */
    }
    toast('Draft discarded')
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
        window.sessionStorage.removeItem(STORAGE_KEY)
      } catch {
        /* already gone */
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

  const currentStep = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div className="flex flex-col gap-5">
      <StepProgress current={step} furthest={furthest} onJump={(index) => goTo(index, index > step ? 1 : -1)} />

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
                <CardDescription>{STEP_COPY[step]}</CardDescription>
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
                      <section>
                        <h3 className="text-sm font-semibold">Price tiers</h3>
                        <p className="mt-0.5 mb-3 text-xs text-muted">
                          The first tier sets the “from” price on every storefront tile.
                        </p>
                        <PricingTierEditor
                          tiers={draft.tiers}
                          onChange={(tiers) => patch({ tiers })}
                          currency={currency}
                          errors={errors}
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
                        <h3 className="text-sm font-semibold">Add-ons</h3>
                        <p className="mt-0.5 mb-3 text-xs text-muted">
                          Optional extras offered once the guest has picked a time.
                        </p>
                        <AddonEditor
                          addOns={draft.addOns}
                          onChange={(addOns) => patch({ addOns })}
                          currency={currency}
                          errors={errors}
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
                    <ScheduleEditor
                      schedule={draft.schedule}
                      onChange={(schedule) => patch({ schedule })}
                      nowIso={nowIso}
                      errors={errors}
                    />
                  ) : null}
                  {step === 5 ? (
                    <ReviewStep
                      draft={draft}
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
                {step === 0 ? 'Cancel' : `Back to ${STEPS[step - 1].label.toLowerCase()}`}
              </Button>

              <div className="flex flex-wrap items-center gap-2">
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
                {isLast ? (
                  <Button
                    type="button"
                    variant="primary"
                    leftIcon={<Rocket />}
                    loading={submitting === 'live'}
                    disabled={submitting !== null}
                    onClick={() => submit('live')}
                  >
                    Publish activity
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

/* ==========================================================================
   STEPS
   ========================================================================== */

interface StepProps {
  draft: ActivityDraft
  patch: (changes: Partial<ActivityDraft>) => void
  errors: FieldErrors
}

function BasicsStep({ draft, patch, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Activity name"
        required
        error={errors.name}
        description={
          draft.name
            ? `Storefront URL: /${slugify(draft.name)}`
            : 'Guests see this everywhere — search, checkout, confirmation emails.'
        }
      >
        <Input placeholder="Molokini Crater Dawn Patrol" value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
      </Field>

      <Field
        label="Tagline"
        required
        error={errors.tagline}
        hint={`${draft.tagline.length}/120`}
        description="One line that earns the click."
      >
        <Input
          placeholder="First boat on the water, before the crowds and the wind"
          value={draft.tagline}
          maxLength={120}
          onChange={(event) => patch({ tagline: event.target.value })}
        />
      </Field>

      <Field label="Category" description="Drives storefront filters and the reporting rollup.">
        <Select
          value={draft.category}
          onValueChange={(value) => patch({ category: value as VerticalKey })}
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
        <Field label="Duration" required error={errors.durationMinutes}>
          <Input
            type="number"
            min={15}
            step={15}
            value={draft.durationMinutes}
            suffix="minutes"
            onChange={(event) =>
              patch({ durationMinutes: Number.parseInt(event.target.value, 10) || 0 })
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
        <Field label="Capacity per departure" required error={errors.maxCapacity}>
          <Input
            type="number"
            min={1}
            value={draft.maxCapacity}
            suffix="seats"
            onChange={(event) =>
              patch({ maxCapacity: Number.parseInt(event.target.value, 10) || 0 })
            }
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
        {[60, 90, 120, 180, 240, 480].map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => patch({ durationMinutes: minutes })}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200',
              draft.durationMinutes === minutes
                ? 'border-primary/50 bg-primary-soft text-primary'
                : 'border-line bg-surface text-muted hover:text-foreground',
            )}
          >
            {formatDuration(minutes)}
          </button>
        ))}
      </div>
    </div>
  )
}

function DescriptionStep({ draft, patch, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Description"
        required
        error={errors.description}
        hint={`${draft.description.trim().length} characters`}
        description="Two or three short paragraphs. Lead with what the guest will actually see and feel."
      >
        <Textarea
          rows={7}
          value={draft.description}
          placeholder="We leave the harbour before sunrise, when the water inside the crater is still glass…"
          onChange={(event) => patch({ description: event.target.value })}
        />
      </Field>

      <ListEditor
        legend="Highlights"
        description="Three to five bullets, shown directly under the price."
        items={draft.highlights}
        onChange={(highlights) => patch({ highlights })}
        placeholder="Glass-flat water and the best visibility of the day"
        error={errors.highlights}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <ListEditor
          legend="Included"
          items={draft.included}
          onChange={(included) => patch({ included })}
          placeholder="Snorkel gear and wetsuit"
          error={errors.included}
        />
        <ListEditor
          legend="Not included"
          tone="negative"
          items={draft.excluded}
          onChange={(excluded) => patch({ excluded })}
          placeholder="Gratuity"
        />
      </div>

      <ListEditor
        legend="Requirements"
        tone="warning"
        description="Shown at checkout and repeated in the confirmation email."
        items={draft.requirements}
        onChange={(requirements) => patch({ requirements })}
        placeholder="Comfortable swimming in open water"
      />

      <Field
        label="Meeting point"
        required
        error={errors.meetingPoint}
        description="Exact enough that a guest with no local knowledge finds it in the dark."
      >
        <Textarea
          rows={3}
          value={draft.meetingPoint}
          placeholder="Māʻalaea Harbor, Slip 42 — park in the public lot and walk to the far end of the pier."
          onChange={(event) => patch({ meetingPoint: event.target.value })}
        />
      </Field>
    </div>
  )
}

function ReviewStep({
  draft,
  currency,
  tenantName,
  tenantSlug,
  nowIso,
  patch,
  onJump,
}: {
  draft: ActivityDraft
  currency: CurrencyCode
  tenantName: string
  tenantSlug: string
  nowIso: string
  patch: (changes: Partial<ActivityDraft>) => void
  onJump: (index: number) => void
}) {
  const priced = draft.tiers.filter((tier) => tier.label.trim().length > 0)
  const fromPrice = priced.length === 0 ? 0 : Math.min(...priced.map((tier) => tier.price))
  const generated = previewDepartures(draft.schedule, nowIso, 14)
  const departures = generated.reduce((acc, day) => acc + day.times.length, 0)
  const seats = generated.reduce((acc, day) => acc + day.seats, 0)

  const rows: { label: string; value: React.ReactNode; step: number }[] = [
    { label: 'Name', value: draft.name, step: 0 },
    { label: 'Category', value: CATEGORY_OPTIONS.find((c) => c.value === draft.category)?.label, step: 0 },
    { label: 'Difficulty', value: draft.difficulty, step: 0 },
    { label: 'Duration', value: formatDuration(draft.durationMinutes), step: 0 },
    {
      label: 'Capacity',
      value: `${draft.minParticipants}–${draft.maxCapacity} guests · ages ${draft.minAge}+`,
      step: 0,
    },
    { label: 'Highlights', value: `${draft.highlights.filter(Boolean).length} bullets`, step: 1 },
    { label: 'Meeting point', value: draft.meetingPoint, step: 1 },
    { label: 'Media', value: `${draft.media.length} ${pluralize(draft.media.length, 'image')}`, step: 2 },
    {
      label: 'Pricing',
      value: `${priced.length} ${pluralize(priced.length, 'tier')} from ${formatCurrency(fromPrice, currency)} · ${draft.addOns.length} ${pluralize(draft.addOns.length, 'add-on')}`,
      step: 3,
    },
    {
      label: 'Schedule',
      value: `${draft.schedule.startTimes.length} ${pluralize(draft.schedule.startTimes.length, 'time')} on ${draft.schedule.weekdays.length} ${pluralize(draft.schedule.weekdays.length, 'day')} · ${draft.schedule.capacity} seats each`,
      step: 4,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Departures · next 14 days', value: departures.toString(), icon: CalendarClock },
          { label: 'Seats on sale', value: seats.toString(), icon: Users },
          { label: 'Lead price', value: formatCurrency(fromPrice, currency), icon: Tag },
        ].map((item) => {
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
                <dd className="min-w-0 text-[0.8125rem] break-words text-foreground capitalize">
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
                Guests get a full refund up to this many hours before departure.
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
          . Departures are generated from your schedule rule for the next 180 days and appear on the
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
