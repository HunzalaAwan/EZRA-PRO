'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ChevronDown, ChevronUp, CircleAlert, Pause, Play, Redo2, Stethoscope, Undo2, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { Kbd } from '@/components/ui/kbd'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toaster'
import { useChannels } from '@/hooks/use-channels'
import { brandColors, useEmailContext } from '@/hooks/use-email-context'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { runFlow, type FlowExtras } from '@/lib/actions/flows'
import { textingNumber } from '@/lib/channels'
import type { MarketingData } from '@/lib/data/guest-marketing'
import { STATUS_LABEL, newStep } from '@/lib/flows/catalog'
import { canGoLive, checkFlow, issueCounts } from '@/lib/flows/check'
import { describeFlow, type DescribeLookups } from '@/lib/flows/describe'
import { countSteps, duplicateStep, findStep, insertStep, isParent, moveStep, removeStep, walkSteps, type StepPosition } from '@/lib/flows/tree'
import type { ActionStep, Flow, FlowAction, FlowIssue, FlowRun, FlowStepType } from '@/lib/flows/types'
import type { MessageContext } from '@/lib/messaging'
import { cn, formatCurrency } from '@/lib/utils'
import type { Tenant } from '@/types'

import { Canvas, type Selection, type Severity } from './canvas'
import type { ConditionData } from './condition-builder'
import { GuestPreview } from './guest-preview'
import { HealthPanel } from './health-panel'
import { useHistory } from './history'
import { InspectorBody, PanelFrame, StepActions, panelHead, type InspectorTools } from './inspector'
import type { EmailTools } from './step-editors'

export { ConditionBuilder, type ConditionBuilderProps, type ConditionData } from './condition-builder'
export { TriggerList, TriggerPicker, TriggerSettings } from './trigger-picker'

/* ==========================================================================
   FLOW BUILDER
   One automation, full screen. A plain summary at the top, the steps as a
   calm single column in the middle, and a panel on the right (a bottom
   sheet on phones) for whatever is selected. Numbers come from replaying
   the business's real bookings; a health check stands between the draft
   and "Turn on"; "Preview as a guest" walks one real guest through it.
   ========================================================================== */

export interface FlowBuilderProps {
  flow: Flow
  isNew: boolean
  onClose: () => void
  /** Save the automation. `what` says what changed, for its history. The builder stays open. */
  onSave: (flow: Flow, what: string) => void
  onDelete?: () => void
  tenant: Tenant
  data: MarketingData
  sample: MessageContext
  nowIso: string
}

type Area = 'trigger' | 'who' | 'exit' | 'settings'

const AREA_LABEL: Record<Area, string> = {
  trigger: 'Go to “Starts when”',
  who: 'Go to “Who can enter”',
  exit: 'Go to “Ends early when”',
  settings: 'Open more settings',
}

const SETTINGS_CODES = /^(holdout-high|conversion-days|reentry-days|reentry-often|tip-holdout|tip-quiet-hours|tip-smart-sending)/

/** Which card an issue without a step belongs to. */
function areaOf(issue: FlowIssue): Area | null {
  if (issue.stepId) return null
  if (/^(trigger-|purpose-|marketing-paused)/.test(issue.id)) return 'trigger'
  if (issue.id.startsWith('condition-')) return 'who'
  if (issue.id.startsWith('exit-')) return 'exit'
  if (SETTINGS_CODES.test(issue.id)) return 'settings'
  return null
}

/** The "Go to" button for an issue, or null when it isn't about one place. */
function goLabel(issue: FlowIssue): string | null {
  if (issue.stepId) return 'Go to step'
  const area = areaOf(issue)
  return area ? AREA_LABEL[area] : null
}

const RANK: Record<Severity, number> = { blocker: 3, warning: 2, tip: 1 }

const SUMMARY_KEY = 'ezra:flow-builder:summary'

function useWide() {
  return React.useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia('(min-width: 1024px)')
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => true,
  )
}

/** What changed since the last save, for the automation's history. */
function whatChanged(before: Flow, after: Flow): string {
  const parts: string[] = []
  if (before.name !== after.name) parts.push('Renamed it')
  if (JSON.stringify(before.trigger) !== JSON.stringify(after.trigger)) parts.push('Changed when it starts')
  if (before.purpose !== after.purpose || JSON.stringify(before.who) !== JSON.stringify(after.who)) parts.push('Changed who can enter')
  if (JSON.stringify(before.steps) !== JSON.stringify(after.steps)) {
    const ids = (flow: Flow) => {
      const map = new Map<string, string>()
      walkSteps(flow.steps, (step) => {
        map.set(step.id, JSON.stringify(isParent(step) ? { ...step, yes: [], no: [], a: [], b: [] } : step))
      })
      return map
    }
    const a = ids(before)
    const b = ids(after)
    const added = [...b.keys()].filter((id) => !a.has(id)).length
    const removed = [...a.keys()].filter((id) => !b.has(id)).length
    const changed = [...b.keys()].filter((id) => a.has(id) && a.get(id) !== b.get(id))
    if (added) parts.push(added === 1 ? 'Added a step' : `Added ${added} steps`)
    if (removed) parts.push(removed === 1 ? 'Removed a step' : `Removed ${removed} steps`)
    if (changed.length === 1) {
      const step = findStep(after.steps, changed[0])
      parts.push(step?.type === 'email' ? 'Changed an email' : step?.type === 'sms' ? 'Changed a text' : step?.type === 'wait' ? 'Changed a wait' : 'Changed a step')
    } else if (changed.length > 1) parts.push(`Changed ${changed.length} steps`)
    if (!added && !removed && changed.length === 0) parts.push('Moved steps around')
  }
  if (JSON.stringify(before.exit) !== JSON.stringify(after.exit)) parts.push('Changed when it ends early')
  if (JSON.stringify(before.settings) !== JSON.stringify(after.settings)) parts.push('Changed the settings')
  if (before.description !== after.description) parts.push('Changed what it is for')
  if (parts.length === 0) return 'Saved'
  if (parts.length <= 2) return parts.join(' and ').replace(/ and (\w)/, (_, c: string) => ` and ${c.toLowerCase()}`)
  return `${parts[0]}, ${parts[1].charAt(0).toLowerCase()}${parts[1].slice(1)} and more`
}

export function FlowBuilder({ flow: initial, isNew, onClose, onSave, onDelete, tenant, data, sample, nowIso }: FlowBuilderProps) {
  const history = useHistory(initial)
  const draft = history.present
  const { set: setDraft, undo, redo, rebase } = history
  const [baseline, setBaseline] = React.useState(initial)
  const [saved, setSaved] = React.useState(!isNew)
  const [selection, setSelection] = React.useState<Selection>(initial.steps.length === 0 ? { kind: 'trigger' } : null)
  const [confirm, setConfirm] = React.useState<'close' | 'delete' | null>(null)
  const [mounted, setMounted] = React.useState(false)
  // Set after mount (the builder never renders on the server), for the shortcut hints.
  const [mod, setMod] = React.useState('Ctrl')
  const [summaryOpen, setSummaryOpen] = React.useState(true)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const wide = useWide()
  const reduceMotion = useReducedMotionSafe()

  /* ---------- what the business has ---------- */

  const marketingTenant = useMarketingTenant(tenant)
  const marketing = useMarketing(marketingTenant, nowIso)
  const { settings: channelSettings } = useChannels(tenant)
  const hasSmsNumber = Boolean(textingNumber(channelSettings))
  const baseCtx = useEmailContext(tenant, data.activities, sample as unknown as Record<string, string>)
  const brand = React.useMemo(() => brandColors(tenant), [tenant])

  const code = React.useMemo(() => {
    let found: ActionStep['code']
    walkSteps(draft.steps, (step) => {
      if (!found && step.type === 'action' && step.action === 'give_code') found = step.code
    })
    return found
  }, [draft.steps])

  const ctx = React.useMemo(
    () => ({
      ...baseCtx,
      vars: {
        ...baseCtx.vars,
        seats_left: '4',
        offer_code: code ? `${(code.prefix || 'CODE').toUpperCase()}-7QK2` : (baseCtx.vars.offer_code ?? 'THANKS-7QK2'),
        offer_percent: code && code.percent > 0 ? `${code.percent}%` : (baseCtx.vars.offer_percent ?? '10%'),
      },
    }),
    [baseCtx, code],
  )

  const lookups = React.useMemo<DescribeLookups>(() => ({ activities: data.activities, audiences: marketing.audiences, currency: tenant.currency }), [data.activities, marketing.audiences, tenant.currency])
  const conditionData = React.useMemo<ConditionData>(() => ({ activities: data.activities, tags: data.tags, countries: data.countries, currency: tenant.currency }), [data.activities, data.tags, data.countries, tenant.currency])

  const extras = React.useMemo<FlowExtras>(
    () => ({
      signups: marketing.signups,
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

  /* ---------- health check ---------- */

  const issues = React.useMemo(
    // The same rule as the automations list, so "Turn on" agrees in both places.
    () => checkFlow(draft, { audiences: marketing.audiences, activities: data.activities, hasSmsNumber, marketingPaused: marketing.settings.paused }),
    [draft, marketing.audiences, data.activities, hasSmsNumber, marketing.settings.paused],
  )
  const counts = issueCounts(issues)
  const live = canGoLive(issues)
  // Problems the saved version already had. A live automation can still be saved while they stand,
  // as long as the change adds no new ones.
  const savedBlockers = React.useMemo(
    () =>
      new Set(
        checkFlow(baseline, { audiences: marketing.audiences, activities: data.activities, hasSmsNumber, marketingPaused: marketing.settings.paused })
          .filter((issue) => issue.severity === 'blocker')
          .map((issue) => issue.id),
      ),
    [baseline, marketing.audiences, data.activities, hasSmsNumber, marketing.settings.paused],
  )
  const newBlockers = issues.filter((issue) => issue.severity === 'blocker' && !savedBlockers.has(issue.id)).length
  const severities = React.useMemo(() => {
    const map = new Map<string, Severity>()
    for (const issue of issues) {
      const key = issue.stepId ?? areaOf(issue)
      if (!key) continue
      const current = map.get(key)
      if (!current || RANK[issue.severity] > RANK[current]) map.set(key, issue.severity)
    }
    return map
  }, [issues])

  /* ---------- live numbers ---------- */

  // Only what the replay reads: renaming it or editing its description doesn't ask the server again.
  const simKey = React.useMemo(
    () => JSON.stringify([draft.id, draft.purpose, draft.trigger, draft.who, draft.steps, draft.exit, draft.settings]),
    [draft.id, draft.purpose, draft.trigger, draft.who, draft.steps, draft.exit, draft.settings],
  )
  const draftRef = React.useRef(draft)
  draftRef.current = draft
  const [run, setRun] = React.useState<FlowRun | null>(null)
  const [running, setRunning] = React.useState(true)
  React.useEffect(() => {
    let current = true
    setRunning(true)
    const timer = window.setTimeout(() => {
      runFlow(tenant.id, draftRef.current, extras)
        .then((result) => {
          if (!current) return
          setRun(result)
          setRunning(false)
        })
        .catch(() => current && setRunning(false))
    }, 600)
    return () => {
      current = false
      window.clearTimeout(timer)
    }
  }, [tenant.id, simKey, extras])

  /* ---------- state ---------- */

  const dirty = React.useMemo(() => !saved || JSON.stringify(draft) !== JSON.stringify(baseline), [saved, draft, baseline])
  const update = setDraft

  const focusCard = React.useCallback(
    (id: string) => {
      window.requestAnimationFrame(() => {
        const el = rootRef.current?.querySelector<HTMLElement>(`[data-card="${CSS.escape(id)}"]`)
        el?.scrollIntoView({ block: 'center', behavior: reduceMotion ? 'auto' : 'smooth' })
        if (wide) el?.focus({ preventScroll: true })
      })
    },
    [reduceMotion, wide],
  )

  const insert = (at: StepPosition, type: FlowStepType, action?: FlowAction) => {
    const step = newStep(type, action, draft.trigger)
    update({ ...draft, steps: insertStep(draft.steps, at, step) })
    setSelection({ kind: 'step', id: step.id })
    focusCard(step.id)
  }

  const remove = (id: string) => {
    const step = findStep(draft.steps, id)
    if (!step) return
    const inside = isParent(step) ? countSteps([step]) - 1 : 0
    update({ ...draft, steps: removeStep(draft.steps, id) })
    setSelection(null)
    toast(inside > 0 ? `Removed, with the ${inside} ${inside === 1 ? 'step' : 'steps'} inside it` : 'Step removed', { action: { label: 'Undo', onClick: () => undo() } })
  }

  const commit = (next: Flow, what: string) => {
    onSave(next, what)
    // Keep the history the store will show, so "Changes" is current without a reload.
    const local: Flow = { ...next, updatedAt: nowIso, history: [{ at: nowIso, what }, ...next.history].slice(0, 20) }
    setBaseline(local)
    setSaved(true)
    // Not an undo step, and the saved status and history carry into the undo stack:
    // undo takes back edits, it never quietly turns a live automation back into a draft.
    rebase(local, (entry) => ({ ...entry, status: local.status, updatedAt: local.updatedAt, history: local.history }))
  }

  const save = () => {
    if (!dirty) return true
    if (draft.status === 'live' && newBlockers > 0) {
      setSelection({ kind: 'health' })
      toast.error('Fix the problems first', { description: 'It is live, so a change that would break it can’t be saved. Fix it, or pause the automation to save a work in progress.' })
      return false
    }
    commit(draft, saved ? whatChanged(baseline, draft) : 'Saved')
    toast.success(`${draft.name} saved`)
    return true
  }

  const turnOn = () => {
    if (!live) {
      setSelection({ kind: 'health' })
      return
    }
    commit({ ...draft, status: 'live' }, draft.status === 'paused' ? 'Turned back on' : 'Turned on')
    toast.success(`${draft.name} is live`, { description: 'Guests start entering from now on.' })
  }

  const pause = () => {
    commit({ ...draft, status: 'paused' }, 'Paused')
    toast(`${draft.name} is paused`, { description: 'Nobody new enters, and nothing more goes until you turn it back on.' })
  }

  const requestClose = () => (dirty ? setConfirm('close') : onClose())

  const goTo = (issue: FlowIssue) => {
    if (issue.stepId) {
      setSelection({ kind: 'step', id: issue.stepId })
      focusCard(issue.stepId)
      return
    }
    const area = areaOf(issue)
    if (!area) return
    setSelection({ kind: area })
    if (area !== 'settings') focusCard(area)
  }

  const fix = (issue: FlowIssue) => {
    if (!issue.fix) return
    update(issue.fix.apply(draft))
    toast.success('Fixed', { description: issue.fix.label, action: { label: 'Undo', onClick: () => undo() } })
  }

  // A selected step that went away (undo, a fix) closes its panel.
  React.useEffect(() => {
    if (selection?.kind === 'step' && !findStep(draft.steps, selection.id)) setSelection(null)
  }, [draft.steps, selection])

  /* ---------- page behaviour ---------- */

  React.useEffect(() => {
    setMounted(true)
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setMod('⌘')
    // Give focus back to whatever opened the builder when it closes.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    try {
      if (window.localStorage.getItem(SUMMARY_KEY) === 'closed') setSummaryOpen(false)
    } catch {
      /* storage blocked */
    }
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }, [])

  React.useEffect(() => {
    if (mounted) rootRef.current?.focus()
  }, [mounted])

  React.useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  // Keyboard: undo/redo, save, Delete for the selected step, Escape to step back.
  const keys = React.useRef<(event: KeyboardEvent) => void>(() => {})
  keys.current = (event: KeyboardEvent) => {
    if (event.defaultPrevented) return
    const root = rootRef.current
    if (!root) return
    // Another layer is on top (the email designer, a dialog, a menu, the phone panel): leave its keys alone.
    // Radix dialogs and popovers don't set aria-modal, so look for any open dialog or list too.
    const layers = document.querySelectorAll('[aria-modal="true"], [role="dialog"][data-state="open"], [role="alertdialog"], [role="listbox"]')
    if (Array.from(layers).some((el) => el !== root)) return
    const target = event.target as HTMLElement | null
    const editing = Boolean(target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))
    const mod = event.metaKey || event.ctrlKey
    const key = event.key.toLowerCase()
    if (mod && key === 's') {
      event.preventDefault()
      save()
    } else if (mod && key === 'z' && !editing) {
      event.preventDefault()
      if (event.shiftKey) redo()
      else undo()
    } else if (mod && key === 'y' && !editing) {
      event.preventDefault()
      redo()
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && !editing && selection?.kind === 'step' && (target === root || target === document.body || target?.dataset.card === selection.id)) {
      event.preventDefault()
      remove(selection.id)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (editing) target?.blur()
      else if (selection) setSelection(null)
      else requestClose()
    }
  }
  React.useEffect(() => {
    const listener = (event: KeyboardEvent) => keys.current(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  /* ---------- panels ---------- */

  const email: EmailTools = {
    ctx,
    brand,
    saved: marketing.emailTemplates,
    onSaveTemplate: (name, design) => {
      marketing.saveEmailTemplate({ id: `tpl_${Date.now().toString(36)}`, name, design, updatedAt: nowIso })
      toast.success(`${name} saved to Email templates`)
    },
  }

  const tools: InspectorTools = {
    flow: draft,
    update,
    run,
    data: conditionData,
    lookups,
    audiences: marketing.audiences,
    email,
    hasSmsNumber,
    rules: marketing.settings,
    onDeleteFlow: onDelete && saved && !draft.builtIn ? () => setConfirm('delete') : undefined,
  }

  const head = panelHead(selection, draft, lookups)
  const panel =
    selection && head ? (
      <PanelFrame
        head={head}
        onClose={() => setSelection(null)}
        actions={
          selection.kind === 'step' ? (
            <StepActions
              flow={draft}
              stepId={selection.id}
              onMove={(dir) => update({ ...draft, steps: moveStep(draft.steps, selection.id, dir) })}
              onDuplicate={() => update({ ...draft, steps: duplicateStep(draft.steps, selection.id) })}
              onRemove={() => remove(selection.id)}
            />
          ) : null
        }
      >
        {selection.kind === 'health' ? (
          <HealthPanel issues={issues} onFix={fix} onGoTo={goTo} goLabel={goLabel} />
        ) : selection.kind === 'preview' ? (
          <GuestPreview
            tenantId={tenant.id}
            flow={draft}
            flowKey={simKey}
            extras={extras}
            nowIso={nowIso}
            ctx={ctx}
            brand={brand}
            onGoTo={(id) => {
              setSelection({ kind: 'step', id })
              focusCard(id)
            }}
          />
        ) : (
          <InspectorBody selection={selection} tools={tools} />
        )}
      </PanelFrame>
    ) : null

  const sentences = describeFlow(draft, lookups)
  const toggleSummary = () => {
    const next = !summaryOpen
    setSummaryOpen(next)
    try {
      window.localStorage.setItem(SUMMARY_KEY, next ? 'open' : 'closed')
    } catch {
      /* storage blocked */
    }
  }

  const statusVariant = draft.status === 'live' ? 'success' : draft.status === 'paused' ? 'warning' : 'neutral'
  const marketingFlow = draft.purpose === 'marketing'

  const overlay = (
    <div ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Edit automation: ${draft.name}`} className="fixed inset-0 z-50 flex flex-col bg-background-dashboard outline-none">
      {/* ---------- top bar ---------- */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:px-4">
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft />} onClick={requestClose} aria-label="Back to automations">
          <span className="hidden sm:inline">Back</span>
        </Button>
        <span aria-hidden="true" className="hidden h-6 w-px bg-line sm:block" />
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={draft.name}
            onChange={(event) => update({ ...draft, name: event.target.value }, 'name')}
            onBlur={() => !draft.name.trim() && update({ ...draft, name: 'Untitled automation' })}
            aria-label="Automation name"
            className="h-9 w-full min-w-0 max-w-md truncate rounded-md bg-transparent px-2 text-[0.9375rem] font-semibold text-foreground transition-colors hover:bg-surface-sunken focus:bg-surface-sunken focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <Badge size="sm" variant={statusVariant} dot className="hidden shrink-0 sm:inline-flex">
            {STATUS_LABEL[draft.status]}
          </Badge>
          <span className="hidden shrink-0 text-xs text-subtle xl:inline" aria-live="polite">
            {dirty ? (saved ? 'Unsaved changes' : 'Not saved yet') : 'All changes saved'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="hidden items-center md:flex">
            <SimpleTooltip label={<span className="flex items-center gap-1.5">Undo <Kbd size="sm">{mod} Z</Kbd></span>}>
              <IconButton size="sm" variant="ghost" aria-label="Undo" disabled={!history.canUndo} onClick={undo}>
                <Undo2 />
              </IconButton>
            </SimpleTooltip>
            <SimpleTooltip label={<span className="flex items-center gap-1.5">Redo <Kbd size="sm">{mod} Shift Z</Kbd></span>}>
              <IconButton size="sm" variant="ghost" aria-label="Redo" disabled={!history.canRedo} onClick={redo}>
                <Redo2 />
              </IconButton>
            </SimpleTooltip>
          </div>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Stethoscope />}
            aria-pressed={selection?.kind === 'health'}
            aria-label={`Health check: ${counts.blocker} to fix, ${counts.warning} to look at`}
            onClick={() => setSelection(selection?.kind === 'health' ? null : { kind: 'health' })}
            className={cn(selection?.kind === 'health' && 'bg-surface-sunken text-foreground')}
          >
            <span className="hidden sm:inline">Check</span>
            {counts.blocker + counts.warning > 0 ? (
              <span className={cn('rounded-full px-1.5 text-xs font-semibold tabular', counts.blocker > 0 ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning')}>
                {counts.blocker > 0 ? counts.blocker : counts.warning}
              </span>
            ) : null}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<UserRound />}
            aria-pressed={selection?.kind === 'preview'}
            aria-label="Preview as a guest"
            onClick={() => setSelection(selection?.kind === 'preview' ? null : { kind: 'preview' })}
            className={cn(selection?.kind === 'preview' && 'bg-surface-sunken text-foreground')}
          >
            <span className="hidden lg:inline">Preview as a guest</span>
          </Button>
          {/* On a phone Save only shows when there is something to save, to leave room for the name. */}
          <SimpleTooltip label={<span className="flex items-center gap-1.5">Save <Kbd size="sm">{mod} S</Kbd></span>}>
            <Button variant="secondary" size="sm" disabled={!dirty} onClick={save} className={cn(!dirty && 'hidden sm:inline-flex')}>
              Save
            </Button>
          </SimpleTooltip>
          {draft.status === 'live' ? (
            <Button variant="secondary" size="sm" leftIcon={<Pause />} onClick={pause}>
              Pause
            </Button>
          ) : !live ? (
            <Button variant="secondary" size="sm" leftIcon={<CircleAlert className="text-danger" />} onClick={() => setSelection({ kind: 'health' })}>
              <span className="sm:hidden">Fix {counts.blocker}</span>
              <span className="hidden sm:inline">Fix {counts.blocker} to turn on</span>
            </Button>
          ) : (
            <Button size="sm" leftIcon={<Play />} onClick={turnOn}>
              {draft.status === 'paused' ? 'Turn back on' : 'Turn on'}
            </Button>
          )}
        </div>
      </header>

      {/* ---------- the plain summary and the numbers ---------- */}
      <section aria-label="Summary" className="shrink-0 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className={cn('text-sm leading-relaxed text-foreground', !summaryOpen && 'truncate')}>{summaryOpen ? sentences.join(' ') : sentences[0]}</p>
            <Numbers run={run} running={running} marketing={marketingFlow} currency={tenant.currency} />
          </div>
          <button
            type="button"
            onClick={toggleSummary}
            aria-expanded={summaryOpen}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted hover:bg-surface-sunken hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
          >
            {summaryOpen ? <ChevronUp className="size-3.5" aria-hidden="true" /> : <ChevronDown className="size-3.5" aria-hidden="true" />}
            {summaryOpen ? 'Shorter' : 'Read it all'}
          </button>
        </div>
      </section>

      {/* ---------- canvas and panel ---------- */}
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-auto" aria-label="Steps">
          <Canvas flow={draft} selection={selection} onSelect={setSelection} onInsert={insert} run={run} severities={severities} lookups={lookups} currency={tenant.currency} />
        </main>
        {wide ? (
          <aside className="flex w-[420px] shrink-0 flex-col border-l border-line bg-surface" aria-label="Details">
            {panel ?? <Overview flow={draft} mod={mod} onChange={(description) => update({ ...draft, description }, 'description')} />}
          </aside>
        ) : null}
      </div>

      {!wide ? (
        <Sheet open={Boolean(panel)} onOpenChange={(open) => !open && setSelection(null)}>
          <SheetContent side="bottom" size="xl" showCloseButton={false} className="h-[88dvh]" aria-describedby={undefined}>
            <SheetTitle className="sr-only">{head?.title ?? 'Details'}</SheetTitle>
            {panel}
          </SheetContent>
        </Sheet>
      ) : null}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent size="sm">
          {confirm === 'delete' ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete “{draft.name}”?</DialogTitle>
                <DialogDescription>Guests in it now get nothing more from it. This can’t be undone.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirm(null)}>
                  Keep it
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setConfirm(null)
                    onDelete?.()
                  }}
                >
                  Delete
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{saved ? 'Leave without saving?' : 'Leave this new automation?'}</DialogTitle>
                <DialogDescription>{saved ? 'Your changes since the last save will be lost.' : 'It hasn’t been saved yet, so it will be lost.'}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setConfirm(null)}>
                  Keep editing
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setConfirm(null)
                    onClose()
                  }}
                >
                  Discard
                </Button>
                <Button
                  onClick={() => {
                    setConfirm(null)
                    if (save()) onClose()
                  }}
                >
                  Save and leave
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )

  return mounted ? createPortal(overlay, document.body) : null
}

/* ---------- pieces ---------- */

function Numbers({ run, running, marketing, currency }: { run: FlowRun | null; running: boolean; marketing: boolean; currency: Tenant['currency'] }) {
  if (!run) return <p className="mt-1.5 text-xs text-subtle">{running ? 'Working out the numbers from your bookings…' : 'Numbers aren’t available right now.'}</p>
  const item = (label: string, value: string, hint?: string) => (
    <span className="whitespace-nowrap">
      {label} <span className="font-medium text-foreground tabular">{value}</span>
      {hint ? <span className="text-faint"> {hint}</span> : null}
    </span>
  )
  const n = (value: number) => value.toLocaleString('en-US')
  return (
    <div className={cn('mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle transition-opacity', running && 'opacity-60')} aria-live="polite">
      <span className="font-medium text-muted">Last 60 days, replayed on your bookings</span>
      {item('Started', n(run.entered))}
      {item('In it now', n(run.active))}
      {item('Messages', n(run.messages))}
      {marketing ? item('Bookings', n(run.bookings)) : null}
      {marketing ? item('Revenue', formatCurrency(run.revenue, currency)) : (
        <SimpleTooltip label="Booking messages go to guests who have already booked, so they aren’t credited with bookings.">
          <span tabIndex={0} className="rounded whitespace-nowrap focus-visible:outline-2 focus-visible:outline-primary">
            Revenue <span className="font-medium text-foreground">—</span>
          </span>
        </SimpleTooltip>
      )}
      {run.lift ? item('Booked per 100', `${run.lift.inFlow} vs ${run.lift.heldOut}`, 'kept out') : null}
      <span className="text-faint">Opens and clicks are estimates.</span>
      {run.note ? <span className="basis-full text-subtle">{run.note}</span> : null}
    </div>
  )
}

/** The panel when nothing is selected: what it is for, and how to drive the builder. */
function Overview({ flow, mod, onChange }: { flow: Flow; mod: string; onChange: (description: string) => void }) {
  const shortcuts: [string, string][] = [
    ['↑ ↓', 'Move between cards'],
    ['Enter', 'Open the card'],
    ['Delete', 'Remove the step'],
    [`${mod} Z`, 'Undo'],
    [`${mod} Shift Z`, 'Redo'],
    [`${mod} S`, 'Save'],
    ['Esc', 'Close the panel'],
  ]
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto px-5 py-5">
      <div>
        <h2 className="text-[0.9375rem] font-semibold text-foreground">How to change it</h2>
        <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted">Pick any card to change it. Use the + between cards to add an email, a text, a wait, a question or an action at that point.</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="flow-description" className="text-[0.8125rem] font-medium text-foreground">
          What it is for
        </label>
        <Textarea id="flow-description" rows={3} value={flow.description} placeholder="One line for the list, like “Brings back guests who haven’t been out in a while”" onChange={(event) => onChange(event.target.value)} />
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Keyboard</h3>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-[0.8125rem]">
          {shortcuts.map(([key, label]) => (
            <React.Fragment key={key}>
              <dt>
                <Kbd>{key}</Kbd>
              </dt>
              <dd className="text-muted">{label}</dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    </div>
  )
}
