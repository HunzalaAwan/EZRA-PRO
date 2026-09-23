import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { NOW, getDepartureById, getStorefront, getStorefrontAvailability, getLocationById, getWaiverById, getPickupZonesByTenant } from '@/lib/demo'
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
      Math.max(lead.minQuantity, Math.min((activity.kind ?? 'trip') === 'rental' ? 1 : 2, activity.maxCapacity)),
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

  /* Day rentals run for n days from the pick-up; charters carry their group size. */
  const dayRental = (activity.kind ?? 'trip') === 'rental' && activity.rental?.billing === 'day'
  const minDays = Math.max(1, activity.rental?.minDays ?? 1)
  const maxDays = Math.max(minDays, activity.rental?.maxDays ?? 14)
  const rentalDays = dayRental ? clamp(Math.floor(Number(query.n) || minDays), minDays, maxDays) : 1
  const party =
    (activity.kind ?? 'trip') === 'charter'
      ? clamp(Math.floor(Number(query.g) || 2), Math.max(1, activity.minParticipants), activity.charter?.maxGuests ?? activity.maxCapacity)
      : undefined
  const returnsAt = dayRental
    ? (() => {
        const back = new Date(`${departureRow.startsAt.slice(0, 10)}T12:00:00`)
        back.setDate(back.getDate() + rentalDays)
        const key = `${back.getFullYear()}-${String(back.getMonth() + 1).padStart(2, '0')}-${String(back.getDate()).padStart(2, '0')}`
        return `${key}T${activity.rental?.returnTime ?? '17:00'}:00`
      })()
    : undefined
  const pickupAt = dayRental ? `${departureRow.startsAt.slice(0, 10)}T${activity.rental?.pickupTime ?? '09:00'}:00` : undefined

  const site = departureRow.locationId ? getLocationById(departureRow.locationId) : undefined
  const siteMeeting = activity.locations.find((entry) => entry.locationId === departureRow.locationId)?.meetingPoint

  const departure: CheckoutDeparture = {
    id: departureRow.id,
    startsAt: pickupAt ?? departureRow.startsAt,
    endsAt: returnsAt ?? departureRow.endsAt,
    returnsAt,
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

  const seed = `${departure.id}|${rentalDays}|${party ?? ''}|${selection.tiers
    .filter((tier) => tier.qty > 0)
    .map((tier) => `${tier.tierId}:${tier.qty}`)
    .join(',')}`
  const reference = bookingReference(seed)

  return (
    <CheckoutFlow
      waiver={getWaiverById(activity.waiverId)}
      pickupZones={getPickupZonesByTenant(tenant.id).filter((zone) => zone.active && (activity.pickup?.zoneIds ?? []).includes(zone.id))}
      tenant={tenant}
      activity={activity}
      departure={departure}
      selection={selection}
      rentalDays={rentalDays}
      party={party}
      basePath={`/book/${tenant.slug}`}
      reference={reference}
      nowIso={`${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-${String(NOW.getDate()).padStart(2, '0')}T${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}:00`}
    />
  )
}
