'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Bike, Check, Minus, Phone, Plus, Printer, ShoppingBag, Star, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useCart } from '@/hooks/use-cart'
import { cartTotals, type CartMode } from '@/lib/cart'
import { hm } from '@/lib/hospitality/floor'
import { DIETARY_META, type DietaryTag, type Menu, type MenuItem, type OrderingHours, type ServicePeriod } from '@/lib/hospitality/types'
import { cn, formatCurrency } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   <MenuBrowser> — the menu, readable as a menu and orderable as a shop.

   A guest at the table reads it like a printed card: sections, dishes,
   prices, what is in them, what they are free of. A guest at home taps
   Add and the order sits in a rail (desktop) or a bar (phone). Pickup or
   delivery is picked here and carried to checkout. Print it and the shop
   parts fall away.
   ========================================================================== */

export interface MenuBrowserProps {
  menu: Menu
  ordering: OrderingHours
  periods: ServicePeriod[]
  currency: CurrencyCode
  slug: string
  taxRate: number
  /** "HH:MM" on the frozen clock, for the open/closed line. */
  nowTime: string
  /** 0 = Sunday, for which services run today. */
  weekday: number
  phone: string
}

const MODE_OPTIONS: { value: CartMode; label: string; icon: typeof ShoppingBag }[] = [
  { value: 'pickup', label: 'Pickup', icon: ShoppingBag },
  { value: 'delivery', label: 'Delivery', icon: Bike },
]

const LEGEND: DietaryTag[] = ['vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'nuts', 'shellfish']

export function MenuBrowser({ menu, ordering, periods, currency, slug, taxRate, nowTime, weekday, phone }: MenuBrowserProps) {
  const { cart, add, setQty, setMode, setZone } = useCart(slug)
  const [activeCategory, setActiveCategory] = React.useState(menu.categories[0]?.id ?? '')
  const [choosing, setChoosing] = React.useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = React.useState(false)

  const categories = menu.categories.filter((c) => menu.items.some((i) => i.categoryId === c.id && i.status !== 'hidden'))
  const totals = cartTotals(cart, ordering.delivery.zones, taxRate)
  const hours = ordering[cart.mode]
  const now = hm(nowTime)
  const orderingOpen = hours.enabled && now >= hm(hours.startTime) && now < hm(hours.endTime)
  const service = periods.find((p) => p.weekdays.includes(weekday) && hm(p.startTime) <= now && hm(p.endTime) > now)
  const nextService = periods.find((p) => p.weekdays.includes(weekday) && hm(p.startTime) > now)
  const popular = menu.items.filter((i) => i.popular && i.status === 'available' && i.imageUrl).slice(0, 6)

  /* ---------- scroll spy ---------- */

  React.useEffect(() => {
    const sections = categories.map((c) => document.getElementById(`menu-${c.id}`)).filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible) setActiveCategory(visible.target.id.replace('menu-', ''))
      },
      { rootMargin: '-35% 0px -55% 0px' },
    )
    for (const el of sections) observer.observe(el)
    return () => observer.disconnect()
  }, [categories])

  const jump = (id: string) => {
    setActiveCategory(id)
    document.getElementById(`menu-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const quickAdd = (item: MenuItem) => {
    if (item.modifiers.length) {
      setChoosing(item)
      return
    }
    add({ itemId: item.id, name: item.name, unitPrice: item.price, modifiers: [], note: null })
    toast.success(`${item.name} added`, { description: formatCurrency(item.price, currency) })
  }

  const qtyOf = (item: MenuItem) => cart.lines.filter((l) => l.itemId === item.id).reduce((s, l) => s + l.qty, 0)

  return (
    <section id="menu" className="scroll-mt-20 bg-background py-12 sm:py-16 print:py-0">
      <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
        {/* ---------- head ---------- */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">The menu</p>
            <h2 className="mt-2 font-display text-display-sm font-semibold tracking-tight text-foreground">{service ? `${service.name}, served until ${service.endTime}` : nextService ? `${nextService.name} from ${nextService.startTime}` : 'Closed for today'}</h2>
            <p className="mt-2 max-w-[56ch] text-sm text-muted">
              {periods.map((p) => `${p.name} ${p.startTime}–${p.endTime}`).join(' · ')}.{' '}
              {orderingOpen ? `${cart.mode === 'pickup' ? 'Pickup' : 'Delivery'} until ${hours.endTime}, ready in about ${hours.leadMinutes} minutes.` : `${cart.mode === 'pickup' ? 'Pickup' : 'Delivery'} opens at ${hours.startTime}; order now for later.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Segmented size="md" label="Order type" options={MODE_OPTIONS} value={cart.mode} onValueChange={setMode} />
            <Button variant="ghost" size="sm" leftIcon={<Printer aria-hidden="true" />} className="hidden sm:inline-flex" onClick={() => window.print()}>
              Print
            </Button>
          </div>
        </div>

        {/* ---------- popular ---------- */}
        {popular.length >= 3 ? (
          <div className="mt-8 print:hidden">
            <p className="text-xs font-medium text-muted">Most ordered</p>
            <ul className="no-scrollbar -mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {popular.map((item) => {
                const sellable = item.channels.includes(cart.mode)
                return (
                  <li key={item.id} className="w-44 shrink-0 snap-start sm:w-52">
                    <button type="button" disabled={!sellable} onClick={() => quickAdd(item)} className="group flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left transition-colors hover:border-primary/45 disabled:opacity-60">
                      <span className="relative block aspect-[4/3] bg-surface-sunken">
                        <Image src={item.imageUrl as string} alt={item.name} fill sizes="208px" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                      </span>
                      <span className="flex items-start justify-between gap-2 p-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
                          <span className="block text-xs text-subtle">{sellable ? 'Tap to add' : 'Dine-in only'}</span>
                        </span>
                        <span className="shrink-0 text-sm text-foreground tabular-nums">{formatCurrency(item.price, currency)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {/* ---------- category rail ---------- */}
        <div className="no-scrollbar sticky top-16 z-20 -mx-4 mt-8 flex gap-1 overflow-x-auto border-b border-line-subtle bg-background/90 px-4 py-2 backdrop-blur sm:top-[4.5rem] sm:mx-0 sm:px-0 print:hidden">
          {categories.map((c) => (
            <button key={c.id} type="button" aria-pressed={activeCategory === c.id} onClick={() => jump(c.id)} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors', activeCategory === c.id ? 'bg-foreground text-background' : 'text-muted hover:bg-surface-sunken hover:text-foreground')}>
              {c.name}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] print:block">
          {/* ---------- the card ---------- */}
          <div className="flex flex-col gap-12">
            {categories.map((c) => {
              const items = menu.items.filter((i) => i.categoryId === c.id && i.status !== 'hidden')
              return (
                <div key={c.id} id={`menu-${c.id}`} className="scroll-mt-32 break-inside-avoid">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-3">
                    <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground">{c.name}</h3>
                    {c.description ? <p className="text-sm text-subtle">{c.description}</p> : null}
                  </div>
                  <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2 print:grid-cols-1">
                    {items.map((item) => {
                      const sellable = item.status === 'available' && item.channels.includes(cart.mode)
                      const inCart = qtyOf(item)
                      return (
                        <li key={item.id} className={cn('flex gap-4 rounded-2xl p-3 transition-colors -mx-3', sellable ? 'hover:bg-surface' : 'opacity-70')}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <p className="text-[0.9375rem] font-medium text-foreground">
                                {item.name}
                                {item.popular ? <Star aria-label="Popular" className="ml-1.5 inline size-3.5 fill-warning text-warning" /> : null}
                              </p>
                              <span aria-hidden="true" className="mb-1 min-w-4 flex-1 border-b border-dotted border-line-strong print:border-line" />
                              <span className="shrink-0 text-[0.9375rem] text-foreground tabular-nums">{formatCurrency(item.price, currency)}</span>
                            </div>
                            <p className="mt-1 text-sm leading-relaxed text-muted">{item.description}</p>
                            <div className="mt-2.5 flex items-center justify-between gap-3">
                              <span className="text-xs text-subtle">
                                {item.tags.map((t) => DIETARY_META[t].short).join(' · ')}
                                {item.tags.length && (item.status === 'sold_out' || !item.channels.includes(cart.mode)) ? ' · ' : ''}
                                {item.status === 'sold_out' ? 'Sold out today' : !item.channels.includes(cart.mode) ? (cart.mode === 'delivery' ? 'Pickup or in the restaurant' : 'In the restaurant only') : ''}
                              </span>
                              {sellable ? (
                                <span className="print:hidden">
                                  {inCart > 0 && item.modifiers.length === 0 ? (
                                    <span className="inline-flex items-center rounded-full border border-line bg-surface">
                                      <button type="button" aria-label={`One fewer ${item.name}`} className="grid size-8 place-items-center text-muted" onClick={() => setQty(cart.lines.find((l) => l.itemId === item.id)!.key, inCart - 1)}>
                                        <Minus className="size-3.5" />
                                      </button>
                                      <span className="min-w-[1.5rem] text-center text-sm tabular-nums">{inCart}</span>
                                      <button type="button" aria-label={`One more ${item.name}`} className="grid size-8 place-items-center text-muted" onClick={() => quickAdd(item)}>
                                        <Plus className="size-3.5" />
                                      </button>
                                    </span>
                                  ) : (
                                    <Button size="xs" variant="secondary" leftIcon={<Plus />} onClick={() => quickAdd(item)}>
                                      {inCart > 0 ? `Add · ${inCart} in order` : 'Add'}
                                    </Button>
                                  )}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          {item.imageUrl ? (
                            <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-surface-sunken sm:size-28 print:hidden">
                              <Image src={item.imageUrl} alt={item.name} fill sizes="112px" className="object-cover" />
                            </div>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}

            {/* ---------- legend ---------- */}
            <dl className="flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line-subtle pt-5 text-xs text-subtle">
              {LEGEND.map((t) => (
                <div key={t} className="inline-flex items-center gap-1.5">
                  <dt className="font-medium text-muted">{DIETARY_META[t].short}</dt>
                  <dd>{DIETARY_META[t].label}</dd>
                </div>
              ))}
              <div className="inline-flex items-center gap-1.5">
                <dt>
                  <Star aria-hidden="true" className="size-3 fill-warning text-warning" />
                </dt>
                <dd>Most ordered</dd>
              </div>
              <div className="ml-auto inline-flex items-center gap-1.5">
                <Phone className="size-3" aria-hidden="true" />
                <dd>Allergies and tables: {phone}</dd>
              </div>
            </dl>
          </div>

          {/* ---------- order rail ---------- */}
          <aside className="hidden lg:block print:hidden">
            <div className="sticky top-32 rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <CartBody slug={slug} ordering={ordering} currency={currency} taxRate={taxRate} onZone={setZone} />
            </div>
          </aside>
        </div>
      </div>

      {/* ---------- phone bar ---------- */}
      {totals.count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-3 backdrop-blur lg:hidden print:hidden">
          <Button fullWidth size="lg" onClick={() => setCartOpen(true)}>
            View order · {totals.count} {totals.count === 1 ? 'item' : 'items'} · {formatCurrency(totals.total, currency)}
          </Button>
        </div>
      ) : null}
      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="bottom" size="lg" className="max-h-[85dvh]">
          <SheetHeader>
            <SheetTitle>Your order</SheetTitle>
            <SheetDescription>{cart.mode === 'pickup' ? 'For pickup' : 'For delivery'}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <CartBody slug={slug} ordering={ordering} currency={currency} taxRate={taxRate} onZone={setZone} compact />
          </SheetBody>
          <SheetFooter>
            <Button variant="ghost" size="sm" onClick={() => setCartOpen(false)}>
              Keep browsing
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ChoicesDialog item={choosing} currency={currency} onClose={() => setChoosing(null)} onAdd={(line, qty) => { add(line, qty); setChoosing(null); toast.success(`${line.name} added`, { description: line.modifiers.join(' · ') || undefined }) }} />
    </section>
  )
}

/* --------------------------------------------------------------------------
   Cart body — shared by the rail and the sheet
   -------------------------------------------------------------------------- */

export function CartBody({ slug, ordering, currency, taxRate, onZone, compact = false }: { slug: string; ordering: OrderingHours; currency: CurrencyCode; taxRate: number; onZone: (zoneId: string | null) => void; compact?: boolean }) {
  const { cart, setQty, setMode } = useCart(slug)
  const totals = cartTotals(cart, ordering.delivery.zones, taxRate)
  const zone = ordering.delivery.zones.find((z) => z.id === cart.zoneId) ?? ordering.delivery.zones[0]

  return (
    <div className="flex flex-col gap-4">
      {!compact ? (
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold tracking-tight text-foreground">Your order</h3>
          <Segmented size="sm" label="Order type" options={MODE_OPTIONS} value={cart.mode} onValueChange={setMode} hideLabelsOnMobile />
        </div>
      ) : null}

      {cart.lines.length === 0 ? (
        <p className="rounded-xl bg-surface-sunken px-4 py-6 text-center text-sm text-muted">Nothing yet. Tap Add on a dish.</p>
      ) : (
        <ul className="divide-y divide-line-subtle">
          {cart.lines.map((line) => (
            <li key={line.key} className="flex items-start gap-3 py-3 first:pt-0">
              <span className="inline-flex shrink-0 items-center rounded-full border border-line">
                <button type="button" aria-label={`One fewer ${line.name}`} className="grid size-7 place-items-center text-muted" onClick={() => setQty(line.key, line.qty - 1)}>
                  <Minus className="size-3" />
                </button>
                <span className="min-w-[1.25rem] text-center text-xs tabular-nums">{line.qty}</span>
                <button type="button" aria-label={`One more ${line.name}`} className="grid size-7 place-items-center text-muted" onClick={() => setQty(line.key, line.qty + 1)}>
                  <Plus className="size-3" />
                </button>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{line.name}</span>
                {line.modifiers.length ? <span className="block truncate text-xs text-subtle">{line.modifiers.join(' · ')}</span> : null}
                {line.note ? <span className="block truncate text-xs text-subtle">“{line.note}”</span> : null}
              </span>
              <span className="shrink-0 text-sm text-foreground tabular-nums">{formatCurrency(line.unitPrice * line.qty, currency)}</span>
            </li>
          ))}
        </ul>
      )}

      {cart.mode === 'delivery' ? (
        <div>
          <p className="text-xs font-medium text-muted">Deliver to</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ordering.delivery.zones.map((z) => (
              <button key={z.id} type="button" aria-pressed={zone?.id === z.id} onClick={() => onZone(z.id)} className={cn('rounded-md border px-2.5 py-1.5 text-xs transition-colors', zone?.id === z.id ? 'border-foreground bg-foreground text-background' : 'border-line text-muted hover:border-line-strong')}>
                {z.name} · {formatCurrency(z.fee, currency)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {cart.lines.length ? (
        <dl className="flex flex-col gap-1 border-t border-line-subtle pt-3 text-sm text-muted">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{formatCurrency(totals.subtotal, currency)}</dd>
          </div>
          {totals.deliveryFee ? (
            <div className="flex justify-between">
              <dt>Delivery · {zone?.name}</dt>
              <dd className="tabular-nums">{formatCurrency(totals.deliveryFee, currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>Service fee</dt>
            <dd className="tabular-nums">{formatCurrency(totals.serviceFee, currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Tax</dt>
            <dd className="tabular-nums">{formatCurrency(totals.tax, currency)}</dd>
          </div>
          <div className="flex justify-between pt-1 text-base font-medium text-foreground">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatCurrency(totals.total, currency)}</dd>
          </div>
        </dl>
      ) : null}

      {totals.belowMinimum ? <p className="text-xs text-warning">Minimum order for {zone?.name} is {formatCurrency(totals.minOrder, currency)}.</p> : null}

      <Button asChild size="lg" fullWidth disabled={cart.lines.length === 0 || totals.belowMinimum} className={cn((cart.lines.length === 0 || totals.belowMinimum) && 'pointer-events-none opacity-50')}>
        <Link href={`/book/${slug}/order`}>{cart.mode === 'pickup' ? 'Checkout for pickup' : 'Checkout for delivery'}</Link>
      </Button>
      <p className="text-center text-xs text-subtle">
        {cart.mode === 'pickup' ? `Ready in about ${ordering.pickup.leadMinutes} minutes, or pick a time at checkout.` : `About ${ordering.delivery.leadMinutes + (zone?.minutes ?? 0)} minutes door to door.`}
      </p>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Choices dialog
   -------------------------------------------------------------------------- */

function ChoicesDialog({ item, currency, onClose, onAdd }: { item: MenuItem | null; currency: CurrencyCode; onClose: () => void; onAdd: (line: { itemId: string; name: string; unitPrice: number; modifiers: string[]; note: string | null }, qty: number) => void }) {
  const [picks, setPicks] = React.useState<Record<string, string[]>>({})
  const [qty, setQty] = React.useState(1)
  const [note, setNote] = React.useState('')

  React.useEffect(() => {
    if (item) {
      const initial: Record<string, string[]> = {}
      for (const m of item.modifiers) if (m.required) initial[m.id] = [m.options[0].id]
      setPicks(initial)
      setQty(1)
      setNote('')
    }
  }, [item])

  if (!item) return null
  const chosen = item.modifiers.flatMap((m) => (picks[m.id] ?? []).map((id) => m.options.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => Boolean(o)))
  const unit = item.price + chosen.reduce((s, o) => s + o.priceDelta, 0)
  const complete = item.modifiers.every((m) => !m.required || (picks[m.id]?.length ?? 0) > 0)

  const toggle = (modifierId: string, optionId: string, multiple: boolean) =>
    setPicks((p) => {
      const current = p[modifierId] ?? []
      if (multiple) return { ...p, [modifierId]: current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId] }
      return { ...p, [modifierId]: [optionId] }
    })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader divider>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>{item.description}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5 py-4">
          {item.modifiers.map((m) => (
            <fieldset key={m.id}>
              <legend className="text-sm font-medium text-foreground">
                {m.label} {m.required ? <span className="text-xs text-subtle">· required</span> : <span className="text-xs text-subtle">· optional</span>}
              </legend>
              <div className="mt-2 flex flex-col gap-1.5">
                {m.options.map((o) => {
                  const on = (picks[m.id] ?? []).includes(o.id)
                  return (
                    <button key={o.id} type="button" aria-pressed={on} onClick={() => toggle(m.id, o.id, m.multiple)} className={cn('flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors', on ? 'border-primary bg-primary-soft/40 text-foreground' : 'border-line text-muted hover:border-line-strong')}>
                      <span className="inline-flex items-center gap-2">
                        <span className={cn('grid size-4 place-items-center rounded-full border', on ? 'border-primary bg-primary text-on-primary' : 'border-line-strong')}>{on ? <Check className="size-3" /> : null}</span>
                        {o.label}
                      </span>
                      <span className="text-xs tabular-nums">{o.priceDelta ? `+${formatCurrency(o.priceDelta, currency)}` : ''}</span>
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ))}
          <div>
            <label htmlFor="dish-note" className="text-sm font-medium text-foreground">
              Anything for the kitchen? <span className="text-xs text-subtle">· optional</span>
            </label>
            <Textarea id="dish-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="No onion, sauce on the side…" className="mt-2" />
          </div>
        </DialogBody>
        <DialogFooter divider className="sm:justify-between">
          <span className="inline-flex items-center rounded-full border border-line">
            <button type="button" aria-label="Fewer" className="grid size-9 place-items-center text-muted" onClick={() => setQty(Math.max(1, qty - 1))}>
              <Minus className="size-3.5" />
            </button>
            <span className="min-w-[1.75rem] text-center text-sm tabular-nums">{qty}</span>
            <button type="button" aria-label="More" className="grid size-9 place-items-center text-muted" onClick={() => setQty(Math.min(12, qty + 1))}>
              <Plus className="size-3.5" />
            </button>
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" leftIcon={<X />} onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled={!complete} onClick={() => onAdd({ itemId: item.id, name: item.name, unitPrice: unit, modifiers: chosen.map((o) => o.label), note: note.trim() || null }, qty)}>
              Add {qty} · {formatCurrency(unit * qty, currency)}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
