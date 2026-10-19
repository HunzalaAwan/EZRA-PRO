'use client'

import * as React from 'react'

import { NumberInput } from '@/components/dashboard/marketing/number-input'
import { RadioGroup, RadioGroupCard } from '@/components/ui/radio-group'
import { WEEKDAY_SHORT, canWaitUntilStart, knowsBooking } from '@/lib/flows/catalog'
import { timeLabel, weekdaysLabel } from '@/lib/flows/describe'
import type { Flow, FlowExit, FlowSettings } from '@/lib/flows/types'

import { ChoiceChips, PanelSection, ToggleRow } from './fields'

/* ==========================================================================
   What ends an automation early, and the "More settings" every automation
   has: how often a guest can go through it, quiet hours, smart sending,
   send days, the share kept out to measure it, how long a booking counts
   and the channel fallback. Each option says what it will do.
   ========================================================================== */

export function ExitEditor({ flow, onChange }: { flow: Pick<Flow, 'exit' | 'who' | 'trigger' | 'purpose'>; onChange: (exit: FlowExit) => void }) {
  const set = (patch: Partial<FlowExit>) => onChange({ ...flow.exit, ...patch })
  const aboutBooking = knowsBooking(flow.trigger) && canWaitUntilStart(flow.trigger.type)
  const hasWho = flow.who.conditions.length > 0

  return (
    <div className="flex flex-col gap-5">
      <ToggleRow
        title="When they make a new booking"
        text={
          flow.purpose === 'marketing'
            ? 'Recommended. Nobody gets an offer for a trip they have just paid for.'
            : 'Usually off for booking messages: a reminder should still go if they book something else.'
        }
        checked={flow.exit.onBooked}
        onChange={(onBooked) => set({ onBooked })}
      />
      <ToggleRow
        title="When the booking is cancelled"
        text={aboutBooking ? 'No reminders or offers about a trip that is no longer happening.' : 'Only matters for automations about a booking that is still ahead.'}
        checked={flow.exit.onCancelled}
        onChange={(onCancelled) => set({ onCancelled })}
        disabled={!aboutBooking}
      />
      <ToggleRow
        title="When they no longer match who can enter"
        text={
          hasWho
            ? 'Checked before every message. A guest who stops matching leaves quietly.'
            : 'Add a check under “Who can enter” for this to matter.'
        }
        checked={flow.exit.whenNoLongerMatching}
        onChange={(whenNoLongerMatching) => set({ whenNoLongerMatching })}
        disabled={!hasWho}
      />
    </div>
  )
}

export interface MarketingRules {
  quietHours: { enabled: boolean; from: string; to: string }
  frequencyCap: { enabled: boolean; perWeek: number }
}

export function SettingsPanel({
  flow,
  onChange,
  rules,
}: {
  flow: Pick<Flow, 'settings' | 'purpose' | 'trigger'>
  onChange: (settings: FlowSettings) => void
  rules: MarketingRules
}) {
  const s = flow.settings
  const set = (patch: Partial<FlowSettings>) => onChange({ ...s, ...patch })
  const marketing = flow.purpose === 'marketing'
  const perBooking = knowsBooking(flow.trigger)
  const days = weekdaysLabel(s.sendDays)

  return (
    <div className="flex flex-col gap-6">
      <PanelSection title="How often one guest can go through it">
        <RadioGroup value={s.reentry} onValueChange={(reentry) => set({ reentry: reentry as FlowSettings['reentry'] })} gap="sm" aria-label="How often one guest can go through it">
          <RadioGroupCard value="once" className="p-3" label="Once, ever" description="The safest choice for welcomes and win-backs." />
          {perBooking ? <RadioGroupCard value="per_booking" className="p-3" label="Once for each booking" description="Right for reminders: every booking gets its own." /> : null}
          <RadioGroupCard value="every" className="p-3" label="Again after a break" description="They can come back through it, with a gap in between." />
        </RadioGroup>
        {s.reentry === 'every' ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            At most once every
            <NumberInput
              min={1}
              max={730}
              className="w-28"
              suffix="days"
              aria-label="Days between"
              value={Number.isFinite(s.reentryDays) && s.reentryDays >= 1 ? s.reentryDays : 30}
              onValueChange={(reentryDays) => set({ reentryDays })}
            />
          </div>
        ) : null}
      </PanelSection>

      <PanelSection title="When messages go">
        <ToggleRow
          title="Respect quiet hours"
          text={
            rules.quietHours.enabled
              ? `Nothing goes between ${timeLabel(rules.quietHours.from)} and ${timeLabel(rules.quietHours.to)}. It waits until ${timeLabel(rules.quietHours.to)}.`
              : 'Quiet hours are off in Marketing settings, so this has no effect right now.'
          }
          checked={s.quietHours}
          onChange={(quietHours) => set({ quietHours })}
        />
        <ToggleRow
          title="Smart sending"
          text={
            marketing
              ? `Skips a message if they got marketing from you in the last 16 hours${rules.frequencyCap.enabled ? `, and keeps to your limit of ${rules.frequencyCap.perWeek} a week` : ''}.`
              : 'Booking messages always go, because guests need them for their trip.'
          }
          checked={marketing && s.smartSending}
          onChange={(smartSending) => set({ smartSending })}
          disabled={!marketing}
        />
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-foreground">Only send on</p>
          <ChoiceChips label="Send days" options={WEEKDAY_SHORT.map((label, value) => ({ value, label }))} value={s.sendDays} onChange={(next) => set({ sendDays: [...next].sort() })} />
          <p className="text-xs text-subtle">{days ? `Messages due on other days wait until the next day ${days.replace(/^on (a )?/, '')}.` : 'Any day. Pick days to hold messages until one of them.'}</p>
        </div>
        <ToggleRow
          title="Use the other channel when one is missing"
          text={marketing ? 'No email on file? The text goes instead, and the other way round, if they agreed to both.' : 'No email on file? The text goes instead, and the other way round.'}
          checked={s.channelFallback}
          onChange={(channelFallback) => set({ channelFallback })}
        />
      </PanelSection>

      <PanelSection title="Measuring it">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            A booking counts if it comes within
            <NumberInput
              min={1}
              max={30}
              className="w-28"
              suffix="days"
              aria-label="Days a booking counts"
              value={s.conversionDays}
              onValueChange={(conversionDays) => set({ conversionDays })}
            />
            of a message
          </div>
          <p className="text-xs text-subtle">Used for the bookings and revenue shown for this automation.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            Keep
            <NumberInput
              min={0}
              max={50}
              className="w-24"
              suffix="%"
              aria-label="Share kept out"
              value={s.holdoutPercent}
              onValueChange={(holdoutPercent) => set({ holdoutPercent })}
            />
            of guests out to measure it
          </div>
          <p className={s.holdoutPercent > 30 ? 'text-xs text-warning' : 'text-xs text-subtle'}>
            {s.holdoutPercent === 0
              ? 'Off. Everyone who qualifies goes through it.'
              : s.holdoutPercent > 30
                ? `That keeps a lot of guests out. 10% is usually enough to see what it adds.`
                : `${s.holdoutPercent}% get nothing from it, so you can compare how often each group books.`}
          </p>
        </div>
      </PanelSection>
    </div>
  )
}
