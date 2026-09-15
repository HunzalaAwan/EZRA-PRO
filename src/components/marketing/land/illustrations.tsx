'use client'

import * as React from 'react'
import { motion, useInView } from 'motion/react'

import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Vector illustrations for the landing page.

   Flat, two-tone, drawn on a 320×200 stage and scaled by the parent. Every
   colour is a design token so the pictures follow light and dark mode, and
   every animation starts when the drawing scrolls into view and settles into
   a static final state under reduced motion.
   ========================================================================== */

const INK = 'var(--illo-ink)'
const TEAL = 'var(--primary)'
const BLUE = 'var(--info)'
const CORAL = 'var(--accent)'
const PAPER = 'var(--surface)'
const LINE = 'var(--line)'
const SOFT = 'var(--well)'

interface IlloProps {
  className?: string
  /** Bumped by the tile so a hover can replay the drawing. */
  replayKey?: number
}

function useDraw(replayKey = 0) {
  const ref = React.useRef<SVGSVGElement>(null)
  const inView = useInView(ref, { once: true, margin: '-12%' })
  const reduce = useReducedMotionSafe()
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    if (replayKey > 0) setTick((t) => t + 1)
  }, [replayKey])
  return { ref, play: inView, reduce, tick }
}

const stage = { viewBox: '0 0 320 200', xmlns: 'http://www.w3.org/2000/svg', role: 'img' } as const

/** Scale/rotate around the element's own centre, in user units. */
const CENTRE = { transformOrigin: '50% 50%', transformBox: 'fill-box' } as const
const BOTTOM = { transformOrigin: '50% 100%', transformBox: 'fill-box' } as const

/* --------------------------------------------------------------------------
   1. One calendar, every channel
   -------------------------------------------------------------------------- */

const SOURCES = [
  { label: 'Website', color: TEAL, y: 52 },
  { label: 'Viator', color: BLUE, y: 96 },
  { label: 'Walk-in', color: CORAL, y: 140 },
]

/** Which grid cells each source fills, in the order they arrive. */
const FILLS: { src: number; col: number; row: number }[] = [
  { src: 0, col: 1, row: 0 },
  { src: 1, col: 3, row: 1 },
  { src: 0, col: 5, row: 0 },
  { src: 2, col: 2, row: 2 },
  { src: 1, col: 0, row: 1 },
  { src: 0, col: 4, row: 3 },
  { src: 2, col: 6, row: 2 },
  { src: 1, col: 2, row: 0 },
  { src: 0, col: 3, row: 3 },
]

const GRID = { x: 128, y: 30, cell: 24, gap: 4, cols: 7, rows: 5 }

export function CalendarIllo({ className, replayKey }: IlloProps) {
  const { ref, play, reduce, tick } = useDraw(replayKey)
  const cellX = (c: number) => GRID.x + c * (GRID.cell + GRID.gap)
  const cellY = (r: number) => GRID.y + r * (GRID.cell + GRID.gap)

  return (
    <svg
      ref={ref}
      {...stage}
      aria-label="Bookings from a website, a marketplace and walk-ins landing on one calendar"
      className={cn('h-full w-full', className)}
    >
      {SOURCES.map((s) => (
        <g key={s.label}>
          <rect x={16} y={s.y - 13} width={82} height={26} rx={13} fill={PAPER} stroke={LINE} />
          <circle cx={31} cy={s.y} r={5} fill={s.color} />
          <text x={42} y={s.y + 4} fontSize={11} fontWeight={600} fill={INK} fontFamily="inherit">
            {s.label}
          </text>
        </g>
      ))}

      <rect
        x={GRID.x - 10}
        y={GRID.y - 12}
        width={GRID.cols * (GRID.cell + GRID.gap) + 16}
        height={GRID.rows * (GRID.cell + GRID.gap) + 20}
        rx={12}
        fill={PAPER}
        stroke={LINE}
      />
      {Array.from({ length: GRID.cols * GRID.rows }, (_, i) => {
        const col = i % GRID.cols
        const row = Math.floor(i / GRID.cols)
        return (
          <rect key={i} x={cellX(col)} y={cellY(row)} width={GRID.cell} height={GRID.cell} rx={5} fill={SOFT} />
        )
      })}

      {FILLS.map((f, i) => {
        const s = SOURCES[f.src]
        const tx = cellX(f.col) + GRID.cell / 2
        const ty = cellY(f.row) + GRID.cell / 2
        const delay = 0.25 + i * 0.32
        return (
          <g key={`${tick}-${i}`}>
            {!reduce ? (
              <motion.circle
                r={5}
                fill={s.color}
                initial={{ cx: 31, cy: s.y, opacity: 1 }}
                animate={play ? { cx: [31, 108, tx, tx], cy: [s.y, s.y, ty, ty], opacity: [1, 1, 1, 0] } : undefined}
                transition={{ duration: 1, delay, ease: EASE_OUT_EXPO, times: [0, 0.45, 0.88, 1] }}
              />
            ) : null}
            <motion.rect
              x={cellX(f.col)}
              y={cellY(f.row)}
              width={GRID.cell}
              height={GRID.cell}
              rx={5}
              fill={s.color}
              initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.6 }}
              animate={play ? { opacity: 1, scale: 1 } : undefined}
              transition={{ duration: 0.4, delay: delay + 0.85, ease: EASE_OUT_EXPO }}
              style={CENTRE}
            />
          </g>
        )
      })}
    </svg>
  )
}

/* --------------------------------------------------------------------------
   2. Tables, seats, tickets, rooms
   -------------------------------------------------------------------------- */

const TABLES = [
  { cx: 60, cy: 64, r: 18, seats: 6, booked: true },
  { cx: 126, cy: 58, r: 14, seats: 4, booked: false },
  { cx: 66, cy: 138, r: 14, seats: 4, booked: true },
  { cx: 132, cy: 132, r: 18, seats: 6, booked: true },
]

function RoundTable({
  cx,
  cy,
  r,
  seats,
  booked,
  delay,
  play,
  reduce,
}: (typeof TABLES)[number] & { delay: number; play: boolean; reduce: boolean }) {
  return (
    <g>
      {Array.from({ length: seats }, (_, i) => {
        const a = (i / seats) * Math.PI * 2 - Math.PI / 2
        return (
          <circle
            key={i}
            cx={cx + Math.cos(a) * (r + 9)}
            cy={cy + Math.sin(a) * (r + 9)}
            r={4}
            fill={booked ? INK : LINE}
          />
        )
      })}
      <circle cx={cx} cy={cy} r={r} fill={PAPER} stroke={LINE} strokeWidth={1.5} />
      {booked ? (
        <motion.circle
          cx={cx}
          cy={cy}
          r={r - 4}
          fill={TEAL}
          initial={{ opacity: reduce ? 1 : 0, scale: reduce ? 1 : 0.4 }}
          animate={play ? { opacity: 1, scale: 1 } : undefined}
          transition={{ duration: 0.5, delay, ease: EASE_OUT_EXPO }}
          style={CENTRE}
        />
      ) : null}
    </g>
  )
}

const BOOKED_SEATS = new Set([0, 1, 3, 4, 6, 9, 10, 12])

export function SeatMapIllo({ className, replayKey }: IlloProps) {
  const { ref, play, reduce, tick } = useDraw(replayKey)

  return (
    <svg
      ref={ref}
      {...stage}
      aria-label="A restaurant floor plan, a boat seat map and an event ticket drawn as one inventory"
      className={cn('h-full w-full', className)}
    >
      <rect x={20} y={24} width={150} height={152} rx={12} fill={SOFT} />
      {TABLES.map((t, i) => (
        <RoundTable key={`${tick}-${i}`} {...t} delay={0.2 + i * 0.22} play={play} reduce={reduce} />
      ))}

      <path
        d="M212 24 C 250 24 276 40 276 70 L 276 150 Q 276 176 250 176 L 216 176 Q 190 176 190 150 L 190 70 C 190 40 200 24 212 24 Z"
        fill={SOFT}
      />
      {Array.from({ length: 15 }, (_, i) => {
        const r = Math.floor(i / 3)
        const c = i % 3
        const booked = BOOKED_SEATS.has(i)
        return (
          <motion.rect
            key={`${tick}-${i}`}
            x={206 + c * 20}
            y={46 + r * 24}
            width={14}
            height={16}
            rx={4}
            fill={booked ? BLUE : PAPER}
            stroke={booked ? BLUE : LINE}
            initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 6 }}
            animate={play ? { opacity: 1, y: 0 } : undefined}
            transition={{ duration: 0.4, delay: 0.6 + i * 0.045, ease: EASE_OUT_EXPO }}
          />
        )
      })}

      <motion.g
        key={`ticket-${tick}`}
        initial={{ opacity: reduce ? 1 : 0, x: reduce ? 0 : 24, rotate: -8 }}
        animate={play ? { opacity: 1, x: 0, rotate: -8 } : undefined}
        transition={{ duration: 0.6, delay: 1.2, ease: EASE_OUT_EXPO }}
        style={CENTRE}
      >
        <rect x={196} y={140} width={112} height={40} rx={8} fill={CORAL} />
        <line x1={272} y1={142} x2={272} y2={178} stroke={PAPER} strokeDasharray="3 4" strokeWidth={1.5} />
        <circle cx={272} cy={140} r={5} fill={SOFT} />
        <circle cx={272} cy={180} r={5} fill={SOFT} />
        <rect x={206} y={150} width={40} height={6} rx={3} fill={PAPER} opacity={0.9} />
        <rect x={206} y={162} width={56} height={6} rx={3} fill={PAPER} opacity={0.6} />
        <rect x={282} y={150} width={16} height={20} rx={3} fill={PAPER} opacity={0.9} />
      </motion.g>
    </svg>
  )
}

/* --------------------------------------------------------------------------
   3. Deposits, reminders, no-shows
   -------------------------------------------------------------------------- */

const STEPS = ['Booked', 'Deposit held', 'Reminded', 'Arrived']
const STEP_X = [44, 120, 196, 272]

export function DepositIllo({ className, replayKey }: IlloProps) {
  const { ref, play, reduce, tick } = useDraw(replayKey)

  return (
    <svg
      ref={ref}
      {...stage}
      aria-label="A booking timeline from deposit to arrival, with the deposit card in front"
      className={cn('h-full w-full', className)}
    >
      <motion.g
        key={`card-${tick}`}
        initial={{ y: reduce ? 0 : 10, opacity: reduce ? 1 : 0 }}
        animate={play ? { y: 0, opacity: 1 } : undefined}
        transition={{ duration: 0.6, ease: EASE_OUT_EXPO }}
      >
        <rect x={96} y={26} width={128} height={78} rx={12} fill={INK} />
        <rect x={110} y={44} width={28} height={20} rx={4} fill={BLUE} />
        <rect x={110} y={78} width={54} height={6} rx={3} fill={PAPER} opacity={0.7} />
        <rect x={170} y={78} width={38} height={6} rx={3} fill={PAPER} opacity={0.4} />
        <text x={210} y={52} textAnchor="end" fontSize={12} fontWeight={700} fill={PAPER} fontFamily="inherit">
          $60 held
        </text>
      </motion.g>

      <line x1={STEP_X[0]} y1={150} x2={STEP_X[3]} y2={150} stroke={LINE} strokeWidth={3} strokeLinecap="round" />
      <motion.line
        key={`rail-${tick}`}
        x1={STEP_X[0]}
        y1={150}
        x2={STEP_X[3]}
        y2={150}
        stroke={TEAL}
        strokeWidth={3}
        strokeLinecap="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={play ? { pathLength: 1 } : undefined}
        transition={{ duration: 1.6, delay: 0.3, ease: 'linear' }}
      />
      {STEPS.map((label, i) => (
        <g key={`${tick}-${label}`}>
          <motion.circle
            cx={STEP_X[i]}
            cy={150}
            r={7}
            fill={i === 3 ? CORAL : TEAL}
            stroke={PAPER}
            strokeWidth={3}
            initial={{ scale: reduce ? 1 : 0 }}
            animate={play ? { scale: 1 } : undefined}
            transition={{ duration: 0.4, delay: 0.3 + i * 0.5, ease: EASE_OUT_EXPO }}
            style={CENTRE}
          />
          <text x={STEP_X[i]} y={178} textAnchor="middle" fontSize={10.5} fontWeight={600} fill={INK} fontFamily="inherit">
            {label}
          </text>
        </g>
      ))}
    </svg>
  )
}

/* --------------------------------------------------------------------------
   4. A host app that works with no signal
   -------------------------------------------------------------------------- */

const GUESTS = ['Amara O. · 2', 'Jonas P. · 4', 'Mei L. · 1', 'Reyes table · 6']

export function HostAppIllo({ className, replayKey }: IlloProps) {
  const { ref, play, reduce, tick } = useDraw(replayKey)

  return (
    <svg
      ref={ref}
      {...stage}
      aria-label="A phone with a guest list being checked in while the signal indicator shows offline"
      className={cn('h-full w-full', className)}
    >
      <rect x={104} y={10} width={112} height={190} rx={18} fill={INK} />
      <rect x={110} y={16} width={100} height={178} rx={14} fill={PAPER} />
      <rect x={140} y={22} width={40} height={5} rx={2.5} fill={LINE} />

      <rect x={120} y={36} width={80} height={16} rx={8} fill={SOFT} />
      <circle cx={131} cy={44} r={3.5} fill={CORAL} />
      <text x={138} y={48} fontSize={8.5} fontWeight={600} fill={INK} fontFamily="inherit">
        No signal · saved
      </text>

      {GUESTS.map((g, i) => {
        const y = 66 + i * 28
        return (
          <g key={`${tick}-${g}`}>
            <rect x={120} y={y} width={80} height={20} rx={6} fill={SOFT} />
            <text x={142} y={y + 13} fontSize={8.5} fontWeight={500} fill={INK} fontFamily="inherit">
              {g}
            </text>
            <motion.circle
              cx={131}
              cy={y + 10}
              r={5.5}
              fill={TEAL}
              initial={{ scale: reduce ? 1 : 0 }}
              animate={play ? { scale: 1 } : undefined}
              transition={{ duration: 0.35, delay: 0.4 + i * 0.4, ease: EASE_OUT_EXPO }}
              style={CENTRE}
            />
            <motion.path
              d={`M128 ${y + 10} l2.4 2.4 l4.6 -4.8`}
              fill="none"
              stroke={PAPER}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: reduce ? 1 : 0 }}
              animate={play ? { pathLength: 1 } : undefined}
              transition={{ duration: 0.3, delay: 0.6 + i * 0.4 }}
            />
          </g>
        )
      })}

      <g transform="translate(232 40)">
        {[0, 1, 2, 3].map((b) => (
          <rect key={b} x={b * 8} y={18 - b * 6} width={5} height={6 + b * 6} rx={1.5} fill={b < 1 ? INK : LINE} />
        ))}
        <line x1={-4} y1={26} x2={36} y2={-2} stroke={CORAL} strokeWidth={2.5} strokeLinecap="round" />
      </g>
      <text x={232} y={90} fontSize={9} fontWeight={600} fill={INK} fontFamily="inherit">
        Syncs when
      </text>
      <text x={232} y={102} fontSize={9} fontWeight={600} fill={INK} fontFamily="inherit">
        the signal is back
      </text>
    </svg>
  )
}

/* --------------------------------------------------------------------------
   5. Paid out the next business day
   -------------------------------------------------------------------------- */

const BARS = [38, 52, 46, 70, 64, 88]

export function PayoutIllo({ className, replayKey }: IlloProps) {
  const { ref, play, reduce, tick } = useDraw(replayKey)

  return (
    <svg
      ref={ref}
      {...stage}
      aria-label="Daily takings as bars, with a payout tag showing the money arriving the next business day"
      className={cn('h-full w-full', className)}
    >
      {BARS.map((h, i) => {
        const isToday = i === BARS.length - 1
        return (
          <motion.rect
            key={`${tick}-${i}`}
            x={30 + i * 30}
            y={168 - h}
            width={18}
            height={h}
            rx={4}
            fill={isToday ? TEAL : SOFT}
            stroke={isToday ? TEAL : LINE}
            initial={{ scaleY: reduce ? 1 : 0 }}
            animate={play ? { scaleY: 1 } : undefined}
            transition={{ duration: 0.7, delay: 0.15 + i * 0.1, ease: EASE_OUT_EXPO }}
            style={BOTTOM}
          />
        )
      })}
      <line x1={24} y1={168} x2={214} y2={168} stroke={LINE} strokeWidth={1.5} />

      <motion.g
        key={`tag-${tick}`}
        initial={{ opacity: reduce ? 1 : 0, y: reduce ? 0 : 12 }}
        animate={play ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.6, delay: 0.95, ease: EASE_OUT_EXPO }}
      >
        <rect x={196} y={38} width={108} height={64} rx={12} fill={INK} />
        <text x={210} y={58} fontSize={9} fontWeight={600} fill={PAPER} opacity={0.7} fontFamily="inherit">
          Arrives Tuesday
        </text>
        <text x={210} y={82} fontSize={18} fontWeight={700} fill={PAPER} fontFamily="inherit">
          $4,860
        </text>
        <circle cx={292} cy={52} r={6} fill={TEAL} />
        <path d="M289.2 52 l2 2 l3.8 -4" fill="none" stroke={PAPER} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M232 102 L 246 102 L 239 114 Z" fill={INK} />
      </motion.g>
    </svg>
  )
}
