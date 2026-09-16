'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Download, Star } from 'lucide-react'

import { ACTIVITY_COLOR_VAR } from '@/components/charts/chart-container'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { toast } from '@/components/ui/toaster'
import { cn, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import type { ActivityPerformance, CurrencyCode } from '@/types'
import { DeltaPill } from './overview-cards'

/* ==========================================================================
   TopExperiencesTable — every product on one sortable sheet, with the cuts
   an operator actually asks for: what is growing, what is slipping, what
   guests rate highest.
   ========================================================================== */

type Cut = 'all' | 'growing' | 'slipping' | 'loved'

const CUTS: { value: Cut; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'growing', label: 'Growing' },
  { value: 'slipping', label: 'Slipping' },
  { value: 'loved', label: 'Best rated' },
]

export interface TopExperiencesTableProps {
  items: ActivityPerformance[]
  currency: CurrencyCode
  rangeLabel: string
  loading?: boolean
  className?: string
}

export function TopExperiencesTable({ items, currency, rangeLabel, loading = false, className }: TopExperiencesTableProps) {
  const router = useRouter()
  const [cut, setCut] = React.useState<Cut>('all')
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<DataTableSort>({ id: 'revenue', dir: 'desc' })

  const rows = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    const filtered = items.filter((item) => {
      if (needle && !item.name.toLowerCase().includes(needle)) return false
      if (cut === 'growing') return item.deltaPercent > 0.5
      if (cut === 'slipping') return item.deltaPercent < -0.5
      if (cut === 'loved') return item.rating >= 4.7
      return true
    })
    const dir = sort.dir === 'asc' ? 1 : -1
    const value = (item: ActivityPerformance): number | string => {
      switch (sort.id) {
        case 'name':
          return item.name.toLowerCase()
        case 'bookings':
          return item.bookings
        case 'occupancy':
          return item.occupancy
        case 'rating':
          return item.rating
        case 'delta':
          return item.deltaPercent
        default:
          return item.revenue
      }
    }
    return [...filtered].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      if (av === bv) return 0
      return (av < bv ? -1 : 1) * dir
    })
  }, [items, cut, query, sort])

  const columns = React.useMemo<DataTableColumn<ActivityPerformance>[]>(
    () => [
      {
        id: 'name',
        header: 'Experience',
        sortable: true,
        cell: (item) => (
          <span className="flex min-w-[12rem] max-w-[22rem] items-center gap-2.5">
            <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full" style={{ background: ACTIVITY_COLOR_VAR[item.colorKey] }} />
            <span className="truncate text-[0.8125rem] font-medium text-foreground">{item.name}</span>
          </span>
        ),
      },
      {
        id: 'bookings',
        header: 'Bookings',
        sortable: true,
        align: 'right',
        numeric: true,
        defaultSortDir: 'desc',
        width: '6.5rem',
        cell: (item) => <span className="text-[0.8125rem] font-medium tabular-nums">{formatNumber(item.bookings)}</span>,
      },
      {
        id: 'occupancy',
        header: 'Occupancy',
        sortable: true,
        defaultSortDir: 'desc',
        width: '10rem',
        hideBelow: 'md',
        cell: (item) => (
          <span className="flex items-center gap-2.5">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-well">
              <span className="block h-full rounded-full" style={{ width: `${Math.min(100, item.occupancy)}%`, background: 'var(--series-occupancy)' }} />
            </span>
            <span className="text-[0.8125rem] text-muted tabular-nums">{formatPercent(item.occupancy, 0)}</span>
          </span>
        ),
      },
      {
        id: 'rating',
        header: 'Rating',
        sortable: true,
        align: 'right',
        numeric: true,
        defaultSortDir: 'desc',
        width: '5.5rem',
        hideBelow: 'lg',
        cell: (item) => (
          <span className="inline-flex items-center gap-1 text-[0.8125rem] font-medium tabular-nums">
            <Star aria-hidden="true" className="size-3.5 fill-current text-warning" />
            {item.rating.toFixed(1)}
          </span>
        ),
      },
      {
        id: 'delta',
        header: 'Change',
        sortable: true,
        align: 'right',
        defaultSortDir: 'desc',
        width: '6rem',
        hideBelow: 'sm',
        cell: (item) => <DeltaPill value={item.deltaPercent} />,
      },
      {
        id: 'revenue',
        header: 'Revenue',
        sortable: true,
        align: 'right',
        numeric: true,
        defaultSortDir: 'desc',
        width: '7.5rem',
        cell: (item) => <span className="text-[0.8125rem] font-semibold text-foreground tabular-nums">{formatCurrency(item.revenue, currency)}</span>,
      },
    ],
    [currency],
  )

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div className="flex flex-col gap-3 px-5 pt-5 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h3 className="font-display text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground">Top experiences</h3>
          <p className="mt-0.5 text-xs text-subtle">
            {formatNumber(items.length)} products · {rangeLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search experiences…"
            size="sm"
            aria-label="Search experiences"
            fieldClassName="w-full sm:w-56"
          />
          <Button
            variant="outline"
            size="sm"
            leftIcon={<Download className="size-4" />}
            onClick={() => toast.success('Export queued', { description: `${formatNumber(rows.length)} experiences · ${rangeLabel}` })}
          >
            Export
          </Button>
        </div>
      </div>

      <div className="border-t border-line-subtle px-5 py-2.5">
        <Segmented size="sm" label="Cut" options={CUTS} value={cut} onValueChange={setCut} />
      </div>

      <CardContent bleed className="border-t border-line-subtle">
        <DataTable
          columns={columns}
          rows={rows}
          getRowId={(item) => item.activityId}
          onRowClick={(item) => router.push(`/dashboard/activities/${item.activityId}`)}
          sort={sort}
          onSortChange={setSort}
          loading={loading}
          loadingRowCount={6}
          rowHeight="compact"
          ariaLabel="Top experiences"
          empty={
            <EmptyState
              variant="no-results"
              size="sm"
              title="No experiences match"
              description="Try another cut or clear the search."
            />
          }
        />
      </CardContent>
    </Card>
  )
}
