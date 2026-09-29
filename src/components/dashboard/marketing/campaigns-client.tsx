'use client'

import * as React from 'react'
import { CalendarClock, Check, Copy, Mail, MessageSquareText, Pencil, Plus, Send, Tag, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { brandColors, useEmailContext } from '@/hooks/use-email-context'
import { EmailContentCard } from '@/components/dashboard/marketing/email-content-card'
import { EmailFrame } from '@/components/dashboard/marketing/email-designer'
import { blockId, designFromText, type EmailContext, type EmailDesign, type SavedEmailTemplate } from '@/lib/email-design'
import { usePricing } from '@/hooks/use-pricing'
import type { MarketingData } from '@/lib/data/guest-marketing'
import {
  CAMPAIGN_PLACEHOLDERS,
  NO_OFFER,
  audienceSize,
  campaignStatsFor,
  cleanCode,
  percent,
  upsertOfferPromo,
  type Campaign,
  type CampaignStats,
} from '@/lib/marketing'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   CAMPAIGNS
   One-off emails and texts to an audience: a new season, last-minute seats,
   a locals deal. Start from a template, pick who gets it, add a code, send
   now or schedule it. Sent campaigns show what they earned.
   ========================================================================== */

const STARTERS: { id: string; name: string; hint: string; channel: Campaign['channel']; subject: string; body: string; offer?: number; button?: string }[] = [
  { id: 'blank', name: 'Start blank', hint: 'Your own words', channel: 'email', subject: '', body: 'Hi {first_name},\n\n' },
  {
    id: 'newsletter',
    name: 'Monthly newsletter',
    hint: 'What is new, best days to go',
    channel: 'email',
    subject: 'What is new at {business} this month',
    body: 'Hi {first_name},\n\nHere is what is happening this month: new dates, what the crew has been seeing out there, and the best days to go.\n\nSee you soon,\n{business}',
    button: 'See dates',
  },
  {
    id: 'lastminute',
    name: 'Last-minute seats',
    hint: 'Fill this week’s gaps',
    channel: 'sms',
    subject: '',
    body: '{business}: a few seats left this week. {offer_percent} off with {offer_code} until Sunday: {link}',
    offer: 15,
  },
  {
    id: 'launch',
    name: 'New trip launch',
    hint: 'Announce something new',
    channel: 'email',
    subject: 'New: something we have been waiting to share',
    body: 'Hi {first_name},\n\nWe have a brand-new trip and you are among the first to hear. Early bookers get {offer_percent} off with {offer_code}.\n\n{business}',
    offer: 10,
    button: 'Be first to book',
  },
  {
    id: 'seasonal',
    name: 'Seasonal offer',
    hint: 'A reason to book now',
    channel: 'email',
    subject: '{offer_percent} off for a limited time',
    body: 'Hi {first_name},\n\nFor the next two weeks, every trip is {offer_percent} off with code {offer_code}. Bring a friend.\n\n{business}',
    offer: 20,
    button: 'Book now',
  },
  {
    id: 'gift',
    name: 'Gift cards',
    hint: 'Birthdays and holidays',
    channel: 'email',
    subject: 'A gift that gets them outside',
    body: 'Hi {first_name},\n\nStuck for a present? A {business} gift card is good for any trip for a full year, and arrives by email in a minute.\n\n{business}',
    button: 'Buy a gift card',
  },
]

export function CampaignsClient({ tenant: tenantRecord, nowIso, data }: { tenant: Tenant; nowIso: string; data: MarketingData }) {
  const tenant = useMarketingTenant(tenantRecord)
  const currency = tenantRecord.currency
  const marketing = useMarketing(tenant, nowIso)
  const pricing = usePricing(tenant.slug)
  const [editing, setEditing] = React.useState<Campaign | null>(null)
  const [report, setReport] = React.useState<Campaign | null>(null)
  const [picking, setPicking] = React.useState(false)
  const [tab, setTab] = React.useState<'all' | Campaign['status']>('all')
  const ctx = useEmailContext(tenantRecord, data.activities, { first_name: 'Maia', link: tenant.slug + '.ezrapro.com' })
  const brand = React.useMemo(() => brandColors(tenantRecord), [tenantRecord])

  const recipientsFor = React.useCallback(
    (campaign: Pick<Campaign, 'audienceId' | 'channel'>) => {
      const audience = marketing.audiences.find((entry) => entry.id === campaign.audienceId) ?? marketing.audiences[0]
      const size = audienceSize(data.contacts, audience.filter, nowIso)
      return campaign.channel === 'sms' ? size.sms : size.email
    },
    [marketing.audiences, data.contacts, nowIso],
  )
  const statsOf = (campaign: Campaign): CampaignStats | undefined =>
    campaign.status !== 'sent' ? undefined : (campaign.stats ?? campaignStatsFor(campaign.id, recipientsFor(campaign), data.avgOrder, campaign.channel))

  const sent = marketing.campaigns.filter((campaign) => campaign.status === 'sent')
  const totals = sent.reduce(
    (sum, campaign) => {
      const stats = statsOf(campaign)!
      return { delivered: sum.delivered + stats.delivered, opened: sum.opened + (campaign.channel === 'email' ? stats.opened : 0), emailDelivered: sum.emailDelivered + (campaign.channel === 'email' ? stats.delivered : 0), bookings: sum.bookings + stats.bookings, revenue: sum.revenue + stats.revenue }
    },
    { delivered: 0, opened: 0, emailDelivered: 0, bookings: 0, revenue: 0 },
  )
  const list = marketing.campaigns
    .filter((campaign) => tab === 'all' || campaign.status === tab)
    .sort((a, b) => (order(a) < order(b) ? 1 : -1))

  const start = (starterId: string) => {
    const starter = STARTERS.find((entry) => entry.id === starterId) ?? STARTERS[0]
    setPicking(false)
    setEditing({
      id: `cmp_${Date.now().toString(36)}`,
      name: starter.id === 'blank' ? 'New campaign' : starter.name,
      channel: starter.channel,
      audienceId: 'aud_all',
      subject: starter.subject,
      preheader: '',
      body: starter.body,
      button: { enabled: Boolean(starter.button), label: starter.button ?? 'Book now', activitySlug: '' },
      offer: starter.offer ? { enabled: true, percent: starter.offer, validDays: 14, code: `${starter.id.toUpperCase().slice(0, 8)}${starter.offer}` } : NO_OFFER,
      abTest: { enabled: false, subjectB: '' },
      status: 'draft',
      createdAt: nowIso,
    })
  }

  const save = (campaign: Campaign, mode: 'draft' | 'schedule' | 'send') => {
    const recipients = recipientsFor(campaign)
    const next: Campaign =
      mode === 'send'
        ? { ...campaign, status: 'sent', sentAt: nowIso, sendAt: undefined, stats: campaignStatsFor(campaign.id, recipients, data.avgOrder, campaign.channel) }
        : mode === 'schedule'
          ? { ...campaign, status: 'scheduled' }
          : { ...campaign, status: 'draft' }
    marketing.saveCampaign(next)
    if (campaign.offer.enabled && mode !== 'draft') pricing.setPromos(upsertOfferPromo(pricing.promos, campaign.offer, `From the “${campaign.name}” campaign`))
    setEditing(null)
    if (mode === 'send') toast.success(`${campaign.name} is on its way`, { description: `${recipients.toLocaleString('en-US')} ${campaign.channel === 'sms' ? 'texts' : 'emails'} going out now.` })
    else if (mode === 'schedule') toast.success('Campaign scheduled', { description: campaign.sendAt ? formatDateTime(campaign.sendAt) : undefined })
    else toast('Draft saved')
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Campaigns sent', value: String(sent.length), hint: `${totals.delivered.toLocaleString('en-US')} delivered` },
          { label: 'Email open rate', value: totals.emailDelivered > 0 ? percent(totals.opened / totals.emailDelivered) : '—', hint: 'Across sent emails' },
          { label: 'Bookings', value: String(totals.bookings), hint: 'Within 7 days of a click' },
          { label: 'Revenue', value: formatCurrency(totals.revenue * 100, currency), hint: 'From campaign bookings' },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface px-4 py-3.5">
            <p className="text-xs font-medium text-subtle">{tile.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular text-foreground">{tile.value}</p>
            <p className="mt-0.5 text-xs text-subtle">{tile.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Show" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {(['all', 'draft', 'scheduled', 'sent'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={tab === value}
              onClick={() => setTab(value)}
              className={cn('h-8 rounded-md px-3 text-sm font-medium capitalize', tab === value ? 'bg-surface-sunken text-foreground' : 'text-muted hover:text-foreground')}
            >
              {value === 'all' ? 'All' : `${value} · ${marketing.campaigns.filter((campaign) => campaign.status === value).length}`}
            </button>
          ))}
        </div>
        <Button leftIcon={<Plus />} onClick={() => setPicking(true)}>
          New campaign
        </Button>
      </div>

      {picking ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Start from</p>
              <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => setPicking(false)}>Close</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {STARTERS.map((starter) => (
                <button
                  key={starter.id}
                  type="button"
                  onClick={() => start(starter.id)}
                  className="flex items-start gap-3 rounded-xl border border-line px-3.5 py-3 text-left transition-colors hover:border-primary/50"
                >
                  <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle">
                    {starter.channel === 'sms' ? <MessageSquareText className="size-4" /> : <Mail className="size-4" />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium">{starter.name}</span>
                    <span className="block text-xs text-subtle">{starter.hint}{starter.offer ? ` · ${starter.offer}% code` : ''}</span>
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <p className="px-5 py-6 text-sm text-subtle">No campaigns here yet.</p>
          ) : (
            <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
              {list.map((campaign) => {
                const stats = statsOf(campaign)
                const audience = marketing.audiences.find((entry) => entry.id === campaign.audienceId)
                return (
                  <li key={campaign.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-subtle">
                        {campaign.channel === 'sms' ? <MessageSquareText className="size-[1.125rem]" /> : <Mail className="size-[1.125rem]" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{campaign.name}</p>
                          <Badge variant={campaign.status === 'sent' ? 'success' : campaign.status === 'scheduled' ? 'info' : 'neutral'} size="sm">
                            {campaign.status === 'sent' ? 'Sent' : campaign.status === 'scheduled' ? 'Scheduled' : 'Draft'}
                          </Badge>
                          {campaign.offer.enabled ? <Badge variant="neutral" size="sm">{campaign.offer.percent}% · {campaign.offer.code}</Badge> : null}
                        </div>
                        <p className="mt-0.5 text-xs text-subtle">
                          {campaign.status === 'sent' && campaign.sentAt
                            ? `Sent ${formatDateTime(campaign.sentAt)}`
                            : campaign.status === 'scheduled' && campaign.sendAt
                              ? `Goes ${formatDateTime(campaign.sendAt)}`
                              : 'Not sent'}
                          {' · '}
                          {audience?.name ?? 'Everyone subscribed'} · {(stats?.recipients ?? recipientsFor(campaign)).toLocaleString('en-US')} {campaign.channel === 'sms' ? 'phones' : 'inboxes'}
                        </p>
                      </div>
                    </div>
                    {stats ? (
                      <dl className="grid grid-cols-4 gap-4 text-right text-xs lg:w-[26rem]">
                        {[
                          ['Opened', campaign.channel === 'sms' ? '—' : percent(stats.opened / Math.max(1, stats.delivered))],
                          ['Clicked', percent(stats.clicked / Math.max(1, stats.delivered), 1)],
                          ['Booked', String(stats.bookings)],
                          ['Revenue', formatCurrency(stats.revenue * 100, currency)],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-subtle">{label}</dt>
                            <dd className="mt-0.5 text-sm font-semibold tabular text-foreground">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    <div className="flex shrink-0 items-center gap-1">
                      {campaign.status === 'sent' ? (
                        <Button variant="ghost" size="sm" onClick={() => setReport(campaign)}>Report</Button>
                      ) : (
                        <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => setEditing({ ...campaign })}>Edit</Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Copy ${campaign.name}`}
                        onClick={() => setEditing({ ...campaign, id: `cmp_${Date.now().toString(36)}`, name: `${campaign.name} (copy)`, status: 'draft', sentAt: undefined, sendAt: undefined, stats: undefined, createdAt: nowIso })}
                      >
                        <Copy className="size-4" aria-hidden="true" />
                      </Button>
                      {campaign.status !== 'sent' ? (
                        <Button variant="ghost" size="sm" aria-label={`Delete ${campaign.name}`} onClick={() => { marketing.removeCampaign(campaign.id); toast('Campaign deleted') }}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {editing ? (
        <CampaignEditor
          campaign={editing}
          business={tenant.name}
          audiences={marketing.audiences.map((audience) => ({ id: audience.id, name: audience.name, ...(() => { const size = audienceSize(data.contacts, audience.filter, nowIso); return { email: size.email, sms: size.sms } })() }))}
          activities={data.activities}
          nowIso={nowIso}
          paused={marketing.settings.paused}
          ctx={ctx}
          brand={brand}
          saved={marketing.emailTemplates}
          onSaveTemplate={(name, design) => {
            marketing.saveEmailTemplate({ id: 'tpl_' + Date.now().toString(36), name, design, updatedAt: new Date().toISOString() })
            toast.success(name + ' saved to Email templates')
          }}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      ) : null}

      <Sheet open={report !== null} onOpenChange={(value) => !value && setReport(null)}>
        <SheetContent side="right" size="md">
          {report ? <CampaignReport campaign={report} stats={statsOf(report)!} currency={currency} /> : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

function order(campaign: Campaign) {
  return campaign.status === 'draft' ? `3${campaign.createdAt}` : campaign.status === 'scheduled' ? `2${campaign.sendAt ?? ''}` : `1${campaign.sentAt ?? ''}`
}

/* ==========================================================================
   Composer
   ========================================================================== */

function CampaignEditor({
  campaign,
  business,
  audiences,
  activities,
  nowIso,
  paused,
  ctx,
  brand,
  saved,
  onSaveTemplate,
  onClose,
  onSave,
}: {
  campaign: Campaign
  business: string
  audiences: { id: string; name: string; email: number; sms: number }[]
  activities: { slug: string; name: string }[]
  nowIso: string
  paused: boolean
  ctx: EmailContext
  brand: string[]
  saved: SavedEmailTemplate[]
  onSaveTemplate: (name: string, design: EmailDesign) => void
  onClose: () => void
  onSave: (campaign: Campaign, mode: 'draft' | 'schedule' | 'send') => void
}) {
  const [draft, setDraft] = React.useState(campaign)
  const [when, setWhen] = React.useState<'now' | 'later'>(campaign.status === 'scheduled' ? 'later' : 'now')
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)
  const set = (patch: Partial<Campaign>) => setDraft((current) => ({ ...current, ...patch }))
  const audience = audiences.find((entry) => entry.id === draft.audienceId) ?? audiences[0]
  const recipients = draft.channel === 'sms' ? audience.sms : audience.email
  const context: Record<string, string> = {
    first_name: 'Maia',
    business,
    offer_code: draft.offer.enabled ? cleanCode(draft.offer.code) || 'CODE' : '',
    offer_percent: draft.offer.enabled ? `${draft.offer.percent}%` : '',
    link: 'book.link/x7',
  }
  const render = (text: string) => text.replace(/\{([a-z_]+)\}/g, (match, key: string) => context[key] ?? match)
  const emailCtx = React.useMemo(() => ({ ...ctx, vars: { ...ctx.vars, ...context } }), [ctx, context.offer_code, context.offer_percent]) // eslint-disable-line react-hooks/exhaustive-deps
  // Without a design: a simple letter from the text, with the code and button under it.
  const letter = React.useMemo<EmailDesign>(() => {
    const base = designFromText(draft.subject, draft.body, brand[0] ?? '#601CEF')
    const extra = [
      ...(draft.offer.enabled ? [{ id: blockId(), type: 'coupon' as const, title: 'Your code', note: 'Good for ' + draft.offer.validDays + ' days.' }] : []),
      ...(draft.button.enabled ? [{ id: blockId(), type: 'button' as const, label: draft.button.label || 'Book now', link: draft.button.activitySlug ? 'activity:' + draft.button.activitySlug : '{book_link}', align: 'left' as const, style: 'solid' as const, full: false }] : []),
    ]
    return { ...base, blocks: [base.blocks[0], base.blocks[1], ...extra, base.blocks[2]] }
  }, [draft.subject, draft.body, draft.offer.enabled, draft.offer.validDays, draft.button, brand])
  const rendered = render(draft.body)
  const segments = Math.max(1, Math.ceil(rendered.length / 160))
  const defaultLater = React.useMemo(() => {
    const at = new Date(nowIso)
    at.setDate(at.getDate() + 1)
    at.setHours(9, 0, 0, 0)
    return at.toISOString().slice(0, 16)
  }, [nowIso])
  const problems = [
    draft.name.trim().length < 2 ? 'Give it a name' : null,
    draft.channel === 'email' && draft.subject.trim().length < 3 ? 'Add a subject line' : null,
    draft.body.trim().length < 10 ? 'Write the message' : null,
    recipients === 0 ? 'Nobody in this audience can get it' : null,
  ].filter(Boolean) as string[]

  const insert = (token: string) => {
    const el = bodyRef.current
    const at = el?.selectionStart ?? draft.body.length
    set({ body: draft.body.slice(0, at) + token + draft.body.slice(el?.selectionEnd ?? at) })
  }

  return (
    <Sheet open onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{draft.status === 'draft' ? 'Campaign' : 'Scheduled campaign'}</SheetTitle>
          <SheetDescription>Only guests who said yes to marketing get it. Unsubscribe links are added for you.</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-6">
          <Field label="Name" description="Only you see this.">
            {(control) => <Input {...control} value={draft.name} onChange={(e) => set({ name: e.target.value })} />}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Send as">
              <Select value={draft.channel} onValueChange={(value) => set({ channel: value as Campaign['channel'] })}>
                <SelectTrigger aria-label="Send as"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">Text message</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="To" description={`${recipients.toLocaleString('en-US')} ${draft.channel === 'sms' ? 'guests with texts on' : 'subscribed inboxes'}`}>
              <Select value={draft.audienceId} onValueChange={(audienceId) => set({ audienceId })}>
                <SelectTrigger aria-label="Audience"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {audiences.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.name} · {(draft.channel === 'sms' ? entry.sms : entry.email).toLocaleString('en-US')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {draft.channel === 'email' ? (
            <section className="flex flex-col gap-4">
              <Field label="Subject line">
                {(control) => <Input {...control} value={draft.subject} onChange={(e) => set({ subject: e.target.value })} />}
              </Field>
              <Field label="Preview text" optional description="The grey line after the subject in most inboxes.">
                {(control) => <Input {...control} value={draft.preheader} onChange={(e) => set({ preheader: e.target.value })} />}
              </Field>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  Test a second subject
                  <span className="block text-xs text-subtle">20% of the list gets each; after four hours the winner goes to the rest.</span>
                </span>
                <Switch checked={draft.abTest.enabled} onCheckedChange={(enabled) => set({ abTest: { ...draft.abTest, enabled } })} aria-label="Test a second subject" />
              </label>
              {draft.abTest.enabled ? (
                <Field label="Subject B">
                  {(control) => <Input {...control} value={draft.abTest.subjectB} onChange={(e) => set({ abTest: { enabled: true, subjectB: e.target.value } })} />}
                </Field>
              ) : null}
            </section>
          ) : null}

          {draft.channel === 'email' ? (
            <EmailContentCard
              design={draft.design}
              onChange={(design) => set({ design })}
              fallback={letter}
              ctx={emailCtx}
              subject={draft.subject}
              preheader={draft.preheader}
              text={draft.body}
              brand={brand}
              saved={saved}
              onSaveTemplate={onSaveTemplate}
              title={draft.name + ': email'}
            />
          ) : null}

          <div>
            <Field label={draft.channel === 'sms' ? 'Message' : draft.design ? 'Plain-text version' : 'Letter'} description={draft.channel === 'sms' ? `${rendered.length} characters · ${segments} text ${segments === 1 ? 'segment' : 'segments'} per guest` : undefined}>
              {(control) => <Textarea {...control} ref={bodyRef} rows={8} value={draft.body} onChange={(e) => set({ body: e.target.value })} />}
            </Field>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {CAMPAIGN_PLACEHOLDERS.map((token) => (
                <button key={token} type="button" onClick={() => insert(token)} className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted transition-colors hover:border-primary/50 hover:text-foreground">
                  {token}
                </button>
              ))}
            </div>
          </div>

          {draft.channel === 'email' && !draft.design ? (
            <section className="rounded-xl border border-line p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Button</p>
                  <p className="mt-0.5 text-xs text-subtle">A big button under the message. Links are tagged so bookings are counted.</p>
                </div>
                <Switch checked={draft.button.enabled} onCheckedChange={(enabled) => set({ button: { ...draft.button, enabled } })} aria-label="Button" />
              </div>
              {draft.button.enabled ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Button text">
                    {(control) => <Input {...control} value={draft.button.label} onChange={(e) => set({ button: { ...draft.button, label: e.target.value } })} />}
                  </Field>
                  <Field label="Goes to">
                    <Select value={draft.button.activitySlug || 'home'} onValueChange={(value) => set({ button: { ...draft.button, activitySlug: value === 'home' ? '' : value } })}>
                      <SelectTrigger aria-label="Goes to"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="home">Your storefront</SelectItem>
                        {activities.map((activity) => (
                          <SelectItem key={activity.slug} value={activity.slug}>{activity.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-xl border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Tag className="size-4 text-subtle" aria-hidden="true" />
                  Include a discount code
                </p>
                <p className="mt-0.5 text-xs text-subtle">Added to Pricing → Promo codes when it goes, so checkout takes it.</p>
              </div>
              <Switch
                checked={draft.offer.enabled}
                onCheckedChange={(enabled) => set({ offer: { ...draft.offer, enabled, code: draft.offer.code || `SAVE${draft.offer.percent}` } })}
                aria-label="Include a discount code"
              />
            </div>
            {draft.offer.enabled ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Code">
                  {(control) => <Input {...control} className="font-mono" value={draft.offer.code} onChange={(e) => set({ offer: { ...draft.offer, code: cleanCode(e.target.value) } })} />}
                </Field>
                <Field label="Discount">
                  {(control) => <Input {...control} type="number" min={1} max={100} suffix="%" value={draft.offer.percent} onChange={(e) => set({ offer: { ...draft.offer, percent: Math.min(100, Math.max(1, Number(e.target.value) || 1)) } })} />}
                </Field>
                <Field label="Good for">
                  {(control) => <Input {...control} type="number" min={1} suffix="days" value={draft.offer.validDays} onChange={(e) => set({ offer: { ...draft.offer, validDays: Math.max(1, Number(e.target.value) || 1) } })} />}
                </Field>
              </div>
            ) : null}
          </section>

          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Preview</p>
            {draft.channel === 'email' ? (
              <div className="overflow-hidden rounded-xl border border-line" style={{ background: (draft.design ?? letter).theme.background }}>
                <div className="border-b border-line-subtle bg-surface px-4 py-2.5 text-xs text-subtle">
                  <span className="font-medium text-foreground">{business}</span> · {render(draft.subject) || 'No subject yet'}
                  {draft.preheader ? <span className="text-faint"> — {render(draft.preheader)}</span> : null}
                </div>
                <EmailFrame design={draft.design ?? letter} ctx={emailCtx} preheader={draft.preheader} width={600} scale={0.88} className="mx-auto" />
              </div>
            ) : (
              <p className="max-w-[20rem] rounded-2xl rounded-bl-md bg-surface-sunken px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line text-foreground">
                {rendered} Reply STOP to opt out.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">When</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['now', 'later'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={when === value}
                  onClick={() => {
                    setWhen(value)
                    if (value === 'later' && !draft.sendAt) set({ sendAt: new Date(defaultLater).toISOString() })
                  }}
                  className={cn('rounded-xl border px-3.5 py-3 text-left', when === value ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong')}
                >
                  <span className="block text-sm font-medium">{value === 'now' ? 'Send now' : 'Schedule'}</span>
                  <span className="block text-xs text-subtle">{value === 'now' ? 'Goes out in a few minutes' : 'Pick a day and time'}</span>
                </button>
              ))}
            </div>
            {when === 'later' ? (
              <Field label="Send on">
                {(control) => (
                  <Input
                    {...control}
                    type="datetime-local"
                    className="sm:w-64"
                    value={draft.sendAt ? toLocalInput(draft.sendAt) : defaultLater}
                    onChange={(e) => set({ sendAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  />
                )}
              </Field>
            ) : null}
            {paused ? <p className="text-xs font-medium text-warning">Marketing is paused in Settings. It will send once you resume.</p> : null}
            {problems.length > 0 ? <p className="text-xs text-danger">{problems.join(' · ')}</p> : null}
          </section>
        </SheetBody>
        <SheetFooter>
          <Button variant="ghost" onClick={() => onSave(draft, 'draft')} disabled={draft.name.trim().length < 2}>
            Save draft
          </Button>
          <Button variant="ghost" leftIcon={<Send />} onClick={() => toast.success('Test sent', { description: 'To your email and phone.' })}>
            Send a test
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" leftIcon={<X />} onClick={onClose}>Cancel</Button>
          <Button
            leftIcon={when === 'now' ? <Send /> : <CalendarClock />}
            disabled={problems.length > 0}
            onClick={() => onSave(when === 'later' ? { ...draft, sendAt: draft.sendAt ?? new Date(defaultLater).toISOString() } : draft, when === 'now' ? 'send' : 'schedule')}
          >
            {when === 'now' ? `Send to ${recipients.toLocaleString('en-US')}` : 'Schedule'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function toLocalInput(iso: string) {
  const at = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/* ==========================================================================
   Report
   ========================================================================== */

function CampaignReport({ campaign, stats, currency }: { campaign: Campaign; stats: CampaignStats; currency: Tenant['currency'] }) {
  const funnel = [
    { label: 'Delivered', value: stats.delivered },
    ...(campaign.channel === 'email' ? [{ label: 'Opened', value: stats.opened }] : []),
    { label: 'Clicked', value: stats.clicked },
    { label: 'Booked', value: stats.bookings },
  ]
  return (
    <>
      <SheetHeader>
        <SheetTitle>{campaign.name}</SheetTitle>
        <SheetDescription>{campaign.sentAt ? `Sent ${formatDateTime(campaign.sentAt)} to ${stats.recipients.toLocaleString('en-US')} guests` : null}</SheetDescription>
      </SheetHeader>
      <SheetBody className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line px-4 py-3">
            <p className="text-xs text-subtle">Revenue</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular">{formatCurrency(stats.revenue * 100, currency)}</p>
          </div>
          <div className="rounded-xl border border-line px-4 py-3">
            <p className="text-xs text-subtle">Unsubscribed</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular">{stats.unsubscribed}</p>
          </div>
        </div>
        <ul className="flex list-none flex-col gap-3 p-0">
          {funnel.map((step) => (
            <li key={step.label}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted">{step.label}</span>
                <span className="font-semibold tabular">
                  {step.value.toLocaleString('en-US')} <span className="text-xs font-normal text-subtle">{percent(step.value / Math.max(1, stats.delivered), 1)}</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-surface-sunken">
                <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.max(2, (step.value / Math.max(1, stats.delivered)) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
        {campaign.abTest.enabled ? (
          <div className="rounded-xl border border-line px-4 py-3 text-sm">
            <p className="font-medium">Subject test</p>
            <p className="mt-1 text-muted">A: {campaign.subject}</p>
            <p className="text-muted">B: {campaign.abTest.subjectB}</p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-success"><Check className="size-3.5" aria-hidden="true" />B won with {percent(0.06 + (stats.opened % 7) / 100)} more opens and went to the rest.</p>
          </div>
        ) : null}
      </SheetBody>
      <SheetFooter>
        <p className="text-xs text-subtle">Bookings count when a guest books within 7 days of clicking.</p>
      </SheetFooter>
    </>
  )
}
