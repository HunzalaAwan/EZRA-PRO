'use client'

import * as React from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'motion/react'
import { Check, CloudRain, Lock, Radio, WifiOff } from 'lucide-react'

import { Badge, StatusBadge } from '@/components/ui/badge'
import { CapacityBar } from '@/components/ui/progress'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { PHOTOS, photoUrl, type Photo } from './photos'

interface Chapter {
  time: string
  kicker: string
  title: string
  body: string
  photo: Photo
  card: React.ReactNode
  theme: 'dark' | 'light'
}

/* ---- product cards for each moment -------------------------------------- */

function ManifestCard() {
  const guests = [
    { name: 'Ava Whitaker', seats: 2, waiver: true, on: true },
    { name: 'Hiroshi Tanaka', seats: 1, waiver: true, on: true },
    { name: 'Priya Sharma', seats: 3, waiver: false, on: false },
  ]
  return (
    <div className="rounded-2xl border border-line bg-surface p-4.5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.8125rem] font-semibold text-foreground">Molokini Dawn Patrol · 06:00</p>
        <Badge variant="warning" size="sm" dot>
          <WifiOff aria-hidden="true" className="size-3" />
          Offline
        </Badge>
      </div>
      <ul className="mt-3 divide-y divide-line-subtle">
        {guests.map((g) => (
          <li key={g.name} className="flex items-center gap-3 py-2">
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-full ring-1 ring-inset',
                g.on ? 'bg-success text-white ring-success' : 'bg-surface-sunken text-faint ring-line',
              )}
            >
              <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-foreground">{g.name}</span>
            <span className="text-[0.6875rem] text-subtle tabular-nums">
              {g.seats} {g.seats === 1 ? 'seat' : 'seats'}
            </span>
            <span
              className={cn(
                'text-[0.625rem] font-semibold uppercase',
                g.waiver ? 'text-success' : 'text-warning',
              )}
            >
              {g.waiver ? 'waiver' : 'unsigned'}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.6875rem] text-subtle">
        No signal at Slip 58. Check-ins queue on device and sync at first bar.
      </p>
    </div>
  )
}

function SellOutCard() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4.5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.8125rem] font-semibold text-foreground">Turtle Town Kayak · 09:15</p>
        <StatusBadge kind="departure" status="sold_out" size="sm" />
      </div>
      <div className="mt-3">
        <CapacityBar booked={16} capacity={16} held={0} size="md" showLabel />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-sunken px-3.5 py-2 text-[0.75rem]">
        <span className="text-muted">Waitlist</span>
        <span className="font-semibold text-foreground tabular-nums">4 guests</span>
      </div>
      <p className="mt-3 flex items-start gap-2 text-[0.75rem] leading-relaxed text-muted">
        <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
        Last seat sold on Viator at 08:52. Instantly locked across site & OTAs. Zero double-bookings.
      </p>
    </div>
  )
}

function WeatherCard() {
  return (
    <div className="rounded-2xl border border-[color-mix(in_oklab,var(--warning)_40%,var(--border))] bg-surface p-4.5 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-warning-soft text-warning">
          <CloudRain aria-hidden="true" className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-semibold text-foreground">Afternoon Reef Snorkel · 12:30</p>
          <p className="text-[0.6875rem] text-subtle">Swell 2.1 m · wind 24 kt · go-confidence 31%</p>
        </div>
      </div>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-foreground text-[0.8125rem] font-semibold text-background shadow-sm hover:opacity-90"
      >
        Hold departure &amp; notify 38 guests
      </button>
      <p className="mt-2.5 text-[0.6875rem] leading-relaxed text-muted">
        One tap notifies guests by SMS to rebook or refund instantly.
      </p>
    </div>
  )
}

function PayoutCard() {
  const reduce = useReducedMotionSafe()
  const steps = ['Booked · Tue 16:30', 'Sailed · Tue 18:40', 'Paid out · Wed 09:00']
  return (
    <div className="rounded-2xl border border-line bg-surface p-4.5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.8125rem] font-semibold text-foreground">Sunset Catamaran Sail · 16:30</p>
        <span className="font-display text-base font-semibold text-foreground tabular-nums">$4,270</span>
      </div>
      <div className="relative mt-4 pl-1">
        <span aria-hidden="true" className="absolute top-1.5 bottom-1.5 left-[0.6875rem] w-px bg-line" />
        <motion.span
          aria-hidden="true"
          initial={reduce ? false : { top: '0.375rem' }}
          whileInView={{ top: 'calc(100% - 0.875rem)' }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1.6, delay: 0.3, ease: EASE_OUT_EXPO }}
          className="absolute left-[0.3125rem] size-3.5 rounded-full bg-primary ring-4 ring-primary-soft"
        />
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-3 pl-7">
              <span
                className={cn(
                  'text-[0.8125rem] tabular-nums',
                  i === steps.length - 1 ? 'font-semibold text-foreground' : 'text-muted',
                )}
              >
                {s}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-3 text-[0.6875rem] leading-relaxed text-muted">
        Next business day settlement. Crew tips automatically itemized.
      </p>
    </div>
  )
}

const CHAPTERS: Chapter[] = [
  {
    time: '05:40',
    kicker: 'Check-in, no bars',
    title: 'The crew list is on the captain’s phone before the sun is up.',
    body: 'Slip 58 has no signal. It never has. The manifest is cached on the device, waivers show as signed or not, and check-ins queue until the first bar on the way out of the harbour.',
    photo: PHOTOS.goldenShore,
    card: <ManifestCard />,
    theme: 'light',
  },
  {
    time: '09:15',
    kicker: 'One inventory',
    title: 'The 9:15 sells its last seat on Viator, and nowhere else.',
    body: 'Your website, the marketplaces, the phone and the walk-up desk all draw from one pool of seats with a lock at checkout. The oversold-boat conversation stops happening.',
    photo: PHOTOS.coralGarden,
    card: <SellOutCard />,
    theme: 'dark',
  },
  {
    time: '12:30',
    kicker: 'Weather call',
    title: 'The swell comes up. Thirty-eight guests hear about it in one tap.',
    body: 'Hold the departure and everyone booked gets a text with a choice: rebook tomorrow or refund now. Seats reopen as they decide. No spreadsheet, no phone tree.',
    photo: PHOTOS.stormSwell,
    card: <WeatherCard />,
    theme: 'light',
  },
  {
    time: '16:30',
    kicker: 'Sunset sail',
    title: 'The boat comes in at 18:40. The money is in the account Wednesday morning.',
    body: 'Not weekly. Not on a seven-day hold. The day’s takings settle the next business day, with crew tips already split — which is how a small operator makes payroll in shoulder season.',
    photo: PHOTOS.sunsetShore,
    card: <PayoutCard />,
    theme: 'dark',
  },
]

/* ---- Single Full-Screen Sticky Card ---- */

interface SingleCardProps {
  chapter: Chapter
  index: number
  total: number
}

function StackedCardItem({ chapter, index, total }: SingleCardProps) {
  const reduce = useReducedMotionSafe()
  const cardRef = React.useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ['start end', 'start start'],
  })

  // Scale down prior cards as subsequent cards stack over them
  const scale = useTransform(
    scrollYProgress,
    [0, 1],
    [1, reduce ? 1 : Math.max(0.92, 1 - (total - 1 - index) * 0.025)],
  )

  const isDark = chapter.theme === 'dark'

  return (
    <div
      ref={cardRef}
      style={{
        position: 'sticky',
        top: `calc(5.5rem + ${index * 1.5}rem)`,
      }}
      className="mb-12 last:mb-0"
    >
      <motion.div
        style={{ scale }}
        className={cn(
          'relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] border shadow-2xl transition-shadow duration-300',
          'min-h-[78vh] sm:min-h-[82vh] flex flex-col justify-between p-6 sm:p-10 lg:p-12',
          isDark
            ? 'border-ink-800 bg-ink-950 text-white shadow-ink-950/50'
            : 'border-line/70 bg-surface text-foreground shadow-xl',
        )}
      >
        {/* Decorative inner background glow */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -top-32 -right-32 size-[32rem] rounded-full blur-3xl opacity-20',
            isDark ? 'bg-lagoon-500' : 'bg-primary-soft',
          )}
        />

        {/* Card Header Info */}
        <div className="flex items-center justify-between gap-4 border-b border-line/20 pb-5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'grid size-9 place-items-center rounded-xl font-mono text-xs font-bold tabular-nums',
                isDark ? 'bg-white/10 text-white' : 'bg-primary-soft text-primary',
              )}
            >
              {chapter.time}
            </span>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
              {chapter.kicker}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-subtle">
              Chapter {index + 1} of {total}
            </span>
          </div>
        </div>

        {/* Card Body Grid */}
        <div className="my-auto grid grid-cols-1 gap-8 py-6 lg:grid-cols-12 lg:items-center">
          {/* Photo Frame */}
          <div className="lg:col-span-6">
            <div className="relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/3] overflow-hidden rounded-2xl sm:rounded-3xl border border-line/20 shadow-lg">
              <Image
                src={photoUrl(chapter.photo, 1400)}
                alt={chapter.photo.alt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-700 hover:scale-105"
                style={{ objectPosition: chapter.photo.focus }}
              />
              <span className="absolute bottom-4 right-4 rounded-full bg-black/50 px-3 py-1 font-mono text-xs text-white backdrop-blur-md">
                {chapter.time}
              </span>
            </div>
          </div>

          {/* Copy & Live Card */}
          <div className="flex flex-col justify-center space-y-6 lg:col-span-6">
            <div>
              <h3
                className={cn(
                  'font-display text-[clamp(1.625rem,2.8vw,2.375rem)] leading-[1.1] font-semibold tracking-[-0.025em] text-balance',
                  isDark ? 'text-white' : 'text-foreground',
                )}
              >
                {chapter.title}
              </h3>
              <p
                className={cn(
                  'mt-3.5 text-sm sm:text-base leading-relaxed max-w-lg',
                  isDark ? 'text-white/80' : 'text-muted',
                )}
              >
                {chapter.body}
              </p>
            </div>

            {/* Embedded Live Interactive Surface */}
            <div className="max-w-md">{chapter.card}</div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="flex items-center justify-between border-t border-line/20 pt-4 text-xs text-subtle">
          <span className="flex items-center gap-2">
            <Radio className="size-3.5 text-primary" />
            Live Seam Component
          </span>
          <span>EZRA Pro Operating Seam</span>
        </div>
      </motion.div>
    </div>
  )
}

/* ---- Main DayStory Section ---- */

export function DayStory({ className }: { className?: string }) {
  return (
    <section
      id="a-day-on-the-water"
      className={cn('relative scroll-mt-4 bg-surface-sunken py-20 lg:py-28', className)}
      aria-label="A day on the water, in four chapters"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 mb-12">
        <p className="text-[0.75rem] font-semibold tracking-[0.14em] text-primary uppercase">
          A Tuesday in Maʻalaea
        </p>
        <h2 className="mt-3 max-w-3xl font-display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.04] font-semibold tracking-[-0.035em] text-foreground text-balance">
          One product, four moments, no one left on the dock.
        </h2>
        <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">
          Scroll down to see how EZRA Pro handles every step of an operator's day, from 05:40 dawn check-in to next-day payout.
        </p>
      </div>

      {/* Stacking Cards Container */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {CHAPTERS.map((chapter, index) => (
          <StackedCardItem
            key={chapter.time}
            chapter={chapter}
            index={index}
            total={CHAPTERS.length}
          />
        ))}
      </div>
    </section>
  )
}
