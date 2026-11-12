import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { ALT_CONTENT, HUB, VS_CONTENT } from '@/components/marketing/compare/compare-content'
import {
  CompareHero,
  FactBrief,
  JsonLd,
  LinkCards,
  OnThisPage,
  ReportError,
  ScrollHint,
  ScrollTable,
  Section,
  SourceLink,
  TD,
  TH,
  ToneLegend,
  ToneMark,
} from '@/components/marketing/compare/compare-ui'
import { articleSchema, breadcrumbSchema, compareMetadata, ezraSoftwareSchema } from '@/components/marketing/compare/compare-schema'
import { CostCalculator } from '@/components/marketing/compare/cost-calculator'
import {
  ALTERNATIVES_SLUGS,
  CHECKED_ON,
  EZRA,
  EZRA_CALC_NOTE,
  MATRIX_COLUMNS,
  PLAN_RATES,
  SOURCES,
  VENDORS,
  VENDOR_ORDER,
  VS_SLUGS,
  formatCheckedDate,
  type Fact,
  type MatrixCell,
  type MatrixKey,
  type Source,
} from '@/lib/data/competitors'
import { cn } from '@/lib/utils'

/* ==========================================================================
   /compare — the hub: who each system suits, a dated and sourced matrix,
   the cost calculator, every comparison page, and the method.
   ========================================================================== */

const PATH = '/compare'

export const metadata: Metadata = compareMetadata({ title: HUB.title, description: HUB.description, path: PATH })

/** Distinct sources behind one row, in order of first use. */
function rowSources(facts: Fact[]): Source[] {
  const seen = new Map<string, Source>()
  for (const fact of facts) if (!seen.has(fact.source.url)) seen.set(fact.source.url, fact.source)
  return [...seen.values()]
}

interface HubRow {
  key: string
  name: string
  href?: string
  ours?: boolean
  monthly: Fact
  fee: Fact
  whoPays: Fact
  processing: Fact
  owner?: Fact
  matrix: Record<MatrixKey, MatrixCell>
}

const ROWS: HubRow[] = [
  {
    key: 'ezra',
    name: 'EZRA Pro',
    href: '/pricing',
    ours: true,
    monthly: EZRA.monthly,
    fee: EZRA.fee,
    whoPays: EZRA.whoPays,
    processing: EZRA.processing,
    matrix: EZRA.matrix,
  },
  ...VENDOR_ORDER.map((id) => {
    const v = VENDORS[id]
    return {
      key: id,
      name: v.name,
      href: v.hasVsPage ? `/compare/${id}` : undefined,
      monthly: v.monthly,
      fee: v.fee,
      whoPays: v.whoPays,
      processing: v.processing,
      owner: v.owner,
      matrix: v.matrix,
    }
  }),
]

function RowHead({ row, facts }: { row: HubRow; facts: Fact[] }) {
  return (
    <th scope="row" className={`${TD} w-[13rem] font-medium text-foreground`}>
      {row.href ? (
        <Link href={row.href} className="underline decoration-line-strong underline-offset-4 hover:text-primary">
          {row.name}
        </Link>
      ) : (
        row.name
      )}
      {row.ours ? <span className="mt-1 block text-xs font-normal text-subtle">Our product</span> : null}
      <span className="mt-2 flex flex-col gap-1">
        {rowSources(facts).map((source, i) => (
          <SourceLink key={source.url} source={source} prefix={i === 0 ? 'Sources:' : ''} />
        ))}
      </span>
    </th>
  )
}

export default function CompareHubPage() {
  const checked = formatCheckedDate()

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

      <CompareHero crumbs={[{ label: 'Home', href: '/' }, { label: 'Compare' }]} title={HUB.h1} lede={HUB.lede}>
        <OnThisPage
          items={[
            { href: '#who-it-suits', label: 'Who each suits' },
            { href: '#pricing', label: 'Pricing' },
            { href: '#features', label: 'Features' },
            { href: '#calculator', label: 'Cost calculator' },
            { href: '#pages', label: 'All comparisons' },
            { href: '#method', label: 'Method' },
          ]}
        />
      </CompareHero>

      {/* ---------- who each suits ---------- */}
      <Section
        id="who-it-suits"
        eyebrow="Fit first"
        title="Who each system suits"
        intro={<p>Core booking is much the same everywhere. The real differences are how each one charges and the day-of work it’s built for.</p>}
      >
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROWS.map((row) => {
            const suits = row.ours ? HUB.ezraSuits : VENDORS[row.key as keyof typeof VENDORS].suits
            return (
              <li
                key={row.key}
                className={cn(
                  'flex flex-col rounded-[1.25rem] bg-surface p-6 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04]',
                  row.ours && 'ring-2 ring-cal-iris',
                )}
              >
                <h3 className="font-display text-[1.25rem] font-medium tracking-[-0.015em] text-foreground">{row.name}</h3>
                <p className="mt-2 text-[0.9375rem] leading-[1.55] text-muted">{suits}</p>
                {row.owner ? <p className="mt-3 text-sm text-subtle">Owner: {row.owner.text}</p> : null}
                {row.href ? (
                  <Link
                    href={row.href}
                    className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[0.9375rem] font-medium text-foreground underline underline-offset-4 hover:text-primary"
                  >
                    {row.ours ? 'EZRA Pro pricing' : `EZRA Pro vs ${row.name}`}
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                ) : null}
              </li>
            )
          })}
        </ul>
      </Section>

      {/* ---------- pricing table ---------- */}
      <Section
        id="pricing"
        tone="subtle"
        eyebrow="Pricing"
        title="How each system charges"
        intro={
          <p>
            Three models cover the field: no subscription and a fee of around 6% per online booking, often paid by the guest; a subscription plus a published
            1–3%; or contract and enterprise pricing. List prices, checked {checked}.
          </p>
        }
      >
        <ScrollTable label="Booking software pricing compared" minWidth="64rem">
          <table className="w-full border-collapse text-left">
            <caption className="px-4 pt-4 pb-2 text-left text-sm text-muted">
              Pricing for EZRA Pro and eleven tour and activity booking systems. Last checked {checked}.
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>System</th>
                <th scope="col" className={TH}>Monthly</th>
                <th scope="col" className={TH}>Fee on online bookings</th>
                <th scope="col" className={TH}>Who pays the fee</th>
                <th scope="col" className={TH}>Card processing</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key} className={cn('border-b border-line-subtle last:border-b-0', row.ours && 'bg-cal-haze')}>
                  <RowHead row={row} facts={[row.monthly, row.fee, row.whoPays, row.processing]} />
                  <td className={TD}><FactBrief fact={row.monthly} /></td>
                  <td className={TD}><FactBrief fact={row.fee} /></td>
                  <td className={TD}><FactBrief fact={row.whoPays} /></td>
                  <td className={TD}><FactBrief fact={row.processing} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <ScrollHint />
      </Section>

      {/* ---------- feature matrix ---------- */}
      <Section
        id="features"
        eyebrow="Features"
        title="The day-of features that differ"
        intro={
          <p>
            Online booking, payments, promo codes and OTA connections are standard, so they’re left out. These are the features where the
            systems actually differ. “Not shown” means not on the vendor’s own pages on {checked}, not that it’s missing.
          </p>
        }
      >
        <div className="mb-5">
          <ToneLegend />
        </div>
        <ScrollTable label="Booking software features compared" minWidth="70rem">
          <table className="w-full border-collapse text-left">
            <caption className="px-4 pt-4 pb-2 text-left text-sm text-muted">
              Features shown on each vendor’s own pages, and EZRA Pro’s. Last checked {checked}.
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>System</th>
                {MATRIX_COLUMNS.map((col) => (
                  <th key={col.key} scope="col" className={TH}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr key={row.key} className={cn('border-b border-line-subtle last:border-b-0', row.ours && 'bg-cal-haze')}>
                  <RowHead row={row} facts={MATRIX_COLUMNS.map((col) => row.matrix[col.key])} />
                  {MATRIX_COLUMNS.map((col) => {
                    const cell = row.matrix[col.key]
                    return (
                      <td key={col.key} className={TD}>
                        <span className="flex gap-2">
                          <ToneMark tone={cell.tone} />
                          <FactBrief fact={cell} />
                        </span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollTable>
        <ScrollHint />
        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted">
          On EZRA Pro, gift cards, promotions, dynamic pricing and multi-location are on the Scale plan, per our pricing page. Waivers are
          included from Starter.
        </p>
      </Section>

      {/* ---------- calculator ---------- */}
      <Section
        id="calculator"
        tone="cloud"
        eyebrow="Cost calculator"
        title="What would you pay each month?"
        intro={
          <p>
            Enter a month of online bookings. We add each plan’s subscription to its percentage, using published rates or clearly labelled
            reported ones. It’s arithmetic on list prices, not a quote.
          </p>
        }
      >
        <CostCalculator rates={PLAN_RATES} defaultValue={10_000} checkedOn={checked} ezraNote={EZRA_CALC_NOTE} />
      </Section>

      {/* ---------- every page ---------- */}
      <Section id="pages" eyebrow="Go deeper" title="Every comparison">
        <h3 className="font-display text-[1.25rem] font-medium text-foreground">EZRA Pro against one system</h3>
        <div className="mt-5">
          <LinkCards
            links={VS_SLUGS.map((slug) => ({
              href: `/compare/${slug}`,
              label: VS_CONTENT[slug].h1,
              note: VENDORS[VS_CONTENT[slug].vendor].model.text,
            }))}
          />
        </div>
        <h3 className="mt-12 font-display text-[1.25rem] font-medium text-foreground">Alternatives lists</h3>
        <div className="mt-5">
          <LinkCards
            links={ALTERNATIVES_SLUGS.map((slug) => ({
              href: `/alternatives/${slug}`,
              label: `${VENDORS[slug].name} alternatives`,
              note: ALT_CONTENT[slug].h1,
            }))}
          />
        </div>
      </Section>

      {/* ---------- method ---------- */}
      <Section id="method" tone="subtle" eyebrow="Method" title="How we checked">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <p className="text-[0.9375rem] text-muted">
              Last checked <time dateTime={CHECKED_ON}>{checked}</time>.
            </p>
            <ul className="mt-4 list-disc space-y-2.5 pl-5 text-[0.9375rem] leading-[1.6] text-muted">
              {HUB.methodology.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-muted">
              Further reading on how booking fees are passed on: <SourceLink source={SOURCES.arival} prefix="" />
            </p>
          </div>
          <ReportError page="Compare tour and activity booking software" />
        </div>
      </Section>

      <ClosingCta />
    </>
  )
}
