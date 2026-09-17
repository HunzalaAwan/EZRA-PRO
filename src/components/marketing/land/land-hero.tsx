'use client'

import * as React from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useInView } from 'motion/react'
import { ArrowRight, Play } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { HeroStage } from './hero-stage'
import { LAND_VERTICALS } from './verticals'

/* ==========================================================================
   LandHero — the claim, then the product.

   One centred column on a pale blue ground: the headline finishes itself
   with a different trade every few seconds, one paragraph, two buttons and a
   line of small print. Behind it, three flat pastel shapes drift very slowly
   so the ground is alive without competing with the words. Under it, the
   stage: four working pieces of the product, one at a time.
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

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <motion.h1
            ref={headingRef}
            id="hero-title"
            {...enter(0)}
            className="font-display text-[2.5rem] leading-[1.06] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[3.25rem] lg:text-[3.75rem]"
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

          <motion.p {...enter(0.08)} className="mt-6 max-w-xl text-[1.125rem] leading-[1.45] text-pretty text-muted sm:text-[1.25rem]">
            Availability, deposits, staff rosters and next-day payouts for tours, restaurants, events, classes
            and venues. One inventory behind your website, the marketplaces and the phone.
          </motion.p>

          <motion.div {...enter(0.16)} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild variant="ink" size="lg" className="rounded-[10px] px-6" rightIcon={<ArrowRight aria-hidden="true" />}>
              <Link href="/signup">Start free</Link>
            </Button>
            <Button asChild variant="secondary" size="lg" className="rounded-[10px] px-6" leftIcon={<Play aria-hidden="true" />}>
              <Link href="/dashboard">See it running</Link>
            </Button>
          </motion.div>

          <motion.p {...enter(0.22)} className="mt-4 text-[0.8125rem] text-subtle">
            No card to start · Free migration from FareHarbor, Peek Pro, OpenTable or Eventbrite
          </motion.p>
        </div>

        <motion.div {...enter(0.3)} className="mt-14 sm:mt-16">
          <HeroStage />
        </motion.div>
      </div>
    </section>
  )
}
