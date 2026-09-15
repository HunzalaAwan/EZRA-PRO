'use client'

import * as React from 'react'
import {
  Anchor,
  Bus,
  CalendarClock,
  Camera,
  DoorOpen,
  ImagePlus,
  LifeBuoy,
  MapPin,
  Pencil,
  Ship,
  UserRound,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { cn, formatNumber, pluralize } from '@/lib/utils'
import type { Activity, Resource, ResourceKind } from '@/types'

/* ==========================================================================
   KIND VOCABULARY
   ========================================================================== */

export const RESOURCE_KIND_META: Record<
  ResourceKind,
  { label: string; plural: string; icon: LucideIcon; tile: string }
> = {
  vessel: { label: 'Vessel', plural: 'Vessels', icon: Ship, tile: 'bg-chart-1/12 text-chart-1' },
  vehicle: { label: 'Vehicle', plural: 'Vehicles', icon: Bus, tile: 'bg-chart-6/12 text-chart-6' },
  equipment: { label: 'Equipment', plural: 'Equipment', icon: LifeBuoy, tile: 'bg-chart-3/12 text-chart-3' },
  table: { label: 'Table', plural: 'Tables', icon: UtensilsCrossed, tile: 'bg-chart-7/14 text-chart-7' },
  room: { label: 'Room', plural: 'Rooms', icon: DoorOpen, tile: 'bg-chart-4/12 text-chart-4' },
  guide: { label: 'Guide', plural: 'Guides', icon: UserRound, tile: 'bg-chart-5/12 text-chart-5' },
}

const KIND_ORDER: ResourceKind[] = ['vessel', 'vehicle', 'equipment', 'table', 'room', 'guide']

export const STATUS_META: Record<Resource['status'], { label: string; variant: 'success' | 'warning' | 'neutral' }> = {
  available: { label: 'In service', variant: 'success' },
  maintenance: { label: 'In maintenance', variant: 'warning' },
  retired: { label: 'Retired', variant: 'neutral' },
}

export interface ResourceImage {
  url: string
  alt: string
}

export type ResourceView = 'grid' | 'list'

/* ==========================================================================
   GRID / LIST
   ========================================================================== */

export interface ResourceGridProps {
  resources: Resource[]
  /** Activities that list this resource in `requiredResourceIds`, keyed by resource id. */
  dependents: Record<string, Activity[]>
  /** Scheduled departures over the next fortnight, keyed by resource id. */
  upcomingUse: Record<string, number>
  /** Busiest resource's departure count — normalises the utilisation bars. */
  peakUse: number
  /** Stand-in photo (the experience that runs on it) until the operator adds one. */
  imageFallbacks: Record<string, ResourceImage>
  view: ResourceView
  onEdit: (resource: Resource) => void
  onAddPhoto: (resource: Resource) => void
  onAdd: (kind: ResourceKind) => void
  className?: string
}

export function ResourceGrid({
  resources,
  dependents,
  upcomingUse,
  peakUse,
  imageFallbacks,
  view,
  onEdit,
  onAddPhoto,
  onAdd,
  className,
}: ResourceGridProps) {
  const grouped = React.useMemo(() => {
    const map = new Map<ResourceKind, Resource[]>()
    for (const r of resources) {
      const list = map.get(r.kind)
      if (list) list.push(r)
      else map.set(r.kind, [r])
    }
    return KIND_ORDER.filter((k) => map.has(k)).map((k) => [k, map.get(k) as Resource[]] as const)
  }, [resources])

  if (resources.length === 0) {
    return (
      <EmptyState
        variant="no-results"
        icon={Anchor}
        title="No resources match that"
        description="Clear the filters, or add the first vessel to your fleet."
      />
    )
  }

  const imageFor = (r: Resource): ResourceImage | null =>
    r.imageUrl ? { url: r.imageUrl, alt: r.name } : (imageFallbacks[r.id] ?? null)

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      {grouped.map(([kind, items]) => {
        const meta = RESOURCE_KIND_META[kind]
        const Icon = meta.icon
        const totalSeats = items.reduce((sum, r) => sum + r.capacity * r.quantity, 0)

        return (
          <section key={kind} aria-labelledby={`resources-${kind}`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={cn('grid size-7 place-items-center rounded-lg', meta.tile)}>
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <h3 id={`resources-${kind}`} className="font-display text-sm font-semibold tracking-tight text-foreground">
                {meta.plural}
              </h3>
              <span className="text-xs text-faint tabular-nums">
                {items.length} · {formatNumber(totalSeats)} {pluralize(totalSeats, 'seat')} at once
              </span>
              <Button variant="ghost" size="xs" className="ml-auto" onClick={() => onAdd(kind)}>
                Add {meta.label.toLowerCase()}
              </Button>
            </div>

            {view === 'grid' ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((resource) => (
                  <ResourceCard
                    key={resource.id}
                    resource={resource}
                    image={imageFor(resource)}
                    dependents={dependents[resource.id] ?? []}
                    upcoming={upcomingUse[resource.id] ?? 0}
                    peakUse={peakUse}
                    onEdit={() => onEdit(resource)}
                    onAddPhoto={() => onAddPhoto(resource)}
                  />
                ))}
              </div>
            ) : (
              <ResourceTable
                items={items}
                imageFor={imageFor}
                dependents={dependents}
                upcomingUse={upcomingUse}
                peakUse={peakUse}
                onEdit={onEdit}
              />
            )}
          </section>
        )
      })}
    </div>
  )
}

/* ==========================================================================
   CARD
   ========================================================================== */

function Thumb({ image, kind, className }: { image: ResourceImage | null; kind: ResourceKind; className?: string }) {
  const meta = RESOURCE_KIND_META[kind]
  const Icon = meta.icon
  return (
    <span className={cn('relative block overflow-hidden bg-surface-sunken', className)}>
      {image ? (
        // Object URLs from the photo picker cannot go through next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt={image.alt} className="size-full object-cover" loading="lazy" />
      ) : (
        <span className={cn('grid size-full place-items-center', meta.tile)}>
          <Icon aria-hidden="true" className="size-6" />
        </span>
      )}
    </span>
  )
}

function ResourceCard({
  resource,
  image,
  dependents,
  upcoming,
  peakUse,
  onEdit,
  onAddPhoto,
}: {
  resource: Resource
  image: ResourceImage | null
  dependents: Activity[]
  upcoming: number
  peakUse: number
  onEdit: () => void
  onAddPhoto: () => void
}) {
  const meta = RESOURCE_KIND_META[resource.kind]
  const status = STATUS_META[resource.status]
  const Icon = meta.icon
  const maintenance = resource.status === 'maintenance'
  const utilisation = peakUse === 0 ? 0 : Math.round((upcoming / peakUse) * 100)

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-surface',
        'transition-[transform,box-shadow,border-color] duration-300 ease-[var(--ease-out-expo)]',
        'hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0',
        maintenance ? 'border-[color-mix(in_oklab,var(--warning)_38%,var(--border))]' : 'border-line hover:border-line-strong',
      )}
    >
      {/* ---- photo ------------------------------------------------------- */}
      <div className="relative aspect-[16/9]">
        {image ? (
          <Thumb image={image} kind={resource.kind} className="size-full" />
        ) : (
          <button
            type="button"
            onClick={onAddPhoto}
            className={cn(
              'flex size-full flex-col items-center justify-center gap-1.5 bg-surface-sunken text-subtle',
              'transition-colors hover:bg-background-subtle hover:text-foreground',
              'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary',
            )}
          >
            <span className={cn('grid size-10 place-items-center rounded-xl', meta.tile)}>
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-medium">
              <ImagePlus aria-hidden="true" className="size-3.5" />
              Add a photo
            </span>
          </button>
        )}

        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <Badge variant={status.variant} size="sm" dot className="shadow-sm">
            {status.label}
          </Badge>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface/90 px-2 py-0.5 text-[0.6875rem] font-medium text-muted shadow-sm backdrop-blur-sm">
            <Icon aria-hidden="true" className="size-3" />
            {meta.label}
          </span>
        </div>

        {image ? (
          <button
            type="button"
            onClick={onAddPhoto}
            aria-label={`Change photo of ${resource.name}`}
            className={cn(
              'absolute right-3 bottom-3 grid size-8 place-items-center rounded-full bg-surface/90 text-muted shadow-sm backdrop-blur-sm',
              'opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100',
              'hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
            )}
          >
            <Camera aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>

      {/* ---- body -------------------------------------------------------- */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h4 className="truncate text-[0.9375rem] font-semibold text-foreground">{resource.name}</h4>
          {resource.location ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
              <MapPin className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{resource.location}</span>
            </p>
          ) : null}
        </div>

        <dl className="grid grid-cols-3 gap-2 rounded-xl bg-well px-3 py-2.5">
          <Figure label="Capacity" value={formatNumber(resource.capacity)} hint={pluralize(resource.capacity, 'seat')} />
          <Figure label="Units" value={formatNumber(resource.quantity)} hint="in the fleet" />
          <Figure label="At once" value={formatNumber(resource.capacity * resource.quantity)} hint="seats" />
        </dl>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              Next 14 days
            </span>
            <span className="font-medium text-foreground tabular-nums">
              {upcoming} {pluralize(upcoming, 'departure')}
            </span>
          </div>
          <Progress value={utilisation} size="sm" tone={maintenance ? 'warning' : utilisation >= 80 ? 'accent' : 'primary'} />
        </div>

        {dependents.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1">
            {dependents.slice(0, 2).map((activity) => (
              <Badge key={activity.id} variant="outline" size="sm" className="max-w-44">
                <span className="truncate">{activity.name}</span>
              </Badge>
            ))}
            {dependents.length > 2 ? (
              <SimpleTooltip label={dependents.slice(2).map((a) => a.name).join(' · ')}>
                <Badge variant="neutral" size="sm" tabIndex={0} className="cursor-default">
                  +{dependents.length - 2}
                </Badge>
              </SimpleTooltip>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-faint">Not required by any activity</p>
        )}

        {maintenance && resource.notes ? (
          <p className="flex items-start gap-2 rounded-lg bg-warning-soft/60 px-3 py-2 text-xs leading-relaxed text-foreground">
            <Wrench className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
            {resource.notes}
          </p>
        ) : null}

        <div className="mt-auto flex items-center justify-end gap-1 border-t border-line-subtle pt-3">
          <Button variant="ghost" size="xs" leftIcon={<Camera />} onClick={onAddPhoto}>
            Photo
          </Button>
          <Button variant="ghost" size="xs" leftIcon={<Pencil />} onClick={onEdit}>
            Edit
          </Button>
        </div>
      </div>
    </article>
  )
}

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.625rem] font-semibold tracking-[0.08em] text-faint uppercase">{label}</dt>
      <dd className="text-sm font-semibold text-foreground tabular-nums">{value}</dd>
      <p className="truncate text-[0.625rem] text-subtle">{hint}</p>
    </div>
  )
}

/* ==========================================================================
   TABLE — the manageable view: one row per unit, scan and edit.
   ========================================================================== */

function ResourceTable({
  items,
  imageFor,
  dependents,
  upcomingUse,
  peakUse,
  onEdit,
}: {
  items: Resource[]
  imageFor: (r: Resource) => ResourceImage | null
  dependents: Record<string, Activity[]>
  upcomingUse: Record<string, number>
  peakUse: number
  onEdit: (resource: Resource) => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <Table density="compact">
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Resource</TableHead>
            <TableHead>Location</TableHead>
            <TableHead align="right" numeric>
              Capacity
            </TableHead>
            <TableHead>Next 14 days</TableHead>
            <TableHead>Required by</TableHead>
            <TableHead>Status</TableHead>
            <TableHead align="right" className="pr-4">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((resource) => {
            const status = STATUS_META[resource.status]
            const upcoming = upcomingUse[resource.id] ?? 0
            const utilisation = peakUse === 0 ? 0 : Math.round((upcoming / peakUse) * 100)
            const deps = dependents[resource.id] ?? []
            return (
              <TableRow key={resource.id} interactive>
                <TableCell className="pl-4">
                  <div className="flex items-center gap-3">
                    <Thumb image={imageFor(resource)} kind={resource.kind} className="size-11 shrink-0 rounded-lg" />
                    <div className="min-w-0">
                      <p className="truncate text-[0.8125rem] font-semibold text-foreground">{resource.name}</p>
                      <p className="text-[0.6875rem] text-faint">{RESOURCE_KIND_META[resource.kind].label}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-[0.8125rem] text-muted">{resource.location ?? '—'}</TableCell>
                <TableCell align="right" numeric className="text-[0.8125rem]">
                  {formatNumber(resource.capacity)} × {formatNumber(resource.quantity)}
                  <span className="text-faint"> = {formatNumber(resource.capacity * resource.quantity)}</span>
                </TableCell>
                <TableCell>
                  <div className="flex w-36 items-center gap-2">
                    <Progress value={utilisation} size="sm" tone={utilisation >= 80 ? 'accent' : 'primary'} className="flex-1" />
                    <span className="w-6 shrink-0 text-right text-[0.75rem] text-muted tabular-nums">{upcoming}</span>
                  </div>
                </TableCell>
                <TableCell className="text-[0.8125rem] text-muted">
                  {deps.length === 0 ? '—' : deps.length === 1 ? deps[0].name : `${deps[0].name} +${deps.length - 1}`}
                </TableCell>
                <TableCell>
                  <Badge variant={status.variant} size="sm" dot>
                    {status.label}
                  </Badge>
                </TableCell>
                <TableCell align="right" className="pr-4">
                  <Button variant="ghost" size="xs" leftIcon={<Pencil />} onClick={() => onEdit(resource)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
