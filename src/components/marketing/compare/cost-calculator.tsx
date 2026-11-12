'use client'

import { useId, useState } from 'react'

import type { PlanRate } from '@/lib/data/competitors'
import { cn } from '@/lib/utils'

/* ==========================================================================
   CostCheck — one input (a month of online bookings), two bars: EZRA Pro and
   the other system. When the other system has several plans, the cheapest
   one at that value is shown. Rates arrive as props from the server page.
   ========================================================================== */

const MIN = 1_000
const MAX = 50_000
const STEP = 500

function money(amount: number) {
  return `$${Math.round(amount).toLocaleString('en-US')}`
}

function cost(rate: PlanRate, value: number) {
  return rate.monthly + (value * rate.percent) / 100
}

function formula(rate: PlanRate) {
  return rate.monthly === 0 ? `${rate.percent}% per booking` : `${money(rate.monthly)} a month + ${rate.percent}%`
}

export function CostCheck({ ezra, them, defaultValue = 10_000, checkedOn }: { ezra: PlanRate; them: PlanRate[]; defaultValue?: number; checkedOn: string }) {
  const id = useId()
  const [value, setValue] = useState(defaultValue)

  const best = them.reduce((a, b) => (cost(b, value) < cost(a, value) ? b : a))
  const rows = [
    { rate: ezra, label: 'EZRA Pro', ours: true },
    { rate: best, label: them.length > 1 ? `${best.vendorName} ${best.plan}` : best.vendorName, ours: false },
  ].map((row) => ({ ...row, amount: cost(row.rate, value) }))
  const max = Math.max(1, ...rows.map((r) => r.amount))
  const diff = rows[1].amount - rows[0].amount
  const summary =
    Math.abs(diff) < 1
      ? 'About the same either way.'
      : diff > 0
        ? `EZRA Pro costs ${money(diff)} less a month.`
        : `${rows[1].label} costs ${money(-diff)} less a month.`

  return (
    <div className="rounded-[1.5rem] bg-cal-cloud p-5 sm:p-8">
      <label htmlFor={`${id}-value`} className="block text-[0.9375rem] font-medium text-foreground">
        Your online bookings in a month
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center rounded-[0.75rem] bg-surface px-3 ring-1 ring-black/[0.08] focus-within:ring-2 focus-within:ring-primary">
          <span aria-hidden="true" className="text-lg text-muted">
            $
          </span>
          <input
            id={`${id}-value`}
            inputMode="numeric"
            value={value.toLocaleString('en-US')}
            onChange={(e) => {
              const n = Number(e.target.value.replace(/[^\d]/g, ''))
              setValue(Number.isFinite(n) ? Math.min(n, 10_000_000) : 0)
            }}
            className="w-32 bg-transparent px-1.5 py-2.5 text-xl font-medium tabular-nums text-foreground outline-none"
          />
        </div>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={Math.min(Math.max(value, MIN), MAX)}
          onChange={(e) => setValue(Number(e.target.value))}
          aria-label="Online bookings in a month"
          className="min-w-0 flex-1 basis-48 accent-foreground"
        />
      </div>

      <ul className="mt-8 space-y-5">
        {rows.map((row) => (
          <li key={row.rate.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="min-w-0 text-[0.9375rem] text-foreground">
                <span className="font-medium">{row.label}</span>
                <span className="text-muted"> · {formula(row.rate)}</span>
                {row.rate.status === 'reported' ? (
                  <span
                    title="From a third party, not the vendor."
                    className="ml-1.5 inline-flex rounded-full bg-cal-sunbeam px-2 py-px align-middle text-xs font-medium ring-1 ring-cal-peach"
                  >
                    Reported
                  </span>
                ) : null}
              </p>
              <p className={cn('shrink-0 font-display text-[1.375rem] font-medium tracking-[-0.02em] tabular-nums text-foreground')}>{money(row.amount)}</p>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface">
              <div
                className={cn('h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none', row.ours ? 'bg-foreground' : 'bg-cal-lilac')}
                style={{ width: `${Math.max(2, (row.amount / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      <p aria-live="polite" className="mt-6 text-[1.0625rem] font-medium text-foreground">
        {summary}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-subtle">
        Platform fee only, at list prices checked {checkedOn}. Card fees aren’t included. An estimate, not a quote.
      </p>
    </div>
  )
}
