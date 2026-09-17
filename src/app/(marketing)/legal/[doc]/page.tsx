import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { LEGAL_DOCUMENTS, LEGAL_KEYS, type LegalKey } from '@/components/marketing/legal/legal-content'
import { cn } from '@/lib/utils'

/* ==========================================================================
   /legal/[doc] — privacy, terms and security, one layout.

   A short header on the pale ground with the title, one sentence and the
   date, then the document: a table of contents that stays put on the left
   and the sections on the right, set for reading. A server component; there
   is nothing here that needs to move.
   ========================================================================== */

function resolve(slug: string): LegalKey | null {
  return (LEGAL_KEYS as string[]).includes(slug) ? (slug as LegalKey) : null
}

export function generateStaticParams() {
  return LEGAL_KEYS.map((doc) => ({ doc }))
}

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params
  const key = resolve(doc)
  if (!key) return { title: 'Not found' }
  const document = LEGAL_DOCUMENTS[key]
  return {
    title: document.title,
    description: document.summary,
    alternates: { canonical: `/legal/${key}` },
  }
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params
  const key = resolve(doc)
  if (!key) notFound()
  const document = LEGAL_DOCUMENTS[key]
  const siblings = LEGAL_KEYS.filter((k) => k !== key)

  return (
    <>
      <section className="bg-cal-rain pt-8 pb-12 sm:pt-10 sm:pb-14">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-[0.9375rem] text-muted sm:text-base">
              <li>
                <Link href="/" className="rounded transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-muted">Legal</li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold text-foreground">
                {document.title}
              </li>
            </ol>
          </nav>

          <div className="mt-8 max-w-3xl">
            <h1 className="font-display text-[2.5rem] leading-[1.06] font-medium tracking-[-0.035em] text-balance text-foreground sm:text-[3.25rem] lg:text-[3.75rem]">
              {document.title}
            </h1>
            <p className="mt-5 text-[1.125rem] leading-[1.45] text-pretty text-muted sm:text-[1.25rem]">{document.summary}</p>
            <p className="mt-5 text-[0.9375rem] text-subtle">Last updated {document.updated}</p>
          </div>
        </div>
      </section>

      <section className="bg-background py-14 sm:py-16 lg:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          {/* ---------- contents ---------- */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <nav aria-label="On this page" className="lg:sticky lg:top-32">
              <p className="text-[0.75rem] font-medium tracking-[0.08em] text-primary uppercase">On this page</p>
              <ol className="mt-4 flex flex-col gap-1 border-l border-line">
                {document.sections.map((section, i) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="-ml-px flex items-baseline gap-3 border-l border-transparent py-1.5 pl-4 text-[0.9375rem] text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <span className="font-mono text-[0.75rem] text-faint tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                      {section.heading}
                    </a>
                  </li>
                ))}
              </ol>

              <div className="mt-10 rounded-2xl bg-background-subtle p-5">
                <p className="text-[0.75rem] font-medium tracking-[0.08em] text-subtle uppercase">Also</p>
                <ul className="mt-3 flex flex-col gap-2">
                  {siblings.map((k) => (
                    <li key={k}>
                      <Link href={`/legal/${k}`} className="text-[0.9375rem] font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                        {LEGAL_DOCUMENTS[k].title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          </aside>

          {/* ---------- the document ---------- */}
          <article className="min-w-0 lg:col-span-8 xl:col-span-8">
            {document.sections.map((section, i) => (
              <section key={section.id} id={section.id} className={cn('scroll-mt-32', i > 0 && 'mt-12 border-t border-line pt-12')}>
                <h2 className="font-display text-[1.5rem] leading-[1.2] font-medium tracking-[-0.02em] text-foreground sm:text-[1.75rem]">
                  <span className="mr-3 font-mono text-[0.875rem] text-faint tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  {section.heading}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 40)} className="mt-5 max-w-[68ch] text-[1.0625rem] leading-[1.65] text-muted">
                    {paragraph}
                  </p>
                ))}
                {section.bullets ? (
                  <ul className="mt-5 flex max-w-[68ch] flex-col gap-3">
                    {section.bullets.map((bullet) => (
                      <li key={bullet.slice(0, 40)} className="flex items-start gap-3 text-[1.0625rem] leading-[1.6] text-muted">
                        <span className="mt-[0.7rem] size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </article>
        </div>
      </section>
    </>
  )
}
