'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react'
import {
  Anchor,
  ArrowRight,
  Backpack,
  BadgePlus,
  Bus,
  CalendarClock,
  Check,
  CloudRain,
  ConciergeBell,
  FileCheck2,
  Landmark,
  ListOrdered,
  Percent,
  Play,
  Repeat2,
  Scale,
  Ship,
  Ticket,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

import { PHOTOS, photoUrl } from '@/components/marketing/story/photos'
import { Button } from '@/components/ui/button'
import { useIsFinePointer } from '@/hooks/use-media-query'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO, SPRING_SOFT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { Vertical } from '@/types'
import type { SolutionContent, SolutionToken, TokenTone } from './solution-content'

/* ==========================================================================
   SolutionHero — the pitch for one trade, centred, with the trade beneath.

   Breadcrumb, headline, one paragraph, two pill buttons and the four
   promises in a row. Under them a wide photograph of the trade lies back a
   little and stands up as the visitor scrolls; three pieces of the product
   as this operator sees them float around it at their own depths, and the
   pointer leans the whole scene a few degrees. Touch and reduced motion get
   the photograph upright and still.
   ========================================================================== */

const ICONS: Record<SolutionToken['icon'], LucideIcon> = {
  CloudRain,
  Ship,
  FileCheck2,
  Bus,
  Users,
  BadgePlus,
  ConciergeBell,
  Percent,
  Anchor,
  Scale,
  Backpack,
  Landmark,
  ListOrdered,
  Utensils,
  Ticket,
  Repeat2,
  CalendarClock,
}

const TONE: Record<TokenTone, string> = {
  primary: 'bg-primary text-white',
  accent: 'bg-accent text-on-accent',
  success: 'bg-success text-white',
  info: 'bg-info text-white',
}

/** Where the three chips sit around the frame, and how deep. */
const CHIP_SLOTS = [
  { className: '-left-8 top-[18%] w-[17rem]', z: 90, near: true, drift: { y: [0, -7, 0], duration: 7.4, delay: 0 } },
  { className: '-right-8 top-[10%] w-[16rem]', z: 50, near: false, drift: { y: [0, 6, 0], duration: 8.6, delay: 1.1 } },
  { className: '-right-4 bottom-[14%] w-[16rem]', z: 70, near: true, drift: { y: [0, -5, 0], duration: 9.2, delay: 0.5 } },
] as const

export interface SolutionHeroProps {
  vertical: Vertical
  content: SolutionContent
  headline: string
  body: string
  bullets: string[]
  proofStat: string
  proofLabel: string
}

export function SolutionHero({ vertical, content, headline, body, bullets, proofStat, proofLabel }: SolutionHeroProps) {
  const reduce = useReducedMotionSafe()
  const finePointer = useIsFinePointer()
  const hero = PHOTOS[content.hero]

  /* ---------- the frame stands up on scroll ---------- */
  const stageRef = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: stageRef, offset: ['start end', 'start 30%'] })
  const eased = useSpring(scrollYProgress, { stiffness: 120, damping: 26, mass: 0.8 })
  const progress = reduce ? scrollYProgress : eased
  const scrollRotateX = useTransform(progress, [0, 1], reduce ? [0, 0] : [16, 0])
  const scale = useTransform(progress, [0, 1], reduce ? [1, 1] : [0.94, 1])
  const y = useTransform(progress, [0, 1], reduce ? [0, 0] : [36, 0])

  /* ---------- and leans with the pointer ---------- */
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, SPRING_SOFT)
  const sy = useSpring(my, SPRING_SOFT)
  const rotateY = useTransform(sx, (v) => v * 7)
  const pointerRotateX = useTransform(sy, (v) => v * -5)
  const rotateX = useTransform(() => scrollRotateX.get() + pointerRotateX.get())
  const nearX = useTransform(sx, (v) => v * 18)
  const nearY = useTransform(sy, (v) => v * 12)
  const farX = useTransform(sx, (v) => v * -26)
  const farY = useTransform(sy, (v) => v * -18)

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
      aria-labelledby="vertical-title"
      className="relative isolate overflow-hidden bg-[color-mix(in_oklab,var(--primary)_5%,var(--background))] pt-6 pb-16 sm:pt-8 sm:pb-20 lg:pt-10 lg:pb-24"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem] bg-grid opacity-[0.35] mask-radial" />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* breadcrumb keeps the six pages navigable without the mega menu */}
        <nav aria-label="Breadcrumb" className="flex justify-center">
          <ol className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-subtle">
            <li>
              <Link href="/" className="rounded transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-muted">Solutions</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-foreground">
              {vertical.label}
            </li>
          </ol>
        </nav>

        {/* ---------- copy ---------- */}
        <div className="mx-auto mt-8 flex max-w-4xl flex-col items-center text-center sm:mt-10">
          <motion.h1
            id="vertical-title"
            {...enter(0)}
            className="font-display text-[2.625rem] leading-[1.02] font-semibold tracking-[-0.04em] text-balance text-foreground sm:text-6xl lg:text-[4.5rem]"
          >
            {headline}
          </motion.h1>

          <motion.p {...enter(0.08)} className="mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted sm:text-xl">
            {body}
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
            <span className="font-semibold text-foreground tabular-nums">{proofStat}</span> {proofLabel} · No card to start · Free migration
          </motion.p>

          <motion.ul {...enter(0.28)} className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-center gap-2 text-[0.9375rem] text-foreground">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-success-soft">
                  <Check className="size-3 text-success" strokeWidth={3} aria-hidden="true" />
                </span>
                {bullet}
              </li>
            ))}
          </motion.ul>
        </div>

        {/* ---------- the trade ---------- */}
        <div
          ref={stageRef}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          className="relative mx-auto mt-14 max-w-5xl [perspective:1800px] sm:mt-16 lg:mt-20"
        >
          <motion.div
            style={{ rotateX, rotateY, scale, y, transformOrigin: '50% 100%', transformStyle: 'preserve-3d' }}
            className="will-change-transform"
          >
            <figure className="relative m-0 aspect-[16/10] overflow-hidden rounded-[1.75rem] bg-surface-sunken shadow-[var(--shadow-2xl)] ring-1 ring-black/10 sm:aspect-[2/1]">
              <Image src={photoUrl(hero, 1600)} alt={hero.alt} fill priority sizes="(min-width: 1024px) 64rem, 100vw" className="object-cover" style={{ objectPosition: hero.focus }} />
              <figcaption className="absolute top-4 left-4 rounded-full bg-ink-950/70 px-3 py-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-white uppercase backdrop-blur-sm">
                {vertical.label}
              </figcaption>
            </figure>

            {content.tokens.map((token, i) => {
              const slot = CHIP_SLOTS[i]
              if (!slot) return null
              const Icon = ICONS[token.icon]
              return (
                <motion.div
                  key={token.key}
                  aria-hidden="true"
                  style={{ x: slot.near ? nearX : farX, y: slot.near ? nearY : farY, z: slot.z }}
                  className={cn('absolute z-20 hidden lg:block', slot.className)}
                >
                  <motion.div
                    animate={reduce ? undefined : { y: [...slot.drift.y] }}
                    transition={reduce ? undefined : { duration: slot.drift.duration, delay: slot.drift.delay, repeat: Infinity, ease: 'easeInOut' }}
                    className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-[var(--shadow-xl)] ring-1 ring-black/[0.06] will-change-transform"
                  >
                    <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', TONE[token.tone])}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[0.875rem] font-semibold text-foreground">{token.title}</p>
                      <p className="truncate text-[0.75rem] text-subtle">{token.detail}</p>
                    </div>
                  </motion.div>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
