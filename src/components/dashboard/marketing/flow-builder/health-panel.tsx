'use client'

import * as React from 'react'
import { ArrowRight, CircleAlert, CircleCheck, ExternalLink, Lightbulb, TriangleAlert, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { FlowIssue } from '@/lib/flows/types'
import { cn } from '@/lib/utils'

/* ==========================================================================
   The health check: what stops an automation going live (blockers), what
   is worth a look (warnings) and what would make it work better (tips).
   Each line can jump to its step, and most can be fixed in one click.
   ========================================================================== */

const GROUPS: { severity: FlowIssue['severity']; title: string; hint: string }[] = [
  { severity: 'blocker', title: 'Fix before turning it on', hint: 'Something would break or reach the wrong people.' },
  { severity: 'warning', title: 'Worth a look', hint: 'It can go live, but check these first.' },
  { severity: 'tip', title: 'Ideas to make it work better', hint: 'Optional.' },
]

const ICON: Record<FlowIssue['severity'], React.ComponentType<{ className?: string }>> = {
  blocker: CircleAlert,
  warning: TriangleAlert,
  tip: Lightbulb,
}

/** Issues whose answer lives on another page. */
const LINKS: Record<string, { label: string; href: string }> = {
  'sms-number': { label: 'Set up your own number', href: '/dashboard/settings/channels' },
  'marketing-paused': { label: 'Open Marketing settings', href: '/dashboard/marketing/settings' },
}

const linkFor = (issue: FlowIssue) => LINKS[issue.id.split(':')[0]]

const TONE: Record<FlowIssue['severity'], string> = {
  blocker: 'text-danger',
  warning: 'text-warning',
  tip: 'text-subtle',
}

export function HealthPanel({
  issues,
  onFix,
  onGoTo,
  goLabel,
}: {
  issues: FlowIssue[]
  onFix: (issue: FlowIssue) => void
  /** Show the step or card an issue is about. */
  onGoTo: (issue: FlowIssue) => void
  /** Names the card an issue without a step points at ("Who can enter"), or null when there is nowhere to go. */
  goLabel: (issue: FlowIssue) => string | null
}) {
  const blockers = issues.filter((issue) => issue.severity === 'blocker').length

  return (
    <div className="flex flex-col gap-6">
      <div className={cn('flex items-start gap-3 rounded-xl border p-3.5', blockers > 0 ? 'border-danger/30 bg-danger-soft/50' : 'border-success/30 bg-success-soft/50')}>
        {blockers > 0 ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" /> : <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />}
        <div>
          <p className="text-sm font-medium text-foreground">
            {blockers > 0 ? `${blockers} ${blockers === 1 ? 'thing stops' : 'things stop'} this from going live` : 'Ready to turn on'}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {blockers > 0 ? '“Turn on” unlocks as soon as these are fixed.' : issues.length > 0 ? 'Nothing blocks it. The notes below are worth a minute.' : 'Nothing to fix, and no notes.'}
          </p>
        </div>
      </div>

      {GROUPS.map((group) => {
        const list = issues.filter((issue) => issue.severity === group.severity)
        if (list.length === 0) return null
        const Icon = ICON[group.severity]
        return (
          <section key={group.severity} className="flex flex-col gap-2.5" aria-label={group.title}>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                {group.title} <span className="font-normal text-subtle tabular">· {list.length}</span>
              </h3>
              <p className="text-xs text-subtle">{group.hint}</p>
            </div>
            <ul className="flex list-none flex-col gap-2 p-0">
              {list.map((issue) => {
                const go = goLabel(issue)
                const link = linkFor(issue)
                return (
                  <li key={issue.id} className="flex gap-3 rounded-xl border border-line bg-surface p-3">
                    <Icon className={cn('mt-0.5 size-4 shrink-0', TONE[issue.severity])} aria-hidden="true" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <p className="text-[0.8125rem] leading-relaxed text-foreground">{issue.text}</p>
                      {issue.fix || go || link ? (
                        <div className="flex flex-wrap gap-1.5">
                          {issue.fix ? (
                            <Button size="xs" variant={issue.severity === 'blocker' ? 'primary' : 'secondary'} leftIcon={<Wrench />} onClick={() => onFix(issue)}>
                              {issue.fix.label}
                            </Button>
                          ) : null}
                          {go ? (
                            <Button size="xs" variant="ghost" rightIcon={<ArrowRight />} onClick={() => onGoTo(issue)}>
                              {go}
                            </Button>
                          ) : null}
                          {link ? (
                            <Button asChild size="xs" variant="ghost" rightIcon={<ExternalLink />}>
                              <a href={link.href} target="_blank" rel="noreferrer">
                                {link.label}
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
