'use client'

import * as React from 'react'
import { motion, useTransform, type MotionValue } from 'motion/react'
import { CalendarCheck2, Check, Ticket } from 'lucide-react'

import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn } from '@/lib/utils'

/* ==========================================================================
   HeroBackdrop — the room the hero sits in.

   Three layers, all vector, all cheap:
     floor    a ruled plane laid down in perspective, its lines sliding
              toward the viewer, fading out at the horizon
     orbits   three thin rings tilted into the same perspective, each turning
              at its own pace with a small light travelling on it
     tokens   a few pieces of the product (a booked slot, a held deposit, a
              seat map, a ticket) floating at different depths

   The pointer tilt from the hero moves every layer by its depth, so the
   scene reads as space rather than wallpaper. Reduced motion holds it still.
   ========================================================================== */

export interface HeroBackdropProps {
  /** Pointer offset from the hero, −0.5…0.5 on each axis, already spring-smoothed. */
  tiltX: MotionValue<number>
  tiltY: MotionValue<number>
  className?: string
}

const ORBITS = [
  { size: 'size-[34rem]', duration: 46, delay: 0, dot: 'var(--accent)', top: 'top-[46%]' },
  { size: 'size-[48rem]', duration: 68, delay: -20, dot: 'var(--primary)', top: 'top-[48%]' },
  { size: 'size-[62rem]', duration: 92, delay: -41, dot: 'var(--chart-3)', top: 'top-[50%]' },
] as const

function Orbit({
  size,
  duration,
  delay,
  dot,
  top,
  moving,
}: (typeof ORBITS)[number] & { moving: boolean }) {
  return (
    <div className={cn('absolute left-[68%] -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d]', top)}>
      <motion.div
        className={cn('relative rounded-full border border-primary/[0.22]', size)}
        style={{ rotateX: 72 }}
        animate={moving ? { rotateZ: 360 } : undefined}
        initial={{ rotateZ: (delay * -4) % 360 }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      >
        {/* the light on the ring */}
        <span
          aria-hidden="true"
          className="absolute top-0 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_0_6px_color-mix(in_oklab,var(--primary)_10%,transparent)]"
          style={{ background: dot }}
        />
      </motion.div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Floating tokens — small, honest pieces of the product drawn as vectors.
   -------------------------------------------------------------------------- */

interface Token {
  key: string
  className: string
  depth: number
  drift: number
  duration: number
  delay: number
  node: React.ReactNode
}

function SeatMap() {
  const seats = [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 0]
  return (
    <div className="grid grid-cols-4 gap-1">
      {seats.map((taken, i) => (
        <span
          key={i}
          className={cn('size-2.5 rounded-[3px]', taken ? 'bg-primary' : 'border border-line-strong bg-surface')}
        />
      ))}
    </div>
  )
}

const TOKENS: Token[] = [
  {
    key: 'slot',
    className: 'left-[47%] top-[9%]',
    depth: 1.4,
    drift: 9,
    duration: 7.5,
    delay: 0,
    node: (
      <div className="flex items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-white">
          <CalendarCheck2 className="size-3.5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[0.6875rem] font-semibold text-foreground">Sat 06:40 · 2 seats</p>
          <p className="text-[0.625rem] text-subtle">Confirmed in 4 seconds</p>
        </div>
      </div>
    ),
  },
  {
    key: 'deposit',
    className: 'right-[3%] top-[54%]',
    depth: 0.8,
    drift: 7,
    duration: 8.6,
    delay: 1.2,
    node: (
      <div className="flex items-center gap-2.5">
        <div>
          <p className="text-[0.625rem] text-subtle">Deposit held</p>
          <p className="font-display text-[0.9375rem] font-semibold text-foreground tabular-nums">$60.00</p>
        </div>
        <span className="grid size-6 place-items-center rounded-full bg-success text-white">
          <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        </span>
      </div>
    ),
  },
  {
    key: 'seats',
    className: 'left-[53%] bottom-[4%]',
    depth: 1.1,
    drift: 6,
    duration: 9.4,
    delay: 0.6,
    node: (
      <div className="flex items-center gap-3">
        <SeatMap />
        <div>
          <p className="text-[0.6875rem] font-semibold text-foreground">Table 12</p>
          <p className="text-[0.625rem] text-subtle">9 of 12 seated</p>
        </div>
      </div>
    ),
  },
  {
    key: 'ticket',
    className: 'right-[9%] top-[6%]',
    depth: 0.6,
    drift: 8,
    duration: 8,
    delay: 2,
    node: (
      <div className="flex items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-lg bg-accent text-on-accent">
          <Ticket className="size-3.5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-[0.6875rem] font-semibold text-foreground">Gala · row C</p>
          <p className="text-[0.625rem] text-subtle">Scanned at the east door</p>
        </div>
      </div>
    ),
  },
]

function FloatingToken({ token, tiltX, tiltY, moving }: { token: Token; tiltX: MotionValue<number>; tiltY: MotionValue<number>; moving: boolean }) {
  const x = useTransform(tiltX, (v) => v * -34 * token.depth)
  const y = useTransform(tiltY, (v) => v * -24 * token.depth)
  const rotateY = useTransform(tiltX, (v) => v * 10)
  const rotateX = useTransform(tiltY, (v) => v * -8)

  return (
    <motion.div style={{ x, y, rotateX, rotateY, transformPerspective: 900 }} className={cn('absolute hidden lg:block', token.className)}>
      <motion.div
        animate={moving ? { y: [0, -token.drift, 0] } : undefined}
        transition={{ duration: token.duration, repeat: Infinity, ease: 'easeInOut', delay: token.delay }}
        className="rounded-xl border border-line bg-surface/95 px-3 py-2 shadow-lg shadow-black/[0.06] backdrop-blur-sm"
      >
        {token.node}
      </motion.div>
    </motion.div>
  )
}

/* --------------------------------------------------------------------------
   The backdrop
   -------------------------------------------------------------------------- */

export function HeroBackdrop({ tiltX, tiltY, className }: HeroBackdropProps) {
  const reduce = useReducedMotionSafe()
  const moving = !reduce

  const floorX = useTransform(tiltX, (v) => v * -18)
  const orbitX = useTransform(tiltX, (v) => v * -10)
  const orbitY = useTransform(tiltY, (v) => v * -6)

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      {/* ---------- floor ---------- */}
      <div className="absolute inset-x-0 bottom-0 h-[62%] [perspective:1100px] [perspective-origin:50%_0%]">
        <motion.div
          style={{ x: floorX, rotateX: 66, transformOrigin: '50% 0%' }}
          className="absolute -inset-x-[40%] top-0 h-[180%] [mask-image:linear-gradient(to_bottom,transparent_0%,black_28%,black_70%,transparent_100%)]"
        >
          <motion.div
            className="size-full bg-grid opacity-[0.55]"
            animate={moving ? { backgroundPositionY: ['0px', '48px'] } : undefined}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'linear' }}
          />
        </motion.div>
      </div>

      {/* ---------- orbits ---------- */}
      <motion.div style={{ x: orbitX, y: orbitY }} className="absolute inset-0 hidden [perspective:1400px] lg:block">
        {ORBITS.map((orbit) => (
          <Orbit key={orbit.size} {...orbit} moving={moving} />
        ))}
      </motion.div>

      {/* ---------- tokens ---------- */}
      {TOKENS.map((token) => (
        <FloatingToken key={token.key} token={token} tiltX={tiltX} tiltY={tiltY} moving={moving} />
      ))}
    </div>
  )
}
