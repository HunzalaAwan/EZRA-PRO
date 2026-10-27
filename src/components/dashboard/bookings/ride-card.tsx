'use client'

import * as React from 'react'
import { ArrowRight, Car, Pencil, Plane } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardToolbar } from '@/components/ui/card'
import { Dialog, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toaster'
import { useRideAssignments } from '@/hooks/use-transfer-rides'
import { useTransferHolds } from '@/hooks/use-transfer-holds'
import { fetchTransferHolds } from '@/lib/actions/transfers'
import { changeBooking, type BookingChange } from '@/lib/booking-ledger'
import { RIDE_STAGE_LABEL } from '@/lib/transfer-rides'
import { applyRideEdit, askedTimeOf, flightLine, hhmm, isHubLeg, movedToOf, partyLine, returnTooSoon, rideFits, rideHeadline, type LegEdit } from '@/lib/transfer-changes'
import { FLIGHT_NUMBER, airlineOf, directionLabel, timeFieldLabels, vehiclesSentence, type TransferHold } from '@/lib/transfers'
import { cn, formatDateLong } from '@/lib/utils'
import type { Activity, TransferBookingDetails, User } from '@/types'

/* ==========================================================================
   RIDE — a transfer booking's rides on the booking record: the trip, each
   leg (date, pickup, flight, from → to), who is travelling, the vehicles,
   and the driver and stage from the Rides board. "Edit ride" changes the
   flight, its time or the hotel; the pickup is worked out again and the
   vehicles checked before it saves.
   ========================================================================== */

const NO_HOLDS: TransferHold[] = []

export function RideCard({
  activity,
  details: seeded,
  change,
  reference,
  tenantSlug,
  start,
  drivers,
  closed = false,
}: {
  activity: Activity
  /** The ride as booked. */
  details: TransferBookingDetails
  /** This browser's change to the booking, if any (its `transfer` is the ride as changed). */
  change?: BookingChange
  reference: string
  tenantSlug: string
  /** Where the booking started, for its first change (`changeStartOf`). */
  start: Pick<BookingChange, 'fromDepartureId' | 'fromStartsAt' | 'fromParty' | 'fromLegDepartureIds'>
  drivers: User[]
  /** Cancelled, refunded or done: nothing to edit. */
  closed?: boolean
}) {
  const details = change?.transfer ?? seeded
  const { assignments } = useRideAssignments(tenantSlug)
  const [editing, setEditing] = React.useState(false)
  const hub = activity.transfer?.hub

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center justify-start gap-2 border-b border-line-subtle pb-3">
        <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-sunken text-subtle">
          <Car className="size-3.5" />
        </span>
        <CardTitle className="text-sm">Ride</CardTitle>
        {closed ? null : (
          <CardToolbar className="ml-auto">
            <Button variant="ghost" size="xs" leftIcon={<Pencil />} onClick={() => setEditing(true)}>
              Edit ride
            </Button>
          </CardToolbar>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-4">
        <div>
          <p className="font-display text-base font-semibold tracking-tight text-foreground">{rideHeadline(activity, details)}</p>
          <p className="mt-0.5 text-[0.8125rem] text-muted">
            {partyLine(details)}
            {details.vehicles.length > 0 ? ` · ${vehiclesSentence(activity, details.vehicles)}` : ''}
          </p>
        </div>
        <ol className="flex list-none flex-col gap-3 p-0">
          {details.legs.map((leg, index) => {
            const assignment = assignments[`${reference}:${index}`]
            const driver = drivers.find((user) => user.id === assignment?.driverId)
            // A group in two or more vehicles: every driver and vehicle, in order.
            const vehicleCount = Math.max(1, details.vehicles.reduce((sum, line) => sum + line.qty, 0))
            const crew = [{ driverId: assignment?.driverId, vehicle: assignment?.vehicle }, ...(assignment?.more ?? [])]
              .slice(0, vehicleCount)
              .flatMap((entry) => {
                const name = drivers.find((user) => user.id === entry.driverId)?.name
                return name ? [`${name}${entry.vehicle ? ` · ${entry.vehicle}` : ''}`] : []
              })
            const flight = flightLine(leg, hub?.kind)
            return (
              <li key={`${leg.direction}-${index}`} className="rounded-xl border border-line-subtle px-3.5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {directionLabel(leg.direction, hub)} · {formatDateLong(leg.pickupAt)}
                  </p>
                  <Badge size="sm" variant={assignment?.stage === 'done' ? 'success' : assignment?.stage === 'no_show' ? 'danger' : assignment && assignment.stage !== 'todo' ? 'info' : 'neutral'}>
                    {RIDE_STAGE_LABEL[assignment?.stage ?? 'todo']}
                  </Badge>
                </div>
                <p className="mt-1 text-[0.8125rem] font-medium text-foreground tabular-nums">
                  Pickup {hhmm(leg.pickupAt)}
                  {flight ? (
                    <span className="ml-2 inline-flex items-center gap-1 font-normal text-muted">
                      <Plane className="size-3.5 text-faint" aria-hidden="true" />
                      {flight}
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-muted">
                  <span className="truncate">{leg.from}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-faint" aria-label="to" />
                  <span className="truncate">{leg.to}</span>
                </p>
                <p className={cn('mt-1 text-xs', driver && crew.length === vehicleCount ? 'text-subtle' : 'text-warning')}>
                  {crew.length === 0 ? 'No driver yet · pick one on Pickups' : crew.length < vehicleCount ? `${crew.join(' and ')} · ${vehicleCount - crew.length} more to pick on Pickups` : crew.join(' and ')}
                </p>
              </li>
            )
          })}
        </ol>
        {details.note ? <p className="text-[0.8125rem] text-muted">Note for the driver: {details.note}</p> : null}
      </CardContent>
      {editing ? (
        <EditRideDialog
          open={editing}
          onOpenChange={setEditing}
          activity={activity}
          seeded={seeded}
          details={details}
          reference={reference}
          tenantSlug={tenantSlug}
          start={start}
        />
      ) : null}
    </Card>
  )
}

/* ---------- Edit ride ---------- */

interface LegForm {
  flightNumber: string
  airline: string
  date: string
  time: string
}

function EditRideDialog({
  open,
  onOpenChange,
  activity,
  seeded,
  details,
  reference,
  tenantSlug,
  start,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: Activity
  seeded: TransferBookingDetails
  details: TransferBookingDetails
  reference: string
  tenantSlug: string
  start: Pick<BookingChange, 'fromDepartureId' | 'fromStartsAt' | 'fromParty' | 'fromLegDepartureIds'>
}) {
  const config = activity.transfer
  const shared = config?.service === 'shared'
  const labels = timeFieldLabels(config?.hub)
  const [serverHolds, setServerHolds] = React.useState<TransferHold[]>(NO_HOLDS)
  React.useEffect(() => {
    let live = true
    fetchTransferHolds(activity.id).then((holds) => {
      if (live) setServerHolds(holds)
    })
    return () => {
      live = false
    }
  }, [activity.id])
  const holds = useTransferHolds(activity, tenantSlug, serverHolds)

  const [legs, setLegs] = React.useState<LegForm[]>(() =>
    details.legs.map((leg) => {
      const at = askedTimeOf(activity, details, leg)
      return { flightNumber: leg.flight?.number ?? '', airline: leg.flight?.airline ?? '', date: at.slice(0, 10), time: at.slice(11, 16) }
    }),
  )
  const [place, setPlace] = React.useState(details.place)
  const [dropOff, setDropOff] = React.useState(details.dropOff ?? '')
  const [tried, setTried] = React.useState(false)
  const setLeg = (index: number, patch: Partial<LegForm>) => setLegs((current) => current.map((leg, at) => (at === index ? { ...leg, ...patch } : leg)))

  const edits: LegEdit[] = legs.map((leg) => ({
    flightNumber: leg.flightNumber,
    airline: leg.airline,
    ...(shared || !leg.date || !leg.time ? {} : { at: `${leg.date}T${leg.time}:00` }),
  }))
  const next = React.useMemo(
    () => applyRideEdit(activity, details, { legs: edits, place, dropOff: details.trip === 'between' ? dropOff : undefined }),
    // edits is rebuilt from legs on each render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activity, details, legs, place, dropOff],
  )
  const errors: Record<string, string> = {}
  legs.forEach((leg, index) => {
    if (leg.flightNumber.trim() && !FLIGHT_NUMBER.test(leg.flightNumber.trim())) errors[`flight${index}`] = 'Add a flight number, like AA 1234.'
    if (!shared && (!leg.date || !leg.time)) errors[`time${index}`] = 'Pick a date and time.'
  })
  if (!place.trim()) errors.place = 'Add the hotel or address.'
  if (returnTooSoon(activity, next)) errors.time1 = 'The return has to be after the arrival.'
  const fits = rideFits(activity, holds, next, reference)
  const changed = JSON.stringify(next) !== JSON.stringify(details)

  const save = () => {
    setTried(true)
    if (Object.keys(errors).length > 0 || !fits) return
    changeBooking(tenantSlug, reference, start, { transfer: next, movedTo: movedToOf(seeded, next) }, { by: 'staff', what: 'Ride changed' })
    toast.success('Ride changed', { description: next.legs.map((leg) => `${directionLabel(leg.direction, config?.hub)}: pickup ${hhmm(leg.pickupAt)}`).join(' · ') })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Edit ride</DialogTitle>
          <DialogDescription>{rideHeadline(activity, details)}. The pickup moves with the new time.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5">
          {details.legs.map((leg, index) => {
            const form = legs[index]
            const hubLeg = isHubLeg(leg.direction)
            const newPickup = next.legs[index]?.pickupAt
            return (
              <fieldset key={`${leg.direction}-${index}`} className="flex flex-col gap-3 rounded-xl border border-line px-3.5 py-3">
                <legend className="px-1 text-sm font-semibold text-foreground">{directionLabel(leg.direction, config?.hub)}</legend>
                {hubLeg ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Flight number" error={tried ? errors[`flight${index}`] : undefined}>
                      <Input
                        value={form.flightNumber}
                        placeholder="AA 1234"
                        autoCapitalize="characters"
                        onChange={(event) => {
                          const value = event.target.value
                          const known = airlineOf(value)
                          setLeg(index, { flightNumber: value, ...(known ? { airline: known } : {}) })
                        }}
                      />
                    </Field>
                    <Field label="Airline">
                      <Input value={form.airline} onChange={(event) => setLeg(index, { airline: event.target.value })} />
                    </Field>
                  </div>
                ) : null}
                {shared ? null : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Date">
                      <Input type="date" value={form.date} onChange={(event) => setLeg(index, { date: event.target.value })} />
                    </Field>
                    <Field label={hubLeg ? (leg.direction === 'from_hub' ? labels.arrives : labels.leaves) : 'Pickup at'} error={tried ? errors[`time${index}`] : undefined}>
                      <Input type="time" step={300} value={form.time} onChange={(event) => setLeg(index, { time: event.target.value })} />
                    </Field>
                  </div>
                )}
                {newPickup ? (
                  <p className="text-xs text-subtle tabular-nums">
                    Pickup {formatDateLong(newPickup)} at {hhmm(newPickup)}
                    {newPickup !== leg.pickupAt ? <span className="text-muted"> · was {hhmm(leg.pickupAt)}</span> : null}
                  </p>
                ) : null}
              </fieldset>
            )
          })}
          <Field label={details.trip === 'between' || details.trip === 'hourly' ? 'Pick up from' : 'Hotel or address'} error={tried ? errors.place : undefined}>
            <Input value={place} onChange={(event) => setPlace(event.target.value)} />
          </Field>
          {details.trip === 'between' ? (
            <Field label="Drop off at">
              <Input value={dropOff} onChange={(event) => setDropOff(event.target.value)} />
            </Field>
          ) : null}
          {!fits ? (
            <p role="alert" className="rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm text-danger">
              No vehicles free at the new time.
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter divider>
          <DialogClose asChild>
            <Button variant="secondary">Keep as is</Button>
          </DialogClose>
          <Button onClick={save} disabled={!changed || !fits}>
            Save ride
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
