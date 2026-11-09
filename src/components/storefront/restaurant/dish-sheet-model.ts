import {
  availabilityText,
  dishFromPrice,
  groupFreeNote,
  groupRule,
  hasChoices,
  isAvailableAt,
  optionPrice,
  optionView,
  pickLabel,
  resolveGroups,
  resolveMealGroups,
  spiceOf,
  allergensOf,
  windowsOf,
  type PricedSelection,
  type ResolvedGroup,
  type SelectionIssue,
} from '@/lib/hospitality/menu-pricing'
import { DIETARY_META, type DishSelection, type Menu, type MenuItem, type MenuOption, type MenuOptionGroup, type OptionPick, type OrderLineGroup, type OrderLinePick, type SpiceLevel } from '@/lib/hospitality/types'
import { formatCurrency } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   What the dish sheet shows, worked out without React so it can be tested:
   each group's rows, which are picked, dimmed, free or sold out, the rule
   chip, the problem to point at, and when the dish can be ordered.

   Prices come from priceSelection only; this file never adds them up.
   ========================================================================== */

/** Money with cents only when there are cents: "€18", "€6.50". */
export function money(amount: number, currency: CurrencyCode): string {
  return formatCurrency(amount, currency, { decimals: Math.round(amount) % 100 !== 0 })
}

export function plusMoney(amount: number, currency: CurrencyCode): string {
  return `+${money(amount, currency)}`
}

/* --------------------------------------------------------------------------
   Groups and rows
   -------------------------------------------------------------------------- */

export interface OptionRowView {
  option: MenuOption
  /** Worded for guests: "No onion" in a leave-out group, the dish name for a linked dish. */
  label: string
  imageUrl?: string
  linked: boolean
  soldOut: boolean
  picked: boolean
  qty: number
  /** Most of this one a guest may take. */
  cap: number
  /** Price of one, at the chosen size. 0 in a leave-out group. */
  unit: number
  /** "+€1.00", or '' when it costs nothing. */
  priceText: string
  /** The price is struck through and "Free" shows. */
  free: boolean
  /** Some picked units are free, some are not: "1 free". */
  freeCount: number
  /** Can't be picked right now: sold out, or the group is full. */
  disabled: boolean
  canMore: boolean
  /** A linked dish's own choices, when the group asks for them and the dish is picked. */
  nested: GroupView[]
}

export interface GroupView {
  /** ResolvedGroup key ("dish:meat", "meal:sg_sl_side"); a nested group uses the linked dish's key. */
  key: string
  scope: 'dish' | 'meal'
  group: MenuOptionGroup
  /** Set for a linked dish's own group. */
  parent?: { groupKey: string; optionId: string }
  /** Where the sheet scrolls to for this group. */
  anchor: string
  /** One pick at a time: radio rows. */
  radio: boolean
  rule: { required: boolean; text: string }
  /** "First 1 free, then the price shown" and the owner's note. */
  hint: string | null
  units: number
  /** Required and picked enough. */
  done: boolean
  full: boolean
  /** "Up to 5 · remove one to change" when the group is full. */
  fullText: string | null
  issue: SelectionIssue | null
  rows: OptionRowView[]
}

export function anchorFor(groupKey: string, parent?: { groupKey: string; optionId: string }): string {
  return parent ? `${parent.groupKey}>${parent.optionId}>${groupKey}` : groupKey
}

function matchLineGroup(lines: OrderLineGroup[] | undefined, group: MenuOptionGroup, meal: boolean): OrderLineGroup | undefined {
  return lines?.find((l) => l.name === group.name && l.kind === group.kind && Boolean(l.meal) === meal)
}

const nestedTotal = (pick: OrderLinePick) => (pick.nested ?? []).reduce((sum, g) => sum + g.picks.reduce((s, p) => s + p.price, 0), 0)

function stripPrefix(message: string, prefix: string): string {
  return message.startsWith(`${prefix}: `) ? message.slice(prefix.length + 2) : message
}

function buildGroup(
  menu: Menu,
  rg: ResolvedGroup,
  picks: OptionPick[],
  variantId: string | null,
  lineGroup: OrderLineGroup | undefined,
  issues: SelectionIssue[],
  currency: CurrencyCode,
  meal: boolean,
  parent?: { groupKey: string; optionId: string; label: string },
): GroupView {
  const g = rg.group
  const remove = g.kind === 'remove'
  const radio = g.max === 1
  const mine = picks.filter((p) => p.groupKey === rg.key)
  const units = mine.reduce((sum, p) => sum + Math.max(0, Math.floor(p.qty)), 0)
  const full = g.max !== null && units >= g.max
  const freeQty = remove ? 0 : Math.max(0, Math.floor(g.freeQty ?? 0))
  const freeLeft = Math.max(0, freeQty - units)
  const rule = groupRule(g)
  const parentRef = parent ? { groupKey: parent.groupKey, optionId: parent.optionId } : undefined
  const issue =
    issues.find((i) => (parent ? i.groupKey === parent.groupKey && i.nested?.optionId === parent.optionId && i.nested.groupKey === rg.key : i.groupKey === rg.key && !i.nested)) ?? null

  const rows = g.options.map((option): OptionRowView => {
    const view = optionView(menu, option)
    const pick = mine.find((p) => p.optionId === option.id)
    const qty = pick ? Math.max(0, Math.floor(pick.qty)) : 0
    const picked = qty > 0
    const cap = Math.max(1, Math.floor(option.maxQty ?? 1))
    const unit = remove ? 0 : Math.max(0, optionPrice(option, variantId))
    const label = remove ? pickLabel(g, view.label, 1) : view.label
    const linePick = picked ? lineGroup?.picks.find((p) => p.label === label) : undefined
    const charged = linePick ? linePick.price - nestedTotal(linePick) : null
    let free = false
    let freeCount = 0
    if (unit > 0 && freeQty > 0) {
      if (picked && charged !== null) {
        freeCount = Math.max(0, Math.round((unit * qty - charged) / unit))
        free = freeCount >= qty
        if (free) freeCount = 0
      } else if (!picked) {
        free = freeLeft > 0
      }
    }
    const priceText = unit <= 0 ? '' : plusMoney(freeCount > 0 && charged !== null ? charged : unit, currency)
    let nested: GroupView[] = []
    if (picked && g.askItemChoices && view.item && !parent) {
      const nestedPicks = pick?.picks ?? []
      nested = resolveGroups(menu, view.item).map((nrg) =>
        buildGroup(menu, nrg, nestedPicks, null, matchLineGroup(linePick?.nested, nrg.group, meal), issues, currency, meal, { groupKey: rg.key, optionId: option.id, label: view.label }),
      )
    }
    return {
      option,
      label,
      imageUrl: view.imageUrl,
      linked: Boolean(option.itemId),
      soldOut: view.soldOut,
      picked,
      qty,
      cap,
      unit,
      priceText,
      free,
      freeCount,
      disabled: view.soldOut ? !picked : !picked && full && !radio,
      canMore: picked && !view.soldOut && qty < cap && (g.max === null || units < g.max),
      nested,
    }
  })

  const freeNote = groupFreeNote(g)
  const hint = [freeNote ? `${freeNote}, then the price shown` : null, g.note?.trim() || null].filter(Boolean).join(' · ') || null
  return {
    key: rg.key,
    scope: rg.scope,
    group: g,
    parent: parentRef,
    anchor: anchorFor(rg.key, parentRef),
    radio,
    rule,
    hint,
    units,
    done: rule.required && units >= Math.max(0, g.min) && !issue,
    full,
    fullText: full && !radio ? `Up to ${g.max} · remove one to change` : null,
    issue: issue && parent ? { ...issue, message: stripPrefix(issue.message, parent.label) } : issue,
    rows,
  }
}

/** Every group the sheet shows, in order: the dish's, then the meal's when it is on. Prices in `currency`. */
export function sheetGroups(menu: Menu, item: MenuItem, selection: DishSelection, priced: PricedSelection, currency: CurrencyCode): GroupView[] {
  const groups = selection.meal ? [...resolveGroups(menu, item), ...resolveMealGroups(menu, item)] : resolveGroups(menu, item)
  return groups.map((rg) => {
    const meal = rg.scope === 'meal'
    return buildGroup(menu, rg, selection.picks, selection.variantId, matchLineGroup(priced.choices, rg.group, meal), priced.issues, currency, meal)
  })
}

/** Where to take the guest for the first problem: a group's anchor, 'sizes' or 'top'. */
export function firstIssueAnchor(item: MenuItem, priced: PricedSelection, groups: GroupView[]): string | null {
  const issue = priced.issues[0]
  if (!issue) return null
  if (issue.groupKey === null) return item.variants?.length ? 'sizes' : 'top'
  const anchor = issue.nested ? anchorFor(issue.nested.groupKey, { groupKey: issue.groupKey, optionId: issue.nested.optionId }) : issue.groupKey
  const known = (list: GroupView[]): boolean => list.some((g) => g.anchor === anchor || g.rows.some((r) => known(r.nested)))
  return known(groups) ? anchor : 'top'
}

/**
 * Drops picks the menu no longer has (a group or option removed since the line was added),
 * puts back a size that is gone, and turns the meal off when the dish no longer offers one.
 * Used when a cart line is opened for editing.
 */
export function cleanSelection(menu: Menu, selection: DishSelection): DishSelection {
  const item = menu.items.find((i) => i.id === selection.itemId)
  if (!item) return selection
  const meal = item.kind !== 'set' && Boolean(item.meal) && selection.meal
  const groups = meal ? [...resolveGroups(menu, item), ...resolveMealGroups(menu, item)] : resolveGroups(menu, item)
  const keep = (picks: OptionPick[], list: ResolvedGroup[], nestedAllowed: boolean): OptionPick[] =>
    picks
      .filter((p) => p.qty > 0)
      .flatMap((p) => {
        const rg = list.find((g) => g.key === p.groupKey)
        const option = rg?.group.options.find((o) => o.id === p.optionId)
        if (!rg || !option) return []
        const next: OptionPick = { groupKey: p.groupKey, optionId: p.optionId, qty: p.qty }
        if (nestedAllowed && rg.group.askItemChoices && p.picks?.length) {
          const linked = menu.items.find((i) => i.id === option.itemId)
          if (linked) {
            const inner = keep(p.picks, resolveGroups(menu, linked), false)
            if (inner.length) next.picks = inner
          }
        }
        return [next]
      })
  const variants = item.variants ?? []
  const variantId = variants.length
    ? variants.some((v) => v.id === selection.variantId)
      ? selection.variantId
      : (variants.find((v) => v.isDefault && !v.soldOut) ?? variants.find((v) => !v.soldOut) ?? null)?.id ?? null
    : null
  return { itemId: item.id, variantId, picks: keep(selection.picks, groups, true), meal }
}

/* --------------------------------------------------------------------------
   When it can be ordered
   -------------------------------------------------------------------------- */

export interface AvailabilityNote {
  ok: boolean
  /** Muted line on the sheet: "Lunch specials only · Mon–Fri 12:30–15:00". */
  line: string | null
  /** Start time later today, for "Order for 12:30". */
  orderFor: string | null
  /** Short badge for a menu card: "From 12:30", "Breakfast only". */
  badge: string | null
}

/** The time a cart's "when" stands for: now for 'asap', else the chosen "HH:MM". */
export function orderTime(when: string, nowTime: string): string {
  return when === 'asap' || !/^\d{2}:\d{2}$/.test(when) ? nowTime : when
}

export function availabilityNote(menu: Menu, item: MenuItem, weekday: number, time: string): AvailabilityNote {
  const at = isAvailableAt(menu, item, weekday, time)
  if (at.ok) return { ok: true, line: null, orderFor: null, badge: null }
  if (at.reason === 'not_now') {
    const windows = windowsOf(menu, item) ?? []
    const category = menu.categories.find((c) => c.id === item.categoryId)
    const own = Boolean(item.availability?.length)
    const text = availabilityText(windows)
    return {
      ok: false,
      line: own || !category ? `Served ${text}` : `${category.name} only · ${text}`,
      orderFor: at.nextFrom ?? null,
      badge: at.nextFrom ? `From ${at.nextFrom}` : own || !category ? 'Not today' : `${category.name} only`,
    }
  }
  if (at.reason === 'sold_out') return { ok: false, line: 'Sold out today', orderFor: null, badge: 'Sold out today' }
  if (at.reason === 'choice_sold_out') return { ok: false, line: 'Sold out for now', orderFor: null, badge: 'Sold out' }
  return { ok: false, line: null, orderFor: null, badge: null }
}

/* --------------------------------------------------------------------------
   Menu cards and the sheet's top
   -------------------------------------------------------------------------- */

export interface CardInfo {
  price: number
  from: boolean
  /** Sizes, choices or a meal: the + opens the sheet. */
  choices: boolean
  /** Tapping the card opens the sheet (choices, or facts to read). */
  opens: boolean
  /** No more than two short pills. */
  pills: string[]
}

export function cardInfo(menu: Menu, item: MenuItem): CardInfo {
  const { price, from } = dishFromPrice(menu, item)
  const choices = hasChoices(menu, item)
  const hints = [item.kind === 'set' ? 'Set menu' : null, (item.variants?.length ?? 0) > 1 ? 'Sizes' : null, item.kind !== 'set' && item.meal ? 'Meal deal' : null].filter((x): x is string => Boolean(x))
  const pills = [...hints, ...item.tags.map((t) => DIETARY_META[t].label)].slice(0, 2)
  const opens = choices || Boolean(item.faq?.length) || allergensOf(menu, item).length > 0
  return { price, from, choices, opens, pills }
}

const SPICE_TEXT: Record<SpiceLevel, string | null> = { 0: null, 1: 'Mild', 2: 'Medium spicy', 3: 'Hot' }

/** Pills at the top of the sheet: diet, spice, serves, calories. */
export function factPills(item: MenuItem): string[] {
  const spice = SPICE_TEXT[spiceOf(item)]
  return [
    ...item.tags.filter((t) => t !== 'spicy' || !spice).map((t) => DIETARY_META[t].label),
    spice,
    item.serves && item.serves > 1 ? `Serves ${item.serves}` : null,
    item.calories ? `${item.calories} kcal` : null,
  ].filter((x): x is string => Boolean(x))
}

export function submitText(mode: 'add' | 'update', qty: number, total: number, currency: CurrencyCode): string {
  return mode === 'update' ? `Update · ${money(total, currency)}` : `Add ${qty} · ${money(total, currency)}`
}

export function stepLabel(direction: 'more' | 'fewer', label: string): string {
  return `${direction === 'more' ? 'One more' : 'One fewer'} ${label}`
}

export const QTY_MIN = 1
export const QTY_MAX = 20
export const NOTE_MAX = 140
