'use client'

import Link from 'next/link'
import { ArrowUpRight, Landmark } from 'lucide-react'

import { CountUp } from '@/components/motion/count-up'
import { CardAurora } from '@/components/dashboard/overview/card-aurora'
import type { PayoutBalance } from '@/components/dashboard/payments/payout-summary'
import { cn, formatCurrency, formatNumber, pluralize } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   PayoutCard — the money on its way to the bank.

   The one dark surface on the overview: deep navy into indigo, violet at
   the far corner, rich gold light from the top right, white ink and slow
   weather behind the numbers. It reads from the same settlement seam as
   the Payments page, so the figure here is the figure there: what lands
   next, what is in transit, what has already landed this month, and what
   the processor took. The palette is fixed rather than themed, so the card
   looks the same in dark mode.
   ========================================================================== */

/**
 * Deep navy into indigo, violet at the far corner, and rich gold light from
 * the top right. Every layer interpolates in OKLab along eased stops so the
 * tones melt into one another instead of meeting at an edge.
 */
/* Pinned tones so the card reads the same in both themes: light-mode gold, indigo, #601CEF and the deep navy ground. */
const GOLD = 'oklch(0.720 0.165 82)'
const INDIGO = 'oklch(0.520 0.160 275)'
const VIOLET = 'var(--color-reef-700)'
const NAVY = 'oklch(0.205 0.075 286)'
const wash = (color: string, alpha: number) => `color-mix(in oklab, ${color} ${Math.round(alpha * 100)}%, transparent)`
const GROUND = [
  `radial-gradient(in oklab 80% 70% at 92% 12%, ${wash(GOLD, 0.5)} 0%, ${wash(GOLD, 0.34)} 18%, ${wash(GOLD, 0.18)} 38%, ${wash(GOLD, 0.07)} 58%, ${wash(GOLD, 0.02)} 74%, transparent 88%)`,
  `radial-gradient(in oklab 70% 60% at 90% 95%, ${wash(VIOLET, 0.55)} 0%, ${wash(VIOLET, 0.3)} 30%, ${wash(VIOLET, 0.1)} 60%, transparent 85%)`,
  `linear-gradient(in oklab 140deg, ${NAVY} 0%, color-mix(in oklab, ${NAVY} 80%, ${INDIGO}) 30%, color-mix(in oklab, ${NAVY} 64%, ${INDIGO}) 55%, color-mix(in oklab, ${NAVY} 58%, ${VIOLET}) 80%, color-mix(in oklab, ${NAVY} 46%, ${VIOLET}) 100%)`,
].join(', ')
/** Field order follows CardAurora's dark layout: top-right glow, bottom-left, bottom-right. */
const FIELDS = [GOLD, INDIGO, VIOLET]
const RING: [string, string] = [INDIGO, GOLD]

export interface PayoutCardProps {
  balance: PayoutBalance
  currency: CurrencyCode
  className?: string
}

function arrives(iso: string) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(iso))
}

export function PayoutCard({ balance, currency, className }: PayoutCardProps) {
  const figures: { label: string; value: string }[] = [
    {
      label: 'In transit',
      value: formatCurrency(balance.inTransit, currency),
    },
    {
      label: 'Paid this month',
      value: formatCurrency(balance.paidOutThisMonth, currency),
    },
    {
      label: 'Fees · 30 days',
      value: formatCurrency(balance.processingFees, currency, { compact: true }),
    },
  ]

  return (
    <section
      aria-label="Payouts"
      className={cn(
        'relative isolate flex flex-col overflow-hidden rounded-2xl bg-[oklch(0.205_0.075_286)] p-5 text-white shadow-md sm:p-6',
        className,
      )}
    >
      <CardAurora tone="dark" fields={3} colors={FIELDS} ground={GROUND} ringColors={RING} intensity={0.85} />

      {/* ---------- what lands next ---------- */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.6875rem] font-semibold tracking-[0.12em] text-white/70 uppercase">Next payout</p>
          <p className="mt-1 text-[0.8125rem] text-white/85">Arrives {arrives(balance.nextPayoutAt)}</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/16 text-white ring-1 ring-white/20 ring-inset backdrop-blur-sm">
          <Landmark aria-hidden="true" className="size-4" strokeWidth={1.9} />
        </span>
      </div>

      <CountUp
        value={balance.nextPayoutAmount}
        format="currency"
        currency={currency}
        duration={1.3}
        className="mt-6 block font-display text-[2.25rem] leading-none font-semibold tracking-[-0.035em] text-white"
      />
      <p className="mt-3 font-mono text-[0.8125rem] tracking-[0.08em] text-white/75">{balance.destination}</p>

      {/* ---------- the money around it ---------- */}
      <dl className="mt-auto grid grid-cols-3 gap-4 border-t border-white/18 pt-4">
        {figures.map((figure) => (
          <div key={figure.label} className="min-w-0">
            <dt className="truncate text-[0.6875rem] font-medium text-white/65">{figure.label}</dt>
            <dd className="mt-1 font-display text-lg leading-none font-semibold whitespace-nowrap text-white tabular-nums">{figure.value}</dd>
          </div>
        ))}
      </dl>

      <Link
        href="/dashboard/payments"
        className={cn(
          'mt-5 inline-flex min-h-9 w-fit items-center gap-1.5 rounded-full bg-white/16 px-3.5 text-[0.8125rem] font-semibold text-white ring-1 ring-white/20 ring-inset backdrop-blur-sm',
          'transition-colors duration-200 hover:bg-white/26',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        )}
      >
        View payouts
        <ArrowUpRight aria-hidden="true" className="size-3.5" />
      </Link>
    </section>
  )
}
