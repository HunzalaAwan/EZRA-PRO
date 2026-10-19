'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  Check,
  Clock,
  Copy,
  Mail,
  Megaphone,
  MessageSquareText,
  MoreHorizontal,
  MousePointerClick,
  Pencil,
  Plus,
  Send,
  Tag,
  Trash2,
  Undo2,
  Wallet,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Field, type FieldControlProps } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatCard, StatGrid } from '@/components/ui/stat'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useChannels } from '@/hooks/use-channels'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { brandColors, useEmailContext } from '@/hooks/use-email-context'
import { usePricing } from '@/hooks/use-pricing'
import { EmailContentCard } from '@/components/dashboard/marketing/email-content-card'
import { EmailFrame } from '@/components/dashboard/marketing/email-designer'
import { NumberInput } from '@/components/dashboard/marketing/number-input'
import { fromAddress, storefrontHost, textingNumber } from '@/lib/channels'
import { blockId, designFromText, plainTextOf, type EmailContext, type EmailDesign, type SavedEmailTemplate } from '@/lib/email-design'
import { smsLength } from '@/lib/flows/check'
import type { MarketingData } from '@/lib/data/guest-marketing'
import type { PromoCode } from '@/lib/pricing'
import {
  CAMPAIGN_DETAILS,
  NO_OFFER,
  abTestEstimate,
  audienceSize,
  campaignBreakdown,
  campaignPromoNote,
  campaignStatsFor,
  campaignTextForDisplay,
  campaignTextFromDisplay,
  cleanCode,
  marketingSender,
  normalizeCampaignTokens,
  offerCodeClash,
  offerWindow,
  percent,
  quietHoursRelease,
  retireOfferPromo,
  unknownCampaignTokens,
  upsertOfferPromo,
  type Campaign,
  type CampaignStats,
  type EarlierSend,
  type MarketingContact,
  type MarketingSettings,
  type SendBreakdown,
} from '@/lib/marketing'
import { cn, formatCurrency, formatDateLong, formatDateTime, formatTime } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   CAMPAIGNS
   One-off emails and texts to an audience: a new season, last-minute seats,
   a locals deal. The composer walks through five plain steps — who, the
   message, an offer, when — and ends on a review that counts exactly who
   gets it under the marketing rules, then asks before anything goes.
   Sent campaigns show what they earned (estimated until sending is live).
   ========================================================================== */

const STARTERS: { id: string; name: string; hint: string; channel: Campaign['channel']; subject: string; body: string; offer?: { percent: number; code: string }; button?: string }[] = [
  { id: 'blank', name: 'Start blank', hint: 'Your own words', channel: 'email', subject: '', body: 'Hi {first_name},\n\n' },
  {
    id: 'newsletter',
    name: 'Monthly newsletter',
    hint: 'What is new, best days to go',
    channel: 'email',
    subject: 'What is new at {business} this month',
    body: 'Hi {first_name},\n\nHere is what is happening this month: new dates, what the team has been up to, and the best days to come.\n\nSee you soon,\n{business}',
    button: 'See dates',
  },
  {
    id: 'lastminute',
    name: 'Last-minute seats',
    hint: 'Fill this week’s gaps',
    channel: 'sms',
    subject: '',
    body: '{business}: a few seats left this week. {offer_percent} off with {offer_code} until Sunday: {book_link}',
    offer: { percent: 15, code: 'LASTSEATS15' },
  },
  {
    id: 'launch',
    name: 'Something new',
    hint: 'Announce a new trip or class',
    channel: 'email',
    subject: 'New: something we have been waiting to share',
    body: 'Hi {first_name},\n\nWe have something brand new and you are among the first to hear. Early bookers get {offer_percent} off with {offer_code}.\n\n{business}',
    offer: { percent: 10, code: 'NEWTRIP10' },
    button: 'Be first to book',
  },
  {
    id: 'seasonal',
    name: 'Seasonal offer',
    hint: 'A reason to book now',
    channel: 'email',
    subject: '{offer_percent} off for a limited time',
    body: 'Hi {first_name},\n\nFor the next two weeks, every booking is {offer_percent} off with code {offer_code}. Bring a friend.\n\n{business}',
    offer: { percent: 20, code: 'SEASON20' },
    button: 'Book now',
  },
  {
    id: 'gift',
    name: 'Gift cards',
    hint: 'Birthdays and holidays',
    channel: 'email',
    subject: 'A gift they will remember',
    body: 'Hi {first_name},\n\nStuck for a present? A {business} gift card is good for any booking for a full year, and arrives by email in a minute.\n\n{business}',
    button: 'Buy a gift card',
  },
]

const noteFor = campaignPromoNote

export interface CampaignAudience {
  id: string
  name: string
  description: string
  /** Everyone it matches, before consent for a channel. */
  members: MarketingContact[]
  email: number
  sms: number
}

export function CampaignsClient({ tenant: tenantRecord, nowIso, data }: { tenant: Tenant; nowIso: string; data: MarketingData }) {
  const tenant = useMarketingTenant(tenantRecord)
  const currency = tenantRecord.currency
  const marketing = useMarketing(tenant, nowIso)
  const pricing = usePricing(tenant.slug)
  const { settings: channels } = useChannels(tenantRecord)
  const [editing, setEditing] = React.useState<{ campaign: Campaign; original?: Campaign } | null>(null)
  // The campaign stays set while the sheet or dialog animates closed, so it never flashes empty.
  const [report, setReport] = React.useState<Campaign | null>(null)
  const [reportOpen, setReportOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState<Campaign | null>(null)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [picking, setPicking] = React.useState(false)
  const [tab, setTab] = React.useState<'all' | Campaign['status']>('all')
  const host = storefrontHost(channels, tenant.slug)
  const ctx = useEmailContext(tenantRecord, data.activities, { first_name: 'Maya', link: host, book_link: host })
  const brand = React.useMemo(() => brandColors(tenantRecord), [tenantRecord])
  const sender = marketingSender(marketing.settings, channels.email, { name: tenant.name, email: tenant.email })
  const address = fromAddress(channels, tenant.slug)

  // Each audience counted once per render, not once per row and per menu item.
  const audiences = React.useMemo<CampaignAudience[]>(
    () =>
      marketing.audiences.map((audience) => {
        const size = audienceSize(data.contacts, audience.filter, nowIso)
        return { id: audience.id, name: audience.name, description: audience.description, members: size.members, email: size.email, sms: size.sms }
      }),
    [marketing.audiences, data.contacts, nowIso],
  )
  const audienceById = React.useMemo(() => new Map(audiences.map((audience) => [audience.id, audience])), [audiences])

  // Who each sent campaign reached, for the weekly limit on the next one.
  const earlier = React.useMemo(() => {
    const sends: (EarlierSend & { id: string })[] = []
    for (const campaign of marketing.campaigns) {
      if (campaign.status !== 'sent' || !campaign.sentAt) continue
      const members = audienceById.get(campaign.audienceId)?.members ?? []
      sends.push({
        id: campaign.id,
        sentAt: campaign.sentAt,
        to: new Set(members.filter((contact) => (campaign.channel === 'sms' ? contact.smsOptIn : contact.emailOptIn)).map((contact) => contact.id)),
      })
    }
    return sends
  }, [marketing.campaigns, audienceById])

  const breakdownFor = React.useCallback(
    (campaign: Pick<Campaign, 'id' | 'audienceId' | 'channel'>, at: string): SendBreakdown =>
      campaignBreakdown({
        audienceMembers: audienceById.get(campaign.audienceId)?.members ?? [],
        channel: campaign.channel,
        sendAt: at,
        settings: marketing.settings,
        earlier: earlier.filter((send) => send.id !== campaign.id),
      }),
    [audienceById, marketing.settings, earlier],
  )

  const statsOf = React.useCallback(
    (campaign: Campaign): CampaignStats | undefined =>
      campaign.status !== 'sent'
        ? undefined
        : (campaign.stats ?? campaignStatsFor(campaign.id, breakdownFor(campaign, campaign.sentAt ?? nowIso).recipients, data.avgOrder, campaign.channel)),
    [breakdownFor, data.avgOrder, nowIso],
  )

  const sent = marketing.campaigns.filter((campaign) => campaign.status === 'sent')
  const totals = sent.reduce(
    (sum, campaign) => {
      const stats = statsOf(campaign)!
      return {
        delivered: sum.delivered + stats.delivered,
        opened: sum.opened + (campaign.channel === 'email' ? stats.opened : 0),
        emailDelivered: sum.emailDelivered + (campaign.channel === 'email' ? stats.delivered : 0),
        clicked: sum.clicked + stats.clicked,
        bookings: sum.bookings + stats.bookings,
        revenue: sum.revenue + stats.revenue,
      }
    },
    { delivered: 0, opened: 0, emailDelivered: 0, clicked: 0, bookings: 0, revenue: 0 },
  )
  const counts = { draft: 0, scheduled: 0, sent: 0 }
  for (const campaign of marketing.campaigns) counts[campaign.status] += 1
  const list = marketing.campaigns.filter((campaign) => tab === 'all' || campaign.status === tab).sort((a, b) => (order(a) < order(b) ? 1 : -1))

  const start = (starterId: string) => {
    const starter = STARTERS.find((entry) => entry.id === starterId) ?? STARTERS[0]
    setPicking(false)
    setEditing({
      campaign: {
        id: `cmp_${Date.now().toString(36)}`,
        name: starter.id === 'blank' ? 'New campaign' : starter.name,
        channel: starter.channel,
        audienceId: 'aud_all',
        subject: starter.subject,
        preheader: '',
        body: starter.body,
        button: { enabled: Boolean(starter.button), label: starter.button ?? 'Book now', activitySlug: '' },
        offer: starter.offer ? { enabled: true, percent: starter.offer.percent, validDays: 14, code: starter.offer.code } : NO_OFFER,
        abTest: { enabled: false, subjectB: '' },
        status: 'draft',
        createdAt: nowIso,
      },
    })
  }

  const copyOf = (campaign: Campaign): Campaign => ({
    ...campaign,
    id: `cmp_${Date.now().toString(36)}`,
    name: `${campaign.name} (copy)`,
    status: 'draft',
    sentAt: undefined,
    sendAt: undefined,
    stats: undefined,
    createdAt: nowIso,
  })

  const save = (campaign: Campaign, mode: 'draft' | 'schedule' | 'send', original?: Campaign) => {
    let next: Campaign
    if (mode === 'send') {
      const recipients = breakdownFor(campaign, nowIso).recipients
      next = { ...campaign, status: 'sent', sentAt: nowIso, sendAt: undefined, stats: campaignStatsFor(campaign.id, recipients, data.avgOrder, campaign.channel) }
    } else next = { ...campaign, status: mode === 'schedule' ? 'scheduled' : 'draft' }
    marketing.saveCampaign(next)

    // The code goes into Promo codes when the campaign is set to go, working from the day it goes.
    let promos = pricing.promos
    const oldCode = original?.status === 'scheduled' && original.offer.enabled ? cleanCode(original.offer.code) : ''
    const newCode = next.offer.enabled && mode !== 'draft' ? cleanCode(next.offer.code) : ''
    if (oldCode && oldCode !== newCode) promos = retireOfferPromo(promos, oldCode, noteFor(original!))
    if (newCode) promos = upsertOfferPromo(promos, next.offer, noteFor(next), [], next.sentAt ?? next.sendAt ?? nowIso)
    if (promos !== pricing.promos) pricing.setPromos(promos)

    setEditing(null)
    if (mode === 'send') {
      toast.success(`${campaign.name} is on its way`, {
        description: `${(next.stats?.recipients ?? 0).toLocaleString('en-US')} ${campaign.channel === 'sms' ? 'texts' : 'emails'} going out now.`,
      })
    } else if (mode === 'schedule') toast.success('Campaign scheduled', { description: campaign.sendAt ? `Goes ${formatDateTime(campaign.sendAt)}.` : undefined })
    else toast('Draft saved')
  }

  const unschedule = (campaign: Campaign) => {
    marketing.unscheduleCampaign(campaign.id)
    if (campaign.offer.enabled) pricing.setPromos(retireOfferPromo(pricing.promos, campaign.offer.code, noteFor(campaign)))
    toast('Moved back to drafts', { description: 'It will not go until you schedule or send it again.' })
  }

  const remove = (campaign: Campaign) => {
    marketing.removeCampaign(campaign.id)
    if (campaign.status === 'scheduled' && campaign.offer.enabled) pricing.setPromos(retireOfferPromo(pricing.promos, campaign.offer.code, noteFor(campaign)))
    setDeleteOpen(false)
    toast('Campaign deleted')
  }

  return (
    <div className="flex flex-col gap-6">
      <StatGrid columns={4}>
        <StatCard
          accent="lead"
          icon={Megaphone}
          stat={{ label: 'Campaigns sent', value: sent.length, format: 'number', hint: 'Every campaign that has gone out, by email or text.' }}
          footer={`${totals.delivered.toLocaleString('en-US')} delivered in all`}
        />
        <StatCard
          accent="guests"
          icon={MousePointerClick}
          stat={{
            label: 'Email open rate (est.)',
            value: totals.emailDelivered > 0 ? (totals.opened / totals.emailDelivered) * 100 : 0,
            format: 'percent',
            decimals: 1,
            hint: 'Estimated from your guest list until sending is connected. Real sends report the opens they get.',
          }}
          footer={`${totals.clicked.toLocaleString('en-US')} clicks (est.)`}
        />
        <StatCard
          accent="bookings"
          icon={CalendarCheck}
          stat={{ label: 'Bookings (est.)', value: totals.bookings, format: 'number', hint: 'Bookings made within 7 days of a click, estimated.' }}
          footer="Within 7 days of a click"
        />
        <StatCard
          accent="revenue"
          icon={Wallet}
          stat={{ label: 'Revenue (est.)', value: totals.revenue * 100, format: 'currency', currency, hint: 'Those bookings at your average booking value.' }}
          footer="From campaign bookings"
          compact
        />
      </StatGrid>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Show"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: 'all', label: 'All', count: marketing.campaigns.length },
            { value: 'draft', label: 'Drafts', count: counts.draft },
            { value: 'scheduled', label: 'Scheduled', count: counts.scheduled },
            { value: 'sent', label: 'Sent', count: counts.sent },
          ]}
        />
        <Button leftIcon={<Plus />} onClick={() => setPicking(true)}>
          New campaign
        </Button>
      </div>

      {picking ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Start from</p>
                <p className="text-xs text-subtle">You can change every word afterwards.</p>
              </div>
              <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => setPicking(false)}>
                Close
              </Button>
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
                    <span className="block text-xs text-subtle">
                      {starter.channel === 'sms' ? 'Text' : 'Email'} · {starter.hint}
                      {starter.offer ? ` · ${starter.offer.percent}% code` : ''}
                    </span>
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
            <div className="flex flex-col items-start gap-3 px-5 py-8">
              <p className="text-sm text-muted">{tab === 'all' ? 'No campaigns yet.' : `No ${tab === 'draft' ? 'drafts' : tab} campaigns.`}</p>
              <Button size="sm" variant="secondary" leftIcon={<Plus />} onClick={() => setPicking(true)}>
                New campaign
              </Button>
            </div>
          ) : (
            <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
              {list.map((campaign) => {
                const stats = statsOf(campaign)
                const audience = audienceById.get(campaign.audienceId)
                const waiting = campaign.status === 'scheduled' && marketing.settings.paused && campaign.sendAt && new Date(campaign.sendAt).getTime() <= new Date(nowIso).getTime()
                const reach = stats?.recipients ?? breakdownFor(campaign, campaign.sendAt ?? nowIso).recipients
                return (
                  <li key={campaign.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-subtle">
                        {campaign.channel === 'sms' ? <MessageSquareText className="size-[1.125rem]" /> : <Mail className="size-[1.125rem]" />}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{campaign.name}</p>
                          <Badge variant={waiting ? 'warning' : campaign.status === 'sent' ? 'success' : campaign.status === 'scheduled' ? 'info' : 'neutral'} size="sm">
                            {waiting ? 'Waiting' : campaign.status === 'sent' ? 'Sent' : campaign.status === 'scheduled' ? 'Scheduled' : 'Draft'}
                          </Badge>
                          {campaign.offer.enabled ? (
                            <Badge variant="neutral" size="sm">
                              {campaign.offer.percent}% · {campaign.offer.code}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-subtle">
                          {campaign.status === 'sent' && campaign.sentAt
                            ? `Sent ${formatDateTime(campaign.sentAt)}`
                            : waiting
                              ? 'Goes once marketing is resumed'
                              : campaign.status === 'scheduled' && campaign.sendAt
                                ? `Goes ${formatDateTime(campaign.sendAt)}`
                                : 'Not sent'}
                          {' · '}
                          {audience ? audience.name : <span className="text-warning">Audience deleted</span>} · {reach.toLocaleString('en-US')}{' '}
                          {campaign.channel === 'sms' ? (reach === 1 ? 'phone' : 'phones') : reach === 1 ? 'inbox' : 'inboxes'}
                        </p>
                      </div>
                    </div>
                    {stats ? (
                      <dl className="grid grid-cols-4 gap-4 pl-[3.25rem] text-xs lg:w-[26rem] lg:pl-0 lg:text-right">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setReport(campaign)
                            setReportOpen(true)
                          }}
                        >
                          Report
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => setEditing({ campaign: { ...campaign }, original: campaign })}>
                          Edit
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <IconButton variant="ghost" size="sm" aria-label={`More for ${campaign.name}`}>
                            <MoreHorizontal />
                          </IconButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-48">
                          <DropdownMenuLabel>{campaign.name}</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => setEditing({ campaign: copyOf(campaign) })}>
                            <Copy /> Copy as a new draft
                          </DropdownMenuItem>
                          {campaign.status === 'scheduled' ? (
                            <DropdownMenuItem onSelect={() => unschedule(campaign)}>
                              <Undo2 /> Move back to drafts
                            </DropdownMenuItem>
                          ) : null}
                          {campaign.status !== 'sent' ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                tone="danger"
                                onSelect={() => {
                                  setDeleting(campaign)
                                  setDeleteOpen(true)
                                }}
                              >
                                <Trash2 /> Delete
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
          campaign={editing.campaign}
          isScheduled={editing.original?.status === 'scheduled'}
          business={tenant.name}
          audiences={audiences}
          activities={data.activities}
          nowIso={nowIso}
          settings={marketing.settings}
          sender={{ name: sender.name, replyTo: sender.replyTo, address }}
          testPhone={tenantRecord.contact.phone}
          textFrom={textingNumber(channels)}
          host={host}
          promos={pricing.promos}
          breakdownFor={breakdownFor}
          ctx={ctx}
          brand={brand}
          saved={marketing.emailTemplates}
          onSaveTemplate={(name, design) => {
            marketing.saveEmailTemplate({ id: 'tpl_' + Date.now().toString(36), name, design, updatedAt: new Date().toISOString() })
            toast.success(name + ' saved to Email templates')
          }}
          onClose={() => setEditing(null)}
          onSave={(campaign, mode) => save(campaign, mode, editing.original)}
        />
      ) : null}

      <Sheet open={reportOpen} onOpenChange={setReportOpen}>
        <SheetContent side="right" size="md">
          {report ? (
            <CampaignReport
              campaign={report}
              stats={statsOf(report)!}
              currency={currency}
              audienceName={audienceById.get(report.audienceId)?.name}
              promo={report.offer.enabled ? pricing.promos.find((promo) => promo.code === cleanCode(report.offer.code)) : undefined}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              {deleting?.status === 'scheduled' ? 'It will not go out, and its discount code is switched off.' : 'The draft and its words are gone for good.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep it
            </Button>
            <Button variant="danger" leftIcon={<Trash2 />} onClick={() => deleting && remove(deleting)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function order(campaign: Campaign) {
  return campaign.status === 'draft' ? `3${campaign.createdAt}` : campaign.status === 'scheduled' ? `2${campaign.sendAt ?? ''}` : `1${campaign.sentAt ?? ''}`
}

/* ==========================================================================
   Composer — Who → Message → Offer → When → Review
   ========================================================================== */

type StepId = 'who' | 'message' | 'offer' | 'when' | 'review'

const STEPS: { id: StepId; label: string; help: string }[] = [
  { id: 'who', label: 'Who', help: 'Name it, and pick who gets it.' },
  { id: 'message', label: 'Message', help: 'What they read. Personal details are filled in for each guest.' },
  { id: 'offer', label: 'Offer', help: 'An optional discount code that works at checkout.' },
  { id: 'when', label: 'When', help: 'Send it now, or pick a day and time.' },
  { id: 'review', label: 'Review', help: 'Check who gets it and what they see, then send.' },
]

interface Problem {
  step: StepId
  text: string
}

/** Short version of an email for a text: the first real line, the business up front and the link at the end. */
function smsFromEmail(body: string): string {
  const lines = normalizeCampaignTokens(body)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^hi\b|^hello\b/i.test(line) && line !== '{business}' && !/,$/.test(line))
  const first = (lines[0] ?? '').split(/(?<=[.!?])\s/)[0] ?? ''
  return `{business}: ${first.slice(0, 110)}${first ? ' ' : ''}{book_link}`.replace(/\s+/g, ' ').trim()
}

function emailFromSms(body: string): string {
  const text = normalizeCampaignTokens(body).replace(/^\{business\}:\s*/, '')
  return `Hi {first_name},\n\n${text}\n\n{business}`
}

function toLocalInput(iso: string) {
  const at = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
}

function atNine(nowIso: string, daysAhead: number) {
  const at = new Date(nowIso)
  at.setDate(at.getDate() + daysAhead)
  at.setHours(9, 0, 0, 0)
  return at
}

function CampaignEditor({
  campaign,
  isScheduled,
  business,
  audiences,
  activities,
  nowIso,
  settings,
  sender,
  testPhone,
  textFrom,
  host,
  promos,
  breakdownFor,
  ctx,
  brand,
  saved,
  onSaveTemplate,
  onClose,
  onSave,
}: {
  campaign: Campaign
  isScheduled: boolean
  business: string
  audiences: CampaignAudience[]
  activities: { slug: string; name: string }[]
  nowIso: string
  settings: MarketingSettings
  sender: { name: string; replyTo: string; address: string }
  testPhone: string
  textFrom: string
  host: string
  promos: PromoCode[]
  breakdownFor: (campaign: Pick<Campaign, 'id' | 'audienceId' | 'channel'>, at: string) => SendBreakdown
  ctx: EmailContext
  brand: string[]
  saved: SavedEmailTemplate[]
  onSaveTemplate: (name: string, design: EmailDesign) => void
  onClose: () => void
  onSave: (campaign: Campaign, mode: 'draft' | 'schedule' | 'send') => void
}) {
  const [draft, setDraft] = React.useState<Campaign>(() => ({
    ...campaign,
    subject: normalizeCampaignTokens(campaign.subject),
    preheader: normalizeCampaignTokens(campaign.preheader),
    body: normalizeCampaignTokens(campaign.body),
    abTest: { ...campaign.abTest, subjectB: normalizeCampaignTokens(campaign.abTest.subjectB) },
    sendAt: campaign.sendAt ?? (settings.paused ? atNine(nowIso, 1).toISOString() : undefined),
  }))
  const [step, setStep] = React.useState<StepId>('who')
  const [shown, setShown] = React.useState<Set<StepId>>(new Set())
  // Paused marketing can only be scheduled, so start there.
  const [when, setWhen] = React.useState<'now' | 'later'>(campaign.status === 'scheduled' || settings.paused ? 'later' : 'now')
  const [confirming, setConfirming] = React.useState(false)
  const [discarding, setDiscarding] = React.useState(false)
  const initial = React.useRef(draft)
  const requestClose = () => {
    if (JSON.stringify(draft) !== JSON.stringify(initial.current)) setDiscarding(true)
    else onClose()
  }
  const stash = React.useRef<Partial<Record<Campaign['channel'], Pick<Campaign, 'subject' | 'preheader' | 'body' | 'design'>>>>({})
  const set = (patch: Partial<Campaign>) => setDraft((current) => ({ ...current, ...patch }))

  const audience = audiences.find((entry) => entry.id === draft.audienceId)
  const now = new Date(nowIso)
  const chosen = when === 'later' && draft.sendAt ? new Date(draft.sendAt) : now
  const held = quietHoursRelease(chosen, settings.quietHours)
  const goesAt = held ?? chosen
  const breakdown = breakdownFor(draft, goesAt.toISOString())
  const recipients = audience ? breakdown.recipients : 0
  const channelWord = draft.channel === 'sms' ? 'text' : 'email'

  /* ---------- what the guest sees ---------- */
  const code = cleanCode(draft.offer.code)
  const vars: Record<string, string> = {
    first_name: 'Maya',
    business,
    offer_code: draft.offer.enabled ? code || 'CODE' : '',
    offer_percent: draft.offer.enabled ? `${draft.offer.percent}%` : '',
    book_link: host,
    link: host,
  }
  const render = (text: string, overrides: Record<string, string> = {}) =>
    text.replace(/\{([a-z_]+)\}/g, (match, key: string) => overrides[key] ?? vars[key] ?? match)
  const emailCtx = React.useMemo(() => ({ ...ctx, vars: { ...ctx.vars, ...vars } }), [ctx, vars.offer_code, vars.offer_percent]) // eslint-disable-line react-hooks/exhaustive-deps
  const offerDates = draft.offer.enabled ? offerWindow(draft.offer, goesAt.toISOString()) : null

  // Without a design: a simple letter from the text, with the code and the button under it and the footer from Settings.
  const letter = React.useMemo<EmailDesign>(() => {
    const base = designFromText(draft.subject, draft.body, brand[0] ?? '#601CEF')
    const footer = base.blocks[2]
    const extra = [
      ...(draft.offer.enabled ? [{ id: blockId(), type: 'coupon' as const, title: 'Your code', note: `Good for ${draft.offer.validDays} ${draft.offer.validDays === 1 ? 'day' : 'days'}.` }] : []),
      ...(draft.button.enabled
        ? [{ id: blockId(), type: 'button' as const, label: draft.button.label || 'Book now', link: draft.button.activitySlug ? 'activity:' + draft.button.activitySlug : '{book_link}', align: 'left' as const, style: 'solid' as const, full: false }]
        : []),
    ]
    return { ...base, blocks: [base.blocks[0], base.blocks[1], ...extra, footer.type === 'footer' && settings.footer.trim() ? { ...footer, text: settings.footer } : footer] }
  }, [draft.subject, draft.body, draft.offer.enabled, draft.offer.validDays, draft.button, brand, settings.footer])
  const design = draft.design ?? letter
  const plainText = draft.design && draft.body.trim().length < 10 ? plainTextOf(draft.design, (text) => render(text)) : render(draft.body)

  // Texts are counted as they go: real code, a short link, and the opt-out line.
  const smsSent = `${render(draft.body, { book_link: 'https://ezra.link/b/abc123', link: 'https://ezra.link/b/abc123' })} Reply STOP to opt out.`
  const sms = smsLength(smsSent)

  /* ---------- checks, by step ---------- */
  const allText = [draft.subject, draft.preheader, draft.body, draft.abTest.enabled ? draft.abTest.subjectB : '', draft.design ? JSON.stringify(draft.design) : ''].join('\n')
  const mentionsCode = /\{offer_code\}/.test(allText) || (draft.channel === 'email' && (!draft.design || draft.design.blocks.some((block) => block.type === 'coupon')))
  const unknown = unknownCampaignTokens(allText)
  // A code this campaign already put in Promo codes (under its old name) is its own, not a clash.
  const clashing = draft.offer.enabled ? offerCodeClash(promos, code, noteFor(draft)) : undefined
  const clash = clashing && clashing.note !== noteFor(campaign) ? clashing : undefined
  const problems: Problem[] = ([
    draft.name.trim().length < 2 ? { step: 'who' as const, text: 'Give it a name' } : null,
    !audience ? { step: 'who' as const, text: 'The audience it used was deleted. Pick who gets it.' } : null,
    audience && breakdown.recipients === 0
      ? {
          step: 'who' as const,
          text:
            breakdown.inAudience === 0
              ? 'Nobody is in this audience yet'
              : breakdown.noConsent === breakdown.inAudience
                ? `Nobody in ${audience.name} said yes to ${draft.channel === 'sms' ? 'marketing texts' : 'marketing emails'}`
                : `Everyone in ${audience.name} is held back by your marketing rules: ${[
                    breakdown.noConsent ? `${breakdown.noConsent} haven’t said yes to ${draft.channel === 'sms' ? 'texts' : 'emails'}` : '',
                    breakdown.tripSoon ? `${breakdown.tripSoon} have a trip in the next ${settings.skipUpcoming.days} days` : '',
                    breakdown.weeklyLimit ? `${breakdown.weeklyLimit} already had this week’s limit` : '',
                  ]
                    .filter(Boolean)
                    .join(', ')}. Pick a wider audience or a later day.`,
        }
      : null,
    draft.channel === 'email' && draft.subject.trim().length < 3 ? { step: 'message' as const, text: 'Add a subject line' } : null,
    draft.channel === 'email' && draft.abTest.enabled && draft.abTest.subjectB.trim().length < 3 ? { step: 'message' as const, text: 'Write the second subject line, or turn the test off' } : null,
    draft.channel === 'email' && !draft.design && draft.body.trim().length < 10 ? { step: 'message' as const, text: 'Write the letter, or design the email' } : null,
    draft.channel === 'sms' && draft.body.trim().length < 10 ? { step: 'message' as const, text: 'Write the text' } : null,
    unknown.length > 0 ? { step: 'message' as const, text: `These can't be filled in: ${unknown.join(', ')}. Use “Add personal detail” instead.` } : null,
    !draft.offer.enabled && /\{offer_(code|percent)\}/.test(allText) ? { step: 'offer' as const, text: 'The message mentions a discount code, but no code is set' } : null,
    draft.offer.enabled && code.length < 3 ? { step: 'offer' as const, text: 'Codes need at least 3 letters or numbers' } : null,
    when === 'later' && (!draft.sendAt || new Date(draft.sendAt).getTime() <= now.getTime()) ? { step: 'when' as const, text: `Pick a time after now (${formatDateTime(now)})` } : null,
    when === 'now' && settings.paused ? { step: 'when' as const, text: 'Marketing is paused, so nothing can go now. Schedule it, or resume marketing in Settings.' } : null,
  ] as (Problem | null)[]).filter((problem): problem is Problem => problem !== null)
  const problemsFor = (id: StepId) => problems.filter((problem) => problem.step === id)
  const stepIndex = STEPS.findIndex((entry) => entry.id === step)

  const goNext = () => {
    if (problemsFor(step).length > 0) {
      setShown((current) => new Set(current).add(step))
      return
    }
    setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)].id)
  }

  const switchChannel = (channel: Campaign['channel']) => {
    if (channel === draft.channel) return
    stash.current[draft.channel] = { subject: draft.subject, preheader: draft.preheader, body: draft.body, design: draft.design }
    const back = stash.current[channel]
    if (back) set({ channel, ...back })
    else if (channel === 'sms') set({ channel, body: smsFromEmail(draft.body), design: undefined })
    else set({ channel, body: emailFromSms(draft.body), subject: draft.subject || draft.name, design: undefined })
    toast(channel === 'sms' ? 'Switched to a text' : 'Switched to an email', {
      description: `We started the ${channel === 'sms' ? 'text' : 'email'} from your words. The ${channel === 'sms' ? 'email' : 'text'} is kept if you switch back.`,
    })
  }

  const sendTest = () => {
    if (problemsFor('message').length > 0) {
      setStep('message')
      setShown((current) => new Set(current).add('message'))
      return toast.error('Finish the message first')
    }
    if (draft.channel === 'email') {
      toast.success(`Test email sent to ${sender.replyTo}`, { description: `From ${sender.name} <${sender.address}> · “${render(draft.subject)}”` })
    } else {
      toast.success(`Test text sent to ${testPhone || 'your business phone'}`, { description: `From ${textFrom || 'our shared number'} · ${sms.segments} ${sms.segments === 1 ? 'part' : 'parts'}` })
    }
  }

  const confirmSend = () => {
    if (problems.length > 0) return
    if (when === 'now' && !held) return setConfirming(true)
    // Scheduled, or held by quiet hours: it waits until it may go.
    onSave({ ...draft, sendAt: goesAt.toISOString() }, 'schedule')
  }

  const primaryLabel =
    when === 'now' && !held ? `Send to ${recipients.toLocaleString('en-US')}` : `Schedule for ${recipients.toLocaleString('en-US')}`

  return (
    <Sheet open onOpenChange={(value) => !value && requestClose()}>
      <SheetContent side="right" size="xl">
        <SheetHeader>
          <SheetTitle>{draft.name.trim() || 'New campaign'}</SheetTitle>
          <SheetDescription>{STEPS[stepIndex].help}</SheetDescription>
          <ol className="mt-3 flex list-none gap-1 overflow-x-auto p-0" aria-label="Steps">
            {STEPS.map((entry, index) => {
              const issues = problemsFor(entry.id).length > 0 && (shown.has(entry.id) || step === 'review')
              const done = index < stepIndex && problemsFor(entry.id).length === 0
              return (
                <li key={entry.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setStep(entry.id)}
                    aria-current={step === entry.id ? 'step' : undefined}
                    className={cn(
                      'flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors',
                      step === entry.id ? 'bg-surface-sunken text-foreground' : 'text-muted hover:text-foreground',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid size-5 place-items-center rounded-full border text-xs font-semibold',
                        issues ? 'border-danger/40 bg-danger-soft text-danger' : done ? 'border-primary bg-primary text-on-primary' : step === entry.id ? 'border-foreground/40 text-foreground' : 'border-line-strong text-subtle',
                      )}
                    >
                      {issues ? '!' : done ? <Check className="size-3" /> : index + 1}
                    </span>
                    {entry.label}
                    {issues ? <span className="sr-only">, needs attention</span> : done ? <span className="sr-only">, done</span> : null}
                  </button>
                </li>
              )
            })}
          </ol>
        </SheetHeader>

        <SheetBody className="flex flex-col gap-6">
          {shown.has(step) && problemsFor(step).length > 0 ? <ProblemList problems={problemsFor(step)} /> : null}

          {/* ---------- 1. who ---------- */}
          {step === 'who' ? (
            <>
              <Field label="Name" description="Only you and your team see this.">
                {(control) => <Input {...control} value={draft.name} onChange={(e) => set({ name: e.target.value })} />}
              </Field>

              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Send as</h3>
                <RadioGroup value={draft.channel} onValueChange={(value) => switchChannel(value as Campaign['channel'])} className="grid gap-2 sm:grid-cols-2">
                  <RadioGroupCard value="email" label="Email" description="Room for photos, a button and a code." icon={<Mail className="size-4" />} />
                  <RadioGroupCard value="sms" label="Text message" description="Short and read within minutes. Best for last-minute seats." icon={<MessageSquareText className="size-4" />} />
                </RadioGroup>
              </section>

              <section className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold">Who gets it</h3>
                  <Link href="/dashboard/marketing/audiences" className="text-xs font-medium text-primary hover:underline">
                    Manage audiences
                  </Link>
                </div>
                {!audience ? (
                  <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft/40 px-3.5 py-2.5 text-sm text-foreground">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                    The audience this campaign was set to go to has been deleted. Pick another below.
                  </p>
                ) : null}
                <RadioGroup value={audience ? draft.audienceId : ''} onValueChange={(audienceId) => set({ audienceId })} className="grid gap-2">
                  {audiences.map((entry) => {
                    const reachable = draft.channel === 'sms' ? entry.sms : entry.email
                    return (
                      <RadioGroupCard
                        key={entry.id}
                        value={entry.id}
                        label={entry.name}
                        description={entry.description}
                        className="p-3.5"
                        trailing={
                          <span className="text-right">
                            <span className={cn('block text-sm font-semibold tabular', reachable === 0 ? 'text-subtle' : 'text-foreground')}>{reachable.toLocaleString('en-US')}</span>
                            <span className="block text-xs text-subtle">{draft.channel === 'sms' ? 'texts on' : 'subscribed'}</span>
                          </span>
                        }
                      />
                    )
                  })}
                </RadioGroup>
                {audience && breakdown.recipients > 0 && breakdown.recipients < 20 ? (
                  <p className="text-xs text-subtle">A small list: fine for a test or a special group. For more bookings, pick a wider audience.</p>
                ) : null}
              </section>
            </>
          ) : null}

          {/* ---------- 2. message ---------- */}
          {step === 'message' ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
              <div className="flex min-w-0 flex-col gap-5">
                {draft.channel === 'email' ? (
                  <>
                    <Field label="Subject line">
                      {(control) => <DetailText control={control} value={draft.subject} onChange={(subject) => set({ subject })} />}
                    </Field>
                    <Field label="Preview text" optional description="The grey line after the subject in most inboxes.">
                      {(control) => <DetailText control={control} value={draft.preheader} onChange={(preheader) => set({ preheader })} />}
                    </Field>
                    <EmailContentCard
                      design={draft.design}
                      onChange={(next) => set({ design: next })}
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
                    <Field
                      label={draft.design ? 'Plain-text version' : 'Letter'}
                      optional={Boolean(draft.design)}
                      description={draft.design ? 'For inboxes that show text only. Left empty, we make it from your design.' : 'Goes as a simple letter with your colours.'}
                    >
                      {(control) => <DetailText control={control} multiline rows={draft.design ? 5 : 8} value={draft.body} onChange={(body) => set({ body })} />}
                    </Field>
                    {!draft.design ? (
                      <section className="rounded-xl border border-line p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Button</p>
                            <p className="mt-0.5 text-xs text-subtle">A big button under the letter, to your booking page or one activity.</p>
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
                                <SelectTrigger aria-label="Goes to">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="home">Your booking page</SelectItem>
                                  {activities.map((activity) => (
                                    <SelectItem key={activity.slug} value={activity.slug}>
                                      {activity.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </Field>
                          </div>
                        ) : null}
                      </section>
                    ) : null}
                    <section className="rounded-xl border border-line p-4">
                      <label className="flex items-start justify-between gap-3">
                        <span>
                          <span className="block text-sm font-medium">Try a second subject line</span>
                          <span className="block text-xs text-subtle">Half the list gets each. The report shows which one more people opened.</span>
                        </span>
                        <Switch checked={draft.abTest.enabled} onCheckedChange={(enabled) => set({ abTest: { ...draft.abTest, enabled } })} aria-label="Try a second subject line" />
                      </label>
                      {draft.abTest.enabled ? (
                        <Field label="Second subject line" className="mt-4">
                          {(control) => <DetailText control={control} value={draft.abTest.subjectB} onChange={(subjectB) => set({ abTest: { enabled: true, subjectB } })} />}
                        </Field>
                      ) : null}
                    </section>
                  </>
                ) : (
                  <>
                    <Field
                      label="Text"
                      hint={`${sms.chars} characters · ${sms.segments} ${sms.segments === 1 ? 'part' : 'parts'}`}
                      description={
                        sms.encoding === 'unicode'
                          ? `An emoji, curly quote or special letter makes each part hold ${sms.perSegment} characters instead of 160.`
                          : 'Counted with the opt-out line we add and a short link.'
                      }
                    >
                      {(control) => <DetailText control={control} multiline rows={5} value={draft.body} onChange={(body) => set({ body })} />}
                    </Field>
                    {sms.segments > 2 ? (
                      <p className="flex items-start gap-1.5 text-xs text-warning">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        Each guest gets this as {sms.segments} texts, and you pay for each. Most good marketing texts fit in one or two.
                      </p>
                    ) : null}
                    {!/\{business\}/.test(draft.body) && !draft.body.toLowerCase().includes(business.toLowerCase()) ? (
                      <p className="text-xs text-subtle">Tip: start with your business name so guests know who it is from. Carriers expect it.</p>
                    ) : null}
                  </>
                )}
              </div>

              <aside className="flex flex-col gap-2 lg:sticky lg:top-0 lg:self-start">
                <p className="text-xs font-semibold tracking-wide text-subtle uppercase">What Maya sees</p>
                {draft.channel === 'email' ? (
                  <EmailPreview design={design} ctx={emailCtx} sender={sender.name} subject={render(draft.subject)} preheader={render(draft.preheader)} scale={0.5} />
                ) : (
                  <SmsPreview text={smsSent.replace('https://ezra.link/b/abc123', host)} from={textFrom || business} />
                )}
              </aside>
            </div>
          ) : null}

          {/* ---------- 3. offer ---------- */}
          {step === 'offer' ? (
            <>
              <section className="rounded-xl border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-sm font-medium">
                      <Tag className="size-4 text-subtle" aria-hidden="true" />
                      Include a discount code
                    </p>
                    <p className="mt-0.5 text-xs text-subtle">One code for everyone who gets it. It is added to Pricing → Promo codes and works at checkout from the day it goes.</p>
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
                      {(control) => (
                        <NumberInput {...control} min={1} max={100} suffix="%" value={draft.offer.percent} onValueChange={(percent) => set({ offer: { ...draft.offer, percent } })} />
                      )}
                    </Field>
                    <Field label="Works for">
                      {(control) => (
                        <NumberInput {...control} min={1} max={365} suffix="days" value={draft.offer.validDays} onValueChange={(validDays) => set({ offer: { ...draft.offer, validDays } })} />
                      )}
                    </Field>
                  </div>
                ) : null}
              </section>

              {draft.offer.enabled && offerDates ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-muted">
                    {code || 'The code'} takes {draft.offer.percent}% off from <span className="font-medium text-foreground">{formatDateLong(new Date(`${offerDates.startsOn}T00:00:00`))}</span> to the end of{' '}
                    <span className="font-medium text-foreground">{formatDateLong(new Date(`${offerDates.endsOn}T00:00:00`))}</span>.
                  </p>
                  {clash ? (
                    <p className="flex items-start gap-1.5 text-xs text-warning">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      {clash.code} is already in Promo codes{clash.note ? ` (${clash.note.replace(/^From the /, 'from the ')})` : ''}. Sending this changes that code too. Pick another code to keep them apart.
                    </p>
                  ) : null}
                  {!mentionsCode ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                      <p className="text-sm text-muted">{draft.channel === 'sms' ? 'Your text does not mention the code yet.' : 'Your design has no code block or code in it yet.'}</p>
                      {draft.channel === 'sms' ? (
                        <Button size="sm" variant="secondary" onClick={() => set({ body: `${draft.body.trim()} Use {offer_code} for {offer_percent} off.` })}>
                          Add it to the text
                        </Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => setStep('message')}>
                          Back to the message
                        </Button>
                      )}
                    </div>
                  ) : draft.channel === 'email' && !draft.design ? (
                    <p className="text-xs text-subtle">The letter shows the code in a box under your words.</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-subtle">No code: the campaign goes without an offer. You can still link to your booking page.</p>
              )}
            </>
          ) : null}

          {/* ---------- 4. when ---------- */}
          {step === 'when' ? (
            <>
              <RadioGroup
                value={when}
                onValueChange={(value) => {
                  setWhen(value as 'now' | 'later')
                  if (value === 'later' && !draft.sendAt) set({ sendAt: atNine(nowIso, 1).toISOString() })
                }}
                className="grid gap-2 sm:grid-cols-2"
              >
                <RadioGroupCard value="now" label="Send now" description="Goes out in the next few minutes." icon={<Send className="size-4" />} disabled={settings.paused} />
                <RadioGroupCard value="later" label="Schedule" description="Pick a day and time." icon={<CalendarClock className="size-4" />} />
              </RadioGroup>

              {when === 'later' ? (
                <div className="flex flex-col gap-3">
                  <Field label="Send on" description="In your business’s time.">
                    {(control) => (
                      <Input
                        {...control}
                        type="datetime-local"
                        className="sm:w-64"
                        min={toLocalInput(nowIso)}
                        value={draft.sendAt ? toLocalInput(draft.sendAt) : ''}
                        onChange={(e) => set({ sendAt: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                      />
                    )}
                  </Field>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-subtle">Quick picks:</span>
                    {[
                      { label: 'Tomorrow, 9:00 AM', at: atNine(nowIso, 1) },
                      { label: 'Next Saturday, 9:00 AM', at: atNine(nowIso, ((6 - now.getDay() + 7) % 7) || 7) },
                      { label: 'Next Tuesday, 10:00 AM', at: (() => { const at = atNine(nowIso, ((2 - now.getDay() + 7) % 7) || 7); at.setHours(10); return at })() },
                    ].map((pick) => {
                      const picked = draft.sendAt ? new Date(draft.sendAt).getTime() === pick.at.getTime() : false
                      return (
                        <button
                          key={pick.label}
                          type="button"
                          aria-pressed={picked}
                          onClick={() => set({ sendAt: pick.at.toISOString() })}
                          className={cn(
                            'rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                            picked ? 'border-primary bg-primary-soft text-primary' : 'border-line text-muted hover:border-line-strong hover:text-foreground',
                          )}
                        >
                          {pick.label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-xs text-subtle">Mornings from 9 to 11 tend to get the most opens. Weekends work well for trips and days out.</p>
                </div>
              ) : null}

              {held ? (
                <p className="flex items-start gap-2 rounded-xl bg-surface-sunken/60 px-4 py-3 text-sm text-muted">
                  <Clock className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
                  {when === 'now' ? 'It is quiet hours right now' : 'That time is in your quiet hours'} ({formatTime(atTime(nowIso, settings.quietHours.from))}–{formatTime(atTime(nowIso, settings.quietHours.to))}), so it goes at{' '}
                  {formatDateTime(held)} instead.
                </p>
              ) : null}
              {settings.paused ? (
                <p className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning-soft/40 px-4 py-3 text-sm text-foreground">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                  <span>
                    Marketing is paused, so it can only be scheduled. It waits until you{' '}
                    <Link href="/dashboard/marketing/settings" className="font-medium text-primary hover:underline">
                      resume marketing
                    </Link>
                    .
                  </span>
                </p>
              ) : null}
            </>
          ) : null}

          {/* ---------- 5. review ---------- */}
          {step === 'review' ? (
            <Review
              draft={draft}
              audienceName={audience?.name}
              breakdown={breakdown}
              settings={settings}
              sender={sender}
              goesAt={when === 'now' && !held ? null : goesAt}
              subject={render(draft.subject)}
              smsText={smsSent.replace('https://ezra.link/b/abc123', host)}
              plainText={plainText}
              offerDates={offerDates}
              problems={problems}
              onFix={(id) => {
                setShown((current) => new Set(current).add(id))
                setStep(id)
              }}
              preview={
                draft.channel === 'email' ? (
                  <EmailPreview design={design} ctx={emailCtx} sender={sender.name} subject={render(draft.subject)} preheader={render(draft.preheader)} scale={0.5} />
                ) : (
                  <SmsPreview text={smsSent.replace('https://ezra.link/b/abc123', host)} from={textFrom || business} />
                )
              }
            />
          ) : null}
        </SheetBody>

        <SheetFooter className="flex-wrap">
          <Button variant="ghost" onClick={() => onSave(draft, 'draft')} disabled={draft.name.trim().length < 2}>
            {isScheduled ? 'Move to drafts' : 'Save draft'}
          </Button>
          <Button variant="ghost" leftIcon={<Send />} onClick={sendTest}>
            Send me a test
          </Button>
          <div className="flex-1" />
          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={() => setStep(STEPS[stepIndex - 1].id)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={requestClose}>
              Cancel
            </Button>
          )}
          {step !== 'review' ? (
            <Button onClick={goNext}>Next: {STEPS[stepIndex + 1].label}</Button>
          ) : (
            <Button leftIcon={when === 'now' && !held ? <Send /> : <CalendarClock />} disabled={problems.length > 0} onClick={confirmSend}>
              {primaryLabel}
            </Button>
          )}
        </SheetFooter>

        <Dialog open={discarding} onOpenChange={setDiscarding}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Leave without saving?</DialogTitle>
              <DialogDescription>Your changes to {draft.name.trim() || 'this campaign'} are lost unless you save them as a draft.</DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-wrap">
              <Button variant="ghost" onClick={() => setDiscarding(false)}>
                Keep editing
              </Button>
              <Button variant="danger" onClick={onClose}>
                Discard changes
              </Button>
              <Button
                disabled={draft.name.trim().length < 2}
                onClick={() => {
                  setDiscarding(false)
                  onSave(draft, 'draft')
                }}
              >
                {isScheduled ? 'Move to drafts' : 'Save draft'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>
                Send to {recipients.toLocaleString('en-US')} {recipients === 1 ? 'guest' : 'guests'} now?
              </DialogTitle>
              <DialogDescription>
                {draft.channel === 'email' ? `The email “${render(draft.subject)}”` : 'The text'} goes to {audience?.name ?? 'this audience'} in the next few minutes. Once it goes, it cannot be taken back.
              </DialogDescription>
            </DialogHeader>
            {draft.offer.enabled && offerDates ? (
              <DialogBody>
                <p className="pb-2 text-sm text-muted">
                  {code} goes live at checkout for {draft.offer.percent}% off until the end of {formatDateLong(new Date(`${offerDates.endsOn}T00:00:00`))}.
                </p>
              </DialogBody>
            ) : null}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Not yet
              </Button>
              <Button
                leftIcon={<Send />}
                onClick={() => {
                  setConfirming(false)
                  onSave(draft, 'send')
                }}
              >
                Send now
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  )
}

/** "21:00" on the demo day, for formatting quiet hours like the rest of the times. */
function atTime(nowIso: string, hhmm: string) {
  const at = new Date(nowIso)
  const [h, m] = hhmm.split(':').map(Number)
  at.setHours(h || 0, m || 0, 0, 0)
  return at
}

function ProblemList({ problems, onFix }: { problems: Problem[]; onFix?: (step: StepId) => void }) {
  return (
    <ul className="flex list-none flex-col gap-1.5 rounded-xl border border-danger/30 bg-danger-soft/40 p-3.5">
      {problems.map((problem) => (
        <li key={problem.text} className="flex items-start justify-between gap-3 text-sm text-foreground">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
            {problem.text}
          </span>
          {onFix ? (
            <button type="button" onClick={() => onFix(problem.step)} className="shrink-0 text-xs font-medium text-primary hover:underline">
              Fix in {STEPS.find((entry) => entry.id === problem.step)?.label}
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/* ---------- personal details by label ---------- */

/**
 * A text box that shows personal details as labels — "Hi [First name]" — and
 * keeps the tokens behind the scenes, with a menu to add one where the cursor is.
 */
function DetailText({
  control,
  value,
  onChange,
  multiline = false,
  rows = 4,
}: {
  control: FieldControlProps
  value: string
  onChange: (value: string) => void
  multiline?: boolean
  rows?: number
}) {
  const ref = React.useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const display = campaignTextForDisplay(value)
  const insert = (label: string) => {
    const el = ref.current
    const text = `[${label}]`
    const from = el?.selectionStart ?? display.length
    const to = el?.selectionEnd ?? from
    onChange(campaignTextFromDisplay(display.slice(0, from) + text + display.slice(to)))
    // After the menu has handed focus back, put the cursor just after the new detail.
    window.setTimeout(() => {
      el?.focus()
      el?.setSelectionRange(from + text.length, from + text.length)
    }, 20)
  }
  const change = (next: string) => onChange(campaignTextFromDisplay(next))
  return (
    <div className="flex flex-col gap-1.5">
      {multiline ? (
        <Textarea {...control} ref={ref} rows={rows} value={display} onChange={(e) => change(e.target.value)} />
      ) : (
        <Input {...control} ref={ref} value={display} onChange={(e) => change(e.target.value)} />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline">
            <Plus className="size-3.5" aria-hidden="true" />
            Add personal detail
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-56">
          {CAMPAIGN_DETAILS.map((detail) => (
            <DropdownMenuItem key={detail.token} onSelect={() => insert(detail.label)}>
              <span className="flex flex-col">
                <span>{detail.label}</span>
                <span className="text-xs text-subtle">
                  e.g. {detail.sample}
                  {detail.needsOffer ? ' · needs a code in Offer' : ''}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/* ---------- previews ---------- */

function EmailPreview({ design, ctx, sender, subject, preheader, scale }: { design: EmailDesign; ctx: EmailContext; sender: string; subject: string; preheader: string; scale: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line" style={{ background: design.theme.background }}>
      <div className="border-b border-line-subtle bg-surface px-3.5 py-2.5 text-xs">
        <p className="truncate font-semibold text-foreground">{sender}</p>
        <p className="truncate text-foreground">{subject || 'No subject yet'}</p>
        {preheader ? <p className="truncate text-subtle">{preheader}</p> : null}
      </div>
      <EmailFrame design={design} ctx={ctx} preheader={preheader} width={600} scale={scale} className="mx-auto" />
    </div>
  )
}

function SmsPreview({ text, from }: { text: string; from: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
      <p className="text-center text-xs text-subtle">{from}</p>
      <p className="max-w-[17rem] rounded-2xl rounded-bl-md bg-surface-sunken px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line text-foreground">{text}</p>
    </div>
  )
}

/* ---------- the last step ---------- */

function Review({
  draft,
  audienceName,
  breakdown,
  settings,
  sender,
  goesAt,
  subject,
  smsText,
  plainText,
  offerDates,
  problems,
  onFix,
  preview,
}: {
  draft: Campaign
  audienceName?: string
  breakdown: SendBreakdown
  settings: MarketingSettings
  sender: { name: string; replyTo: string; address: string }
  /** Null: right now. */
  goesAt: Date | null
  subject: string
  smsText: string
  plainText: string
  offerDates: { startsOn: string; endsOn: string } | null
  problems: Problem[]
  onFix: (step: StepId) => void
  preview: React.ReactNode
}) {
  const n = breakdown.recipients
  const what = draft.channel === 'email' ? `the email “${subject || 'No subject'}”` : 'a text'
  const whenWords = goesAt ? `on ${formatDateTime(goesAt)}` : 'now'
  const rows: { label: string; value: number; note: string; on: boolean }[] = [
    { label: `Haven’t said yes to ${draft.channel === 'sms' ? 'texts' : 'emails'}`, value: breakdown.noConsent, note: 'Only guests who agreed to marketing on this channel get it.', on: true },
    {
      label: `Have a trip in the next ${settings.skipUpcoming.days} ${settings.skipUpcoming.days === 1 ? 'day' : 'days'}`,
      value: breakdown.tripSoon,
      note: 'They get their booking reminders instead.',
      on: settings.skipUpcoming.enabled,
    },
    {
      label: `Already had ${settings.frequencyCap.perWeek} marketing ${settings.frequencyCap.perWeek === 1 ? 'message' : 'messages'} this week`,
      value: breakdown.weeklyLimit,
      note: 'Your weekly limit, counted from the campaigns sent in the 7 days before it goes.',
      on: settings.frequencyCap.enabled,
    },
  ]
  return (
    <div className="flex flex-col gap-6">
      {problems.length > 0 ? <ProblemList problems={problems} onFix={onFix} /> : null}

      <section className="rounded-xl border border-line bg-surface px-4 py-4">
        <p className="text-base leading-relaxed text-foreground">
          You are sending {what} to <span className="font-semibold">{n.toLocaleString('en-US')} {n === 1 ? 'guest' : 'guests'}</span> in {audienceName ?? 'a deleted audience'}, {whenWords}.
          {draft.offer.enabled && offerDates ? ` It carries ${cleanCode(draft.offer.code)} for ${draft.offer.percent}% off, good until the end of ${formatDateLong(new Date(`${offerDates.endsOn}T00:00:00`))}.` : ''}
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Who gets it</h3>
            <dl className="flex flex-col divide-y divide-line-subtle rounded-xl border border-line">
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <dt className="text-muted">In {audienceName ?? 'the audience'}</dt>
                <dd className="font-medium tabular text-foreground">{breakdown.inAudience.toLocaleString('en-US')}</dd>
              </div>
              {rows
                .filter((row) => row.on)
                .map((row) => (
                  <div key={row.label} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                    <dt>
                      <span className="block text-muted">{row.label}</span>
                      <span className="block text-xs text-subtle">{row.note}</span>
                    </dt>
                    <dd className={cn('shrink-0 tabular', row.value > 0 ? 'font-medium text-foreground' : 'text-subtle')}>{row.value > 0 ? `− ${row.value.toLocaleString('en-US')}` : '0'}</dd>
                  </div>
                ))}
              <div className="flex items-center justify-between gap-3 bg-surface-sunken/60 px-4 py-3 text-sm">
                <dt className="font-semibold text-foreground">Gets it</dt>
                <dd className="font-semibold tabular text-foreground">{n.toLocaleString('en-US')}</dd>
              </div>
            </dl>
            {breakdown.members.length > 0 ? (
              <p className="text-xs text-subtle">
                Including {breakdown.members.slice(0, 3).map((contact) => `${contact.firstName} ${contact.lastName}`.trim()).join(', ')}
                {breakdown.members.length > 3 ? ` and ${(breakdown.members.length - 3).toLocaleString('en-US')} more` : ''}.
              </p>
            ) : null}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">The details</h3>
            <dl className="flex flex-col gap-2.5 text-sm">
              <ReviewLine label="From" value={draft.channel === 'email' ? `${sender.name} <${sender.address}>` : sender.name} />
              {draft.channel === 'email' ? <ReviewLine label="Replies go to" value={sender.replyTo} /> : null}
              {draft.channel === 'email' ? <ReviewLine label="Subject" value={subject || '—'} /> : null}
              {draft.channel === 'email' && draft.abTest.enabled ? <ReviewLine label="Second subject" value={campaignTextForDisplay(draft.abTest.subjectB)} /> : null}
              {draft.channel === 'email' ? (
                <ReviewLine label="Content" value={draft.design ? `Designed email, ${draft.design.blocks.length} blocks` : 'Simple letter'} />
              ) : (
                <ReviewLine label="Text" value={`${smsLength(smsText).segments} ${smsLength(smsText).segments === 1 ? 'part' : 'parts'} per guest`} />
              )}
              <ReviewLine label="Code" value={draft.offer.enabled ? `${cleanCode(draft.offer.code)} · ${draft.offer.percent}% off · ${draft.offer.validDays} days` : 'None'} />
              <ReviewLine label="When" value={goesAt ? formatDateTime(goesAt) : 'Now'} />
              <ReviewLine label="Unsubscribe" value={draft.channel === 'email' ? 'A link is added at the bottom for you' : '“Reply STOP to opt out.” is added for you'} />
            </dl>
            {draft.channel === 'email' && plainText.trim() ? (
              <details className="rounded-xl border border-line px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium text-foreground">Plain-text version</summary>
                <p className="mt-2 whitespace-pre-line text-muted">{plainText}</p>
              </details>
            ) : null}
          </section>
        </div>
        <aside className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">What Maya sees</p>
          {preview}
        </aside>
      </div>
    </div>
  )
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
      <dt className="w-32 shrink-0 text-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{value}</dd>
    </div>
  )
}

/* ==========================================================================
   Report
   ========================================================================== */

function CampaignReport({
  campaign,
  stats,
  currency,
  audienceName,
  promo,
}: {
  campaign: Campaign
  stats: CampaignStats
  currency: Tenant['currency']
  audienceName?: string
  promo?: PromoCode
}) {
  const funnel = [
    { label: 'Delivered', value: stats.delivered },
    ...(campaign.channel === 'email' ? [{ label: 'Opened (est.)', value: stats.opened }] : []),
    { label: 'Clicked (est.)', value: stats.clicked },
    { label: 'Booked (est.)', value: stats.bookings },
  ]
  const test = campaign.channel === 'email' && campaign.abTest.enabled ? abTestEstimate(campaign.id, stats) : null
  return (
    <>
      <SheetHeader>
        <SheetTitle>{campaign.name}</SheetTitle>
        <SheetDescription>
          {campaign.sentAt ? `Sent ${formatDateTime(campaign.sentAt)} to ${stats.recipients.toLocaleString('en-US')} guests${audienceName ? ` in ${audienceName}` : ''}` : null}
        </SheetDescription>
      </SheetHeader>
      <SheetBody className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-line px-4 py-3">
            <p className="text-xs text-subtle">Revenue (est.)</p>
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
        {promo ? (
          <div className="flex items-start gap-3 rounded-xl border border-line px-4 py-3 text-sm">
            <Tag className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
            <p className="text-muted">
              <span className="font-mono font-medium text-foreground">{promo.code}</span> has been used {promo.used.toLocaleString('en-US')} {promo.used === 1 ? 'time' : 'times'} at checkout
              {promo.endsOn ? `, and works until the end of ${formatDateLong(new Date(`${promo.endsOn}T00:00:00`))}` : ''}.
            </p>
          </div>
        ) : null}
        {test ? (
          <div className="rounded-xl border border-line px-4 py-3 text-sm">
            <p className="font-medium">Subject lines (est.)</p>
            <dl className="mt-2 flex flex-col gap-1.5">
              {(
                [
                  ['A', campaignTextForDisplay(campaign.subject), test.a, test.winner === 'a'],
                  ['B', campaignTextForDisplay(campaign.abTest.subjectB), test.b, test.winner === 'b'],
                ] as const
              ).map(([key, subject, rate, won]) => (
                <div key={key} className="flex items-start justify-between gap-3">
                  <dt className="min-w-0 text-muted">
                    {key}: {subject}
                  </dt>
                  <dd className={cn('flex shrink-0 items-center gap-1 tabular', won ? 'font-semibold text-success' : 'text-foreground')}>
                    {won ? <Check className="size-3.5" aria-hidden="true" /> : null}
                    {percent(rate, 1)} opened
                  </dd>
                </div>
              ))}
            </dl>
            {test.winner === 'tie' ? <p className="mt-2 text-xs text-subtle">Too close to call: both did about the same.</p> : null}
          </div>
        ) : null}
      </SheetBody>
      <SheetFooter>
        <p className="text-xs text-subtle">Opens, clicks and bookings are estimates from your guest list until sending is connected. Bookings count within 7 days of a click.</p>
      </SheetFooter>
    </>
  )
}
