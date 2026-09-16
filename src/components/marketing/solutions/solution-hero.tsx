'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
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

import { HeroBackdrop, type BackdropToken } from '@/components/marketing/land/hero-backdrop'
import { PHOTOS, photoUrl } from '@/components/marketing/story/photos'
import { Button } from '@/components/ui/button'
import { useIsFinePointer } from '@/hooks/use-media-query'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { SPRING_SOFT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { Vertical } from '@/types'
import type { SolutionContent, SolutionToken, TokenTone } from './solution-content'

/* ==========================================================================
   SolutionHero — the pitch for one trade, with the product on a stage.

   Left: the headline and the four promises for this business. Right: a
   photograph of the trade on a card that leans with the pointer in three
   dimensions, a second frame behind it for depth, and three pieces of the
   product floating around it at their own depths. The floor
   and orbits come from the landing hero's backdrop so the two pages share a
   room.
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

function toBackdropTokens(tokens: SolutionToken[]): BackdropToken[] {
  return tokens.map((token, i) => {
    const Icon = ICONS[token.icon]
    return {
      key: token.key,
      className: token.className,
      depth: token.depth,
      drift: [9, 7, 6][i] ?? 7,
      duration: [7.5, 8.6, 9.4][i] ?? 8,
      delay: [0, 1.2, 0.6][i] ?? 0,
      node: (
        <div className="flex items-center gap-2.5">
          <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', TONE[token.tone])}>
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[0.6875rem] font-semibold text-foreground">{token.title}</p>
            <p className="truncate text-[0.625rem] text-subtle">{token.detail}</p>
          </div>
        </div>
      ),
    }
  })
}

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
  const behind = PHOTOS[content.behind]
  const tokens = React.useMemo(() => toBackdropTokens(content.tokens), [content.tokens])

  /* ---------- pointer tilt, shared with the backdrop ---------- */
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sx = useSpring(mx, SPRING_SOFT)
  const sy = useSpring(my, SPRING_SOFT)
  const cardRotateY = useTransform(sx, (v) => v * 14)
  const cardRotateX = useTransform(sy, (v) => v * -10)
  const cardX = useTransform(sx, (v) => v * 10)
  const behindX = useTransform(sx, (v) => v * -18)
  const behindY = useTransform(sy, (v) => v * -12)

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

  return (
    <section
      aria-labelledby="vertical-title"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className="relative isolate overflow-hidden bg-background pt-8 pb-16 sm:pt-10 sm:pb-20 lg:pt-12 lg:pb-24"
    >
      <HeroBackdrop tiltX={sx} tiltY={sy} tokens={tokens} />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* breadcrumb keeps the six pages navigable without the mega menu */}
        <nav aria-label="Breadcrumb">
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

        <div className="mt-8 grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* ---------- copy ---------- */}
          <div className="lg:col-span-6">

            <motion.h1
              id="vertical-title"
              initial={reduce ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="font-display text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-foreground sm:text-5xl lg:text-[3.5rem] xl:text-[3.85rem]"
            >
              {headline}
            </motion.h1>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-muted sm:text-lg"
            >
              {body}
            </motion.p>

            <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
              {bullets.map((bullet, i) => (
                <motion.li
                  key={bullet}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.16 + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-start gap-2.5 text-[0.9375rem] leading-relaxed text-foreground"
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-soft">
                    <Check className="size-3 text-success" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {bullet}
                </motion.li>
              ))}
            </ul>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" rightIcon={<ArrowRight aria-hidden="true" />}>
                <Link href="/signup">Start free</Link>
              </Button>
              <Button asChild size="lg" variant="outline" leftIcon={<Play aria-hidden="true" />}>
                <Link href="/dashboard">See it running</Link>
              </Button>
            </div>

            <div className="mt-8 flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-4 shadow-sm">
              <p className="shrink-0 font-display text-[2rem] leading-none font-semibold tracking-[-0.03em] text-primary tabular-nums">
                {proofStat}
              </p>
              <p className="min-w-0 text-sm leading-snug text-muted">{proofLabel}</p>
            </div>
          </div>

          {/* ---------- stage ---------- */}
          <div className="lg:col-span-6">
            <div className="relative mx-auto aspect-[5/4] w-full max-w-xl [perspective:1400px]">
              {/* the frame behind, for depth */}
              <motion.figure
                aria-hidden="true"
                style={{ x: behindX, y: behindY, rotateX: cardRotateX, rotateY: cardRotateY }}
                className="absolute inset-x-[16%] inset-y-[2%] m-0 overflow-hidden rounded-[1.75rem] bg-surface-sunken shadow-xl ring-1 ring-black/10 [transform:translateZ(-120px)_rotate(6deg)]"
              >
                <Image src={photoUrl(behind, 1000)} alt="" fill sizes="(min-width: 1024px) 34vw, 80vw" className="object-cover opacity-90" style={{ objectPosition: behind.focus }} />
              </motion.figure>

              {/* the trade, leaning with the pointer */}
              <motion.figure
                style={{ x: cardX, rotateX: cardRotateX, rotateY: cardRotateY, transformStyle: 'preserve-3d' }}
                className="absolute inset-x-[8%] inset-y-[8%] m-0 overflow-hidden rounded-[1.75rem] bg-surface-sunken shadow-2xl ring-1 ring-black/10 lg:inset-x-[10%]"
              >
                <Image src={photoUrl(hero, 1200)} alt={hero.alt} fill priority sizes="(min-width: 1024px) 40vw, 90vw" className="object-cover" style={{ objectPosition: hero.focus }} />
                <figcaption className="absolute top-4 left-4 rounded-full bg-ink-950/70 px-3 py-1 text-[0.6875rem] font-semibold tracking-[0.08em] text-white uppercase backdrop-blur-sm">
                  {vertical.label}
                </figcaption>
              </motion.figure>

            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
