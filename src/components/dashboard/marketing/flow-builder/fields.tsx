'use client'

import * as React from 'react'
import { ChevronDown, UserRound } from 'lucide-react'

import { NumberInput } from '@/components/dashboard/marketing/number-input'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ALL_PLACEHOLDERS, humanizeTokens, type FlowPlaceholder } from '@/lib/flows/catalog'
import type { Duration, TimeUnit } from '@/lib/flows/types'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Small controls the builder's panels share: a titled section, a switch row
   with its consequence, choice chips, a time span, and text fields that
   show personal details as their names ("[First name]") while the stored
   text keeps the tokens messages are filled from.
   ========================================================================== */

/* ---------- details: labels on screen, tokens in the text ---------- */

const BY_LABEL = new Map(ALL_PLACEHOLDERS.map((item) => [item.label.toLowerCase(), item.token]))

/** "[First name]" back to "{first_name}". Brackets that name no detail stay as typed. */
export function toTokens(text: string): string {
  return text.replace(/\[([^[\]]{1,40})\]/g, (match, label: string) => BY_LABEL.get(label.trim().toLowerCase()) ?? match)
}

/* ---------- layout ---------- */

export function PanelSection({
  title,
  hint,
  children,
  className,
  action,
}: {
  title: string
  hint?: React.ReactNode
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <section className={cn('flex flex-col gap-3 border-t border-line-subtle pt-5 first:border-t-0 first:pt-0', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {hint ? <p className="mt-0.5 text-xs leading-relaxed text-subtle">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

/** A switch with its title and the one line that says what it does. */
export function ToggleRow({
  title,
  text,
  checked,
  onChange,
  disabled,
}: {
  title: string
  text?: React.ReactNode
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
}) {
  const id = React.useId()
  return (
    <div className={cn('flex items-start justify-between gap-4', disabled && 'opacity-60')}>
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {text ? <span className="mt-0.5 block text-xs leading-relaxed text-subtle">{text}</span> : null}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} className="mt-0.5" />
    </div>
  )
}

/** Pick any number of options. */
export function ChoiceChips<V extends string | number>({
  options,
  value,
  onChange,
  label,
  single = false,
}: {
  options: { value: V; label: string }[]
  value: V[]
  onChange: (next: V[]) => void
  label: string
  /** Exactly one can be on. */
  single?: boolean
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = value.includes(option.value)
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(single ? [option.value] : on ? value.filter((entry) => entry !== option.value) : [...value, option.value])}
            className={cn(
              'h-8 rounded-lg border px-2.5 text-[0.8125rem] font-medium transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              on ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

const UNIT_LABEL: Record<TimeUnit, [string, string]> = {
  minutes: ['minute', 'minutes'],
  hours: ['hour', 'hours'],
  days: ['day', 'days'],
}

/** "[ 2 ] [days ▾]". */
export function DurationInput({
  value,
  onChange,
  units = ['minutes', 'hours', 'days'],
  label,
  min = 0,
  after,
}: {
  value: Duration | undefined
  onChange: (next: Duration) => void
  units?: TimeUnit[]
  label: string
  min?: number
  /** Words after the unit: "before the start". */
  after?: string
}) {
  const current = value ?? { amount: 1, unit: units[units.length - 1] }
  const unit = units.includes(current.unit) ? current.unit : units[units.length - 1]
  // An older save can hold an empty amount; show the smallest allowed rather than "NaN".
  const amount = Number.isFinite(current.amount) ? current.amount : min
  return (
    <div className="flex flex-wrap items-center gap-2">
      <NumberInput
        aria-label={`${label}: amount`}
        min={min}
        className="w-24"
        value={amount}
        onValueChange={(next) => onChange({ amount: next, unit })}
      />
      {units.length > 1 ? (
        <Select value={unit} onValueChange={(next) => onChange({ amount, unit: next as TimeUnit })}>
          <SelectTrigger aria-label={`${label}: unit`} className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {units.map((entry) => (
              <SelectItem key={entry} value={entry}>
                {UNIT_LABEL[entry][amount === 1 ? 0 : 1]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className="text-sm text-muted">{UNIT_LABEL[unit][amount === 1 ? 0 : 1]}</span>
      )}
      {after ? <span className="text-sm text-muted">{after}</span> : null}
    </div>
  )
}

/* ---------- text with personal details ---------- */

/** The "Add personal detail" menu: names and what they look like, never tokens. */
export function DetailMenu({ placeholders, onPick, label = 'Add personal detail' }: { placeholders: FlowPlaceholder[]; onPick: (item: FlowPlaceholder) => void; label?: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-primary transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
        >
          <UserRound className="size-3.5" aria-hidden="true" />
          {label}
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" width="md" padding="none" className="max-h-80 overflow-y-auto p-1.5">
        <ul className="flex list-none flex-col p-0" role="list">
          {placeholders.map((item) => (
            <li key={item.token}>
              <button
                type="button"
                onClick={() => {
                  onPick(item)
                  setOpen(false)
                }}
                className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-primary-soft hover:text-primary focus-visible:bg-primary-soft focus-visible:outline-none"
              >
                <span className="font-medium">{item.label}</span>
                <span className="truncate text-xs text-subtle">{item.sample}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

/**
 * An input or textarea for message text. Details show as "[First name]";
 * typing or picking one keeps the token in the stored text.
 */
export function DetailText({
  value,
  onChange,
  placeholders,
  multiline = false,
  rows = 6,
  label,
  description,
  placeholder,
  invalid,
  footer,
}: {
  value: string
  onChange: (next: string) => void
  placeholders: FlowPlaceholder[]
  multiline?: boolean
  rows?: number
  label: string
  description?: React.ReactNode
  placeholder?: string
  invalid?: boolean
  /** Under the field, left of the details menu: a length counter, a note. */
  footer?: React.ReactNode
}) {
  const id = React.useId()
  const ref = React.useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const shown = humanizeTokens(value)

  const insert = (item: FlowPlaceholder) => {
    const el = ref.current
    const tag = `[${item.label}]`
    const start = el?.selectionStart ?? shown.length
    const end = el?.selectionEnd ?? start
    const before = shown.slice(0, start)
    const pad = before && !/\s$/.test(before) ? ' ' : ''
    const next = `${before}${pad}${tag}${shown.slice(end)}`
    onChange(toTokens(next))
    const caret = start + pad.length + tag.length
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(caret, caret)
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={id} className="text-[0.8125rem] font-medium text-foreground">
          {label}
        </label>
        <DetailMenu placeholders={placeholders} onPick={insert} />
      </div>
      {multiline ? (
        <Textarea
          ref={ref}
          id={id}
          rows={rows}
          value={shown}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(toTokens(event.target.value))}
        />
      ) : (
        <Input
          ref={ref}
          id={id}
          value={shown}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(toTokens(event.target.value))}
        />
      )}
      {description || footer ? (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-xs leading-relaxed text-subtle">
          {description ? <p className="min-w-0 flex-1">{description}</p> : <span />}
          {footer}
        </div>
      ) : null}
    </div>
  )
}
