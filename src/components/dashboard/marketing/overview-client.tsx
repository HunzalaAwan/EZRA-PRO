'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Lightbulb, Mail, Megaphone, MousePointerClick, Pause, Zap } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { useFlows } from '@/hooks/use-flows'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { usePricing } from '@/hooks/use-pricing'
import { runFlows } from '@/lib/actions/flows'
import type { MarketingData } from '@/lib/data/guest-marketing'
import type { FlowExtras } from '@/lib/flows/engine'
import { syncFlowPromos } from '@/lib/flows/promos'
import { forSimulation, messageSteps, simulationKey } from '@/lib/flows/tree'
import type { Flow, FlowRun } from '@/lib/flows/types'
import { audienceSize, campaignStatsFor, percent } from '@/lib/marketing'
import { cn, formatCurrency, formatDateTime } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   MARKETING OVERVIEW
   What marketing earned in the last 30 days, every tool with its switch in
   one place, and a short list of what to try next, worked out from what is
   on and who is on the list.
   ========================================================================== */

type RunMap = Record<string, Omit<FlowRun, 'journeys'>>

export function MarketingOverviewClient({ tenant: tenantRecord, nowIso, data }: { tenant: Tenant; nowIso: string; data: MarketingData }) {
  const tenant = useMarketingTenant(tenantRecord)
  const currency = tenantRecord.currency
  const marketing = useMarketing(tenant, nowIso)
  const store = useFlows(tenantRecord, nowIso, data.activities)
  const pricing = usePricing(tenantRecord.slug)
  const subscribed = data.contacts.filter((contact) => contact.emailOptIn || contact.smsOptIn)
  const paused = marketing.settings.paused

  /* ---------- automation numbers ---------- */

  const growth = React.useMemo(() => store.flows.filter((flow) => flow.purpose === 'marketing'), [store.flows])
  const extras = React.useMemo<FlowExtras>(
    () => ({
      signups: marketing.signups.map((signup) => ({ email: signup.email, phone: signup.phone, source: signup.source, at: signup.at })),
      settings: { paused: marketing.settings.paused, quietHours: marketing.settings.quietHours, frequencyCap: marketing.settings.frequencyCap, skipUpcoming: marketing.settings.skipUpcoming },
      audiences: marketing.audiences,
      nowIso,
    }),
    [marketing.signups, marketing.settings, marketing.audiences, nowIso],
  )
  const runKey = React.useMemo(() => JSON.stringify([simulationKey(growth), extras]), [growth, extras])
  const latest = React.useRef({ growth, extras })
  latest.current = { growth, extras }
  const [runs, setRuns] = React.useState<RunMap>({})
  React.useEffect(() => {
    let alive = true
    const timer = window.setTimeout(() => {
      runFlows(tenantRecord.id, latest.current.growth.map(forSimulation), latest.current.extras)
        .then((result) => alive && setRuns(result))
        .catch(() => undefined)
    }, 300)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [tenantRecord.id, runKey])

  const statsOf = (flow: Flow) => {
    const run = runs[flow.id]
    let sent = 0
    let opened = 0
    for (const step of messageSteps(flow.steps)) {
      if (step.type !== 'email' || !run?.perStep[step.id]) continue
      sent += run.perStep[step.id].sent
      opened += run.perStep[step.id].opened
    }
    // The replay covers 60 days: halve it for a 30-day view.
    return { revenue: Math.round((run?.revenue ?? 0) / 2), bookings: Math.round((run?.bookings ?? 0) / 2), sent: Math.round(sent / 2), opened: Math.round(opened / 2) }
  }

  const automationRows = growth
    .map((flow) => ({ flow, enabled: flow.status === 'live', stats: statsOf(flow) }))
    .map((row) => (row.enabled && !paused ? row : { ...row, stats: { revenue: 0, bookings: 0, sent: 0, opened: 0 } }))
    .sort((a, b) => b.stats.revenue - a.stats.revenue)
  const monthAgo = new Date(nowIso).getTime() - 30 * 86_400_000
  const recentCampaigns = marketing.campaigns
    .filter((campaign) => campaign.status === 'sent' && campaign.sentAt && new Date(campaign.sentAt).getTime() >= monthAgo)
    .map((campaign) => {
      const audience = marketing.audiences.find((entry) => entry.id === campaign.audienceId) ?? marketing.audiences[0]
      const size = audienceSize(data.contacts, audience.filter, nowIso)
      return { campaign, stats: campaign.stats ?? campaignStatsFor(campaign.id, campaign.channel === 'sms' ? size.sms : size.email, data.avgOrder, campaign.channel) }
    })
  // Campaign figures are in whole units; automation figures in cents.
  const revenue = automationRows.reduce((sum, row) => sum + row.stats.revenue, 0) + recentCampaigns.reduce((sum, row) => sum + row.stats.revenue * 100, 0)
  const bookings = automationRows.reduce((sum, row) => sum + row.stats.bookings, 0) + recentCampaigns.reduce((sum, row) => sum + row.stats.bookings, 0)
  const emailSent = automationRows.reduce((sum, row) => sum + row.stats.sent, 0) + recentCampaigns.filter((row) => row.campaign.channel === 'email').reduce((sum, row) => sum + row.stats.delivered, 0)
  const emailOpened = automationRows.reduce((sum, row) => sum + row.stats.opened, 0) + recentCampaigns.filter((row) => row.campaign.channel === 'email').reduce((sum, row) => sum + row.stats.opened, 0)
  const topRevenue = Math.max(1, ...automationRows.map((row) => row.stats.revenue))

  const lapsed = audienceSize(data.contacts, marketing.audiences.find((entry) => entry.id === 'aud_lapsed')!.filter, nowIso).count
  const firstTimers = audienceSize(data.contacts, marketing.audiences.find((entry) => entry.id === 'aud_new')!.filter, nowIso).count
  const on = (id: string) => store.byId(id)?.status === 'live'
  const added = (recipe: string) => store.flows.some((flow) => flow.recipeId === recipe)

  /** On or off from here, with its codes kept in Promo codes. */
  const setOn = (flow: Flow, value: boolean) => {
    if (!store.setStatus(flow.id, value ? 'live' : 'paused')) return
    const list = store.flows.map((entry) => (entry.id === flow.id ? { ...entry, status: value ? ('live' as const) : ('paused' as const) } : entry))
    const next = syncFlowPromos(pricing.promos, list, { reactivate: value })
    if (next !== pricing.promos) pricing.setPromos(next)
  }

  const tools = [
    { label: 'Growth automations', text: `${growth.filter((flow) => flow.status === 'live').length} of ${growth.length} on`, href: '/dashboard/marketing/automations', icon: Zap, checked: growth.some((flow) => flow.status === 'live'), toggle: null },
    { label: 'Storefront pop-up', text: marketing.forms.popup.offer.enabled ? `${marketing.forms.popup.offer.percent}% first-booking code` : 'List only, no code', href: '/dashboard/marketing/forms', icon: MousePointerClick, checked: marketing.forms.popup.enabled, toggle: null },
    { label: 'Checkout opt-in', text: marketing.forms.checkout.sms ? 'Email and texts' : 'Email', href: '/dashboard/marketing/forms', icon: Mail, checked: marketing.forms.checkout.enabled, toggle: (value: boolean) => marketing.setForms({ ...marketing.forms, checkout: { ...marketing.forms.checkout, enabled: value } }) },
  ]

  const winBack = store.byId('flow_win_back')
  const nextTrip = store.byId('flow_next_trip')
  const ideas = [
    winBack && !on(winBack.id) && lapsed > 0 ? { text: `${lapsed} guests have not been back in four months. Turn on “${winBack.name}”.`, action: 'Turn on', run: () => setOn(winBack, true) } : null,
    nextTrip && !on(nextTrip.id) && firstTimers > 0 ? { text: `${firstTimers} first-timers could get a next-booking code two weeks after their activity.`, action: 'Turn on', run: () => setOn(nextTrip, true) } : null,
    !marketing.forms.popup.enabled ? { text: 'The storefront pop-up is off. It is usually the fastest way to grow the list.', action: 'Open', href: '/dashboard/marketing/forms' } : null,
    !added('last-minute-seats') ? { text: 'Quiet time slots get nothing. “Last-minute spots” offers the spare spots to past guests.', action: 'Add', href: '/dashboard/marketing/automations?recipe=last-minute-seats' } : null,
    !added('waiver-reminder') ? { text: 'Unsigned waivers slow down check-in. “Waiver reminder” chases them before the day.', action: 'Add', href: '/dashboard/marketing/automations?recipe=waiver-reminder' } : null,
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
          <Button asChild size="sm" variant="secondary">
            <Link href="/dashboard/marketing/settings">Resume</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Revenue from marketing', value: formatCurrency(revenue, currency), hint: 'Last 30 days' },
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
              {automationRows.slice(0, 6).map(({ flow, enabled, stats }) => (
                <li key={flow.id} className={cn('flex items-center gap-4 px-5 py-3', !enabled && 'opacity-60')}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{flow.name}</p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-surface-sunken">
                      <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(stats.revenue / topRevenue) * 100}%` }} />
                    </div>
                  </div>
                  <div className="w-28 text-right">
                    <p className="text-sm font-semibold tabular text-foreground">{enabled ? formatCurrency(stats.revenue, currency) : 'Off'}</p>
                    <p className="text-xs text-subtle">{enabled ? `${stats.bookings} ${stats.bookings === 1 ? 'booking' : 'bookings'}` : '—'}</p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(value) => {
                      setOn(flow, value)
                      toast(value ? `${flow.name} on` : `${flow.name} off`)
                    }}
                    aria-label={`${flow.name} on`}
                  />
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
                        <Button asChild size="sm" variant="secondary">
                          <Link href={idea.href}>{idea.action}</Link>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            idea.run?.()
                            toast.success('Switched on')
                          }}
                        >
                          {idea.action}
                        </Button>
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
                        <p className="text-xs text-subtle">
                          {campaign.sentAt ? formatDateTime(campaign.sentAt) : ''} · {campaign.channel === 'sms' ? 'Text' : `${percent(stats.opened / Math.max(1, stats.delivered))} opened`}
                        </p>
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
                  <Switch
                    checked={tool.checked}
                    onCheckedChange={(value) => {
                      tool.toggle?.(value)
                      toast(value ? `${tool.label} on` : `${tool.label} off`)
                    }}
                    aria-label={tool.label}
                  />
                ) : (
                  <Badge variant={tool.checked ? 'success' : 'neutral'} size="sm">
                    {tool.checked ? 'On' : 'Off'}
                  </Badge>
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
              <Badge variant={paused ? 'warning' : 'neutral'} size="sm">
                {paused ? 'Paused' : 'Running'}
              </Badge>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
