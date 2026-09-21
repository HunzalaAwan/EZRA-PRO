import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock, MapPin, Phone, Quote, UtensilsCrossed } from 'lucide-react'

import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { RoomsGrid } from '@/components/storefront/hotel/rooms-grid'
import { StaySearch } from '@/components/storefront/hotel/stay-search'
import type { HomeReview } from '@/components/storefront/restaurant/restaurant-home'
import { StarRow } from '@/components/storefront/storefront-hero'
import { StorefrontSection, StorefrontSections } from '@/components/storefront/storefront-sections'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { getLodging, nightKeys } from '@/lib/hospitality'
import type { DiningSettings, Menu } from '@/lib/hospitality/types'
import { addDays, formatCurrency, formatDuration, formatNumber, pluralize, toDateKey } from '@/lib/utils'
import type { Activity, Tenant, User } from '@/types'

/* ==========================================================================
   The hotel storefront — rooms first, then the restaurant downstairs, the
   experiences the house sells, the story, reviews and where to find us.
   ========================================================================== */

export interface HotelHomeProps {
  tenant: Tenant
  menu: Menu
  dining: DiningSettings
  experiences: Activity[]
  reviews: HomeReview[]
  story: { heading: string; body: string[] }
  crew: User[]
  rating: number
  reviewCount: number
  guestsHosted: number
  todayKey: string
}

const WINDOW_DAYS = 90

export function HotelHome({ tenant, menu, dining, experiences, reviews, story, crew, rating, reviewCount, guestsHosted, todayKey }: HotelHomeProps) {
  const base = `/book/${tenant.slug}`
  const lodging = getLodging(tenant)
  const foundedYear = new Date(tenant.createdAt).getFullYear()

  /* ---------- availability for the next ninety nights, compact ---------- */
  const end = toDateKey(addDays(new Date(`${todayKey}T12:00:00`), WINDOW_DAYS))
  const roomCounts: Record<string, number> = {}
  for (const t of lodging.roomTypes) roomCounts[t.id] = lodging.rooms.filter((r) => r.typeId === t.id && r.housekeeping !== 'out_of_order').length
  const cells = new Map<string, { roomTypeId: string; night: string; booked: number }>()
  for (const s of lodging.stays) {
    if (s.status === 'cancelled' || s.status === 'no_show' || s.checkOut < todayKey || s.checkIn > end) continue
    for (const night of nightKeys(s.checkIn, s.checkOut)) {
      if (night < todayKey || night > end) continue
      const key = `${s.roomTypeId}:${night}`
      const cell = cells.get(key) ?? { roomTypeId: s.roomTypeId, night, booked: 0 }
      cell.booked += 1
      cells.set(key, cell)
    }
  }
  const lowest = Math.min(...lodging.roomTypes.map((t) => t.baseRate))
  const popular = menu.items.filter((i) => i.popular && i.status === 'available').slice(0, 4)
  const dinner = dining.periods[dining.periods.length - 1]

  return (
    <StorefrontSections slug={tenant.slug} vertical={tenant.vertical}>
      <StorefrontSection key="hero" id="hero">
        <section className="relative isolate min-h-[36rem] overflow-hidden bg-[#0b1417] text-white">
          {tenant.branding.coverImage ? <Image src={tenant.branding.coverImage} alt="" fill priority sizes="100vw" className="object-cover opacity-70" /> : null}
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,20,23,0.5)_0%,rgba(11,20,23,0.2)_40%,rgba(11,20,23,0.88)_100%)]" />
          <div className="relative mx-auto flex w-full max-w-[88rem] flex-col justify-end px-4 pt-32 pb-10 sm:px-6 sm:pt-40 sm:pb-14 lg:px-10">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-white/70">
              {tenant.city} · {lodging.rooms.length} rooms · check-in from {lodging.settings.checkInFrom}
            </p>
            <h1 className="mt-3 max-w-[16ch] font-display text-[length:clamp(2.5rem,1.4rem_+_3.6vw,4.5rem)] leading-[1.02] font-semibold tracking-tight">{tenant.name}</h1>
            <p className="mt-4 max-w-[48ch] text-base leading-relaxed text-white/80 sm:text-lg">{story.body[0]}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/80">
              <span className="inline-flex items-center gap-2">
                <StarRow value={rating} size="sm" className="text-warning" />
                {rating.toFixed(1)} · {formatNumber(reviewCount)} {pluralize(reviewCount, 'review')}
              </span>
              <span className="hidden text-white/40 sm:inline">·</span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden="true" />
                {tenant.contact.addressLine.split(',')[0]}
              </span>
              <span className="hidden text-white/40 sm:inline">·</span>
              <span>Rooms from {formatCurrency(lowest, tenant.currency)} a night</span>
            </div>
            <div className="mt-8 max-w-4xl">
              <StaySearch slug={tenant.slug} todayKey={todayKey} onDark />
            </div>
          </div>
        </section>
      </StorefrontSection>

      <StorefrontSection key="rooms" id="rooms">
        <section id="rooms" className="scroll-mt-20 bg-background py-14 sm:py-20">
          <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
            <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">Rooms</p>
                <h2 className="mt-2 max-w-[20ch] font-display text-display-sm font-semibold tracking-tight text-foreground">Four kinds of room, all of them quiet</h2>
              </div>
              <p className="max-w-[44ch] text-sm text-muted">Booking direct gets you the lowest rate we publish anywhere, free cancellation on flexible plans, and breakfast on the roof if you pick it.</p>
            </Reveal>
            <div className="mt-8">
              <RoomsGrid roomTypes={lodging.roomTypes} roomCounts={roomCounts} availability={[...cells.values()]} settings={lodging.settings} currency={tenant.currency} slug={tenant.slug} todayKey={todayKey} />
            </div>
          </div>
        </section>
      </StorefrontSection>

      <StorefrontSection key="dining" id="dining">
        <section id="dining" className="scroll-mt-20 border-y border-line-subtle bg-background-subtle py-14 sm:py-20">
          <div className="mx-auto grid w-full max-w-[88rem] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:px-10">
            <Reveal>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">The kitchen</p>
              <h2 className="mt-3 max-w-[20ch] font-display text-display-sm font-semibold tracking-tight text-foreground">Breakfast on the roof, dinner in the kitchen room</h2>
              <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-muted">
                {dining.periods.map((p) => `${p.name} ${p.startTime}–${p.endTime}`).join(' · ')}. Open to guests and the neighbourhood alike; guests can charge everything to the room, or order to it.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button asChild size="lg" leftIcon={<UtensilsCrossed aria-hidden="true" />}>
                  <Link href={`${base}/reserve`}>Reserve a table</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href={`${base}/order`}>Order to your room</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-subtle">
                Last seating {dinner.lastSeating}. Room service until {dining.ordering.delivery.endTime}.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {popular.map((item) => (
                  <li key={item.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
                    {item.imageUrl ? (
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-surface-sunken">
                        <Image src={item.imageUrl} alt={item.name} fill sizes="80px" className="object-cover" />
                      </div>
                    ) : null}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.name}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">{item.description}</p>
                      <p className="mt-1.5 text-xs text-foreground tabular-nums">{formatCurrency(item.price, tenant.currency)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </section>
      </StorefrontSection>

      {experiences.length > 0 ? (
        <StorefrontSection key="experiences" id="experiences">
          <section id="experiences" className="scroll-mt-20 bg-background py-14 sm:py-20">
            <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
              <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">Experiences</p>
                  <h2 className="mt-2 max-w-[22ch] font-display text-display-sm font-semibold tracking-tight text-foreground">What the house puts on</h2>
                </div>
                <p className="max-w-[40ch] text-sm text-muted">Open to guests and visitors. Book with your stay or on the day.</p>
              </Reveal>
              <StaggerGroup stagger={0.06} className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {experiences.slice(0, 4).map((a) => (
                  <StaggerItem key={a.id} direction="up" className="h-full">
                    <Link href={`${base}/${a.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-400 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
                      <div className="relative aspect-[4/3] bg-surface-sunken">{a.media[0] ? <Image src={a.media[0].url} alt={a.media[0].alt ?? a.name} fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" /> : null}</div>
                      <div className="flex flex-1 flex-col p-4">
                        <p className="text-[0.9375rem] font-semibold tracking-tight text-foreground group-hover:text-primary">{a.name}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted">{a.tagline}</p>
                        <div className="mt-3 flex items-center justify-between text-sm">
                          <span className="inline-flex items-center gap-1.5 text-subtle">
                            <Clock className="size-3.5" aria-hidden="true" />
                            {formatDuration(a.durationMinutes)}
                          </span>
                          <span className="text-foreground tabular-nums">from {formatCurrency(a.basePrice, tenant.currency)}</span>
                        </div>
                      </div>
                    </Link>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </div>
          </section>
        </StorefrontSection>
      ) : null}

      <StorefrontSection key="about" id="about">
        <section id="about" className="scroll-mt-20 border-t border-line-subtle bg-background-subtle py-14 sm:py-20">
          <div className="mx-auto grid w-full max-w-[88rem] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16 lg:px-10">
            <Reveal>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">The house</p>
              <h2 className="mt-3 max-w-[20ch] font-display text-display-sm font-semibold tracking-tight text-foreground">{story.heading}</h2>
              <div className="mt-5 space-y-4">
                {story.body.map((paragraph) => (
                  <p key={paragraph} className="text-base leading-relaxed text-muted">
                    {paragraph}
                  </p>
                ))}
              </div>
              <dl className="mt-8 grid grid-cols-3 gap-6 border-t border-line pt-8">
                {[
                  { value: `${2026 - foundedYear}`, label: 'Years open' },
                  { value: formatNumber(guestsHosted, { compact: true }), label: 'Guests hosted' },
                  { value: rating.toFixed(2), label: 'Average rating' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dd className="font-display text-3xl font-semibold tracking-tight text-foreground tabular-nums">{stat.value}</dd>
                    <dt className="mt-1 text-xs font-medium uppercase tracking-[0.1em] text-subtle">{stat.label}</dt>
                  </div>
                ))}
              </dl>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">At the desk</h3>
                <p className="mt-1.5 text-sm text-muted">The people who will know your name by the second morning.</p>
                <ul className="mt-6 space-y-5">
                  {crew.map((member) => (
                    <li key={member.id} className="flex items-start gap-3.5">
                      <Avatar name={member.name} src={member.avatarUrl} size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{member.name}</p>
                        <p className="truncate text-xs text-subtle">{member.title}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>
      </StorefrontSection>

      {reviews.length > 0 ? (
        <StorefrontSection key="reviews" id="reviews">
          <section id="reviews" className="scroll-mt-20 bg-background py-14 sm:py-20">
            <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
              <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">Guest reviews</p>
                  <h2 className="mt-3 font-display text-display-sm font-semibold tracking-tight text-foreground">{rating.toFixed(2)} out of 5</h2>
                </div>
                <p className="text-sm text-muted">
                  from {formatNumber(reviewCount)} verified {pluralize(reviewCount, 'review')}
                </p>
              </Reveal>
              <StaggerGroup stagger={0.06} className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {reviews.map((review) => (
                  <StaggerItem key={review.id} direction="up" className="h-full">
                    <figure className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm">
                      <Quote className="size-5 text-primary/45" aria-hidden="true" />
                      <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-muted">“{review.text}”</blockquote>
                      <StarRow value={review.rating} size="sm" className="mt-4 text-warning" />
                      <figcaption className="mt-3 flex items-center gap-3 border-t border-line-subtle pt-4">
                        <Avatar name={review.name} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-foreground">{review.name}</span>
                          <span className="block truncate text-xs text-subtle">
                            {review.country} · {review.dateLabel}
                          </span>
                        </span>
                      </figcaption>
                    </figure>
                  </StaggerItem>
                ))}
              </StaggerGroup>
            </div>
          </section>
        </StorefrontSection>
      ) : null}

      <StorefrontSection key="contact" id="contact">
        <section id="contact" className="scroll-mt-20 border-t border-line-subtle bg-background-subtle py-14 sm:py-20">
          <div className="mx-auto grid w-full max-w-[88rem] gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-10">
            <Reveal>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">Getting here</p>
              <h2 className="mt-3 max-w-[16ch] font-display text-display-sm font-semibold tracking-tight text-foreground">A corner house above the river</h2>
              <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-muted">Ten minutes on foot from Santa Apolónia station, twenty-five by taxi from the airport. The lane is too narrow for cars, so we meet you at the bottom with a trolley.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" leftIcon={<Phone aria-hidden="true" />}>
                  <a href={`tel:${tenant.contact.phone.replace(/[^+\d]/g, '')}`}>{tenant.contact.phone}</a>
                </Button>
                <Button asChild size="lg" variant="outline" rightIcon={<ArrowRight aria-hidden="true" />}>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${tenant.name}, ${tenant.contact.addressLine}`)}`} target="_blank" rel="noreferrer">
                    Directions
                  </a>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <dl className="grid gap-5 rounded-2xl border border-line bg-surface p-6 shadow-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">Address</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-foreground">{tenant.contact.addressLine}</dd>
                </div>
                <div>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">Check-in and out</dt>
                  <dd className="mt-1 text-sm text-foreground tabular-nums">
                    From {lodging.settings.checkInFrom} · by {lodging.settings.checkOutBy}
                  </dd>
                  <dd className="text-xs text-subtle">Early or late on request, subject to the room.</dd>
                </div>
                <div>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">Email</dt>
                  <dd className="mt-1 text-sm text-foreground">{tenant.contact.email}</dd>
                </div>
                <div>
                  <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">Good to know</dt>
                  <dd className="mt-1 text-sm text-foreground">{lodging.settings.cityTaxLabel} of {formatCurrency(lodging.settings.cityTaxPerNight, tenant.currency)} per adult per night is added at booking.</dd>
                </div>
              </dl>
            </Reveal>
          </div>
        </section>
      </StorefrontSection>
    </StorefrontSections>
  )
}
