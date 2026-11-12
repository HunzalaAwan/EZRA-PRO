'use client'

import { useId, useMemo, useState } from 'react'

import type { PlanRate } from '@/lib/data/competitors'
import { cn } from '@/lib/utils'

/* ==========================================================================
   CostCalculator — one input (a month of online bookings) in, a bar list of
   each plan's estimated monthly cost out: subscription plus percentage.
   Rates arrive as props from the server page. Euro plans are listed apart
   and never converted.
   ========================================================================== */

const MIN = 1_000
const MAX = 100_000
const STEP = 1_000

function money(amount: number, currency: PlanRate['currency'] = 'USD') {
  const symbol = currency === 'EUR' ? '€' : '$'
  return `${symbol}${Math.round(amount).toLocaleString('en-US')}`
}

function cost(rate: PlanRate, value: number) {
  return rate.percent === null ? null : rate.monthly + (value * rate.percent) / 100
}

function formula(rate: PlanRate) {
  const pct = rate.percent === null ? 'fee not published' : `${rate.percent}%`
  return rate.monthly === 0 ? `$0 a month + ${pct}` : `${money(rate.monthly, rate.currency)} a month + ${pct}`
}

export function CostCalculator({ rates, defaultValue = 10_000, checkedOn }: { rates: PlanRate[]; defaultValue?: number; checkedOn: string }) {
  const id = useId()
  const [value, setValue] = useState(defaultValue)

  const groups = useMemo(() => {
    const sorted = (list: PlanRate[]) =>
      [...list].sort((a, b) => {
        const ca = cost(a, value)
        const cb = cost(b, value)
        if (ca === null) return 1
        if (cb === null) return -1
        return ca - cb
      })
    return [
      { key: 'usd', label: null as string | null, rows: sorted(rates.filter((r) => r.currency === 'USD')) },
      { key: 'eur', label: 'Priced in euros (not converted)', rows: sorted(rates.filter((r) => r.currency === 'EUR')) },
    ].filter((g) => g.rows.length > 0)
  }, [rates, value])

  return (
    <div className="rounded-[1.5rem] bg-cal-cloud p-5 sm:p-7">
      <label htmlFor={`${id}-value`} className="block text-[0.9375rem] font-medium text-foreground">
        Your online bookings in a month
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex items-center rounded-[0.75rem] bg-surface px-3 ring-1 ring-black/[0.08] focus-within:ring-2 focus-within:ring-primary">
          <span aria-hidden="true" className="text-lg text-muted">$</span>
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

      {groups.map((group) => {
        const max = Math.max(1, ...group.rows.map((r) => cost(r, value) ?? 0))
        return (
          <div key={group.key} className="mt-7">
            {group.label ? <p className="mb-3 text-xs font-medium tracking-[0.06em] text-subtle uppercase">{group.label}</p> : null}
            <ul className="space-y-4">
              {group.rows.map((rate) => {
                const amount = cost(rate, value)
                const ours = rate.vendor === 'ezra'
                return (
                  <li key={rate.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 text-[0.9375rem] text-foreground">
                        <span className="font-medium">{rate.vendorName}</span>
                        <span className="text-muted"> · {rate.plan}</span>
                        {rate.status === 'reported' ? (
                          <span
                            title="From a third party, not the vendor."
                            className="ml-1.5 inline-flex rounded-full bg-cal-sunbeam px-2 py-px align-middle text-xs font-medium ring-1 ring-cal-peach"
                          >
                            Reported
                          </span>
                        ) : null}
                      </p>
                      <p className={cn('shrink-0 tabular-nums', ours ? 'text-lg font-semibold text-foreground' : 'font-medium text-foreground')}>
                        {amount === null ? '—' : money(amount, rate.currency)}
                      </p>
                    </div>
                    <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-surface">
                      {amount !== null ? (
                        <div
                          className={cn('h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none', ours ? 'bg-foreground' : 'bg-cal-iris')}
                          style={{ width: `${Math.max(2, (amount / max) * 100)}%` }}
                        />
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-subtle">
                      {formula(rate)} · {rate.whoPays}
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}

      <p className="mt-7 text-xs leading-relaxed text-subtle">
        Subscription plus the percentage on online bookings, at list prices checked {checkedOn}. Card fees aren’t included. An estimate, not a quote.
      </p>
    </div>
  )
}
