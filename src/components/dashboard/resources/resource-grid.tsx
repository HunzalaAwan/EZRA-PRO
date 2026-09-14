'use client'

import * as React from 'react'
import {
  Anchor,
  Bus,
  CalendarClock,
  DoorOpen,
  LifeBuoy,
  MapPin,
  Pencil,
  Ship,
  UserRound,
  UtensilsCrossed,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
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
  vehicle: { label: 'Vehicle', plural: 'Vehicles', icon: Bus, tile: 'bg-chart-5/12 text-chart-5' },
  equipment: {
    label: 'Equipment',
    plural: 'Equipment',
    icon: LifeBuoy,
    tile: 'bg-chart-2/12 text-chart-2',
  },
  table: {
    label: 'Table',
    plural: 'Tables',
    icon: UtensilsCrossed,
    tile: 'bg-chart-4/14 text-chart-4',
  },
  room: { label: 'Room', plural: 'Rooms', icon: DoorOpen, tile: 'bg-chart-3/12 text-chart-3' },
  guide: { label: 'Guide', plural: 'Guides', icon: UserRound, tile: 'bg-chart-6/12 text-chart-6' },
}

const KIND_ORDER: ResourceKind[] = ['vessel', 'vehicle', 'equipment', 'table', 'room', 'guide']

const STATUS_META: Record<
  Resource['status'],
  { label: string; variant: 'success' | 'warning' | 'neutral' }
> = {
  available: { label: 'In service', variant: 'success' },
  maintenance: { label: 'In maintenance', variant: 'warning' },
  retired: { label: 'Retired', variant: 'neutral' },
}

/* ==========================================================================
   GRID
   ========================================================================== */

export interface ResourceGridProps {
  resources: Resource[]
  /** Activities that list this resource in `requiredResourceIds`, keyed by resource id. */
  dependents: Record<string, Activity[]>
  /** Scheduled departures over the next fortnight, keyed by resource id. */
  upcomingUse: Record<string, number>
  /** Busiest resource's departure count — normalises the utilisation bars. */
  peakUse: number
  onEdit: (resource: Resource) => void
  onAdd: (kind: ResourceKind) => void
  className?: string
}

export function ResourceGrid({
  resources,
  dependents,
  upcomingUse,
  peakUse,
  onEdit,
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
    return KIND_ORDER.filter((k) => map.has(k)).map(
      (k) => [k, map.get(k) as Resource[]] as const,
    )
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

  return (
    <div className={cn('flex flex-col gap-8', className)}>
      {grouped.map(([kind, items]) => {
        const meta = RESOURCE_KIND_META[kind]
        const Icon = meta.icon
        const totalSeats = items.reduce((sum, r) => sum + r.capacity * r.quantity, 0)

        return (
          <section key={kind} aria-labelledby={`resources-${kind}`}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Icon className="size-4 text-subtle" aria-hidden="true" />
              <h3
                id={`resources-${kind}`}
                className="font-display text-sm font-semibold tracking-tight text-foreground"
              >
                {meta.plural}
              </h3>
              <span className="text-xs text-faint tabular">
                {items.length} · {formatNumber(totalSeats)} total{' '}
                {pluralize(totalSeats, 'seat')}
              </span>
              <Button
                variant="ghost"
                size="xs"
                className="ml-auto"
                onClick={() => onAdd(kind)}
              >
                Add {meta.label.toLowerCase()}
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  dependents={dependents[resource.id] ?? []}
                  upcoming={upcomingUse[resource.id] ?? 0}
                  peakUse={peakUse}
                  onEdit={() => onEdit(resource)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/* ========================================================================== */

function ResourceCard({
  resource,
  dependents,
  upcoming,
  peakUse,
  onEdit,
}: {
  resource: Resource
  dependents: Activity[]
  upcoming: number
  peakUse: number
  onEdit: () => void
}) {
  const meta = RESOURCE_KIND_META[resource.kind]
  const status = STATUS_META[resource.status]
  const Icon = meta.icon
  const maintenance = resource.status === 'maintenance'
  const utilisation = peakUse === 0 ? 0 : Math.round((upcoming / peakUse) * 100)

  return (
    <article
      className={cn(
        'group relative flex flex-col gap-3.5 overflow-hidden rounded-2xl border bg-surface p-4',
        'transition-all duration-300 ease-[var(--ease-out-expo)]',
        'hover:-translate-y-0.5 hover:shadow-lg motion-reduce:hover:translate-y-0',
        maintenance
          ? 'border-[color-mix(in_oklab,var(--warning)_38%,var(--border))] shadow-sm'
          : 'border-line hover:border-line-strong',
      )}
    >
      {maintenance ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-0.5 bg-[repeating-linear-gradient(90deg,var(--warning)_0_10px,transparent_10px_20px)]"
        />
      ) : null}

      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn('grid size-10 shrink-0 place-items-center rounded-xl', meta.tile)}
        >
          <Icon className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-foreground">{resource.name}</h4>
          {resource.location ? (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
              <MapPin className="size-3 shrink-0" aria-hidden="true" />
              <span className="truncate">{resource.location}</span>
            </p>
          ) : null}
        </div>

        <Badge variant={status.variant} size="sm" dot>
          {status.label}
        </Badge>
      </div>

      {/* Capacity figures */}
      <dl className="grid grid-cols-3 gap-2 rounded-xl border border-line-subtle bg-surface-sunken px-3 py-2.5">
        <Figure
          label="Capacity"
          value={formatNumber(resource.capacity)}
          hint={pluralize(resource.capacity, 'seat')}
        />
        <Figure label="Units" value={formatNumber(resource.quantity)} hint="in the fleet" />
        <Figure
          label="Total"
          value={formatNumber(resource.capacity * resource.quantity)}
          hint="seats at once"
        />
      </dl>

      {/* Utilisation */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-muted">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            Next 14 days
          </span>
          <span className="font-medium text-foreground tabular">
            {upcoming} {pluralize(upcoming, 'departure')}
          </span>
        </div>
        <Progress
          value={utilisation}
          size="sm"
          tone={maintenance ? 'warning' : utilisation >= 80 ? 'accent' : 'primary'}
        />
      </div>

      {/* Dependents */}
      <div className="flex flex-col gap-1.5">
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Users className="size-3.5" aria-hidden="true" />
          {dependents.length === 0
            ? 'Not required by any activity'
            : `Required by ${dependents.length} ${pluralize(dependents.length, 'activity', 'activities')}`}
        </p>
        {dependents.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {dependents.slice(0, 3).map((activity) => (
              <Badge key={activity.id} variant="outline" size="sm" className="max-w-44">
                <span className="truncate">{activity.name}</span>
              </Badge>
            ))}
            {dependents.length > 3 ? (
              <SimpleTooltip
                label={dependents
                  .slice(3)
                  .map((a) => a.name)
                  .join(' · ')}
              >
                <Badge variant="neutral" size="sm" tabIndex={0} className="cursor-default">
                  +{dependents.length - 3}
                </Badge>
              </SimpleTooltip>
            ) : null}
          </div>
        ) : null}
      </div>

      {maintenance && resource.notes ? (
        <p className="flex items-start gap-2 rounded-lg bg-warning-soft/60 px-3 py-2 text-xs leading-relaxed text-foreground">
          <Wrench className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
          {resource.notes}
        </p>
      ) : resource.notes ? (
        <p className="line-clamp-2 text-xs leading-relaxed text-subtle">{resource.notes}</p>
      ) : null}

      <div className="mt-auto flex items-center justify-end gap-2 border-t border-line-subtle pt-3">
        <Button variant="ghost" size="xs" leftIcon={<Pencil />} onClick={onEdit}>
          Edit
        </Button>
      </div>
    </article>
  )
}

function Figure({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.625rem] font-semibold tracking-[0.08em] text-faint uppercase">
        {label}
      </dt>
      <dd className="text-sm font-semibold text-foreground tabular">{value}</dd>
      <p className="truncate text-[0.625rem] text-subtle">{hint}</p>
    </div>
  )
}
