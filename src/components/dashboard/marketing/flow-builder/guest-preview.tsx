'use client'

import * as React from 'react'
import { ArrowLeft, Mail, MessageSquare, Search, UserRound } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmailFrame } from '@/components/dashboard/marketing/email-designer'
import { findGuests, runFlow, type FlowExtras } from '@/lib/actions/flows'
import { findStep, forSimulation } from '@/lib/flows/tree'
import type { Flow, GuestJourney, JourneyEvent } from '@/lib/flows/types'
import { designFromText, fill, type EmailContext } from '@/lib/email-design'
import { PLACEHOLDERS } from '@/lib/messaging'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Preview as a guest: pick a real guest and see what this automation would
   do for them, step by step, from their own bookings: when they enter,
   each wait, the messages with their details filled in, and where they
   leave. Opens and clicks are the simulator's estimates.
   ========================================================================== */

type Guest = { id: string; name: string; email: string; lastTrip?: string }

const STATE_LABEL: Record<GuestJourney['state'], string> = {
  waiting: 'In it now',
  finished: 'Went all the way through',
  exited: 'Left early',
  skipped: 'Wouldn’t enter',
  holdout: 'Kept out to measure it',
}

const DOT: Partial<Record<JourneyEvent['kind'], string>> = {
  entered: 'bg-foreground',
  sent: 'bg-primary',
  booked: 'bg-success',
  finished: 'bg-success',
  exited: 'bg-warning',
  skipped: 'bg-warning',
  branched: 'bg-info',
  split: 'bg-info',
  action: 'bg-foreground',
}

/** Details that belong to one booking: never borrowed from the sample booking for a real guest. */
const BOOKING_DETAILS = ['activity', 'date', 'time', 'meeting_point', 'party', 'reference', 'balance', 'manage_link']
const DETAIL_LABEL = new Map(PLACEHOLDERS.map((p) => [p.token.slice(1, -1), p.label]))

const when = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function fmt(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : when.format(d)
}

export function GuestPreview({
  tenantId,
  flow,
  flowKey,
  extras,
  nowIso,
  ctx,
  brand,
  onGoTo,
}: {
  tenantId: string
  flow: Flow
  /** Changes only when something the replay reads changes (not the name or the description). */
  flowKey: string
  extras: FlowExtras
  nowIso: string
  ctx: EmailContext
  brand: string[]
  onGoTo: (stepId: string) => void
}) {
  const [query, setQuery] = React.useState('')
  const [guests, setGuests] = React.useState<Guest[] | null>(null)
  const [guest, setGuest] = React.useState<Guest | null>(null)
  const [journey, setJourney] = React.useState<GuestJourney | null | undefined>(undefined)
  const [shown, setShown] = React.useState<string | null>(null)

  // The guest list, after a short pause in typing.
  React.useEffect(() => {
    let live = true
    const timer = window.setTimeout(() => {
      findGuests(tenantId, query)
        .then((list) => live && setGuests(list))
        .catch(() => live && setGuests([]))
    }, query ? 250 : 0)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [tenantId, query])

  // Their journey, again whenever what the replay reads changes. The latest flow comes from a ref,
  // so typing a name or a description doesn't send another request.
  const flowRef = React.useRef(flow)
  flowRef.current = flow
  React.useEffect(() => {
    if (!guest) return
    let live = true
    const timer = window.setTimeout(() => {
      runFlow(tenantId, forSimulation(flowRef.current), extras, guest.id)
        .then((run) => live && setJourney(run.journeys.find((entry) => entry.guestId === guest.id) ?? null))
        .catch(() => live && setJourney(null))
    }, 400)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [tenantId, flowKey, extras, guest])

  if (!guest) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[0.8125rem] leading-relaxed text-muted">Pick a guest to see what this automation would do for them, from their own bookings.</p>
        <Input leftIcon={<Search />} placeholder="Search by name or email" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search guests" autoFocus />
        {guests === null ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((n) => (
              <Skeleton key={n} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : guests.length === 0 ? (
          <p className="text-sm text-subtle">No guests match “{query}”.</p>
        ) : (
          <ul className="flex list-none flex-col gap-1.5 p-0">
            {!query ? <li className="text-xs font-medium text-subtle">Guests who booked most recently</li> : null}
            {guests.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    setGuest(entry)
                    setJourney(undefined)
                    setShown(null)
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-line-strong focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-primary/25"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-sunken text-subtle">
                    <UserRound className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">{entry.name}</span>
                    <span className="block truncate text-xs text-subtle">{entry.lastTrip ?? entry.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  const firstName = guest.name.split(' ')[0] ?? guest.name
  // Their own booking's details where the replay knows them; anything else reads as its label ("[Meeting point]").
  const own: Record<string, string> = {}
  for (const key of BOOKING_DETAILS) own[key] = journey?.vars?.[key] ?? `[${DETAIL_LABEL.get(key) ?? key.replace(/_/g, ' ')}]`
  const guestCtx: EmailContext = {
    ...ctx,
    vars: {
      ...ctx.vars,
      ...own,
      ...journey?.vars,
      first_name: firstName,
      ...(journey?.activityName ? { activity: journey.activityName } : {}),
      ...(journey?.reference ? { reference: journey.reference } : {}),
    },
  }
  const events = journey?.events ?? []
  const nowMs = new Date(nowIso).getTime()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Button size="xs" variant="ghost" leftIcon={<ArrowLeft />} onClick={() => setGuest(null)}>
          Other guest
        </Button>
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-sunken/50 p-3.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-subtle">
          <UserRound className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{guest.name}</p>
          <p className="truncate text-xs text-subtle">{journey?.activityName ? `${journey.activityName}${journey.reference ? ` · ${journey.reference}` : ''}` : (guest.lastTrip ?? guest.email)}</p>
          {journey ? (
            <p className={cn('mt-1.5 text-[0.8125rem] font-medium', journey.state === 'skipped' || journey.state === 'holdout' ? 'text-warning' : 'text-foreground')}>
              {STATE_LABEL[journey.state]}
              {journey.reason && journey.state !== 'holdout' ? <span className="font-normal text-muted">: {journey.reason.replace(/^Left: /, '')}</span> : null}
            </p>
          ) : null}
        </div>
      </div>

      {journey === undefined ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-10 rounded-lg" />
          ))}
        </div>
      ) : journey === null ? (
        <p className="text-sm text-subtle">We couldn’t work out a journey for this guest. Try another one.</p>
      ) : journey.state === 'skipped' && events.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3.5 py-3 text-[0.8125rem] leading-relaxed text-muted">
          This guest wouldn’t enter{journey.reason ? `: ${journey.reason.charAt(0).toLowerCase()}${journey.reason.slice(1)}` : ''}.
        </p>
      ) : (
        <ol className="relative flex list-none flex-col p-0" aria-label={`What happens for ${guest.name}`}>
          {events.map((event, index) => {
            const later = new Date(event.at).getTime() > nowMs || event.kind === 'scheduled'
            const step = event.stepId ? findStep(flow.steps, event.stepId) : undefined
            const message = step && (step.type === 'email' || step.type === 'sms') && (event.kind === 'sent' || event.kind === 'scheduled') ? step : undefined
            const key = `${event.at}-${index}`
            const open = shown === key
            const estimate = event.kind === 'opened' || event.kind === 'clicked'
            return (
              <li key={key} className="relative flex gap-3 pb-4 last:pb-0">
                {index < events.length - 1 ? <span aria-hidden="true" className="absolute top-3 bottom-0 left-[0.3125rem] w-px bg-line" /> : null}
                <span
                  aria-hidden="true"
                  className={cn('relative mt-1.5 size-2.5 shrink-0 rounded-full', later ? 'border border-primary bg-surface' : (DOT[event.kind] ?? 'bg-line-strong'))}
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-xs text-subtle tabular">
                    {fmt(event.at)}
                    {later ? <span className="ml-1.5 font-medium text-primary">Planned</span> : null}
                    {estimate ? <span className="ml-1.5">est.</span> : null}
                  </p>
                  <p className="text-[0.8125rem] leading-relaxed text-foreground">{event.text}</p>
                  <div className="flex flex-wrap gap-1">
                    {message ? (
                      <button type="button" onClick={() => setShown(open ? null : key)} aria-expanded={open} className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary">
                        {message.type === 'email' ? <Mail className="size-3.5" aria-hidden="true" /> : <MessageSquare className="size-3.5" aria-hidden="true" />}
                        {open ? 'Hide the message' : 'See the message'}
                      </button>
                    ) : null}
                    {step ? (
                      <button type="button" onClick={() => onGoTo(step.id)} className="inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-muted hover:bg-surface-sunken hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
                        Go to step
                      </button>
                    ) : null}
                  </div>
                  {open && message ? <MessagePreview step={message} ctx={guestCtx} brand={brand} marketing={flow.purpose === 'marketing'} /> : null}
                </div>
              </li>
            )
          })}
        </ol>
      )}
      <p className="text-xs leading-relaxed text-subtle">Replayed on this guest’s real bookings. Opens and clicks are estimates.</p>
    </div>
  )
}

function MessagePreview({ step, ctx, brand, marketing }: { step: Extract<Flow['steps'][number], { type: 'email' | 'sms' }>; ctx: EmailContext; brand: string[]; marketing: boolean }) {
  if (step.type === 'sms') {
    return (
      <p className="mt-1 max-w-[18rem] rounded-2xl rounded-bl-md border border-line-subtle bg-surface-sunken px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line">
        {fill(step.body, ctx.vars).trim()}
        {marketing ? ' Reply STOP to opt out.' : ''}
      </p>
    )
  }
  const design = step.design ?? designFromText(step.subject, step.body, brand[0] ?? '#601CEF')
  return (
    <div className="mt-1 overflow-hidden rounded-xl border border-line">
      <div className="border-b border-line-subtle bg-surface px-3 py-2">
        <p className="truncate text-[0.8125rem] font-medium text-foreground">{fill(step.subject, ctx.vars)}</p>
        {step.preheader ? <p className="truncate text-xs text-subtle">{fill(step.preheader, ctx.vars)}</p> : null}
      </div>
      <div style={{ background: design.theme.background }}>
        <EmailFrame design={design} ctx={ctx} preheader={step.preheader} width={600} scale={0.55} className="mx-auto" />
      </div>
    </div>
  )
}
