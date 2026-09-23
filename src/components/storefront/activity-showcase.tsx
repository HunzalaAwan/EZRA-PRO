'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Anchor,
  ArrowRight,
  Clock,
  Flame,
  GraduationCap,
  KeyRound,
  LayoutGrid,
  Route,
  SlidersHorizontal,
  Sparkles,
  Ticket,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { ACTIVITY_KINDS, STOREFRONT_GROUPS, kindCardFacts, kindChipLabel, priceUnit } from '@/lib/activity-kinds'

import { cn, formatCurrency, formatDuration, formatNumber, pluralize } from '@/lib/utils'
import type { Activity, ActivityKind, CurrencyCode, DifficultyLevel } from '@/types'
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

const GROUP_ICONS: Record<ActivityKind, LucideIcon> = {
  trip: Route,
  activity: Zap,
  charter: Anchor,
  rental: KeyRound,
  lesson: GraduationCap,
  pass: Ticket,
}

type GroupKey = ActivityKind | 'all'

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
  const [group, setGroup] = React.useState<GroupKey>('all')
  const sectionRef = React.useRef<HTMLElement>(null)

  // A shared link can open straight on one shelf: ?type=rental
  React.useEffect(() => {
    try {
      const wanted = new URLSearchParams(window.location.search).get('type')
      if (wanted && (ACTIVITY_KINDS as string[]).includes(wanted)) setGroup(wanted as ActivityKind)
    } catch {
      /* no URL to read */
    }
  }, [])

  const choose = (next: GroupKey) => {
    setGroup(next)
    try {
      const url = new URL(window.location.href)
      if (next === 'all') url.searchParams.delete('type')
      else url.searchParams.set('type', next)
      window.history.replaceState(null, '', url)
    } catch {
      /* the filter still works without the URL */
    }
    // Once the bar is stuck, bring the start of the list back into view.
    const top = sectionRef.current?.getBoundingClientRect().top ?? 0
    if (top < 0) sectionRef.current?.scrollIntoView({ block: 'start' })
  }

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

  /* ---------- shelves: one per kind that has something on sale ---------- */

  const groups = React.useMemo(
    () =>
      ACTIVITY_KINDS.map((kind) => ({ kind, items: filtered.filter((activity) => (activity.kind ?? 'trip') === kind) })).filter(
        (entry) => entry.items.length > 0,
      ),
    [filtered],
  )
  const grouped = groups.length > 1
  const active: GroupKey = group !== 'all' && groups.some((entry) => entry.kind === group) ? group : 'all'
  const activeItems = active === 'all' ? filtered : (groups.find((entry) => entry.kind === active)?.items ?? [])

  const showFeatured =
    active === 'all' &&
    sort === 'recommended' &&
    featured.length > 0 &&
    (wide || mobileLayout === 'cards')
  const heroCards = featured.slice(0, 2)
  const heroIds = new Set(showFeatured ? heroCards.map((a) => a.id) : [])

  const grid = (items: Activity[], key: string) => (
    <StaggerGroup
      key={key}
      stagger={0.05}
      className={cn('grid', GRID_MOBILE[mobileLayout], GRID_DESKTOP[desktopLayout])}
    >
      {items.map((activity) => (
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
  )

  return (
    <section ref={sectionRef} id="experiences" className="scroll-mt-20 bg-background py-16 sm:py-20 lg:py-24">
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
              {active === 'all'
                ? `${formatNumber(activities.length)} ${pluralize(activities.length, 'experience')}${grouped ? ` in ${groups.length} categories` : ''}, all with live availability.`
                : `${formatNumber(activeItems.length)} in ${STOREFRONT_GROUPS[active].label.toLowerCase()}. ${STOREFRONT_GROUPS[active].blurb}`}{' '}
              Pick a date and your place is held the moment you reserve.
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

        {/* ---------- categories ---------- */}
        {grouped ? (
          <div className="sticky top-16 z-20 sm:top-[4.5rem] -mx-4 mt-8 border-b border-line-subtle bg-background/92 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
            <div role="tablist" aria-label="Categories" className="no-scrollbar -my-1 flex gap-2 overflow-x-auto py-1">
              {[{ kind: 'all' as const, count: activities.length }, ...groups.map((entry) => ({ kind: entry.kind, count: entry.items.length }))].map(({ kind, count }) => {
                const on = active === kind
                const Icon = kind === 'all' ? LayoutGrid : GROUP_ICONS[kind]
                return (
                  <button
                    key={kind}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls="catalogue-list"
                    onClick={() => choose(kind)}
                    className={cn(
                      'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-200',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      on
                        ? 'border-primary bg-primary text-on-primary shadow-sm'
                        : 'border-line bg-surface text-foreground hover:border-primary/40 hover:text-primary',
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {kind === 'all' ? 'All' : STOREFRONT_GROUPS[kind].label}
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-xs font-semibold tabular-nums',
                        on ? 'bg-white/20 text-on-primary' : 'bg-surface-sunken text-muted',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}

        <div id="catalogue-list" role={grouped ? 'tabpanel' : undefined}>
          {/* ---------- featured ---------- */}
          {showFeatured && !grouped ? (
            <StaggerGroup stagger={0.08} className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
              {heroCards.map((activity) => (
                <StaggerItem key={activity.id} direction="up">
                  <FeatureCard activity={activity} currency={currency} basePath={basePath} />
                </StaggerItem>
              ))}
            </StaggerGroup>
          ) : null}

          {active === 'all' && grouped ? (
            /* ---------- one shelf per category ---------- */
            <div className="mt-10 flex flex-col gap-14 sm:gap-16">
              {groups.map((entry) => {
                // Most-booked cards lead their own shelf, so every category shows and nothing repeats.
                const heroes = entry.items.filter((activity) => heroIds.has(activity.id))
                const items = entry.items.filter((activity) => !heroIds.has(activity.id))
                const Icon = GROUP_ICONS[entry.kind]
                const meta = STOREFRONT_GROUPS[entry.kind]
                return (
                  <section key={entry.kind} aria-labelledby={`shelf-${entry.kind}`}>
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line-subtle pb-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <div>
                          <h3 id={`shelf-${entry.kind}`} className="font-display text-xl font-semibold tracking-tight text-foreground">
                            {meta.label}
                            <span className="ml-2 text-sm font-medium text-subtle tabular-nums">{entry.items.length}</span>
                          </h3>
                          <p className="text-sm text-muted">{meta.blurb}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => choose(entry.kind)}
                        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        Only {meta.label.toLowerCase()}
                        <ArrowRight className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    {heroes.length > 0 ? (
                      <StaggerGroup stagger={0.08} className={cn('grid grid-cols-1 gap-5 lg:grid-cols-2', items.length > 0 && 'mb-5')}>
                        {heroes.map((activity) => (
                          <StaggerItem key={activity.id} direction="up">
                            <FeatureCard activity={activity} currency={currency} basePath={basePath} />
                          </StaggerItem>
                        ))}
                      </StaggerGroup>
                    ) : null}
                    {items.length > 0 ? grid(items, `${entry.kind}-${sort}`) : null}
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="mt-6">{grid(activeItems.filter((activity) => !heroIds.has(activity.id)), `${active}-${sort}`)}</div>
          )}
        </div>
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
            <span className="ml-1 text-xs font-medium text-subtle">{priceUnit(activity)}</span>
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
          {kindCardFacts(activity).map((fact, index) => (
            <span key={fact} className="inline-flex items-center gap-1.5">
              {index === 0 ? <Users className="size-3.5" aria-hidden="true" /> : null}
              {index === 1 && (activity.kind ?? 'trip') === 'trip' ? (
                <span className={cn('size-1.5 rounded-full bg-current', DIFFICULTY_TONE[activity.difficulty])} />
              ) : null}
              {fact}
            </span>
          ))}
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
              <span className={cn('ml-1 text-xs font-medium text-subtle', small && 'hidden sm:inline')}>{priceUnit(activity)}</span>
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
