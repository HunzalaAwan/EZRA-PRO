'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, Check, Mail, MessageCircle, MessageSquareText, Phone, Send } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useInbox } from '@/hooks/use-inbox'
import type { InboxThread, ThreadChannel, ThreadStatus } from '@/lib/inbox'
import { cn, formatDateLong, formatRelative, formatTime } from '@/lib/utils'

/* ==========================================================================
   INBOX
   Two-way conversations with guests by text, email and WhatsApp, each tied
   to its booking. Messages a guest sends from their manage page land here.
   ========================================================================== */

const CHANNEL: Record<ThreadChannel, { label: string; icon: typeof Mail }> = {
  sms: { label: 'Text', icon: MessageSquareText },
  email: { label: 'Email', icon: Mail },
  whatsapp: { label: 'WhatsApp', icon: MessageCircle },
}

const QUICK_REPLIES = [
  'No problem, we will hold your seats. Head straight to the check-in desk when you arrive.',
  'Yes, the trip is on. We check conditions again at 6 am and will text you if anything changes.',
  'Done, I have moved you. The new time is in your booking link.',
  'Let me check with the captain and come back to you within the hour.',
]

type Filter = 'open' | 'all' | 'closed'

export function InboxView({ tenantSlug, seeded, nowIso, staffName }: { tenantSlug: string; seeded: InboxThread[]; nowIso: string; staffName: string }) {
  const { threads, reply, setStatus } = useInbox(tenantSlug, seeded)
  const [filter, setFilter] = React.useState<Filter>('open')
  const [query, setQuery] = React.useState('')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState('')
  const now = React.useMemo(() => new Date(nowIso), [nowIso])
  const endRef = React.useRef<HTMLDivElement>(null)

  const counts = {
    open: threads.filter((thread) => thread.status === 'open').length,
    all: threads.length,
    closed: threads.filter((thread) => thread.status === 'closed').length,
  }
  const needle = query.trim().toLowerCase()
  const visible = threads.filter((thread) => {
    if (filter === 'open' && thread.status === 'closed') return false
    if (filter === 'closed' && thread.status !== 'closed') return false
    if (!needle) return true
    return `${thread.guestName} ${thread.reference} ${thread.activityName}`.toLowerCase().includes(needle)
  })
  const selected = threads.find((thread) => thread.id === selectedId) ?? visible[0] ?? null

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [selected?.id, selected?.messages.length])

  const send = () => {
    if (!selected || !draft.trim()) return
    reply(selected.id, draft.trim(), staffName)
    setDraft('')
    toast.success(`Sent by ${CHANNEL[selected.channel].label.toLowerCase()}`, { description: `To ${selected.guestName}` })
  }

  if (threads.length === 0) {
    return <EmptyState icon={MessageCircle} title="No conversations yet" description="Replies to your messages and questions from the guest page land here." />
  }

  const statusBadge = (status: ThreadStatus) =>
    status === 'open' ? <Badge variant="info" size="sm">Needs a reply</Badge> : status === 'waiting' ? <Badge variant="neutral" size="sm">Waiting on guest</Badge> : <Badge variant="outline" size="sm">Closed</Badge>

  return (
    <div className="grid min-h-[36rem] gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-3">
        <SearchInput value={query} onValueChange={setQuery} label="Search conversations" placeholder="Guest, code or activity…" shortcut={false} />
        <Segmented
          label="Filter"
          value={filter}
          onValueChange={setFilter}
          fullWidth
          options={[
            { value: 'open', label: 'Open', count: counts.open },
            { value: 'all', label: 'All', count: counts.all },
            { value: 'closed', label: 'Closed', count: counts.closed },
          ]}
        />
        <ul className="flex list-none flex-col gap-1.5 p-0">
          {visible.map((thread) => {
            const last = thread.messages[thread.messages.length - 1]
            const Icon = CHANNEL[thread.channel].icon
            const on = selected?.id === thread.id
            return (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(thread.id)}
                  className={cn('flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors', on ? 'border-primary bg-primary-soft/25' : 'border-line bg-surface hover:border-line-strong')}
                >
                  <Avatar name={thread.guestName} src={thread.avatarUrl} size="sm" className="shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className={cn('truncate text-sm', thread.status === 'open' ? 'font-semibold text-foreground' : 'font-medium text-foreground')}>{thread.guestName}</span>
                      <span className="shrink-0 text-xs text-subtle">{last ? formatRelative(last.at, now) : ''}</span>
                    </span>
                    <span className="flex items-center gap-1.5 truncate text-xs text-muted">
                      <Icon className="size-3 shrink-0" aria-hidden="true" />
                      <span className="truncate">{last?.from === 'staff' ? 'You: ' : ''}{last?.body}</span>
                    </span>
                  </span>
                  {thread.status === 'open' ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Needs a reply" /> : null}
                </button>
              </li>
            )
          })}
          {visible.length === 0 ? <li className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">Nothing here.</li> : null}
        </ul>
      </div>

      {selected ? (
        <section className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-3.5">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {selected.guestName} {statusBadge(selected.status)}
              </p>
              <p className="truncate text-xs text-subtle">
                {selected.activityName} · {formatDateLong(new Date(selected.startsAt))} {formatTime(selected.startsAt)} · {selected.reference} · via {CHANNEL[selected.channel].label}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {selected.phone ? (
                <Button asChild variant="ghost" size="sm" aria-label={`Call ${selected.guestName}`}>
                  <a href={`tel:${selected.phone.replace(/[^\d+]/g, '')}`}><Phone className="size-4" aria-hidden="true" /></a>
                </Button>
              ) : null}
              {selected.bookingId ? (
                <Button asChild variant="outline" size="sm" rightIcon={<ArrowUpRight />}>
                  <Link href={`/dashboard/bookings/${selected.bookingId}`}>Booking</Link>
                </Button>
              ) : null}
              {selected.status !== 'closed' ? (
                <Button variant="ghost" size="sm" leftIcon={<Check />} onClick={() => { setStatus(selected.id, 'closed'); toast('Conversation closed') }}>
                  Close
                </Button>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setStatus(selected.id, 'open')}>Reopen</Button>
              )}
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
            {selected.messages.map((message) => (
              <div key={message.id} className={cn('flex flex-col', message.from === 'staff' ? 'items-end' : 'items-start')}>
                <p
                  className={cn(
                    'max-w-[32rem] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line',
                    message.from === 'staff' ? 'rounded-br-md bg-primary text-on-primary' : 'rounded-bl-md bg-surface-sunken text-foreground',
                  )}
                >
                  {message.body}
                </p>
                <span className="mt-1 text-xs text-faint">
                  {message.from === 'staff' ? `${message.author ?? 'You'} · ` : ''}
                  {formatRelative(message.at, now)}
                </span>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <footer className="border-t border-line-subtle px-5 py-3.5">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_REPLIES.map((text) => (
                <button key={text} type="button" onClick={() => setDraft(text)} className="max-w-[16rem] truncate rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-primary/50 hover:text-foreground">
                  {text}
                </button>
              ))}
            </div>
            <form
              className="flex items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                send()
              }}
            >
              <Textarea
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    send()
                  }
                }}
                placeholder={`Reply by ${CHANNEL[selected.channel].label.toLowerCase()}…`}
                aria-label="Reply"
                className="flex-1"
              />
              <Button type="submit" leftIcon={<Send />} disabled={!draft.trim()}>Send</Button>
            </form>
          </footer>
        </section>
      ) : null}
    </div>
  )
}
