'use client'

import * as React from 'react'
import { Check, Phone, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { hm } from '@/lib/hospitality/hours'
import type { DiningSettings, ServicePeriod } from '@/lib/hospitality/types'
import { cn, formatCurrency, formatDateShort } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import { Dot } from './shared'

/* ==========================================================================
   <HoursCapacity> — when the kitchen is open, and when orders run.

   Opening hours for breakfast, lunch and dinner; pickup and delivery
   windows with the delivery zones; room service for a hotel; closed days.
   No tables, no capacity: reservations are taken by phone. Saved locally
   in the demo; the card on the right shows today as the storefront tells it.
   ========================================================================== */

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface HoursCapacityProps {
  settings: DiningSettings
  currency: CurrencyCode
  todayKey: string
  /** "HH:MM" on the frozen clock. */
  nowTime: string
  /** Shown on the preview card: reservations are taken here. */
  phone: string
  /** Hotels can send orders up to rooms. */
  lodging: boolean
}

export function HoursCapacity({ settings: initial, currency, todayKey, nowTime, phone, lodging }: HoursCapacityProps) {
  const [settings, setSettings] = React.useState(initial)
  const [closureDate, setClosureDate] = React.useState('')
  const [closureReason, setClosureReason] = React.useState('')
  const dirty = JSON.stringify(settings) !== JSON.stringify(initial)

  const setPeriod = (id: string, change: (p: ServicePeriod) => ServicePeriod) => setSettings((s) => ({ ...s, periods: s.periods.map((p) => (p.id === id ? change(p) : p)) }))
  const setOrdering = (change: (o: DiningSettings['ordering']) => DiningSettings['ordering']) => setSettings((s) => ({ ...s, ordering: change(s.ordering) }))

  const save = () => toast.success('Hours saved', { description: 'The storefront and the order windows pick this up within a minute.' })

  const now = hm(nowTime)
  const weekday = new Date(`${todayKey}T12:00:00`).getDay()
  const room = settings.ordering.roomService

  const windowEditor = (kind: 'pickup' | 'delivery', title: string, leadLabel: string) => {
    const o = settings.ordering[kind]
    return (
      <div className="rounded-xl border border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[0.8125rem] text-foreground">{title}</p>
          <Switch size="sm" checked={o.enabled} onCheckedChange={(v) => setOrdering((x) => ({ ...x, [kind]: { ...x[kind], enabled: v } }))} aria-label={`${title} enabled`} />
        </div>
        <div className={cn('mt-3 grid grid-cols-3 gap-3', !o.enabled && 'opacity-50')}>
          <Field label="From">{(c) => <Input {...c} size="sm" type="time" value={o.startTime} disabled={!o.enabled} onChange={(e) => setOrdering((x) => ({ ...x, [kind]: { ...x[kind], startTime: e.target.value } }))} />}</Field>
          <Field label="Until">{(c) => <Input {...c} size="sm" type="time" value={o.endTime} disabled={!o.enabled} onChange={(e) => setOrdering((x) => ({ ...x, [kind]: { ...x[kind], endTime: e.target.value } }))} />}</Field>
          <Field label={leadLabel}>{(c) => <Input {...c} size="sm" type="number" inputMode="numeric" min={5} max={180} step={5} value={o.leadMinutes} disabled={!o.enabled} onChange={(e) => setOrdering((x) => ({ ...x, [kind]: { ...x[kind], leadMinutes: Number(e.target.value || 0) } }))} suffix="min" />}</Field>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-6">
        {/* ---------- services ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Opening hours</CardTitle>
            <CardDescription>When the kitchen serves breakfast, lunch and dinner. Shown on the storefront and printed on the menu.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-line-subtle">
            {settings.periods.map((p) => (
              <div key={p.id} className="grid gap-4 py-5 first:pt-0 last:pb-0 lg:grid-cols-[10rem_minmax(0,1fr)]">
                <div>
                  <p className="text-[0.8125rem] text-foreground">{p.name}</p>
                  <div className="mt-2 flex gap-1" role="group" aria-label={`${p.name} days`}>
                    {DAYS.map((d, i) => {
                      const on = p.weekdays.includes(i)
                      return (
                        <button key={i} type="button" aria-pressed={on} aria-label={DAY_NAMES[i]} onClick={() => setPeriod(p.id, (x) => ({ ...x, weekdays: on ? x.weekdays.filter((w) => w !== i) : [...x.weekdays, i].sort() }))} className={cn('grid size-7 place-items-center rounded-md text-xs transition-colors', on ? 'bg-foreground text-background' : 'bg-surface-sunken text-subtle hover:text-foreground')}>
                          {d}
                        </button>
                      )
                    })}
                  </div>
                  {p.weekdays.length < 7 ? <p className="mt-2 text-xs text-subtle">Closed {DAY_NAMES.filter((_, i) => !p.weekdays.includes(i)).join(', ')}</p> : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
                  <Field label="Opens">{(c) => <Input {...c} size="sm" type="time" value={p.startTime} onChange={(e) => setPeriod(p.id, (x) => ({ ...x, startTime: e.target.value }))} />}</Field>
                  <Field label="Closes">{(c) => <Input {...c} size="sm" type="time" value={p.endTime} onChange={(e) => setPeriod(p.id, (x) => ({ ...x, endTime: e.target.value }))} />}</Field>
                  <Field label="Last orders" description="Kitchen closes; printed on the menu.">{(c) => <Input {...c} size="sm" type="time" value={p.lastOrders} onChange={(e) => setPeriod(p.id, (x) => ({ ...x, lastOrders: e.target.value }))} />}</Field>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ---------- ordering ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{lodging ? 'Room service, pickup and delivery' : 'Pickup and delivery'}</CardTitle>
            <CardDescription>The windows the storefront takes orders in, and where you deliver.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {lodging ? (
              <div className="rounded-xl border border-line p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[0.8125rem] text-foreground">Room service</p>
                    <p className="text-xs text-subtle">Guests order from the menu to their room; the ticket carries the room number and charges to the folio.</p>
                  </div>
                  <Switch size="sm" checked={room.enabled} onCheckedChange={(v) => setOrdering((x) => ({ ...x, roomService: { ...x.roomService, enabled: v } }))} aria-label="Room service enabled" />
                </div>
                <div className={cn('mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4', !room.enabled && 'opacity-50')}>
                  <Field label="From">{(c) => <Input {...c} size="sm" type="time" value={room.startTime} disabled={!room.enabled} onChange={(e) => setOrdering((x) => ({ ...x, roomService: { ...x.roomService, startTime: e.target.value } }))} />}</Field>
                  <Field label="Until">{(c) => <Input {...c} size="sm" type="time" value={room.endTime} disabled={!room.enabled} onChange={(e) => setOrdering((x) => ({ ...x, roomService: { ...x.roomService, endTime: e.target.value } }))} />}</Field>
                  <Field label="Up in">{(c) => <Input {...c} size="sm" type="number" inputMode="numeric" min={5} max={120} step={5} value={room.leadMinutes} disabled={!room.enabled} onChange={(e) => setOrdering((x) => ({ ...x, roomService: { ...x.roomService, leadMinutes: Number(e.target.value || 0) } }))} suffix="min" />}</Field>
                  <Field label="Tray charge">{(c) => <Input {...c} size="sm" type="number" inputMode="decimal" min={0} step={0.5} value={room.trayCharge / 100} disabled={!room.enabled} onChange={(e) => setOrdering((x) => ({ ...x, roomService: { ...x.roomService, trayCharge: Math.round(Number(e.target.value || 0) * 100) } }))} suffix={currency} />}</Field>
                </div>
              </div>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-2">
              {windowEditor('pickup', 'Pickup', 'Ready in')}
              {windowEditor('delivery', 'Delivery', 'Cooking time')}
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-[0.8125rem] text-foreground">Delivery zones</p>
                <Button size="xs" variant="outline" leftIcon={<Plus />} onClick={() => setOrdering((x) => ({ ...x, delivery: { ...x.delivery, zones: [...x.delivery.zones, { id: `zone_${Date.now().toString(36)}`, name: 'New zone', fee: 300, minOrder: 2000, minutes: 30 }] } }))}>
                  Add zone
                </Button>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-[0.8125rem]">
                  <thead>
                    <tr className="text-left text-xs text-subtle">
                      <th className="pb-2 font-medium">Zone</th>
                      <th className="pb-2 font-medium">Fee</th>
                      <th className="pb-2 font-medium">Minimum order</th>
                      <th className="pb-2 font-medium">Door to door</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {settings.ordering.delivery.zones.map((z) => (
                      <tr key={z.id}>
                        <td className="py-2 pr-3">
                          <Input size="sm" value={z.name} onChange={(e) => setOrdering((x) => ({ ...x, delivery: { ...x.delivery, zones: x.delivery.zones.map((y) => (y.id === z.id ? { ...y, name: e.target.value } : y)) } }))} aria-label="Zone name" />
                        </td>
                        <td className="py-2 pr-3">
                          <Input size="sm" type="number" inputMode="decimal" step={0.5} min={0} value={z.fee / 100} onChange={(e) => setOrdering((x) => ({ ...x, delivery: { ...x.delivery, zones: x.delivery.zones.map((y) => (y.id === z.id ? { ...y, fee: Math.round(Number(e.target.value || 0) * 100) } : y)) } }))} suffix={currency} aria-label="Fee" className="w-28" />
                        </td>
                        <td className="py-2 pr-3">
                          <Input size="sm" type="number" inputMode="decimal" step={1} min={0} value={z.minOrder / 100} onChange={(e) => setOrdering((x) => ({ ...x, delivery: { ...x.delivery, zones: x.delivery.zones.map((y) => (y.id === z.id ? { ...y, minOrder: Math.round(Number(e.target.value || 0) * 100) } : y)) } }))} suffix={currency} aria-label="Minimum order" className="w-28" />
                        </td>
                        <td className="py-2 pr-3">
                          <Input size="sm" type="number" inputMode="numeric" step={5} min={5} value={z.minutes} onChange={(e) => setOrdering((x) => ({ ...x, delivery: { ...x.delivery, zones: x.delivery.zones.map((y) => (y.id === z.id ? { ...y, minutes: Number(e.target.value || 0) } : y)) } }))} suffix="min" aria-label="Minutes" className="w-28" />
                        </td>
                        <td className="py-2 text-right">
                          <IconButton size="xs" variant="ghost" aria-label={`Remove ${z.name}`} onClick={() => setOrdering((x) => ({ ...x, delivery: { ...x.delivery, zones: x.delivery.zones.filter((y) => y.id !== z.id) } }))}>
                            <Trash2 />
                          </IconButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ---------- closures ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Closed days</CardTitle>
            <CardDescription>No orders are taken on these dates and the storefront says so.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {settings.closures.length ? (
              <ul className="divide-y divide-line-subtle">
                {settings.closures.map((c) => (
                  <li key={c.date} className="flex items-center gap-3 py-2 text-[0.8125rem]">
                    <span className="w-24 shrink-0 text-foreground tabular-nums">{formatDateShort(`${c.date}T12:00:00`)}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{c.reason}</span>
                    <IconButton size="xs" variant="ghost" aria-label={`Remove closure on ${c.date}`} onClick={() => setSettings((s) => ({ ...s, closures: s.closures.filter((x) => x.date !== c.date) }))}>
                      <Trash2 />
                    </IconButton>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[0.8125rem] text-subtle">No closures planned.</p>
            )}
            <div className="flex flex-wrap items-end gap-2">
              <Input size="sm" type="date" min={todayKey} value={closureDate} onChange={(e) => setClosureDate(e.target.value)} aria-label="Closure date" className="w-40" />
              <Input size="sm" value={closureReason} onChange={(e) => setClosureReason(e.target.value)} placeholder="Reason" aria-label="Closure reason" className="w-56" />
              <Button
                size="sm"
                variant="outline"
                leftIcon={<Plus />}
                disabled={!closureDate}
                onClick={() => {
                  setSettings((s) => ({ ...s, closures: [...s.closures.filter((c) => c.date !== closureDate), { date: closureDate, reason: closureReason.trim() || 'Closed' }].sort((a, b) => a.date.localeCompare(b.date)) }))
                  setClosureDate('')
                  setClosureReason('')
                }}
              >
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className={cn('sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur transition-opacity', dirty ? 'opacity-100' : 'pointer-events-none opacity-0')} aria-hidden={!dirty}>
          <span className="text-[0.8125rem] text-muted">Unsaved changes</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSettings(initial)}>
              Discard
            </Button>
            <Button size="sm" leftIcon={<Check />} onClick={save}>
              Save
            </Button>
          </div>
        </div>
      </div>

      {/* ---------- preview ---------- */}
      <div className="flex flex-col gap-4">
        <Card className="h-fit xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle className="text-sm">Today on the storefront</CardTitle>
            <CardDescription>
              {DAY_NAMES[weekday]} · {nowTime}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2 text-[0.8125rem]">
              {settings.periods.map((p) => {
                const open = p.weekdays.includes(weekday)
                const state = !open ? 'Closed today' : now < hm(p.startTime) ? `Opens ${p.startTime}` : now < hm(p.endTime) ? `Until ${p.endTime}` : 'Finished'
                const tone = !open || now >= hm(p.endTime) ? 'bg-line-strong' : now < hm(p.startTime) ? 'bg-info' : 'bg-success'
                return (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-foreground">
                      <Dot tone={tone} />
                      {p.name}
                    </span>
                    <span className="text-muted tabular-nums">{state}</span>
                  </li>
                )
              })}
            </ul>
            <dl className="flex flex-col gap-1.5 border-t border-line-subtle pt-3 text-xs text-muted">
              {lodging ? (
                <div className="flex justify-between gap-3">
                  <dt>Room service</dt>
                  <dd className="text-foreground tabular-nums">{room.enabled ? `${room.startTime}–${room.endTime} · up in ${room.leadMinutes} min` : 'Off'}</dd>
                </div>
              ) : null}
              <div className="flex justify-between gap-3">
                <dt>Pickup</dt>
                <dd className="text-foreground tabular-nums">{settings.ordering.pickup.enabled ? `${settings.ordering.pickup.startTime}–${settings.ordering.pickup.endTime} · ready in ${settings.ordering.pickup.leadMinutes} min` : 'Off'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Delivery</dt>
                <dd className="text-foreground tabular-nums">{settings.ordering.delivery.enabled ? `${settings.ordering.delivery.startTime}–${settings.ordering.delivery.endTime} · ${settings.ordering.delivery.zones.length} zones` : 'Off'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Tables</dt>
                <dd className="inline-flex items-center gap-1.5 text-foreground">
                  <Phone className="size-3" aria-hidden="true" />
                  By phone · {phone}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-subtle">Guests see these hours in the menu header and in the footer, and the order buttons switch off outside the windows.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
