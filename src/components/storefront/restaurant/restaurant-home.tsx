import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Bike, Clock, MapPin, Phone, Quote, ShoppingBag, UtensilsCrossed } from 'lucide-react'

import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { MenuBrowser } from '@/components/storefront/restaurant/menu-browser'
import { StarRow } from '@/components/storefront/storefront-hero'
import { StorefrontSection, StorefrontSections } from '@/components/storefront/storefront-sections'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { hm } from '@/lib/hospitality/hours'
import type { DiningSettings, Menu } from '@/lib/hospitality/types'
import { formatCurrency, formatDuration, formatNumber, pluralize } from '@/lib/utils'
import type { Activity, Tenant, User } from '@/types'

/* ==========================================================================
   The restaurant storefront — a menu first, a shop second.

   A short hero with the hours and the two ways in (see the menu, order
   for pickup or delivery), then the menu itself, the tasting menus and
   events, the kitchen's story, reviews, and hours with the phone for
   tables. Sections are toggled from the dashboard through
   <StorefrontSections>.
   ========================================================================== */

export interface HomeReview {
  id: string
  name: string
  country: string
  rating: number
  text: string
  dateLabel: string
  activityName: string
}

export interface RestaurantHomeProps {
  tenant: Tenant
  menu: Menu
  settings: DiningSettings
  tastings: Activity[]
  reviews: HomeReview[]
  story: { heading: string; body: string[] }
  crew: User[]
  rating: number
  reviewCount: number
  guestsHosted: number
  todayKey: string
  nowTime: string
  taxRate: number
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function RestaurantHome({ tenant, menu, settings, tastings, reviews, story, crew, rating, reviewCount, guestsHosted, todayKey, nowTime, taxRate }: RestaurantHomeProps) {
  const base = `/book/${tenant.slug}`
  const now = hm(nowTime)
  const weekday = new Date(`${todayKey}T12:00:00`).getDay()
  const todays = settings.periods.filter((p) => p.weekdays.includes(weekday))
  const current = todays.find((p) => hm(p.startTime) <= now && hm(p.endTime) > now)
  const next = todays.find((p) => hm(p.startTime) > now)
  const status = current ? `Open · ${current.name.toLowerCase()} until ${current.endTime}` : next ? `Opens for ${next.name.toLowerCase()} at ${next.startTime}` : 'Closed for today'
  const foundedYear = new Date(tenant.createdAt).getFullYear()
  const tel = `tel:${tenant.contact.phone.replace(/[^+\d]/g, '')}`
  const pickupOpen = settings.ordering.pickup.enabled && now >= hm(settings.ordering.pickup.startTime) && now < hm(settings.ordering.pickup.endTime)

  return (
    <StorefrontSections slug={tenant.slug} vertical={tenant.vertical}>
      <StorefrontSection key="hero" id="hero">
        <section className="relative isolate overflow-hidden bg-[#0b1417] text-white">
          {tenant.branding.coverImage ? <Image src={tenant.branding.coverImage} alt="" fill priority sizes="100vw" className="object-cover opacity-70" /> : null}
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,20,23,0.55)_0%,rgba(11,20,23,0.3)_40%,rgba(11,20,23,0.88)_100%)]" />
          <div className="relative mx-auto flex w-full max-w-[88rem] flex-col justify-end px-4 pt-28 pb-10 sm:px-6 sm:pt-36 sm:pb-14 lg:px-10">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/70">
              {tenant.city} · {status}
            </p>
            <h1 className="mt-3 max-w-[16ch] font-display text-[length:clamp(2.5rem,1.4rem_+_3.6vw,4.5rem)] leading-[1.02] font-semibold tracking-tight">{tenant.name}</h1>
            <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-white/80 sm:text-lg">{story.body[0]}</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/80">
              <span className="inline-flex items-center gap-2">
                <StarRow value={rating} size="sm" className="text-warning" />
                {rating.toFixed(1)} · {formatNumber(reviewCount)} {pluralize(reviewCount, 'review')}
              </span>
              <span className="hidden text-white/40 sm:inline">·</span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" aria-hidden="true" />
                {tenant.contact.addressLine.split(',')[0]}
              </span>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg" leftIcon={<UtensilsCrossed aria-hidden="true" />}>
                <Link href={`${base}#menu`}>See the menu</Link>
              </Button>
              <Button asChild size="lg" variant="glass" className="text-white" leftIcon={<ShoppingBag aria-hidden="true" />}>
                <Link href={`${base}#menu`}>Order pickup or delivery</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" leftIcon={<Phone aria-hidden="true" />}>
                <a href={tel}>Call to book a table</a>
              </Button>
            </div>
            <dl className="mt-9 grid max-w-3xl grid-cols-2 gap-4 border-t border-white/15 pt-6 text-white/80 sm:grid-cols-4">
              {settings.periods.map((p) => (
                <div key={p.id}>
                  <dt className="text-xs uppercase tracking-[0.12em] text-white/50">{p.name}</dt>
                  <dd className="mt-1 text-sm tabular-nums">
                    {p.startTime}–{p.endTime}
                  </dd>
                </div>
              ))}
              <div>
                <dt className="text-xs uppercase tracking-[0.12em] text-white/50">Pickup</dt>
                <dd className="mt-1 text-sm">{pickupOpen ? `Ready in ${settings.ordering.pickup.leadMinutes} min` : `From ${settings.ordering.pickup.startTime}`}</dd>
              </div>
            </dl>
          </div>
        </section>
      </StorefrontSection>

      <StorefrontSection key="menu" id="menu">
        <MenuBrowser menu={menu} ordering={settings.ordering} periods={settings.periods} currency={tenant.currency} slug={tenant.slug} taxRate={taxRate} nowTime={nowTime} weekday={weekday} phone={tenant.contact.phone} />
      </StorefrontSection>

      {tastings.length > 0 ? (
        <StorefrontSection key="tastings" id="tastings">
          <section id="tastings" className="scroll-mt-20 border-y border-line-subtle bg-background-subtle py-14 sm:py-20">
            <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
              <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Tasting menus and events</p>
                  <h2 className="mt-2 max-w-[22ch] font-display text-display-sm font-semibold tracking-tight text-foreground">Set menus with a seat, booked ahead</h2>
                </div>
                <p className="max-w-[40ch] text-sm text-muted">Paid at booking, held for the whole evening. Dietary requirements are taken when you book.</p>
              </Reveal>
              <StaggerGroup stagger={0.06} className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {tastings.slice(0, 3).map((a) => (
                  <StaggerItem key={a.id} direction="up" className="h-full">
                    <Link href={`${base}/${a.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-all duration-400 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
                      <div className="relative aspect-[4/3] bg-surface-sunken">{a.media[0] ? <Image src={a.media[0].url} alt={a.media[0].alt ?? a.name} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" /> : null}</div>
                      <div className="flex flex-1 flex-col p-5">
                        <p className="text-base font-semibold tracking-tight text-foreground group-hover:text-primary">{a.name}</p>
                        <p className="mt-1.5 line-clamp-2 text-sm text-muted">{a.tagline}</p>
                        <div className="mt-4 flex items-center justify-between text-sm">
                          <span className="inline-flex items-center gap-1.5 text-subtle">
                            <Clock className="size-3.5" aria-hidden="true" />
                            {formatDuration(a.durationMinutes)}
                          </span>
                          <span className="text-foreground tabular-nums">
                            from {formatCurrency(a.basePrice, tenant.currency)} <span className="text-subtle">pp</span>
                          </span>
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
        <section id="about" className="scroll-mt-20 bg-background py-14 sm:py-20">
          <div className="mx-auto grid w-full max-w-[88rem] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16 lg:px-10">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">The kitchen</p>
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
                  { value: `${2026 - foundedYear}`, label: 'Years on the caldera' },
                  { value: formatNumber(guestsHosted, { compact: true }), label: 'Guests fed' },
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
                <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">Behind the pass</h3>
                <p className="mt-1.5 text-sm text-muted">The people cooking and looking after you.</p>
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
          <section id="reviews" className="scroll-mt-20 border-t border-line-subtle bg-background-subtle py-14 sm:py-20">
            <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
              <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Guest reviews</p>
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
        <section id="contact" className="scroll-mt-20 border-t border-line-subtle bg-background py-14 sm:py-20">
          <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Hours, tables and directions</p>
              <h2 className="mt-3 max-w-[18ch] font-display text-display-sm font-semibold tracking-tight text-foreground">Come in, call ahead, or let us come to you</h2>
            </Reveal>
            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <Reveal className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Clock className="size-4 text-primary" aria-hidden="true" /> Hours
                </h3>
                <dl className="mt-4 space-y-2 text-sm">
                  {settings.periods.map((p) => (
                    <div key={p.id} className="flex justify-between gap-3">
                      <dt className="text-muted">{p.name}</dt>
                      <dd className="text-right text-foreground tabular-nums">
                        {p.startTime}–{p.endTime}
                        {p.weekdays.length < 7 ? <span className="block text-xs text-subtle">not {WEEKDAY.filter((_, i) => !p.weekdays.includes(i)).join(', ')}</span> : null}
                      </dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 border-t border-line-subtle pt-2">
                    <dt className="inline-flex items-center gap-1.5 text-muted">
                      <ShoppingBag className="size-3.5" aria-hidden="true" /> Pickup
                    </dt>
                    <dd className="text-foreground tabular-nums">
                      {settings.ordering.pickup.startTime}–{settings.ordering.pickup.endTime}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="inline-flex items-center gap-1.5 text-muted">
                      <Bike className="size-3.5" aria-hidden="true" /> Delivery
                    </dt>
                    <dd className="text-foreground tabular-nums">
                      {settings.ordering.delivery.startTime}–{settings.ordering.delivery.endTime}
                    </dd>
                  </div>
                </dl>
                {settings.closures.length ? <p className="mt-4 text-xs text-subtle">Closed {settings.closures.map((c) => `${c.date.slice(5).replace('-', '/')} (${c.reason})`).join(', ')}.</p> : null}
              </Reveal>
              <Reveal delay={0.06} className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Phone className="size-4 text-primary" aria-hidden="true" /> Tables
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-foreground">We take tables by phone, so we can hear how many of you there are and where you would like to sit.</p>
                <p className="mt-2 text-sm text-muted">Groups of eight or more and the private room, the same way. Walk-ins are always welcome at the bar.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button asChild size="sm" leftIcon={<Phone aria-hidden="true" />}>
                    <a href={tel}>{tenant.contact.phone}</a>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <a href={`mailto:${tenant.contact.email}`}>{tenant.contact.email}</a>
                  </Button>
                </div>
              </Reveal>
              <Reveal delay={0.12} className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <MapPin className="size-4 text-primary" aria-hidden="true" /> Where, and where we deliver
                </h3>
                <p className="mt-4 text-sm leading-relaxed text-foreground">{tenant.contact.addressLine}</p>
                <ul className="mt-4 space-y-1.5 text-sm">
                  {settings.ordering.delivery.zones.map((z) => (
                    <li key={z.id} className="flex justify-between gap-3">
                      <span className="text-muted">{z.name}</span>
                      <span className="text-foreground tabular-nums">
                        {formatCurrency(z.fee, tenant.currency)} <span className="text-subtle">· min {formatCurrency(z.minOrder, tenant.currency)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <Button asChild size="sm" variant="outline" className="mt-5" rightIcon={<ArrowRight aria-hidden="true" />}>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${tenant.name}, ${tenant.contact.addressLine}`)}`} target="_blank" rel="noreferrer">
                    Directions
                  </a>
                </Button>
              </Reveal>
            </div>
          </div>
        </section>
      </StorefrontSection>
    </StorefrontSections>
  )
}
