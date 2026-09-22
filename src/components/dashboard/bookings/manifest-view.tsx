'use client'

import * as React from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  CloudLightning,
  CloudRain,
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
import { ACTIVITY_COLOR_VAR } from '@/components/charts/chart-container'
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

/* ==========================================================================
   ManifestView — pick a departure, work its guest list.

   The day is a list on the left and one departure on the right, so the crew
   never scrolls through thirteen expanded cards to find the 2 PM. The list
   carries just enough to choose (time, name, how many are aboard); the
   detail carries everything needed to run it. On a phone the list becomes a
   strip of chips above the detail. Printing lays every departure out in full.
   ========================================================================== */

/** Local ISO string with no timezone suffix — comparable against demo data. */
function isoLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

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
      {weather.tempC}°C · {weather.windKts}kt · {weather.goConfidence}% go
    </Badge>
  )
}

interface LiveCounts {
  expected: number
  aboard: number
  noShows: number
  revenue: number
  parties: number
}

function countRow(row: ManifestRow, checkedIn: Record<string, boolean>, noShows: Record<string, boolean>): LiveCounts {
  let expected = 0
  let aboard = 0
  let noShowCount = 0
  let revenue = 0
  let parties = 0
  for (const b of row.bookings) {
    if (b.status === 'cancelled' || b.status === 'refunded') continue
    parties += 1
    expected += b.partySize
    revenue += b.total
    if (checkedIn[b.id]) aboard += b.partySize
    if (noShows[b.id]) noShowCount += b.partySize
  }
  return { expected, aboard, noShows: noShowCount, revenue, parties }
}

/* ==========================================================================
   DEPARTURE LIST (the left rail)
   ========================================================================== */

function DepartureList({
  rows,
  counts,
  selectedId,
  currentId,
  onSelect,
}: {
  rows: ManifestRow[]
  counts: Record<string, LiveCounts>
  selectedId: string | null
  currentId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <ul
      className="flex gap-2 overflow-x-auto pb-1 no-scrollbar lg:flex-col lg:gap-1 lg:overflow-visible lg:pb-0"
      aria-label="Departures"
    >
      {rows.map((row) => {
        const { departure, activity } = row
        const c = counts[departure.id]
        const selected = departure.id === selectedId
        const done = c.expected > 0 && c.aboard >= c.expected
        const cancelled = departure.status === 'cancelled'

        return (
          <li key={departure.id} className="min-w-[13rem] shrink-0 lg:min-w-0">
            <button
              type="button"
              onClick={() => onSelect(departure.id)}
              aria-current={selected ? 'true' : undefined}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left',
                'transition-[background-color,border-color,box-shadow] duration-200 ease-[var(--ease-out-expo)]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                selected
                  ? 'border-primary/40 bg-primary-soft/60 shadow-xs'
                  : 'border-transparent hover:border-line hover:bg-surface-sunken/70',
                cancelled && 'opacity-60',
              )}
            >
              <span
                aria-hidden="true"
                className="h-9 w-1 shrink-0 rounded-full"
                style={{ background: ACTIVITY_COLOR_VAR[activity.colorKey] }}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-display text-[0.9375rem] font-semibold tracking-tight text-foreground tabular-nums">
                    {formatTime(departure.startsAt)}
                  </span>
                  {departure.id === currentId ? (
                    <span className="rounded-full bg-primary px-1.5 py-px text-xs font-bold tracking-wide text-on-primary uppercase">
                      Now
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-[0.8125rem] text-muted">{activity.name}</span>
                <span className="block text-xs text-subtle tabular-nums">
                  {cancelled
                    ? 'Cancelled'
                    : `${formatNumber(c.aboard)}/${formatNumber(c.expected)} aboard · ${departure.booked}/${departure.capacity} seats`}
                </span>
              </span>
              {!cancelled ? (
                <CheckInRing checkedIn={c.aboard} total={c.expected} size={36} className={cn(done && 'opacity-90')} />
              ) : null}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ==========================================================================
   DEPARTURE DETAIL (the right pane)
   ========================================================================== */

function DepartureDetail({
  row,
  resources,
  counts,
  checkedIn,
  onToggleGuest,
  onCheckInAll,
  onMarkNoShow,
  className,
}: {
  row: ManifestRow
  resources: Map<string, Resource>
  counts: LiveCounts
  checkedIn: Record<string, boolean>
  onToggleGuest: (bookingId: string, next: boolean) => void
  onCheckInAll: () => void
  onMarkNoShow: (bookingId: string) => void
  className?: string
}) {
  const { departure, activity, staff } = row
  const currency = CURRENT_TENANT.currency
  const vessels = departure.assignedResourceIds
    .map((id) => resources.get(id))
    .filter((r): r is Resource => Boolean(r))

  return (
    <article
      className={cn(
        'overflow-hidden rounded-2xl border border-line bg-surface shadow-sm print:break-inside-avoid print:shadow-none',
        className,
      )}
    >
      {/* ---- header -------------------------------------------------------- */}
      <div className="flex flex-col gap-4 border-b border-line-subtle p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="shrink-0">
              <p className="font-display text-3xl leading-none font-semibold tracking-tight text-foreground tabular-nums">
                {formatTime(departure.startsAt)}
              </p>
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-subtle tabular-nums">
                <Clock aria-hidden="true" className="size-3" />
                {formatDuration(activity.durationMinutes)}
              </p>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg leading-tight font-semibold tracking-tight text-foreground">
                  {activity.name}
                </h2>
                <StatusBadge kind="departure" status={departure.status} size="sm" />
                {departure.weather ? <WeatherChip weather={departure.weather} /> : null}
              </div>
              <dl className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                <div className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden="true" className="size-3.5 text-faint" />
                  <dd>{activity.meetingPoint}</dd>
                </div>
                {vessels.length > 0 ? (
                  <div className="inline-flex items-center gap-1.5">
                    <Ship aria-hidden="true" className="size-3.5 text-faint" />
                    <dd>{vessels.map((r) => r.name.split(' (')[0]).join(', ')}</dd>
                  </div>
                ) : null}
              </dl>
              {departure.notes ? (
                <p className="mt-2 inline-block rounded-lg bg-warning-soft px-2 py-1 text-xs font-medium text-warning">
                  {departure.notes}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {staff.length > 0 ? (
              <div className="text-right">
                <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Crew</p>
                <AvatarGroup
                  avatars={staff.map((u) => ({ id: u.id, name: u.name, src: u.avatarUrl }))}
                  size="sm"
                  max={3}
                  label={`Crew on the ${formatTime(departure.startsAt)} departure`}
                  ringClassName="ring-surface"
                  className="mt-1"
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <CapacityBar
            booked={departure.booked}
            capacity={departure.capacity}
            held={departure.held}
            size="md"
            showLabel
            unit="seat"
          />
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge variant="neutral" size="sm" className="tabular-nums">
              <Users aria-hidden="true" />
              {counts.expected} expected
            </Badge>
            {counts.noShows > 0 ? (
              <Badge variant="danger" size="sm" className="tabular-nums">
                <UserX aria-hidden="true" />
                {counts.noShows} no-show
              </Badge>
            ) : null}
            <Badge variant="outline" size="sm" className="tabular-nums">
              <Wallet aria-hidden="true" />
              {formatCurrency(counts.revenue, currency)}
            </Badge>
          </div>
        </div>
      </div>

      {/* ---- guests ---------------------------------------------------------- */}
      <div className="p-5">
        <CheckInList
          row={row}
          checkedIn={checkedIn}
          onToggle={onToggleGuest}
          onCheckInAll={onCheckInAll}
          onMarkNoShow={onMarkNoShow}
          currency={currency}
        />
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
  const [selectedId, setSelectedId] = React.useState<string | null>(null)

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

  // The departure the dock is working right now — the first that has not
  // sailed yet, or simply the first of the day.
  const currentId = React.useMemo(() => {
    const current =
      manifest.find((row) => row.departure.endsAt >= isoLocal(NOW) && row.departure.status !== 'cancelled') ??
      manifest[0]
    return current?.departure.id ?? null
  }, [manifest])

  // Seed check-in state from the real booking statuses whenever the day changes.
  React.useEffect(() => {
    const seeded: Record<string, boolean> = {}
    const seededNoShows: Record<string, boolean> = {}
    for (const row of manifest) {
      for (const booking of row.bookings) {
        if (booking.status === 'checked_in' || booking.status === 'completed') seeded[booking.id] = true
        if (booking.status === 'no_show') seededNoShows[booking.id] = true
      }
    }
    setCheckedIn(seeded)
    setNoShows(seededNoShows)
    setSelectedId(currentId)
  }, [manifest, currentId])

  const counts = React.useMemo(() => {
    const map: Record<string, LiveCounts> = {}
    for (const row of manifest) map[row.departure.id] = countRow(row, checkedIn, noShows)
    return map
  }, [manifest, checkedIn, noShows])

  const totals = React.useMemo(() => {
    const t = { guests: 0, aboard: 0, revenue: 0, noShowGuests: 0 }
    for (const c of Object.values(counts)) {
      t.guests += c.expected
      t.aboard += c.aboard
      t.revenue += c.revenue
      t.noShowGuests += c.noShows
    }
    return t
  }, [counts])

  const selected = manifest.find((row) => row.departure.id === selectedId) ?? manifest[0] ?? null

  /* ---- handlers ---------------------------------------------------------- */
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
  const checkedPct = totals.guests === 0 ? 0 : Math.round((totals.aboard / totals.guests) * 100)

  const summary: { label: string; value: string; icon: LucideIcon; tone: 'primary' | 'success' | 'warning' | 'neutral' }[] = [
    { label: `Departure${manifest.length === 1 ? '' : 's'}`, value: formatNumber(manifest.length), icon: Ship, tone: 'primary' },
    { label: 'Guests expected', value: formatNumber(totals.guests), icon: Users, tone: 'neutral' },
    { label: `Checked in · ${checkedPct}%`, value: formatNumber(totals.aboard), icon: Users, tone: 'success' },
    { label: 'No-shows', value: formatNumber(totals.noShowGuests), icon: UserX, tone: totals.noShowGuests > 0 ? 'warning' : 'neutral' },
    { label: 'On the water', value: formatCurrency(totals.revenue, tenant.currency, { compact: true }), icon: Wallet, tone: 'primary' },
  ]

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      {/* ---- day + actions ------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1 print:hidden">
          <IconButton aria-label="Previous day" size="sm" variant="ghost" onClick={() => setOffset((o) => o - 1)}>
            <ChevronLeft />
          </IconButton>
          <Button variant={isToday ? 'primary' : 'ghost'} size="sm" onClick={() => setOffset(0)} className="min-w-[4.5rem]">
            Today
          </Button>
          <IconButton aria-label="Next day" size="sm" variant="ghost" onClick={() => setOffset((o) => o + 1)}>
            <ChevronRight />
          </IconButton>
        </div>

        <p className="flex min-w-0 items-center gap-2 font-display text-lg font-semibold tracking-tight text-foreground">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-subtle" />
          {formatDateLong(day)}
          {isToday ? (
            <Badge variant="primary" size="sm">
              Today
            </Badge>
          ) : null}
        </p>

        <div className="ml-auto flex items-center gap-2 print:hidden">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<RefreshCw />}
            onClick={() =>
              toast.success('Manifest refreshed', { description: 'Pulled the latest bookings, crew and weather.' })
            }
          >
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button variant="secondary" size="sm" leftIcon={<Printer />} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      {/* ---- the day in five numbers ---------------------------------------- */}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line-subtle sm:grid-cols-3 lg:grid-cols-5">
        {summary.map((cell, i) => {
          const Icon = cell.icon
          return (
            <div
              key={cell.label}
              className={cn(
                'flex min-w-0 items-center gap-3 bg-surface px-4 py-3',
                i === summary.length - 1 && 'col-span-2 sm:col-span-1',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'grid size-8 shrink-0 place-items-center rounded-lg',
                  cell.tone === 'primary' && 'bg-primary-soft text-primary',
                  cell.tone === 'success' && 'bg-success-soft text-success',
                  cell.tone === 'warning' && 'bg-warning-soft text-warning',
                  cell.tone === 'neutral' && 'bg-surface-sunken text-subtle',
                )}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <dd className="font-display text-lg leading-tight font-semibold tracking-tight text-foreground tabular-nums">
                  {cell.value}
                </dd>
                <dt className="truncate text-xs text-subtle">{cell.label}</dt>
              </span>
            </div>
          )
        })}
      </dl>

      {/* ---- departures ------------------------------------------------------ */}
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
        <>
          <div className="grid gap-5 print:hidden lg:grid-cols-12">
            <aside className="min-w-0 lg:col-span-4 xl:col-span-3">
              <div className="rounded-2xl border border-line bg-surface p-2 lg:sticky lg:top-20">
                <p className="px-2 pt-1 pb-2 text-xs font-semibold tracking-wide text-subtle uppercase">
                  {manifest.length} {manifest.length === 1 ? 'departure' : 'departures'}
                </p>
                <div className="lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
                  <DepartureList
                    rows={manifest}
                    counts={counts}
                    selectedId={selected?.departure.id ?? null}
                    currentId={currentId}
                    onSelect={setSelectedId}
                  />
                </div>
              </div>
            </aside>

            <section className="min-w-0 lg:col-span-8 xl:col-span-9" aria-live="polite">
              {selected ? (
                <DepartureDetail
                  key={selected.departure.id}
                  row={selected}
                  resources={resources}
                  counts={counts[selected.departure.id]}
                  checkedIn={checkedIn}
                  onToggleGuest={toggleGuest}
                  onCheckInAll={() => checkInDeparture(selected)}
                  onMarkNoShow={markNoShow}
                  className="animate-in-up"
                />
              ) : null}
            </section>
          </div>

          {/* Paper: every departure, in full. */}
          <div className="hidden flex-col gap-4 print:flex">
            {manifest.map((row) => (
              <DepartureDetail
                key={row.departure.id}
                row={row}
                resources={resources}
                counts={counts[row.departure.id]}
                checkedIn={checkedIn}
                onToggleGuest={toggleGuest}
                onCheckInAll={() => checkInDeparture(row)}
                onMarkNoShow={markNoShow}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
