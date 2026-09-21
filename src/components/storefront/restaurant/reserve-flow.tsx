'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarPlus, Check, Phone } from 'lucide-react'

import { ReserveWidget } from '@/components/storefront/restaurant/reserve-widget'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { OCCASION_LABEL, type DiningSettings, type Occasion, type ServiceKey } from '@/lib/hospitality/types'
import { cn, formatCurrency, formatDateLong, fromDateKey } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   <ReserveFlow> — the reservation page: the widget again (so the guest can
   change their mind), their details, the deposit line if it applies, and a
   confirmation with a calendar file.
   ========================================================================== */

export interface ReserveFlowProps {
  slug: string
  tenantName: string
  tenantPhone: string
  addressLine: string
  settings: DiningSettings
  currency: CurrencyCode
  todayKey: string
  nowTime: string
  initial: { date?: string; time?: string; party?: number }
}

interface Details {
  name: string
  email: string
  phone: string
  occasion: Occasion | 'none'
  notes: string
  card: string
}

export function ReserveFlow({ slug, tenantName, tenantPhone, addressLine, settings, currency, todayKey, nowTime, initial }: ReserveFlowProps) {
  const [selection, setSelection] = React.useState<{ date: string; party: number; time: string; period: ServiceKey } | null>(initial.date && initial.time && initial.party ? { date: initial.date, time: initial.time, party: initial.party, period: 'dinner' } : null)
  const [details, setDetails] = React.useState<Details>({ name: '', email: '', phone: '', occasion: 'none', notes: '', card: '' })
  const [errors, setErrors] = React.useState<Partial<Record<keyof Details, string>>>({})
  const [confirmed, setConfirmed] = React.useState<{ reference: string } | null>(null)

  const deposit = selection && selection.party >= settings.depositFromParty ? settings.depositPerCover * selection.party : 0
  const set = (key: keyof Details, value: string) => {
    setDetails((d) => ({ ...d, [key]: value }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const validate = () => {
    const next: Partial<Record<keyof Details, string>> = {}
    if (details.name.trim().length < 2) next.name = 'The name the table is under.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(details.email)) next.email = 'A real email for the confirmation.'
    if (details.phone.replace(/\D/g, '').length < 7) next.phone = 'We text a reminder the day before.'
    if (deposit && details.card.replace(/\D/g, '').length < 15) next.card = 'A card to hold the deposit.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const confirm = () => {
    if (!selection) return
    if (!validate()) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setConfirmed({ reference: `${tenantName.slice(0, 2).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}` })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const ics = () => {
    if (!selection) return '#'
    const start = `${selection.date.replace(/-/g, '')}T${selection.time.replace(':', '')}00`
    const endMin = Number(selection.time.slice(0, 2)) * 60 + Number(selection.time.slice(3)) + 120
    const end = `${selection.date.replace(/-/g, '')}T${String(Math.floor(endMin / 60)).padStart(2, '0')}${String(endMin % 60).padStart(2, '0')}00`
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:Table for ${selection.party} at ${tenantName}`, `LOCATION:${addressLine}`, 'END:VEVENT', 'END:VCALENDAR'].join('\n')
    return `data:text/calendar;charset=utf-8,${encodeURIComponent(body)}`
  }

  if (confirmed && selection) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-28 pb-20 sm:px-6">
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-10">
          <span className="grid size-12 place-items-center rounded-full bg-success-soft text-success">
            <Check className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight text-foreground">Your table is booked</h1>
          <p className="mt-2 text-base text-muted">
            {formatDateLong(fromDateKey(selection.date))} at {selection.time}, table for {selection.party}, under {details.name.trim()}. Reference {confirmed.reference}.
          </p>
          <dl className="mt-6 grid gap-3 rounded-2xl bg-surface-sunken p-5 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-subtle">Where</dt>
              <dd className="mt-0.5 text-foreground">{addressLine}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Held until</dt>
              <dd className="mt-0.5 text-foreground">{settings.graceMinutes} minutes past {selection.time}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Deposit</dt>
              <dd className="mt-0.5 text-foreground">{deposit ? `${formatCurrency(deposit, currency)} held, refunded on arrival` : 'None'}</dd>
            </div>
            <div>
              <dt className="text-xs text-subtle">Changes</dt>
              <dd className="mt-0.5 text-foreground">Free up to two hours before, from the link in your email</dd>
            </div>
          </dl>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" leftIcon={<CalendarPlus aria-hidden="true" />}>
              <a href={ics()} download={`${tenantName}-table.ics`}>
                Add to calendar
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={`/book/${slug}#menu`}>Order ahead for the table</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-24 pb-20 sm:px-6 sm:pt-28">
      <Link href={`/book/${slug}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> {tenantName}
      </Link>
      <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Reserve a table</h1>
      <p className="mt-2 text-base text-muted">
        {selection ? `${formatDateLong(fromDateKey(selection.date))} at ${selection.time}, ${selection.party} ${selection.party === 1 ? 'guest' : 'guests'}.` : 'Pick a date, a time and how many of you.'}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-base font-semibold text-foreground">When</h2>
          <div className="mt-4">
            <ReserveWidget settings={settings} slug={slug} todayKey={todayKey} nowTime={nowTime} currency={currency} initial={initial} embedded onChange={setSelection} />
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <h2 className="text-base font-semibold text-foreground">Who</h2>
          <Field label="Name" required error={errors.name}>{(c) => <Input {...c} value={details.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" placeholder="The name the table is under" />}</Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email" required error={errors.email}>{(c) => <Input {...c} type="email" value={details.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" placeholder="you@example.com" />}</Field>
            <Field label="Phone" required error={errors.phone}>{(c) => <Input {...c} value={details.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" inputMode="tel" placeholder="+30 …" />}</Field>
          </div>
          <Field label="Occasion" optional>
            <Select value={details.occasion} onValueChange={(v) => set('occasion', v)}>
              <SelectTrigger aria-label="Occasion">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Just dinner</SelectItem>
                {(Object.keys(OCCASION_LABEL) as Occasion[]).map((o) => (
                  <SelectItem key={o} value={o}>
                    {OCCASION_LABEL[o]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Anything we should know" optional description="Allergies, a pram, a wheelchair, a candle in the dessert.">{(c) => <Textarea {...c} rows={3} value={details.notes} onChange={(e) => set('notes', e.target.value)} />}</Field>

          {deposit ? (
            <div className="rounded-xl bg-surface-sunken p-4">
              <p className="text-sm text-foreground">
                Parties of {settings.depositFromParty} or more leave a deposit of {formatCurrency(settings.depositPerCover, currency)} per guest: {formatCurrency(deposit, currency)}.
              </p>
              <p className="mt-1 text-xs text-subtle">Held on your card, released when you arrive. Charged only if nobody turns up.</p>
              <Field label="Card" required error={errors.card} className="mt-3">{(c) => <Input {...c} value={details.card} onChange={(e) => set('card', e.target.value.replace(/[^\d ]/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').slice(0, 19))} inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" />}</Field>
            </div>
          ) : null}

          <Button size="lg" fullWidth disabled={!selection} onClick={confirm} className={cn(!selection && 'opacity-60')}>
            {selection ? `Confirm table for ${selection.party} · ${selection.time}` : 'Pick a time first'}
          </Button>
          <p className="text-center text-xs text-subtle">
            Larger party or a private room? Call <a href={`tel:${tenantPhone.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-1 text-foreground"><Phone className="size-3" aria-hidden="true" />{tenantPhone}</a>.
          </p>
        </section>
      </div>
    </div>
  )
}
