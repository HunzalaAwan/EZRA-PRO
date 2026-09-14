'use client'

import { useCallback, useSyncExternalStore } from 'react'

/** Named queries used across the app — keeps magic strings out of components. */
export const MEDIA = {
  sm: '(min-width: 640px)',
  md: '(min-width: 768px)',
  lg: '(min-width: 1024px)',
  xl: '(min-width: 1280px)',
  '2xl': '(min-width: 1536px)',
  /** A real mouse/trackpad — the gate for magnetic, tilt and spotlight effects. */
  finePointer: '(pointer: fine)',
  coarsePointer: '(pointer: coarse)',
  hover: '(hover: hover)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  dark: '(prefers-color-scheme: dark)',
} as const

export type MediaQueryKey = keyof typeof MEDIA

/**
 * Subscribe to a CSS media query.
 *
 * Built on `useSyncExternalStore` so React uses `serverFallback` for the SSR
 * and hydration passes and only then swaps in the real value — no mismatch,
 * no flash of the wrong branch.
 */
export function useMediaQuery(query: string, serverFallback = false): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return () => undefined
      }
      const list = window.matchMedia(query)
      list.addEventListener('change', onStoreChange)
      return () => list.removeEventListener('change', onStoreChange)
    },
    [query],
  )

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return serverFallback
    }
    return window.matchMedia(query).matches
  }, [query, serverFallback])

  const getServerSnapshot = useCallback(() => serverFallback, [serverFallback])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/**
 * True only for precise pointers. Defaults to `false` before hydration so
 * pointer-driven decor never runs on touch devices, even for a frame.
 */
export function useIsFinePointer(): boolean {
  return useMediaQuery(MEDIA.finePointer, false)
}

/** True when the device can genuinely hover (excludes hybrid touch emulation). */
export function useCanHover(): boolean {
  return useMediaQuery(MEDIA.hover, false)
}

export function useIsTouchDevice(): boolean {
  return useMediaQuery(MEDIA.coarsePointer, false)
}

/** Phone-width viewport. Assumes desktop before hydration. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)', false)
}

export function useIsDesktop(): boolean {
  return useMediaQuery(MEDIA.lg, true)
}
