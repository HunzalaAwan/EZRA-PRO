'use client'

/**
 * DepartureDetailSheet — everything about one departure, in the order an
 * operator asks for it: is it running, who is on it, is it paid, who is
 * crewing it, and what do I do about it.
 */

import * as React from 'react'
import Link from 'next/link'
import { useBookingLedger } from '@/hooks/use-booking-ledger'
import { changeBooking, changeStartOf, entriesOn, peopleOfEntry } from '@/lib/booking-ledger'
import { flightLine, hhmm, slotIdsOf } from '@/lib/transfer-changes'
import type { TransferBookingDetails } from '@/types'
import { MessageComposer, sendToGuests, type MessageRecipient } from '@/components/dashboard/bookings/message-composer'
import { useMessageTemplates } from '@/hooks/use-message-templates'
import { useActivityOverrides } from '@/hooks/use-pricing-override'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { applyActivityOverride, applyScheduleOverride, parseActivityOverrides, readActivityOverridesRaw, saveScheduleOverride } from '@/lib/activity-overrides'
import { cancelChangeId as cancelChangeIdFor, defaultSpots, expandSchedules, scheduleContextOf, slotExtraOf, spotsAfterEdit } from '@/lib/activity-schedule'
import { privateMostOf, slotExtraSpotsOf, usualSpotsOf } from '@/lib/extra-spots'
import { NewDepartureDialog } from '@/components/dashboard/calendar/new-departure-dialog'
import { CURRENT_TENANT, tenantById } from '@/lib/demo-core'
import Image from 'next/image'
import {
  Anchor,
  CalendarPlus,
  Cloud,
  CloudLightning,
  CloudRain,
  Copy,
  MapPin,
  MessageSquare,
  Pencil,
  Ship,
  Sun,
  Timer,
  TriangleAlert,
  UserPlus,
  Users,
  Wind,
  ClipboardList,
  Ban,
} from 'lucide-react'

import {
  cn,
  formatCurrency,
  formatDateLong,
  formatDuration,
  formatNumber,
  formatTime,
  fillRate,
} from '@/lib/utils'
import { fetchDepartureDetail, type DepartureDetail } from '@/lib/actions/dashboard'
import type { CurrencyCode, ScheduleChange, WeatherSnapshot } from '@/types'
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Avatar } from '@/components/ui/avatar'
import { CapacityBar } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { RadialGauge } from '@/components/charts/radial-gauge'
import { toast } from '@/components/ui/toaster'
import { EVENT_SOLID, eventVar } from '@/components/dashboard/calendar/departure-chip'

/* ==========================================================================
   WEATHER
   ========================================================================== */

const WEATHER_META: Record<
  WeatherSnapshot['condition'],
  { icon: React.ElementType; label: string }
> = {
  clear: { icon: Sun, label: 'Clear' },
  cloudy: { icon: Cloud, label: 'Cloudy' },
  rain: { icon: CloudRain, label: 'Rain' },
  storm: { icon: CloudLightning, label: 'Storm' },
  wind: { icon: Wind, label: 'Windy' },
}

/* ==========================================================================
   SMALL PARTS
   ========================================================================== */

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-subtle">
        <Icon aria-hidden="true" className="size-3.5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-faint uppercase">{label}</p>
        <p className="text-[0.8125rem] font-medium text-foreground">{value}</p>
      </div>
    </div>
  )
}

function MoneyTile({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'success' | 'warning'
}) {
  return (
    <div className="rounded-xl border border-line-subtle bg-surface-sunken/50 px-3 py-2.5">
      <p className="text-xs font-medium tracking-wide text-faint uppercase">{label}</p>
      <p
        className={cn(
          'tabular font-display text-[1.0625rem] leading-tight font-semibold',
          tone === 'success' && 'text-success',
          tone === 'warning' && 'text-warning',
          tone === 'default' && 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  )
}

function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="font-display text-[0.8125rem] font-semibold tracking-[-0.01em] text-foreground">
        {children}
      </h3>
      {typeof count === 'number' ? (
        <Badge size="sm" variant="neutral">
          {count}
        </Badge>
      ) : null}
    </div>
  )
}

/* ==========================================================================
   SHEET
   ========================================================================== */

export interface DepartureDetailSheetProps {
  departureId: string | null
  onOpenChange: (open: boolean) => void
  currency: CurrencyCode
  /**
   * No longer called: Duplicate opens "Add a time slot" from this sheet, with
   * the activity, location, day and start time filled in. Kept for callers.
   */
  onDuplicate?: (departureId: string) => void
  /** Bookings made in this browser (online, by staff, from packages) are listed too. */
  tenantSlug?: string
}

export function DepartureDetailSheet({
  departureId,
  onOpenChange,
  currency,
  tenantSlug = '',
}: DepartureDetailSheetProps) {
  const ledger = useBookingLedger(tenantSlug)
  const overrides = useActivityOverrides()
  const { defaults: bookingDefaults } = useBookingDefaults(tenantSlug)
  // Hold the last id so the closing animation still has something to render.
  const [cachedId, setCachedId] = React.useState<string | null>(departureId)
  const [confirmCancel, setConfirmCancel] = React.useState(false)
  const [composeOpen, setComposeOpen] = React.useState(false)
  /** "Duplicate": the add-a-time-slot form, filled in from this time slot. */
  const [duplicate, setDuplicate] = React.useState<{ date: Date; time: string; activityId: string; locationId: string | null } | null>(null)
  const [message, setMessage] = React.useState('')

  React.useEffect(() => {
    if (departureId) setCachedId(departureId)
  }, [departureId])

  // Loaded through a Server Action so the bookings/customers indexes stay on
  // the server — this sheet never imports the dataset module itself.
  const [loaded, setLoaded] = React.useState<DepartureDetail | null>(null)
  const { templates } = useMessageTemplates(loaded?.departure.tenantId ?? CURRENT_TENANT.id)
  React.useEffect(() => {
    if (!cachedId) return
    let cancelled = false
    fetchDepartureDetail(cachedId).then((next) => {
      if (!cancelled) setLoaded(next)
    })
    return () => {
      cancelled = true
    }
  }, [cachedId])

  const detail = React.useMemo(() => {
    if (!cachedId || !loaded || loaded.departure.id !== cachedId) return null
    const { departure: given, activity, guests, crew, resources, gross, paid } = loaded
    const media = activity.media.find((item) => item.isPrimary) ?? activity.media[0]
    // The spots as the calendar shows them after a saved edit: the edit's spots for this time, its extra spots on top.
    const override = overrides[activity.id]
    const edited = override ? applyActivityOverride(activity, override) : activity
    // The extra spots in the shown spots: the edit's once laid over, else the ones the server's spots were sold with.
    // A private group: its size that day and the extra guests over it (a weekday's or a date's own, else the usual ones).
    const charter = (activity.kind ?? 'trip') === 'charter'
    const [served, extraSpots, group] = ((): [typeof given, number, { size: number; most: number } | undefined] => {
      const usualGroup = charter ? { size: usualSpotsOf(edited), most: privateMostOf(edited) } : undefined
      const asServed: [typeof given, number, typeof usualGroup] = [given, slotExtraSpotsOf(activity), usualGroup]
      if (!override || given.status === 'cancelled' || given.status === 'completed') return asServed
      const day = given.startsAt.slice(0, 10)
      const primary = edited.locations[0]?.locationId
      const entry = expandSchedules(edited, day, day, scheduleContextOf(bookingDefaults)).find(
        (slot) => slot.time === given.startsAt.slice(11, 16) && (slot.locationId ?? primary) === (given.locationId ?? primary),
      )
      if (!entry) return asServed
      if (charter) {
        const size = entry.groupSize ?? usualGroup!.size
        const extra = entry.extraSpots ?? Math.max(0, usualGroup!.most - usualGroup!.size)
        return [given, 0, { size, most: size + extra }]
      }
      const extraNow = slotExtraOf(edited, entry)
      const spots = spotsAfterEdit(given.capacity, entry, defaultSpots(edited) !== defaultSpots(activity), slotExtraSpotsOf(activity), extraNow)
      return [spots === given.capacity ? given : { ...given, capacity: Math.max(spots, given.booked) }, extraNow, undefined]
    })()
    // A ride's slot also goes by the gen_ id of its time (rides moved onto it in this browser).
    const ids = slotIdsOf(activity, served)
    const change = ids.reduce((sum, id) => sum + (ledger.delta[id] ?? 0), 0)
    const departure = change ? { ...served, booked: Math.max(0, Math.min(served.capacity, served.booked + change)) } : served
    const extra = ids.flatMap((id) => entriesOn(ledger, id)).filter((entry, index, all) => all.findIndex((other) => other.id === entry.id) === index)
    return {
      extraSpots,
      group,
      ids,
      extra,
      departure,
      activity,
      guests,
      crew,
      resources,
      gross,
      paid,
      outstanding: Math.max(gross - paid, 0),
      media,
      fill: fillRate(departure.booked, departure.capacity),
    }
  }, [cachedId, loaded, ledger, overrides, bookingDefaults])

  const open = Boolean(departureId)

  const notify = (title: string, description?: string) => {
    toast.success(title, { description })
  }

  if (!detail) return null

  const { departure, activity, guests: seededGuests, crew, resources, gross, paid, outstanding, media, extraSpots, group, ids: slotIds } = detail
  const tenant = tenantById.get(departure.tenantId) ?? CURRENT_TENANT
  /** Private transfers and drivers by the hour: the slot counts vehicles out. */
  const byVehicle = activity.kind === 'transfer' && activity.transfer?.service !== 'shared'
  /** A ride on this slot: its pickup and flight ("Pickup 14:35 · AA 1234 lands 14:35"). */
  const rideLine = (details: TransferBookingDetails | undefined, reference: string) => {
    if (!details) return null
    const current = ledger.changes[reference]?.transfer ?? details
    const leg = current.legs.find((entry) => slotIds.includes(entry.departureId)) ?? current.legs[0]
    if (!leg) return null
    const flight = flightLine(leg, activity.transfer?.hub?.kind)
    return (
      <p className="truncate text-xs text-muted tabular-nums">
        Pickup {hhmm(leg.pickupAt)}
        {flight ? ` · ${flight}` : ''}
      </p>
    )
  }
  const slotDay = departure.startsAt.slice(0, 10)
  const slotTime = departure.startsAt.slice(11, 16)
  /** The change "Cancel" saves for this time slot; one id per day, start time and location. */
  const cancelChangeId = cancelChangeIdFor(slotDay, slotTime, departure.locationId)
  // Cancelled here before. A day closed on the Schedule step doesn't count: booked time slots
  // still run on a closed day, so they stay open to cancel and refund here.
  const override = overrides[activity.id]
  const cancelledBefore = (override?.scheduleChanges ?? []).some((change) => change.id === cancelChangeId && change.action === 'closed')
  // Added back since ("Add a time slot", the Schedule step): it runs again, so it can be cancelled again.
  let addedBack = false
  if (cancelledBefore && activity.kind !== 'package') {
    try {
      const ctx = { ...scheduleContextOf(bookingDefaults), ...(activity.locations.length > 1 && departure.locationId ? { locationId: departure.locationId } : {}) }
      addedBack = expandSchedules(applyScheduleOverride(activity, override), slotDay, slotDay, ctx).some((slot) => slot.time === slotTime)
    } catch {
      /* a broken saved edit: it stays cancelled */
    }
  }
  const cancelledHere = cancelledBefore && !addedBack
  const status = cancelledHere ? 'cancelled' : departure.status
  // Guests still on this time: not cancelled, not moved away (here or by the guest).
  const guests = seededGuests.filter(({ booking }) => {
    const change = ledger.changes[booking.reference]
    if (booking.status === 'cancelled' || booking.status === 'refunded' || change?.cancelled) return false
    // A ride is here while one of its legs is: a round trip's return sits on its own slot, and a changed ride on its new ones.
    const ride = change?.transfer ?? booking.transfer
    if (ride) return ride.legs.some((leg) => slotIds.includes(leg.departureId))
    return !change?.movedTo || change.movedTo.departureId === departure.id
  })
  const recipients: MessageRecipient[] = [
    ...guests.map(({ booking, customer }) => ({
      reference: booking.reference,
      bookingId: booking.id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      activityName: activity.name,
      startsAt: departure.startsAt,
      meetingPoint: activity.meetingPoint,
      party: ledger.changes[booking.reference]?.party ?? booking.partySize,
    })),
    ...detail.extra.map((entry) => {
      const [firstName, ...rest] = entry.name.split(' ')
      return { reference: entry.reference, firstName: firstName ?? entry.name, lastName: rest.join(' '), email: entry.email, phone: entry.phone ?? '', activityName: entry.packageName ?? activity.name, startsAt: departure.startsAt, meetingPoint: activity.meetingPoint, party: entry.party }
    }),
  ]
  /** The business calls it off: every booking is cancelled with a full refund and told. */
  const cancelEveryone = () => {
    for (const { booking } of guests) {
      changeBooking(
        tenantSlug,
        booking.reference,
        changeStartOf({ departureId: booking.departureId, startsAt: booking.departureAt, partySize: booking.partySize, transfer: booking.transfer }),
        { cancelled: true, refund: booking.amountPaid },
        { by: 'staff', what: `Cancelled: the whole time was called off, ${formatCurrency(booking.amountPaid, currency)} refunded` },
      )
    }
    for (const entry of detail.extra) {
      changeBooking(tenantSlug, entry.id, { fromDepartureId: entry.departureId, fromStartsAt: entry.startsAt, fromParty: entry.party, ...(entry.transfer ? { fromLegDepartureIds: entry.transfer.legs.slice(1).map((leg) => leg.departureId).filter(Boolean) } : {}) }, { cancelled: true, refund: entry.paidNow }, { by: 'staff', what: 'Cancelled: the whole time was called off' })
    }
    const template = templates.find((entry) => entry.key === 'cancelled')
    if (template) {
      sendToGuests(recipients, { tenantSlug, business: tenant.name, subject: template.subject, body: template.body, extra: { refund_line: 'We have refunded everything you paid; it shows on your card in 5 to 10 days.' } })
    }
    // Off the schedule too, so the storefront stops selling it (packages have no times of their own).
    if (activity.kind !== 'package') {
      const change: ScheduleChange = {
        id: cancelChangeId,
        dates: [slotDay],
        action: 'closed',
        times: [slotTime],
        reason: 'Cancelled',
        ...(departure.locationId && activity.locations.length > 1 ? { locationId: departure.locationId } : {}),
      }
      // Last in the list, so it wins over the time being added back after an earlier cancel.
      const saved = parseActivityOverrides(readActivityOverridesRaw())[activity.id]?.scheduleChanges ?? activity.scheduleChanges ?? []
      saveScheduleOverride(activity, { scheduleChanges: [...saved.filter((entry) => entry.id !== cancelChangeId), change] })
    }
  }
  const weather = departure.weather
  const WeatherIcon = weather ? WEATHER_META[weather.condition].icon : Sun
  const start = new Date(departure.startsAt)
  const end = new Date(departure.endsAt)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" size="xl" className="w-full">
          <SheetHeader className="gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge kind="departure" status={status} size="sm" />
              {/* A time slot added on the schedule has a long generated id; there is no short number to show. */}
              {departure.id.startsWith('gen_') ? null : (
                <Badge size="sm" variant="outline" className="font-mono">
                  {departure.id.replace('dep_', '#')}
                </Badge>
              )}
            </div>
            <SheetTitle className="text-[1.0625rem]">{activity.name}</SheetTitle>
            <SheetDescription>
              {formatDateLong(start)} · {formatTime(start)} – {formatTime(end)}
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="px-0 py-0">
            {/* Hero */}
            {media ? (
              <div className="relative h-40 w-full overflow-hidden sm:h-48">
                <Image
                  src={media.url}
                  alt={media.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, 48rem"
                  className="object-cover"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[image:linear-gradient(to_top,var(--surface-raised),color-mix(in_oklab,var(--surface-raised)_15%,transparent)_58%,transparent)]"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'size-2 rounded-full',
                          eventVar(activity.colorKey),
                          EVENT_SOLID,
                        )}
                      />
                      {activity.tagline}
                    </p>
                  </div>
                  <p className="tabular shrink-0 text-right font-display text-lg font-semibold text-foreground">
                    {formatCurrency(departure.priceOverride ?? activity.basePrice, currency)}
                    <span className="block text-xs font-normal text-subtle">
                      {departure.priceOverride ? 'override / guest' : 'from / guest'}
                    </span>
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-col gap-5 px-6 py-5">
              {/* Facts */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Fact
                  icon={Timer}
                  label="Duration"
                  value={`${formatDuration(activity.durationMinutes)} · ends ${formatTime(end)}`}
                />
                <Fact icon={MapPin} label="Meeting point" value={activity.meetingPoint} />
                <Fact
                  icon={Users}
                  label="Party mix"
                  value={`${guests.length} ${guests.length === 1 ? 'booking' : 'bookings'} · ${formatNumber(departure.booked)} ${byVehicle ? 'vehicles' : 'guests'}`}
                />
                <Fact
                  icon={Anchor}
                  label="Difficulty"
                  value={activity.minAge > 0 ? `${activity.difficulty} · min age ${activity.minAge}` : activity.difficulty}
                />
              </div>

              {/* Capacity */}
              <div className="rounded-xl border border-line bg-surface p-3.5">
                <CapacityBar
                  booked={departure.booked}
                  capacity={departure.capacity}
                  held={departure.held}
                  size="md"
                  unit={byVehicle ? 'vehicle' : 'spot'}
                />
                {group ? (
                  <p className="mt-2 text-xs text-subtle tabular">
                    One group of up to {group.size} {group.size === 1 ? 'guest' : 'guests'}
                    {group.most > group.size ? `, ${group.most - group.size} extra allowed` : ''}.
                  </p>
                ) : null}
                {extraSpots > 0 && departure.capacity > extraSpots ? (
                  <p className="mt-2 text-xs text-subtle tabular">
                    {departure.capacity - extraSpots} + {extraSpots} extra spots, sold once the {departure.capacity - extraSpots} are full.
                  </p>
                ) : null}
                {departure.held > 0 ? (
                  <p className="mt-2 text-xs text-subtle">
                    {departure.held} {departure.held === 1 ? 'spot is' : 'spots are'} held by guests
                    still checking out.
                  </p>
                ) : null}
              </div>

              {/* Money */}
              <div>
                <SectionTitle>Revenue</SectionTitle>
                <div className="grid grid-cols-3 gap-2">
                  <MoneyTile label="Booked" value={formatCurrency(gross, currency)} />
                  <MoneyTile
                    label="Collected"
                    value={formatCurrency(paid, currency)}
                    tone="success"
                  />
                  <MoneyTile
                    label="Outstanding"
                    value={formatCurrency(outstanding, currency)}
                    tone={outstanding > 0 ? 'warning' : 'default'}
                  />
                </div>
              </div>

              {/* Weather */}
              {weather ? (
                <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-3.5">
                  <RadialGauge
                    value={weather.goConfidence}
                    size={96}
                    thickness={8}
                    showTicks={false}
                    label="Go confidence"
                    ariaLabel={`Go confidence ${weather.goConfidence} percent`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <WeatherIcon aria-hidden="true" className="size-4 text-subtle" />
                      <p className="text-[0.8125rem] font-semibold text-foreground">
                        {WEATHER_META[weather.condition].label}
                      </p>
                    </div>
                    <dl className="tabular mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[0.75rem]">
                      <div className="flex justify-between gap-2">
                        <dt className="text-subtle">Temp</dt>
                        <dd className="font-medium text-foreground">{weather.tempC}°C</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-subtle">Wind</dt>
                        <dd className="font-medium text-foreground">{weather.windKts} kts</dd>
                      </div>
                      {typeof weather.swellM === 'number' ? (
                        <div className="flex justify-between gap-2">
                          <dt className="text-subtle">Swell</dt>
                          <dd className="font-medium text-foreground">{weather.swellM} m</dd>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-2">
                        <dt className="text-subtle">Status</dt>
                        <dd className="font-medium text-foreground">
                          {weather.goConfidence >= 80
                            ? 'Good to go'
                            : weather.goConfidence >= 55
                              ? 'Monitor'
                              : 'At risk'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              ) : null}

              {departure.notes ? (
                <div className="flex items-start gap-2.5 rounded-xl border border-line bg-warning-soft/50 p-3.5">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
                  <p className="text-[0.8125rem] leading-relaxed text-foreground">
                    {departure.notes}
                  </p>
                </div>
              ) : null}

              <Separator />

              {/* Crew + resources */}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <SectionTitle count={crew.length}>Team</SectionTitle>
                  <ul className="flex flex-col gap-2.5">
                    {crew.map((user) => (
                      <li key={user.id} className="flex items-center gap-2.5">
                        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.8125rem] font-medium text-foreground">
                            {user.name}
                          </p>
                          <p className="truncate text-xs text-subtle">{user.title}</p>
                        </div>
                      </li>
                    ))}
                    {crew.length === 0 ? (
                      <li className="text-[0.8125rem] text-subtle">No team assigned.</li>
                    ) : null}
                  </ul>
                </div>

                <div>
                  <SectionTitle count={resources.length}>Resources</SectionTitle>
                  <ul className="flex flex-col gap-2">
                    {resources.map((resource) => (
                      <li
                        key={resource.id}
                        className="flex items-center gap-2.5 rounded-lg border border-line-subtle px-2.5 py-2"
                      >
                        <Ship aria-hidden="true" className="size-3.5 shrink-0 text-subtle" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.8125rem] font-medium text-foreground">
                            {resource.name}
                          </p>
                          <p className="truncate text-xs text-subtle">
                            {resource.kind} · holds {resource.capacity}
                          </p>
                        </div>
                        {resource.status !== 'available' ? (
                          <Badge size="sm" variant="warning">
                            {resource.status}
                          </Badge>
                        ) : null}
                      </li>
                    ))}
                    {resources.length === 0 ? (
                      <li className="text-[0.8125rem] text-subtle">No resources assigned.</li>
                    ) : null}
                  </ul>
                </div>
              </div>

              <Separator />

              {/* Manifest */}
              <div>
                <SectionTitle count={guests.length}>Guest list</SectionTitle>
                <ul className="overflow-hidden rounded-xl border border-line">
                  {seededGuests.map(({ booking, customer }, index) => (
                    <li
                      key={booking.id}
                      className={cn(
                        'flex items-center gap-3 bg-surface px-3 py-2.5',
                        index > 0 && 'border-t border-line-subtle',
                      )}
                    >
                      <Avatar
                        name={`${customer.firstName} ${customer.lastName}`}
                        src={customer.avatarUrl}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-medium text-foreground">
                          {customer.firstName} {customer.lastName}
                        </p>
                        <p className="truncate font-mono text-xs text-subtle">
                          {booking.reference} · {booking.channel.replace(/_/g, ' ')}
                        </p>
                        {rideLine(booking.transfer, booking.reference)}
                        {ledger.changes[booking.reference]?.cancelled ? (
                          <p className="text-xs text-danger">Cancelled since</p>
                        ) : ledger.changes[booking.reference]?.movedTo && ledger.changes[booking.reference]?.movedTo?.departureId !== departure.id ? (
                          <p className="text-xs text-warning">Moved to {formatDateLong(new Date(ledger.changes[booking.reference]!.movedTo!.startsAt))} · {formatTime(ledger.changes[booking.reference]!.movedTo!.startsAt)}</p>
                        ) : null}
                      </div>
                      <span className="tabular shrink-0 text-[0.75rem] font-semibold text-muted">
                        {booking.partySize}{' '}
                        <span className="font-normal text-subtle">
                          {booking.partySize === 1 ? 'guest' : 'guests'}
                        </span>
                      </span>
                      <StatusBadge
                        kind="booking"
                        status={booking.status}
                        size="sm"
                        showIcon={false}
                        className="shrink-0"
                      />
                    </li>
                  ))}
                  {detail.extra.map((entry) => (
                    <li key={entry.id} className="flex items-center gap-3 border-t border-line-subtle bg-surface px-3 py-2.5 first:border-t-0">
                      <Avatar name={entry.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[0.8125rem] font-medium text-foreground">{entry.name}</p>
                        <p className="truncate text-xs text-subtle">
                          <span className="font-mono">{entry.reference}</span> · {entry.packageName ? `Package · ${entry.packageName}` : entry.source === 'dashboard' ? 'Booked by your team' : 'Booked online'}
                        </p>
                        {rideLine(entry.transfer, entry.reference)}
                      </div>
                      <span className="tabular shrink-0 text-[0.75rem] font-semibold text-muted">
                        {peopleOfEntry(entry)} <span className="font-normal text-subtle">{peopleOfEntry(entry) === 1 ? 'guest' : 'guests'}</span>
                      </span>
                      <StatusBadge kind="booking" status="confirmed" size="sm" showIcon={false} className="shrink-0" />
                    </li>
                  ))}
                  {guests.length === 0 && detail.extra.length === 0 ? (
                    <li className="bg-surface px-3 py-6 text-center text-[0.8125rem] text-subtle">
                      No bookings on this time slot yet.
                    </li>
                  ) : null}
                </ul>
              </div>

              <Separator />

              {/* Quick actions */}
              <div>
                <SectionTitle>Quick actions</SectionTitle>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Copy aria-hidden="true" />}
                    onClick={() => {
                      onOpenChange(false)
                      setDuplicate({ date: new Date(departure.startsAt), time: slotTime, activityId: activity.id, locationId: departure.locationId ?? null })
                    }}
                  >
                    Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<UserPlus aria-hidden="true" />}
                    onClick={() => notify('Assign team', 'Pick from available team members for this time slot.')}
                  >
                    Assign team
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<ClipboardList aria-hidden="true" />}
                    onClick={() =>
                      notify('Guest list ready', `${guests.length} bookings · ${departure.booked} guests`)
                    }
                  >
                    Guest list
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<CalendarPlus aria-hidden="true" />}
                    onClick={() => notify('Added to run sheet', formatDateLong(start))}
                  >
                    Run sheet
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Ban aria-hidden="true" />}
                    className="text-danger hover:border-danger hover:text-danger"
                    disabled={status === 'cancelled'}
                    onClick={() => setConfirmCancel(true)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </SheetBody>

          <SheetFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="sm:mr-auto"
            >
              Close
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<MessageSquare aria-hidden="true" />}
              onClick={() => setComposeOpen(true)}
            >
              Message guests
            </Button>
            {/* Times and spots for a day are changed on the activity's Schedule step; a package uses its activities' times. */}
            <Button size="sm" leftIcon={<Pencil aria-hidden="true" />} asChild>
              <Link href={activity.kind === 'package' ? `/dashboard/activities/${activity.id}` : `/dashboard/activities/${activity.id}/edit?step=schedule`}>
                {activity.kind === 'package' ? 'Open activity' : 'Edit schedule'}
              </Link>
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* -------------------------------------------------- cancel confirm -- */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Cancel this time slot?</DialogTitle>
            <DialogDescription>
              {recipients.length > 0
                ? `It comes off sale. ${recipients.length} ${recipients.length === 1 ? 'booking is' : 'bookings are'} cancelled, refunded in full and sent "Booking cancelled".`
                : 'It comes off sale. No one is booked, so there is nothing to refund.'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-xl border border-line bg-surface-sunken/60 p-3">
              <p className="text-[0.8125rem] font-medium text-foreground">{activity.name}</p>
              <p className="tabular text-[0.75rem] text-subtle">
                {formatDateLong(start)} · {formatTime(start)}
              </p>
              <p className="tabular mt-1.5 text-[0.75rem] text-subtle">
                To refund {formatCurrency(paid, currency)}
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>
              Keep time slot
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                cancelEveryone()
                setConfirmCancel(false)
                toast.error('Time slot cancelled', {
                  description:
                    recipients.length > 0
                      ? `${activity.name} · ${formatTime(start)}: ${recipients.length} ${recipients.length === 1 ? 'booking' : 'bookings'} refunded in full and told.`
                      : `${activity.name} · ${formatTime(start)} is off sale.`,
                })
              }}
            >
              Cancel time slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------------------------------- duplicate --- */}
      <NewDepartureDialog
        open={duplicate !== null}
        onOpenChange={(next) => {
          if (!next) setDuplicate(null)
        }}
        tenantId={departure.tenantId}
        currency={currency}
        initialDate={duplicate?.date ?? null}
        initialTime={duplicate?.time ?? null}
        initialActivityId={duplicate?.activityId ?? null}
        initialLocationId={duplicate?.locationId ?? null}
      />

      {/* ------------------------------------------------------- compose --- */}
      <MessageComposer
        open={composeOpen}
        onOpenChange={setComposeOpen}
        recipients={recipients}
        tenantId={tenant.id}
        tenantSlug={tenantSlug}
        business={tenant.name}
        title={`Message everyone on ${formatTime(start)} ${activity.name}`}
      />
    </>
  )
}
