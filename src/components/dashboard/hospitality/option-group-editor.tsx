'use client'

import * as React from 'react'
import { ChevronDown, GripVertical, ImageOff, Plus, Settings2, Trash2, UtensilsCrossed } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { SearchInput } from '@/components/ui/search-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { checkGroup, optionView } from '@/lib/hospitality/menu-pricing'
import { GROUP_KIND_META, type GroupKind, type Menu, type MenuOption, type MenuOptionGroup, type MenuVariant } from '@/lib/hospitality/types'
import { cn, currencySymbol } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import {
  HOW_MANY_LABEL,
  KIND_PLACEHOLDER,
  blankOption,
  eachMaxOf,
  howManyOf,
  moneyText,
  moveInList,
  parseMoney,
  requiredLocked,
  sizePricesOn,
  withDefault,
  withEachMax,
  withFree,
  withHowMany,
  withLink,
  withLinkedDishes,
  withOptionMax,
  withRequired,
  withSizePrice,
  withSizePrices,
  withoutBlankRows,
  type HowMany,
  type Rules,
} from './menu-editor-model'

/* ==========================================================================
   <OptionGroupEditor> — one choice group, edited in place.

   Used for a dish's own groups, for its meal, and for saved groups in the
   library. A name, how many a guest picks, what is free, and a row per
   option: name, price (empty = free), default, sold out.
   ========================================================================== */

const KINDS = Object.keys(GROUP_KIND_META) as GroupKind[]

/* --------------------------------------------------------------------------
   Small inputs
   -------------------------------------------------------------------------- */

/** A price in the currency's main unit. Empty means free. */
export function MoneyInput({
  value,
  onChange,
  currency,
  label,
  className,
  freeHint = true,
  autoFocus,
  id,
}: {
  value: number
  onChange: (value: number) => void
  currency: CurrencyCode
  label: string
  className?: string
  freeHint?: boolean
  autoFocus?: boolean
  id?: string
}) {
  const [text, setText] = React.useState(() => moneyText(value))
  React.useEffect(() => {
    setText((current) => (parseMoney(current) === value ? current : moneyText(value)))
  }, [value])
  return (
    <Input
      id={id}
      size="sm"
      type="text"
      inputMode="decimal"
      autoFocus={autoFocus}
      value={text}
      onChange={(e) => {
        const next = e.target.value.replace(/[^\d.,]/g, '')
        setText(next)
        onChange(parseMoney(next))
      }}
      onBlur={() => setText(moneyText(value))}
      aria-label={label}
      placeholder={freeHint ? 'Free' : '0'}
      suffix={<span className="text-xs text-subtle">{value === 0 && freeHint ? '' : currencySymbol(currency)}</span>}
      className={cn('w-24', className)}
      inputClassName="tabular-nums"
    />
  )
}

/** A whole number with a floor. */
export function CountInput({ value, onChange, min = 1, max = 99, label, className, suffix }: { value: number; onChange: (value: number) => void; min?: number; max?: number; label: string; className?: string; suffix?: string }) {
  const [text, setText] = React.useState(String(value))
  React.useEffect(() => {
    setText((current) => (Number(current) === value ? current : String(value)))
  }, [value])
  return (
    <Input
      size="sm"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        const n = Math.floor(Number(e.target.value))
        if (Number.isFinite(n) && n >= min && n <= max) onChange(n)
      }}
      onBlur={() => setText(String(value))}
      aria-label={label}
      suffix={suffix ? <span className="text-xs text-subtle">{suffix}</span> : undefined}
      className={cn('w-20', className)}
      inputClassName="tabular-nums"
    />
  )
}

/** A label on the left, the control on the right. */
export function SettingRow({ title, hint, children, className }: { title: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2', className)}>
      <span className="min-w-0">
        <span className="block text-[0.8125rem] text-foreground">{title}</span>
        {hint ? <span className="block text-xs text-subtle">{hint}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-2">{children}</span>
    </div>
  )
}

/** Photo of a linked dish, or a quiet placeholder. Any host works, so a plain img. */
export function DishThumb({ url, className }: { url?: string; className?: string }) {
  return (
    <span className={cn('relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-sunken', className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <ImageOff aria-hidden="true" className="size-3.5 text-faint" />
      )}
    </span>
  )
}

/* --------------------------------------------------------------------------
   Rules: required, how many, first N free
   -------------------------------------------------------------------------- */

export function RulesFields({ rules, kind, onChange, idPrefix }: { rules: Rules; kind: GroupKind; onChange: (rules: Rules) => void; idPrefix: string }) {
  const { mode, n } = howManyOf(rules)
  const locked = requiredLocked(rules)
  const showFree = kind === 'extras' || kind === 'choice'
  const free = rules.freeQty ?? 0
  if (kind === 'remove') return <p className="text-xs text-subtle">Guests can leave out as many as they like. Always free.</p>
  return (
    <div className="divide-y divide-line-subtle">
      <SettingRow title="Required" hint={locked ? 'Always required when guests pick 2 or more' : undefined}>
        <Switch size="sm" checked={rules.min > 0} disabled={locked} onCheckedChange={(on) => onChange(withRequired(rules, on))} aria-label="Required" />
      </SettingRow>
      <SettingRow title="How many">
        <Select value={mode} onValueChange={(v) => onChange(withHowMany(rules, v as HowMany))}>
          <SelectTrigger size="sm" className="w-36" aria-label="How many" id={`${idPrefix}-how`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(HOW_MANY_LABEL) as HowMany[]).map((m) => (
              <SelectItem key={m} value={m}>
                {HOW_MANY_LABEL[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {mode === 'up_to' || mode === 'exactly' || mode === 'at_least' ? <CountInput value={n} min={2} onChange={(next) => onChange(withHowMany(rules, mode, next))} label={`${HOW_MANY_LABEL[mode].replace('…', '')} how many`} /> : null}
      </SettingRow>
      {showFree ? (
        <SettingRow title="First ones free" hint={free > 0 ? `First ${free} free, then each one is charged` : 'Like the first sauce free'}>
          {free > 0 ? <CountInput value={free} min={1} max={rules.max ?? 99} onChange={(next) => onChange(withFree(rules, next))} label="How many free" suffix="free" /> : null}
          <Switch size="sm" checked={free > 0} onCheckedChange={(on) => onChange(withFree(rules, on ? 1 : null))} aria-label="First ones free" />
        </SettingRow>
      ) : null}
    </div>
  )
}

/* --------------------------------------------------------------------------
   Pick dishes from the menu
   -------------------------------------------------------------------------- */

export function DishPicker({ menu, excludeId, linkedIds, onAdd, trigger }: { menu: Menu; excludeId?: string; linkedIds: string[]; onAdd: (ids: string[]) => void; trigger: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [picked, setPicked] = React.useState<string[]>([])
  const sections = new Map(menu.categories.map((c) => [c.id, c.name]))
  const needle = query.trim().toLowerCase()
  const dishes = menu.items
    .filter((i) => i.id !== excludeId && i.kind !== 'set')
    .filter((i) => (needle ? i.name.toLowerCase().includes(needle) || (sections.get(i.categoryId) ?? '').toLowerCase().includes(needle) : true))
    .sort((a, b) => (sections.get(a.categoryId) ?? '').localeCompare(sections.get(b.categoryId) ?? '') || a.name.localeCompare(b.name))

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setPicked([])
          setQuery('')
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" padding="none" width="md" className="flex max-h-[min(26rem,var(--radix-popover-content-available-height))] flex-col">
        <div className="border-b border-line-subtle p-2">
          <SearchInput value={query} onValueChange={setQuery} debounceMs={0} size="sm" placeholder="Search dishes…" aria-label="Search dishes" />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-1" aria-label="Dishes">
          {dishes.length === 0 ? <li className="px-3 py-4 text-center text-xs text-subtle">No dishes match.</li> : null}
          {dishes.map((d) => {
            const already = linkedIds.includes(d.id)
            const on = already || picked.includes(d.id)
            return (
              <li key={d.id}>
                <label className={cn('flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-sunken', already && 'cursor-default opacity-60')}>
                  <Checkbox checked={on} disabled={already} onCheckedChange={(checked) => setPicked((p) => (checked ? [...p, d.id] : p.filter((x) => x !== d.id)))} />
                  <DishThumb url={d.imageUrl} className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] text-foreground">{d.name}</span>
                    <span className="block truncate text-xs text-subtle">
                      {sections.get(d.categoryId)}
                      {d.status === 'hidden' ? ' · Hidden' : d.status === 'sold_out' ? ' · Sold out' : ''}
                      {already ? ' · Added' : ''}
                    </span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t border-line-subtle p-2">
          <span className="text-xs text-subtle">Hidden dishes can still be picked here.</span>
          <Button
            size="xs"
            disabled={!picked.length}
            onClick={() => {
              onAdd(picked)
              setOpen(false)
              setPicked([])
              setQuery('')
            }}
          >
            {picked.length > 1 ? `Add ${picked.length}` : 'Add'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* --------------------------------------------------------------------------
   The group editor
   -------------------------------------------------------------------------- */

export interface OptionGroupEditorProps {
  group: MenuOptionGroup
  onChange: (group: MenuOptionGroup) => void
  /** The dish's sizes, for prices that change with size. Library groups have none. */
  variants?: MenuVariant[]
  menu: Menu
  mode: 'own' | 'library'
  currency: CurrencyCode
  /** The dish being edited, so it can't be linked to itself. */
  excludeItemId?: string
  /** Where the group sits, for the price column's hint. */
  context?: 'dish' | 'meal' | 'set'
  autoFocus?: boolean
  showProblems?: boolean
}

export function OptionGroupEditor({ group, onChange, variants, menu, mode, currency, excludeItemId, context = 'dish', autoFocus, showProblems }: OptionGroupEditorProps) {
  const uid = React.useId()
  const [focusId, setFocusId] = React.useState<string | null>(null)
  const [openRow, setOpenRow] = React.useState<string | null>(null)
  const [moreOpen, setMoreOpen] = React.useState(Boolean(group.note || group.kitchenName))
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [overIndex, setOverIndex] = React.useState<number | null>(null)

  const remove = group.kind === 'remove'
  const course = group.kind === 'course'
  const sizes = mode === 'own' && variants && variants.length >= 2 ? variants : null
  const bySize = sizes ? sizePricesOn(group, sizes) : false
  const eachMax = eachMaxOf(group)
  const problems = showProblems ? checkGroup(withoutBlankRows(group), variants) : []
  const priceLabel = course ? 'Extra' : 'Price'
  const priceHint = course ? (context === 'set' ? 'Extra is on top of the set price.' : context === 'meal' ? 'Extra is on top of the meal price.' : 'Extra is on top of the dish price.') : null
  const linkedIds = group.options.map((o) => o.itemId).filter((id): id is string => Boolean(id))
  const otherDishes = menu.items.filter((i) => i.id !== excludeItemId && i.kind !== 'set')

  const set = (patch: Partial<MenuOptionGroup>) => onChange({ ...group, ...patch })
  const setOption = (id: string, change: (o: MenuOption) => MenuOption) => onChange({ ...group, options: group.options.map((o) => (o.id === id ? change(o) : o)) })
  const addOption = () => {
    const o = blankOption()
    const cap = eachMax
    onChange({ ...group, options: [...group.options, cap ? { ...o, maxQty: cap } : o] })
    setFocusId(o.id)
  }
  const dropOption = (id: string) => onChange({ ...group, options: group.options.filter((o) => o.id !== id) })
  const moveOption = (from: number, to: number) => onChange({ ...group, options: moveInList(group.options, from, to) })

  const setKind = (kind: GroupKind) => {
    if (kind === group.kind) return
    const meta = GROUP_KIND_META[kind]
    const next: MenuOptionGroup = { ...group, kind, min: meta.min, max: meta.max }
    if (kind === 'remove') delete next.freeQty
    if (kind !== 'course') delete next.askItemChoices
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <Field label="Name" required>
          {(control) => <Input {...control} size="sm" autoFocus={autoFocus} value={group.name} onChange={(e) => set({ name: e.target.value })} placeholder={KIND_PLACEHOLDER[group.kind]} />}
        </Field>
        <Field label="Type">
          {(control) => (
            <Select value={group.kind} onValueChange={(v) => setKind(v as GroupKind)}>
              <SelectTrigger size="sm" id={control.id} aria-label="Type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {GROUP_KIND_META[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <p className="-mt-2 text-xs text-subtle">{GROUP_KIND_META[group.kind].hint}</p>

      <div className="rounded-lg border border-line-subtle px-3">
        <RulesFields rules={group} kind={group.kind} idPrefix={uid} onChange={(r) => onChange({ ...group, min: r.min, max: r.max, freeQty: r.freeQty })} />
        {!remove ? (
          <SettingRow title="More than one of each" hint={eachMax ? `Like 2× extra cheese` : undefined} className="border-t border-line-subtle">
            {eachMax ? <CountInput value={eachMax} min={2} onChange={(n) => onChange(withEachMax(group, n))} label="Up to how many of each" suffix="each" /> : null}
            <Switch size="sm" checked={eachMax !== null} onCheckedChange={(on) => onChange(withEachMax(group, on ? 2 : null))} aria-label="Allow more than one of each" />
          </SettingRow>
        ) : null}
        {sizes && !remove ? (
          <SettingRow title="Price changes with size" hint={bySize ? sizes.map((v) => v.label || 'Size').join(' · ') : undefined} className="border-t border-line-subtle">
            <Switch size="sm" checked={bySize} onCheckedChange={(on) => onChange(withSizePrices(group, sizes, on))} aria-label="Price changes with size" />
          </SettingRow>
        ) : null}
        {course ? (
          <SettingRow title="Ask the dish's own choices" hint="Like how the steak is cooked" className="border-t border-line-subtle">
            <Switch size="sm" checked={Boolean(group.askItemChoices)} onCheckedChange={(on) => set({ askItemChoices: on || undefined })} aria-label="Ask the dish's own choices" />
          </SettingRow>
        ) : null}
      </div>

      {/* ---------- options ---------- */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium text-muted">{remove ? 'What guests can leave out' : 'Options'}</span>
          {priceHint ? <span className="text-xs text-subtle">{priceHint}</span> : null}
        </div>
        {group.options.length === 0 ? <p className="rounded-lg border border-dashed border-line px-3 py-3 text-xs text-subtle">No options yet.</p> : null}
        <ul className="flex list-none flex-col gap-2 p-0">
          {group.options.map((o, index) => {
            const view = optionView(menu, o)
            const linked = view.item
            const detailsOpen = openRow === o.id
            const name = view.label || 'option'
            return (
              <li
                key={o.id}
                onDragOver={(e) => {
                  if (dragIndex === null) return
                  e.preventDefault()
                  setOverIndex(index)
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  if (dragIndex !== null) moveOption(dragIndex, index)
                  setDragIndex(null)
                  setOverIndex(null)
                }}
                className={cn(
                  'rounded-lg border border-line bg-surface transition-[border-color,opacity] duration-200',
                  overIndex === index && dragIndex !== null && dragIndex !== index && 'border-primary',
                  dragIndex === index && 'opacity-60',
                )}
              >
                <div className="flex flex-wrap items-center gap-2 p-2">
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      setDragIndex(index)
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragEnd={() => {
                      setDragIndex(null)
                      setOverIndex(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowUp' && index > 0) {
                        e.preventDefault()
                        moveOption(index, index - 1)
                      } else if (e.key === 'ArrowDown' && index < group.options.length - 1) {
                        e.preventDefault()
                        moveOption(index, index + 1)
                      }
                    }}
                    aria-label={`Move ${name}. Use the up and down arrow keys.`}
                    className="grid size-7 shrink-0 cursor-grab place-items-center rounded-md text-faint hover:bg-surface-sunken hover:text-muted focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <GripVertical className="size-4" aria-hidden="true" />
                  </button>
                  {o.itemId ? <DishThumb url={view.imageUrl} /> : null}
                  <span className="flex min-w-0 flex-1 basis-40 items-center gap-1.5">
                    {remove ? <span className="shrink-0 text-xs text-subtle">No</span> : null}
                    <Input
                      size="sm"
                      autoFocus={focusId === o.id}
                      value={o.label}
                      onChange={(e) => setOption(o.id, (x) => ({ ...x, label: e.target.value }))}
                      placeholder={linked ? linked.name : remove ? 'Onion' : course ? 'Dish name' : 'Option name'}
                      aria-label={`Option ${index + 1} name`}
                      className="min-w-0 flex-1"
                    />
                  </span>
                  <span className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
                    {!remove && !bySize ? <MoneyInput value={o.price} onChange={(price) => setOption(o.id, (x) => ({ ...x, price }))} currency={currency} label={`${priceLabel} for ${name}`} /> : null}
                    {!remove ? (
                      <label className="flex min-h-9 items-center gap-1.5 text-xs text-muted">
                        <Checkbox size="sm" checked={Boolean(o.isDefault)} onCheckedChange={(on) => onChange(withDefault(group, o.id, on === true))} aria-label={`${name} picked to start with`} />
                        Default
                      </label>
                    ) : null}
                    <label className="flex min-h-9 items-center gap-1.5 text-xs text-muted">
                      <Switch size="sm" checked={Boolean(o.soldOut)} onCheckedChange={(on) => setOption(o.id, (x) => ({ ...x, soldOut: on || undefined }))} aria-label={`${name} sold out`} />
                      Sold out
                    </label>
                    <IconButton size="xs" variant="ghost" aria-label={`More for ${name}`} aria-expanded={detailsOpen} onClick={() => setOpenRow(detailsOpen ? null : o.id)} className={cn(detailsOpen && 'bg-surface-sunken text-foreground')}>
                      <Settings2 />
                    </IconButton>
                    <IconButton size="xs" variant="ghost" aria-label={`Delete ${name}`} className="text-danger hover:bg-danger-soft" onClick={() => dropOption(o.id)}>
                      <Trash2 />
                    </IconButton>
                  </span>
                </div>
                {bySize && sizes && !remove ? (
                  <div className="flex flex-wrap gap-2 border-t border-line-subtle px-2 py-2 sm:pl-11">
                    {sizes.map((v) => (
                      <label key={v.id} className="flex items-center gap-1.5 text-xs text-muted">
                        <span className="max-w-24 truncate">{v.label || 'Size'}</span>
                        <MoneyInput value={o.priceByVariant?.[v.id] ?? o.price} onChange={(price) => setOption(o.id, (x) => withSizePrice(x, sizes, v.id, price))} currency={currency} label={`${priceLabel} for ${name}, ${v.label || 'size'}`} />
                      </label>
                    ))}
                  </div>
                ) : null}
                {o.itemId && (view.soldOut && !o.soldOut) ? <p className="border-t border-line-subtle px-3 py-1.5 text-xs text-warning">{linked ? `${linked.name} is sold out, so guests can't pick it.` : 'The linked dish is no longer on the menu.'}</p> : null}
                {detailsOpen ? (
                  <div className="grid gap-3 border-t border-line-subtle p-3 sm:grid-cols-2">
                    {!remove ? (
                      <Field label="Most of this one">
                        {() => <CountInput value={o.maxQty ?? 1} min={1} onChange={(n) => setOption(o.id, (x) => withOptionMax(x, n))} label={`Most of ${name}`} className="w-24" />}
                      </Field>
                    ) : null}
                    <Field label="Kitchen label" optional>
                      {(control) => <Input {...control} size="sm" value={o.kitchenLabel ?? ''} onChange={(e) => setOption(o.id, (x) => ({ ...x, kitchenLabel: e.target.value || undefined }))} placeholder="Short name on the ticket" />}
                    </Field>
                    {!remove ? (
                      <Field label="Linked dish" description="Name, photo and sold out come from the dish." className="sm:col-span-2">
                        {(control) => (
                          <Select value={o.itemId ?? '__none'} onValueChange={(v) => setOption(o.id, (x) => withLink(x, v === '__none' ? null : v))}>
                            <SelectTrigger size="sm" id={control.id} aria-label="Linked dish">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none">Not linked</SelectItem>
                              {otherDishes.map((d) => (
                                <SelectItem key={d.id} value={d.id}>
                                  {d.name}
                                  {d.status === 'hidden' ? ' (hidden)' : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </Field>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" leftIcon={<Plus />} onClick={addOption}>
            Add an option
          </Button>
          {course || group.kind === 'extras' ? (
            <DishPicker
              menu={menu}
              excludeId={excludeItemId}
              linkedIds={linkedIds}
              onAdd={(ids) => onChange(withLinkedDishes(group, ids))}
              trigger={
                <Button size="sm" variant={course ? 'secondary' : 'ghost'} leftIcon={<UtensilsCrossed />}>
                  Add from your menu
                </Button>
              }
            />
          ) : null}
        </div>
      </div>

      {/* ---------- guest note and ticket ---------- */}
      <div>
        <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)} className="inline-flex min-h-9 items-center gap-1.5 rounded-md text-xs font-medium text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">
          <ChevronDown className={cn('size-3.5 transition-transform', moreOpen && 'rotate-180')} aria-hidden="true" />
          Guest note and kitchen
        </button>
        {moreOpen ? (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <Field label="Line under the heading" optional>
              {(control) => <Input {...control} size="sm" value={group.note ?? ''} onChange={(e) => set({ note: e.target.value || undefined })} placeholder="Up to 2 of each" />}
            </Field>
            <Field label="Ticket heading" optional>
              {(control) => <Input {...control} size="sm" value={group.kitchenName ?? ''} onChange={(e) => set({ kitchenName: e.target.value || undefined })} placeholder="SAUCE" />}
            </Field>
          </div>
        ) : null}
      </div>

      {problems.length ? (
        <ul className="flex flex-col gap-1 rounded-lg bg-danger-soft px-3 py-2 text-xs text-danger" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      ) : null}
      {mode === 'library' && group.options.some((o) => o.itemId) ? (
        <p className="text-xs text-subtle">
          <Badge size="sm" variant="neutral" className="mr-1.5">
            Linked
          </Badge>
          Rows linked to a dish follow that dish&apos;s name, photo and sold out.
        </p>
      ) : null}
    </div>
  )
}

/** Read-only option list, for saved groups on a dish. */
export function OptionsReadOnly({ group, menu, currency, priceText }: { group: MenuOptionGroup; menu: Menu; currency: CurrencyCode; priceText: (value: number, currency: CurrencyCode) => string }) {
  return (
    <ul className="flex flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle">
      {group.options.map((o) => {
        const view = optionView(menu, o)
        return (
          <li key={o.id} className={cn('flex min-h-10 items-center gap-2.5 px-3 py-1.5', view.soldOut && 'opacity-60')}>
            {o.itemId ? <DishThumb url={view.imageUrl} className="size-7" /> : null}
            <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-foreground">{group.kind === 'remove' ? `No ${view.label.toLowerCase()}` : view.label || 'Untitled'}</span>
            {o.isDefault ? <span className="text-xs text-subtle">Default</span> : null}
            {view.soldOut ? <span className="text-xs text-danger">Sold out</span> : null}
            {group.kind !== 'remove' ? <span className="w-16 text-right text-xs text-muted tabular-nums">{priceText(o.price, currency)}</span> : null}
          </li>
        )
      })}
    </ul>
  )
}

