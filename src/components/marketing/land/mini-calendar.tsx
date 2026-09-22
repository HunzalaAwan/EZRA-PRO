'use client'

import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn } from '@/lib/utils'

/* ==========================================================================
   MiniCalendar — a month, with the days that are selling lit up.

   The graphic for the calendar card: September on a white sheet, booked
   days as violet pills that light up one after another when the card
   arrives, today ringed, and one day's popover pulled out beside it. The
   rounded bars behind it are decoration, the way Calendly frames its
   calendar.
   ========================================================================== */

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const
/** September 2026 starts on a Tuesday and has thirty days. */
const OFFSET = 2
const LENGTH = 30
const TODAY = 9
/** Days with something on sale, and how full they are (0–3). */
const BOOKED: Record<number, number> = {
  4: 2, 5: 3, 6: 1, 7: 2, 8: 1, 9: 3, 10: 2, 11: 3, 12: 3, 13: 1,
  16: 1, 17: 2, 18: 3, 19: 3, 20: 2, 23: 1, 24: 2, 25: 3, 26: 3, 27: 2,
}

const FILL = ['', 'bg-primary/15 text-primary', 'bg-primary/35 text-primary', 'bg-primary text-on-primary'] as const

export function MiniCalendar({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const cells = Array.from({ length: OFFSET + LENGTH }, (_, i) => (i < OFFSET ? null : i - OFFSET + 1))

  return (
    <div
      role="img"
      aria-label="September 2026 on the EZRA calendar: twenty days with departures, sittings and classes on sale, the busiest at the weekends, with Saturday the twelfth sold out."
      className={cn('relative w-full max-w-[26rem]', className)}
    >
      {/* the rounded bars behind */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-6 -left-10 -right-10 flex items-stretch justify-between">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className={cn('w-[2.6rem] rounded-full', i % 2 ? 'bg-primary/[0.14]' : 'bg-primary/[0.22]', i > 1 && i < 6 && 'opacity-0')} />
        ))}
      </div>

      <div aria-hidden="true" className="relative rounded-2xl bg-surface p-5 shadow-[var(--shadow-xl)] ring-1 ring-black/[0.05]">
        <div className="flex items-center justify-center gap-3">
          <span className="grid size-6 place-items-center rounded-full bg-surface-sunken text-muted">
            <ChevronLeft className="size-3.5" />
          </span>
          <p className="text-[0.9375rem] font-medium text-foreground">September 2026</p>
          <span className="grid size-6 place-items-center rounded-full bg-surface-sunken text-muted">
            <ChevronRight className="size-3.5" />
          </span>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center">
          {DAYS.map((d) => (
            <span key={d} className="text-xs font-medium tracking-[0.06em] text-subtle uppercase">
              {d}
            </span>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <span key={`pad-${i}`} />
            const level = BOOKED[day] ?? 0
            const order = Object.keys(BOOKED).indexOf(String(day))
            return (
              <motion.span
                key={day}
                initial={reduce || !level ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: 0.3 + Math.max(order, 0) * 0.05, ease: [0.16, 1, 0.3, 1] }}
                className={cn(
                  'mx-auto grid size-8 place-items-center rounded-full text-[0.75rem] tabular-nums',
                  level ? FILL[level] : 'text-faint',
                  day === TODAY && 'ring-2 ring-foreground ring-offset-2 ring-offset-surface',
                )}
              >
                {day}
              </motion.span>
            )
          })}
        </div>
      </div>

      {/* one day, pulled out */}
      <motion.div
        aria-hidden="true"
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.4, ease: [0.16, 1, 0.3, 1] }}
        className="absolute -right-6 bottom-8 w-[12.5rem] rounded-xl bg-surface p-3 shadow-[var(--shadow-xl)] ring-1 ring-black/[0.06] sm:-right-10"
      >
        <p className="text-xs font-medium tracking-[0.1em] text-subtle uppercase">Sat 12 Sep</p>
        <ul className="mt-1.5 flex flex-col gap-1">
          <li className="flex items-center justify-between text-[0.75rem]">
            <span className="text-foreground">07:00 Balloon flight</span>
            <span className="rounded-sm bg-foreground px-1 text-xs font-semibold text-background">FULL</span>
          </li>
          <li className="flex items-center justify-between text-[0.75rem]">
            <span className="text-foreground">10:00 Reef snorkel</span>
            <span className="text-subtle tabular-nums">30/38</span>
          </li>
          <li className="flex items-center justify-between text-[0.75rem]">
            <span className="text-foreground">18:00 Rooftop gala</span>
            <span className="text-subtle tabular-nums">212/300</span>
          </li>
        </ul>
      </motion.div>
    </div>
  )
}
