'use client'

import * as React from 'react'
import {
  AlarmClock,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  CircleAlert,
  Clock,
  KeyRound,
  Phone,
  X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import type { RentalBoard, RentalFleet, RentalRow, RentalStatus } from '@/lib/operations'
import { cn, formatCurrency, formatTime, pluralize } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   RENTALS
   Written for the person at the desk, not a planner: what to do next, in
   time order, with one button per rental. Up top, how many of each fleet
   are free right now, and anything late or without a unit.
   ========================================================================== */

type View = 'next' | 'handout' | 'out' | 'returned' | 'all'

const STATUS_META: Record<RentalStatus, { label: string; badge: 'neutral' | 'primary' | 'danger' | 'success' }> = {
  booked: { label: 'To hand out', badge: 'neutral' },
  out: { label: 'Out', badge: 'primary' },
  late: { label: 'Late', badge: 'danger' },
  returned: { label: 'Back', badge: 'success' },
}

const minutesBetween = (fromMs: number, iso: string) => Math.round((new Date(iso).getTime() - fromMs) / 60_000)

/** "in 25 min", "1 h 10 min ago", "in 2 days". */
function relative(minutes: number) {
  const abs = Math.abs(minutes)
  if (abs < 1) return 'now'
  const text =
    abs < 60 ? `${abs} min` : abs < 1440 ? `${Math.floor(abs / 60)} h${abs % 60 ? ` ${abs % 60} min` : ''}` : `${Math.round(abs / 1440)} ${pluralize(Math.round(abs / 1440), 'day')}`
  return minutes > 0 ? `in ${text}` : `${text} ago`
}

/** 10:30 AM today, or "Mon 14 Sep, 5:00 PM" on another day. */
function when(iso: string, dayKey: string) {
  if (iso.slice(0, 10) === dayKey) return formatTime(iso)
  const date = new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(iso))
  return `${date}, ${formatTime(iso)}`
}

/** The moment that matters next: the hand-out for a booking, the return for anything out. */
const actionAt = (row: RentalRow) => (row.status === 'booked' ? row.startsAt : row.endsAt)

export function RentalsBoard({ board, currency }: { board: RentalBoard; currency: CurrencyCode }) {
  const [rows, setRows] = React.useState<RentalRow[]>(board.rentals)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [view, setView] = React.useState<View>('next')
  const [fleetId, setFleetId] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState('')
  const [allAlerts, setAllAlerts] = React.useState(false)
  const nowMs = new Date(board.nowIso).getTime()

  const selected = rows.find((row) => row.id === selectedId) ?? null
  const fleetOf = (id: string) => board.fleets.find((fleet) => fleet.id === id)
  const setStatus = (id: string, status: RentalStatus) => setRows((current) => current.map((row) => (row.id === id ? { ...row, status } : row)))

  if (board.fleets.length === 0) {
    return (
      <EmptyState
        icon={KeyRound}
        title="No rentals yet"
        description="Create an activity of the Rental type to see its units here: what is out, what is due back and what is late."
      />
    )
  }

  /* ---------- the day in four numbers ---------- */
  const outRows = rows.filter((row) => row.status === 'out' || row.status === 'late')
  const unitsOut = outRows.reduce((sum, row) => sum + row.units.length, 0)
  const totalUnits = board.fleets.reduce((sum, fleet) => sum + fleet.units, 0)
  const upcoming = rows.filter((row) => row.status === 'booked').sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const dueSoon = rows.filter((row) => row.status === 'out' && minutesBetween(nowMs, row.endsAt) <= 60)
  const late = rows.filter((row) => row.status === 'late')
  const noUnit = rows.filter((row) => row.short > 0 && row.status === 'booked')
  const alertCount = late.length + noUnit.length
  // Late returns first; only three at a time so the box stays readable.
  const shownLate = allAlerts ? late : late.slice(0, 3)
  const shownNoUnit = allAlerts ? noUnit : noUnit.slice(0, Math.max(0, 3 - shownLate.length))
  const words = (fleet: RentalFleet | undefined, count: number) => (count === 1 ? (fleet?.unitWord ?? 'unit') : (fleet?.unitsWord ?? 'units'))

  const tiles = [
    { label: 'Out right now', value: `${unitsOut}`, suffix: ` of ${totalUnits}`, hint: `${totalUnits - unitsOut} free to rent`, tone: '' },
    { label: 'Going out next', value: String(upcoming.length), suffix: '', hint: upcoming[0] ? `First at ${formatTime(upcoming[0].startsAt)}` : 'Nothing else today', tone: '' },
    { label: 'Coming back within the hour', value: String(dueSoon.length), suffix: '', hint: dueSoon.length > 0 ? `Next at ${formatTime([...dueSoon].sort((a, b) => a.endsAt.localeCompare(b.endsAt))[0].endsAt)}` : 'None due', tone: '' },
    { label: 'Late back', value: String(late.length), suffix: '', hint: late.length > 0 ? 'Call them' : 'Everyone on time', tone: late.length > 0 ? 'text-danger' : '' },
  ]

  /* ---------- the list ---------- */
  const needle = query.trim().toLowerCase()
  const inScope = rows.filter(
    (row) =>
      (!fleetId || row.activityId === fleetId) &&
      (!needle || row.guestName.toLowerCase().includes(needle) || row.reference.toLowerCase().includes(needle) || row.phone.includes(needle)),
  )
  const byView: Record<View, RentalRow[]> = {
    next: inScope.filter((row) => row.status !== 'returned'),
    handout: inScope.filter((row) => row.status === 'booked'),
    out: inScope.filter((row) => row.status === 'out' || row.status === 'late'),
    returned: inScope.filter((row) => row.status === 'returned'),
    all: inScope,
  }
  const listed = [...byView[view]].sort((a, b) => {
    // Late first, then by the time the next thing happens.
    if (view !== 'returned' && view !== 'all' && (a.status === 'late') !== (b.status === 'late')) return a.status === 'late' ? -1 : 1
    return actionAt(a).localeCompare(actionAt(b))
  })

  const handOut = (row: RentalRow) => {
    setStatus(row.id, 'out')
    const fleet = fleetOf(row.activityId)
    toast.success(`${row.units.length} ${row.units.length === 1 ? (fleet?.unitWord ?? 'unit') : (fleet?.unitsWord ?? 'units')} out to ${row.guestName}`, {
      description: `Due back ${when(row.endsAt, board.dayKey)}.`,
    })
    setSelectedId(null)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ---------- four numbers ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface px-4 py-3.5">
            <p className="text-xs font-medium text-muted">{tile.label}</p>
            <p className={cn('mt-1 font-display text-2xl font-semibold tabular-nums', tile.tone)}>
              {tile.value}
              {tile.suffix ? <span className="text-base font-medium text-subtle">{tile.suffix}</span> : null}
            </p>
            <p className="text-xs text-subtle">{tile.hint}</p>
          </div>
        ))}
      </div>

      {/* ---------- needs attention ---------- */}
      {alertCount > 0 ? (
        <section className="rounded-2xl border border-danger/30 bg-danger-soft/40 p-4 sm:p-5" aria-labelledby="rentals-attention">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="rentals-attention" className="flex items-center gap-2 text-sm font-semibold text-danger">
              <CircleAlert className="size-4" aria-hidden="true" />
              Needs attention
              <span className="rounded-full bg-danger px-1.5 text-xs font-semibold text-white tabular-nums">{alertCount}</span>
            </h2>
            <p className="text-xs text-muted">
              {[late.length > 0 ? `${late.length} late back` : null, noUnit.length > 0 ? `${noUnit.length} booked with too few free` : null].filter(Boolean).join(' · ')}
            </p>
          </div>
          <ul className="mt-3 flex list-none flex-col gap-2 p-0">
            {shownLate.map((row) => {
              const fleet = fleetOf(row.activityId)
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface px-3.5 py-2.5">
                  <p className="min-w-0 text-sm">
                    <span className="font-semibold text-foreground">{row.guestName}</span>
                    <span className="text-muted"> is {relative(minutesBetween(nowMs, row.endsAt)).replace(' ago', '')} late with {row.units.length} {words(fleet, row.units.length)} ({fleet?.name})</span>
                  </p>
                  <div className="flex items-center gap-2">
                    {row.phone ? (
                      <Button asChild variant="secondary" size="sm" leftIcon={<Phone />}>
                        <a href={`tel:${row.phone.replace(/[^\d+]/g, '')}`}>Call</a>
                      </Button>
                    ) : null}
                    <Button size="sm" leftIcon={<ArrowDownToLine />} onClick={() => setSelectedId(row.id)}>
                      Take back
                    </Button>
                  </div>
                </li>
              )
            })}
            {shownNoUnit.map((row) => {
              const fleet = fleetOf(row.activityId)
              return (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface px-3.5 py-2.5">
                  <p className="min-w-0 text-sm">
                    <span className="font-semibold text-foreground">{row.guestName}</span>
                    <span className="text-muted">
                      {' '}wants {row.units.length + row.short} {words(fleet, row.units.length + row.short)} at {formatTime(row.startsAt)}, but only {row.units.length} {row.units.length === 1 ? 'is' : 'are'} free then. Offer another time or fewer.
                    </span>
                  </p>
                  {row.phone ? (
                    <Button asChild variant="secondary" size="sm" leftIcon={<Phone />}>
                      <a href={`tel:${row.phone.replace(/[^\d+]/g, '')}`}>Call</a>
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {alertCount > 3 ? (
            <button type="button" onClick={() => setAllAlerts((value) => !value)} className="mt-2 text-sm font-semibold text-danger hover:underline">
              {allAlerts ? 'Show fewer' : `Show all ${alertCount}`}
            </button>
          ) : null}
        </section>
      ) : null}

      {/* ---------- what is free, per fleet ---------- */}
      <section aria-labelledby="rentals-fleet">
        <div className="mb-2.5 flex items-baseline justify-between gap-3">
          <h2 id="rentals-fleet" className="text-sm font-semibold">Free right now</h2>
          <p className="flex items-center gap-3 text-xs text-muted" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded border border-line-strong bg-surface" />Free</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-primary" />Out</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded bg-danger" />Late</span>
          </p>
        </div>
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4">
          {board.fleets.map((fleet) => (
            <FleetCard
              key={fleet.id}
              fleet={fleet}
              rows={rows.filter((row) => row.activityId === fleet.id)}
              dayKey={board.dayKey}
              selected={fleetId === fleet.id}
              onSelect={() => setFleetId((current) => (current === fleet.id ? null : fleet.id))}
            />
          ))}
        </div>
      </section>

      {/* ---------- the to-do list ---------- */}
      <section className="rounded-2xl border border-line bg-surface">
        <div className="flex flex-col gap-3 border-b border-line-subtle p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">{fleetId ? fleetOf(fleetId)?.name : 'All rentals today'}</h2>
              <p className="text-xs text-muted">
                {view === 'next' ? 'What happens next, in time order. Late ones stay at the top.' : 'Tap a rental to see the details.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {fleetId ? (
                <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => setFleetId(null)}>
                  Show every fleet
                </Button>
              ) : null}
              <SearchInput value={query} onValueChange={setQuery} label="Find a guest" placeholder="Guest, phone or reference" shortcut={false} className="w-64" />
            </div>
          </div>
          <Segmented
            label="Show"
            value={view}
            onValueChange={setView}
            className="no-scrollbar max-w-full overflow-x-auto"
            options={[
              { value: 'next', label: 'Up next', count: byView.next.length },
              { value: 'handout', label: 'To hand out', count: byView.handout.length },
              { value: 'out', label: 'Out now', count: byView.out.length },
              { value: 'returned', label: 'Back', count: byView.returned.length },
              { value: 'all', label: 'All today', count: byView.all.length },
            ]}
          />
        </div>

        {listed.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            {view === 'handout' ? 'Nothing left to hand out.' : view === 'out' ? 'Nothing is out right now.' : view === 'returned' ? 'Nothing has come back yet.' : 'No rentals match.'}
          </div>
        ) : (
          <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
            {listed.map((row) => (
              <RentalItem
                key={row.id}
                row={row}
                fleet={fleetOf(row.activityId)}
                nowMs={nowMs}
                dayKey={board.dayKey}
                currency={currency}
                onOpen={() => setSelectedId(row.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <RentalSheet
        row={selected}
        fleet={selected ? fleetOf(selected.activityId) : undefined}
        dayKey={board.dayKey}
        currency={currency}
        onClose={() => setSelectedId(null)}
        onHandOut={handOut}
        onReturn={(row, kept, note) => {
          setStatus(row.id, 'returned')
          toast.success(`${row.guestName} is back`, {
            description: kept > 0 ? `${formatCurrency(kept, currency)} kept from the deposit${note ? `: ${note}` : ''}.` : 'Deposit released in full.',
          })
          setSelectedId(null)
        }}
      />
    </div>
  )
}

/* ==========================================================================
   FLEET CARD — one square per unit, filled when it is out
   ========================================================================== */

function FleetCard({
  fleet,
  rows,
  dayKey,
  selected,
  onSelect,
}: {
  fleet: RentalFleet
  rows: RentalRow[]
  dayKey: string
  selected: boolean
  onSelect: () => void
}) {
  const stateOf = (unit: number) => rows.find((row) => (row.status === 'out' || row.status === 'late') && row.units.includes(unit))?.status ?? 'free'
  const units = Array.from({ length: fleet.units }, (_, index) => index + 1)
  const free = units.filter((unit) => stateOf(unit) === 'free').length
  const nextBack = rows.filter((row) => row.status === 'out').sort((a, b) => a.endsAt.localeCompare(b.endsAt))[0]

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-[17.5rem] shrink-0 snap-start flex-col gap-3 rounded-2xl border bg-surface p-4 text-left transition-colors duration-200 sm:w-auto',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        selected ? 'border-primary ring-1 ring-primary' : 'border-line hover:border-line-strong',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{fleet.name}</p>
        {fleet.byDay ? <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-muted">By the day</span> : null}
      </div>
      <p className="font-display text-3xl font-semibold tracking-tight tabular-nums">
        {free}
        <span className="ml-1.5 text-sm font-medium text-subtle">of {fleet.units} {fleet.unitsWord} free</span>
      </p>
      <div className="flex flex-wrap gap-1.5" aria-hidden="true">
        {units.map((unit) => {
          const state = stateOf(unit)
          return (
            <span
              key={unit}
              className={cn(
                'grid size-7 place-items-center rounded-md text-xs font-semibold tabular-nums',
                state === 'free' && 'border border-line-strong bg-surface text-muted',
                state === 'out' && 'bg-primary text-on-primary',
                state === 'late' && 'bg-danger text-white',
              )}
            >
              {unit}
            </span>
          )
        })}
      </div>
      <p className="text-xs text-muted">
        {nextBack
          ? `Next back: ${fleet.unitNoun} ${nextBack.units[0]} ${nextBack.endsAt.slice(0, 10) === dayKey ? `at ${formatTime(nextBack.endsAt)}` : `on ${when(nextBack.endsAt, dayKey)}`}`
          : free === fleet.units
            ? 'Everything is in.'
            : 'Nothing due back soon.'}
      </p>
    </button>
  )
}

/* ==========================================================================
   ONE RENTAL — time, who, what, one button
   ========================================================================== */

function RentalItem({
  row,
  fleet,
  nowMs,
  dayKey,
  currency,
  onOpen,
}: {
  row: RentalRow
  fleet: RentalFleet | undefined
  nowMs: number
  dayKey: string
  currency: CurrencyCode
  onOpen: () => void
}) {
  const at = actionAt(row)
  const minutes = minutesBetween(nowMs, at)
  const count = row.units.length + row.short
  const unitWord = count === 1 ? (fleet?.unitWord ?? 'unit') : (fleet?.unitsWord ?? 'units')
  const verb =
    row.status === 'booked' ? 'Hand out' : row.status === 'returned' ? 'Came back' : row.status === 'late' ? 'Was due back' : 'Due back'

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onOpen()
          }
        }}
        className={cn(
          'grid cursor-pointer gap-3 px-4 py-3.5 transition-colors hover:bg-surface-sunken/50 focus-visible:bg-primary-soft/30 focus-visible:outline-none sm:px-5',
          'grid-cols-[6.5rem_minmax(0,1fr)] lg:grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-center',
          row.status === 'late' && 'bg-danger-soft/30',
        )}
      >
        {/* when */}
        <div>
          <p className="text-xs text-subtle">{verb}</p>
          <p className={cn('text-base font-semibold tabular-nums', row.status === 'late' ? 'text-danger' : 'text-foreground')}>
            {at.slice(0, 10) === dayKey ? formatTime(at) : when(at, dayKey)}
          </p>
          {row.status !== 'returned' ? (
            <p className={cn('text-xs', row.status === 'late' ? 'font-medium text-danger' : 'text-muted')}>
              {row.status === 'late' ? `${relative(minutes).replace(' ago', '')} late` : relative(minutes)}
            </p>
          ) : null}
        </div>

        {/* who */}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{row.guestName}</p>
          <p className="truncate text-xs text-subtle">{row.phone || row.reference}</p>
        </div>

        {/* what */}
        <div className="col-span-2 min-w-0 lg:col-span-1">
          <p className="text-sm text-foreground">
            {count} {unitWord}
            <span className="text-muted"> · {fleet?.byDay ? `${row.itemLabel} for ${row.lengthLabel}` : row.lengthLabel}</span>
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {row.units.map((unit) => (
              <span key={unit} className="rounded-md bg-surface-sunken px-1.5 py-0.5 text-xs font-medium text-muted tabular-nums">
                {fleet?.unitNoun ?? 'Unit'} {unit}
              </span>
            ))}
            {row.short > 0 ? (
              <span className="rounded-md bg-danger-soft px-1.5 py-0.5 text-xs font-medium text-danger">{row.short} without a unit</span>
            ) : null}
            {fleet && fleet.byDay ? (
              <span className="text-xs text-subtle">
                {formatTime(row.startsAt)} {row.startsAt.slice(0, 10) === dayKey ? 'today' : when(row.startsAt, dayKey).split(',')[0]} → {when(row.endsAt, dayKey)}
              </span>
            ) : !fleet?.byDay ? (
              <span className="text-xs text-subtle">
                {formatTime(row.startsAt)} → {formatTime(row.endsAt)}
              </span>
            ) : null}
            {row.balance > 0 ? (
              <span className="rounded-md bg-warning-soft px-1.5 py-0.5 text-xs font-medium text-warning">{formatCurrency(row.balance, currency)} to collect</span>
            ) : null}
          </div>
        </div>

        {/* status and action */}
        <div className="col-span-2 flex items-center justify-between gap-2 lg:col-span-1 lg:justify-end">
          <Badge variant={STATUS_META[row.status].badge} size="sm">
            {STATUS_META[row.status].label}
          </Badge>
          {row.status === 'booked' ? (
            <Button
              size="sm"
              leftIcon={<ArrowUpFromLine />}
              disabled={row.units.length === 0}
              onClick={(event) => {
                event.stopPropagation()
                onOpen()
              }}
            >
              Hand out
            </Button>
          ) : row.status === 'returned' ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Done
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              {row.status === 'late' && row.phone ? (
                <IconButton asChild aria-label={`Call ${row.guestName}`} size="sm" variant="outline">
                  <a href={`tel:${row.phone.replace(/[^\d+]/g, '')}`} onClick={(event) => event.stopPropagation()}>
                    <Phone aria-hidden="true" />
                  </a>
                </IconButton>
              ) : null}
              <Button
                size="sm"
                variant={row.status === 'late' ? 'primary' : 'secondary'}
                leftIcon={<ArrowDownToLine />}
                onClick={(event) => {
                  event.stopPropagation()
                  onOpen()
                }}
              >
                Take back
              </Button>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

/* ==========================================================================
   SHEET — the hand-out checklist and the return
   ========================================================================== */

function RentalSheet({
  row,
  fleet,
  dayKey,
  currency,
  onClose,
  onHandOut,
  onReturn,
}: {
  row: RentalRow | null
  fleet: RentalFleet | undefined
  dayKey: string
  currency: CurrencyCode
  onClose: () => void
  onHandOut: (row: RentalRow) => void
  onReturn: (row: RentalRow, kept: number, note: string) => void
}) {
  const [checks, setChecks] = React.useState({ briefing: false, licence: false, deposit: false })
  const [damage, setDamage] = React.useState(false)
  const [kept, setKept] = React.useState(0)
  const [note, setNote] = React.useState('')

  React.useEffect(() => {
    setChecks({ briefing: false, licence: false, deposit: row ? row.deposit === 0 : false })
    setDamage(false)
    setKept(0)
    setNote('')
  }, [row])

  const unitNoun = fleet?.unitNoun ?? 'Unit'
  const depositTotal = row ? row.deposit * row.units.length : 0
  const canHandOut = checks.briefing && checks.licence && checks.deposit

  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" size="md">
        {row ? (
          <>
            <SheetHeader>
              <SheetTitle>{row.guestName}</SheetTitle>
              <SheetDescription>
                {fleet?.name} · {row.reference}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-5">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-surface-sunken/60 px-3 py-2.5">
                  <dt className="text-xs text-subtle">Goes out</dt>
                  <dd className="font-medium tabular-nums">{when(row.startsAt, dayKey)}</dd>
                </div>
                <div className="rounded-xl bg-surface-sunken/60 px-3 py-2.5">
                  <dt className="text-xs text-subtle">Comes back</dt>
                  <dd className="font-medium tabular-nums">{when(row.endsAt, dayKey)}</dd>
                </div>
                <div className="rounded-xl bg-surface-sunken/60 px-3 py-2.5">
                  <dt className="text-xs text-subtle">What</dt>
                  <dd className="font-medium">{fleet?.byDay ? `${row.itemLabel} · ${row.lengthLabel}` : row.lengthLabel}</dd>
                </div>
                <div className="rounded-xl bg-surface-sunken/60 px-3 py-2.5">
                  <dt className="text-xs text-subtle">Status</dt>
                  <dd>
                    <Badge variant={STATUS_META[row.status].badge} size="sm">{STATUS_META[row.status].label}</Badge>
                  </dd>
                </div>
                <div className="col-span-2 rounded-xl bg-surface-sunken/60 px-3 py-2.5">
                  <dt className="text-xs text-subtle">{row.units.length === 1 ? 'Unit' : 'Units'}</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {row.units.map((unit) => (
                      <span key={unit} className="rounded-md bg-surface px-2 py-0.5 text-sm font-medium tabular-nums">{unitNoun} {unit}</span>
                    ))}
                    {row.short > 0 ? <span className="rounded-md bg-danger-soft px-2 py-0.5 text-sm font-medium text-danger">{row.short} still need a unit</span> : null}
                  </dd>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-xl bg-surface-sunken/60 px-3 py-2.5">
                  <dt className="text-xs text-subtle">Damage deposit</dt>
                  <dd className="font-medium tabular-nums">{depositTotal > 0 ? formatCurrency(depositTotal, currency) : 'None'}</dd>
                </div>
                {row.balance > 0 ? (
                  <div className="col-span-2 rounded-xl bg-warning-soft px-3 py-2.5 text-sm font-medium text-warning">
                    {formatCurrency(row.balance, currency)} still to collect before hand-out
                  </div>
                ) : null}
              </dl>

              {row.phone ? (
                <Button asChild variant="outline" size="sm" leftIcon={<Phone />}>
                  <a href={`tel:${row.phone.replace(/[^\d+]/g, '')}`}>{row.status === 'late' ? 'Call about the late return' : `Call ${row.phone}`}</a>
                </Button>
              ) : null}

              {row.status === 'booked' ? (
                <div className="flex flex-col gap-2.5">
                  <p className="text-sm font-semibold">Before you hand it out</p>
                  {[
                    { key: 'briefing', label: 'Safety briefing done' },
                    { key: 'licence', label: 'ID or licence checked' },
                    { key: 'deposit', label: depositTotal > 0 ? `Deposit of ${formatCurrency(depositTotal, currency)} held on card` : 'No deposit on this rental' },
                  ].map((item) => (
                    <label key={item.key} className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 text-sm">
                      <Checkbox
                        checked={checks[item.key as keyof typeof checks]}
                        onCheckedChange={(checked) => setChecks((current) => ({ ...current, [item.key]: checked === true }))}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              ) : null}

              {row.status === 'out' || row.status === 'late' ? (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-semibold">How did it come back?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[false, true].map((value) => (
                      <button
                        key={String(value)}
                        type="button"
                        aria-pressed={damage === value}
                        onClick={() => setDamage(value)}
                        className={cn('rounded-xl border px-3 py-2.5 text-sm font-medium', damage === value ? 'border-primary bg-primary-soft/30' : 'border-line')}
                      >
                        {value ? 'Damaged or missing kit' : 'All good'}
                      </button>
                    ))}
                  </div>
                  {damage ? (
                    <>
                      <Field label="Keep from the deposit" description={depositTotal > 0 ? `Up to ${formatCurrency(depositTotal, currency)}.` : 'No deposit was held; charge the card on file.'}>
                        {(control) => (
                          <Input
                            {...control}
                            type="number"
                            min={0}
                            value={kept / 100 || ''}
                            onChange={(e) => setKept(Math.max(0, Math.min(depositTotal || 1e9, Math.round(Number(e.target.value) * 100) || 0)))}
                          />
                        )}
                      </Field>
                      <Field label="What happened">
                        {(control) => <Textarea {...control} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Scratch on the left side" />}
                      </Field>
                    </>
                  ) : null}
                </div>
              ) : null}

              {row.status === 'returned' ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Back in. The {row.units.length === 1 ? 'unit is' : 'units are'} free for the next rental.
                </p>
              ) : null}
            </SheetBody>
            <SheetFooter>
              {row.status === 'booked' ? (
                <div className="flex w-full flex-col gap-2">
                  <Button fullWidth leftIcon={<ArrowUpFromLine />} disabled={!canHandOut || row.units.length === 0} onClick={() => onHandOut(row)}>
                    Hand out {row.units.length} {row.units.length === 1 ? (fleet?.unitWord ?? 'unit') : (fleet?.unitsWord ?? 'units')}
                  </Button>
                  {!canHandOut ? <p className="flex items-center justify-center gap-1.5 text-xs text-subtle"><Clock className="size-3.5" aria-hidden="true" />Tick the three checks first.</p> : null}
                </div>
              ) : row.status === 'out' || row.status === 'late' ? (
                <Button fullWidth leftIcon={row.status === 'late' ? <AlarmClock /> : <ArrowDownToLine />} onClick={() => onReturn(row, damage ? kept : 0, note)}>
                  Take back
                </Button>
              ) : (
                <Button fullWidth variant="outline" onClick={onClose}>
                  Close
                </Button>
              )}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
