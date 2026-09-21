'use client'

import * as React from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { hm, seatingTimes } from '@/lib/hospitality/floor'
import type { DiningSettings, ServicePeriod } from '@/lib/hospitality/types'
import { cn, formatCurrency, formatDateShort } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   <HoursCapacity> — when you are open, how many you can seat, and how the
   online book behaves. Saved locally in the demo; the preview on the right
   shows tonight exactly as a guest would see it.
   ========================================================================== */

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface HoursCapacityProps {
  settings: DiningSettings
  currency: CurrencyCode
  todayKey: string
  /** Seats in the room, for the capacity line. */
  seats: number
}

export function HoursCapacity({ settings: initial, currency, todayKey, seats }: HoursCapacityProps) {
  const [settings, setSettings] = React.useState(initial)
  const [closureDate, setClosureDate] = React.useState('')
  const [closureReason, setClosureReason] = React.useState('')
  const dirty = JSON.stringify(settings) !== JSON.stringify(initial)

  const setPeriod = (id: string, change: (p: ServicePeriod) => ServicePeriod) => setSettings((s) => ({ ...s, periods: s.periods.map((p) => (p.id === id ? change(p) : p)) }))
  const setOrdering = (change: (o: DiningSettings['ordering']) => DiningSettings['ordering']) => setSettings((s) => ({ ...s, ordering: change(s.ordering) }))

  const save = () => {
    toast.success('Hours and capacity saved', { description: 'The storefront and the QR card pick this up within a minute.' })
  }

  const tonight = settings.periods[settings.periods.length - 1]
  const previewSlots = seatingTimes(tonight)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-6">
        {/* ---------- services ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Services</CardTitle>
            <CardDescription>Each service has its own hours, last seating and turn times. Online bookings only land inside these windows.</CardDescription>
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
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Opens">{(c) => <Input {...c} size="sm" type="time" value={p.startTime} onChange={(e) => setPeriod(p.id, (x) => ({ ...x, startTime: e.target.value }))} />}</Field>
                  <Field label="Last seating">{(c) => <Input {...c} size="sm" type="time" value={p.lastSeating} onChange={(e) => setPeriod(p.id, (x) => ({ ...x, lastSeating: e.target.value }))} />}</Field>
                  <Field label="Closes">{(c) => <Input {...c} size="sm" type="time" value={p.endTime} onChange={(e) => setPeriod(p.id, (x) => ({ ...x, endTime: e.target.value }))} />}</Field>
                  <Field label="Table held for" description="1–2 · 3–4 · 5–6 · 7+ guests" className="sm:col-span-3">
                    <div className="grid grid-cols-4 gap-2">
                      {(['upTo2', 'upTo4', 'upTo6', 'larger'] as const).map((band) => (
                        <Input key={band} size="sm" type="number" inputMode="numeric" min={30} max={240} step={15} value={p.turnMinutes[band]} onChange={(e) => setPeriod(p.id, (x) => ({ ...x, turnMinutes: { ...x.turnMinutes, [band]: Number(e.target.value || 0) } }))} suffix="min" aria-label={`Turn time ${band}`} />
                      ))}
                    </div>
                  </Field>
                  <Field label="Online covers per slot" description={`${p.slotMinutes}-minute slots`}>
                    {(c) => <Input {...c} size="sm" type="number" inputMode="numeric" min={0} max={seats} value={p.maxCoversPerSlot} onChange={(e) => setPeriod(p.id, (x) => ({ ...x, maxCoversPerSlot: Number(e.target.value || 0) }))} />}
                  </Field>
                  <Field label="Slot interval" className="sm:col-span-2">
                    <Segmented
                      size="sm"
                      label={`${p.name} slot interval`}
                      options={[
                        { value: '15', label: 'Every 15 min' },
                        { value: '30', label: 'Every 30 min' },
                      ]}
                      value={String(p.slotMinutes)}
                      onValueChange={(v) => setPeriod(p.id, (x) => ({ ...x, slotMinutes: Number(v) as 15 | 30 }))}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ---------- online booking rules ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Online booking</CardTitle>
            <CardDescription>What the storefront lets a guest do without calling.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Largest party online" description="Bigger parties are asked to call.">
              {(c) => <Input {...c} size="sm" type="number" inputMode="numeric" min={1} max={30} value={settings.maxOnlineParty} onChange={(e) => setSettings((s) => ({ ...s, maxOnlineParty: Number(e.target.value || 0) }))} />}
            </Field>
            <Field label="Deposit from party of">
              {(c) => <Input {...c} size="sm" type="number" inputMode="numeric" min={1} max={30} value={settings.depositFromParty} onChange={(e) => setSettings((s) => ({ ...s, depositFromParty: Number(e.target.value || 0) }))} />}
            </Field>
            <Field label="Deposit per cover" description="Charged for no-shows, refunded otherwise.">
              {(c) => <Input {...c} size="sm" type="number" inputMode="decimal" min={0} step={5} value={settings.depositPerCover / 100} onChange={(e) => setSettings((s) => ({ ...s, depositPerCover: Math.round(Number(e.target.value || 0) * 100) }))} suffix={currency} />}
            </Field>
            <Field label="Hold a late table for" description="Then it goes back to walk-ins.">
              {(c) => <Input {...c} size="sm" type="number" inputMode="numeric" min={0} max={60} step={5} value={settings.graceMinutes} onChange={(e) => setSettings((s) => ({ ...s, graceMinutes: Number(e.target.value || 0) }))} suffix="min" />}
            </Field>
          </CardContent>
        </Card>

        {/* ---------- ordering ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pickup and delivery</CardTitle>
            <CardDescription>The windows the storefront takes orders in, and where you deliver.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid gap-4 lg:grid-cols-2">
              {(['pickup', 'delivery'] as const).map((kind) => {
                const o = settings.ordering[kind]
                return (
                  <div key={kind} className="rounded-xl border border-line p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[0.8125rem] text-foreground">{kind === 'pickup' ? 'Pickup' : 'Delivery'}</p>
                      <Switch size="sm" checked={o.enabled} onCheckedChange={(v) => setOrdering((x) => ({ ...x, [kind]: { ...x[kind], enabled: v } }))} aria-label={`${kind} enabled`} />
                    </div>
                    <div className={cn('mt-3 grid grid-cols-3 gap-3', !o.enabled && 'opacity-50')}>
                      <Field label="From">{(c) => <Input {...c} size="sm" type="time" value={o.startTime} disabled={!o.enabled} onChange={(e) => setOrdering((x) => ({ ...x, [kind]: { ...x[kind], startTime: e.target.value } }))} />}</Field>
                      <Field label="Until">{(c) => <Input {...c} size="sm" type="time" value={o.endTime} disabled={!o.enabled} onChange={(e) => setOrdering((x) => ({ ...x, [kind]: { ...x[kind], endTime: e.target.value } }))} />}</Field>
                      <Field label="Lead time">{(c) => <Input {...c} size="sm" type="number" inputMode="numeric" min={5} max={180} step={5} value={o.leadMinutes} disabled={!o.enabled} onChange={(e) => setOrdering((x) => ({ ...x, [kind]: { ...x[kind], leadMinutes: Number(e.target.value || 0) } }))} suffix="min" />}</Field>
                    </div>
                  </div>
                )
              })}
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

            <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-sunken px-3 py-2.5">
              <div>
                <p className="text-[0.8125rem] text-foreground">Ordering from the table</p>
                <p className="text-xs text-subtle">A QR card on each table opens the dine-in menu; orders land on the pass with the table name.</p>
              </div>
              <Switch size="sm" checked={settings.ordering.dineIn.enabled} onCheckedChange={(v) => setOrdering((x) => ({ ...x, dineIn: { enabled: v } }))} aria-label="QR ordering" />
            </div>
          </CardContent>
        </Card>

        {/* ---------- closures ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Closed days</CardTitle>
            <CardDescription>Nothing can be booked or ordered on these dates. Existing reservations are flagged for you to call.</CardDescription>
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
            <CardTitle className="text-sm">What a guest sees tonight</CardTitle>
            <CardDescription>
              {tonight.name} · {DAY_NAMES[new Date(`${todayKey}T12:00:00`).getDay()]}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-1.5">
              {previewSlots.map((t) => {
                const full = hm(t) >= hm(tonight.lastSeating) - 45 && hm(t) < hm(tonight.lastSeating) - 15
                return (
                  <span key={t} className={cn('rounded-md border px-1.5 py-1.5 text-center text-xs tabular-nums', full ? 'border-line-subtle text-faint line-through' : 'border-line text-foreground')}>
                    {t}
                  </span>
                )
              })}
            </div>
            <dl className="flex flex-col gap-1.5 text-xs text-muted">
              <div className="flex justify-between gap-3">
                <dt>Parties online</dt>
                <dd className="text-foreground tabular-nums">1–{settings.maxOnlineParty}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Deposit</dt>
                <dd className="text-foreground tabular-nums">
                  {formatCurrency(settings.depositPerCover, currency)} per cover from {settings.depositFromParty}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Room</dt>
                <dd className="text-foreground tabular-nums">{seats} seats</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Covers per slot</dt>
                <dd className="text-foreground tabular-nums">{tonight.maxCoversPerSlot}</dd>
              </div>
            </dl>
            <p className="text-xs text-subtle">A struck-through time means that slot is already at its online limit; the phone can still take it.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
