'use client'

import * as React from 'react'
import Link from 'next/link'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { STAY_CHANNEL_LABEL, STAY_FLAG_LABEL, STAY_STATUS_META, type RatePlan, type Room, type RoomType, type Stay } from '@/lib/hospitality/types'
import { cn, formatCurrency, formatDateShort } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import { StatusWord, guestName } from './shared'

/* ==========================================================================
   <StaySheet> — one reservation, everything the desk needs to know about
   it, and the buttons that move it on. Shared by the front desk and the
   reservations list so a stay reads the same wherever it is opened.
   ========================================================================== */

export interface StaySheetProps {
  stay: Stay | null
  room: Room | null
  roomType: RoomType | null
  plan: RatePlan | null
  currency: CurrencyCode
  onClose: () => void
  /** Rendered in the footer; the caller decides which actions make sense. */
  actions?: React.ReactNode
}

export function StaySheet({ stay: s, room, roomType, plan, currency, onClose, actions }: StaySheetProps) {
  return (
    <Sheet open={s !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" size="md">
        {s ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <Avatar name={guestName(s.customer)} src={s.customer.avatarUrl} size="md" />
                <div className="min-w-0">
                  <SheetTitle className="flex items-center gap-2 truncate">
                    {guestName(s.customer)}
                    <StatusWord label={STAY_STATUS_META[s.status].label} tone={STAY_STATUS_META[s.status].tone} />
                  </SheetTitle>
                  <SheetDescription className="truncate">
                    {s.reference} · {STAY_CHANNEL_LABEL[s.channel]} · {s.customer.email}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-5">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[0.8125rem]">
                <Term label="Check-in" value={`${formatDateShort(`${s.checkIn}T12:00:00`)}${s.eta ? ` · around ${s.eta}` : ''}`} />
                <Term label="Check-out" value={`${formatDateShort(`${s.checkOut}T12:00:00`)} · ${s.nights} ${s.nights === 1 ? 'night' : 'nights'}`} />
                <Term label="Room" value={room ? `${room.number} · floor ${room.floor}` : 'Not assigned yet'} />
                <Term label="Type" value={roomType?.name ?? '—'} />
                <Term label="Guests" value={`${s.adults} ${s.adults === 1 ? 'adult' : 'adults'}${s.children ? ` · ${s.children} ${s.children === 1 ? 'child' : 'children'}` : ''}`} />
                <Term label="Rate" value={plan ? `${plan.name} · ${formatCurrency(s.nightlyRate, currency)} a night` : formatCurrency(s.nightlyRate, currency)} />
                <Term label="Phone" value={s.customer.phone} />
                <Term label="Booked" value={formatDateShort(s.createdAt)} />
              </dl>

              {s.flags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {s.flags.map((f) => (
                    <span key={f} className={cn('rounded-md px-2 py-0.5 text-xs', f === 'vip' ? 'bg-warning-soft text-foreground' : f === 'allergy' ? 'bg-danger-soft/60 text-foreground' : 'bg-surface-sunken text-muted')}>
                      {STAY_FLAG_LABEL[f]}
                    </span>
                  ))}
                </div>
              ) : null}

              {s.specialRequests ? (
                <div>
                  <p className="text-xs font-medium text-muted">Guest asked</p>
                  <p className="mt-1 text-[0.8125rem] text-foreground">{s.specialRequests}</p>
                </div>
              ) : null}

              <div className="rounded-lg border border-line">
                <dl className="flex flex-col divide-y divide-line-subtle text-[0.8125rem]">
                  <Money label={`Room · ${s.nights} × ${formatCurrency(s.nightlyRate, currency)}`} value={s.roomTotal} currency={currency} />
                  {s.extras.map((e) => (
                    <Money key={e.id} label={`${e.label}${e.qty > 1 ? ` × ${e.qty}` : ''}`} value={e.amount} currency={currency} />
                  ))}
                  <Money label="City tax" value={s.cityTax} currency={currency} />
                  <Money label="Total" value={s.total} currency={currency} strong />
                  <Money label="Paid" value={s.paid} currency={currency} />
                  <Money label={s.balance > 0 ? 'Balance due' : 'Balance'} value={s.balance} currency={currency} strong={s.balance > 0} tone={s.balance > 0 ? 'text-warning' : undefined} />
                </dl>
              </div>

              <p className="text-xs text-subtle">
                {plan?.cancellation ?? ''} {s.customer.totalBookings > 1 ? `Stayed ${s.customer.totalBookings} times.` : 'First stay.'}
              </p>
            </SheetBody>
            <SheetFooter className="flex-wrap gap-2">
              {actions}
              <Button asChild size="sm" variant="ghost" className="ml-auto">
                <Link href={`/dashboard/customers/${s.customer.id}`}>Guest profile</Link>
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="mt-0.5 truncate text-foreground">{value}</dd>
    </div>
  )
}

function Money({ label, value, currency, strong = false, tone }: { label: string; value: number; currency: CurrencyCode; strong?: boolean; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className={cn(strong ? 'text-foreground' : 'text-muted')}>{label}</dt>
      <dd className={cn('tabular-nums', strong ? 'text-foreground' : 'text-muted', tone)}>{formatCurrency(value, currency)}</dd>
    </div>
  )
}
