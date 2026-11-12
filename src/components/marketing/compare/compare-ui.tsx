import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight } from 'lucide-react'

import { PHOTOS, photoUrl } from '@/components/marketing/story/photos'
import type { PhotoKey } from '@/components/marketing/compare/compare-content'
import { TocNav, type TocItem } from '@/components/marketing/compare/toc'
import { CHECKED_ON, ERROR_REPORT_EMAIL, formatCheckedDate, type Fact, type Source } from '@/lib/data/competitors'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Shared pieces for /compare and /alternatives.

   An editorial article: a pastel hero with a photo, a sticky contents list
   on desktop (a jump menu on phones), a narrow reading column, and a
   numbered Sources list at the end. Facts carry a small footnote number
   that leads to their source; third-party figures carry a "Reported" badge.
   Server components only, except the contents list.
   ========================================================================== */

export const WRAP = 'mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8'

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
      <ol className="flex flex-wrap items-center gap-2 text-sm text-muted">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {item.href ? (
              <Link href={item.href} className="rounded transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground">
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

export function ArticleHero({ crumbs, title, lede, photo }: { crumbs: Crumb[]; title: string; lede: string; photo: PhotoKey }) {
  const image = PHOTOS[photo]
  return (
    <header>
      <div className="bg-cal-rain pt-8 pb-28 sm:pt-10 sm:pb-40">
        <div className={WRAP}>
          <Breadcrumbs items={crumbs} />
          <h1 className="mt-10 max-w-3xl font-display text-[2.375rem] leading-[1.06] font-medium tracking-[-0.035em] text-balance text-foreground sm:mt-12 sm:text-[3.5rem]">
            {title}
          </h1>
          <p className="mt-5 max-w-[56ch] text-[1.125rem] leading-[1.55] text-pretty text-muted sm:text-[1.25rem]">{lede}</p>
          <p className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span>
              Last checked <time dateTime={CHECKED_ON}>{formatCheckedDate()}</time>
            </span>
            <span aria-hidden="true">·</span>
            <span>By the EZRA Pro team</span>
          </p>
        </div>
      </div>
      <div className={cn(WRAP, '-mt-20 sm:-mt-28')}>
        <div className="relative aspect-[16/10] overflow-hidden rounded-[1.5rem] bg-cal-cloud shadow-[var(--shadow-md)] sm:aspect-[21/9] sm:rounded-[1.75rem]">
          <Image
            src={photoUrl(image, 1800)}
            alt={image.alt}
            fill
            priority
            sizes="(min-width: 1024px) 60rem, 100vw"
            className="object-cover"
            style={{ objectPosition: image.focus }}
          />
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------------- Article layout */

/** A sticky contents list on desktop, a jump menu on phones, and the reading column. */
export function ArticleBody({ toc, children }: { toc: TocItem[]; children: ReactNode }) {
  return (
    <div className={cn(WRAP, 'py-12 sm:py-16')}>
      <div className="lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-14">
        <aside className="hidden lg:block lg:self-start lg:sticky lg:top-32">
          <TocNav items={toc} variant="aside" />
        </aside>
        <div className="min-w-0">
          <div className="mb-10 lg:hidden">
            <TocNav items={toc} variant="mobile" />
          </div>
          <div className="max-w-[44rem] space-y-16 sm:space-y-20">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function Block({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-32">
      <h2 id={`${id}-title`} className="font-display text-[1.75rem] leading-[1.15] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.125rem]">
        {title}
      </h2>
      {intro ? <div className="mt-3 text-[1.0625rem] leading-[1.6] text-pretty text-muted">{intro}</div> : null}
      {children ? <div className="mt-7">{children}</div> : null}
    </section>
  )
}

/* ------------------------------------------------------------ Footnotes */

export interface NoteEntry {
  source: Source
  reported: boolean
}

/**
 * Numbers sources in the order they are cited. Call `ref` while building the
 * page (in the page function, top to bottom) and pass `list` to <SourcesList>.
 */
export function createNotes() {
  const list: NoteEntry[] = []
  const ref = (source: Source, reported = false) => {
    let index = list.findIndex((entry) => entry.source.url === source.url)
    if (index < 0) {
      list.push({ source, reported })
      index = list.length - 1
    } else if (reported) {
      list[index].reported = true
    }
    return index + 1
  }
  const fact = (f: Fact) => ref(f.source, f.status === 'reported')
  return { list, ref, fact }
}

export function Ref({ n }: { n: number }) {
  return (
    <sup className="relative -top-[0.5em] ml-px align-baseline text-xs leading-none">
      <a
        href={`#source-${n}`}
        aria-label={`Source ${n}`}
        className="rounded px-0.5 text-subtle no-underline transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
      >
        {n}
      </a>
    </sup>
  )
}

export function ReportedBadge() {
  return (
    <span
      title="From a third party, not the vendor. Confirm with the vendor."
      className="ml-1.5 inline-flex translate-y-[-1px] items-center rounded-full bg-cal-sunbeam px-2 py-px align-middle text-xs font-medium text-foreground ring-1 ring-cal-peach"
    >
      Reported
      <span className="sr-only"> (a third-party figure, not published by the vendor)</span>
    </span>
  )
}

/** A fact's text, its badge when reported, and its footnote. */
export function FactInline({ fact, n }: { fact: Fact; n: number }) {
  return (
    <>
      {fact.text}
      {fact.status === 'reported' ? <ReportedBadge /> : null}
      <Ref n={n} />
    </>
  )
}

/* ------------------------------------------------------------ At a glance */

export interface GlanceRow {
  key: string
  name: string
  href?: string
  ours?: boolean
  note?: string
  pricing: ReactNode
  whoPays: ReactNode
  bestFor: string
}

const CELL = 'block md:table-cell md:px-5 md:py-4 md:align-top'
const LABEL = 'mb-0.5 block text-xs font-medium tracking-[0.04em] text-subtle uppercase md:hidden'

/** Three plain columns. On phones each row becomes a small stacked card, so nothing scrolls sideways. */
export function GlanceTable({ caption, rows }: { caption: string; rows: GlanceRow[] }) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] bg-surface ring-1 ring-black/[0.06]">
      <table className="block w-full text-left text-[0.9375rem] leading-[1.5] md:table">
        <caption className="sr-only">{caption}</caption>
        <thead className="hidden md:table-header-group">
          <tr className="border-b border-line">
            {['System', 'Pricing', 'Who pays', 'Best for'].map((label) => (
              <th key={label} scope="col" className="px-5 py-3 text-left text-xs font-semibold tracking-[0.06em] text-subtle uppercase">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {rows.map((row) => (
            <tr key={row.key} className={cn('grid gap-3 border-b border-line-subtle px-5 py-5 last:border-b-0 md:table-row md:p-0', row.ours && 'bg-cal-haze')}>
              <th scope="row" className={cn(CELL, 'font-medium text-foreground md:w-[24%]')}>
                {row.href ? (
                  <Link href={row.href} className="underline decoration-line-strong underline-offset-4 hover:text-primary">
                    {row.name}
                  </Link>
                ) : (
                  row.name
                )}
                {row.ours ? <span className="ml-2 inline-flex rounded-full bg-foreground px-2 py-px align-middle text-xs font-medium text-background">Ours</span> : null}
                {row.note ? <span className="mt-0.5 block text-xs font-normal text-subtle">{row.note}</span> : null}
              </th>
              <td className={cn(CELL, 'text-foreground')}>
                <span className={LABEL}>Pricing</span>
                {row.pricing}
              </td>
              <td className={cn(CELL, 'text-foreground md:w-[22%]')}>
                <span className={LABEL}>Who pays</span>
                {row.whoPays}
              </td>
              <td className={cn(CELL, 'text-muted md:w-[26%]')}>
                <span className={LABEL}>Best for</span>
                {row.bestFor}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ---------------------------------------------------------------- Verdict */

export function Verdict({ them, us }: { them: { name: string; items: string[] }; us: string[] }) {
  const sides = [
    { heading: `Choose ${them.name} if`, items: them.items, tone: 'bg-cal-sunbeam' },
    { heading: 'Choose EZRA Pro if', items: us, tone: 'bg-cal-honeydew' },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sides.map((side) => (
        <div key={side.heading} className={cn('rounded-[1.25rem] p-6', side.tone)}>
          <h3 className="font-display text-[1.25rem] font-medium tracking-[-0.02em] text-foreground">{side.heading}</h3>
          <Bullets className="mt-4" items={side.items.map((text) => ({ text }))} />
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- Lists */

/** A quiet bullet: the site avoids tick-mark lists. */
export function Dot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn('mt-[0.6em] size-1.5 shrink-0 rounded-full bg-foreground/45', className)} />
}

export function Bullets({ items, className }: { items: { text: string; n?: number; reported?: boolean }[]; className?: string }) {
  return (
    <ul className={cn('space-y-2.5', className)}>
      {items.map((item) => (
        <li key={item.text} className="flex gap-3 text-[1rem] leading-[1.55] text-foreground">
          <Dot />
          <span>
            {item.text}
            {item.reported ? <ReportedBadge /> : null}
            {item.n ? <Ref n={item.n} /> : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Short titled points, one sentence each. */
export function Points({ items }: { items: { title: string; body: string }[] }) {
  return (
    <ul className="divide-y divide-line-subtle rounded-[1.25rem] bg-surface ring-1 ring-black/[0.06]">
      {items.map((item) => (
        <li key={item.title} className="px-6 py-5">
          <h3 className="font-medium text-foreground">{item.title}</h3>
          <p className="mt-1 text-[0.9375rem] leading-[1.55] text-muted">{item.body}</p>
        </li>
      ))}
    </ul>
  )
}

export function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={item} className="flex items-start gap-4 rounded-[1rem] bg-cal-cloud px-5 py-4">
          <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-surface text-sm font-medium text-foreground">
            {index + 1}
          </span>
          <span className="pt-0.5 text-[1rem] leading-[1.5] text-foreground">{item}</span>
        </li>
      ))}
    </ol>
  )
}

export function FaqList({ items }: { items: { q: string; a: string; n?: number; reported?: boolean }[] }) {
  return (
    <div className="divide-y divide-line-subtle border-y border-line-subtle">
      {items.map((faq) => (
        <div key={faq.q} className="py-5">
          <h3 className="font-medium text-[1.0625rem] text-foreground">{faq.q}</h3>
          <p className="mt-1.5 text-[0.9375rem] leading-[1.6] text-muted">
            {faq.a}
            {faq.reported ? <ReportedBadge /> : null}
            {faq.n ? <Ref n={faq.n} /> : null}
          </p>
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- Sources */

function isExternal(url: string) {
  return /^https?:\/\//.test(url)
}

export function SourceAnchor({ source }: { source: Source }) {
  const className = 'underline decoration-line-strong underline-offset-2 transition-colors hover:text-foreground'
  return isExternal(source.url) ? (
    <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className={cn(className, 'inline-flex items-center gap-0.5')}>
      {source.label}
      <ArrowUpRight aria-hidden="true" className="size-3" />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  ) : (
    <Link href={source.url} className={className}>
      {source.label}
    </Link>
  )
}

/** The numbered list every footnote points at, plus how to report an error. */
export function SourcesList({ notes, page, extra }: { notes: NoteEntry[]; page: string; extra?: ReactNode }) {
  const subject = encodeURIComponent(`Correction: ${page}`)
  return (
    <section id="sources" aria-labelledby="sources-title" className="scroll-mt-32 border-t border-line pt-10">
      <h2 id="sources-title" className="font-display text-[1.375rem] font-medium tracking-[-0.02em] text-foreground">
        Sources
      </h2>
      <p className="mt-2 text-sm text-muted">
        Read on <time dateTime={CHECKED_ON}>{formatCheckedDate()}</time>. “Reported” marks a third-party figure the vendor doesn’t publish. “Not shown” means
        we couldn’t find it on the vendor’s pages, not that it’s missing.
      </p>
      <ol className="mt-5 space-y-2 text-sm text-muted">
        {notes.map((entry, index) => (
          <li key={entry.source.url} id={`source-${index + 1}`} className="flex scroll-mt-32 gap-3">
            <span className="w-5 shrink-0 text-right tabular-nums text-subtle">{index + 1}.</span>
            <span>
              <SourceAnchor source={entry.source} />
              {entry.reported ? <ReportedBadge /> : null}
            </span>
          </li>
        ))}
      </ol>
      {extra}
      <p className="mt-6 text-sm text-muted">
        Spotted something out of date, about anyone including us?{' '}
        <a href={`mailto:${ERROR_REPORT_EMAIL}?subject=${subject}`} className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
          Tell us
        </a>{' '}
        and we’ll fix it and update the date.
      </p>
    </section>
  )
}

/* ------------------------------------------------------------------ Links */

export function LinkCards({ links }: { links: { href: string; label: string; note?: string }[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="group flex h-full items-start justify-between gap-4 rounded-[1rem] bg-surface p-5 ring-1 ring-black/[0.06] transition-shadow hover:shadow-[var(--shadow-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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

/* ---------------------------------------------------------------- Visuals */

const TILE_TONES = ['bg-cal-lavender', 'bg-cal-seafoam', 'bg-cal-sunbeam', 'bg-cal-sky', 'bg-cal-peach', 'bg-cal-honeydew', 'bg-cal-lilac']

/** A plain lettermark tile: no vendor logos, just the first letters on a pastel square. */
export function Monogram({ name, index = 0, ours = false, className }: { name: string; index?: number; ours?: boolean; className?: string }) {
  const letters = name.replace(/[^A-Za-zÀ-ž ]/g, '').split(' ').filter(Boolean)
  const raw = ours ? 'EZ' : letters.length > 1 ? `${letters[0][0]}${letters[1][0]}` : name.slice(0, 2)
  const mark = raw.charAt(0).toUpperCase() + raw.slice(1)
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-14 shrink-0 place-items-center rounded-[1rem] font-display text-[1.25rem] font-medium tracking-[-0.02em]',
        ours ? 'bg-foreground text-background' : cn(TILE_TONES[index % TILE_TONES.length], 'text-foreground'),
        className,
      )}
    >
      {mark}
    </span>
  )
}
