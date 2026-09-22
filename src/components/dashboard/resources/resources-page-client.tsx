'use client'

import * as React from 'react'
import {
  Anchor,
  ArrowRight,
  Boxes,
  CalendarClock,
  CheckCircle2,
  ImagePlus,
  LayoutGrid,
  List,
  Plus,
  Trash2,
  Users,
  Wrench,
} from 'lucide-react'
import { z } from 'zod'

import { PageHeader } from '@/components/dashboard/page-header'
import {
  RESOURCE_KIND_META,
  ResourceGrid,
  type ResourceImage,
  type ResourceView,
} from '@/components/dashboard/resources/resource-grid'
import { ResourceBulkBar, ResourceTable, type ResourceBulkAction, type ResourceRowAction } from '@/components/dashboard/resources/resource-table'
import { ResourceSheet } from '@/components/dashboard/resources/resource-sheet'
import type { ResourceRun } from '@/components/dashboard/resources/derive'
import { Button } from '@/components/ui/button'
import type { DataTableSort } from '@/components/ui/data-table'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn, formatNumber, pluralize } from '@/lib/utils'
import type { Activity, Resource, ResourceKind, Tenant } from '@/types'

export type { ResourceImage }

/* ==========================================================================
   FORM
   ========================================================================== */

const resourceSchema = z.object({
  name: z.string().trim().min(3, 'Give it a name the crew will recognise on the dock.'),
  kind: z.string().min(1, 'Pick what type of resource this is.'),
  capacity: z.coerce.number().int().min(1, 'Capacity has to be at least one.').max(500),
  quantity: z.coerce.number().int().min(1, 'You need at least one unit.').max(200),
  status: z.string().min(1),
  location: z.string().trim().max(80),
  notes: z.string().trim().max(300, 'Keep notes under 300 characters.'),
  imageUrl: z.string().trim().max(2000),
})

interface ResourceForm {
  name: string
  kind: ResourceKind
  capacity: string
  quantity: string
  status: Resource['status']
  location: string
  notes: string
  imageUrl: string
}

const BLANK: ResourceForm = {
  name: '',
  kind: 'vessel',
  capacity: '12',
  quantity: '1',
  status: 'available',
  location: '',
  notes: '',
  imageUrl: '',
}

const KIND_OPTIONS: ResourceKind[] = ['vessel', 'vehicle', 'equipment', 'table', 'room', 'guide']

const STATUS_VERB: Record<Resource['status'], string> = {
  available: 'back in service',
  maintenance: 'sent to maintenance',
  retired: 'retired',
}

/* --------------------------------------------------------------------------
   Photo field — pick a file (kept as an object URL for the session) or paste
   a link. The preview is the same box the card will show.
   -------------------------------------------------------------------------- */

function PhotoField({
  value,
  fallback,
  onChange,
}: {
  value: string
  fallback?: ResourceImage
  onChange: (url: string) => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [url, setUrl] = React.useState('')
  const shown = value || fallback?.url || ''

  function pick(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('That file is not an image', { description: 'Choose a JPG, PNG or WebP.' })
      return
    }
    onChange(URL.createObjectURL(file))
  }

  return (
    <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-line bg-surface-sunken">
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="size-full object-cover" />
        ) : (
          <span className="grid size-full place-items-center text-faint">
            <ImagePlus aria-hidden="true" className="size-6" />
          </span>
        )}
        {!value && fallback ? (
          <span className="absolute inset-x-0 bottom-0 bg-ink-950/60 px-2 py-1 text-xs font-medium text-white">
            Using the activity photo
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <input ref={inputRef} type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" leftIcon={<ImagePlus />} onClick={() => inputRef.current?.click()}>
            Upload photo
          </Button>
          {value ? (
            <Button type="button" size="sm" variant="ghost" leftIcon={<Trash2 />} onClick={() => onChange('')}>
              Remove
            </Button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…or paste an image URL" aria-label="Image URL" />
          <Button
            type="button"
            size="md"
            variant="outline"
            disabled={!/^https?:\/\//.test(url.trim())}
            onClick={() => {
              onChange(url.trim())
              setUrl('')
            }}
          >
            Use
          </Button>
        </div>
        <p className="text-xs text-subtle">Landscape works best. The crew sees it on the run sheet and the storefront.</p>
      </div>
    </div>
  )
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export interface ResourcesPageClientProps {
  tenant: Tenant
  initialResources: Resource[]
  dependents: Record<string, Activity[]>
  upcomingUse: Record<string, number>
  upcomingRuns: Record<string, ResourceRun[]>
  imageFallbacks: Record<string, ResourceImage>
}

type KindFilter = 'all' | ResourceKind
type StatusFilter = 'all' | Resource['status']

const DEFAULT_SORT: DataTableSort = { id: 'name', dir: 'asc' }

/**
 * Everything here is fetched and derived server-side — this file never
 * imports `@/lib/demo` itself.
 */
export function ResourcesPageClient({
  tenant: CURRENT_TENANT,
  initialResources,
  dependents: DEPENDENTS,
  upcomingUse: UPCOMING_USE,
  upcomingRuns: UPCOMING_RUNS,
  imageFallbacks,
}: ResourcesPageClientProps) {
  const PEAK_USE = React.useMemo(() => Math.max(1, ...Object.values(UPCOMING_USE)), [UPCOMING_USE])
  const [resources, setResources] = React.useState<Resource[]>(initialResources)
  const [query, setQuery] = React.useState('')
  const [kindFilter, setKindFilter] = React.useState<KindFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [view, setView] = React.useState<ResourceView>('list')
  const [sort, setSort] = React.useState<DataTableSort>(DEFAULT_SORT)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [openId, setOpenId] = React.useState<string | null>(null)

  const [editing, setEditing] = React.useState<Resource | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState<ResourceForm>(BLANK)
  const [errors, setErrors] = React.useState<Partial<Record<keyof ResourceForm, string>>>({})
  const [saving, setSaving] = React.useState(false)
  const photoRef = React.useRef<HTMLDivElement>(null)

  /* ---------- derived ---------- */
  const imageFor = React.useCallback(
    (r: Resource): ResourceImage | null => (r.imageUrl ? { url: r.imageUrl, alt: r.name } : (imageFallbacks[r.id] ?? null)),
    [imageFallbacks],
  )

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return resources.filter((r) => {
      if (kindFilter !== 'all' && r.kind !== kindFilter) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        (r.location ?? '').toLowerCase().includes(q) ||
        (r.notes ?? '').toLowerCase().includes(q) ||
        RESOURCE_KIND_META[r.kind].label.toLowerCase().includes(q)
      )
    })
  }, [resources, query, kindFilter, statusFilter])

  const inService = resources.filter((r) => r.status === 'available')
  const maintenanceList = resources.filter((r) => r.status === 'maintenance')
  const retiredCount = resources.filter((r) => r.status === 'retired').length
  const unitsInFleet = resources.filter((r) => r.status !== 'retired').reduce((sum, r) => sum + r.quantity, 0)
  const seatsAtOnce = inService.reduce((sum, r) => sum + r.capacity * r.quantity, 0)
  const runsAhead = resources.reduce((sum, r) => sum + (UPCOMING_USE[r.id] ?? 0), 0)
  const busiest = resources.reduce<Resource | null>((top, r) => (!top || (UPCOMING_USE[r.id] ?? 0) > (UPCOMING_USE[top.id] ?? 0) ? r : top), null)
  const kindCounts = KIND_OPTIONS.map((kind) => ({ kind, count: resources.filter((r) => r.kind === kind).length })).filter((k) => k.count > 0)
  const filtersActive = query.trim().length > 0 || kindFilter !== 'all' || statusFilter !== 'all'

  const openResource = openId ? (resources.find((r) => r.id === openId) ?? null) : null

  /* ---------- status changes ---------- */
  const setStatus = React.useCallback((ids: string[], status: Resource['status']) => {
    if (ids.length === 0) return
    const set = new Set(ids)
    setResources((prev) => prev.map((r) => (set.has(r.id) ? { ...r, status } : r)))
    const names = ids.length === 1 ? null : `${ids.length} ${pluralize(ids.length, 'resource')}`
    toast.success(`${names ?? 'Resource'} ${STATUS_VERB[status]}`, {
      description:
        status === 'available'
          ? 'Departures that need it can sell again.'
          : status === 'maintenance'
            ? 'New departures that need it stay closed until it returns.'
            : 'Kept on the books for history; nothing can be scheduled on it.',
    })
  }, [])

  /* ---------- add / edit ---------- */
  function openAdd(kind: ResourceKind = kindFilter === 'all' ? 'vessel' : kindFilter) {
    setEditing(null)
    setForm({ ...BLANK, kind })
    setErrors({})
    setDialogOpen(true)
  }

  function openEdit(resource: Resource, focusPhoto = false) {
    setEditing(resource)
    setForm({
      name: resource.name,
      kind: resource.kind,
      capacity: String(resource.capacity),
      quantity: String(resource.quantity),
      status: resource.status,
      location: resource.location ?? '',
      notes: resource.notes ?? '',
      imageUrl: resource.imageUrl ?? '',
    })
    setErrors({})
    setDialogOpen(true)
    if (focusPhoto) {
      window.setTimeout(() => photoRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 80)
    }
  }

  function duplicate(resource: Resource) {
    const copy: Resource = { ...resource, id: `res_new_${Date.now().toString(36)}`, name: `${resource.name} (copy)` }
    setResources((prev) => {
      const index = prev.findIndex((r) => r.id === resource.id)
      const next = [...prev]
      next.splice(index + 1, 0, copy)
      return next
    })
    toast.success('Resource duplicated', { description: `${copy.name} is ready to rename.` })
    openEdit(copy)
  }

  const rowAction = React.useCallback(
    (action: ResourceRowAction, resource: Resource) => {
      switch (action) {
        case 'open':
          setOpenId(resource.id)
          return
        case 'edit':
          openEdit(resource)
          return
        case 'photo':
          openEdit(resource, true)
          return
        case 'duplicate':
          duplicate(resource)
          return
        case 'service':
          setStatus([resource.id], 'available')
          return
        case 'maintenance':
          setStatus([resource.id], 'maintenance')
          return
        case 'retire':
          setStatus([resource.id], 'retired')
          return
      }
    },
    // openEdit and duplicate close over state setters only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setStatus],
  )

  const bulkAction = (action: ResourceBulkAction) => {
    if (action === 'export') {
      toast.success(`Exported ${selectedIds.length} ${pluralize(selectedIds.length, 'resource')}`, {
        description: 'A CSV with capacity, units, status and location is on its way.',
      })
      return
    }
    setStatus(selectedIds, action === 'service' ? 'available' : action === 'retire' ? 'retired' : 'maintenance')
    setSelectedIds([])
  }

  function clearFilters() {
    setQuery('')
    setKindFilter('all')
    setStatusFilter('all')
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = resourceSchema.safeParse(form)

    if (!parsed.success) {
      const next: Partial<Record<keyof ResourceForm, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !(key in next)) next[key as keyof ResourceForm] = issue.message
      }
      setErrors(next)
      return
    }

    setSaving(true)
    window.setTimeout(() => {
      const payload: Resource = {
        id: editing?.id ?? `res_new_${resources.length + 1}`,
        tenantId: CURRENT_TENANT.id,
        name: parsed.data.name,
        kind: form.kind,
        capacity: parsed.data.capacity,
        quantity: parsed.data.quantity,
        status: form.status,
        location: parsed.data.location || undefined,
        notes: parsed.data.notes || undefined,
        imageUrl: parsed.data.imageUrl || undefined,
      }

      setResources((prev) => (editing ? prev.map((r) => (r.id === editing.id ? payload : r)) : [payload, ...prev]))
      setSaving(false)
      setDialogOpen(false)
      toast.success(editing ? 'Resource updated' : 'Resource added', {
        description: `${payload.name} is ${payload.status === 'available' ? 'available for scheduling' : 'saved but not schedulable'}.`,
      })
    }, 600)
  }

  const set = <K extends keyof ResourceForm>(key: K, value: ResourceForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        className="mb-0"
        title="Resources"
        description="Everything a departure needs: vessels, vehicles, kit and rooms. Keep it in service here and the calendar never double-books it."
        actions={
          <Button size="sm" leftIcon={<Plus />} onClick={() => openAdd()}>
            Add resource
          </Button>
        }
      />

      {/* ---------------- Inventory at a glance ---------------- */}
      <div className="grid divide-y divide-line-subtle overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x">
        <Stat
          icon={<Boxes className="size-4" />}
          label="Units in the fleet"
          value={formatNumber(unitsInFleet)}
          hint={`${resources.length} ${pluralize(resources.length, 'resource')} across ${kindCounts.length} ${pluralize(kindCounts.length, 'type')}`}
        />
        <Stat
          icon={<Users className="size-4" />}
          label="Seats at once"
          value={formatNumber(seatsAtOnce)}
          hint={`${inService.length} of ${resources.length} in service right now`}
        />
        <Stat
          icon={<CalendarClock className="size-4" />}
          label="Runs · next 14 days"
          value={formatNumber(runsAhead)}
          hint={busiest && (UPCOMING_USE[busiest.id] ?? 0) > 0 ? `Busiest: ${busiest.name.split(' (')[0]}` : 'Nothing assigned yet'}
        />
        <Stat
          icon={maintenanceList.length > 0 ? <Wrench className="size-4" /> : <CheckCircle2 className="size-4" />}
          label="Out of service"
          value={formatNumber(maintenanceList.length + retiredCount)}
          hint={
            maintenanceList.length === 0 && retiredCount === 0
              ? 'Whole fleet available'
              : `${maintenanceList.length} in maintenance · ${retiredCount} retired`
          }
          tone={maintenanceList.length > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* ---------------- Needs attention ---------------- */}
      {maintenanceList.length > 0 ? (
        <section
          aria-label="Resources in maintenance"
          className="rounded-2xl border border-[color-mix(in_oklab,var(--warning)_35%,var(--border))] bg-[color-mix(in_oklab,var(--warning)_6%,var(--surface))]"
        >
          <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
            <span className="grid size-6 place-items-center rounded-md bg-warning-soft text-warning">
              <Wrench className="size-3.5" aria-hidden="true" />
            </span>
            <h3 className="text-[0.8125rem] font-semibold text-foreground">
              {maintenanceList.length} {pluralize(maintenanceList.length, 'resource')} in maintenance
            </h3>
            <span className="text-xs text-subtle">Departures that need {maintenanceList.length === 1 ? 'it' : 'them'} stay closed for sale.</span>
          </div>
          <ul className="divide-y divide-line-subtle border-t border-line-subtle">
            {maintenanceList.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <p className="truncate text-[0.8125rem] font-semibold text-foreground">{r.name}</p>
                  <p className="truncate text-xs text-muted">{r.notes ?? 'No note on what is being done.'}</p>
                </button>
                <span className="text-xs text-subtle tabular-nums">
                  {(DEPENDENTS[r.id] ?? []).length} {pluralize((DEPENDENTS[r.id] ?? []).length, 'activity', 'activities')} waiting
                </span>
                <Button size="xs" variant="secondary" leftIcon={<CheckCircle2 />} onClick={() => setStatus([r.id], 'available')}>
                  Return to service
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---------------- Toolbar ---------------- */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            label="Search resources"
            placeholder="Search name, location or notes…"
            debounceMs={120}
            value={query}
            onValueChange={setQuery}
            className="w-full sm:w-72"
          />
          <Segmented
            size="sm"
            label="Filter by status"
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All', count: resources.length },
              { value: 'available', label: 'In service', count: inService.length },
              { value: 'maintenance', label: 'Maintenance', count: maintenanceList.length },
              { value: 'retired', label: 'Retired', count: retiredCount },
            ]}
          />
          <Segmented
            size="sm"
            label="View"
            value={view}
            onValueChange={setView}
            className="ml-auto"
            options={[
              { value: 'list', label: 'List', icon: List },
              { value: 'cards', label: 'Cards', icon: LayoutGrid },
            ]}
          />
        </div>

        <ToggleGroup
          type="single"
          size="sm"
          className="flex-wrap gap-1.5"
          aria-label="Filter by type"
          value={kindFilter}
          onValueChange={(value) => setKindFilter((value || 'all') as KindFilter)}
        >
          <ToggleGroupItem value="all">
            All types
            <span className="text-faint tabular-nums">{resources.length}</span>
          </ToggleGroupItem>
          {kindCounts.map(({ kind, count }) => {
            const meta = RESOURCE_KIND_META[kind]
            const Icon = meta.icon
            return (
              <ToggleGroupItem key={kind} value={kind}>
                <Icon aria-hidden="true" />
                {meta.plural}
                <span className="text-faint tabular-nums">{count}</span>
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </div>

      {/* ---------------- Ledger / cards ---------------- */}
      {view === 'list' ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-subtle">
            Showing {visible.length} of {resources.length} · click a row for the full record
            {filtersActive ? (
              <>
                {' '}
                ·{' '}
                <button type="button" onClick={clearFilters} className="font-medium text-primary hover:underline">
                  clear filters
                </button>
              </>
            ) : null}
          </p>
          <ResourceTable
            rows={visible}
            dependents={DEPENDENTS}
            upcomingUse={UPCOMING_USE}
            peakUse={PEAK_USE}
            imageFor={imageFor}
            sort={sort}
            onSortChange={setSort}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onOpen={(r) => setOpenId(r.id)}
            onAction={rowAction}
            onAdd={openAdd}
            onClearFilters={clearFilters}
          />
        </div>
      ) : (
        <ResourceGrid
          resources={visible}
          dependents={DEPENDENTS}
          upcomingUse={UPCOMING_USE}
          peakUse={PEAK_USE}
          imageFallbacks={imageFallbacks}
          onEdit={(r) => openEdit(r)}
          onAddPhoto={(r) => openEdit(r, true)}
          onAdd={openAdd}
        />
      )}

      <ResourceBulkBar count={selectedIds.length} onClear={() => setSelectedIds([])} onAction={bulkAction} />

      {/* ---------------- Detail ---------------- */}
      <ResourceSheet
        resource={openResource}
        image={openResource ? imageFor(openResource) : null}
        dependents={openResource ? (DEPENDENTS[openResource.id] ?? []) : []}
        runs={openResource ? (UPCOMING_RUNS[openResource.id] ?? []) : []}
        upcoming={openResource ? (UPCOMING_USE[openResource.id] ?? 0) : 0}
        peakUse={PEAK_USE}
        open={openResource !== null}
        onOpenChange={(open) => {
          if (!open) setOpenId(null)
        }}
        onEdit={(r) => openEdit(r)}
        onPhoto={(r) => openEdit(r, true)}
        onStatus={(r, status) => setStatus([r.id], status)}
      />

      {/* ---------------- Add / edit ---------------- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="lg">
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-col">
            <DialogHeader divider>
              <DialogTitle className="flex items-center gap-2">
                <Anchor className="size-4 text-primary" aria-hidden="true" />
                {editing ? `Edit ${editing.name}` : 'Add a resource'}
              </DialogTitle>
              <DialogDescription>Capacity is per unit. A fleet of eight two-seat jet skis is capacity 2, quantity 8.</DialogDescription>
            </DialogHeader>

            <DialogBody className="py-5">
              <FieldGroup columns={2}>
                <Field label="Photo" optional className="sm:col-span-2">
                  <div ref={photoRef}>
                    <PhotoField value={form.imageUrl} fallback={editing ? imageFallbacks[editing.id] : undefined} onChange={(url) => set('imageUrl', url)} />
                  </div>
                </Field>

                <Field label="Name" required error={errors.name} className="sm:col-span-2" description="Include the model or size — the crew reads this on the run sheet.">
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Alii Nui (49ft sailing catamaran)" />
                </Field>

                <Field label="Type" required error={errors.kind}>
                  {({ id }) => (
                    <Select value={form.kind} onValueChange={(v) => set('kind', v as ResourceKind)}>
                      <SelectTrigger id={id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KIND_OPTIONS.map((k) => (
                          <SelectItem key={k} value={k}>
                            {RESOURCE_KIND_META[k].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>

                <Field label="Status" required>
                  {({ id }) => (
                    <Select value={form.status} onValueChange={(v) => set('status', v as Resource['status'])}>
                      <SelectTrigger id={id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available" description="Schedulable right now">
                          In service
                        </SelectItem>
                        <SelectItem value="maintenance" description="Blocked from new departures">
                          In maintenance
                        </SelectItem>
                        <SelectItem value="retired" description="Kept for historical records">
                          Retired
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </Field>

                <Field label="Capacity per unit" required error={errors.capacity}>
                  <Input type="number" min={1} max={500} value={form.capacity} onChange={(e) => set('capacity', e.target.value)} suffix="seats" />
                </Field>

                <Field label="Units in the fleet" required error={errors.quantity}>
                  <Input type="number" min={1} max={200} value={form.quantity} onChange={(e) => set('quantity', e.target.value)} suffix="units" />
                </Field>

                <Field label="Location" optional error={errors.location} className="sm:col-span-2" description="Slip, ramp, trailer or storage point.">
                  <Input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Maalaea Harbor, Slip 61" />
                </Field>

                <Field label="Notes" optional error={errors.notes} className="sm:col-span-2" hint={`${form.notes.length}/300`}>
                  <Textarea
                    rows={3}
                    maxLength={300}
                    value={form.notes}
                    onChange={(e) => set('notes', e.target.value)}
                    placeholder="Certifications, service intervals, anything the crew should know."
                  />
                </Field>
              </FieldGroup>
            </DialogBody>

            <DialogFooter divider>
              <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} rightIcon={editing ? undefined : <ArrowRight />}>
                {editing ? 'Save changes' : 'Add resource'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ========================================================================== */

function Stat({
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  tone?: 'default' | 'warning' | 'success'
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg',
          tone === 'warning' ? 'bg-warning-soft text-warning' : tone === 'success' ? 'bg-success-soft text-success' : 'bg-primary-soft text-primary',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-subtle">{label}</p>
        <p className="mt-0.5 font-display text-xl leading-none font-semibold tracking-[-0.02em] text-foreground tabular-nums">{value}</p>
        <p className="mt-1.5 truncate text-xs text-subtle">{hint}</p>
      </div>
    </div>
  )
}
