'use client'

import * as React from 'react'

import { SectionHeading } from '@/components/marketing/section-heading'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { LeanCard } from '@/components/motion/lean-card'
import { cn } from '@/lib/utils'
import { CalendarIllo, DepositIllo, HostAppIllo, PayoutIllo, SeatMapIllo } from './illustrations'

/* ==========================================================================
   FeatureBento — five drawings, five sentences.

   The point of the section is that the same engine sells a sunrise paddle, a
   chef's table and a 300-seat gala. Each tile is one job the software does,
   illustrated rather than screenshotted so the page stays light, and each
   drawing replays when the pointer lands on it.
   ========================================================================== */

interface Tile {
  id: string
  title: string
  body: string
  illo: React.ComponentType<{ replayKey?: number; className?: string }>
  span: string
  /** Aspect of the drawing area; the wide tile gets a shorter stage. */
  stage?: string
}

const TILES: Tile[] = [
  {
    id: 'calendar',
    title: 'Every channel writes to one calendar',
    body: 'Your website, Viator, GetYourGuide, the phone and walk-ins all pull from the same seats. Overselling stops being something that can happen.',
    illo: CalendarIllo,
    span: 'sm:col-span-2 lg:col-span-7',
    stage: 'aspect-[16/10] lg:aspect-[2/1]',
  },
  {
    id: 'inventory',
    title: 'Tables, seats, tickets and rooms',
    body: 'A round-table floor plan, a boat seat map, a timed-entry ticket and a bookable room are all the same thing to EZRA: inventory with a clock on it.',
    illo: SeatMapIllo,
    span: 'lg:col-span-5',
  },
  {
    id: 'deposits',
    title: 'Deposits, reminders and no-shows, set once',
    body: 'Hold a deposit at booking, remind at 24 hours, release the seat if nobody turns up. Decide it per product and forget about it.',
    illo: DepositIllo,
    span: 'lg:col-span-4',
  },
  {
    id: 'host',
    title: 'A host app that works in a basement',
    body: 'Check guests in, take a walk-up, mark a no-show with no signal at all. It catches up the moment the phone finds a bar.',
    illo: HostAppIllo,
    span: 'lg:col-span-4',
  },
  {
    id: 'payout',
    title: 'Paid out the next business day',
    body: 'Card money lands in your account the next business day, itemised by departure, sitting or event, so the bookkeeper stops asking.',
    illo: PayoutIllo,
    span: 'lg:col-span-4',
  },
]

function BentoTile({ tile }: { tile: Tile }) {
  const [replay, setReplay] = React.useState(0)
  const Illo = tile.illo

  return (
    <StaggerItem as="li" className={cn('group relative flex flex-col', tile.span)}>
      <LeanCard
        className={cn(
          'flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface',
          'transition-[box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)]',
          'hover:border-line-strong hover:shadow-xl hover:shadow-black/[0.06]',
        )}
      >
      <article className="flex h-full flex-col [transform-style:preserve-3d]" onMouseEnter={() => setReplay((n) => n + 1)}>
        <div className={cn('relative w-full bg-well p-3 sm:p-4 [transform:translateZ(22px)]', tile.stage ?? 'aspect-[16/10]')}>
          <Illo replayKey={replay} />
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-5">
          <h3 className="font-display text-[1.0625rem] font-semibold leading-snug tracking-[-0.02em] text-foreground">
            {tile.title}
          </h3>
          <p className="text-[0.875rem] leading-relaxed text-muted">{tile.body}</p>
        </div>
      </article>
      </LeanCard>
    </StaggerItem>
  )
}

export function FeatureBento({ className }: { className?: string }) {
  return (
    <section id="features" className={cn('scroll-mt-20 bg-background py-16 sm:py-20', className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="What it runs"
          title="One system for tables, seats, tickets and time slots."
          description="EZRA does not care whether the thing you sell is a sunrise paddle, a chef's table or a 300-guest gala. It cares that it is on the calendar, paid for and staffed."
          className="max-w-2xl"
        />

        <StaggerGroup as="ul" stagger={0.08} margin="-10%" className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          {TILES.map((tile) => (
            <BentoTile key={tile.id} tile={tile} />
          ))}
        </StaggerGroup>
      </div>
    </section>
  )
}
