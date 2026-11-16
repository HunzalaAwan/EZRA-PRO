import type { Metadata } from 'next'

import { HUB } from '@/components/marketing/compare/compare-content'
import { Prose, SystemsTable } from '@/components/marketing/compare/compare-longform'
import { CardNote, CompareCta, CompareHero, FaqGrid, JsonLd, Section, SourcesList, VsCards, WRAP, buildColumns, createNotes } from '@/components/marketing/compare/compare-ui'
import { articleSchema, breadcrumbSchema, compareMetadata, ezraSoftwareSchema, faqPageSchema } from '@/components/marketing/compare/compare-schema'
import { EZRA, VENDORS, VENDOR_ORDER, VS_SLUGS, formatCheckedDate } from '@/lib/data/competitors'

/* ==========================================================================
   /compare — EZRA Pro against every system we compare.

     headline     one line under it
     the table    systems down, key facts across, EZRA Pro first in lavender
     how to pick  a few paragraphs
     vs cards     one per comparison page
     questions    marked up as FAQPage
     CTA, sources
   ========================================================================== */

const PATH = '/compare'

export const metadata: Metadata = compareMetadata({ title: HUB.title, description: HUB.description, path: PATH })

export default function CompareHubPage() {
  const notes = createNotes()
  const columns = buildColumns(notes, [
    { key: 'ezra', name: EZRA.name, ours: true, cells: EZRA.cells },
    ...VENDOR_ORDER.map((id) => ({ key: id, name: VENDORS[id].name, cells: VENDORS[id].cells })),
  ])
  const faqs = HUB.faqs.map((faq) => ({ ...faq, n: faq.source ? notes.ref(faq.source, faq.reported) : undefined }))

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Compare', path: PATH },
          ]),
          articleSchema({ headline: HUB.h1, description: HUB.description, path: PATH }),
          faqPageSchema(HUB.faqs),
          ezraSoftwareSchema(),
        ]}
      />

      <CompareHero crumbs={[{ label: 'Home', href: '/' }, { label: 'Compare' }]} title={HUB.h1} subhead={HUB.subhead} />

      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="-mt-20 sm:-mt-28">
          <SystemsTable caption={`EZRA Pro and ${VENDOR_ORDER.length} other booking systems compared on price, fees and features. Last checked ${formatCheckedDate()}.`} columns={columns} keys={HUB.keys} />
          <CardNote fair={HUB.fairNote} estimates={HUB.estimatesNote} />
        </div>
      </div>

      <div className={WRAP}>
        <div className="space-y-16 py-16 sm:space-y-20 sm:py-20">
          <Section id="how-to-choose" title="How to choose">
            <Prose paragraphs={HUB.howToChoose} />
          </Section>

          <Section id="one-at-a-time" title="Compare one at a time">
            <VsCards slugs={VS_SLUGS} />
          </Section>

          <Section id="questions" title="Questions">
            <FaqGrid items={faqs} />
          </Section>

          <CompareCta />

          <SourcesList notes={notes.list} page={HUB.h1} />
        </div>
      </div>
    </>
  )
}
