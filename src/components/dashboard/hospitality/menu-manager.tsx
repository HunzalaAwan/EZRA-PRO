'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Bike, Check, ChevronDown, ChevronUp, Clock, ImageOff, LayoutGrid, List, MoreHorizontal, Pencil, Plus, RotateCcw, ShoppingBag, Star, Trash2, UtensilsCrossed, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { useMenu } from '@/hooks/use-menu'
import { availabilityText, dishFromPrice, newMenuId } from '@/lib/hospitality/menu-pricing'
import { DIETARY_META, ORDER_CHANNEL_LABEL, type Menu, type MenuCategory, type MenuItem, type MenuItemStatus, type MenuOptionGroup, type OrderChannel, type TimeWindow } from '@/lib/hospitality/types'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import { ChoiceGroupsLibrary } from './choice-groups-library'
import { DishEditor, TimeWindowsEditor } from './dish-editor'
import { choicesLine, linkedFrom, money, soldOutSections, updateSize, type SoldOutSection } from './menu-editor-model'
import { BandHeader, StatTile, StatusWord } from './shared'

/* ==========================================================================
   <MenuManager> — the board, as a list or a grid you can edit.

   Sections across the top (yours to name, add, reorder and time), dishes
   underneath: photo, name, price, choices, where it sells, how it did this
   month. Edits are saved in this browser and the ordering page reads them.
   The switch is the one you reach for at 20:40 when the fish runs out; the
   row menu turns off a single option, like the halloumi.
   ========================================================================== */

type Filter = 'all' | 'available' | 'sold_out' | 'hidden' | 'popular'
type View = 'list' | 'grid'
type Pane = 'dishes' | 'groups'

const CHANNEL_ICON: Record<OrderChannel, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true'; 'aria-label'?: string }>> = {
  dine_in: UtensilsCrossed,
  pickup: ShoppingBag,
  delivery: Bike,
}

const STATUS_META: Record<MenuItemStatus, { label: string; tone: string }> = {
  available: { label: 'On sale', tone: 'bg-success' },
  sold_out: { label: 'Sold out', tone: 'bg-danger' },
  hidden: { label: 'Hidden', tone: 'bg-line-strong' },
}

const SERVICES: { value: MenuCategory['service']; label: string }[] = [
  { value: 'all', label: 'Every service' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'drinks', label: 'Drinks' },
]

/** Hosts next/image is set up for; anything else (a pasted link, a dropped file) is a plain img. */
const OPTIMISED = /^https:\/\/images\.(unsplash|pexels)\.com\//

function DishPhoto({ url, sizes, iconClassName }: { url?: string; sizes: string; iconClassName?: string }) {
  if (!url) return <ImageOff aria-hidden="true" className={cn('absolute inset-0 m-auto text-faint', iconClassName ?? 'size-4')} />
  if (OPTIMISED.test(url)) return <Image src={url} alt="" fill sizes={sizes} className="object-cover" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
}

export interface MenuManagerProps {
  /** The seeded menu; the owner's saved edits are laid over it. */
  menu: Menu
  tenantId: string
  currency: CurrencyCode
  storefrontHref: string
  hotel: boolean
}

export function MenuManager({ menu: seed, tenantId, currency, storefrontHref, hotel }: MenuManagerProps) {
  const live = useMenu(tenantId, seed)
  const { menu } = live
  const items = menu.items
  const categories = React.useMemo(() => [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder), [menu.categories])
  const [pane, setPane] = React.useState<Pane>('dishes')
  const [categoryId, setCategoryId] = React.useState<string>('all')
  const [filter, setFilter] = React.useState<Filter>('all')
  const [view, setView] = React.useState<View>('list')
  const [query, setQuery] = React.useState('')
  const [editor, setEditor] = React.useState<{ item: MenuItem | null } | null>(null)
  const [sections, setSections] = React.useState<'closed' | 'manage' | 'new'>('closed')
  const [soldOutId, setSoldOutId] = React.useState<string | null>(null)
  const [resetting, setResetting] = React.useState(false)

  const categoryById = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const activeCategoryId = categoryId === 'all' || categoryById.has(categoryId) ? categoryId : 'all'

  const stats = React.useMemo(() => {
    const onSale = items.filter((i) => i.status === 'available').length
    const soldOut = items.filter((i) => i.status === 'sold_out').length
    const top = [...items].sort((a, b) => b.sold30d - a.sold30d)[0]
    const revenue = items.reduce((s, i) => s + i.revenue30d, 0)
    const delivery = items.filter((i) => i.channels.includes('delivery')).length
    return { onSale, soldOut, top, revenue, delivery }
  }, [items])

  const visible = React.useMemo(() => {
    const needle = query.trim().toLowerCase()
    return items
      .filter((i) => (activeCategoryId === 'all' ? true : i.categoryId === activeCategoryId))
      .filter((i) => {
        switch (filter) {
          case 'available':
            return i.status === 'available'
          case 'sold_out':
            return i.status === 'sold_out'
          case 'hidden':
            return i.status === 'hidden'
          case 'popular':
            return i.popular
          default:
            return true
        }
      })
      .filter((i) => (needle ? i.name.toLowerCase().includes(needle) || i.description.toLowerCase().includes(needle) : true))
      .sort((a, b) => (categoryById.get(a.categoryId)?.sortOrder ?? 0) - (categoryById.get(b.categoryId)?.sortOrder ?? 0) || b.sold30d - a.sold30d)
  }, [items, activeCategoryId, filter, query, categoryById])

  /* ---------- actions ---------- */

  const setStatus = (item: MenuItem, status: MenuItemStatus) => {
    live.setItemStatus(item.id, status)
    toast(status === 'sold_out' ? `${item.name} marked sold out` : status === 'hidden' ? `${item.name} hidden from the menu` : `${item.name} back on sale`, {
      description: status === 'sold_out' ? 'Off the storefront and the QR menu until you switch it back.' : undefined,
    })
  }

  const save = (item: MenuItem, library: MenuOptionGroup[]) => {
    const exists = items.some((i) => i.id === item.id)
    for (const group of library) live.saveSharedGroup(group)
    live.saveItem(item)
    const name = item.name.trim()
    if (exists) toast.success(`${name} saved`, { description: library.length ? `${library.length === 1 ? 'A saved group' : `${library.length} saved groups`} changed too.` : undefined })
    else toast.success(`${name} added to ${categoryById.get(item.categoryId)?.name ?? 'the menu'}`)
    setEditor(null)
  }

  const remove = (item: MenuItem) => {
    const links = linkedFrom(menu, item.id)
    live.removeItem(item.id)
    setEditor(null)
    toast(`${item.name} removed`, { description: links ? 'Meals and set menus no longer offer it. Past orders keep the line as it was.' : 'Past orders keep the line as it was.' })
  }

  const duplicate = (item: MenuItem) => {
    const copy: MenuItem = { ...(JSON.parse(JSON.stringify(item)) as MenuItem), id: newMenuId('mi'), name: `${item.name} (copy)`, sold30d: 0, revenue30d: 0, popular: false }
    live.saveItem(copy)
    setEditor({ item: copy })
  }

  /** Sections saved from the sheet: renamed, reordered, timed, added or removed. Dishes in a removed section move to the first one. */
  const saveSections = (next: MenuCategory[], removed: string[]) => {
    const ordered = next.map((c, i) => ({ ...c, sortOrder: i + 1 }))
    live.saveCategories(ordered, removed)
    if (removed.includes(categoryId)) setCategoryId('all')
    setSections('closed')
    const added = ordered.filter((c) => !categories.some((x) => x.id === c.id))
    toast.success(added.length === 1 ? `${added[0].name} added to the menu` : 'Sections saved', {
      description: removed.length ? `${removed.length === 1 ? 'One section' : `${removed.length} sections`} removed; the dishes moved to ${ordered[0]?.name ?? 'the menu'}.` : added.length > 1 ? `${added.length} new sections.` : undefined,
    })
  }

  const flipOption = (item: MenuItem, section: SoldOutSection, optionId: string, soldOut: boolean) => {
    if (section.scope === 'size') live.saveItem(updateSize(item, optionId, { soldOut: soldOut || undefined }))
    else if (section.shared) live.setOptionSoldOut({ groupId: section.shared.id, optionId }, soldOut)
    else live.setOptionSoldOut({ itemId: item.id, groupId: section.groupId, optionId }, soldOut)
  }

  const dishActions = (i: MenuItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton variant="ghost" size="xs" aria-label={`Actions for ${i.name}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => setEditor({ item: i })}>Edit</DropdownMenuItem>
        {soldOutSections(menu, i).length ? <DropdownMenuItem onSelect={() => setSoldOutId(i.id)}>Sold out options…</DropdownMenuItem> : null}
        <DropdownMenuItem onSelect={() => duplicate(i)}>Duplicate</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => live.saveItem({ ...i, popular: !i.popular })}>{i.popular ? 'Remove from popular' : 'Mark as popular'}</DropdownMenuItem>
        <DropdownMenuSeparator />
        {i.status !== 'sold_out' ? <DropdownMenuItem onSelect={() => setStatus(i, 'sold_out')}>Sold out for today</DropdownMenuItem> : null}
        {i.status !== 'hidden' ? <DropdownMenuItem onSelect={() => setStatus(i, 'hidden')}>Hide from the menu</DropdownMenuItem> : null}
        {i.status !== 'available' ? <DropdownMenuItem onSelect={() => setStatus(i, 'available')}>Back on sale</DropdownMenuItem> : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem tone="danger" onSelect={() => remove(i)}>
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  /** "from €6.50" when sizes or choices can change it. */
  const priceText = (i: MenuItem) => {
    const p = dishFromPrice(menu, i)
    return (
      <>
        {p.from ? <span className="text-xs text-subtle">from </span> : null}
        {money(p.price, currency)}
      </>
    )
  }

  /** "3 choice groups · meal", and why a hidden dish is still there. */
  const metaLine = (i: MenuItem) => {
    const parts: string[] = []
    const line = choicesLine(menu, i)
    if (line) parts.push(line)
    if (i.status === 'hidden' && linkedFrom(menu, i.id) > 0) parts.push('Only in meals and sets')
    if (i.availability?.length) parts.push(availabilityText(i.availability))
    return parts.length ? parts.join(' · ') : null
  }

  /* ---------- columns ---------- */

  const columns: DataTableColumn<MenuItem>[] = [
    {
      id: 'item',
      header: 'Dish',
      cell: (i) => {
        const meta = metaLine(i)
        return (
          <span className="flex min-w-[14rem] items-center gap-3">
            <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
              <DishPhoto url={i.imageUrl} sizes="40px" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[0.8125rem] text-foreground">{i.name}</span>
                {i.kind === 'set' ? <span className="shrink-0 rounded bg-surface-sunken px-1.5 text-xs text-muted">Set menu</span> : null}
                {i.popular ? <Star aria-label="Popular" className="size-3 shrink-0 fill-warning text-warning" /> : null}
              </span>
              <span className="block max-w-[22rem] truncate text-xs text-subtle">{i.description}</span>
              {meta ? <span className="block max-w-[22rem] truncate text-xs text-muted">{meta}</span> : null}
            </span>
          </span>
        )
      },
    },
    {
      id: 'price',
      header: 'Price',
      align: 'right',
      numeric: true,
      width: '7rem',
      cell: (i) => <span className="text-[0.8125rem] whitespace-nowrap text-foreground tabular-nums">{priceText(i)}</span>,
    },
    {
      id: 'tags',
      header: 'Diet',
      hideBelow: 'lg',
      width: '7rem',
      cell: (i) => (i.tags.length ? <span className="text-xs text-muted">{i.tags.map((t) => DIETARY_META[t].short).join(' · ')}</span> : <span className="text-xs text-faint">—</span>),
    },
    {
      id: 'channels',
      header: 'Sells',
      hideBelow: 'md',
      width: '6rem',
      cell: (i) => <Channels item={i} />,
    },
    { id: 'prep', header: 'Prep', hideBelow: 'xl', align: 'right', numeric: true, width: '4.5rem', cell: (i) => <span className="text-[0.8125rem] text-muted tabular-nums">{i.prepMinutes} min</span> },
    { id: 'sold', header: '30 days', hideBelow: 'lg', align: 'right', numeric: true, width: '5rem', cell: (i) => <span className="text-[0.8125rem] text-muted tabular-nums">{formatNumber(i.sold30d)}</span> },
    { id: 'revenue', header: 'Revenue', hideBelow: 'xl', align: 'right', numeric: true, width: '6rem', cell: (i) => <span className="text-[0.8125rem] text-muted tabular-nums">{formatCurrency(i.revenue30d, currency, { compact: true })}</span> },
    { id: 'status', header: 'Status', width: '6.5rem', cell: (i) => <StatusWord label={STATUS_META[i.status].label} tone={STATUS_META[i.status].tone} /> },
    {
      id: 'toggle',
      header: <span className="sr-only">On sale</span>,
      width: '3rem',
      cellClassName: 'pl-0',
      cell: (i) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Switch size="sm" checked={i.status === 'available'} onCheckedChange={(checked) => setStatus(i, checked ? 'available' : 'sold_out')} aria-label={`${i.name} on sale`} />
        </span>
      ),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      width: '3rem',
      cellClassName: 'pl-0',
      cell: (i) => dishActions(i),
    },
  ]

  const activeCategory = activeCategoryId === 'all' ? null : categoryById.get(activeCategoryId) ?? null
  const groups = activeCategoryId === 'all' ? categories.map((c) => ({ category: c, rows: visible.filter((i) => i.categoryId === c.id) })).filter((g) => g.rows.length > 0) : [{ category: activeCategory, rows: visible }]
  const soldOutItem = soldOutId ? items.find((i) => i.id === soldOutId) ?? null : null
  const savedCount = menu.sharedGroups?.length ?? 0
  const tabs: { id: string; name: string; hours?: TimeWindow[] | null }[] = [{ id: 'all', name: 'All' }, ...categories]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="On sale"
          hint={`of ${items.length} dishes`}
          value={stats.onSale}
          line={`${stats.delivery} also sell on delivery`}
          tone="bg-success"
          active={pane === 'dishes' && filter === 'available'}
          onClick={() => {
            setPane('dishes')
            setFilter(filter === 'available' ? 'all' : 'available')
          }}
        />
        <StatTile
          label="Sold out"
          hint="switched off"
          value={stats.soldOut}
          line={stats.soldOut ? 'Switch back on when it is in' : 'Everything is in'}
          tone="bg-danger"
          active={pane === 'dishes' && filter === 'sold_out'}
          onClick={() => {
            setPane('dishes')
            setFilter(filter === 'sold_out' ? 'all' : 'sold_out')
          }}
        />
        <StatTile label="Best seller" hint="last 30 days" value={stats.top ? formatNumber(stats.top.sold30d) : '—'} line={stats.top ? stats.top.name : 'No sales yet'} />
        <StatTile label="Menu revenue" hint="last 30 days" value={formatCurrency(stats.revenue, currency, { compact: true })} line={`${categories.length} sections`} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Show"
          options={[
            { value: 'dishes', label: 'Dishes', count: items.length },
            { value: 'groups', label: 'Choice groups', count: savedCount },
          ]}
          value={pane}
          onValueChange={setPane}
        />
        {live.edited ? (
          <Button size="sm" variant="ghost" leftIcon={<RotateCcw />} onClick={() => setResetting(true)}>
            Undo all menu changes
          </Button>
        ) : null}
      </div>

      {pane === 'groups' ? (
        <ChoiceGroupsLibrary
          menu={menu}
          currency={currency}
          onSave={live.saveSharedGroup}
          onRemove={live.removeSharedGroup}
          onOptionSoldOut={(groupId, optionId, soldOut) => live.setOptionSoldOut({ groupId, optionId }, soldOut)}
          onOpenDish={(item) => setEditor({ item })}
        />
      ) : (
        <Card className="min-w-0">
          <div className="flex flex-col gap-3 border-b border-line-subtle px-3 py-3 sm:px-4">
            <div className="flex items-center gap-2">
              <div className="no-scrollbar -mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1">
                {tabs.map((c) => {
                  const active = c.id === activeCategoryId
                  const count = c.id === 'all' ? items.length : items.filter((i) => i.categoryId === c.id).length
                  return (
                    <button key={c.id} type="button" aria-pressed={active} onClick={() => setCategoryId(c.id)} title={c.hours?.length ? availabilityText(c.hours) : undefined} className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.8125rem] transition-colors', active ? 'bg-foreground text-background' : 'text-muted hover:bg-surface-sunken hover:text-foreground')}>
                      {c.hours?.length ? <Clock aria-label="Set hours" className="size-3" /> : null}
                      {c.name}
                      <span className={cn('text-xs tabular-nums', active ? 'text-background/70' : 'text-faint')}>{count}</span>
                    </button>
                  )
                })}
                <button type="button" onClick={() => setSections('new')} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-line px-2.5 py-1.5 text-[0.8125rem] text-muted transition-colors hover:border-line-strong hover:text-foreground">
                  <Plus className="size-3.5" aria-hidden="true" />
                  Section
                </button>
              </div>
              <Button size="sm" variant="ghost" leftIcon={<Pencil />} className="shrink-0" onClick={() => setSections('manage')}>
                <span className="hidden sm:inline">Sections and hours</span>
                <span className="sm:hidden">Sections</span>
              </Button>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <SearchInput value={query} onValueChange={setQuery} placeholder="Search dishes…" size="sm" aria-label="Search the menu" fieldClassName="w-full sm:w-56" />
                <Segmented
                  size="sm"
                  label="Filter"
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'popular', label: 'Popular' },
                    { value: 'sold_out', label: 'Sold out' },
                    { value: 'hidden', label: 'Hidden' },
                  ]}
                  value={filter}
                  onValueChange={setFilter}
                />
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Segmented
                  size="sm"
                  label="View"
                  options={[
                    { value: 'list', label: 'List', icon: List },
                    { value: 'grid', label: 'Grid', icon: LayoutGrid },
                  ]}
                  value={view}
                  onValueChange={setView}
                  hideLabelsOnMobile
                />
                <Button asChild size="sm" variant="outline" rightIcon={<ArrowUpRight />}>
                  <Link href={storefrontHref} target="_blank">
                    See it as a guest
                  </Link>
                </Button>
                <Button size="sm" leftIcon={<Plus />} onClick={() => setEditor({ item: null })}>
                  Add a dish
                </Button>
              </div>
            </div>
          </div>

          {view === 'list' ? (
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                rows={visible}
                getRowId={(i) => i.id}
                onRowClick={(i) => setEditor({ item: i })}
                stickyHeader
                rowHeight="comfortable"
                ariaLabel="Menu"
                groupBy={activeCategoryId === 'all' ? (i) => i.categoryId : undefined}
                renderGroupHeader={(key, rows) => {
                  const c = categoryById.get(key)
                  const hours = c?.hours?.length ? ` · ${availabilityText(c.hours)}` : ''
                  return <BandHeader title={c ? `${c.name}${hours}${c.description ? ` · ${c.description}` : ''}` : key} right={`${rows.length} · ${formatCurrency(rows.reduce((s, i) => s + i.revenue30d, 0), currency, { compact: true })} in 30 days`} />
                }}
                getRowClassName={(i) => (i.status === 'available' ? undefined : 'opacity-60')}
                empty={<EmptyState variant="no-results" size="sm" title="Nothing on this part of the menu" description="Add a dish or clear the filter." />}
              />
            </CardContent>
          ) : (
            <CardContent className="flex flex-col gap-8 p-4 sm:p-5">
              {visible.length === 0 ? (
                <EmptyState variant="no-results" size="sm" title="Nothing on this part of the menu" description="Add a dish or clear the filter." />
              ) : (
                groups.map(({ category, rows }) => (
                  <section key={category?.id ?? 'all'} aria-label={category?.name ?? 'Dishes'}>
                    {category ? (
                      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <h3 className="text-[0.9375rem] font-semibold text-foreground">
                          {category.name}
                          {category.hours?.length ? <span className="ml-2 text-sm font-normal text-muted">{availabilityText(category.hours)}</span> : null}
                          {category.description ? <span className="ml-2 text-sm font-normal text-subtle">{category.description}</span> : null}
                        </h3>
                        <span className="text-xs text-subtle tabular-nums">
                          {rows.length} {rows.length === 1 ? 'dish' : 'dishes'} · {formatCurrency(rows.reduce((s, i) => s + i.revenue30d, 0), currency, { compact: true })} in 30 days
                        </span>
                      </div>
                    ) : null}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                      {rows.map((i) => (
                        <DishCard key={i.id} item={i} price={priceText(i)} meta={metaLine(i)} onOpen={() => setEditor({ item: i })} onToggle={(on) => setStatus(i, on ? 'available' : 'sold_out')} actions={dishActions(i)} />
                      ))}
                    </div>
                  </section>
                ))
              )}
            </CardContent>
          )}
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{hotel ? 'Room service' : 'Tasting menus and events'}</CardTitle>
            <CardDescription>
              {hotel ? 'Dishes marked for room service are offered to rooms from the storefront and the QR card. Orders arrive on the pass with the room number and charge to the folio.' : 'Prepaid seatings with a fixed menu — the chef’s counter, the sunset tasting — live under Experiences, with their own dates, prices and deposits.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline" rightIcon={<ArrowUpRight />}>
              <Link href={hotel ? '/dashboard/orders' : '/dashboard/activities'}>{hotel ? 'Open the pass' : 'Open experiences'}</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Where the menu shows</CardTitle>
            <CardDescription>The storefront, the QR card on every table, and phone orders. A change here shows on the ordering page straight away.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/storefront">Storefront settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <DishEditor
        open={editor !== null}
        item={editor?.item ?? null}
        menu={menu}
        currency={currency}
        tenantId={tenantId}
        defaultCategoryId={activeCategoryId === 'all' ? categories[0]?.id ?? '' : activeCategoryId}
        onClose={() => setEditor(null)}
        onSave={save}
        onRemove={remove}
        onEditSections={() => setSections('manage')}
      />
      <SectionsSheet mode={sections} categories={categories} items={items} tenantId={tenantId} onClose={() => setSections('closed')} onSave={saveSections} />
      <SoldOutOptionsDialog item={soldOutItem} menu={menu} onClose={() => setSoldOutId(null)} onFlip={flipOption} />

      <Dialog open={resetting} onOpenChange={setResetting}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Undo all menu changes?</DialogTitle>
            <DialogDescription>Dishes, sections, saved groups and sold-out switches go back to how the menu started.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setResetting(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                live.reset()
                setResetting(false)
                toast('Menu back to how it started')
              }}
            >
              Undo changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* --------------------------------------------------------------------------
   Sold out options — switch off one option mid-service
   -------------------------------------------------------------------------- */

function SoldOutOptionsDialog({ item, menu, onClose, onFlip }: { item: MenuItem | null; menu: Menu; onClose: () => void; onFlip: (item: MenuItem, section: SoldOutSection, optionId: string, soldOut: boolean) => void }) {
  const list = item ? soldOutSections(menu, item) : []
  return (
    <Dialog open={item !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Sold out options</DialogTitle>
          <DialogDescription>{item ? `${item.name}. Switch off what has run out and guests can't pick it.` : null}</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 pb-2">
          {list.map((section) => (
            <fieldset key={section.key} className="flex min-w-0 flex-col gap-1">
              <legend className="mb-1 flex flex-wrap items-baseline gap-x-2 text-xs font-medium text-muted">
                {section.name}
                {section.scope === 'meal' ? <span className="font-normal text-subtle">Meal</span> : null}
                {section.shared ? <span className="font-normal text-warning">Saved group · changes {section.shared.dishes === 1 ? '1 dish' : `${section.shared.dishes} dishes`}</span> : null}
              </legend>
              <ul className="flex flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle">
                {section.rows.map((row) => (
                  <li key={row.optionId} className="flex min-h-11 items-center justify-between gap-3 px-3">
                    <span className="min-w-0">
                      <span className={cn('block truncate text-[0.8125rem]', row.soldOut ? 'text-subtle line-through' : 'text-foreground')}>{row.label}</span>
                      {row.dishSoldOut ? <span className="block text-xs text-warning">The dish itself is sold out</span> : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                      {row.soldOut ? 'Sold out' : 'On'}
                      <Switch size="sm" checked={!row.soldOut} onCheckedChange={(on) => item && onFlip(item, section, row.optionId, !on)} aria-label={`${row.label} on sale`} />
                    </span>
                  </li>
                ))}
              </ul>
            </fieldset>
          ))}
        </DialogBody>
        <DialogFooter>
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------------------------------------------------------
   Pieces
   -------------------------------------------------------------------------- */

function Channels({ item }: { item: MenuItem }) {
  return (
    <span className="inline-flex items-center gap-2">
      {(['dine_in', 'pickup', 'delivery'] as OrderChannel[]).map((c) => {
        const Icon = CHANNEL_ICON[c]
        const on = item.channels.includes(c)
        return <Icon key={c} aria-label={`${ORDER_CHANNEL_LABEL[c]} ${on ? 'on' : 'off'}`} className={cn('size-3.5', on ? 'text-muted' : 'text-line-strong')} />
      })}
    </span>
  )
}

function DishCard({ item: i, price, meta, onOpen, onToggle, actions }: { item: MenuItem; price: React.ReactNode; meta: string | null; onOpen: () => void; onToggle: (on: boolean) => void; actions: React.ReactNode }) {
  return (
    <article className={cn('flex flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong', i.status !== 'available' && 'opacity-70')}>
      <button type="button" onClick={onOpen} className="relative block aspect-[4/3] w-full bg-surface-sunken text-left" aria-label={`Edit ${i.name}`}>
        <DishPhoto url={i.imageUrl} sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 20vw" iconClassName="size-6" />
        {i.status !== 'available' ? <span className="absolute top-2 left-2 rounded-full bg-surface/95 px-2 py-0.5 text-xs font-medium text-foreground">{STATUS_META[i.status].label}</span> : null}
        {i.popular ? (
          <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-surface/95" aria-label="Popular">
            <Star aria-hidden="true" className="size-3 fill-warning text-warning" />
          </span>
        ) : null}
      </button>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <button type="button" onClick={onOpen} className="block text-left">
          <span className="flex items-start justify-between gap-2">
            <span className="text-[0.8125rem] leading-snug font-medium text-foreground">{i.name}</span>
            <span className="shrink-0 text-[0.8125rem] text-foreground tabular-nums">{price}</span>
          </span>
          <span className="mt-0.5 line-clamp-1 block text-xs text-subtle">{i.description}</span>
          {meta ? <span className="mt-0.5 line-clamp-1 block text-xs text-muted">{meta}</span> : null}
        </button>
        <div className="mt-auto flex items-center justify-between gap-2 pt-1.5 text-xs text-muted">
          <span className="flex min-w-0 items-center gap-2">
            <Channels item={i} />
            {i.tags.length ? <span className="truncate text-faint">{i.tags.map((t) => DIETARY_META[t].short).join(' · ')}</span> : null}
          </span>
          <span className="shrink-0 tabular-nums">
            {formatNumber(i.sold30d)} <span className="text-faint">· 30d</span>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line-subtle pt-2">
          <span className="flex items-center gap-2">
            <Switch size="sm" checked={i.status === 'available'} onCheckedChange={onToggle} aria-label={`${i.name} on sale`} />
            <StatusWord label={STATUS_META[i.status].label} tone={STATUS_META[i.status].tone} />
          </span>
          {actions}
        </div>
      </div>
    </article>
  )
}

/* --------------------------------------------------------------------------
   Sections sheet — name, describe, order, time, add and remove
   -------------------------------------------------------------------------- */

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const windowsOk = (windows: TimeWindow[] | null | undefined) => (windows ?? []).every((w) => w.days.length > 0 && HHMM.test(w.from) && HHMM.test(w.to) && w.from < w.to)

function SectionsSheet({ mode, categories, items, tenantId, onClose, onSave }: { mode: 'closed' | 'manage' | 'new'; categories: MenuCategory[]; items: MenuItem[]; tenantId: string; onClose: () => void; onSave: (next: MenuCategory[], removed: string[]) => void }) {
  const open = mode !== 'closed'
  const [draft, setDraft] = React.useState<MenuCategory[]>(categories)
  const [removed, setRemoved] = React.useState<string[]>([])
  const newRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (!open) return
    setRemoved([])
    if (mode === 'new') {
      const fresh: MenuCategory = { id: `mc_new_${Date.now().toString(36)}`, tenantId, name: '', description: '', sortOrder: categories.length + 1, service: 'all' }
      setDraft([...categories, fresh])
      window.setTimeout(() => newRef.current?.focus(), 60)
    } else {
      setDraft(categories)
    }
    // Opening takes a snapshot; later menu changes don't reset what is being typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode])

  const set = (id: string, change: Partial<MenuCategory>) => setDraft((d) => d.map((c) => (c.id === id ? { ...c, ...change } : c)))
  const move = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const next = [...d]
      const target = index + dir
      if (target < 0 || target >= next.length) return d
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  const add = () => {
    const fresh: MenuCategory = { id: `mc_new_${Date.now().toString(36)}`, tenantId, name: '', description: '', sortOrder: draft.length + 1, service: 'all' }
    setDraft((d) => [...d, fresh])
    window.setTimeout(() => newRef.current?.focus(), 60)
  }
  const drop = (c: MenuCategory) => {
    setDraft((d) => d.filter((x) => x.id !== c.id))
    if (categories.some((x) => x.id === c.id)) setRemoved((r) => [...r, c.id])
  }

  const names = draft.map((c) => c.name.trim().toLowerCase())
  const namesOk = draft.length > 0 && names.every((n) => n.length >= 2) && new Set(names).size === names.length
  const timesOk = draft.every((c) => windowsOk(c.hours))
  const valid = namesOk && timesOk
  const countFor = (id: string) => items.filter((i) => i.categoryId === id).length
  const lastNewId = [...draft].reverse().find((c) => c.id.startsWith('mc_new_'))?.id

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{mode === 'new' ? 'New section' : 'Menu sections'}</SheetTitle>
          <SheetDescription>Name them the way your kitchen talks about them. The order here is the order guests see.</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-3">
          {draft.map((c, index) => {
            const count = countFor(c.id)
            const isNew = c.id.startsWith('mc_new_')
            const timed = Boolean(c.hours?.length)
            return (
              <div key={c.id} className="rounded-xl border border-line bg-surface p-3">
                <div className="flex items-start gap-2">
                  <div className="flex shrink-0 flex-col">
                    <IconButton size="xs" variant="ghost" aria-label={`Move ${c.name || 'section'} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                      <ChevronUp />
                    </IconButton>
                    <IconButton size="xs" variant="ghost" aria-label={`Move ${c.name || 'section'} down`} disabled={index === draft.length - 1} onClick={() => move(index, 1)}>
                      <ChevronDown />
                    </IconButton>
                  </div>
                  <div className="grid min-w-0 flex-1 gap-2">
                    <Input ref={c.id === lastNewId ? newRef : undefined} size="sm" value={c.name} onChange={(e) => set(c.id, { name: e.target.value })} placeholder={isNew ? 'Section name, e.g. Petiscos' : 'Section name'} aria-label="Section name" />
                    <Input size="sm" value={c.description ?? ''} onChange={(e) => set(c.id, { description: e.target.value })} placeholder="One line under the heading, optional" aria-label="Section description" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Select value={c.service} onValueChange={(v) => set(c.id, { service: v as MenuCategory['service'] })}>
                        <SelectTrigger size="sm" aria-label="Which service" className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SERVICES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-xs text-subtle tabular-nums">{isNew ? 'New' : `${count} ${count === 1 ? 'dish' : 'dishes'}`}</span>
                    </div>
                    <div className="flex min-h-9 items-center justify-between gap-2">
                      <span className="text-xs text-muted">{timed ? 'Only at set times' : 'Whenever you take orders'}</span>
                      <Switch size="sm" checked={timed} onCheckedChange={(on) => set(c.id, { hours: on ? [{ days: [0, 1, 2, 3, 4, 5, 6], from: '08:30', to: '11:30' }] : null })} aria-label={`${c.name || 'Section'} only at set times`} />
                    </div>
                    {timed ? <TimeWindowsEditor windows={c.hours ?? []} onChange={(w) => set(c.id, { hours: w.length ? w : null })} /> : null}
                  </div>
                  <IconButton size="xs" variant="ghost" aria-label={`Remove ${c.name || 'section'}`} className="shrink-0 text-danger" disabled={draft.length === 1} onClick={() => drop(c)}>
                    <Trash2 />
                  </IconButton>
                </div>
              </div>
            )
          })}
          <Button size="sm" variant="outline" leftIcon={<Plus />} className="self-start" onClick={add}>
            Add a section
          </Button>
          {removed.length ? <p className="text-xs text-warning">Dishes in a removed section move to {draft[0]?.name || 'the first section'} when you save.</p> : null}
          {!namesOk && draft.length ? <p className="text-xs text-subtle">Every section needs a name of its own.</p> : null}
          {!timesOk ? <p className="text-xs text-danger">Times need at least one day and an end after the start.</p> : null}
        </SheetBody>
        <SheetFooter className="gap-2">
          <Button size="sm" leftIcon={<Check />} disabled={!valid} onClick={() => onSave(draft.map((c) => ({ ...c, name: c.name.trim(), description: c.description?.trim() || undefined })), removed)}>
            Save sections
          </Button>
          <Button size="sm" variant="ghost" leftIcon={<X />} onClick={onClose}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
