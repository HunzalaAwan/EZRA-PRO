'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion, useInView } from 'motion/react'
import { ArrowRight, Check, FileCheck2, Play, ShoppingCart, Wallet, type LucideIcon } from 'lucide-react'

import { PHOTOS, photoUrl, type Photo } from '@/components/marketing/story/photos'
import { Button } from '@/components/ui/button'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { HeroStage } from './hero-stage'
import { LAND_VERTICALS } from './verticals'

/* ==========================================================================
   LandHero — the claim, then the product.

   One centred column on a pale blue ground: a large headline that finishes
   itself with a different trade every few seconds, one paragraph, two
   buttons and a line of small print. Either side of it, on wide screens, a
   photograph of a trade with two pieces of the product laid over it, drifting
   slowly. Behind everything, three flat pastel shapes. Under it, the stage:
   four working pieces of the product, one at a time.
   ========================================================================== */

const CYCLE_MS = 3200

const SHAPES = [
  {
    className: 'left-[-8%] top-[6%] h-[26rem] w-[34rem] rounded-[45%_55%_50%_50%/55%_45%_55%_45%] bg-cal-sky',
    drift: { x: [0, 22, 0], y: [0, -16, 0], rotate: [0, 6, 0] },
    duration: 18,
  },
  {
    className: 'right-[-10%] top-[0%] h-[22rem] w-[30rem] rounded-[55%_45%_50%_50%/45%_55%_45%_55%] bg-cal-honeydew',
    drift: { x: [0, -18, 0], y: [0, 14, 0], rotate: [0, -5, 0] },
    duration: 21,
  },
  {
    className: 'left-[62%] top-[48%] h-[16rem] w-[24rem] rounded-[50%_50%_45%_55%/60%_40%_60%_40%] bg-cal-lavender',
    drift: { x: [0, 12, 0], y: [0, 18, 0], rotate: [0, 4, 0] },
    duration: 24,
  },
] as const

interface Chip {
  icon: LucideIcon
  tone: 'primary' | 'success' | 'ink'
  title: string
  detail: string
}

interface Side {
  photo: Photo
  rotate: number
  /** The chip across the photograph's lower edge. */
  chip: Chip
  /** The smaller chip above the photograph. */
  note: Chip
  drift: number[]
  duration: number
}

const SIDES: { left: Side; right: Side } = {
  left: {
    photo: PHOTOS.kayakCliffs,
    rotate: -4,
    chip: { icon: ShoppingCart, tone: 'primary', title: 'New booking', detail: 'Sunrise paddle · Sat 06:40 · $148 paid' },
    note: { icon: FileCheck2, tone: 'success', title: 'Waivers signed', detail: '4 of 4, before arrival' },
    drift: [0, -8, 0],
    duration: 8.5,
  },
  right: {
    photo: PHOTOS.chefClass,
    rotate: 4,
    chip: { icon: Wallet, tone: 'ink', title: 'Payout tomorrow', detail: '$4,128.40 · Bank of Maui ····4412' },
    note: { icon: Check, tone: 'success', title: 'Table 9 resold', detail: 'From the waitlist, in order' },
    drift: [0, 7, 0],
    duration: 9.5,
  },
}

const TONE: Record<Chip['tone'], string> = {
  primary: 'bg-primary text-on-primary',
  success: 'bg-success text-white',
  ink: 'bg-foreground text-background',
}

function ChipCard({ chip, className }: { chip: Chip; className?: string }) {
  const Icon = chip.icon
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-[var(--shadow-xl)] ring-1 ring-black/[0.05]', className)}>
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

function SideScene({ side, align, reduce, delay }: { side: Side; align: 'left' | 'right'; reduce: boolean; delay: number }) {
  return (
    <motion.div
      aria-hidden="true"
      initial={reduce ? false : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay, ease: EASE_OUT_EXPO }}
      className={cn('absolute top-2 hidden w-[13.5rem] xl:block 2xl:w-[15rem]', align === 'left' ? 'left-8 2xl:-left-4' : 'right-8 2xl:-right-4')}
    >
      <motion.div
        animate={reduce ? undefined : { y: side.drift }}
        transition={reduce ? undefined : { duration: side.duration, repeat: Infinity, ease: 'easeInOut' }}
        className="relative will-change-transform"
      >
        <ChipCard chip={side.note} className={cn('relative z-10 mb-3 w-[13rem]', align === 'left' ? 'ml-6' : 'mr-6')} />
        <figure
          className="relative m-0 aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-surface-sunken shadow-[var(--shadow-xl)] ring-1 ring-black/[0.06]"
          style={{ transform: `rotate(${side.rotate}deg)` }}
        >
          <Image src={photoUrl(side.photo, 600)} alt="" fill sizes="15rem" className="object-cover" style={{ objectPosition: side.photo.focus }} />
        </figure>
        <ChipCard chip={side.chip} className={cn('absolute -bottom-5 z-10 w-[15rem]', align === 'left' ? 'left-8' : 'right-8')} />
      </motion.div>
    </motion.div>
  )
}

export function LandHero() {
  const reduce = useReducedMotionSafe()
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const inView = useInView(headingRef, { amount: 0.5 })
  const [index, setIndex] = React.useState(0)
  const current = LAND_VERTICALS[index]

  React.useEffect(() => {
    if (reduce || !inView) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % LAND_VERTICALS.length), CYCLE_MS)
    return () => window.clearInterval(id)
  }, [reduce, inView])

  const enter = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE_OUT_EXPO },
  })

  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden bg-cal-rain pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20">
      {/* the ground, alive */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[52rem] overflow-hidden">
        {SHAPES.map((shape, i) => (
          <motion.span
            key={i}
            animate={reduce ? undefined : { x: [...shape.drift.x], y: [...shape.drift.y], rotate: [...shape.drift.rotate] }}
            transition={reduce ? undefined : { duration: shape.duration, repeat: Infinity, ease: 'easeInOut' }}
            className={`absolute opacity-70 will-change-transform ${shape.className}`}
          />
        ))}
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SideScene side={SIDES.left} align="left" reduce={reduce} delay={0.35} />
        <SideScene side={SIDES.right} align="right" reduce={reduce} delay={0.45} />

        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <motion.h1
            ref={headingRef}
            id="hero-title"
            {...enter(0)}
            className="font-display text-[2.875rem] leading-[1.04] font-medium tracking-[-0.035em] text-balance text-foreground sm:text-[3.75rem] lg:text-[4.5rem] xl:text-[5rem]"
          >
            Take bookings for your{' '}
            <span className="relative inline-grid overflow-hidden align-top">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={current.key}
                  className="col-start-1 row-start-1 whitespace-nowrap text-primary"
                  initial={reduce ? false : { y: '0.7em', opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={reduce ? undefined : { y: '-0.7em', opacity: 0 }}
                  transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                >
                  {current.word}.
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h1>

          <motion.p {...enter(0.08)} className="mt-7 max-w-2xl text-[1.125rem] leading-[1.45] text-pretty text-muted sm:text-[1.25rem] lg:text-[1.375rem]">
            Availability, deposits, staff rosters and next-day payouts for tours, restaurants, events, classes
            and venues. One inventory behind your website, the marketplaces and the phone.
          </motion.p>

          <motion.div {...enter(0.16)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="ink" size="xl" className="rounded-[10px] px-7" rightIcon={<ArrowRight aria-hidden="true" />}>
              <Link href="/signup">Start free</Link>
            </Button>
            <Button asChild variant="secondary" size="xl" className="rounded-[10px] px-7" leftIcon={<Play aria-hidden="true" />}>
              <Link href="/dashboard">See it running</Link>
            </Button>
          </motion.div>

          <motion.p {...enter(0.22)} className="mt-5 text-[0.875rem] text-subtle">
            No card to start · Free migration from FareHarbor, Peek Pro, OpenTable or Eventbrite
          </motion.p>
        </div>

        <motion.div {...enter(0.3)} className="mt-16 sm:mt-20 xl:mt-24">
          <HeroStage />
        </motion.div>
      </div>
    </section>
  )
}
