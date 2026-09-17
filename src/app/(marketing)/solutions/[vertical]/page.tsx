import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { PricingSection } from '@/components/marketing/pricing-section'
import { SOLUTION_CONTENT, SOLUTION_POINTS } from '@/components/marketing/solutions/solution-content'
import { SolutionHero } from '@/components/marketing/solutions/solution-hero'
import { ConsoleStage, MomentTimeline, OtherTrades, PillarGrid } from '@/components/marketing/solutions/solution-sections'
import { FEATURE_BLOCKS, VERTICAL_PITCHES } from '@/content/marketing'
import { VERTICALS, getVertical } from '@/lib/data/verticals'
import type { FeatureBlock, VerticalKey } from '@/types'

/* ==========================================================================
   ENTITIES — pitch bodies and feature copy are authored with HTML entities
   (`chef&rsquo;s counters`, `twenty operators&rsquo; trips`). React escapes
   strings, so they are resolved here before anything reaches a component.
   ========================================================================== */

const ENTITIES: Record<string, string> = {
  '&rsquo;': '’',
  '&lsquo;': '‘',
  '&ldquo;': '“',
  '&rdquo;': '”',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&nbsp;': ' ',
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

export async function generateMetadata({ params }: { params: Promise<{ vertical: string }> }): Promise<Metadata> {
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

function decodeBlock(block: FeatureBlock): FeatureBlock {
  return { ...block, description: decodeEntities(block.description), bullets: block.bullets.map(decodeEntities) }
}

/* ==========================================================================
   PAGE

   The order a first visit needs:
     hero        the pitch, centred, with the trade standing up beneath it
     moments     three things the software handled, on a timeline
     pillars     the four product blocks this trade leans on
     console     the desk's view of the week, standing up out of the page
     pricing     the price, plainly
     others      the other five trades
     closing     the ask
   ========================================================================== */

export default async function VerticalSolutionPage({ params }: { params: Promise<{ vertical: string }> }) {
  const { vertical: slug } = await params
  const key = resolveVertical(slug)
  if (!key) notFound()

  const vertical = getVertical(key)
  const pitch = VERTICAL_PITCHES[key]
  const content = SOLUTION_CONTENT[key]

  const features = VERTICAL_FEATURES[key]
    .map((id) => FEATURE_BLOCKS.find((block) => block.id === id))
    .filter((block): block is FeatureBlock => Boolean(block))
    .map(decodeBlock)

  const siblings = VERTICALS.filter((item) => item.key !== key)

  return (
    <>
      <SolutionHero
        vertical={vertical}
        content={content}
        headline={pitch.headline}
        body={decodeEntities(pitch.body)}
        points={SOLUTION_POINTS[key]}
      />

      <MomentTimeline vertical={vertical} moments={content.moments} />
      <PillarGrid vertical={vertical} features={features} tagline={decodeEntities(vertical.tagline)} />
      <ConsoleStage vertical={vertical} line={content.consoleLine} />

      <PricingSection className="scroll-mt-4 bg-background py-20 sm:py-24" />

      {/* ---------- the other five ---------- */}
      <OtherTrades siblings={siblings.map((item) => ({ ...item, tagline: decodeEntities(item.tagline) }))} />

      <ClosingCta />
    </>
  )
}
