'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BedDouble, Bike, Clock, List, Minus, Phone, Plus, Printer, Search, ShoppingBag, Star, UtensilsCrossed, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { toast } from '@/components/ui/toaster'
import { useCart } from '@/hooks/use-cart'
import { useMenu } from '@/hooks/use-menu'
import { cartLineFrom, cartLineIssues, cartTotals, channelFor, choiceLines, readCartRaw, type CartLine, type CartMode } from '@/lib/cart'
import { hm } from '@/lib/hospitality/hours'
import { defaultSelection, priceSelection } from '@/lib/hospitality/menu-pricing'
import { DIETARY_META, type DietaryTag, type DishSelection, type Menu, type MenuItem, type OrderingHours, type ServicePeriod } from '@/lib/hospitality/types'
import { cn } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import { DishSheet, type DishSheetResult } from './dish-sheet'
import { availabilityNote, cardInfo, money, orderTime, type CardInfo } from './dish-sheet-model'

/* ==========================================================================
   <MenuBrowser> — the menu as rows of cards, the way the experiences
   storefront sells a day out.

   A sticky bar carries how the food arrives (pickup, delivery, or up to
   the room at a hotel), how long it takes, a search box and the section
   chips. Below, "Most ordered" and every section as a row of photo cards:
   picture, badge, name, a line about it, a dietary pill, the price and an
   Add. The order lives in a bottom bar and opens as a sheet. Printing
   drops the shop and leaves the menu.
   ========================================================================== */

export interface MenuBrowserProps {
  /** The seeded menu; the owner's saved edits are laid over it. */
  menu: Menu
  /** Whose menu edits to read. */
  tenantId: string
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
  /** Section heading; defaults to "The menu". */
  eyebrow?: string
  title?: string
  /** How a first-time visitor gets the food; hotels start on room service. */
  defaultMode?: CartMode
}

const LEGEND: DietaryTag[] = ['vegetarian', 'vegan', 'gluten_free', 'dairy_free', 'nuts', 'shellfish']
const MODE_ICON: Record<CartMode, typeof ShoppingBag> = { pickup: ShoppingBag, delivery: Bike, room: BedDouble }
const MODE_LABEL: Record<CartMode, string> = { pickup: 'Pickup', delivery: 'Delivery', room: 'Room service' }

/** The dish sheet's state: a new dish, or a cart line being changed. */
export interface Choosing {
  item: MenuItem
  edit?: { key: string; selection: DishSelection; qty: number; note: string | null }
}

/** Opens a cart line in the dish sheet; null when it can't be edited (no picks kept, or the dish is gone). */
export function choosingFor(menu: Menu, line: CartLine): Choosing | null {
  const item = menu.items.find((i) => i.id === line.itemId)
  if (!item || !line.selection) return null
  return { item, edit: { key: line.key, selection: line.selection, qty: line.qty, note: line.note } }
}

export function MenuBrowser({ menu: seed, tenantId, ordering, periods, currency, slug, taxRate, nowTime, weekday, phone, eyebrow = 'The menu', title, defaultMode }: MenuBrowserProps) {
  const { menu } = useMenu(tenantId, seed)
  const { cart, add, replaceLine, setQty, setMode, setZone, setWhen, reprice } = useCart(slug)
  const [query, setQuery] = React.useState('')
  const [activeCategory, setActiveCategory] = React.useState('popular')
  const [choosing, setChoosing] = React.useState<Choosing | null>(null)
  const [cartOpen, setCartOpen] = React.useState(false)
  const [jumpOpen, setJumpOpen] = React.useState(false)

  const modes: CartMode[] = [...(ordering.roomService.enabled ? (['room'] as CartMode[]) : []), 'pickup', 'delivery']
  const mode: CartMode = modes.includes(cart.mode) ? cart.mode : modes[0]
  const channel = channelFor(mode)
  const hours = mode === 'room' ? ordering.roomService : ordering[mode]
  const now = hm(nowTime)
  const open = hours.enabled && now >= hm(hours.startTime) && now < hm(hours.endTime)
  const lead = hours.leadMinutes + (mode === 'delivery' ? ordering.delivery.zones[0]?.minutes ?? 0 : 0)

  const categories = menu.categories.filter((c) => menu.items.some((i) => i.categoryId === c.id && i.status !== 'hidden'))
  const visible = menu.items.filter((i) => i.status !== 'hidden')
  const popular = visible.filter((i) => i.popular && i.status === 'available').slice(0, 8)
  const totals = cartTotals({ ...cart, mode }, ordering, taxRate)
  const needle = query.trim().toLowerCase()
  const results = needle ? visible.filter((i) => i.name.toLowerCase().includes(needle) || i.description.toLowerCase().includes(needle) || i.tags.some((t) => DIETARY_META[t].label.toLowerCase().includes(needle))) : []
  const service = periods.find((p) => p.weekdays.includes(weekday) && hm(p.startTime) <= now && hm(p.endTime) > now)
  const nextService = periods.find((p) => p.weekdays.includes(weekday) && hm(p.startTime) > now)
  const time = orderTime(cart.when, nowTime)
  const infos = React.useMemo(() => new Map(menu.items.map((i) => [i.id, cardInfo(menu, i)])), [menu])

  /* ---------- lines with picks follow the live menu's prices ---------- */

  React.useEffect(() => {
    reprice(menu)
  }, [menu, cart, reprice])

  /* ---------- first visit: start on the house default ---------- */

  React.useEffect(() => {
    if (defaultMode && modes.includes(defaultMode) && !readCartRaw(slug)) setMode(defaultMode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, defaultMode])

  /* ---------- scroll spy ---------- */

  React.useEffect(() => {
    if (needle) return
    const ids = ['popular', ...categories.map((c) => c.id)]
    const sections = ids.map((id) => document.getElementById(`menu-${id}`)).filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (top) setActiveCategory(top.target.id.replace('menu-', ''))
      },
      { rootMargin: '-40% 0px -50% 0px' },
    )
    for (const el of sections) observer.observe(el)
    return () => observer.disconnect()
  }, [categories, needle])

  const jump = (id: string) => {
    setQuery('')
    setActiveCategory(id)
    setJumpOpen(false)
    requestAnimationFrame(() => document.getElementById(`menu-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const openDish = (item: MenuItem) => setChoosing({ item })

  const quickAdd = (item: MenuItem) => {
    if (infos.get(item.id)?.choices) {
      openDish(item)
      return
    }
    if (cart.mode !== mode) setMode(mode)
    const selection = defaultSelection(menu, item)
    const priced = priceSelection(menu, selection)
    add(cartLineFrom(menu, selection, null, priced))
    toast.success(`${item.name} added`, { description: money(priced.unitPrice, currency) })
  }

  const edit = (line: CartLine) => {
    const next = choosingFor(menu, line)
    if (next) setChoosing(next)
  }

  const submit = ({ selection, qty, note, priced }: DishSheetResult) => {
    if (!choosing) return
    if (cart.mode !== mode) setMode(mode)
    const line = cartLineFrom(menu, selection, note, priced)
    if (choosing.edit) {
      replaceLine(choosing.edit.key, line, qty)
      toast.success(`${line.name} updated`)
    } else {
      add(line, qty)
      toast.success(`${line.name} added`, { description: priced.summary.join(' · ') || undefined })
    }
    setChoosing(null)
  }

  const qtyOf = (item: MenuItem) => cart.lines.filter((l) => l.itemId === item.id).reduce((s, l) => s + l.qty, 0)
  const card = (item: MenuItem, showPopular = true) => (
    <DishCard
      key={item.id}
      item={item}
      info={infos.get(item.id) ?? cardInfo(menu, item)}
      badge={availabilityNote(menu, item, weekday, time).badge}
      currency={currency}
      channel={channel}
      inCart={qtyOf(item)}
      showPopular={showPopular}
      onOpen={() => openDish(item)}
      onAdd={() => quickAdd(item)}
      onLess={() => {
        const line = cart.lines.find((l) => l.itemId === item.id)
        if (line) setQty(line.key, line.qty - 1)
      }}
    />
  )

  return (
    <section id="menu" className="scroll-mt-16 bg-background pb-16 sm:scroll-mt-[4.5rem] print:pb-0">
      {/* ---------- sticky bar ---------- */}
      <div className="sticky top-16 z-20 border-b border-line-subtle bg-background/95 backdrop-blur sm:top-[4.5rem] print:static print:hidden">
        <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-3 px-4 py-3 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented size="md" label="How you get it" options={modes.map((m) => ({ value: m, label: MODE_LABEL[m], icon: MODE_ICON[m] }))} value={mode} onValueChange={setMode} />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm text-muted">
                <Clock className="size-4" aria-hidden="true" />
                {open ? `Usually ready in ~${lead} min` : `${MODE_LABEL[mode]} opens ${hours.startTime}`}
              </span>
              {totals.count > 0 ? (
                <Button size="sm" variant="outline" leftIcon={<ShoppingBag aria-hidden="true" />} onClick={() => setCartOpen(true)} className="hidden sm:inline-flex">
                  Order · {totals.count}
                </Button>
              ) : null}
            </div>
          </div>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the menu…" leftIcon={<Search />} aria-label="Search the menu" size="lg" rightIcon={query ? <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X className="size-4" /></button> : undefined} />
          <div className="flex items-center gap-2">
            <button type="button" aria-label="All sections" onClick={() => setJumpOpen(true)} className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted hover:text-foreground">
              <List className="size-4" aria-hidden="true" />
            </button>
            <div className="no-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
              {popular.length ? <Chip active={!needle && activeCategory === 'popular'} onClick={() => jump('popular')}>Most ordered</Chip> : null}
              {categories.map((c) => (
                <Chip key={c.id} active={!needle && activeCategory === c.id} onClick={() => jump(c.id)}>
                  {c.name}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[88rem] px-4 sm:px-6 lg:px-10">
        {/* ---------- head ---------- */}
        <div className="flex flex-col gap-4 pt-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
            <h2 className="mt-2 font-display text-display-sm font-semibold tracking-tight text-foreground">{title ?? (service ? `${service.name}, served until ${service.endTime}` : nextService ? `${nextService.name} from ${nextService.startTime}` : 'Closed for today')}</h2>
            <p className="mt-2 max-w-[60ch] text-sm text-muted">{periods.map((p) => `${p.name} ${p.startTime}–${p.endTime}`).join(' · ')}. Tables are booked by phone on {phone}.</p>
          </div>
          <Button variant="ghost" size="sm" leftIcon={<Printer aria-hidden="true" />} className="hidden sm:inline-flex print:hidden" onClick={() => window.print()}>
            Print the menu
          </Button>
        </div>

        {/* ---------- search results ---------- */}
        {needle ? (
          <div className="mt-8">
            <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground">
              {results.length ? `${results.length} ${results.length === 1 ? 'dish' : 'dishes'} for “${query.trim()}”` : `Nothing for “${query.trim()}”`}
            </h3>
            {results.length ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{results.map((i) => card(i))}</div> : <p className="mt-2 text-sm text-muted">Try a dish, an ingredient, or a word like vegan.</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-12 pt-8">
            {popular.length ? (
              <Row id="popular" title="Most ordered" description="What the kitchen sends out most.">
                {popular.map((item) => card(item, false))}
              </Row>
            ) : null}
            {categories.map((c) => (
              <Row key={c.id} id={c.id} title={c.name} description={c.description}>
                {visible.filter((i) => i.categoryId === c.id).map((i) => card(i))}
              </Row>
            ))}
          </div>
        )}

        {/* ---------- legend ---------- */}
        <dl className="mt-12 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-line-subtle pt-5 text-xs text-subtle">
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

      {/* ---------- order bar ---------- */}
      {totals.count > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 p-3 backdrop-blur sm:hidden print:hidden">
          <Button fullWidth size="lg" onClick={() => setCartOpen(true)}>
            View order · {totals.count} {totals.count === 1 ? 'item' : 'items'} · {money(totals.total, currency)}
          </Button>
        </div>
      ) : null}
      {totals.count > 0 ? (
        <div className="fixed right-6 bottom-6 z-40 hidden sm:block print:hidden">
          <Button size="lg" leftIcon={<ShoppingBag aria-hidden="true" />} className="shadow-lg" onClick={() => setCartOpen(true)}>
            View order · {totals.count} · {money(totals.total, currency)}
          </Button>
        </div>
      ) : null}

      <Sheet open={cartOpen} onOpenChange={setCartOpen}>
        <SheetContent side="right" size="md">
          <SheetHeader>
            <SheetTitle>Your order</SheetTitle>
            <SheetDescription>{mode === 'room' ? 'Sent up to your room' : mode === 'pickup' ? 'For pickup' : 'For delivery'}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <CartBody slug={slug} menu={menu} ordering={ordering} currency={currency} taxRate={taxRate} modes={modes} onZone={setZone} onEdit={edit} />
          </SheetBody>
          <SheetFooter>
            <Button variant="ghost" size="sm" onClick={() => setCartOpen(false)}>
              Keep browsing
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={jumpOpen} onOpenChange={setJumpOpen}>
        <SheetContent side="left" size="sm">
          <SheetHeader>
            <SheetTitle>The menu</SheetTitle>
            <SheetDescription>Jump to a section.</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <ul className="flex flex-col">
              {popular.length ? (
                <li>
                  <button type="button" onClick={() => jump('popular')} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-sunken">
                    Most ordered <span className="text-xs text-subtle">{popular.length}</span>
                  </button>
                </li>
              ) : null}
              {categories.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => jump(c.id)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-sunken">
                    {c.name} <span className="text-xs text-subtle">{visible.filter((i) => i.categoryId === c.id).length}</span>
                  </button>
                </li>
              ))}
            </ul>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <DishSheet
        menu={menu}
        item={choosing?.item ?? null}
        currency={currency}
        channel={channel}
        weekday={weekday}
        when={cart.when}
        nowTime={nowTime}
        phone={phone}
        initial={choosing?.edit}
        submitLabel={choosing?.edit ? 'update' : 'add'}
        onClose={() => setChoosing(null)}
        onSubmit={submit}
        onOrderForLater={(at) => {
          setWhen(at)
          toast(`Ordering for ${at}`, { description: 'You can change the time at checkout.' })
        }}
      />
    </section>
  )
}

/* --------------------------------------------------------------------------
   Pieces
   -------------------------------------------------------------------------- */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-[0.8125rem] font-medium transition-colors', active ? 'border-foreground bg-foreground text-background' : 'border-line bg-surface text-muted hover:border-line-strong hover:text-foreground')}>
      {children}
    </button>
  )
}

function Row({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <div id={`menu-${id}`} className="scroll-mt-52 break-inside-avoid">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground">{title}</h3>
        {description ? <p className="text-sm text-subtle">{description}</p> : null}
      </div>
      <ul className="no-scrollbar -mx-4 mt-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0 print:flex-wrap print:overflow-visible">{children}</ul>
    </div>
  )
}

function DishCard({ item, info, badge, currency, channel, inCart, showPopular = true, onOpen, onAdd, onLess }: { item: MenuItem; info: CardInfo; badge: string | null; currency: CurrencyCode; channel: 'dine_in' | 'pickup' | 'delivery'; inCart: number; showPopular?: boolean; onOpen: () => void; onAdd: () => void; onLess: () => void }) {
  const soldOut = item.status === 'sold_out' || badge === 'Sold out'
  const offChannel = !item.channels.includes(channel)
  const sellable = !soldOut && !offChannel
  /** "From 12:30", "Breakfast only": still orderable for later. */
  const later = !soldOut && badge && badge !== 'Sold out today' ? badge : null
  return (
    <li className={cn('flex w-60 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors sm:w-64 print:w-full print:flex-row print:rounded-none print:border-0 print:border-b', sellable ? 'hover:border-line-strong' : 'opacity-70')}>
      <button type="button" disabled={!sellable} onClick={info.opens ? onOpen : onAdd} aria-label={info.opens ? `${item.name}, see details` : `Add ${item.name}`} className="group relative block aspect-[4/3] w-full bg-surface-sunken text-left disabled:cursor-default print:hidden">
        {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="256px" className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" /> : <UtensilsCrossed className="absolute inset-0 m-auto size-8 text-faint" aria-hidden="true" />}
        {soldOut ? (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-foreground">Sold out today</span>
        ) : later ? (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-foreground">
            <Clock className="size-3" aria-hidden="true" />
            {later}
          </span>
        ) : item.popular && showPopular ? (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-on-primary">Most ordered</span>
        ) : offChannel ? (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-surface/95 px-2.5 py-1 text-xs font-semibold text-muted">{channel === 'delivery' ? 'Not on delivery' : 'In the restaurant'}</span>
        ) : null}
      </button>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[0.9375rem] font-semibold leading-snug text-foreground">{item.name}</p>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{item.description}</p>
        {info.pills.length ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {info.pills.map((p) => (
              <span key={p} className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-muted">
                {p}
              </span>
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <p className="text-[0.9375rem] font-semibold text-foreground tabular-nums">
            {info.from ? <span className="text-xs font-normal text-subtle">from </span> : null}
            {money(info.price, currency)} <span className="text-xs font-normal text-subtle">· {item.prepMinutes} min</span>
          </p>
          {sellable ? (
            inCart > 0 && !info.choices ? (
              <span className="inline-flex items-center rounded-full border border-line print:hidden">
                <button type="button" aria-label={`One fewer ${item.name}`} className="grid size-9 place-items-center text-muted" onClick={onLess}>
                  <Minus className="size-3.5" />
                </button>
                <span className="min-w-[1.25rem] text-center text-sm tabular-nums">{inCart}</span>
                <button type="button" aria-label={`One more ${item.name}`} className="grid size-9 place-items-center text-muted" onClick={onAdd}>
                  <Plus className="size-3.5" />
                </button>
              </span>
            ) : (
              <button type="button" aria-label={info.choices ? `Choose and add ${item.name}` : `Add ${item.name}`} onClick={info.choices ? onOpen : onAdd} className="relative grid size-10 place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-105 print:hidden">
                <Plus className="size-4" />
                {inCart > 0 ? (
                  <>
                    <span aria-hidden="true" className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-semibold text-on-primary tabular-nums">
                      {inCart}
                    </span>
                    <span className="sr-only">{inCart} in order</span>
                  </>
                ) : null}
              </button>
            )
          ) : null}
        </div>
      </div>
    </li>
  )
}

/* --------------------------------------------------------------------------
   Cart body — the sheet
   -------------------------------------------------------------------------- */

export function CartBody({ slug, menu, ordering, currency, taxRate, modes, onZone, onEdit }: { slug: string; menu: Menu; ordering: OrderingHours; currency: CurrencyCode; taxRate: number; modes: CartMode[]; onZone: (zoneId: string | null) => void; onEdit?: (line: CartLine) => void }) {
  const { cart, setQty, setMode } = useCart(slug)
  const mode: CartMode = modes.includes(cart.mode) ? cart.mode : modes[0]
  const totals = cartTotals({ ...cart, mode }, ordering, taxRate)
  const zone = ordering.delivery.zones.find((z) => z.id === cart.zoneId) ?? ordering.delivery.zones[0]

  return (
    <div className="flex flex-col gap-4">
      <Segmented size="sm" label="How you get it" options={modes.map((m) => ({ value: m, label: MODE_LABEL[m], icon: MODE_ICON[m] }))} value={mode} onValueChange={setMode} fullWidth />

      {cart.lines.length === 0 ? (
        <p className="rounded-xl bg-surface-sunken px-4 py-6 text-center text-sm text-muted">Nothing yet. Tap a dish to add it.</p>
      ) : (
        <ul className="divide-y divide-line-subtle">
          {cart.lines.map((line) => {
            const issue = cartLineIssues(menu, line)[0] ?? null
            const editable = Boolean(onEdit && choosingFor(menu, line))
            return (
              <li key={line.key} className="flex items-start gap-3 py-3 first:pt-0">
                <span className="inline-flex shrink-0 items-center rounded-full border border-line">
                  <button type="button" aria-label={`One fewer ${line.name}`} className="grid size-8 place-items-center text-muted" onClick={() => setQty(line.key, line.qty - 1)}>
                    <Minus className="size-3" />
                  </button>
                  <span className="min-w-[1.25rem] text-center text-xs tabular-nums">{line.qty}</span>
                  <button type="button" aria-label={`One more ${line.name}`} className="grid size-8 place-items-center text-muted" onClick={() => setQty(line.key, line.qty + 1)}>
                    <Plus className="size-3" />
                  </button>
                </span>
                <CartLineDetails line={line} issue={issue} onEdit={editable ? () => onEdit?.(line) : undefined} />
                <span className="shrink-0 text-sm text-foreground tabular-nums">{money(line.unitPrice * line.qty, currency)}</span>
              </li>
            )
          })}
        </ul>
      )}

      {mode === 'delivery' ? (
        <div>
          <p className="text-xs font-medium text-muted">Deliver to</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {ordering.delivery.zones.map((z) => (
              <button key={z.id} type="button" aria-pressed={zone?.id === z.id} onClick={() => onZone(z.id)} className={cn('rounded-md border px-2.5 py-1.5 text-xs transition-colors', zone?.id === z.id ? 'border-foreground bg-foreground text-background' : 'border-line text-muted hover:border-line-strong')}>
                {z.name} · {money(z.fee, currency)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {mode === 'room' ? <p className="text-xs text-subtle">You will give your room number at checkout. The order is charged to the room.</p> : null}

      {cart.lines.length ? (
        <dl className="flex flex-col gap-1 border-t border-line-subtle pt-3 text-sm text-muted">
          <div className="flex justify-between">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{money(totals.subtotal, currency)}</dd>
          </div>
          {totals.deliveryFee ? (
            <div className="flex justify-between">
              <dt>Delivery · {zone?.name}</dt>
              <dd className="tabular-nums">{money(totals.deliveryFee, currency)}</dd>
            </div>
          ) : null}
          {totals.serviceFee ? (
            <div className="flex justify-between">
              <dt>{mode === 'room' ? 'Tray charge' : 'Service fee'}</dt>
              <dd className="tabular-nums">{money(totals.serviceFee, currency)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>Tax</dt>
            <dd className="tabular-nums">{money(totals.tax, currency)}</dd>
          </div>
          <div className="flex justify-between pt-1 text-base font-medium text-foreground">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(totals.total, currency)}</dd>
          </div>
        </dl>
      ) : null}

      {totals.belowMinimum ? <p className="text-xs text-warning">Minimum order for {zone?.name} is {money(totals.minOrder, currency)}.</p> : null}

      <Button asChild size="lg" fullWidth className={cn((cart.lines.length === 0 || totals.belowMinimum) && 'pointer-events-none opacity-50')}>
        <Link href={`/book/${slug}/order`}>{mode === 'room' ? 'Send to my room' : mode === 'pickup' ? 'Checkout for pickup' : 'Checkout for delivery'}</Link>
      </Button>
      <p className="text-center text-xs text-subtle">
        {mode === 'room' ? `Up in about ${ordering.roomService.leadMinutes} minutes.` : mode === 'pickup' ? `Ready in about ${ordering.pickup.leadMinutes} minutes, or pick a time at checkout.` : `About ${ordering.delivery.leadMinutes + (zone?.minutes ?? 0)} minutes door to door.`}
      </p>
    </div>
  )
}

/* --------------------------------------------------------------------------
   One cart line's words — shared with checkout
   -------------------------------------------------------------------------- */

/** Name and size, a muted line per kind of pick ("+2 more" past three), the note, and a problem with an Edit link. */
export function CartLineDetails({ line, issue, onEdit, className }: { line: CartLine; issue?: string | null; onEdit?: () => void; className?: string }) {
  const { lines, more } = choiceLines(line)
  return (
    <span className={cn('min-w-0 flex-1', className)}>
      <span className="block text-sm text-foreground">
        {line.name}
        {line.variant ? <span className="text-muted"> · {line.variant}</span> : null}
      </span>
      {lines.map((text, index) => (
        <span key={index} className="block text-xs leading-relaxed text-subtle">
          {text}
        </span>
      ))}
      {more ? <span className="block text-xs text-subtle">+{more} more</span> : null}
      {line.note ? <span className="block truncate text-xs text-subtle">“{line.note}”</span> : null}
      {issue ? (
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs font-medium text-danger">
          <span>{issue}</span>
          {onEdit ? (
            <>
              <span aria-hidden="true">·</span>
              <button type="button" onClick={onEdit} className="inline-flex min-h-8 items-center underline underline-offset-2">
                Edit
              </button>
            </>
          ) : null}
        </span>
      ) : onEdit ? (
        <button type="button" onClick={onEdit} aria-label={`Edit ${line.name}`} className="-ml-0.5 inline-flex min-h-8 items-center px-0.5 text-xs font-medium text-primary hover:underline">
          Edit
        </button>
      ) : null}
    </span>
  )
}
