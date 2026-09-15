'use client'

import * as React from 'react'
import { Anchor, ImagePlus, LayoutGrid, List, Plus, Ship, Trash2, TriangleAlert, Users, Wrench } from 'lucide-react'
import { z } from 'zod'

import { PageHeader } from '@/components/dashboard/page-header'
import {
  RESOURCE_KIND_META,
  ResourceGrid,
  type ResourceImage,
  type ResourceView,
} from '@/components/dashboard/resources/resource-grid'
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
import { Field, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
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
          <span className="absolute inset-x-0 bottom-0 bg-ink-950/60 px-2 py-1 text-[0.625rem] font-medium text-white">
            Using the activity photo
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => pick(e.target.files?.[0])}
        />
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
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="…or paste an image URL"
            aria-label="Image URL"
          />
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
  imageFallbacks: Record<string, ResourceImage>
}

/**
 * Everything here is fetched and derived server-side — this file never
 * imports `@/lib/demo` itself.
 */
export function ResourcesPageClient({
  tenant: CURRENT_TENANT,
  initialResources,
  dependents: DEPENDENTS,
  upcomingUse: UPCOMING_USE,
  imageFallbacks,
}: ResourcesPageClientProps) {
  const PEAK_USE = React.useMemo(() => Math.max(1, ...Object.values(UPCOMING_USE)), [UPCOMING_USE])
  const [resources, setResources] = React.useState<Resource[]>(initialResources)
  const [query, setQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<'all' | Resource['status']>('all')
  const [view, setView] = React.useState<ResourceView>('grid')

  const [editing, setEditing] = React.useState<Resource | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState<ResourceForm>(BLANK)
  const [errors, setErrors] = React.useState<Partial<Record<keyof ResourceForm, string>>>({})
  const [saving, setSaving] = React.useState(false)
  const photoRef = React.useRef<HTMLDivElement>(null)

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return resources.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        (r.location ?? '').toLowerCase().includes(q) ||
        RESOURCE_KIND_META[r.kind].label.toLowerCase().includes(q)
      )
    })
  }, [resources, query, statusFilter])

  const totalSeats = resources.filter((r) => r.status === 'available').reduce((sum, r) => sum + r.capacity * r.quantity, 0)
  const maintenanceList = resources.filter((r) => r.status === 'maintenance')
  const withPhoto = resources.filter((r) => r.imageUrl || imageFallbacks[r.id]).length

  function openAdd(kind: ResourceKind = 'vessel') {
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
        description="Vessels, vehicles, equipment and rooms. A departure consumes what its activity requires, so nothing can be double-booked."
        actions={
          <Button size="sm" leftIcon={<Plus />} onClick={() => openAdd()}>
            Add resource
          </Button>
        }
      />

      {/* ---------------- Summary ---------------- */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryTile
          icon={<Ship className="size-4" />}
          value={formatNumber(resources.length)}
          label="Resources"
          hint={`${KIND_OPTIONS.filter((k) => resources.some((r) => r.kind === k)).length} categories · ${withPhoto} with a photo`}
        />
        <SummaryTile
          icon={<Users className="size-4" />}
          value={formatNumber(totalSeats)}
          label="Seats at once"
          hint="Across everything in service"
        />
        <SummaryTile
          icon={maintenanceList.length > 0 ? <Wrench className="size-4" /> : <TriangleAlert className="size-4" />}
          value={formatNumber(maintenanceList.length)}
          label="In maintenance"
          hint={
            maintenanceList.length === 0
              ? 'Whole fleet is in service'
              : `${maintenanceList.map((r) => r.name.split(' (')[0]).join(', ')} — departures that need ${
                  maintenanceList.length === 1 ? 'it' : 'them'
                } stay closed for sale`
          }
          tone={maintenanceList.length > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* ---------------- Toolbar ---------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          label="Search resources"
          placeholder="Search by name, location or type…"
          debounceMs={120}
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
            { value: 'available', label: 'In service', count: resources.filter((r) => r.status === 'available').length },
            { value: 'maintenance', label: 'Maintenance', count: maintenanceList.length },
            { value: 'retired', label: 'Retired', count: resources.filter((r) => r.status === 'retired').length },
          ]}
        />
        <Segmented
          size="sm"
          label="View"
          value={view}
          onValueChange={setView}
          className="ml-auto"
          options={[
            { value: 'grid', label: 'Cards', icon: LayoutGrid },
            { value: 'list', label: 'List', icon: List },
          ]}
        />
      </div>

      {/* ---------------- Grid / list ---------------- */}
      <ResourceGrid
        resources={visible}
        dependents={DEPENDENTS}
        upcomingUse={UPCOMING_USE}
        peakUse={PEAK_USE}
        imageFallbacks={imageFallbacks}
        view={view}
        onEdit={(r) => openEdit(r)}
        onAddPhoto={(r) => openEdit(r, true)}
        onAdd={openAdd}
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
              <DialogDescription>
                Capacity is per unit. A fleet of eight two-seat jet skis is capacity 2, quantity 8.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="py-5">
              <FieldGroup columns={2}>
                <Field label="Photo" optional className="sm:col-span-2">
                  <div ref={photoRef}>
                    <PhotoField
                      value={form.imageUrl}
                      fallback={editing ? imageFallbacks[editing.id] : undefined}
                      onChange={(url) => set('imageUrl', url)}
                    />
                  </div>
                </Field>

                <Field
                  label="Name"
                  required
                  error={errors.name}
                  className="sm:col-span-2"
                  description="Include the model or size — the crew reads this on the run sheet."
                >
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
              <Button type="submit" loading={saving}>
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

function SummaryTile({
  icon,
  value,
  label,
  hint,
  tone = 'default',
}: {
  icon: React.ReactNode
  value: string
  label: string
  hint: string
  tone?: 'default' | 'warning'
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-7 shrink-0 place-items-center rounded-lg',
            tone === 'warning' ? 'bg-warning-soft text-warning' : 'bg-primary-soft text-primary',
          )}
        >
          {icon}
        </span>
        <span className="text-[0.8125rem] font-medium text-muted">{label}</span>
      </div>
      <div className="mt-3 rounded-xl bg-well px-4 py-3">
        <p className="font-display text-2xl leading-none font-semibold tracking-[-0.03em] text-foreground">{value}</p>
        <p className="mt-1.5 truncate text-[0.6875rem] text-subtle">{hint}</p>
      </div>
    </div>
  )
}
