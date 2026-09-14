'use client'

/**
 * DepartureDetailSheet — everything about one departure, in the order an
 * operator asks for it: is it running, who is on it, is it paid, who is
 * crewing it, and what do I do about it.
 */

import * as React from 'react'
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
import type { CurrencyCode, WeatherSnapshot } from '@/types'
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
        <p className="text-[0.6875rem] font-medium tracking-wide text-faint uppercase">{label}</p>
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
      <p className="text-[0.6875rem] font-medium tracking-wide text-faint uppercase">{label}</p>
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
  /** Opens the scheduling dialog pre-filled from this departure. */
  onDuplicate?: (departureId: string) => void
}

export function DepartureDetailSheet({
  departureId,
  onOpenChange,
  currency,
  onDuplicate,
}: DepartureDetailSheetProps) {
  // Hold the last id so the closing animation still has something to render.
  const [cachedId, setCachedId] = React.useState<string | null>(departureId)
  const [confirmCancel, setConfirmCancel] = React.useState(false)
  const [composeOpen, setComposeOpen] = React.useState(false)
  const [message, setMessage] = React.useState('')

  React.useEffect(() => {
    if (departureId) setCachedId(departureId)
  }, [departureId])

  // Loaded through a Server Action so the bookings/customers indexes stay on
  // the server — this sheet never imports the dataset module itself.
  const [loaded, setLoaded] = React.useState<DepartureDetail | null>(null)
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
    const { departure, activity, guests, crew, resources, gross, paid } = loaded
    const media = activity.media.find((item) => item.isPrimary) ?? activity.media[0]
    return {
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
  }, [cachedId, loaded])

  const open = Boolean(departureId)

  const notify = (title: string, description?: string) => {
    toast.success(title, { description })
  }

  if (!detail) return null

  const { departure, activity, guests, crew, resources, gross, paid, outstanding, media } = detail
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
              <StatusBadge kind="departure" status={departure.status} size="sm" />
              <Badge size="sm" variant="outline" className="font-mono">
                {departure.id.replace('dep_', '#')}
              </Badge>
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
                    <p className="flex items-center gap-1.5 text-[0.6875rem] font-medium text-muted">
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
                    <span className="block text-[0.625rem] font-normal text-subtle">
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
                  value={`${guests.length} ${guests.length === 1 ? 'booking' : 'bookings'} · ${formatNumber(departure.booked)} guests`}
                />
                <Fact
                  icon={Anchor}
                  label="Difficulty"
                  value={`${activity.difficulty} · min age ${activity.minAge}`}
                />
              </div>

              {/* Capacity */}
              <div className="rounded-xl border border-line bg-surface p-3.5">
                <CapacityBar
                  booked={departure.booked}
                  capacity={departure.capacity}
                  held={departure.held}
                  size="md"
                />
                {departure.held > 0 ? (
                  <p className="mt-2 text-[0.6875rem] text-subtle">
                    {departure.held} {departure.held === 1 ? 'seat is' : 'seats are'} held by carts
                    in progress.
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
                            ? 'Good to run'
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
                  <SectionTitle count={crew.length}>Crew</SectionTitle>
                  <ul className="flex flex-col gap-2.5">
                    {crew.map((user) => (
                      <li key={user.id} className="flex items-center gap-2.5">
                        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.8125rem] font-medium text-foreground">
                            {user.name}
                          </p>
                          <p className="truncate text-[0.6875rem] text-subtle">{user.title}</p>
                        </div>
                      </li>
                    ))}
                    {crew.length === 0 ? (
                      <li className="text-[0.8125rem] text-subtle">No crew assigned.</li>
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
                          <p className="truncate text-[0.6875rem] text-subtle">
                            {resource.kind} · seats {resource.capacity}
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
                <SectionTitle count={guests.length}>Guest manifest</SectionTitle>
                <ul className="overflow-hidden rounded-xl border border-line">
                  {guests.map(({ booking, customer }, index) => (
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
                        <p className="truncate font-mono text-[0.6875rem] text-subtle">
                          {booking.reference} · {booking.channel.replace(/_/g, ' ')}
                        </p>
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
                  {guests.length === 0 ? (
                    <li className="bg-surface px-3 py-6 text-center text-[0.8125rem] text-subtle">
                      No bookings on this departure yet.
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
                    leftIcon={<Pencil aria-hidden="true" />}
                    onClick={() => notify('Editor opened', `${activity.name} · ${formatTime(start)}`)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Copy aria-hidden="true" />}
                    onClick={() => {
                      onDuplicate?.(departure.id)
                      notify('Duplicated', 'Adjust the date and times, then schedule.')
                    }}
                  >
                    Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<UserPlus aria-hidden="true" />}
                    onClick={() => notify('Crew assignment', 'Pick from available crew for this slot.')}
                  >
                    Assign crew
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<ClipboardList aria-hidden="true" />}
                    onClick={() =>
                      notify('Manifest ready', `${guests.length} bookings · ${departure.booked} guests`)
                    }
                  >
                    Manifest
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
            <Button
              size="sm"
              leftIcon={<Pencil aria-hidden="true" />}
              onClick={() => notify('Editor opened', `${activity.name} · ${formatTime(start)}`)}
            >
              Edit departure
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* -------------------------------------------------- cancel confirm -- */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Cancel this departure?</DialogTitle>
            <DialogDescription>
              {guests.length > 0
                ? `${guests.length} bookings covering ${departure.booked} guests will be notified and refunded under the ${activity.cancellationPolicy.freeCancellationHours}-hour policy.`
                : 'No guests are booked, so nothing will be refunded.'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-xl border border-line bg-surface-sunken/60 p-3">
              <p className="text-[0.8125rem] font-medium text-foreground">{activity.name}</p>
              <p className="tabular text-[0.75rem] text-subtle">
                {formatDateLong(start)} · {formatTime(start)}
              </p>
              <p className="tabular mt-1.5 text-[0.75rem] text-subtle">
                Refund exposure {formatCurrency(paid, currency)}
              </p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmCancel(false)}>
              Keep departure
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setConfirmCancel(false)
                toast.error('Departure cancelled', {
                  description: `${activity.name} · ${formatTime(start)} — guests notified.`,
                })
              }}
            >
              Cancel departure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------- compose --- */}
      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Message guests</DialogTitle>
            <DialogDescription>
              Goes to {guests.length} {guests.length === 1 ? 'booking' : 'bookings'} on{' '}
              {formatTime(start)} {activity.name}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              placeholder="Conditions are looking excellent for tomorrow — please arrive 15 minutes early for the safety brief."
              aria-label="Message to guests"
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setComposeOpen(false)}>
              Discard
            </Button>
            <Button
              size="sm"
              disabled={message.trim().length === 0}
              onClick={() => {
                setComposeOpen(false)
                setMessage('')
                toast.success('Message queued', {
                  description: `${guests.length} ${guests.length === 1 ? 'guest' : 'guests'} will receive it within a minute.`,
                })
              }}
            >
              Send to {guests.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
