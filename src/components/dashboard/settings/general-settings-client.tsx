'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  Building2,
  CircleAlert,
  Globe2,
  MapPin,
  PauseCircle,
  Phone,
  RotateCcw,
  Save,
  ShieldAlert,
  Trash2,
} from 'lucide-react'
import { z } from 'zod'

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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { toast } from '@/components/ui/toaster'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { NICHES, nicheOf } from '@/lib/data/verticals'
import { cn, formatDateLong } from '@/lib/utils'
import type { CurrencyCode, Tenant, VerticalKey } from '@/types'

/* ==========================================================================
   SCHEMA
   ========================================================================== */

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Guests see this name at checkout — it cannot be blank.'),
  legalName: z.string().trim().min(2, 'The registered entity name appears on every receipt.'),
  vertical: z.string().min(1, 'Pick the category that best describes what you sell.'),
  email: z.email('Confirmations reply to this address, so it has to be valid.'),
  phone: z.string().trim().min(7, 'Include a number guests and OTAs can reach you on.'),
  website: z.url('Use a full URL, including https://'),
  addressLine: z.string().trim().min(6, 'A full street address keeps receipts tax-compliant.'),
  city: z.string().trim().min(2, 'Which city do you operate out of?'),
  country: z.string().trim().min(2, 'Required for tax and payout routing.'),
  timezone: z.string().min(1, 'Departure times are stored in this timezone.'),
  currency: z.string().min(1, 'Pick the currency you are paid in.'),
  locale: z.string().min(1, 'Sets the date, number and address format guests see.'),
})

type ProfileValues = z.infer<typeof profileSchema>
type FieldName = keyof ProfileValues

/* ==========================================================================
   OPTIONS
   ========================================================================== */

const TIMEZONES = [
  { value: 'Pacific/Honolulu', label: 'Pacific/Honolulu', hint: 'UTC−10:00 · Hawaii' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles', hint: 'UTC−07:00 · Pacific' },
  { value: 'America/New_York', label: 'America/New York', hint: 'UTC−04:00 · Eastern' },
  { value: 'Europe/London', label: 'Europe/London', hint: 'UTC+01:00 · British' },
  { value: 'Europe/Athens', label: 'Europe/Athens', hint: 'UTC+03:00 · Eastern European' },
  { value: 'Australia/Brisbane', label: 'Australia/Brisbane', hint: 'UTC+10:00 · Queensland' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland', hint: 'UTC+12:00 · New Zealand' },
]

const CURRENCIES: { value: CurrencyCode; label: string; hint: string }[] = [
  { value: 'USD', label: 'USD — US Dollar', hint: '$' },
  { value: 'EUR', label: 'EUR — Euro', hint: '€' },
  { value: 'GBP', label: 'GBP — Pound Sterling', hint: '£' },
  { value: 'AUD', label: 'AUD — Australian Dollar', hint: 'A$' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar', hint: 'NZ$' },
  { value: 'CAD', label: 'CAD — Canadian Dollar', hint: 'C$' },
]

const LOCALES = [
  { value: 'en-US', label: 'English (United States)', hint: 'Sep 11, 2026 · 2:30 PM' },
  { value: 'en-GB', label: 'English (United Kingdom)', hint: '11 Sep 2026 · 14:30' },
  { value: 'en-AU', label: 'English (Australia)', hint: '11 Sep 2026 · 2:30 pm' },
  { value: 'en-NZ', label: 'English (New Zealand)', hint: '11/09/2026 · 2:30 pm' },
  { value: 'de-DE', label: 'Deutsch (Deutschland)', hint: '11.09.2026 · 14:30' },
  { value: 'el-GR', label: 'Ελληνικά (Ελλάδα)', hint: '11/9/2026 · 2:30 μ.μ.' },
]

const COUNTRIES = [
  'United States',
  'Australia',
  'New Zealand',
  'Greece',
  'United Kingdom',
  'Canada',
  'Mexico',
  'Portugal',
]

/* ==========================================================================
   PAGE
   ========================================================================== */

function initialValuesFor(tenant: Tenant): ProfileValues {
  return {
    name: tenant.name,
    legalName: tenant.legalName,
    vertical: tenant.vertical,
    email: tenant.contact.email,
    phone: tenant.contact.phone,
    website: tenant.contact.website,
    addressLine: tenant.contact.addressLine,
    city: tenant.city,
    country: tenant.country,
    timezone: tenant.timezone,
    currency: tenant.currency,
    locale: tenant.locale,
  }
}

export interface GeneralSettingsClientProps {
  tenant: Tenant
  now: Date
}

/**
 * `tenant` and `now` are fetched server-side — this file never imports
 * `@/lib/demo` itself, so the synthetic dataset stays out of the client
 * bundle.
 */
export function GeneralSettingsClient({ tenant: CURRENT_TENANT, now: NOW }: GeneralSettingsClientProps) {
  const INITIAL = React.useMemo(() => initialValuesFor(CURRENT_TENANT), [CURRENT_TENANT])
  const reduceMotion = useReducedMotionSafe()
  const formRef = React.useRef<HTMLFormElement>(null)

  const [values, setValues] = React.useState<ProfileValues>(INITIAL)
  const [baseline, setBaseline] = React.useState<ProfileValues>(INITIAL)
  const [errors, setErrors] = React.useState<Partial<Record<FieldName, string>>>({})
  const [saving, setSaving] = React.useState(false)

  const dirtyFields = React.useMemo(
    () => (Object.keys(values) as FieldName[]).filter((key) => values[key] !== baseline[key]),
    [values, baseline],
  )
  const dirty = dirtyFields.length > 0

  const set = React.useCallback((key: FieldName, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  function handleDiscard() {
    setValues(baseline)
    setErrors({})
    toast('Changes discarded', { description: 'The form is back to your last saved profile.' })
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = profileSchema.safeParse(values)

    if (!parsed.success) {
      const next: Partial<Record<FieldName, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !(key in next)) next[key as FieldName] = issue.message
      }
      setErrors(next)
      const first = Object.keys(next)[0]
      if (first && formRef.current) {
        formRef.current.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      }
      toast.error('Some details need another look', {
        description: `${Object.keys(next).length} field${
          Object.keys(next).length === 1 ? '' : 's'
        } could not be saved.`,
      })
      return
    }

    setSaving(true)
    window.setTimeout(() => {
      setBaseline(values)
      setErrors({})
      setSaving(false)
      toast.success('Business profile saved', {
        description: 'Receipts, confirmations and your storefront are already using it.',
      })
    }, 620)
  }

  return (
    <>
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        {/* ---------------- Identity ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" aria-hidden="true" />
              Business profile
            </CardTitle>
            <CardDescription>
              The name, category and legal entity that appear on your storefront, receipts and
              every guest confirmation.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            <FieldGroup columns={2}>
              <Field
                label="Trading name"
                description="What guests see everywhere."
                required
                error={errors.name}
              >
                <Input
                  name="name"
                  value={values.name}
                  onChange={(e) => set('name', e.target.value)}
                  autoComplete="organization"
                />
              </Field>

              <Field
                label="Legal entity name"
                description="Printed on invoices and tax documents."
                required
                error={errors.legalName}
              >
                <Input
                  name="legalName"
                  value={values.legalName}
                  onChange={(e) => set('legalName', e.target.value)}
                />
              </Field>

              <Field
                label="Primary category"
                description="Drives storefront layout and the fields we ask guests for."
                required
                error={errors.vertical}
              >
                {({ id }) => (
                  <Select
                    value={nicheOf(values.vertical as VerticalKey).key}
                    onValueChange={(v) => set('vertical', v as VerticalKey)}
                  >
                    <SelectTrigger id={id} name="vertical" error={errors.vertical}>
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {NICHES.map((v) => (
                        <SelectItem key={v.key} value={v.key} description={v.tagline}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field
                label="Workspace URL"
                description="Your public storefront address."
                hint="locked"
              >
                <Input
                  name="slug"
                  readOnly
                  value={`ezrapro.com/book/${CURRENT_TENANT.slug}`}
                  className="bg-surface-sunken"
                  suffix="live"
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* ---------------- Contact ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="size-4 text-primary" aria-hidden="true" />
              Contact & location
            </CardTitle>
            <CardDescription>
              Where guests, OTAs and our support team reach you — and where your departures
              physically leave from.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            <FieldGroup columns={2}>
              <Field
                label="Reply-to email"
                description="Guest replies to confirmations land here."
                required
                error={errors.email}
              >
                <Input
                  name="email"
                  type="email"
                  inputMode="email"
                  value={values.email}
                  onChange={(e) => set('email', e.target.value)}
                  autoComplete="email"
                />
              </Field>

              <Field label="Phone" required error={errors.phone}>
                <Input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  value={values.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  autoComplete="tel"
                />
              </Field>

              <Field
                label="Website"
                description="Linked from your storefront and every receipt."
                required
                error={errors.website}
                className="sm:col-span-2"
              >
                <Input
                  name="website"
                  type="url"
                  inputMode="url"
                  leftIcon={<Globe2 className="size-4" />}
                  value={values.website}
                  onChange={(e) => set('website', e.target.value)}
                />
              </Field>

              <Field
                label="Street address"
                required
                error={errors.addressLine}
                className="sm:col-span-2"
              >
                <Input
                  name="addressLine"
                  leftIcon={<MapPin className="size-4" />}
                  value={values.addressLine}
                  onChange={(e) => set('addressLine', e.target.value)}
                  autoComplete="street-address"
                />
              </Field>

              <Field label="City / region" required error={errors.city}>
                <Input
                  name="city"
                  value={values.city}
                  onChange={(e) => set('city', e.target.value)}
                  autoComplete="address-level2"
                />
              </Field>

              <Field label="Country" required error={errors.country}>
                {({ id }) => (
                  <Select value={values.country} onValueChange={(v) => set('country', v)}>
                    <SelectTrigger id={id} name="country" error={errors.country}>
                      <SelectValue placeholder="Select a country" />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        {/* ---------------- Regional ---------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="size-4 text-primary" aria-hidden="true" />
              Regional settings
            </CardTitle>
            <CardDescription>
              Departure times are stored in your operating timezone; prices are charged and paid
              out in your settlement currency.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            <FieldGroup columns={2}>
              <Field
                label="Operating timezone"
                description={`It is ${formatDateLong(NOW)} in your workspace.`}
                required
                error={errors.timezone}
              >
                {({ id }) => (
                  <Select value={values.timezone} onValueChange={(v) => set('timezone', v)}>
                    <SelectTrigger id={id} name="timezone" error={errors.timezone}>
                      <SelectValue placeholder="Select a timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value} description={tz.hint}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field
                label="Settlement currency"
                description="Changing this re-prices every activity."
                required
                error={errors.currency}
              >
                {({ id }) => (
                  <Select
                    value={values.currency}
                    onValueChange={(v) => set('currency', v as CurrencyCode)}
                  >
                    <SelectTrigger id={id} name="currency" error={errors.currency}>
                      <SelectValue placeholder="Select a currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value} description={c.hint}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>

              <Field
                label="Default locale"
                description="Date, time and number formatting for guests."
                required
                error={errors.locale}
                className="sm:col-span-2"
              >
                {({ id }) => (
                  <Select value={values.locale} onValueChange={(v) => set('locale', v)}>
                    <SelectTrigger id={id} name="locale" error={errors.locale}>
                      <SelectValue placeholder="Select a locale" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCALES.map((l) => (
                        <SelectItem key={l.value} value={l.value} description={l.hint}>
                          {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            </FieldGroup>
          </CardContent>

          <CardFooter separated className="justify-between gap-3">
            <p className="text-xs text-subtle">
              Workspace created {formatDateLong(CURRENT_TENANT.createdAt)} ·{' '}
              <span className="capitalize">{CURRENT_TENANT.status}</span>
            </p>
            <Button type="submit" size="sm" loading={saving} leftIcon={<Save />}>
              Save changes
            </Button>
          </CardFooter>
        </Card>

        {/* ---------------- Sticky unsaved bar ---------------- */}
        <AnimatePresence>
          {dirty ? (
            <motion.div
              key="unsaved"
              role="status"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="sticky bottom-4 z-30 mx-auto w-full max-w-2xl"
            >
              <div className="glass-strong flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 shadow-xl">
                <span
                  aria-hidden="true"
                  className="relative grid size-8 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning"
                >
                  <CircleAlert className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">Unsaved changes</p>
                  <p className="truncate text-xs text-muted">
                    {dirtyFields.length} field{dirtyFields.length === 1 ? '' : 's'} edited —
                    nothing is live until you save.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    leftIcon={<RotateCcw />}
                    onClick={handleDiscard}
                  >
                    Discard
                  </Button>
                  <Button type="submit" size="sm" loading={saving} leftIcon={<Save />}>
                    Save
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </form>

      <DangerZone />
    </>
  )
}

/* ==========================================================================
   DANGER ZONE
   ========================================================================== */

type DangerAction = 'pause' | 'delete'

const DANGER_COPY: Record<
  DangerAction,
  {
    title: string
    description: string
    confirmLabel: string
    phrase: string
    toast: string
    toastBody: string
  }
> = {
  pause: {
    title: 'Pause this workspace',
    description:
      'Your storefront stops accepting new bookings immediately. Existing bookings, manifests and payouts continue exactly as scheduled, and you can resume in one click.',
    confirmLabel: 'Pause workspace',
    phrase: 'PAUSE',
    toast: 'Workspace paused',
    toastBody: 'The storefront now shows a "temporarily closed" notice.',
  },
  delete: {
    title: 'Delete this workspace',
    description:
      'This permanently removes every activity, departure, booking, guest record and payout history. Deletion cannot be undone and support cannot recover the data.',
    confirmLabel: 'Delete workspace forever',
    phrase: 'DELETE BLUE HORIZON',
    toast: 'Deletion scheduled',
    toastBody: 'A confirmation link has been emailed to the workspace owner.',
  },
}

function DangerZone() {
  const [action, setAction] = React.useState<DangerAction | null>(null)
  const [confirmText, setConfirmText] = React.useState('')
  const [working, setWorking] = React.useState(false)

  const copy = action ? DANGER_COPY[action] : null
  const matches = copy ? confirmText.trim().toUpperCase() === copy.phrase : false

  function open(next: DangerAction) {
    setConfirmText('')
    setAction(next)
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      setAction(null)
      setConfirmText('')
    }
  }

  function confirm() {
    if (!copy || !matches) return
    setWorking(true)
    window.setTimeout(() => {
      setWorking(false)
      setAction(null)
      setConfirmText('')
      toast.warning(copy.toast, { description: copy.toastBody })
    }, 700)
  }

  return (
    <>
      <Card className="border-[color-mix(in_oklab,var(--danger)_28%,var(--border))]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-danger" aria-hidden="true" />
            Danger zone
          </CardTitle>
          <CardDescription>
            Irreversible and destructive actions. Only the workspace owner can run these.
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="overflow-hidden rounded-xl border border-line">
            <DangerRow
              icon={<PauseCircle className="size-4" />}
              title="Pause bookings"
              body="Take the storefront offline without losing anything. Scheduled departures still run."
              action={
                <Button variant="outline" size="sm" onClick={() => open('pause')}>
                  Pause workspace
                </Button>
              }
            />
            <Separator />
            <DangerRow
              icon={<Trash2 className="size-4" />}
              title="Delete workspace"
              body="Erase this workspace, every booking, every guest record and every payout. There is no recovery path."
              tone="danger"
              action={
                <Button variant="danger" size="sm" onClick={() => open('delete')}>
                  Delete workspace
                </Button>
              }
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={action !== null} onOpenChange={handleOpenChange}>
        <DialogContent size="md">
          {copy ? (
            <>
              <DialogHeader>
                <Badge
                  variant={action === 'delete' ? 'danger' : 'warning'}
                  size="sm"
                  className="w-fit"
                >
                  {action === 'delete' ? 'Permanent' : 'Reversible'}
                </Badge>
                <DialogTitle>{copy.title}</DialogTitle>
                <DialogDescription>{copy.description}</DialogDescription>
              </DialogHeader>

              <DialogBody className="py-3">
                <Field
                  label={
                    <>
                      Type <span className="font-mono text-danger">{copy.phrase}</span> to confirm
                    </>
                  }
                >
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={copy.phrase}
                    autoComplete="off"
                    spellCheck={false}
                    inputClassName="font-mono tracking-wide"
                  />
                </Field>
              </DialogBody>

              <DialogFooter divider>
                <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  variant={action === 'delete' ? 'danger' : 'primary'}
                  disabled={!matches}
                  loading={working}
                  onClick={confirm}
                >
                  {copy.confirmLabel}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function DangerRow({
  icon,
  title,
  body,
  action,
  tone = 'neutral',
}: {
  icon: React.ReactNode
  title: string
  body: string
  action: React.ReactNode
  tone?: 'neutral' | 'danger'
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4">
      <span
        aria-hidden="true"
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg',
          tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-surface-sunken text-subtle',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs leading-relaxed text-muted">{body}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}
