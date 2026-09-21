'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, BedDouble, Check, Maximize2, Users } from 'lucide-react'

import { StaySearch } from '@/components/storefront/hotel/stay-search'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useStaySearch } from '@/hooks/use-stay-search'
import { nightKeys, quoteStay } from '@/lib/hospitality/lodging-settings'
import type { LodgingSettings, RoomType } from '@/lib/hospitality/types'
import { staySearchQuery, type StaySearch as StaySearchValue } from '@/lib/stay-search'
import { cn, formatCurrency, formatDateShort } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   <RoomDetail> — one room type: the pictures, the facts, and a booking
   card that prices every plan for the remembered dates.
   ========================================================================== */

export interface RoomDetailProps {
  roomType: RoomType
  otherTypes: RoomType[]
  settings: LodgingSettings
  /** Booked rooms per night for this type. */
  booked: { night: string; booked: number }[]
  roomCount: number
  currency: CurrencyCode
  slug: string
  todayKey: string
  /** From the URL, applied once on mount. */
  initial: Partial<StaySearchValue>
}

export function RoomDetail({ roomType: t, otherTypes, settings, booked, roomCount, currency, slug, todayKey, initial }: RoomDetailProps) {
  const { search, update } = useStaySearch(slug, todayKey)
  const [planId, setPlanId] = React.useState(settings.ratePlans[0].id)
  const [extraIds, setExtraIds] = React.useState<string[]>([])
  const applied = React.useRef(false)

  React.useEffect(() => {
    if (applied.current) return
    applied.current = true
    if (initial.checkIn && initial.checkOut) update({ checkIn: initial.checkIn, checkOut: initial.checkOut, adults: initial.adults ?? search.adults, children: initial.children ?? search.children })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const nights = nightKeys(search.checkIn, search.checkOut)
  const bookedByNight = new Map(booked.map((b) => [b.night, b.booked]))
  const left = nights.length ? Math.min(...nights.map((n) => roomCount - (bookedByNight.get(n) ?? 0))) : roomCount
  const guests = search.adults + search.children
  const fits = guests <= t.maxGuests
  const plans = settings.ratePlans.filter((p) => nights.length >= p.minNights)
  const plan = plans.find((p) => p.id === planId) ?? plans[0]
  React.useEffect(() => {
    if (plan && plan.id !== planId) setPlanId(plan.id)
  }, [plan, planId])
  const quote = plan && nights.length ? quoteStay({ type: t, plan, checkIn: search.checkIn, checkOut: search.checkOut, adults: search.adults, children: search.children, extraIds, settings }) : null
  const bookable = left > 0 && fits && quote !== null
  const href = `/book/${slug}/stay?type=${t.slug}&${staySearchQuery(search)}&plan=${plan?.id ?? ''}${extraIds.length ? `&extras=${extraIds.join(',')}` : ''}`

  return (
    <div className="mx-auto w-full max-w-[88rem] px-4 pt-24 pb-20 sm:px-6 sm:pt-28 lg:px-10">
      <Link href={`/book/${slug}#rooms`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> All rooms
      </Link>

      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="min-w-0">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-surface-sunken sm:aspect-auto sm:min-h-[26rem]">
              <Image src={t.imageUrls[0]} alt={t.name} fill priority sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
            </div>
            <div className="relative hidden overflow-hidden rounded-3xl bg-surface-sunken sm:block">{t.imageUrls[1] ? <Image src={t.imageUrls[1]} alt="" fill sizes="30vw" className="object-cover" /> : null}</div>
          </div>

          <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{t.name}</h1>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            <li className="inline-flex items-center gap-1.5">
              <Users className="size-4 text-faint" aria-hidden="true" /> Sleeps {t.maxGuests}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <BedDouble className="size-4 text-faint" aria-hidden="true" /> {t.beds.map((b) => `${b.count > 1 ? `${b.count} ` : ''}${b.type}`).join(' + ')}
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Maximize2 className="size-4 text-faint" aria-hidden="true" /> {t.size} m² · {t.view} view
            </li>
          </ul>
          <p className="mt-6 max-w-[64ch] text-base leading-relaxed text-muted">{t.description}</p>

          <h2 className="mt-10 text-lg font-semibold tracking-tight text-foreground">In the room</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {t.amenities.map((a) => (
              <li key={a} className="inline-flex items-center gap-2 text-sm text-foreground">
                <Check className="size-4 text-success" aria-hidden="true" /> {a}
              </li>
            ))}
          </ul>

          <h2 className="mt-10 text-lg font-semibold tracking-tight text-foreground">Good to know</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-surface-sunken p-4">
              <dt className="text-xs text-subtle">Check-in and out</dt>
              <dd className="mt-1 text-sm text-foreground tabular-nums">
                From {settings.checkInFrom} · by {settings.checkOutBy}
              </dd>
            </div>
            <div className="rounded-2xl bg-surface-sunken p-4">
              <dt className="text-xs text-subtle">{settings.cityTaxLabel}</dt>
              <dd className="mt-1 text-sm text-foreground">{formatCurrency(settings.cityTaxPerNight, currency)} per adult per night, added at booking</dd>
            </div>
            <div className="rounded-2xl bg-surface-sunken p-4">
              <dt className="text-xs text-subtle">Weekends</dt>
              <dd className="mt-1 text-sm text-foreground">Minimum {settings.minStayWeekends} nights when a Friday or Saturday is included</dd>
            </div>
          </dl>

          {otherTypes.length ? (
            <>
              <h2 className="mt-10 text-lg font-semibold tracking-tight text-foreground">Other rooms</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                {otherTypes.map((o) => (
                  <li key={o.id}>
                    <Link href={`/book/${slug}/rooms/${o.slug}?${staySearchQuery(search)}`} className="group flex gap-3 rounded-2xl border border-line bg-surface p-2.5 transition-colors hover:border-primary/45">
                      <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-surface-sunken">
                        <Image src={o.imageUrls[0]} alt="" fill sizes="64px" className="object-cover" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary">{o.name}</span>
                        <span className="block text-xs text-subtle">from {formatCurrency(o.baseRate, currency)} · sleeps {o.maxGuests}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>

        {/* ---------- booking card ---------- */}
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
            <StaySearch slug={slug} todayKey={todayKey} cta={false} className="border-0 p-0 shadow-none sm:flex-col sm:items-stretch" />

            <p className={cn('mt-3 text-xs', left === 0 ? 'text-danger' : left <= 2 ? 'text-warning' : 'text-subtle')}>
              {!fits ? `This room sleeps ${t.maxGuests}.` : left === 0 ? `No ${t.name} left for ${formatDateShort(`${search.checkIn}T12:00:00`)}–${formatDateShort(`${search.checkOut}T12:00:00`)}.` : `${left} of ${roomCount} left for these dates.`}
            </p>

            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-foreground">Rate</legend>
              <div className="mt-2 flex flex-col gap-2">
                {plans.map((p) => {
                  const q = nights.length ? quoteStay({ type: t, plan: p, checkIn: search.checkIn, checkOut: search.checkOut, adults: search.adults, children: search.children, extraIds: [], settings }) : null
                  const active = p.id === plan?.id
                  return (
                    <button key={p.id} type="button" aria-pressed={active} onClick={() => setPlanId(p.id)} className={cn('flex items-start justify-between gap-3 rounded-xl border p-3 text-left transition-colors', active ? 'border-primary bg-primary-soft/40' : 'border-line hover:border-line-strong')}>
                      <span className="min-w-0">
                        <span className="block text-sm text-foreground">{p.name}</span>
                        <span className="block text-xs text-muted">{p.description}</span>
                      </span>
                      {q ? (
                        <span className="shrink-0 text-right">
                          <span className="block text-sm text-foreground tabular-nums">{formatCurrency(q.roomTotal, currency)}</span>
                          <span className="block text-xs text-subtle tabular-nums">{formatCurrency(q.nightly, currency)} a night</span>
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <fieldset className="mt-5">
              <legend className="text-sm font-medium text-foreground">Add to the stay</legend>
              <div className="mt-2 flex flex-col gap-1.5">
                {settings.extras
                  .filter((e) => e.price > 0 && !(plan?.breakfastIncluded && e.id === 'ex_breakfast'))
                  .map((e) => (
                    <label key={e.id} className="flex items-center gap-2.5 text-sm text-foreground">
                      <Checkbox checked={extraIds.includes(e.id)} onCheckedChange={(v) => setExtraIds(v ? [...extraIds, e.id] : extraIds.filter((x) => x !== e.id))} />
                      <span className="min-w-0 flex-1 truncate">{e.label}</span>
                      <span className="text-xs text-subtle tabular-nums">
                        {formatCurrency(e.price, currency)} {e.per === 'person' ? 'pp/night' : e.per === 'night' ? '/night' : ''}
                      </span>
                    </label>
                  ))}
              </div>
            </fieldset>

            {quote ? (
              <dl className="mt-5 flex flex-col gap-1 border-t border-line-subtle pt-4 text-sm text-muted">
                <div className="flex justify-between">
                  <dt>
                    {quote.nights} {quote.nights === 1 ? 'night' : 'nights'} × {formatCurrency(quote.nightly, currency)}
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
                <p className="text-xs text-subtle">{plan?.kind === 'non_refundable' ? 'Paid in full now.' : `${formatCurrency(quote.dueNow, currency)} now, the rest at the hotel.`}</p>
              </dl>
            ) : null}

            <Button asChild size="lg" fullWidth className={cn('mt-5', !bookable && 'pointer-events-none opacity-50')} rightIcon={<ArrowRight aria-hidden="true" />}>
              <Link href={href} aria-disabled={!bookable}>
                {bookable ? 'Book this room' : 'Pick other dates'}
              </Link>
            </Button>
            <p className="mt-3 text-center text-xs text-subtle">{plan?.cancellation}</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
