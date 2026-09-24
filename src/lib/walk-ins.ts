import type { ActivityKind } from '@/types'

/* ==========================================================================
   Walk-ins: sales made at the desk to guests who turn up without booking.
   Each one keeps the guest's details, what was sold, how it was paid and
   what happened after (checked in, refunded). Browser-safe: the demo seeds
   history from the walk-in channel and keeps new sales in localStorage.
   ========================================================================== */

export type WalkInMethod = 'cash' | 'card'
export type WalkInStatus = 'paid' | 'checked_in' | 'refunded'

export interface WalkInGuest {
  name: string
  phone: string
  email: string
  country: string
  /** How they heard about the business, one of WALK_IN_SOURCES. */
  source: string
  /** Agreed to hear about offers. */
  marketing: boolean
}

export interface WalkInLine {
  label: string
  /** Minor units; negative for a discount. */
  total: number
}

export interface WalkInRecord {
  reference: string
  activitySlug: string
  activityName: string
  kind: ActivityKind
  /** Local ISO of the departure or slot sold. */
  startsAt: string
  /** Local ISO of the sale. */
  soldAt: string
  guests: number
  lines: WalkInLine[]
  subtotal: number
  discount: number
  total: number
  method: WalkInMethod
  guest: WalkInGuest
  status: WalkInStatus
  /** Who rang it up. */
  staff: string
  note?: string
  /** Seeded from history rather than sold in this browser. */
  seeded?: boolean
}

export const WALK_IN_SOURCES = ['Walked past', 'Hotel or concierge', 'Friend or family', 'Online search', 'Social media', 'Came back again', 'Other'] as const

export const WALK_IN_STATUS_LABEL: Record<WalkInStatus, string> = {
  paid: 'Paid',
  checked_in: 'Checked in',
  refunded: 'Refunded',
}

export const EMPTY_GUEST: WalkInGuest = { name: '', phone: '', email: '', country: '', source: '', marketing: false }

/** Money that stays: refunded sales count as zero. */
export const netTotal = (record: WalkInRecord) => (record.status === 'refunded' ? 0 : record.total)

export interface WalkInSummary {
  revenue: number
  sales: number
  guests: number
  average: number
  cash: number
  card: number
  refunded: number
  refunds: number
}

export function summarize(records: WalkInRecord[]): WalkInSummary {
  const out: WalkInSummary = { revenue: 0, sales: 0, guests: 0, average: 0, cash: 0, card: 0, refunded: 0, refunds: 0 }
  for (const record of records) {
    if (record.status === 'refunded') {
      out.refunds += 1
      out.refunded += record.total
      continue
    }
    out.sales += 1
    out.guests += record.guests
    out.revenue += record.total
    out[record.method] += record.total
  }
  out.average = out.sales > 0 ? Math.round(out.revenue / out.sales) : 0
  return out
}

/** "YYYY-MM-DD" keys from `endKey` back `days` days, oldest first. */
export function dayKeys(endKey: string, days: number): string[] {
  const end = new Date(`${endKey}T12:00:00`)
  return Array.from({ length: days }, (_, index) => {
    const day = new Date(end)
    day.setDate(end.getDate() - (days - 1 - index))
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  })
}

/** The log as a CSV the owner can open in a spreadsheet. */
export function walkInsCsv(records: WalkInRecord[]): string {
  const head = ['Reference', 'Sold at', 'Activity', 'Starts at', 'Guests', 'Guest name', 'Phone', 'Email', 'Country', 'Heard from', 'Marketing', 'Method', 'Status', 'Subtotal', 'Discount', 'Total', 'Staff']
  const cell = (value: string | number) => {
    const text = String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  const rows = records.map((r) => [
    r.reference,
    r.soldAt.replace('T', ' ').slice(0, 16),
    r.activityName,
    r.startsAt.replace('T', ' ').slice(0, 16),
    r.guests,
    r.guest.name,
    r.guest.phone,
    r.guest.email,
    r.guest.country,
    r.guest.source,
    r.guest.marketing ? 'Yes' : 'No',
    r.method,
    WALK_IN_STATUS_LABEL[r.status],
    (r.subtotal / 100).toFixed(2),
    (r.discount / 100).toFixed(2),
    (r.total / 100).toFixed(2),
    r.staff,
  ])
  return [head, ...rows].map((row) => row.map(cell).join(',')).join('\n')
}
