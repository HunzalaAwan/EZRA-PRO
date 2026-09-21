'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Bike, Check, Minus, Plus, ShoppingBag, Star, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useCart } from '@/hooks/use-cart'
import { cartTotals, type CartMode } from '@/lib/cart'
import { hm } from '@/lib/hospitality/floor'
import { DIETARY_META, type Menu, type MenuItem, type OrderingHours } from '@/lib/hospitality/types'
import { cn, formatCurrency } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   <MenuBrowser> — the menu a guest orders from.

   Categories along the top, dishes underneath with a photo where there is
   one, and an Add button that opens the choices when a dish has them. The
   order sits in a rail on the right on desktop and in a bar at the bottom
   on a phone. Pickup or delivery is picked here and carried into checkout.
   ========================================================================== */

export interface MenuBrowserProps {
  menu: Menu
  ordering: OrderingHours
  currency: CurrencyCode
  slug: string
  taxRate: number
  /** "HH:MM" on the frozen clock, for the open/closed line. */
  nowTime: string
}

const MODE_OPTIONS: { value: CartMode; label: string; icon: typeof ShoppingBag }[] = [
  { value: 'pickup', label: 'Pickup', icon: ShoppingBag },
  { value: 'delivery', label: 'Delivery', icon: Bike },
]

export function MenuBrowser({ menu, ordering, currency, slug, taxRate, nowTime }: MenuBrowserProps) {
  const { cart, add, setQty, setMode, setZone } = useCart(slug)
  const [activeCategory, setActiveCategory] = React.useState(menu.categories[0]?.id ?? '')
  const [choosing, setChoosing] = React.useState<MenuItem | null>(null)
  const [cartOpen, setCartOpen] = React.useState(false)

  const categories = menu.categories.filter((c) => menu.items.some((i) => i.categoryId === c.id && i.status !== 'hidden'))
  const totals = cartTotals(cart, ordering.delivery.zones, taxRate)
  const window = ordering[cart.mode]
  const open = window.enabled && hm(nowTime) >= hm(window.startTime) && hm(nowTime) < hm(window.endTime)

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

  return (
    <section id="menu" className="scroll-mt-20 bg-background py-12 sm:py-16">
      <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-primary">The menu</p>
            <h2 className="mt-2 font-display text-display-sm font-semibold tracking-tight text-foreground">Order for pickup or delivery</h2>
            <p className="mt-2 max-w-[52ch] text-sm text-muted">
              {open ? `${cart.mode === 'pickup' ? 'Pickup' : 'Delivery'} is open until ${window.endTime}. Orders are ready in about ${window.leadMinutes} minutes.` : `${cart.mode === 'pickup' ? 'Pickup' : 'Delivery'} opens at ${window.startTime}. Order now for later.`}
            </p>
          </div>
          <Segmented size="md" label="Order type" options={MODE_OPTIONS} value={cart.mode} onValueChange={setMode} />
        </div>

        {/* ---------- category rail ---------- */}
        <div className="no-scrollbar sticky top-16 z-20 -mx-4 mt-8 flex gap-1 overflow-x-auto border-b border-line-subtle bg-background/90 px-4 py-2 backdrop-blur sm:top-[4.5rem] sm:mx-0 sm:px-0">
          {categories.map((c) => (
            <button key={c.id} type="button" aria-pressed={activeCategory === c.id} onClick={() => jump(c.id)} className={cn('shrink-0 rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors', activeCategory === c.id ? 'bg-foreground text-background' : 'text-muted hover:bg-surface-sunken hover:text-foreground')}>
              {c.name}
            </button>
          ))}
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem]">
          {/* ---------- dishes ---------- */}
          <div className="flex flex-col gap-12">
            {categories.map((c) => {
              const items = menu.items.filter((i) => i.categoryId === c.id && i.status !== 'hidden')
              return (
                <div key={c.id} id={`menu-${c.id}`} className="scroll-mt-32">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="font-display text-xl font-semibold tracking-tight text-foreground">{c.name}</h3>
                    {c.description ? <p className="text-sm text-subtle">{c.description}</p> : null}
                  </div>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {items.map((item) => {
                      const sellable = item.status === 'available' && item.channels.includes(cart.mode)
                      const inCart = cart.lines.filter((l) => l.itemId === item.id).reduce((s, l) => s + l.qty, 0)
                      return (
                        <li key={item.id} className={cn('flex gap-4 rounded-2xl border border-line bg-surface p-3 transition-colors', sellable ? 'hover:border-line-strong' : 'opacity-70')}>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-[0.9375rem] font-medium text-foreground">
                                {item.name}
                                {item.popular ? <Star aria-label="Popular" className="ml-1.5 inline size-3.5 fill-warning text-warning" /> : null}
                              </p>
                              <span className="shrink-0 text-[0.9375rem] text-foreground tabular-nums">{formatCurrency(item.price, currency)}</span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-sm text-muted">{item.description}</p>
                            <div className="mt-3 flex items-center justify-between gap-3">
                              <span className="text-xs text-subtle">
                                {item.tags.map((t) => DIETARY_META[t].short).join(' · ')}
                                {item.status === 'sold_out' ? 'Sold out today' : !item.channels.includes(cart.mode) ? `${cart.mode === 'delivery' ? 'Pickup or dine-in only' : 'Dine-in only'}` : ''}
                              </span>
                              {sellable ? (
                                inCart > 0 && item.modifiers.length === 0 ? (
                                  <span className="inline-flex items-center rounded-full border border-line">
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
                                )
                              ) : null}
                            </div>
                          </div>
                          {item.imageUrl ? (
                            <div className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-surface-sunken sm:size-28">
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
          </div>

          {/* ---------- order rail ---------- */}
          <aside className="hidden lg:block">
            <div className="sticky top-32 rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <CartBody slug={slug} ordering={ordering} currency={currency} taxRate={taxRate} onZone={setZone} />
            </div>
          </aside>
        </div>
      </div>

      {/* ---------- phone bar ---------- */}
      {totals.count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-3 backdrop-blur lg:hidden">
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
        <p className="rounded-xl bg-surface-sunken px-4 py-6 text-center text-sm text-muted">Nothing yet. Add a dish from the menu.</p>
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
