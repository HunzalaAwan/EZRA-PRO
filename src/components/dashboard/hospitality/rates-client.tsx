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
import { nightlyRate, seasonMultiplier } from '@/lib/hospitality/lodging-settings'
import type { LodgingSettings, RatePlan, RoomType } from '@/lib/hospitality/types'
import { addDays, cn, formatCurrency, fromDateKey, toDateKey } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import { StatTile } from './shared'

/* ==========================================================================
   <RatesClient> — what a night costs and how many are left.

   The grid is the next fourteen nights across, room types down: the
   flexible rate and the rooms still free. Under it, the levers the grid is
   built from: base rates, seasons, plans, extras and the house rules.
   ========================================================================== */

const DAYS = 14
const WEEKDAY = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export interface OccupancyCell {
  roomTypeId: string
  /** "YYYY-MM-DD" */
  night: string
  booked: number
}

export interface RatesClientProps {
  roomTypes: RoomType[]
  /** Sellable rooms per type. */
  roomCounts: Record<string, number>
  settings: LodgingSettings
  /** Booked rooms per type per night for the grid window. */
  occupancy: OccupancyCell[]
  currency: CurrencyCode
  todayKey: string
}

export function RatesClient({ roomTypes: initialTypes, roomCounts, settings: initialSettings, occupancy, currency, todayKey }: RatesClientProps) {
  const [roomTypes, setRoomTypes] = React.useState(initialTypes)
  const [settings, setSettings] = React.useState(initialSettings)
  const [planId, setPlanId] = React.useState(settings.ratePlans[0]?.id ?? '')
  const dirty = JSON.stringify(settings) !== JSON.stringify(initialSettings) || JSON.stringify(roomTypes) !== JSON.stringify(initialTypes)

  const plan = settings.ratePlans.find((p) => p.id === planId) ?? settings.ratePlans[0]
  const nights = Array.from({ length: DAYS }, (_, i) => toDateKey(addDays(fromDateKey(todayKey), i)))
  const booked = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const c of occupancy) map.set(`${c.roomTypeId}:${c.night}`, c.booked)
    return map
  }, [occupancy])

  const totalRooms = Object.values(roomCounts).reduce((s, n) => s + n, 0)
  const weekOcc = React.useMemo(() => {
    let b = 0
    for (const t of roomTypes) for (const n of nights.slice(0, 7)) b += booked.get(`${t.id}:${n}`) ?? 0
    return totalRooms ? Math.round((b / (totalRooms * 7)) * 100) : 0
  }, [roomTypes, nights, booked, totalRooms])
  const season = settings.seasons.find((s) => todayKey >= s.startDate && todayKey <= s.endDate)
  const lowest = Math.min(...roomTypes.map((t) => nightlyRate(t, settings.ratePlans[0], todayKey, settings)))

  const setType = (id: string, change: (t: RoomType) => RoomType) => setRoomTypes((c) => c.map((t) => (t.id === id ? change(t) : t)))
  const setPlan = (id: string, change: (p: RatePlan) => RatePlan) => setSettings((s) => ({ ...s, ratePlans: s.ratePlans.map((p) => (p.id === id ? change(p) : p)) }))

  const save = () => toast.success('Rates saved', { description: 'The storefront and your connected channels update within a few minutes.' })

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="From tonight" hint="lowest flexible rate" value={formatCurrency(lowest, currency)} line={`${roomTypes.length} room types`} />
        <StatTile label="Season" hint="now" value={season ? `×${season.multiplier}` : '×1'} line={season ? `${season.name} · until ${season.endDate.slice(5).replace('-', '/')}` : 'No season set'} tone="bg-info" />
        <StatTile label="Next 7 nights" hint="booked" value={`${weekOcc}%`} line={`${totalRooms} rooms in sale`} tone="bg-success" />
        <StatTile label="Rate plans" hint="on sale" value={settings.ratePlans.length} line={settings.ratePlans.map((p) => p.name).join(' · ')} />
      </div>

      {/* ---------- grid ---------- */}
      <Card>
        <div className="flex flex-col gap-3 border-b border-line-subtle px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <Segmented size="sm" label="Rate plan" options={settings.ratePlans.map((p) => ({ value: p.id, label: p.name }))} value={plan?.id ?? ''} onValueChange={setPlanId} />
          <p className="text-xs text-subtle">Rate per night and rooms left. Fridays and Saturdays carry a 12% premium.</p>
        </div>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[64rem] text-[0.8125rem]">
            <thead>
              <tr className="text-left text-xs text-subtle">
                <th className="sticky left-0 bg-surface px-4 py-2 font-medium">Room type</th>
                {nights.map((n) => {
                  const d = fromDateKey(n)
                  const weekend = d.getDay() === 5 || d.getDay() === 6
                  return (
                    <th key={n} className={cn('px-2 py-2 text-center font-medium tabular-nums', n === todayKey && 'text-primary', weekend && 'bg-surface-sunken/60')}>
                      {WEEKDAY[d.getDay()]} {d.getDate()}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {roomTypes.map((t) => (
                <tr key={t.id}>
                  <td className="sticky left-0 bg-surface px-4 py-2">
                    <div className="flex items-center gap-3">
                      <span className="min-w-[7rem] text-foreground">{t.name}</span>
                      <Input size="sm" type="number" inputMode="decimal" step={5} min={0} value={t.baseRate / 100} onChange={(e) => setType(t.id, (x) => ({ ...x, baseRate: Math.round(Number(e.target.value || 0) * 100) }))} suffix={currency} aria-label={`${t.name} base rate`} className="w-32" />
                    </div>
                  </td>
                  {nights.map((n) => {
                    const total = roomCounts[t.id] ?? t.count
                    const left = Math.max(0, total - (booked.get(`${t.id}:${n}`) ?? 0))
                    const d = fromDateKey(n)
                    const weekend = d.getDay() === 5 || d.getDay() === 6
                    return (
                      <td key={n} className={cn('px-2 py-2 text-center', weekend && 'bg-surface-sunken/60')}>
                        <span className="block text-foreground tabular-nums">{plan ? formatCurrency(nightlyRate(t, plan, n, settings), currency) : '—'}</span>
                        <span className={cn('block text-xs tabular-nums', left === 0 ? 'text-danger' : left <= 2 ? 'text-warning' : 'text-subtle')}>{left === 0 ? 'full' : `${left} left`}</span>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---------- seasons ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Seasons</CardTitle>
            <CardDescription>Multiply the base rate between two dates. Gaps fall back to ×1.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {settings.seasons.map((s) => (
              <div key={s.id} className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_5rem_auto] items-end gap-2">
                <Input size="sm" value={s.name} onChange={(e) => setSettings((x) => ({ ...x, seasons: x.seasons.map((y) => (y.id === s.id ? { ...y, name: e.target.value } : y)) }))} aria-label="Season name" />
                <Input size="sm" type="date" value={s.startDate} onChange={(e) => setSettings((x) => ({ ...x, seasons: x.seasons.map((y) => (y.id === s.id ? { ...y, startDate: e.target.value } : y)) }))} aria-label="Season start" />
                <Input size="sm" type="date" value={s.endDate} onChange={(e) => setSettings((x) => ({ ...x, seasons: x.seasons.map((y) => (y.id === s.id ? { ...y, endDate: e.target.value } : y)) }))} aria-label="Season end" />
                <Input size="sm" type="number" inputMode="decimal" step={0.05} min={0.3} max={3} value={s.multiplier} onChange={(e) => setSettings((x) => ({ ...x, seasons: x.seasons.map((y) => (y.id === s.id ? { ...y, multiplier: Number(e.target.value || 1) } : y)) }))} aria-label="Multiplier" leftIcon={<span className="text-xs text-subtle">×</span>} />
                <IconButton size="xs" variant="ghost" aria-label={`Remove ${s.name}`} onClick={() => setSettings((x) => ({ ...x, seasons: x.seasons.filter((y) => y.id !== s.id) }))}>
                  <Trash2 />
                </IconButton>
              </div>
            ))}
            <Button size="xs" variant="outline" leftIcon={<Plus />} className="self-start" onClick={() => setSettings((x) => ({ ...x, seasons: [...x.seasons, { id: `ssn_${Date.now().toString(36)}`, name: 'New season', startDate: todayKey, endDate: toDateKey(addDays(fromDateKey(todayKey), 30)), multiplier: 1 }] }))}>
              Add season
            </Button>
            <p className="text-xs text-subtle">Today is {season ? `${season.name} (×${seasonMultiplier(todayKey, settings)})` : 'outside every season (×1)'}.</p>
          </CardContent>
        </Card>

        {/* ---------- plans ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Rate plans</CardTitle>
            <CardDescription>The choices a guest sees under each room. A multiplier on the seasonal rate.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col divide-y divide-line-subtle">
            {settings.ratePlans.map((p) => (
              <div key={p.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_6rem_5rem]">
                <div className="flex flex-col gap-2">
                  <Input size="sm" value={p.name} onChange={(e) => setPlan(p.id, (x) => ({ ...x, name: e.target.value }))} aria-label="Plan name" />
                  <Input size="sm" value={p.cancellation} onChange={(e) => setPlan(p.id, (x) => ({ ...x, cancellation: e.target.value }))} aria-label="Cancellation terms" />
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <Switch size="sm" checked={p.breakfastIncluded} onCheckedChange={(v) => setPlan(p.id, (x) => ({ ...x, breakfastIncluded: v }))} aria-label="Breakfast included" />
                    Breakfast included
                  </label>
                </div>
                <Field label="Rate">{(c) => <Input {...c} size="sm" type="number" inputMode="decimal" step={0.01} min={0.3} max={2} value={p.multiplier} onChange={(e) => setPlan(p.id, (x) => ({ ...x, multiplier: Number(e.target.value || 1) }))} leftIcon={<span className="text-xs text-subtle">×</span>} />}</Field>
                <Field label="Min nights">{(c) => <Input {...c} size="sm" type="number" inputMode="numeric" min={1} max={14} value={p.minNights} onChange={(e) => setPlan(p.id, (x) => ({ ...x, minNights: Number(e.target.value || 1) }))} />}</Field>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ---------- extras ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Extras</CardTitle>
            <CardDescription>Offered at booking and at the desk.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {settings.extras.map((e) => (
              <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_7rem_6rem] items-center gap-2 text-[0.8125rem]">
                <span className="truncate text-foreground">{e.label}</span>
                <Input size="sm" type="number" inputMode="decimal" step={1} min={0} value={e.price / 100} onChange={(ev) => setSettings((x) => ({ ...x, extras: x.extras.map((y) => (y.id === e.id ? { ...y, price: Math.round(Number(ev.target.value || 0) * 100) } : y)) }))} suffix={currency} aria-label={`${e.label} price`} />
                <span className="text-xs text-subtle">{e.per === 'person' ? 'per person, per night' : e.per === 'night' ? 'per night' : 'per stay'}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* ---------- house rules ---------- */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">House rules</CardTitle>
            <CardDescription>Shown on the storefront and in every confirmation.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Check-in from">{(c) => <Input {...c} size="sm" type="time" value={settings.checkInFrom} onChange={(e) => setSettings((x) => ({ ...x, checkInFrom: e.target.value }))} />}</Field>
            <Field label="Check-out by">{(c) => <Input {...c} size="sm" type="time" value={settings.checkOutBy} onChange={(e) => setSettings((x) => ({ ...x, checkOutBy: e.target.value }))} />}</Field>
            <Field label={settings.cityTaxLabel} description="Per adult, per night, up to 7 nights.">{(c) => <Input {...c} size="sm" type="number" inputMode="decimal" step={0.5} min={0} value={settings.cityTaxPerNight / 100} onChange={(e) => setSettings((x) => ({ ...x, cityTaxPerNight: Math.round(Number(e.target.value || 0) * 100) }))} suffix={currency} />}</Field>
            <Field label="Minimum stay at weekends" description="Nights, when a Friday or Saturday is included.">{(c) => <Input {...c} size="sm" type="number" inputMode="numeric" min={1} max={7} value={settings.minStayWeekends} onChange={(e) => setSettings((x) => ({ ...x, minStayWeekends: Number(e.target.value || 1) }))} />}</Field>
          </CardContent>
        </Card>
      </div>

      <div className={cn('sticky bottom-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-lg backdrop-blur transition-opacity', dirty ? 'opacity-100' : 'pointer-events-none opacity-0')} aria-hidden={!dirty}>
        <span className="text-[0.8125rem] text-muted">Unsaved changes</span>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setSettings(initialSettings); setRoomTypes(initialTypes) }}>
            Discard
          </Button>
          <Button size="sm" leftIcon={<Check />} onClick={save}>
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}
