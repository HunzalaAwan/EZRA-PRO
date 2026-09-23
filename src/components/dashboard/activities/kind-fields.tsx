'use client'

import * as React from 'react'
import { Anchor, GraduationCap, KeyRound, Route, Ticket, type LucideIcon } from 'lucide-react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ACTIVITY_KINDS, ACTIVITY_KIND_META, LESSON_LEVELS, RENTAL_LENGTHS } from '@/lib/activity-kinds'
import type { ActivityKind, LessonConfig } from '@/types'

import type { DraftTier } from './pricing-tier-editor'

/* ==========================================================================
   What are you selling? — the kind picker and the settings each kind needs.
   Rendered at the top of the Basics step for every non-dining activity.
   ========================================================================== */

export const KIND_ICONS: Record<ActivityKind, LucideIcon> = {
  trip: Route,
  charter: Anchor,
  rental: KeyRound,
  lesson: GraduationCap,
  pass: Ticket,
}

export interface DraftKindSettings {
  rental: { units: number; bufferMinutes: number; damageDeposit: number; minutes: Record<string, number> }
  charter: { maxGuests: number; requestToBook: boolean; noticeHours: number }
  lesson: { level: LessonConfig['level']; sessions: number; ratio: number; certification: string }
  pass: { validDays: number; reentry: boolean }
}

export function defaultKindSettings(): DraftKindSettings {
  return {
    rental: { units: 6, bufferMinutes: 15, damageDeposit: 0, minutes: {} },
    charter: { maxGuests: 6, requestToBook: false, noticeHours: 24 },
    lesson: { level: 'beginner', sessions: 1, ratio: 4, certification: '' },
    pass: { validDays: 1, reentry: true },
  }
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

export function KindFields({
  kind,
  settings,
  onChange,
  tiers,
  currencySymbol,
  errors,
}: {
  kind: ActivityKind
  settings: DraftKindSettings
  onChange: (settings: DraftKindSettings) => void
  tiers: DraftTier[]
  currencySymbol: string
  errors: Record<string, string>
}) {
  const set = <K extends keyof DraftKindSettings>(key: K, patch: Partial<DraftKindSettings[K]>) =>
    onChange({ ...settings, [key]: { ...settings[key], ...patch } })

  if (kind === 'trip') return null

  return (
    <div className="rounded-xl border border-line bg-surface-sunken/40 p-4">
      <p className="text-[0.8125rem] font-medium">{ACTIVITY_KIND_META[kind].label} settings</p>

      {kind === 'rental' ? (
        <div className="mt-3 flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Units available" required error={errors['rental.units']} description="How many can be out at once.">
              {(control) => <Input {...control} type="number" min={1} value={settings.rental.units} onChange={(e) => set('rental', { units: num(e.target.value, 0) })} />}
            </Field>
            <Field label="Gap between rentals" description="Minutes for cleaning or fuel.">
              {(control) => <Input {...control} type="number" min={0} step={5} value={settings.rental.bufferMinutes} onChange={(e) => set('rental', { bufferMinutes: num(e.target.value) })} />}
            </Field>
            <Field label={`Damage deposit (${currencySymbol})`} description="Held per unit, 0 for none.">
              {(control) => <Input {...control} type="number" min={0} value={Math.round(settings.rental.damageDeposit / 100)} onChange={(e) => set('rental', { damageDeposit: num(e.target.value) * 100 })} />}
            </Field>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">Rental lengths</p>
            <p className="mt-0.5 text-xs text-subtle">Each price tier in the Pricing step is one rental length, priced per unit. Match each to its length.</p>
            <ul className="mt-2 flex list-none flex-col gap-2 p-0">
              {tiers.map((tier) => (
                <li key={tier.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-sm">{tier.label || 'Untitled tier'}</span>
                  <Select
                    value={String(settings.rental.minutes[tier.id] ?? 60)}
                    onValueChange={(value) => set('rental', { minutes: { ...settings.rental.minutes, [tier.id]: Number(value) } })}
                  >
                    <SelectTrigger className="w-48" size="sm" aria-label={`Length of ${tier.label}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RENTAL_LENGTHS.map((option) => (
                        <SelectItem key={option.minutes} value={String(option.minutes)}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {kind === 'charter' ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Most guests per charter" required error={errors['charter.maxGuests']}>
            {(control) => <Input {...control} type="number" min={1} value={settings.charter.maxGuests} onChange={(e) => set('charter', { maxGuests: num(e.target.value) })} />}
          </Field>
          <Field label="Notice needed" description="Hours before a charter can start.">
            {(control) => <Input {...control} type="number" min={0} value={settings.charter.noticeHours} onChange={(e) => set('charter', { noticeHours: num(e.target.value) })} />}
          </Field>
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 sm:col-span-2">
            <span>
              <span className="block text-sm font-medium">Request to book</span>
              <span className="block text-xs text-subtle">Guests send their plan and you reply with a quote and a payment link, instead of paying on the spot.</span>
            </span>
            <Switch checked={settings.charter.requestToBook} onCheckedChange={(checked) => set('charter', { requestToBook: checked })} aria-label="Request to book" />
          </label>
          <p className="text-xs text-subtle sm:col-span-2">Each price tier is one charter option, priced for the whole group. Every departure sells once.</p>
        </div>
      ) : null}

      {kind === 'lesson' ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Level">
            <Select value={settings.lesson.level} onValueChange={(value) => set('lesson', { level: value as LessonConfig['level'] })}>
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
          <Field label="Sessions" required error={errors['lesson.sessions']} description="1 for a single lesson; courses run on consecutive days.">
            {(control) => <Input {...control} type="number" min={1} max={14} value={settings.lesson.sessions} onChange={(e) => set('lesson', { sessions: num(e.target.value) })} />}
          </Field>
          <Field label="Students per instructor" required error={errors['lesson.ratio']}>
            {(control) => <Input {...control} type="number" min={1} value={settings.lesson.ratio} onChange={(e) => set('lesson', { ratio: num(e.target.value) })} />}
          </Field>
          <Field label="Certificate earned" optional>
            {(control) => <Input {...control} placeholder="PADI Open Water, AIDA 2…" value={settings.lesson.certification} onChange={(e) => set('lesson', { certification: e.target.value })} />}
          </Field>
        </div>
      ) : null}

      {kind === 'pass' ? (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Valid for" description="Days from the date the guest picks.">
            <Select value={String(settings.pass.validDays)} onValueChange={(value) => set('pass', { validDays: Number(value) })}>
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
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 sm:self-end">
            <span>
              <span className="block text-sm font-medium">Re-entry allowed</span>
              <span className="block text-xs text-subtle">Guests can leave and come back the same day.</span>
            </span>
            <Switch checked={settings.pass.reentry} onCheckedChange={(checked) => set('pass', { reentry: checked })} aria-label="Re-entry allowed" />
          </label>
        </div>
      ) : null}
    </div>
  )
}
