import { Fragment, type CSSProperties } from 'react'
import {
  CalendarDays,
  ChartSpline,
  Check,
  CreditCard,
  Share2,
  ShoppingCart,
  Store,
  TrendingUp,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { SectionHeading } from '@/components/marketing/section-heading'
import { SpotlightCard, SpotlightGroup } from '@/components/motion/spotlight'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { FEATURE_BLOCKS } from '@/content/marketing'
import {
  average,
  cn,
  createRng,
  formatDelta,
  hashSeed,
  percentChange,
  rngInt,
  rngPick,
  sparklinePath,
} from '@/lib/utils'
import type { FeatureBlock } from '@/types'

/* ==========================================================================
   Tokens & helpers
   ========================================================================== */

/** Decorative tint per pillar — brand ramp, not a semantic token. */
const ACCENT_VAR: Record<FeatureBlock['accent'], string> = {
  lagoon: 'var(--color-lagoon-500)',
  coral: 'var(--color-coral-500)',
  sunset: 'var(--color-sunset-500)',
  reef: 'var(--color-reef-500)',
}

/** lucide export names carried on `FeatureBlock.icon`. */
const FEATURE_ICONS: Record<string, LucideIcon> = {
  ShoppingCart,
  CalendarDays,
  ChartSpline,
  CreditCard,
  Users,
  Share2,
  Store,
  UserCog,
}

const ENTITIES: Record<string, string> = {
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&nbsp;': ' ',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
}

/** FEATURE_BLOCKS copy carries HTML entities; JSX renders text, so decode them. */
function plainText(input: string): string {
  return input.replace(
    /&(?:rsquo|lsquo|ldquo|rdquo|mdash|ndash|hellip|nbsp|amp|quot|apos|#39);/g,
    (match) => ENTITIES[match] ?? match,
  )
}

/* ==========================================================================
   Bento layout
   Six columns at `lg`, two at `md`, one on phones. The spans below tile the
   grid exactly in source order, so no `grid-flow-dense` and no holes:
     rows 1-2  checkout (2) · calendar (4)
     rows 3-4  analytics (3, 2 rows) · payments (3) · crm (3)
     row  5    channels (2) · storefront (2) · team (2)
   ========================================================================== */

interface TileSpec {
  span: string
  /** Title type scale — the large tiles carry the section's weight. */
  title: string
  bulletGrid: string
  visual?: 'calendar' | 'analytics'
}

const DEFAULT_TILE: TileSpec = {
  span: 'md:col-span-1 lg:col-span-2',
  title: 'text-lg',
  bulletGrid: 'grid-cols-1',
}

const TILES: Record<string, TileSpec> = {
  'feat-checkout': {
    span: 'md:col-span-2 lg:col-span-2 lg:row-span-2',
    title: 'text-xl sm:text-2xl',
    bulletGrid: 'grid-cols-1',
  },
  'feat-calendar': {
    span: 'md:col-span-2 lg:col-span-4 lg:row-span-2',
    title: 'text-xl sm:text-2xl',
    bulletGrid: 'grid-cols-1 sm:grid-cols-2',
    visual: 'calendar',
  },
  'feat-analytics': {
    span: 'md:col-span-2 lg:col-span-3 lg:row-span-2',
    title: 'text-xl sm:text-2xl',
    bulletGrid: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-1',
    visual: 'analytics',
  },
  'feat-payments': {
    span: 'md:col-span-1 lg:col-span-3',
    title: 'text-lg',
    bulletGrid: 'grid-cols-1 sm:grid-cols-2',
  },
  'feat-crm': {
    span: 'md:col-span-1 lg:col-span-3',
    title: 'text-lg',
    bulletGrid: 'grid-cols-1 sm:grid-cols-2',
  },
  'feat-channels': { span: 'md:col-span-1 lg:col-span-2', title: 'text-lg', bulletGrid: 'grid-cols-1' },
  'feat-storefront': { span: 'md:col-span-1 lg:col-span-2', title: 'text-lg', bulletGrid: 'grid-cols-1' },
  'feat-team': { span: 'md:col-span-2 lg:col-span-2', title: 'text-lg', bulletGrid: 'grid-cols-1' },
}

/* ==========================================================================
   <FeatureBento>
   ========================================================================== */

export interface FeatureBentoProps {
  className?: string
}

/**
 * The eight product pillars, laid out as a genuine bento rather than a row of
 * identical cards: two anchor tiles carry an inline mini-visual, the rest step
 * down in weight around them. Cards lift on hover and take a cursor-following
 * spotlight from a single shared pointer listener.
 */
export function FeatureBento({ className }: FeatureBentoProps) {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      className={cn('relative bg-background py-20 sm:py-28 lg:py-32', className)}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id="features-title"
          eyebrow="The platform"
          title="Everything an operator actually needs"
          description="Eight systems that used to be eight subscriptions — availability, checkout, crew, cash, guests, channels, storefront and permissions — all running off one inventory and one guest record."
          className="max-w-3xl"
        />

        <SpotlightGroup className="mt-12 sm:mt-14 lg:mt-16">
          <StaggerGroup
            as="ul"
            stagger={0.06}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-6"
          >
            {FEATURE_BLOCKS.map((block) => (
              <FeatureTile key={block.id} block={block} />
            ))}
          </StaggerGroup>
        </SpotlightGroup>
      </div>
    </section>
  )
}

/* ==========================================================================
   <FeatureTile>
   ========================================================================== */

function FeatureTile({ block }: { block: FeatureBlock }) {
  const spec = TILES[block.id] ?? DEFAULT_TILE
  const tint = ACCENT_VAR[block.accent]
  const Icon = FEATURE_ICONS[block.icon] ?? ShoppingCart

  return (
    <StaggerItem as="li" distance={22} className={cn('min-w-0', spec.span)}>
      <SpotlightCard
        color={block.accent}
        size={420}
        intensity={0.3}
        className={cn(
          'h-full rounded-2xl border border-line bg-surface shadow-sm',
          'transition duration-300 ease-[var(--ease-out-expo)]',
          'hover:-translate-y-1 hover:border-line-strong hover:shadow-xl',
        )}
      >
        <div className="relative flex h-full flex-col p-5 sm:p-6">
          {/* accent wash, keyed to the pillar */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background: `radial-gradient(110% 80% at 0% 0%, color-mix(in oklab, ${tint} 11%, transparent), transparent 62%)`,
            }}
          />

          <div className="flex items-center gap-3">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: `color-mix(in oklab, ${tint} 14%, transparent)`,
                boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${tint} 26%, transparent)`,
              }}
            >
              <Icon aria-hidden="true" className="size-5" style={{ color: tint }} />
            </span>
            <span
              className="text-xs font-semibold uppercase tracking-[0.16em]"
              style={{ color: tint }}
            >
              {block.eyebrow}
            </span>
          </div>

          <h3
            className={cn(
              'mt-5 font-display font-semibold text-pretty text-foreground',
              spec.title,
            )}
          >
            {plainText(block.title)}
          </h3>

          <p className="mt-2.5 max-w-[56ch] text-sm leading-relaxed text-muted">
            {plainText(block.description)}
          </p>

          <div className="mt-auto pt-6">
            <ul className={cn('grid gap-2', spec.bulletGrid)}>
              {block.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2">
                  <Check
                    aria-hidden="true"
                    strokeWidth={3}
                    className="mt-[3px] size-3.5 shrink-0"
                    style={{ color: tint }}
                  />
                  <span className="text-[0.8125rem] leading-snug text-foreground/75">
                    {plainText(bullet)}
                  </span>
                </li>
              ))}
            </ul>

            {spec.visual === 'calendar' ? <CalendarMini tint={tint} /> : null}
            {spec.visual === 'analytics' ? <AnalyticsMini tint={tint} /> : null}
          </div>
        </div>
      </SpotlightCard>
    </StaggerItem>
  )
}

/* ==========================================================================
   Inline mini-visuals
   Pure CSS/SVG, seeded once at module scope so the markup is identical on the
   server and the client and costs nothing to re-render.
   ========================================================================== */

const MINI_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const MINI_BANDS = ['9a', '12p', '3p'] as const
const MINI_TRIPS = ['Sail', 'Dive', 'Reef', 'Surf', 'SUP', 'Cruise', 'Charter'] as const
const MINI_TONES = [
  'var(--color-lagoon-500)',
  'var(--color-coral-500)',
  'var(--color-sunset-500)',
  'var(--color-reef-500)',
] as const

interface MiniCell {
  key: string
  trip: string
  tone: string
  full: boolean
}

/** 3 time bands × 7 days — roughly two thirds of the slots run. */
const CALENDAR_CELLS: (MiniCell | null)[][] = (() => {
  const rng = createRng(hashSeed('ezra-bento-calendar'))
  return MINI_BANDS.map((_band, bandIndex) =>
    MINI_DAYS.map((_, dayIndex) => {
      if (rng() > 0.66) return null
      return {
        key: `cell-${bandIndex}-${dayIndex}`,
        trip: rngPick(rng, MINI_TRIPS),
        tone: rngPick(rng, MINI_TONES),
        full: rng() > 0.7,
      }
    }),
  )
})()

function CalendarMini({ tint }: { tint: string }) {
  return (
    <div
      aria-hidden="true"
      className="mt-5 rounded-xl border border-line-subtle bg-surface-sunken/50 p-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
          This week
        </span>
        <span className="flex items-center gap-1.5 text-xs font-medium text-subtle">
          <span className="size-1.5 rounded-full" style={{ background: tint }} />
          4 vessels · 6 crew
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-[1.25rem_repeat(7,minmax(0,1fr))] gap-1">
        <span />
        {MINI_DAYS.map((day, index) => (
          <span
            key={`head-${index}`}
            className="text-center text-xs font-semibold uppercase text-faint"
          >
            {day}
          </span>
        ))}

        {CALENDAR_CELLS.map((row, bandIndex) => (
          <Fragment key={MINI_BANDS[bandIndex]}>
            <span className="pr-1 text-right text-xs leading-5 text-faint">
              {MINI_BANDS[bandIndex]}
            </span>
            {row.map((cell, dayIndex) =>
              cell ? (
                <span
                  key={cell.key}
                  className="truncate rounded-[5px] px-1 text-center text-xs font-medium leading-5"
                  style={
                    cell.full
                      ? {
                          background: `color-mix(in oklab, ${cell.tone} 80%, transparent)`,
                          color: 'var(--color-ink-975)',
                        }
                      : {
                          background: `color-mix(in oklab, ${cell.tone} 15%, transparent)`,
                          color: cell.tone,
                          boxShadow: `inset 2px 0 0 0 ${cell.tone}`,
                        }
                  }
                >
                  {cell.trip}
                </span>
              ) : (
                <span
                  key={`empty-${bandIndex}-${dayIndex}`}
                  className="h-5 rounded-[5px] bg-line-subtle/50"
                />
              ),
            )}
          </Fragment>
        ))}
      </div>
    </div>
  )
}

/** 14 weeks of occupancy, drifting upward. */
const ANALYTICS_SERIES: number[] = (() => {
  const rng = createRng(hashSeed('ezra-bento-analytics'))
  const values: number[] = []
  let value = rngInt(rng, 32, 46)
  for (let index = 0; index < 14; index += 1) {
    value = Math.max(20, Math.min(98, value + rngInt(rng, -6, 13)))
    values.push(value)
  }
  return values
})()

const ANALYTICS_WIDTH = 260
const ANALYTICS_HEIGHT = 72
const ANALYTICS_PAD = 4
const ANALYTICS_LINE = sparklinePath(
  ANALYTICS_SERIES,
  ANALYTICS_WIDTH,
  ANALYTICS_HEIGHT,
  ANALYTICS_PAD,
)
const ANALYTICS_AREA = `${ANALYTICS_LINE} L${ANALYTICS_WIDTH - ANALYTICS_PAD},${ANALYTICS_HEIGHT - ANALYTICS_PAD} L${ANALYTICS_PAD},${ANALYTICS_HEIGHT - ANALYTICS_PAD} Z`
/** Last four weeks against the four before — not the whole 14-week ramp. */
const ANALYTICS_DELTA = percentChange(
  average(ANALYTICS_SERIES.slice(-4)),
  average(ANALYTICS_SERIES.slice(-8, -4)),
)
const ANALYTICS_PEAK = Math.max(...ANALYTICS_SERIES)

function AnalyticsMini({ tint }: { tint: string }) {
  return (
    <div
      aria-hidden="true"
      className="mt-5 rounded-xl border border-line-subtle bg-surface-sunken/50 p-3"
      style={{ '--mini-tint': tint } as CSSProperties}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">
            Occupancy · 14 weeks
          </p>
          <p className="mt-1 font-display text-xl font-semibold leading-none text-foreground">
            {ANALYTICS_PEAK}%
            <span className="ml-1.5 text-xs font-medium text-subtle">peak week</span>
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
          <TrendingUp className="size-3" />
          {formatDelta(ANALYTICS_DELTA)}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${ANALYTICS_WIDTH} ${ANALYTICS_HEIGHT}`}
        preserveAspectRatio="none"
        className="mt-2 h-16 w-full"
      >
        <defs>
          <linearGradient id="bento-analytics-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--mini-tint)' }} stopOpacity={0.34} />
            <stop offset="100%" style={{ stopColor: 'var(--mini-tint)' }} stopOpacity={0} />
          </linearGradient>
        </defs>

        {[0.25, 0.6].map((ratio) => (
          <line
            key={ratio}
            x1={ANALYTICS_PAD}
            x2={ANALYTICS_WIDTH - ANALYTICS_PAD}
            y1={ANALYTICS_HEIGHT * ratio}
            y2={ANALYTICS_HEIGHT * ratio}
            strokeWidth={1}
            strokeDasharray="3 5"
            style={{ stroke: 'var(--border)' }}
          />
        ))}

        <path d={ANALYTICS_AREA} fill="url(#bento-analytics-fill)" />
        <path
          d={ANALYTICS_LINE}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ stroke: 'var(--mini-tint)' }}
        />
      </svg>
    </div>
  )
}
