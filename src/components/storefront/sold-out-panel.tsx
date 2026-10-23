'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { cn, formatCurrency, fromDateKey } from '@/lib/utils'
import { applyActivityOverride, applyPricingOverride, type ActivityOverride } from '@/lib/activity-overrides'
import { withBookingDefaults, type BookingDefaults } from '@/lib/booking-defaults'
import type { PricingRule } from '@/lib/pricing'
import { suggestedActivityDays } from '@/lib/actions/storefront'
import { bookingOf, showsSchedule } from '@/lib/booking-method'
import { shiftDayKey } from '@/lib/activity-schedule'
import { SUGGEST_WINDOW_DAYS, suggestActivities, type SuggestedActivity, type SuggestionSource } from '@/lib/sold-out'
import { useActivityOverrides } from '@/hooks/use-pricing-override'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { useBookingLedger } from '@/hooks/use-booking-ledger'
import { usePricing } from '@/hooks/use-pricing'
import { LOCAL_NOW, scheduledDaysOf } from '@/hooks/use-scheduled-days'
import { ledgerDaysOf, priceStripDays, shownFromPrice, stripRentalOf, type AvailabilityDay } from '@/components/storefront/booking-widget'
import type { Activity, CurrencyCode } from '@/types'

/* ==========================================================================
   Fully booked — shown in the booking box when the picked day has no spots
   left (or no day in the strip has): the next days with spots, as buttons
   that pick that day, and the other activities the owner picked that have
   spots in the next two weeks, each linking to its page on that date.
   ========================================================================== */

/** Another activity of the business, as the server sent it, with its seeded days. */
export interface OtherActivity {
  activity: Activity
  days: AvailabilityDay[]
}

/** "Sat, Sep 12". */
export const dayLabel = (dateKey: string) => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(fromDateKey(dateKey))

/** What the suggestions are worked out from, besides the other activities: this browser's saves, bookings and prices. */
export interface SuggestionContext {
  overrides: Record<string, ActivityOverride>
  defaults: BookingDefaults
  delta: Record<string, number>
  rules: PricingRule[]
  /** Local ISO. */
  nowIso: string
  pickedKey?: string
  selfId: string
}

/**
 * The picked activities with spots in the next two weeks, each strip built
 * the way its own booking box builds it: the saved schedule, this browser's
 * bookings, the saved prices. Full ones and ones not on sale are left out.
 */
export function suggestionsFrom(others: OtherActivity[], ids: string[], ctx: SuggestionContext): SuggestedActivity[] {
  const todayKey = ctx.nowIso.slice(0, 10)
  const sources: SuggestionSource[] = []
  for (const id of ids) {
    const other = others.find((entry) => entry.activity.id === id)
    if (!other || id === ctx.selfId) continue
    try {
      const saved = ctx.overrides[id]
      const edited = applyActivityOverride(other.activity, saved)
      // Booked by phone or with no set times: no strip to say a day has spots.
      if ((edited.kind ?? 'trip') === 'package' || !showsSchedule(bookingOf(edited))) continue
      const scheduled = ledgerDaysOf(scheduledDaysOf(other.activity, saved, other.days, { defaults: ctx.defaults, nowIso: ctx.nowIso, delta: ctx.delta }), ctx.delta)
      const priced = withBookingDefaults(applyPricingOverride(other.activity, saved), ctx.defaults)
      const rental = stripRentalOf(priced)
      const days = priceStripDays(priced, scheduled, { nowIso: ctx.nowIso, businessRules: ctx.rules, rental, delta: ctx.delta })
      sources.push({ activity: { id, slug: other.activity.slug, name: edited.name, media: edited.media }, days, fromPrice: shownFromPrice(priced, days, rental) })
    } catch {
      // One broken saved edit never hides the others.
    }
  }
  return suggestActivities(ids, sources, { todayKey, lastKey: shiftDayKey(todayKey, SUGGEST_WINDOW_DAYS - 1), pickedKey: ctx.pickedKey, selfId: ctx.selfId })
}

/**
 * The picked activities with spots soon, for the booking box. Their days are
 * asked of the server only once a fully booked day is shown (or passed in as
 * `others`). Empty on the server and until mounted, so hydration matches.
 */
export function useSuggestedActivities(
  others: OtherActivity[] | undefined,
  ids: string[],
  opts: { tenantSlug: string; nowIso?: string; pickedKey?: string; selfId: string; enabled: boolean },
): SuggestedActivity[] {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const overrides = useActivityOverrides()
  const { defaults } = useBookingDefaults(opts.tenantSlug)
  const { delta } = useBookingLedger(opts.tenantSlug)
  const { rules } = usePricing(opts.tenantSlug)
  const now = (opts.nowIso ?? LOCAL_NOW).slice(0, 19)
  const { enabled, pickedKey, selfId, tenantSlug } = opts
  const key = mounted && enabled ? ids.filter((id) => id !== selfId).join(',') : ''
  // Asked for once per set of activities; kept while the guest moves between days.
  const [fetched, setFetched] = React.useState<{ key: string; list: OtherActivity[] }>({ key: '', list: [] })
  React.useEffect(() => {
    if (others || !key || fetched.key === key) return
    let live = true
    suggestedActivityDays(tenantSlug, key.split(','))
      .then((list) => {
        if (live) setFetched({ key, list })
      })
      .catch(() => {
        if (live) setFetched({ key, list: [] })
      })
    return () => {
      live = false
    }
  }, [others, key, fetched.key, tenantSlug])
  const source = others ?? (fetched.key === key ? fetched.list : undefined)
  return React.useMemo(() => {
    if (!key || !source || source.length === 0) return []
    return suggestionsFrom(source, key.split(','), { overrides, defaults, delta, rules, nowIso: now, pickedKey, selfId })
  }, [key, source, overrides, defaults, delta, rules, now, pickedKey, selfId])
}

export function SoldOutPanel({
  title,
  days,
  onPickDay,
  activities,
  basePath,
  currency,
  className,
}: {
  /** "Fully booked on Sat, Sep 12". */
  title: string
  /** The next days with spots to offer; empty: none offered. */
  days: AvailabilityDay[]
  onPickDay: (dateKey: string) => void
  activities: SuggestedActivity[]
  /** The storefront's base path, for the activities' pages. */
  basePath: string
  currency: CurrencyCode
  className?: string
}) {
  const headingId = React.useId()
  return (
    <section aria-labelledby={headingId} className={cn('flex flex-col gap-3 rounded-xl border border-line bg-surface-sunken/60 px-4 py-3.5', className)}>
      <h4 id={headingId} className="text-sm font-semibold text-foreground">
        {title}
      </h4>
      {days.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-subtle">Spots left on</p>
          <div className="flex flex-wrap gap-2">
            {days.map((day) => (
              <button
                key={day.dateKey}
                type="button"
                onClick={() => onPickDay(day.dateKey)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              >
                {dayLabel(day.dateKey)}
                {day.fromPrice > 0 ? <span className="text-xs font-normal text-subtle tabular">{formatCurrency(day.fromPrice, currency, { compact: true })}</span> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {activities.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-subtle">{days.length > 0 ? 'Or try' : 'Try'}</p>
          <ul className="flex list-none flex-col gap-2 p-0">
            {activities.map((item) => (
              <li key={item.id}>
                <Link
                  href={`${basePath}/${item.slug}?date=${item.dateKey}`}
                  className="group flex min-w-0 items-center gap-3 rounded-lg border border-line bg-surface p-2 transition-colors hover:border-primary/50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="relative size-12 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
                    {item.image ? <Image src={item.image.url} alt="" fill sizes="48px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{item.name}</span>
                    <span className="block text-xs text-subtle tabular">
                      {item.fromPrice > 0 ? `From ${formatCurrency(item.fromPrice, currency)} · ` : ''}
                      {dayLabel(item.dateKey)}
                    </span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-faint group-hover:text-primary" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
