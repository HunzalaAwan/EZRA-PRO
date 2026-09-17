'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useMotionValue, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
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

import { PHOTOS, photoUrl, type Photo } from '@/components/marketing/story/photos'
import { Button } from '@/components/ui/button'
import { useIsFinePointer } from '@/hooks/use-media-query'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO, SPRING_SOFT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { Vertical } from '@/types'
import type { SolutionContent, SolutionToken, TokenTone } from './solution-content'

/* ==========================================================================
   SolutionHero — the pitch for one trade, with the trade all around it.

   Centred copy on a pale violet ground. Either side of it, three
   photographs of the trade sit at slightly different sizes, angles and
   depths: the nearer ones move a little more with the pointer and drift a
   little further as the page scrolls, so the scene has depth without
   anything spinning. Three pieces of the product rest on the photographs.
   Below `lg` the six become a row of three under the copy. Reduced motion
   gets everything still.
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
  primary: 'bg-primary text-on-primary',
  accent: 'bg-foreground text-background',
  success: 'bg-success text-white',
  info: 'bg-cal-lake text-white',
}

/** Where each of the six photographs sits, how big, how tilted, and how near. */
interface Slot {
  className: string
  size: string
  rotate: number
  /** 1 = nearest: most parallax, most scroll drift, biggest shadow. */
  depth: number
}

const SLOTS: Slot[] = [
  { className: 'left-[3%] top-[6%] xl:left-[5%]', size: 'w-[10rem] xl:w-[13rem]', rotate: -6, depth: 1 },
  { className: 'left-[8%] top-[46%] xl:left-[10%]', size: 'w-[8rem] xl:w-[10.5rem]', rotate: 4, depth: 0.55 },
  { className: 'left-[1%] top-[68%] xl:left-[3%]', size: 'w-[9rem] xl:w-[12rem]', rotate: -3, depth: 0.8 },
  { className: 'right-[3%] top-[8%] xl:right-[5%]', size: 'w-[9.5rem] xl:w-[12.5rem]', rotate: 5, depth: 0.9 },
  { className: 'right-[9%] top-[44%] xl:right-[11%]', size: 'w-[8rem] xl:w-[10rem]', rotate: -4, depth: 0.5 },
  { className: 'right-[2%] top-[66%] xl:right-[4%]', size: 'w-[10rem] xl:w-[13rem]', rotate: 3, depth: 1 },
]

/** The chips sit on the first, fourth and sixth photographs. */
const CHIP_SLOTS = ['left-[4%] top-[34%] xl:left-[9%]', 'right-[3%] top-[36%] xl:right-[7%]', 'right-[6%] bottom-[4%] xl:right-[11%]'] as const

function TokenChip({ token }: { token: SolutionToken }) {
  const Icon = ICONS[token.icon]
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-[var(--shadow-xl)] ring-1 ring-black/[0.05]">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', TONE[token.tone])}>
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[0.8125rem] font-medium text-foreground">{token.title}</p>
        <p className="truncate text-[0.75rem] text-subtle">{token.detail}</p>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   One photograph in the field
   -------------------------------------------------------------------------- */

function FieldPhoto({
  photo,
  slot,
  index,
  px,
  py,
  scroll,
  reduce,
}: {
  photo: Photo
  slot: Slot
  index: number
  px: MotionValue<number>
  py: MotionValue<number>
  scroll: MotionValue<number>
  reduce: boolean
}) {
  const x = useTransform(px, (v) => v * 26 * slot.depth)
  const yPointer = useTransform(py, (v) => v * 18 * slot.depth)
  const yScroll = useTransform(scroll, [0, 1], [0, -90 * slot.depth])
  const y = useTransform(() => yPointer.get() + yScroll.get())

  return (
    <motion.figure
      aria-hidden="true"
      initial={reduce ? false : { opacity: 0, y: 28, rotate: slot.rotate }}
      animate={{ opacity: 1, y: 0, rotate: slot.rotate }}
      transition={{ duration: 0.8, delay: 0.25 + index * 0.08, ease: EASE_OUT_EXPO }}
      className={cn('absolute m-0 hidden lg:block', slot.className, slot.size)}
      style={{ zIndex: Math.round(slot.depth * 10) }}
    >
      <motion.div
        style={{ x, y }}
        className={cn(
          'relative aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-surface-sunken ring-1 ring-black/[0.08] will-change-transform',
          slot.depth >= 0.9 ? 'shadow-[var(--shadow-2xl)]' : slot.depth >= 0.7 ? 'shadow-[var(--shadow-xl)]' : 'shadow-[var(--shadow-lg)]',
        )}
      >
        <Image src={photoUrl(photo, 800)} alt="" fill sizes="13rem" className="object-cover" style={{ objectPosition: photo.focus }} />
      </motion.div>
    </motion.figure>
  )
}

/* --------------------------------------------------------------------------
   The hero
   -------------------------------------------------------------------------- */

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
  const photos = React.useMemo(() => content.ring.slice(0, 6).map((key) => PHOTOS[key]), [content.ring])

  const sectionRef = React.useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] })

  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const px = useSpring(mx, SPRING_SOFT)
  const py = useSpring(my, SPRING_SOFT)

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
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
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE_OUT_EXPO },
  })

  return (
    <section
      ref={sectionRef}
      aria-labelledby="vertical-title"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative isolate overflow-hidden bg-cal-rain pt-8 pb-16 sm:pt-10 sm:pb-20 lg:min-h-[44rem] lg:pt-12 lg:pb-24 xl:min-h-[48rem]"
    >
      {/* ---------- the trade, either side ---------- */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 mx-auto max-w-[96rem]">
        {photos.map((photo, i) => (
          <FieldPhoto key={`${photo.id}-${i}`} photo={photo} slot={SLOTS[i]} index={i} px={px} py={py} scroll={scrollYProgress} reduce={reduce} />
        ))}
        {content.tokens.map((token, i) => {
          const slot = CHIP_SLOTS[i]
          if (!slot) return null
          return (
            <motion.div
              key={token.key}
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.9 + i * 0.12, ease: EASE_OUT_EXPO }}
              className={cn('absolute z-20 hidden w-[14rem] lg:block xl:w-[16rem]', slot)}
            >
              <motion.div
                animate={reduce ? undefined : { y: [0, i % 2 ? 7 : -7, 0] }}
                transition={reduce ? undefined : { duration: 8 + i, repeat: Infinity, ease: 'easeInOut' }}
                className="will-change-transform"
              >
                <TokenChip token={token} />
              </motion.div>
            </motion.div>
          )
        })}
      </div>

      {/* ---------- the copy ---------- */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="flex justify-center">
          <ol className="flex flex-wrap items-center gap-2 text-[0.9375rem] text-muted sm:text-base">
            <li>
              <Link href="/" className="rounded transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-muted">Solutions</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-semibold text-foreground">
              {vertical.label}
            </li>
          </ol>
        </nav>

        <div className="mx-auto mt-8 flex max-w-3xl flex-col items-center text-center sm:mt-10 lg:mt-14">
          <motion.h1
            id="vertical-title"
            {...enter(0)}
            className="font-display text-[2.875rem] leading-[1.04] font-medium tracking-[-0.035em] text-balance text-foreground sm:text-[3.75rem] lg:text-[4.25rem] xl:text-[4.75rem]"
          >
            {headline}
          </motion.h1>

          <motion.p {...enter(0.08)} className="mt-7 max-w-2xl text-[1.125rem] leading-[1.45] text-pretty text-muted sm:text-[1.25rem] lg:text-[1.3125rem]">
            {body}
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
            <span className="font-medium text-foreground tabular-nums">{proofStat}</span> {proofLabel} · No card to start · Free migration
          </motion.p>

          <motion.ul {...enter(0.28)} className="mt-7 grid gap-x-8 gap-y-2.5 text-left sm:grid-cols-2">
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

        {/* ---------- below lg: three of the photographs in a row ---------- */}
        <motion.ul {...enter(0.34)} aria-hidden="true" className="mx-auto mt-12 flex max-w-lg items-end justify-center gap-3 lg:hidden">
          {photos.slice(0, 3).map((photo, i) => (
            <li
              key={`${photo.id}-row-${i}`}
              className={cn('relative aspect-[4/5] w-[31%] overflow-hidden rounded-2xl bg-surface-sunken shadow-[var(--shadow-xl)] ring-1 ring-black/[0.08]', i === 0 && '-rotate-3', i === 1 && 'mb-4', i === 2 && 'rotate-3')}
            >
              <Image src={photoUrl(photo, 600)} alt="" fill sizes="30vw" className="object-cover" style={{ objectPosition: photo.focus }} />
            </li>
          ))}
        </motion.ul>
      </div>
    </section>
  )
}
