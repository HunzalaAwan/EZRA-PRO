'use client'

import * as React from 'react'
import { Bus, Check, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { usePickupZones, type ZoneInput } from '@/hooks/use-pickup-zones'
import { cn, formatCurrency, pluralize } from '@/lib/utils'
import type { PickupZone, Tenant } from '@/types'

/* ==========================================================================
   PICKUP ZONES
   Where the shuttle collects guests, how long before the start and what it
   costs per guest. Activities choose the zones they serve.
   ========================================================================== */

const BLANK: ZoneInput = { name: '', stops: [], offsetMinutes: 45, fee: 0, active: true }

export function PickupSettingsClient({ tenant, seeded, usage }: { tenant: Tenant; seeded: PickupZone[]; usage: Record<string, string[]> }) {
  const { zones, add, update, remove, reset, hasEdits } = usePickupZones(tenant.id, seeded)
  const [editing, setEditing] = React.useState<string | 'new' | null>(null)
  const [form, setForm] = React.useState<ZoneInput>(BLANK)
  const [stopsText, setStopsText] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const open = (zone: PickupZone | null) => {
    setEditing(zone ? zone.id : 'new')
    setForm(zone ? { name: zone.name, stops: zone.stops, offsetMinutes: zone.offsetMinutes, fee: zone.fee, active: zone.active, locationId: zone.locationId } : BLANK)
    setStopsText((zone?.stops ?? []).join('\n'))
    setError(null)
  }

  const submit = () => {
    if (form.name.trim().length < 2) {
      setError('Name the zone.')
      return
    }
    const input = { ...form, name: form.name.trim(), stops: stopsText.split('\n').map((line) => line.trim()).filter(Boolean) }
    if (editing === 'new') {
      add(input)
      toast.success(`${input.name} added`, { description: 'Tick it on an activity to offer pickup from there.' })
    } else if (editing) {
      update(editing, input)
      toast.success(`${input.name} saved`)
    }
    setEditing(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Pickup zones</CardTitle>
            <CardDescription>
              Hotel pickup by zone. Guests pick their hotel at checkout and get a pickup time; the driver gets a run sheet in collection order.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasEdits ? (
              <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={() => { reset(); toast('Seeded zones restored') }}>
                Restore
              </Button>
            ) : null}
            <Button size="sm" leftIcon={<Plus />} onClick={() => open(null)}>
              Add zone
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {zones.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-subtle">No zones yet. Add one to offer hotel pickup.</p>
          ) : (
            <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
              {zones.map((zone) => {
                const used = usage[zone.id] ?? []
                return (
                  <li key={zone.id} className={cn('flex items-start gap-4 px-5 py-4', !zone.active && 'opacity-60')}>
                    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-subtle">
                      <Bus className="size-[1.125rem]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{zone.name}</p>
                      <p className="mt-0.5 text-xs text-subtle">
                        Collects {zone.offsetMinutes} min before the start · {zone.fee > 0 ? `${formatCurrency(zone.fee, tenant.currency)} per guest by default` : 'free by default'}
                        {used.length > 0 ? ` · ${used.length} ${pluralize(used.length, 'activity', 'activities')}` : ' · not on any activity'}
                      </p>
                      {zone.stops.length > 0 ? <p className="mt-1 text-sm text-muted">{zone.stops.join(' · ')}</p> : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Switch checked={zone.active} onCheckedChange={(checked) => update(zone.id, { active: checked })} aria-label={`${zone.name} active`} />
                      <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => open(zone)}>
                        Edit
                      </Button>
                      <IconButton aria-label={`Remove ${zone.name}`} size="sm" variant="ghost" onClick={() => { remove(zone.id); toast(`${zone.name} removed`) }}>
                        <Trash2 aria-hidden="true" />
                      </IconButton>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing !== null} onOpenChange={(value) => !value && setEditing(null)}>
        <DialogContent size="md">
          <DialogHeader divider>
            <DialogTitle>{editing === 'new' ? 'Add a pickup zone' : `Edit ${form.name || 'zone'}`}</DialogTitle>
            <DialogDescription>Guests in this zone are collected before the start time you set.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4 py-4">
            <Field label="Zone name" required error={error ?? undefined}>
              {(control) => <Input {...control} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Kaanapali resorts" />}
            </Field>
            <Field label="Hotels and stops" description="One per line. Guests pick from this list.">
              {(control) => <Textarea {...control} rows={5} value={stopsText} onChange={(e) => setStopsText(e.target.value)} placeholder={'Hyatt Regency\nWestin Maui'} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Collect before the start" description="Minutes.">
                {(control) => <Input {...control} type="number" min={0} step={5} value={form.offsetMinutes} onChange={(e) => setForm((f) => ({ ...f, offsetMinutes: Math.max(0, Number(e.target.value) || 0) }))} />}
              </Field>
              <Field label="Default fee per guest" description="0 for free. Each activity can set its own price for this zone.">
                {(control) => <Input {...control} type="number" min={0} value={form.fee / 100 || ''} onChange={(e) => setForm((f) => ({ ...f, fee: Math.max(0, Math.round(Number(e.target.value) * 100) || 0) }))} />}
              </Field>
            </div>
          </DialogBody>
          <DialogFooter divider>
            <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" leftIcon={<Check />} onClick={submit}>{editing === 'new' ? 'Add zone' : 'Save zone'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
