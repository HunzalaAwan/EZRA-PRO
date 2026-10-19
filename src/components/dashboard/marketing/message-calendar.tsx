'use client'

import * as React from 'react'
import { CalendarDays } from 'lucide-react'

import { Skeleton } from '@/components/ui/skeleton'
import { SimpleTooltip } from '@/components/ui/tooltip'
import type { Flow, FlowRun } from '@/lib/flows/types'
import { cn, toDateKey } from '@/lib/utils'

/* ==========================================================================
   WHAT'S GOING OUT THIS WEEK
   Seven days from today, with how many messages each live automation will
   send that day (from the simulator's look ahead). A day where two or more
   marketing automations send gets one quiet dot by its date (some guests
   may hear from you twice), explained in the legend. Click an automation
   to open it.
   ========================================================================== */

const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const DAY_NUM = new Intl.DateTimeFormat('en-US', { day: 'numeric' })
const MONTH = new Intl.DateTimeFormat('en-US', { month: 'short' })

interface Day {
  key: string
  date: Date
  total: number
  rows: { flow: Flow; count: number }[]
  /** Marketing automations sending this day. */
  marketing: number
}

/** The next seven day keys from the demo clock, in the same local keys the simulator uses. */
export function weekKeys(nowIso: string, days = 7): { key: string; date: Date }[] {
  const [y, m, d] = nowIso.slice(0, 10).split('-').map(Number)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(y, (m ?? 1) - 1, (d ?? 1) + index, 12)
    return { key: toDateKey(date), date }
  })
}

export interface MessageCalendarProps {
  /** Live automations only: drafts and paused ones send nothing. */
  flows: Flow[]
  runs: Record<string, Pick<FlowRun, 'upcoming'>> | null
  nowIso: string
  onOpen: (flowId: string) => void
  marketingPaused?: boolean
  /** The numbers could not be worked out. */
  failed?: boolean
  className?: string
}

export function MessageCalendar({ flows, runs, nowIso, onOpen, marketingPaused = false, failed = false, className }: MessageCalendarProps) {
  const week = React.useMemo<Day[]>(
    () =>
      weekKeys(nowIso).map(({ key, date }) => {
        const rows: Day['rows'] = []
        for (const flow of flows) {
          const count = runs?.[flow.id]?.upcoming?.[key] ?? 0
          if (count > 0) rows.push({ flow, count })
        }
        rows.sort((a, b) => b.count - a.count || a.flow.name.localeCompare(b.flow.name))
        return {
          key,
          date,
          rows,
          total: rows.reduce((sum, row) => sum + row.count, 0),
          marketing: rows.filter((row) => row.flow.purpose === 'marketing').length,
        }
      }),
    [flows, runs, nowIso],
  )

  const total = week.reduce((sum, day) => sum + day.total, 0)
  const loading = runs === null && !failed
  const heavy = loading || failed ? [] : week.filter((day) => day.marketing >= 2)

  return (
    <section aria-labelledby="week-heading" className={cn('rounded-2xl border border-line bg-surface shadow-xs', className)}>
      <header className="flex flex-col gap-3 border-b border-line-subtle px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="week-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CalendarDays className="size-4 text-subtle" aria-hidden="true" />
            What&rsquo;s going out this week
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {failed
              ? 'Couldn’t work out what is due this week. The automations still run.'
              : loading
              ? 'Working out what your live automations will send…'
              : flows.length === 0
                ? 'Turn an automation on to see what it will send here.'
                : total === 0
                ? 'Nothing is due from your live automations in the next 7 days.'
                : `${total.toLocaleString('en-US')} ${total === 1 ? 'message' : 'messages'} due from your live automations in the next 7 days.`}
            {marketingPaused ? ' Marketing is paused, so only booking messages are counted.' : ''}
          </p>
        </div>
      </header>

      <div>
        <ol className="grid list-none grid-cols-1 p-0 lg:grid-cols-7">
          {week.map((day, index) => {
            const isHeavy = day.marketing >= 2 && !loading && !failed
            return (
              <li key={day.key} className={cn('flex flex-col border-line-subtle px-4 py-3 lg:min-h-44 lg:px-3', index > 0 && 'border-t lg:border-t-0 lg:border-l')}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="flex items-center text-xs font-medium text-subtle">
                    {index === 0 ? 'Today' : WEEKDAY.format(day.date)}
                    <span className="ml-1 text-faint">
                      {index === 0 || day.date.getDate() === 1 ? `${MONTH.format(day.date)} ` : ''}
                      {DAY_NUM.format(day.date)}
                    </span>
                    {isHeavy ? (
                      <SimpleTooltip label={`${day.marketing} marketing automations send this day, so some guests may hear from you twice.`}>
                        <span
                          role="img"
                          tabIndex={0}
                          className="ml-1.5 inline-grid size-4 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-primary"
                          aria-label={`${day.marketing} marketing automations send this day`}
                        >
                          <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
                        </span>
                      </SimpleTooltip>
                    ) : null}
                  </p>
                  {loading || failed ? null : <p className={cn('text-sm font-semibold tabular-nums', day.total > 0 ? 'text-foreground' : 'text-faint')}>{day.total.toLocaleString('en-US')}</p>}
                </div>
                {loading ? (
                  <div className="mt-3 flex flex-col gap-2">
                    <Skeleton className="h-6 w-full rounded-md" />
                    <Skeleton className="h-6 w-3/4 rounded-md" />
                  </div>
                ) : failed ? (
                  <p className="mt-1 text-xs text-faint lg:mt-3">—</p>
                ) : day.rows.length === 0 ? (
                  <p className="mt-1 text-xs text-faint lg:mt-3">Nothing due</p>
                ) : (
                  <ul className="mt-2.5 flex list-none flex-col gap-1 p-0">
                    {day.rows.map((row) => (
                      <li key={row.flow.id}>
                        <button
                          type="button"
                          onClick={() => onOpen(row.flow.id)}
                          title={row.flow.name}
                          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-xs transition-colors hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary lg:py-1"
                        >
                          <span
                            aria-hidden="true"
                            className={cn('size-1.5 shrink-0 rounded-full', row.flow.purpose === 'marketing' ? 'bg-primary' : 'bg-line-strong')}
                          />
                          <span className="min-w-0 flex-1 truncate text-foreground">{row.flow.name}</span>
                          <span className="shrink-0 font-medium text-muted tabular-nums">
                            {row.count}
                            <span className="sr-only"> {row.count === 1 ? 'message' : 'messages'}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line-subtle px-5 py-3 text-xs text-subtle">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
          Marketing
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-line-strong" />
          Booking message
        </span>
        {heavy.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-warning" />
            Two or more marketing automations send that day. The weekly limit in Marketing settings caps how many one guest gets.
          </span>
        ) : null}
      </footer>
    </section>
  )
}
