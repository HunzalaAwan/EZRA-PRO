import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { getDepartureById, getStorefront, getStorefrontAvailability, getLocationById, getWaiverById } from '@/lib/demo'
import { locationAddress } from '@/lib/locations'
import { bookingReference, clamp, seatsRemaining } from '@/lib/utils'
import type { Activity } from '@/types'
import {
  CheckoutFlow,
  type CheckoutDeparture,
} from '@/components/storefront/checkout-flow'
import type { QuoteSelection } from '@/components/storefront/booking-widget'

interface TenantParams {
  tenant: string
}

export async function generateMetadata({
  params,
}: {
  params: Promise<TenantParams>
}): Promise<Metadata> {
  const { tenant: slug } = await params
  const storefront = getStorefront(slug)
  return {
    title: { absolute: `Checkout · ${storefront?.tenant.name ?? 'Booking'}` },
    robots: { index: false, follow: false },
  }
}

/* ==========================================================================
   URL → SELECTION

   The widget encodes its state as `t=tierId:qty|tierId:qty` and
   `a=addOnId:qty|…`. Everything is re-validated here against the activity, so
   a hand-edited URL can never produce a quote the operator would not honour.
   ========================================================================== */

function parsePairs(raw: string | string[] | undefined): Map<string, number> {
  const out = new Map<string, number>()
  if (typeof raw !== 'string') return out
  for (const chunk of raw.split('|')) {
    const [id, value] = chunk.split(':')
    const qty = Number(value)
    if (!id || !Number.isFinite(qty) || qty <= 0) continue
    out.set(id, Math.floor(qty))
  }
  return out
}

function resolveSelection(
  activity: Activity,
  rawTiers: string | string[] | undefined,
  rawAddOns: string | string[] | undefined,
  seatsLeft: number,
): QuoteSelection {
  const requestedTiers = parsePairs(rawTiers)
  const requestedAddOns = parsePairs(rawAddOns)

  let seatsUsed = 0
  const tiers = activity.priceTiers.map((tier) => {
    const wanted = requestedTiers.get(tier.id) ?? 0
    const room = tier.countsTowardCapacity ? Math.max(0, seatsLeft - seatsUsed) : tier.maxQuantity
    const qty = clamp(wanted, 0, Math.min(tier.maxQuantity, room))
    if (tier.countsTowardCapacity) seatsUsed += qty
    return { tierId: tier.id, qty }
  })

  // A bare /checkout link still has to render a complete, sensible order.
  if (tiers.every((tier) => tier.qty === 0)) {
    const lead = activity.priceTiers[0]
    const fallback = clamp(
      Math.max(lead.minQuantity, Math.min(2, activity.maxCapacity)),
      1,
      Math.max(1, Math.min(lead.maxQuantity, seatsLeft)),
    )
    tiers[0] = { tierId: lead.id, qty: fallback }
  }

  const headcount = tiers.reduce((total, tier) => total + tier.qty, 0)
  const addOns = activity.addOns.map((addOn) => ({
    addOnId: addOn.id,
    qty: clamp(
      requestedAddOns.get(addOn.id) ?? 0,
      0,
      addOn.maxPerBooking ?? Math.max(1, headcount),
    ),
  }))

  return { tiers, addOns }
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<TenantParams>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { tenant: slug } = await params
  const query = await searchParams

  const storefront = getStorefront(slug)
  if (!storefront) notFound()

  const { tenant, activities, featured } = storefront
  if (activities.length === 0) notFound()

  /* ---------- activity ---------- */

  const requestedSlug = typeof query.activity === 'string' ? query.activity : undefined
  const activity =
    activities.find((item) => item.slug === requestedSlug) ?? featured[0] ?? activities[0]

  /* ---------- departure ---------- */

  const requestedId = typeof query.d === 'string' ? query.d : undefined
  const requested = requestedId ? getDepartureById(requestedId) : undefined

  const valid =
    requested &&
    requested.activityId === activity.id &&
    requested.tenantId === tenant.id &&
    requested.status !== 'cancelled'

  const fallback = getStorefrontAvailability(activity.id, 45).find(
    (event) => event.seatsLeft > 0 && event.departure.status !== 'sold_out',
  )?.departure

  const departureRow = valid ? requested : fallback
  if (!departureRow) notFound()

  const site = departureRow.locationId ? getLocationById(departureRow.locationId) : undefined
  const siteMeeting = activity.locations.find((entry) => entry.locationId === departureRow.locationId)?.meetingPoint

  const departure: CheckoutDeparture = {
    id: departureRow.id,
    startsAt: departureRow.startsAt,
    endsAt: departureRow.endsAt,
    seatsLeft: seatsRemaining(departureRow.capacity, departureRow.booked, departureRow.held),
    priceMultiplier: departureRow.priceMultiplier ?? 1,
    location: site
      ? { name: site.name, addressLine: locationAddress(site), meetingPoint: siteMeeting ?? activity.meetingPoint }
      : undefined,
  }

  /* ---------- selection ---------- */

  const selection = resolveSelection(
    activity,
    query.t,
    query.a,
    Math.max(1, departure.seatsLeft),
  )

  /* ---------- confirmation code (deterministic, seeded) ---------- */

  const seed = `${departure.id}|${selection.tiers
    .filter((tier) => tier.qty > 0)
    .map((tier) => `${tier.tierId}:${tier.qty}`)
    .join(',')}`
  const reference = bookingReference(seed)

  return (
    <CheckoutFlow
      waiver={getWaiverById(activity.waiverId)}
      tenant={tenant}
      activity={activity}
      departure={departure}
      selection={selection}
      basePath={`/book/${tenant.slug}`}
      reference={reference}
    />
  )
}
