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
import { Switch } from '@/components/ui/switch'
import { PRESET_ORDER, QUESTION_KIND_LABEL, QUESTION_PRESETS, presetQuestion } from '@/lib/guest-requirements'
import type { GuestQuestion, GuestQuestionKind } from '@/types'

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
  waivers,
}: {
  questions: GuestQuestion[]
  onChange: (questions: GuestQuestion[]) => void
  waiverId: string | null
  onWaiverChange: (waiverId: string | null) => void
  waivers: WaiverOption[]
}) {
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
          What you need from each guest before they arrive. Answers show on the booking and the manifest; sizes add up on the gear list.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field label="Waiver" description="Signed at checkout for the whole group, with a guardian for anyone under age.">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={waiverId ?? 'none'} onValueChange={(value) => onWaiverChange(value === 'none' ? null : value)}>
              <SelectTrigger className="w-full sm:w-80" aria-label="Waiver">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No waiver</SelectItem>
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
          <p className="text-[0.8125rem] font-medium">Questions</p>
          {questions.length === 0 ? (
            <p className="mt-1 text-xs text-subtle">No questions yet. Guests only give their names.</p>
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
                    <Select value={question.scope} onValueChange={(value) => patch(question.id, { scope: value as GuestQuestion['scope'] })}>
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
