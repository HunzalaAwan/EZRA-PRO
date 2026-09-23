'use client'

import * as React from 'react'
import Link from 'next/link'
import { CheckCircle2, Copy, Gift, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { usePricing } from '@/hooks/use-pricing'
import { newGiftCode, type GiftCard } from '@/lib/pricing'
import { cn, formatCurrency } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   Gift cards on the storefront: pick an amount, say who it is for, pay.
   The card lands in the same store the dashboard and checkout read, so it
   can be spent straight away.
   ========================================================================== */

const AMOUNTS = [5000, 10000, 15000, 25000]

export function GiftCardShop({ tenantSlug, tenantName, currency, todayKey }: { tenantSlug: string; tenantName: string; currency: CurrencyCode; todayKey: string }) {
  const { giftCards, setGiftCards } = usePricing(tenantSlug)
  const [amount, setAmount] = React.useState(10000)
  const [custom, setCustom] = React.useState('')
  const [form, setForm] = React.useState({ recipient: '', recipientEmail: '', from: '', fromEmail: '', message: '' })
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [paying, setPaying] = React.useState(false)
  const [card, setCard] = React.useState<GiftCard | null>(null)

  const value = custom ? Math.round(Number(custom) * 100) : amount
  const email = /^\S+@\S+\.\S+$/

  const buy = () => {
    const found: Record<string, string> = {}
    if (!(value >= 2500 && value <= 100000)) found.amount = `Between ${formatCurrency(2500, currency)} and ${formatCurrency(100000, currency)}`
    if (form.recipient.trim().length < 2) found.recipient = 'Who is it for?'
    if (!email.test(form.recipientEmail)) found.recipientEmail = 'Where should we send it?'
    if (form.from.trim().length < 2) found.from = 'Your name'
    if (!email.test(form.fromEmail)) found.fromEmail = 'For your receipt'
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setPaying(true)
    window.setTimeout(() => {
      const expires = new Date(`${todayKey}T12:00:00`)
      expires.setFullYear(expires.getFullYear() + 3)
      const next: GiftCard = {
        code: newGiftCode(),
        initial: value,
        balance: value,
        purchaser: form.from.trim(),
        recipient: form.recipient.trim(),
        recipientEmail: form.recipientEmail.trim(),
        message: form.message.trim() || undefined,
        issuedAt: todayKey,
        expiresAt: expires.toISOString().slice(0, 10),
        status: 'active',
      }
      setGiftCards([next, ...giftCards])
      setCard(next)
      setPaying(false)
      window.scrollTo({ top: 0 })
    }, 1100)
  }

  const preview = (
    <div className="relative aspect-[1.6] overflow-hidden rounded-2xl bg-primary p-6 text-on-primary shadow-lg">
      <p className="text-sm font-semibold tracking-wide opacity-90">{tenantName}</p>
      <p className="mt-6 font-display text-4xl font-semibold tabular-nums">{formatCurrency(card?.initial ?? value, currency)}</p>
      <p className="mt-2 text-sm opacity-90">For {card?.recipient || form.recipient || 'someone lucky'}</p>
      {card ? <p className="absolute bottom-5 left-6 font-mono text-sm tracking-widest">{card.code}</p> : null}
      <Gift className="absolute right-6 bottom-5 size-8 opacity-80" aria-hidden="true" />
    </div>
  )

  if (card) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 pb-24 pt-28 sm:px-6">
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <CheckCircle2 className="size-5" aria-hidden="true" />
          Gift card sent
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{card.recipient} has a gift from you</h1>
        <p className="mt-2 text-muted">We emailed it to {card.recipientEmail} and your receipt to {form.fromEmail}. It is valid for three years on anything we run.</p>
        <div className="mt-6">{preview}</div>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            leftIcon={<Copy />}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(card.code)
                toast.success('Code copied')
              } catch {
                toast.error('Could not copy the code')
              }
            }}
          >
            Copy code
          </Button>
          <Button asChild>
            <Link href={`/book/${tenantSlug}`}>Browse experiences</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-24 pt-28 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.12em] text-faint uppercase">Gift cards</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Give a day on the water</h1>
      <p className="mt-2 max-w-2xl text-muted">Good for any trip, rental or lesson with {tenantName}, for three years. Sent by email, instantly or on the day you choose.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault()
            buy()
          }}
        >
          <Field label="Amount" error={errors.amount}>
            <div className="flex flex-wrap gap-2">
              {AMOUNTS.map((entry) => (
                <button
                  key={entry}
                  type="button"
                  aria-pressed={!custom && amount === entry}
                  onClick={() => { setAmount(entry); setCustom('') }}
                  className={cn('rounded-xl border px-5 py-3 text-base font-semibold tabular-nums', !custom && amount === entry ? 'border-primary bg-primary-soft text-primary' : 'border-line hover:border-line-strong')}
                >
                  {formatCurrency(entry, currency)}
                </button>
              ))}
              <Input className="w-36" type="number" min={25} max={1000} placeholder="Other" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Other amount" />
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Their name" required error={errors.recipient}>{(control) => <Input {...control} value={form.recipient} onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))} />}</Field>
            <Field label="Their email" required error={errors.recipientEmail}>{(control) => <Input {...control} type="email" value={form.recipientEmail} onChange={(e) => setForm((f) => ({ ...f, recipientEmail: e.target.value }))} />}</Field>
            <Field label="Your name" required error={errors.from}>{(control) => <Input {...control} value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} />}</Field>
            <Field label="Your email" required error={errors.fromEmail}>{(control) => <Input {...control} type="email" value={form.fromEmail} onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))} />}</Field>
          </div>
          <Field label="A note for them" optional>{(control) => <Textarea {...control} rows={3} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value.slice(0, 300) }))} placeholder="Happy birthday! Go and see the turtles." />}</Field>
          <Button type="submit" size="lg" loading={paying} leftIcon={<Lock aria-hidden="true" />} className="sm:w-fit">
            Pay {formatCurrency(value > 0 ? value : 0, currency)}
          </Button>
        </form>
        <aside className="flex flex-col gap-3">
          {preview}
          {form.message ? <p className="rounded-xl bg-surface-sunken px-4 py-3 text-sm text-muted">&ldquo;{form.message}&rdquo;</p> : null}
        </aside>
      </div>
    </div>
  )
}
