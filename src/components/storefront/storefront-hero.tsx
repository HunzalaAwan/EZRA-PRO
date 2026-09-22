'use client'

import * as React from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  MapPin,
  Minus,
  Plus,
  Search,
  Star,
  Users,
} from 'lucide-react'

import { cn, formatNumber, pluralize } from '@/lib/utils'
import type { Activity, Tenant, VerticalKey } from '@/types'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { imageIsOptimisable, useStorefrontBrand } from '@/components/storefront/storefront-brand'

/* ==========================================================================
   COPY
   One line per vertical so the same hero reads like it was written for the
   business it is rendering, not like a template.
   ========================================================================== */

const HERO_COPY: Record<VerticalKey, { eyebrow: string; sub: string }> = {
  watersports: {
    eyebrow: 'Reef, swell & open water',
    sub: 'Small-group trips run by captains and guides who have been reading this water their whole lives.',
  },
  island: {
    eyebrow: 'Outer reef & island days',
    sub: 'Fast catamarans, quiet moorings and the parts of the reef the day-tripper fleet never reaches.',
  },
  tours: {
    eyebrow: 'Guided days out',
    sub: 'Unhurried routes, small groups and guides who actually live here.',
  },
  restaurants: {
    eyebrow: 'Caldera-side dining',
    sub: 'A short menu built around the morning catch, the garden and whatever the boats brought in.',
  },
  hotels: {
    eyebrow: 'Rooms, terrace & kitchen',
    sub: 'A small hotel with a good kitchen, a rooftop that faces the river, and staff who remember how you take your coffee.',
  },
  adventure: {
    eyebrow: 'Alpine & backcountry',
    sub: 'Ridge lines, river valleys and glacier country with guides certified to take you there.',
  },
  wellness: {
    eyebrow: 'Rest & reset',
    sub: 'Quiet sessions in beautiful places, with everything you need already laid out.',
  },
}

const MAX_GUESTS = 16

export interface StorefrontHeroProps {
  tenant: Tenant
  activities: Activity[]
  featured: Activity[]
  rating: number
  reviewCount: number
  guestsHosted: number
  /** "YYYY-MM-DD" for the frozen demo clock — never `new Date()` in render. */
  todayKey: string
}

/* ==========================================================================
   <StorefrontHero>
   ========================================================================== */

export function StorefrontHero({
  tenant,
  activities,
  featured,
  rating,
  reviewCount,
  guestsHosted,
  todayKey,
}: StorefrontHeroProps) {
  const router = useRouter()
  const reducedMotion = useReducedMotionSafe()
  const base = `/book/${tenant.slug}`

  const brand = useStorefrontBrand(tenant)
  const copy = HERO_COPY[tenant.vertical]
  const cover =
    brand.coverImage ??
    featured[0]?.media.find((m) => m.isPrimary)?.url ??
    featured[0]?.media[0]?.url

  const foundedYear = new Date(tenant.createdAt).getFullYear()
  const years = Math.max(1, 2026 - foundedYear)

  /* ---------- availability bar state ---------- */

  const [activityId, setActivityId] = React.useState<string>(featured[0]?.id ?? activities[0]?.id ?? 'all')
  const [date, setDate] = React.useState(todayKey)
  const [guests, setGuests] = React.useState(2)

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams({ date, guests: String(guests) })
    const selected = activities.find((a) => a.id === activityId)
    if (!selected) {
      router.push(`${base}#experiences`)
      return
    }
    router.push(`${base}/${selected.slug}?${params.toString()}`)
  }

  const stats = [
    { value: rating.toFixed(2), label: 'Guest rating' },
    { value: formatNumber(guestsHosted, { compact: true }), label: 'Guests hosted' },
    { value: String(activities.length), label: 'Experiences' },
    { value: `${years} yrs`, label: `On the water since ${foundedYear}` },
  ]

  return (
    <section className="relative isolate overflow-hidden bg-ink-950">
      {/* ---------- photograph ---------- */}
      <div className="absolute inset-0 -z-10">
        {cover ? (
          <motion.div
            className="absolute inset-0 gpu"
            initial={reducedMotion ? false : { scale: 1.08 }}
            animate={{ scale: 1 }}
            transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <Image
              src={cover}
              alt={`${tenant.name} — ${tenant.city}`}
              fill
              priority
              sizes="100vw"
              unoptimized={!imageIsOptimisable(cover)}
              className="object-cover"
            />
          </motion.div>
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(145deg,var(--color-lagoon-800),var(--color-ink-950))]" />
        )}

        {/* Layered scrim: a top band for header legibility, a heavy foot for the
            headline, and a brand wash so the photo belongs to this operator. */}
        <div
          className={cn(
            'absolute inset-0',
            brand.heroOverlay === 'soft'
              ? 'bg-[linear-gradient(to_bottom,oklch(0.12_0.02_233/0.5)_0%,oklch(0.12_0.02_233/0.14)_30%,oklch(0.12_0.02_233/0.38)_64%,oklch(0.12_0.02_233/0.84)_100%)]'
              : 'bg-[linear-gradient(to_bottom,oklch(0.12_0.02_233/0.72)_0%,oklch(0.12_0.02_233/0.28)_28%,oklch(0.12_0.02_233/0.55)_62%,oklch(0.12_0.02_233/0.92)_100%)]',
          )}
        />
        {brand.heroOverlay === 'brand' ? (
          <div
            className="absolute inset-0 opacity-60"
            style={{ backgroundImage: 'linear-gradient(160deg, var(--brand-primary, var(--primary)) 0%, transparent 70%)' }}
          />
        ) : null}
        <div
          className={cn('absolute inset-0 mix-blend-soft-light', brand.heroOverlay === 'brand' ? 'opacity-100' : brand.heroOverlay === 'soft' ? 'opacity-40' : 'opacity-70')}
          style={{
            backgroundImage:
              'linear-gradient(120deg, color-mix(in oklab, var(--brand-primary, var(--primary)) 85%, transparent), transparent 55%, color-mix(in oklab, var(--brand-accent, var(--accent)) 70%, transparent))',
          }}
        />
      </div>

      <div
        className={cn(
          'mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10',
          brand.heroHeight === 'compact' ? 'pb-10 pt-24 sm:pb-12 sm:pt-28 lg:pb-14 lg:pt-32' : brand.heroHeight === 'tall' ? 'pb-20 pt-36 sm:pb-24 sm:pt-44 lg:pb-28 lg:pt-56' : 'pb-14 pt-28 sm:pb-16 sm:pt-36 lg:pb-20 lg:pt-44',
        )}
      >
        {/* ---------- eyebrow ---------- */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-center gap-x-3 gap-y-2"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-sm">
            {brand.heroEyebrow ?? copy.eyebrow}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-white/75">
            <MapPin className="size-3.5" aria-hidden="true" />
            {tenant.city}, {tenant.country}
          </span>
        </motion.div>

        {/* ---------- headline ---------- */}
        <motion.h1
          initial={reducedMotion ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 max-w-[18ch] font-display text-display-md font-semibold text-white drop-shadow-[0_2px_24px_oklch(0.12_0.02_233/0.5)] lg:text-display-lg"
        >
          {brand.heroTitle ?? tenant.name}
        </motion.h1>

        <motion.p
          initial={reducedMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="mt-5 max-w-[52ch] text-base leading-relaxed text-white/85 sm:text-lg"
        >
          {brand.heroSubtitle ?? copy.sub}
        </motion.p>

        {/* ---------- rating ---------- */}
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-3"
        >
          <div className="flex items-center gap-2">
            <StarRow value={rating} className="text-warning" />
            <span className="text-sm font-semibold tabular text-white">{rating.toFixed(2)}</span>
            <span className="text-sm text-white/70">
              · {formatNumber(reviewCount)} verified {pluralize(reviewCount, 'review')}
            </span>
          </div>
          <span className="hidden h-4 w-px bg-white/25 sm:block" />
          <p className="text-sm text-white/70">
            {formatNumber(guestsHosted)} guests hosted · {activities.length}{' '}
            {pluralize(activities.length, 'experience')} running
          </p>
        </motion.div>

        {/* ---------- availability bar ---------- */}
        <motion.form
          onSubmit={handleSearch}
          initial={reducedMotion ? false : { opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'mt-10 rounded-2xl border border-white/15 bg-[color-mix(in_oklab,var(--surface)_88%,transparent)] p-2.5 shadow-2xl backdrop-blur-2xl',
            'sm:mt-12 lg:rounded-[1.35rem]',
          )}
        >
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]">
            {/* experience */}
            <label className="group relative flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3.5 py-3 transition-colors duration-200 hover:bg-surface-sunken focus-within:border-primary focus-within:bg-surface-sunken">
              <Search className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-faint">
                  Experience
                </span>
                <select
                  value={activityId}
                  onChange={(e) => setActivityId(e.target.value)}
                  aria-label="Choose an experience"
                  className="mt-0.5 w-full cursor-pointer appearance-none truncate bg-transparent pr-5 text-sm font-semibold text-foreground outline-hidden"
                >
                  {activities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {activity.name}
                    </option>
                  ))}
                  <option value="all">Browse everything</option>
                </select>
              </span>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-faint"
                aria-hidden="true"
              />
            </label>

            {/* date */}
            <label className="group flex min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3.5 py-3 transition-colors duration-200 hover:bg-surface-sunken focus-within:border-primary focus-within:bg-surface-sunken">
              <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-faint">
                  Date
                </span>
                <input
                  type="date"
                  value={date}
                  min={todayKey}
                  onChange={(e) => setDate(e.target.value || todayKey)}
                  aria-label="Choose a date"
                  className="mt-0.5 w-full cursor-pointer bg-transparent text-sm font-semibold tabular text-foreground outline-hidden [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-100"
                />
              </span>
            </label>

            {/* guests */}
            <div className="flex min-w-0 items-center gap-3 rounded-xl px-3.5 py-2.5">
              <Users className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-faint">
                  Guests
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <IconButton
                    aria-label="Remove a guest"
                    type="button"
                    size="xs"
                    variant="outline"
                    shape="circle"
                    disabled={guests <= 1}
                    onClick={() => setGuests((g) => Math.max(1, g - 1))}
                  >
                    <Minus aria-hidden="true" />
                  </IconButton>
                  <span className="text-sm font-semibold tabular text-foreground">
                    {guests} {pluralize(guests, 'guest')}
                  </span>
                  <IconButton
                    aria-label="Add a guest"
                    type="button"
                    size="xs"
                    variant="outline"
                    shape="circle"
                    disabled={guests >= MAX_GUESTS}
                    onClick={() => setGuests((g) => Math.min(MAX_GUESTS, g + 1))}
                  >
                    <Plus aria-hidden="true" />
                  </IconButton>
                </span>
              </span>
            </div>

            <Button
              type="submit"
              size="lg"
              className="h-auto min-h-13 rounded-xl px-6 lg:px-7"
              rightIcon={<ArrowRight aria-hidden="true" />}
            >
              Check availability
            </Button>
          </div>
        </motion.form>

        {/* ---------- stat strip ---------- */}
        <motion.dl
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.34 }}
          className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/15 pt-7 sm:mt-12 lg:grid-cols-4"
        >
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0">
              <dt className="sr-only">{stat.label}</dt>
              <dd className="font-display text-2xl font-semibold tabular text-white sm:text-3xl">
                {stat.value}
              </dd>
              <p className="mt-1 truncate text-xs font-medium uppercase tracking-[0.1em] text-white/55">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.dl>
      </div>
    </section>
  )
}

/* ==========================================================================
   <StarRow>
   Five glyphs, partially clipped for the fractional star. Exported because the
   catalogue, the reviews list and the booking widget all draw the same row.
   ========================================================================== */

export function StarRow({
  value,
  size = 'md',
  className,
}: {
  value: number
  size?: 'sm' | 'md'
  className?: string
}) {
  const glyph = size === 'sm' ? 'size-3' : 'size-4'
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i))
        return (
          <span key={i} className={cn('relative', glyph)} aria-hidden="true">
            <Star className={cn(glyph, 'absolute inset-0 text-current opacity-30')} />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star className={cn(glyph, 'text-current')} fill="currentColor" />
            </span>
          </span>
        )
      })}
    </span>
  )
}
