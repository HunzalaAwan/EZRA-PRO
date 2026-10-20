'use client'

import * as React from 'react'
import { Check, Copy, Download, Eye, Mail, MessageSquare, MoreHorizontal, Pencil, Plus, Trash2, UserCheck, UserPlus, Users, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatCard, StatGrid } from '@/components/ui/stat'
import { Textarea } from '@/components/ui/textarea'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toaster'
import { ConditionBuilder } from '@/components/dashboard/marketing/flow-builder/condition-builder'
import { useFlows } from '@/hooks/use-flows'
import { useMarketing, useMarketingTenant, type Signup } from '@/hooks/use-marketing'
import type { MarketingData } from '@/lib/data/guest-marketing'
import { describeCondition } from '@/lib/flows/describe'
import type { ConditionGroup, Flow } from '@/lib/flows/types'
import {
  CONSENT_LABEL,
  EMPTY_FILTER,
  audienceSize,
  describeAudienceRules,
  describeFilter,
  filterToRules,
  type Audience,
  type AudienceFilter,
  type Campaign,
  type MarketingContact,
} from '@/lib/marketing'
import { formatDateShort, formatDateTime } from '@/lib/utils'
import type { CurrencyCode, Tenant } from '@/types'

/* ==========================================================================
   AUDIENCES
   Who a campaign or automation goes to. Six ready-made groups, plus your
   own built from the same plain rules automations use ("Number of
   bookings is at least 2", "Country is any of Australia"). Counts and the
   guest list update as you change a rule.
   ========================================================================== */

type Lookups = { activities: { slug: string; name: string }[]; currency: CurrencyCode }

interface Usage {
  campaigns: Campaign[]
  flows: Flow[]
}

const n = (value: number) => value.toLocaleString('en-US')
const plural = (count: number, one: string, many = `${one}s`) => `${n(count)} ${count === 1 ? one : many}`
const newAudienceId = () => `aud_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

const CONSENT_HELP: Record<AudienceFilter['consent'], string> = {
  either: 'Guests who agreed to marketing emails, texts or both.',
  email: 'Only guests who agreed to marketing emails. Best for email campaigns.',
  sms: 'Only guests who agreed to marketing texts. Best for text campaigns.',
}

const SOURCE_LABEL: Record<Signup['source'], string> = { popup: 'Pop-up', footer: 'Footer', checkout: 'Checkout' }

const CAMPAIGN_STATUS: Record<Campaign['status'], string> = { draft: 'Draft', scheduled: 'Scheduled', sent: 'Sent' }
const FLOW_STATUS: Record<Flow['status'], string> = { draft: 'Draft', live: 'Live', paused: 'Paused' }

function csvDownload(rows: string[][], filename: string) {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  link.download = filename
  link.click()
  // Revoking straight away can cancel the download in some browsers.
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'audience'

/** "2 campaigns and 1 automation". */
function usageText(usage: Usage | undefined): string {
  if (!usage) return ''
  const parts: string[] = []
  if (usage.campaigns.length > 0) parts.push(plural(usage.campaigns.length, 'campaign'))
  if (usage.flows.length > 0) parts.push(plural(usage.flows.length, 'automation'))
  return parts.join(' and ')
}

export function AudiencesClient({ tenant: tenantRecord, nowIso, data }: { tenant: Tenant; nowIso: string; data: MarketingData }) {
  const tenant = useMarketingTenant(tenantRecord)
  const marketing = useMarketing(tenant, nowIso)
  const { flows } = useFlows(tenantRecord, nowIso, data.activities)
  const [editing, setEditing] = React.useState<{ audience: Audience; isNew: boolean } | null>(null)
  const [deleting, setDeleting] = React.useState<Audience | null>(null)
  const [query, setQuery] = React.useState('')
  const homeCountry = tenantRecord.country
  const currency = tenantRecord.currency
  const lookups = React.useMemo<Lookups>(() => ({ activities: data.activities, currency }), [data.activities, currency])

  // Counted once per change, not on every render of every row.
  const rows = React.useMemo(
    () =>
      marketing.audiences.map((audience) => ({
        audience,
        size: audienceSize(data.contacts, audience, nowIso, { homeCountry }),
        summary: describeAudienceRules(audience, lookups),
      })),
    [marketing.audiences, data.contacts, nowIso, homeCountry, lookups],
  )

  const usage = React.useMemo(() => {
    const map = new Map<string, Usage>()
    const entry = (id: string) => {
      let found = map.get(id)
      if (!found) map.set(id, (found = { campaigns: [], flows: [] }))
      return found
    }
    for (const campaign of marketing.campaigns) if (campaign.audienceId) entry(campaign.audienceId).campaigns.push(campaign)
    for (const flow of flows) if (flow.trigger.audienceId) entry(flow.trigger.audienceId).flows.push(flow)
    return map
  }, [marketing.campaigns, flows])

  const stats = React.useMemo(() => {
    const contacts = data.contacts
    const email = contacts.filter((contact) => contact.emailOptIn).length
    const sms = contacts.filter((contact) => contact.smsOptIn).length
    const subscribed = contacts.filter((contact) => contact.emailOptIn || contact.smsOptIn).length
    const known = new Set(contacts.map((contact) => contact.email.toLowerCase()))
    const newSignups = marketing.signups.filter((signup) => !known.has(signup.email.toLowerCase())).length
    return { guests: contacts.length, email, sms, subscribed, newSignups, known }
  }, [data.contacts, marketing.signups])

  const q = query.trim().toLowerCase()
  const shown = q ? rows.filter((row) => `${row.audience.name} ${row.audience.description} ${row.summary}`.toLowerCase().includes(q)) : rows
  const own = rows.filter((row) => !row.audience.builtIn).length

  const exportCsv = (audience: Audience) => {
    const { members } = audienceSize(data.contacts, audience, nowIso, { homeCountry })
    const rowsOut = [['First name', 'Last name', 'Email', 'Phone', 'Country', 'Bookings', `Total spent (${currency})`, 'Last booking', 'Agreed to email', 'Agreed to texts']]
    for (const member of members)
      rowsOut.push([
        member.firstName,
        member.lastName,
        member.email,
        member.phone,
        member.country,
        String(member.totalBookings),
        String(member.spend),
        member.lastBookingAt ? member.lastBookingAt.slice(0, 10) : '',
        member.emailOptIn ? 'Yes' : 'No',
        member.smsOptIn ? 'Yes' : 'No',
      ])
    csvDownload(rowsOut, `${slugOf(audience.name)}.csv`)
    toast.success(`${plural(members.length, 'guest')} exported`)
  }

  const exportSignups = () => {
    const rowsOut = [['Email', 'Phone', 'Signed up from', 'Signed up', 'Already a guest']]
    for (const signup of marketing.signups)
      rowsOut.push([signup.email, signup.phone ?? '', SOURCE_LABEL[signup.source], signup.at.slice(0, 16).replace('T', ' '), stats.known.has(signup.email.toLowerCase()) ? 'Yes' : 'No'])
    csvDownload(rowsOut, 'sign-ups.csv')
    toast.success(`${plural(marketing.signups.length, 'sign-up')} exported`)
  }

  const startNew = () => setEditing({ audience: { id: newAudienceId(), name: '', description: '', filter: EMPTY_FILTER, rules: { match: 'all', conditions: [] } }, isNew: true })
  const copyOf = (audience: Audience) =>
    setEditing({
      audience: { ...audience, id: newAudienceId(), name: `${audience.name} (copy)`, rules: audience.rules ?? filterToRules(audience.filter), builtIn: false },
      isNew: true,
    })

  const confirmDelete = () => {
    if (!deleting) return
    const saved = deleting
    marketing.removeAudience(saved.id)
    setDeleting(null)
    toast(`${saved.name} deleted`, { action: { label: 'Undo', onClick: () => marketing.saveAudience(saved) } })
  }

  const rowActions = (audience: Audience) => ({
    onOpen: () => setEditing({ audience: { ...audience }, isNew: false }),
    onCopy: () => copyOf(audience),
    onExport: () => exportCsv(audience),
    onDelete: audience.builtIn ? undefined : () => setDeleting(audience),
  })

  return (
    <div className="flex flex-col gap-5">
      <StatGrid columns={4}>
        <StatCard
          accent="guests"
          icon={Users}
          countUp={false}
          stat={{ label: 'Guests', value: stats.guests, format: 'number', hint: 'Everyone on your guest list, subscribed or not.' }}
          footer={<span>{n(stats.guests - stats.subscribed)} not subscribed</span>}
        />
        <StatCard
          accent="bookings"
          icon={UserCheck}
          countUp={false}
          stat={{ label: 'Subscribed', value: stats.subscribed, format: 'number', hint: 'Guests who agreed to marketing by email, text or both. Only they can be in an audience.' }}
          footer={<span>{stats.guests > 0 ? Math.round((stats.subscribed / stats.guests) * 100) : 0}% of your guests</span>}
        />
        <StatCard
          accent="aov"
          icon={Mail}
          countUp={false}
          stat={{ label: 'Agreed to email', value: stats.email, format: 'number', hint: 'Guests you can send marketing emails to.' }}
          footer={<span>{plural(stats.newSignups, 'new sign-up')} from your forms</span>}
        />
        <StatCard
          accent="revenue"
          icon={MessageSquare}
          countUp={false}
          stat={{ label: 'Agreed to texts', value: stats.sms, format: 'number', hint: 'Guests you can send marketing texts to.' }}
          footer={<span>{stats.guests > 0 ? Math.round((stats.sms / stats.guests) * 100) : 0}% of your guests</span>}
        />
      </StatGrid>

      {/* ---------- audiences ---------- */}
      <section aria-labelledby="audiences-heading" className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="audiences-heading" className="text-base font-semibold text-foreground">
              Audiences
            </h2>
            <p className="mt-0.5 text-sm text-subtle">
              {plural(rows.length - own, 'ready-made audience')}
              {own > 0 ? ` and ${n(own)} of your own` : ''}. Only subscribed guests are counted, and anyone who unsubscribes leaves every audience.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={query} onValueChange={setQuery} debounceMs={0} label="Search audiences" placeholder="Search audiences" fieldClassName="sm:w-64" />
            <Button leftIcon={<Plus />} onClick={startNew}>
              New audience
            </Button>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="rounded-2xl border border-line bg-surface">
            <EmptyState
              variant="no-results"
              title="No audience matches that"
              description="Try another word, or clear the search to see them all."
              action={
                <Button variant="secondary" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              }
            />
          </div>
        ) : (
          <div className="type-crm overflow-hidden rounded-2xl border border-line bg-surface">
            {/* Phones and narrow windows: one card per audience. */}
            <ul className="list-none divide-y divide-line-subtle p-0 lg:hidden">
              {shown.map(({ audience, size, summary }) => (
                <li key={audience.id} className="flex flex-col gap-3 px-4 py-4">
                  <div className="flex items-start gap-3">
                    <AudienceTitle audience={audience} summary={summary} consent={audience.filter.consent} onOpen={rowActions(audience).onOpen} />
                    <AudienceMenu audience={audience} {...rowActions(audience)} />
                  </div>
                  <dl className="grid grid-cols-3 gap-3 text-xs">
                    {[
                      ['Guests', size.count],
                      ['Email', size.email],
                      ['Text', size.sms],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg bg-surface-sunken px-3 py-2">
                        <dt className="text-subtle">{label}</dt>
                        <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{n(Number(value))}</dd>
                      </div>
                    ))}
                  </dl>
                  <UsedIn usage={usage.get(audience.id)} />
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[56rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-surface-sunken/60">
                    <th className="px-4 py-2.5">Audience</th>
                    <th className="px-4 py-2.5">Who’s in it</th>
                    <th className="px-4 py-2.5 text-right">Guests</th>
                    <th className="px-4 py-2.5 text-right">Email</th>
                    <th className="px-4 py-2.5 text-right">Text</th>
                    <th className="px-4 py-2.5">Used in</th>
                    <th className="w-12 px-2 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(({ audience, size, summary }) => {
                    const actions = rowActions(audience)
                    return (
                      <tr key={audience.id} className="cursor-pointer border-b border-line-subtle transition-colors last:border-0 hover:bg-surface-sunken/60" onClick={actions.onOpen}>
                        <td className="max-w-[20rem] px-4 py-3">
                          <AudienceTitle audience={audience} onOpen={actions.onOpen} />
                        </td>
                        <td className="max-w-[22rem] px-4 py-3">
                          <p className="line-clamp-2 text-[0.8125rem] text-muted">{summary}</p>
                          {audience.filter.consent !== 'either' ? <p className="mt-0.5 text-xs text-subtle">{CONSENT_LABEL[audience.filter.consent]}</p> : null}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">{n(size.count)}</td>
                        <td className="px-4 py-3 text-right text-foreground tabular-nums">{n(size.email)}</td>
                        <td className="px-4 py-3 text-right text-foreground tabular-nums">{n(size.sms)}</td>
                        <td className="px-4 py-3">
                          <UsedIn usage={usage.get(audience.id)} />
                        </td>
                        <td className="px-2 py-3" onClick={(event) => event.stopPropagation()}>
                          <AudienceMenu audience={audience} {...actions} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ---------- sign-ups ---------- */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>New from your forms</CardTitle>
            <CardDescription>
              People who joined your list on your storefront. They get your welcome automation, and join audiences once they book.
            </CardDescription>
          </div>
          {marketing.signups.length > 0 ? (
            <Button variant="secondary" size="sm" leftIcon={<Download />} onClick={exportSignups}>
              Export
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {marketing.signups.length === 0 ? (
            <div className="flex items-center gap-3 border-t border-line-subtle px-5 py-4">
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle">
                <UserPlus className="size-4" />
              </span>
              <p className="text-sm text-subtle">No sign-ups yet. Turn on the pop-up in Sign-up forms to start growing your list.</p>
            </div>
          ) : (
            <div className="type-crm overflow-x-auto border-t border-line-subtle">
              <table className="w-full min-w-[34rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-surface-sunken/60">
                    <th className="px-5 py-2.5">Email and phone</th>
                    <th className="px-4 py-2.5">Signed up from</th>
                    <th className="px-4 py-2.5">When</th>
                  </tr>
                </thead>
                <tbody>
                  {marketing.signups.slice(0, 20).map((signup) => (
                    <tr key={`${signup.email}-${signup.at}`} className="border-b border-line-subtle last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-foreground">{signup.email}</span>
                          {stats.known.has(signup.email.toLowerCase()) ? (
                            <Badge variant="neutral" size="sm">
                              Already a guest
                            </Badge>
                          ) : null}
                        </div>
                        {signup.phone ? <p className="mt-0.5 text-xs text-subtle">{signup.phone}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-muted">{SOURCE_LABEL[signup.source]}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(signup.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {marketing.signups.length > 20 ? (
                <p className="border-t border-line-subtle px-5 py-3 text-xs text-subtle">
                  Showing the newest 20 of {n(marketing.signups.length)}. Export to see them all.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      {editing ? (
        <AudienceEditor
          key={editing.audience.id}
          audience={editing.audience}
          isNew={editing.isNew}
          contacts={data.contacts}
          nowIso={nowIso}
          homeCountry={homeCountry}
          data={data}
          lookups={lookups}
          usage={usage.get(editing.audience.id)}
          takenNames={marketing.audiences.filter((entry) => entry.id !== editing.audience.id).map((entry) => entry.name.trim().toLowerCase())}
          onClose={() => setEditing(null)}
          onCopy={() => copyOf(editing.audience)}
          onSave={(audience) => {
            marketing.saveAudience(audience)
            toast.success(`${audience.name} saved`)
            setEditing(null)
          }}
        />
      ) : null}

      <DeleteAudienceDialog audience={deleting} usage={deleting ? usage.get(deleting.id) : undefined} onCancel={() => setDeleting(null)} onConfirm={confirmDelete} />
    </div>
  )
}

/* ==========================================================================
   List pieces
   ========================================================================== */

function AudienceTitle({ audience, summary, consent, onOpen }: { audience: Audience; summary?: string; consent?: AudienceFilter['consent']; onOpen: () => void }) {
  const extra = [summary && summary !== audience.description ? summary : '', consent && consent !== 'either' ? CONSENT_LABEL[consent] : ''].filter(Boolean).join(' · ')
  return (
    <div className="flex min-w-0 flex-1 items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle">
        <Users className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onOpen()
            }}
            className="min-w-0 text-left text-sm font-semibold [overflow-wrap:anywhere] text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {audience.name}
          </button>
          {audience.builtIn ? (
            <Badge variant="neutral" size="sm">
              Ready-made
            </Badge>
          ) : null}
        </div>
        {audience.description ? <p className="mt-0.5 line-clamp-2 text-[0.8125rem] text-subtle">{audience.description}</p> : null}
        {extra ? <p className="mt-0.5 text-xs text-subtle">{extra}</p> : null}
      </div>
    </div>
  )
}

function UsedIn({ usage }: { usage: Usage | undefined }) {
  const text = usageText(usage)
  if (!usage || !text) return <span className="text-[0.8125rem] text-faint">Not used yet</span>
  const names = [...usage.campaigns.map((campaign) => `Campaign: ${campaign.name}`), ...usage.flows.map((flow) => `Automation: ${flow.name}`)]
  return (
    <SimpleTooltip
      label={
        <ul className="list-none p-0 text-xs">
          {names.slice(0, 8).map((name, index) => (
            <li key={index}>{name}</li>
          ))}
          {names.length > 8 ? <li>and {names.length - 8} more</li> : null}
        </ul>
      }
    >
      <span tabIndex={0} className="cursor-default text-[0.8125rem] text-muted underline decoration-line-strong decoration-dotted underline-offset-4">
        {text}
      </span>
    </SimpleTooltip>
  )
}

function AudienceMenu({
  audience,
  onOpen,
  onCopy,
  onExport,
  onDelete,
}: {
  audience: Audience
  onOpen: () => void
  onCopy: () => void
  onExport: () => void
  onDelete?: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label={`More for ${audience.name}`} variant="ghost" size="sm">
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={onOpen}>
          {audience.builtIn ? (
            <>
              <Eye /> See who’s in it
            </>
          ) : (
            <>
              <Pencil /> Edit
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCopy}>
          <Copy /> Make a copy
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onExport}>
          <Download /> Export as CSV
        </DropdownMenuItem>
        {onDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem tone="danger" onSelect={onDelete}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DeleteAudienceDialog({ audience, usage, onCancel, onConfirm }: { audience: Audience | null; usage: Usage | undefined; onCancel: () => void; onConfirm: () => void }) {
  const campaigns = usage?.campaigns ?? []
  const flows = usage?.flows ?? []
  const waiting = campaigns.filter((campaign) => campaign.status !== 'sent')
  const used = campaigns.length + flows.length > 0
  return (
    <Dialog open={audience !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Delete {audience?.name}?</DialogTitle>
          <DialogDescription>
            {used
              ? `It’s used in ${usageText(usage)}. Guests stay on your list; only this group goes.`
              : 'Nothing uses it yet. Guests stay on your list; only this group goes.'}
          </DialogDescription>
        </DialogHeader>
        {used ? (
          <DialogBody className="flex flex-col gap-3 pb-2">
            <ul className="flex list-none flex-col divide-y divide-line-subtle rounded-xl border border-line p-0">
              {campaigns.map((campaign) => (
                <li key={campaign.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-foreground">
                    <span className="text-subtle">Campaign · </span>
                    {campaign.name}
                  </span>
                  <Badge variant={campaign.status === 'sent' ? 'neutral' : 'warning'} size="sm">
                    {CAMPAIGN_STATUS[campaign.status]}
                  </Badge>
                </li>
              ))}
              {flows.map((flow) => (
                <li key={flow.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-foreground">
                    <span className="text-subtle">Automation · </span>
                    {flow.name}
                  </span>
                  <Badge variant={flow.status === 'live' ? 'warning' : 'neutral'} size="sm">
                    {FLOW_STATUS[flow.status]}
                  </Badge>
                </li>
              ))}
            </ul>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-[0.8125rem] text-muted">
              {waiting.length > 0 ? <li>Draft and scheduled campaigns that use it won’t go to anyone until you open them and pick another audience.</li> : null}
              {flows.length > 0 ? <li>Automations that use it will reach no one until you pick another audience in them.</li> : null}
              {campaigns.length > waiting.length ? <li>Campaigns already sent keep their results.</li> : null}
            </ul>
          </DialogBody>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" leftIcon={<Trash2 />} onClick={onConfirm}>
            Delete audience
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ==========================================================================
   Rule builder
   ========================================================================== */

function AudienceEditor({
  audience,
  isNew,
  contacts,
  nowIso,
  homeCountry,
  data,
  lookups,
  usage,
  takenNames,
  onClose,
  onCopy,
  onSave,
}: {
  audience: Audience
  isNew: boolean
  contacts: MarketingContact[]
  nowIso: string
  homeCountry: string
  data: MarketingData
  lookups: Lookups
  usage: Usage | undefined
  takenNames: string[]
  onClose: () => void
  onCopy: () => void
  onSave: (audience: Audience) => void
}) {
  const readOnly = Boolean(audience.builtIn)
  const initial = React.useMemo(() => {
    const rules = audience.rules ?? filterToRules(audience.filter)
    const summary = describeAudienceRules({ ...EMPTY_FILTER, rules }, lookups)
    const activityName = (slug: string) => lookups.activities.find((activity) => activity.slug === slug)?.name ?? slug
    // Older audiences saved the auto summary as their description; that isn't the owner's own words.
    const auto = [summary, describeFilter(audience.filter, activityName), describeAudienceRules(audience, lookups)]
    const custom = Boolean(audience.description.trim()) && !auto.includes(audience.description.trim())
    return { name: audience.name, rules, consent: audience.filter.consent, description: custom ? audience.description : '', custom }
  }, [audience, lookups])

  const [name, setName] = React.useState(initial.name)
  const [rules, setRules] = React.useState<ConditionGroup>(initial.rules)
  const [consent, setConsent] = React.useState<AudienceFilter['consent']>(initial.consent)
  const [description, setDescription] = React.useState(initial.description)
  const [customDescription, setCustomDescription] = React.useState(initial.custom)
  const [memberQuery, setMemberQuery] = React.useState('')
  const [confirmClose, setConfirmClose] = React.useState(false)

  // Typing in a number box stays quick: the count catches up a beat later.
  const deferredRules = React.useDeferredValue(rules)
  const target = React.useMemo<AudienceFilter>(() => ({ ...EMPTY_FILTER, consent, rules: deferredRules }), [consent, deferredRules])
  const size = React.useMemo(() => audienceSize(contacts, target, nowIso, { homeCountry }), [contacts, target, nowIso, homeCountry])
  const summary = describeAudienceRules({ ...EMPTY_FILTER, rules }, lookups)
  const shownDescription = customDescription ? description : summary

  const mq = memberQuery.trim().toLowerCase()
  const matchingMembers = mq
    ? size.members.filter((member) => `${member.firstName} ${member.lastName} ${member.email} ${member.country}`.toLowerCase().includes(mq))
    : size.members
  const preview = matchingMembers.slice(0, 20)

  const trimmed = name.trim()
  const nameTaken = trimmed.length > 0 && takenNames.includes(trimmed.toLowerCase())
  const nameError = trimmed.length < 2 ? 'Give it a name of at least 2 letters.' : nameTaken ? 'Another audience already has this name.' : null
  const [triedSave, setTriedSave] = React.useState(false)

  const dirty =
    !readOnly &&
    (isNew ||
      name !== initial.name ||
      consent !== initial.consent ||
      JSON.stringify(rules) !== JSON.stringify(initial.rules) ||
      customDescription !== initial.custom ||
      (customDescription && description !== initial.description))

  const requestClose = () => (dirty && (isNew ? trimmed.length > 0 || rules.conditions.length > 0 : true) ? setConfirmClose(true) : onClose())

  const save = () => {
    setTriedSave(true)
    if (nameError) return
    const finalDescription = customDescription && description.trim() ? description.trim() : summary
    onSave({
      id: audience.id,
      name: trimmed,
      description: finalDescription,
      rules,
      // The same rules ride on the filter, so anything matching on `audience.filter` agrees.
      filter: { ...EMPTY_FILTER, consent, rules, homeCountry },
      builtIn: false,
    })
  }

  const usedText = usageText(usage)

  return (
    <Sheet open onOpenChange={(value) => !value && requestClose()}>
      <SheetContent side="right" size="xl">
        <SheetHeader>
          <SheetTitle>{readOnly ? audience.name : isNew ? (trimmed || 'New audience') : audience.name}</SheetTitle>
          <SheetDescription>
            {readOnly
              ? 'A ready-made audience. Make a copy to change its rules.'
              : 'Pick the checks a guest must pass to be in it. Counts update as you go.'}
            {usedText ? ` Used in ${usedText}.` : ''}
          </SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-6">
          {/* ---------- live count ---------- */}
          <div className="sticky top-0 z-10 -mx-6 -mt-5 border-b border-line-subtle bg-surface-raised px-6 py-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-subtle">In this audience now</p>
                <p className="mt-0.5 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-semibold text-foreground tabular-nums">{n(size.count)}</span>
                  <span className="text-sm text-muted">{size.count === 1 ? 'guest' : 'guests'}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-sunken px-2.5 py-1.5 text-[0.8125rem] text-foreground">
                  <Mail className="size-3.5 text-subtle" aria-hidden="true" />
                  <span className="tabular-nums">{n(size.email)}</span> by email
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-sunken px-2.5 py-1.5 text-[0.8125rem] text-foreground">
                  <MessageSquare className="size-3.5 text-subtle" aria-hidden="true" />
                  <span className="tabular-nums">{n(size.sms)}</span> by text
                </span>
              </div>
            </div>
            {size.count === 0 ? (
              <p className="mt-2 text-[0.8125rem] text-warning">
                {consent === 'either' ? 'No one matches yet. Try loosening a check.' : 'No one matches yet. Try loosening a check, or set Reachable by to Email or text.'}
              </p>
            ) : null}
          </div>

          {/* ---------- name and description ---------- */}
          {readOnly ? (
            audience.description ? <p className="text-sm text-muted">{audience.description}</p> : null
          ) : (
            <div className="flex flex-col gap-4">
              <Field label="Name" error={triedSave || nameTaken ? (nameError ?? undefined) : undefined}>
                {(control) => <Input {...control} value={name} autoFocus={isNew} placeholder="Snorkellers who haven’t been back" onChange={(event) => setName(event.target.value)} />}
              </Field>
              <Field
                label="Description"
                optional
                description={customDescription ? 'Your own words, shown in lists and when picking an audience.' : 'Follows your checks until you write your own.'}
                hint={
                  customDescription ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-primary hover:underline"
                      onClick={() => {
                        setCustomDescription(false)
                        setDescription('')
                      }}
                    >
                      Use the rule summary
                    </button>
                  ) : undefined
                }
              >
                {(control) => (
                  <Textarea
                    {...control}
                    rows={2}
                    value={shownDescription}
                    placeholder="Who this is for, in a few words"
                    onChange={(event) => {
                      setCustomDescription(true)
                      setDescription(event.target.value)
                    }}
                  />
                )}
              </Field>
            </div>
          )}

          {/* ---------- rules ---------- */}
          <section aria-labelledby="audience-rules" className="flex flex-col gap-3">
            <div>
              <h3 id="audience-rules" className="text-sm font-semibold text-foreground">
                Who’s in it
              </h3>
              <p className="mt-0.5 text-[0.8125rem] text-subtle">{summary}</p>
            </div>
            {readOnly ? (
              rules.conditions.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-3.5 py-3 text-[0.8125rem] text-subtle">No checks: every subscribed guest is in it.</p>
              ) : (
                <ul className="flex list-none flex-col gap-2 p-0">
                  {rules.conditions.map((condition) => (
                    <li key={condition.id} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-foreground">
                      <Check className="size-4 shrink-0 text-subtle" aria-hidden="true" />
                      {describeCondition(condition, lookups)}
                    </li>
                  ))}
                </ul>
              )
            ) : (
              <ConditionBuilder
                value={rules}
                onChange={setRules}
                subject="guest"
                where="who"
                data={{ activities: data.activities, tags: data.tags, countries: data.countries, currency: lookups.currency }}
                emptyText="No checks yet, so every subscribed guest is in it."
                addLabel="Add a check"
              />
            )}
          </section>

          {/* ---------- consent ---------- */}
          <section aria-labelledby="audience-consent" className="flex flex-col gap-2">
            <h3 id="audience-consent" className="text-sm font-semibold text-foreground">
              Reachable by
            </h3>
            {readOnly ? (
              <p className="text-sm text-muted">{CONSENT_LABEL[consent]}</p>
            ) : (
              <Segmented
                label="Reachable by"
                value={consent}
                onValueChange={setConsent}
                className="self-start"
                options={[
                  { value: 'either', label: 'Email or text' },
                  { value: 'email', label: 'Email', icon: Mail },
                  { value: 'sms', label: 'Text', icon: MessageSquare },
                ]}
              />
            )}
            <p className="text-[0.8125rem] text-subtle">{CONSENT_HELP[consent]} Guests who never agreed to marketing are never included.</p>
          </section>

          {/* ---------- member preview ---------- */}
          <section aria-labelledby="audience-members" className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h3 id="audience-members" className="text-sm font-semibold text-foreground">
                Guests in it
              </h3>
              <SearchInput
                size="sm"
                value={memberQuery}
                onValueChange={setMemberQuery}
                debounceMs={0}
                label="Search guests in this audience"
                placeholder="Search by name, email or country"
                fieldClassName="sm:w-72"
              />
            </div>
            {preview.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-3.5 py-3 text-[0.8125rem] text-subtle">
                {size.count === 0 ? 'No guests match these checks yet.' : 'No guest in this audience matches that search.'}
              </p>
            ) : (
              <div className="type-crm overflow-x-auto rounded-xl border border-line">
                <table className="w-full min-w-[34rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line bg-surface-sunken/60">
                      <th className="px-3.5 py-2">Guest</th>
                      <th className="px-3.5 py-2">Country</th>
                      <th className="px-3.5 py-2 text-right">Bookings</th>
                      <th className="px-3.5 py-2">Last booked</th>
                      <th className="px-3.5 py-2">
                        <span className="sr-only">Reachable by</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((member) => (
                      <tr key={member.id} className="border-b border-line-subtle last:border-0">
                        <td className="px-3.5 py-2.5">
                          {/* Table cells ignore max-width, so the cap sits on the text itself. */}
                          <p className="max-w-[14rem] truncate font-medium text-foreground">
                            {member.firstName} {member.lastName}
                          </p>
                          <p className="max-w-[14rem] truncate text-xs text-subtle">{member.email}</p>
                        </td>
                        <td className="px-3.5 py-2.5 text-muted">{member.country || '—'}</td>
                        <td className="px-3.5 py-2.5 text-right text-foreground tabular-nums">{member.totalBookings}</td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-muted">{member.lastBookingAt ? formatDateShort(member.lastBookingAt) : 'Not yet'}</td>
                        <td className="px-3.5 py-2.5">
                          <span className="flex items-center justify-end gap-1.5 text-subtle">
                            {member.emailOptIn ? (
                              <SimpleTooltip label="Agreed to email">
                                <span className="inline-flex">
                                  <Mail className="size-3.5" aria-hidden="true" />
                                  <span className="sr-only">Agreed to email</span>
                                </span>
                              </SimpleTooltip>
                            ) : null}
                            {member.smsOptIn ? (
                              <SimpleTooltip label="Agreed to texts">
                                <span className="inline-flex">
                                  <MessageSquare className="size-3.5" aria-hidden="true" />
                                  <span className="sr-only">Agreed to texts</span>
                                </span>
                              </SimpleTooltip>
                            ) : null}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-line-subtle bg-surface-sunken/40 px-3.5 py-2 text-xs text-subtle">
                  {matchingMembers.length > preview.length
                    ? `Showing ${preview.length} of ${n(matchingMembers.length)}${mq ? ' that match' : ''}. Export the audience to see everyone.`
                    : `Showing all ${n(matchingMembers.length)}.`}
                </p>
              </div>
            )}
          </section>
        </SheetBody>
        <SheetFooter>
          {readOnly ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button leftIcon={<Copy />} onClick={onCopy}>
                Make a copy to change it
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" leftIcon={<X />} onClick={requestClose}>
                Cancel
              </Button>
              <Button leftIcon={<Check />} onClick={save} disabled={triedSave && Boolean(nameError)}>
                {isNew ? 'Save audience' : 'Save changes'}
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>

      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Discard your changes?</DialogTitle>
            <DialogDescription>{isNew ? 'This audience hasn’t been saved yet.' : 'Your changes to this audience haven’t been saved.'}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmClose(false)}>
              Keep editing
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmClose(false)
                onClose()
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}
