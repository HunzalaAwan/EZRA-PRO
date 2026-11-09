import {
  ALLERGENS,
  GROUP_KIND_META,
  type Allergen,
  type DishSelection,
  type GroupKind,
  type Menu,
  type MenuGroupRef,
  type MenuItem,
  type MenuMeal,
  type MenuModifier,
  type MenuOption,
  type MenuOptionGroup,
  type MenuVariant,
  type OptionPick,
  type OrderLine,
  type OrderLineGroup,
  type OrderLinePick,
  type SpiceLevel,
  type TimeWindow,
} from './types'

/* ==========================================================================
   Menu pricing — the one place a dish price is added up.

   A guest's picks (a size, choices, extras, removals, a meal, the dishes in
   a set menu) are a DishSelection. Everything that shows or charges a dish
   price reads it through priceSelection: the dish sheet, the cart, checkout,
   phone orders and the seeded orders. Browser-safe: no demo or server code.
   ========================================================================== */

export interface ResolvedGroup {
  /** "dish:<groupId>" | "meal:<groupId>" */
  key: string
  scope: 'dish' | 'meal'
  /** Rules already applied. */
  group: MenuOptionGroup
  /** Library id when the group is a saved one. */
  sharedId: string | null
}

export interface SelectionIssue {
  /** null = size or dish level. For a nested problem, the key of the top-level group that holds the linked dish. */
  groupKey: string | null
  kind: 'variant_needed' | 'need_more' | 'too_many' | 'sold_out' | 'unknown' | 'not_now'
  /** Units still to pick, for need_more. */
  need?: number
  /** Plain message: "Pick 1 more", "Halloumi is sold out". */
  message: string
  /** Set when the problem is inside a linked dish's own choices. */
  nested?: { optionId: string; groupKey: string }
}

export interface PricedSelection {
  unitPrice: number
  base: number
  variant: MenuVariant | null
  /** meal.price + meal groups; 0 when no meal. */
  mealPrice: number
  /** Dish groups, nested picks included. */
  choicesPrice: number
  /** Display-ready: dish groups first, then meal groups (meal: true). */
  choices: OrderLineGroup[]
  /** Flat labels for legacy `modifiers` and one-line cart text. */
  summary: string[]
  issues: SelectionIssue[]
  valid: boolean
}

/* --------------------------------------------------------------------------
   Small helpers
   -------------------------------------------------------------------------- */

const cents = (value: number) => (Number.isFinite(value) ? Math.round(value) : 0)

/** How many units of one option a guest may take. */
function optionCap(option: MenuOption): number {
  const cap = Math.floor(option.maxQty ?? 1)
  return cap >= 1 ? cap : 1
}

function findItem(menu: Menu, itemId: string | undefined): MenuItem | null {
  if (!itemId) return null
  return menu.items.find((item) => item.id === itemId) ?? null
}

function mealOf(item: MenuItem): MenuMeal | null {
  if (item.kind === 'set') return null
  return item.meal ?? null
}

function variantsOf(item: MenuItem): MenuVariant[] {
  return item.variants?.length ? item.variants : []
}

function applyRules(group: MenuOptionGroup, rules: Partial<Pick<MenuOptionGroup, 'min' | 'max' | 'freeQty'>> | undefined): MenuOptionGroup {
  if (!rules) return group
  const next = { ...group }
  if (rules.min !== undefined) next.min = rules.min
  if (rules.max !== undefined) next.max = rules.max
  if (rules.freeQty !== undefined) next.freeQty = rules.freeQty
  return next
}

function resolveRefs(menu: Menu, refs: MenuGroupRef[], scope: 'dish' | 'meal'): ResolvedGroup[] {
  const out: ResolvedGroup[] = []
  const seen = new Set<string>()
  for (const ref of refs) {
    let group: MenuOptionGroup
    let sharedId: string | null = null
    if (ref.type === 'own') {
      group = ref.group
    } else {
      const saved = menu.sharedGroups?.find((g) => g.id === ref.groupId)
      if (!saved) continue
      group = applyRules(saved, ref.rules)
      sharedId = saved.id
    }
    const key = `${scope}:${group.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ key, scope, group, sharedId })
  }
  return out
}

function hm(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/* --------------------------------------------------------------------------
   Groups
   -------------------------------------------------------------------------- */

export function groupFromModifier(modifier: MenuModifier): MenuOptionGroup {
  return {
    id: modifier.id,
    name: modifier.label,
    kind: modifier.multiple ? 'extras' : 'choice',
    min: modifier.required ? 1 : 0,
    max: modifier.multiple ? null : 1,
    options: modifier.options.map((option) => ({ id: option.id, label: option.label, price: option.priceDelta })),
  }
}

/** The dish's own groups, in order, with saved-group rules applied. Legacy modifiers are converted. */
export function resolveGroups(menu: Menu, item: MenuItem): ResolvedGroup[] {
  if (item.groups) return resolveRefs(menu, item.groups, 'dish')
  return (item.modifiers ?? []).map((modifier) => ({ key: `dish:${modifier.id}`, scope: 'dish' as const, group: groupFromModifier(modifier), sharedId: null }))
}

/** The meal's groups; [] when the dish has no meal (set menus never do). */
export function resolveMealGroups(menu: Menu, item: MenuItem): ResolvedGroup[] {
  const meal = mealOf(item)
  return meal ? resolveRefs(menu, meal.groups, 'meal') : []
}

export function optionPrice(option: MenuOption, variantId: string | null): number {
  if (variantId !== null) {
    const sized = option.priceByVariant?.[variantId]
    if (sized !== undefined && Number.isFinite(sized)) return cents(sized)
  }
  return cents(option.price)
}

function unitPriceIn(group: MenuOptionGroup, option: MenuOption, variantId: string | null): number {
  return group.kind === 'remove' ? 0 : Math.max(0, optionPrice(option, variantId))
}

export function optionView(
  menu: Menu,
  option: MenuOption,
): { label: string; imageUrl?: string; soldOut: boolean; allergens: Allergen[]; item: MenuItem | null } {
  const item = findItem(menu, option.itemId)
  const linkedMissing = Boolean(option.itemId) && !item
  return {
    label: option.label.trim() || item?.name || '',
    imageUrl: item?.imageUrl,
    soldOut: Boolean(option.soldOut) || linkedMissing || item?.status === 'sold_out',
    allergens: item ? allergensOf(menu, item) : [],
    item,
  }
}

const isSoldOut = (menu: Menu, option: MenuOption) => optionView(menu, option).soldOut

export function groupRule(group: MenuOptionGroup): { required: boolean; text: string } {
  const min = Math.max(0, group.min)
  const max = group.max
  if (group.kind === 'remove') return { required: false, text: 'Optional' }
  if (min > 0) {
    if (max !== null && max <= min) return { required: true, text: `Required · pick ${min}` }
    if (max === null) return { required: true, text: `Pick at least ${min}` }
    return { required: true, text: `Required · pick ${min} to ${max}` }
  }
  if (max === null) return { required: false, text: 'Pick any' }
  if (max <= 1) return { required: false, text: 'Optional' }
  return { required: false, text: `Pick up to ${max}` }
}

export function groupFreeNote(group: MenuOptionGroup): string | null {
  const free = Math.floor(group.freeQty ?? 0)
  if (free <= 0 || group.kind === 'remove') return null
  const priced = group.options.some((o) => o.price > 0 || Object.values(o.priceByVariant ?? {}).some((p) => p > 0))
  return priced ? `First ${free} free` : null
}

function lowerFirst(label: string): string {
  if (label.length > 1 && label[1] === label[1].toUpperCase() && /[A-Z]/.test(label[1])) return label
  return label.charAt(0).toLowerCase() + label.slice(1)
}

export function pickLabel(group: MenuOptionGroup, label: string, qty: number): string {
  if (group.kind === 'remove') return `No ${lowerFirst(label)}`
  return qty > 1 ? `${qty}× ${label}` : label
}

export function unitsPicked(selection: DishSelection, groupKey: string): number {
  return selection.picks.filter((p) => p.groupKey === groupKey).reduce((sum, p) => sum + Math.max(0, Math.floor(p.qty)), 0)
}

/* --------------------------------------------------------------------------
   Building a selection
   -------------------------------------------------------------------------- */

function newPick(menu: Menu, rg: ResolvedGroup, option: MenuOption, qty: number, nestedAllowed: boolean): OptionPick {
  const pick: OptionPick = { groupKey: rg.key, optionId: option.id, qty }
  if (nestedAllowed && rg.group.askItemChoices) {
    const linked = findItem(menu, option.itemId)
    if (linked) {
      const nested = defaultPicksFor(menu, resolveGroups(menu, linked), false)
      if (nested.length) pick.picks = nested
    }
  }
  return pick
}

function defaultPicksFor(menu: Menu, groups: ResolvedGroup[], nestedAllowed: boolean): OptionPick[] {
  const picks: OptionPick[] = []
  for (const rg of groups) {
    const g = rg.group
    const available = g.options.filter((o) => !isSoldOut(menu, o))
    const defaults = available.filter((o) => o.isDefault)
    if (defaults.length) {
      let units = 0
      for (const option of defaults) {
        if (g.max !== null && units >= g.max) break
        units += 1
        picks.push(newPick(menu, rg, option, 1, nestedAllowed))
      }
    } else if (g.min > 0 && g.options.length === 1 && available.length === 1) {
      const option = available[0]
      const qty = Math.min(Math.max(1, g.min), optionCap(option), g.max ?? Number.POSITIVE_INFINITY)
      picks.push(newPick(menu, rg, option, qty, nestedAllowed))
    }
  }
  return picks
}

/** Default size, default options that aren't sold out, and a required one-option group picked for the guest. Meal off. */
export function defaultSelection(menu: Menu, item: MenuItem): DishSelection {
  const variants = variantsOf(item)
  const variant = variants.find((v) => v.isDefault && !v.soldOut) ?? variants.find((v) => !v.soldOut) ?? null
  return { itemId: item.id, variantId: variant?.id ?? null, picks: defaultPicksFor(menu, resolveGroups(menu, item), true), meal: false }
}

/** Returns the new pick list, or null when nothing changes (refused or unknown). */
function applyPick(
  menu: Menu,
  groups: ResolvedGroup[],
  picks: OptionPick[],
  groupKey: string,
  optionId: string,
  rawQty: number,
  nestedAllowed: boolean,
): OptionPick[] | null {
  const rg = groups.find((g) => g.key === groupKey)
  if (!rg) return null
  const option = rg.group.options.find((o) => o.id === optionId)
  if (!option) return null
  const qty = Math.max(0, Math.floor(Number.isFinite(rawQty) ? rawQty : 0))
  const current = picks.find((p) => p.groupKey === groupKey && p.optionId === optionId)

  if (qty === 0) return current ? picks.filter((p) => p !== current) : null

  const capped = Math.min(qty, optionCap(option))
  if (rg.group.max === 1) {
    const inGroup = picks.filter((p) => p.groupKey === groupKey)
    if (current && current.qty === 1 && inGroup.length === 1) return null
    const replacement = current ? { ...current, qty: 1 } : newPick(menu, rg, option, 1, nestedAllowed)
    const at = picks.findIndex((p) => p.groupKey === groupKey)
    const without = picks.filter((p) => p.groupKey !== groupKey)
    if (at === -1) return [...without, replacement]
    const insertAt = picks.slice(0, at).filter((p) => p.groupKey !== groupKey).length
    return [...without.slice(0, insertAt), replacement, ...without.slice(insertAt)]
  }

  const others = picks.filter((p) => p.groupKey === groupKey && p !== current).reduce((sum, p) => sum + Math.max(0, Math.floor(p.qty)), 0)
  if (rg.group.max !== null && others + capped > rg.group.max) return null
  if (current) return current.qty === capped ? null : picks.map((p) => (p === current ? { ...p, qty: capped } : p))
  return [...picks, newPick(menu, rg, option, capped, nestedAllowed)]
}

function groupsFor(menu: Menu, item: MenuItem, selection: DishSelection): ResolvedGroup[] {
  return selection.meal ? [...resolveGroups(menu, item), ...resolveMealGroups(menu, item)] : resolveGroups(menu, item)
}

/**
 * qty 0 removes. Groups with a most of 1 swap the pick (radio). Clamps to the option's own limit; a pick
 * that would pass the group's most is refused and the selection comes back unchanged. `parent` targets
 * the picks of a linked dish inside an askItemChoices group.
 */
export function setPick(
  menu: Menu,
  selection: DishSelection,
  groupKey: string,
  optionId: string,
  qty: number,
  parent?: { groupKey: string; optionId: string },
): DishSelection {
  const item = findItem(menu, selection.itemId)
  if (!item) return selection
  if (parent) {
    const parentPick = selection.picks.find((p) => p.groupKey === parent.groupKey && p.optionId === parent.optionId)
    if (!parentPick) return selection
    const prg = groupsFor(menu, item, selection).find((g) => g.key === parent.groupKey)
    if (!prg?.group.askItemChoices) return selection
    const linked = findItem(menu, prg.group.options.find((o) => o.id === parent.optionId)?.itemId)
    if (!linked) return selection
    const next = applyPick(menu, resolveGroups(menu, linked), parentPick.picks ?? [], groupKey, optionId, qty, false)
    if (!next) return selection
    return { ...selection, picks: selection.picks.map((p) => (p === parentPick ? { ...p, picks: next } : p)) }
  }
  const next = applyPick(menu, groupsFor(menu, item, selection), selection.picks, groupKey, optionId, qty, true)
  return next ? { ...selection, picks: next } : selection
}

export function setVariant(menu: Menu, selection: DishSelection, variantId: string): DishSelection {
  const item = findItem(menu, selection.itemId)
  if (!item || !variantsOf(item).some((v) => v.id === variantId) || selection.variantId === variantId) return selection
  return { ...selection, variantId }
}

/** Off drops the meal picks; on adds the meal's defaults. */
export function setMeal(menu: Menu, selection: DishSelection, on: boolean): DishSelection {
  const item = findItem(menu, selection.itemId)
  if (!item || !mealOf(item)) return selection.meal ? { ...selection, meal: false, picks: selection.picks.filter((p) => !p.groupKey.startsWith('meal:')) } : selection
  if (!on) {
    if (!selection.meal && !selection.picks.some((p) => p.groupKey.startsWith('meal:'))) return selection
    return { ...selection, meal: false, picks: selection.picks.filter((p) => !p.groupKey.startsWith('meal:')) }
  }
  if (selection.meal) return selection
  const mealGroups = resolveMealGroups(menu, item)
  const kept = selection.picks.filter((p) => !p.groupKey.startsWith('meal:'))
  return { ...selection, meal: true, picks: [...kept, ...defaultPicksFor(menu, mealGroups, true)] }
}

/* --------------------------------------------------------------------------
   Pricing
   -------------------------------------------------------------------------- */

interface ScopeResult {
  total: number
  lines: OrderLineGroup[]
  issues: SelectionIssue[]
  summary: string[]
}

interface Kept {
  option: MenuOption
  label: string
  linked: MenuItem | null
  qty: number
  unit: number
  pick: OptionPick
}

function needMessage(min: number, units: number): string {
  const need = min - units
  if (units === 0) return min === 1 ? 'Pick one' : `Pick ${min}`
  return `Pick ${need} more`
}

function priceScope(
  menu: Menu,
  groups: ResolvedGroup[],
  picks: OptionPick[],
  variantId: string | null,
  ctx: { meal: boolean; nestedAllowed: boolean; parent?: { groupKey: string; optionId: string; name: string } },
): ScopeResult {
  const result: ScopeResult = { total: 0, lines: [], issues: [], summary: [] }
  const issue = (groupKey: string, rest: Omit<SelectionIssue, 'groupKey'>) => {
    if (ctx.parent) {
      result.issues.push({ ...rest, groupKey: ctx.parent.groupKey, nested: { optionId: ctx.parent.optionId, groupKey }, message: `${ctx.parent.name}: ${rest.message}` })
    } else {
      result.issues.push({ ...rest, groupKey })
    }
  }

  const known = new Set(groups.map((g) => g.key))
  if (picks.some((p) => !known.has(p.groupKey))) {
    const first = picks.find((p) => !known.has(p.groupKey))!
    issue(first.groupKey, { kind: 'unknown', message: 'Something you picked is no longer on the menu' })
  }

  for (const rg of groups) {
    const g = rg.group
    const kept: Kept[] = []
    for (const pick of picks) {
      if (pick.groupKey !== rg.key) continue
      const qty = Math.floor(Number.isFinite(pick.qty) ? pick.qty : 0)
      if (qty <= 0) continue
      const option = g.options.find((o) => o.id === pick.optionId)
      if (!option) {
        issue(rg.key, { kind: 'unknown', message: 'Something you picked is no longer on the menu' })
        continue
      }
      const same = kept.find((k) => k.option.id === option.id)
      if (same) {
        same.qty += qty
        continue
      }
      const view = optionView(menu, option)
      kept.push({ option, label: view.label, linked: view.item, qty, unit: unitPriceIn(g, option, variantId), pick })
    }

    /* rules */
    let units = 0
    for (const k of kept) {
      units += k.qty
      if (isSoldOut(menu, k.option)) issue(rg.key, { kind: 'sold_out', message: `${k.label} is sold out` })
      const cap = optionCap(k.option)
      if (k.qty > cap) issue(rg.key, { kind: 'too_many', message: cap === 1 ? `Just one ${k.label}` : `Up to ${cap} ${k.label}` })
    }
    const min = Math.max(0, g.min)
    if (units < min) issue(rg.key, { kind: 'need_more', need: min - units, message: needMessage(min, units) })
    if (g.max !== null && units > g.max) issue(rg.key, { kind: 'too_many', message: g.max === 1 ? 'Pick just one' : `Pick up to ${g.max}` })

    /* free units go to the cheapest units first */
    const charged = kept.map(() => 0)
    const unitList: { k: number; price: number }[] = []
    kept.forEach((k, index) => {
      for (let n = 0; n < k.qty; n++) unitList.push({ k: index, price: k.unit })
    })
    unitList.sort((a, b) => a.price - b.price || a.k - b.k)
    const free = g.kind === 'remove' ? 0 : Math.max(0, Math.floor(g.freeQty ?? 0))
    unitList.forEach((u, index) => {
      if (index >= free) charged[u.k] += u.price
    })

    /* lines */
    const linePicks: OrderLinePick[] = []
    let groupTotal = 0
    kept.forEach((k, index) => {
      let price = charged[index]
      let nestedLines: OrderLineGroup[] | undefined
      let nestedSummary: string[] = []
      if (ctx.nestedAllowed && g.askItemChoices && k.linked) {
        const nestedGroups = resolveGroups(menu, k.linked)
        const nested = priceScope(menu, nestedGroups, k.pick.picks ?? [], null, {
          meal: ctx.meal,
          nestedAllowed: false,
          parent: { groupKey: rg.key, optionId: k.option.id, name: k.label },
        })
        price += nested.total * k.qty
        result.issues.push(...nested.issues)
        if (nested.lines.length) nestedLines = nested.lines
        nestedSummary = nested.summary
      }
      groupTotal += price
      const remove = g.kind === 'remove'
      const label = remove ? pickLabel(g, k.label, 1) : k.label
      const linePick: OrderLinePick = { label, qty: k.qty, price }
      const kitchenLabel = k.option.kitchenLabel ?? k.linked?.kitchenName
      if (kitchenLabel) linePick.kitchenLabel = kitchenLabel
      if (remove) linePick.remove = true
      if (nestedLines) linePick.nested = nestedLines
      linePicks.push(linePick)
      const flat = pickLabel(g, k.label, k.qty)
      result.summary.push(nestedSummary.length ? `${flat} (${nestedSummary.join(', ')})` : flat)
    })
    result.total += groupTotal
    if (linePicks.length) {
      const line: OrderLineGroup = { name: g.name, kind: g.kind, picks: linePicks }
      if (g.kitchenName) line.kitchenName = g.kitchenName
      if (ctx.meal) line.meal = true
      result.lines.push(line)
    }
  }
  return result
}

export function priceSelection(menu: Menu, selection: DishSelection): PricedSelection {
  const item = findItem(menu, selection.itemId)
  if (!item) {
    return {
      unitPrice: 0,
      base: 0,
      variant: null,
      mealPrice: 0,
      choicesPrice: 0,
      choices: [],
      summary: [],
      issues: [{ groupKey: null, kind: 'unknown', message: 'This dish is no longer on the menu' }],
      valid: false,
    }
  }
  const issues: SelectionIssue[] = []
  if (item.status === 'sold_out') issues.push({ groupKey: null, kind: 'sold_out', message: `${item.name} is sold out` })

  const variants = variantsOf(item)
  let variant: MenuVariant | null = null
  if (variants.length) {
    variant = variants.find((v) => v.id === selection.variantId) ?? null
    if (!variant) issues.push({ groupKey: null, kind: 'variant_needed', message: `Choose a ${(item.variantLabel || 'Size').toLowerCase()}` })
    else if (variant.soldOut) issues.push({ groupKey: null, kind: 'sold_out', message: `${variant.label} is sold out` })
  }
  const variantId = variant?.id ?? null
  const base = cents(variant?.price ?? item.price)

  const meal = mealOf(item)
  const mealOn = selection.meal && meal !== null
  const dishGroups = resolveGroups(menu, item)
  const mealGroups = meal ? resolveMealGroups(menu, item) : []
  const mealKeys = new Set(mealGroups.map((g) => g.key))

  const dishPicks = selection.picks.filter((p) => !mealKeys.has(p.groupKey) && !p.groupKey.startsWith('meal:'))
  const mealPicks = mealOn ? selection.picks.filter((p) => p.groupKey.startsWith('meal:')) : []

  const dish = priceScope(menu, dishGroups, dishPicks, variantId, { meal: false, nestedAllowed: true })
  const mealPart = mealOn ? priceScope(menu, mealGroups, mealPicks, variantId, { meal: true, nestedAllowed: true }) : null

  issues.push(...dish.issues)
  if (mealPart) issues.push(...mealPart.issues)

  const choicesPrice = dish.total
  const mealPrice = mealPart && meal ? cents(meal.price) + mealPart.total : 0
  const summary: string[] = []
  if (variant) summary.push(variant.label)
  summary.push(...dish.summary)
  if (mealPart) summary.push(mealPart.summary.length ? `Meal: ${mealPart.summary.join(', ')}` : 'Meal')

  return {
    unitPrice: base + choicesPrice + mealPrice,
    base,
    variant,
    mealPrice,
    choicesPrice,
    choices: [...dish.lines, ...(mealPart?.lines ?? [])],
    summary,
    issues,
    valid: issues.length === 0,
  }
}

/** Stable: the same dish, size, picks and note give the same key whatever order things were picked in. */
export function selectionKey(selection: DishSelection, note: string | null): string {
  const encode = (picks: OptionPick[] | undefined): string =>
    (picks ?? [])
      .filter((p) => p.qty > 0)
      .map((p) => `${p.groupKey}=${p.optionId}x${Math.floor(p.qty)}${p.picks?.length ? `(${encode(p.picks)})` : ''}`)
      .sort()
      .join(',')
  return `${selection.itemId}|${selection.variantId ?? ''}|${selection.meal ? 'meal' : ''}|${encode(selection.picks)}|${(note ?? '').trim()}`
}

export function toOrderLine(menu: Menu, selection: DishSelection, qty: number, note: string | null, id: string): OrderLine {
  const item = findItem(menu, selection.itemId)
  const priced = priceSelection(menu, selection)
  const count = Math.max(1, Math.floor(Number.isFinite(qty) ? qty : 1))
  const line: OrderLine = {
    id,
    itemId: selection.itemId,
    name: item?.name ?? 'Dish',
    qty: count,
    unitPrice: priced.unitPrice,
    modifiers: priced.summary,
    note: note?.trim() || null,
    total: priced.unitPrice * count,
    variant: priced.variant?.label ?? null,
    meal: Boolean(selection.meal && item && mealOf(item)),
    choices: priced.choices,
    selection,
  }
  if (item?.kitchenName) line.kitchenName = item.kitchenName
  return line
}

/* --------------------------------------------------------------------------
   Menu cards
   -------------------------------------------------------------------------- */

function hasPricedOption(group: MenuOptionGroup): boolean {
  if (group.kind === 'remove') return false
  return group.options.some((o) => o.price > 0 || Object.values(o.priceByVariant ?? {}).some((p) => p > 0))
}

/** The cheapest way through one required group. */
function minGroupCost(menu: Menu, group: MenuOptionGroup, variantId: string | null, nestedAllowed: boolean): number {
  const min = Math.max(0, group.min)
  if (min === 0) return 0
  const units: { option: number; extra: number }[] = []
  for (const option of group.options) {
    if (isSoldOut(menu, option)) continue
    let extra = 0
    if (nestedAllowed && group.askItemChoices) {
      const linked = findItem(menu, option.itemId)
      if (linked) extra = resolveGroups(menu, linked).reduce((sum, rg) => sum + minGroupCost(menu, rg.group, null, false), 0)
    }
    const price = unitPriceIn(group, option, variantId)
    for (let n = 0; n < optionCap(option); n++) units.push({ option: price, extra })
  }
  units.sort((a, b) => a.option + a.extra - (b.option + b.extra))
  const chosen = units.slice(0, min)
  const free = group.kind === 'remove' ? 0 : Math.max(0, Math.floor(group.freeQty ?? 0))
  const byOption = [...chosen].sort((a, b) => a.option - b.option)
  return byOption.reduce((sum, u, index) => sum + (index >= free ? u.option : 0) + u.extra, 0)
}

/** Lowest size plus the cheapest way through required groups. `from` when a size or a priced choice can raise it. */
export function dishFromPrice(menu: Menu, item: MenuItem): { price: number; from: boolean } {
  const variants = variantsOf(item)
  const open = variants.filter((v) => !v.soldOut)
  const pool = open.length ? open : variants
  const cheapest = pool.reduce<MenuVariant | null>((low, v) => (low === null || v.price < low.price ? v : low), null)
  const base = cents(cheapest?.price ?? item.price)
  const variantId = cheapest?.id ?? null
  let from = variants.length > 1
  let extra = 0
  for (const rg of resolveGroups(menu, item)) {
    if (hasPricedOption(rg.group)) from = true
    if (rg.group.askItemChoices) {
      for (const option of rg.group.options) {
        const linked = findItem(menu, option.itemId)
        if (linked && resolveGroups(menu, linked).some((n) => hasPricedOption(n.group))) from = true
      }
    }
    extra += minGroupCost(menu, rg.group, variantId, true)
  }
  if (mealOf(item)) from = true
  return { price: base + extra, from }
}

/** Sizes, choices or a meal: open the dish sheet rather than adding straight away. */
export function hasChoices(menu: Menu, item: MenuItem): boolean {
  return variantsOf(item).length > 1 || resolveGroups(menu, item).length > 0 || mealOf(item) !== null
}

/**
 * The dish's own allergens plus those implied by the old dietary tags. Not the options'.
 * "Shellfish" maps to crustaceans and molluscs unless the dish already names one of them.
 */
export function allergensOf(menu: Menu, item: MenuItem): Allergen[] {
  void menu
  const found = new Set<Allergen>(item.allergens ?? [])
  if (item.tags.includes('nuts')) found.add('nuts')
  if (item.tags.includes('shellfish') && !found.has('crustaceans') && !found.has('molluscs')) {
    found.add('crustaceans')
    found.add('molluscs')
  }
  return ALLERGENS.filter((a) => found.has(a))
}

export function spiceOf(item: MenuItem): SpiceLevel {
  if (item.spice !== undefined) return item.spice
  return item.tags.includes('spicy') ? 1 : 0
}

/* --------------------------------------------------------------------------
   When a dish can be ordered
   -------------------------------------------------------------------------- */

/** The dish's own times, else its section's hours, else null (whenever ordering is open). */
export function windowsOf(menu: Menu, item: MenuItem): TimeWindow[] | null {
  if (item.availability?.length) return item.availability
  const category = menu.categories.find((c) => c.id === item.categoryId)
  if (category?.hours?.length) return category.hours
  return null
}

/** Whether every required group (and size) still has something to pick. */
function choicesLeft(menu: Menu, item: MenuItem): boolean {
  const variants = variantsOf(item)
  if (variants.length && variants.every((v) => v.soldOut)) return false
  for (const rg of resolveGroups(menu, item)) {
    const min = Math.max(0, rg.group.min)
    if (min === 0) continue
    const room = rg.group.options.filter((o) => !isSoldOut(menu, o)).reduce((sum, o) => sum + optionCap(o), 0)
    if (room < min) return false
  }
  return true
}

/** weekday 0 = Sunday; time "HH:MM". nextFrom is the next start later today, when there is one. */
export function isAvailableAt(
  menu: Menu,
  item: MenuItem,
  weekday: number,
  time: string,
): { ok: boolean; reason?: 'hidden' | 'sold_out' | 'not_now' | 'choice_sold_out'; nextFrom?: string } {
  if (item.status === 'hidden') return { ok: false, reason: 'hidden' }
  if (item.status === 'sold_out') return { ok: false, reason: 'sold_out' }
  const windows = windowsOf(menu, item)
  if (windows) {
    const at = hm(time)
    const today = windows.filter((w) => w.days.includes(weekday))
    const open = today.some((w) => at >= hm(w.from) && at < hm(w.to))
    if (!open) {
      const later = today
        .map((w) => w.from)
        .filter((from) => hm(from) > at)
        .sort((a, b) => hm(a) - hm(b))[0]
      return later ? { ok: false, reason: 'not_now', nextFrom: later } : { ok: false, reason: 'not_now' }
    }
  }
  if (!choicesLeft(menu, item)) return { ok: false, reason: 'choice_sold_out' }
  return { ok: true }
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]

function daysText(days: number[]): string {
  const list = MONDAY_FIRST.filter((d) => days.includes(d))
  if (list.length === 7) return 'Daily'
  if (!list.length) return ''
  const runs: number[][] = []
  for (const d of list) {
    const run = runs[runs.length - 1]
    const pos = MONDAY_FIRST.indexOf(d)
    if (run && MONDAY_FIRST.indexOf(run[run.length - 1]) === pos - 1) run.push(d)
    else runs.push([d])
  }
  return runs
    .map((run) => (run.length >= 3 ? `${DAY_SHORT[run[0]]}–${DAY_SHORT[run[run.length - 1]]}` : run.map((d) => DAY_SHORT[d]).join(', ')))
    .join(', ')
}

/** "Mon–Fri 12:30–15:00" · "Daily 08:30–11:30" */
export function availabilityText(windows: TimeWindow[]): string {
  return windows
    .map((w) => `${daysText(w.days)} ${w.from}–${w.to}`.trim())
    .join(' · ')
}

/* --------------------------------------------------------------------------
   Owner side
   -------------------------------------------------------------------------- */

let idSeq = 0

export function newMenuId(prefix: 'mi' | 'g' | 'o' | 'v' | 'sg' | 'faq'): string {
  idSeq += 1
  return `${prefix}_${Date.now().toString(36)}${idSeq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** A fresh group with the kind's usual rules and two empty option rows. */
export function blankGroup(kind: GroupKind): MenuOptionGroup {
  const meta = GROUP_KIND_META[kind]
  return {
    id: newMenuId('g'),
    name: '',
    kind,
    min: meta.min,
    max: meta.max,
    options: [
      { id: newMenuId('o'), label: '', price: 0 },
      { id: newMenuId('o'), label: '', price: 0 },
    ],
  }
}

const unique = (list: string[]) => [...new Set(list)]

export function checkGroup(group: MenuOptionGroup, variants?: MenuVariant[]): string[] {
  const problems: string[] = []
  if (!group.name.trim()) problems.push('Give the group a name')
  if (!group.options.length) problems.push('Add at least one option')
  if (group.options.some((o) => !o.label.trim() && !o.itemId)) problems.push('Every option needs a name')
  const min = group.min
  const max = group.max
  if (min < 0) problems.push("Fewest can't be below zero")
  if (max !== null && max < min) problems.push("Most can't be less than fewest")
  const room = group.options.reduce((sum, o) => sum + optionCap(o), 0)
  if (group.options.length && min > room) problems.push('Fewest is more than the options allow')
  const free = group.freeQty ?? 0
  if (free < 0 || (free > 0 && max !== null && free > max)) problems.push("Free picks can't be more than the most")
  if (group.options.length && group.options.every((o) => o.soldOut)) problems.push('Every option is sold out')
  const sizeIds = new Set((variants ?? []).map((v) => v.id))
  const prices = group.options.flatMap((o) => [o.price, ...Object.entries(o.priceByVariant ?? {}).filter(([id]) => sizeIds.has(id)).map(([, p]) => p)])
  if (group.kind !== 'remove' && prices.some((p) => !Number.isFinite(p) || p < 0)) problems.push("Prices can't be below zero")
  return problems
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function checkWindows(windows: TimeWindow[] | null | undefined): string[] {
  const problems: string[] = []
  for (const w of windows ?? []) {
    if (!w.days.length) problems.push('Pick at least one day')
    if (!TIME.test(w.from) || !TIME.test(w.to)) problems.push('Times need hours and minutes')
    else if (hm(w.from) >= hm(w.to)) problems.push('The end time must be after the start')
  }
  return problems
}

function checkRefs(menu: Menu, item: MenuItem, refs: MenuGroupRef[]): string[] {
  const problems: string[] = []
  for (const ref of refs) {
    if (ref.type === 'shared') {
      const saved = menu.sharedGroups?.find((g) => g.id === ref.groupId)
      if (!saved) {
        problems.push('A saved group is missing')
        continue
      }
      for (const p of checkGroup(applyRules(saved, ref.rules), item.variants)) {
        if (["Most can't be less than fewest", 'Fewest is more than the options allow', "Free picks can't be more than the most"].includes(p)) problems.push(`${saved.name}: ${p}`)
      }
      continue
    }
    const g = ref.group
    for (const p of checkGroup(g, item.variants)) problems.push(g.name.trim() ? `${g.name.trim()}: ${p}` : p)
    for (const o of g.options) {
      if (!o.itemId) continue
      if (o.itemId === item.id) problems.push("A dish can't be linked to itself")
      else if (!menu.items.some((i) => i.id === o.itemId)) problems.push('A linked dish is no longer on the menu')
    }
  }
  return problems
}

/** Problems per editor tab. Empty lists everywhere = ready to save. */
export function checkDish(menu: Menu, item: MenuItem): Record<'basics' | 'choices' | 'meal' | 'times' | 'details', string[]> {
  const basics: string[] = []
  if (!item.name.trim()) basics.push('Give the dish a name')
  if (!menu.categories.some((c) => c.id === item.categoryId)) basics.push('Pick a section')
  if (!item.channels.length) basics.push('Pick at least one place it sells')
  const variants = item.variants ?? []
  if (variants.length) {
    if (variants.some((v) => !v.label.trim())) basics.push('Every size needs a name')
    if (variants.some((v) => !Number.isFinite(v.price) || v.price < 0)) basics.push("Prices can't be below zero")
    if (variants.length > 1 && variants.every((v) => v.soldOut)) basics.push('Every size is sold out')
  } else if (!Number.isFinite(item.price) || item.price < 0) {
    basics.push("The price can't be below zero")
  }
  if (item.kind === 'set' && item.price <= 0 && !variants.length) basics.push('Give the set menu a price')

  const choices = checkRefs(menu, item, item.groups ?? [])
  if (item.kind === 'set' && !resolveGroups(menu, item).some((rg) => rg.group.kind === 'course')) choices.push('Add at least one course')

  const meal: string[] = []
  if (item.meal && item.kind !== 'set') {
    if (!item.meal.label.trim()) meal.push('Give the meal button a name')
    if (!Number.isFinite(item.meal.price) || item.meal.price < 0) meal.push("The meal price can't be below zero")
    if (!item.meal.groups.length) meal.push('Add what comes with the meal')
    meal.push(...checkRefs(menu, item, item.meal.groups))
  }

  const times = checkWindows(item.availability)
  if (!Number.isFinite(item.prepMinutes) || item.prepMinutes < 0) times.push("Kitchen time can't be below zero")

  const details: string[] = []
  if (item.calories !== undefined && (!Number.isFinite(item.calories) || item.calories < 0)) details.push("Calories can't be below zero")
  if (item.serves !== undefined && (!Number.isFinite(item.serves) || item.serves < 1)) details.push('Serves needs to be at least 1')
  for (const f of item.faq ?? []) {
    if (f.question.trim() && !f.answer.trim()) details.push('Every question needs an answer')
    if (!f.question.trim() && f.answer.trim()) details.push('Every answer needs a question')
  }

  return { basics: unique(basics), choices: unique(choices), meal: unique(meal), times: unique(times), details: unique(details) }
}

const usesShared = (refs: MenuGroupRef[] | undefined, groupId: string) => (refs ?? []).some((r) => r.type === 'shared' && r.groupId === groupId)

/** Dishes that use a saved group, in the dish or its meal. */
export function sharedGroupUsage(menu: Menu, groupId: string): MenuItem[] {
  return menu.items.filter((item) => usesShared(item.groups, groupId) || usesShared(item.meal?.groups, groupId))
}

/** Copies a saved group into each dish that uses it (fresh id, rules baked in) and removes it from the library. */
export function detachSharedGroup(menu: Menu, groupId: string): Menu {
  const saved = menu.sharedGroups?.find((g) => g.id === groupId)
  if (!saved) return menu
  const detach = (refs: MenuGroupRef[]): MenuGroupRef[] =>
    refs.map((ref) => {
      if (ref.type !== 'shared' || ref.groupId !== groupId) return ref
      const group = applyRules(saved, ref.rules)
      return { type: 'own', group: { ...group, id: newMenuId('g'), options: group.options.map((o) => ({ ...o })) } }
    })
  return {
    ...menu,
    sharedGroups: (menu.sharedGroups ?? []).filter((g) => g.id !== groupId),
    items: menu.items.map((item) => {
      if (!usesShared(item.groups, groupId) && !usesShared(item.meal?.groups, groupId)) return item
      const next: MenuItem = { ...item }
      if (item.groups) next.groups = detach(item.groups)
      if (item.meal) next.meal = { ...item.meal, groups: detach(item.meal.groups) }
      return next
    }),
  }
}

const whole = (value: number, low = 0) => Math.max(low, cents(value))

/** Trims, keeps prices whole and non-negative, gives every option a limit of at least 1 and makes removals free. */
export function normaliseGroup(group: MenuOptionGroup): MenuOptionGroup {
  const remove = group.kind === 'remove'
  const min = remove ? 0 : whole(group.min)
  const max = remove ? null : group.max === null ? null : Math.max(whole(group.max), 0)
  const next: MenuOptionGroup = {
    ...group,
    name: group.name.trim(),
    min,
    max,
    options: group.options.map((option) => {
      const o: MenuOption = { ...option, label: option.label.trim(), price: remove ? 0 : whole(option.price), maxQty: remove ? 1 : optionCap(option) }
      if (remove || !option.priceByVariant || !Object.keys(option.priceByVariant).length) delete o.priceByVariant
      else o.priceByVariant = Object.fromEntries(Object.entries(option.priceByVariant).map(([id, p]) => [id, whole(p)]))
      if (o.maxQty === 1) delete o.maxQty
      if (o.kitchenLabel !== undefined && !o.kitchenLabel.trim()) delete o.kitchenLabel
      return o
    }),
  }
  const free = remove ? 0 : whole(group.freeQty ?? 0)
  if (free > 0) next.freeQty = free
  else delete next.freeQty
  if (next.note !== undefined && !next.note.trim()) delete next.note
  if (next.kitchenName !== undefined && !next.kitchenName.trim()) delete next.kitchenName
  if (group.kind !== 'course') delete next.askItemChoices
  return next
}

const normaliseRefs = (refs: MenuGroupRef[]): MenuGroupRef[] => refs.map((ref) => (ref.type === 'own' ? { type: 'own', group: normaliseGroup(ref.group) } : ref))

/** price = lowest size; imageUrl = first photo; fewer than 2 sizes = no sizes; trims; whole prices; removals free. */
export function normaliseItem(item: MenuItem): MenuItem {
  const next: MenuItem = { ...item, name: item.name.trim(), description: item.description.trim(), price: whole(item.price), prepMinutes: whole(item.prepMinutes) }

  const variants = (item.variants ?? []).map((v) => ({ ...v, label: v.label.trim(), price: whole(v.price) }))
  if (variants.length >= 2) {
    let seenDefault = false
    next.variants = variants.map((v) => {
      if (v.isDefault && !seenDefault) {
        seenDefault = true
        return v
      }
      const { isDefault: _drop, ...rest } = v
      void _drop
      return rest
    })
    next.price = Math.min(...variants.map((v) => v.price))
  } else {
    if (variants.length === 1) next.price = variants[0].price
    delete next.variants
    delete next.variantLabel
  }
  if (next.variantLabel !== undefined && !next.variantLabel.trim()) delete next.variantLabel

  if (item.photos) {
    const photos = item.photos.filter((p) => p.url.trim()).map((p) => ({ url: p.url.trim(), alt: p.alt.trim() }))
    next.photos = photos
    next.imageUrl = photos[0]?.url
    if (!photos.length) {
      delete next.photos
      delete next.imageUrl
    }
  }

  if (item.groups) {
    next.groups = normaliseRefs(item.groups)
    next.modifiers = []
  }
  if (item.meal) {
    next.meal = { ...item.meal, label: item.meal.label.trim() || 'Make it a meal', price: whole(item.meal.price), groups: normaliseRefs(item.meal.groups) }
    if (next.meal.description !== undefined && !next.meal.description.trim()) delete next.meal.description
  }
  if (item.kind === 'set') next.meal = null
  if (item.availability && !item.availability.length) next.availability = null
  if (item.faq) next.faq = item.faq.map((f) => ({ ...f, question: f.question.trim(), answer: f.answer.trim() })).filter((f) => f.question || f.answer)
  if (item.allergens) next.allergens = ALLERGENS.filter((a) => item.allergens!.includes(a))
  for (const key of ['kitchenName', 'kitchenNote', 'station'] as const) {
    const value = next[key]
    if (value !== undefined) {
      const trimmed = value.trim()
      if (trimmed) next[key] = trimmed
      else delete next[key]
    }
  }
  if (next.calories !== undefined) next.calories = whole(next.calories)
  if (next.serves !== undefined) next.serves = whole(next.serves, 1)
  return next
}
