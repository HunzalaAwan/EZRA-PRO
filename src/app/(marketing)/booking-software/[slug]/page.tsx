import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CostSection, FaqList, NicheHero, ProblemGrid, RelatedSection, ScreenSection, SetupSteps } from '@/components/marketing/booking-software/niche-sections'
import { nicheMetadata, nicheSchema } from '@/components/marketing/booking-software/niche-schema'
import { JsonLd } from '@/components/marketing/compare/compare-ui'
import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { HUB, NICHES, NICHE_SLUGS, getNiche } from '@/content/booking-software'

/* ==========================================================================
   /booking-software/[slug] — EZRA Pro for one kind of business.
   Statically generated for the slugs in `NICHE_SLUGS`; anything else is a 404.
   ========================================================================== */

export const dynamicParams = false

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

  return (
    <>
      <JsonLd data={nicheSchema(niche)} />

      <NicheHero
        niche={niche}
        crumbs={[
          { label: 'Home', href: '/' },
          { label: 'Booking software', href: HUB.path },
          { label: niche.name },
        ]}
      />
      <ProblemGrid niche={niche} />
      <ScreenSection niche={niche} />
      <CostSection niche={niche} />
      <SetupSteps steps={niche.steps} name={niche.name} />
      <FaqList faqs={niche.faqs} title={`Questions about ${niche.keywords.primary}`} />
      <RelatedSection niche={niche} related={related} />
      <ClosingCta />
    </>
  )
}
