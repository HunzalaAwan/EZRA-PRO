'use client'

import * as React from 'react'
import { Search } from 'lucide-react'

import { NumberInput } from '@/components/dashboard/marketing/number-input'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  JOIN_SOURCE_LABEL,
  TRIGGERS,
  TRIGGER_GROUPS,
  TRIGGER_REACH_LABEL,
  defaultTrigger,
  reachOf,
  triggerMeta,
} from '@/lib/flows/catalog'
import { describeReach, describeTrigger, type DescribeLookups } from '@/lib/flows/describe'
import type { FlowTrigger, TriggerType } from '@/lib/flows/types'
import { cn } from '@/lib/utils'

import { ChoiceChips, DurationInput } from './fields'
import { FlowIcon, iconTone } from './icons'

/* ==========================================================================
   What starts an automation: the moments grouped the way an owner thinks
   about them (bookings, around the trip, money…), each with an example,
   then the few settings that moment takes (how long before, which stars,
   how empty, who hears about it).
   ========================================================================== */

/** Every moment, grouped, as cards. Used on its own when starting from scratch. */
export function TriggerList({ value, onPick, className }: { value?: TriggerType; onPick: (type: TriggerType) => void; className?: string }) {
  const [query, setQuery] = React.useState('')
  const q = query.trim().toLowerCase()
  const shown = q ? TRIGGERS.filter((meta) => `${meta.label} ${meta.short} ${meta.help} ${meta.group}`.toLowerCase().includes(q)) : TRIGGERS

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <Input leftIcon={<Search />} placeholder="Search, for example “review” or “balance”" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search what starts it" />
      {TRIGGER_GROUPS.map((group) => {
        const inGroup = shown.filter((meta) => meta.group === group)
        if (inGroup.length === 0) return null
        return (
          <div key={group} className="flex flex-col gap-2">
            <p className="text-xs font-medium text-subtle">{group}</p>
            <ul className="grid list-none gap-2 p-0">
              {inGroup.map((meta) => {
                const on = meta.type === value
                return (
                  <li key={meta.type}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => onPick(meta.type)}
                      className={cn(
                        'flex w-full items-start gap-3 rounded-xl border bg-surface p-3 text-left transition-colors',
                        'focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-primary/25',
                        on ? 'border-primary bg-primary-soft/40' : 'border-line hover:border-line-strong',
                      )}
                    >
                      <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', on ? 'bg-primary text-on-primary' : 'bg-surface-sunken text-subtle')}>
                        <FlowIcon name={meta.icon} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{meta.label}</span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-subtle">{meta.help}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
      {shown.length === 0 ? <p className="text-sm text-subtle">Nothing matches “{query}”.</p> : null}
    </div>
  )
}

const STARS = [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} ${n === 1 ? 'star' : 'stars'}` }))

/** The settings the chosen moment takes. Renders nothing for moments that take none. */
export function TriggerSettings({
  trigger,
  onChange,
  audiences = [],
}: {
  trigger: FlowTrigger
  onChange: (next: FlowTrigger) => void
  audiences?: { id: string; name: string }[]
}) {
  const meta = triggerMeta(trigger.type)
  const set = (patch: Partial<FlowTrigger>) => onChange({ ...trigger, ...patch })
  const reach = reachOf(trigger)
  const seats = trigger.type === 'low_fill' || trigger.type === 'weather_alert'

  return (
    <div className="flex flex-col gap-5">
      {meta.offset ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[0.8125rem] font-medium text-foreground">How long {meta.offset.label}</p>
          <DurationInput
            label="How long"
            value={trigger.offset}
            onChange={(offset) => set({ offset })}
            units={meta.offset.units}
            min={trigger.type === 'lapsed' ? 1 : 0}
            after={meta.offset.label}
          />
          {trigger.type === 'trip_anniversary' ? <p className="text-xs text-subtle">0 days starts it on the day itself.</p> : null}
        </div>
      ) : null}

      {trigger.type === 'review_left' ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[0.8125rem] font-medium text-foreground">Which reviews</p>
          <ChoiceChips label="Star ratings" options={STARS} value={trigger.ratings ?? []} onChange={(ratings) => set({ ratings: [...ratings].sort() })} />
          <p className="text-xs text-subtle">{(trigger.ratings ?? []).length === 0 ? 'None picked: every review starts it.' : 'Only these ratings start it.'}</p>
        </div>
      ) : null}

      {trigger.type === 'joined_list' ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[0.8125rem] font-medium text-foreground">Where they signed up</p>
          <ChoiceChips
            label="Sign-up places"
            options={(Object.keys(JOIN_SOURCE_LABEL) as (keyof typeof JOIN_SOURCE_LABEL)[]).map((value) => ({ value, label: JOIN_SOURCE_LABEL[value] }))}
            value={trigger.sources ?? []}
            onChange={(sources) => set({ sources })}
          />
          <p className="text-xs text-subtle">{(trigger.sources ?? []).length === 0 ? 'None picked: any sign-up starts it.' : 'Only sign-ups from these places start it.'}</p>
        </div>
      ) : null}

      {trigger.type === 'low_fill' ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-[0.8125rem] font-medium text-foreground">Starts when it is under</p>
          <div className="flex items-center gap-2">
            <NumberInput
              min={1}
              max={100}
              className="w-32"
              suffix="% full"
              aria-label="How full"
              value={typeof trigger.fillBelow === 'number' && Number.isFinite(trigger.fillBelow) ? trigger.fillBelow : 50}
              onValueChange={(fillBelow) => set({ fillBelow })}
            />
          </div>
          <p className="text-xs text-subtle">A start time with 10 spaces and 3 booked is 30% full.</p>
        </div>
      ) : null}

      {seats ? (
        <div className="flex flex-col gap-2">
          <p className="text-[0.8125rem] font-medium text-foreground">Who hears about it</p>
          <RadioGroup
            value={reach}
            onValueChange={(next) => set({ reach: next as FlowTrigger['reach'], audienceId: next === 'audience' ? (trigger.audienceId ?? audiences[0]?.id) : undefined })}
            gap="sm"
            aria-label="Who hears about it"
          >
            {(trigger.type === 'weather_alert' ? (['booked_guests', 'past_guests_of_activity', 'audience'] as const) : (['past_guests_of_activity', 'audience'] as const)).map((value) => (
              <RadioGroupCard
                key={value}
                value={value}
                className="p-3"
                label={TRIGGER_REACH_LABEL[value]}
                description={
                  value === 'booked_guests'
                    ? 'Everyone already booked on that start time. Counts as a booking message.'
                    : value === 'past_guests_of_activity'
                      ? 'Guests who have been on that activity before. Counts as marketing.'
                      : 'One of your saved audiences. Counts as marketing.'
                }
              />
            ))}
          </RadioGroup>
          {reach === 'audience' ? (
            <Select value={trigger.audienceId ?? ''} onValueChange={(audienceId) => set({ audienceId })}>
              <SelectTrigger aria-label="Audience">
                <SelectValue placeholder="Pick an audience" />
              </SelectTrigger>
              <SelectContent>
                {audiences.map((audience) => (
                  <SelectItem key={audience.id} value={audience.id}>
                    {audience.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** The trigger inspector: the chosen moment and its settings, and the other moments to switch to. */
export function TriggerPicker({
  value,
  onChange,
  audiences = [],
  lookups,
}: {
  value: FlowTrigger
  onChange: (next: FlowTrigger) => void
  audiences?: { id: string; name: string }[]
  /** Names for activities and audiences in the sentence. */
  lookups?: DescribeLookups
}) {
  const meta = triggerMeta(value.type)
  const [changing, setChanging] = React.useState(false)
  const names = lookups ?? { audiences }
  const reach = describeReach(value, names)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-sunken/50 p-3.5">
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', iconTone('trigger'))}>
          <FlowIcon name={meta.icon} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{describeTrigger(value, names)}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-subtle">{reach || meta.help}</p>
        </div>
        <button
          type="button"
          onClick={() => setChanging((open) => !open)}
          aria-expanded={changing}
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary"
        >
          {changing ? 'Keep this' : 'Change'}
        </button>
      </div>

      {changing ? (
        <TriggerList
          value={value.type}
          onPick={(type) => {
            if (type !== value.type) onChange(defaultTrigger(type))
            setChanging(false)
          }}
        />
      ) : (
        <TriggerSettings trigger={value} onChange={onChange} audiences={audiences} />
      )}
    </div>
  )
}
