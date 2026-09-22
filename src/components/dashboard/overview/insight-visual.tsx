'use client'

import { ArrowRight, Minus, TrendingDown, TrendingUp } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { InsightVisual } from '@/types'

/* ==========================================================================
   InsightVisual — the small chart an insight draws instead of describing.

   Every variant normalises to percentages, so nothing here needs a scale or a
   charting library: they are flex boxes and rounded divs, cheap enough to
   render six of on the overview without touching the bundle.

   Colour is never the only signal — each variant pairs its tint with a value
   label, and the comparison marks its own gap in words for screen readers.
   ========================================================================== */

const TONE_FILL: Record<'good' | 'bad' | 'neutral', string> = {
  good: 'bg-success',
  bad: 'bg-danger',
  neutral: 'bg-primary',
}

const TONE_TEXT: Record<'good' | 'bad' | 'neutral', string> = {
  good: 'text-success',
  bad: 'text-danger',
  neutral: 'text-primary',
}

function fmt(value: number, unit?: string) {
  const rounded = Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1)
  return `${rounded}${unit ?? ''}`
}

/** Shared bar row: a label, a track, and the value pinned right. */
function BarRow({
  label,
  value,
  display,
  tone,
  emphasis = false,
}: {
  label: string
  /** 0-100, already normalised against the row set's own maximum. */
  value: number
  display: string
  tone: 'good' | 'bad' | 'neutral'
  emphasis?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          'w-[6.5rem] shrink-0 truncate text-xs leading-tight',
          emphasis ? 'font-semibold text-foreground' : 'text-muted',
        )}
      >
        {label}
      </span>

      <span
        aria-hidden="true"
        className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-sunken ring-1 ring-line-subtle ring-inset"
      >
        <span
          className={cn('block h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-expo)]', TONE_FILL[tone])}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </span>

      <span
        className={cn(
          'w-11 shrink-0 text-right text-xs font-semibold tabular-nums',
          emphasis ? TONE_TEXT[tone] : 'text-muted',
        )}
      >
        {display}
      </span>
    </div>
  )
}

export function InsightVisualBlock({ visual }: { visual: InsightVisual }) {
  /* ---- two things side by side; the gap is the story ------------------- */
  if (visual.kind === 'comparison') {
    const max = Math.max(visual.a.value, visual.b.value, 1)
    const gap = Math.abs(visual.a.value - visual.b.value)

    return (
      <div className="flex flex-col gap-1.5">
        <BarRow
          label={visual.a.label}
          value={(visual.a.value / max) * 100}
          display={fmt(visual.a.value, visual.unit)}
          tone="good"
          emphasis
        />
        <BarRow
          label={visual.b.label}
          value={(visual.b.value / max) * 100}
          display={fmt(visual.b.value, visual.unit)}
          tone="neutral"
        />
        <p className="pl-[7.25rem] text-xs font-medium text-subtle tabular-nums">
          {fmt(gap, visual.unit)} gap
        </p>
      </div>
    )
  }

  /* ---- one fill against capacity, with a target tick ------------------- */
  if (visual.kind === 'meter') {
    const tone = visual.target !== undefined && visual.value > visual.target ? 'bad' : 'neutral'

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-muted">{visual.label}</span>
          <span className={cn('text-xs font-semibold tabular-nums', TONE_TEXT[tone])}>
            {fmt(visual.value, visual.unit)}
          </span>
        </div>

        <span
          aria-hidden="true"
          className="relative block h-2.5 overflow-hidden rounded-full bg-surface-sunken ring-1 ring-line-subtle ring-inset"
        >
          <span
            className={cn('block h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out-expo)]', TONE_FILL[tone])}
            style={{ width: `${Math.max(2, Math.min(100, visual.value))}%` }}
          />
          {visual.target !== undefined ? (
            <span
              className="absolute inset-y-0 w-px bg-foreground/45"
              style={{ left: `${Math.min(100, visual.target)}%` }}
            />
          ) : null}
        </span>

        {visual.target !== undefined ? (
          <p className="text-xs text-subtle tabular-nums">
            Healthy target {fmt(visual.target, visual.unit)}
          </p>
        ) : null}
      </div>
    )
  }

  /* ---- one slice of the whole, with the runner-up for scale ------------ */
  if (visual.kind === 'share') {
    return (
      <div className="flex flex-col gap-1.5">
        <span
          aria-hidden="true"
          className="flex h-2.5 overflow-hidden rounded-full bg-surface-sunken ring-1 ring-line-subtle ring-inset"
        >
          <span
            className="block h-full bg-primary transition-[width] duration-700 ease-[var(--ease-out-expo)]"
            style={{ width: `${Math.max(2, Math.min(100, visual.value))}%` }}
          />
          {visual.runnerUp ? (
            <span
              className="block h-full bg-[color-mix(in_oklab,var(--primary)_38%,transparent)]"
              style={{ width: `${Math.max(1, Math.min(100 - visual.value, visual.runnerUp.value))}%` }}
            />
          ) : null}
        </span>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            <span className="max-w-[9rem] truncate font-medium text-foreground">{visual.label}</span>
            <span className="font-semibold text-primary tabular-nums">{fmt(visual.value, '%')}</span>
          </span>
          {visual.runnerUp ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-[color-mix(in_oklab,var(--primary)_38%,transparent)]"
              />
              <span className="max-w-[9rem] truncate text-muted">{visual.runnerUp.label}</span>
              <span className="font-semibold text-muted tabular-nums">
                {fmt(visual.runnerUp.value, '%')}
              </span>
            </span>
          ) : null}
        </div>
      </div>
    )
  }

  /* ---- movement between two readings ----------------------------------- */
  const rose = visual.to > visual.from
  const flat = visual.to === visual.from
  const higherIsBetter = visual.higherIsBetter ?? true
  const tone: 'good' | 'bad' | 'neutral' = flat ? 'neutral' : rose === higherIsBetter ? 'good' : 'bad'
  const Icon = flat ? Minus : rose ? TrendingUp : TrendingDown

  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 text-xs text-muted">{visual.label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-xs tabular-nums">
        <span className="text-subtle line-through decoration-line-strong">
          {fmt(visual.from, visual.unit)}
        </span>
        <ArrowRight aria-hidden="true" className="size-3 shrink-0 text-faint" />
        <span className={cn('inline-flex items-center gap-1 font-semibold', TONE_TEXT[tone])}>
          <Icon aria-hidden="true" className="size-3" strokeWidth={2.25} />
          {fmt(visual.to, visual.unit)}
        </span>
      </span>
    </div>
  )
}

