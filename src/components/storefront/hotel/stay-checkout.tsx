'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, CalendarPlus, Check, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { quoteStay } from '@/lib/hospitality/lodging-settings'
import type { LodgingSettings, RatePlan, RoomType } from '@/lib/hospitality/types'
import type { StaySearch } from '@/lib/stay-search'
import { formatCurrency, formatDateLong, fromDateKey } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   <StayCheckout> — the room, the dates and the price on one side; who is
   coming and how they pay on the other. Confirms with a reference and a
   calendar file.
   ========================================================================== */

export interface StayCheckoutProps {
  slug: string
  tenantName: string
  tenantPhone: string
  addressLine: string
  roomType: RoomType
  plan: RatePlan
  extraIds: string[]
  search: StaySearch
  settings: LodgingSettings
  currency: CurrencyCode
}

interface Details {
  name: string
  email: string
  phone: string
  eta: string
  requests: string
  card: string
  expiry: string
  cvc: string
}

const ETAS = ['15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', 'after 22:00', 'not sure']

export function StayCheckout({ slug, tenantName, tenantPhone, addressLine, roomType: t, plan, extraIds, search, settings, currency }: StayCheckoutProps) {
  const [details, setDetails] = React.useState<Details>({ name: '', email: '', phone: '', eta: '16:00', requests: '', card: '', expiry: '', cvc: '' })
  const [errors, setErrors] = React.useState<Partial<Record<keyof Details, string>>>({})
  const [confirmed, setConfirmed] = React.useState<{ reference: string } | null>(null)

  const quote = quoteStay({ type: t, plan, checkIn: search.checkIn, checkOut: search.checkOut, adults: search.adults, children: search.children, extraIds, settings })

  const set = (key: keyof Details, value: string) => {
    setDetails((d) => ({ ...d, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }
  const validate = () => {
    const next: Partial<Record<keyof Details, string>> = {}
    if (details.name.trim().length < 2) next.name = 'The name on the reservation.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(details.email)) next.email = 'A real email for the confirmation.'
    if (details.phone.replace(/\D/g, '').length < 7) next.phone = 'So the desk can reach you on the day.'
    if (details.card.replace(/\D/g, '').length < 15) next.card = 'Card number looks short.'
    if (!/^\d{2}\s?\/\s?\d{2}$/.test(details.expiry.trim())) next.expiry = 'MM / YY'
    if (details.cvc.replace(/\D/g, '').length < 3) next.cvc = 'Three digits.'
    setErrors(next)
    return Object.keys(next).length === 0
  }
  const confirm = () => {
    if (!validate()) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setConfirmed({ reference: `${tenantName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}` })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const ics = () => {
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `DTSTART;VALUE=DATE:${search.checkIn.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${search.checkOut.replace(/-/g, '')}`, `SUMMARY:${t.name} at ${tenantName}`, `LOCATION:${addressLine}`, 'END:VEVENT', 'END:VCALENDAR'].join('\n')
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`
  }

  const summary = (
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
      <div className="flex gap-4">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-surface-sunken">
          <Image src={t.imageUrls[0]} alt={t.name} fill sizes="96px" className="object-cover" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-lg font-semibold tracking-tight text-foreground">{t.name}</p>
          <p className="mt-0.5 text-sm text-muted">
            {formatDateLong(fromDateKey(search.checkIn))} → {formatDateLong(fromDateKey(search.checkOut))}
          </p>
          <p className="text-sm text-muted">
            {quote.nights} {quote.nights === 1 ? 'night' : 'nights'} · {search.adults} {search.adults === 1 ? 'adult' : 'adults'}
            {search.children ? ` · ${search.children} ${search.children === 1 ? 'child' : 'children'}` : ''} · {plan.name}
          </p>
        </div>
      </div>
      <dl className="mt-5 flex flex-col gap-1 border-t border-line-subtle pt-4 text-sm text-muted">
        <div className="flex justify-between">
          <dt>
            {quote.nights} × {formatCurrency(quote.nightly, currency)}
          </dt>
          <dd className="tabular-nums">{formatCurrency(quote.roomTotal, currency)}</dd>
        </div>
        {quote.extras.map((e) => (
          <div key={e.id} className="flex justify-between">
            <dt>{e.label}</dt>
            <dd className="tabular-nums">{formatCurrency(e.amount, currency)}</dd>
          </div>
        ))}
        <div className="flex justify-between">
          <dt>{settings.cityTaxLabel}</dt>
          <dd className="tabular-nums">{formatCurrency(quote.cityTax, currency)}</dd>
        </div>
        <div className="flex justify-between pt-1 text-base font-medium text-foreground">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatCurrency(quote.total, currency)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Charged now</dt>
          <dd className="tabular-nums">{formatCurrency(quote.dueNow, currency)}</dd>
        </div>
        {quote.total - quote.dueNow > 0 ? (
          <div className="flex justify-between">
            <dt>At the hotel</dt>
            <dd className="tabular-nums">{formatCurrency(quote.total - quote.dueNow, currency)}</dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-3 text-xs text-subtle">{plan.cancellation}</p>
    </div>
  )

  if (confirmed) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-28 pb-20 sm:px-6">
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-10">
          <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
            <Check className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground">You are booked, {details.name.trim().split(' ')[0]}</h1>
          <p className="mt-2 text-base text-muted">
            {t.name}, {formatDateLong(fromDateKey(search.checkIn))} to {formatDateLong(fromDateKey(search.checkOut))}. Reference {confirmed.reference}. Confirmation sent to {details.email}.
          </p>
          <div className="mt-6">{summary}</div>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-subtle">Check-in</dt>
              <dd className="mt-0.5 text-foreground">From {settings.checkInFrom} · you said around {details.eta}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Where</dt>
              <dd className="mt-0.5 text-foreground">{addressLine}</dd>
            </div>
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" leftIcon={<CalendarPlus aria-hidden="true" />}>
              <a href={ics()} download={`${tenantName}-stay.ics`}>
                Add to calendar
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/book/${slug}#dining`}>Book a table for the first night</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-24 pb-20 sm:px-6 sm:pt-28">
      <Link href={`/book/${slug}/rooms/${t.slug}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to the room
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Complete your booking</h1>
      <p className="mt-2 text-base text-muted">Direct with {tenantName}: the lowest rate we publish, and a human at the desk if anything changes.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-8">
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="text-base font-semibold text-foreground">Who is staying</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Lead guest" required error={errors.name} className="sm:col-span-2">{(c) => <Input {...c} value={details.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" placeholder="As it appears on your passport" />}</Field>
              <Field label="Email" required error={errors.email}>{(c) => <Input {...c} type="email" value={details.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" placeholder="you@example.com" />}</Field>
              <Field label="Phone" required error={errors.phone}>{(c) => <Input {...c} value={details.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" inputMode="tel" placeholder="+351 …" />}</Field>
              <Field label="Arriving around" description={`Check-in is from ${settings.checkInFrom}. We keep the room for late arrivals.`}>
                <Select value={details.eta} onValueChange={(v) => set('eta', v)}>
                  <SelectTrigger aria-label="Arrival time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ETAS.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Requests" optional description="High floor, quiet room, a cot, an anniversary.">{(c) => <Textarea {...c} rows={2} value={details.requests} onChange={(e) => set('requests', e.target.value)} />}</Field>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Lock className="size-4 text-success" aria-hidden="true" /> Payment
            </h2>
            <p className="mt-1 text-sm text-muted">{plan.kind === 'non_refundable' ? `The full ${formatCurrency(quote.total, currency)} is charged now.` : `${formatCurrency(quote.dueNow, currency)} is charged now as a deposit. The rest is settled at checkout.`}</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_7rem_6rem]">
              <Field label="Card number" required error={errors.card}>{(c) => <Input {...c} value={details.card} onChange={(e) => set('card', e.target.value.replace(/[^\d ]/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').slice(0, 19))} inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" />}</Field>
              <Field label="Expiry" required error={errors.expiry}>{(c) => <Input {...c} value={details.expiry} onChange={(e) => set('expiry', e.target.value.replace(/[^\d]/g, '').replace(/(\d{2})(?=\d)/, '$1 / ').slice(0, 7))} inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" />}</Field>
              <Field label="CVC" required error={errors.cvc}>{(c) => <Input {...c} value={details.cvc} onChange={(e) => set('cvc', e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="cc-csc" placeholder="123" />}</Field>
            </div>
            <Button size="lg" fullWidth className="mt-6" onClick={confirm}>
              Confirm and pay {formatCurrency(quote.dueNow, currency)}
            </Button>
            <p className="mt-3 text-center text-xs text-subtle">
              By confirming you accept the rate conditions and the house rules. Questions? {tenantPhone}.
            </p>
          </section>
        </div>
        <aside className="lg:sticky lg:top-28 lg:self-start">{summary}</aside>
      </div>
    </div>
  )
}
