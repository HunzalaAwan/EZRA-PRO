'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Bike, Check, ChefHat, Clock, Lock, MapPin, ShoppingBag } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { useCart } from '@/hooks/use-cart'
import { cartTotals, type CartMode } from '@/lib/cart'
import { hm, mh } from '@/lib/hospitality/floor'
import type { OrderingHours } from '@/lib/hospitality/types'
import { cn, formatCurrency } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   <OrderCheckout> — one page: when, where, who, how to pay, place order.
   Then a confirmation the guest can leave open while the kitchen works.
   ========================================================================== */

export interface OrderCheckoutProps {
  slug: string
  tenantName: string
  tenantPhone: string
  ordering: OrderingHours
  currency: CurrencyCode
  taxRate: number
  taxLabel: string
  nowTime: string
}

interface Details {
  name: string
  email: string
  phone: string
  address: string
  instructions: string
  card: string
  expiry: string
  cvc: string
}

const TIPS = [0, 5, 10, 15]

export function OrderCheckout({ slug, tenantName, tenantPhone, ordering, currency, taxRate, taxLabel, nowTime }: OrderCheckoutProps) {
  const { cart, setMode, setZone, setWhen, setTip, setQty, clear } = useCart(slug)
  const [details, setDetails] = React.useState<Details>({ name: '', email: '', phone: '', address: '', instructions: '', card: '', expiry: '', cvc: '' })
  const [errors, setErrors] = React.useState<Partial<Record<keyof Details, string>>>({})
  const [placed, setPlaced] = React.useState<{ number: string; promised: string; total: number; mode: CartMode; lines: number } | null>(null)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const zones = ordering.delivery.zones
  const zone = zones.find((z) => z.id === cart.zoneId) ?? zones[0]
  const totals = cartTotals(cart, zones, taxRate)
  const hours = ordering[cart.mode]
  const lead = hours.leadMinutes + (cart.mode === 'delivery' ? zone?.minutes ?? 0 : 0)
  const now = hm(nowTime)
  const earliest = Math.max(now + lead, hm(hours.startTime))
  const slots: string[] = []
  for (let t = Math.ceil(earliest / 15) * 15; t <= hm(hours.endTime); t += 15) slots.push(mh(t))
  const asapReady = mh(now + lead)
  const openNow = now >= hm(hours.startTime) && now + lead <= hm(hours.endTime)

  const set = (key: keyof Details, value: string) => {
    setDetails((d) => ({ ...d, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const validate = () => {
    const next: Partial<Record<keyof Details, string>> = {}
    if (details.name.trim().length < 2) next.name = 'Your name, so we can call it out.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(details.email)) next.email = 'A real email for the receipt.'
    if (details.phone.replace(/\D/g, '').length < 7) next.phone = 'A number we can reach you on.'
    if (cart.mode === 'delivery' && details.address.trim().length < 6) next.address = 'Street and number, please.'
    if (details.card.replace(/\D/g, '').length < 15) next.card = 'Card number looks short.'
    if (!/^\d{2}\s?\/\s?\d{2}$/.test(details.expiry.trim())) next.expiry = 'MM / YY'
    if (details.cvc.replace(/\D/g, '').length < 3) next.cvc = 'Three digits.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const place = () => {
    if (!validate()) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    const promised = cart.when === 'asap' ? asapReady : cart.when
    const number = `#${1000 + Math.floor(Math.random() * 900)}`
    setPlaced({ number, promised, total: totals.total, mode: cart.mode, lines: totals.count })
    clear()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (!mounted) return <div className="mx-auto min-h-[40vh] w-full max-w-5xl px-4 pt-28 sm:px-6" />

  /* ---------- confirmation ---------- */

  if (placed) {
    const steps = placed.mode === 'delivery' ? ['Received', 'Cooking', 'On the way', 'Delivered'] : ['Received', 'Cooking', 'Ready', 'Collected']
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-28 pb-20 sm:px-6">
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-10">
          <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
            <Check className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground">Order {placed.number} is in</h1>
          <p className="mt-2 text-base text-muted">
            {placed.mode === 'delivery' ? `Arriving around ${placed.promised}` : `Ready for pickup around ${placed.promised}`} · {placed.lines} {placed.lines === 1 ? 'item' : 'items'} · {formatCurrency(placed.total, currency)} paid.
          </p>
          <ol className="mt-8 grid grid-cols-4 gap-2">
            {steps.map((s, i) => (
              <li key={s} className="flex flex-col gap-2">
                <span className={cn('h-1.5 rounded-full', i === 0 ? 'bg-primary' : 'bg-surface-sunken')} />
                <span className={cn('text-xs', i === 0 ? 'text-foreground' : 'text-subtle')}>{s}</span>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-muted">We text you at each step. If anything changes, call {tenantName} on {tenantPhone}.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href={`/book/${slug}#menu`}>Back to the menu</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/book/${slug}#reserve`}>Reserve a table for next time</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  /* ---------- empty ---------- */

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-28 pb-20 sm:px-6">
        <div className="rounded-3xl border border-line bg-surface p-10 text-center shadow-sm">
          <ChefHat className="mx-auto size-8 text-faint" aria-hidden="true" />
          <h1 className="mt-4 font-display text-2xl font-semibold tracking-tight text-foreground">Nothing in your order yet</h1>
          <p className="mt-2 text-sm text-muted">Pick a few dishes from the menu and come back.</p>
          <Button asChild size="lg" className="mt-6">
            <Link href={`/book/${slug}#menu`}>See the menu</Link>
          </Button>
        </div>
      </div>
    )
  }

  /* ---------- checkout ---------- */

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-24 pb-24 sm:px-6 sm:pt-28 lg:pb-20">
      <Link href={`/book/${slug}#menu`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to the menu
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Checkout</h1>
      <p className="mt-2 text-base text-muted">{tenantName} · pay now, {cart.mode === 'pickup' ? 'collect when it is ready' : 'we bring it to the door'}.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-8">
          {/* ---------- how and when ---------- */}
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">How and when</h2>
            <div className="mt-4">
              <Segmented
                label="Order type"
                options={[
                  { value: 'pickup', label: 'Pickup', icon: ShoppingBag },
                  { value: 'delivery', label: 'Delivery', icon: Bike },
                ]}
                value={cart.mode}
                onValueChange={setMode}
              />
            </div>
            {cart.mode === 'delivery' ? (
              <div className="mt-5">
                <p className="text-sm font-medium text-foreground">Area</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {zones.map((z) => (
                    <button key={z.id} type="button" aria-pressed={zone?.id === z.id} onClick={() => setZone(z.id)} className={cn('rounded-lg border px-3 py-2 text-left text-sm transition-colors', zone?.id === z.id ? 'border-primary bg-primary-soft/40 text-foreground' : 'border-line text-muted hover:border-line-strong')}>
                      <span className="block">{z.name}</span>
                      <span className="block text-xs text-subtle">
                        {formatCurrency(z.fee, currency)} · about {z.minutes} min
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-5">
              <p className="text-sm font-medium text-foreground">When</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" aria-pressed={cart.when === 'asap'} disabled={!openNow} onClick={() => setWhen('asap')} className={cn('rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50', cart.when === 'asap' ? 'border-primary bg-primary-soft/40 text-foreground' : 'border-line text-muted hover:border-line-strong')}>
                  <span className="block">As soon as possible</span>
                  <span className="block text-xs text-subtle">{openNow ? `around ${asapReady}` : `opens at ${hours.startTime}`}</span>
                </button>
                {slots.slice(0, 14).map((t) => (
                  <button key={t} type="button" aria-pressed={cart.when === t} onClick={() => setWhen(t)} className={cn('rounded-lg border px-3 py-2 text-sm tabular-nums transition-colors', cart.when === t ? 'border-primary bg-primary-soft/40 text-foreground' : 'border-line text-muted hover:border-line-strong')}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- who ---------- */}
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Your details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Name" required error={errors.name}>{(c) => <Input {...c} value={details.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" placeholder="Elena Marinou" />}</Field>
              <Field label="Phone" required error={errors.phone} description="For the courier or when it is ready.">{(c) => <Input {...c} value={details.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" inputMode="tel" placeholder="+30 …" />}</Field>
              <Field label="Email" required error={errors.email} className="sm:col-span-2">{(c) => <Input {...c} type="email" value={details.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" placeholder="you@example.com" />}</Field>
              {cart.mode === 'delivery' ? (
                <>
                  <Field label="Address" required error={errors.address} className="sm:col-span-2">{(c) => <Input {...c} value={details.address} onChange={(e) => set('address', e.target.value)} autoComplete="street-address" leftIcon={<MapPin />} placeholder={`Street and number, ${zone?.name ?? ''}`} />}</Field>
                  <Field label="Instructions" optional className="sm:col-span-2">{(c) => <Textarea {...c} rows={2} value={details.instructions} onChange={(e) => set('instructions', e.target.value)} placeholder="Blue gate, ring twice, third floor…" />}</Field>
                </>
              ) : null}
            </div>
          </section>

          {/* ---------- tip ---------- */}
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">{cart.mode === 'delivery' ? 'Tip the rider' : 'Tip the kitchen'}</h2>
            <p className="mt-1 text-sm text-muted">Every cent goes to them.</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {TIPS.map((t) => (
                <button key={t} type="button" aria-pressed={cart.tipPercent === t} onClick={() => setTip(t)} className={cn('rounded-lg border px-4 py-2 text-sm tabular-nums transition-colors', cart.tipPercent === t ? 'border-primary bg-primary-soft/40 text-foreground' : 'border-line text-muted hover:border-line-strong')}>
                  {t === 0 ? 'No tip' : `${t}% · ${formatCurrency(Math.round(totals.subtotal * (t / 100)), currency)}`}
                </button>
              ))}
            </div>
          </section>

          {/* ---------- pay ---------- */}
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Lock className="size-4 text-success" aria-hidden="true" /> Payment
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem_6rem]">
              <Field label="Card number" required error={errors.card}>{(c) => <Input {...c} value={details.card} onChange={(e) => set('card', e.target.value.replace(/[^\d ]/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').slice(0, 19))} inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" />}</Field>
              <Field label="Expiry" required error={errors.expiry}>{(c) => <Input {...c} value={details.expiry} onChange={(e) => set('expiry', e.target.value.replace(/[^\d]/g, '').replace(/(\d{2})(?=\d)/, '$1 / ').slice(0, 7))} inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" />}</Field>
              <Field label="CVC" required error={errors.cvc}>{(c) => <Input {...c} value={details.cvc} onChange={(e) => set('cvc', e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="cc-csc" placeholder="123" />}</Field>
            </div>
            <p className="mt-3 text-xs text-subtle">Charged in {currency} when you place the order. Refunded in full if the kitchen cannot take it.</p>
          </section>
        </div>

        {/* ---------- summary ---------- */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <h2 className="text-base font-semibold text-foreground">Your order</h2>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-subtle">
              <Clock className="size-3.5" aria-hidden="true" />
              {cart.when === 'asap' ? `${cart.mode === 'pickup' ? 'Ready' : 'Arrives'} around ${asapReady}` : `${cart.mode === 'pickup' ? 'Ready' : 'Arrives'} at ${cart.when}`}
            </p>
            <ul className="mt-4 divide-y divide-line-subtle">
              {cart.lines.map((line) => (
                <li key={line.key} className="flex items-start gap-3 py-2.5 text-sm">
                  <span className="w-6 shrink-0 text-subtle tabular-nums">{line.qty}×</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-foreground">{line.name}</span>
                    {line.modifiers.length ? <span className="block truncate text-xs text-subtle">{line.modifiers.join(' · ')}</span> : null}
                  </span>
                  <span className="shrink-0 text-foreground tabular-nums">{formatCurrency(line.unitPrice * line.qty, currency)}</span>
                  <button type="button" aria-label={`Remove ${line.name}`} className="shrink-0 text-xs text-subtle hover:text-foreground" onClick={() => setQty(line.key, 0)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <dl className="mt-3 flex flex-col gap-1 border-t border-line-subtle pt-3 text-sm text-muted">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatCurrency(totals.subtotal, currency)}</dd>
              </div>
              {totals.deliveryFee ? (
                <div className="flex justify-between">
                  <dt>Delivery · {zone?.name}</dt>
                  <dd className="tabular-nums">{formatCurrency(totals.deliveryFee, currency)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt>Service fee</dt>
                <dd className="tabular-nums">{formatCurrency(totals.serviceFee, currency)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{taxLabel}</dt>
                <dd className="tabular-nums">{formatCurrency(totals.tax, currency)}</dd>
              </div>
              {totals.tip ? (
                <div className="flex justify-between">
                  <dt>Tip</dt>
                  <dd className="tabular-nums">{formatCurrency(totals.tip, currency)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between pt-1 text-base font-medium text-foreground">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCurrency(totals.total, currency)}</dd>
              </div>
            </dl>
            {totals.belowMinimum ? <p className="mt-3 text-xs text-warning">Minimum order for {zone?.name} is {formatCurrency(totals.minOrder, currency)}.</p> : null}
            <Button size="lg" fullWidth className="mt-5" disabled={totals.belowMinimum} onClick={place}>
              Place order · {formatCurrency(totals.total, currency)}
            </Button>
            <p className="mt-3 text-center text-xs text-subtle">By paying you agree to the order terms. Allergies: call {tenantPhone} before you order.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
