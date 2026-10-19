'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { CircleAlert, Layers, MapPin, Minus, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { DateChip, TimeChip, type AvailabilityDay, type AvailabilitySlot } from '@/components/storefront/booking-widget'
import { TrustSeal } from '@/components/storefront/trust-bar'
import { useBookingLedger } from '@/hooks/use-booking-ledger'
import { withLedger } from '@/lib/booking-ledger'
import { apart, clock, firstCombo, openSlots, type PackagePartView } from '@/lib/packages'
import { cn, formatCurrency, formatDuration, fromDateKey } from '@/lib/utils'
import type { Activity, CurrencyCode } from '@/types'

/* ==========================================================================
   Package widget — one booking across several activities. Guests pick how
   many, a day, then a time for each part. A time is only offered when that
   activity has room for the whole group and it does not clash with the
   other parts (with the package's gap between them). Booking takes seats
   from every part, so the activities sold on their own stay right.
   ========================================================================== */

const keyPlus = (dateKey: string, days: number) => {
  const date = fromDateKey(dateKey)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function PackageWidget({
  activity,
  tenantSlug,
  currency,
  parts: rawParts,
  checkoutPath,
  initialDateKey,
  initialGuests,
  variant = 'rail',
  className,
}: {
  activity: Activity
  tenantSlug: string
  currency: CurrencyCode
  parts: PackagePartView[]
  checkoutPath: string
  initialDateKey?: string
  initialGuests?: number
  variant?: 'rail' | 'sheet'
  className?: string
}) {
  const router = useRouter()
  const config = activity.package
  const gap = config?.gapMinutes ?? 0
  const sameDay = config?.sameDay !== false
  const within = Math.max(1, config?.withinDays ?? 1)

  // Seats booked or given back in this browser count straight away.
  const ledger = useBookingLedger(tenantSlug)
  const parts = React.useMemo(
    () =>
      rawParts.map((part) => ({
        ...part,
        days: part.days.map((day) => {
          const slots = day.slots.map((slot) => withLedger(slot, ledger.delta))
          const open = slots.filter((slot) => !slot.soldOut)
          return { ...day, slots, seatsLeft: open.reduce((sum, slot) => sum + slot.seatsLeft, 0), soldOut: slots.length > 0 && open.length === 0 }
        }),
      })),
    [rawParts, ledger.delta],
  )

  /* ---------- how many ---------- */
  const [qty, setQty] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(activity.priceTiers.map((tier, index) => [tier.id, index === 0 ? Math.max(tier.minQuantity, initialGuests ?? 2) : tier.minQuantity])),
  )
  const party = activity.priceTiers.reduce((sum, tier) => sum + (tier.countsTowardCapacity ? qty[tier.id] ?? 0 : 0), 0)
  const room = activity.maxCapacity > 0 ? activity.maxCapacity : 99

  /* ---------- days: a day works when every part fits on it ---------- */
  const lead = parts[0]
  const startDays: AvailabilityDay[] = React.useMemo(
    () =>
      (lead?.days ?? []).map((day) => {
        const works = sameDay
          ? Boolean(firstCombo(parts, parts.map(() => day.dateKey), Math.max(1, party), gap))
          : openSlots(parts[0], day.dateKey, Math.max(1, party)).length > 0
        const price = activity.priceTiers[0]?.price ?? activity.basePrice
        return { dateKey: day.dateKey, slots: works ? day.slots : [], fromPrice: price, seatsLeft: works ? day.seatsLeft : 0, soldOut: day.slots.length > 0 && !works }
      }),
    [lead, parts, sameDay, party, gap, activity.priceTiers, activity.basePrice],
  )
  const firstOpen = startDays.find((day) => day.slots.length > 0 && !day.soldOut)?.dateKey
  const [dateKey, setDateKey] = React.useState<string | undefined>(() =>
    initialDateKey && startDays.some((day) => day.dateKey === initialDateKey && day.slots.length > 0) ? initialDateKey : firstOpen,
  )
  /** Spread packages: the day each later part runs on. */
  const [partDays, setPartDays] = React.useState<Record<number, string>>({})
  const dayOf = (index: number) => (sameDay || index === 0 || !dateKey ? dateKey ?? '' : partDays[index] ?? dateKey)

  /* ---------- times: one per part ---------- */
  const [picked, setPicked] = React.useState<Record<number, string>>({})
  const slotFor = (index: number): AvailabilitySlot | undefined => {
    const id = picked[index]
    return id ? openSlots(parts[index], dayOf(index), Math.max(1, party)).find((slot) => slot.departureId === id) : undefined
  }
  const chosen = parts.map((_, index) => slotFor(index))

  // A new day or group size: start from the first combination that works.
  React.useEffect(() => {
    if (!dateKey) return
    const combo = firstCombo(parts, parts.map((_, index) => dayOf(index)), Math.max(1, party), gap)
    setPicked((current) => {
      const stillGood = parts.every((_, index) => current[index] && openSlots(parts[index], dayOf(index), Math.max(1, party)).some((slot) => slot.departureId === current[index]))
      if (stillGood) return current
      return combo ? Object.fromEntries(combo.map((slot, index) => [index, slot.departureId])) : {}
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, party, partDays, parts, gap])

  const complete = chosen.every(Boolean)
  const clash = complete && chosen.some((a, i) => chosen.some((b, j) => j > i && a && b && !apart(a, b, gap)))

  /* ---------- price ---------- */
  const total = activity.priceTiers.reduce((sum, tier) => sum + tier.price * (qty[tier.id] ?? 0), 0)
  const apartPrice = parts.reduce((sum, part) => sum + part.basePrice, 0)
  const saving = Math.max(0, apartPrice - (activity.priceTiers[0]?.price ?? activity.basePrice))

  const reserve = () => {
    if (!complete || clash || party < 1) return
    const legs = chosen.map((slot) => slot!.departureId)
    const params = new URLSearchParams({ activity: activity.slug, d: legs[0], legs: legs.join(',') })
    const tiers = activity.priceTiers.filter((tier) => (qty[tier.id] ?? 0) > 0).map((tier) => `${tier.id}:${qty[tier.id]}`)
    if (tiers.length > 0) params.set('t', tiers.join('|'))
    router.push(`${checkoutPath}?${params.toString()}`)
  }

  return (
    <section
      aria-label="Book this package"
      className={cn('flex flex-col gap-5', variant === 'rail' && 'rounded-2xl border border-line bg-surface p-5 shadow-lg', className)}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.12em] text-faint uppercase">Package from</p>
          <p className="font-display text-3xl font-semibold tracking-tight text-foreground tabular">
            {formatCurrency(activity.priceTiers[0]?.price ?? activity.basePrice, currency)}
            <span className="ml-1.5 text-sm font-medium text-subtle">per person</span>
          </p>
        </div>
        {saving > 0 ? (
          <span className="rounded-full bg-success-soft px-2.5 py-1 text-xs font-semibold text-success">
            Save {formatCurrency(saving, currency)}
          </span>
        ) : null}
      </div>

      {/* ---------- what is inside ---------- */}
      <div className="rounded-xl bg-surface-sunken px-3.5 py-3">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
          <Layers className="size-3.5" aria-hidden="true" />
          {parts.length} activities in one booking
        </p>
        <ul className="mt-1.5 flex list-none flex-col gap-0.5 p-0 text-sm text-foreground">
          {parts.map((part) => (
            <li key={part.activityId} className="flex justify-between gap-2">
              <span>{part.label}</span>
              <span className="text-xs text-subtle">{formatDuration(part.durationMinutes)}</span>
            </li>
          ))}
        </ul>
        {saving > 0 ? <p className="mt-1.5 text-xs text-subtle">Booked apart: {formatCurrency(apartPrice, currency)} per person.</p> : null}
      </div>

      {/* ---------- how many ---------- */}
      <div className="flex flex-col divide-y divide-line-subtle rounded-xl border border-line">
        {activity.priceTiers.map((tier) => {
          const value = qty[tier.id] ?? 0
          return (
            <div key={tier.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{tier.label}</span>
                <span className="block text-xs text-subtle">
                  {formatCurrency(tier.price, currency)}
                  {tier.description ? ` · ${tier.description}` : ''}
                </span>
              </span>
              <span className="flex items-center gap-2">
                <IconButton type="button" size="sm" variant="outline" aria-label={`Fewer ${tier.label}`} disabled={value <= tier.minQuantity} onClick={() => setQty({ ...qty, [tier.id]: value - 1 })}>
                  <Minus aria-hidden="true" />
                </IconButton>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">{value}</span>
                <IconButton type="button" size="sm" variant="outline" aria-label={`More ${tier.label}`} disabled={party >= room} onClick={() => setQty({ ...qty, [tier.id]: value + 1 })}>
                  <Plus aria-hidden="true" />
                </IconButton>
              </span>
            </div>
          )
        })}
      </div>

      {/* ---------- day ---------- */}
      <div>
        <p className="text-sm font-semibold text-foreground">{sameDay ? 'Day' : `Start day · parts over ${within} days`}</p>
        <div className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
          {startDays.map((day) => (
            <DateChip key={day.dateKey} day={day} currency={currency} selected={day.dateKey === dateKey} emptyLabel="Not running" onSelect={() => setDateKey(day.dateKey)} />
          ))}
        </div>
        {!firstOpen ? <p className="mt-2 text-sm text-muted">No day in the next three weeks has room for {party} on every part.</p> : null}
      </div>

      {/* ---------- a time for each part ---------- */}
      {dateKey ? (
        <ol className="flex list-none flex-col gap-3 p-0">
          {parts.map((part, index) => {
            const day = dayOf(index)
            const daySlots = part.days.find((entry) => entry.dateKey === day)?.slots ?? []
            const others = chosen.filter((_, other) => other !== index)
            return (
              <li key={part.activityId} className="rounded-xl border border-line p-3.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    <span className="mr-1.5 text-subtle tabular">{index + 1}.</span>
                    {part.label}
                  </p>
                  <span className="text-xs text-subtle">{formatDuration(part.durationMinutes)}</span>
                </div>
                <p className="mt-0.5 flex items-start gap-1 text-xs text-subtle">
                  <MapPin className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  <span className="line-clamp-1">{part.meetingPoint}</span>
                </p>
                {!sameDay && index > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Array.from({ length: within }, (_, offset) => keyPlus(dateKey, offset)).map((key) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={key === day}
                        onClick={() => setPartDays({ ...partDays, [index]: key })}
                        className={cn('rounded-lg border px-2.5 py-1 text-xs font-medium', key === day ? 'border-primary bg-primary text-on-primary' : 'border-line text-muted hover:border-line-strong')}
                      >
                        {new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric' }).format(fromDateKey(key))}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  {daySlots.length === 0 ? <p className="col-span-2 text-sm text-muted">Not running this day.</p> : null}
                  {daySlots.map((slot) => {
                    const short = slot.seatsLeft < party
                    const clashes = others.some((other) => other && !apart(slot, other, gap))
                    const blocked = slot.soldOut || short || clashes
                    return (
                      <div key={slot.departureId} className="flex flex-col gap-1">
                        <TimeChip
                          slot={blocked ? { ...slot, soldOut: true } : slot}
                          noun="places"
                          selected={picked[index] === slot.departureId}
                          onSelect={() => setPicked({ ...picked, [index]: slot.departureId })}
                        />
                        {!slot.soldOut && (short || clashes) ? (
                          <span className="text-xs text-subtle">{short ? `Only ${slot.seatsLeft} left` : 'Clashes with another part'}</span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ol>
      ) : null}

      {complete && !clash ? (
        <div className="rounded-xl bg-surface-sunken px-3.5 py-3 text-sm">
          <p className="text-xs font-semibold tracking-[0.08em] text-faint uppercase">Your day</p>
          <ul className="mt-1.5 flex list-none flex-col gap-1 p-0">
            {chosen.map((slot, index) =>
              slot ? (
                <li key={slot.departureId} className="flex justify-between gap-2">
                  <span className="text-foreground">{parts[index].label}</span>
                  <span className="font-medium tabular text-foreground">
                    {!sameDay ? `${new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(new Date(slot.startsAt))} ` : ''}
                    {clock(slot.startsAt)} – {clock(slot.endsAt)}
                  </span>
                </li>
              ) : null,
            )}
          </ul>
          {gap > 0 ? <p className="mt-1.5 text-xs text-subtle">At least {formatDuration(gap)} between parts.</p> : null}
        </div>
      ) : dateKey && !complete ? (
        <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-2.5 text-sm text-foreground">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          Pick a time for every part.
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 border-t border-line-subtle pt-4">
        <span className="text-sm text-muted">{party} {party === 1 ? 'person' : 'people'}</span>
        <span className="font-display text-2xl font-semibold tabular tracking-tight text-foreground">{formatCurrency(total, currency, { decimals: true })}</span>
      </div>
      <Button size="lg" fullWidth disabled={!complete || clash || party < 1} onClick={reserve} className="h-12 text-[0.9375rem]">
        {complete ? 'Book the package' : 'Pick your times'}
      </Button>
      <TrustSeal freeCancellationHours={activity.cancellationPolicy.freeCancellationHours} />
    </section>
  )
}
