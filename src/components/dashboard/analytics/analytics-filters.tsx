'use client'

import { RotateCcw } from 'lucide-react'

import type { RevenueMetric } from '@/components/charts/revenue-area-chart'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/* ==========================================================================
   AnalyticsFilterBar — the knobs that reshape the main chart, in one row.
   ========================================================================== */

export type ComparisonMode = 'previous' | 'year'

export const METRIC_OPTIONS: { value: RevenueMetric; label: string; hint: string }[] = [
  { value: 'revenue', label: 'Net revenue', hint: 'Money by departure date' },
  { value: 'bookings', label: 'Bookings', hint: 'Reservations by departure date' },
  { value: 'guests', label: 'Guests', hint: 'Seats sold' },
  { value: 'occupancy', label: 'Occupancy', hint: 'Share of capacity sold' },
]

export const COMPARISON_OPTIONS: { value: ComparisonMode; label: string; hint: string }[] = [
  { value: 'previous', label: 'Previous period', hint: 'The equal-length window before this one' },
  { value: 'year', label: 'Same period last year', hint: 'Needs twelve months of history' },
]

export interface AnalyticsFilterBarProps {
  metric: RevenueMetric
  onMetricChange: (metric: RevenueMetric) => void
  comparison: ComparisonMode
  onComparisonChange: (mode: ComparisonMode) => void
  shadow: boolean
  onShadowChange: (on: boolean) => void
  onReset: () => void
  className?: string
}

export function AnalyticsFilterBar({
  metric,
  onMetricChange,
  comparison,
  onComparisonChange,
  shadow,
  onShadowChange,
  onReset,
  className,
}: AnalyticsFilterBarProps) {
  const dirty = metric !== 'revenue' || comparison !== 'previous' || !shadow

  return (
    <Card className={cn('flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-end', className)}>
      <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="an-metric" className="text-[0.75rem] font-medium text-muted">
            Metric
          </label>
          <Select value={metric} onValueChange={(v) => onMetricChange(v as RevenueMetric)}>
            <SelectTrigger id="an-metric" aria-label="Metric">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRIC_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} description={o.hint}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="an-compare" className="text-[0.75rem] font-medium text-muted">
            Compare with
          </label>
          <Select value={comparison} onValueChange={(v) => onComparisonChange(v as ComparisonMode)}>
            <SelectTrigger id="an-compare" aria-label="Comparison basis">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPARISON_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} description={o.hint}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <span className="block text-[0.75rem] font-medium text-muted">Chart</span>
          <label className="flex h-10 items-center gap-3 rounded-lg border border-line bg-surface px-3">
            <Switch size="sm" checked={shadow} onCheckedChange={onShadowChange} disabled={comparison !== 'previous'} />
            <span className={cn('text-[0.8125rem] text-foreground', comparison !== 'previous' && 'text-subtle')}>
              Shadow the previous period
            </span>
          </label>
        </div>
      </div>

      <Button variant="outline" size="md" leftIcon={<RotateCcw />} onClick={onReset} disabled={!dirty} className="shrink-0">
        Reset
      </Button>
    </Card>
  )
}
