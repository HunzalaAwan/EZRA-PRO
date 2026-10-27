import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { bookingOf } from '@/lib/booking-method'

import { NOW, getActivityById, getDepartureById, getStorefront, getStorefrontAvailability, getLocationById, getWaiverById, getPickupZonesByTenant } from '@/lib/demo'
import { locationAddress } from '@/lib/locations'
import { buildDays, buildTransferAvailability, rentalItemsLeftFor } from '@/lib/storefront-availability'
import { decodeTransferQuery, encodeTransferQuery, legsFor, vehiclesLeftAt } from '@/lib/transfers'
import { isGeneratedSlotId, slotFromDeparture } from '@/lib/activity-schedule'
import { bookingReference, seatsRemaining } from '@/lib/utils'
import { decodeChoice } from '@/lib/transport'
import type { Activity, Departure } from '@/types'

/**
 * A time slot from a saved schedule isn't in the seeded strip: it is as the id
 * says, nothing booked, and for rentals with items only what overlapping
 * rentals leave free.
 */
function generatedSlot(activity: Activity, row: Departure) {
  const slot = slotFromDeparture(activity, row)
  const left = rentalItemsLeftFor(activity, row.startsAt)
  if (!left) return slot
  const seatsLeft = Math.min(slot.seatsLeft, Object.values(left).reduce((sum, value) => sum + value, 0))
  return { ...slot, itemsLeft: left, seatsLeft, soldOut: slot.soldOut || seatsLeft <= 0 }
}
import {
  CheckoutFlow,
  type CheckoutDeparture,
} from '@/components/storefront/checkout-flow'
import { checkoutParty, resolveRental, resolveSelection, resolveTransferSelection, transferCheckoutLegs, type RentalRequest } from '@/components/storefront/checkout-selection'

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

  const nowIso = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-${String(NOW.getDate()).padStart(2, '0')}T${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}:00`

  /* ---------- transfers: the ride from the link, one time slot per leg ---------- */

  if (activity.kind === 'transfer') {
    const back = `/book/${tenant.slug}/${activity.slug}`
    const request = decodeTransferQuery(query)
    if (!request) redirect(back)
    const ours = (row: Departure | undefined): row is Departure => Boolean(row && row.activityId === activity.id && row.tenantId === tenant.id && row.status !== 'cancelled')
    const outbound = typeof query.d === 'string' ? getDepartureById(query.d) : undefined
    const inbound = request.trip === 'round_trip' && typeof query.d2 === 'string' ? getDepartureById(query.d2) : undefined
    if (!ours(outbound)) redirect(back)
    if (request.trip === 'round_trip' && (!ours(inbound) || !request.returnAt || request.returnAt <= request.at)) redirect(back)
    const legs = legsFor(activity, request)
    if (legs.length === 0 || legs.length !== (request.trip === 'round_trip' ? 2 : 1)) redirect(back)
    const ids = [outbound.id, ...(inbound ? [inbound.id] : [])]
    // Vehicles free for every leg, as the seeded rides leave them; a shared run counts its seats.
    const { holds } = buildTransferAvailability(activity)
    const lefts = legs.map((leg) => vehiclesLeftAt(activity, holds, leg.pickupAt, leg.busyMinutes))
    const left: Record<string, number> = {}
    for (const entry of lefts) for (const [tierId, count] of Object.entries(entry)) left[tierId] = Math.min(left[tierId] ?? Number.POSITIVE_INFINITY, count)
    const shared = activity.transfer?.service === 'shared'
    const seatsLeft = shared
      ? Math.min(...[outbound, ...(inbound ? [inbound] : [])].map((row) => seatsRemaining(row.capacity, row.booked, row.held)))
      : Object.values(left).reduce((sum, count) => sum + count, 0)
    const selection = resolveTransferSelection(activity, query.t, query.a, request, shared ? undefined : left)
    const runs = [outbound, ...(inbound ? [inbound] : [])]
    // A shared run carries the seats it has left, so checkout can take this browser's bookings off them.
    const checkoutLegs = transferCheckoutLegs(activity, request, legs, ids).map((leg, index) =>
      shared && runs[index] ? { ...leg, seatsLeft: seatsRemaining(runs[index].capacity, runs[index].booked, runs[index].held) } : leg,
    )
    const departure: CheckoutDeparture = {
      id: outbound.id,
      startsAt: checkoutLegs[0].startsAt,
      endsAt: checkoutLegs[checkoutLegs.length - 1].endsAt,
      seatsLeft,
      priceMultiplier: 1,
      capacity: outbound.capacity,
      booked: outbound.booked,
      slotStartsAt: outbound.startsAt,
      slotEndsAt: outbound.endsAt,
      legs: checkoutLegs,
    }
    const seed = `${ids.join('+')}|${new URLSearchParams(encodeTransferQuery(request)).toString()}|${selection.tiers
      .filter((tier) => tier.qty > 0)
      .map((tier) => `${tier.tierId}:${tier.qty}`)
      .join(',')}`
    return (
      <CheckoutFlow
        tenant={tenant}
        activity={activity}
        departure={departure}
        selection={selection}
        transferRequest={request}
        transferHolds={holds}
        request={{ tiers: typeof query.t === 'string' ? query.t : undefined, addOns: typeof query.a === 'string' ? query.a : undefined }}
        basePath={`/book/${tenant.slug}`}
        reference={bookingReference(seed)}
        nowIso={nowIso}
      />
    )
  }

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
      // A time slot from a saved schedule isn't in the seeded strip: it is as the id says, nothing booked.
      const slot = buildDays(inner, 45).flatMap((day) => day.slots).find((entry) => entry.departureId === row.id) ?? (isGeneratedSlotId(row.id) ? generatedSlot(inner, row) : undefined)
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

  /* Day rentals run for n days from the pick-up; charters carry their group size. CheckoutFlow checks the rental again against the saved edit. */
  const rentalRequest: RentalRequest = {
    mode: typeof query.m === 'string' ? query.m : undefined,
    hours: typeof query.h === 'string' ? query.h : undefined,
    days: typeof query.n === 'string' ? query.n : undefined,
    length: typeof query.l === 'string' ? query.l : undefined,
  }
  const rental = resolveRental(activity, rentalRequest, departureRow)
  const rentalMode = rental.mode
  const rentalHours = rental.hours
  const rentalDays = rental.days
  const party = checkoutParty(activity, query.g)

  const site = departureRow.locationId ? getLocationById(departureRow.locationId) : undefined
  const siteMeeting = activity.locations.find((entry) => entry.locationId === departureRow.locationId)?.meetingPoint

  const slotRow = packageLegs
    ? undefined
    : (buildDays(activity, 45).flatMap((day) => day.slots).find((slot) => slot.departureId === departureRow.id) ??
      (isGeneratedSlotId(departureRow.id) ? generatedSlot(activity, departureRow) : undefined))
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
    startsAt: rental.startsAt,
    endsAt: rental.endsAt,
    returnsAt: rental.returnsAt,
    seatsLeft: Math.min(
      seatsRemaining(departureRow.capacity, departureRow.booked, departureRow.held),
      slotRow?.seatsLeft ?? Number.POSITIVE_INFINITY,
    ),
    priceMultiplier: departureRow.priceMultiplier ?? 1,
    // Prices count from the time slot itself (a day rental's pick-up moves startsAt) and how full it is.
    capacity: departureRow.capacity,
    booked: departureRow.booked,
    slotStartsAt: departureRow.startsAt,
    slotEndsAt: departureRow.endsAt,
    locationId: departureRow.locationId,
    location: site
      ? { name: site.name, addressLine: locationAddress(site), meetingPoint: siteMeeting ?? activity.meetingPoint }
      : undefined,
  }

  /* ---------- selection ---------- */

  // The strip the activity page gave the widget: CheckoutFlow rebuilds it from the saved schedule, so spots, seats and prices match what the guest saw.
  const stripDays = packageLegs ? undefined : buildDays(activity)

  const selection = resolveSelection(
    activity,
    query.t,
    query.a,
    Math.max(1, departure.seatsLeft),
    slotRow?.itemsLeft,
    party,
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
      // Transport: the business's zones (the flow keeps the ones the activity serves, with the owner's saved edits) and the widget's choice.
      pickupZones={getPickupZonesByTenant(tenant.id)}
      transport={decodeChoice(query)}
      tenant={tenant}
      activity={activity}
      departure={departure}
      selection={selection}
      rentalDays={rentalDays}
      rentalMode={rentalMode}
      rentalHours={rentalHours}
      rentalLength={rental.lengthId}
      rentalRequest={packageLegs ? undefined : rentalRequest}
      party={party}
      requestedPrivate={query.p === '1'}
      slotEmpty={Boolean(slotRow && slotRow.capacity > 0 && slotRow.seatsLeft >= slotRow.capacity)}
      seededDays={stripDays}
      slotId={packageLegs ? undefined : valid ? requestedId : departureRow.id}
      request={{ tiers: typeof query.t === 'string' ? query.t : undefined, addOns: typeof query.a === 'string' ? query.a : undefined, party: typeof query.g === 'string' ? query.g : undefined }}
      basePath={`/book/${tenant.slug}`}
      reference={reference}
      nowIso={nowIso}
    />
  )
}
