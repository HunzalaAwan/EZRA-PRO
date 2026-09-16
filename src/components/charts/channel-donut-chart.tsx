'use client'

/**
 * Where the bookings come from. The donut answers "what's the mix?", the ranked
 * list answers "which channel is moving?" — hovering either one highlights the
 * other, and clicking a row drops that channel out of the mix so an operator can
 * ask "what would this look like without the OTAs?".
 */

import { useMemo, useState, type ReactNode } from 'react'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { cn, formatCurrency, formatNumber, formatPercent, sum } from '@/lib/utils'
import type { ChannelBreakdown, CurrencyCode } from '@/types'
import { ChartContainer, ChartDeltaChip, chartColorVar } from './chart-container'
import { ChartTooltip } from './chart-tooltip'

export type ChannelMetric = 'revenue' | 'bookings'

export interface ChannelDonutChartProps {
  channels: ChannelBreakdown[]
  /** Which measure sizes the arcs. Defaults to revenue. */
  metric?: ChannelMetric
  currency?: CurrencyCode
  height?: number
  title?: string
  description?: string
  toolbar?: ReactNode
  loading?: boolean
  className?: string
}

export function ChannelDonutChart({
  channels,
  metric = 'revenue',
  currency = 'USD',
  height = 260,
  title = 'Booking channels',
  description,
  toolbar,
  loading = false,
  className,
}: ChannelDonutChartProps) {
  const reduced = useReducedMotionSafe()
  const [hidden, setHidden] = useState<string[]>([])
  const [activeChannel, setActiveChannel] = useState<string | null>(null)

  const formatMetric = (value: number) =>
    metric === 'revenue' ? formatCurrency(value, currency) : formatNumber(value)

  /** Colour is assigned from the full, stable ranking so hiding never re-tints. */
  const colorFor = useMemo(() => {
    const map = new Map<string, string>()
    channels.forEach((channel, index) => map.set(channel.channel, chartColorVar(index)))
    return map
  }, [channels])

  const visible = useMemo(() => channels.filter((c) => !hidden.includes(c.channel)), [channels, hidden])
  const total = useMemo(() => sum(visible.map((c) => c[metric])), [visible, metric])

  const active = activeChannel ? (channels.find((c) => c.channel === activeChannel) ?? null) : null
  const activeShare = active && total > 0 ? (active[metric] / total) * 100 : 0

  const summary = useMemo(() => {
    if (channels.length === 0) return ''
    const ranked = [...channels].sort((a, b) => b[metric] - a[metric])
    const lead = ranked[0]
    const overallTotal = sum(channels.map((c) => c[metric]))
    return `${metric === 'revenue' ? 'Revenue' : 'Bookings'} by channel across ${
      channels.length
    } channels. ${lead.label} leads with ${formatPercent(
      overallTotal > 0 ? (lead[metric] / overallTotal) * 100 : 0,
      1,
    )} of the total.`
  }, [channels, metric])

  const toggle = (channel: string) =>
    setHidden((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]))

  const ranked = useMemo(() => [...channels].sort((a, b) => b[metric] - a[metric]), [channels, metric])
  // Past five rows the list stops being a glance; the tail folds behind a toggle.
  const FOLD = 5
  const [expanded, setExpanded] = useState(false)
  const shownChannels = expanded ? ranked : ranked.slice(0, FOLD)

  return (
    <ChartContainer
      title={title}
      description={description}
      ariaLabel={summary}
      height={height}
      toolbar={toolbar}
      loading={loading}
      empty={channels.length === 0}
      className={className}
      dataTable={
        <table>
          <caption>{summary}</caption>
          <thead>
            <tr>
              <th scope="col">Channel</th>
              <th scope="col">Bookings</th>
              <th scope="col">Revenue</th>
              <th scope="col">Share</th>
              <th scope="col">Change</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((channel) => (
              <tr key={channel.channel}>
                <th scope="row">{channel.label}</th>
                <td>{formatNumber(channel.bookings)}</td>
                <td>{formatCurrency(channel.revenue, currency)}</td>
                <td>{formatPercent(channel.share, 1)}</td>
                <td>{formatPercent(channel.deltaPercent, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
      footer={
        <>
        <ul className="space-y-0.5">
          {shownChannels.map((channel) => {
            const isHidden = hidden.includes(channel.channel)
            const isActive = activeChannel === channel.channel
            return (
              <li key={channel.channel}>
                <button
                  type="button"
                  onClick={() => toggle(channel.channel)}
                  onMouseEnter={() => setActiveChannel(channel.channel)}
                  onMouseLeave={() => setActiveChannel(null)}
                  onFocus={() => setActiveChannel(channel.channel)}
                  onBlur={() => setActiveChannel(null)}
                  aria-pressed={!isHidden}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors',
                    isActive ? 'bg-surface-sunken' : 'hover:bg-surface-sunken',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn('size-2.5 shrink-0 rounded-full transition-opacity', isHidden && 'opacity-30')}
                    style={{ background: colorFor.get(channel.channel) }}
                  />
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-xs font-medium',
                      isHidden ? 'text-faint line-through' : 'text-foreground',
                    )}
                  >
                    {channel.label}
                  </span>
                  <span className="tabular shrink-0 text-xs text-muted">{formatPercent(channel.share, 1)}</span>
                  <span className="tabular hidden shrink-0 text-xs text-subtle sm:inline">
                    {formatMetric(channel[metric])}
                  </span>
                  <ChartDeltaChip value={channel.deltaPercent} bare className="shrink-0" />
                </button>
              </li>
            )
          })}
        </ul>
        {ranked.length > FOLD ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1.5 inline-flex min-h-8 items-center rounded-md px-2 text-[0.6875rem] font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {expanded ? 'Show fewer' : `Show ${ranked.length - FOLD} more`}
          </button>
        ) : null}
        </>
      }
    >
      <div className="relative h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Tooltip
              isAnimationActive={false}
              content={
                <ChartTooltip
                  formatValue={(value) => formatMetric(value)}
                  formatName={(entry) => String(entry.name ?? '')}
                  footer={(datum) => {
                    const share = Number(datum.share ?? 0)
                    const bookings = Number(datum.bookings ?? 0)
                    return (
                      <span className="flex items-center justify-between gap-3">
                        <span>{formatNumber(bookings)} bookings</span>
                        <span className="tabular font-medium text-muted">{formatPercent(share, 1)} share</span>
                      </span>
                    )
                  }}
                />
              }
            />
            <Pie
              data={visible}
              dataKey={metric}
              nameKey="label"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={visible.length > 1 ? 2 : 0}
              cornerRadius={6}
              stroke="var(--surface)"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              onMouseEnter={(_, index) => setActiveChannel(visible[index]?.channel ?? null)}
              onMouseLeave={() => setActiveChannel(null)}
              isAnimationActive={!reduced}
              animationDuration={720}
              animationEasing="cubic-bezier(0.16,1,0.3,1)"
            >
              {visible.map((channel) => (
                <Cell
                  key={channel.channel}
                  fill={colorFor.get(channel.channel)}
                  // Dim the rest of the ring so the hovered slice reads first.
                  fillOpacity={activeChannel && activeChannel !== channel.channel ? 0.3 : 1}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Centre readout: the total, or the hovered channel's share. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {active ? (
            <>
              <span className="tabular text-3xl font-semibold leading-none text-foreground">
                {formatPercent(activeShare, 1)}
              </span>
              <span className="mt-1.5 max-w-[10rem] truncate text-xs font-medium text-muted">{active.label}</span>
              <span className="tabular mt-0.5 text-[11px] text-subtle">{formatMetric(active[metric])}</span>
            </>
          ) : (
            <>
              <span className="tabular text-[1.375rem] font-semibold leading-none text-foreground">
                {metric === 'revenue' ? formatCurrency(total, currency, { compact: true }) : formatNumber(total)}
              </span>
              <span className="mt-1.5 text-[11px] uppercase tracking-wide text-subtle">
                {metric === 'revenue' ? 'Total revenue' : 'Total bookings'}
              </span>
            </>
          )}
        </div>
      </div>
    </ChartContainer>
  )
}
