'use client'

import * as React from 'react'
import { Gift, Tag, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { giftProblem, promoProblem, type GiftCard, type PricingRule, type PromoCode } from '@/lib/pricing'
import { formatCurrency } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   Checkout — one box for a promo code or a gift card code. A promo takes
   money off the tickets and extras; a gift card pays from its balance.
   Price rules that already apply (early bird, groups) are listed above.
   ========================================================================== */

export function CheckoutDiscounts({
  promos,
  giftCards,
  activitySlug,
  subtotal,
  todayKey,
  currency,
  promoCode,
  giftCode,
  onPromo,
  onGift,
  promoOff,
  giftOff,
  rules,
}: {
  promos: PromoCode[]
  giftCards: GiftCard[]
  activitySlug: string
  subtotal: number
  todayKey: string
  currency: CurrencyCode
  promoCode: string | null
  giftCode: string | null
  onPromo: (code: string | null) => void
  onGift: (code: string | null) => void
  promoOff: number
  giftOff: number
  rules: PricingRule[]
}) {
  const [value, setValue] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const apply = () => {
    const code = value.trim().toUpperCase()
    if (!code) return
    const card = giftCards.find((entry) => entry.code === code)
    if (card) {
      const problem = giftProblem(card, todayKey)
      if (problem) return setError(problem)
      onGift(card.code)
    } else {
      const promo = promos.find((entry) => entry.code === code)
      const problem = promoProblem(promo, { activitySlug, subtotal, todayKey })
      if (problem) return setError(problem)
      onPromo(code)
    }
    setError(null)
    setValue('')
  }

  return (
    <section aria-labelledby="step-codes" className="space-y-3">
      <h2 id="step-codes" className="font-display text-lg font-semibold tracking-tight">
        Promo code or gift card
      </h2>
      {rules.length > 0 ? (
        <p className="text-sm text-muted">
          Already applied: {rules.map((rule) => `${rule.name} (${rule.percent > 0 ? '+' : ''}${rule.percent}%)`).join(', ')}.
        </p>
      ) : null}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          apply()
        }}
      >
        <Input
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null) }}
          placeholder="ALOHA10 or GIFT-XXXX-XXXX"
          aria-label="Promo code or gift card"
          aria-invalid={error ? true : undefined}
          className="font-mono uppercase"
          leftIcon={<Tag />}
        />
        <Button type="submit" variant="secondary" disabled={!value.trim()}>Apply</Button>
      </form>
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {promoCode ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1 text-sm font-medium text-success">
            <Tag className="size-3.5" aria-hidden="true" />
            {promoCode} · {formatCurrency(promoOff, currency)} off
            <button type="button" aria-label={`Remove ${promoCode}`} onClick={() => onPromo(null)} className="ml-0.5 rounded-full p-0.5 hover:bg-success/15">
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ) : null}
        {giftCode ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">
            <Gift className="size-3.5" aria-hidden="true" />
            Gift card …{giftCode.slice(-4)} · {formatCurrency(giftOff, currency)}
            <button type="button" aria-label="Remove gift card" onClick={() => onGift(null)} className="ml-0.5 rounded-full p-0.5 hover:bg-primary/15">
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>
    </section>
  )
}
