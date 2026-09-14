'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react'
import { ArrowDown, ArrowRight } from 'lucide-react'

import { AnimatedText } from '@/components/motion/text-effects'
import { Button } from '@/components/ui/button'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { PHOTOS, photoUrl } from './photos'

/* ==========================================================================
   StoryHero — a photograph, a thesis, and proof that the thing is alive.

   One real frame of an experience at golden hour, a headline that says what
   we believe, and a ticker of bookings landing across the world — the
   product shown by its effect, not its UI.
   ========================================================================== */

interface Landing {
  initials: string
  name: string
  seats: number
  activity: string
  place: string
}

/** Written to sound like a real morning across diverse operators. */
const LANDINGS: Landing[] = [
  { initials: 'KQ', name: 'Kai Q.', seats: 2, activity: 'Sunrise Heli Tour', place: 'Queenstown, NZ' },
  { initials: 'FL', name: 'Freya L.', seats: 4, activity: 'City Food Walk', place: 'Barcelona, Spain' },
  { initials: 'TW', name: 'Tane W.', seats: 1, activity: 'Summit Zipline', place: 'Whistler, BC' },
  { initials: 'NA', name: 'Nikos A.', seats: 6, activity: 'Sunset Tasting Menu', place: 'Santorini, Greece' },
  { initials: 'CZ', name: 'Clara Z.', seats: 2, activity: 'Morning Yoga Retreat', place: 'Ubud, Bali' },
]

function LiveLandings() {
  const reduce = useReducedMotionSafe()
  const [index, setIndex] = React.useState(0)

  React.useEffect(() => {
    if (reduce) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % LANDINGS.length), 3400)
    return () => window.clearInterval(id)
  }, [reduce])

  const item = LANDINGS[index]

  return (
    <div
      aria-live="polite"
      className="glass-strong relative w-full max-w-sm overflow-hidden rounded-2xl p-3.5 shadow-xl"
    >
      <p className="mb-2.5 flex items-center gap-2 text-[0.6875rem] font-semibold tracking-wide text-muted uppercase">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full rounded-full bg-success opacity-75 motion-safe:animate-pulse-ring" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        Booking now
      </p>

      <div className="relative h-[3.25rem]">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={index}
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
            className="absolute inset-0 flex items-center gap-3"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-on-primary">
              {item.initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[0.8125rem] leading-snug text-foreground">
                <span className="font-semibold">{item.name}</span> booked{' '}
                <span className="font-semibold tabular-nums">
                  {item.seats} {item.seats === 1 ? 'seat' : 'seats'}
                </span>{' '}
                on {item.activity}
              </span>
              <span className="mt-0.5 block truncate text-[0.6875rem] text-subtle">
                {item.place} · just now
              </span>
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

const LOCATIONS = [
  { place: 'New York City', detail: '09:00 food tour · 18 of 20 seats' },
  { place: 'Barcelona, Spain', detail: '10:30 bike tour · 4 per guide' },
  { place: 'Queenstown, NZ', detail: '07:00 heli lift · 2 seats left' },
] as const

export function StoryHero({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const ref = React.useRef<HTMLElement>(null)

  // Decorative layer only: the photograph drifts at a fraction of scroll.
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const photoY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '18%'])
  const copyY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '8%'])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.6], [1, reduce ? 1 : 0.35])

  return (
    <section
      ref={ref}
      aria-label="EZRA Pro — booking software for experience operators"
      className={cn('relative isolate min-h-[88svh] overflow-hidden bg-ink-950 text-ink-50', className)}
    >
      {/* ---- the photograph ------------------------------------------------ */}
      <motion.div style={{ y: photoY }} className="absolute inset-0 -bottom-[18%] -z-20">
        <motion.div
          initial={reduce ? false : { scale: 1.08 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.8, ease: EASE_OUT_EXPO }}
          className="relative size-full"
        >
          <Image
            src={photoUrl(PHOTOS.adventureVista, 2000)}
            alt={PHOTOS.adventureVista.alt}
            fill
            priority
            sizes="100vw"
            className="object-cover"
            style={{ objectPosition: PHOTOS.adventureVista.focus }}
          />
        </motion.div>
      </motion.div>
      {/* Flat scrim for legibility — one tone, no gradient. */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-ink-950/45" />

      {/* ---- the words ------------------------------------------------------ */}
      <motion.div
        style={{ y: copyY, opacity: copyOpacity }}
        className="relative mx-auto flex min-h-[88svh] w-full max-w-7xl flex-col px-6 pt-16 pb-10 sm:px-8 lg:px-10 lg:pt-24"
      >
        <div className="max-w-3xl">
          <motion.p
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
            className="text-[0.75rem] font-semibold tracking-[0.14em] text-lagoon-200 uppercase"
          >
            Booking &amp; experience software · tours, activities, attractions &amp; more
          </motion.p>

          <h1 className="mt-5 font-display text-[clamp(2.75rem,7.2vw,6rem)] leading-[0.98] font-semibold tracking-[-0.035em] text-white text-balance">
            <AnimatedText text="Built for operators," as="span" delay={0.15} stagger={0.06} blur className="block" />
            <span className="mt-1 block font-serif text-[clamp(2.9rem,7.6vw,6.4rem)] font-normal tracking-[-0.02em] text-lagoon-200 italic">
              <AnimatedText text="not accountants." as="span" delay={0.45} stagger={0.06} blur className="block" />
            </span>
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.7, ease: EASE_OUT_EXPO }}
            className="mt-6 max-w-xl text-base leading-relaxed text-ink-100/90 sm:text-lg"
          >
            EZRA Pro runs availability, checkout, crew and payouts for operators who sell
            experiences — from guided city tours and mountain ziplines to dining
            experiences and wellness retreats.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.7, ease: EASE_OUT_EXPO }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button asChild size="lg" variant="primary" rightIcon={<ArrowRight />}>
              <Link href="/signup">Start free — no card</Link>
            </Button>
            <a
              href="#a-day-on-ezra"
              className={cn(
                'inline-flex h-12 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-sm',
                'transition-colors duration-200 hover:bg-white/16',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              )}
            >
              See how it works
              <ArrowDown aria-hidden="true" className="size-4" />
            </a>
          </motion.div>
        </div>

        {/* ---- bottom: where it is running, and what just landed ------------ */}
        <div className="mt-auto flex flex-col gap-6 pt-14 lg:flex-row lg:items-end lg:justify-between">
          <motion.ul
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="flex flex-wrap gap-x-8 gap-y-3"
          >
            {LOCATIONS.map((h) => (
              <li key={h.place} className="min-w-0">
                <p className="text-[0.8125rem] font-semibold text-white">{h.place}</p>
                <p className="mt-0.5 text-[0.75rem] text-ink-200/85 tabular-nums">{h.detail}</p>
              </li>
            ))}
          </motion.ul>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.35, duration: 0.7, ease: EASE_OUT_EXPO }}
            className="w-full lg:w-auto"
          >
            <LiveLandings />
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
