'use client'

/**
 * Retention matrix. A cohort grid *is* a table, so this renders a real one —
 * sticky cohort column, colour intensity by retention, and row + column
 * cross-hair highlighting so you can trace a single month without losing
 * your place.
 */

import { useMemo, useState } from 'react'
import { cn, clamp, formatNumber, formatPercent } from '@/lib/utils'
import type { CohortRow } from '@/types'
import { ChartContainer } from './chart-container'

/** Retention -> tint, on the same lagoon ramp as the occupancy heatmap. */
function retentionTint(retention: number): string {
  const weight = 6 + (clamp(retention, 0, 100) / 100) * 88
  return `color-mix(in oklab, var(--chart-1) ${weight.toFixed(1)}%, var(--surface-sunken))`
}

function retentionInk(retention: number): string {
  return retention >= 62 ? 'var(--on-primary)' : 'var(--fg-muted)'
}

export interface CohortGridProps {
  rows: CohortRow[]
  /** Caps the number of month columns. */
  maxMonths?: number
  height?: number
  title?: string
  description?: string
  loading?: boolean
  className?: string
}

export function CohortGrid({
  rows,
  maxMonths = 12,
  height,
  title = 'Guest retention by cohort',
  description,
  loading = false,
  className,
}: CohortGridProps) {
  const [hover, setHover] = useState<{ row: number; col: number } | null>(null)

  const months = useMemo(() => {
    const longest = rows.reduce((max, row) => Math.max(max, row.retention.length), 0)
    return Array.from({ length: Math.min(longest, maxMonths) }, (_, i) => i)
  }, [rows, maxMonths])

  const summary = useMemo(() => {
    if (rows.length === 0 || months.length < 2) return ''
    // Month 1 is the retention number operators actually steer on.
    const monthOne = rows.map((row) => row.retention[1]).filter((value): value is number => typeof value === 'number')
    const avg = monthOne.length > 0 ? monthOne.reduce((a, b) => a + b, 0) / monthOne.length : 0
    return `Retention matrix for ${rows.length} cohorts across ${months.length} months. Month-one retention averages ${formatPercent(
      avg,
      1,
    )}.`
  }, [rows, months.length])

  const resolvedHeight = height ?? Math.min(420, 44 + rows.length * 34)

  return (
    <ChartContainer
      title={title}
      description={description}
      ariaLabel={summary}
      height={resolvedHeight}
      loading={loading}
      empty={rows.length === 0 || months.length === 0}
      emptyMessage="Not enough booking history to build cohorts yet."
      semantic
      className={className}
      bodyClassName="px-5 pb-4"
      footer={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-subtle">Retention</span>
          <span
            aria-hidden="true"
            className="h-2 w-28 rounded-full"
            style={{
              background: `linear-gradient(to right, ${retentionTint(0)}, ${retentionTint(50)}, ${retentionTint(100)})`,
            }}
          />
          <span className="tabular text-[11px] text-subtle">0–100%</span>
        </div>
      }
    >
      <div className="no-scrollbar h-full overflow-auto" onMouseLeave={() => setHover(null)}>
        <table className="w-full border-separate border-spacing-[3px] text-xs">
          <caption className="sr-only">{summary}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-20 bg-surface px-2 pb-1 text-left text-[11px] font-medium text-subtle"
              >
                Cohort
              </th>
              {months.map((month) => (
                <th
                  key={month}
                  scope="col"
                  className={cn(
                    'sticky top-0 z-10 min-w-[44px] bg-surface pb-1 text-center text-[11px] font-medium transition-colors',
                    hover?.col === month ? 'text-foreground' : 'text-subtle',
                  )}
                >
                  M{month}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.cohort}>
                <th
                  scope="row"
                  className={cn(
                    'sticky left-0 z-10 whitespace-nowrap bg-surface px-2 text-left font-medium transition-colors',
                    hover?.row === rowIndex ? 'text-foreground' : 'text-muted',
                  )}
                >
                  <span className="flex items-baseline gap-1.5">
                    {row.cohort}
                    <span className="tabular text-[10px] font-normal text-faint">{formatNumber(row.size)}</span>
                  </span>
                </th>

                {months.map((month) => {
                  const retention = row.retention[month]
                  const crossHair = hover?.row === rowIndex || hover?.col === month
                  const exact = hover?.row === rowIndex && hover?.col === month

                  if (typeof retention !== 'number') {
                    return <td key={month} className="h-7 rounded-[5px]" aria-label="No data" />
                  }

                  return (
                    <td
                      key={month}
                      onMouseEnter={() => setHover({ row: rowIndex, col: month })}
                      className={cn(
                        'tabular h-7 rounded-[5px] text-center text-[11px] font-medium tracking-tight',
                        'outline outline-1 outline-offset-0 transition-[outline-color,opacity] duration-150',
                        exact ? 'outline-primary' : crossHair ? 'outline-line-strong' : 'outline-transparent',
                        hover && !crossHair && 'opacity-55',
                      )}
                      style={{ background: retentionTint(retention), color: retentionInk(retention) }}
                    >
                      {formatPercent(retention)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartContainer>
  )
}
