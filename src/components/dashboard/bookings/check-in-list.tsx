'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'motion/react'
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
  Users,
} from 'lucide-react'

import type { Booking, Customer, CurrencyCode } from '@/types'
import type { ManifestRow } from '@/lib/demo'
import { cn, formatCurrency } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'

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
  const reduceMotion = useReducedMotion()
  const stroke = size >= 56 ? 6 : 5
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line"
        />
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
          <Check aria-hidden="true" className="size-5 text-success" />
        ) : (
          <span className="font-display text-sm font-semibold text-foreground tabular-nums">
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
   A 44px+ target with a travelling knob — unmistakable at a glance, and the
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
  const reduceMotion = useReducedMotion()

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-12 w-[6.5rem] shrink-0 items-center rounded-full border-2 px-1',
        'transition-colors duration-300 ease-[var(--ease-out-expo)]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'active:scale-[0.97] motion-reduce:active:scale-100 print:hidden',
        checked
          ? 'border-success bg-success-soft'
          : 'border-line-strong bg-surface-sunken hover:border-primary/60',
      )}
    >
      <motion.span
        aria-hidden="true"
        layout
        transition={
          reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34 }
        }
        className={cn(
          'grid size-9 place-items-center rounded-full shadow-sm',
          checked ? 'ml-auto bg-success text-background' : 'mr-auto bg-surface text-subtle',
        )}
      >
        {checked ? (
          <Check aria-hidden="true" className="size-5" />
        ) : (
          <Users aria-hidden="true" className="size-4" />
        )}
      </motion.span>
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 grid place-items-center text-[0.6875rem] font-bold tracking-wide uppercase',
          checked ? 'left-3 text-success' : 'right-3 text-subtle',
        )}
      >
        {checked ? 'In' : 'Check'}
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

      return {
        booking,
        customer: customerById.get(booking.customerId)!,
        tiers: Array.from(counts.entries())
          .map(([label, count]) => `${count}× ${label}`)
          .join(' · '),
        waivers: { signed, total: booking.participants.length },
        notes,
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
  const guestsIn = parties.reduce(
    (sum, p) => sum + (checkedIn[p.booking.id] ? p.booking.partySize : 0),
    0,
  )
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
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5">
        <CheckInRing checkedIn={guestsIn} total={guestsExpected} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground tabular-nums">
            {guestsIn} of {guestsExpected} guests aboard
          </p>
          <p className="text-xs text-subtle tabular-nums">
            {parties.length} {parties.length === 1 ? 'party' : 'parties'} ·{' '}
            {parties.filter((p) => p.waivers.signed < p.waivers.total).length} waiver
            {parties.filter((p) => p.waivers.signed < p.waivers.total).length === 1 ? '' : 's'}{' '}
            outstanding
          </p>
        </div>
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

      {parties.length > 6 ? (
        <SearchInput
          value={query}
          onValueChange={setQuery}
          debounceMs={0}
          size="lg"
          tone="sunken"
          label="Find a guest on this departure"
          placeholder="Find a guest…"
          shortcut={false}
          className="text-base"
          fieldClassName="print:hidden"
        />
      ) : null}

      {/* Rows */}
      <ul className="flex flex-col gap-2">
        {visible.map((party) => {
          const name = `${party.customer.firstName} ${party.customer.lastName}`
          const isIn = Boolean(checkedIn[party.booking.id])
          const waiverOk = party.waivers.signed === party.waivers.total
          const balance = Math.max(0, party.booking.total - party.booking.amountPaid)

          return (
            <li
              key={party.booking.id}
              className={cn(
                'flex items-center gap-3 rounded-2xl border-2 p-3',
                'transition-[background-color,border-color] duration-300 ease-[var(--ease-out-expo)]',
                'print:break-inside-avoid print:border print:p-2',
                isIn
                  ? 'border-[color-mix(in_oklab,var(--success)_45%,transparent)] bg-success-soft/60'
                  : 'border-line bg-surface',
              )}
            >
              <Avatar name={name} src={party.customer.avatarUrl} size="md" className="shrink-0" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate text-[0.9375rem] font-semibold text-foreground">
                    {name}
                  </span>
                  <Badge variant="neutral" size="sm" className="tabular-nums">
                    <Users aria-hidden="true" />
                    {party.booking.partySize}
                  </Badge>
                  {party.customer.segment === 'vip' ? (
                    <Badge variant="accent" size="sm">
                      VIP
                    </Badge>
                  ) : null}
                </div>

                <p className="mt-0.5 truncate text-xs text-muted">
                  <span className="font-mono tracking-tight">{party.booking.reference}</span>
                  {party.tiers ? <span> · {party.tiers}</span> : null}
                </p>

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant={waiverOk ? 'success' : 'warning'} size="sm">
                    {waiverOk ? (
                      <ShieldCheck aria-hidden="true" />
                    ) : (
                      <ShieldAlert aria-hidden="true" />
                    )}
                    {waiverOk
                      ? 'Waivers signed'
                      : `${party.waivers.total - party.waivers.signed} waiver${
                          party.waivers.total - party.waivers.signed === 1 ? '' : 's'
                        } to sign`}
                  </Badge>

                  {balance > 0 ? (
                    <Badge variant="danger" size="sm" className="tabular-nums">
                      {formatCurrency(balance, currency)} due
                    </Badge>
                  ) : null}

                  <a
                    href={`tel:${party.customer.phone.replace(/[^\d+]/g, '')}`}
                    className={cn(
                      'inline-flex h-6 items-center gap-1 rounded-full border border-line bg-surface px-2',
                      'text-[0.6875rem] font-medium text-muted tabular-nums transition-colors',
                      'hover:border-primary/50 hover:text-primary',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                    )}
                  >
                    <Phone aria-hidden="true" className="size-3" />
                    {party.customer.phone}
                  </a>

                  <Link
                    href={`/dashboard/bookings/${party.booking.id}`}
                    className={cn(
                      'inline-flex h-6 items-center gap-1 rounded-full border border-line bg-surface px-2',
                      'text-[0.6875rem] font-medium text-muted transition-colors print:hidden',
                      'hover:border-primary/50 hover:text-primary',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                    )}
                  >
                    <ExternalLink aria-hidden="true" className="size-3" />
                    Booking
                  </Link>
                </div>

                {party.notes.length > 0 ? (
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {party.notes.map((note, index) => {
                      const critical = CRITICAL.test(note)
                      return (
                        <li
                          key={`${party.booking.id}-note-${index}`}
                          className={cn(
                            'flex items-start gap-1.5 rounded-lg px-2 py-1 text-xs',
                            critical
                              ? 'bg-danger-soft font-medium text-danger'
                              : 'bg-surface-sunken text-muted',
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

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <CheckInToggle
                  checked={isIn}
                  onChange={(next) => onToggle(party.booking.id, next)}
                  label={`Check in ${name}, party of ${party.booking.partySize}`}
                />
                {!isIn ? (
                  <button
                    type="button"
                    onClick={() => onMarkNoShow(party.booking.id)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.6875rem] font-medium',
                      'text-faint transition-colors hover:text-danger print:hidden',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                    )}
                  >
                    <UserX aria-hidden="true" className="size-3" />
                    No-show
                  </button>
                ) : null}
                {/* Paper manifests get a tick box instead of the toggle. */}
                <span
                  aria-hidden="true"
                  className="hidden size-6 rounded border border-line-strong print:block"
                />
              </div>
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
    </div>
  )
}
