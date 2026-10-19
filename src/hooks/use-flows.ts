'use client'

import * as React from 'react'

import { toast } from '@/components/ui/toaster'
import { MARKETING_EVENT } from '@/hooks/use-marketing'
import { TEMPLATES_EVENT } from '@/hooks/use-message-templates'

import { exitFor, newId, settingsFor, triggerMeta } from '@/lib/flows/catalog'
import { customGrowthTemplates, defaultFlows, flowFromTemplate } from '@/lib/flows/defaults'
import type { Flow, FlowStatus, FlowStep } from '@/lib/flows/types'
import type { Audience } from '@/lib/marketing'
import { DEFAULT_TEMPLATES, type MessageTemplate, type TemplateKey } from '@/lib/messaging'

/* ==========================================================================
   useFlows — the business's automations, live. Until anything is saved the
   list is the built-in flows plus any older automations the business made
   itself (read from the message templates, never deleted there). The first
   save stores the whole list in the browser (the demo has no backend).
   ========================================================================== */

export const FLOWS_EVENT = 'ezra:flows'
const keyFor = (slug: string) => `ezra:flows:${slug}`
const templatesKey = (tenantId: string) => `ezra:message-templates:${tenantId}`
const marketingKey = (slug: string) => `ezra:marketing:${slug}`

const MAX_HISTORY = 20

type FlowActivity = { slug: string; name: string }

function read(key: string) {
  try {
    return window.localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function parse<T>(raw: string, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange)
  window.addEventListener(FLOWS_EVENT, onChange)
  window.addEventListener(TEMPLATES_EVENT, onChange)
  window.addEventListener(MARKETING_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(FLOWS_EVENT, onChange)
    window.removeEventListener(TEMPLATES_EVENT, onChange)
    window.removeEventListener(MARKETING_EVENT, onChange)
  }
}

/** The message templates as the business left them: defaults with their edits, plus their own. */
function storedTemplates(raw: string): MessageTemplate[] {
  const edits = parse<Partial<Record<TemplateKey, Partial<MessageTemplate>>>>(raw, {})
  const builtIn = DEFAULT_TEMPLATES.map((template) => ({ ...template, ...edits[template.key] }) as MessageTemplate)
  const own = Object.entries(edits)
    .filter(([key, value]) => key.startsWith('custom_') && value && (value as MessageTemplate).name)
    .map(([, value]) => value as MessageTemplate)
  return [...builtIn, ...own]
}

/** The business's own audiences from the marketing store, so older automations keep who they were for. */
function storedAudiences(raw: string): Audience[] {
  const store = parse<{ audiences?: Audience[] } | null>(raw, null)
  return Array.isArray(store?.audiences) ? store.audiences.filter((audience) => audience && typeof audience.id === 'string' && audience.filter) : []
}

/**
 * A stored flow made safe to read: entries from an older version, or a
 * damaged store, get the fields they are missing instead of breaking the
 * page. Anything without an id, a trigger and steps is dropped.
 */
function normalize(entry: unknown, nowIso: string): Flow | null {
  if (!entry || typeof entry !== 'object') return null
  const flow = entry as Partial<Flow>
  if (typeof flow.id !== 'string' || !flow.trigger || typeof flow.trigger.type !== 'string' || !Array.isArray(flow.steps)) return null
  // A start this version no longer knows cannot run or be shown.
  if (triggerMeta(flow.trigger.type).type !== flow.trigger.type) return null
  const purpose = flow.purpose === 'marketing' ? 'marketing' : 'booking'
  return {
    ...(flow as Flow),
    name: typeof flow.name === 'string' && flow.name.trim() ? flow.name : 'Untitled automation',
    description: typeof flow.description === 'string' ? flow.description : '',
    goal: flow.goal ?? triggerMeta(flow.trigger.type).goal,
    purpose,
    status: flow.status === 'live' || flow.status === 'paused' ? flow.status : 'draft',
    who: flow.who && Array.isArray(flow.who.conditions) ? flow.who : { match: 'all', conditions: [] },
    exit: { ...exitFor(purpose), ...flow.exit },
    settings: { ...settingsFor(purpose), ...flow.settings },
    createdAt: flow.createdAt || nowIso,
    updatedAt: flow.updatedAt || flow.createdAt || nowIso,
    history: Array.isArray(flow.history) ? flow.history.slice(0, MAX_HISTORY) : [],
  }
}

/** Fresh ids for every step in a copy, so the copy's numbers never mix with the original's. */
function reid(steps: FlowStep[]): FlowStep[] {
  return steps.map((step) => {
    const id = newId('step')
    if (step.type === 'branch') return { ...step, id, when: { ...step.when, conditions: step.when.conditions.map((entry) => ({ ...entry, id: newId('cond') })) }, yes: reid(step.yes), no: reid(step.no) }
    if (step.type === 'split') return { ...step, id, a: reid(step.a), b: reid(step.b) }
    return { ...step, id }
  })
}

function copyName(name: string, taken: Set<string>) {
  const base = `${name.replace(/ \(copy( \d+)?\)$/, '')} (copy)`
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base.slice(0, -1)} ${n})`)) n += 1
  return `${base.slice(0, -1)} ${n})`
}

const SEP_FIELD = '\u0000'
const SEP_ITEM = '\u0001'

export function useFlows(tenant: { id: string; slug: string }, nowIso: string, activities: FlowActivity[]) {
  const { id: tenantId, slug } = tenant
  const raw = React.useSyncExternalStore(subscribe, () => read(keyFor(slug)), () => '')
  const templatesRaw = React.useSyncExternalStore(subscribe, () => read(templatesKey(tenantId)), () => '')
  const marketingRaw = React.useSyncExternalStore(subscribe, () => read(marketingKey(slug)), () => '')

  // Callers often pass a fresh array each render: key the defaults on what is in it, not on the array.
  const activityKey = activities.map((activity) => `${activity.slug}${SEP_FIELD}${activity.name}`).join(SEP_ITEM)
  const known = React.useMemo<FlowActivity[]>(
    () =>
      activityKey
        ? activityKey.split(SEP_ITEM).map((item) => {
            const [activitySlug, name] = item.split(SEP_FIELD)
            return { slug: activitySlug, name }
          })
        : [],
    [activityKey],
  )

  const stored = React.useMemo(() => {
    const list = parse<unknown>(raw, null)
    return Array.isArray(list) ? list.map((entry) => normalize(entry, nowIso)).filter((flow): flow is Flow => flow !== null) : null
  }, [raw, nowIso])

  // Only read before the first save, and only for moving older automations over.
  const audiences = React.useMemo(() => (stored ? [] : storedAudiences(marketingRaw)), [stored, marketingRaw])

  const flows = React.useMemo<Flow[]>(() => {
    const templates = storedTemplates(templatesRaw)
    const builtIn = defaultFlows(nowIso, known, templates)
    if (stored) {
      // Built-in flows cannot be deleted, so one missing from the saved list is new since the save: add it.
      const ids = new Set(stored.map((flow) => flow.id))
      const added = builtIn.filter((flow) => !ids.has(flow.id))
      return added.length > 0 ? [...stored, ...added] : stored
    }
    const moved = customGrowthTemplates(templates).map((template) => flowFromTemplate(template, { nowIso, activities: known, audiences }))
    return [...builtIn, ...moved]
  }, [stored, templatesRaw, nowIso, known, audiences])

  const write = React.useCallback(
    (next: Flow[] | null) => {
      try {
        if (next) window.localStorage.setItem(keyFor(slug), JSON.stringify(next))
        else window.localStorage.removeItem(keyFor(slug))
      } catch {
        // Usually a full browser store: big uploaded photos. Say so rather than lose the change quietly.
        toast.error('Could not save', { description: 'The browser storage is full. Use smaller photos or image links.' })
      }
      window.dispatchEvent(new Event(FLOWS_EVENT))
    },
    [slug],
  )

  const stamp = React.useCallback(
    (flow: Flow, what: string): Flow => ({ ...flow, updatedAt: nowIso, history: [{ at: nowIso, what }, ...(flow.history ?? [])].slice(0, MAX_HISTORY) }),
    [nowIso],
  )

  return React.useMemo(() => {
    const byId = (id: string) => flows.find((flow) => flow.id === id)
    const upsert = (flow: Flow) => (flows.some((entry) => entry.id === flow.id) ? flows.map((entry) => (entry.id === flow.id ? flow : entry)) : [flow, ...flows])

    return {
      flows,
      /** Has the business saved anything yet? */
      hasEdits: stored !== null,
      byId,
      /** Save a change: bumps the updated time and notes what changed. */
      save: (flow: Flow, what = 'Saved') => write(upsert(stamp(flow, what))),
      /** Add a new flow at the top. A flow that already says how it started (a recipe, a copy) keeps that as its first line. */
      create: (flow: Flow) => {
        const history = flow.history?.length ? flow.history.slice(0, MAX_HISTORY) : [{ at: nowIso, what: 'Created' }]
        const made: Flow = { ...flow, createdAt: flow.createdAt || nowIso, updatedAt: nowIso, history }
        write([made, ...flows.filter((entry) => entry.id !== flow.id)])
      },
      /** Delete one of the business's own flows. Built-in ones can only be paused. */
      remove: (id: string) => {
        const flow = byId(id)
        if (!flow || flow.builtIn) return
        write(flows.filter((entry) => entry.id !== id))
      },
      /** A draft copy, saved straight after the original. */
      duplicate: (id: string): Flow | undefined => {
        const flow = byId(id)
        if (!flow) return undefined
        const copy: Flow = {
          ...flow,
          id: newId('flow'),
          name: copyName(flow.name, new Set(flows.map((entry) => entry.name))),
          status: 'draft',
          builtIn: false,
          steps: reid(flow.steps),
          who: { ...flow.who, conditions: flow.who.conditions.map((entry) => ({ ...entry, id: newId('cond') })) },
          createdAt: nowIso,
          updatedAt: nowIso,
          history: [{ at: nowIso, what: `Copied from “${flow.name}”` }],
        }
        const index = flows.findIndex((entry) => entry.id === id)
        write([...flows.slice(0, index + 1), copy, ...flows.slice(index + 1)])
        return copy
      },
      setStatus: (id: string, status: FlowStatus) => {
        const flow = byId(id)
        if (!flow || flow.status === status) return
        const what = status === 'live' ? (flow.status === 'paused' ? 'Turned back on' : 'Turned on') : status === 'paused' ? 'Paused' : 'Moved back to draft'
        write(upsert(stamp({ ...flow, status }, what)))
      },
      /** Back to the built-in flows. Older automations are moved over again. */
      reset: () => write(null),
    }
  }, [flows, stored, write, stamp, nowIso])
}

export type FlowsStore = ReturnType<typeof useFlows>
