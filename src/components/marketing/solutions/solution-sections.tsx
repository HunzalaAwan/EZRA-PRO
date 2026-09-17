'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, CalendarDays, ChartSpline, Check, CreditCard, Share2, ShoppingCart, Store, UserCog, Users, type LucideIcon } from 'lucide-react'

import { AppFrame } from '@/components/marketing/app-frame'
import { PHOTOS, photoUrl } from '@/components/marketing/story/photos'
import { VerticalVisual } from '@/components/marketing/vertical-showcase'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { cn } from '@/lib/utils'
import type { FeatureBlock, Vertical } from '@/types'
import { SOLUTION_CONTENT, type SolutionMoment } from './solution-content'

/* ==========================================================================
   The sections under the solutions hero, in the landing page's voice:
   centred headings in a medium weight, pastel panels and white cards with
   soft shadows. Reduced motion gets every final state.
   ========================================================================== */

function Heading({ id, label, title, description }: { id: string; label: string; title: string; description?: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <Reveal direction="up" distance={8}>
        <p className="text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">{label}</p>
      </Reveal>
      <Reveal as="h2" id={id} delay={0.06} distance={14} blur className="mt-4 font-display text-[2rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.75rem] lg:text-[3rem]">
        {title}
      </Reveal>
      {description ? (
        <Reveal as="p" delay={0.12} distance={12} className="mx-auto mt-5 max-w-2xl text-[1.125rem] leading-[1.45] text-pretty text-muted">
          {description}
        </Reveal>
      ) : null}
    </div>
  )
}

const GROUND: Record<Vertical['accent'], string> = {
  lagoon: 'bg-cal-cloud',
  coral: 'bg-cal-sunbeam',
  sunset: 'bg-cal-honeydew',
  reef: 'bg-cal-haze',
}

/* --------------------------------------------------------------------------
   Moments — three points on a timeline, each a photograph and the thing the
   software did.
   -------------------------------------------------------------------------- */

export function MomentTimeline({ vertical, moments }: { vertical: Vertical; moments: SolutionMoment[] }) {
  return (
    <section aria-labelledby="moments-title" className="bg-background py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Heading
          id="moments-title"
          label="A week on EZRA"
          title={`A week in ${vertical.label.toLowerCase()}, handled while you were busy.`}
          description="Not features. Things that happened to real operators, and what the software did about them before anyone had to."
        />

        <div className="relative mt-12">
          <span aria-hidden="true" className="absolute inset-x-[16%] top-[1.375rem] hidden h-px bg-line-strong md:block" />

          <StaggerGroup as="ol" stagger={0.12} margin="-10%" className="grid gap-10 md:grid-cols-3 md:gap-6">
            {moments.map((moment, i) => {
              const photo = PHOTOS[moment.photo]
              return (
                <StaggerItem as="li" key={moment.key} distance={22} className="relative flex min-w-0 flex-col">
                  <div className="flex items-center gap-3 md:flex-col md:items-center md:text-center">
                    <span className="relative z-10 grid size-11 shrink-0 place-items-center rounded-full bg-foreground font-mono text-[0.75rem] font-medium text-background tabular-nums">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <p className="text-[0.8125rem] text-subtle md:mt-3">
                      <span className="font-mono font-medium text-foreground tabular-nums">{moment.time}</span>
                      <span className="mx-1.5 text-faint">·</span>
                      {moment.label}
                    </p>
                  </div>

                  <article className="mt-5 flex flex-1 flex-col overflow-hidden rounded-[1.5rem] bg-surface shadow-[var(--shadow-md)] ring-1 ring-black/[0.04]">
                    <figure className="relative m-0 aspect-[16/10] overflow-hidden">
                      <Image src={photoUrl(photo, 900)} alt={photo.alt} fill sizes="(min-width: 768px) 30vw, 90vw" className="object-cover" style={{ objectPosition: photo.focus }} />
                    </figure>
                    <div className="flex flex-1 flex-col gap-4 p-6">
                      <p className="text-[1.0625rem] leading-[1.4] font-medium text-foreground">{moment.line}</p>
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
                  </article>
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
   Pillars — the four product blocks that matter most here.
   -------------------------------------------------------------------------- */

const FEATURE_ICONS: Record<string, LucideIcon> = { ShoppingCart, CalendarDays, ChartSpline, CreditCard, Users, Share2, Store, UserCog }

const CHIP: Record<FeatureBlock['accent'], string> = {
  lagoon: 'bg-cal-sky text-foreground',
  coral: 'bg-cal-peach text-foreground',
  sunset: 'bg-cal-lime text-foreground',
  reef: 'bg-cal-iris text-foreground',
}

export function PillarGrid({ vertical, features, tagline }: { vertical: Vertical; features: FeatureBlock[]; tagline: string }) {
  return (
    <section id="features" aria-labelledby="pillars-title" className="scroll-mt-4 bg-background-subtle py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Heading id="pillars-title" label="Built for this" title={`The four things ${vertical.label.toLowerCase()} operators lean on hardest.`} description={tagline} />

        <StaggerGroup as="ul" stagger={0.08} margin="-10%" className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((block) => {
            const Icon = FEATURE_ICONS[block.icon] ?? ShoppingCart
            return (
              <StaggerItem as="li" key={block.id} distance={20} className="min-w-0">
                <article className="flex h-full flex-col rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04] transition-shadow duration-300 hover:shadow-[var(--shadow-lg)]">
                  <span className={cn('inline-flex size-11 items-center justify-center rounded-2xl', CHIP[block.accent])}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="mt-5 text-[0.75rem] font-medium tracking-[0.08em] text-subtle uppercase">{block.eyebrow}</p>
                  <h3 className="mt-2 font-display text-[1.25rem] leading-[1.25] font-medium tracking-[-0.02em] text-balance text-foreground">{block.title}</h3>
                  <p className="mt-3 text-[0.9375rem] leading-[1.5] text-muted">{block.line}</p>
                </article>
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------
   Console — the desk's view of the week, in a browser frame on a pastel
   panel.
   -------------------------------------------------------------------------- */

export function ConsoleStage({ vertical, line }: { vertical: Vertical; line: string }) {
  return (
    <section aria-labelledby="console-title" className="bg-background py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Heading id="console-title" label="Your week, as the desk sees it" title={line} />
        <Reveal direction="up" distance={28} duration={0.9} className={cn('mx-auto mt-12 max-w-5xl rounded-[2rem] p-4 sm:p-8 lg:p-10', GROUND[vertical.accent])}>
          <AppFrame url={`app.ezra.pro/${vertical.key}/calendar`} bodyClassName="p-3 sm:p-4">
            <VerticalVisual
              vertical={vertical}
              className="[&>div:first-child]:hidden [&>div:last-child>div:first-child]:hidden [&>div:last-child]:rounded-xl [&>div:last-child]:border-0 [&>div:last-child]:shadow-none"
            />
          </AppFrame>
        </Reveal>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------------
   OtherTrades — the other five trades, each as the photograph from its own
   hero with the name and the one-line pitch beneath. A card is a link; the
   photograph eases in a touch on hover and the arrow moves with it.
   -------------------------------------------------------------------------- */

export function OtherTrades({ siblings }: { siblings: Vertical[] }) {
  return (
    <section aria-labelledby="other-trades-title" className="border-t border-line bg-background py-20 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <Heading
          id="other-trades-title"
          label="The other trades"
          title="Run more than one kind of business?"
          description="A dive shop with a café, a hotel with an excursion desk, a studio that runs retreats. One account covers every trade; multi-brand and multi-location are on Scale and Enterprise."
        />

        {/* a swipeable row on phones, a grid from sm */}
        <StaggerGroup
          as="ul"
          stagger={0.06}
          margin="-10%"
          className="-mx-4 mt-12 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5 [&::-webkit-scrollbar]:hidden"
        >
          {siblings.map((item) => {
            const photo = PHOTOS[SOLUTION_CONTENT[item.key].card]
            return (
              <StaggerItem as="li" key={item.key} distance={16} className="w-[70%] shrink-0 snap-start sm:w-auto sm:shrink">
                <Link
                  href={`/solutions/${item.key}`}
                  className={cn(
                    'group flex h-full flex-col rounded-[1.5rem] bg-surface p-2.5 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04]',
                    'transition-[transform,box-shadow] duration-300 ease-[var(--ease-out-expo)]',
                    'hover:-translate-y-1 hover:shadow-[var(--shadow-lg)]',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                  )}
                >
                  <figure className="relative m-0 aspect-[4/5] overflow-hidden rounded-[1.125rem] bg-surface-sunken">
                    <Image
                      src={photoUrl(photo, 1200)}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 15rem, (min-width: 640px) 33vw, 70vw"
                      className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      style={{ objectPosition: photo.focus }}
                    />
                  </figure>
                  <span className="flex flex-1 flex-col px-2 pt-4 pb-2">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-[0.9375rem] font-medium text-foreground">{item.label}</span>
                      <ArrowRight
                        className="size-4 shrink-0 text-faint transition-[transform,color] duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="mt-1.5 text-[0.8125rem] leading-snug text-muted">{item.tagline}</span>
                  </span>
                </Link>
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      </div>
    </section>
  )
}
