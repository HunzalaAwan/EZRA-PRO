'use client'

import * as React from 'react'

import type { InboxMessage, InboxThread, ThreadStatus } from '@/lib/inbox'

/* ==========================================================================
   useInbox — guest conversations, live. Seeded threads come from the
   server; replies, status changes and messages guests send from their
   manage-booking page are kept in the browser (\`ezra:inbox:<slug>\`), so
   the inbox and the guest page see the same conversation.
   ========================================================================== */

export const INBOX_EVENT = 'ezra:inbox'
const keyFor = (slug: string) => `ezra:inbox:${slug}`

interface InboxStore {
  /** Messages added after the seed, per thread id. */
  messages: Record<string, InboxMessage[]>
  status: Record<string, ThreadStatus>
  /** Threads a guest started from their manage page. */
  threads: Omit<InboxThread, 'messages' | 'status'>[]
}

const EMPTY: InboxStore = { messages: {}, status: {}, threads: [] }

export function readInbox(slug: string): InboxStore {
  try {
    const raw = window.localStorage.getItem(keyFor(slug))
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<InboxStore>
    return { messages: parsed.messages ?? {}, status: parsed.status ?? {}, threads: parsed.threads ?? [] }
  } catch {
    return EMPTY
  }
}

export function writeInbox(slug: string, store: InboxStore) {
  try {
    window.localStorage.setItem(keyFor(slug), JSON.stringify(store))
  } catch {
    /* storage blocked */
  }
  window.dispatchEvent(new Event(INBOX_EVENT))
}

const stamp = () => new Date().toISOString().slice(0, 19)

/** From the guest's page: add a message to their thread, starting it if needed. */
export function sendGuestMessage(slug: string, thread: Omit<InboxThread, 'messages' | 'status'>, body: string) {
  const store = readInbox(slug)
  const threads = store.threads.some((entry) => entry.id === thread.id) ? store.threads : [...store.threads, thread]
  writeInbox(slug, {
    messages: { ...store.messages, [thread.id]: [...(store.messages[thread.id] ?? []), { id: `m_${Date.now().toString(36)}`, from: 'guest', body, at: stamp() }] },
    status: { ...store.status, [thread.id]: 'open' },
    threads,
  })
}

export function useInbox(slug: string, seeded: InboxThread[]) {
  const subscribe = React.useCallback((onChange: () => void) => {
    window.addEventListener('storage', onChange)
    window.addEventListener(INBOX_EVENT, onChange)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(INBOX_EVENT, onChange)
    }
  }, [])
  const raw = React.useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(keyFor(slug)) ?? ''
      } catch {
        return ''
      }
    },
    () => '',
  )
  const store = React.useMemo<InboxStore>(() => {
    if (!raw) return EMPTY
    try {
      const parsed = JSON.parse(raw) as Partial<InboxStore>
      return { messages: parsed.messages ?? {}, status: parsed.status ?? {}, threads: parsed.threads ?? [] }
    } catch {
      return EMPTY
    }
  }, [raw])

  const threads = React.useMemo(() => {
    const base: InboxThread[] = [
      ...store.threads.filter((thread) => !seeded.some((entry) => entry.id === thread.id)).map((thread) => ({ ...thread, messages: [], status: 'open' as ThreadStatus })),
      ...seeded,
    ]
    return base
      .map((thread) => ({
        ...thread,
        messages: [...thread.messages, ...(store.messages[thread.id] ?? [])],
        status: store.status[thread.id] ?? thread.status,
      }))
      .sort((a, b) => {
        const la = a.messages[a.messages.length - 1]?.at ?? ''
        const lb = b.messages[b.messages.length - 1]?.at ?? ''
        return la < lb ? 1 : -1
      })
  }, [seeded, store])

  return {
    threads,
    reply: (threadId: string, body: string, author: string) =>
      writeInbox(slug, {
        ...store,
        messages: { ...store.messages, [threadId]: [...(store.messages[threadId] ?? []), { id: `m_${Date.now().toString(36)}`, from: 'staff', body, at: stamp(), author }] },
        status: { ...store.status, [threadId]: 'waiting' },
      }),
    setStatus: (threadId: string, status: ThreadStatus) => writeInbox(slug, { ...store, status: { ...store.status, [threadId]: status } }),
  }
}
