/**
 * AppFrame — browser/app chrome used to present real product UI on the
 * marketing site.
 *
 * Deliberately a server component: it holds no state and no events, so both
 * static sections and the scroll-driven showcases can wrap their previews in it
 * without dragging extra JavaScript into the client bundle.
 *
 * The `dark` variant works by putting the `.dark` class on the frame itself.
 * Every semantic token in globals.css is declared on `.dark`, so the whole
 * subtree re-resolves `bg-surface`, `text-foreground`, `border-line` and the
 * chart ramp to their dark values while the surrounding page stays light.
 */

import * as React from 'react'
import { Lock } from 'lucide-react'

import { cn } from '@/lib/utils'

export type AppFrameVariant = 'light' | 'dark'
export type AppFrameGlow = 'none' | 'lagoon' | 'coral' | 'reef'

/** Decorative bloom behind the frame. Brand ramps, never a hardcoded colour. */
const GLOW: Record<AppFrameGlow, string> = {
  none: '',
  lagoon:
    'bg-[radial-gradient(58%_56%_at_50%_46%,var(--color-lagoon-400),transparent_70%)] opacity-[0.22]',
  coral:
    'bg-[radial-gradient(58%_56%_at_50%_46%,var(--color-coral-400),transparent_70%)] opacity-[0.20]',
  reef: 'bg-[radial-gradient(58%_56%_at_50%_46%,var(--color-reef-400),transparent_70%)] opacity-[0.20]',
}

export interface AppFrameProps extends Omit<React.ComponentProps<'div'>, 'children' | 'title'> {
  /** Address shown in the chrome's URL pill. Omit to render a blank bar. */
  url?: string
  variant?: AppFrameVariant
  glow?: AppFrameGlow
  /** Small chips or controls pinned to the right of the URL bar. */
  actions?: React.ReactNode
  /** Classes for the content well below the chrome. */
  bodyClassName?: string
  children: React.ReactNode
}

/**
 * ```tsx
 * <AppFrame url="app.ezra.pro/blue-horizon/calendar" glow="lagoon">
 *   <CalendarPreview />
 * </AppFrame>
 * ```
 */
export function AppFrame({
  url,
  variant = 'light',
  glow = 'none',
  actions,
  bodyClassName,
  className,
  children,
  ...props
}: AppFrameProps) {
  return (
    <div className={cn('relative', className)} {...props}>
      {glow !== 'none' ? (
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] blur-3xl sm:-inset-10',
            GLOW[glow],
          )}
        />
      ) : null}

      <div
        className={cn(
          'relative isolate overflow-hidden rounded-2xl border border-line bg-surface text-foreground',
          'shadow-[var(--shadow-lg),var(--shadow-2xl)]',
          variant === 'dark' && 'dark',
        )}
      >
        {/* Specular hairline along the top edge — reads as glass, not a box. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-line-strong to-transparent"
        />

        {/* ---------- Chrome ---------- */}
        <div className="flex h-10 items-center gap-3 border-b border-line-subtle bg-surface-sunken/80 px-3.5">
          <div aria-hidden="true" className="flex shrink-0 items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-coral-400/85" />
            <span className="size-2.5 rounded-full bg-sunset-400/85" />
            <span className="size-2.5 rounded-full bg-lagoon-400/85" />
          </div>

          <div className="flex min-w-0 flex-1 justify-center">
            {url ? (
              <p className="flex h-6 w-full max-w-sm min-w-0 items-center gap-1.5 rounded-md border border-line-subtle bg-surface px-2.5">
                <Lock aria-hidden="true" className="size-3 shrink-0 text-faint" strokeWidth={2.2} />
                <span className="truncate font-mono text-[0.6875rem] leading-none text-subtle">
                  {url}
                </span>
              </p>
            ) : null}
          </div>

          {/* Mirrors the dot cluster so the URL pill sits optically centred. */}
          <div className="flex w-[2.625rem] shrink-0 items-center justify-end gap-1.5">
            {actions}
          </div>
        </div>

        {/* ---------- Content well ---------- */}
        <div className={cn('relative bg-background-subtle', bodyClassName)}>{children}</div>
      </div>
    </div>
  )
}
