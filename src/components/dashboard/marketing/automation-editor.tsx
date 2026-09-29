'use client'

import * as React from 'react'
import { ArrowDown, Check, Clock, Mail, MessageSquareText, Plus, Send, Tag, Trash2, X, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { EmailContentCard } from '@/components/dashboard/marketing/email-content-card'
import { EmailFrame } from '@/components/dashboard/marketing/email-designer'
import { designFromText, type EmailContext, type EmailDesign, type SavedEmailTemplate } from '@/lib/email-design'
import { NO_OFFER, cleanCode } from '@/lib/marketing'
import {
  CHANNEL_LABEL,
  PLACEHOLDERS,
  TRIGGER_OPTIONS,
  groupOf,
  offerOf,
  renderTemplate,
  rulesOf,
  timingLabel,
  type AutomationRules,
  type AutomationStep,
  type MessageChannel,
  type MessageTemplate,
} from '@/lib/messaging'
import { cn } from '@/lib/utils'

/* ==========================================================================
   AUTOMATION EDITOR
   Everything about one automation: what starts it, the window it may go in,
   who gets it and who is skipped, the first message (a designed email or a
   text), follow-ups that wait and check what the guest did, what ends it,
   how often a guest can get it, and a discount code.
   ========================================================================== */

const BOOKING_TRIGGERS = new Set(['on_booking', 'before', 'after', 'manual'])
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ONLY_IF: Record<AutomationStep['onlyIf'], string> = {
  always: 'always',
  not_opened: 'only if they did not open it',
  not_clicked: 'only if they did not click',
  not_booked: 'only if they have not booked',
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

function Toggle({ title, text, checked, onChange }: { title: string; text?: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>
        {title}
        {text ? <span className="block text-xs text-subtle">{text}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
    </label>
  )
}

export function AutomationEditor({
  template,
  onClose,
  onSave,
  onDelete,
  ctx,
  brand,
  savedTemplates,
  onSaveTemplate,
  audiences,
  activities,
  tags,
  countries,
}: {
  template: MessageTemplate
  onClose: () => void
  onSave: (template: MessageTemplate) => void
  onDelete?: () => void
  ctx: EmailContext
  brand: string[]
  savedTemplates: SavedEmailTemplate[]
  onSaveTemplate: (name: string, design: EmailDesign) => void
  audiences: { id: string; name: string; count: number }[]
  activities: { slug: string; name: string }[]
  tags: string[]
  countries: string[]
}) {
  const [draft, setDraft] = React.useState<MessageTemplate>(template)
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)
  const set = (patch: Partial<MessageTemplate>) => setDraft((current) => ({ ...current, ...patch }))
  const rules = rulesOf(draft)
  const setRules = (patch: Partial<AutomationRules>) => set({ rules: { ...rules, ...patch } })
  const growth = groupOf(draft) === 'growth'
  const trigger = TRIGGER_OPTIONS.find((option) => option.value === draft.timing.when) ?? TRIGGER_OPTIONS[0]
  const triggers = TRIGGER_OPTIONS.filter((option) => growth || draft.custom || BOOKING_TRIGGERS.has(option.value))
  const offer = offerOf(draft)
  const setOffer = (patch: Partial<typeof offer>) => set({ offer: { ...NO_OFFER, ...draft.offer, ...patch } })
  const vars = { ...ctx.vars, offer_code: cleanCode(offer.code) || 'CODE', offer_percent: `${offer.percent}%` }
  const context = { ...ctx, vars }
  const rendered = renderTemplate(draft.body, vars)
  const amount = trigger.unit === 'days' ? Math.round(draft.timing.hours / 24) : draft.timing.hours
  const steps = draft.steps ?? []
  const setStep = (id: string, patch: Partial<AutomationStep>) => set({ steps: steps.map((step) => (step.id === id ? { ...step, ...patch } : step)) })
  const emailFirst = draft.channel !== 'sms'
  const problems = [draft.name.trim().length < 2 ? 'Give it a name' : null, draft.body.trim().length < 5 && !draft.design ? 'Write the message' : null].filter(Boolean) as string[]

  const insert = (token: string) => {
    const el = bodyRef.current
    const at = el?.selectionStart ?? draft.body.length
    set({ body: draft.body.slice(0, at) + token + draft.body.slice(el?.selectionEnd ?? at) })
  }

  const flow = [
    { label: timingLabel(draft.timing), icon: Zap },
    { label: `${draft.channel === 'sms' ? 'Text' : draft.channel === 'both' ? 'Email and text' : 'Email'}: ${renderTemplate(draft.channel === 'sms' ? draft.body : draft.subject, vars).slice(0, 64)}`, icon: draft.channel === 'sms' ? MessageSquareText : Mail },
    ...steps.flatMap((step) => [
      { label: `Wait ${step.waitDays} ${step.waitDays === 1 ? 'day' : 'days'}, ${ONLY_IF[step.onlyIf]}`, icon: Clock },
      { label: `${step.channel === 'sms' ? 'Text' : 'Email'}: ${renderTemplate(step.channel === 'sms' ? step.body : step.subject, vars).slice(0, 64) || 'Follow-up'}`, icon: step.channel === 'sms' ? MessageSquareText : Mail },
    ]),
  ]

  return (
    <Sheet open onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" size="xl">
        <SheetHeader>
          <SheetTitle>{draft.custom ? draft.name || 'New automation' : draft.name}</SheetTitle>
          <SheetDescription>{draft.purpose || 'Your own automation.'}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-6">
          {/* ---------- the flow at a glance ---------- */}
          <ol className="flex list-none flex-col gap-1 rounded-xl border border-line bg-surface-sunken/40 p-3">
            {flow.map((item, index) => (
              <li key={index} className="flex flex-col">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-surface text-subtle">
                    <item.icon className="size-3.5" />
                  </span>
                  <span className="truncate">{item.label}</span>
                </span>
                {index < flow.length - 1 ? <ArrowDown className="my-0.5 ml-1.5 size-3 text-faint" aria-hidden="true" /> : null}
              </li>
            ))}
            {rules.exitOn !== 'never' ? <li className="mt-1 text-xs text-subtle">Stops early once they {rules.exitOn === 'booked' ? 'book' : 'click'}.</li> : null}
          </ol>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <Field label="Name">{(control) => <Input {...control} value={draft.name} onChange={(e) => set({ name: e.target.value })} />}</Field>
            <label className="flex h-10 items-center gap-2 text-sm font-medium">
              <Switch checked={draft.enabled} onCheckedChange={(enabled) => set({ enabled })} aria-label="On" />
              {draft.enabled ? 'On' : 'Off'}
            </label>
          </div>

          <Section title="What starts it" icon={Zap}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Moment" className="sm:col-span-2">
                <Select
                  value={draft.timing.when}
                  onValueChange={(value) => {
                    const next = TRIGGER_OPTIONS.find((option) => option.value === value)!
                    const hours = next.hours === 'none' ? 0 : next.unit === 'days' ? Math.max(24, draft.timing.hours) : Math.max(1, draft.timing.hours)
                    set({ timing: { when: next.value, hours } })
                  }}
                >
                  <SelectTrigger aria-label="Moment"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {triggers.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {trigger.hours !== 'none' ? (
                <Field label={trigger.unit === 'days' ? 'Days' : 'Hours'}>
                  {(control) => (
                    <Input {...control} type="number" min={0} value={amount} onChange={(e) => { const value = Math.max(0, Number(e.target.value) || 0); set({ timing: { ...draft.timing, hours: trigger.unit === 'days' ? value * 24 : value } }) }} />
                  )}
                </Field>
              ) : null}
            </div>
            <div>
              <p className="text-[0.8125rem] font-medium">Only on these days</p>
              <p className="mt-0.5 text-xs text-subtle">{rules.days.length === 0 ? 'Any day. Pick days to hold it until one of them.' : 'Held until the next of these days.'}</p>
              <div className="mt-2">
                <Chips label="Days" options={WEEKDAYS.map((label, index) => ({ value: String(index), label }))} value={rules.days.map(String)} onChange={(next) => setRules({ days: next.map(Number).sort() })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Send at" description="In the guest’s time zone. Empty: as soon as it is due.">
                {(control) => <Input {...control} type="time" value={rules.sendAt} onChange={(e) => setRules({ sendAt: e.target.value })} />}
              </Field>
            </div>
          </Section>

          <Section title="Who gets it" hint={growth || draft.custom ? 'Marketing goes only to guests who said yes.' : 'Booking messages go to every guest of the booking.'}>
            {growth || draft.custom ? (
              <Field label="Audience">
                <Select value={draft.audienceId ?? 'aud_all'} onValueChange={(audienceId) => set({ audienceId })}>
                  <SelectTrigger aria-label="Audience"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {audiences.map((audience) => (
                      <SelectItem key={audience.id} value={audience.id}>{audience.name} · {audience.count.toLocaleString('en-US')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            <div>
              <p className="text-[0.8125rem] font-medium">Activities</p>
              <p className="mt-0.5 text-xs text-subtle">{(draft.activitySlugs ?? []).length === 0 ? 'Every activity. Tap to limit it.' : 'Only guests of these.'}</p>
              <div className="mt-2">
                <Chips label="Activities" options={activities.map((activity) => ({ value: activity.slug, label: activity.name }))} value={draft.activitySlugs ?? []} onChange={(activitySlugs) => set({ activitySlugs })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Groups of at least" optional>
                {(control) => <Input {...control} type="number" min={0} suffix="guests" placeholder="Any" value={rules.minPartySize || ''} onChange={(e) => setRules({ minPartySize: Math.max(0, Number(e.target.value) || 0) })} />}
              </Field>
              <Field label="Skip if they booked in the last" optional>
                {(control) => <Input {...control} type="number" min={0} suffix="days" placeholder="Off" value={rules.skipBookedWithinDays || ''} onChange={(e) => setRules({ skipBookedWithinDays: Math.max(0, Number(e.target.value) || 0) })} />}
              </Field>
            </div>
            {countries.length > 1 ? (
              <div>
                <p className="text-[0.8125rem] font-medium">Only guests from</p>
                <div className="mt-2">
                  <Chips label="Countries" options={countries.map((value) => ({ value, label: value }))} value={rules.countries} onChange={(next) => setRules({ countries: next })} />
                </div>
              </div>
            ) : null}
            {tags.length > 0 ? (
              <div>
                <p className="text-[0.8125rem] font-medium">Never to guests tagged</p>
                <div className="mt-2">
                  <Chips label="Excluded tags" options={tags.map((value) => ({ value, label: value }))} value={rules.excludeTags} onChange={(next) => setRules({ excludeTags: next })} />
                </div>
              </div>
            ) : null}
          </Section>

          <Section title="The first message" icon={emailFirst ? Mail : MessageSquareText}>
            <Field label="Send as">
              <Select value={draft.channel} onValueChange={(value) => set({ channel: value as MessageChannel })}>
                <SelectTrigger aria-label="Send as" className="sm:w-60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['email', 'sms', 'both'] as MessageChannel[]).map((value) => (
                    <SelectItem key={value} value={value}>{CHANNEL_LABEL[value]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {emailFirst ? (
              <>
                <Field label="Email subject">{(control) => <Input {...control} value={draft.subject} onChange={(e) => set({ subject: e.target.value })} />}</Field>
                <Toggle title="Test a second subject" text="Half get each. After a day the one with more opens goes to everyone." checked={Boolean(draft.abTest?.enabled)} onChange={(enabled) => set({ abTest: { subjectB: draft.abTest?.subjectB ?? '', enabled } })} />
                {draft.abTest?.enabled ? (
                  <Field label="Subject B">{(control) => <Input {...control} value={draft.abTest?.subjectB ?? ''} onChange={(e) => set({ abTest: { enabled: true, subjectB: e.target.value } })} />}</Field>
                ) : null}
                <EmailContentCard
                  design={draft.design}
                  onChange={(design) => set({ design })}
                  ctx={context}
                  subject={draft.subject}
                  text={draft.body}
                  brand={brand}
                  saved={savedTemplates}
                  onSaveTemplate={onSaveTemplate}
                  title={`${draft.name}: email`}
                />
              </>
            ) : null}
            <div>
              <Field
                label={emailFirst ? (draft.channel === 'both' ? 'Text message' : 'Plain-text version') : 'Text message'}
                description={
                  draft.channel === 'email'
                    ? draft.design
                      ? 'For inboxes that do not show designs, and the text fallback.'
                      : 'The words of the letter.'
                    : `${rendered.length} characters · ${Math.max(1, Math.ceil(rendered.length / 160))} text ${rendered.length > 160 ? 'segments' : 'segment'}`
                }
              >
                {(control) => <Textarea {...control} ref={bodyRef} rows={5} value={draft.body} onChange={(e) => set({ body: e.target.value })} />}
              </Field>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((entry) => (
                  <button key={entry.token} type="button" onClick={() => insert(entry.token)} className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted hover:border-primary/50 hover:text-foreground" title={`Insert ${entry.label}`}>
                    {entry.token}
                  </button>
                ))}
              </div>
            </div>
            {draft.channel !== 'email' ? <p className="max-w-[20rem] rounded-2xl rounded-bl-md bg-surface-sunken px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line">{rendered}</p> : null}
            <Toggle title="Use the other channel when one is missing" text="No email on file? The text goes instead, and the other way round." checked={rules.fallback} onChange={(fallback) => setRules({ fallback })} />
          </Section>

          <Section title="Follow-ups" hint="More messages after the first, each after a wait. They can check what the guest did first." icon={Clock}>
            {steps.length === 0 ? <p className="text-sm text-subtle">No follow-ups. One message is often enough.</p> : null}
            <ol className="flex list-none flex-col gap-3 p-0">
              {steps.map((step, index) => (
                <li key={step.id} className="flex flex-col gap-3 rounded-xl border border-line p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Follow-up {index + 1}</p>
                    <Button type="button" size="xs" variant="ghost" leftIcon={<Trash2 />} onClick={() => set({ steps: steps.filter((entry) => entry.id !== step.id) })}>Remove</Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Wait">{(control) => <Input {...control} type="number" min={1} suffix="days" value={step.waitDays} onChange={(e) => setStep(step.id, { waitDays: Math.max(1, Number(e.target.value) || 1) })} />}</Field>
                    <Field label="Send">
                      <Select value={step.onlyIf} onValueChange={(value) => setStep(step.id, { onlyIf: value as AutomationStep['onlyIf'] })}>
                        <SelectTrigger aria-label="Condition"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="always">Always</SelectItem>
                          <SelectItem value="not_opened">If they did not open</SelectItem>
                          <SelectItem value="not_clicked">If they did not click</SelectItem>
                          <SelectItem value="not_booked">If they have not booked</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="As">
                      <Select value={step.channel} onValueChange={(value) => setStep(step.id, { channel: value as 'email' | 'sms' })}>
                        <SelectTrigger aria-label="Channel"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">Text</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  {step.channel === 'email' ? (
                    <>
                      <Field label="Subject">{(control) => <Input {...control} value={step.subject} onChange={(e) => setStep(step.id, { subject: e.target.value })} />}</Field>
                      <EmailContentCard
                        design={step.design}
                        onChange={(design) => setStep(step.id, { design })}
                        ctx={context}
                        subject={step.subject}
                        text={step.body}
                        brand={brand}
                        saved={savedTemplates}
                        onSaveTemplate={onSaveTemplate}
                        title={`${draft.name}: follow-up ${index + 1}`}
                      />
                    </>
                  ) : null}
                  <Field label={step.channel === 'email' ? 'Plain-text version' : 'Text message'}>{(control) => <Textarea {...control} rows={3} value={step.body} onChange={(e) => setStep(step.id, { body: e.target.value })} />}</Field>
                </li>
              ))}
            </ol>
            {steps.length < 5 ? (
              <Button
                type="button"
                variant="secondary"
                leftIcon={<Plus />}
                className="self-start"
                onClick={() =>
                  set({
                    steps: [
                      ...steps,
                      {
                        id: `st_${Date.now().toString(36)}`,
                        waitDays: 3,
                        onlyIf: 'not_booked',
                        channel: 'email',
                        subject: `A quick reminder, {first_name}`,
                        body: 'Hi {first_name}, just a nudge in case you missed our last note. {book_link}',
                      },
                    ],
                  })
                }
              >
                Add a follow-up
              </Button>
            ) : null}
          </Section>

          <Section title="Ending and frequency">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Stop early when they">
                <Select value={rules.exitOn} onValueChange={(value) => setRules({ exitOn: value as AutomationRules['exitOn'] })}>
                  <SelectTrigger aria-label="Stop early"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booked">Book</SelectItem>
                    <SelectItem value="clicked">Click a link</SelectItem>
                    <SelectItem value="never">Never stop early</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="One guest can get it">
                <Select value={rules.repeat} onValueChange={(value) => setRules({ repeat: value as AutomationRules['repeat'] })}>
                  <SelectTrigger aria-label="Frequency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Once, ever</SelectItem>
                    <SelectItem value="every">Every time it is due</SelectItem>
                    <SelectItem value="cooldown">Again after a break</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              {rules.repeat === 'cooldown' ? (
                <Field label="Break">{(control) => <Input {...control} type="number" min={1} suffix="days" value={rules.cooldownDays} onChange={(e) => setRules({ cooldownDays: Math.max(1, Number(e.target.value) || 1) })} />}</Field>
              ) : null}
            </div>
          </Section>

          <Section title="Discount code" icon={Tag}>
            <Toggle title="Include a discount code" text="Saved in Pricing → Promo codes so checkout takes it. Shows in {offer_code} and the Discount code block." checked={offer.enabled} onChange={(enabled) => setOffer({ enabled, code: offer.code || `${draft.name.replace(/[^a-z]/gi, '').slice(0, 8).toUpperCase()}${offer.percent}` })} />
            {offer.enabled ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Code">{(control) => <Input {...control} className="font-mono" value={offer.code} onChange={(e) => setOffer({ code: cleanCode(e.target.value) })} />}</Field>
                <Field label="Discount">{(control) => <Input {...control} type="number" min={1} max={100} suffix="%" value={offer.percent} onChange={(e) => setOffer({ percent: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })} />}</Field>
                <Field label="Good for">{(control) => <Input {...control} type="number" min={1} suffix="days" value={offer.validDays} onChange={(e) => setOffer({ validDays: Math.max(1, Number(e.target.value) || 1) })} />}</Field>
              </div>
            ) : null}
          </Section>

          {emailFirst ? (
            <Section title="Preview">
              <div className="overflow-hidden rounded-xl border border-line" style={{ background: (draft.design ?? designFromText(draft.subject, draft.body, brand[0] ?? '#601CEF')).theme.background }}>
                <EmailFrame design={draft.design ?? designFromText(draft.subject, draft.body, brand[0] ?? '#601CEF')} ctx={context} width={600} scale={0.9} className="mx-auto" />
              </div>
            </Section>
          ) : null}

          {problems.length > 0 ? <p className="text-xs text-danger">{problems.join(' · ')}</p> : null}
        </SheetBody>
        <SheetFooter>
          {onDelete ? (
            <Button variant="ghost" leftIcon={<Trash2 />} onClick={onDelete}>Delete</Button>
          ) : null}
          <Button variant="ghost" leftIcon={<Send />} onClick={() => toast.success('Test sent', { description: 'Every message in it, to your inbox and phone.' })}>
            Send me a test
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" leftIcon={<X />} onClick={onClose}>Cancel</Button>
          <Button leftIcon={<Check />} disabled={problems.length > 0} onClick={() => onSave(draft)}>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
