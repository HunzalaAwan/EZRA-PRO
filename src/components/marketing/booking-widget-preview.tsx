'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Baby, Clock, MapPin, Minus, Plus, ShieldCheck, Star, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { DURATION, EASE_OUT_EXPO } from '@/lib/motion'
import { clamp, cn, formatCurrency } from '@/lib/utils'

/**
 * The hero's product shot: a complete, believable embedded booking widget
 * rendered in live DOM rather than shipped as an image.
 *
 * Two deliberate decisions hold it together:
 *
 *  1. **It is a picture, semantically.** The root is `role="img"` carrying a
 *     sentence-long description of the current state, the visual body is
 *     `aria-hidden`, and every control is `tabIndex={-1}`. Pointer users get a
 *     widget that genuinely responds; keyboard and screen-reader users get the
 *     truth instead of a tab-trap of decorative buttons that book nothing.
 *  2. **Nothing is random.** Every date, price and seat count is a constant,
 *     and the one looping animation is driven by a `useEffect` interval — so
 *     the server render and the client's first paint are identical.
 */

/* ==========================================================================
   FIXTURE — the "screenshot" content
   ========================================================================== */

const ACTIVITY_TITLE = 'Sunset Catamaran Sail & Snorkel'
const ACTIVITY_MONTH = 'March 2026'
const MEETING_POINT = 'Pier 4, Lahaina'
const ACTIVITY_DURATION = '3h 30m'
const RATING = 4.9
const REVIEW_COUNT_LABEL = '1,284'

const ADULT_PRICE = 8900
const CHILD_PRICE = 4900
const MAX_ADULTS = 8
const MAX_CHILDREN = 6

interface DayCell {
  id: string
  weekday: string
  day: number
  soldOut?: boolean
}

const DAYS: DayCell[] = [
  { id: 'd-12', weekday: 'Wed', day: 12 },
  { id: 'd-13', weekday: 'Thu', day: 13 },
  { id: 'd-14', weekday: 'Fri', day: 14 },
  { id: 'd-15', weekday: 'Sat', day: 15 },
  { id: 'd-16', weekday: 'Sun', day: 16, soldOut: true },
  { id: 'd-17', weekday: 'Mon', day: 17 },
  { id: 'd-18', weekday: 'Tue', day: 18 },
]

type SlotKind = 'open' | 'live' | 'sold-out'

interface SlotOption {
  id: string
  time: string
  /** Fixed seat count. The `live` slot reads the ticker below instead. */
  seats: number
  kind: SlotKind
}

const SLOTS: SlotOption[] = [
  { id: 'slot-10-00', time: '10:00 AM', seats: 0, kind: 'sold-out' },
  { id: 'slot-14-30', time: '2:30 PM', seats: 12, kind: 'open' },
  { id: 'slot-17-45', time: '5:45 PM', seats: 4, kind: 'live' },
]

/** Seats left on the sunset departure — ticks down, then restocks on refresh. */
const SEAT_CYCLE = [6, 5, 4, 3, 2]
const SEAT_TICK_MS = 2400
/** Denominator for the remaining-capacity hairline under each slot. */
const SLOT_CAPACITY = 12

const GUEST_ROWS = [
  { id: 'adults', label: 'Adults', caption: 'Age 13+', price: ADULT_PRICE, icon: Users },
  { id: 'children', label: 'Children', caption: 'Age 4-12', price: CHILD_PRICE, icon: Baby },
] as const

/* ==========================================================================
   Parts
   ========================================================================== */

/** Lagoon dot with an expanding ring — the widget's "this is live" tell. */
function LiveDot() {
  const reducedMotion = useReducedMotionSafe()
  return (
    <span className="relative inline-flex size-1.5 shrink-0">
      {!reducedMotion ? (
        <span className="animate-pulse-ring absolute inset-0 rounded-full bg-primary" />
      ) : null}
      <span className="relative size-1.5 rounded-full bg-primary" />
    </span>
  )
}

/** 4.9 of 5, drawn with a clipped overlay so the partial star is honest. */
function StarRating() {
  return (
    <span className="flex items-center gap-px">
      {[0, 1, 2, 3, 4].map((index) => (
        <span key={index} className="relative block size-3.5">
          <Star
            className="absolute inset-0 size-3.5 text-line-strong"
            fill="currentColor"
            strokeWidth={0}
          />
          <span
            className="absolute inset-y-0 left-0 overflow-hidden"
            style={{ width: `${clamp((RATING - index) * 100, 0, 100)}%` }}
          >
            <Star className="size-3.5 text-sunset-500" fill="currentColor" strokeWidth={0} />
          </span>
        </span>
      ))}
    </span>
  )
}

/**
 * The activity plate — sunset over water, built from gradients and one SVG.
 * No network request, no layout shift, and it themes itself because every
 * colour is a brand ramp custom property.
 */
function ActivityPlate() {
  return (
    <div className="relative h-28 overflow-hidden sm:h-32">
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(168deg, var(--color-reef-800) 0%, var(--color-lagoon-700) 34%, var(--color-coral-500) 76%, var(--color-sunset-400) 100%)',
        }}
      />
      {/* Low sun, half-drowned by the horizon. */}
      <div
        className="absolute left-[34%] top-[50%] size-28 -translate-x-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, var(--color-sunset-100) 0%, var(--color-sunset-300) 38%, transparent 68%)',
          opacity: 0.85,
        }}
      />
      {/* Water below the horizon, with a specular path back to the sun. */}
      <div
        className="absolute inset-x-0 bottom-0 h-[42%]"
        style={{
          background:
            'linear-gradient(to bottom, color-mix(in oklab, var(--color-ink-950) 34%, transparent), color-mix(in oklab, var(--color-ink-950) 72%, transparent))',
        }}
      />
      <div
        className="absolute bottom-0 left-[34%] h-[42%] w-16 -translate-x-1/2"
        style={{
          background:
            'linear-gradient(to bottom, color-mix(in oklab, var(--color-sunset-200) 44%, transparent), transparent 88%)',
        }}
      />
      <svg
        viewBox="0 0 120 64"
        className="absolute bottom-2 right-5 h-14 w-24 text-ink-950"
        fill="currentColor"
        opacity="0.6"
        focusable="false"
      >
        <path d="M57 4 58 44 33 44Z" />
        <path d="M62 16 62 44 84 44Z" />
        <path d="M24 48h72l-9 9H33Z" />
      </svg>
      {/* Seat the plate into the card body. */}
      <div
        className="absolute inset-x-0 bottom-0 h-8"
        style={{
          background:
            'linear-gradient(to bottom, transparent, color-mix(in oklab, var(--surface) 90%, transparent))',
        }}
      />
      <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--color-ink-950)_52%,transparent)] px-2.5 py-1 text-[0.6875rem] font-medium text-ink-50 backdrop-blur-sm">
        <span className="size-1.5 rounded-full bg-sunset-300" />
        Bestseller
      </span>
      <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[color-mix(in_oklab,var(--color-ink-950)_52%,transparent)] px-2.5 py-1 text-[0.6875rem] font-medium text-ink-50 backdrop-blur-sm">
        <Clock className="size-3" />
        {ACTIVITY_DURATION}
      </span>
    </div>
  )
}

/* ==========================================================================
   <BookingWidgetPreview>
   ========================================================================== */

export interface BookingWidgetPreviewProps {
  className?: string
}

export function BookingWidgetPreview({ className }: BookingWidgetPreviewProps) {
  const reducedMotion = useReducedMotionSafe()

  const [selectedDay, setSelectedDay] = useState('d-14')
  const [selectedSlot, setSelectedSlot] = useState('slot-17-45')
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [seatIndex, setSeatIndex] = useState(0)

  // The one looping animation. Timer-driven rather than render-driven, so the
  // server and the client's first frame both show SEAT_CYCLE[0].
  useEffect(() => {
    if (reducedMotion) return
    const timer = window.setInterval(
      () => setSeatIndex((index) => (index + 1) % SEAT_CYCLE.length),
      SEAT_TICK_MS,
    )
    return () => window.clearInterval(timer)
  }, [reducedMotion])

  const liveSeats = SEAT_CYCLE[seatIndex]
  const seatsFor = (slot: SlotOption) => (slot.kind === 'live' ? liveSeats : slot.seats)

  const day = DAYS.find((entry) => entry.id === selectedDay) ?? DAYS[2]
  const slot = SLOTS.find((entry) => entry.id === selectedSlot) ?? SLOTS[2]
  const total = adults * ADULT_PRICE + children * CHILD_PRICE
  const totalLabel = formatCurrency(total)

  const counts: Record<string, number> = { adults, children }
  const setCount = (id: string, next: number) => {
    if (id === 'adults') setAdults(clamp(next, 1, MAX_ADULTS))
    else setChildren(clamp(next, 0, MAX_CHILDREN))
  }

  const guestSummary = `${adults} ${adults === 1 ? 'adult' : 'adults'}${
    children > 0 ? ` and ${children} ${children === 1 ? 'child' : 'children'}` : ''
  }`

  const description =
    `Preview of the EZRA Pro booking widget. Sunset Catamaran Sail and Snorkel, ` +
    `rated ${RATING} from ${REVIEW_COUNT_LABEL} reviews, ${ACTIVITY_DURATION} from ${MEETING_POINT}. ` +
    `Selected: ${day.weekday} ${day.day} ${ACTIVITY_MONTH} at ${slot.time}, ` +
    `${seatsFor(slot)} seats remaining. ${guestSummary}, total ${totalLabel}.`

  return (
    <figure
      role="img"
      aria-label={description}
      className={cn(
        'glass-strong relative isolate mx-auto w-full max-w-[26rem] overflow-hidden rounded-3xl shadow-2xl',
        className,
      )}
    >
      {/* The crisp inner hairline that separates a real UI from a mock-up. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 rounded-3xl ring-1 ring-inset ring-[color-mix(in_oklab,var(--color-ink-50)_14%,transparent)]"
      />

      <div aria-hidden="true">
        <ActivityPlate />

        <div className="space-y-4 p-4 sm:space-y-5 sm:p-5">
          {/* ---------- Title + rating ---------- */}
          <div>
            <h3 className="font-display text-[1.0625rem] font-semibold leading-snug tracking-[-0.022em] text-foreground sm:text-lg">
              {ACTIVITY_TITLE}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.6875rem] text-muted sm:text-xs">
              <span className="flex items-center gap-1.5">
                <StarRating />
                <span className="tabular font-semibold text-foreground">{RATING}</span>
                <span className="tabular text-subtle">({REVIEW_COUNT_LABEL})</span>
              </span>
              <span className="size-1 rounded-full bg-line-strong" />
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5 text-subtle" />
                {MEETING_POINT}
              </span>
            </div>
          </div>

          {/* ---------- Date strip ---------- */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-subtle">
                {ACTIVITY_MONTH}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[0.625rem] font-medium text-primary">
                <LiveDot />
                Live availability
              </span>
            </div>

            <div className="mt-2.5 grid grid-cols-7 gap-1 sm:gap-1.5">
              {DAYS.map((entry) => {
                const isSelected = entry.id === selectedDay
                return (
                  <button
                    key={entry.id}
                    type="button"
                    tabIndex={-1}
                    disabled={entry.soldOut}
                    onClick={() => setSelectedDay(entry.id)}
                    className={cn(
                      'relative flex flex-col items-center gap-0.5 rounded-xl border py-1.5',
                      'transition-[transform,background-color,border-color,color,box-shadow] duration-200 ease-[var(--ease-out-expo)]',
                      isSelected
                        ? 'border-transparent bg-primary text-on-primary shadow-[0_6px_16px_-8px_color-mix(in_oklab,var(--primary)_85%,transparent)]'
                        : entry.soldOut
                          ? 'cursor-not-allowed border-line-subtle bg-transparent text-faint'
                          : 'border-line bg-surface-raised text-muted hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--primary)_45%,transparent)] hover:text-foreground',
                    )}
                  >
                    <span className="text-[0.5625rem] font-medium uppercase tracking-[0.06em] opacity-75">
                      {entry.weekday}
                    </span>
                    <span className="tabular text-[0.8125rem] font-semibold leading-none">
                      {entry.day}
                    </span>
                    {entry.soldOut ? (
                      <span className="absolute inset-x-2 top-1/2 h-px -rotate-[18deg] bg-line-strong" />
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ---------- Time slots ---------- */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {SLOTS.map((entry) => {
              const isSelected = entry.id === selectedSlot
              const soldOut = entry.kind === 'sold-out'
              const seats = seatsFor(entry)
              const scarce = seats <= 5

              return (
                <button
                  key={entry.id}
                  type="button"
                  tabIndex={-1}
                  disabled={soldOut}
                  onClick={() => setSelectedSlot(entry.id)}
                  className={cn(
                    'relative flex flex-col items-center gap-1 overflow-hidden rounded-xl border px-1 py-2',
                    'transition-[transform,background-color,border-color,box-shadow] duration-200 ease-[var(--ease-out-expo)]',
                    isSelected
                      ? 'border-[color-mix(in_oklab,var(--primary)_55%,transparent)] bg-primary-soft shadow-[0_8px_20px_-12px_color-mix(in_oklab,var(--primary)_90%,transparent)]'
                      : soldOut
                        ? 'cursor-not-allowed border-line-subtle bg-transparent'
                        : 'border-line bg-surface-raised hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--primary)_40%,transparent)]',
                  )}
                >
                  <span
                    className={cn(
                      'tabular text-[0.8125rem] font-semibold leading-none',
                      soldOut ? 'text-faint line-through' : 'text-foreground',
                    )}
                  >
                    {entry.time}
                  </span>

                  {soldOut ? (
                    <span className="text-[0.625rem] font-medium leading-none text-faint">
                      Sold out
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.625rem] font-medium leading-none',
                        scarce ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success',
                      )}
                    >
                      {entry.kind === 'live' && !reducedMotion ? (
                        <span className="relative inline-block h-[1em] w-[1.1ch] overflow-hidden align-baseline">
                          <AnimatePresence initial={false}>
                            <motion.span
                              key={seats}
                              className="tabular absolute inset-0 flex items-center justify-center"
                              initial={{ y: '-110%', opacity: 0 }}
                              animate={{ y: '0%', opacity: 1 }}
                              exit={{ y: '110%', opacity: 0 }}
                              transition={{ duration: DURATION.quick, ease: EASE_OUT_EXPO }}
                            >
                              {seats}
                            </motion.span>
                          </AnimatePresence>
                        </span>
                      ) : (
                        <span className="tabular">{seats}</span>
                      )}
                      <span className="ml-0.5">left</span>
                    </span>
                  )}

                  {/* Remaining capacity — scaleX only, so it composites on the GPU. */}
                  <span className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden">
                    <span
                      className={cn(
                        'block h-full origin-left rounded-full transition-transform duration-500 ease-[var(--ease-out-expo)]',
                        soldOut ? 'bg-line-strong' : scarce ? 'bg-warning' : 'bg-success',
                      )}
                      style={{
                        transform: `scaleX(${soldOut ? 1 : clamp(seats / SLOT_CAPACITY, 0.08, 1)})`,
                      }}
                    />
                  </span>
                </button>
              )
            })}
          </div>

          {/* ---------- Guests ---------- */}
          <div className="space-y-2">
            {GUEST_ROWS.map((row) => {
              const Icon = row.icon
              const count = counts[row.id]
              const min = row.id === 'adults' ? 1 : 0
              const max = row.id === 'adults' ? MAX_ADULTS : MAX_CHILDREN

              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line bg-[color-mix(in_oklab,var(--surface-raised)_70%,transparent)] px-2.5 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-[0.8125rem] font-medium text-foreground">
                        {row.label}
                      </p>
                      <p className="tabular truncate text-[0.6875rem] text-subtle">
                        {formatCurrency(row.price)} · {row.caption}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <IconButton
                      size="xs"
                      shape="circle"
                      variant="secondary"
                      tabIndex={-1}
                      aria-label={`Remove one ${row.label.toLowerCase()}`}
                      disabled={count <= min}
                      onClick={() => setCount(row.id, count - 1)}
                    >
                      <Minus />
                    </IconButton>
                    <span className="tabular w-5 text-center text-sm font-semibold text-foreground">
                      {count}
                    </span>
                    <IconButton
                      size="xs"
                      shape="circle"
                      variant="secondary"
                      tabIndex={-1}
                      aria-label={`Add one ${row.label.toLowerCase()}`}
                      disabled={count >= max}
                      onClick={() => setCount(row.id, count + 1)}
                    >
                      <Plus />
                    </IconButton>
                  </div>
                </div>
              )
            })}
          </div>

          {/* ---------- Price ---------- */}
          <div className="flex items-end justify-between gap-3 border-t border-line-subtle pt-3">
            <div className="min-w-0 leading-tight">
              <p className="tabular truncate text-[0.6875rem] text-muted">
                {adults} × {formatCurrency(ADULT_PRICE)}
                {children > 0 ? ` · ${children} × ${formatCurrency(CHILD_PRICE)}` : ''}
              </p>
              <p className="text-[0.6875rem] text-subtle">Taxes and fees included</p>
            </div>
            <p className="font-display text-xl font-semibold leading-none tracking-[-0.03em] text-foreground">
              {reducedMotion ? (
                <span className="tabular">{totalLabel}</span>
              ) : (
                <motion.span
                  key={total}
                  className="tabular inline-block"
                  initial={{ y: -7, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: DURATION.quick, ease: EASE_OUT_EXPO }}
                >
                  {totalLabel}
                </motion.span>
              )}
            </p>
          </div>

          {/* ---------- Actions ---------- */}
          <div className="space-y-2">
            <Button size="lg" fullWidth tabIndex={-1} className="rounded-xl">
              Reserve — {totalLabel}
            </Button>

            <button
              type="button"
              tabIndex={-1}
              className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground text-background transition-opacity duration-200 ease-[var(--ease-out-expo)] hover:opacity-90"
            >
              <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" focusable="false">
                <path d="M11.29 8.46c0-1.4 1.14-2.07 1.19-2.1-.65-.95-1.66-1.08-2.02-1.09-.86-.09-1.68.5-2.11.5-.44 0-1.11-.49-1.82-.48-.94.01-1.8.54-2.29 1.38-.97 1.69-.25 4.19.7 5.56.46.67 1.02 1.42 1.75 1.39.7-.03.97-.45 1.82-.45.85 0 1.09.45 1.83.44.76-.01 1.24-.68 1.7-1.35.54-.78.76-1.53.77-1.57-.02-.01-1.48-.57-1.52-2.23ZM9.9 4.35c.38-.46.64-1.1.57-1.74-.55.02-1.22.37-1.61.83-.35.4-.66 1.05-.58 1.67.61.05 1.24-.31 1.62-.76Z" />
              </svg>
              <span className="text-[0.9375rem] font-medium tracking-[-0.01em]">Pay</span>
            </button>
          </div>

          <p className="flex items-center justify-center gap-1.5 text-[0.6875rem] text-subtle">
            <ShieldCheck className="size-3.5 text-success" />
            Free cancellation up to 24 hours before
          </p>
        </div>
      </div>
    </figure>
  )
}
