'use client'

import * as React from 'react'
import Link from 'next/link'
import { Anchor, CalendarDays, Check, Copy, ExternalLink, Inbox, Send, Users, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useCharterRequests } from '@/hooks/use-charter-requests'
import { cn, formatCurrency, formatDateLong, formatRelative, formatTime } from '@/lib/utils'
import type { CharterRequest, CharterRequestStatus, CurrencyCode } from '@/types'

/* ==========================================================================
   CHARTER REQUESTS
   Enquiries from request-to-book charters: read the plan, send a quote with
   a deposit and a payment link, and see it paid.
   ========================================================================== */

export interface RequestActivity {
  slug: string
  name: string
  maxGuests: number
  tiers: { id: string; label: string; price: number }[]
}

const STATUS_META: Record<CharterRequestStatus, { label: string; variant: 'info' | 'warning' | 'success' | 'neutral' }> = {
  new: { label: 'New', variant: 'info' },
  quoted: { label: 'Quote sent', variant: 'warning' },
  paid: { label: 'Deposit paid', variant: 'success' },
  declined: { label: 'Declined', variant: 'neutral' },
}

type Filter = 'all' | CharterRequestStatus

export function RequestsInbox({
  tenantId,
  tenantSlug,
  seeded,
  activities,
  currency,
  nowIso,
}: {
  tenantId: string
  tenantSlug: string
  seeded: CharterRequest[]
  activities: RequestActivity[]
  currency: CurrencyCode
  nowIso: string
}) {
  const { requests, sendQuote, decline, markPaid } = useCharterRequests(tenantSlug, tenantId, seeded)
  const [filter, setFilter] = React.useState<Filter>('all')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [quoting, setQuoting] = React.useState(false)
  const [declining, setDeclining] = React.useState(false)
  const now = React.useMemo(() => new Date(nowIso), [nowIso])

  const visible = requests.filter((request) => filter === 'all' || request.status === filter)
  const selected = requests.find((request) => request.id === selectedId) ?? visible[0] ?? null
  const activityOf = (slug: string) => activities.find((activity) => activity.slug === slug)
  const count = (status: CharterRequestStatus) => requests.filter((request) => request.status === status).length

  const linkFor = (request: CharterRequest) => `/book/${tenantSlug}/quote/${request.id}`
  const copyLink = async (request: CharterRequest) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${linkFor(request)}`)
      toast.success('Payment link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  if (requests.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No charter requests yet"
        description="Turn on Request to book for a private charter and guests can send their plan from the storefront. Requests land here."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
        <Segmented
          label="Filter requests"
          value={filter}
          onValueChange={setFilter}
          className="min-w-max"
          options={[
            { value: 'all', label: 'All', count: requests.length },
            { value: 'new', label: 'New', count: count('new') },
            { value: 'quoted', label: 'Quote sent', count: count('quoted') },
            { value: 'paid', label: 'Paid', count: count('paid') },
            { value: 'declined', label: 'Declined', count: count('declined') },
          ]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <ul className="flex list-none flex-col gap-2 p-0">
          {visible.map((request) => {
            const activity = activityOf(request.activitySlug)
            const on = selected?.id === request.id
            return (
              <li key={request.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(request.id)}
                  className={cn(
                    'flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors',
                    on ? 'border-primary bg-primary-soft/25' : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{request.name}</span>
                    <Badge variant={STATUS_META[request.status].variant} size="sm">{STATUS_META[request.status].label}</Badge>
                  </span>
                  <span className="truncate text-xs text-muted">
                    {activity?.name ?? 'Charter'} · {request.startsAt ? formatDateLong(new Date(request.startsAt)) : 'Date to confirm'}
                  </span>
                  <span className="truncate text-xs text-subtle">
                    {request.party} guests · {request.createdAt ? formatRelative(request.createdAt, now) : ''}
                  </span>
                </button>
              </li>
            )
          })}
          {visible.length === 0 ? <li className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-subtle">Nothing here.</li> : null}
        </ul>

        {selected ? (
          <article className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{selected.name}</h2>
                <a href={`mailto:${selected.email}`} className="text-sm text-primary hover:underline">{selected.email}</a>
              </div>
              <Badge variant={STATUS_META[selected.status].variant}>{STATUS_META[selected.status].label}</Badge>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div className="flex items-start gap-2">
                <Anchor className="mt-0.5 size-4 text-faint" aria-hidden="true" />
                <div>
                  <dt className="text-xs text-subtle">Charter</dt>
                  <dd className="font-medium">
                    {activityOf(selected.activitySlug)?.name ?? 'Charter'}
                    {selected.tierId ? <span className="block text-xs font-normal text-muted">{activityOf(selected.activitySlug)?.tiers.find((tier) => tier.id === selected.tierId)?.label}</span> : null}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 size-4 text-faint" aria-hidden="true" />
                <div>
                  <dt className="text-xs text-subtle">When</dt>
                  <dd className="font-medium">{selected.startsAt ? `${formatDateLong(new Date(selected.startsAt))} · ${formatTime(selected.startsAt)}` : 'To confirm'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 size-4 text-faint" aria-hidden="true" />
                <div>
                  <dt className="text-xs text-subtle">Group</dt>
                  <dd className="font-medium">{selected.party} guests</dd>
                </div>
              </div>
            </dl>

            {selected.message ? (
              <blockquote className="mt-4 rounded-xl bg-surface-sunken px-4 py-3 text-sm leading-relaxed text-foreground">{selected.message}</blockquote>
            ) : null}

            {selected.quote ? (
              <div className="mt-4 rounded-xl border border-line px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">Quote {formatCurrency(selected.quote.amount, currency)}</p>
                  <p className="text-xs text-subtle">
                    {selected.quote.depositPercent}% deposit · {formatCurrency(Math.round((selected.quote.amount * selected.quote.depositPercent) / 100), currency)} · valid until {formatDateLong(new Date(`${selected.quote.validUntil}T12:00:00`))}
                  </p>
                </div>
                {selected.quote.note ? <p className="mt-1.5 text-sm text-muted">{selected.quote.note}</p> : null}
                {selected.status === 'paid' && selected.paidAt ? (
                  <p className="mt-2 text-xs font-medium text-success">Deposit paid {formatRelative(selected.paidAt, now)}. The charter is on the calendar.</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-2 border-t border-line-subtle pt-4">
              {selected.status === 'new' ? (
                <>
                  <Button leftIcon={<Send />} onClick={() => setQuoting(true)}>Send a quote</Button>
                  <Button variant="ghost" leftIcon={<X />} onClick={() => setDeclining(true)}>Decline</Button>
                </>
              ) : null}
              {selected.status === 'quoted' ? (
                <>
                  <Button variant="secondary" leftIcon={<Copy />} onClick={() => copyLink(selected)}>Copy payment link</Button>
                  <Button asChild variant="outline" rightIcon={<ExternalLink />}>
                    <Link href={linkFor(selected)} target="_blank">Open the guest's page</Link>
                  </Button>
                  <Button variant="ghost" leftIcon={<Check />} onClick={() => { markPaid(selected.id); toast.success('Marked as paid') }}>Mark paid</Button>
                  <Button variant="ghost" onClick={() => setQuoting(true)}>Revise quote</Button>
                </>
              ) : null}
              {selected.status === 'paid' ? (
                <Button asChild variant="outline" rightIcon={<ExternalLink />}>
                  <Link href={linkFor(selected)} target="_blank">Guest's receipt</Link>
                </Button>
              ) : null}
            </div>
          </article>
        ) : null}
      </div>

      {selected ? (
        <QuoteDialog
          open={quoting}
          onOpenChange={setQuoting}
          request={selected}
          activity={activityOf(selected.activitySlug)}
          currency={currency}
          onSend={(quote) => {
            sendQuote(selected.id, quote)
            setQuoting(false)
            toast.success(`Quote sent to ${selected.name}`, { description: 'They get a payment link for the deposit.' })
          }}
        />
      ) : null}

      <Dialog open={declining} onOpenChange={setDeclining}>
        <DialogContent size="sm">
          <DialogHeader divider>
            <DialogTitle>Decline this request</DialogTitle>
            <DialogDescription>The guest gets a polite note with your reason.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-2 py-4">
            {['The boat is already chartered that day', 'The group is larger than we carry', 'We do not run that kind of event'].map((reason) => (
              <Button
                key={reason}
                variant="outline"
                className="justify-start"
                onClick={() => {
                  if (selected) decline(selected.id, reason)
                  setDeclining(false)
                  toast('Request declined', { description: reason })
                }}
              >
                {reason}
              </Button>
            ))}
          </DialogBody>
          <DialogFooter divider>
            <Button variant="ghost" size="sm" onClick={() => setDeclining(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function QuoteDialog({
  open,
  onOpenChange,
  request,
  activity,
  currency,
  onSend,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  request: CharterRequest
  activity?: RequestActivity
  currency: CurrencyCode
  onSend: (quote: { amount: number; depositPercent: number; note: string; validUntil: string }) => void
}) {
  const base = request.quote?.amount ?? activity?.tiers.find((tier) => tier.id === request.tierId)?.price ?? activity?.tiers[0]?.price ?? 0
  const [amount, setAmount] = React.useState(base)
  const [deposit, setDeposit] = React.useState(String(request.quote?.depositPercent ?? 30))
  const [days, setDays] = React.useState('7')
  const [note, setNote] = React.useState(request.quote?.note ?? '')

  React.useEffect(() => {
    if (!open) return
    setAmount(base)
    setDeposit(String(request.quote?.depositPercent ?? 30))
    setNote(request.quote?.note ?? '')
  }, [open, base, request.quote])

  const validUntil = () => {
    const d = new Date()
    d.setDate(d.getDate() + Number(days))
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader divider>
          <DialogTitle>Quote for {request.name}</DialogTitle>
          <DialogDescription>{request.party} guests · {activity?.name ?? 'Charter'}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Charter price" required description="For the whole group.">
              {(control) => <Input {...control} type="number" min={0} value={amount / 100 || ''} onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value) * 100)))} />}
            </Field>
            <Field label="Deposit now">
              <Select value={deposit} onValueChange={setDeposit}>
                <SelectTrigger aria-label="Deposit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['25', '30', '50', '100'].map((value) => (
                    <SelectItem key={value} value={value}>{value === '100' ? 'Full amount' : `${value}%`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Valid for">
              <Select value={days} onValueChange={setDays}>
                <SelectTrigger aria-label="Valid for"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['3', '7', '14'].map((value) => (
                    <SelectItem key={value} value={value}>{value} days</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Note to the guest" optional>
            {(control) => <Textarea {...control} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What the price includes, catering, timing, the balance date." />}
          </Field>
          <p className="text-xs text-subtle">
            Deposit due now: {formatCurrency(Math.round((amount * Number(deposit)) / 100), currency)}. The guest pays it from a link; the balance is collected before the day.
          </p>
        </DialogBody>
        <DialogFooter divider>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" leftIcon={<Send />} disabled={amount <= 0} onClick={() => onSend({ amount, depositPercent: Number(deposit), note: note.trim(), validUntil: validUntil() })}>
            Send quote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
