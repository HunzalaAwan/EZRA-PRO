'use client'

import * as React from 'react'
import Image from 'next/image'
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  History,
  ListOrdered,
  Minus,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Tag,
  TrendingUp,
  UserRound,
  Users,
  Wallet,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toaster'
import { TicketQr, ticketPayload } from '@/components/ui/ticket-qr'
import { usePricing } from '@/hooks/use-pricing'
import { useWalkIns } from '@/hooks/use-walk-ins'
import { ACTIVITY_KIND_META } from '@/lib/activity-kinds'
import { applyRules, findPromo, giftProblem, promoDiscount, promoProblem } from '@/lib/pricing'
import { clamp, cn, formatCurrency, formatTime, pluralize } from '@/lib/utils'
import { EMPTY_GUEST, WALK_IN_SOURCES, summarize, type WalkInGuest, type WalkInRecord } from '@/lib/walk-ins'
import type { Activity, ActivityKind, CurrencyCode } from '@/types'
import { applyActivityOverride, applyPricingOverride, type ActivityOverride } from '@/lib/activity-overrides'
import { extraSpotPrice, groupPriced, groupTierOf, guestLimitOf, priceBooking, privatePerPerson, unitPrice, unitPriceDetail, usualSpotsLeft, type PriceContext } from '@/lib/price-engine'
import { usualSpotsOf } from '@/lib/extra-spots'
import { placesOf } from '@/lib/places'
import { useActivityOverrides } from '@/hooks/use-pricing-override'
import { useBookingDefaults } from '@/hooks/use-booking-defaults'
import { useBookingLedger } from '@/hooks/use-booking-ledger'
import { withLedger } from '@/lib/booking-ledger'
import { rebuildAvailabilityDays, scheduleContextOf, type RebuildContext } from '@/lib/activity-schedule'
import type { AvailabilityDay } from '@/components/storefront/booking-widget'
import { bookedOn } from '@/components/storefront/checkout-selection'

import { WalkInLog } from './walk-in-log'
import { WalkInRevenue } from './walk-in-revenue'

/* ==========================================================================
   WALK-INS
   The desk's system for guests who turn up without a booking: a till that
   captures who they are, a log of every walk-in with its guest details and
   status, and walk-in revenue reported on its own, with a cash-up.
   ========================================================================== */

export interface WalkInActivity {
  slug: string
  name: string
  kind: ActivityKind
  image: string
  tiers: { id: string; label: string; price: number; min: number; max: number; seat: boolean }[]
  addOns: { id: string; label: string; price: number; per: 'guest' | 'booking' }[]
  /** `booked`: real bookings (the server's and this browser's), for filling-up and quiet-time prices. */
  slots: { id: string; startsAt: string; seatsLeft: number; itemsLeft?: Record<string, number>; capacity?: number; booked?: number; priceMultiplier?: number }[]
  /** The full activity, so the desk prices with the same engine as the storefront and checkout. */
  source?: Activity
  /** Today and tomorrow as seeded, so the desk can lay the saved schedule over them. */
  days?: AvailabilityDay[]
}

/** What the desk can sell from a day strip: open time slots from this hour on. */
function deskSlots(days: AvailabilityDay[], nowIso: string, delta: Record<string, number> = {}): WalkInActivity['slots'] {
  return days.flatMap((day) =>
    day.slots
      .filter((slot) => slot.startsAt >= nowIso.slice(0, 13) && !slot.soldOut)
      .map((slot) => ({ id: slot.departureId, startsAt: slot.startsAt, seatsLeft: slot.seatsLeft, capacity: slot.capacity, booked: bookedOn(slot, delta), priceMultiplier: slot.priceMultiplier, ...(slot.itemsLeft ? { itemsLeft: slot.itemsLeft } : {}) })),
  )
}

/** The seeded days with the saved schedule laid over them, like the storefront's strip. Nothing saved: as they are. */
function scheduledDesk(source: Activity, days: AvailabilityDay[], saved: ActivityOverride | undefined, ctx: RebuildContext): AvailabilityDay[] {
  const closures = !source.runsOnClosures && ((ctx.closures?.length ?? 0) > 0 || Boolean(ctx.holidays?.enabled))
  if (!saved && !source.schedules && !source.scheduleChanges && !closures) return days
  try {
    const keep = new Set(days.map((day) => day.dateKey))
    // Only the days the desk sells: the rebuilt strip can run further ahead.
    return rebuildAvailabilityDays(source, applyActivityOverride(source, saved), days, ctx).filter((day) => keep.has(day.dateKey))
  } catch {
    // A broken saved edit never stops the desk: the seeded times still sell.
    return days
  }
}

/**
 * Today's and tomorrow's time slots as the schedule the owner saved has them
 * (cancelled and closed times gone, added ones in), with the bookings made
 * in this browser counted. Activities with nothing left to sell drop out.
 */
function useDeskActivities(activities: WalkInActivity[], tenantSlug: string, nowIso: string): WalkInActivity[] {
  const overrides = useActivityOverrides()
  const { defaults } = useBookingDefaults(tenantSlug)
  const ledger = useBookingLedger(tenantSlug)
  return React.useMemo(() => {
    const ctx: RebuildContext = { ...scheduleContextOf(defaults), nowIso, maxAdvanceDays: defaults.maxAdvanceDays, delta: ledger.delta }
    return activities
      .map((entry) => {
        if (!entry.source || !entry.days) return entry
        const days = scheduledDesk(entry.source, entry.days, overrides[entry.source.id], ctx).map((day) => ({
          ...day,
          // A time slot off the schedule stays closed, whatever this browser did on it.
          slots: day.slots.map((slot) => (slot.outsideSchedule ? slot : withLedger(slot, ledger.delta))),
        }))
        return { ...entry, slots: deskSlots(days, nowIso, ledger.delta) }
      })
      .filter((entry) => entry.slots.length > 0)
  }, [activities, overrides, defaults, ledger.delta, nowIso])
}

interface DeskProps {
  tenantSlug: string
  tenantName: string
  currency: CurrencyCode
  activities: WalkInActivity[]
  nowIso: string
  /** The last 30 days of walk-ins from the booking history. */
  seed: WalkInRecord[]
  /** Every channel's revenue per day, for the walk-in share. */
  allRevenue: Record<string, number>
  staff: string[]
}

type DeskTab = 'sale' | 'log' | 'revenue'

export function WalkInDesk({ tenantSlug, tenantName, currency, activities: seeded, nowIso, seed, allRevenue, staff }: DeskProps) {
  const activities = useDeskActivities(seeded, tenantSlug, nowIso)
  const walkIns = useWalkIns(tenantSlug, seed)
  const [tab, setTab] = React.useState<DeskTab>('sale')
  const todayKey = nowIso.slice(0, 10)
  const today = React.useMemo(() => walkIns.records.filter((record) => record.soldAt.slice(0, 10) === todayKey), [walkIns.records, todayKey])
  const summary = summarize(today)

  const tiles = [
    { label: 'Walk-in revenue today', value: formatCurrency(summary.revenue, currency), note: `${summary.sales} ${pluralize(summary.sales, 'sale')}`, icon: TrendingUp },
    { label: 'Guests walked in', value: String(summary.guests), note: summary.sales > 0 ? `${(summary.guests / summary.sales).toFixed(1)} per sale` : 'None yet', icon: Users },
    { label: 'Cash in the drawer', value: formatCurrency(summary.cash, currency), note: `${formatCurrency(summary.card, currency)} on card`, icon: Wallet },
    { label: 'Average sale', value: formatCurrency(summary.average, currency), note: summary.refunds > 0 ? `${summary.refunds} refunded` : 'No refunds', icon: Receipt },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 print:hidden xl:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface p-4">
            <p className="flex items-center gap-1.5 text-xs font-medium text-subtle">
              <tile.icon className="size-3.5 text-faint" aria-hidden="true" />
              {tile.label}
            </p>
            <p className="mt-1.5 font-display text-2xl font-semibold tracking-tight tabular-nums">{tile.value}</p>
            <p className="mt-0.5 text-xs text-muted">{tile.note}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={(value) => setTab(value as DeskTab)} variant="underline">
        <TabsList className="no-scrollbar mb-5 w-full overflow-x-auto print:hidden">
          <TabsTrigger value="sale">
            <Banknote className="size-4" aria-hidden="true" />
            New sale
          </TabsTrigger>
          <TabsTrigger value="log">
            <ListOrdered className="size-4" aria-hidden="true" />
            Walk-ins
            <span className="ml-1 rounded-full bg-surface-sunken px-1.5 text-xs font-semibold text-muted tabular-nums">{walkIns.records.length}</span>
          </TabsTrigger>
          <TabsTrigger value="revenue">
            <TrendingUp className="size-4" aria-hidden="true" />
            Revenue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sale">
          <WalkInTill
            tenantSlug={tenantSlug}
            tenantName={tenantName}
            currency={currency}
            activities={activities}
            nowIso={nowIso}
            staff={staff}
            records={walkIns.records}
            onSold={walkIns.add}
            onOpenLog={() => setTab('log')}
          />
        </TabsContent>
        <TabsContent value="log">
          <WalkInLog records={walkIns.records} currency={currency} nowIso={nowIso} tenantName={tenantName} onStatus={walkIns.setStatus} />
        </TabsContent>
        <TabsContent value="revenue">
          <WalkInRevenue
            records={walkIns.records}
            allRevenue={allRevenue}
            currency={currency}
            nowIso={nowIso}
            cashUps={walkIns.cashUps}
            onCashUp={walkIns.saveCashUp}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

/* ==========================================================================
   THE TILL
   ========================================================================== */

const COUNTRIES = ['United States', 'Canada', 'Australia', 'New Zealand', 'United Kingdom', 'Germany', 'France', 'Japan', 'China', 'South Korea', 'Mexico', 'Other']

function WalkInTill({
  tenantSlug,
  tenantName,
  currency,
  activities,
  nowIso,
  staff,
  records,
  onSold,
  onOpenLog,
}: {
  tenantSlug: string
  tenantName: string
  currency: CurrencyCode
  activities: WalkInActivity[]
  nowIso: string
  staff: string[]
  records: WalkInRecord[]
  onSold: (record: WalkInRecord) => void
  onOpenLog: () => void
}) {
  const pricing = usePricing(tenantSlug)
  const [query, setQuery] = React.useState('')
  const [slug, setSlug] = React.useState(activities[0]?.slug ?? '')
  const [slotId, setSlotId] = React.useState('')
  const [qty, setQty] = React.useState<Record<string, number>>({})
  /** Per group: how many guests are coming. */
  const [groupCount, setGroupCount] = React.useState(1)
  /** A private group priced per group: how many are coming. */
  const [party, setParty] = React.useState(2)
  const [extras, setExtras] = React.useState<Record<string, boolean>>({})
  const [guest, setGuest] = React.useState<WalkInGuest>(EMPTY_GUEST)
  const [seller, setSeller] = React.useState(staff[0] ?? 'Desk')
  const [touched, setTouched] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [promoCode, setPromoCode] = React.useState<string | null>(null)
  const [giftCode, setGiftCode] = React.useState<string | null>(null)
  const [codeError, setCodeError] = React.useState<string | null>(null)
  const [method, setMethod] = React.useState<'card' | 'cash'>('card')
  const [tendered, setTendered] = React.useState('')
  const [processing, setProcessing] = React.useState(false)
  const [receipt, setReceipt] = React.useState<WalkInRecord | null>(null)

  const activity = activities.find((entry) => entry.slug === slug)
  const slot = activity?.slots.find((entry) => entry.id === slotId) ?? activity?.slots[0]
  const todayKey = nowIso.slice(0, 10)

  React.useEffect(() => {
    setSlotId('')
    setQty(activity ? seedQty(activity) : {})
    setGroupCount(1)
    setParty(2)
    setExtras({})
  }, [slug]) // eslint-disable-line react-hooks/exhaustive-deps
  // The saved schedule can leave the picked activity with nothing to sell: move to the first that has something.
  React.useEffect(() => {
    if (!activity && activities[0]) setSlug(activities[0].slug)
  }, [activity, activities])

  const set = (patch: Partial<WalkInGuest>) => setGuest((current) => ({ ...current, ...patch }))

  /* ---------- a returning guest, by phone, email or name ---------- */
  const match = React.useMemo(() => {
    const phone = guest.phone.replace(/\D/g, '')
    const email = guest.email.trim().toLowerCase()
    const name = guest.name.trim().toLowerCase()
    if (phone.length < 6 && !email.includes('@') && name.length < 4) return null
    const found = records.filter(
      (record) =>
        (phone.length >= 6 && record.guest.phone.replace(/\D/g, '').endsWith(phone)) ||
        (email.includes('@') && record.guest.email.toLowerCase() === email) ||
        (name.length >= 4 && record.guest.name.toLowerCase().startsWith(name)),
    )
    if (found.length === 0) return null
    return { guest: found[0].guest, visits: found.length, spent: found.reduce((sum, record) => sum + (record.status === 'refunded' ? 0 : record.total), 0) }
  }, [guest.phone, guest.email, guest.name, records])
  const alreadyFilled = match && match.guest.name === guest.name && match.guest.phone === guest.phone

  // The price engine on the activity with its saved price edits: the same prices as the storefront and checkout.
  const overrides = useActivityOverrides()
  const engineActivity = React.useMemo(() => (activity?.source ? applyPricingOverride(activity.source, overrides[activity.source.id]) : undefined), [activity, overrides])
  // Per group: one price for the group and one count of guests, booked on the group's tier, as on the storefront.
  const groupPrice = engineActivity && groupPriced(engineActivity) ? engineActivity.groupPrice : undefined
  const groupTier = groupPrice && engineActivity ? groupTierOf(engineActivity) : undefined
  const groupSeats = groupTier ? placesOf(groupTier) : 0
  // A private group: per group, one of its options and how many are coming; per person, a ticket each. Either way the time is theirs.
  const privateTickets = engineActivity ? privatePerPerson(engineActivity) : false
  const privateOptions = activity?.kind === 'charter' && !privateTickets
  // A private group: its most guests plus its extra spots.
  const privateMost = engineActivity?.kind === 'charter' ? Math.max(1, guestLimitOf(engineActivity)) : Math.max(1, engineActivity?.maxCapacity ?? 1)
  const privateFewest = Math.max(1, engineActivity?.minParticipants ?? 1)
  // The rows the storefront sells: a row the saved edit took out is left off. Priced per person, a private group's rows
  // are tickets, with the names and counts saved in the editor (as on the storefront).
  const tiers = React.useMemo(() => {
    if (!activity) return []
    if (!engineActivity) return activity.tiers
    const sold = activity.tiers.flatMap((tier) => {
      const priced = engineActivity.priceTiers.find((entry) => entry.id === tier.id)
      if (!priced) return []
      return [privateTickets ? { ...tier, label: priced.label, min: priced.minQuantity, max: priced.maxQuantity } : tier]
    })
    return sold.length > 0 ? sold : activity.tiers
  }, [activity, privateTickets, engineActivity])
  const headcount = tiers.reduce((sum, tier) => sum + (qty[tier.id] ?? 0), 0)
  const guests = groupTier ? groupCount : privateOptions ? clamp(party, privateFewest, Math.max(privateFewest, privateMost)) : headcount
  const seatsUsed = groupTier ? groupCount * groupSeats : privateTickets ? (headcount > 0 ? 1 : 0) : tiers.reduce((sum, tier) => sum + (tier.seat ? (qty[tier.id] ?? 0) : 0), 0)
  // How full the time slot is, for filling-up and quiet-time rules.
  const slotBooked = slot ? (slot.booked ?? (slot.capacity !== undefined ? Math.max(0, slot.capacity - slot.seatsLeft) : undefined)) : undefined
  const rules = activity && slot ? applyRules(pricing.rules, { activitySlug: activity.slug, startsAt: slot.startsAt, nowIso, guests: Math.max(1, guests), capacity: slot.capacity, booked: slotBooked }) : { multiplier: 1, applied: [] }
  const priceCtx: PriceContext | undefined = slot
    ? { startsAt: slot.startsAt, nowIso, capacity: slot.capacity, booked: slotBooked, priceMultiplier: slot.priceMultiplier, businessRules: pricing.rules }
    : undefined
  const ticketLines = groupTier ? [{ tierId: groupTier.id, qty: groupCount }] : tiers.map((tier) => ({ tierId: tier.id, qty: qty[tier.id] ?? 0 }))
  const priced =
    activity && engineActivity && priceCtx ? priceBooking({ ...priceCtx, activity: engineActivity, lines: ticketLines, party: privateOptions ? guests : undefined }) : undefined
  /** Per group: the most guests at this time, by the spots left (extra spots included). */
  const groupMost = groupPrice && groupTier && engineActivity ? Math.max(1, Math.min(groupTier.maxQuantity, guestLimitOf(engineActivity), slot && groupSeats > 0 ? Math.floor(slot.seatsLeft / groupSeats) : Number.POSITIVE_INFINITY)) : 1
  /** A private group: how many it can be. */
  const privateRange = privateFewest > 1 ? `${privateFewest} to ${privateMost}` : `Up to ${privateMost}`
  const chosenOption = privateOptions ? tiers.find((tier) => (qty[tier.id] ?? 0) > 0) : undefined
  /** Each extra spot at this time (0: none sold), and the usual spots (a private group's most guests). */
  const extraEach = engineActivity && priceCtx ? extraSpotPrice(engineActivity, { ...priceCtx, guests: priced?.guests }, chosenOption?.id) : 0
  const usualSpots = engineActivity ? usualSpotsOf(engineActivity) : 0
  /** Per group: the group price at this time, and what it covers in words. */
  const groupDetail = groupPrice && engineActivity && priceCtx ? unitPriceDetail(engineActivity, 'group', { ...priceCtx, guests: priced?.guests }) : undefined
  const groupCovered = extraEach > 0 ? `for the group · extra spots ${formatCurrency(extraEach, currency)} each` : 'for the group'
  /** A shared time slot whose usual spots are full: only extra spots are left. */
  const extraOnly = (entry: WalkInActivity['slots'][number]) =>
    extraEach > 0 && activity?.kind !== 'charter' && Boolean(engineActivity) && usualSpotsLeft(engineActivity!, { capacity: entry.capacity, booked: entry.booked }) <= 0
  /** A ticket's price at this time: the engine's, or the plain price with the business rules. */
  const tierUnit = (tier: WalkInActivity['tiers'][number]) =>
    engineActivity && priceCtx ? unitPrice(engineActivity, tier.id, { ...priceCtx, guests: priced?.guests }) : Math.round(tier.price * rules.multiplier)
  /** What moved the prices, in a few words each. */
  const appliedLabels = priced
    ? priced.appliedChanges.filter((change) => change.source !== 'dynamic').map((change) => ({ id: change.id, label: change.label }))
    : rules.applied.map((rule) => ({ id: rule.id, label: `${rule.name} ${rule.percent > 0 ? '+' : ''}${rule.percent}%` }))

  const lines = activity
    ? [
        ...(priced
          ? [
              ...priced.ticketLines.map((line) => ({ label: `${line.quantity} × ${line.label}`, total: line.total })),
              ...priced.adjustments.map((entry) => ({ label: entry.label, total: entry.amount })),
            ]
          : tiers.filter((tier) => (qty[tier.id] ?? 0) > 0).map((tier) => ({ label: `${qty[tier.id]} × ${tier.label}`, total: Math.round(tier.price * rules.multiplier) * (qty[tier.id] ?? 0) }))),
        ...activity.addOns
          .filter((addOn) => extras[addOn.id])
          .map((addOn) => {
            const units = addOn.per === 'booking' ? 1 : Math.max(1, guests)
            return { label: units > 1 ? `${units} × ${addOn.label}` : addOn.label, total: addOn.price * units }
          }),
      ]
    : []
  const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
  const promo = findPromo(pricing.promos, promoCode)
  const card = pricing.giftCards.find((entry) => entry.code === giftCode)
  const promoOff = promo && activity && !promoProblem(promo, { activitySlug: activity.slug, subtotal, todayKey }) ? promoDiscount(promo, subtotal) : 0
  const giftOff = card && !giftProblem(card, todayKey) ? Math.min(card.balance, subtotal - promoOff) : 0
  const total = Math.max(0, subtotal - promoOff - giftOff)
  const change = method === 'cash' && tendered ? Math.round(Number(tendered) * 100) - total : 0
  // Rentals with items: each item has its own count at this time.
  const itemCap = (tierId: string) => slot?.itemsLeft?.[tierId] ?? Number.POSITIVE_INFINITY
  const overItem = activity && !groupTier ? tiers.find((tier) => (qty[tier.id] ?? 0) > itemCap(tier.id)) : undefined
  /** A private group priced per person: more guests than it can be. */
  const overPrivate = privateTickets && headcount > privateMost
  const overSeats = slot ? seatsUsed > slot.seatsLeft || Boolean(overItem) || overPrivate : false
  const nameMissing = guest.name.trim().length < 2
  const emailBad = guest.email.trim().length > 0 && !/^\S+@\S+\.\S+$/.test(guest.email.trim())
  // A private group priced per person counts tickets like any per-person activity; per group it picks one option.
  const perPerson = activity ? (activity.kind !== 'charter' || privateTickets) && activity.kind !== 'rental' : false
  // Per group there is one count, so no tier has a minimum of its own.
  const shortTier = perPerson && activity && !groupTier ? tiers.find((tier) => (qty[tier.id] ?? 0) < tier.min) : undefined
  /** Something to sell: the group's count, or at least one ticket or option. */
  const picked = groupTier ? groupCount > 0 : headcount > 0
  // A private group per person needs its fewest guests (per group, the count can't go under them).
  const tooFew = privateTickets && headcount < privateFewest
  const canPay = Boolean(activity && slot && guests > 0 && picked && !tooFew && !overSeats && !shortTier && !nameMissing && !emailBad && (method === 'card' || total === 0 || change >= 0))

  const applyCode = () => {
    const value = code.trim().toUpperCase()
    if (!value || !activity) return
    const gift = pricing.giftCards.find((entry) => entry.code === value)
    if (gift) {
      const problem = giftProblem(gift, todayKey)
      if (problem) return setCodeError(problem)
      setGiftCode(gift.code)
    } else {
      const problem = promoProblem(findPromo(pricing.promos, value), { activitySlug: activity.slug, subtotal, todayKey })
      if (problem) return setCodeError(problem)
      setPromoCode(value)
    }
    setCode('')
    setCodeError(null)
  }

  const complete = () => {
    setTouched(true)
    if (!activity || !slot || !canPay) return
    setProcessing(true)
    window.setTimeout(
      () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        const reference = `EZR-${Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')}`
        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        // On the demo clock, so a new sale sits at the top of today in the log.
        const soldAt = `${nowIso.slice(0, 16)}:${pad(now.getSeconds())}`
        const record: WalkInRecord = {
          reference,
          activitySlug: activity.slug,
          activityName: activity.name,
          kind: activity.kind,
          startsAt: slot.startsAt,
          soldAt,
          guests,
          lines: [...lines, ...(promoOff > 0 ? [{ label: `Code ${promo?.code}`, total: -promoOff }] : []), ...(giftOff > 0 ? [{ label: 'Gift card', total: -giftOff }] : [])],
          subtotal,
          discount: promoOff + giftOff,
          total,
          method,
          guest: { ...guest, name: guest.name.trim(), phone: guest.phone.trim(), email: guest.email.trim() },
          status: 'paid',
          staff: seller,
        }
        onSold(record)
        pricing.recordRedemption(promoOff > 0 ? promo?.code : undefined, giftOff > 0 && card ? { code: card.code, amount: giftOff } : undefined)
        setReceipt(record)
        setProcessing(false)
        toast.success(`Sold · ${formatCurrency(total, currency)}`, {
          description: `${record.guest.name}, ${guests} ${pluralize(guests, 'guest')} on ${activity.name} ${formatTime(slot.startsAt)}${method === 'cash' && change > 0 ? ` · change ${formatCurrency(change, currency)}` : ''}`,
        })
      },
      method === 'card' ? 1500 : 400,
    )
  }

  const reset = () => {
    setReceipt(null)
    setGuest(EMPTY_GUEST)
    setTouched(false)
    setPromoCode(null)
    setGiftCode(null)
    setTendered('')
    setQty(activity ? seedQty(activity) : {})
    setGroupCount(1)
    setParty(2)
    setExtras({})
  }

  if (activities.length === 0) {
    return <EmptyState icon={Banknote} title="Nothing left to sell today" description="Every time slot today and tomorrow is full or has passed." />
  }

  if (receipt) {
    return <WalkInTicket record={receipt} tenantName={tenantName} currency={currency} onNew={reset} onOpenLog={onOpenLog} />
  }

  const needle = query.trim().toLowerCase()
  const listed = activities.filter((entry) => !needle || entry.name.toLowerCase().includes(needle))

  return (
    <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)_22rem]">
      {/* activities */}
      <div className="flex flex-col gap-3">
        <SearchInput value={query} onValueChange={setQuery} label="Find an activity" placeholder="Find an activity" shortcut={false} />
        <ul className="flex max-h-[40rem] list-none flex-col gap-1.5 overflow-y-auto p-0">
          {listed.map((entry) => (
            <li key={entry.slug}>
              <button
                type="button"
                onClick={() => setSlug(entry.slug)}
                className={cn('flex w-full items-center gap-3 rounded-xl border p-2 text-left', entry.slug === slug ? 'border-primary bg-primary-soft/25' : 'border-line bg-surface hover:border-line-strong')}
              >
                <span className="relative size-11 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
                  {entry.image ? <Image src={entry.image} alt="" fill sizes="44px" className="object-cover" /> : null}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{entry.name}</span>
                  <span className="block text-xs text-subtle">{ACTIVITY_KIND_META[entry.kind].short} · next {formatTime(entry.slots[0].startsAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* time, guests, extras, guest details */}
      {activity ? (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-5">
            <div>
              <p className="text-sm font-semibold">Time</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {activity.slots.slice(0, 14).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSlotId(entry.id)}
                    className={cn('rounded-xl border px-3 py-2 text-left', slot?.id === entry.id ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong')}
                  >
                    <span className="block text-sm font-semibold tabular-nums">{formatTime(entry.startsAt)}</span>
                    <span className="block text-xs text-subtle">
                      {entry.startsAt.slice(0, 10) === todayKey ? 'Today' : 'Tomorrow'} · {entry.seatsLeft} left
                      {extraOnly(entry) ? ` · extra spots ${formatCurrency(extraEach, currency)} each` : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold">{activity.kind === 'rental' ? 'Units' : privateOptions ? 'Option' : 'Guests'}</p>
              {groupPrice && groupTier && engineActivity ? (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      <span className="tabular-nums">{formatCurrency(groupDetail?.price ?? groupPrice.price, currency)}</span> {groupCovered}
                    </span>
                    {groupPrice.note?.trim() ? <span className="block text-xs text-subtle">{groupPrice.note.trim()}</span> : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <IconButton aria-label="Fewer guests" size="sm" variant="outline" disabled={groupCount <= 1} onClick={() => setGroupCount((count) => Math.max(1, count - 1))}><Minus aria-hidden="true" /></IconButton>
                    <span className="w-6 text-center text-base font-semibold tabular-nums">{groupCount}</span>
                    <IconButton aria-label="More guests" size="sm" variant="outline" disabled={groupCount >= groupMost} onClick={() => setGroupCount((count) => Math.min(groupMost, count + 1))}><Plus aria-hidden="true" /></IconButton>
                  </span>
                </div>
              ) : (
              <ul className="mt-2 flex list-none flex-col divide-y divide-line-subtle rounded-xl border border-line p-0">
                {tiers.map((tier) => {
                  const value = qty[tier.id] ?? 0
                  // A private group's option: its note, as the owner wrote it.
                  const note = privateOptions ? engineActivity?.priceTiers.find((entry) => entry.id === tier.id)?.description?.trim() : undefined
                  // A private group per person: up to its most guests, whatever the spots say (the time is theirs).
                  const full = privateTickets ? headcount >= privateMost : tier.seat && slot ? seatsUsed >= slot.seatsLeft : false
                  return (
                    <li key={tier.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{tier.label}</span>
                        <span className="block text-xs text-subtle tabular-nums">
                          {formatCurrency(tierUnit(tier), currency)}
                          {slot?.itemsLeft ? ` · ${slot.itemsLeft[tier.id] ?? 0} left` : ''}
                          {note ? ` · ${note}` : ''}
                        </span>
                      </span>
                      <span className="flex items-center gap-2">
                        <IconButton aria-label={`Fewer ${tier.label}`} size="sm" variant="outline" disabled={value <= (perPerson ? tier.min : 0)} onClick={() => setQty((q) => ({ ...q, [tier.id]: value - 1 }))}><Minus aria-hidden="true" /></IconButton>
                        <span className="w-6 text-center text-base font-semibold tabular-nums">{value}</span>
                        <IconButton aria-label={`More ${tier.label}`} size="sm" variant="outline" disabled={value >= tier.max || value >= itemCap(tier.id) || full} onClick={() => setQty((q) => ({ ...q, [tier.id]: value + 1 }))}><Plus aria-hidden="true" /></IconButton>
                      </span>
                    </li>
                  )
                })}
              </ul>
              )}
              {privateOptions ? (
                <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">Guests in the group</span>
                    <span className="block text-xs text-subtle">
                      {privateRange};{' '}
                      {extraEach > 0 ? `the price is for ${usualSpots}, then ${formatCurrency(extraEach, currency)} each` : 'the price is for the whole group'}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <IconButton aria-label="Fewer guests" size="sm" variant="outline" disabled={guests <= privateFewest} onClick={() => setParty(Math.max(privateFewest, guests - 1))}><Minus aria-hidden="true" /></IconButton>
                    <span className="w-6 text-center text-base font-semibold tabular-nums">{guests}</span>
                    <IconButton aria-label="More guests" size="sm" variant="outline" disabled={guests >= privateMost} onClick={() => setParty(Math.min(privateMost, guests + 1))}><Plus aria-hidden="true" /></IconButton>
                  </span>
                </div>
              ) : privateTickets ? (
                <p className="mt-1.5 text-xs text-subtle">
                  {privateRange} guests.{extraEach > 0 ? ` Over ${usualSpots}, ${formatCurrency(extraEach, currency)} each.` : ''} The time is just for this group.
                </p>
              ) : null}
              {overSeats ? (
                <p className="mt-1.5 text-xs font-medium text-danger">
                  {overItem ? `Only ${itemCap(overItem.id)} ${overItem.label} left at this time.` : overPrivate ? `Up to ${privateMost} guests.` : `Only ${slot?.seatsLeft} left at this time.`}
                </p>
              ) : null}
            </div>

            {activity.addOns.length > 0 ? (
              <div>
                <p className="text-sm font-semibold">Extras</p>
                <div className="mt-2 flex flex-col gap-2">
                  {activity.addOns.map((addOn) => (
                    <label key={addOn.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm">
                      <span className="flex items-center gap-3">
                        <Checkbox checked={Boolean(extras[addOn.id])} onCheckedChange={(checked) => setExtras((e) => ({ ...e, [addOn.id]: checked === true }))} />
                        {addOn.label}
                      </span>
                      <span className="text-subtle tabular-nums">{formatCurrency(addOn.price, currency)} {addOn.per === 'booking' ? 'per booking' : 'per guest'}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* guest */}
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <UserRound className="size-4 text-faint" aria-hidden="true" />
                Guest details
              </p>
              <p className="text-xs text-subtle">Goes on the ticket and the guest list.</p>
            </div>

            {match && !alreadyFilled ? (
              <button
                type="button"
                onClick={() => setGuest({ ...match.guest })}
                className="flex items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary-soft/40 px-3.5 py-2.5 text-left transition-colors hover:border-primary/60"
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <History className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">Returning guest: {match.guest.name}</span>
                    <span className="block text-xs text-muted">
                      {match.visits} {pluralize(match.visits, 'visit')} · {formatCurrency(match.spent, currency)} spent{match.guest.phone ? ` · ${match.guest.phone}` : ''}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-primary">Use details</span>
              </button>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required error={touched && nameMissing ? 'Add the lead guest name' : undefined}>
                {(control) => <Input {...control} value={guest.name} placeholder="Lead guest" autoComplete="off" onChange={(e) => set({ name: e.target.value })} />}
              </Field>
              <Field label="Mobile" optional>
                {(control) => <Input {...control} type="tel" value={guest.phone} placeholder="+1 808 555 0134" autoComplete="off" onChange={(e) => set({ phone: e.target.value })} />}
              </Field>
              <Field label="Email" optional error={emailBad ? 'That email does not look right' : undefined} description="The receipt and ticket go here.">
                {(control) => <Input {...control} type="email" value={guest.email} placeholder="guest@example.com" autoComplete="off" onChange={(e) => set({ email: e.target.value })} />}
              </Field>
              <Field label="Country" optional>
                <Select value={guest.country || undefined} onValueChange={(country) => set({ country })}>
                  <SelectTrigger aria-label="Country">
                    <SelectValue placeholder="Where they are from" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div>
              <p className="text-xs font-medium text-muted">How did they hear about us?</p>
              <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup" aria-label="How did they hear about us">
                {WALK_IN_SOURCES.map((source) => {
                  const on = guest.source === source
                  return (
                    <button
                      key={source}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => set({ source: on ? '' : source })}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                        on ? 'border-primary/50 bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:text-foreground',
                      )}
                    >
                      {source}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 text-sm">
                <Checkbox checked={guest.marketing} onCheckedChange={(checked) => set({ marketing: checked === true })} />
                Happy to hear about offers
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-subtle">Sold by</span>
                <Select value={seller} onValueChange={setSeller}>
                  <SelectTrigger size="sm" className="w-36" aria-label="Sold by">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(staff.length > 0 ? staff : ['Desk']).map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* total and payment */}
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm font-semibold">Total</p>
          <ul className="mt-2 flex list-none flex-col gap-1 p-0 text-sm">
            {lines.map((line) => (
              <li key={line.label} className="flex justify-between gap-2"><span className="truncate text-muted">{line.label}</span><span className="tabular-nums">{formatCurrency(line.total, currency)}</span></li>
            ))}
            {appliedLabels.map((entry) => (
              <li key={entry.id} className="text-xs text-subtle">{entry.label} in the prices</li>
            ))}
            {promoOff > 0 ? (
              <li className="flex justify-between text-success"><span className="inline-flex items-center gap-1">{promo?.code}<button type="button" aria-label="Remove code" onClick={() => setPromoCode(null)}><X className="size-3.5" /></button></span><span className="tabular-nums">−{formatCurrency(promoOff, currency)}</span></li>
            ) : null}
            {giftOff > 0 ? (
              <li className="flex justify-between text-primary"><span className="inline-flex items-center gap-1">Gift card<button type="button" aria-label="Remove gift card" onClick={() => setGiftCode(null)}><X className="size-3.5" /></button></span><span className="tabular-nums">−{formatCurrency(giftOff, currency)}</span></li>
            ) : null}
          </ul>
          <p className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-sm text-muted">To pay</span>
            <span className="font-display text-3xl font-semibold tabular-nums">{formatCurrency(total, currency)}</span>
          </p>
          <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); applyCode() }}>
            <Input value={code} onChange={(e) => { setCode(e.target.value); setCodeError(null) }} placeholder="Promo or gift card" aria-label="Promo or gift card" className="font-mono uppercase" leftIcon={<Tag />} />
            <Button type="submit" variant="secondary" disabled={!code.trim()}>Apply</Button>
          </form>
          {codeError ? <p className="mt-1 text-xs font-medium text-danger">{codeError}</p> : null}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment">
            {([['card', 'Card', CreditCard], ['cash', 'Cash', Banknote]] as const).map(([value, label, Icon]) => (
              <button key={value} type="button" role="radio" aria-checked={method === value} onClick={() => setMethod(value)} className={cn('flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold', method === value ? 'border-primary bg-primary-soft text-primary' : 'border-line')}>
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          {method === 'cash' ? (
            <div className="mt-3 flex flex-col gap-2">
              <Input type="number" min={0} value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder="Cash handed over" aria-label="Cash handed over" />
              <div className="flex flex-wrap gap-1.5">
                {[20, 50, 100, 200].map((note) => (
                  <button key={note} type="button" onClick={() => setTendered(String(note))} className="rounded-md border border-line px-2 py-1 text-xs tabular-nums hover:border-primary/50">{formatCurrency(note * 100, currency)}</button>
                ))}
              </div>
              {tendered ? (
                <p className={cn('text-sm font-semibold tabular-nums', change < 0 ? 'text-danger' : 'text-success')}>
                  {change < 0 ? `${formatCurrency(-change, currency)} short` : `Change ${formatCurrency(change, currency)}`}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-xs text-subtle">{processing ? 'Waiting for the card on the reader…' : 'Tap, insert or swipe on the reader when you charge.'}</p>
          )}
          <Button size="lg" fullWidth className="mt-4" loading={processing} disabled={processing} onClick={complete}>
            {method === 'card' ? `Charge ${formatCurrency(total, currency)}` : `Take ${formatCurrency(total, currency)} cash`}
          </Button>
          {touched && !canPay ? (
            <p className="mt-2 text-xs font-medium text-danger">
              {shortTier ? `Every booking needs at least ${shortTier.min} ${shortTier.label}.` : nameMissing ? 'Add the lead guest name first.' : emailBad ? 'Fix the email, or leave it empty.' : overSeats ? 'Too many for the spots left.' : method === 'cash' && change < 0 ? 'Not enough cash handed over.' : 'Pick a time and at least one guest.'}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   TICKET — shown after a sale, and reprinted from the log
   ========================================================================== */

export function WalkInTicket({
  record,
  tenantName,
  currency,
  onNew,
  onOpenLog,
}: {
  record: WalkInRecord
  tenantName: string
  currency: CurrencyCode
  onNew?: () => void
  onOpenLog?: () => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4">
      <div className="rounded-2xl border border-line bg-surface p-6 text-center print:border-0">
        {onNew ? <CheckCircle2 className="mx-auto size-8 text-success print:hidden" aria-hidden="true" /> : null}
        <p className="mt-2 text-sm font-semibold text-muted">{tenantName}</p>
        <h2 className="mt-1 text-xl font-semibold">{record.activityName}</h2>
        <p className="text-sm text-muted">
          {formatTime(record.startsAt)} · {record.guests} {pluralize(record.guests, 'guest')} · {record.guest.name}
        </p>
        <div className="mt-4 flex justify-center">
          <TicketQr value={ticketPayload(record.reference)} size={148} className="border border-line" />
        </div>
        <p className="mt-2 font-mono text-lg font-semibold tracking-widest">{record.reference}</p>
        <ul className="mt-4 flex list-none flex-col gap-1 border-t border-dashed border-line p-0 pt-3 text-left text-sm">
          {record.lines.map((line) => (
            <li key={line.label} className="flex justify-between"><span className="text-muted">{line.label}</span><span className="tabular-nums">{formatCurrency(line.total, currency)}</span></li>
          ))}
          <li className="mt-1 flex justify-between border-t border-line pt-2 font-semibold"><span>Paid by {record.method}</span><span className="tabular-nums">{formatCurrency(record.total, currency)}</span></li>
        </ul>
        <p className="mt-3 text-xs text-subtle">Sold by {record.staff}{record.guest.email ? ` · receipt sent to ${record.guest.email}` : ''}</p>
      </div>
      <div className="flex gap-2 print:hidden">
        <Button variant="secondary" leftIcon={<Printer />} onClick={() => window.print()} className="flex-1">Print ticket</Button>
        {onNew ? <Button leftIcon={<RotateCcw />} onClick={onNew} className="flex-1">New sale</Button> : null}
      </div>
      {onOpenLog ? (
        <button type="button" onClick={onOpenLog} className="text-sm font-medium text-primary hover:underline print:hidden">
          See it in the walk-in log
        </button>
      ) : null}
    </div>
  )
}

/** Starting quantities at the desk: each tier's minimum, and at least one of the first. */
function seedQty(activity: WalkInActivity): Record<string, number> {
  const perPerson = activity.kind !== 'charter' && activity.kind !== 'rental'
  return Object.fromEntries(activity.tiers.map((tier, index) => [tier.id, Math.max(perPerson ? tier.min : 0, index === 0 ? 1 : 0)]))
}
