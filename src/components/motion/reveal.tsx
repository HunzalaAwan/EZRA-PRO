'use client'

import { useMemo, useRef, type ReactNode } from 'react'
import { motion, useInView, type HTMLMotionProps, type UseInViewOptions } from 'motion/react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  DISTANCE,
  DURATION,
  createDirectionalVariants,
  type RevealDirection,
} from '@/lib/motion'

/* ==========================================================================
   Polymorphic motion elements
   Shared by <Reveal>, <StaggerGroup> and the text effects so that every
   entrance can render the semantically correct tag.
   ========================================================================== */

const MOTION_TAGS = {
  div: motion.div,
  span: motion.span,
  p: motion.p,
  section: motion.section,
  article: motion.article,
  aside: motion.aside,
  header: motion.header,
  footer: motion.footer,
  main: motion.main,
  nav: motion.nav,
  ul: motion.ul,
  ol: motion.ol,
  li: motion.li,
  dl: motion.dl,
  dt: motion.dt,
  dd: motion.dd,
  figure: motion.figure,
  blockquote: motion.blockquote,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  h4: motion.h4,
  h5: motion.h5,
  h6: motion.h6,
} as const

export type MotionTag = keyof typeof MOTION_TAGS

/**
 * Resolve a tag name to its motion component.
 *
 * The cast collapses a 21-member union of prop types that TypeScript cannot
 * usefully narrow at the call site; every prop these wrappers forward is
 * common to all HTML elements, so the erasure is safe.
 */
export function getMotionComponent(tag: MotionTag): typeof motion.div {
  return MOTION_TAGS[tag] as typeof motion.div
}

/* ==========================================================================
   <Reveal>
   ========================================================================== */

export interface RevealProps
  extends Omit<HTMLMotionProps<'div'>, 'children' | 'variants' | 'initial' | 'animate' | 'ref'> {
  /** Optional: Reveal is also used bare as an animated decorative rule. */
  children?: ReactNode
  /** Element to render. Defaults to a div. */
  as?: MotionTag
  /** Where the element travels from. `none` fades (and blurs) in place. */
  direction?: RevealDirection
  /** Seconds before the entrance starts once the element is in view. */
  delay?: number
  /** Seconds the entrance runs for. */
  duration?: number
  /** Travel distance in px. */
  distance?: number
  /** `true` for the default focus-pull, or a blur radius in px. */
  blur?: boolean | number
  /** Replay every time the element re-enters the viewport. */
  once?: boolean
  /** Root margin for the in-view test — negative values trigger later. */
  margin?: UseInViewOptions['margin']
  /** How much of the element must be visible: 'some' | 'all' | 0…1. */
  amount?: UseInViewOptions['amount']
  className?: string
}

/**
 * Scroll-triggered entrance. The workhorse of every marketing section.
 *
 * ```tsx
 * <Reveal as="section" direction="up" blur delay={0.1}>…</Reveal>
 * ```
 *
 * Under `prefers-reduced-motion` it renders the finished state immediately and
 * never registers an observer.
 */
export function Reveal({
  children,
  as = 'div',
  direction = 'up',
  delay = 0,
  duration = DURATION.slow,
  distance = DISTANCE.md,
  blur = false,
  once = true,
  margin = '-80px',
  amount,
  className,
  ...rest
}: RevealProps) {
  const reducedMotion = useReducedMotionSafe()
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, margin, amount })
  const Component = getMotionComponent(as)

  const variants = useMemo(
    () => createDirectionalVariants({ direction, distance, blur, duration, delay }),
    [direction, distance, blur, duration, delay],
  )

  if (reducedMotion) {
    return (
      <Component ref={ref} className={className} {...rest}>
        {children}
      </Component>
    )
  }

  return (
    <Component
      ref={ref}
      className={className}
      variants={variants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      {...rest}
    >
      {children}
    </Component>
  )
}
