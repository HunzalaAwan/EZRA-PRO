'use client'

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
 * A sun cresting a horizon over two swells, set in a solid squircle in the primary colour.
 * The glyph is drawn with light strokes at ~95% opacity rather than flat white
 * so it keeps its weight on the tile in both themes, and the squircle
 * carries a 1px inner light edge so it never dissolves into a dark surface.
 */
export function Logo({ size = 'md', markOnly = false, className, ...props }: LogoProps) {
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

        <rect width="40" height="40" rx="12.5" fill="var(--primary)" />
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
