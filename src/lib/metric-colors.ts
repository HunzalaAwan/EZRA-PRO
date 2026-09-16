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

/* --------------------------------------------------------------------------
   KPI tiles. The headline cards want louder ink than the chart palette gives
   revenue and bookings (both blues), so those two borrow the warm slots. The
   full-size charts keep the series colours above.
   -------------------------------------------------------------------------- */

const KPI_ACCENT: Partial<Record<SeriesKey, string>> = {
  revenue: 'var(--chart-1)', // violet
  bookings: 'var(--chart-6)', // amber
}

/** Ink for a KPI card's icon and mini chart. */
export function kpiAccent(key: SeriesKey): string {
  return KPI_ACCENT[key] ?? seriesVar(key)
}
