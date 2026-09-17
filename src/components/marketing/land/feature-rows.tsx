'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import { BookingWidgetPreview } from '@/components/marketing/booking-widget-preview'
import { LeanCard } from '@/components/motion/lean-card'
import { Reveal } from '@/components/motion/reveal'
import { cn } from '@/lib/utils'
import { SeatMapIllo } from './illustrations'
import { InsightCard } from './insight-card'

/* ==========================================================================
   FeatureRows — three rows, text one side and the product the other,
   swapping sides as they go down the page.

   Each row makes one claim and shows one thing: the inventory model, the
   checkout guests finish on a phone, and the analytics that name the slot
   to fix. The visuals sit on a soft panel and lean a few degrees toward the
   pointer; the copy stays still so it can be read.
   ========================================================================== */

interface Row {
  key: string
  label: string
  title: string
  body: string
  points: [string, string, string]
  href: string
  cta: string
  visual: React.ReactNode
  /** Which side the visual sits on at `lg`. */
  side: 'left' | 'right'
}

const ROWS: Row[] = [
  {
    key: 'inventory',
    label: 'One inventory',
    title: 'Tables, seats, tickets and rooms are the same thing to EZRA.',
    body: 'A round-table floor plan, a boat seat map, a timed-entry ticket and a bookable room are all inventory with a clock on it. Set the capacity once and every channel respects it.',
    points: ['Seat maps, floor plans and timed entry', 'Shared resources: guides, boats, rooms, kit', 'Overselling stops being something that can happen'],
    href: '/features',
    cta: 'See how inventory works',
    side: 'right',
    visual: (
      <div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-lg)] ring-1 ring-black/[0.05] sm:p-7">
        <SeatMapIllo className="h-auto w-full" />
      </div>
    ),
  },
  {
    key: 'checkout',
    label: 'Checkout',
    title: 'A checkout guests actually finish.',
    body: 'Most booking flows lose a third of guests between "check availability" and "pay". Ours is three taps on a phone, with Apple Pay and Google Pay on by default and no account to make.',
    points: ['Three taps from calendar to confirmed', 'Apple Pay, Google Pay and card', 'Embeds in the site you already have'],
    href: '/features/checkout',
    cta: 'See the checkout',
    side: 'left',
    visual: <BookingWidgetPreview className="max-w-[24rem]" />,
  },
  {
    key: 'insight',
    label: 'Analytics',
    title: 'Numbers that tell you what to do next.',
    body: 'Not a dashboard of things you already knew. EZRA reads occupancy by weekday and hour and names the slot to cut, add or reprice, with the dollar impact attached.',
    points: ['Occupancy by weekday and hour', 'Channel mix, net of commission', 'Repeat-guest and cohort retention'],
    href: '/features/analytics',
    cta: 'See the analytics',
    side: 'right',
    visual: <InsightCard />,
  },
]

export function FeatureRows({ className }: { className?: string }) {
  return (
    <section id="features" aria-labelledby="feature-rows-title" className={cn('scroll-mt-4 bg-background py-8 sm:py-12 lg:py-16', className)}>
      <h2 id="feature-rows-title" className="sr-only">
        What EZRA Pro runs
      </h2>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-24 px-4 sm:gap-28 sm:px-6 lg:gap-36 lg:px-8">
        {ROWS.map((row) => (
          <article key={row.key} className="grid items-center gap-10 lg:grid-cols-12 lg:gap-16">
            <Reveal
              direction="up"
              distance={18}
              className={cn('lg:col-span-5', row.side === 'left' && 'lg:order-2 lg:col-start-8')}
            >
              <p className="text-[0.75rem] font-semibold tracking-[0.16em] text-primary uppercase">{row.label}</p>
              <h3 className="mt-4 font-display text-[1.875rem] leading-[1.12] font-semibold tracking-[-0.03em] text-balance text-foreground sm:text-[2.25rem]">
                {row.title}
              </h3>
              <p className="mt-5 text-base leading-relaxed text-pretty text-muted sm:text-[1.0625rem]">{row.body}</p>
              <ul className="mt-6 flex flex-col gap-3">
                {row.points.map((point) => (
                  <li key={point} className="flex items-start gap-3 text-[0.9375rem] text-foreground">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-soft">
                      <Check className="size-3 text-success" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {point}
                  </li>
                ))}
              </ul>
              <Link
                href={row.href}
                className="group mt-7 inline-flex items-center gap-1.5 rounded text-[0.9375rem] font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              >
                {row.cta}
                <ArrowRight className="size-4 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </Reveal>

            <Reveal
              direction="up"
              distance={26}
              delay={0.08}
              className={cn('lg:col-span-7', row.side === 'left' && 'lg:order-1 lg:col-start-1')}
            >
              <LeanCard max={5} lift={1.006} className="rounded-[1.75rem] bg-surface-sunken p-6 sm:p-10 lg:p-12">
                <div className="mx-auto w-full max-w-[34rem]">{row.visual}</div>
              </LeanCard>
            </Reveal>
          </article>
        ))}
      </div>
    </section>
  )
}
