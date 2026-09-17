'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { cn } from '@/lib/utils'
import { CalendarIllo, DepositIllo, HostAppIllo, PayoutIllo } from './illustrations'

/* ==========================================================================
   ProductCards — four things the software does, two by two.

   Each card is a pastel panel with a drawing that plays when it scrolls
   into view and replays under the pointer, then a title, two sentences and
   a link. Same four grounds as the hero stage, so the page reads as one
   set of rooms.
   ========================================================================== */

interface Card {
  key: string
  title: string
  body: string
  href: string
  ground: string
  illo: React.ComponentType<{ replayKey?: number; className?: string }>
}

const CARDS: Card[] = [
  {
    key: 'calendar',
    title: 'One calendar behind every channel',
    body: 'Your website, Viator, GetYourGuide, the phone and the walk-up at the door all sell from the same seats. Sell the last one anywhere and it disappears everywhere.',
    href: '/features/calendar',
    ground: 'bg-cal-cloud',
    illo: CalendarIllo,
  },
  {
    key: 'deposits',
    title: 'Deposits, waivers and reminders, set once',
    body: 'Hold a deposit at booking, send the waiver before anyone arrives, remind at 24 hours and release the seat if nobody turns up. Decide it per product and forget it.',
    href: '/features/checkout',
    ground: 'bg-cal-honeydew',
    illo: DepositIllo,
  },
  {
    key: 'host',
    title: 'A host app that works in a basement',
    body: 'Check guests in, take a walk-up, mark a no-show, move a party to a later slot. All of it with no signal, and it catches up the moment the phone finds a bar.',
    href: '/features/host-app',
    ground: 'bg-cal-haze',
    illo: HostAppIllo,
  },
  {
    key: 'payouts',
    title: 'Paid the next business day',
    body: 'Card money lands in your account the next business day, itemised by departure, sitting or event, with tips split to the crew and a flat 4% fee.',
    href: '/features/payments',
    ground: 'bg-cal-sunbeam',
    illo: PayoutIllo,
  },
]

function ProductCard({ card }: { card: Card }) {
  const [replay, setReplay] = React.useState(0)
  const Illo = card.illo
  return (
    <article
      onPointerEnter={() => setReplay((r) => r + 1)}
      className={cn('group flex h-full flex-col overflow-hidden rounded-[1.75rem] bg-surface shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04] transition-shadow duration-300 hover:shadow-[var(--shadow-lg)]')}
    >
      <div className={cn('flex items-center justify-center px-8 pt-8 pb-6 sm:px-12 sm:pt-10', card.ground)}>
        <div className="w-full max-w-[26rem] rounded-2xl bg-surface p-4 shadow-[var(--shadow-md)] sm:p-6">
          <Illo replayKey={replay} className="h-auto w-full" />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-7 sm:p-8">
        <h3 className="font-display text-[1.5rem] leading-[1.2] font-medium tracking-[-0.02em] text-balance text-foreground sm:text-[1.75rem]">{card.title}</h3>
        <p className="mt-3 text-[1rem] leading-[1.5] text-pretty text-muted">{card.body}</p>
        <Link
          href={card.href}
          className="mt-auto inline-flex items-center gap-1.5 pt-6 text-[0.9375rem] font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          Learn more
          <ArrowRight className="size-4 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  )
}

export function ProductCards({ className }: { className?: string }) {
  return (
    <section id="product" aria-labelledby="product-cards-title" className={cn('scroll-mt-4 bg-background py-20 sm:py-24', className)}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal as="h2" id="product-cards-title" blur distance={14} className="font-display text-[2rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.75rem] lg:text-[3rem]">
            The whole operation, from one place.
          </Reveal>
          <Reveal as="p" delay={0.08} distance={12} className="mx-auto mt-5 max-w-2xl text-[1.125rem] leading-[1.45] text-pretty text-muted">
            The same engine sells a sunrise paddle, a chef&rsquo;s table and a 300-seat gala, and runs the day after it sells.
          </Reveal>
        </div>

        <StaggerGroup as="ul" stagger={0.08} margin="-10%" className="mt-12 grid gap-5 md:grid-cols-2 sm:mt-14">
          {CARDS.map((card) => (
            <StaggerItem as="li" key={card.key} distance={22} className="min-w-0">
              <ProductCard card={card} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  )
}
