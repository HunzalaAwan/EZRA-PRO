'use client'

import type { ReactNode } from 'react'
import { Reveal } from '@/components/motion/reveal'
import { DURATION } from '@/lib/motion'
import { cn } from '@/lib/utils'

export interface SectionHeadingProps {
  /** Small uppercase kicker above the title, preceded by a gradient rule. */
  eyebrow?: string
  /** The section title. Accepts nodes so callers can highlight a fragment. */
  title: ReactNode
  /** Supporting sentence beneath the title. */
  description?: ReactNode
  /** Horizontal alignment of the whole block. */
  align?: 'left' | 'center'
  className?: string
  /** Heading level. Sections default to `h2`; only change it for page titles. */
  as?: 'h1' | 'h2' | 'h3'
  /** Display size of the title. `md` steps up to `text-display-md` on desktop. */
  size?: 'sm' | 'md'
  /** Applied to the heading element — useful as an `aria-labelledby` target. */
  id?: string
}

/**
 * The shared section header for the marketing site.
 *
 * Every section on the public site opens with one of these, so the eyebrow
 * rule, type scale and entrance timing stay identical from the hero to the
 * final CTA. The three lines cascade rather than arriving together, which
 * reads as deliberate instead of as a single block fading up.
 */
export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
  as = 'h2',
  size = 'md',
  id,
}: SectionHeadingProps) {
  const centered = align === 'center'

  return (
    <div
      className={cn(
        'flex w-full flex-col',
        centered ? 'items-center text-center' : 'items-start text-left',
        className,
      )}
    >
      {eyebrow ? (
        <Reveal
          direction="up"
          distance={8}
          duration={DURATION.base}
          className="flex items-center gap-3"
        >
          <span
            aria-hidden="true"
            className="h-0.5 w-7 shrink-0 rounded-full bg-primary"
          />
          <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </span>
        </Reveal>
      ) : null}

      <Reveal
        as={as}
        id={id}
        delay={eyebrow ? 0.08 : 0}
        blur
        distance={14}
        className={cn(
          'font-display font-semibold text-pretty text-foreground',
          size === 'md' ? 'text-display-sm md:text-display-md' : 'text-display-sm',
          eyebrow && 'mt-4 sm:mt-5',
          centered && 'max-w-4xl',
        )}
      >
        {title}
      </Reveal>

      {description ? (
        <Reveal
          as="p"
          delay={eyebrow ? 0.16 : 0.08}
          distance={12}
          className={cn(
            'mt-4 max-w-[62ch] text-base leading-relaxed text-muted sm:mt-5 sm:text-lg',
            centered && 'mx-auto',
          )}
        >
          {description}
        </Reveal>
      ) : null}
    </div>
  )
}
