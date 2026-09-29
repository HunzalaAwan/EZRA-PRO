import { COUNTRY_NAME_BY_CODE, getActivitiesByTenant, getBookingRows, getBookingsByCustomer, getCustomersByTenant } from '@/lib/demo'
import { manageLink, type MessageContext } from '@/lib/messaging'
import { steady, type MarketingContact } from '@/lib/marketing'
import { formatCurrency } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   The guest list, shaped for marketing: who can be emailed or texted, what
   they have booked and when they last came. Server-side; the pages pass the
   result to the client, where audiences are counted live.
   ========================================================================== */

export interface MarketingData {
  contacts: MarketingContact[]
  activities: { slug: string; name: string; tagline: string; image: string; price: string }[]
  /** Major units: the average paid booking, for the revenue estimates. */
  avgOrder: number
  tags: string[]
  countries: string[]
}

export function getMarketingData(tenant: Tenant): MarketingData {
  const activities = getActivitiesByTenant(tenant.id).filter((activity) => activity.status !== 'archived')
  const slugById = new Map(activities.map((activity) => [activity.id, activity.slug]))
  let paid = 0
  let paidCount = 0
  const contacts: MarketingContact[] = getCustomersByTenant(tenant.id).map((customer) => {
    const bookings = getBookingsByCustomer(customer.id)
    for (const booking of bookings) {
      if (booking.status === 'cancelled' || booking.status === 'refunded') continue
      paid += booking.total
      paidCount += 1
    }
    return {
      id: customer.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      country: COUNTRY_NAME_BY_CODE.get(customer.country) ?? customer.country,
      totalBookings: customer.totalBookings,
      spend: Math.round(customer.lifetimeValue / 100),
      lastBookingAt: customer.lastBookingAt,
      tags: customer.tags,
      emailOptIn: customer.marketingOptIn,
      // About half of email subscribers also said yes to texts.
      smsOptIn: customer.marketingOptIn && Boolean(customer.phone) && steady(`sms-${customer.id}`) > 0.45,
      segment: customer.segment,
      activitySlugs: [...new Set(bookings.map((booking) => slugById.get(booking.activityId)).filter((slug): slug is string => Boolean(slug)))],
    }
  })
  return {
    contacts,
    activities: activities.map((activity) => ({
      slug: activity.slug,
      name: activity.name,
      tagline: activity.tagline,
      image: (activity.media.find((item) => item.isPrimary && item.type === 'image') ?? activity.media.find((item) => item.type === 'image'))?.url ?? '',
      price: formatCurrency(activity.basePrice, tenant.currency),
    })),
    avgOrder: paidCount > 0 ? Math.round(paid / paidCount / 100) : 150,
    tags: [...new Set(contacts.flatMap((contact) => contact.tags))].sort(),
    countries: [...new Set(contacts.map((contact) => contact.country))].sort(),
  }
}

/** A real booking, shaped for message previews. */
export function getMessageSample(tenant: Tenant): MessageContext {
  const rows = getBookingRows(tenant.id, 200)
  const row = rows.find((entry) => entry.booking.status === 'confirmed' && entry.booking.total > entry.booking.amountPaid) ?? rows.find((entry) => entry.booking.status === 'confirmed') ?? rows[0]
  const at = row ? new Date(row.departure.startsAt) : new Date()
  return {
    first_name: row?.customer.firstName ?? 'Maia',
    activity: row?.activity.name ?? 'Sunset Sail',
    date: new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(at),
    time: new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(at),
    meeting_point: (row?.activity.meetingPoint ?? 'the harbour').split(' — ')[0],
    party: `${row?.booking.partySize ?? 2} guests`,
    reference: row?.booking.reference ?? 'EZR-8KQ2M',
    balance: new Intl.NumberFormat('en-US', { style: 'currency', currency: tenant.currency, maximumFractionDigits: 0 }).format(
      Math.max(0, (row?.booking.total ?? 0) - (row?.booking.amountPaid ?? 0)) / 100,
    ),
    manage_link: `${tenant.slug}.ezrapro.com${manageLink(tenant.slug, row?.booking.reference ?? 'EZR-8KQ2M').replace(`/book/${tenant.slug}`, '')}`,
    business: tenant.name,
  }
}
