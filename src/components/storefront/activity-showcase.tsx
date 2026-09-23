'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Clock, Flame, SlidersHorizontal, Sparkles, Users } from 'lucide-react'
import { kindChipLabel } from '@/lib/activity-kinds'

import { cn, formatCurrency, formatDuration, formatNumber, pluralize } from '@/lib/utils'
import type { Activity, CurrencyCode, DifficultyLevel } from '@/types'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Reveal } from '@/components/motion/reveal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StarRow } from '@/components/storefront/storefront-hero'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useStorefrontSettings } from '@/hooks/use-storefront-settings'
import type { DesktopLayout, MobileLayout } from '@/lib/storefront-settings'
import type { VerticalKey } from '@/types'

/* ==========================================================================
   FILTER MODEL
   ========================================================================== */

const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  easy: 'Easy going',
  moderate: 'Moderate',
  challenging: 'Challenging',
  extreme: 'Extreme',
}

const DIFFICULTY_TONE: Record<DifficultyLevel, string> = {
  easy: 'text-success',
  moderate: 'text-info',
  challenging: 'text-warning',
  extreme: 'text-danger',
}

type SortKey = 'recommended' | 'price-asc' | 'price-desc' | 'rating' | 'duration'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
  { value: 'duration', label: 'Shortest first' },
]

export interface ActivityShowcaseProps {
  activities: Activity[]
  featured: Activity[]
  currency: CurrencyCode
  basePath: string
  /** The operator's saved layout is read for this tenant. */
  tenantSlug: string
  vertical: VerticalKey
}

/* ---------- layout classes, one static string per choice so Tailwind sees them ---------- */

const GRID_MOBILE: Record<MobileLayout, string> = {
  cards: 'grid-cols-1 gap-5',
  grid: 'grid-cols-2 gap-3 sm:gap-5',
  list: 'grid-cols-1 gap-3 sm:gap-5',
}
const GRID_DESKTOP: Record<DesktopLayout, string> = {
  grid: 'sm:grid-cols-2 lg:grid-cols-3',
  list: 'sm:grid-cols-1',
}

/* ==========================================================================
   <ActivityShowcase>
   ========================================================================== */

export function ActivityShowcase({
  activities,
  featured,
  currency,
  basePath,
  tenantSlug,
  vertical,
}: ActivityShowcaseProps) {
  const { settings } = useStorefrontSettings(tenantSlug, vertical)
  const wide = useMediaQuery('(min-width: 640px)', true)
  const mobileLayout = settings.mobileLayout
  const desktopLayout = settings.desktopLayout
  const [sort, setSort] = React.useState<SortKey>('recommended')

  /* ---------- the catalogue, in the chosen order ---------- */

  const filtered = React.useMemo(() => {
    const sorted = [...activities]
    switch (sort) {
      case 'price-asc':
        sorted.sort((a, b) => a.basePrice - b.basePrice)
        break
      case 'price-desc':
        sorted.sort((a, b) => b.basePrice - a.basePrice)
        break
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
        break
      case 'duration':
        sorted.sort((a, b) => a.durationMinutes - b.durationMinutes)
        break
      default:
        sorted.sort(
          (a, b) =>
            Number(b.featured) - Number(a.featured) ||
            b.rating - a.rating ||
            b.reviewCount - a.reviewCount,
        )
    }
    return sorted
  }, [activities, sort])

  const showFeatured =
    sort === 'recommended' &&
    featured.length > 0 &&
    (wide || mobileLayout === 'cards')
  const heroCards = featured.slice(0, 2)
  const heroIds = new Set(showFeatured ? heroCards.map((a) => a.id) : [])
  const gridCards = filtered.filter((a) => !heroIds.has(a.id))

  return (
    <section id="experiences" className="scroll-mt-24 bg-background py-16 sm:py-20 lg:py-24">
      <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
        {/* ---------- heading ---------- */}
        <Reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="size-3.5" aria-hidden="true" />
              The catalogue
            </p>
            <h2 className="mt-3 font-display text-display-sm font-semibold tracking-tight text-foreground">
              Every experience we run
            </h2>
            <p className="mt-3 text-base leading-relaxed text-muted">
              {formatNumber(activities.length)} {pluralize(activities.length, 'experience')}, all
              with live availability. Pick a date and your seats are held the moment you reserve.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="hidden text-xs font-medium text-subtle sm:inline">Sort</span>
            <Select value={sort} onValueChange={(value) => setSort(value as SortKey)}>
              <SelectTrigger
                className="w-[13.5rem]"
                icon={<SlidersHorizontal aria-hidden="true" />}
                aria-label="Sort experiences"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Reveal>

        {/* ---------- featured ---------- */}
        {showFeatured ? (
          <StaggerGroup stagger={0.08} className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {heroCards.map((activity) => (
              <StaggerItem key={activity.id} direction="up">
                <FeatureCard activity={activity} currency={currency} basePath={basePath} />
              </StaggerItem>
            ))}
          </StaggerGroup>
        ) : null}

        {/* ---------- grid ---------- */}
        {/* ---------- grid ---------- */}
          <StaggerGroup
            stagger={0.05}
            className={cn('mt-6 grid', GRID_MOBILE[mobileLayout], GRID_DESKTOP[desktopLayout])}
          >
            {gridCards.map((activity) => (
              <StaggerItem key={activity.id} direction="up" className="h-full">
                <ActivityCard
                  activity={activity}
                  currency={currency}
                  basePath={basePath}
                  mobileLayout={mobileLayout}
                  desktopLayout={desktopLayout}
                />
              </StaggerItem>
            ))}
          </StaggerGroup>
      </div>
    </section>
  )
}

function primaryMedia(activity: Activity) {
  return activity.media.find((m) => m.isPrimary) ?? activity.media[0]
}

function FeatureCard({
  activity,
  currency,
  basePath,
}: {
  activity: Activity
  currency: CurrencyCode
  basePath: string
}) {
  const media = primaryMedia(activity)

  return (
    <Link
      href={`${basePath}/${activity.slug}`}
      className={cn(
        'group relative block h-full overflow-hidden rounded-2xl border border-line bg-ink-950 shadow-lg',
        'transition-[transform,box-shadow,border-color] duration-500 ease-[var(--ease-out-expo)]',
        'hover:-translate-y-1 hover:shadow-2xl',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      <div className="relative aspect-[16/11] w-full overflow-hidden sm:aspect-[16/9]">
        {media ? (
          <Image
            src={media.url}
            alt={media.alt}
            fill
            sizes="(min-width: 1024px) 44vw, 100vw"
            className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.06]"
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,oklch(0.12_0.02_233/0.94)_0%,oklch(0.12_0.02_233/0.42)_42%,oklch(0.12_0.02_233/0.1)_72%)]" />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            <Clock className="size-3" aria-hidden="true" />
            {kindChipLabel(activity)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-on-accent shadow-sm">
            <Flame className="size-3" aria-hidden="true" />
            Most booked
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <StarRow value={activity.rating} size="sm" className="text-warning" />
            <span className="text-xs font-semibold tabular text-white">
              {activity.rating.toFixed(1)}
            </span>
            <span className="text-xs text-white/60">
              ({formatNumber(activity.reviewCount)})
            </span>
          </div>
          <h3 className="mt-2 font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {activity.name}
          </h3>
          <p className="mt-2 line-clamp-2 max-w-[46ch] text-sm leading-relaxed text-white/75">
            {activity.tagline}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 bg-surface px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-faint">
            From
          </p>
          <p className="font-display text-lg font-semibold tabular text-foreground">
            {formatCurrency(activity.basePrice, currency)}
            <span className="ml-1 text-xs font-medium text-subtle">per person</span>
          </p>
        </div>
        <span
          className={cn(
            'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-on-primary shadow-sm',
            'transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5',
          )}
        >
          Check dates
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  )
}

/* ---------- the card, shaped by the two layout choices ----------
   Every class is a static string keyed by the choice, so a phone list can
   sit beside a desktop grid: the base classes handle phones, the sm: ones
   take over from 640px. */

const ROOT_MOBILE: Record<MobileLayout, string> = { cards: 'flex-col', grid: 'flex-col', list: 'flex-row' }
const ROOT_DESKTOP: Record<DesktopLayout, string> = { grid: 'sm:flex-col', list: 'sm:flex-row' }
const MEDIA_MOBILE: Record<MobileLayout, string> = {
  cards: 'aspect-[4/3] w-full',
  grid: 'aspect-square w-full',
  list: 'w-28 shrink-0 self-stretch',
}
const MEDIA_DESKTOP: Record<DesktopLayout, string> = {
  grid: 'sm:aspect-[4/3] sm:w-full sm:shrink sm:self-auto',
  list: 'sm:aspect-auto sm:w-72 sm:min-h-44 sm:shrink-0 sm:self-stretch',
}
const BODY_MOBILE: Record<MobileLayout, string> = { cards: 'p-5', grid: 'p-3 sm:p-5', list: 'p-3.5 sm:p-5' }
const BODY_DESKTOP: Record<DesktopLayout, string> = { grid: '', list: 'sm:justify-center' }

function ActivityCard({
  activity,
  currency,
  basePath,
  mobileLayout,
  desktopLayout,
}: {
  activity: Activity
  currency: CurrencyCode
  basePath: string
  mobileLayout: MobileLayout
  desktopLayout: DesktopLayout
}) {
  const media = primaryMedia(activity)
  const small = mobileLayout !== 'cards'

  return (
    <Link
      href={`${basePath}/${activity.slug}`}
      className={cn(
        'group flex h-full overflow-hidden rounded-2xl border border-line bg-surface shadow-sm',
        ROOT_MOBILE[mobileLayout],
        ROOT_DESKTOP[desktopLayout],
        'transition-[transform,box-shadow,border-color] duration-500 ease-[var(--ease-out-expo)]',
        'hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      )}
    >
      <div className={cn('relative overflow-hidden bg-surface-sunken', MEDIA_MOBILE[mobileLayout], MEDIA_DESKTOP[desktopLayout])}>
        {media ? (
          <Image
            src={media.url}
            alt={media.alt}
            fill
            sizes="(min-width: 1024px) 29vw, (min-width: 640px) 45vw, 100vw"
            className="object-cover transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.07]"
          />
        ) : null}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,oklch(0.12_0.02_233/0.55),transparent_45%)]" />

        <span
          className={cn(
            'absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/12 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm',
            mobileLayout === 'list' && 'hidden sm:inline-flex',
          )}
        >
          <Clock className="size-3" aria-hidden="true" />
          {kindChipLabel(activity)}
        </span>

        {activity.featured ? (
          <span
            className={cn(
              'absolute right-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-on-accent shadow-sm',
              small && 'hidden sm:block',
            )}
          >
            Featured
          </span>
        ) : null}

        <div className={cn('absolute inset-x-3 bottom-3 items-center gap-2', small ? 'hidden sm:flex' : 'flex')}>
          <StarRow value={activity.rating} size="sm" className="text-warning" />
          <span className="text-xs font-semibold tabular text-white">
            {activity.rating.toFixed(1)}
          </span>
          <span className="text-xs text-white/65">({formatNumber(activity.reviewCount)})</span>
        </div>
      </div>

      <div className={cn('flex min-w-0 flex-1 flex-col', BODY_MOBILE[mobileLayout], BODY_DESKTOP[desktopLayout])}>
        <h3
          className={cn(
            'font-display font-semibold leading-snug tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary',
            small ? 'text-[0.9375rem] sm:text-[1.0625rem]' : 'text-[1.0625rem]',
          )}
        >
          {activity.name}
        </h3>
        <p
          className={cn(
            'mt-2 text-sm leading-relaxed text-muted',
            mobileLayout === 'grid' ? 'hidden sm:line-clamp-2' : mobileLayout === 'list' ? 'line-clamp-1 sm:line-clamp-2' : 'line-clamp-2',
          )}
        >
          {activity.tagline}
        </p>

        <div className={cn('mt-4 flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-subtle', small ? 'hidden sm:flex' : 'flex')}>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden="true" />
            Up to {activity.maxCapacity}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn('size-1.5 rounded-full bg-current', DIFFICULTY_TONE[activity.difficulty])}
            />
            {DIFFICULTY_LABEL[activity.difficulty]}
          </span>
          <span className="inline-flex items-center gap-1.5">Ages {activity.minAge}+</span>
        </div>

        <div
          className={cn(
            'flex items-end justify-between gap-3 border-t border-line-subtle',
            small ? 'mt-3 pt-3 sm:mt-5 sm:pt-4' : 'mt-5 pt-4',
          )}
        >
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-faint">
              From
            </p>
            <p className={cn('font-display font-semibold tabular text-foreground', small ? 'text-base sm:text-lg' : 'text-lg')}>
              {formatCurrency(activity.basePrice, currency)}
            </p>
          </div>
          <span
            className={cn(
              'h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-[0.8125rem] font-medium text-foreground',
              'transition-all duration-300 ease-[var(--ease-out-expo)]',
              'group-hover:border-primary group-hover:bg-primary group-hover:text-on-primary',
              mobileLayout === 'grid' ? 'hidden sm:inline-flex' : 'inline-flex',
            )}
          >
            Book
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  )
}
