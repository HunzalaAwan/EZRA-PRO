'use client'

// Client-only for one reason: `useId()` gives every instance its own gradient
// ids. Two logos on a page (header + footer) would otherwise both resolve
// `url(#…)` to whichever mark rendered first.
import * as React from 'react'

import { cn } from '@/lib/utils'

export type LogoSize = 'sm' | 'md' | 'lg'

const SIZE_MAP: Record<LogoSize, { mark: number; word: string; gap: string }> = {
  sm: { mark: 26, word: 'text-[0.9375rem]', gap: 'gap-2' },
  md: { mark: 32, word: 'text-[1.0625rem]', gap: 'gap-2.5' },
  lg: { mark: 42, word: 'text-[1.5rem]', gap: 'gap-3' },
}

export interface LogoProps extends Omit<React.ComponentProps<'span'>, 'children'> {
  size?: LogoSize
  /** Render just the squircle mark — favicons, collapsed rails, tight toolbars. */
  markOnly?: boolean
  className?: string
}

/**
 * EZRA Pro brand mark.
 *
 * A sun cresting a horizon over two swells, set in a lagoon→coral squircle.
 * The glyph is drawn with light strokes at ~95% opacity rather than flat white
 * so it keeps its weight against the gradient in both themes, and the squircle
 * carries a 1px inner light edge so it never dissolves into a dark surface.
 */
export function Logo({ size = 'md', markOnly = false, className, ...props }: LogoProps) {
  // React ids contain characters that are awkward inside url(#…) references.
  const uid = `ezra-logo-${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const fillId = `${uid}-fill`
  const glossId = `${uid}-gloss`
  const s = SIZE_MAP[size]

  return (
    <span className={cn('inline-flex select-none items-center', s.gap, className)} {...props}>
      <svg
        width={s.mark}
        height={s.mark}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        focusable="false"
        role={markOnly ? 'img' : undefined}
        aria-label={markOnly ? 'EZRA Pro' : undefined}
        aria-hidden={markOnly ? undefined : 'true'}
        className="shrink-0"
      >
        <defs>
          <linearGradient id={fillId} x1="3" y1="1" x2="37" y2="39" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--color-lagoon-300)" />
            <stop offset="42%" stopColor="var(--color-lagoon-500)" />
            <stop offset="100%" stopColor="var(--color-coral-500)" />
          </linearGradient>
          <linearGradient id={glossId} x1="20" y1="0" x2="20" y2="27" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--color-ink-50)" stopOpacity="0.34" />
            <stop offset="100%" stopColor="var(--color-ink-50)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width="40" height="40" rx="12.5" fill={`url(#${fillId})`} />
        {/* Specular sheen — reads as a physical key rather than a flat tile. */}
        <rect width="40" height="40" rx="12.5" fill={`url(#${glossId})`} />
        <rect
          x="0.6"
          y="0.6"
          width="38.8"
          height="38.8"
          rx="11.9"
          fill="none"
          stroke="var(--color-ink-50)"
          strokeOpacity="0.2"
          strokeWidth="1.2"
        />

        <g stroke="var(--color-ink-50)" strokeLinecap="round" fill="none">
          {/* Sun cresting the horizon. */}
          <path d="M13.2 18.1a6.8 6.8 0 0 1 13.6 0" strokeWidth="2.9" strokeOpacity="0.97" />
          {/* Front swell. */}
          <path
            d="M9.4 23.4c1.75-2.7 3.5-2.7 5.25 0s3.5 2.7 5.25 0 3.5-2.7 5.25 0 3.5 2.7 5.25 0"
            strokeWidth="2.7"
            strokeOpacity="0.95"
          />
          {/* Back swell — lighter, adds depth without crowding at 26px. */}
          <path
            d="M11.9 28.8c1.35-2.1 2.7-2.1 4.05 0s2.7 2.1 4.05 0 2.7-2.1 4.05 0 2.7 2.1 4.05 0"
            strokeWidth="2.2"
            strokeOpacity="0.55"
          />
        </g>
      </svg>

      {markOnly ? null : (
        <span
          className={cn(
            'font-display font-semibold leading-none tracking-[-0.035em] text-foreground',
            s.word,
          )}
        >
          EZRA
          <span className="ml-[0.3em] font-medium text-primary">Pro</span>
        </span>
      )}
    </span>
  )
}
