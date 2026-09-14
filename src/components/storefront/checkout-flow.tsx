'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarPlus,
  Check,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  Download,
  Lock,
  MapPin,
  Receipt,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { z } from 'zod'

import {
  cn,
  formatCurrency,
  formatDateLong,
  formatDuration,
  formatTime,
  pluralize,
} from '@/lib/utils'
import type { Activity, Tenant } from '@/types'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/toaster'
import { buildQuote, type QuoteSelection } from '@/components/storefront/booking-widget'

/* ==========================================================================
   TYPES
   ========================================================================== */

export interface CheckoutDeparture {
  id: string
  startsAt: string
  endsAt: string
  seatsLeft: number
  priceMultiplier: number
}

export interface CheckoutFlowProps {
  tenant: Tenant
  activity: Activity
  departure: CheckoutDeparture
  selection: QuoteSelection
  basePath: string
  /** Deterministic confirmation code, generated on the server. */
  reference: string
}

/* ==========================================================================
   VALIDATION
   ========================================================================== */

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const PHONE = /^[+()\-\s\d]{7,}$/

const guestSchema = z.object({
  firstName: z.string().trim().min(2, 'Tell us your first name'),
  lastName: z.string().trim().min(2, 'Tell us your last name'),
  email: z.string().trim().regex(EMAIL, 'That email does not look right'),
  phone: z.string().trim().regex(PHONE, 'Add a number we can reach you on'),
  country: z.string().min(2, 'Pick your country'),
  requests: z.string().max(500, 'Keep it under 500 characters').optional(),
})

const participantSchema = z.object({
  firstName: z.string().trim().min(2, 'First name required'),
  lastName: z.string().trim().min(2, 'Last name required'),
  age: z
    .string()
    .trim()
    .regex(/^\d{1,3}$/, 'Age required')
    .refine((value) => Number(value) >= 1 && Number(value) <= 110, 'Check the age'),
  waiver: z.literal(true, { message: 'The waiver must be accepted' }),
})

const paymentSchema = z.object({
  cardName: z.string().trim().min(3, 'Name as printed on the card'),
  cardNumber: z
    .string()
    .refine((value) => luhn(value.replace(/\s/g, '')), 'Check the card number'),
  expiry: z
    .string()
    .regex(/^(0[1-9]|1[0-2])\s?\/\s?\d{2}$/, 'MM / YY')
    .refine((value) => {
      const [mm, yy] = value.split('/').map((part) => Number(part.trim()))
      // The demo clock is frozen in September 2026.
      return yy > 26 || (yy === 26 && mm >= 9)
    }, 'That card has expired'),
  cvc: z.string().regex(/^\d{3,4}$/, '3 or 4 digits'),
  billingCountry: z.string().min(2, 'Pick a billing country'),
})

type Errors = Record<string, string>

function collectErrors(issues: { path: PropertyKey[]; message: string }[]): Errors {
  const out: Errors = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.')
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/* ==========================================================================
   CARDS
   ========================================================================== */

function luhn(digits: string) {
  if (!/^\d{13,19}$/.test(digits)) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let value = digits.charCodeAt(i) - 48
    if (double) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
    double = !double
  }
  return sum % 10 === 0
}

type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown'

const BRAND_META: Record<CardBrand, { label: string; className: string }> = {
  visa: { label: 'VISA', className: 'text-info' },
  mastercard: { label: 'MC', className: 'text-accent' },
  amex: { label: 'AMEX', className: 'text-primary' },
  discover: { label: 'DISC', className: 'text-warning' },
  unknown: { label: '', className: '' },
}

function detectBrand(value: string): CardBrand {
  const digits = value.replace(/\D/g, '')
  if (/^4/.test(digits)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard'
  if (/^3[47]/.test(digits)) return 'amex'
  if (/^6(?:011|5)/.test(digits)) return 'discover'
  return 'unknown'
}

function formatCardNumber(value: string, brand: CardBrand) {
  const digits = value.replace(/\D/g, '').slice(0, brand === 'amex' ? 15 : 19)
  const groups = brand === 'amex' ? [4, 6, 5] : [4, 4, 4, 4, 3]
  const parts: string[] = []
  let cursor = 0
  for (const size of groups) {
    if (cursor >= digits.length) break
    parts.push(digits.slice(cursor, cursor + size))
    cursor += size
  }
  return parts.join(' ')
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 2) return digits
  return `${digits.slice(0, 2)} / ${digits.slice(2)}`
}

const DEMO_CARD = '4242 4242 4242 4242'

/* ==========================================================================
   COUNTRIES
   ========================================================================== */

const COUNTRIES = [
  'Australia',
  'Austria',
  'Belgium',
  'Brazil',
  'Canada',
  'China',
  'Denmark',
  'France',
  'Germany',
  'Greece',
  'India',
  'Ireland',
  'Italy',
  'Japan',
  'Mexico',
  'Netherlands',
  'New Zealand',
  'Norway',
  'Poland',
  'Portugal',
  'Singapore',
  'South Korea',
  'Spain',
  'Sweden',
  'Switzerland',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
]

/**
 * Direction-aware step transition. The travel direction is read from
 * `AnimatePresence`'s `custom`, so the *exiting* panel always leaves toward the
 * side the user came from — even after a back-then-forward sequence.
 */
const stepVariants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 44 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -44 }),
}

const STEPS = [
  { key: 'guest', label: 'Your details' },
  { key: 'participants', label: 'Guests' },
  { key: 'payment', label: 'Payment' },
] as const

/* ==========================================================================
   <CheckoutFlow>
   ========================================================================== */

export function CheckoutFlow({
  tenant,
  activity,
  departure,
  selection,
  basePath,
  reference,
}: CheckoutFlowProps) {
  const reducedMotion = useReducedMotionSafe()

  const quote = React.useMemo(
    () => buildQuote(activity, tenant.slug, selection, departure.priceMultiplier),
    [activity, tenant.slug, selection, departure.priceMultiplier],
  )

  const [step, setStep] = React.useState(0)
  const [direction, setDirection] = React.useState(1)
  const [errors, setErrors] = React.useState<Errors>({})
  const [submitting, setSubmitting] = React.useState(false)
  const [confirmed, setConfirmed] = React.useState(false)
  const [summaryOpen, setSummaryOpen] = React.useState(false)

  /* ---------- form state ---------- */

  const [guest, setGuest] = React.useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    country: COUNTRIES.includes(tenant.country) ? tenant.country : 'United States',
    requests: '',
  })

  const [participants, setParticipants] = React.useState(() =>
    quote.ticketLines.flatMap((line) =>
      Array.from({ length: line.quantity }, (_, index) => ({
        id: `${line.id}-${index}`,
        tierLabel: line.label,
        seat: index + 1,
        firstName: '',
        lastName: '',
        age: '',
        waiver: false,
      })),
    ),
  )

  const [payment, setPayment] = React.useState({
    cardName: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
    billingCountry: COUNTRIES.includes(tenant.country) ? tenant.country : 'United States',
  })

  const brand = detectBrand(payment.cardNumber)

  /* ---------- navigation ---------- */

  const goTo = (next: number) => {
    setDirection(next > step ? 1 : -1)
    setErrors({})
    setStep(next)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' })
    }
  }

  const validateStep = (index: number): boolean => {
    if (index === 0) {
      const result = guestSchema.safeParse(guest)
      if (!result.success) {
        setErrors(collectErrors(result.error.issues))
        return false
      }
    }
    if (index === 1) {
      const next: Errors = {}
      participants.forEach((participant, i) => {
        const result = participantSchema.safeParse(participant)
        if (!result.success) {
          for (const [key, message] of Object.entries(collectErrors(result.error.issues))) {
            next[`p${i}.${key}`] = message
          }
        }
      })
      if (Object.keys(next).length > 0) {
        setErrors(next)
        return false
      }
    }
    if (index === 2) {
      const result = paymentSchema.safeParse(payment)
      if (!result.success) {
        setErrors(collectErrors(result.error.issues))
        return false
      }
    }
    setErrors({})
    return true
  }

  const next = () => {
    if (!validateStep(step)) return
    if (step < STEPS.length - 1) {
      goTo(step + 1)
      return
    }
    pay()
  }

  const pay = () => {
    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      setConfirmed(true)
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'auto' })
    }, 1400)
  }

  const expressPay = (method: string) => {
    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      setConfirmed(true)
      toast.success(`Paid with ${method}`)
    }, 1100)
  }

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(reference)
      toast.success('Confirmation code copied')
    } catch {
      toast.error('Could not copy — write it down instead')
    }
  }

  if (confirmed) {
    return (
      <Confirmation
        tenant={tenant}
        activity={activity}
        departure={departure}
        quote={quote}
        guest={guest}
        reference={reference}
        basePath={basePath}
        onCopy={copyReference}
        reducedMotion={reducedMotion}
      />
    )
  }

  return (
    <div className="mx-auto w-full max-w-[88rem] px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:px-10">
      {/* ---------- breadcrumb ---------- */}
      <Link
        href={`${basePath}/${activity.slug}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" />
        Back to {activity.name}
      </Link>

      <div className="mt-5 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_24rem]">
        {/* ==================== form column ==================== */}
        <div className="min-w-0">
          <h1 className="font-display text-display-sm font-semibold tracking-tight text-foreground">
            Secure checkout
          </h1>
          <p className="mt-2 text-sm text-muted">
            Three short steps. Your seats are held for the next 15 minutes.
          </p>

          {/* ---------- progress ---------- */}
          <ol className="mt-8 flex items-center gap-2" aria-label="Checkout progress">
            {STEPS.map((entry, index) => {
              const done = index < step
              const active = index === step
              return (
                <li key={entry.key} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => (index < step ? goTo(index) : undefined)}
                    disabled={index > step}
                    aria-current={active ? 'step' : undefined}
                    className={cn(
                      'group flex min-w-0 flex-1 flex-col gap-2 text-left',
                      index < step && 'cursor-pointer',
                      index > step && 'cursor-default',
                    )}
                  >
                    <span className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                      <motion.span
                        className="absolute inset-y-0 left-0 rounded-full bg-primary"
                        initial={false}
                        animate={{ width: done || active ? '100%' : '0%' }}
                        transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'grid size-5 shrink-0 place-items-center rounded-full text-[0.625rem] font-bold tabular transition-colors duration-300',
                          done
                            ? 'bg-primary text-on-primary'
                            : active
                              ? 'bg-primary-soft text-primary ring-1 ring-primary'
                              : 'bg-surface-sunken text-faint',
                        )}
                      >
                        {done ? <Check className="size-3" aria-hidden="true" /> : index + 1}
                      </span>
                      <span
                        className={cn(
                          'truncate text-xs font-semibold transition-colors duration-300',
                          active ? 'text-foreground' : done ? 'text-muted' : 'text-faint',
                        )}
                      >
                        {entry.label}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>

          {/* ---------- mobile summary ---------- */}
          <MobileSummary
            open={summaryOpen}
            onToggle={() => setSummaryOpen((value) => !value)}
            activity={activity}
            tenant={tenant}
            departure={departure}
            quote={quote}
            reducedMotion={reducedMotion}
          />

          {/* ---------- steps ---------- */}
          <div className="relative mt-8 overflow-hidden">
            <AnimatePresence mode="wait" initial={false} custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={stepVariants}
                initial={reducedMotion ? false : 'enter'}
                animate="center"
                exit={reducedMotion ? undefined : 'exit'}
                transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              >
                {step === 0 ? (
                  <GuestStep guest={guest} setGuest={setGuest} errors={errors} />
                ) : null}
                {step === 1 ? (
                  <ParticipantsStep
                    participants={participants}
                    setParticipants={setParticipants}
                    errors={errors}
                    guest={guest}
                    activity={activity}
                  />
                ) : null}
                {step === 2 ? (
                  <PaymentStep
                    payment={payment}
                    setPayment={setPayment}
                    errors={errors}
                    brand={brand}
                    activity={activity}
                    tenant={tenant}
                    total={quote.total}
                    submitting={submitting}
                    onExpressPay={expressPay}
                  />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ---------- actions ---------- */}
          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-line-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
            {step > 0 ? (
              <Button
                variant="ghost"
                onClick={() => goTo(step - 1)}
                leftIcon={<ArrowLeft aria-hidden="true" />}
                disabled={submitting}
              >
                Back
              </Button>
            ) : (
              <Button asChild variant="ghost" leftIcon={<ArrowLeft aria-hidden="true" />}>
                <Link href={`${basePath}/${activity.slug}`}>Change booking</Link>
              </Button>
            )}

            <Button
              size="lg"
              onClick={next}
              loading={submitting}
              rightIcon={step < STEPS.length - 1 ? <ArrowRight aria-hidden="true" /> : undefined}
              leftIcon={step === STEPS.length - 1 ? <Lock aria-hidden="true" /> : undefined}
              className="sm:min-w-52"
            >
              {step < STEPS.length - 1
                ? 'Continue'
                : `Pay ${formatCurrency(quote.total, tenant.currency, { decimals: true })}`}
            </Button>
          </div>
        </div>

        {/* ==================== summary rail ==================== */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <OrderSummary
              activity={activity}
              tenant={tenant}
              departure={departure}
              quote={quote}
            />
          </div>
        </aside>
      </div>
    </div>
  )
}

/* ==========================================================================
   STEP 1 — GUEST DETAILS
   ========================================================================== */

type GuestState = {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  requests: string
}

function GuestStep({
  guest,
  setGuest,
  errors,
}: {
  guest: GuestState
  setGuest: React.Dispatch<React.SetStateAction<GuestState>>
  errors: Errors
}) {
  const set = (key: keyof GuestState) => (value: string) =>
    setGuest((prev) => ({ ...prev, [key]: value }))

  return (
    <section aria-labelledby="step-guest" className="space-y-5">
      <div>
        <h2 id="step-guest" className="font-display text-xl font-semibold tracking-tight">
          Who is the booking for?
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          We send the tickets and any weather updates here.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.firstName} required>
          <Input
            value={guest.firstName}
            onChange={(e) => set('firstName')(e.target.value)}
            autoComplete="given-name"
            placeholder="Maia"
          />
        </Field>
        <Field label="Last name" error={errors.lastName} required>
          <Input
            value={guest.lastName}
            onChange={(e) => set('lastName')(e.target.value)}
            autoComplete="family-name"
            placeholder="Fletcher"
          />
        </Field>
        <Field
          label="Email"
          error={errors.email}
          description="Your confirmation lands here in seconds."
          required
        >
          <Input
            type="email"
            inputMode="email"
            value={guest.email}
            onChange={(e) => set('email')(e.target.value)}
            autoComplete="email"
            placeholder="maia@example.com"
          />
        </Field>
        <Field label="Mobile" error={errors.phone} description="For day-of updates only." required>
          <Input
            type="tel"
            inputMode="tel"
            value={guest.phone}
            onChange={(e) => set('phone')(e.target.value)}
            autoComplete="tel"
            placeholder="+1 808 555 0134"
          />
        </Field>
      </div>

      <Field label="Country of residence" error={errors.country} required>
        {(control) => (
          <Select value={guest.country} onValueChange={set('country')}>
            <SelectTrigger id={control.id} aria-invalid={control['aria-invalid']}>
              <SelectValue placeholder="Select a country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((country) => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </Field>

      <Field
        label="Anything we should know?"
        optional
        error={errors.requests}
        description="Allergies, nervous swimmers, birthdays, accessibility needs."
        hint={`${guest.requests.length}/500`}
      >
        <Textarea
          value={guest.requests}
          onChange={(e) => set('requests')(e.target.value.slice(0, 500))}
          rows={3}
          placeholder="Celebrating our anniversary — no fuss needed, we're just happy to be here."
        />
      </Field>
    </section>
  )
}

/* ==========================================================================
   STEP 2 — PARTICIPANTS
   ========================================================================== */

type Participant = {
  id: string
  tierLabel: string
  seat: number
  firstName: string
  lastName: string
  age: string
  waiver: boolean
}

function ParticipantsStep({
  participants,
  setParticipants,
  errors,
  guest,
  activity,
}: {
  participants: Participant[]
  setParticipants: React.Dispatch<React.SetStateAction<Participant[]>>
  errors: Errors
  guest: GuestState
  activity: Activity
}) {
  const update = (index: number, patch: Partial<Participant>) =>
    setParticipants((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)))

  const allWaived = participants.every((p) => p.waiver)

  return (
    <section aria-labelledby="step-participants" className="space-y-5">
      <div>
        <h2 id="step-participants" className="font-display text-xl font-semibold tracking-tight">
          Who is coming with you?
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Names must match photo ID at check-in. Ages help us size gear correctly.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            update(0, { firstName: guest.firstName, lastName: guest.lastName })
          }
          disabled={!guest.firstName && !guest.lastName}
        >
          Use my name for guest 1
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() =>
            setParticipants((prev) => prev.map((p) => ({ ...p, waiver: !allWaived })))
          }
        >
          {allWaived ? 'Clear all waivers' : 'Accept waiver for everyone'}
        </Button>
      </div>

      <ol className="space-y-3">
        {participants.map((participant, index) => {
          const waiverError = errors[`p${index}.waiver`]
          return (
            <li
              key={participant.id}
              className={cn(
                'rounded-2xl border bg-surface p-4 transition-colors duration-200',
                waiverError ? 'border-danger/60' : 'border-line',
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  Guest {index + 1}
                  <span className="ml-2 rounded-full bg-surface-sunken px-2 py-0.5 text-[0.6875rem] font-medium text-muted">
                    {participant.tierLabel}
                  </span>
                </p>
                {participant.waiver ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                    <Check className="size-3.5" aria-hidden="true" />
                    Waiver signed
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_6rem]">
                <Field label="First name" labelSize="sm" error={errors[`p${index}.firstName`]}>
                  <Input
                    size="sm"
                    value={participant.firstName}
                    onChange={(e) => update(index, { firstName: e.target.value })}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Last name" labelSize="sm" error={errors[`p${index}.lastName`]}>
                  <Input
                    size="sm"
                    value={participant.lastName}
                    onChange={(e) => update(index, { lastName: e.target.value })}
                    autoComplete="off"
                  />
                </Field>
                <Field label="Age" labelSize="sm" error={errors[`p${index}.age`]}>
                  <Input
                    size="sm"
                    inputMode="numeric"
                    value={participant.age}
                    onChange={(e) =>
                      update(index, { age: e.target.value.replace(/\D/g, '').slice(0, 3) })
                    }
                  />
                </Field>
              </div>

              <label
                htmlFor={`waiver-${participant.id}`}
                className="mt-3 flex cursor-pointer items-start gap-2.5"
              >
                <Checkbox
                  id={`waiver-${participant.id}`}
                  checked={participant.waiver}
                  onCheckedChange={(value) => update(index, { waiver: value === true })}
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-muted">
                  I accept the liability waiver and confirm this guest meets the minimum age of{' '}
                  {activity.minAge} and the stated requirements.
                  {waiverError ? (
                    <span className="mt-1 block font-medium text-danger">{waiverError}</span>
                  ) : null}
                </span>
              </label>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/* ==========================================================================
   STEP 3 — PAYMENT
   ========================================================================== */

type PaymentState = {
  cardName: string
  cardNumber: string
  expiry: string
  cvc: string
  billingCountry: string
}

function PaymentStep({
  payment,
  setPayment,
  errors,
  brand,
  activity,
  tenant,
  total,
  submitting,
  onExpressPay,
}: {
  payment: PaymentState
  setPayment: React.Dispatch<React.SetStateAction<PaymentState>>
  errors: Errors
  brand: CardBrand
  activity: Activity
  tenant: Tenant
  total: number
  submitting: boolean
  onExpressPay: (method: string) => void
}) {
  const set = (key: keyof PaymentState) => (value: string) =>
    setPayment((prev) => ({ ...prev, [key]: value }))

  return (
    <section aria-labelledby="step-payment" className="space-y-6">
      <div>
        <h2 id="step-payment" className="font-display text-xl font-semibold tracking-tight">
          Payment
        </h2>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
          <Lock className="size-3.5 text-success" aria-hidden="true" />
          Encrypted end to end. We never store your card.
        </p>
      </div>

      {/* ---------- express ---------- */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => onExpressPay('Apple Pay')}
          className={cn(
            'inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink-950 text-sm font-semibold text-white',
            'transition-all duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:shadow-lg',
            'disabled:pointer-events-none disabled:opacity-50',
            'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
        >
          <AppleMark />
          Pay
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => onExpressPay('Google Pay')}
          className={cn(
            'inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-sm font-semibold text-foreground',
            'transition-all duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:shadow-lg',
            'disabled:pointer-events-none disabled:opacity-50',
            'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          )}
        >
          <GoogleMark />
          Pay
        </button>
      </div>

      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-faint">
          or pay by card
        </span>
        <Separator className="flex-1" />
      </div>

      {/* ---------- card ---------- */}
      <div className="space-y-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <Field label="Name on card" error={errors.cardName} required>
          <Input
            value={payment.cardName}
            onChange={(e) => set('cardName')(e.target.value)}
            autoComplete="cc-name"
            placeholder="M FLETCHER"
          />
        </Field>

        <Field
          label="Card number"
          error={errors.cardNumber}
          required
          hint={
            <button
              type="button"
              onClick={() => set('cardNumber')(DEMO_CARD)}
              className="text-[0.6875rem] font-semibold text-primary transition-colors hover:text-primary-hover"
            >
              Use demo card
            </button>
          }
        >
          <Input
            value={payment.cardNumber}
            onChange={(e) => set('cardNumber')(formatCardNumber(e.target.value, detectBrand(e.target.value)))}
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="4242 4242 4242 4242"
            leftIcon={<CreditCard aria-hidden="true" />}
            suffix={
              brand === 'unknown' ? null : (
                <span
                  className={cn(
                    'rounded-md bg-surface-sunken px-1.5 py-0.5 text-[0.625rem] font-bold tracking-wider',
                    BRAND_META[brand].className,
                  )}
                >
                  {BRAND_META[brand].label}
                </span>
              )
            }
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Expiry" error={errors.expiry} required>
            <Input
              value={payment.expiry}
              onChange={(e) => set('expiry')(formatExpiry(e.target.value))}
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="09 / 29"
            />
          </Field>
          <Field label="CVC" error={errors.cvc} required>
            <Input
              value={payment.cvc}
              onChange={(e) => set('cvc')(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="123"
            />
          </Field>
        </div>

        <Field label="Billing country" error={errors.billingCountry} required>
          {(control) => (
            <Select value={payment.billingCountry} onValueChange={set('billingCountry')}>
              <SelectTrigger id={control.id} aria-invalid={control['aria-invalid']}>
                <SelectValue placeholder="Select a country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>

      {/* ---------- policy restated ---------- */}
      <div className="rounded-2xl bg-surface-sunken p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="size-4 text-success" aria-hidden="true" />
          Free cancellation up to {activity.cancellationPolicy.freeCancellationHours} hours before
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          {activity.cancellationPolicy.summary} Your card is charged{' '}
          {formatCurrency(total, tenant.currency, { decimals: true })} in {tenant.currency} by{' '}
          {tenant.legalName}.
        </p>
      </div>
    </section>
  )
}

function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M16.4 12.8c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.7 0-1.6-.8-2.7-.7-1.4 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.5 2.1 2.5 2 1-.1 1.4-.6 2.6-.6s1.5.6 2.6.6 1.8-1 2.4-2c.8-1.1 1.1-2.2 1.1-2.3 0 0-2.1-.8-2.1-3.2ZM14.5 6.4c.6-.7 1-1.6.9-2.6-.8 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.5.9.1 1.8-.4 2.5-1.2Z" />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z"
        className="fill-info"
      />
      <path
        d="M12 22c2.7 0 5-.9 6.6-2.5l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.7-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z"
        className="fill-success"
      />
      <path
        d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z"
        className="fill-warning"
      />
      <path
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.6 9.4 5.9 12 5.9Z"
        className="fill-danger"
      />
    </svg>
  )
}

/* ==========================================================================
   ORDER SUMMARY
   ========================================================================== */

type QuoteShape = ReturnType<typeof buildQuote>

function SummaryLines({
  quote,
  tenant,
}: {
  quote: QuoteShape
  tenant: Tenant
}) {
  return (
    <>
      <ul className="space-y-2 text-sm">
        {[...quote.ticketLines, ...quote.addOnLines].map((line) => (
          <li key={line.id} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-muted">
              {line.label}
              <span className="ml-1.5 text-xs text-faint">
                {line.quantity} × {formatCurrency(line.unitPrice, tenant.currency)}
              </span>
            </span>
            <span className="shrink-0 tabular font-medium text-foreground">
              {formatCurrency(line.total, tenant.currency)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 space-y-1.5 border-t border-line-subtle pt-3 text-xs text-muted">
        <div className="flex items-baseline justify-between gap-3">
          <span>Subtotal</span>
          <span className="tabular">{formatCurrency(quote.subtotal, tenant.currency)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span>{quote.feeLabel}</span>
          <span className="tabular">{formatCurrency(quote.feeTotal, tenant.currency)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span>{quote.taxLabel}</span>
          <span className="tabular">{formatCurrency(quote.taxTotal, tenant.currency)}</span>
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-3">
        <span className="text-sm font-semibold text-foreground">Total</span>
        <span className="font-display text-xl font-semibold tabular tracking-tight text-foreground">
          {formatCurrency(quote.total, tenant.currency, { decimals: true })}
        </span>
      </div>
    </>
  )
}

function OrderSummary({
  activity,
  tenant,
  departure,
  quote,
}: {
  activity: Activity
  tenant: Tenant
  departure: CheckoutDeparture
  quote: QuoteShape
}) {
  const media = activity.media.find((m) => m.isPrimary) ?? activity.media[0]

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
      <div className="flex gap-3 border-b border-line-subtle p-4">
        <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface-sunken">
          {media ? (
            <Image src={media.url} alt={media.alt} fill sizes="80px" className="object-cover" />
          ) : null}
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
            {activity.name}
          </p>
          <p className="mt-1 truncate text-xs text-subtle">{tenant.name}</p>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted">
            <Clock className="size-3" aria-hidden="true" />
            {formatDuration(activity.durationMinutes)}
          </p>
        </div>
      </div>

      <dl className="space-y-2.5 border-b border-line-subtle p-4 text-sm">
        <div className="flex items-start gap-2.5">
          <CalendarPlus className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="sr-only">Date and time</dt>
            <dd className="font-medium text-foreground">{formatDateLong(departure.startsAt)}</dd>
            <dd className="text-xs text-subtle tabular">
              {formatTime(departure.startsAt)} – {formatTime(departure.endsAt)} ·{' '}
              {tenant.timezone.split('/').pop()?.replace(/_/g, ' ')}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <Users className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="sr-only">Party</dt>
            <dd className="text-muted">
              {quote.headcount} {pluralize(quote.headcount, 'guest')}
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <dt className="sr-only">Meeting point</dt>
            <dd className="text-xs leading-relaxed text-muted">{activity.meetingPoint}</dd>
          </div>
        </div>
      </dl>

      <div className="p-4">
        <SummaryLines quote={quote} tenant={tenant} />
      </div>

      <div className="flex items-center gap-2 border-t border-line-subtle bg-surface-sunken px-4 py-3">
        <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted">
          Free cancellation up to {activity.cancellationPolicy.freeCancellationHours}h before ·
          instant confirmation
        </p>
      </div>
    </div>
  )
}

function MobileSummary({
  open,
  onToggle,
  activity,
  tenant,
  departure,
  quote,
  reducedMotion,
}: {
  open: boolean
  onToggle: () => void
  activity: Activity
  tenant: Tenant
  departure: CheckoutDeparture
  quote: QuoteShape
  reducedMotion: boolean
}) {
  const media = activity.media.find((m) => m.isPrimary) ?? activity.media[0]

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface lg:hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
          {media ? (
            <Image src={media.url} alt="" fill sizes="48px" className="object-cover" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {activity.name}
          </span>
          <span className="mt-0.5 block truncate text-xs text-subtle tabular">
            {formatDateLong(departure.startsAt)} · {formatTime(departure.startsAt)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-display text-base font-semibold tabular text-foreground">
            {formatCurrency(quote.total, tenant.currency)}
          </span>
          <span className="inline-flex items-center gap-1 text-[0.6875rem] font-medium text-primary">
            {open ? 'Hide' : 'Details'}
            <ChevronDown
              className={cn('size-3 transition-transform duration-300', open && 'rotate-180')}
              aria-hidden="true"
            />
          </span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-line-subtle p-4">
              <SummaryLines quote={quote} tenant={tenant} />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

/* ==========================================================================
   CONFIRMATION
   ========================================================================== */

/** Fixed offsets — a seeded burst, never Math.random, so SSR and client agree. */
const BURST = [
  { x: -74, y: -34, d: 0.02, tone: 'bg-primary' },
  { x: 68, y: -48, d: 0.06, tone: 'bg-accent' },
  { x: -96, y: 26, d: 0.1, tone: 'bg-warning' },
  { x: 92, y: 18, d: 0.14, tone: 'bg-success' },
  { x: -42, y: -76, d: 0.18, tone: 'bg-accent' },
  { x: 46, y: -80, d: 0.22, tone: 'bg-primary' },
  { x: -110, y: -8, d: 0.26, tone: 'bg-success' },
  { x: 112, y: -14, d: 0.3, tone: 'bg-warning' },
]

function pad(value: number) {
  return String(value).padStart(2, '0')
}

/** "2026-09-18T07:30:00" → "20260918T073000" */
function icsStamp(localIso: string) {
  return localIso.replace(/[-:]/g, '').slice(0, 15)
}

function Confirmation({
  tenant,
  activity,
  departure,
  quote,
  guest,
  reference,
  basePath,
  onCopy,
  reducedMotion,
}: {
  tenant: Tenant
  activity: Activity
  departure: CheckoutDeparture
  quote: QuoteShape
  guest: GuestState
  reference: string
  basePath: string
  onCopy: () => void
  reducedMotion: boolean
}) {
  const download = (filename: string, mime: string, content: string) => {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const addToCalendar = () => {
    const now = new Date()
    const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(
      now.getUTCHours(),
    )}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//EZRA Pro//Storefront//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${reference}@ezrapro.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=${tenant.timezone}:${icsStamp(departure.startsAt)}`,
      `DTEND;TZID=${tenant.timezone}:${icsStamp(departure.endsAt)}`,
      `SUMMARY:${activity.name} — ${tenant.name}`,
      `LOCATION:${tenant.contact.addressLine.replace(/,/g, '\\,')}`,
      `DESCRIPTION:Confirmation ${reference}. ${activity.meetingPoint.replace(/,/g, '\\,')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    download(`${reference}.ics`, 'text/calendar;charset=utf-8', ics)
    toast.success('Calendar invite downloaded')
  }

  const downloadTicket = () => {
    const rows = [...quote.ticketLines, ...quote.addOnLines]
      .map(
        (line) =>
          `<tr><td>${line.label} × ${line.quantity}</td><td style="text-align:right">${formatCurrency(
            line.total,
            tenant.currency,
          )}</td></tr>`,
      )
      .join('')

    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${reference} — ${activity.name}</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;margin:0;padding:40px;background:#f6f8f9;color:#12212a}
.ticket{max-width:640px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 24px 60px -24px rgba(18,33,42,.25)}
.head{background:${tenant.branding.primaryColor};color:#fff;padding:28px 32px}
.code{font-family:ui-monospace,monospace;font-size:30px;letter-spacing:.12em;margin:6px 0 0}
.body{padding:28px 32px}h1{font-size:20px;margin:0 0 4px}p{margin:2px 0;color:#4a5c66;font-size:14px}
table{width:100%;border-collapse:collapse;margin-top:20px;font-size:14px}
td{padding:7px 0;border-bottom:1px solid #e6ecef}
.total{font-weight:700;font-size:18px;border-top:2px solid #12212a;padding-top:12px;margin-top:12px;display:flex;justify-content:space-between}
</style></head><body><div class="ticket">
<div class="head"><div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;opacity:.8">${tenant.name}</div><div class="code">${reference}</div></div>
<div class="body"><h1>${activity.name}</h1>
<p>${formatDateLong(departure.startsAt)} · ${formatTime(departure.startsAt)}–${formatTime(departure.endsAt)}</p>
<p>${activity.meetingPoint}</p>
<p>${quote.headcount} guest(s) · Lead guest: ${guest.firstName} ${guest.lastName}</p>
<table>${rows}</table>
<div class="total"><span>Total paid</span><span>${formatCurrency(quote.total, tenant.currency, { decimals: true })}</span></div>
<p style="margin-top:20px">${activity.cancellationPolicy.summary}</p>
<p>${tenant.contact.phone} · ${tenant.contact.email}</p>
</div></div></body></html>`

    download(`${reference}.html`, 'text/html;charset=utf-8', html)
    toast.success('Ticket downloaded')
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-28 sm:px-6 sm:pt-32">
      {/* ---------- success mark ---------- */}
      <div className="relative flex justify-center">
        {!reducedMotion
          ? BURST.map((dot, i) => (
              <motion.span
                key={i}
                aria-hidden="true"
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
                animate={{ opacity: [0, 1, 0], x: dot.x, y: dot.y, scale: [0.4, 1, 0.7] }}
                transition={{ duration: 1.1, delay: 0.25 + dot.d, ease: [0.16, 1, 0.3, 1] }}
                className={cn('absolute top-9 size-2 rounded-full', dot.tone)}
              />
            ))
          : null}

        <motion.div
          initial={reducedMotion ? false : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
          className="relative grid size-20 place-items-center rounded-full bg-success-soft"
        >
          <svg viewBox="0 0 52 52" className="size-11" fill="none" aria-hidden="true">
            <motion.circle
              cx="26"
              cy="26"
              r="22"
              className="stroke-success"
              strokeWidth="3"
              strokeLinecap="round"
              initial={reducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.path
              d="M16 27.5 L23 34 L37 19"
              className="stroke-success"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reducedMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            />
          </svg>
        </motion.div>
      </div>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="mt-7 text-center"
      >
        <h1 className="font-display text-display-sm font-semibold tracking-tight text-foreground">
          You are booked, {guest.firstName || 'friend'}
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-muted">
          We have emailed your tickets to{' '}
          <span className="font-medium text-foreground">{guest.email || 'your inbox'}</span>. Show
          the code below at the meeting point — a screenshot is fine.
        </p>
      </motion.div>

      {/* ---------- reference ---------- */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-lg sm:p-6"
      >
        <div className="flex flex-col items-center gap-3 border-b border-dashed border-line pb-5 sm:flex-row sm:justify-between">
          <div className="text-center sm:text-left">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-faint">
              Confirmation code
            </p>
            <p className="mt-1 font-mono text-2xl font-bold tracking-[0.14em] text-foreground">
              {reference}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onCopy}
            leftIcon={<Copy aria-hidden="true" />}
          >
            Copy code
          </Button>
        </div>

        <dl className="grid grid-cols-1 gap-4 py-5 sm:grid-cols-2">
          <div>
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
              Experience
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">{activity.name}</dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
              When
            </dt>
            <dd className="mt-1 text-sm font-medium tabular text-foreground">
              {formatDateLong(departure.startsAt)} · {formatTime(departure.startsAt)}
            </dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
              Guests
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {quote.headcount} {pluralize(quote.headcount, 'guest')}
            </dd>
          </div>
          <div>
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
              Paid
            </dt>
            <dd className="mt-1 text-sm font-medium tabular text-foreground">
              {formatCurrency(quote.total, tenant.currency, { decimals: true })}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
              Meeting point
            </dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted">{activity.meetingPoint}</dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2.5 border-t border-line-subtle pt-5 sm:flex-row">
          <Button
            fullWidth
            onClick={addToCalendar}
            leftIcon={<CalendarPlus aria-hidden="true" />}
          >
            Add to calendar
          </Button>
          <Button
            fullWidth
            variant="secondary"
            onClick={downloadTicket}
            leftIcon={<Download aria-hidden="true" />}
          >
            Download ticket
          </Button>
        </div>
      </motion.div>

      {/* ---------- receipt ---------- */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
        className="mt-5 rounded-2xl border border-line bg-surface p-5"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Receipt className="size-4 text-primary" aria-hidden="true" />
          Receipt
        </p>
        <div className="mt-4">
          <SummaryLines quote={quote} tenant={tenant} />
        </div>
      </motion.div>

      <div className="mt-8 flex flex-col items-center gap-3 text-center">
        <p className="text-sm text-muted">
          Questions before the day? Call{' '}
          <a
            href={`tel:${tenant.contact.phone.replace(/[^+\d]/g, '')}`}
            className="font-semibold text-primary hover:underline"
          >
            {tenant.contact.phone}
          </a>
        </p>
        <Button asChild variant="ghost">
          <Link href={basePath}>Back to {tenant.branding.logoText}</Link>
        </Button>
      </div>
    </div>
  )
}
