import { NOW, getActivitiesByTenant, getCustomersByTenant, getUpcomingDepartures } from '@/lib/demo'
import { createRng, rngInt, rngPick, rngWeighted } from '@/lib/utils'
import type { Activity, Customer, Departure, Tenant } from '@/types'

/* ==========================================================================
   Abandoned checkouts — guests who picked a date and seats, opened the
   checkout, and did not pay. Generated deterministically per tenant from
   the seeded customers, activities and departures, so the page reads the
   same on every load and every operator has a realistic queue to work.
   ========================================================================== */

export type AbandonedStage = 'details' | 'payment'
export type AbandonedStatus = 'open' | 'reminded' | 'recovered' | 'expired'
export type AbandonedDevice = 'phone' | 'desktop'
export type AbandonedSource = 'storefront' | 'widget' | 'google'

export interface AbandonedCheckout {
  id: string
  tenantId: string
  customer: Customer
  activity: Activity
  departure: Departure
  partySize: number
  /** Minor units: what the cart was worth including the fee lines. */
  total: number
  /** Where they stopped. */
  stage: AbandonedStage
  device: AbandonedDevice
  source: AbandonedSource
  abandonedAt: string
  status: AbandonedStatus
  remindersSent: number
  lastReminderAt: string | null
  recoveredAt: string | null
  /** Set when a reminder carried a discount. */
  discountPercent: number | null
  /** The link that reopens their cart with the seats still selected. */
  checkoutUrl: string
}

export const ABANDONED_STATUS_META: Record<AbandonedStatus, { label: string; tone: string; hint: string }> = {
  open: { label: 'Open', tone: 'bg-warning', hint: 'No reminder sent yet.' },
  reminded: { label: 'Reminded', tone: 'bg-info', hint: 'At least one reminder has gone out.' },
  recovered: { label: 'Recovered', tone: 'bg-success', hint: 'They came back and paid.' },
  expired: { label: 'Expired', tone: 'bg-line-strong', hint: 'The departure passed or the seats were released.' },
}

export const ABANDONED_STAGE_LABEL: Record<AbandonedStage, string> = {
  details: 'Left at details',
  payment: 'Left at payment',
}

const hash = (value: string) => [...value].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7)

const cache = new Map<string, AbandonedCheckout[]>()

export function getAbandonedCheckouts(tenant: Tenant): AbandonedCheckout[] {
  const cached = cache.get(tenant.id)
  if (cached) return cached

  const rng = createRng(hash(`${tenant.id}:abandoned`))
  const customers = getCustomersByTenant(tenant.id)
  const activities = getActivitiesByTenant(tenant.id).filter((a) => a.status === 'live')
  const departures = getUpcomingDepartures(tenant.id, 60).filter((d) => d.status !== 'cancelled')
  const byActivity = new Map(activities.map((a) => [a.id, a]))
  const usable = departures.filter((d) => byActivity.has(d.activityId))

  if (customers.length === 0 || usable.length === 0) {
    cache.set(tenant.id, [])
    return []
  }

  const count = Math.min(38, Math.max(18, Math.round(customers.length / 140)))
  const seen = new Set<string>()
  const rows: AbandonedCheckout[] = []

  for (let i = 0; rows.length < count && i < count * 4; i++) {
    const customer = rngPick(rng, customers)
    if (seen.has(customer.id)) continue
    seen.add(customer.id)

    const departure = rngPick(rng, usable)
    const activity = byActivity.get(departure.activityId)!
    const partySize = rngWeighted(rng, [
      [1, 2],
      [2, 5],
      [3, 2],
      [4, 2],
      [6, 1],
    ])
    const subtotal = (departure.priceOverride ?? activity.basePrice) * partySize
    const total = Math.round(subtotal * 1.085)

    const minutesAgo = rngWeighted(rng, [
      [rngInt(rng, 4, 55), 4],
      [rngInt(rng, 60, 60 * 20), 5],
      [rngInt(rng, 60 * 24, 60 * 24 * 6), 5],
      [rngInt(rng, 60 * 24 * 6, 60 * 24 * 14), 3],
    ])
    const abandonedAt = new Date(NOW.getTime() - minutesAgo * 60_000)

    let status: AbandonedStatus =
      minutesAgo < 45
        ? 'open'
        : rngWeighted(rng, [
            ['open', 3],
            ['reminded', 4],
            ['recovered', 3],
            ['expired', minutesAgo > 60 * 24 * 5 ? 4 : 1],
          ])
    if (new Date(departure.startsAt).getTime() < NOW.getTime() && status !== 'recovered') status = 'expired'

    const remindersSent =
      status === 'open' ? 0 : status === 'reminded' ? rngInt(rng, 1, 2) : status === 'recovered' ? rngInt(rng, 0, 2) : 2
    const lastReminderAt =
      remindersSent > 0 ? new Date(abandonedAt.getTime() + 45 * 60_000 * remindersSent).toISOString() : null
    const recoveredAt =
      status === 'recovered'
        ? new Date(abandonedAt.getTime() + rngInt(rng, 30, 60 * 30) * 60_000).toISOString()
        : null
    const discountPercent = remindersSent >= 2 ? 10 : null

    rows.push({
      id: `cart_${hash(`${tenant.id}:${customer.id}:${departure.id}`).toString(36)}`,
      tenantId: tenant.id,
      customer,
      activity,
      departure,
      partySize,
      total,
      stage: rngWeighted(rng, [
        ['payment', 6],
        ['details', 4],
      ]),
      device: rngWeighted(rng, [
        ['phone', 7],
        ['desktop', 3],
      ]),
      source: rngWeighted(rng, [
        ['storefront', 6],
        ['widget', 3],
        ['google', 1],
      ]),
      abandonedAt: abandonedAt.toISOString(),
      status,
      remindersSent,
      lastReminderAt,
      recoveredAt,
      discountPercent,
      checkoutUrl: `/book/${tenant.slug}/checkout?activity=${activity.slug}&d=${departure.id}&t=${activity.priceTiers[0]?.id ?? 'adult'}:${partySize}`,
    })
  }

  rows.sort((a, b) => b.abandonedAt.localeCompare(a.abandonedAt))
  cache.set(tenant.id, rows)
  return rows
}

/** The count the sidebar shows: carts still worth a nudge. */
export function countOpenAbandoned(tenant: Tenant): number {
  return getAbandonedCheckouts(tenant).filter((row) => row.status === 'open' || row.status === 'reminded').length
}
