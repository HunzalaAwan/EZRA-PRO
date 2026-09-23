'use client'

import * as React from 'react'
import { Anchor, Bike, Car, GraduationCap, KeyRound, Package, Route, Ship, Ticket, type LucideIcon } from 'lucide-react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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
  rentalCategoryMeta,
} from '@/lib/activity-kinds'
import { cn, formatDuration } from '@/lib/utils'
import type { ActivityKind, CharterConfig, LessonConfig, RentalCategory, RentalConfig } from '@/types'

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
    licence: NonNullable<RentalConfig['licence']>
    fuel: NonNullable<RentalConfig['fuel']>
    kmPerDay: number
  }
  charter: {
    maxGuests: number
    requestToBook: boolean
    noticeHours: number
    vessel: NonNullable<CharterConfig['vessel']>
    crewed: boolean
    minutes: Record<string, number>
  }
  lesson: { level: LessonConfig['level']; sessions: number; ratio: number; certification: string; equipmentIncluded: boolean }
  pass: { validDays: number; reentry: boolean }
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
      licence: 'none',
      fuel: 'included',
      kmPerDay: 0,
    },
    charter: { maxGuests: 6, requestToBook: false, noticeHours: 24, vessel: 'boat', crewed: true, minutes: {} },
    lesson: { level: 'beginner', sessions: 1, ratio: 4, certification: '', equipmentIncluded: true },
    pass: { validDays: 1, reentry: true },
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
  }
}

/** The numbers every activity carries, edited from inside a kind's card. */
export interface SharedBasics {
  maxCapacity: number
  minParticipants: number
  minAge: number
  durationMinutes: number
  durationUnit: DurationUnit
  languages: string[]
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

const CHARTER_LENGTHS = [60, 120, 150, 180, 240, 360, 480, 1440]

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
}: {
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
  const set = <K extends keyof DraftKindSettings>(key: K, patch: Partial<DraftKindSettings[K]>) =>
    onChange({ ...settings, [key]: { ...settings[key], ...patch } })

  if (kind === 'trip') return null

  const shell = (children: React.ReactNode) => (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface-sunken/40 p-4">
      <p className="text-[0.8125rem] font-medium">{ACTIVITY_KIND_META[kind].label} settings</p>
      {children}
    </div>
  )

  /* ---------- rental ---------- */
  if (kind === 'rental') {
    const rental = settings.rental
    const meta = rentalCategoryMeta(rental.category)
    const byDay = rental.billing === 'day'
    const pickCategory = (category: RentalCategory) => {
      const next = rentalCategoryMeta(category)
      set('rental', {
        category,
        licence: next.licence,
        seatsPerUnit: next.seatsPerUnit,
        billing: next.billing,
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

        <Section title="How it is charged">
          <Segmented
            label="How it is charged"
            value={rental.billing}
            onChange={(billing) => set('rental', { billing })}
            options={[
              { value: 'length', label: 'By length', hint: 'Guests pick 1 hour, 2 hours, a half day. Each price tier is one length.' },
              { value: 'day', label: 'By the day', hint: 'Guests pick a pick-up day and how many days. Each price tier is a model, priced per day.' },
            ]}
          />
          {byDay ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Pick-up time">
                {(control) => <Input {...control} type="time" value={rental.pickupTime} onChange={(e) => set('rental', { pickupTime: e.target.value })} />}
              </Field>
              <Field label="Return time">
                {(control) => <Input {...control} type="time" value={rental.returnTime} onChange={(e) => set('rental', { returnTime: e.target.value })} />}
              </Field>
              <Field label="Fewest days" error={errors['rental.minDays']}>
                {(control) => <Input {...control} type="number" min={1} suffix="days" value={rental.minDays} onChange={(e) => set('rental', { minDays: num(e.target.value, 1) })} />}
              </Field>
              <Field label="Most days" error={errors['rental.maxDays']}>
                {(control) => <Input {...control} type="number" min={1} max={30} suffix="days" value={rental.maxDays} onChange={(e) => set('rental', { maxDays: num(e.target.value, 1) })} />}
              </Field>
            </div>
          ) : (
            <>
              <p className="text-xs text-subtle">Match each price tier from the Pricing step to its length.</p>
              <TierLengths
                tiers={tiers}
                minutes={rental.minutes}
                options={RENTAL_LENGTHS.map((entry) => entry.minutes)}
                fallback={60}
                onChange={(minutes) => set('rental', { minutes })}
                labelFor={(minutes) => RENTAL_LENGTHS.find((entry) => entry.minutes === minutes)?.label ?? formatDuration(minutes)}
              />
            </>
          )}
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
    const crew = CHARTER_VESSELS.find((entry) => entry.value === charter.vessel)?.crew ?? 'Crew'
    return shell(
      <>
        <Section title="What is chartered">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Chartered">
              <Select value={charter.vessel} onValueChange={(value) => set('charter', { vessel: value as DraftKindSettings['charter']['vessel'] })}>
                <SelectTrigger aria-label="What is chartered">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHARTER_VESSELS.map((entry) => (
                    <SelectItem key={entry.value} value={entry.value}>
                      {entry.label}
                    </SelectItem>
                  ))}
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

        <Section title="Charter options" hint="Each price tier from the Pricing step is one option. Set how long each runs.">
          <TierLengths
            tiers={tiers}
            minutes={charter.minutes}
            options={CHARTER_LENGTHS}
            fallback={180}
            onChange={(minutes) => set('charter', { minutes })}
            labelFor={(minutes) => (minutes === 1440 ? 'Full day' : formatDuration(minutes))}
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
