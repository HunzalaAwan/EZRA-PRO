import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { bookingOf } from '@/lib/booking-method'

import { NOW, getActivityById, getDepartureById, getStorefront, getStorefrontAvailability, getLocationById, getWaiverById, getPickupZonesByTenant } from '@/lib/demo'
import { locationAddress } from '@/lib/locations'
import { buildDays } from '@/lib/storefront-availability'
import { bookingReference, clamp, seatsRemaining } from '@/lib/utils'
import type { Activity } from '@/types'
import { rentalModes, type RentalMode } from '@/lib/activity-kinds'

/** A local ISO plus some minutes, still local. */
function plusMinutes(iso: string, minutes: number) {
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() + minutes)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}
import {
  CheckoutFlow,
  type CheckoutDeparture,
} from '@/components/storefront/checkout-flow'
import type { QuoteSelection } from '@/components/storefront/booking-widget'
import { placesOf } from '@/lib/places'

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
  /** Rentals with items: what is left of each. */
  itemsLeft?: Record<string, number>,
): QuoteSelection {
  const requestedTiers = parsePairs(rawTiers)
  const requestedAddOns = parsePairs(rawAddOns)

  let seatsUsed = 0
  const perPerson = (activity.kind ?? 'trip') !== 'charter' && (activity.kind ?? 'trip') !== 'rental'
  const tiers = activity.priceTiers.map((tier) => {
    // The minimum per booking is required; a link without it gets it added.
    const wanted = Math.max(requestedTiers.get(tier.id) ?? 0, perPerson ? tier.minQuantity : 0)
    const places = placesOf(tier)
    const room = places > 0 ? Math.floor(Math.max(0, seatsLeft - seatsUsed) / places) : tier.maxQuantity
    // Each rental item is capped by its own count, not just the total.
    const itemRoom = itemsLeft ? (itemsLeft[tier.id] ?? 0) : Number.POSITIVE_INFINITY
    const qty = clamp(wanted, 0, Math.min(tier.maxQuantity, room, itemRoom))
    seatsUsed += qty * places
    return { tierId: tier.id, qty }
  })

  // A bare /checkout link still has to render a complete, sensible order.
  if (tiers.every((tier) => tier.qty === 0)) {
    const lead = (itemsLeft ? activity.priceTiers.find((tier) => (itemsLeft[tier.id] ?? 0) > 0) : undefined) ?? activity.priceTiers[0]
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

  // Request and call activities are confirmed by the business first; there is nothing to pay here yet.
  if (bookingOf(activity).method !== 'instant') redirect(`/book/${tenant.slug}/${activity.slug}`)

  /* ---------- departure ---------- */

  const requestedId = typeof query.d === 'string' ? query.d : undefined
  const requested = requestedId ? getDepartureById(requestedId) : undefined

  // Packages: one departure per part, in the package's order, each of that part's activity.
  const packageLegs = (() => {
    if (activity.kind !== 'package') return null
    const ids = typeof query.legs === 'string' ? query.legs.split(',') : []
    const parts = activity.package?.parts ?? []
    if (ids.length !== parts.length || parts.length === 0) return null
    const legs = parts.map((part, index) => {
      const row = getDepartureById(ids[index])
      const inner = getActivityById(part.activityId)
      if (!row || !inner || row.activityId !== inner.id || row.tenantId !== tenant.id || row.status === 'cancelled') return null
      const slot = buildDays(inner, 45).flatMap((day) => day.slots).find((entry) => entry.departureId === row.id)
      return {
        row,
        seatsLeft: Math.min(seatsRemaining(row.capacity, row.booked, row.held), slot?.seatsLeft ?? 0),
        leg: {
          departureId: row.id,
          activitySlug: inner.slug,
          activityName: inner.name,
          label: part.label?.trim() || inner.name,
          startsAt: row.startsAt,
          endsAt: row.endsAt,
          meetingPoint: inner.locations.find((entry) => entry.locationId === row.locationId)?.meetingPoint ?? inner.meetingPoint,
        },
      }
    })
    return legs.every(Boolean) ? (legs as NonNullable<(typeof legs)[number]>[]) : null
  })()
  if (activity.kind === 'package' && !packageLegs) redirect(`/book/${tenant.slug}/${activity.slug}`)

  const valid =
    requested &&
    requested.activityId === activity.id &&
    requested.tenantId === tenant.id &&
    requested.status !== 'cancelled'

  const fallback = getStorefrontAvailability(activity.id, 45).find(
    (event) => event.seatsLeft > 0 && event.departure.status !== 'sold_out',
  )?.departure

  const departureRow = packageLegs ? packageLegs[0].row : valid ? requested : fallback
  if (!departureRow) notFound()

  /* Day rentals run for n days from the pick-up; charters carry their group size. */
  const modes = rentalModes(activity)
  const rentalMode = modes.length > 0 ? (modes.includes(query.m as RentalMode) ? (query.m as RentalMode) : modes[0]) : undefined
  const dayRental = (activity.kind ?? 'trip') === 'rental' && (rentalMode ? rentalMode === 'day' : activity.rental?.billing === 'day')
  const minHours = Math.max(1, activity.rental?.minHours ?? 1)
  const lengths = activity.rental?.lengths ?? []
  const rentalLength = rentalMode === 'length' ? (lengths.find((entry) => entry.id === query.l) ?? lengths[0]) : undefined
  const rentalHours =
    rentalMode === 'hour'
      ? clamp(Math.floor(Number(query.h) || minHours), minHours, Math.max(minHours, activity.rental?.maxHours || 12))
      : rentalLength
        ? rentalLength.hours
        : undefined
  const minDays = Math.max(1, activity.rental?.minDays ?? 1)
  const maxDays = Math.max(minDays, activity.rental?.maxDays || 30)
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

  const slotRow = packageLegs ? undefined : buildDays(activity, 45).flatMap((day) => day.slots).find((slot) => slot.departureId === departureRow.id)
  const departure: CheckoutDeparture = packageLegs
    ? {
        id: packageLegs.map((entry) => entry.leg.departureId).join('+'),
        startsAt: packageLegs[0].leg.startsAt,
        endsAt: packageLegs[packageLegs.length - 1].leg.endsAt,
        // The package has room for what its fullest part has room for.
        seatsLeft: Math.min(...packageLegs.map((entry) => entry.seatsLeft)),
        priceMultiplier: 1,
        legs: packageLegs.map((entry) => entry.leg),
      }
    : {
    id: departureRow.id,
    startsAt: pickupAt ?? departureRow.startsAt,
    endsAt: returnsAt ?? (rentalHours ? plusMinutes(departureRow.startsAt, rentalHours * 60) : departureRow.endsAt),
    returnsAt,
    seatsLeft: Math.min(
      seatsRemaining(departureRow.capacity, departureRow.booked, departureRow.held),
      slotRow?.seatsLeft ?? Number.POSITIVE_INFINITY,
    ),
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
    slotRow?.itemsLeft,
  )

  /* ---------- confirmation code (deterministic, seeded) ---------- */

  const seed = `${departure.id}|${rentalMode ?? ''}${rentalHours ?? ''}|${rentalDays}|${party ?? ''}|${selection.tiers
    .filter((tier) => tier.qty > 0)
    .map((tier) => `${tier.tierId}:${tier.qty}`)
    .join(',')}`
  const reference = bookingReference(seed)

  return (
    <CheckoutFlow
      waiver={getWaiverById(activity.waiverId)}
      pickupZones={getPickupZonesByTenant(tenant.id)
        .filter((zone) => zone.active && (activity.pickup?.zoneIds ?? []).includes(zone.id))
        .map((zone) => {
          const price = activity.pickup?.prices?.[zone.id]
          return price ? { ...zone, fee: price.fee, feePer: price.per } : zone
        })}
      tenant={tenant}
      activity={activity}
      departure={departure}
      selection={selection}
      rentalDays={rentalDays}
      rentalMode={rentalMode}
      rentalHours={rentalHours}
      rentalLength={rentalLength?.id}
      party={party}
      privateBooking={query.p === '1' && Boolean(activity.privateOption?.enabled) && Boolean(slotRow && slotRow.seatsLeft >= slotRow.capacity)}
      basePath={`/book/${tenant.slug}`}
      reference={reference}
      nowIso={`${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-${String(NOW.getDate()).padStart(2, '0')}T${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}:00`}
    />
  )
}
