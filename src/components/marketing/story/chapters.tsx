'use client'

import * as React from 'react'
import Image from 'next/image'
import { motion, useInView } from 'motion/react'

import { Reveal } from '@/components/motion/reveal'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { PHOTOS, photoUrl, type Photo } from './photos'

/* ==========================================================================
   Chapters — four capabilities, each drawn rather than screenshotted.

   Alternating editorial spreads: a photograph on one side, and on the other
   a small diagram of the mechanism (a seat map filling, two payout rails,
   a hub of channels, a phone with no bars). The diagrams animate once, on
   arrival, and sit still afterwards.
   ========================================================================== */

/* ---- diagrams ------------------------------------------------------------ */

function useArrived<T extends Element>() {
  const ref = React.useRef<T>(null)
  const inView = useInView(ref, { once: true, margin: '-15% 0px' })
  return { ref, inView }
}

/** 24 seats, 22 filling in row by row — the boat that never oversells. */
function SeatMap() {
  const reduce = useReducedMotionSafe()
  const { ref, inView } = useArrived<HTMLDivElement>()
  const seats = Array.from({ length: 24 }, (_, i) => i)
  const filled = 22

  return (
    <div ref={ref} className="rounded-3xl border border-line bg-surface p-6 shadow-lg sm:p-8">
      <div className="flex items-center justify-between">
        <p className="text-[0.8125rem] font-semibold text-foreground">M/V Kaimana Sky · 24 seats</p>
        <p className="font-mono text-[0.75rem] text-subtle tabular-nums">row lock · 40 ms</p>
      </div>
      <div className="mt-5 grid grid-cols-6 gap-2.5" role="img" aria-label="Twenty-two of twenty-four seats sold">
        {seats.map((i) => {
          const on = i < filled
          return (
            <motion.span
              key={i}
              initial={reduce ? false : { opacity: 0.25, scale: 0.7 }}
              animate={inView ? { opacity: 1, scale: 1 } : undefined}
              transition={{ delay: 0.15 + i * 0.045, duration: 0.4, ease: EASE_OUT_EXPO }}
              className={cn(
                'aspect-[5/4] rounded-md ring-1 ring-inset',
                on ? 'bg-primary ring-primary' : 'bg-surface-sunken ring-line-strong',
              )}
            />
          )
        })}
      </div>
      <div className="mt-5 flex items-center justify-between text-[0.75rem]">
        <span className="text-muted">
          Sold across your site, Viator and the phone
        </span>
        <span className="font-semibold text-foreground tabular-nums">22 / 24</span>
      </div>
    </div>
  )
}

/** Two rails: money on EZRA lands the next day; elsewhere it waits a week. */
function PayoutRails() {
  const reduce = useReducedMotionSafe()
  const { ref, inView } = useArrived<HTMLDivElement>()
  const rails = [
    { label: 'EZRA Pro', days: 1, tone: 'bg-primary', text: 'text-primary' },
    { label: 'Typical platform', days: 7, tone: 'bg-line-strong', text: 'text-muted' },
  ]
  return (
    <div ref={ref} className="rounded-3xl border border-line bg-surface p-6 shadow-lg sm:p-8">
      <p className="text-[0.8125rem] font-semibold text-foreground">A Tuesday sail, paid out</p>
      <ul className="mt-6 space-y-6">
        {rails.map((r, i) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between text-[0.8125rem]">
              <span className={cn('font-semibold', r.text)}>{r.label}</span>
              <span className="text-subtle tabular-nums">
                {r.days === 1 ? 'Wednesday' : 'the following Tuesday'}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-7 gap-1.5">
              {Array.from({ length: 7 }, (_, d) => (
                <motion.span
                  key={d}
                  initial={reduce ? false : { scaleX: 0 }}
                  animate={inView ? { scaleX: 1 } : undefined}
                  transition={{ delay: 0.2 + i * 0.35 + d * 0.06, duration: 0.45, ease: EASE_OUT_EXPO }}
                  className={cn(
                    'block h-2.5 origin-left rounded-full',
                    d < r.days ? r.tone : 'bg-surface-sunken ring-1 ring-line-subtle ring-inset',
                  )}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[0.75rem] leading-relaxed text-muted">
        Six days is a fuel bill, a crew payday and a slip fee. Next-day settlement is on every
        plan, including the free one.
      </p>
    </div>
  )
}

/** One inventory in the middle; every channel reads from it. */
function ChannelHub() {
  const reduce = useReducedMotionSafe()
  const { ref, inView } = useArrived<HTMLDivElement>()
  const spokes = [
    { label: 'Your site', angle: -90 },
    { label: 'Viator', angle: -30 },
    { label: 'GetYourGuide', angle: 30 },
    { label: 'Expedia', angle: 90 },
    { label: 'Phone', angle: 150 },
    { label: 'Walk-up', angle: 210 },
  ]
  const R = 118

  return (
    <div ref={ref} className="rounded-3xl border border-line bg-surface p-6 shadow-lg sm:p-8">
      <p className="text-[0.8125rem] font-semibold text-foreground">Live inventory, every channel</p>
      <div className="relative mx-auto mt-4 aspect-square w-full max-w-[19rem]">
        <svg viewBox="-160 -160 320 320" className="size-full" role="img" aria-label="Six sales channels connected to one pool of seats">
          {spokes.map((s, i) => {
            const rad = (s.angle * Math.PI) / 180
            const x = Math.cos(rad) * R
            const y = Math.sin(rad) * R
            return (
              <g key={s.label}>
                <line x1={0} y1={0} x2={x} y2={y} stroke="var(--border-strong)" strokeWidth={1.25} />
                {!reduce ? (
                  <motion.circle
                    r={3.5}
                    fill="var(--primary)"
                    initial={{ cx: x, cy: y, opacity: 0 }}
                    animate={inView ? { cx: [x, 0], cy: [y, 0], opacity: [0, 1, 0] } : undefined}
                    transition={{ delay: 0.6 + i * 0.35, duration: 1.3, repeat: Infinity, repeatDelay: 2.4, ease: 'easeInOut' }}
                  />
                ) : null}
                <circle cx={x} cy={y} r={7} fill="var(--surface)" stroke="var(--border-strong)" strokeWidth={1.25} />
                <text
                  x={x + (Math.abs(x) < 20 ? 0 : x > 0 ? 14 : -14)}
                  y={y + (Math.abs(y) > 100 ? (y > 0 ? 24 : -16) : 4)}
                  textAnchor={Math.abs(x) < 20 ? 'middle' : x > 0 ? 'start' : 'end'}
                  fill="var(--fg-muted)"
                  fontSize={11}
                  fontWeight={600}
                >
                  {s.label}
                </text>
              </g>
            )
          })}
          <motion.circle
            r={46}
            fill="var(--primary-soft)"
            stroke="var(--primary)"
            strokeWidth={1.5}
            initial={reduce ? false : { scale: 0.85, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : undefined}
            transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
          />
          <text y={-4} textAnchor="middle" fill="var(--primary)" fontSize={20} fontWeight={700} fontFamily="var(--font-display)">
            14
          </text>
          <text y={14} textAnchor="middle" fill="var(--fg-muted)" fontSize={10.5} fontWeight={600}>
            seats left
          </text>
        </svg>
      </div>
      <p className="text-center text-[0.75rem] text-muted">Sell the last seat anywhere; it is gone everywhere in under a second.</p>
    </div>
  )
}

/** A phone, no bars, a manifest that still works. */
function OfflinePhone() {
  const reduce = useReducedMotionSafe()
  const { ref, inView } = useArrived<HTMLDivElement>()
  const rows = ['Whitaker ×2', 'Tanaka ×1', 'Sharma ×3', 'Okafor ×2']
  return (
    <div ref={ref} className="flex justify-center rounded-3xl border border-line bg-surface p-6 shadow-lg sm:p-8">
      <div className="relative w-[13.5rem] rounded-[2rem] border-[6px] border-ink-900 bg-background p-3 shadow-xl">
        <div className="flex items-center justify-between px-1 text-[0.625rem] font-semibold text-foreground">
          <span className="tabular-nums">05:41</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-1.5 py-0.5 text-warning">
            <span className="size-1.5 rounded-full bg-warning" />
            No service
          </span>
        </div>
        <p className="mt-3 px-1 text-[0.75rem] font-semibold text-foreground">Dawn Patrol · 06:00</p>
        <p className="px-1 text-[0.625rem] text-subtle">Manifest cached 05:12</p>
        <ul className="mt-2 space-y-1.5">
          {rows.map((r, i) => (
            <motion.li
              key={r}
              initial={reduce ? false : { opacity: 0, x: -8 }}
              animate={inView ? { opacity: 1, x: 0 } : undefined}
              transition={{ delay: 0.3 + i * 0.12, duration: 0.4, ease: EASE_OUT_EXPO }}
              className="flex items-center justify-between rounded-lg bg-surface px-2 py-1.5 text-[0.6875rem] ring-1 ring-line-subtle ring-inset"
            >
              <span className="text-foreground">{r}</span>
              <span className={cn('size-4 rounded-full', i < 2 ? 'bg-success' : 'bg-surface-sunken ring-1 ring-line ring-inset')} />
            </motion.li>
          ))}
        </ul>
        <p className="mt-2 px-1 text-[0.5625rem] leading-snug text-subtle">2 check-ins queued · syncs at first bar</p>
      </div>
    </div>
  )
}

/* ---- the spreads ---------------------------------------------------------- */

interface Spread {
  kicker: string
  title: string
  body: string
  detail: string
  photo: Photo
  diagram: React.ReactNode
  flip?: boolean
}

const SPREADS: Spread[] = [
  {
    kicker: 'Capacity',
    title: 'A boat cannot be oversold, because there is only one boat.',
    body: 'Seats live on the departure, not on the channel. Every checkout — yours, a marketplace’s, the phone — takes a row lock on the same departure before it writes. Attach a vessel or a guide and it will refuse to double-book those too.',
    detail: 'Postgres row lock at checkout · resource conflicts refused before they happen',
    photo: PHOTOS.aerialShore,
    diagram: <SeatMap />,
  },
  {
    kicker: 'Payouts',
    title: 'The money lands the next business day. Every day.',
    body: 'Take a deposit at booking and the balance on the day. Split tips to the crew automatically. No rolling seven-day hold — which is the difference between making payroll in shoulder season and not.',
    detail: 'Next-day settlement on every plan · deposits, balances, partial refunds',
    photo: PHOTOS.softBreak,
    diagram: <PayoutRails />,
    flip: true,
  },
  {
    kicker: 'Channels',
    title: 'Viator, GetYourGuide and Expedia read your seats, not a copy of them.',
    body: 'Two-way, in under a second. Sell the last seat on any channel and it disappears from all of them. Per-channel margin reporting shows what each one is really worth after commission.',
    detail: 'Two-way OTA sync · Google Things to do included',
    photo: PHOTOS.palmBeach,
    diagram: <ChannelHub />,
  },
  {
    kicker: 'On the dock',
    title: 'The crew app works with no bars, because the dock has no bars.',
    body: 'Today’s manifest is cached on the device. Check guests in, mark no-shows, capture signatures with no signal at all — it syncs the moment a bar appears on the way out of the harbour.',
    detail: 'Offline manifest and check-in · waivers on the device',
    photo: PHOTOS.diversReef,
    diagram: <OfflinePhone />,
    flip: true,
  },
]

export function Chapters({ className }: { className?: string }) {
  return (
    <section className={cn('bg-background', className)} aria-label="How it works">
      <div className="mx-auto max-w-7xl divide-y divide-line px-6 sm:px-8 lg:px-10">
        {SPREADS.map((s, i) => (
          <article
            key={s.kicker}
            className="grid grid-cols-1 items-center gap-12 py-20 lg:grid-cols-12 lg:gap-16 lg:py-28"
          >
            {/* copy */}
            <Reveal
              distance={16}
              className={cn('lg:col-span-5', s.flip ? 'lg:order-2 lg:col-start-8' : 'lg:order-1')}
            >
              <p className="font-mono text-[0.75rem] font-medium text-subtle tabular-nums">
                {String(i + 1).padStart(2, '0')} <span className="text-primary">·</span> {s.kicker}
              </p>
              <h2 className="mt-4 font-display text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.1] font-semibold tracking-[-0.028em] text-foreground text-balance">
                {s.title}
              </h2>
              <p className="mt-5 text-[0.9375rem] leading-relaxed text-muted">{s.body}</p>
              <p className="mt-6 border-l-2 border-primary pl-3 font-mono text-[0.75rem] leading-relaxed text-subtle">
                {s.detail}
              </p>
            </Reveal>

            {/* photo + diagram, overlapped */}
            <Reveal
              delay={0.1}
              distance={20}
              className={cn('relative lg:col-span-7', s.flip ? 'lg:order-1' : 'lg:order-2')}
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-ink-950 sm:aspect-[16/10]">
                <Image
                  src={photoUrl(s.photo, 1400)}
                  alt={s.photo.alt}
                  fill
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  className="object-cover"
                  style={{ objectPosition: s.photo.focus }}
                />
                <span aria-hidden="true" className="absolute inset-0 bg-ink-950/20" />
              </div>
              <div
                className={cn(
                  'relative -mt-16 w-[min(100%,24rem)] sm:-mt-24',
                  s.flip ? 'ml-auto mr-4 sm:mr-8' : 'ml-4 sm:ml-8',
                )}
              >
                {s.diagram}
              </div>
            </Reveal>
          </article>
        ))}
      </div>
    </section>
  )
}
