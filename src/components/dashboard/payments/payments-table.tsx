'use client'

/**
 * The ledger. Two tabs over one card: every individual charge and refund on
 * "Transactions", and the weekly settlement batches those charges roll up into
 * on "Payouts".
 */

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowDownToLine,
  Banknote,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CreditCard,
  Download,
  FileText,
  Gift,
  Hourglass,
  Landmark,
  ReceiptText,
  RotateCcw,
  Truck,
  Wallet,
  X,
} from 'lucide-react'

import { cn, formatCurrency, formatDateShort, formatNumber, formatTime } from '@/lib/utils'
import { Avatar } from '@/components/ui/avatar'
import { Badge, type BadgeVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardFooter } from '@/components/ui/card'
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Pagination } from '@/components/ui/pagination'
import { SearchInput } from '@/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toaster'
import type { CurrencyCode, Payment } from '@/types'

/* ==========================================================================
   TYPES
   ========================================================================== */

export interface PaymentRow {
  id: string
  /** When the card was charged. */
  createdAt: string
  /** When the funds settled — the day the trip ran. */
  settledAt: string
  bookingId: string
  reference: string
  guestId: string
  guestName: string
  guestAvatar?: string
  activityName: string
  method: Payment['method']
  brand?: string
  last4?: string
  /** Minor units. Negative on a refund row. */
  amount: number
  processorFee: number
  netAmount: number
  status: Payment['status']
  payoutRef?: string
}

export interface PayoutBatch {
  id: string
  reference: string
  /** ISO date the money lands (or landed). */
  paidAt: string
  periodStart: string
  periodEnd: string
  transactions: number
  /** Minor units. */
  gross: number
  fees: number
  refunds: number
  net: number
  status: 'paid' | 'in_transit' | 'scheduled'
  destination: string
}

export interface PaymentsTableProps {
  payments: PaymentRow[]
  payouts: PayoutBatch[]
  /** Count of every charge on file, not just the loaded window. */
  totalPayments: number
  currency: CurrencyCode
  className?: string
}

/* ==========================================================================
   MAPPINGS
   ========================================================================== */

const METHOD_ICON: Record<Payment['method'], typeof CreditCard> = {
  card: CreditCard,
  apple_pay: Wallet,
  google_pay: Wallet,
  cash: Banknote,
  bank_transfer: Landmark,
  gift_card: Gift,
}

const METHOD_LABEL: Record<Payment['method'], string> = {
  card: 'Card',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
  cash: 'Cash',
  bank_transfer: 'Bank transfer',
  gift_card: 'Gift card',
}

const CHARGE_STATUS: Record<
  Payment['status'],
  { label: string; variant: BadgeVariant; icon: typeof CircleCheck }
> = {
  succeeded: { label: 'Succeeded', variant: 'success', icon: CircleCheck },
  pending: { label: 'Pending', variant: 'warning', icon: Hourglass },
  failed: { label: 'Failed', variant: 'danger', icon: CircleAlert },
  refunded: { label: 'Refunded', variant: 'outline', icon: RotateCcw },
}

const PAYOUT_STATUS: Record<
  PayoutBatch['status'],
  { label: string; variant: BadgeVariant; icon: typeof CircleCheck; dot: string }
> = {
  paid: { label: 'Paid', variant: 'success', icon: CircleCheck, dot: 'bg-success' },
  in_transit: { label: 'In transit', variant: 'info', icon: Truck, dot: 'bg-info' },
  scheduled: { label: 'Scheduled', variant: 'neutral', icon: Hourglass, dot: 'bg-faint' },
}

const PAGE_SIZES = [15, 25, 50]

function ChargeStatusBadge({ status }: { status: Payment['status'] }) {
  const meta = CHARGE_STATUS[status]
  const Icon = meta.icon
  return (
    <Badge size="sm" variant={meta.variant}>
      <Icon aria-hidden="true" />
      {meta.label}
    </Badge>
  )
}

function MethodCell({ row }: { row: PaymentRow }) {
  const Icon = METHOD_ICON[row.method]
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-line-subtle bg-surface-sunken text-subtle">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-foreground">
          {row.brand ?? METHOD_LABEL[row.method]}
        </span>
        {row.last4 ? (
          <span className="block truncate font-mono text-xs text-subtle">
            ···· {row.last4}
          </span>
        ) : (
          <span className="block truncate text-xs text-subtle">
            {row.brand ? METHOD_LABEL[row.method] : 'No card'}
          </span>
        )}
      </span>
    </span>
  )
}

/* ==========================================================================
   MAIN
   ========================================================================== */

export function PaymentsTable({
  payments,
  payouts,
  totalPayments,
  currency,
  className,
}: PaymentsTableProps) {
  const [tab, setTab] = React.useState('transactions')
  const [query, setQuery] = React.useState('')
  const [status, setStatus] = React.useState('all')
  const [method, setMethod] = React.useState('all')
  const [sort, setSort] = React.useState<DataTableSort>({ id: 'date', dir: 'desc' })
  const [page, setPage] = React.useState(1)
  const [pageSize, setPageSize] = React.useState(15)

  const filtered = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return payments.filter((row) => {
      if (status !== 'all' && row.status !== status) return false
      if (method !== 'all' && row.method !== method) return false
      if (!needle) return true
      return (
        row.reference.toLowerCase().includes(needle) ||
        row.guestName.toLowerCase().includes(needle) ||
        row.activityName.toLowerCase().includes(needle) ||
        (row.last4 ?? '').includes(needle) ||
        (row.brand ?? '').toLowerCase().includes(needle)
      )
    })
  }, [payments, status, method, query])

  const sorted = React.useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sort.id) {
        case 'guest':
          return a.guestName.localeCompare(b.guestName) * dir
        case 'reference':
          return a.reference.localeCompare(b.reference) * dir
        case 'gross':
          return (a.amount - b.amount) * dir
        case 'fee':
          return (a.processorFee - b.processorFee) * dir
        case 'net':
          return (a.netAmount - b.netAmount) * dir
        case 'status':
          return a.status.localeCompare(b.status) * dir
        case 'date':
        default:
          return a.settledAt.localeCompare(b.settledAt) * dir
      }
    })
  }, [filtered, sort])

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  React.useEffect(() => {
    setPage(1)
  }, [query, status, method, pageSize, sort])

  const totals = React.useMemo(
    () => ({
      gross: filtered.reduce((acc, row) => acc + row.amount, 0),
      fee: filtered.reduce((acc, row) => acc + row.processorFee, 0),
      net: filtered.reduce((acc, row) => acc + row.netAmount, 0),
    }),
    [filtered],
  )

  const filtersActive = query.length > 0 || status !== 'all' || method !== 'all'
  const resetFilters = () => {
    setQuery('')
    setStatus('all')
    setMethod('all')
  }

  const columns = React.useMemo<DataTableColumn<PaymentRow>[]>(
    () => [
      {
        id: 'date',
        header: 'Settled',
        sortable: true,
        defaultSortDir: 'desc',
        width: '12%',
        cell: (row) => (
          <span className="block">
            <span className="block text-xs font-medium text-foreground">
              {formatDateShort(row.settledAt)}
            </span>
            <span className="block text-xs text-subtle">
              {formatTime(row.settledAt)} · charged {formatDateShort(row.createdAt)}
            </span>
          </span>
        ),
      },
      {
        id: 'reference',
        header: 'Booking',
        sortable: true,
        width: '16%',
        cell: (row) => (
          <span className="block min-w-0">
            <Link
              href={`/dashboard/bookings/${row.bookingId}`}
              className="block truncate font-mono text-xs font-medium text-foreground transition-colors hover:text-primary"
              onClick={(event) => event.stopPropagation()}
            >
              {row.reference}
            </Link>
            <span className="block truncate text-xs text-subtle">{row.activityName}</span>
          </span>
        ),
      },
      {
        id: 'guest',
        header: 'Guest',
        sortable: true,
        hideBelow: 'md',
        width: '18%',
        cell: (row) => (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={row.guestName} src={row.guestAvatar} size="xs" />
            <span className="truncate text-xs text-foreground">{row.guestName}</span>
          </span>
        ),
      },
      {
        id: 'method',
        header: 'Method',
        hideBelow: 'lg',
        width: '13%',
        cell: (row) => <MethodCell row={row} />,
      },
      {
        id: 'gross',
        header: 'Gross',
        sortable: true,
        align: 'right',
        numeric: true,
        defaultSortDir: 'desc',
        width: '11%',
        cell: (row) => (
          <span
            className={cn(
              'text-[0.8125rem] font-medium',
              row.amount < 0 ? 'text-danger' : 'text-foreground',
            )}
          >
            {formatCurrency(row.amount, currency)}
          </span>
        ),
      },
      {
        id: 'fee',
        header: 'Fee',
        sortable: true,
        align: 'right',
        numeric: true,
        hideBelow: 'md',
        width: '9%',
        cell: (row) => (
          <span className="text-xs text-subtle">
            {row.processorFee === 0 ? '—' : `-${formatCurrency(row.processorFee, currency, { decimals: true })}`}
          </span>
        ),
      },
      {
        id: 'net',
        header: 'Net',
        sortable: true,
        align: 'right',
        numeric: true,
        defaultSortDir: 'desc',
        width: '11%',
        cell: (row) => (
          <span
            className={cn(
              'text-[0.8125rem] font-semibold',
              row.netAmount < 0 ? 'text-danger' : 'text-foreground',
            )}
          >
            {formatCurrency(row.netAmount, currency)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        align: 'right',
        width: '11%',
        cell: (row) => <ChargeStatusBadge status={row.status} />,
      },
    ],
    [currency],
  )

  return (
    <Card className={cn('overflow-visible', className)}>
      <Tabs value={tab} onValueChange={setTab} variant="underline">
        <div className="flex items-end justify-between gap-3 border-b border-line px-4 pt-3 sm:px-5">
          <TabsList className="min-w-0 border-b-0">
            <TabsTrigger value="transactions">
              <ReceiptText className="size-4" aria-hidden="true" />
              Transactions
              <span className="tabular rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-semibold text-subtle">
                {formatNumber(payments.length)}
              </span>
            </TabsTrigger>
            <TabsTrigger value="payouts">
              <ArrowDownToLine className="size-4" aria-hidden="true" />
              Payouts
              <span className="tabular rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-semibold text-subtle">
                {payouts.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <div className="flex shrink-0 items-center gap-2 pb-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download className="size-4" />}
              onClick={() =>
                toast.success('Export queued', {
                  description:
                    tab === 'payouts'
                      ? `${payouts.length} payout statements as CSV.`
                      : `${formatNumber(sorted.length)} transactions as CSV.`,
                })
              }
            >
              Export
            </Button>
          </div>
        </div>

        {/* ================= TRANSACTIONS ================= */}
        <TabsContent value="transactions">
          <div className="flex flex-col gap-3 border-b border-line-subtle px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <SearchInput
                value={query}
                onValueChange={setQuery}
                placeholder="Reference, guest, card or trip…"
                size="sm"
                aria-label="Search transactions"
                fieldClassName="w-full sm:w-72"
              />

              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger size="sm" className="w-[9.5rem]" aria-label="Filter by status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="succeeded">Succeeded</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger size="sm" className="w-[10rem]" aria-label="Filter by method">
                  <SelectValue placeholder="All methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All methods</SelectItem>
                  {(Object.keys(METHOD_LABEL) as Payment['method'][]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {METHOD_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {filtersActive ? (
                <Button
                  variant="ghost"
                  size="xs"
                  leftIcon={<X className="size-3.5" />}
                  onClick={resetFilters}
                >
                  Clear
                </Button>
              ) : null}
            </div>

            <div className="tabular flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="text-subtle">
                Gross{' '}
                <span className="font-medium text-foreground">
                  {formatCurrency(totals.gross, currency)}
                </span>
              </span>
              <span className="text-subtle">
                Fees{' '}
                <span className="font-medium text-foreground">
                  {formatCurrency(totals.fee, currency)}
                </span>
              </span>
              <span className="text-subtle">
                Net{' '}
                <span className="font-semibold text-foreground">
                  {formatCurrency(totals.net, currency)}
                </span>
              </span>
            </div>
          </div>

          {/* desktop */}
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              rows={paged}
              getRowId={(row) => row.id}
              sort={sort}
              onSortChange={setSort}
              stickyHeader
              rowHeight="compact"
              ariaLabel="Payment transactions"
              empty={
                <EmptyState
                  variant="no-results"
                  size="sm"
                  icon={ReceiptText}
                  title="No transactions match"
                  description="Try a different status, method or search term."
                  action={
                    <Button variant="outline" size="sm" onClick={resetFilters}>
                      Reset filters
                    </Button>
                  }
                />
              }
            />
          </div>

          {/* mobile */}
          <div className="px-4 md:hidden">
            {paged.length === 0 ? (
              <div className="py-6">
                <EmptyState
                  variant="no-results"
                  size="sm"
                  icon={ReceiptText}
                  title="No transactions match"
                  description="Try a different status or search term."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {paged.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 py-3">
                    <Avatar name={row.guestName} src={row.guestAvatar} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {row.guestName}
                        </span>
                      </div>
                      <p className="truncate font-mono text-xs text-subtle">
                        {row.reference} · {row.brand ?? METHOD_LABEL[row.method]}
                        {row.last4 ? ` ···· ${row.last4}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-subtle">
                        Settled {formatDateShort(row.settledAt)} · fee{' '}
                        {formatCurrency(row.processorFee, currency, { decimals: true })}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={cn(
                          'tabular text-sm font-semibold',
                          row.amount < 0 ? 'text-danger' : 'text-foreground',
                        )}
                      >
                        {formatCurrency(row.amount, currency)}
                      </span>
                      <ChargeStatusBadge status={row.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <CardFooter separated className="flex-col items-stretch gap-3">
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
              totalItems={sorted.length}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZES}
              onPageSizeChange={setPageSize}
              itemNoun="transaction"
              size="sm"
            />
            <p className="text-xs text-faint">
              Card volume settles against delivery, so a charge clears on the day its trip runs.
              Showing the {formatNumber(payments.length)} most recently settled of{' '}
              {formatNumber(totalPayments)} charges.
            </p>
          </CardFooter>
        </TabsContent>

        {/* ================= PAYOUTS ================= */}
        <TabsContent value="payouts">
          <div className="px-4 py-4 sm:px-5">
            <ul className="space-y-2.5">
              {payouts.map((payout) => {
                const meta = PAYOUT_STATUS[payout.status]
                const Icon = meta.icon
                return (
                  <li key={payout.id}>
                    <div
                      className={cn(
                        'group flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-line bg-surface p-3.5 sm:flex-nowrap',
                        'transition-[transform,border-color,box-shadow] duration-300 ease-[var(--ease-out-expo)]',
                        'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md',
                        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
                      )}
                    >
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        <span
                          className={cn(
                            'grid size-9 shrink-0 place-items-center rounded-lg',
                            payout.status === 'paid'
                              ? 'bg-success-soft text-success'
                              : payout.status === 'in_transit'
                                ? 'bg-info-soft text-info'
                                : 'bg-surface-sunken text-subtle',
                          )}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-medium text-foreground">
                              {payout.reference}
                            </span>
                            <Badge size="sm" variant={meta.variant}>
                              {meta.label}
                            </Badge>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-subtle">
                            {formatDateShort(payout.periodStart)} –{' '}
                            {formatDateShort(payout.periodEnd)} · {payout.destination}
                          </span>
                        </span>
                      </span>

                      <span className="tabular flex shrink-0 items-center gap-4 text-xs sm:gap-6">
                        <span className="hidden text-right sm:block">
                          <span className="block text-xs text-faint uppercase">Charges</span>
                          <span className="block font-medium text-muted">
                            {formatNumber(payout.transactions)}
                          </span>
                        </span>
                        <span className="hidden text-right lg:block">
                          <span className="block text-xs text-faint uppercase">Gross</span>
                          <span className="block font-medium text-muted">
                            {formatCurrency(payout.gross, currency, { compact: true })}
                          </span>
                        </span>
                        <span className="hidden text-right lg:block">
                          <span className="block text-xs text-faint uppercase">Fees</span>
                          <span className="block font-medium text-muted">
                            -{formatCurrency(payout.fees, currency, { compact: true })}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block text-xs text-faint uppercase">
                            {payout.status === 'paid' ? 'Paid' : 'Expected'}
                          </span>
                          <span className="block font-medium text-muted">
                            {formatDateShort(payout.paidAt)}
                          </span>
                        </span>
                        <span className="w-24 text-right">
                          <span className="block text-xs text-faint uppercase">Net</span>
                          <span className="block text-sm font-semibold text-foreground">
                            {formatCurrency(payout.net, currency)}
                          </span>
                        </span>
                      </span>

                      <span className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          leftIcon={<FileText className="size-3.5" />}
                          onClick={() =>
                            toast.success('Statement downloaded', {
                              description: `${payout.reference} · ${formatNumber(payout.transactions)} transactions`,
                            })
                          }
                        >
                          Statement
                        </Button>
                        <ChevronRight
                          className="size-4 text-faint transition-transform duration-300 group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>

            {payouts.length === 0 ? (
              <EmptyState
                variant="no-data"
                size="sm"
                icon={ArrowDownToLine}
                title="No payouts yet"
                description="Your first batch settles the Friday after your first charge clears."
              />
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  )
}

/* ==========================================================================
   Header actions — keeps the payments page a server component.
   ========================================================================== */

export function PaymentsPageActions() {
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        leftIcon={<FileText className="size-4" />}
        onClick={() => toast.info('Monthly statements', { description: 'PDF statements for the last 12 months.' })}
      >
        Statements
      </Button>
      <Button
        variant="outline"
        size="sm"
        leftIcon={<Download className="size-4" />}
        onClick={() => toast.success('Ledger export queued')}
      >
        Export ledger
      </Button>
      <Button
        size="sm"
        leftIcon={<Landmark className="size-4" />}
        onClick={() => toast.info('Payout settings opened')}
      >
        Payout settings
      </Button>
    </>
  )
}
