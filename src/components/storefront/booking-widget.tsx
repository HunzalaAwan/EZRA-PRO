'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Info,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react'

import {
  cn,
  clamp,
  formatCurrency,
  formatTime,
  fromDateKey,
  pluralize,
} from '@/lib/utils'
import type { Activity, CurrencyCode, DepartureStatus, VerticalKey } from '@/types'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { IconButton } from '@/components/ui/icon-button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { TrustSeal } from '@/components/storefront/trust-bar'

/* ==========================================================================
   AVAILABILITY CONTRACT

   The server flattens `getStorefrontAvailability()` into these plain shapes so
   the widget never pulls the demo module — and therefore the 4,800-line data
   seam — into the client bundle.
   ========================================================================== */

export interface AvailabilitySlot {
  departureId: string
  /** Local ISO, "YYYY-MM-DDTHH:mm:ss". */
  startsAt: string
  endsAt: string
  capacity: number
  seatsLeft: number
  status: DepartureStatus
  /** Dynamic-pricing multiplier for this departure; 1 when none applies. */
  priceMultiplier: number
  /** Lead-tier price after the multiplier, minor units. */
  leadPrice: number
  soldOut: boolean
}

export interface AvailabilityDay {
  /** "YYYY-MM-DD" — matches `toDateKey()`. */
  dateKey: string
  slots: AvailabilitySlot[]
  /** Cheapest lead price across the day's slots; 0 when nothing runs. */
  fromPrice: number
  seatsLeft: number
  soldOut: boolean
}

/* ==========================================================================
   PRICING

   Mirrors the maths in `@/lib/demo` so a quote produced here reconciles with
   the bookings the operator sees in the dashboard: 6% booking fee on the net,
   then card processing at cost on top.
   ========================================================================== */

export const BOOKING_FEE_RATE = 0.06

/** Card processing, passed through at cost: what Stripe charges on a card payment. */
export const PROCESSING_FEE = { rate: 0.025, label: 'Card processing (2.5%)' } as const

/** Kept for callers that looked fees up by tenant; every tenant now carries the same processing line. */
export const TAX_BY_TENANT: Record<string, { rate: number; label: string }> = {
  'blue-horizon': PROCESSING_FEE,
  'coral-cay': PROCESSING_FEE,
  saltline: PROCESSING_FEE,
  ridgeline: PROCESSING_FEE,
}

/** One plain label everywhere; the harbour levies and service charges are folded into it. */
const FEE_LABEL: Partial<Record<VerticalKey, string>> = {}

export interface QuoteSelection {
  tiers: { tierId: string; qty: number }[]
  addOns: { addOnId: string; qty: number }[]
}

export interface QuoteLine {
  id: string
  label: string
  kind: 'ticket' | 'addon' | 'fee' | 'tax'
  quantity: number
  unitPrice: number
  total: number
}

export interface Quote {
  ticketLines: QuoteLine[]
  addOnLines: QuoteLine[]
  subtotal: number
  feeTotal: number
  feeLabel: string
  taxTotal: number
  taxLabel: string
  total: number
  /** Tickets that consume a seat. */
  seats: number
  /** Every ticket, including comp/ride-along tiers. */
  headcount: number
}

/** Deterministic, integer-only money maths — minor units in, minor units out. */
export function buildQuote(
  activity: Activity,
  tenantSlug: string,
  selection: QuoteSelection,
  priceMultiplier = 1,
): Quote {
  const tax = TAX_BY_TENANT[tenantSlug] ?? PROCESSING_FEE
  const ticketLines: QuoteLine[] = []
  let seats = 0
  let headcount = 0
  let subtotal = 0

  for (const tier of activity.priceTiers) {
    const qty = selection.tiers.find((t) => t.tierId === tier.id)?.qty ?? 0
    if (qty <= 0) continue
    const unitPrice = Math.round(tier.price * priceMultiplier)
    const total = unitPrice * qty
    ticketLines.push({
      id: tier.id,
      label: tier.label,
      kind: 'ticket',
      quantity: qty,
      unitPrice,
      total,
    })
    subtotal += total
    headcount += qty
    if (tier.countsTowardCapacity) seats += qty
  }

  const addOnLines: QuoteLine[] = []
  for (const addOn of activity.addOns) {
    const qty = selection.addOns.find((a) => a.addOnId === addOn.id)?.qty ?? 0
    if (qty <= 0) continue
    const total = addOn.price * qty
    addOnLines.push({
      id: addOn.id,
      label: addOn.label,
      kind: 'addon',
      quantity: qty,
      unitPrice: addOn.price,
      total,
    })
    subtotal += total
  }

  const feeTotal = Math.round(subtotal * BOOKING_FEE_RATE)
  const taxTotal = Math.round(subtotal * tax.rate)

  return {
    ticketLines,
    addOnLines,
    subtotal,
    feeTotal,
    feeLabel: FEE_LABEL[activity.category] ?? 'Booking fee',
    taxTotal,
    taxLabel: tax.label,
    total: subtotal + feeTotal + taxTotal,
    seats,
    headcount,
  }
}

/** The canonical checkout URL for a selection. Parsed back by the checkout page. */
export function checkoutHref(
  checkoutPath: string,
  activitySlug: string,
  departureId: string,
  selection: QuoteSelection,
) {
  const params = new URLSearchParams()
  params.set('activity', activitySlug)
  params.set('d', departureId)
  const tiers = selection.tiers.filter((t) => t.qty > 0)
  if (tiers.length > 0) params.set('t', tiers.map((t) => `${t.tierId}:${t.qty}`).join('|'))
  const addOns = selection.addOns.filter((a) => a.qty > 0)
  if (addOns.length > 0) params.set('a', addOns.map((a) => `${a.addOnId}:${a.qty}`).join('|'))
  return `${checkoutPath}?${params.toString()}`
}

/* ==========================================================================
   <BookingWidget>
   ========================================================================== */

export interface BookingWidgetProps {
  activity: Activity
  tenantSlug: string
  currency: CurrencyCode
  days: AvailabilityDay[]
  checkoutPath: string
  initialDateKey?: string
  initialGuests?: number
  /** `sheet` drops the card chrome for the mobile bottom sheet. */
  variant?: 'rail' | 'sheet'
  className?: string
}

export function BookingWidget({
  activity,
  tenantSlug,
  currency,
  days,
  checkoutPath,
  initialDateKey,
  initialGuests,
  variant = 'rail',
  className,
}: BookingWidgetProps) {
  const router = useRouter()
  const reducedMotion = useReducedMotionSafe()
  const stripRef = React.useRef<HTMLDivElement>(null)

  const bookableDays = React.useMemo(() => days.filter((d) => !d.soldOut && d.slots.length > 0), [days])

  const [dateKey, setDateKey] = React.useState<string>(() => {
    const requested = initialDateKey && days.find((d) => d.dateKey === initialDateKey)
    if (requested && !requested.soldOut && requested.slots.length > 0) return requested.dateKey
    return bookableDays[0]?.dateKey ?? days[0]?.dateKey ?? ''
  })

  const day = days.find((d) => d.dateKey === dateKey)
  const openSlots = React.useMemo(
    () => (day?.slots ?? []).filter((s) => !s.soldOut),
    [day],
  )

  const [departureId, setDepartureId] = React.useState<string>(
    () => openSlots[0]?.departureId ?? day?.slots[0]?.departureId ?? '',
  )

  // Keep the time selection valid whenever the day changes.
  React.useEffect(() => {
    const stillValid = openSlots.some((s) => s.departureId === departureId)
    if (!stillValid) setDepartureId(openSlots[0]?.departureId ?? '')
  }, [openSlots, departureId])

  const slot = day?.slots.find((s) => s.departureId === departureId)

  /* ---------- tier quantities ---------- */

  const [tierQty, setTierQty] = React.useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {}
    activity.priceTiers.forEach((tier, index) => {
      if (index === 0) {
        const wanted = initialGuests ?? Math.max(tier.minQuantity, 2)
        seed[tier.id] = clamp(wanted, Math.max(tier.minQuantity, 1), tier.maxQuantity)
      } else {
        seed[tier.id] = tier.minQuantity
      }
    })
    return seed
  })

  const [addOnOn, setAddOnOn] = React.useState<Record<string, boolean>>(() => {
    const seed: Record<string, boolean> = {}
    for (const addOn of activity.addOns) seed[addOn.id] = addOn.required
    return seed
  })

  const seatsUsed = activity.priceTiers.reduce(
    (total, tier) => total + (tier.countsTowardCapacity ? (tierQty[tier.id] ?? 0) : 0),
    0,
  )
  const headcount = activity.priceTiers.reduce((total, tier) => total + (tierQty[tier.id] ?? 0), 0)
  const seatsLeft = slot?.seatsLeft ?? 0
  const overCapacity = slot ? seatsUsed > seatsLeft : false

  const selection: QuoteSelection = React.useMemo(
    () => ({
      tiers: activity.priceTiers.map((tier) => ({ tierId: tier.id, qty: tierQty[tier.id] ?? 0 })),
      addOns: activity.addOns.map((addOn) => ({
        addOnId: addOn.id,
        qty: addOnOn[addOn.id]
          ? clamp(Math.max(1, headcount), 1, addOn.maxPerBooking ?? Math.max(1, headcount))
          : 0,
      })),
    }),
    [activity.priceTiers, activity.addOns, tierQty, addOnOn, headcount],
  )

  const quote = React.useMemo(
    () => buildQuote(activity, tenantSlug, selection, slot?.priceMultiplier ?? 1),
    [activity, tenantSlug, selection, slot],
  )

  const canReserve =
    Boolean(slot) && !overCapacity && seatsUsed >= Math.max(1, activity.minParticipants)

  const reserve = () => {
    if (!slot || !canReserve) return
    router.push(checkoutHref(checkoutPath, activity.slug, slot.departureId, selection))
  }

  const scrollStrip = (direction: 1 | -1) => {
    stripRef.current?.scrollBy({ left: direction * 264, behavior: reducedMotion ? 'auto' : 'smooth' })
  }

  const fromPrice = Math.min(
    ...[activity.basePrice, ...bookableDays.map((d) => d.fromPrice).filter((p) => p > 0)],
  )

  const shell =
    variant === 'rail'
      ? 'rounded-2xl border border-line bg-surface shadow-xl'
      : 'rounded-none border-0 bg-transparent shadow-none'

  return (
    <section
      aria-label={`Book ${activity.name}`}
      className={cn('flex flex-col overflow-hidden', shell, className)}
    >
      {/* ---------- price header ---------- */}
      <header
        className={cn(
          'flex items-end justify-between gap-4 border-b border-line-subtle px-5 py-4',
          variant === 'rail' &&
            'bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_9%,var(--surface)),var(--surface))]',
        )}
      >
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
            From
          </p>
          <p className="mt-0.5 font-display text-2xl font-semibold tabular tracking-tight text-foreground">
            {formatCurrency(fromPrice, currency)}
            <span className="ml-1.5 text-xs font-medium text-subtle">per person</span>
          </p>
        </div>
        {slot && slot.priceMultiplier > 1 ? (
          <SimpleTooltip label="This departure is in high demand, so pricing has stepped up.">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-[0.6875rem] font-semibold text-warning">
              <Sparkles className="size-3" aria-hidden="true" />
              Peak time
            </span>
          </SimpleTooltip>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[0.6875rem] font-semibold text-success">
            <ShieldCheck className="size-3" aria-hidden="true" />
            Free cancellation
          </span>
        )}
      </header>

      <div className="flex flex-col gap-6 px-5 py-5">
        {/* ---------- date strip ---------- */}
        <div>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">
              1 · Choose a date
            </h3>
            <div className="flex items-center gap-1">
              <IconButton
                aria-label="Earlier dates"
                size="xs"
                variant="ghost"
                onClick={() => scrollStrip(-1)}
              >
                <ChevronLeft aria-hidden="true" />
              </IconButton>
              <IconButton
                aria-label="Later dates"
                size="xs"
                variant="ghost"
                onClick={() => scrollStrip(1)}
              >
                <ChevronRight aria-hidden="true" />
              </IconButton>
            </div>
          </div>

          <div
            ref={stripRef}
            className="no-scrollbar -mx-1 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-1 pb-1"
            role="group"
            aria-label="Available dates"
          >
            {days.map((entry) => (
              <DateChip
                key={entry.dateKey}
                day={entry}
                currency={currency}
                selected={entry.dateKey === dateKey}
                onSelect={() => setDateKey(entry.dateKey)}
              />
            ))}
          </div>
        </div>

        {/* ---------- time slots ---------- */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">
              2 · Choose a time
            </h3>
            {day && day.slots.length > 0 ? (
              <span className="text-xs text-subtle">
                {day.slots.length} {pluralize(day.slots.length, 'departure')}
              </span>
            ) : null}
          </div>

          {day && day.slots.length > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {day.slots.map((entry) => (
                <TimeChip
                  key={entry.departureId}
                  slot={entry}
                  selected={entry.departureId === departureId}
                  onSelect={() => setDepartureId(entry.departureId)}
                />
              ))}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-line-strong bg-surface-sunken px-4 py-5 text-center text-sm text-muted">
              Nothing scheduled on this date. Pick another day, or call us and we will look at
              putting a private departure on.
            </p>
          )}
        </div>

        {/* ---------- tickets ---------- */}
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">
              3 · Who is coming
            </h3>
            {slot ? (
              <span
                className={cn(
                  'text-xs font-medium tabular',
                  seatsLeft <= 4 ? 'text-warning' : 'text-subtle',
                )}
              >
                {seatsLeft} {pluralize(seatsLeft, 'seat')} left
              </span>
            ) : null}
          </div>

          <div className="mt-3 divide-y divide-line-subtle rounded-xl border border-line">
            {activity.priceTiers.map((tier) => {
              const qty = tierQty[tier.id] ?? 0
              const unit = Math.round(tier.price * (slot?.priceMultiplier ?? 1))
              const seatRoom = tier.countsTowardCapacity
                ? seatsLeft - (seatsUsed - qty)
                : tier.maxQuantity
              const max = Math.min(tier.maxQuantity, Math.max(0, seatRoom))

              return (
                <div key={tier.id} className="flex items-center gap-3 px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{tier.label}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-subtle">
                      <span className="tabular font-medium text-muted">
                        {formatCurrency(unit, currency)}
                      </span>
                      {tier.description ? <span className="truncate">· {tier.description}</span> : null}
                      {!tier.countsTowardCapacity ? (
                        <span className="text-faint">· does not use a seat</span>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <IconButton
                      aria-label={`Remove one ${tier.label}`}
                      size="xs"
                      variant="outline"
                      shape="circle"
                      disabled={qty <= tier.minQuantity}
                      onClick={() =>
                        setTierQty((prev) => ({
                          ...prev,
                          [tier.id]: Math.max(tier.minQuantity, (prev[tier.id] ?? 0) - 1),
                        }))
                      }
                    >
                      <Minus aria-hidden="true" />
                    </IconButton>
                    <span
                      className={cn(
                        'w-7 text-center text-sm font-semibold tabular',
                        qty === 0 ? 'text-faint' : 'text-foreground',
                      )}
                    >
                      {qty}
                    </span>
                    <IconButton
                      aria-label={`Add one ${tier.label}`}
                      size="xs"
                      variant="outline"
                      shape="circle"
                      disabled={qty >= max}
                      onClick={() =>
                        setTierQty((prev) => ({
                          ...prev,
                          [tier.id]: Math.min(max, (prev[tier.id] ?? 0) + 1),
                        }))
                      }
                    >
                      <Plus aria-hidden="true" />
                    </IconButton>
                  </div>
                </div>
              )
            })}
          </div>

          <AnimatePresence initial={false}>
            {overCapacity ? (
              <motion.p
                initial={reducedMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 flex items-center gap-2 overflow-hidden text-xs font-medium text-danger"
              >
                <CircleAlert className="size-3.5 shrink-0" aria-hidden="true" />
                Only {seatsLeft} {pluralize(seatsLeft, 'seat')} left on this departure.
              </motion.p>
            ) : null}
          </AnimatePresence>

          {activity.minParticipants > 1 ? (
            <p className="mt-2 flex items-center gap-2 text-xs text-subtle">
              <Users className="size-3.5 shrink-0" aria-hidden="true" />
              Minimum {activity.minParticipants} guests for this experience.
            </p>
          ) : null}
        </div>

        {/* ---------- add-ons ---------- */}
        {activity.addOns.length > 0 ? (
          <div>
            <h3 className="text-[0.8125rem] font-semibold tracking-tight text-foreground">
              4 · Make it better
            </h3>
            <div className="mt-3 space-y-2">
              {activity.addOns.map((addOn) => {
                const checked = Boolean(addOnOn[addOn.id])
                const qty = clamp(
                  Math.max(1, headcount),
                  1,
                  addOn.maxPerBooking ?? Math.max(1, headcount),
                )
                const id = `addon-${addOn.id}`
                return (
                  <label
                    key={addOn.id}
                    htmlFor={id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-all duration-200 ease-[var(--ease-out-expo)]',
                      checked
                        ? 'border-primary bg-primary-soft/60 shadow-xs'
                        : 'border-line bg-surface hover:border-line-strong',
                    )}
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(value) =>
                        setAddOnOn((prev) => ({ ...prev, [addOn.id]: value === true }))
                      }
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">{addOn.label}</span>
                        <span className="shrink-0 text-sm font-semibold tabular text-foreground">
                          {formatCurrency(addOn.price, currency)}
                          {checked && qty > 1 ? (
                            <span className="ml-1 text-xs font-medium text-subtle">× {qty}</span>
                          ) : null}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-subtle">
                        {addOn.description}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ) : null}

        {/* ---------- breakdown ---------- */}
        <div className="rounded-xl bg-surface-sunken p-4">
          <ul className="space-y-2 text-sm">
            <AnimatePresence initial={false} mode="popLayout">
              {[...quote.ticketLines, ...quote.addOnLines].map((line) => (
                <motion.li
                  key={line.id}
                  layout={!reducedMotion}
                  initial={reducedMotion ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="min-w-0 truncate text-muted">
                    {line.label}
                    <span className="ml-1.5 text-xs text-faint">
                      {line.quantity} × {formatCurrency(line.unitPrice, currency)}
                    </span>
                  </span>
                  <span className="shrink-0 tabular font-medium text-foreground">
                    {formatCurrency(line.total, currency)}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>

            {quote.ticketLines.length === 0 ? (
              <li className="text-sm text-subtle">Add a guest to see your total.</li>
            ) : null}
          </ul>

          <div className="mt-3 space-y-2 border-t border-line pt-3 text-xs">
            <div className="flex items-baseline justify-between gap-3 text-muted">
              <span className="inline-flex items-center gap-1.5">
                {quote.feeLabel}
                <SimpleTooltip label="Covers card processing, ticketing and the harbour or site access levy.">
                  <button
                    type="button"
                    aria-label="What is this fee?"
                    className="inline-grid place-items-center rounded-full text-faint transition-colors hover:text-muted focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Info className="size-3" aria-hidden="true" />
                  </button>
                </SimpleTooltip>
              </span>
              <span className="tabular">{formatCurrency(quote.feeTotal, currency)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 text-muted">
              <span>{quote.taxLabel}</span>
              <span className="tabular">{formatCurrency(quote.taxTotal, currency)}</span>
            </div>
          </div>

          <div className="mt-3 flex items-end justify-between gap-3 border-t border-line pt-3">
            <div>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
                Total
              </p>
              <p className="text-xs text-subtle">
                {quote.headcount} {pluralize(quote.headcount, 'guest')} · all taxes included
              </p>
            </div>
            <AnimatedTotal value={quote.total} currency={currency} reducedMotion={reducedMotion} />
          </div>
        </div>

        {/* ---------- reserve ---------- */}
        <div className="space-y-3">
          <Button
            size="lg"
            fullWidth
            onClick={reserve}
            disabled={!canReserve}
            className="h-12 text-[0.9375rem]"
          >
            {slot ? 'Reserve now' : 'Choose a departure'}
          </Button>
          <TrustSeal freeCancellationHours={activity.cancellationPolicy.freeCancellationHours} />
          <p className="text-center text-[0.6875rem] text-faint">
            You will not be charged until the final step.
          </p>
        </div>
      </div>
    </section>
  )
}

/* ==========================================================================
   PARTS
   ========================================================================== */

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function DateChip({
  day,
  currency,
  selected,
  onSelect,
}: {
  day: AvailabilityDay
  currency: CurrencyCode
  selected: boolean
  onSelect: () => void
}) {
  const date = fromDateKey(day.dateKey)
  const unavailable = day.slots.length === 0 || day.soldOut

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={unavailable}
      aria-pressed={selected}
      className={cn(
        'group flex w-[4.75rem] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5',
        'transition-all duration-200 ease-[var(--ease-out-expo)]',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected
          ? 'border-primary bg-primary text-on-primary shadow-md'
          : unavailable
            ? 'cursor-not-allowed border-line-subtle bg-surface-sunken text-faint'
            : 'border-line bg-surface text-foreground hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm',
      )}
    >
      <span
        className={cn(
          'text-[0.625rem] font-semibold uppercase tracking-[0.1em]',
          selected ? 'text-on-primary/75' : unavailable ? 'text-faint' : 'text-subtle',
        )}
      >
        {WEEKDAY[date.getDay()]}
      </span>
      <span className="font-display text-lg font-semibold leading-none tabular">
        {date.getDate()}
      </span>
      <span
        className={cn(
          'text-[0.625rem] font-medium',
          selected ? 'text-on-primary/70' : 'text-faint',
        )}
      >
        {MONTH[date.getMonth()]}
      </span>
      <span
        className={cn(
          'mt-1 w-full truncate rounded-md px-1 py-0.5 text-center text-[0.625rem] font-semibold tabular',
          selected
            ? 'bg-white/18 text-on-primary'
            : unavailable
              ? 'text-faint'
              : 'bg-surface-sunken text-muted',
        )}
      >
        {day.slots.length === 0
          ? 'No trips'
          : day.soldOut
            ? 'Sold out'
            : formatCurrency(day.fromPrice, currency, { compact: true })}
      </span>
    </button>
  )
}

function TimeChip({
  slot,
  selected,
  onSelect,
}: {
  slot: AvailabilitySlot
  selected: boolean
  onSelect: () => void
}) {
  const urgent = !slot.soldOut && slot.seatsLeft <= 3
  const filling = !slot.soldOut && !urgent && slot.seatsLeft <= 6

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={slot.soldOut}
      aria-pressed={selected}
      className={cn(
        'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left',
        'transition-all duration-200 ease-[var(--ease-out-expo)]',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected
          ? 'border-primary bg-primary text-on-primary shadow-md'
          : slot.soldOut
            ? 'cursor-not-allowed border-line-subtle bg-surface-sunken text-faint line-through decoration-line-strong'
            : 'border-line bg-surface text-foreground hover:border-primary/50 hover:shadow-sm',
      )}
    >
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold tabular">
        <Clock
          className={cn('size-3.5', selected ? 'text-on-primary/70' : 'text-faint')}
          aria-hidden="true"
        />
        {formatTime(slot.startsAt)}
      </span>
      <span
        className={cn(
          'text-[0.6875rem] font-medium',
          selected
            ? 'text-on-primary/75'
            : slot.soldOut
              ? 'text-faint no-underline'
              : urgent
                ? 'text-danger'
                : filling
                  ? 'text-warning'
                  : 'text-subtle',
        )}
      >
        {slot.soldOut
          ? 'Sold out'
          : urgent
            ? `Only ${slot.seatsLeft} left`
            : `${slot.seatsLeft} seats`}
      </span>
    </button>
  )
}

function AnimatedTotal({
  value,
  currency,
  reducedMotion,
}: {
  value: number
  currency: CurrencyCode
  reducedMotion: boolean
}) {
  return (
    <span className="relative block overflow-hidden text-right">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={reducedMotion ? false : { y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reducedMotion ? undefined : { y: -14, opacity: 0 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="block font-display text-2xl font-semibold tabular tracking-tight text-foreground"
        >
          {formatCurrency(value, currency, { decimals: true })}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
