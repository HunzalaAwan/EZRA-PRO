'use client'

import * as React from 'react'
import { AnimatePresence, animate, motion, useInView, useMotionValue, type AnimationPlaybackControls } from 'motion/react'
import { Check } from 'lucide-react'

import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { CalendarIllo, DepositIllo, HostAppIllo, PayoutIllo } from './illustrations'

/* ==========================================================================
   Phases — a booking, from the first click to the money.

   Four tabs across the top, one phase each. The active one carries a thin
   rule that fills over eight seconds, then the next phase takes over; the
   pointer resting on the section holds the rule where it is, and a click
   pins the tab the visitor chose. Under the tabs, the phase's copy on the
   left and its drawing on the right. Below `md` the four phases stack and
   every drawing plays when it scrolls into view. Reduced motion never
   auto-advances.
   ========================================================================== */

const HOLD_MS = 8000

interface Phase {
  key: string
  step: string
  label: string
  title: string
  body: string
  points: [string, string, string]
  illo: React.ComponentType<{ replayKey?: number; className?: string }>
}

const PHASES: Phase[] = [
  {
    key: 'sell',
    step: '01',
    label: 'Sell',
    title: 'Every channel sells from the same seats.',
    body: 'Your website, Viator, GetYourGuide, the phone and the walk-up at the door all draw from one inventory. Sell the last seat anywhere and it disappears everywhere, in under a second.',
    points: ['Live availability on every channel', 'Apple Pay and Google Pay on by default', 'Gift cards, private upgrades and add-ons'],
    illo: CalendarIllo,
  },
  {
    key: 'prepare',
    step: '02',
    label: 'Prepare',
    title: 'Deposits, waivers and reminders, set once.',
    body: 'Hold a deposit at booking. Send the waiver before anyone arrives. Remind at 24 hours and release the seat if nobody turns up. Decide it per product and forget about it.',
    points: ['Deposits and balances per product', 'Waivers signed before departure', 'Reminders by text and email'],
    illo: DepositIllo,
  },
  {
    key: 'run',
    step: '03',
    label: 'Run',
    title: 'A host app that works in a basement.',
    body: 'Check guests in, take a walk-up, mark a no-show, move a party to a later slot, all with no signal. It catches up the moment the phone finds a bar.',
    points: ['Manifests and rosters on every phone', 'Offline check-in that syncs later', 'Weather holds with one-tap notices'],
    illo: HostAppIllo,
  },
  {
    key: 'paid',
    step: '04',
    label: 'Get paid',
    title: 'Money in the bank the next business day.',
    body: 'Card money lands the next business day, itemised by departure, sitting or event, with tips split to the crew. The bookkeeper stops asking.',
    points: ['Next-business-day payouts', 'One flat 4% booking fee', 'Tips split automatically'],
    illo: PayoutIllo,
  },
]

export function Phases({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const sectionRef = React.useRef<HTMLElement>(null)
  const inView = useInView(sectionRef, { amount: 0.35 })

  const [active, setActive] = React.useState(0)
  const [pinned, setPinned] = React.useState(false)
  const [paused, setPaused] = React.useState(false)
  const [replay, setReplay] = React.useState(0)

  /* ---------- the rule under the active tab times the phase ---------- */
  const auto = inView && !pinned && !reduce
  const fill = useMotionValue(0)
  const timer = React.useRef<AnimationPlaybackControls | null>(null)

  React.useEffect(() => {
    timer.current?.stop()
    timer.current = null
    if (!auto) {
      fill.set(pinned || reduce ? 1 : 0)
      return
    }
    fill.set(0)
    timer.current = animate(fill, 1, {
      duration: HOLD_MS / 1000,
      ease: 'linear',
      onComplete: () => {
        setActive((i) => (i + 1) % PHASES.length)
        setReplay((r) => r + 1)
      },
    })
    return () => {
      timer.current?.stop()
      timer.current = null
    }
  }, [auto, active, pinned, reduce, fill])

  /* the pointer resting on the section holds the timer where it is */
  React.useEffect(() => {
    if (!timer.current) return
    if (paused) timer.current.pause()
    else timer.current.play()
  }, [paused])

  const choose = (index: number) => {
    setActive(index)
    setPinned(true)
    setReplay((r) => r + 1)
  }

  const phase = PHASES[active]
  const Illo = phase.illo

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      aria-labelledby="phases-title"
      className={cn('scroll-mt-4 bg-background py-20 sm:py-24 lg:py-32', className)}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-[0.75rem] font-semibold tracking-[0.16em] text-primary uppercase">How it works</p>
          <h2
            id="phases-title"
            className="mt-4 font-display text-display-sm font-semibold tracking-[-0.03em] text-balance text-foreground md:text-display-md"
          >
            One booking, from the first click to the money.
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-pretty text-muted">
            Four things happen to every booking. EZRA handles all four, so the same engine sells a sunrise
            paddle, a chef&rsquo;s table and a 300-seat gala.
          </p>
        </div>

        {/* ---------- desktop: tabs and one stage ---------- */}
        <div
          className="mt-14 hidden md:block"
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          <div role="tablist" aria-label="The four phases of a booking" className="grid grid-cols-4 gap-6">
            {PHASES.map((item, index) => {
              const selected = index === active
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  id={`phase-tab-${item.key}`}
                  aria-selected={selected}
                  aria-controls={`phase-panel-${item.key}`}
                  onClick={() => choose(index)}
                  className={cn(
                    'group relative flex flex-col items-start gap-3 rounded-lg pb-5 text-left',
                    'transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary',
                    selected ? 'text-foreground' : 'text-subtle hover:text-foreground',
                  )}
                >
                  <span className="flex items-baseline gap-2.5">
                    <span className={cn('font-mono text-[0.75rem] tabular-nums', selected ? 'text-primary' : 'text-faint')}>{item.step}</span>
                    <span className="text-[1.0625rem] font-semibold tracking-[-0.01em]">{item.label}</span>
                  </span>

                  {/* the rule: a hairline, and the fill that times the phase */}
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-full bg-line">
                    {selected ? <motion.span style={{ scaleX: fill }} className="absolute inset-0 origin-left bg-primary" /> : null}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-12 grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
            <div className="lg:col-span-5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={phase.key}
                  role="tabpanel"
                  id={`phase-panel-${phase.key}`}
                  aria-labelledby={`phase-tab-${phase.key}`}
                  initial={reduce ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10 }}
                  transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                >
                  <h3 className="font-display text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.025em] text-balance text-foreground lg:text-[2rem]">
                    {phase.title}
                  </h3>
                  <p className="mt-4 text-base leading-relaxed text-pretty text-muted sm:text-[1.0625rem]">{phase.body}</p>
                  <ul className="mt-6 flex flex-col gap-3">
                    {phase.points.map((point) => (
                      <li key={point} className="flex items-start gap-3 text-[0.9375rem] text-foreground">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-soft">
                          <Check className="size-3 text-success" strokeWidth={3} aria-hidden="true" />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="lg:col-span-7">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={phase.key}
                  aria-hidden="true"
                  initial={reduce ? false : { opacity: 0, scale: 0.97, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.985, y: -6 }}
                  transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                  className="rounded-[1.75rem] bg-surface-sunken p-6 sm:p-10"
                >
                  <div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-lg)] ring-1 ring-black/[0.05] sm:p-7">
                    <Illo replayKey={replay} className="h-auto w-full" />
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ---------- mobile: the four, stacked ---------- */}
        <ol className="mt-12 flex flex-col gap-10 md:hidden">
          {PHASES.map((item) => {
            const StackIllo = item.illo
            return (
              <li key={item.key} className="flex flex-col gap-5">
                <div className="rounded-3xl bg-surface-sunken p-5">
                  <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-md)] ring-1 ring-black/[0.05]">
                    <StackIllo className="h-auto w-full" />
                  </div>
                </div>
                <div>
                  <p className="flex items-baseline gap-2.5">
                    <span className="font-mono text-[0.75rem] text-primary tabular-nums">{item.step}</span>
                    <span className="text-[0.75rem] font-semibold tracking-[0.14em] text-subtle uppercase">{item.label}</span>
                  </p>
                  <h3 className="mt-2 font-display text-2xl leading-[1.15] font-semibold tracking-[-0.025em] text-balance text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-muted">{item.body}</p>
                  <ul className="mt-4 flex flex-col gap-2">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-[0.9375rem] text-foreground">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-soft">
                          <Check className="size-3 text-success" strokeWidth={3} aria-hidden="true" />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
