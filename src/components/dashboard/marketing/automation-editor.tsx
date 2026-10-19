'use client'

import * as React from 'react'
import { Check, Lock, Mail, MessageSquareText, Send, Workflow, X, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { EmailContentCard } from '@/components/dashboard/marketing/email-content-card'
import { EmailFrame } from '@/components/dashboard/marketing/email-designer'
import { DetailText } from '@/components/dashboard/marketing/flow-builder/fields'
import { PLACEHOLDERS_FOR } from '@/lib/flows/catalog'
import { smsLength } from '@/lib/flows/check'
import { designFromText, type EmailContext, type EmailDesign, type SavedEmailTemplate } from '@/lib/email-design'
import { CHANNEL_LABEL, renderTemplate, type MessageChannel, type MessageTemplate, type TriggerWhen } from '@/lib/messaging'
import { cn } from '@/lib/utils'

/* ==========================================================================
   BOOKING MESSAGE EDITOR
   The messages every booking gets: confirmation, reminders, balances and
   the after-trip thank-you. Only what a booking message needs: when it
   goes, how it is sent, the words or the designed email, and which
   activities it is for. Anything with follow-ups, offers or conditions is
   an automation, made in the builder.
   ========================================================================== */

/** The moments a booking message can go at. Staff-sent ones never change. */
const MOMENTS: { value: Exclude<TriggerWhen, 'manual'>; label: string }[] = [
  { value: 'on_booking', label: 'When the booking is made' },
  { value: 'before', label: 'Before the start' },
  { value: 'after', label: 'After it ends' },
]

/** The details a booking message can use: the guest, the business and the booking. No offers. */
const DETAILS = PLACEHOLDERS_FOR('booking')

type Unit = 'hours' | 'days'

const unitFor = (hours: number): Unit => (hours >= 24 && hours % 24 === 0 ? 'days' : 'hours')

export function isStaffSent(template: Pick<MessageTemplate, 'timing'>) {
  return template.timing.when === 'manual'
}

function Section({ title, hint, icon: Icon, children }: { title: string; hint?: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line-subtle pt-6 first:border-t-0 first:pt-0">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          {Icon ? <Icon className="size-4 text-subtle" /> : null}
          {title}
        </h3>
        {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Chips({ options, value, onChange, label }: { options: { value: string; label: string }[]; value: string[]; onChange: (next: string[]) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = value.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((entry) => entry !== option.value) : [...value, option.value])}
            className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors', on ? 'border-primary bg-primary-soft/40 text-foreground' : 'border-line text-muted hover:text-foreground')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** A whole number typed freely; it settles into range when the field is left. */
function WholeNumber({ value, min, onChange, ...control }: { value: number; min: number; onChange: (value: number) => void; id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) {
  const [text, setText] = React.useState(String(value))
  const [shownFor, setShownFor] = React.useState(value)
  if (value !== shownFor) {
    setShownFor(value)
    setText(String(value))
  }
  return (
    <Input
      {...control}
      type="number"
      inputMode="numeric"
      min={min}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const next = Number(e.target.value)
        if (e.target.value.trim() !== '' && Number.isInteger(next) && next >= min) onChange(next)
      }}
      onBlur={() => setText(String(value))}
    />
  )
}

/** The email preview, scaled to fit whatever width the sheet has. */
function FittedEmail({ design, ctx }: { design: EmailDesign; ctx: EmailContext }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [scale, setScale] = React.useState(0.9)
  React.useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, Math.max(0.4, entry.contentRect.width / 600))))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className="overflow-hidden rounded-xl border border-line" style={{ background: design.theme.background }}>
      <EmailFrame design={design} ctx={ctx} width={600} scale={scale} className="mx-auto" />
    </div>
  )
}

export function AutomationEditor({
  template,
  onClose,
  onSave,
  onCopyAsAutomation,
  ctx,
  brand,
  savedTemplates,
  onSaveTemplate,
  activities,
}: {
  template: MessageTemplate
  onClose: () => void
  onSave: (template: MessageTemplate) => void
  /** Turn this message into an automation with its own steps, opened in the builder. */
  onCopyAsAutomation?: (template: MessageTemplate) => void
  ctx: EmailContext
  brand: string[]
  savedTemplates: SavedEmailTemplate[]
  onSaveTemplate: (name: string, design: EmailDesign) => void
  activities: { slug: string; name: string }[]
}) {
  const [draft, setDraft] = React.useState<MessageTemplate>(template)
  const [unit, setUnit] = React.useState<Unit>(() => unitFor(template.timing.hours))
  const [leaving, setLeaving] = React.useState(false)
  const set = (patch: Partial<MessageTemplate>) => setDraft((current) => ({ ...current, ...patch }))

  const staff = isStaffSent(draft)
  const emailOn = draft.channel !== 'sms'
  const textOn = draft.channel !== 'email'
  const vars = ctx.vars
  const rendered = renderTemplate(draft.body, vars)
  const length = smsLength(rendered)
  const amount = unit === 'days' ? Math.round(draft.timing.hours / 24) : draft.timing.hours
  const hasOffset = draft.timing.when === 'before' || draft.timing.when === 'after'
  const changed = React.useMemo(() => JSON.stringify(draft) !== JSON.stringify(template), [draft, template])
  const previewDesign = React.useMemo(
    () => (emailOn ? (draft.design ?? designFromText(draft.subject, draft.body, brand[0] ?? '#601CEF')) : null),
    [emailOn, draft.design, draft.subject, draft.body, brand],
  )
  const problems = [
    draft.name.trim().length < 2 ? 'Give it a name' : null,
    draft.body.trim().length < 5 && !draft.design ? 'Write the message' : null,
    emailOn && !draft.subject.trim() ? 'Add a subject' : null,
  ].filter(Boolean) as string[]

  const setAmount = (value: number) => {
    const clean = Math.max(unit === 'days' ? 1 : 0, Math.round(value) || 0)
    set({ timing: { ...draft.timing, hours: unit === 'days' ? clean * 24 : clean } })
  }

  const close = () => {
    if (changed) setLeaving(true)
    else onClose()
  }

  const whenLine = staff
    ? 'Sent by your team, from the booking or the Weather page.'
    : draft.timing.when === 'on_booking'
      ? 'As soon as the booking is made.'
      : `${amount} ${unit === 'days' ? (amount === 1 ? 'day' : 'days') : amount === 1 ? 'hour' : 'hours'} ${draft.timing.when === 'before' ? 'before the start' : 'after it ends'}.`

  return (
    <Sheet open onOpenChange={(value) => !value && close()}>
      <SheetContent side="right" size="xl">
        <SheetHeader>
          <SheetTitle>{draft.name || 'Booking message'}</SheetTitle>
          <SheetDescription>{draft.purpose || 'A message about a booking.'} Booking messages go to every guest of the booking, subscribed or not.</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Name">{(control) => <Input {...control} value={draft.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
            <label className="flex h-10 items-center gap-2 text-sm font-medium">
              <Switch checked={draft.enabled} onCheckedChange={(enabled) => set({ enabled })} aria-label={`Send ${draft.name || 'this message'}`} />
              {draft.enabled ? 'On' : 'Off: not sent'}
            </label>
          </div>

          <Section title="When it goes" icon={Zap} hint={whenLine}>
            {staff ? (
              <p className="flex items-start gap-2 rounded-xl border border-line bg-surface-sunken/50 px-3.5 py-3 text-sm text-muted">
                <Lock className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
                Sent by your team. It goes when someone on your team moves, cancels or sends a weather update for a booking, so there is no time to set here. You can still change the words.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem_8rem]">
                <Field label="Moment">
                  <Select
                    value={draft.timing.when}
                    onValueChange={(value) => {
                      const when = value as TriggerWhen
                      const hours = when === 'on_booking' ? 0 : Math.max(unit === 'days' ? 24 : 1, draft.timing.hours)
                      set({ timing: { when, hours } })
                    }}
                  >
                    <SelectTrigger aria-label="Moment"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MOMENTS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {hasOffset ? (
                  <>
                    <Field label="How long">
                      {(control) => <WholeNumber {...control} min={unit === 'days' ? 1 : 0} value={amount} onChange={setAmount} />}
                    </Field>
                    <Field label="In">
                      <Select
                        value={unit}
                        onValueChange={(value) => {
                          const next = value as Unit
                          setUnit(next)
                          // Keep the same moment when switching units, rounded to whole days.
                          if (next === 'days') set({ timing: { ...draft.timing, hours: Math.max(1, Math.round(draft.timing.hours / 24)) * 24 } })
                        }}
                      >
                        <SelectTrigger aria-label="Unit"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hours">Hours</SelectItem>
                          <SelectItem value="days">Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </>
                ) : null}
              </div>
            )}
          </Section>

          <Section title="Which activities" hint={(draft.activitySlugs ?? []).length === 0 ? 'Every activity. Tap to send it for some only.' : 'Only bookings of these.'}>
            <Chips label="Activities" options={activities.map((activity) => ({ value: activity.slug, label: activity.name }))} value={draft.activitySlugs ?? []} onChange={(activitySlugs) => set({ activitySlugs })} />
          </Section>

          <Section title="The message" icon={emailOn ? Mail : MessageSquareText}>
            <Field label="Send as" description={draft.channel === 'both' ? 'An email and a text, with the same words.' : undefined}>
              <Select value={draft.channel} onValueChange={(value) => set({ channel: value as MessageChannel })}>
                <SelectTrigger aria-label="Send as" className="sm:w-60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['email', 'sms', 'both'] as MessageChannel[]).map((value) => (
                    <SelectItem key={value} value={value}>{CHANNEL_LABEL[value]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {emailOn ? (
              <>
                <DetailText label="Email subject" value={draft.subject} onChange={(subject) => set({ subject })} placeholders={DETAILS} invalid={!draft.subject.trim()} />
                <EmailContentCard
                  design={draft.design}
                  onChange={(design) => set({ design })}
                  ctx={ctx}
                  subject={draft.subject}
                  text={draft.body}
                  brand={brand}
                  saved={savedTemplates}
                  onSaveTemplate={onSaveTemplate}
                  title={`${draft.name}: email`}
                />
              </>
            ) : null}
            <DetailText
              multiline
              label={draft.channel === 'email' ? 'Plain-text version' : draft.channel === 'both' ? 'The words (email text and the text message)' : 'Text message'}
              value={draft.body}
              onChange={(body) => set({ body })}
              placeholders={DETAILS}
              invalid={draft.body.trim().length < 5 && !draft.design}
              description={
                draft.channel === 'email'
                  ? draft.design
                    ? 'For inboxes that do not show designs.'
                    : 'The words of the letter. Details in [brackets] fill in for each guest.'
                  : `${length.chars} characters · sent as ${length.segments} ${length.segments === 1 ? 'text' : 'texts'}${length.encoding === 'unicode' ? ' (has special characters, so each part holds less)' : ''}. Details in [brackets] fill in for each guest.`
              }
            />
            {textOn ? (
              <div>
                <p className="text-xs font-medium text-subtle">How the text looks</p>
                <p className="mt-1.5 max-w-[20rem] rounded-2xl rounded-bl-md bg-surface-sunken px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line">{rendered}</p>
              </div>
            ) : null}
          </Section>

          {previewDesign ? (
            <Section title="How the email looks">
              <FittedEmail design={previewDesign} ctx={ctx} />
            </Section>
          ) : null}

          {onCopyAsAutomation && !staff ? (
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-sunken/40 p-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted">
                Need a follow-up, a check first or a message for some guests only? Make it an automation.
              </p>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Workflow />}
                className="shrink-0"
                onClick={() => {
                  if (changed) toast('Your changes went into the copy', { description: 'This booking message stays as it was saved.' })
                  onCopyAsAutomation(draft)
                }}
              >
                Copy as an automation
              </Button>
            </div>
          ) : null}

        </SheetBody>
        <SheetFooter>
          <Button
            variant="ghost"
            leftIcon={<Send />}
            onClick={() => toast.success('Test sent', { description: textOn && emailOn ? 'The email and the text, to your inbox and phone.' : textOn ? 'The text, to your phone.' : 'The email, to your inbox.' })}
          >
            Send me a test
          </Button>
          <div className="flex-1" />
          {problems.length > 0 ? (
            <p role="status" className="self-center text-xs text-danger sm:text-right">
              To save: {problems.join(' · ').toLowerCase()}
            </p>
          ) : null}
          <Button variant="ghost" leftIcon={<X />} onClick={close}>Cancel</Button>
          <Button leftIcon={<Check />} disabled={problems.length > 0} onClick={() => onSave(draft)}>Save</Button>
        </SheetFooter>
      </SheetContent>

      <Dialog open={leaving} onOpenChange={setLeaving}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Leave without saving?</DialogTitle>
            <DialogDescription>Your changes to {draft.name || 'this message'} will be lost. Guests keep getting the saved version.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLeaving(false)}>Keep editing</Button>
            <Button
              variant="danger"
              onClick={() => {
                setLeaving(false)
                onClose()
              }}
            >
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
