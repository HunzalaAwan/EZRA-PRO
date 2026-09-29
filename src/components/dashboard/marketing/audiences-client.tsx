'use client'

import * as React from 'react'
import { Check, Copy, Download, Pencil, Plus, Trash2, Users, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toaster'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import type { MarketingData } from '@/lib/data/guest-marketing'
import { EMPTY_FILTER, SEGMENT_LABEL, audienceSize, describeFilter, type Audience, type AudienceFilter, type MarketingContact } from '@/lib/marketing'
import { cn, formatDateTime } from '@/lib/utils'
import type { Customer, Tenant } from '@/types'

/* ==========================================================================
   AUDIENCES
   Who a campaign or automation goes to. Six ready-made groups, plus your
   own built from plain rules: what they booked, when they last came, how
   much they spent, where they live. Counts update as you change a rule.
   ========================================================================== */

export function AudiencesClient({ tenant: tenantRecord, nowIso, data }: { tenant: Tenant; nowIso: string; data: MarketingData }) {
  const tenant = useMarketingTenant(tenantRecord)
  const marketing = useMarketing(tenant, nowIso)
  const [editing, setEditing] = React.useState<Audience | null>(null)
  const activityName = (slug: string) => data.activities.find((activity) => activity.slug === slug)?.name ?? slug
  const subscribed = data.contacts.filter((contact) => contact.emailOptIn || contact.smsOptIn)

  const exportCsv = (audience: Audience) => {
    const { members } = audienceSize(data.contacts, audience.filter, nowIso)
    const rows = [['First name', 'Last name', 'Email', 'Phone', 'Country', 'Bookings', 'Spend', 'Email', 'Texts']]
    for (const member of members) rows.push([member.firstName, member.lastName, member.email, member.phone, member.country, String(member.totalBookings), String(member.spend), member.emailOptIn ? 'yes' : 'no', member.smsOptIn ? 'yes' : 'no'])
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    link.download = `${audience.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success(`${members.length} guests exported`)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Guests', value: data.contacts.length },
          { label: 'Subscribed', value: subscribed.length },
          { label: 'Email on', value: data.contacts.filter((contact) => contact.emailOptIn).length },
          { label: 'Texts on', value: data.contacts.filter((contact) => contact.smsOptIn).length },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface px-4 py-3.5">
            <p className="text-xs font-medium text-subtle">{tile.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular text-foreground">{tile.value.toLocaleString('en-US')}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Audiences</CardTitle>
            <CardDescription>Only subscribed guests count. Anyone who unsubscribes drops out of every audience.</CardDescription>
          </div>
          <Button
            leftIcon={<Plus />}
            onClick={() => setEditing({ id: `aud_${Date.now().toString(36)}`, name: '', description: '', filter: EMPTY_FILTER })}
          >
            New audience
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="flex list-none flex-col divide-y divide-line-subtle border-t border-line-subtle p-0">
            {marketing.audiences.map((audience) => {
              const size = audienceSize(data.contacts, audience.filter, nowIso)
              return (
                <li key={audience.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <span aria-hidden="true" className="hidden size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-subtle sm:grid">
                    <Users className="size-[1.125rem]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{audience.name}</p>
                      {audience.builtIn ? <Badge variant="neutral" size="sm">Ready-made</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-subtle">{audience.description || describeFilter(audience.filter, activityName)}</p>
                  </div>
                  <dl className="grid grid-cols-3 gap-4 text-right text-xs sm:w-60">
                    {[
                      ['Guests', size.count],
                      ['Email', size.email],
                      ['Texts', size.sms],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-subtle">{label}</dt>
                        <dd className="mt-0.5 text-sm font-semibold tabular text-foreground">{Number(value).toLocaleString('en-US')}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="flex shrink-0 items-center gap-1">
                    {audience.builtIn ? null : (
                      <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => setEditing({ ...audience })}>Edit</Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Copy ${audience.name}`}
                      onClick={() => setEditing({ ...audience, id: `aud_${Date.now().toString(36)}`, name: `${audience.name} (copy)`, builtIn: false })}
                    >
                      <Copy className="size-4" aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Export ${audience.name}`} onClick={() => exportCsv(audience)}>
                      <Download className="size-4" aria-hidden="true" />
                    </Button>
                    {audience.builtIn ? null : (
                      <Button variant="ghost" size="sm" aria-label={`Delete ${audience.name}`} onClick={() => { marketing.removeAudience(audience.id); toast('Audience deleted') }}>
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle>New from your forms</CardTitle>
          <CardDescription>People who joined the list on your storefront but have not booked yet. They get the welcome automation.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {marketing.signups.length === 0 ? (
            <p className="border-t border-line-subtle px-5 py-4 text-sm text-subtle">No sign-ups yet. Turn on the pop-up in Sign-up forms to start growing the list.</p>
          ) : (
            <ul className="flex list-none flex-col divide-y divide-line-subtle border-t border-line-subtle p-0">
              {marketing.signups.slice(0, 20).map((signup) => (
                <li key={signup.email} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span className="font-medium text-foreground">{signup.email}</span>
                  <span className="text-xs text-subtle">
                    {signup.source === 'popup' ? 'Pop-up' : signup.source === 'footer' ? 'Footer' : 'Checkout'} · {formatDateTime(signup.at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {editing ? (
        <AudienceEditor
          audience={editing}
          contacts={data.contacts}
          nowIso={nowIso}
          activities={data.activities}
          countries={data.countries}
          tags={data.tags}
          onClose={() => setEditing(null)}
          onSave={(audience) => {
            marketing.saveAudience(audience)
            toast.success(`${audience.name} saved`)
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}

/* ==========================================================================
   Rule builder
   ========================================================================== */

function Chips<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T[]; onChange: (next: T[]) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const on = value.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((entry) => entry !== option.value) : [...value, option.value])}
            className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors', on ? 'border-primary bg-primary-soft/40 text-foreground' : 'border-line text-muted hover:text-foreground')}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function AudienceEditor({
  audience,
  contacts,
  nowIso,
  activities,
  countries,
  tags,
  onClose,
  onSave,
}: {
  audience: Audience
  contacts: MarketingContact[]
  nowIso: string
  activities: { slug: string; name: string }[]
  countries: string[]
  tags: string[]
  onClose: () => void
  onSave: (audience: Audience) => void
}) {
  const [draft, setDraft] = React.useState<Audience>(audience)
  const filter = draft.filter
  const setFilter = (patch: Partial<AudienceFilter>) => setDraft((current) => ({ ...current, filter: { ...current.filter, ...patch } }))
  const size = audienceSize(contacts, filter, nowIso)
  const activityName = (slug: string) => activities.find((activity) => activity.slug === slug)?.name ?? slug

  return (
    <Sheet open onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{audience.name ? audience.name : 'New audience'}</SheetTitle>
          <SheetDescription>Guests must match every rule you set. Leave a rule empty to skip it.</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-6">
          <Field label="Name">
            {(control) => <Input {...control} value={draft.name} placeholder="Snorkellers who have not been back" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}
          </Field>

          <div className="rounded-xl border border-primary/30 bg-primary-soft/20 px-4 py-3">
            <p className="text-sm font-semibold text-foreground">
              {size.count.toLocaleString('en-US')} {size.count === 1 ? 'guest' : 'guests'} match
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {size.email.toLocaleString('en-US')} by email · {size.sms.toLocaleString('en-US')} by text · {describeFilter(filter, activityName)}
            </p>
            {size.members.length > 0 ? (
              <p className="mt-2 truncate text-xs text-subtle">
                {size.members.slice(0, 4).map((member) => `${member.firstName} ${member.lastName}`).join(', ')}
                {size.members.length > 4 ? ` and ${size.members.length - 4} more` : ''}
              </p>
            ) : null}
          </div>

          <section className="flex flex-col gap-2">
            <p className="text-[0.8125rem] font-medium">Type of guest</p>
            <Chips
              label="Type of guest"
              options={(Object.keys(SEGMENT_LABEL) as Customer['segment'][]).map((value) => ({ value, label: SEGMENT_LABEL[value] }))}
              value={filter.segments}
              onChange={(segments) => setFilter({ segments })}
            />
          </section>

          <section className="flex flex-col gap-2">
            <p className="text-[0.8125rem] font-medium">Booked</p>
            <Chips label="Booked" options={activities.map((activity) => ({ value: activity.slug, label: activity.name }))} value={filter.activitySlugs} onChange={(activitySlugs) => setFilter({ activitySlugs })} />
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Last trip">
              <Select
                value={filter.lastTrip ? filter.lastTrip.op : 'any'}
                onValueChange={(value) => setFilter({ lastTrip: value === 'any' ? undefined : { op: value as 'within' | 'over', days: filter.lastTrip?.days ?? 90 } })}
              >
                <SelectTrigger aria-label="Last trip"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any time</SelectItem>
                  <SelectItem value="within">Within the last…</SelectItem>
                  <SelectItem value="over">More than … ago</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {filter.lastTrip ? (
              <Field label="Days">
                {(control) => <Input {...control} type="number" min={1} suffix="days" value={filter.lastTrip?.days ?? 90} onChange={(e) => setFilter({ lastTrip: { op: filter.lastTrip!.op, days: Math.max(1, Number(e.target.value) || 1) } })} />}
              </Field>
            ) : null}
            <Field label="At least this many bookings" optional>
              {(control) => <Input {...control} type="number" min={0} placeholder="Any" value={filter.minBookings || ''} onChange={(e) => setFilter({ minBookings: Number(e.target.value) || undefined })} />}
            </Field>
            <Field label="Spent at least" optional>
              {(control) => <Input {...control} type="number" min={0} placeholder="Any" value={filter.minSpend || ''} onChange={(e) => setFilter({ minSpend: Number(e.target.value) || undefined })} />}
            </Field>
          </section>

          {countries.length > 1 ? (
            <section className="flex flex-col gap-2">
              <p className="text-[0.8125rem] font-medium">Lives in</p>
              <Chips label="Lives in" options={countries.map((value) => ({ value, label: value }))} value={filter.countries} onChange={(next) => setFilter({ countries: next })} />
            </section>
          ) : null}

          {tags.length > 0 ? (
            <section className="flex flex-col gap-2">
              <p className="text-[0.8125rem] font-medium">Tagged</p>
              <Chips label="Tagged" options={tags.map((value) => ({ value, label: value }))} value={filter.tags} onChange={(next) => setFilter({ tags: next })} />
            </section>
          ) : null}

          <Field label="Reachable by">
            <Select value={filter.consent} onValueChange={(value) => setFilter({ consent: value as AudienceFilter['consent'] })}>
              <SelectTrigger aria-label="Reachable by" className="sm:w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="either">Email or text</SelectItem>
                <SelectItem value="email">Email only</SelectItem>
                <SelectItem value="sms">Text only</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </SheetBody>
        <SheetFooter>
          <Button variant="ghost" leftIcon={<X />} onClick={onClose}>Cancel</Button>
          <Button leftIcon={<Check />} disabled={draft.name.trim().length < 2} onClick={() => onSave({ ...draft, name: draft.name.trim(), description: describeFilter(draft.filter, activityName), builtIn: false })}>
            Save audience
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
