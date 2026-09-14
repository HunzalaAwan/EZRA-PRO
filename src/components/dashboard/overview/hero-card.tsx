'use client'

import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Plus, TrendingDown, TrendingUp } from 'lucide-react'

import { CountUp } from '@/components/motion/count-up'
import { cn, formatCurrency } from '@/lib/utils'
import type { CurrencyCode, KpiMetric } from '@/types'

/* ==========================================================================
   HeroCard — the one number the operator opens the app for.

   A solid brand-filled card with the actions *inside* it, the way a wallet
   shows a balance: the figure counts up on entry, the delta sits beside it,
   and the two things you do most often are one tap away. The ribbon behind
   it is a flat shape (no gradient) that drifts slowly — motion as
   atmosphere, not decoration on the data.
   ========================================================================== */

export interface HeroCardProps {
  metric: KpiMetric
  currency: CurrencyCode
  /** e.g. "Last 30 days" */
  periodLabel: string
  className?: string
}

export function HeroCard({ metric, currency, periodLabel, className }: HeroCardProps) {
  const up = metric.deltaPercent >= 0
  const Trend = up ? TrendingUp : TrendingDown
  // KpiMetric carries the change, not the prior figure; back it out for the caption.
  const prior =
    metric.deltaPercent <= -100 ? 0 : Math.round(metric.value / (1 + metric.deltaPercent / 100))

  return (
    <section
      aria-label={`${metric.label}, ${periodLabel}`}
      className={cn(
        'relative isolate flex h-full min-h-[15.5rem] flex-col overflow-hidden rounded-2xl bg-primary p-5 text-on-primary shadow-md sm:p-6',
        className,
      )}
    >
      {/* Ribbons — two flat arcs in a lighter tint of the same hue. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -bottom-28 -z-10 size-72 rounded-full border-[26px] border-[color-mix(in_oklab,var(--on-primary)_14%,transparent)] motion-safe:animate-float-slow"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -bottom-40 -z-10 size-64 rounded-full bg-[color-mix(in_oklab,var(--on-primary)_9%,transparent)] motion-safe:animate-float"
      />

      {/* ---- eyebrow + quick add ------------------------------------------ */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium opacity-85">{metric.label}</p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-wide uppercase opacity-70">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-current opacity-70 motion-safe:animate-pulse-ring" />
              <span className="relative inline-flex size-1.5 rounded-full bg-current" />
            </span>
            {periodLabel}
          </p>
        </div>

        <Link
          href="/dashboard/bookings?new=1"
          aria-label="New booking"
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full bg-surface text-foreground shadow-sm',
            'transition-transform duration-300 ease-[var(--ease-out-expo)] hover:scale-105 active:scale-95',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface',
          )}
        >
          <Plus aria-hidden="true" className="size-4" strokeWidth={2.25} />
        </Link>
      </div>

      {/* ---- the figure ---------------------------------------------------- */}
      <div className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <CountUp
          value={metric.value}
          format="currency"
          currency={currency}
          duration={1.4}
          className="font-display text-[2.375rem] leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-[2.75rem]"
        />
        <span className="text-sm font-semibold opacity-70">{currency}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums',
            'bg-[color-mix(in_oklab,var(--on-primary)_16%,transparent)]',
          )}
        >
          <Trend aria-hidden="true" className="size-3" strokeWidth={2.5} />
          {up ? '+' : ''}
          {metric.deltaPercent.toFixed(1)}%
        </span>
        <span className="opacity-80">
          {formatCurrency(prior, currency)} {metric.comparisonLabel.replace(/^vs\s+/i, 'in the ')}
        </span>
      </div>

      {/* ---- actions, where a wallet keeps them ---------------------------- */}
      <div className="mt-auto flex flex-wrap gap-2 pt-6">
        <Link
          href="/dashboard/bookings?new=1"
          className={cn(
            'inline-flex h-10 items-center gap-1.5 rounded-full bg-surface px-4 text-sm font-semibold text-foreground shadow-sm',
            'transition-all duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-px hover:shadow-md active:translate-y-0',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface',
          )}
        >
          <Plus aria-hidden="true" className="size-4" />
          New booking
        </Link>
        <Link
          href="/dashboard/calendar"
          className={cn(
            'inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm font-semibold text-background',
            'transition-all duration-300 ease-[var(--ease-out-expo)] hover:-translate-y-px hover:shadow-md active:translate-y-0',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-surface',
          )}
        >
          <CalendarDays aria-hidden="true" className="size-4" />
          Open calendar
          <ArrowUpRight aria-hidden="true" className="size-3.5 opacity-70" />
        </Link>
      </div>
    </section>
  )
}
