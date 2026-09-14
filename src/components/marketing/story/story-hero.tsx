'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion, useScroll, useTransform } from 'motion/react'
import { ArrowDown, ArrowRight, CheckCircle2, ShieldCheck, Zap } from 'lucide-react'

import { AnimatedText } from '@/components/motion/text-effects'
import { Button } from '@/components/ui/button'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { PHOTOS, photoUrl } from './photos'

/* ==========================================================================
   StoryHero — photograph, typography, and live operating proof.
   ========================================================================== */

interface Landing {
  initials: string
  name: string
  seats: number
  activity: string
  place: string
}

const LANDINGS: Landing[] = [
  { initials: 'KQ', name: 'Kai Q.', seats: 2, activity: 'Sunrise Heli Tour', place: 'Queenstown, NZ' },
  { initials: 'FL', name: 'Freya L.', seats: 4, activity: 'Historic Food Walk', place: 'Barcelona, Spain' },
  { initials: 'TW', name: 'Tane W.', seats: 1, activity: 'Summit Canopy Zipline', place: 'Whistler, BC' },
  { initials: 'NA', name: 'Nikos A.', seats: 6, activity: 'Vineyard Tasting Menu', place: 'Santorini, Greece' },
  { initials: 'CZ', name: 'Clara Z.', seats: 2, activity: 'Morning Mountain Yoga', place: 'Sedona, AZ' },
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
      className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/20 bg-ink-950/75 p-4 shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <p className="flex items-center gap-2 text-[0.6875rem] font-semibold tracking-wider text-white/70 uppercase">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Live Global Bookings
        </p>
        <span className="flex items-center gap-1 font-mono text-[0.6875rem] text-primary">
          <Zap className="size-3" />
          Synced
        </span>
      </div>

      <div className="relative h-[3.25rem]">
        <AnimatePresence initial={false} mode="wait">
          <motion.div
            key={index}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
            className="absolute inset-0 flex items-center gap-3.5"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/20 text-xs font-bold text-primary ring-1 ring-primary/40">
              {item.initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[0.8125rem] leading-snug text-white">
                <span className="font-semibold">{item.name}</span> booked{' '}
                <span className="font-semibold tabular-nums text-primary">
                  {item.seats} {item.seats === 1 ? 'seat' : 'seats'}
                </span>{' '}
                on {item.activity}
              </span>
              <span className="mt-0.5 block truncate text-[0.6875rem] text-white/60">
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

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const photoY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '18%'])
  const copyY = useTransform(scrollYProgress, [0, 1], ['0%', reduce ? '0%' : '8%'])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.6], [1, reduce ? 1 : 0.35])

  return (
    <section
      ref={ref}
      aria-label="EZRA Pro — booking software for experience operators"
      className={cn('relative isolate min-h-[92svh] overflow-hidden bg-ink-950 text-ink-50', className)}
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

      {/* Layered dark gradients for legibility and cinematic atmosphere */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-ink-950/90 via-ink-950/70 to-ink-950/40" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-48 -z-10 bg-gradient-to-t from-ink-950 to-transparent" />

      {/* ---- the content ------------------------------------------------------ */}
      <motion.div
        style={{ y: copyY, opacity: copyOpacity }}
        className="relative mx-auto flex min-h-[92svh] w-full max-w-7xl flex-col justify-between px-6 pt-20 pb-12 sm:px-8 lg:px-10 lg:pt-28"
      >
        <div className="max-w-3xl">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-md"
          >
            <span className="size-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[0.75rem] font-semibold tracking-wider text-white uppercase">
              The Modern OS for Experience Operators
            </span>
          </motion.div>

          <h1 className="mt-6 font-display text-[clamp(2.85rem,7.5vw,6rem)] leading-[0.98] font-semibold tracking-[-0.035em] text-white text-balance">
            <AnimatedText
              text="Built to Sell Experiences."
              as="span"
              delay={0.15}
              stagger={0.06}
              blur
              className="block text-white drop-shadow-sm"
            />
            <span className="mt-2 block font-serif text-[clamp(2.95rem,7.8vw,6.4rem)] font-normal tracking-[-0.02em] italic">
              <span className="bg-gradient-to-r from-teal-200 via-emerald-300 to-cyan-200 bg-clip-text text-transparent drop-shadow-md">
                Engineered to Scale Them.
              </span>
            </span>
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85, duration: 0.7, ease: EASE_OUT_EXPO }}
            className="mt-6 max-w-xl text-base leading-relaxed text-ink-100/90 sm:text-lg"
          >
            EZRA Pro is the mission-critical booking and operations platform for tour, activity, attraction
            and adventure operators worldwide. Real-time OTA synchronization, offline field manifests,
            and guaranteed next-day bank payouts.
          </motion.p>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.7, ease: EASE_OUT_EXPO }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button asChild size="lg" variant="primary" rightIcon={<ArrowRight />}>
              <Link href="/signup">Start free — no card needed</Link>
            </Button>
            <a
              href="#a-day-on-ezra"
              className={cn(
                'inline-flex h-12 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 text-sm font-semibold text-white backdrop-blur-md',
                'transition-colors duration-200 hover:bg-white/20',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              )}
            >
              See product in action
              <ArrowDown aria-hidden="true" className="size-4" />
            </a>
          </motion.div>

          {/* Value highlights */}
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.15, duration: 0.7 }}
            className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/75"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-primary" />
              Next-day bank payouts
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-primary" />
              Live 2-way OTA sync
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-primary" />
              Offline mobile manifest
            </span>
          </motion.div>
        </div>

        {/* ---- bottom: locations and live landings ------------ */}
        <div className="mt-14 flex flex-col gap-6 pt-10 border-t border-white/10 lg:flex-row lg:items-end lg:justify-between">
          <motion.ul
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.25, duration: 0.8 }}
            className="flex flex-wrap gap-x-8 gap-y-3"
          >
            {LOCATIONS.map((h) => (
              <li key={h.place} className="min-w-0">
                <p className="text-[0.8125rem] font-semibold text-white">{h.place}</p>
                <p className="mt-0.5 text-[0.75rem] text-ink-200/80 tabular-nums">{h.detail}</p>
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
