import {
  blankGroup,
  dishFromPrice,
  groupFromModifier,
  groupRule,
  newMenuId,
  optionPrice,
  optionView,
  resolveGroups,
  resolveMealGroups,
  sharedGroupUsage,
} from '@/lib/hospitality/menu-pricing'
import type {
  GroupKind,
  Menu,
  MenuCategory,
  MenuGroupRef,
  MenuItem,
  MenuMeal,
  MenuOption,
  MenuOptionGroup,
  MenuVariant,
  TimeWindow,
} from '@/lib/hospitality/types'
import { formatCurrency } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   Menu editor model — the plain functions behind the dish editor, the
   choice-group cards and the saved-groups library. No React here, so the
   editor's steps can be checked from a script: open a dish, change it,
   save it, open it again.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Money
   -------------------------------------------------------------------------- */

/** €6.50, €7. Whole amounts drop the cents. */
export function money(value: number, currency: CurrencyCode): string {
  return formatCurrency(value, currency, { decimals: Math.round(value) % 100 !== 0 })
}

/** "+€1.50" or "Free". */
export function plusMoney(value: number, currency: CurrencyCode): string {
  return value > 0 ? `+${money(value, currency)}` : 'Free'
}

/** Minor units from what an owner typed ("6.5" → 650). Empty = 0. */
export function parseMoney(text: string): number {
  const value = Number(text.replace(',', '.').trim() || 0)
  return Number.isFinite(value) ? Math.max(0, Math.round(value * 100)) : 0
}

/** What a price field shows for minor units. 0 = empty, so the "Free" hint shows. */
export function moneyText(value: number): string {
  if (!value) return ''
  return value % 100 === 0 ? String(value / 100) : (value / 100).toFixed(2)
}

/* --------------------------------------------------------------------------
   Lists
   -------------------------------------------------------------------------- */

export function moveInList<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T

/* --------------------------------------------------------------------------
   Group rules: required, how many, free
   -------------------------------------------------------------------------- */

export type HowMany = 'one' | 'up_to' | 'exactly' | 'at_least' | 'any'

export const HOW_MANY_LABEL: Record<HowMany, string> = {
  one: 'Just one',
  up_to: 'Up to…',
  exactly: 'Exactly…',
  at_least: 'At least…',
  any: 'Any number',
}

export interface Rules {
  min: number
  max: number | null
  freeQty?: number
}

export function howManyOf(rules: Rules): { mode: HowMany; n: number } {
  if (rules.max === 1) return { mode: 'one', n: 1 }
  if (rules.max !== null && rules.min >= 2 && rules.min === rules.max) return { mode: 'exactly', n: rules.max }
  if (rules.max !== null) return { mode: 'up_to', n: rules.max }
  if (rules.min >= 2) return { mode: 'at_least', n: rules.min }
  return { mode: 'any', n: 0 }
}

/** Required is fixed on for "exactly" and "at least" (they ask for 2 or more). */
export function requiredLocked(rules: Rules): boolean {
  const { mode } = howManyOf(rules)
  return mode === 'exactly' || mode === 'at_least'
}

function capFree<R extends Rules>(rules: R): R {
  if (rules.freeQty !== undefined && rules.max !== null && rules.freeQty > rules.max) return { ...rules, freeQty: rules.max }
  return rules
}

/** Switch how many a guest may pick. `n` is the number in the field; it is 2 or more. */
export function withHowMany<R extends Rules>(rules: R, mode: HowMany, n?: number): R {
  const current = howManyOf(rules)
  const req = rules.min > 0 ? 1 : 0
  const fallback = current.n >= 2 ? current.n : rules.min >= 2 ? rules.min : mode === 'up_to' ? 3 : 2
  const count = Math.max(2, Math.floor(n ?? (current.mode === mode ? current.n : fallback)) || 2)
  switch (mode) {
    case 'one':
      return capFree({ ...rules, min: req, max: 1 })
    case 'up_to':
      return capFree({ ...rules, min: req, max: count })
    case 'exactly':
      return capFree({ ...rules, min: count, max: count })
    case 'at_least':
      return capFree({ ...rules, min: count, max: null })
    case 'any':
      return capFree({ ...rules, min: req, max: null })
  }
}

export function withRequired<R extends Rules>(rules: R, on: boolean): R {
  if (requiredLocked(rules)) return rules
  return { ...rules, min: on ? 1 : 0 }
}

/** null or 0 turns "first … free" off. */
export function withFree<R extends Rules>(rules: R, free: number | null): R {
  const next = { ...rules }
  const n = free === null ? 0 : Math.max(0, Math.floor(free))
  if (n > 0) next.freeQty = rules.max !== null ? Math.min(n, rules.max) : n
  else delete next.freeQty
  return next
}

/** A saved group with one dish's own rules laid over it. */
export function rulesOnDish(saved: MenuOptionGroup, ref: Extract<MenuGroupRef, { type: 'shared' }>): MenuOptionGroup {
  const rules = ref.rules ?? {}
  const next = { ...saved }
  if (rules.min !== undefined) next.min = rules.min
  if (rules.max !== undefined) next.max = rules.max
  if (rules.freeQty !== undefined) next.freeQty = rules.freeQty
  return next
}

/** Only what differs from the saved group; undefined when it matches. */
export function rulesDiff(saved: MenuOptionGroup, next: Rules): Partial<Pick<MenuOptionGroup, 'min' | 'max' | 'freeQty'>> | undefined {
  const out: Partial<Pick<MenuOptionGroup, 'min' | 'max' | 'freeQty'>> = {}
  if (next.min !== saved.min) out.min = next.min
  if (next.max !== saved.max) out.max = next.max
  if ((next.freeQty ?? 0) !== (saved.freeQty ?? 0)) out.freeQty = next.freeQty ?? 0
  return Object.keys(out).length ? out : undefined
}

export function withSharedRules(saved: MenuOptionGroup, ref: Extract<MenuGroupRef, { type: 'shared' }>, next: Rules): MenuGroupRef {
  const rules = rulesDiff(saved, next)
  return rules ? { type: 'shared', groupId: ref.groupId, rules } : { type: 'shared', groupId: ref.groupId }
}

/* --------------------------------------------------------------------------
   Options
   -------------------------------------------------------------------------- */

export function blankOption(): MenuOption {
  return { id: newMenuId('o'), label: '', price: 0 }
}

/** A group of this kind with its usual rules and two empty rows; a name when given. */
export function startGroup(kind: GroupKind, name = ''): MenuOptionGroup {
  return { ...blankGroup(kind), name }
}

export const KIND_PLACEHOLDER: Record<GroupKind, string> = {
  choice: 'Choose your bread',
  extras: 'Add toppings',
  remove: 'Leave anything out?',
  course: 'Choose your main',
}

/** Groups where only one option can be picked keep a single default. */
export function withDefault(group: MenuOptionGroup, optionId: string, on: boolean): MenuOptionGroup {
  const single = group.max === 1
  return {
    ...group,
    options: group.options.map((o) => {
      if (o.id === optionId) return on ? { ...o, isDefault: true } : withoutKey(o, 'isDefault')
      return single && on ? withoutKey(o, 'isDefault') : o
    }),
  }
}

function withoutKey<T extends object, K extends keyof T>(value: T, key: K): T {
  const next = { ...value }
  delete next[key]
  return next
}

/** The "up to N each" number when any option allows more than one, else null. */
export function eachMaxOf(group: MenuOptionGroup): number | null {
  const caps = group.options.map((o) => o.maxQty ?? 1)
  const top = Math.max(1, ...caps)
  return top > 1 ? top : null
}

/** Sets how many of each option a guest may take, on every row. null = one of each. */
export function withEachMax(group: MenuOptionGroup, n: number | null): MenuOptionGroup {
  const cap = n === null ? 1 : Math.max(2, Math.floor(n) || 2)
  return { ...group, options: group.options.map((o) => (cap > 1 ? { ...o, maxQty: cap } : withoutKey(o, 'maxQty'))) }
}

export function withOptionMax(option: MenuOption, n: number): MenuOption {
  const cap = Math.max(1, Math.floor(n) || 1)
  return cap > 1 ? { ...option, maxQty: cap } : withoutKey(option, 'maxQty')
}

/** Whether prices change with the dish's size in this group. */
export function sizePricesOn(group: MenuOptionGroup, variants: MenuVariant[] | undefined): boolean {
  if (!variants || variants.length < 2) return false
  return group.options.some((o) => variants.some((v) => o.priceByVariant?.[v.id] !== undefined))
}

/** On: each option gets a price per size, starting from its one price. Off: back to one price. */
export function withSizePrices(group: MenuOptionGroup, variants: MenuVariant[], on: boolean): MenuOptionGroup {
  return {
    ...group,
    options: group.options.map((o) => {
      if (!on) return withoutKey(o, 'priceByVariant')
      return { ...o, priceByVariant: Object.fromEntries(variants.map((v) => [v.id, o.priceByVariant?.[v.id] ?? o.price])) }
    }),
  }
}

/** One size's price for an option. The option's own price follows the first size. */
export function withSizePrice(option: MenuOption, variants: MenuVariant[], variantId: string, price: number): MenuOption {
  const priceByVariant = { ...(option.priceByVariant ?? {}), [variantId]: price }
  const first = variants[0]?.id
  return { ...option, priceByVariant, price: first ? priceByVariant[first] ?? option.price : option.price }
}

/** Adds rows that point at other dishes. Dishes already linked are skipped. Empty rows are dropped first. */
export function withLinkedDishes(group: MenuOptionGroup, itemIds: string[]): MenuOptionGroup {
  const linked = new Set(group.options.map((o) => o.itemId).filter(Boolean))
  const kept = group.options.filter((o) => o.label.trim() || o.itemId)
  const added = [...new Set(itemIds)].filter((id) => !linked.has(id)).map((itemId): MenuOption => ({ id: newMenuId('o'), label: '', price: 0, itemId }))
  return { ...group, options: [...kept, ...added] }
}

export function withLink(option: MenuOption, itemId: string | null): MenuOption {
  return itemId ? { ...option, itemId } : withoutKey(option, 'itemId')
}

/** "Tzatziki, Spicy feta +€0.80, Garlic mayo +€0.80, …" */
export function optionsPreview(menu: Menu, group: MenuOptionGroup, currency: CurrencyCode, limit = 3): string {
  const names = group.options.slice(0, limit).map((o) => {
    const label = optionView(menu, o).label || 'Untitled'
    const price = group.kind === 'remove' ? 0 : optionPrice(o, null)
    return group.kind === 'remove' ? `No ${label.toLowerCase()}` : price > 0 ? `${label} +${money(price, currency)}` : label
  })
  return group.options.length > limit ? `${names.join(', ')}, …` : names.join(', ')
}

/* --------------------------------------------------------------------------
   Group cards on a dish: copy, save to the library, make it the dish's own
   -------------------------------------------------------------------------- */

export function refKey(ref: MenuGroupRef): string {
  return ref.type === 'own' ? ref.group.id : `shared:${ref.groupId}`
}

/** The group as this dish sees it. null when a saved group is missing. */
export function refGroup(menu: Menu, ref: MenuGroupRef): MenuOptionGroup | null {
  if (ref.type === 'own') return ref.group
  const saved = menu.sharedGroups?.find((g) => g.id === ref.groupId)
  return saved ? rulesOnDish(saved, ref) : null
}

function freshCopy(group: MenuOptionGroup, name: string): MenuOptionGroup {
  const copy = clone(group)
  return { ...copy, id: newMenuId('g'), name, options: copy.options.map((o) => ({ ...o, id: newMenuId('o') })) }
}

/** Duplicate: always an own copy, named "… (copy)". */
export function duplicateRef(menu: Menu, ref: MenuGroupRef): MenuGroupRef | null {
  const group = refGroup(menu, ref)
  if (!group) return null
  return { type: 'own', group: freshCopy(group, `${group.name} (copy)`) }
}

/** A saved group becomes this dish's own copy, with the dish's rules baked in. Option ids stay. */
export function ownCopyOf(menu: Menu, ref: MenuGroupRef): MenuGroupRef | null {
  if (ref.type === 'own') return ref
  const group = refGroup(menu, ref)
  if (!group) return null
  return { type: 'own', group: { ...clone(group), id: newMenuId('g') } }
}

/** Moves a dish's own group into the library and points the dish at it. */
export function toLibrary(ref: MenuGroupRef): { ref: MenuGroupRef; group: MenuOptionGroup } | null {
  if (ref.type !== 'own') return null
  const group: MenuOptionGroup = { ...clone(ref.group), id: newMenuId('sg') }
  return { ref: { type: 'shared', groupId: group.id }, group }
}

/** A new library group, ready to fill. */
export function newLibraryGroup(kind: GroupKind = 'extras'): MenuOptionGroup {
  return { ...blankGroup(kind), id: newMenuId('sg') }
}

/** Library "Duplicate". Option ids stay: they only need to be unique in their group. */
export function duplicateLibraryGroup(group: MenuOptionGroup): MenuOptionGroup {
  return { ...clone(group), id: newMenuId('sg'), name: `${group.name} (copy)` }
}

/* --------------------------------------------------------------------------
   The dish draft
   -------------------------------------------------------------------------- */

/** Same shape as the media manager's DraftMedia. */
export interface PhotoDraft {
  id: string
  url: string
  alt: string
  isPrimary: boolean
}

export function blankDish(tenantId: string, categoryId: string): MenuItem {
  return {
    id: newMenuId('mi'),
    tenantId,
    categoryId,
    name: '',
    description: '',
    price: 0,
    tags: [],
    channels: ['dine_in', 'pickup', 'delivery'],
    status: 'available',
    popular: false,
    prepMinutes: 12,
    modifiers: [],
    sold30d: 0,
    revenue30d: 0,
    kind: 'dish',
    groups: [],
  }
}

/** Opens a dish for editing: a deep copy, old-style choices turned into groups, photos as rows. */
export function draftFromItem(item: MenuItem): { item: MenuItem; photos: PhotoDraft[] } {
  const draft = clone(item)
  if (!draft.groups) {
    draft.groups = (draft.modifiers ?? []).map((m): MenuGroupRef => ({ type: 'own', group: groupFromModifier(m) }))
    draft.modifiers = []
  }
  const sources = draft.photos?.length ? draft.photos : draft.imageUrl ? [{ url: draft.imageUrl, alt: draft.name }] : []
  const photos = sources.map((p, index): PhotoDraft => ({ id: `ph_${index}_${draft.id}`, url: p.url, alt: p.alt, isPrimary: index === 0 }))
  return { item: draft, photos }
}

/** Drops option rows left completely empty (no name, no dish, no price), like the two a new group starts with. */
export function withoutBlankRows(group: MenuOptionGroup): MenuOptionGroup {
  const blank = (o: MenuOption) => !o.label.trim() && !o.itemId && !o.price && !Object.values(o.priceByVariant ?? {}).some((p) => p > 0)
  return group.options.some(blank) ? { ...group, options: group.options.filter((o) => !blank(o)) } : group
}

const cleanRefs = (refs: MenuGroupRef[]): MenuGroupRef[] => refs.map((r) => (r.type === 'own' ? { type: 'own', group: withoutBlankRows(r.group) } : r))

/** The dish as it will be saved: empty option rows dropped, the primary photo leads and becomes the cover. */
export function itemFromDraft(item: MenuItem, photos: PhotoDraft[]): MenuItem {
  const ordered = [...photos.filter((p) => p.isPrimary), ...photos.filter((p) => !p.isPrimary)].filter((p) => p.url.trim())
  const next: MenuItem = { ...item }
  if (item.groups) next.groups = cleanRefs(item.groups)
  if (item.meal) next.meal = { ...item.meal, groups: cleanRefs(item.meal.groups) }
  if (ordered.length) {
    next.photos = ordered.map((p) => ({ url: p.url, alt: p.alt }))
    next.imageUrl = ordered[0].url
  } else {
    delete next.photos
    delete next.imageUrl
  }
  return next
}

/** The menu with this dish's unsaved edits and library changes in place, for previews and checks. */
export function previewMenu(menu: Menu, item: MenuItem | null, library: Record<string, MenuOptionGroup>): Menu {
  const saved = menu.sharedGroups ?? []
  const sharedGroups = [...saved.map((g) => library[g.id] ?? g), ...Object.values(library).filter((g) => !saved.some((s) => s.id === g.id))]
  if (!item) return { ...menu, sharedGroups }
  const exists = menu.items.some((i) => i.id === item.id)
  return { ...menu, sharedGroups, items: exists ? menu.items.map((i) => (i.id === item.id ? item : i)) : [...menu.items, item] }
}

/* --------------------------------------------------------------------------
   Sizes
   -------------------------------------------------------------------------- */

const lowest = (variants: MenuVariant[]) => Math.min(...variants.map((v) => v.price))

export function sizesOn(item: MenuItem): MenuItem {
  if (item.variants && item.variants.length >= 2) return item
  const base = item.price
  return {
    ...item,
    variants: [
      { id: newMenuId('v'), label: 'Regular', price: base, isDefault: true },
      { id: newMenuId('v'), label: 'Large', price: base + 100 },
    ],
  }
}

/** One price again: the default size's price (or the first). */
export function sizesOff(item: MenuItem): MenuItem {
  const variants = item.variants ?? []
  const keep = variants.find((v) => v.isDefault) ?? variants[0]
  const next: MenuItem = { ...item, price: keep ? keep.price : item.price }
  delete next.variants
  delete next.variantLabel
  return next
}

export function addSize(item: MenuItem): MenuItem {
  const variants = item.variants ?? []
  const top = variants.length ? Math.max(...variants.map((v) => v.price)) : item.price
  return { ...item, variants: [...variants, { id: newMenuId('v'), label: '', price: top }] }
}

/** Fewer than two sizes left = one price. */
export function removeSize(item: MenuItem, variantId: string): MenuItem {
  const left = (item.variants ?? []).filter((v) => v.id !== variantId)
  if (left.length < 2) {
    const next: MenuItem = { ...item, price: left[0]?.price ?? item.price }
    delete next.variants
    delete next.variantLabel
    return next
  }
  const hasDefault = left.some((v) => v.isDefault)
  const variants = hasDefault ? left : left.map((v, i) => (i === 0 ? { ...v, isDefault: true } : v))
  return { ...item, variants, price: lowest(variants) }
}

export function updateSize(item: MenuItem, variantId: string, patch: Partial<MenuVariant>): MenuItem {
  const variants = (item.variants ?? []).map((v) => {
    if (v.id === variantId) return { ...v, ...patch }
    if (patch.isDefault) return withoutKey(v, 'isDefault')
    return v
  })
  return { ...item, variants, price: variants.length ? lowest(variants) : item.price }
}

/* --------------------------------------------------------------------------
   Meal, set menu, times
   -------------------------------------------------------------------------- */

export function startMeal(): MenuMeal {
  return { label: 'Make it a meal', price: 0, description: 'With a side and a drink', groups: [] }
}

export function setKind(item: MenuItem, kind: 'dish' | 'set'): MenuItem {
  return { ...item, kind }
}

/** "Gyros pita meal · €11" — the lowest a guest pays for the meal. */
export function mealPreview(menu: Menu, item: MenuItem, currency: CurrencyCode): string | null {
  if (!item.meal || item.kind === 'set') return null
  const probe: MenuItem = { ...item, meal: null, groups: [...(item.groups ?? []), ...item.meal.groups] }
  const from = dishFromPrice(menu, probe).price + Math.max(0, item.meal.price)
  return `${item.name.trim() || 'Dish'} meal · ${money(from, currency)}`
}

/** "Section" times, or set times starting from the section's (or lunch 12:00–15:00). */
export function withTimesMode(item: MenuItem, category: MenuCategory | undefined, mode: 'section' | 'set'): MenuItem {
  if (mode === 'section') return { ...item, availability: null }
  if (item.availability?.length) return item
  const from = category?.hours?.[0]
  const start: TimeWindow = from ? { days: [...from.days], from: from.from, to: from.to } : { days: [0, 1, 2, 3, 4, 5, 6], from: '12:00', to: '15:00' }
  return { ...item, availability: [start] }
}

export function toggleDay(window: TimeWindow, day: number): TimeWindow {
  const days = window.days.includes(day) ? window.days.filter((d) => d !== day) : [...window.days, day].sort((a, b) => a - b)
  return { ...window, days }
}

/* --------------------------------------------------------------------------
   Menu page: what a row says, quick sold-out list
   -------------------------------------------------------------------------- */

/** "Sizes · 3 choice groups · meal", "3 courses". null when the dish has none. */
export function choicesLine(menu: Menu, item: MenuItem): string | null {
  const parts: string[] = []
  if ((item.variants?.length ?? 0) >= 2) parts.push(item.variantLabel ? `${item.variants!.length} ${item.variantLabel.toLowerCase()}s` : 'Sizes')
  const groups = resolveGroups(menu, item)
  if (item.kind === 'set') {
    const courses = groups.filter((g) => g.group.kind === 'course').length
    const other = groups.length - courses
    if (courses) parts.push(`${courses} ${courses === 1 ? 'course' : 'courses'}`)
    if (other) parts.push(`${other} ${other === 1 ? 'choice group' : 'choice groups'}`)
  } else if (groups.length) {
    parts.push(`${groups.length} ${groups.length === 1 ? 'choice group' : 'choice groups'}`)
  }
  if (item.kind !== 'set' && item.meal) parts.push('meal')
  return parts.length ? parts.join(' · ') : null
}

/** How many dishes and saved groups offer this dish as a pick (meals, sets, sides). */
export function linkedFrom(menu: Menu, itemId: string): number {
  const links = (refs: MenuGroupRef[] | undefined) => (refs ?? []).some((r) => r.type === 'own' && r.group.options.some((o) => o.itemId === itemId))
  const dishes = menu.items.filter((i) => i.id !== itemId && (links(i.groups) || links(i.meal?.groups))).length
  const library = (menu.sharedGroups ?? []).filter((g) => g.options.some((o) => o.itemId === itemId))
  const viaLibrary = new Set(library.flatMap((g) => sharedGroupUsage(menu, g.id).map((i) => i.id))).size
  return dishes + viaLibrary
}

export interface SoldOutRow {
  optionId: string
  label: string
  soldOut: boolean
  /** The linked dish itself is sold out or gone. */
  dishSoldOut: boolean
}

export interface SoldOutSection {
  key: string
  name: string
  scope: 'size' | 'dish' | 'meal'
  /** For saved groups: the library id and how many dishes use it. */
  shared: { id: string; dishes: number } | null
  groupId: string
  rows: SoldOutRow[]
}

/** Everything on a dish that can run out: sizes, then each group's options (removals left out). */
export function soldOutSections(menu: Menu, item: MenuItem): SoldOutSection[] {
  const out: SoldOutSection[] = []
  if ((item.variants?.length ?? 0) >= 2) {
    out.push({
      key: 'sizes',
      name: item.variantLabel || 'Size',
      scope: 'size',
      shared: null,
      groupId: '',
      rows: item.variants!.map((v) => ({ optionId: v.id, label: v.label, soldOut: Boolean(v.soldOut), dishSoldOut: false })),
    })
  }
  const groups = [...resolveGroups(menu, item), ...resolveMealGroups(menu, item)]
  for (const rg of groups) {
    if (rg.group.kind === 'remove') continue
    const saved = rg.sharedId ? menu.sharedGroups?.find((g) => g.id === rg.sharedId) : null
    out.push({
      key: rg.key,
      name: rg.group.name,
      scope: rg.scope,
      shared: rg.sharedId ? { id: rg.sharedId, dishes: sharedGroupUsage(menu, rg.sharedId).length } : null,
      groupId: rg.group.id,
      rows: (saved ?? rg.group).options.map((o) => {
        const view = optionView(menu, o)
        return { optionId: o.id, label: view.label || 'Untitled', soldOut: Boolean(o.soldOut), dishSoldOut: view.soldOut && !o.soldOut }
      }),
    })
  }
  return out
}

/** Rule line for a card: "Required · pick 1 · First 2 free". */
export function ruleLine(group: MenuOptionGroup, freeNote: string | null): string {
  const rule = groupRule(group).text
  return freeNote ? `${rule} · ${freeNote}` : rule
}
