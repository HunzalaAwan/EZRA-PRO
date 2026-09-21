'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarDays, Minus, Plus, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { hm, seatingTimes } from '@/lib/hospitality/floor'
import type { DiningSettings, ServiceKey } from '@/lib/hospitality/types'
import { cn, formatCurrency, fromDateKey } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   <ReserveWidget> — date, party, time. Three taps and a Continue.

   Availability is a deterministic pattern per day and slot so the widget
   reads the same on every load; the real book decides at confirmation.
   ========================================================================== */

export interface ReserveWidgetProps {
  settings: DiningSettings
  slug: string
  todayKey: string
  nowTime: string
  currency: CurrencyCode
  /** Pre-fill from the URL when the widget sits on the reserve page. */
  initial?: { date?: string; party?: number; time?: string }
  /** Render as a bare card body (no section chrome). */
  embedded?: boolean
  onChange?: (value: { date: string; party: number; time: string; period: ServiceKey }) => void
}

function slotTaken(date: string, time: string, party: number) {
  let h = 7
  for (const ch of `${date}${time}${party}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 100 < 22
}

export function ReserveWidget({ settings, slug, todayKey, nowTime, currency, initial, embedded = false, onChange }: ReserveWidgetProps) {
  const [date, setDate] = React.useState(initial?.date ?? todayKey)
  const [party, setParty] = React.useState(initial?.party ?? 2)
  const weekday = fromDateKey(date).getDay()
  const closed = settings.closures.find((c) => c.date === date)
  const periods = settings.periods.filter((p) => p.weekdays.includes(weekday))
  const defaultPeriod = periods.find((p) => (date === todayKey ? hm(p.lastSeating) > hm(nowTime) : true)) ?? periods[periods.length - 1]
  const [periodId, setPeriodId] = React.useState<ServiceKey>(initial?.time ? periods.find((p) => hm(initial.time!) >= hm(p.startTime) && hm(initial.time!) <= hm(p.lastSeating))?.id ?? defaultPeriod?.id ?? 'dinner' : defaultPeriod?.id ?? 'dinner')
  const period = periods.find((p) => p.id === periodId) ?? defaultPeriod
  const [time, setTime] = React.useState(initial?.time ?? '')

  const slots = period
    ? seatingTimes(period).map((t) => ({
        time: t,
        past: date === todayKey && hm(t) <= hm(nowTime) + 30,
        taken: slotTaken(date, t, party),
      }))
    : []

  React.useEffect(() => {
    if (period && !periods.some((p) => p.id === periodId)) setPeriodId(period.id)
  }, [period, periods, periodId])

  React.useEffect(() => {
    if (time && period && onChange) onChange({ date, party, time, period: period.id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, party, time, periodId])

  const tooBig = party > settings.maxOnlineParty
  const deposit = party >= settings.depositFromParty ? settings.depositPerCover * party : 0
  const href = `/book/${slug}/reserve?date=${date}&time=${time}&party=${party}`

  const body = (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Date</span>
          <Input type="date" min={todayKey} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} leftIcon={<CalendarDays />} aria-label="Date" />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">Guests</span>
          <span className="inline-flex h-10 items-center rounded-lg border border-line bg-surface">
            <button type="button" aria-label="Fewer guests" disabled={party <= 1} className="grid size-10 place-items-center text-muted disabled:opacity-40" onClick={() => setParty(Math.max(1, party - 1))}>
              <Minus className="size-4" />
            </button>
            <span className="inline-flex min-w-[3.5rem] items-center justify-center gap-1.5 text-sm text-foreground tabular-nums">
              <Users className="size-4 text-faint" aria-hidden="true" />
              {party}
            </span>
            <button type="button" aria-label="More guests" disabled={party >= 20} className="grid size-10 place-items-center text-muted disabled:opacity-40" onClick={() => setParty(Math.min(20, party + 1))}>
              <Plus className="size-4" />
            </button>
          </span>
        </div>
      </div>

      {closed ? (
        <p className="rounded-lg bg-surface-sunken px-3 py-2.5 text-sm text-muted">Closed on this day: {closed.reason}. Pick another date.</p>
      ) : tooBig ? (
        <p className="rounded-lg bg-surface-sunken px-3 py-2.5 text-sm text-muted">For parties over {settings.maxOnlineParty}, call us and we will set the room up properly.</p>
      ) : periods.length === 0 ? (
        <p className="rounded-lg bg-surface-sunken px-3 py-2.5 text-sm text-muted">No service on this day.</p>
      ) : (
        <>
          <div className="flex gap-1 rounded-lg bg-surface-sunken p-1">
            {periods.map((p) => (
              <button key={p.id} type="button" aria-pressed={p.id === periodId} onClick={() => { setPeriodId(p.id); setTime('') }} className={cn('flex-1 rounded-md px-3 py-1.5 text-[0.8125rem] font-medium transition-colors', p.id === periodId ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground')}>
                {p.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {slots.map((s) => {
              const disabled = s.past || s.taken
              const active = s.time === time
              return (
                <button key={s.time} type="button" disabled={disabled} aria-pressed={active} onClick={() => setTime(s.time)} className={cn('rounded-md border px-2 py-2 text-center text-sm tabular-nums transition-colors', active ? 'border-primary bg-primary text-on-primary' : disabled ? 'border-line-subtle text-faint line-through' : 'border-line bg-surface text-foreground hover:border-primary/60')}>
                  {s.time}
                </button>
              )
            })}
          </div>
          {slots.every((s) => s.past || s.taken) ? <p className="text-xs text-subtle">Nothing left for {period?.name.toLowerCase()} on this day. Try another service, or call us for the waitlist.</p> : null}
        </>
      )}

      {!embedded ? (
        <>
          <Button asChild size="lg" fullWidth disabled={!time || tooBig || Boolean(closed)} rightIcon={<ArrowRight />} className={cn((!time || tooBig || closed) && 'pointer-events-none opacity-50')}>
            <Link href={href}>Continue{time ? ` · ${time}` : ''}</Link>
          </Button>
          <p className="text-center text-xs text-subtle">
            {deposit ? `Parties of ${settings.depositFromParty} or more leave a ${formatCurrency(settings.depositPerCover, currency)} per person deposit, refunded on arrival.` : 'No deposit. Cancel any time up to two hours before.'}
          </p>
        </>
      ) : null}
    </div>
  )

  if (embedded) return body

  return (
    <section id="reserve" className="scroll-mt-20 border-b border-line-subtle bg-background-subtle py-12 sm:py-16">
      <div className="mx-auto grid w-full max-w-[88rem] gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:px-10">
        <div>
          <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">Reserve a table</p>
          <h2 className="mt-2 max-w-[20ch] font-display text-display-sm font-semibold tracking-tight text-foreground">Pick a time, we will hold the table</h2>
          <p className="mt-4 max-w-[46ch] text-base leading-relaxed text-muted">
            {settings.periods.map((p) => `${p.name} ${p.startTime}–${p.endTime}`).join(' · ')}. Last seating {settings.periods[settings.periods.length - 1].lastSeating}. Tables are held {settings.graceMinutes} minutes past the booked time.
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">{body}</div>
      </div>
    </section>
  )
}
