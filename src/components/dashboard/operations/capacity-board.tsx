'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, Anchor, Check, Plus, Wrench, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'
import type { CapacityBoard as Board } from '@/lib/capacity'
import { cn, formatTime, pluralize } from '@/lib/utils'

/* ==========================================================================
   CAPACITY
   Fleets are pools shared by every activity that uses them; boats take one
   private charter at a time. This page shows both for a day, the clashes,
   and the units out for maintenance.
   ========================================================================== */

export function CapacityBoard({ board, days }: { board: Board; days: { key: string; label: string }[] }) {
  const [blocks, setBlocks] = React.useState(board.blocks)
  const [adding, setAdding] = React.useState(false)
  const [form, setForm] = React.useState({ resourceId: board.pools[0]?.id ?? '', units: 1, from: '08:00', to: '12:00', reason: '' })

  const blockedAt = (resourceId: string, hour: number) =>
    blocks
      .filter((block) => block.resourceId === resourceId && Number(block.from.slice(11, 13)) <= hour && Number(block.to.slice(11, 13)) > hour)
      .reduce((sum, block) => sum + block.units, 0)

  const addBlock = () => {
    const pool = board.pools.find((entry) => entry.id === form.resourceId)
    if (!pool || form.to <= form.from || !form.reason.trim()) return
    setBlocks((current) => [
      ...current,
      {
        id: `blk_new_${Date.now().toString(36)}`,
        resourceId: pool.id,
        resourceName: pool.name,
        units: Math.min(pool.quantity, Math.max(1, form.units)),
        from: `${board.dayKey}T${form.from}:00`,
        to: `${board.dayKey}T${form.to}:00`,
        reason: form.reason.trim(),
      },
    ])
    setAdding(false)
    toast.success(`${form.units} ${pluralize(form.units, 'unit')} blocked`, { description: `${pool.name} · ${form.from}–${form.to}. Those units stop selling for the window.` })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Day" className="-mx-1 flex gap-1 overflow-x-auto px-1 no-scrollbar">
          {days.map((day) => (
            <Link
              key={day.key}
              href={`/dashboard/capacity?day=${day.key}`}
              aria-current={day.key === board.dayKey ? 'date' : undefined}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-medium whitespace-nowrap',
                day.key === board.dayKey ? 'border-primary bg-primary-soft text-primary' : 'border-line text-muted hover:border-line-strong',
              )}
            >
              {day.label}
            </Link>
          ))}
        </nav>
        <Button variant="secondary" leftIcon={<Wrench />} onClick={() => setAdding(true)} disabled={board.pools.length === 0}>
          Block units for maintenance
        </Button>
      </div>

      {board.conflicts.length > 0 ? (
        <section className="rounded-2xl border border-danger/40 bg-danger-soft/40 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-danger">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {board.conflicts.length} {pluralize(board.conflicts.length, 'clash', 'clashes')} to sort out
          </p>
          <ul className="mt-2 flex list-none flex-col gap-1.5 p-0 text-sm">
            {board.conflicts.slice(0, 8).map((conflict) => (
              <li key={conflict.id} className="flex gap-2">
                <span className="w-20 shrink-0 font-medium tabular-nums">{formatTime(conflict.when)}</span>
                <span className="text-foreground">{conflict.detail}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">New bookings already stop at the limit; these were booked before it was set.</p>
        </section>
      ) : (
        <p className="flex items-center gap-2 rounded-2xl border border-success/40 bg-success-soft/40 px-4 py-3 text-sm font-medium text-success">
          <Check className="size-4" aria-hidden="true" />
          No clashes. Every fleet and boat fits the day.
        </p>
      )}

      {board.pools.map((pool) => {
        const peakShare = pool.quantity > 0 ? pool.peak / pool.quantity : 0
        return (
          <section key={pool.id} className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-foreground">{pool.name}</h2>
                <p className="text-xs text-subtle">
                  {pool.quantity} units{pool.location ? ` · ${pool.location}` : ''} · shared by {pool.consumers.length > 0 ? pool.consumers.join(', ') : 'nothing today'}
                </p>
              </div>
              <Badge variant={peakShare > 1 ? 'danger' : peakShare >= 0.85 ? 'warning' : 'neutral'} size="sm">
                Peak {pool.peak} of {pool.quantity}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-13 items-end gap-1.5" style={{ gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}>
              {pool.hours.map((hour) => {
                const blocked = blockedAt(pool.id, hour.hour)
                const used = hour.used
                const total = pool.quantity
                const over = used + blocked > total
                return (
                  <div key={hour.hour} className="flex flex-col items-center gap-1">
                    <div
                      className="relative flex h-24 w-full flex-col-reverse overflow-hidden rounded-md bg-surface-sunken"
                      title={`${hour.hour}:00 · ${used} in use${blocked ? `, ${blocked} blocked` : ''} of ${total}`}
                    >
                      <span className={cn('block w-full', over ? 'bg-danger' : 'bg-primary')} style={{ height: `${Math.min(100, (used / Math.max(1, total)) * 100)}%` }} />
                      {blocked > 0 ? (
                        <span className="block w-full bg-[repeating-linear-gradient(45deg,var(--warning)_0_3px,transparent_3px_6px)] opacity-70" style={{ height: `${Math.min(100, (blocked / Math.max(1, total)) * 100)}%` }} />
                      ) : null}
                    </div>
                    <span className="text-xs text-faint tabular-nums">{hour.hour > 12 ? hour.hour - 12 : hour.hour}{hour.hour >= 12 ? 'p' : 'a'}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" />In use</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-warning" aria-hidden="true" />Maintenance</span>
              <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-danger" aria-hidden="true" />Over the fleet</span>
            </div>
          </section>
        )
      })}

      {board.vessels.length > 0 ? (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Anchor className="size-4 text-faint" aria-hidden="true" />
            Boats
          </h2>
          <p className="text-xs text-subtle">A booked private charter takes the whole boat for its window.</p>
          <ul className="mt-3 flex list-none flex-col divide-y divide-line-subtle p-0">
            {board.vessels.map((vessel) => (
              <li key={vessel.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                <div className="w-56 shrink-0">
                  <p className="text-sm font-medium text-foreground">{vessel.name.split(' (')[0]}</p>
                  <p className="text-xs text-subtle">{vessel.status === 'maintenance' ? 'In maintenance' : `${vessel.runs.length} ${pluralize(vessel.runs.length, 'run')}`}</p>
                </div>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                  {vessel.runs.map((run) => (
                    <span
                      key={run.departureId}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs',
                        run.clash ? 'border-danger/50 bg-danger-soft text-danger' : run.kind === 'charter' ? 'border-primary/40 bg-primary-soft text-primary' : 'border-line bg-surface-sunken text-muted',
                      )}
                    >
                      <span className="font-semibold tabular-nums">{formatTime(run.start)}</span>
                      {run.activityName}
                      <span className="text-faint">· {run.booked} booked</span>
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {blocks.length > 0 ? (
        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-base font-semibold text-foreground">Maintenance today</h2>
          <ul className="mt-2 flex list-none flex-col gap-2 p-0">
            {blocks.map((block) => (
              <li key={block.id} className="flex items-center gap-3 text-sm">
                <Wrench className="size-4 shrink-0 text-warning" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{block.units} × {block.resourceName}</span>
                  <span className="text-muted"> · {formatTime(block.from)}–{formatTime(block.to)} · {block.reason}</span>
                </span>
                <Button variant="ghost" size="xs" leftIcon={<X />} onClick={() => setBlocks((current) => current.filter((entry) => entry.id !== block.id))}>
                  Release
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent size="md">
          <DialogHeader divider>
            <DialogTitle>Block units for maintenance</DialogTitle>
            <DialogDescription>Blocked units stop selling on every activity that shares the fleet.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4 py-4">
            <Field label="Fleet">
              <Select value={form.resourceId} onValueChange={(value) => setForm((f) => ({ ...f, resourceId: value }))}>
                <SelectTrigger aria-label="Fleet"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {board.pools.map((pool) => (
                    <SelectItem key={pool.id} value={pool.id}>{pool.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Units">
                {(control) => <Input {...control} type="number" min={1} value={form.units} onChange={(e) => setForm((f) => ({ ...f, units: Math.max(1, Number(e.target.value) || 1) }))} />}
              </Field>
              <Field label="From">
                {(control) => <Input {...control} type="time" value={form.from} onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))} />}
              </Field>
              <Field label="To">
                {(control) => <Input {...control} type="time" value={form.to} onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))} />}
              </Field>
            </div>
            <Field label="Reason" required>
              {(control) => <Input {...control} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Engine service, hull repair…" />}
            </Field>
          </DialogBody>
          <DialogFooter divider>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" leftIcon={<Plus />} disabled={!form.reason.trim() || form.to <= form.from} onClick={addBlock}>Block units</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
