'use client'

import { useId, useMemo, useState } from 'react'
import { ArrowUpRight } from 'lucide-react'

import type { PlanRate } from '@/lib/data/competitors'
import { cn } from '@/lib/utils'

/* ==========================================================================
   CostCalculator — monthly online booking value in, estimated platform cost
   per plan out. Only published rates, or rates clearly marked "Reported".
   Rates arrive as props from the server page, so the competitor data module
   (and the marketing content it reads) stays out of the client bundle.
   ========================================================================== */

const MIN = 1_000
const MAX = 200_000
const STEP = 1_000

function money(amount: number, currency: PlanRate['currency']) {
  const symbol = currency === 'EUR' ? '€' : '$'
  return `${symbol}${Math.round(amount).toLocaleString('en-US')}`
}

function cost(rate: PlanRate, value: number) {
  if (rate.percent === null) return null
  return rate.monthly + (value * rate.percent) / 100
}

function processing(rate: PlanRate, value: number, bookings: number) {
  if (!rate.processing) return null
  return (value * rate.processing.percent) / 100 + bookings * rate.processing.fixed
}

function parse(input: string, fallback: number) {
  const n = Number(input.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : fallback
}

function Badge() {
  return (
    <span
      title="From a third party, not the vendor. Confirm with the vendor."
      className="inline-flex items-center rounded-full bg-cal-sunbeam px-2 py-0.5 text-xs font-medium text-foreground ring-1 ring-cal-peach"
    >
      Reported<span className="sr-only"> (a third-party figure)</span>
    </span>
  )
}

function Source({ rate }: { rate: PlanRate }) {
  const external = /^https?:\/\//.test(rate.source.url)
  return (
    <a
      href={rate.source.url}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}
      className="inline-flex items-center gap-0.5 text-xs text-subtle underline decoration-line-strong underline-offset-2 hover:text-foreground"
    >
      {rate.source.label}
      {external ? <ArrowUpRight aria-hidden="true" className="size-3" /> : null}
      {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
    </a>
  )
}

export function CostCalculator({
  rates,
  defaultValue = 10_000,
  defaultAverage = 120,
  checkedOn,
  ezraNote,
}: {
  rates: PlanRate[]
  /** Printed above the results when EZRA Pro rows are present. */
  ezraNote?: string
  defaultValue?: number
  defaultAverage?: number
  /** Printed with the results, e.g. "12 November 2026". */
  checkedOn: string
}) {
  const id = useId()
  const [valueInput, setValueInput] = useState(String(defaultValue))
  const [averageInput, setAverageInput] = useState(String(defaultAverage))

  const value = Math.min(Math.max(parse(valueInput, defaultValue), 0), 10_000_000)
  const average = parse(averageInput, defaultAverage)
  const bookings = value / average

  const groups = useMemo(() => {
    const sortRows = (list: PlanRate[]) =>
      [...list].sort((a, b) => {
        const ca = cost(a, value)
        const cb = cost(b, value)
        if (ca === null) return 1
        if (cb === null) return -1
        return ca - cb
      })
    const usd = sortRows(rates.filter((r) => r.currency === 'USD'))
    const eur = sortRows(rates.filter((r) => r.currency === 'EUR'))
    return [
      { key: 'usd', label: 'Priced in US dollars', rows: usd },
      { key: 'eur', label: 'Priced in euros, shown at face value, not converted', rows: eur },
    ].filter((g) => g.rows.length > 0)
  }, [rates, value])

  const hasReported = rates.some((r) => r.status === 'reported')
  const showGroupHeads = groups.length > 1

  return (
    <div className="rounded-[1.5rem] bg-cal-cloud p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-[1rem] bg-surface p-4 ring-1 ring-black/[0.05]">
          <label htmlFor={`${id}-value`} className="block text-sm font-medium text-foreground">
            Online bookings a month
          </label>
          <div className="mt-2 flex items-center gap-2">
            <span aria-hidden="true" className="text-lg text-muted">$</span>
            <input
              id={`${id}-value`}
              inputMode="numeric"
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              aria-describedby={`${id}-value-hint`}
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-lg tabular-nums text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
          </div>
          <input
            type="range"
            min={MIN}
            max={MAX}
            step={STEP}
            value={Math.min(Math.max(value, MIN), MAX)}
            onChange={(e) => setValueInput(e.target.value)}
            aria-label="Online bookings a month, slider"
            className="mt-3 w-full accent-primary"
          />
          <p id={`${id}-value-hint`} className="mt-1 text-xs text-subtle">
            What guests pay you online in a typical month, before any fees.
          </p>
        </div>
        <div className="rounded-[1rem] bg-surface p-4 ring-1 ring-black/[0.05]">
          <label htmlFor={`${id}-average`} className="block text-sm font-medium text-foreground">
            Average booking
          </label>
          <div className="mt-2 flex items-center gap-2">
            <span aria-hidden="true" className="text-lg text-muted">$</span>
            <input
              id={`${id}-average`}
              inputMode="numeric"
              value={averageInput}
              onChange={(e) => setAverageInput(e.target.value)}
              aria-describedby={`${id}-average-hint`}
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-lg tabular-nums text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            />
          </div>
          <p id={`${id}-average-hint`} className="mt-3 text-xs text-subtle">
            Used only for per-payment card fees. About {Math.round(bookings).toLocaleString('en-US')} bookings a month.
          </p>
        </div>
      </div>

      {ezraNote && rates.some((r) => r.vendor === 'ezra') ? (
        <p className="mt-5 rounded-[1rem] bg-surface px-4 py-3 text-sm leading-relaxed text-muted ring-1 ring-black/[0.05]">
          <span className="font-medium text-foreground">About our rows: </span>
          {ezraNote}
        </p>
      ) : null}

      <div
        role="region"
        aria-label="Estimated monthly cost by booking system"
        tabIndex={0}
        className="relative mt-5 overflow-x-auto rounded-[1rem] bg-surface ring-1 ring-black/[0.05] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <caption className="px-4 pt-4 pb-2 text-left text-sm text-muted">
            Estimated platform cost for {money(value, 'USD')} of online bookings a month, cheapest first. List prices checked {checkedOn}.
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-[0.06em] text-subtle uppercase">System and plan</th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-[0.06em] text-subtle uppercase">Monthly</th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-[0.06em] text-subtle uppercase">Fee</th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-[0.06em] text-subtle uppercase">Platform cost</th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-[0.06em] text-subtle uppercase">Card processing</th>
              <th scope="col" className="px-4 py-3 text-xs font-semibold tracking-[0.06em] text-subtle uppercase">Who pays the fee</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.key}>
              {showGroupHeads ? (
                <tr>
                  <th scope="colgroup" colSpan={6} className="bg-background-subtle px-4 py-2 text-left text-xs font-semibold text-muted">
                    {group.label}
                  </th>
                </tr>
              ) : null}
              {group.rows.map((rate) => {
                const total = cost(rate, value)
                const card = processing(rate, value, bookings)
                const ours = rate.vendor === 'ezra'
                return (
                  <tr key={rate.id} className={cn('border-b border-line-subtle last:border-b-0', ours && 'bg-cal-haze')}>
                    <th scope="row" className="px-4 py-4 align-top text-sm font-normal">
                      <span className="block font-medium text-foreground">
                        {rate.vendorName} <span className="text-muted">{rate.plan}</span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-2">
                        {rate.status === 'reported' ? <Badge /> : null}
                        <Source rate={rate} />
                      </span>
                      {rate.note ? <span className="mt-1.5 block max-w-[24rem] text-xs leading-snug text-subtle">{rate.note}</span> : null}
                    </th>
                    <td className="px-4 py-4 align-top text-sm tabular-nums text-foreground">{money(rate.monthly, rate.currency)}</td>
                    <td className="px-4 py-4 align-top text-sm tabular-nums text-foreground">
                      {rate.percent === null ? 'Not published' : `${rate.percent}%`}
                    </td>
                    <td className="px-4 py-4 align-top text-sm font-semibold tabular-nums text-foreground">
                      {total === null ? <span className="font-normal text-muted">Can’t be calculated</span> : money(total, rate.currency)}
                    </td>
                    <td className="px-4 py-4 align-top text-sm tabular-nums text-foreground">
                      {card === null || !rate.processing ? (
                        <span className="text-muted">Not published</span>
                      ) : (
                        <>
                          {money(card, rate.currency)}
                          <span className="block text-xs text-subtle">{rate.processing.label}</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-sm text-muted">{rate.whoPays}</td>
                  </tr>
                )
              })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="mt-3 text-xs text-subtle md:hidden">Scroll the table sideways to see every column.</p>

      <div className="mt-5 rounded-[1rem] bg-surface p-4 text-sm leading-relaxed text-muted ring-1 ring-black/[0.05] sm:p-5">
        <p className="font-medium text-foreground">What this assumes</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          <li>Platform cost is the monthly subscription plus the percentage on online bookings. It’s what the platform takes, whoever pays it.</li>
          <li>Card processing is shown only where the vendor publishes a rate, and is not added to the platform cost.</li>
          <li>Offline, phone and OTA bookings are left out. Several vendors charge less, or nothing, on those.</li>
          <li>Taxes, setup fees, add-ons and currency conversion are left out.</li>
          {hasReported ? <li>Rows marked “Reported” use a third-party figure because the vendor doesn’t publish its rate. Ask the vendor for a written quote.</li> : null}
        </ul>
      </div>
    </div>
  )
}
