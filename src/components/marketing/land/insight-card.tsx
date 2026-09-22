import { ArrowRight, TrendingUp } from 'lucide-react'

import { cn } from '@/lib/utils'

/* ==========================================================================
   InsightCard — occupancy by weekday and hour, and the one sentence the
   numbers add up to.

   A server component built from plain markup: a seven-by-eight grid of
   cells on a single violet ramp (light to dark, one hue, as the dashboard's
   heatmap does), a weak slot called out, and the recommendation underneath
   with its dollar impact. Nothing here is random; the cells are authored so
   the shape reads the way a real operator's week does — quiet mornings,
   full weekends.
   ========================================================================== */

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const HOURS = ['08', '10', '12', '14', '16', '18', '20', '22'] as const

/** Occupancy per cell, 0–100, rows = days, columns = hours. */
const CELLS: number[][] = [
  [34, 46, 58, 52, 61, 72, 80, 41],
  [28, 41, 31, 49, 63, 78, 84, 45],
  [38, 52, 66, 60, 70, 82, 88, 52],
  [42, 58, 71, 68, 76, 90, 93, 61],
  [51, 64, 79, 82, 88, 96, 98, 74],
  [70, 86, 95, 97, 99, 100, 100, 88],
  [66, 80, 90, 92, 90, 84, 72, 48],
]

const WEAK = { day: 1, hour: 2 } as const

/** One hue, seven steps, light to dark. */
function ramp(value: number) {
  if (value < 35) return 'bg-chart-1/[0.10]'
  if (value < 50) return 'bg-chart-1/[0.22]'
  if (value < 62) return 'bg-chart-1/[0.36]'
  if (value < 74) return 'bg-chart-1/[0.52]'
  if (value < 86) return 'bg-chart-1/[0.70]'
  if (value < 95) return 'bg-chart-1/[0.86]'
  return 'bg-chart-1'
}

export function InsightCard({ className }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="Occupancy heatmap for the last thirty days, by weekday and hour. Tuesday at midday runs at 31 percent; the recommendation is to move that slot to 17:45, worth about 1,900 dollars a month."
      className={cn('overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-lg)] ring-1 ring-black/[0.05]', className)}
    >
      <div aria-hidden="true">
        <header className="flex items-center justify-between gap-3 border-b border-line-subtle px-5 py-3.5">
          <div>
            <p className="text-[0.8125rem] font-semibold text-foreground">Occupancy by hour</p>
            <p className="mt-0.5 text-xs text-subtle">Last 30 days · all products</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-success-soft px-2 py-1 text-xs font-semibold text-success">
            <TrendingUp className="size-3" strokeWidth={2.5} />
            +6.2 pts
          </span>
        </header>

        <div className="px-5 pt-4 pb-3">
          <div className="grid grid-cols-[2rem_1fr] gap-x-2">
            <div className="flex flex-col gap-1">
              {DAYS.map((day) => (
                <span key={day} className="flex h-6 items-center text-xs font-medium text-subtle">
                  {day}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              {CELLS.map((row, dayIndex) => (
                <div key={DAYS[dayIndex]} className="grid grid-cols-8 gap-1">
                  {row.map((value, hourIndex) => {
                    const weak = dayIndex === WEAK.day && hourIndex === WEAK.hour
                    return (
                      <span
                        key={HOURS[hourIndex]}
                        className={cn(
                          'h-6 rounded-[0.3rem]',
                          ramp(value),
                          weak && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
                        )}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
            <span />
            <div className="mt-1.5 grid grid-cols-8 gap-1">
              {HOURS.map((hour) => (
                <span key={hour} className="text-center text-xs text-faint tabular-nums">
                  {hour}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-5 mb-5 rounded-xl bg-surface-sunken p-4">
          <p className="text-xs font-semibold tracking-[0.12em] text-accent uppercase">Worth doing this week</p>
          <p className="mt-1.5 text-[0.875rem] leading-snug text-foreground">
            Tuesday 12:00 runs at <span className="font-semibold tabular-nums">31%</span>. Move it to 17:45 and it fills like
            Thursday&rsquo;s.
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[0.75rem] text-muted">
              About <span className="font-semibold text-foreground tabular-nums">+$1,900</span> a month
            </p>
            <span className="inline-flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-on-primary">
              Move the slot
              <ArrowRight className="size-3" strokeWidth={2.5} />
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
