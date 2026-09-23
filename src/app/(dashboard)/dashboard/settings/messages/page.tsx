import type { Metadata } from 'next'
import { requireWorkspaceRoute } from '@/lib/workspace'

import { getBookingRows } from '@/lib/demo'
import { manageLink } from '@/lib/messaging'
import { MessagesSettingsClient } from '@/components/dashboard/settings/messages-settings-client'

export const metadata: Metadata = {
  title: 'Messages',
  description: 'The emails and texts every booking sends: confirmation, reminders, weather, reviews and more.',
}

export default async function MessagesSettingsPage() {
  const { tenant } = await requireWorkspaceRoute('/dashboard/settings')
  const rows = getBookingRows(tenant.id, 200)
  const row = rows.find((entry) => entry.booking.status === 'confirmed' && entry.booking.total > entry.booking.amountPaid) ?? rows.find((entry) => entry.booking.status === 'confirmed') ?? rows[0]
  const at = row ? new Date(row.departure.startsAt) : new Date()
  const sample = {
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
  return <MessagesSettingsClient tenant={tenant} sample={sample} />
}
