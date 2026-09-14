'use client'

/**
 * EZRA PRO — motion layer.
 *
 * Every animated primitive the marketing site and dashboard compose from.
 * Shared constants and variants live in `@/lib/motion`, which is importable
 * from server components too; everything re-exported here is client-only.
 */

export { Reveal, getMotionComponent, type MotionTag, type RevealProps } from './reveal'
export {
  StaggerGroup,
  StaggerItem,
  type StaggerGroupProps,
  type StaggerItemProps,
} from './stagger'
export {
  AnimatedText,
  GradientText,
  ScrollRevealText,
  TypewriterText,
  type AnimatedTextProps,
  type GradientTextProps,
  type ScrollRevealTextProps,
  type TypewriterTextProps,
} from './text-effects'
export { CountUp, type CountUpFormat, type CountUpProps } from './count-up'
export { Magnetic, type MagneticProps } from './magnetic'
export { TiltCard, type TiltCardProps } from './tilt-card'
export {
  SpotlightCard,
  SpotlightGroup,
  type SpotlightCardProps,
  type SpotlightColor,
  type SpotlightGroupProps,
} from './spotlight'
export { Marquee, type MarqueeProps } from './marquee'
export { Parallax, type ParallaxProps } from './parallax'
export {
  AuroraBackground,
  DotBackground,
  GlowOrb,
  GridBackground,
  NoiseOverlay,
  WaveDivider,
  type AuroraBackgroundProps,
  type BackgroundFade,
  type BrandColor,
  type DotBackgroundProps,
  type GlowOrbProps,
  type GridBackgroundProps,
  type NoiseOverlayProps,
  type WaveDividerProps,
} from './backgrounds'
export { ScrollProgress, type ScrollProgressProps } from './scroll-progress'
export {
  PageTransition,
  RouteLoadingBar,
  type PageTransitionProps,
  type RouteLoadingBarProps,
} from './page-transition'

/* Hooks the motion layer is built on — re-exported for page components. */
export { useIsHydrated, useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
export {
  MEDIA,
  useCanHover,
  useIsDesktop,
  useIsFinePointer,
  useIsMobile,
  useIsTouchDevice,
  useMediaQuery,
  type MediaQueryKey,
} from '@/hooks/use-media-query'
export {
  useMousePosition,
  useViewportMousePosition,
  type MousePosition,
  type UseMousePositionOptions,
  type ViewportMousePosition,
} from '@/hooks/use-mouse-position'

/* Type-only re-export so consumers can annotate props without a second import. */
export type { RevealDirection } from '@/lib/motion'
