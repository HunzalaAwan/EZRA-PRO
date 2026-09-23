'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Check,
  MapPin,
  MoreHorizontal,
  Pencil,
  PauseCircle,
  PlayCircle,
  Plus,
  RotateCcw,
  Star,
  Trash2,
  X,
} from 'lucide-react'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useLocations, type LocationInput } from '@/hooks/use-locations'
import { locationAddress } from '@/lib/locations'
import { cn, pluralize } from '@/lib/utils'
import type { Location, Tenant } from '@/types'

/* ==========================================================================
   LOCATIONS SETTINGS
   The places a business runs from. Activities tick the locations they leave from
   in their Schedule step; guests pick one at checkout and see that location's
   dates and times.
   ========================================================================== */

export interface LocationUsage {
  count: number
  names: string[]
}

export interface LocationsSettingsClientProps {
  tenant: Tenant
  seeded: Location[]
  /** Activities per location id, from the seeded catalogue. */
  usage: Record<string, LocationUsage>
}

const COMMON_ZONES = [
  'Pacific/Honolulu',
  'America/Anchorage',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'America/Mexico_City',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Athens',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Australia/Perth',
  'Australia/Brisbane',
  'Australia/Sydney',
  'Pacific/Auckland',
]

function zoneLabel(zone: string) {
  const name = zone.replace(/_/g, ' ')
  try {
    const offset = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
      .formatToParts(new Date())
      .find((part) => part.type === 'timeZoneName')?.value
    return offset ? `${name} (${offset})` : name
  } catch {
    return name
  }
}

interface FormState {
  name: string
  addressLine: string
  city: string
  timezone: string
  phone: string
  notes: string
  isDefault: boolean
}

type FormErrors = Partial<Record<keyof FormState, string>>

function emptyForm(timezone: string): FormState {
  return { name: '', addressLine: '', city: '', timezone, phone: '', notes: '', isDefault: false }
}

function formFrom(location: Location, fallbackZone: string): FormState {
  return {
    name: location.name,
    addressLine: location.addressLine,
    city: location.city,
    timezone: location.timezone ?? fallbackZone,
    phone: location.phone ?? '',
    notes: location.notes ?? '',
    isDefault: location.isDefault,
  }
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {}
  if (form.name.trim().length < 2) errors.name = 'Give the location a name guests will recognise.'
  if (form.addressLine.trim().length < 4) errors.addressLine = 'Guests navigate to this — add the street address.'
  if (form.city.trim().length < 2) errors.city = 'Add the town or city.'
  return errors
}

export function LocationsSettingsClient({ tenant, seeded, usage }: LocationsSettingsClientProps) {
  const { locations, add, update, remove, makeDefault, reset, hasEdits } = useLocations(tenant.id, seeded)

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<FormState>(() => emptyForm(tenant.timezone))
  const [errors, setErrors] = React.useState<FormErrors>({})

  const zones = React.useMemo(() => {
    const set = new Set<string>([tenant.timezone, ...COMMON_ZONES, ...locations.map((site) => site.timezone).filter((zone): zone is string => Boolean(zone))])
    return Array.from(set)
  }, [tenant.timezone, locations])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm(tenant.timezone))
    setErrors({})
    setDialogOpen(true)
  }

  const openEdit = (location: Location) => {
    setEditingId(location.id)
    setForm(formFrom(location, tenant.timezone))
    setErrors({})
    setDialogOpen(true)
  }

  const patch = (change: Partial<FormState>) => setForm((current) => ({ ...current, ...change }))

  const save = () => {
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const input: LocationInput = {
      name: form.name,
      addressLine: form.addressLine,
      city: form.city,
      timezone: form.timezone === tenant.timezone ? undefined : form.timezone,
      phone: form.phone,
      notes: form.notes,
      isDefault: form.isDefault,
    }

    if (editingId) {
      update(editingId, {
        name: input.name.trim(),
        addressLine: input.addressLine.trim(),
        city: input.city.trim(),
        timezone: input.timezone,
        phone: input.phone?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        isDefault: input.isDefault,
      })
      toast.success(`${input.name.trim()} updated`, { description: 'Activities and the storefront show the new details.' })
    } else {
      const created = add(input)
      toast.success(`${created.name} added`, {
        description: 'Tick it on any activity in the Schedule step to start selling from there.',
      })
    }
    setDialogOpen(false)
  }

  const handleRemove = (location: Location) => {
    const used = usage[location.id]?.count ?? 0
    if (location.isDefault) {
      toast.error('Pick another default first', { description: 'The default location is where activities run unless they say otherwise.' })
      return
    }
    if (used > 0) {
      toast.error(`${location.name} is still in use`, {
        description: `${used} ${pluralize(used, 'activity', 'activities')} run from here. Move them to another location first.`,
      })
      return
    }
    remove(location.id)
    toast(`${location.name} removed`)
  }

  const handleDefault = (location: Location) => {
    makeDefault(location.id)
    toast.success(`${location.name} is now the default location`)
  }

  const handleStatus = (location: Location) => {
    const paused = location.status === 'paused'
    update(location.id, { status: paused ? 'active' : 'paused' })
    toast(paused ? `${location.name} is taking bookings again` : `${location.name} paused`, {
      description: paused ? undefined : 'Guests will not see this location at checkout until you resume it.',
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Locations</CardTitle>
            <CardDescription>
              The places {tenant.name} runs from. Each has its own address and time zone; activities choose
              which locations they leave from and the times at each.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {hasEdits ? (
              <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={() => { reset(); toast('Seeded locations restored') }}>
                Restore
              </Button>
            ) : null}
            <Button size="sm" leftIcon={<Plus />} onClick={openCreate}>
              Add location
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
            {locations.map((location) => {
              const used = usage[location.id]
              const paused = location.status === 'paused'
              return (
                <li key={location.id} className={cn('flex items-start gap-4 px-5 py-4', paused && 'opacity-70')}>
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid size-10 shrink-0 place-items-center rounded-xl',
                      location.isDefault ? 'bg-primary-soft text-primary' : 'bg-surface-sunken text-subtle',
                    )}
                  >
                    <MapPin className="size-[1.125rem]" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{location.name}</p>
                      {location.isDefault ? (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">Default</span>
                      ) : null}
                      {paused ? (
                        <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">Paused</span>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{locationAddress(location)}</p>
                    <p className="mt-1 text-xs text-subtle">
                      {zoneLabel(location.timezone ?? tenant.timezone)}
                      {location.phone ? ` · ${location.phone}` : ''}
                      {used
                        ? ` · ${used.count} ${pluralize(used.count, 'activity', 'activities')}: ${used.names.join(', ')}${used.count > used.names.length ? '…' : ''}`
                        : ' · No activities yet'}
                    </p>
                    {location.notes ? <p className="mt-1 text-xs text-subtle">{location.notes}</p> : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => openEdit(location)} className="hidden sm:inline-flex">
                      Edit
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton aria-label={`More for ${location.name}`} size="sm" variant="ghost">
                          <MoreHorizontal aria-hidden="true" />
                        </IconButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onSelect={() => openEdit(location)} className="sm:hidden">
                          <Pencil aria-hidden="true" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled={location.isDefault} onSelect={() => handleDefault(location)}>
                          <Star aria-hidden="true" />
                          Make default
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleStatus(location)}>
                          {paused ? <PlayCircle aria-hidden="true" /> : <PauseCircle aria-hidden="true" />}
                          {paused ? 'Resume bookings' : 'Pause bookings'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem tone="danger" onSelect={() => handleRemove(location)}>
                          <Trash2 aria-hidden="true" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How locations work</CardTitle>
          <CardDescription>One storefront, several places to leave from.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted sm:grid-cols-3">
          <div>
            <p className="font-medium text-foreground">Activities pick their locations</p>
            <p className="mt-1 leading-relaxed">
              In an activity&rsquo;s Schedule step, tick every location it runs from. A location can keep the usual start times or set its own.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">Guests choose at checkout</p>
            <p className="mt-1 leading-relaxed">
              When an activity runs from more than one location, the booking widget asks where first and shows only that location&rsquo;s dates and times.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">The desk stays in one place</p>
            <p className="mt-1 leading-relaxed">
              Reservations, the schedule and the manifest carry the location on every departure, so a Lahaina run never gets crewed from Kihei.
            </p>
          </div>
          <div className="sm:col-span-3">
            <Button asChild variant="outline" size="sm" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/activities">Open the activities</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent size="md">
          <DialogHeader divider>
            <DialogTitle>{editingId ? `Edit ${form.name || 'location'}` : 'Add a location'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Guests see the address on their confirmation and the storefront.'
                : 'A new place to run activities from. You choose which activities leave from here on each one.'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4 py-4">
            <Field label="Name" required error={errors.name} description="Short and recognisable: the harbour, the beach, the shop.">
              {(control) => (
                <Input {...control} value={form.name} placeholder="Lahaina Harbor" onChange={(event) => patch({ name: event.target.value })} />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Field label="Street address" required error={errors.addressLine}>
                {(control) => (
                  <Input {...control} value={form.addressLine} placeholder="675 Wharf St" onChange={(event) => patch({ addressLine: event.target.value })} />
                )}
              </Field>
              <Field label="Town or city" required error={errors.city}>
                {(control) => (
                  <Input {...control} value={form.city} placeholder="Lahaina, HI 96761" onChange={(event) => patch({ city: event.target.value })} />
                )}
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Time zone" description="Departure times at this location are shown in it.">
                <Select value={form.timezone} onValueChange={(value) => patch({ timezone: value })}>
                  <SelectTrigger aria-label="Time zone">
                    <SelectValue placeholder="Time zone" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zoneLabel(zone)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Phone" optional>
                {(control) => (
                  <Input {...control} type="tel" value={form.phone} placeholder="+1 (808) 555-0100" onChange={(event) => patch({ phone: event.target.value })} />
                )}
              </Field>
            </div>
            <Field label="Directions for guests" optional description="Parking, the check-in desk, what to look for.">
              {(control) => (
                <Textarea {...control} rows={2} value={form.notes} placeholder="Metered parking on Front St; the harbor is a two-minute walk." onChange={(event) => patch({ notes: event.target.value })} />
              )}
            </Field>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
              <span>
                <span className="block text-sm font-medium text-foreground">Default location</span>
                <span className="block text-xs text-subtle">Where activities run unless they say otherwise.</span>
              </span>
              <Switch checked={form.isDefault} onCheckedChange={(checked) => patch({ isDefault: checked })} aria-label="Default location" />
            </label>
          </DialogBody>
          <DialogFooter divider>
            <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" leftIcon={<Check />} onClick={save}>
              {editingId ? 'Save changes' : 'Add location'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
