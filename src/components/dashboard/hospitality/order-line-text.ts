import type { Menu, OrderLine, OrderLineGroup, OrderLinePick } from '@/lib/hospitality/types'

/* ==========================================================================
   Order line wording for the pass: a line's title with its size, and its
   picks grouped under their headings. Kitchen words use the short names
   the owner gave ("SAUCE", "TIRO", "LG"); otherwise the menu's own words.
   Removals always read "NO onion". Lines from before choice groups fall
   back to their flat labels.
   ========================================================================== */

export interface TicketPick {
  text: string
  remove: boolean
  nested: TicketGroup[]
}

export interface TicketGroup {
  heading: string
  meal: boolean
  picks: TicketPick[]
}

function removalText(pick: OrderLinePick, kitchen: boolean): string {
  const base = kitchen && pick.kitchenLabel ? pick.kitchenLabel : pick.label.replace(/^no\s+/i, '')
  return `NO ${base}`
}

function pickText(pick: OrderLinePick, kitchen: boolean): string {
  if (pick.remove) return removalText(pick, kitchen)
  const label = kitchen && pick.kitchenLabel ? pick.kitchenLabel : pick.label
  return pick.qty > 1 ? `${pick.qty}× ${label}` : label
}

function toGroup(group: OrderLineGroup, kitchen: boolean): TicketGroup {
  return {
    heading: kitchen && group.kitchenName ? group.kitchenName : group.name,
    meal: Boolean(group.meal),
    picks: group.picks.map((pick) => ({ text: pickText(pick, kitchen), remove: Boolean(pick.remove), nested: (pick.nested ?? []).map((g) => ({ ...toGroup(g, kitchen), meal: false })) })),
  }
}

/** The line's picks, grouped, dish groups first and then the meal's. [] for lines without grouped picks. */
export function ticketGroups(line: Pick<OrderLine, 'choices'>, kitchen = false): TicketGroup[] {
  return (line.choices ?? []).filter((g) => g.picks.length).map((g) => toGroup(g, kitchen))
}

/** "Gyros pita · Large", or in kitchen words "GYROS · LG". */
export function ticketTitle(line: Pick<OrderLine, 'name' | 'variant' | 'kitchenName' | 'selection'>, kitchen = false, menu?: Menu): string {
  const name = kitchen && line.kitchenName ? line.kitchenName : line.name
  let size = line.variant ?? null
  if (kitchen && line.selection?.variantId && menu) {
    const variant = menu.items.find((i) => i.id === line.selection!.itemId)?.variants?.find((v) => v.id === line.selection!.variantId)
    if (variant?.kitchenLabel) size = variant.kitchenLabel
  }
  return size ? `${name} · ${size}` : name
}

function flat(pick: TicketPick): string {
  const inner = pick.nested.flatMap((g) => g.picks.map(flat))
  return inner.length ? `${pick.text} (${inner.join(', ')})` : pick.text
}

/** One short line per group for a board card: "SAUCE: Garlic mayo, Ketchup", "Meal · SIDE: Chips". */
export function compactLines(line: Pick<OrderLine, 'choices' | 'modifiers'>, kitchen = false): string[] {
  const groups = ticketGroups(line, kitchen)
  if (!groups.length) return line.modifiers.length ? [line.modifiers.join(' · ')] : []
  return groups.map((g) => `${g.meal ? 'Meal · ' : ''}${g.heading}: ${g.picks.map(flat).join(', ')}`)
}

/** The dish's note for the kitchen, from the live menu. */
export function kitchenNoteFor(menu: Menu | undefined, line: Pick<OrderLine, 'itemId'>): string | null {
  return menu?.items.find((i) => i.id === line.itemId)?.kitchenNote?.trim() || null
}
