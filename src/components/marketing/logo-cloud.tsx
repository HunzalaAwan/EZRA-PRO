'use client'

import { Marquee } from '@/components/motion/marquee'
import { Reveal } from '@/components/motion/reveal'
import { LOGO_MARKS } from '@/content/marketing'
import { DURATION } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * The social-proof strip that sits directly under the hero.
 *
 * The marks are set as typographic wordmarks rather than images: they stay
 * crisp at any density, theme themselves, cost nothing to load, and — because
 * they are real text — each one carries the operator's full name for screen
 * readers while showing only the short mark.
 *
 * `<Marquee>` renders the belt twice for a seamless loop and hides the second
 * copy from assistive tech; under `prefers-reduced-motion` it degrades to a
 * plain scrollable row.
 */

const DEFAULT_HEADING = 'Trusted by operators in 40+ countries'

export interface LogoCloudProps {
  /** Small uppercase label above the belt. */
  heading?: string
  /** Seconds for one full loop. Higher is slower. */
  speed?: number
  className?: string
}

export function LogoCloud({ heading = DEFAULT_HEADING, speed = 48, className }: LogoCloudProps) {
  return (
    <section
      aria-labelledby="logo-cloud-heading"
      className={cn('relative overflow-hidden py-12 sm:py-14', className)}
    >
      <Reveal duration={DURATION.base} distance={10} className="px-4 sm:px-6 lg:px-8">
        <h2
          id="logo-cloud-heading"
          className="text-center text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-subtle"
        >
          {heading}
        </h2>
      </Reveal>

      <Reveal delay={0.1} duration={DURATION.slow} distance={14} className="mt-8 sm:mt-10">
        <Marquee speed={speed} gap={56} pauseOnHover fade>
          {LOGO_MARKS.map((logo) => (
            <span
              key={logo.name}
              className={cn(
                'group/mark inline-flex shrink-0 select-none items-center whitespace-nowrap',
                'font-display text-sm font-semibold uppercase tracking-[0.24em] sm:text-[0.9375rem]',
                'text-faint opacity-70',
                'transition-[color,opacity,transform] duration-300 ease-[var(--ease-out-expo)]',
                'hover:-translate-y-0.5 hover:text-foreground hover:opacity-100',
              )}
            >
              <span className="sr-only">{logo.name}</span>
              <span aria-hidden="true">{logo.mark}</span>
            </span>
          ))}
        </Marquee>
      </Reveal>
    </section>
  )
}
