'use client'

import * as React from 'react'
import { Bus, Phone, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { Segmented } from '@/components/ui/segmented'
import type { PickupRunSheet as Sheet } from '@/lib/operations'
import { cn, formatTime, pluralize } from '@/lib/utils'

/* ==========================================================================
   DRIVER RUN SHEET
   Today's hotel pickups in the order the shuttle collects them, by zone,
   with a tick for each party on board. Prints clean for the driver.
   ========================================================================== */

export function PickupRunSheet({ sheet }: { sheet: Sheet }) {
  const [zone, setZone] = React.useState<string>('all')
  const [collected, setCollected] = React.useState<Record<string, boolean>>({})

  const visible = sheet.stops.filter((stop) => zone === 'all' || stop.zoneId === zone)
  const guests = visible.reduce((sum, stop) => sum + stop.party, 0)
  const aboard = visible.filter((stop) => collected[stop.bookingId]).reduce((sum, stop) => sum + stop.party, 0)
  const zoneName = (id: string) => sheet.zones.find((entry) => entry.id === id)?.name ?? 'Zone'

  if (sheet.stops.length === 0) {
    return (
      <EmptyState
        icon={Bus}
        title="No pickups today"
        description="Offer hotel pickup on an activity and set up zones in Settings. Guests who choose it appear here in collection order."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
          <Segmented
            label="Zone"
            value={zone}
            onValueChange={setZone}
            className="min-w-max"
            options={[
              { value: 'all', label: 'All zones', count: sheet.stops.length },
              ...sheet.zones
                .map((entry) => ({ value: entry.id, label: entry.name, count: sheet.stops.filter((stop) => stop.zoneId === entry.id).length }))
                .filter((entry) => entry.count > 0),
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-subtle tabular-nums">
            {aboard} of {guests} {pluralize(guests, 'guest')} collected
          </span>
          <Button variant="secondary" leftIcon={<Printer />} onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>

      <ol className="flex list-none flex-col gap-2 p-0">
        {visible.map((stop) => {
          const on = Boolean(collected[stop.bookingId])
          return (
            <li
              key={stop.bookingId}
              className={cn(
                'flex items-center gap-4 rounded-xl border px-4 py-3 print:break-inside-avoid',
                on ? 'border-success/40 bg-success-soft/40' : 'border-line bg-surface',
              )}
            >
              <div className="w-20 shrink-0">
                <p className="font-display text-lg font-semibold tabular-nums text-foreground">{formatTime(stop.time)}</p>
                <p className="text-xs text-subtle">{zoneName(stop.zoneId)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{stop.stop}</p>
                <p className="truncate text-sm text-muted">
                  {stop.guestName} <span className="text-subtle">×{stop.party}</span> · {stop.reference}
                </p>
                <p className="truncate text-xs text-subtle">
                  {stop.activityName} · departs {formatTime(stop.departureAt)}
                </p>
              </div>
              {stop.phone ? (
                <Button asChild variant="ghost" size="sm" className="print:hidden" aria-label={`Call ${stop.guestName}`}>
                  <a href={`tel:${stop.phone.replace(/[^\d+]/g, '')}`}>
                    <Phone className="size-4" aria-hidden="true" />
                  </a>
                </Button>
              ) : null}
              <label className="inline-flex shrink-0 items-center gap-2 text-sm font-medium text-muted">
                <Checkbox checked={on} onCheckedChange={(checked) => setCollected((current) => ({ ...current, [stop.bookingId]: checked === true }))} />
                On board
              </label>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
