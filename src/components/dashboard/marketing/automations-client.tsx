'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  CalendarClock,
  Copy,
  Inbox,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented, type SegmentedOption } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard, StatGrid } from '@/components/ui/stat'
import { Switch } from '@/components/ui/switch'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toaster'
import { AutomationEditor, isStaffSent } from '@/components/dashboard/marketing/automation-editor'
import { FlowBuilder } from '@/components/dashboard/marketing/flow-builder'
import { MessageCalendar } from '@/components/dashboard/marketing/message-calendar'
import { FlowIcon, RecipeGallery } from '@/components/dashboard/marketing/recipe-gallery'
import { useChannels } from '@/hooks/use-channels'
import { brandColors, useEmailContext } from '@/hooks/use-email-context'
import { useFlows } from '@/hooks/use-flows'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { useMessageTemplates } from '@/hooks/use-message-templates'
import { runFlows } from '@/lib/actions/flows'
import { textingNumber } from '@/lib/channels'
import type { MarketingData } from '@/lib/data/guest-marketing'
import { FLOW_GOALS, PURPOSE_LABEL, STATUS_LABEL, goalMeta, triggerMeta } from '@/lib/flows/catalog'
import { canGoLive, checkFlow } from '@/lib/flows/check'
import { flowFromTemplate } from '@/lib/flows/defaults'
import { describeTrigger, type DescribeLookups } from '@/lib/flows/describe'
import type { FlowExtras } from '@/lib/flows/engine'
import { RECIPES } from '@/lib/flows/recipes'
import { messageSteps } from '@/lib/flows/tree'
import type { Flow, FlowGoal, FlowRun, FlowStatus } from '@/lib/flows/types'
import { CHANNEL_LABEL, groupOf, renderTemplate, timingLabel, type MessageContext, type MessageTemplate } from '@/lib/messaging'
import { cn, formatCurrency, formatDateShort } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   AUTOMATIONS
   Two views. "Automations": the flows that run on their own (built-in ones,
   ones made from a recipe, ones built from scratch), with honest numbers
   from the simulator, what goes out this week, and the builder to change
   them. "Booking messages": the confirmation, reminders and the rest every
   booking gets, edited in a simple sheet.

   Bookings and revenue are only credited to marketing automations. A
   reminder goes to someone who has already booked, so a booking soon after
   it is a coincidence, not a result.
   ========================================================================== */

type RunMap = Record<string, Omit<FlowRun, 'journeys'>>
type View = 'flows' | 'booking'
type StatusFilter = 'all' | FlowStatus

const DAY = 86_400_000
const STATUS_ORDER: Record<FlowStatus, number> = { live: 0, paused: 1, draft: 2 }
const POPULAR = ['fill-empty-seats', 'ask-for-review', 'win-back']

interface RowStats {
  inNow: number
  sent: number
  /** Share of emails opened, 0–1. Null when no email went. */
  openRate: number | null
  /** Marketing automations only. */
  booked: number | null
  revenue: number | null
}

function statsFor(flow: Flow, run: Omit<FlowRun, 'journeys'> | undefined): RowStats | null {
  if (!run) return null
  let emailSent = 0
  let opened = 0
  for (const step of messageSteps(flow.steps)) {
    if (step.type !== 'email') continue
    const stats = run.perStep[step.id]
    if (!stats) continue
    emailSent += stats.sent
    opened += stats.opened
  }
  const marketing = flow.purpose === 'marketing'
  return {
    inNow: run.active,
    sent: run.messages,
    openRate: emailSent > 0 ? opened / emailSent : null,
    booked: marketing ? run.bookings : null,
    revenue: marketing ? run.revenue : null,
  }
}

const n = (value: number) => value.toLocaleString('en-US')

export function AutomationsClient({
  tenant: tenantRecord,
  nowIso,
  data,
  sample,
  initialRecipe = null,
  initialFlow = null,
}: {
  tenant: Tenant
  nowIso: string
  data: MarketingData
  sample: MessageContext
  /** Open the ideas on this recipe (from ?recipe=). */
  initialRecipe?: string | null
  /** Open this automation (from ?flow=). */
  initialFlow?: string | null
}) {
  const tenant = useMarketingTenant(tenantRecord)
  const currency = tenantRecord.currency
  const marketing = useMarketing(tenant, nowIso)
  const store = useFlows(tenantRecord, nowIso, data.activities)
  const messages = useMessageTemplates(tenantRecord.id)
  const { settings: channels } = useChannels(tenantRecord)
  const hasSmsNumber = Boolean(textingNumber(channels))
  const ctx = useEmailContext(tenantRecord, data.activities, sample as unknown as Record<string, string>)
  const brand = React.useMemo(() => brandColors(tenantRecord), [tenantRecord])
  const paused = marketing.settings.paused

  const [view, setView] = React.useState<View>('flows')
  const [search, setSearch] = React.useState('')
  const [status, setStatus] = React.useState<StatusFilter>('all')
  const [goal, setGoal] = React.useState<FlowGoal | 'all'>('all')
  const [gallery, setGallery] = React.useState<{ open: boolean; recipeId: string | null }>({ open: false, recipeId: null })
  const [editing, setEditing] = React.useState<{ flow: Flow; isNew: boolean } | null>(null)
  const [editingMessage, setEditingMessage] = React.useState<MessageTemplate | null>(null)
  const [deleting, setDeleting] = React.useState<Flow | null>(null)

  const flows = store.flows
  const lookups = React.useMemo<DescribeLookups>(() => ({ activities: data.activities, audiences: marketing.audiences, currency }), [data.activities, marketing.audiences, currency])
  const checkCtx = React.useMemo(
    () => ({ audiences: marketing.audiences, activities: data.activities, hasSmsNumber, marketingPaused: paused }),
    [marketing.audiences, data.activities, hasSmsNumber, paused],
  )

  /* ---------- numbers from the simulator ---------- */

  const extras = React.useMemo<FlowExtras>(
    () => ({
      signups: marketing.signups.map((signup) => ({ email: signup.email, phone: signup.phone, source: signup.source, at: signup.at })),
      settings: {
        paused: marketing.settings.paused,
        quietHours: marketing.settings.quietHours,
        frequencyCap: marketing.settings.frequencyCap,
        skipUpcoming: marketing.settings.skipUpcoming,
      },
      audiences: marketing.audiences,
      nowIso,
    }),
    [marketing.signups, marketing.settings, marketing.audiences, nowIso],
  )

  // The simulator reads what a flow does, not its name, status or history:
  // switching one on or renaming it must not replay every automation again.
  const runKey = React.useMemo(
    () =>
      JSON.stringify([
        flows.map((flow) => [flow.id, flow.purpose, flow.trigger, flow.who, flow.steps, flow.exit, flow.settings]),
        extras,
      ]),
    [flows, extras],
  )
  const latest = React.useRef({ flows, extras })
  latest.current = { flows, extras }

  const [runs, setRuns] = React.useState<RunMap | null>(null)
  const [runFailed, setRunFailed] = React.useState(false)
  const [attempt, setAttempt] = React.useState(0)
  React.useEffect(() => {
    let alive = true
    // Saves come in bursts from the builder, and the saved list lands just after the first paint: wait for a quiet moment.
    const timer = window.setTimeout(() => {
      setRunFailed(false)
      runFlows(tenantRecord.id, latest.current.flows, latest.current.extras)
        .then((result) => {
          if (alive) setRuns(result)
        })
        .catch(() => {
          if (alive) setRunFailed(true)
        })
    }, 400)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [tenantRecord.id, runKey, attempt])

  const windowDays = React.useMemo(() => {
    const first = runs ? Object.values(runs)[0] : undefined
    if (!first) return 60
    return Math.max(1, Math.round((new Date(nowIso).getTime() - new Date(first.from).getTime()) / DAY))
  }, [runs, nowIso])
  const conversionDays = flows.find((flow) => flow.purpose === 'marketing')?.settings.conversionDays ?? 5

  const live = React.useMemo(() => flows.filter((flow) => flow.status === 'live'), [flows])
  const kpis = React.useMemo(() => {
    let inNow = 0
    let due = 0
    let bookings = 0
    let revenue = 0
    const busiest = new Map<string, number>()
    for (const flow of live) {
      const run = runs?.[flow.id]
      if (!run) continue
      inNow += run.active
      for (const [key, count] of Object.entries(run.upcoming)) {
        due += count
        busiest.set(key, (busiest.get(key) ?? 0) + count)
      }
      if (flow.purpose === 'marketing') {
        bookings += run.bookings
        revenue += run.revenue
      }
    }
    const top = [...busiest.entries()].sort((a, b) => b[1] - a[1])[0]
    return { inNow, due, bookings, revenue, busiest: top && top[1] > 0 ? top : null }
  }, [live, runs])

  /* ---------- deep links: ?recipe= and ?flow= ---------- */

  const linked = React.useRef(false)
  React.useEffect(() => {
    if (linked.current || (!initialRecipe && !initialFlow)) return
    if (initialRecipe) {
      const known = RECIPES.some((recipe) => recipe.id === initialRecipe)
      setGallery({ open: true, recipeId: known ? initialRecipe : null })
    }
    // The saved list arrives just after the first paint: look for the automation once it has.
    // Marked done inside the timer so a development double run still gets here.
    const timer = window.setTimeout(() => {
      linked.current = true
      if (initialFlow && !initialRecipe) {
        const flow = latest.current.flows.find((entry) => entry.id === initialFlow)
        if (flow) setEditing({ flow, isNew: false })
        else toast.error('That automation was not found', { description: 'It may have been deleted. Here is the full list.' })
      }
      try {
        window.history.replaceState(window.history.state, '', window.location.pathname)
      } catch {
        /* the address stays as it is */
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [initialRecipe, initialFlow])

  /* ---------- actions ---------- */

  // Toasts and the builder call back later: always act on the store as it is then.
  const storeRef = React.useRef(store)
  storeRef.current = store

  const openFlow = (id: string) => {
    const flow = store.byId(id)
    if (flow) setEditing({ flow, isNew: false })
  }

  /** Deletes one, with a way back for a few seconds. */
  const removeFlow = (flow: Flow) => {
    const saved = storeRef.current.byId(flow.id) ?? flow
    storeRef.current.remove(flow.id)
    toast(`${saved.name} deleted`, {
      description: 'Nothing more goes out from it.',
      action: { label: 'Undo', onClick: () => storeRef.current.create(saved) },
    })
  }

  const turnOn = (flow: Flow) => {
    const issues = checkFlow(flow, checkCtx)
    if (!canGoLive(issues)) {
      const blockers = issues.filter((issue) => issue.severity === 'blocker')
      toast.error(`${flow.name} can’t go live yet`, {
        description: `${blockers[0]?.text ?? 'Something needs fixing first.'}${blockers.length > 1 ? ` And ${blockers.length - 1} more.` : ''} Use Check in the builder to see what to fix.`,
      })
      setEditing({ flow, isNew: false })
      return
    }
    store.setStatus(flow.id, 'live')
    toast.success(`${flow.name} is live`, {
      description: flow.purpose === 'marketing' && paused ? 'Marketing is paused, so it waits until you resume.' : undefined,
    })
  }

  const pause = (flow: Flow) => {
    store.setStatus(flow.id, 'paused')
    toast(`${flow.name} is paused`, { description: 'Nothing more goes out from it until you turn it back on.' })
  }

  const duplicate = (flow: Flow) => {
    const copy = store.duplicate(flow.id)
    if (!copy) return
    toast.success(`Copied as “${copy.name}”`, { description: 'Saved as a draft.', action: { label: 'Open', onClick: () => setEditing({ flow: copy, isNew: false }) } })
  }

  const confirmDelete = () => {
    if (!deleting) return
    removeFlow(deleting)
    setDeleting(null)
  }

  const startFlow = (flow: Flow) => {
    setGallery({ open: false, recipeId: null })
    setEditing({ flow, isNew: true })
  }

  const saveFlow = (flow: Flow, what: string) => {
    const current = storeRef.current
    if (current.byId(flow.id)) current.save(flow, what)
    else current.create({ ...flow, history: flow.history?.length ? [{ at: nowIso, what }, ...flow.history].slice(0, 20) : [{ at: nowIso, what }] })
    // Once saved it is no longer new: it can be deleted from the builder.
    setEditing((open) => (open && open.isNew && open.flow.id === flow.id ? { ...open, isNew: false } : open))
  }

  /** A booking message, copied into an automation of its own (a booking message flow) and opened in the builder. */
  const copyAsAutomation = (template: MessageTemplate) => {
    const base = flowFromTemplate({ ...template, key: `custom_${Date.now().toString(36)}`, group: 'booking' }, { nowIso, activities: data.activities })
    const flow: Flow = {
      ...base,
      name: `${template.name} (copy)`,
      purpose: 'booking',
      status: 'draft',
      builtIn: false,
      history: [{ at: nowIso, what: `Copied from the “${template.name}” booking message` }],
    }
    setEditingMessage(null)
    setView('flows')
    setEditing({ flow, isNew: true })
    if (template.enabled) {
      toast(`“${template.name}” is still on`, {
        description: 'When the copy goes live, turn the original off in Booking messages, or guests get both.',
      })
    }
  }

  /* ---------- the list ---------- */

  const goalsInUse = React.useMemo(() => FLOW_GOALS.filter((meta) => meta.goal === goal || flows.some((flow) => flow.goal === meta.goal)), [flows, goal])
  const usedRecipeIds = React.useMemo(() => flows.map((flow) => flow.recipeId).filter((id): id is string => Boolean(id)), [flows])
  const statusCounts = React.useMemo(() => {
    const out: Record<StatusFilter, number> = { all: flows.length, live: 0, paused: 0, draft: 0 }
    for (const flow of flows) out[flow.status] += 1
    return out
  }, [flows])

  const shown = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return flows
      .filter((flow) => (status === 'all' ? true : flow.status === status))
      .filter((flow) => (goal === 'all' ? true : flow.goal === goal))
      .filter((flow) => {
        if (!q) return true
        const words = `${flow.name} ${flow.description} ${describeTrigger(flow.trigger, lookups)} ${goalMeta(flow.goal).label}`.toLowerCase()
        return words.includes(q)
      })
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.updatedAt.localeCompare(a.updatedAt))
  }, [flows, status, goal, search, lookups])

  const filtering = search.trim() !== '' || status !== 'all' || goal !== 'all'
  const clearFilters = () => {
    setSearch('')
    setStatus('all')
    setGoal('all')
  }

  const bookingMessages = React.useMemo(() => messages.templates.filter((template) => !template.custom && groupOf(template) === 'booking'), [messages.templates])

  const rowProps = (flow: Flow): FlowRowProps => ({
    flow,
    stats: statsFor(flow, runs?.[flow.id]),
    loading: runs === null && !runFailed,
    trigger: describeTrigger(flow.trigger, lookups),
    currency,
    windowDays,
    conversionDays,
    marketingPaused: paused,
    onOpen: () => setEditing({ flow, isNew: false }),
    onTurnOn: () => turnOn(flow),
    onPause: () => pause(flow),
    onDuplicate: () => duplicate(flow),
    onDelete: flow.builtIn ? undefined : () => setDeleting(flow),
  })

  const viewOptions: SegmentedOption<View>[] = [
    { value: 'flows', label: 'Automations', icon: Workflow, count: flows.length },
    { value: 'booking', label: 'Booking messages', icon: Inbox, count: bookingMessages.length },
  ]
  const statusOptions: SegmentedOption<StatusFilter>[] = [
    { value: 'all', label: 'All', count: statusCounts.all },
    { value: 'live', label: 'Live', count: statusCounts.live },
    { value: 'paused', label: 'Paused', count: statusCounts.paused },
    { value: 'draft', label: 'Drafts', count: statusCounts.draft },
  ]

  return (
    <div className="flex flex-col gap-6">
      {paused ? (
        <div role="status" className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Pause className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-foreground">Marketing is paused</p>
              <p className="mt-0.5 text-sm text-muted">
                Booking messages still go. Marketing automations are on hold: nobody new starts them and nothing goes out until you resume.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/dashboard/marketing/settings">Settings</Link>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<Play />}
              onClick={() => {
                marketing.setSettings({ ...marketing.settings, paused: false })
                toast.success('Marketing is back on')
              }}
            >
              Resume marketing
            </Button>
          </div>
        </div>
      ) : null}

      {/* ---------- views and the main action ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-1 min-w-0 overflow-x-auto px-1 no-scrollbar">
          <Segmented options={viewOptions} value={view} onValueChange={setView} label="Automations views" size="md" className="min-w-max" />
        </div>
        <Button leftIcon={<Plus />} onClick={() => setGallery({ open: true, recipeId: null })}>
          New automation
        </Button>
      </div>

      {view === 'flows' ? (
        <>
          {/* ---------- KPIs ---------- */}
          {runs === null && !runFailed ? (
            <StatGrid columns={4} aria-busy="true">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="rounded-2xl border border-line bg-surface p-5 shadow-xs">
                  <Skeleton className="h-4 w-32 rounded-md" />
                  <Skeleton className="mt-4 h-8 w-20 rounded-md" />
                  <Skeleton className="mt-5 h-3 w-40 rounded-md" />
                </div>
              ))}
            </StatGrid>
          ) : runFailed && runs === null ? (
            <StatGrid columns={4}>
              <StatCard
                accent="bookings"
                icon={Zap}
                stat={{ label: 'Live automations', value: live.length, format: 'number', hint: 'Automations that are on and sending.' }}
                footer={
                  <span>
                    {statusCounts.draft} {statusCounts.draft === 1 ? 'draft' : 'drafts'} · {statusCounts.paused} paused
                  </span>
                }
              />
              <div role="alert" className="flex flex-col items-start justify-center gap-3 rounded-2xl border border-line bg-surface p-5 shadow-xs xl:col-span-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">The numbers didn’t load</p>
                  <p className="mt-0.5 text-sm text-muted">Your automations are fine and still run. Only the figures for guests, messages and bookings are missing.</p>
                </div>
                <Button variant="secondary" size="sm" leftIcon={<RefreshCw />} onClick={() => setAttempt((value) => value + 1)}>
                  Try again
                </Button>
              </div>
            </StatGrid>
          ) : (
            <StatGrid columns={4}>
              <StatCard
                accent="bookings"
                icon={Zap}
                stat={{ label: 'Live automations', value: live.length, format: 'number', hint: 'Automations that are on and sending.' }}
                footer={
                  <span>
                    {statusCounts.draft} {statusCounts.draft === 1 ? 'draft' : 'drafts'} · {statusCounts.paused} paused
                  </span>
                }
              />
              <StatCard
                accent="guests"
                icon={Users}
                stat={{ label: 'Guests in automations now', value: kpis.inNow, format: 'number', hint: 'Guests waiting for a next step in a live automation.' }}
                footer={<span>Across {live.length} live {live.length === 1 ? 'automation' : 'automations'}</span>}
              />
              <StatCard
                accent="aov"
                icon={CalendarClock}
                stat={{ label: 'Due in the next 7 days', value: kpis.due, format: 'number', hint: 'Emails and texts your live automations will send this week.' }}
                footer={kpis.busiest ? <span>Busiest: {formatDateShort(`${kpis.busiest[0]}T12:00:00`)} · {n(kpis.busiest[1])}</span> : <span>Nothing due this week</span>}
              />
              <StatCard
                accent="revenue"
                icon={TrendingUp}
                stat={{
                  label: 'Bookings they brought',
                  value: kpis.bookings,
                  format: 'number',
                  hint: `Bookings made within ${conversionDays} days of a marketing message, over the last ${windowDays} days. Booking messages are not counted.`,
                }}
                footer={
                  <span>
                    <span className="font-medium text-foreground">{formatCurrency(kpis.revenue, currency)}</span> · last {windowDays} days
                  </span>
                }
              />
            </StatGrid>
          )}

          {/* ---------- filters ---------- */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div className="-mx-1 min-w-0 overflow-x-auto px-1 no-scrollbar">
                <Segmented options={statusOptions} value={status} onValueChange={setStatus} label="Status" size="md" className="min-w-max" />
              </div>
              <Select value={goal} onValueChange={(value) => setGoal(value as FlowGoal | 'all')}>
                <SelectTrigger aria-label="Goal" className="h-9 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Every goal</SelectItem>
                  {goalsInUse.map((meta) => (
                    <SelectItem key={meta.goal} value={meta.goal}>
                      {meta.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <SearchInput value={search} onValueChange={setSearch} debounceMs={0} label="Search automations" placeholder="Search automations" fieldClassName="w-full lg:w-72" />
          </div>

          {/* ---------- the list ---------- */}
          {flows.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface py-6">
              <EmptyState
                icon={Workflow}
                title="No automations yet"
                description="Start from a ready-made idea. Each one comes with the wording written and starts as a draft."
                action={<Button leftIcon={<Plus />} onClick={() => setGallery({ open: true, recipeId: null })}>Browse ideas</Button>}
              />
              <ul className="mx-auto mt-2 flex max-w-2xl list-none flex-wrap justify-center gap-2 p-0 px-4">
                {POPULAR.map((id) => {
                  const recipe = RECIPES.find((entry) => entry.id === id)
                  if (!recipe) return null
                  return (
                    <li key={id}>
                      <Button variant="secondary" size="sm" onClick={() => setGallery({ open: true, recipeId: id })}>
                        {recipe.name}
                      </Button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface py-6">
              <EmptyState
                variant="no-results"
                icon={Search}
                title="No automations match"
                description="Try another word, or clear the filters to see them all."
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="type-crm overflow-hidden rounded-2xl border border-line bg-surface">
              {/* Phones and narrow windows: one card per automation. */}
              <ul className="list-none divide-y divide-line-subtle p-0 lg:hidden">
                {shown.map((flow) => (
                  <FlowCard key={flow.id} {...rowProps(flow)} />
                ))}
              </ul>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[60rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line bg-surface-sunken/60">
                      <th className="px-4 py-2.5">Automation</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5 text-right">
                        <HeadHint label="In it now" hint="Guests waiting for the next step right now." />
                      </th>
                      <th className="px-4 py-2.5 text-right">
                        <HeadHint label="Sent" hint={`Emails and texts over the last ${windowDays} days.`} />
                      </th>
                      <th className="px-4 py-2.5 text-right">
                        <HeadHint label="Opened" hint="An estimate: inboxes do not always report opens." />
                      </th>
                      <th className="px-4 py-2.5 text-right">
                        <HeadHint label="Booked" hint={`Bookings made within ${conversionDays} days of a message. Marketing automations only.`} />
                      </th>
                      <th className="px-4 py-2.5 text-right">Revenue</th>
                      <th className="px-4 py-2.5">Updated</th>
                      <th className="w-12 px-2 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((flow) => (
                      <FlowRow key={flow.id} {...rowProps(flow)} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-col gap-2 border-t border-line-subtle px-4 py-3 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between">
                <p>
                  Numbers replay your last {windowDays} days of real bookings, so they are estimates, and opens are estimated. Bookings and revenue are
                  only counted for marketing automations. Grey numbers show what a draft or paused automation would have done if it had been on.
                </p>
                {runFailed ? (
                  <Button variant="ghost" size="xs" leftIcon={<RefreshCw />} onClick={() => setAttempt((value) => value + 1)}>
                    Couldn’t load the numbers. Try again
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          {/* ---------- this week ---------- */}
          <MessageCalendar flows={live} runs={runs} failed={runFailed && runs === null} nowIso={nowIso} onOpen={openFlow} marketingPaused={paused} />

          <p className="text-xs text-subtle">
            Quiet hours, the weekly limit and the unsubscribe footer are in{' '}
            <Link href="/dashboard/marketing/settings" className="font-medium text-primary hover:underline">
              Marketing settings
            </Link>
            . Designs you save are in{' '}
            <Link href="/dashboard/marketing/templates" className="font-medium text-primary hover:underline">
              Email templates
            </Link>
            .
          </p>
        </>
      ) : (
        <BookingMessages
          templates={bookingMessages}
          vars={ctx.vars}
          hasEdits={messages.hasEdits}
          onReset={() => {
            messages.reset()
            toast('Booking messages restored', { description: 'Back to the original wording and timing.' })
          }}
          onToggle={(template, enabled) => {
            messages.update(template.key, { enabled })
            toast(enabled ? `${template.name} is on` : `${template.name} is off`)
          }}
          onEdit={(template) => setEditingMessage({ ...template })}
          onCopy={copyAsAutomation}
        />
      )}

      {/* ---------- overlays ---------- */}
      <RecipeGallery
        open={gallery.open}
        onOpenChange={(open) => setGallery((current) => ({ open, recipeId: open ? current.recipeId : null }))}
        initialRecipeId={gallery.recipeId}
        activities={data.activities}
        business={tenantRecord.name}
        nowIso={nowIso}
        lookups={lookups}
        usedRecipeIds={usedRecipeIds}
        onStart={startFlow}
      />

      {editing ? (
        <FlowBuilder
          key={editing.flow.id}
          flow={editing.flow}
          isNew={editing.isNew}
          onClose={() => setEditing(null)}
          onSave={saveFlow}
          onDelete={
            !editing.isNew && !editing.flow.builtIn
              ? () => {
                  removeFlow(editing.flow)
                  setEditing(null)
                }
              : undefined
          }
          tenant={tenantRecord}
          data={data}
          sample={sample}
          nowIso={nowIso}
        />
      ) : null}

      {editingMessage ? (
        <AutomationEditor
          template={editingMessage}
          ctx={ctx}
          brand={brand}
          savedTemplates={marketing.emailTemplates}
          onSaveTemplate={(name, design) => {
            marketing.saveEmailTemplate({ id: `tpl_${Date.now().toString(36)}`, name, design, updatedAt: new Date().toISOString() })
            toast.success(`${name} saved to Email templates`)
          }}
          activities={data.activities}
          onClose={() => setEditingMessage(null)}
          onCopyAsAutomation={copyAsAutomation}
          onSave={(draft) => {
            messages.update(draft.key, draft)
            toast.success(`${draft.name} saved`)
            setEditingMessage(null)
          }}
        />
      ) : null}

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              Nothing more goes out from it, and guests waiting in it stop where they are. This cannot be undone. To stop it for now, pause it instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {deleting && deleting.status === 'live' ? (
              <Button
                variant="ghost"
                onClick={() => {
                  pause(deleting)
                  setDeleting(null)
                }}
              >
                Pause instead
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
            )}
            <Button variant="danger" leftIcon={<Trash2 />} onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ==========================================================================
   One row of the list
   ========================================================================== */

function HeadHint({ label, hint }: { label: string; hint: string }) {
  return (
    <SimpleTooltip label={hint}>
      <span tabIndex={0} className="cursor-help underline decoration-line-strong decoration-dotted underline-offset-4">
        {label}
      </span>
    </SimpleTooltip>
  )
}

const STATUS_DOT: Record<FlowStatus, string> = { live: 'bg-success', paused: 'bg-warning', draft: 'bg-line-strong' }

interface FlowRowProps {
  flow: Flow
  stats: RowStats | null
  loading: boolean
  trigger: string
  currency: Tenant['currency']
  windowDays: number
  conversionDays: number
  marketingPaused: boolean
  onOpen: () => void
  onTurnOn: () => void
  onPause: () => void
  onDuplicate: () => void
  onDelete?: () => void
}

/** What a row says about itself, shared by the table and the cards. */
function rowParts({ flow, stats, loading, windowDays, marketingPaused }: FlowRowProps) {
  const isLive = flow.status === 'live'
  const held = isLive && flow.purpose === 'marketing' && marketingPaused
  // Not on: the numbers say what it would have done, so they read quieter.
  const estimate = !isLive
  const title = estimate ? `What it would have done over the last ${windowDays} days if it had been on` : undefined
  const dash = <span className="text-faint">—</span>
  const cell = (value: React.ReactNode) => (loading ? <Skeleton className="ml-auto h-4 w-10 rounded" /> : stats === null ? dash : value)
  return { isLive, held, estimate, title, dash, cell }
}

function FlowStatusSwitch({ flow, isLive, held, onTurnOn, onPause }: { flow: Flow; isLive: boolean; held: boolean; onTurnOn: () => void; onPause: () => void }) {
  return (
    <div className="flex items-center gap-2.5">
      <Switch checked={isLive} onCheckedChange={(checked) => (checked ? onTurnOn() : onPause())} aria-label={isLive ? `Pause ${flow.name}` : `Turn on ${flow.name}`} size="sm" />
      <span className="inline-flex items-center gap-1.5 text-sm text-muted">
        <span aria-hidden="true" className={cn('size-1.5 rounded-full', held ? 'bg-warning' : STATUS_DOT[flow.status])} />
        {held ? 'On hold' : STATUS_LABEL[flow.status]}
      </span>
    </div>
  )
}

function FlowMenu({
  flow,
  isLive,
  onOpen,
  onTurnOn,
  onPause,
  onDuplicate,
  onDelete,
}: Pick<FlowRowProps, 'flow' | 'onOpen' | 'onTurnOn' | 'onPause' | 'onDuplicate' | 'onDelete'> & { isLive: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton aria-label={`More for ${flow.name}`} variant="ghost" size="sm">
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={onOpen}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onDuplicate}>
          <Copy /> Duplicate
        </DropdownMenuItem>
        {isLive ? (
          <DropdownMenuItem onSelect={onPause}>
            <Pause /> Pause
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={onTurnOn}>
            <Play /> {flow.status === 'paused' ? 'Resume' : 'Turn on'}
          </DropdownMenuItem>
        )}
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

function FlowTitle({ flow, trigger, onOpen }: { flow: Flow; trigger: string; onOpen: () => void }) {
  const meta = triggerMeta(flow.trigger.type)
  return (
    <div className="flex min-w-0 items-start gap-3">
      <span aria-hidden="true" className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle">
        <FlowIcon name={meta.icon} className="size-4" />
      </span>
      <div className="min-w-0">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpen()
          }}
          className="block max-w-full truncate text-left font-medium text-foreground hover:underline"
        >
          {flow.name}
        </button>
        <p className="mt-0.5 line-clamp-2 text-xs text-subtle">
          {trigger}
          <span className="text-faint"> · </span>
          {PURPOSE_LABEL[flow.purpose]}
          {flow.builtIn ? (
            <>
              <span className="text-faint"> · </span>
              Built in
            </>
          ) : null}
        </p>
      </div>
    </div>
  )
}

function FlowRow(props: FlowRowProps) {
  const { flow, stats, trigger, currency, conversionDays, onOpen, onTurnOn, onPause, onDuplicate, onDelete } = props
  const { isLive, held, estimate, title, dash, cell } = rowParts(props)
  const numberClass = cn('px-4 py-3 text-right tabular-nums', estimate ? 'text-faint' : 'text-foreground')
  const booking = flow.purpose === 'booking'

  return (
    <tr className="cursor-pointer border-b border-line-subtle transition-colors last:border-0 hover:bg-surface-sunken/60" onClick={onOpen}>
      <td className="max-w-[26rem] px-4 py-3">
        <FlowTitle flow={flow} trigger={trigger} onOpen={onOpen} />
      </td>
      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
        <FlowStatusSwitch flow={flow} isLive={isLive} held={held} onTurnOn={onTurnOn} onPause={onPause} />
      </td>
      <td className={numberClass} title={title}>
        {cell(isLive ? n(stats?.inNow ?? 0) : dash)}
      </td>
      <td className={numberClass} title={title}>
        {cell(n(stats?.sent ?? 0))}
      </td>
      <td className={numberClass} title={title}>
        {cell(stats?.openRate == null ? dash : `${Math.round(stats.openRate * 100)}%`)}
      </td>
      <td
        className={numberClass}
        title={booking ? 'Booking messages go to guests who already booked, so they are not credited with bookings.' : (title ?? `Bookings made within ${conversionDays} days of a message.`)}
      >
        {cell(stats?.booked == null ? dash : n(stats.booked))}
      </td>
      <td className={numberClass} title={booking ? 'Not counted for booking messages.' : title}>
        {cell(stats?.revenue == null ? dash : formatCurrency(stats.revenue, currency))}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateShort(flow.updatedAt)}</td>
      <td className="px-2 py-3" onClick={(event) => event.stopPropagation()}>
        <FlowMenu flow={flow} isLive={isLive} onOpen={onOpen} onTurnOn={onTurnOn} onPause={onPause} onDuplicate={onDuplicate} onDelete={onDelete} />
      </td>
    </tr>
  )
}

function FlowCard(props: FlowRowProps) {
  const { flow, stats, trigger, currency, onOpen, onTurnOn, onPause, onDuplicate, onDelete } = props
  const { isLive, held, estimate, dash, cell } = rowParts(props)
  const figures: { label: string; value: React.ReactNode }[] = [
    { label: 'In it now', value: cell(isLive ? n(stats?.inNow ?? 0) : dash) },
    { label: 'Sent', value: cell(n(stats?.sent ?? 0)) },
    flow.purpose === 'marketing'
      ? { label: 'Booked', value: cell(stats?.booked == null ? dash : `${n(stats.booked)} · ${formatCurrency(stats.revenue ?? 0, currency)}`) }
      : { label: 'Opened', value: cell(stats?.openRate == null ? dash : `${Math.round(stats.openRate * 100)}%`) },
  ]
  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <FlowTitle flow={flow} trigger={trigger} onOpen={onOpen} />
        <FlowMenu flow={flow} isLive={isLive} onOpen={onOpen} onTurnOn={onTurnOn} onPause={onPause} onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 sm:pl-12">
        <FlowStatusSwitch flow={flow} isLive={isLive} held={held} onTurnOn={onTurnOn} onPause={onPause} />
        <dl className={cn('flex gap-5 text-sm tabular-nums', estimate ? 'text-faint' : 'text-foreground')}>
          {figures.map((figure) => (
            <div key={figure.label} className="flex flex-col items-end">
              <dt className="text-xs text-subtle">{figure.label}</dt>
              <dd className="font-medium">{figure.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </li>
  )
}

/* ==========================================================================
   Booking messages
   ========================================================================== */

function BookingMessages({
  templates,
  vars,
  hasEdits,
  onReset,
  onToggle,
  onEdit,
  onCopy,
}: {
  templates: MessageTemplate[]
  vars: Record<string, string | undefined>
  hasEdits: boolean
  onReset: () => void
  onToggle: (template: MessageTemplate, enabled: boolean) => void
  onEdit: (template: MessageTemplate) => void
  onCopy: (template: MessageTemplate) => void
}) {
  const on = templates.filter((template) => template.enabled).length
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-base font-semibold text-foreground">Messages every booking gets</h2>
          <p className="mt-0.5 text-sm text-muted">
            Confirmations, reminders, balances and the thank-you after. They go to every guest of a booking, subscribed or not, because they are about their
            trip or visit. {on} of {templates.length} are on.
          </p>
        </div>
        {hasEdits ? (
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={onReset}>
            Restore defaults
          </Button>
        ) : null}
      </div>

      <div className="type-crm overflow-hidden rounded-2xl border border-line bg-surface">
        {/* Phones: one card per message. */}
        <ul className="list-none divide-y divide-line-subtle p-0 md:hidden">
          {templates.map((template) => {
            const staff = isStaffSent(template)
            return (
              <li key={template.key} className="flex items-start gap-3 px-4 py-4">
                <span aria-hidden="true" className={cn('mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle', !template.enabled && 'opacity-60')}>
                  {template.channel === 'sms' ? <MessageSquareText className="size-4" /> : <Mail className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => onEdit(template)} className={cn('block max-w-full truncate text-left font-medium hover:underline', template.enabled ? 'text-foreground' : 'text-muted')}>
                    {template.name}
                  </button>
                  <p className="mt-0.5 text-xs text-subtle">
                    {staff ? 'Sent by your team' : timingLabel(template.timing)} · {CHANNEL_LABEL[template.channel]}
                  </p>
                </div>
                <Switch checked={template.enabled} onCheckedChange={(checked) => onToggle(template, checked)} aria-label={`${template.name} on`} size="sm" className="mt-1" />
              </li>
            )
          })}
        </ul>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[46rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line bg-surface-sunken/60">
                <th className="px-4 py-2.5">Message</th>
                <th className="px-4 py-2.5">When it goes</th>
                <th className="px-4 py-2.5">Sent as</th>
                <th className="px-4 py-2.5">On</th>
                <th className="w-32 px-4 py-2.5">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {templates.map((template) => {
                const staff = isStaffSent(template)
                return (
                  <tr key={template.key} className="cursor-pointer border-b border-line-subtle transition-colors last:border-0 hover:bg-surface-sunken/60" onClick={() => onEdit(template)}>
                    <td className="max-w-[28rem] px-4 py-3">
                      <div className="flex items-start gap-3">
                        <span aria-hidden="true" className={cn('mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle', !template.enabled && 'opacity-60')}>
                          {template.channel === 'sms' ? <MessageSquareText className="size-4" /> : <Mail className="size-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className={cn('truncate font-medium', template.enabled ? 'text-foreground' : 'text-muted')}>{template.name}</p>
                          <p className="mt-0.5 line-clamp-1 text-xs text-subtle">{renderTemplate(template.channel === 'sms' ? template.body : template.subject, vars as Partial<MessageContext>)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">
                      {staff ? (
                        <Badge variant="neutral" size="sm">
                          Sent by your team
                        </Badge>
                      ) : (
                        timingLabel(template.timing)
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{CHANNEL_LABEL[template.channel]}</td>
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <Switch checked={template.enabled} onCheckedChange={(checked) => onToggle(template, checked)} aria-label={`${template.name} on`} size="sm" />
                    </td>
                    <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => onEdit(template)}>
                          Edit
                        </Button>
                        {staff ? null : (
                          <SimpleTooltip label="Copy as an automation, to add follow-ups or checks">
                            <IconButton aria-label={`Copy ${template.name} as an automation`} variant="ghost" size="sm" onClick={() => onCopy(template)}>
                              <Copy />
                            </IconButton>
                          </SimpleTooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-subtle">
        Want a follow-up, a check first, or a message for some guests only? Copy a message as an automation, or start one from{' '}
        <span className="font-medium text-foreground">New automation</span>.
      </p>
    </div>
  )
}
