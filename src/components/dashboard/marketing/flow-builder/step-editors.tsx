'use client'

import * as React from 'react'

import { NumberInput } from '@/components/dashboard/marketing/number-input'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  ASSIGNEE_LABEL,
  BOOKING_WAIT_EVENTS,
  WAIT_EVENT_LABEL,
  WEEKDAY_SHORT,
  canWaitUntilStart,
  knowsBooking,
  newId,
  type FlowPlaceholder,
} from '@/lib/flows/catalog'
import { branchQuestion, describeStep, describeWait, durationLabel } from '@/lib/flows/describe'
import type { ActionStep, BranchStep, Condition, FlowTrigger, SplitStep, StepStats, TriggerSubject, WaitMode, WaitStep } from '@/lib/flows/types'
import { cn } from '@/lib/utils'

import { ConditionBuilder, type ConditionData } from './condition-builder'
import { ChoiceChips, DetailText, DurationInput, PanelSection } from './fields'

export { EmailStepEditor, SmsStepEditor, type EmailTools } from './message-editors'

/* ==========================================================================
   Editors for the steps that are not messages: waits, questions, A/B tests
   and the things an automation can do. Every choice says, in one line,
   what it will mean for the guest.
   ========================================================================== */

/** The one line under a control that says what happens. */
export function Consequence({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-surface-sunken/70 px-3 py-2 text-[0.8125rem] leading-relaxed text-muted">{children}</p>
}

/* ---------- wait ---------- */

const WAIT_MODES: { mode: WaitMode; label: string; help: string }[] = [
  { mode: 'for', label: 'For a set time', help: 'Pause, then carry on. Like “wait 2 days”.' },
  { mode: 'until_time', label: 'Until a time of day', help: 'Lands when people read messages, like 9:00 AM on a weekday.' },
  { mode: 'until_before_start', label: 'Until before the start', help: 'Wait until a set time before their booking begins.' },
  { mode: 'until_event', label: 'Until they do something', help: 'Carry on as soon as they book, click or pay, or after a limit.' },
]

function waitDefaults(mode: WaitMode): Partial<WaitStep> {
  switch (mode) {
    case 'for':
      return { duration: { amount: 2, unit: 'days' } }
    case 'until_time':
      return { time: '09:00', days: [] }
    case 'until_before_start':
      return { duration: { amount: 1, unit: 'days' } }
    case 'until_event':
      return { event: 'booked', timeout: { amount: 3, unit: 'days' } }
  }
}

export function WaitEditor({ step, onChange, trigger }: { step: WaitStep; onChange: (next: WaitStep) => void; trigger: FlowTrigger }) {
  const startAhead = canWaitUntilStart(trigger.type)
  const booking = knowsBooking(trigger)
  const events = (Object.keys(WAIT_EVENT_LABEL) as NonNullable<WaitStep['event']>[]).filter((event) => booking || !BOOKING_WAIT_EVENTS.includes(event))
  const days = step.days ?? []

  return (
    <div className="flex flex-col gap-5">
      <PanelSection title="How long">
        <RadioGroup
          value={step.mode}
          onValueChange={(mode) => onChange({ id: step.id, type: 'wait', mode: mode as WaitMode, ...waitDefaults(mode as WaitMode) })}
          gap="sm"
          aria-label="How long to wait"
        >
          {WAIT_MODES.map((entry) => {
            const off = entry.mode === 'until_before_start' && !startAhead
            return (
              <RadioGroupCard
                key={entry.mode}
                value={entry.mode}
                disabled={off && step.mode !== entry.mode}
                className="p-3"
                label={entry.label}
                description={off ? 'Only for automations that start before the trip or visit.' : entry.help}
              />
            )
          })}
        </RadioGroup>
      </PanelSection>

      <PanelSection title="Details">
        {step.mode === 'for' ? <DurationInput label="Wait" value={step.duration} onChange={(duration) => onChange({ ...step, duration })} min={1} /> : null}

        {step.mode === 'until_before_start' ? <DurationInput label="Until" value={step.duration} onChange={(duration) => onChange({ ...step, duration })} after="before the start" /> : null}

        {step.mode === 'until_time' ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor={`${step.id}-time`} className="text-[0.8125rem] font-medium text-foreground">
                Time
              </label>
              <Input id={`${step.id}-time`} type="time" className="w-36" value={step.time ?? ''} onChange={(event) => onChange({ ...step, time: event.target.value })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[0.8125rem] font-medium text-foreground">On these days</p>
                <div className="flex gap-1">
                  <button type="button" onClick={() => onChange({ ...step, days: [1, 2, 3, 4, 5] })} className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    Weekdays
                  </button>
                  <button type="button" onClick={() => onChange({ ...step, days: [] })} className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    Any day
                  </button>
                </div>
              </div>
              <ChoiceChips label="Days" options={WEEKDAY_SHORT.map((label, value) => ({ value, label }))} value={days} onChange={(next) => onChange({ ...step, days: [...next].sort() })} />
              <p className="text-xs text-subtle">{days.length === 0 || days.length === 7 ? 'Any day of the week.' : 'Skips to the next of these days.'}</p>
            </div>
          </div>
        ) : null}

        {step.mode === 'until_event' ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.8125rem] text-muted">Wait for them</span>
              <Select value={step.event ?? 'booked'} onValueChange={(event) => onChange({ ...step, event: event as WaitStep['event'] })}>
                <SelectTrigger aria-label="What they do" className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {events.map((event) => (
                    <SelectItem key={event} value={event}>
                      {WAIT_EVENT_LABEL[event]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-[0.8125rem] font-medium text-foreground">If they don’t, carry on after</p>
              <DurationInput label="Give up after" value={step.timeout} onChange={(timeout) => onChange({ ...step, timeout })} min={1} />
            </div>
          </div>
        ) : null}

        <Consequence>
          {describeWait(step)}. {describeStep(step).detail}.
        </Consequence>
      </PanelSection>
    </div>
  )
}

/* ---------- if / else ---------- */

type QuickQuestion = { label: string; conditions: Omit<Condition, 'id'>[]; booking?: boolean }

const QUICK_QUESTIONS: QuickQuestion[] = [
  { label: 'Did they book?', conditions: [{ field: 'flow.booked', op: 'yes' }] },
  { label: 'Did they open it?', conditions: [{ field: 'flow.opened', op: 'yes' }] },
  { label: 'Did they click?', conditions: [{ field: 'flow.clicked', op: 'yes' }] },
  { label: 'Do they still owe money?', conditions: [{ field: 'booking.balanceDue', op: 'at_least', value: 1 }], booking: true },
  { label: 'Waivers still to sign?', conditions: [{ field: 'booking.waiversMissing', op: 'yes' }], booking: true },
  { label: 'A group of 6 or more?', conditions: [{ field: 'booking.partySize', op: 'at_least', value: 6 }], booking: true },
]

export function BranchEditor({
  step,
  onChange,
  subjects,
  data,
  stats,
}: {
  step: BranchStep
  onChange: (next: BranchStep) => void
  subjects: TriggerSubject[]
  data: ConditionData
  stats?: StepStats
}) {
  const booking = subjects.includes('booking')
  const quick = QUICK_QUESTIONS.filter((entry) => booking || !entry.booking)
  const auto = branchQuestion({ ...step, label: '' })
  // The common question these checks already are, if any, so its chip reads as chosen.
  const same = (entry: QuickQuestion) =>
    entry.conditions.length === step.when.conditions.length &&
    entry.conditions.every((c, i) => {
      const own = step.when.conditions[i]
      return own.field === c.field && own.op === c.op && JSON.stringify(own.value ?? null) === JSON.stringify(c.value ?? null)
    })

  return (
    <div className="flex flex-col gap-5">
      <PanelSection title="Start from a common question" hint="Picking one replaces the checks below.">
        <div className="flex flex-wrap gap-1.5">
          {quick.map((entry) => (
            <button
              key={entry.label}
              type="button"
              aria-pressed={same(entry)}
              onClick={() => onChange({ ...step, label: '', when: { match: 'all', conditions: entry.conditions.map((c) => ({ ...c, id: newId('cond') })) } })}
              className={cn(
                'h-8 rounded-lg border px-2.5 text-[0.8125rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                same(entry) ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:border-primary/50 hover:text-foreground',
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="What it checks" hint="Guests who match go down Yes. Everyone else goes down No.">
        <ConditionBuilder value={step.when} onChange={(when) => onChange({ ...step, when })} subject={subjects} where="branch" data={data} emptyText="Nothing to check yet. Add a check, or pick a common question above." />
      </PanelSection>

      <PanelSection title="Question on the card" hint="Leave it empty and we write it from the checks.">
        <Input value={step.label ?? ''} placeholder={auto} onChange={(event) => onChange({ ...step, label: event.target.value })} aria-label="Question on the card" />
      </PanelSection>

      <Consequence>
        {step.yes.length === 0 && step.no.length === 0
          ? 'Add steps under Yes and No on the canvas. Both sides carry on with the steps after this question.'
          : `${step.yes.length} ${step.yes.length === 1 ? 'step' : 'steps'} if yes, ${step.no.length} if no. Both sides then carry on with the steps after this question.`}
        {stats && stats.reached > 0 ? ` In the last 60 days ${stats.yes ?? 0} went Yes and ${stats.no ?? 0} went No.` : ''}
      </Consequence>
    </div>
  )
}

/* ---------- a/b test ---------- */

export function SplitEditor({ step, onChange, stats }: { step: SplitStep; onChange: (next: SplitStep) => void; stats?: StepStats }) {
  const a = Math.min(99, Math.max(1, Math.round(step.percentA)))
  return (
    <div className="flex flex-col gap-5">
      <PanelSection title="How guests are shared" hint="Each guest is put on one side at random and stays there.">
        <div className="flex items-center gap-4">
          <span className="w-14 text-sm font-medium text-foreground tabular">A {a}%</span>
          <Slider min={1} max={99} step={1} value={[a]} onValueChange={([value]) => onChange({ ...step, percentA: value })} thumbLabels={['Share on path A']} className="flex-1" />
          <span className="w-14 text-right text-sm font-medium text-foreground tabular">B {100 - a}%</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {[50, 80, 90].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange({ ...step, percentA: value })}
              aria-pressed={a === value}
              className={cn('h-8 rounded-lg border px-2.5 text-[0.8125rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary', a === value ? 'border-primary bg-primary-soft text-primary' : 'border-line text-muted hover:text-foreground')}
            >
              {value} / {100 - value}
            </button>
          ))}
        </div>
      </PanelSection>
      <Consequence>
        Put a different message on each side. After a few weeks, keep the side that brings more bookings.
        {stats && stats.reached > 0 ? ` So far ${stats.yes ?? 0} went down A and ${stats.no ?? 0} down B.` : ''}
      </Consequence>
    </div>
  )
}

/* ---------- actions ---------- */

const ASSIGNEES = Object.keys(ASSIGNEE_LABEL) as NonNullable<ActionStep['assignee']>[]

export function ActionEditor({
  step,
  onChange,
  placeholders,
  tags,
}: {
  step: ActionStep
  onChange: (next: ActionStep) => void
  placeholders: FlowPlaceholder[]
  tags: string[]
}) {
  switch (step.action) {
    case 'add_tag':
    case 'remove_tag': {
      const tag = step.tag ?? ''
      const add = step.action === 'add_tag'
      return (
        <div className="flex flex-col gap-5">
          <PanelSection title={add ? 'Tag to add' : 'Tag to remove'}>
            <Input value={tag} placeholder="Group leader" onChange={(event) => onChange({ ...step, tag: event.target.value })} aria-label="Tag" aria-invalid={!tag.trim() || undefined} />
            {tags.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-subtle">Tags you already use</p>
                <ChoiceChips label="Existing tags" single options={tags.slice(0, 16).map((value) => ({ value, label: value }))} value={tag ? [tag] : []} onChange={([value]) => onChange({ ...step, tag: value ?? '' })} />
              </div>
            ) : null}
          </PanelSection>
          <Consequence>
            {tag.trim()
              ? add
                ? `“${tag.trim()}” shows on their guest record, and you can find everyone with it in Guests and Audiences.`
                : `“${tag.trim()}” comes off their guest record, if they have it.`
              : 'Type a tag or pick one you already use.'}
          </Consequence>
        </div>
      )
    }
    case 'give_code': {
      const code = step.code ?? { percent: 10, validDays: 14, prefix: 'THANKS' }
      const set = (patch: Partial<typeof code>) => onChange({ ...step, code: { ...code, ...patch } })
      const sample = `${(code.prefix || 'CODE').toUpperCase()}-7QK2`
      return (
        <div className="flex flex-col gap-5">
          <PanelSection title="The discount">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${step.id}-pct`} className="text-[0.8125rem] font-medium">
                  Takes off
                </label>
                <NumberInput
                  id={`${step.id}-pct`}
                  min={1}
                  max={100}
                  suffix="%"
                  value={Number.isFinite(code.percent) && code.percent > 0 ? code.percent : 10}
                  onValueChange={(percent) => set({ percent })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${step.id}-days`} className="text-[0.8125rem] font-medium">
                  Good for
                </label>
                <NumberInput
                  id={`${step.id}-days`}
                  min={1}
                  max={365}
                  suffix="days"
                  value={Number.isFinite(code.validDays) && code.validDays > 0 ? code.validDays : 14}
                  onValueChange={(validDays) => set({ validDays })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`${step.id}-prefix`} className="text-[0.8125rem] font-medium">
                Starts with
              </label>
              <Input
                id={`${step.id}-prefix`}
                className="font-mono"
                maxLength={12}
                value={code.prefix}
                onChange={(event) => set({ prefix: event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
              />
            </div>
          </PanelSection>
          <Consequence>
            Each guest gets their own code, like <span className="font-mono text-foreground">{sample}</span>, so it can’t be shared around. Add “Discount code” to a message after this step to send it.
          </Consequence>
        </div>
      )
    }
    case 'notify_team':
    case 'create_task': {
      const task = step.action === 'create_task'
      return (
        <div className="flex flex-col gap-5">
          <PanelSection title={task ? 'The to-do' : 'The heads-up'}>
            <div className="flex flex-col gap-1.5">
              <p className="text-[0.8125rem] font-medium text-foreground">{task ? 'For' : 'Who hears'}</p>
              <Select value={step.assignee ?? (task ? 'owner' : 'managers')} onValueChange={(assignee) => onChange({ ...step, assignee: assignee as ActionStep['assignee'] })}>
                <SelectTrigger aria-label={task ? 'Who it is for' : 'Who hears'}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSIGNEES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {ASSIGNEE_LABEL[value][0].toUpperCase() + ASSIGNEE_LABEL[value].slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DetailText label={task ? 'What to do' : 'Message'} multiline rows={3} value={step.message ?? ''} onChange={(message) => onChange({ ...step, message })} placeholders={placeholders} invalid={!step.message?.trim()} />
            {task ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-[0.8125rem] font-medium text-foreground">Due within</p>
                <DurationInput label="Due within" value={step.due} onChange={(due) => onChange({ ...step, due })} units={['hours', 'days']} min={1} />
              </div>
            ) : null}
          </PanelSection>
          <Consequence>
            {task
              ? `A to-do lands on the list of ${ASSIGNEE_LABEL[step.assignee ?? 'owner']}${step.due && step.due.amount > 0 ? `, due within ${durationLabel(step.due)}` : ''}. Guests don’t see it.`
              : `${ASSIGNEE_LABEL[step.assignee ?? 'managers'][0].toUpperCase() + ASSIGNEE_LABEL[step.assignee ?? 'managers'].slice(1)} get a notification in the app and by email. Guests don’t see it.`}
          </Consequence>
        </div>
      )
    }
    case 'add_note':
      return (
        <div className="flex flex-col gap-5">
          <PanelSection title="The note">
            <DetailText label="Note" multiline rows={3} value={step.message ?? ''} onChange={(message) => onChange({ ...step, message })} placeholders={placeholders} invalid={!step.message?.trim()} />
          </PanelSection>
          <Consequence>Shows on their guest record for your team. Guests don’t see it.</Consequence>
        </div>
      )
    case 'unsubscribe':
      return <Consequence>They stop getting marketing emails and texts from every automation and campaign. Booking messages, like reminders, still go.</Consequence>
  }
}

export function EndEditor() {
  return <Consequence>Guests who get here leave the automation. Nothing after this point runs for them.</Consequence>
}
