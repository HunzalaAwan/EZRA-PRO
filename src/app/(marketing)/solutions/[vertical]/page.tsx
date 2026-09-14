import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  CalendarDays,
  ChartSpline,
  Check,
  CreditCard,
  Layers,
  Quote,
  Share2,
  ShoppingCart,
  Star,
  Store,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'

import {
  AuroraBackground,
  GlowOrb,
  GridBackground,
  NoiseOverlay,
} from '@/components/motion/backgrounds'
import { Reveal } from '@/components/motion/reveal'
import { SpotlightCard, SpotlightGroup } from '@/components/motion/spotlight'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { CtaSection } from '@/components/marketing/cta-section'
import { PricingSection } from '@/components/marketing/pricing-section'
import { SectionHeading } from '@/components/marketing/section-heading'
import { VerticalVisual } from '@/components/marketing/vertical-showcase'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { FEATURE_BLOCKS, TESTIMONIALS, VERTICAL_PITCHES } from '@/content/marketing'
import { VERTICALS, getVertical } from '@/lib/data/verticals'
import { cn } from '@/lib/utils'
import type { FeatureBlock, VerticalKey } from '@/types'

/* ==========================================================================
   ENTITIES — pitch bodies and feature copy are authored with HTML entities
   (`chef&rsquo;s counters`, `twenty operators&rsquo; trips`). React escapes
   strings, so they are resolved here. Local copy rather than importing the
   one in `faq-section.tsx`: that module is `'use client'`, and its exports
   become client references when a server component imports them.
   ========================================================================== */

const ENTITIES: Record<string, string> = {
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&nbsp;': ' ',
  '&quot;': '"',
  '&#39;': '’',
  '&amp;': '&',
}

const ENTITY_PATTERN = /&(?:rsquo|lsquo|ldquo|rdquo|mdash|ndash|hellip|nbsp|quot|#39|amp);/g

function decodeEntities(input: string) {
  return input.replace(ENTITY_PATTERN, (match) => ENTITIES[match] ?? match)
}

/* ==========================================================================
   ROUTING
   ========================================================================== */

const VERTICAL_KEYS = VERTICALS.map((vertical) => vertical.key)

function resolveVertical(slug: string): VerticalKey | null {
  return (VERTICAL_KEYS as string[]).includes(slug) ? (slug as VerticalKey) : null
}

export function generateStaticParams() {
  return VERTICALS.map((vertical) => ({ vertical: vertical.key }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ vertical: string }>
}): Promise<Metadata> {
  const { vertical: slug } = await params
  const key = resolveVertical(slug)

  if (!key) {
    return {
      title: 'Solution not found',
      description: 'That industry page does not exist. Browse the six EZRA Pro verticals instead.',
    }
  }

  const vertical = getVertical(key)
  const pitch = VERTICAL_PITCHES[key]
  const description = decodeEntities(pitch.body)

  return {
    title: `${vertical.label} booking software`,
    description,
    alternates: { canonical: `/solutions/${key}` },
    openGraph: {
      url: `/solutions/${key}`,
      title: `${pitch.headline} — EZRA Pro for ${vertical.label}`,
      description,
    },
  }
}

/* ==========================================================================
   CONTENT MAPS
   ========================================================================== */

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

/**
 * The four product pillars that matter most to each vertical, in the order an
 * operator in that business would rank them. Ids are validated against
 * FEATURE_BLOCKS at render time, so a renamed block surfaces as a missing tile
 * rather than a crash.
 */
const VERTICAL_FEATURES: Record<VerticalKey, string[]> = {
  watersports: ['feat-calendar', 'feat-checkout', 'feat-crm', 'feat-payments'],
  tours: ['feat-calendar', 'feat-channels', 'feat-checkout', 'feat-crm'],
  island: ['feat-channels', 'feat-crm', 'feat-analytics', 'feat-payments'],
  adventure: ['feat-crm', 'feat-calendar', 'feat-checkout', 'feat-team'],
  restaurants: ['feat-payments', 'feat-checkout', 'feat-crm', 'feat-analytics'],
  wellness: ['feat-crm', 'feat-payments', 'feat-storefront', 'feat-analytics'],
}

const ACCENT_CHIP: Record<FeatureBlock['accent'], string> = {
  lagoon: 'bg-lagoon-500/12 text-lagoon-700 dark:text-lagoon-300',
  coral: 'bg-coral-500/12 text-coral-700 dark:text-coral-300',
  sunset: 'bg-sunset-500/12 text-sunset-700 dark:text-sunset-300',
  reef: 'bg-reef-500/12 text-reef-700 dark:text-reef-300',
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export default async function VerticalSolutionPage({
  params,
}: {
  params: Promise<{ vertical: string }>
}) {
  const { vertical: slug } = await params
  const key = resolveVertical(slug)

  if (!key) notFound()

  const vertical = getVertical(key)
  const pitch = VERTICAL_PITCHES[key]

  const features = VERTICAL_FEATURES[key]
    .map((id) => FEATURE_BLOCKS.find((block) => block.id === id))
    .filter((block): block is FeatureBlock => Boolean(block))

  const testimonial = TESTIMONIALS.find((item) => item.vertical === key)
  const siblings = VERTICALS.filter((item) => item.key !== key)

  return (
    <>
      {/* ================================================================
          HERO
          ================================================================ */}
      <section
        aria-labelledby="vertical-title"
        className="relative isolate overflow-hidden bg-background pb-20 pt-12 sm:pb-24 sm:pt-16"
      >
        <GridBackground fade="radial" seed={`ezra-${key}-grid`} className="opacity-70" />
        <AuroraBackground
          seed={`ezra-vertical-${key}`}
          blobs={4}
          intensity="subtle"
          palette={[vertical.accent, 'lagoon']}
        />
        <NoiseOverlay opacity={0.035} />

        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb — keeps the six pages navigable without the mega menu. */}
          <Reveal direction="up" distance={8}>
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-subtle">
                <li>
                  <Link
                    href="/"
                    className="rounded transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <span className="text-muted">Solutions</span>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="font-medium text-foreground">
                  {vertical.label}
                </li>
              </ol>
            </nav>
          </Reveal>

          <div className="mt-10 grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
            {/* ---------- Copy ---------- */}
            <div>
              <Reveal direction="up" distance={8} delay={0.04} blur={false}>
                <span className="glass inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-primary">
                  <span aria-hidden="true" className="relative flex size-1.5">
                    <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-primary/70" />
                    <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                  </span>
                  EZRA Pro for {vertical.label}
                </span>
              </Reveal>

              <Reveal
                as="h1"
                id="vertical-title"
                delay={0.1}
                blur
                className="mt-6 font-display text-display-sm font-semibold tracking-[-0.032em] text-balance text-foreground sm:text-display-md"
              >
                {pitch.headline}
              </Reveal>

              <Reveal
                as="p"
                delay={0.16}
                className="mt-6 max-w-xl text-base leading-relaxed text-pretty text-muted sm:text-lg"
              >
                {decodeEntities(pitch.body)}
              </Reveal>

              <StaggerGroup
                as="ul"
                stagger={0.06}
                startDelay={0.22}
                className="mt-8 grid gap-2.5 sm:grid-cols-2"
              >
                {pitch.bullets.map((bullet) => (
                  <StaggerItem
                    as="li"
                    key={bullet}
                    distance={12}
                    className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground"
                  >
                    <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft">
                      <Check className="size-3 text-success" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {decodeEntities(bullet)}
                  </StaggerItem>
                ))}
              </StaggerGroup>

              <Reveal
                delay={0.34}
                className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
              >
                <Button
                  asChild
                  size="lg"
                  variant="primary"
                  rightIcon={<ArrowRight aria-hidden="true" />}
                  className="w-full sm:w-auto"
                >
                  <Link href="/signup">Start free — no card</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
                  <Link href="/contact">Book a 20-min demo</Link>
                </Button>
              </Reveal>

              {/* ---------- Proof stat ---------- */}
              <Reveal delay={0.4} distance={16} className="mt-9">
                <div className="flex items-center gap-5 rounded-2xl border border-line bg-surface p-5 shadow-sm">
                  <p className="shrink-0 font-display text-display-sm font-semibold tracking-[-0.03em] text-gradient-brand tabular">
                    {pitch.proofStat}
                  </p>
                  <p className="min-w-0 text-sm leading-relaxed text-muted">
                    {decodeEntities(pitch.proofLabel)}
                  </p>
                </div>
              </Reveal>
            </div>

            {/* ---------- The console, tinted for this vertical ---------- */}
            <Reveal delay={0.26} distance={28} blur={false} className="relative">
              <GlowOrb
                color={vertical.accent}
                size={480}
                opacity={0.18}
                blur={110}
                className="-right-20 -top-24"
              />
              <GlowOrb
                color="lagoon"
                size={380}
                opacity={0.12}
                blur={100}
                float={false}
                className="-bottom-20 -left-16"
              />
              <VerticalVisual vertical={vertical} className="relative" />
            </Reveal>
          </div>

          {/* ---------- What they sell on EZRA Pro ---------- */}
          <Reveal delay={0.1} className="mt-16 sm:mt-20">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-subtle">
              Running today on EZRA Pro
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {vertical.sampleActivities.map((activity) => (
                <li key={activity}>
                  <span className="inline-flex items-center rounded-full border border-line bg-surface px-3.5 py-1.5 text-[0.8125rem] font-medium text-muted">
                    {decodeEntities(activity)}
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ================================================================
          THE FOUR PILLARS THAT MATTER HERE
          ================================================================ */}
      <section
        id="features"
        aria-labelledby="vertical-features-title"
        className="scroll-mt-4 border-y border-line bg-background-subtle py-20 sm:py-28 lg:py-32"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            id="vertical-features-title"
            eyebrow="Built for this"
            title={
              <>
                The four things{' '}
                <span className="text-gradient-lagoon">{vertical.label.toLowerCase()}</span>{' '}
                operators lean on hardest
              </>
            }
            description={decodeEntities(vertical.tagline)}
          />

          <SpotlightGroup className="mt-12 grid gap-5 sm:mt-14 md:grid-cols-2">
            {features.map((block, index) => {
              const Icon = FEATURE_ICONS[block.icon] ?? ShoppingCart
              return (
                <Reveal key={block.id} delay={0.06 * index} distance={20} blur={false}>
                  <SpotlightCard
                    color={block.accent}
                    intensity={0.3}
                    className={cn(
                      'h-full rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-7',
                      'transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)]',
                      'hover:-translate-y-1 hover:border-line-strong hover:shadow-xl',
                      'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex size-11 items-center justify-center rounded-2xl',
                        ACCENT_CHIP[block.accent],
                      )}
                    >
                      <Icon className="size-5" aria-hidden="true" />
                    </span>

                    <p className="mt-5 text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-subtle">
                      {block.eyebrow}
                    </p>
                    <h3 className="mt-2 font-display text-xl font-semibold tracking-[-0.02em] text-balance text-foreground">
                      {block.title}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted">
                      {decodeEntities(block.description)}
                    </p>

                    <ul className="mt-5 flex flex-col gap-2.5 border-t border-line-subtle pt-5">
                      {block.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="flex items-start gap-2.5 text-[0.8125rem] leading-relaxed text-subtle"
                        >
                          <Check
                            className="mt-0.5 size-3.5 shrink-0 text-success"
                            strokeWidth={2.75}
                            aria-hidden="true"
                          />
                          {decodeEntities(bullet)}
                        </li>
                      ))}
                    </ul>
                  </SpotlightCard>
                </Reveal>
              )
            })}
          </SpotlightGroup>
        </div>
      </section>

      {/* ================================================================
          ONE OPERATOR, IN THEIR OWN WORDS
          ================================================================ */}
      {testimonial ? (
        <section aria-label={`${vertical.label} operator story`} className="bg-background py-20 sm:py-28">
          <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8">
            <Reveal distance={22}>
              <figure
                className={cn(
                  'relative overflow-hidden rounded-3xl border border-line p-7 shadow-lg sm:p-10',
                  'bg-[linear-gradient(145deg,color-mix(in_oklab,var(--primary)_10%,var(--surface))_0%,var(--surface)_52%,color-mix(in_oklab,var(--accent)_9%,var(--surface))_100%)]',
                )}
              >
                <Quote
                  className="absolute -right-4 -top-4 size-28 text-primary/10"
                  strokeWidth={1.25}
                  aria-hidden="true"
                />

                <div className="relative">
                  <div
                    role="img"
                    aria-label={`Rated ${testimonial.rating} out of 5`}
                    className="flex items-center gap-0.5"
                  >
                    {Array.from({ length: testimonial.rating }, (_, index) => (
                      <Star
                        key={index}
                        className="size-4 fill-current text-sunset-500"
                        aria-hidden="true"
                      />
                    ))}
                  </div>

                  <blockquote className="mt-5 font-display text-xl leading-snug text-balance text-foreground sm:text-2xl">
                    &ldquo;{decodeEntities(testimonial.quote)}&rdquo;
                  </blockquote>

                  <figcaption className="mt-7 flex flex-wrap items-center gap-4 border-t border-line-subtle pt-6">
                    <Avatar name={testimonial.author} src={testimonial.avatarUrl} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{testimonial.author}</p>
                      <p className="text-sm text-muted">
                        {testimonial.role}, {testimonial.company}
                      </p>
                    </div>
                    {testimonial.metric ? (
                      <div className="text-right">
                        <p className="font-display text-2xl font-semibold tracking-[-0.02em] text-gradient-lagoon tabular">
                          {testimonial.metric.value}
                        </p>
                        <p className="text-xs text-subtle">{testimonial.metric.label}</p>
                      </div>
                    ) : null}
                  </figcaption>
                </div>
              </figure>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* ================================================================
          PRICING
          ================================================================ */}
      <PricingSection className="scroll-mt-4 border-y border-line bg-surface-sunken" />

      {/* ================================================================
          THE OTHER FIVE
          ================================================================ */}
      <section aria-labelledby="other-verticals-title" className="bg-background py-16 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2
            id="other-verticals-title"
            className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-subtle"
          >
            Run more than one kind of business?
          </h2>

          <StaggerGroup
            as="ul"
            stagger={0.05}
            className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
            {siblings.map((item) => (
              <StaggerItem as="li" key={item.key} distance={12}>
                <Link
                  href={`/solutions/${item.key}`}
                  className={cn(
                    'group flex h-full flex-col rounded-2xl border border-line bg-surface p-4',
                    'transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)]',
                    'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">{item.label}</span>
                    <ArrowRight
                      className="size-4 shrink-0 text-faint transition-[transform,color] duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5 group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-1.5 text-[0.8125rem] leading-relaxed text-muted">
                    {decodeEntities(item.tagline)}
                  </span>
                </Link>
              </StaggerItem>
            ))}
          </StaggerGroup>

          <Reveal delay={0.12} className="mt-8">
            <p className="flex items-start gap-2.5 text-sm leading-relaxed text-muted">
              <Layers className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              One account covers every vertical &mdash; multi-brand and multi-location are on
              Scale and Enterprise.
            </p>
          </Reveal>
        </div>
      </section>

      <CtaSection />
    </>
  )
}
