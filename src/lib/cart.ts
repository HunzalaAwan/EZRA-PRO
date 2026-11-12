import { availabilityText, isAvailableAt, priceSelection, selectionKey, toOrderLine, windowsOf, type PricedSelection } from '@/lib/hospitality/menu-pricing'
import type { DishSelection, Menu, OrderChannel, OrderLine, OrderLineGroup, OrderLinePick, OrderingHours } from '@/lib/hospitality/types'

/* ==========================================================================
   The order cart — what a guest has picked from the menu, kept in the
   browser per storefront so a refresh or a second tab keeps it.

   A line made from the dish sheet carries the guest's picks (size,
   choices, meal) as a DishSelection, so the cart and checkout can price
   it again against the live menu. Older lines only have flat labels.
   ========================================================================== */

/** Pickup, delivery, or (hotels) sent up to the room. */
export type CartMode = 'pickup' | 'delivery' | 'room'

/** The menu channel a cart mode sells from. */
export function channelFor(mode: CartMode): OrderChannel {
  return mode === 'room' ? 'dine_in' : mode
}

export interface CartLine {
  /** The dish plus its picks and note, so the same dish with different choices is two lines. */
  key: string
  itemId: string
  name: string
  unitPrice: number
  qty: number
  /** Flat labels, for lines saved before choice groups and one-line views. */
  modifiers: string[]
  note: string | null
  /** What the guest picked: size, choices, meal. */
  selection?: DishSelection
  /** The picks, grouped and worded. */
  choices?: OrderLineGroup[]
  /** Size label, "Large". */
  variant?: string | null
}

export type CartLineInput = Omit<CartLine, 'key' | 'qty'>

export interface Cart {
  version: 1
  mode: CartMode
  lines: CartLine[]
  zoneId: string | null
  /** 'asap' or "HH:MM" today. */
  when: string
  tipPercent: number
}

export const CART_EVENT = 'ezra:cart'

export function cartKey(slug: string) {
  return `ezra:cart:${slug}`
}

export function emptyCart(mode: CartMode = 'pickup'): Cart {
  return { version: 1, mode, lines: [], zoneId: null, when: 'asap', tipPercent: 0 }
}

export function readCartRaw(slug: string): string {
  try {
    return window.localStorage.getItem(cartKey(slug)) ?? ''
  } catch {
    return ''
  }
}

export function parseCart(raw: string): Cart {
  if (!raw) return emptyCart()
  try {
    const parsed = JSON.parse(raw) as Partial<Cart>
    return { ...emptyCart(), ...parsed, version: 1, lines: Array.isArray(parsed.lines) ? parsed.lines : [] }
  } catch {
    return emptyCart()
  }
}

export function writeCart(slug: string, cart: Cart | null) {
  try {
    if (cart) window.localStorage.setItem(cartKey(slug), JSON.stringify(cart))
    else window.localStorage.removeItem(cartKey(slug))
  } catch {
    /* blocked storage: the cart simply lives for the page */
  }
  window.dispatchEvent(new Event(CART_EVENT))
}

export const SERVICE_FEE_RATE = 0.03

export interface CartTotals {
  count: number
  subtotal: number
  deliveryFee: number
  serviceFee: number
  tax: number
  tip: number
  total: number
  /** Minimum order for the chosen zone, when delivery. */
  minOrder: number
  belowMinimum: boolean
}

export function cartTotals(cart: Cart, ordering: OrderingHours, taxRate: number): CartTotals {
  const zones = ordering.delivery.zones
  const subtotal = cart.lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0)
  const zone = cart.mode === 'delivery' ? zones.find((z) => z.id === cart.zoneId) ?? zones[0] : null
  const deliveryFee = zone ? zone.fee : 0
  const serviceFee = cart.mode === 'room' ? ordering.roomService.trayCharge : Math.round(subtotal * SERVICE_FEE_RATE)
  const tax = Math.round(subtotal * taxRate)
  const tip = Math.round(subtotal * (cart.tipPercent / 100))
  const minOrder = zone?.minOrder ?? 0
  return {
    count: cart.lines.reduce((sum, line) => sum + line.qty, 0),
    subtotal,
    deliveryFee,
    serviceFee,
    tax,
    tip,
    total: subtotal + deliveryFee + serviceFee + tax + tip,
    minOrder,
    belowMinimum: cart.mode === 'delivery' && subtotal > 0 && subtotal < minOrder,
  }
}

/** Key for a line without picks (saved before choice groups). */
export function lineKey(itemId: string, modifiers: string[], note: string | null) {
  return `${itemId}::${[...modifiers].sort().join('|')}::${note ?? ''}`
}

/** Same dish, same picks, same note = same key, whatever order things were picked in. */
export function cartLineKey(line: Pick<CartLine, 'itemId' | 'modifiers' | 'note' | 'selection'>): string {
  return line.selection ? selectionKey(line.selection, line.note) : lineKey(line.itemId, line.modifiers, line.note)
}

/** A cart line from the dish sheet: priced by the menu, with its picks kept. */
export function cartLineFrom(menu: Menu, selection: DishSelection, note: string | null, priced: PricedSelection = priceSelection(menu, selection)): CartLineInput {
  const item = menu.items.find((i) => i.id === selection.itemId)
  return {
    itemId: selection.itemId,
    name: item?.name ?? 'Dish',
    unitPrice: priced.unitPrice,
    modifiers: priced.summary,
    note: note?.trim() || null,
    selection,
    choices: priced.choices,
    variant: priced.variant?.label ?? null,
  }
}

/** Adds a line, or more of the same line when its key is already there. */
export function addLine(lines: CartLine[], line: CartLineInput, qty: number): CartLine[] {
  const key = cartLineKey(line)
  const existing = lines.find((l) => l.key === key)
  return existing ? lines.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l)) : [...lines, { ...line, key, qty }]
}

/** Swaps an edited line in place. When the edit makes it the same as another line, the two merge. */
export function replaceLine(lines: CartLine[], key: string, line: CartLineInput, qty: number): CartLine[] {
  const nextKey = cartLineKey(line)
  const at = lines.findIndex((l) => l.key === key)
  if (at === -1) return addLine(lines, line, qty)
  const twin = lines.find((l) => l.key === nextKey && l.key !== key)
  if (twin) return lines.filter((l) => l.key !== key).map((l) => (l.key === nextKey ? { ...l, qty: l.qty + qty } : l))
  return lines.map((l, index) => (index === at ? { ...line, key: nextKey, qty } : l))
}

/**
 * What the dish sheet made, into the lines. Each different dish is its own line and the same ones
 * add up (one croissant with American cheese, two with Cheddar = two lines). `editKey` is the line
 * that was opened: the first dish takes its place, the rest are added after.
 */
export function putLines(
  menu: Menu,
  lines: CartLine[],
  made: { selection: DishSelection; qty: number; note: string | null; priced?: PricedSelection }[],
  editKey?: string,
): CartLine[] {
  let next = lines
  made.forEach((m, index) => {
    const line = cartLineFrom(menu, m.selection, m.note, m.priced)
    next = index === 0 && editKey ? replaceLine(next, editKey, line, m.qty) : addLine(next, line, m.qty)
  })
  return next
}

/* --------------------------------------------------------------------------
   Showing a line's picks
   -------------------------------------------------------------------------- */

function pickText(pick: OrderLinePick): string {
  const base = pick.qty > 1 && !pick.remove ? `${pick.qty}× ${pick.label}` : pick.label
  const nested = (pick.nested ?? []).flatMap((g) => g.picks.map(pickText))
  return nested.length ? `${base} (${nested.join(', ')})` : base
}

/**
 * Short muted lines under a cart line: the dish's picks on one line, each course on its own,
 * the things left out, then the meal. "Chicken · 2× Extra feta · Garlic mayo" / "No onion" /
 * "Meal: Lemon potatoes, Fresh orange juice". Lines without grouped picks show their labels.
 */
export function choiceLines(line: Pick<CartLine, 'choices' | 'modifiers'>, max = 3): { lines: string[]; more: number } {
  let all: string[]
  if (line.choices?.length) {
    const segments: { key: string; parts: string[] }[] = []
    line.choices.forEach((group, index) => {
      const key = group.meal ? 'meal' : group.kind === 'remove' ? 'remove' : group.kind === 'course' ? `course:${index}` : 'dish'
      let segment = segments.find((s) => s.key === key)
      if (!segment) {
        segment = { key, parts: [] }
        segments.push(segment)
      }
      const texts = group.picks.map(pickText)
      if (key === 'remove' || key === 'meal') segment.parts.push(...texts)
      else segment.parts.push(texts.join(', '))
    })
    all = [
      ...segments.filter((s) => s.key !== 'meal').map((s) => (s.key === 'remove' ? s.parts.join(', ') : s.parts.join(' · '))),
      ...segments.filter((s) => s.key === 'meal').map((s) => `Meal: ${s.parts.join(', ')}`),
    ]
  } else {
    all = line.modifiers.length ? [line.modifiers.join(' · ')] : []
  }
  return all.length > max ? { lines: all.slice(0, max), more: all.length - max } : { lines: all, more: 0 }
}

/* --------------------------------------------------------------------------
   Pricing lines again against the live menu
   -------------------------------------------------------------------------- */

/**
 * Prices every line that carries picks again. A line whose dish is gone keeps its stored
 * price (it shows a warning instead). `changed` is false when nothing needs writing back.
 */
export function repriceLines(menu: Menu, lines: CartLine[]): { lines: CartLine[]; changed: boolean } {
  let changed = false
  const next = lines.map((line) => {
    const selection = line.selection
    if (!selection) return line
    const item = menu.items.find((i) => i.id === selection.itemId)
    if (!item) return line
    const priced = priceSelection(menu, selection)
    const updated: CartLine = { ...line, name: item.name, unitPrice: priced.unitPrice, modifiers: priced.summary, choices: priced.choices, variant: priced.variant?.label ?? null }
    const before = JSON.stringify([line.name, line.unitPrice, line.modifiers, line.choices ?? null, line.variant ?? null])
    const after = JSON.stringify([updated.name, updated.unitPrice, updated.modifiers, updated.choices, updated.variant])
    if (before === after) return line
    changed = true
    return updated
  })
  return { lines: changed ? next : lines, changed }
}

/**
 * Plain problems with one line, most important first: "Halloumi is sold out", "Pick 1 more",
 * "Not served at 10:00 · Mon–Fri 12:30–15:00". `at` adds the order-time check.
 */
export function cartLineIssues(menu: Menu, line: CartLine, at?: { weekday: number; time: string }): string[] {
  const item = menu.items.find((i) => i.id === line.itemId)
  if (!item) return ['No longer on the menu']
  const out: string[] = []
  if (line.selection) out.push(...priceSelection(menu, line.selection).issues.map((i) => i.message))
  else if (item.status === 'sold_out') out.push(`${item.name} is sold out`)
  if (at) {
    const open = isAvailableAt(menu, item, at.weekday, at.time)
    if (!open.ok) {
      if (open.reason === 'hidden') out.unshift('No longer on the menu')
      else if (open.reason === 'sold_out') out.push(`${item.name} is sold out`)
      else if (open.reason === 'not_now') {
        const windows = windowsOf(menu, item)
        out.push(windows ? `Not served at ${at.time} · ${availabilityText(windows)}` : `Not served at ${at.time}`)
      } else if (open.reason === 'choice_sold_out' && out.length === 0) out.push('A choice it needs is sold out')
    }
  }
  return [...new Set(out)]
}

/** The order's lines, priced and grouped for the ticket. */
export function orderLinesFromCart(menu: Menu, lines: CartLine[], prefix = 'ol'): OrderLine[] {
  return lines.map((line, index) => {
    const id = `${prefix}_${index + 1}`
    const selection = line.selection
    if (selection && menu.items.some((i) => i.id === selection.itemId)) return toOrderLine(menu, selection, line.qty, line.note, id)
    return { id, itemId: line.itemId, name: line.name, qty: line.qty, unitPrice: line.unitPrice, modifiers: line.modifiers, note: line.note, total: line.unitPrice * line.qty }
  })
}
