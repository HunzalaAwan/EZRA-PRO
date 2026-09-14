'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Archive,
  ArrowLeft,
  ArrowUpRight,
  Ban,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudLightning,
  CloudRain,
  Copy,
  DoorOpen,
  ExternalLink,
  Gauge,
  Images,
  Info,
  Link2,
  MapPin,
  MoreHorizontal,
  PencilLine,
  Repeat,
  ShieldCheck,
  Ship,
  Star,
  Sun,
  Timer,
  TriangleAlert,
  Truck,
  UserRound,
  Users,
  Utensils,
  Wind,
  Wrench,
} from 'lucide-react'

import type { Resource, ResourceKind, WeatherSnapshot } from '@/types'
import {
  cn,
  formatCurrency,
  formatDuration,
  formatNumber,
  formatRelative,
  formatTime,
  titleCase,
} from '@/lib/utils'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Segmented } from '@/components/ui/segmented'
import { CapacityBar } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarGroup } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { StatCard, StatGrid } from '@/components/ui/stat'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/components/ui/toaster'
import { RevenueAreaChart, type RevenueMetric } from '@/components/charts/revenue-area-chart'
import { OccupancyHeatmap } from '@/components/charts/occupancy-heatmap'
import { Reveal } from '@/components/motion/reveal'
import {
  ACTIVITY_ACCENT,
  DIFFICULTY_LABEL,
  DifficultyMeter,
  MEDIA_SCRIM,
  primaryMedia,
  storefrontHref,
} from './activity-card'
import type { ActivityDetailData } from './activity-data'

/* ==========================================================================
   SMALL PARTS
   ========================================================================== */

const WEATHER_ICON: Record<WeatherSnapshot['condition'], typeof Sun> = {
  clear: Sun,
  cloudy: Cloud,
  rain: CloudRain,
  storm: CloudLightning,
  wind: Wind,
}

const RESOURCE_ICON: Record<ResourceKind, typeof Ship> = {
  vessel: Ship,
  vehicle: Truck,
  equipment: Wrench,
  table: Utensils,
  room: DoorOpen,
  guide: UserRound,
}

function RailStat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'good' | 'warn'
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="flex items-center gap-1.5 text-[0.8125rem] text-muted">
        {label}
        {hint ? (
          <SimpleTooltip label={hint}>
            <span tabIndex={0} className="inline-flex rounded-full text-faint hover:text-muted">
              <Info className="size-3.5" aria-hidden="true" />
            </span>
          </SimpleTooltip>
        ) : null}
      </span>
      <span
        className={cn(
          'font-display text-sm font-semibold tabular',
          tone === 'good' && 'text-success',
          tone === 'warn' && 'text-warning',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function ListRow({
  children,
  icon: Icon,
  tone = 'neutral',
}: {
  children: React.ReactNode
  icon: typeof Check
  tone?: 'neutral' | 'positive' | 'negative' | 'warning'
}) {
  return (
    <li className="flex items-start gap-2.5 text-sm leading-relaxed text-muted">
      <span
        className={cn(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
          tone === 'positive' && 'bg-success-soft text-success',
          tone === 'negative' && 'bg-surface-sunken text-faint',
          tone === 'warning' && 'bg-warning-soft text-warning',
          tone === 'neutral' && 'bg-primary-soft text-primary',
        )}
      >
        <Icon className="size-3" strokeWidth={2.75} aria-hidden="true" />
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  )
}

function SectionCard({
  title,
  description,
  action,
  children,
  bleed = false,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  /** Edge-to-edge body — for tables and media that should touch the card edges. */
  bleed?: boolean
  className?: string
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent bleed={bleed} className={bleed ? 'pb-0 sm:pb-0' : undefined}>
        {children}
      </CardContent>
    </Card>
  )
}

function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((step) => (
        <Star
          key={step}
          className={cn(
            'size-3.5',
            step <= Math.round(value) ? 'fill-sunset-400 text-sunset-400' : 'text-line-strong',
          )}
        />
      ))}
    </span>
  )
}

/* ==========================================================================
   MEDIA GALLERY + LIGHTBOX
   ========================================================================== */

function MediaGallery({ detail }: { detail: ActivityDetailData }) {
  const media = detail.activity.media
  const [openAt, setOpenAt] = React.useState<number | null>(null)
  const active = openAt === null ? null : media[openAt]

  const step = (delta: number) => {
    setOpenAt((current) =>
      current === null ? null : (current + delta + media.length) % media.length,
    )
  }

  if (media.length === 0) {
    return (
      <EmptyState
        surface="dashed"
        size="sm"
        icon={Images}
        title="No media yet"
        description="Add photography before this activity goes live — listings with five or more images convert roughly a third better."
      />
    )
  }

  return (
    <>
      <ul className="grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3">
        {media.map((item, index) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setOpenAt(index)}
              className={cn(
                'group/media relative block aspect-[4/3] w-full overflow-hidden rounded-xl',
                'border border-line-subtle bg-surface-sunken',
                'transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-expo)]',
                'hover:-translate-y-0.5 hover:shadow-lg',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              )}
            >
              <Image
                src={item.url}
                alt={item.alt}
                fill
                sizes="(min-width: 768px) 18rem, 45vw"
                className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover/media:scale-105 motion-reduce:transform-none"
              />
              {item.isPrimary ? (
                <span className="absolute top-2 left-2 rounded-full bg-ink-950/70 px-2 py-0.5 text-[0.625rem] font-semibold tracking-wide text-white uppercase backdrop-blur-sm">
                  Primary
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <Dialog open={openAt !== null} onOpenChange={(open) => !open && setOpenAt(null)}>
        <DialogContent size="xl" className="p-0">
          {active ? (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>{detail.activity.name} media</DialogTitle>
                <DialogDescription>{active.alt}</DialogDescription>
              </DialogHeader>
              <div className="relative aspect-[16/10] w-full bg-surface-sunken">
                <Image
                  src={active.url}
                  alt={active.alt}
                  fill
                  sizes="(min-width: 1024px) 56rem, 100vw"
                  className="object-cover"
                />
                {media.length > 1 ? (
                  <>
                    <IconButton
                      aria-label="Previous image"
                      variant="glass"
                      shape="circle"
                      className="absolute top-1/2 left-3 -translate-y-1/2"
                      onClick={() => step(-1)}
                    >
                      <ChevronLeft />
                    </IconButton>
                    <IconButton
                      aria-label="Next image"
                      variant="glass"
                      shape="circle"
                      className="absolute top-1/2 right-3 -translate-y-1/2"
                      onClick={() => step(1)}
                    >
                      <ChevronRight />
                    </IconButton>
                  </>
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-4 px-5 py-4">
                <p className="min-w-0 text-sm text-muted">{active.alt}</p>
                <span className="shrink-0 text-xs text-faint tabular">
                  {(openAt ?? 0) + 1} / {media.length}
                </span>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

/* ==========================================================================
   TABS
   ========================================================================== */

function OverviewTab({ detail }: { detail: ActivityDetailData }) {
  const { activity } = detail
  const policy = activity.cancellationPolicy

  return (
    <div className="flex flex-col gap-5">
      <SectionCard title="About this experience">
        <p className="text-sm leading-relaxed text-muted">{activity.description}</p>

        {activity.highlights.length > 0 ? (
          <>
            <Separator className="my-5" />
            <h4 className="mb-3 text-xs font-semibold tracking-[0.08em] text-subtle uppercase">
              Highlights
            </h4>
            <ul className="grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2">
              {activity.highlights.map((item) => (
                <ListRow key={item} icon={Check} tone="neutral">
                  {item}
                </ListRow>
              ))}
            </ul>
          </>
        ) : null}
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="What's included">
          <ul className="flex list-none flex-col gap-2.5 p-0">
            {activity.included.map((item) => (
              <ListRow key={item} icon={Check} tone="positive">
                {item}
              </ListRow>
            ))}
          </ul>
          {activity.excluded.length > 0 ? (
            <>
              <Separator className="my-5" />
              <h4 className="mb-3 text-xs font-semibold tracking-[0.08em] text-subtle uppercase">
                Not included
              </h4>
              <ul className="flex list-none flex-col gap-2.5 p-0">
                {activity.excluded.map((item) => (
                  <ListRow key={item} icon={Ban} tone="negative">
                    {item}
                  </ListRow>
                ))}
              </ul>
            </>
          ) : null}
        </SectionCard>

        <SectionCard
          title="Requirements"
          description="Shown at checkout and on the confirmation email."
        >
          <ul className="flex list-none flex-col gap-2.5 p-0">
            {activity.requirements.map((item) => (
              <ListRow key={item} icon={TriangleAlert} tone="warning">
                {item}
              </ListRow>
            ))}
          </ul>

          <Separator className="my-5" />

          <div className="flex items-start gap-3 rounded-xl bg-surface-sunken p-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <ShieldCheck className="size-4.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.8125rem] font-semibold">Cancellation policy</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">{policy.summary}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge size="sm" variant="neutral">
                  Free up to {policy.freeCancellationHours}h before
                </Badge>
                <Badge size="sm" variant={policy.lateRefundPercent > 0 ? 'info' : 'outline'}>
                  {policy.lateRefundPercent > 0
                    ? `${policy.lateRefundPercent}% refunded inside the window`
                    : 'No refund inside the window'}
                </Badge>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Meeting point"
        description="Guests get these directions the moment they book."
      >
        <div className="flex flex-col gap-4 sm:flex-row">
          <div
            aria-hidden="true"
            className="relative h-32 w-full shrink-0 overflow-hidden rounded-xl border border-line-subtle bg-surface-sunken sm:h-auto sm:w-44"
          >
            <div className="absolute inset-0 bg-grid opacity-60" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,color-mix(in_oklab,var(--primary)_22%,transparent),transparent_70%)]" />
            <span className="absolute top-1/2 left-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-on-primary shadow-glow-lagoon">
              <MapPin className="size-4.5" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-muted">{activity.meetingPoint}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge size="sm" variant="neutral">
                <Timer className="size-3" aria-hidden="true" />
                {formatDuration(activity.durationMinutes)}
              </Badge>
              <Badge size="sm" variant="neutral">
                <Users className="size-3" aria-hidden="true" />
                {activity.minParticipants}–{activity.maxCapacity} guests
              </Badge>
              <Badge size="sm" variant="neutral">
                Ages {activity.minAge}+
              </Badge>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Media"
        description={`${activity.media.length} assets · the primary image leads every storefront tile.`}
      >
        <MediaGallery detail={detail} />
      </SectionCard>
    </div>
  )
}

function PricingTab({ detail }: { detail: ActivityDetailData }) {
  const { activity } = detail
  const currency = activity.currency

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Pricing model', value: titleCase(activity.pricingModel) },
          { label: 'Lead price', value: formatCurrency(detail.summary.fromPrice, currency) },
          {
            label: 'Average booking',
            value: formatCurrency(
              detail.lifetime.bookings === 0
                ? 0
                : Math.round(detail.lifetime.revenue / detail.lifetime.bookings),
              currency,
            ),
          },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs text-subtle">{item.label}</p>
            <p className="mt-1 font-display text-lg font-semibold">{item.value}</p>
          </div>
        ))}
      </div>

      <SectionCard
        title="Price tiers"
        description="What a guest can pick in the booking widget, in order."
        bleed
      >
        <div className="overflow-hidden rounded-b-2xl">
          <Table density="comfortable">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Tier</TableHead>
                <TableHead align="right" numeric>
                  Quantity
                </TableHead>
                <TableHead align="center">Capacity</TableHead>
                <TableHead align="right" numeric>
                  Price
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activity.priceTiers.map((tier) => (
                <TableRow key={tier.id}>
                  <TableCell>
                    <span className="block text-sm font-semibold">{tier.label}</span>
                    {tier.description ? (
                      <span className="block text-xs text-subtle">{tier.description}</span>
                    ) : null}
                  </TableCell>
                  <TableCell align="right" numeric>
                    <span className="text-muted">
                      {tier.minQuantity}–{tier.maxQuantity}
                    </span>
                  </TableCell>
                  <TableCell align="center">
                    {tier.countsTowardCapacity ? (
                      <Badge size="sm" variant="neutral">
                        Counts
                      </Badge>
                    ) : (
                      <Badge size="sm" variant="outline">
                        Free seat
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell align="right" numeric>
                    {typeof tier.compareAtPrice === 'number' ? (
                      <span className="mr-2 text-xs text-faint line-through">
                        {formatCurrency(tier.compareAtPrice, currency)}
                      </span>
                    ) : null}
                    <span className="font-semibold">{formatCurrency(tier.price, currency)}</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <SectionCard
        title="Add-ons"
        description="Optional extras offered after the guest picks a time."
      >
        {activity.addOns.length === 0 ? (
          <EmptyState
            surface="dashed"
            size="sm"
            title="No add-ons yet"
            description="Operators who attach one relevant add-on lift average order value by roughly 12%."
          />
        ) : (
          <ul className="grid list-none gap-3 p-0 sm:grid-cols-2">
            {activity.addOns.map((addOn) => (
              <li
                key={addOn.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-line bg-surface-sunken/60 p-3.5"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {addOn.label}
                    {addOn.required ? (
                      <Badge size="sm" variant="warning">
                        Required
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted">{addOn.description}</p>
                  <p className="mt-1.5 text-[0.6875rem] text-faint">
                    {addOn.maxPerBooking === null
                      ? 'No limit per booking'
                      : `Up to ${addOn.maxPerBooking} per booking`}
                  </p>
                </div>
                <span className="shrink-0 font-display text-sm font-semibold tabular">
                  {formatCurrency(addOn.price, currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  )
}

function ScheduleTab({ detail, now }: { detail: ActivityDetailData; now: Date }) {
  return (
    <SectionCard
      title="Upcoming departures"
      description={`${detail.lifetime.upcomingDepartures} scheduled on the calendar.`}
      action={
        <Button variant="secondary" size="sm" asChild rightIcon={<ArrowUpRight />}>
          <Link href="/dashboard/calendar">Open calendar</Link>
        </Button>
      }
    >
      {detail.upcoming.length === 0 ? (
        <EmptyState
          surface="dashed"
          size="sm"
          icon={CalendarClock}
          title="Nothing scheduled"
          description="This activity has no departures ahead. Add a schedule rule to start selling again."
        />
      ) : (
        <ul className="flex list-none flex-col gap-2.5 p-0">
          {detail.upcoming.map((departure) => {
            const WeatherIcon = departure.weather
              ? WEATHER_ICON[departure.weather.condition]
              : null
            return (
              <li
                key={departure.id}
                className={cn(
                  'group/dep flex flex-col gap-3 rounded-xl border border-line bg-surface p-3.5',
                  'transition-[border-color,box-shadow] duration-300 hover:border-primary/40 hover:shadow-sm',
                  'sm:flex-row sm:items-center',
                )}
              >
                <div className="flex shrink-0 items-center gap-3 sm:w-56">
                  <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface-sunken text-center">
                    <span className="text-[0.625rem] font-semibold tracking-wide text-subtle uppercase">
                      {new Intl.DateTimeFormat('en-US', { month: 'short' }).format(
                        new Date(departure.startsAt),
                      )}
                    </span>
                    <span className="-mt-0.5 font-display text-base leading-none font-semibold">
                      {new Date(departure.startsAt).getDate()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {formatTime(departure.startsAt)}
                      <span className="text-faint"> – {formatTime(departure.endsAt)}</span>
                    </p>
                    <p className="text-xs text-subtle">
                      {formatRelative(departure.startsAt, now)}
                    </p>
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <CapacityBar
                    booked={departure.booked}
                    capacity={departure.capacity}
                    held={departure.held}
                    size="sm"
                  />
                </div>

                <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                  {departure.weather && WeatherIcon ? (
                    <SimpleTooltip
                      label={`${titleCase(departure.weather.condition)} · ${departure.weather.tempC}°C · ${departure.weather.windKts} kts · ${departure.weather.goConfidence}% go confidence`}
                    >
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                          departure.weather.goConfidence >= 75
                            ? 'bg-success-soft text-success'
                            : departure.weather.goConfidence >= 50
                              ? 'bg-warning-soft text-warning'
                              : 'bg-danger-soft text-danger',
                        )}
                      >
                        <WeatherIcon className="size-3.5" aria-hidden="true" />
                        {departure.weather.goConfidence}%
                      </span>
                    </SimpleTooltip>
                  ) : null}

                  {departure.staff.length > 0 ? (
                    <AvatarGroup
                      size="xs"
                      max={3}
                      label="Assigned crew"
                      avatars={departure.staff.map((member) => ({
                        id: member.id,
                        name: member.name,
                        src: member.avatarUrl,
                      }))}
                    />
                  ) : null}

                  <StatusBadge kind="departure" status={departure.status} size="sm" />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}

function PerformanceTab({ detail }: { detail: ActivityDetailData }) {
  const [metric, setMetric] = React.useState<RevenueMetric>('revenue')
  const [range, setRange] = React.useState<'30d' | '90d'>('90d')

  const points = React.useMemo(
    () => (range === '30d' ? detail.timeseries.slice(-30) : detail.timeseries),
    [detail.timeseries, range],
  )

  const topChannel = detail.channels[0]

  return (
    <div className="flex flex-col gap-5">
      <StatGrid columns={3}>
        {detail.kpis.map((kpi) => (
          <StatCard key={kpi.key} metric={kpi} size="sm" compact={kpi.format === 'currency'} />
        ))}
      </StatGrid>

      <RevenueAreaChart
        points={points}
        metric={metric}
        currency={detail.activity.currency}
        height={280}
        title={`${detail.activity.name} performance`}
        description={`Attributed to the departure date · last ${range === '30d' ? '30' : '90'} days`}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              label="Metric"
              value={metric}
              onValueChange={(value) => setMetric(value as RevenueMetric)}
              options={[
                { value: 'revenue', label: 'Revenue' },
                { value: 'bookings', label: 'Bookings' },
                { value: 'guests', label: 'Guests' },
              ]}
            />
            <Segmented
              size="sm"
              label="Range"
              value={range}
              onValueChange={(value) => setRange(value as '30d' | '90d')}
              options={[
                { value: '30d', label: '30d' },
                { value: '90d', label: '90d' },
              ]}
            />
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <OccupancyHeatmap
          cells={detail.heatmap}
          currency={detail.activity.currency}
          height={248}
          title="When this activity actually fills"
          description="Seats sold against seats offered, trailing 90 days."
        />

        <SectionCard
          title="Booking channels"
          description={
            topChannel
              ? `${topChannel.label} leads with ${topChannel.share.toFixed(0)}% of bookings.`
              : 'No bookings recorded yet.'
          }
        >
          <ul className="flex list-none flex-col gap-3 p-0">
            {detail.channels.slice(0, 6).map((channel, index) => (
              <li key={channel.channel} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate font-medium">{channel.label}</span>
                  <span className="shrink-0 text-xs text-subtle tabular">
                    {formatNumber(channel.bookings)} · {channel.share.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                  <div
                    className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-expo)]"
                    style={{
                      width: `${Math.max(2, channel.share)}%`,
                      backgroundColor: `var(--chart-${(index % 8) + 1})`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  )
}

function ReviewsTab({ detail, now }: { detail: ActivityDetailData; now: Date }) {
  const { activity } = detail

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <Card variant="gradient" className="h-fit">
        <CardContent className="pt-5">
          <p className="font-display text-4xl leading-none font-semibold">
            {activity.rating.toFixed(2)}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Stars value={activity.rating} />
            <span className="text-xs text-muted">
              {formatNumber(activity.reviewCount)} reviews
            </span>
          </div>

          <Separator className="my-4" />

          <ul className="flex list-none flex-col gap-2 p-0">
            {detail.ratingDistribution.map((row) => (
              <li key={row.stars} className="flex items-center gap-2.5 text-xs">
                <span className="w-8 shrink-0 text-subtle tabular">{row.stars}★</span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className="block h-full rounded-full bg-sunset-400 transition-[width] duration-700 ease-[var(--ease-out-expo)]"
                    style={{ width: `${Math.max(row.percent, row.count > 0 ? 2 : 0)}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right text-faint tabular">
                  {row.percent.toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-xs leading-relaxed text-muted">
            {formatNumber(detail.ratedCount)} of {formatNumber(detail.lifetime.bookings)} completed
            bookings left a rating.
          </p>
        </CardContent>
      </Card>

      <div className="min-w-0">
        {detail.reviews.length === 0 ? (
          <EmptyState
            surface="dashed"
            icon={Star}
            title="No written reviews yet"
            description="Ratings arrive after a departure completes. Written feedback follows the automated post-trip email."
          />
        ) : (
          <ul className="flex list-none flex-col gap-3 p-0">
            {detail.reviews.map((review, index) => (
              <Reveal as="li" key={review.id} delay={Math.min(index, 6) * 0.04} distance={10}>
                <Card className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={review.guestName} src={review.guestAvatar} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                        <p className="text-sm font-semibold">{review.guestName}</p>
                        <span className="text-xs text-faint">
                          {formatRelative(review.departureAt, now)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <Stars value={review.rating} />
                        <span className="text-xs text-subtle">
                          {review.partySize} {review.partySize === 1 ? 'guest' : 'guests'} ·{' '}
                          {review.reference}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-muted">{review.text}</p>
                    </div>
                  </div>
                </Card>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/* ==========================================================================
   RIGHT RAIL
   ========================================================================== */

function ResourceRow({ resource }: { resource: Resource }) {
  const Icon = RESOURCE_ICON[resource.kind]
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.8125rem] font-medium">{resource.name}</p>
        <p className="truncate text-xs text-subtle">
          {titleCase(resource.kind)} · {resource.capacity} capacity
        </p>
      </div>
      <Badge
        size="sm"
        variant={
          resource.status === 'available'
            ? 'success'
            : resource.status === 'maintenance'
              ? 'warning'
              : 'outline'
        }
      >
        {titleCase(resource.status)}
      </Badge>
    </li>
  )
}

function DetailRail({ detail, tenantSlug }: { detail: ActivityDetailData; tenantSlug: string }) {
  const { activity, lifetime } = detail
  const publicUrl = `${tenantSlug}.ezrapro.com/${activity.slug}`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`https://${publicUrl}`)
      toast.success('Booking link copied')
    } catch {
      toast.error('Could not copy the link', { description: publicUrl })
    }
  }

  return (
    <div className="flex flex-col gap-5 lg:sticky lg:top-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Lifetime performance</CardTitle>
          <CardDescription>Every departure this activity has ever run.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y divide-line-subtle">
            <RailStat label="Total bookings" value={formatNumber(lifetime.bookings)} />
            <RailStat
              label="Revenue"
              value={formatCurrency(lifetime.revenue, activity.currency, { compact: true })}
            />
            <RailStat label="Guests carried" value={formatNumber(lifetime.guests)} />
            <RailStat label="Avg party size" value={lifetime.avgPartySize.toFixed(1)} />
            <RailStat
              label="Seat occupancy"
              value={`${lifetime.occupancy.toFixed(1)}%`}
              tone={lifetime.occupancy >= 75 ? 'good' : undefined}
            />
            <RailStat
              label="Est. conversion"
              value={`${lifetime.conversion.toFixed(1)}%`}
              hint="Storefront view-to-booking rate, indexed to how this activity fills relative to the workspace average."
            />
            <RailStat
              label="Cancellation rate"
              value={`${lifetime.cancellationRate.toFixed(1)}%`}
              tone={lifetime.cancellationRate > 10 ? 'warn' : undefined}
            />
            <RailStat label="Repeat guests" value={`${lifetime.repeatRate.toFixed(1)}%`} />
            <RailStat label="Departures run" value={formatNumber(lifetime.departures)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Assigned resources</CardTitle>
          <CardDescription>Consumed by every departure of this activity.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {detail.resources.length === 0 ? (
            <p className="text-sm text-subtle">No resources are required.</p>
          ) : (
            <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
              {detail.resources.map((resource) => (
                <ResourceRow key={resource.id} resource={resource} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {detail.team.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Crew on this activity</CardTitle>
            <CardDescription>Ranked by departures assigned.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="flex list-none flex-col gap-3 p-0">
              {detail.team.map((member) => (
                <li key={member.id} className="flex items-center gap-3">
                  <Avatar name={member.name} src={member.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.8125rem] font-medium">{member.name}</p>
                    <p className="truncate text-xs text-subtle">{member.title}</p>
                  </div>
                  <span className="shrink-0 text-xs text-faint tabular">
                    {formatNumber(member.departures)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card variant="outline">
        <CardContent className="pt-5">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Link2 className="size-4 text-primary" aria-hidden="true" />
            Direct booking link
          </p>
          <p className="mt-2 truncate rounded-lg bg-surface-sunken px-2.5 py-2 font-mono text-xs text-muted">
            {publicUrl}
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" fullWidth leftIcon={<Copy />} onClick={copyLink}>
              Copy link
            </Button>
            <Button variant="ghost" size="sm" asChild rightIcon={<ExternalLink />}>
              <Link href={storefrontHref(tenantSlug, activity.slug)} target="_blank" rel="noopener">
                Open
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ==========================================================================
   DETAIL
   ========================================================================== */

export interface ActivityDetailProps {
  detail: ActivityDetailData
  tenantSlug: string
  /** The frozen demo clock, serialised from the server. */
  nowIso: string
}

export function ActivityDetail({ detail, tenantSlug, nowIso }: ActivityDetailProps) {
  const { activity } = detail
  const now = React.useMemo(() => new Date(nowIso), [nowIso])
  const hero = primaryMedia(activity)
  const accent = ACTIVITY_ACCENT[activity.colorKey]
  const [tab, setTab] = React.useState('overview')

  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'pricing', label: 'Pricing', count: activity.priceTiers.length + activity.addOns.length },
    { value: 'schedule', label: 'Schedule', count: detail.lifetime.upcomingDepartures },
    { value: 'performance', label: 'Performance' },
    { value: 'reviews', label: 'Reviews', count: detail.ratedCount },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- hero ---------- */}
      <header className="relative isolate overflow-hidden rounded-3xl border border-line bg-surface-sunken">
        <div className="relative h-56 w-full sm:h-72">
          {hero ? (
            <Image
              src={hero.url}
              alt={hero.alt}
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            <div className={cn('absolute inset-0', accent.soft)} />
          )}
          <div aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: MEDIA_SCRIM }} />

          <div className="absolute top-4 left-4">
            <Button
              variant="glass"
              size="sm"
              asChild
              leftIcon={<ArrowLeft />}
              className="text-white"
            >
              <Link href="/dashboard/activities">All activities</Link>
            </Button>
          </div>

          <div className="absolute top-4 right-4 flex items-center gap-2">
            <Button
              variant="glass"
              size="sm"
              asChild
              leftIcon={<ExternalLink />}
              className="hidden text-white sm:inline-flex"
            >
              <Link href={storefrontHref(tenantSlug, activity.slug)} target="_blank" rel="noopener">
                Preview storefront
              </Link>
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<PencilLine />}
              onClick={() =>
                toast('Editing ' + activity.name, {
                  description: 'Opening the activity editor with these details pre-filled.',
                })
              }
            >
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton aria-label="More actions" size="sm" variant="glass" className="text-white">
                  <MoreHorizontal />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem
                  onSelect={() =>
                    toast.success(`Duplicated “${activity.name}”`, {
                      description: 'Saved as a draft so you can edit it safely.',
                    })
                  }
                >
                  <Copy aria-hidden="true" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => toast.success('Schedule rule opened')}
                >
                  <CalendarClock aria-hidden="true" />
                  Manage schedule
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  tone="danger"
                  onSelect={() =>
                    toast(`Archived “${activity.name}”`, {
                      description: 'Hidden from the storefront. Existing bookings are untouched.',
                      action: { label: 'Undo', onClick: () => toast.success('Restored') },
                    })
                  }
                >
                  <Archive aria-hidden="true" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                kind="activity"
                status={activity.status}
                size="sm"
                className="glass-strong border-white/20"
              />
              <Badge size="sm" variant="neutral" className="glass-strong border-white/20 text-white">
                {titleCase(activity.category)}
              </Badge>
              {activity.featured ? (
                <Badge size="sm" variant="warning" className="border-transparent">
                  <Star className="size-3 fill-current" aria-hidden="true" />
                  Featured
                </Badge>
              ) : null}
            </div>

            <h1 className="mt-2.5 font-display text-2xl font-semibold text-balance text-white sm:text-3xl">
              {activity.name}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-white/75">{activity.tagline}</p>

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <Star className="size-3.5 fill-sunset-300 text-sunset-300" aria-hidden="true" />
                {activity.rating.toFixed(2)}
                <span className="text-white/55">({formatNumber(activity.reviewCount)})</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Timer className="size-3.5" aria-hidden="true" />
                {formatDuration(activity.durationMinutes)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Users className="size-3.5" aria-hidden="true" />
                {activity.minParticipants}–{activity.maxCapacity} guests
              </span>
              <DifficultyMeter difficulty={activity.difficulty} />
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="size-3.5" aria-hidden="true" />
                {detail.summary.occupancy30d.toFixed(0)}% full · 30d
              </span>
              <span className="hidden items-center gap-1.5 sm:inline-flex">
                <Repeat className="size-3.5" aria-hidden="true" />
                Updated {formatRelative(activity.updatedAt, now)}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ---------- body ---------- */}
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={setTab} variant="underline">
            <TabsList className="mb-5 w-full overflow-x-auto no-scrollbar">
              {tabs.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                  {typeof item.count === 'number' && item.count > 0 ? (
                    <span className="rounded-full bg-surface-sunken px-1.5 py-0.5 text-[0.625rem] font-semibold text-subtle tabular">
                      {formatNumber(item.count)}
                    </span>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview">
              <OverviewTab detail={detail} />
            </TabsContent>
            <TabsContent value="pricing">
              <PricingTab detail={detail} />
            </TabsContent>
            <TabsContent value="schedule">
              <ScheduleTab detail={detail} now={now} />
            </TabsContent>
            <TabsContent value="performance">
              <PerformanceTab detail={detail} />
            </TabsContent>
            <TabsContent value="reviews">
              <ReviewsTab detail={detail} now={now} />
            </TabsContent>
          </Tabs>
        </div>

        <aside className="min-w-0">
          <DetailRail detail={detail} tenantSlug={tenantSlug} />
        </aside>
      </div>
    </div>
  )
}
