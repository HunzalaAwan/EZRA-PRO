'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarClock, CreditCard, FormInput, Lock, Plus, RotateCcw, Save, ShieldCheck, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { BeforeInput } from '@/components/dashboard/activities/changes-policy-editor'
import { PaymentTermsEditor } from '@/components/dashboard/activities/payment-terms-editor'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { DEFAULT_BOOKING_DEFAULTS, type BookingDefaults, type FieldMode } from '@/lib/booking-defaults'
import { policySummary } from '@/lib/booking-policy'
import type { BookingRow } from '@/lib/demo'
import { cn } from '@/lib/utils'
import type { GuestQuestion, GuestQuestionKind, Payment, Tenant } from '@/types'

type SampleBooking = (BookingRow & { payments: Payment[] }) | undefined

/* ==========================================================================
   BOOKING FLOW — the business-wide rules: the calendar window and
   waitlists, what checkout asks for (and your own questions), and the
   default payment and cancellation terms. An activity can set its own
   payment or cancellation terms; when it does, those win.
   ========================================================================== */

export interface BookingFlowSettingsClientProps {
  tenant: Tenant
  sampleBooking: SampleBooking
}

const MODES: { value: FieldMode; label: string }[] = [
  { value: 'required', label: 'Required' },
  { value: 'optional', label: 'Optional' },
  { value: 'off', label: 'Off' },
]

const QUESTION_KINDS: { value: GuestQuestionKind | 'long'; label: string }[] = [
  { value: 'text', label: 'Short answer' },
  { value: 'long', label: 'Long answer' },
  { value: 'yesno', label: 'Yes or no' },
  { value: 'choice', label: 'Pick one' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
]

const kindValue = (question: GuestQuestion) => (question.kind === 'text' && !question.short ? 'long' : question.kind)

export function BookingFlowSettingsClient({ tenant }: BookingFlowSettingsClientProps) {
  const { defaults, save } = useBookingDefaults(tenant.slug)
  const [draft, setDraft] = React.useState<BookingDefaults>(defaults)
  // The saved settings land just after the first paint: take them while nothing has been changed here.
  const touched = React.useRef(false)
  React.useEffect(() => {
    if (!touched.current) setDraft(defaults)
  }, [defaults])

  const update = (next: BookingDefaults) => {
    touched.current = true
    setDraft(next)
  }
  const set = <K extends keyof BookingDefaults>(key: K, value: BookingDefaults[K]) => update({ ...draft, [key]: value })
  // Closed days and holidays are edited on Availability, so they never count as a change here.
  const comparable = (value: BookingDefaults) => JSON.stringify({ ...value, closures: undefined, holidays: undefined })
  const dirty = comparable(draft) !== comparable(defaults)

  const onSave = () => {
    // Closed days and holidays are set on Availability: always save the latest ones.
    const clean = { ...draft, questions: draft.questions.filter((question) => question.label.trim()), closures: defaults.closures, holidays: defaults.holidays }
    if (save(clean)) {
      touched.current = false
      setDraft(clean)
      toast.success('Booking flow saved', { description: 'Every activity that follows the defaults uses these from now on.' })
    }
  }

  const addQuestion = () =>
    set('questions', [...draft.questions, { id: `q_biz_${Date.now().toString(36)}`, label: '', kind: 'text', short: true, scope: 'booking', required: false }])
  const setQuestion = (id: string, patch: Partial<GuestQuestion>) => set('questions', draft.questions.map((question) => (question.id === id ? { ...question, ...patch } : question)))

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* ---------- checkout fields ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FormInput className="size-4 text-primary" aria-hidden="true" />
            Checkout fields
          </CardTitle>
          <CardDescription>What guests fill in when they book. The same on every activity.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pt-0">
          <ul className="divide-y divide-line-subtle overflow-hidden rounded-xl border border-line">
            <FixedRow label="First and last name" />
            <FixedRow label="Email" note="The confirmation goes here" />
            <ModeRow label="Mobile number" value={draft.checkout.phone} onChange={(phone) => set('checkout', { ...draft.checkout, phone })} />
            <ModeRow label="Country" value={draft.checkout.country} onChange={(country) => set('checkout', { ...draft.checkout, country })} />
            <ModeRow label="Anything we should know?" value={draft.checkout.requests} onChange={(requests) => set('checkout', { ...draft.checkout, requests })} />
          </ul>

          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Your own questions</h3>
              <p className="mt-0.5 text-xs text-subtle">Asked once per booking, on every activity. Questions for one activity only go on that activity’s Guests step.</p>
            </div>
            {draft.questions.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {draft.questions.map((question) => (
                  <li key={question.id} className="flex flex-col gap-3 rounded-xl border border-line p-3 sm:flex-row sm:items-start">
                    <Input
                      aria-label="Question"
                      value={question.label}
                      onChange={(event) => setQuestion(question.id, { label: event.target.value })}
                      placeholder="e.g. How did you hear about us?"
                      className="sm:flex-1"
                    />
                    <Select
                      value={kindValue(question)}
                      onValueChange={(value) =>
                        setQuestion(question.id, value === 'long' ? { kind: 'text', short: false } : { kind: value as GuestQuestionKind, short: value === 'text' ? true : undefined })
                      }
                    >
                      <SelectTrigger aria-label="Answer type" className="sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {QUESTION_KINDS.map((kind) => (
                          <SelectItem key={kind.value} value={kind.value}>
                            {kind.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {question.kind === 'choice' ? (
                      <Input
                        aria-label="Choices"
                        value={(question.options ?? []).join(', ')}
                        onChange={(event) => setQuestion(question.id, { options: event.target.value.split(',').map((option) => option.trimStart()) })}
                        onBlur={() => setQuestion(question.id, { options: (question.options ?? []).map((option) => option.trim()).filter(Boolean) })}
                        placeholder="Choices, separated by commas"
                        className="sm:w-56"
                      />
                    ) : null}
                    <label className="flex h-10 shrink-0 items-center gap-2 text-sm text-muted">
                      <Switch checked={question.required} onCheckedChange={(required) => setQuestion(question.id, { required })} aria-label="Required" />
                      Required
                    </label>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label="Remove question"
                      className="self-end text-muted hover:text-danger sm:self-center"
                      onClick={() => set('questions', draft.questions.filter((entry) => entry.id !== question.id))}
                    >
                      <Trash2 />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : null}
            <Button size="sm" variant="secondary" leftIcon={<Plus />} className="self-start" onClick={addQuestion}>
              Add a question
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---------- payment ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4 text-primary" aria-hidden="true" />
            Payment and deposits
          </CardTitle>
          <CardDescription>The default for every activity. An activity can set its own on its Pricing step.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <PaymentTermsEditor value={draft.payment} onChange={(payment) => set('payment', payment)} currency={tenant.currency} examplePrice={10000} businessWide />
        </CardContent>
      </Card>

      {/* ---------- cancellation ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
            Cancellation policy
          </CardTitle>
          <CardDescription>The default for every activity. An activity can set its own on its Booking step.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full refund until" description="Before the start. 0: no free cancellation.">
              {({ id }) => <BeforeInput id={id} hours={draft.cancellation.freeCancellationHours} onHours={(freeCancellationHours) => set('cancellation', { ...draft.cancellation, freeCancellationHours })} />}
            </Field>
            <Field label="After that, refund" description="0: nothing back after the free window.">
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  suffix="%"
                  value={draft.cancellation.lateRefundPercent}
                  onChange={(event) => set('cancellation', { ...draft.cancellation, lateRefundPercent: Math.min(100, Math.max(0, Math.round(Number(event.target.value)) || 0)) })}
                />
              )}
            </Field>
          </div>
          {draft.payment.collect === 'deposit' ? (
            <ToggleRow
              title="Keep the deposit"
              body="The deposit is not refunded, even when guests cancel in time."
              checked={draft.cancellation.keepDeposit}
              onCheckedChange={(keepDeposit) => set('cancellation', { ...draft.cancellation, keepDeposit })}
            />
          ) : null}
          <p className="rounded-lg bg-surface-sunken px-3 py-2.5 text-xs text-muted">
            <span className="font-semibold text-foreground">Guests read: </span>
            {policySummary(draft.cancellation, draft.payment)}
          </p>
        </CardContent>
      </Card>

      {/* ---------- calendar ---------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" aria-hidden="true" />
            Calendar and sold-out times
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pt-0">
          <Field label="Booking window" description="How far ahead guests can book, unless an activity sets its own." className="sm:max-w-sm">
            {({ id }) => (
              <Select value={String(draft.maxAdvanceDays)} onValueChange={(value) => set('maxAdvanceDays', Number(value))}>
                <SelectTrigger id={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[90, 180, 365, 540].map((days) => (
                    <SelectItem key={days} value={String(days)}>
                      {days} days ahead
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>
          <p className="-mt-2 text-xs text-subtle">
            Closed days and public holidays are on{' '}
            <Link href="/dashboard/availability" className="font-medium text-primary hover:underline">
              Availability
            </Link>
            .
          </p>
          <ToggleRow
            title="Waitlist on sold-out times"
            body="Guests join a list instead of leaving. You keep the demand."
            checked={draft.waitlists && tenant.features.waitlists}
            disabled={!tenant.features.waitlists}
            onCheckedChange={(value) => set('waitlists', value)}
            badge={tenant.features.waitlists ? undefined : <Badge variant="warning" size="sm">Growth plan</Badge>}
          />
          <ToggleRow
            title="Offer freed spots to the waitlist"
            body="When someone cancels or moves, the next guest on the list gets 30 minutes to take the spot."
            checked={draft.waitlistAutoPromote}
            disabled={!draft.waitlists || !tenant.features.waitlists}
            onCheckedChange={(value) => set('waitlistAutoPromote', value)}
          />
        </CardContent>
      </Card>

      <p className="text-xs text-subtle">
        Changes guests can make, booking notice, guest details and waivers are set on each activity.{' '}
        <Link href="/dashboard/activities" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          Go to activities
          <ArrowRight className="size-3" aria-hidden="true" />
        </Link>
      </p>

      {/* ---------- save ---------- */}
      <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-xs">
        <p className="text-sm text-muted">{dirty ? 'You have unsaved changes.' : 'All saved.'}</p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<RotateCcw />}
            disabled={comparable(draft) === comparable(DEFAULT_BOOKING_DEFAULTS)}
            onClick={() => update({ ...DEFAULT_BOOKING_DEFAULTS, closures: defaults.closures, holidays: defaults.holidays })}
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

function FixedRow({ label, note }: { label: string; note?: string }) {
  return (
    <li className="flex items-center justify-between gap-4 bg-surface px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {note ? <span className="block text-xs text-subtle">{note}</span> : null}
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-subtle">
        <Lock className="size-3.5" aria-hidden="true" />
        Always asked
      </span>
    </li>
  )
}

function ModeRow({ label, value, onChange }: { label: string; value: FieldMode; onChange: (value: FieldMode) => void }) {
  return (
    <li className={cn('flex flex-col gap-2 bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between', value === 'off' && 'bg-surface-sunken/40')}>
      <span className={cn('text-sm font-medium', value === 'off' ? 'text-muted' : 'text-foreground')}>{label}</span>
      <Segmented label={label} size="sm" value={value} onValueChange={onChange} options={MODES} />
    </li>
  )
}

function ToggleRow({
  title,
  body,
  checked,
  onCheckedChange,
  disabled,
  badge,
}: {
  title: string
  body: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  badge?: React.ReactNode
}) {
  const id = React.useId()
  return (
    <div className={cn('flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-3.5', disabled && 'opacity-50')}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id} className="cursor-pointer">
            {title}
          </Label>
          {badge}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{body}</p>
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} className="mt-0.5 shrink-0" />
    </div>
  )
}
