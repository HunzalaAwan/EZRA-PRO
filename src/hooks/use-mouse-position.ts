'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { useMotionValue, type MotionValue } from 'motion/react'
import { clamp } from '@/lib/utils'

export interface UseMousePositionOptions {
  /**
   * Detach every listener when false — pass `false` for coarse pointers or
   * when the user prefers reduced motion so nothing is measured at all.
   */
  enabled?: boolean
  /** Return the values to their resting state when the pointer leaves. */
  resetOnLeave?: boolean
}

export interface MousePosition<T extends HTMLElement> {
  /** Attach to the element the pointer should be measured against. */
  ref: RefObject<T | null>
  /** Offset from the element's centre, in px. */
  x: MotionValue<number>
  y: MotionValue<number>
  /** Same offset normalised to -0.5…0.5 of the element's box. */
  xPercent: MotionValue<number>
  yPercent: MotionValue<number>
  /** Pointer position inside the box, 0…1 — handy for radial gradients. */
  xRatio: MotionValue<number>
  yRatio: MotionValue<number>
  /** Re-renders only on enter/leave, never on move. */
  isHovered: boolean
}

/**
 * Tracks the pointer relative to an element as motion values.
 *
 * Deliberately does NOT store coordinates in React state: a card that
 * re-rendered on every `pointermove` would drop frames as soon as more than a
 * couple were on screen. Only the hover flag is stateful.
 */
export function useMousePosition<T extends HTMLElement = HTMLDivElement>(
  options: UseMousePositionOptions = {},
): MousePosition<T> {
  const { enabled = true, resetOnLeave = true } = options

  const ref = useRef<T>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const xPercent = useMotionValue(0)
  const yPercent = useMotionValue(0)
  const xRatio = useMotionValue(0.5)
  const yRatio = useMotionValue(0.5)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!enabled || !element) return

    // The box is measured on enter (and on scroll/resize while hovered) rather
    // than on every move: one layout read per gesture instead of per frame.
    let rect = element.getBoundingClientRect()
    const measure = () => {
      rect = element.getBoundingClientRect()
    }

    const track = (event: PointerEvent) => {
      if (rect.width === 0 || rect.height === 0) return
      const localX = event.clientX - rect.left
      const localY = event.clientY - rect.top
      x.set(localX - rect.width / 2)
      y.set(localY - rect.height / 2)
      xPercent.set(localX / rect.width - 0.5)
      yPercent.set(localY / rect.height - 0.5)
      xRatio.set(clamp(localX / rect.width, 0, 1))
      yRatio.set(clamp(localY / rect.height, 0, 1))
    }

    const handleEnter = (event: PointerEvent) => {
      measure()
      setIsHovered(true)
      track(event)
      window.addEventListener('scroll', measure, { passive: true, capture: true })
    }

    const handleLeave = () => {
      setIsHovered(false)
      window.removeEventListener('scroll', measure, true)
      if (!resetOnLeave) return
      x.set(0)
      y.set(0)
      xPercent.set(0)
      yPercent.set(0)
      xRatio.set(0.5)
      yRatio.set(0.5)
    }

    element.addEventListener('pointerenter', handleEnter)
    element.addEventListener('pointermove', track)
    element.addEventListener('pointerleave', handleLeave)
    element.addEventListener('pointercancel', handleLeave)
    window.addEventListener('resize', measure)

    return () => {
      element.removeEventListener('pointerenter', handleEnter)
      element.removeEventListener('pointermove', track)
      element.removeEventListener('pointerleave', handleLeave)
      element.removeEventListener('pointercancel', handleLeave)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [enabled, resetOnLeave, x, y, xPercent, yPercent, xRatio, yRatio])

  return { ref, x, y, xPercent, yPercent, xRatio, yRatio, isHovered }
}

export interface ViewportMousePosition {
  /** Pointer position in viewport coordinates, px. */
  x: MotionValue<number>
  y: MotionValue<number>
}

/**
 * Viewport-wide pointer position, sampled at most once per animation frame.
 * For cursor followers and glow trails that live outside any one element.
 */
export function useViewportMousePosition(enabled = true): ViewportMousePosition {
  const x = useMotionValue(0)
  const y = useMotionValue(0)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    let frame = 0
    let nextX = 0
    let nextY = 0

    const flush = () => {
      frame = 0
      x.set(nextX)
      y.set(nextY)
    }

    const handleMove = (event: PointerEvent) => {
      nextX = event.clientX
      nextY = event.clientY
      // Coalesce bursts of pointer events into a single write per frame.
      if (frame === 0) frame = window.requestAnimationFrame(flush)
    }

    window.addEventListener('pointermove', handleMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', handleMove)
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [enabled, x, y])

  return { x, y }
}
