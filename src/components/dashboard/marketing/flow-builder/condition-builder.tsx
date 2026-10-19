'use client'

import * as React from 'react'
import { Check, Plus, Search, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  CONDITION_FIELD_GROUPS,
  OP_LABEL,
  fieldMeta,
  fieldsFor,
  newCondition,
  optionsFor,
  type ConditionFieldMeta,
  type ConditionOption,
} from '@/lib/flows/catalog'
import type { Condition, ConditionField, ConditionGroup, ConditionOp, TriggerSubject } from '@/lib/flows/types'
import { cn } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   ConditionBuilder — "who can enter", the question an If / else step asks,
   and audience rules. Each row reads as a sentence: [Group size] [is at
   least] [6 guests]. Lists pick from the business's own activities, tags
   and countries; money is typed in the currency and stored in cents.
   ========================================================================== */

export interface ConditionData {
  activities?: { slug: string; name: string }[]
  tags?: string[]
  countries?: string[]
  locations?: { id: string; name: string }[]
  addOns?: ConditionOption[]
  currency?: CurrencyCode
}

export interface ConditionBuilderProps {
  value: ConditionGroup
  onChange: (next: ConditionGroup) => void
  /** What the automation starts from; decides which checks make sense. Audiences pass 'guest'. */
  subject: TriggerSubject | TriggerSubject[]
  /** 'branch' adds what the guest did inside the automation. */
  where?: 'who' | 'branch'
  data: ConditionData
  /** Shown when there are no rows. */
  emptyText?: string
  addLabel?: string
}

const CURRENCY_SYMBOL: Partial<Record<string, string>> = { USD: '$', AUD: '$', NZD: '$', CAD: '$', EUR: '€', GBP: '£', JPY: '¥' }

/** The choices a list row offers, from the catalog or the business. */
function choicesFor(meta: ConditionFieldMeta, data: ConditionData): ConditionOption[] {
  const fixed = optionsFor(meta)
  if (fixed) return fixed
  switch (meta.options) {
    case 'activities':
      return (data.activities ?? []).map((activity) => ({ value: activity.slug, label: activity.name }))
    case 'tags':
      return (data.tags ?? []).map((tag) => ({ value: tag, label: tag }))
    case 'countries':
      return (data.countries ?? []).map((country) => ({ value: country, label: country }))
    case 'locations':
      return (data.locations ?? []).map((location) => ({ value: location.id, label: location.name }))
    case 'addOns':
      return data.addOns ?? []
    default:
      return []
  }
}

const listOf = (value: Condition['value']): string[] => (Array.isArray(value) ? value.map(String) : typeof value === 'string' && value ? [value] : [])
const numberOf = (value: Condition['value'], fallback = 0): number => (typeof value === 'number' ? value : Array.isArray(value) && typeof value[0] === 'number' ? value[0] : fallback)
const rangeOf = (value: Condition['value'], fallback: number): [number, number] =>
  Array.isArray(value) && value.length >= 2 && typeof value[0] === 'number' ? [Number(value[0]), Number(value[1])] : [numberOf(value, fallback), numberOf(value, fallback)]

export function ConditionBuilder({ value, onChange, subject, where = 'who', data, emptyText, addLabel = 'Add a check' }: ConditionBuilderProps) {
  const fields = React.useMemo(() => fieldsFor(subject, where), [subject, where])
  const conditions = value.conditions
  const set = (id: string, next: Condition) => onChange({ ...value, conditions: conditions.map((c) => (c.id === id ? next : c)) })
  const remove = (id: string) => onChange({ ...value, conditions: conditions.filter((c) => c.id !== id) })
  const add = (field: ConditionField) => onChange({ ...value, conditions: [...conditions, newCondition(field)] })
  const joiner = value.match === 'any' ? 'or' : 'and'

  return (
    <div className="flex flex-col gap-3">
      {conditions.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted">
          <span>Match</span>
          <Segmented
            size="sm"
            label="How the checks combine"
            value={value.match}
            onValueChange={(match) => onChange({ ...value, match })}
            options={[
              { value: 'all', label: 'All of these' },
              { value: 'any', label: 'Any one of these' },
            ]}
          />
        </div>
      ) : null}

      {conditions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3.5 py-3 text-[0.8125rem] text-subtle">{emptyText ?? 'No checks yet. Everyone it applies to goes through.'}</p>
      ) : (
        <ol className="flex list-none flex-col gap-0 p-0">
          {conditions.map((condition, index) => (
            <li key={condition.id} className="flex flex-col">
              {index > 0 ? (
                <span className="py-1.5 pl-3 text-xs font-medium tracking-wide text-subtle uppercase" aria-hidden="true">
                  {joiner}
                </span>
              ) : null}
              <ConditionRow condition={condition} fields={fields} data={data} onChange={(next) => set(condition.id, next)} onRemove={() => remove(condition.id)} />
            </li>
          ))}
        </ol>
      )}

      <FieldPicker fields={fields} onPick={add} label={addLabel} />
    </div>
  )
}

/* ---------- one row ---------- */

function ConditionRow({
  condition,
  fields,
  data,
  onChange,
  onRemove,
}: {
  condition: Condition
  fields: ConditionFieldMeta[]
  data: ConditionData
  onChange: (next: Condition) => void
  onRemove: () => void
}) {
  const meta = fieldMeta(condition.field)
  const known = fields.some((entry) => entry.field === condition.field)
  const ops = meta.ops
  const opLabels = OP_LABEL[meta.kind]

  const changeField = (field: ConditionField) => {
    const fresh = newCondition(field)
    onChange({ ...fresh, id: condition.id })
  }

  const changeOp = (op: ConditionOp) => {
    if (meta.kind === 'bool' || meta.kind === 'list' || meta.kind === 'enum') return onChange({ ...condition, op })
    // Moving to and from "between" reshapes the value.
    if (op === 'between') {
      const n = numberOf(condition.value, typeof meta.defaultValue === 'number' ? meta.defaultValue : 0)
      return onChange({ ...condition, op, value: [n, n * 2 || 1] })
    }
    const n = Array.isArray(condition.value) ? numberOf(condition.value) : condition.value
    onChange({ ...condition, op, value: typeof n === 'number' ? n : 0 })
  }

  return (
    <div className={cn('flex flex-col gap-2 rounded-xl border bg-surface p-3', known ? 'border-line' : 'border-warning/50')}>
      <div className="flex items-center gap-2">
        <Select value={condition.field} onValueChange={(next) => changeField(next as ConditionField)}>
          <SelectTrigger size="sm" aria-label="What to check" className="min-w-0 flex-1 font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONDITION_FIELD_GROUPS.map((group) => {
              const inGroup = fields.filter((entry) => entry.group === group)
              if (inGroup.length === 0) return null
              return (
                <SelectGroup key={group}>
                  <SelectLabel>{group}</SelectLabel>
                  {inGroup.map((entry) => (
                    <SelectItem key={entry.field} value={entry.field}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )
            })}
            {!known ? <SelectItem value={condition.field}>{meta.label}</SelectItem> : null}
          </SelectContent>
        </Select>
        <IconButton size="sm" variant="ghost" aria-label={`Remove the check on ${meta.label}`} onClick={onRemove}>
          <X />
        </IconButton>
      </div>

      {meta.kind === 'bool' ? (
        <Segmented
          size="sm"
          label={meta.label}
          value={condition.op === 'no' ? 'no' : 'yes'}
          onValueChange={(op) => onChange({ ...condition, op })}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ]}
          className="self-start"
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {ops.length > 1 ? (
            <Select value={condition.op} onValueChange={(op) => changeOp(op as ConditionOp)}>
              <SelectTrigger size="sm" aria-label={`How to compare ${meta.label}`} className="w-auto min-w-[8.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent width="auto">
                {ops.map((op) => (
                  <SelectItem key={op} value={op}>
                    {opLabels[op] ?? op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-[0.8125rem] text-muted">{opLabels[condition.op]}</span>
          )}
          {meta.kind === 'list' || meta.kind === 'enum' ? (
            <ListValue meta={meta} value={listOf(condition.value)} choices={choicesFor(meta, data)} onChange={(next) => onChange({ ...condition, value: next })} />
          ) : (
            <NumberValue meta={meta} condition={condition} currency={data.currency ?? 'USD'} onChange={(next) => onChange({ ...condition, value: next })} />
          )}
        </div>
      )}
      {!known ? <p className="text-xs text-warning">This check does not fit what starts the automation. Pick another or remove it.</p> : null}
    </div>
  )
}

/* ---------- values ---------- */

function NumberValue({ meta, condition, currency, onChange }: { meta: ConditionFieldMeta; condition: Condition; currency: CurrencyCode; onChange: (value: number | [number, number]) => void }) {
  const money = meta.kind === 'money'
  const fallback = typeof meta.defaultValue === 'number' ? meta.defaultValue : 0
  const affix = money ? (CURRENCY_SYMBOL[currency] ? `${CURRENCY_SYMBOL[currency]} ${currency}` : currency) : meta.unit
  const field = (n: number, set: (next: number) => void, label: string) => <AmountInput value={n} money={money} onValueChange={set} label={label} suffix={affix} />
  if (condition.op === 'between') {
    const [lo, hi] = rangeOf(condition.value, fallback)
    return (
      <div className="flex flex-wrap items-center gap-2">
        {field(lo, (next) => onChange([next, hi]), `${meta.label}: from`)}
        <span className="text-[0.8125rem] text-muted">and</span>
        {field(hi, (next) => onChange([lo, next]), `${meta.label}: to`)}
      </div>
    )
  }
  return field(typeof condition.value === 'number' ? condition.value : numberOf(condition.value, fallback), (next) => onChange(next), meta.label)
}

/**
 * A number box that can be cleared and retyped without jumping back to a
 * value. Money is shown in whole currency (49.50) and stored in cents.
 */
function AmountInput({ value, money, onValueChange, label, suffix }: { value: number; money: boolean; onValueChange: (next: number) => void; label: string; suffix?: string }) {
  const shown = Number.isFinite(value) ? String(money ? Math.round(value) / 100 : value) : ''
  const [text, setText] = React.useState<string | null>(null)
  const parse = (raw: string) => {
    const n = Number(raw)
    if (raw.trim() === '' || !Number.isFinite(n) || n < 0) return null
    return money ? Math.round(n * 100) : Math.round(n)
  }
  return (
    <Input
      size="sm"
      type="number"
      inputMode={money ? 'decimal' : 'numeric'}
      min={0}
      step={money ? 'any' : 1}
      aria-label={label}
      className="w-32"
      value={text ?? shown}
      suffix={suffix}
      onFocus={() => setText(shown)}
      onChange={(event) => {
        setText(event.target.value)
        const next = parse(event.target.value)
        if (next !== null) onValueChange(next)
      }}
      onBlur={() => setText(null)}
    />
  )
}

function ListValue({ meta, value, choices, onChange }: { meta: ConditionFieldMeta; value: string[]; choices: ConditionOption[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const labelOf = (v: string) => choices.find((option) => option.value === v)?.label ?? v
  const q = query.trim().toLowerCase()
  const shown = q ? choices.filter((option) => option.label.toLowerCase().includes(q)) : choices
  // Tags, extras and anything the business hasn't listed can be typed.
  const free = meta.options === 'tags' || choices.length === 0
  const canAdd = free && q && !choices.some((option) => option.label.toLowerCase() === q) && !value.some((v) => v.toLowerCase() === q)
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((entry) => entry !== v) : [...value, v])

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
      {value.map((v) => (
        <span key={v} className="inline-flex h-7 max-w-full items-center gap-1 rounded-md border border-line bg-surface-sunken pr-1 pl-2 text-[0.8125rem] text-foreground">
          <span className="truncate">{labelOf(v)}</span>
          <button
            type="button"
            onClick={() => toggle(v)}
            aria-label={`Remove ${labelOf(v)}`}
            className="grid size-5 place-items-center rounded text-subtle hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </span>
      ))}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery('')
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex h-7 items-center gap-1 rounded-md border border-dashed px-2 text-[0.8125rem] font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
              value.length === 0 ? 'border-primary/50 text-primary hover:bg-primary-soft' : 'border-line text-muted hover:text-foreground',
            )}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {value.length === 0 ? `Choose ${meta.label.toLowerCase()}` : 'Add'}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" width="md" padding="none" className="flex flex-col">
          <div className="border-b border-line-subtle p-2">
            <Input
              size="sm"
              autoFocus
              leftIcon={<Search />}
              placeholder={free ? 'Search or type a new one' : 'Search'}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                if (canAdd) {
                  onChange([...value, query.trim()])
                  setQuery('')
                } else if (shown.length === 1) toggle(shown[0].value)
              }}
              aria-label={`Search ${meta.label.toLowerCase()}`}
            />
          </div>
          <ul className="max-h-64 list-none overflow-y-auto p-1.5" aria-label={meta.label}>
            {shown.map((option) => {
              const on = value.includes(option.value)
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(option.value)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-none"
                  >
                    <span className={cn('grid size-4 shrink-0 place-items-center rounded border', on ? 'border-primary bg-primary text-on-primary' : 'border-line-strong')}>
                      {on ? <Check className="size-3" aria-hidden="true" /> : null}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </button>
                </li>
              )
            })}
            {canAdd ? (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange([...value, query.trim()])
                    setQuery('')
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-primary hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-none"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Add “{query.trim()}”
                </button>
              </li>
            ) : null}
            {shown.length === 0 && !canAdd ? <li className="px-2.5 py-3 text-[0.8125rem] text-subtle">{free ? 'Type a name and press Enter.' : 'Nothing matches.'}</li> : null}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  )
}

/* ---------- adding a check ---------- */

function FieldPicker({ fields, onPick, label }: { fields: ConditionFieldMeta[]; onPick: (field: ConditionField) => void; label: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size="sm" variant="secondary" leftIcon={<Plus />} className="self-start">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" width="lg" padding="none" className="max-h-[min(28rem,var(--radix-popover-content-available-height))] p-1.5">
        {CONDITION_FIELD_GROUPS.map((group) => {
          const inGroup = fields.filter((entry) => entry.group === group)
          if (inGroup.length === 0) return null
          return (
            <div key={group} className="py-1">
              <p className="px-2.5 pt-1 pb-1.5 text-xs font-medium text-subtle">{group}</p>
              <ul className="list-none p-0">
                {inGroup.map((entry) => (
                  <li key={entry.field}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(entry.field)
                        setOpen(false)
                      }}
                      className="flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-primary-soft focus-visible:bg-primary-soft focus-visible:outline-none"
                    >
                      <span className="text-sm font-medium text-foreground">{entry.label}</span>
                      <span className="text-xs leading-relaxed text-subtle">{entry.help}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
