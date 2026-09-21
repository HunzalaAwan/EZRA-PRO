import type { DeliveryZone, OrderChannel } from '@/lib/hospitality/types'

/* ==========================================================================
   The order cart — what a guest has picked from the menu, kept in the
   browser per storefront so a refresh or a second tab keeps it.
   ========================================================================== */

export type CartMode = Exclude<OrderChannel, 'dine_in'>

export interface CartLine {
  /** itemId plus the chosen options, so the same dish with different choices is two lines. */
  key: string
  itemId: string
  name: string
  unitPrice: number
  qty: number
  modifiers: string[]
  note: string | null
}

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

export function cartTotals(cart: Cart, zones: DeliveryZone[], taxRate: number): CartTotals {
  const subtotal = cart.lines.reduce((sum, line) => sum + line.unitPrice * line.qty, 0)
  const zone = cart.mode === 'delivery' ? zones.find((z) => z.id === cart.zoneId) ?? zones[0] : null
  const deliveryFee = zone ? zone.fee : 0
  const serviceFee = Math.round(subtotal * SERVICE_FEE_RATE)
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

export function lineKey(itemId: string, modifiers: string[], note: string | null) {
  return `${itemId}::${[...modifiers].sort().join('|')}::${note ?? ''}`
}
