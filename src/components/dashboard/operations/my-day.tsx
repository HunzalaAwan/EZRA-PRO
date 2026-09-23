'use client'

import * as React from 'react'
import Link from 'next/link'
import { Anchor, ArrowRight, BadgeCheck, CircleAlert, MapPin, ShieldAlert, Users, Wind } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { GuideDay } from '@/lib/operations'
import { shortOption } from '@/lib/guest-requirements'
import { cn, formatDateLong, formatRelative, formatTime, pluralize } from '@/lib/utils'

/* ==========================================================================
   MY DAY
   What one guide needs for today: their departures in order, where to meet,
   the boat, who is coming, what gear to pull, the notes that matter, and
   their own certifications with anything close to expiry flagged.
   ========================================================================== */

const CRITICAL = /(allerg|asthma|medical|epipen|diabet|pregnan|wheelchair|non-swimmer|nervous|injury|heart)/i

export function MyDay({ guides, nowIso }: { guides: GuideDay[]; nowIso: string }) {
  const withRuns = guides.filter((guide) => guide.runs.length > 0)
  const [guideId, setGuideId] = React.useState((withRuns[0] ?? guides[0])?.id ?? '')
  const guide = guides.find((entry) => entry.id === guideId)
  const now = React.useMemo(() => new Date(nowIso), [nowIso])
  const soon = (iso: string) => new Date(iso).getTime() - now.getTime()

  if (!guide) return <EmptyState icon={Users} title="No guides yet" description="Add bookable crew in Team and assign them to departures." />

  const next = guide.runs.find((run) => new Date(run.endsAt) > now)
  const guests = guide.runs.reduce((sum, run) => sum + run.booked, 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex items-center gap-4">
          <Avatar name={guide.name} src={guide.avatarUrl} size="lg" />
          <div>
            <p className="text-lg font-semibold text-foreground">{guide.name}</p>
            <p className="text-sm text-muted">{guide.title}</p>
            <p className="mt-0.5 text-xs text-subtle">
              {guide.runs.length} {pluralize(guide.runs.length, 'departure')} today · {guests} {pluralize(guests, 'guest')}
            </p>
          </div>
        </div>
        <Select value={guideId} onValueChange={setGuideId}>
          <SelectTrigger className="w-64" aria-label="Guide">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {guides.map((entry) => (
              <SelectItem key={entry.id} value={entry.id} description={`${entry.runs.length} today`}>
                {entry.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        {guide.certifications.map((cert) => {
          const days = Math.round((new Date(`${cert.expires}T12:00:00`).getTime() - now.getTime()) / 86_400_000)
          const warn = days <= 45
          return (
            <span
              key={cert.name}
              className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium', warn ? 'border-warning/50 bg-warning-soft text-warning' : 'border-line bg-surface text-muted')}
            >
              <BadgeCheck className="size-3.5" aria-hidden="true" />
              {cert.name}
              <span className="font-normal">· {warn ? `expires in ${days} days` : `valid to ${formatDateLong(new Date(`${cert.expires}T12:00:00`))}`}</span>
            </span>
          )
        })}
      </div>

      {guide.runs.length === 0 ? (
        <EmptyState icon={Anchor} title="Nothing assigned today" description="Departures assigned to this guide show here, in order." />
      ) : (
        <ol className="flex list-none flex-col gap-3 p-0">
          {guide.runs.map((run) => {
            const isNext = next?.id === run.id
            const done = new Date(run.endsAt) <= now
            return (
              <li key={run.id} className={cn('rounded-2xl border bg-surface p-5', isNext ? 'border-primary shadow-sm' : 'border-line', done && 'opacity-60')}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-4">
                    <div className="w-28 shrink-0">
                      <p className="font-display text-2xl font-semibold whitespace-nowrap tabular-nums">{formatTime(run.startsAt)}</p>
                      <p className="text-xs text-subtle tabular-nums">to {formatTime(run.endsAt)}</p>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-foreground">{run.activityName}</h2>
                        {isNext ? <Badge variant="info" size="sm">{soon(run.startsAt) > 0 ? `Next · ${formatRelative(run.startsAt, now)}` : 'Out now'}</Badge> : null}
                        {done ? <Badge variant="neutral" size="sm">Done</Badge> : null}
                      </div>
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-muted">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-faint" aria-hidden="true" />
                        {run.meetingPoint}
                      </p>
                      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
                        <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden="true" />{run.booked} of {run.capacity} · {run.parties} {pluralize(run.parties, 'party', 'parties')}</span>
                        {run.resources.length > 0 ? <span className="inline-flex items-center gap-1"><Anchor className="size-3.5" aria-hidden="true" />{run.resources.join(', ')}</span> : null}
                        {run.crew.length > 0 ? <span>With {run.crew.join(', ')}</span> : null}
                        {run.weather ? <span className="inline-flex items-center gap-1"><Wind className="size-3.5" aria-hidden="true" />{run.weather.windKts} kt · {run.weather.goConfidence}% go</span> : null}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm" rightIcon={<ArrowRight />}>
                    <Link href="/dashboard/manifest">Manifest & check-in</Link>
                  </Button>
                </div>

                {run.waiversOutstanding > 0 ? (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning">
                    <ShieldAlert className="size-3.5" aria-hidden="true" />
                    {run.waiversOutstanding} {pluralize(run.waiversOutstanding, 'waiver')} still to sign
                  </p>
                ) : null}

                {run.gear.length > 0 ? (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {run.gear.map((line) => (
                      <div key={line.label} className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="w-20 shrink-0 font-medium text-muted">{line.label.replace(/ size.*$/i, '')}</span>
                        {line.counts.map((entry) => (
                          <span key={entry.option} className="rounded-md border border-line px-1.5 py-0.5 tabular-nums">
                            <span className="font-semibold">{shortOption(entry.option)}</span> <span className="text-subtle">×{entry.count}</span>
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}

                {run.notes.length > 0 ? (
                  <ul className="mt-3 flex list-none flex-col gap-1 p-0">
                    {run.notes.slice(0, 5).map((note) => (
                      <li key={note} className={cn('flex items-start gap-1.5 rounded-lg px-2.5 py-1 text-xs', CRITICAL.test(note) ? 'bg-danger-soft font-medium text-danger' : 'bg-surface-sunken text-muted')}>
                        {CRITICAL.test(note) ? <CircleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" /> : null}
                        {note}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
