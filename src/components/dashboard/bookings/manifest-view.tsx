'use client'

import * as React from 'react'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Cloud,
  CloudLightning,
  CloudRain,
  Clock,
  MapPin,
  Printer,
  RefreshCw,
  Ship,
  Sun,
  UserX,
  Users,
  Wallet,
  Wind,
  type LucideIcon,
} from 'lucide-react'

import type { Resource, WeatherSnapshot } from '@/types'
import type { ManifestRow } from '@/lib/demo'
import { CURRENT_TENANT, NOW, getResourcesByTenant } from '@/lib/demo-core'
import { fetchManifest } from '@/lib/actions/dashboard'
import {
  addDays,
  cn,
  formatCurrency,
  formatDateLong,
  formatDuration,
  formatNumber,
  formatTime,
  isSameDay,
} from '@/lib/utils'
import { AvatarGroup } from '@/components/ui/avatar'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CapacityBar } from '@/components/ui/progress'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { toast } from '@/components/ui/toaster'
import { CheckInList, CheckInRing } from '@/components/dashboard/bookings/check-in-list'

/** Local ISO string with no timezone suffix — comparable against demo data. */
function isoLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/* ==========================================================================
   WEATHER
   ========================================================================== */

const WEATHER_ICON: Record<WeatherSnapshot['condition'], LucideIcon> = {
  clear: Sun,
  cloudy: Cloud,
  rain: CloudRain,
  storm: CloudLightning,
  wind: Wind,
}

function WeatherChip({ weather }: { weather: WeatherSnapshot }) {
  const Icon = WEATHER_ICON[weather.condition]
  const tone =
    weather.goConfidence >= 80 ? 'success' : weather.goConfidence >= 55 ? 'warning' : 'danger'

  return (
    <Badge variant={tone} size="sm" className="tabular-nums">
      <Icon aria-hidden="true" />
      {weather.tempC}°C · {weather.windKts}kt
      {typeof weather.swellM === 'number' ? ` · ${weather.swellM}m swell` : ''} ·{' '}
      {weather.goConfidence}% go
    </Badge>
  )
}

/* ==========================================================================
   SUMMARY STRIP
   ========================================================================== */

function SummaryCell({
  label,
  value,
  icon: Icon,
  tone = 'neutral',
  hint,
}: {
  label: string
  value: string
  icon: LucideIcon
  tone?: 'neutral' | 'primary' | 'success' | 'warning'
  hint?: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-3.5">
      <span
        aria-hidden="true"
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-xl',
          tone === 'primary' && 'bg-primary-soft text-primary',
          tone === 'success' && 'bg-success-soft text-success',
          tone === 'warning' && 'bg-warning-soft text-warning',
          tone === 'neutral' && 'bg-surface-sunken text-subtle',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-display text-lg leading-tight font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </span>
        <span className="block truncate text-xs text-subtle">{hint ?? label}</span>
      </span>
    </div>
  )
}

/* ==========================================================================
   DEPARTURE CARD
   ========================================================================== */

function DepartureCard({
  row,
  resources,
  expanded,
  onToggleExpanded,
  checkedIn,
  noShows,
  onToggleGuest,
  onCheckInAll,
  onMarkNoShow,
}: {
  row: ManifestRow
  resources: Map<string, Resource>
  expanded: boolean
  onToggleExpanded: () => void
  checkedIn: Record<string, boolean>
  noShows: Record<string, boolean>
  onToggleGuest: (bookingId: string, next: boolean) => void
  onCheckInAll: () => void
  onMarkNoShow: (bookingId: string) => void
}) {
  const { departure, activity, bookings, staff } = row
  const currency = CURRENT_TENANT.currency

  const live = bookings.filter((b) => b.status !== 'cancelled' && b.status !== 'refunded')
  const guestsExpected = live.reduce((sum, b) => sum + b.partySize, 0)
  const guestsIn = live.reduce((sum, b) => sum + (checkedIn[b.id] ? b.partySize : 0), 0)
  const noShowCount = live.filter((b) => noShows[b.id]).length
  const revenue = live.reduce((sum, b) => sum + b.total, 0)
  const assignedResources = departure.assignedResourceIds
    .map((id) => resources.get(id))
    .filter((r): r is Resource => Boolean(r))

  const accent =
    activity.colorKey === 'lagoon'
      ? 'bg-chart-1'
      : activity.colorKey === 'coral'
        ? 'bg-chart-2'
        : activity.colorKey === 'sunset'
          ? 'bg-chart-4'
          : activity.colorKey === 'reef'
            ? 'bg-chart-3'
            : activity.colorKey === 'info'
              ? 'bg-chart-5'
              : 'bg-chart-6'

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-2xl border border-line bg-surface shadow-sm',
        'print:break-inside-avoid print:shadow-none',
      )}
    >
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1', accent)} />

      <div className="flex flex-col gap-4 p-4 pl-5 sm:p-5 sm:pl-6">
        {/* Header row */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex shrink-0 flex-col">
            <span className="font-display text-2xl leading-none font-semibold tracking-tight text-foreground tabular-nums">
              {formatTime(departure.startsAt)}
            </span>
            <span className="mt-1 inline-flex items-center gap-1 text-xs text-subtle tabular-nums">
              <Clock aria-hidden="true" className="size-3" />
              {formatDuration(activity.durationMinutes)}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-display text-base font-semibold tracking-tight text-foreground">
                {activity.name}
              </h3>
              <StatusBadge kind="departure" status={departure.status} size="sm" />
              {departure.weather ? <WeatherChip weather={departure.weather} /> : null}
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden="true" className="size-3.5 text-faint" />
                {activity.meetingPoint}
              </span>
              {assignedResources.length > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Ship aria-hidden="true" className="size-3.5 text-faint" />
                  {assignedResources.map((r) => r.name).join(', ')}
                </span>
              ) : null}
            </div>

            {departure.notes ? (
              <p className="mt-1.5 rounded-lg bg-warning-soft px-2 py-1 text-xs font-medium text-warning">
                {departure.notes}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <AvatarGroup
              avatars={staff.map((u) => ({ id: u.id, name: u.name, src: u.avatarUrl }))}
              size="sm"
              max={3}
              label={`Crew on the ${formatTime(departure.startsAt)} departure`}
              ringClassName="ring-surface"
            />
            <CheckInRing checkedIn={guestsIn} total={guestsExpected} size={48} />
          </div>
        </div>

        {/* Capacity + figures */}
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <CapacityBar
            booked={departure.booked}
            capacity={departure.capacity}
            held={departure.held}
            size="md"
            showLabel
            unit="seats"
          />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="neutral" size="sm" className="tabular-nums">
              <Users aria-hidden="true" />
              {guestsExpected} expected
            </Badge>
            {noShowCount > 0 ? (
              <Badge variant="danger" size="sm" className="tabular-nums">
                <UserX aria-hidden="true" />
                {noShowCount} no-show
              </Badge>
            ) : null}
            <Badge variant="outline" size="sm" className="tabular-nums">
              <Wallet aria-hidden="true" />
              {formatCurrency(revenue, currency)}
            </Badge>
          </div>
        </div>

        {/* Expand control */}
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          className={cn(
            'flex w-full items-center justify-center gap-1.5 rounded-xl border border-line-subtle',
            'bg-surface-sunken py-2 text-[0.8125rem] font-medium text-muted',
            'transition-colors duration-200 hover:bg-background-subtle hover:text-foreground',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            'print:hidden',
          )}
        >
          {expanded ? 'Hide guest list' : `Show guest list · ${live.length} parties`}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              'size-4 transition-transform duration-300 ease-[var(--ease-out-expo)]',
              expanded && 'rotate-180',
            )}
          />
        </button>

        {/* Guest list — always mounted so a printed run sheet carries every party,
            collapsed or not. */}
        <div className={cn('pt-1', expanded ? 'animate-in-up' : 'hidden print:block')}>
          <CheckInList
            row={row}
            checkedIn={checkedIn}
            onToggle={onToggleGuest}
            onCheckInAll={onCheckInAll}
            onMarkNoShow={onMarkNoShow}
            currency={currency}
          />
        </div>
      </div>
    </article>
  )
}

/* ==========================================================================
   MANIFEST VIEW
   ========================================================================== */

export interface ManifestViewProps {
  /** Today's run sheet, computed on the server. Other days load via a Server Action. */
  initialManifest: ManifestRow[]
  className?: string
}

export function ManifestView({ initialManifest, className }: ManifestViewProps) {
  const tenant = CURRENT_TENANT
  const [offset, setOffset] = React.useState(0)
  const [checkedIn, setCheckedIn] = React.useState<Record<string, boolean>>({})
  const [noShows, setNoShows] = React.useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({})

  const day = React.useMemo(() => addDays(NOW, offset), [offset])
  const [manifestByOffset, setManifestByOffset] = React.useState<Record<number, ManifestRow[]>>({
    0: initialManifest,
  })
  React.useEffect(() => {
    if (offset in manifestByOffset) return
    let cancelled = false
    fetchManifest(tenant.id, day).then((rows) => {
      if (!cancelled) setManifestByOffset((prev) => ({ ...prev, [offset]: rows }))
    })
    return () => {
      cancelled = true
    }
  }, [offset, day, tenant.id, manifestByOffset])
  const manifest = React.useMemo(() => manifestByOffset[offset] ?? [], [manifestByOffset, offset])

  const resources = React.useMemo(() => {
    const map = new Map<string, Resource>()
    for (const resource of getResourcesByTenant(tenant.id)) map.set(resource.id, resource)
    return map
  }, [tenant.id])

  // Seed check-in state from the real booking statuses whenever the day changes.
  React.useEffect(() => {
    const seeded: Record<string, boolean> = {}
    const seededNoShows: Record<string, boolean> = {}
    const seededExpanded: Record<string, boolean> = {}

    for (const row of manifest) {
      for (const booking of row.bookings) {
        if (booking.status === 'checked_in' || booking.status === 'completed') {
          seeded[booking.id] = true
        }
        if (booking.status === 'no_show') seededNoShows[booking.id] = true
      }
      seededExpanded[row.departure.id] = false
    }

    // Open whichever departure the dock is working right now — the first one
    // that has not sailed yet, or simply the first of the day.
    const current =
      manifest.find(
        (row) => row.departure.endsAt >= isoLocal(NOW) && row.departure.status !== 'cancelled',
      ) ?? manifest[0]
    if (current) seededExpanded[current.departure.id] = true

    setCheckedIn(seeded)
    setNoShows(seededNoShows)
    setExpanded(seededExpanded)
  }, [manifest])

  /* ------------------------------------------------------------------
     Totals
     ------------------------------------------------------------------ */
  const totals = React.useMemo(() => {
    let guests = 0
    let aboard = 0
    let revenue = 0
    let noShowGuests = 0

    for (const row of manifest) {
      for (const booking of row.bookings) {
        if (booking.status === 'cancelled' || booking.status === 'refunded') continue
        guests += booking.partySize
        revenue += booking.total
        if (checkedIn[booking.id]) aboard += booking.partySize
        if (noShows[booking.id]) noShowGuests += booking.partySize
      }
    }

    return { guests, aboard, revenue, noShowGuests }
  }, [manifest, checkedIn, noShows])

  /* ------------------------------------------------------------------
     Handlers
     ------------------------------------------------------------------ */
  const toggleGuest = (bookingId: string, next: boolean) => {
    setCheckedIn((prev) => ({ ...prev, [bookingId]: next }))
    if (next) setNoShows((prev) => ({ ...prev, [bookingId]: false }))
  }

  const checkInDeparture = (row: ManifestRow) => {
    setCheckedIn((prev) => {
      const draft = { ...prev }
      for (const booking of row.bookings) {
        if (booking.status === 'cancelled' || booking.status === 'refunded') continue
        draft[booking.id] = true
      }
      return draft
    })
    toast.success(`${row.activity.name} is fully checked in`, {
      description: `${formatTime(row.departure.startsAt)} departure · ${row.departure.booked} guests aboard.`,
    })
  }

  const markNoShow = (bookingId: string) => {
    setNoShows((prev) => ({ ...prev, [bookingId]: true }))
    toast.error('Marked as a no-show', {
      description: 'The seat stays sold; the crew sheet now shows the party did not arrive.',
    })
  }

  const isToday = isSameDay(day, NOW)

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {/* ==================================================================
          DATE NAVIGATOR
          ================================================================== */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 print:hidden">
          <IconButton
            aria-label="Previous day"
            size="sm"
            variant="ghost"
            onClick={() => setOffset((o) => o - 1)}
          >
            <ChevronLeft />
          </IconButton>
          <Button
            variant={isToday ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setOffset(0)}
            className="min-w-[4.5rem]"
          >
            Today
          </Button>
          <IconButton
            aria-label="Next day"
            size="sm"
            variant="ghost"
            onClick={() => setOffset((o) => o + 1)}
          >
            <ChevronRight />
          </IconButton>
        </div>

        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-foreground">
            <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-subtle" />
            {formatDateLong(day)}
            {isToday ? (
              <Badge variant="primary" size="sm">
                Today
              </Badge>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-subtle">
            {tenant.name} · {tenant.city} · run sheet generated {formatTime(NOW)}
          </p>
        </div>

        <div className="ml-auto flex items-center gap-2 print:hidden">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw />}
            onClick={() =>
              toast.success('Manifest refreshed', {
                description: 'Pulled the latest bookings, crew and weather.',
              })
            }
          >
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Printer />}
            onClick={() => {
              if (typeof window !== 'undefined') window.print()
            }}
          >
            Print
          </Button>
        </div>
      </div>

      {/* ==================================================================
          SUMMARY STRIP
          ================================================================== */}
      <div className="grid grid-cols-2 divide-line-subtle overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-3 lg:grid-cols-5 lg:divide-x">
        <SummaryCell
          label="Departures"
          hint={`Departure${manifest.length === 1 ? '' : 's'} scheduled`}
          value={formatNumber(manifest.length)}
          icon={Ship}
          tone="primary"
        />
        <SummaryCell
          label="Guests expected"
          hint="Guests expected"
          value={formatNumber(totals.guests)}
          icon={Users}
        />
        <SummaryCell
          label="Checked in"
          hint={`Checked in · ${
            totals.guests === 0 ? 0 : Math.round((totals.aboard / totals.guests) * 100)
          }%`}
          value={formatNumber(totals.aboard)}
          icon={Users}
          tone="success"
        />
        <SummaryCell
          label="No-shows"
          hint="No-shows recorded"
          value={formatNumber(totals.noShowGuests)}
          icon={UserX}
          tone={totals.noShowGuests > 0 ? 'warning' : 'neutral'}
        />
        <SummaryCell
          label="Revenue"
          hint="Revenue on the water"
          value={formatCurrency(totals.revenue, tenant.currency, { compact: true })}
          icon={Wallet}
          tone="primary"
        />
      </div>

      {/* ==================================================================
          DEPARTURES
          ================================================================== */}
      {manifest.length === 0 ? (
        <EmptyState
          variant="no-data"
          icon={CalendarDays}
          title="Nothing scheduled on this day"
          description="No departures are on the calendar for this date. Step forward to the next trading day, or open the calendar to schedule one."
          action={
            <Button variant="secondary" onClick={() => setOffset((o) => o + 1)}>
              Next day
            </Button>
          }
          className="rounded-2xl border border-line bg-surface"
        />
      ) : (
        <div className="flex flex-col gap-3.5">
          {manifest.map((row) => (
            <DepartureCard
              key={row.departure.id}
              row={row}
              resources={resources}
              expanded={Boolean(expanded[row.departure.id])}
              onToggleExpanded={() =>
                setExpanded((prev) => ({
                  ...prev,
                  [row.departure.id]: !prev[row.departure.id],
                }))
              }
              checkedIn={checkedIn}
              noShows={noShows}
              onToggleGuest={toggleGuest}
              onCheckInAll={() => checkInDeparture(row)}
              onMarkNoShow={markNoShow}
            />
          ))}
        </div>
      )}
    </div>
  )
}
