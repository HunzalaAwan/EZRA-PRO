'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, Copy, DoorOpen, Settings2, Stethoscope, Trash2, UserRound, Users, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { PURPOSE_HELP, PURPOSE_LABEL, exitFor, knowsBooking, mustBeMarketing, paletteItem, placeholdersForFlow, settingsFor, subjectsOf, triggerMeta } from '@/lib/flows/catalog'
import { describeStep, describeWho, type DescribeLookups } from '@/lib/flows/describe'
import { findStep, locateStep, updateStep } from '@/lib/flows/tree'
import type { Flow, FlowPurpose, FlowRun, FlowSettings, FlowStep } from '@/lib/flows/types'
import { cn } from '@/lib/utils'

import type { Selection } from './canvas'
import { ConditionBuilder, type ConditionData } from './condition-builder'
import { PanelSection } from './fields'
import { FlowIcon, iconTone, stepIconName } from './icons'
import { ExitEditor, SettingsPanel, type MarketingRules } from './settings-panel'
import { ActionEditor, BranchEditor, Consequence, EmailStepEditor, EndEditor, SmsStepEditor, SplitEditor, WaitEditor, type EmailTools } from './step-editors'
import { TriggerPicker } from './trigger-picker'

/* ==========================================================================
   The inspector: the panel beside the canvas (a bottom sheet on phones)
   with plain controls for whatever is selected — the start, who can
   enter, a step, what ends it early, or the settings.
   ========================================================================== */

export interface InspectorTools {
  flow: Flow
  /** A change from a control. `key` merges quick edits to one field into one undo. */
  update: (next: Flow, key?: string) => void
  run: FlowRun | null
  data: ConditionData
  lookups: DescribeLookups
  audiences: { id: string; name: string }[]
  email: EmailTools
  /** The business's own texting number is set up (texts go from the shared number until then). */
  hasSmsNumber: boolean
  rules: MarketingRules
  onDeleteFlow?: () => void
}

export interface PanelHead {
  eyebrow: string
  title: string
  icon: React.ReactNode
  tone: string
}

/** The heading for whatever the panel shows. */
export function panelHead(selection: Selection, flow: Flow, lookups: DescribeLookups): PanelHead | null {
  if (!selection) return null
  switch (selection.kind) {
    case 'trigger':
      return { eyebrow: 'Starts when', title: triggerMeta(flow.trigger.type).short, icon: <FlowIcon name={triggerMeta(flow.trigger.type).icon} />, tone: iconTone('trigger') }
    case 'who':
      return { eyebrow: 'Who can enter', title: PURPOSE_LABEL[flow.purpose], icon: <Users className="size-4" aria-hidden="true" />, tone: iconTone('who') }
    case 'exit':
      return { eyebrow: 'Ends early when', title: 'Leaving early', icon: <DoorOpen className="size-4" aria-hidden="true" />, tone: iconTone('exit') }
    case 'settings':
      return { eyebrow: 'Automation', title: 'More settings', icon: <Settings2 className="size-4" aria-hidden="true" />, tone: iconTone('exit') }
    case 'health':
      return { eyebrow: 'Before it goes live', title: 'Health check', icon: <Stethoscope className="size-4" aria-hidden="true" />, tone: iconTone('exit') }
    case 'preview':
      return { eyebrow: 'Try it', title: 'Preview as a guest', icon: <UserRound className="size-4" aria-hidden="true" />, tone: iconTone('exit') }
    case 'step': {
      const step = findStep(flow.steps, selection.id)
      if (!step) return null
      const item = paletteItem(step.type === 'action' ? { type: 'action', action: step.action } : step)
      return { eyebrow: step.type === 'branch' ? 'If / else' : item.label, title: describeStep(step, lookups).title, icon: <FlowIcon name={stepIconName(step)} />, tone: iconTone(step.type) }
    }
  }
}

/** The frame every panel shares: icon, eyebrow and title, actions, and the scrolling body. */
export function PanelFrame({ head, actions, onClose, children, footer }: { head: PanelHead; actions?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-start gap-3 border-b border-line-subtle px-5 py-4">
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', head.tone)}>{head.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-subtle">{head.eyebrow}</p>
          <h2 className="truncate text-[0.9375rem] font-semibold text-foreground">{head.title}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {actions}
          <SimpleTooltip label="Close panel">
            <IconButton size="sm" variant="ghost" aria-label="Close panel" onClick={onClose}>
              <X />
            </IconButton>
          </SimpleTooltip>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
      {footer ? <div className="shrink-0 border-t border-line-subtle px-5 py-3">{footer}</div> : null}
    </div>
  )
}

/** Move, copy and remove for the selected step. */
export function StepActions({ flow, stepId, onMove, onDuplicate, onRemove }: { flow: Flow; stepId: string; onMove: (dir: -1 | 1) => void; onDuplicate: () => void; onRemove: () => void }) {
  const at = locateStep(flow.steps, stepId)
  const parent = at?.parentId ? findStep(flow.steps, at.parentId) : undefined
  const list: FlowStep[] = !at ? [] : parent && parent.type === 'branch' ? (at.branch === 'no' ? parent.no : parent.yes) : parent && parent.type === 'split' ? (at.branch === 'b' ? parent.b : parent.a) : flow.steps
  const index = at?.index ?? 0
  const tip = (label: string, node: React.ReactNode) => (
    <SimpleTooltip label={label}>
      {node}
    </SimpleTooltip>
  )
  return (
    <>
      {tip(
        'Move up',
        <IconButton size="sm" variant="ghost" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
          <ArrowUp />
        </IconButton>,
      )}
      {tip(
        'Move down',
        <IconButton size="sm" variant="ghost" aria-label="Move down" disabled={index >= list.length - 1} onClick={() => onMove(1)}>
          <ArrowDown />
        </IconButton>,
      )}
      {tip(
        'Duplicate',
        <IconButton size="sm" variant="ghost" aria-label="Duplicate" onClick={onDuplicate}>
          <Copy />
        </IconButton>,
      )}
      {tip(
        'Remove (Delete)',
        <IconButton size="sm" variant="ghost" aria-label="Remove step" onClick={onRemove} className="hover:text-danger">
          <Trash2 />
        </IconButton>,
      )}
    </>
  )
}

/** The controls for the selection. Health and preview are drawn by the builder. */
export function InspectorBody({ selection, tools }: { selection: Selection; tools: InspectorTools }) {
  const { flow, update, run } = tools
  const placeholders = React.useMemo(() => placeholdersForFlow(flow), [flow])
  const subjects = React.useMemo(() => subjectsOf(flow.trigger), [flow.trigger])
  if (!selection) return null

  switch (selection.kind) {
    case 'trigger':
      return (
        <TriggerPicker
          value={flow.trigger}
          audiences={tools.audiences}
          lookups={tools.lookups}
          onChange={(trigger) => {
            // A start that reaches guests about something they haven't booked has to be marketing.
            const purpose: FlowPurpose = mustBeMarketing(trigger) ? 'marketing' : flow.purpose
            let next: Flow = purpose === flow.purpose ? { ...flow, trigger } : withPurpose({ ...flow, trigger }, purpose)
            // "Once for each booking" means nothing without a booking: fall back to once.
            if (next.settings.reentry === 'per_booking' && !knowsBooking(trigger)) next = { ...next, settings: { ...next.settings, reentry: 'once' } }
            update(next, 'trigger')
          }}
        />
      )
    case 'who':
      return <WhoEditor tools={tools} />
    case 'exit':
      return <ExitEditor flow={flow} onChange={(exit) => update({ ...flow, exit })} />
    case 'settings':
      return (
        <div className="flex flex-col gap-6">
          <PanelSection title="What it is for" hint="One line for the automations list.">
            <Textarea
              rows={2}
              aria-label="What it is for"
              value={flow.description}
              placeholder="Like “Brings back guests who haven’t been out in a while”"
              onChange={(event) => update({ ...flow, description: event.target.value }, 'description')}
            />
          </PanelSection>
          <SettingsPanel flow={flow} rules={tools.rules} onChange={(settings) => update({ ...flow, settings }, 'settings')} />
          <PanelSection title="Changes">
            {flow.history.length === 0 ? (
              <p className="text-[0.8125rem] text-subtle">No saved changes yet.</p>
            ) : (
              <ol className="flex list-none flex-col gap-1.5 p-0">
                {flow.history.slice(0, 8).map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="flex items-baseline justify-between gap-3 text-[0.8125rem]">
                    <span className="truncate text-foreground">{entry.what}</span>
                    <span className="shrink-0 text-xs text-subtle tabular">{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(entry.at))}</span>
                  </li>
                ))}
              </ol>
            )}
          </PanelSection>
          {tools.onDeleteFlow ? (
            <PanelSection title="Delete this automation" hint="Guests in it now get nothing more from it. This can’t be undone.">
              <Button variant="secondary" size="sm" leftIcon={<Trash2 />} className="self-start text-danger" onClick={tools.onDeleteFlow}>
                Delete automation
              </Button>
            </PanelSection>
          ) : flow.builtIn ? (
            <p className="text-xs leading-relaxed text-subtle">Built-in automations can be changed or paused, but not deleted.</p>
          ) : null}
        </div>
      )
    case 'step': {
      const step = findStep(flow.steps, selection.id)
      if (!step) return <p className="text-sm text-subtle">This step is no longer there.</p>
      const set = (next: FlowStep, key?: string) => update({ ...flow, steps: updateStep(flow.steps, step.id, () => next) }, key ? `${step.id}:${key}` : undefined)
      const stats = run?.perStep[step.id]
      switch (step.type) {
        case 'email':
          return (
            <EmailStepEditor
              step={step}
              onChange={(patch) => set({ ...step, ...patch }, Object.keys(patch).join(','))}
              placeholders={placeholders}
              tools={tools.email}
              flowName={flow.name}
              marketing={flow.purpose === 'marketing'}
            />
          )
        case 'sms':
          return (
            <SmsStepEditor
              step={step}
              onChange={(patch) => set({ ...step, ...patch }, 'body')}
              placeholders={placeholders}
              vars={tools.email.ctx.vars}
              marketing={flow.purpose === 'marketing'}
              hasNumber={tools.hasSmsNumber}
            />
          )
        case 'wait':
          return <WaitEditor step={step} trigger={flow.trigger} onChange={(next) => set(next, 'wait')} />
        case 'branch':
          return <BranchEditor step={step} subjects={subjects} data={tools.data} stats={stats} onChange={(next) => set(next, 'branch')} />
        case 'split':
          return <SplitEditor step={step} stats={stats} onChange={(next) => set(next, 'split')} />
        case 'action':
          return <ActionEditor step={step} placeholders={placeholders} tags={tools.data.tags ?? []} onChange={(next) => set(next, 'action')} />
        case 'end':
          return <EndEditor />
      }
    }
    default:
      return null
  }
}

/**
 * Purpose decides consent, so its safe defaults come with it: marketing
 * stops once they book and spaces messages out; a booking message keeps
 * going if they book something else, and runs once for each booking.
 */
function withPurpose(flow: Flow, purpose: FlowPurpose): Flow {
  const marketing = purpose === 'marketing'
  const defaults = settingsFor(purpose)
  const reentry: FlowSettings['reentry'] = marketing
    ? flow.settings.reentry === 'per_booking'
      ? defaults.reentry
      : flow.settings.reentry
    : knowsBooking(flow.trigger) && flow.settings.reentry === 'once'
      ? 'per_booking'
      : flow.settings.reentry
  return {
    ...flow,
    purpose,
    exit: { ...flow.exit, onBooked: exitFor(purpose).onBooked },
    settings: { ...flow.settings, smartSending: defaults.smartSending, reentry },
  }
}

function WhoEditor({ tools }: { tools: InspectorTools }) {
  const { flow, update, run, data, lookups } = tools
  const forced = mustBeMarketing(flow.trigger)
  const subjects = subjectsOf(flow.trigger)

  return (
    <div className="flex flex-col gap-6">
      <PanelSection title="What kind of message" hint={PURPOSE_HELP[flow.purpose]}>
        <Segmented
          fullWidth
          label="What kind of message"
          value={flow.purpose}
          onValueChange={(purpose) => update(withPurpose(flow, purpose))}
          options={[
            { value: 'booking', label: PURPOSE_LABEL.booking, disabled: forced },
            { value: 'marketing', label: PURPOSE_LABEL.marketing },
          ]}
        />
        {forced ? <p className="text-xs leading-relaxed text-subtle">This one reaches guests about something they haven’t booked, so it is always marketing.</p> : null}
      </PanelSection>

      <PanelSection title="Only guests who match" hint="Leave it empty to include everyone it applies to.">
        <ConditionBuilder
          value={flow.who}
          onChange={(who) => update({ ...flow, who }, 'who')}
          subject={subjects}
          where="who"
          data={data}
          emptyText="Everyone it applies to can enter."
        />
      </PanelSection>

      <Consequence>
        {describeWho(flow, lookups)}.
        {run && run.skipped.length > 0
          ? ` In the last 60 days some were kept out: ${run.skipped
              .slice(0, 3)
              .map((entry) => `${entry.reason.charAt(0).toLowerCase()}${entry.reason.slice(1)} (${entry.count.toLocaleString('en-US')})`)
              .join(', ')}.`
          : ''}
      </Consequence>
    </div>
  )
}
