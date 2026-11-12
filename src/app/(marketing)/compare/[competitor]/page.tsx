import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'

import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { VS_CONTENT } from '@/components/marketing/compare/compare-content'
import {
  CompareHero,
  Dot,
  FactBlock,
  FaqList,
  JsonLd,
  LinkCards,
  MethodNote,
  OnThisPage,
  PointGrid,
  ReportError,
  ScrollHint,
  ScrollTable,
  Section,
  TD,
  TH,
} from '@/components/marketing/compare/compare-ui'
import { articleSchema, breadcrumbSchema, compareMetadata, ezraSoftwareSchema } from '@/components/marketing/compare/compare-schema'
import { CostCalculator } from '@/components/marketing/compare/cost-calculator'
import { EZRA_CALC_NOTE, PLAN_RATES, VENDORS, VS_SLUGS, formatCheckedDate, type VsSlug } from '@/lib/data/competitors'

/* ==========================================================================
   /compare/[competitor] — EZRA Pro against one tour booking system.

   The order a reader needs:
     hero        what this compares, and when it was checked
     verdict     choose them if… / choose EZRA Pro if…
     table       fees and features, every fact sourced
     cost        a month's cost at a real volume, then the calculator
     strengths   what the competitor does well
     differences where EZRA Pro differs
     switching   how to move
     faq         questions, answered on the page
     method      how we checked, how to report an error, where to go next
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

  const related = [
    ...(content.alternatives
      ? [{ href: `/alternatives/${content.alternatives}`, label: `${vendor.name} alternatives`, note: 'Other systems, grouped by how they charge.' }]
      : []),
    ...content.related.map((other) => ({
      href: `/compare/${other}`,
      label: `EZRA Pro vs ${VENDORS[VS_CONTENT[other].vendor].name}`,
      note: VENDORS[VS_CONTENT[other].vendor].model.text,
    })),
    { href: '/compare', label: 'All comparisons', note: 'Eleven systems, the fee calculator and our method.' },
    { href: '/pricing', label: 'EZRA Pro pricing', note: 'Plans, commission and what each includes.' },
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

      <CompareHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Compare', href: '/compare' }, { label: content.h1 }]}
        title={content.h1}
        lede={content.lede}
      >
        <OnThisPage
          items={[
            { href: '#verdict', label: 'Verdict' },
            { href: '#side-by-side', label: 'Side by side' },
            { href: '#cost', label: 'Cost' },
            { href: '#switching', label: 'Switching' },
            { href: '#questions', label: 'Questions' },
          ]}
        />
      </CompareHero>

      {/* ---------- verdict ---------- */}
      <Section id="verdict" eyebrow="The short answer" title={`${vendor.name} or EZRA Pro?`}>
        <div className="grid gap-5 lg:grid-cols-2">
          {[
            { heading: `Choose ${vendor.name} if…`, items: content.verdict.them, tone: 'bg-cal-sunbeam' },
            { heading: 'Choose EZRA Pro if…', items: content.verdict.us, tone: 'bg-cal-honeydew' },
          ].map((side) => (
            <div key={side.heading} className={`rounded-[1.5rem] p-6 sm:p-8 ${side.tone}`}>
              <h3 className="font-display text-[1.375rem] font-medium tracking-[-0.02em] text-foreground">{side.heading}</h3>
              <ul className="mt-5 space-y-3.5">
                {side.items.map((item) => (
                  <li key={item} className="flex gap-3 text-[1rem] leading-[1.55] text-foreground">
                    <Dot />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      {/* ---------- table ---------- */}
      <Section
        id="side-by-side"
        tone="subtle"
        eyebrow="Side by side"
        title="Fees and features, with sources"
        intro={
          <p>
            Each {vendor.name} fact links to the page it came from. “Reported” marks a figure from a third party because {vendor.name} doesn’t
            publish it. EZRA Pro’s column comes from our pricing page, our checkout and the product itself.
          </p>
        }
      >
        <ScrollTable label={`EZRA Pro and ${vendor.name} compared`} minWidth="46rem">
          <table className="w-full border-collapse text-left">
            <caption className="px-4 pt-4 pb-2 text-left text-sm text-muted">
              EZRA Pro and {vendor.name} compared. Last checked {formatCheckedDate()}.
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={`${TH} w-[22%]`}>What</th>
                <th scope="col" className={`${TH} w-[39%]`}>{vendor.name}</th>
                <th scope="col" className={`${TH} w-[39%]`}>EZRA Pro</th>
              </tr>
            </thead>
            <tbody>
              {content.rows.map((row) => (
                <tr key={row.label} className="border-b border-line-subtle last:border-b-0">
                  <th scope="row" className={`${TD} font-medium text-foreground`}>{row.label}</th>
                  <td className={TD}><FactBlock fact={row.them} /></td>
                  <td className={`${TD} bg-cal-haze`}><FactBlock fact={row.us} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <ScrollHint />
      </Section>

      {/* ---------- cost ---------- */}
      <Section id="cost" eyebrow="Cost" title="What a month costs" intro={<p>{content.cost.intro}</p>}>
        <ul className="mb-8 max-w-3xl space-y-3 text-[1rem] leading-[1.6] text-foreground">
          {content.cost.points.map((point) => (
            <li key={point} className="flex gap-3">
              <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <CostCalculator rates={rates} defaultValue={content.cost.value} checkedOn={formatCheckedDate()} ezraNote={EZRA_CALC_NOTE} />
      </Section>

      {/* ---------- strengths ---------- */}
      <Section
        id="strengths"
        tone="subtle"
        eyebrow="Fair is fair"
        title={`What ${vendor.name} does well`}
        intro={<p>{vendor.suits}</p>}
      >
        <PointGrid points={content.strengths} />
      </Section>

      {/* ---------- differences ---------- */}
      <Section id="differences" eyebrow="EZRA Pro" title="Where EZRA Pro differs">
        <PointGrid points={content.differences} />
        <p className="mt-6 text-sm text-muted">
          See every plan and what it includes on{' '}
          <Link href="/pricing" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
            our pricing page
          </Link>
          .
        </p>
      </Section>

      {/* ---------- switching ---------- */}
      <Section id="switching" tone="cloud" eyebrow="Switching" title={`Moving from ${vendor.name}`} intro={<p>{content.switching.intro}</p>}>
        <PointGrid points={content.switching.steps} numbered />
      </Section>

      {/* ---------- questions ---------- */}
      <Section id="questions" eyebrow="Questions" title={`${vendor.name} and EZRA Pro: common questions`}>
        <FaqList faqs={content.faqs} />
      </Section>

      {/* ---------- method, errors, next ---------- */}
      <Section id="method" tone="subtle" eyebrow="How we checked" title="Sources, dates and corrections">
        <div className="grid gap-8 lg:grid-cols-2">
          <MethodNote />
          <ReportError page={content.h1} />
        </div>
        <h3 className="mt-12 font-display text-[1.25rem] font-medium text-foreground">Keep comparing</h3>
        <div className="mt-5">
          <LinkCards links={related} />
        </div>
      </Section>

      <ClosingCta />
    </>
  )
}
