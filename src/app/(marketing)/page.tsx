import type { Metadata } from 'next'

import { FaqSection } from '@/components/marketing/faq-section'
import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { CustomerStories } from '@/components/marketing/land/customer-stories'
import { LandHero } from '@/components/marketing/land/land-hero'
import { Phases } from '@/components/marketing/land/phases'
import { LogoCloud } from '@/components/marketing/logo-cloud'
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
   The order a first visit needs:
     hero          the claim, and a deck of four product cards on a field of colour
     logos         who already runs on it
     phases        before, during and after every booking
     stories       real operators, real numbers
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
      <CustomerStories />
      <PricingSection className="scroll-mt-4 border-t border-line bg-background-subtle py-20 sm:py-24" />
      <FaqSection />
      <ClosingCta />
    </>
  )
}
