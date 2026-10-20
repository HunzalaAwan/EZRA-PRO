'use client'

import * as React from 'react'
import { Check, ChevronDown, Paintbrush, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { DetailText, DurationInput } from '@/components/dashboard/marketing/flow-builder/fields'
import { NumberInput } from '@/components/dashboard/marketing/number-input'
import { defaultTrigger, placeholdersForFlow, triggerMeta } from '@/lib/flows/catalog'
import { smsLength } from '@/lib/flows/check'
import { describeTrigger } from '@/lib/flows/describe'
import type { ActionStep, BranchStep, Condition, EmailStep, Flow, FlowStep, FlowTrigger, SmsStep, SplitStep, TriggerType, WaitStep } from '@/lib/flows/types'
import { cn } from '@/lib/utils'

import { KIND_ICON, KIND_TONE, type Selection } from './canvas'
import { CONDITION_PRESETS, STEP_LABEL, TRIGGER_CHOICES, TRIGGER_GROUPS, aboutBooking, kindOf, presetGroup, presetOf, triggerChoice } from './meta'

/* ==========================================================================
   The side panel: the fields for whatever card is picked. Labels, the
   fields, and nothing else.
   ========================================================================== */

export interface PanelProps {
  flow: Flow
  selection: Exclude<Selection, null>
  activities: { slug: string; name: string }[]
  tags: string[]
  onFlow: (flow: Flow) => void
  onStep: (id: string, next: FlowStep) => void
  onRemoveStep: (id: string) => void
  onDesign: (step: EmailStep) => void
  onDelete?: () => void
  onClose: () => void
}

export function Panel(props: PanelProps) {
  const { flow, selection, onClose, onRemoveStep } = props
  const step = selection.kind === 'step' ? findIn(flow.steps, selection.id) : undefined
  const kind = selection.kind === 'trigger' ? 'trigger' : step ? kindOf(step) : null
  const title = selection.kind === 'settings' ? 'Settings' : selection.kind === 'trigger' ? 'Trigger' : step ? STEP_LABEL[kindOf(step)] : ''
  const Icon = kind ? KIND_ICON[kind] : null

  return (
    <aside className="flex h-full w-full flex-col bg-surface lg:w-[24rem] lg:border-l lg:border-line" aria-label={title}>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-5">
        {Icon && kind ? (
          <span aria-hidden="true" className={cn('grid size-7 place-items-center rounded-md', KIND_TONE[kind])}>
            <Icon className="size-3.5" />
          </span>
        ) : null}
        <h2 className="flex-1 text-sm font-semibold text-foreground">{title}</h2>
        {step ? (
          <IconButton size="sm" variant="ghost" aria-label="Delete this step" className="text-muted hover:text-danger" onClick={() => onRemoveStep(step.id)}>
            <Trash2 />
          </IconButton>
        ) : null}
        <IconButton size="sm" variant="ghost" aria-label="Close" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
        {selection.kind === 'trigger' ? <TriggerFields {...props} /> : null}
        {selection.kind === 'settings' ? <SettingsFields {...props} /> : null}
        {step ? <StepFields {...props} step={step} /> : null}
      </div>
    </aside>
  )
}

function findIn(steps: FlowStep[], id: string): FlowStep | undefined {
  for (const step of steps) {
    if (step.id === id) return step
    const inner = step.type === 'branch' ? [...step.yes, ...step.no] : step.type === 'split' ? [...step.a, ...step.b] : []
    const found = findIn(inner, id)
    if (found) return found
  }
  return undefined
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-[0.8125rem] font-medium text-foreground">{children}</span>
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

/* ---------- trigger ---------- */

const ACTIVITY_FIELDS = ['booking.activity', 'guest.bookedActivity']

function TriggerFields({ flow, activities, onFlow }: PanelProps) {
  const trigger = flow.trigger
  const choice = triggerChoice(trigger.type)
  const meta = triggerMeta(trigger.type)
  const activityCondition = flow.who.conditions.find((condition) => ACTIVITY_FIELDS.includes(condition.field) && condition.op === 'any_of')
  const picked = Array.isArray(activityCondition?.value) ? (activityCondition.value as string[]) : []

  const setTrigger = (next: FlowTrigger) => {
    // A condition about a booking only works when the trigger is about one.
    onFlow({ ...flow, trigger: next })
  }
  const pick = (type: TriggerType) => {
    const next = defaultTrigger(type)
    if (type === 'low_fill') Object.assign(next, { fillBelow: 50, reach: 'past_guests_of_activity' })
    if (type === 'review_left') next.ratings = [4, 5]
    const purpose = triggerMeta(type).defaultPurpose
    onFlow({ ...flow, trigger: next, purpose: flow.steps.length === 0 || flow.purpose === triggerMeta(flow.trigger.type).defaultPurpose ? purpose : flow.purpose })
  }
  const setActivities = (slugs: string[]) => {
    const others = flow.who.conditions.filter((condition) => condition !== activityCondition)
    const field = aboutBooking(trigger) ? 'booking.activity' : 'guest.bookedActivity'
    const next: Condition[] = slugs.length > 0 ? [...others, { id: activityCondition?.id ?? `cond_${Date.now().toString(36)}`, field, op: 'any_of', value: slugs }] : others
    onFlow({ ...flow, who: { ...flow.who, conditions: next } })
  }

  return (
    <>
      <Row label="Starts when">
        <Select value={trigger.type} onValueChange={(value) => pick(value as TriggerType)}>
          <SelectTrigger aria-label="Starts when">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIGGER_GROUPS.map((group) => (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {TRIGGER_CHOICES.filter((entry) => entry.group === group).map((entry) => (
                  <SelectItem key={entry.type} value={entry.type}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
            {choice ? null : <SelectItem value={trigger.type}>{describeTrigger(trigger)}</SelectItem>}
          </SelectContent>
        </Select>
      </Row>

      {choice?.after && meta.offset ? (
        <Row label="Timing">
          <DurationInput label="Timing" value={trigger.offset ?? meta.offset.default} units={meta.offset.units} onChange={(offset) => setTrigger({ ...trigger, offset })} after={choice.after} />
        </Row>
      ) : null}

      {trigger.type === 'low_fill' ? (
        <Row label="When less than">
          <div className="flex items-center gap-2 text-sm text-muted">
            <NumberInput aria-label="Booked below" min={5} max={95} className="w-20" value={trigger.fillBelow ?? 50} onValueChange={(fillBelow) => setTrigger({ ...trigger, fillBelow })} />
            % booked
          </div>
        </Row>
      ) : null}

      {activities.length > 1 ? (
        <Row label="Activities">
          <ActivityPicker activities={activities} value={picked} onChange={setActivities} />
        </Row>
      ) : null}
    </>
  )
}

function ActivityPicker({ activities, value, onChange }: { activities: { slug: string; name: string }[]; value: string[]; onChange: (next: string[]) => void }) {
  const [query, setQuery] = React.useState('')
  const shown = activities.filter((activity) => activity.name.toLowerCase().includes(query.trim().toLowerCase()))
  const label = value.length === 0 ? 'All activities' : value.length === 1 ? (activities.find((activity) => activity.slug === value[0])?.name ?? '1 activity') : `${value.length} activities`
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm text-foreground hover:border-line-strong focus-visible:outline-2 focus-visible:outline-primary">
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 text-subtle" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent width="auto" padding="none" align="start" className="w-[var(--radix-popover-trigger-width)] p-1.5">
        <Input aria-label="Search activities" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" size="sm" className="mb-1" />
        <ul className="flex max-h-64 list-none flex-col overflow-y-auto p-0">
          <li>
            <button type="button" onClick={() => onChange([])} className="flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-sunken">
              All activities
              {value.length === 0 ? <Check className="size-4 text-primary" aria-hidden="true" /> : null}
            </button>
          </li>
          {shown.map((activity) => {
            const on = value.includes(activity.slug)
            return (
              <li key={activity.slug}>
                <button
                  type="button"
                  onClick={() => onChange(on ? value.filter((slug) => slug !== activity.slug) : [...value, activity.slug])}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-sunken"
                >
                  <span className="truncate">{activity.name}</span>
                  {on ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/* ---------- settings ---------- */

function SettingsFields({ flow, onFlow, onDelete }: PanelProps) {
  const marketingOnly = triggerMeta(flow.trigger.type).marketingOnly
  return (
    <>
      <Row label="Who gets it">
        <Segmented
          label="Who gets it"
          fullWidth
          value={flow.purpose}
          onValueChange={(purpose) => onFlow({ ...flow, purpose })}
          options={[
            { value: 'booking', label: 'Everyone', disabled: marketingOnly },
            { value: 'marketing', label: 'Subscribers only' },
          ]}
        />
        <p className="text-xs text-subtle">{flow.purpose === 'marketing' ? 'Offers and news: only guests who agreed to marketing.' : 'Trip details: every guest it applies to.'}</p>
      </Row>
      <SwitchRow label="Stop when they book again" checked={flow.exit.onBooked} onChange={(onBooked) => onFlow({ ...flow, exit: { ...flow.exit, onBooked } })} />
      <SwitchRow label="Stop if the booking is cancelled" checked={flow.exit.onCancelled} onChange={(onCancelled) => onFlow({ ...flow, exit: { ...flow.exit, onCancelled } })} />
      <SwitchRow label="Hold messages during quiet hours" checked={flow.settings.quietHours} onChange={(quietHours) => onFlow({ ...flow, settings: { ...flow.settings, quietHours } })} />
      <Row label="Each guest can get it">
        <Select value={flow.settings.reentry} onValueChange={(reentry) => onFlow({ ...flow, settings: { ...flow.settings, reentry: reentry as Flow['settings']['reentry'] } })}>
          <SelectTrigger aria-label="Each guest can get it">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="once">Once</SelectItem>
            <SelectItem value="per_booking">Once per booking</SelectItem>
            <SelectItem value="every">Every time</SelectItem>
          </SelectContent>
        </Select>
      </Row>
      {onDelete ? (
        <Button variant="ghost" size="sm" leftIcon={<Trash2 />} className="mt-2 self-start text-danger hover:bg-danger-soft" onClick={onDelete}>
          Delete automation
        </Button>
      ) : null}
    </>
  )
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  const id = React.useId()
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-sm text-foreground">
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

/* ---------- steps ---------- */

function StepFields(props: PanelProps & { step: FlowStep }) {
  const { step, flow, onStep } = props
  const placeholders = React.useMemo(() => placeholdersForFlow(flow), [flow])
  const set = <T extends FlowStep>(patch: Partial<T>) => onStep(step.id, { ...step, ...patch } as FlowStep)

  switch (step.type) {
    case 'email':
      return <EmailFields step={step} placeholders={placeholders} set={set} onDesign={props.onDesign} />
    case 'sms': {
      const size = smsLength(step.body)
      return (
        <DetailText
          label="Message"
          multiline
          rows={5}
          value={step.body}
          onChange={(body) => set<SmsStep>({ body })}
          placeholders={placeholders}
          footer={<span className={cn('tabular-nums', size.segments > 2 && 'text-warning')}>{size.chars} characters · {size.segments} {size.segments === 1 ? 'text' : 'texts'}</span>}
        />
      )
    }
    case 'wait':
      return <WaitFields step={step} set={set} />
    case 'branch':
      return <ConditionFields {...props} step={step} />
    case 'split':
      return (
        <Row label="Share on path A">
          <div className="flex items-center gap-2 text-sm text-muted">
            <NumberInput aria-label="Share on path A" min={1} max={99} className="w-20" value={step.percentA} onValueChange={(percentA) => set<SplitStep>({ percentA })} />
            % · the rest go down B
          </div>
        </Row>
      )
    case 'action':
      return <ActionFields {...props} step={step} placeholders={placeholders} set={set} />
    case 'end':
      return <p className="text-sm text-muted">Guests stop here.</p>
  }
}

function EmailFields({
  step,
  placeholders,
  set,
  onDesign,
}: {
  step: EmailStep
  placeholders: ReturnType<typeof placeholdersForFlow>
  set: <T extends FlowStep>(patch: Partial<T>) => void
  onDesign: (step: EmailStep) => void
}) {
  return (
    <>
      <DetailText label="Subject" value={step.subject} onChange={(subject) => set<EmailStep>({ subject })} placeholders={placeholders} />
      {step.design ? (
        <div className="flex flex-col gap-2 rounded-lg border border-line p-3">
          <span className="text-sm text-foreground">Designed email</span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" leftIcon={<Paintbrush />} onClick={() => onDesign(step)}>
              Edit design
            </Button>
            <Button size="sm" variant="ghost" onClick={() => set<EmailStep>({ design: undefined })}>
              Use plain text
            </Button>
          </div>
        </div>
      ) : (
        <>
          <DetailText label="Message" multiline rows={9} value={step.body} onChange={(body) => set<EmailStep>({ body })} placeholders={placeholders} />
          <Button size="sm" variant="secondary" leftIcon={<Paintbrush />} className="self-start" onClick={() => onDesign(step)}>
            Design with images
          </Button>
        </>
      )}
    </>
  )
}

function WaitFields({ step, set }: { step: WaitStep; set: <T extends FlowStep>(patch: Partial<T>) => void }) {
  const mode = step.mode === 'until_time' ? 'until_time' : 'for'
  return (
    <>
      <Segmented
        label="Wait type"
        fullWidth
        value={mode}
        onValueChange={(next) =>
          set<WaitStep>(next === 'for' ? { mode: 'for', duration: step.duration ?? { amount: 1, unit: 'days' } } : { mode: 'until_time', time: step.time ?? '09:00', days: [] })
        }
        options={[
          { value: 'for', label: 'For a time' },
          { value: 'until_time', label: 'Until a time of day' },
        ]}
      />
      {mode === 'for' ? (
        <Row label="Wait">
          <DurationInput label="Wait" value={step.duration} min={1} onChange={(duration) => set<WaitStep>({ mode: 'for', duration })} />
        </Row>
      ) : (
        <Row label="Send at">
          <Input type="time" aria-label="Send at" className="w-36" value={step.time ?? '09:00'} onChange={(event) => set<WaitStep>({ time: event.target.value })} />
        </Row>
      )}
    </>
  )
}

function ConditionFields({ step, flow, activities, tags, onStep }: PanelProps & { step: BranchStep }) {
  const found = presetOf(step)
  const booking = aboutBooking(flow.trigger)
  const presets = CONDITION_PRESETS.filter((preset) => booking || !preset.bookingOnly)
  const preset = found?.preset
  const setPreset = (id: string, value?: string | number) => {
    const next = CONDITION_PRESETS.find((entry) => entry.id === id)
    if (next) onStep(step.id, { ...step, label: undefined, when: presetGroup(next, value) })
  }
  return (
    <>
      <Row label="Check if the guest">
        <Select value={preset?.id ?? 'custom'} onValueChange={(id) => setPreset(id, id === 'group' ? 6 : undefined)}>
          <SelectTrigger aria-label="Check if the guest">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {presets.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                {entry.label}
              </SelectItem>
            ))}
            {preset ? null : <SelectItem value="custom">{step.label || 'Custom check'}</SelectItem>}
          </SelectContent>
        </Select>
      </Row>
      {preset?.input === 'number' ? (
        <Row label="Guests">
          <NumberInput aria-label="Group size" min={2} className="w-24" value={Number(found?.value) || 6} onValueChange={(value) => setPreset(preset.id, value)} />
        </Row>
      ) : null}
      {preset?.input === 'activity' ? (
        <Row label="Activity">
          <Select value={(found?.value as string) ?? ''} onValueChange={(value) => setPreset(preset.id, value)}>
            <SelectTrigger aria-label="Activity">
              <SelectValue placeholder="Pick an activity" />
            </SelectTrigger>
            <SelectContent>
              {activities.map((activity) => (
                <SelectItem key={activity.slug} value={activity.slug}>
                  {activity.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
      ) : null}
      {preset?.input === 'tag' ? (
        <Row label="Tag">
          <Input list="automation-tags" value={(found?.value as string) ?? ''} onChange={(event) => setPreset(preset.id, event.target.value)} placeholder="e.g. Repeat guest" />
          <datalist id="automation-tags">
            {tags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </Row>
      ) : null}
      <p className="text-xs text-subtle">Yes goes left, No goes right. Add steps under each.</p>
    </>
  )
}

const ASSIGNEES: { value: NonNullable<ActionStep['assignee']>; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'managers', label: 'Managers' },
  { value: 'guides', label: 'Guides and crew' },
  { value: 'everyone', label: 'Everyone' },
]

function ActionFields({
  step,
  tags,
  placeholders,
  set,
}: PanelProps & { step: ActionStep; placeholders: ReturnType<typeof placeholdersForFlow>; set: <T extends FlowStep>(patch: Partial<T>) => void }) {
  switch (step.action) {
    case 'give_code': {
      const code = step.code ?? { percent: 10, validDays: 14, prefix: 'THANKS' }
      return (
        <>
          <Row label="Discount">
            <div className="flex items-center gap-2 text-sm text-muted">
              <NumberInput aria-label="Percent off" min={1} max={90} className="w-20" value={code.percent} onValueChange={(percent) => set<ActionStep>({ code: { ...code, percent } })} />% off
            </div>
          </Row>
          <Row label="Valid for">
            <div className="flex items-center gap-2 text-sm text-muted">
              <NumberInput aria-label="Days valid" min={1} max={365} className="w-20" value={code.validDays} onValueChange={(validDays) => set<ActionStep>({ code: { ...code, validDays } })} />
              days
            </div>
          </Row>
          <p className="text-xs text-subtle">Each guest gets their own code. Put it in an email with Add personal detail → Discount code.</p>
        </>
      )
    }
    case 'add_tag':
    case 'remove_tag':
      return (
        <Row label="Tag">
          <Input list="automation-tags-action" value={step.tag ?? ''} onChange={(event) => set<ActionStep>({ tag: event.target.value })} placeholder="e.g. Repeat guest" />
          <datalist id="automation-tags-action">
            {tags.map((tag) => (
              <option key={tag} value={tag} />
            ))}
          </datalist>
        </Row>
      )
    case 'notify_team':
    case 'create_task':
      return (
        <>
          <Row label={step.action === 'notify_team' ? 'Tell' : 'Assign to'}>
            <Select value={step.assignee ?? 'managers'} onValueChange={(assignee) => set<ActionStep>({ assignee: assignee as ActionStep['assignee'] })}>
              <SelectTrigger aria-label="Who">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSIGNEES.map((entry) => (
                  <SelectItem key={entry.value} value={entry.value}>
                    {entry.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <DetailText label="Message" multiline rows={3} value={step.message ?? ''} onChange={(message) => set<ActionStep>({ message })} placeholders={placeholders} />
        </>
      )
    case 'add_note':
      return <DetailText label="Note" multiline rows={3} value={step.message ?? ''} onChange={(message) => set<ActionStep>({ message })} placeholders={placeholders} />
    case 'unsubscribe':
      return <p className="text-sm text-muted">The guest stops getting marketing. Booking messages still go.</p>
  }
}
