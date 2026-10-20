'use client'

import * as React from 'react'
import Link from 'next/link'
import { Copy, Inbox, Mail, MessageSquareText, MoreHorizontal, Pause, Pencil, Play, Plus, RotateCcw, Trash2, Workflow } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { IconButton } from '@/components/ui/icon-button'
import { Segmented, type SegmentedOption } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toaster'
import { AutomationEditor, isStaffSent } from '@/components/dashboard/marketing/automation-editor'
import { FlowBuilder } from '@/components/dashboard/marketing/flow-builder'
import { FlowIcon } from '@/components/dashboard/marketing/flow-builder/icons'
import { SimpleEditor } from '@/components/dashboard/marketing/simple-editor'
import { useChannels } from '@/hooks/use-channels'
import { brandColors, useEmailContext } from '@/hooks/use-email-context'
import { useFlows } from '@/hooks/use-flows'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { useMessageTemplates } from '@/hooks/use-message-templates'
import { usePricing } from '@/hooks/use-pricing'
import { runFlows } from '@/lib/actions/flows'
import { textingNumber } from '@/lib/channels'
import type { MarketingBasics } from '@/lib/data/guest-marketing'
import { triggerMeta } from '@/lib/flows/catalog'
import { canGoLive, checkFlow } from '@/lib/flows/check'
import { flowFromTemplate } from '@/lib/flows/defaults'
import { describeTrigger, type DescribeLookups } from '@/lib/flows/describe'
import type { FlowExtras } from '@/lib/flows/engine'
import { syncFlowPromos } from '@/lib/flows/promos'
import { blankSimpleFlow, toSimple } from '@/lib/flows/simple'
import { AUTOMATION_TEMPLATES, templateById, type AutomationTemplate } from '@/lib/flows/templates'
import { forSimulation, simulationKey } from '@/lib/flows/tree'
import type { Flow, FlowRun } from '@/lib/flows/types'
import { CHANNEL_LABEL, groupOf, renderTemplate, timingLabel, type MessageContext, type MessageTemplate } from '@/lib/messaging'
import { cn, formatCurrency } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   AUTOMATIONS
   Two views. "Automations": the ones that run on their own, each with a
   switch, plus ready-made ones to add in a click. Each opens in a short
   one-screen form; anything more is under "More options". "Booking
   messages": the confirmation, reminders and the rest every booking gets.
   ========================================================================== */

type RunMap = Record<string, Omit<FlowRun, 'journeys'>>
type View = 'flows' | 'booking'
type Editing = { flow: Flow; isNew: boolean; mode: 'simple' | 'advanced' }

const STATUS_ORDER: Record<Flow['status'], number> = { live: 0, paused: 1, draft: 2 }
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
  data: MarketingBasics
  sample: MessageContext
  /** Add this template (from ?recipe=). */
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
  const pricing = usePricing(tenantRecord.slug)
  const paused = marketing.settings.paused

  const [view, setView] = React.useState<View>('flows')
  const [picking, setPicking] = React.useState(false)
  const [editing, setEditing] = React.useState<Editing | null>(null)
  const [editingMessage, setEditingMessage] = React.useState<MessageTemplate | null>(null)
  const [deleting, setDeleting] = React.useState<Flow | null>(null)
  const [confirmRestore, setConfirmRestore] = React.useState(false)

  const flows = store.flows
  const lookups = React.useMemo<DescribeLookups>(() => ({ activities: data.activities, audiences: marketing.audiences, currency }), [data.activities, marketing.audiences, currency])
  const checkCtx = React.useMemo(
    () => ({ audiences: marketing.audiences, activities: data.activities, hasSmsNumber, marketingPaused: paused, currency }),
    [marketing.audiences, data.activities, hasSmsNumber, paused, currency],
  )

  /* ---------- automation codes in Promo codes ---------- */

  // The codes automations give out only work at checkout through Promo codes: kept in line on every change.
  const promoRef = React.useRef(pricing)
  promoRef.current = pricing
  const syncPromos = React.useCallback((list: Flow[], reactivate: boolean) => {
    const current = promoRef.current
    const next = syncFlowPromos(current.promos, list, { reactivate })
    if (next !== current.promos) current.setPromos(next)
  }, [])
  const flowsRef = React.useRef(flows)
  flowsRef.current = flows
  React.useEffect(() => {
    const timer = window.setTimeout(() => syncPromos(flowsRef.current, false), 0)
    return () => window.clearTimeout(timer)
  }, [flows, syncPromos])

  /* ---------- numbers ---------- */

  const extras = React.useMemo<FlowExtras>(
    () => ({
      signups: marketing.signups.map((signup) => ({ email: signup.email, phone: signup.phone, source: signup.source, at: signup.at })),
      settings: { paused: marketing.settings.paused, quietHours: marketing.settings.quietHours, frequencyCap: marketing.settings.frequencyCap, skipUpcoming: marketing.settings.skipUpcoming },
      audiences: marketing.audiences,
      nowIso,
    }),
    [marketing.signups, marketing.settings, marketing.audiences, nowIso],
  )
  const runKey = React.useMemo(() => JSON.stringify([simulationKey(flows), extras]), [flows, extras])
  const latest = React.useRef({ flows, extras })
  latest.current = { flows, extras }
  const [runs, setRuns] = React.useState<RunMap | null>(null)
  const editorOpen = editing !== null
  React.useEffect(() => {
    if (editorOpen) return
    let alive = true
    const timer = window.setTimeout(() => {
      runFlows(tenantRecord.id, latest.current.flows.map(forSimulation), latest.current.extras)
        .then((result) => alive && setRuns(result))
        .catch(() => alive && setRuns({}))
    }, 400)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [tenantRecord.id, runKey, editorOpen])

  /* ---------- actions ---------- */

  const storeRef = React.useRef(store)
  storeRef.current = store

  const withFlow = (flow: Flow) => {
    const list = storeRef.current.flows
    return list.some((entry) => entry.id === flow.id) ? list.map((entry) => (entry.id === flow.id ? flow : entry)) : [flow, ...list]
  }

  /** Simple when it fits the short form; the full builder otherwise. */
  const open = (flow: Flow, isNew = false) => setEditing({ flow, isNew, mode: toSimple(flow) ? 'simple' : 'advanced' })

  const addTemplate = (template: AutomationTemplate) => {
    setPicking(false)
    open(template.build(nowIso), true)
  }

  // ?recipe= adds that template, ?flow= opens that automation (the saved list lands just after the first paint).
  const linked = React.useRef(false)
  React.useEffect(() => {
    if (linked.current || (!initialRecipe && !initialFlow)) return
    const timer = window.setTimeout(() => {
      linked.current = true
      const template = initialRecipe ? templateById(initialRecipe) : undefined
      const flow = initialFlow ? latest.current.flows.find((entry) => entry.id === initialFlow) : undefined
      if (template) setEditing({ flow: template.build(nowIso), isNew: true, mode: 'simple' })
      else if (flow) setEditing({ flow, isNew: false, mode: toSimple(flow) ? 'simple' : 'advanced' })
      else if (initialRecipe) setPicking(true)
      try {
        window.history.replaceState(window.history.state, '', window.location.pathname)
      } catch {
        /* the address stays as it is */
      }
    }, 0)
    return () => window.clearTimeout(timer)
  }, [initialRecipe, initialFlow, nowIso])

  const turnOn = (flow: Flow) => {
    const issues = checkFlow(flow, checkCtx)
    if (!canGoLive(issues)) {
      toast.error(`${flow.name} needs one thing first`, { description: issues.find((issue) => issue.severity === 'blocker')?.text })
      open(flow)
      return
    }
    if (!store.setStatus(flow.id, 'live')) return
    syncPromos(withFlow({ ...flow, status: 'live' }), true)
    toast.success(`${flow.name} is on`)
  }

  const pause = (flow: Flow) => {
    if (!store.setStatus(flow.id, 'paused')) return
    syncPromos(withFlow({ ...flow, status: 'paused' }), false)
    toast(`${flow.name} is off`)
  }

  const duplicate = (flow: Flow) => {
    const copy = store.duplicate(flow.id)
    if (copy) toast.success(`Copied as “${copy.name}”`, { action: { label: 'Open', onClick: () => open(copy) } })
  }

  const removeFlow = (flow: Flow) => {
    const saved = storeRef.current.byId(flow.id) ?? flow
    storeRef.current.remove(flow.id)
    syncPromos(
      storeRef.current.flows.filter((entry) => entry.id !== flow.id),
      false,
    )
    toast(`${saved.name} deleted`, {
      action: { label: 'Undo', onClick: () => storeRef.current.create(saved) && syncPromos([saved, ...storeRef.current.flows.filter((entry) => entry.id !== saved.id)], true) },
    })
  }

  const saveFlow = (flow: Flow, what: string): boolean => {
    const current = storeRef.current
    const ok = current.byId(flow.id) ? current.save(flow, what) : current.create({ ...flow, history: [{ at: nowIso, what }, ...(flow.history ?? [])].slice(0, 20) })
    if (!ok) return false
    syncPromos(withFlow(flow), true)
    setEditing((now) => (now && now.isNew && now.flow.id === flow.id ? { ...now, isNew: false } : now))
    return true
  }

  /** A booking message copied into an automation of its own, to add a follow-up or an "only if". */
  const copyAsAutomation = (template: MessageTemplate) => {
    const base = flowFromTemplate({ ...template, key: `custom_${Date.now().toString(36)}`, group: 'booking' }, { nowIso, activities: data.activities })
    const flow: Flow = { ...base, name: `${template.name} (copy)`, purpose: 'booking', status: 'draft', builtIn: false, history: [{ at: nowIso, what: `Copied from “${template.name}”` }] }
    setEditingMessage(null)
    setView('flows')
    open(flow, true)
    if (template.enabled) toast(`“${template.name}” is still on`, { description: 'Turn the original off once the copy is on, or guests get both.' })
  }

  /* ---------- lists ---------- */

  const sorted = React.useMemo(() => [...flows].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name)), [flows])
  const added = React.useMemo(() => new Set(flows.map((flow) => flow.recipeId).filter(Boolean)), [flows])
  const templates = AUTOMATION_TEMPLATES.filter((template) => !added.has(template.id))
  const bookingMessages = React.useMemo(() => messages.templates.filter((template) => !template.custom && groupOf(template) === 'booking'), [messages.templates])
  const viewOptions: SegmentedOption<View>[] = [
    { value: 'flows', label: 'Automations', icon: Workflow, count: flows.length },
    { value: 'booking', label: 'Booking messages', icon: Inbox, count: bookingMessages.length },
  ]

  const simple = editing && editing.mode === 'simple' ? toSimple(editing.flow) : null

  return (
    <div className="flex flex-col gap-6">
      {paused ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-soft px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Pause className="size-4 text-warning" aria-hidden="true" />
            Marketing is paused. Booking messages still go.
          </p>
          <Button asChild size="sm" variant="secondary" leftIcon={<Play />}>
            <Link href="/dashboard/marketing/settings">Resume</Link>
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-1 min-w-0 overflow-x-auto px-1 no-scrollbar">
          <Segmented options={viewOptions} value={view} onValueChange={setView} label="Automations views" size="md" className="min-w-max" />
        </div>
        {view === 'flows' ? (
          <Button leftIcon={<Plus />} onClick={() => setPicking(true)}>
            New automation
          </Button>
        ) : null}
      </div>

      {view === 'flows' ? (
        <>
          <ul className="type-crm flex list-none flex-col divide-y divide-line-subtle overflow-hidden rounded-2xl border border-line bg-surface p-0">
            {sorted.map((flow) => (
              <FlowRow
                key={flow.id}
                flow={flow}
                trigger={describeTrigger(flow.trigger, lookups)}
                run={runs?.[flow.id]}
                loading={runs === null}
                currency={currency}
                onOpen={() => open(flow)}
                onTurnOn={() => turnOn(flow)}
                onPause={() => pause(flow)}
                onDuplicate={() => duplicate(flow)}
                onDelete={flow.builtIn ? undefined : () => setDeleting(flow)}
              />
            ))}
          </ul>

          {templates.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Ready to add</h2>
                <p className="mt-0.5 text-sm text-muted">Written and timed. Add one, change a word if you like, turn it on.</p>
              </div>
              <TemplateGrid templates={templates} onPick={addTemplate} />
            </section>
          ) : null}
        </>
      ) : (
        <BookingMessages
          templates={bookingMessages}
          vars={ctx.vars}
          hasEdits={messages.editedOf(bookingMessages.map((template) => template.key)).length > 0}
          onReset={() => setConfirmRestore(true)}
          onToggle={(template, enabled) => {
            messages.update(template.key, { enabled })
            toast(enabled ? `${template.name} is on` : `${template.name} is off`)
          }}
          onEdit={(template) => setEditingMessage({ ...template })}
          onCopy={copyAsAutomation}
        />
      )}

      {/* ---------- new automation ---------- */}
      <Dialog open={picking} onOpenChange={setPicking}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>New automation</DialogTitle>
            <DialogDescription>Pick one that is ready to go, or start with a blank one.</DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[60dvh] flex-col gap-3 overflow-y-auto px-6 pb-2">
            <button
              type="button"
              onClick={() => {
                setPicking(false)
                open(blankSimpleFlow(nowIso), true)
              }}
              className="flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-4 py-3.5 text-left transition-colors hover:border-primary hover:bg-primary-soft/40 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-surface-sunken text-subtle">
                <Plus className="size-4" />
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">Start blank</span>
                <span className="block text-xs text-subtle">Pick when it sends and write the message.</span>
              </span>
            </button>
            {templates.length > 0 ? <TemplateGrid templates={templates} onPick={addTemplate} compact /> : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- editors ---------- */}
      {editing && editing.mode === 'simple' && simple ? (
        <SimpleEditor
          key={editing.flow.id}
          flow={editing.flow}
          simple={simple}
          isNew={editing.isNew}
          activities={data.activities}
          ctx={ctx}
          brand={brand}
          savedTemplates={marketing.emailTemplates}
          onSaveTemplate={(name, design) => {
            marketing.saveEmailTemplate({ id: `tpl_${Date.now().toString(36)}`, name, design, updatedAt: nowIso })
            toast.success(`${name} saved to Email templates`)
          }}
          checkContext={checkCtx}
          onSave={saveFlow}
          onClose={() => setEditing(null)}
          onDelete={
            !editing.isNew && !editing.flow.builtIn
              ? () => {
                  setDeleting(editing.flow)
                  setEditing(null)
                }
              : undefined
          }
          onAdvanced={(flow) => setEditing({ flow, isNew: editing.isNew, mode: 'advanced' })}
        />
      ) : null}

      {editing && (editing.mode === 'advanced' || !simple) ? (
        <FlowBuilder
          key={`${editing.flow.id}-advanced`}
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
            marketing.saveEmailTemplate({ id: `tpl_${Date.now().toString(36)}`, name, design, updatedAt: nowIso })
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

      <Dialog open={confirmRestore} onOpenChange={setConfirmRestore}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Restore all booking messages?</DialogTitle>
            <DialogDescription>Their wording, timing and on or off go back to the originals. Your automations stay as they are.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmRestore(false)}>
              Keep my changes
            </Button>
            <Button
              variant="danger"
              leftIcon={<RotateCcw />}
              onClick={() => {
                setConfirmRestore(false)
                const removed = messages.reset(bookingMessages.map((template) => template.key))
                toast('Booking messages restored', { action: { label: 'Undo', onClick: () => messages.restore(removed) } })
              }}
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(value) => !value && setDeleting(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>Nothing more goes out from it. To stop it for now, turn it off instead.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              leftIcon={<Trash2 />}
              onClick={() => {
                if (deleting) removeFlow(deleting)
                setDeleting(null)
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ==========================================================================
   One automation in the list
   ========================================================================== */

function FlowRow({
  flow,
  trigger,
  run,
  loading,
  currency,
  onOpen,
  onTurnOn,
  onPause,
  onDuplicate,
  onDelete,
}: {
  flow: Flow
  trigger: string
  run: Omit<FlowRun, 'journeys'> | undefined
  loading: boolean
  currency: Tenant['currency']
  onOpen: () => void
  onTurnOn: () => void
  onPause: () => void
  onDuplicate: () => void
  onDelete?: () => void
}) {
  const live = flow.status === 'live'
  const meta = triggerMeta(flow.trigger.type)
  // Booking messages go to guests who already booked: bookings after them are not credited.
  const figure = !run
    ? null
    : flow.purpose === 'marketing' && run.bookings > 0
      ? `${n(run.messages)} sent · ${n(run.bookings)} booked · ${formatCurrency(run.revenue, currency)}`
      : `${n(run.messages)} sent`
  return (
    <li className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-sunken/50 sm:px-5">
      <span aria-hidden="true" className={cn('grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle', !live && 'opacity-60')}>
        <FlowIcon name={meta.icon} className="size-4" />
      </span>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        <span className={cn('block truncate font-medium', live ? 'text-foreground' : 'text-muted')}>{flow.name}</span>
        <span className="block truncate text-xs text-subtle">{trigger}</span>
      </button>
      <span className={cn('hidden shrink-0 text-right text-sm tabular-nums sm:block', live ? 'text-muted' : 'text-faint')}>
        {loading ? <Skeleton className="h-4 w-28 rounded" /> : (figure ?? '')}
        {!live && !loading && run ? <span className="block text-xs">if it were on, last 60 days</span> : live && !loading && run ? <span className="block text-xs text-subtle">last 60 days</span> : null}
      </span>
      <Switch checked={live} onCheckedChange={(checked) => (checked ? onTurnOn() : onPause())} aria-label={live ? `Turn off ${flow.name}` : `Turn on ${flow.name}`} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton aria-label={`More for ${flow.name}`} variant="ghost" size="sm">
            <MoreHorizontal />
          </IconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onOpen}>
            <Pencil /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onDuplicate}>
            <Copy /> Duplicate
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
    </li>
  )
}

/* ==========================================================================
   Ready-made automations
   ========================================================================== */

function TemplateGrid({ templates, onPick, compact = false }: { templates: AutomationTemplate[]; onPick: (template: AutomationTemplate) => void; compact?: boolean }) {
  return (
    <ul className={cn('grid list-none gap-3 p-0', compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-3')}>
      {templates.map((template) => (
        <li key={template.id}>
          <button
            type="button"
            onClick={() => onPick(template)}
            className="group flex h-full w-full items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 text-left transition-colors hover:border-primary hover:bg-primary-soft/30 focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle group-hover:text-primary">
              <FlowIcon name={template.icon} className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{template.name}</span>
                <span className="text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">Add</span>
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-subtle">{template.blurb}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
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
          <p className="mt-0.5 text-sm text-muted">They go to every guest who books. {on} of {templates.length} are on.</p>
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
    </div>
  )
}
