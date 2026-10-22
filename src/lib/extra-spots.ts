import type { Activity, ActivityKind, ChargeBy, ExtraSpots } from '@/types'

/* ==========================================================================
   Extra spots — the spots a time slot usually runs with, and the extra ones
   sold once those are full, each at its own price.
     - Shared: a time slot sells its spots plus the extra spots. Guests in the
       usual spots pay the usual prices; each guest in an extra spot pays the
       extra-spot price (per group: on top of the group price).
     - Private: one group per time slot, up to its most guests plus the extra
       spots; each guest over its most guests pays the extra-spot price.
   Nothing extra is sold or charged unless both a number and a price are set.
   Saves from before (a group price "covers N, up to M more at $X") read as N
   spots and M extra spots at $X until they are saved again.
   Browser- and server-safe.
   ========================================================================== */

/** The parts of an activity its spots are read from. */
export type SpotsSource = Partial<Pick<Activity, 'kind' | 'maxCapacity' | 'chargeBy' | 'charter' | 'groupPrice' | 'extraSpots'>>

/** Kinds that sell extra spots: activities and tours, shared or private, and lessons. */
export const sellsExtraSpots = (kind: ActivityKind | undefined) => {
  const k = kind ?? 'trip'
  return k === 'trip' || k === 'activity' || k === 'lesson' || k === 'charter'
}

const whole = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)
const minor = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0)

/** How it charges when nothing is set: a private activity per group, everything else here per person. */
const chargeByOf = (activity: SpotsSource): ChargeBy => activity.chargeBy ?? ((activity.kind ?? 'trip') === 'charter' ? 'group' : 'person')

/** The usual spots, the extra spots and each extra spot's price (minor units). */
export interface SpotsPlan {
  /** Spots per time slot; a private group's most guests. 0: not known. */
  usual: number
  extra: number
  price: number
}

/** Spots per time slot, or a private group's most guests. */
function usualOf(activity: SpotsSource): number {
  if ((activity.kind ?? 'trip') === 'charter') return whole(activity.charter?.maxGuests) || whole(activity.maxCapacity)
  return whole(activity.maxCapacity)
}

/**
 * A save from before extra spots, read as spots: a private group's options
 * "covered N, up to M more at $X each" (any number up to its most guests when
 * M was never asked), or a shared group price the same way (its most guests,
 * or the spots when each extra guest paid). Extra guests with no price came
 * free, so they read as usual spots. Undefined when there is nothing to read.
 */
function legacyPlan(activity: SpotsSource): SpotsPlan | undefined {
  const kind = activity.kind ?? 'trip'
  if (!sellsExtraSpots(kind) || chargeByOf(activity) !== 'group') return undefined
  if (kind === 'charter') {
    const charter = activity.charter
    const covers = whole(charter?.includedGuests)
    if (!charter || covers <= 0) return undefined
    const most = usualOf(activity) || Number.POSITIVE_INFINITY
    const allowed = charter.maxExtraGuests === undefined ? Number.POSITIVE_INFINITY : whole(charter.maxExtraGuests)
    const top = Math.min(most, covers + allowed)
    const price = minor(charter.extraGuestPrice)
    if (price > 0 && top > covers) return { usual: covers, extra: Number.isFinite(top) ? top - covers : 0, price }
    return { usual: Number.isFinite(top) ? top : covers, extra: 0, price: 0 }
  }
  const group = activity.groupPrice
  const covers = whole(group?.includedGuests)
  if (!group || covers <= 0) return undefined
  const spots = usualOf(activity) || Number.POSITIVE_INFINITY
  const price = minor(group.extraGuest)
  const saved = whole(group.maxGuests)
  const limit = saved > 0 ? Math.max(covers, saved) : price > 0 ? Number.POSITIVE_INFINITY : covers
  const top = Math.min(spots, limit)
  if (!Number.isFinite(top)) return undefined
  if (price > 0 && top > covers) return { usual: covers, extra: top - covers, price }
  return { usual: top, extra: 0, price: 0 }
}

/** The activity's spots: the usual ones, the extra ones and each extra one's price. */
export function spotsPlanOf(activity: SpotsSource): SpotsPlan {
  const usual = usualOf(activity)
  if (!sellsExtraSpots(activity.kind)) return { usual, extra: 0, price: 0 }
  if (activity.extraSpots) {
    const extra = whole(activity.extraSpots.count)
    const price = minor(activity.extraSpots.price)
    return extra > 0 && price > 0 ? { usual, extra, price } : { usual, extra: 0, price: 0 }
  }
  return legacyPlan(activity) ?? { usual, extra: 0, price: 0 }
}

/** Extra spots that are set up, a number and a price. Undefined: none, nothing extra is sold or charged. */
export function extraSpotsOf(activity: SpotsSource): ExtraSpots | undefined {
  const plan = spotsPlanOf(activity)
  return plan.extra > 0 ? { count: plan.extra, price: plan.price } : undefined
}

/** Spots per time slot, or a private group's most guests, before any extra spots. */
export const usualSpotsOf = (activity: SpotsSource) => spotsPlanOf(activity).usual

/** The extra spots each shared time slot adds to its spots. A private time slot is one group's: none. */
export function slotExtraSpotsOf(activity: SpotsSource): number {
  return (activity.kind ?? 'trip') === 'charter' ? 0 : spotsPlanOf(activity).extra
}

/** The most guests a private group can be: its most guests and its extra spots. */
export function privateMostOf(activity: SpotsSource): number {
  const plan = spotsPlanOf(activity)
  return Math.max(1, plan.usual + plan.extra)
}

/**
 * The activity as its spots read it: a save from before extra spots gets them
 * (`extraSpots`), with what its price covered as its spots (`maxCapacity`, a
 * private group's most guests) and the old per-group fields cleared. Anything
 * else comes back as it is.
 */
export function withExtraSpots<T extends SpotsSource>(activity: T): T {
  if (activity.extraSpots || !sellsExtraSpots(activity.kind)) return activity
  const legacy = legacyPlan(activity)
  if (!legacy) return activity
  const extraSpots: ExtraSpots = { count: legacy.extra, price: legacy.price }
  if ((activity.kind ?? 'trip') === 'charter') {
    const { includedGuests: _covers, extraGuestPrice: _each, maxExtraGuests: _allowed, ...charter } = activity.charter!
    return { ...activity, extraSpots, maxCapacity: legacy.usual, charter: { ...charter, maxGuests: legacy.usual } }
  }
  const { price, note } = activity.groupPrice!
  return { ...activity, extraSpots, maxCapacity: legacy.usual, groupPrice: { price, ...(note ? { note } : {}) } }
}
