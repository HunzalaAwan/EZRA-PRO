import type {
  ActivityTheme,
  Activity,
  BookingSettings,
  ActivityKind,
  ActivityPickup,
  ActivityLocation,
  CharterConfig,
  DifficultyLevel,
  GroupPrice,
  GuestDetailsConfig,
  GuestQuestion,
  LessonConfig,
  PassConfig,
  RentalConfig,
  RideConfig,
  RouteInfo,
} from '@/types'
import { fromPrice, privatePerPerson } from '@/lib/price-engine'
import { rentalModes, type RentalMode } from '@/lib/activity-kinds'
import { normalizeTime } from '@/lib/activity-schedule'

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
  package?: Activity['package']
  guestQuestions?: GuestQuestion[]
  /** null clears the waiver; undefined keeps the seeded one. */
  waiverId?: string | null
  waiverSigning?: 'booker' | 'each'
  guestDetails?: GuestDetailsConfig
  /** null turns pickup off; undefined keeps the seeded setting. */
  pickup?: ActivityPickup | null
  languages?: string[]
  customRequests?: boolean
  tips?: boolean
  priceCap?: number
  booking?: Partial<BookingSettings>
  noticeHours?: number
  theme?: ActivityTheme
  /** null clears a custom category. */
  customCategory?: string | null
  accessibility?: string[]
  bring?: string[]
  ride?: RideConfig
  /** Prices and extras; absent on edits saved before they were kept. */
  priceTiers?: Activity['priceTiers']
  addOns?: Activity['addOns']
  payment?: Activity['payment']
  changes?: Activity['changes']
  cancellationPolicy?: Activity['cancellationPolicy']
  guestNote?: string
  privateOption?: Activity['privateOption']
  /** null clears the route. */
  route?: RouteInfo | null
  /* ---------- pricing (price engine): how it charges and its own price changes ---------- */
  /** null goes back to the kind's default; undefined keeps the seeded one. */
  chargeBy?: Activity['chargeBy'] | null
  /** null clears the group price. */
  groupPrice?: Activity['groupPrice'] | null
  /** An empty list clears the ladder. */
  groupDiscounts?: Activity['groupDiscounts']
  /** 0 clears it. */
  minimumCharge?: number
  /** An empty list clears them. */
  priceChanges?: Activity['priceChanges']
  /* ---------- schedule (schedule engine): seasons, changes, booking window ----------
     Left out of a save (undefined), each keeps what was saved before, so a screen
     that doesn't edit the schedule never wipes changes made on the Schedule tab
     or the calendar. Clear them with [] / null / false. */
  /** The seasons; an empty list means no weekly times (specific dates come from changes). Never saved: the seeded schedule. */
  schedules?: Activity['schedules']
  /** Closed days, different times, extra times and spots on given days. An empty list clears them. */
  scheduleChanges?: Activity['scheduleChanges']
  /** null goes back to the business default. */
  bookingWindow?: Activity['bookingWindow'] | null
  runsOnClosures?: boolean
  updatedAt: string
}

export const ACTIVITY_OVERRIDES_KEY = 'ezra:activity-overrides'
export const ACTIVITY_OVERRIDES_EVENT = 'ezra:activity-overrides'

/** The schedule fields a save that leaves them out keeps. */
const SCHEDULE_KEYS = ['schedules', 'scheduleChanges', 'bookingWindow', 'runsOnClosures'] as const

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
  const next: ActivityOverride = { ...override, updatedAt: new Date().toISOString() }
  // Schedule fields the save leaves out keep their saved value (see the schedule block above).
  const previous = all[activityId]
  if (previous) {
    for (const key of SCHEDULE_KEYS) if (next[key] === undefined && previous[key] !== undefined) Object.assign(next, { [key]: previous[key] })
  }
  all[activityId] = next
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
    // Spots are at least 1; an older save with none (0 once meant "no limit") keeps the seeded number.
    maxCapacity: override.maxCapacity > 0 ? override.maxCapacity : activity.maxCapacity,
    minAge: override.minAge,
    minParticipants: override.minParticipants,
    featured: override.featured,
    locations: override.locations && override.locations.length > 0 ? override.locations : activity.locations,
    kind: override.kind ?? activity.kind,
    rental: override.rental ?? activity.rental,
    charter: override.charter ?? activity.charter,
    lesson: override.lesson ?? activity.lesson,
    pass: override.pass ?? activity.pass,
    package: override.package ?? activity.package,
    priceTiers: override.priceTiers && override.priceTiers.length > 0 ? override.priceTiers : activity.priceTiers,
    basePrice: overrideBasePrice(activity, override),
    addOns: override.addOns ?? activity.addOns,
    payment: override.payment ?? activity.payment,
    changes: override.changes ?? activity.changes,
    cancellationPolicy: override.cancellationPolicy ?? activity.cancellationPolicy,
    privateOption: privateOptionOf(activity, override),
    guestNote: override.guestNote === undefined ? activity.guestNote : override.guestNote || undefined,
    guestQuestions: override.guestQuestions ?? activity.guestQuestions,
    waiverId: override.waiverId === undefined ? activity.waiverId : (override.waiverId ?? undefined),
    pickup: override.pickup === undefined ? activity.pickup : (override.pickup ?? undefined),
    waiverSigning: override.waiverSigning ?? activity.waiverSigning,
    guestDetails: override.guestDetails ?? activity.guestDetails,
    languages: override.languages ?? activity.languages,
    customRequests: override.customRequests ?? activity.customRequests,
    tips: override.tips ?? activity.tips,
    booking: override.booking ?? activity.booking,
    priceCap: override.priceCap === undefined ? activity.priceCap : override.priceCap || undefined,
    noticeHours: override.noticeHours === undefined ? activity.noticeHours : override.noticeHours || undefined,
    theme: override.theme ?? activity.theme,
    customCategory: override.customCategory === undefined ? activity.customCategory : (override.customCategory ?? undefined),
    accessibility: override.accessibility ?? activity.accessibility,
    bring: override.bring ?? activity.bring,
    ride: override.ride ?? activity.ride,
    route: override.route === undefined ? activity.route : (override.route ?? undefined),
    ...pricingFields(activity, override),
    ...scheduleFields(activity, override),
    updatedAt: override.updatedAt,
  }
}

/* ---------- schedule (schedule engine) ---------- */

/** The schedule fields of a saved edit over the seeded ones. */
function scheduleFields(activity: Activity, override: ActivityOverride): Pick<Activity, 'schedules' | 'scheduleChanges' | 'bookingWindow' | 'runsOnClosures'> {
  return {
    schedules: Array.isArray(override.schedules) ? override.schedules : activity.schedules,
    scheduleChanges: Array.isArray(override.scheduleChanges) ? override.scheduleChanges : activity.scheduleChanges,
    bookingWindow:
      override.bookingWindow === undefined
        ? activity.bookingWindow
        : override.bookingWindow && override.bookingWindow.monthsAhead > 0
          ? override.bookingWindow
          : undefined,
    runsOnClosures: override.runsOnClosures ?? activity.runsOnClosures,
  }
}

/** Only the schedule of a saved edit, for screens that keep everything else seeded. */
export function applyScheduleOverride<T extends Activity>(activity: T, override?: ActivityOverride): T {
  if (!override) return activity
  return {
    ...activity,
    locations: override.locations && override.locations.length > 0 ? override.locations : activity.locations,
    noticeHours: override.noticeHours === undefined ? activity.noticeHours : override.noticeHours || undefined,
    ...scheduleFields(activity, override),
  }
}

/**
 * Saves schedule fields on their own (an extra time from the calendar, a
 * closed day): merged into the activity's saved edit, or a new edit made
 * from the activity as it is, so nothing else changes.
 */
export function saveScheduleOverride(
  activity: Activity,
  patch: Partial<Pick<ActivityOverride, 'schedules' | 'scheduleChanges' | 'bookingWindow' | 'runsOnClosures' | 'noticeHours' | 'locations'>>,
) {
  const existing = parseActivityOverrides(readActivityOverridesRaw())[activity.id]
  const base: Omit<ActivityOverride, 'updatedAt'> = existing ?? {
    name: activity.name,
    tagline: activity.tagline,
    description: activity.description,
    highlights: activity.highlights,
    included: activity.included,
    excluded: activity.excluded,
    requirements: activity.requirements,
    meetingPoint: activity.meetingPoint,
    difficulty: activity.difficulty,
    durationMinutes: activity.durationMinutes,
    maxCapacity: activity.maxCapacity,
    minAge: activity.minAge,
    minParticipants: activity.minParticipants,
    featured: activity.featured,
    crewIds: [],
  }
  saveActivityOverride(activity.id, { ...base, ...patch })
}

/** Adds one schedule change to the activity's saved edit, or replaces the one with the same id. */
export function upsertScheduleChange(activity: Activity, change: NonNullable<Activity['scheduleChanges']>[number]) {
  const existing = parseActivityOverrides(readActivityOverridesRaw())[activity.id]
  const current = existing?.scheduleChanges ?? activity.scheduleChanges ?? []
  const next = current.some((entry) => entry.id === change.id) ? current.map((entry) => (entry.id === change.id ? change : entry)) : [...current, change]
  saveScheduleOverride(activity, { scheduleChanges: next })
}

/* ---------- pricing (price engine) ---------- */

/**
 * The pricing fields of a saved edit over the seeded ones. A group price is the
 * price, the guests it covers (0: everyone), each guest over that, the most
 * guests one booking can have (what it covers plus the extra guests allowed;
 * 0: the spots decide) and the description. Group discounts, a minimum charge and an activity's own
 * price changes are price rules now (Pricing → Price rules), so an edit saved
 * before that no longer applies them: nothing the activity setup cannot show
 * moves a price.
 */
function pricingFields(activity: Activity, override: ActivityOverride): Pick<Activity, 'chargeBy' | 'groupPrice' | 'groupDiscounts' | 'minimumCharge' | 'priceChanges'> {
  const group = override.groupPrice === undefined ? activity.groupPrice : (override.groupPrice ?? undefined)
  return {
    chargeBy: override.chargeBy === undefined ? activity.chargeBy : (override.chargeBy ?? undefined),
    groupPrice: group && override.groupPrice ? savedGroupPrice(group) : group,
    groupDiscounts: activity.groupDiscounts,
    minimumCharge: activity.minimumCharge,
    priceChanges: activity.priceChanges,
  }
}

const wholeMinor = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0)

/** A saved group price, cleaned: whole amounts and counts, never below nothing, and the description only when there is one. */
function savedGroupPrice(group: GroupPrice): GroupPrice {
  const note = typeof group.note === 'string' ? group.note.trim() : ''
  return {
    price: wholeMinor(group.price),
    includedGuests: Math.floor(wholeMinor(group.includedGuests)),
    extraGuest: wholeMinor(group.extraGuest),
    maxGuests: Math.floor(wholeMinor(group.maxGuests)),
    ...(note ? { note } : {}),
  }
}

/**
 * The private option after an edit. The editor saves it only when it is on, and
 * JSON drops an undefined key, so an edit from the editor (it always carries the
 * prices) without one has switched it off. Edits that carry no prices (a closed
 * day from the calendar) keep the seeded one.
 */
function privateOptionOf(activity: Activity, override: ActivityOverride): Activity['privateOption'] {
  if ('privateOption' in override) return override.privateOption
  return (override.priceTiers?.length ?? 0) > 0 ? undefined : activity.privateOption
}

/** The "from" price after an edit: the lowest sellable tier, a rental's lowest item rate, or the group price. */
function overrideBasePrice(activity: Activity, override: ActivityOverride): number {
  const touched =
    (override.priceTiers?.length ?? 0) > 0 || override.rental !== undefined || override.kind !== undefined || override.chargeBy !== undefined || override.groupPrice !== undefined
  if (!touched) return activity.basePrice
  return fromPrice({
    slug: activity.slug,
    currency: activity.currency,
    kind: override.kind ?? activity.kind,
    priceTiers: override.priceTiers && override.priceTiers.length > 0 ? override.priceTiers : activity.priceTiers,
    rental: override.rental ?? activity.rental,
    ...pricingFields(activity, override),
  })
}

/**
 * Only the prices of a saved edit, for the storefront, checkout and the desk:
 * tier and extra prices by id (ones the edit removed stop selling), rental
 * rates, caps and charging (see `rentalPricingOf`), the private group's
 * guests covered, extra-guest price and extra guests allowed, the private and group prices, the
 * cap and payment. Tier, extra and length ids stay the seeded ones, so a
 * checkout link the server checks against the seeded activity always
 * resolves; tiers and extras the edit added are not sold.
 */
export function applyPricingOverride<T extends Activity>(activity: T, override?: ActivityOverride): T {
  if (!override) return activity
  const editedTiers = override.priceTiers ?? []
  const fields = pricingFields(activity, override)
  // A private activity priced per person: its options become tickets per guest, so each takes the edit's name, note and counts.
  const tickets = privatePerPerson({ kind: activity.kind, chargeBy: fields.chargeBy })
  // Seeded tiers the edit still has, with its prices. None left (every tier new): the seeded ones still sell.
  const keptTiers = activity.priceTiers.flatMap((tier) => {
    const edited = editedTiers.find((entry) => entry.id === tier.id)
    if (!edited) return []
    const kept = { ...tier, price: edited.price, compareAtPrice: edited.compareAtPrice, ageMin: edited.ageMin, ageMax: edited.ageMax }
    if (!tickets) return [kept]
    const most = Math.max(1, Math.floor(edited.maxQuantity || tier.maxQuantity || 1))
    return [
      {
        ...kept,
        label: edited.label?.trim() || tier.label,
        description: edited.description?.trim() || undefined,
        minQuantity: Math.min(most, Math.max(0, Math.floor(edited.minQuantity || 0))),
        maxQuantity: most,
      },
    ]
  })
  const priceTiers = editedTiers.length > 0 && keptTiers.length > 0 ? keptTiers : activity.priceTiers
  const addOns = override.addOns
    ? activity.addOns.flatMap((addOn) => {
        const edited = override.addOns!.find((entry) => entry.id === addOn.id)
        return edited ? [{ ...addOn, price: edited.price }] : []
      })
    : activity.addOns
  const rental = activity.rental && override.rental ? rentalPricingOf(activity, activity.rental, override.rental) : activity.rental
  // A private group: the guests its price covers, each one over and how many more can come, as the edit saved them (none saved: none charged).
  const charter =
    activity.charter && override.charter
      ? { ...activity.charter, includedGuests: override.charter.includedGuests, extraGuestPrice: override.charter.extraGuestPrice, maxExtraGuests: override.charter.maxExtraGuests }
      : activity.charter
  const merged: T = {
    ...activity,
    priceTiers,
    addOns,
    rental,
    charter,
    privateOption: privateOptionOf(activity, override),
    priceCap: override.priceCap === undefined ? activity.priceCap : override.priceCap || undefined,
    tips: override.tips ?? activity.tips,
    payment: override.payment ?? activity.payment,
    ...fields,
  }
  return { ...merged, basePrice: fromPrice(merged) || activity.basePrice }
}

const positiveWhole = (value: number | undefined) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined)

/**
 * A rental's prices and charging after an edit: rates, the late fee, item
 * caps and deposits, how it is charged, the fewest and most hours or days,
 * and the pick-up and return times. Only the seeded ways of charging can
 * stay on (the checkout server reads those), and only ones the edit has on
 * and gives a rate; when none is left, the seeded ones stay.
 */
function rentalPricingOf(activity: Pick<Activity, 'kind' | 'rental'>, seeded: RentalConfig, saved: RentalConfig): RentalConfig {
  const rates = saved.rates ?? seeded.rates
  const priced = (mode: RentalMode) =>
    mode === 'length'
      ? (rates ?? []).some((rate) => Object.keys(rate.lengths ?? {}).length > 0)
      : mode === 'hour'
        ? (rates ?? []).some((rate) => typeof rate.hour === 'number')
        : (rates ?? []).some((rate) => typeof rate.day === 'number') || ((rates?.length ?? 0) === 0 && seeded.billing === 'day')
  const seededModes = rentalModes({ kind: activity.kind ?? 'rental', rental: seeded })
  const savedModes = saved.modes ?? (saved.billing === 'day' ? ['day'] : [])
  const kept = savedModes.length > 0 ? seededModes.filter((mode) => savedModes.includes(mode) && priced(mode)) : []
  const modes = kept.length > 0 && kept.join() !== seededModes.join() ? kept : undefined

  const minHours = positiveWhole(saved.minHours) ?? seeded.minHours
  const maxHours = positiveWhole(saved.maxHours) ?? seeded.maxHours
  const minDays = positiveWhole(saved.minDays) ?? seeded.minDays
  const maxDays = positiveWhole(saved.maxDays) ?? seeded.maxDays
  const pickupTime = normalizeTime(saved.pickupTime ?? '') ?? seeded.pickupTime
  const returnTime = normalizeTime(saved.returnTime ?? '') ?? seeded.returnTime
  return {
    ...seeded,
    rates,
    // The editor saves a late fee only when there is one; an edit with rates and none has taken it off.
    lateFee: saved.lateFee ?? (saved.rates ? undefined : seeded.lateFee),
    items: seeded.items?.map((item) => {
      const edited = saved.items?.find((entry) => entry.tierId === item.tierId)
      return edited ? { ...item, cap: edited.cap, deposit: edited.deposit } : item
    }),
    ...(modes ? { modes, billing: modes.length === 1 && modes[0] === 'day' ? ('day' as const) : seeded.billing === 'day' ? ('length' as const) : seeded.billing } : {}),
    minHours,
    maxHours: minHours !== undefined && maxHours !== undefined && maxHours < minHours ? minHours : maxHours,
    minDays,
    maxDays: minDays !== undefined && maxDays !== undefined && maxDays < minDays ? minDays : maxDays,
    pickupTime,
    returnTime,
  }
}
