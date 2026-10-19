'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  Armchair,
  ArrowRight,
  CalendarCheck,
  CircleCheck,
  FilePenLine,
  Info,
  LayoutTemplate,
  Mail,
  Megaphone,
  MousePointerClick,
  PanelBottom,
  Pause,
  Repeat,
  Send,
  Star,
  Users,
  UsersRound,
  Wallet,
  Workflow,
  type LucideIcon,
} from 'lucide-react'

import { CHART_INK, ChartContainer, ChartLegend, type ChartLegendItem } from '@/components/charts/chart-container'
import { CHART_CURSOR_BAND, ChartTooltip } from '@/components/charts/chart-tooltip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard, StatGrid } from '@/components/ui/stat'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { useFlows } from '@/hooks/use-flows'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { runFlows, type FlowExtras } from '@/lib/actions/flows'
import type { MarketingData } from '@/lib/data/guest-marketing'
import type { MarketingOpportunities } from '@/lib/data/marketing-opportunities'
import { PURPOSE_LABEL } from '@/lib/flows/catalog'
import { describeTrigger } from '@/lib/flows/describe'
import { creditedTotals, forSimulation, messageSteps, simulationKey, walkSteps } from '@/lib/flows/tree'
import type { Flow, FlowRun } from '@/lib/flows/types'
import { audienceSize, campaignBreakdown, campaignStatsFor, type Campaign, type CampaignStats, type EarlierSend } from '@/lib/marketing'
import { cn, formatCompactCurrency, formatCurrency, formatDateShort, formatNumber, formatTime, fromDateKey, toDateKey } from '@/lib/utils'
import type { CurrencyCode, Tenant } from '@/types'

/* ==========================================================================
   MARKETING OVERVIEW
   What marketing brought in, worked out by replaying each live automation
   over the real bookings (the simulator on the server), what is worth doing
   about the seats, guests and reviews there are right now, the automations
   doing the work, recent campaigns, and every tool with its switch.
   ========================================================================== */

type Run = Omit<FlowRun, 'journeys'>

const DAY = 86_400_000
/** The simulator replays the last 60 days. */
const WINDOW_DAYS = 60
const WEEKS = 8
/** Rows in the Top automations table. */
const TOP_ROWS = 7

const AUTOMATIONS_COLOR = 'var(--chart-1)'
const CAMPAIGNS_COLOR = 'var(--chart-6)'

const AUTOMATIONS_HREF = '/dashboard/marketing/automations'
const recipeHref = (id: string) => `${AUTOMATIONS_HREF}?recipe=${encodeURIComponent(id)}`
const flowHref = (id: string) => `${AUTOMATIONS_HREF}?flow=${encodeURIComponent(id)}`

const dayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
const when = (iso: string) => `${dayLabel.format(new Date(iso))}, ${formatTime(iso)}`

interface Week {
  /** First day of the week, YYYY-MM-DD. */
  key: string
  /** Last day, YYYY-MM-DD. */
  end: string
  automations: number
  campaigns: number
  bookings: number
  messages: number
}

interface CampaignRow {
  campaign: Campaign
  sentAt: string
  stats: CampaignStats
}

export function MarketingOverviewClient({
  tenant: tenantRecord,
  nowIso,
  data,
  opportunities,
}: {
  tenant: Tenant
  nowIso: string
  data: MarketingData
  opportunities: MarketingOpportunities
}) {
  const tenant = useMarketingTenant(tenantRecord)
  const currency = tenantRecord.currency
  const marketing = useMarketing(tenant, nowIso)
  const { flows } = useFlows(tenantRecord, nowIso, data.activities)
  const paused = marketing.settings.paused
  const nowMs = new Date(nowIso).getTime()

  const live = React.useMemo(() => flows.filter((flow) => flow.status === 'live'), [flows])

  /* ---- live numbers from the simulator ---- */
  const [runs, setRuns] = React.useState<Record<string, Run> | null>(null)
  const [failed, setFailed] = React.useState(false)
  const { signups, settings, audiences } = marketing
  // Keyed on what the simulator reads, not on object identity: flipping a form switch rewrites the
  // marketing store (and rebuilds the flow list) without changing a single number.
  const request = React.useMemo(() => {
    const extras: FlowExtras = {
      signups: signups.map((entry) => ({ email: entry.email, phone: entry.phone, source: entry.source, at: entry.at })),
      settings: { paused: settings.paused, quietHours: settings.quietHours, frequencyCap: settings.frequencyCap, skipUpcoming: settings.skipUpcoming },
      // The real home country lives on these: "Locals" depends on it.
      audiences,
      nowIso,
    }
    // Without the email designs: uploaded photos can be megabytes, over the server's upload limit.
    return { flows: live.map(forSimulation), extras, key: JSON.stringify([tenantRecord.id, simulationKey(live), extras]) }
  }, [tenantRecord.id, live, signups, settings, audiences, nowIso])
  React.useEffect(() => {
    let alive = true
    // The effect only runs again when the key changes, so the request it closes over is the current one.
    const { flows: toRun, extras } = request
    const timer = window.setTimeout(() => {
      runFlows(tenantRecord.id, toRun, extras)
        .then((result) => {
          if (!alive) return
          setRuns(result)
          setFailed(false)
        })
        .catch(() => {
          if (!alive) return
          setRuns((current) => current ?? {})
          setFailed(true)
        })
    }, 250)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [tenantRecord.id, request.key]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- campaigns sent in the window (estimates: campaigns are not replayed) ---- */
  // Worked out the way the Campaigns page does it (consent, a trip coming up, the weekly limit), so the two agree.
  const windowStart = nowMs - WINDOW_DAYS * DAY
  const campaignRows = React.useMemo<CampaignRow[]>(() => {
    const membersOf = new Map(marketing.audiences.map((audience) => [audience.id, audienceSize(data.contacts, audience.filter, nowIso).members]))
    const earlier: (EarlierSend & { id: string })[] = []
    for (const campaign of marketing.campaigns) {
      if (campaign.status !== 'sent' || !campaign.sentAt) continue
      const members = membersOf.get(campaign.audienceId) ?? []
      earlier.push({
        id: campaign.id,
        sentAt: campaign.sentAt,
        to: new Set(members.filter((contact) => (campaign.channel === 'sms' ? contact.smsOptIn : contact.emailOptIn)).map((contact) => contact.id)),
      })
    }
    const out: CampaignRow[] = []
    for (const campaign of marketing.campaigns) {
      // useMarketing already reads a scheduled campaign whose time came as sent.
      const sentAt = campaign.status === 'sent' ? campaign.sentAt : undefined
      if (!sentAt) continue
      const sentMs = new Date(sentAt).getTime()
      if (sentMs > nowMs || sentMs < windowStart) continue
      const stats =
        campaign.stats ??
        campaignStatsFor(
          campaign.id,
          campaignBreakdown({
            audienceMembers: membersOf.get(campaign.audienceId) ?? [],
            channel: campaign.channel,
            sendAt: sentAt,
            settings: marketing.settings,
            earlier: earlier.filter((send) => send.id !== campaign.id),
          }).recipients,
          data.avgOrder,
          campaign.channel,
        )
      out.push({ campaign, sentAt, stats })
    }
    return out.sort((a, b) => b.sentAt.localeCompare(a.sentAt))
  }, [marketing.campaigns, marketing.audiences, marketing.settings, data.contacts, data.avgOrder, nowIso, nowMs, windowStart])

  // A campaign that went on schedule keeps the numbers it had when it went: later audience edits don't rewrite them.
  const { recordStats } = marketing
  React.useEffect(() => {
    const missing: Record<string, CampaignStats> = {}
    for (const row of campaignRows) if (!row.campaign.stats) missing[row.campaign.id] = row.stats
    if (Object.keys(missing).length > 0) recordStats(missing)
  }, [campaignRows]) // eslint-disable-line react-hooks/exhaustive-deps

  // Bookings from automations, each counted once: a booking two automations both led to goes to the one whose message went last.
  const credited = React.useMemo(() => creditedTotals(live.filter((flow) => flow.purpose === 'marketing').map((flow) => runs?.[flow.id])), [live, runs])

  /* ---- totals ---- */
  const totals = React.useMemo(() => {
    const { revenue, bookings } = credited
    let messages = 0
    let active = 0
    let emailSent = 0
    let emailOpened = 0
    for (const flow of live) {
      const run = runs?.[flow.id]
      if (!run) continue
      messages += run.messages
      active += run.active
      // Booking messages go to everyone with a trip, who book anyway: only marketing earns bookings (in `credited`).
      for (const step of messageSteps(flow.steps)) {
        if (step.type !== 'email') continue
        emailSent += run.perStep[step.id]?.sent ?? 0
        emailOpened += run.perStep[step.id]?.opened ?? 0
      }
    }
    const campaignRevenue = campaignRows.reduce((sum, row) => sum + row.stats.revenue * 100, 0)
    const campaignBookings = campaignRows.reduce((sum, row) => sum + row.stats.bookings, 0)
    const campaignMessages = campaignRows.reduce((sum, row) => sum + row.stats.delivered, 0)
    return { revenue, bookings, messages, active, emailSent, emailOpened, campaignRevenue, campaignBookings, campaignMessages }
  }, [live, runs, campaignRows, credited])

  /* ---- by week: the last 8 weeks, ending today ---- */
  const weeks = React.useMemo<Week[]>(() => {
    const today = fromDateKey(toDateKey(new Date(nowMs)))
    const list: Week[] = []
    for (let i = WEEKS - 1; i >= 0; i -= 1) {
      const end = new Date(today)
      end.setDate(end.getDate() - i * 7)
      const start = new Date(end)
      start.setDate(start.getDate() - 6)
      list.push({ key: toDateKey(start), end: toDateKey(end), automations: 0, campaigns: 0, bookings: 0, messages: 0 })
    }
    const weekOf = (key: string) => list.find((week) => key >= week.key && key <= week.end)
    const todayKey = toDateKey(today)
    for (const flow of live) {
      const run = runs?.[flow.id]
      if (!run) continue
      let total = 0
      for (const [key, count] of Object.entries(run.daily)) if (key <= todayKey) total += count
      for (const [key, count] of Object.entries(run.daily)) {
        const week = key <= todayKey ? weekOf(key) : undefined
        if (!week) continue
        week.messages += count
        // An older server without credits: spread its bookings over the weeks its messages went.
        if (flow.purpose === 'marketing' && !run.credits && total > 0) {
          week.automations += (run.revenue * count) / total
          week.bookings += (run.bookings * count) / total
        }
      }
    }
    // Each booking once, in the week it was made.
    for (const credit of credited.credits) {
      const week = weekOf(credit.at.slice(0, 10))
      if (!week) continue
      week.automations += credit.value
      week.bookings += 1
    }
    for (const row of campaignRows) {
      const week = weekOf(toDateKey(new Date(row.sentAt)))
      if (!week) continue
      week.campaigns += row.stats.revenue * 100
      week.bookings += row.stats.bookings
      week.messages += row.stats.delivered
    }
    return list.map((week) => ({ ...week, automations: Math.round(week.automations), campaigns: Math.round(week.campaigns) }))
  }, [live, runs, campaignRows, nowMs, credited])

  /* ---- subscribers, each person once ---- */
  const subscribers = React.useMemo(() => {
    const emails = new Set<string>()
    let texts = 0
    for (const contact of data.contacts) {
      if (!contact.emailOptIn && !contact.smsOptIn) continue
      emails.add(contact.email.toLowerCase())
      if (contact.smsOptIn) texts += 1
    }
    const fromContacts = emails.size
    for (const signup of marketing.signups) emails.add(signup.email.toLowerCase())
    return { count: emails.size, texts, fromForms: emails.size - fromContacts }
  }, [data.contacts, marketing.signups])

  const loading = runs === null
  const openRate = totals.emailSent > 0 ? totals.emailOpened / totals.emailSent : null

  return (
    <div className="flex flex-col gap-6">
      {paused ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-soft/40 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Pause className="size-4 text-warning" aria-hidden="true" />
            All marketing is paused. Booking messages still go.
          </p>
          {marketing.held.length > 0 ? (
            // Campaigns waited while it was paused: Settings asks whether they go now or back to drafts.
            <Button asChild size="sm" variant="secondary">
              <Link href="/dashboard/marketing/settings">Resume in Settings</Link>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                marketing.setSettings({ ...marketing.settings, paused: false })
                toast.success('Marketing is back on')
              }}
            >
              Resume
            </Button>
          )}
        </div>
      ) : null}

      {/* ---- headline numbers ---- */}
      {loading ? (
        <StatGrid columns={4}>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="rounded-2xl border border-line bg-surface p-5 shadow-xs">
              <Skeleton shape="line" className="w-32" />
              <Skeleton className="mt-4 h-8 w-28" />
              <Skeleton shape="line" className="mt-6 w-40" />
            </div>
          ))}
        </StatGrid>
      ) : (
        <StatGrid columns={4}>
          <StatCard
            accent="revenue"
            icon={Wallet}
            stat={{
              label: 'Revenue from marketing',
              value: totals.revenue + totals.campaignRevenue,
              format: 'currency',
              currency,
              comparisonLabel: `Last ${WINDOW_DAYS} days`,
              sparkline: weeks.map((week) => week.automations + week.campaigns),
              hint: 'Bookings made within a few days of a marketing message (5 days unless an automation says otherwise). Booking messages such as reminders are left out: those guests had booked already.',
            }}
            footer={`Automations ${formatCurrency(totals.revenue, currency)} · Campaigns ${formatCurrency(totals.campaignRevenue, currency)} (est.)`}
          />
          <StatCard
            accent="bookings"
            icon={CalendarCheck}
            stat={{
              label: 'Bookings from marketing',
              value: totals.bookings + totals.campaignBookings,
              format: 'number',
              comparisonLabel: 'After a marketing message or click',
              sparkline: weeks.map((week) => week.bookings),
              hint: 'Automations count real bookings guests made within a few days of a message (5 unless an automation says otherwise). Campaigns count bookings within 7 days of a click, and those are estimates.',
            }}
            footer={`Automations ${formatNumber(totals.bookings)} · Campaigns ${formatNumber(totals.campaignBookings)} (est.)`}
          />
          <StatCard
            accent="guests"
            icon={Send}
            stat={{
              label: 'Messages sent',
              value: totals.messages + totals.campaignMessages,
              format: 'number',
              comparisonLabel: `Last ${WINDOW_DAYS} days`,
              sparkline: weeks.map((week) => week.messages),
              hint: 'Emails and texts from live automations, booking messages included, plus campaigns. Opens are estimates.',
            }}
            footer={
              openRate === null
                ? `${formatNumber(totals.active)} guests in an automation now`
                : `About ${Math.round(openRate * 100)}% of emails opened (est.) · ${formatNumber(totals.active)} in an automation now`
            }
          />
          <StatCard
            accent="repeat"
            icon={UsersRound}
            stat={{
              label: 'Subscribers',
              value: subscribers.count,
              format: 'number',
              comparisonLabel: 'Each person counted once',
              hint: 'Guests who said yes to emails or texts, plus people who joined through your forms and are not guests yet.',
            }}
            footer={`${formatNumber(subscribers.texts)} take texts${subscribers.fromForms > 0 ? ` · ${formatNumber(subscribers.fromForms)} new from your forms` : ''}`}
          />
        </StatGrid>
      )}

      {failed ? (
        <p className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          <Info className="size-4 text-subtle" aria-hidden="true" />
          Could not work out the automation numbers just now. Campaign figures and opportunities are still up to date.
        </p>
      ) : null}

      <Opportunities opportunities={opportunities} flows={flows} live={live} paused={paused} />

      {/* items-start: the chart and the campaign list keep their own heights. */}
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          <WeeklyRevenueChart weeks={weeks} currency={currency} loading={loading} failed={failed} />
        </div>
        <RecentCampaignsCard rows={campaignRows} currency={currency} />
      </div>

      <TopAutomationsCard flows={flows} live={live} runs={runs} failed={failed} currency={currency} activities={data.activities} />

      <ToolsCard flows={flows} campaignsSent={campaignRows.length} marketing={marketing} />

      <p className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Automation numbers come from replaying each live automation over your real bookings from the last {WINDOW_DAYS} days. A booking counts when the guest booked within a few days of
          a message (5 unless you changed it). Opens and clicks are estimates, and so are campaign figures.
        </span>
      </p>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Revenue by week: automations and campaigns, stacked on one axis
   -------------------------------------------------------------------------- */

function WeeklyRevenueChart({ weeks, currency, loading, failed }: { weeks: Week[]; currency: CurrencyCode; loading: boolean; failed: boolean }) {
  const [hidden, setHidden] = React.useState<string[]>([])
  const automations = weeks.reduce((sum, week) => sum + week.automations, 0)
  const campaigns = weeks.reduce((sum, week) => sum + week.campaigns, 0)
  const range = (key: string) => {
    const week = weeks.find((entry) => entry.key === key)
    return week ? `${formatDateShort(fromDateKey(week.key))} – ${formatDateShort(fromDateKey(week.end))}` : key
  }
  const legend: ChartLegendItem[] = [
    { key: 'automations', label: 'Automations', color: AUTOMATIONS_COLOR, shape: 'square', value: formatCurrency(automations, currency) },
    { key: 'campaigns', label: 'Campaigns (est.)', color: CAMPAIGNS_COLOR, shape: 'square', value: formatCurrency(campaigns, currency) },
  ]
  const summary = `Revenue from marketing by week over the last ${WEEKS} weeks: automations ${formatCurrency(automations, currency)}, campaigns ${formatCurrency(campaigns, currency)} (estimate).`

  return (
    <ChartContainer
      title="Revenue from marketing by week"
      description="Automation bookings sit in the week their message went. Campaigns are estimates."
      ariaLabel={summary}
      height={260}
      loading={loading}
      empty={!loading && automations + campaigns === 0}
      emptyMessage={failed ? 'Could not work out the automation numbers just now.' : 'No bookings from marketing in the last eight weeks yet.'}
      legend={<ChartLegend items={legend} hidden={hidden} onToggle={(_, next) => setHidden(next)} />}
      dataTable={
        <table>
          <caption>{summary}</caption>
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">Automations</th>
              <th scope="col">Campaigns (estimate)</th>
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.key}>
                <th scope="row">{range(week.key)}</th>
                <td>{formatCurrency(week.automations, currency)}</td>
                <td>{formatCurrency(week.campaigns, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={weeks} margin={{ top: 10, right: 10, bottom: 0, left: 0 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke={CHART_INK.grid} strokeWidth={1} />
          <XAxis
            dataKey="key"
            tickFormatter={(value: string) => formatDateShort(fromDateKey(value))}
            tickLine={false}
            axisLine={false}
            tickMargin={10}
            minTickGap={16}
            tick={{ fill: CHART_INK.tick, fontSize: 12 }}
          />
          <YAxis
            width={58}
            tickCount={5}
            tickFormatter={(value: number) => formatCompactCurrency(value, currency)}
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={{ fill: CHART_INK.tick, fontSize: 12 }}
          />
          <Tooltip
            cursor={CHART_CURSOR_BAND}
            isAnimationActive={false}
            content={
              <ChartTooltip
                formatLabel={(label) => `Week of ${range(String(label))}`}
                formatValue={(value) => formatCurrency(value, currency)}
                showTotal
                totalLabel="Total"
              />
            }
          />
          <Bar
            dataKey="automations"
            name="Automations"
            stackId="revenue"
            hide={hidden.includes('automations')}
            fill={AUTOMATIONS_COLOR}
            stroke="var(--surface)"
            strokeWidth={2}
            radius={hidden.includes('campaigns') ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={44}
            isAnimationActive={false}
          />
          <Bar
            dataKey="campaigns"
            name="Campaigns (est.)"
            stackId="revenue"
            hide={hidden.includes('campaigns')}
            fill={CAMPAIGNS_COLOR}
            stroke="var(--surface)"
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
            maxBarSize={44}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}

/* --------------------------------------------------------------------------
   Opportunities right now — worked out on the server, one button each
   -------------------------------------------------------------------------- */

/** The live automation already taking care of it, if there is one. */
function coveredBy(live: Flow[], test: (flow: Flow) => boolean): Flow | undefined {
  return live.find(test)
}

function usesWaivers(flow: Flow): boolean {
  if (flow.who.conditions.some((condition) => condition.field === 'booking.waiversMissing')) return true
  let found = false
  walkSteps(flow.steps, (step) => {
    if (step.type === 'branch' && step.when.conditions.some((condition) => condition.field === 'booking.waiversMissing')) found = true
    if (step.type === 'wait' && step.mode === 'until_event' && step.event === 'waivers_signed') found = true
    return found ? false : undefined
  })
  return found
}

interface Opportunity {
  id: string
  icon: LucideIcon
  count: number
  /** What the count counts, read after the number: "trips or visits under half full this week". */
  title: string
  none: string
  detail: string
  items: { key: string; text: string; meta: string }[]
  action: string
  recipeId: string
  covered?: Flow
  /** Not on, but already set up from this recipe: open that one rather than starting a second. */
  idle?: Flow
}

function Opportunities({ opportunities, flows, live, paused }: { opportunities: MarketingOpportunities; flows: Flow[]; live: Flow[]; paused: boolean }) {
  const { underFilled, lapsed, waivers, reviews } = opportunities
  const many = (n: number, one: string, more: string) => (n === 1 ? one : more)
  const plural = (n: number, one: string, more: string) => `${formatNumber(n)} ${many(n, one, more)}`

  const list: Opportunity[] = [
    {
      id: 'fill',
      icon: Armchair,
      count: underFilled.count,
      title: `${many(underFilled.count, 'trip or visit', 'trips or visits')} under half full this week`,
      none: 'Every trip or visit this week is at least half full.',
      detail: `${plural(underFilled.emptySeats, 'seat is', 'seats are')} still open. Offer them to past guests with a one-time code.`,
      items: underFilled.top.map((entry) => ({ key: entry.id, text: entry.activityName, meta: `${when(entry.startsAt)} · ${entry.booked} of ${entry.capacity} booked` })),
      action: 'Fill these seats',
      recipeId: underFilled.recipe.id,
      covered: coveredBy(live, (flow) => flow.recipeId === underFilled.recipe.id || flow.trigger.type === 'low_fill'),
    },
    {
      id: 'lapsed',
      icon: Repeat,
      count: lapsed.count,
      title: `${many(lapsed.count, 'guest hasn’t', 'guests haven’t')} booked in four months`,
      none: 'No subscribed guest has been away for four months.',
      detail: 'All of them said yes to marketing. A short note with a code brings some back.',
      items: lapsed.top.map((entry) => ({ key: entry.id, text: entry.name, meta: `Last booked ${formatDateShort(entry.lastBookingAt)}` })),
      action: 'Win them back',
      recipeId: lapsed.recipe.id,
      covered: coveredBy(live, (flow) => flow.recipeId === lapsed.recipe.id || flow.trigger.type === 'lapsed'),
    },
    {
      id: 'waivers',
      icon: FilePenLine,
      count: waivers.bookings,
      title: `${many(waivers.bookings, 'booking', 'bookings')} with waivers to sign in the next 3 days`,
      none: 'Every booking in the next 3 days has its waivers signed.',
      detail: `${plural(waivers.guests, 'signature is', 'signatures are')} still missing. Chase them before the day, not at check-in.`,
      items: waivers.top.map((entry) => ({ key: entry.reference, text: `${entry.guestName} · ${entry.activityName}`, meta: `${when(entry.startsAt)} · ${plural(entry.missing, 'signature', 'signatures')} missing` })),
      action: 'Chase waivers',
      recipeId: waivers.recipe.id,
      covered: coveredBy(live, (flow) => flow.recipeId === waivers.recipe.id || usesWaivers(flow)),
    },
    {
      id: 'reviews',
      icon: Star,
      count: reviews.count,
      title: `${many(reviews.count, 'review', 'reviews')} of 4 or 5 stars in the last two weeks`,
      none: 'No 4 or 5 star reviews in the last two weeks.',
      detail: `${reviews.fiveStar > 0 ? `${formatNumber(reviews.fiveStar)} gave 5 stars. ` : ''}A thank-you with a code turns a good day into the next booking.`,
      items: reviews.top.map((entry) => ({ key: entry.reference, text: `${entry.guestName} · ${entry.activityName}`, meta: `${entry.rating} stars · ${formatDateShort(entry.endsAt)}` })),
      action: 'Thank them',
      recipeId: reviews.recipe.id,
      covered: coveredBy(
        live,
        (flow) =>
          flow.recipeId === reviews.recipe.id ||
          (flow.trigger.type === 'review_left' && (!flow.trigger.ratings || flow.trigger.ratings.length === 0 || flow.trigger.ratings.some((rating) => rating >= 4))),
      ),
    },
  ]

  for (const item of list) {
    if (!item.covered) item.idle = flows.find((flow) => flow.status !== 'live' && flow.recipeId === item.recipeId)
  }

  return (
    <section aria-labelledby="opportunities-title" className="flex flex-col gap-3">
      <div>
        <h2 id="opportunities-title" className="text-base font-semibold text-foreground">
          Opportunities right now
        </h2>
        <p className="text-[0.8125rem] text-muted">From your bookings, start times and reviews as they stand today.</p>
      </div>
      <ul className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {list.map((item) => (
          <li key={item.id} className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <span
                aria-hidden="true"
                className={cn('grid size-8 shrink-0 place-items-center rounded-lg', item.count > 0 ? 'bg-primary-soft text-primary' : 'bg-surface-sunken text-faint')}
              >
                {item.count > 0 ? <item.icon className="size-4" /> : <CircleCheck className="size-4" />}
              </span>
              {item.covered ? (
                paused && item.covered.purpose === 'marketing' ? (
                  <Badge size="sm" variant="warning">
                    Paused
                  </Badge>
                ) : (
                  <Badge size="sm" variant="success">
                    Taken care of
                  </Badge>
                )
              ) : null}
            </div>

            {item.count === 0 ? (
              <p className="mt-3 text-sm text-subtle">{item.none}</p>
            ) : (
              <>
                <p className="mt-3 text-sm text-foreground">
                  <span className="mr-1 text-xl font-semibold tabular">{formatNumber(item.count)}</span>
                  <span className="font-medium">{item.title}</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{item.detail}</p>
                {item.items.length > 0 ? (
                  <ul className="mt-3 flex list-none flex-col gap-2 border-t border-line-subtle p-0 pt-3">
                    {item.items.slice(0, 2).map((entry) => (
                      <li key={entry.key} className="min-w-0 text-xs">
                        <p className="truncate font-medium text-foreground" title={entry.text}>
                          {entry.text}
                        </p>
                        <p className="truncate tabular text-subtle">{entry.meta}</p>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}

            {item.count > 0 ? (
              <div className="mt-auto flex flex-col items-start gap-2 pt-4">
                {item.covered ? (
                  <>
                    <p className="text-xs leading-relaxed text-subtle">
                      {paused && item.covered.purpose === 'marketing'
                        ? `“${item.covered.name}” is on, but nothing goes while marketing is paused.`
                        : `“${item.covered.name}” is on and takes care of this.`}
                    </p>
                    <Button asChild size="xs" variant="secondary">
                      <Link href={flowHref(item.covered.id)} aria-label={`Open ${item.covered.name}`}>
                        Open it
                      </Link>
                    </Button>
                  </>
                ) : item.idle ? (
                  <>
                    <p className="text-xs leading-relaxed text-subtle">
                      “{item.idle.name}” is {item.idle.status === 'paused' ? 'paused' : 'still a draft'}: turn it on to start.
                    </p>
                    <Button asChild size="xs" variant="primary" rightIcon={<ArrowRight />}>
                      <Link href={flowHref(item.idle.id)}>{item.action}</Link>
                    </Button>
                  </>
                ) : (
                  <Button asChild size="xs" variant="primary" rightIcon={<ArrowRight />}>
                    <Link href={recipeHref(item.recipeId)}>{item.action}</Link>
                  </Button>
                )}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

/* --------------------------------------------------------------------------
   Top automations — live ones, from the simulator
   -------------------------------------------------------------------------- */

function TopAutomationsCard({
  flows,
  live,
  runs,
  failed,
  currency,
  activities,
}: {
  flows: Flow[]
  live: Flow[]
  runs: Record<string, Run> | null
  failed: boolean
  currency: CurrencyCode
  activities: { slug: string; name: string }[]
}) {
  const rows = live
    .map((flow) => {
      const run = runs?.[flow.id]
      let emailSent = 0
      let emailOpened = 0
      if (run) {
        for (const step of messageSteps(flow.steps)) {
          if (step.type !== 'email') continue
          emailSent += run.perStep[step.id]?.sent ?? 0
          emailOpened += run.perStep[step.id]?.opened ?? 0
        }
      }
      return { flow, run, openRate: emailSent > 0 ? emailOpened / emailSent : null }
    })
    // Marketing that earns first, by what it earned; then booking messages by how much they send.
    .sort((a, b) => {
      const am = a.flow.purpose === 'marketing' ? 1 : 0
      const bm = b.flow.purpose === 'marketing' ? 1 : 0
      if (am !== bm) return bm - am
      if (am === 1) return (b.run?.revenue ?? 0) - (a.run?.revenue ?? 0) || (b.run?.messages ?? 0) - (a.run?.messages ?? 0)
      return (b.run?.messages ?? 0) - (a.run?.messages ?? 0)
    })
  const pausedCount = flows.filter((flow) => flow.status === 'paused').length
  const drafts = flows.filter((flow) => flow.status === 'draft').length
  const rest = [pausedCount > 0 ? `${pausedCount} paused` : '', drafts > 0 ? `${drafts} ${drafts === 1 ? 'draft' : 'drafts'}` : ''].filter(Boolean).join(', ')

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Top automations</CardTitle>
          <CardDescription>
            {live.length} live{rest ? ` · ${rest}` : ''}. Last {WINDOW_DAYS} days. Bookings and revenue are shown for marketing only.
          </CardDescription>
        </div>
        <CardToolbar>
          <Button asChild variant="ghost" size="sm" rightIcon={<ArrowRight />}>
            <Link href={AUTOMATIONS_HREF}>All automations</Link>
          </Button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="p-0">
        {live.length === 0 ? (
          <div className="flex flex-col items-start gap-3 border-t border-line-subtle px-5 py-6 sm:px-6">
            <p className="text-sm text-muted">No automation is on yet. Start from a recipe: most take a minute.</p>
            <Button asChild size="sm" variant="secondary">
              <Link href={AUTOMATIONS_HREF}>See recipes</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto border-t border-line-subtle">
            {/* The name column takes what is left; the numbers keep fixed, unwrapped widths. */}
            <table className="type-crm w-full min-w-[820px] border-collapse text-left">
              <colgroup>
                <col />
                <col className="w-24" />
                <col className="w-32" />
                <col className="w-24" />
                <col className="w-24" />
                <col className="w-36" />
              </colgroup>
              <thead>
                <tr className="border-b border-line-subtle bg-surface-sunken/50">
                  <th scope="col" className="px-5 py-2.5 sm:px-6">Automation</th>
                  <th scope="col" className="px-3 py-2.5 text-right whitespace-nowrap">Sent</th>
                  <th scope="col" className="px-3 py-2.5 text-right whitespace-nowrap">Opened (est.)</th>
                  <th scope="col" className="px-3 py-2.5 text-right whitespace-nowrap">In it now</th>
                  <th scope="col" className="px-3 py-2.5 text-right whitespace-nowrap">Booked</th>
                  <th scope="col" className="px-5 py-2.5 text-right whitespace-nowrap sm:px-6">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, TOP_ROWS).map(({ flow, run, openRate }) => {
                  const marketingFlow = flow.purpose === 'marketing'
                  const cell = (value: string) => (run ? value : failed ? '—' : <Skeleton shape="line" className="ml-auto w-10" />)
                  return (
                    <tr key={flow.id} className="border-b border-line-subtle last:border-b-0 hover:bg-surface-sunken/40">
                      <td className="px-5 py-3 sm:px-6">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <Link href={flowHref(flow.id)} className="font-medium text-foreground hover:underline">
                            {flow.name}
                          </Link>
                          <Badge variant={marketingFlow ? 'primary' : 'neutral'} size="sm" className="shrink-0">
                            {PURPOSE_LABEL[flow.purpose]}
                          </Badge>
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-subtle">{describeTrigger(flow.trigger, { activities, currency })}</span>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular">{cell(formatNumber(run?.messages ?? 0))}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular text-muted">{cell(openRate === null ? '—' : `${Math.round(openRate * 100)}%`)}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular text-muted">{cell(formatNumber(run?.active ?? 0))}</td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular">{cell(marketingFlow ? formatNumber(run?.bookings ?? 0) : '—')}</td>
                      <td className="px-5 py-3 text-right font-semibold whitespace-nowrap tabular sm:px-6">{cell(marketingFlow ? formatCurrency(run?.revenue ?? 0, currency) : '—')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {rows.length > TOP_ROWS ? (
              <p className="border-t border-line-subtle px-5 py-3 text-xs text-subtle sm:px-6">
                The {TOP_ROWS} busiest of {rows.length} live.{' '}
                <Link href={AUTOMATIONS_HREF} className="font-medium text-primary hover:underline">
                  See them all
                </Link>
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* --------------------------------------------------------------------------
   Recent campaigns
   -------------------------------------------------------------------------- */

function RecentCampaignsCard({ rows, currency }: { rows: CampaignRow[]; currency: CurrencyCode }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Recent campaigns</CardTitle>
          <CardDescription>Sent in the last {WINDOW_DAYS} days. Figures are estimates.</CardDescription>
        </div>
        <CardToolbar>
          <Button asChild size="sm" variant="secondary" leftIcon={<Megaphone />}>
            <Link href="/dashboard/marketing/campaigns">New campaign</Link>
          </Button>
        </CardToolbar>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="border-t border-line-subtle px-5 py-5 text-sm text-subtle sm:px-6">Nothing sent lately. A short note about what is new keeps you in mind.</p>
        ) : (
          <ul className="flex list-none flex-col divide-y divide-line-subtle border-t border-line-subtle p-0">
            {rows.slice(0, 5).map(({ campaign, sentAt, stats }) => (
              <li key={campaign.id} className="flex items-center justify-between gap-3 px-5 py-3.5 sm:px-6">
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle">
                  {campaign.channel === 'sms' ? <Send className="size-4" /> : <Mail className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{campaign.name}</p>
                  <p className="truncate text-xs text-subtle">
                    <span suppressHydrationWarning>{formatDateShort(sentAt)}</span> · {formatNumber(stats.delivered)} {campaign.channel === 'sms' ? 'texts' : 'emails'}
                    {campaign.channel === 'email' && stats.delivered > 0 ? ` · ${Math.round((stats.opened / stats.delivered) * 100)}% opened` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular text-foreground">{formatCurrency(stats.revenue * 100, currency)}</p>
                  <p className="text-xs text-subtle">
                    {stats.bookings} {stats.bookings === 1 ? 'booking' : 'bookings'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/* --------------------------------------------------------------------------
   Your tools — every marketing tab with its state, switches where it has one
   -------------------------------------------------------------------------- */

interface Tool {
  label: string
  text: string
  href: string
  icon: LucideIcon
  /** A switch, or a plain state badge. `set` returns false when it did not change anything (and said why). */
  toggle?: { checked: boolean; set: (value: boolean) => boolean | void; on: string; off: string }
  badge?: { text: string; on: boolean }
}

function ToolsCard({ flows, campaignsSent, marketing }: { flows: Flow[]; campaignsSent: number; marketing: ReturnType<typeof useMarketing> }) {
  const liveCount = flows.filter((flow) => flow.status === 'live').length
  const scheduled = marketing.campaigns.filter((campaign) => campaign.status === 'scheduled').length
  const { forms, settings } = marketing
  const own = marketing.customAudiences.length
  const router = useRouter()

  const tools: Tool[] = [
    {
      label: 'Automations',
      text: `${liveCount} of ${flows.length} on`,
      href: AUTOMATIONS_HREF,
      icon: Workflow,
      badge: { text: liveCount > 0 ? `${liveCount} live` : 'None on', on: liveCount > 0 },
    },
    {
      label: 'Campaigns',
      text: `${campaignsSent} sent in ${WINDOW_DAYS} days${scheduled > 0 ? ` · ${scheduled} scheduled` : ''}`,
      href: '/dashboard/marketing/campaigns',
      icon: Megaphone,
      badge: { text: scheduled > 0 ? 'Scheduled' : 'Nothing queued', on: scheduled > 0 },
    },
    {
      label: 'Audiences',
      text: `${marketing.audiences.length} audiences${own > 0 ? ` · ${own} your own` : ''}`,
      href: '/dashboard/marketing/audiences',
      icon: Users,
    },
    {
      // A link, not a switch: turning the pop-up on or off also moves its code in Promo codes, which the Forms page does.
      label: 'Storefront pop-up',
      text: forms.popup.offer.enabled ? `${forms.popup.offer.percent}% off a first trip` : 'Joins the list, no code',
      href: '/dashboard/marketing/forms',
      icon: MousePointerClick,
      badge: { text: forms.popup.enabled ? 'On' : 'Off', on: forms.popup.enabled },
    },
    {
      label: 'Footer sign-up',
      text: forms.footer.headline,
      href: '/dashboard/marketing/forms',
      icon: PanelBottom,
      toggle: { checked: forms.footer.enabled, set: (value) => marketing.setForms({ ...forms, footer: { ...forms.footer, enabled: value } }), on: 'Footer sign-up on', off: 'Footer sign-up off' },
    },
    {
      label: 'Checkout opt-in',
      text: forms.checkout.sms ? 'Asks for emails and texts' : 'Asks for emails',
      href: '/dashboard/marketing/forms',
      icon: Mail,
      toggle: { checked: forms.checkout.enabled, set: (value) => marketing.setForms({ ...forms, checkout: { ...forms.checkout, enabled: value } }), on: 'Checkout opt-in on', off: 'Checkout opt-in off' },
    },
    {
      label: 'Email templates',
      text: marketing.emailTemplates.length > 0 ? `${marketing.emailTemplates.length} saved designs` : 'No saved designs yet',
      href: '/dashboard/marketing/templates',
      icon: LayoutTemplate,
    },
    {
      label: 'Pause all marketing',
      text: 'Booking messages keep going',
      href: '/dashboard/marketing/settings',
      icon: Pause,
      toggle: {
        checked: settings.paused,
        set: (value) => {
          // Campaigns waited while it was paused: Settings asks whether they go now or back to drafts.
          if (!value && marketing.held.length > 0) {
            toast(`${marketing.held.length === 1 ? 'A campaign is' : `${marketing.held.length} campaigns are`} waiting`, {
              description: 'Resume in Marketing settings, where you choose whether they go now or back to drafts.',
              action: { label: 'Open settings', onClick: () => router.push('/dashboard/marketing/settings') },
            })
            return false
          }
          marketing.setSettings({ ...settings, paused: value })
        },
        on: 'Marketing paused',
        off: 'Marketing resumed',
      },
    },
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <div>
          <CardTitle>Your tools</CardTitle>
          <CardDescription>Switch them on or off here. Open one to change the wording, the numbers and who it goes to.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="grid list-none gap-px border-t border-line-subtle bg-line-subtle p-0 sm:grid-cols-2 xl:grid-cols-4">
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
                  checked={tool.toggle.checked}
                  onCheckedChange={(value) => {
                    if (tool.toggle?.set(value) === false) return
                    toast(value ? tool.toggle!.on : tool.toggle!.off)
                  }}
                  aria-label={tool.label}
                />
              ) : tool.badge ? (
                <Badge variant={tool.badge.on ? 'success' : 'neutral'} size="sm" className="shrink-0">
                  {tool.badge.text}
                </Badge>
              ) : (
                <ArrowRight className="size-4 shrink-0 text-faint" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
