'use client'

import * as React from 'react'
import { Anchor, Bus, Car, Clock, GraduationCap, KeyRound, Layers, Lock, Route, Ticket, UsersRound, Zap, type LucideIcon } from 'lucide-react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ACTIVITY_KIND_META, isTimedKind, LESSON_LEVELS, rentalCategoryMeta } from '@/lib/activity-kinds'
import { cn } from '@/lib/utils'
import type { ActivityKind, CharterConfig, DifficultyLevel, LessonConfig, RentalCategory, RentalConfig, RentalDistance, RentalOperator, TransferService } from '@/types'

import { DurationField, type DurationUnit } from './duration-field'
import type { DraftTier } from './pricing-tier-editor'
import { defaultTransferDraft, normalizeTransferDraft, type DraftTransfer } from './transfer-draft'

/* ==========================================================================
   What are you selling? The kind picker, and the one card of settings each
   kind needs: shared or private, how long, the fewest guests, how hard, a
   course's level and days, a pass's validity. How many each time slot takes
   (spots, a group's size, items out, tickets, extra spots) is set with the
   schedule on the Booking step (capacity-box.tsx).
   ========================================================================== */

export const KIND_ICONS: Record<ActivityKind, LucideIcon> = {
  trip: Route,
  activity: Zap,
  charter: Anchor,
  rental: KeyRound,
  lesson: GraduationCap,
  pass: Ticket,
  package: Layers,
  transfer: Car,
}

export interface DraftKindSettings {
  rental: {
    category: RentalCategory
    billing: NonNullable<RentalConfig['billing']>
    units: number
    bufferMinutes: number
    damageDeposit: number
    minutes: Record<string, number>
    minDays: number
    maxDays: number
    pickupTime: string
    returnTime: string
    seatsPerUnit: number
    /** By the hour, by the day, or both. */
    modes: ('hour' | 'day' | 'length')[]
    /** By length: the lengths sold, each at its own price per item. */
    lengths: { id: string; label: string; hours: number }[]
    minHours: number
    maxHours: number
    /** Per tier: price per hour, day, week and month, and per set length, minor units. Week and month 0 = not sold. */
    rates: Record<string, DraftRate>
    /** Per tier: its own stock, how many people one fits, its deposit. */
    items: Record<string, DraftRentalItem>
    /** Charged per hour late, minor units. */
    lateFee: number
    licence: NonNullable<RentalConfig['licence']>
    /** 'none': fuel isn't part of it (kayaks, spaces). */
    fuel: NonNullable<RentalConfig['fuel']> | 'none'
    kmPerDay: number
    /** Guests book this exact one, or one like it. */
    match: NonNullable<RentalConfig['match']>
    /** Who drives or operates it. */
    operator: DraftOperator
    /** Distance or engine hours: not mentioned, unlimited, an allowance a day, or every one charged. */
    distance: DraftDistance
    /** The youngest driver, young and extra drivers, licence years. */
    renters: DraftRenters
    /** Pick-up, delivery and collection, a one-way return. */
    handover: DraftHandover
    /** Damage cover guests can add, per day. */
    protection: { plans: DraftPlan[]; required: boolean }
    /** Minutes after the return time before it is late. */
    graceMinutes: number
    /** Late by more than this many hours: a full extra day. 0 = never. */
    lateDayAfterHours: number
  }
  charter: {
    maxGuests: number
    requestToBook: boolean
    noticeHours: number
    vessel: NonNullable<CharterConfig['vessel']>
    vesselLabel: string
    crewLabel: string
    crewed: boolean
    minutes: Record<string, number>
  }
  lesson: { level: LessonConfig['level']; sessions: number; ratio: number; certification: string; equipmentIncluded: boolean }
  pass: { validDays: number; reentry: boolean }
  activity: { minHeightCm: number; maxWeightKg: number }
  /** Transfers: service, hub, trips, destinations, vehicles, the price table and ride timing (transfer-draft.ts). */
  transfer: DraftTransfer
}

export function defaultKindSettings(): DraftKindSettings {
  return {
    rental: {
      category: 'gear',
      billing: 'length',
      units: 6,
      bufferMinutes: 15,
      damageDeposit: 0,
      minutes: {},
      minDays: 1,
      maxDays: 14,
      pickupTime: '09:00',
      returnTime: '17:00',
      seatsPerUnit: 1,
      modes: ['hour'],
      minHours: 1,
      maxHours: 4,
      rates: {},
      lengths: [],
      items: {},
      lateFee: 0,
      licence: 'none',
      fuel: 'none',
      kmPerDay: 0,
      match: 'exact',
      operator: { mode: 'renter', label: 'Driver', price: 0, per: 'hour' },
      distance: { mode: 'none', unit: 'mi', perDay: 0, extra: 0 },
      renters: { minAge: 0, youngUnder: 0, youngFee: 0, licenceYears: 0, extraDrivers: false, extraDriverFee: 0, maxExtraDrivers: 2 },
      handover: { pickup: true, delivery: false, deliveryFee: 0, deliveryPer: 'each_way', oneWay: false, oneWayFee: 0 },
      protection: { plans: [], required: false },
      graceMinutes: 0,
      lateDayAfterHours: 0,
    },
    charter: { maxGuests: 6, requestToBook: false, noticeHours: 24, vessel: 'boat', vesselLabel: '', crewLabel: '', crewed: true, minutes: {} },
    // Not asked in setup any more: a new lesson or pass claims none of these on the storefront.
    lesson: { level: 'beginner', sessions: 1, ratio: 0, certification: '', equipmentIncluded: false },
    pass: { validDays: 1, reentry: false },
    activity: { minHeightCm: 0, maxWeightKg: 0 },
    transfer: defaultTransferDraft(),
  }
}

export interface DraftRate {
  hour: number
  day: number
  week?: number
  month?: number
  lengths?: Record<string, number>
}

export interface DraftOperator {
  mode: RentalOperator['mode']
  label: string
  /** Optional: minor units per `per`. */
  price: number
  per: NonNullable<RentalOperator['per']>
}

export interface DraftDistance {
  mode: 'none' | 'unlimited' | 'allowance' | 'every'
  unit: RentalDistance['unit']
  perDay: number
  /** Minor units per one over. */
  extra: number
}

export interface DraftRenters {
  /** Youngest driver or renter; 0 = no minimum. Saved as the activity's minimum age. */
  minAge: number
  youngUnder: number
  youngFee: number
  licenceYears: number
  extraDrivers: boolean
  extraDriverFee: number
  maxExtraDrivers: number
}

export interface DraftHandover {
  pickup: boolean
  delivery: boolean
  deliveryFee: number
  deliveryPer: 'trip' | 'each_way'
  oneWay: boolean
  oneWayFee: number
}

export interface DraftPlan {
  id: string
  name: string
  perDay: number
  deductible: number
}

export interface DraftRentalItem {
  stock: number
  holds: number
  /** Minor units. */
  deposit: number
  /** The most one item costs per rental, minor units. 0: no cap. */
  cap: number
  outOfService: number
  serviceNote: string
}

/** One item's numbers, with sensible defaults for a new one. */
export function draftItemOf(rental: DraftKindSettings['rental'], tierId: string): DraftRentalItem {
  return rental.items?.[tierId] ?? { stock: 1, holds: Math.max(1, rental.seatsPerUnit || 1), deposit: rental.damageDeposit || 0, cap: 0, outOfService: 0, serviceNote: '' }
}

/** Drafts saved before a field existed pick up its default. */
export function normalizeKindSettings(settings: Partial<DraftKindSettings> | undefined): DraftKindSettings {
  const base = defaultKindSettings()
  return {
    rental: (() => {
      const saved = settings?.rental
      return {
        ...base.rental,
        ...saved,
        operator: { ...base.rental.operator, ...saved?.operator },
        distance: { ...base.rental.distance, ...saved?.distance },
        renters: { ...base.rental.renters, ...saved?.renters },
        handover: { ...base.rental.handover, ...saved?.handover },
        protection: { ...base.rental.protection, ...saved?.protection, plans: saved?.protection?.plans ?? base.rental.protection.plans },
      }
    })(),
    charter: { ...base.charter, ...settings?.charter },
    lesson: { ...base.lesson, ...settings?.lesson },
    pass: { ...base.pass, ...settings?.pass },
    activity: { ...base.activity, ...settings?.activity },
    transfer: normalizeTransferDraft(settings?.transfer),
  }
}

type DraftRental = DraftKindSettings['rental']

const DEFAULT_LENGTHS = [
  { id: 'len_4', label: 'Up to 4 hours', hours: 4 },
  { id: 'len_8', label: 'Up to 8 hours', hours: 8 },
]

/** The draft distance for a saved one (or an older km-per-day). */
function draftDistanceOf(distance: RentalDistance | undefined, kmPerDay?: number): DraftDistance {
  if (distance) return { mode: distance.unlimited ? 'unlimited' : distance.perDay > 0 ? 'allowance' : 'every', unit: distance.unit, perDay: distance.perDay, extra: distance.extra }
  if (kmPerDay && kmPerDay > 0) return { mode: 'allowance', unit: 'km', perDay: kmPerDay, extra: 0 }
  return { mode: 'none', unit: 'mi', perDay: 0, extra: 0 }
}

/** The terms a saved rental carries, as the draft edits them. */
export function draftTermsOf(rental: RentalConfig, minAge: number): Pick<DraftRental, 'match' | 'fuel' | 'operator' | 'distance' | 'renters' | 'handover' | 'protection' | 'graceMinutes' | 'lateDayAfterHours'> {
  const base = defaultKindSettings().rental
  const renters = rental.renters
  return {
    match: rental.match ?? rentalCategoryMeta(rental.category).match,
    fuel: rental.fuel ?? 'none',
    operator: rental.operator
      ? { mode: rental.operator.mode, label: rental.operator.label || 'Driver', price: rental.operator.price ?? 0, per: rental.operator.per ?? 'hour' }
      : { ...base.operator, label: rentalCategoryMeta(rental.category).operator.label },
    distance: draftDistanceOf(rental.distance, rental.kmPerDay),
    renters: {
      minAge: Math.max(0, minAge || 0),
      youngUnder: renters?.youngUnder ?? 0,
      youngFee: renters?.youngFee ?? 0,
      licenceYears: renters?.licenceYears ?? 0,
      extraDrivers: typeof renters?.extraDriverFee === 'number',
      extraDriverFee: renters?.extraDriverFee ?? 0,
      maxExtraDrivers: renters?.maxExtraDrivers ?? 2,
    },
    handover: {
      pickup: rental.handover?.pickup ?? true,
      delivery: Boolean(rental.handover?.delivery),
      deliveryFee: rental.handover?.delivery?.fee ?? 0,
      deliveryPer: rental.handover?.delivery?.per ?? 'each_way',
      oneWay: Boolean(rental.handover?.oneWay),
      oneWayFee: rental.handover?.oneWay?.fee ?? 0,
    },
    protection: {
      plans: (rental.protection?.plans ?? []).map((plan) => ({ id: plan.id, name: plan.name, perDay: plan.perDay, deductible: plan.deductible })),
      required: Boolean(rental.protection?.required),
    },
    graceMinutes: rental.graceMinutes ?? 0,
    lateDayAfterHours: rental.lateDayAfterHours ?? 0,
  }
}

/** The draft's terms as the rental saves them: only what is set. */
export function rentalTermsOfDraft(r: DraftRental): Partial<RentalConfig> {
  const out: Partial<RentalConfig> = { match: r.match, licence: r.licence, ...(r.fuel !== 'none' ? { fuel: r.fuel } : {}) }
  if (r.operator.mode !== 'renter') {
    out.operator = {
      mode: r.operator.mode,
      label: r.operator.label.trim() || 'Driver',
      ...(r.operator.mode === 'optional' ? { price: Math.max(0, r.operator.price), per: r.operator.per } : {}),
    }
  }
  if (r.distance.mode !== 'none') {
    out.distance = {
      unit: r.distance.unit,
      unlimited: r.distance.mode === 'unlimited',
      perDay: r.distance.mode === 'allowance' ? Math.max(1, r.distance.perDay) : 0,
      extra: r.distance.mode === 'unlimited' ? 0 : Math.max(0, r.distance.extra),
    }
  }
  const selfDriven = r.operator.mode !== 'included'
  const renters: NonNullable<RentalConfig['renters']> = {}
  if (selfDriven && r.renters.youngUnder > 0 && r.renters.youngFee > 0) {
    renters.youngUnder = r.renters.youngUnder
    renters.youngFee = r.renters.youngFee
  }
  if (selfDriven && r.renters.licenceYears > 0) renters.licenceYears = r.renters.licenceYears
  if (selfDriven && r.renters.extraDrivers) {
    renters.extraDriverFee = Math.max(0, r.renters.extraDriverFee)
    renters.maxExtraDrivers = Math.max(1, r.renters.maxExtraDrivers)
  }
  if (Object.keys(renters).length > 0) out.renters = renters
  if (!r.handover.pickup || r.handover.delivery || r.handover.oneWay) {
    out.handover = {
      pickup: r.handover.pickup || !r.handover.delivery,
      ...(r.handover.delivery ? { delivery: { fee: Math.max(0, r.handover.deliveryFee), per: r.handover.deliveryPer } } : {}),
      ...(r.handover.oneWay ? { oneWay: { fee: Math.max(0, r.handover.oneWayFee) } } : {}),
    }
  }
  const plans = r.protection.plans.filter((plan) => plan.name.trim().length > 0)
  if (plans.length > 0) out.protection = { plans: plans.map((plan) => ({ ...plan, name: plan.name.trim() })), required: r.protection.required }
  if (r.graceMinutes > 0) out.graceMinutes = r.graceMinutes
  if (r.lateDayAfterHours > 0) out.lateDayAfterHours = r.lateDayAfterHours
  return out
}

/** A seeded distance or track, carried through an edit. Not edited any more: the track goes in Highlights. */
export interface DraftRoute {
  enabled: boolean
  distance: number
  unit: 'km' | 'mi'
  track: string
  elevationM: number
}

export const emptyRoute = (): DraftRoute => ({ enabled: false, distance: 0, unit: 'km', track: '', elevationM: 0 })

/**
 * The numbers every activity carries, edited from inside a kind's card.
 * Ages, languages and a track are written in Requirements and Highlights.
 * The spots themselves are set on the Booking step; `maxCapacity` is read
 * here only to keep the fewest guests within them.
 */
export interface SharedBasics {
  maxCapacity: number
  minParticipants: number
  durationMinutes: number
  durationUnit: DurationUnit
  difficulty: DifficultyLevel
}

/** The wizard's choices: group activity, activity and private charter are one card; a rental with a driver is under Rental. */
const PICKER_KINDS: ActivityKind[] = ['trip', 'rental', 'lesson', 'pass', 'package']

const TIMED_CARD = {
  label: 'Activity or tour',
  hint: 'Guests book a time slot, with others or as a private group.',
  examples: 'Tours, snorkelling, horse rides, ziplines, fishing trips, private guiding',
}

export function KindPicker({ value, onChange }: { value: ActivityKind; onChange: (kind: ActivityKind) => void }) {
  const picked = isTimedKind(value) ? 'trip' : value === 'transfer' ? 'rental' : value
  return (
    <fieldset>
      <legend className="text-[0.8125rem] font-medium">What are you selling?</legend>
      <p className="mt-0.5 mb-2.5 text-xs text-muted">
        This decides the setup below, how the storefront books it and the tools you get on the day.
      </p>
      <RadioGroup
        value={picked}
        onValueChange={(next) => {
          if (next !== picked) onChange(next as ActivityKind)
        }}
        className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3"
      >
        {PICKER_KINDS.map((kind) => {
          const meta = kind === 'trip' ? TIMED_CARD : ACTIVITY_KIND_META[kind]
          const Icon = KIND_ICONS[kind]
          return (
            <RadioGroupCard
              key={kind}
              value={kind}
              label={meta.label}
              description={
                <>
                  {meta.hint}
                  <span className="mt-1 block text-faint">{meta.examples}</span>
                </>
              }
              icon={<Icon aria-hidden="true" />}
            />
          )
        })}
      </RadioGroup>
    </fieldset>
  )
}

/* ---------- rental: how it is charged, and what is rented ---------- */

/** By time is a rental; by trip and per seat are rides with a driver ('transfer'). */
export type RentalCharge = 'time' | 'trip' | 'seat' | 'hourly'

export const rentalChargeOf = (kind: ActivityKind, service: TransferService | undefined): RentalCharge =>
  kind !== 'transfer' ? 'time' : service === 'shared' ? 'seat' : service === 'hourly' ? 'hourly' : 'trip'

const CHARGE_CHOICES: { value: RentalCharge; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'time', label: 'By time', hint: 'By the hour, day, week or month. Any rental.', icon: Clock },
  { value: 'trip', label: 'By trip', hint: 'You drive them from pickup to drop-off, priced by area.', icon: Car },
  { value: 'seat', label: 'Per seat', hint: 'Shared rides on set times, priced per seat.', icon: Bus },
]

/** The first choice in Rental settings: how guests pay for it. By trip and per seat save as rides ('transfer'). */
export function ChargeChoice({ value, onChange }: { value: RentalCharge; onChange: (value: RentalCharge) => void }) {
  // A driver by the hour from before is still shown while it is picked; new ones are By time with a driver.
  const choices = value === 'hourly' ? [...CHARGE_CHOICES, { value: 'hourly' as const, label: 'Driver by the hour', hint: 'Older setup. By time with a driver does this now.', icon: Clock }] : CHARGE_CHOICES
  return (
    <Section title="How you charge">
      <div role="radiogroup" aria-label="How you charge" className={cn('grid gap-2', choices.length > 3 ? 'sm:grid-cols-2 xl:grid-cols-4' : 'sm:grid-cols-3')}>
        {choices.map((choice) => {
          const on = choice.value === value
          const Icon = choice.icon
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => (on ? undefined : onChange(choice.value))}
              className={cn(
                'flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                on ? 'border-primary bg-primary-soft/30' : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', on ? 'bg-primary-soft text-primary' : 'bg-surface-sunken text-faint')} aria-hidden="true">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{choice.label}</span>
                <span className="block text-xs text-subtle">{choice.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
    </Section>
  )
}

/** By time: the gap between rentals. Items, prices and rental terms are on the Pricing step. */
export function RentalBasicsFields({ settings: raw, onChange }: { settings: DraftKindSettings; onChange: (settings: DraftKindSettings) => void }) {
  const settings = normalizeKindSettings(raw)
  const rental = settings.rental
  const set = (patch: Partial<DraftRental>) => onChange({ ...settings, rental: { ...rental, ...patch } })
  return (
    <>
      <Section title="Between rentals" hint="Items, prices and rental terms are on the Pricing step.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Gap between rentals" optional description="To clean, refuel or get it ready.">
            {(control) => <Input {...control} type="number" min={0} step={5} suffix="min" placeholder="None" value={rental.bufferMinutes || ''} onChange={(e) => set({ bufferMinutes: num(e.target.value) })} />}
          </Field>
        </div>
      </Section>
    </>
  )
}

/* ---------- activity or tour: the same few settings, shared or private ---------- */

const SLOT_CHOICES = [
  { value: false, label: 'Shared', hint: 'Guests book spots and join others', icon: UsersRound },
  { value: true, label: 'Private', hint: 'One group has the time slot to itself', icon: Lock },
] as const

/** Group activity, activity and private charter: how long, who books it, the fewest guests and how hard. The spots are on the Booking step. */
export function TimedFields({
  privateGroup,
  onPrivate,
  shared,
  onShared,
  errors,
}: {
  privateGroup: boolean
  onPrivate: (value: boolean) => void
  shared: SharedBasics
  onShared: (patch: Partial<SharedBasics>) => void
  errors: Record<string, string>
  /** Not read here any more (the extra-spot price is on the Booking step); kept so callers need not change. */
  currencySymbol?: string
}) {
  return (
    <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface-sunken/40 p-4">
      <p className="text-[0.8125rem] font-medium">Activity settings</p>
      <div role="radiogroup" aria-label="Who books each time slot" className="grid gap-2 sm:grid-cols-2">
        {SLOT_CHOICES.map((choice) => {
          const on = choice.value === privateGroup
          return (
            <button
              key={choice.label}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPrivate(choice.value)}
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                on ? 'border-primary bg-primary-soft/30' : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', on ? 'bg-primary-soft text-primary' : 'bg-surface-sunken text-faint')} aria-hidden="true">
                <choice.icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{choice.label}</span>
                <span className="block text-xs text-subtle">{choice.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
      <DurationField
        label="Duration"
        error={errors.durationMinutes}
        minutes={shared.durationMinutes}
        unit={shared.durationUnit}
        onChange={(durationMinutes, durationUnit) => onShared({ durationMinutes, durationUnit })}
        presets={[30, 60, 90, 120, 180, 240, 480, 1440]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <DifficultyField value={shared.difficulty} onChange={(difficulty) => onShared({ difficulty })} />
      </div>
    </div>
  )
}

const num = (value: string, min = 0) => Math.max(min, Math.round(Number(value) || 0))

/* ---------- small pieces ---------- */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line-subtle pt-4 first:border-t-0 first:pt-0">
      <div>
        <h4 className="text-[0.8125rem] font-semibold text-foreground">{title}</h4>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

export const DIFFICULTY_CHOICES: { value: DifficultyLevel; label: string; hint: string }[] = [
  { value: 'easy', label: 'Easy', hint: 'Anyone can do it' },
  { value: 'moderate', label: 'Moderate', hint: 'Some fitness or balance' },
  { value: 'challenging', label: 'Challenging', hint: 'Fit and confident' },
  { value: 'extreme', label: 'Extreme', hint: 'Experience or a briefing needed' },
]

/** Difficulty as one compact select, shared by group activities and activities. */
export function DifficultyField({ value, onChange }: { value: DifficultyLevel; onChange: (value: DifficultyLevel) => void }) {
  return (
    <Field label="Difficulty">
      <Select value={value} onValueChange={(next) => onChange(next as DifficultyLevel)}>
        <SelectTrigger aria-label="Difficulty">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DIFFICULTY_CHOICES.map((option) => (
            <SelectItem key={option.value} value={option.value} description={option.hint}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

/* ==========================================================================
   HOW A RENTAL IS CHARGED — by the hour, by length, by the day, with the
   limits for each. Lives with the prices on the Pricing step; the item
   rates (week and month too) are in RentalRatesEditor, the late fee and
   everything else that comes with a rental in RentalTermsEditor.
   ========================================================================== */

export function RentalChargingFields({
  settings: raw,
  onSettings,
  errors,
}: {
  settings: DraftKindSettings
  onSettings: (settings: DraftKindSettings) => void
  /** Not read here any more (the late fee is in Rental terms); kept so callers need not change. */
  currencySymbol?: string
  errors: Record<string, string>
}) {
  const settings = normalizeKindSettings(raw)
  const rental = settings.rental
  const set = (patch: Partial<DraftKindSettings['rental']>) => onSettings({ ...settings, rental: { ...rental, ...patch } })
  const hourly = rental.modes.includes('hour')
  const daily = rental.modes.includes('day')
  const byLength = rental.modes.includes('length')
  const toggleMode = (mode: 'hour' | 'day' | 'length') => {
    const on = rental.modes.includes(mode)
    // One way of charging has to stay on.
    if (on && rental.modes.length === 1) return
    const modes = on ? rental.modes.filter((entry) => entry !== mode) : (['hour', 'day', 'length'] as const).filter((entry) => entry === mode || rental.modes.includes(entry))
    set({
      modes: [...modes],
      billing: modes.length === 1 && modes[0] === 'day' ? 'day' : 'length',
      // Two common lengths to start from; each can be renamed or removed.
      ...(mode === 'length' && !on && rental.lengths.length === 0
        ? { lengths: DEFAULT_LENGTHS.map((entry) => ({ ...entry })) }
        : {}),
    })
  }
  const setLength = (id: string, patch: Partial<{ label: string; hours: number }>) =>
    set({ lengths: rental.lengths.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)) })

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-semibold">How it is charged</h3>
        <p className="mt-0.5 text-xs text-muted">Pick one or more. Guests choose when they book.</p>
      </div>
      <div role="group" aria-label="How it is charged" className="grid gap-2 sm:grid-cols-3">
        {([
          ['hour', 'By the hour', 'A price per hour'],
          ['length', 'By length', 'One price for a set length'],
          ['day', 'By the day', 'A price per day'],
        ] as const).map(([mode, label, hint]) => {
          const on = rental.modes.includes(mode)
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={on}
              onClick={() => toggleMode(mode)}
              className={cn(
                'flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-200',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                on ? 'border-primary bg-primary-soft/30' : 'border-line bg-surface hover:border-line-strong',
              )}
            >
              <span className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded border', on ? 'border-primary bg-primary text-on-primary' : 'border-line-strong')} aria-hidden="true">
                {on ? <svg viewBox="0 0 12 12" className="size-3"><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
              </span>
              <span>
                <span className="block text-sm font-medium text-foreground">{label}</span>
                <span className="block text-xs text-subtle">{hint}</span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {hourly ? (
          <>
            <Field label="Fewest hours" optional error={errors['rental.minHours']}>
              {(control) => <Input {...control} type="number" min={1} max={12} suffix="hours" placeholder="1" value={rental.minHours > 1 ? rental.minHours : ''} onChange={(e) => set({ minHours: num(e.target.value, 1) })} />}
            </Field>
            <Field label="Most hours" optional error={errors['rental.maxHours']}>
              {(control) => <Input {...control} type="number" min={1} max={24} suffix="hours" placeholder="No limit" value={rental.maxHours || ''} onChange={(e) => set({ maxHours: num(e.target.value) })} />}
            </Field>
          </>
        ) : null}
        {daily ? (
          <>
            <Field label="Fewest days" optional error={errors['rental.minDays']}>
              {(control) => <Input {...control} type="number" min={1} suffix="days" placeholder="1" value={rental.minDays > 1 ? rental.minDays : ''} onChange={(e) => set({ minDays: num(e.target.value, 1) })} />}
            </Field>
            <Field label="Most days" optional error={errors['rental.maxDays']}>
              {(control) => <Input {...control} type="number" min={1} max={60} suffix="days" placeholder="No limit" value={rental.maxDays || ''} onChange={(e) => set({ maxDays: num(e.target.value) })} />}
            </Field>
          </>
        ) : null}
      </div>
      {byLength ? (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <p className="text-[0.8125rem] font-medium">Lengths you sell</p>
          <p className="-mt-1.5 text-xs text-subtle">One price each, used in full or not.</p>
          <ul className="flex list-none flex-col gap-2 p-0">
            {rental.lengths.map((length) => (
              <li key={length.id} className="grid grid-cols-[minmax(0,1fr)_8rem_2rem] items-center gap-2">
                <Input size="sm" aria-label="Length name" value={length.label} placeholder="Up to 4 hours" onChange={(e) => setLength(length.id, { label: e.target.value })} />
                <Input size="sm" aria-label="Hours it can be out" type="number" min={1} max={24} suffix="hours" value={length.hours || ''} onChange={(e) => setLength(length.id, { hours: num(e.target.value, 1) })} />
                <button
                  type="button"
                  aria-label={`Remove ${length.label || 'length'}`}
                  disabled={rental.lengths.length === 1}
                  onClick={() => set({ lengths: rental.lengths.filter((entry) => entry.id !== length.id) })}
                  className="grid size-8 place-items-center rounded-lg text-faint hover:bg-surface-sunken hover:text-danger disabled:opacity-30"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            className="self-start"
            onClick={() => {
              const hours = Math.min(24, (rental.lengths.at(-1)?.hours ?? 0) + 2)
              set({ lengths: [...rental.lengths, { id: `len_${Date.now().toString(36)}`, label: `Up to ${hours} hours`, hours }] })
            }}
          >
            + Add a length
          </Button>
        </div>
      ) : null}
    </section>
  )
}

/* ---------- the card ---------- */

export function KindFields({
  kind,
  settings: raw,
  onChange,
  errors,
  shared,
  onShared,
}: {
  /** Not read here any more; kept so callers need not change. */
  tenantSlug?: string
  kind: ActivityKind
  settings: DraftKindSettings
  onChange: (settings: DraftKindSettings) => void
  /** Not read here any more; kept so callers need not change. */
  tiers?: DraftTier[]
  /** Not read here any more (the extra-spot price is on the Booking step); kept so callers need not change. */
  currencySymbol?: string
  errors: Record<string, string>
  shared: SharedBasics
  onShared: (patch: Partial<SharedBasics>) => void
}) {
  const settings = normalizeKindSettings(raw)
  const set = <K extends keyof DraftKindSettings>(key: K, patch: Partial<DraftKindSettings[K]>) =>
    onChange({ ...settings, [key]: { ...settings[key], ...patch } })

  // A rental's and a ride's card (RentalBasicsFields, TransferFields) sit under How you charge, so the Basics step renders them itself.
  if (isTimedKind(kind) || kind === 'transfer' || kind === 'rental') return null

  const shell = (children: React.ReactNode) => (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-sunken/40 p-4">
      <p className="text-[0.8125rem] font-medium">{ACTIVITY_KIND_META[kind].label} settings</p>
      {children}
    </div>
  )

  /* ---------- lesson ---------- */
  if (kind === 'lesson') {
    const lesson = settings.lesson
    return shell(
      <>
        <Section title="The course">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Level">
              <Select value={lesson.level} onValueChange={(value) => set('lesson', { level: value as LessonConfig['level'] })}>
                <SelectTrigger aria-label="Level">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_LEVELS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Days in the course" required error={errors['lesson.sessions']} description="1 for a single lesson.">
              {(control) => <Input {...control} type="number" min={1} max={14} value={lesson.sessions} onChange={(e) => set('lesson', { sessions: num(e.target.value) })} />}
            </Field>
          </div>
          <DurationField
            label={lesson.sessions > 1 ? 'Duration each day' : 'Duration'}
            error={errors.durationMinutes}
            minutes={shared.durationMinutes}
            unit={shared.durationUnit === 'days' ? 'hours' : shared.durationUnit}
            onChange={(durationMinutes, durationUnit) => onShared({ durationMinutes, durationUnit })}
            presets={[45, 60, 90, 120, 180, 240]}
            allowFlexible={false}
          />
        </Section>

      </>,
    )
  }

  /* ---------- pass ---------- */
  const pass = settings.pass
  return shell(
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Valid for" description="From the date the guest picks.">
          <Select value={String(pass.validDays)} onValueChange={(value) => set('pass', { validDays: Number(value) })}>
            <SelectTrigger aria-label="Valid for">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 5, 7].map((days) => (
                <SelectItem key={days} value={String(days)}>
                  {days === 1 ? '1 day' : `${days} days`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
    </>,
  )
}

/* ==========================================================================
   ITEMS AND PRICES — the Pricing step for a rental. Every kind of thing you
   lend out is one item with its own stock, size, prices and deposit, so a
   guest can take two of one and one of another on the same booking, and
   each is counted on its own.
   ========================================================================== */

export function RentalRatesEditor({
  tiers,
  onTiers,
  settings: raw,
  onSettings,
  currencySymbol,
  errors,
  newTier,
}: {
  tiers: DraftTier[]
  onTiers: (tiers: DraftTier[]) => void
  settings: DraftKindSettings
  onSettings: (settings: DraftKindSettings) => void
  currencySymbol: string
  errors: Record<string, string>
  newTier: (label: string) => DraftTier
}) {
  const settings = normalizeKindSettings(raw)
  const rental = settings.rental
  const hourly = rental.modes.includes('hour')
  const daily = rental.modes.includes('day')
  const rateOf = (tier: DraftTier) => rental.rates[tier.id] ?? { hour: tier.price, day: Math.round((tier.price * 4) / 500) * 500 }
  const byLength = rental.modes.includes('length')
  const setRate = (tier: DraftTier, patch: Partial<DraftRate>) =>
    onSettings({ ...settings, rental: { ...rental, rates: { ...rental.rates, [tier.id]: { ...rateOf(tier), ...patch } } } })
  const setItem = (tierId: string, patch: Partial<DraftRentalItem>) =>
    onSettings({ ...settings, rental: { ...rental, items: { ...rental.items, [tierId]: { ...draftItemOf(rental, tierId), ...patch } } } })
  const setTier = (tierId: string, patch: Partial<DraftTier>) => onTiers(tiers.map((entry) => (entry.id === tierId ? { ...entry, ...patch } : entry)))
  const money = (value: string) => Math.max(0, Math.round(Number(value) * 100) || 0)
  const whole = (value: string, least = 0) => Math.max(least, Number.parseInt(value, 10) || 0)
  const stock = tiers.reduce((sum, tier) => sum + draftItemOf(rental, tier.id).stock, 0)
  const people = tiers.reduce((sum, tier) => sum + draftItemOf(rental, tier.id).stock * draftItemOf(rental, tier.id).holds, 0)

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex list-none flex-col gap-3 p-0">
        {tiers.map((tier, index) => {
          const rate = rateOf(tier)
          const item = draftItemOf(rental, tier.id)
          return (
            <li key={tier.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start gap-3">
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                  <Field label="Item" labelSize="sm" error={errors[`tiers.${index}.label`]}>
                    {(control) => <Input {...control} value={tier.label} placeholder="Item name" onChange={(e) => setTier(tier.id, { label: e.target.value })} />}
                  </Field>
                  <Field label="Short description" labelSize="sm" optional>
                    {(control) => <Input {...control} value={tier.description} placeholder="What guests should know about it" onChange={(e) => setTier(tier.id, { description: e.target.value })} />}
                  </Field>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${tier.label || 'this item'}`}
                  disabled={tiers.length === 1}
                  onClick={() => onTiers(tiers.filter((entry) => entry.id !== tier.id))}
                  className="mt-6 grid size-8 shrink-0 place-items-center rounded-lg text-faint hover:bg-surface-sunken hover:text-danger disabled:opacity-30"
                >
                  ×
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="In stock" labelSize="sm" error={errors[`item.${tier.id}.stock`]}>
                  {(control) => <Input {...control} type="number" min={1} value={item.stock || ''} onChange={(e) => setItem(tier.id, { stock: whole(e.target.value) })} />}
                </Field>
                <Field label={rental.category && rentalCategoryMeta(rental.category).mileage ? 'Seats' : 'People per item'} labelSize="sm">
                  {(control) => <Input {...control} type="number" min={1} suffix={item.holds === 1 ? 'person' : 'people'} value={item.holds || ''} onChange={(e) => setItem(tier.id, { holds: whole(e.target.value, 1) })} />}
                </Field>
                {hourly ? (
                  <Field label="Per hour" labelSize="sm" error={errors[`rate.${tier.id}.hour`]}>
                    {(control) => <Input {...control} type="number" min={0} leftIcon={<span className="text-sm font-medium">{currencySymbol}</span>} value={rate.hour / 100 || ''} onChange={(e) => setRate(tier, { hour: money(e.target.value) })} />}
                  </Field>
                ) : null}
                {daily ? (
                  <>
                    <Field label="Per day" labelSize="sm" error={errors[`rate.${tier.id}.day`]}>
                      {(control) => <Input {...control} type="number" min={0} leftIcon={<span className="text-sm font-medium">{currencySymbol}</span>} value={rate.day / 100 || ''} onChange={(e) => setRate(tier, { day: money(e.target.value) })} />}
                    </Field>
                    <Field label="Per week" labelSize="sm" optional description="Used when cheaper than the days.">
                      {(control) => <Input {...control} type="number" min={0} placeholder="None" leftIcon={<span className="text-sm font-medium">{currencySymbol}</span>} value={rate.week ? rate.week / 100 : ''} onChange={(e) => setRate(tier, { week: money(e.target.value) })} />}
                    </Field>
                    <Field label="Per month" labelSize="sm" optional description="30 days. Used when cheaper.">
                      {(control) => <Input {...control} type="number" min={0} placeholder="None" leftIcon={<span className="text-sm font-medium">{currencySymbol}</span>} value={rate.month ? rate.month / 100 : ''} onChange={(e) => setRate(tier, { month: money(e.target.value) })} />}
                    </Field>
                  </>
                ) : null}
                {byLength
                  ? rental.lengths.map((length) => (
                      <Field key={length.id} label={length.label || `${length.hours} hours`} labelSize="sm" error={errors[`rate.${tier.id}.len.${length.id}`]}>
                        {(control) => (
                          <Input
                            {...control}
                            type="number"
                            min={0}
                            leftIcon={<span className="text-sm font-medium">{currencySymbol}</span>}
                            value={(rate.lengths?.[length.id] ?? 0) / 100 || ''}
                            onChange={(e) => setRate(tier, { lengths: { ...rate.lengths, [length.id]: money(e.target.value) } })}
                          />
                        )}
                      </Field>
                    ))
                  : null}
                {hourly || daily ? (
                  <Field label="Most per item" labelSize="sm" optional>
                    {(control) => <Input {...control} type="number" min={0} placeholder="None" leftIcon={<span className="text-sm font-medium">{currencySymbol}</span>} value={item.cap ? item.cap / 100 : ''} onChange={(e) => setItem(tier.id, { cap: money(e.target.value) })} />}
                  </Field>
                ) : null}
                <Field label="Security deposit" labelSize="sm" optional description="Held at pick-up, given back on return.">
                  {(control) => <Input {...control} type="number" min={0} placeholder="None" leftIcon={<span className="text-sm font-medium">{currencySymbol}</span>} value={item.deposit ? item.deposit / 100 : ''} onChange={(e) => setItem(tier.id, { deposit: money(e.target.value) })} />}
                </Field>
              </div>
            </li>
          )
        })}
      </ul>
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => onTiers([...tiers, newTier('')])}>
        + Add another item
      </Button>
      <p className="text-xs text-subtle tabular">
        {stock} {stock === 1 ? 'item' : 'items'} · up to {people} {people === 1 ? 'person' : 'people'} at once
      </p>
    </div>
  )
}
