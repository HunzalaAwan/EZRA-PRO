import { NOW, getBookingRows } from '@/lib/demo'
import { addDays, hashSeed } from '@/lib/utils'

/* ==========================================================================
   Inbox seeds — a handful of real-feeling guest conversations tied to
   upcoming bookings, so the inbox has something to answer. Thread ids are
   "thr_<reference>", which is also what the guest's manage page writes to.
   Types are shared with the client hook.
   ========================================================================== */

export type ThreadChannel = 'sms' | 'email' | 'whatsapp'
export type ThreadStatus = 'open' | 'waiting' | 'closed'

export interface InboxMessage {
  id: string
  from: 'guest' | 'staff'
  body: string
  at: string
  author?: string
}

export interface InboxThread {
  id: string
  bookingId?: string
  reference: string
  guestName: string
  avatarUrl?: string
  phone: string
  email: string
  activityName: string
  startsAt: string
  channel: ThreadChannel
  status: ThreadStatus
  messages: InboxMessage[]
}

const TOPICS: { guest: string; reply?: string; follow?: string; closed?: boolean; channel: ThreadChannel }[] = [
  { guest: 'Hi! We are running about ten minutes late, stuck behind a truck on the Pali. So sorry!', channel: 'sms' },
  { guest: 'Is the trip still on tomorrow with this wind? The forecast looks rough.', channel: 'whatsapp' },
  { guest: 'Can my 6 year old come along? She is a strong swimmer.', channel: 'email' },
  { guest: 'Is there parking near the harbour?', reply: 'Yes, the harbour lot is free before 9 am. Look for the blue tent by the ramp.', follow: 'Perfect, thank you!', channel: 'sms' },
  { guest: 'Could we move to the afternoon departure instead? Our flight got changed.', channel: 'email' },
  { guest: 'Do you have vegetarian options for lunch aboard?', reply: 'We do: veggie wraps and a fruit platter. I have noted two vegetarians on your booking.', channel: 'email' },
  { guest: 'Can I add one more person to our booking? My brother-in-law just landed.', channel: 'whatsapp' },
  { guest: 'Thank you so much, best day of our whole holiday. The turtles!', reply: 'Mahalo for coming out with us! The photos are in your booking link.', closed: true, channel: 'email' },
]

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`

export function getSeedThreads(tenantId: string): InboxThread[] {
  const nowIso = iso(NOW)
  const upcoming = getBookingRows(tenantId, 600)
    .filter((row) => row.departure.startsAt >= nowIso && row.departure.startsAt < iso(addDays(NOW, 4)) && row.booking.status !== 'cancelled')
    .sort((a, b) => hashSeed(a.booking.id) - hashSeed(b.booking.id))
  const past = getBookingRows(tenantId, 600).filter((row) => row.departure.startsAt < nowIso && row.booking.status === 'completed')

  return TOPICS.map((topic, index) => {
    const row = topic.closed ? past[index % Math.max(1, past.length)] : upcoming[index % Math.max(1, upcoming.length)]
    if (!row) return null
    const sentAt = new Date(NOW.getTime() - (index * 47 + 6) * 60_000)
    const messages: InboxMessage[] = [{ id: `m_${index}_1`, from: 'guest', body: topic.guest, at: iso(sentAt) }]
    if (topic.reply) {
      messages.push({ id: `m_${index}_2`, from: 'staff', body: topic.reply, at: iso(new Date(sentAt.getTime() + 11 * 60_000)), author: 'Kaimana' })
    }
    if (topic.follow) {
      messages.push({ id: `m_${index}_3`, from: 'guest', body: topic.follow, at: iso(new Date(sentAt.getTime() + 19 * 60_000)) })
    }
    const last = messages[messages.length - 1]
    const thread: InboxThread = {
      id: `thr_${row.booking.reference}`,
      bookingId: row.booking.id,
      reference: row.booking.reference,
      guestName: `${row.customer.firstName} ${row.customer.lastName}`,
      avatarUrl: row.customer.avatarUrl,
      phone: row.customer.phone,
      email: row.customer.email,
      activityName: row.activity.name,
      startsAt: row.departure.startsAt,
      channel: topic.channel,
      status: topic.closed ? 'closed' : last.from === 'guest' && !topic.follow ? 'open' : topic.follow ? 'closed' : 'waiting',
      messages,
    }
    return thread
  }).filter((thread): thread is InboxThread => Boolean(thread))
}

export function countOpenThreads(tenantId: string): number {
  return getSeedThreads(tenantId).filter((thread) => thread.status === 'open').length
}
