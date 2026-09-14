import type { Metadata } from 'next'

import { PageHeader } from '@/components/dashboard/page-header'
import {
  CustomersPageActions,
  CustomersTable,
  type CustomerRow,
} from '@/components/dashboard/customers/customers-table'
import type {
  CustomerSegment,
  SegmentSummary,
} from '@/components/dashboard/customers/segment-cards'
import { CURRENT_TENANT, NOW, getBookingsByCustomer, getCustomersByTenant } from '@/lib/demo'
import { addDays, percentChange, sum } from '@/lib/utils'
import type { Customer } from '@/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Guests',
  description:
    'Every guest who has ever booked, segmented by value and recency, with lifetime spend and trip history.',
}

/* --------------------------------------------------------------------------
   Display names for the ISO codes the guest book actually contains.
   -------------------------------------------------------------------------- */
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  JP: 'Japan',
  AU: 'Australia',
  DE: 'Germany',
  GB: 'United Kingdom',
  KR: 'South Korea',
  BR: 'Brazil',
  FR: 'France',
  MX: 'Mexico',
  NL: 'Netherlands',
  SG: 'Singapore',
  NZ: 'New Zealand',
  CN: 'China',
  IT: 'Italy',
  IN: 'India',
  GR: 'Greece',
  SE: 'Sweden',
  ES: 'Spain',
}

const SEGMENTS: CustomerSegment[] = ['new', 'returning', 'vip', 'lapsed']

/** How many guests of each segment travel to the browser. */
const QUOTA: Record<CustomerSegment, number> = {
  vip: 200,
  returning: 160,
  lapsed: 130,
  new: 130,
}

/** Weekly marks on the segment sparklines; the last one is exactly `NOW`. */
const TREND_WEEKS = 26
/** The delta chip compares the segment against itself four weeks back. */
const DELTA_WEEKS = 4
const DAY_MS = 86_400_000

/**
 * Replays each guest's booking history against 26 weekly marks and re-derives
 * which segment they were in at each one — the same rule the dataset itself
 * applies at `NOW`, so the final point of every sparkline equals the count
 * printed on the card.
 */
function buildSegmentTrends(customers: Customer[]): Record<CustomerSegment, number[]> {
  const marks = Array.from({ length: TREND_WEEKS }, (_, index) =>
    addDays(NOW, -7 * (TREND_WEEKS - 1 - index)).getTime(),
  )

  const series: Record<CustomerSegment, number[]> = {
    new: new Array<number>(TREND_WEEKS).fill(0),
    returning: new Array<number>(TREND_WEEKS).fill(0),
    vip: new Array<number>(TREND_WEEKS).fill(0),
    lapsed: new Array<number>(TREND_WEEKS).fill(0),
  }

  for (const customer of customers) {
    const history = getBookingsByCustomer(customer.id)
      .map((booking) => ({
        at: new Date(booking.createdAt).getTime(),
        total: booking.total,
        billable: booking.status !== 'cancelled' && booking.status !== 'refunded',
      }))
      .sort((a, b) => a.at - b.at)

    let cursor = 0
    let trips = 0
    let lifetime = 0
    let lastBooked = 0

    for (let week = 0; week < TREND_WEEKS; week++) {
      const mark = marks[week]
      while (cursor < history.length && history[cursor].at <= mark) {
        const entry = history[cursor]
        if (entry.billable) {
          trips += 1
          lifetime += entry.total
        }
        lastBooked = entry.at
        cursor += 1
      }
      if (lastBooked === 0) continue

      const quietDays = (mark - lastBooked) / DAY_MS
      const segment: CustomerSegment =
        trips >= 3 || lifetime >= 200_000
          ? 'vip'
          : quietDays > 120
            ? 'lapsed'
            : trips >= 2
              ? 'returning'
              : 'new'

      series[segment][week] += 1
    }
  }

  return series
}

function buildSegmentSummaries(customers: Customer[]): SegmentSummary[] {
  const trends = buildSegmentTrends(customers)

  return SEGMENTS.map((segment) => {
    const members = customers.filter((customer) => customer.segment === segment)
    const totalLifetimeValue = sum(members.map((member) => member.lifetimeValue))
    const trend = trends[segment]
    const latest = trend[trend.length - 1]
    const baseline = trend[Math.max(0, trend.length - 1 - DELTA_WEEKS)]

    return {
      segment,
      count: members.length,
      share: customers.length === 0 ? 0 : (members.length / customers.length) * 100,
      avgLifetimeValue: members.length === 0 ? 0 : Math.round(totalLifetimeValue / members.length),
      totalLifetimeValue,
      trend,
      deltaPercent: percentChange(latest, baseline),
    }
  })
}

function toRow(customer: Customer): CustomerRow {
  return {
    id: customer.id,
    name: `${customer.firstName} ${customer.lastName}`,
    email: customer.email,
    phone: customer.phone,
    avatarUrl: customer.avatarUrl,
    countryCode: customer.country,
    countryName: COUNTRY_NAMES[customer.country] ?? customer.country,
    segment: customer.segment,
    totalBookings: customer.totalBookings,
    lifetimeValue: customer.lifetimeValue,
    lastBookingAt: customer.lastBookingAt,
    tags: customer.tags,
  }
}

/**
 * A stratified working set: the most valuable VIPs plus the most recently
 * active guests of every other segment. Ten thousand guest records would be a
 * pointless payload — this keeps every segment filter populated at a fraction
 * of the weight.
 */
function buildWorkingSet(customers: Customer[]): CustomerRow[] {
  const picked: Customer[] = []

  for (const segment of SEGMENTS) {
    const members = customers.filter((customer) => customer.segment === segment)
    members.sort((a, b) =>
      segment === 'vip'
        ? b.lifetimeValue - a.lifetimeValue
        : (b.lastBookingAt ?? '').localeCompare(a.lastBookingAt ?? ''),
    )
    picked.push(...members.slice(0, QUOTA[segment]))
  }

  picked.sort((a, b) => (b.lastBookingAt ?? '').localeCompare(a.lastBookingAt ?? ''))
  return picked.map(toRow)
}

export default function CustomersPage() {
  const tenant = CURRENT_TENANT
  const customers = getCustomersByTenant(tenant.id)

  const segments = buildSegmentSummaries(customers)
  const rows = buildWorkingSet(customers)

  const repeatCount = customers.filter((customer) => customer.totalBookings > 1).length
  const repeatRate = customers.length === 0 ? 0 : (repeatCount / customers.length) * 100

  return (
    <>
      <PageHeader
        title="Guests"
        description={`${customers.length.toLocaleString('en-US')} people have booked with ${tenant.name}. ${repeatRate.toFixed(0)}% of them have come back for a second trip.`}
        actions={<CustomersPageActions totalCount={customers.length} />}
      />

      <CustomersTable
        rows={rows}
        segments={segments}
        totalCount={customers.length}
        currency={tenant.currency}
      />
    </>
  )
}
