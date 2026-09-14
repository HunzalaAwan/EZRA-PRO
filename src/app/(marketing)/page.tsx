import type { Metadata } from 'next'

import { FaqSection } from '@/components/marketing/faq-section'
import { Integrations } from '@/components/marketing/integrations'
import { PricingSection } from '@/components/marketing/pricing-section'
import { PhotoCta } from '@/components/marketing/story/photo-cta'
import { ProofBand } from '@/components/marketing/story/proof-band'
import { StoryHero } from '@/components/marketing/story/story-hero'
import { StoryHook } from '@/components/marketing/story/story-hook'
import { DayStory } from '@/components/marketing/story/day-story'
import { VerticalsGrid } from '@/components/marketing/story/verticals-grid'

export const metadata: Metadata = {
  title: 'EZRA Pro — Booking software for experience operators',
  description:
    'Availability, checkout, crew and next-day payouts for tour, activity, adventure, dining and wellness operators worldwide. One inventory across your site and the marketplaces. Free migration from FareHarbor or Peek Pro.',
  alternates: { canonical: '/' },
  openGraph: {
    url: '/',
    title: 'EZRA Pro — Booking software for experience operators',
    description:
      'One inventory across your site and the marketplaces, a mobile app that works with no signal, and payouts the next business day.',
  },
}

/* ==========================================================================
   The landing page is told as a story, in the order the skill's pattern
   recommends: hook → the problem → a day on the product → who it is for →
   proof → price → questions → the last frame.

   Surfaces alternate so the page reads as chapters, not a scroll of cards:
     hero          photograph (dark)
     hook          background
     day story     surface-sunken, pinned
     verticals     background
     proof         photograph (dark)
     integrations  background
     pricing       surface-sunken
     faq           background
     cta           photograph (dark)
   ========================================================================== */

export default function LandingPage() {
  return (
    <>
      <StoryHero />
      <StoryHook />
      <DayStory />
      <VerticalsGrid />
      <ProofBand />
      <Integrations className="bg-background" />
      <PricingSection className="scroll-mt-4 border-y border-line bg-surface-sunken" />
      <FaqSection className="scroll-mt-4 bg-background" />
      <PhotoCta />
    </>
  )
}
