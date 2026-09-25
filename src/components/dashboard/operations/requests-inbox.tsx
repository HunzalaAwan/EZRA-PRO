'use client'

import * as React from 'react'
import Link from 'next/link'
import { CalendarDays, Check, Copy, ExternalLink, FileText, Inbox, Mail, MessageSquareText, Plus, Send, Ticket, Trash2, Users, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useCharterRequests } from '@/hooks/use-charter-requests'
import { ACTIVITY_KIND_META } from '@/lib/activity-kinds'
import { cn, formatCurrency, formatDateLong, formatRelative, formatTime } from '@/lib/utils'
import type { ActivityKind, CharterRequest, CharterRequestStatus, CurrencyCode } from '@/types'

/* ==========================================================================
   CUSTOM REQUESTS
   One inbox for two things: quote requests guests send from the storefront
   (charters and "ask for a custom quote" on any activity), and custom
   invoices the business makes for anyone: a corporate group, a wedding
   party, a hotel concierge, a private event. Each gets a payment link.
   ========================================================================== */

export interface RequestActivity {
  slug: string
  name: string
  kind: ActivityKind
  /** Charters are priced for the whole group; everything else per guest. */
  perGroup: boolean
  maxGuests: number
  tiers: { id: string; label: string; price: number }[]
}

const STATUS_META: Record<CharterRequestStatus, { label: string; variant: 'info' | 'warning' | 'success' | 'neutral' }> = {
  new: { label: 'New', variant: 'info' },
  quoted: { label: 'Sent', variant: 'warning' },
  paid: { label: 'Paid', variant: 'success' },
  declined: { label: 'Declined', variant: 'neutral' },
}

type Filter = 'all' | CharterRequestStatus
type Source = 'all' | 'request' | 'invoice'

const sourceOf = (request: CharterRequest) => request.source ?? 'request'

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
  const { requests, sendQuote, decline, markPaid, createInvoice, nextInvoiceNumber } = useCharterRequests(tenantSlug, tenantId, seeded)
  const [filter, setFilter] = React.useState<Filter>('all')
  const [source, setSource] = React.useState<Source>('all')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [quoting, setQuoting] = React.useState(false)
  const [declining, setDeclining] = React.useState(false)
  const [invoicing, setInvoicing] = React.useState(false)
  const now = React.useMemo(() => new Date(nowIso), [nowIso])

  const inSource = requests.filter((request) => source === 'all' || sourceOf(request) === source)
  const visible = inSource.filter((request) => filter === 'all' || request.status === filter)
  const selected = requests.find((request) => request.id === selectedId) ?? visible[0] ?? null
  const activityOf = (slug: string) => activities.find((activity) => activity.slug === slug)
  const count = (status: CharterRequestStatus) => inSource.filter((request) => request.status === status).length
  const awaiting = requests.filter((request) => request.status === 'quoted').reduce((sum, request) => sum + (request.quote?.amount ?? 0), 0)

  const linkFor = (request: CharterRequest) => `/book/${tenantSlug}/quote/${request.id}`
  const copyLink = async (request: CharterRequest) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${linkFor(request)}`)
      toast.success('Payment link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Type"
          value={source}
          onValueChange={setSource}
          options={[
            { value: 'all', label: 'Everything', count: requests.length },
            { value: 'request', label: 'Guest requests', icon: Inbox, count: requests.filter((request) => sourceOf(request) === 'request').length },
            { value: 'invoice', label: 'Invoices', icon: FileText, count: requests.filter((request) => sourceOf(request) === 'invoice').length },
          ]}
        />
        <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
          <Segmented
            label="Status"
            value={filter}
            onValueChange={setFilter}
            className="min-w-max"
            options={[
              { value: 'all', label: 'Any status' },
              { value: 'new', label: 'New', count: count('new') },
              { value: 'quoted', label: 'Sent', count: count('quoted') },
              { value: 'paid', label: 'Paid', count: count('paid') },
              { value: 'declined', label: 'Declined', count: count('declined') },
            ]}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        {awaiting > 0 ? <span className="text-sm text-subtle tabular-nums">{formatCurrency(awaiting, currency)} waiting to be paid</span> : null}
        <Button leftIcon={<Plus />} onClick={() => setInvoicing(true)}>
          New invoice
        </Button>
      </div>
    </div>
  )

  const invoiceDialog = (
    <InvoiceDialog
      open={invoicing}
      onOpenChange={setInvoicing}
      activities={activities}
      currency={currency}
      number={nextInvoiceNumber()}
      nowIso={nowIso}
      onCreate={(invoice) => {
        createInvoice({ ...invoice, tenantId })
        setInvoicing(false)
        setSource('all')
        setFilter('all')
        setSelectedId(invoice.id)
        toast.success(`${invoice.number} sent to ${invoice.name}`, { description: 'They get a payment link by email or text.' })
      }}
    />
  )

  if (requests.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {toolbar}
        <EmptyState
          icon={Inbox}
          title="No requests or invoices yet"
          description="Guests can ask for a custom quote from any activity page. You can also send an invoice to anyone with New invoice."
        />
        {invoiceDialog}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {toolbar}

      <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <ul className="flex list-none flex-col gap-2 p-0">
          {visible.map((request) => {
            const activity = activityOf(request.activitySlug)
            const on = selected?.id === request.id
            const invoice = sourceOf(request) === 'invoice'
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
                    <span className="flex min-w-0 items-center gap-1.5">
                      {invoice ? <FileText className="size-3.5 shrink-0 text-faint" aria-hidden="true" /> : <Inbox className="size-3.5 shrink-0 text-faint" aria-hidden="true" />}
                      <span className="truncate text-sm font-semibold text-foreground">{request.name}</span>
                    </span>
                    <Badge variant={STATUS_META[request.status].variant} size="sm">{STATUS_META[request.status].label}</Badge>
                  </span>
                  <span className="truncate text-xs text-muted">
                    {invoice ? `${request.number} · ` : ''}
                    {activity?.name ?? (invoice ? 'Custom invoice' : 'Request')}
                    {request.startsAt ? ` · ${formatDateLong(new Date(request.startsAt))}` : ''}
                  </span>
                  <span className="flex justify-between gap-2 truncate text-xs text-subtle">
                    <span>
                      {request.party > 0 ? `${request.party} guests · ` : ''}
                      {request.createdAt ? formatRelative(request.createdAt, now) : ''}
                    </span>
                    {request.quote ? <span className="font-medium text-muted tabular-nums">{formatCurrency(request.quote.amount, currency)}</span> : null}
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
                <p className="text-xs font-semibold tracking-[0.08em] text-faint uppercase">
                  {sourceOf(selected) === 'invoice' ? `Invoice ${selected.number ?? ''}` : 'Guest request'}
                </p>
                <h2 className="mt-0.5 text-lg font-semibold text-foreground">{selected.name}</h2>
                <p className="flex flex-wrap gap-x-3 text-sm">
                  {selected.email ? <a href={`mailto:${selected.email}`} className="text-primary hover:underline">{selected.email}</a> : null}
                  {selected.phone ? <a href={`tel:${selected.phone}`} className="text-primary hover:underline">{selected.phone}</a> : null}
                </p>
              </div>
              <Badge variant={STATUS_META[selected.status].variant}>{STATUS_META[selected.status].label}</Badge>
            </div>

            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
              <div className="flex items-start gap-2">
                <Ticket className="mt-0.5 size-4 text-faint" aria-hidden="true" />
                <div>
                  <dt className="text-xs text-subtle">For</dt>
                  <dd className="font-medium">
                    {activityOf(selected.activitySlug)?.name ?? 'Not linked to an activity'}
                    {activityOf(selected.activitySlug) ? (
                      <span className="block text-xs font-normal text-muted">
                        {ACTIVITY_KIND_META[activityOf(selected.activitySlug)!.kind].label}
                        {selected.tierId ? ` · ${activityOf(selected.activitySlug)?.tiers.find((tier) => tier.id === selected.tierId)?.label ?? ''}` : ''}
                      </span>
                    ) : null}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 size-4 text-faint" aria-hidden="true" />
                <div>
                  <dt className="text-xs text-subtle">When</dt>
                  <dd className="font-medium">{selected.startsAt ? `${formatDateLong(new Date(selected.startsAt))} · ${formatTime(selected.startsAt)}` : 'To arrange'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Users className="mt-0.5 size-4 text-faint" aria-hidden="true" />
                <div>
                  <dt className="text-xs text-subtle">Group</dt>
                  <dd className="font-medium">{selected.party > 0 ? `${selected.party} guests` : 'Not set'}</dd>
                </div>
              </div>
            </dl>

            {selected.message ? (
              <blockquote className="mt-4 rounded-xl bg-surface-sunken px-4 py-3 text-sm leading-relaxed text-foreground">{selected.message}</blockquote>
            ) : null}

            {selected.lines && selected.lines.length > 0 ? (
              <ul className="mt-4 list-none space-y-1.5 rounded-xl border border-line p-0 px-4 py-3 text-sm">
                {selected.lines.map((line, index) => (
                  <li key={index} className="flex justify-between gap-3">
                    <span className="text-muted">
                      {line.label}
                      {line.qty > 1 ? <span className="text-subtle"> × {line.qty} at {formatCurrency(line.unit, currency)}</span> : null}
                    </span>
                    <span className="tabular-nums">{formatCurrency(line.unit * line.qty, currency)}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {selected.quote ? (
              <div className="mt-4 rounded-xl border border-line px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">Total {formatCurrency(selected.quote.amount, currency)}</p>
                  <p className="text-xs text-subtle">
                    {selected.quote.depositPercent >= 100 ? 'Paid in full' : `${selected.quote.depositPercent}% deposit · ${formatCurrency(Math.round((selected.quote.amount * selected.quote.depositPercent) / 100), currency)}`} · due by{' '}
                    {formatDateLong(new Date(`${selected.quote.validUntil}T12:00:00`))}
                  </p>
                </div>
                {selected.quote.note ? <p className="mt-1.5 text-sm text-muted">{selected.quote.note}</p> : null}
                {selected.status === 'paid' && selected.paidAt ? (
                  <p className="mt-2 text-xs font-medium text-success">Paid {formatRelative(selected.paidAt, now)}.</p>
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
                  {sourceOf(selected) === 'request' ? <Button variant="ghost" onClick={() => setQuoting(true)}>Revise quote</Button> : null}
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

      {invoiceDialog}

      <Dialog open={declining} onOpenChange={setDeclining}>
        <DialogContent size="sm">
          <DialogHeader divider>
            <DialogTitle>Decline this request</DialogTitle>
            <DialogDescription>The guest gets a polite note with your reason.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-2 py-4">
            {['We are fully booked that day', 'The group is larger than we can take', 'We do not run that kind of event'].map((reason) => (
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

/* ==========================================================================
   QUOTE — answering a guest's request
   ========================================================================== */

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
  const tierPrice = activity?.tiers.find((tier) => tier.id === request.tierId)?.price ?? activity?.tiers[0]?.price ?? 0
  const base = request.quote?.amount ?? (activity?.perGroup ? tierPrice : tierPrice * Math.max(1, request.party))
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader divider>
          <DialogTitle>Quote for {request.name}</DialogTitle>
          <DialogDescription>
            {request.party} guests · {activity?.name ?? 'Custom request'}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Price" required description={activity?.perGroup ? 'For the whole group.' : 'For everyone on the request.'}>
              {(control) => <Input {...control} type="number" min={0} value={amount / 100 || ''} onChange={(e) => setAmount(Math.max(0, Math.round(Number(e.target.value) * 100)))} />}
            </Field>
            <PaySelects deposit={deposit} setDeposit={setDeposit} days={days} setDays={setDays} />
          </div>
          <Field label="Note to the guest" optional>
            {(control) => <Textarea {...control} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What the price includes, timing, the balance date." />}
          </Field>
          <p className="text-xs text-subtle">
            {Number(deposit) >= 100 ? `The guest pays ${formatCurrency(amount, currency)} from a link.` : `Deposit due now: ${formatCurrency(Math.round((amount * Number(deposit)) / 100), currency)}. The balance is collected before the day.`}
          </p>
        </DialogBody>
        <DialogFooter divider>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" leftIcon={<Send />} disabled={amount <= 0} onClick={() => onSend({ amount, depositPercent: Number(deposit), note: note.trim(), validUntil: dueIn(Number(days)) })}>
            Send quote
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const dueIn = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function PaySelects({ deposit, setDeposit, days, setDays }: { deposit: string; setDeposit: (value: string) => void; days: string; setDays: (value: string) => void }) {
  return (
    <>
      <Field label="Pay now">
        <Select value={deposit} onValueChange={setDeposit}>
          <SelectTrigger aria-label="Pay now"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['100', '50', '30', '25'].map((value) => (
              <SelectItem key={value} value={value}>{value === '100' ? 'Full amount' : `${value}% deposit`}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Due within">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger aria-label="Due within"><SelectValue /></SelectTrigger>
          <SelectContent>
            {['3', '7', '14', '30'].map((value) => (
              <SelectItem key={value} value={value}>{value} days</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </>
  )
}

/* ==========================================================================
   NEW INVOICE — to anyone, for any activity or none
   ========================================================================== */

interface Line {
  label: string
  qty: number
  unit: number
}

const NONE = '__none'

function InvoiceDialog({
  open,
  onOpenChange,
  activities,
  currency,
  number,
  nowIso,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activities: RequestActivity[]
  currency: CurrencyCode
  number: string
  nowIso: string
  onCreate: (invoice: CharterRequest) => void
}) {
  const blank = { name: '', email: '', phone: '', activity: NONE, date: '', time: '', party: '', note: '' }
  const [form, setForm] = React.useState(blank)
  const [lines, setLines] = React.useState<Line[]>([{ label: '', qty: 1, unit: 0 }])
  const [discount, setDiscount] = React.useState(0)
  const [deposit, setDeposit] = React.useState('100')
  const [days, setDays] = React.useState('7')
  const [byEmail, setByEmail] = React.useState(true)
  const [byText, setByText] = React.useState(false)
  const [touched, setTouched] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setForm(blank)
    setLines([{ label: '', qty: 1, unit: 0 }])
    setDiscount(0)
    setDeposit('100')
    setDays('7')
    setByEmail(true)
    setByText(false)
    setTouched(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = (patch: Partial<typeof blank>) => setForm((current) => ({ ...current, ...patch }))
  const activity = activities.find((entry) => entry.slug === form.activity)
  const party = Math.max(0, Math.floor(Number(form.party) || 0))
  const subtotal = lines.reduce((sum, line) => sum + line.unit * line.qty, 0)
  const total = Math.max(0, subtotal - discount)
  const emailOk = /^\S+@\S+\.\S+$/.test(form.email.trim())
  const phoneOk = form.phone.replace(/\D/g, '').length >= 8
  const problem =
    form.name.trim().length < 2
      ? 'Add who it is for'
      : byEmail && !emailOk
        ? 'Add a valid email, or send by text only'
        : byText && !phoneOk
          ? 'Add a mobile number to send by text'
          : !byEmail && !byText
            ? 'Choose how to send it'
            : lines.some((line) => line.label.trim().length < 2)
              ? 'Describe every line'
              : total <= 0
                ? 'The total has to be more than zero'
                : null

  // Picking an activity fills the first line from its price, if nothing was typed yet.
  const pickActivity = (slug: string) => {
    set({ activity: slug })
    const next = activities.find((entry) => entry.slug === slug)
    if (!next || lines.some((line) => line.label.trim() || line.unit > 0)) return
    const tier = next.tiers[0]
    setLines([{ label: tier && next.tiers.length > 1 ? `${next.name} · ${tier.label}` : next.name, qty: next.perGroup ? 1 : Math.max(1, party || 1), unit: tier?.price ?? 0 }])
  }

  const setLine = (index: number, patch: Partial<Line>) => setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)))

  const create = () => {
    setTouched(true)
    if (problem) return
    const sentAt = nowIso.slice(0, 19)
    onCreate({
      id: `inv_${Date.now().toString(36)}`,
      tenantId: '',
      source: 'invoice',
      number,
      activitySlug: activity?.slug ?? '',
      startsAt: form.date ? `${form.date}T${form.time || '09:00'}:00` : '',
      party,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      message: '',
      createdAt: sentAt,
      status: 'quoted',
      lines: [...lines.map((line) => ({ ...line, label: line.label.trim() })), ...(discount > 0 ? [{ label: 'Discount', qty: 1, unit: -discount }] : [])],
      quote: { amount: total, depositPercent: Number(deposit), note: form.note.trim(), validUntil: dueIn(Number(days)), sentAt },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader divider>
          <DialogTitle>New invoice {number}</DialogTitle>
          <DialogDescription>For anyone: a group, a company, a hotel concierge. Link it to an activity or leave it open.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5 py-4">
          <section className="grid gap-4 sm:grid-cols-3">
            <Field label="Bill to" required>
              {(control) => <Input {...control} value={form.name} placeholder="Name or company" onChange={(e) => set({ name: e.target.value })} />}
            </Field>
            <Field label="Email" required={byEmail} optional={!byEmail}>
              {(control) => <Input {...control} type="email" value={form.email} placeholder="billing@company.com" onChange={(e) => set({ email: e.target.value })} />}
            </Field>
            <Field label="Mobile" required={byText} optional={!byText}>
              {(control) => <Input {...control} type="tel" value={form.phone} placeholder="+1 808 555 0134" onChange={(e) => set({ phone: e.target.value })} />}
            </Field>
          </section>

          <section className="grid gap-4 sm:grid-cols-4">
            <Field label="For" className="sm:col-span-2">
              <Select value={form.activity} onValueChange={pickActivity}>
                <SelectTrigger aria-label="Activity"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE} description="Merchandise, a deposit, an event, anything">Not linked to an activity</SelectItem>
                  {activities.map((entry) => (
                    <SelectItem key={entry.slug} value={entry.slug} description={ACTIVITY_KIND_META[entry.kind].label}>
                      {entry.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date" optional>
              {(control) => <Input {...control} type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} />}
            </Field>
            <Field label="Guests" optional>
              {(control) => <Input {...control} type="number" min={0} value={form.party} placeholder="0" onChange={(e) => set({ party: e.target.value })} />}
            </Field>
          </section>

          <section>
            <p className="text-sm font-semibold">What you are charging for</p>
            <ul className="mt-2 flex list-none flex-col gap-2 p-0">
              {lines.map((line, index) => (
                <li key={index} className="grid grid-cols-[minmax(0,1fr)_4.5rem_7rem_6rem_2rem] items-center gap-2">
                  <Input value={line.label} placeholder={index === 0 ? 'Private sunset sail for 20' : 'Catering, photos, transfer…'} aria-label="Description" onChange={(e) => setLine(index, { label: e.target.value })} />
                  <Input type="number" min={1} value={line.qty} aria-label="Quantity" onChange={(e) => setLine(index, { qty: Math.max(1, Math.floor(Number(e.target.value) || 1)) })} />
                  <Input type="number" min={0} value={line.unit / 100 || ''} placeholder="Price" aria-label="Unit price" onChange={(e) => setLine(index, { unit: Math.max(0, Math.round(Number(e.target.value) * 100)) })} />
                  <span className="text-right text-sm font-medium tabular-nums">{formatCurrency(line.unit * line.qty, currency)}</span>
                  <button type="button" aria-label="Remove line" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))} className="grid size-8 place-items-center rounded-lg text-faint hover:bg-surface-sunken hover:text-danger disabled:opacity-30">
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <Button variant="secondary" size="sm" leftIcon={<Plus />} onClick={() => setLines((current) => [...current, { label: '', qty: 1, unit: 0 }])}>
                Add a line
              </Button>
              <label className="flex items-center gap-2 text-sm text-muted">
                Discount
                <Input type="number" min={0} className="w-28" size="sm" value={discount / 100 || ''} placeholder="0" aria-label="Discount" onChange={(e) => setDiscount(Math.max(0, Math.round(Number(e.target.value) * 100)))} />
              </label>
            </div>
            <p className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
              <span className="text-sm text-muted">Total</span>
              <span className="font-display text-2xl font-semibold tabular-nums">{formatCurrency(total, currency)}</span>
            </p>
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <PaySelects deposit={deposit} setDeposit={setDeposit} days={days} setDays={setDays} />
            <div className="flex flex-col gap-2">
              <p className="text-[0.8125rem] font-medium">Send by</p>
              <label className="flex items-center justify-between gap-2 text-sm"><span className="inline-flex items-center gap-1.5"><Mail className="size-4 text-faint" aria-hidden="true" />Email</span><Switch size="sm" checked={byEmail} onCheckedChange={setByEmail} aria-label="Send by email" /></label>
              <label className="flex items-center justify-between gap-2 text-sm"><span className="inline-flex items-center gap-1.5"><MessageSquareText className="size-4 text-faint" aria-hidden="true" />Text</span><Switch size="sm" checked={byText} onCheckedChange={setByText} aria-label="Send by text" /></label>
            </div>
          </section>

          <Field label="Note on the invoice" optional>
            {(control) => <Textarea {...control} rows={2} value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder="Thanks for choosing us. The balance is due 14 days before the day." />}
          </Field>
        </DialogBody>
        <DialogFooter divider className="flex-wrap">
          {touched && problem ? <p className="mr-auto text-xs font-medium text-danger">{problem}</p> : <p className="mr-auto text-xs text-subtle">{Number(deposit) >= 100 ? `They pay ${formatCurrency(total, currency)} from the link.` : `They pay ${formatCurrency(Math.round((total * Number(deposit)) / 100), currency)} now.`}</p>}
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button size="sm" leftIcon={<Send />} onClick={create}>
            Send invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
