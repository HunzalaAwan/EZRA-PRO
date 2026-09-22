'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  ArrowUpRight,
  BadgeCheck,
  Ban,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  Ellipsis,
  FileText,
  Globe,
  Mail,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Receipt,
  RotateCcw,
  Send,
  ShieldCheck,
  ShieldAlert,
  Ship,
  Sparkles,
  Ticket,
  TriangleAlert,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import type { BookingLineItem, Payment, User } from '@/types'
import { CHANNEL_LABELS, CURRENT_TENANT, NOW, getUsersByTenant } from '@/lib/demo-core'
import type { BookingDetailData } from '@/lib/actions/dashboard'
import {
  cn,
  formatCurrency,
  formatDateLong,
  formatDateShort,
  formatDateTime,
  formatDuration,
  formatRelative,
  formatTime,
  initials,
} from '@/lib/utils'
import { Avatar, AvatarGroup } from '@/components/ui/avatar'
import { Badge, StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { RefundDialog, type RefundResult } from '@/components/dashboard/bookings/refund-dialog'
import { ChannelBadge } from '@/components/dashboard/bookings/bookings-table'

/* ==========================================================================
   SMALL PARTS
   ========================================================================== */

function SectionCard({
  title,
  icon: Icon,
  toolbar,
  children,
  className,
}: {
  title: React.ReactNode
  icon: LucideIcon
  toolbar?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="flex-row items-center justify-start gap-2 border-b border-line-subtle pb-3">
        <span
          aria-hidden="true"
          className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle"
        >
          <Icon className="size-3.5" />
        </span>
        <CardTitle className="text-sm">{title}</CardTitle>
        {toolbar ? <CardToolbar className="ml-auto">{toolbar}</CardToolbar> : null}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  )
}

function DataRow({
  label,
  children,
  icon: Icon,
}: {
  label: string
  children: React.ReactNode
  icon?: LucideIcon
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <span className="inline-flex shrink-0 items-center gap-1.5 text-muted">
        {Icon ? <Icon aria-hidden="true" className="size-3.5 text-faint" /> : null}
        {label}
      </span>
      <span className="min-w-0 text-right font-medium text-foreground">{children}</span>
    </div>
  )
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = 'danger',
  onConfirm,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  tone?: 'danger' | 'primary'
  onConfirm: () => void
  children?: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children ? <DialogBody>{children}</DialogBody> : null}
        <DialogFooter divider>
          <DialogClose asChild>
            <Button variant="secondary">Keep as is</Button>
          </DialogClose>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ==========================================================================
   TIMELINE
   Derived from real timestamps on the booking, its payments and its departure.
   ========================================================================== */

interface TimelineEvent {
  id: string
  at: string
  title: string
  body: string
  icon: LucideIcon
  tone: 'neutral' | 'success' | 'info' | 'warning' | 'danger'
}

const TIMELINE_TONE: Record<TimelineEvent['tone'], string> = {
  neutral: 'border-line bg-surface-sunken text-subtle',
  success: 'border-[color-mix(in_oklab,var(--success)_30%,transparent)] bg-success-soft text-success',
  info: 'border-[color-mix(in_oklab,var(--info)_30%,transparent)] bg-info-soft text-info',
  warning: 'border-[color-mix(in_oklab,var(--warning)_32%,transparent)] bg-warning-soft text-warning',
  danger: 'border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-soft text-danger',
}

function shiftIso(iso: string, minutes: number) {
  const d = new Date(iso)
  d.setMinutes(d.getMinutes() + minutes)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`
}

/* ==========================================================================
   CONTENT — shared by the full page and the side sheet
   ========================================================================== */

export interface BookingDetailContentProps {
  /** Fetched server-side (page) or via a Server Action (sheet) — never here. */
  detail: BookingDetailData
  /** `page` unlocks the two-column grid; `panel` stays single column inside a sheet. */
  layout?: 'page' | 'panel'
  /** Rendered in the header of the sheet variant so the panel can close itself. */
  onRequestClose?: () => void
  className?: string
}

export function BookingDetailContent({
  detail,
  layout = 'page',
  onRequestClose,
  className,
}: BookingDetailContentProps) {
  const reduceMotion = useReducedMotionSafe()
  const bookingId = detail.booking.id

  const staffById = React.useMemo(() => {
    const map = new Map<string, User>()
    for (const user of getUsersByTenant(CURRENT_TENANT.id)) map.set(user.id, user)
    return map
  }, [])

  const [checkedIn, setCheckedIn] = React.useState<Record<string, boolean>>({})
  const [notes, setNotes] = React.useState(detail?.booking.internalNotes ?? '')
  const [notesSaved, setNotesSaved] = React.useState(true)
  const [refundOpen, setRefundOpen] = React.useState(false)
  const [cancelOpen, setCancelOpen] = React.useState(false)

  // Re-seed local state when the sheet swaps to a different booking.
  React.useEffect(() => {
    const next = detail
    const seeded: Record<string, boolean> = {}
    if (next && (next.booking.status === 'checked_in' || next.booking.status === 'completed')) {
      for (const p of next.booking.participants) seeded[p.id] = true
    }
    setCheckedIn(seeded)
    setNotes(next?.booking.internalNotes ?? '')
    setNotesSaved(true)
  }, [bookingId, detail])

  if (!detail) {
    return (
      <EmptyState
        variant="error"
        title="Reservation not found"
        description="This confirmation reference does not match anything in the current workspace."
        action={
          <Button asChild variant="secondary">
            <Link href="/dashboard/bookings">Back to reservations</Link>
          </Button>
        }
      />
    )
  }

  const { booking, activity, customer, departure, payments } = detail
  const currency = booking.currency
  const guestName = `${customer.firstName} ${customer.lastName}`
  const hero = activity.media.find((m) => m.isPrimary) ?? activity.media[0]
  const staff = departure.assignedStaffIds
    .map((id) => staffById.get(id))
    .filter((u): u is User => Boolean(u))

  const balance = Math.max(0, booking.total - booking.amountPaid)
  const checkedInCount = booking.participants.filter((p) => checkedIn[p.id]).length
  const waiversSigned = booking.participants.filter((p) => p.waiverSigned).length
  const checkedInPercent =
    booking.participants.length === 0
      ? 0
      : Math.round((checkedInCount / booking.participants.length) * 100)

  const isClosed =
    booking.status === 'cancelled' ||
    booking.status === 'refunded' ||
    booking.status === 'completed'

  /* ----------------------------------------------------------------------
     Line items
     ---------------------------------------------------------------------- */
  const grouped: Record<BookingLineItem['kind'], BookingLineItem[]> = {
    ticket: [],
    addon: [],
    fee: [],
    discount: [],
    tax: [],
  }
  for (const item of booking.lineItems) grouped[item.kind].push(item)

  /* ----------------------------------------------------------------------
     Timeline
     ---------------------------------------------------------------------- */
  const timeline: TimelineEvent[] = [
    {
      id: 'created',
      at: booking.createdAt,
      title: 'Reservation created',
      body: `${CHANNEL_LABELS[booking.channel]}${booking.source ? ` · ${booking.source}` : ''} · ${
        booking.partySize
      } ${booking.partySize === 1 ? 'guest' : 'guests'}`,
      icon: Ticket,
      tone: 'neutral',
    },
  ]

  if (booking.status !== 'pending') {
    timeline.push({
      id: 'confirmed',
      at: shiftIso(booking.createdAt, 3),
      title: 'Confirmation sent',
      body: `Emailed to ${customer.email}`,
      icon: Mail,
      tone: 'info',
    })
  }

  for (const payment of payments) {
    timeline.push({
      id: `pay-${payment.id}`,
      at: payment.createdAt,
      title:
        payment.amount < 0
          ? `Refund issued · ${formatCurrency(Math.abs(payment.amount), currency)}`
          : `Payment ${payment.status === 'succeeded' ? 'captured' : payment.status} · ${formatCurrency(
              payment.amount,
              currency,
            )}`,
      body: paymentMethodLabel(payment),
      icon: payment.amount < 0 ? RotateCcw : CreditCard,
      tone: payment.amount < 0 ? 'warning' : payment.status === 'failed' ? 'danger' : 'success',
    })
  }

  const reminderAt = shiftIso(departure.startsAt, -24 * 60)
  if (reminderAt < formatIsoLocal(NOW) && booking.status !== 'cancelled') {
    timeline.push({
      id: 'reminder',
      at: reminderAt,
      title: 'Trip reminder sent',
      body: `Meeting point, kit list and arrival time · SMS + email`,
      icon: Send,
      tone: 'info',
    })
  }

  if (booking.status === 'checked_in' || booking.status === 'completed') {
    timeline.push({
      id: 'checked-in',
      at: shiftIso(departure.startsAt, -25),
      title: 'Party checked in at the dock',
      body: `${booking.partySize} of ${booking.partySize} guests scanned`,
      icon: BadgeCheck,
      tone: 'success',
    })
  }

  if (booking.status === 'completed') {
    timeline.push({
      id: 'completed',
      at: departure.endsAt,
      title: 'Trip completed',
      body: booking.rating
        ? `Guest left ${booking.rating.toFixed(1)}★${booking.reviewText ? ' with a written review' : ''}`
        : 'Awaiting guest review',
      icon: Check,
      tone: 'neutral',
    })
  }

  if (booking.cancelledAt) {
    timeline.push({
      id: 'cancelled',
      at: booking.cancelledAt,
      title: 'Reservation cancelled',
      body: booking.cancellationReason ?? 'No reason recorded',
      icon: Ban,
      tone: 'danger',
    })
  }

  timeline.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))

  /* ----------------------------------------------------------------------
     Actions
     ---------------------------------------------------------------------- */
  const toggleParticipant = (id: string, next: boolean) => {
    setCheckedIn((prev) => ({ ...prev, [id]: next }))
  }

  const checkInAll = () => {
    const next: Record<string, boolean> = {}
    for (const p of booking.participants) next[p.id] = true
    setCheckedIn(next)
    toast.success(`${guestName}'s party is checked in`, {
      description: `${booking.participants.length} ${
        booking.participants.length === 1 ? 'guest' : 'guests'
      } marked present for ${activity.name}.`,
    })
  }

  const actions = {
    message: () =>
      toast.success('Message composer opened', {
        description: `Drafting to ${customer.email}.`,
      }),
    resend: () =>
      toast.success('Confirmation resent', {
        description: `${booking.reference} sent to ${customer.email}.`,
      }),
    modify: () =>
      toast('Modify reservation', {
        description: 'Change the departure, party size or add-ons, then re-price.',
      }),
    refund: (result: RefundResult) =>
      toast.success(
        `Refund of ${formatCurrency(result.refunds.reduce((sum, r) => sum + r.amount, 0), currency)} queued`,
        {
          description: result.cancelBooking
            ? 'Seats released. Funds return to the original payment method in 5-10 business days.'
            : 'Funds return to the original payment method in 5-10 business days.',
        },
      ),
    cancel: () =>
      toast.error(`${booking.reference} cancelled`, {
        description: `${booking.partySize} ${
          booking.partySize === 1 ? 'seat' : 'seats'
        } released back to ${formatDateShort(departure.startsAt)} · ${formatTime(departure.startsAt)}.`,
      }),
  }

  const mainClass = layout === 'page' ? 'lg:col-span-3' : ''
  const asideClass = layout === 'page' ? 'lg:col-span-2' : ''

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* ==================================================================
          HEADER
          ================================================================== */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {booking.reference}
              </h2>
              <StatusBadge kind="booking" status={booking.status} />
              <StatusBadge kind="payment" status={booking.paymentStatus} />
            </div>
            <p className="mt-1.5 text-sm text-subtle">
              Booked {formatRelative(booking.createdAt, NOW)} ·{' '}
              <span className="tabular-nums">{formatDateTime(booking.createdAt)}</span> via{' '}
              {CHANNEL_LABELS[booking.channel]}
            </p>
          </div>

          {onRequestClose ? (
            <Button asChild variant="secondary" size="sm" rightIcon={<ArrowUpRight />}>
              <Link href={`/dashboard/bookings/${booking.id}`}>Open full record</Link>
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isClosed ? (
            <Button
              size="sm"
              variant="primary"
              leftIcon={<BadgeCheck />}
              onClick={checkInAll}
              disabled={checkedInCount === booking.participants.length}
            >
              {checkedInCount === booking.participants.length ? 'Checked in' : 'Check in party'}
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" leftIcon={<MessageSquare />} onClick={actions.message}>
            Message guest
          </Button>
          <Button size="sm" variant="secondary" leftIcon={<Send />} onClick={actions.resend}>
            <span className="hidden sm:inline">Resend confirmation</span>
            <span className="sm:hidden">Resend</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton aria-label="More reservation actions" size="sm" variant="secondary">
                <Ellipsis />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={actions.modify}>
                <Pencil />
                Modify reservation
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  toast.success('Invoice downloaded', { description: `${booking.reference}.pdf` })
                }
              >
                <FileText />
                Download invoice
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                tone="danger"
                onSelect={() => setRefundOpen(true)}
                disabled={booking.amountPaid <= 0}
              >
                <RotateCcw />
                Issue refund
              </DropdownMenuItem>
              <DropdownMenuItem
                tone="danger"
                onSelect={() => setCancelOpen(true)}
                disabled={isClosed}
              >
                <Ban />
                Cancel reservation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {balance > 0 && booking.status !== 'cancelled' ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-[color-mix(in_oklab,var(--warning)_32%,transparent)] bg-warning-soft px-3 py-2.5">
            <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-warning" />
            <p className="text-[0.8125rem] text-foreground">
              <span className="font-semibold text-warning">
                {formatCurrency(balance, currency)} outstanding
              </span>{' '}
              — collect before boarding on {formatDateShort(departure.startsAt)}.
            </p>
          </div>
        ) : null}
      </div>

      {/* ==================================================================
          BODY
          ================================================================== */}
      <div className={cn('grid gap-4', layout === 'page' && 'lg:grid-cols-5 lg:items-start')}>
        {/* ---------------- MAIN COLUMN ---------------- */}
        <div className={cn('flex min-w-0 flex-col gap-4', mainClass)}>
          {/* Departure */}
          <SectionCard
            title="Departure"
            icon={CalendarDays}
            toolbar={
              <Button asChild variant="ghost" size="xs" rightIcon={<ChevronRight />}>
                <Link href="/dashboard/calendar">View on calendar</Link>
              </Button>
            }
          >
            <div className="flex gap-3.5">
              {hero ? (
                <div className="relative hidden size-20 shrink-0 overflow-hidden rounded-xl border border-line-subtle sm:block">
                  <Image
                    src={hero.url}
                    alt={hero.alt}
                    width={160}
                    height={160}
                    className="size-full object-cover"
                  />
                </div>
              ) : null}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href="/dashboard/activities"
                    className="font-display text-base font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
                  >
                    {activity.name}
                  </Link>
                  <StatusBadge kind="departure" status={departure.status} size="sm" />
                </div>
                <p className="mt-0.5 text-[0.8125rem] text-subtle">{activity.tagline}</p>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.8125rem]">
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                    <CalendarDays aria-hidden="true" className="size-3.5 text-faint" />
                    {formatDateLong(departure.startsAt)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground tabular-nums">
                    <Clock aria-hidden="true" className="size-3.5 text-faint" />
                    {formatTime(departure.startsAt)} – {formatTime(departure.endsAt)}
                    <span className="text-subtle">({formatDuration(activity.durationMinutes)})</span>
                  </span>
                </div>

                <p className="mt-2 inline-flex items-start gap-1.5 text-[0.8125rem] text-muted">
                  <MapPin aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-faint" />
                  {activity.meetingPoint}
                </p>
              </div>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AvatarGroup
                  avatars={staff.map((u) => ({ id: u.id, name: u.name, src: u.avatarUrl }))}
                  size="sm"
                  max={4}
                  label="Crew assigned to this departure"
                  ringClassName="ring-surface"
                />
                <div className="min-w-0">
                  <p className="text-[0.8125rem] font-medium text-foreground">
                    {staff.length > 0 ? staff.map((u) => u.name).join(', ') : 'Crew not assigned'}
                  </p>
                  <p className="text-xs text-subtle">
                    {staff.length > 0 ? staff.map((u) => u.title).join(' · ') : 'Assign from the calendar'}
                  </p>
                </div>
              </div>

              <Badge variant="neutral" size="sm">
                <Users aria-hidden="true" />
                {departure.booked}/{departure.capacity} seats sold
              </Badge>
            </div>
          </SectionCard>

          {/* Participants */}
          <SectionCard
            title={`Participants · ${booking.participants.length}`}
            icon={Users}
            toolbar={
              <Button
                variant="ghost"
                size="xs"
                leftIcon={<BadgeCheck />}
                onClick={checkInAll}
                disabled={checkedInCount === booking.participants.length}
              >
                Check in all
              </Button>
            }
          >
            <div className="mb-4 flex items-center gap-3">
              <Progress
                value={checkedInPercent}
                size="sm"
                tone={checkedInPercent === 100 ? 'success' : 'primary'}
                aria-label="Check-in progress"
                className="flex-1"
              />
              <span className="shrink-0 text-xs font-medium text-muted tabular-nums">
                {checkedInCount}/{booking.participants.length} checked in
              </span>
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 text-xs font-medium',
                  waiversSigned === booking.participants.length ? 'text-success' : 'text-warning',
                )}
              >
                {waiversSigned === booking.participants.length ? (
                  <ShieldCheck aria-hidden="true" className="size-3.5" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="size-3.5" />
                )}
                {waiversSigned}/{booking.participants.length} waivers
              </span>
            </div>

            <ul className="flex flex-col divide-y divide-line-subtle">
              {booking.participants.map((participant) => {
                const name = `${participant.firstName} ${participant.lastName}`
                const isIn = Boolean(checkedIn[participant.id])
                return (
                  <li key={participant.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                        'transition-colors duration-300 ease-[var(--ease-out-expo)]',
                        isIn
                          ? 'border-[color-mix(in_oklab,var(--success)_35%,transparent)] bg-success-soft text-success'
                          : 'border-line bg-surface-sunken text-subtle',
                      )}
                    >
                      {isIn ? <Check className="size-4" /> : initials(name)}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate text-sm font-medium text-foreground">{name}</span>
                        <Badge variant="neutral" size="sm">
                          {participant.tierLabel}
                        </Badge>
                        {typeof participant.age === 'number' ? (
                          <span className="text-xs text-subtle tabular-nums">
                            age {participant.age}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Badge
                          variant={participant.waiverSigned ? 'success' : 'warning'}
                          size="sm"
                        >
                          {participant.waiverSigned ? (
                            <ShieldCheck aria-hidden="true" />
                          ) : (
                            <ShieldAlert aria-hidden="true" />
                          )}
                          {participant.waiverSigned ? 'Waiver signed' : 'Waiver pending'}
                        </Badge>
                        {participant.notes ? (
                          <span className="truncate text-xs text-warning">{participant.notes}</span>
                        ) : null}
                      </div>
                    </div>

                    <Switch
                      checked={isIn}
                      onCheckedChange={(next) => toggleParticipant(participant.id, next)}
                      aria-label={`Check in ${name}`}
                    />
                  </li>
                )
              })}
            </ul>
          </SectionCard>

          {/* Order summary */}
          <SectionCard title="Order summary" icon={Receipt}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[22rem] text-sm">
                <caption className="sr-only">Itemised charges for {booking.reference}</caption>
                <thead>
                  <tr className="border-b border-line-subtle text-left">
                    <th scope="col" className="pb-2 text-xs font-medium text-subtle">
                      Item
                    </th>
                    <th scope="col" className="pb-2 text-right text-xs font-medium text-subtle">
                      Qty
                    </th>
                    <th scope="col" className="pb-2 text-right text-xs font-medium text-subtle">
                      Unit
                    </th>
                    <th scope="col" className="pb-2 text-right text-xs font-medium text-subtle">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {(['ticket', 'addon', 'discount', 'fee', 'tax'] as const).flatMap((kind) =>
                    grouped[kind].map((item) => (
                      <tr key={item.id}>
                        <td className="py-2 pr-3">
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className={cn(
                                'grid size-6 shrink-0 place-items-center rounded-md',
                                kind === 'ticket' && 'bg-primary-soft text-primary',
                                kind === 'addon' && 'bg-accent-soft text-accent',
                                kind === 'discount' && 'bg-success-soft text-success',
                                (kind === 'fee' || kind === 'tax') &&
                                  'bg-surface-sunken text-subtle',
                              )}
                            >
                              {kind === 'ticket' ? (
                                <Ticket className="size-3" />
                              ) : kind === 'addon' ? (
                                <Sparkles className="size-3" />
                              ) : kind === 'discount' ? (
                                <Ticket className="size-3" />
                              ) : (
                                <Receipt className="size-3" />
                              )}
                            </span>
                            <span className="min-w-0 truncate font-medium text-foreground">
                              {item.label}
                            </span>
                          </span>
                        </td>
                        <td className="py-2 text-right text-muted tabular-nums">{item.quantity}</td>
                        <td className="py-2 text-right text-muted tabular-nums">
                          {formatCurrency(item.unitPrice, currency, { decimals: true })}
                        </td>
                        <td
                          className={cn(
                            'py-2 text-right font-medium tabular-nums',
                            item.total < 0 ? 'text-success' : 'text-foreground',
                          )}
                        >
                          {formatCurrency(item.total, currency, { decimals: true })}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 rounded-xl bg-surface-sunken p-3.5">
              <div className="flex flex-col divide-y divide-line-subtle">
                <DataRow label="Subtotal">
                  <span className="tabular-nums">
                    {formatCurrency(booking.subtotal, currency, { decimals: true })}
                  </span>
                </DataRow>
                {booking.discountTotal > 0 ? (
                  <DataRow label={booking.promoCode ? `Discount (${booking.promoCode})` : 'Discount'}>
                    <span className="text-success tabular-nums">
                      −{formatCurrency(booking.discountTotal, currency, { decimals: true })}
                    </span>
                  </DataRow>
                ) : null}
                {booking.feeTotal > 0 ? (
                  <DataRow label="Booking fee">
                    <span className="tabular-nums">
                      {formatCurrency(booking.feeTotal, currency, { decimals: true })}
                    </span>
                  </DataRow>
                ) : null}
                {booking.taxTotal > 0 ? (
                  <DataRow label="Tax">
                    <span className="tabular-nums">
                      {formatCurrency(booking.taxTotal, currency, { decimals: true })}
                    </span>
                  </DataRow>
                ) : null}
              </div>

              <Separator className="my-2.5" tone="strong" />

              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-semibold text-foreground">Total</span>
                <span className="font-display text-xl font-semibold tracking-tight text-foreground tabular-nums">
                  {formatCurrency(booking.total, currency, { decimals: true })}
                </span>
              </div>

              <div className="mt-2 flex flex-col divide-y divide-line-subtle">
                <DataRow label="Amount paid">
                  <span className="text-success tabular-nums">
                    {formatCurrency(booking.amountPaid, currency, { decimals: true })}
                  </span>
                </DataRow>
                <DataRow label="Balance due">
                  <span className={cn('tabular-nums', balance > 0 ? 'text-warning' : 'text-muted')}>
                    {formatCurrency(balance, currency, { decimals: true })}
                  </span>
                </DataRow>
                {typeof booking.refundAmount === 'number' && booking.refundAmount > 0 ? (
                  <DataRow label="Refunded">
                    <span className="text-danger tabular-nums">
                      −{formatCurrency(booking.refundAmount, currency, { decimals: true })}
                    </span>
                  </DataRow>
                ) : null}
              </div>
            </div>

            {/* Payments */}
            <div className="mt-4">
              <h4 className="mb-2 text-xs font-semibold tracking-wider text-faint uppercase">
                Payments
              </h4>
              {payments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-[0.8125rem] text-subtle">
                  No payment captured yet — this reservation is held on account.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-center gap-3 rounded-xl border border-line-subtle bg-surface px-3 py-2.5"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'grid size-8 shrink-0 place-items-center rounded-lg',
                          payment.amount < 0
                            ? 'bg-warning-soft text-warning'
                            : payment.status === 'failed'
                              ? 'bg-danger-soft text-danger'
                              : 'bg-success-soft text-success',
                        )}
                      >
                        {payment.amount < 0 ? (
                          <RotateCcw className="size-4" />
                        ) : (
                          <Wallet className="size-4" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[0.8125rem] font-medium text-foreground">
                          {paymentMethodLabel(payment)}
                        </span>
                        <span className="block text-xs text-subtle tabular-nums">
                          {formatDateTime(payment.createdAt)} · fee{' '}
                          {formatCurrency(Math.abs(payment.processorFee), currency, {
                            decimals: true,
                          })}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span
                          className={cn(
                            'block text-[0.8125rem] font-semibold tabular-nums',
                            payment.amount < 0 ? 'text-warning' : 'text-foreground',
                          )}
                        >
                          {formatCurrency(payment.amount, currency, { decimals: true })}
                        </span>
                        <Badge
                          variant={
                            payment.status === 'succeeded'
                              ? 'success'
                              : payment.status === 'failed'
                                ? 'danger'
                                : payment.status === 'refunded'
                                  ? 'warning'
                                  : 'neutral'
                          }
                          size="sm"
                          className="capitalize"
                        >
                          {payment.status}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </SectionCard>
        </div>

        {/* ---------------- ASIDE COLUMN ---------------- */}
        <div className={cn('flex min-w-0 flex-col gap-4', asideClass)}>
          {/* Guest */}
          <SectionCard
            title="Guest"
            icon={Users}
            toolbar={
              <Button asChild variant="ghost" size="xs" rightIcon={<ChevronRight />}>
                <Link href={`/dashboard/customers/${customer.id}`}>Profile</Link>
              </Button>
            }
          >
            <div className="flex items-center gap-3">
              <Avatar name={guestName} src={customer.avatarUrl} size="lg" />
              <div className="min-w-0">
                <p className="truncate font-display text-base font-semibold tracking-tight text-foreground">
                  {guestName}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant={
                      customer.segment === 'vip'
                        ? 'accent'
                        : customer.segment === 'returning'
                          ? 'success'
                          : customer.segment === 'lapsed'
                            ? 'warning'
                            : 'neutral'
                    }
                    size="sm"
                    className="capitalize"
                  >
                    {customer.segment === 'vip' ? 'VIP guest' : customer.segment}
                  </Badge>
                  {customer.marketingOptIn ? (
                    <Badge variant="outline" size="sm">
                      Opted in
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-col divide-y divide-line-subtle">
              <DataRow label="Email" icon={Mail}>
                <a
                  href={`mailto:${customer.email}`}
                  className="truncate text-primary transition-colors hover:text-primary-hover hover:underline"
                >
                  {customer.email}
                </a>
              </DataRow>
              <DataRow label="Phone" icon={Phone}>
                <a
                  href={`tel:${customer.phone.replace(/[^\d+]/g, '')}`}
                  className="tabular-nums text-primary transition-colors hover:text-primary-hover hover:underline"
                >
                  {customer.phone}
                </a>
              </DataRow>
              <DataRow label="Country" icon={Globe}>
                {customer.country}
              </DataRow>
              <DataRow label="Lifetime value" icon={Wallet}>
                <span className="tabular-nums">
                  {formatCurrency(customer.lifetimeValue, currency)}
                </span>
              </DataRow>
              <DataRow label="Trips booked" icon={Ticket}>
                <Link
                  href={`/dashboard/customers/${customer.id}`}
                  className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary-hover hover:underline"
                >
                  <span className="tabular-nums">{customer.totalBookings}</span>
                  <ChevronRight aria-hidden="true" className="size-3.5" />
                </Link>
              </DataRow>
            </div>

            {customer.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line-subtle pt-3">
                {customer.tags.map((tag) => (
                  <Badge key={tag} variant="outline" size="sm">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </SectionCard>

          {/* Channel + source */}
          <SectionCard title="Source" icon={Ship}>
            <div className="flex flex-col divide-y divide-line-subtle">
              <DataRow label="Channel">
                <ChannelBadge channel={booking.channel} />
              </DataRow>
              {booking.source ? <DataRow label="Referrer">{booking.source}</DataRow> : null}
              <DataRow label="Booked">
                <span className="tabular-nums">{formatDateTime(booking.createdAt)}</span>
              </DataRow>
              <DataRow label="Last updated">
                <span className="tabular-nums">{formatRelative(booking.updatedAt, NOW)}</span>
              </DataRow>
            </div>
            {booking.notes ? (
              <p className="mt-3 rounded-xl bg-surface-sunken p-3 text-[0.8125rem] text-muted">
                <span className="font-medium text-foreground">Guest note · </span>
                {booking.notes}
              </p>
            ) : null}
          </SectionCard>

          {/* Timeline */}
          <SectionCard title="Activity" icon={ClipboardList}>
            <ol className="relative flex flex-col gap-4 pl-1">
              <span
                aria-hidden="true"
                className="absolute top-2 bottom-2 left-[1.0625rem] w-px bg-line"
              />
              {timeline.map((event, index) => {
                const Icon = event.icon
                return (
                  <motion.li
                    key={event.id}
                    initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.32, delay: reduceMotion ? 0 : index * 0.04 }}
                    className="relative flex gap-3"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'relative z-10 grid size-[1.875rem] shrink-0 place-items-center rounded-full border',
                        TIMELINE_TONE[event.tone],
                      )}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                        <span className="text-[0.8125rem] font-medium text-foreground">
                          {event.title}
                        </span>
                        <span className="shrink-0 text-xs text-faint tabular-nums">
                          {formatRelative(event.at, NOW)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs text-subtle">{event.body}</span>
                    </span>
                  </motion.li>
                )
              })}
            </ol>
          </SectionCard>

          {/* Internal notes */}
          <SectionCard
            title="Internal notes"
            icon={FileText}
            toolbar={
              <AnimatePresence initial={false}>
                {!notesSaved ? (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Button
                      size="xs"
                      variant="primary"
                      leftIcon={<Check />}
                      onClick={() => {
                        setNotesSaved(true)
                        toast.success('Note saved to the reservation')
                      }}
                    >
                      Save
                    </Button>
                  </motion.span>
                ) : null}
              </AnimatePresence>
            }
          >
            <Textarea
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value)
                setNotesSaved(false)
              }}
              rows={4}
              placeholder="Visible to your team only — dietary needs, pickup quirks, who to call on the day…"
              aria-label="Internal notes"
            />
            <p className="mt-2 text-xs text-faint">
              Notes never appear on guest-facing confirmations or the storefront.
            </p>
          </SectionCard>
        </div>
      </div>

      {/* ==================================================================
          DESTRUCTIVE CONFIRMATIONS
          ================================================================== */}
      <RefundDialog
        open={refundOpen}
        onOpenChange={setRefundOpen}
        targets={[
          {
            id: booking.id,
            reference: booking.reference,
            guestName,
            activityName: activity.name,
            departureAt: departure.startsAt,
            partySize: booking.partySize,
            status: booking.status,
            total: booking.total,
            amountPaid: booking.amountPaid,
            refunded: booking.refundAmount ?? 0,
            fee: booking.amountPaid > 0 ? Math.round(booking.amountPaid * 0.029 + 30) : 0,
          },
        ]}
        currency={currency}
        onConfirm={actions.refund}
      />

      <ConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title={`Cancel ${booking.reference}?`}
        description={`${booking.partySize} ${
          booking.partySize === 1 ? 'seat' : 'seats'
        } will be released back to ${activity.name} on ${formatDateShort(departure.startsAt)}.`}
        confirmLabel="Cancel reservation"
        onConfirm={() => {
          actions.cancel()
          onRequestClose?.()
        }}
      >
        <p className="text-sm text-muted">{activity.cancellationPolicy.summary}</p>
      </ConfirmDialog>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

const PAYMENT_METHOD_LABEL: Record<Payment['method'], string> = {
  card: 'Card',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  cash: 'Cash at the dock',
  bank_transfer: 'Bank transfer',
  gift_card: 'Gift card',
}

function paymentMethodLabel(payment: Payment) {
  const base = PAYMENT_METHOD_LABEL[payment.method]
  if (payment.brand && payment.last4) return `${base} · ${payment.brand} ···· ${payment.last4}`
  if (payment.last4) return `${base} ···· ${payment.last4}`
  return base
}

function formatIsoLocal(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/* ==========================================================================
   FULL-PAGE WRAPPER
   ========================================================================== */

export interface BookingDetailProps {
  detail: BookingDetailData
  className?: string
}

export function BookingDetail({ detail, className }: BookingDetailProps) {
  return <BookingDetailContent detail={detail} layout="page" className={className} />
}
