import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { ALT_CONTENT, type AltEntry } from '@/components/marketing/compare/compare-content'
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
  Monogram,
  SourcesList,
  createNotes,
} from '@/components/marketing/compare/compare-ui'
import { articleSchema, breadcrumbSchema, compareMetadata, ezraSoftwareSchema } from '@/components/marketing/compare/compare-schema'
import {
  ALTERNATIVES_SLUGS,
  CHARGE_LABEL,
  EZRA,
  VENDORS,
  VS_SLUGS,
  formatCheckedDate,
  type AlternativesSlug,
  type Fact,
  type VsSlug,
} from '@/lib/data/competitors'

/* ==========================================================================
   /alternatives/[competitor] — the systems people consider instead of X.

   Like an editorial "alternatives" article: a short intro, an at-a-glance
   table, then one well-spaced card per option (what it is, key features,
   pricing, best for, one thing worth knowing). EZRA Pro is listed first and
   labelled as ours.
   ========================================================================== */

export const dynamicParams = false

function resolve(slug: string): AlternativesSlug | null {
  return (ALTERNATIVES_SLUGS as readonly string[]).includes(slug) ? (slug as AlternativesSlug) : null
}

export function generateStaticParams() {
  return ALTERNATIVES_SLUGS.map((competitor) => ({ competitor }))
}

export async function generateMetadata({ params }: { params: Promise<{ competitor: string }> }): Promise<Metadata> {
  const { competitor } = await params
  const slug = resolve(competitor)
  if (!slug) return { title: 'Page not found' }
  const content = ALT_CONTENT[slug]
  return compareMetadata({ title: content.title, description: content.description, path: `/alternatives/${slug}` })
}

const isVs = (id: string): id is VsSlug => (VS_SLUGS as readonly string[]).includes(id)

function profile(entry: AltEntry) {
  if (entry.vendor === 'ezra') {
    return { name: 'EZRA Pro', ours: true, charge: CHARGE_LABEL[EZRA.charge], pricing: EZRA.pricing, whoPays: EZRA.whoPays, bestFor: entry.bestFor ?? EZRA.bestFor }
  }
  const v = VENDORS[entry.vendor]
  return { name: v.name, ours: false, charge: CHARGE_LABEL[v.charge], pricing: v.pricing, whoPays: v.whoPays, bestFor: entry.bestFor ?? v.bestFor }
}

export default async function AlternativesPage({ params }: { params: Promise<{ competitor: string }> }) {
  const { competitor } = await params
  const slug = resolve(competitor)
  if (!slug) notFound()

  const content = ALT_CONTENT[slug]
  const vendor = VENDORS[content.vendor]
  const path = `/alternatives/${slug}`
  const crumbLabel = `${vendor.name} alternatives`
  const anchor = (entry: AltEntry) => `alt-${entry.vendor}`

  /* Footnotes are numbered here, in reading order. */
  const notes = createNotes()
  const fact = (f: Fact) => <FactInline fact={f} n={notes.fact(f)} />

  const glance = [
    ...content.entries.map((entry) => {
      const p = profile(entry)
      return { key: entry.vendor, name: p.name, href: `#${anchor(entry)}`, ours: p.ours, pricing: fact(p.pricing), whoPays: fact(p.whoPays), bestFor: p.bestFor }
    }),
    { key: vendor.id, name: vendor.name, note: 'For reference', pricing: fact(vendor.pricing), whoPays: fact(vendor.whoPays), bestFor: vendor.bestFor },
  ]

  const cards = content.entries.map((entry, index) => {
    const p = profile(entry)
    const vs = entry.vendor === 'ezra' ? (isVs(slug) ? { href: `/compare/${slug}`, label: `EZRA Pro vs ${vendor.name}` } : null) : isVs(entry.vendor) ? { href: `/compare/${entry.vendor}`, label: `EZRA Pro vs ${p.name}` } : null
    return { entry, index, ...p, pricingNode: fact(p.pricing), vs }
  })

  const faqs = content.faqs.map((faq) => ({ ...faq, n: faq.source ? notes.ref(faq.source, faq.reported) : undefined }))

  const related = [
    ...(isVs(slug) ? [{ href: `/compare/${slug}`, label: `EZRA Pro vs ${vendor.name}`, note: 'Side by side, with a cost calculator.' }] : []),
    ...ALTERNATIVES_SLUGS.filter((other) => other !== slug).map((other) => ({
      href: `/alternatives/${other}`,
      label: `${VENDORS[other].name} alternatives`,
      note: `${ALT_CONTENT[other].entries.length} options, in plain terms.`,
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
            { name: crumbLabel, path },
          ]),
          articleSchema({ headline: content.title, description: content.description, path }),
          ezraSoftwareSchema(),
        ]}
      />

      <ArticleHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Compare', href: '/compare' }, { label: crumbLabel }]}
        title={content.h1}
        lede={content.lede}
        photo={content.photo}
      />

      <ArticleBody
        toc={[
          { id: 'at-a-glance', label: 'At a glance' },
          { id: 'options', label: 'The options' },
          ...cards.map((card) => ({ id: anchor(card.entry), label: `${card.index + 1}. ${card.name}`, sub: true })),
          { id: 'how-to-choose', label: 'How to choose' },
          { id: 'questions', label: 'Questions' },
          { id: 'sources', label: 'Sources' },
        ]}
      >
        <Block id="at-a-glance" title="At a glance">
          <GlanceTable caption={`${vendor.name} alternatives at a glance. Not a ranking. Last checked ${formatCheckedDate()}.`} rows={glance} />
        </Block>

        <Block id="options" title={`The ${cards.length} options`} intro={<p>Not a ranking. We make EZRA Pro, so it’s first and marked as ours.</p>}>
          <ol className="space-y-8">
            {cards.map((card) => (
              <li key={card.entry.vendor}>
                <article id={anchor(card.entry)} aria-labelledby={`${anchor(card.entry)}-title`} className="scroll-mt-32 overflow-hidden rounded-[1.5rem] bg-surface ring-1 ring-black/[0.06]">
                  <header className="flex items-center gap-4 border-b border-line-subtle px-6 py-5 sm:px-7">
                    <Monogram name={card.name} index={card.index} ours={card.ours} />
                    <div className="min-w-0">
                      <p className="text-sm text-muted">
                        <span className="tabular-nums">{card.index + 1}.</span> {card.charge}
                      </p>
                      <h3 id={`${anchor(card.entry)}-title`} className="font-display text-[1.5rem] leading-[1.2] font-medium tracking-[-0.025em] text-foreground">
                        {card.name}
                        {card.ours ? <span className="ml-2 inline-flex rounded-full bg-foreground px-2 py-px align-middle text-xs font-medium tracking-normal text-background">Ours</span> : null}
                      </h3>
                    </div>
                  </header>

                  <div className="space-y-6 px-6 py-6 sm:px-7">
                    <p className="text-[1.0625rem] leading-[1.6] text-foreground">{card.entry.about}</p>

                    <div>
                      <h4 className="text-xs font-semibold tracking-[0.06em] text-subtle uppercase">Key features</h4>
                      <Bullets className="mt-3" items={card.entry.features.map((text) => ({ text }))} />
                    </div>

                    <dl className="grid gap-4 rounded-[1rem] bg-background-subtle p-5 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs font-semibold tracking-[0.06em] text-subtle uppercase">Pricing</dt>
                        <dd className="mt-1 text-[0.9375rem] leading-[1.5] text-foreground">{card.pricingNode}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold tracking-[0.06em] text-subtle uppercase">Best for</dt>
                        <dd className="mt-1 text-[0.9375rem] leading-[1.5] text-foreground">{card.bestFor}</dd>
                      </div>
                    </dl>

                    <p className="text-[0.9375rem] leading-[1.55] text-muted">
                      <span className="font-medium text-foreground">Worth knowing: </span>
                      {card.entry.watch}
                    </p>

                    {card.vs ? (
                      <Link href={card.vs.href} className="inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-foreground underline underline-offset-4 hover:text-primary">
                        {card.vs.label}
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </Link>
                    ) : null}
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </Block>

        <Block id="how-to-choose" title="How to choose">
          <Bullets items={content.howToChoose.map((text) => ({ text }))} />
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
