'use client'

import { Quote, Star } from 'lucide-react'

import { SectionHeading } from '@/components/marketing/section-heading'
import { GlowOrb } from '@/components/motion/backgrounds'
import { CountUp } from '@/components/motion/count-up'
import { Marquee } from '@/components/motion/marquee'
import { SpotlightCard, SpotlightGroup, type SpotlightColor } from '@/components/motion/spotlight'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Avatar, AvatarGroup } from '@/components/ui/avatar'
import { TESTIMONIALS } from '@/content/marketing'
import { cn, truncate } from '@/lib/utils'
import type { Testimonial, VerticalKey } from '@/types'

/* ==========================================================================
   SOURCE-TEXT HYGIENE
   Copy in `@/content/marketing` is authored with HTML entities so it can be
   dropped into any surface. React escapes string children verbatim, so the
   entities have to be resolved before render or the page literally shows
   "&rsquo;". This is a fixed table rather than a DOM round-trip: it runs
   identically on the server and the client, so nothing drifts at hydration.
   ========================================================================== */

const HTML_ENTITIES: Record<string, string> = {
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
  '&apos;': '’',
  '&#39;': '’',
}

function decodeEntities(input: string): string {
  return input.replace(/&(?:[a-zA-Z]+|#\d+);/g, (match) => HTML_ENTITIES[match] ?? match)
}

/* ==========================================================================
   METRIC PARSING
   Operator metrics arrive as display strings ("+38%", "$104k", "-64%",
   "4 min", "0"). Anything containing a number can be counted up; the affixes
   are preserved exactly, so "$104k" never becomes "104,000".
   ========================================================================== */

interface ParsedMetric {
  prefix: string
  value: number
  decimals: number
  suffix: string
}

function parseMetric(raw: string): ParsedMetric | null {
  const match = /^([^\d]*)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(raw)
  if (!match) return null

  const [, prefix, digits, suffix] = match
  const normalised = digits.replace(/,/g, '')
  const value = Number(normalised)
  if (!Number.isFinite(value)) return null

  const fraction = normalised.split('.')[1]
  return { prefix, value, decimals: fraction ? fraction.length : 0, suffix }
}

/* ==========================================================================
   TONE
   Each vertical carries one brand tone across the whole site, so the light
   that follows the cursor over a watersports quote is always lagoon and a
   restaurant quote is always coral.
   ========================================================================== */

const VERTICAL_TONE: Record<VerticalKey, SpotlightColor> = {
  watersports: 'lagoon',
  tours: 'reef',
  restaurants: 'coral',
  hotels: 'coral',
  adventure: 'sunset',
  island: 'lagoon',
  wellness: 'reef',
}

/** Solid tint + border tint for the two featured cards. */
const FEATURED_WASH: Record<SpotlightColor, string> = {
  lagoon:
    'border-[color-mix(in_oklab,var(--color-lagoon-500)_28%,var(--border))] bg-[color-mix(in_oklab,var(--color-lagoon-500)_15%,var(--surface))]',
  coral:
    'border-[color-mix(in_oklab,var(--color-coral-500)_28%,var(--border))] bg-[color-mix(in_oklab,var(--color-coral-500)_14%,var(--surface))]',
  sunset:
    'border-[color-mix(in_oklab,var(--color-sunset-500)_28%,var(--border))] bg-[color-mix(in_oklab,var(--color-sunset-500)_15%,var(--surface))]',
  reef:
    'border-[color-mix(in_oklab,var(--color-reef-500)_26%,var(--border))] bg-[color-mix(in_oklab,var(--color-reef-500)_14%,var(--surface))]',
}

/** Gradient-text recipe for the oversized featured figure. */
const METRIC_TEXT: Record<SpotlightColor, string> = {
  lagoon: 'text-gradient-lagoon',
  coral: 'text-gradient-brand',
  sunset: 'text-gradient-brand',
  reef: 'text-gradient-lagoon',
}

/* ==========================================================================
   RATING
   ========================================================================== */

function Rating({
  rating,
  size = 'md',
  className,
}: {
  rating: number
  size?: 'sm' | 'md'
  className?: string
}) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)))

  return (
    <div
      role="img"
      aria-label={`Rated ${rounded} out of 5`}
      className={cn('flex items-center gap-0.5', className)}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          strokeWidth={1.75}
          className={cn(
            size === 'sm' ? 'size-3' : 'size-3.5',
            index < rounded ? 'fill-current text-sunset-500' : 'fill-none text-faint',
          )}
        />
      ))}
    </div>
  )
}

/* ==========================================================================
   CARDS
   ========================================================================== */

function FeaturedCard({ testimonial }: { testimonial: Testimonial }) {
  const tone = VERTICAL_TONE[testimonial.vertical]
  const metric = testimonial.metric
  const parsed = metric ? parseMetric(metric.value) : null

  return (
    <SpotlightCard
      color={tone}
      size={480}
      intensity={0.3}
      className={cn(
        'h-full rounded-3xl border shadow-lg',
        'transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-expo)]',
        'hover:-translate-y-1.5 hover:shadow-xl',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        FEATURED_WASH[tone],
      )}
    >
      <figure className="relative flex h-full flex-col p-6 sm:p-8 lg:p-9">
        <Quote
          aria-hidden="true"
          strokeWidth={1}
          className="pointer-events-none absolute -right-5 -top-5 size-28 text-foreground/5 sm:size-36"
        />

        <Rating rating={testimonial.rating} className="mb-6" />

        {metric ? (
          <div className="mb-7">
            <div
              className={cn(
                'font-display text-display-sm font-semibold leading-none',
                METRIC_TEXT[tone],
              )}
            >
              {parsed ? (
                <CountUp
                  value={parsed.value}
                  prefix={parsed.prefix}
                  suffix={parsed.suffix}
                  decimals={parsed.decimals}
                  duration={1.5}
                />
              ) : (
                metric.value
              )}
            </div>
            <p className="mt-2.5 text-sm text-muted">{metric.label}</p>
          </div>
        ) : null}

        <blockquote className="text-base leading-relaxed text-foreground sm:text-lg sm:leading-[1.65]">
          <p className="text-balance">&ldquo;{decodeEntities(testimonial.quote)}&rdquo;</p>
        </blockquote>

        <figcaption className="mt-auto flex items-center gap-3.5 border-t border-line/70 pt-6 sm:pt-7">
          <Avatar name={testimonial.author} src={testimonial.avatarUrl} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-foreground">
              {testimonial.author}
            </p>
            <p className="truncate text-xs text-muted">
              {testimonial.role} &middot; {testimonial.company}
            </p>
          </div>
        </figcaption>
      </figure>
    </SpotlightCard>
  )
}

function CompactCard({ testimonial }: { testimonial: Testimonial }) {
  const tone = VERTICAL_TONE[testimonial.vertical]
  const metric = testimonial.metric

  return (
    <SpotlightCard
      color={tone}
      size={340}
      intensity={0.22}
      className={cn(
        'h-full rounded-2xl border border-line bg-surface shadow-sm',
        'transition-[transform,box-shadow,border-color] duration-500 ease-[var(--ease-out-expo)]',
        'hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-lg',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
      )}
    >
      <figure className="flex h-full flex-col p-5 sm:p-6">
        <Rating rating={testimonial.rating} size="sm" className="mb-4" />

        <blockquote className="text-[0.9375rem] leading-relaxed text-muted">
          <p>&ldquo;{decodeEntities(testimonial.quote)}&rdquo;</p>
        </blockquote>

        {metric ? (
          <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="tabular font-display text-sm font-semibold text-foreground">
              {metric.value}
            </span>
            <span className="text-xs text-subtle">{metric.label}</span>
          </p>
        ) : null}

        <figcaption className="mt-auto flex items-center gap-3 border-t border-line/70 pt-5">
          <Avatar name={testimonial.author} src={testimonial.avatarUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{testimonial.author}</p>
            <p className="truncate text-xs text-subtle">
              {testimonial.role} &middot; {testimonial.company}
            </p>
          </div>
        </figcaption>
      </figure>
    </SpotlightCard>
  )
}

/* ==========================================================================
   GRID GEOMETRY
   A 6-column track at lg. The two featured quotes take half a row each; the
   six supporting quotes take a third each, so both bands pack exactly with no
   orphan cell. The middle card of each supporting triple is pushed down, which
   staggers the top edges into a masonry rhythm while the baselines stay level.
   ========================================================================== */

const FEATURED_COUNT = 2

function itemClass(index: number): string {
  if (index < FEATURED_COUNT) return 'md:col-span-6 lg:col-span-3'
  const positionInTriple = (index - FEATURED_COUNT) % 3
  return cn('md:col-span-3 lg:col-span-2', positionInTriple === 1 && 'lg:mt-12')
}

/* ==========================================================================
   SECTION
   ========================================================================== */

export interface TestimonialsProps {
  /** Anchor target for in-page navigation. */
  id?: string
  /** Override the eight quotes shipped in the content file. */
  items?: Testimonial[]
  className?: string
}

/**
 * Social proof as a scoreboard rather than a wall of praise: the two strongest
 * outcomes are promoted to half-width cards that lead with the number, and the
 * remaining six sit beneath as a staggered supporting grid.
 */
export function Testimonials({
  id = 'testimonials',
  items = TESTIMONIALS,
  className,
}: TestimonialsProps) {
  const faces = items.map((testimonial) => ({
    id: testimonial.id,
    name: testimonial.author,
    src: testimonial.avatarUrl,
  }))

  return (
    <section
      id={id}
      aria-label="Operator stories"
      className={cn('relative isolate overflow-hidden py-24 sm:py-32', className)}
    >
      <GlowOrb
        color="lagoon"
        size={620}
        opacity={0.14}
        blur={120}
        className="-left-40 top-10 hidden lg:block"
      />
      <GlowOrb
        color="coral"
        size={520}
        opacity={0.12}
        blur={110}
        className="-right-32 bottom-24 hidden lg:block"
      />

      <div className="mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <SectionHeading
            eyebrow="Operator stories"
            title={
              <>
                Eight operators.{' '}
                <span className="text-gradient-lagoon">One honest scoreboard.</span>
              </>
            }
            description="No composite quotes, no stock photography, no anonymous logo wall. Named operators, the numbers they actually moved, and the season they moved them in."
            align="left"
            className="max-w-2xl"
          />

          <div className="flex items-center gap-4">
            <AvatarGroup
              avatars={faces}
              max={5}
              size="md"
              ringClassName="ring-background"
              label="Operators quoted in this section"
            />
            <p className="max-w-[15rem] text-xs leading-relaxed text-subtle">
              Every quote below is from a named operator running EZRA Pro today.
            </p>
          </div>
        </div>

        {/* One pointer listener drives the glow across the whole grid, so the
            light reads as a single source passing over the section. */}
        <SpotlightGroup className="mt-14 sm:mt-16">
          <StaggerGroup
            as="ul"
            stagger={0.07}
            margin="-60px"
            className="grid grid-cols-1 gap-5 md:grid-cols-6 lg:gap-6"
          >
            {items.map((testimonial, index) => (
              <StaggerItem as="li" key={testimonial.id} distance={26} className={itemClass(index)}>
                {index < FEATURED_COUNT ? (
                  <FeaturedCard testimonial={testimonial} />
                ) : (
                  <CompactCard testimonial={testimonial} />
                )}
              </StaggerItem>
            ))}
          </StaggerGroup>
        </SpotlightGroup>
      </div>
    </section>
  )
}

/* ==========================================================================
   MARQUEE VARIANT
   ========================================================================== */

export interface TestimonialMarqueeProps {
  items?: Testimonial[]
  /** Seconds for one full loop — higher is slower. */
  speed?: number
  direction?: 'left' | 'right'
  /** Characters to clip each quote to. */
  clipAt?: number
  className?: string
}

/**
 * A single belt of short quote cards, for the places a full grid would be too
 * loud — under a hero, between two feature blocks, above the footer.
 */
export function TestimonialMarquee({
  items = TESTIMONIALS,
  speed = 58,
  direction = 'left',
  clipAt = 128,
  className,
}: TestimonialMarqueeProps) {
  return (
    <Marquee speed={speed} direction={direction} gap={16} className={className}>
      {items.map((testimonial) => (
        <figure
          key={testimonial.id}
          className={cn(
            'flex w-[18rem] shrink-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:w-[21rem]',
            'transition-[border-color,box-shadow] duration-300 ease-[var(--ease-out-expo)]',
            'hover:border-primary/40 hover:shadow-md',
          )}
        >
          <Rating rating={testimonial.rating} size="sm" />

          <blockquote className="text-sm leading-relaxed text-muted">
            <p>&ldquo;{truncate(decodeEntities(testimonial.quote), clipAt)}&rdquo;</p>
          </blockquote>

          <figcaption className="mt-auto flex items-center gap-2.5 pt-1">
            <Avatar name={testimonial.author} src={testimonial.avatarUrl} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-foreground">{testimonial.author}</p>
              <p className="truncate text-[0.6875rem] text-subtle">{testimonial.company}</p>
            </div>
          </figcaption>
        </figure>
      ))}
    </Marquee>
  )
}
