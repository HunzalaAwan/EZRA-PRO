'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { GuestQuestion, GuestQuestionKind } from '@/types'

/* ==========================================================================
   The fields of a form, one row each: the question, its answer type, the
   choices for a pick, required or not, move up or down, remove. Used by
   every form on Settings → Forms. Answers are asked once per booking.
   ========================================================================== */

type KindValue = GuestQuestionKind | 'long'

export const FIELD_KINDS: { value: KindValue; label: string }[] = [
  { value: 'text', label: 'Short answer' },
  { value: 'long', label: 'Long answer' },
  { value: 'choice', label: 'Pick one' },
  { value: 'multi', label: 'Pick several' },
  { value: 'yesno', label: 'Yes or no' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
]

export const kindValue = (field: GuestQuestion): KindValue => (field.kind === 'text' && !field.short ? 'long' : field.kind)

export const kindLabel = (field: GuestQuestion) => FIELD_KINDS.find((entry) => entry.value === kindValue(field))?.label ?? 'Short answer'

export function newField(prefix: string): GuestQuestion {
  return { id: `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e3).toString(36)}`, label: '', kind: 'text', short: true, scope: 'booking', required: false }
}

export function FormFieldsEditor({
  fields,
  onChange,
  idPrefix,
  placeholder = 'e.g. How did you hear about us?',
  addLabel = 'Add a field',
}: {
  fields: GuestQuestion[]
  onChange: (fields: GuestQuestion[]) => void
  /** Prefix for new field ids, so ids stay unique across forms. */
  idPrefix: string
  placeholder?: string
  addLabel?: string
}) {
  const patch = (id: string, change: Partial<GuestQuestion>) => onChange(fields.map((field) => (field.id === id ? { ...field, ...change } : field)))
  const move = (index: number, by: -1 | 1) => {
    const next = [...fields]
    const [field] = next.splice(index, 1)
    next.splice(index + by, 0, field)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {fields.length > 0 ? (
        <ul className="flex list-none flex-col gap-2 p-0">
          {fields.map((field, index) => {
            const picks = field.kind === 'choice' || field.kind === 'multi'
            return (
              <li key={field.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <Input aria-label={`Field ${index + 1}`} value={field.label} onChange={(event) => patch(field.id, { label: event.target.value })} placeholder={placeholder} className="sm:flex-1" />
                  <Select
                    value={kindValue(field)}
                    onValueChange={(value) =>
                      patch(field.id, value === 'long' ? { kind: 'text', short: false } : { kind: value as GuestQuestionKind, short: value === 'text' ? true : undefined })
                    }
                  >
                    <SelectTrigger aria-label={`Answer type, field ${index + 1}`} className="sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_KINDS.map((kind) => (
                        <SelectItem key={kind.value} value={kind.value}>
                          {kind.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {picks ? (
                  <Input
                    aria-label={`Choices, field ${index + 1}`}
                    value={(field.options ?? []).join(', ')}
                    onChange={(event) => patch(field.id, { options: event.target.value.split(',').map((option) => option.trimStart()) })}
                    onBlur={() => patch(field.id, { options: (field.options ?? []).map((option) => option.trim()).filter(Boolean) })}
                    placeholder="Choices, separated by commas"
                  />
                ) : null}
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm text-muted">
                    <Switch checked={field.required} onCheckedChange={(required) => patch(field.id, { required })} aria-label={`Required, field ${index + 1}`} />
                    Required
                  </label>
                  <div className="flex items-center gap-1">
                    <IconButton variant="ghost" size="sm" aria-label={`Move field ${index + 1} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                      <ArrowUp />
                    </IconButton>
                    <IconButton variant="ghost" size="sm" aria-label={`Move field ${index + 1} down`} disabled={index === fields.length - 1} onClick={() => move(index, 1)}>
                      <ArrowDown />
                    </IconButton>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove field ${index + 1}`}
                      className="text-muted hover:text-danger"
                      onClick={() => onChange(fields.filter((entry) => entry.id !== field.id))}
                    >
                      <Trash2 />
                    </IconButton>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
      <Button size="sm" variant="secondary" leftIcon={<Plus />} className="self-start" onClick={() => onChange([...fields, newField(idPrefix)])}>
        {addLabel}
      </Button>
    </div>
  )
}
