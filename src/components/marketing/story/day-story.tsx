'use client'

import * as React from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'motion/react'
import { Check, CloudRain, DollarSign, Lock, Radio, ShieldCheck, Sparkles, UserCheck, WifiOff } from 'lucide-react'

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
    { name: 'Ava Whitaker', initials: 'AW', seats: 2, waiver: true, on: true },
    { name: 'Hiroshi Tanaka', initials: 'HT', seats: 1, waiver: true, on: true },
    { name: 'Priya Sharma', initials: 'PS', seats: 3, waiver: false, on: false },
  ]
  return (
    <div className="w-full rounded-2xl border border-line/80 bg-surface/95 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-3.5">
        <div>
          <p className="text-[0.875rem] font-semibold text-foreground">Alpine Sunrise Excursion · 06:30</p>
          <p className="text-[0.6875rem] text-muted">Lead Guide: Marcus Vance · Trailhead North</p>
        </div>
        <Badge variant="warning" size="sm" dot>
          <WifiOff aria-hidden="true" className="size-3" />
          Offline Ready
        </Badge>
      </div>

      <ul className="mt-3.5 divide-y divide-line/40">
        {guests.map((g) => (
          <li key={g.name} className="flex items-center gap-3 py-2.5">
            <span
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ring-1 ring-inset',
                g.on
                  ? 'bg-success/15 text-success ring-success/30'
                  : 'bg-surface-sunken text-muted ring-line',
              )}
            >
              {g.on ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : g.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.8125rem] font-medium text-foreground">{g.name}</p>
              <p className="text-[0.6875rem] text-muted tabular-nums">
                {g.seats} {g.seats === 1 ? 'ticket' : 'tickets'}
              </p>
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide uppercase',
                g.waiver
                  ? 'bg-success/10 text-success'
                  : 'bg-warning/10 text-warning',
              )}
            >
              {g.waiver ? 'Waiver Signed' : 'Pending'}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3.5 flex items-center justify-between rounded-xl bg-surface-sunken/80 px-3.5 py-2 text-[0.6875rem] text-muted">
        <span className="flex items-center gap-1.5 font-medium">
          <ShieldCheck className="size-3.5 text-primary" />
          Offline-first local cache active
        </span>
        <span className="font-mono text-subtle">Queued: 0</span>
      </div>
    </div>
  )
}

function SellOutCard() {
  return (
    <div className="w-full rounded-2xl border border-line/80 bg-surface/95 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-3.5">
        <div>
          <p className="text-[0.875rem] font-semibold text-foreground">Canopy Zipline Express · 09:30</p>
          <p className="text-[0.6875rem] text-muted">Tour #Z-402 · 16 Max Capacity</p>
        </div>
        <StatusBadge kind="departure" status="sold_out" size="sm" />
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
          <span className="text-foreground">Booked Capacity</span>
          <span className="tabular-nums text-foreground font-semibold">16 / 16 (100%)</span>
        </div>
        <CapacityBar booked={16} capacity={16} held={0} size="md" />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-sunken/90 px-3.5 py-2.5 text-[0.75rem]">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-primary opacity-75 animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          <span className="text-muted font-medium">Live Waitlist Queue</span>
        </div>
        <span className="font-semibold text-foreground tabular-nums">4 guests waiting</span>
      </div>

      <p className="mt-3.5 flex items-start gap-2 text-[0.75rem] leading-relaxed text-muted">
        <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-primary" />
        Last seat reserved via Viator at 09:14. Instant mutex lock propagated to website, OTAs and front desk in 32ms.
      </p>
    </div>
  )
}

function WeatherCard() {
  return (
    <div className="w-full rounded-2xl border border-[color-mix(in_oklab,var(--warning)_40%,var(--border))] bg-surface/95 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-3 border-b border-line/40 pb-3.5">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning-soft text-warning">
          <CloudRain aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.875rem] font-semibold text-foreground">Scenic Summit Tour · 13:00</p>
          <p className="text-[0.6875rem] text-warning font-medium">Wind gust advisory 36 mph · condition hold</p>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-warning-soft/40 p-3 text-[0.75rem] text-foreground">
        <p className="font-semibold">Automated Guest Broadcast</p>
        <p className="mt-1 text-muted text-[0.6875rem] leading-relaxed">
          38 ticket holders queued for SMS. Guests tap to either rebook into tomorrow at 10:00 or trigger an instant full refund.
        </p>
      </div>

      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-foreground text-[0.8125rem] font-semibold text-background shadow-md hover:opacity-90 transition-opacity"
      >
        Confirm Weather Hold &amp; Notify 38 Guests
      </button>

      <p className="mt-2.5 text-center text-[0.6875rem] text-muted">
        Rebooked seats open in real-time as guests make selections. Zero spreadsheets needed.
      </p>
    </div>
  )
}

function PayoutCard() {
  const reduce = useReducedMotionSafe()
  const steps = [
    { label: 'Booked', time: 'Mon 14:15', detail: 'Direct Website & Viator' },
    { label: 'Completed', time: 'Mon 18:00', detail: 'Manifest finalized' },
    { label: 'Paid Out', time: 'Tue 09:00', detail: 'Direct ACH to bank' },
  ]
  return (
    <div className="w-full rounded-2xl border border-line/80 bg-surface/95 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 border-b border-line/40 pb-3.5">
        <div>
          <p className="text-[0.875rem] font-semibold text-foreground">Sunset Culinary Flight · 17:30</p>
          <p className="text-[0.6875rem] text-muted">Settlement Batch #8491</p>
        </div>
        <div className="text-right">
          <span className="font-display text-lg font-bold text-foreground tabular-nums">$4,850.00</span>
          <span className="block text-[0.6875rem] text-success font-medium">Cleared next day</span>
        </div>
      </div>

      <div className="relative mt-4 pl-1">
        <span aria-hidden="true" className="absolute top-2 bottom-2 left-[0.6875rem] w-px bg-line" />
        <motion.span
          aria-hidden="true"
          initial={reduce ? false : { top: '0.5rem' }}
          whileInView={{ top: 'calc(100% - 1rem)' }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 1.6, delay: 0.3, ease: EASE_OUT_EXPO }}
          className="absolute left-[0.3125rem] size-3.5 rounded-full bg-primary ring-4 ring-primary/20"
        />
        <ol className="space-y-3.5">
          {steps.map((s, i) => (
            <li key={s.label} className="flex items-start justify-between gap-3 pl-7">
              <div>
                <span className={cn('block text-[0.8125rem]', i === steps.length - 1 ? 'font-bold text-foreground' : 'font-medium text-muted')}>
                  {s.label}
                </span>
                <span className="block text-[0.6875rem] text-subtle">{s.detail}</span>
              </div>
              <span className="font-mono text-[0.75rem] text-muted tabular-nums">{s.time}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="mt-4 border-t border-line/40 pt-3 text-[0.6875rem] leading-relaxed text-muted">
        Next-business-day ACH transfer. Staff gratuities and guide commissions cleanly itemized.
      </p>
    </div>
  )
}

const CHAPTERS: Chapter[] = [
  {
    time: '06:15 AM',
    kicker: 'Offline Field Manifest',
    title: 'The guest manifest is on the lead guide’s phone before sunrise.',
    body: 'Remote trailheads, deep canyons, or historic dead zones: your guides never get stuck. Manifests cache locally on mobile, waivers verify offline, and walk-up guest additions sync immediately once signal returns.',
    photo: PHOTOS.hikingTrail,
    card: <ManifestCard />,
    theme: 'light',
  },
  {
    time: '09:15 AM',
    kicker: 'Universal Real-Time Inventory',
    title: 'The 09:30 sells its last seat on Viator, and instantly locks everywhere.',
    body: 'Your direct website, Viator, GetYourGuide, hotel concierges and front desks all draw from a single synchronized pool of real-time availability. Instant mutex locking prevents double-bookings forever.',
    photo: PHOTOS.ziplineCanopy,
    card: <SellOutCard />,
    theme: 'dark',
  },
  {
    time: '12:30 PM',
    kicker: 'One-Tap Condition Holds',
    title: 'Conditions change. Thirty-eight guests are notified and rebooked in seconds.',
    body: 'Trigger a weather hold and every booked guest receives an automated interactive SMS with two instant options: rebook into tomorrow’s departure or claim an immediate refund. Zero phone trees or spreadsheet tracking.',
    photo: PHOTOS.stormyPeaks,
    card: <WeatherCard />,
    theme: 'light',
  },
  {
    time: '17:00 PM',
    kicker: 'Next-Day Payout Rails',
    title: 'The afternoon tour wraps up. The money is in your bank account tomorrow morning.',
    body: 'Never wait 14 days or endure opaque rolling reserves. Daily booking takings settle directly into your bank account the next business day with tips cleanly split and guide commissions automatically tracked.',
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
    [1, reduce ? 1 : Math.max(0.94, 1 - (total - 1 - index) * 0.018)],
  )

  const isDark = chapter.theme === 'dark'

  return (
    <div
      ref={cardRef}
      style={{
        position: 'sticky',
        top: `calc(4.5rem + ${index * 1.5}rem)`,
      }}
      className="mb-16 last:mb-0"
    >
      <motion.div
        style={{ scale }}
        className={cn(
          'relative overflow-hidden rounded-[2.25rem] sm:rounded-[2.75rem] border shadow-2xl transition-all duration-300',
          'min-h-[82vh] sm:min-h-[86vh] flex flex-col justify-between p-7 sm:p-12 lg:p-14',
          isDark
            ? 'border-ink-800/90 bg-ink-950 text-white shadow-ink-950/70 ring-1 ring-white/10'
            : 'border-line/80 bg-surface/95 text-foreground shadow-2xl backdrop-blur-xl ring-1 ring-black/5',
        )}
      >
        {/* Ambient atmospheric glow in the card corner */}
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -top-40 -right-40 size-[36rem] rounded-full blur-3xl opacity-25',
            isDark ? 'bg-primary' : 'bg-primary-soft',
          )}
        />

        {/* Card Header Info */}
        <div className="flex items-center justify-between gap-4 border-b border-line/20 pb-5">
          <div className="flex items-center gap-3.5">
            <span
              className={cn(
                'grid size-10 place-items-center rounded-xl font-mono text-xs font-bold tabular-nums shadow-sm',
                isDark ? 'bg-white/10 text-white ring-1 ring-white/15' : 'bg-primary-soft text-primary ring-1 ring-primary/20',
              )}
            >
              {chapter.time}
            </span>
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted">
              {chapter.kicker}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-line/30 bg-surface-sunken/60 px-3.5 py-1.5 font-mono text-xs text-subtle">
              Moment {index + 1} of {total}
            </span>
          </div>
        </div>

        {/* Card Body Grid */}
        <div className="my-auto grid grid-cols-1 gap-10 py-8 lg:grid-cols-12 lg:items-center">
          {/* Photo Frame - Big, Smooth, and High-Resolution */}
          <div className="lg:col-span-6">
            <div className="relative aspect-[16/11] min-h-[320px] sm:min-h-[380px] lg:min-h-[440px] overflow-hidden rounded-3xl border border-line/30 shadow-2xl group">
              <Image
                src={photoUrl(chapter.photo, 1600)}
                alt={chapter.photo.alt}
                fill
                priority={index === 0}
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-[1200ms] ease-[var(--ease-out-expo)] group-hover:scale-105"
                style={{ objectPosition: chapter.photo.focus }}
              />
              <span className="absolute bottom-4 right-4 rounded-full bg-black/65 px-4 py-1.5 font-mono text-xs font-medium text-white backdrop-blur-md shadow-md">
                {chapter.time}
              </span>
            </div>
          </div>

          {/* Copy & Live Seam Card */}
          <div className="flex flex-col justify-center space-y-7 lg:col-span-6">
            <div>
              <h3
                className={cn(
                  'font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.12] font-semibold tracking-[-0.03em] text-balance',
                  isDark ? 'text-white' : 'text-foreground',
                )}
              >
                {chapter.title}
              </h3>
              <p
                className={cn(
                  'mt-4 text-base sm:text-lg leading-relaxed max-w-xl',
                  isDark ? 'text-white/85' : 'text-muted',
                )}
              >
                {chapter.body}
              </p>
            </div>

            {/* Embedded Live Interactive Surface */}
            <div className="w-full max-w-lg">{chapter.card}</div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="flex items-center justify-between border-t border-line/20 pt-4 text-xs text-subtle">
          <span className="flex items-center gap-2 font-medium">
            <Radio className="size-3.5 text-primary" />
            Live Operating Seam
          </span>
          <span className="font-mono">EZRA Pro Core Platform</span>
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
      className={cn('relative scroll-mt-4 bg-surface-sunken py-24 lg:py-32', className)}
      aria-label="A day on EZRA Pro, in four moments"
    >
      <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-10 mb-14">
        <div className="flex items-center gap-2 text-[0.75rem] font-semibold tracking-[0.14em] text-primary uppercase">
          <Sparkles className="size-4" />
          A Typical Day on EZRA Pro
        </div>
        <h2 className="mt-3 max-w-3xl font-display text-[clamp(2.25rem,4.5vw,3.75rem)] leading-[1.04] font-semibold tracking-[-0.035em] text-foreground text-balance">
          Four critical operational moments. Zero double-bookings.
        </h2>
        <p className="mt-4 max-w-2xl text-base text-muted sm:text-lg">
          Explore how EZRA Pro handles every mission-critical step of an operator’s day — from early-morning offline manifests to next-day bank settlements.
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
