'use client'

import { CountUp } from '@/components/motion/count-up'
import { Marquee } from '@/components/motion/marquee'
import { Reveal } from '@/components/motion/reveal'
import { cn } from '@/lib/utils'

/* ==========================================================================
   ProofStrip — the breadth of the customer base as a moving line of trades,
   then three numbers. Short on purpose; it sits between the product and the
   price and should be read in the time it takes to scroll past.
   ========================================================================== */

const TRADES = [
  'Sunrise kayak tours',
  "Chef's tables",
  'Wedding venues',
  'Pottery classes',
  'Escape rooms',
  'Wine tastings',
  'Boat charters',
  'Yoga studios',
  'Cooking schools',
  'Rooftop bars',
  'Hot-air balloons',
  'Supper clubs',
  'Ski schools',
  'Museum timed entry',
  'Spa treatments',
  'Food walks',
]

const NUMBERS: { value: number; prefix?: string; suffix?: string; decimals?: number; label: string }[] = [
  { value: 2.4, prefix: '$', suffix: 'B', decimals: 1, label: 'taken through EZRA checkouts in the last twelve months' },
  { value: 11800, label: 'tours, tables, classes and events selling today' },
  { value: 1, suffix: ' business day', label: 'from a card payment to money in your bank' },
]

export function ProofStrip({ className }: { className?: string }) {
  return (
    <section aria-label="Who uses EZRA" className={cn('border-y border-line bg-surface-sunken py-12 sm:py-14', className)}>
      <Marquee speed={42} pauseOnHover fade={false} gap={0} className="text-foreground">
        <ul className="flex items-center" aria-label="Types of business on EZRA">
          {TRADES.map((trade) => (
            <li key={trade} className="flex items-center">
              <span className="font-display text-[1.375rem] font-semibold tracking-[-0.02em] whitespace-nowrap sm:text-2xl">
                {trade}
              </span>
              <span aria-hidden="true" className="mx-5 size-1.5 rounded-full bg-primary sm:mx-7" />
            </li>
          ))}
        </ul>
      </Marquee>

      <div className="mx-auto mt-10 grid max-w-7xl gap-6 px-4 sm:mt-12 sm:grid-cols-3 sm:gap-8 sm:px-6 lg:px-8">
        {NUMBERS.map((n, i) => (
          <Reveal key={n.label} delay={i * 0.08} className="border-l-2 border-primary pl-4">
            <p className="font-display text-3xl font-semibold tracking-[-0.03em] text-foreground tabular-nums sm:text-4xl">
              <CountUp value={n.value} prefix={n.prefix} suffix={n.suffix} decimals={n.decimals} duration={1.4} />
            </p>
            <p className="mt-1.5 max-w-[16rem] text-sm leading-snug text-muted">{n.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
