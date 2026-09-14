'use client'

/**
 * The "what should I reschedule?" view. Weekday rows x hour columns, tinted
 * through the lagoon ramp by occupancy, so dead slots and sell-outs are obvious
 * before you read a single number.
 *
 * Hand-built with CSS grid: Recharts has no heatmap primitive, and a grid of
 * divs gives us real focus management and per-cell aria labels for free.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { cn, clamp, formatCurrency, formatNumber, formatPercent } from '@/lib/utils'
import type { CurrencyCode, HeatmapCell } from '@/types'
import { ChartContainer } from './chart-container'
import { ChartHoverTooltip, ChartTooltipRow, ChartTooltipShell } from './chart-tooltip'

/** Index 0 = Monday, matching `HeatmapCell.weekday` and the calendar grid. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const CELL_KEY = (weekday: number, hour: number) => `${weekday}:${hour}`

/** `--ease-out-expo`, in the tuple shape motion expects. */
const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1]

/** Compact axis label: 9a, 12p, 5p. */
function hourLabelShort(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}${hour < 12 ? 'a' : 'p'}`
}

/** Spoken label: "9 AM". */
function hourLabelLong(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h} ${hour < 12 ? 'AM' : 'PM'}`
}

/**
 * Occupancy -> tint. Mixing toward `--chart-1` keeps the ramp inside the brand
 * and correct in both themes; the floor of 8% keeps empty-but-scheduled slots
 * distinguishable from slots that do not exist at all.
 */
function cellTint(occupancy: number): string {
  const weight = 8 + (clamp(occupancy, 0, 100) / 100) * 88
  return `color-mix(in oklab, var(--chart-1) ${weight.toFixed(1)}%, var(--surface-sunken))`
}

/** Flip label ink once the tint gets dark enough to swallow muted text. */
function cellInk(occupancy: number): string {
  return occupancy >= 62 ? 'var(--on-primary)' : 'var(--fg-muted)'
}

interface HoverState {
  cell: HeatmapCell
  x: number
  y: number
}

export interface OccupancyHeatmapProps {
  cells: HeatmapCell[]
  currency?: CurrencyCode
  /** First hour column. Defaults to the earliest hour in the data. */
  startHour?: number
  /** Last hour column, inclusive. Defaults to the latest hour in the data. */
  endHour?: number
  height?: number
  title?: string
  description?: string
  loading?: boolean
  className?: string
}

export function OccupancyHeatmap({
  cells,
  currency = 'USD',
  startHour,
  endHour,
  height = 272,
  title = 'Occupancy by day and time',
  description,
  loading = false,
  className,
}: OccupancyHeatmapProps) {
  const reduced = useReducedMotion()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const cellRefs = useRef(new Map<string, HTMLButtonElement>())
  const shouldRestoreFocus = useRef(false)

  const [hover, setHover] = useState<HoverState | null>(null)
  const [focusCell, setFocusCell] = useState({ row: 0, col: 0 })

  const hours = useMemo(() => {
    if (cells.length === 0) return []
    const min = startHour ?? Math.min(...cells.map((c) => c.hour))
    const max = endHour ?? Math.max(...cells.map((c) => c.hour))
    return Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i)
  }, [cells, startHour, endHour])

  const lookup = useMemo(() => {
    const map = new Map<string, HeatmapCell>()
    for (const cell of cells) map.set(CELL_KEY(cell.weekday, cell.hour), cell)
    return map
  }, [cells])

  const peak = useMemo(
    () => cells.reduce<HeatmapCell | null>((best, cell) => (!best || cell.occupancy > best.occupancy ? cell : best), null),
    [cells],
  )

  const summary = useMemo(() => {
    if (!peak) return ''
    const quiet = cells
      .filter((c) => c.bookings > 0)
      .reduce<HeatmapCell | null>((worst, cell) => (!worst || cell.occupancy < worst.occupancy ? cell : worst), null)
    const quietPart = quiet
      ? ` The quietest running slot is ${WEEKDAYS_LONG[quiet.weekday]} at ${hourLabelLong(quiet.hour)} at ${formatPercent(
          quiet.occupancy,
        )}.`
      : ''
    return `Occupancy heatmap across ${WEEKDAYS.length} weekdays and ${hours.length} time slots. Peak occupancy is ${formatPercent(
      peak.occupancy,
    )} on ${WEEKDAYS_LONG[peak.weekday]} at ${hourLabelLong(peak.hour)}.${quietPart}`
  }, [cells, hours.length, peak])

  // Only pull focus after a keyboard move — never on mount.
  useEffect(() => {
    if (!shouldRestoreFocus.current) return
    shouldRestoreFocus.current = false
    cellRefs.current.get(CELL_KEY(focusCell.row, hours[focusCell.col] ?? -1))?.focus()
  }, [focusCell, hours])

  const showTooltip = useCallback((cell: HeatmapCell, element: HTMLElement) => {
    const host = wrapperRef.current
    if (!host) return
    const rect = element.getBoundingClientRect()
    const hostRect = host.getBoundingClientRect()
    setHover({
      cell,
      x: rect.left - hostRect.left + rect.width / 2,
      y: rect.top - hostRect.top,
    })
  }, [])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const deltas: Record<string, [number, number]> = {
        ArrowUp: [-1, 0],
        ArrowDown: [1, 0],
        ArrowLeft: [0, -1],
        ArrowRight: [0, 1],
      }
      const delta = deltas[event.key]
      if (!delta && event.key !== 'Home' && event.key !== 'End') return

      event.preventDefault()
      shouldRestoreFocus.current = true
      setFocusCell((prev) => {
        if (event.key === 'Home') return { ...prev, col: 0 }
        if (event.key === 'End') return { ...prev, col: hours.length - 1 }
        return {
          row: clamp(prev.row + delta[0], 0, WEEKDAYS.length - 1),
          col: clamp(prev.col + delta[1], 0, hours.length - 1),
        }
      })
    },
    [hours.length],
  )

  const columnWidth = 30
  const gridStyle = {
    gridTemplateColumns: `34px repeat(${hours.length}, minmax(0, 1fr))`,
    gridTemplateRows: `16px repeat(${WEEKDAYS.length}, minmax(0, 1fr))`,
    minWidth: 34 + hours.length * columnWidth,
  }

  return (
    <ChartContainer
      title={title}
      description={description}
      ariaLabel={summary}
      height={height}
      loading={loading}
      empty={cells.length === 0 || hours.length === 0}
      emptyMessage="No departures scheduled in this range."
      className={className}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-subtle">Occupancy</span>
            <span
              aria-hidden="true"
              className="h-2 w-28 rounded-full"
              style={{
                background: `linear-gradient(to right, ${cellTint(0)}, ${cellTint(50)}, ${cellTint(100)})`,
              }}
            />
            <span className="tabular text-[11px] text-subtle">0–100%</span>
          </div>
          {peak ? (
            <span className="text-[11px] text-subtle">
              Peak{' '}
              <span className="font-medium text-muted">
                {WEEKDAYS[peak.weekday]} {hourLabelLong(peak.hour)}
              </span>{' '}
              at <span className="tabular font-medium text-muted">{formatPercent(peak.occupancy)}</span>
            </span>
          ) : null}
        </div>
      }
      dataTable={
        <table>
          <caption>{summary}</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              {hours.map((hour) => (
                <th key={hour} scope="col">
                  {hourLabelLong(hour)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {WEEKDAYS_LONG.map((day, weekday) => (
              <tr key={day}>
                <th scope="row">{day}</th>
                {hours.map((hour) => {
                  const cell = lookup.get(CELL_KEY(weekday, hour))
                  return <td key={hour}>{cell ? formatPercent(cell.occupancy) : 'No departure'}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div ref={wrapperRef} className="relative h-full w-full">
        <div className="no-scrollbar h-full overflow-x-auto">
          <div
            className="grid h-full gap-[3px]"
            style={gridStyle}
            onKeyDown={onKeyDown}
            onMouseLeave={() => setHover(null)}
          >
            {/* Header row: empty corner, then hour labels. */}
            <div aria-hidden="true" />
            {hours.map((hour) => (
              <div
                key={`head-${hour}`}
                className="tabular flex items-start justify-center text-[10px] leading-none text-subtle"
                aria-hidden="true"
              >
                {hourLabelShort(hour)}
              </div>
            ))}

            {WEEKDAYS.map((day, weekday) => (
              <div key={day} className="contents">
                <div
                  className="flex items-center pr-1 text-[11px] font-medium leading-none text-subtle"
                  aria-hidden="true"
                >
                  {day}
                </div>

                {hours.map((hour, col) => {
                  const cell = lookup.get(CELL_KEY(weekday, hour))
                  const isFocusTarget = focusCell.row === weekday && focusCell.col === col
                  const isPeak = peak != null && cell != null && cell.weekday === peak.weekday && cell.hour === peak.hour
                  const isHovered =
                    hover != null && cell != null && hover.cell.weekday === weekday && hover.cell.hour === hour

                  if (!cell) {
                    return (
                      <div
                        key={hour}
                        aria-hidden="true"
                        className="rounded-[5px] border border-dashed border-line-subtle"
                      />
                    )
                  }

                  return (
                    <motion.button
                      key={hour}
                      type="button"
                      ref={(node) => {
                        if (node) cellRefs.current.set(CELL_KEY(weekday, hour), node)
                        else cellRefs.current.delete(CELL_KEY(weekday, hour))
                      }}
                      tabIndex={isFocusTarget ? 0 : -1}
                      aria-label={`${WEEKDAYS_LONG[weekday]} ${hourLabelLong(hour)}, ${formatPercent(
                        cell.occupancy,
                      )} occupancy, ${formatNumber(cell.bookings)} bookings, ${formatCurrency(cell.revenue, currency)}`}
                      onMouseEnter={(event) => showTooltip(cell, event.currentTarget)}
                      onFocus={(event) => {
                        setFocusCell({ row: weekday, col })
                        showTooltip(cell, event.currentTarget)
                      }}
                      onBlur={() => setHover(null)}
                      className={cn(
                        'relative rounded-[5px] transition-[outline-color,transform] duration-150',
                        'outline outline-1 outline-offset-0 outline-transparent',
                        isHovered && 'outline-line-strong',
                        isPeak && 'outline-primary',
                      )}
                      style={{ background: cellTint(cell.occupancy), color: cellInk(cell.occupancy) }}
                      // Diagonal wipe: cells nearer the top-left land first.
                      initial={reduced ? false : { opacity: 0, scale: 0.72 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={
                        reduced
                          ? { duration: 0 }
                          : {
                              duration: 0.34,
                              delay: Math.min((weekday + col) * 0.016, 0.42),
                              ease: EASE_OUT_EXPO,
                            }
                      }
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {hover ? (
          <ChartHoverTooltip x={hover.x} y={hover.y} width={wrapperRef.current?.clientWidth} inset={92}>
            <ChartTooltipShell
              label={`${WEEKDAYS_LONG[hover.cell.weekday]} · ${hourLabelLong(hover.cell.hour)}`}
              sublabel={
                hover.cell.occupancy >= 90
                  ? 'Selling out — consider adding a departure'
                  : hover.cell.occupancy <= 35
                    ? 'Under-filled — a candidate to merge or move'
                    : undefined
              }
            >
              <ChartTooltipRow
                color="var(--chart-1)"
                name="Occupancy"
                value={formatPercent(hover.cell.occupancy)}
              />
              <ChartTooltipRow name="Bookings" value={formatNumber(hover.cell.bookings)} muted />
              <ChartTooltipRow name="Revenue" value={formatCurrency(hover.cell.revenue, currency)} muted />
            </ChartTooltipShell>
          </ChartHoverTooltip>
        ) : null}
      </div>
    </ChartContainer>
  )
}
