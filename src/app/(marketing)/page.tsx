import type { Metadata } from 'next'

import { FaqSection } from '@/components/marketing/faq-section'
import { Integrations } from '@/components/marketing/integrations'
import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { FeatureRows } from '@/components/marketing/land/feature-rows'
import { LandHero } from '@/components/marketing/land/land-hero'
import { Phases } from '@/components/marketing/land/phases'
import { LogoCloud } from '@/components/marketing/logo-cloud'
import { PricingSection } from '@/components/marketing/pricing-section'
import { StatsBand } from '@/components/marketing/stats-band'

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
   The order a first visit needs:
     hero          the claim, and the product under it
     logos         who already runs on it
     phases        one booking, from the first click to the money
     features      three rows: inventory, checkout, analytics
     numbers       four figures
     integrations  the stack it plugs into
     pricing       the price, plainly
     faq           the questions operators ask
     closing       the ask
   ========================================================================== */

export default function LandingPage() {
  return (
    <>
      <LandHero />
      <LogoCloud className="border-b border-line" />
      <Phases />
      <FeatureRows />
      <StatsBand className="mt-20 sm:mt-24 lg:mt-32" />
      <Integrations />
      <PricingSection className="scroll-mt-4 border-t border-line bg-surface-sunken py-20 sm:py-24" />
      <FaqSection />
      <ClosingCta />
    </>
  )
}
