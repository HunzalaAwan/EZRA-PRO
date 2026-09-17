'use client'

import { BRAND_LOGOS } from '@/components/marketing/brand-logos'
import { Marquee } from '@/components/motion/marquee'
import { Reveal } from '@/components/motion/reveal'
import { DURATION } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * The social-proof strip that sits directly under the hero.
 *
 * The marks are the official brand icons from the Simple Icons set, inlined as
 * path data (brand-logos.ts) so they stay crisp at any density, theme themselves
 * and cost nothing to load; each carries the brand name for screen readers.
 *
 * `<Marquee>` renders the belt twice for a seamless loop and hides the second
 * copy from assistive tech; under `prefers-reduced-motion` it degrades to a
 * plain scrollable row.
 */

const DEFAULT_HEADING = 'Works with the tools operators already run on'

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
          className="text-center text-[0.75rem] font-medium uppercase tracking-[0.08em] text-subtle"
        >
          {heading}
        </h2>
      </Reveal>

      <Reveal delay={0.1} duration={DURATION.slow} distance={14} className="mt-8 sm:mt-10">
        <Marquee speed={speed} gap={56} pauseOnHover fade>
          {BRAND_LOGOS.map((logo) => (
            <span
              key={logo.slug}
              className={cn(
                'group/mark inline-flex shrink-0 select-none items-center whitespace-nowrap',
                'text-subtle opacity-80',
                'transition-[color,opacity,transform] duration-300 ease-[var(--ease-out-expo)]',
                'hover:-translate-y-0.5 hover:text-foreground hover:opacity-100',
              )}
            >
              <span className="sr-only">{logo.title}</span>
              <span aria-hidden="true" className="inline-flex items-center gap-2.5">
                <svg viewBox={logo.viewBox} className="size-7 shrink-0" fill="currentColor">
                  <path d={logo.d} />
                </svg>
                <span className="font-sans text-[1.0625rem] font-semibold tracking-[-0.01em]">{logo.title}</span>
              </span>
            </span>
          ))}
        </Marquee>
      </Reveal>
    </section>
  )
}
