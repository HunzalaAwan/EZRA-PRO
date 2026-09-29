'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Lightbulb, Mail, Megaphone, MousePointerClick, Pause, Zap } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { useMessageTemplates } from '@/hooks/use-message-templates'
import type { MarketingData } from '@/lib/data/guest-marketing'
import { audienceSize, automationStats, campaignStatsFor, percent } from '@/lib/marketing'
import { groupOf } from '@/lib/messaging'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   MARKETING OVERVIEW
   What marketing earned in the last 30 days, every tool with its switch in
   one place, and a short list of what to try next, worked out from what is
   on and who is on the list.
   ========================================================================== */

export function MarketingOverviewClient({ tenant: tenantRecord, nowIso, data }: { tenant: Tenant; nowIso: string; data: MarketingData }) {
  const tenant = useMarketingTenant(tenantRecord)
  const currency = tenantRecord.currency
  const marketing = useMarketing(tenant, nowIso)
  const { templates, update } = useMessageTemplates(tenantRecord.id)
  const subscribed = data.contacts.filter((contact) => contact.emailOptIn || contact.smsOptIn)
  const paused = marketing.settings.paused

  const growth = templates.filter((template) => groupOf(template) === 'growth')
  const automationRows = growth
    .map((template) => ({ template, stats: automationStats(template.key, template.enabled && !paused, subscribed.length, data.avgOrder, true) }))
    .sort((a, b) => b.stats.revenue - a.stats.revenue)
  const monthAgo = new Date(nowIso).getTime() - 30 * 86_400_000
  const recentCampaigns = marketing.campaigns
    .filter((campaign) => campaign.status === 'sent' && campaign.sentAt && new Date(campaign.sentAt).getTime() >= monthAgo)
    .map((campaign) => {
      const audience = marketing.audiences.find((entry) => entry.id === campaign.audienceId) ?? marketing.audiences[0]
      const size = audienceSize(data.contacts, audience.filter, nowIso)
      return { campaign, stats: campaign.stats ?? campaignStatsFor(campaign.id, campaign.channel === 'sms' ? size.sms : size.email, data.avgOrder, campaign.channel) }
    })
  const revenue = automationRows.reduce((sum, row) => sum + row.stats.revenue, 0) + recentCampaigns.reduce((sum, row) => sum + row.stats.revenue, 0)
  const bookings = automationRows.reduce((sum, row) => sum + row.stats.bookings, 0) + recentCampaigns.reduce((sum, row) => sum + row.stats.bookings, 0)
  const emailSent = automationRows.reduce((sum, row) => sum + row.stats.sent, 0) + recentCampaigns.filter((row) => row.campaign.channel === 'email').reduce((sum, row) => sum + row.stats.delivered, 0)
  const emailOpened =
    automationRows.reduce((sum, row) => sum + row.stats.sent * row.stats.openRate, 0) + recentCampaigns.filter((row) => row.campaign.channel === 'email').reduce((sum, row) => sum + row.stats.opened, 0)
  const topRevenue = Math.max(1, ...automationRows.map((row) => row.stats.revenue))

  const lapsed = audienceSize(data.contacts, marketing.audiences.find((entry) => entry.id === 'aud_lapsed')!.filter, nowIso).count
  const firstTimers = audienceSize(data.contacts, marketing.audiences.find((entry) => entry.id === 'aud_new')!.filter, nowIso).count
  const on = (key: string) => templates.find((template) => template.key === key)?.enabled ?? false

  const tools = [
    { label: 'Growth automations', text: `${growth.filter((t) => t.enabled).length} of ${growth.length} on`, href: '/dashboard/marketing/automations', icon: Zap, checked: growth.some((t) => t.enabled), toggle: null },
    { label: 'Storefront pop-up', text: marketing.forms.popup.offer.enabled ? `${marketing.forms.popup.offer.percent}% first-trip code` : 'List only, no code', href: '/dashboard/marketing/forms', icon: MousePointerClick, checked: marketing.forms.popup.enabled, toggle: (value: boolean) => marketing.setForms({ ...marketing.forms, popup: { ...marketing.forms.popup, enabled: value } }) },
    { label: 'Checkout opt-in', text: marketing.forms.checkout.sms ? 'Email and texts' : 'Email', href: '/dashboard/marketing/forms', icon: Mail, checked: marketing.forms.checkout.enabled, toggle: (value: boolean) => marketing.setForms({ ...marketing.forms, checkout: { ...marketing.forms.checkout, enabled: value } }) },
  ]

  const ideas = [
    !on('win_back') && lapsed > 0 ? { text: `${lapsed} guests have not been back in four months. Turn on “We miss you”.`, action: 'Turn on', run: () => update('win_back', { enabled: true }) } : null,
    !on('next_trip') && firstTimers > 0 ? { text: `${firstTimers} first-timers could get a next-trip code two weeks after their trip.`, action: 'Turn on', run: () => update('next_trip', { enabled: true }) } : null,
    !marketing.forms.popup.enabled ? { text: 'The storefront pop-up is off. It is usually the fastest way to grow the list.', action: 'Turn on', run: () => marketing.setForms({ ...marketing.forms, popup: { ...marketing.forms.popup, enabled: true } }) } : null,
    !on('browse_abandon') ? { text: 'Guests who look at a trip and leave get nothing. “Viewed but did not book” can nudge them.', action: 'Turn on', run: () => update('browse_abandon', { enabled: true }) } : null,
    !on('birthday') ? { text: 'Birthday treats are off. They are among the best-opened emails there are.', action: 'Turn on', run: () => update('birthday', { enabled: true }) } : null,
    recentCampaigns.length === 0 ? { text: 'No campaign in the last 30 days. A short newsletter keeps you in mind.', action: 'Write one', href: '/dashboard/marketing/campaigns' } : null,
  ].filter(Boolean).slice(0, 4) as { text: string; action: string; run?: () => void; href?: string }[]

  return (
    <div className="flex flex-col gap-6">
      {paused ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-soft/40 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Pause className="size-4 text-warning" aria-hidden="true" />
            All marketing is paused. Booking messages still go.
          </p>
          <Button size="sm" variant="secondary" onClick={() => { marketing.setSettings({ ...marketing.settings, paused: false }); toast.success('Marketing is back on') }}>
            Resume
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Revenue from marketing', value: formatCurrency(revenue * 100, currency), hint: 'Last 30 days' },
          { label: 'Bookings from marketing', value: String(bookings), hint: 'Automations and campaigns' },
          { label: 'Email open rate', value: emailSent > 0 ? percent(emailOpened / emailSent) : '—', hint: `${Math.round(emailSent).toLocaleString('en-US')} emails sent` },
          { label: 'Subscribers', value: (subscribed.length + marketing.signups.length).toLocaleString('en-US'), hint: `${data.contacts.filter((c) => c.smsOptIn).length.toLocaleString('en-US')} with texts on${marketing.signups.length > 0 ? ` · +${marketing.signups.length} from forms` : ''}` },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface px-4 py-3.5">
            <p className="text-xs font-medium text-subtle">{tile.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular text-foreground">{tile.value}</p>
            <p className="mt-0.5 text-xs text-subtle">{tile.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>What is earning</CardTitle>
              <CardDescription>Growth automations, last 30 days.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/marketing/automations">All automations</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="flex list-none flex-col divide-y divide-line-subtle border-t border-line-subtle p-0">
              {automationRows.slice(0, 6).map(({ template, stats }) => (
                <li key={template.key} className={cn('flex items-center gap-4 px-5 py-3', !template.enabled && 'opacity-60')}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{template.name}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-surface-sunken">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(stats.revenue / topRevenue) * 100}%` }} />
                    </div>
                  </div>
                  <div className="w-28 text-right">
                    <p className="text-sm font-semibold tabular text-foreground">{template.enabled ? formatCurrency(stats.revenue * 100, currency) : 'Off'}</p>
                    <p className="text-xs text-subtle">{template.enabled ? `${stats.bookings} bookings` : '—'}</p>
                  </div>
                  <Switch checked={template.enabled} onCheckedChange={(enabled) => { update(template.key, { enabled }); toast(enabled ? `${template.name} on` : `${template.name} off`) }} aria-label={`${template.name} on`} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="flex flex-col items-start gap-1">
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="size-4 text-warning" aria-hidden="true" />
                Try next
              </CardTitle>
              <CardDescription>Worked out from your list and what is switched on.</CardDescription>
            </CardHeader>
            <CardContent>
              {ideas.length === 0 ? (
                <p className="text-sm text-subtle">Everything worth switching on is on. Nice.</p>
              ) : (
                <ul className="flex list-none flex-col gap-3 p-0">
                  {ideas.map((idea) => (
                    <li key={idea.text} className="flex items-start justify-between gap-3">
                      <p className="text-sm text-muted">{idea.text}</p>
                      {idea.href ? (
                        <Button asChild size="sm" variant="secondary"><Link href={idea.href}>{idea.action}</Link></Button>
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => { idea.run?.(); toast.success('Switched on') }}>{idea.action}</Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle>Recent campaigns</CardTitle>
                <CardDescription>Sent in the last 30 days.</CardDescription>
              </div>
              <Button asChild size="sm" leftIcon={<Megaphone />}>
                <Link href="/dashboard/marketing/campaigns">New campaign</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {recentCampaigns.length === 0 ? (
                <p className="border-t border-line-subtle px-5 py-4 text-sm text-subtle">Nothing sent lately.</p>
              ) : (
                <ul className="flex list-none flex-col divide-y divide-line-subtle border-t border-line-subtle p-0">
                  {recentCampaigns.slice(0, 4).map(({ campaign, stats }) => (
                    <li key={campaign.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{campaign.name}</p>
                        <p className="text-xs text-subtle">{campaign.sentAt ? formatDateTime(campaign.sentAt) : ''} · {campaign.channel === 'sms' ? 'Text' : `${percent(stats.opened / Math.max(1, stats.delivered))} opened`}</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold tabular">{formatCurrency(stats.revenue * 100, currency)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle>Your tools</CardTitle>
          <CardDescription>Each one on or off here. Open it to change the wording, the numbers and who it goes to.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="grid list-none gap-px border-t border-line-subtle bg-line-subtle p-0 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <li key={tool.label} className="flex items-center gap-3 bg-surface px-5 py-4">
                <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle">
                  <tool.icon className="size-4" />
                </span>
                <Link href={tool.href} className="min-w-0 flex-1 hover:underline">
                  <span className="block text-sm font-medium text-foreground">{tool.label}</span>
                  <span className="block truncate text-xs text-subtle">{tool.text}</span>
                </Link>
                {tool.toggle ? (
                  <Switch checked={tool.checked} onCheckedChange={(value) => { tool.toggle?.(value); toast(value ? `${tool.label} on` : `${tool.label} off`) }} aria-label={tool.label} />
                ) : (
                  <Badge variant={tool.checked ? 'success' : 'neutral'} size="sm">{tool.checked ? 'On' : 'Off'}</Badge>
                )}
              </li>
            ))}
            <li className="flex items-center gap-3 bg-surface px-5 py-4">
              <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle">
                <Pause className="size-4" />
              </span>
              <Link href="/dashboard/marketing/settings" className="min-w-0 flex-1 hover:underline">
                <span className="block text-sm font-medium text-foreground">Pause all marketing</span>
                <span className="block truncate text-xs text-subtle">Booking messages keep going</span>
              </Link>
              <Switch checked={paused} onCheckedChange={(value) => { marketing.setSettings({ ...marketing.settings, paused: value }); toast(value ? 'Marketing paused' : 'Marketing resumed') }} aria-label="Pause all marketing" />
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
