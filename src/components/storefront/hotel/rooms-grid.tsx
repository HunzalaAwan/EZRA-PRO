'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, BedDouble, Maximize2, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useStaySearch } from '@/hooks/use-stay-search'
import { nightKeys, quoteStay, RATE_PLANS } from '@/lib/hospitality/lodging-settings'
import type { LodgingSettings, RoomType } from '@/lib/hospitality/types'
import { staySearchQuery } from '@/lib/stay-search'
import { cn, formatCurrency, formatDateShort } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   <RoomsGrid> — every room type for the remembered dates: the rate for
   those nights, what is left, and the door to the room page.
   ========================================================================== */

export interface RoomAvailability {
  roomTypeId: string
  night: string
  booked: number
}

export interface RoomsGridProps {
  roomTypes: RoomType[]
  roomCounts: Record<string, number>
  availability: RoomAvailability[]
  settings: LodgingSettings
  currency: CurrencyCode
  slug: string
  todayKey: string
}

export function RoomsGrid({ roomTypes, roomCounts, availability, settings, currency, slug, todayKey }: RoomsGridProps) {
  const { search } = useStaySearch(slug, todayKey)
  const nights = nightKeys(search.checkIn, search.checkOut)
  const booked = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const a of availability) map.set(`${a.roomTypeId}:${a.night}`, a.booked)
    return map
  }, [availability])
  const flexible = settings.ratePlans.find((p) => p.kind === 'flexible') ?? RATE_PLANS[0]
  const guests = search.adults + search.children

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {roomTypes.map((t) => {
        const total = roomCounts[t.id] ?? t.count
        const left = nights.length ? Math.min(...nights.map((n) => total - (booked.get(`${t.id}:${n}`) ?? 0))) : total
        const fits = guests <= t.maxGuests
        const quote = nights.length ? quoteStay({ type: t, plan: flexible, checkIn: search.checkIn, checkOut: search.checkOut, adults: search.adults, children: search.children, extraIds: [], settings }) : null
        const available = left > 0 && fits
        return (
          <article key={t.id} className={cn('group flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-sm transition-all duration-400 ease-[var(--ease-out-expo)]', available ? 'hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg' : 'opacity-75')}>
            <Link href={`/book/${slug}/rooms/${t.slug}?${staySearchQuery(search)}`} className="relative block aspect-[16/10] bg-surface-sunken">
              <Image src={t.imageUrls[0]} alt={t.name} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]" />
              {left > 0 && left <= 2 && fits ? <span className="absolute top-3 left-3 rounded-full bg-surface/90 px-2.5 py-1 text-xs font-medium text-foreground backdrop-blur">Only {left} left</span> : null}
            </Link>
            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">{t.name}</h3>
                  <p className="mt-1 text-sm text-muted">{t.view} view</p>
                </div>
                <div className="shrink-0 text-right">
                  {quote ? (
                    <>
                      <p className="text-lg font-semibold text-foreground tabular-nums">{formatCurrency(quote.nightly, currency)}</p>
                      <p className="text-xs text-subtle">a night · {formatCurrency(quote.roomTotal, currency)} for {quote.nights}</p>
                    </>
                  ) : (
                    <p className="text-lg font-semibold text-foreground tabular-nums">from {formatCurrency(t.baseRate, currency)}</p>
                  )}
                </div>
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted">
                <li className="inline-flex items-center gap-1.5">
                  <Users className="size-4 text-faint" aria-hidden="true" /> Sleeps {t.maxGuests}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <BedDouble className="size-4 text-faint" aria-hidden="true" /> {t.beds.map((b) => `${b.count > 1 ? `${b.count} ` : ''}${b.type}`).join(' + ')}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <Maximize2 className="size-4 text-faint" aria-hidden="true" /> {t.size} m²
                </li>
              </ul>
              <p className="mt-3 line-clamp-2 text-sm text-muted">{t.description}</p>
              <div className="mt-5 flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
                <span className="text-xs text-subtle">
                  {!fits ? `Sleeps ${t.maxGuests}; you are ${guests}` : left === 0 ? `Full ${formatDateShort(`${search.checkIn}T12:00:00`)}–${formatDateShort(`${search.checkOut}T12:00:00`)}` : `${flexible.name} · ${flexible.description.split('.')[0]}`}
                </span>
                <Button asChild size="sm" variant={available ? 'primary' : 'outline'} rightIcon={<ArrowRight aria-hidden="true" />}>
                  <Link href={`/book/${slug}/rooms/${t.slug}?${staySearchQuery(search)}`}>{available ? 'See rates' : 'Other dates'}</Link>
                </Button>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
