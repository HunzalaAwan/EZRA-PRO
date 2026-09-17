'use client'

import * as React from 'react'
import { AnimatePresence, animate, motion, useInView, useMotionValue, type AnimationPlaybackControls } from 'motion/react'
import { CalendarDays, Smartphone, ShoppingCart, Wallet, type LucideIcon } from 'lucide-react'

import { AppFrame } from '@/components/marketing/app-frame'
import { BookingWidgetPreview } from '@/components/marketing/booking-widget-preview'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { HeroConsole } from './hero-console'
import { HostAppMock } from './host-app-mock'
import { PayoutMock } from './payout-mock'

/* ==========================================================================
   HeroStage — four pieces of the product, one at a time, under the headline.

   A row of tabs and one large rounded panel. Each tab has its own pastel
   ground and its own working mock-up: the week calendar in a browser frame,
   the checkout guests see, the host app on a phone, and tomorrow's payout.
   The active tab carries a thin rule that fills over seven seconds, then
   the next tab takes over; the pointer resting on the stage holds it, and a
   click pins it. Reduced motion never auto-advances.
   ========================================================================== */

const HOLD_MS = 7000

interface Tab {
  key: string
  label: string
  icon: LucideIcon
  line: string
  ground: string
  node: React.ReactNode
}

const TABS: Tab[] = [
  {
    key: 'calendar',
    label: 'Calendar',
    icon: CalendarDays,
    line: 'Every departure, sitting, class and event on one week.',
    ground: 'bg-cal-cloud',
    node: (
      <AppFrame url="app.ezra.pro/blue-horizon/calendar" className="w-full max-w-4xl">
        <HeroConsole />
      </AppFrame>
    ),
  },
  {
    key: 'checkout',
    label: 'Checkout',
    icon: ShoppingCart,
    line: 'Three taps on a phone, Apple Pay and Google Pay on by default.',
    ground: 'bg-cal-honeydew',
    node: <BookingWidgetPreview className="max-w-[23rem]" />,
  },
  {
    key: 'host',
    label: 'Host app',
    icon: Smartphone,
    line: 'Check guests in and take walk-ups with no signal at all.',
    ground: 'bg-cal-haze',
    node: <HostAppMock />,
  },
  {
    key: 'payouts',
    label: 'Payouts',
    icon: Wallet,
    line: 'Money in the bank the next business day, itemised.',
    ground: 'bg-cal-sunbeam',
    node: <PayoutMock />,
  },
]

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

  return (
    <div
      ref={ref}
      className={cn('w-full', className)}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* ---------- tabs ---------- */}
      <div role="tablist" aria-label="Four parts of the product" className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2">
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
              aria-controls={`stage-panel-${item.key}`}
              onClick={() => {
                setActive(index)
                setPinned(true)
              }}
              className={cn(
                'relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-[10px] px-4 text-[0.875rem] font-medium',
                'transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                selected ? 'bg-surface text-foreground shadow-[var(--shadow-sm)]' : 'text-muted hover:bg-surface/60 hover:text-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {item.label}
              {selected ? (
                <motion.span aria-hidden="true" style={{ scaleX: fill }} className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary" />
              ) : null}
            </button>
          )
        })}
      </div>

      {/* ---------- the panel ---------- */}
      <div className="relative mt-6 sm:mt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab.key}
            role="tabpanel"
            id={`stage-panel-${tab.key}`}
            aria-labelledby={`stage-tab-${tab.key}`}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: EASE_OUT_EXPO }}
            className={cn('flex min-h-[34rem] flex-col items-center justify-center rounded-[2rem] px-4 py-10 sm:min-h-[36rem] sm:px-10 lg:min-h-[38rem]', tab.ground)}
          >
            <p className="mb-8 max-w-md text-center text-[0.9375rem] leading-snug text-foreground/80">{tab.line}</p>
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.08, ease: EASE_OUT_EXPO }}
              className="flex w-full justify-center"
            >
              {tab.node}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
