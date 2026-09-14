'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Archive,
  Copy,
  ExternalLink,
  Gauge,
  PencilLine,
  Star,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react'

import type { Activity, DifficultyLevel } from '@/types'
import { cn, formatCurrency, formatDelta, formatDuration, formatNumber } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { IconButton } from '@/components/ui/icon-button'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toaster'
import { Sparkline } from '@/components/charts/sparkline'
import type { ActivitySummary } from './activity-data'

/* ==========================================================================
   SHARED ACTIVITY CHROME
   The colour a tenant assigns an activity drives its calendar tint, its rail on
   the card and the series colour of its sparkline — mapped once, here.
   ========================================================================== */

export const ACTIVITY_ACCENT: Record<
  Activity['colorKey'],
  { chart: string; rail: string; soft: string; text: string }
> = {
  lagoon: { chart: 'var(--chart-1)', rail: 'bg-lagoon-500', soft: 'bg-lagoon-500/12', text: 'text-primary' },
  coral: { chart: 'var(--chart-2)', rail: 'bg-coral-500', soft: 'bg-coral-500/12', text: 'text-accent' },
  reef: { chart: 'var(--chart-3)', rail: 'bg-reef-500', soft: 'bg-reef-500/12', text: 'text-foreground' },
  sunset: { chart: 'var(--chart-4)', rail: 'bg-sunset-500', soft: 'bg-sunset-500/12', text: 'text-warning' },
  info: { chart: 'var(--chart-5)', rail: 'bg-info', soft: 'bg-info/12', text: 'text-info' },
  success: { chart: 'var(--chart-6)', rail: 'bg-success', soft: 'bg-success/12', text: 'text-success' },
}

/**
 * Photo scrim. Written as an inline gradient rather than an arbitrary Tailwind
 * value because the alpha slashes inside `oklch()` collide with the class
 * parser's opacity modifier.
 */
export const MEDIA_SCRIM =
  'linear-gradient(180deg, oklch(0.15 0.02 233 / 0.58) 0%, transparent 36%, oklch(0.15 0.02 233 / 0.10) 60%, oklch(0.13 0.02 233 / 0.88) 100%)'

export const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  challenging: 'Challenging',
  extreme: 'Extreme',
}

export const DIFFICULTY_BARS: Record<DifficultyLevel, number> = {
  easy: 1,
  moderate: 2,
  challenging: 3,
  extreme: 4,
}

export function activityHref(id: string) {
  return `/dashboard/activities/${id}`
}

export function storefrontHref(tenantSlug: string, activitySlug: string) {
  return `/book/${tenantSlug}/${activitySlug}`
}

/** Primary media, falling back to the first frame if none is flagged. */
export function primaryMedia(activity: Activity) {
  return activity.media.find((m) => m.isPrimary) ?? activity.media[0] ?? null
}

/* ==========================================================================
   ROW ACTIONS — shared by the card overlay and the table menu
   ========================================================================== */

export interface ActivityActionHandlers {
  onEdit: () => void
  onDuplicate: () => void
  onPreview: () => void
  onArchive: () => void
}

export function useActivityActions(
  summary: ActivitySummary,
  tenantSlug: string,
): ActivityActionHandlers {
  const router = useRouter()
  const { activity } = summary

  return React.useMemo(
    () => ({
      onEdit: () => router.push(activityHref(activity.id)),
      onDuplicate: () =>
        toast.success(`Duplicated “${activity.name}”`, {
          description: 'The copy was saved as a draft so you can edit it safely.',
        }),
      onPreview: () => window.open(storefrontHref(tenantSlug, activity.slug), '_blank', 'noopener'),
      onArchive: () =>
        toast(`Archived “${activity.name}”`, {
          description: 'It is hidden from the storefront. Existing bookings are untouched.',
          action: { label: 'Undo', onClick: () => toast.success('Restored to the catalog') },
        }),
    }),
    [activity.id, activity.name, activity.slug, router, tenantSlug],
  )
}

/* ==========================================================================
   DIFFICULTY METER
   ========================================================================== */

export function DifficultyMeter({
  difficulty,
  className,
}: {
  difficulty: DifficultyLevel
  className?: string
}) {
  const level = DIFFICULTY_BARS[difficulty]
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span aria-hidden="true" className="flex items-end gap-[2px]">
        {[1, 2, 3, 4].map((step) => (
          <span
            key={step}
            className={cn(
              'w-[3px] rounded-full transition-colors duration-300',
              step === 1 && 'h-1.5',
              step === 2 && 'h-2',
              step === 3 && 'h-2.5',
              step === 4 && 'h-3',
              step <= level ? 'bg-current' : 'bg-current/20',
            )}
          />
        ))}
      </span>
      {DIFFICULTY_LABEL[difficulty]}
    </span>
  )
}

/* ==========================================================================
   CARD
   ========================================================================== */

export interface ActivityCardProps {
  summary: ActivitySummary
  tenantSlug: string
  className?: string
}

export function ActivityCard({ summary, tenantSlug, className }: ActivityCardProps) {
  const { activity } = summary
  const accent = ACTIVITY_ACCENT[activity.colorKey]
  const media = primaryMedia(activity)
  const actions = useActivityActions(summary, tenantSlug)
  const trendUp = summary.deltaBookingsPercent >= 0

  const stop = (event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  return (
    <Card
      className={cn(
        'group/card h-full overflow-hidden p-0',
        'hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl',
        'focus-within:border-primary/40 focus-within:shadow-xl',
        activity.status === 'archived' && 'opacity-70',
        className,
      )}
    >
      {/* ---------- media ---------- */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-sunken">
        {media ? (
          <Image
            src={media.url}
            alt={media.alt}
            fill
            sizes="(min-width: 1280px) 26rem, (min-width: 768px) 45vw, 100vw"
            className={cn(
              'object-cover transition-transform duration-[900ms] ease-[var(--ease-out-expo)]',
              'group-hover/card:scale-[1.07] motion-reduce:transform-none',
            )}
          />
        ) : (
          <div className={cn('absolute inset-0', accent.soft)} />
        )}

        {/* scrim: keeps the overlaid type legible on any photograph */}
        <div aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: MEDIA_SCRIM }} />

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge
              kind="activity"
              status={activity.status}
              size="sm"
              className="glass-strong border-white/20 shadow-sm"
            />
            {activity.featured ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sunset-400/90 px-2 py-0.5 text-[0.6875rem] font-semibold text-ink-950 shadow-sm">
                <Star className="size-3 fill-current" aria-hidden="true" />
                Featured
              </span>
            ) : null}
          </div>

          {/* hover/focus-revealed actions — above the stretched link */}
          <div
            className={cn(
              'relative z-20 flex items-center gap-1 transition-all duration-300 ease-[var(--ease-out-expo)]',
              'translate-y-[-6px] opacity-0',
              'group-hover/card:translate-y-0 group-hover/card:opacity-100',
              'group-focus-within/card:translate-y-0 group-focus-within/card:opacity-100',
              'motion-reduce:translate-y-0 motion-reduce:transition-none',
            )}
          >
            <SimpleTooltip label="Edit activity">
              <IconButton
                aria-label={`Edit ${activity.name}`}
                size="xs"
                variant="glass"
                onClick={(event) => {
                  stop(event)
                  actions.onEdit()
                }}
              >
                <PencilLine />
              </IconButton>
            </SimpleTooltip>
            <SimpleTooltip label="Duplicate">
              <IconButton
                aria-label={`Duplicate ${activity.name}`}
                size="xs"
                variant="glass"
                onClick={(event) => {
                  stop(event)
                  actions.onDuplicate()
                }}
              >
                <Copy />
              </IconButton>
            </SimpleTooltip>
            <SimpleTooltip label="View on storefront">
              <IconButton
                aria-label={`Preview ${activity.name} on the storefront`}
                size="xs"
                variant="glass"
                onClick={(event) => {
                  stop(event)
                  actions.onPreview()
                }}
              >
                <ExternalLink />
              </IconButton>
            </SimpleTooltip>
            <SimpleTooltip label="Archive">
              <IconButton
                aria-label={`Archive ${activity.name}`}
                size="xs"
                variant="glass"
                onClick={(event) => {
                  stop(event)
                  actions.onArchive()
                }}
              >
                <Archive />
              </IconButton>
            </SimpleTooltip>
          </div>
        </div>

        {/* price + rating sit on the photo, the way a storefront tile reads */}
        <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.6875rem] font-medium tracking-wide text-white/70 uppercase">
              From
            </p>
            <p className="font-display text-lg leading-tight font-semibold text-white">
              {formatCurrency(summary.fromPrice, activity.currency)}
              <span className="ml-1 text-xs font-medium text-white/70">
                {activity.pricingModel === 'per_group' ? '/ group' : '/ guest'}
              </span>
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-ink-950/55 px-2 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            <Star className="size-3.5 fill-sunset-300 text-sunset-300" aria-hidden="true" />
            {activity.rating.toFixed(2)}
            <span className="font-normal text-white/60">({formatNumber(activity.reviewCount)})</span>
          </span>
        </div>
      </div>

      {/* ---------- body ---------- */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="font-display text-[0.9375rem] leading-snug font-semibold text-balance">
            <Link
              href={activityHref(activity.id)}
              className="rounded-sm outline-none after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:text-primary"
            >
              {activity.name}
            </Link>
          </h3>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">{activity.tagline}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-subtle">
          <span className="inline-flex items-center gap-1.5">
            <Timer className="size-3.5 text-faint" aria-hidden="true" />
            {formatDuration(activity.durationMinutes)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-3.5 text-faint" aria-hidden="true" />
            {activity.maxCapacity} max
          </span>
          <DifficultyMeter difficulty={activity.difficulty} className="text-subtle" />
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-line-subtle pt-3">
          <div className="min-w-0">
            <p className="flex items-baseline gap-1.5">
              <span className="font-display text-base font-semibold tabular">
                {formatNumber(summary.bookings30d)}
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 text-[0.6875rem] font-semibold',
                  trendUp ? 'text-success' : 'text-danger',
                )}
              >
                {trendUp ? (
                  <TrendingUp className="size-3" aria-hidden="true" />
                ) : (
                  <TrendingDown className="size-3" aria-hidden="true" />
                )}
                {formatDelta(summary.deltaBookingsPercent, 0)}
              </span>
            </p>
            <p className="text-[0.6875rem] text-faint">bookings · last 30 days</p>
          </div>

          <div className="flex flex-col items-end gap-1">
            <Sparkline
              values={summary.sparkline.length > 1 ? summary.sparkline : [0, 0]}
              width={84}
              height={26}
              color={accent.chart}
              fill
              showLastDot
              ariaLabel={`${activity.name} booking trend over the last 30 days`}
            />
            <span className="inline-flex items-center gap-1 text-[0.6875rem] text-faint">
              <Gauge className="size-3" aria-hidden="true" />
              {summary.occupancy30d.toFixed(0)}% full
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
