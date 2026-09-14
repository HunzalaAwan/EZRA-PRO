'use client'

import { useMemo, type CSSProperties } from 'react'
import { motion } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { cn, createRng, hashSeed, rngInt, rngPick } from '@/lib/utils'

/**
 * Atmospheric decoration.
 *
 * Everything in this file is inert: `aria-hidden`, `pointer-events-none`, and
 * absolutely positioned, so it never intercepts a click or reaches a screen
 * reader. Each component expects a `relative` parent.
 *
 * Scattered positions come from `createRng(hashSeed(seed))`, never
 * `Math.random()` — the server and the client must agree on every blob.
 */

export type BrandColor = 'lagoon' | 'coral' | 'sunset' | 'reef'

const BRAND_COLOR: Record<BrandColor, string> = {
  lagoon: 'var(--color-lagoon-400)',
  coral: 'var(--color-coral-400)',
  sunset: 'var(--color-sunset-400)',
  reef: 'var(--color-reef-400)',
}

/* ==========================================================================
   <AuroraBackground>
   ========================================================================== */

const AURORA_INTENSITY = {
  subtle: 0.26,
  medium: 0.42,
  vivid: 0.62,
} as const

/** Hoisted so the default never changes identity between renders. */
// Single-hue: a multi-hue aurora reads as consumer/AI-generic and fights the
// content for attention. Atmosphere should be felt, not seen.
const AURORA_PALETTE: BrandColor[] = ['lagoon']
const BEAM_PALETTE: BrandColor[] = ['lagoon']

export interface AuroraBackgroundProps {
  /** Stable key for the blob layout — change it to reshuffle. */
  seed?: string
  /** How many blurred blobs to scatter. */
  blobs?: number
  intensity?: keyof typeof AURORA_INTENSITY
  /** Brand ramps the blobs are drawn from. */
  palette?: BrandColor[]
  className?: string
}

/**
 * Slow drifting brand-coloured light behind a hero. Masked to an ellipse so it
 * dissolves into the page instead of ending on a hard edge.
 */
export function AuroraBackground({
  seed = 'ezra-aurora',
  blobs = 5,
  intensity = 'medium',
  palette = AURORA_PALETTE,
  className,
}: AuroraBackgroundProps) {
  const reducedMotion = useReducedMotionSafe()

  const shapes = useMemo(() => {
    const rng = createRng(hashSeed(seed))
    return Array.from({ length: blobs }, (_, index) => ({
      id: `${seed}-${index}`,
      color: BRAND_COLOR[rngPick(rng, palette)],
      size: rngInt(rng, 300, 640),
      top: rngInt(rng, -24, 64),
      left: rngInt(rng, -22, 74),
      duration: rngInt(rng, 18, 30),
      // Negative delays start each blob mid-cycle, so they never pulse in unison.
      delay: -rngInt(rng, 0, 20),
    }))
  }, [blobs, palette, seed])

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden mask-radial', className)}
    >
      {shapes.map((shape) => (
        <div
          key={shape.id}
          className="absolute"
          style={{
            top: `${shape.top}%`,
            left: `${shape.left}%`,
            width: shape.size,
            height: shape.size,
            // Opacity lives on the wrapper: the `aurora` keyframe animates
            // opacity itself and would otherwise override it.
            opacity: AURORA_INTENSITY[intensity],
          }}
        >
          <div
            className={cn('h-full w-full rounded-full blur-3xl', !reducedMotion && 'animate-aurora gpu')}
            style={{
              background: `radial-gradient(circle at center, ${shape.color}, transparent 68%)`,
              animationDuration: `${shape.duration}s`,
              animationDelay: `${shape.delay}s`,
            }}
          />
        </div>
      ))}
    </div>
  )
}

/* ==========================================================================
   <GridBackground> / <DotBackground>
   ========================================================================== */

const FADE_CLASS = {
  radial: 'mask-radial',
  bottom: 'mask-fade-b',
  y: 'mask-fade-y',
  x: 'mask-fade-x',
  none: '',
} as const

export type BackgroundFade = keyof typeof FADE_CLASS

export interface GridBackgroundProps {
  fade?: BackgroundFade
  /** Vertical light beams sweeping the grid. 0 disables them. */
  beams?: number
  seed?: string
  className?: string
}

/** Engineering-grade grid paper, optionally raked by light beams. */
export function GridBackground({
  fade = 'radial',
  beams = 0,
  seed = 'ezra-grid',
  className,
}: GridBackgroundProps) {
  const reducedMotion = useReducedMotionSafe()

  const beamList = useMemo(() => {
    const rng = createRng(hashSeed(`${seed}-beams`))
    return Array.from({ length: beams }, (_, index) => ({
      id: `${seed}-beam-${index}`,
      left: rngInt(rng, 4, 96),
      height: rngInt(rng, 120, 300),
      duration: rngInt(rng, 7, 14),
      delay: rngInt(rng, 0, 9),
      color: BRAND_COLOR[rngPick(rng, BEAM_PALETTE)],
    }))
  }, [beams, seed])

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}
    >
      <div className={cn('absolute inset-0 bg-grid', FADE_CLASS[fade])} />
      {!reducedMotion &&
        beamList.map((beam) => (
          <motion.span
            key={beam.id}
            className="absolute top-0 w-px gpu"
            style={{
              left: `${beam.left}%`,
              height: beam.height,
              background: `linear-gradient(to bottom, transparent, ${beam.color}, transparent)`,
            }}
            initial={{ y: '-30vh', opacity: 0 }}
            animate={{ y: '120vh', opacity: [0, 1, 1, 0] }}
            transition={{
              duration: beam.duration,
              delay: beam.delay,
              repeat: Infinity,
              repeatDelay: 2,
              ease: 'linear',
            }}
          />
        ))}
    </div>
  )
}

export interface DotBackgroundProps {
  fade?: BackgroundFade
  className?: string
}

/** Dot matrix texture — quieter than the grid, good behind dense content. */
export function DotBackground({ fade = 'radial', className }: DotBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 -z-10 bg-dots', FADE_CLASS[fade], className)}
    />
  )
}

/* ==========================================================================
   <NoiseOverlay>
   ========================================================================== */

/** 140×140 fractal-noise tile — ~320 bytes, no network request. */
const NOISE_TILE =
  'PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNDAnIGhlaWdodD0nMTQwJz48ZmlsdGVyIGlkPSduJz48ZmVUdXJidWxlbmNlIHR5cGU9J2ZyYWN0YWxOb2lzZScgYmFzZUZyZXF1ZW5jeT0nMC44MicgbnVtT2N0YXZlcz0nMycgc3RpdGNoVGlsZXM9J3N0aXRjaCcvPjwvZmlsdGVyPjxyZWN0IHdpZHRoPScxNDAnIGhlaWdodD0nMTQwJyBmaWx0ZXI9J3VybCgjbiknLz48L3N2Zz4='

export interface NoiseOverlayProps {
  /** 0…1. Keep it low — this should be felt, not seen. */
  opacity?: number
  /** Pin to the viewport instead of the nearest positioned ancestor. */
  fixed?: boolean
  className?: string
}

/** Film grain. Kills the banding that large soft gradients produce. */
export function NoiseOverlay({ opacity = 0.035, fixed = false, className }: NoiseOverlayProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none inset-0 -z-10', fixed ? 'fixed' : 'absolute', className)}
      style={{
        backgroundImage: `url("data:image/svg+xml;base64,${NOISE_TILE}")`,
        backgroundSize: '140px 140px',
        opacity,
      }}
    />
  )
}

/* ==========================================================================
   <WaveDivider>
   ========================================================================== */

export interface WaveDividerProps {
  /** Point the crest upward — use at the top edge of a section. */
  flip?: boolean
  /** Tailwind text colour class; the waves are filled with currentColor. */
  color?: string
  /** Height in px. */
  height?: number
  className?: string
}

/**
 * Animated ocean seam between two sections. The two layers drift at different
 * speeds, which reads as a tide rather than a loop.
 */
export function WaveDivider({
  flip = false,
  color = 'text-background',
  height = 96,
  className,
}: WaveDividerProps) {
  const reducedMotion = useReducedMotionSafe()
  const tide = reducedMotion ? undefined : 'animate-tide'

  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none w-full overflow-hidden leading-[0]', flip && 'rotate-180', color, className)}
      style={{ height }}
    >
      <svg
        viewBox="-40 0 1520 120"
        preserveAspectRatio="none"
        className="h-full w-full"
        focusable="false"
      >
        {/* Back swell — slower, translucent, reads as distance. */}
        <g className={tide} style={{ animationDuration: '19s' }}>
          <path
            d="M-40 78 C 200 34 380 108 620 74 S 1040 26 1260 70 S 1460 104 1520 76 L1520 120 L-40 120 Z"
            fill="currentColor"
            opacity="0.45"
          />
        </g>
        {/* Front swell */}
        <g className={tide} style={{ animationDuration: '13s' }}>
          <path
            d="M-40 92 C 160 58 400 118 660 88 S 1060 52 1280 92 S 1470 112 1520 94 L1520 120 L-40 120 Z"
            fill="currentColor"
          />
        </g>
      </svg>
    </div>
  )
}

/* ==========================================================================
   <GlowOrb>
   ========================================================================== */

export interface GlowOrbProps {
  color?: BrandColor
  /** Diameter in px. */
  size?: number
  /** 0…1. */
  opacity?: number
  /** Blur radius in px. */
  blur?: number
  /** Bob gently. Ignored under reduced motion. */
  float?: boolean
  /** Use for positioning — e.g. `-top-24 left-1/3`. */
  className?: string
}

/** A single soft light source. Drop two or three behind a section for depth. */
export function GlowOrb({
  color = 'lagoon',
  size = 420,
  opacity = 0.4,
  blur = 90,
  float = true,
  className,
}: GlowOrbProps) {
  const reducedMotion = useReducedMotionSafe()

  const style: CSSProperties = {
    width: size,
    height: size,
    opacity,
    filter: `blur(${blur}px)`,
    background: `radial-gradient(circle at center, ${BRAND_COLOR[color]}, transparent 70%)`,
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute -z-10 rounded-full',
        float && !reducedMotion && 'animate-float-slow gpu',
        className,
      )}
      style={style}
    />
  )
}
