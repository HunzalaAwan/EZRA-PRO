/**
 * EZRA PRO — Motion system
 *
 * One vocabulary of curves, durations, distances and variants so that a chart
 * tooltip, a marketing hero and a dashboard drawer all move like they were
 * designed by the same hand.
 *
 * This module is deliberately framework-neutral (no `'use client'`): it holds
 * plain data, so server and client components can both import from it.
 *
 * Rules the whole system obeys:
 *  - only `transform`, `opacity` and `filter` are ever animated;
 *  - durations are in seconds (motion's unit);
 *  - curves mirror the `--ease-*` custom properties in globals.css, so a CSS
 *    transition and a motion animation on the same element agree.
 */

import type { Easing, SpringOptions, Transition, UseInViewOptions, Variants } from 'motion/react'

/* ==========================================================================
   EASING — mirrors --ease-* in globals.css
   ========================================================================== */

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const
export const EASE_OUT_QUINT = [0.22, 1, 0.36, 1] as const
export const EASE_IN_OUT_QUART = [0.76, 0, 0.24, 1] as const
/** Overshoots slightly — for things that "arrive" (toasts, popovers, badges). */
export const EASE_SPRING = [0.34, 1.56, 0.64, 1] as const
/** Gentle deceleration for small, frequent UI moves. */
export const EASE_OUT_SOFT = [0.33, 1, 0.68, 1] as const

export const EASE = {
  outExpo: EASE_OUT_EXPO,
  outQuint: EASE_OUT_QUINT,
  inOutQuart: EASE_IN_OUT_QUART,
  spring: EASE_SPRING,
  outSoft: EASE_OUT_SOFT,
} as const

/** The same curves as CSS values, for plain Tailwind/CSS transitions. */
export const EASE_CSS = {
  outExpo: 'var(--ease-out-expo)',
  outQuint: 'var(--ease-out-quint)',
  inOutQuart: 'var(--ease-in-out-quart)',
  spring: 'var(--ease-spring)',
} as const

/* ==========================================================================
   SCALES
   ========================================================================== */

/** Seconds. Anything slower than `slow` is reserved for scroll-linked decor. */
export const DURATION = {
  instant: 0.12,
  fast: 0.2,
  quick: 0.32,
  base: 0.45,
  slow: 0.65,
  slower: 0.9,
  slowest: 1.25,
} as const

/** Pixels of travel for entrance animations. */
export const DISTANCE = {
  xs: 6,
  sm: 12,
  md: 20,
  lg: 34,
  xl: 56,
} as const

/** Seconds between siblings in a cascade. */
export const STAGGER = {
  tight: 0.035,
  base: 0.065,
  loose: 0.11,
  lazy: 0.18,
} as const

/** Blur radii (px) used by the focus-pull entrances. */
export const BLUR = {
  sm: 4,
  md: 8,
  lg: 14,
} as const

/* ==========================================================================
   SPRINGS — shared feel for pointer- and scroll-driven values
   ========================================================================== */

/** Cursor followers: quick to catch up, no visible wobble. */
export const SPRING_SNAPPY = { stiffness: 380, damping: 32, mass: 0.6 } as const satisfies SpringOptions
/** Cards, tilts and parallax layers: heavier, more expensive-feeling. */
export const SPRING_SOFT = { stiffness: 160, damping: 24, mass: 0.9 } as const satisfies SpringOptions
/** Long-travel values such as scroll progress. */
export const SPRING_GLIDE = {
  stiffness: 120,
  damping: 30,
  mass: 1,
  restDelta: 0.001,
} as const satisfies SpringOptions
/** Deliberate overshoot for playful affordances. */
export const SPRING_BOUNCY = { stiffness: 420, damping: 18, mass: 0.7 } as const satisfies SpringOptions

/* ==========================================================================
   TRANSITIONS
   ========================================================================== */

export const TRANSITION_DEFAULT: Transition = { duration: DURATION.base, ease: EASE_OUT_EXPO }
export const TRANSITION_SLOW: Transition = { duration: DURATION.slow, ease: EASE_OUT_EXPO }
export const TRANSITION_SNAPPY: Transition = { duration: DURATION.fast, ease: EASE_OUT_QUINT }
/** For anything that must not move at all (reduced-motion fallbacks). */
export const TRANSITION_NONE: Transition = { duration: 0 }

/** Build a one-off transition without restating the curve everywhere. */
export function transition(
  duration: number = DURATION.base,
  delay = 0,
  ease: Easing | Easing[] = EASE_OUT_EXPO,
): Transition {
  return { duration, delay, ease }
}

/* ==========================================================================
   VIEWPORT PRESETS — shared trigger points keep the page rhythm even
   ========================================================================== */

/** Fires once, slightly before the element is fully on screen. */
export const VIEWPORT_ONCE: UseInViewOptions = { once: true, margin: '-80px' }
/** For tall sections that should start moving as soon as they peek in. */
export const VIEWPORT_EARLY: UseInViewOptions = { once: true, margin: '-15%' }
/** Re-triggers on every pass — use sparingly, it reads as noisy at scale. */
export const VIEWPORT_REPEAT: UseInViewOptions = { once: false, margin: '-80px' }

/* ==========================================================================
   VARIANTS
   Every entrance exposes `hidden` / `visible` (plus `exit` where useful) so
   containers and items compose without bespoke wiring.
   ========================================================================== */

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATION.slow, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, transition: { duration: DURATION.fast, ease: EASE_OUT_EXPO } },
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: DISTANCE.md },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, y: -DISTANCE.xs, transition: { duration: DURATION.fast, ease: EASE_OUT_EXPO } },
}

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -DISTANCE.md },
  visible: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, y: DISTANCE.xs, transition: { duration: DURATION.fast, ease: EASE_OUT_EXPO } },
}

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -DISTANCE.lg },
  visible: { opacity: 1, x: 0, transition: { duration: DURATION.slow, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, x: -DISTANCE.sm, transition: { duration: DURATION.fast, ease: EASE_OUT_EXPO } },
}

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: DISTANCE.lg },
  visible: { opacity: 1, x: 0, transition: { duration: DURATION.slow, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, x: DISTANCE.sm, transition: { duration: DURATION.fast, ease: EASE_OUT_EXPO } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, scale: 0.97, transition: { duration: DURATION.fast, ease: EASE_OUT_EXPO } },
}

/** Focus-pull entrance — the signature EZRA headline/card reveal. */
export const blurIn: Variants = {
  hidden: { opacity: 0, y: DISTANCE.sm, filter: `blur(${BLUR.lg}px)` },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: DURATION.slower, ease: EASE_OUT_EXPO },
  },
  exit: { opacity: 0, filter: `blur(${BLUR.sm}px)`, transition: { duration: DURATION.fast } },
}

/** Arrival with a touch of overshoot — badges, pills, avatars. */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: { opacity: 1, scale: 1, transition: { duration: DURATION.base, ease: EASE_SPRING } },
  exit: { opacity: 0, scale: 0.9, transition: { duration: DURATION.instant } },
}

/**
 * Parent of a cascade. Children only need matching `hidden` / `visible`
 * variant names — motion propagates the state down on its own.
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: STAGGER.base, delayChildren: 0.08 },
  },
}

/** Default child of `staggerContainer`. */
export const staggerItem: Variants = {
  hidden: { opacity: 0, y: DISTANCE.md, filter: `blur(${BLUR.sm}px)` },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: DURATION.slow, ease: EASE_OUT_EXPO },
  },
}

/** Cascade container with bespoke timing. */
export function createStaggerContainer(
  stagger: number = STAGGER.base,
  startDelay = 0,
  staggerDirection: 1 | -1 = 1,
): Variants {
  return {
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger, delayChildren: startDelay, staggerDirection },
    },
  }
}

export type RevealDirection = 'up' | 'down' | 'left' | 'right' | 'none'

/** Directional entrance variants built on demand (used by `<Reveal>`). */
export function createDirectionalVariants(options: {
  direction?: RevealDirection
  distance?: number
  blur?: boolean | number
  duration?: number
  delay?: number
  ease?: Easing | Easing[]
}): Variants {
  const {
    direction = 'up',
    distance = DISTANCE.md,
    blur = false,
    duration = DURATION.slow,
    delay = 0,
    ease = EASE_OUT_EXPO,
  } = options

  const offsetX = direction === 'left' ? -distance : direction === 'right' ? distance : 0
  const offsetY = direction === 'up' ? distance : direction === 'down' ? -distance : 0
  const blurRadius = blur === true ? BLUR.md : blur === false ? 0 : blur

  // Keys are added conditionally: handing motion an `undefined` transform makes
  // it animate a value it never needed to touch.
  return {
    hidden: {
      opacity: 0,
      ...(offsetX !== 0 ? { x: offsetX } : {}),
      ...(offsetY !== 0 ? { y: offsetY } : {}),
      ...(blurRadius > 0 ? { filter: `blur(${blurRadius}px)` } : {}),
    },
    visible: {
      opacity: 1,
      ...(offsetX !== 0 ? { x: 0 } : {}),
      ...(offsetY !== 0 ? { y: 0 } : {}),
      ...(blurRadius > 0 ? { filter: 'blur(0px)' } : {}),
      transition: { duration, delay, ease },
    },
  }
}

/* ==========================================================================
   INTERACTION PRESETS — spread onto any motion component
   ========================================================================== */

export const HOVER_LIFT = {
  whileHover: { y: -3, transition: { duration: DURATION.fast, ease: EASE_OUT_QUINT } },
  whileTap: { y: 0, scale: 0.99, transition: { duration: DURATION.instant } },
} as const

export const HOVER_SCALE = {
  whileHover: { scale: 1.02, transition: { duration: DURATION.fast, ease: EASE_OUT_QUINT } },
  whileTap: { scale: 0.98, transition: { duration: DURATION.instant } },
} as const
