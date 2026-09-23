'use client'

import * as React from 'react'
import Link from 'next/link'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/* ==========================================================================
   Hotel pickup for one activity: on or off, which zones, and whether every
   guest is collected.
   ========================================================================== */

export interface PickupZoneOption {
  id: string
  name: string
  detail: string
}

export interface DraftPickup {
  enabled: boolean
  zoneIds: string[]
  required: boolean
}

export function PickupEditor({ value, onChange, zones }: { value: DraftPickup; onChange: (value: DraftPickup) => void; zones: PickupZoneOption[] }) {
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
              <ul className="grid list-none gap-2 p-0 sm:grid-cols-2">
                {zones.map((zone) => {
                  const on = value.zoneIds.includes(zone.id)
                  return (
                    <li key={zone.id}>
                      <label className={cn('flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3', on ? 'border-primary/40 bg-primary-soft/20' : 'border-line')}>
                        <Checkbox
                          checked={on}
                          className="mt-0.5"
                          onCheckedChange={(checked) =>
                            onChange({ ...value, zoneIds: checked === true ? [...value.zoneIds, zone.id] : value.zoneIds.filter((id) => id !== zone.id) })
                          }
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">{zone.name}</span>
                          <span className="block text-xs text-subtle">{zone.detail}</span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
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
