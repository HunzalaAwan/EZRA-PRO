'use client'

import * as React from 'react'
import Image from 'next/image'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  CalendarDays,
  Check,
  CircleAlert,
  Clock,
  CreditCard,
  Link2,
  Minus,
  Plus,
  Receipt,
  Search,
  Ship,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { z } from 'zod'

import type { Activity, Customer } from '@/types'
import { CURRENT_TENANT, getActivitiesByTenant } from '@/lib/demo-core'
import type { CalendarEvent } from '@/lib/demo'
import { fetchStorefrontAvailability, searchCustomers } from '@/lib/actions/dashboard'
import {
  cn,
  formatCurrency,
  formatDateShort,
  formatDuration,
  formatTime,
  toDateKey,
} from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { SearchInput } from '@/components/ui/search-input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'

/* ==========================================================================
   THE PHONE-BOOKING FLOW
   Five steps, one dialog. Everything prices live off the real activity tiers
   so the figure the agent reads down the phone is the figure that would be
   charged.
   ========================================================================== */

const STEPS = [
  { id: 'experience', label: 'Experience', icon: Ship },
  { id: 'departure', label: 'Departure', icon: CalendarDays },
  { id: 'tickets', label: 'Tickets', icon: Users },
  { id: 'guest', label: 'Guest', icon: UserPlus },
  { id: 'payment', label: 'Payment', icon: Wallet },
] as const

type StepId = (typeof STEPS)[number]['id']

/** Maui general excise tax — applied to the whole taxable order. */
const TAX_RATE = 0.04166
const FEE_RATE = 0.03

const PAYMENT_METHODS = [
  {
    value: 'card',
    label: 'Card over the phone',
    description: 'Keyed into the virtual terminal, charged immediately.',
    icon: CreditCard,
  },
  {
    value: 'link',
    label: 'Send a payment link',
    description: 'Holds the seats for 24 hours while the guest pays online.',
    icon: Link2,
  },
  {
    value: 'deposit',
    label: 'Deposit now, balance at the dock',
    description: 'Charges 25% today and flags the balance on the manifest.',
    icon: Wallet,
  },
  {
    value: 'cash',
    label: 'Cash on arrival',
    description: 'Nothing captured now — the crew collects before boarding.',
    icon: Banknote,
  },
] as const

type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]['value']

const guestSchema = z.object({
  firstName: z.string().trim().min(2, 'First name is required'),
  lastName: z.string().trim().min(2, 'Last name is required'),
  email: z
    .string()
    .trim()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid email address'),
  phone: z.string().trim().min(7, 'Enter a contact number we can reach on the day'),
  country: z.string().trim().min(2, 'Country is required'),
})

type GuestValues = z.infer<typeof guestSchema>

const EMPTY_GUEST: GuestValues = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  country: '',
}

/* --------------------------------------------------------------------------
   Stepper rail
   -------------------------------------------------------------------------- */

function StepRail({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      {STEPS.map((step, index) => {
        const Icon = step.icon
        const done = index < current
        const active = index === current
        return (
          <li key={step.id} className="flex shrink-0 items-center gap-1.5">
            <span
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium',
                'transition-colors duration-300 ease-[var(--ease-out-expo)]',
                active
                  ? 'border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-primary-soft text-primary'
                  : done
                    ? 'border-[color-mix(in_oklab,var(--success)_32%,transparent)] bg-success-soft text-success'
                    : 'border-line bg-surface-sunken text-faint',
              )}
              aria-current={active ? 'step' : undefined}
            >
              {done ? (
                <Check aria-hidden="true" className="size-3.5" />
              ) : (
                <Icon aria-hidden="true" className="size-3.5" />
              )}
              <span className={cn(!active && 'hidden sm:inline')}>{step.label}</span>
            </span>
            {index < STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className={cn(
                  'h-px w-3 shrink-0 sm:w-5',
                  index < current ? 'bg-success' : 'bg-line',
                )}
              />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/* --------------------------------------------------------------------------
   Quantity stepper
   -------------------------------------------------------------------------- */

function Stepper({
  value,
  min,
  max,
  onChange,
  label,
}: {
  value: number
  min: number
  max: number
  onChange: (next: number) => void
  label: string
}) {
  const btn = cn(
    'grid size-8 place-items-center rounded-lg border border-line bg-surface text-foreground',
    'transition-[background-color,border-color,transform] duration-150',
    'hover:border-line-strong hover:bg-surface-sunken active:scale-[0.92]',
    'disabled:pointer-events-none disabled:opacity-40',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
  )

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Remove one ${label}`}
      >
        <Minus aria-hidden="true" className="size-4" />
      </button>
      <span
        aria-live="polite"
        className="w-7 text-center text-sm font-semibold text-foreground tabular-nums"
      >
        {value}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Add one ${label}`}
      >
        <Plus aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}

/* ==========================================================================
   DIALOG
   ========================================================================== */

export interface NewBookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NewBookingDialog({ open, onOpenChange }: NewBookingDialogProps) {
  const reduceMotion = useReducedMotion()
  const currency = CURRENT_TENANT.currency

  const activities = React.useMemo(
    () => getActivitiesByTenant(CURRENT_TENANT.id).filter((a) => a.status === 'live'),
    [],
  )

  const [stepIndex, setStepIndex] = React.useState(0)
  const [activityQuery, setActivityQuery] = React.useState('')
  const [activityId, setActivityId] = React.useState<string | null>(null)
  const [departureId, setDepartureId] = React.useState<string | null>(null)
  const [dayKey, setDayKey] = React.useState<string | null>(null)
  const [tierQty, setTierQty] = React.useState<Record<string, number>>({})
  const [addOnQty, setAddOnQty] = React.useState<Record<string, number>>({})
  const [guestQuery, setGuestQuery] = React.useState('')
  const [existingGuest, setExistingGuest] = React.useState<Customer | null>(null)
  const [guest, setGuest] = React.useState<GuestValues>(EMPTY_GUEST)
  const [guestErrors, setGuestErrors] = React.useState<Partial<Record<keyof GuestValues, string>>>({})
  const [method, setMethod] = React.useState<PaymentMethodValue>('card')
  const [orderNote, setOrderNote] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)

  const reset = React.useCallback(() => {
    setStepIndex(0)
    setActivityQuery('')
    setActivityId(null)
    setDepartureId(null)
    setDayKey(null)
    setTierQty({})
    setAddOnQty({})
    setGuestQuery('')
    setExistingGuest(null)
    setGuest(EMPTY_GUEST)
    setGuestErrors({})
    setMethod('card')
    setOrderNote('')
    setSubmitting(false)
  }, [])

  const activity: Activity | null = React.useMemo(
    () => activities.find((a) => a.id === activityId) ?? null,
    [activities, activityId],
  )

  // Availability and guest search go through Server Actions — this dialog is
  // mounted inside the always-present command palette, so it must never pull
  // the dataset module into the shell's client bundle.
  const [availability, setAvailability] = React.useState<CalendarEvent[]>([])
  React.useEffect(() => {
    if (!activityId) {
      setAvailability([])
      return
    }
    let cancelled = false
    fetchStorefrontAvailability(activityId, 45).then((events) => {
      if (!cancelled) setAvailability(events.filter((e) => e.seatsLeft > 0))
    })
    return () => {
      cancelled = true
    }
  }, [activityId])

  const days = React.useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of availability) {
      const key = toDateKey(event.departure.startsAt)
      const list = map.get(key)
      if (list) list.push(event)
      else map.set(key, [event])
    }
    return Array.from(map.entries()).slice(0, 21)
  }, [availability])

  const selectedEvent = React.useMemo(
    () => availability.find((e) => e.departure.id === departureId) ?? null,
    [availability, departureId],
  )

  const filteredActivities = React.useMemo(() => {
    const q = activityQuery.trim().toLowerCase()
    if (!q) return activities
    return activities.filter(
      (a) => a.name.toLowerCase().includes(q) || a.tagline.toLowerCase().includes(q),
    )
  }, [activities, activityQuery])

  const [guestMatches, setGuestMatches] = React.useState<Customer[]>([])
  React.useEffect(() => {
    const q = guestQuery.trim()
    if (q.length < 2) {
      setGuestMatches([])
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      searchCustomers(CURRENT_TENANT.id, q).then((matches) => {
        if (!cancelled) setGuestMatches(matches)
      })
    }, 150)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [guestQuery])

  /* ----------------------------------------------------------------------
     Pricing — recomputed on every keystroke of the stepper
     ---------------------------------------------------------------------- */
  const pricing = React.useMemo(() => {
    if (!activity) {
      return { lines: [], seats: 0, subtotal: 0, fee: 0, tax: 0, total: 0 }
    }

    const lines: { id: string; label: string; qty: number; unit: number; total: number }[] = []
    let seats = 0
    let subtotal = 0

    for (const tier of activity.priceTiers) {
      const qty = tierQty[tier.id] ?? 0
      if (qty <= 0) continue
      const total = qty * tier.price
      subtotal += total
      if (tier.countsTowardCapacity) seats += qty
      lines.push({ id: tier.id, label: tier.label, qty, unit: tier.price, total })
    }

    for (const addOn of activity.addOns) {
      const qty = addOnQty[addOn.id] ?? 0
      if (qty <= 0) continue
      const total = qty * addOn.price
      subtotal += total
      lines.push({ id: addOn.id, label: addOn.label, qty, unit: addOn.price, total })
    }

    const fee = Math.round(subtotal * FEE_RATE)
    const tax = Math.round((subtotal + fee) * TAX_RATE)
    return { lines, seats, subtotal, fee, tax, total: subtotal + fee + tax }
  }, [activity, addOnQty, tierQty])

  const seatsLeft = selectedEvent?.seatsLeft ?? 0
  const overCapacity = pricing.seats > seatsLeft

  /* ----------------------------------------------------------------------
     Step gating
     ---------------------------------------------------------------------- */
  const step: StepId = STEPS[stepIndex].id

  const canAdvance = (() => {
    switch (step) {
      case 'experience':
        return Boolean(activityId)
      case 'departure':
        return Boolean(departureId)
      case 'tickets':
        return pricing.seats > 0 && !overCapacity
      case 'guest':
        return Boolean(existingGuest) || guestSchema.safeParse(guest).success
      case 'payment':
        return true
    }
  })()

  const goNext = () => {
    if (step === 'guest' && !existingGuest) {
      const parsed = guestSchema.safeParse(guest)
      if (!parsed.success) {
        const next: Partial<Record<keyof GuestValues, string>> = {}
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as keyof GuestValues
          if (key && !next[key]) next[key] = issue.message
        }
        setGuestErrors(next)
        return
      }
      setGuestErrors({})
    }
    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))
  }

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1))

  const submit = () => {
    if (!activity || !selectedEvent) return
    setSubmitting(true)
    const name = existingGuest
      ? `${existingGuest.firstName} ${existingGuest.lastName}`
      : `${guest.firstName} ${guest.lastName}`

    window.setTimeout(() => {
      setSubmitting(false)
      onOpenChange(false)
      toast.success(`Reservation confirmed for ${name}`, {
        description: `${pricing.seats} ${pricing.seats === 1 ? 'seat' : 'seats'} on ${
          activity.name
        } · ${formatDateShort(selectedEvent.departure.startsAt)} ${formatTime(
          selectedEvent.departure.startsAt,
        )} · ${formatCurrency(pricing.total, currency)}`,
      })
      reset()
    }, 650)
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) window.setTimeout(reset, 220)
  }

  /* ----------------------------------------------------------------------
     Render
     ---------------------------------------------------------------------- */
  const slide = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: 18 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -18 },
      }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="xl" className="max-h-[min(46rem,calc(100dvh-2rem))]">
        <DialogHeader divider>
          <DialogTitle>New reservation</DialogTitle>
          <DialogDescription>
            Take a booking over the phone or at the desk — seats are held the moment you confirm.
          </DialogDescription>
          <div className="pt-3">
            <StepRail current={stepIndex} />
          </div>
        </DialogHeader>

        <DialogBody className="py-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={slide.initial}
              animate={slide.animate}
              exit={slide.exit}
              transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* ============================= EXPERIENCE ============================= */}
              {step === 'experience' ? (
                <div className="flex flex-col gap-3">
                  <SearchInput
                    value={activityQuery}
                    onValueChange={setActivityQuery}
                    debounceMs={0}
                    label="Search experiences"
                    placeholder="Search the catalogue…"
                    shortcut={false}
                  />
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {filteredActivities.map((item) => {
                      const media = item.media.find((m) => m.isPrimary) ?? item.media[0]
                      const active = item.id === activityId
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActivityId(item.id)
                            setDepartureId(null)
                            setDayKey(null)
                            setTierQty({})
                            setAddOnQty({})
                          }}
                          aria-pressed={active}
                          className={cn(
                            'flex items-center gap-3 rounded-xl border p-2.5 text-left',
                            'transition-[border-color,box-shadow,background-color,transform] duration-200 ease-[var(--ease-out-expo)]',
                            'hover:-translate-y-px hover:shadow-md motion-reduce:hover:translate-y-0',
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                            active
                              ? 'border-primary bg-primary-soft/40 shadow-sm'
                              : 'border-line bg-surface',
                          )}
                        >
                          {media ? (
                            <span className="relative size-14 shrink-0 overflow-hidden rounded-lg">
                              <Image
                                src={media.url}
                                alt={media.alt}
                                width={112}
                                height={112}
                                className="size-full object-cover"
                              />
                            </span>
                          ) : null}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.8125rem] font-semibold text-foreground">
                              {item.name}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-subtle">
                              {item.tagline}
                            </span>
                            <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                              <span className="inline-flex items-center gap-1">
                                <Clock aria-hidden="true" className="size-3" />
                                {formatDuration(item.durationMinutes)}
                              </span>
                              <span className="font-semibold text-foreground tabular-nums">
                                from {formatCurrency(item.basePrice, currency)}
                              </span>
                            </span>
                          </span>
                          {active ? (
                            <Check aria-hidden="true" className="size-4 shrink-0 text-primary" />
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}

              {/* ============================= DEPARTURE ============================= */}
              {step === 'departure' && activity ? (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 rounded-xl bg-surface-sunken px-3 py-2.5">
                    <Ship aria-hidden="true" className="size-4 shrink-0 text-subtle" />
                    <span className="truncate text-[0.8125rem] font-medium text-foreground">
                      {activity.name}
                    </span>
                    <Badge variant="neutral" size="sm" className="ml-auto">
                      {availability.length} departures open
                    </Badge>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">
                      Pick a day
                    </p>
                    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar">
                      {days.map(([key, events]) => {
                        const date = new Date(`${key}T12:00:00`)
                        const active = key === dayKey
                        const seats = events.reduce((sum, e) => sum + e.seatsLeft, 0)
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              setDayKey(key)
                              setDepartureId(null)
                            }}
                            aria-pressed={active}
                            className={cn(
                              'flex w-[4.5rem] shrink-0 flex-col items-center gap-0.5 rounded-xl border px-2 py-2.5',
                              'transition-colors duration-200 ease-[var(--ease-out-expo)]',
                              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                              active
                                ? 'border-primary bg-primary-soft text-primary'
                                : 'border-line bg-surface text-foreground hover:bg-surface-sunken',
                            )}
                          >
                            <span className="text-[0.625rem] font-medium tracking-wider uppercase opacity-70">
                              {new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)}
                            </span>
                            <span className="font-display text-base font-semibold tabular-nums">
                              {date.getDate()}
                            </span>
                            <span className="text-[0.625rem] tabular-nums opacity-70">
                              {seats} left
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">
                      Pick a time
                    </p>
                    {dayKey ? (
                      <RadioGroup
                        value={departureId ?? ''}
                        onValueChange={setDepartureId}
                        className="gap-2 sm:grid-cols-2"
                        aria-label="Departure time"
                      >
                        {(days.find(([key]) => key === dayKey)?.[1] ?? []).map((event) => (
                          <RadioGroupCard
                            key={event.departure.id}
                            value={event.departure.id}
                            label={
                              <span className="font-semibold tabular-nums">
                                {formatTime(event.departure.startsAt)}
                              </span>
                            }
                            description={`${event.seatsLeft} of ${event.departure.capacity} seats left · ${Math.round(
                              event.fillRate,
                            )}% sold`}
                            trailing={
                              <Badge
                                variant={
                                  event.seatsLeft <= 3
                                    ? 'danger'
                                    : event.fillRate >= 70
                                      ? 'warning'
                                      : 'success'
                                }
                                size="sm"
                              >
                                {event.seatsLeft <= 3
                                  ? 'Almost gone'
                                  : event.fillRate >= 70
                                    ? 'Filling fast'
                                    : 'Open'}
                              </Badge>
                            }
                            className="p-3"
                          />
                        ))}
                      </RadioGroup>
                    ) : (
                      <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-[0.8125rem] text-subtle">
                        Choose a day above to see its departure times.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}

              {/* ============================= TICKETS ============================= */}
              {step === 'tickets' && activity && selectedEvent ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-sunken px-3 py-2.5 text-[0.8125rem]">
                    <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-subtle" />
                    <span className="font-medium text-foreground tabular-nums">
                      {formatDateShort(selectedEvent.departure.startsAt)} ·{' '}
                      {formatTime(selectedEvent.departure.startsAt)}
                    </span>
                    <Badge
                      variant={overCapacity ? 'danger' : 'neutral'}
                      size="sm"
                      className="ml-auto"
                    >
                      {seatsLeft - pricing.seats} of {seatsLeft} seats remaining
                    </Badge>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">
                      Ticket tiers
                    </p>
                    <ul className="flex flex-col gap-2">
                      {activity.priceTiers.map((tier) => {
                        const qty = tierQty[tier.id] ?? 0
                        const headroom =
                          seatsLeft - pricing.seats + (tier.countsTowardCapacity ? qty : 0)
                        return (
                          <li
                            key={tier.id}
                            className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.8125rem] font-semibold text-foreground">
                                {tier.label}
                              </p>
                              {tier.description ? (
                                <p className="mt-0.5 truncate text-xs text-subtle">
                                  {tier.description}
                                </p>
                              ) : null}
                              <p className="mt-1 text-xs font-medium text-foreground tabular-nums">
                                {formatCurrency(tier.price, currency)}
                                {tier.compareAtPrice ? (
                                  <span className="ml-1.5 text-faint line-through">
                                    {formatCurrency(tier.compareAtPrice, currency)}
                                  </span>
                                ) : null}
                              </p>
                            </div>
                            <Stepper
                              value={qty}
                              min={0}
                              max={Math.min(tier.maxQuantity, Math.max(0, headroom))}
                              label={tier.label}
                              onChange={(next) =>
                                setTierQty((prev) => ({ ...prev, [tier.id]: next }))
                              }
                            />
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  {activity.addOns.length > 0 ? (
                    <div>
                      <p className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">
                        Add-ons
                      </p>
                      <ul className="flex flex-col gap-2">
                        {activity.addOns.map((addOn) => {
                          const qty = addOnQty[addOn.id] ?? 0
                          return (
                            <li
                              key={addOn.id}
                              className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
                            >
                              <span
                                aria-hidden="true"
                                className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
                              >
                                <Sparkles className="size-4" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[0.8125rem] font-semibold text-foreground">
                                  {addOn.label}
                                  {addOn.required ? (
                                    <Badge variant="warning" size="sm" className="ml-1.5">
                                      Required
                                    </Badge>
                                  ) : null}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-subtle">
                                  {addOn.description}
                                </p>
                                <p className="mt-1 text-xs font-medium text-foreground tabular-nums">
                                  {formatCurrency(addOn.price, currency)} each
                                </p>
                              </div>
                              <Stepper
                                value={qty}
                                min={0}
                                max={addOn.maxPerBooking ?? 12}
                                label={addOn.label}
                                onChange={(next) =>
                                  setAddOnQty((prev) => ({ ...prev, [addOn.id]: next }))
                                }
                              />
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ) : null}

                  {overCapacity ? (
                    <p className="flex items-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft px-3 py-2.5 text-[0.8125rem] text-danger">
                      <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
                      That is {pricing.seats - seatsLeft} more{' '}
                      {pricing.seats - seatsLeft === 1 ? 'seat' : 'seats'} than this departure has
                      left. Reduce the party or pick another time.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* ============================= GUEST ============================= */}
              {step === 'guest' ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">
                      Look up an existing guest
                    </p>
                    <SearchInput
                      value={guestQuery}
                      onValueChange={setGuestQuery}
                      debounceMs={120}
                      label="Search guests"
                      placeholder="Name, email or phone…"
                      shortcut={false}
                    />

                    {guestMatches.length > 0 ? (
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {guestMatches.map((customer) => {
                          const name = `${customer.firstName} ${customer.lastName}`
                          const active = existingGuest?.id === customer.id
                          return (
                            <li key={customer.id}>
                              <button
                                type="button"
                                onClick={() => {
                                  setExistingGuest(active ? null : customer)
                                  setGuestErrors({})
                                }}
                                aria-pressed={active}
                                className={cn(
                                  'flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left',
                                  'transition-colors duration-200 ease-[var(--ease-out-expo)]',
                                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                                  active
                                    ? 'border-primary bg-primary-soft/40'
                                    : 'border-line bg-surface hover:bg-surface-sunken',
                                )}
                              >
                                <Avatar name={name} src={customer.avatarUrl} size="sm" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[0.8125rem] font-medium text-foreground">
                                    {name}
                                  </span>
                                  <span className="block truncate text-xs text-subtle">
                                    {customer.email} · {customer.totalBookings} trips
                                  </span>
                                </span>
                                {customer.segment === 'vip' ? (
                                  <Badge variant="accent" size="sm">
                                    VIP
                                  </Badge>
                                ) : null}
                                {active ? (
                                  <Check aria-hidden="true" className="size-4 text-primary" />
                                ) : null}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    ) : guestQuery.trim().length >= 2 ? (
                      <p className="mt-2 flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-subtle">
                        <Search aria-hidden="true" className="size-3.5" />
                        No guest on file matches “{guestQuery.trim()}”. Add them below.
                      </p>
                    ) : null}
                  </div>

                  {existingGuest ? (
                    <div className="flex items-center gap-2 rounded-xl border border-[color-mix(in_oklab,var(--success)_30%,transparent)] bg-success-soft px-3 py-2.5 text-[0.8125rem] text-success">
                      <Check aria-hidden="true" className="size-4 shrink-0" />
                      Booking as {existingGuest.firstName} {existingGuest.lastName} — their details
                      and trip history carry over.
                      <Button
                        variant="ghost"
                        size="xs"
                        className="ml-auto"
                        onClick={() => setExistingGuest(null)}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <FieldGroup legend="New guest" columns={2}>
                      <Field label="First name" error={guestErrors.firstName} required>
                        {(control) => (
                          <Input
                            {...control}
                            value={guest.firstName}
                            onChange={(e) =>
                              setGuest((g) => ({ ...g, firstName: e.target.value }))
                            }
                            placeholder="Maile"
                            autoComplete="given-name"
                          />
                        )}
                      </Field>
                      <Field label="Last name" error={guestErrors.lastName} required>
                        {(control) => (
                          <Input
                            {...control}
                            value={guest.lastName}
                            onChange={(e) => setGuest((g) => ({ ...g, lastName: e.target.value }))}
                            placeholder="Kahale"
                            autoComplete="family-name"
                          />
                        )}
                      </Field>
                      <Field label="Email" error={guestErrors.email} required>
                        {(control) => (
                          <Input
                            {...control}
                            type="email"
                            value={guest.email}
                            onChange={(e) => setGuest((g) => ({ ...g, email: e.target.value }))}
                            placeholder="guest@example.com"
                            autoComplete="email"
                          />
                        )}
                      </Field>
                      <Field label="Phone" error={guestErrors.phone} required>
                        {(control) => (
                          <Input
                            {...control}
                            type="tel"
                            value={guest.phone}
                            onChange={(e) => setGuest((g) => ({ ...g, phone: e.target.value }))}
                            placeholder="+1 808 555 0142"
                            autoComplete="tel"
                          />
                        )}
                      </Field>
                      <Field label="Country" error={guestErrors.country} required>
                        {(control) => (
                          <Input
                            {...control}
                            value={guest.country}
                            onChange={(e) => setGuest((g) => ({ ...g, country: e.target.value }))}
                            placeholder="United States"
                            autoComplete="country-name"
                          />
                        )}
                      </Field>
                      <Field
                        label="Notes for the crew"
                        description="Allergies, mobility, celebrations."
                        className="sm:col-span-2"
                      >
                        {(control) => (
                          <Textarea
                            {...control}
                            rows={2}
                            value={orderNote}
                            onChange={(e) => setOrderNote(e.target.value)}
                            placeholder="Two first-time snorkellers, celebrating an anniversary."
                          />
                        )}
                      </Field>
                    </FieldGroup>
                  )}
                </div>
              ) : null}

              {/* ============================= PAYMENT ============================= */}
              {step === 'payment' && activity && selectedEvent ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">
                      How is the guest paying?
                    </p>
                    <RadioGroup
                      value={method}
                      onValueChange={(value) => setMethod(value as PaymentMethodValue)}
                      className="gap-2"
                      aria-label="Payment method"
                    >
                      {PAYMENT_METHODS.map((option) => {
                        const Icon = option.icon
                        return (
                          <RadioGroupCard
                            key={option.value}
                            value={option.value}
                            label={option.label}
                            description={option.description}
                            icon={<Icon className="size-4" />}
                            trailing={
                              option.value === 'deposit' ? (
                                <span className="text-[0.8125rem] font-semibold text-foreground tabular-nums">
                                  {formatCurrency(Math.round(pricing.total * 0.25), currency)}
                                </span>
                              ) : option.value === 'cash' ? (
                                <span className="text-xs text-subtle">due at dock</span>
                              ) : (
                                <span className="text-[0.8125rem] font-semibold text-foreground tabular-nums">
                                  {formatCurrency(pricing.total, currency)}
                                </span>
                              )
                            }
                            className="p-3"
                          />
                        )
                      })}
                    </RadioGroup>
                  </div>

                  <div className="rounded-xl border border-line bg-surface-sunken p-3.5">
                    <div className="mb-2.5 flex items-center gap-2">
                      <Receipt aria-hidden="true" className="size-4 text-subtle" />
                      <p className="text-[0.8125rem] font-semibold text-foreground">Order summary</p>
                      <Badge variant="neutral" size="sm" className="ml-auto tabular-nums">
                        {pricing.seats} {pricing.seats === 1 ? 'guest' : 'guests'}
                      </Badge>
                    </div>

                    <p className="mb-2.5 text-xs text-subtle">
                      {activity.name} · {formatDateShort(selectedEvent.departure.startsAt)} ·{' '}
                      {formatTime(selectedEvent.departure.startsAt)} · {activity.meetingPoint}
                    </p>

                    <ul className="flex flex-col divide-y divide-line-subtle">
                      {pricing.lines.map((line) => (
                        <li
                          key={line.id}
                          className="flex items-center justify-between gap-3 py-1.5 text-[0.8125rem]"
                        >
                          <span className="min-w-0 truncate text-muted">
                            <span className="font-medium text-foreground">{line.qty}×</span>{' '}
                            {line.label}
                          </span>
                          <span className="shrink-0 font-medium text-foreground tabular-nums">
                            {formatCurrency(line.total, currency, { decimals: true })}
                          </span>
                        </li>
                      ))}
                      <li className="flex items-center justify-between gap-3 py-1.5 text-[0.8125rem] text-muted">
                        <span>Booking fee (3%)</span>
                        <span className="tabular-nums">
                          {formatCurrency(pricing.fee, currency, { decimals: true })}
                        </span>
                      </li>
                      <li className="flex items-center justify-between gap-3 py-1.5 text-[0.8125rem] text-muted">
                        <span>General excise tax</span>
                        <span className="tabular-nums">
                          {formatCurrency(pricing.tax, currency, { decimals: true })}
                        </span>
                      </li>
                    </ul>

                    <div className="mt-2 flex items-baseline justify-between gap-3 border-t border-line-strong pt-2.5">
                      <span className="text-sm font-semibold text-foreground">Total</span>
                      <span className="font-display text-xl font-semibold tracking-tight text-foreground tabular-nums">
                        {formatCurrency(pricing.total, currency, { decimals: true })}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-faint">
                    {activity.cancellationPolicy.summary}
                  </p>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </DialogBody>

        <DialogFooter divider className="sm:justify-between">
          <div className="flex items-center gap-2 text-[0.8125rem] text-subtle">
            {pricing.seats > 0 ? (
              <>
                <Users aria-hidden="true" className="size-4 text-faint" />
                <span className="tabular-nums">
                  {pricing.seats} {pricing.seats === 1 ? 'guest' : 'guests'}
                </span>
                <span aria-hidden="true" className="text-faint">
                  ·
                </span>
                <span className="font-semibold text-foreground tabular-nums">
                  {formatCurrency(pricing.total, currency)}
                </span>
              </>
            ) : (
              <span>Step {stepIndex + 1} of {STEPS.length}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={stepIndex === 0 ? () => handleOpenChange(false) : goBack}
              leftIcon={stepIndex === 0 ? undefined : <ArrowLeft />}
            >
              {stepIndex === 0 ? 'Cancel' : 'Back'}
            </Button>
            {step === 'payment' ? (
              <Button onClick={submit} loading={submitting} leftIcon={<Check />}>
                Confirm reservation
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canAdvance} rightIcon={<ArrowRight />}>
                Continue
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
