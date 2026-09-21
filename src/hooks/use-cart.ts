'use client'

import * as React from 'react'

import { CART_EVENT, cartKey, emptyCart, lineKey, parseCart, readCartRaw, writeCart, type Cart, type CartLine, type CartMode } from '@/lib/cart'

/* ==========================================================================
   useCart — the guest's order for one storefront, shared across every
   component on the page and across tabs.
   ========================================================================== */

const EMPTY = JSON.stringify(emptyCart())

function subscribe(slug: string, onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === cartKey(slug)) onChange()
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener(CART_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener(CART_EVENT, onChange)
  }
}

export function useCart(slug: string) {
  const raw = React.useSyncExternalStore(
    React.useCallback((cb) => subscribe(slug, cb), [slug]),
    () => readCartRaw(slug) || EMPTY,
    () => EMPTY,
  )
  const cart = React.useMemo(() => parseCart(raw), [raw])

  const commit = React.useCallback((change: (cart: Cart) => Cart) => writeCart(slug, change(parseCart(readCartRaw(slug)))), [slug])

  const add = React.useCallback(
    (line: Omit<CartLine, 'key' | 'qty'>, qty = 1) =>
      commit((c) => {
        const key = lineKey(line.itemId, line.modifiers, line.note)
        const existing = c.lines.find((l) => l.key === key)
        return existing
          ? { ...c, lines: c.lines.map((l) => (l.key === key ? { ...l, qty: l.qty + qty } : l)) }
          : { ...c, lines: [...c.lines, { ...line, key, qty }] }
      }),
    [commit],
  )
  const setQty = React.useCallback((key: string, qty: number) => commit((c) => ({ ...c, lines: qty <= 0 ? c.lines.filter((l) => l.key !== key) : c.lines.map((l) => (l.key === key ? { ...l, qty } : l)) })), [commit])
  const setMode = React.useCallback((mode: CartMode) => commit((c) => ({ ...c, mode })), [commit])
  const setZone = React.useCallback((zoneId: string | null) => commit((c) => ({ ...c, zoneId })), [commit])
  const setWhen = React.useCallback((when: string) => commit((c) => ({ ...c, when })), [commit])
  const setTip = React.useCallback((tipPercent: number) => commit((c) => ({ ...c, tipPercent })), [commit])
  const clear = React.useCallback(() => writeCart(slug, null), [slug])

  return { cart, add, setQty, setMode, setZone, setWhen, setTip, clear }
}
