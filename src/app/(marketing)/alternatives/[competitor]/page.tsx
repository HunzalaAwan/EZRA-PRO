import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

import { ClosingCta } from '@/components/marketing/land/closing-cta'
import { ALT_CONTENT, VS_CONTENT, type AltEntry } from '@/components/marketing/compare/compare-content'
import {
  CompareHero,
  Dot,
  FactBlock,
  FactBrief,
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
  SourceLink,
  TD,
  TH,
} from '@/components/marketing/compare/compare-ui'
import { articleSchema, breadcrumbSchema, compareMetadata, ezraSoftwareSchema } from '@/components/marketing/compare/compare-schema'
import {
  ALTERNATIVES_SLUGS,
  SOURCES,
  VENDORS,
  VS_SLUGS,
  formatCheckedDate,
  type AlternativesSlug,
  type VsSlug,
} from '@/lib/data/competitors'
import { cn } from '@/lib/utils'

/* ==========================================================================
   /alternatives/[competitor] — the systems people consider instead of X.

   Grouped by how each one charges, never ranked. EZRA Pro sits in its own
   pricing group like the rest, with its drawbacks listed.
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

const entryName = (entry: AltEntry) => (entry.vendor === 'ezra' ? 'EZRA Pro' : VENDORS[entry.vendor].name)
const entryAnchor = (entry: AltEntry) => `alt-${entry.vendor}`

function vsLink(entry: AltEntry, current: AlternativesSlug) {
  if (entry.vendor === 'ezra') {
    const vs = current as string
    return (VS_SLUGS as readonly string[]).includes(vs)
      ? { href: `/compare/${vs}`, label: `EZRA Pro vs ${VENDORS[current].name}` }
      : { href: '/pricing', label: 'EZRA Pro pricing' }
  }
  return (VS_SLUGS as readonly string[]).includes(entry.vendor)
    ? { href: `/compare/${entry.vendor}`, label: `EZRA Pro vs ${VENDORS[entry.vendor].name}` }
    : null
}

export default async function AlternativesPage({ params }: { params: Promise<{ competitor: string }> }) {
  const { competitor } = await params
  const slug = resolve(competitor)
  if (!slug) notFound()

  const content = ALT_CONTENT[slug]
  const vendor = VENDORS[content.vendor]
  const path = `/alternatives/${slug}`
  const entries = content.groups.flatMap((group) => group.entries)
  const crumbLabel = `${vendor.name} alternatives`

  const related = [
    ...((VS_SLUGS as readonly string[]).includes(slug)
      ? [{ href: `/compare/${slug}`, label: `EZRA Pro vs ${vendor.name}`, note: VS_CONTENT[slug as VsSlug].description }]
      : []),
    ...ALTERNATIVES_SLUGS.filter((other) => other !== slug).map((other) => ({
      href: `/alternatives/${other}`,
      label: `${VENDORS[other].name} alternatives`,
    })),
    { href: '/compare', label: 'All comparisons', note: 'Eleven systems, the fee calculator and our method.' },
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

      <CompareHero
        crumbs={[{ label: 'Home', href: '/' }, { label: 'Compare', href: '/compare' }, { label: crumbLabel }]}
        title={content.h1}
        lede={content.lede}
      >
        <OnThisPage
          items={[
            { href: '#at-a-glance', label: 'At a glance' },
            ...content.groups.map((group, index) => ({ href: `#group-${index + 1}`, label: group.title })),
            { href: '#questions', label: 'Questions' },
          ]}
        />
      </CompareHero>

      {/* ---------- at a glance ---------- */}
      <Section
        id="at-a-glance"
        eyebrow="At a glance"
        title={`${entries.length} options, and who each suits`}
        intro={
          <ul className="space-y-1.5">
            {content.howWeChose.map((line) => (
              <li key={line} className="flex gap-2.5">
                <Dot />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        }
      >
        <ScrollTable label={`${vendor.name} alternatives at a glance`} minWidth="52rem">
          <table className="w-full border-collapse text-left">
            <caption className="px-4 pt-4 pb-2 text-left text-sm text-muted">
              {vendor.name} and its alternatives, in the order they appear below (not a ranking). Last checked {formatCheckedDate()}.
            </caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={TH}>System</th>
                <th scope="col" className={TH}>Best for</th>
                <th scope="col" className={TH}>Monthly</th>
                <th scope="col" className={TH}>Fee on online bookings</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line bg-background-subtle">
                <th scope="row" className={`${TD} font-medium text-foreground`}>
                  {vendor.name} <span className="font-normal text-muted">(for reference)</span>
                  <span className="mt-1.5 block"><SourceLink source={vendor.fee.source} /></span>
                </th>
                <td className={`${TD} text-muted`}>{vendor.suits}</td>
                <td className={TD}><FactBrief fact={vendor.monthly} /></td>
                <td className={TD}><FactBrief fact={vendor.fee} /></td>
              </tr>
              {entries.map((entry) => {
                const monthly = entry.pricing[0]
                const fee = entry.pricing[1]
                return (
                  <tr key={entry.vendor} className={cn('border-b border-line-subtle last:border-b-0', entry.vendor === 'ezra' && 'bg-cal-haze')}>
                    <th scope="row" className={`${TD} font-medium text-foreground`}>
                      <a href={`#${entryAnchor(entry)}`} className="underline decoration-line-strong underline-offset-4 hover:text-primary">
                        {entryName(entry)}
                      </a>
                      <span className="mt-1.5 block"><SourceLink source={fee.source} /></span>
                    </th>
                    <td className={`${TD} text-muted`}>{entry.bestFor}</td>
                    <td className={TD}><FactBrief fact={monthly} /></td>
                    <td className={TD}><FactBrief fact={fee} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </ScrollTable>
        <ScrollHint />
      </Section>

      {/* ---------- groups ---------- */}
      {content.groups.map((group, index) => (
        <Section
          key={group.title}
          id={`group-${index + 1}`}
          tone={index % 2 === 0 ? 'subtle' : 'plain'}
          eyebrow={`Group ${index + 1}`}
          title={group.title}
          intro={<p>{group.intro}</p>}
        >
          <div className="grid gap-6">
            {group.entries.map((entry) => {
              const link = vsLink(entry, slug)
              const ours = entry.vendor === 'ezra'
              return (
                <article
                  key={entry.vendor}
                  id={entryAnchor(entry)}
                  aria-labelledby={`${entryAnchor(entry)}-name`}
                  className={cn(
                    'scroll-mt-28 rounded-[1.5rem] bg-surface p-6 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04] sm:p-8',
                    ours && 'ring-2 ring-cal-iris',
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 id={`${entryAnchor(entry)}-name`} className="font-display text-[1.625rem] font-medium tracking-[-0.025em] text-foreground">
                      {entryName(entry)}
                    </h3>
                    {ours ? (
                      <span className="rounded-full bg-cal-lavender px-3 py-1 text-xs font-medium text-foreground">Our product</span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[1.0625rem] leading-[1.5] text-foreground">
                    <span className="font-medium">Best for: </span>
                    {entry.bestFor}
                  </p>

                  <div className="mt-6 grid gap-6 lg:grid-cols-3">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Why consider it</h4>
                      <ul className="mt-3 space-y-2.5 text-[0.9375rem] leading-[1.5] text-muted">
                        {entry.why.map((line) => (
                          <li key={line} className="flex gap-2.5">
                            <Dot />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Watch for</h4>
                      <ul className="mt-3 space-y-2.5 text-[0.9375rem] leading-[1.5] text-muted">
                        {entry.watch.map((line) => (
                          <li key={line} className="flex gap-2.5">
                            <Dot className="bg-cal-tangerine" />
                            <span>{line}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">Pricing</h4>
                      <dl className="mt-3 space-y-3.5 text-[0.9375rem]">
                        {entry.pricing.map((fact, i) => (
                          <div key={fact.text}>
                            <dt className="text-xs font-medium tracking-[0.04em] text-subtle uppercase">{['Monthly', 'Fee', 'Who pays'][i]}</dt>
                            <dd className="mt-1"><FactBlock fact={fact} /></dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </div>

                  {link ? (
                    <p className="mt-6">
                      <Link
                        href={link.href}
                        className="inline-flex items-center gap-1.5 text-[0.9375rem] font-medium text-foreground underline underline-offset-4 hover:text-primary"
                      >
                        {link.label}
                        <ArrowRight aria-hidden="true" className="size-4" />
                      </Link>
                    </p>
                  ) : null}
                </article>
              )
            })}
          </div>
        </Section>
      ))}

      {/* ---------- before you switch ---------- */}
      <Section id="before-you-switch" tone="cloud" eyebrow="Before you switch" title={`Three things to settle before leaving ${vendor.name}`}>
        <PointGrid points={content.beforeYouSwitch} numbered />
      </Section>

      {/* ---------- questions ---------- */}
      <Section id="questions" eyebrow="Questions" title={`${vendor.name} alternatives: common questions`}>
        <FaqList faqs={content.faqs} />
      </Section>

      {/* ---------- method ---------- */}
      <Section id="method" tone="subtle" eyebrow="How we checked" title="Sources, dates and corrections">
        <div className="grid gap-8 lg:grid-cols-2">
          <div>
            <MethodNote />
            <p className="mt-4 text-sm text-muted">
              Why fees matter here: the industry association Arival notes that a fee labelled as the guest’s lets a vendor call its software
              free, “but someone always pays.” <SourceLink source={SOURCES.arival} prefix="" />
            </p>
          </div>
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
