'use client'

import * as React from 'react'

import { CART_EVENT, addLine, cartKey, emptyCart, parseCart, readCartRaw, repriceLines, replaceLine as swapLine, writeCart, type Cart, type CartLineInput, type CartMode } from '@/lib/cart'
import type { Menu } from '@/lib/hospitality/types'

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

  const add = React.useCallback((line: CartLineInput, qty = 1) => commit((c) => ({ ...c, lines: addLine(c.lines, line, qty) })), [commit])
  /** An edited line takes the old one's place; it merges into a line that is now the same. */
  const replaceLine = React.useCallback((key: string, line: CartLineInput, qty: number) => commit((c) => ({ ...c, lines: swapLine(c.lines, key, line, qty) })), [commit])
  const setQty = React.useCallback((key: string, qty: number) => commit((c) => ({ ...c, lines: qty <= 0 ? c.lines.filter((l) => l.key !== key) : c.lines.map((l) => (l.key === key ? { ...l, qty } : l)) })), [commit])
  const setMode = React.useCallback((mode: CartMode) => commit((c) => ({ ...c, mode })), [commit])
  const setZone = React.useCallback((zoneId: string | null) => commit((c) => ({ ...c, zoneId })), [commit])
  const setWhen = React.useCallback((when: string) => commit((c) => ({ ...c, when })), [commit])
  const setTip = React.useCallback((tipPercent: number) => commit((c) => ({ ...c, tipPercent })), [commit])
  const clear = React.useCallback(() => writeCart(slug, null), [slug])

  /** Prices lines with picks again against the live menu; writes only when a price or label moved. */
  const reprice = React.useCallback(
    (menu: Menu) => {
      const current = parseCart(readCartRaw(slug))
      const next = repriceLines(menu, current.lines)
      if (next.changed) writeCart(slug, { ...current, lines: next.lines })
    },
    [slug],
  )

  return { cart, add, replaceLine, setQty, setMode, setZone, setWhen, setTip, clear, reprice }
}
