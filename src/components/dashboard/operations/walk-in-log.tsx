'use client'

import * as React from 'react'
import { Banknote, CheckCircle2, CreditCard, Download, Mail, Phone, Printer, RotateCcw, Undo2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toaster'
import { TicketQr, ticketPayload } from '@/components/ui/ticket-qr'
import { cn, formatCurrency, formatTime, pluralize } from '@/lib/utils'
import { WALK_IN_STATUS_LABEL, dayKeys, summarize, walkInsCsv, type WalkInRecord, type WalkInStatus } from '@/lib/walk-ins'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   The walk-in log: every sale at the desk with the guest's details, how it
   was paid and where it stands. Open one to check it in, refund it or
   reprint the ticket.
   ========================================================================== */

type Period = 'today' | '7' | '30' | 'all'
type MethodFilter = 'all' | 'card' | 'cash'

const STATUS_TONE: Record<WalkInStatus, 'primary' | 'success' | 'danger'> = {
  paid: 'primary',
  checked_in: 'success',
  refunded: 'danger',
}

const dayLabel = (iso: string, todayKey: string) => {
  const key = iso.slice(0, 10)
  if (key === todayKey) return 'Today'
  if (key === dayKeys(todayKey, 2)[0]) return 'Yesterday'
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${key}T12:00:00`))
}

export function WalkInLog({
  records,
  currency,
  nowIso,
  tenantName,
  onStatus,
}: {
  records: WalkInRecord[]
  currency: CurrencyCode
  nowIso: string
  tenantName: string
  onStatus: (reference: string, status: WalkInStatus) => void
}) {
  const todayKey = nowIso.slice(0, 10)
  const [query, setQuery] = React.useState('')
  const [period, setPeriod] = React.useState<Period>('7')
  const [method, setMethod] = React.useState<MethodFilter>('all')
  const [status, setStatus] = React.useState<WalkInStatus | 'all'>('all')
  const [openRef, setOpenRef] = React.useState<string | null>(null)

  const from = period === 'today' ? todayKey : period === 'all' ? '' : dayKeys(todayKey, Number(period))[0]
  const needle = query.trim().toLowerCase()
  const shown = records.filter((record) => {
    if (from && record.soldAt.slice(0, 10) < from) return false
    if (method !== 'all' && record.method !== method) return false
    if (status !== 'all' && record.status !== status) return false
    if (!needle) return true
    return [record.reference, record.guest.name, record.guest.phone, record.guest.email, record.activityName].some((value) => value.toLowerCase().includes(needle))
  })
  const summary = summarize(shown)
  const open = records.find((record) => record.reference === openRef) ?? null

  const exportCsv = () => {
    const blob = new Blob([walkInsCsv(shown)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `walk-ins-${todayKey}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${shown.length} ${pluralize(shown.length, 'walk-in')}`)
  }

  /* group by the day sold, newest first */
  const days: { key: string; items: WalkInRecord[] }[] = []
  for (const record of shown) {
    const key = record.soldAt.slice(0, 10)
    const last = days[days.length - 1]
    if (last && last.key === key) last.items.push(record)
    else days.push({ key, items: [record] })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            label="Search walk-ins"
            placeholder="Name, phone, email, reference or activity"
            shortcut={false}
            className="min-w-60 flex-1"
          />
          <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
            <SelectTrigger className="w-40" aria-label="Period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="all">All walk-ins</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as WalkInStatus | 'all')}>
            <SelectTrigger className="w-40" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              {(Object.keys(WALK_IN_STATUS_LABEL) as WalkInStatus[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {WALK_IN_STATUS_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Segmented
            label="Payment method"
            value={method}
            onValueChange={setMethod}
            options={[
              { value: 'all', label: 'All' },
              { value: 'card', label: 'Card', icon: CreditCard },
              { value: 'cash', label: 'Cash', icon: Banknote },
            ]}
          />
          <Button variant="secondary" leftIcon={<Download />} onClick={exportCsv} disabled={shown.length === 0}>
            Export
          </Button>
        </div>
        <p className="text-xs text-muted">
          {shown.length} {pluralize(shown.length, 'walk-in')} · {formatCurrency(summary.revenue, currency)} kept · {summary.guests} {pluralize(summary.guests, 'guest')}
          {summary.refunds > 0 ? ` · ${summary.refunds} refunded (${formatCurrency(summary.refunded, currency)})` : ''}
        </p>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Banknote} title="No walk-ins match" description="Try a longer period or clear the search." />
      ) : (
        <div className="type-crm overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface-sunken/60 text-[0.8125rem] font-semibold text-muted">
                  <th className="px-4 py-2.5">Sold</th>
                  <th className="px-4 py-2.5">Guest</th>
                  <th className="px-4 py-2.5">Activity</th>
                  <th className="px-4 py-2.5 text-right">Guests</th>
                  <th className="px-4 py-2.5">Paid</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              {days.map((day) => {
                const daySum = summarize(day.items)
                return (
                  <tbody key={day.key}>
                    <tr className="border-b border-line-subtle bg-background-subtle">
                      <td colSpan={7} className="px-4 py-2 text-xs font-semibold text-muted">
                        {dayLabel(day.key, todayKey)}
                        <span className="ml-2 font-medium text-subtle">
                          {day.items.length} {pluralize(day.items.length, 'walk-in')} · {formatCurrency(daySum.revenue, currency)} kept
                        </span>
                      </td>
                    </tr>
                    {day.items.map((record) => (
                      <tr
                        key={record.reference}
                        tabIndex={0}
                        onClick={() => setOpenRef(record.reference)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setOpenRef(record.reference)
                          }
                        }}
                        className="cursor-pointer border-b border-line-subtle text-sm transition-colors last:border-b-0 hover:bg-surface-sunken/50 focus-visible:bg-primary-soft/30 focus-visible:outline-none"
                      >
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                          {formatTime(record.soldAt)}
                          <span className="block font-mono text-xs text-subtle">{record.reference}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block font-medium text-foreground">{record.guest.name}</span>
                          <span className="block text-xs text-subtle">{record.guest.phone || record.guest.email || 'No contact given'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="block max-w-64 truncate">{record.activityName}</span>
                          <span className="block text-xs text-subtle">{dayLabel(record.startsAt, todayKey)} · {formatTime(record.startsAt)}</span>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{record.guests}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-muted">
                            {record.method === 'cash' ? <Banknote className="size-4" aria-hidden="true" /> : <CreditCard className="size-4" aria-hidden="true" />}
                            {record.method === 'cash' ? 'Cash' : 'Card'}
                          </span>
                          <span className="block text-xs text-subtle">by {record.staff}</span>
                        </td>
                        <td className={cn('px-4 py-3 text-right font-semibold tabular-nums', record.status === 'refunded' && 'text-subtle line-through')}>
                          {formatCurrency(record.total, currency)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={STATUS_TONE[record.status]} size="sm">
                            {WALK_IN_STATUS_LABEL[record.status]}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                )
              })}
            </table>
          </div>
        </div>
      )}

      <WalkInSheet
        record={open}
        currency={currency}
        tenantName={tenantName}
        todayKey={todayKey}
        onClose={() => setOpenRef(null)}
        onStatus={onStatus}
      />
    </div>
  )
}

function WalkInSheet({
  record,
  currency,
  tenantName,
  todayKey,
  onClose,
  onStatus,
}: {
  record: WalkInRecord | null
  currency: CurrencyCode
  tenantName: string
  todayKey: string
  onClose: () => void
  onStatus: (reference: string, status: WalkInStatus) => void
}) {
  const [confirmRefund, setConfirmRefund] = React.useState(false)
  React.useEffect(() => setConfirmRefund(false), [record?.reference])

  const change = (next: WalkInStatus, message: string) => {
    if (!record) return
    onStatus(record.reference, next)
    toast.success(message, { description: `${record.reference} · ${record.guest.name}` })
  }

  return (
    <Sheet open={Boolean(record)} onOpenChange={(value) => (value ? null : onClose())}>
      <SheetContent side="right" size="md" className="flex flex-col p-0">
        {record ? (
          <>
            <SheetHeader>
              <p className="font-mono text-xs font-semibold tracking-widest text-subtle">{record.reference}</p>
              <SheetTitle className="mt-1 text-lg leading-snug">{record.guest.name}</SheetTitle>
              <SheetDescription>
                {record.activityName} · {dayLabel(record.startsAt, todayKey)} {formatTime(record.startsAt)} · {record.guests} {pluralize(record.guests, 'guest')}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-5 [&>*]:shrink-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_TONE[record.status]}>{WALK_IN_STATUS_LABEL[record.status]}</Badge>
                <span className="text-xs text-subtle">
                  Sold {dayLabel(record.soldAt, todayKey).toLowerCase()} at {formatTime(record.soldAt)} by {record.staff}
                </span>
              </div>

              <section>
                <h3 className="text-xs font-semibold tracking-[0.08em] text-faint uppercase">Guest</h3>
                <dl className="mt-2 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
                  <dt className="text-subtle">Mobile</dt>
                  <dd>{record.guest.phone ? <a className="inline-flex items-center gap-1.5 text-primary hover:underline" href={`tel:${record.guest.phone}`}><Phone className="size-3.5" aria-hidden="true" />{record.guest.phone}</a> : <span className="text-faint">Not given</span>}</dd>
                  <dt className="text-subtle">Email</dt>
                  <dd className="min-w-0 truncate">{record.guest.email ? <a className="inline-flex items-center gap-1.5 text-primary hover:underline" href={`mailto:${record.guest.email}`}><Mail className="size-3.5" aria-hidden="true" />{record.guest.email}</a> : <span className="text-faint">Not given</span>}</dd>
                  <dt className="text-subtle">Country</dt>
                  <dd>{record.guest.country || <span className="text-faint">Not given</span>}</dd>
                  <dt className="text-subtle">Heard from</dt>
                  <dd>{record.guest.source || <span className="text-faint">Not asked</span>}</dd>
                  <dt className="text-subtle">Offers</dt>
                  <dd>{record.guest.marketing ? 'Opted in' : 'Not opted in'}</dd>
                </dl>
              </section>

              <section>
                <h3 className="text-xs font-semibold tracking-[0.08em] text-faint uppercase">Sale</h3>
                <ul className="mt-2 flex list-none flex-col gap-1 rounded-xl border border-line p-3 text-sm">
                  {record.lines.map((line) => (
                    <li key={line.label} className="flex justify-between gap-3"><span className="text-muted">{line.label}</span><span className="tabular-nums">{formatCurrency(line.total, currency)}</span></li>
                  ))}
                  <li className="mt-1 flex justify-between border-t border-line pt-2 font-semibold">
                    <span className="inline-flex items-center gap-1.5">
                      {record.method === 'cash' ? <Banknote className="size-4" aria-hidden="true" /> : <CreditCard className="size-4" aria-hidden="true" />}
                      Paid by {record.method}
                    </span>
                    <span className={cn('tabular-nums', record.status === 'refunded' && 'line-through')}>{formatCurrency(record.total, currency)}</span>
                  </li>
                  {record.status === 'refunded' ? (
                    <li className="flex justify-between text-danger"><span>Refunded {record.method === 'cash' ? 'in cash' : 'to the card'}</span><span className="tabular-nums">−{formatCurrency(record.total, currency)}</span></li>
                  ) : null}
                </ul>
              </section>

              <section className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line p-4">
                <TicketQr value={ticketPayload(record.reference)} size={120} className="border border-line" />
                <p className="text-xs text-subtle">{tenantName} · scan at check-in</p>
              </section>
            </SheetBody>
            <SheetFooter className="flex flex-wrap gap-2">
              <Button variant="secondary" leftIcon={<Printer />} onClick={() => window.print()}>
                Reprint
              </Button>
              {record.status === 'paid' ? (
                <Button leftIcon={<CheckCircle2 />} onClick={() => change('checked_in', 'Checked in')}>
                  Check in
                </Button>
              ) : null}
              {record.status === 'checked_in' ? (
                <Button variant="secondary" leftIcon={<RotateCcw />} onClick={() => change('paid', 'Check-in undone')}>
                  Undo check-in
                </Button>
              ) : null}
              {record.status !== 'refunded' ? (
                confirmRefund ? (
                  <Button variant="danger" leftIcon={<Undo2 />} onClick={() => change('refunded', `Refunded ${formatCurrency(record.total, currency)}`)}>
                    Confirm refund of {formatCurrency(record.total, currency)}
                  </Button>
                ) : (
                  <Button variant="ghost" leftIcon={<Undo2 />} onClick={() => setConfirmRefund(true)}>
                    Refund
                  </Button>
                )
              ) : null}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
