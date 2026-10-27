import { activeZones, roundTripOf, transferOf, tripsOffered, vehiclesOf, zoneHasPrice } from '@/lib/transfers'
import { cn, formatCurrency } from '@/lib/utils'
import type { Activity, CurrencyCode } from '@/types'

/* ==========================================================================
   Transfer prices — the owner's price table as guests read it: each
   destination with its hotels, and the price per vehicle (a shared shuttle:
   per person) one way and round trip. A driver by the hour: a row per
   vehicle. One card per destination on a phone.
   ========================================================================== */

/** The Included line that says fees are in the price, as written: "All fees and parking". */
function feesLine(included: string[]): string | undefined {
  return included.find((item) => /\bfees?\b/i.test(item))
}

const lowerFirst = (text: string) => (text ? text[0].toLowerCase() + text.slice(1) : text)

export function TransferPriceList({
  activity,
  currency,
  className,
}: {
  activity: Pick<Activity, 'kind' | 'transfer' | 'priceTiers' | 'included' | 'maxCapacity'>
  currency: CurrencyCode
  className?: string
}) {
  const config = transferOf(activity)
  if (!config) return null
  const money = (minor: number | undefined) => (minor && minor > 0 ? formatCurrency(minor, currency) : '—')
  const fees = feesLine(activity.included)
  const unit = config.service === 'shared' ? 'Prices per person' : config.service === 'hourly' ? 'Prices per vehicle, per hour' : 'Prices per vehicle'
  const caption = `${unit}, in ${currency}.${fees ? ` Includes ${lowerFirst(fees)}.` : ''}`

  /* ---------- by the hour: a row per vehicle ---------- */
  if (config.service === 'hourly') {
    const rows = vehiclesOf(activity).flatMap((vehicle) => {
      const rate = config.hourly?.find((entry) => entry.tierId === vehicle.tierId)?.hour
      return rate ? [{ vehicle, rate }] : []
    })
    const fewest = config.minHours ?? 1
    return (
      <div className={className}>
        <ul className="divide-y divide-line-subtle rounded-xl border border-line">
          {rows.map(({ vehicle, rate }) => (
            <li key={vehicle.tierId} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{vehicle.name}</span>
                <span className="block text-xs text-subtle">Up to {vehicle.passengers} passengers</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold tabular text-foreground">{money(rate)}</span>
                <span className="block text-xs text-subtle">
                  per hour · fewest {fewest} {fewest === 1 ? 'hour' : 'hours'}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 text-xs text-subtle">{caption}</p>
      </div>
    )
  }

  /* ---------- the table: destinations × vehicles (shared: tickets) ---------- */
  const columns =
    config.service === 'shared'
      ? activity.priceTiers.filter((tier) => config.rates.some((rate) => rate.tierId === tier.id && rate.oneWay > 0)).map((tier) => ({ id: tier.id, name: tier.label, note: tier.description ?? '' }))
      : vehiclesOf(activity).map((vehicle) => ({ id: vehicle.tierId, name: vehicle.name, note: `Up to ${vehicle.passengers}` }))
  const roundTrip = tripsOffered(config).includes('round_trip')
  const zones = activeZones(config).filter((zone) => zone.name.trim() && zoneHasPrice(config, zone.id))
  const rateOf = (zoneId: string, tierId: string) => config.rates.find((rate) => rate.zoneId === zoneId && rate.tierId === tierId && rate.oneWay > 0)
  if (zones.length === 0 || columns.length === 0) return null

  return (
    <div className={className}>
      {/* Phones: one card per destination. */}
      <ul className="flex list-none flex-col gap-3 p-0 sm:hidden">
        {zones.map((zone) => (
          <li key={zone.id} className="rounded-xl border border-line px-4 py-3">
            <p className="text-sm font-semibold text-foreground">{zone.name}</p>
            {zone.places.length > 0 ? <p className="mt-0.5 line-clamp-2 text-xs text-subtle">{zone.places.slice(0, 3).join(', ')}</p> : null}
            <dl className="mt-2.5 flex flex-col gap-1.5">
              {columns.map((column) => {
                const rate = rateOf(zone.id, column.id)
                return (
                  <div key={column.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <dt className="min-w-0 text-muted">{column.name}</dt>
                    <dd className="shrink-0 text-right tabular text-foreground">
                      <span className="font-semibold">{money(rate?.oneWay)}</span>
                      {roundTrip ? <span className="text-xs text-subtle"> · round trip {rate ? money(roundTripOf(rate)) : '—'}</span> : null}
                    </dd>
                  </div>
                )
              })}
            </dl>
          </li>
        ))}
      </ul>

      {/* Wider screens: the sheet. */}
      <div className="hidden overflow-x-auto rounded-xl border border-line sm:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-sunken text-left">
            <tr>
              <th scope="col" rowSpan={roundTrip ? 2 : 1} className="px-4 py-2.5 align-bottom text-xs font-semibold text-muted">
                Destination
              </th>
              {columns.map((column) => (
                <th key={column.id} scope="colgroup" colSpan={roundTrip ? 2 : 1} className="border-l border-line-subtle px-4 pt-2.5 pb-1 text-xs font-semibold text-foreground">
                  {column.name}
                  {column.note ? <span className="ml-1.5 font-normal text-subtle">{column.note}</span> : null}
                </th>
              ))}
            </tr>
            {roundTrip ? (
              <tr>
                {columns.flatMap((column) => [
                  <th key={`${column.id}-one`} scope="col" className="border-l border-line-subtle px-4 pb-2.5 text-xs font-medium text-subtle">
                    One way
                  </th>,
                  <th key={`${column.id}-round`} scope="col" className="px-4 pb-2.5 text-xs font-medium text-subtle">
                    Round trip
                  </th>,
                ])}
              </tr>
            ) : null}
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {zones.map((zone) => (
              <tr key={zone.id}>
                <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                  <span className="block font-semibold text-foreground">{zone.name}</span>
                  {zone.places.length > 0 ? <span className="mt-0.5 block max-w-64 truncate text-xs text-subtle">{zone.places.slice(0, 3).join(', ')}</span> : null}
                </th>
                {columns.flatMap((column) => {
                  const rate = rateOf(zone.id, column.id)
                  return [
                    <td key={`${column.id}-one`} className={cn('border-l border-line-subtle px-4 py-3 align-top font-semibold tabular text-foreground')}>
                      {money(rate?.oneWay)}
                    </td>,
                    ...(roundTrip
                      ? [
                          <td key={`${column.id}-round`} className="px-4 py-3 align-top tabular text-muted">
                            {rate ? money(roundTripOf(rate)) : '—'}
                          </td>,
                        ]
                      : []),
                  ]
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2.5 text-xs text-subtle">{caption}</p>
    </div>
  )
}
