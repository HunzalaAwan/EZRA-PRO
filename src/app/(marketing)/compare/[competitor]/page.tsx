import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { ALT_CONTENT, VS_CONTENT } from '@/components/marketing/compare/compare-content'
import {
  ArticleBody,
  ArticleHero,
  Block,
  Bullets,
  FactInline,
  FaqList,
  GlanceTable,
  JsonLd,
  LinkCards,
  Points,
  Ref,
  SourcesList,
  Steps,
  Verdict,
  createNotes,
} from '@/components/marketing/compare/compare-ui'
import { articleSchema, breadcrumbSchema, compareMetadata, ezraSoftwareSchema } from '@/components/marketing/compare/compare-schema'
import { CostCalculator } from '@/components/marketing/compare/cost-calculator'
import { EZRA, PLAN_RATES, VENDORS, VS_SLUGS, formatCheckedDate, type VsSlug } from '@/lib/data/competitors'

/* ==========================================================================
   /compare/[competitor] — EZRA Pro against one tour booking system.

   Read top to bottom in a few minutes:
     at a glance   pricing, who pays, best for (two rows)
     short answer  choose them if / choose EZRA Pro if
     cost          one sentence, then a one-input calculator
     they do well  three sourced bullets
     we differ     three short points
     switching     three steps
     questions     three answers
     sources       every footnote, numbered
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
  const rates = PLAN_RATES.filter((rate) => rate.vendor === 'ezra' || rate.vendor === content.vendor)

  /* Footnotes are numbered here, in reading order. */
  const notes = createNotes()
  const glance = [
    {
      key: vendor.id,
      name: vendor.name,
      pricing: <FactInline fact={vendor.pricing} n={notes.fact(vendor.pricing)} />,
      whoPays: <FactInline fact={vendor.whoPays} n={notes.fact(vendor.whoPays)} />,
      bestFor: vendor.bestFor,
    },
    {
      key: 'ezra',
      name: 'EZRA Pro',
      ours: true,
      pricing: <FactInline fact={EZRA.pricing} n={notes.fact(EZRA.pricing)} />,
      whoPays: <FactInline fact={EZRA.whoPays} n={notes.fact(EZRA.whoPays)} />,
      bestFor: EZRA.bestFor,
    },
  ]
  const costRefs = [...new Set(rates.filter((r) => r.vendor !== 'ezra').map((r) => notes.ref(r.source, r.status === 'reported')))]
  const strengths = content.strengths.map((line) => ({ ...line, n: line.source ? notes.ref(line.source, line.reported) : undefined }))
  const faqs = content.faqs.map((faq) => ({ ...faq, n: faq.source ? notes.ref(faq.source, faq.reported) : undefined }))

  const related = [
    ...(content.alternatives
      ? [{ href: `/alternatives/${content.alternatives}`, label: `${vendor.name} alternatives`, note: `${ALT_CONTENT[content.alternatives].entries.length} options, in plain terms.` }]
      : []),
    ...content.related.map((other) => ({
      href: `/compare/${other}`,
      label: `EZRA Pro vs ${VENDORS[VS_CONTENT[other].vendor].name}`,
      note: VENDORS[VS_CONTENT[other].vendor].pricing.text,
    })),
    { href: '/compare', label: 'All comparisons', note: 'Eleven systems and the full cost calculator.' },
  ]

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Compare', path: '/compare' },
            { name: content.h1, path },
          ]),
          articleSchema({ headline: content.title, description: content.description, path }),
          ezraSoftwareSchema(),
        ]}
      />

      <ArticleHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Compare', href: '/compare' }, { label: content.h1 }]}
        title={content.h1}
        lede={content.lede}
        photo={content.photo}
      />

      <ArticleBody
        toc={[
          { id: 'at-a-glance', label: 'At a glance' },
          { id: 'short-answer', label: 'The short answer' },
          { id: 'cost', label: 'What it costs' },
          { id: 'strengths', label: `What ${vendor.name} does well` },
          { id: 'differences', label: 'Where EZRA Pro differs' },
          { id: 'switching', label: 'Switching' },
          { id: 'questions', label: 'Questions' },
          { id: 'sources', label: 'Sources' },
        ]}
      >
        <Block id="at-a-glance" title="At a glance">
          <GlanceTable caption={`${vendor.name} and EZRA Pro at a glance. Last checked ${formatCheckedDate()}.`} rows={glance} />
        </Block>

        <Block id="short-answer" title="The short answer">
          <Verdict them={{ name: vendor.name, items: content.verdict.them }} us={content.verdict.us} />
        </Block>

        <Block
          id="cost"
          title="What it costs"
          intro={
            <p>
              {content.cost.summary}
              {costRefs.map((n) => (
                <Ref key={n} n={n} />
              ))}
            </p>
          }
        >
          <CostCalculator rates={rates} defaultValue={content.cost.value} checkedOn={formatCheckedDate()} />
        </Block>

        <Block id="strengths" title={`What ${vendor.name} does well`}>
          <Bullets items={strengths} />
        </Block>

        <Block id="differences" title="Where EZRA Pro differs">
          <Points items={content.differences} />
        </Block>

        <Block id="switching" title={`Switching from ${vendor.name}`}>
          <Steps items={content.switching} />
        </Block>

        <Block id="questions" title="Questions">
          <FaqList items={faqs} />
        </Block>

        <Block id="keep-comparing" title="Keep comparing">
          <LinkCards links={related} />
        </Block>

        <SourcesList notes={notes.list} page={content.h1} />
      </ArticleBody>

      <ClosingCta />
    </>
  )
}
