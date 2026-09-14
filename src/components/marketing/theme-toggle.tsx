'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Moon, Sun } from 'lucide-react'

import { IconButton } from '@/components/ui/icon-button'
import { useTheme } from '@/components/providers/theme-provider'
import { useIsHydrated, useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { DURATION, EASE_OUT_EXPO, EASE_SPRING } from '@/lib/motion'
import { cn } from '@/lib/utils'
import type { ButtonSize, ButtonVariant } from '@/components/ui/button'

export interface ThemeToggleProps {
  size?: ButtonSize
  variant?: ButtonVariant
  className?: string
}

/**
 * Light/dark switch.
 *
 * The provider resolves to `light` during SSR and on the very first client
 * render, so this renders the sun on both passes and only tells the truth once
 * `useIsHydrated()` flips — no mismatch, no flash of the wrong glyph. The
 * icon swap is a rotate + scale crossfade; `initial={false}` keeps that from
 * firing on the hydration correction, so it only ever plays on a real toggle.
 */
export function ThemeToggle({ size = 'md', variant = 'ghost', className }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const hydrated = useIsHydrated()
  const reducedMotion = useReducedMotionSafe()

  const isDark = hydrated && resolvedTheme === 'dark'
  const Icon = isDark ? Moon : Sun

  return (
    <IconButton
      type="button"
      variant={variant}
      size={size}
      shape="circle"
      onClick={toggleTheme}
      aria-label={
        hydrated ? (isDark ? 'Switch to light theme' : 'Switch to dark theme') : 'Toggle theme'
      }
      aria-pressed={hydrated ? isDark : undefined}
      className={cn(
        'relative overflow-hidden text-muted',
        'hover:text-foreground hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_28%,transparent)]',
        className,
      )}
    >
      {reducedMotion ? (
        <Icon aria-hidden="true" />
      ) : (
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={isDark ? 'moon' : 'sun'}
            className="grid place-items-center"
            initial={{ opacity: 0, rotate: -70, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 70, scale: 0.5 }}
            transition={{
              duration: DURATION.quick,
              ease: isDark ? EASE_SPRING : EASE_OUT_EXPO,
            }}
          >
            <Icon aria-hidden="true" />
          </motion.span>
        </AnimatePresence>
      )}
    </IconButton>
  )
}
