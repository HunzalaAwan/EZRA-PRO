'use client'

import * as React from 'react'
import Link from 'next/link'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { PickupPrice } from '@/types'

/* ==========================================================================
   Hotel pickup for one activity: on or off, which zones, what pickup from
   each zone costs (free, per guest or per booking), and whether every
   guest is collected.
   ========================================================================== */

export interface PickupZoneOption {
  id: string
  name: string
  detail: string
  /** The zone's own fee per guest, minor units; the starting price here. */
  fee: number
}

export interface DraftPickup {
  enabled: boolean
  zoneIds: string[]
  required: boolean
  /** Price per zone; a zone missing here starts at its own fee per guest. */
  prices?: Record<string, PickupPrice>
}

/** The price a zone has on this activity, falling back to the zone's own fee. */
export const priceFor = (value: DraftPickup, zone: PickupZoneOption): PickupPrice => value.prices?.[zone.id] ?? { fee: zone.fee, per: 'guest' }

const money = (minor: number, symbol: string) => `${symbol}${(minor / 100).toFixed(minor % 100 === 0 ? 0 : 2)}`

export function PickupEditor({
  value,
  onChange,
  zones,
  currencySymbol = '$',
}: {
  value: DraftPickup
  onChange: (value: DraftPickup) => void
  zones: PickupZoneOption[]
  currencySymbol?: string
}) {
  const setPrice = (zone: PickupZoneOption, patch: Partial<PickupPrice>) =>
    onChange({ ...value, prices: { ...value.prices, [zone.id]: { ...priceFor(value, zone), ...patch } } })
  const chosen = zones.filter((zone) => value.zoneIds.includes(zone.id))
  const summary = chosen.map((zone) => {
    const price = priceFor(value, zone)
    return `${zone.name} ${price.fee > 0 ? `${money(price.fee, currencySymbol)} per ${price.per}` : 'free'}`
  })
  return (
    <Card>
      <CardHeader className="flex flex-col items-start gap-1">
        <CardTitle>Hotel pickup</CardTitle>
        <CardDescription>Guests pick their hotel at checkout and get a pickup time; the driver gets a run sheet.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
          <span>
            <span className="block text-sm font-medium">Offer pickup</span>
            <span className="block text-xs text-subtle">Guests can still meet you there unless pickup is the only way.</span>
          </span>
          <Switch
            checked={value.enabled}
            onCheckedChange={(checked) => onChange({ ...value, enabled: checked, zoneIds: checked && value.zoneIds.length === 0 ? zones.map((zone) => zone.id) : value.zoneIds })}
            aria-label="Offer pickup"
          />
        </label>
        {value.enabled ? (
          <>
            {zones.length === 0 ? (
              <p className="text-sm text-subtle">
                No zones yet. <Link href="/dashboard/settings/pickup" className="font-medium text-primary hover:underline">Set up pickup zones</Link>
              </p>
            ) : (
              <>
              <ul className="grid list-none gap-2 p-0 sm:grid-cols-2">
                {zones.map((zone) => {
                  const on = value.zoneIds.includes(zone.id)
                  const price = priceFor(value, zone)
                  const paid = price.fee > 0
                  return (
                    <li key={zone.id} className={cn('rounded-xl border px-3.5 py-3 transition-colors', on ? 'border-primary/40 bg-primary-soft/20' : 'border-line')}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <Checkbox
                          checked={on}
                          className="mt-0.5"
                          onCheckedChange={(checked) =>
                            onChange({ ...value, zoneIds: checked === true ? [...value.zoneIds, zone.id] : value.zoneIds.filter((id) => id !== zone.id) })
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-medium">{zone.name}</span>
                            {on ? (
                              <span className={cn('shrink-0 text-xs font-semibold tabular-nums', paid ? 'text-foreground' : 'text-success')}>
                                {paid ? `${money(price.fee, currencySymbol)} / ${price.per}` : 'Free'}
                              </span>
                            ) : null}
                          </span>
                          <span className="block text-xs text-subtle">{zone.detail}</span>
                        </span>
                      </label>
                      {on ? (
                        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line-subtle pt-3 pl-7">
                          <div className="inline-flex rounded-lg border border-line bg-surface p-0.5" role="radiogroup" aria-label={`Pickup price for ${zone.name}`}>
                            {[false, true].map((charge) => (
                              <button
                                key={String(charge)}
                                type="button"
                                role="radio"
                                aria-checked={paid === charge}
                                onClick={() => setPrice(zone, { fee: charge ? (price.fee > 0 ? price.fee : zone.fee > 0 ? zone.fee : 1500) : 0 })}
                                className={cn(
                                  'rounded-md px-2.5 py-1 text-xs font-semibold transition-colors',
                                  paid === charge ? 'bg-primary text-on-primary' : 'text-muted hover:text-foreground',
                                )}
                              >
                                {charge ? 'Charge' : 'Free'}
                              </button>
                            ))}
                          </div>
                          {paid ? (
                            <>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm text-muted">{currencySymbol}</span>
                                <Input
                                  type="number"
                                  size="sm"
                                  min={0}
                                  step={1}
                                  className="w-20"
                                  aria-label={`Pickup price from ${zone.name}`}
                                  value={price.fee / 100 || ''}
                                  onChange={(event) => setPrice(zone, { fee: Math.max(0, Math.round(Number(event.target.value) * 100) || 0) })}
                                />
                              </div>
                              <Select value={price.per} onValueChange={(per) => setPrice(zone, { per: per as PickupPrice['per'] })}>
                                <SelectTrigger size="sm" className="w-32" aria-label={`How the ${zone.name} price is counted`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="guest">per guest</SelectItem>
                                  <SelectItem value="booking">per booking</SelectItem>
                                </SelectContent>
                              </Select>
                            </>
                          ) : (
                            <span className="text-xs text-subtle">Included in the price</span>
                          )}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
              {summary.length > 0 ? (
                <p className="text-xs text-muted">
                  <span className="font-medium text-foreground">Guests see at checkout:</span> {summary.join(' · ')}
                </p>
              ) : null}
              </>
            )}
            <label className="inline-flex items-center gap-2 text-sm text-muted">
              <Switch size="sm" checked={value.required} onCheckedChange={(checked) => onChange({ ...value, required: checked })} />
              Pickup is the only way to join
            </label>
            <Link href="/dashboard/settings/pickup" className="text-xs font-medium text-primary hover:underline">
              Manage pickup zones
            </Link>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
