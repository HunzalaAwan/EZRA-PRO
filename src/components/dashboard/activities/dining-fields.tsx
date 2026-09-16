'use client'

import * as React from 'react'
import {
  Armchair,
  Baby,
  CalendarClock,
  CalendarRange,
  ChefHat,
  Coffee,
  CreditCard,
  Landmark,
  Leaf,
  Plus,
  Receipt,
  Sun,
  Trash2,
  Users,
  UtensilsCrossed,
  Wine,
} from 'lucide-react'

import type { CurrencyCode } from '@/types'
import { cn, formatCurrency, formatDuration, fromDateKey, pluralize } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MoneyInput } from './pricing-tier-editor'
import {
  WEEKDAY_LABEL,
  WEEKDAY_ORDER,
  formatClock,
  previewDepartures,
  type DraftSchedule,
} from './schedule-editor'

/* ==========================================================================
   DINING — what a restaurant needs from the wizard that a tour does not.

   A table is not a seat on a boat. Restaurants think in covers, sittings and
   services, not departures; they price a menu per guest and protect the room
   with a deposit or a card hold; they need to know about allergies, children
   and dress before the party arrives. These fields replace the tour-operator
   ones whenever the category is Dining. The underlying schedule still feeds
   the same calendar: every sitting time becomes a bookable slot.
   ========================================================================== */

export type DiningFormat =
  | 'a_la_carte'
  | 'set_menu'
  | 'chefs_table'
  | 'brunch'
  | 'private_dining'
  | 'cooking_class'

export type SeatingArea = 'indoor' | 'terrace' | 'bar' | 'counter' | 'private_room' | 'garden'
export type DressCode = 'none' | 'smart_casual' | 'smart' | 'formal'
export type ChildrenPolicy = 'welcome' | 'early_only' | 'adults_only'
export type DietaryOption =
  | 'vegetarian'
  | 'vegan'
  | 'gluten_free'
  | 'dairy_free'
  | 'nut_free'
  | 'halal'
  | 'kosher'
export type DiningBookingMode = 'card_hold' | 'deposit' | 'prepaid'

export interface DiningService {
  id: string
  label: string
  /** First and last sitting, "HH:mm". */
  from: string
  to: string
  /** Minutes between sittings. */
  intervalMinutes: number
}

export interface DiningDraft {
  format: DiningFormat
  cuisine: string
  seating: SeatingArea[]
  minPartySize: number
  maxPartySize: number
  children: ChildrenPolicy
  dressCode: DressCode
  dietary: DietaryOption[]
  askAllergies: boolean
  bookingMode: DiningBookingMode
  /** Minor units, per guest. */
  depositPerGuest: number
  noShowFeePerGuest: number
  /** Percent added to the bill; 0 = none. */
  serviceChargePercent: number
  /** Percent of covers kept off online sale for walk-ins. */
  walkInHoldPercent: number
  services: DiningService[]
}

let serviceCounter = 0
export function blankService(label: string, from: string, to: string, intervalMinutes = 30): DiningService {
  serviceCounter += 1
  return { id: `svc_draft_${serviceCounter}`, label, from, to, intervalMinutes }
}

export function defaultDining(): DiningDraft {
  return {
    format: 'set_menu',
    cuisine: '',
    seating: ['indoor', 'terrace'],
    minPartySize: 1,
    maxPartySize: 8,
    children: 'welcome',
    dressCode: 'smart_casual',
    dietary: ['vegetarian', 'gluten_free'],
    askAllergies: true,
    bookingMode: 'deposit',
    depositPerGuest: 2500,
    noShowFeePerGuest: 5000,
    serviceChargePercent: 0,
    walkInHoldPercent: 20,
    services: [blankService('Dinner', '18:00', '21:30', 30)],
  }
}

/** Defaults a tour would never pick: a 90-minute table, forty covers, all ages. */
export const DINING_BASICS = { durationMinutes: 90, maxCapacity: 40, minAge: 0 } as const

export const DINING_TIER_PRESETS = [
  { label: 'Tasting menu', price: 8500, description: 'Per guest, seven courses' },
  { label: "Children's menu", price: 2500, description: 'Under 12, three courses' },
  { label: 'Vegetarian tasting', price: 7500, description: 'Per guest, seven courses' },
  { label: "Chef's counter", price: 12500, description: 'Per guest, seated at the pass' },
  { label: 'Set lunch', price: 4500, description: 'Per guest, three courses' },
]

export const DINING_ADDON_PRESETS = [
  { label: 'Wine pairing', price: 5500, description: 'Five glasses matched to the menu.', icon: Wine },
  { label: 'Champagne on arrival', price: 1800, description: 'A glass poured as the party is seated.', icon: Wine },
  { label: 'Celebration cake', price: 3200, description: 'Personalised, brought out with candles.', icon: Receipt },
  { label: 'Private room hire', price: 15000, description: 'The room to yourselves for the sitting.', icon: Landmark },
  { label: 'Corkage', price: 2500, description: 'Bring your own bottle, per bottle.', icon: Wine },
]

export const FORMAT_OPTIONS: { value: DiningFormat; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'a_la_carte', label: 'À la carte', description: 'Guests order from the menu on the night.', icon: <UtensilsCrossed /> },
  { value: 'set_menu', label: 'Set or tasting menu', description: 'A fixed menu priced per guest.', icon: <ChefHat /> },
  { value: 'chefs_table', label: "Chef's table", description: 'A handful of covers at the pass.', icon: <Sun /> },
  { value: 'brunch', label: 'Brunch or buffet', description: 'Sittings with a flat price per guest.', icon: <Coffee /> },
  { value: 'private_dining', label: 'Private dining', description: 'The room, for one party at a time.', icon: <Armchair /> },
  { value: 'cooking_class', label: 'Cooking class', description: 'Guests cook, then eat what they made.', icon: <Leaf /> },
]

export const SEATING_OPTIONS: { value: SeatingArea; label: string }[] = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'terrace', label: 'Terrace' },
  { value: 'garden', label: 'Garden' },
  { value: 'bar', label: 'Bar' },
  { value: 'counter', label: "Chef's counter" },
  { value: 'private_room', label: 'Private room' },
]

export const DIETARY_OPTIONS: { value: DietaryOption; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten_free', label: 'Gluten-free' },
  { value: 'dairy_free', label: 'Dairy-free' },
  { value: 'nut_free', label: 'Nut-free' },
  { value: 'halal', label: 'Halal' },
  { value: 'kosher', label: 'Kosher' },
]

export const DRESS_OPTIONS: { value: DressCode; label: string; hint: string }[] = [
  { value: 'none', label: 'No dress code', hint: 'Come as you are' },
  { value: 'smart_casual', label: 'Smart casual', hint: 'No beachwear or sportswear' },
  { value: 'smart', label: 'Smart', hint: 'Collared shirts, no shorts' },
  { value: 'formal', label: 'Formal', hint: 'Jackets for gentlemen' },
]

export const CHILDREN_OPTIONS: { value: ChildrenPolicy; label: string }[] = [
  { value: 'welcome', label: 'Children welcome' },
  { value: 'early_only', label: 'Early sittings only' },
  { value: 'adults_only', label: 'Adults only' },
]

export const BOOKING_MODE_OPTIONS: { value: DiningBookingMode; label: string; description: string; icon: React.ReactNode }[] = [
  { value: 'card_hold', label: 'Card hold', description: 'Nothing charged. A no-show fee applies if the party never arrives.', icon: <CreditCard /> },
  { value: 'deposit', label: 'Deposit per guest', description: 'Taken at booking, deducted from the bill on the night.', icon: <Landmark /> },
  { value: 'prepaid', label: 'Prepaid menu', description: 'The full menu price is paid when the table is reserved.', icon: <Receipt /> },
]

export const CUISINE_SUGGESTIONS = ['Mediterranean', 'Seafood', 'Italian', 'Japanese', 'Modern European', 'Steakhouse', 'Farm to table', 'Greek']

export const TABLE_TIME_PRESETS = [60, 75, 90, 120, 150, 180]

export const SERVICE_PRESETS: { label: string; from: string; to: string; interval: number }[] = [
  { label: 'Breakfast', from: '08:00', to: '10:30', interval: 30 },
  { label: 'Brunch', from: '10:30', to: '14:00', interval: 30 },
  { label: 'Lunch', from: '12:00', to: '14:30', interval: 30 },
  { label: 'Dinner', from: '18:00', to: '21:30', interval: 30 },
  { label: 'Late', from: '21:30', to: '23:00', interval: 30 },
]

const INTERVAL_OPTIONS = [15, 30, 45, 60]

/* --------------------------------------------------------------------------
   Sitting times: every service expands to the slots the calendar sells.
   -------------------------------------------------------------------------- */

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : Number.NaN
}
const toClock = (minutes: number) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export function serviceSittings(service: DiningService): string[] {
  const from = toMinutes(service.from)
  const to = toMinutes(service.to)
  const step = Math.max(5, service.intervalMinutes || 30)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return []
  const out: string[] = []
  for (let t = from; t <= to; t += step) out.push(toClock(t))
  return out
}

/** Every sitting across every service, sorted and de-duplicated. */
export function serviceStartTimes(services: DiningService[]): string[] {
  return [...new Set(services.flatMap(serviceSittings))].sort()
}

export function formatLabel<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value
}

/* ==========================================================================
   Shared props
   ========================================================================== */

export interface DiningFieldProps {
  dining: DiningDraft
  onChange: (dining: DiningDraft) => void
  errors: Record<string, string>
}

/* ==========================================================================
   BASICS — format, cuisine, room, table time, party size, house rules
   ========================================================================== */

export function DiningBasicsFields({
  dining,
  onChange,
  errors,
  durationMinutes,
  maxCapacity,
  onDuration,
  onCapacity,
}: DiningFieldProps & {
  durationMinutes: number
  maxCapacity: number
  onDuration: (minutes: number) => void
  onCapacity: (covers: number) => void
}) {
  const set = (changes: Partial<DiningDraft>) => onChange({ ...dining, ...changes })

  return (
    <>
      <fieldset>
        <legend className="text-[0.8125rem] font-medium">Dining format</legend>
        <p className="mt-0.5 mb-2.5 text-xs text-muted">Sets how the menu is priced and what the booking widget asks for.</p>
        <RadioGroup
          value={dining.format}
          onValueChange={(value) => set({ format: value as DiningFormat })}
          className="grid gap-2.5 sm:grid-cols-2"
        >
          {FORMAT_OPTIONS.map((option) => (
            <RadioGroupCard key={option.value} value={option.value} label={option.label} description={option.description} icon={option.icon} />
          ))}
        </RadioGroup>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cuisine" required error={errors['dining.cuisine']} description="Shown on the listing and used by storefront filters.">
          <Input placeholder="Modern Greek" value={dining.cuisine} onChange={(event) => set({ cuisine: event.target.value })} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CUISINE_SUGGESTIONS.map((cuisine) => (
              <button
                key={cuisine}
                type="button"
                onClick={() => set({ cuisine })}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200',
                  dining.cuisine === cuisine ? 'border-primary/50 bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:text-foreground',
                )}
              >
                {cuisine}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Dress code" description="Repeated in the confirmation email.">
          <Select value={dining.dressCode} onValueChange={(value) => set({ dressCode: value as DressCode })}>
            <SelectTrigger aria-label="Dress code">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DRESS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value} description={option.hint}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div>
        <p className="text-[0.8125rem] font-medium">Seating areas</p>
        <p className="mt-0.5 mb-2.5 text-xs text-muted">Guests can ask for an area when they reserve. Pick every room you sell online.</p>
        <ToggleGroup
          type="multiple"
          size="md"
          className="flex-wrap gap-1.5"
          value={dining.seating}
          onValueChange={(seating) => set({ seating: seating as SeatingArea[] })}
          aria-label="Seating areas"
        >
          {SEATING_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value}>
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {errors['dining.seating'] ? <p className="mt-1.5 text-xs font-medium text-danger">{errors['dining.seating']}</p> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Table time" required error={errors.durationMinutes} description="How long a table is held for one party before it turns.">
          <Input
            type="number"
            min={30}
            step={15}
            value={durationMinutes}
            suffix="minutes"
            onChange={(event) => onDuration(Number.parseInt(event.target.value, 10) || 0)}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TABLE_TIME_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                onClick={() => onDuration(minutes)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200',
                  durationMinutes === minutes ? 'border-primary/50 bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:text-foreground',
                )}
              >
                {formatDuration(minutes)}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Covers per sitting" required error={errors.maxCapacity} description="Seats you sell online for each sitting time, across all areas.">
          <Input type="number" min={1} value={maxCapacity} suffix="covers" onChange={(event) => onCapacity(Number.parseInt(event.target.value, 10) || 0)} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Smallest party" error={errors['dining.minPartySize']}>
          <Input
            type="number"
            min={1}
            value={dining.minPartySize}
            suffix={pluralize(dining.minPartySize, 'guest')}
            onChange={(event) => set({ minPartySize: Number.parseInt(event.target.value, 10) || 0 })}
          />
        </Field>
        <Field label="Largest party online" error={errors['dining.maxPartySize']} description="Bigger groups are asked to enquire instead.">
          <Input
            type="number"
            min={1}
            value={dining.maxPartySize}
            suffix={pluralize(dining.maxPartySize, 'guest')}
            onChange={(event) => set({ maxPartySize: Number.parseInt(event.target.value, 10) || 0 })}
          />
        </Field>
      </div>

      <div>
        <p className="text-[0.8125rem] font-medium">Children</p>
        <p className="mt-0.5 mb-2.5 text-xs text-muted">Shown before a guest picks a time, so families never book a table they cannot use.</p>
        <Segmented
          size="sm"
          label="Children policy"
          value={dining.children}
          onValueChange={(children) => set({ children })}
          options={CHILDREN_OPTIONS.map((option) => ({ value: option.value, label: option.label, icon: option.value === 'welcome' ? Baby : undefined }))}
        />
      </div>
    </>
  )
}

/* ==========================================================================
   DESCRIPTION — dietary cover and allergies sit with the copy
   ========================================================================== */

export function DiningDietaryFields({ dining, onChange }: Omit<DiningFieldProps, 'errors'>) {
  const set = (changes: Partial<DiningDraft>) => onChange({ ...dining, ...changes })
  return (
    <div className="rounded-xl border border-line bg-surface-sunken/50 p-4">
      <p className="text-[0.8125rem] font-medium">Dietary needs you can cater for</p>
      <p className="mt-0.5 mb-2.5 text-xs text-muted">Listed on the storefront; guests filter on them.</p>
      <ToggleGroup
        type="multiple"
        size="sm"
        className="flex-wrap gap-1.5"
        value={dining.dietary}
        onValueChange={(dietary) => set({ dietary: dietary as DietaryOption[] })}
        aria-label="Dietary options"
      >
        {DIETARY_OPTIONS.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <label className="mt-4 flex cursor-pointer items-start justify-between gap-4 border-t border-line-subtle pt-3">
        <span className="min-w-0">
          <span className="block text-[0.8125rem] font-medium">Ask for allergies at booking</span>
          <span className="block text-xs text-muted">Adds a required allergies and dietary box to checkout. The answer lands on the sitting sheet.</span>
        </span>
        <Switch checked={dining.askAllergies} onCheckedChange={(askAllergies) => set({ askAllergies })} aria-label="Ask for allergies at booking" />
      </label>
    </div>
  )
}

/* ==========================================================================
   PRICING — how the room is protected
   ========================================================================== */

export function DiningBookingFields({ dining, onChange, errors, currency }: DiningFieldProps & { currency: CurrencyCode }) {
  const set = (changes: Partial<DiningDraft>) => onChange({ ...dining, ...changes })
  return (
    <section>
      <h3 className="text-sm font-semibold">Securing the table</h3>
      <p className="mt-0.5 mb-3 text-xs text-muted">What the guest commits to when they reserve. This is what keeps no-shows down.</p>
      <RadioGroup
        value={dining.bookingMode}
        onValueChange={(value) => set({ bookingMode: value as DiningBookingMode })}
        className="grid gap-2.5 sm:grid-cols-3"
      >
        {BOOKING_MODE_OPTIONS.map((option) => (
          <RadioGroupCard key={option.value} value={option.value} label={option.label} description={option.description} icon={option.icon} />
        ))}
      </RadioGroup>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {dining.bookingMode === 'deposit' ? (
          <Field label="Deposit per guest" required error={errors['dining.depositPerGuest']} labelSize="sm">
            <MoneyInput value={dining.depositPerGuest} onValueChange={(depositPerGuest) => set({ depositPerGuest })} currency={currency} ariaLabel="Deposit per guest" />
          </Field>
        ) : null}
        {dining.bookingMode !== 'prepaid' ? (
          <Field
            label="No-show fee per guest"
            error={errors['dining.noShowFeePerGuest']}
            labelSize="sm"
            description={dining.bookingMode === 'deposit' ? 'Charged on top of the forfeited deposit.' : 'Charged to the held card if the party never arrives.'}
          >
            <MoneyInput value={dining.noShowFeePerGuest} onValueChange={(noShowFeePerGuest) => set({ noShowFeePerGuest })} currency={currency} ariaLabel="No-show fee per guest" />
          </Field>
        ) : null}
        <Field label="Service charge" labelSize="sm" description="Added to the bill and shown at checkout. 0 means none.">
          <Input
            type="number"
            min={0}
            max={30}
            value={dining.serviceChargePercent}
            suffix="%"
            onChange={(event) => set({ serviceChargePercent: Number.parseInt(event.target.value, 10) || 0 })}
          />
        </Field>
      </div>

      {dining.bookingMode === 'deposit' && dining.depositPerGuest > 0 ? (
        <p className="mt-3 text-xs text-subtle">
          A party of {dining.maxPartySize} commits{' '}
          <span className="font-medium text-foreground tabular-nums">{formatCurrency(dining.depositPerGuest * dining.maxPartySize, currency)}</span> at booking.
        </p>
      ) : null}
    </section>
  )
}

/* ==========================================================================
   SERVICES — sittings, not departures
   ========================================================================== */

export function DiningServiceEditor({
  dining,
  onChange,
  schedule,
  onSchedule,
  nowIso,
  errors,
}: DiningFieldProps & {
  schedule: DraftSchedule
  onSchedule: (schedule: DraftSchedule) => void
  nowIso: string
}) {
  const setServices = (services: DiningService[]) => {
    onChange({ ...dining, services })
    onSchedule({ ...schedule, startTimes: serviceStartTimes(services) })
  }
  const updateService = (index: number, changes: Partial<DiningService>) =>
    setServices(dining.services.map((service, i) => (i === index ? { ...service, ...changes } : service)))

  const toggleWeekday = (weekday: number) => {
    const next = schedule.weekdays.includes(weekday) ? schedule.weekdays.filter((day) => day !== weekday) : [...schedule.weekdays, weekday]
    onSchedule({ ...schedule, weekdays: next })
  }

  const used = new Set(dining.services.map((s) => s.label.toLowerCase()))
  const preview = React.useMemo(() => previewDepartures(schedule, nowIso), [schedule, nowIso])
  const sittings = preview.reduce((acc, day) => acc + day.times.length, 0)
  const covers = preview.reduce((acc, day) => acc + day.seats, 0)
  const onlineCovers = Math.round(schedule.capacity * (1 - dining.walkInHoldPercent / 100))

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- services ---------- */}
      <div>
        <p className="text-[0.8125rem] font-medium">Services</p>
        <p className="mt-0.5 text-xs text-muted">Each service sells a sitting every interval between its first and last seating.</p>

        <div className="mt-2.5 flex flex-col gap-2.5">
          {dining.services.map((service, index) => {
            const slots = serviceSittings(service)
            return (
              <div key={service.id} className="rounded-xl border border-line bg-surface p-3.5 shadow-xs">
                <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] sm:items-end">
                  <Field label="Service" labelSize="sm" error={errors[`dining.services.${index}.label`]}>
                    <Input size="sm" value={service.label} placeholder="Dinner" onChange={(event) => updateService(index, { label: event.target.value })} />
                  </Field>
                  <Field label="First seating" labelSize="sm" error={errors[`dining.services.${index}.from`]}>
                    <Input type="time" size="sm" value={service.from} onChange={(event) => updateService(index, { from: event.target.value })} />
                  </Field>
                  <Field label="Last seating" labelSize="sm" error={errors[`dining.services.${index}.to`]}>
                    <Input type="time" size="sm" value={service.to} onChange={(event) => updateService(index, { to: event.target.value })} />
                  </Field>
                  <Field label="Every" labelSize="sm">
                    <Select value={String(service.intervalMinutes)} onValueChange={(value) => updateService(index, { intervalMinutes: Number(value) })}>
                      <SelectTrigger size="sm" aria-label="Seating interval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVAL_OPTIONS.map((minutes) => (
                          <SelectItem key={minutes} value={String(minutes)}>
                            {minutes} min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <IconButton
                    type="button"
                    aria-label={`Remove the ${service.label || 'service'}`}
                    size="sm"
                    variant="ghost"
                    className="mb-0.5 text-danger hover:bg-danger-soft"
                    onClick={() => setServices(dining.services.filter((_, i) => i !== index))}
                  >
                    <Trash2 />
                  </IconButton>
                </div>
                <p className="mt-2 text-xs text-subtle">
                  {slots.length > 0 ? (
                    <>
                      <span className="font-medium text-foreground tabular-nums">{slots.length}</span> {pluralize(slots.length, 'sitting')} · {formatClock(slots[0])} to{' '}
                      {formatClock(slots[slots.length - 1])}
                    </>
                  ) : (
                    'Last seating must come after the first.'
                  )}
                </p>
              </div>
            )
          })}
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {SERVICE_PRESETS.filter((preset) => !used.has(preset.label.toLowerCase())).map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Plus />}
              onClick={() => setServices([...dining.services, blankService(preset.label, preset.from, preset.to, preset.interval)])}
            >
              {preset.label}
            </Button>
          ))}
          <Button type="button" variant="ghost" size="sm" leftIcon={<Plus />} onClick={() => setServices([...dining.services, blankService('', '17:00', '20:00', 30)])}>
            Custom service
          </Button>
        </div>
        {errors['dining.services'] ? <p className="mt-1.5 text-xs font-medium text-danger">{errors['dining.services']}</p> : null}
        {errors.startTimes && !errors['dining.services'] ? <p className="mt-1.5 text-xs font-medium text-danger">{errors.startTimes}</p> : null}
      </div>

      {/* ---------- weekdays ---------- */}
      <div>
        <p className="text-[0.8125rem] font-medium">Open on</p>
        <p className="mt-0.5 text-xs text-muted">Every service runs on each selected day inside the season.</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {WEEKDAY_ORDER.map((weekday) => {
            const active = schedule.weekdays.includes(weekday)
            return (
              <button
                key={weekday}
                type="button"
                aria-pressed={active}
                onClick={() => toggleWeekday(weekday)}
                className={cn(
                  'h-10 min-w-14 rounded-lg border px-3 text-[0.8125rem] font-medium',
                  'transition-all duration-200 ease-[var(--ease-out-expo)] active:scale-[0.97]',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                  active ? 'border-primary bg-primary text-on-primary shadow-sm' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
                )}
              >
                {WEEKDAY_LABEL[weekday]}
              </button>
            )
          })}
        </div>
        {errors.weekdays ? <p className="mt-1.5 text-xs font-medium text-danger">{errors.weekdays}</p> : null}
      </div>

      {/* ---------- covers + season ---------- */}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[0.8125rem] font-medium">Covers per sitting</p>
            <span className="font-display text-sm font-semibold tabular">{schedule.capacity}</span>
          </div>
          <Slider className="mt-3" min={1} max={120} step={1} value={[schedule.capacity]} thumbLabels={['Covers per sitting']} onValueChange={([capacity]) => onSchedule({ ...schedule, capacity })} />

          <div className="mt-4 flex items-baseline justify-between gap-3">
            <p className="text-[0.8125rem] font-medium">Held back for walk-ins</p>
            <span className="font-display text-sm font-semibold tabular">{dining.walkInHoldPercent}%</span>
          </div>
          <Slider
            className="mt-3"
            min={0}
            max={60}
            step={5}
            value={[dining.walkInHoldPercent]}
            thumbLabels={['Walk-in hold']}
            onValueChange={([walkInHoldPercent]) => onChange({ ...dining, walkInHoldPercent })}
          />
          <p className="mt-2 text-xs text-subtle">
            <span className="font-medium text-foreground tabular-nums">{onlineCovers}</span> of {schedule.capacity} covers on sale online per sitting.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 self-start">
          <Field label="Season starts" labelSize="sm" error={errors.seasonStart}>
            <Input type="date" size="sm" value={schedule.seasonStart} onChange={(event) => onSchedule({ ...schedule, seasonStart: event.target.value })} />
          </Field>
          <Field label="Season ends" labelSize="sm" error={errors.seasonEnd}>
            <Input type="date" size="sm" value={schedule.seasonEnd} onChange={(event) => onSchedule({ ...schedule, seasonEnd: event.target.value })} />
          </Field>
        </div>
      </div>

      {/* ---------- preview ---------- */}
      <div className="rounded-xl border border-line bg-surface-sunken/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-subtle uppercase">
            <CalendarRange className="size-3.5" aria-hidden="true" />
            Next two weeks
          </p>
          <div className="flex items-center gap-2">
            <Badge size="sm" variant="neutral">
              <CalendarClock className="size-3" aria-hidden="true" />
              {sittings} sittings
            </Badge>
            <Badge size="sm" variant="primary">
              <Users className="size-3" aria-hidden="true" />
              {covers} covers
            </Badge>
          </div>
        </div>

        {preview.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing on sale yet. Add a service and pick at least one open day inside the season.</p>
        ) : (
          <ul className="mt-3 flex list-none flex-col gap-1.5 p-0">
            {preview.slice(0, 7).map((day) => (
              <li key={day.dateKey} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-surface px-3 py-2">
                <span className="w-28 shrink-0 text-[0.8125rem] font-medium">
                  {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(fromDateKey(day.dateKey))}
                </span>
                <span className="flex flex-wrap gap-1">
                  {dining.services.map((service) => {
                    const slots = serviceSittings(service)
                    if (slots.length === 0) return null
                    return (
                      <span key={service.id} className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[0.6875rem] font-medium text-primary tabular">
                        {service.label || 'Service'} · {formatClock(slots[0])}–{formatClock(slots[slots.length - 1])}
                      </span>
                    )
                  })}
                </span>
                <span className="ml-auto shrink-0 text-xs text-faint tabular">
                  {day.times.length} sittings · {day.seats} covers
                </span>
              </li>
            ))}
            {preview.length > 7 ? <li className="px-3 pt-1 text-xs text-faint">and {preview.length - 7} more days</li> : null}
          </ul>
        )}
      </div>
    </div>
  )
}
