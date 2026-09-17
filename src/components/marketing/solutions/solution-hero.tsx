'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'motion/react'
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
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { Vertical } from '@/types'
import type { SolutionContent, SolutionToken, TokenTone } from './solution-content'

/* ==========================================================================
   SolutionHero — the pitch for one trade, centred, with the trade beneath.

   Breadcrumb, headline, one paragraph, two buttons, the proof line and the
   four promises in a row. Under them a pastel panel holds a wide photograph
   of the trade, and three pieces of the product as this operator sees them
   are laid over its edges. Nothing tilts; the panel simply rises into place.
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

const CHIP_SLOTS = ['top-[10%] -left-3 sm:-left-6 lg:-left-10', 'top-[8%] -right-3 sm:-right-6 lg:-right-10', 'bottom-[10%] -right-3 sm:-right-6 lg:-right-8'] as const

const GROUND: Record<Vertical['accent'], string> = {
  lagoon: 'bg-cal-cloud',
  coral: 'bg-cal-sunbeam',
  sunset: 'bg-cal-honeydew',
  reef: 'bg-cal-haze',
}

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

/** A token beside the headline, drifting, on wide screens only. */
function SideToken({ token, align, reduce, delay }: { token: SolutionToken; align: 'left' | 'right'; reduce: boolean; delay: number }) {
  return (
    <motion.div
      aria-hidden="true"
      initial={reduce ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, delay, ease: EASE_OUT_EXPO }}
      className={cn('absolute top-[60%] hidden w-[16rem] xl:block', align === 'left' ? '-left-[9rem] 2xl:-left-[13rem]' : '-right-[9rem] 2xl:-right-[13rem]')}
    >
      <motion.div
        animate={reduce ? undefined : { y: align === 'left' ? [0, -8, 0] : [0, 7, 0] }}
        transition={reduce ? undefined : { duration: align === 'left' ? 8.5 : 9.5, repeat: Infinity, ease: 'easeInOut' }}
        className="will-change-transform"
      >
        <TokenChip token={token} />
      </motion.div>
    </motion.div>
  )
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
  const hero = PHOTOS[content.hero]

  const enter = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, delay, ease: EASE_OUT_EXPO },
  })

  return (
    <section aria-labelledby="vertical-title" className="relative isolate overflow-hidden bg-cal-rain pt-8 pb-20 sm:pt-10 sm:pb-24 lg:pt-12">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
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

        <div className="relative mx-auto mt-8 flex max-w-4xl flex-col items-center text-center sm:mt-10">
          {/* two of the three product tokens sit beside the copy on wide screens */}
          {content.tokens.slice(0, 2).map((token, i) => (
            <SideToken key={token.key} token={token} align={i === 0 ? 'left' : 'right'} reduce={reduce} delay={0.5 + i * 0.12} />
          ))}

          <motion.h1
            id="vertical-title"
            {...enter(0)}
            className="font-display text-[2.875rem] leading-[1.04] font-medium tracking-[-0.035em] text-balance text-foreground sm:text-[3.75rem] lg:text-[4.5rem] xl:text-[5rem]"
          >
            {headline}
          </motion.h1>

          <motion.p {...enter(0.08)} className="mt-7 max-w-2xl text-[1.125rem] leading-[1.45] text-pretty text-muted sm:text-[1.25rem] lg:text-[1.375rem]">
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

          <motion.ul {...enter(0.28)} className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5">
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
        <motion.div {...enter(0.34)} className="relative mx-auto mt-12 max-w-5xl sm:mt-14">
          <div className={cn('rounded-[2rem] p-4 sm:p-6 lg:p-8', GROUND[vertical.accent])}>
            <figure className="relative m-0 aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-surface-sunken sm:aspect-[16/9]">
              <Image src={photoUrl(hero, 1600)} alt={hero.alt} fill priority sizes="(min-width: 1024px) 64rem, 100vw" className="object-cover" style={{ objectPosition: hero.focus }} />
            </figure>
          </div>

          {content.tokens.map((token, i) => {
            const slot = CHIP_SLOTS[i]
            if (!slot) return null
            return (
              <motion.div
                key={token.key}
                aria-hidden="true"
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 + i * 0.12, ease: EASE_OUT_EXPO }}
                className={cn('absolute z-10 hidden w-[16rem] sm:block', i < 2 && 'xl:hidden', slot)}
              >
                <TokenChip token={token} />
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
