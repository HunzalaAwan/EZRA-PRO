'use client'

import * as React from 'react'
import { AlarmClock, ArrowDownToLine, ArrowUpFromLine, CheckCircle2, KeyRound, Phone } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { ACTIVITY_COLOR_VAR } from '@/components/charts/chart-container'
import type { RentalBoard, RentalRow, RentalStatus } from '@/lib/operations'
import { cn, formatCurrency, formatTime, pluralize } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   RENTALS BOARD
   One timeline per fleet, one row per unit: what is out, what is due back,
   what is late. Click a rental to hand it out or take it back.
   ========================================================================== */

const DAY_START = 7
const DAY_END = 18

const STATUS_META: Record<RentalStatus, { label: string; bar: string; badge: 'neutral' | 'info' | 'danger' | 'success' }> = {
  booked: { label: 'Booked', bar: 'border-primary/40 bg-primary-soft text-primary', badge: 'info' },
  out: { label: 'Out', bar: 'border-primary bg-primary text-on-primary', badge: 'info' },
  late: { label: 'Late', bar: 'border-danger bg-danger text-white', badge: 'danger' },
  returned: { label: 'Returned', bar: 'border-line bg-surface-sunken text-subtle', badge: 'success' },
}

const hourOf = (iso: string) => {
  const d = new Date(iso)
  return d.getHours() + d.getMinutes() / 60
}

export function RentalsBoard({ board, currency }: { board: RentalBoard; currency: CurrencyCode }) {
  const [rows, setRows] = React.useState<RentalRow[]>(board.rentals)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const now = hourOf(board.nowIso)
  const nowMs = new Date(board.nowIso).getTime()

  const selected = rows.find((row) => row.id === selectedId) ?? null
  const fleetOf = (id: string) => board.fleets.find((fleet) => fleet.id === id)

  const unitsOut = rows.filter((row) => row.status === 'out' || row.status === 'late').reduce((sum, row) => sum + row.units.length, 0)
  const dueSoon = rows.filter((row) => row.status === 'out' && new Date(row.endsAt).getTime() - nowMs <= 60 * 60_000).length
  const late = rows.filter((row) => row.status === 'late').length
  const returned = rows.filter((row) => row.status === 'returned').length
  const totalUnits = board.fleets.reduce((sum, fleet) => sum + fleet.units, 0)

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

  const tiles = [
    { label: 'Out now', value: `${unitsOut} of ${totalUnits}`, hint: 'units on the water', tone: 'text-foreground' },
    { label: 'Due back within the hour', value: String(dueSoon), hint: pluralize(dueSoon, 'rental'), tone: 'text-foreground' },
    { label: 'Late', value: String(late), hint: late > 0 ? 'call them' : 'all on time', tone: late > 0 ? 'text-danger' : 'text-foreground' },
    { label: 'Returned today', value: String(returned), hint: pluralize(returned, 'rental'), tone: 'text-foreground' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface px-4 py-3.5">
            <p className="text-xs font-medium text-muted">{tile.label}</p>
            <p className={cn('mt-1 font-display text-2xl font-semibold tabular-nums', tile.tone)}>{tile.value}</p>
            <p className="text-xs text-subtle">{tile.hint}</p>
          </div>
        ))}
      </div>

      {board.fleets.map((fleet) => {
        const mine = rows.filter((row) => row.activityId === fleet.id)
        const outNow = mine.filter((row) => row.status === 'out' || row.status === 'late').reduce((sum, row) => sum + row.units.length, 0)
        return (
          <section key={fleet.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-4">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="h-6 w-1 rounded-full" style={{ background: ACTIVITY_COLOR_VAR[fleet.colorKey as keyof typeof ACTIVITY_COLOR_VAR] }} />
                <div>
                  <h2 className="text-base font-semibold text-foreground">{fleet.name}</h2>
                  <p className="text-xs text-subtle">
                    {outNow} of {fleet.units} out · {mine.length} {pluralize(mine.length, 'rental')} today
                    {mine.some((row) => row.short > 0) ? ` · ${mine.filter((row) => row.short > 0).length} overbooked` : ''}
                    {fleet.bufferMinutes ? ` · ${fleet.bufferMinutes} min between rentals` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                {(['booked', 'out', 'late', 'returned'] as RentalStatus[]).map((status) => (
                  <span key={status} className="inline-flex items-center gap-1.5">
                    <span className={cn('size-2.5 rounded-sm border', STATUS_META[status].bar)} aria-hidden="true" />
                    {STATUS_META[status].label}
                  </span>
                ))}
              </div>
            </header>

            <div className="overflow-x-auto">
              <div className="min-w-[760px] px-5 py-4">
                {/* hour ruler */}
                <div className="ml-20 flex text-xs text-faint tabular-nums">
                  {Array.from({ length: DAY_END - DAY_START }, (_, index) => (
                    <span key={index} className="flex-1 border-l border-line-subtle pl-1">
                      {formatTime(`2000-01-01T${String(DAY_START + index).padStart(2, '0')}:00:00`).replace(':00', '')}
                    </span>
                  ))}
                </div>
                <div className="mt-1 flex flex-col gap-1.5">
                  {[...Array.from({ length: fleet.units }, (_, index) => index + 1), ...(mine.some((row) => row.short > 0) ? [0] : [])].map((unit) => (
                    <div key={unit} className="flex items-center">
                      <span className={cn('w-20 shrink-0 text-xs font-medium', unit === 0 ? 'text-danger' : 'text-muted')}>
                        {unit === 0 ? 'No unit free' : `${fleet.unitNoun} ${unit}`}
                      </span>
                      <div className="relative h-9 flex-1 rounded-lg bg-surface-sunken/60">
                        {Array.from({ length: DAY_END - DAY_START }, (_, index) => (
                          <span key={index} aria-hidden="true" className="absolute inset-y-0 border-l border-line-subtle" style={{ left: `${(index / (DAY_END - DAY_START)) * 100}%` }} />
                        ))}
                        {mine
                          .filter((row) => (unit === 0 ? row.short > 0 : row.units.includes(unit)))
                          .map((row) => {
                            const start = Math.max(DAY_START, hourOf(row.startsAt))
                            const end = Math.min(DAY_END, hourOf(row.endsAt))
                            const left = ((start - DAY_START) / (DAY_END - DAY_START)) * 100
                            const width = Math.max(2.5, ((end - start) / (DAY_END - DAY_START)) * 100)
                            return (
                              <button
                                key={row.id}
                                type="button"
                                onClick={() => setSelectedId(row.id)}
                                title={`${row.guestName} · ${formatTime(row.startsAt)}–${formatTime(row.endsAt)} · ${STATUS_META[row.status].label}`}
                                className={cn(
                                  'absolute inset-y-1 overflow-hidden rounded-md border px-1.5 text-left text-xs font-medium whitespace-nowrap transition-transform hover:z-10 hover:scale-y-110',
                                  'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                                  STATUS_META[row.status].bar,
                                )}
                                style={{ left: `${left}%`, width: `${width}%` }}
                              >
                                {row.guestName.split(' ').slice(-1)[0]} · {row.lengthLabel}
                              </button>
                            )
                          })}
                        {now > DAY_START && now < DAY_END ? (
                          <span aria-hidden="true" className="absolute inset-y-[-4px] w-0.5 rounded-full bg-danger" style={{ left: `${((now - DAY_START) / (DAY_END - DAY_START)) * 100}%` }} />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )
      })}

      <RentalSheet
        row={selected}
        unitNoun={selected ? (fleetOf(selected.activityId)?.unitNoun ?? 'Unit') : 'Unit'}
        currency={currency}
        onClose={() => setSelectedId(null)}
        onHandOut={(row) => {
          setStatus(row.id, 'out')
          toast.success(`${row.units.length} ${pluralize(row.units.length, 'unit')} out to ${row.guestName}`, { description: `Due back ${formatTime(row.endsAt)}.` })
          setSelectedId(null)
        }}
        onReturn={(row, kept, note) => {
          setStatus(row.id, 'returned')
          toast.success(`${row.guestName} returned`, {
            description: kept > 0 ? `${formatCurrency(kept, currency)} kept from the deposit${note ? `: ${note}` : ''}.` : 'Deposit released in full.',
          })
          setSelectedId(null)
        }}
      />
    </div>
  )
}

function RentalSheet({
  row,
  unitNoun,
  currency,
  onClose,
  onHandOut,
  onReturn,
}: {
  row: RentalRow | null
  unitNoun: string
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
                {row.reference} · {row.units.map((unit) => `${unitNoun} ${unit}`).join(', ')}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-5">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-subtle">Time</dt>
                  <dd className="font-medium tabular-nums">{formatTime(row.startsAt)}–{formatTime(row.endsAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Length</dt>
                  <dd className="font-medium">{row.lengthLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Deposit</dt>
                  <dd className="font-medium tabular-nums">{depositTotal > 0 ? formatCurrency(depositTotal, currency) : 'None'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Status</dt>
                  <dd>
                    <Badge variant={STATUS_META[row.status].badge} size="sm">{STATUS_META[row.status].label}</Badge>
                  </dd>
                </div>
                {row.balance > 0 ? (
                  <div className="col-span-2 rounded-lg bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
                    {formatCurrency(row.balance, currency)} still to collect
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
                  <p className="text-sm font-semibold">Before hand-out</p>
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
                  <p className="text-sm font-semibold">Condition on return</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[false, true].map((value) => (
                      <button
                        key={String(value)}
                        type="button"
                        aria-pressed={damage === value}
                        onClick={() => setDamage(value)}
                        className={cn('rounded-xl border px-3 py-2.5 text-sm font-medium', damage === value ? 'border-primary bg-primary-soft/30' : 'border-line')}
                      >
                        {value ? 'Damage or missing kit' : 'All good'}
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
                        {(control) => <Textarea {...control} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Scratched hull on the port side" />}
                      </Field>
                    </>
                  ) : null}
                </div>
              ) : null}

              {row.status === 'returned' ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  Back at the shack. Units are free for the next rental.
                </p>
              ) : null}
            </SheetBody>
            <SheetFooter>
              {row.status === 'booked' ? (
                <Button fullWidth leftIcon={<ArrowUpFromLine />} disabled={!canHandOut} onClick={() => onHandOut(row)}>
                  Hand out {row.units.length} {pluralize(row.units.length, 'unit')}
                </Button>
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
