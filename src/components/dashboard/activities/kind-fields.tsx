'use client'

import * as React from 'react'
import { Anchor, Bike, Car, GraduationCap, KeyRound, Package, Route, Ship, Ticket, Zap, type LucideIcon } from 'lucide-react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { useCustomCategories } from '@/hooks/use-custom-categories'
import {
  ACTIVITY_KINDS,
  ACTIVITY_KIND_META,
  CHARTER_VESSELS,
  FUEL_LABEL,
  LANGUAGES,
  LESSON_LEVELS,
  LICENCE_LABEL,
  RENTAL_CATEGORIES,
  RENTAL_LENGTHS,
  crewName,
  rentalCategoryMeta,
} from '@/lib/activity-kinds'
import { cn, formatDuration } from '@/lib/utils'
import type { ActivityKind, CharterConfig, DifficultyLevel, LessonConfig, RentalCategory, RentalConfig } from '@/types'

import { DurationField, type DurationUnit } from './duration-field'
import type { DraftTier } from './pricing-tier-editor'

/* ==========================================================================
   What are you selling? The kind picker, and the one card of settings each
   kind needs. Every number a kind cares about lives in its card, once:
   seats for a trip, units for a rental, the group for a charter, the class
   for a lesson, tickets for a pass. The schedule step only reads them.
   ========================================================================== */

export const KIND_ICONS: Record<ActivityKind, LucideIcon> = {
  trip: Route,
  activity: Zap,
  charter: Anchor,
  rental: KeyRound,
  lesson: GraduationCap,
  pass: Ticket,
}

const CATEGORY_ICONS: Record<RentalCategory, LucideIcon> = {
  watercraft: Ship,
  vehicle: Car,
  bike: Bike,
  gear: Package,
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
    modes: ('hour' | 'day')[]
    minHours: number
    maxHours: number
    /** Per tier: price per hour and per day, minor units. */
    rates: Record<string, { hour: number; day: number }>
    licence: NonNullable<RentalConfig['licence']>
    fuel: NonNullable<RentalConfig['fuel']>
    kmPerDay: number
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
      licence: 'none',
      fuel: 'included',
      kmPerDay: 0,
    },
    charter: { maxGuests: 6, requestToBook: false, noticeHours: 24, vessel: 'boat', vesselLabel: '', crewLabel: '', crewed: true, minutes: {} },
    lesson: { level: 'beginner', sessions: 1, ratio: 4, certification: '', equipmentIncluded: true },
    pass: { validDays: 1, reentry: true },
    activity: { minHeightCm: 0, maxWeightKg: 0 },
  }
}

/** Drafts saved before a field existed pick up its default. */
export function normalizeKindSettings(settings: Partial<DraftKindSettings> | undefined): DraftKindSettings {
  const base = defaultKindSettings()
  return {
    rental: { ...base.rental, ...settings?.rental },
    charter: { ...base.charter, ...settings?.charter },
    lesson: { ...base.lesson, ...settings?.lesson },
    pass: { ...base.pass, ...settings?.pass },
    activity: { ...base.activity, ...settings?.activity },
  }
}

/** The distance or track, typed in the wizard. Off means the listing shows none. */
export interface DraftRoute {
  enabled: boolean
  distance: number
  unit: 'km' | 'mi'
  track: string
  elevationM: number
}

export const emptyRoute = (): DraftRoute => ({ enabled: false, distance: 0, unit: 'km', track: '', elevationM: 0 })

/** The numbers every activity carries, edited from inside a kind's card. */
export interface SharedBasics {
  maxCapacity: number
  minParticipants: number
  minAge: number
  durationMinutes: number
  durationUnit: DurationUnit
  languages: string[]
  difficulty: DifficultyLevel
  route: DraftRoute
}

export function KindPicker({ value, onChange }: { value: ActivityKind; onChange: (kind: ActivityKind) => void }) {
  return (
    <fieldset>
      <legend className="text-[0.8125rem] font-medium">What are you selling?</legend>
      <p className="mt-0.5 mb-2.5 text-xs text-muted">
        This decides the setup below, how the storefront books it and the tools you get on the day.
      </p>
      <RadioGroup value={value} onValueChange={(next) => onChange(next as ActivityKind)} className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {ACTIVITY_KINDS.map((kind) => {
          const meta = ACTIVITY_KIND_META[kind]
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

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-subtle">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string; hint: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const on = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-xl border px-3.5 py-3 text-left transition-colors duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              on ? 'border-primary bg-primary-soft/30' : 'border-line bg-surface hover:border-line-strong',
            )}
          >
            <span className="block text-sm font-medium text-foreground">{option.label}</span>
            <span className="block text-xs text-subtle">{option.hint}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Languages the guide or instructor speaks, as toggle chips. */
export function LanguagePicker({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Languages">
      {LANGUAGES.map((language) => {
        const on = value.includes(language)
        return (
          <button
            key={language}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((entry) => entry !== language) : [...value, language])}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-200',
              on ? 'border-primary/50 bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:text-foreground',
            )}
          >
            {language}
          </button>
        )
      })}
    </div>
  )
}

function TierLengths({
  tiers,
  minutes,
  options,
  fallback,
  onChange,
  labelFor,
}: {
  tiers: DraftTier[]
  minutes: Record<string, number>
  options: number[]
  fallback: number
  onChange: (next: Record<string, number>) => void
  labelFor: (minutes: number) => string
}) {
  return (
    <ul className="flex list-none flex-col gap-2 p-0">
      {tiers.map((tier) => (
        <li key={tier.id} className="flex items-center gap-3 rounded-lg border border-line-subtle bg-surface px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm">{tier.label || 'Untitled tier'}</span>
          <Select value={String(minutes[tier.id] ?? fallback)} onValueChange={(value) => onChange({ ...minutes, [tier.id]: Number(value) })}>
            <SelectTrigger className="w-48" size="sm" aria-label={`Length of ${tier.label}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {labelFor(option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </li>
      ))}
    </ul>
  )
}

const ageField = (shared: SharedBasics, onShared: (patch: Partial<SharedBasics>) => void, errors: Record<string, string>, label = 'Minimum age') => (
  <Field label={label} error={errors.minAge} description="0 means all ages welcome.">
    {(control) => (
      <Input {...control} type="number" min={0} max={99} suffix="years" value={shared.minAge} onChange={(e) => onShared({ minAge: num(e.target.value) })} />
    )}
  </Field>
)

const INTENSITY: { value: DifficultyLevel; label: string }[] = [
  { value: 'easy', label: 'Easy · anyone can do it' },
  { value: 'moderate', label: 'Moderate · some fitness or balance' },
  { value: 'challenging', label: 'Challenging · fit and confident' },
  { value: 'extreme', label: 'Extreme · experience or a briefing needed' },
]

/** Optional distance or track, for hikes, rides, runs and routes. */
export function RouteFields({ value, onChange }: { value: DraftRoute; onChange: (value: DraftRoute) => void }) {
  const set = (patch: Partial<DraftRoute>) => onChange({ ...value, ...patch })
  return (
    <div className="flex flex-col gap-3">
      <Toggle
        label="Has a distance or track"
        hint="For a hiking trail, a ride route or a circuit. Shown on the listing."
        checked={value.enabled}
        onChange={(enabled) => set({ enabled })}
      />
      {value.enabled ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)]">
          <Field label="Distance">
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                step={0.5}
                value={value.distance || ''}
                placeholder="6.5"
                aria-label="Distance"
                className="flex-1"
                onChange={(e) => set({ distance: Math.max(0, Number(e.target.value) || 0) })}
              />
              <Select value={value.unit} onValueChange={(unit) => set({ unit: unit as DraftRoute['unit'] })}>
                <SelectTrigger className="w-20 shrink-0" aria-label="Distance unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="km">km</SelectItem>
                  <SelectItem value="mi">mi</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Field>
          <Field label="Elevation gain" optional>
            {(control) => <Input {...control} type="number" min={0} step={10} suffix="m" value={value.elevationM || ''} placeholder="0" onChange={(e) => set({ elevationM: num(e.target.value) })} />}
          </Field>
          <Field label="Track or route name" optional>
            {(control) => <Input {...control} placeholder="Ranch loop, Red trail, Coast to Black Rock" value={value.track} onChange={(e) => set({ track: e.target.value.slice(0, 60) })} />}
          </Field>
        </div>
      ) : null}
    </div>
  )
}

/* ---------- the card ---------- */

export function KindFields({
  kind,
  settings: raw,
  onChange,
  tiers,
  currencySymbol,
  errors,
  shared,
  onShared,
  tenantSlug = '',
}: {
  /** For the business's own charter types. */
  tenantSlug?: string
  kind: ActivityKind
  settings: DraftKindSettings
  onChange: (settings: DraftKindSettings) => void
  tiers: DraftTier[]
  currencySymbol: string
  errors: Record<string, string>
  shared: SharedBasics
  onShared: (patch: Partial<SharedBasics>) => void
}) {
  const settings = normalizeKindSettings(raw)
  const ownVessels = useCustomCategories(tenantSlug, 'charter-vessels')
  const [addingVessel, setAddingVessel] = React.useState(false)
  const [vesselDraft, setVesselDraft] = React.useState({ name: '', crew: '' })
  const set = <K extends keyof DraftKindSettings>(key: K, patch: Partial<DraftKindSettings[K]>) =>
    onChange({ ...settings, [key]: { ...settings[key], ...patch } })

  if (kind === 'trip') return null

  const shell = (children: React.ReactNode) => (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-sunken/40 p-4">
      <p className="text-[0.8125rem] font-medium">{ACTIVITY_KIND_META[kind].label} settings</p>
      {children}
    </div>
  )

  /* ---------- activity: a time slot, no departure ---------- */
  if (kind === 'activity') {
    const ride = settings.activity
    return shell(
      <>
        <Section title="Each time slot" hint="Guests pick a slot and turn up. How often slots start is set in the Schedule step.">
          <DurationField
            label="Each slot lasts"
            error={errors.durationMinutes}
            minutes={shared.durationMinutes}
            unit={shared.durationUnit === 'days' ? 'minutes' : shared.durationUnit}
            onChange={(durationMinutes, durationUnit) => onShared({ durationMinutes, durationUnit })}
            presets={[15, 30, 45, 60, 90, 120]}
            allowFlexible={false}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Riders per slot" required error={errors.maxCapacity} description="Everyone who can go at once.">
              {(control) => <Input {...control} type="number" min={1} value={shared.maxCapacity || ''} placeholder="8" onChange={(e) => onShared({ maxCapacity: num(e.target.value) })} />}
            </Field>
            <Field label="Intensity">
              <Select value={shared.difficulty} onValueChange={(value) => onShared({ difficulty: value as DifficultyLevel })}>
                <SelectTrigger aria-label="Intensity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTENSITY.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {ageField(shared, onShared, errors)}
          </div>
        </Section>

        <Section title="Rider limits" hint="Optional. Each limit adds a question for every rider at checkout, and stops the booking if it is not met.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum height" description="0 for no limit.">
              {(control) => <Input {...control} type="number" min={0} suffix="cm" value={ride.minHeightCm} onChange={(e) => set('activity', { minHeightCm: num(e.target.value) })} />}
            </Field>
            <Field label="Maximum weight" description="0 for no limit.">
              {(control) => <Input {...control} type="number" min={0} suffix="kg" value={ride.maxWeightKg} onChange={(e) => set('activity', { maxWeightKg: num(e.target.value) })} />}
            </Field>
          </div>
        </Section>

        <Section title="Distance or track">
          <RouteFields value={shared.route} onChange={(route) => onShared({ route })} />
        </Section>
      </>,
    )
  }

  /* ---------- rental ---------- */
  if (kind === 'rental') {
    const rental = settings.rental
    const meta = rentalCategoryMeta(rental.category)
    const hourly = rental.modes.includes('hour')
    const daily = rental.modes.includes('day')
    const byDay = daily && !hourly
    const toggleMode = (mode: 'hour' | 'day') => {
      const on = rental.modes.includes(mode)
      // One way of charging has to stay on.
      if (on && rental.modes.length === 1) return
      const modes = on ? rental.modes.filter((entry) => entry !== mode) : (['hour', 'day'] as const).filter((entry) => entry === mode || rental.modes.includes(entry))
      set('rental', { modes: [...modes], billing: modes.length === 1 && modes[0] === 'day' ? 'day' : 'length' })
    }
    const pickCategory = (category: RentalCategory) => {
      const next = rentalCategoryMeta(category)
      set('rental', {
        category,
        licence: next.licence,
        seatsPerUnit: next.seatsPerUnit,
        billing: next.billing,
        modes: category === 'vehicle' ? ['day'] : ['hour'],
        fuel: category === 'vehicle' ? 'full_to_full' : 'included',
      })
      if (next.licence !== 'none' && shared.minAge < 16) onShared({ minAge: category === 'vehicle' ? 21 : 16 })
    }
    return shell(
      <>
        <Section title="What do you rent?" hint="Sets the requirements guests see and what we ask at checkout.">
          <div role="radiogroup" aria-label="What do you rent" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {RENTAL_CATEGORIES.map((entry) => {
              const Icon = CATEGORY_ICONS[entry.value]
              const on = entry.value === rental.category
              return (
                <button
                  key={entry.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pickCategory(entry.value)}
                  className={cn(
                    'flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors duration-200',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                    on ? 'border-primary bg-primary-soft/30' : 'border-line bg-surface hover:border-line-strong',
                  )}
                >
                  <Icon className={cn('mt-0.5 size-4 shrink-0', on ? 'text-primary' : 'text-faint')} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{entry.label}</span>
                    <span className="block text-xs text-subtle">{entry.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </Section>

        <Section title="How it is charged" hint="Pick one or both. Guests then choose at checkout. You set the prices per hour and per day in the Pricing step.">
          <div role="group" aria-label="How it is charged" className="grid gap-2 sm:grid-cols-2">
            {([
              ['hour', 'By the hour', 'Guests pick a start time and how many hours.'],
              ['day', 'By the day', 'Guests pick up after your opening time and return before closing, for one day or more.'],
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
                <Field label="Fewest hours" error={errors['rental.minHours']}>
                  {(control) => <Input {...control} type="number" min={1} max={12} suffix="hours" value={rental.minHours} onChange={(e) => set('rental', { minHours: num(e.target.value, 1) })} />}
                </Field>
                <Field label="Most hours" error={errors['rental.maxHours']}>
                  {(control) => <Input {...control} type="number" min={1} max={24} suffix="hours" value={rental.maxHours} onChange={(e) => set('rental', { maxHours: num(e.target.value, 1) })} />}
                </Field>
              </>
            ) : null}
            {daily ? (
              <>
                <Field label="Fewest days" error={errors['rental.minDays']}>
                  {(control) => <Input {...control} type="number" min={1} suffix="days" value={rental.minDays} onChange={(e) => set('rental', { minDays: num(e.target.value, 1) })} />}
                </Field>
                <Field label="Most days" error={errors['rental.maxDays']}>
                  {(control) => <Input {...control} type="number" min={1} max={30} suffix="days" value={rental.maxDays} onChange={(e) => set('rental', { maxDays: num(e.target.value, 1) })} />}
                </Field>
              </>
            ) : null}
          </div>
          <p className="text-xs text-subtle">
            {daily ? 'Pick-up and return times are your opening hours, set once in the Schedule step.' : 'Start times follow your opening hours in the Schedule step.'}
          </p>
        </Section>

        <Section title="Fleet" hint="How many go out at once. This is the only capacity a rental has.">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label={`${meta.units.charAt(0).toUpperCase()}${meta.units.slice(1)} available`} required error={errors['rental.units']} description="How many can be out at once.">
              {(control) => <Input {...control} type="number" min={1} value={rental.units} onChange={(e) => set('rental', { units: num(e.target.value) })} />}
            </Field>
            <Field label={`People per ${meta.unit}`} description="Riders or seats, shown to guests.">
              {(control) => <Input {...control} type="number" min={1} value={rental.seatsPerUnit} onChange={(e) => set('rental', { seatsPerUnit: num(e.target.value, 1) })} />}
            </Field>
            {byDay ? (
              <Field label={`Damage deposit (${currencySymbol})`} description={`Held per ${meta.unit}, 0 for none.`}>
                {(control) => <Input {...control} type="number" min={0} value={Math.round(rental.damageDeposit / 100)} onChange={(e) => set('rental', { damageDeposit: num(e.target.value) * 100 })} />}
              </Field>
            ) : (
              <Field label="Gap between rentals" description="Minutes for cleaning or fuel.">
                {(control) => <Input {...control} type="number" min={0} step={5} suffix="min" value={rental.bufferMinutes} onChange={(e) => set('rental', { bufferMinutes: num(e.target.value) })} />}
              </Field>
            )}
            {byDay ? null : (
              <Field label={`Damage deposit (${currencySymbol})`} description={`Held per ${meta.unit}, 0 for none.`}>
                {(control) => <Input {...control} type="number" min={0} value={Math.round(rental.damageDeposit / 100)} onChange={(e) => set('rental', { damageDeposit: num(e.target.value) * 100 })} />}
              </Field>
            )}
          </div>
        </Section>

        <Section title="Renter requirements" hint="A licence adds a licence number question to checkout.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Licence needed">
              <Select value={rental.licence} onValueChange={(value) => set('rental', { licence: value as DraftKindSettings['rental']['licence'] })}>
                <SelectTrigger aria-label="Licence needed">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LICENCE_LABEL) as (keyof typeof LICENCE_LABEL)[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {LICENCE_LABEL[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {ageField(shared, onShared, errors, rental.licence === 'none' ? 'Minimum age' : 'Minimum renter age')}
            {meta.fuel ? (
              <Field label="Fuel">
                <Select value={rental.fuel} onValueChange={(value) => set('rental', { fuel: value as DraftKindSettings['rental']['fuel'] })}>
                  <SelectTrigger aria-label="Fuel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FUEL_LABEL) as (keyof typeof FUEL_LABEL)[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {FUEL_LABEL[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            {meta.mileage ? (
              <Field label="Kilometres a day" description="Included per day. 0 means unlimited.">
                {(control) => <Input {...control} type="number" min={0} step={50} suffix="km" value={rental.kmPerDay} onChange={(e) => set('rental', { kmPerDay: num(e.target.value) })} />}
              </Field>
            ) : null}
          </div>
        </Section>
      </>,
    )
  }

  /* ---------- charter ---------- */
  if (kind === 'charter') {
    const charter = settings.charter
    const crew = crewName(charter)
    const vesselValue = charter.vessel === 'other' ? `own:${charter.vesselLabel}` : charter.vessel
    const vesselTaken = (name: string) =>
      [...CHARTER_VESSELS.map((entry) => entry.label), ...ownVessels.categories.map((entry) => entry.label)].some((entry) => entry.toLowerCase() === name.trim().toLowerCase())
    const vesselProblem = vesselDraft.name.trim().length < 2 ? 'Give it a name' : vesselTaken(vesselDraft.name) ? 'That one is already on the list' : null
    const addVessel = () => {
      if (vesselProblem) return
      const label = vesselDraft.name.trim()
      const crewWord = vesselDraft.crew.trim() || 'Crew'
      ownVessels.add({ label, hint: crewWord })
      set('charter', { vessel: 'other', vesselLabel: label, crewLabel: crewWord })
      setAddingVessel(false)
      setVesselDraft({ name: '', crew: '' })
    }
    return shell(
      <>
        <Section title="What is chartered">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Chartered">
              <Select
                value={vesselValue}
                onValueChange={(value) => {
                  if (value === '__new') return setAddingVessel(true)
                  if (value.startsWith('own:')) {
                    const label = value.slice(4)
                    const entry = ownVessels.categories.find((item) => item.label === label)
                    return set('charter', { vessel: 'other', vesselLabel: label, crewLabel: entry?.hint || charter.crewLabel || 'Crew' })
                  }
                  set('charter', { vessel: value as DraftKindSettings['charter']['vessel'], vesselLabel: '', crewLabel: '' })
                }}
              >
                <SelectTrigger aria-label="What is chartered">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHARTER_VESSELS.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value} description={`${entry.crew} included`}>
                      {entry.label}
                    </SelectItem>
                  ))}
                  {ownVessels.categories.map((entry) => (
                    <SelectItem key={entry.label} value={`own:${entry.label}`} description={`Yours · ${entry.hint || 'Crew'} included`}>
                      {entry.label}
                    </SelectItem>
                  ))}
                  {charter.vessel === 'other' && charter.vesselLabel && !ownVessels.categories.some((entry) => entry.label === charter.vesselLabel) ? (
                    <SelectItem value={`own:${charter.vesselLabel}`}>{charter.vesselLabel}</SelectItem>
                  ) : null}
                  <SelectItem value="__new" description="A boat, vehicle or service not listed">
                    + Add your own
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="sm:self-end">
              <Toggle
                label={`${crew} included`}
                hint="Turn off for a bare-boat or self-drive hire."
                checked={charter.crewed}
                onChange={(crewed) => set('charter', { crewed })}
              />
            </div>
          </div>
          {addingVessel ? (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary-soft/20 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="What you charter" required error={vesselDraft.name && vesselProblem ? vesselProblem : undefined}>
                  {(control) => <Input {...control} autoFocus value={vesselDraft.name} placeholder="Glass-bottom boat" onChange={(e) => setVesselDraft((d) => ({ ...d, name: e.target.value.slice(0, 40) }))} />}
                </Field>
                <Field label="Who comes with it" optional description="Shown as “… included”.">
                  {(control) => <Input {...control} value={vesselDraft.crew} placeholder="Skipper and deckhand" onChange={(e) => setVesselDraft((d) => ({ ...d, crew: e.target.value.slice(0, 40) }))} />}
                </Field>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" disabled={Boolean(vesselProblem)} onClick={addVessel}>
                  Add
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setAddingVessel(false); setVesselDraft({ name: '', crew: '' }) }}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}
        </Section>

        <Section title="The group" hint="One group per charter. The price is for the whole group.">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Most guests" required error={errors['charter.maxGuests']} description="The boat, vehicle or guide's limit.">
              {(control) => <Input {...control} type="number" min={1} value={charter.maxGuests} onChange={(e) => set('charter', { maxGuests: num(e.target.value) })} />}
            </Field>
            <Field label="Fewest guests" error={errors.minParticipants} description="Below this, you do not go out.">
              {(control) => <Input {...control} type="number" min={1} value={shared.minParticipants} onChange={(e) => onShared({ minParticipants: num(e.target.value, 1) })} />}
            </Field>
            <Field label="Notice needed" description="Hours before it can start.">
              {(control) => <Input {...control} type="number" min={0} suffix="hours" value={charter.noticeHours} onChange={(e) => set('charter', { noticeHours: num(e.target.value) })} />}
            </Field>
            {ageField(shared, onShared, errors)}
          </div>
        </Section>

        <Section title="How long it runs">
          <DurationField
            label="Charter length"
            error={errors.durationMinutes}
            description="The usual length. Say in the description if guests can book longer."
            minutes={shared.durationMinutes}
            unit={shared.durationUnit === 'minutes' ? 'hours' : shared.durationUnit}
            onChange={(durationMinutes, durationUnit) => onShared({ durationMinutes, durationUnit })}
            presets={[120, 180, 240, 360, 480, 1440]}
            allowFlexible={false}
          />
        </Section>

        <Section title="Booking and guiding">
          <Toggle
            label="Request to book"
            hint="Guests send their plan and you reply with a quote and a payment link, instead of paying on the spot."
            checked={charter.requestToBook}
            onChange={(requestToBook) => set('charter', { requestToBook })}
          />
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Languages on board</p>
            <LanguagePicker value={shared.languages} onChange={(languages) => onShared({ languages })} />
          </div>
        </Section>
      </>,
    )
  }

  /* ---------- lesson ---------- */
  if (kind === 'lesson') {
    const lesson = settings.lesson
    return shell(
      <>
        <Section title="The course">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Level" description="Replaces difficulty for lessons.">
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
            <Field label="Sessions" required error={errors['lesson.sessions']} description="1 for a single lesson. Courses run on consecutive days.">
              {(control) => <Input {...control} type="number" min={1} max={14} value={lesson.sessions} onChange={(e) => set('lesson', { sessions: num(e.target.value) })} />}
            </Field>
          </div>
          <DurationField
            label={lesson.sessions > 1 ? 'Each session lasts' : 'Lesson length'}
            error={errors.durationMinutes}
            minutes={shared.durationMinutes}
            unit={shared.durationUnit === 'days' ? 'hours' : shared.durationUnit}
            onChange={(durationMinutes, durationUnit) => onShared({ durationMinutes, durationUnit })}
            presets={[45, 60, 90, 120, 180, 240]}
            allowFlexible={false}
          />
        </Section>

        <Section title="Class size" hint="Places sold in each class. The schedule step uses this number.">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Students per class" required error={errors.maxCapacity}>
              {(control) => <Input {...control} type="number" min={1} value={shared.maxCapacity || ''} placeholder="8" onChange={(e) => onShared({ maxCapacity: num(e.target.value) })} />}
            </Field>
            <Field label="Students per instructor" required error={errors['lesson.ratio']}>
              {(control) => <Input {...control} type="number" min={1} value={lesson.ratio} onChange={(e) => set('lesson', { ratio: num(e.target.value) })} />}
            </Field>
            <Field label="Fewest to run" error={errors.minParticipants} description="Below this, the class is cancelled.">
              {(control) => <Input {...control} type="number" min={1} value={shared.minParticipants} onChange={(e) => onShared({ minParticipants: num(e.target.value, 1) })} />}
            </Field>
            {ageField(shared, onShared, errors)}
          </div>
        </Section>

        <Section title="What students get">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Certificate earned" optional>
              {(control) => <Input {...control} placeholder="PADI Open Water, AIDA 2…" value={lesson.certification} onChange={(e) => set('lesson', { certification: e.target.value })} />}
            </Field>
            <div className="sm:self-end">
              <Toggle label="Equipment included" hint="Board, wetsuit or gear is part of the price." checked={lesson.equipmentIncluded} onChange={(equipmentIncluded) => set('lesson', { equipmentIncluded })} />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Taught in</p>
            <LanguagePicker value={shared.languages} onChange={(languages) => onShared({ languages })} />
          </div>
        </Section>
      </>,
    )
  }

  /* ---------- pass ---------- */
  const pass = settings.pass
  return shell(
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Valid for" description="Days from the date the guest picks.">
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
      <Field label="Tickets per day" error={errors.maxCapacity} description="Leave it empty for no limit.">
        {(control) => <Input {...control} type="number" min={1} value={shared.maxCapacity || ''} placeholder="No limit" suffix="tickets" onChange={(e) => onShared({ maxCapacity: num(e.target.value) })} />}
      </Field>
      {ageField(shared, onShared, errors)}
      <div className="sm:self-end">
        <Toggle label="Re-entry allowed" hint="Guests can leave and come back the same day." checked={pass.reentry} onChange={(reentry) => set('pass', { reentry })} />
      </div>
    </div>,
  )
}

/* ==========================================================================
   RENTAL RATES — the Pricing step for a rental: what can be rented, and
   what each costs per hour and per day. Replaces price tiers.
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
  const meta = rentalCategoryMeta(rental.category)
  const hourly = rental.modes.includes('hour')
  const daily = rental.modes.includes('day')
  const rateOf = (tier: DraftTier) => rental.rates[tier.id] ?? { hour: tier.price, day: Math.round((tier.price * 4) / 500) * 500 }
  const setRate = (tier: DraftTier, patch: Partial<{ hour: number; day: number }>) =>
    onSettings({ ...settings, rental: { ...rental, rates: { ...rental.rates, [tier.id]: { ...rateOf(tier), ...patch } } } })
  const money = (value: string) => Math.max(0, Math.round(Number(value) * 100) || 0)
  const cols = cn('grid gap-3 sm:items-center', hourly && daily ? 'sm:grid-cols-[minmax(0,1.6fr)_8rem_8rem_7rem_2rem] sm:items-end' : 'sm:grid-cols-[minmax(0,1.6fr)_9rem_7rem_2rem] sm:items-end')

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex list-none flex-col gap-2 p-0">
        {tiers.map((tier, index) => {
          const rate = rateOf(tier)
          return (
            <li key={tier.id} className={cn(cols, 'rounded-xl border border-line bg-surface p-3')}>
              <Field label="What you rent" labelSize="sm" error={errors[`tiers.${index}.label`]}>
                {(control) => <Input {...control} value={tier.label} placeholder={meta.value === 'vehicle' ? 'Jeep Wrangler 4-door' : meta.value === 'watercraft' ? 'WaveRunner VX' : meta.value === 'bike' ? 'E-bike' : 'Single kayak'} onChange={(e) => onTiers(tiers.map((entry) => (entry.id === tier.id ? { ...entry, label: e.target.value } : entry)))} />}
              </Field>
              {hourly ? (
                <Field label="Per hour" labelSize="sm" error={errors[`rate.${tier.id}.hour`]}>
                  {(control) => <Input {...control} type="number" min={0} leftIcon={<span className="text-sm font-medium">{currencySymbol}</span>} value={rate.hour / 100 || ''} onChange={(e) => setRate(tier, { hour: money(e.target.value) })} />}
                </Field>
              ) : null}
              {daily ? (
                <Field label="Per day" labelSize="sm" error={errors[`rate.${tier.id}.day`]}>
                  {(control) => <Input {...control} type="number" min={0} leftIcon={<span className="text-sm font-medium">{currencySymbol}</span>} value={rate.day / 100 || ''} onChange={(e) => setRate(tier, { day: money(e.target.value) })} />}
                </Field>
              ) : null}
              <Field label="Max per booking" labelSize="sm" optional>
                {(control) => (
                  <Input
                    {...control}
                    type="number"
                    min={1}
                    placeholder="No limit"
                    value={tier.maxQuantity >= 99 ? '' : tier.maxQuantity}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10)
                      onTiers(tiers.map((entry) => (entry.id === tier.id ? { ...entry, maxQuantity: Number.isFinite(parsed) && parsed > 0 ? parsed : 99 } : entry)))
                    }}
                  />
                )}
              </Field>
              <button
                type="button"
                aria-label={`Remove ${tier.label || 'this item'}`}
                disabled={tiers.length === 1}
                onClick={() => onTiers(tiers.filter((entry) => entry.id !== tier.id))}
                className="grid size-8 place-items-center justify-self-end rounded-lg text-faint hover:bg-surface-sunken hover:text-danger disabled:opacity-30"
              >
                ×
              </button>
            </li>
          )
        })}
      </ul>
      <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => onTiers([...tiers, newTier('')])}>
        + Add another {meta.unit}
      </Button>
      <p className="text-xs text-subtle">
        Guests pick what to rent, then {hourly && daily ? 'hours or days' : hourly ? 'how many hours' : 'how many days'}. The price is per {meta.unit}
        {hourly && daily ? ', and the day rate shows as the better deal for long rentals.' : '.'}
      </p>
    </div>
  )
}
