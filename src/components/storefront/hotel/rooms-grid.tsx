'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { useStaySearch } from '@/hooks/use-stay-search'
import { nightKeys, quoteStay, RATE_PLANS } from '@/lib/hospitality/lodging-settings'
import type { LodgingSettings, RoomType } from '@/lib/hospitality/types'
import { staySearchQuery } from '@/lib/stay-search'
import { cn, formatCurrency, formatDateShort } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   <RoomsGrid> — every room type for the remembered dates, as the same kind
   of card the menu and the experiences use: picture with a badge, name, a
   line about it, pills for the facts, the price and a button.
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
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {roomTypes.map((t) => {
        const total = roomCounts[t.id] ?? t.count
        const left = nights.length ? Math.min(...nights.map((n) => total - (booked.get(`${t.id}:${n}`) ?? 0))) : total
        const fits = guests <= t.maxGuests
        const quote = nights.length ? quoteStay({ type: t, plan: flexible, checkIn: search.checkIn, checkOut: search.checkOut, adults: search.adults, children: search.children, extraIds: [], settings }) : null
        const available = left > 0 && fits
        const href = `/book/${slug}/rooms/${t.slug}?${staySearchQuery(search)}`
        const badge = !fits ? `Sleeps ${t.maxGuests}` : left === 0 ? 'Full for these dates' : left <= 2 ? `Only ${left} left` : t.id.endsWith('river') ? 'River view' : null
        return (
          <li key={t.id} className={cn('group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors', available ? 'hover:border-line-strong' : 'opacity-75')}>
            <Link href={href} className="relative block aspect-[4/3] bg-surface-sunken">
              <Image src={t.imageUrls[0]} alt={t.name} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw" className="object-cover transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]" />
              {badge ? <span className={cn('absolute top-2.5 left-2.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold', available ? 'bg-primary text-on-primary' : 'bg-surface/95 text-foreground')}>{badge}</span> : null}
            </Link>
            <div className="flex flex-1 flex-col p-4">
              <h3 className="text-[0.9375rem] font-semibold leading-snug text-foreground">{t.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{t.description}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {t.highlights.slice(0, 3).map((h) => (
                  <span key={h} className="rounded-full bg-surface-sunken px-2 py-0.5 text-[0.6875rem] font-medium text-muted">
                    {h}
                  </span>
                ))}
              </div>
              <div className="mt-auto flex items-end justify-between gap-2 pt-4">
                <p className="text-[0.9375rem] font-semibold text-foreground tabular-nums">
                  {quote ? formatCurrency(quote.nightly, currency) : formatCurrency(t.baseRate, currency)} <span className="text-xs font-normal text-subtle">a night</span>
                  {quote ? <span className="block text-xs font-normal text-subtle">{formatCurrency(quote.roomTotal, currency)} for {quote.nights} · {formatDateShort(`${search.checkIn}T12:00:00`)}</span> : null}
                </p>
                <Button asChild size="sm" variant={available ? 'primary' : 'outline'} rightIcon={<ArrowRight aria-hidden="true" />}>
                  <Link href={href}>{available ? 'See rates' : 'Other dates'}</Link>
                </Button>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
