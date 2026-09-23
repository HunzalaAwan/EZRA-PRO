import type {
  Activity,
  ActivityKind,
  ActivityLocation,
  CharterConfig,
  DifficultyLevel,
  LessonConfig,
  PassConfig,
  RentalConfig,
} from '@/types'

/* ==========================================================================
   Activity overrides — edits made in the activity editor, kept in the
   browser because the demo has no backend. The detail page merges them
   over the seeded activity so an edit shows up the moment it is saved.
   ========================================================================== */

export interface ActivityOverride {
  name: string
  tagline: string
  description: string
  highlights: string[]
  included: string[]
  excluded: string[]
  requirements: string[]
  meetingPoint: string
  difficulty: DifficultyLevel
  durationMinutes: number
  maxCapacity: number
  minAge: number
  minParticipants: number
  featured: boolean
  crewIds: string[]
  /** The bases it runs from and the times at each; absent on edits saved before bases existed. */
  locations?: ActivityLocation[]
  /** What is sold and its settings; absent on edits saved before kinds existed. */
  kind?: ActivityKind
  rental?: RentalConfig
  charter?: CharterConfig
  lesson?: LessonConfig
  pass?: PassConfig
  updatedAt: string
}

export const ACTIVITY_OVERRIDES_KEY = 'ezra:activity-overrides'
export const ACTIVITY_OVERRIDES_EVENT = 'ezra:activity-overrides'

export function readActivityOverridesRaw(): string {
  try {
    return window.localStorage.getItem(ACTIVITY_OVERRIDES_KEY) ?? ''
  } catch {
    return ''
  }
}

export function parseActivityOverrides(raw: string): Record<string, ActivityOverride> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, ActivityOverride>) : {}
  } catch {
    return {}
  }
}

export function saveActivityOverride(activityId: string, override: Omit<ActivityOverride, 'updatedAt'>) {
  const all = parseActivityOverrides(readActivityOverridesRaw())
  all[activityId] = { ...override, updatedAt: new Date().toISOString() }
  try {
    window.localStorage.setItem(ACTIVITY_OVERRIDES_KEY, JSON.stringify(all))
  } catch {
    /* blocked storage: the edit lives for this page only */
  }
  window.dispatchEvent(new Event(ACTIVITY_OVERRIDES_EVENT))
}

export function clearActivityOverride(activityId: string) {
  const all = parseActivityOverrides(readActivityOverridesRaw())
  delete all[activityId]
  try {
    window.localStorage.setItem(ACTIVITY_OVERRIDES_KEY, JSON.stringify(all))
  } catch {
    /* nothing to clear */
  }
  window.dispatchEvent(new Event(ACTIVITY_OVERRIDES_EVENT))
}

/** The seeded activity with the saved edit laid over it. Lists replace, scalars replace, everything else stays. */
export function applyActivityOverride<T extends Activity>(activity: T, override?: ActivityOverride): T {
  if (!override) return activity
  const clean = (items: string[]) => items.map((item) => item.trim()).filter(Boolean)
  return {
    ...activity,
    name: override.name || activity.name,
    tagline: override.tagline || activity.tagline,
    description: override.description || activity.description,
    highlights: clean(override.highlights),
    included: clean(override.included),
    excluded: clean(override.excluded),
    requirements: clean(override.requirements),
    meetingPoint: override.meetingPoint,
    difficulty: override.difficulty,
    durationMinutes: override.durationMinutes,
    maxCapacity: override.maxCapacity,
    minAge: override.minAge,
    minParticipants: override.minParticipants,
    featured: override.featured,
    locations: override.locations && override.locations.length > 0 ? override.locations : activity.locations,
    kind: override.kind ?? activity.kind,
    rental: override.rental ?? activity.rental,
    charter: override.charter ?? activity.charter,
    lesson: override.lesson ?? activity.lesson,
    pass: override.pass ?? activity.pass,
    updatedAt: override.updatedAt,
  }
}
