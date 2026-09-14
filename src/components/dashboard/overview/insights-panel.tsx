'use client'

import Link from 'next/link'
import {
  ArrowRight,
  OctagonAlert,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Waypoints,
  type LucideIcon,
} from 'lucide-react'

import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import type { Insight } from '@/types'

/* ==========================================================================
   InsightsPanel — the differentiator.

   FareHarbor and Peek show you numbers. This panel reads them: every row is
   computed from the operator's own departures and names a real figure, so it
   has to look like a first-class surface rather than a tips box. Hence the
   brand-washed card, the "EZRA Intelligence" cap and the cascade.
   ========================================================================== */

interface SeverityLook {
  icon: LucideIcon
  /** Tinted medallion behind the glyph. */
  chip: string
  /** Accent hairline that lights up on hover. */
  rule: string
  label: string
}

const SEVERITY: Record<Insight['severity'], SeverityLook> = {
  positive: {
    icon: TrendingUp,
    chip: 'bg-success-soft text-success ring-[color-mix(in_oklab,var(--success)_28%,transparent)]',
    rule: 'bg-success',
    label: 'Opportunity',
  },
  neutral: {
    icon: Waypoints,
    chip: 'bg-info-soft text-info ring-[color-mix(in_oklab,var(--info)_28%,transparent)]',
    rule: 'bg-info',
    label: 'Signal',
  },
  warning: {
    icon: TriangleAlert,
    chip: 'bg-warning-soft text-warning ring-[color-mix(in_oklab,var(--warning)_30%,transparent)]',
    rule: 'bg-warning',
    label: 'Needs attention',
  },
  critical: {
    icon: OctagonAlert,
    chip: 'bg-danger-soft text-danger ring-[color-mix(in_oklab,var(--danger)_28%,transparent)]',
    rule: 'bg-danger',
    label: 'Act now',
  },
}

export interface InsightsPanelProps {
  insights: Insight[]
  /** Where the footer link goes. */
  href?: string
  className?: string
}

export function InsightsPanel({
  insights,
  href = '/dashboard/analytics',
  className,
}: InsightsPanelProps) {
  return (
    <Card variant="gradient" className={cn('flex h-full flex-col overflow-hidden', className)}>
      {/* ---- cap --------------------------------------------------------- */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line-subtle px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative grid size-8 shrink-0 place-items-center rounded-xl bg-primary-soft ring-1 ring-[color-mix(in_oklab,var(--primary)_26%,transparent)] ring-inset">
            <Sparkles aria-hidden="true" className="size-4 text-primary" strokeWidth={2} />
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-xl ring-1 ring-primary/30 motion-safe:animate-pulse-ring"
            />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[0.9375rem] leading-tight font-semibold tracking-[-0.015em] text-foreground">
              What to do next
            </h2>
            <p className="mt-0.5 truncate text-[0.6875rem] text-subtle">
              Powered by EZRA Intelligence
            </p>
          </div>
        </div>

        <span className="shrink-0 rounded-full bg-surface/70 px-2 py-0.5 text-[0.6875rem] font-semibold text-muted tabular-nums ring-1 ring-line-subtle ring-inset">
          {insights.length}
        </span>
      </div>

      {/* ---- rows -------------------------------------------------------- */}
      {insights.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <EmptyState
            size="sm"
            variant="no-data"
            icon={Sparkles}
            title="Nothing needs your attention"
            description="We re-read your departures, pricing and channel mix every morning. You are all clear today."
          />
        </div>
      ) : (
        <StaggerGroup
          as="ul"
          stagger={0.06}
          startDelay={0.08}
          className="min-h-0 flex-1 divide-y divide-line-subtle overflow-y-auto no-scrollbar"
        >
          {insights.map((insight) => {
            const look = SEVERITY[insight.severity]
            const Icon = look.icon

            return (
              <StaggerItem as="li" key={insight.id} direction="right" distance={16}>
                <Link
                  href={insight.href ?? href}
                  className={cn(
                    'group relative flex gap-3 px-5 py-3.5 transition-colors duration-200',
                    'hover:bg-surface/60',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                  )}
                >
                  {/* Severity hairline — silent at rest, lights up on hover. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-y-2 left-0 w-0.5 rounded-full opacity-0 transition-opacity duration-300',
                      'group-hover:opacity-100',
                      look.rule,
                    )}
                  />

                  <span
                    className={cn(
                      'mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg ring-1 ring-inset',
                      look.chip,
                    )}
                  >
                    <Icon aria-hidden="true" className="size-3.5" strokeWidth={2} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[0.8125rem] leading-snug font-semibold text-balance text-foreground">
                        {insight.title}
                      </p>
                      {insight.metric ? (
                        <span className="shrink-0 rounded-md bg-surface-sunken px-1.5 py-0.5 text-[0.6875rem] font-semibold text-muted tabular-nums">
                          {insight.metric}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 text-xs leading-relaxed text-muted">{insight.body}</p>

                    <span className="mt-2 inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-primary">
                      {insight.actionLabel ?? 'Open in analytics'}
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5"
                      />
                    </span>
                    <span className="sr-only"> — {look.label}</span>
                  </div>
                </Link>
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      )}

      {/* ---- footer ------------------------------------------------------ */}
      <div className="shrink-0 border-t border-line-subtle px-5 py-3">
        <Link
          href={href}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md text-xs font-semibold text-muted',
            'transition-colors duration-200 hover:text-foreground',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          )}
        >
          See the full analysis
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}
