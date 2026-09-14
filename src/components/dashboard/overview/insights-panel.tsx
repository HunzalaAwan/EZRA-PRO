'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  OctagonAlert,
  SendHorizontal,
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
import { toast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import type { Insight } from '@/types'

/* ==========================================================================
   InsightsPanel — the differentiator.

   FareHarbor and Peek show you numbers. This panel reads them. Every row is
   computed from the operator's own departures, so the job is to make the
   conclusion legible in about a second:

     1. a severity-tinted rank badge, so the list reads as a priority order
     2. the ONE number that matters, at display size
     3. a small chart that shows the comparison rather than narrating it
     4. one line of prose saying what to actually do
     5. the action

   The numbers used to live inside a three-sentence paragraph, which meant
   reading every row to find the one worth acting on. Everything above the
   prose is now scannable without reading a full sentence.
   ========================================================================== */

interface SeverityLook {
  icon: LucideIcon
  /** Tinted medallion behind the rank. */
  chip: string
  /** Accent hairline down the left edge. */
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
          <span
            aria-hidden="true"
            className="relative grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft"
          >
            <span className="absolute inset-0 rounded-full ring-2 ring-primary/25 motion-safe:animate-pulse-ring" />
            <span className="size-4 rounded-full bg-primary motion-safe:animate-float" />
            <Sparkles className="absolute size-3 text-on-primary" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[0.9375rem] leading-tight font-semibold tracking-[-0.015em] text-foreground">
              What to do next
            </h2>
            <p className="mt-0.5 truncate text-[0.6875rem] text-subtle">
              Ranked by impact · EZRA Intelligence
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
          {insights.map((insight, index) => {
            const look = SEVERITY[insight.severity]
            const Icon = look.icon

            return (
              <StaggerItem as="li" key={insight.id} direction="right" distance={16}>
                <Link
                  href={insight.href ?? href}
                  className={cn(
                    'group relative block px-5 py-4 transition-colors duration-200',
                    'hover:bg-surface/60',
                    'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
                  )}
                >
                  {/* Severity hairline — always on, so priority reads down the edge. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      'absolute inset-y-3 left-0 w-[3px] rounded-full opacity-55 transition-opacity duration-300',
                      'group-hover:opacity-100',
                      look.rule,
                    )}
                  />

                  {/* ---- rank + severity + title ---------------------------- */}
                  <div className="flex items-start gap-2.5">
                    <span
                      className={cn(
                        'mt-px grid size-6 shrink-0 place-items-center rounded-lg text-[0.6875rem] font-bold tabular-nums ring-1 ring-inset',
                        look.chip,
                      )}
                    >
                      {index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <span className="inline-flex items-center gap-1 text-[0.625rem] font-semibold tracking-wide uppercase opacity-80">
                        <Icon aria-hidden="true" className="size-3" strokeWidth={2.25} />
                        {look.label}
                      </span>
                      <p className="mt-1 text-[0.8125rem] leading-snug font-semibold text-balance text-foreground">
                        {insight.title}
                      </p>
                    </div>
                  </div>

                  {/* ---- the one number ------------------------------------- */}
                  {insight.impact ? (
                    <div className="mt-2.5 pl-[2.125rem]">
                      <p className="flex items-baseline gap-1">
                        <span className="font-display text-2xl leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums">
                          {insight.impact.value}
                        </span>
                        {insight.impact.unit ? (
                          <span className="text-[0.8125rem] font-semibold text-muted">
                            {insight.impact.unit}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 text-[0.6875rem] leading-snug text-subtle">
                        {insight.impact.caption}
                      </p>
                    </div>
                  ) : null}

                  {/* ---- the picture ---------------------------------------- */}
                  {insight.visual ? (
                    <div className="mt-3 pl-[2.125rem]">
                      <InsightVisualBlock visual={insight.visual} />
                    </div>
                  ) : null}

                  {/* ---- what to do ----------------------------------------- */}
                  <p className="mt-2.5 pl-[2.125rem] text-xs leading-relaxed text-muted">
                    {insight.body}
                  </p>

                  <span className="mt-2 inline-flex items-center gap-1 pl-[2.125rem] text-[0.6875rem] font-semibold text-primary">
                    {insight.actionLabel ?? 'Open in analytics'}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </StaggerItem>
            )
          })}
        </StaggerGroup>
      )}

      {/* ---- footer: ask it something ----------------------------------- */}
      <AskFooter href={href} />
    </Card>
  )
}

/* --------------------------------------------------------------------------
   AskFooter — the panel answers questions, so it invites one.
   The suggestions are the questions the six insights above already answer;
   picking one is a shortcut, not a search. Free-text is a demo affordance.
   -------------------------------------------------------------------------- */

const SUGGESTIONS = [
  'Which day should I add a departure?',
  'Why is Tuesday soft?',
  'What is cancelling most?',
] as const

function AskFooter({ href }: { href: string }) {
  const [question, setQuestion] = React.useState('')

  function ask(text: string) {
    const q = text.trim()
    if (!q) return
    toast('EZRA Intelligence', {
      description: `"${q}" — the six insights above are its current answers. Open the full analysis for the rest.`,
    })
    setQuestion('')
  }

  return (
    <div className="shrink-0 border-t border-line-subtle px-4 pt-3 pb-4">
      <div className="flex items-center justify-between gap-3 px-1">
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

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => ask(s)}
            className={cn(
              'rounded-full border border-line bg-surface px-2.5 py-1 text-[0.6875rem] font-medium text-muted',
              'transition-all duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-px hover:border-primary/40 hover:text-foreground',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          ask(question)
        }}
        className={cn(
          'mt-2.5 flex items-center gap-2 rounded-xl border border-line bg-surface py-1.5 pr-1.5 pl-3 shadow-xs',
          'transition-colors focus-within:border-primary/50',
        )}
      >
        <Sparkles aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about your numbers…"
          aria-label="Ask EZRA Intelligence a question"
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground placeholder:text-faint focus:outline-hidden"
        />
        <button
          type="submit"
          aria-label="Send question"
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-lg bg-foreground text-background',
            'transition-transform duration-200 ease-[var(--ease-out-expo)] hover:scale-105 active:scale-95',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          )}
        >
          <SendHorizontal aria-hidden="true" className="size-3.5" />
        </button>
      </form>
    </div>
  )
}
