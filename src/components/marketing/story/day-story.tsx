'use client'

import * as React from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'motion/react'
import { Check, CloudRain, Lock, Radio, Sparkles, WifiOff } from 'lucide-react'

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
    <div className="rounded-2xl border border-line bg-surface/90 p-4.5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.8125rem] font-semibold text-foreground">Alpine Sunrise Excursion · 06:30</p>
        <Badge variant="warning" size="sm" dot>
          <WifiOff aria-hidden="true" className="size-3" />
          Offline Ready
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
              {g.waiver ? 'waiver signed' : 'unsigned'}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[0.6875rem] text-subtle">
        Zero cellular at the trailhead. Manifest caches on mobile; check-ins queue &amp; sync automatically.
      </p>
    </div>
  )
}

function SellOutCard() {
  return (
    <div className="rounded-2xl border border-line bg-surface/90 p-4.5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.8125rem] font-semibold text-foreground">Canopy Zipline Express · 09:30</p>
        <StatusBadge kind="departure" status="sold_out" size="sm" />
      </div>
      <div className="mt-3">
        <CapacityBar booked={16} capacity={16} held={0} size="md" showLabel />
      </div>
      <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-sunken px-3.5 py-2 text-[0.75rem]">
        <span className="text-muted">Live Waitlist</span>
        <span className="font-semibold text-foreground tabular-nums">4 guests queued</span>
      </div>
      <p className="mt-3 flex items-start gap-2 text-[0.75rem] leading-relaxed text-muted">
        <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
        Last seat sold via Viator at 09:14. Real-time mutex lock secured across site &amp; OTAs in 32ms.
      </p>
    </div>
  )
}

function WeatherCard() {
  return (
    <div className="rounded-2xl border border-[color-mix(in_oklab,var(--warning)_40%,var(--border))] bg-surface/90 p-4.5 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-warning-soft text-warning">
          <CloudRain aria-hidden="true" className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-semibold text-foreground">Scenic Summit Tour · 13:00</p>
          <p className="text-[0.6875rem] text-subtle">Wind advisory 34 mph · weather threshold hold</p>
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
        One tap delivers interactive SMS to guests to rebook into tomorrow or claim automated refund.
      </p>
    </div>
  )
}

function PayoutCard() {
  const reduce = useReducedMotionSafe()
  const steps = ['Booked · Mon 14:15', 'Toured · Mon 18:00', 'Paid out · Tue 09:00']
  return (
    <div className="rounded-2xl border border-line bg-surface/90 p-4.5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.8125rem] font-semibold text-foreground">Sunset Culinary Flight · 17:30</p>
        <span className="font-display text-base font-semibold text-foreground tabular-nums">$4,850</span>
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
        Next business day ACH settlement. Staff gratuities and guide commissions cleanly itemized.
      </p>
    </div>
  )
}

const CHAPTERS: Chapter[] = [
  {
    time: '06:15',
    kicker: 'Offline Mobile Manifest',
    title: 'The guest manifest is on the lead guide’s phone before sunrise.',
    body: 'Remote trailheads, deep canyons, or historic cell-dead zones: your team never gets stuck. Manifests cache locally, liability waivers verify offline, and walk-up additions sync as soon as service returns.',
    photo: PHOTOS.hikingTrail,
    card: <ManifestCard />,
    theme: 'light',
  },
  {
    time: '09:15',
    kicker: 'Unified Inventory Engine',
    title: 'The 09:30 sells its last seat on Viator, and instantly locks everywhere.',
    body: 'Your website, Viator, GetYourGuide, resort concierges and front desks all draw from one real-time availability pool. Instant mutex locking prevents double-bookings forever.',
    photo: PHOTOS.ziplineCanopy,
    card: <SellOutCard />,
    theme: 'dark',
  },
  {
    time: '12:30',
    kicker: 'One-Tap Condition Alerts',
    title: 'Conditions change. Thirty-eight guests are notified and rebooked in seconds.',
    body: 'Trigger a weather hold and every booked guest receives a smart SMS with two instant choices: rebook for tomorrow or claim an immediate refund. Zero manual spreadsheets or frantic phone trees.',
    photo: PHOTOS.stormyPeaks,
    card: <WeatherCard />,
    theme: 'light',
  },
  {
    time: '17:00',
    kicker: 'Next-Day Payout Rails',
    title: 'The afternoon tour wraps up. The money is in your bank account tomorrow morning.',
    body: 'Never wait 14 days or endure opaque rolling reserves. Daily takings settle directly the next business day with tips cleanly split and guide commissions automatically attributed.',
    photo: PHOTOS.balloonSunrise,
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

  // Smooth subtle scale down as next cards slide over
  const scale = useTransform(
    scrollYProgress,
    [0, 1],
    [1, reduce ? 1 : Math.max(0.93, 1 - (total - 1 - index) * 0.02)],
  )

  const isDark = chapter.theme === 'dark'

  return (
    <div
      ref={cardRef}
      style={{
        position: 'sticky',
        top: `calc(5rem + ${index * 1.5}rem)`,
      }}
      className="mb-14 last:mb-0"
    >
      <motion.div
        style={{ scale }}
        className={cn(
          'relative overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] border shadow-2xl transition-shadow duration-300',
          'min-h-[76vh] sm:min-h-[80vh] flex flex-col justify-between p-6 sm:p-10 lg:p-12',
          isDark
            ? 'border-ink-800 bg-ink-950 text-white shadow-ink-950/60'
            : 'border-line/80 bg-surface/95 text-foreground shadow-xl backdrop-blur-md',
        )}
      >
        {/* Decorative inner background glow */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -top-32 -right-32 size-[32rem] rounded-full blur-3xl opacity-20',
            isDark ? 'bg-primary' : 'bg-primary-soft',
          )}
        />

        {/* Card Header Info */}
        <div className="flex items-center justify-between gap-4 border-b border-line/20 pb-5">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'grid size-9 place-items-center rounded-xl font-mono text-xs font-bold tabular-nums shadow-sm',
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
            <span className="rounded-full border border-line/30 bg-surface-sunken/40 px-3 py-1 font-mono text-xs text-subtle">
              Phase {index + 1} of {total}
            </span>
          </div>
        </div>

        {/* Card Body Grid */}
        <div className="my-auto grid grid-cols-1 gap-8 py-6 lg:grid-cols-12 lg:items-center">
          {/* Photo Frame */}
          <div className="lg:col-span-6">
            <div className="relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-[4/3] overflow-hidden rounded-2xl sm:rounded-3xl border border-line/20 shadow-xl">
              <Image
                src={photoUrl(chapter.photo, 1400)}
                alt={chapter.photo.alt}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-700 hover:scale-105"
                style={{ objectPosition: chapter.photo.focus }}
              />
              <span className="absolute bottom-4 right-4 rounded-full bg-black/60 px-3.5 py-1.5 font-mono text-xs font-medium text-white backdrop-blur-md">
                {chapter.time}
              </span>
            </div>
          </div>

          {/* Copy & Live Card */}
          <div className="flex flex-col justify-center space-y-6 lg:col-span-6">
            <div>
              <h3
                className={cn(
                  'font-display text-[clamp(1.625rem,2.8vw,2.375rem)] leading-[1.12] font-semibold tracking-[-0.025em] text-balance',
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
          <span className="flex items-center gap-2 font-medium">
            <Radio className="size-3.5 text-primary" />
            Live Operating Seam
          </span>
          <span className="font-mono">EZRA Pro Platform Engine</span>
        </div>
      </motion.div>
    </div>
  )
}

/* ---- Main DayStory Section ---- */

export function DayStory({ className }: { className?: string }) {
  return (
    <section
      id="a-day-on-ezra"
      className={cn('relative scroll-mt-4 bg-surface-sunken py-20 lg:py-28', className)}
      aria-label="A day on EZRA Pro, in four moments"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 mb-12">
        <div className="flex items-center gap-2 text-[0.75rem] font-semibold tracking-[0.14em] text-primary uppercase">
          <Sparkles className="size-4" />
          A Typical Day on EZRA Pro
        </div>
        <h2 className="mt-3 max-w-3xl font-display text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[1.04] font-semibold tracking-[-0.035em] text-foreground text-balance">
          Four critical operational moments. Zero double-bookings.
        </h2>
        <p className="mt-4 max-w-xl text-base text-muted sm:text-lg">
          See how EZRA Pro powers every touchpoint of an experience operator’s day — from sunrise offline check-in to next-day payout.
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
