import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  Clock,
  Mail,
  MapPin,
  Phone,
  Quote,
  ShieldCheck,
  Ship,
  Users,
} from 'lucide-react'

import {
  NOW,
  TAX_RATE,
  TODAY_KEY,
  getActivityById,
  getBookingRows,
  getCustomersByTenant,
  getStorefront,
  getUpcomingDepartures,
  getUsersByTenant,
} from '@/lib/demo'
import {
  formatCurrency,
  formatDateShort,
  formatNumber,
  formatTime,
  pluralize,
  seatsRemaining,
} from '@/lib/utils'
import type { Tenant } from '@/types'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { ActivityShowcase } from '@/components/storefront/activity-showcase'
import { HotelHome } from '@/components/storefront/hotel/hotel-home'
import { RestaurantHome } from '@/components/storefront/restaurant/restaurant-home'
import { getDiningSettings, getMenu } from '@/lib/hospitality'
import { getWorkspaceProfile } from '@/lib/workspace-profile'
import { StarRow, StorefrontHero } from '@/components/storefront/storefront-hero'
import { StorefrontSection, StorefrontSections } from '@/components/storefront/storefront-sections'

interface TenantParams {
  tenant: string
}

export async function generateMetadata({
  params,
}: {
  params: Promise<TenantParams>
}): Promise<Metadata> {
  const { tenant: slug } = await params
  const storefront = getStorefront(slug)
  if (!storefront) return { title: { absolute: 'Storefront not found' } }
  const { tenant, activities } = storefront
  return {
    title: {
      absolute: `${tenant.name} — ${activities.length} experiences in ${tenant.city}`,
    },
  }
}

/* ==========================================================================
   DERIVED CONTENT
   ========================================================================== */

interface HomeReview {
  id: string
  name: string
  country: string
  rating: number
  text: string
  dateLabel: string
  activityName: string
}

/** Reviews written by real (generated) guests, newest trip first. */
function collectReviews(tenantId: string, limit: number): HomeReview[] {
  const rows = getBookingRows(tenantId)
  const candidates: { row: (typeof rows)[number]; sortKey: string }[] = []

  for (const row of rows) {
    const { booking } = row
    if (!booking.rating || booking.rating < 4) continue
    if (!booking.reviewText || booking.reviewText.length < 60) continue
    candidates.push({ row, sortKey: booking.departureAt })
  }

  candidates.sort((a, b) => (a.sortKey < b.sortKey ? 1 : a.sortKey > b.sortKey ? -1 : 0))

  return candidates.slice(0, limit).map(({ row }) => ({
    id: row.booking.id,
    name: `${row.customer.firstName} ${row.customer.lastName.charAt(0)}.`,
    country: row.customer.country,
    rating: row.booking.rating ?? 5,
    text: row.booking.reviewText ?? '',
    dateLabel: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(
      new Date(row.booking.departureAt),
    ),
    activityName: row.activity.name,
  }))
}

const VERTICAL_STORY: Record<string, { heading: string; body: string[] }> = {
  watersports: {
    heading: 'Run by people who live on this water',
    body: [
      'We started with one boat, two captains and a shared conviction that the best day on the water is a small one — fewer guests, more time in the right spot, nobody rushed back to the dock.',
      'Every skipper on the roster holds a current master licence and has worked these channels for years. They read the swell before the forecast does, and they will tell you honestly when a trip is not worth running.',
    ],
  },
  island: {
    heading: 'The reef, without the crowd',
    body: [
      'Our fleet is fast on purpose. Getting to the outer reef quickly is what buys you the quiet moorings, the untouched bommies and the hours the day-tripper boats never have.',
      'Every trip carries a marine biologist and a dive master, and our permits are tied to a reef-health programme we report into every quarter.',
    ],
  },
  hotels: {
    heading: 'A small hotel with a good kitchen',
    body: [
      'Twenty-eight rooms in a corner house above the river, run by people who grew up on these streets. The kitchen downstairs feeds the neighbourhood as much as the guests, and the rooftop is where everyone ends up at sunset.',
      'We keep the house small so the desk knows your name by the second morning, and we would rather send you to the tasca round the corner than pretend we do everything.',
    ],
  },
  restaurants: {
    heading: 'A short menu, written every morning',
    body: [
      'The board changes with the boats. What came in at dawn decides what is served at dusk, and the garden behind the terrace fills in the rest.',
      'We keep the room small so that every table gets the same attention, and we hold the last sitting until the light has gone off the caldera.',
    ],
  },
  adventure: {
    heading: 'Guides who have earned the ridge',
    body: [
      'Every guide on the team is qualified to lead in alpine terrain, and most of them grew up in these valleys. They know which route is in condition today and which one to save for next week.',
      'Group sizes stay small, gear is replaced on a schedule rather than when it fails, and no trip runs unless the conditions genuinely support it.',
    ],
  },
  tours: {
    heading: 'Unhurried days, properly guided',
    body: [
      'We build routes around the places worth stopping at, not the ones that fit a timetable.',
      'Small groups, local guides, and enough time to actually look at what you came to see.',
    ],
  },
  wellness: {
    heading: 'Space to actually switch off',
    body: [
      'Sessions are small and unhurried, in places chosen because they are quiet.',
      'Everything you need is laid out before you arrive. Turn up, and let the rest go.',
    ],
  },
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export default async function StorefrontHomePage({
  params,
}: {
  params: Promise<TenantParams>
}) {
  const { tenant: slug } = await params
  const storefront = getStorefront(slug)
  if (!storefront) notFound()

  const { tenant, activities, featured } = storefront
  const base = `/book/${tenant.slug}`

  /* ---------- aggregates ---------- */

  const reviewCount = activities.reduce((sum, a) => sum + a.reviewCount, 0)
  const rating =
    reviewCount === 0
      ? 5
      : activities.reduce((sum, a) => sum + a.rating * a.reviewCount, 0) / reviewCount

  const guestsHosted = getCustomersByTenant(tenant.id).length
  const reviews = collectReviews(tenant.id, 6)
  const crew = getUsersByTenant(tenant.id)
    .filter((user) => user.isBookable)
    .slice(0, 4)

  const upcoming = getUpcomingDepartures(tenant.id, 6).map((departure) => {
    const activity = getActivityById(departure.activityId)
    return {
      id: departure.id,
      startsAt: departure.startsAt,
      seatsLeft: seatsRemaining(departure.capacity, departure.booked, departure.held),
      name: activity?.name ?? 'Departure',
      slug: activity?.slug ?? '',
      price: activity?.basePrice ?? 0,
    }
  })

  const story = VERTICAL_STORY[tenant.vertical] ?? VERTICAL_STORY.tours
  const foundedYear = new Date(tenant.createdAt).getFullYear()
  const kind = getWorkspaceProfile(tenant.vertical).storefront
  const nowTime = `${String(NOW.getHours()).padStart(2, '0')}:${String(NOW.getMinutes()).padStart(2, '0')}`

  if (kind === 'restaurant') {
    return (
      <RestaurantHome
        tenant={tenant}
        menu={getMenu(tenant.id)}
        settings={getDiningSettings(tenant.id)}
        tastings={activities}
        reviews={reviews}
        story={story}
        crew={crew}
        rating={rating}
        reviewCount={reviewCount}
        guestsHosted={guestsHosted}
        todayKey={TODAY_KEY}
        nowTime={nowTime}
        taxRate={TAX_RATE[tenant.id] ?? 0}
      />
    )
  }
  if (kind === 'hotel') {
    return (
      <HotelHome
        tenant={tenant}
        menu={getMenu(tenant.id)}
        dining={getDiningSettings(tenant.id)}
        experiences={activities}
        reviews={reviews}
        story={story}
        crew={crew}
        rating={rating}
        reviewCount={reviewCount}
        guestsHosted={guestsHosted}
        todayKey={TODAY_KEY}
      />
    )
  }

  return (
    <StorefrontSections slug={tenant.slug} vertical={tenant.vertical}>
      <StorefrontSection key="hero" id="hero">
      <StorefrontHero
        tenant={tenant}
        activities={activities}
        featured={featured}
        rating={rating}
        reviewCount={reviewCount}
        guestsHosted={guestsHosted}
        todayKey={TODAY_KEY}
      />
      </StorefrontSection>
      {upcoming.length > 0 ? (
        <StorefrontSection key="departures" id="departures">
        <section className="border-b border-line-subtle bg-background py-10">
          <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-primary opacity-70" />
                    <span className="relative inline-flex size-2 rounded-full bg-primary" />
                  </span>
                  Live availability
                </p>
                <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  Next departures
                </h2>
              </div>
              <p className="text-sm text-muted">
                Updated {formatTime(NOW)} · {tenant.timezone.split('/').pop()?.replace(/_/g, ' ')}
              </p>
            </div>

            <StaggerGroup
              stagger={0.05}
              className="no-scrollbar mt-5 flex gap-3 overflow-x-auto pb-1"
            >
              {upcoming.map((departure) => (
                <StaggerItem key={departure.id} direction="up" className="shrink-0">
                  <Link
                    href={`${base}/${departure.slug}`}
                    className="group flex h-full w-64 flex-col justify-between rounded-2xl border border-line bg-surface p-4 transition-all duration-400 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div>
                      <p className="flex items-center gap-2 text-xs font-semibold tabular text-primary">
                        <Clock className="size-3.5" aria-hidden="true" />
                        {formatDateShort(departure.startsAt)} · {formatTime(departure.startsAt)}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
                        {departure.name}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <span
                        className={
                          departure.seatsLeft <= 4
                            ? 'text-xs font-semibold text-warning'
                            : 'text-xs text-subtle'
                        }
                      >
                        {departure.seatsLeft} {pluralize(departure.seatsLeft, 'seat')} left
                      </span>
                      <span className="text-sm font-semibold tabular text-foreground">
                        {formatCurrency(departure.price, tenant.currency)}
                      </span>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>
        </StorefrontSection>
      ) : null}
      <StorefrontSection key="catalogue" id="catalogue">
      <ActivityShowcase
        activities={activities}
        featured={featured}
        currency={tenant.currency}
        basePath={base}
        tenantSlug={tenant.slug}
        vertical={tenant.vertical}
      />
      </StorefrontSection>
      <StorefrontSection key="about" id="about">
      <section
        id="about"
        className="scroll-mt-24 border-y border-line-subtle bg-background-subtle py-16 sm:py-20"
      >
        <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
            <Reveal>
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">
                About us
              </p>
              <h2 className="mt-3 max-w-[20ch] font-display text-display-sm font-semibold tracking-tight text-foreground">
                {story.heading}
              </h2>
              <div className="mt-5 space-y-4">
                {story.body.map((paragraph) => (
                  <p key={paragraph} className="text-base leading-relaxed text-muted">
                    {paragraph}
                  </p>
                ))}
              </div>

              <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-line pt-8 sm:grid-cols-4">
                {[
                  { value: `${2026 - foundedYear}`, label: 'Years operating' },
                  { value: formatNumber(guestsHosted, { compact: true }), label: 'Guests hosted' },
                  { value: String(tenant.stats.teamSize), label: 'Crew on the team' },
                  { value: rating.toFixed(2), label: 'Average rating' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="sr-only">{stat.label}</dt>
                    <dd className="font-display text-3xl font-semibold tabular tracking-tight text-foreground">
                      {stat.value}
                    </dd>
                    <p className="mt-1 text-xs font-medium uppercase tracking-[0.1em] text-subtle">
                      {stat.label}
                    </p>
                  </div>
                ))}
              </dl>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
                <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
                  Meet the crew
                </h3>
                <p className="mt-1.5 text-sm text-muted">
                  The people who will actually be with you on the day.
                </p>

                <ul className="mt-6 space-y-5">
                  {crew.map((member) => (
                    <li key={member.id} className="flex items-start gap-3.5">
                      <Avatar name={member.name} src={member.avatarUrl} size="lg" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {member.name}
                        </p>
                        <p className="truncate text-xs text-subtle">{member.title}</p>
                        {member.certifications && member.certifications.length > 0 ? (
                          <ul className="mt-1.5 flex flex-wrap gap-1.5">
                            {member.certifications.slice(0, 2).map((certification) => (
                              <li
                                key={certification}
                                className="rounded-full bg-primary-soft px-2 py-0.5 text-[0.625rem] font-medium text-primary"
                              >
                                {certification}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>

                <Separator className="my-6" />

                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-muted">
                    Fully licensed and insured. {tenant.legalName} has operated from{' '}
                    {tenant.city} since {foundedYear}.
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
      </StorefrontSection>
      {reviews.length > 0 ? (
        <StorefrontSection key="reviews" id="reviews">
        <section id="reviews" className="scroll-mt-24 bg-background py-16 sm:py-20">
          <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
            <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">
                  Guest reviews
                </p>
                <h2 className="mt-3 font-display text-display-sm font-semibold tracking-tight text-foreground">
                  {rating.toFixed(2)} out of 5
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <StarRow value={rating} className="text-warning" />
                <p className="text-sm text-muted">
                  from {formatNumber(reviewCount)} verified {pluralize(reviewCount, 'review')}
                </p>
              </div>
            </Reveal>

            <StaggerGroup
              stagger={0.06}
              className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {reviews.map((review) => (
                <StaggerItem key={review.id} direction="up" className="h-full">
                  <figure className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-sm">
                    <Quote className="size-5 text-primary/45" aria-hidden="true" />
                    <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-muted">
                      “{review.text}”
                    </blockquote>
                    <StarRow value={review.rating} size="sm" className="mt-4 text-warning" />
                    <figcaption className="mt-3 flex items-center gap-3 border-t border-line-subtle pt-4">
                      <Avatar name={review.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {review.name}
                        </span>
                        <span className="block truncate text-xs text-subtle">
                          {review.country} · {review.dateLabel}
                        </span>
                      </span>
                    </figcaption>
                    <p className="mt-3 truncate text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-faint">
                      {review.activityName}
                    </p>
                  </figure>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>
        </StorefrontSection>
      ) : null}
      <StorefrontSection key="contact" id="contact">
        <ContactBand tenant={tenant} base={base} />
      </StorefrontSection>
    </StorefrontSections>
  )
}

/* ==========================================================================
   CONTACT
   ========================================================================== */

function ContactBand({ tenant, base }: { tenant: Tenant; base: string }) {
  return (
    <section
      id="contact"
      className="relative scroll-mt-24 overflow-hidden border-t border-line-subtle bg-background-subtle py-16 sm:py-20"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(58%_70%_at_18%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)]"
      />

      <div className="relative mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">
              Contact
            </p>
            <h2 className="mt-3 max-w-[16ch] font-display text-display-sm font-semibold tracking-tight text-foreground">
              Talk to a human before you book
            </h2>
            <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-muted">
              Private charters, large groups, accessibility questions or a date that is not showing
              — call the office and we will sort it out.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" leftIcon={<Phone aria-hidden="true" />}>
                <a href={`tel:${tenant.contact.phone.replace(/[^+\d]/g, '')}`}>
                  {tenant.contact.phone}
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                leftIcon={<Mail aria-hidden="true" />}
              >
                <a href={`mailto:${tenant.contact.email}`}>Email us</a>
              </Button>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <dl className="space-y-5">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
                      Where to find us
                    </dt>
                    <dd className="mt-1 text-sm leading-relaxed text-foreground">
                      {tenant.contact.addressLine}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
                      Office hours
                    </dt>
                    <dd className="mt-1 text-sm tabular text-foreground">
                      Every day, 6:30 am – 8:00 pm
                    </dd>
                    <dd className="text-xs text-subtle">
                      {tenant.timezone.split('/').pop()?.replace(/_/g, ' ')} time
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Users className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
                      Groups of 10 or more
                    </dt>
                    <dd className="mt-1 text-sm leading-relaxed text-foreground">
                      Private departures and charters are quoted the same day.
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Ship className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <dt className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
                      On the day
                    </dt>
                    <dd className="mt-1 text-sm leading-relaxed text-foreground">
                      Arrive 20 minutes before your start time. Parking is signed from the main
                      road.
                    </dd>
                  </div>
                </div>
              </dl>

              <Separator className="my-6" />

              <Button asChild fullWidth rightIcon={<ArrowRight aria-hidden="true" />}>
                <Link href={`${base}#experiences`}>Browse experiences</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
