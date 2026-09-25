'use client'

import * as React from 'react'
import Link from 'next/link'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { GUEST_FIELDS, GUEST_FIELD_ORDER, PRESET_ORDER, QUESTION_KIND_LABEL, QUESTION_PRESETS, presetQuestion } from '@/lib/guest-requirements'
import { cn } from '@/lib/utils'
import type { GuestDetailsConfig, GuestFieldKey, GuestQuestion, GuestQuestionKind } from '@/types'

/* ==========================================================================
   Guest details — what an activity asks each guest before they arrive, and
   the waiver they sign. Answers land on the booking, the manifest and, for
   sizes, the gear prep list.
   ========================================================================== */

export interface WaiverOption {
  id: string
  title: string
}

const KINDS: GuestQuestionKind[] = ['text', 'number', 'choice', 'yesno', 'size', 'date']

export function GuestQuestionsEditor({
  questions,
  onChange,
  waiverId,
  onWaiverChange,
  waiverSigning,
  onWaiverSigningChange,
  guestDetails,
  onGuestDetailsChange,
  forcedReason,
  waivers,
}: {
  questions: GuestQuestion[]
  onChange: (questions: GuestQuestion[]) => void
  waiverId: string | null
  onWaiverChange: (waiverId: string | null) => void
  waiverSigning: 'booker' | 'each'
  onWaiverSigningChange: (signing: 'booker' | 'each') => void
  guestDetails: GuestDetailsConfig
  onGuestDetailsChange: (details: GuestDetailsConfig) => void
  /** Set when something else in the activity needs every guest asked. */
  forcedReason?: string
  waivers: WaiverOption[]
}) {
  const perGuest = guestDetails.enabled || Boolean(forcedReason)
  const fieldOf = (key: GuestFieldKey) => guestDetails.fields.find((field) => field.key === key)
  const toggleField = (key: GuestFieldKey, on: boolean) =>
    onGuestDetailsChange({
      ...guestDetails,
      fields: on
        ? GUEST_FIELD_ORDER.filter((entry) => entry === key || fieldOf(entry)).map((entry) => fieldOf(entry) ?? { key: entry, required: true })
        : guestDetails.fields.filter((field) => field.key !== key),
    })
  const requireField = (key: GuestFieldKey, required: boolean) =>
    onGuestDetailsChange({ ...guestDetails, fields: guestDetails.fields.map((field) => (field.key === key ? { ...field, required } : field)) })
  const [lastWaiver, setLastWaiver] = React.useState<string | null>(waiverId ?? waivers[0]?.id ?? null)
  const used = new Set(questions.map((question) => question.preset).filter(Boolean))
  const patch = (id: string, change: Partial<GuestQuestion>) =>
    onChange(questions.map((question) => (question.id === id ? { ...question, ...change } : question)))

  const addCustom = () =>
    onChange([
      ...questions,
      { id: `q_custom_${Date.now().toString(36)}`, label: '', kind: 'text', scope: 'guest', required: false },
    ])

  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-1">
        <CardTitle>Guest details</CardTitle>
        <CardDescription>
          What checkout asks before guests arrive. Answers show on the booking and the manifest; sizes add up on the gear list.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* ---------- waiver ---------- */}
        <div className="rounded-xl border border-line p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Require a waiver</p>
              <p className="mt-0.5 text-xs text-subtle">Guests sign it at checkout before they can pay. Anyone under age is signed for by a parent or guardian.</p>
            </div>
            <Switch
              checked={Boolean(waiverId)}
              disabled={waivers.length === 0}
              onCheckedChange={(on) => {
                if (on) onWaiverChange(lastWaiver ?? waivers[0]?.id ?? null)
                else {
                  setLastWaiver(waiverId)
                  onWaiverChange(null)
                }
              }}
              aria-label="Require a waiver"
            />
          </div>
          {waiverId ? (
            <div className="mt-4 flex flex-col gap-4 border-t border-line-subtle pt-4">
              <Field label="Which waiver">
                <div className="flex flex-wrap items-center gap-3">
                  <Select value={waiverId} onValueChange={(value) => onWaiverChange(value)}>
                    <SelectTrigger className="w-full sm:w-80" aria-label="Waiver">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {waivers.map((waiver) => (
                        <SelectItem key={waiver.id} value={waiver.id}>
                          {waiver.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Link href="/dashboard/settings/waivers" className="text-xs font-medium text-primary hover:underline">
                    Manage waivers
                  </Link>
                </div>
              </Field>
              <div>
                <p className="text-[0.8125rem] font-medium">Who signs</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {(
                    [
                      { value: 'booker', title: 'The person booking', text: 'One signature covers everyone in the booking. Quickest checkout.' },
                      { value: 'each', title: 'Each guest', text: 'Every guest signs their own, at checkout. Best for risky activities and insurance.' },
                    ] as const
                  ).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={waiverSigning === option.value}
                      onClick={() => onWaiverSigningChange(option.value)}
                      className={cn(
                        'rounded-xl border px-3.5 py-3 text-left transition-colors',
                        waiverSigning === option.value ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong',
                      )}
                    >
                      <span className="block text-sm font-medium">{option.title}</span>
                      <span className="mt-0.5 block text-xs text-subtle">{option.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* ---------- each guest ---------- */}
        <div className="rounded-xl border border-line p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Ask for each guest&rsquo;s details</p>
              <p className="mt-0.5 text-xs text-subtle">
                {perGuest
                  ? 'Checkout shows a card for every guest in the booking. The booker is guest 1; their name, email and mobile come from the contact form.'
                  : 'Off: only the person booking gives their details. Turn on to ask every guest.'}
              </p>
              {forcedReason ? <p className="mt-1 text-xs font-medium text-primary">{forcedReason}</p> : null}
            </div>
            <Switch
              checked={perGuest}
              disabled={Boolean(forcedReason)}
              onCheckedChange={(enabled) => onGuestDetailsChange({ ...guestDetails, enabled })}
              aria-label="Ask for each guest's details"
            />
          </div>
          {perGuest ? (
            <ul className="mt-4 flex list-none flex-col divide-y divide-line-subtle border-t border-line-subtle p-0">
              {GUEST_FIELD_ORDER.map((key) => {
                const field = fieldOf(key)
                return (
                  <li key={key} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                    <label className="flex min-w-0 flex-1 items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 accent-[var(--color-primary)]"
                        checked={Boolean(field)}
                        onChange={(event) => toggleField(key, event.target.checked)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{GUEST_FIELDS[key].label}</span>
                        <span className="block text-xs text-subtle">{GUEST_FIELDS[key].hint}</span>
                      </span>
                    </label>
                    {field ? (
                      <Segmented
                        size="sm"
                        label={`${GUEST_FIELDS[key].label} required`}
                        value={field.required ? 'required' : 'optional'}
                        onValueChange={(value: string) => requireField(key, value === 'required')}
                        options={[
                          { value: 'required', label: 'Required' },
                          { value: 'optional', label: 'Optional' },
                        ]}
                      />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>

        <div>
          <p className="text-[0.8125rem] font-medium">Questions</p>
          {!perGuest && questions.some((question) => question.scope === 'guest') ? (
            <p className="mt-1 text-xs text-subtle">Guest details are off, so each-guest questions are asked once, of the person booking.</p>
          ) : null}
          {questions.length === 0 ? (
            <p className="mt-1 text-xs text-subtle">No extra questions yet.</p>
          ) : (
            <ul className="mt-2 flex list-none flex-col gap-2 p-0">
              {questions.map((question) => (
                <li key={question.id} className="rounded-xl border border-line p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      className="min-w-0 flex-1"
                      size="sm"
                      aria-label="Question"
                      placeholder="What do you need to know?"
                      value={question.label}
                      onChange={(e) => patch(question.id, { label: e.target.value })}
                    />
                    <Select
                      value={question.kind}
                      onValueChange={(value) => patch(question.id, { kind: value as GuestQuestionKind, gear: value === 'size' ? true : undefined })}
                      disabled={Boolean(question.preset)}
                    >
                      <SelectTrigger size="sm" className="w-32" aria-label="Answer type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {QUESTION_KIND_LABEL[kind]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={perGuest ? question.scope : 'booking'} disabled={!perGuest} onValueChange={(value) => patch(question.id, { scope: value as GuestQuestion['scope'] })}>
                      <SelectTrigger size="sm" className="w-40" aria-label="Asked">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guest">Each guest</SelectItem>
                        <SelectItem value="booking">Once per booking</SelectItem>
                      </SelectContent>
                    </Select>
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-muted">
                      <Switch size="sm" checked={question.required} onCheckedChange={(checked) => patch(question.id, { required: checked })} />
                      Required
                    </label>
                    <IconButton
                      aria-label={`Remove ${question.label || 'question'}`}
                      size="sm"
                      variant="ghost"
                      onClick={() => onChange(questions.filter((entry) => entry.id !== question.id))}
                    >
                      <Trash2 aria-hidden="true" />
                    </IconButton>
                  </div>

                  {question.kind === 'number' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                      Allowed
                      <Input size="sm" className="w-20" type="number" aria-label="Minimum" value={question.min ?? ''} onChange={(e) => patch(question.id, { min: e.target.value === '' ? undefined : Number(e.target.value) })} />
                      to
                      <Input size="sm" className="w-20" type="number" aria-label="Maximum" value={question.max ?? ''} onChange={(e) => patch(question.id, { max: e.target.value === '' ? undefined : Number(e.target.value) })} />
                      <Input size="sm" className="w-20" aria-label="Unit" placeholder="unit" value={question.unit ?? ''} onChange={(e) => patch(question.id, { unit: e.target.value || undefined })} />
                      <span className="text-subtle">Answers outside the range stop the booking.</span>
                    </div>
                  ) : null}
                  {question.kind === 'choice' || question.kind === 'size' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                      Options
                      <Input
                        size="sm"
                        className="min-w-0 flex-1"
                        aria-label="Options, separated by commas"
                        placeholder="XS, S, M, L, XL"
                        value={(question.options ?? []).join(', ')}
                        onChange={(e) =>
                          patch(question.id, {
                            options: e.target.value.split(',').map((option) => option.trim()).filter(Boolean),
                          })
                        }
                      />
                      {question.kind === 'size' ? <span className="text-subtle">Counted on the gear list.</span> : null}
                    </div>
                  ) : null}
                  {question.allowed && question.allowed.length > 0 ? (
                    <p className="mt-2 text-xs text-subtle">Only {question.allowed.join(', ')} can book.</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-muted">Add from the library</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESET_ORDER.filter((key) => !used.has(key)).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onChange([...questions, presetQuestion(key)])}
                className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-primary/50 hover:text-foreground"
              >
                <Plus className="size-3" aria-hidden="true" />
                {QUESTION_PRESETS[key].label}
              </button>
            ))}
            <Button type="button" variant="secondary" size="xs" leftIcon={<Plus />} onClick={addCustom}>
              Custom question
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
