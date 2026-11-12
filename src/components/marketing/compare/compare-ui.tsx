import type { ReactNode } from 'react'
import Link from 'next/link'
import { ArrowRight, ArrowUpRight, Check, Minus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  CHECKED_ON,
  ERROR_REPORT_EMAIL,
  EZRA_PLAN,
  ROWS,
  VENDORS,
  formatCheckedDate,
  type Cell,
  type Fact,
  type RowKey,
  type Source,
  type VsSlug,
} from '@/lib/data/competitors'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Shared pieces for /compare and /compare/[competitor].

   Short pages: a centred headline on the rain ground, a comparison card that
   overlaps it, then a few plain sections and a numbered Sources list. EZRA
   Pro's column is the lavender one everywhere. Server components only.
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

/** Headline band. The comparison card that follows pulls up over its bottom edge. */
export function CompareHero({ crumbs, title, subhead }: { crumbs: Crumb[]; title: string; subhead: string }) {
  return (
    <header className="bg-cal-rain pt-8 pb-32 sm:pt-10 sm:pb-40">
      <div className={WRAP}>
        <Breadcrumbs items={crumbs} />
        <div className="mx-auto mt-12 max-w-3xl text-center sm:mt-16">
          <h1 className="font-display text-[length:clamp(2.25rem,1.35rem_+_3.4vw,3.875rem)] leading-[1.04] font-medium tracking-[-0.035em] text-balance text-foreground">
            {title}
          </h1>
          <p className="mx-auto mt-5 max-w-[46ch] text-[1.125rem] leading-[1.5] text-pretty text-muted sm:text-[1.3125rem]">{subhead}</p>
          <p className="mt-5 text-sm text-muted">
            Last checked <time dateTime={CHECKED_ON}>{formatCheckedDate()}</time>
          </p>
        </div>
      </div>
    </header>
  )
}

/* --------------------------------------------------------------- Sections */

export function Section({ id, title, children, className }: { id: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn('scroll-mt-32', className)}>
      <h2 id={`${id}-title`} className="font-display text-[1.75rem] leading-[1.15] font-medium tracking-[-0.03em] text-balance text-foreground sm:text-[2.25rem]">
        {title}
      </h2>
      <div className="mt-6 sm:mt-8">{children}</div>
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

export type Notes = ReturnType<typeof createNotes>

/**
 * Footnote numbers and "Reported" badges are not shown (the owner wants a
 * clean table). Sources stay listed at the end of each page, and the note
 * under the table says which figures are third-party estimates.
 */
export function Ref(_props: { n: number }) {
  return null
}

export function ReportedBadge() {
  return null
}

/* ------------------------------------------------------- Comparison card */

export interface Column {
  key: string
  name: string
  ours?: boolean
  /** Each row's cell, with its footnote number (none for EZRA Pro's own cells). */
  cells: Record<RowKey, { cell: Cell; n?: number }>
}

/** A column's cells with footnotes, numbered row by row in reading order. */
export function buildColumns(notes: Notes, columns: { key: string; name: string; ours?: boolean; cells: Record<RowKey, Cell> }[]): Column[] {
  const out: Column[] = columns.map((c) => ({ ...c, cells: {} as Column['cells'] }))
  for (const row of ROWS) {
    columns.forEach((c, i) => {
      const cell = c.cells[row.key]
      out[i].cells[row.key] = { cell, n: c.ours ? undefined : notes.fact(cell) }
    })
  }
  return out
}

function CellValue({ cell, n }: { cell: Cell; n?: number }) {
  const icon =
    cell.tone === 'yes' ? (
      <Check aria-hidden="true" strokeWidth={2.5} className="mt-[0.2em] size-4 shrink-0 text-success" />
    ) : cell.tone === 'partly' ? (
      <Check aria-hidden="true" strokeWidth={2.5} className="mt-[0.2em] size-4 shrink-0 text-subtle" />
    ) : cell.tone === 'no' ? (
      <Minus aria-hidden="true" strokeWidth={2.5} className="mt-[0.2em] size-4 shrink-0 text-subtle" />
    ) : null
  return (
    <span className="flex items-start gap-2">
      {icon}
      <span className={cn(cell.tone === 'value' ? 'font-medium text-foreground' : cell.tone === 'no' ? 'text-muted' : 'text-foreground')}>
        {cell.text}
      </span>
    </span>
  )
}

/** Each vendor keeps one pastel across the cards and the table. */
const VENDOR_TONE: Record<string, string> = {
  fareharbor: 'bg-cal-seafoam',
  'peek-pro': 'bg-cal-sunbeam',
  bokun: 'bg-cal-honeydew',
}

function ColumnHead({ column, inline = false }: { column: Column; inline?: boolean }) {
  return (
    <span className={cn('flex gap-2.5', inline ? 'items-center' : 'flex-col items-start sm:flex-row sm:items-center')}>
      <Monogram name={column.name} ours={column.ours} className={cn('size-9 rounded-[0.625rem] text-[0.9375rem]', VENDOR_TONE[column.key])} />
      <span className="text-[0.9375rem] font-medium text-foreground sm:text-[1.0625rem]">{column.name}</span>
    </span>
  )
}

/**
 * Rows of facts, systems across. The EZRA Pro column is lavender. With
 * `stackOnPhones`, a wide table turns into one card per system below md so
 * nothing scrolls sideways; a two-system table stays a table at every width.
 */
export function ComparisonCard({ caption, columns, stackOnPhones = false }: { caption: string; columns: Column[]; stackOnPhones?: boolean }) {
  const last = ROWS.length - 1
  return (
    <div className="rounded-[1.5rem] bg-surface p-2 shadow-[var(--shadow-md)] ring-1 ring-black/[0.06] sm:p-3">
      <table className={cn('w-full table-fixed border-separate border-spacing-0 text-left text-[0.875rem] leading-[1.45] sm:text-[0.9375rem]', stackOnPhones && 'hidden md:table')}>
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className={stackOnPhones ? 'w-[22%]' : 'w-[30%] sm:w-[28%]'} />
          {columns.map((c) => (
            <col key={c.key} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="px-2.5 py-4 align-bottom text-xs font-medium text-subtle sm:px-4">
              <span className="sr-only">Compared on</span>
            </th>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn('px-2.5 pt-4 pb-4 align-bottom font-normal sm:px-4 sm:pt-5', c.ours && 'rounded-t-[1rem] bg-cal-lavender')}>
                <ColumnHead column={c} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, r) => (
            <tr key={row.key}>
              <th scope="row" className="border-t border-line-subtle px-2.5 py-4 align-top font-normal text-muted sm:px-4">
                {row.label}
              </th>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    'border-t px-2.5 py-4 align-top sm:px-4',
                    c.ours ? 'border-foreground/[0.07] bg-cal-lavender' : 'border-line-subtle',
                    c.ours && r === last && 'rounded-b-[1rem]',
                  )}
                >
                  <CellValue {...c.cells[row.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {stackOnPhones ? (
        <ul className="space-y-2 md:hidden" aria-label={caption}>
          {columns.map((c) => (
            <li key={c.key} className={cn('rounded-[1.125rem] p-4', c.ours ? 'bg-cal-lavender' : 'bg-background-subtle/60')}>
              <h3>
                <ColumnHead column={c} inline />
              </h3>
              <dl className="mt-3 divide-y divide-foreground/[0.07] text-[0.9375rem] leading-[1.45]">
                {ROWS.map((row) => (
                  <div key={row.key} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3 py-2.5">
                    <dt className="text-muted">{row.label}</dt>
                    <dd>
                      <CellValue {...c.cells[row.key]} />
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** The key under a comparison card, plus an optional fair line. */
export function CardNote({ fair }: { fair?: string }) {
  return (
    <div className="mt-4 space-y-1.5 px-1 text-sm leading-relaxed text-muted">
      {fair ? <p className="font-medium text-foreground">{fair}</p> : null}
      <p>“Not shown” means we couldn’t find it on the vendor’s pages, not that it’s missing. FareHarbor and Peek Pro don’t publish their fees, so their figures are third-party estimates.</p>
    </div>
  )
}

/* ---------------------------------------------------------------- Verdict */

export function Verdict({ them, us }: { them: { name: string; items: string[] }; us: string[] }) {
  const sides = [
    { heading: 'Choose EZRA Pro if', items: us, tone: 'bg-cal-lavender' },
    { heading: `Choose ${them.name} if`, items: them.items, tone: 'bg-cal-linen' },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {sides.map((side) => (
        <div key={side.heading} className={cn('rounded-[1.25rem] p-6 sm:p-7', side.tone)}>
          <h3 className="font-display text-[1.25rem] font-medium tracking-[-0.02em] text-foreground">{side.heading}</h3>
          <ul className="mt-4 space-y-3">
            {side.items.map((item) => (
              <li key={item} className="flex gap-3 text-[1.0625rem] leading-[1.45] text-foreground">
                <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-foreground/50" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------------- FAQ */

export function FaqGrid({ items }: { items: { q: string; a: string; n?: number; reported?: boolean }[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((faq) => (
        <div key={faq.q} className="rounded-[1.25rem] bg-surface p-6 ring-1 ring-black/[0.06]">
          <h3 className="text-[1.0625rem] leading-[1.35] font-medium text-foreground">{faq.q}</h3>
          <p className="mt-2 text-[0.9375rem] leading-[1.55] text-muted">
            {faq.a}
            <span className="whitespace-nowrap">
              {faq.reported ? <ReportedBadge /> : null}
              {faq.n ? <Ref n={faq.n} /> : null}
            </span>
          </p>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------- vs cards */

/** One card per vs page. The whole card is the link; its text starts with "EZRA Pro vs …". */
export function VsCards({ slugs, headingLevel = 'h3' }: { slugs: readonly VsSlug[]; headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {slugs.map((slug) => {
        const vendor = VENDORS[slug]
        return (
          <li key={slug}>
            <Link
              href={`/compare/${slug}`}
              className={cn(
                'group flex h-full flex-col rounded-[1.25rem] p-6 transition-shadow hover:shadow-[var(--shadow-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                VENDOR_TONE[slug],
              )}
            >
              <span aria-hidden="true" className="flex items-center gap-2">
                <Monogram name="EZRA Pro" ours className="size-10 rounded-[0.75rem] text-base" />
                <span className="text-sm text-foreground/60">vs</span>
                <Monogram name={vendor.name} className="size-10 rounded-[0.75rem] bg-surface text-base" />
              </span>
              <Heading className="mt-6 font-display text-[1.25rem] leading-[1.2] font-medium tracking-[-0.02em] text-foreground">EZRA Pro vs {vendor.name}</Heading>
              <span className="mt-1.5 text-[0.9375rem] leading-[1.45] text-foreground/75">{vendor.hook}</span>
              <span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-medium text-foreground">
                Read the comparison
                <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/* -------------------------------------------------------------------- CTA */

export function CompareCta() {
  return (
    <section aria-labelledby="compare-cta-title" className="rounded-[1.75rem] bg-cal-lavender px-6 py-10 text-center sm:px-10 sm:py-14">
      <h2 id="compare-cta-title" className="font-display text-[2rem] leading-[1.1] font-medium tracking-[-0.035em] text-balance text-foreground sm:text-[2.75rem]">
        {EZRA_PLAN.percent}% per booking. ${EZRA_PLAN.monthly} a month.
      </h2>
      <p className="mx-auto mt-3 max-w-[40ch] text-[1.0625rem] text-muted">No setup fee, no contract. You choose who pays.</p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Button asChild variant="ink" size="lg" className="rounded-[10px] px-6" rightIcon={<ArrowRight aria-hidden="true" />}>
          <Link href="/signup">Start free</Link>
        </Button>
        <Button asChild variant="secondary" size="lg" className="rounded-[10px] px-6">
          <Link href="/pricing">See EZRA Pro pricing</Link>
        </Button>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- Sources */

function isExternal(url: string) {
  return /^https?:\/\//.test(url)
}

function SourceAnchor({ source }: { source: Source }) {
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
export function SourcesList({ notes, page }: { notes: NoteEntry[]; page: string }) {
  const subject = encodeURIComponent(`Correction: ${page}`)
  return (
    <section id="sources" aria-labelledby="sources-title" className="scroll-mt-32 border-t border-line pt-8">
      <h2 id="sources-title" className="text-base font-medium text-foreground">
        Sources
      </h2>
      <ol className="mt-4 grid gap-x-8 gap-y-2 text-sm text-muted sm:grid-cols-2">
        {notes.map((entry, index) => (
          <li key={entry.source.url} id={`source-${index + 1}`} className="flex scroll-mt-32 gap-2.5">
            <span className="w-5 shrink-0 text-right tabular-nums text-subtle">{index + 1}.</span>
            <span>
              <SourceAnchor source={entry.source} />
              {entry.reported ? <ReportedBadge /> : null}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-6 text-sm text-muted">
        Read on <time dateTime={CHECKED_ON}>{formatCheckedDate()}</time>. List prices in US dollars. Spotted something out of date?{' '}
        <a href={`mailto:${ERROR_REPORT_EMAIL}?subject=${subject}`} className="font-medium text-foreground underline underline-offset-4 hover:text-primary">
          Tell us
        </a>
        .
      </p>
    </section>
  )
}

/* ---------------------------------------------------------------- Visuals */

const TILE_TONES = ['bg-cal-lavender', 'bg-cal-seafoam', 'bg-cal-sunbeam', 'bg-cal-sky', 'bg-cal-peach', 'bg-cal-honeydew', 'bg-cal-lilac']

/** A plain lettermark tile: no vendor logos, just the first letters on a pastel square. */
export function Monogram({ name, index = 0, ours = false, className }: { name: string; index?: number; ours?: boolean; className?: string }) {
  const letters = name.replace(/[^A-Za-zÀ-ž ]/g, '').split(' ').filter(Boolean)
  const capitals = name.replace(/[^A-Z]/g, '')
  const raw = ours ? 'EZ' : letters.length > 1 ? `${letters[0][0]}${letters[1][0]}` : capitals.length > 1 ? capitals.slice(0, 2) : name.slice(0, 2)
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
