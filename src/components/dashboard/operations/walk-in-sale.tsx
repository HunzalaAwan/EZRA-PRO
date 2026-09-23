'use client'

import * as React from 'react'
import Image from 'next/image'
import { Banknote, CheckCircle2, CreditCard, Minus, Plus, Printer, RotateCcw, Tag, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { toast } from '@/components/ui/toaster'
import { TicketQr, ticketPayload } from '@/components/ui/ticket-qr'
import { usePricing } from '@/hooks/use-pricing'
import { ACTIVITY_KIND_META } from '@/lib/activity-kinds'
import { applyRules, giftProblem, promoDiscount, promoProblem } from '@/lib/pricing'
import { cn, formatCurrency, formatTime, pluralize } from '@/lib/utils'
import type { ActivityKind, CurrencyCode } from '@/types'

/* ==========================================================================
   WALK-IN SALE
   The desk's till: an activity and a time with seats, the guests and
   extras, a promo or gift card, then cash (with change) or card on the
   reader. Price rules apply exactly as on the storefront. Sales are kept
   in the browser for the demo and listed at the side.
   ========================================================================== */

export interface WalkInActivity {
  slug: string
  name: string
  kind: ActivityKind
  image: string
  tiers: { id: string; label: string; price: number; max: number; seat: boolean }[]
  addOns: { id: string; label: string; price: number }[]
  slots: { id: string; startsAt: string; seatsLeft: number }[]
}

interface Sale {
  reference: string
  activity: string
  startsAt: string
  guests: number
  total: number
  method: 'cash' | 'card'
  at: string
}

const salesKey = (slug: string) => `ezra:walkins:${slug}`

export function WalkInSale({ tenantSlug, tenantName, currency, activities, nowIso }: { tenantSlug: string; tenantName: string; currency: CurrencyCode; activities: WalkInActivity[]; nowIso: string }) {
  const pricing = usePricing(tenantSlug)
  const [query, setQuery] = React.useState('')
  const [slug, setSlug] = React.useState(activities[0]?.slug ?? '')
  const [slotId, setSlotId] = React.useState('')
  const [qty, setQty] = React.useState<Record<string, number>>({})
  const [extras, setExtras] = React.useState<Record<string, boolean>>({})
  const [guestName, setGuestName] = React.useState('')
  const [code, setCode] = React.useState('')
  const [promoCode, setPromoCode] = React.useState<string | null>(null)
  const [giftCode, setGiftCode] = React.useState<string | null>(null)
  const [codeError, setCodeError] = React.useState<string | null>(null)
  const [method, setMethod] = React.useState<'card' | 'cash'>('card')
  const [tendered, setTendered] = React.useState('')
  const [processing, setProcessing] = React.useState(false)
  const [receipt, setReceipt] = React.useState<(Sale & { lines: { label: string; total: number }[] }) | null>(null)
  const [sales, setSales] = React.useState<Sale[]>([])

  React.useEffect(() => {
    try {
      setSales(JSON.parse(window.localStorage.getItem(salesKey(tenantSlug)) ?? '[]'))
    } catch {
      /* storage blocked */
    }
  }, [tenantSlug])

  const activity = activities.find((entry) => entry.slug === slug)
  const slot = activity?.slots.find((entry) => entry.id === slotId) ?? activity?.slots[0]
  const todayKey = nowIso.slice(0, 10)

  React.useEffect(() => {
    setSlotId('')
    setQty(activity ? { [activity.tiers[0]?.id ?? '']: 1 } : {})
    setExtras({})
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps

  const guests = activity ? activity.tiers.reduce((sum, tier) => sum + (qty[tier.id] ?? 0), 0) : 0
  const seatsUsed = activity ? activity.tiers.reduce((sum, tier) => sum + (tier.seat ? (qty[tier.id] ?? 0) : 0), 0) : 0
  const rules = activity && slot ? applyRules(pricing.rules, { activitySlug: activity.slug, startsAt: slot.startsAt, nowIso, guests: Math.max(1, guests) }) : { multiplier: 1, applied: [] }

  const lines = activity
    ? [
        ...activity.tiers.filter((tier) => (qty[tier.id] ?? 0) > 0).map((tier) => ({ label: `${qty[tier.id]} × ${tier.label}`, total: Math.round(tier.price * rules.multiplier) * (qty[tier.id] ?? 0) })),
        ...activity.addOns.filter((addOn) => extras[addOn.id]).map((addOn) => ({ label: `${Math.max(1, guests)} × ${addOn.label}`, total: addOn.price * Math.max(1, guests) })),
      ]
    : []
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
  const promo = pricing.promos.find((entry) => entry.code === promoCode)
  const card = pricing.giftCards.find((entry) => entry.code === giftCode)
  const promoOff = promo && activity && !promoProblem(promo, { activitySlug: activity.slug, subtotal, todayKey }) ? promoDiscount(promo, subtotal) : 0
  const giftOff = card && !giftProblem(card, todayKey) ? Math.min(card.balance, subtotal - promoOff) : 0
  const total = Math.max(0, subtotal - promoOff - giftOff)
  const change = method === 'cash' && tendered ? Math.round(Number(tendered) * 100) - total : 0
  const overSeats = slot ? seatsUsed > slot.seatsLeft : false
  const canPay = Boolean(activity && slot && guests > 0 && !overSeats && (method === 'card' || total === 0 || change >= 0))

  const applyCode = () => {
    const value = code.trim().toUpperCase()
    if (!value || !activity) return
    const gift = pricing.giftCards.find((entry) => entry.code === value)
    if (gift) {
      const problem = giftProblem(gift, todayKey)
      if (problem) return setCodeError(problem)
      setGiftCode(gift.code)
    } else {
      const problem = promoProblem(pricing.promos.find((entry) => entry.code === value), { activitySlug: activity.slug, subtotal, todayKey })
      if (problem) return setCodeError(problem)
      setPromoCode(value)
    }
    setCode('')
    setCodeError(null)
  }

  const complete = () => {
    if (!activity || !slot || !canPay) return
    setProcessing(true)
    window.setTimeout(
      () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        const reference = `EZR-${Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`
        const sale: Sale = { reference, activity: activity.name, startsAt: slot.startsAt, guests, total, method, at: new Date().toISOString() }
        const next = [sale, ...sales].slice(0, 50)
        setSales(next)
        try {
          window.localStorage.setItem(salesKey(tenantSlug), JSON.stringify(next))
        } catch {
          /* storage blocked */
        }
        pricing.recordRedemption(promoOff > 0 ? promo?.code : undefined, giftOff > 0 && card ? { code: card.code, amount: giftOff } : undefined)
        setReceipt({
          ...sale,
          lines: [...lines, ...(promoOff > 0 ? [{ label: `Code ${promo?.code}`, total: -promoOff }] : []), ...(giftOff > 0 ? [{ label: 'Gift card', total: -giftOff }] : [])],
        })
        setProcessing(false)
        toast.success(`Sold · ${formatCurrency(total, currency)}`, { description: `${guests} ${pluralize(guests, 'guest')} on ${activity.name} ${formatTime(slot.startsAt)}${method === 'cash' && change > 0 ? ` · change ${formatCurrency(change, currency)}` : ''}` })
      },
      method === 'card' ? 1500 : 400,
    )
  }

  const reset = () => {
    setReceipt(null)
    setGuestName('')
    setPromoCode(null)
    setGiftCode(null)
    setTendered('')
    setQty(activity ? { [activity.tiers[0]?.id ?? '']: 1 } : {})
    setExtras({})
  }

  if (activities.length === 0) {
    return <EmptyState icon={Banknote} title="Nothing left to sell today" description="Every departure today and tomorrow is full or has gone." />
  }

  const needle = query.trim().toLowerCase()
  const listed = activities.filter((entry) => !needle || entry.name.toLowerCase().includes(needle))
  const takings = sales.filter((sale) => sale.at.slice(0, 10) === new Date().toISOString().slice(0, 10))

  if (receipt) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface p-6 text-center print:border-0">
          <CheckCircle2 className="mx-auto size-8 text-success print:hidden" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-muted">{tenantName}</p>
          <h2 className="mt-1 text-xl font-semibold">{receipt.activity}</h2>
          <p className="text-sm text-muted">{formatTime(receipt.startsAt)} · {receipt.guests} {pluralize(receipt.guests, 'guest')}{guestName ? ` · ${guestName}` : ''}</p>
          <div className="mt-4 flex justify-center">
            <TicketQr value={ticketPayload(receipt.reference)} size={148} className="border border-line" />
          </div>
          <p className="mt-2 font-mono text-lg font-semibold tracking-widest">{receipt.reference}</p>
          <ul className="mt-4 flex list-none flex-col gap-1 border-t border-dashed border-line p-0 pt-3 text-left text-sm">
            {receipt.lines.map((line) => (
              <li key={line.label} className="flex justify-between"><span className="text-muted">{line.label}</span><span className="tabular-nums">{formatCurrency(line.total, currency)}</span></li>
            ))}
            <li className="mt-1 flex justify-between border-t border-line pt-2 font-semibold"><span>Paid by {receipt.method}</span><span className="tabular-nums">{formatCurrency(receipt.total, currency)}</span></li>
          </ul>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="secondary" leftIcon={<Printer />} onClick={() => window.print()} className="flex-1">Print ticket</Button>
          <Button leftIcon={<RotateCcw />} onClick={reset} className="flex-1">New sale</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
      {/* activities */}
      <div className="flex flex-col gap-3">
        <SearchInput value={query} onValueChange={setQuery} label="Find an activity" placeholder="Find an activity" shortcut={false} />
        <ul className="flex max-h-[34rem] list-none flex-col gap-1.5 overflow-y-auto p-0">
          {listed.map((entry) => (
            <li key={entry.slug}>
              <button
                type="button"
                onClick={() => setSlug(entry.slug)}
                className={cn('flex w-full items-center gap-3 rounded-xl border p-2 text-left', entry.slug === slug ? 'border-primary bg-primary-soft/25' : 'border-line bg-surface hover:border-line-strong')}
              >
                <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
                  {entry.image ? <Image src={entry.image} alt="" fill sizes="44px" className="object-cover" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{entry.name}</span>
                  <span className="block text-xs text-subtle">{ACTIVITY_KIND_META[entry.kind].short} · next {formatTime(entry.slots[0].startsAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* time, guests, extras */}
      {activity ? (
        <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
          <div>
            <p className="text-sm font-semibold">Time</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {activity.slots.slice(0, 14).map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSlotId(entry.id)}
                  className={cn('rounded-xl border px-3 py-2 text-left', slot?.id === entry.id ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong')}
                >
                  <span className="block text-sm font-semibold tabular-nums">{formatTime(entry.startsAt)}</span>
                  <span className="block text-xs text-subtle">{entry.startsAt.slice(0, 10) === todayKey ? 'Today' : 'Tomorrow'} · {entry.seatsLeft} left</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold">{activity.kind === 'rental' ? 'Units' : 'Guests'}</p>
            <ul className="mt-2 flex list-none flex-col divide-y divide-line-subtle rounded-xl border border-line p-0">
              {activity.tiers.map((tier) => {
                const value = qty[tier.id] ?? 0
                return (
                  <li key={tier.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <span>
                      <span className="block text-sm font-medium">{tier.label}</span>
                      <span className="block text-xs text-subtle tabular-nums">{formatCurrency(Math.round(tier.price * rules.multiplier), currency)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <IconButton aria-label={`Fewer ${tier.label}`} size="sm" variant="outline" disabled={value <= 0} onClick={() => setQty((q) => ({ ...q, [tier.id]: value - 1 }))}><Minus aria-hidden="true" /></IconButton>
                      <span className="w-6 text-center text-base font-semibold tabular-nums">{value}</span>
                      <IconButton aria-label={`More ${tier.label}`} size="sm" variant="outline" disabled={value >= tier.max || (tier.seat && slot ? seatsUsed >= slot.seatsLeft : false)} onClick={() => setQty((q) => ({ ...q, [tier.id]: value + 1 }))}><Plus aria-hidden="true" /></IconButton>
                    </span>
                  </li>
                )
              })}
            </ul>
            {overSeats ? <p className="mt-1.5 text-xs font-medium text-danger">Only {slot?.seatsLeft} left at this time.</p> : null}
          </div>

          {activity.addOns.length > 0 ? (
            <div>
              <p className="text-sm font-semibold">Extras</p>
              <div className="mt-2 flex flex-col gap-2">
                {activity.addOns.map((addOn) => (
                  <label key={addOn.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm">
                    <span className="flex items-center gap-3">
                      <Checkbox checked={Boolean(extras[addOn.id])} onCheckedChange={(checked) => setExtras((e) => ({ ...e, [addOn.id]: checked === true }))} />
                      {addOn.label}
                    </span>
                    <span className="text-subtle tabular-nums">{formatCurrency(addOn.price, currency)} each</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <Input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Guest name (optional, for the ticket)" aria-label="Guest name" />
        </div>
      ) : null}

      {/* total and payment */}
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm font-semibold">Total</p>
          <ul className="mt-2 flex list-none flex-col gap-1 p-0 text-sm">
            {lines.map((line) => (
              <li key={line.label} className="flex justify-between gap-2"><span className="truncate text-muted">{line.label}</span><span className="tabular-nums">{formatCurrency(line.total, currency)}</span></li>
            ))}
            {rules.applied.map((rule) => (
              <li key={rule.id} className="text-xs text-subtle">{rule.name} {rule.percent > 0 ? '+' : ''}{rule.percent}% in the prices</li>
            ))}
            {promoOff > 0 ? (
              <li className="flex justify-between text-success"><span className="inline-flex items-center gap-1">{promo?.code}<button type="button" aria-label="Remove code" onClick={() => setPromoCode(null)}><X className="size-3.5" /></button></span><span className="tabular-nums">−{formatCurrency(promoOff, currency)}</span></li>
            ) : null}
            {giftOff > 0 ? (
              <li className="flex justify-between text-primary"><span className="inline-flex items-center gap-1">Gift card<button type="button" aria-label="Remove gift card" onClick={() => setGiftCode(null)}><X className="size-3.5" /></button></span><span className="tabular-nums">−{formatCurrency(giftOff, currency)}</span></li>
            ) : null}
          </ul>
          <p className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-sm text-muted">To pay</span>
            <span className="font-display text-3xl font-semibold tabular-nums">{formatCurrency(total, currency)}</span>
          </p>
          <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); applyCode() }}>
            <Input value={code} onChange={(e) => { setCode(e.target.value); setCodeError(null) }} placeholder="Promo or gift card" aria-label="Promo or gift card" className="font-mono uppercase" leftIcon={<Tag />} />
            <Button type="submit" variant="secondary" disabled={!code.trim()}>Apply</Button>
          </form>
          {codeError ? <p className="mt-1 text-xs font-medium text-danger">{codeError}</p> : null}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment">
            {([['card', 'Card', CreditCard], ['cash', 'Cash', Banknote]] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" role="radio" aria-checked={method === value} onClick={() => setMethod(value)} className={cn('flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold', method === value ? 'border-primary bg-primary-soft text-primary' : 'border-line')}>
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          {method === 'cash' ? (
            <div className="mt-3 flex flex-col gap-2">
              <Input type="number" min={0} value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder="Cash handed over" aria-label="Cash handed over" />
              <div className="flex flex-wrap gap-1.5">
                {[20, 50, 100, 200].map((note) => (
                  <button key={note} type="button" onClick={() => setTendered(String(note))} className="rounded-md border border-line px-2 py-1 text-xs tabular-nums hover:border-primary/50">{formatCurrency(note * 100, currency)}</button>
                ))}
              </div>
              {tendered ? (
                <p className={cn('text-sm font-semibold tabular-nums', change < 0 ? 'text-danger' : 'text-success')}>
                  {change < 0 ? `${formatCurrency(-change, currency)} short` : `Change ${formatCurrency(change, currency)}`}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-subtle">{processing ? 'Waiting for the card on the reader…' : 'Tap, insert or swipe on the reader when you charge.'}</p>
          )}
          <Button size="lg" fullWidth className="mt-4" loading={processing} disabled={!canPay} onClick={complete}>
            {method === 'card' ? `Charge ${formatCurrency(total, currency)}` : `Take ${formatCurrency(total, currency)} cash`}
          </Button>
        </div>

        {takings.length > 0 ? (
          <div className="rounded-2xl border border-line bg-surface p-5 text-sm">
            <p className="flex justify-between font-semibold"><span>Walk-ins today</span><span className="tabular-nums">{formatCurrency(takings.reduce((sum, sale) => sum + sale.total, 0), currency)}</span></p>
            <ul className="mt-2 flex list-none flex-col gap-1 p-0 text-xs text-muted">
              {takings.slice(0, 6).map((sale) => (
                <li key={sale.reference} className="flex justify-between gap-2"><span className="truncate">{sale.reference} · {sale.activity}</span><span className="tabular-nums">{formatCurrency(sale.total, currency)}</span></li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
