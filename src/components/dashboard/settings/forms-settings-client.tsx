'use client'

import * as React from 'react'
import { ClipboardList, Eye, Lock, MessageSquareText, Plus, RotateCcw, Save, ShoppingCart, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { FormFieldsEditor, kindLabel } from '@/components/dashboard/settings/form-fields-editor'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { DEFAULT_REQUEST_FORM, REQUEST_FORM_KEYS, type BookingDefaults, type CustomForm, type FieldMode, type RequestFormSettings } from '@/lib/booking-defaults'
import { REASON_LABEL } from '@/lib/booking-method'
import { cn } from '@/lib/utils'
import type { GuestQuestion, RequestReason, Tenant } from '@/types'

/* ==========================================================================
   FORMS — every form guests fill in, in one place:

     Checkout        name and email always; mobile, country and a note
                     required, optional or off; your own fields
     Requests        one form for each reason a guest asks instead of
                     booking (request to book, another date, a big group,
                     sooner than notice, a custom quote, a message)
     Your forms      forms you make, each a titled section at checkout,
                     on every activity or chosen ones

   Fields are asked once per booking. Saved with the booking defaults.
   ========================================================================== */

const MODES: { value: FieldMode; label: string }[] = [
  { value: 'required', label: 'Required' },
  { value: 'optional', label: 'Optional' },
  { value: 'off', label: 'Off' },
]

/** What each request form is for, in plain words. */
const REQUEST_HINT: Record<RequestReason, string> = {
  booking: 'Activities you confirm by hand, and ones with no set times.',
  date: 'When the day or time a guest wants isn’t on the calendar.',
  group: 'When a group is bigger than online booking takes.',
  sooner: 'When a guest wants to go sooner than your notice allows.',
  quote: 'When a guest wants something custom: a private version, an occasion.',
  message: 'A general question from the activity page.',
}

/** Built-in message hints, shown as the placeholder when the business sets none. */
const MESSAGE_HINT: Record<RequestReason, string> = {
  booking: 'Anything we should know? The occasion, who is coming, questions.',
  group: 'Tell us about your group: ages, the occasion, anything special.',
  date: 'Which day and time would suit you best?',
  sooner: 'When would you like to go?',
  quote: 'What would you like? A private version, a special occasion, something else.',
  message: 'What would you like to ask or arrange?',
}

/** When the date and party rows show on each request form. */
const ASKED_WHEN: Partial<Record<RequestReason, { label: string; note: string }[]>> = {
  booking: [
    { label: 'Preferred date and time of day', note: 'When there is no time to pick' },
    { label: 'How many people', note: 'When they haven’t picked yet' },
  ],
  date: [{ label: 'Preferred date and time of day', note: 'Always' }],
  group: [{ label: 'How many people', note: 'From what they picked' }],
  sooner: [{ label: 'Preferred date and time of day', note: 'Always' }],
}

type Selected = { kind: 'checkout' } | { kind: 'request'; reason: RequestReason } | { kind: 'custom'; id: string }

const sameSelected = (a: Selected, b: Selected) =>
  a.kind === b.kind && (a.kind !== 'request' || a.reason === (b as { reason: RequestReason }).reason) && (a.kind !== 'custom' || a.id === (b as { id: string }).id)

const cleanFields = (fields: GuestQuestion[]) =>
  fields
    .filter((field) => field.label.trim())
    .map((field) => ({ ...field, label: field.label.trim(), ...(field.options ? { options: field.options.map((option) => option.trim()).filter(Boolean) } : {}) }))

export interface FormsSettingsClientProps {
  tenant: Tenant
  activities: { slug: string; name: string }[]
}

export function FormsSettingsClient({ tenant, activities }: FormsSettingsClientProps) {
  const { defaults, save } = useBookingDefaults(tenant.slug)
  const [draft, setDraft] = React.useState<BookingDefaults>(defaults)
  const [selected, setSelected] = React.useState<Selected>({ kind: 'checkout' })
  const touched = React.useRef(false)
  React.useEffect(() => {
    if (!touched.current) setDraft(defaults)
  }, [defaults])

  const update = (next: BookingDefaults) => {
    touched.current = true
    setDraft(next)
  }
  const comparable = (value: BookingDefaults) => JSON.stringify([value.checkout, value.questions, value.requestForms, value.customForms])
  const dirty = comparable(draft) !== comparable(defaults)

  const requestForm = (reason: RequestReason): RequestFormSettings => draft.requestForms[reason] ?? DEFAULT_REQUEST_FORM
  const setRequestForm = (reason: RequestReason, patch: Partial<RequestFormSettings>) =>
    update({ ...draft, requestForms: { ...draft.requestForms, [reason]: { ...requestForm(reason), ...patch } } })
  const setCustom = (id: string, patch: Partial<CustomForm>) => update({ ...draft, customForms: draft.customForms.map((form) => (form.id === id ? { ...form, ...patch } : form)) })

  const createForm = () => {
    const id = `form_${Date.now().toString(36)}`
    update({ ...draft, customForms: [...draft.customForms, { id, name: '', fields: [], appliesTo: 'all', enabled: true }] })
    setSelected({ kind: 'custom', id })
  }
  const deleteForm = (id: string) => {
    update({ ...draft, customForms: draft.customForms.filter((form) => form.id !== id) })
    setSelected({ kind: 'checkout' })
  }

  const onSave = () => {
    const missing = draft.customForms.find((form) => !form.name.trim())
    if (missing) {
      setSelected({ kind: 'custom', id: missing.id })
      toast.error('Name your form', { description: 'Every form you make needs a name: it is the heading guests see at checkout.' })
      return
    }
    const clean: BookingDefaults = {
      ...defaults,
      checkout: draft.checkout,
      questions: cleanFields(draft.questions),
      requestForms: Object.fromEntries(Object.entries(draft.requestForms).map(([key, form]) => [key, { ...form!, fields: cleanFields(form!.fields) }])),
      customForms: draft.customForms.map((form) => ({ ...form, name: form.name.trim(), fields: cleanFields(form.fields) })),
    }
    if (save(clean)) {
      touched.current = false
      setDraft(clean)
      toast.success('Forms saved', { description: 'Checkout and request forms use these from now on.' })
    }
  }

  const custom = selected.kind === 'custom' ? draft.customForms.find((form) => form.id === selected.id) : undefined
  // A form that was just deleted or discarded: fall back to checkout.
  React.useEffect(() => {
    if (selected.kind === 'custom' && !draft.customForms.some((form) => form.id === selected.id)) setSelected({ kind: 'checkout' })
  }, [draft.customForms, selected])

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid min-w-0 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* ---------- the forms ---------- */}
        <nav aria-label="Forms" className="flex flex-col gap-5">
          <FormGroup title="Checkout">
            <FormLink
              icon={ShoppingCart}
              label="Checkout"
              note={`${2 + (['phone', 'country', 'requests'] as const).filter((key) => draft.checkout[key] !== 'off').length + draft.questions.length} fields`}
              active={selected.kind === 'checkout'}
              onClick={() => setSelected({ kind: 'checkout' })}
            />
          </FormGroup>
          <FormGroup title="Requests">
            {REQUEST_FORM_KEYS.map((reason) => (
              <FormLink
                key={reason}
                icon={MessageSquareText}
                label={REASON_LABEL[reason]}
                note={requestForm(reason).fields.length > 0 ? `${requestForm(reason).fields.length} of your fields` : 'Standard'}
                active={sameSelected(selected, { kind: 'request', reason })}
                onClick={() => setSelected({ kind: 'request', reason })}
              />
            ))}
          </FormGroup>
          <FormGroup title="Your forms">
            {draft.customForms.map((form) => (
              <FormLink
                key={form.id}
                icon={ClipboardList}
                label={form.name.trim() || 'Untitled form'}
                note={!form.enabled ? 'Off' : form.appliesTo === 'all' ? 'Every activity' : `${form.appliesTo.length} ${form.appliesTo.length === 1 ? 'activity' : 'activities'}`}
                active={sameSelected(selected, { kind: 'custom', id: form.id })}
                onClick={() => setSelected({ kind: 'custom', id: form.id })}
                muted={!form.enabled}
              />
            ))}
            <Button size="sm" variant="secondary" leftIcon={<Plus />} className="mt-1 self-start" onClick={createForm}>
              Create a form
            </Button>
          </FormGroup>
        </nav>

        {/* ---------- the selected form ---------- */}
        <div className="flex min-w-0 flex-col gap-6">
          {selected.kind === 'checkout' ? (
            <Card>
              <CardHeader>
                <CardTitle>Checkout</CardTitle>
                <CardDescription>What guests fill in when they book, on every activity. Fields for one activity only go on that activity’s Guests step.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-0">
                <Rows>
                  <FixedRow label="First and last name" />
                  <FixedRow label="Email" note="The confirmation goes here" />
                  <ModeRow label="Mobile number" value={draft.checkout.phone} onChange={(phone) => update({ ...draft, checkout: { ...draft.checkout, phone } })} />
                  <ModeRow label="Country" value={draft.checkout.country} onChange={(country) => update({ ...draft, checkout: { ...draft.checkout, country } })} />
                  <ModeRow label="Anything we should know?" value={draft.checkout.requests} onChange={(requests) => update({ ...draft, checkout: { ...draft.checkout, requests } })} />
                </Rows>
                <FieldsBlock title="Your fields" hint="Asked once per booking, under “For the whole booking”.">
                  <FormFieldsEditor fields={draft.questions} onChange={(questions) => update({ ...draft, questions })} idPrefix="q_biz" />
                </FieldsBlock>
              </CardContent>
            </Card>
          ) : selected.kind === 'request' ? (
            (() => {
              const reason = selected.reason
              const form = requestForm(reason)
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>{REASON_LABEL[reason]}</CardTitle>
                    <CardDescription>{REQUEST_HINT[reason]} Requests land in Custom requests.</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-6 pt-0">
                    <Field label="A line at the top" optional description="Shown above the fields.">
                      {(control) => <Input {...control} value={form.intro ?? ''} placeholder="We reply within a day with a price and a link to pay." onChange={(e) => setRequestForm(reason, { intro: e.target.value })} />}
                    </Field>
                    <Rows>
                      <FixedRow label="Name" />
                      <FixedRow label="Email" note="The reply goes here" />
                      {(ASKED_WHEN[reason] ?? []).map((row) => (
                        <FixedRow key={row.label} label={row.label} note={row.note} lockLabel="When needed" />
                      ))}
                      <ModeRow label="Mobile number" value={form.phone} onChange={(phone) => setRequestForm(reason, { phone })} />
                      <ModeRow label="Message" value={form.message} onChange={(message) => setRequestForm(reason, { message })}>
                        {form.message !== 'off' ? (
                          <Input
                            aria-label="Message hint"
                            value={form.messagePrompt ?? ''}
                            placeholder={MESSAGE_HINT[reason]}
                            onChange={(e) => setRequestForm(reason, { messagePrompt: e.target.value })}
                            className="mt-2"
                          />
                        ) : null}
                      </ModeRow>
                    </Rows>
                    <FieldsBlock title="Your fields" hint="Added after the message.">
                      <FormFieldsEditor fields={form.fields} onChange={(fields) => setRequestForm(reason, { fields })} idPrefix={`rq_${reason}`} />
                    </FieldsBlock>
                  </CardContent>
                </Card>
              )
            })()
          ) : custom ? (
            <Card>
              <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle>{custom.name.trim() || 'Untitled form'}</CardTitle>
                  <CardDescription>A section at checkout with its own heading and fields.</CardDescription>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Switch checked={custom.enabled} onCheckedChange={(enabled) => setCustom(custom.id, { enabled })} aria-label="Form on" />
                  {custom.enabled ? 'On' : 'Off'}
                </label>
              </CardHeader>
              <CardContent className="flex flex-col gap-6 pt-0">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Form name" required description="The heading guests see at checkout.">
                    {(control) => <Input {...control} value={custom.name} placeholder="Dietary needs" onChange={(e) => setCustom(custom.id, { name: e.target.value })} />}
                  </Field>
                  <Field label="A line under the name" optional>
                    {(control) => <Input {...control} value={custom.intro ?? ''} placeholder="Tell us so the kitchen can plan." onChange={(e) => setCustom(custom.id, { intro: e.target.value })} />}
                  </Field>
                </div>

                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Shown at checkout for</h3>
                  </div>
                  <Segmented
                    label="Shown at checkout for"
                    size="sm"
                    value={custom.appliesTo === 'all' ? 'all' : 'some'}
                    onValueChange={(value) => setCustom(custom.id, { appliesTo: value === 'all' ? 'all' : [] })}
                    options={[
                      { value: 'all', label: 'Every activity' },
                      { value: 'some', label: 'Chosen activities' },
                    ]}
                  />
                  {custom.appliesTo !== 'all' ? (
                    <ul className="grid list-none gap-1.5 p-0 sm:grid-cols-2">
                      {activities.map((activity) => {
                        const chosen = (custom.appliesTo as string[]).includes(activity.slug)
                        return (
                          <li key={activity.slug}>
                            <label className={cn('flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm', chosen ? 'border-primary/40 bg-primary-soft/30' : 'border-line')}>
                              <Checkbox
                                checked={chosen}
                                onCheckedChange={(checked) => {
                                  const list = custom.appliesTo === 'all' ? [] : custom.appliesTo
                                  setCustom(custom.id, { appliesTo: checked === true ? [...list, activity.slug] : list.filter((slug) => slug !== activity.slug) })
                                }}
                              />
                              <span className="min-w-0 truncate">{activity.name}</span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  ) : null}
                  {custom.appliesTo !== 'all' && custom.appliesTo.length === 0 ? <p className="text-xs font-medium text-warning">Pick at least one activity, or the form won’t show.</p> : null}
                </div>

                <FieldsBlock title="Fields" hint="Asked once per booking.">
                  <FormFieldsEditor fields={custom.fields} onChange={(fields) => setCustom(custom.id, { fields })} idPrefix="cf" />
                </FieldsBlock>

                <div className="border-t border-line-subtle pt-4">
                  <Button variant="ghost" size="sm" leftIcon={<Trash2 />} className="text-danger hover:bg-danger-soft" onClick={() => deleteForm(custom.id)}>
                    Delete this form
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* ---------- what guests see ---------- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="size-4 text-primary" aria-hidden="true" />
                What guests see
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <Preview draft={draft} selected={selected} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---------- save ---------- */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-[var(--shadow-md)] backdrop-blur">
        <p className="text-sm text-muted">{dirty ? 'You have changes that aren’t saved.' : 'All changes saved.'}</p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<RotateCcw />}
            disabled={!dirty}
            onClick={() => {
              touched.current = false
              setDraft(defaults)
            }}
          >
            Reset
          </Button>
          <Button size="sm" leftIcon={<Save />} onClick={onSave} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ---------- the list ---------- */

function FormGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 text-xs font-semibold tracking-wide text-subtle uppercase">{title}</p>
      {children}
    </div>
  )
}

function FormLink({ icon: Icon, label, note, active, muted, onClick }: { icon: typeof ShoppingCart; label: string; note: string; active: boolean; muted?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        active ? 'bg-primary-soft/50 text-foreground' : 'hover:bg-surface-sunken',
      )}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', active ? 'text-primary' : 'text-subtle')} aria-hidden="true" />
      <span className="min-w-0">
        <span className={cn('block truncate text-sm font-medium', muted ? 'text-muted' : 'text-foreground')}>{label}</span>
        <span className="block text-xs text-subtle">{note}</span>
      </span>
    </button>
  )
}

/* ---------- rows ---------- */

function Rows({ children }: { children: React.ReactNode }) {
  return <ul className="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line">{children}</ul>
}

function FixedRow({ label, note, lockLabel = 'Always asked' }: { label: string; note?: string; lockLabel?: string }) {
  return (
    <li className="flex items-center justify-between gap-4 bg-surface px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {note ? <span className="block text-xs text-subtle">{note}</span> : null}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-subtle">
        <Lock className="size-3.5" aria-hidden="true" />
        {lockLabel}
      </span>
    </li>
  )
}

function ModeRow({ label, value, onChange, children }: { label: string; value: FieldMode; onChange: (value: FieldMode) => void; children?: React.ReactNode }) {
  return (
    <li className={cn('bg-surface px-4 py-3', value === 'off' && 'bg-surface-sunken/40')}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span className={cn('text-sm font-medium', value === 'off' ? 'text-muted' : 'text-foreground')}>{label}</span>
        <Segmented label={label} size="sm" value={value} onValueChange={onChange} options={MODES} />
      </div>
      {children}
    </li>
  )
}

function FieldsBlock({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs text-subtle">{hint}</p>
      </div>
      {children}
    </div>
  )
}

/* ---------- the preview: the form as guests see it, not live ---------- */

function Preview({ draft, selected }: { draft: BookingDefaults; selected: Selected }) {
  const rows: { label: string; kind: string; required: boolean; options?: string[]; long?: boolean }[] = []
  const add = (label: string, kind: string, required: boolean, extra: { options?: string[]; long?: boolean } = {}) => rows.push({ label, kind, required, ...extra })
  const addFields = (fields: GuestQuestion[]) =>
    fields.filter((field) => field.label.trim()).forEach((field) => add(field.label, kindLabel(field), field.required, { options: field.options, long: field.kind === 'text' && !field.short }))
  let heading = ''
  let note: string | undefined

  if (selected.kind === 'checkout') {
    heading = 'Your details'
    add('First and last name', 'Short answer', true)
    add('Email', 'Short answer', true)
    if (draft.checkout.phone !== 'off') add('Mobile', 'Short answer', draft.checkout.phone === 'required')
    if (draft.checkout.country !== 'off') add('Country of residence', 'Pick one', draft.checkout.country === 'required')
    if (draft.checkout.requests !== 'off') add('Anything we should know?', 'Long answer', draft.checkout.requests === 'required', { long: true })
    addFields(draft.questions)
  } else if (selected.kind === 'request') {
    const form = draft.requestForms[selected.reason] ?? DEFAULT_REQUEST_FORM
    heading = REASON_LABEL[selected.reason]
    note = form.intro?.trim() || undefined
    for (const row of ASKED_WHEN[selected.reason] ?? []) add(row.label, 'Asked when needed', true)
    add('Your name', 'Short answer', true)
    add('Email', 'Short answer', true)
    if (form.phone !== 'off') add('Mobile', 'Short answer', form.phone === 'required')
    if (form.message !== 'off') add(form.messagePrompt?.trim() || MESSAGE_HINT[selected.reason], 'Long answer', form.message === 'required', { long: true })
    addFields(form.fields)
  } else {
    const form = draft.customForms.find((entry) => entry.id === selected.id)
    heading = form?.name.trim() || 'Untitled form'
    note = form?.intro?.trim() || undefined
    if (form) addFields(form.fields)
  }

  return (
    <div className="rounded-2xl border border-line bg-background-subtle p-4 sm:p-5">
      <p className="text-sm font-semibold text-foreground">{heading}</p>
      {note ? <p className="mt-0.5 text-xs text-muted">{note}</p> : null}
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No fields yet. Add one above.</p>
      ) : (
        <div className="mt-3 grid max-w-md gap-3">
          {rows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="flex flex-col gap-1.5">
              <span className="text-[0.8125rem] font-medium text-foreground">
                {row.label}
                {row.required ? <span className="text-danger"> *</span> : <span className="font-normal text-subtle"> · optional</span>}
              </span>
              {row.long ? (
                <Textarea rows={2} disabled aria-label={row.label} />
              ) : row.options && row.options.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {row.options.slice(0, 6).map((option) => (
                    <span key={option} className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-muted">
                      {option}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex h-10 items-center rounded-lg border border-line bg-surface px-3 text-xs text-subtle">{row.kind}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
