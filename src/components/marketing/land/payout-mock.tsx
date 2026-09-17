'use client'

import * as React from 'react'
import { motion } from 'motion/react'
import { ArrowDownToLine, Building2, Check } from 'lucide-react'

import { CountUp } from '@/components/motion/count-up'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn } from '@/lib/utils'

/* ==========================================================================
   PayoutMock — tomorrow's payout, itemised by what was sold.

   A card with the amount counting up, the bank it lands in, and the four
   lines that make it up, each bar filling as the card comes into view. The
   fee line is there on purpose: the pitch is the flat rate, and hiding it
   would undercut it.
   ========================================================================== */

const LINES = [
  { label: 'Sunrise paddle · 3 departures', amount: 1_776, share: 0.43 },
  { label: "Chef's table · 2 sittings", amount: 1_440, share: 0.35 },
  { label: 'Pottery, beginners · 1 class', amount: 640, share: 0.16 },
  { label: 'Gift cards', amount: 272, share: 0.06 },
] as const

const GROSS = LINES.reduce((sum, l) => sum + l.amount, 0)
const FEE = Math.round(GROSS * 0.04)
const NET = GROSS - FEE

export function PayoutMock({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()

  return (
    <div
      role="img"
      aria-label={`Tomorrow's payout of $${NET.toLocaleString()} to Blue Horizon's bank account, itemised: sunrise paddle $1,776, chef's table $1,440, pottery $640, gift cards $272, less a flat 4% fee.`}
      className={cn('mx-auto w-full max-w-[24rem]', className)}
    >
      <div aria-hidden="true" className="overflow-hidden rounded-[1.5rem] bg-surface shadow-[var(--shadow-xl)] ring-1 ring-black/[0.05]">
        <div className="bg-foreground p-5 text-background">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.625rem] font-semibold tracking-[0.12em] uppercase opacity-70">Next payout</p>
              <p className="mt-1 text-[0.8125rem] opacity-80">Arrives tomorrow, Thu 10 Sep</p>
            </div>
            <span className="grid size-9 place-items-center rounded-xl bg-background/10">
              <ArrowDownToLine className="size-4" />
            </span>
          </div>
          <p className="mt-5 text-[2.25rem] leading-none font-semibold tracking-[-0.03em] tabular-nums">
            $<CountUp value={NET} duration={1.4} />
          </p>
          <p className="mt-3 flex items-center gap-1.5 font-mono text-[0.75rem] tracking-[0.06em] opacity-70">
            <Building2 className="size-3.5" />
            Blue Horizon · Bank of Maui ····4412
          </p>
        </div>

        <ul className="flex flex-col gap-3 p-5">
          {LINES.map((line, i) => (
            <li key={line.label}>
              <div className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                <span className="truncate text-foreground">{line.label}</span>
                <span className="shrink-0 font-semibold text-foreground tabular-nums">${line.amount.toLocaleString()}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                <motion.div
                  initial={reduce ? false : { scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.9, delay: 0.15 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  style={{ width: `${line.share * 100}%`, transformOrigin: '0% 50%' }}
                  className="h-full rounded-full bg-chart-1"
                />
              </div>
            </li>
          ))}
          <li className="mt-1 flex items-center justify-between border-t border-line-subtle pt-3 text-[0.8125rem]">
            <span className="text-muted">Flat 4% booking fee</span>
            <span className="text-muted tabular-nums">−${FEE.toLocaleString()}</span>
          </li>
          <li className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-[0.75rem] font-medium text-success">
            <Check className="size-3.5" strokeWidth={3} />
            Crew tips of $312 split to 4 guides
          </li>
        </ul>
      </div>
    </div>
  )
}
