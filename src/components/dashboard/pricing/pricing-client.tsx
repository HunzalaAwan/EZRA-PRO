'use client'

import * as React from 'react'
import { Ban, Check, Gift, Pencil, Plus, RotateCcw, Tag, TrendingUp, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { usePricing } from '@/hooks/use-pricing'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { useBookingLedger } from '@/hooks/use-booking-ledger'
import { useActivityOverrides } from '@/hooks/use-pricing-override'
import { applyActivityOverride, applyPricingOverride } from '@/lib/activity-overrides'
import { rateFor, rentalModes } from '@/lib/activity-kinds'
import { clockTime, defaultSpots, expandSchedules, plusExtraSpots, scheduleContextOf, shiftDayKey, slotExtraOf, slotId, slotNumbersOf, spotsAfterEdit } from '@/lib/activity-schedule'
import { forSlot, sellsExtraSpots, slotExtraSpotsOf } from '@/lib/extra-spots'
import { getActivityBySlug, tenantBySlug } from '@/lib/demo-core'
import { effectLabel, groupPriced, groupTierOf, guestLimitOf, priceBooking, privatePerPerson, type PriceBookingResult } from '@/lib/price-engine'
import {
  DEMAND_RULE_KINDS,
  RULE_KIND_LABEL,
  dayLabel,
  newGiftCode,
  ruleSummary,
  type GiftCard,
  type PricingRule,
  type PromoCode,
  type RuleKind,
} from '@/lib/pricing'
import { cn, formatCurrency, formatDateLong, pluralize } from '@/lib/utils'
import type { Activity, CurrencyCode } from '@/types'

/* ==========================================================================
   PRICING
   Rules that move the price, promo codes and gift cards, in one place. The
   storefront, checkout and the walk-in screen read the same store, so a
   change here shows on the next price a guest sees.
   ========================================================================== */

export interface PricingActivity {
  slug: string
  name: string
  basePrice: number
}

type TabKey = 'rules' | 'promos' | 'gifts'

/** A seeded time slot's spots and how many are taken, for filling-up and quiet-time changes. */
export interface SlotFill {
  departureId: string
  capacity: number
  booked: number
}

export function PricingClient({
  tenantSlug,
  currency,
  activities,
  nowIso,
  peaks = {},
  fills,
}: {
  tenantSlug: string
  currency: CurrencyCode
  activities: PricingActivity[]
  nowIso: string
  /** Peak or off-peak pricing on seeded time slots, by "slug|YYYY-MM-DDTHH:MM". */
  peaks?: Record<string, number>
  /**
   * Seeded time slots' spots and bookings, by "slug|YYYY-MM-DDTHH:MM". With it, the price
   * check applies filling-up and quiet-time changes (a time slot not in it is a new one, none booked).
   */
  fills?: Record<string, SlotFill>
}) {
  const pricing = usePricing(tenantSlug)
  const [tab, setTab] = React.useState<TabKey>('rules')
  const todayKey = nowIso.slice(0, 10)
  const liability = pricing.giftCards.filter((card) => card.status === 'active').reduce((sum, card) => sum + card.balance, 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Section"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: 'rules', label: 'Price rules', count: pricing.rules.filter((rule) => rule.active).length },
            { value: 'promos', label: 'Promo codes', count: pricing.promos.filter((promo) => promo.active).length },
            { value: 'gifts', label: 'Gift cards', count: pricing.giftCards.filter((card) => card.status === 'active').length },
          ]}
        />
        {pricing.hasEdits ? (
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={() => { pricing.reset(); toast('Pricing restored to the defaults') }}>
            Restore defaults
          </Button>
        ) : null}
      </div>

      {tab === 'rules' ? <RulesTab pricing={pricing} tenantSlug={tenantSlug} activities={activities} currency={currency} nowIso={nowIso} peaks={peaks} fills={fills} /> : null}
      {tab === 'promos' ? <PromosTab pricing={pricing} activities={activities} currency={currency} todayKey={todayKey} /> : null}
      {tab === 'gifts' ? <GiftsTab pricing={pricing} currency={currency} todayKey={todayKey} liability={liability} /> : null}
    </div>
  )
}

type Pricing = ReturnType<typeof usePricing>

/* --------------------------------------------------------------------------
   Rules
   -------------------------------------------------------------------------- */

const BLANK_RULE: PricingRule = { id: '', name: '', kind: 'early_bird', percent: -10, activitySlugs: [], daysAhead: 30, active: true }

/** "All activities", "Sunset sail, Reef snorkel", "Sunset sail, Reef snorkel and 3 more". */
function appliesTo(slugs: string[], activities: PricingActivity[]): string {
  if (slugs.length === 0) return 'All activities'
  const names = slugs.map((slug) => activities.find((entry) => entry.slug === slug)?.name ?? slug)
  return names.length <= 3 ? names.join(', ') : `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`
}

const EVERY = '__all'

function RulesTab({ pricing, tenantSlug, activities, currency, nowIso, peaks, fills }: { pricing: Pricing; tenantSlug: string; activities: PricingActivity[]; currency: CurrencyCode; nowIso: string; peaks: Record<string, number>; fills?: Record<string, SlotFill> }) {
  const [editing, setEditing] = React.useState<PricingRule | null>(null)
  /** The rules shown: all of them, or the ones that apply to one activity. */
  const [forSlug, setForSlug] = React.useState(EVERY)
  const shown = forSlug === EVERY ? pricing.rules : pricing.rules.filter((rule) => rule.activitySlugs.length === 0 || rule.activitySlugs.includes(forSlug))

  const save = (rule: PricingRule) => {
    if (!rule.name.trim()) return
    const exists = pricing.rules.some((entry) => entry.id === rule.id)
    pricing.setRules(exists ? pricing.rules.map((entry) => (entry.id === rule.id ? rule : entry)) : [...pricing.rules, { ...rule, id: `rule_${Date.now().toString(36)}` }])
    toast.success(`${rule.name} saved`, { description: 'Prices on the storefront update straight away.' })
    setEditing(null)
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Price rules</CardTitle>
            <CardDescription>Applied one after another to the ticket price. They never take a price below half.</CardDescription>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Select value={forSlug} onValueChange={setForSlug}>
              <SelectTrigger size="sm" aria-label="Show the rules for" className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={EVERY}>All activities</SelectItem>
                {activities.map((entry) => (
                  <SelectItem key={entry.slug} value={entry.slug}>{entry.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" leftIcon={<Plus />} onClick={() => setEditing({ ...BLANK_RULE, activitySlugs: forSlug === EVERY ? [] : [forSlug] })}>Add rule</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {shown.length === 0 ? <p className="px-5 pb-6 text-sm text-subtle">{forSlug === EVERY ? 'No price rules yet' : 'No rules for this activity yet'}</p> : null}
          <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
            {shown.map((rule) => (
              <li key={rule.id} className={cn('flex items-start gap-4 px-5 py-4', !rule.active && 'opacity-60')}>
                <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-xl', rule.percent < 0 ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>
                  <TrendingUp className={cn('size-[1.125rem]', rule.percent < 0 && 'rotate-180')} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    {rule.name}
                    <Badge variant="neutral" size="sm">{RULE_KIND_LABEL[rule.kind]}</Badge>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{ruleSummary(rule)}</p>
                  <p className="mt-0.5 text-xs text-subtle">{appliesTo(rule.activitySlugs, activities)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch checked={rule.active} onCheckedChange={(checked) => pricing.setRules(pricing.rules.map((entry) => (entry.id === rule.id ? { ...entry, active: checked } : entry)))} aria-label={`${rule.name} on`} />
                  <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => setEditing({ ...rule })}>Edit</Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <PriceCheck tenantSlug={tenantSlug} activities={activities} currency={currency} nowIso={nowIso} rules={pricing.rules} peaks={peaks} fills={fills} focusSlug={forSlug === EVERY ? undefined : forSlug} />

      <RuleDialog rule={editing} activities={activities} todayKey={nowIso.slice(0, 10)} onClose={() => setEditing(null)} onSave={save} onDelete={(id) => { pricing.setRules(pricing.rules.filter((entry) => entry.id !== id)); setEditing(null); toast('Rule removed') }} />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Price check — the price engine on one activity, as the storefront prices
   it: its saved prices, then the price rules above.
   -------------------------------------------------------------------------- */

/**
 * The tickets checked: the lead ticket (a rental's first rated item) for the count, a private group's first
 * option for its party (priced per person, the lead ticket for each guest).
 * Per group: the row guests are booked on, as the storefront books them.
 * A rental is priced for its shortest rental, as the storefront starts it.
 * More guests than one booking can have get no price, only the most there
 * can be: a private group's most guests plus its extra spots, or what a
 * shared time slot has left (`capacity` less `booked`, extra spots included).
 */
export function checkPrice(
  activity: Activity,
  count: number,
  ctx: { startsAt: string; nowIso: string; rules: PricingRule[]; multiplier?: number; capacity?: number; booked?: number },
): { result: PriceBookingResult; before: number } | { result?: undefined; most: number; spotsLeft?: boolean } | null {
  // A private group priced per group books one option for the party; per person it books a ticket for each guest.
  const options = (activity.kind ?? 'trip') === 'charter' && !privatePerPerson(activity)
  const kind = activity.kind ?? 'trip'
  // A shared time slot: what it has left, its extra spots included.
  const left = kind !== 'charter' && sellsExtraSpots(kind) && ctx.capacity !== undefined ? Math.max(0, ctx.capacity - Math.max(0, ctx.booked ?? 0)) : Number.POSITIVE_INFINITY
  const most = Math.min(guestLimitOf(activity), left)
  if (kind !== 'rental' && count > most) return { most, ...(Number.isFinite(left) && left <= guestLimitOf(activity) ? { spotsLeft: true } : {}) }
  const mode = (activity.rental?.rates?.length ?? 0) > 0 ? rentalModes(activity)[0] : undefined
  const lengthId = mode === 'length' ? activity.rental?.lengths?.[0]?.id : undefined
  const paid = activity.priceTiers.filter((tier) => tier.price > 0)
  const lead = mode
    ? (activity.priceTiers.find((tier) => (rateFor(activity, tier.id, mode, lengthId) ?? 0) > 0) ?? activity.priceTiers[0])
    : groupPriced(activity)
      ? groupTierOf(activity)
      : (paid.find((tier) => tier.countsTowardCapacity) ?? paid[0] ?? activity.priceTiers[0])
  if (!lead) return null
  const result = priceBooking({
    activity,
    lines: [{ tierId: lead.id, qty: options ? 1 : count }],
    startsAt: ctx.startsAt,
    nowIso: ctx.nowIso,
    businessRules: ctx.rules,
    priceMultiplier: ctx.multiplier,
    capacity: ctx.capacity,
    booked: ctx.booked,
    party: options ? count : undefined,
    rental: mode ? { mode, hours: Math.max(1, Math.floor(activity.rental?.minHours ?? 1)), days: Math.max(1, Math.floor(activity.rental?.minDays ?? 1)), lengthId } : undefined,
  })
  return { result, before: result.ticketLines.reduce((sum, line) => sum + line.baseUnitPrice * line.quantity, 0) }
}

function PriceCheck({ tenantSlug, activities, currency, nowIso, rules, peaks, fills, focusSlug }: { tenantSlug: string; activities: PricingActivity[]; currency: CurrencyCode; nowIso: string; rules: PricingRule[]; peaks: Record<string, number>; fills?: Record<string, SlotFill>; /** The activity the rules list is showing: the check follows it. */ focusSlug?: string }) {
  const overrides = useActivityOverrides()
  const { defaults } = useBookingDefaults(tenantSlug)
  const ledger = useBookingLedger(tenantSlug)
  const tenant = tenantBySlug.get(tenantSlug)
  const todayKey = nowIso.slice(0, 10)
  const [slug, setSlug] = React.useState(activities[0]?.slug ?? '')
  const [dateKey, setDateKey] = React.useState(() => shiftDayKey(todayKey, 35))
  const [picked, setPicked] = React.useState('')
  const [count, setCount] = React.useState(2)
  React.useEffect(() => {
    if (focusSlug) setSlug(focusSlug)
  }, [focusSlug])

  const seeded = tenant ? getActivityBySlug(tenant.id, slug) : undefined
  const override = seeded ? overrides[seeded.id] : undefined
  const validDay = /^\d{4}-\d{2}-\d{2}$/.test(dateKey)

  // That day's time slots from the saved edit (its schedule and spots) and the business's closed days.
  const edited = React.useMemo(() => (seeded ? applyActivityOverride(seeded, override) : undefined), [seeded, override])
  const slots = React.useMemo(() => {
    if (!edited || !validDay) return []
    try {
      return expandSchedules(edited, dateKey, dateKey, scheduleContextOf(defaults))
    } catch {
      return []
    }
  }, [edited, dateKey, validDay, defaults])
  const times = React.useMemo(() => [...new Set(slots.map((slot) => slot.time))].sort(), [slots])
  const time = times.includes(picked) ? picked : (times[0] ?? '')

  // How full the time slot is, for filling-up and quiet-time changes and the extra spots: the seeded spots and
  // bookings, or a new time slot's own spots (as the storefront sells them after the edit, extra spots on top);
  // then the bookings and changes made since.
  const fill = React.useMemo(() => {
    if (!fills || !seeded || !edited || !time) return undefined
    const slot = slots.find((entry) => entry.time === time)
    const seededFill = fills[`${slug}|${dateKey}T${time}`]
    // That time slot's own extra spots (its weekday's or its date's), else the edit's.
    const extraNow = slotExtraOf(edited, slot)
    const capacity =
      seededFill && slot
        ? spotsAfterEdit(seededFill.capacity, slot, defaultSpots(edited) !== defaultSpots(seeded), slotExtraSpotsOf(seeded), extraNow)
        : (seededFill?.capacity ?? plusExtraSpots(slot?.capacity ?? 0, extraNow))
    if (capacity <= 0) return undefined
    const departureId = seededFill?.departureId ?? slotId(seeded.id, dateKey, time, slot?.locationId)
    return { capacity, booked: Math.max(0, (seededFill?.booked ?? 0) + (ledger.delta[departureId] ?? 0)) }
  }, [fills, seeded, edited, slots, slug, dateKey, time, ledger.delta])

  const check = React.useMemo(() => {
    if (!seeded || !validDay) return null
    try {
      // A seeded time slot's peak or off-peak pricing, as the storefront applies it.
      const multiplier = time ? peaks[`${slug}|${dateKey}T${time}`] : undefined
      // With no start time picked, a time-of-day rule has nothing to match.
      const checked = time ? rules : rules.filter((rule) => rule.kind !== 'time_of_day')
      // That day's own extra spots and a private group's size, as the storefront sells them.
      const daySlot = slots.find((entry) => entry.time === time)
      const priced = applyPricingOverride(seeded, override)
      return checkPrice(daySlot ? forSlot(priced, { capacity: fill?.capacity, ...slotNumbersOf(daySlot) }) : priced, count, { startsAt: `${dateKey}T${time || '12:00'}:00`, nowIso, rules: checked, multiplier, capacity: fill?.capacity, booked: fill?.booked })
    } catch {
      return null
    }
  }, [seeded, override, validDay, dateKey, time, count, nowIso, rules, peaks, slug, fill, slots])

  const unit = seeded?.kind === 'rental' ? 'items' : 'guests'
  const money = (value: number) => formatCurrency(value, currency)

  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-col items-start gap-1">
        <CardTitle>Price check</CardTitle>
        <CardDescription>What a guest pays for tickets on that day and time.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Select value={slug} onValueChange={setSlug}>
          <SelectTrigger aria-label="Activity"><SelectValue /></SelectTrigger>
          <SelectContent>
            {activities.map((entry) => (
              <SelectItem key={entry.slug} value={entry.slug}>{entry.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input type="date" min={todayKey} value={dateKey} onChange={(e) => setDateKey(e.target.value)} aria-label="Date" />
          <Select value={time} onValueChange={setPicked} disabled={times.length === 0}>
            <SelectTrigger aria-label="Start time"><SelectValue placeholder={seeded?.kind === 'package' ? 'Any time' : 'No time slots'} /></SelectTrigger>
            <SelectContent>
              {times.map((entry) => (
                <SelectItem key={entry} value={entry}>{clockTime(entry)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input type="number" min={1} max={99} value={count} suffix={pluralize(count, unit === 'items' ? 'item' : 'guest')} onChange={(e) => setCount(Math.min(99, Math.max(1, Math.floor(Number(e.target.value)) || 1)))} aria-label={unit === 'items' ? 'Items' : 'Guests'} />
        {check && !check.result ? (
          <p className="rounded-xl bg-surface-sunken px-4 py-3 text-sm font-medium text-danger">
            {check.spotsLeft
              ? check.most > 0
                ? `Only ${check.most} ${pluralize(check.most, 'spot')} left at this time`
                : 'No spots left at this time'
              : `Up to ${check.most} ${pluralize(check.most, 'guest')} per booking`}
          </p>
        ) : check?.result ? (
          <div className="rounded-xl bg-surface-sunken px-4 py-3 text-sm">
            {check.result.ticketLines.map((line) => (
              <div key={line.id} className="flex justify-between gap-3 text-muted">
                <span className="truncate">{line.label}{line.quantity > 1 ? ` × ${line.quantity}` : ''}</span>
                <span className="tabular-nums">{money(line.baseUnitPrice * line.quantity)}</span>
              </div>
            ))}
            {check.result.appliedChanges.map((change) => {
              const down = change.effect.type !== 'set' && change.effect.value < 0
              const up = change.effect.type !== 'set' && change.effect.value > 0
              return (
                <div key={change.id} className="flex justify-between gap-3 text-muted">
                  <span className="truncate">{change.name}</span>
                  <span className={cn('tabular-nums', down && 'text-success', up && 'text-warning')}>{effectLabel(change.effect, currency)}</span>
                </div>
              )
            })}
            {check.result.adjustments.map((entry) => (
              <div key={entry.id} className="flex justify-between gap-3 text-muted">
                <span>{entry.label}</span>
                <span className="tabular-nums">{entry.amount > 0 ? '+' : '−'}{money(Math.abs(entry.amount))}</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between gap-3 border-t border-line pt-2 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">
                {check.before > check.result.subtotalTickets ? <s className="mr-1.5 font-normal text-subtle">{money(check.before)}</s> : null}
                {money(check.result.subtotalTickets)}
              </span>
            </div>
          </div>
        ) : (
          <p className="rounded-xl bg-surface-sunken px-4 py-3 text-sm text-subtle">Pick an activity and a date</p>
        )}
      </CardContent>
    </Card>
  )
}

type Scope = 'all' | 'chosen'

const scopeOf = (slugs: string[] | undefined): Scope => ((slugs ?? []).length > 0 ? 'chosen' : 'all')

/**
 * Which activities a rule or code is for: all of them, or the ones ticked.
 * The dialog holds the scope, so "Chosen activities" with nothing ticked yet
 * stays chosen (and can't be saved) instead of quietly meaning all.
 */
function ActivityPicker({ scope, onScopeChange, value, onChange, activities }: { scope: Scope; onScopeChange: (scope: Scope) => void; value: string[]; onChange: (value: string[]) => void; activities: PricingActivity[] }) {
  const picked = value.filter((slug) => activities.some((entry) => entry.slug === slug))
  const everyOne = activities.length > 0 && picked.length === activities.length
  return (
    <div className="flex flex-col gap-2">
      <Segmented
        label="Which activities"
        size="sm"
        className="self-start"
        value={scope}
        onValueChange={(next) => {
          onScopeChange(next)
          if (next === 'all') onChange([])
        }}
        options={[
          { value: 'all', label: 'All activities' },
          { value: 'chosen', label: 'Chosen activities' },
        ]}
      />
      {scope === 'chosen' ? (
        <div className="rounded-xl border border-line">
          <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-3 py-2 text-xs">
            <span className={picked.length === 0 ? 'text-danger' : 'text-subtle'}>{picked.length === 0 ? 'Tick at least one' : `${picked.length} of ${activities.length} chosen`}</span>
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => onChange(everyOne ? [] : activities.map((entry) => entry.slug))}>
              {everyOne ? 'Clear' : 'Tick all'}
            </button>
          </div>
          <div className="grid max-h-52 gap-0.5 overflow-y-auto p-1.5 sm:grid-cols-2">
            {activities.map((entry) => (
              <label key={entry.slug} className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-sunken">
                <Checkbox
                  checked={picked.includes(entry.slug)}
                  onCheckedChange={(checked) => onChange(checked === true ? [...picked, entry.slug] : picked.filter((slug) => slug !== entry.slug))}
                />
                <span className="truncate">{entry.name}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** A rule has a name, the activities it is for, and what its kind goes by. */
function ruleReady(rule: PricingRule, scope: Scope): boolean {
  if (!rule.name.trim()) return false
  if (scope === 'chosen' && rule.activitySlugs.length === 0) return false
  switch (rule.kind) {
    case 'season':
      return Boolean(rule.from && rule.to)
    case 'weekday':
      return (rule.weekdays ?? []).length > 0
    case 'time_of_day':
      return Boolean(rule.fromTime && rule.toTime)
    case 'dates':
      return (rule.dates ?? []).length > 0
    default:
      return true
  }
}

/** A "MM-DD" day as the next time it comes round. */
function nextKey(mmdd: string, todayKey: string): string {
  const year = Number(todayKey.slice(0, 4))
  const key = `${year}-${mmdd}`
  return key < todayKey ? `${year + 1}-${mmdd}` : key
}

/** A whole number typed into a field, kept between min and max. */
const whole = (value: string, min: number, max: number) => Math.max(min, Math.min(max, Math.floor(Number(value)) || min))

function RuleDialog({ rule, activities, todayKey, onClose, onSave, onDelete }: { rule: PricingRule | null; activities: PricingActivity[]; todayKey: string; onClose: () => void; onSave: (rule: PricingRule) => void; onDelete: (id: string) => void }) {
  const [draft, setDraft] = React.useState<PricingRule | null>(rule)
  const [scope, setScope] = React.useState<Scope>(scopeOf(rule?.activitySlugs))
  const [pendingDate, setPendingDate] = React.useState('')
  React.useEffect(() => {
    setDraft(rule)
    setScope(scopeOf(rule?.activitySlugs))
    setPendingDate('')
  }, [rule])
  if (!draft) return null
  const set = (patch: Partial<PricingRule>) => setDraft({ ...draft, ...patch })
  // A kind starts with what its sentence needs.
  const switchKind = (kind: RuleKind) => {
    const patch: Partial<PricingRule> = { kind }
    if (kind === 'time_of_day') Object.assign(patch, { fromTime: draft.fromTime ?? '07:00', toTime: draft.toTime ?? '11:00' })
    if (kind === 'filling_up' && draft.kind !== 'filling_up') patch.soldPercent = 80
    if (kind === 'slow_time' && draft.kind !== 'slow_time') Object.assign(patch, { soldPercent: 50, hoursWithin: draft.hoursWithin ?? 24 })
    set(patch)
  }
  const dates = draft.dates ?? []
  const yearly = dates.length > 0 && dates.every((date) => date.length === 5)
  const addDate = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(pendingDate)) return
    const key = yearly ? pendingDate.slice(5) : pendingDate
    if (!dates.includes(key)) set({ dates: [...dates, key].sort() })
    setPendingDate('')
  }
  const toggleYearly = (on: boolean) =>
    set({ dates: [...new Set(dates.map((date) => (on ? date.slice(-5) : date.length === 5 ? nextKey(date, todayKey) : date)))].sort() })
  const note =
    draft.kind === 'group'
      ? 'Group sizes don’t add up: a booking gets the biggest size it reaches.'
      : DEMAND_RULE_KINDS.includes(draft.kind)
        ? 'Early bird, last minute, filling up and quiet times don’t add up: guests get the best one.'
        : null
  const forWhom = scope === 'all' ? 'all activities' : draft.activitySlugs.length === 0 ? 'no activities yet' : appliesTo(draft.activitySlugs, activities)

  return (
    <Dialog open={rule !== null} onOpenChange={(value) => !value && onClose()}>
      <DialogContent size="md">
        <DialogHeader divider>
          <DialogTitle>{draft.id ? `Edit ${draft.name}` : 'Add a price rule'}</DialogTitle>
          <DialogDescription>Negative percentages are discounts; positive ones raise the price.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <Field label="Name" required>
              {(control) => <Input {...control} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Early bird" />}
            </Field>
            <Field label="Change %">
              {(control) => <Input {...control} type="number" min={-50} max={100} value={draft.percent} onChange={(e) => set({ percent: Math.max(-50, Math.min(100, Number(e.target.value) || 0)) })} />}
            </Field>
          </div>
          <Field label="When it applies">
            <Select value={draft.kind} onValueChange={(value) => switchKind(value as RuleKind)}>
              <SelectTrigger aria-label="Rule type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RULE_KIND_LABEL) as RuleKind[]).map((kind) => (
                  <SelectItem key={kind} value={kind}>{RULE_KIND_LABEL[kind]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {draft.kind === 'season' ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="From (MM-DD)">{(control) => <Input {...control} value={draft.from ?? ''} placeholder="12-18" onChange={(e) => set({ from: e.target.value })} />}</Field>
              <Field label="To (MM-DD)">{(control) => <Input {...control} value={draft.to ?? ''} placeholder="01-04" onChange={(e) => set({ to: e.target.value })} />}</Field>
            </div>
          ) : null}
          {draft.kind === 'weekday' ? (
            <div className="flex flex-wrap gap-1.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, day) => {
                const on = (draft.weekdays ?? []).includes(day)
                return (
                  <button key={label} type="button" aria-pressed={on} onClick={() => set({ weekdays: on ? (draft.weekdays ?? []).filter((entry) => entry !== day) : [...(draft.weekdays ?? []), day] })} className={cn('rounded-lg border px-3 py-1.5 text-sm', on ? 'border-primary bg-primary-soft text-primary' : 'border-line')}>
                    {label}
                  </button>
                )
              })}
            </div>
          ) : null}
          {draft.kind === 'time_of_day' ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Start times from">{(control) => <Input {...control} type="time" value={draft.fromTime ?? ''} onChange={(e) => set({ fromTime: e.target.value || undefined })} />}</Field>
              <Field label="To">{(control) => <Input {...control} type="time" value={draft.toTime ?? ''} onChange={(e) => set({ toTime: e.target.value || undefined })} />}</Field>
            </div>
          ) : null}
          {draft.kind === 'dates' ? (
            <Field label="On these dates">
              {(control) => (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      {...control}
                      type="date"
                      className="w-44"
                      value={pendingDate}
                      onChange={(e) => setPendingDate(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          addDate()
                        }
                      }}
                    />
                    <Button variant="secondary" size="sm" leftIcon={<Plus />} disabled={!pendingDate} onClick={addDate}>Add</Button>
                    {dates.length > 0 ? (
                      <label className="ml-auto inline-flex items-center gap-2 text-sm text-muted">
                        <Switch size="sm" checked={yearly} onCheckedChange={toggleYearly} aria-label="Every year" />
                        Every year
                      </label>
                    ) : null}
                  </div>
                  {dates.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {dates.map((date) => (
                        <span key={date} className="inline-flex h-8 items-center gap-1 rounded-full border border-line bg-surface pr-1 pl-2.5 text-[0.8125rem] font-medium tabular-nums">
                          {dayLabel(date)}
                          {date.length === 10 && date.slice(0, 4) !== todayKey.slice(0, 4) ? <span className="text-faint">{date.slice(0, 4)}</span> : null}
                          <button type="button" aria-label={`Remove ${dayLabel(date)}`} onClick={() => set({ dates: dates.filter((entry) => entry !== date) })} className="grid size-5 place-items-center rounded-full text-faint hover:bg-surface-sunken hover:text-danger">
                            <X className="size-3" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </Field>
          ) : null}
          {draft.kind === 'early_bird' ? <Field label="Booked at least this many days ahead">{(control) => <Input {...control} type="number" min={1} value={draft.daysAhead ?? 30} onChange={(e) => set({ daysAhead: Math.max(1, Number(e.target.value) || 1) })} />}</Field> : null}
          {draft.kind === 'last_minute' ? <Field label="Within this many hours of the start">{(control) => <Input {...control} type="number" min={1} value={draft.hoursWithin ?? 24} onChange={(e) => set({ hoursWithin: Math.max(1, Number(e.target.value) || 1) })} />}</Field> : null}
          {draft.kind === 'filling_up' ? (
            <Field label="When at least this much is booked" description="Not used on private activities.">
              {(control) => <Input {...control} type="number" min={1} max={100} suffix="% of spots" value={draft.soldPercent ?? 80} onChange={(e) => set({ soldPercent: whole(e.target.value, 1, 100) })} />}
            </Field>
          ) : null}
          {draft.kind === 'slow_time' ? (
            <div className="flex flex-col gap-1.5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="When under this much is booked">
                  {(control) => <Input {...control} type="number" min={1} max={100} suffix="% of spots" value={draft.soldPercent ?? 50} onChange={(e) => set({ soldPercent: whole(e.target.value, 1, 100) })} />}
                </Field>
                <Field label="Within hours of the start" optional>
                  {(control) => (
                    <Input
                      {...control}
                      type="number"
                      min={1}
                      max={336}
                      suffix="hours"
                      placeholder="Any time"
                      value={draft.hoursWithin && draft.hoursWithin > 0 ? draft.hoursWithin : ''}
                      onChange={(e) => {
                        const hours = Math.floor(Number(e.target.value))
                        set({ hoursWithin: hours > 0 ? Math.min(336, hours) : undefined })
                      }}
                    />
                  )}
                </Field>
              </div>
              <p className="text-xs text-subtle">Not used on private activities.</p>
            </div>
          ) : null}
          {draft.kind === 'group' ? <Field label="Guests at least">{(control) => <Input {...control} type="number" min={2} value={draft.minGuests ?? 8} onChange={(e) => set({ minGuests: Math.max(2, Number(e.target.value) || 2) })} />}</Field> : null}
          {note ? <p className="-mt-2 text-xs text-subtle">{note}</p> : null}
          <Field label="Activities">
            <ActivityPicker scope={scope} onScopeChange={setScope} value={draft.activitySlugs} onChange={(activitySlugs) => set({ activitySlugs })} activities={activities} />
          </Field>
          <p className="rounded-lg bg-surface-sunken px-3 py-2 text-sm text-foreground">
            {ruleSummary(draft)}
            <span className="text-muted"> · {forWhom}</span>
          </p>
        </DialogBody>
        <DialogFooter divider>
          {draft.id ? <Button variant="ghost" size="sm" className="mr-auto text-danger" onClick={() => onDelete(draft.id)}>Remove rule</Button> : null}
          <Button variant="ghost" size="sm" leftIcon={<X />} onClick={onClose}>Cancel</Button>
          <Button size="sm" leftIcon={<Check />} disabled={!ruleReady(draft, scope)} onClick={() => onSave(scope === 'all' ? { ...draft, activitySlugs: [] } : draft)}>Save rule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------------------------------------------------------
   Promo codes
   -------------------------------------------------------------------------- */

const BLANK_PROMO: PromoCode = { code: '', kind: 'percent', value: 10, activitySlugs: [], minSubtotal: 0, maxUses: 100, used: 0, active: true }

function PromosTab({ pricing, activities, currency, todayKey }: { pricing: Pricing; activities: PricingActivity[]; currency: CurrencyCode; todayKey: string }) {
  const [draft, setDraft] = React.useState<PromoCode | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  /** The code being edited, or null for a new one. */
  const [original, setOriginal] = React.useState<string | null>(null)
  /** All activities, or the ones ticked. */
  const [scope, setScope] = React.useState<Scope>('all')
  const open = (promo: PromoCode, code: string | null) => {
    setDraft({ ...promo })
    setOriginal(code)
    setScope(scopeOf(promo.activitySlugs))
    setError(null)
  }

  const save = () => {
    if (!draft) return
    const code = draft.code.trim().toUpperCase().replace(/\s+/g, '')
    if (code.length < 3) return setError('Codes need at least three characters.')
    if (code !== original && pricing.promos.some((promo) => promo.code === code)) return setError('That code already exists.')
    if (scope === 'chosen' && draft.activitySlugs.length === 0) return
    const saved = { ...draft, code, activitySlugs: scope === 'all' ? [] : draft.activitySlugs }
    pricing.setPromos(original ? pricing.promos.map((promo) => (promo.code === original ? saved : promo)) : [saved, ...pricing.promos])
    toast.success(`${code} saved`, { description: 'Guests can use it at checkout now.' })
    setDraft(null)
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Promo codes</CardTitle>
          <CardDescription>Guests enter them at checkout; the walk-in screen takes them too.</CardDescription>
        </div>
        <Button size="sm" leftIcon={<Plus />} onClick={() => open(BLANK_PROMO, null)}>New code</Button>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
          {pricing.promos.map((promo) => {
            const expired = Boolean(promo.endsOn && todayKey > promo.endsOn)
            const share = promo.maxUses > 0 ? promo.used / promo.maxUses : 0
            return (
              <li key={promo.code} className={cn('flex flex-wrap items-center gap-4 px-5 py-4', (!promo.active || expired) && 'opacity-60')}>
                <span className="inline-flex items-center gap-2 font-mono text-sm font-semibold">
                  <Tag className="size-4 text-primary" aria-hidden="true" />
                  {promo.code}
                </span>
                <span className="min-w-0 flex-1 text-sm text-muted">
                  {promo.kind === 'percent' ? `${promo.value}% off` : `${formatCurrency(promo.value, currency)} off`}
                  {promo.activitySlugs.length > 0 ? ` · ${appliesTo(promo.activitySlugs, activities)}` : ' · all activities'}
                  {promo.minSubtotal > 0 ? ` · over ${formatCurrency(promo.minSubtotal, currency)}` : ''}
                  {promo.note ? <span className="block text-xs text-subtle">{promo.note}</span> : null}
                </span>
                <span className="w-36">
                  <span className="block text-xs text-subtle tabular-nums">{promo.used} of {promo.maxUses} used</span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                    <span className={cn('block h-full rounded-full', share >= 0.9 ? 'bg-warning' : 'bg-primary')} style={{ width: `${Math.min(100, share * 100)}%` }} />
                  </span>
                </span>
                {expired ? <Badge variant="neutral" size="sm">Expired</Badge> : null}
                <Switch checked={promo.active} onCheckedChange={(checked) => pricing.setPromos(pricing.promos.map((entry) => (entry.code === promo.code ? { ...entry, active: checked } : entry)))} aria-label={`${promo.code} on`} />
                <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => open(promo, promo.code)}>Edit</Button>
              </li>
            )
          })}
        </ul>
      </CardContent>

      <Dialog open={draft !== null} onOpenChange={(value) => !value && setDraft(null)}>
        <DialogContent size="md">
          {draft ? (
            <>
              <DialogHeader divider>
                <DialogTitle>{draft.code ? `Code ${draft.code}` : 'New promo code'}</DialogTitle>
                <DialogDescription>Share it in a newsletter, with hotel partners or on a flyer.</DialogDescription>
              </DialogHeader>
              <DialogBody className="flex flex-col gap-4 py-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Code" required error={error ?? undefined}>
                    {(control) => <Input {...control} className="font-mono uppercase" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="SPRING15" />}
                  </Field>
                  <Field label="Type">
                    <Select value={draft.kind} onValueChange={(value) => setDraft({ ...draft, kind: value as PromoCode['kind'] })}>
                      <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percent off</SelectItem>
                        <SelectItem value="fixed">Amount off</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={draft.kind === 'percent' ? 'Percent' : 'Amount'}>
                    {(control) => <Input {...control} type="number" min={1} value={draft.kind === 'percent' ? draft.value : draft.value / 100} onChange={(e) => setDraft({ ...draft, value: Math.max(1, draft.kind === 'percent' ? Math.min(100, Number(e.target.value) || 1) : Math.round((Number(e.target.value) || 1) * 100)) })} />}
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Minimum spend">{(control) => <Input {...control} type="number" min={0} value={draft.minSubtotal / 100} onChange={(e) => setDraft({ ...draft, minSubtotal: Math.max(0, Math.round((Number(e.target.value) || 0) * 100)) })} />}</Field>
                  <Field label="Uses allowed">{(control) => <Input {...control} type="number" min={1} value={draft.maxUses} onChange={(e) => setDraft({ ...draft, maxUses: Math.max(1, Number(e.target.value) || 1) })} />}</Field>
                  <Field label="Ends on" optional>{(control) => <Input {...control} type="date" value={draft.endsOn ?? ''} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value || undefined })} />}</Field>
                </div>
                <Field label="Activities">
                  <ActivityPicker scope={scope} onScopeChange={setScope} value={draft.activitySlugs} onChange={(activitySlugs) => setDraft({ ...draft, activitySlugs })} activities={activities} />
                </Field>
                <Field label="Note for the team" optional>{(control) => <Input {...control} value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value || undefined })} placeholder="Concierge partners" />}</Field>
              </DialogBody>
              <DialogFooter divider>
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancel</Button>
                <Button size="sm" leftIcon={<Check />} disabled={scope === 'chosen' && draft.activitySlugs.length === 0} onClick={save}>Save code</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/* --------------------------------------------------------------------------
   Gift cards
   -------------------------------------------------------------------------- */

function GiftsTab({ pricing, currency, todayKey, liability }: { pricing: Pricing; currency: CurrencyCode; todayKey: string; liability: number }) {
  const [issuing, setIssuing] = React.useState(false)
  const [form, setForm] = React.useState({ amount: 10000, recipient: '', recipientEmail: '', message: '' })
  const issued = pricing.giftCards.reduce((sum, card) => sum + card.initial, 0)
  const redeemed = pricing.giftCards.reduce((sum, card) => sum + (card.initial - card.balance), 0)

  const issue = () => {
    if (form.recipient.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(form.recipientEmail)) return
    const expires = new Date(`${todayKey}T12:00:00`)
    expires.setFullYear(expires.getFullYear() + 3)
    const card: GiftCard = {
      code: newGiftCode(),
      initial: form.amount,
      balance: form.amount,
      purchaser: 'Issued by the team',
      recipient: form.recipient.trim(),
      recipientEmail: form.recipientEmail.trim(),
      message: form.message.trim() || undefined,
      issuedAt: todayKey,
      expiresAt: expires.toISOString().slice(0, 10),
      status: 'active',
    }
    pricing.setGiftCards([card, ...pricing.giftCards])
    toast.success(`Gift card ${card.code} issued`, { description: `${formatCurrency(card.initial, currency)} emailed to ${card.recipient}.` })
    setIssuing(false)
    setForm({ amount: 10000, recipient: '', recipientEmail: '', message: '' })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Outstanding balance', value: formatCurrency(liability, currency), hint: 'Owed to guests on active cards' },
          { label: 'Sold and issued', value: formatCurrency(issued, currency), hint: `${pricing.giftCards.length} ${pluralize(pricing.giftCards.length, 'card')}` },
          { label: 'Redeemed', value: formatCurrency(redeemed, currency), hint: 'Spent on bookings' },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface px-4 py-3.5">
            <p className="text-xs font-medium text-muted">{tile.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{tile.value}</p>
            <p className="text-xs text-subtle">{tile.hint}</p>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Gift cards</CardTitle>
            <CardDescription>Sold on the storefront or issued here. Guests spend them at checkout or at the desk.</CardDescription>
          </div>
          <Button size="sm" leftIcon={<Gift />} onClick={() => setIssuing(true)}>Issue a gift card</Button>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
            {pricing.giftCards.map((card) => (
              <li key={card.code} className={cn('flex flex-wrap items-center gap-4 px-5 py-4', card.status !== 'active' && 'opacity-60')}>
                <span className="font-mono text-sm font-semibold">{card.code}</span>
                <span className="min-w-0 flex-1 text-sm text-muted">
                  For {card.recipient} · from {card.purchaser}
                  <span className="block text-xs text-subtle">Issued {formatDateLong(new Date(`${card.issuedAt}T12:00:00`))} · expires {formatDateLong(new Date(`${card.expiresAt}T12:00:00`))}</span>
                </span>
                <span className="text-right text-sm">
                  <span className="block font-semibold tabular-nums">{formatCurrency(card.balance, currency)}</span>
                  <span className="block text-xs text-subtle tabular-nums">of {formatCurrency(card.initial, currency)}</span>
                </span>
                <Badge variant={card.status === 'active' ? 'success' : 'neutral'} size="sm">{card.status === 'active' ? 'Active' : card.status === 'redeemed' ? 'Used up' : 'Void'}</Badge>
                {card.status === 'active' ? (
                  <Button variant="ghost" size="sm" leftIcon={<Ban />} onClick={() => { pricing.setGiftCards(pricing.giftCards.map((entry) => (entry.code === card.code ? { ...entry, status: 'void' } : entry))); toast(`${card.code} voided`) }}>
                    Void
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={issuing} onOpenChange={setIssuing}>
        <DialogContent size="md">
          <DialogHeader divider>
            <DialogTitle>Issue a gift card</DialogTitle>
            <DialogDescription>For a prize, an apology or a partner. The recipient gets it by email.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4 py-4">
            <div className="flex flex-wrap gap-2">
              {[5000, 10000, 20000, 30000].map((amount) => (
                <button key={amount} type="button" aria-pressed={form.amount === amount} onClick={() => setForm((f) => ({ ...f, amount }))} className={cn('rounded-xl border px-4 py-2 text-sm font-semibold', form.amount === amount ? 'border-primary bg-primary-soft text-primary' : 'border-line')}>
                  {formatCurrency(amount, currency)}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Recipient" required>{(control) => <Input {...control} value={form.recipient} onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))} />}</Field>
              <Field label="Their email" required>{(control) => <Input {...control} type="email" value={form.recipientEmail} onChange={(e) => setForm((f) => ({ ...f, recipientEmail: e.target.value }))} />}</Field>
            </div>
            <Field label="Message" optional>{(control) => <Textarea {...control} rows={2} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />}</Field>
          </DialogBody>
          <DialogFooter divider>
            <Button variant="ghost" size="sm" onClick={() => setIssuing(false)}>Cancel</Button>
            <Button size="sm" leftIcon={<Gift />} disabled={form.recipient.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(form.recipientEmail)} onClick={issue}>Issue {formatCurrency(form.amount, currency)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
