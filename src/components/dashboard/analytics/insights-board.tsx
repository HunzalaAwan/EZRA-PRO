'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  ChevronDown,
  CircleAlert,
  Compass,
  HelpCircle,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'

import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { Insight } from '@/types'

/* ==========================================================================
   InsightsBoard — "EZRA Intelligence"

   Every card here is arithmetic, not a language model. The titles and bodies
   arrive already carrying real figures from the snapshot; this component's job
   is to give them a surface serious enough that an operator acts on them, and
   to be candid about where the numbers came from.
   ========================================================================== */

interface SeverityStyle {
  icon: LucideIcon
  chip: string
  stripe: string
  ring: string
  label: string
}

const SEVERITY: Record<Insight['severity'], SeverityStyle> = {
  positive: {
    icon: TrendingUp,
    chip: 'bg-success-soft text-success',
    stripe: 'bg-success',
    ring: 'hover:border-[color-mix(in_oklab,var(--success)_45%,var(--border))]',
    label: 'Opportunity',
  },
  neutral: {
    icon: Compass,
    chip: 'bg-info-soft text-info',
    stripe: 'bg-info',
    ring: 'hover:border-[color-mix(in_oklab,var(--info)_45%,var(--border))]',
    label: 'Context',
  },
  warning: {
    icon: TriangleAlert,
    chip: 'bg-warning-soft text-warning',
    stripe: 'bg-warning',
    ring: 'hover:border-[color-mix(in_oklab,var(--warning)_50%,var(--border))]',
    label: 'Worth a look',
  },
  critical: {
    icon: CircleAlert,
    chip: 'bg-danger-soft text-danger',
    stripe: 'bg-danger',
    ring: 'hover:border-[color-mix(in_oklab,var(--danger)_50%,var(--border))]',
    label: 'Needs attention',
  },
}

const METHOD_NOTES: { title: string; body: string }[] = [
  {
    title: 'Where the numbers come from',
    body: 'Every figure on this board is computed from your own bookings, departures and payments — not from a forecast, a model or a benchmark. Revenue is net of refunds and attributed to the departure date, so a booking taken in March for a July trip counts in July.',
  },
  {
    title: 'How a slot gets flagged',
    body: 'We score every weekday-and-hour combination over the trailing 90 days of departures and compare each one against the average capacity utilisation the business already achieves across your selected range. A slot is flagged when it sits ten or more points under that average with enough volume behind it to be a pattern rather than one quiet week. The prize is that slot’s realised revenue scaled up to the average at unchanged capacity, capped at a 60% lift, and only the shortlist shown is added up.',
  },
  {
    title: 'How comparisons are made',
    body: 'Deltas compare the selected range against the equal-length window immediately before it. Where that window falls outside the history on file, we say so rather than showing a flattering zero.',
  },
  {
    title: 'What we will not do',
    body: 'No insight here is generated from prose. If a claim cannot be traced to a row in your data it does not appear, which is why this board is sometimes shorter than you might expect.',
  },
]

/* --------------------------------------------------------------------------
   Card
   -------------------------------------------------------------------------- */

function InsightCard({ insight }: { insight: Insight }) {
  const style = SEVERITY[insight.severity]
  const Icon = style.icon

  return (
    <article
      className={cn(
        'group relative isolate flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface/85 p-4 shadow-xs backdrop-blur-sm',
        'transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)]',
        'hover:-translate-y-0.5 hover:shadow-lg motion-reduce:transform-none motion-reduce:transition-none',
        style.ring,
      )}
    >
      <span
        aria-hidden="true"
        className={cn('absolute inset-y-0 left-0 w-[3px]', style.stripe)}
      />

      <header className="flex items-start justify-between gap-3 pl-2">
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-lg', style.chip)}>
          <Icon aria-hidden="true" className="size-4" strokeWidth={2} />
        </span>

        <div className="flex min-w-0 flex-1 flex-col items-end gap-1.5 text-right">
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[0.625rem] font-semibold uppercase tracking-[0.06em]',
              style.chip,
            )}
          >
            {style.label}
          </span>
          {insight.metric ? (
            <span className="truncate text-[0.8125rem] font-semibold tabular-nums text-foreground">
              {insight.metric}
            </span>
          ) : null}
        </div>
      </header>

      <h3 className="mt-3 pl-2 font-display text-[0.9375rem] font-semibold leading-snug tracking-[-0.015em] text-foreground">
        {insight.title}
      </h3>

      <p className="mt-2 pl-2 text-[0.8125rem] leading-relaxed text-muted">{insight.body}</p>

      {insight.href ? (
        <div className="mt-4 pl-2">
          <Button
            asChild
            size="xs"
            variant="outline"
            className="transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5 motion-reduce:transform-none"
          >
            <Link href={insight.href}>
              {insight.actionLabel ?? 'Open'}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ) : null}
    </article>
  )
}

/* --------------------------------------------------------------------------
   Board
   -------------------------------------------------------------------------- */

export interface InsightsBoardProps {
  insights: Insight[]
  rangeLabel: string
  loading?: boolean
  className?: string
}

export function InsightsBoard({
  insights,
  rangeLabel,
  loading = false,
  className,
}: InsightsBoardProps) {
  const [open, setOpen] = React.useState(false)

  const counts = React.useMemo(() => {
    const actionable = insights.filter(
      (i) => i.severity === 'warning' || i.severity === 'critical',
    ).length
    return { actionable, total: insights.length }
  }, [insights])

  return (
    <section
      aria-label="EZRA Intelligence recommendations"
      className={cn(
        'relative isolate overflow-hidden rounded-2xl border border-[color-mix(in_oklab,var(--primary)_26%,var(--border))]',
        'bg-[linear-gradient(150deg,color-mix(in_oklab,var(--primary)_13%,var(--surface))_0%,var(--surface)_46%,color-mix(in_oklab,var(--accent)_11%,var(--surface))_100%)]',
        'shadow-lg',
        className,
      )}
    >
      {/* decorative wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-28 -z-10 size-72 rounded-full bg-[radial-gradient(circle,var(--color-lagoon-400),transparent_66%)] opacity-30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-24 -z-10 size-72 rounded-full bg-[radial-gradient(circle,var(--color-coral-500),transparent_66%)] opacity-20 blur-3xl"
      />

      <header className="flex flex-wrap items-start justify-between gap-4 px-5 pb-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-on-primary shadow-[0_8px_22px_-10px_color-mix(in_oklab,var(--primary)_85%,transparent)]">
              <Sparkles aria-hidden="true" className="size-[1.125rem]" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold tracking-[-0.025em] text-foreground">
                EZRA Intelligence
              </h2>
              <p className="text-xs text-muted">
                {counts.total} recommendations computed from your own data · {rangeLabel}
              </p>
            </div>
          </div>

          <p className="mt-3 max-w-2xl text-[0.8125rem] leading-relaxed text-muted">
            Not a summary of what happened — a shortlist of what to change next, each one priced
            against your booking history and linked to the screen where you can act on it.
          </p>
        </div>

        {counts.actionable > 0 ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[color-mix(in_oklab,var(--warning)_40%,transparent)] bg-warning-soft px-2.5 py-1.5 text-[0.6875rem] font-semibold text-warning">
            <TriangleAlert aria-hidden="true" className="size-3.5" />
            {counts.actionable} {counts.actionable === 1 ? 'needs' : 'need'} attention
          </span>
        ) : null}
      </header>

      {loading ? (
        <div className="grid gap-3 px-5 pb-5 sm:px-6 lg:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl border border-line bg-surface/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <Skeleton shape="block" className="size-7 rounded-lg" />
                <Skeleton shape="pill" className="h-5 w-20" />
              </div>
              <Skeleton shape="line" className="mt-4 h-3 w-full" />
              <Skeleton shape="line" className="mt-2 h-3 w-4/5" />
              <Skeleton shape="line" className="mt-4 h-2.5 w-full" />
              <Skeleton shape="line" className="mt-2 h-2.5 w-full" />
              <Skeleton shape="line" className="mt-2 h-2.5 w-2/3" />
              <Skeleton shape="pill" className="mt-4 h-7 w-28" />
            </div>
          ))}
        </div>
      ) : insights.length > 0 ? (
        <StaggerGroup
          as="div"
          stagger={0.07}
          margin="-40px"
          className="grid gap-3 px-5 pb-5 sm:px-6 lg:grid-cols-2 xl:grid-cols-3"
        >
          {insights.map((insight) => (
            <StaggerItem key={insight.id} className="h-full">
              <InsightCard insight={insight} />
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : (
        <p className="px-5 pb-6 text-sm text-subtle sm:px-6">
          Nothing stands out in this range. Widen the window and we will look again.
        </p>
      )}

      {/* ---------- why am I seeing this? ---------- */}
      <Collapsible
        open={open}
        onOpenChange={setOpen}
        className="border-t border-[color-mix(in_oklab,var(--primary)_16%,var(--border))] bg-surface/45 backdrop-blur-sm"
      >
        <div className="px-5 py-3.5 sm:px-6">
          <CollapsibleTrigger className="text-[0.8125rem]">
            <HelpCircle aria-hidden="true" className="size-4" />
            Why am I seeing this?
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-4 transition-transform duration-300 ease-[var(--ease-out-expo)]',
                open && 'rotate-180',
              )}
            />
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="grid gap-4 px-5 pb-5 sm:grid-cols-2 sm:px-6">
          {METHOD_NOTES.map((note) => (
            <div key={note.title} className="rounded-xl border border-line-subtle bg-surface/80 p-4">
              <h4 className="text-[0.8125rem] font-semibold text-foreground">{note.title}</h4>
              <p className="mt-1.5 text-xs leading-relaxed text-muted">{note.body}</p>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
}
