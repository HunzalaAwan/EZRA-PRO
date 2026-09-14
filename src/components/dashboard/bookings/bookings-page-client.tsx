'use client'

import * as React from 'react'
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

import type { BookingRow } from '@/lib/demo'
import type { Activity, Tenant } from '@/types'
import { addDays, formatNumber, percentChange, toDateKey } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { StatCard, StatGrid } from '@/components/ui/stat'
import { Segmented, type SegmentedOption } from '@/components/ui/segmented'
import { toast } from '@/components/ui/toaster'
import type { DataTableSort } from '@/components/ui/data-table'
import { PageHeader } from '@/components/dashboard/page-header'
import {
  BookingsFilters,
  DEFAULT_BOOKING_FILTERS,
  STATUS_TAB_LABEL,
  STATUS_TAB_MATCH,
  STATUS_TAB_ORDER,
  type BookingFilters,
  type BookingStatusTab,
  type SavedView,
} from '@/components/dashboard/bookings/bookings-filters'
import { BookingsTable } from '@/components/dashboard/bookings/bookings-table'
import { BookingDetailSheet } from '@/components/dashboard/bookings/booking-detail-sheet'
import { NewBookingDialog } from '@/components/dashboard/bookings/new-booking-dialog'

/* ==========================================================================
   THE RESERVATIONS DESK
   One screen an operator lives in all day: today's numbers up top, a status
   rail, saved views, and 13k reservations paginated underneath.
   ========================================================================== */

const DEFAULT_SORT: DataTableSort = { id: 'created', dir: 'desc' }

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
  allRows: BookingRow[]
  activities: Activity[]
  now: Date
  todayKey: string
}

/**
 * All the reservations-desk logic and UI, unchanged from when this lived at
 * the route file — only the data acquisition moved. `allRows` (13k+ joined
 * rows for the primary demo tenant) is computed once on the server and
 * handed down as a prop; it must never be re-fetched or re-generated here,
 * or the entire synthetic dataset ships into the client bundle again.
 */
export function BookingsPageClient({ tenant, allRows, activities, now: NOW, todayKey: TODAY_KEY }: BookingsPageClientProps) {

  const [filters, setFilters] = React.useState<BookingFilters>(DEFAULT_BOOKING_FILTERS)
  const [statusTab, setStatusTab] = React.useState<BookingStatusTab>('all')
  const [activeViewId, setActiveViewId] = React.useState<string | null>('all')
  const [sort, setSort] = React.useState<DataTableSort>(DEFAULT_SORT)
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(25)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [openBookingId, setOpenBookingId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [newBookingOpen, setNewBookingOpen] = React.useState(false)

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
  const preTabRows = React.useMemo(() => {
    const needle = filters.search.trim().toLowerCase()
    const from = filters.range?.from
    const to = filters.range?.to

    return allRows.filter((row) => {
      if (needle && !matchesSearch(row, needle)) return false
      if (filters.activityId !== 'all' && row.activity.id !== filters.activityId) return false
      if (filters.channel !== 'all' && row.booking.channel !== filters.channel) return false
      if (filters.payment !== 'all' && row.booking.paymentStatus !== filters.payment) return false
      if (from && to) {
        const key = row.departure.startsAt.slice(0, 10)
        if (key < from || key > to) return false
      }
      return true
    })
  }, [allRows, filters])

  const tabCounts = React.useMemo(() => {
    const counts: Record<BookingStatusTab, number> = {
      all: preTabRows.length,
      pending: 0,
      confirmed: 0,
      checked_in: 0,
      completed: 0,
      cancelled: 0,
    }
    for (const { booking } of preTabRows) {
      for (const tab of STATUS_TAB_ORDER) {
        if (tab === 'all') continue
        if ((STATUS_TAB_MATCH[tab] as string[]).includes(booking.status)) {
          counts[tab] += 1
          break
        }
      }
    }
    return counts
  }, [preTabRows])

  const filteredRows = React.useMemo(() => {
    if (statusTab === 'all') return preTabRows
    const allowed = new Set<string>(STATUS_TAB_MATCH[statusTab])
    return preTabRows.filter((row) => allowed.has(row.booking.status))
  }, [preTabRows, statusTab])

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
    setActiveViewId(null)
    setPage(1)
  }

  const applyView = (view: SavedView) => {
    setFilters(view.filters)
    setStatusTab(view.status)
    setActiveViewId(view.id)
    setPage(1)
    setSelectedIds([])
  }

  const clearEverything = () => {
    setFilters(DEFAULT_BOOKING_FILTERS)
    setStatusTab('all')
    setActiveViewId('all')
    setPage(1)
  }

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

  const bulkAction = (action: 'confirm' | 'message' | 'export' | 'cancel', ids: string[]) => {
    const n = ids.length
    const noun = n === 1 ? 'reservation' : 'reservations'
    switch (action) {
      case 'confirm':
        toast.success(`${n} ${noun} confirmed`, {
          description: 'Confirmation emails are on their way to each guest.',
        })
        break
      case 'message':
        toast.success(`Composer opened for ${n} ${noun}`, {
          description: 'Pick a template or write once and send to the whole selection.',
        })
        break
      case 'export':
        toast.success(`Exported ${n} ${noun}`, { description: 'reservations.csv is downloading.' })
        break
      case 'cancel':
        toast.error(`${n} ${noun} cancelled`, {
          description: 'Seats released and refunds queued per each policy.',
        })
        break
    }
    setSelectedIds([])
  }

  const statusOptions: SegmentedOption<BookingStatusTab>[] = STATUS_TAB_ORDER.map((tab) => ({
    value: tab,
    label: STATUS_TAB_LABEL[tab],
    count: tabCounts[tab],
  }))

  const openRowData = openIndex >= 0 ? sortedRows[openIndex] : null

  return (
    <div className="flex flex-col gap-5 pb-24">
      <PageHeader
        className="mb-0"
        title="Reservations"
        description={`Every booking across ${activities.length} experiences — search, filter and action without leaving the desk.`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              leftIcon={<Printer />}
              className="hidden sm:inline-flex"
              onClick={() => toast.success('Run sheet sent to the printer')}
            >
              Print
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Download />}
              onClick={() =>
                toast.success(`Exported ${formatNumber(sortedRows.length)} reservations`, {
                  description: 'reservations.csv is downloading.',
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
            label: 'Departing today',
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
              Open today&rsquo;s manifest →
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
            hint: 'Pending reservations on departures that have not sailed yet.',
          }}
          footer={
            <button
              type="button"
              onClick={() => {
                setStatusTab('pending')
                setActiveViewId('needs-action')
                setFilters(DEFAULT_BOOKING_FILTERS)
                setPage(1)
              }}
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
          STATUS RAIL
          ================================================================== */}
      <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
        <Segmented
          options={statusOptions}
          value={statusTab}
          onValueChange={(value) => {
            setStatusTab(value)
            setActiveViewId(null)
            setPage(1)
            setSelectedIds([])
          }}
          label="Filter reservations by status"
          size="md"
          className="min-w-max"
        />
      </div>

      {/* ==================================================================
          FILTERS
          ================================================================== */}
      <BookingsFilters
        filters={filters}
        onFiltersChange={applyFilters}
        activities={activities}
        activeViewId={activeViewId}
        onApplyView={applyView}
        resultSummary={
          <>
            {formatNumber(sortedRows.length)} of {formatNumber(allRows.length)} reservations
          </>
        }
      />

      {/* ==================================================================
          TABLE
          ================================================================== */}
      <BookingsTable
        rows={pageRows}
        currency={tenant.currency}
        sort={sort}
        onSortChange={(next) => {
          setSort(next)
          setPage(1)
        }}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={openRow}
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
    </div>
  )
}
