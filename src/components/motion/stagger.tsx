'use client'

import { useMemo, useRef, type ReactNode } from 'react'
import { useInView, type HTMLMotionProps, type UseInViewOptions } from 'motion/react'
import { getMotionComponent, type MotionTag } from '@/components/motion/reveal'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  DISTANCE,
  DURATION,
  STAGGER,
  createDirectionalVariants,
  createStaggerContainer,
  type RevealDirection,
} from '@/lib/motion'

export interface StaggerGroupProps
  extends Omit<HTMLMotionProps<'div'>, 'children' | 'variants' | 'initial' | 'animate' | 'ref'> {
  children: ReactNode
  as?: MotionTag
  /** Seconds between each child. */
  stagger?: number
  /** Seconds before the first child starts. */
  startDelay?: number
  /** Cascade from the last child backwards. */
  reverse?: boolean
  once?: boolean
  margin?: UseInViewOptions['margin']
  amount?: UseInViewOptions['amount']
  className?: string
}

/**
 * Cascades its `<StaggerItem>` children into view.
 *
 * The group owns the timing; items only declare how they move. Motion
 * propagates the `hidden` → `visible` state down the tree, so items need no
 * props to participate:
 *
 * ```tsx
 * <StaggerGroup as="ul" stagger={0.05} className="grid gap-4">
 *   {features.map((f) => <StaggerItem as="li" key={f.id}>…</StaggerItem>)}
 * </StaggerGroup>
 * ```
 */
export function StaggerGroup({
  children,
  as = 'div',
  stagger = STAGGER.base,
  startDelay = 0,
  reverse = false,
  once = true,
  margin = '-80px',
  amount,
  className,
  ...rest
}: StaggerGroupProps) {
  const reducedMotion = useReducedMotionSafe()
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, margin, amount })
  const Component = getMotionComponent(as)

  const variants = useMemo(
    () => createStaggerContainer(stagger, startDelay, reverse ? -1 : 1),
    [stagger, startDelay, reverse],
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

export interface StaggerItemProps
  extends Omit<HTMLMotionProps<'div'>, 'children' | 'variants' | 'initial' | 'animate' | 'ref'> {
  children: ReactNode
  as?: MotionTag
  direction?: RevealDirection
  distance?: number
  blur?: boolean | number
  duration?: number
  className?: string
}

/**
 * One rung of a cascade. Declares how it moves and inherits *when* from the
 * surrounding `<StaggerGroup>`; rendered on its own it has no variant state to
 * inherit, so it simply appears without animating.
 */
export function StaggerItem({
  children,
  as = 'div',
  direction = 'up',
  distance = DISTANCE.md,
  blur = true,
  duration = DURATION.slow,
  className,
  ...rest
}: StaggerItemProps) {
  const reducedMotion = useReducedMotionSafe()
  const Component = getMotionComponent(as)

  const variants = useMemo(
    () => createDirectionalVariants({ direction, distance, blur, duration }),
    [direction, distance, blur, duration],
  )

  if (reducedMotion) {
    return (
      <Component className={className} {...rest}>
        {children}
      </Component>
    )
  }

  return (
    <Component className={className} variants={variants} {...rest}>
      {children}
    </Component>
  )
}
