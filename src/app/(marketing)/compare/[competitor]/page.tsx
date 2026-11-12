import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { VS_CONTENT } from '@/components/marketing/compare/compare-content'
import {
  CardNote,
  CompareCta,
  CompareHero,
  ComparisonCard,
  FaqGrid,
  JsonLd,
  Section,
  SourcesList,
  Verdict,
  WRAP,
  buildColumns,
  createNotes,
} from '@/components/marketing/compare/compare-ui'
import { articleSchema, breadcrumbSchema, compareMetadata, ezraSoftwareSchema } from '@/components/marketing/compare/compare-schema'
import { CostCheck } from '@/components/marketing/compare/cost-calculator'
import { EZRA, PLAN_RATES, VENDORS, VS_SLUGS, formatCheckedDate, rateById, type VsSlug } from '@/lib/data/competitors'

/* ==========================================================================
   /compare/[competitor] — EZRA Pro against one system, in a minute's read.

     headline     one line under it
     the card     six rows, two systems side by side
     which fits   choose EZRA Pro if / choose them if, three each
     cost         one input, two bars
     questions    three short answers
     CTA, also compare, sources
   ========================================================================== */

export const dynamicParams = false

function resolve(slug: string): VsSlug | null {
  return (VS_SLUGS as readonly string[]).includes(slug) ? (slug as VsSlug) : null
}

export function generateStaticParams() {
  return VS_SLUGS.map((competitor) => ({ competitor }))
}

export async function generateMetadata({ params }: { params: Promise<{ competitor: string }> }): Promise<Metadata> {
  const { competitor } = await params
  const slug = resolve(competitor)
  if (!slug) return { title: 'Comparison not found' }
  const content = VS_CONTENT[slug]
  return compareMetadata({ title: content.title, description: content.description, path: `/compare/${slug}` })
}

export default async function VsPage({ params }: { params: Promise<{ competitor: string }> }) {
  const { competitor } = await params
  const slug = resolve(competitor)
  if (!slug) notFound()

  const content = VS_CONTENT[slug]
  const vendor = VENDORS[content.vendor]
  const path = `/compare/${slug}`
  const checked = formatCheckedDate()

  /* Footnotes are numbered here, in reading order. */
  const notes = createNotes()
  const columns = buildColumns(notes, [
    { key: 'ezra', name: EZRA.name, ours: true, cells: EZRA.cells },
    { key: vendor.id, name: vendor.name, cells: vendor.cells },
  ])
  const theirRates = PLAN_RATES.filter((rate) => rate.vendor === content.vendor)
  theirRates.forEach((rate) => notes.ref(rate.source, rate.status === 'reported'))
  const faqs = content.faqs.map((faq) => ({ ...faq, n: faq.source ? notes.ref(faq.source, faq.reported) : undefined }))
  const others = VS_SLUGS.filter((other) => other !== slug)

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Compare', path: '/compare' },
            { name: content.h1, path },
          ]),
          articleSchema({ headline: content.h1, description: content.description, path }),
          ezraSoftwareSchema(),
        ]}
      />

      <CompareHero crumbs={[{ label: 'Home', href: '/' }, { label: 'Compare', href: '/compare' }, { label: content.h1 }]} title={content.h1} subhead={content.subhead} />

      <div className={WRAP}>
        <div className="mx-auto -mt-20 max-w-3xl sm:-mt-28">
          <ComparisonCard caption={`${content.h1}: price, fees and features side by side. Last checked ${checked}.`} columns={columns} />
          <CardNote fair={content.fairNote} />
        </div>

        <div className="space-y-16 py-16 sm:space-y-20 sm:py-20">
          <Section id="which-fits" title="Which one fits you?">
            <Verdict them={{ name: vendor.name, items: content.verdict.them }} us={content.verdict.us} />
          </Section>

          <Section id="cost" title="What you’d pay">
            <CostCheck ezra={rateById('ezra')} them={theirRates} defaultValue={content.costValue} checkedOn={checked} />
          </Section>

          <Section id="questions" title="Questions">
            <FaqGrid items={faqs} />
          </Section>

          <CompareCta />

          <nav aria-label="Other comparisons" className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[0.9375rem]">
            <span className="text-muted">Also compare:</span>
            {others.map((other) => (
              <Link key={other} href={`/compare/${other}`} className="font-medium text-foreground underline decoration-line-strong underline-offset-4 hover:text-primary">
                EZRA Pro vs {VENDORS[other].name}
              </Link>
            ))}
            <Link href="/compare" className="font-medium text-foreground underline decoration-line-strong underline-offset-4 hover:text-primary">
              All four side by side
            </Link>
          </nav>

          <SourcesList notes={notes.list} page={content.h1} />
        </div>
      </div>
    </>
  )
}
