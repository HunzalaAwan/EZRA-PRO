'use client'

import * as React from 'react'
import { useBookingLedger } from '@/hooks/use-booking-ledger'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { effectiveCancellation, effectivePayment } from '@/lib/booking-defaults'
import { useMessageTemplates } from '@/hooks/use-message-templates'
import { changeBooking, changeStartOf } from '@/lib/booking-ledger'
import { refundFor, splitPayment } from '@/lib/booking-policy'
import { MessageComposer, sendToGuests, type MessageRecipient } from '@/components/dashboard/bookings/message-composer'
import { CancelBookingDialog, type ChangeTarget } from '@/components/dashboard/bookings/booking-change-dialogs'
import Link from 'next/link'
import {
  CalendarCheck,
  Download,
  Hourglass,
  Plus,
  Printer,
  Users,
  Wallet,
} from 'lucide-react'

import type { BookingRow, DeskRow } from '@/lib/demo'
import type { Activity, Location, Tenant } from '@/types'
import { addDays, formatNumber, percentChange, toDateKey, formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { StatCard, StatGrid } from '@/components/ui/stat'
import { Segmented, type SegmentedOption } from '@/components/ui/segmented'
import { toast } from '@/components/ui/toaster'
import {
  REFUND_REASONS,
  RefundDialog,
  refundableAmount,
  type RefundResult,
  type RefundTarget,
} from '@/components/dashboard/bookings/refund-dialog'
import type { BookingRowAction, Density } from '@/components/dashboard/bookings/bookings-table'
import type { DataTableSort } from '@/components/ui/data-table'
import { PageHeader } from '@/components/dashboard/page-header'
import {
  BookingsFilters,
  DEFAULT_BOOKING_FILTERS,
  DESK_VIEWS,
  STATUS_MATCH,
  activeFilterCount,
  type BookingFilters,
  type DeskView,
} from '@/components/dashboard/bookings/bookings-filters'
import type { DateRange } from '@/types'
import { fetchDeskRows } from '@/lib/actions/dashboard'
import { BookingsDisplayMenu, BookingsTable } from '@/components/dashboard/bookings/bookings-table'
import { BookingDetailSheet } from '@/components/dashboard/bookings/booking-detail-sheet'
import { NewBookingDialog } from '@/components/dashboard/bookings/new-booking-dialog'

/* ==========================================================================
   THE RESERVATIONS DESK
   One screen an operator lives in all day: today's numbers up top, a status
   rail, saved views, and 13k reservations paginated underneath.
   ========================================================================== */

/* Each view's own order: time order for the days ahead, newest first for what just came in. */
const SORT_FOR: Record<DeskView, DataTableSort> = {
  today: { id: 'departure', dir: 'asc' },
  upcoming: { id: 'departure', dir: 'asc' },
  recent: { id: 'created', dir: 'desc' },
  attention: { id: 'departure', dir: 'asc' },
  cancelled: { id: 'departure', dir: 'desc' },
  all: { id: 'departure', dir: 'asc' },
}

const CANCELLED = new Set<string>(STATUS_MATCH.cancelled)

const shiftDay = (dayKey: string, days: number) => toDateKey(addDays(new Date(`${dayKey}T12:00:00`), days))

/** What each view shows, before the calendar and the filters. */
function inView(view: DeskView, row: BookingRow, todayKey: string) {
  const day = row.departure.startsAt.slice(0, 10)
  const cancelled = CANCELLED.has(row.booking.status)
  switch (view) {
    case 'today':
      return day === todayKey
    case 'upcoming':
      return day >= todayKey && day <= shiftDay(todayKey, 6) && !cancelled
    case 'attention':
      return day >= todayKey && day <= shiftDay(todayKey, 6) && !cancelled && (row.booking.status === 'pending' || row.booking.total - row.booking.amountPaid > 0)
    case 'cancelled':
      return cancelled
    case 'recent':
      // Made in the last seven days.
      return row.booking.createdAt.slice(0, 10) >= shiftDay(todayKey, -6)
    default:
      return true
  }
}

function matchesSearch(row: BookingRow, needle: string) {
  const { booking, customer } = row
  return (
    booking.reference.toLowerCase().includes(needle) ||
    customer.firstName.toLowerCase().includes(needle) ||
    customer.lastName.toLowerCase().includes(needle) ||
    `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(needle) ||
    customer.email.toLowerCase().includes(needle)
  )
}

export interface BookingsPageClientProps {
  tenant: Tenant
  /** Rows without their activity, which is joined back from `activities`. */
  allRows: DeskRow[]
  activities: Activity[]
  /** The business's locations, for the filter and the default. */
  locations: Location[]
  now: Date
  todayKey: string
  /** The days the first load covers; other days are fetched when picked. */
  loaded?: { from: string; to: string }
}

/**
 * All the reservations-desk logic and UI, unchanged from when this lived at
 * the route file — only the data acquisition moved. `allRows` (13k+ joined
 * rows for the primary demo tenant) is computed once on the server and
 * handed down as a prop; it must never be re-fetched or re-generated here,
 * or the entire synthetic dataset ships into the client bundle again.
 */
export function BookingsPageClient({ tenant, allRows: firstRows, activities, locations, now: NOW, todayKey: TODAY_KEY, loaded }: BookingsPageClientProps) {
  /* Days outside the first load are fetched from the server when picked, and kept. */
  const [fetched, setFetched] = React.useState<DeskRow[]>([])
  const [fetchedDays, setFetchedDays] = React.useState<{ from: string; to: string }[]>([])
  const [loadingDays, setLoadingDays] = React.useState(false)
  const activityById = React.useMemo(() => new Map(activities.map((activity) => [activity.id, activity])), [activities])
  const sourceRows = React.useMemo(() => {
    const seen = new Set(firstRows.map((row) => row.booking.id))
    const desk = [...firstRows, ...fetched.filter((row) => !seen.has(row.booking.id))]
    return desk.flatMap((row) => {
      const activity = activityById.get(row.booking.activityId)
      return activity ? [{ ...row, activity } as BookingRow] : []
    })
  }, [firstRows, fetched, activityById])
  const ensureDays = (range: DateRange | null) => {
    if (!range || !loaded) return
    const covered = (from: string, to: string) => range.from >= from && range.to <= to
    if (covered(loaded.from, loaded.to) || fetchedDays.some((entry) => covered(entry.from, entry.to))) return
    setLoadingDays(true)
    fetchDeskRows(tenant.id, range.from, range.to)
      .then((rows) => {
        setFetched((current) => {
          const seen = new Set(current.map((row) => row.booking.id))
          return [...current, ...rows.filter((row) => !seen.has(row.booking.id))]
        })
        setFetchedDays((current) => [...current, range])
      })
      .finally(() => setLoadingDays(false))
  }
  /* Refunds and cancellations made at this desk, layered over the server rows. */
  const [adjustments, setAdjustments] = React.useState<Record<string, { refunded: number; cancelled: boolean }>>({})
  // Moves, guest changes and cancellations made anywhere (here, the booking record, the guest's page).
  const ledger = useBookingLedger(tenant.slug)
  const { defaults: bookingDefaults } = useBookingDefaults(tenant.slug)
  const { templates } = useMessageTemplates(tenant.id)
  const allRows = React.useMemo(
    () =>
      sourceRows.map((row) => {
        const change = ledger.changes[row.booking.reference]
        const moved = change
          ? {
              ...row,
              booking: { ...row.booking, partySize: change.party ?? row.booking.partySize, departureAt: change.movedTo?.startsAt ?? row.booking.departureAt, ...(change.transfer ? { transfer: change.transfer } : {}) },
              departure: change.movedTo ? { ...row.departure, id: change.movedTo.departureId, startsAt: change.movedTo.startsAt } : row.departure,
            }
          : row
        const adj = change?.cancelled ? { refunded: (adjustments[row.booking.id]?.refunded ?? 0) + (change.refund ?? 0), cancelled: true } : adjustments[row.booking.id]
        if (!adj) return moved
        row = moved
        const refunded = (row.booking.refundAmount ?? 0) + adj.refunded
        return {
          ...row,
          booking: {
            ...row.booking,
            refundAmount: refunded,
            paymentStatus:
              refunded > 0 && refunded >= row.booking.amountPaid
                ? ('refunded' as const)
                : refunded > 0
                  ? ('partially_refunded' as const)
                  : row.booking.paymentStatus,
            status: adj.cancelled ? ('cancelled' as const) : row.booking.status,
          },
        }
      }),
    [sourceRows, adjustments, ledger.changes],
  )
  const [composeFor, setComposeFor] = React.useState<BookingRow[]>([])
  const [cancelRow, setCancelRow] = React.useState<BookingRow | null>(null)
  const recipientOf = (row: BookingRow): MessageRecipient => ({
    reference: row.booking.reference,
    bookingId: row.booking.id,
    firstName: row.customer.firstName,
    lastName: row.customer.lastName,
    email: row.customer.email,
    phone: row.customer.phone,
    activityName: row.activity.name,
    startsAt: row.departure.startsAt,
    meetingPoint: row.activity.meetingPoint,
    party: row.booking.partySize,
  })
  const targetOf = (row: BookingRow): ChangeTarget => {
    const source = sourceRows.find((entry) => entry.booking.id === row.booking.id) ?? row
    const change = ledger.changes[row.booking.reference]
    return {
      reference: row.booking.reference,
      bookingId: row.booking.id,
      // A ride: the vehicles (a shared run: the seats) it holds on each leg's time slot.
      ...changeStartOf({ departureId: source.departure.id, startsAt: source.departure.startsAt, partySize: source.booking.partySize, transfer: source.activity.kind === 'transfer' ? source.booking.transfer : undefined }),
      departureId: row.departure.id,
      startsAt: row.departure.startsAt,
      party: row.booking.partySize,
      moves: change?.moves ?? 0,
    }
  }
  const [refundTargets, setRefundTargets] = React.useState<BookingRow[]>([])
  const [refundOpen, setRefundOpen] = React.useState(false)

  // The desk opens on today: what is running, in time order.
  const [view, setView] = React.useState<DeskView>('today')
  const [filters, setFilters] = React.useState<BookingFilters>({ ...DEFAULT_BOOKING_FILTERS, range: { from: TODAY_KEY, to: TODAY_KEY } })
  const [sort, setSort] = React.useState<DataTableSort>(SORT_FOR.today)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [openBookingId, setOpenBookingId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [newBookingOpen, setNewBookingOpen] = React.useState(false)
  const [density, setDensity] = React.useState<Density>('compact')
  const [groupByDay, setGroupByDay] = React.useState(true)

  /* ----------------------------------------------------------------------
     KPI strip — today against yesterday, both computed from real rows
     ---------------------------------------------------------------------- */
  const kpis = React.useMemo(() => {
    const yesterdayKey = toDateKey(addDays(NOW, -1))
    const windowStart = toDateKey(addDays(NOW, -13))

    let todayBookings = 0
    let todayGuests = 0
    let todayRevenue = 0
    let yesterdayBookings = 0
    let yesterdayGuests = 0
    let yesterdayRevenue = 0
    let pending = 0

    const bookingsByDay = new Map<string, number>()
    const guestsByDay = new Map<string, number>()
    const revenueByDay = new Map<string, number>()

    for (const { booking, departure } of allRows) {
      const key = departure.startsAt.slice(0, 10)
      const live = booking.status !== 'cancelled' && booking.status !== 'refunded'

      if (key >= windowStart && key <= TODAY_KEY && live) {
        bookingsByDay.set(key, (bookingsByDay.get(key) ?? 0) + 1)
        guestsByDay.set(key, (guestsByDay.get(key) ?? 0) + booking.partySize)
        revenueByDay.set(key, (revenueByDay.get(key) ?? 0) + booking.total)
      }

      if (booking.status === 'pending' && departure.startsAt.slice(0, 10) >= TODAY_KEY) {
        pending += 1
      }

      if (!live) continue
      if (key === TODAY_KEY) {
        todayBookings += 1
        todayGuests += booking.partySize
        todayRevenue += booking.total
      } else if (key === yesterdayKey) {
        yesterdayBookings += 1
        yesterdayGuests += booking.partySize
        yesterdayRevenue += booking.total
      }
    }

    const spark = (source: Map<string, number>) =>
      Array.from({ length: 14 }, (_, i) => source.get(toDateKey(addDays(NOW, i - 13))) ?? 0)

    const direction = (delta: number) => (delta > 0.5 ? 'up' : delta < -0.5 ? 'down' : 'flat')

    const bookingsDelta = percentChange(todayBookings, yesterdayBookings)
    const guestsDelta = percentChange(todayGuests, yesterdayGuests)
    const revenueDelta = percentChange(todayRevenue, yesterdayRevenue)

    return {
      todayBookings,
      todayGuests,
      todayRevenue,
      pending,
      bookingsDelta,
      guestsDelta,
      revenueDelta,
      direction,
      bookingsSpark: spark(bookingsByDay),
      guestsSpark: spark(guestsByDay),
      revenueSpark: spark(revenueByDay),
    }
  }, [allRows])

  /* ----------------------------------------------------------------------
     Filtering (everything except the status tab) then tab counts, so the
     numbers on the rail always describe what the rail would show.
     ---------------------------------------------------------------------- */
  const defaultLocationId = locations.find((site) => site.isDefault)?.id ?? locations[0]?.id
  /* Search and the Filters button first, so every view's count describes what it would show. */
  const baseRows = React.useMemo(() => {
    const needle = filters.search.trim().toLowerCase()
    const statuses = filters.status === 'all' ? null : new Set<string>(STATUS_MATCH[filters.status])
    return allRows.filter((row) => {
      if (needle && !matchesSearch(row, needle)) return false
      if (statuses && !statuses.has(row.booking.status)) return false
      if (filters.activityId !== 'all' && row.activity.id !== filters.activityId) return false
      if (filters.channel !== 'all' && row.booking.channel !== filters.channel) return false
      if (filters.payment !== 'all' && row.booking.paymentStatus !== filters.payment) return false
      if (filters.locationId !== 'all' && (row.departure.locationId ?? defaultLocationId) !== filters.locationId) return false
      return true
    })
  }, [allRows, filters.search, filters.status, filters.activityId, filters.channel, filters.payment, filters.locationId, defaultLocationId])

  const viewCounts = React.useMemo(() => {
    const counts = Object.fromEntries(DESK_VIEWS.map((entry) => [entry.id, 0])) as Record<DeskView, number>
    for (const row of baseRows) for (const entry of DESK_VIEWS) if (inView(entry.id, row, TODAY_KEY)) counts[entry.id] += 1
    return counts
  }, [baseRows, TODAY_KEY])

  /* Then the view, then the calendar's days. */
  const filteredRows = React.useMemo(() => {
    const from = filters.range?.from
    const to = filters.range?.to
    return baseRows.filter((row) => {
      if (!inView(view, row, TODAY_KEY)) return false
      if (from && to) {
        const key = row.departure.startsAt.slice(0, 10)
        if (key < from || key > to) return false
      }
      return true
    })
  }, [baseRows, view, filters.range, TODAY_KEY])

  /** Days with bookings, for the dots on the calendar. */
  const bookedDays = React.useMemo(() => new Set(baseRows.filter((row) => !CANCELLED.has(row.booking.status)).map((row) => row.departure.startsAt.slice(0, 10))), [baseRows])

  /* ----------------------------------------------------------------------
     Sorting
     ---------------------------------------------------------------------- */
  const sortedRows = React.useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    const value = (row: BookingRow): string | number => {
      switch (sort.id) {
        case 'reference':
          return row.booking.reference
        case 'guest':
          return `${row.customer.lastName} ${row.customer.firstName}`.toLowerCase()
        case 'activity':
          return row.activity.name.toLowerCase()
        case 'departure':
          return row.departure.startsAt
        case 'party':
          return row.booking.partySize
        case 'total':
          return row.booking.total
        case 'status':
          return row.booking.status
        default:
          return row.booking.createdAt
      }
    }
    return [...filteredRows].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      if (av === bv) return a.booking.id < b.booking.id ? -1 : 1
      return (av < bv ? -1 : 1) * dir
    })
  }, [filteredRows, sort])

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const safePage = Math.min(page, pageCount)
  const pageRows = React.useMemo(
    () => sortedRows.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sortedRows, safePage, pageSize],
  )

  /* ----------------------------------------------------------------------
     Handlers
     ---------------------------------------------------------------------- */
  const applyFilters = (next: BookingFilters) => {
    setFilters(next)
    setPage(1)
  }

  const applyView = (next: DeskView) => {
    setView(next)
    setSort(SORT_FOR[next])
    // Today is a day on the calendar; every other view starts on any date.
    setFilters((current) => ({ ...current, range: next === 'today' ? { from: TODAY_KEY, to: TODAY_KEY } : null }))
    setPage(1)
    setSelectedIds([])
  }

  /** A day or range from the calendar. Today and Upcoming are dates themselves, so another date shows under All. */
  const applyRange = (range: DateRange | null) => {
    const isToday = range?.from === TODAY_KEY && range.to === TODAY_KEY
    if (isToday) {
      setView('today')
      setSort(SORT_FOR.today)
    } else if (view === 'today' || view === 'upcoming') {
      setView('all')
      setSort(SORT_FOR.all)
    }
    setFilters((current) => ({ ...current, range }))
    ensureDays(range)
    setPage(1)
    setSelectedIds([])
  }

  const clearEverything = () => applyView('today')

  const openRow = (row: BookingRow) => {
    setOpenBookingId(row.booking.id)
    setSheetOpen(true)
  }

  const openIndex = openBookingId
    ? sortedRows.findIndex((row) => row.booking.id === openBookingId)
    : -1

  const stepOpen = (delta: number) => {
    if (openIndex < 0) return
    const next = sortedRows[openIndex + delta]
    if (next) setOpenBookingId(next.booking.id)
  }

  const toRefundTarget = (row: BookingRow): RefundTarget => ({
    id: row.booking.id,
    reference: row.booking.reference,
    guestName: `${row.customer.firstName} ${row.customer.lastName}`,
    activityName: row.activity.name,
    departureAt: row.departure.startsAt,
    partySize: row.booking.partySize,
    status: row.booking.status,
    total: row.booking.total,
    amountPaid: row.booking.amountPaid,
    refunded: row.booking.refundAmount ?? 0,
    fee: row.booking.amountPaid > 0 ? Math.round(row.booking.amountPaid * 0.029 + 30) : 0,
  })

  const openRefund = (rows: BookingRow[]) => {
    const refundable = rows.filter((row) => refundableAmount(toRefundTarget(row)) > 0)
    if (refundable.length === 0) {
      toast.info('Nothing to refund', {
        description: 'Every dollar collected on the selection has already been returned.',
      })
      return
    }
    setRefundTargets(refundable)
    setRefundOpen(true)
  }

  const handleRefund = (result: RefundResult) => {
    setAdjustments((prev) => {
      const next = { ...prev }
      for (const refund of result.refunds) {
        const current = next[refund.id] ?? { refunded: 0, cancelled: false }
        next[refund.id] = {
          refunded: current.refunded + refund.amount,
          cancelled: current.cancelled || result.cancelBooking,
        }
      }
      return next
    })
    const total = result.refunds.reduce((sum, r) => sum + r.amount, 0)
    const n = result.refunds.length
    const reason = REFUND_REASONS.find((r) => r.value === result.reason)?.label ?? result.reason
    toast.success(`Refunded ${formatCurrency(total, tenant.currency)}`, {
      description: `${n} ${n === 1 ? 'booking' : 'bookings'} · ${reason}${
        result.cancelBooking ? ' · spots released' : ''
      }${result.notifyGuest ? ' · receipt emailed' : ''}`,
    })
    setSelectedIds([])
  }

  const rowAction = (action: BookingRowAction, row: BookingRow) => {
    switch (action) {
      case 'open':
        openRow(row)
        break
      case 'refund':
        openRefund([row])
        break
      case 'message':
        setComposeFor([row])
        break
      case 'cancel':
        setCancelRow(row)
        break
    }
  }

  const bulkAction = (action: 'confirm' | 'message' | 'export' | 'cancel' | 'refund', ids: string[]) => {
    const n = ids.length
    const noun = n === 1 ? 'booking' : 'bookings'
    if (action === 'refund') {
      openRefund(allRows.filter((row) => ids.includes(row.booking.id)))
      return
    }
    switch (action) {
      case 'confirm':
        toast.success(`${n} ${noun} confirmed`, {
          description: 'Confirmation emails are on their way to each guest.',
        })
        break
      case 'message':
        setComposeFor(allRows.filter((row) => ids.includes(row.booking.id)))
        return
      case 'export':
        toast.success(`Exported ${n} ${noun}`, { description: 'bookings.csv is downloading.' })
        break
      case 'cancel': {
        // Each booking is cancelled under its own activity's policy and told.
        const rows = allRows.filter((row) => ids.includes(row.booking.id) && row.booking.status !== 'cancelled' && row.booking.status !== 'refunded')
        let refunded = 0
        for (const row of rows) {
          const target = targetOf(row)
          const hoursToGo = (new Date(row.departure.startsAt).getTime() - new Date(NOW).getTime()) / 3_600_000
          const pay = effectivePayment(row.activity, bookingDefaults)
          const deposit = pay.collect === 'deposit' ? splitPayment(pay, row.booking.total, row.activity.kind === 'transfer' ? row.booking.partySize : target.fromParty).now : 0
          const refund = refundFor(effectiveCancellation(row.activity, bookingDefaults), row.booking.amountPaid, hoursToGo, deposit)
          refunded += refund
          changeBooking(tenant.slug, row.booking.reference, target, { cancelled: true, refund }, { by: 'staff', what: `Cancelled from the bookings list${refund > 0 ? `, ${formatCurrency(refund, tenant.currency)} refunded` : ', no refund'}` })
        }
        const template = templates.find((entry) => entry.key === 'cancelled')
        if (template) sendToGuests(rows.map(recipientOf), { tenantSlug: tenant.slug, business: tenant.name, subject: template.subject, body: template.body, extra: { refund_line: 'Any refund due under the policy is on its way to your card.' } })
        toast.error(`${rows.length} ${rows.length === 1 ? 'booking' : 'bookings'} cancelled`, {
          description: `Spots back on sale, ${formatCurrency(refunded, tenant.currency)} refunded by each policy, guests told.`,
        })
        break
      }
    }
    setSelectedIds([])
  }

  const viewOptions: SegmentedOption<DeskView>[] = DESK_VIEWS.map((entry) => ({ value: entry.id, label: entry.label, count: viewCounts[entry.id] }))
  const viewHint = DESK_VIEWS.find((entry) => entry.id === view)?.hint

  const openRowData = openIndex >= 0 ? sortedRows[openIndex] : null

  return (
    <div className="flex flex-col gap-5 pb-24">
      <PageHeader
        className="mb-0"
        title="Bookings"
        description={`Find, filter and manage every booking across ${activities.length} ${activities.length === 1 ? 'activity' : 'activities'}.`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={<Printer />}
              className="hidden sm:inline-flex"
              onClick={() => toast.success('Booking list sent to the printer')}
            >
              Print
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Download />}
              onClick={() =>
                toast.success(`Exported ${formatNumber(sortedRows.length)} bookings`, {
                  description: 'bookings.csv is downloading.',
                })
              }
            >
              Export
            </Button>
            <Button leftIcon={<Plus />} onClick={() => setNewBookingOpen(true)}>
              New booking
            </Button>
          </div>
        }
      />

      {/* ==================================================================
          KPI STRIP
          ================================================================== */}
      <StatGrid columns={4}>
        <StatCard
          accent="lagoon"
          icon={CalendarCheck}
          stat={{
            label: 'Starting today',
            value: kpis.todayBookings,
            format: 'number',
            deltaPercent: kpis.bookingsDelta,
            direction: kpis.direction(kpis.bookingsDelta),
            higherIsBetter: true,
            comparisonLabel: 'vs yesterday',
            sparkline: kpis.bookingsSpark,
          }}
          footer={
            <Link href="/dashboard/manifest" className="text-primary transition-colors hover:underline">
              Open today&rsquo;s guest list →
            </Link>
          }
        />
        <StatCard
          accent="sunset"
          icon={Hourglass}
          stat={{
            label: 'Awaiting confirmation',
            value: kpis.pending,
            format: 'number',
            higherIsBetter: false,
            hint: 'Pending bookings on time slots that have not started yet.',
          }}
          footer={
            <button
              type="button"
              onClick={() => applyView('attention')}
              className="text-primary transition-colors hover:underline"
            >
              Review the queue →
            </button>
          }
        />
        <StatCard
          accent="reef"
          icon={Users}
          stat={{
            label: 'Guests today',
            value: kpis.todayGuests,
            format: 'number',
            deltaPercent: kpis.guestsDelta,
            direction: kpis.direction(kpis.guestsDelta),
            higherIsBetter: true,
            comparisonLabel: 'vs yesterday',
            sparkline: kpis.guestsSpark,
          }}
        />
        <StatCard
          accent="coral"
          icon={Wallet}
          stat={{
            label: 'Revenue today',
            value: kpis.todayRevenue,
            format: 'currency',
            currency: tenant.currency,
            deltaPercent: kpis.revenueDelta,
            direction: kpis.direction(kpis.revenueDelta),
            higherIsBetter: true,
            comparisonLabel: 'vs yesterday',
            sparkline: kpis.revenueSpark,
          }}
          compact
        />
      </StatGrid>

      {/* ==================================================================
          TOOLBAR — status tabs and the saved view, then search and filters
          ================================================================== */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <div className="-mx-1 min-w-0 overflow-x-auto px-1 no-scrollbar">
            <Segmented options={viewOptions} value={view} onValueChange={applyView} label="Booking views" size="md" className="min-w-max" />
          </div>
          {viewHint ? <p className="text-xs text-subtle">{viewHint}</p> : null}
        </div>

        <BookingsFilters
          filters={filters}
          onFiltersChange={applyFilters}
          onRangeChange={applyRange}
          todayKey={TODAY_KEY}
          bookedDays={bookedDays}
          activities={activities}
          locations={locations.map((site) => ({ id: site.id, name: site.name }))}
          resettable={view !== 'today' || filters.search.trim() !== '' || activeFilterCount(filters) > 0}
          onReset={clearEverything}
          resultSummary={<>{formatNumber(sortedRows.length)} {sortedRows.length === 1 ? 'booking' : 'bookings'}</>}
          trailing={
            <BookingsDisplayMenu
              density={density}
              onDensityChange={setDensity}
              groupByDay={groupByDay}
              onGroupByDayChange={setGroupByDay}
              canGroup={sort.id === 'departure' || sort.id === 'created'}
              className="hidden md:inline-flex"
            />
          }
        />
      </div>

      {/* ==================================================================
          TABLE
          ================================================================== */}
      <BookingsTable
        rows={pageRows}
        currency={tenant.currency}
        todayKey={TODAY_KEY}
        sort={sort}
        onSortChange={(next) => {
          setSort(next)
          setPage(1)
        }}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={openRow}
        onRowAction={rowAction}
        onBulkAction={bulkAction}
        page={safePage}
        pageCount={pageCount}
        pageSize={pageSize}
        totalItems={sortedRows.length}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setPageSize(size)
          setPage(1)
        }}
        onClearFilters={clearEverything}
        density={density}
        groupByDay={groupByDay}
        loading={loadingDays}
      />

      {/* ==================================================================
          OVERLAYS
          ================================================================== */}
      <BookingDetailSheet
        bookingId={openBookingId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        reference={openRowData?.booking.reference}
        position={openIndex >= 0 ? { index: openIndex, total: sortedRows.length } : undefined}
        onPrevious={openIndex > 0 ? () => stepOpen(-1) : undefined}
        onNext={openIndex >= 0 && openIndex < sortedRows.length - 1 ? () => stepOpen(1) : undefined}
      />

      <NewBookingDialog open={newBookingOpen} onOpenChange={setNewBookingOpen} />

      <RefundDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        targets={refundTargets.map(toRefundTarget)}
        currency={tenant.currency}
        onConfirm={handleRefund}
      />
      <MessageComposer
        open={composeFor.length > 0}
        onOpenChange={(open) => {
          if (!open) setComposeFor([])
        }}
        recipients={composeFor.map(recipientOf)}
        tenantId={tenant.id}
        tenantSlug={tenant.slug}
        business={tenant.name}
      />
      {cancelRow ? (
        <CancelBookingDialog
          open
          onOpenChange={(open) => {
            if (!open) setCancelRow(null)
          }}
          target={targetOf(cancelRow)}
          amountPaid={cancelRow.booking.amountPaid}
          total={cancelRow.booking.total}
          policy={effectiveCancellation(cancelRow.activity, bookingDefaults)}
          payment={effectivePayment(cancelRow.activity, bookingDefaults)}
          recipient={recipientOf(cancelRow)}
          tenantId={tenant.id}
          tenantSlug={tenant.slug}
          business={tenant.name}
          currency={tenant.currency}
          nowIso={`${TODAY_KEY}T${String(new Date(NOW).getHours()).padStart(2, '0')}:${String(new Date(NOW).getMinutes()).padStart(2, '0')}:00`}
        />
      ) : null}
    </div>
  )
}
