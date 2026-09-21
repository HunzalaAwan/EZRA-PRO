'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BedDouble, Check, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { HOUSEKEEPING_META, OCCUPANCY_META, type HousekeepingStatus, type Room, type RoomOccupancy, type RoomType, type Stay } from '@/lib/hospitality/types'
import { cn, formatCurrency } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import { StatTile, StatusWord, guestName } from './shared'

/* ==========================================================================
   <RoomsClient> — what you sell (the room types) and what you have (the
   rooms, floor by floor, with who is in them and whether they are clean).
   ========================================================================== */

type HkFilter = 'all' | HousekeepingStatus

export interface RoomsClientProps {
  roomTypes: RoomType[]
  rooms: Room[]
  /** Stays in the house or arriving today, for the names on the cards. */
  stays: Stay[]
  currency: CurrencyCode
  todayKey: string
}

export function RoomsClient({ roomTypes: initialTypes, rooms: initialRooms, stays, currency, todayKey }: RoomsClientProps) {
  const [roomTypes, setRoomTypes] = React.useState(initialTypes)
  const [rooms, setRooms] = React.useState(initialRooms)
  const [filter, setFilter] = React.useState<HkFilter>('all')
  const [floor, setFloor] = React.useState<'all' | number>('all')
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [editingTypeId, setEditingTypeId] = React.useState<string | null>(null)

  const stayById = React.useMemo(() => new Map(stays.map((s) => [s.id, s])), [stays])
  const typeById = React.useMemo(() => new Map(roomTypes.map((t) => [t.id, t])), [roomTypes])
  const floors = [...new Set(rooms.map((r) => r.floor))].sort()

  const stats = React.useMemo(() => {
    const sellable = rooms.filter((r) => r.housekeeping !== 'out_of_order')
    const ready = rooms.filter((r) => (r.housekeeping === 'clean' || r.housekeeping === 'inspected') && (r.occupancy === 'vacant' || r.occupancy === 'arriving')).length
    const dirty = rooms.filter((r) => r.housekeeping === 'dirty' || r.housekeeping === 'in_progress').length
    const ooo = rooms.length - sellable.length
    const occupiedTonight = rooms.filter((r) => r.occupancy === 'stayover' || r.occupancy === 'arriving' || r.occupancy === 'turnover').length
    return { sellable: sellable.length, ready, dirty, ooo, occupiedTonight }
  }, [rooms])

  const visible = rooms.filter((r) => (filter === 'all' ? true : r.housekeeping === filter)).filter((r) => (floor === 'all' ? true : r.floor === floor))

  const setRoom = (id: string, change: (r: Room) => Room) => setRooms((current) => current.map((r) => (r.id === id ? change(r) : r)))

  const setHousekeeping = (room: Room, status: HousekeepingStatus) => {
    setRoom(room.id, (r) => ({ ...r, housekeeping: status }))
    toast(`Room ${room.number} · ${HOUSEKEEPING_META[status].label.toLowerCase()}`)
  }

  const saveType = (type: RoomType) => {
    setRoomTypes((current) => current.map((t) => (t.id === type.id ? type : t)))
    setEditingTypeId(null)
    toast.success(`${type.name} saved`, { description: `From ${formatCurrency(type.baseRate, currency)} a night before season and plan.` })
  }

  const selected = selectedId ? rooms.find((r) => r.id === selectedId) ?? null : null
  const editingType = editingTypeId ? roomTypes.find((t) => t.id === editingTypeId) ?? null : null

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Rooms" hint="in sale" value={stats.sellable} line={`${roomTypes.length} types · ${rooms.length} rooms in the house`} />
        <StatTile label="Ready" hint="clean and free" value={stats.ready} line="Vacant or waiting for an arrival" tone="bg-success" active={filter === 'clean'} onClick={() => setFilter(filter === 'clean' ? 'all' : 'clean')} />
        <StatTile label="To clean" hint="dirty or in progress" value={stats.dirty} line={`${stats.occupiedTonight} rooms occupied tonight`} tone="bg-danger" active={filter === 'dirty'} onClick={() => setFilter(filter === 'dirty' ? 'all' : 'dirty')} />
        <StatTile label="Out of order" hint="not for sale" value={stats.ooo} line={stats.ooo ? rooms.filter((r) => r.housekeeping === 'out_of_order').map((r) => `${r.number}: ${r.notes ?? 'maintenance'}`).join(' · ') : 'Everything in sale'} tone="bg-line-strong" active={filter === 'out_of_order'} onClick={() => setFilter(filter === 'out_of_order' ? 'all' : 'out_of_order')} />
      </div>

      {/* ---------- room types ---------- */}
      <section aria-label="Room types" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {roomTypes.map((t) => {
          const ofType = rooms.filter((r) => r.typeId === t.id)
          const freeTonight = ofType.filter((r) => r.occupancy === 'vacant' && r.housekeeping !== 'out_of_order').length
          return (
            <Card key={t.id} className="overflow-hidden">
              <div className="relative aspect-[16/10] bg-surface-sunken">
                <Image src={t.imageUrls[0]} alt={t.name} fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" />
              </div>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{t.name}</p>
                    <p className="truncate text-xs text-subtle">{t.highlights.join(' · ')}</p>
                  </div>
                  <span className="shrink-0 text-sm text-foreground tabular-nums">{formatCurrency(t.baseRate, currency)}</span>
                </div>
                <p className="mt-3 text-xs text-muted tabular-nums">
                  {ofType.length} rooms · {freeTonight} free tonight · sleeps {t.maxGuests}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button size="xs" variant="outline" onClick={() => setEditingTypeId(t.id)}>
                    Edit
                  </Button>
                  <Button asChild size="xs" variant="ghost">
                    <Link href="/dashboard/rates">Rates</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </section>

      {/* ---------- rooms ---------- */}
      <Card>
        <div className="flex flex-col gap-3 border-b border-line-subtle px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              size="sm"
              label="Floor"
              options={[{ value: 'all', label: 'All floors' }, ...floors.map((f) => ({ value: String(f), label: `Floor ${f}` }))]}
              value={String(floor)}
              onValueChange={(v) => setFloor(v === 'all' ? 'all' : Number(v))}
            />
            <Segmented
              size="sm"
              label="Housekeeping"
              options={[{ value: 'all', label: 'Any state' }, ...(Object.keys(HOUSEKEEPING_META) as HousekeepingStatus[]).map((k) => ({ value: k, label: HOUSEKEEPING_META[k].label }))]}
              value={filter}
              onValueChange={setFilter}
              className="hidden lg:inline-flex"
            />
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/dashboard/housekeeping">Housekeeping board</Link>
          </Button>
        </div>
        <CardContent className="flex flex-col gap-6 p-4 sm:p-5">
          {floors
            .filter((f) => floor === 'all' || f === floor)
            .map((f) => {
              const onFloor = visible.filter((r) => r.floor === f)
              if (onFloor.length === 0) return null
              return (
                <section key={f} aria-label={`Floor ${f}`}>
                  <p className="mb-2 text-xs font-medium text-muted">Floor {f}</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                    {onFloor.map((r) => {
                      const stay = r.currentStayId ? stayById.get(r.currentStayId) : r.arrivingStayId ? stayById.get(r.arrivingStayId) : null
                      return (
                        <button key={r.id} type="button" onClick={() => setSelectedId(r.id)} className={cn('flex min-h-[5.5rem] flex-col rounded-xl border bg-surface p-2.5 text-left transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary', r.housekeeping === 'out_of_order' ? 'border-dashed border-line opacity-60' : 'border-line')}>
                          <span className="flex items-center justify-between gap-1">
                            <span className="text-[0.8125rem] text-foreground tabular-nums">{r.number}</span>
                            <span className="truncate text-[0.6875rem] text-faint">{typeById.get(r.typeId)?.name.split(' ')[0]}</span>
                          </span>
                          <span className="mt-1 truncate text-xs text-muted">{stay ? guestName(stay.customer) : OCCUPANCY_META[r.occupancy].label}</span>
                          {stay ? <span className="truncate text-[0.6875rem] text-subtle">{r.occupancy === 'arriving' ? `arrives${stay.eta ? ` ${stay.eta}` : ' today'}` : r.occupancy === 'departing' ? 'leaves today' : r.occupancy === 'turnover' ? 'out and in today' : `until ${stay.checkOut.slice(5).replace('-', '/')}`}</span> : null}
                          <span className="mt-auto pt-1.5">
                            <StatusWord label={HOUSEKEEPING_META[r.housekeeping].label} tone={HOUSEKEEPING_META[r.housekeeping].tone} className="text-[0.6875rem]" />
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })}
        </CardContent>
      </Card>

      <RoomSheet room={selected} type={selected ? typeById.get(selected.typeId) ?? null : null} stay={selected ? (selected.currentStayId ? stayById.get(selected.currentStayId) : selected.arrivingStayId ? stayById.get(selected.arrivingStayId) : null) ?? null : null} onClose={() => setSelectedId(null)} onHousekeeping={setHousekeeping} onNotes={(room, notes) => setRoom(room.id, (r) => ({ ...r, notes }))} todayKey={todayKey} />
      <RoomTypeSheet type={editingType} currency={currency} onClose={() => setEditingTypeId(null)} onSave={saveType} />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Room sheet
   -------------------------------------------------------------------------- */

const HK_ORDER: HousekeepingStatus[] = ['dirty', 'in_progress', 'clean', 'inspected', 'out_of_order']

function RoomSheet({ room: r, type, stay, onClose, onHousekeeping, onNotes, todayKey }: { room: Room | null; type: RoomType | null; stay: Stay | null; onClose: () => void; onHousekeeping: (room: Room, status: HousekeepingStatus) => void; onNotes: (room: Room, notes: string | null) => void; todayKey: string }) {
  const [note, setNote] = React.useState('')
  React.useEffect(() => setNote(r?.notes ?? ''), [r])
  return (
    <Sheet open={r !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" size="md">
        {r && type ? (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                Room {r.number}
                <StatusWord label={HOUSEKEEPING_META[r.housekeeping].label} tone={HOUSEKEEPING_META[r.housekeeping].tone} />
              </SheetTitle>
              <SheetDescription>
                {type.name} · floor {r.floor} · {type.size} m² · sleeps {type.maxGuests}
                {r.features.length ? ` · ${r.features.join(', ')}` : ''}
              </SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-5">
              <div className="text-[0.8125rem]">
                <p className="text-xs font-medium text-muted">Tonight</p>
                <p className="mt-1 text-foreground">{OCCUPANCY_META[r.occupancy].label}</p>
                <p className="text-xs text-subtle">{OCCUPANCY_META[r.occupancy].hint}</p>
                {stay ? (
                  <p className="mt-2 text-muted">
                    {guestName(stay.customer)} · {stay.checkIn === todayKey ? `arrives${stay.eta ? ` ${stay.eta}` : ' today'}` : `in since ${stay.checkIn.slice(5).replace('-', '/')}`}, leaves {stay.checkOut.slice(5).replace('-', '/')} · {stay.adults + stay.children} {stay.adults + stay.children === 1 ? 'guest' : 'guests'}
                  </p>
                ) : null}
              </div>
              <Field label="Housekeeping">
                <div className="flex flex-wrap gap-1.5">
                  {HK_ORDER.map((s) => {
                    const active = r.housekeeping === s
                    return (
                      <button key={s} type="button" aria-pressed={active} onClick={() => onHousekeeping(r, s)} className={cn('inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors', active ? 'border-foreground bg-foreground text-background' : 'border-line text-muted hover:border-line-strong hover:text-foreground')}>
                        <span aria-hidden="true" className={cn('size-1.5 rounded-full', active ? 'bg-background' : HOUSEKEEPING_META[s].tone)} />
                        {HOUSEKEEPING_META[s].label}
                      </button>
                    )
                  })}
                </div>
              </Field>
              <Field label="Notes" description="Seen by housekeeping and the desk.">
                {(c) => <Textarea {...c} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="A dripping tap, a wobbly chair, the guest who likes extra pillows…" />}
              </Field>
              <div>
                <p className="text-xs font-medium text-muted">In the room</p>
                <p className="mt-1 text-[0.8125rem] text-muted">{type.amenities.join(' · ')}</p>
              </div>
            </SheetBody>
            <SheetFooter className="gap-2">
              <Button size="sm" leftIcon={<Check />} onClick={() => { onNotes(r, note.trim() || null); toast.success(`Room ${r.number} notes saved`); onClose() }}>
                Save
              </Button>
              {r.housekeeping !== 'out_of_order' ? (
                <Button size="sm" variant="outline" leftIcon={<Wrench />} onClick={() => onHousekeeping(r, 'out_of_order')}>
                  Take out of sale
                </Button>
              ) : (
                <Button size="sm" variant="outline" leftIcon={<BedDouble />} onClick={() => onHousekeeping(r, 'dirty')}>
                  Back in sale
                </Button>
              )}
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

/* --------------------------------------------------------------------------
   Room type sheet
   -------------------------------------------------------------------------- */

function RoomTypeSheet({ type, currency, onClose, onSave }: { type: RoomType | null; currency: CurrencyCode; onClose: () => void; onSave: (type: RoomType) => void }) {
  const [draft, setDraft] = React.useState<RoomType | null>(type)
  React.useEffect(() => setDraft(type), [type])
  const set = <K extends keyof RoomType>(key: K, value: RoomType[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d))
  return (
    <Sheet open={type !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" size="md">
        {draft ? (
          <>
            <SheetHeader>
              <SheetTitle>{draft.name}</SheetTitle>
              <SheetDescription>What the storefront shows and the rate every plan and season is built on.</SheetDescription>
            </SheetHeader>
            <SheetBody className="flex flex-col gap-4">
              <Field label="Name">{(c) => <Input {...c} value={draft.name} onChange={(e) => set('name', e.target.value)} />}</Field>
              <Field label="Description">{(c) => <Textarea {...c} rows={4} value={draft.description} onChange={(e) => set('description', e.target.value)} />}</Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Base rate" description="Per night">{(c) => <Input {...c} type="number" inputMode="decimal" step={5} min={0} value={draft.baseRate / 100} onChange={(e) => set('baseRate', Math.round(Number(e.target.value || 0) * 100))} suffix={currency} />}</Field>
                <Field label="Sleeps">{(c) => <Input {...c} type="number" inputMode="numeric" min={1} max={8} value={draft.maxGuests} onChange={(e) => set('maxGuests', Number(e.target.value || 1))} />}</Field>
                <Field label="Size">{(c) => <Input {...c} type="number" inputMode="numeric" min={10} value={draft.size} onChange={(e) => set('size', Number(e.target.value || 0))} suffix="m²" />}</Field>
              </div>
              <Field label="Highlights" description="Three short things, shown under the name.">{(c) => <Input {...c} value={draft.highlights.join(', ')} onChange={(e) => set('highlights', e.target.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3))} />}</Field>
              <Field label="Amenities" description="Comma separated.">{(c) => <Textarea {...c} rows={2} value={draft.amenities.join(', ')} onChange={(e) => set('amenities', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />}</Field>
              <Field label="Photos" description="One URL per line; the first is the cover.">{(c) => <Textarea {...c} rows={2} value={draft.imageUrls.join('\n')} onChange={(e) => set('imageUrls', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))} />}</Field>
            </SheetBody>
            <SheetFooter className="gap-2">
              <Button size="sm" leftIcon={<Check />} onClick={() => onSave(draft)}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export function RoomsFooter() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Occupancy</CardTitle>
        <CardDescription>By room type, tonight.</CardDescription>
      </CardHeader>
    </Card>
  )
}

export type { RoomOccupancy }
