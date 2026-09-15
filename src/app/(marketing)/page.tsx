import type { Metadata } from 'next'

import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { FeatureBento } from '@/components/marketing/land/feature-bento'
import { LandHero } from '@/components/marketing/land/land-hero'
import { ProofStrip } from '@/components/marketing/land/proof-strip'
import { SceneReel } from '@/components/marketing/land/scene-reel'
import { PricingSection } from '@/components/marketing/pricing-section'

export const metadata: Metadata = {
  title: 'EZRA Pro — Booking software for tours, restaurants, events and classes',
  description:
    'Availability, deposits, staff rosters and next-day payouts for tours, restaurants, events, classes and venues. One inventory behind your website, the marketplaces and the phone. Free migration.',
  alternates: { canonical: '/' },
  openGraph: {
    url: '/',
    title: 'EZRA Pro — Booking software for tours, restaurants, events and classes',
    description:
      'One inventory behind your website, the marketplaces and the phone, a host app that works with no signal, and payouts the next business day.',
  },
}

/* ==========================================================================
   Six sections, in the order a first visit needs them:
     hero        the product working, for six kinds of business
     reel        three moments it handled, told as a pinned film
     features    five drawings of what it runs
     proof       who uses it, and three numbers
     pricing     the price, plainly
     closing     the ask
   ========================================================================== */

export default function LandingPage() {
  return (
    <>
      <LandHero />
      <SceneReel />
      <FeatureBento />
      <ProofStrip />
      <PricingSection className="scroll-mt-4 bg-background py-16 sm:py-20" />
      <ClosingCta />
    </>
  )
}
