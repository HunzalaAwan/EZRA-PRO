'use client'

import * as React from 'react'

import { defaultGiftCards, defaultPromos, defaultRules, type GiftCard, type PricingRule, type PromoCode } from '@/lib/pricing'

/* ==========================================================================
   usePricing — pricing rules, promo codes and gift cards for one storefront,
   live. The defaults are laid under the operator's edits, kept in the
   browser (\`ezra:pricing:<slug>\`). The storefront widget, checkout, the
   walk-in screen and the dashboard all read the same store, so a rule
   switched off in the dashboard changes the storefront price at once.
   ========================================================================== */

export const PRICING_EVENT = 'ezra:pricing'
const keyFor = (slug: string) => `ezra:pricing:${slug}`

interface PricingStore {
  rules?: PricingRule[]
  promos?: PromoCode[]
  giftCards?: GiftCard[]
}

function read(slug: string) {
  try {
    return window.localStorage.getItem(keyFor(slug)) ?? ''
  } catch {
    return ''
  }
}

export function usePricing(slug: string) {
  const subscribe = React.useCallback((onChange: () => void) => {
    window.addEventListener('storage', onChange)
    window.addEventListener(PRICING_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(PRICING_EVENT, onChange)
    }
  }, [])
  const raw = React.useSyncExternalStore(subscribe, () => read(slug), () => '')
  const store = React.useMemo<PricingStore>(() => {
    if (!raw) return {}
    try {
      return JSON.parse(raw) as PricingStore
    } catch {
      return {}
    }
  }, [raw])

  const rules = React.useMemo(() => store.rules ?? defaultRules(slug), [store.rules, slug])
  const promos = React.useMemo(() => store.promos ?? defaultPromos(slug), [store.promos, slug])
  const giftCards = React.useMemo(() => store.giftCards ?? defaultGiftCards(slug), [store.giftCards, slug])

  const write = React.useCallback(
    (patch: PricingStore | null) => {
      try {
        if (patch) window.localStorage.setItem(keyFor(slug), JSON.stringify({ ...store, ...patch }))
        else window.localStorage.removeItem(keyFor(slug))
      } catch {
        /* storage blocked */
      }
      window.dispatchEvent(new Event(PRICING_EVENT))
    },
    [slug, store],
  )

  return {
    rules,
    promos,
    giftCards,
    setRules: (next: PricingRule[]) => write({ rules: next }),
    setPromos: (next: PromoCode[]) => write({ promos: next }),
    setGiftCards: (next: GiftCard[]) => write({ giftCards: next }),
    /** After a sale: count a promo use and take the gift card amount off its balance. */
    recordRedemption: (promoCode?: string, gift?: { code: string; amount: number }) =>
      write({
        promos: promoCode ? promos.map((promo) => (promo.code === promoCode ? { ...promo, used: promo.used + 1 } : promo)) : promos,
        giftCards: gift
          ? giftCards.map((card) =>
              card.code === gift.code
                ? { ...card, balance: Math.max(0, card.balance - gift.amount), status: card.balance - gift.amount <= 0 ? 'redeemed' : card.status }
                : card,
            )
          : giftCards,
      }),
    reset: () => write(null),
    hasEdits: raw !== '',
  }
}
