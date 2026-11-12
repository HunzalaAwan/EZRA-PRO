'use client'

import * as React from 'react'
import { BedDouble, Bike, Check, Minus, Plus, ShoppingBag, X } from 'lucide-react'

import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DishSheet, type DishSheetResult } from '@/components/storefront/restaurant/dish-sheet'
import { cardInfo, money } from '@/components/storefront/restaurant/dish-sheet-model'
import { choosingFor, type Choosing } from '@/components/storefront/restaurant/menu-browser'
import { useMenu } from '@/hooks/use-menu'
import { addLine, cartLineFrom, cartLineIssues, cartTotals, channelFor, choiceLines, orderLinesFromCart, putLines, type CartLine, type CartMode } from '@/lib/cart'
import { hm, mh } from '@/lib/hospitality/hours'
import { defaultSelection, priceSelection } from '@/lib/hospitality/menu-pricing'
import type { Menu, MenuItem, Order, OrderingHours } from '@/lib/hospitality/types'
import { cn } from '@/lib/utils'
import type { CurrencyCode, Customer } from '@/types'

import { guestName } from './format'

/* ==========================================================================
   <NewOrderDialog> — an order taken over the phone, or from a room.

   Who, how (pickup, delivery, or up to a room), when, what. A dish with
   choices opens the same dish sheet guests use online. Prices, fees and
   tax come from the same maths as the storefront cart, so a phone order
   costs the guest exactly what the website would have charged.
   ========================================================================== */

export interface NewOrderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  menu: Menu
  ordering: OrderingHours
  currency: CurrencyCode
  taxRate: number
  nextNumber: number
  guests: Customer[]
  todayKey: string
  nowIso: string
  tenantId: string
  onCreate: (order: Order) => void
}

export function NewOrderDialog({ open, onOpenChange, menu: seedMenu, ordering, currency, taxRate, nextNumber, guests, todayKey, nowIso, tenantId, onCreate }: NewOrderDialogProps) {
  const { menu } = useMenu(tenantId, seedMenu)
  const [choosing, setChoosing] = React.useState<Choosing | null>(null)
  const roomService = ordering.roomService.enabled
  const [mode, setMode] = React.useState<CartMode>(roomService ? 'room' : 'pickup')
  const [name, setName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [pick, setPick] = React.useState<Customer | null>(null)
  const [address, setAddress] = React.useState('')
  const [roomNumber, setRoomNumber] = React.useState('')
  const [zoneId, setZoneId] = React.useState(ordering.delivery.zones[0]?.id ?? '')
  const [when, setWhen] = React.useState('asap')
  const [lines, setLines] = React.useState<CartLine[]>([])
  const [query, setQuery] = React.useState('')
  const [note, setNote] = React.useState('')
  const [payment, setPayment] = React.useState<'card' | 'cash' | 'room'>(roomService ? 'room' : 'card')

  const nowMin = hm(nowIso.slice(11, 16))
  const window = mode === 'room' ? ordering.roomService : ordering[mode]
  const zone = ordering.delivery.zones.find((z) => z.id === zoneId) ?? ordering.delivery.zones[0]
  const lead = window.leadMinutes + (mode === 'delivery' ? zone?.minutes ?? 0 : 0)
  const slots: string[] = []
  for (let t = Math.ceil(Math.max(nowMin + lead, hm(window.startTime)) / 15) * 15; t <= hm(window.endTime); t += 15) slots.push(mh(t))

  const totals = cartTotals({ version: 1, mode, lines, zoneId: zone?.id ?? null, when, tipPercent: 0 }, ordering, taxRate)
  const channel = channelFor(mode)
  const categoryById = new Map(menu.categories.map((c) => [c.id, c]))
  const needle = query.trim().toLowerCase()
  const sellable = menu.items.filter((i) => i.status === 'available' && i.channels.includes(channel)).filter((i) => (needle ? i.name.toLowerCase().includes(needle) : true))
  const suggestions = name.trim().length >= 2 && !pick ? guests.filter((g) => guestName(g).toLowerCase().includes(name.trim().toLowerCase())).slice(0, 4) : []

  const weekday = new Date(`${todayKey}T12:00:00`).getDay()
  const nowTime = nowIso.slice(11, 16)
  const infos = React.useMemo(() => new Map(menu.items.map((i) => [i.id, cardInfo(menu, i)])), [menu])

  /** A dish with choices opens the dish sheet; anything else goes straight on the ticket. */
  const addItem = (item: MenuItem) => {
    if (infos.get(item.id)?.choices) {
      setChoosing({ item })
      return
    }
    const selection = defaultSelection(menu, item)
    setLines((current) => addLine(current, cartLineFrom(menu, selection, null, priceSelection(menu, selection)), 1))
  }

  const submitDish = ({ lines: made }: DishSheetResult) => {
    const edit = choosing?.edit
    setLines((current) => putLines(menu, current, made, edit?.key))
    setChoosing(null)
  }
  const setQty = (key: string, qty: number) => setLines((current) => (qty <= 0 ? current.filter((l) => l.key !== key) : current.map((l) => (l.key === key ? { ...l, qty } : l))))

  const lineProblem = new Map(lines.map((l) => [l.key, cartLineIssues(menu, l)[0] ?? null]))
  const canSubmit = ![...lineProblem.values()].some(Boolean) && name.trim().length >= 2 && (mode === 'room' ? roomNumber.trim().length >= 2 : phone.replace(/\D/g, '').length >= 6) && lines.length > 0 && (mode !== 'delivery' || address.trim().length >= 4) && !totals.belowMinimum

  const reset = () => {
    setName('')
    setPhone('')
    setPick(null)
    setAddress('')
    setRoomNumber('')
    setLines([])
    setQuery('')
    setNote('')
    setWhen('asap')
  }

  const submit = () => {
    if (!canSubmit) return
    const [first, ...rest] = name.trim().split(/\s+/)
    const customer: Customer = pick ?? {
      id: `cus_phone_${Date.now().toString(36)}`,
      tenantId,
      firstName: first,
      lastName: rest.join(' '),
      email: '',
      phone,
      country: '',
      createdAt: nowIso,
      totalBookings: 0,
      lifetimeValue: 0,
      lastBookingAt: null,
      tags: [],
      marketingOptIn: false,
      segment: 'new',
    }
    const promisedMin = when === 'asap' ? nowMin + lead : hm(when)
    const total = totals.subtotal + totals.deliveryFee + totals.serviceFee + totals.tax
    onCreate({
      id: `ord_phone_${Date.now().toString(36)}`,
      tenantId,
      number: `#${nextNumber}`,
      type: channel,
      status: 'accepted',
      customer,
      lines: orderLinesFromCart(menu, lines, `ol_phone_${Date.now().toString(36)}`),
      subtotal: totals.subtotal,
      deliveryFee: totals.deliveryFee,
      serviceFee: totals.serviceFee,
      tip: 0,
      discount: 0,
      tax: totals.tax,
      total,
      paymentStatus: mode === 'room' ? 'room_charge' : payment === 'card' ? 'paid' : 'pay_at_counter',
      paymentMethod: mode === 'room' ? 'room_charge' : payment === 'card' ? 'card' : 'cash',
      source: mode === 'room' ? 'room_service' : 'phone',
      placedAt: nowIso,
      scheduledFor: when === 'asap' ? null : `${todayKey}T${when}:00`,
      promisedAt: `${todayKey}T${mh(promisedMin)}:00`,
      readyAt: null,
      completedAt: null,
      roomNumber: mode === 'room' ? roomNumber.trim() : null,
      address: mode === 'delivery' ? { line: address.trim(), area: zone?.name ?? '', instructions: null } : null,
      courier: null,
      notes: note.trim() || null,
      late: false,
    })
    reset()
  }

  const modeOptions = [
    ...(roomService ? [{ value: 'room' as CartMode, label: 'Room service', icon: BedDouble }] : []),
    { value: 'pickup' as CartMode, label: 'Pickup', icon: ShoppingBag },
    { value: 'delivery' as CartMode, label: 'Delivery', icon: Bike },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[min(46rem,calc(100dvh-2rem))]">
        <DialogHeader divider>
          <DialogTitle>New order</DialogTitle>
          <DialogDescription>Taken over the phone or from a room. Same prices and fees as the storefront; the ticket goes straight to the pass.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-6 py-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <Segmented label="Order type" options={modeOptions} value={mode} onValueChange={(v) => { setMode(v); setWhen('asap'); setPayment(v === 'room' ? 'room' : 'card') }} />
              <Field label="When" className="min-w-[12rem]">
                <Select value={when} onValueChange={setWhen}>
                  <SelectTrigger aria-label="When">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asap">As soon as possible · {mh(nowMin + lead)}</SelectItem>
                    {slots.slice(0, 24).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="relative">
                <Field label="Guest" required>
                  {(c) => <Input {...c} value={name} onChange={(e) => { setName(e.target.value); setPick(null) }} placeholder="Name on the order" autoComplete="off" />}
                </Field>
                {suggestions.length ? (
                  <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-line bg-surface-raised shadow-lg">
                    {suggestions.map((g) => (
                      <li key={g.id}>
                        <button type="button" className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[0.8125rem] hover:bg-surface-sunken" onClick={() => { setPick(g); setName(guestName(g)); setPhone(g.phone) }}>
                          <Avatar name={guestName(g)} src={g.avatarUrl} size="xs" />
                          <span className="min-w-0 flex-1 truncate text-foreground">{guestName(g)}</span>
                          <span className="shrink-0 text-xs text-subtle">{g.phone}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              {mode === 'room' ? (
                <Field label="Room" required>{(c) => <Input {...c} value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} inputMode="numeric" placeholder="305" />}</Field>
              ) : (
                <Field label="Phone" required>{(c) => <Input {...c} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+30 …" />}</Field>
              )}
              {mode === 'delivery' ? (
                <>
                  <Field label="Address" required>{(c) => <Input {...c} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street and number" />}</Field>
                  <Field label="Zone">
                    <Select value={zone?.id ?? ''} onValueChange={setZoneId}>
                      <SelectTrigger aria-label="Delivery zone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ordering.delivery.zones.map((z) => (
                          <SelectItem key={z.id} value={z.id}>
                            {z.name} · {money(z.fee, currency)} · {z.minutes} min
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </>
              ) : null}
            </div>

            <Field label="Dishes" description={`${sellable.length} available for ${mode === 'room' ? 'room service' : mode}`}>
              <div className="flex flex-col gap-2">
                <SearchInput value={query} onValueChange={setQuery} placeholder="Search the menu…" size="sm" aria-label="Search dishes" />
                <ul className="max-h-64 divide-y divide-line-subtle overflow-y-auto rounded-lg border border-line">
                  {sellable.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 px-3 py-2 text-[0.8125rem]">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-foreground">{item.name}</span>
                        <span className="block truncate text-xs text-subtle">
                          {categoryById.get(item.categoryId)?.name}
                          {infos.get(item.id)?.choices ? ' · choices' : ''}
                        </span>
                      </span>
                      <span className="shrink-0 text-muted tabular-nums">
                        {infos.get(item.id)?.from ? <span className="text-xs text-subtle">from </span> : null}
                        {money(infos.get(item.id)?.price ?? item.price, currency)}
                      </span>
                      <Button size="xs" variant="secondary" leftIcon={<Plus />} onClick={() => addItem(item)} aria-label={infos.get(item.id)?.choices ? `Choose and add ${item.name}` : `Add ${item.name}`}>
                        {infos.get(item.id)?.choices ? 'Choose' : 'Add'}
                      </Button>
                    </li>
                  ))}
                  {sellable.length === 0 ? <li className="px-3 py-4 text-center text-xs text-subtle">Nothing matches.</li> : null}
                </ul>
              </div>
            </Field>

            <Field label="Note for the kitchen" optional>{(c) => <Textarea {...c} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Allergy, no onion, leave the tray outside…" />}</Field>
          </div>

          <aside className="flex flex-col gap-3 rounded-xl bg-surface-sunken p-4 text-[0.8125rem]">
            <p className="text-xs font-medium text-muted">Ticket #{nextNumber}</p>
            {lines.length === 0 ? (
              <p className="text-subtle">Add dishes from the list.</p>
            ) : (
              <ul className="divide-y divide-line-subtle">
                {lines.map((l) => (
                  <li key={l.key} className="flex items-start gap-2 py-2 first:pt-0">
                    <span className="inline-flex shrink-0 items-center self-start rounded-full border border-line bg-surface">
                      <button type="button" aria-label={`Fewer ${l.name}`} className="grid size-6 place-items-center text-muted" onClick={() => setQty(l.key, l.qty - 1)}>
                        <Minus className="size-3" />
                      </button>
                      <span className="min-w-[1.25rem] text-center text-xs tabular-nums">{l.qty}</span>
                      <button type="button" aria-label={`More ${l.name}`} className="grid size-6 place-items-center text-muted" onClick={() => setQty(l.key, l.qty + 1)}>
                        <Plus className="size-3" />
                      </button>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-foreground">
                        {l.name}
                        {l.variant ? <span className="text-muted"> · {l.variant}</span> : null}
                      </span>
                      {choiceLines(l).lines.map((text, index) => (
                        <span key={index} className="block text-xs text-subtle">
                          {text}
                        </span>
                      ))}
                      {choiceLines(l).more ? <span className="block text-xs text-subtle">+{choiceLines(l).more} more</span> : null}
                      {l.note ? <span className="block truncate text-xs text-subtle">“{l.note}”</span> : null}
                      {lineProblem.get(l.key) ? <span className="block text-xs font-medium text-danger">{lineProblem.get(l.key)}</span> : null}
                      {choosingFor(menu, l) && infos.get(l.itemId)?.choices ? (
                        <button type="button" onClick={() => setChoosing(choosingFor(menu, l))} className="text-xs font-medium text-primary hover:underline">
                          Edit
                        </button>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-muted tabular-nums">{money(l.unitPrice * l.qty, currency)}</span>
                  </li>
                ))}
              </ul>
            )}
            <dl className="flex flex-col gap-1 border-t border-line pt-3 text-muted">
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{money(totals.subtotal, currency)}</dd>
              </div>
              {totals.deliveryFee ? (
                <div className="flex justify-between">
                  <dt>Delivery</dt>
                  <dd className="tabular-nums">{money(totals.deliveryFee, currency)}</dd>
                </div>
              ) : null}
              {mode === 'room' && totals.serviceFee ? (
                <div className="flex justify-between">
                  <dt>Tray charge</dt>
                  <dd className="tabular-nums">{money(totals.serviceFee, currency)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt>Tax</dt>
                <dd className="tabular-nums">{money(totals.tax, currency)}</dd>
              </div>
              <div className="flex justify-between pt-1 text-foreground">
                <dt>Total</dt>
                <dd className="tabular-nums">{money(totals.subtotal + totals.deliveryFee + (mode === 'room' ? totals.serviceFee : 0) + totals.tax, currency)}</dd>
              </div>
            </dl>
            {totals.belowMinimum ? <p className="text-xs text-warning">Minimum for {zone?.name} is {money(totals.minOrder, currency)}.</p> : null}
            <Field label="Payment">
              <div className="flex gap-1.5">
                {mode === 'room' ? (
                  <span className="flex-1 rounded-md border border-foreground bg-foreground px-2 py-1.5 text-center text-xs text-background">Charged to the room</span>
                ) : (
                  (['card', 'cash'] as const).map((p) => (
                    <button key={p} type="button" aria-pressed={payment === p} onClick={() => setPayment(p)} className={cn('flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors', payment === p ? 'border-foreground bg-foreground text-background' : 'border-line text-muted hover:border-line-strong')}>
                      {p === 'card' ? 'Card over the phone' : mode === 'pickup' ? 'Cash at pickup' : 'Cash at the door'}
                    </button>
                  ))
                )}
              </div>
            </Field>
          </aside>
        </DialogBody>
        <DialogFooter divider className="sm:justify-between">
          <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" leftIcon={<Check />} disabled={!canSubmit} onClick={submit}>
            Send to the kitchen
          </Button>
        </DialogFooter>
        <DishSheet
        menu={menu}
        item={choosing?.item ?? null}
        currency={currency}
        channel={channel}
        weekday={weekday}
        when={when}
        nowTime={nowTime}
        initial={choosing?.edit}
        submitLabel={choosing?.edit ? 'update' : 'add'}
        onClose={() => setChoosing(null)}
        onSubmit={submitDish}
        onOrderForLater={(at) => setWhen(slots.includes(at) ? at : slots.find((t) => hm(t) >= hm(at)) ?? when)}
        />
      </DialogContent>
    </Dialog>
  )
}
