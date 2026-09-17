'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays, ChartSpline, CreditCard, Share2, ShoppingCart, type LucideIcon } from 'lucide-react'

import { Reveal } from '@/components/motion/reveal'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { FEATURE_BLOCKS } from '@/content/marketing'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { FeatureBlock } from '@/types'
import { CalendarIllo, DepositIllo, SeatMapIllo } from './illustrations'
import { InsightCard } from './insight-card'
import { PayoutMock } from './payout-mock'

/* ==========================================================================
   FeatureAccordion — there is more to a booking than taking it.

   Five product areas as an accordion on the left; the open one shows its
   sentence and four bullets, and the panel on the right swaps to that
   area's visual on a pastel ground. Opening a row is the only interaction;
   nothing auto-advances here, because the visitor is reading.
   ========================================================================== */

interface Row {
  id: string
  icon: LucideIcon
  ground: string
  visual: React.ReactNode
}

const ROWS: Row[] = [
  { id: 'feat-calendar', icon: CalendarDays, ground: 'bg-cal-cloud', visual: <Framed><SeatMapIllo className="h-auto w-full" /></Framed> },
  { id: 'feat-checkout', icon: ShoppingCart, ground: 'bg-cal-honeydew', visual: <Framed><DepositIllo className="h-auto w-full" /></Framed> },
  { id: 'feat-channels', icon: Share2, ground: 'bg-cal-haze', visual: <Framed><CalendarIllo className="h-auto w-full" /></Framed> },
  { id: 'feat-analytics', icon: ChartSpline, ground: 'bg-cal-lavender', visual: <InsightCard className="w-full max-w-[26rem]" /> },
  { id: 'feat-payments', icon: CreditCard, ground: 'bg-cal-sunbeam', visual: <PayoutMock /> },
]

function Framed({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-[26rem] rounded-2xl bg-surface p-5 shadow-[var(--shadow-lg)] sm:p-7">{children}</div>
}

const ENTITIES: Record<string, string> = { '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&mdash;': '—', '&ndash;': '–', '&amp;': '&' }
const decode = (input: string) => input.replace(/&(?:rsquo|lsquo|ldquo|rdquo|mdash|ndash|amp);/g, (m) => ENTITIES[m] ?? m)

const BLOCKS = ROWS.map((row) => ({ row, block: FEATURE_BLOCKS.find((b) => b.id === row.id) })).filter(
  (item): item is { row: Row; block: FeatureBlock } => Boolean(item.block),
)

export function FeatureAccordion({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const [open, setOpen] = React.useState(0)
  const current = BLOCKS[open]

  return (
    <section id="features" aria-labelledby="feature-accordion-title" className={cn('scroll-mt-4 bg-background py-20 sm:py-24', className)}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <Reveal as="h2" id="feature-accordion-title" blur distance={14} className="font-display text-[2rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.75rem] lg:text-[3rem]">
            There is more to a booking than taking it.
          </Reveal>
          <Reveal as="p" delay={0.08} distance={12} className="mt-5 max-w-2xl text-[1.125rem] leading-[1.45] text-pretty text-muted">
            Sell the seat, hold the deposit, keep the marketplaces honest, read the week and get paid. Every part is built in, and every part talks to the others.
          </Reveal>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-12 lg:gap-12">
          {/* ---------- accordion ---------- */}
          <div className="lg:col-span-5">
            <ul className="divide-y divide-line border-y border-line">
              {BLOCKS.map(({ row, block }, index) => {
                const isOpen = index === open
                const Icon = row.icon
                return (
                  <li key={block.id}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`feature-panel-${block.id}`}
                      onClick={() => setOpen(index)}
                      className="flex w-full items-center gap-4 py-5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-300', isOpen ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-muted')}>
                        <Icon className="size-[1.125rem]" aria-hidden="true" />
                      </span>
                      <span className="flex-1">
                        <span className={cn('block text-[1.125rem] font-medium tracking-[-0.01em] transition-colors duration-300', isOpen ? 'text-foreground' : 'text-muted')}>{block.title}</span>
                      </span>
                      <span aria-hidden="true" className={cn('text-[1.25rem] leading-none text-faint transition-transform duration-300', isOpen && 'rotate-45')}>
                        +
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen ? (
                        <motion.div
                          key="body"
                          id={`feature-panel-${block.id}`}
                          initial={reduce ? false : { height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={reduce ? undefined : { height: 0, opacity: 0 }}
                          transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                          className="overflow-hidden"
                        >
                          <div className="pb-6 pl-14">
                            <p className="text-[0.9375rem] leading-[1.5] text-muted">{decode(block.description)}</p>
                            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                              {block.bullets.map((bullet) => (
                                <li key={bullet} className="flex items-start gap-2 text-[0.875rem] leading-snug text-foreground">
                                  <span className="mt-[0.4rem] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                                  {decode(bullet)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* ---------- visual ---------- */}
          <div className="lg:col-span-7">
            <div className="relative lg:sticky lg:top-28">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.block.id}
                  aria-hidden="true"
                  initial={reduce ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                  className={cn('flex min-h-[26rem] items-center justify-center rounded-[2rem] p-8 sm:min-h-[30rem] sm:p-12', current.row.ground)}
                >
                  {current.row.visual}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
