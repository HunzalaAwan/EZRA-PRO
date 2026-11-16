import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { VS_CONTENT, moveSteps } from '@/components/marketing/compare/compare-content'
import { CheckList, CostTable, CustomerQuote, FeatureRundown, MoveSteps, Prose, ReasonCards } from '@/components/marketing/compare/compare-longform'
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
import { articleSchema, breadcrumbSchema, compareMetadata, ezraSoftwareSchema, faqPageSchema } from '@/components/marketing/compare/compare-schema'
import { CostCheck } from '@/components/marketing/compare/cost-calculator'
import { PRICING_PLANS, TESTIMONIALS } from '@/content/marketing'
import { EZRA, EZRA_PLAN, PLAN_RATES, VENDORS, VS_SLUGS, formatCheckedDate, money, platformCost, rateById, type VsSlug } from '@/lib/data/competitors'

/* ==========================================================================
   /compare/[competitor] — EZRA Pro against one system.

     headline       one line under it
     the card       price rows, then running-the-business rows
     short answer   two paragraphs
     which fits     choose EZRA Pro if / choose them if
     cost           one input, two bars, then a worked table
     why switch     three reasons operators give
     topic by topic payments, marketplaces, guests, reports, support
     moving over    five steps, the first one specific to them
     quote          one customer
     questions      6–8, marked up as FAQPage
     CTA, also compare, sources
   ========================================================================== */

export const dynamicParams = false

const COST_EXAMPLES = [3_000, 10_000, 25_000]

/** What the one plan includes, as the pricing page lists it. */
const INCLUDED = PRICING_PLANS[0].features.map(({ label, hint }) => ({ label, hint }))

function resolve(slug: string): VsSlug | null {
  return (VS_SLUGS as readonly string[]).includes(slug) ? (slug as VsSlug) : null
}

/** Testimonial copy is stored with HTML entities; print it as plain text. */
function plain(text: string) {
  return text.replace(/&rsquo;/g, '’').replace(/&lsquo;/g, '‘').replace(/&mdash;/g, '—').replace(/&amp;/g, '&')
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

  /* Sources are numbered here, in reading order. */
  const notes = createNotes()
  const columns = buildColumns(notes, [
    { key: 'ezra', name: EZRA.name, ours: true, cells: EZRA.cells },
    { key: vendor.id, name: vendor.name, cells: vendor.cells },
  ])
  const ezraRate = rateById('ezra')
  const theirRates = PLAN_RATES.filter((rate) => rate.vendor === content.vendor)
  theirRates.forEach((rate) => notes.ref(rate.source, rate.status === 'reported'))
  content.switchSources?.forEach((source) => notes.ref(source, true))
  content.topicSources?.forEach((source) => notes.ref(source))
  const faqs = content.faqs.map((faq) => ({ ...faq, n: faq.source ? notes.ref(faq.source, faq.reported) : undefined }))
  const others = VS_SLUGS.filter((other) => other !== slug)

  const costRows = theirRates.length
    ? COST_EXAMPLES.map((value) => {
        const best = theirRates.reduce((a, b) => (platformCost(b, value) < platformCost(a, value) ? b : a))
        return {
          value: money(value),
          ezra: money(platformCost(ezraRate, value)),
          them: money(platformCost(best, value)),
          note: theirRates.length > 1 ? `on ${best.plan}` : undefined,
        }
      })
    : []

  const quote = TESTIMONIALS.find((t) => t.id === content.quoteId) ?? TESTIMONIALS[0]

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
          faqPageSchema(content.faqs),
          ezraSoftwareSchema(),
        ]}
      />

      <CompareHero crumbs={[{ label: 'Home', href: '/' }, { label: 'Compare', href: '/compare' }, { label: content.h1 }]} title={content.h1} subhead={content.subhead} />

      <div className={WRAP}>
        <div className="mx-auto -mt-20 max-w-3xl sm:-mt-28">
          <ComparisonCard caption={`${content.h1}: price, fees and features side by side. Last checked ${checked}.`} columns={columns} />
          <CardNote fair={content.fairNote} estimates={vendor.estimatesNote} />
        </div>

        <div className="space-y-16 py-16 sm:space-y-20 sm:py-20">
          <Section id="short-answer" title="The short answer">
            <Prose paragraphs={content.shortAnswer} />
          </Section>

          <Section id="which-fits" title="Which one fits you?">
            <Verdict them={{ name: vendor.name, items: content.verdict.them }} us={content.verdict.us} />
          </Section>

          <Section id="cost" title="What you’d pay">
            <Prose paragraphs={content.costText} className="mb-8" />
            {theirRates.length ? (
              <div className="space-y-6">
                <CostCheck ezra={ezraRate} them={theirRates} defaultValue={content.costValue} checkedOn={checked} />
                <CostTable caption={`Monthly platform cost, EZRA Pro and ${vendor.name}`} themLabel={vendor.name} rows={costRows} />
              </div>
            ) : null}
          </Section>

          <Section id="about" title={`About ${vendor.name}`}>
            <Prose paragraphs={content.about} />
          </Section>

          <Section id="why-switch" title={`Why operators switch from ${vendor.name}`}>
            <Prose paragraphs={[content.switchIntro]} className="mb-8" />
            <ReasonCards items={content.switchReasons} />
          </Section>

          <Section id="feature-by-feature" title="Feature by feature">
            <FeatureRundown themName={vendor.name} items={content.topics} />
          </Section>

          <Section id="move" title={`How to move from ${vendor.name} to EZRA Pro`}>
            <Prose paragraphs={[`Most operators move over a weekend, without pausing sales. The move is free: send us an export and we rebuild your activities, prices, add-ons, guest records and every future booking.`]} className="mb-8" />
            <MoveSteps steps={moveSteps(vendor.name, content.exportStep)} />
          </Section>

          <Section id="included" title={`Everything in EZRA Pro’s ${EZRA_PLAN.percent}%`}>
            <CheckList items={INCLUDED} />
          </Section>

          <CustomerQuote quote={plain(quote.quote)} author={quote.author} role={quote.role} company={quote.company} />

          <Section id="questions" title={`EZRA Pro vs ${vendor.name}: questions`}>
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
              All side by side
            </Link>
          </nav>

          <SourcesList notes={notes.list} page={content.h1} />
        </div>
      </div>
    </>
  )
}
