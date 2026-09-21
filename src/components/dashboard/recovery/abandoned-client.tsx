'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  BadgePercent,
  Check,
  Copy,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Send,
  ShoppingCart,
  Smartphone,
  Monitor,
  X,
} from 'lucide-react'

import { ACTIVITY_COLOR_VAR } from '@/components/charts/chart-container'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { toast } from '@/components/ui/toaster'
import {
  ABANDONED_STAGE_LABEL,
  ABANDONED_STATUS_META,
  type AbandonedCheckout,
  type AbandonedStatus,
} from '@/lib/data/abandoned'
import { cn, formatCurrency, formatDateShort, formatNumber, formatRelative, formatTime } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   <AbandonedClient> — the queue of carts that stopped before payment.

   Four quiet numbers, a filter row, then one line per cart: who, what,
   when it departs, what it was worth, where they stopped, how long ago,
   and the state of the follow-up. Every action is a row-menu item or a
   bulk button; the demo applies them in memory and says what it did.
   ========================================================================== */

type Filter = 'all' | AbandonedStatus

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'reminded', label: 'Reminded' },
  { value: 'recovered', label: 'Recovered' },
  { value: 'expired', label: 'Expired' },
]

function StatusDot({ status }: { status: AbandonedStatus }) {
  const meta = ABANDONED_STATUS_META[status]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8125rem] text-muted" title={meta.hint}>
      <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', meta.tone)} />
      {meta.label}
    </span>
  )
}

export interface AbandonedClientProps {
  rows: AbandonedCheckout[]
  currency: CurrencyCode
  nowIso: string
  recoveryDelayMinutes: number
  recoveryDiscountPercent: number
}

export function AbandonedClient({ rows: initialRows, currency, nowIso, recoveryDelayMinutes, recoveryDiscountPercent }: AbandonedClientProps) {
  const now = React.useMemo(() => new Date(nowIso), [nowIso])
  const [rows, setRows] = React.useState(initialRows)
  const [filter, setFilter] = React.useState<Filter>('all')
  const [query, setQuery] = React.useState('')
  const [sort, setSort] = React.useState<DataTableSort>({ id: 'abandoned', dir: 'desc' })
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])

  /* ---------- numbers ---------- */

  const stats = React.useMemo(() => {
    const by = (status: AbandonedStatus) => rows.filter((row) => row.status === status)
    const open = by('open')
    const reminded = by('reminded')
    const recovered = by('recovered')
    const expired = by('expired')
    const value = (list: AbandonedCheckout[]) => list.reduce((sum, row) => sum + row.total, 0)
    const closed = recovered.length + expired.length
    return {
      open: { count: open.length, value: value(open) },
      reminded: { count: reminded.length, value: value(reminded) },
      recovered: { count: recovered.length, value: value(recovered), rate: closed === 0 ? 0 : Math.round((recovered.length / closed) * 100) },
      expired: { count: expired.length, value: value(expired) },
    }
  }, [rows])

  /* ---------- filter and sort ---------- */

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (filter !== 'all' && row.status !== filter) return false
      if (!needle) return true
      const name = `${row.customer.firstName} ${row.customer.lastName}`.toLowerCase()
      return name.includes(needle) || row.customer.email.toLowerCase().includes(needle) || row.activity.name.toLowerCase().includes(needle)
    })
  }, [rows, filter, query])

  const sorted = React.useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sort.id) {
        case 'guest':
          return `${a.customer.firstName} ${a.customer.lastName}`.localeCompare(`${b.customer.firstName} ${b.customer.lastName}`) * dir
        case 'activity':
          return a.activity.name.localeCompare(b.activity.name) * dir
        case 'departure':
          return a.departure.startsAt.localeCompare(b.departure.startsAt) * dir
        case 'party':
          return (a.partySize - b.partySize) * dir
        case 'total':
          return (a.total - b.total) * dir
        case 'status':
          return a.status.localeCompare(b.status) * dir
        default:
          return a.abandonedAt.localeCompare(b.abandonedAt) * dir
      }
    })
  }, [filtered, sort])

  /* ---------- actions ---------- */

  const update = (ids: string[], change: (row: AbandonedCheckout) => AbandonedCheckout) =>
    setRows((current) => current.map((row) => (ids.includes(row.id) ? change(row) : row)))

  const remind = (ids: string[], channel: 'email' | 'sms', discount = false) => {
    const stamp = now.toISOString()
    update(ids, (row) =>
      row.status === 'recovered' || row.status === 'expired'
        ? row
        : {
            ...row,
            status: 'reminded',
            remindersSent: row.remindersSent + 1,
            lastReminderAt: stamp,
            discountPercent: discount ? recoveryDiscountPercent : row.discountPercent,
          },
    )
    const what = discount ? `${recoveryDiscountPercent}% off` : channel === 'sms' ? 'a text' : 'a reminder'
    toast.success(ids.length === 1 ? `Sent ${what}` : `Sent ${what} to ${ids.length} guests`, {
      description: 'The link reopens their cart with the seats still selected.',
    })
    setSelectedIds([])
  }

  const recover = (ids: string[]) => {
    update(ids, (row) => ({ ...row, status: 'recovered', recoveredAt: now.toISOString() }))
    toast.success(ids.length === 1 ? 'Marked as recovered' : `${ids.length} marked as recovered`)
    setSelectedIds([])
  }

  const dismiss = (ids: string[]) => {
    update(ids, (row) => ({ ...row, status: 'expired' }))
    toast(ids.length === 1 ? 'Cart dismissed' : `${ids.length} carts dismissed`, {
      description: 'Their seats go back on sale.',
    })
    setSelectedIds([])
  }

  const copyLink = async (row: AbandonedCheckout) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${row.checkoutUrl}`)
      toast.success('Checkout link copied')
    } catch {
      toast.error('Could not copy the link')
    }
  }

  const selectedOpen = selectedIds.filter((id) => {
    const row = rows.find((r) => r.id === id)
    return row && (row.status === 'open' || row.status === 'reminded')
  })

  /* ---------- columns ---------- */

  const columns = React.useMemo<DataTableColumn<AbandonedCheckout>[]>(
    () => [
      {
        id: 'guest',
        header: 'Guest',
        sortable: true,
        cell: ({ customer }) => {
          const name = `${customer.firstName} ${customer.lastName}`
          return (
            <span className="flex min-w-[9rem] max-w-[14rem] items-center gap-2.5">
              <Avatar name={name} src={customer.avatarUrl} size="xs" />
              <span className="truncate text-[0.8125rem] text-foreground" title={customer.email}>
                {name}
              </span>
            </span>
          )
        },
      },
      {
        id: 'activity',
        header: 'Experience',
        sortable: true,
        hideBelow: 'lg',
        cell: ({ activity }) => (
          <span className="flex min-w-[9rem] max-w-[15rem] items-center gap-2.5">
            <span aria-hidden="true" className="h-4 w-1 shrink-0 rounded-full" style={{ background: ACTIVITY_COLOR_VAR[activity.colorKey] }} />
            <span className="truncate text-[0.8125rem] text-foreground">{activity.name}</span>
          </span>
        ),
      },
      {
        id: 'departure',
        header: 'Departure',
        sortable: true,
        width: '9rem',
        cellClassName: 'whitespace-nowrap',
        cell: ({ departure }) => (
          <span className="text-[0.8125rem] text-foreground tabular-nums">
            {formatDateShort(departure.startsAt)}
            <span className="text-subtle"> · {formatTime(departure.startsAt)}</span>
          </span>
        ),
      },
      {
        id: 'party',
        header: 'Party',
        sortable: true,
        align: 'right',
        numeric: true,
        width: '3.5rem',
        hideBelow: 'md',
        cell: ({ partySize }) => <span className="text-[0.8125rem] text-foreground tabular-nums">{partySize}</span>,
      },
      {
        id: 'total',
        header: 'Value',
        sortable: true,
        align: 'right',
        numeric: true,
        width: '5.5rem',
        defaultSortDir: 'desc',
        cell: ({ total }) => <span className="text-[0.8125rem] text-foreground tabular-nums">{formatCurrency(total, currency)}</span>,
      },
      {
        id: 'stage',
        header: 'Left at',
        hideBelow: 'xl',
        width: '9rem',
        cell: ({ stage, device }) => {
          const Device = device === 'phone' ? Smartphone : Monitor
          return (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8125rem] text-muted">
              <Device className="size-3.5 text-faint" aria-hidden="true" />
              {ABANDONED_STAGE_LABEL[stage].replace('Left at ', '')}
            </span>
          )
        },
      },
      {
        id: 'abandoned',
        header: 'Abandoned',
        sortable: true,
        defaultSortDir: 'desc',
        width: '8rem',
        cellClassName: 'whitespace-nowrap',
        cell: ({ abandonedAt }) => <span className="text-[0.8125rem] text-muted">{formatRelative(abandonedAt, now)}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        width: '7rem',
        cell: (row) => (
          <span className="inline-flex items-center gap-2">
            <StatusDot status={row.status} />
            {row.remindersSent > 0 && row.status === 'reminded' ? (
              <span className="text-xs text-faint tabular-nums">×{row.remindersSent}</span>
            ) : null}
          </span>
        ),
      },
      {
        id: 'actions',
        header: <span className="sr-only">Actions</span>,
        align: 'right',
        width: '3rem',
        cellClassName: 'pl-0',
        cell: (row) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" size="xs" aria-label={`Actions for ${row.customer.firstName} ${row.customer.lastName}`} onClick={(event) => event.stopPropagation()}>
                <MoreHorizontal />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuLabel>{formatCurrency(row.total, currency)} · {row.activity.name}</DropdownMenuLabel>
              {row.status === 'open' || row.status === 'reminded' ? (
                <>
                  <DropdownMenuItem onSelect={() => remind([row.id], 'email')}>
                    <Mail />
                    Send reminder email
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => remind([row.id], 'sms')}>
                    <MessageSquare />
                    Send a text
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => remind([row.id], 'email', true)}>
                    <BadgePercent />
                    Offer {recoveryDiscountPercent}% off
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem onSelect={() => copyLink(row)}>
                <Copy />
                Copy checkout link
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/customers/${row.customer.id}`}>
                  <ArrowUpRight />
                  Open guest profile
                </Link>
              </DropdownMenuItem>
              {row.status === 'open' || row.status === 'reminded' ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => recover([row.id])}>
                    <Check />
                    Mark as recovered
                  </DropdownMenuItem>
                  <DropdownMenuItem tone="danger" onSelect={() => dismiss([row.id])}>
                    <X />
                    Dismiss
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [currency, now, recoveryDiscountPercent],
  )

  const cards = [
    { key: 'open', label: 'Open', hint: 'No reminder yet', count: stats.open.count, line: `worth ${formatCurrency(stats.open.value, currency, { compact: true })}`, tone: 'bg-warning' },
    { key: 'reminded', label: 'Reminded', hint: 'Waiting on the guest', count: stats.reminded.count, line: `worth ${formatCurrency(stats.reminded.value, currency, { compact: true })}`, tone: 'bg-info' },
    { key: 'recovered', label: 'Recovered', hint: 'Came back and paid', count: stats.recovered.count, line: `${formatCurrency(stats.recovered.value, currency, { compact: true })} back · ${stats.recovered.rate}% of closed carts`, tone: 'bg-success' },
    { key: 'expired', label: 'Expired', hint: 'Departure passed', count: stats.expired.count, line: `${formatCurrency(stats.expired.value, currency, { compact: true })} not recovered`, tone: 'bg-line-strong' },
  ] as const

  return (
    <div className="flex flex-col gap-6">
      {/* ---------- numbers ---------- */}
      <div role="group" aria-label="Filter carts by state" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const active = filter === card.key
          return (
            <button
              key={card.key}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(active ? 'all' : card.key)}
              className={cn(
                'flex min-w-0 flex-col rounded-2xl border p-4 text-left transition-[border-color,background-color] duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                active ? 'border-primary/50 bg-primary-soft/40' : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className="flex items-center gap-2 text-[0.8125rem] text-muted">
                <span aria-hidden="true" className={cn('size-2 rounded-full', card.tone)} />
                <span className="font-medium text-foreground">{card.label}</span>
                <span className="truncate text-subtle">· {card.hint}</span>
              </span>
              <span className="mt-3 text-[1.75rem] leading-none font-medium tracking-tight text-foreground tabular-nums">{formatNumber(card.count)}</span>
              <span className="mt-2 text-xs text-muted tabular-nums">{card.line}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="min-w-0">
          {/* ---------- toolbar ---------- */}
          <div className="flex flex-col gap-3 border-b border-line-subtle px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <SearchInput value={query} onValueChange={setQuery} placeholder="Search guest, email or experience…" size="sm" aria-label="Search abandoned carts" fieldClassName="w-full sm:w-64" />
              <Segmented size="sm" label="Filter by state" options={FILTERS} value={filter} onValueChange={setFilter} />
              {filter !== 'all' || query ? (
                <Button variant="ghost" size="xs" leftIcon={<X className="size-3.5" />} onClick={() => { setFilter('all'); setQuery('') }}>
                  Clear
                </Button>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {selectedOpen.length > 0 ? (
                <>
                  <Button size="sm" leftIcon={<Send />} onClick={() => remind(selectedOpen, 'email')}>
                    Remind {selectedOpen.length}
                  </Button>
                  <Button size="sm" variant="secondary" leftIcon={<BadgePercent />} onClick={() => remind(selectedOpen, 'email', true)}>
                    Offer {recoveryDiscountPercent}% off
                  </Button>
                </>
              ) : (
                <p className="hidden text-xs text-subtle tabular-nums sm:block">
                  {sorted.length === 0 ? 'No carts' : `${formatNumber(sorted.length)} ${sorted.length === 1 ? 'cart' : 'carts'}`}
                </p>
              )}
            </div>
          </div>

          {/* ---------- table ---------- */}
          <CardContent className="hidden p-0 md:block">
            <DataTable
              columns={columns}
              rows={sorted}
              getRowId={(row) => row.id}
              sort={sort}
              onSortChange={setSort}
              selectable
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              stickyHeader
              rowHeight="compact"
              ariaLabel="Abandoned carts"
              empty={
                <EmptyState
                  variant="no-results"
                  size="sm"
                  icon={ShoppingCart}
                  title={rows.length === 0 ? 'No abandoned carts' : 'Nothing matches those filters'}
                  description={rows.length === 0 ? 'Every checkout started this fortnight was paid for.' : 'Try another state, or search by guest or experience.'}
                />
              }
            />
          </CardContent>

          {/* ---------- phone cards ---------- */}
          <CardContent className="md:hidden">
            {sorted.length === 0 ? (
              <EmptyState variant="no-results" size="sm" icon={ShoppingCart} title="No carts match" description="Try another state or search term." />
            ) : (
              <ul className="divide-y divide-line-subtle">
                {sorted.map((row) => {
                  const name = `${row.customer.firstName} ${row.customer.lastName}`
                  return (
                    <li key={row.id} className="flex items-center gap-3 py-3">
                      <Avatar name={name} src={row.customer.avatarUrl} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{name}</p>
                        <p className="truncate text-xs text-subtle">
                          {row.activity.name} · {formatDateShort(row.departure.startsAt)}
                        </p>
                        <p className="mt-1 flex items-center gap-x-1.5 text-xs text-muted">
                          <StatusDot status={row.status} />
                          <span aria-hidden="true" className="text-faint">·</span>
                          <span>{formatRelative(row.abandonedAt, now)}</span>
                        </p>
                      </div>
                      <span className="shrink-0 text-sm text-foreground tabular-nums">{formatCurrency(row.total, currency)}</span>
                      {row.status === 'open' || row.status === 'reminded' ? (
                        <IconButton size="xs" variant="ghost" aria-label={`Send a reminder to ${name}`} onClick={() => remind([row.id], 'email')}>
                          <Send />
                        </IconButton>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ---------- automation ---------- */}
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Automatic recovery</CardTitle>
            <CardDescription>What happens to every cart without you.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 text-[0.8125rem] text-muted">
            <ol className="flex flex-col gap-3">
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs text-foreground tabular-nums">1</span>
                <span>
                  <span className="text-foreground">{recoveryDelayMinutes} minutes</span> after a cart is left, an email with the link back to their seats.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs text-foreground tabular-nums">2</span>
                <span>
                  The next morning, a second email with <span className="text-foreground">{recoveryDiscountPercent}% off</span> if the departure still has seats.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-sunken text-xs text-foreground tabular-nums">3</span>
                <span>Then it stops. Held seats go back on sale when the departure is 24 hours out.</span>
              </li>
            </ol>
            <p className="text-xs text-subtle">
              Reminders only go to guests who typed an email before they left. Nothing is sent to anyone who has already paid.
            </p>
            <Button asChild variant="outline" size="sm" className="self-start">
              <Link href="/dashboard/settings/booking">Change the timing</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
