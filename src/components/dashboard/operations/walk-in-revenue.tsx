'use client'

import * as React from 'react'
import { Banknote, Calculator, CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { toast } from '@/components/ui/toaster'
import { cn, formatCurrency, pluralize } from '@/lib/utils'
import { WALK_IN_SOURCES, dayKeys, netTotal, summarize, type WalkInRecord } from '@/lib/walk-ins'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   Walk-in revenue, kept apart from online sales: what the desk took, its
   share of everything sold, day by day in card and cash, what sells, where
   walk-ins come from, when they come, and the cash-up at close.
   Card is chart-1 (violet), cash chart-4 (green); values stay in ink.
   ========================================================================== */

type Range = '7' | '14' | '30'

const CARD = 'var(--chart-1)'
const CASH = 'var(--chart-4)'

const shortDay = (key: string) =>
  new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric' }).format(new Date(`${key}T12:00:00`))

export function WalkInRevenue({
  records,
  allRevenue,
  currency,
  nowIso,
  cashUps,
  onCashUp,
}: {
  records: WalkInRecord[]
  allRevenue: Record<string, number>
  currency: CurrencyCode
  nowIso: string
  cashUps: Record<string, { counted: number; at: string }>
  onCashUp: (dateKey: string, counted: number) => void
}) {
  const todayKey = nowIso.slice(0, 10)
  const [range, setRange] = React.useState<Range>('14')
  const keys = dayKeys(todayKey, Number(range))
  const inRange = records.filter((record) => record.soldAt.slice(0, 10) >= keys[0])
  const summary = summarize(inRange)
  // Sales made in this browser are not in the seeded total yet, so add them to both sides.
  const localToday = records.filter((record) => !record.seeded && record.soldAt.slice(0, 10) >= keys[0]).reduce((sum, record) => sum + netTotal(record), 0)
  const allTotal = keys.reduce((sum, key) => sum + (allRevenue[key] ?? 0), 0) + localToday
  const share = allTotal > 0 ? summary.revenue / allTotal : 0

  /* ---------- per day ---------- */
  const perDay = keys.map((key) => {
    const day = summarize(inRange.filter((record) => record.soldAt.slice(0, 10) === key))
    return { key, card: day.card, cash: day.cash, total: day.revenue, sales: day.sales }
  })
  const peak = Math.max(1, ...perDay.map((day) => day.total))
  const [hover, setHover] = React.useState<string | null>(null)
  const hovered = perDay.find((day) => day.key === hover)

  /* ---------- by activity ---------- */
  const byActivity = Object.values(
    inRange.reduce<Record<string, { name: string; sales: number; guests: number; revenue: number }>>((acc, record) => {
      if (record.status === 'refunded') return acc
      const entry = (acc[record.activitySlug] ??= { name: record.activityName, sales: 0, guests: 0, revenue: 0 })
      entry.sales += 1
      entry.guests += record.guests
      entry.revenue += record.total
      return acc
    }, {}),
  ).sort((a, b) => b.revenue - a.revenue)
  const topActivity = Math.max(1, ...byActivity.map((entry) => entry.revenue))

  /* ---------- sources and hours ---------- */
  const kept = inRange.filter((record) => record.status !== 'refunded')
  const sources = [...WALK_IN_SOURCES, 'Not asked']
    .map((source) => ({ source, count: kept.filter((record) => (record.guest.source || 'Not asked') === source).length }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
  const topSource = Math.max(1, ...sources.map((entry) => entry.count))
  const hours = Array.from({ length: 12 }, (_, index) => index + 7).map((hour) => ({
    hour,
    count: kept.filter((record) => Number(record.soldAt.slice(11, 13)) === hour).length,
  }))
  const topHour = Math.max(1, ...hours.map((entry) => entry.count))
  const busiest = hours.reduce((best, entry) => (entry.count > best.count ? entry : best), hours[0])
  const hourLabel = (hour: number) => `${((hour + 11) % 12) + 1}${hour >= 12 ? 'pm' : 'am'}`

  const tiles = [
    { label: 'Walk-in revenue', value: formatCurrency(summary.revenue, currency), note: `${Math.round(share * 100)}% of all revenue in the period` },
    { label: 'Sales', value: String(summary.sales), note: `${summary.guests} ${pluralize(summary.guests, 'guest')}` },
    { label: 'Average sale', value: formatCurrency(summary.average, currency), note: summary.sales > 0 ? `${(summary.guests / summary.sales).toFixed(1)} guests a sale` : 'No sales yet' },
    { label: 'Refunded', value: formatCurrency(summary.refunded, currency), note: `${summary.refunds} ${pluralize(summary.refunds, 'refund')}` },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">Walk-ins only. Online, phone and partner bookings are reported in Analytics.</p>
        <Segmented
          label="Period"
          value={range}
          onValueChange={setRange}
          options={[
            { value: '7', label: '7 days' },
            { value: '14', label: '14 days' },
            { value: '30', label: '30 days' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs font-medium text-subtle">{tile.label}</p>
            <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight tabular-nums">{tile.value}</p>
            <p className="mt-0.5 text-xs text-muted">{tile.note}</p>
          </div>
        ))}
      </div>

      {/* ---------- day by day ---------- */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Walk-in revenue by day</h3>
            <p className="mt-0.5 text-xs text-muted">
              {hovered
                ? `${shortDay(hovered.key)}: ${formatCurrency(hovered.total, currency)} from ${hovered.sales} ${pluralize(hovered.sales, 'sale')} · card ${formatCurrency(hovered.card, currency)} · cash ${formatCurrency(hovered.cash, currency)}`
                : `Card ${formatCurrency(summary.card, currency)} · cash ${formatCurrency(summary.cash, currency)} over ${range} days`}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: CARD }} />Card</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: CASH }} />Cash</span>
          </div>
        </div>
        <div className="relative mt-4">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line-subtle" aria-hidden="true" />
          <span className="pointer-events-none absolute -top-2 right-0 bg-surface pl-1 text-xs text-faint tabular-nums" aria-hidden="true">
            {formatCurrency(peak, currency, { compact: true })}
          </span>
          <div className="flex h-44 items-end gap-1 sm:gap-1.5" aria-hidden="true">
            {perDay.map((day) => (
              <div
                key={day.key}
                className="flex h-full flex-1 cursor-default flex-col justify-end"
                onMouseEnter={() => setHover(day.key)}
                onMouseLeave={() => setHover(null)}
              >
                <div
                  className={cn('flex w-full flex-col justify-end gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity', hover && hover !== day.key && 'opacity-45')}
                  style={{ height: `${(day.total / peak) * 100}%` }}
                >
                  {day.cash > 0 ? <div style={{ background: CASH, height: `${(day.cash / Math.max(1, day.total)) * 100}%` }} /> : null}
                  {day.card > 0 ? <div style={{ background: CARD, height: `${(day.card / Math.max(1, day.total)) * 100}%` }} /> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex gap-1 text-center text-xs text-faint sm:gap-1.5" aria-hidden="true">
            {perDay.map((day, index) => (
              <span key={day.key} className={cn('flex-1 truncate', day.key === todayKey && 'font-semibold text-foreground', index % (range === '30' ? 5 : range === '14' ? 2 : 1) !== 0 && day.key !== todayKey && 'invisible')}>
                {day.key === todayKey ? 'Today' : shortDay(day.key)}
              </span>
            ))}
          </div>
        </div>
        <table className="sr-only">
          <caption>Walk-in revenue by day</caption>
          <thead><tr><th>Day</th><th>Card</th><th>Cash</th><th>Total</th></tr></thead>
          <tbody>
            {perDay.map((day) => (
              <tr key={day.key}><td>{day.key}</td><td>{formatCurrency(day.card, currency)}</td><td>{formatCurrency(day.cash, currency)}</td><td>{formatCurrency(day.total, currency)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* ---------- what sells ---------- */}
        <section className="type-crm rounded-2xl border border-line bg-surface">
          <h3 className="border-b border-line-subtle px-5 py-4 text-sm font-semibold">What walk-ins buy</h3>
          {byActivity.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">No walk-in sales in this period.</p>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="text-[0.8125rem] font-semibold text-muted">
                  <th className="px-5 py-2.5">Activity</th>
                  <th className="px-3 py-2.5 text-right">Sales</th>
                  <th className="px-3 py-2.5 text-right">Guests</th>
                  <th className="px-5 py-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {byActivity.slice(0, 8).map((entry) => (
                  <tr key={entry.name} className="border-t border-line-subtle">
                    <td className="px-5 py-2.5">
                      <span className="block truncate">{entry.name}</span>
                      <span className="mt-1 block h-1.5 rounded-full bg-surface-sunken" aria-hidden="true">
                        <span className="block h-full rounded-full" style={{ width: `${(entry.revenue / topActivity) * 100}%`, background: CASH }} />
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{entry.sales}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{entry.guests}</td>
                    <td className="px-5 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(entry.revenue, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className="flex flex-col gap-5">
          <CashUp
            todayKey={todayKey}
            expected={summarize(records.filter((record) => record.soldAt.slice(0, 10) === todayKey)).cash}
            cashUps={cashUps}
            currency={currency}
            onSave={onCashUp}
          />

          {/* ---------- where they come from ---------- */}
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h3 className="text-sm font-semibold">How they heard about you</h3>
            <ul className="mt-3 flex list-none flex-col gap-2.5 p-0">
              {sources.map((entry) => (
                <li key={entry.source} className="grid grid-cols-[9rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
                  <span className="truncate text-muted">{entry.source}</span>
                  <span className="h-2 rounded-full bg-surface-sunken" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${(entry.count / topSource) * 100}%`, background: CARD }} />
                  </span>
                  <span className="text-right font-medium tabular-nums">{entry.count}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      {/* ---------- when they come ---------- */}
      <section className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">When walk-ins come in</h3>
          <p className="text-xs text-muted">{busiest.count > 0 ? `Busiest around ${hourLabel(busiest.hour)}. Staff the desk then.` : 'No sales yet.'}</p>
        </div>
        <div className="mt-4 flex h-28 items-end gap-2" aria-hidden="true">
          {hours.map((entry) => (
            <div key={entry.hour} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${hourLabel(entry.hour)}: ${entry.count} ${pluralize(entry.count, 'sale')}`}>
              <div
                className="w-full rounded-t-[4px]"
                style={{ height: `${Math.max(entry.count > 0 ? 6 : 0, (entry.count / topHour) * 100)}%`, background: entry.hour === busiest.hour && busiest.count > 0 ? 'var(--color-foreground)' : CARD }}
              />
              <span className="text-xs text-faint">{hourLabel(entry.hour)}</span>
            </div>
          ))}
        </div>
        <table className="sr-only">
          <caption>Walk-in sales by hour</caption>
          <tbody>
            {hours.map((entry) => (
              <tr key={entry.hour}><td>{hourLabel(entry.hour)}</td><td>{entry.count}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

/* ==========================================================================
   CASH-UP — count the drawer at close against the cash walk-ins today
   ========================================================================== */

function CashUp({
  todayKey,
  expected,
  cashUps,
  currency,
  onSave,
}: {
  todayKey: string
  expected: number
  cashUps: Record<string, { counted: number; at: string }>
  currency: CurrencyCode
  onSave: (dateKey: string, counted: number) => void
}) {
  const saved = cashUps[todayKey]
  const [counted, setCounted] = React.useState('')
  const value = counted ? Math.round(Number(counted) * 100) : saved?.counted
  const difference = value === undefined ? null : value - expected

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Calculator className="size-4 text-faint" aria-hidden="true" />
          Cash-up for today
        </h3>
        {saved ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            Counted
          </span>
        ) : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-surface-sunken/60 px-3 py-2.5">
          <dt className="text-xs text-subtle">Cash walk-ins today</dt>
          <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums">{formatCurrency(expected, currency)}</dd>
        </div>
        <div className="rounded-xl bg-surface-sunken/60 px-3 py-2.5">
          <dt className="text-xs text-subtle">Difference</dt>
          <dd className={cn('mt-0.5 font-display text-lg font-semibold tabular-nums', difference === null ? 'text-faint' : difference === 0 ? 'text-success' : 'text-danger')}>
            {difference === null ? 'Not counted' : difference === 0 ? 'Balanced' : `${difference > 0 ? '+' : '−'}${formatCurrency(Math.abs(difference), currency)}`}
          </dd>
        </div>
      </dl>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!counted) return
          onSave(todayKey, Math.round(Number(counted) * 100))
          setCounted('')
          toast.success('Cash-up saved', { description: difference === 0 ? 'The drawer balances.' : `The drawer is ${difference && difference > 0 ? 'over' : 'short'} by ${formatCurrency(Math.abs(difference ?? 0), currency)}.` })
        }}
      >
        <Input
          type="number"
          min={0}
          step={0.01}
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
          placeholder={saved ? `Counted ${formatCurrency(saved.counted, currency)}` : 'Cash counted in the drawer'}
          aria-label="Cash counted in the drawer"
          leftIcon={<Banknote />}
        />
        <Button type="submit" variant="secondary" disabled={!counted}>
          Save
        </Button>
      </form>
      <p className="mt-2 text-xs text-subtle">Count the walk-in cash at close. Take out the float first.</p>
    </section>
  )
}
