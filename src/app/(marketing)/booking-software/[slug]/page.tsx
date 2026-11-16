import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { DaySection, IntroSection, LookForSection, MoveSection } from '@/components/marketing/booking-software/niche-longform'
import { CostSection, FaqList, NicheHero, ProblemGrid, RelatedSection, ScreenSection, SetupSteps } from '@/components/marketing/booking-software/niche-sections'
import { nicheMetadata, nicheSchema } from '@/components/marketing/booking-software/niche-schema'
import { JsonLd } from '@/components/marketing/compare/compare-ui'
import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { PRICING_PLANS } from '@/content/marketing'
import { HUB, NICHES, NICHE_SLUGS, getNiche } from '@/content/booking-software'
import { NICHE_LONG } from '@/content/booking-software-long'

/* ==========================================================================
   /booking-software/[slug] — EZRA Pro for one kind of business.
   Statically generated for the slugs in `NICHE_SLUGS`; anything else is a 404.
   Long-form: about 1,500+ words in <main>, with the questions marked up as
   FAQPage (the four on the niche plus four from its long file).
   ========================================================================== */

export const dynamicParams = false

/** What the one plan includes, as the pricing page lists it, without naming other companies. */
const INCLUDED = PRICING_PLANS[0].features.map(({ label, hint }) => ({
  label,
  hint: label === 'Marketplace sync' ? 'Two-way sync with the big travel marketplaces' : hint,
}))

export function generateStaticParams() {
  return NICHE_SLUGS.map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const niche = getNiche(slug)
  if (!niche) return { title: 'Page not found' }
  return nicheMetadata(niche)
}

export default async function NichePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const niche = getNiche(slug)
  if (!niche) notFound()

  const related = niche.related.map((key) => NICHES[key])
  const long = NICHE_LONG[niche.slug]
  const faqs = [...niche.faqs, ...long.faqs]

  return (
    <>
      <JsonLd data={nicheSchema(niche, faqs)} />

      <NicheHero
        niche={niche}
        crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Booking software', href: HUB.path },
          { label: niche.name },
        ]}
      />
      <IntroSection niche={niche} long={long} />
      <ProblemGrid niche={niche} />
      <ScreenSection niche={niche} />
      <DaySection niche={niche} long={long} />
      <LookForSection niche={niche} long={long} />
      <CostSection niche={niche} paragraphs={long.pricing} />
      <SetupSteps steps={niche.steps} name={niche.name} />
      <MoveSection niche={niche} long={long} included={INCLUDED} />
      <FaqList faqs={faqs} title={`Questions about ${niche.keywords.primary}`} className="bg-background-subtle" />
      <RelatedSection niche={niche} related={related} />
      <ClosingCta />
    </>
  )
}
