'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  Backpack,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Expand,
  Info,
  Languages,
  MapPin,
  Minus,
  Navigation,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react'

import {
  cn,
  formatCurrency,
  formatDuration,
  formatNumber,
  pluralize,
} from '@/lib/utils'
import type { Activity, DifficultyLevel, Tenant } from '@/types'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Progress } from '@/components/ui/progress'
import { Avatar } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { BookingWidget, type AvailabilityDay } from '@/components/storefront/booking-widget'
import { StarRow } from '@/components/storefront/storefront-hero'
import { TrustBar } from '@/components/storefront/trust-bar'

/* ==========================================================================
   CONTENT DERIVED FROM THE DOMAIN MODEL
   ========================================================================== */

const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  easy: 'Easy going',
  moderate: 'Moderate',
  challenging: 'Challenging',
  extreme: 'Extreme',
}

const DIFFICULTY_COPY: Record<DifficultyLevel, string> = {
  easy: 'No experience needed — most guests manage this comfortably.',
  moderate: 'A reasonable level of fitness helps, but no technical skill is required.',
  challenging: 'Physically demanding. Come rested and tell us about any injuries.',
  extreme: 'Serious commitment. Prior experience is assessed before you book.',
}

/** Spoken at the meeting point, by market. */
const LANGUAGES_BY_LOCALE: Record<string, string[]> = {
  'en-US': ['English', 'Spanish', 'Japanese'],
  'en-AU': ['English', 'Mandarin', 'Japanese'],
  'el-GR': ['Greek', 'English', 'French'],
  'en-NZ': ['English', 'German', 'Japanese'],
}

/** A short, honest packing list per vertical — the question every guest asks. */
const PACKING_LIST: Record<string, string[]> = {
  watersports: [
    'Swimwear worn under your clothes',
    'Reef-safe sunscreen (we sell it at the dock if you forget)',
    'A towel and a dry change of clothes',
    'Sunglasses with a retainer strap',
    'A light windbreaker for the ride home',
  ],
  island: [
    'Swimwear and a rash vest if you burn easily',
    'Reef-safe sunscreen — the reef thanks you',
    'A hat that will survive 25 knots',
    'Motion sickness tablets taken an hour before boarding',
    'A dry bag for phones and cameras',
  ],
  adventure: [
    'Broken-in walking shoes or boots',
    'Layers — the valley and the ridge are two different days',
    'A waterproof shell',
    'A refillable water bottle',
    'Sunglasses and high-factor sunscreen',
  ],
  restaurants: [
    'Smart-casual dress — the terrace turns breezy after sunset',
    'A light layer for the caldera wind',
    'Your booking reference, on your phone is fine',
  ],
  tours: ['Comfortable shoes', 'A light layer', 'A refillable water bottle'],
  wellness: ['Comfortable clothing you can move in', 'A water bottle', 'Anything that helps you switch off'],
}

const SECTIONS = [
  { id: 'about', label: 'About' },
  { id: 'included', label: "What's included" },
  { id: 'bring', label: 'What to bring' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'meeting', label: 'Meeting point' },
  { id: 'policy', label: 'Cancellation' },
  { id: 'reviews', label: 'Reviews' },
] as const

export interface StorefrontReview {
  id: string
  name: string
  avatarUrl?: string
  country: string
  rating: number
  text: string
  dateLabel: string
  partyLabel: string
}

export interface RatingBucket {
  stars: number
  count: number
}

export interface ActivityDetailViewProps {
  tenant: Tenant
  activity: Activity
  days: AvailabilityDay[]
  reviews: StorefrontReview[]
  ratingBuckets: RatingBucket[]
  related: Activity[]
  basePath: string
  checkoutPath: string
  initialDateKey?: string
  initialGuests?: number
  /** Trailing-90-day booking count, for the social-proof line. */
  recentBookings: number
}

/* ==========================================================================
   <ActivityDetailView>
   ========================================================================== */

export function ActivityDetailView({
  tenant,
  activity,
  days,
  reviews,
  ratingBuckets,
  related,
  basePath,
  checkoutPath,
  initialDateKey,
  initialGuests,
  recentBookings,
}: ActivityDetailViewProps) {
  const reducedMotion = useReducedMotionSafe()
  const [lightbox, setLightbox] = React.useState<number | null>(null)
  const [mobileWidget, setMobileWidget] = React.useState(false)
  const [activeSection, setActiveSection] = React.useState<string>(SECTIONS[0].id)

  const media = activity.media
  const hero = media.find((m) => m.isPrimary) ?? media[0]
  const rest = media.filter((m) => m.id !== hero?.id).slice(0, 2)

  const languages = LANGUAGES_BY_LOCALE[tenant.locale] ?? ['English']
  const packing = PACKING_LIST[activity.category] ?? PACKING_LIST.tours

  const nextOpen = React.useMemo(() => {
    for (const day of days) {
      const slot = day.slots.find((s) => !s.soldOut)
      if (slot) return slot
    }
    return null
  }, [days])

  const fromPrice = Math.min(
    ...[activity.basePrice, ...days.map((d) => d.fromPrice).filter((p) => p > 0)],
  )

  /* ---------- scrollspy for the section rail ---------- */

  React.useEffect(() => {
    const elements = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (el): el is HTMLElement => el !== null,
    )
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActiveSection(visible.target.id)
      },
      { rootMargin: '-40% 0px -50% 0px', threshold: [0, 0.25, 1] },
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const totalReviews = ratingBuckets.reduce((sum, bucket) => sum + bucket.count, 0)

  return (
    <div className="pb-28 lg:pb-0">
      {/* ==================== header ==================== */}
      <div className="border-b border-line-subtle bg-background-subtle pt-20 sm:pt-24">
        <div className="mx-auto w-full max-w-[88rem] px-4 py-7 sm:px-6 lg:px-10">
          <Link
            href={`${basePath}#experiences`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            All experiences
          </Link>

          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-primary">
                  {DIFFICULTY_LABEL[activity.difficulty]}
                </span>
                {activity.featured ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-accent">
                    <Sparkles className="size-3" aria-hidden="true" />
                    Guest favourite
                  </span>
                ) : null}
                {recentBookings > 0 ? (
                  <span className="text-xs font-medium text-subtle">
                    {formatNumber(recentBookings)} booked in the last 90 days
                  </span>
                ) : null}
              </div>

              <h1 className="mt-3 font-display text-display-sm font-semibold tracking-tight text-foreground">
                {activity.name}
              </h1>
              <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">
                {activity.tagline}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-4 lg:pb-1">
              <div className="text-right">
                <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-faint">
                  From
                </p>
                <p className="font-display text-2xl font-semibold tabular text-foreground">
                  {formatCurrency(fromPrice, tenant.currency)}
                </p>
              </div>
              <Button
                size="lg"
                className="hidden lg:inline-flex"
                onClick={() =>
                  document.getElementById('book')?.scrollIntoView({
                    behavior: reducedMotion ? 'auto' : 'smooth',
                    block: 'start',
                  })
                }
              >
                Check availability
              </Button>
            </div>
          </div>

          {/* ---------- fact row ---------- */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <span className="inline-flex items-center gap-2">
              <StarRow value={activity.rating} size="sm" className="text-warning" />
              <span className="font-semibold tabular text-foreground">
                {activity.rating.toFixed(1)}
              </span>
              <span className="text-subtle">
                ({formatNumber(activity.reviewCount)} {pluralize(activity.reviewCount, 'review')})
              </span>
            </span>
            <Fact icon={Clock}>{formatDuration(activity.durationMinutes)}</Fact>
            <Fact icon={Users}>Up to {activity.maxCapacity} guests</Fact>
            <Fact icon={Languages}>{languages.join(', ')}</Fact>
            <Fact icon={CalendarCheck}>
              Free cancellation · {activity.cancellationPolicy.freeCancellationHours}h
            </Fact>
          </div>
        </div>
      </div>

      {/* ==================== gallery ==================== */}
      <div className="mx-auto w-full max-w-[88rem] px-4 pt-6 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr]">
          <button
            type="button"
            onClick={() => setLightbox(0)}
            className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-sunken sm:aspect-[16/10] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {hero ? (
              <Image
                src={hero.url}
                alt={hero.alt}
                fill
                priority
                sizes="(min-width: 640px) 62vw, 100vw"
                className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.04]"
              />
            ) : null}
            <span className="absolute inset-0 bg-[linear-gradient(to_top,oklch(0.12_0.02_233/0.4),transparent_45%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm">
              <Expand className="size-3.5" aria-hidden="true" />
              View {media.length} photos
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            {rest.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLightbox(index + 1)}
                className="group relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-sunken sm:aspect-[16/11] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Image
                  src={item.url}
                  alt={item.alt}
                  fill
                  sizes="(min-width: 640px) 30vw, 50vw"
                  className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.06]"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ==================== body ==================== */}
      <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-10 py-10 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-12 lg:py-14 xl:grid-cols-[minmax(0,1fr)_25rem]">
          {/* ---------- left column ---------- */}
          <div className="min-w-0">
            {/* section rail */}
            <nav
              aria-label="Sections"
              className="no-scrollbar sticky top-16 z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-line-subtle bg-[color-mix(in_oklab,var(--background)_92%,transparent)] px-4 py-2.5 backdrop-blur-md sm:top-[4.5rem] sm:-mx-6 sm:px-6 lg:-mx-2 lg:px-2"
            >
              {SECTIONS.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  aria-current={activeSection === section.id ? 'true' : undefined}
                  className={cn(
                    'relative whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors duration-200',
                    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary',
                    activeSection === section.id
                      ? 'text-on-primary'
                      : 'text-muted hover:bg-surface-sunken hover:text-foreground',
                  )}
                >
                  {activeSection === section.id ? (
                    <motion.span
                      layoutId="storefront-section-pill"
                      className="absolute inset-0 rounded-full bg-primary"
                      transition={
                        reducedMotion
                          ? { duration: 0 }
                          : { type: 'spring', stiffness: 460, damping: 38 }
                      }
                    />
                  ) : null}
                  <span className="relative">{section.label}</span>
                </a>
              ))}
            </nav>

            {/* ---------- about ---------- */}
            <Section id="about" title="About this experience">
              <p className="text-[0.9375rem] leading-relaxed text-muted">{activity.description}</p>

              <StaggerGroup
                as="ul"
                stagger={0.05}
                className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2"
              >
                {activity.highlights.map((highlight) => (
                  <StaggerItem
                    as="li"
                    key={highlight}
                    direction="up"
                    className="flex items-start gap-2.5 rounded-xl border border-line-subtle bg-surface px-3.5 py-3"
                  >
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-sm leading-relaxed text-foreground">{highlight}</span>
                  </StaggerItem>
                ))}
              </StaggerGroup>

              <div className="mt-6 flex items-start gap-3 rounded-xl border border-line-subtle bg-surface-sunken px-4 py-3.5">
                <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-muted">
                  <span className="font-semibold text-foreground">
                    {DIFFICULTY_LABEL[activity.difficulty]}.
                  </span>{' '}
                  {DIFFICULTY_COPY[activity.difficulty]} Minimum age {activity.minAge}.
                </p>
              </div>
            </Section>

            {/* ---------- included ---------- */}
            <Section id="included" title="What's included">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <ul className="space-y-2.5">
                  {activity.included.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success-soft">
                        <Check className="size-3 text-success" aria-hidden="true" />
                      </span>
                      <span className="text-sm leading-relaxed text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <ul className="space-y-2.5">
                  {activity.excluded.map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-surface-sunken">
                        <Minus className="size-3 text-faint" aria-hidden="true" />
                      </span>
                      <span className="text-sm leading-relaxed text-subtle">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {activity.addOns.length > 0 ? (
                <div className="mt-6 rounded-xl border border-line bg-surface p-4">
                  <p className="text-[0.8125rem] font-semibold text-foreground">
                    Optional extras you can add at checkout
                  </p>
                  <ul className="mt-3 divide-y divide-line-subtle">
                    {activity.addOns.map((addOn) => (
                      <li key={addOn.id} className="flex items-baseline justify-between gap-4 py-2.5">
                        <span className="min-w-0">
                          <span className="text-sm font-medium text-foreground">{addOn.label}</span>
                          <span className="mt-0.5 block text-xs text-subtle">
                            {addOn.description}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular text-foreground">
                          {formatCurrency(addOn.price, tenant.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Section>

            {/* ---------- what to bring ---------- */}
            <Section id="bring" title="What to bring">
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {packing.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 rounded-xl bg-surface-sunken px-3.5 py-3"
                  >
                    <Backpack className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-sm leading-relaxed text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </Section>

            {/* ---------- requirements ---------- */}
            <Section id="requirements" title="Requirements">
              <ul className="space-y-2.5">
                {activity.requirements.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                    <span className="text-sm leading-relaxed text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm leading-relaxed text-subtle">
                Not sure whether this suits your group? Call {tenant.contact.phone} and one of the
                team will tell you honestly.
              </p>
            </Section>

            {/* ---------- meeting point ---------- */}
            <Section id="meeting" title="Meeting point">
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                <MeetingPointMap label={tenant.city} />
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-relaxed text-foreground">
                        {activity.meetingPoint}
                      </p>
                      <p className="mt-1 text-xs text-subtle">{tenant.contact.addressLine}</p>
                    </div>
                  </div>
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    rightIcon={<Navigation aria-hidden="true" />}
                  >
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(tenant.contact.addressLine)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Get directions
                    </a>
                  </Button>
                </div>
              </div>
            </Section>

            {/* ---------- cancellation ---------- */}
            <Section id="policy" title="Cancellation policy">
              <div className="rounded-2xl border border-line bg-surface p-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Free cancellation up to{' '}
                      {activity.cancellationPolicy.freeCancellationHours} hours before departure
                    </p>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">
                      {activity.cancellationPolicy.summary}
                    </p>
                  </div>
                </div>

                <ul className="mt-5 space-y-3 border-t border-line-subtle pt-5 text-sm text-muted">
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    If we cancel for weather or sea state, you choose a full refund or a free
                    reschedule. No arguments.
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    Changes to your date or party size are free up to 24 hours before, subject to
                    space.
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                    Refunds land back on the original card within 5–10 business days.
                  </li>
                </ul>
              </div>
            </Section>

            {/* ---------- reviews ---------- */}
            <Section id="reviews" title="Guest reviews">
              <div className="grid grid-cols-1 gap-6 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8 sm:p-6">
                <div className="flex flex-col items-center justify-center gap-1 sm:w-40">
                  <p className="font-display text-5xl font-semibold tabular tracking-tight text-foreground">
                    {activity.rating.toFixed(1)}
                  </p>
                  <StarRow value={activity.rating} className="text-warning" />
                  <p className="mt-1 text-xs text-subtle">
                    {formatNumber(activity.reviewCount)} verified{' '}
                    {pluralize(activity.reviewCount, 'review')}
                  </p>
                </div>

                <div className="space-y-2">
                  {ratingBuckets.map((bucket) => {
                    const percent = totalReviews === 0 ? 0 : (bucket.count / totalReviews) * 100
                    return (
                      <div key={bucket.stars} className="flex items-center gap-3">
                        <span className="inline-flex w-10 shrink-0 items-center gap-1 text-xs font-medium tabular text-muted">
                          {bucket.stars}
                          <Star className="size-3 text-warning" fill="currentColor" aria-hidden="true" />
                        </span>
                        <Progress
                          value={percent}
                          size="sm"
                          tone="warning"
                          className="flex-1"
                          aria-label={`${bucket.stars} star reviews`}
                        />
                        <span className="w-12 shrink-0 text-right text-xs tabular text-subtle">
                          {Math.round(percent)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {reviews.length > 0 ? (
                <StaggerGroup stagger={0.06} className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {reviews.map((review) => (
                    <StaggerItem key={review.id} direction="up" className="h-full">
                      <ReviewCard review={review} />
                    </StaggerItem>
                  ))}
                </StaggerGroup>
              ) : null}
            </Section>
          </div>

          {/* ---------- right rail ---------- */}
          <aside id="book" className="scroll-mt-28 hidden lg:block">
            <div className="sticky top-24">
              <BookingWidget
                activity={activity}
                tenantSlug={tenant.slug}
                currency={tenant.currency}
                days={days}
                checkoutPath={checkoutPath}
                initialDateKey={initialDateKey}
                initialGuests={initialGuests}
              />
              <TrustBar
                variant="inline"
                rating={activity.rating}
                reviewCount={activity.reviewCount}
                freeCancellationHours={activity.cancellationPolicy.freeCancellationHours}
                className="mt-5 justify-center"
              />
            </div>
          </aside>
        </div>

        {/* ---------- related ---------- */}
        {related.length > 0 ? (
          <Reveal className="border-t border-line-subtle py-12 lg:py-16">
            <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              Guests who booked this also liked
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => {
                const image = item.media.find((m) => m.isPrimary) ?? item.media[0]
                return (
                  <Link
                    key={item.id}
                    href={`${basePath}/${item.slug}`}
                    className="group flex gap-4 rounded-2xl border border-line bg-surface p-3 transition-all duration-400 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-surface-sunken">
                      {image ? (
                        <Image
                          src={image.url}
                          alt={image.alt}
                          fill
                          sizes="96px"
                          className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-110"
                        />
                      ) : null}
                    </span>
                    <span className="flex min-w-0 flex-col justify-center">
                      <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                        {item.name}
                      </span>
                      <span className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-subtle">
                        <Star className="size-3 text-warning" fill="currentColor" aria-hidden="true" />
                        {item.rating.toFixed(1)} · {formatDuration(item.durationMinutes)}
                      </span>
                      <span className="mt-1.5 text-sm font-semibold tabular text-foreground">
                        From {formatCurrency(item.basePrice, tenant.currency)}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          </Reveal>
        ) : null}
      </div>

      {/* ==================== mobile booking bar ==================== */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] px-4 py-3 shadow-[0_-8px_28px_-12px_oklch(0.221_0.024_228/0.25)] backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold leading-none tabular text-foreground">
              {formatCurrency(fromPrice, tenant.currency)}
              <span className="ml-1 text-xs font-medium text-subtle">per person</span>
            </p>
            <p className="mt-1 truncate text-xs text-subtle">
              {nextOpen
                ? `Next departure ${new Intl.DateTimeFormat('en-US', {
                    weekday: 'short',
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(new Date(nextOpen.startsAt))} · ${nextOpen.seatsLeft} seats`
                : 'Call us for the next available date'}
            </p>
          </div>
          <Button size="lg" onClick={() => setMobileWidget(true)} className="shrink-0">
            Check availability
          </Button>
        </div>
      </div>

      <Sheet open={mobileWidget} onOpenChange={setMobileWidget}>
        <SheetContent side="bottom" size="xl" className="p-0" aria-describedby={undefined}>
          <SheetHeader className="px-5 pb-3 pt-5">
            <SheetTitle className="font-display text-base">{activity.name}</SheetTitle>
          </SheetHeader>
          <SheetBody className="px-0 pb-6">
            <BookingWidget
              activity={activity}
              tenantSlug={tenant.slug}
              currency={tenant.currency}
              days={days}
              checkoutPath={checkoutPath}
              initialDateKey={initialDateKey}
              initialGuests={initialGuests}
              variant="sheet"
            />
          </SheetBody>
        </SheetContent>
      </Sheet>

      {/* ==================== lightbox ==================== */}
      <Lightbox
        media={media}
        index={lightbox}
        onIndexChange={setLightbox}
        title={activity.name}
      />
    </div>
  )
}

/* ==========================================================================
   PARTS
   ========================================================================== */

function Fact({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted">
      <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      {children}
    </span>
  )
}

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-32 border-b border-line-subtle py-8 last:border-0">
      <Reveal>
        <h2 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        <div className="mt-4">{children}</div>
      </Reveal>
    </section>
  )
}

function ReviewCard({ review }: { review: StorefrontReview }) {
  return (
    <figure className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3">
        <Avatar name={review.name} src={review.avatarUrl} size="md" />
        <div className="min-w-0">
          <figcaption className="truncate text-sm font-semibold text-foreground">
            {review.name}
          </figcaption>
          <p className="truncate text-xs text-subtle">
            {review.country} · {review.partyLabel}
          </p>
        </div>
        <span className="ml-auto shrink-0 text-xs text-faint">{review.dateLabel}</span>
      </div>
      <StarRow value={review.rating} size="sm" className="mt-3 text-warning" />
      <blockquote className="mt-3 text-sm leading-relaxed text-muted">“{review.text}”</blockquote>
    </figure>
  )
}

/* ==========================================================================
   <MeetingPointMap>
   A drawn map, not an embed: no third-party script, no API key, and it takes
   the storefront's own palette in both themes.
   ========================================================================== */

function MeetingPointMap({ label }: { label: string }) {
  return (
    <div className="relative h-56 w-full overflow-hidden border-b border-line-subtle bg-surface-sunken sm:h-64">
      <svg
        viewBox="0 0 800 260"
        className="absolute inset-0 size-full"
        role="img"
        aria-label={`Stylised map of the meeting point in ${label}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* water */}
        <path
          d="M0 186 C 120 168, 210 210, 330 196 C 450 182, 560 214, 800 190 L800 260 L0 260 Z"
          className="fill-primary/16"
        />
        <path
          d="M0 186 C 120 168, 210 210, 330 196 C 450 182, 560 214, 800 190"
          className="stroke-primary/40"
          strokeWidth="2"
          fill="none"
        />
        {/* swell lines */}
        {[210, 226, 242].map((y, i) => (
          <path
            key={y}
            d={`M${-20 + i * 14} ${y} q 40 -8 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0 t 80 0`}
            className="stroke-primary/25"
            strokeWidth="1.5"
            fill="none"
          />
        ))}

        {/* land blocks */}
        {[
          [60, 40, 150, 54],
          [240, 28, 120, 44],
          [392, 44, 92, 62],
          [520, 26, 140, 50],
          [96, 116, 108, 40],
          [236, 108, 176, 46],
          [452, 116, 118, 38],
          [606, 96, 128, 52],
        ].map(([x, y, w, h]) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width={w}
            height={h}
            rx="6"
            className="fill-line-subtle stroke-line"
            strokeWidth="1"
          />
        ))}

        {/* roads */}
        <path d="M0 96 H800" className="stroke-line-strong" strokeWidth="10" fill="none" />
        <path
          d="M0 96 H800"
          className="stroke-background"
          strokeWidth="2"
          strokeDasharray="14 12"
          fill="none"
        />
        <path d="M218 0 V186" className="stroke-line-strong" strokeWidth="8" fill="none" />
        <path d="M584 0 V170" className="stroke-line-strong" strokeWidth="8" fill="none" />

        {/* jetty */}
        <path d="M400 106 V196" className="stroke-line-strong" strokeWidth="7" fill="none" />

        {/* pin */}
        <g transform="translate(400 174)">
          <circle
            r="26"
            className="fill-primary/18 animate-pulse-ring"
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
          />
          <circle r="13" className="fill-primary" />
          <circle r="4.5" className="fill-surface" />
        </g>
      </svg>

      <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-lg bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm backdrop-blur-sm">
        <MapPin className="size-3.5 text-primary" aria-hidden="true" />
        Meet here · {label}
      </div>
      <span className="absolute bottom-3 right-4 text-[0.625rem] font-medium uppercase tracking-[0.12em] text-faint">
        Illustrative map
      </span>
    </div>
  )
}

/* ==========================================================================
   <Lightbox>
   ========================================================================== */

function Lightbox({
  media,
  index,
  onIndexChange,
  title,
}: {
  media: Activity['media']
  index: number | null
  onIndexChange: (index: number | null) => void
  title: string
}) {
  const open = index !== null
  const current = open ? media[Math.max(0, Math.min(index, media.length - 1))] : undefined

  const step = React.useCallback(
    (delta: number) => {
      onIndexChange(index === null ? null : (index + delta + media.length) % media.length)
    },
    [index, media.length, onIndexChange],
  )

  React.useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') step(1)
      if (event.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, step])

  return (
    <Dialog open={open} onOpenChange={(next) => onIndexChange(next ? (index ?? 0) : null)}>
      <DialogContent
        size="full"
        showCloseButton={false}
        aria-describedby={undefined}
        className="border-0 bg-ink-975 p-0"
        overlayClassName="bg-[oklch(0.08_0.016_236/0.88)]"
      >
        <DialogTitle className="sr-only">{title} — photo gallery</DialogTitle>

        <div className="relative flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm font-medium text-white/75 tabular">
              {(index ?? 0) + 1} / {media.length}
            </p>
            <IconButton
              aria-label="Close gallery"
              size="sm"
              variant="glass"
              className="text-white"
              onClick={() => onIndexChange(null)}
            >
              <X aria-hidden="true" />
            </IconButton>
          </div>

          <div className="relative min-h-0 flex-1">
            <AnimatePresence mode="wait" initial={false}>
              {current ? (
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.995 }}
                  transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0"
                >
                  <Image
                    src={current.url}
                    alt={current.alt}
                    fill
                    sizes="90vw"
                    className="object-contain"
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>

            {media.length > 1 ? (
              <>
                <IconButton
                  aria-label="Previous photo"
                  size="lg"
                  variant="glass"
                  shape="circle"
                  onClick={() => step(-1)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white"
                >
                  <ChevronLeft aria-hidden="true" />
                </IconButton>
                <IconButton
                  aria-label="Next photo"
                  size="lg"
                  variant="glass"
                  shape="circle"
                  onClick={() => step(1)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white"
                >
                  <ChevronRight aria-hidden="true" />
                </IconButton>
              </>
            ) : null}
          </div>

          <div className="shrink-0 px-4 pb-4 pt-3">
            <p className="mb-3 line-clamp-1 text-center text-xs text-white/60">{current?.alt}</p>
            <div className="no-scrollbar flex justify-center gap-2 overflow-x-auto">
              {media.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onIndexChange(i)}
                  aria-label={`Show photo ${i + 1}`}
                  aria-current={i === index ? 'true' : undefined}
                  className={cn(
                    'relative h-14 w-20 shrink-0 overflow-hidden rounded-lg transition-all duration-200',
                    'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-white',
                    i === index
                      ? 'ring-2 ring-white'
                      : 'opacity-55 hover:opacity-90',
                  )}
                >
                  <Image src={item.url} alt="" fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
