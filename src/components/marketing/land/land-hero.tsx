'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  AnimatePresence,
  motion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react'
import { ArrowRight, Check, MessageSquareText, Play } from 'lucide-react'

import { photoUrl } from '@/components/marketing/story/photos'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { useIsFinePointer } from '@/hooks/use-media-query'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO, SPRING_SOFT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { LAND_VERTICALS, type LandVerticalKey } from './verticals'

/* ==========================================================================
   LandHero — the product, working, for six different kinds of business.

   Left: a headline that finishes itself with whichever trade is selected.
   Right: a stack of photographs with a booking landing on top of it. The
   stack cycles on its own until the visitor picks a trade, then it holds.
   The pointer tilts the whole scene a few pixels; touch and reduced motion
   get the same picture, still.
   ========================================================================== */

const CYCLE_MS = 3800

/** Where each card sits in the stack, by distance from the top. */
const SLOT = [
  { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1, z: 30 },
  { x: -9, y: 4, rotate: -7, scale: 0.94, opacity: 1, z: 20 },
  { x: 9, y: 7, rotate: 7, scale: 0.9, opacity: 1, z: 10 },
] as const

const HIDDEN = { x: 0, y: 8, rotate: 0, scale: 0.86, opacity: 0, z: 0 } as const

export function LandHero() {
  const reduce = useReducedMotionSafe()
  const finePointer = useIsFinePointer()
  const sceneRef = React.useRef<HTMLDivElement>(null)
  const inView = useInView(sceneRef, { amount: 0.4 })

  const [active, setActive] = React.useState<LandVerticalKey>('tours')
  const [pinned, setPinned] = React.useState(false)

  const index = LAND_VERTICALS.findIndex((v) => v.key === active)
  const current = LAND_VERTICALS[index]

  /* ---------- auto-cycle until the visitor chooses ---------- */
  React.useEffect(() => {
    if (pinned || reduce || !inView) return
    const id = window.setInterval(() => {
      setActive((key) => {
        const i = LAND_VERTICALS.findIndex((v) => v.key === key)
        return LAND_VERTICALS[(i + 1) % LAND_VERTICALS.length].key
      })
    }, CYCLE_MS)
    return () => window.clearInterval(id)
  }, [pinned, reduce, inView])

  const choose = React.useCallback((key: LandVerticalKey) => {
    setActive(key)
    setPinned(true)
  }, [])

  /* ---------- pointer tilt ---------- */
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, SPRING_SOFT)
  const sy = useSpring(my, SPRING_SOFT)
  const stackX = useTransform(sx, (v) => v * 14)
  const stackY = useTransform(sy, (v) => v * 10)
  const chipX = useTransform(sx, (v) => v * -22)
  const chipY = useTransform(sy, (v) => v * -16)

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

  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 210, damping: 26, mass: 0.9 }

  return (
    <section
      aria-labelledby="hero-title"
      className="relative overflow-hidden bg-background pt-8 pb-14 sm:pt-12 sm:pb-16 lg:pt-14 lg:pb-20"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-8 lg:px-8">
        {/* ---------- copy ---------- */}
        <div className="lg:col-span-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[0.75rem] font-semibold text-muted">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
            Booking software for businesses that run on a calendar
          </p>

          <h1
            id="hero-title"
            className="mt-5 font-display text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-foreground sm:text-5xl lg:text-[3.5rem] xl:text-[3.85rem]"
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
          </h1>

          <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-muted sm:text-lg">
            Availability, deposits, staff rosters and next-day payouts for tours, restaurants,
            events, classes and venues. One inventory behind your website, the marketplaces
            and the phone.
          </p>

          <div className="mt-7 max-w-xl">
            <Segmented
              size="sm"
              fullWidth
              hideLabelsOnMobile
              label="Choose a type of business"
              value={active}
              onValueChange={choose}
              options={LAND_VERTICALS.map((v) => ({ value: v.key, label: v.label, icon: v.icon, ariaLabel: v.label }))}
            />
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" rightIcon={<ArrowRight aria-hidden="true" />}>
              <Link href="/signup">Start free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" leftIcon={<Play aria-hidden="true" />}>
              <Link href="/dashboard">See it running</Link>
            </Button>
          </div>

          <p className="mt-4 text-[0.8125rem] text-subtle">
            No card to start · 4% flat booking fee · Free migration from FareHarbor, Peek Pro, OpenTable or Eventbrite
          </p>
        </div>

        {/* ---------- scene ---------- */}
        <div className="lg:col-span-6">
          <div
            ref={sceneRef}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            className="relative mx-auto aspect-[5/4] w-full max-w-xl sm:aspect-[4/3] lg:aspect-[5/4]"
          >
            {/* card stack */}
            <motion.div style={{ x: stackX, y: stackY }} className="absolute inset-x-[8%] inset-y-[6%] lg:inset-x-[10%]">
              {LAND_VERTICALS.map((v, i) => {
                const order = (i - index + LAND_VERTICALS.length) % LAND_VERTICALS.length
                const slot = order < SLOT.length ? SLOT[order] : HIDDEN
                return (
                  <motion.figure
                    key={v.key}
                    aria-hidden={order !== 0}
                    className="absolute inset-0 m-0 overflow-hidden rounded-[1.75rem] bg-surface-sunken shadow-2xl ring-1 ring-black/10"
                    initial={false}
                    animate={{
                      x: `${slot.x}%`,
                      y: `${slot.y}%`,
                      rotate: slot.rotate,
                      scale: slot.scale,
                      opacity: slot.opacity,
                      zIndex: slot.z,
                    }}
                    transition={spring}
                  >
                    <Image
                      src={photoUrl(v.photo, 1200)}
                      alt={order === 0 ? v.photo.alt : ''}
                      fill
                      priority={i < 2}
                      sizes="(min-width: 1024px) 40vw, 90vw"
                      className="object-cover"
                      style={{ objectPosition: v.photo.focus }}
                    />
                    <figcaption className="absolute top-4 left-4 rounded-full bg-ink-950/70 px-3 py-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-white uppercase backdrop-blur-sm">
                      {v.label}
                    </figcaption>
                  </motion.figure>
                )
              })}
            </motion.div>

            {/* the booking that just landed */}
            <motion.div style={{ x: chipX, y: chipY }} className="absolute -bottom-3 -left-2 z-40 w-[min(19rem,88%)] sm:-left-4 sm:bottom-2">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.key}
                  role="status"
                  aria-live="polite"
                  initial={reduce ? false : { opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduce ? undefined : { opacity: 0, y: -10, scale: 0.98 }}
                  transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
                  className="rounded-2xl border border-line bg-surface p-4 shadow-xl"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.6875rem] font-semibold tracking-[0.1em] text-subtle uppercase">New booking</p>
                      <p className="mt-1 truncate font-display text-[0.9375rem] font-semibold text-foreground">
                        {current.booking.title}
                      </p>
                      <p className="mt-0.5 text-[0.8125rem] text-muted">{current.booking.when}</p>
                    </div>
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-success text-white">
                      <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-line-subtle pt-3">
                    <span className="shrink-0 rounded-md bg-info-soft px-2 py-1 text-[0.75rem] font-semibold whitespace-nowrap text-info">
                      {current.booking.money}
                    </span>
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-[0.75rem] text-subtle">
                      <MessageSquareText aria-hidden="true" className="size-3.5 shrink-0" />
                      <span className="truncate">{current.booking.note}</span>
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </motion.div>

            {/* seats left */}
            <motion.div
              style={{ x: chipX, y: chipY }}
              className="absolute -top-2 right-0 z-40 sm:-right-3 sm:top-4"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={current.key}
                  initial={reduce ? false : { opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? undefined : { opacity: 0, x: 8 }}
                  transition={{ duration: 0.4, ease: EASE_OUT_EXPO, delay: 0.1 }}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full bg-navy-deep px-3 py-1.5 text-[0.75rem] font-semibold text-white shadow-lg',
                  )}
                >
                  <span className="relative flex size-2" aria-hidden="true">
                    <span className="absolute inline-flex size-full rounded-full bg-primary opacity-75 motion-safe:animate-pulse-ring" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary" />
                  </span>
                  Live on your site and Viator
                </motion.p>
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
