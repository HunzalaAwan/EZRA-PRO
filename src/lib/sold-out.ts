import type { AvailabilityDay } from '@/components/storefront/booking-widget'
import type { Activity, SoldOutSuggestions } from '@/types'

/* ==========================================================================
   When it's fully booked — what the storefront offers on a day with no
   spots left: the next days that have spots, and the other activities the
   owner picked (only those with spots soon). Set on the activity's Booking
   step; absent, it suggests other days and no other activities.
   ========================================================================== */

export const SOLD_OUT_DEFAULT: SoldOutSuggestions = { otherDays: true, activityIds: [] }

/** How many days and activities are suggested at most. */
export const SUGGEST_LIMIT = 3
/** Other activities are suggested when they have spots within this many days. */
export const SUGGEST_WINDOW_DAYS = 14

/** A saved setting, checked: a switch and a list of distinct ids. Anything else reads as the default. */
export function cleanSoldOut(value: unknown): SoldOutSuggestions {
  if (!value || typeof value !== 'object') return { ...SOLD_OUT_DEFAULT, activityIds: [] }
  const raw = value as Partial<SoldOutSuggestions>
  const ids = Array.isArray(raw.activityIds) ? raw.activityIds.filter((id): id is string => typeof id === 'string' && id.length > 0) : []
  return { otherDays: raw.otherDays !== false, activityIds: [...new Set(ids)] }
}

/** The activity's setting, or the default when it has none. */
export const soldOutOf = (activity: Pick<Activity, 'soldOut'>): SoldOutSuggestions => cleanSoldOut(activity.soldOut)

/** The default setting: nothing worth saving. */
export const isDefaultSoldOut = (value: SoldOutSuggestions) => value.otherDays && value.activityIds.length === 0

/** A day has time slots and none of them has a spot left (extra spots included). */
export const isFullDay = (day: AvailabilityDay | undefined): boolean => Boolean(day && day.slots.length > 0 && day.slots.every((slot) => slot.soldOut))

/** A day guests can book: it has a time slot with a spot left. */
export const isOpenDay = (day: AvailabilityDay): boolean => day.slots.some((slot) => !slot.soldOut)

/** The next days after `afterKey` with spots left, up to `limit`. */
export function nextOpenDays(days: AvailabilityDay[], afterKey: string, limit = SUGGEST_LIMIT): AvailabilityDay[] {
  return days.filter((day) => day.dateKey > afterKey && isOpenDay(day)).slice(0, limit)
}

/** An activity offered in place of a fully booked one. */
export interface SuggestedActivity {
  id: string
  slug: string
  name: string
  image?: { url: string; alt: string }
  /** The lowest price guests pay, minor units. */
  fromPrice: number
  /** The day suggested: the first with spots on or after the picked day, else the first one. */
  dateKey: string
}

/** One other activity with its strip as guests see it (saved schedule, bookings, prices). */
export interface SuggestionSource {
  activity: Pick<Activity, 'id' | 'slug' | 'name' | 'media'>
  days: AvailabilityDay[]
  fromPrice: number
}

/**
 * The picked activities, in the owner's order, that have spots within the
 * window from today, up to `limit`. Full ones, and ones not on sale, are left out.
 */
export function suggestActivities(
  ids: string[],
  sources: SuggestionSource[],
  ctx: { todayKey: string; lastKey: string; pickedKey?: string; selfId?: string; limit?: number },
): SuggestedActivity[] {
  const out: SuggestedActivity[] = []
  for (const id of ids) {
    if (out.length >= (ctx.limit ?? SUGGEST_LIMIT)) break
    if (id === ctx.selfId) continue
    const source = sources.find((entry) => entry.activity.id === id)
    if (!source) continue
    const open = source.days.filter((day) => day.dateKey >= ctx.todayKey && day.dateKey <= ctx.lastKey && isOpenDay(day))
    if (open.length === 0) continue
    const day = (ctx.pickedKey ? open.find((entry) => entry.dateKey >= ctx.pickedKey!) : undefined) ?? open[0]
    const image = source.activity.media.find((item) => item.isPrimary) ?? source.activity.media[0]
    out.push({
      id: source.activity.id,
      slug: source.activity.slug,
      name: source.activity.name,
      ...(image ? { image: { url: image.url, alt: image.alt } } : {}),
      fromPrice: source.fromPrice,
      dateKey: day.dateKey,
    })
  }
  return out
}
