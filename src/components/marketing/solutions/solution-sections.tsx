'use client'

import * as React from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'motion/react'
import { CalendarDays, ChartSpline, Check, CreditCard, Share2, ShoppingCart, Store, UserCog, Users, type LucideIcon } from 'lucide-react'

import { AppFrame } from '@/components/marketing/app-frame'
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
   The sections under the solutions hero. Every heading is centred and short;
   every card carries a shadow rather than a border; every number counts up.
   Reduced motion gets every final state.
   ========================================================================== */

function Heading({ id, label, title, description }: { id: string; label: string; title: string; description?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Reveal direction="up" distance={8}>
        <p className="text-[0.75rem] font-semibold tracking-[0.16em] text-primary uppercase">{label}</p>
      </Reveal>
      <Reveal as="h2" id={id} delay={0.06} distance={14} blur className="mt-4 font-display text-display-sm font-semibold tracking-[-0.03em] text-balance text-foreground md:text-display-md">
        {title}
      </Reveal>
      {description ? (
        <Reveal as="p" delay={0.12} distance={12} className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-pretty text-muted">
          {description}
        </Reveal>
      ) : null}
    </div>
  )
}

/* --------------------------------------------------------------------------
   Moments — three points on a timeline, each a photograph and the thing the
   software did.
   -------------------------------------------------------------------------- */

export function MomentTimeline({ vertical, moments }: { vertical: Vertical; moments: SolutionMoment[] }) {
  return (
    <section aria-labelledby="moments-title" className="bg-background py-20 sm:py-24 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Heading
          id="moments-title"
          label="A week on EZRA"
          title={`A week in ${vertical.label.toLowerCase()}, handled while you were busy.`}
          description="Not features. Things that happened to real operators, and what the software did about them before anyone had to."
        />

        <div className="relative mt-14">
          {/* the line the three moments sit on, desktop only */}
          <span aria-hidden="true" className="absolute inset-x-[16%] top-[1.375rem] hidden h-px bg-line md:block" />

          <StaggerGroup as="ol" stagger={0.12} margin="-10%" className="grid gap-10 md:grid-cols-3 md:gap-8">
            {moments.map((moment, i) => {
              const photo = PHOTOS[moment.photo]
              return (
                <StaggerItem as="li" key={moment.key} distance={22} className="relative flex min-w-0 flex-col">
                  <div className="flex items-center gap-3 md:flex-col md:items-center md:text-center">
                    <span className="relative z-10 grid size-11 shrink-0 place-items-center rounded-full bg-surface font-mono text-[0.75rem] font-semibold text-primary tabular-nums shadow-[var(--shadow-md)] ring-1 ring-black/[0.06]">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="text-[0.8125rem] font-medium text-subtle md:mt-3">
                      <span className="font-mono text-foreground tabular-nums">{moment.time}</span>
                      <span className="mx-1.5 text-faint">·</span>
                      {moment.label}
                    </p>
                  </div>

                  <LeanCard max={5} className="mt-5 flex flex-1 flex-col overflow-hidden rounded-[1.5rem] bg-surface shadow-[var(--shadow-lg)] ring-1 ring-black/[0.05] transition-shadow duration-300 hover:shadow-[var(--shadow-xl)]">
                    <figure className="relative m-0 aspect-[16/10] overflow-hidden">
                      <Image src={photoUrl(photo, 900)} alt={photo.alt} fill sizes="(min-width: 768px) 30vw, 90vw" className="object-cover" style={{ objectPosition: photo.focus }} />
                    </figure>
                    <div className="flex flex-1 flex-col gap-4 p-5 sm:p-6">
                      <p className="text-[1.0625rem] leading-snug font-medium text-foreground">{moment.line}</p>
                      <ul className="mt-auto flex flex-col gap-2 border-t border-line-subtle pt-4">
                        {moment.did.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-[0.875rem] leading-snug text-muted">
                            <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-success-soft">
                              <Check className="size-2.5 text-success" strokeWidth={3} aria-hidden="true" />
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
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------
   Pillars — the four product blocks that matter most here, as a grid of
   cards with shadows.
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
    <section id="features" aria-labelledby="pillars-title" className="scroll-mt-4 border-t border-line bg-surface-sunken py-20 sm:py-24 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Heading
          id="pillars-title"
          label="Built for this"
          title={`The four things ${vertical.label.toLowerCase()} operators lean on hardest.`}
          description={tagline}
        />

        <StaggerGroup as="ul" stagger={0.08} margin="-10%" className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((block) => {
            const Icon = FEATURE_ICONS[block.icon] ?? ShoppingCart
            return (
              <StaggerItem as="li" key={block.id} distance={20} className="min-w-0">
                <LeanCard max={4} className="flex h-full flex-col rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-md)] ring-1 ring-black/[0.04] transition-shadow duration-300 hover:shadow-[var(--shadow-xl)]">
                  <span className={cn('inline-flex size-11 items-center justify-center rounded-2xl [transform:translateZ(24px)]', ACCENT_CHIP[block.accent])}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-5 text-[0.6875rem] font-semibold tracking-[0.14em] text-subtle uppercase">{block.eyebrow}</p>
                  <h3 className="mt-2 font-display text-[1.25rem] leading-snug font-semibold tracking-[-0.02em] text-balance text-foreground">{block.title}</h3>
                  <p className="mt-3 text-[0.9375rem] leading-relaxed text-muted">{block.description}</p>
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
   Console — the desk's view of the week, in a browser frame that stands up
   out of the page.
   -------------------------------------------------------------------------- */

export function ConsoleStage({ vertical, line }: { vertical: Vertical; line: string }) {
  const reduce = useReducedMotionSafe()
  const ref = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] })
  const rotateX = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [18, 0])
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [0.94, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.6], reduce ? [1, 1] : [0.5, 1])

  return (
    <section aria-labelledby="console-title" className="bg-background py-20 sm:py-24 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Heading id="console-title" label="Your week, as the desk sees it" title={line} />
        <div ref={ref} className="mx-auto mt-14 max-w-5xl [perspective:1800px]">
          <motion.div style={{ rotateX, scale, opacity, transformOrigin: '50% 100%' }} className="will-change-transform">
            <AppFrame url={`app.ezra.pro/${vertical.key}/calendar`} bodyClassName="p-3 sm:p-4">
              <VerticalVisual
                vertical={vertical}
                className="[&>div:first-child]:hidden [&>div:last-child>div:first-child]:hidden [&>div:last-child]:rounded-xl [&>div:last-child]:border-0 [&>div:last-child]:shadow-none"
              />
            </AppFrame>
          </motion.div>
        </div>
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
        <h2 id="outcomes-title" className="text-center text-[0.75rem] font-semibold tracking-[0.16em] text-primary uppercase">
          What changed for {vertical.label.toLowerCase()} operators
        </h2>

        <div className="mx-auto mt-10 grid max-w-5xl gap-10 sm:grid-cols-3 sm:gap-8">
          {outcomes.map((n, i) => (
            <Reveal key={n.label} delay={i * 0.08} className="text-center">
              <p className="font-display text-[3rem] leading-none font-semibold tracking-[-0.035em] text-foreground tabular-nums sm:text-[3.5rem]">
                <CountUp value={n.value} prefix={n.prefix} suffix={n.suffix} decimals={n.decimals} duration={1.4} />
              </p>
              <span aria-hidden="true" className="mx-auto mt-5 block h-px w-9 rounded-full bg-primary" />
              <p className="mx-auto mt-4 max-w-[18rem] text-[0.9375rem] leading-snug text-muted">{n.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
