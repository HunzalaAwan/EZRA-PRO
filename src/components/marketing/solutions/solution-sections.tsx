'use client'

import * as React from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'motion/react'
import { CalendarDays, ChartSpline, Check, CreditCard, Share2, ShoppingCart, Store, UserCog, Users, type LucideIcon } from 'lucide-react'

import { SectionHeading } from '@/components/marketing/section-heading'
import { PHOTOS, photoUrl } from '@/components/marketing/story/photos'
import { VerticalVisual } from '@/components/marketing/vertical-showcase'
import { CountUp } from '@/components/motion/count-up'
import { LeanCard } from '@/components/motion/lean-card'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn } from '@/lib/utils'
import type { FeatureBlock, Vertical } from '@/types'
import type { SolutionMoment, SolutionOutcome } from './solution-content'

/* ==========================================================================
   The sections under the solutions hero. Each is a client component because
   each moves: cards lean toward the pointer, the console rotates into view
   on scroll, the numbers count up. Reduced motion gets every final state.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Moments — three photographs, each with the thing the software did.
   -------------------------------------------------------------------------- */

export function MomentCards({ vertical, moments }: { vertical: Vertical; moments: SolutionMoment[] }) {
  return (
    <section aria-labelledby="moments-title" className="bg-background py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="moments-title"
          eyebrow="Three moments"
          title={`A week in ${vertical.label.toLowerCase()}, handled while you were busy.`}
          description="Not features. Things that happened to real operators, and what the software did about them before anyone had to."
          className="max-w-2xl"
        />

        <StaggerGroup as="ul" stagger={0.1} margin="-10%" className="mt-10 grid gap-5 md:grid-cols-3">
          {moments.map((moment) => {
            const photo = PHOTOS[moment.photo]
            return (
              <StaggerItem as="li" key={moment.key} distance={22} className="min-w-0">
                <LeanCard max={6} className="flex h-full flex-col overflow-hidden rounded-[1.5rem] border border-line bg-surface shadow-sm transition-shadow duration-300 hover:shadow-xl hover:shadow-black/[0.06]">
                  <figure className="relative m-0 aspect-[4/3] overflow-hidden [transform:translateZ(18px)]">
                    <Image src={photoUrl(photo, 900)} alt={photo.alt} fill sizes="(min-width: 768px) 30vw, 90vw" className="object-cover" style={{ objectPosition: photo.focus }} />
                    <figcaption className="absolute top-3 left-3 rounded-full bg-ink-950/70 px-2.5 py-1 font-mono text-[0.625rem] font-medium tracking-[0.12em] text-white uppercase backdrop-blur-sm">
                      {moment.time} · {moment.label}
                    </figcaption>
                  </figure>
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <p className="font-serif text-[1.25rem] leading-[1.25] text-foreground">{moment.line}</p>
                    <ul className="mt-auto flex flex-col gap-1.5 border-t border-line-subtle pt-4">
                      {moment.did.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-[0.8125rem] leading-snug text-muted">
                          <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
                            <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </LeanCard>
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------
   Console — the desk's view of the week, standing up out of the page.
   -------------------------------------------------------------------------- */

export function ConsoleStage({ vertical, line }: { vertical: Vertical; line: string }) {
  const reduce = useReducedMotionSafe()
  const ref = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] })
  const rotateX = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [22, 0])
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [0.92, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.6], reduce ? [1, 1] : [0.4, 1])

  return (
    <section aria-labelledby="console-title" className="border-y border-line bg-surface-sunken py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading id="console-title" eyebrow="Your week, as the desk sees it" title={line} align="center" className="mx-auto max-w-3xl" />
        <div ref={ref} className="mx-auto mt-10 max-w-4xl [perspective:1600px]">
          <motion.div style={{ rotateX, scale, opacity, transformOrigin: '50% 100%' }} className="will-change-transform">
            <div className="rounded-[1.75rem] border border-line bg-surface p-2 shadow-2xl shadow-black/[0.08]">
              <VerticalVisual vertical={vertical} className="[&>div:first-child]:hidden" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------
   Pillars — the four product blocks that matter most here.
   -------------------------------------------------------------------------- */

const FEATURE_ICONS: Record<string, LucideIcon> = { ShoppingCart, CalendarDays, ChartSpline, CreditCard, Users, Share2, Store, UserCog }

const ACCENT_CHIP: Record<FeatureBlock['accent'], string> = {
  lagoon: 'bg-info-soft text-info',
  coral: 'bg-accent-soft text-accent',
  sunset: 'bg-success-soft text-success',
  reef: 'bg-primary-soft text-primary',
}

export function PillarGrid({ vertical, features, tagline }: { vertical: Vertical; features: FeatureBlock[]; tagline: string }) {
  return (
    <section id="features" aria-labelledby="pillars-title" className="scroll-mt-4 bg-background py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="pillars-title"
          eyebrow="Built for this"
          title={`The four things ${vertical.label.toLowerCase()} operators lean on hardest.`}
          description={tagline}
          className="max-w-2xl"
        />

        <StaggerGroup as="ul" stagger={0.08} margin="-10%" className="mt-10 grid gap-5 md:grid-cols-2">
          {features.map((block) => {
            const Icon = FEATURE_ICONS[block.icon] ?? ShoppingCart
            return (
              <StaggerItem as="li" key={block.id} distance={20} className="min-w-0">
                <LeanCard max={4} className="flex h-full flex-col rounded-[1.5rem] border border-line bg-surface p-6 shadow-sm transition-shadow duration-300 hover:shadow-xl hover:shadow-black/[0.06] sm:p-7">
                  <span className={cn('inline-flex size-11 items-center justify-center rounded-2xl [transform:translateZ(24px)]', ACCENT_CHIP[block.accent])}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-5 text-[0.6875rem] font-semibold tracking-[0.14em] text-subtle uppercase">{block.eyebrow}</p>
                  <h3 className="mt-2 font-display text-xl font-semibold tracking-[-0.02em] text-balance text-foreground">{block.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{block.description}</p>
                  <ul className="mt-5 flex flex-col gap-2.5 border-t border-line-subtle pt-5">
                    {block.bullets.map((bullet) => (
                      <li key={bullet} className="flex items-start gap-2.5 text-[0.8125rem] leading-relaxed text-subtle">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-success" strokeWidth={2.75} aria-hidden="true" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </LeanCard>
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------
   Outcomes — three numbers that count up.
   -------------------------------------------------------------------------- */

export function OutcomeBand({ vertical, outcomes }: { vertical: Vertical; outcomes: SolutionOutcome[] }) {
  return (
    <section aria-labelledby="outcomes-title" className="border-y border-line bg-surface-sunken py-16 sm:py-20">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 id="outcomes-title" className="text-[0.6875rem] font-semibold tracking-[0.2em] text-subtle uppercase">
          What changed for {vertical.label.toLowerCase()} operators
        </h2>

        <div className="mt-6 grid gap-6 sm:grid-cols-3 sm:gap-8">
          {outcomes.map((n, i) => (
            <Reveal key={n.label} delay={i * 0.08} className="border-l-2 border-accent pl-4">
              <p className="font-display text-4xl font-semibold tracking-[-0.03em] text-foreground tabular-nums sm:text-5xl">
                <CountUp value={n.value} prefix={n.prefix} suffix={n.suffix} decimals={n.decimals} duration={1.4} />
              </p>
              <p className="mt-2 max-w-[18rem] text-sm leading-snug text-muted">{n.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
