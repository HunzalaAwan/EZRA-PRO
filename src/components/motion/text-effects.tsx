'use client'

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
  type ReactNode,
} from 'react'
import {
  motion,
  useInView,
  useMotionTemplate,
  useScroll,
  useTransform,
  type MotionValue,
  type UseInViewOptions,
  type UseScrollOptions,
} from 'motion/react'
import { getMotionComponent, type MotionTag } from '@/components/motion/reveal'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import {
  BLUR,
  DISTANCE,
  DURATION,
  STAGGER,
  createDirectionalVariants,
  createStaggerContainer,
} from '@/lib/motion'
import { cn } from '@/lib/utils'

/* ==========================================================================
   <AnimatedText> — per-word / per-character headline entrance
   ========================================================================== */

export interface AnimatedTextProps {
  /** The headline. Plain string so the screen-reader copy stays intact. */
  text: string
  /** Tag to render — use a heading tag for headlines. */
  as?: MotionTag
  /** Animate whole words (default) or individual characters. */
  by?: 'word' | 'character'
  /** Seconds before the first piece moves. */
  delay?: number
  /** Seconds between pieces. */
  stagger?: number
  /** Seconds each piece takes. */
  duration?: number
  /** Travel distance in px. */
  distance?: number
  /** `true` for the default focus-pull, or a blur radius in px. */
  blur?: boolean | number
  once?: boolean
  margin?: UseInViewOptions['margin']
  className?: string
  /** Applied to each animated word/character — e.g. a gradient on one word. */
  pieceClassName?: string
}

/**
 * Splits a headline and floats each piece in with a blur-to-focus cascade.
 *
 * Accessibility: the real string is rendered once in an `sr-only` span and the
 * animated fragments are hidden from assistive tech, so the headline is never
 * announced letter by letter.
 */
export function AnimatedText({
  text,
  as = 'span',
  by = 'word',
  delay = 0,
  stagger = STAGGER.base,
  duration = DURATION.slower,
  distance = DISTANCE.sm,
  blur = true,
  once = true,
  margin = '-80px',
  className,
  pieceClassName,
}: AnimatedTextProps) {
  const reducedMotion = useReducedMotionSafe()
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once, margin })
  const Component = getMotionComponent(as)

  const words = useMemo(() => text.split(' ').filter((word) => word.length > 0), [text])
  const container = useMemo(
    () => createStaggerContainer(stagger, delay),
    [stagger, delay],
  )
  const piece = useMemo(
    () => createDirectionalVariants({ direction: 'up', distance, blur, duration }),
    [distance, blur, duration],
  )

  if (reducedMotion) {
    return <Component className={className}>{text}</Component>
  }

  return (
    <Component
      ref={ref}
      className={className}
      variants={container}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
    >
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, wordIndex) => (
          <Fragment key={`${word}-${wordIndex}`}>
            {/* A real space text node keeps natural line wrapping between the
                inline-block word boxes. */}
            {wordIndex > 0 ? ' ' : null}
            {by === 'word' ? (
              <motion.span variants={piece} className={cn('inline-block', pieceClassName)}>
                {word}
              </motion.span>
            ) : (
              <span className="inline-block whitespace-nowrap">
                {Array.from(word).map((character, characterIndex) => (
                  <motion.span
                    key={`${character}-${characterIndex}`}
                    variants={piece}
                    className={cn('inline-block', pieceClassName)}
                  >
                    {character}
                  </motion.span>
                ))}
              </span>
            )}
          </Fragment>
        ))}
      </span>
    </Component>
  )
}

/* ==========================================================================
   <TypewriterText> — cycling phrases with a blinking caret
   ========================================================================== */

type TypewriterPhase = 'typing' | 'holding' | 'deleting'

export interface TypewriterTextProps {
  /** Phrases cycled in order. The first is what SSR renders. */
  phrases: string[]
  /** Milliseconds per character while typing. */
  typingSpeed?: number
  /** Milliseconds per character while deleting. */
  deletingSpeed?: number
  /** Milliseconds a completed phrase is held. */
  holdDuration?: number
  /** Stop on the last phrase instead of looping. */
  loop?: boolean
  /** Reserve the width of the longest phrase so the line never reflows. */
  reserveWidth?: boolean
  className?: string
  caretClassName?: string
}

/**
 * Types, holds and deletes a list of phrases.
 *
 * SSR renders the first phrase in full — no blank frame, no layout shift, and
 * nothing scheduled until `useEffect` runs on the client, so server and client
 * markup always agree.
 */
export function TypewriterText({
  phrases,
  typingSpeed = 55,
  deletingSpeed = 28,
  holdDuration = 1800,
  loop = true,
  reserveWidth = true,
  className,
  caretClassName,
}: TypewriterTextProps) {
  const reducedMotion = useReducedMotionSafe()
  const safePhrases = phrases.length > 0 ? phrases : ['']
  const [index, setIndex] = useState(0)
  const [charCount, setCharCount] = useState(safePhrases[0].length)
  const [phase, setPhase] = useState<TypewriterPhase>('holding')

  // The phrase list reaches the effect as a serialised key: an inline
  // `phrases={[...]}` prop is a fresh array on every render, and depending on
  // that identity would restart the pending timer each time.
  const phrasesKey = JSON.stringify(safePhrases)

  useEffect(() => {
    if (reducedMotion) return
    const list = JSON.parse(phrasesKey) as string[]
    const current = list[index % list.length]
    const isLast = index === list.length - 1

    if (phase === 'holding') {
      if (!loop && isLast) return
      const timer = window.setTimeout(() => setPhase('deleting'), holdDuration)
      return () => window.clearTimeout(timer)
    }

    if (phase === 'deleting') {
      if (charCount === 0) {
        setIndex((previous) => (previous + 1) % list.length)
        setPhase('typing')
        return
      }
      const timer = window.setTimeout(() => setCharCount((count) => count - 1), deletingSpeed)
      return () => window.clearTimeout(timer)
    }

    if (charCount >= current.length) {
      setPhase('holding')
      return
    }
    const timer = window.setTimeout(() => setCharCount((count) => count + 1), typingSpeed)
    return () => window.clearTimeout(timer)
  }, [
    charCount,
    deletingSpeed,
    holdDuration,
    index,
    phrasesKey,
    loop,
    phase,
    reducedMotion,
    typingSpeed,
  ])

  const longest = useMemo(
    () => safePhrases.reduce((a, b) => (b.length > a.length ? b : a), ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on content, not identity
    [phrasesKey],
  )
  const visible = reducedMotion
    ? safePhrases[0]
    : (safePhrases[index % safePhrases.length] ?? '').slice(0, charCount)

  const caret = (
    <span
      aria-hidden="true"
      className={cn(
        'ml-0.5 inline-block h-[0.95em] w-[2px] translate-y-[0.12em] rounded-full bg-primary align-baseline',
        !reducedMotion && 'animate-caret',
        caretClassName,
      )}
    />
  )

  return (
    <span className={cn(reserveWidth && 'inline-grid', className)}>
      {/* Announce every phrase once; the animated line is decorative. */}
      <span className="sr-only">{safePhrases.join(', ')}</span>
      {reserveWidth ? (
        <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-pre">
          {longest}
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className={cn('whitespace-pre', reserveWidth && 'col-start-1 row-start-1')}
      >
        {visible}
        {caret}
      </span>
    </span>
  )
}

/* ==========================================================================
   <GradientText> — animated brand gradient on live text
   ========================================================================== */

export interface GradientTextProps {
  children: ReactNode
  /** Tag to render. Inline by default so it can wrap a word in a headline. */
  as?: 'span' | 'div' | 'p' | 'strong' | 'em' | 'h1' | 'h2' | 'h3' | 'h4'
  /** `brand` runs lagoon → coral → sunset; `lagoon` stays cool. */
  variant?: 'brand' | 'lagoon'
  /** Pan the gradient. Ignored under reduced motion. */
  animated?: boolean
  className?: string
}

export function GradientText({
  children,
  as = 'span',
  variant = 'brand',
  animated = true,
  className,
}: GradientTextProps) {
  const reducedMotion = useReducedMotionSafe()
  const Tag = as as ElementType
  const shouldAnimate = animated && !reducedMotion

  return (
    <Tag
      className={cn(
        variant === 'brand' ? 'text-gradient-brand' : 'text-gradient-lagoon',
        shouldAnimate && 'animate-gradient-pan',
        className,
      )}
      // The lagoon ramp has no oversized background of its own; panning needs
      // room to travel, so widen it only when the animation is on.
      style={shouldAnimate ? { backgroundSize: '220% auto' } : undefined}
    >
      {children}
    </Tag>
  )
}

/* ==========================================================================
   <ScrollRevealText> — words brighten as the block scrolls through
   ========================================================================== */

const DEFAULT_REVEAL_OFFSET: UseScrollOptions['offset'] = ['start 0.85', 'end 0.45']

export interface ScrollRevealTextProps {
  text: string
  as?: MotionTag
  /** Opacity of words that have not been reached yet. */
  dimOpacity?: number
  /** Also pull each word from blurred to sharp. */
  blur?: boolean
  /** Scroll window mapped onto the reveal. */
  offset?: UseScrollOptions['offset']
  className?: string
  wordClassName?: string
}

/**
 * A manifesto paragraph that lights up word by word with the scroll position.
 *
 * Only `opacity` (and optionally `filter`) is driven, so the text stays
 * selectable, searchable and fully readable to assistive tech at all times.
 */
export function ScrollRevealText({
  text,
  as = 'p',
  dimOpacity = 0.18,
  blur = false,
  offset = DEFAULT_REVEAL_OFFSET,
  className,
  wordClassName,
}: ScrollRevealTextProps) {
  const reducedMotion = useReducedMotionSafe()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset })
  const Component = getMotionComponent(as)
  const words = useMemo(() => text.split(' ').filter((word) => word.length > 0), [text])

  if (reducedMotion) {
    return <Component className={className}>{text}</Component>
  }

  return (
    <Component ref={ref} className={className}>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          {index > 0 ? ' ' : null}
          <ScrollRevealWord
            word={word}
            progress={scrollYProgress}
            start={index / words.length}
            end={(index + 1) / words.length}
            dimOpacity={dimOpacity}
            blur={blur}
            className={wordClassName}
          />
        </Fragment>
      ))}
    </Component>
  )
}

interface ScrollRevealWordProps {
  word: string
  progress: MotionValue<number>
  start: number
  end: number
  dimOpacity: number
  blur: boolean
  className?: string
}

/** Its own component so each word may legally own its `useTransform` hooks. */
function ScrollRevealWord({
  word,
  progress,
  start,
  end,
  dimOpacity,
  blur,
  className,
}: ScrollRevealWordProps) {
  const opacity = useTransform(progress, [start, end], [dimOpacity, 1])
  const blurRadius = useTransform(progress, [start, end], [BLUR.sm, 0])
  const filter = useMotionTemplate`blur(${blurRadius}px)`

  return (
    <motion.span
      className={cn('inline-block', className)}
      style={blur ? { opacity, filter } : { opacity }}
    >
      {word}
    </motion.span>
  )
}
