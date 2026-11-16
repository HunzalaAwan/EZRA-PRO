import Link from 'next/link'
import { Check, Quote } from 'lucide-react'

import { ColumnHead, CellValue, type Column } from '@/components/marketing/compare/compare-ui'
import { ROWS, type RowKey } from '@/lib/data/competitors'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Long-form pieces for the compare pages: the all-systems table on the hub,
   and the body sections on each vs page (short answer, why people switch,
   topic by topic, worked costs, moving over, a customer quote).
   Server components only.
   ========================================================================== */

/* ------------------------------------------------------------ Hub table */

/**
 * Every system on one table, systems down and a few key facts across, so
 * eight systems fit without sideways scrolling. Below lg, one card each.
 */
export function SystemsTable({ caption, columns, keys }: { caption: string; columns: Column[]; keys: RowKey[] }) {
  const rows = keys.map((key) => ROWS.find((row) => row.key === key)).filter((row): row is (typeof ROWS)[number] => Boolean(row))
  return (
    <div className="rounded-[1.5rem] bg-surface p-2 shadow-[var(--shadow-md)] ring-1 ring-black/[0.06] sm:p-3">
      <table className="hidden w-full table-fixed border-separate border-spacing-0 text-left text-[0.875rem] leading-[1.45] lg:table">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col className="w-[16%]" />
          {rows.map((row) => (
            <col key={row.key} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="px-3 py-4 text-left align-bottom text-[0.8125rem] font-medium text-muted">
              System
            </th>
            {rows.map((row) => (
              <th key={row.key} scope="col" className="px-3 py-4 text-left align-bottom text-[0.8125rem] font-medium text-muted">
                {row.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => (
            <tr key={c.key}>
              <th scope="row" className={cn('border-t px-3 py-3.5 align-middle font-normal', c.ours ? 'rounded-l-[1rem] border-transparent bg-cal-lavender' : 'border-line-subtle')}>
                <SystemName column={c} />
              </th>
              {rows.map((row, i) => (
                <td
                  key={row.key}
                  className={cn(
                    'border-t px-3 py-3.5 align-middle',
                    c.ours ? 'border-transparent bg-cal-lavender' : 'border-line-subtle',
                    c.ours && i === rows.length - 1 && 'rounded-r-[1rem]',
                  )}
                >
                  <CellValue {...c.cells[row.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="space-y-2 lg:hidden" aria-label={caption}>
        {columns.map((c) => (
          <li key={c.key} className={cn('rounded-[1.125rem] p-4', c.ours ? 'bg-cal-lavender' : 'bg-background-subtle/60')}>
            <h3>
              <SystemName column={c} />
            </h3>
            <dl className="mt-3 divide-y divide-foreground/[0.07] text-[0.9375rem] leading-[1.45]">
              {rows.map((row) => (
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
    </div>
  )
}

function SystemName({ column }: { column: Column }) {
  if (column.ours) return <ColumnHead column={column} inline />
  return (
    <Link
      href={`/compare/${column.key}`}
      className="inline-flex rounded-[0.75rem] decoration-line-strong underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <ColumnHead column={column} inline />
    </Link>
  )
}

/* ------------------------------------------------------------ Long-form */

/** Plain paragraphs at reading size. */
export function Prose({ paragraphs, className }: { paragraphs: string[]; className?: string }) {
  return (
    <div className={cn('max-w-[68ch] space-y-4 text-[1.0625rem] leading-[1.7] text-foreground/85', className)}>
      {paragraphs.map((text) => (
        <p key={text}>{text}</p>
      ))}
    </div>
  )
}

export interface TitledText {
  title: string
  body: string
}

/** Numbered reasons, one card each. */
export function ReasonCards({ items }: { items: TitledText[] }) {
  return (
    <ol className="grid gap-4 md:grid-cols-3">
      {items.map((item, index) => (
        <li key={item.title} className="flex flex-col rounded-[1.25rem] bg-cal-cloud p-6">
          <span aria-hidden="true" className="font-display text-[1.75rem] leading-none font-medium tracking-[-0.03em] text-foreground/35 tabular-nums">
            {String(index + 1).padStart(2, '0')}
          </span>
          <h3 className="mt-4 text-[1.125rem] leading-[1.35] font-medium text-foreground">{item.title}</h3>
          <p className="mt-2 text-[0.9375rem] leading-[1.6] text-muted">{item.body}</p>
        </li>
      ))}
    </ol>
  )
}

export interface FeatureTopic {
  title: string
  them: string
  us: string
}

/** One topic per row: the other system, then EZRA Pro. */
export function FeatureRundown({ themName, items }: { themName: string; items: FeatureTopic[] }) {
  return (
    <div className="divide-y divide-line-subtle border-y border-line-subtle">
      {items.map((item) => (
        <div key={item.title} className="grid gap-x-8 gap-y-3 py-7 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_minmax(0,1fr)]">
          <h3 className="text-[1.125rem] leading-[1.35] font-medium text-foreground">{item.title}</h3>
          <div className="md:py-4">
            <p className="text-[0.8125rem] font-medium text-muted">{themName}</p>
            <p className="mt-1.5 text-[0.9375rem] leading-[1.6] text-foreground/85">{item.them}</p>
          </div>
          <div className="rounded-[1rem] bg-cal-lavender p-4">
            <p className="text-[0.8125rem] font-medium text-muted">EZRA Pro</p>
            <p className="mt-1.5 text-[0.9375rem] leading-[1.6] text-foreground">{item.us}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Worked monthly platform cost at a few booking values. */
export function CostTable({ caption, themLabel, rows }: { caption: string; themLabel: string; rows: { value: string; ezra: string; them: string; note?: string }[] }) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] ring-1 ring-black/[0.06]">
      <table className="w-full border-collapse text-left text-[0.9375rem] leading-[1.45]">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-background-subtle/60">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium text-muted">
              Online bookings a month
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-muted">
              EZRA Pro
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-muted">
              {themLabel}
            </th>
          </tr>
        </thead>
        <tbody className="bg-surface">
          {rows.map((row) => (
            <tr key={row.value} className="border-t border-line-subtle">
              <th scope="row" className="px-4 py-3 font-normal text-foreground tabular-nums">
                {row.value}
              </th>
              <td className="px-4 py-3 font-medium text-foreground tabular-nums">{row.ezra}</td>
              <td className="px-4 py-3 text-foreground tabular-nums">
                {row.them}
                {row.note ? <span className="block text-xs text-muted">{row.note}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Moving over, step by step. */
export function MoveSteps({ steps }: { steps: TitledText[] }) {
  return (
    <ol className="space-y-3">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-4 rounded-[1.25rem] bg-surface p-5 ring-1 ring-black/[0.06] sm:gap-5 sm:p-6">
          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-sm font-medium text-background tabular-nums">
            {index + 1}
          </span>
          <div>
            <h3 className="text-[1.0625rem] leading-[1.35] font-medium text-foreground">{step.title}</h3>
            <p className="mt-1.5 text-[0.9375rem] leading-[1.6] text-muted">{step.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** A two-column checklist. */
export function CheckList({ items }: { items: { label: string; hint?: string }[] }) {
  return (
    <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.label} className="flex gap-3 text-[1rem] leading-[1.5] text-foreground">
          <Check aria-hidden="true" strokeWidth={2.5} className="mt-[0.2em] size-4 shrink-0 text-success" />
          <span>
            {item.label}
            {item.hint ? <span className="block text-[0.875rem] text-muted">{item.hint}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** A customer's words, large. */
export function CustomerQuote({ quote, author, role, company }: { quote: string; author: string; role: string; company: string }) {
  return (
    <figure className="rounded-[1.75rem] bg-cal-linen px-6 py-10 sm:px-12 sm:py-14">
      <Quote aria-hidden="true" className="size-8 text-foreground/30" />
      <blockquote className="mt-5 font-display text-[1.375rem] leading-[1.35] font-medium tracking-[-0.02em] text-pretty text-foreground sm:text-[1.75rem]">{quote}</blockquote>
      <figcaption className="mt-6 text-[0.9375rem] text-muted">
        <span className="font-medium text-foreground">{author}</span>, {role}, {company}
      </figcaption>
    </figure>
  )
}
