'use client'

/**
 * ProductShowcase — "One screen for the whole operation".
 *
 * A scroll-driven tour of four real product surfaces. On desktop the app frame
 * is sticky while a rail of steps scrolls past it; `useScroll` over the rail
 * drives which view is rendered, and the frame's nav rail, URL bar and content
 * all change together. Below `lg` the sticky choreography is dropped entirely
 * for a plain segmented switcher — scroll-jacking on a phone is a tax, not a
 * feature.
 *
 * Every preview is built from the same primitives the dashboard uses
 * (CapacityBar, StatusBadge, Avatar, Table, buttonVariants) so what a visitor
 * sees here is what they get after signup. The previews are presentational:
 * the whole frame is exposed as a single labelled `role="img"`, and the step
 * rail carries the real, keyboard-reachable semantics.
 */

import { useId, useRef, useState, type ReactNode } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  type Variants,
} from 'motion/react'
import {
  Anchor,
  CalendarDays,
  ChartSpline,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CloudRain,
  Filter,
  LayoutDashboard,
  Plus,
  Search,
  Ship,
  Ticket,
  TriangleAlert,
  Waves,
  type LucideIcon,
} from 'lucide-react'

import { AppFrame } from '@/components/marketing/app-frame'
import { Reveal } from '@/components/motion/reveal'
import { Avatar, AvatarGroup } from '@/components/ui/avatar'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { CapacityBar, Progress } from '@/components/ui/progress'
import { Segmented, type SegmentedOption } from '@/components/ui/segmented'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { useIsDesktop } from '@/hooks/use-media-query'
import { FEATURE_BLOCKS } from '@/content/marketing'
import { EASE_OUT_EXPO, SPRING_GLIDE } from '@/lib/motion'
import { clamp, cn, formatCurrency } from '@/lib/utils'
import type { Activity, BookingStatus } from '@/types'

/* ==========================================================================
   TINTS — activity colour keys mapped onto the data-viz ramp, exactly as the
   calendar does in the product.
   ========================================================================== */

type Tint = Activity['colorKey']

const TINT: Record<Tint, { chip: string; text: string; bar: string }> = {
  lagoon: { chip: 'border-chart-1/25 bg-chart-1/10', text: 'text-chart-1', bar: 'bg-chart-1' },
  coral: { chip: 'border-chart-2/25 bg-chart-2/10', text: 'text-chart-2', bar: 'bg-chart-2' },
  reef: { chip: 'border-chart-3/25 bg-chart-3/10', text: 'text-chart-3', bar: 'bg-chart-3' },
  sunset: { chip: 'border-chart-4/30 bg-chart-4/12', text: 'text-chart-4', bar: 'bg-chart-4' },
  info: { chip: 'border-chart-5/25 bg-chart-5/10', text: 'text-chart-5', bar: 'bg-chart-5' },
  success: { chip: 'border-chart-6/25 bg-chart-6/10', text: 'text-chart-6', bar: 'bg-chart-6' },
}

/* ==========================================================================
   DEMO DATA — hand-authored so the previews read like a real Maui operator's
   week rather than noise. No RNG, no clock: identical on server and client.
   ========================================================================== */

interface PreviewDeparture {
  id: string
  time: string
  name: string
  booked: number
  capacity: number
  held?: number
  tint: Tint
  flag?: 'sold-out' | 'weather'
}

interface PreviewDay {
  weekday: string
  date: number
  today?: boolean
  departures: PreviewDeparture[]
}

const WEEK: PreviewDay[] = [
  {
    weekday: 'Mon',
    date: 7,
    departures: [
      { id: 'd1', time: '07:00', name: 'Molokini Dawn Patrol', booked: 12, capacity: 14, tint: 'lagoon' },
      { id: 'd2', time: '13:00', name: 'Turtle Town Kayak', booked: 9, capacity: 16, tint: 'success' },
    ],
  },
  {
    weekday: 'Tue',
    date: 8,
    departures: [
      { id: 'd3', time: '07:00', name: 'Molokini Dawn Patrol', booked: 6, capacity: 14, tint: 'lagoon' },
      { id: 'd4', time: '16:30', name: 'Sunset Catamaran', booked: 22, capacity: 38, tint: 'sunset' },
    ],
  },
  {
    weekday: 'Wed',
    date: 9,
    departures: [
      { id: 'd5', time: '08:00', name: 'Jet Ski Safari', booked: 8, capacity: 12, tint: 'coral' },
      { id: 'd6', time: '13:00', name: 'Turtle Town Kayak', booked: 14, capacity: 16, held: 2, tint: 'success' },
    ],
  },
  {
    weekday: 'Thu',
    date: 10,
    departures: [
      { id: 'd7', time: '07:00', name: 'Molokini Dawn Patrol', booked: 11, capacity: 14, tint: 'lagoon' },
      { id: 'd8', time: '16:30', name: 'Sunset Catamaran', booked: 31, capacity: 38, tint: 'sunset', flag: 'weather' },
    ],
  },
  {
    weekday: 'Fri',
    date: 11,
    today: true,
    departures: [
      { id: 'd9', time: '07:00', name: 'Molokini Dawn Patrol', booked: 14, capacity: 14, tint: 'lagoon', flag: 'sold-out' },
      { id: 'd10', time: '09:30', name: 'Beginner Surf Lesson', booked: 7, capacity: 10, tint: 'reef' },
      { id: 'd11', time: '16:30', name: 'Sunset Catamaran', booked: 36, capacity: 38, held: 2, tint: 'sunset' },
    ],
  },
  {
    weekday: 'Sat',
    date: 12,
    departures: [
      { id: 'd12', time: '07:00', name: 'Molokini Dawn Patrol', booked: 14, capacity: 14, tint: 'lagoon', flag: 'sold-out' },
      { id: 'd13', time: '10:00', name: 'West Maui Snorkel Raft', booked: 24, capacity: 26, tint: 'info' },
      { id: 'd14', time: '16:30', name: 'Sunset Catamaran', booked: 38, capacity: 38, tint: 'sunset', flag: 'sold-out' },
    ],
  },
  {
    weekday: 'Sun',
    date: 13,
    departures: [
      { id: 'd15', time: '10:00', name: 'West Maui Snorkel Raft', booked: 19, capacity: 26, tint: 'info' },
      { id: 'd16', time: '16:30', name: 'Sunset Catamaran', booked: 29, capacity: 38, tint: 'sunset' },
    ],
  },
]

interface PreviewBooking {
  reference: string
  guest: string
  activity: string
  departs: string
  party: number
  status: BookingStatus
  total: number
  channel: string
}

const BOOKINGS: PreviewBooking[] = [
  {
    reference: 'EZR-8KQ2M',
    guest: 'Marisol Vega',
    activity: 'Sunset Catamaran',
    departs: 'Fri 11 Sep · 4:30 PM',
    party: 4,
    status: 'confirmed',
    total: 51600,
    channel: 'Direct',
  },
  {
    reference: 'EZR-4RTD9',
    guest: 'Josh Brennan',
    activity: 'Molokini Dawn Patrol',
    departs: 'Sat 12 Sep · 7:00 AM',
    party: 2,
    status: 'checked_in',
    total: 25800,
    channel: 'Widget',
  },
  {
    reference: 'EZR-7NBW3',
    guest: 'Priya Raghunathan',
    activity: 'Turtle Town Kayak',
    departs: 'Sat 12 Sep · 1:00 PM',
    party: 6,
    status: 'pending',
    total: 68400,
    channel: 'Concierge',
  },
  {
    reference: 'EZR-2XHL6',
    guest: 'Daniel Wirrpanda',
    activity: 'West Maui Snorkel Raft',
    departs: 'Sun 13 Sep · 10:00 AM',
    party: 3,
    status: 'confirmed',
    total: 38700,
    channel: 'Viator',
  },
  {
    reference: 'EZR-9PQK1',
    guest: 'Isla Fairweather',
    activity: 'Beginner Surf Lesson',
    departs: 'Fri 11 Sep · 9:30 AM',
    party: 2,
    status: 'cancelled',
    total: 17800,
    channel: 'Direct',
  },
]

interface PreviewGuest {
  name: string
  party: number
  tier: string
  checkedIn: boolean
  note?: string
}

const MANIFEST: PreviewGuest[] = [
  { name: 'Marisol Vega', party: 4, tier: 'Adult ×2 · Child ×2', checkedIn: true },
  { name: 'Josh Brennan', party: 2, tier: 'Adult ×2', checkedIn: true },
  { name: 'Leilani Kapahu', party: 3, tier: 'Adult ×1 · Child ×2', checkedIn: true, note: 'Shellfish allergy' },
  { name: 'Gavin Mercer', party: 2, tier: 'Adult ×2', checkedIn: false, note: 'Waiver unsigned' },
  { name: 'Ana Ferreira', party: 2, tier: 'Adult ×2', checkedIn: false },
]

/** The departure this manifest belongs to, and how far check-in has got. */
const SEATS_BOOKED = 36
const SEATS_CAPACITY = 38
const PARTIES_TOTAL = 13
const PARTIES_CHECKED_IN = 8

interface PreviewTier {
  label: string
  price: number
  min: number
  max: number
  countsTowardCapacity: boolean
}

const TIERS: PreviewTier[] = [
  { label: 'Adult', price: 12900, min: 1, max: 12, countsTowardCapacity: true },
  { label: 'Child (4–12)', price: 8900, min: 0, max: 8, countsTowardCapacity: true },
  { label: 'Senior (65+)', price: 10900, min: 0, max: 8, countsTowardCapacity: true },
  { label: 'Private charter', price: 145000, min: 1, max: 1, countsTowardCapacity: false },
]

const ADD_ONS = [
  { label: 'GoPro rental', price: 3500 },
  { label: 'Reef-safe sunscreen', price: 1200 },
  { label: 'Hotel pickup', price: 2500 },
]

const CREW = [
  { id: 'u1', name: 'Kaimana Reyes' },
  { id: 'u2', name: 'Tane Kahananui' },
  { id: 'u3', name: 'Noelani Akana' },
]

/* ==========================================================================
   STEPS
   ========================================================================== */

interface ShowcaseStep {
  id: 'calendar' | 'bookings' | 'manifest' | 'activity'
  label: string
  icon: LucideIcon
  /** Which nav-rail item lights up inside the frame. */
  railIndex: number
  url: string
  title: string
  body: string
  /** Accessible description of the whole screenshot. */
  frameLabel: string
}

const STEPS: ShowcaseStep[] = [
  {
    id: 'calendar',
    label: 'Calendar',
    icon: CalendarDays,
    railIndex: 1,
    url: 'app.ezra.pro/blue-horizon/calendar',
    title: 'The whole week, every boat, one grid',
    body: 'Seven days of departures with live capacity on each one. Drag a trip to move it, and resource conflicts are refused before they reach a guest.',
    frameLabel:
      'EZRA Pro week calendar: seven day columns of departures from Monday 7 to Sunday 13 September, each chip showing its start time, activity and a capacity bar. Friday and Saturday dawn patrols are sold out and Thursday’s sunset sail is on a weather hold.',
  },
  {
    id: 'bookings',
    label: 'Bookings',
    icon: Ticket,
    railIndex: 2,
    url: 'app.ezra.pro/blue-horizon/bookings',
    title: 'Every booking, one sortable list',
    body: 'Guest, departure, party size, channel and payment on a single row. Refund, reschedule or message without opening four tabs.',
    frameLabel:
      'EZRA Pro bookings table: five recent bookings with guest avatars, activity, departure time, party size, status badges reading confirmed, checked in, pending and cancelled, and order totals.',
  },
  {
    id: 'manifest',
    label: 'Manifest',
    icon: ClipboardList,
    railIndex: 3,
    url: 'app.ezra.pro/blue-horizon/manifest',
    title: 'The sheet your crew runs the dock from',
    body: 'Tap a guest to check them in. Waivers, allergies and certifications sit on the row — and the whole thing keeps working with no signal.',
    frameLabel:
      'EZRA Pro manifest for the 4:30 PM Sunset Catamaran on vessel Blue Horizon II: 36 of 38 seats sold, 8 of 13 parties checked in, three assigned crew, and guest rows showing party size, ticket tier, allergy notes and an unsigned waiver warning.',
  },
  {
    id: 'activity',
    label: 'Editor',
    icon: Waves,
    railIndex: 4,
    url: 'app.ezra.pro/blue-horizon/activities/turtle-town',
    title: 'Price it the way you actually sell it',
    body: 'Tiers, add-ons and group rates in one editor. Change a price here and your site, your widget and every OTA agree within the second.',
    frameLabel:
      'EZRA Pro activity editor for Turtle Town Kayak & Snorkel: a live status badge, duration and capacity fields, four pricing tiers from Adult at 129 dollars to a private charter at 1,450 dollars, and three add-ons.',
  },
]

const RAIL_ITEMS: { icon: LucideIcon; label: string }[] = [
  { icon: LayoutDashboard, label: 'Overview' },
  { icon: CalendarDays, label: 'Calendar' },
  { icon: Ticket, label: 'Bookings' },
  { icon: ClipboardList, label: 'Manifest' },
  { icon: Waves, label: 'Activities' },
  { icon: ChartSpline, label: 'Analytics' },
]

const SEGMENTED_OPTIONS: SegmentedOption<ShowcaseStep['id']>[] = STEPS.map((step) => ({
  value: step.id,
  label: step.label,
  icon: step.icon,
}))

const OPERATIONS_BLOCK = FEATURE_BLOCKS.find((block) => block.id === 'feat-calendar')

/* ==========================================================================
   SHARED PREVIEW PARTS
   ========================================================================== */

/** A non-interactive element that borrows the real Button recipe. */
function FauxButton({
  children,
  variant = 'secondary',
  className,
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  className?: string
}) {
  return (
    <span
      className={cn(
        buttonVariants({ variant, size: 'xs' }),
        'pointer-events-none h-6 gap-1 px-2 text-xs [&_svg]:size-3',
        className,
      )}
    >
      {children}
    </span>
  )
}

/** A non-interactive element that mimics the real Input. */
function FauxField({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-xs font-medium tracking-[0.06em] text-subtle uppercase">{label}</p>
      <p className="mt-1 truncate rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-medium text-foreground shadow-xs">
        {value}
      </p>
    </div>
  )
}

function PreviewHeader({
  title,
  meta,
  actions,
}: {
  title: string
  meta?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line-subtle bg-surface px-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate font-display text-[0.8125rem] leading-tight font-semibold text-foreground">
          {title}
        </p>
        {meta ? <div className="mt-0.5 flex items-center gap-1.5 text-xs text-subtle">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </header>
  )
}

/** The product's icon nav. Its active pill slides as the tour advances. */
function NavRail({ activeIndex, layoutId }: { activeIndex: number; layoutId: string }) {
  const reduced = useReducedMotionSafe()

  return (
    <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-line-subtle bg-surface py-2.5">
      <span className="grid size-6 place-items-center rounded-md bg-[linear-gradient(140deg,var(--color-lagoon-500),var(--color-lagoon-700))] font-display text-xs font-bold text-on-primary shadow-xs">
        E
      </span>
      <span className="my-1 h-px w-5 bg-line-subtle" />

      {RAIL_ITEMS.map((item, index) => {
        const Icon = item.icon
        const active = index === activeIndex
        return (
          <span
            key={item.label}
            className={cn(
              'relative grid size-7 place-items-center rounded-lg transition-colors duration-300',
              active ? 'text-primary' : 'text-faint',
            )}
          >
            {active ? (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-lg bg-primary-soft ring-1 ring-primary/25 ring-inset"
                transition={
                  reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }
                }
              />
            ) : null}
            <Icon className="relative size-[0.9375rem]" strokeWidth={1.9} />
          </span>
        )
      })}
    </div>
  )
}

/* ==========================================================================
   VIEW 1 — WEEK CALENDAR
   ========================================================================== */

function CalendarPreview() {
  return (
    <div className="flex h-full flex-col">
      <PreviewHeader
        title="7 – 13 September 2026"
        meta={
          <>
            <span className="tabular">18 departures</span>
            <span className="text-faint">·</span>
            <span className="tabular">284 seats sold</span>
          </>
        }
        actions={
          <>
            <span className="hidden items-center gap-0.5 rounded-lg border border-line bg-surface p-0.5 text-faint sm:flex">
              <ChevronLeft aria-hidden="true" className="size-3.5" />
              <ChevronRight aria-hidden="true" className="size-3.5" />
            </span>
            <FauxButton variant="primary">
              <Plus aria-hidden="true" />
              New departure
            </FauxButton>
          </>
        }
      />

      <div className="no-scrollbar min-h-0 flex-1 overflow-auto px-2.5 pt-2.5 pb-2">
        <div className="grid min-w-[34rem] grid-cols-7 gap-1.5">
          {WEEK.map((day) => (
            <div key={day.weekday} className="flex min-w-0 flex-col gap-1.5">
              <div
                className={cn(
                  'flex items-baseline justify-between gap-1 rounded-md px-1.5 py-1',
                  day.today ? 'bg-primary text-on-primary' : 'bg-surface-sunken',
                )}
              >
                <span
                  className={cn(
                    'text-xs font-semibold tracking-[0.08em] uppercase',
                    day.today ? 'text-on-primary/80' : 'text-subtle',
                  )}
                >
                  {day.weekday}
                </span>
                <span
                  className={cn(
                    'tabular text-xs font-semibold',
                    day.today ? 'text-on-primary' : 'text-foreground',
                  )}
                >
                  {day.date}
                </span>
              </div>

              {day.departures.map((departure) => (
                <div
                  key={departure.id}
                  className={cn(
                    'flex flex-col gap-1 rounded-md border p-1.5 shadow-xs',
                    TINT[departure.tint].chip,
                  )}
                >
                  <div className="flex items-center gap-1">
                    <span className={cn('tabular text-xs leading-none font-bold', TINT[departure.tint].text)}>
                      {departure.time}
                    </span>
                    {departure.flag === 'weather' ? (
                      <CloudRain aria-hidden="true" className="size-2.5 shrink-0 text-warning" />
                    ) : null}
                    {departure.flag === 'sold-out' ? (
                      <span className="ml-auto rounded-sm bg-accent px-1 text-xs leading-[0.875rem] font-bold text-on-accent">
                        FULL
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs leading-tight font-medium text-foreground">
                    {departure.name}
                  </p>
                  <CapacityBar
                    booked={departure.booked}
                    capacity={departure.capacity}
                    held={departure.held}
                    size="xs"
                    showLabel={false}
                  />
                  <p className="tabular text-xs leading-none text-subtle">
                    {departure.booked}/{departure.capacity}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-line-subtle bg-surface px-3 py-2">
        <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0 text-warning" />
        <p className="min-w-0 truncate text-xs text-muted">
          Thursday 16:30 is on a weather hold — 31 guests await a decision.
        </p>
        <FauxButton className="ml-auto">Review</FauxButton>
      </footer>
    </div>
  )
}

/* ==========================================================================
   VIEW 2 — BOOKINGS
   ========================================================================== */

function BookingsPreview() {
  return (
    <div className="flex h-full flex-col">
      <PreviewHeader
        title="Bookings"
        meta={
          <>
            <span className="tabular">1,284 this month</span>
            <span className="text-faint">·</span>
            <span className="tabular">3 awaiting payment</span>
          </>
        }
        actions={
          <>
            <span className="hidden h-6 items-center gap-1.5 rounded-lg border border-line bg-surface px-2 text-xs text-faint sm:flex">
              <Search aria-hidden="true" className="size-3" />
              Search
            </span>
            <FauxButton>
              <Filter aria-hidden="true" />
              Filters
            </FauxButton>
          </>
        }
      />

      <div className="no-scrollbar min-h-0 flex-1 overflow-auto">
        <Table density="compact" className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 px-3 text-xs">Guest</TableHead>
              <TableHead className="hidden h-8 px-3 text-xs md:table-cell">Departure</TableHead>
              <TableHead className="h-8 px-3 text-center text-xs">Party</TableHead>
              <TableHead className="hidden h-8 px-3 text-xs sm:table-cell">Status</TableHead>
              <TableHead className="h-8 px-3 text-right text-xs">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {BOOKINGS.map((booking) => (
              <TableRow key={booking.reference}>
                <TableCell className="px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar name={booking.guest} size="xs" alt="" />
                    <div className="min-w-0">
                      <p className="truncate text-xs leading-tight font-medium text-foreground">
                        {booking.guest}
                      </p>
                      <p className="tabular truncate text-xs leading-tight text-subtle">
                        {booking.reference} · {booking.channel}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden px-3 py-2 md:table-cell">
                  <p className="truncate text-xs leading-tight text-foreground">
                    {booking.activity}
                  </p>
                  <p className="tabular truncate text-xs leading-tight text-subtle">
                    {booking.departs}
                  </p>
                </TableCell>
                <TableCell className="tabular px-3 py-2 text-center text-xs text-muted">
                  {booking.party}
                </TableCell>
                <TableCell className="hidden px-3 py-2 sm:table-cell">
                  <StatusBadge kind="booking" status={booking.status} size="sm" showIcon={false} dot />
                </TableCell>
                <TableCell className="tabular px-3 py-2 text-right text-xs font-semibold text-foreground">
                  {formatCurrency(booking.total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-line-subtle bg-surface px-3 py-2">
        <p className="tabular text-xs text-subtle">Showing 1–5 of 1,284</p>
        <div className="flex items-center gap-1">
          <FauxButton variant="ghost">Export CSV</FauxButton>
          <FauxButton variant="primary">Bulk actions</FauxButton>
        </div>
      </footer>
    </div>
  )
}

/* ==========================================================================
   VIEW 3 — MANIFEST
   ========================================================================== */

function ManifestPreview() {
  return (
    <div className="flex h-full flex-col">
      <PreviewHeader
        title="Sunset Catamaran · 4:30 PM"
        meta={
          <>
            <Ship aria-hidden="true" className="size-3" />
            <span>Blue Horizon II</span>
            <span className="text-faint">·</span>
            <Anchor aria-hidden="true" className="size-3" />
            <span>Slip 14, Māʻalaea</span>
          </>
        }
        actions={
          <>
            <AvatarGroup
              avatars={CREW}
              size="xs"
              max={3}
              label="Crew assigned to this departure"
              ringClassName="ring-surface"
            />
            <FauxButton variant="primary">Start trip</FauxButton>
          </>
        }
      />

      <div className="grid shrink-0 gap-2 border-b border-line-subtle bg-surface-sunken/60 px-3 py-2 sm:grid-cols-2 sm:gap-4">
        <CapacityBar booked={SEATS_BOOKED} capacity={SEATS_CAPACITY} size="sm" />

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="tabular font-medium text-foreground">
              {PARTIES_CHECKED_IN} / {PARTIES_TOTAL} parties
            </span>
            <span className="font-medium text-info">Checking in</span>
          </div>
          <Progress
            value={PARTIES_CHECKED_IN}
            max={PARTIES_TOTAL}
            tone="info"
            size="sm"
            aria-label="Check-in progress"
          />
        </div>
      </div>

      <ul className="no-scrollbar min-h-0 flex-1 divide-y divide-line-subtle overflow-auto">
        {MANIFEST.map((guest) => (
          <li key={guest.name} className="flex items-center gap-2.5 px-3 py-2">
            <span
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
                guest.checkedIn
                  ? 'border-success bg-success text-background'
                  : 'border-line-strong bg-surface text-transparent',
              )}
            >
              <Check aria-hidden="true" className="size-3" strokeWidth={3} />
            </span>

            <Avatar name={guest.name} size="xs" alt="" />

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs leading-tight font-medium text-foreground">
                {guest.name}
              </p>
              <p className="truncate text-xs leading-tight text-subtle">{guest.tier}</p>
            </div>

            {guest.note ? (
              <Badge
                size="sm"
                variant={guest.note === 'Waiver unsigned' ? 'warning' : 'info'}
                className="hidden h-4 px-1.5 text-xs sm:inline-flex"
              >
                {guest.note}
              </Badge>
            ) : null}

            <span className="tabular w-6 shrink-0 text-right text-xs font-semibold text-muted">
              ×{guest.party}
            </span>
          </li>
        ))}
      </ul>

      <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-line-subtle bg-surface px-3 py-2">
        <p className="text-xs text-subtle">
          <span className="tabular font-semibold text-foreground">8</span> more parties on this
          manifest
        </p>
        <div className="flex items-center gap-1.5">
          <Badge size="sm" variant="success" dot className="h-5">
            Offline ready
          </Badge>
          <FauxButton>Print</FauxButton>
        </div>
      </footer>
    </div>
  )
}

/* ==========================================================================
   VIEW 4 — ACTIVITY EDITOR
   ========================================================================== */

const EDITOR_TABS = ['Details', 'Pricing', 'Schedule', 'Media'] as const

function ActivityEditorPreview() {
  return (
    <div className="flex h-full flex-col">
      <PreviewHeader
        title="Turtle Town Kayak & Snorkel"
        meta={
          <>
            <span>2h 30m</span>
            <span className="text-faint">·</span>
            <span>Max 16 guests</span>
            <span className="text-faint">·</span>
            <span className="tabular">4.9 ★ (312)</span>
          </>
        }
        actions={
          <>
            <StatusBadge kind="activity" status="live" size="sm" className="h-5" />
            <FauxButton variant="primary">Save</FauxButton>
          </>
        }
      />

      <div className="flex shrink-0 items-center gap-4 border-b border-line-subtle bg-surface px-3">
        {EDITOR_TABS.map((tab) => (
          <span
            key={tab}
            className={cn(
              'relative py-1.5 text-xs font-medium',
              tab === 'Pricing' ? 'text-foreground' : 'text-subtle',
            )}
          >
            {tab}
            {tab === 'Pricing' ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
            ) : null}
          </span>
        ))}
      </div>

      <div className="no-scrollbar min-h-0 flex-1 space-y-2.5 overflow-auto px-3 py-2.5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <FauxField label="Pricing model" value="Tiered" />
          <FauxField label="Currency" value="USD ($)" />
          <FauxField label="Min. participants" value="2" className="hidden sm:block" />
        </div>

        <div className="overflow-hidden rounded-lg border border-line bg-surface">
          <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-2.5 py-1.5">
            <p className="text-xs font-semibold tracking-[0.06em] text-subtle uppercase">
              Price tiers
            </p>
            <FauxButton variant="ghost">
              <Plus aria-hidden="true" />
              Add tier
            </FauxButton>
          </div>

          <ul className="divide-y divide-line-subtle">
            {TIERS.map((tier) => (
              <li key={tier.label} className="flex items-center gap-2 px-2.5 py-1.5">
                <span className="size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                  {tier.label}
                </span>
                <span className="tabular hidden shrink-0 text-xs text-subtle sm:inline">
                  {tier.min}–{tier.max} pax
                </span>
                {tier.countsTowardCapacity ? (
                  <Badge size="sm" variant="neutral" className="hidden h-4 px-1.5 text-xs md:inline-flex">
                    Counts to capacity
                  </Badge>
                ) : null}
                <span className="tabular w-16 shrink-0 rounded-md border border-line bg-background-subtle px-1.5 py-0.5 text-right text-xs font-semibold text-foreground">
                  {formatCurrency(tier.price)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold tracking-[0.06em] text-subtle uppercase">
            Add-ons
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ADD_ONS.map((addOn) => (
              <span
                key={addOn.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2 py-1 text-xs text-muted"
              >
                {addOn.label}
                <span className="tabular font-semibold text-foreground">
                  +{formatCurrency(addOn.price)}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t border-line-subtle bg-surface px-3 py-2">
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-success" aria-hidden="true" />
        <p className="min-w-0 truncate text-xs text-muted">
          Published to your site, widget, Viator and GetYourGuide.
        </p>
      </footer>
    </div>
  )
}

/* ==========================================================================
   VIEW SWITCHER
   ========================================================================== */

function StepView({ id }: { id: ShowcaseStep['id'] }) {
  switch (id) {
    case 'calendar':
      return <CalendarPreview />
    case 'bookings':
      return <BookingsPreview />
    case 'manifest':
      return <ManifestPreview />
    case 'activity':
      return <ActivityEditorPreview />
  }
}

const VIEW_VARIANTS: Variants = {
  initial: { opacity: 0, y: 12, scale: 0.985, filter: 'blur(6px)' },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.46, ease: EASE_OUT_EXPO },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.99,
    filter: 'blur(5px)',
    transition: { duration: 0.26, ease: EASE_OUT_EXPO },
  },
}

const STATIC_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
}

/* ==========================================================================
   SECTION
   ========================================================================== */

export function ProductShowcase({ className }: { className?: string }) {
  const reduced = useReducedMotionSafe()
  const isDesktop = useIsDesktop()
  const railLayoutId = useId()

  const railRef = useRef<HTMLOListElement>(null)
  const stepRefs = useRef<Array<HTMLLIElement | null>>([])

  const [scrollIndex, setScrollIndex] = useState(0)
  const [tabIndex, setTabIndex] = useState(0)

  const { scrollYProgress } = useScroll({
    target: railRef,
    offset: ['start center', 'end center'],
  })
  const smoothProgress = useSpring(scrollYProgress, SPRING_GLIDE)
  const railProgress = reduced ? scrollYProgress : smoothProgress

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const next = clamp(Math.floor(value * STEPS.length), 0, STEPS.length - 1)
    setScrollIndex((current) => (current === next ? current : next))
  })

  const activeIndex = isDesktop ? scrollIndex : tabIndex
  const activeStep = STEPS[activeIndex] ?? STEPS[0]

  const selectStep = (id: ShowcaseStep['id']) => {
    const index = STEPS.findIndex((step) => step.id === id)
    if (index === -1) return
    setTabIndex(index)
    if (isDesktop) {
      stepRefs.current[index]?.scrollIntoView({
        behavior: reduced ? 'auto' : 'smooth',
        block: 'center',
      })
    }
  }

  return (
    <section
      id="product"
      aria-labelledby="product-showcase-heading"
      className={cn('relative isolate overflow-hidden py-20 sm:py-24 lg:py-32', className)}
    >
      {/* Decorative ground — a single soft lagoon wash, nothing that competes. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-[0.5] mask-radial"
      />

      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <Reveal as="header" direction="up" blur className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold tracking-[0.1em] text-primary uppercase shadow-xs">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            {OPERATIONS_BLOCK?.eyebrow ?? 'Operations'}
          </p>
          <h2
            id="product-showcase-heading"
            className="mt-5 text-display-sm text-balance text-foreground sm:text-display-md"
          >
            One screen for the whole operation
          </h2>
          {OPERATIONS_BLOCK ? (
            <p className="mt-5 text-base leading-relaxed text-pretty text-muted sm:text-lg">
              {OPERATIONS_BLOCK.description}
            </p>
          ) : null}
        </Reveal>

        {/* Mobile / tablet switcher — no sticky, no scroll hijacking. */}
        <div className="mt-8 lg:hidden">
          <Segmented
            options={SEGMENTED_OPTIONS}
            value={activeStep.id}
            onValueChange={selectStep}
            label="Choose a product screen to preview"
            size="sm"
            fullWidth
            className="w-full"
          />
        </div>

        <div className="mt-6 grid gap-8 lg:mt-16 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-16">
          {/* ---------- Step rail (desktop) ---------- */}
          <ol ref={railRef} className="relative hidden lg:block">
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-px bg-line" />
            <motion.span
              aria-hidden="true"
              style={{ scaleY: railProgress }}
              className="absolute inset-y-0 left-0 w-px origin-top bg-primary"
            />

            {STEPS.map((step, index) => {
              const active = index === scrollIndex
              const Icon = step.icon
              return (
                <li
                  key={step.id}
                  ref={(node) => {
                    stepRefs.current[index] = node
                  }}
                  className="flex min-h-[58vh] items-center"
                >
                  <button
                    type="button"
                    onClick={() => selectStep(step.id)}
                    aria-current={active ? 'step' : undefined}
                    className={cn(
                      'group/step block w-full rounded-r-xl py-4 pr-4 pl-7 text-left',
                      'transition-[opacity,transform] duration-500 ease-[var(--ease-out-expo)]',
                      'motion-reduce:transition-none',
                      active ? 'opacity-100' : 'opacity-55 hover:opacity-80',
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-lg border transition-colors duration-500',
                          active
                            ? 'border-primary/30 bg-primary-soft text-primary'
                            : 'border-line bg-surface text-subtle',
                        )}
                      >
                        <Icon aria-hidden="true" className="size-4" strokeWidth={1.9} />
                      </span>
                      <span
                        className={cn(
                          'text-xs font-semibold tracking-[0.1em] uppercase transition-colors duration-500',
                          active ? 'text-primary' : 'text-subtle',
                        )}
                      >
                        Step {index + 1} — {step.label}
                      </span>
                    </span>

                    <span className="mt-4 block font-display text-2xl leading-tight font-semibold tracking-[-0.025em] text-balance text-foreground">
                      {step.title}
                    </span>
                    <span className="mt-3 block max-w-md text-[0.9375rem] leading-relaxed text-pretty text-muted">
                      {step.body}
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          {/* ---------- Sticky app frame ---------- */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            {/* Step copy repeats here below lg, where the rail is hidden. */}
            <div className="mb-5 lg:hidden">
              <h3 className="font-display text-xl leading-tight font-semibold tracking-[-0.02em] text-balance text-foreground">
                {activeStep.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-pretty text-muted">{activeStep.body}</p>
            </div>

            <Reveal direction="up" blur duration={0.9} distance={28}>
              <AppFrame url={activeStep.url} glow="lagoon">
                <div
                  role="img"
                  aria-label={activeStep.frameLabel}
                  className="flex h-[21rem] sm:h-[24rem] lg:h-[27rem]"
                >
                  <NavRail activeIndex={activeStep.railIndex} layoutId={railLayoutId} />

                  <div className="relative min-w-0 flex-1 overflow-hidden">
                    <AnimatePresence initial={false}>
                      <motion.div
                        key={activeStep.id}
                        variants={reduced ? STATIC_VARIANTS : VIEW_VARIANTS}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="absolute inset-0 gpu"
                      >
                        <StepView id={activeStep.id} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </AppFrame>
            </Reveal>

            <p className="mt-5 hidden items-center gap-2 text-[0.8125rem] text-subtle lg:flex">
              <span className="tabular font-semibold text-foreground">
                {activeIndex + 1}/{STEPS.length}
              </span>
              <span className="h-px w-8 bg-line-strong" aria-hidden="true" />
              Keep scrolling — the screen follows along.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
