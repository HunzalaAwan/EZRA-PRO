'use client'

import Link from 'next/link'
import { ArrowUpRight, Landmark } from 'lucide-react'

import { CountUp } from '@/components/motion/count-up'
import { CardAurora } from '@/components/dashboard/overview/card-aurora'
import { cn, formatCurrency } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   PayoutCard — the money on its way to the bank.

   The one dark surface on the overview, sized and placed like a bank card,
   with slow weather moving behind the numbers:
   what settles next, when it lands, and the account it lands in. Next-day
   payouts are the product's sharpest edge, so they get the sharpest card.
   ========================================================================== */

export interface PayoutCardProps {
  /** Takings that settle on the next business day. */
  nextPayout: number
  /** Human date the payout lands, e.g. "Mon, Sep 14". */
  arrivesOn: string
  /** Takings already settled in the trailing window. */
  paidOut: number
  paidOutLabel: string
  /** Masked destination account, e.g. "Bank of Hawaii ···· 4421". */
  account: string
  currency: CurrencyCode
  className?: string
}

export function PayoutCard({
  nextPayout,
  arrivesOn,
  paidOut,
  paidOutLabel,
  account,
  currency,
  className,
}: PayoutCardProps) {
  return (
    <section
      aria-label="Payouts"
      className={cn(
        'relative isolate flex flex-col overflow-hidden rounded-2xl bg-navy-deep p-5 text-white shadow-md sm:p-6',
        className,
      )}
    >
      <CardAurora tone="dark" fields={3} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-white/60 uppercase">Next payout</p>
          <p className="mt-1 text-[0.8125rem] text-white/80">Arrives {arrivesOn}</p>
        </div>
        <span className="grid size-9 place-items-center rounded-xl bg-white/12 text-white">
          <Landmark aria-hidden="true" className="size-4" strokeWidth={1.9} />
        </span>
      </div>

      <CountUp
        value={nextPayout}
        format="currency"
        currency={currency}
        duration={1.3}
        className="mt-6 block font-display text-[2.25rem] leading-none font-semibold tracking-[-0.035em] text-white"
      />
      <p className="mt-3 font-mono text-[0.8125rem] tracking-[0.08em] text-white/70">{account}</p>

      <dl className="mt-auto grid grid-cols-2 gap-4 border-t border-white/12 pt-4">
        <div>
          <dt className="text-[0.6875rem] text-white/55">{paidOutLabel}</dt>
          <dd className="mt-1 font-display text-lg leading-none font-semibold tabular-nums">
            {formatCurrency(paidOut, currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6875rem] text-white/55">Settlement</dt>
          <dd className="mt-1 font-display text-base leading-none font-semibold whitespace-nowrap">Next business day</dd>
        </div>
      </dl>

      <Link
        href="/dashboard/payments"
        className={cn(
          'mt-5 inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[0.8125rem] font-semibold text-white',
          'transition-colors duration-200 hover:bg-white/16',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        )}
      >
        View payouts
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
      </Link>
    </section>
  )
}
