'use client'

import * as React from 'react'
import {
  ArrowUpRight,
  Banknote,
  BadgePercent,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  HandCoins,
  Landmark,
  Percent,
  Receipt,
  Save,
  Wallet,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { cn, addDays, formatCurrency, formatDateLong, formatNumber } from '@/lib/utils'
import type { KpiMetric, Tenant } from '@/types'

/* ==========================================================================
   NUMBERS — derived from the tenant's 30-day KPIs, fetched server-side.
   ========================================================================== */

function computePaymentsData(tenant: Tenant, kpis: KpiMetric[], now: Date) {
  const netRevenue = kpis.find((k) => k.key === 'net_revenue')?.value ?? 0
  const bookingCount = kpis.find((k) => k.key === 'bookings')?.value ?? 0
  return {
    currency: tenant.currency,
    netRevenue,
    bookingCount,
    // Stripe's standard 2.9% + 30c, applied to the trailing 30 days.
    processorFees: Math.round(netRevenue * 0.029 + bookingCount * 30),
    pendingBalance: Math.round(netRevenue * 0.061),
    nextPayout: addDays(now, 1),
  }
}

interface PaymentSettings {
  payoutSchedule: 'daily' | 'weekly' | 'monthly'
  payoutWeekday: string
  statementDescriptor: string
  taxEnabled: boolean
  taxRate: string
  taxMode: 'inclusive' | 'exclusive'
  taxLabel: string
  taxId: string
  feeBearer: 'operator' | 'guest'
  bookingFeePercent: string
  bookingFeeFixed: string
  tippingEnabled: boolean
  tipPresets: string
  tipRecipient: 'crew_pool' | 'assigned_guide' | 'business'
}

const INITIAL: PaymentSettings = {
  payoutSchedule: 'daily',
  payoutWeekday: 'monday',
  statementDescriptor: 'BLUEHORIZON MAUI',
  taxEnabled: true,
  taxRate: '4.712',
  taxMode: 'exclusive',
  taxLabel: 'Hawaii GET + county surcharge',
  taxId: 'GE-123-4567-8901-02',
  feeBearer: 'guest',
  bookingFeePercent: '2.5',
  bookingFeeFixed: '1.50',
  tippingEnabled: true,
  tipPresets: '15, 18, 20, 25',
  tipRecipient: 'crew_pool',
}

export interface PaymentSettingsClientProps {
  tenant: Tenant
  now: Date
  kpis: KpiMetric[]
}

/**
 * All money figures derive from `kpis`, fetched server-side — this file
 * never imports `@/lib/demo` itself.
 */
export function PaymentSettingsClient({ tenant: CURRENT_TENANT, now: NOW, kpis }: PaymentSettingsClientProps) {
  const {
    currency: CURRENCY,
    netRevenue: NET_REVENUE,
    bookingCount: BOOKING_COUNT,
    processorFees: PROCESSOR_FEES,
    pendingBalance: PENDING_BALANCE,
    nextPayout: NEXT_PAYOUT,
  } = React.useMemo(() => computePaymentsData(CURRENT_TENANT, kpis, NOW), [CURRENT_TENANT, kpis, NOW])
  const [settings, setSettings] = React.useState<PaymentSettings>(INITIAL)
  const [saving, setSaving] = React.useState(false)

  const set = <K extends keyof PaymentSettings>(key: K, value: PaymentSettings[K]) =>
    setSettings((prev) => ({ ...prev, [key]: value }))

  const dirty = React.useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(INITIAL),
    [settings],
  )

  function save() {
    setSaving(true)
    window.setTimeout(() => {
      setSaving(false)
      toast.success('Payment settings saved', {
        description: 'New bookings use these rules immediately.',
      })
    }, 620)
  }

  const taxRateNumber = Number(settings.taxRate) || 0
  const sampleFare = 18900
  const sampleTax = settings.taxEnabled
    ? settings.taxMode === 'exclusive'
      ? Math.round((sampleFare * taxRateNumber) / 100)
      : Math.round(sampleFare - sampleFare / (1 + taxRateNumber / 100))
    : 0
  const sampleFee =
    Math.round((sampleFare * (Number(settings.bookingFeePercent) || 0)) / 100) +
    Math.round((Number(settings.bookingFeeFixed) || 0) * 100)
  const guestPays =
    (settings.taxMode === 'exclusive' ? sampleFare + sampleTax : sampleFare) +
    (settings.feeBearer === 'guest' ? sampleFee : 0)

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* ---------------- Processor ---------------- */}
      <Card variant="gradient">
        <CardContent className="flex flex-col gap-5 p-5">
          <div className="flex flex-wrap items-start gap-4">
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center rounded-xl bg-surface shadow-sm ring-1 ring-line"
            >
              <CreditCard className="size-5 text-primary" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-base font-semibold tracking-tight text-foreground">
                  Stripe
                </h3>
                <Badge variant="success" size="sm">
                  <CheckCircle2 className="size-3" aria-hidden="true" />
                  Connected
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted">
                Account{' '}
                <span className="font-mono text-[0.8125rem] text-foreground">
                  acct_1QfR7kJ2xPbL9mZa
                </span>{' '}
                · charges and payouts enabled
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {['Visa', 'Mastercard', 'Amex', 'Apple Pay', 'Google Pay', 'Link'].map((m) => (
                  <Badge key={m} variant="outline" size="sm">
                    {m}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" rightIcon={<ArrowUpRight />}>
                Manage in Stripe
              </Button>
            </div>
          </div>

          <Separator />

          <dl className="grid gap-4 sm:grid-cols-3">
            <LedgerStat
              label="Available to pay out"
              value={formatCurrency(PENDING_BALANCE, CURRENCY)}
              hint={`Next payout ${formatDateLong(NEXT_PAYOUT)}`}
            />
            <LedgerStat
              label="Processed, last 30 days"
              value={formatCurrency(NET_REVENUE, CURRENCY, { compact: true })}
              hint={`${formatNumber(BOOKING_COUNT)} charges`}
            />
            <LedgerStat
              label="Processing fees"
              value={formatCurrency(PROCESSOR_FEES, CURRENCY, { compact: true })}
              hint="2.9% + 30¢ per charge"
            />
          </dl>
        </CardContent>
      </Card>

      {/* ---------------- Payouts ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Landmark className="size-4 text-primary" aria-hidden="true" />
            Payouts
          </CardTitle>
          <CardDescription>
            When money leaves Stripe for your bank, and what your guests see on their statement.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-5 pt-0 sm:grid-cols-2">
          <Field label="Payout schedule" description="Daily is the default on the Growth plan.">
            {({ id }) => (
              <Select
                value={settings.payoutSchedule}
                onValueChange={(v) =>
                  set('payoutSchedule', v as PaymentSettings['payoutSchedule'])
                }
              >
                <SelectTrigger id={id} icon={<CalendarDays className="size-4" />}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily" description="Rolling, 2 business days after the charge">
                    Daily automatic
                  </SelectItem>
                  <SelectItem value="weekly" description="One consolidated transfer a week">
                    Weekly
                  </SelectItem>
                  <SelectItem value="monthly" description="Simplest reconciliation">
                    Monthly
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field
            label="Payout day"
            description="Only applies to weekly and monthly schedules."
          >
            {({ id }) => (
              <Select
                value={settings.payoutWeekday}
                onValueChange={(v) => set('payoutWeekday', v)}
                disabled={settings.payoutSchedule === 'daily'}
              >
                <SelectTrigger id={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((d) => (
                    <SelectItem key={d} value={d} className="capitalize">
                      <span className="capitalize">{d}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field
            label="Statement descriptor"
            description="Shortens chargebacks — guests recognise the name."
            hint={`${settings.statementDescriptor.length}/22`}
          >
            <Input
              value={settings.statementDescriptor}
              maxLength={22}
              onChange={(e) => set('statementDescriptor', e.target.value.toUpperCase())}
              inputClassName="font-mono uppercase"
            />
          </Field>

          <Field label="Settlement currency" description="Change this in General settings.">
            <Input
              readOnly
              value={`${CURRENCY} — ${CURRENT_TENANT.country}`}
              className="bg-surface-sunken"
              leftIcon={<Wallet className="size-4" />}
            />
          </Field>

          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-sunken p-3.5 sm:col-span-2">
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface text-subtle ring-1 ring-line"
            >
              <Banknote className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                Bank of Hawaii · Business checking
              </p>
              <p className="text-xs text-muted tabular">Routing 121301028 · Account ••••4821</p>
            </div>
            <Button variant="ghost" size="sm">
              Replace
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Tax ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-4 text-primary" aria-hidden="true" />
            Tax
          </CardTitle>
          <CardDescription>
            Applied to every ticket and add-on, and itemised on the guest receipt.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 pt-0">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-3.5">
            <div className="min-w-0 flex-1">
              <Label htmlFor="tax-enabled" className="cursor-pointer">
                Collect tax on bookings
              </Label>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Turn off only if your fares are already tax-free or tax is remitted by a
                marketplace.
              </p>
            </div>
            <Switch
              id="tax-enabled"
              checked={settings.taxEnabled}
              onCheckedChange={(v) => set('taxEnabled', v)}
              className="mt-0.5 shrink-0"
            />
          </div>

          <div
            className={cn(
              'grid gap-5 sm:grid-cols-2',
              !settings.taxEnabled && 'pointer-events-none opacity-45',
            )}
          >
            <Field label="Tax rate" description="Up to three decimal places.">
              <Input
                value={settings.taxRate}
                inputMode="decimal"
                disabled={!settings.taxEnabled}
                onChange={(e) => set('taxRate', e.target.value)}
                suffix="%"
              />
            </Field>

            <Field label="Tax label" description="Shown on the receipt line item.">
              <Input
                value={settings.taxLabel}
                disabled={!settings.taxEnabled}
                onChange={(e) => set('taxLabel', e.target.value)}
              />
            </Field>

            <Field label="Tax registration number" className="sm:col-span-2">
              <Input
                value={settings.taxId}
                disabled={!settings.taxEnabled}
                onChange={(e) => set('taxId', e.target.value)}
                inputClassName="font-mono"
              />
            </Field>

            <fieldset className="sm:col-span-2">
              <legend className="mb-2 text-sm font-medium text-foreground">
                How tax sits in your prices
              </legend>
              <RadioGroup
                value={settings.taxMode}
                onValueChange={(v) => set('taxMode', v as PaymentSettings['taxMode'])}
                disabled={!settings.taxEnabled}
                className="sm:grid-cols-2"
                orientation="vertical"
              >
                <RadioGroupCard
                  value="exclusive"
                  label="Added at checkout"
                  description="Listed price is pre-tax; tax appears as its own line."
                  trailing={formatCurrency(sampleFare + sampleTax, CURRENCY)}
                />
                <RadioGroupCard
                  value="inclusive"
                  label="Included in the price"
                  description="Listed price is what the guest pays; tax is backed out."
                  trailing={formatCurrency(sampleFare, CURRENCY)}
                />
              </RadioGroup>
            </fieldset>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Service fee ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgePercent className="size-4 text-primary" aria-hidden="true" />
            Service fee
          </CardTitle>
          <CardDescription>
            EZRA Pro charges {CURRENT_TENANT.plan === 'growth' ? '4.5%' : '3%'} per booking. You
            decide whether that comes out of your margin or is shown to the guest.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 pt-0">
          <RadioGroup
            value={settings.feeBearer}
            onValueChange={(v) => set('feeBearer', v as PaymentSettings['feeBearer'])}
            className="sm:grid-cols-2"
          >
            <RadioGroupCard
              value="operator"
              icon={<HandCoins />}
              label="I absorb it"
              description="Cleanest price on the page. Comes out of your net."
            />
            <RadioGroupCard
              value="guest"
              icon={<Percent />}
              label="Guest pays it"
              description="Shown as a booking fee line at checkout."
            />
          </RadioGroup>

          <div
            className={cn(
              'grid gap-5 sm:grid-cols-2',
              settings.feeBearer === 'operator' && 'pointer-events-none opacity-45',
            )}
          >
            <Field label="Booking fee — percentage">
              <Input
                value={settings.bookingFeePercent}
                inputMode="decimal"
                disabled={settings.feeBearer === 'operator'}
                onChange={(e) => set('bookingFeePercent', e.target.value)}
                suffix="%"
              />
            </Field>
            <Field label="Booking fee — fixed">
              <Input
                value={settings.bookingFeeFixed}
                inputMode="decimal"
                disabled={settings.feeBearer === 'operator'}
                onChange={(e) => set('bookingFeeFixed', e.target.value)}
                suffix={CURRENCY}
              />
            </Field>
          </div>

          {/* Worked example */}
          <div className="overflow-hidden rounded-xl border border-line">
            <p className="border-b border-line bg-surface-sunken px-4 py-2 text-xs font-semibold tracking-[0.08em] text-subtle uppercase">
              What a two-adult sunset sail looks like
            </p>
            <dl className="divide-y divide-line-subtle text-sm">
              <ExampleRow label="Tickets · 2 adults" value={formatCurrency(sampleFare, CURRENCY)} />
              {settings.taxEnabled ? (
                <ExampleRow
                  label={`${settings.taxLabel} (${settings.taxRate}%${
                    settings.taxMode === 'inclusive' ? ', included' : ''
                  })`}
                  value={formatCurrency(sampleTax, CURRENCY)}
                  muted={settings.taxMode === 'inclusive'}
                />
              ) : null}
              {settings.feeBearer === 'guest' ? (
                <ExampleRow label="Booking fee" value={formatCurrency(sampleFee, CURRENCY)} />
              ) : null}
              <ExampleRow label="Guest pays" value={formatCurrency(guestPays, CURRENCY)} strong />
            </dl>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Tipping ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HandCoins className="size-4 text-primary" aria-hidden="true" />
            Tipping
          </CardTitle>
          <CardDescription>
            Crews at operators with post-trip tipping enabled take home an average of 11% more per
            season.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 pt-0">
          <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-3.5">
            <div className="min-w-0 flex-1">
              <Label htmlFor="tipping-enabled" className="cursor-pointer">
                Offer tipping at checkout and after the trip
              </Label>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Tips are never subject to the EZRA Pro service fee.
              </p>
            </div>
            <Switch
              id="tipping-enabled"
              checked={settings.tippingEnabled}
              onCheckedChange={(v) => set('tippingEnabled', v)}
              className="mt-0.5 shrink-0"
            />
          </div>

          <div
            className={cn(
              'grid gap-5 sm:grid-cols-2',
              !settings.tippingEnabled && 'pointer-events-none opacity-45',
            )}
          >
            <Field
              label="Suggested percentages"
              description="Comma separated. The middle option is pre-selected."
            >
              <Input
                value={settings.tipPresets}
                disabled={!settings.tippingEnabled}
                onChange={(e) => set('tipPresets', e.target.value)}
                inputClassName="tabular-nums"
              />
            </Field>

            <Field label="Tips go to">
              {({ id }) => (
                <Select
                  value={settings.tipRecipient}
                  onValueChange={(v) => set('tipRecipient', v as PaymentSettings['tipRecipient'])}
                  disabled={!settings.tippingEnabled}
                >
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crew_pool" description="Split evenly across the manifest">
                      Crew pool for that departure
                    </SelectItem>
                    <SelectItem value="assigned_guide" description="Paid with the next payout run">
                      The assigned guide
                    </SelectItem>
                    <SelectItem value="business" description="You distribute off-platform">
                      The business account
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
        </CardContent>

        <CardFooter separated className="justify-between gap-3">
          <p className="text-xs text-subtle">
            {dirty ? 'Unsaved payment settings.' : 'Payment settings are up to date.'}
          </p>
          <Button size="sm" leftIcon={<Save />} loading={saving} onClick={save} disabled={!dirty}>
            Save payment settings
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

/* ========================================================================== */

function LedgerStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-xl font-semibold tracking-tight text-foreground tabular">
        {value}
      </dd>
      <p className="mt-0.5 text-xs text-subtle">{hint}</p>
    </div>
  )
}

function ExampleRow({
  label,
  value,
  strong,
  muted,
}: {
  label: string
  value: string
  strong?: boolean
  muted?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-4 py-2.5',
        strong && 'bg-surface-sunken',
      )}
    >
      <dt className={cn('min-w-0 truncate', strong ? 'font-medium text-foreground' : 'text-muted')}>
        {label}
      </dt>
      <dd
        className={cn(
          'shrink-0 tabular',
          strong ? 'text-base font-semibold text-foreground' : 'text-foreground',
          muted && 'text-subtle',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
