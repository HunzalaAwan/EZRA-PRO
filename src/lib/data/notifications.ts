/**
 * EZRA PRO — the notification bell and the activity feed.
 *
 * Both are derived, never authored. Every line here points at a row that exists:
 * a real booking someone can open, a real departure filling up, a real failed
 * capture. That matters more than it sounds — a demo where the bell says
 * "new booking from Sarah" and no Sarah exists is the moment the illusion breaks.
 *
 * Timestamps come off the source rows wherever the source has one. The few
 * events that are *about* the future (a departure that is nearly sold out, a
 * weather hold on Saturday) get a seeded observation time shortly before
 * {@link NOW}, written in the same suffix-free local ISO format as the rest of
 * the seed data.
 */

import type {
  ActivityFeedItem,
  Booking,
  Customer,
  NotificationItem,
  User,
} from '@/types'
import {
  addMinutes,
  createRng,
  fillRate,
  formatCurrency,
  formatDateShort,
  formatTime,
  hashSeed,
  pluralize,
  rngInt,
  rngPick,
  seatsRemaining,
} from '@/lib/utils'
import { NOW, seedKey } from './constants'
import { getActivityById } from './activities'
import { getBookingById, getBookingsByTenant, getRecentBookings } from './bookings'
import { getCustomerById } from './customers'
import { getDeparturesInRange, getUpcomingDepartures } from './departures'
import { getPaymentsByTenant } from './payments'
import { getResourcesByTenant } from './resources'
import { getTenantById } from './tenants'
import { getUsersByTenant } from './users'

/** Local ISO with no zone suffix — matches every other timestamp in the seed. */
function localIso(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function guestName(customer: Customer | undefined): string {
  return customer ? `${customer.firstName} ${customer.lastName}` : 'A guest'
}

function departureLabel(iso: string): string {
  return `${formatDateShort(iso)} at ${formatTime(iso)}`
}

/**
 * A feed cannot report something that has not happened yet. Departures the
 * operator called off in advance carry a `cancelledAt` that sits in the future
 * relative to {@link NOW}, so every stream is clamped to the present.
 */
function hasHappened(iso: string): boolean {
  return Date.parse(iso) <= NOW.getTime()
}

/* ==========================================================================
   NOTIFICATIONS
   ========================================================================== */

const NOTIFICATIONS_CACHE = new Map<string, NotificationItem[]>()

/**
 * The bell. Twelve items spanning the six notification kinds, newest first, with
 * the four most recent left unread so the badge has something to say.
 */
export function getNotifications(tenantId: string): NotificationItem[] {
  const cached = NOTIFICATIONS_CACHE.get(tenantId)
  if (cached) return cached

  const tenant = getTenantById(tenantId)
  const currency = tenant?.currency ?? 'USD'
  const rng = createRng(hashSeed(seedKey('notifications', tenantId)))
  const items: NotificationItem[] = []
  let sequence = 0

  const push = (item: Omit<NotificationItem, 'id' | 'tenantId' | 'read'>) => {
    items.push({ id: `ntf_${tenantId}_${++sequence}`, tenantId, read: false, ...item })
  }

  /* --- new bookings ----------------------------------------------------- */
  const recent = getRecentBookings(tenantId, 60)
  for (const booking of recent.filter((row) => row.status !== 'cancelled').slice(0, 4)) {
    const activity = getActivityById(booking.activityId)
    push({
      kind: 'booking',
      severity: 'success',
      title: `New booking · ${activity?.name ?? 'Activity'}`,
      body: `${guestName(getCustomerById(booking.customerId))} booked ${booking.partySize} ${pluralize(
        booking.partySize,
        'seat',
      )} for ${departureLabel(booking.departureAt)} · ${formatCurrency(booking.total, currency)}`,
      createdAt: booking.createdAt,
      href: `/bookings/${booking.id}`,
    })
  }

  /* --- cancellations ----------------------------------------------------- */
  const cancellations = getBookingsByTenant(tenantId)
    .filter(
      (booking): booking is Booking & { cancelledAt: string } =>
        booking.cancelledAt !== undefined && hasHappened(booking.cancelledAt),
    )
    .sort((a, b) => Date.parse(b.cancelledAt) - Date.parse(a.cancelledAt))
  for (const booking of cancellations.slice(0, 2)) {
    const activity = getActivityById(booking.activityId)
    push({
      kind: 'cancellation',
      severity: 'warning',
      title: `Cancellation · ${activity?.name ?? 'Activity'}`,
      body: `${guestName(getCustomerById(booking.customerId))} cancelled ${
        booking.partySize
      } ${pluralize(booking.partySize, 'seat')} on ${departureLabel(booking.departureAt)}${
        booking.refundAmount ? ` · ${formatCurrency(booking.refundAmount, currency)} refunded` : ''
      }. ${booking.cancellationReason ?? 'No reason given.'}`,
      createdAt: booking.cancelledAt,
      href: `/bookings/${booking.id}`,
    })
  }

  /* --- capacity ---------------------------------------------------------- */
  const upcoming = getUpcomingDepartures(tenantId, 120)
  const filling = upcoming
    .filter((departure) => departure.capacity > 0 && fillRate(departure.booked, departure.capacity) >= 88)
    .slice(0, 2)
  for (const departure of filling) {
    const activity = getActivityById(departure.activityId)
    const remaining = seatsRemaining(departure.capacity, departure.booked, departure.held)
    push({
      kind: 'capacity',
      severity: remaining === 0 ? 'warning' : 'info',
      title:
        remaining === 0
          ? `Sold out · ${activity?.name ?? 'Activity'}`
          : `${remaining} ${pluralize(remaining, 'seat')} left · ${activity?.name ?? 'Activity'}`,
      body:
        remaining === 0
          ? `${departureLabel(departure.startsAt)} is full at ${departure.booked} guests. Open a waitlist or add a second departure while demand is live.`
          : `${departureLabel(departure.startsAt)} is ${Math.round(
              fillRate(departure.booked, departure.capacity),
            )}% full with ${remaining} ${pluralize(remaining, 'seat')} unsold.`,
      createdAt: localIso(addMinutes(NOW, -rngInt(rng, 25, 400))),
      href: '/calendar',
    })
  }

  /* --- weather ------------------------------------------------------------ */
  const held = upcoming.find((departure) => departure.status === 'weather_hold')
  if (held) {
    const activity = getActivityById(held.activityId)
    push({
      kind: 'system',
      severity: 'warning',
      title: `Weather hold · ${activity?.name ?? 'Activity'}`,
      body: `${departureLabel(held.startsAt)} is on hold — ${
        held.weather
          ? `${held.weather.condition} conditions, ${held.weather.windKts} kt, ${held.weather.goConfidence}% confidence of running`
          : 'conditions under review'
      }. ${held.booked} ${pluralize(held.booked, 'guest')} are waiting on a call.`,
      createdAt: localIso(addMinutes(NOW, -rngInt(rng, 40, 180))),
      href: '/calendar',
    })
  }

  /* --- payments ----------------------------------------------------------- */
  const payments = getPaymentsByTenant(tenantId)
  const failed = payments
    .filter((payment) => payment.status === 'failed')
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
  if (failed) {
    const booking = getBookingById(failed.bookingId)
    push({
      kind: 'payment',
      severity: 'danger',
      title: 'Payment failed',
      body: `${formatCurrency(failed.amount, currency)} on ${
        booking?.reference ?? failed.bookingId
      } was declined${booking ? ` for ${guestName(getCustomerById(booking.customerId))}` : ''}. Send a new payment link before the departure cut-off.`,
      createdAt: failed.createdAt,
      href: booking ? `/bookings/${booking.id}` : '/payments',
    })
  }

  const pending = payments
    .filter((payment) => payment.status === 'pending')
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0]
  if (pending) {
    const booking = getBookingById(pending.bookingId)
    push({
      kind: 'payment',
      severity: 'info',
      title: 'Balance due',
      body: `${formatCurrency(pending.amount, currency)} outstanding on ${
        booking?.reference ?? pending.bookingId
      }${booking ? ` · departs ${departureLabel(booking.departureAt)}` : ''}. Automatic capture runs 48 hours out.`,
      createdAt: pending.createdAt,
      href: '/payments',
    })
  }

  /* --- reviews ------------------------------------------------------------ */
  const reviews = getBookingsByTenant(tenantId)
    .filter((booking) => booking.rating !== undefined && booking.reviewText && hasHappened(booking.updatedAt))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  for (const booking of reviews.slice(0, 2)) {
    const activity = getActivityById(booking.activityId)
    const rating = booking.rating ?? 5
    push({
      kind: 'review',
      severity: rating >= 4 ? 'success' : 'warning',
      title: `${rating}★ review · ${activity?.name ?? 'Activity'}`,
      body: `${guestName(getCustomerById(booking.customerId))}: “${booking.reviewText}”`,
      createdAt: booking.updatedAt,
      href: '/reviews',
    })
  }

  /* --- resources ---------------------------------------------------------- */
  const downResource = getResourcesByTenant(tenantId).find(
    (resource) => resource.status === 'maintenance',
  )
  if (downResource) {
    const affected = getDeparturesInRange(tenantId, NOW, addMinutes(NOW, 7 * 24 * 60)).filter(
      (departure) => departure.assignedResourceIds.includes(downResource.id),
    )
    push({
      kind: 'system',
      severity: 'info',
      title: `${downResource.name} is in maintenance`,
      body: `${downResource.notes ?? 'Scheduled maintenance.'} ${
        affected.length > 0
          ? `${affected.length} ${pluralize(affected.length, 'departure')} in the next seven days still reference it.`
          : 'No departures in the next seven days are affected.'
      }`,
      createdAt: localIso(addMinutes(NOW, -rngInt(rng, 200, 1400))),
      href: '/settings',
    })
  }

  /* --- platform ----------------------------------------------------------- */
  push({
    kind: 'system',
    severity: 'info',
    title: 'Payout sent',
    body: `Yesterday’s takings have been sent to your ${
      tenant?.contact.email.split('@')[1] ?? 'registered'
    } account. The statement reconciles line by line to the bookings behind it.`,
    createdAt: localIso(addMinutes(NOW, -rngInt(rng, 480, 900))),
    href: '/payments',
  })

  const ordered = items
    .filter((item) => hasHappened(item.createdAt))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 12)
  // The four newest stay unread so the badge count is meaningful and stable.
  const withRead = ordered.map((item, index) => ({ ...item, read: index >= 4 }))

  NOTIFICATIONS_CACHE.set(tenantId, withRead)
  return withRead
}

/** Unread count for the bell badge. */
export function getUnreadNotificationCount(tenantId: string): number {
  return getNotifications(tenantId).filter((item) => !item.read).length
}

/* ==========================================================================
   ACTIVITY FEED
   ========================================================================== */

const FEED_CACHE = new Map<string, ActivityFeedItem[]>()

/**
 * Seeded off the row id rather than a shared stream, so the same departure
 * always shows the same crew member no matter what else the feed contains.
 */
function pickStaff(staff: User[], key: string): User | undefined {
  if (staff.length === 0) return undefined
  return rngPick(createRng(hashSeed(seedKey('feed', key))), staff)
}

/**
 * The "what just happened" stream on the dashboard.
 *
 * Twenty-two events woven from bookings, cancellations, check-ins, payments,
 * reviews and operational actions, newest first. Actors are real: guests come
 * from the booking, crew from the tenant's roster.
 */
export function getActivityFeed(tenantId: string, limit = 22): ActivityFeedItem[] {
  const cacheKey = `${tenantId}|${limit}`
  const cached = FEED_CACHE.get(cacheKey)
  if (cached) return cached

  const tenant = getTenantById(tenantId)
  const currency = tenant?.currency ?? 'USD'
  const staff = getUsersByTenant(tenantId).filter((user) => user.status === 'active')
  const rng = createRng(hashSeed(seedKey('feed', tenantId)))

  const events: ActivityFeedItem[] = []
  let sequence = 0
  const push = (item: Omit<ActivityFeedItem, 'id' | 'tenantId'>) => {
    events.push({ id: `afi_${tenantId}_${++sequence}`, tenantId, ...item })
  }

  const recent = getRecentBookings(tenantId, 80)

  /* --- guests booking ------------------------------------------------------ */
  for (const booking of recent.filter((row) => row.status !== 'cancelled').slice(0, 9)) {
    const customer = getCustomerById(booking.customerId)
    const activity = getActivityById(booking.activityId)
    push({
      actor: guestName(customer),
      ...(customer?.avatarUrl ? { actorAvatar: customer.avatarUrl } : {}),
      verb: 'booked',
      target: `${booking.partySize} ${pluralize(booking.partySize, 'seat')} on ${
        activity?.name ?? 'an activity'
      } · ${departureLabel(booking.departureAt)}`,
      createdAt: booking.createdAt,
      kind: 'booking',
      amount: booking.total,
      currency,
    })
  }

  /* --- money captured ------------------------------------------------------ */
  const captured = getPaymentsByTenant(tenantId)
    .filter((payment) => payment.status === 'succeeded' && payment.amount > 0)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 3)
  for (const payment of captured) {
    const booking = getBookingById(payment.bookingId)
    const customer = booking ? getCustomerById(booking.customerId) : undefined
    push({
      actor: guestName(customer),
      ...(customer?.avatarUrl ? { actorAvatar: customer.avatarUrl } : {}),
      verb: payment.method === 'cash' ? 'paid in cash for' : 'paid for',
      target: booking?.reference ?? payment.bookingId,
      createdAt: payment.createdAt,
      kind: 'payment',
      amount: payment.amount,
      currency,
    })
  }

  /* --- cancellations and refunds ------------------------------------------ */
  const cancellations = getBookingsByTenant(tenantId)
    .filter(
      (booking): booking is Booking & { cancelledAt: string } =>
        booking.cancelledAt !== undefined && hasHappened(booking.cancelledAt),
    )
    .sort((a, b) => Date.parse(b.cancelledAt) - Date.parse(a.cancelledAt))
  for (const booking of cancellations.slice(0, 3)) {
    const customer = getCustomerById(booking.customerId)
    const activity = getActivityById(booking.activityId)
    push({
      actor: guestName(customer),
      ...(customer?.avatarUrl ? { actorAvatar: customer.avatarUrl } : {}),
      verb: 'cancelled',
      target: `${activity?.name ?? 'a booking'} · ${booking.cancellationReason ?? 'no reason given'}`,
      createdAt: booking.cancelledAt,
      kind: 'cancellation',
      ...(booking.refundAmount ? { amount: -booking.refundAmount, currency } : {}),
    })
  }

  /* --- reviews -------------------------------------------------------------- */
  const reviews = getBookingsByTenant(tenantId)
    .filter((booking) => booking.rating !== undefined && booking.reviewText && hasHappened(booking.updatedAt))
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  for (const booking of reviews.slice(0, 3)) {
    const customer = getCustomerById(booking.customerId)
    const activity = getActivityById(booking.activityId)
    push({
      actor: guestName(customer),
      ...(customer?.avatarUrl ? { actorAvatar: customer.avatarUrl } : {}),
      verb: `left a ${booking.rating}★ review for`,
      target: activity?.name ?? 'an activity',
      createdAt: booking.updatedAt,
      kind: 'review',
    })
  }

  /* --- crew on the ground --------------------------------------------------- */
  const today = getDeparturesInRange(tenantId, addMinutes(NOW, -18 * 60), NOW)
    .filter((departure) => departure.status !== 'cancelled' && departure.booked > 0)
    .slice(-4)
  for (const departure of today) {
    const activity = getActivityById(departure.activityId)
    const member = pickStaff(staff, `checkin:${departure.id}`)
    push({
      actor: member?.name ?? 'Operations',
      ...(member?.avatarUrl ? { actorAvatar: member.avatarUrl } : {}),
      verb: 'checked in',
      target: `${departure.booked} ${pluralize(departure.booked, 'guest')} on ${
        activity?.name ?? 'a departure'
      } · ${formatTime(departure.startsAt)}`,
      createdAt: departure.startsAt,
      kind: 'booking',
    })
  }

  /* --- operational decisions ------------------------------------------------ */
  const upcoming = getUpcomingDepartures(tenantId, 60)
  const holds = upcoming.filter((departure) => departure.status === 'weather_hold').slice(0, 1)
  for (const departure of holds) {
    const activity = getActivityById(departure.activityId)
    const member = pickStaff(staff, `hold:${departure.id}`)
    push({
      actor: member?.name ?? 'Operations',
      ...(member?.avatarUrl ? { actorAvatar: member.avatarUrl } : {}),
      verb: 'placed a weather hold on',
      target: `${activity?.name ?? 'a departure'} · ${departureLabel(departure.startsAt)}`,
      createdAt: localIso(addMinutes(NOW, -rngInt(rng, 30, 210))),
      kind: 'system',
    })
  }

  const soldOut = upcoming
    .filter((departure) => departure.capacity > 0 && departure.booked >= departure.capacity)
    .slice(0, 2)
  for (const departure of soldOut) {
    const activity = getActivityById(departure.activityId)
    push({
      actor: 'EZRA Pro',
      verb: 'closed sales on',
      target: `${activity?.name ?? 'a departure'} · ${departureLabel(
        departure.startsAt,
      )} sold out at ${departure.booked}`,
      createdAt: localIso(addMinutes(NOW, -rngInt(rng, 60, 900))),
      kind: 'capacity',
    })
  }

  const priced = upcoming.filter((departure) => (departure.priceMultiplier ?? 1) > 1).slice(0, 1)
  for (const departure of priced) {
    const activity = getActivityById(departure.activityId)
    const member = pickStaff(staff, `price:${departure.id}`)
    push({
      actor: member?.name ?? 'EZRA Pro',
      ...(member?.avatarUrl ? { actorAvatar: member.avatarUrl } : {}),
      verb: 'applied a pricing rule to',
      target: `${activity?.name ?? 'a departure'} · ${departure.priceMultiplier}× on ${departureLabel(
        departure.startsAt,
      )}`,
      createdAt: localIso(addMinutes(NOW, -rngInt(rng, 120, 2600))),
      kind: 'system',
      ...(departure.priceOverride ? { amount: departure.priceOverride, currency } : {}),
    })
  }

  if (staff.length > 0) {
    const member = rngPick(rng, staff)
    push({
      actor: member.name,
      actorAvatar: member.avatarUrl,
      verb: 'published the roster for',
      target: 'next week’s departures',
      createdAt: localIso(addMinutes(NOW, -rngInt(rng, 300, 2000))),
      kind: 'system',
    })
  }

  const ordered = events
    .filter((event) => hasHappened(event.createdAt))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, Math.max(0, limit))

  FEED_CACHE.set(cacheKey, ordered)
  return ordered
}
