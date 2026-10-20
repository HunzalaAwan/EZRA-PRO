'use client'

import * as React from 'react'
import { Anchor, Bike, Car, DoorOpen, GraduationCap, KeyRound, Layers, Package, Route, Ship, Ticket, Zap, type LucideIcon } from 'lucide-react'

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
  LESSON_LEVELS,
  RENTAL_CATEGORIES,
  rentalCategoryMeta,
} from '@/lib/activity-kinds'
import { cn } from '@/lib/utils'
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
  package: Layers,
}

const CATEGORY_ICONS: Record<RentalCategory, LucideIcon> = {
  watercraft: Ship,
  vehicle: Car,
  bike: Bike,
  gear: Package,
  space: DoorOpen,
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
    /** Per tier: price per hour and per day, and per set length, minor units. */
    rates: Record<string, { hour: number; day: number; lengths?: Record<string, number> }>
    /** Per tier: its own stock, how many people one fits, its deposit. */
    items: Record<string, DraftRentalItem>
    /** Charged per hour late, minor units. */
    lateFee: number
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
      lengths: [],
      items: {},
      lateFee: 0,
      licence: 'none',
      fuel: 'included',
      kmPerDay: 0,
    },
    charter: { maxGuests: 6, requestToBook: false, noticeHours: 24, vessel: 'boat', vesselLabel: '', crewLabel: '', crewed: true, minutes: {} },
    // Not asked in setup any more: a new lesson or pass claims none of these on the storefront.
    lesson: { level: 'beginner', sessions: 1, ratio: 0, certification: '', equipmentIncluded: false },
    pass: { validDays: 1, reentry: false },
    activity: { minHeightCm: 0, maxWeightKg: 0 },
  }
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
    rental: { ...base.rental, ...settings?.rental },
    charter: { ...base.charter, ...settings?.charter },
    lesson: { ...base.lesson, ...settings?.lesson },
    pass: { ...base.pass, ...settings?.pass },
    activity: { ...base.activity, ...settings?.activity },
  }
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
 */
export interface SharedBasics {
  maxCapacity: number
  minParticipants: number
  durationMinutes: number
  durationUnit: DurationUnit
  difficulty: DifficultyLevel
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

/** One small on/off with its label beside it. */
function InlineSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex h-10 cursor-pointer items-center gap-2.5 text-sm font-medium text-foreground">
      <Switch size="sm" checked={checked} onCheckedChange={onChange} aria-label={label} />
      {label}
    </label>
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
   limits for each and the late return fee. Lives with the prices on the
   Pricing step; the item rates themselves are in RentalRatesEditor.
   ========================================================================== */

export function RentalChargingFields({
  settings: raw,
  onSettings,
  currencySymbol,
  errors,
}: {
  settings: DraftKindSettings
  onSettings: (settings: DraftKindSettings) => void
  currencySymbol: string
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
        ? { lengths: [{ id: 'len_4', label: 'Up to 4 hours', hours: 4 }, { id: 'len_8', label: 'Up to 8 hours', hours: 8 }] }
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Field label={`Late return fee (${currencySymbol})`} optional description="Per hour late.">
          {(control) => <Input {...control} type="number" min={0} placeholder="None" value={rental.lateFee ? Math.round(rental.lateFee / 100) : ''} onChange={(e) => set({ lateFee: num(e.target.value) * 100 })} />}
        </Field>
      </div>
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
  tenantSlug = '',
}: {
  /** For the business's own charter types. */
  tenantSlug?: string
  kind: ActivityKind
  settings: DraftKindSettings
  onChange: (settings: DraftKindSettings) => void
  /** Not read here any more; kept so callers need not change. */
  tiers?: DraftTier[]
  /** Not read here any more: the late return fee moved to RentalChargingFields. */
  currencySymbol?: string
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
    return shell(
      <>
        <DurationField
          label="Each time slot lasts"
          error={errors.durationMinutes}
          minutes={shared.durationMinutes}
          unit={shared.durationUnit === 'days' ? 'minutes' : shared.durationUnit}
          onChange={(durationMinutes, durationUnit) => onShared({ durationMinutes, durationUnit })}
          presets={[15, 30, 45, 60, 90, 120]}
          allowFlexible={false}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Spots per time slot" required error={errors.maxCapacity}>
            {(control) => <Input {...control} type="number" min={1} value={shared.maxCapacity || ''} placeholder="8" onChange={(e) => onShared({ maxCapacity: num(e.target.value) })} />}
          </Field>
          <DifficultyField value={shared.difficulty} onChange={(difficulty) => onShared({ difficulty })} />
        </div>
      </>,
    )
  }

  /* ---------- rental ---------- */
  if (kind === 'rental') {
    const rental = settings.rental
    const pickCategory = (category: RentalCategory) => {
      const next = rentalCategoryMeta(category)
      set('rental', {
        category,
        seatsPerUnit: next.seatsPerUnit,
        billing: next.billing,
        modes: category === 'vehicle' ? ['day'] : ['hour'],
      })
    }
    return shell(
      <>
        <Section title="What do you rent?">
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

        <Section title="Between rentals" hint="Items, how they are charged and prices are on the Pricing step.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gap between rentals" optional description="To clean, check or refuel.">
              {(control) => <Input {...control} type="number" min={0} step={5} suffix="min" placeholder="None" value={rental.bufferMinutes || ''} onChange={(e) => set('rental', { bufferMinutes: num(e.target.value) })} />}
            </Field>
          </div>
        </Section>
      </>,
    )
  }

  /* ---------- charter ---------- */
  if (kind === 'charter') {
    const charter = settings.charter
    const vesselValue = charter.vessel === 'other' ? `own:${charter.vesselLabel}` : charter.vessel
    const vesselTaken = (name: string) =>
      [...CHARTER_VESSELS.map((entry) => entry.label), ...ownVessels.categories.map((entry) => entry.label)].some((entry) => entry.toLowerCase() === name.trim().toLowerCase())
    const vesselProblem = vesselDraft.name.trim().length < 2 ? 'Give it a name' : vesselTaken(vesselDraft.name) ? 'That one is already on the list' : null
    const addVessel = () => {
      if (vesselProblem) return
      const label = vesselDraft.name.trim()
      const crewWord = vesselDraft.crew.trim() || 'Team'
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
                    return set('charter', { vessel: 'other', vesselLabel: label, crewLabel: entry?.hint || charter.crewLabel || 'Team' })
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
                    <SelectItem key={entry.label} value={`own:${entry.label}`} description={`Yours · ${entry.hint || 'Team'} included`}>
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
              <InlineSwitch label="Comes with a captain or driver" checked={charter.crewed} onChange={(crewed) => set('charter', { crewed })} />
            </div>
          </div>
          {addingVessel ? (
            <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary-soft/20 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="What you charter" required error={vesselDraft.name && vesselProblem ? vesselProblem : undefined}>
                  {(control) => <Input {...control} autoFocus value={vesselDraft.name} placeholder="Glass-bottom boat" onChange={(e) => setVesselDraft((d) => ({ ...d, name: e.target.value.slice(0, 40) }))} />}
                </Field>
                <Field label="Who comes with it" optional description="Shown as “… included”.">
                  {(control) => <Input {...control} value={vesselDraft.crew} placeholder="Driver and guide" onChange={(e) => setVesselDraft((d) => ({ ...d, crew: e.target.value.slice(0, 40) }))} />}
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

        <Section title="The group" hint="One group per charter.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Most guests" required error={errors['charter.maxGuests']}>
              {(control) => <Input {...control} type="number" min={1} value={charter.maxGuests} onChange={(e) => set('charter', { maxGuests: num(e.target.value) })} />}
            </Field>
            <Field label="Fewest guests" error={errors.minParticipants}>
              {(control) => <Input {...control} type="number" min={1} value={shared.minParticipants} onChange={(e) => onShared({ minParticipants: num(e.target.value, 1) })} />}
            </Field>
          </div>
        </Section>

        <Section title="How long it lasts">
          <DurationField
            label="Charter length"
            error={errors.durationMinutes}
            minutes={shared.durationMinutes}
            unit={shared.durationUnit === 'minutes' ? 'hours' : shared.durationUnit}
            onChange={(durationMinutes, durationUnit) => onShared({ durationMinutes, durationUnit })}
            presets={[120, 180, 240, 360, 480, 1440]}
            allowFlexible={false}
          />
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
            label={lesson.sessions > 1 ? "Each day's lesson lasts" : 'Lesson length'}
            error={errors.durationMinutes}
            minutes={shared.durationMinutes}
            unit={shared.durationUnit === 'days' ? 'hours' : shared.durationUnit}
            onChange={(durationMinutes, durationUnit) => onShared({ durationMinutes, durationUnit })}
            presets={[45, 60, 90, 120, 180, 240]}
            allowFlexible={false}
          />
        </Section>

        <Section title="Class size">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Students per class" required error={errors.maxCapacity}>
              {(control) => <Input {...control} type="number" min={1} value={shared.maxCapacity || ''} placeholder="8" onChange={(e) => onShared({ maxCapacity: num(e.target.value) })} />}
            </Field>
            <Field label="Fewest to go ahead" error={errors.minParticipants}>
              {(control) => <Input {...control} type="number" min={1} value={shared.minParticipants} onChange={(e) => onShared({ minParticipants: num(e.target.value, 1) })} />}
            </Field>
          </div>
        </Section>
      </>,
    )
  }

  /* ---------- pass ---------- */
  const pass = settings.pass
  return shell(
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
      <Field label="Tickets per day" required error={errors.maxCapacity} description="Shared by the day's time slots.">
        {(control) => <Input {...control} type="number" min={1} value={shared.maxCapacity || ''} placeholder="60" suffix="tickets" onChange={(e) => onShared({ maxCapacity: num(e.target.value) })} />}
      </Field>
    </div>,
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
  const meta = rentalCategoryMeta(rental.category)
  const hourly = rental.modes.includes('hour')
  const daily = rental.modes.includes('day')
  const rateOf = (tier: DraftTier) => rental.rates[tier.id] ?? { hour: tier.price, day: Math.round((tier.price * 4) / 500) * 500 }
  const byLength = rental.modes.includes('length')
  const setRate = (tier: DraftTier, patch: Partial<{ hour: number; day: number; lengths: Record<string, number> }>) =>
    onSettings({ ...settings, rental: { ...rental, rates: { ...rental.rates, [tier.id]: { ...rateOf(tier), ...patch } } } })
  const setItem = (tierId: string, patch: Partial<DraftRentalItem>) =>
    onSettings({ ...settings, rental: { ...rental, items: { ...rental.items, [tierId]: { ...draftItemOf(rental, tierId), ...patch } } } })
  const setTier = (tierId: string, patch: Partial<DraftTier>) => onTiers(tiers.map((entry) => (entry.id === tierId ? { ...entry, ...patch } : entry)))
  const money = (value: string) => Math.max(0, Math.round(Number(value) * 100) || 0)
  const whole = (value: string, least = 0) => Math.max(least, Number.parseInt(value, 10) || 0)
  const stock = tiers.reduce((sum, tier) => sum + draftItemOf(rental, tier.id).stock, 0)
  const people = tiers.reduce((sum, tier) => sum + draftItemOf(rental, tier.id).stock * draftItemOf(rental, tier.id).holds, 0)
  const examples: Record<string, string> = {
    gear: 'Single kayak',
    watercraft: 'Pontoon boat',
    vehicle: 'Compact car',
    bike: 'City e-bike',
    space: 'Meeting room',
  }

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
                    {(control) => <Input {...control} value={tier.label} placeholder={examples[meta.value] ?? 'Item name'} onChange={(e) => setTier(tier.id, { label: e.target.value })} />}
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
                <Field label="People per item" labelSize="sm">
                  {(control) => <Input {...control} type="number" min={1} suffix={item.holds === 1 ? 'person' : 'people'} value={item.holds || ''} onChange={(e) => setItem(tier.id, { holds: whole(e.target.value, 1) })} />}
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
