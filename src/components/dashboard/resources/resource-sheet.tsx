'use client'

import * as React from 'react'
import { CalendarClock, Camera, MapPin, Pencil, StickyNote, Wrench } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn, formatDateShort, formatNumber, formatTime, pluralize } from '@/lib/utils'
import type { Activity, Resource } from '@/types'
import type { ResourceRun } from './derive'
import { RESOURCE_KIND_META, STATUS_META, type ResourceImage } from './resource-grid'

/* ==========================================================================
   ResourceSheet — one resource, everything the yard needs to know about it,
   in a panel that slides over the ledger so the operator never loses their
   place in the list.
   ========================================================================== */

export interface ResourceSheetProps {
  resource: Resource | null
  image: ResourceImage | null
  dependents: Activity[]
  runs: ResourceRun[]
  upcoming: number
  peakUse: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (resource: Resource) => void
  onPhoto: (resource: Resource) => void
  onStatus: (resource: Resource, status: Resource['status']) => void
}

const STATUS_OPTIONS: { value: Resource['status']; label: string }[] = [
  { value: 'available', label: 'In service' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
]

export function ResourceSheet({
  resource,
  image,
  dependents,
  runs,
  upcoming,
  peakUse,
  open,
  onOpenChange,
  onEdit,
  onPhoto,
  onStatus,
}: ResourceSheetProps) {
  const meta = resource ? RESOURCE_KIND_META[resource.kind] : null
  const Icon = meta?.icon
  const utilisation = resource && peakUse > 0 ? Math.round((upcoming / peakUse) * 100) : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="md" className="flex flex-col p-0">
        {resource && meta && Icon ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2">
                <span className={cn('grid size-6 place-items-center rounded-md', meta.tile)}>
                  <Icon className="size-3.5" aria-hidden="true" />
                </span>
                <span className="text-xs font-medium text-subtle">{meta.label}</span>
                <Badge variant={STATUS_META[resource.status].variant} size="sm" dot className="ml-auto">
                  {STATUS_META[resource.status].label}
                </Badge>
              </div>
              <SheetTitle className="mt-1 text-lg leading-snug">{resource.name}</SheetTitle>
              <SheetDescription className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0 text-faint" aria-hidden="true" />
                {resource.location ?? 'No location set'}
              </SheetDescription>
            </SheetHeader>

            <SheetBody className="flex flex-col gap-5 [&>*]:shrink-0">
              {/* ---------- photo ---------- */}
              <button
                type="button"
                onClick={() => onPhoto(resource)}
                aria-label={image ? `Change photo of ${resource.name}` : `Add a photo of ${resource.name}`}
                className={cn(
                  'group relative block h-48 w-full shrink-0 overflow-hidden rounded-xl border border-line bg-surface-sunken',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                )}
              >
                {image ? (
                  // Object URLs from the photo picker cannot go through next/image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.url} alt={image.alt} className="size-full object-cover" />
                ) : (
                  <span className={cn('grid size-full place-items-center', meta.tile)}>
                    <Icon className="size-8" aria-hidden="true" />
                  </span>
                )}
                <span className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-[0.6875rem] font-medium text-foreground shadow-sm backdrop-blur-sm">
                  <Camera className="size-3.5" aria-hidden="true" />
                  {image ? 'Change photo' : 'Add a photo'}
                </span>
              </button>

              {/* ---------- figures ---------- */}
              <dl className="grid grid-cols-3 gap-2 rounded-xl bg-well px-4 py-3">
                <Figure label="Per unit" value={formatNumber(resource.capacity)} hint={pluralize(resource.capacity, 'seat')} />
                <Figure label="Units" value={formatNumber(resource.quantity)} hint="in the fleet" />
                <Figure label="At once" value={formatNumber(resource.capacity * resource.quantity)} hint="seats" />
              </dl>

              {/* ---------- status ---------- */}
              <section>
                <h4 className="text-[0.8125rem] font-semibold text-foreground">Status</h4>
                <p className="mt-0.5 text-xs text-subtle">Anything not in service is held back from new departures.</p>
                <Segmented
                  size="sm"
                  fullWidth
                  className="mt-2.5"
                  label="Resource status"
                  value={resource.status}
                  onValueChange={(status) => onStatus(resource, status)}
                  options={STATUS_OPTIONS}
                />
              </section>

              {/* ---------- schedule ---------- */}
              <section>
                <div className="flex items-baseline justify-between gap-3">
                  <h4 className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-foreground">
                    <CalendarClock className="size-3.5 text-faint" aria-hidden="true" />
                    Next 14 days
                  </h4>
                  <span className="text-xs text-muted tabular-nums">
                    {upcoming} {pluralize(upcoming, 'departure')}
                  </span>
                </div>
                <Progress value={utilisation} size="sm" className="mt-2" tone={resource.status === 'maintenance' ? 'warning' : utilisation >= 80 ? 'accent' : 'primary'} />
                {runs.length > 0 ? (
                  <ul className="mt-3 divide-y divide-line-subtle rounded-xl border border-line">
                    {runs.map((run) => {
                      const fill = run.capacity > 0 ? Math.round((run.booked / run.capacity) * 100) : 0
                      return (
                        <li key={run.departureId} className="flex items-center gap-3 px-3 py-2">
                          <div className="w-[4.5rem] shrink-0">
                            <p className="text-[0.75rem] font-semibold text-foreground">{formatDateShort(run.startsAt)}</p>
                            <p className="text-[0.6875rem] text-subtle tabular-nums">{formatTime(run.startsAt)}</p>
                          </div>
                          <p className="min-w-0 flex-1 truncate text-[0.8125rem] text-foreground">{run.activityName}</p>
                          <span className={cn('shrink-0 text-[0.75rem] tabular-nums', fill >= 90 ? 'font-semibold text-accent' : 'text-muted')}>
                            {run.booked}/{run.capacity}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-faint">Nothing scheduled on it in the next two weeks.</p>
                )}
              </section>

              {/* ---------- required by ---------- */}
              <section>
                <h4 className="text-[0.8125rem] font-semibold text-foreground">Required by</h4>
                {dependents.length > 0 ? (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {dependents.map((activity) => (
                      <li key={activity.id}>
                        <Badge variant="outline" size="sm" className="max-w-56">
                          <span className="truncate">{activity.name}</span>
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-faint">No activity lists this resource yet, so nothing is blocked when it is down.</p>
                )}
              </section>

              {/* ---------- notes ---------- */}
              {resource.notes ? (
                <section>
                  <h4 className="flex items-center gap-1.5 text-[0.8125rem] font-semibold text-foreground">
                    {resource.status === 'maintenance' ? (
                      <Wrench className="size-3.5 text-warning" aria-hidden="true" />
                    ) : (
                      <StickyNote className="size-3.5 text-faint" aria-hidden="true" />
                    )}
                    Notes
                  </h4>
                  <p
                    className={cn(
                      'mt-2 rounded-xl px-3 py-2.5 text-[0.8125rem] leading-relaxed text-foreground',
                      resource.status === 'maintenance' ? 'bg-warning-soft/60' : 'bg-surface-sunken',
                    )}
                  >
                    {resource.notes}
                  </p>
                </section>
              ) : null}
            </SheetBody>

            <SheetFooter>
              <Button variant="secondary" leftIcon={<Camera />} onClick={() => onPhoto(resource)}>
                Photo
              </Button>
              <Button variant="primary" leftIcon={<Pencil />} onClick={() => onEdit(resource)}>
                Edit details
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.625rem] font-semibold tracking-[0.08em] text-faint uppercase">{label}</dt>
      <dd className="mt-0.5 font-display text-lg leading-none font-semibold text-foreground tabular-nums">{value}</dd>
      <p className="mt-1 truncate text-[0.6875rem] text-subtle">{hint}</p>
    </div>
  )
}
