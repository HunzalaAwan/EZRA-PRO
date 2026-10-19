'use server'

import { getAbandonedCheckouts } from '@/lib/data/abandoned'
import { NOW } from '@/lib/data/constants'
import { COUNTRY_NAME_BY_CODE, DEPARTURES, getActivitiesByTenant, getBookingRows, getCustomersByTenant, getDefaultLocation, isoLocal, tenantById } from '@/lib/demo'
import {
  createWorld,
  simulate,
  withExtras,
  type FlowExtras,
  type FlowWorld,
  type WorldBooking,
  type WorldDeparture,
  type WorldGuest,
} from '@/lib/flows/engine'
import type { Flow, FlowRun, JourneyEvent } from '@/lib/flows/types'
import { steady } from '@/lib/marketing'
import { defaultGiftCards } from '@/lib/pricing'

/* ==========================================================================
   Server actions for automations: the simulator runs here, next to the
   demo bookings, and the browser only gets the numbers back. The world for
   each business is built once and kept in module scope.
   ========================================================================== */

export type { FlowExtras } from '@/lib/flows/engine'

interface Cached {
  world: FlowWorld
  byReference: Map<string, WorldBooking>
}

/** One world per business and clock. Kept small: the clock comes from the browser. */
const worlds = new Map<string, Cached>()
const MAX_WORLDS = 8

const CHILD_TIER = /child|kid|junior|youth|infant/i

function cachedWorld(tenantId: string, nowIso?: string): Cached {
  const now = nowIso && !Number.isNaN(new Date(nowIso).getTime()) ? nowIso : isoLocal(NOW)
  const cacheKey = `${tenantId}|${now}`
  const cached = worlds.get(cacheKey)
  if (cached) return cached

  const tenant = tenantById.get(tenantId)
  const defaultLocation = getDefaultLocation(tenantId)?.id ?? null
  const activities = getActivitiesByTenant(tenantId)
  const activityById = new Map(activities.map((activity) => [activity.id, activity]))
  const nowMs = new Date(now).getTime()

  const bookings: WorldBooking[] = []
  const firstChannel = new Map<string, { at: string; channel: string }>()
  for (const { booking, activity, departure } of getBookingRows(tenantId)) {
    const addOnIdByLabel = new Map(activity.addOns.map((addOn) => [addOn.label, addOn.id]))
    const addOns: string[] = []
    for (const item of booking.lineItems) {
      if (item.kind !== 'addon') continue
      addOns.push(item.label)
      const id = addOnIdByLabel.get(item.label)
      if (id) addOns.push(id)
    }
    const ages = booking.participants.map((p) => p.age ?? 0).filter((age) => age > 0)
    bookings.push({
      id: booking.id,
      reference: booking.reference,
      customerId: booking.customerId,
      activitySlug: activity.slug,
      activityName: activity.name,
      kind: activity.kind,
      departureId: booking.departureId,
      locationId: departure.locationId ?? defaultLocation,
      departureAt: booking.departureAt,
      endsAt: departure.endsAt,
      createdAt: booking.createdAt,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      partySize: booking.partySize,
      total: booking.total,
      amountPaid: booking.amountPaid,
      channel: booking.channel,
      promoCode: booking.promoCode ?? null,
      addOns,
      ages,
      waiversMissing: booking.participants.filter((p) => !p.waiverSigned).length,
      hasChildren: booking.participants.some((p) => (p.age !== undefined && p.age < 13) || CHILD_TIER.test(p.tierLabel)),
      rating: booking.rating ?? null,
      cancelledAt: booking.cancelledAt ?? null,
    })
    const seen = firstChannel.get(booking.customerId)
    if (!seen || booking.createdAt < seen.at) firstChannel.set(booking.customerId, { at: booking.createdAt, channel: booking.channel })
  }

  const guests: WorldGuest[] = getCustomersByTenant(tenantId).map((customer) => ({
    id: customer.id,
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    country: COUNTRY_NAME_BY_CODE.get(customer.country) ?? customer.country,
    tags: customer.tags,
    segment: customer.segment,
    emailOptIn: customer.marketingOptIn,
    // The same rule as the marketing guest list, so the counts agree.
    smsOptIn: customer.marketingOptIn && Boolean(customer.phone) && steady(`sms-${customer.id}`) > 0.45,
    totalBookings: customer.totalBookings,
    lifetimeValue: customer.lifetimeValue,
    lastBookingAt: customer.lastBookingAt,
    createdAt: customer.createdAt,
    joinSource: firstChannel.get(customer.id)?.channel === 'walk_in' ? 'walk_in' : 'checkout',
  }))

  const departures: WorldDeparture[] = []
  for (const d of DEPARTURES) {
    if (d.tenantId !== tenantId) continue
    const activity = activityById.get(d.activityId)
    if (!activity) continue
    departures.push({
      id: d.id,
      activitySlug: activity.slug,
      activityName: activity.name,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      capacity: d.capacity,
      booked: d.booked,
      status: d.status,
      weather: d.weather ? { condition: d.weather.condition, goConfidence: d.weather.goConfidence } : null,
      locationId: d.locationId ?? defaultLocation,
    })
  }

  const carts = tenant ? getAbandonedCheckouts(tenant) : []
  for (const cart of carts) {
    // A cart that came back and paid is a booking the guest really made.
    if (cart.status !== 'recovered' || !cart.recoveredAt || new Date(cart.recoveredAt).getTime() > nowMs) continue
    bookings.push({
      id: `${cart.id}_paid`,
      reference: cart.id.toUpperCase(),
      customerId: cart.customer.id,
      activitySlug: cart.activity.slug,
      activityName: cart.activity.name,
      kind: cart.activity.kind,
      departureId: cart.departure.id,
      locationId: cart.departure.locationId ?? defaultLocation,
      departureAt: cart.departure.startsAt,
      endsAt: cart.departure.endsAt,
      createdAt: isoLocal(new Date(cart.recoveredAt)),
      status: 'confirmed',
      paymentStatus: 'paid',
      partySize: cart.partySize,
      total: cart.total,
      amountPaid: cart.total,
      channel: 'direct',
      promoCode: cart.discountPercent ? `BACK${cart.discountPercent}` : null,
      addOns: [],
      ages: [],
      waiversMissing: 0,
      hasChildren: false,
      rating: null,
      cancelledAt: null,
      recoveredCart: true,
    })
  }

  const world = createWorld({
    tenantId,
    slug: tenant?.slug ?? '',
    business: tenant?.name ?? 'Your business',
    currency: tenant?.currency ?? 'USD',
    homeCountry: tenant?.country ?? '',
    nowIso: now,
    bookings,
    guests,
    departures,
    giftCards: defaultGiftCards(tenant?.slug ?? '').map((card) => ({ ...card })),
    abandoned: carts.map((cart) => ({
      id: cart.id,
      customerId: cart.customer.id,
      activitySlug: cart.activity.slug,
      activityName: cart.activity.name,
      departureId: cart.departure.id,
      partySize: cart.partySize,
      total: cart.total,
      abandonedAt: cart.abandonedAt,
      status: cart.status,
      recoveredAt: cart.recoveredAt,
    })),
  })
  const entry: Cached = { world, byReference: new Map(bookings.map((b) => [b.reference, b])) }
  if (worlds.size >= MAX_WORLDS) {
    const oldest = worlds.keys().next().value
    if (oldest !== undefined) worlds.delete(oldest)
  }
  worlds.set(cacheKey, entry)
  return entry
}

function worldFor(tenantId: string, nowIso?: string): FlowWorld {
  return cachedWorld(tenantId, nowIso).world
}

/** Numbers for every flow on the list. Journeys are left out to keep it small. */
export async function runFlows(tenantId: string, flows: Flow[], extras: FlowExtras = {}): Promise<Record<string, Omit<FlowRun, 'journeys'>>> {
  const world = withExtras(worldFor(tenantId, extras.nowIso), extras)
  const out: Record<string, Omit<FlowRun, 'journeys'>> = {}
  for (const flow of flows) {
    const run: Omit<FlowRun, 'journeys'> & Partial<Pick<FlowRun, 'journeys'>> = simulate(flow, world, { journeys: 0 })
    delete run.journeys
    out[flow.id] = run
  }
  return out
}

/** One flow in full, for the builder: numbers, per-step stats and journeys (the focus guest first). */
export async function runFlow(tenantId: string, flow: Flow, extras: FlowExtras = {}, focusGuestId?: string): Promise<FlowRun> {
  const world = withExtras(worldFor(tenantId, extras.nowIso), extras)
  return simulate(flow, world, { focusGuestId })
}

/** Guests to preview a flow as: by name or email, or the latest bookers when the search is empty. */
export async function findGuests(tenantId: string, query: string): Promise<{ id: string; name: string; email: string; lastTrip?: string }[]> {
  const world = worldFor(tenantId)
  const q = query.trim().toLowerCase()
  const scored: { guest: WorldGuest; score: number }[] = []
  for (const guest of world.guests.values()) {
    if (guest.pseudo) continue
    const name = `${guest.firstName} ${guest.lastName}`.toLowerCase()
    const email = guest.email.toLowerCase()
    let score: number
    if (!q) score = 0
    else if (name.startsWith(q) || email.startsWith(q)) score = 3
    else if (name.split(' ').some((part) => part.startsWith(q))) score = 2
    else if (name.includes(q) || email.includes(q)) score = 1
    else continue
    scored.push({ guest, score })
  }
  scored.sort((a, b) => b.score - a.score || (b.guest.lastBookingAt ?? '').localeCompare(a.guest.lastBookingAt ?? ''))
  const fmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return scored.slice(0, 8).map(({ guest }) => {
    const own = (world.bookingsByGuest.get(guest.id) ?? []).filter((b) => !b.recoveredCart)
    // Their latest trip so far, or the next one when they have not been yet.
    const been = own.filter((b) => b.startMs <= world.nowMs)
    const last = been.length > 0 ? been.reduce((a, b) => (b.startMs > a.startMs ? b : a)) : own.length > 0 ? own.reduce((a, b) => (b.startMs < a.startMs ? b : a)) : undefined
    return {
      id: guest.id,
      name: `${guest.firstName} ${guest.lastName}`.trim(),
      email: guest.email,
      ...(last ? { lastTrip: `${last.activityName} · ${fmt.format(new Date(last.departureAt))}` } : {}),
    }
  })
}

/** What each live automation did, or will do, for one booking — for the booking record. */
export async function flowsForBooking(
  tenantId: string,
  flows: Flow[],
  reference: string,
  extras: FlowExtras = {},
): Promise<{ flowId: string; flowName: string; events: JourneyEvent[] }[]> {
  const cached = cachedWorld(tenantId, extras.nowIso)
  const world = withExtras(cached.world, extras)
  const booking = cached.byReference.get(reference)
  if (!booking) return []
  const createdMs = new Date(booking.createdAt).getTime()
  // Reach back far enough to see the booking being made.
  const days = Math.min(420, Math.max(60, Math.ceil((world.nowMs - createdMs) / 86_400_000) + 2))
  const out: { flowId: string; flowName: string; events: JourneyEvent[] }[] = []
  for (const flow of flows) {
    if (flow.status !== 'live') continue
    const run = simulate(flow, world, { days, aheadDays: 30, journeys: 0, focusGuestId: booking.customerId, onlyGuestId: booking.customerId, previewIfAbsent: false })
    const events: JourneyEvent[] = []
    for (const journey of run.journeys) {
      if (journey.state === 'skipped' || journey.state === 'holdout') continue
      const about = journey.reference === reference
      const creditedHere =
        !journey.reference && journey.events.some((event) => event.kind === 'booked' && event.value === booking.total && new Date(event.at).getTime() === createdMs)
      if (about || creditedHere) events.push(...journey.events)
    }
    if (events.length > 0) out.push({ flowId: flow.id, flowName: flow.name, events })
  }
  return out
}
