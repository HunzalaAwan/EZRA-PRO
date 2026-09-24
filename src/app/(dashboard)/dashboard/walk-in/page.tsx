import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { NOW_ISO } from '@/components/dashboard/activities/activity-data'
import { getActivitiesByTenant, getBookingRows, getPaymentsByBooking, getUsersByTenant } from '@/lib/demo'
import { buildDays } from '@/lib/storefront-availability'
import { createRng, hashSeed } from '@/lib/utils'
import { WALK_IN_SOURCES, dayKeys, type WalkInRecord } from '@/lib/walk-ins'
import { PageHeader } from '@/components/dashboard/page-header'
import { WalkInDesk, type WalkInActivity } from '@/components/dashboard/operations/walk-in-sale'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Walk-ins',
  description: 'Sell to guests at the desk, keep their details, and track walk-in revenue on its own.',
}

const HISTORY_DAYS = 30

/** A local ISO minus some minutes, still local. */
function minutesBefore(iso: string, minutes: number): string {
  const date = new Date(iso)
  date.setMinutes(date.getMinutes() - minutes)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

export default async function WalkInPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/walk-in')

  /* ---------- what can be sold now ---------- */
  const activities: WalkInActivity[] = getActivitiesByTenant(tenant.id)
    .filter((activity) => activity.status === 'live' && activity.category !== 'restaurants')
    .map((activity) => ({
      slug: activity.slug,
      name: activity.name,
      kind: activity.kind ?? 'trip',
      image: activity.media.find((media) => media.isPrimary)?.url ?? activity.media[0]?.url ?? '',
      tiers: activity.priceTiers.map((tier) => ({ id: tier.id, label: tier.label, price: tier.price, max: tier.maxQuantity, seat: tier.countsTowardCapacity })),
      addOns: activity.addOns.map((addOn) => ({ id: addOn.id, label: addOn.label, price: addOn.price })),
      slots: buildDays(activity, 2).flatMap((day) =>
        day.slots
          .filter((slot) => slot.startsAt >= NOW_ISO.slice(0, 13) && !slot.soldOut)
          .map((slot) => ({ id: slot.departureId, startsAt: slot.startsAt, seatsLeft: slot.seatsLeft })),
      ),
    }))
    .filter((activity) => activity.slots.length > 0)

  /* ---------- the last 30 days of walk-ins, and all revenue for the share ---------- */
  const days = dayKeys(NOW_ISO.slice(0, 10), HISTORY_DAYS)
  const first = days[0]
  const staff = getUsersByTenant(tenant.id).map((user) => user.name.split(' ')[0])
  const rows = getBookingRows(tenant.id)
  const allRevenue: Record<string, number> = Object.fromEntries(days.map((key) => [key, 0]))
  const seed: WalkInRecord[] = []

  for (const { booking, activity, customer } of rows) {
    const dayKey = booking.departureAt.slice(0, 10)
    if (dayKey < first || booking.departureAt.slice(0, 16) > NOW_ISO.slice(0, 16)) continue
    const refunded = booking.status === 'cancelled' || booking.status === 'refunded'
    if (!refunded) allRevenue[dayKey] = (allRevenue[dayKey] ?? 0) + booking.total
    if (booking.channel !== 'walk_in') continue

    const rng = createRng(hashSeed(`walkin:${booking.reference}`))
    const paidCash = getPaymentsByBooking(booking.id).some((payment) => payment.method === 'cash') || rng() < 0.35
    const soldAt = minutesBefore(booking.departureAt, 10 + Math.floor(rng() * 80))
    const tickets = booking.lineItems.filter((line) => line.kind === 'ticket' || line.kind === 'addon')
    const discount = -booking.lineItems.filter((line) => line.kind === 'discount').reduce((sum, line) => sum + line.total, 0)
    seed.push({
      reference: booking.reference,
      activitySlug: activity.slug,
      activityName: activity.name,
      kind: activity.kind ?? 'trip',
      startsAt: booking.departureAt,
      soldAt,
      guests: booking.partySize,
      lines: tickets.map((line) => ({ label: `${line.quantity} × ${line.label}`, total: line.total })),
      subtotal: booking.subtotal,
      discount,
      total: booking.total,
      method: paidCash ? 'cash' : 'card',
      guest: {
        name: `${customer.firstName} ${customer.lastName}`,
        phone: rng() < 0.85 ? customer.phone : '',
        email: rng() < 0.6 ? customer.email : '',
        country: customer.country,
        source: WALK_IN_SOURCES[Math.floor(rng() * (WALK_IN_SOURCES.length - 1))],
        marketing: customer.marketingOptIn,
      },
      status: refunded ? 'refunded' : 'checked_in',
      staff: staff.length > 0 ? staff[Math.floor(rng() * staff.length)] : 'Desk',
      seeded: true,
    })
  }

  return (
    <div className="flex flex-col gap-5 pb-16 print:gap-2">
      <PageHeader
        className="mb-0 print:hidden"
        title="Walk-ins"
        description="Sell to guests at the desk, keep their details, and see walk-in revenue on its own."
      />
      <WalkInDesk
        tenantSlug={tenant.slug}
        tenantName={tenant.name}
        currency={tenant.currency}
        activities={activities}
        nowIso={NOW_ISO}
        seed={seed}
        allRevenue={allRevenue}
        staff={staff}
      />
    </div>
  )
}
