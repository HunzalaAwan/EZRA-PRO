import type { Metadata } from 'next'

import { HUB } from '@/components/marketing/compare/compare-content'
import {
  CardNote,
  CompareCta,
  CompareHero,
  ComparisonCard,
  JsonLd,
  Section,
  SourcesList,
  VsCards,
  WRAP,
  buildColumns,
  createNotes,
} from '@/components/marketing/compare/compare-ui'
import { articleSchema, breadcrumbSchema, compareMetadata, ezraSoftwareSchema } from '@/components/marketing/compare/compare-schema'
import { EZRA, VENDORS, VENDOR_ORDER, VS_SLUGS, formatCheckedDate } from '@/lib/data/competitors'

/* ==========================================================================
   /compare — EZRA Pro against FareHarbor, Peek Pro and Bókun.

     headline     one line under it
     the card     six rows, four systems, EZRA Pro's column in lavender
     vs cards     one per comparison page
     CTA          the price, two buttons
     sources      every footnote, numbered
   ========================================================================== */

const PATH = '/compare'

export const metadata: Metadata = compareMetadata({ title: HUB.title, description: HUB.description, path: PATH })

export default function CompareHubPage() {
  const notes = createNotes()
  const columns = buildColumns(notes, [
    { key: 'ezra', name: EZRA.name, ours: true, cells: EZRA.cells },
    ...VENDOR_ORDER.map((id) => ({ key: id, name: VENDORS[id].name, cells: VENDORS[id].cells })),
  ])

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Compare', path: PATH },
          ]),
          articleSchema({ headline: HUB.h1, description: HUB.description, path: PATH }),
          ezraSoftwareSchema(),
        ]}
      />

      <CompareHero crumbs={[{ label: 'Home', href: '/' }, { label: 'Compare' }]} title={HUB.h1} subhead={HUB.subhead} />

      <div className={WRAP}>
        <div className="-mt-20 sm:-mt-28">
          <ComparisonCard
            caption={`EZRA Pro, FareHarbor, Peek Pro and Bókun compared on price, fees and features. Last checked ${formatCheckedDate()}.`}
            columns={columns}
            stackOnPhones
          />
          <CardNote fair={HUB.fairNote} />
        </div>

        <div className="space-y-16 py-16 sm:space-y-20 sm:py-20">
          <Section id="one-at-a-time" title="Compare one at a time">
            <VsCards slugs={VS_SLUGS} />
          </Section>

          <CompareCta />

          <SourcesList notes={notes.list} page={HUB.h1} />
        </div>
      </div>
    </>
  )
}
