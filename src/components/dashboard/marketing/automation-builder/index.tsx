'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Settings2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { IconButton } from '@/components/ui/icon-button'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { EmailDesigner } from '@/components/dashboard/marketing/email-designer'
import { useChannels } from '@/hooks/use-channels'
import { brandColors, useEmailContext } from '@/hooks/use-email-context'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { runFlow } from '@/lib/actions/flows'
import { textingNumber } from '@/lib/channels'
import type { MarketingBasics } from '@/lib/data/guest-marketing'
import { newStep } from '@/lib/flows/catalog'
import { canGoLive, checkFlow } from '@/lib/flows/check'
import type { DescribeLookups } from '@/lib/flows/describe'
import type { FlowExtras } from '@/lib/flows/engine'
import { findStep, forSimulation, insertStep, removeStep, updateStep, type StepPosition } from '@/lib/flows/tree'
import type { EmailStep, Flow, FlowAction, FlowRun, FlowStep, FlowStepType } from '@/lib/flows/types'
import { designFromText } from '@/lib/email-design'
import type { MessageContext } from '@/lib/messaging'
import type { Tenant } from '@/types'

import { Canvas, type Selection } from './canvas'
import { emptySteps, normalizeConditions } from './meta'
import { Panel } from './panel'

/* ==========================================================================
   AUTOMATION BUILDER
   One screen: the name and an on/off switch at the top, the trigger and
   the steps down the middle, and a panel for whichever card is picked.
   ========================================================================== */

export interface AutomationBuilderProps {
  flow: Flow
  isNew: boolean
  /** False when nothing could be stored. */
  onSave: (flow: Flow, what: string) => boolean
  onClose: () => void
  onDelete?: () => void
  tenant: Tenant
  data: MarketingBasics
  sample: MessageContext
  nowIso: string
}

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

export function AutomationBuilder({ flow: given, isNew, onSave, onClose, onDelete, tenant, data, sample, nowIso }: AutomationBuilderProps) {
  // Conditions read the positive way round; the same automation, so it isn't a change to save.
  const [initial] = React.useState(() => ({ ...given, steps: normalizeConditions(given.steps) }))
  const [draft, setDraft] = React.useState(initial)
  const [baseline, setBaseline] = React.useState(isNew ? null : initial)
  const [selection, setSelection] = React.useState<Selection>(null)
  const [designing, setDesigning] = React.useState<EmailStep | null>(null)
  const [confirmClose, setConfirmClose] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const wide = useWide()

  const marketing = useMarketing(useMarketingTenant(tenant), nowIso)
  const { settings: channels } = useChannels(tenant)
  const ctx = useEmailContext(tenant, data.activities, sample as unknown as Record<string, string>)
  const brand = React.useMemo(() => brandColors(tenant), [tenant])
  const lookups = React.useMemo<DescribeLookups>(() => ({ activities: data.activities, audiences: marketing.audiences, currency: tenant.currency }), [data.activities, marketing.audiences, tenant.currency])
  const checkContext = React.useMemo(
    () => ({ audiences: marketing.audiences, activities: data.activities, hasSmsNumber: Boolean(textingNumber(channels)), marketingPaused: marketing.settings.paused, currency: tenant.currency }),
    [marketing.audiences, data.activities, channels, marketing.settings.paused, tenant.currency],
  )

  const dirty = baseline === null || JSON.stringify(draft) !== JSON.stringify(baseline)
  const live = draft.status === 'live'
  const problems = React.useMemo(() => emptySteps(draft), [draft])

  /* ---------- numbers from the last 60 days ---------- */

  const extras = React.useMemo<FlowExtras>(
    () => ({
      signups: marketing.signups,
      settings: { paused: marketing.settings.paused, quietHours: marketing.settings.quietHours, frequencyCap: marketing.settings.frequencyCap, skipUpcoming: marketing.settings.skipUpcoming },
      audiences: marketing.audiences,
      nowIso,
    }),
    [marketing.signups, marketing.settings, marketing.audiences, nowIso],
  )
  const simKey = React.useMemo(() => {
    const slim = forSimulation(draft)
    return JSON.stringify([slim.purpose, slim.trigger, slim.who, slim.steps, slim.exit, slim.settings])
  }, [draft])
  const draftRef = React.useRef(draft)
  draftRef.current = draft
  const [run, setRun] = React.useState<FlowRun | null>(null)
  React.useEffect(() => {
    let alive = true
    const timer = window.setTimeout(() => {
      runFlow(tenant.id, forSimulation(draftRef.current), extras)
        .then((result) => alive && setRun(result))
        .catch(() => undefined)
    }, 600)
    return () => {
      alive = false
      window.clearTimeout(timer)
    }
  }, [tenant.id, simKey, extras])

  /* ---------- editing ---------- */

  const insert = (at: StepPosition, type: FlowStepType, action?: FlowAction) => {
    const step = newStep(type, action, draft.trigger)
    setDraft({ ...draft, steps: insertStep(draft.steps, at, step) })
    setSelection({ kind: 'step', id: step.id })
  }
  const setStep = (id: string, next: FlowStep) => setDraft((current) => ({ ...current, steps: updateStep(current.steps, id, () => next) }))
  const remove = (id: string) => {
    setDraft((current) => ({ ...current, steps: removeStep(current.steps, id) }))
    setSelection(null)
  }

  /* ---------- saving ---------- */

  const commit = (next: Flow, what: string, message: string) => {
    if (!onSave(next, what)) return false
    setDraft(next)
    setBaseline(next)
    toast.success(message)
    return true
  }

  const save = () => commit(draft, isNew && !baseline ? 'Created' : 'Saved', `${draft.name} saved`)

  const setLive = (on: boolean) => {
    if (on) {
      if (problems.size > 0) {
        const id = [...problems][0]
        setSelection({ kind: 'step', id })
        toast.error('Fill in this step first')
        return
      }
      const issues = checkFlow(draft, checkContext)
      if (!canGoLive(issues)) {
        const first = issues.find((issue) => issue.severity === 'blocker')
        if (first?.stepId) setSelection({ kind: 'step', id: first.stepId })
        toast.error('One thing to fix first', { description: first?.text })
        return
      }
      commit({ ...draft, status: 'live' }, 'Turned on', `${draft.name} is on`)
    } else {
      commit({ ...draft, status: 'paused' }, 'Turned off', `${draft.name} is off`)
    }
  }

  const close = () => (dirty ? setConfirmClose(true) : onClose())

  /* ---------- page behaviour ---------- */

  React.useEffect(() => {
    setMounted(true)
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = previous
    }
  }, [])

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !designing && !confirmClose && document.querySelector('[role="dialog"][data-state="open"], [data-radix-popper-content-wrapper]') === null) {
        if (selection) setSelection(null)
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (dirty) save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // A step that went away closes its panel.
  React.useEffect(() => {
    if (selection?.kind === 'step' && !findStep(draft.steps, selection.id)) setSelection(null)
  }, [draft.steps, selection])

  if (!mounted) return null

  const panel = selection ? (
    <Panel
      flow={draft}
      selection={selection}
      activities={data.activities}
      tags={data.tags}
      onFlow={setDraft}
      onStep={setStep}
      onRemoveStep={remove}
      onDesign={setDesigning}
      onDelete={onDelete}
      onClose={() => setSelection(null)}
    />
  ) : null

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={draft.name}>
      {/* ---------- top bar ---------- */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-5">
        <IconButton variant="ghost" size="sm" aria-label="Back to automations" onClick={close}>
          <ArrowLeft />
        </IconButton>
        <input
          aria-label="Automation name"
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          className="min-w-0 flex-1 truncate rounded-md bg-transparent px-2 py-1 text-[0.9375rem] font-semibold text-foreground outline-none hover:bg-surface-sunken focus:bg-surface-sunken sm:max-w-md"
        />
        <Badge variant={live ? 'success' : 'neutral'} size="sm" className="hidden sm:inline-flex">
          {live ? 'On' : draft.status === 'paused' ? 'Off' : 'Draft'}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <IconButton variant="ghost" size="sm" aria-label="Settings" aria-pressed={selection?.kind === 'settings'} onClick={() => setSelection(selection?.kind === 'settings' ? null : { kind: 'settings' })}>
            <Settings2 />
          </IconButton>
          <label className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-muted">
            <Switch checked={live} onCheckedChange={setLive} aria-label={live ? 'Turn off' : 'Turn on'} />
            <span className="hidden sm:inline">{live ? 'On' : 'Off'}</span>
          </label>
          <Button size="sm" onClick={save} disabled={!dirty}>
            Save
          </Button>
        </div>
      </header>

      {/* ---------- canvas and panel ---------- */}
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-auto bg-surface-sunken" onClick={(event) => event.target === event.currentTarget && setSelection(null)}>
          <Canvas flow={draft} lookups={lookups} run={run} selection={selection} problems={problems} onSelect={setSelection} onInsert={insert} />
        </main>
        {wide ? panel : null}
      </div>

      {!wide ? (
        <Sheet open={selection !== null} onOpenChange={(open) => !open && setSelection(null)}>
          <SheetContent side="bottom" size="lg" showCloseButton={false} className="p-0">
            <SheetTitle className="sr-only">Edit</SheetTitle>
            {panel}
          </SheetContent>
        </Sheet>
      ) : null}

      {designing ? (
        <EmailDesigner
          initial={designing.design ?? designFromText(designing.subject, designing.body, brand[0] ?? '#601CEF')}
          ctx={ctx}
          subject={designing.subject}
          brand={brand}
          saved={marketing.emailTemplates}
          onSaveTemplate={(name, design) => {
            marketing.saveEmailTemplate({ id: `tpl_${Date.now().toString(36)}`, name, design, updatedAt: nowIso })
            toast.success(`${name} saved to Email templates`)
          }}
          onClose={() => setDesigning(null)}
          onDone={(design) => {
            setStep(designing.id, { ...designing, design })
            setDesigning(null)
          }}
        />
      ) : null}

      <Dialog open={confirmClose} onOpenChange={setConfirmClose}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Save your changes?</DialogTitle>
            <DialogDescription>You have changes that aren’t saved yet.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={onClose}>
              Discard
            </Button>
            <Button
              onClick={() => {
                setConfirmClose(false)
                if (save()) onClose()
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>,
    document.body,
  )
}
