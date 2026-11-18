'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FUEL_LABEL, LICENCE_LABEL, rentalCategoryMeta } from '@/lib/activity-kinds'
import { cn } from '@/lib/utils'
import type { RentalConfig } from '@/types'

import { normalizeKindSettings, type DraftDistance, type DraftKindSettings, type DraftOperator, type DraftPlan } from './kind-fields'

/* ==========================================================================
   RENTAL TERMS — what comes with a rental and what guests can add, on the
   Pricing step under the items: who drives, distance, fuel, licence and
   drivers, cover, delivery and returns, late returns. Each card shows for
   the rentals it fits (a car asks about distance, a kayak doesn't); one
   already set always shows. Saved by `rentalTermsOfDraft`.
   ========================================================================== */

type DraftRental = DraftKindSettings['rental']

const whole = (value: string, least = 0) => Math.max(least, Number.parseInt(value, 10) || 0)
const money = (value: string) => Math.max(0, Math.round(Number(value) * 100) || 0)

const DISTANCE_UNITS: { value: DraftDistance['unit']; label: string; one: string }[] = [
  { value: 'mi', label: 'Miles', one: 'mile' },
  { value: 'km', label: 'Kilometres', one: 'km' },
  { value: 'hours', label: 'Engine hours', one: 'engine hour' },
]

function Card({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3 rounded-xl border border-line bg-surface p-4', className)}>
      <div>
        <h4 className="text-[0.8125rem] font-semibold text-foreground">{title}</h4>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

/** A row of small pill choices. */
function Pills<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
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
              'inline-flex h-8 items-center rounded-full border px-3 text-[0.8125rem] font-medium transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
              on ? 'border-primary/50 bg-primary-soft text-primary' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function SwitchRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="block text-xs text-subtle">{hint}</span> : null}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  )
}

export function RentalTermsEditor({
  settings: raw,
  onSettings,
  currencySymbol,
  errors,
  locationCount = 1,
}: {
  settings: DraftKindSettings
  onSettings: (settings: DraftKindSettings) => void
  currencySymbol: string
  errors: Record<string, string>
  /** Where it runs from: a one-way return needs two or more. */
  locationCount?: number
}) {
  const settings = normalizeKindSettings(raw)
  const r = settings.rental
  const set = (patch: Partial<DraftRental>) => onSettings({ ...settings, rental: { ...r, ...patch } })
  const meta = rentalCategoryMeta(r.category)
  const boat = r.category === 'watercraft'
  const cash = (value: number) => (value ? value / 100 : '')
  const sym = <span className="text-sm font-medium">{currencySymbol}</span>

  // Every card shows for every rental; each has its own "not used" setting. Drivers hide when the driver comes with it.
  const showDrivers = r.operator.mode !== 'included'
  const operatorWord = r.operator.label.trim() || meta.operator.label
  const unit = DISTANCE_UNITS.find((entry) => entry.value === r.distance.unit) ?? DISTANCE_UNITS[0]

  const setOperator = (patch: Partial<DraftOperator>) => set({ operator: { ...r.operator, ...patch } })
  const setDistance = (patch: Partial<DraftDistance>) => set({ distance: { ...r.distance, ...patch } })
  const setRenters = (patch: Partial<DraftRental['renters']>) => set({ renters: { ...r.renters, ...patch } })
  const setPlans = (plans: DraftPlan[]) => set({ protection: { ...r.protection, plans } })
  const setPlan = (id: string, patch: Partial<DraftPlan>) => setPlans(r.protection.plans.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)))

  return (
    <div className="flex flex-col gap-3">
      {(
        <Card title="Who drives" hint={boat ? 'Or skippers, or operates it.' : undefined}>
          <Pills
            label="Who drives"
            value={r.operator.mode}
            onChange={(mode) => setOperator({ mode })}
            options={[
              { value: 'renter', label: 'The renter' },
              { value: 'included', label: `Our ${operatorWord.toLowerCase()}, included` },
              { value: 'optional', label: 'Guests can add one' },
            ]}
          />
          {r.operator.mode === 'renter' ? null : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Called" labelSize="sm">
                {(control) => <Input {...control} value={r.operator.label} placeholder="Driver" onChange={(e) => setOperator({ label: e.target.value })} />}
              </Field>
              {r.operator.mode === 'optional' ? (
                <>
                  <Field label="Price" labelSize="sm" error={errors['rental.operator.price']}>
                    {(control) => <Input {...control} type="number" min={0} leftIcon={sym} value={cash(r.operator.price)} onChange={(e) => setOperator({ price: money(e.target.value) })} />}
                  </Field>
                  <Field label="Per" labelSize="sm">
                    <Select value={r.operator.per} onValueChange={(per) => setOperator({ per: per as DraftOperator['per'] })}>
                      <SelectTrigger aria-label="Driver priced per">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hour">Hour</SelectItem>
                        <SelectItem value="day">Day</SelectItem>
                        <SelectItem value="rental">Rental</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              ) : (
                <p className="self-end pb-2 text-xs text-subtle sm:col-span-2">In your prices. Guests need no licence.</p>
              )}
            </div>
          )}
        </Card>
      )}

      {(
        <Card title={r.distance.unit === 'hours' ? 'Engine hours' : 'Distance'} hint="Charged when it comes back, from the reading.">
          <Pills
            label="Distance"
            value={r.distance.mode}
            onChange={(mode) => setDistance({ mode })}
            options={[
              { value: 'unlimited', label: 'Unlimited' },
              { value: 'allowance', label: 'So many a day' },
              { value: 'every', label: 'Every one charged' },
              { value: 'none', label: 'Don’t mention' },
            ]}
          />
          {r.distance.mode === 'none' ? null : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Counted in" labelSize="sm">
                <Select value={r.distance.unit} onValueChange={(next) => setDistance({ unit: next as DraftDistance['unit'] })}>
                  <SelectTrigger aria-label="Counted in">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DISTANCE_UNITS.map((entry) => (
                      <SelectItem key={entry.value} value={entry.value}>
                        {entry.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {r.distance.mode === 'allowance' ? (
                <Field label="Included a day" labelSize="sm" error={errors['rental.distance.perDay']}>
                  {(control) => <Input {...control} type="number" min={1} suffix={r.distance.unit === 'hours' ? 'hours' : r.distance.unit} value={r.distance.perDay || ''} onChange={(e) => setDistance({ perDay: whole(e.target.value) })} />}
                </Field>
              ) : null}
              {r.distance.mode === 'allowance' || r.distance.mode === 'every' ? (
                <Field label={`Each ${unit.one}${r.distance.mode === 'allowance' ? ' over' : ''}`} labelSize="sm" error={errors['rental.distance.extra']}>
                  {(control) => <Input {...control} type="number" min={0} step="0.01" leftIcon={sym} value={cash(r.distance.extra)} onChange={(e) => setDistance({ extra: money(e.target.value) })} />}
                </Field>
              ) : null}
            </div>
          )}
        </Card>
      )}

      {(
        <Card title={r.category === 'bike' || r.category === 'motorbike' ? 'Fuel or charge' : 'Fuel'}>
          <Pills
            label="Fuel"
            value={r.fuel}
            onChange={(fuel) => set({ fuel })}
            options={[{ value: 'none' as const, label: 'Doesn’t apply' }, ...(Object.keys(FUEL_LABEL) as NonNullable<RentalConfig['fuel']>[]).map((value) => ({ value, label: FUEL_LABEL[value] }))]}
          />
        </Card>
      )}

      {showDrivers ? (
        <Card title={boat ? 'Licence and skippers' : 'Licence and drivers'}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Licence" labelSize="sm">
              <Select value={r.licence} onValueChange={(licence) => set({ licence: licence as DraftRental['licence'] })}>
                <SelectTrigger aria-label="Licence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(LICENCE_LABEL) as DraftRental['licence'][]).map((value) => (
                    <SelectItem key={value} value={value}>
                      {LICENCE_LABEL[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Held for at least" labelSize="sm" optional>
              {(control) => <Input {...control} type="number" min={0} max={20} suffix="years" placeholder="Any" value={r.renters.licenceYears || ''} onChange={(e) => setRenters({ licenceYears: whole(e.target.value) })} />}
            </Field>
            <Field label="Youngest" labelSize="sm" optional>
              {(control) => <Input {...control} type="number" min={0} max={99} suffix="years" placeholder="Any" value={r.renters.minAge || ''} onChange={(e) => setRenters({ minAge: whole(e.target.value) })} />}
            </Field>
          </div>
          <div className="grid gap-3 border-t border-line-subtle pt-3 sm:grid-cols-2">
            <Field label="Young driver fee if under" labelSize="sm" optional>
              {(control) => <Input {...control} type="number" min={0} max={99} suffix="years" placeholder="None" value={r.renters.youngUnder || ''} onChange={(e) => setRenters({ youngUnder: whole(e.target.value) })} />}
            </Field>
            {r.renters.youngUnder > 0 ? (
              <Field label="Young driver fee a day" labelSize="sm" error={errors['rental.youngFee']}>
                {(control) => <Input {...control} type="number" min={0} leftIcon={sym} value={cash(r.renters.youngFee)} onChange={(e) => setRenters({ youngFee: money(e.target.value) })} />}
              </Field>
            ) : null}
          </div>
          <div className="flex flex-col gap-3 border-t border-line-subtle pt-3">
            <SwitchRow label="Extra drivers" hint="Guests add them at checkout." checked={r.renters.extraDrivers} onChange={(extraDrivers) => setRenters({ extraDrivers })} />
            {r.renters.extraDrivers ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Each, a day" labelSize="sm" optional description="Empty for free.">
                  {(control) => <Input {...control} type="number" min={0} placeholder="Free" leftIcon={sym} value={cash(r.renters.extraDriverFee)} onChange={(e) => setRenters({ extraDriverFee: money(e.target.value) })} />}
                </Field>
                <Field label="Most extra drivers" labelSize="sm">
                  {(control) => <Input {...control} type="number" min={1} max={9} value={r.renters.maxExtraDrivers || ''} onChange={(e) => setRenters({ maxExtraDrivers: whole(e.target.value, 1) })} />}
                </Field>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card title="Damage cover" hint="Plans guests pick at checkout, priced per day.">
        {r.protection.plans.length > 0 ? (
          <ul className="flex list-none flex-col gap-2 p-0">
            <li aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_6.5rem_7.5rem_2rem] gap-2 px-0.5 text-xs font-medium text-subtle sm:grid">
              <span>Plan</span>
              <span>A day</span>
              <span>Guest still pays</span>
              <span />
            </li>
            {r.protection.plans.map((plan, index) => (
              <li key={plan.id} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_6.5rem_7.5rem_2rem] sm:items-start">
                <Input size="sm" className="col-span-2 sm:col-span-1" aria-label={`Plan ${index + 1} name`} value={plan.name} placeholder={index === 0 ? 'Basic cover' : 'Full cover'} error={errors[`rental.plan.${plan.id}.name`]} onChange={(e) => setPlan(plan.id, { name: e.target.value })} />
                <Input size="sm" type="number" min={0} aria-label={`${plan.name || 'Plan'} price a day`} leftIcon={sym} value={cash(plan.perDay)} error={errors[`rental.plan.${plan.id}.perDay`]} onChange={(e) => setPlan(plan.id, { perDay: money(e.target.value) })} />
                <Input size="sm" type="number" min={0} aria-label={`${plan.name || 'Plan'}: what the guest still pays`} placeholder="Nothing" leftIcon={sym} value={cash(plan.deductible)} onChange={(e) => setPlan(plan.id, { deductible: money(e.target.value) })} />
                <button
                  type="button"
                  aria-label={`Remove ${plan.name || 'plan'}`}
                  onClick={() => setPlans(r.protection.plans.filter((entry) => entry.id !== plan.id))}
                  className="grid size-8 place-items-center rounded-lg text-faint hover:bg-surface-sunken hover:text-danger"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="xs"
          className="self-start"
          onClick={() =>
            setPlans([
              ...r.protection.plans,
              { id: `plan_${Date.now().toString(36)}`, name: r.protection.plans.length === 0 ? 'Basic cover' : 'Full cover', perDay: 0, deductible: 0 },
            ])
          }
        >
          + Add a plan
        </Button>
        {r.protection.plans.length > 0 ? (
          <SwitchRow
            label="Every booking takes a plan"
            hint="Off: guests can use their own cover."
            checked={r.protection.required}
            onChange={(required) => set({ protection: { ...r.protection, required } })}
          />
        ) : null}
      </Card>

      <Card title="Late returns" hint="Shown to guests, and worked out when it comes back.">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Grace" labelSize="sm" optional>
            {(control) => <Input {...control} type="number" min={0} max={240} step={5} suffix="min" placeholder="None" value={r.graceMinutes || ''} onChange={(e) => set({ graceMinutes: whole(e.target.value) })} />}
          </Field>
          <Field label="Late fee an hour" labelSize="sm" optional>
            {(control) => <Input {...control} type="number" min={0} placeholder="None" leftIcon={sym} value={cash(r.lateFee)} onChange={(e) => set({ lateFee: money(e.target.value) })} />}
          </Field>
          <Field label="A full day after" labelSize="sm" optional>
            {(control) => <Input {...control} type="number" min={0} max={24} suffix="hours" placeholder="Never" value={r.lateDayAfterHours || ''} onChange={(e) => set({ lateDayAfterHours: whole(e.target.value) })} />}
          </Field>
        </div>
      </Card>
    </div>
  )
}
