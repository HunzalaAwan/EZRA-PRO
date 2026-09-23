'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays, CheckCircle2, Lock, MapPin, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useCharterRequests } from '@/hooks/use-charter-requests'
import { formatCurrency, formatDateLong, formatTime } from '@/lib/utils'
import type { CharterRequest, CurrencyCode } from '@/types'

/* ==========================================================================
   The guest's side of a charter quote: what was offered, what the deposit
   is, and a button to pay it. Paying marks the request paid in the inbox.
   ========================================================================== */

export function QuoteView({
  requestId,
  tenantId,
  tenantSlug,
  tenantName,
  currency,
  seeded,
  charters,
}: {
  requestId: string
  tenantId: string
  tenantSlug: string
  tenantName: string
  currency: CurrencyCode
  seeded: CharterRequest[]
  charters: { slug: string; name: string; image: string; meetingPoint: string; tiers: { id: string; label: string }[] }[]
}) {
  const { requests, markPaid } = useCharterRequests(tenantSlug, tenantId, seeded)
  const [paying, setPaying] = React.useState(false)
  const request = requests.find((entry) => entry.id === requestId)
  const charter = charters.find((entry) => entry.slug === request?.activitySlug)

  const shell = 'mx-auto w-full max-w-2xl px-4 pb-20 pt-28 sm:px-6'

  if (!request || !request.quote) {
    return (
      <div className={shell}>
        <h1 className="font-display text-2xl font-semibold tracking-tight">This quote is not ready yet</h1>
        <p className="mt-2 text-muted">{tenantName} will email you as soon as it is. If you think this is a mistake, reply to their last email.</p>
        <Button asChild variant="outline" className="mt-6">
          <Link href={`/book/${tenantSlug}`}>Back to {tenantName}</Link>
        </Button>
      </div>
    )
  }

  const { quote } = request
  const deposit = Math.round((quote.amount * quote.depositPercent) / 100)
  const paid = request.status === 'paid'

  return (
    <div className={shell}>
      <p className="text-xs font-semibold tracking-[0.12em] text-faint uppercase">Private charter quote</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{charter?.name ?? 'Your charter'}</h1>
      <p className="mt-1 text-muted">For {request.name}, from {tenantName}.</p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface">
        {charter?.image ? (
          <div className="relative aspect-[16/7] bg-surface-sunken">
            <Image src={charter.image} alt="" fill priority sizes="(max-width: 700px) 100vw, 672px" className="object-cover" />
          </div>
        ) : null}
        <dl className="grid gap-4 p-5 text-sm sm:grid-cols-3">
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-4 text-primary" aria-hidden="true" />
            <div>
              <dt className="text-xs text-subtle">When</dt>
              <dd className="font-medium">{formatDateLong(new Date(request.startsAt))} · {formatTime(request.startsAt)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 size-4 text-primary" aria-hidden="true" />
            <div>
              <dt className="text-xs text-subtle">Group</dt>
              <dd className="font-medium">{request.party} guests</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-4 text-primary" aria-hidden="true" />
            <div>
              <dt className="text-xs text-subtle">Meet</dt>
              <dd className="font-medium">{charter?.meetingPoint.split(' — ')[0] ?? 'Confirmed by email'}</dd>
            </div>
          </div>
        </dl>
        {quote.note ? <p className="border-t border-line-subtle px-5 py-4 text-sm leading-relaxed text-muted">{quote.note}</p> : null}
        <div className="space-y-2 border-t border-line-subtle px-5 py-4 text-sm">
          <div className="flex justify-between"><span className="text-muted">Charter</span><span className="font-medium tabular-nums">{formatCurrency(quote.amount, currency)}</span></div>
          <div className="flex justify-between"><span className="text-muted">Deposit ({quote.depositPercent}%)</span><span className="font-semibold tabular-nums">{formatCurrency(deposit, currency)}</span></div>
          <div className="flex justify-between text-xs text-subtle"><span>Balance before the day</span><span className="tabular-nums">{formatCurrency(quote.amount - deposit, currency)}</span></div>
        </div>
      </div>

      {paid ? (
        <div role="status" className="mt-6 rounded-2xl border border-success/40 bg-success-soft px-5 py-4">
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            Deposit paid. Your charter is confirmed.
          </p>
          <p className="mt-1 text-sm text-muted">A receipt is on its way to {request.email}. {tenantName} will be in touch about the details.</p>
        </div>
      ) : (
        <div className="mt-6">
          <Button
            size="lg"
            fullWidth
            loading={paying}
            leftIcon={<Lock aria-hidden="true" />}
            onClick={() => {
              setPaying(true)
              window.setTimeout(() => {
                markPaid(request.id)
                setPaying(false)
              }, 1100)
            }}
          >
            Pay the {formatCurrency(deposit, currency)} deposit
          </Button>
          <p className="mt-2 text-center text-xs text-faint">This quote is valid until {formatDateLong(new Date(`${quote.validUntil}T12:00:00`))}.</p>
        </div>
      )}
    </div>
  )
}
