'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, Check, ChevronDown, GripVertical, Layers, MoreHorizontal, Plus, Trash2, X } from 'lucide-react'

import { MediaManager } from '@/components/dashboard/activities/media-manager'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { availabilityText, checkDish, checkGroup, dishFromPrice, groupFreeNote, newMenuId, normaliseItem, sharedGroupUsage } from '@/lib/hospitality/menu-pricing'
import {
  ALLERGEN_LABEL,
  ALLERGENS,
  DIETARY_META,
  GROUP_KIND_META,
  ORDER_CHANNEL_LABEL,
  SPICE_LABEL,
  type DietaryTag,
  type GroupKind,
  type Menu,
  type MenuGroupRef,
  type MenuItem,
  type MenuItemStatus,
  type MenuMeal,
  type MenuOptionGroup,
  type MenuVariant,
  type OrderChannel,
  type SpiceLevel,
  type TimeWindow,
} from '@/lib/hospitality/types'
import { cn, formatNumber } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import { SharedGroupSheet } from './choice-groups-library'
import {
  addSize,
  blankDish,
  draftFromItem,
  duplicateRef,
  itemFromDraft,
  mealPreview,
  money,
  moveInList,
  optionsPreview,
  ownCopyOf,
  previewMenu,
  refGroup,
  refKey,
  removeSize,
  ruleLine,
  sizesOff,
  sizesOn,
  startGroup,
  startMeal,
  toLibrary,
  toggleDay,
  updateSize,
  withSharedRules,
  withTimesMode,
  withoutBlankRows,
  type PhotoDraft,
} from './menu-editor-model'
import { CountInput, MoneyInput, OptionGroupEditor, OptionsReadOnly, RulesFields, SettingRow } from './option-group-editor'

/* ==========================================================================
   <DishEditor> — add or edit one dish, in five tabs.

   Basics (photos, name, single dish or set menu, price or sizes), Choices
   (groups of options, own or saved), Meal (make it a meal), When it sells,
   and Details (diet, allergens, spice, kitchen, questions guests ask).
   Nothing is saved until Save; saved groups edited here save with the dish.
   ========================================================================== */

type Tab = 'basics' | 'choices' | 'meal' | 'times' | 'details'
const TAB_ORDER: Tab[] = ['basics', 'choices', 'meal', 'times', 'details']

const TAGS = Object.keys(DIETARY_META) as DietaryTag[]
const KINDS = Object.keys(GROUP_KIND_META) as GroupKind[]
const CHANNELS: OrderChannel[] = ['dine_in', 'pickup', 'delivery']
const STATIONS = ['Grill', 'Fryer', 'Cold', 'Bar', 'Pastry', 'Oven']
const DAYS: { day: number; short: string; name: string }[] = [
  { day: 1, short: 'M', name: 'Monday' },
  { day: 2, short: 'T', name: 'Tuesday' },
  { day: 3, short: 'W', name: 'Wednesday' },
  { day: 4, short: 'T', name: 'Thursday' },
  { day: 5, short: 'F', name: 'Friday' },
  { day: 6, short: 'S', name: 'Saturday' },
  { day: 0, short: 'S', name: 'Sunday' },
]

const dishCount = (n: number) => `${n} ${n === 1 ? 'dish' : 'dishes'}`
const plus = (value: number, currency: CurrencyCode) => (value > 0 ? `+${money(value, currency)}` : 'Free')

/* --------------------------------------------------------------------------
   Small pieces
   -------------------------------------------------------------------------- */

function Section({ title, hint, action, children, className }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  const id = React.useId()
  return (
    <section aria-labelledby={id} className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id={id} className="text-[0.8125rem] font-medium text-foreground">
            {title}
          </h3>
          {hint ? <p className="text-xs text-subtle">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function Problems({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <ul role="alert" className="flex flex-col gap-1 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-xs text-danger">
      {items.map((p) => (
        <li key={p}>{p}</li>
      ))}
    </ul>
  )
}

function Chip({ on, onClick, children, label }: { on: boolean; onClick: () => void; children: React.ReactNode; label?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-9 items-center rounded-lg border px-2.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        on ? 'border-foreground bg-foreground text-background' : 'border-line text-muted hover:border-line-strong hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function OptionalNumber({ value, onChange, label, suffix, min = 0 }: { value: number | undefined; onChange: (value: number | undefined) => void; label: string; suffix?: string; min?: number }) {
  return (
    <Input
      size="sm"
      type="number"
      inputMode="numeric"
      min={min}
      value={value === undefined ? '' : String(value)}
      onChange={(e) => {
        const raw = e.target.value
        if (!raw) return onChange(undefined)
        const n = Math.floor(Number(raw))
        if (Number.isFinite(n)) onChange(Math.max(min, n))
      }}
      aria-label={label}
      placeholder="—"
      suffix={suffix ? <span className="text-xs text-subtle">{suffix}</span> : undefined}
      className="w-32"
      inputClassName="tabular-nums"
    />
  )
}

/* --------------------------------------------------------------------------
   Times: day chips, from, to
   -------------------------------------------------------------------------- */

export function TimeWindowsEditor({ windows, onChange, addLabel = 'Add times' }: { windows: TimeWindow[]; onChange: (windows: TimeWindow[]) => void; addLabel?: string }) {
  const setAt = (index: number, next: TimeWindow) => onChange(windows.map((w, i) => (i === index ? next : w)))
  return (
    <div className="flex flex-col gap-2">
      {windows.map((w, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2">
          <div className="flex gap-1" role="group" aria-label="Days">
            {DAYS.map((d) => {
              const on = w.days.includes(d.day)
              return (
                <button
                  key={d.day}
                  type="button"
                  aria-pressed={on}
                  aria-label={d.name}
                  onClick={() => setAt(index, toggleDay(w, d.day))}
                  className={cn('grid size-9 place-items-center rounded-md border text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-primary', on ? 'border-foreground bg-foreground text-background' : 'border-line text-muted hover:border-line-strong')}
                >
                  {d.short}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-1.5">
            <Input size="sm" type="time" value={w.from} onChange={(e) => setAt(index, { ...w, from: e.target.value })} aria-label="From" className="w-28" inputClassName="tabular-nums" />
            <span className="text-xs text-subtle">to</span>
            <Input size="sm" type="time" value={w.to} onChange={(e) => setAt(index, { ...w, to: e.target.value })} aria-label="To" className="w-28" inputClassName="tabular-nums" />
          </div>
          <IconButton size="xs" variant="ghost" aria-label="Delete these times" className="ml-auto text-danger hover:bg-danger-soft" onClick={() => onChange(windows.filter((_, i) => i !== index))}>
            <Trash2 />
          </IconButton>
        </div>
      ))}
      <Button size="sm" variant="outline" leftIcon={<Plus />} className="self-start" onClick={() => onChange([...windows, { days: [1, 2, 3, 4, 5], from: '12:00', to: '15:00' }])}>
        {addLabel}
      </Button>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Group cards: a dish's groups (or its meal's), own or saved
   -------------------------------------------------------------------------- */

interface GroupsEditorProps {
  refs: MenuGroupRef[]
  onChange: (refs: MenuGroupRef[]) => void
  menu: Menu
  currency: CurrencyCode
  variants?: MenuVariant[]
  itemId: string
  context: 'dish' | 'meal' | 'set'
  showProblems: boolean
  onEditShared: (group: MenuOptionGroup) => void
  onSaveToLibrary: (group: MenuOptionGroup) => void
  highlightSaved?: boolean
  empty: (add: (kind: GroupKind, name?: string) => void) => React.ReactNode
}

function GroupsEditor({ refs, onChange, menu, currency, variants, itemId, context, showProblems, onEditShared, onSaveToLibrary, highlightSaved, empty }: GroupsEditorProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set())
  const [fresh, setFresh] = React.useState<string | null>(null)
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [overIndex, setOverIndex] = React.useState<number | null>(null)
  const library = menu.sharedGroups ?? []
  const usedShared = new Set(refs.filter((r) => r.type === 'shared').map((r) => (r.type === 'shared' ? r.groupId : '')))

  const toggle = (key: string, open?: boolean) =>
    setExpanded((s) => {
      const next = new Set(s)
      if (open ?? !next.has(key)) next.add(key)
      else next.delete(key)
      return next
    })
  const add = (kind: GroupKind, name = '') => {
    const group = startGroup(kind, name)
    onChange([...refs, { type: 'own', group }])
    toggle(group.id, true)
    setFresh(group.id)
  }
  const replaceAt = (index: number, ref: MenuGroupRef) => onChange(refs.map((r, i) => (i === index ? ref : r)))
  const removeAt = (index: number) => onChange(refs.filter((_, i) => i !== index))
  const move = (from: number, to: number) => onChange(moveInList(refs, from, to))

  return (
    <div className="flex flex-col gap-3">
      {refs.length === 0 ? empty(add) : null}
      <ol className="flex list-none flex-col gap-3 p-0">
        {refs.map((ref, index) => {
          const key = refKey(ref)
          const group = refGroup(menu, ref)
          const open = expanded.has(key)
          if (!group) {
            return (
              <li key={key} className="flex items-center justify-between gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-xs text-subtle">
                This saved group was deleted.
                <Button size="xs" variant="ghost" onClick={() => removeAt(index)}>
                  Remove
                </Button>
              </li>
            )
          }
          const shared = ref.type === 'shared' ? library.find((g) => g.id === ref.groupId) ?? null : null
          const usage = shared ? sharedGroupUsage(menu, shared.id).length : 0
          const bad = showProblems && ref.type === 'own' && checkGroup(withoutBlankRows(group), variants).length > 0
          const title = group.name.trim() || 'New group'
          return (
            <li
              key={key}
              onDragOver={(e) => {
                if (dragIndex === null) return
                e.preventDefault()
                setOverIndex(index)
              }}
              onDrop={(e) => {
                e.preventDefault()
                if (dragIndex !== null) move(dragIndex, index)
                setDragIndex(null)
                setOverIndex(null)
              }}
              className={cn(
                'rounded-xl border bg-surface transition-[border-color,opacity] duration-200',
                bad ? 'border-danger/50' : 'border-line',
                overIndex === index && dragIndex !== null && dragIndex !== index && 'border-primary',
                dragIndex === index && 'opacity-60',
              )}
            >
              <div className="flex items-center gap-1.5 p-2">
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
                      move(index, index - 1)
                    } else if (e.key === 'ArrowDown' && index < refs.length - 1) {
                      e.preventDefault()
                      move(index, index + 1)
                    }
                  }}
                  aria-label={`Move ${title}. Use the up and down arrow keys.`}
                  className="hidden size-8 shrink-0 cursor-grab place-items-center rounded-md text-faint hover:bg-surface-sunken hover:text-muted focus-visible:outline-2 focus-visible:outline-primary sm:grid"
                >
                  <GripVertical className="size-4" aria-hidden="true" />
                </button>
                <button type="button" aria-expanded={open} onClick={() => toggle(key)} className="flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left focus-visible:outline-2 focus-visible:outline-primary">
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="truncate text-[0.875rem] font-medium text-foreground">{title}</span>
                      {shared ? (
                        <Badge size="sm" variant="primary">
                          <Layers aria-hidden="true" />
                          Saved group
                        </Badge>
                      ) : null}
                      {bad ? <span className="text-xs text-danger">Needs a fix</span> : null}
                    </span>
                    <span className="block truncate text-xs text-subtle">
                      {GROUP_KIND_META[group.kind].label} · {ruleLine(group, groupFreeNote(group))}
                      {shared ? ` · on ${dishCount(usage)}` : ` · ${group.options.length} ${group.options.length === 1 ? 'option' : 'options'}`}
                    </span>
                  </span>
                  <ChevronDown aria-hidden="true" className={cn('size-4 shrink-0 text-faint transition-transform', open && 'rotate-180')} />
                </button>
                <IconButton size="xs" variant="ghost" aria-label={`Move ${title} up`} disabled={index === 0} onClick={() => move(index, index - 1)}>
                  <ArrowUp />
                </IconButton>
                <IconButton size="xs" variant="ghost" aria-label={`Move ${title} down`} disabled={index === refs.length - 1} onClick={() => move(index, index + 1)}>
                  <ArrowDown />
                </IconButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton size="xs" variant="ghost" aria-label={`Actions for ${title}`}>
                      <MoreHorizontal />
                    </IconButton>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => toggle(key)}>{open ? 'Close' : 'Edit'}</DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        const copy = duplicateRef(menu, ref)
                        if (!copy) return
                        onChange([...refs.slice(0, index + 1), copy, ...refs.slice(index + 1)])
                        if (copy.type === 'own') toggle(copy.group.id, true)
                      }}
                    >
                      Duplicate
                    </DropdownMenuItem>
                    {ref.type === 'own' ? (
                      <DropdownMenuItem
                        onSelect={() => {
                          const moved = toLibrary(ref)
                          if (!moved) return
                          onSaveToLibrary(moved.group)
                          replaceAt(index, moved.ref)
                        }}
                      >
                        Save as a saved group
                      </DropdownMenuItem>
                    ) : (
                      <>
                        {shared ? <DropdownMenuItem onSelect={() => onEditShared(shared)}>Edit for every dish</DropdownMenuItem> : null}
                        <DropdownMenuItem
                          onSelect={() => {
                            const copy = ownCopyOf(menu, ref)
                            if (!copy) return
                            replaceAt(index, copy)
                            if (copy.type === 'own') toggle(copy.group.id, true)
                          }}
                        >
                          Make it this dish&apos;s own copy
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem tone="danger" onSelect={() => removeAt(index)}>
                      Remove from dish
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {open ? (
                <div className="border-t border-line-subtle p-3 sm:p-4">
                  {ref.type === 'own' ? (
                    <OptionGroupEditor
                      group={ref.group}
                      onChange={(group) => replaceAt(index, { type: 'own', group })}
                      variants={variants}
                      menu={menu}
                      mode="own"
                      currency={currency}
                      excludeItemId={itemId}
                      context={context}
                      autoFocus={fresh === ref.group.id}
                      showProblems={showProblems}
                    />
                  ) : shared ? (
                    <div className="flex flex-col gap-3">
                      <OptionsReadOnly group={group} menu={menu} currency={currency} priceText={plus} />
                      <div>
                        <Button size="sm" variant="outline" onClick={() => onEditShared(shared)}>
                          Edit for every dish
                        </Button>
                      </div>
                      <div className="rounded-lg border border-line-subtle px-3">
                        <div className="flex min-h-10 items-center justify-between gap-2 border-b border-line-subtle">
                          <span className="text-xs font-medium text-muted">Rules on this dish</span>
                          {ref.rules ? (
                            <Button size="xs" variant="link" onClick={() => replaceAt(index, { type: 'shared', groupId: ref.groupId })}>
                              Same as saved
                            </Button>
                          ) : (
                            <span className="text-xs text-subtle">Same as saved</span>
                          )}
                        </div>
                        <RulesFields rules={group} kind={group.kind} idPrefix={`${key}-rules`} onChange={(rules) => replaceAt(index, withSharedRules(shared, ref, rules))} />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant={highlightSaved ? 'outline' : 'secondary'} leftIcon={<Plus />}>
              Add a group
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>What kind?</DropdownMenuLabel>
            {KINDS.map((k) => (
              <DropdownMenuItem key={k} onSelect={() => add(k)} className="flex-col items-start gap-0.5">
                <span className="text-[0.8125rem] text-foreground">{GROUP_KIND_META[k].label}</span>
                <span className="text-xs text-subtle">{GROUP_KIND_META[k].hint}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover>
          <PopoverTrigger asChild>
            <Button size="sm" variant={highlightSaved ? 'secondary' : 'outline'} leftIcon={<Layers />}>
              Use a saved group
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" width="lg" padding="none" className="max-w-[calc(100vw-2rem)]">
            {library.length === 0 ? (
              <p className="px-4 py-5 text-center text-xs text-subtle">No saved groups yet. Open a group&apos;s menu and pick &ldquo;Save as a saved group&rdquo;.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto p-1">
                {library.map((g) => {
                  const used = usedShared.has(g.id)
                  const n = sharedGroupUsage(menu, g.id).length
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        disabled={used}
                        onClick={() => onChange([...refs, { type: 'shared', groupId: g.id }])}
                        className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="truncate text-[0.8125rem] font-medium text-foreground">{g.name}</span>
                          <span className="shrink-0 text-xs text-subtle">{used ? 'On this dish' : `on ${dishCount(n)}`}</span>
                        </span>
                        <span className="text-xs text-subtle">{ruleLine(g, groupFreeNote(g))}</span>
                        <span className="truncate text-xs text-muted">{optionsPreview(menu, g, currency)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
   The editor
   -------------------------------------------------------------------------- */

export interface DishEditorProps {
  open: boolean
  /** null with open = a new dish. */
  item: MenuItem | null
  menu: Menu
  currency: CurrencyCode
  tenantId: string
  defaultCategoryId: string
  onClose: () => void
  /** The dish, plus saved groups made or changed while editing it. */
  onSave: (item: MenuItem, library: MenuOptionGroup[]) => void
  onRemove: (item: MenuItem) => void
  onEditSections: () => void
}

export function DishEditor({ open, item, menu, currency, tenantId, defaultCategoryId, onClose, onSave, onRemove, onEditSections }: DishEditorProps) {
  const uid = React.useId()
  const [draft, setDraft] = React.useState<MenuItem>(() => blankDish(tenantId, defaultCategoryId))
  const [photos, setPhotos] = React.useState<PhotoDraft[]>([])
  const [library, setLibrary] = React.useState<Record<string, MenuOptionGroup>>({})
  const [tab, setTab] = React.useState<Tab>('basics')
  const [showProblems, setShowProblems] = React.useState(false)
  const [sharedEdit, setSharedEdit] = React.useState<MenuOptionGroup | null>(null)
  const [mealBackup, setMealBackup] = React.useState<MenuMeal | null>(null)
  /** The dish as it was opened; kept while the sheet animates closed. */
  const [opened, setOpened] = React.useState<MenuItem | null>(item)

  React.useEffect(() => {
    if (!open) return
    setOpened(item)
    if (item) {
      const opened = draftFromItem(item)
      setDraft(opened.item)
      setPhotos(opened.photos)
    } else {
      setDraft(blankDish(tenantId, defaultCategoryId))
      setPhotos([])
    }
    setLibrary({})
    setTab('basics')
    setShowProblems(false)
    setSharedEdit(null)
    setMealBackup(null)
  }, [open, item, tenantId, defaultCategoryId])

  const set = <K extends keyof MenuItem>(key: K, value: MenuItem[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const update = (change: (d: MenuItem) => MenuItem) => setDraft(change)

  const isSet = draft.kind === 'set'
  const candidate = React.useMemo(() => itemFromDraft(draft, photos), [draft, photos])
  const pmenu = React.useMemo(() => previewMenu(menu, candidate, library), [menu, candidate, library])
  const problems = React.useMemo(() => checkDish(pmenu, candidate), [pmenu, candidate])
  const from = React.useMemo(() => dishFromPrice(pmenu, normaliseItem(candidate)), [pmenu, candidate])
  const category = pmenu.categories.find((c) => c.id === draft.categoryId)
  const samples = React.useMemo(() => {
    const seen = new Set<string>()
    return menu.items.filter((i) => i.imageUrl && !seen.has(i.imageUrl) && seen.add(i.imageUrl)).map((i) => ({ url: i.imageUrl!, alt: i.name }))
  }, [menu.items])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'basics', label: 'Basics' },
    { id: 'choices', label: isSet ? 'Courses' : 'Choices' },
    ...(isSet ? [] : [{ id: 'meal' as const, label: 'Meal' }]),
    { id: 'times', label: 'When it sells' },
    { id: 'details', label: 'Details' },
  ]
  const tabProblems = (t: Tab) => (t === 'meal' && isSet ? [] : problems[t])
  const problemCount = TAB_ORDER.reduce((n, t) => n + tabProblems(t).length, 0)

  React.useEffect(() => {
    if (isSet && tab === 'meal') setTab('choices')
  }, [isSet, tab])

  const save = () => {
    const firstBad = TAB_ORDER.find((t) => tabProblems(t).length > 0)
    if (firstBad) {
      setShowProblems(true)
      setTab(firstBad)
      return
    }
    onSave(candidate, Object.values(library))
  }

  const keepInLibrary = (group: MenuOptionGroup) => setLibrary((l) => ({ ...l, [group.id]: group }))

  const setMealOn = (on: boolean) => {
    if (on) set('meal', mealBackup ?? startMeal())
    else {
      setMealBackup(draft.meal ?? null)
      set('meal', null)
    }
  }
  const setMeal = (patch: Partial<MenuMeal>) => setDraft((d) => (d.meal ? { ...d, meal: { ...d.meal, ...patch } } : d))

  const variants = draft.variants && draft.variants.length >= 2 ? draft.variants : undefined
  const timesMode = draft.availability?.length ? 'set' : 'section'

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" size="xl">
        <SheetHeader>
          <SheetTitle>{opened ? (isSet ? 'Edit set menu' : 'Edit dish') : isSet ? 'Add a set menu' : 'Add a dish'}</SheetTitle>
          <SheetDescription>{opened ? `${formatNumber(opened.sold30d)} sold in the last 30 days` : 'It goes live where it sells as soon as you add it.'}</SheetDescription>
          <p className="mt-1 text-[0.8125rem] text-muted" aria-live="polite">
            Guests pay {from.from ? 'from ' : ''}
            <span className="font-medium text-foreground tabular-nums">{money(from.price, currency)}</span>
          </p>
        </SheetHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex min-h-0 flex-1 flex-col gap-0">
          <TabsList aria-label="Dish settings" className="no-scrollbar shrink-0 overflow-x-auto border-b border-line-subtle px-3 sm:px-5">
            {tabs.map((t) => {
              const bad = (showProblems || opened !== null) && tabProblems(t.id).length > 0
              return (
                <TabsTrigger key={t.id} value={t.id}>
                  {t.label}
                  {bad ? (
                    <>
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-danger" />
                      <span className="sr-only">, needs a fix</span>
                    </>
                  ) : null}
                </TabsTrigger>
              )
            })}
          </TabsList>

          <SheetBody>
            {/* ---------------- Basics ---------------- */}
            <TabsContent value="basics" className="flex flex-col gap-6">
              {showProblems ? <Problems items={tabProblems('basics')} /> : null}
              <Section title="Photos" hint="The first one is the cover.">
                <MediaManager media={photos} onChange={setPhotos} emptyText="No photo yet. Dishes with a photo sell more." samples={samples} />
              </Section>

              <Field label="Name" required>
                {(control) => <Input {...control} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder={isSet ? 'Lunch set' : 'Gyros pita'} />}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Type">
                  <Segmented
                    size="sm"
                    label="Type"
                    fullWidth
                    options={[
                      { value: 'dish', label: 'Single dish' },
                      { value: 'set', label: 'Set menu' },
                    ]}
                    value={isSet ? 'set' : 'dish'}
                    onValueChange={(v) => set('kind', v as 'dish' | 'set')}
                  />
                </Field>
                <Field label="Section">
                  {(control) => (
                    <Select value={draft.categoryId} onValueChange={(v) => set('categoryId', v)}>
                      <SelectTrigger id={control.id} aria-label="Section">
                        <SelectValue placeholder="Pick a section" />
                      </SelectTrigger>
                      <SelectContent>
                        {pmenu.categories
                          .slice()
                          .sort((a, b) => a.sortOrder - b.sortOrder)
                          .map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </div>
              {isSet ? <p className="-mt-3 text-xs text-subtle">A set menu has one price. Guests pick each course from your dishes on the Courses tab.</p> : null}

              <Field label="Description">
                {(control) => <Textarea {...control} rows={2} value={draft.description} onChange={(e) => set('description', e.target.value)} placeholder={isSet ? 'A starter, a main and a drink.' : 'What is in it, how it is cooked, what it comes with.'} />}
              </Field>

              {variants ? (
                <Section
                  title="Sizes"
                  hint="Each size has its own full price."
                  action={
                    <Button size="xs" variant="link" onClick={() => update(sizesOff)}>
                      One price
                    </Button>
                  }
                >
                  <Field label="Size heading" description="What guests see above the sizes.">
                    {(control) => <Input {...control} size="sm" value={draft.variantLabel ?? ''} onChange={(e) => set('variantLabel', e.target.value || undefined)} placeholder="Size" className="sm:w-56" />}
                  </Field>
                  <ul className="flex list-none flex-col gap-2 p-0" aria-label="Sizes">
                    {variants.map((v, index) => (
                      <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2">
                        <Input size="sm" value={v.label} onChange={(e) => update((d) => updateSize(d, v.id, { label: e.target.value }))} placeholder={index === 0 ? 'Regular' : 'Large'} aria-label={`Size ${index + 1} name`} className="min-w-0 flex-1 basis-36" />
                        <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
                          <MoneyInput value={v.price} onChange={(price) => update((d) => updateSize(d, v.id, { price }))} currency={currency} label={`Price for ${v.label || `size ${index + 1}`}`} freeHint={false} />
                          <label className="flex min-h-9 items-center gap-1.5 text-xs text-muted">
                            <input type="radio" name={`${uid}-default-size`} checked={Boolean(v.isDefault)} onChange={() => update((d) => updateSize(d, v.id, { isDefault: true }))} className="size-4 accent-[var(--primary)]" />
                            Default
                          </label>
                          <label className="flex min-h-9 items-center gap-1.5 text-xs text-muted">
                            <Switch size="sm" checked={Boolean(v.soldOut)} onCheckedChange={(on) => update((d) => updateSize(d, v.id, { soldOut: on || undefined }))} aria-label={`${v.label || 'Size'} sold out`} />
                            Sold out
                          </label>
                          <IconButton size="xs" variant="ghost" aria-label={`Delete ${v.label || 'size'}`} className="text-danger hover:bg-danger-soft" onClick={() => update((d) => removeSize(d, v.id))}>
                            <Trash2 />
                          </IconButton>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button size="sm" variant="outline" leftIcon={<Plus />} className="self-start" onClick={() => update(addSize)}>
                    Add a size
                  </Button>
                </Section>
              ) : (
                <div className="flex flex-col items-start gap-1">
                  <Field label={isSet ? 'Set price' : 'Price'} required>
                    {(control) => <MoneyInput id={control.id} value={draft.price} onChange={(price) => set('price', price)} currency={currency} label={isSet ? 'Set price' : 'Price'} freeHint={false} className="w-32" />}
                  </Field>
                  {!isSet ? (
                    <Button size="xs" variant="link" className="px-0" onClick={() => update(sizesOn)}>
                      Sold in sizes
                    </Button>
                  ) : null}
                </div>
              )}

              <Field label="Status">
                <Segmented
                  size="sm"
                  label="Status"
                  options={[
                    { value: 'available', label: 'On sale' },
                    { value: 'sold_out', label: 'Sold out' },
                    { value: 'hidden', label: 'Hidden' },
                  ]}
                  value={draft.status}
                  onValueChange={(v) => set('status', v as MenuItemStatus)}
                />
              </Field>
              {draft.status === 'hidden' ? <p className="-mt-4 text-xs text-subtle">Hidden dishes are not on the menu, but meals and set menus can still offer them.</p> : null}

              <div className="divide-y divide-line-subtle rounded-lg border border-line-subtle px-3">
                <SettingRow title="Show as popular">
                  <Switch size="sm" checked={draft.popular} onCheckedChange={(v) => set('popular', v)} aria-label="Show as popular" />
                </SettingRow>
              </div>

              <Field label="Sells on">
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {CHANNELS.map((c) => (
                    <label key={c} className="flex min-h-9 items-center gap-2.5 text-[0.8125rem] text-foreground">
                      <Checkbox checked={draft.channels.includes(c)} onCheckedChange={(checked) => set('channels', checked ? [...draft.channels.filter((x) => x !== c), c] : draft.channels.filter((x) => x !== c))} />
                      {ORDER_CHANNEL_LABEL[c]}
                    </label>
                  ))}
                </div>
              </Field>
            </TabsContent>

            {/* ---------------- Choices / Courses ---------------- */}
            <TabsContent value="choices" className="flex flex-col gap-4">
              {showProblems ? <Problems items={tabProblems('choices')} /> : null}
              <p className="text-xs text-subtle">{isSet ? 'One group per course. Link the dishes guests choose from; add an extra for any that cost more.' : 'Group the choices the way guests think: meat, toppings, sauces, what to leave out.'}</p>
              <GroupsEditor
                refs={draft.groups ?? []}
                onChange={(groups) => set('groups', groups)}
                menu={pmenu}
                currency={currency}
                variants={variants}
                itemId={draft.id}
                context={isSet ? 'set' : 'dish'}
                showProblems={showProblems}
                onEditShared={setSharedEdit}
                onSaveToLibrary={keepInLibrary}
                empty={(add) => (
                  <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-4 py-8 text-center">
                    <p className="text-[0.8125rem] text-muted">{isSet ? 'No courses yet.' : 'No choices. Guests add it as it is.'}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {isSet ? (
                        <>
                          <Chip on={false} onClick={() => add('course', 'Starter')}>
                            + Starter
                          </Chip>
                          <Chip on={false} onClick={() => add('course', 'Main')}>
                            + Main
                          </Chip>
                          <Chip on={false} onClick={() => add('course', 'Drink')}>
                            + Drink
                          </Chip>
                        </>
                      ) : (
                        <>
                          <Chip
                            on={false}
                            onClick={() => {
                              update(sizesOn)
                              setTab('basics')
                            }}
                          >
                            Sizes
                          </Chip>
                          <Chip on={false} onClick={() => add('extras', 'Add toppings')}>
                            Add toppings
                          </Chip>
                          <Chip on={false} onClick={() => add('remove', 'Leave anything out?')}>
                            Leave out
                          </Chip>
                        </>
                      )}
                    </div>
                  </div>
                )}
              />
            </TabsContent>

            {/* ---------------- Meal ---------------- */}
            {!isSet ? (
              <TabsContent value="meal" className="flex flex-col gap-4">
                {showProblems ? <Problems items={tabProblems('meal')} /> : null}
                <div className="rounded-lg border border-line-subtle px-3">
                  <SettingRow title="Offer it as a meal" hint="Guests add a side and a drink for one price on top.">
                    <Switch size="sm" checked={Boolean(draft.meal)} onCheckedChange={setMealOn} aria-label="Offer it as a meal" />
                  </SettingRow>
                </div>
                {draft.meal ? (
                  <>
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem]">
                      <Field label="Button text">
                        {(control) => <Input {...control} size="sm" value={draft.meal?.label ?? ''} onChange={(e) => setMeal({ label: e.target.value })} placeholder="Make it a meal" />}
                      </Field>
                      <Field label="Meal price" description="On top of the dish.">
                        {(control) => <MoneyInput id={control.id} value={draft.meal?.price ?? 0} onChange={(price) => setMeal({ price })} currency={currency} label="Meal price" freeHint={false} className="w-full" />}
                      </Field>
                    </div>
                    <Field label="One line for guests" optional>
                      {(control) => <Input {...control} size="sm" value={draft.meal?.description ?? ''} onChange={(e) => setMeal({ description: e.target.value })} placeholder="With a side and a drink" />}
                    </Field>
                    <GroupsEditor
                      refs={draft.meal.groups}
                      onChange={(groups) => setMeal({ groups })}
                      menu={pmenu}
                      currency={currency}
                      variants={variants}
                      itemId={draft.id}
                      context="meal"
                      showProblems={showProblems}
                      onEditShared={setSharedEdit}
                      onSaveToLibrary={keepInLibrary}
                      highlightSaved
                      empty={(add) => (
                        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line px-4 py-6 text-center">
                          <p className="text-[0.8125rem] text-muted">What comes with the meal? Sides and drinks are usually saved groups.</p>
                          <Chip on={false} onClick={() => add('course', 'Choose a side')}>
                            + A side to pick
                          </Chip>
                        </div>
                      )}
                    />
                    {mealPreview(pmenu, candidate, currency) ? <p className="text-[0.8125rem] text-muted tabular-nums">Preview: {mealPreview(pmenu, candidate, currency)}</p> : null}
                  </>
                ) : null}
              </TabsContent>
            ) : null}

            {/* ---------------- When it sells ---------------- */}
            <TabsContent value="times" className="flex flex-col gap-5">
              {showProblems ? <Problems items={tabProblems('times')} /> : null}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-sunken px-3 py-2.5 text-[0.8125rem]">
                <span className="text-muted">
                  {category?.name ?? 'Section'}: <span className="text-foreground">{category?.hours?.length ? availabilityText(category.hours) : 'whenever you take orders'}</span>
                </span>
                <Button size="xs" variant="link" onClick={onEditSections}>
                  Edit in Sections
                </Button>
              </div>
              <Segmented
                size="sm"
                label="When it sells"
                options={[
                  { value: 'section', label: 'Whenever the section is on' },
                  { value: 'set', label: 'Only at set times' },
                ]}
                value={timesMode}
                onValueChange={(v) => update((d) => withTimesMode(d, category, v as 'section' | 'set'))}
              />
              {timesMode === 'set' ? <TimeWindowsEditor windows={draft.availability ?? []} onChange={(w) => set('availability', w.length ? w : null)} /> : null}
              <Field label="Kitchen time" description="How long it takes to make.">
                {() => <CountInput value={draft.prepMinutes} min={0} max={240} onChange={(n) => set('prepMinutes', n)} label="Kitchen time in minutes" suffix="min" className="w-28" />}
              </Field>
            </TabsContent>

            {/* ---------------- Details ---------------- */}
            <TabsContent value="details" className="flex flex-col gap-6">
              {showProblems ? <Problems items={tabProblems('details')} /> : null}
              <Section title="Diet">
                <div className="flex flex-wrap gap-1.5">
                  {TAGS.map((t) => {
                    const on = draft.tags.includes(t)
                    return (
                      <Chip key={t} on={on} onClick={() => set('tags', on ? draft.tags.filter((x) => x !== t) : [...draft.tags, t])}>
                        {DIETARY_META[t].label}
                      </Chip>
                    )
                  })}
                </div>
              </Section>
              <Section title="Allergens" hint="Guests see these on the dish.">
                <div className="flex flex-wrap gap-1.5">
                  {ALLERGENS.map((a) => {
                    const list = draft.allergens ?? []
                    const on = list.includes(a)
                    return (
                      <Chip key={a} on={on} onClick={() => set('allergens', on ? list.filter((x) => x !== a) : [...list, a])}>
                        {ALLERGEN_LABEL[a]}
                      </Chip>
                    )
                  })}
                </div>
              </Section>
              <Section title="Spice">
                <Segmented
                  size="sm"
                  label="Spice"
                  options={([0, 1, 2, 3] as SpiceLevel[]).map((s) => ({ value: String(s), label: SPICE_LABEL[s] }))}
                  value={String(draft.spice ?? (draft.tags.includes('spicy') ? 1 : 0))}
                  onValueChange={(v) => set('spice', Number(v) as SpiceLevel)}
                />
              </Section>
              <div className="flex flex-wrap gap-4">
                <Field label="Calories" optional>
                  {() => <OptionalNumber value={draft.calories} onChange={(v) => set('calories', v)} label="Calories" suffix="kcal" />}
                </Field>
                <Field label="Serves" optional>
                  {() => <OptionalNumber value={draft.serves} min={1} onChange={(v) => set('serves', v)} label="Serves" suffix="people" />}
                </Field>
              </div>

              <Section title="Kitchen" hint="Only staff see this.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Name on the ticket" optional>
                    {(control) => <Input {...control} size="sm" value={draft.kitchenName ?? ''} onChange={(e) => set('kitchenName', e.target.value || undefined)} placeholder="GYROS" />}
                  </Field>
                  <Field label="Station" optional>
                    {(control) => (
                      <>
                        <Input {...control} size="sm" list={`${uid}-stations`} value={draft.station ?? ''} onChange={(e) => set('station', e.target.value || undefined)} placeholder="Grill" />
                        <datalist id={`${uid}-stations`}>
                          {STATIONS.map((s) => (
                            <option key={s} value={s} />
                          ))}
                        </datalist>
                      </>
                    )}
                  </Field>
                </div>
                <Field label="Note for the kitchen" optional>
                  {(control) => <Textarea {...control} rows={2} value={draft.kitchenNote ?? ''} onChange={(e) => set('kitchenNote', e.target.value || undefined)} placeholder="Plate the skewers on the pita." />}
                </Field>
              </Section>

              <Section title="Questions guests ask" hint="Shown on the dish, like “Is it boned?”.">
                {(draft.faq ?? []).map((f, index) => (
                  <div key={f.id} className="flex items-start gap-2 rounded-lg border border-line bg-surface p-2">
                    <div className="grid min-w-0 flex-1 gap-2">
                      <Input size="sm" value={f.question} onChange={(e) => set('faq', (draft.faq ?? []).map((x) => (x.id === f.id ? { ...x, question: e.target.value } : x)))} placeholder="Is the pita vegan?" aria-label={`Question ${index + 1}`} />
                      <Textarea rows={2} value={f.answer} onChange={(e) => set('faq', (draft.faq ?? []).map((x) => (x.id === f.id ? { ...x, answer: e.target.value } : x)))} placeholder="The answer" aria-label={`Answer ${index + 1}`} />
                    </div>
                    <IconButton size="xs" variant="ghost" aria-label={`Delete question ${index + 1}`} className="text-danger hover:bg-danger-soft" onClick={() => set('faq', (draft.faq ?? []).filter((x) => x.id !== f.id))}>
                      <Trash2 />
                    </IconButton>
                  </div>
                ))}
                <Button size="sm" variant="outline" leftIcon={<Plus />} className="self-start" onClick={() => set('faq', [...(draft.faq ?? []), { id: newMenuId('faq'), question: '', answer: '' }])}>
                  Add a question
                </Button>
              </Section>
            </TabsContent>
          </SheetBody>
        </Tabs>

        <SheetFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" leftIcon={<Check />} onClick={save}>
              {opened ? 'Save' : 'Add to menu'}
            </Button>
            <Button size="sm" variant="ghost" leftIcon={<X />} onClick={onClose}>
              Cancel
            </Button>
            {showProblems && problemCount > 0 ? (
              <span className="text-xs text-danger" role="status">
                {problemCount === 1 ? '1 thing to fix' : `${problemCount} things to fix`}
              </span>
            ) : null}
          </div>
          {opened ? (
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => onRemove(opened)}>
              Remove
            </Button>
          ) : null}
        </SheetFooter>

        <SharedGroupSheet
          open={sharedEdit !== null}
          group={sharedEdit}
          isNew={false}
          menu={pmenu}
          currency={currency}
          usage={sharedEdit ? sharedGroupUsage(pmenu, sharedEdit.id) : []}
          onClose={() => setSharedEdit(null)}
          onSave={(group) => {
            keepInLibrary(group)
            setSharedEdit(null)
          }}
          saveLabel="Done"
        />
      </SheetContent>
    </Sheet>
  )
}
