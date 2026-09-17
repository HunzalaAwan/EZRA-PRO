import type { ReactNode, SVGProps } from 'react'

import { cn } from '@/lib/utils'

/* ==========================================================================
   Operator logos — the ten customers on the logo strip, drawn as marks.

   Each brand is a small vector mark plus a wordmark set in its own voice,
   so the strip reads as ten different companies rather than one typeface
   repeated. Everything is currentColor, so the strip can grey them down
   and lift one on hover. No raster files, nothing to load.
   ========================================================================== */

type MarkProps = SVGProps<SVGSVGElement>

const base = (props: MarkProps) => ({
  viewBox: '0 0 28 28',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...props,
})

/* ---------- the marks ---------- */

function RidgelineMark(props: MarkProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 21 10 8l4 7 3-4 8 10Z" />
      <path d="M3 21h22" />
    </svg>
  )
}

function BlueHorizonMark(props: MarkProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 15a7 7 0 0 1 14 0" />
      <path d="M3 19c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" />
      <path d="M14 4v2M5.5 8l1.4 1.4M22.5 8l-1.4 1.4" />
    </svg>
  )
}

function SaltlineMark(props: MarkProps) {
  return (
    <svg {...base(props)}>
      <circle cx="14" cy="15" r="8" />
      <circle cx="14" cy="15" r="3.5" />
      <path d="M3 23h22" />
    </svg>
  )
}

function SummitHeliMark(props: MarkProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h20" />
      <path d="M14 7v4" />
      <path d="M8 15.5a6 6 0 0 1 6-4.5h5a3 3 0 0 1 3 3v2H10a2 2 0 0 1-2-2Z" />
      <path d="M6 22h14M10 18v4M17 18v4" />
    </svg>
  )
}

function CoralCayMark(props: MarkProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 25V13" />
      <path d="M14 13c-3 0-5-2-5-5m5 5c3 0 5-2 5-5" />
      <path d="M9 8c-1.5-1-2-3-1.5-4.5M19 8c1.5-1 2-3 1.5-4.5" />
      <path d="M14 19c-2.5 0-4.5-1.5-5-4M14 19c2.5 0 4.5-1.5 5-4" />
      <path d="M8 25h12" />
    </svg>
  )
}

function CaboAzulMark(props: MarkProps) {
  return (
    <svg {...base(props)}>
      <circle cx="14" cy="12" r="5" />
      <path d="M14 3v2M23 12h-2M5 12H3M20.4 5.6 19 7M7.6 5.6 9 7" />
      <path d="M3 21c2.75 0 2.75 2 5.5 2s2.75-2 5.5-2 2.75 2 5.5 2 2.75-2 5.5-2" />
    </svg>
  )
}

function TidewaterMark(props: MarkProps) {
  return (
    <svg {...base(props)}>
      <path d="M13 4v14" />
      <path d="M13 4c6 3 8 9 8 14H13" />
      <path d="M13 9c-3 2-5 6-5 9h5" />
      <path d="M3 22c2.75 0 2.75 2 5.5 2s2.75-2 5.5-2 2.75 2 5.5 2 2.75-2 5.5-2" />
    </svg>
  )
}

function NorthshoreMark(props: MarkProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20c0-8 5-13 12-13 4 0 7 2 8 5-2-1-5-1-7 1 3 0 5 2 5 5H9" />
      <path d="M4 24h20" />
    </svg>
  )
}

function KonaDeepMark(props: MarkProps) {
  return (
    <svg {...base(props)}>
      <circle cx="14" cy="6" r="2.5" />
      <path d="M14 8.5V24" />
      <path d="M9 12h10" />
      <path d="M5 17c1 4 4.5 7 9 7s8-3 9-7" />
      <path d="M5 17l2-2M23 17l-2-2" />
    </svg>
  )
}

function LagoonPaddleMark(props: MarkProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 22 20 8" />
      <path d="M17.5 5.5a4 4 0 0 1 5 5l-2.5 2.5-5-5Z" />
      <path d="M8.5 19.5 6 22" />
      <path d="M3 25h22" />
    </svg>
  )
}

/* ---------- the brands ---------- */

interface OperatorLogo {
  mark: (props: MarkProps) => ReactNode
  word: ReactNode
  /** How the wordmark is set. */
  wordClassName: string
}

export const OPERATOR_LOGOS: Record<string, OperatorLogo> = {
  RIDGELINE: { mark: RidgelineMark, word: 'Ridgeline', wordClassName: 'font-display text-[1.125rem] font-bold tracking-[-0.02em] uppercase' },
  'BLUE HORIZON': { mark: BlueHorizonMark, word: 'Blue Horizon', wordClassName: 'font-serif text-[1.375rem] italic tracking-[-0.01em]' },
  SALTLINE: { mark: SaltlineMark, word: 'saltline', wordClassName: 'font-sans text-[1.125rem] font-medium tracking-[0.18em] lowercase' },
  'SUMMIT HELI': { mark: SummitHeliMark, word: 'SUMMIT HELI', wordClassName: 'font-display text-[1rem] font-extrabold tracking-[0.08em]' },
  'CORAL CAY': { mark: CoralCayMark, word: 'Coral Cay', wordClassName: 'font-sans text-[1.25rem] font-semibold tracking-[-0.03em]' },
  'CABO AZUL': { mark: CaboAzulMark, word: 'Cabo Azul', wordClassName: 'font-serif text-[1.3125rem] tracking-[0.04em] uppercase' },
  TIDEWATER: { mark: TidewaterMark, word: 'Tidewater', wordClassName: 'font-sans text-[1.1875rem] font-semibold tracking-[-0.01em]' },
  NORTHSHORE: { mark: NorthshoreMark, word: 'NORTHSHORE', wordClassName: 'font-display text-[1.0625rem] font-black tracking-[0.02em]' },
  'KONA DEEP': { mark: KonaDeepMark, word: 'Kona Deep', wordClassName: 'font-serif text-[1.375rem] font-normal tracking-[-0.01em]' },
  'LAGOON PADDLE': { mark: LagoonPaddleMark, word: 'lagoon paddle', wordClassName: 'font-sans text-[1.0625rem] font-medium tracking-[0.06em] lowercase' },
}

export function OperatorLogoMark({ id, className }: { id: string; className?: string }) {
  const logo = OPERATOR_LOGOS[id]
  if (!logo) return <span className={className}>{id}</span>
  const Mark = logo.mark
  return (
    <span className={cn('inline-flex items-center gap-2.5 whitespace-nowrap', className)}>
      <Mark className="size-7 shrink-0" />
      <span className={cn('leading-none', logo.wordClassName)}>{logo.word}</span>
    </span>
  )
}
