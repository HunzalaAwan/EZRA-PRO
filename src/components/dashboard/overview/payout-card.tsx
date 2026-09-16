'use client'

import Link from 'next/link'
import { ArrowUpRight, Landmark, TrendingDown, TrendingUp } from 'lucide-react'

import { CountUp } from '@/components/motion/count-up'
import { CardAurora } from '@/components/dashboard/overview/card-aurora'
import type { PayoutBalance } from '@/components/dashboard/payments/payout-summary'
import { cn, formatCurrency, formatDelta, formatNumber, formatPercent, pluralize } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   PayoutCard — the money on its way to the bank.

   The one dark surface on the overview, sized and placed like a bank card,
   with slow weather in purple, pink and gold moving behind the numbers. It
   reads from the same settlement seam as the Payments page, so the figure
   here is the figure there: what lands next, what is in transit, what has
   already landed this month, and what the processor took.
   ========================================================================== */

/** Deep violet into pink, warming to gold at the far corner. */
const GROUND =
  'linear-gradient(135deg, var(--navy-deep) 0%, color-mix(in oklab, var(--navy-deep) 42%, var(--primary)) 36%, color-mix(in oklab, var(--navy-deep) 40%, var(--aurora-pink)) 70%, color-mix(in oklab, var(--navy-deep) 38%, var(--accent)) 100%)'
/** Field order follows CardAurora's dark layout: top-right glow, bottom-left, bottom-right. */
const FIELDS = ['var(--aurora-pink)', 'var(--primary)', 'var(--accent)']
const RING: [string, string] = ['var(--aurora-pink)', 'var(--accent)']

export interface PayoutCardProps {
  balance: PayoutBalance
  currency: CurrencyCode
  className?: string
}

function arrives(iso: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso))
}

export function PayoutCard({ balance, currency, className }: PayoutCardProps) {
  const GrossIcon = balance.grossDelta >= 0 ? TrendingUp : TrendingDown

  const figures: { label: string; value: string; note: React.ReactNode }[] = [
    {
      label: 'In transit',
      value: formatCurrency(balance.inTransit, currency),
      note: `${formatNumber(balance.inTransitTransactions)} ${pluralize(balance.inTransitTransactions, 'transaction')}`,
    },
    {
      label: 'Paid out this month',
      value: formatCurrency(balance.paidOutThisMonth, currency),
      note: `${formatNumber(balance.paidOutBatches)} settled ${pluralize(balance.paidOutBatches, 'batch', 'batches')}`,
    },
    {
      label: 'Gross · last 30 days',
      value: formatCurrency(balance.grossLast30, currency, { compact: true }),
      note: (
        <span className="inline-flex items-center gap-0.5 tabular-nums">
          <GrossIcon aria-hidden="true" className="size-3" strokeWidth={2.5} />
          {formatDelta(balance.grossDelta)} vs prior
        </span>
      ),
    },
    {
      label: 'Processing fees',
      value: formatCurrency(balance.processingFees, currency, { compact: true }),
      note: `${formatPercent(balance.feeRate, 2)} of gross`,
    },
  ]

  return (
    <section
      aria-label="Payouts"
      className={cn(
        'relative isolate flex flex-col overflow-hidden rounded-2xl bg-navy-deep p-5 text-white shadow-md sm:p-6',
        className,
      )}
    >
      <CardAurora tone="dark" fields={3} colors={FIELDS} ground={GROUND} ringColors={RING} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-white/60 uppercase">Next payout</p>
          <p className="mt-1 text-[0.8125rem] text-white/80">Arrives {arrives(balance.nextPayoutAt)}</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/12 text-white">
          <Landmark aria-hidden="true" className="size-4" strokeWidth={1.9} />
        </span>
      </div>

      <CountUp
        value={balance.nextPayoutAmount}
        format="currency"
        currency={currency}
        duration={1.3}
        className="mt-4 block font-display text-[2.25rem] leading-none font-semibold tracking-[-0.035em] text-white"
      />
      <p className="mt-2.5 font-mono text-[0.8125rem] tracking-[0.08em] text-white/70">{balance.destination}</p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/12 pt-4">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0">
            <dt className="truncate text-[0.6875rem] text-white/55">{figure.label}</dt>
            <dd className="mt-0.5 font-display text-base leading-none font-semibold tabular-nums">{figure.value}</dd>
            <dd className="mt-1 text-[0.6875rem] text-white/60">{figure.note}</dd>
          </div>
        ))}
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
