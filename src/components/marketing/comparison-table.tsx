'use client'

import { Check, Info, Sparkles, X } from 'lucide-react'
import { motion } from 'motion/react'

import { SectionHeading } from '@/components/marketing/section-heading'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { EASE_OUT_EXPO } from '@/lib/motion'
import { COMPARISON_ROWS } from '@/lib/site-config'
import { cn } from '@/lib/utils'

/* ==========================================================================
   TYPES
   Mirrors the shape of COMPARISON_ROWS in `@/lib/site-config`, exported here
   so a caller can hand this section its own rows.
   ========================================================================== */

export type ComparisonCellValue = string | boolean

export interface ComparisonRow {
  feature: string
  ezra: ComparisonCellValue
  fareharbor: ComparisonCellValue
  peek: ComparisonCellValue
  hint?: string
}

type ColumnKey = 'ezra' | 'fareharbor' | 'peek'

const COLUMNS: { key: ColumnKey; label: string; highlight: boolean }[] = [
  { key: 'ezra', label: 'EZRA Pro', highlight: true },
  { key: 'fareharbor', label: 'FareHarbor', highlight: false },
  { key: 'peek', label: 'Peek Pro', highlight: false },
]

/* ==========================================================================
   COLUMN GEOMETRY
   The elevated band behind the EZRA column is a positioned element rather
   than a cell background, so it can carry a brand top rail, rounded corners
   and a glow that a `<td>` could never render cleanly. Its offsets are the
   same percentages the <colgroup> hands the table, so the two stay locked
   together at every width.
   ========================================================================== */

const FEATURE_COL_WIDTH = 34
const VALUE_COL_WIDTH = 22

/* ==========================================================================
   CELL VALUES
   Colour never carries the meaning on its own: an included feature is a
   filled disc with a check, an excluded one is a dashed ring with a cross,
   and both ship an off-screen label for assistive tech.
   ========================================================================== */

function ValueCell({
  value,
  emphasis = false,
}: {
  value: ComparisonCellValue
  emphasis?: boolean
}) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center">
        <span
          aria-hidden="true"
          className="grid size-7 place-items-center rounded-full bg-primary text-on-primary shadow-sm"
        >
          <Check className="size-4" strokeWidth={3} />
        </span>
        <span className="sr-only">Included</span>
      </span>
    )
  }

  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center">
        <span
          aria-hidden="true"
          className="grid size-7 place-items-center rounded-full border border-dashed border-line-strong text-faint"
        >
          <X className="size-3.5" strokeWidth={2.5} />
        </span>
        <span className="sr-only">Not included</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        'text-sm leading-snug',
        emphasis ? 'font-semibold text-foreground' : 'text-muted',
      )}
    >
      {value}
    </span>
  )
}

/* ==========================================================================
   SECTION
   ========================================================================== */

export interface ComparisonTableProps {
  /** Anchor target for in-page navigation. */
  id?: string
  /** Override the rows shipped in the site config. */
  rows?: ComparisonRow[]
  className?: string
}

/**
 * The switching decision, laid out as a table an operator can fact-check.
 * The EZRA column is elevated with a tinted band, a brand rail and a glow —
 * clearly the recommendation, without pretending the other two do nothing.
 */
export function ComparisonTable({
  id = 'comparison',
  rows = COMPARISON_ROWS,
  className,
}: ComparisonTableProps) {
  const reducedMotion = useReducedMotionSafe()
  const lastIndex = rows.length - 1

  return (
    <section
      id={id}
      aria-label="Honest comparison"
      className={cn('relative isolate py-24 sm:py-32', className)}
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Honest comparison"
          title={
            <>
              How EZRA Pro <span className="text-gradient-lagoon">actually compares</span>
            </>
          }
          description="The same ten questions every operator asks on a switching call. Where FareHarbor and Peek Pro match us, the row says so."
          align="center"
        />

        {/* ------------------------------------------------------------------
            DESKTOP — a real table, so screen readers get real row and column
            relationships. Hidden below md, where it is replaced by cards.
           ------------------------------------------------------------------ */}
        <div className="mt-14 hidden md:block">
          <div className="rounded-4xl border border-line-subtle bg-surface/50 p-2 shadow-sm lg:p-4">
            <div className="relative">
              <motion.div
                aria-hidden="true"
                initial={reducedMotion ? false : { opacity: 0, scaleY: 0.9 }}
                whileInView={{ opacity: 1, scaleY: 1 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.85, ease: EASE_OUT_EXPO }}
                style={{
                  transformOrigin: 'top',
                  left: `${FEATURE_COL_WIDTH}%`,
                  width: `${VALUE_COL_WIDTH}%`,
                }}
                className={cn(
                  'pointer-events-none absolute inset-y-0 overflow-hidden rounded-3xl',
                  'border border-primary/25 shadow-glow-lagoon',
                  'bg-gradient-to-b from-primary-soft via-primary-soft/35 to-transparent',
                )}
              >
                <span className="absolute inset-x-0 top-0 h-[3px] bg-primary" />
              </motion.div>

              <table className="relative w-full table-fixed border-separate border-spacing-0 text-left">
                <caption className="sr-only">
                  Feature-by-feature comparison of EZRA Pro, FareHarbor and Peek Pro.
                </caption>

                <colgroup>
                  <col style={{ width: `${FEATURE_COL_WIDTH}%` }} />
                  <col style={{ width: `${VALUE_COL_WIDTH}%` }} />
                  <col style={{ width: `${VALUE_COL_WIDTH}%` }} />
                  <col style={{ width: `${VALUE_COL_WIDTH}%` }} />
                </colgroup>

                <thead>
                  <tr>
                    <th scope="col" className="px-5 pb-6 pt-9 align-bottom">
                      <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-faint">
                        Feature
                      </span>
                    </th>

                    {COLUMNS.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className={cn(
                          'px-4 pb-6 text-center align-bottom',
                          column.highlight ? 'pt-5' : 'pt-9',
                        )}
                      >
                        {column.highlight ? (
                          <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-primary px-2.5 py-1 text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-on-primary shadow-sm">
                            <Sparkles aria-hidden="true" className="size-3" />
                            Recommended
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'block font-display text-base font-semibold tracking-[-0.01em]',
                            column.highlight ? 'text-foreground' : 'text-muted',
                          )}
                        >
                          {column.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => (
                    <tr
                      key={row.feature}
                      className={cn(
                        'transition-colors duration-200 ease-[var(--ease-out-expo)]',
                        'hover:bg-[color-mix(in_oklab,var(--fg)_4%,transparent)]',
                        index === lastIndex && '[&>*]:pb-8',
                      )}
                    >
                      <th
                        scope="row"
                        className="border-t border-line px-5 py-4 text-left align-middle font-normal"
                      >
                        <span className="block text-sm font-medium text-foreground">
                          {row.feature}
                        </span>
                        {row.hint ? (
                          <span className="mt-1 block text-xs leading-snug text-subtle">
                            {row.hint}
                          </span>
                        ) : null}
                      </th>

                      <td className="border-t border-primary/20 px-4 py-4 text-center align-middle">
                        <ValueCell value={row.ezra} emphasis />
                      </td>
                      <td className="border-t border-line px-4 py-4 text-center align-middle">
                        <ValueCell value={row.fareharbor} />
                      </td>
                      <td className="border-t border-line px-4 py-4 text-center align-middle">
                        <ValueCell value={row.peek} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------
            MOBILE — one card per feature. A horizontally scrolling table on a
            360px screen is a worse answer than three labelled rows.
           ------------------------------------------------------------------ */}
        <StaggerGroup as="ul" stagger={0.045} margin="-40px" className="mt-12 space-y-3 md:hidden">
          {rows.map((row) => (
            <StaggerItem as="li" key={row.feature} distance={16}>
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
                <p className="font-display text-sm font-semibold text-foreground">{row.feature}</p>
                {row.hint ? <p className="mt-1 text-xs text-subtle">{row.hint}</p> : null}

                <dl className="mt-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/25 bg-primary-soft/50 px-3 py-2.5">
                    <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
                      EZRA Pro
                    </dt>
                    <dd className="flex min-w-0 items-center justify-end text-right">
                      <ValueCell value={row.ezra} emphasis />
                    </dd>
                  </div>

                  {COLUMNS.filter((column) => !column.highlight).map((column) => (
                    <div
                      key={column.key}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line-subtle bg-surface-sunken/60 px-3 py-2.5"
                    >
                      <dt className="text-xs font-medium uppercase tracking-[0.08em] text-subtle">
                        {column.label}
                      </dt>
                      <dd className="flex min-w-0 items-center justify-end text-right">
                        <ValueCell value={row[column.key]} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </StaggerItem>
          ))}
        </StaggerGroup>

        <p className="mx-auto mt-8 flex max-w-3xl items-start gap-2.5 text-xs leading-relaxed text-subtle sm:justify-center sm:text-center">
          <Info aria-hidden="true" className="mt-px size-3.5 shrink-0 text-faint" />
          <span>
            Comparison based on publicly listed pricing and published feature documentation,
            accurate as of the current season. FareHarbor and Peek Pro are trademarks of their
            respective owners; features change, so check their sites before you decide.
          </span>
        </p>
      </div>
    </section>
  )
}
