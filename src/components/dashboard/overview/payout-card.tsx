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

   A bright card on the overview: a white ground washed with lilac, pink and
   gold, with slow weather moving behind dark ink. It reads from the same
   settlement seam as the Payments page, so the figure here is the figure
   there: what lands next, what is in transit, what has already landed this
   month, and what the processor took. The palette is fixed rather than
   themed, so the card stays bright in dark mode, like a card in a wallet.
   ========================================================================== */

/** Lilac into pink, warming to gold at the far corner, all on white. */
const GROUND =
  'linear-gradient(135deg, color-mix(in oklab, white 78%, var(--color-reef-500)) 0%, color-mix(in oklab, white 74%, var(--aurora-pink)) 52%, color-mix(in oklab, white 66%, var(--accent)) 100%)'
/** Field order follows CardAurora's light layout: top-right, bottom-left, lower-middle. */
const FIELDS = ['var(--aurora-pink)', 'var(--color-reef-500)', 'var(--accent)']
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
        <span className="inline-flex items-center gap-1 tabular-nums">
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
        'relative isolate flex flex-col overflow-hidden rounded-2xl border border-white/70 bg-white p-5 text-ink-950 shadow-md sm:p-6',
        className,
      )}
    >
      <CardAurora tone="light" fields={3} colors={FIELDS} ground={GROUND} ring ringColors={RING} intensity={2.4} />

      {/* ---------- what lands next ---------- */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-ink-950/60 uppercase">Next payout</p>
          <p className="mt-1.5 text-[0.8125rem] font-medium text-ink-950/80">Arrives {arrives(balance.nextPayoutAt)}</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/75 text-reef-700 shadow-xs ring-1 ring-white/80 ring-inset">
          <Landmark aria-hidden="true" className="size-4" strokeWidth={1.9} />
        </span>
      </div>

      <CountUp
        value={balance.nextPayoutAmount}
        format="currency"
        currency={currency}
        duration={1.3}
        className="mt-5 block font-display text-[2.25rem] leading-none font-semibold tracking-[-0.035em] text-ink-950"
      />
      <p className="mt-2.5 font-mono text-[0.75rem] tracking-[0.06em] text-ink-950/65">{balance.destination}</p>

      {/* ---------- the money around it ---------- */}
      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-ink-950/10 pt-5">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0">
            <dt className="truncate text-[0.6875rem] font-medium text-ink-950/60">{figure.label}</dt>
            <dd className="mt-1 font-display text-[1.0625rem] leading-none font-semibold text-ink-950 tabular-nums">{figure.value}</dd>
            <dd className="mt-1.5 text-[0.6875rem] text-ink-950/60">{figure.note}</dd>
          </div>
        ))}
      </dl>

      <Link
        href="/dashboard/payments"
        className={cn(
          'mt-5 inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full bg-white/80 px-3.5 text-[0.8125rem] font-semibold text-reef-700 shadow-xs ring-1 ring-white/80 ring-inset',
          'transition-colors duration-200 hover:bg-white',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-reef-700',
        )}
      >
        View payouts
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
      </Link>
    </section>
  )
}
