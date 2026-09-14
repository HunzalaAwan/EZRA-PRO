'use client'

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useIsFinePointer } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'

export type SpotlightColor = 'lagoon' | 'coral' | 'sunset' | 'reef'

const SPOTLIGHT_COLOR: Record<SpotlightColor, string> = {
  lagoon: 'var(--color-lagoon-400)',
  coral: 'var(--color-coral-400)',
  sunset: 'var(--color-sunset-400)',
  reef: 'var(--color-reef-400)',
}

/** Marks a card as steerable by a surrounding <SpotlightGroup>. */
const SPOTLIGHT_ATTR = 'data-spotlight'

/** True when an ancestor group owns the pointer listener. */
const SpotlightGroupContext = createContext(false)

/**
 * Writes the pointer position into a card's custom properties.
 * Kept as a plain DOM write — a React state update per mousemove would be
 * the single most expensive thing on a page full of cards.
 */
function writeSpot(card: HTMLElement, rect: DOMRect, clientX: number, clientY: number) {
  card.style.setProperty('--spot-x', `${clientX - rect.left}px`)
  card.style.setProperty('--spot-y', `${clientY - rect.top}px`)
}

export interface SpotlightCardProps {
  children: ReactNode
  /** Diameter of the glow in px. */
  size?: number
  color?: SpotlightColor
  /** Strength of the glow, 0…1. */
  intensity?: number
  /** Also trace the card's border with the same light. */
  border?: boolean
  className?: string
}

/**
 * The Linear/Vercel hover: a soft radial light that follows the cursor inside
 * the card, plus an optional lit border.
 *
 * Inside a `<SpotlightGroup>` the card attaches no listeners of its own — the
 * group drives every card from one handler, so the light sweeps across the
 * whole grid as a single field.
 */
export function SpotlightCard({
  children,
  size = 320,
  color = 'lagoon',
  intensity = 0.35,
  border = true,
  className,
}: SpotlightCardProps) {
  const isInGroup = useContext(SpotlightGroupContext)
  const isFinePointer = useIsFinePointer()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const card = ref.current
    if (isInGroup || !isFinePointer || !card) return

    let rect = card.getBoundingClientRect()
    const measure = () => {
      rect = card.getBoundingClientRect()
    }

    const handleMove = (event: PointerEvent) => writeSpot(card, rect, event.clientX, event.clientY)
    const handleEnter = (event: PointerEvent) => {
      measure()
      card.style.setProperty('--spot-opacity', '1')
      handleMove(event)
    }
    const handleLeave = () => card.style.setProperty('--spot-opacity', '0')

    card.addEventListener('pointerenter', handleEnter)
    card.addEventListener('pointermove', handleMove)
    card.addEventListener('pointerleave', handleLeave)
    window.addEventListener('resize', measure)

    return () => {
      card.removeEventListener('pointerenter', handleEnter)
      card.removeEventListener('pointermove', handleMove)
      card.removeEventListener('pointerleave', handleLeave)
      window.removeEventListener('resize', measure)
    }
  }, [isFinePointer, isInGroup])

  const cardVars = {
    '--spot-size': `${size}px`,
    '--spot-color': SPOTLIGHT_COLOR[color],
    '--spot-intensity': `${Math.round(intensity * 100)}%`,
    '--spot-x': '50%',
    '--spot-y': '50%',
    '--spot-opacity': '0',
  } as CSSProperties

  const glowStyle: CSSProperties = {
    background:
      'radial-gradient(var(--spot-size) circle at var(--spot-x) var(--spot-y), color-mix(in oklab, var(--spot-color) var(--spot-intensity), transparent), transparent 72%)',
    opacity: 'var(--spot-opacity)',
    transition: 'opacity 320ms var(--ease-out-expo)',
  }

  return (
    <div
      ref={ref}
      data-spotlight=""
      className={cn('relative isolate overflow-hidden', className)}
      style={cardVars}
    >
      {/* Border light: the gradient is clipped to a 1px frame with a
          composite mask. The mask gradients are alpha-only — the colour there
          carries no design meaning. */}
      {border ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 rounded-[inherit] p-px"
          style={{
            ...glowStyle,
            WebkitMask: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
            WebkitMaskComposite: 'xor',
            mask: 'linear-gradient(black, black) content-box, linear-gradient(black, black)',
            maskComposite: 'exclude',
          }}
        />
      ) : null}

      {/* Surface light */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
        style={{ ...glowStyle, opacity: `calc(var(--spot-opacity) * 0.55)` }}
      />

      <div className="relative z-10 h-full">{children}</div>
    </div>
  )
}

export interface SpotlightGroupProps {
  children: ReactNode
  className?: string
}

/**
 * Shares one pointer listener across a grid of `<SpotlightCard>`s so the glow
 * reads as a single light passing over the whole section — and so a 12-card
 * grid costs one listener instead of twelve.
 */
export function SpotlightGroup({ children, className }: SpotlightGroupProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isFinePointer = useIsFinePointer()

  useEffect(() => {
    const root = ref.current
    if (!isFinePointer || !root) return

    let cards: HTMLElement[] = []
    let rects: DOMRect[] = []
    let frame = 0
    let pointerX = 0
    let pointerY = 0

    const measure = () => {
      cards = Array.from(root.querySelectorAll<HTMLElement>(`[${SPOTLIGHT_ATTR}]`))
      rects = cards.map((card) => card.getBoundingClientRect())
    }

    const flush = () => {
      frame = 0
      for (let index = 0; index < cards.length; index += 1) {
        writeSpot(cards[index], rects[index], pointerX, pointerY)
      }
    }

    const handleMove = (event: PointerEvent) => {
      pointerX = event.clientX
      pointerY = event.clientY
      // One batched write per frame for the entire grid.
      if (frame === 0) frame = window.requestAnimationFrame(flush)
    }

    const handleEnter = (event: PointerEvent) => {
      measure()
      cards.forEach((card) => card.style.setProperty('--spot-opacity', '1'))
      handleMove(event)
    }

    const handleLeave = () => {
      cards.forEach((card) => card.style.setProperty('--spot-opacity', '0'))
    }

    root.addEventListener('pointerenter', handleEnter)
    root.addEventListener('pointermove', handleMove)
    root.addEventListener('pointerleave', handleLeave)
    window.addEventListener('resize', measure)

    return () => {
      root.removeEventListener('pointerenter', handleEnter)
      root.removeEventListener('pointermove', handleMove)
      root.removeEventListener('pointerleave', handleLeave)
      window.removeEventListener('resize', measure)
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [isFinePointer])

  return (
    <SpotlightGroupContext.Provider value={true}>
      <div ref={ref} className={className}>
        {children}
      </div>
    </SpotlightGroupContext.Provider>
  )
}
