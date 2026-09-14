'use client'

import * as React from 'react'
import {
  CalendarClock,
  ClipboardSignature,
  Clock,
  Hourglass,
  Mail,
  MousePointerClick,
  PiggyBank,
  Save,
  ShieldCheck,
  Undo2,
  UserRoundCheck,
  Users,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import type { BookingRow } from '@/lib/demo'
import {
  cn,
  formatCurrency,
  formatDateLong,
  formatDuration,
  formatTime,
  pluralize,
} from '@/lib/utils'
import type { Payment, Tenant } from '@/types'

type SampleBooking = (BookingRow & { payments: Payment[] }) | undefined

/* ==========================================================================
   DEFAULTS — seeded from the tenant's real policy and plan features
   ========================================================================== */

interface GuestFieldRule {
  key: string
  label: string
  hint: string
  locked?: boolean
}

const GUEST_FIELDS: GuestFieldRule[] = [
  { key: 'fullName', label: 'Full name', hint: 'Printed on the manifest', locked: true },
  { key: 'email', label: 'Email address', hint: 'Confirmation and reminders', locked: true },
  { key: 'phone', label: 'Mobile number', hint: 'Weather holds and SMS reminders' },
  { key: 'country', label: 'Country of residence', hint: 'Feeds your geography report' },
  { key: 'age', label: 'Age of each participant', hint: 'Enforces the minimum age rule' },
  { key: 'weight', label: 'Weight', hint: 'Required for parasail and dive activities' },
  { key: 'experience', label: 'Experience level', hint: 'Lets guides pre-group the boat' },
  { key: 'dietary', label: 'Dietary requirements', hint: 'Only asked when catering is included' },
  { key: 'emergency', label: 'Emergency contact', hint: 'High-consequence activities only' },
  { key: 'hotel', label: 'Hotel / pickup point', hint: 'Drives the shuttle run sheet' },
]

interface BookingRules {
  freeCancellationHours: number
  lateRefundPercent: number
  depositsEnabled: boolean
  depositPercent: number
  balanceDueDays: number
  cutOffHours: number
  minLeadMinutes: number
  maxAdvanceDays: number
  waitlistsEnabled: boolean
  waitlistAutoPromote: boolean
  requiredFields: string[]
  waiverRequired: boolean
  waiverScope: 'all' | 'high_risk' | 'lead_only'
  waiverProvider: string
  recoveryEnabled: boolean
  recoveryDelayMinutes: number
  recoveryDiscountPercent: number
  recoveryReminders: number
}

function defaultRules(tenant: Tenant): BookingRules {
  return {
    freeCancellationHours: 24,
    lateRefundPercent: 50,
    depositsEnabled: true,
    depositPercent: 25,
    balanceDueDays: 3,
    cutOffHours: 2,
    minLeadMinutes: 90,
    maxAdvanceDays: 365,
    waitlistsEnabled: tenant.features.waitlists,
    waitlistAutoPromote: true,
    requiredFields: ['fullName', 'email', 'phone', 'country', 'age', 'hotel'],
    waiverRequired: true,
    waiverScope: 'all',
    waiverProvider: 'ezra',
    recoveryEnabled: true,
    recoveryDelayMinutes: 45,
    recoveryDiscountPercent: 10,
    recoveryReminders: 2,
  }
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export interface BookingFlowSettingsClientProps {
  tenant: Tenant
  sampleBooking: SampleBooking
}

/**
 * `sampleBooking` is fetched server-side — this file never imports
 * `@/lib/demo` itself, so the synthetic dataset stays out of the client
 * bundle.
 */
export function BookingFlowSettingsClient({
  tenant: CURRENT_TENANT,
  sampleBooking: SAMPLE_BOOKING,
}: BookingFlowSettingsClientProps) {
  const [rules, setRules] = React.useState<BookingRules>(() => defaultRules(CURRENT_TENANT))
  const [saving, setSaving] = React.useState(false)

  const set = <K extends keyof BookingRules>(key: K, value: BookingRules[K]) =>
    setRules((prev) => ({ ...prev, [key]: value }))

  const toggleField = (key: string) =>
    setRules((prev) => ({
      ...prev,
      requiredFields: prev.requiredFields.includes(key)
        ? prev.requiredFields.filter((f) => f !== key)
        : [...prev.requiredFields, key],
    }))

  const dirty = React.useMemo(
    () => JSON.stringify(rules) !== JSON.stringify(defaultRules(CURRENT_TENANT)),
    [rules, CURRENT_TENANT],
  )

  function save() {
    setSaving(true)
    window.setTimeout(() => {
      setSaving(false)
      toast.success('Booking rules saved', {
        description: 'Applied to every new booking from now on. Existing bookings keep their terms.',
      })
    }, 620)
  }

  const policySummary =
    rules.lateRefundPercent === 0
      ? `Free cancellation up to ${rules.freeCancellationHours}h before departure. Inside that window the booking is non-refundable.`
      : `Free cancellation up to ${rules.freeCancellationHours}h before departure, then ${rules.lateRefundPercent}% is refunded.`

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* ---------------- Cancellation ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Undo2 className="size-4 text-primary" aria-hidden="true" />
            Cancellation policy
          </CardTitle>
          <CardDescription>
            Shown on every activity page, at checkout and on the confirmation. Individual
            activities can override it.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-6 pt-0">
          <SliderRow
            label="Free cancellation window"
            value={rules.freeCancellationHours}
            min={0}
            max={168}
            step={1}
            display={
              rules.freeCancellationHours === 0
                ? 'No free cancellation'
                : `${rules.freeCancellationHours}h before departure`
            }
            ticks={['0h', '24h', '48h', '72h', '1 week']}
            onChange={(v) => set('freeCancellationHours', v)}
          />

          <SliderRow
            label="Refund inside the window"
            value={rules.lateRefundPercent}
            min={0}
            max={100}
            step={5}
            display={`${rules.lateRefundPercent}% refunded`}
            ticks={['0%', '25%', '50%', '75%', '100%']}
            onChange={(v) => set('lateRefundPercent', v)}
          />

          <Alert variant="info" emphasis="soft">
            <AlertTitle>Guests will read this</AlertTitle>
            <AlertDescription>{policySummary}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* ---------------- Deposits ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="size-4 text-primary" aria-hidden="true" />
            Deposits
          </CardTitle>
          <CardDescription>
            Take part of the fare up front and collect the balance automatically before the trip.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 pt-0">
          <ToggleRow
            title="Allow deposit bookings"
            body="Guests pay a percentage now; the card on file is charged for the balance."
            checked={rules.depositsEnabled}
            onCheckedChange={(v) => set('depositsEnabled', v)}
          />

          <div
            className={cn(
              'grid gap-5 transition-opacity duration-200 sm:grid-cols-2',
              !rules.depositsEnabled && 'pointer-events-none opacity-45',
            )}
          >
            <SliderRow
              label="Deposit amount"
              value={rules.depositPercent}
              min={10}
              max={100}
              step={5}
              display={`${rules.depositPercent}% of the total`}
              ticks={['10%', '50%', '100%']}
              disabled={!rules.depositsEnabled}
              onChange={(v) => set('depositPercent', v)}
            />

            <Field
              label="Collect the balance"
              description="Charged automatically to the saved card."
            >
              {({ id }) => (
                <Select
                  value={String(rules.balanceDueDays)}
                  onValueChange={(v) => set('balanceDueDays', Number(v))}
                  disabled={!rules.depositsEnabled}
                >
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 7, 14].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} {pluralize(d, 'day')} before departure
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>

          {rules.depositsEnabled && SAMPLE_BOOKING ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line-subtle bg-surface-sunken px-3 py-2.5 text-xs text-muted">
              <Badge variant="primary" size="sm">
                Example
              </Badge>
              A{' '}
              {formatCurrency(SAMPLE_BOOKING.booking.total, SAMPLE_BOOKING.booking.currency)}{' '}
              booking takes{' '}
              <strong className="font-semibold text-foreground tabular">
                {formatCurrency(
                  Math.round((SAMPLE_BOOKING.booking.total * rules.depositPercent) / 100),
                  SAMPLE_BOOKING.booking.currency,
                )}
              </strong>{' '}
              now and{' '}
              <strong className="font-semibold text-foreground tabular">
                {formatCurrency(
                  SAMPLE_BOOKING.booking.total -
                    Math.round((SAMPLE_BOOKING.booking.total * rules.depositPercent) / 100),
                  SAMPLE_BOOKING.booking.currency,
                )}
              </strong>{' '}
              {rules.balanceDueDays} {pluralize(rules.balanceDueDays, 'day')} out.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ---------------- Timing ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" aria-hidden="true" />
            Booking windows
          </CardTitle>
          <CardDescription>
            How late guests can book, how far ahead the calendar opens, and what happens when a
            departure fills.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-5 pt-0 sm:grid-cols-2">
          <Field
            label="Online cut-off"
            description="Online sales close this long before the start time."
          >
            {({ id }) => (
              <Select
                value={String(rules.cutOffHours)}
                onValueChange={(v) => set('cutOffHours', Number(v))}
              >
                <SelectTrigger id={id} icon={<Clock className="size-4" />}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2, 4, 12, 24, 48].map((h) => (
                    <SelectItem
                      key={h}
                      value={String(h)}
                      description={h === 0 ? 'Sell right up to departure' : undefined}
                    >
                      {h === 0 ? 'No cut-off' : `${h} ${pluralize(h, 'hour')} before`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field
            label="Minimum lead time"
            description="Gives the crew time to prepare and print manifests."
          >
            {({ id }) => (
              <Select
                value={String(rules.minLeadMinutes)}
                onValueChange={(v) => set('minLeadMinutes', Number(v))}
              >
                <SelectTrigger id={id} icon={<Hourglass className="size-4" />}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 30, 60, 90, 120, 240].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m === 0 ? 'Instant' : formatDuration(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field
            label="Calendar opens"
            description="How far into the future guests can book."
            className="sm:col-span-2"
          >
            {({ id }) => (
              <Select
                value={String(rules.maxAdvanceDays)}
                onValueChange={(v) => set('maxAdvanceDays', Number(v))}
              >
                <SelectTrigger id={id}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[90, 180, 365, 540].map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {d} days ahead
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Field>

          <Separator className="sm:col-span-2" />

          <div className="flex flex-col gap-4 sm:col-span-2">
            <ToggleRow
              title="Waitlists on sold-out departures"
              body="Guests join a list instead of bouncing. You keep the demand signal."
              checked={rules.waitlistsEnabled}
              onCheckedChange={(v) => set('waitlistsEnabled', v)}
              badge={
                CURRENT_TENANT.features.waitlists ? undefined : (
                  <Badge variant="warning" size="sm">
                    Growth plan
                  </Badge>
                )
              }
            />
            <ToggleRow
              title="Auto-promote from the waitlist"
              body="A cancellation instantly offers the seat to the next guest for 30 minutes."
              checked={rules.waitlistAutoPromote}
              disabled={!rules.waitlistsEnabled}
              onCheckedChange={(v) => set('waitlistAutoPromote', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Guest details ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" aria-hidden="true" />
            Guest details
          </CardTitle>
          <CardDescription>
            Every field you add costs conversion. Ask for what the crew genuinely needs on the
            dock — the rest can wait for the pre-trip email.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 pt-0">
          <div className="grid gap-2 sm:grid-cols-2">
            {GUEST_FIELDS.map((field) => {
              const checked = rules.requiredFields.includes(field.key)
              const fieldId = `guest-field-${field.key}`
              return (
                <label
                  key={field.key}
                  htmlFor={fieldId}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3',
                    'transition-all duration-200 ease-[var(--ease-out-expo)]',
                    checked
                      ? 'border-primary/45 bg-primary-soft/30'
                      : 'border-line bg-surface hover:border-line-strong',
                    field.locked && 'cursor-not-allowed opacity-75',
                  )}
                >
                  <Checkbox
                    id={fieldId}
                    checked={checked}
                    disabled={field.locked}
                    onCheckedChange={() => toggleField(field.key)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {field.label}
                      {field.locked ? (
                        <Badge variant="outline" size="sm">
                          Always
                        </Badge>
                      ) : null}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted">
                      {field.hint}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>

          <p className="text-xs text-subtle">
            Asking for {rules.requiredFields.length} fields. Operators who ask for six or fewer see
            roughly 8% higher checkout completion.
          </p>
        </CardContent>
      </Card>

      {/* ---------------- Waivers ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardSignature className="size-4 text-primary" aria-hidden="true" />
            Liability waivers
          </CardTitle>
          <CardDescription>
            Collected during checkout and re-surfaced on the manifest so the crew can see who has
            signed.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 pt-0">
          <ToggleRow
            title="Require a signed waiver"
            body="Unsigned guests are flagged on the run sheet and sent a one-tap signing link."
            checked={rules.waiverRequired}
            onCheckedChange={(v) => set('waiverRequired', v)}
          />

          <div
            className={cn(
              'grid gap-5 sm:grid-cols-2',
              !rules.waiverRequired && 'pointer-events-none opacity-45',
            )}
          >
            <Field label="Who has to sign">
              {({ id }) => (
                <Select
                  value={rules.waiverScope}
                  onValueChange={(v) => set('waiverScope', v as BookingRules['waiverScope'])}
                  disabled={!rules.waiverRequired}
                >
                  <SelectTrigger id={id} icon={<UserRoundCheck className="size-4" />}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" description="Safest, and what most insurers want">
                      Every participant
                    </SelectItem>
                    <SelectItem value="lead_only" description="Fastest checkout">
                      Lead guest only
                    </SelectItem>
                    <SelectItem value="high_risk" description="Dive, parasail, freedive">
                      High-consequence activities only
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label="Signing provider">
              {({ id }) => (
                <Select
                  value={rules.waiverProvider}
                  onValueChange={(v) => set('waiverProvider', v)}
                  disabled={!rules.waiverRequired}
                >
                  <SelectTrigger id={id} icon={<ShieldCheck className="size-4" />}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ezra" description="Included on every plan">
                      EZRA Waivers
                    </SelectItem>
                    <SelectItem value="docusign" description="Connected integration">
                      DocuSign
                    </SelectItem>
                    <SelectItem value="smartwaiver" description="Connected integration">
                      Smartwaiver
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ---------------- Confirmation email ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4 text-primary" aria-hidden="true" />
            Confirmation email
          </CardTitle>
          <CardDescription>
            Sent the second a booking is paid. Re-renders as you change the rules above.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <ConfirmationPreview rules={rules} tenant={CURRENT_TENANT} sampleBooking={SAMPLE_BOOKING} />
        </CardContent>
      </Card>

      {/* ---------------- Abandoned cart ---------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MousePointerClick className="size-4 text-primary" aria-hidden="true" />
            Abandoned cart recovery
          </CardTitle>
          <CardDescription>
            Blue Horizon recovered 184 carts in the last 30 days — about $41,200 that would
            otherwise have walked.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-5 pt-0">
          <ToggleRow
            title="Email guests who do not finish checkout"
            body="Only fires when we captured an email address before the drop-off."
            checked={rules.recoveryEnabled}
            onCheckedChange={(v) => set('recoveryEnabled', v)}
          />

          <div
            className={cn(
              'grid gap-5 sm:grid-cols-3',
              !rules.recoveryEnabled && 'pointer-events-none opacity-45',
            )}
          >
            <Field label="First reminder after">
              {({ id }) => (
                <Select
                  value={String(rules.recoveryDelayMinutes)}
                  onValueChange={(v) => set('recoveryDelayMinutes', Number(v))}
                  disabled={!rules.recoveryEnabled}
                >
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60, 120].map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {formatDuration(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label="Reminders in total">
              {({ id }) => (
                <Select
                  value={String(rules.recoveryReminders)}
                  onValueChange={(v) => set('recoveryReminders', Number(v))}
                  disabled={!rules.recoveryEnabled}
                >
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {pluralize(n, 'email')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Field>

            <Field label="Incentive" description="Applied on the final reminder only.">
              <Input
                type="number"
                min={0}
                max={40}
                step={5}
                value={rules.recoveryDiscountPercent}
                disabled={!rules.recoveryEnabled}
                onChange={(e) =>
                  set('recoveryDiscountPercent', Math.max(0, Math.min(40, Number(e.target.value))))
                }
                suffix="% off"
              />
            </Field>
          </div>
        </CardContent>

        <CardFooter separated className="justify-between gap-3">
          <p className="text-xs text-subtle">
            {dirty ? 'You have unsaved booking rules.' : 'All booking rules are up to date.'}
          </p>
          <Button size="sm" leftIcon={<Save />} loading={saving} onClick={save} disabled={!dirty}>
            Save booking rules
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

/* ==========================================================================
   PIECES
   ========================================================================== */

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  ticks,
  disabled,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  display: string
  ticks: string[]
  disabled?: boolean
  onChange: (value: number) => void
}) {
  const id = React.useId()
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <span className="text-sm font-semibold text-primary tabular">{display}</span>
      </div>
      <Slider
        id={id}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        thumbLabels={[label]}
        onValueChange={(next) => onChange(next[0])}
      />
      <div className="flex items-center justify-between text-[0.6875rem] text-faint tabular">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
    </div>
  )
}

function ToggleRow({
  title,
  body,
  checked,
  onCheckedChange,
  disabled,
  badge,
}: {
  title: string
  body: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  badge?: React.ReactNode
}) {
  const id = React.useId()
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-3.5',
        disabled && 'opacity-50',
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor={id} className="cursor-pointer">
            {title}
          </Label>
          {badge}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">{body}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        className="mt-0.5 shrink-0"
      />
    </div>
  )
}

function ConfirmationPreview({
  rules,
  tenant,
  sampleBooking,
}: {
  rules: BookingRules
  tenant: Tenant
  sampleBooking: SampleBooking
}) {
  if (!sampleBooking) return null

  const { booking, activity, customer, departure } = sampleBooking
  const deposit = rules.depositsEnabled
    ? Math.round((booking.total * rules.depositPercent) / 100)
    : booking.total

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-sunken">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5 text-xs">
        <span className="text-subtle">To</span>
        <span className="font-medium text-foreground">{customer.email}</span>
        <span className="ml-auto hidden text-subtle sm:inline">
          Subject: You&rsquo;re booked — {activity.name}
        </span>
      </div>

      <div className="mx-auto max-w-lg space-y-4 p-5">
        <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          <p className="text-[0.6875rem] font-semibold tracking-[0.14em] text-primary uppercase">
            {tenant.branding.logoText}
          </p>
          <h3 className="mt-2 font-display text-lg font-semibold tracking-tight text-foreground">
            You&rsquo;re booked, {customer.firstName}.
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Confirmation <span className="font-mono font-medium text-foreground">{booking.reference}</span>{' '}
            — see you at {activity.meetingPoint}.
          </p>

          <div className="mt-4 grid gap-3 rounded-lg border border-line-subtle bg-surface-sunken p-3.5 text-sm sm:grid-cols-2">
            <PreviewRow label="Experience" value={activity.name} />
            <PreviewRow label="Date" value={formatDateLong(departure.startsAt)} />
            <PreviewRow label="Check-in" value={formatTime(departure.startsAt)} />
            <PreviewRow
              label="Guests"
              value={`${booking.partySize} ${pluralize(booking.partySize, 'guest')}`}
            />
          </div>

          <div className="mt-4 flex items-baseline justify-between border-t border-line-subtle pt-3">
            <span className="text-sm text-muted">
              {rules.depositsEnabled ? `Deposit paid (${rules.depositPercent}%)` : 'Paid in full'}
            </span>
            <span className="text-base font-semibold text-foreground tabular">
              {formatCurrency(deposit, booking.currency)}
            </span>
          </div>

          {rules.depositsEnabled ? (
            <p className="mt-1 text-xs text-muted">
              Balance of {formatCurrency(booking.total - deposit, booking.currency)} is charged{' '}
              {rules.balanceDueDays} {pluralize(rules.balanceDueDays, 'day')} before departure.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-on-primary">
              View booking
            </span>
            <span className="rounded-lg border border-line px-3.5 py-2 text-xs font-semibold text-foreground">
              Add to calendar
            </span>
            {rules.waiverRequired ? (
              <span className="rounded-lg border border-line px-3.5 py-2 text-xs font-semibold text-foreground">
                Sign waiver
              </span>
            ) : null}
          </div>

          <p className="mt-4 border-t border-line-subtle pt-3 text-[0.6875rem] leading-relaxed text-subtle">
            {rules.freeCancellationHours > 0
              ? `Free cancellation up to ${rules.freeCancellationHours} hours before departure.`
              : 'This booking is non-refundable.'}{' '}
            {rules.lateRefundPercent > 0 && rules.freeCancellationHours > 0
              ? `After that, ${rules.lateRefundPercent}% is refunded.`
              : ''}{' '}
            Questions? Reply to this email or call {tenant.contact.phone}.
          </p>
        </div>
      </div>
    </div>
  )
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.6875rem] font-semibold tracking-[0.08em] text-faint uppercase">
        {label}
      </p>
      <p className="truncate text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
