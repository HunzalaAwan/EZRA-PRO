'use client'

import * as React from 'react'
import { motion } from 'motion/react'

import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn } from '@/lib/utils'

/* ==========================================================================
   CardAurora — a gradient ground with slow weather behind a card.

   Sits absolutely inside a `relative isolate overflow-hidden` card. Two or
   three blurred colour fields drift on long loops, and the dark tone adds a
   turning conic ring plus an occasional light sweep. Everything is a token,
   so the same component reads correctly in light and dark mode, and under
   reduced motion the fields simply hold still.
   ========================================================================== */

export interface CardAuroraProps {
  /** `light` for surface cards, `dark` for the navy payout card. */
  tone?: 'light' | 'dark'
  /** How many colour fields to drift. */
  fields?: 1 | 2 | 3
  /** Swap the field colours, in order, for a card with its own palette. */
  colors?: string[]
  /** Replace the base gradient behind the fields. */
  ground?: string
  /** The turning conic ring, the dark payout card's signature. */
  ring?: boolean
  /** Turn the movement off while keeping the gradient. */
  animated?: boolean
  className?: string
}

interface Field {
  color: string
  size: number
  left: string
  top: string
  opacity: number
  drift: [number, number]
  duration: number
}

const LIGHT_FIELDS: Field[] = [
  { color: 'var(--primary)', size: 260, left: '62%', top: '-45%', opacity: 0.16, drift: [26, 20], duration: 22 },
  { color: 'var(--chart-3)', size: 200, left: '-18%', top: '55%', opacity: 0.1, drift: [-20, -18], duration: 27 },
  { color: 'var(--info)', size: 180, left: '35%', top: '70%', opacity: 0.1, drift: [18, -14], duration: 24 },
]

const DARK_FIELDS: Field[] = [
  { color: 'var(--info)', size: 340, left: '50%', top: '-55%', opacity: 0.6, drift: [-30, 26], duration: 21 },
  { color: 'var(--accent)', size: 280, left: '-30%', top: '45%', opacity: 0.34, drift: [28, -22], duration: 27 },
  { color: 'var(--primary)', size: 220, left: '58%', top: '65%', opacity: 0.45, drift: [-22, -18], duration: 24 },
]

const GROUND = {
  light: 'linear-gradient(150deg, var(--surface) 0%, var(--surface) 42%, var(--primary-soft) 100%)',
  dark: 'linear-gradient(140deg, var(--navy-deep) 0%, color-mix(in oklab, var(--navy-deep) 68%, var(--info)) 52%, color-mix(in oklab, var(--navy-deep) 52%, var(--primary)) 100%)',
} as const

/** Film grain over the dark ground so the gradient never bands. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

export function CardAurora({
  tone = 'light',
  fields = 2,
  colors,
  ground,
  ring = true,
  animated = true,
  className,
}: CardAuroraProps) {
  const reduce = useReducedMotionSafe()
  const moving = animated && !reduce
  const list = (tone === 'dark' ? DARK_FIELDS : LIGHT_FIELDS)
    .slice(0, fields)
    .map((field, i) => (colors?.[i] ? { ...field, color: colors[i] } : field))

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]', className)}
      style={{ background: ground ?? GROUND[tone] }}
    >
      {list.map((field, i) => (
        <motion.span
          key={i}
          className="absolute block rounded-full will-change-transform"
          style={{
            width: field.size,
            height: field.size,
            left: field.left,
            top: field.top,
            background: field.color,
            opacity: field.opacity,
            filter: `blur(${tone === 'dark' ? 56 : 44}px)`,
          }}
          animate={
            moving
              ? {
                  x: [0, field.drift[0], -field.drift[0] * 0.6, 0],
                  y: [0, field.drift[1], -field.drift[1] * 0.7, 0],
                  scale: [1, 1.12, 0.94, 1],
                }
              : undefined
          }
          transition={{ duration: field.duration, repeat: Infinity, ease: 'easeInOut', delay: i * 1.7 }}
        />
      ))}

      {tone === 'dark' ? (
        <>
          {/* Turning ring, the card's signature. */}
          {ring ? (
          <motion.span
            className="absolute -top-28 -right-24 block size-72 rounded-full will-change-transform"
            style={{
              background:
                'conic-gradient(from 0deg, transparent 0deg, color-mix(in oklab, var(--info) 75%, transparent) 110deg, transparent 220deg, color-mix(in oklab, var(--accent) 70%, transparent) 300deg, transparent 360deg)',
              WebkitMask: 'radial-gradient(circle, transparent 58%, #000 59.5%)',
              mask: 'radial-gradient(circle, transparent 58%, #000 59.5%)',
            }}
            animate={moving ? { rotate: 360 } : undefined}
            transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
          />
          ) : null}

          {/* A light sweep across the card now and then. */}
          {moving ? (
            <motion.span
              className="absolute inset-y-[-20%] left-0 block w-[38%] will-change-transform"
              style={{
                background:
                  'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.07) 45%, rgba(255,255,255,0.11) 50%, rgba(255,255,255,0.07) 55%, transparent 100%)',
              }}
              initial={{ x: '-140%' }}
              animate={{ x: '400%' }}
              transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 7.5, ease: [0.4, 0, 0.2, 1], delay: 2 }}
            />
          ) : null}

          <span className="absolute inset-0 block opacity-[0.07] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />
        </>
      ) : null}
    </div>
  )
}
