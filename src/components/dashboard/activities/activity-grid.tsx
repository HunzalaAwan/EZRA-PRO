'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDownWideNarrow, LayoutGrid, Plus, Rows3, SlidersHorizontal } from 'lucide-react'

import type { ActivityFormat, ActivityStatus, DifficultyLevel, VerticalKey } from '@/types'
import { ACTIVITY_FORMATS, ACTIVITY_FORMAT_META } from '@/lib/activity-format'
import { cn, formatNumber, titleCase } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Segmented, type SegmentedOption } from '@/components/ui/segmented'
import { SearchInput } from '@/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/ui/empty-state'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { ActivityCard, DIFFICULTY_LABEL } from './activity-card'
import { ActivityTable, sortSummaries, type ActivitySortId } from './activity-table'
import type { ActivitySummary } from './activity-data'

/* ==========================================================================
   GRID
   ========================================================================== */

export interface ActivityGridProps {
  rows: ActivitySummary[]
  tenantSlug: string
  /** Changing this replays the cascade — used to re-animate on filter change. */
  cascadeKey?: string
  className?: string
}

export function ActivityGrid({ rows, tenantSlug, cascadeKey, className }: ActivityGridProps) {
  return (
    <StaggerGroup
      key={cascadeKey}
      as="ul"
      stagger={0.045}
      startDelay={0.04}
      amount={0.05}
      className={cn(
        'grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
        className,
      )}
    >
      {rows.map((row) => (
        <StaggerItem as="li" key={row.activity.id} distance={18} className="min-w-0">
          <ActivityCard summary={row} tenantSlug={tenantSlug} />
        </StaggerItem>
      ))}
    </StaggerGroup>
  )
}

/* ==========================================================================
   CATALOG — filters, view switch, and the two presentations
   ========================================================================== */

type StatusFilter = 'all' | ActivityStatus
type CategoryFilter = 'all' | VerticalKey
type DifficultyFilter = 'all' | DifficultyLevel
type FormatFilter = 'all' | ActivityFormat
type ViewMode = 'grid' | 'table'

interface SortOption {
  id: ActivitySortId
  dir: 'asc' | 'desc'
  label: string
}

const SORT_OPTIONS: SortOption[] = [
  { id: 'updated', dir: 'desc', label: 'Recently updated' },
  { id: 'revenue', dir: 'desc', label: 'Revenue (30d)' },
  { id: 'bookings', dir: 'desc', label: 'Bookings (30d)' },
  { id: 'occupancy', dir: 'desc', label: 'Occupancy' },
  { id: 'rating', dir: 'desc', label: 'Guest rating' },
  { id: 'price', dir: 'asc', label: 'Price: low to high' },
  { id: 'price', dir: 'desc', label: 'Price: high to low' },
  { id: 'name', dir: 'asc', label: 'Name A–Z' },
]

const sortKey = (option: { id: ActivitySortId; dir: 'asc' | 'desc' }) => `${option.id}:${option.dir}`

const STATUS_ORDER: ActivityStatus[] = ['live', 'draft', 'paused', 'archived']
const DIFFICULTIES: DifficultyLevel[] = ['easy', 'moderate', 'challenging', 'extreme']

export interface ActivityCatalogProps {
  summaries: ActivitySummary[]
  tenantSlug: string
}

export function ActivityCatalog({ summaries, tenantSlug }: ActivityCatalogProps) {
  const router = useRouter()

  const [query, setQuery] = React.useState('')
  const [status, setStatus] = React.useState<StatusFilter>('all')
  const [category, setCategory] = React.useState<CategoryFilter>('all')
  const [difficulty, setDifficulty] = React.useState<DifficultyFilter>('all')
  const [format, setFormat] = React.useState<FormatFilter>('all')
  const [sort, setSort] = React.useState<{ id: ActivitySortId; dir: 'asc' | 'desc' }>({
    id: 'updated',
    dir: 'desc',
  })
  const [view, setView] = React.useState<ViewMode>('grid')

  const categories = React.useMemo(
    () => Array.from(new Set(summaries.map((s) => s.activity.category))).sort(),
    [summaries],
  )

  const statusCounts = React.useMemo(() => {
    const counts: Record<string, number> = { all: summaries.length }
    for (const item of summaries) {
      counts[item.activity.status] = (counts[item.activity.status] ?? 0) + 1
    }
    return counts
  }, [summaries])

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    const rows = summaries.filter(({ activity }) => {
      if (status !== 'all' && activity.status !== status) return false
      if (category !== 'all' && activity.category !== category) return false
      if (difficulty !== 'all' && activity.difficulty !== difficulty) return false
      if (format !== 'all' && activity.format !== format) return false
      if (!needle) return true
      return (
        activity.name.toLowerCase().includes(needle) ||
        activity.tagline.toLowerCase().includes(needle) ||
        activity.slug.toLowerCase().includes(needle) ||
        activity.meetingPoint.toLowerCase().includes(needle)
      )
    })
    return sortSummaries(rows, sort)
  }, [summaries, query, status, category, difficulty, format, sort])

  const filtersActive =
    query.trim().length > 0 || status !== 'all' || category !== 'all' || difficulty !== 'all' || format !== 'all'

  const clearFilters = () => {
    setQuery('')
    setStatus('all')
    setCategory('all')
    setDifficulty('all')
    setFormat('all')
  }

  const statusOptions: SegmentedOption<StatusFilter>[] = [
    { value: 'all', label: 'All', count: statusCounts.all },
    ...STATUS_ORDER.filter((value) => (statusCounts[value] ?? 0) > 0).map((value) => ({
      value: value as StatusFilter,
      label: titleCase(value),
      count: statusCounts[value],
    })),
  ]

  const viewOptions: SegmentedOption<ViewMode>[] = [
    { value: 'grid', label: 'Grid', icon: LayoutGrid, ariaLabel: 'Grid view' },
    { value: 'table', label: 'Table', icon: Rows3, ariaLabel: 'Table view' },
  ]

  const cascadeKey = `${status}-${category}-${difficulty}-${format}-${sortKey(sort)}-${query}`

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- toolbar ---------- */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            debounceMs={120}
            label="Search activities"
            placeholder="Search activities, taglines, meeting points…"
            className="min-w-0"
            fieldClassName="w-full sm:w-80"
          />

          <Select value={category} onValueChange={(value) => setCategory(value as CategoryFilter)}>
            <SelectTrigger
              className="w-full sm:w-44"
              aria-label="Filter by category"
              icon={<SlidersHorizontal />}
            >
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((value) => (
                <SelectItem key={value} value={value}>
                  {titleCase(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={difficulty}
            onValueChange={(value) => setDifficulty(value as DifficultyFilter)}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by difficulty">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any difficulty</SelectItem>
              {DIFFICULTIES.map((value) => (
                <SelectItem key={value} value={value}>
                  {DIFFICULTY_LABEL[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={format} onValueChange={(value) => setFormat(value as FormatFilter)}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Filter by how it runs">
              <SelectValue placeholder="Runs as" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any format</SelectItem>
              {ACTIVITY_FORMATS.map((value) => (
                <SelectItem key={value} value={value}>
                  {ACTIVITY_FORMAT_META[value].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={sortKey(sort)}
            onValueChange={(value) => {
              const [id, dir] = value.split(':')
              setSort({ id: id as ActivitySortId, dir: dir as 'asc' | 'desc' })
            }}
          >
            <SelectTrigger
              className="w-full sm:w-52"
              aria-label="Sort activities"
              icon={<ArrowDownWideNarrow />}
            >
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={sortKey(option)} value={sortKey(option)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto hidden md:block">
            <Segmented
              label="Catalog view"
              options={viewOptions}
              value={view}
              onValueChange={setView}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle pt-3">
          <div className="no-scrollbar -mx-1 max-w-full overflow-x-auto px-1">
            <Segmented
              label="Filter by status"
              size="sm"
              options={statusOptions}
              value={status}
              onValueChange={setStatus}
            />
          </div>

          <div className="flex items-center gap-3">
            <p className="text-xs text-subtle tabular">
              <span className="font-semibold text-foreground">{formatNumber(filtered.length)}</span>{' '}
              of {formatNumber(summaries.length)} activities
            </p>
            {filtersActive ? (
              <Button variant="ghost" size="xs" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ---------- results ---------- */}
      {filtered.length === 0 ? (
        <EmptyState
          surface="dashed"
          variant="no-results"
          title="No activities match those filters"
          description="Nothing in the catalog fits this combination. Widen the status or clear the search to start again."
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Clear filters
            </Button>
          }
          secondaryAction={
            <Button
              variant="primary"
              leftIcon={<Plus />}
              onClick={() => router.push('/dashboard/activities/new')}
            >
              New activity
            </Button>
          }
        />
      ) : (
        <>
          {/* The table collapses to cards below md — a nine-column grid is
              unreadable on a phone, and the ops team lives on phones. */}
          <div className={cn(view === 'table' ? 'hidden md:block' : 'hidden')}>
            <ActivityTable
              rows={filtered}
              tenantSlug={tenantSlug}
              sort={sort}
              onSortChange={(next) =>
                setSort({ id: next.id as ActivitySortId, dir: next.dir })
              }
              onClearFilters={clearFilters}
            />
          </div>
          <div className={cn(view === 'table' ? 'md:hidden' : '')}>
            <ActivityGrid rows={filtered} tenantSlug={tenantSlug} cascadeKey={cascadeKey} />
          </div>
        </>
      )}
    </div>
  )
}
