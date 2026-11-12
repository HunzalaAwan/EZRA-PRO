'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Download, FileText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardToolbar,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from '@/components/ui/toaster'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { EZRA_FEE_PERCENT, FEE_PAYER_OPTIONS, ezraFee } from '@/lib/fees'
import {
  createRng,
  formatCurrency,
  formatDateLong,
  formatNumber,
  hashSeed,
  rngInt,
} from '@/lib/utils'
import type { KpiMetric, Tenant } from '@/types'

/* ==========================================================================
   BILLING — one price for everyone: 4% of each booking. No monthly fee, no
   setup fee, no contract, no plans and no limits. The screen shows what was
   booked, what the 4% came to, who pays it, and the monthly statements.
   ========================================================================== */

/** Everything every business gets. Nothing is held back. */
const INCLUDED = [
  'Unlimited activities, times and team members',
  'Online checkout, deposits and next-day payouts',
  'Storefront on your own domain',
  'Marketplaces and channel sync',
  'Price rules, promo codes and gift cards',
  'Several locations under one login',
  'Reports, exports and the API',
  'Free move from your current platform',
]

interface StatementRow {
  id: string
  number: string
  issuedAt: Date
  booked: number
  fee: number
  status: 'paid' | 'open'
}

/**
 * Every figure on this screen derives from the tenant and its 30-day KPIs,
 * fetched server-side. Computing them here (rather than importing
 * `@/lib/demo` directly) keeps the synthetic dataset out of the client bundle.
 */
function computeBillingData(tenant: Tenant, kpis: KpiMetric[], now: Date) {
  const bookings30d = kpis.find((k) => k.key === 'bookings')?.value ?? 0
  const booked30d = kpis.find((k) => k.key === 'net_revenue')?.value ?? 0
  const fee30d = ezraFee(booked30d)

  const rng = createRng(hashSeed(`${tenant.id}::invoices`))
  const statements: StatementRow[] = []
  for (let i = 0; i < 9; i++) {
    const issuedAt = new Date(now.getFullYear(), now.getMonth() - i, 1)
    // Seasonal swing: summer runs hot, shoulder months settle back.
    const seasonal = 0.72 + 0.5 * Math.abs(Math.sin((issuedAt.getMonth() + 2) / 2))
    const booked = Math.max(0, Math.round(booked30d * seasonal + rngInt(rng, -42_000, 42_000) * 100))
    statements.push({
      id: `stm_${issuedAt.getFullYear()}${String(issuedAt.getMonth() + 1).padStart(2, '0')}`,
      number: `EZR-${issuedAt.getFullYear()}-${String(1042 - i).padStart(4, '0')}`,
      issuedAt,
      booked,
      fee: ezraFee(booked),
      status: i === 0 ? 'open' : 'paid',
    })
  }

  return { currency: tenant.currency, bookings30d, booked30d, fee30d, statements }
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export interface BillingSettingsClientProps {
  tenant: Tenant
  now: Date
  kpis: KpiMetric[]
  seatsUsed: number
  activitiesUsed: number
}

export function BillingSettingsClient({ tenant, now, kpis, seatsUsed, activitiesUsed }: BillingSettingsClientProps) {
  const { currency, bookings30d, booked30d, fee30d, statements } = React.useMemo(
    () => computeBillingData(tenant, kpis, now),
    [tenant, kpis, now],
  )
  const { defaults } = useBookingDefaults(tenant.slug)
  const payer = FEE_PAYER_OPTIONS.find((option) => option.value === defaults.feePayer) ?? FEE_PAYER_OPTIONS[0]

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* ---------------- The price ---------------- */}
      <Card>
        <CardContent className="flex flex-col gap-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
                {EZRA_FEE_PERCENT}% of each booking
              </h3>
              <p className="mt-1 max-w-prose text-sm text-muted">
                That is the whole bill. No monthly fee, no setup fee, no contract. Every feature is
                included.
              </p>
            </div>
            <p className="text-right font-display text-2xl font-semibold tracking-tight text-foreground tabular">
              {formatCurrency(0, currency)}
              <span className="text-sm font-normal text-muted"> a month</span>
            </p>
          </div>

          <Separator />

          <dl className="grid gap-5 sm:grid-cols-3">
            <Stat
              label="Booked, last 30 days"
              value={formatCurrency(booked30d, currency, { compact: true })}
              hint={`${formatNumber(bookings30d)} bookings`}
            />
            <Stat
              label={`EZRA Pro's ${EZRA_FEE_PERCENT}%, last 30 days`}
              value={formatCurrency(fee30d, currency, { compact: true })}
              hint="Taken from your payouts"
            />
            <Stat
              label="Team and activities"
              value={`${formatNumber(seatsUsed)} · ${formatNumber(activitiesUsed)}`}
              hint="No limits on either"
            />
          </dl>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted">Who pays the {EZRA_FEE_PERCENT}%</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{payer.label}</p>
              <p className="text-xs text-subtle">{payer.description}</p>
            </div>
            <Button asChild variant="outline" size="sm" rightIcon={<ArrowRight />}>
              <Link href="/dashboard/settings/payments">Change</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Included ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Everything is included</CardTitle>
          <CardDescription>There are no plans to move between and nothing to unlock.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="grid gap-2 sm:grid-cols-2">
            {INCLUDED.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* ---------------- Statements ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" aria-hidden="true" />
            Monthly statements
          </CardTitle>
          <CardDescription>
            What was booked each month and the {EZRA_FEE_PERCENT}% taken from your payouts. Sent to
            your billing email as a PDF.
          </CardDescription>
          <CardToolbar>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download />}
              onClick={() =>
                toast.success('Export started', {
                  description: 'A CSV of every statement is on its way to your billing email.',
                })
              }
            >
              Export all
            </Button>
          </CardToolbar>
        </CardHeader>

        <CardContent bleed className="pt-0">
          {/* Desktop table */}
          <div className="hidden sm:block">
            <Table density="comfortable">
              <TableHeader>
                <TableRow>
                  <TableHead>Statement</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead numeric align="right">
                    Booked
                  </TableHead>
                  <TableHead numeric align="right">
                    {EZRA_FEE_PERCENT}% fee
                  </TableHead>
                  <TableHead align="right">Status</TableHead>
                  <TableHead align="right">
                    <span className="sr-only">Download</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statements.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.number}</TableCell>
                    <TableCell className="text-muted">{formatDateLong(row.issuedAt)}</TableCell>
                    <TableCell numeric align="right">
                      {formatCurrency(row.booked, currency)}
                    </TableCell>
                    <TableCell numeric align="right" className="font-semibold">
                      {formatCurrency(row.fee, currency)}
                    </TableCell>
                    <TableCell align="right">
                      <Badge variant={row.status === 'paid' ? 'success' : 'warning'} size="sm">
                        {row.status === 'paid' ? 'Settled' : 'This month'}
                      </Badge>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="ghost"
                        size="xs"
                        leftIcon={<Download />}
                        onClick={() => toast(`${row.number}.pdf`, { description: 'Download started.' })}
                      >
                        PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-2 px-5 sm:hidden">
            {statements.map((row) => (
              <li key={row.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-foreground">{row.number}</p>
                  <p className="text-xs text-muted">
                    {formatDateLong(row.issuedAt)} · {formatCurrency(row.booked, currency)} booked
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground tabular">
                    {formatCurrency(row.fee, currency)}
                  </p>
                  <Badge variant={row.status === 'paid' ? 'success' : 'warning'} size="sm">
                    {row.status === 'paid' ? 'Settled' : 'This month'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

/* ========================================================================== */

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-xl font-semibold tracking-tight text-foreground tabular">{value}</dd>
      <p className="mt-0.5 text-xs text-subtle">{hint}</p>
    </div>
  )
}
