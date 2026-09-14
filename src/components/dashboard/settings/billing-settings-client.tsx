'use client'

import * as React from 'react'
import {
  ArrowUpRight,
  Check,
  CreditCard,
  Download,
  FileText,
  Gauge,
  Minus,
  Sparkles,
  Users,
} from 'lucide-react'

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
import { Progress } from '@/components/ui/progress'
import { Segmented } from '@/components/ui/segmented'
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
import { PRICING_PLANS } from '@/content/marketing'
import {
  cn,
  addDays,
  createRng,
  formatCurrency,
  formatDateLong,
  formatNumber,
  hashSeed,
  rngInt,
} from '@/lib/utils'
import type { KpiMetric, PlanTier, Tenant } from '@/types'

/* ==========================================================================
   PLAN LIMITS
   ========================================================================== */

interface PlanLimits {
  bookings: number | null
  seats: number | null
  activities: number | null
}

const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  starter: { bookings: 250, seats: 3, activities: 10 },
  growth: { bookings: 3000, seats: 15, activities: 60 },
  scale: { bookings: 12000, seats: 60, activities: null },
  enterprise: { bookings: null, seats: null, activities: null },
}

const PLAN_ORDER: PlanTier[] = ['starter', 'growth', 'scale', 'enterprise']

interface InvoiceRow {
  id: string
  number: string
  issuedAt: Date
  platformFee: number
  commission: number
  total: number
  status: 'paid' | 'open'
}

/**
 * Every figure on this screen derives from the tenant, its 30-day KPIs, and
 * usage counts — all fetched server-side. Computing the derived values here
 * (rather than importing `@/lib/demo` directly) is what keeps the synthetic
 * dataset out of the client bundle.
 */
function computeBillingData(tenant: Tenant, kpis: KpiMetric[], seatsUsed: number, activitiesUsed: number, now: Date) {
  const currency = tenant.currency
  const plan = PRICING_PLANS.find((p) => p.id === tenant.plan) ?? PRICING_PLANS[1]
  const limits = PLAN_LIMITS[tenant.plan]

  const bookings30d = kpis.find((k) => k.key === 'bookings')?.value ?? 0
  const revenue30d = kpis.find((k) => k.key === 'net_revenue')?.value ?? 0

  const commission30d = Math.round((revenue30d * plan.commissionPercent) / 100)
  const nextInvoiceTotal = plan.monthlyPrice + commission30d
  const renewsOn = addDays(now, 19)

  const rng = createRng(hashSeed(`${tenant.id}::invoices`))
  const invoices: InvoiceRow[] = []
  for (let i = 0; i < 9; i++) {
    const issuedAt = new Date(now.getFullYear(), now.getMonth() - i, 1)
    // Seasonal swing: Maui summer runs hot, shoulder months settle back.
    const seasonal = 0.72 + 0.5 * Math.abs(Math.sin((issuedAt.getMonth() + 2) / 2))
    const commission = Math.round(commission30d * seasonal + rngInt(rng, -4200, 4200) * 100)
    invoices.push({
      id: `inv_${issuedAt.getFullYear()}${String(issuedAt.getMonth() + 1).padStart(2, '0')}`,
      number: `EZR-${issuedAt.getFullYear()}-${String(1042 - i).padStart(4, '0')}`,
      issuedAt,
      platformFee: plan.monthlyPrice,
      commission,
      total: plan.monthlyPrice + commission,
      status: i === 0 ? 'open' : 'paid',
    })
  }

  return {
    currency,
    plan,
    limits,
    bookings30d,
    revenue30d,
    seatsUsed,
    activitiesUsed,
    commission30d,
    nextInvoiceTotal,
    renewsOn,
    invoices,
  }
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

export function BillingSettingsClient({
  tenant: CURRENT_TENANT,
  now: NOW,
  kpis,
  seatsUsed,
  activitiesUsed,
}: BillingSettingsClientProps) {
  const {
    currency: CURRENCY,
    plan: PLAN,
    limits: LIMITS,
    bookings30d: BOOKINGS_30D,
    seatsUsed: SEATS_USED,
    activitiesUsed: ACTIVITIES_USED,
    commission30d: COMMISSION_30D,
    nextInvoiceTotal: NEXT_INVOICE_TOTAL,
    renewsOn: RENEWS_ON,
    invoices: INVOICES,
  } = React.useMemo(
    () => computeBillingData(CURRENT_TENANT, kpis, seatsUsed, activitiesUsed, NOW),
    [CURRENT_TENANT, kpis, seatsUsed, activitiesUsed, NOW],
  )
  const [cycle, setCycle] = React.useState<'monthly' | 'annual'>('monthly')

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* ---------------- Current plan ---------------- */}
      <Card variant="gradient">
        <CardContent className="flex flex-col gap-6 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
                  {PLAN.name}
                </h3>
                <Badge variant="primary" size="sm">
                  Current plan
                </Badge>
                {CURRENT_TENANT.status === 'trialing' ? (
                  <Badge variant="warning" size="sm">
                    Trialing
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 max-w-prose text-sm text-muted">{PLAN.blurb}</p>
            </div>

            <div className="text-right">
              <p className="font-display text-2xl font-semibold tracking-tight text-foreground tabular">
                {formatCurrency(PLAN.monthlyPrice, CURRENCY)}
                <span className="text-sm font-normal text-muted"> / month</span>
              </p>
              <p className="text-xs text-muted tabular">
                + {PLAN.commissionPercent}% per booking
              </p>
            </div>
          </div>

          <Separator />

          <div className="grid gap-5 sm:grid-cols-3">
            <UsageMeter
              icon={<Gauge className="size-4" />}
              label="Bookings this cycle"
              used={BOOKINGS_30D}
              limit={LIMITS.bookings}
            />
            <UsageMeter
              icon={<Users className="size-4" />}
              label="Team seats"
              used={SEATS_USED}
              limit={LIMITS.seats}
            />
            <UsageMeter
              icon={<Sparkles className="size-4" />}
              label="Published activities"
              used={ACTIVITIES_USED}
              limit={LIMITS.activities}
            />
          </div>

          <Separator />

          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted">Next invoice</p>
              <p className="font-display text-xl font-semibold tracking-tight text-foreground tabular">
                {formatCurrency(NEXT_INVOICE_TOTAL, CURRENCY)}
              </p>
              <p className="text-xs text-subtle">
                {formatCurrency(PLAN.monthlyPrice, CURRENCY)} platform +{' '}
                {formatCurrency(COMMISSION_30D, CURRENCY)} commission · due{' '}
                {formatDateLong(RENEWS_ON)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" size="sm">
                Cancel plan
              </Button>
              <Button size="sm" rightIcon={<ArrowUpRight />}>
                Upgrade to Scale
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Plan comparison ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle>Compare plans</CardTitle>
          <CardDescription>
            Every plan includes unlimited activities, next-day payouts and the full mobile
            manifest. Commission is what changes.
          </CardDescription>
          <CardToolbar>
            <Segmented
              size="sm"
              label="Billing cycle"
              value={cycle}
              onValueChange={setCycle}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'annual', label: 'Annual' },
              ]}
            />
          </CardToolbar>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {PLAN_ORDER.map((id) => {
              const plan = PRICING_PLANS.find((p) => p.id === id)
              if (!plan) return null
              const isCurrent = id === CURRENT_TENANT.plan
              const price = cycle === 'annual' ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice

              return (
                <div
                  key={id}
                  className={cn(
                    'flex flex-col gap-3 rounded-xl border p-4',
                    'transition-all duration-300 ease-[var(--ease-out-expo)]',
                    isCurrent
                      ? 'border-primary/45 bg-primary-soft/25 shadow-sm'
                      : 'border-line bg-surface hover:-translate-y-0.5 hover:border-line-strong hover:shadow-md',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-sm font-semibold text-foreground">
                      {plan.name}
                    </p>
                    {isCurrent ? (
                      <Badge variant="primary" size="sm">
                        Current
                      </Badge>
                    ) : plan.badge ? (
                      <Badge variant="accent" size="sm">
                        {plan.badge}
                      </Badge>
                    ) : null}
                  </div>

                  <div>
                    <p className="font-display text-xl font-semibold tracking-tight text-foreground tabular">
                      {plan.monthlyPrice === 0 && plan.id !== 'starter'
                        ? 'Custom'
                        : formatCurrency(price, CURRENCY)}
                      {plan.monthlyPrice === 0 && plan.id !== 'starter' ? null : (
                        <span className="text-xs font-normal text-muted"> /mo</span>
                      )}
                    </p>
                    <p className="text-xs text-muted tabular">
                      {plan.commissionPercent === 0
                        ? 'Negotiated commission'
                        : `${plan.commissionPercent}% per booking`}
                    </p>
                  </div>

                  <ul className="flex flex-1 flex-col gap-1.5">
                    {plan.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-1.5 text-xs text-muted">
                        <Check
                          className="mt-0.5 size-3.5 shrink-0 text-success"
                          aria-hidden="true"
                        />
                        {h}
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={isCurrent ? 'outline' : id === 'scale' ? 'primary' : 'secondary'}
                    size="sm"
                    fullWidth
                    disabled={isCurrent}
                    onClick={() =>
                      toast(`Switching to ${plan.name}`, {
                        description: 'Your success manager will confirm the migration window.',
                      })
                    }
                  >
                    {isCurrent ? 'Your plan' : plan.id === 'enterprise' ? 'Talk to sales' : `Move to ${plan.name}`}
                  </Button>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Payment method ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="size-4 text-primary" aria-hidden="true" />
            Payment method
          </CardTitle>
          <CardDescription>
            Charged on the first of each month, alongside the commission from the cycle just
            closed.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 pt-0">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-surface p-4">
            <span
              aria-hidden="true"
              className="grid h-9 w-13 shrink-0 place-items-center rounded-md bg-ink-900 text-[0.625rem] font-bold tracking-wider text-ink-50"
            >
              VISA
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground tabular">•••• •••• •••• 4242</p>
              <p className="text-xs text-muted">Expires 09 / 2029 · Kaimana Reyes</p>
            </div>
            <Badge variant="success" size="sm">
              Default
            </Badge>
            <Button variant="ghost" size="sm">
              Replace
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line-subtle bg-surface-sunken p-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">Billing email</p>
              <p className="text-xs text-muted">accounts@bluehorizonmaui.com · invoices as PDF</p>
            </div>
            <Button variant="ghost" size="sm">
              Change
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Invoices ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" aria-hidden="true" />
            Invoice history
          </CardTitle>
          <CardDescription>Nine months of statements, ready for your accountant.</CardDescription>
          <CardToolbar>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download />}
              onClick={() =>
                toast.success('Export queued', {
                  description: 'A CSV of every invoice is on its way to your billing email.',
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
                  <TableHead>Invoice</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead numeric align="right">
                    Platform
                  </TableHead>
                  <TableHead numeric align="right">
                    Commission
                  </TableHead>
                  <TableHead numeric align="right">
                    Total
                  </TableHead>
                  <TableHead align="right">Status</TableHead>
                  <TableHead align="right">
                    <span className="sr-only">Download</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {INVOICES.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.number}</TableCell>
                    <TableCell className="text-muted">{formatDateLong(inv.issuedAt)}</TableCell>
                    <TableCell numeric align="right">
                      {formatCurrency(inv.platformFee, CURRENCY)}
                    </TableCell>
                    <TableCell numeric align="right">
                      {formatCurrency(inv.commission, CURRENCY)}
                    </TableCell>
                    <TableCell numeric align="right" className="font-semibold">
                      {formatCurrency(inv.total, CURRENCY)}
                    </TableCell>
                    <TableCell align="right">
                      <Badge variant={inv.status === 'paid' ? 'success' : 'warning'} size="sm">
                        {inv.status === 'paid' ? 'Paid' : 'Open'}
                      </Badge>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="ghost"
                        size="xs"
                        leftIcon={<Download />}
                        onClick={() =>
                          toast(`${inv.number}.pdf`, { description: 'Download started.' })
                        }
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
            {INVOICES.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs text-foreground">{inv.number}</p>
                  <p className="text-xs text-muted">{formatDateLong(inv.issuedAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground tabular">
                    {formatCurrency(inv.total, CURRENCY)}
                  </p>
                  <Badge variant={inv.status === 'paid' ? 'success' : 'warning'} size="sm">
                    {inv.status === 'paid' ? 'Paid' : 'Open'}
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

function UsageMeter({
  icon,
  label,
  used,
  limit,
}: {
  icon: React.ReactNode
  label: string
  used: number
  limit: number | null
}) {
  const percent = limit === null ? 0 : Math.min(100, Math.round((used / limit) * 100))
  const tone = percent >= 90 ? 'danger' : percent >= 70 ? 'warning' : 'primary'

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2 text-xs font-medium text-muted">
        <span aria-hidden="true" className="text-subtle">
          {icon}
        </span>
        {label}
      </div>
      <p className="mt-1 font-display text-lg font-semibold tracking-tight text-foreground tabular">
        {formatNumber(used)}
        <span className="text-sm font-normal text-muted">
          {limit === null ? ' / unlimited' : ` / ${formatNumber(limit)}`}
        </span>
      </p>
      {limit === null ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-subtle">
          <Minus className="size-3" aria-hidden="true" />
          No cap on this plan
        </p>
      ) : (
        <Progress value={percent} tone={tone} size="sm" className="mt-2" />
      )}
    </div>
  )
}
