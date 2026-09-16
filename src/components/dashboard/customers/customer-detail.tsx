'use client'

/**
 * The guest profile. Identity and controls up top, six facts underneath, then a
 * two-column split: the full trip history on the left, reputation / money /
 * internal context on the right.
 */

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowUpRight,
  Banknote,
  CalendarPlus,
  CheckCheck,
  ClipboardList,
  CreditCard,
  Gift,
  Landmark,
  Mail,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  Phone,
  RotateCcw,
  Send,
  ShieldCheck,
  SquarePen,
  Star,
  Ticket,
  TrendingUp,
  UserRoundX,
  Users,
  Wallet,
} from 'lucide-react'

import {
  cn,
  formatCurrency,
  formatDateLong,
  formatDateShort,
  formatNumber,
  formatRelative,
  formatTime,
} from '@/lib/utils'
import { NOW } from '@/lib/demo-core'
import { countryFlag } from '@/components/charts/geo-bars'
import { ACTIVITY_COLOR_VAR } from '@/components/charts/chart-container'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Avatar } from '@/components/ui/avatar'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { TagInput } from '@/components/ui/tag-input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import {
  RefundDialog,
  refundableAmount,
  type RefundResult,
  type RefundTarget,
} from '@/components/dashboard/bookings/refund-dialog'
import { StarRating } from '@/components/dashboard/reviews/rating-summary'
import { SEGMENT_META } from '@/components/dashboard/customers/segment-cards'
import type {
  Activity,
  BookingChannel,
  BookingStatus,
  CurrencyCode,
  Customer,
  Payment,
  PaymentStatus,
} from '@/types'

/* ==========================================================================
   PROPS
   ========================================================================== */

export interface CustomerBookingEntry {
  id: string
  reference: string
  activityId: string
  activityName: string
  activityImage: string
  activityAlt: string
  colorKey: Activity['colorKey']
  departureAt: string
  createdAt: string
  partySize: number
  /** Minor units. */
  total: number
  /** Minor units collected and already returned. */
  amountPaid: number
  refunded: number
  status: BookingStatus
  paymentStatus: PaymentStatus
  channel: BookingChannel
  channelLabel: string
  rating?: number
  reviewText?: string
}

export interface CustomerPaymentMethod {
  id: string
  method: Payment['method']
  brand?: string
  last4?: string
  lastUsedAt: string
  charges: number
  /** Minor units. */
  total: number
}

export interface CustomerStats {
  totalBookings: number
  lifetimeValue: number
  avgOrderValue: number
  firstSeenAt: string | null
  lastSeenAt: string | null
  avgRating: number
  ratingCount: number
  guestsHosted: number
  cancellations: number
}

export interface CustomerDetailProps {
  customer: Customer
  countryName: string
  bookings: CustomerBookingEntry[]
  methods: CustomerPaymentMethod[]
  stats: CustomerStats
  currency: CurrencyCode
  tagSuggestions: string[]
  operator: { name: string; title: string; avatarUrl?: string }
  className?: string
}

/* ==========================================================================
   SMALL PARTS
   ========================================================================== */

const METHOD_ICON: Record<Payment['method'], typeof CreditCard> = {
  card: CreditCard,
  apple_pay: Wallet,
  google_pay: Wallet,
  cash: Banknote,
  bank_transfer: Landmark,
  gift_card: Gift,
}

const METHOD_LABEL: Record<Payment['method'], string> = {
  card: 'Card',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  gift_card: 'Gift card',
}

function FactTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon: typeof Ticket
  tone?: 'default' | 'brand'
}) {
  return (
    <div
      className={cn(
        'group relative min-w-0 overflow-hidden rounded-xl border p-3.5',
        'transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)]',
        'hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        tone === 'brand'
          ? 'border-primary/30 bg-primary-soft/40'
          : 'border-line bg-surface shadow-xs',
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon
          className={cn('size-3.5 shrink-0', tone === 'brand' ? 'text-primary' : 'text-faint')}
          aria-hidden="true"
        />
        <p className="truncate text-[0.6875rem] font-semibold tracking-[0.06em] text-subtle uppercase">
          {label}
        </p>
      </div>
      <p className="tabular mt-2 truncate font-display text-xl leading-none font-semibold tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-1.5 truncate text-[0.6875rem] text-subtle">{hint}</p> : null}
    </div>
  )
}

function ContactLine({
  icon: Icon,
  children,
  onCopy,
  copyLabel,
}: {
  icon: typeof Mail
  children: React.ReactNode
  onCopy?: () => void
  copyLabel?: string
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted">
      <Icon className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
      <span className="truncate">{children}</span>
      {onCopy ? (
        <button
          type="button"
          onClick={onCopy}
          aria-label={copyLabel}
          className="shrink-0 rounded p-0.5 text-faint transition-colors duration-200 hover:text-primary focus-visible:text-primary"
        >
          <ClipboardList className="size-3" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  )
}

/* ==========================================================================
   MAIN
   ========================================================================== */

export function CustomerDetail({
  customer,
  countryName,
  bookings,
  methods,
  stats,
  currency,
  tagSuggestions,
  operator,
  className,
}: CustomerDetailProps) {
  /* Refunds issued from this profile, layered over the server entries. */
  const [refundAdjust, setRefundAdjust] = React.useState<Record<string, { refunded: number; cancelled: boolean }>>({})
  const [refundTarget, setRefundTarget] = React.useState<CustomerBookingEntry | null>(null)
  const entries = React.useMemo(
    () =>
      bookings.map((entry) => {
        const adj = refundAdjust[entry.id]
        if (!adj) return entry
        const refunded = entry.refunded + adj.refunded
        return {
          ...entry,
          refunded,
          paymentStatus:
            refunded > 0 && refunded >= entry.amountPaid
              ? ('refunded' as const)
              : refunded > 0
                ? ('partially_refunded' as const)
                : entry.paymentStatus,
          status: adj.cancelled ? ('cancelled' as const) : entry.status,
        }
      }),
    [bookings, refundAdjust],
  )
  const toRefundTarget = (entry: CustomerBookingEntry): RefundTarget => ({
    id: entry.id,
    reference: entry.reference,
    guestName: `${customer.firstName} ${customer.lastName}`,
    activityName: entry.activityName,
    departureAt: entry.departureAt,
    partySize: entry.partySize,
    status: entry.status,
    total: entry.total,
    amountPaid: entry.amountPaid,
    refunded: entry.refunded,
    fee: entry.amountPaid > 0 ? Math.round(entry.amountPaid * 0.029 + 30) : 0,
  })
  const handleRefund = (result: RefundResult) => {
    setRefundAdjust((prev) => {
      const next = { ...prev }
      for (const refund of result.refunds) {
        const current = next[refund.id] ?? { refunded: 0, cancelled: false }
        next[refund.id] = {
          refunded: current.refunded + refund.amount,
          cancelled: current.cancelled || result.cancelBooking,
        }
      }
      return next
    })
    const total = result.refunds.reduce((sum, r) => sum + r.amount, 0)
    toast.success(`Refunded ${formatCurrency(total, currency)} to ${customer.firstName}`, {
      description: result.notifyGuest
        ? 'Receipt emailed. Money lands in 5–10 business days.'
        : 'Money lands in 5–10 business days.',
    })
  }
  const fullName = `${customer.firstName} ${customer.lastName}`
  const segmentMeta = SEGMENT_META[customer.segment]
  const SegmentIcon = segmentMeta.icon

  const [tags, setTags] = React.useState<string[]>(customer.tags)
  const [optIn, setOptIn] = React.useState(customer.marketingOptIn)
  const [messageOpen, setMessageOpen] = React.useState(false)
  const [messageBody, setMessageBody] = React.useState('')
  const [noteDraft, setNoteDraft] = React.useState('')
  const [notes, setNotes] = React.useState<{ id: string; author: string; body: string; at: string }[]>(
    customer.notes
      ? [{ id: 'note-seed', author: operator.name, body: customer.notes, at: customer.createdAt }]
      : [],
  )

  const reviews = React.useMemo(
    () => bookings.filter((booking) => typeof booking.rating === 'number'),
    [bookings],
  )

  const copy = (value: string, label: string) => {
    void navigator.clipboard?.writeText(value)
    toast.success(`${label} copied`, { description: value })
  }

  const addNote = () => {
    const body = noteDraft.trim()
    if (!body) {
      toast.error('Write something first.')
      return
    }
    setNotes((current) => [
      { id: `note-${current.length + 1}`, author: operator.name, body, at: NOW.toISOString() },
      ...current,
    ])
    setNoteDraft('')
    toast.success('Note saved to this guest')
  }

  const sendMessage = () => {
    if (!messageBody.trim()) {
      toast.error('Your message is empty.')
      return
    }
    setMessageOpen(false)
    setMessageBody('')
    toast.success(`Message sent to ${customer.firstName}`, { description: customer.email })
  }

  return (
    <div className={cn('space-y-5', className)}>
      {/* ================= HERO ================= */}
      <Card variant="gradient" className="overflow-hidden">
        <CardContent className="pt-5 sm:pt-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <Avatar
                name={fullName}
                src={customer.avatarUrl}
                size="xl"
                className="shrink-0 ring-2 ring-surface shadow-md"
              />

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-xl leading-tight font-semibold tracking-tight text-foreground sm:text-2xl">
                    {fullName}
                  </h2>
                  <Badge
                    size="sm"
                    variant="neutral"
                    className={cn('border-transparent', segmentMeta.soft, segmentMeta.text)}
                  >
                    <SegmentIcon aria-hidden="true" />
                    {segmentMeta.label}
                  </Badge>
                  {optIn ? (
                    <Badge size="sm" variant="success">
                      <ShieldCheck aria-hidden="true" />
                      Opted in
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <ContactLine
                    icon={Mail}
                    onCopy={() => copy(customer.email, 'Email')}
                    copyLabel="Copy email address"
                  >
                    {customer.email}
                  </ContactLine>
                  <ContactLine
                    icon={Phone}
                    onCopy={() => copy(customer.phone, 'Phone number')}
                    copyLabel="Copy phone number"
                  >
                    {customer.phone}
                  </ContactLine>
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                    <MapPin className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
                    <span aria-hidden="true">{countryFlag(customer.country)}</span>
                    {countryName}
                  </span>
                </div>

                <p className="mt-2 text-xs text-subtle">
                  Guest since {formatDateLong(customer.createdAt)} · ID{' '}
                  <span className="font-mono text-[0.6875rem]">{customer.id}</span>
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                size="sm"
                leftIcon={<MessageSquare className="size-4" />}
                onClick={() => setMessageOpen(true)}
              >
                Message
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<CalendarPlus className="size-4" />}
                onClick={() =>
                  toast.success(`New booking started for ${customer.firstName}`, {
                    description: 'Guest details pre-filled from this profile.',
                  })
                }
              >
                New booking
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<SquarePen className="size-4" />}
                onClick={() => toast.info('Guest editor opened')}
              >
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton variant="ghost" size="sm" aria-label="More guest actions">
                    <MoreHorizontal />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => toast.success('Waiver link sent')}>
                    <CheckCheck />
                    Resend waiver link
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toast.success('Gift card issued')}>
                    <Gift />
                    Issue gift card
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => toast.success('Profile exported')}>
                    <ClipboardList />
                    Export profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    tone="danger"
                    onSelect={() => toast.warning(`${fullName} archived`)}
                  >
                    <UserRoundX />
                    Archive guest
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* ---- preferences ---- */}
          <div className="mt-5 grid gap-4 border-t border-line-subtle pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <div className="min-w-0">
              <Label className="mb-1.5 block" size="sm">
                Tags
              </Label>
              <TagInput
                value={tags}
                onValueChange={(next) => {
                  setTags(next)
                  toast.success('Tags updated', { description: next.join(', ') || 'All tags removed' })
                }}
                suggestions={tagSuggestions}
                label={`Tags for ${fullName}`}
                size="sm"
                placeholder="Add a tag…"
                max={8}
              />
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-line bg-surface/70 p-3">
              <Switch
                id="marketing-opt-in"
                checked={optIn}
                onCheckedChange={(next) => {
                  setOptIn(next)
                  toast.success(next ? 'Marketing emails enabled' : 'Marketing emails paused')
                }}
              />
              <div className="min-w-0">
                <Label htmlFor="marketing-opt-in" size="sm" className="cursor-pointer">
                  Marketing opt-in
                </Label>
                <p className="mt-0.5 text-xs text-subtle">
                  {optIn
                    ? 'Receives seasonal offers and re-book nudges.'
                    : 'Transactional email only — no campaigns.'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================= FACTS ================= */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <FactTile
          icon={Ticket}
          label="Trips"
          value={formatNumber(stats.totalBookings)}
          hint={
            stats.cancellations > 0
              ? `${stats.cancellations} cancelled`
              : 'No cancellations on file'
          }
        />
        <FactTile
          icon={TrendingUp}
          tone="brand"
          label="Lifetime value"
          value={formatCurrency(stats.lifetimeValue, currency)}
          hint={`${formatNumber(stats.guestsHosted)} guests hosted`}
        />
        <FactTile
          icon={CreditCard}
          label="Average order"
          value={formatCurrency(stats.avgOrderValue, currency)}
          hint={methods.length > 0 ? `${methods.length} payment method${methods.length === 1 ? '' : 's'}` : 'No cards on file'}
        />
        <FactTile
          icon={CalendarPlus}
          label="First seen"
          value={stats.firstSeenAt ? formatDateShort(stats.firstSeenAt) : '—'}
          hint={stats.firstSeenAt ? formatRelative(stats.firstSeenAt, NOW) : 'No bookings yet'}
        />
        <FactTile
          icon={Users}
          label="Last seen"
          value={stats.lastSeenAt ? formatDateShort(stats.lastSeenAt) : '—'}
          hint={stats.lastSeenAt ? formatRelative(stats.lastSeenAt, NOW) : 'No bookings yet'}
        />
        <FactTile
          icon={Star}
          label="Rating given"
          value={stats.ratingCount > 0 ? stats.avgRating.toFixed(1) : '—'}
          hint={
            stats.ratingCount > 0
              ? `${stats.ratingCount} review${stats.ratingCount === 1 ? '' : 's'} left`
              : 'Never rated a trip'
          }
        />
      </div>

      {/* ================= BODY ================= */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* ---- trip history ---- */}
        <RefundDialog
          open={refundTarget !== null}
          onOpenChange={(open) => {
            if (!open) setRefundTarget(null)
          }}
          targets={refundTarget ? [toRefundTarget(refundTarget)] : []}
          currency={currency}
          onConfirm={handleRefund}
        />

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Booking history</CardTitle>
              <p className="mt-1 text-xs text-muted">
                {formatNumber(bookings.length)} bookings, newest first
              </p>
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => toast.success('Trip history exported')}
            >
              Export
            </Button>
          </CardHeader>

          <CardContent>
            {bookings.length === 0 ? (
              <EmptyState
                variant="no-data"
                size="sm"
                icon={Ticket}
                title="No bookings yet"
                description="This guest is on file but has never travelled with you."
              />
            ) : (
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-3 bottom-6 left-[0.4375rem] w-px bg-gradient-to-b from-line via-line to-transparent"
                />
                <StaggerGroup as="ol" stagger={0.04} className="space-y-2.5">
                  {entries.map((booking) => (
                    <StaggerItem as="li" key={booking.id} className="relative pl-7">
                      <span
                        aria-hidden="true"
                        className="absolute top-[1.4rem] left-0 size-[0.9375rem] rounded-full ring-4 ring-surface"
                        style={{ background: ACTIVITY_COLOR_VAR[booking.colorKey] }}
                      />

                      <div
                        className={cn(
                          'flex min-w-0 items-center gap-3 rounded-xl border border-line-subtle bg-surface-sunken/50 p-2.5',
                          'transition-[transform,border-color,box-shadow] duration-300 ease-[var(--ease-out-expo)]',
                          'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-sm',
                          'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                        )}
                      >
                        <span className="relative hidden size-14 shrink-0 overflow-hidden rounded-lg bg-surface-sunken sm:block">
                          <Image
                            src={booking.activityImage}
                            alt={booking.activityAlt}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/dashboard/activities/${booking.activityId}`}
                              className="truncate text-[0.8125rem] font-semibold text-foreground transition-colors hover:text-primary"
                            >
                              {booking.activityName}
                            </Link>
                            <span className="font-mono text-[0.625rem] text-faint">
                              {booking.reference}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted">
                            {formatDateLong(booking.departureAt)} · {formatTime(booking.departureAt)}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span className="inline-flex items-center gap-1 text-[0.6875rem] text-subtle">
                              <Users className="size-3" aria-hidden="true" />
                              {booking.partySize} {booking.partySize === 1 ? 'guest' : 'guests'}
                            </span>
                            <span className="text-[0.6875rem] text-faint" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-[0.6875rem] text-subtle">
                              {booking.channelLabel}
                            </span>
                            {typeof booking.rating === 'number' ? (
                              <>
                                <span className="text-[0.6875rem] text-faint" aria-hidden="true">
                                  ·
                                </span>
                                <StarRating value={booking.rating} size="xs" />
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <span className="tabular text-sm font-semibold text-foreground">
                            {formatCurrency(booking.total, currency)}
                          </span>
                          <span className="flex items-center gap-1.5">
                            {booking.refunded > 0 ? (
                              <span className="text-[0.6875rem] font-medium text-subtle tabular-nums">
                                {formatCurrency(booking.refunded, currency)} refunded
                              </span>
                            ) : null}
                            <StatusBadge kind="booking" status={booking.status} size="sm" />
                          </span>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton variant="ghost" size="xs" aria-label={`Actions for ${booking.reference}`}>
                              <MoreHorizontal />
                            </IconButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel>{booking.reference}</DropdownMenuLabel>
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/bookings/${booking.id}`}>
                                <ArrowUpRight />
                                Open reservation
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => toast.success(`Confirmation resent for ${booking.reference}`)}>
                              <Send />
                              Resend confirmation
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onSelect={() => setRefundTarget(booking)}
                              disabled={refundableAmount(booking) <= 0}
                            >
                              <RotateCcw />
                              {refundableAmount(booking) > 0 ? 'Refund…' : 'Nothing to refund'}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </StaggerItem>
                  ))}
                </StaggerGroup>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ---- side rail ---- */}
        <div className="space-y-5">
          {/* reviews */}
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Reviews left</CardTitle>
                <p className="mt-1 text-xs text-muted">
                  {stats.ratingCount > 0
                    ? `${stats.avgRating.toFixed(1)} average across ${stats.ratingCount}`
                    : 'Nothing written yet'}
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {reviews.length === 0 ? (
                <EmptyState
                  variant="no-data"
                  size="sm"
                  icon={Star}
                  hideMedallion
                  title="No reviews yet"
                  description="Send a follow-up after their next trip to ask for one."
                  action={
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => toast.success('Review request queued')}
                    >
                      Request a review
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {reviews.map((review) => (
                    <li
                      key={review.id}
                      className="rounded-xl border border-line-subtle bg-surface-sunken/50 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <StarRating value={review.rating ?? 0} size="xs" />
                        <span className="text-[0.6875rem] text-faint">
                          {formatDateShort(review.departureAt)}
                        </span>
                      </div>
                      {review.reviewText ? (
                        <p className="mt-2 text-xs leading-relaxed text-muted">
                          “{review.reviewText}”
                        </p>
                      ) : (
                        <p className="mt-2 text-xs text-faint italic">Rating only, no comment.</p>
                      )}
                      <p className="mt-2 truncate text-[0.6875rem] text-subtle">
                        {review.activityName}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* payment methods */}
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Payment methods</CardTitle>
                <p className="mt-1 text-xs text-muted">Seen on this guest’s bookings</p>
              </div>
            </CardHeader>
            <CardContent>
              {methods.length === 0 ? (
                <EmptyState
                  variant="no-data"
                  size="sm"
                  hideMedallion
                  icon={CreditCard}
                  title="No stored methods"
                  description="Every trip so far was settled at the dock."
                />
              ) : (
                <ul className="space-y-2">
                  {methods.map((method) => {
                    const Icon = METHOD_ICON[method.method]
                    return (
                      <li
                        key={method.id}
                        className="flex items-center gap-3 rounded-xl border border-line-subtle bg-surface-sunken/50 p-2.5"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-muted shadow-xs">
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-foreground">
                            {method.brand ?? METHOD_LABEL[method.method]}
                            {method.last4 ? (
                              <span className="font-mono text-subtle"> ···· {method.last4}</span>
                            ) : null}
                          </p>
                          <p className="truncate text-[0.6875rem] text-subtle">
                            {method.charges} {method.charges === 1 ? 'charge' : 'charges'} ·{' '}
                            {formatRelative(method.lastUsedAt, NOW)}
                          </p>
                        </div>
                        <span className="tabular shrink-0 text-xs font-medium text-muted">
                          {formatCurrency(method.total, currency, { compact: true })}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* internal notes */}
          <Card>
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>Internal notes</CardTitle>
                <p className="mt-1 text-xs text-muted">Only your team can see these</p>
              </div>
              <NotebookPen className="size-4 shrink-0 text-faint" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <Textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.currentTarget.value)}
                placeholder={`Add context about ${customer.firstName} — preferences, mobility, who to seat them with…`}
                rows={3}
                aria-label="New internal note"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[0.6875rem] text-faint">
                  Posting as {operator.name} · {operator.title}
                </p>
                <Button size="xs" onClick={addNote} leftIcon={<Send className="size-3.5" />}>
                  Save note
                </Button>
              </div>

              {notes.length > 0 ? (
                <ul className="mt-4 space-y-3 border-t border-line-subtle pt-3">
                  {notes.map((note) => (
                    <li key={note.id} className="flex gap-2.5">
                      <Avatar name={note.author} src={operator.avatarUrl} size="xs" className="mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[0.6875rem] text-subtle">
                          <span className="font-medium text-foreground">{note.author}</span> ·{' '}
                          {formatRelative(note.at, NOW)}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted">{note.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ================= MESSAGE SHEET ================= */}
      <Sheet open={messageOpen} onOpenChange={setMessageOpen}>
        <SheetContent side="right" className="flex flex-col">
          <SheetHeader>
            <SheetTitle>Message {customer.firstName}</SheetTitle>
            <SheetDescription>
              Goes out from your reservations inbox and threads into this guest’s timeline.
            </SheetDescription>
          </SheetHeader>

          <SheetBody className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-sunken/60 p-3">
              <Avatar name={fullName} src={customer.avatarUrl} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{fullName}</p>
                <p className="truncate text-xs text-subtle">{customer.email}</p>
              </div>
            </div>

            <div>
              <Label htmlFor="guest-message" size="sm" className="mb-1.5 block">
                Message
              </Label>
              <Textarea
                id="guest-message"
                value={messageBody}
                onChange={(event) => setMessageBody(event.currentTarget.value)}
                rows={8}
                placeholder={`Hi ${customer.firstName}, …`}
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                `Hi ${customer.firstName}, conditions look perfect for your trip — see you at the dock 15 minutes early.`,
                `Hi ${customer.firstName}, we’d love to have you back. Here’s 15% off your next charter.`,
                `Hi ${customer.firstName}, your waiver is still outstanding — it takes about a minute.`,
              ].map((template, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setMessageBody(template)}
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-[0.6875rem] text-muted transition-colors duration-200 hover:border-primary/50 hover:text-primary"
                >
                  Template {index + 1}
                </button>
              ))}
            </div>
          </SheetBody>

          <SheetFooter>
            <SheetClose asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </SheetClose>
            <Button size="sm" leftIcon={<Send className="size-4" />} onClick={sendMessage}>
              Send message
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
