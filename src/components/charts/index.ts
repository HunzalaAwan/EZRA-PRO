/**
 * EZRA analytics chart library.
 *
 * Every chart takes a `title` + `description`, renders a loading skeleton and an
 * empty state, animates in unless the visitor prefers reduced motion, and draws
 * from the shared `--chart-1 … --chart-8` ramp so colours stay consistent across
 * the dashboard and correct in both themes.
 */

export {
  ACTIVITY_COLOR_VAR,
  CHART_COLOR_VARS,
  CHART_INK,
  ChartContainer,
  ChartDeltaChip,
  ChartLegend,
  chartColorVar,
  useChartColors,
  type ChartContainerProps,
  type ChartDeltaChipProps,
  type ChartLegendItem,
  type ChartLegendProps,
  type ChartLegendShape,
  type ChartPalette,
} from './chart-container'

export {
  CHART_CURSOR_BAND,
  CHART_CURSOR_LINE,
  ChartHoverTooltip,
  ChartTooltip,
  ChartTooltipRow,
  ChartTooltipShell,
  type ChartHoverTooltipProps,
  type ChartTooltipProps,
  type ChartTooltipRowProps,
  type ChartTooltipShellProps,
  type TooltipDelta,
} from './chart-tooltip'

export { RevenueAreaChart, type RevenueAreaChartProps, type RevenueMetric } from './revenue-area-chart'
export { BookingsBarChart, type BookingsBarChartProps } from './bookings-bar-chart'
export { ChannelDonutChart, type ChannelDonutChartProps, type ChannelMetric } from './channel-donut-chart'
export { OccupancyHeatmap, type OccupancyHeatmapProps } from './occupancy-heatmap'
export { ConversionFunnel, type ConversionFunnelProps } from './conversion-funnel'
export { Sparkline, type SparklineProps } from './sparkline'
export { RadialGauge, type GaugeThresholds, type RadialGaugeProps } from './radial-gauge'
export { CohortGrid, type CohortGridProps } from './cohort-grid'
export { GeoBars, countryFlag, type GeoBarsProps, type GeoMetric } from './geo-bars'
export {
  ActivityPerformanceChart,
  type ActivityPerformanceChartProps,
} from './activity-performance-chart'
