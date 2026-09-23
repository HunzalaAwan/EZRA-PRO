'use client'

import * as React from 'react'

import type { CharterRequest } from '@/types'

/* ==========================================================================
   useCharterRequests — the charter inbox, live.

   Requests arrive from the storefront widget (localStorage
   \`ezra:charter-requests:<slug>\`); the operator's quotes, declines and
   payments are kept beside them (\`ezra:charter-quotes:<slug>\`). Seeded
   requests from the server sit underneath both, so the inbox and the guest's
   quote page read the same thing.
   ========================================================================== */

export const CHARTER_EVENT = 'ezra:charter-requests'
const requestsKey = (slug: string) => `ezra:charter-requests:${slug}`
const statesKey = (slug: string) => `ezra:charter-quotes:${slug}`

type RequestState = Pick<CharterRequest, 'status' | 'quote' | 'paidAt'> & { declinedReason?: string }

function read(key: string): string {
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

export function useCharterRequests(slug: string, tenantId: string, seeded: CharterRequest[]) {
  const subscribe = React.useCallback((onChange: () => void) => {
    window.addEventListener('storage', onChange)
    window.addEventListener(CHARTER_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(CHARTER_EVENT, onChange)
    }
  }, [])
  const rawRequests = React.useSyncExternalStore(subscribe, () => read(requestsKey(slug)), () => '')
  const rawStates = React.useSyncExternalStore(subscribe, () => read(statesKey(slug)), () => '')

  const states = React.useMemo(() => parse<Record<string, RequestState>>(rawStates, {}), [rawStates])

  const requests = React.useMemo(() => {
    const fromWidget = parse<Partial<CharterRequest>[]>(rawRequests, []).map(
      (entry): CharterRequest => ({
        id: entry.id ?? `req_${Math.random().toString(36).slice(2, 8)}`,
        tenantId,
        activitySlug: entry.activitySlug ?? '',
        departureId: entry.departureId,
        startsAt: entry.startsAt ?? '',
        tierId: entry.tierId,
        party: entry.party ?? 1,
        name: entry.name ?? 'Guest',
        email: entry.email ?? '',
        message: entry.message ?? '',
        createdAt: (entry.createdAt ?? '').slice(0, 19),
        status: 'new',
      }),
    )
    return [...fromWidget, ...seeded]
      .map((request) => ({ ...request, ...states[request.id] }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }, [rawRequests, seeded, states, tenantId])

  const patch = React.useCallback(
    (id: string, next: RequestState) => {
      const all = { ...states, [id]: { ...states[id], ...next } }
      try {
        window.localStorage.setItem(statesKey(slug), JSON.stringify(all))
      } catch {
        /* storage blocked */
      }
      window.dispatchEvent(new Event(CHARTER_EVENT))
    },
    [slug, states],
  )

  const nowStamp = () => new Date().toISOString().slice(0, 19)

  return {
    requests,
    sendQuote: (id: string, quote: Omit<NonNullable<CharterRequest['quote']>, 'sentAt'>) =>
      patch(id, { status: 'quoted', quote: { ...quote, sentAt: nowStamp() } }),
    decline: (id: string, reason: string) => patch(id, { status: 'declined', declinedReason: reason }),
    markPaid: (id: string) => {
      const current = requests.find((request) => request.id === id)
      patch(id, { status: 'paid', quote: current?.quote, paidAt: nowStamp() })
    },
  }
}
