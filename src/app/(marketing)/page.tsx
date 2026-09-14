import type { Metadata } from 'next'

import { ComparisonTable } from '@/components/marketing/comparison-table'
import { CtaSection } from '@/components/marketing/cta-section'
import { FaqSection } from '@/components/marketing/faq-section'
import { FeatureBento } from '@/components/marketing/feature-bento'
import { Hero } from '@/components/marketing/hero'
import { Integrations } from '@/components/marketing/integrations'
import { LogoCloud } from '@/components/marketing/logo-cloud'
import { PricingSection } from '@/components/marketing/pricing-section'
import {
  LazyAnalyticsShowcase,
  LazyProductShowcase,
} from '@/components/marketing/lazy-sections'
import { StatsBand } from '@/components/marketing/stats-band'
import { Testimonials } from '@/components/marketing/testimonials'
import { VerticalShowcase } from '@/components/marketing/vertical-showcase'

export const metadata: Metadata = {
  title: 'EZRA Pro — Booking software for experiences that sell out',
  description:
    'Live availability, zero-friction checkout and analytics that tell you what to do next. Built for watersports, tours, island, adventure, restaurant and wellness operators. From 3% commission, free migration from FareHarbor or Peek Pro.',
  alternates: { canonical: '/' },
  openGraph: {
    url: '/',
    title: 'EZRA Pro — Booking software for experiences that sell out',
    description:
      'Live availability, zero-friction checkout and analytics that tell you what to do next. Free migration from FareHarbor or Peek Pro.',
  },
}

/* ==========================================================================
   SURFACE RHYTHM

   Every section owns its own vertical padding, so the page only decides the
   ground each one sits on. Read top to bottom the ladder never repeats a
   surface twice in a row:

     hero            background        (section owns it)
     logo cloud      background        (inherits)
     stats           surface-sunken    (section owns it, border-y)
     verticals       background-subtle (section owns it)
     features        background        (section owns it)
     product tour    surface-sunken    ← set here
     analytics       background-subtle (section owns it)
     testimonials    background        ← set here
     comparison      background-subtle ← set here
     integrations    background        ← set here
     pricing         surface-sunken    ← set here
     faq             background        ← set here
     final cta       dark brand band   (section owns it)

   Nothing below overrides a background a section already declared — the four
   `bg-*` classes added here land on the sections that ship without one, which
   keeps `cn()`/tailwind-merge out of the critical path entirely.

   The final CTA paints a `WaveDivider` filled with `--background` across its
   top edge, so the section directly above it MUST be `bg-background` for that
   seam to read. That is why the FAQ, not pricing, is the last light band.

   ANCHOR OFFSET — `globals.css` already sets `scroll-padding-top: 6rem` (96px)
   on `html`. The fixed header stack measures 100px (108px from `lg`), so the
   anchored sections top that up with `scroll-mt-4` (16px) rather than the
   `scroll-mt-24` a page without the global rule would need: scroll-padding and
   scroll-margin add, and 6rem + 6rem would drop every anchor 192px short.
   ========================================================================== */

export default function LandingPage() {
  return (
    <>
      <Hero />
      <LogoCloud />
      <StatsBand />

      {/* Who it is for — six verticals, one re-tinting product glimpse. */}
      <VerticalShowcase className="scroll-mt-4" />

      {/* What it does — the bento of eight product pillars. id="features" */}
      <FeatureBento className="scroll-mt-4" />

      {/* How it feels — the scroll-driven four-step console tour. */}
      <LazyProductShowcase className="border-y border-line bg-surface-sunken" />

      {/* Why it pays — the dark analytics panel and its written insights. */}
      <LazyAnalyticsShowcase />

      {/* Proof, in operators' own words. */}
      <Testimonials className="bg-background" />

      {/* The honest three-way table against FareHarbor and Peek. */}
      <ComparisonTable className="bg-background-subtle" />

      {/* Everything it plugs into. */}
      <Integrations className="bg-background" />

      {/* The number that decides their year. id="pricing" */}
      <PricingSection className="scroll-mt-4 border-y border-line bg-surface-sunken" />

      {/* Sixteen straight answers. id="faq" */}
      <FaqSection className="scroll-mt-4 bg-background" />

      <CtaSection />
    </>
  )
}
