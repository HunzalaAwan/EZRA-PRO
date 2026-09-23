'use client'

import * as React from 'react'

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

  const templates = React.useMemo(() => DEFAULT_TEMPLATES.map((template) => ({ ...template, ...edits[template.key] })), [edits])

  const write = React.useCallback(
    (next: Partial<Record<TemplateKey, Partial<MessageTemplate>>> | null) => {
      try {
        if (next) window.localStorage.setItem(keyFor(tenantId), JSON.stringify(next))
        else window.localStorage.removeItem(keyFor(tenantId))
      } catch {
        /* storage blocked */
      }
      window.dispatchEvent(new Event(TEMPLATES_EVENT))
    },
    [tenantId],
  )

  return {
    templates,
    update: (key: TemplateKey, patch: Partial<MessageTemplate>) => write({ ...edits, [key]: { ...edits[key], ...patch } }),
    reset: () => write(null),
    hasEdits: raw !== '',
  }
}
