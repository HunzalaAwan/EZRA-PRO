'use client'

import * as React from 'react'
import Link from 'next/link'
import { Car } from 'lucide-react'

import { Checkbox } from '@/components/ui/checkbox'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { formatDateLong } from '@/lib/utils'
import {
  FLIGHT_NUMBER,
  airlineOf,
  directionLabel,
  requestErrors,
  timeFieldLabels,
  transferOf,
  type PlannedLeg,
  type TransferRequest,
} from '@/lib/transfers'
import { hhmm } from '@/lib/transfer-changes'
import type { Activity, TransferDirection, TransferFlight } from '@/types'

/* ==========================================================================
   Ride details — what the driver needs, asked at checkout for a transfer:
   each leg's flight (number, airline, when it lands or takes off), the
   hotel or address, and a note. Changing a flight time works the pickup out
   again on the same date; the date itself is changed back in the widget.
   ========================================================================== */

export interface TransferLegForm {
  flightNumber: string
  airline: string
  /** The guest typed the airline: the flight number no longer fills it. */
  airlineTyped: boolean
  /** "HH:MM": hub legs the flight's time; hotel to hotel and hourly the pickup (read-only). */
  time: string
}

export interface TransferForm {
  /** One per leg, in trip order: a round trip's arrival, then its departure. */
  legs: TransferLegForm[]
  /** Where they stay (hub trips), or where they are collected (hotel to hotel, hourly). */
  place: string
  /** Round trip: collected for the departure from the same hotel. */
  sameHotel: boolean
  /** Round trip with another hotel: where the departure collects them. */
  returnPlace: string
  /** Hotel to hotel: where they go. Hourly: their plan for the day. */
  dropOff: string
  note: string
}

export const EMPTY_TRANSFER_FORM: TransferForm = { legs: [], place: '', sameHotel: true, returnPlace: '', dropOff: '', note: '' }

const minutesOf = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}
const clockOf = (minutes: number) => {
  const day = ((minutes % 1440) + 1440) % 1440
  return `${String(Math.floor(day / 60)).padStart(2, '0')}:${String(day % 60).padStart(2, '0')}`
}
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

/** The ways of a request's legs, in trip order (a round trip: arrival, then departure). */
export function directionsOf(request: Pick<TransferRequest, 'trip'>): TransferDirection[] {
  return request.trip === 'round_trip' ? ['from_hub', 'to_hub'] : [request.trip]
}

/** The time each leg was asked for, in trip order. */
const askedAt = (request: TransferRequest) => (request.trip === 'round_trip' ? [request.at, request.returnAt ?? ''] : [request.at])

/**
 * The form as it starts, from the widget's request: each leg's time, the
 * hotel the guest picked. A shared run's flight starts half an hour before an
 * arrival run, or the time at the hub after a departure run.
 */
export function transferFormFrom(activity: Pick<Activity, 'kind' | 'transfer'>, request: TransferRequest): TransferForm {
  const config = transferOf(activity)
  const shared = config?.service === 'shared'
  const legs = directionsOf(request).map((direction, index): TransferLegForm => {
    const run = hhmm(askedAt(request)[index])
    const time = !shared || !run ? run : direction === 'to_hub' ? clockOf(minutesOf(run) + (config?.checkInMinutes ?? 0)) : clockOf(minutesOf(run) - 30)
    return { flightNumber: '', airline: '', airlineTyped: false, time }
  })
  return { ...EMPTY_TRANSFER_FORM, legs, place: request.place ?? '', dropOff: request.dropOff ?? '' }
}

/**
 * The request with the form's times and places: a private ride's flight
 * times move its pickups (on the same date); a shared run keeps its run.
 */
export function requestWithForm(activity: Pick<Activity, 'kind' | 'transfer'>, request: TransferRequest, form: TransferForm): TransferRequest {
  const config = transferOf(activity)
  const flightLed = config?.service !== 'shared' && request.trip !== 'between' && request.trip !== 'hourly'
  const at = askedAt(request)
  const timed = (index: number) => {
    const time = form.legs[index]?.time ?? ''
    return flightLed && at[index] && TIME.test(time) ? `${at[index].slice(0, 10)}T${time}:00` : at[index]
  }
  const place = form.place.trim()
  const dropOff = form.dropOff.trim()
  return {
    ...request,
    at: timed(0),
    ...(request.trip === 'round_trip' && request.returnAt ? { returnAt: timed(1) } : {}),
    ...(place ? { place } : {}),
    ...(dropOff ? { dropOff } : {}),
  }
}

/** Each leg's flight as booked, in trip order; undefined without a number. */
export function flightsOf(request: TransferRequest, form: TransferForm): (TransferFlight | undefined)[] {
  const at = askedAt(request)
  return directionsOf(request).map((direction, index) => {
    const leg = form.legs[index]
    if (!leg || !leg.flightNumber.trim() || (direction !== 'from_hub' && direction !== 'to_hub')) return undefined
    const time = TIME.test(leg.time) ? leg.time : hhmm(at[index])
    return { number: leg.flightNumber.trim(), ...(leg.airline.trim() ? { airline: leg.airline.trim() } : {}), at: `${(at[index] ?? '').slice(0, 10)}T${time}:00` }
  })
}

/**
 * What is missing or wrong, keyed for the fields: `transfer.flight.<i>`,
 * `transfer.time.<i>`, `transfer.place`, `transfer.returnPlace`,
 * `transfer.dropOff`. With `nowIso`, a new flight time is checked against the
 * hours driven, the notice and the clock. Empty when the ride can be booked.
 */
export function validateTransfer(activity: Activity, request: TransferRequest, form: TransferForm, nowIso?: string): Record<string, string> {
  const errors: Record<string, string> = {}
  const config = transferOf(activity)
  if (!config) return errors
  const directions = directionsOf(request)
  directions.forEach((direction, index) => {
    const leg = form.legs[index]
    if (direction !== 'from_hub' && direction !== 'to_hub') return
    if (config.askFlight && !FLIGHT_NUMBER.test((leg?.flightNumber ?? '').trim())) errors[`transfer.flight.${index}`] = 'Add your flight number, like AA 1234.'
    if (!TIME.test(leg?.time ?? '')) errors[`transfer.time.${index}`] = 'Add the time, like 14:35.'
  })
  const arrives = request.trip === 'from_hub' || request.trip === 'round_trip'
  if (!form.place.trim()) {
    errors['transfer.place'] =
      request.trip === 'between' || request.trip === 'hourly'
        ? 'Add the address we collect you from.'
        : arrives
          ? 'Add the hotel or address we drop you at.'
          : 'Add the hotel or address we collect you from.'
  }
  if (request.trip === 'round_trip' && !form.sameHotel && !form.returnPlace.trim()) errors['transfer.returnPlace'] = 'Add the hotel or address we collect you from.'
  if (request.trip === 'between' && !form.dropOff.trim()) errors['transfer.dropOff'] = 'Add the address we drop you at.'
  if (nowIso && config.service !== 'shared' && request.trip !== 'between' && request.trip !== 'hourly') {
    const found = requestErrors(activity, requestWithForm(activity, request, form), nowIso)
    if (found.at && !errors['transfer.time.0']) errors['transfer.time.0'] = found.at
    if (found.returnAt && !errors['transfer.time.1']) errors['transfer.time.1'] = found.returnAt
  }
  // Hotel to hotel and hourly: the pickup (and hours) came from the widget; an old link can be inside the notice or off the hours.
  if (nowIso && (request.trip === 'between' || request.trip === 'hourly')) {
    const found = requestErrors(activity, request, nowIso)
    const when = found.hours ?? found.at
    if (when) errors['transfer.when'] = when
  }
  return errors
}

/* ==========================================================================
   <CheckoutTransfer>
   ========================================================================== */

export function CheckoutTransfer({
  activity,
  request,
  legs,
  form,
  setForm,
  errors,
  changeHref,
}: {
  activity: Activity
  /** The widget's request, as the link had it (the dates). */
  request: TransferRequest
  /** The legs as worked out with the form's times, in trip order. */
  legs: PlannedLeg[]
  form: TransferForm
  setForm: React.Dispatch<React.SetStateAction<TransferForm>>
  errors: Record<string, string>
  /** Back to the widget, to change the date. */
  changeHref: string
}) {
  const config = transferOf(activity)
  if (!config) return null
  const labels = timeFieldLabels(config.hub)
  const shared = config.service === 'shared'
  const directions = directionsOf(request)
  const at = askedAt(request)
  const setLeg = (index: number, patch: Partial<TransferLegForm>) =>
    setForm((current) => ({ ...current, legs: current.legs.map((leg, at) => (at === index ? { ...leg, ...patch } : leg)) }))
  const setFlight = (index: number, value: string) =>
    setForm((current) => ({
      ...current,
      legs: current.legs.map((leg, at) => {
        if (at !== index) return leg
        const airline = airlineOf(value)
        return { ...leg, flightNumber: value.toUpperCase(), ...(leg.airlineTyped ? {} : { airline: airline ?? '' }) }
      }),
    }))
  const wait = config.freeWaitMinutes
  const waitWords = wait > 60 && wait % 60 === 0 ? `${wait / 60} hours` : `${wait} minutes`
  const pickupOf = (direction: TransferDirection) => legs.find((leg) => leg.direction === direction)?.pickupAt
  const arrives = request.trip === 'from_hub' || request.trip === 'round_trip'

  return (
    <section aria-labelledby="step-ride" className="space-y-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id="step-ride" className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
            <Car className="size-5 text-primary" aria-hidden="true" />
            Ride details
          </h2>
        </div>
        <Link href={changeHref} className="shrink-0 text-sm font-medium text-primary hover:underline">
          Change date
        </Link>
      </div>

      {directions.map((direction, index) => {
        const leg = form.legs[index] ?? { flightNumber: '', airline: '', airlineTyped: false, time: '' }
        const hubLeg = direction === 'from_hub' || direction === 'to_hub'
        const pickup = pickupOf(direction)
        const day = at[index] ? formatDateLong(`${at[index].slice(0, 10)}T12:00:00`) : ''
        return (
          <div key={direction} className="space-y-4 rounded-xl border border-line p-4">
            <p className="text-sm font-semibold text-foreground">
              {directionLabel(direction, config.hub)}
              {day ? <span className="font-normal text-subtle"> · {day}</span> : null}
            </p>
            {hubLeg ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {config.askFlight ? (
                  <>
                    <Field label="Flight number" required error={errors[`transfer.flight.${index}`]}>
                      <Input value={leg.flightNumber} onChange={(e) => setFlight(index, e.target.value)} placeholder="AA 1234" autoComplete="off" autoCapitalize="characters" />
                    </Field>
                    <Field label="Airline" optional>
                      <Input value={leg.airline} onChange={(e) => setLeg(index, { airline: e.target.value, airlineTyped: true })} placeholder="American Airlines" autoComplete="off" />
                    </Field>
                  </>
                ) : null}
                <Field
                  label={direction === 'from_hub' ? labels.arrives : labels.leaves}
                  required
                  error={errors[`transfer.time.${index}`]}
                  description={direction === 'from_hub' && !shared && wait > 0 ? `Your driver waits ${waitWords}, free.` : undefined}
                >
                  <Input type="time" step={300} value={leg.time} onChange={(e) => setLeg(index, { time: e.target.value })} />
                </Field>
              </div>
            ) : null}

            {/* Where: the stay for hub legs (a round trip's departure can collect from another hotel), the addresses otherwise. */}
            {index === 0 ? (
              direction === 'between' || direction === 'hourly' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Pick up from" required error={errors['transfer.place']}>
                    <Input value={form.place} onChange={(e) => setForm((current) => ({ ...current, place: e.target.value }))} placeholder="Hotel name or address" autoComplete="street-address" />
                  </Field>
                  {direction === 'between' ? (
                    <Field label="Drop off at" required error={errors['transfer.dropOff']}>
                      <Input value={form.dropOff} onChange={(e) => setForm((current) => ({ ...current, dropOff: e.target.value }))} placeholder="Hotel name or address" autoComplete="off" />
                    </Field>
                  ) : null}
                </div>
              ) : (
                <Field label="Hotel name" required error={errors['transfer.place']}>
                  <Input value={form.place} onChange={(e) => setForm((current) => ({ ...current, place: e.target.value }))} placeholder="Hotel name or address" autoComplete="off" />
                </Field>
              )
            ) : (
              <div className="space-y-3">
                <label className="flex items-center gap-2.5 text-sm text-foreground">
                  <Checkbox checked={form.sameHotel} onCheckedChange={(value) => setForm((current) => ({ ...current, sameHotel: value === true }))} />
                  Pick up from the same hotel
                </label>
                {!form.sameHotel ? (
                  <Field label="Pick up from" required error={errors['transfer.returnPlace']}>
                    <Input value={form.returnPlace} onChange={(e) => setForm((current) => ({ ...current, returnPlace: e.target.value }))} placeholder="Hotel name or address" autoComplete="off" />
                  </Field>
                ) : null}
              </div>
            )}

            {direction === 'hourly' ? (
              <Field label="Plan for the day" optional>
                <Textarea rows={3} value={form.dropOff} onChange={(e) => setForm((current) => ({ ...current, dropOff: e.target.value }))} placeholder="Where you'd like to go" />
              </Field>
            ) : null}

            {index === 0 && errors['transfer.when'] ? (
              <p className="text-xs font-medium text-danger" role="alert">
                {errors['transfer.when']}{' '}
                <Link href={changeHref} className="font-semibold underline">
                  Change it
                </Link>
              </p>
            ) : null}
            {pickup && direction !== 'from_hub' ? (
              <p className="text-xs text-muted">
                Pickup at <span className="font-semibold text-foreground tabular">{hhmm(pickup)}</span>
                {/* An early flight: the pickup is the evening before. */}
                {at[index] && pickup.slice(0, 10) < at[index].slice(0, 10) ? ` on ${formatDateLong(`${pickup.slice(0, 10)}T12:00:00`)}, the day before your flight` : ''}
                {direction === 'to_hub' ? '. We confirm it by message the day before.' : '.'}
              </p>
            ) : null}
            {direction === 'from_hub' && shared && pickup ? (
              <p className="text-xs text-muted">
                Shuttle leaves at <span className="font-semibold text-foreground tabular">{hhmm(pickup)}</span>.
              </p>
            ) : null}
          </div>
        )
      })}

      <Field label="Note for the driver" optional>
        <Textarea rows={2} value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value.slice(0, 300) }))} placeholder="A stroller, a surfboard…" />
      </Field>
      {arrives && config.hub?.meetingNote ? <p className="text-xs text-subtle">{config.hub.meetingNote}</p> : null}
    </section>
  )
}
