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
import { InsightVisualBlock } from '@/components/dashboard/overview/insight-visual'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import type { Insight } from '@/types'

/* ==========================================================================
   InsightsPanel — what to do next, in priority order.

   Every row is computed from the operator's own departures. On the overview
   the panel shows only the top few: the first gets its picture and its
   sentence, the rest are a title and the one number that matters. The full
   board, with the method notes, lives on the analytics page.
   ========================================================================== */

interface SeverityLook {
  icon: LucideIcon
  chip: string
  rule: string
  label: string
}

const SEVERITY: Record<Insight['severity'], SeverityLook> = {
  positive: {
    icon: TrendingUp,
    chip: 'bg-success-soft text-success',
    rule: 'bg-success',
    label: 'Opportunity',
  },
  neutral: {
    icon: Waypoints,
    chip: 'bg-info-soft text-info',
    rule: 'bg-info',
    label: 'Signal',
  },
  warning: {
    icon: TriangleAlert,
    chip: 'bg-warning-soft text-warning',
    rule: 'bg-warning',
    label: 'Needs attention',
  },
  critical: {
    icon: OctagonAlert,
    chip: 'bg-danger-soft text-danger',
    rule: 'bg-danger',
    label: 'Act now',
  },
}

export interface InsightsPanelProps {
  insights: Insight[]
  /** How many to show before the "see all" link. */
  limit?: number
  /** Where the footer link goes. */
  href?: string
  className?: string
}

export function InsightsPanel({
  insights,
  limit = 3,
  href = '/dashboard/analytics',
  className,
}: InsightsPanelProps) {
  const shown = insights.slice(0, limit)
  const remaining = insights.length - shown.length

  return (
    <Card className={cn('flex flex-col overflow-hidden', className)}>
      {/* ---- cap ----------------------------------------------------------- */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 pt-5 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-info-soft text-info">
            <Sparkles aria-hidden="true" className="size-4" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[0.9375rem] leading-tight font-semibold tracking-[-0.015em] text-foreground">
              What to do next
            </h2>
            <p className="mt-0.5 truncate text-[0.6875rem] text-subtle">
              Ranked by impact, from your own bookings
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[0.6875rem] font-semibold text-muted tabular-nums">
          {insights.length}
        </span>
      </div>

      {/* ---- rows ---------------------------------------------------------- */}
      {shown.length === 0 ? (
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
          stagger={0.07}
          startDelay={0.1}
          className="flex-1 divide-y divide-line-subtle border-t border-line-subtle"
        >
          {shown.map((insight, index) => {
            const look = SEVERITY[insight.severity]
            const Icon = look.icon
            const lead = index === 0

            return (
              <StaggerItem as="li" key={insight.id} direction="up" distance={12}>
                <Link
                  href={insight.href ?? href}
                  className={cn(
                    'group relative block px-5 py-4 transition-colors duration-200',
                    'hover:bg-surface-sunken/60',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-y-4 left-0 w-[3px] rounded-r-full opacity-70 transition-opacity duration-300 group-hover:opacity-100',
                      look.rule,
                    )}
                  />

                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        'mt-px grid size-6 shrink-0 place-items-center rounded-md text-[0.6875rem] font-bold tabular-nums',
                        look.chip,
                      )}
                    >
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-[0.625rem] font-semibold tracking-wide text-subtle uppercase">
                        <Icon aria-hidden="true" className="size-3" strokeWidth={2.25} />
                        {look.label}
                      </p>
                      <p className="mt-1 text-[0.8125rem] leading-snug font-semibold text-balance text-foreground">
                        {insight.title}
                      </p>

                      {insight.impact ? (
                        <p className="mt-2 flex items-baseline gap-1.5">
                          <span
                            className={cn(
                              'font-display leading-none font-semibold tracking-[-0.03em] text-foreground',
                              lead ? 'text-2xl' : 'text-lg',
                            )}
                          >
                            {insight.impact.value}
                            {insight.impact.unit ? (
                              <span className="ml-0.5 text-[0.75rem] font-semibold text-muted">
                                {insight.impact.unit}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-[0.6875rem] text-subtle">{insight.impact.caption}</span>
                        </p>
                      ) : null}

                      {lead && insight.visual ? (
                        <div className="mt-3">
                          <InsightVisualBlock visual={insight.visual} />
                        </div>
                      ) : null}

                      {lead ? (
                        <p className="mt-2.5 text-xs leading-relaxed text-muted">{insight.body}</p>
                      ) : null}

                      <span className="mt-2 inline-flex items-center gap-1 text-[0.6875rem] font-semibold text-primary">
                        {insight.actionLabel ?? 'Open in analytics'}
                        <ArrowRight
                          aria-hidden="true"
                          className="size-3 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5"
                        />
                      </span>
                    </div>
                  </div>
                </Link>
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      )}

      {/* ---- footer -------------------------------------------------------- */}
      <div className="shrink-0 border-t border-line-subtle px-5 py-3">
        <Link
          href={href}
          className={cn(
            'inline-flex min-h-8 items-center gap-1.5 rounded-md text-xs font-semibold text-muted',
            'transition-colors duration-200 hover:text-foreground',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          )}
        >
          {remaining > 0 ? `See all ${insights.length} in Analytics` : 'Open the full analysis'}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}
