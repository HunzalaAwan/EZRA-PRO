'use client'

import * as React from 'react'
import Link from 'next/link'
import { AnimatePresence, animate, motion, useInView, useMotionValue, type AnimationPlaybackControls } from 'motion/react'
import { ArrowRight, CalendarDays, Smartphone, ShoppingCart, Wallet, type LucideIcon } from 'lucide-react'

import { BookingWidgetPreview } from '@/components/marketing/booking-widget-preview'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { HostAppMock } from './host-app-mock'
import { MiniCalendar } from './mini-calendar'
import { PayoutMock } from './payout-mock'

/* ==========================================================================
   HeroStage — four pieces of the product, as a deck of cards on a field of
   colour.

   A full-bleed rounded field whose soft colours shift with the active tab.
   Above the cards, four round icon tabs; the active one is filled and wears
   a ring that fills over seven seconds before the next card takes over.
   The cards themselves are a deck: the active one sits in front, the next
   two peek out above it, and on a change the front card falls to the back
   of the pile while the next rises to the front. Each card is copy on the
   left and a working product graphic on the right. The pointer resting on
   the stage holds the timer; a click on a tab pins it. Below `md` the deck
   becomes one card at a time. Reduced motion never auto-advances.
   ========================================================================== */

const HOLD_MS = 7000

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
    href: '/features/calendar',
    panel: 'bg-cal-cloud',
    node: <MiniCalendar />,
  },
  {
    key: 'checkout',
    label: 'Checkout',
    icon: ShoppingCart,
    title: 'A checkout guests actually finish',
    body: 'Three taps on a phone, with Apple Pay and Google Pay on by default and no account to make. Most booking flows lose a third of guests before they pay. This one does not.',
    href: '/features/checkout',
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
    href: '/features/host-app',
    panel: 'bg-cal-haze',
    node: <HostAppMock className="origin-top scale-[0.8]" />,
  },
  {
    key: 'payouts',
    label: 'Payouts',
    icon: Wallet,
    title: 'Paid the next business day',
    body: 'Card money lands the next business day, itemised by departure, sitting or event, with tips split to the crew and one flat 4% fee.',
    href: '/features/payments',
    panel: 'bg-cal-sunbeam',
    node: <PayoutMock className="origin-top scale-[0.86]" />,
  },
]

/** Where a card sits by its distance from the front of the deck. */
const SLOT = [
  { y: 0, scale: 1, opacity: 1, z: 40 },
  { y: -18, scale: 0.96, opacity: 1, z: 30 },
  { y: -34, scale: 0.92, opacity: 0.8, z: 20 },
  { y: -46, scale: 0.88, opacity: 0, z: 10 },
] as const

/** Five blobs, each with its own drift. */
const BLOBS = [
  { className: 'left-[-10%] top-[-20%] h-[60%] w-[45%]', drift: { x: [0, 40, 0], y: [0, 30, 0] }, duration: 19 },
  { className: 'right-[-12%] top-[-15%] h-[65%] w-[48%]', drift: { x: [0, -36, 0], y: [0, 24, 0] }, duration: 23 },
  { className: 'left-[20%] bottom-[-30%] h-[70%] w-[50%]', drift: { x: [0, 28, 0], y: [0, -30, 0] }, duration: 21 },
  { className: 'right-[10%] bottom-[-25%] h-[60%] w-[40%]', drift: { x: [0, -24, 0], y: [0, -20, 0] }, duration: 25 },
  { className: 'left-[35%] top-[10%] h-[50%] w-[36%]', drift: { x: [0, -20, 0], y: [0, 26, 0] }, duration: 27 },
] as const

function StageCard({ tab }: { tab: Tab }) {
  const Icon = tab.icon
  return (
    <article className="grid h-full overflow-hidden rounded-[2rem] bg-surface shadow-[var(--shadow-2xl)] ring-1 ring-black/[0.05] md:grid-cols-2">
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
      <div className={cn('relative flex h-[24rem] items-start justify-center overflow-hidden px-6 pt-8 md:m-4 md:h-auto md:min-h-[26rem] md:rounded-[1.5rem] md:pt-10', tab.panel)}>
        {tab.node}
      </div>
    </article>
  )
}

export function HeroStage({ className }: { className?: string }) {
  const reduce = useReducedMotionSafe()
  const ref = React.useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { amount: 0.3 })

  const [active, setActive] = React.useState(0)
  const [pinned, setPinned] = React.useState(false)
  const [paused, setPaused] = React.useState(false)

  const auto = inView && !pinned && !reduce
  const fill = useMotionValue(0)
  const timer = React.useRef<AnimationPlaybackControls | null>(null)

  React.useEffect(() => {
    timer.current?.stop()
    timer.current = null
    if (!auto) {
      fill.set(pinned || reduce ? 1 : 0)
      return
    }
    fill.set(0)
    timer.current = animate(fill, 1, {
      duration: HOLD_MS / 1000,
      ease: 'linear',
      onComplete: () => setActive((i) => (i + 1) % TABS.length),
    })
    return () => {
      timer.current?.stop()
      timer.current = null
    }
  }, [auto, active, pinned, reduce, fill])

  React.useEffect(() => {
    if (!timer.current) return
    if (paused) timer.current.pause()
    else timer.current.play()
  }, [paused])

  const tab = TABS[active]
  const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 190, damping: 26, mass: 0.9 }

  return (
    <div
      ref={ref}
      data-tab={tab.key}
      className={cn('mesh relative isolate overflow-hidden rounded-[2.5rem] px-4 py-10 sm:px-8 sm:py-14 lg:py-16', className)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* ---------- the field of colour ---------- */}
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

      {/* ---------- tabs ---------- */}
      <div role="tablist" aria-label="Four parts of the product" className="relative z-10 mx-auto flex justify-center gap-2 sm:gap-3">
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
              aria-controls={`stage-panel-${item.key}`}
              onClick={() => {
                setActive(index)
                setPinned(true)
              }}
              className={cn(
                'relative grid size-12 place-items-center rounded-full ring-1 transition-colors duration-300 sm:size-14',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                selected ? 'bg-primary text-on-primary ring-primary' : 'bg-surface/90 text-muted ring-black/[0.06] hover:text-foreground',
              )}
            >
              <Icon className="size-5 sm:size-6" aria-hidden="true" strokeWidth={1.9} />
              {selected ? (
                <svg aria-hidden="true" viewBox="0 0 56 56" className="absolute inset-[-5px] size-[calc(100%+10px)] -rotate-90">
                  <circle cx="28" cy="28" r="26" fill="none" stroke="var(--color-primary)" strokeOpacity="0.25" strokeWidth="2" />
                  <motion.circle cx="28" cy="28" r="26" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" style={{ pathLength: fill }} />
                </svg>
              ) : null}
              {selected ? <span aria-hidden="true" className="absolute -bottom-2 size-3 rotate-45 rounded-[2px] bg-primary" /> : null}
            </button>
          )
        })}
      </div>

      {/* ---------- the deck, md and up ---------- */}
      <div className="relative z-10 mx-auto mt-14 hidden h-[34rem] max-w-5xl md:block [perspective:1400px]">
        {TABS.map((item, index) => {
          const order = (index - active + TABS.length) % TABS.length
          const slot = SLOT[order]
          return (
            <motion.div
              key={item.key}
              role="tabpanel"
              id={`stage-panel-${item.key}`}
              aria-labelledby={`stage-tab-${item.key}`}
              aria-hidden={order !== 0}
              initial={false}
              animate={{ y: slot.y, scale: slot.scale, opacity: slot.opacity, zIndex: slot.z }}
              transition={spring}
              style={{ transformOrigin: '50% 0%' }}
              className="absolute inset-x-0 top-0 h-full will-change-transform"
            >
              <StageCard tab={item} />
            </motion.div>
          )
        })}
      </div>

      {/* ---------- one card at a time, below md ---------- */}
      <div className="relative z-10 mt-10 md:hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab.key}
            initial={reduce ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -10 }}
            transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
          >
            <StageCard tab={tab} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
