'use client'

import * as React from 'react'
import { Mail, MessageSquareText, Paintbrush, Plus, Settings2, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { IconButton } from '@/components/ui/icon-button'
import { toast } from '@/components/ui/toaster'
import { EmailDesigner } from '@/components/dashboard/marketing/email-designer'
import { ChoiceChips, DetailText, DurationInput, ToggleRow } from '@/components/dashboard/marketing/flow-builder/fields'
import { NumberInput } from '@/components/dashboard/marketing/number-input'
import { defaultTrigger, placeholdersForFlow, triggerMeta } from '@/lib/flows/catalog'
import { canGoLive, checkFlow, smsLength, type CheckContext } from '@/lib/flows/check'
import { describeTrigger } from '@/lib/flows/describe'
import { ONLY_IF_LABEL, SIMPLE_TRIGGERS, applySimple, newSimpleMessage, onlyIfChoices, type SimpleAutomation, type SimpleMessage } from '@/lib/flows/simple'
import type { Flow, TriggerType } from '@/lib/flows/types'
import { designFromText, type EmailContext, type EmailDesign, type SavedEmailTemplate } from '@/lib/email-design'
import { cn } from '@/lib/utils'

/* ==========================================================================
   The everyday automation editor: one screen, top to bottom.
   When it sends → the messages (each with its wait and an optional
   "only if") → a discount code → which activities. Anything more lives in
   the full builder, one click away.
   ========================================================================== */

const MAX_MESSAGES = 5

export function SimpleEditor({
  flow,
  simple: initial,
  isNew,
  activities,
  ctx,
  brand,
  savedTemplates,
  onSaveTemplate,
  checkContext,
  onSave,
  onClose,
  onDelete,
  onAdvanced,
}: {
  flow: Flow
  simple: SimpleAutomation
  isNew: boolean
  activities: { slug: string; name: string }[]
  ctx: EmailContext
  brand: string[]
  savedTemplates: SavedEmailTemplate[]
  onSaveTemplate: (name: string, design: EmailDesign) => void
  checkContext: Partial<CheckContext>
  /** False when it couldn't be stored. */
  onSave: (flow: Flow, what: string) => boolean
  onClose: () => void
  onDelete?: () => void
  /** Open the full builder with what is on screen now. */
  onAdvanced: (flow: Flow) => void
}) {
  const [name, setName] = React.useState(flow.name)
  const [draft, setDraft] = React.useState<SimpleAutomation>(initial)
  const [designing, setDesigning] = React.useState<string | null>(null)

  const built = React.useMemo(() => ({ ...applySimple(flow, draft), name: name.trim() || flow.name }), [flow, draft, name])
  const placeholders = React.useMemo(() => placeholdersForFlow(built), [built])
  const meta = triggerMeta(draft.trigger.type)
  const choice = SIMPLE_TRIGGERS.find((entry) => entry.type === draft.trigger.type)
  const live = flow.status === 'live'

  const set = (patch: Partial<SimpleAutomation>) => setDraft((current) => ({ ...current, ...patch }))
  const setMessage = (id: string, patch: Partial<SimpleMessage>) =>
    setDraft((current) => ({ ...current, messages: current.messages.map((message) => (message.id === id ? { ...message, ...patch } : message)) }))

  const pickTrigger = (type: TriggerType) => {
    const trigger = defaultTrigger(type)
    if (type === 'low_fill') Object.assign(trigger, { fillBelow: 50, reach: 'past_guests_of_activity' })
    if (type === 'review_left') trigger.ratings = [4, 5]
    // "Only if" choices that need a booking go when the start is no longer about one.
    const booking = triggerMeta(type).subject === 'booking'
    setDraft((current) => ({
      ...current,
      trigger,
      messages: current.messages.map((message, index) =>
        !booking && (message.onlyIf === 'waivers_missing' || message.onlyIf === 'balance_due')
          ? { ...message, onlyIf: 'always' }
          : index === 0 && message.onlyIf !== 'always' && !onlyIfChoices(trigger, true).includes(message.onlyIf)
            ? { ...message, onlyIf: 'always' }
            : message,
      ),
    }))
  }

  const save = (turnOn: boolean) => {
    if (draft.messages.length === 0) {
      toast.error('Add a message first')
      return
    }
    const next: Flow = { ...built, status: turnOn ? 'live' : built.status }
    if (turnOn || live) {
      const issues = checkFlow(next, checkContext)
      if (!canGoLive(issues)) {
        const first = issues.find((issue) => issue.severity === 'blocker')
        toast.error('One thing to fix first', { description: first?.text })
        return
      }
    }
    const what = turnOn ? 'Turned on' : isNew ? 'Created' : 'Saved'
    if (!onSave(next, what)) return
    toast.success(turnOn ? `${next.name} is on` : `${next.name} saved`)
    onClose()
  }

  const designFor = draft.messages.find((message) => message.id === designing)

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" size="lg" onOpenAutoFocus={(event) => event.preventDefault()}>
        <SheetHeader>
          <SheetTitle>{isNew ? 'New automation' : 'Edit automation'}</SheetTitle>
          <SheetDescription>When it sends, what it says. That’s all it needs.</SheetDescription>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-6">
          <Input aria-label="Name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Name it, e.g. Come back next summer" size="lg" />

          {/* ---------- when ---------- */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">When it sends</h3>
            <Select value={draft.trigger.type} onValueChange={(value) => pickTrigger(value as TriggerType)}>
              <SelectTrigger aria-label="When it sends">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIMPLE_TRIGGERS.map((entry) => (
                  <SelectItem key={entry.type} value={entry.type}>
                    {entry.label}
                  </SelectItem>
                ))}
                {choice ? null : <SelectItem value={draft.trigger.type}>{describeTrigger(draft.trigger)}</SelectItem>}
              </SelectContent>
            </Select>
            {meta.offset ? (
              <DurationInput
                label="How long"
                value={draft.trigger.offset ?? meta.offset.default}
                units={meta.offset.units}
                onChange={(offset) => set({ trigger: { ...draft.trigger, offset } })}
                after={choice?.offsetWords ?? meta.offset.label}
              />
            ) : null}
            {draft.trigger.type === 'low_fill' ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <span>When it is under</span>
                <NumberInput aria-label="Full below" min={5} max={95} className="w-20" value={draft.trigger.fillBelow ?? 50} onValueChange={(fillBelow) => set({ trigger: { ...draft.trigger, fillBelow } })} />
                <span>% full. It goes to past guests of that activity.</span>
              </div>
            ) : null}
          </section>

          {/* ---------- messages ---------- */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-foreground">What it sends</h3>
            <ol className="flex list-none flex-col gap-3 p-0">
              {draft.messages.map((message, index) => {
                const choices = onlyIfChoices(draft.trigger, index === 0)
                const sms = message.channel === 'sms' ? smsLength(message.body) : null
                return (
                  <li key={message.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-6 place-items-center rounded-full bg-surface-sunken text-xs font-semibold text-muted">{index + 1}</span>
                        <Segmented
                          size="sm"
                          label={`Message ${index + 1} channel`}
                          value={message.channel}
                          onValueChange={(channel) =>
                            setMessage(message.id, {
                              channel,
                              subject: channel === 'email' && !message.subject ? 'A note from {business}' : message.subject,
                              design: channel === 'sms' ? undefined : message.design,
                            })
                          }
                          options={[
                            { value: 'email', label: 'Email', icon: Mail },
                            { value: 'sms', label: 'Text', icon: MessageSquareText },
                          ]}
                        />
                      </div>
                      {draft.messages.length > 1 ? (
                        <IconButton
                          type="button"
                          size="xs"
                          variant="ghost"
                          aria-label={`Remove message ${index + 1}`}
                          className="text-danger hover:bg-danger-soft"
                          onClick={() => setDraft((current) => ({ ...current, messages: current.messages.filter((entry) => entry.id !== message.id) }))}
                        >
                          <Trash2 />
                        </IconButton>
                      ) : null}
                    </div>

                    {/* The start already sets the timing of the first message: a wait there is only shown once there is one, or when the start has no time of its own. */}
                    {index > 0 || message.wait.amount > 0 || !meta.offset ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                        <span>Send it</span>
                        <DurationInput
                          label={`Wait before message ${index + 1}`}
                          value={message.wait}
                          units={['hours', 'days']}
                          onChange={(wait) => setMessage(message.id, { wait })}
                          after={index === 0 ? 'later (0 is straight away)' : 'after the last one'}
                        />
                      </div>
                    ) : null}
                    {choices.length > 1 ? (
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                        <span>Only if</span>
                        <Select value={message.onlyIf} onValueChange={(onlyIf) => setMessage(message.id, { onlyIf: onlyIf as SimpleMessage['onlyIf'] })}>
                          <SelectTrigger aria-label={`Only send message ${index + 1} if`} className="w-64">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {choices.map((entry) => (
                              <SelectItem key={entry} value={entry}>
                                {ONLY_IF_LABEL[entry]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}

                    {message.channel === 'email' ? (
                      <DetailText label="Subject" value={message.subject} onChange={(subject) => setMessage(message.id, { subject })} placeholders={placeholders} invalid={!message.subject.trim()} />
                    ) : null}
                    {message.channel === 'email' && message.design ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-sunken px-3 py-2.5 text-sm">
                        <span className="text-muted">This email has its own design.</span>
                        <span className="flex gap-1">
                          <Button type="button" size="sm" variant="secondary" leftIcon={<Paintbrush />} onClick={() => setDesigning(message.id)}>
                            Edit design
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setMessage(message.id, { design: undefined })}>
                            Use plain text
                          </Button>
                        </span>
                      </div>
                    ) : (
                      <DetailText
                        label="Message"
                        multiline
                        rows={message.channel === 'sms' ? 3 : 6}
                        value={message.body}
                        onChange={(body) => setMessage(message.id, { body })}
                        placeholders={placeholders}
                        invalid={!message.body.trim()}
                        footer={
                          sms ? (
                            <span className={cn('tabular-nums', sms.segments > 2 && 'text-warning')}>
                              {sms.chars} characters · {sms.segments} {sms.segments === 1 ? 'text' : 'texts'}
                            </span>
                          ) : (
                            <button type="button" onClick={() => setDesigning(message.id)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                              <Paintbrush className="size-3.5" aria-hidden="true" />
                              Add photos and colours
                            </button>
                          )
                        }
                      />
                    )}
                  </li>
                )
              })}
            </ol>
            {draft.messages.length < MAX_MESSAGES ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Plus />}
                className="self-start"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    messages: [...current.messages, newSimpleMessage('email', { amount: 3, unit: 'days' }, current.messages.length > 0 && flow.purpose === 'marketing' ? 'not_booked' : 'always')],
                  }))
                }
              >
                Add a follow-up
              </Button>
            ) : null}
          </section>

          {/* ---------- discount ---------- */}
          <section className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <ToggleRow
              title="Give a discount code"
              text="Each guest gets their own code, so it can’t be shared. Add it to the message with Add personal detail → Discount code."
              checked={draft.discount.on}
              onChange={(on) => set({ discount: { ...draft.discount, on } })}
            />
            {draft.discount.on ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                <NumberInput aria-label="Discount percent" min={1} max={90} className="w-20" value={draft.discount.percent} onValueChange={(percent) => set({ discount: { ...draft.discount, percent } })} />
                <span>% off, good for</span>
                <NumberInput aria-label="Days the code is good for" min={1} max={365} className="w-20" value={draft.discount.validDays} onValueChange={(validDays) => set({ discount: { ...draft.discount, validDays } })} />
                <span>days</span>
              </div>
            ) : null}
          </section>

          {/* ---------- activities ---------- */}
          {activities.length > 1 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">For which activities</h3>
              <p className="text-xs text-subtle">{draft.activities.length === 0 ? 'All of them. Pick some to keep it to those.' : `Only the ${draft.activities.length} picked.`}</p>
              <ChoiceChips label="Activities" options={activities.map((activity) => ({ value: activity.slug, label: activity.name }))} value={draft.activities} onChange={(next) => set({ activities: next })} />
            </section>
          ) : null}
        </SheetBody>

        <SheetFooter className="flex-wrap justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="sm" leftIcon={<Settings2 />} onClick={() => onAdvanced(built)}>
              More options
            </Button>
            {onDelete ? (
              <Button type="button" variant="ghost" size="sm" className="text-danger" leftIcon={<Trash2 />} onClick={onDelete}>
                Delete
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            {live ? (
              <Button type="button" onClick={() => save(false)}>
                Save
              </Button>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={() => save(false)}>
                  Save as draft
                </Button>
                <Button type="button" onClick={() => save(true)}>
                  Turn on
                </Button>
              </>
            )}
          </div>
        </SheetFooter>
      </SheetContent>

      {designFor ? (
        <EmailDesigner
          initial={designFor.design ?? designFromText(designFor.subject, designFor.body, brand[0] ?? '#601CEF')}
          ctx={ctx}
          subject={designFor.subject}
          brand={brand}
          saved={savedTemplates}
          onSaveTemplate={onSaveTemplate}
          onClose={() => setDesigning(null)}
          onDone={(design) => {
            setMessage(designFor.id, { design })
            setDesigning(null)
          }}
        />
      ) : null}
    </Sheet>
  )
}
