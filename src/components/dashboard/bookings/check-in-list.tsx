'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  Check,
  CircleAlert,
  ExternalLink,
  Phone,
  Search,
  ShieldAlert,
  ShieldCheck,
  StickyNote,
  UserX,
} from 'lucide-react'

import type { Booking, Customer, CurrencyCode } from '@/types'
import type { ManifestRow } from '@/lib/demo'
import { formatAnswer, shortOption } from '@/lib/guest-requirements'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'
import { cn, formatCurrency } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { SearchInput } from '@/components/ui/search-input'
import { SimpleTooltip } from '@/components/ui/tooltip'

/* ==========================================================================
   PROGRESS RING
   Read at arm's length on a phone in direct sun: heavy stroke, high contrast,
   the count in the middle rather than a percentage.
   ========================================================================== */

export interface CheckInRingProps {
  checkedIn: number
  total: number
  size?: number
  className?: string
}

export function CheckInRing({ checkedIn, total, size = 56, className }: CheckInRingProps) {
  const reduceMotion = useReducedMotionSafe()
  const stroke = size >= 56 ? 6 : size >= 44 ? 5 : 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const ratio = total === 0 ? 0 : Math.min(1, checkedIn / total)
  const complete = total > 0 && checkedIn >= total

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${checkedIn} of ${total} guests checked in`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-line" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={complete ? 'stroke-success' : 'stroke-primary'}
          style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          strokeDasharray={circumference}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - ratio) }}
          transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        {complete ? (
          <Check aria-hidden="true" className={cn('text-success', size >= 48 ? 'size-5' : 'size-4')} />
        ) : (
          <span
            className={cn(
              'font-display font-semibold text-foreground tabular-nums',
              size >= 48 ? 'text-sm' : 'text-xs',
            )}
          >
            {checkedIn}
            <span className="text-faint">/{total}</span>
          </span>
        )}
      </span>
    </div>
  )
}

/* ==========================================================================
   CHECK-IN TOGGLE
   A 44px target with a travelling knob — unmistakable at a glance, and the
   label never relies on colour alone.
   ========================================================================== */

function CheckInToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  const reduceMotion = useReducedMotionSafe()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-11 w-[6rem] shrink-0 items-center rounded-full border-2 px-1',
        'transition-colors duration-300 ease-[var(--ease-out-expo)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'active:scale-[0.97] motion-reduce:active:scale-100 print:hidden',
        checked ? 'border-success bg-success-soft' : 'border-line-strong bg-surface-sunken hover:border-primary/60',
      )}
    >
      <motion.span
        aria-hidden="true"
        layout
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34 }}
        className={cn(
          'grid size-8 place-items-center rounded-full shadow-sm',
          checked ? 'ml-auto bg-success text-background' : 'mr-auto bg-surface text-subtle',
        )}
      >
        <Check aria-hidden="true" className="size-4" />
      </motion.span>
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 grid place-items-center text-xs font-bold tracking-wide uppercase',
          checked ? 'left-3 text-success' : 'right-2.5 text-subtle',
        )}
      >
        {checked ? 'In' : 'Check in'}
      </span>
    </button>
  )
}

/* ==========================================================================
   LIST
   ========================================================================== */

interface PartyRowData {
  booking: Booking
  customer: Customer
  tiers: string
  waivers: { signed: number; total: number }
  notes: string[]
  /** Sizes and key answers, for the crew: "Wetsuit M, L · Fins S". */
  gear: string
}

function buildParties(row: ManifestRow): PartyRowData[] {
  const customerById = new Map(row.customers.map((c) => [c.id, c]))

  return row.bookings
    .filter((booking) => booking.status !== 'cancelled' && booking.status !== 'refunded')
    .map((booking) => {
      const counts = new Map<string, number>()
      let signed = 0
      const notes: string[] = []

      for (const participant of booking.participants) {
        counts.set(participant.tierLabel, (counts.get(participant.tierLabel) ?? 0) + 1)
        if (participant.waiverSigned) signed += 1
        if (participant.notes) notes.push(`${participant.firstName}: ${participant.notes}`)
      }
      if (booking.notes) notes.unshift(booking.notes)
      const questions = row.activity.guestQuestions ?? []
      const gear = questions
        .filter((question) => question.gear || question.kind === 'number')
        .map((question) => {
          const values = booking.participants
            .map((participant) => participant.answers?.[question.id])
            .filter((value): value is string => Boolean(value))
            .map((value) => (question.gear ? shortOption(value) : formatAnswer(question, value)))
          return values.length > 0 ? `${question.label.replace(/ size.*$/i, '')} ${values.join(', ')}` : ''
        })
        .filter(Boolean)
        .join(' · ')

      return {
        booking,
        customer: customerById.get(booking.customerId)!,
        tiers: Array.from(counts.entries())
          .map(([label, count]) => `${count}× ${label}`)
          .join(' · '),
        waivers: { signed, total: booking.participants.length },
        notes,
        gear,
      }
    })
    .filter((party) => Boolean(party.customer))
    .sort((a, b) => a.customer.lastName.localeCompare(b.customer.lastName))
}

/** Notes that the crew must not miss get a louder treatment. */
const CRITICAL = /(allerg|asthma|medical|epipen|diabet|pregnan|wheelchair|non-swimmer|seizure|heart)/i

export interface CheckInListProps {
  row: ManifestRow
  /** Keyed by booking id. */
  checkedIn: Record<string, boolean>
  onToggle: (bookingId: string, next: boolean) => void
  onCheckInAll: () => void
  onMarkNoShow: (bookingId: string) => void
  currency: CurrencyCode
  className?: string
}

export function CheckInList({
  row,
  checkedIn,
  onToggle,
  onCheckInAll,
  onMarkNoShow,
  currency,
  className,
}: CheckInListProps) {
  const [query, setQuery] = React.useState('')
  const parties = React.useMemo(() => buildParties(row), [row])
  /* A party without every waiver signed needs a reason before it checks in. */
  const [pending, setPending] = React.useState<PartyRowData | null>(null)
  const [reason, setReason] = React.useState<string>('Signed on paper at the desk')
  const confirmPending = () => {
    if (!pending) return
    onToggle(pending.booking.id, true)
    toast.success(`${pending.customer.firstName} ${pending.customer.lastName} checked in`, { description: `Waiver override: ${reason}.` })
    setPending(null)
  }

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return parties
    return parties.filter(
      (party) =>
        `${party.customer.firstName} ${party.customer.lastName}`.toLowerCase().includes(needle) ||
        party.booking.reference.toLowerCase().includes(needle) ||
        party.customer.phone.includes(needle),
    )
  }, [parties, query])

  const guestsExpected = parties.reduce((sum, p) => sum + p.booking.partySize, 0)
  const guestsIn = parties.reduce((sum, p) => sum + (checkedIn[p.booking.id] ? p.booking.partySize : 0), 0)
  const waiversOutstanding = parties.filter((p) => p.waivers.signed < p.waivers.total).length
  const allIn = parties.length > 0 && parties.every((p) => checkedIn[p.booking.id])

  if (parties.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">
        No guests booked on this departure yet.
      </p>
    )
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* ---- toolbar ------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <CheckInRing checkedIn={guestsIn} total={guestsExpected} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {guestsIn} of {guestsExpected} guests aboard
          </p>
          <p className="text-xs text-subtle tabular-nums">
            {parties.length} {parties.length === 1 ? 'party' : 'parties'}
            {waiversOutstanding > 0 ? ` · ${waiversOutstanding} waiver${waiversOutstanding === 1 ? '' : 's'} outstanding` : ' · all waivers signed'}
          </p>
        </div>
        {parties.length > 5 ? (
          <div className="w-full sm:w-56 print:hidden">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              debounceMs={0}
              size="sm"
              tone="sunken"
              label="Find a guest on this departure"
              placeholder="Find a guest…"
              shortcut={false}
            />
          </div>
        ) : null}
        <Button
          variant={allIn ? 'secondary' : 'primary'}
          size="sm"
          leftIcon={<Check />}
          onClick={onCheckInAll}
          disabled={allIn}
          className="print:hidden"
        >
          {allIn ? 'All aboard' : 'Check in all'}
        </Button>
      </div>

      {/* ---- rows ---------------------------------------------------------- */}
      <ul className="flex flex-col gap-1.5">
        {visible.map((party) => {
          const name = `${party.customer.firstName} ${party.customer.lastName}`
          const isIn = Boolean(checkedIn[party.booking.id])
          const waiverOk = party.waivers.signed === party.waivers.total
          const missing = party.waivers.total - party.waivers.signed
          const balance = Math.max(0, party.booking.total - party.booking.amountPaid)
          const tel = party.customer.phone.replace(/[^\d+]/g, '')

          return (
            <li
              key={party.booking.id}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                'transition-[background-color,border-color] duration-300 ease-[var(--ease-out-expo)]',
                'print:break-inside-avoid print:border print:p-2',
                isIn ? 'border-[color-mix(in_oklab,var(--success)_40%,transparent)] bg-success-soft/40' : 'border-line bg-surface',
              )}
            >
              <Avatar name={name} src={party.customer.avatarUrl} size="sm" className="shrink-0" />

              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate text-[0.9375rem] font-semibold text-foreground">{name}</span>
                  <span className="text-xs font-medium text-muted tabular-nums">×{party.booking.partySize}</span>
                  {party.customer.segment === 'vip' ? (
                    <Badge variant="accent" size="sm">
                      VIP
                    </Badge>
                  ) : null}
                  {balance > 0 ? (
                    <Badge variant="danger" size="sm" className="tabular-nums">
                      {formatCurrency(balance, currency)} due
                    </Badge>
                  ) : null}
                </p>
                <p className="mt-0.5 truncate text-xs text-subtle">
                  <span className="font-mono tracking-tight">{party.booking.reference}</span>
                  {party.tiers ? <span> · {party.tiers}</span> : null}
                </p>
                {party.gear ? <p className="mt-0.5 truncate text-xs font-medium text-muted">{party.gear}</p> : null}

                {party.notes.length > 0 ? (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {party.notes.map((note, index) => {
                      const critical = CRITICAL.test(note)
                      return (
                        <li
                          key={`${party.booking.id}-note-${index}`}
                          className={cn(
                            'flex items-start gap-1.5 rounded-lg px-2 py-1 text-xs',
                            critical ? 'bg-danger-soft font-medium text-danger' : 'bg-surface-sunken text-muted',
                          )}
                        >
                          {critical ? (
                            <CircleAlert aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                          ) : (
                            <StickyNote aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                          )}
                          <span className="min-w-0">{note}</span>
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>

              {/* ---- quiet indicators + actions ------------------------------ */}
              <div className="flex shrink-0 items-center gap-1 print:hidden">
                <SimpleTooltip label={waiverOk ? 'All waivers signed' : `${missing} waiver${missing === 1 ? '' : 's'} to sign`}>
                  <span
                    tabIndex={0}
                    role="img"
                    aria-label={waiverOk ? 'All waivers signed' : `${missing} waivers to sign`}
                    className={cn(
                      'grid size-8 place-items-center rounded-lg',
                      waiverOk ? 'text-success' : 'bg-warning-soft text-warning',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                    )}
                  >
                    {waiverOk ? <ShieldCheck aria-hidden="true" className="size-4" /> : <ShieldAlert aria-hidden="true" className="size-4" />}
                  </span>
                </SimpleTooltip>
                <SimpleTooltip label={party.customer.phone}>
                  <IconButton asChild variant="ghost" size="sm" aria-label={`Call ${name}`} className="hidden sm:inline-flex">
                    <a href={`tel:${tel}`}>
                      <Phone />
                    </a>
                  </IconButton>
                </SimpleTooltip>
                <SimpleTooltip label="Open booking">
                  <IconButton asChild variant="ghost" size="sm" aria-label={`Open booking ${party.booking.reference}`} className="hidden sm:inline-flex">
                    <Link href={`/dashboard/bookings/${party.booking.id}`}>
                      <ExternalLink />
                    </Link>
                  </IconButton>
                </SimpleTooltip>
                {!isIn ? (
                  <SimpleTooltip label="Mark as no-show">
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label={`Mark ${name} as a no-show`}
                      onClick={() => onMarkNoShow(party.booking.id)}
                      className="text-faint hover:text-danger"
                    >
                      <UserX />
                    </IconButton>
                  </SimpleTooltip>
                ) : null}
                <CheckInToggle
                  checked={isIn}
                  onChange={(next) => (next && !waiverOk ? setPending(party) : onToggle(party.booking.id, next))}
                  label={`Check in ${name}, party of ${party.booking.partySize}`}
                />
              </div>
              {/* Paper manifests get a tick box instead of the toggle. */}
              <span aria-hidden="true" className="hidden size-6 shrink-0 rounded border border-line-strong print:block" />
            </li>
          )
        })}
      </ul>

      {visible.length === 0 ? (
        <p className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-6 text-sm text-subtle">
          <Search aria-hidden="true" className="size-4" />
          No guest on this departure matches “{query.trim()}”.
        </p>
      ) : null}
      <Dialog open={pending !== null} onOpenChange={(value) => !value && setPending(null)}>
        <DialogContent size="sm">
          <DialogHeader divider>
            <DialogTitle>Waiver not signed</DialogTitle>
            <DialogDescription>
              {pending ? `${pending.waivers.total - pending.waivers.signed} of ${pending.waivers.total} guests in ${pending.customer.lastName}'s party have not signed. Record why they can go.` : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-2 py-4">
            {['Signed on paper at the desk', 'Signing on their phone now', 'Manager approved'].map((option) => (
              <label key={option} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm', reason === option ? 'border-primary bg-primary-soft/30' : 'border-line')}>
                <input type="radio" name="waiver-override" className="accent-[var(--primary)]" checked={reason === option} onChange={() => setReason(option)} />
                {option}
              </label>
            ))}
          </DialogBody>
          <DialogFooter divider>
            <Button variant="ghost" size="sm" onClick={() => setPending(null)}>
              Not yet
            </Button>
            <Button size="sm" onClick={confirmPending}>
              Check in anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
