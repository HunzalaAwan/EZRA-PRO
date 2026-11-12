import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { ALT_CONTENT, HUB, VS_CONTENT } from '@/components/marketing/compare/compare-content'
import {
  ArticleBody,
  ArticleHero,
  Block,
  Bullets,
  FactInline,
  GlanceTable,
  JsonLd,
  LinkCards,
  Ref,
  SourceAnchor,
  SourcesList,
  createNotes,
  type GlanceRow,
} from '@/components/marketing/compare/compare-ui'
import { articleSchema, breadcrumbSchema, compareMetadata, ezraSoftwareSchema } from '@/components/marketing/compare/compare-schema'
import { CostCalculator } from '@/components/marketing/compare/cost-calculator'
import { Button } from '@/components/ui/button'
import {
  ALTERNATIVES_SLUGS,
  EZRA,
  EZRA_PLAN,
  MATRIX_COLUMNS,
  PLAN_RATES,
  SOURCES,
  VENDORS,
  VENDOR_ORDER,
  VS_SLUGS,
  formatCheckedDate,
  type CellTone,
} from '@/lib/data/competitors'
import { cn } from '@/lib/utils'

/* ==========================================================================
   /compare — the hub.

     our price      EZRA Pro's one plan, in one card
     at a glance    pricing, who pays, best for: every system
     how they charge three models, in three cards
     features       six features that differ, as name chips by status
     calculator     one input, a bar list
     comparisons    every vs and alternatives page
     how we check   four lines
     sources        every footnote, numbered
   ========================================================================== */

const PATH = '/compare'

export const metadata: Metadata = compareMetadata({ title: HUB.title, description: HUB.description, path: PATH })

const TONES: { tone: CellTone; label: string }[] = [
  { tone: 'yes', label: 'Built in' },
  { tone: 'limited', label: 'Partly, or as an add-on' },
  { tone: 'not-shown', label: 'Not shown on their pages' },
]

export default function CompareHubPage() {
  const checked = formatCheckedDate()

  /* Footnotes are numbered here, in reading order. */
  const notes = createNotes()

  const ezraPriceRef = notes.fact(EZRA.pricing)

  const glance: GlanceRow[] = [
    {
      key: 'ezra',
      name: 'EZRA Pro',
      href: '/pricing',
      ours: true,
      pricing: <FactInline fact={EZRA.pricing} n={notes.fact(EZRA.pricing)} />,
      whoPays: <FactInline fact={EZRA.whoPays} n={notes.fact(EZRA.whoPays)} />,
      bestFor: EZRA.bestFor,
    },
    ...VENDOR_ORDER.map((id) => {
      const v = VENDORS[id]
      return {
        key: id,
        name: v.name,
        href: v.hasVsPage ? `/compare/${id}` : undefined,
        pricing: <FactInline fact={v.pricing} n={notes.fact(v.pricing)} />,
        whoPays: <FactInline fact={v.whoPays} n={notes.fact(v.whoPays)} />,
        bestFor: v.bestFor,
      }
    }),
  ]

  const features = MATRIX_COLUMNS.map((col) => {
    const entries = [
      { key: 'ezra', name: 'EZRA Pro', ours: true, cell: EZRA.matrix[col.key] },
      ...VENDOR_ORDER.map((id) => ({ key: id, name: VENDORS[id].name, ours: false, cell: VENDORS[id].matrix[col.key] })),
    ].map((entry) => ({ ...entry, n: notes.fact(entry.cell) }))
    return {
      ...col,
      groups: TONES.map((t) => ({ ...t, entries: entries.filter((e) => e.cell.tone === t.tone) })).filter((g) => g.entries.length > 0),
    }
  })

  const calcRefs = [...new Set(PLAN_RATES.map((r) => notes.ref(r.source, r.status === 'reported')))]

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Compare', path: PATH },
          ]),
          articleSchema({ headline: HUB.title, description: HUB.description, path: PATH }),
          ezraSoftwareSchema(),
        ]}
      />

      <ArticleHero crumbs={[{ label: 'Home', href: '/' }, { label: 'Compare' }]} title={HUB.h1} lede={HUB.lede} photo={HUB.photo} />

      <ArticleBody
        toc={[
          { id: 'our-price', label: 'Our price' },
          { id: 'at-a-glance', label: 'At a glance' },
          { id: 'how-they-charge', label: 'How they charge' },
          { id: 'features', label: 'Features that differ' },
          { id: 'calculator', label: 'Cost calculator' },
          { id: 'comparisons', label: 'Comparisons' },
          { id: 'method', label: 'How we check' },
          { id: 'sources', label: 'Sources' },
        ]}
      >
        {/* ---------- our price ---------- */}
        <section id="our-price" aria-labelledby="our-price-title" className="scroll-mt-32">
          <div className="rounded-[1.75rem] bg-cal-lavender p-7 sm:p-9">
            <h2 id="our-price-title" className="text-sm font-medium text-foreground">
              EZRA Pro has one plan
            </h2>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3">
              <span className="font-display text-[4rem] leading-none font-medium tracking-[-0.04em] text-foreground sm:text-[5rem]">{EZRA_PLAN.percent}%</span>
              <span className="text-[1.125rem] text-foreground">
                of each booking
                <Ref n={ezraPriceRef} />
              </span>
            </p>
            <ul className="mt-6 grid gap-x-6 gap-y-2 text-[1rem] text-foreground sm:grid-cols-2">
              {[`$${EZRA_PLAN.monthly} a month`, 'No setup fee', 'No contract', 'You or your guests pay: your call'].map((item) => (
                <li key={item} className="flex gap-3">
                  <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-foreground/50" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild variant="ink" size="lg" className="rounded-[10px] px-6" rightIcon={<ArrowRight aria-hidden="true" />}>
                <Link href="/signup">Start free</Link>
              </Button>
              <Button asChild variant="secondary" size="lg" className="rounded-[10px] px-6">
                <Link href="/pricing">See pricing</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ---------- at a glance ---------- */}
        <Block id="at-a-glance" title="At a glance" intro={<p>Twelve systems, in three plain columns. Names with a link have their own comparison.</p>}>
          <GlanceTable caption={`Tour booking software at a glance. Last checked ${checked}.`} rows={glance} />
        </Block>

        {/* ---------- how they charge ---------- */}
        <Block id="how-they-charge" title="How they charge" intro={<p>Booking itself works much the same everywhere. The real difference is the bill.</p>}>
          <ul className="grid gap-4 sm:grid-cols-3">
            {HUB.models.map((model, i) => (
              <li key={model.title} className={cn('flex flex-col rounded-[1.25rem] p-5', ['bg-cal-seafoam', 'bg-cal-sky', 'bg-cal-peach'][i])}>
                <h3 className="font-display text-[1.125rem] font-medium tracking-[-0.015em] text-foreground">{model.title}</h3>
                <p className="mt-2 text-[0.9375rem] leading-[1.5] text-foreground/80">{model.body}</p>
                <p className="mt-auto pt-4 text-sm text-foreground">{model.who}</p>
              </li>
            ))}
          </ul>
        </Block>

        {/* ---------- features ---------- */}
        <Block
          id="features"
          title="Features that differ"
          intro={<p>Online booking, payments and promo codes are standard, so they’re left out. These six vary.</p>}
        >
          <ul className="grid gap-4 sm:grid-cols-2">
            {features.map((feature) => (
              <li key={feature.key} className="rounded-[1.25rem] bg-surface p-5 ring-1 ring-black/[0.06]">
                <h3 className="font-medium text-foreground">{feature.label}</h3>
                <dl className="mt-3 space-y-3">
                  {feature.groups.map((group) => (
                    <div key={group.tone}>
                      <dt className="text-xs font-medium text-subtle">{group.label}</dt>
                      <dd className="mt-1.5 flex flex-wrap gap-1.5">
                        {group.entries.map((entry) => (
                          <span
                            key={entry.key}
                            title={entry.cell.text}
                            className={cn(
                              'inline-flex items-center rounded-full px-2.5 py-0.5 text-sm',
                              entry.ours
                                ? 'bg-foreground text-background'
                                : group.tone === 'yes'
                                  ? 'bg-cal-honeydew text-foreground'
                                  : group.tone === 'limited'
                                    ? 'bg-cal-sunbeam text-foreground'
                                    : 'bg-background-subtle text-muted',
                            )}
                          >
                            {entry.name}
                            <sup className="relative -top-[0.4em] ml-0.5 align-baseline text-xs leading-none">
                              <a href={`#source-${entry.n}`} aria-label={`Source ${entry.n}`} className={cn('no-underline', entry.ours ? 'text-background/70' : 'text-subtle')}>
                                {entry.n}
                              </a>
                            </sup>
                          </span>
                        ))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </Block>

        {/* ---------- calculator ---------- */}
        <Block
          id="calculator"
          title="What would you pay?"
          intro={
            <p>
              Enter a month of online bookings. As volume grows, several plans cost less than EZRA Pro, and the bars show it.
              {calcRefs.map((n) => (
                <Ref key={n} n={n} />
              ))}
            </p>
          }
        >
          <CostCalculator rates={PLAN_RATES} defaultValue={10_000} checkedOn={checked} />
        </Block>

        {/* ---------- every page ---------- */}
        <Block id="comparisons" title="Comparisons">
          <LinkCards
            links={[
              ...VS_SLUGS.map((slug) => ({ href: `/compare/${slug}`, label: VS_CONTENT[slug].h1, note: VENDORS[VS_CONTENT[slug].vendor].bestFor })),
              ...ALTERNATIVES_SLUGS.map((slug) => ({
                href: `/alternatives/${slug}`,
                label: `${VENDORS[slug].name} alternatives`,
                note: `${ALT_CONTENT[slug].entries.length} options, in plain terms`,
              })),
            ]}
          />
        </Block>

        {/* ---------- method ---------- */}
        <Block id="method" title="How we check">
          <Bullets items={HUB.method.map((text) => ({ text }))} />
        </Block>

        <SourcesList
          notes={notes.list}
          page={HUB.h1}
          extra={
            <p className="mt-5 text-sm text-muted">
              Further reading on how booking fees are passed on: <SourceAnchor source={SOURCES.arival} />
            </p>
          }
        />
      </ArticleBody>

      <ClosingCta />
    </>
  )
}
