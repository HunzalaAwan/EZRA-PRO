'use client'

import * as React from 'react'
import { CalendarClock, CloudLightning, CloudRain, Cloud, PauseCircle, Sun, Wind, XCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import type { WeatherRun } from '@/lib/operations'
import { cn, formatCurrency, formatDateLong, formatTime, pluralize } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   WEATHER & CONDITIONS
   The week's departures with guests and their forecast. Select the runs
   the weather puts at risk and hold, cancel or move them in one go, with
   the guest message and the offer (rebook, credit or refund) decided once.
   ========================================================================== */

type Action = 'hold' | 'cancel' | 'move'
type Offer = 'rebook' | 'credit' | 'refund'

const CONDITION_ICON = { clear: Sun, cloudy: Cloud, rain: CloudRain, storm: CloudLightning, wind: Wind } as const

const OFFER_LABEL: Record<Offer, string> = {
  rebook: 'Free move to another date',
  credit: 'Credit for 110% of what they paid',
  refund: 'Full refund to the card',
}

function messageFor(action: Action, offer: Offer, business: string, moveTo?: string) {
  if (action === 'hold') {
    return `Hi {first_name}, a heads-up from ${business}: the forecast for your {activity} on {date} at {time} is uncertain. We are holding the trip and will confirm by two hours before. Nothing to do for now.`
  }
  if (action === 'move') {
    return `Hi {first_name}, conditions for your {activity} on {date} are not safe, so we have moved you to ${moveTo ?? 'the next good day'}. Same seats, same price. Reply if the new time does not work and we will find another.`
  }
  const offerLine = offer === 'refund' ? 'A full refund is on its way to your card.' : offer === 'credit' ? 'You have a credit for 110% of your booking, valid for a year.' : 'Pick any other date from the link below at no cost.'
  return `Hi {first_name}, we are sorry: your {activity} on {date} at {time} is cancelled because of the weather. ${offerLine}`
}

export function WeatherBoard({ runs: initial, days, business, currency }: { runs: WeatherRun[]; days: string[]; business: string; currency: CurrencyCode }) {
  const [runs, setRuns] = React.useState(initial.map((run) => ({ ...run, movedTo: undefined as string | undefined })))
  const [day, setDay] = React.useState(days[0])
  const [selected, setSelected] = React.useState<string[]>([])
  const [action, setAction] = React.useState<Action | null>(null)
  const [offer, setOffer] = React.useState<Offer>('rebook')
  const [moveDay, setMoveDay] = React.useState(days[1] ?? days[0])
  const [moveTime, setMoveTime] = React.useState('')
  const [message, setMessage] = React.useState('')
  const [channels, setChannels] = React.useState({ email: true, sms: true })

  const visible = runs.filter((run) => run.startsAt.slice(0, 10) === day)
  const chosen = runs.filter((run) => selected.includes(run.id))
  const guests = chosen.reduce((sum, run) => sum + run.booked, 0)
  const atRisk = visible.filter((run) => run.status !== 'cancelled' && (run.weather?.goConfidence ?? 100) < 75)

  const dayLabel = (key: string, index: number) =>
    index === 0 ? 'Today' : index === 1 ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric' }).format(new Date(`${key}T12:00:00`))

  const toggle = (id: string, on: boolean) => setSelected((current) => (on ? [...current, id] : current.filter((entry) => entry !== id)))

  const open = (next: Action) => {
    setAction(next)
    const times = chosen[0]?.usualTimes ?? []
    setMoveTime(times[0] ?? '09:00')
    setMessage(messageFor(next, offer, business, next === 'move' ? `${formatDateLong(new Date(`${moveDay}T12:00:00`))}` : undefined))
  }

  React.useEffect(() => {
    if (action) setMessage(messageFor(action, offer, business, action === 'move' ? `${formatDateLong(new Date(`${moveDay}T12:00:00`))} at ${moveTime}` : undefined))
  }, [action, offer, moveDay, moveTime, business])

  const apply = () => {
    if (!action) return
    const status = action === 'hold' ? 'weather_hold' : action === 'cancel' ? 'cancelled' : 'scheduled'
    setRuns((current) =>
      current.map((run) =>
        selected.includes(run.id)
          ? { ...run, status, movedTo: action === 'move' ? `${moveDay}T${moveTime}:00` : run.movedTo }
          : run,
      ),
    )
    const via = [channels.email && 'email', channels.sms && 'text'].filter(Boolean).join(' and ')
    const refund = chosen.reduce((sum, run) => sum + run.revenue, 0)
    toast.success(
      `${chosen.length} ${pluralize(chosen.length, 'departure')} ${action === 'hold' ? 'on weather hold' : action === 'cancel' ? 'cancelled' : 'moved'}`,
      {
        description: `${guests} ${pluralize(guests, 'guest')} messaged by ${via || 'no channel'}${action === 'cancel' && offer === 'refund' ? ` · ${formatCurrency(refund, currency)} in refunds queued` : action === 'cancel' ? ` · ${OFFER_LABEL[offer].toLowerCase()}` : ''}.`,
      },
    )
    setSelected([])
    setAction(null)
  }

  if (runs.length === 0) {
    return <EmptyState icon={Cloud} title="Nothing on the water this week" description="Departures with guests show here with their forecast." />
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="-mx-1 overflow-x-auto px-1 no-scrollbar">
          <Segmented
            label="Day"
            value={day}
            onValueChange={(next) => { setDay(next); setSelected([]) }}
            className="min-w-max"
            options={days.map((key, index) => ({ value: key, label: dayLabel(key, index), count: runs.filter((run) => run.startsAt.slice(0, 10) === key).length }))}
          />
        </div>
        {atRisk.length > 0 ? (
          <Button variant="secondary" size="sm" onClick={() => setSelected(atRisk.map((run) => run.id))}>
            Select the {atRisk.length} at risk
          </Button>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-subtle">No departures with guests on this day.</p>
      ) : (
        <ul className="flex list-none flex-col gap-2 p-0">
          {visible.map((run) => {
            const Icon = run.weather ? CONDITION_ICON[run.weather.condition as keyof typeof CONDITION_ICON] ?? Cloud : Cloud
            const go = run.weather?.goConfidence
            const on = selected.includes(run.id)
            const dead = run.status === 'cancelled'
            return (
              <li
                key={run.id}
                className={cn('flex items-center gap-4 rounded-xl border px-4 py-3', on ? 'border-primary bg-primary-soft/20' : 'border-line bg-surface', dead && 'opacity-60')}
              >
                <Checkbox checked={on} disabled={dead} onCheckedChange={(checked) => toggle(run.id, checked === true)} aria-label={`Select ${run.activityName} at ${formatTime(run.startsAt)}`} />
                <div className="w-20 shrink-0">
                  <p className="text-base font-semibold whitespace-nowrap tabular-nums">{formatTime(run.startsAt)}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{run.activityName}</p>
                  <p className="truncate text-xs text-subtle">
                    {run.booked} {pluralize(run.booked, 'guest')} in {run.parties} {pluralize(run.parties, 'party', 'parties')}
                    {run.locationName ? ` · ${run.locationName}` : ''}
                    {run.movedTo ? ` · moved to ${formatDateLong(new Date(run.movedTo))} ${formatTime(run.movedTo)}` : ''}
                  </p>
                </div>
                {run.weather ? (
                  <span className="hidden items-center gap-2 text-xs text-muted sm:inline-flex">
                    <Icon className="size-4" aria-hidden="true" />
                    {run.weather.windKts} kt{typeof run.weather.swellM === 'number' ? ` · ${run.weather.swellM} m swell` : ''}
                  </span>
                ) : (
                  <span className="hidden text-xs text-faint sm:inline">No forecast yet</span>
                )}
                {typeof go === 'number' ? (
                  <Badge variant={go < 50 ? 'danger' : go < 75 ? 'warning' : 'success'} size="sm" className="tabular-nums">{go}% go</Badge>
                ) : null}
                {run.status === 'weather_hold' ? <Badge variant="warning" size="sm">On hold</Badge> : null}
                {dead ? <Badge variant="neutral" size="sm">Cancelled</Badge> : null}
              </li>
            )
          })}
        </ul>
      )}

      {selected.length > 0 ? (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface-raised px-4 py-3 shadow-xl">
          <p className="text-sm font-medium">
            {chosen.length} {pluralize(chosen.length, 'departure')} · {guests} {pluralize(guests, 'guest')}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" leftIcon={<PauseCircle />} onClick={() => open('hold')}>Hold</Button>
            <Button variant="secondary" size="sm" leftIcon={<CalendarClock />} onClick={() => open('move')}>Move</Button>
            <Button variant="danger" size="sm" leftIcon={<XCircle />} onClick={() => open('cancel')}>Cancel</Button>
          </div>
        </div>
      ) : null}

      <Dialog open={action !== null} onOpenChange={(value) => !value && setAction(null)}>
        <DialogContent size="lg">
          <DialogHeader divider>
            <DialogTitle>
              {action === 'hold' ? 'Put on weather hold' : action === 'move' ? 'Move to another time' : 'Cancel for weather'}
            </DialogTitle>
            <DialogDescription>
              {chosen.length} {pluralize(chosen.length, 'departure')} · {guests} {pluralize(guests, 'guest')} get the message below.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4 py-4">
            {action === 'cancel' ? (
              <Field label="What guests get">
                <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Offer">
                  {(Object.keys(OFFER_LABEL) as Offer[]).map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={offer === value}
                      onClick={() => setOffer(value)}
                      className={cn('rounded-xl border px-3 py-2.5 text-left text-sm', offer === value ? 'border-primary bg-primary-soft/30 font-medium' : 'border-line')}
                    >
                      {OFFER_LABEL[value]}
                    </button>
                  ))}
                </div>
              </Field>
            ) : null}
            {action === 'move' ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New date">
                  <Select value={moveDay} onValueChange={setMoveDay}>
                    <SelectTrigger aria-label="New date"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {days.map((key, index) => (
                        <SelectItem key={key} value={key}>{dayLabel(key, index)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="New time">
                  <Select value={moveTime} onValueChange={setMoveTime}>
                    <SelectTrigger aria-label="New time"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set(chosen.flatMap((run) => run.usualTimes))).sort().map((time) => (
                        <SelectItem key={time} value={time}>{formatTime(`2000-01-01T${time}:00`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            ) : null}
            <Field label="Message" description="{first_name}, {activity}, {date} and {time} fill in for each guest.">
              {(control) => <Textarea {...control} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />}
            </Field>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="inline-flex items-center gap-2">
                <Checkbox checked={channels.email} onCheckedChange={(checked) => setChannels((c) => ({ ...c, email: checked === true }))} />
                Email
              </label>
              <label className="inline-flex items-center gap-2">
                <Checkbox checked={channels.sms} onCheckedChange={(checked) => setChannels((c) => ({ ...c, sms: checked === true }))} />
                Text message
              </label>
            </div>
          </DialogBody>
          <DialogFooter divider>
            <Button variant="ghost" size="sm" onClick={() => setAction(null)}>Back</Button>
            <Button size="sm" variant={action === 'cancel' ? 'danger' : 'primary'} onClick={apply}>
              {action === 'hold' ? 'Hold and message' : action === 'move' ? 'Move and message' : 'Cancel and message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
