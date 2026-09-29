'use client'

import * as React from 'react'

import { toast } from '@/components/ui/toaster'

import { DEFAULT_TEMPLATES, type MessageTemplate, type TemplateKey } from '@/lib/messaging'

/* ==========================================================================
   useMessageTemplates — the business's message templates, live. Edits are
   kept in the browser (the demo has no backend) over the defaults.
   ========================================================================== */

export const TEMPLATES_EVENT = 'ezra:message-templates'
const keyFor = (tenantId: string) => `ezra:message-templates:${tenantId}`

function read(tenantId: string) {
  try {
    return window.localStorage.getItem(keyFor(tenantId)) ?? ''
  } catch {
    return ''
  }
}

export function useMessageTemplates(tenantId: string) {
  const subscribe = React.useCallback((onChange: () => void) => {
    window.addEventListener('storage', onChange)
    window.addEventListener(TEMPLATES_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(TEMPLATES_EVENT, onChange)
    }
  }, [])
  const raw = React.useSyncExternalStore(subscribe, () => read(tenantId), () => '')
  const edits = React.useMemo<Partial<Record<TemplateKey, Partial<MessageTemplate>>>>(() => {
    if (!raw) return {}
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }, [raw])

  const templates = React.useMemo(() => {
    const builtIn = DEFAULT_TEMPLATES.map((template) => ({ ...template, ...edits[template.key] }))
    // The business's own automations are stored whole, keyed custom_…
    const custom = Object.entries(edits)
      .filter(([key, value]) => key.startsWith('custom_') && value && (value as MessageTemplate).name)
      .map(([, value]) => value as MessageTemplate)
    return [...builtIn, ...custom]
  }, [edits])

  const write = React.useCallback(
    (next: Partial<Record<TemplateKey, Partial<MessageTemplate>>> | null) => {
      try {
        if (next) window.localStorage.setItem(keyFor(tenantId), JSON.stringify(next))
        else window.localStorage.removeItem(keyFor(tenantId))
      } catch {
        // Usually a full browser store: big uploaded photos. Say so rather than lose the change quietly.
        toast.error('Could not save', { description: 'The browser storage is full. Use smaller photos or image links.' })
      }
      window.dispatchEvent(new Event(TEMPLATES_EVENT))
    },
    [tenantId],
  )

  return {
    templates,
    update: (key: TemplateKey, patch: Partial<MessageTemplate>) => write({ ...edits, [key]: { ...edits[key], ...patch } }),
    /** Add one of the business's own automations. */
    create: (template: MessageTemplate) => write({ ...edits, [template.key]: { ...template, custom: true } }),
    /** Delete one of the business's own automations. */
    remove: (key: TemplateKey) => {
      const next = { ...edits }
      delete next[key]
      write(next)
    },
    /** Back to the default wording and timing. The business's own automations stay. */
    reset: () => {
      const own = Object.fromEntries(Object.entries(edits).filter(([key]) => key.startsWith('custom_')))
      write(Object.keys(own).length > 0 ? own : null)
    },
    hasEdits: Object.keys(edits).some((key) => !key.startsWith('custom_')),
  }
}
