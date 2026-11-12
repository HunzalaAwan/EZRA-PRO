import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check, CircleDashed, Minus } from 'lucide-react'

import {
  CHECKED_ON,
  ERROR_REPORT_EMAIL,
  formatCheckedDate,
  type CellTone,
  type Fact,
  type Source,
} from '@/lib/data/competitors'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Shared pieces for /compare and /alternatives.

   Server components only: static text, no motion, so the pages render as
   plain HTML. Every competitor fact is shown with its source, and anything
   that comes from a third party carries a visible "Reported" badge.
   ========================================================================== */

export const WRAP = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'

/* ---------------------------------------------------------------- JSON-LD */

export function JsonLd({ data }: { data: unknown }) {
  // `<` is escaped so a string can never close the script element.
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
}

/* ------------------------------------------------------------ Breadcrumbs */

export interface Crumb {
  label: string
  href?: string
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-2 text-[0.9375rem] text-muted">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link
                href={item.href}
                className="rounded transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-semibold text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/* ------------------------------------------------------------------- Hero */

export function CompareHero({
  crumbs,
  title,
  lede,
  children,
}: {
  crumbs: Crumb[]
  title: string
  lede: string
  children?: ReactNode
}) {
  return (
    <section className="bg-cal-rain pt-8 pb-12 sm:pt-10 sm:pb-16">
      <div className={WRAP}>
        <Breadcrumbs items={crumbs} />
        <div className="mt-10 max-w-3xl sm:mt-12">
          <h1 className="font-display text-[2.5rem] leading-[1.05] font-medium tracking-[-0.035em] text-balance text-foreground sm:text-[3.5rem]">
            {title}
          </h1>
          <p className="mt-6 max-w-[62ch] text-[1.125rem] leading-[1.55] text-pretty text-muted">{lede}</p>
          <CheckedLine className="mt-6" />
          {children}
        </div>
      </div>
    </section>
  )
}

export function CheckedLine({ className }: { className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted', className)}>
      <span>
        Last checked <time dateTime={CHECKED_ON}>{formatCheckedDate()}</time>
      </span>
      <span aria-hidden="true">·</span>
      <span>Sources linked beside each fact</span>
      <span aria-hidden="true">·</span>
      <span>Written by the EZRA Pro team</span>
    </p>
  )
}

/* ---------------------------------------------------------------- Section */

export function Section({
  id,
  eyebrow,
  title,
  intro,
  tone = 'plain',
  children,
}: {
  id: string
  eyebrow?: string
  title: string
  intro?: ReactNode
  tone?: 'plain' | 'subtle' | 'cloud'
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn(
        'scroll-mt-28 py-16 sm:py-20',
        tone === 'plain' && 'bg-background',
        tone === 'subtle' && 'bg-background-subtle',
        tone === 'cloud' && 'bg-cal-cloud',
      )}
    >
      <div className={WRAP}>
        <div className="max-w-3xl">
          {eyebrow ? <p className="text-xs font-medium tracking-[0.08em] text-primary uppercase">{eyebrow}</p> : null}
          <h2
            id={`${id}-title`}
            className={cn(
              'font-display text-[1.875rem] leading-[1.12] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.375rem]',
              eyebrow && 'mt-3',
            )}
          >
            {title}
          </h2>
          {intro ? <div className="mt-4 text-[1.0625rem] leading-[1.6] text-pretty text-muted">{intro}</div> : null}
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------- Facts, sources */

function isExternal(url: string) {
  return /^https?:\/\//.test(url)
}

export function SourceLink({ source, prefix = 'Source:' }: { source: Source; prefix?: string }) {
  const className =
    'inline-flex items-center gap-0.5 rounded text-xs text-subtle underline decoration-line-strong underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'
  return (
    <span className="text-xs text-subtle">
      {prefix ? `${prefix} ` : null}
      {isExternal(source.url) ? (
        <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className={className}>
          {source.label}
          <ArrowUpRight aria-hidden="true" className="size-3" />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : (
        <Link href={source.url} className={className}>
          {source.label}
        </Link>
      )}
    </span>
  )
}

export function ReportedBadge() {
  return (
    <span
      title="From a third party, not the vendor. Confirm with the vendor."
      className="inline-flex items-center rounded-full bg-cal-sunbeam px-2 py-0.5 text-xs font-medium text-foreground ring-1 ring-cal-peach"
    >
      Reported
      <span className="sr-only"> (a third-party figure, not published by the vendor)</span>
    </span>
  )
}

/** A fact with its badge and source underneath. */
export function FactBlock({ fact, className }: { fact: Fact; className?: string }) {
  return (
    <div className={className}>
      <p className="leading-snug text-foreground">{fact.text}</p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        {fact.status === 'reported' ? <ReportedBadge /> : null}
        <SourceLink source={fact.source} />
      </p>
    </div>
  )
}

/** A fact's text and badge only, for dense tables whose sources sit in the row header. */
export function FactBrief({ fact }: { fact: Fact }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{fact.text}</span>
      {fact.status === 'reported' ? <ReportedBadge /> : null}
    </span>
  )
}

const TONE_ICON: Record<CellTone, { icon: typeof Check; className: string; label: string }> = {
  yes: { icon: Check, className: 'text-success', label: 'Yes' },
  limited: { icon: CircleDashed, className: 'text-cal-tangerine', label: 'Partly or on some plans' },
  'not-shown': { icon: Minus, className: 'text-faint', label: 'Not shown' },
}

export function ToneMark({ tone }: { tone: CellTone }) {
  const { icon: Icon, className, label } = TONE_ICON[tone]
  return (
    <span className="mt-0.5 shrink-0">
      <Icon aria-hidden="true" className={cn('size-4', className)} strokeWidth={2.5} />
      <span className="sr-only">{label}: </span>
    </span>
  )
}

export function ToneLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
      {(Object.keys(TONE_ICON) as CellTone[]).map((tone) => {
        const { icon: Icon, className, label } = TONE_ICON[tone]
        return (
          <li key={tone} className="inline-flex items-center gap-1.5">
            <Icon aria-hidden="true" className={cn('size-4', className)} strokeWidth={2.5} />
            {label}
          </li>
        )
      })}
      <li className="inline-flex items-center gap-1.5">
        <ReportedBadge /> third-party figure
      </li>
    </ul>
  )
}

/* ------------------------------------------------------------------ Table */

/** A table that scrolls sideways on small screens instead of squashing. */
export function ScrollTable({ label, children, minWidth = '44rem' }: { label: string; children: ReactNode; minWidth?: string }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="relative overflow-x-auto rounded-[1.25rem] bg-surface shadow-[var(--shadow-sm)] ring-1 ring-black/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div style={{ minWidth }}>{children}</div>
    </div>
  )
}

export const TH = 'px-4 py-3 text-left text-xs font-semibold tracking-[0.06em] text-subtle uppercase'
export const TD = 'px-4 py-4 align-top text-sm'

export function ScrollHint() {
  return <p className="mt-3 text-xs text-subtle md:hidden">Scroll the table sideways to see every column.</p>
}

/** A quiet bullet: the site avoids tick-mark lists. */
export function Dot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('mt-[0.6em] size-1.5 shrink-0 rounded-full bg-foreground/40', className)} />
}

/* ------------------------------------------------------------- Point grid */

export function PointGrid({ points, numbered = false }: { points: { title: string; body: string; source?: Source; reported?: boolean }[]; numbered?: boolean }) {
  const List = numbered ? 'ol' : 'ul'
  return (
    <List className={cn('grid gap-5 sm:grid-cols-2', points.length === 4 ? 'lg:grid-cols-2' : 'lg:grid-cols-3')}>
      {points.map((point, index) => (
        <li key={point.title} className="flex flex-col rounded-[1.25rem] bg-surface p-6 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04]">
          {numbered ? (
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-cal-lavender text-sm font-medium text-foreground">
              {index + 1}
            </span>
          ) : null}
          <h3 className={cn('font-display text-[1.1875rem] leading-[1.25] font-medium tracking-[-0.015em] text-foreground', numbered && 'mt-4')}>
            {point.title}
          </h3>
          <p className="mt-2.5 text-[0.9375rem] leading-[1.55] text-muted">{point.body}</p>
          {point.source ? (
            <p className="mt-auto flex flex-wrap items-center gap-2 pt-4">
              {point.reported ? <ReportedBadge /> : null}
              <SourceLink source={point.source} />
            </p>
          ) : null}
        </li>
      ))}
    </List>
  )
}

/* -------------------------------------------------------------------- FAQ */

export function FaqList({ faqs }: { faqs: { q: string; a: string; source?: Source; reported?: boolean }[] }) {
  return (
    <div className="divide-y divide-line rounded-[1.25rem] bg-surface px-6 shadow-[var(--shadow-sm)] ring-1 ring-black/[0.04] sm:px-8">
      {faqs.map((faq) => (
        <div key={faq.q} className="py-6">
          <h3 className="font-display text-[1.125rem] leading-[1.3] font-medium tracking-[-0.01em] text-foreground">{faq.q}</h3>
          <p className="mt-2.5 max-w-[68ch] text-[0.9375rem] leading-[1.6] text-muted">{faq.a}</p>
          {faq.source ? (
            <p className="mt-2.5 flex flex-wrap items-center gap-2">
              {faq.reported ? <ReportedBadge /> : null}
              <SourceLink source={faq.source} />
            </p>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------- Method and errors */

export function ReportError({ page }: { page: string }) {
  const subject = encodeURIComponent(`Correction: ${page}`)
  return (
    <div className="rounded-[1.25rem] bg-cal-sunbeam p-6 sm:p-7">
      <h3 className="font-display text-[1.125rem] font-medium text-foreground">Spotted something out of date?</h3>
      <p className="mt-2 max-w-[62ch] text-[0.9375rem] leading-[1.55] text-muted">
        Prices and features change. If anything here is wrong, including about EZRA Pro, tell us with a link to the source and we will
        check it and update the page and its date.
      </p>
      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[0.9375rem]">
        <a
          href={`mailto:${ERROR_REPORT_EMAIL}?subject=${subject}`}
          className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
        >
          Email {ERROR_REPORT_EMAIL}
        </a>
        <Link href="/contact" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
          Use the contact form
        </Link>
      </p>
    </div>
  )
}

export function MethodNote() {
  return (
    <p className="max-w-[68ch] text-[0.9375rem] leading-[1.6] text-muted">
      Facts about other companies come from their own pricing and features pages, read on{' '}
      <time dateTime={CHECKED_ON}>{formatCheckedDate()}</time>. Figures marked “Reported” come from third parties because the vendor
      doesn’t publish them. “Not shown” means we couldn’t find a feature on the vendor’s pages, not that it doesn’t exist. We make EZRA
      Pro. The full method is on the{' '}
      <Link href="/compare#method" className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
        comparison hub
      </Link>
      .
    </p>
  )
}

/* ------------------------------------------------------------------ Links */

export function LinkCards({ links }: { links: { href: string; label: string; note?: string }[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="group flex h-full items-start justify-between gap-4 rounded-[1rem] bg-surface p-5 shadow-[var(--shadow-xs)] ring-1 ring-black/[0.05] transition-shadow hover:shadow-[var(--shadow-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span>
              <span className="block font-medium text-foreground">{link.label}</span>
              {link.note ? <span className="mt-1 block text-sm leading-snug text-muted">{link.note}</span> : null}
            </span>
            <ArrowRight aria-hidden="true" className="mt-1 size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function OnThisPage({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav aria-label="On this page" className="mt-8">
      <ul className="flex flex-wrap gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="inline-flex rounded-full bg-surface px-3.5 py-1.5 text-sm text-foreground ring-1 ring-black/[0.06] transition-colors hover:bg-cal-cloud focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
