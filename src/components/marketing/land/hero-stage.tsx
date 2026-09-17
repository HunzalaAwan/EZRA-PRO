'use client'

import * as React from 'react'
import Link from 'next/link'
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'motion/react'
import { ArrowRight, CalendarDays, Smartphone, ShoppingCart, Wallet, type LucideIcon } from 'lucide-react'

import { BookingWidgetPreview } from '@/components/marketing/booking-widget-preview'
import { useIsDesktop } from '@/hooks/use-media-query'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn } from '@/lib/utils'
import { HostAppMock } from './host-app-mock'
import { MiniCalendar } from './mini-calendar'
import { PayoutMock } from './payout-mock'

/* ==========================================================================
   HeroStage — four pieces of the product, as a deck of cards that the
   scroll deals.

   The stage is a tall strip of page. Inside it, a rounded field of colour
   pins to the top of the window, and as the visitor scrolls, each card in
   turn rises from the bottom and settles over the one before, which slips
   back a step in the pile. When the fourth card has landed the field lets
   go and the page scrolls on. The field's five soft colours follow the
   card on top; the round tabs above show which card is up, the active one
   wearing a ring that fills with the scroll, and a click on a tab scrolls
   the page to that card. Below `md`, and under reduced motion, the four
   cards simply stack in the flow with nothing pinned.
   ========================================================================== */

export type StageKey = 'calendar' | 'checkout' | 'host' | 'payouts'

interface Tab {
  key: StageKey
  label: string
  icon: LucideIcon
  badge?: string
  title: string
  body: string
  href: string
  /** The pastel behind the graphic. */
  panel: string
  node: React.ReactNode
}

const TABS: Tab[] = [
  {
    key: 'calendar',
    label: 'Calendar',
    icon: CalendarDays,
    title: 'One calendar behind every channel',
    body: 'Your website, Viator, the phone and the walk-up at the door all sell from the same seats. Sell the last one anywhere and it disappears everywhere.',
    href: '/product/scheduling',
    panel: 'bg-cal-cloud',
    node: <MiniCalendar />,
  },
  {
    key: 'checkout',
    label: 'Checkout',
    icon: ShoppingCart,
    title: 'A checkout guests actually finish',
    body: 'Three taps on a phone, with Apple Pay and Google Pay on by default and no account to make. Most booking flows lose a third of guests before they pay. This one does not.',
    href: '/product/booking',
    panel: 'bg-cal-honeydew',
    node: <BookingWidgetPreview className="w-[22rem] origin-top scale-[0.82]" />,
  },
  {
    key: 'host',
    label: 'Host app',
    icon: Smartphone,
    badge: 'Offline',
    title: 'A host app that works in a basement',
    body: 'Check guests in, take a walk-up, mark a no-show, move a party to a later slot, with no signal at all. It catches up the moment the phone finds a bar.',
    href: '/product/scheduling',
    panel: 'bg-cal-haze',
    node: <HostAppMock className="origin-top scale-[0.8]" />,
  },
  {
    key: 'payouts',
    label: 'Payouts',
    icon: Wallet,
    title: 'Paid the next business day',
    body: 'Card money lands the next business day, itemised by departure, sitting or event, with tips split to the crew and one flat 4% fee.',
    href: '/product/payments',
    panel: 'bg-cal-sunbeam',
    node: <PayoutMock className="origin-top scale-[0.86]" />,
  },
]

const COUNT = TABS.length

/** Where, in the strip's scroll, each card after the first starts to rise, and how long the rise takes. */
const RISE = 0.14
const START = (index: number) => 0.2 + (index - 1) * 0.27

/** The card on top for a given scroll progress. */
function topCard(p: number) {
  let top = 0
  for (let i = 1; i < COUNT; i++) if (p >= START(i) + RISE / 2) top = i
  return top
}

/** Five blobs, each with its own drift. */
const BLOBS = [
  { className: 'left-[-10%] top-[-20%] h-[60%] w-[45%]', drift: { x: [0, 40, 0], y: [0, 30, 0] }, duration: 19 },
  { className: 'right-[-12%] top-[-15%] h-[65%] w-[48%]', drift: { x: [0, -36, 0], y: [0, 24, 0] }, duration: 23 },
  { className: 'left-[20%] bottom-[-30%] h-[70%] w-[50%]', drift: { x: [0, 28, 0], y: [0, -30, 0] }, duration: 21 },
  { className: 'right-[10%] bottom-[-25%] h-[60%] w-[40%]', drift: { x: [0, -24, 0], y: [0, -20, 0] }, duration: 25 },
  { className: 'left-[35%] top-[10%] h-[50%] w-[36%]', drift: { x: [0, -20, 0], y: [0, 26, 0] }, duration: 27 },
] as const

/* --------------------------------------------------------------------------
   One card
   -------------------------------------------------------------------------- */

function StageCard({ tab, className }: { tab: Tab; className?: string }) {
  const Icon = tab.icon
  return (
    <article className={cn('grid overflow-hidden rounded-[2rem] bg-surface shadow-[var(--shadow-2xl)] ring-1 ring-black/[0.05] md:h-full md:grid-cols-2', className)}>
      <div className="flex flex-col justify-center p-7 sm:p-9 lg:p-12">
        <p className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-primary text-on-primary">
            <Icon className="size-3.5" aria-hidden="true" />
          </span>
          <span className="text-[0.9375rem] font-medium text-foreground">{tab.label}</span>
          {tab.badge ? <span className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted">{tab.badge}</span> : null}
        </p>
        <h3 className="mt-5 font-display text-[1.75rem] leading-[1.12] font-medium tracking-[-0.025em] text-balance text-foreground sm:text-[2.125rem] lg:text-[2.5rem]">
          {tab.title}
        </h3>
        <p className="mt-4 text-[1rem] leading-[1.5] text-pretty text-muted lg:text-[1.0625rem]">{tab.body}</p>
        <Link
          href={tab.href}
          className="mt-7 inline-flex w-fit items-center gap-2 border-b border-foreground pb-1 text-[0.9375rem] font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          Learn more
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <div className={cn('relative flex h-[24rem] items-start justify-center overflow-hidden px-6 pt-8 md:m-4 md:h-auto md:min-h-0 md:rounded-[1.5rem] md:pt-10', tab.panel)}>
        {tab.node}
      </div>
    </article>
  )
}

/** A card in the pinned deck: rises in on its cue, then steps back as later cards land on it. */
function DealtCard({ tab, index, progress }: { tab: Tab; index: number; progress: MotionValue<number> }) {
  const start = START(index)
  const rise = useTransform(progress, index === 0 ? [0, 1] : [start, start + RISE], index === 0 ? ['0%', '0%'] : ['135%', '0%'])

  // Every later card that lands pushes this one one step back in the pile.
  const later = Array.from({ length: COUNT - index - 1 }, (_, k) => START(index + 1 + k))
  const inputs = [0, ...later.flatMap((s) => [s, s + RISE]), 1]
  const steps = later.length
  const scale = useTransform(progress, inputs, [1, ...later.flatMap((_, k) => [1 - 0.04 * k, 1 - 0.04 * (k + 1)]), 1 - 0.04 * steps])
  const shift = useTransform(progress, inputs, [0, ...later.flatMap((_, k) => [-18 * k, -18 * (k + 1)]), -18 * steps])
  const fade = useTransform(progress, inputs, [1, ...later.flatMap((_, k) => [k < 2 ? 1 : 0.8, k + 1 < 2 ? 1 : 0.8]), steps < 2 ? 1 : 0.8])

  return (
    <motion.div style={{ y: rise, zIndex: 10 + index }} className="absolute inset-x-0 top-0 h-full will-change-transform">
      <motion.div style={{ scale, y: shift, opacity: fade, transformOrigin: '50% 0%' }} className="h-full">
        <StageCard tab={tab} />
      </motion.div>
    </motion.div>
  )
}

/* --------------------------------------------------------------------------
   The stage
   -------------------------------------------------------------------------- */

export function HeroStage({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const desktop = useIsDesktop()
  const pinned = desktop && !reduce

  const stripRef = React.useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: stripRef, offset: ['start 104px', 'end end'] })
  const [active, setActive] = React.useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const next = topCard(p)
    setActive((current) => (current === next ? current : next))
  })

  const ringFill = useTransform(scrollYProgress, [0, START(COUNT - 1) + RISE], [0, 1])
  const tab = TABS[active]

  /** Scroll the page so the chosen card is the one on top. */
  const goTo = (index: number) => {
    const strip = stripRef.current
    if (!strip) return
    const rect = strip.getBoundingClientRect()
    const top = rect.top + window.scrollY - 104
    const range = rect.height - (window.innerHeight - 104)
    const p = index === 0 ? 0 : Math.min(START(index) + RISE + 0.03, 1)
    window.scrollTo({ top: top + p * range, behavior: reduce ? 'auto' : 'smooth' })
  }

  /* ---------- the flow version: nothing pinned ---------- */
  if (!pinned) {
    return (
      <div data-tab="calendar" className={cn('mesh relative isolate overflow-hidden rounded-[2.5rem] px-4 py-10 sm:px-8 sm:py-14', className)}>
        <Field reduce={reduce} />
        <ol className="relative z-10 mx-auto flex max-w-5xl flex-col gap-6">
          {TABS.map((item) => (
            <li key={item.key}>
              <StageCard tab={item} className="md:h-auto md:min-h-[26rem]" />
            </li>
          ))}
        </ol>
      </div>
    )
  }

  /* ---------- the pinned deck ---------- */
  return (
    <div ref={stripRef} className={cn('relative h-[380vh]', className)}>
      <div data-tab={tab.key} className="mesh sticky top-[104px] isolate flex h-[calc(100vh-7.5rem)] flex-col overflow-hidden rounded-[2.5rem] px-8 pt-8 pb-8">
        <Field reduce={reduce} />

        {/* ---------- tabs ---------- */}
        <div role="tablist" aria-label="Four parts of the product" className="relative z-10 mx-auto flex shrink-0 justify-center gap-3">
          {TABS.map((item, index) => {
            const selected = index === active
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                id={`stage-tab-${item.key}`}
                aria-selected={selected}
                aria-label={item.label}
                onClick={() => goTo(index)}
                className={cn(
                  'relative grid size-14 place-items-center rounded-full ring-1 transition-colors duration-300',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  selected ? 'bg-primary text-on-primary ring-primary' : 'bg-surface/90 text-muted ring-black/[0.06] hover:text-foreground',
                )}
              >
                <Icon className="size-6" aria-hidden="true" strokeWidth={1.9} />
                {selected ? (
                  <svg aria-hidden="true" viewBox="0 0 56 56" className="absolute inset-[-5px] size-[calc(100%+10px)] -rotate-90">
                    <circle cx="28" cy="28" r="26" fill="none" stroke="var(--color-primary)" strokeOpacity="0.25" strokeWidth="2" />
                    <motion.circle cx="28" cy="28" r="26" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" style={{ pathLength: ringFill }} />
                  </svg>
                ) : null}
                {selected ? <span aria-hidden="true" className="absolute -bottom-2 size-3 rotate-45 rounded-[2px] bg-primary" /> : null}
              </button>
            )
          })}
        </div>

        {/* ---------- the deck ---------- */}
        <div className="relative z-10 mx-auto mt-10 min-h-0 w-full max-w-5xl flex-1">
          {TABS.map((item, index) => (
            <DealtCard key={item.key} tab={item} index={index} progress={scrollYProgress} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** The five soft colours behind everything, recoloured by the field's data-tab. */
function Field({ reduce }: { reduce: boolean }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {BLOBS.map((blob, i) => (
        <motion.span
          key={i}
          animate={reduce ? undefined : { x: [...blob.drift.x], y: [...blob.drift.y] }}
          transition={reduce ? undefined : { duration: blob.duration, repeat: Infinity, ease: 'easeInOut' }}
          className={cn('mesh-blob absolute rounded-full blur-[70px] will-change-transform sm:blur-[100px]', blob.className)}
          style={{ backgroundColor: `var(--mesh-${i + 1})` }}
        />
      ))}
    </div>
  )
}
