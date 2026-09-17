'use client'

import * as React from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useInView, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react'
import { ArrowRight, Check, FileCheck2, Play, Wallet } from 'lucide-react'

import { AppFrame } from '@/components/marketing/app-frame'
import { Button } from '@/components/ui/button'
import { useIsFinePointer } from '@/hooks/use-media-query'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO, SPRING_SOFT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { HeroConsole } from './hero-console'
import { LAND_VERTICALS } from './verticals'

/* ==========================================================================
   LandHero — one column, centred, the product underneath.

   The headline finishes itself with a different trade every few seconds.
   Under it, two pill buttons and one line of small print. Then the product:
   the week calendar inside a browser frame, lying back a little until the
   visitor scrolls, when it stands up to meet them. Three small pieces of
   the product float around the frame at their own depths; the pointer moves
   the whole scene by a few degrees. Touch and reduced motion get the frame
   upright and still.
   ========================================================================== */

const CYCLE_MS = 3200

const CHIP_DRIFT = [
  { y: [0, -7, 0], duration: 7.4, delay: 0 },
  { y: [0, 6, 0], duration: 8.6, delay: 1.1 },
  { y: [0, -5, 0], duration: 9.2, delay: 0.5 },
] as const

export function LandHero() {
  const reduce = useReducedMotionSafe()
  const finePointer = useIsFinePointer()

  /* ---------- the trade that finishes the headline ---------- */
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const inView = useInView(headingRef, { amount: 0.5 })
  const [index, setIndex] = React.useState(0)
  const current = LAND_VERTICALS[index]

  React.useEffect(() => {
    if (reduce || !inView) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % LAND_VERTICALS.length), CYCLE_MS)
    return () => window.clearInterval(id)
  }, [reduce, inView])

  /* ---------- the frame stands up on scroll ---------- */
  const stageRef = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start end', 'start 32%'] })
  const eased = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.8 })
  const progress = reduce ? scrollYProgress : eased
  const scrollRotateX = useTransform(progress, [0, 1], reduce ? [0, 0] : [16, 0])
  const scrollScale = useTransform(progress, [0, 1], reduce ? [1, 1] : [0.94, 1])
  const scrollY = useTransform(progress, [0, 1], reduce ? [0, 0] : [36, 0])

  /* ---------- and leans with the pointer ---------- */
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, SPRING_SOFT)
  const sy = useSpring(my, SPRING_SOFT)
  const pointerRotateY = useTransform(sx, (v) => v * 7)
  const pointerRotateX = useTransform(sy, (v) => v * -5)
  const rotateX = useTransform(() => scrollRotateX.get() + pointerRotateX.get())
  const chipFarX = useTransform(sx, (v) => v * -26)
  const chipFarY = useTransform(sy, (v) => v * -18)
  const chipNearX = useTransform(sx, (v) => v * 18)
  const chipNearY = useTransform(sy, (v) => v * 12)

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!finePointer || reduce) return
    const rect = event.currentTarget.getBoundingClientRect()
    mx.set((event.clientX - rect.left) / rect.width - 0.5)
    my.set((event.clientY - rect.top) / rect.height - 0.5)
  }
  const onPointerLeave = () => {
    mx.set(0)
    my.set(0)
  }

  const enter = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE_OUT_EXPO },
  })

  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate overflow-hidden bg-[color-mix(in_oklab,var(--primary)_5%,var(--background))] pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-16 lg:pb-24"
    >
      {/* the floor: a faint grid that fades before the fold */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem] bg-grid opacity-[0.35] mask-radial" />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ---------- copy ---------- */}
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <motion.h1
            ref={headingRef}
            id="hero-title"
            {...enter(0)}
            className="font-display text-[2.75rem] leading-[1.02] font-semibold tracking-[-0.04em] text-balance text-foreground sm:text-6xl lg:text-[4.75rem]"
          >
            Take bookings for your
            <br />
            <span className="relative inline-grid overflow-hidden align-top">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={current.key}
                  className="col-start-1 row-start-1 whitespace-nowrap text-primary"
                  initial={reduce ? false : { y: '0.7em', opacity: 0, filter: 'blur(6px)' }}
                  animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                  exit={reduce ? undefined : { y: '-0.7em', opacity: 0, filter: 'blur(6px)' }}
                  transition={{ duration: 0.55, ease: EASE_OUT_EXPO }}
                >
                  {current.word}.
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.h1>

          <motion.p {...enter(0.08)} className="mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted sm:text-xl">
            Availability, deposits, staff rosters and next-day payouts for tours, restaurants, events,
            classes and venues. Your website, the marketplaces and the phone all sell from one inventory.
          </motion.p>

          <motion.div {...enter(0.16)} className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="xl" className="rounded-full px-8" rightIcon={<ArrowRight aria-hidden="true" />}>
              <Link href="/signup">Start free</Link>
            </Button>
            <Button asChild size="xl" variant="outline" className="rounded-full bg-surface px-8" leftIcon={<Play aria-hidden="true" />}>
              <Link href="/dashboard">See it running</Link>
            </Button>
          </motion.div>

          <motion.p {...enter(0.22)} className="mt-5 text-[0.8125rem] text-subtle">
            No card to start · 4% flat booking fee · Free migration from FareHarbor, Peek Pro, OpenTable or Eventbrite
          </motion.p>
        </div>

        {/* ---------- the product ---------- */}
        <div
          ref={stageRef}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          className="relative mx-auto mt-14 max-w-5xl [perspective:1800px] sm:mt-16"
        >
          <motion.div
            style={{ rotateX, rotateY: pointerRotateY, scale: scrollScale, y: scrollY, transformOrigin: '50% 100%', transformStyle: 'preserve-3d' }}
            className="will-change-transform"
          >
            <AppFrame url="app.ezra.pro/blue-horizon/calendar" className="[transform:translateZ(0)]">
              <HeroConsole />
            </AppFrame>

            {/* chips, at their own depths, desktop only */}
            <motion.div
              aria-hidden="true"
              style={{ x: chipNearX, y: chipNearY, z: 90 }}
              className="absolute -left-12 top-[36%] z-20 hidden w-[17.5rem] lg:block"
            >
              <Drift index={0} reduce={reduce}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={current.key}
                    initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
                    className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-xl)] ring-1 ring-black/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[0.625rem] font-semibold tracking-[0.12em] text-subtle uppercase">New booking</p>
                        <p className="mt-1 truncate text-[0.9375rem] font-semibold text-foreground">{current.booking.title}</p>
                        <p className="mt-0.5 text-[0.8125rem] text-muted">{current.booking.when}</p>
                      </div>
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success text-white">
                        <Check className="size-4" strokeWidth={2.5} />
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-line-subtle pt-3 text-[0.75rem]">
                      <span className="font-semibold text-foreground">{current.booking.money}</span>
                      <span className="truncate text-subtle">{current.booking.note}</span>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </Drift>
            </motion.div>

            <motion.div
              aria-hidden="true"
              style={{ x: chipFarX, y: chipFarY, z: 50 }}
              className="absolute -right-8 top-[12%] z-20 hidden w-[15rem] lg:block"
            >
              <Drift index={1} reduce={reduce}>
                <div className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-[var(--shadow-xl)] ring-1 ring-black/[0.06]">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-on-primary">
                    <Wallet className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.625rem] font-semibold tracking-[0.12em] text-subtle uppercase">Payout · tomorrow</p>
                    <p className="mt-0.5 truncate text-[0.9375rem] font-semibold text-foreground tabular-nums">$4,128.40</p>
                  </div>
                </div>
              </Drift>
            </motion.div>

            <motion.div
              aria-hidden="true"
              style={{ x: chipNearX, y: chipNearY, z: 70 }}
              className="absolute -right-6 bottom-[16%] z-20 hidden w-[14rem] lg:block"
            >
              <Drift index={2} reduce={reduce}>
                <div className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-[var(--shadow-xl)] ring-1 ring-black/[0.06]">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-success text-white">
                    <FileCheck2 className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[0.625rem] font-semibold tracking-[0.12em] text-subtle uppercase">Waivers signed</p>
                    <p className="mt-0.5 truncate text-[0.9375rem] font-semibold text-foreground">4 of 4, before arrival</p>
                  </div>
                </div>
              </Drift>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/** A slow vertical drift so the chips read as hovering rather than pinned. */
function Drift({ index, reduce, children, className }: { index: 0 | 1 | 2; reduce: boolean; children: React.ReactNode; className?: string }) {
  const drift = CHIP_DRIFT[index]
  return (
    <motion.div
      animate={reduce ? undefined : { y: [...drift.y] }}
      transition={reduce ? undefined : { duration: drift.duration, delay: drift.delay, repeat: Infinity, ease: 'easeInOut' }}
      className={cn('will-change-transform', className)}
    >
      {children}
    </motion.div>
  )
}
