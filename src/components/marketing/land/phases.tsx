'use client'

import * as React from 'react'
import Image from 'next/image'
import { AnimatePresence, animate, motion, useInView, useMotionValue, type AnimationPlaybackControls } from 'motion/react'
import { Check, CreditCard, FileCheck2, Share2, ShoppingCart, SignalZero, Users, Wallet, type LucideIcon } from 'lucide-react'

import { PHOTOS, photoUrl, type Photo } from '@/components/marketing/story/photos'
import { Reveal } from '@/components/motion/reveal'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Phases — before, during and after every booking.

   Four tabs across the top, one phase each. The active one carries a thin
   rule that fills over eight seconds, then the next phase takes over; the
   pointer resting on the section holds the rule, and a click pins the tab.
   Under the tabs: the phase's copy on the left and, on the right, a
   photograph of the operator on a pastel panel with two pieces of the
   product laid over it. Below `md` the four phases stack.
   ========================================================================== */

const HOLD_MS = 8000

interface Chip {
  icon: LucideIcon
  tone: 'primary' | 'success' | 'warning' | 'ink'
  title: string
  detail: string
}

interface Phase {
  key: string
  step: string
  label: string
  title: string
  body: string
  points: [string, string, string]
  photo: Photo
  ground: string
  chips: [Chip, Chip]
}

const PHASES: Phase[] = [
  {
    key: 'sell',
    step: '01',
    label: 'Sell',
    title: 'Every channel sells from the same seats.',
    body: 'Your website, Viator, GetYourGuide, the phone and the walk-up at the door all draw from one inventory. Sell the last seat anywhere and it disappears everywhere, in under a second.',
    points: ['Live availability on every channel', 'Apple Pay and Google Pay on by default', 'Gift cards, private upgrades and add-ons'],
    photo: PHOTOS.cafeTablet,
    ground: 'bg-cal-cloud',
    chips: [
      { icon: ShoppingCart, tone: 'primary', title: 'New booking', detail: 'Sunrise paddle · Sat 06:40 · $148 paid' },
      { icon: Share2, tone: 'ink', title: 'One inventory', detail: 'Website, Viator, phone · 36 of 49 seats' },
    ],
  },
  {
    key: 'prepare',
    step: '02',
    label: 'Prepare',
    title: 'Deposits, waivers and reminders, set once.',
    body: 'Hold a deposit at booking. Send the waiver before anyone arrives. Remind at 24 hours and release the seat if nobody turns up. Decide it per product and forget about it.',
    points: ['Deposits and balances per product', 'Waivers signed before departure', 'Reminders by text and email'],
    photo: PHOTOS.waitressOrder,
    ground: 'bg-cal-honeydew',
    chips: [
      { icon: CreditCard, tone: 'primary', title: 'Deposit held', detail: '$60 on a table of four' },
      { icon: FileCheck2, tone: 'success', title: 'Waivers signed', detail: '4 of 4, before arrival' },
    ],
  },
  {
    key: 'run',
    step: '03',
    label: 'Run',
    title: 'A host app that works in a basement.',
    body: 'Check guests in, take a walk-up, mark a no-show, move a party to a later slot, all with no signal. It catches up the moment the phone finds a bar.',
    points: ['Manifests and rosters on every phone', 'Offline check-in that syncs later', 'Weather holds with one-tap notices'],
    photo: PHOTOS.guideGroup,
    ground: 'bg-cal-haze',
    chips: [
      { icon: Check, tone: 'success', title: 'Checked in', detail: '9 of 14 guests · 2 walk-ups' },
      { icon: SignalZero, tone: 'warning', title: 'No signal', detail: 'Saved on the phone, will sync' },
    ],
  },
  {
    key: 'paid',
    step: '04',
    label: 'Get paid',
    title: 'Money in the bank the next business day.',
    body: 'Card money lands the next business day, itemised by departure, sitting or event, with tips split to the crew. The bookkeeper stops asking.',
    points: ['Next-business-day payouts', 'One flat 4% booking fee', 'Tips split automatically'],
    photo: PHOTOS.cafeSmile,
    ground: 'bg-cal-sunbeam',
    chips: [
      { icon: Wallet, tone: 'ink', title: 'Payout tomorrow', detail: '$4,128.40 · Bank of Maui ····4412' },
      { icon: Users, tone: 'success', title: 'Tips split', detail: '$312 to 4 guides' },
    ],
  },
]

const TONE: Record<Chip['tone'], string> = {
  primary: 'bg-primary text-on-primary',
  success: 'bg-success text-white',
  warning: 'bg-warning text-white',
  ink: 'bg-foreground text-background',
}

function ChipCard({ chip, className }: { chip: Chip; className?: string }) {
  const Icon = chip.icon
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow-xl)] ring-1 ring-black/[0.05] sm:p-3.5', className)}>
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', TONE[chip.tone])}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[0.8125rem] font-medium text-foreground">{chip.title}</span>
        <span className="block truncate text-[0.75rem] text-subtle">{chip.detail}</span>
      </span>
    </div>
  )
}

function PhaseVisual({ phase, reduce }: { phase: Phase; reduce: boolean }) {
  return (
    <div className={cn('relative rounded-[2rem] p-5 sm:p-8', phase.ground)}>
      <figure className="relative m-0 aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-surface-sunken">
        <Image src={photoUrl(phase.photo, 1200)} alt={phase.photo.alt} fill sizes="(min-width: 1024px) 40rem, 100vw" className="object-cover" style={{ objectPosition: phase.photo.focus }} />
      </figure>
      <motion.div
        aria-hidden="true"
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25, ease: EASE_OUT_EXPO }}
        className="absolute top-[12%] right-2 w-[15rem] sm:right-4 sm:w-[17rem]"
      >
        <ChipCard chip={phase.chips[0]} />
      </motion.div>
      <motion.div
        aria-hidden="true"
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: EASE_OUT_EXPO }}
        className="absolute bottom-[10%] left-2 w-[15rem] sm:left-4 sm:w-[17rem]"
      >
        <ChipCard chip={phase.chips[1]} />
      </motion.div>
    </div>
  )
}

function Points({ points }: { points: string[] }) {
  return (
    <ul className="mt-6 flex flex-col gap-3">
      {points.map((point) => (
        <li key={point} className="flex items-start gap-3 text-[0.9375rem] text-foreground">
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-soft">
            <Check className="size-3 text-success" strokeWidth={3} aria-hidden="true" />
          </span>
          {point}
        </li>
      ))}
    </ul>
  )
}

export function Phases({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const sectionRef = React.useRef<HTMLElement>(null)
  const inView = useInView(sectionRef, { amount: 0.35 })

  const [active, setActive] = React.useState(0)
  const [pinned, setPinned] = React.useState(false)
  const [paused, setPaused] = React.useState(false)

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
      onComplete: () => setActive((i) => (i + 1) % PHASES.length),
    })
    return () => {
      timer.current?.stop()
      timer.current = null
    }
  }, [auto, active, pinned, reduce, fill])

  React.useEffect(() => {
    if (!timer.current) return
    if (paused) timer.current.pause()
    else timer.current.play()
  }, [paused])

  const phase = PHASES[active]

  return (
    <section ref={sectionRef} id="how-it-works" aria-labelledby="phases-title" className={cn('scroll-mt-4 bg-background-subtle py-20 sm:py-24', className)}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal direction="up" distance={8}>
            <p className="text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">Before, during and after</p>
          </Reveal>
          <Reveal as="h2" id="phases-title" delay={0.06} blur distance={14} className="mt-4 font-display text-[2rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.75rem] lg:text-[3rem]">
            One booking, from the first click to the money.
          </Reveal>
          <Reveal as="p" delay={0.12} distance={12} className="mx-auto mt-5 max-w-2xl text-[1.125rem] leading-[1.45] text-pretty text-muted">
            Four things happen to every booking. EZRA handles all four, so you have more room for the guests in front of you.
          </Reveal>
        </div>

        {/* ---------- desktop: tabs and one stage ---------- */}
        <div
          className="mt-12 hidden md:block"
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
                  onClick={() => {
                    setActive(index)
                    setPinned(true)
                  }}
                  className={cn(
                    'group relative flex flex-col items-start gap-3 rounded-lg pb-5 text-left',
                    'transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary',
                    selected ? 'text-foreground' : 'text-subtle hover:text-foreground',
                  )}
                >
                  <span className="flex items-baseline gap-2.5">
                    <span className={cn('font-mono text-[0.75rem] tabular-nums', selected ? 'text-primary' : 'text-faint')}>{item.step}</span>
                    <span className="text-[1.0625rem] font-medium tracking-[-0.01em]">{item.label}</span>
                  </span>
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
                  <h3 className="font-display text-[1.75rem] leading-[1.15] font-medium tracking-[-0.025em] text-balance text-foreground lg:text-[2.125rem]">{phase.title}</h3>
                  <p className="mt-4 text-[1.0625rem] leading-[1.5] text-pretty text-muted">{phase.body}</p>
                  <Points points={phase.points} />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="lg:col-span-7">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={phase.key}
                  initial={reduce ? false : { opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, scale: 0.99, y: -6 }}
                  transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                >
                  <PhaseVisual phase={phase} reduce={reduce} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ---------- mobile: the four, stacked ---------- */}
        <ol className="mt-12 flex flex-col gap-12 md:hidden">
          {PHASES.map((item) => (
            <li key={item.key} className="flex flex-col gap-5">
              <PhaseVisual phase={item} reduce />
              <div>
                <p className="flex items-baseline gap-2.5">
                  <span className="font-mono text-[0.75rem] text-primary tabular-nums">{item.step}</span>
                  <span className="text-[0.75rem] font-medium tracking-[0.08em] text-subtle uppercase">{item.label}</span>
                </p>
                <h3 className="mt-2 font-display text-[1.625rem] leading-[1.15] font-medium tracking-[-0.025em] text-balance text-foreground">{item.title}</h3>
                <p className="mt-3 text-[1rem] leading-[1.5] text-muted">{item.body}</p>
                <Points points={item.points} />
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
