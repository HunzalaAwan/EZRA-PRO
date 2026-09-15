/**
 * One colour per metric, everywhere.
 *
 * The data-viz rule is that colour follows the entity: revenue is always the
 * same hue on a KPI tile, a sparkline, a trend chart and a legend, so a reader
 * learns it once. The hues themselves are the validated `--chart-N` slots in
 * `globals.css`; this file only decides which slot each business metric wears,
 * via the semantic `--series-*` aliases defined next to them.
 */

export type SeriesKey =
  | 'revenue'
  | 'bookings'
  | 'guests'
  | 'aov'
  | 'occupancy'
  | 'cancellations'
  | 'repeat'
  | 'rating'
  | 'lead'
  | 'compare'

/** CSS custom property carrying the series colour. */
export function seriesVar(key: SeriesKey): string {
  return `var(--series-${key})`
}

/** KPI key (as produced by the analytics seam) → series. */
export const KPI_SERIES: Record<string, SeriesKey> = {
  net_revenue: 'revenue',
  revenue: 'revenue',
  bookings: 'bookings',
  guests: 'guests',
  aov: 'aov',
  occupancy: 'occupancy',
  cancellation_rate: 'cancellations',
  repeat_rate: 'repeat',
  avg_rating: 'rating',
  lead_time: 'lead',
}

export function seriesForKpi(key: string): SeriesKey {
  return KPI_SERIES[key] ?? 'revenue'
}
