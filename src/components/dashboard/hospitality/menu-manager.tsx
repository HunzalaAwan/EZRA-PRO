'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Bike, Check, ImageOff, MoreHorizontal, Plus, ShoppingBag, Star, UtensilsCrossed, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Field } from '@/components/ui/field'
import { IconButton } from '@/components/ui/icon-button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/ui/search-input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { DIETARY_META, ORDER_CHANNEL_LABEL, type DietaryTag, type Menu, type MenuCategory, type MenuItem, type MenuItemStatus, type OrderChannel } from '@/lib/hospitality/types'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import { BandHeader, StatTile, StatusWord } from './shared'

/* ==========================================================================
   <MenuManager> — the board, as a list you can edit.

   Categories across the top, dishes underneath: photo, name, price, what
   it is free of, where it sells, how long it takes, how it did this month.
   The switch at the end is the one you reach for at 20:40 when the fish
   runs out.
   ========================================================================== */

type Filter = 'all' | 'available' | 'sold_out' | 'hidden' | 'popular'

const CHANNEL_ICON: Record<OrderChannel, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>> = {
  dine_in: UtensilsCrossed,
  pickup: ShoppingBag,
  delivery: Bike,
}

const STATUS_META: Record<MenuItemStatus, { label: string; tone: string }> = {
  available: { label: 'On sale', tone: 'bg-success' },
  sold_out: { label: 'Sold out', tone: 'bg-danger' },
  hidden: { label: 'Hidden', tone: 'bg-line-strong' },
}

export interface MenuManagerProps {
  menu: Menu
  currency: CurrencyCode
  storefrontHref: string
  hotel: boolean
}

export function MenuManager({ menu, currency, storefrontHref, hotel }: MenuManagerProps) {
  const [items, setItems] = React.useState(menu.items)
  const [categories] = React.useState(menu.categories)
  const [categoryId, setCategoryId] = React.useState<string>('all')
  const [filter, setFilter] = React.useState<Filter>('all')
  const [query, setQuery] = React.useState('')
  const [editing, setEditing] = React.useState<MenuItem | null>(null)
  const [creating, setCreating] = React.useState(false)

  const categoryById = React.useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

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
      .filter((i) => (categoryId === 'all' ? true : i.categoryId === categoryId))
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
  }, [items, categoryId, filter, query, categoryById])

  /* ---------- actions ---------- */

  const update = (id: string, change: (item: MenuItem) => MenuItem) => setItems((current) => current.map((i) => (i.id === id ? change(i) : i)))

  const setStatus = (item: MenuItem, status: MenuItemStatus) => {
    update(item.id, (i) => ({ ...i, status }))
    toast(status === 'sold_out' ? `${item.name} marked sold out` : status === 'hidden' ? `${item.name} hidden from the menu` : `${item.name} back on sale`, {
      description: status === 'sold_out' ? 'Taken off the storefront and the QR menu until you switch it back.' : undefined,
    })
  }

  const save = (item: MenuItem) => {
    if (items.some((i) => i.id === item.id)) {
      update(item.id, () => item)
      toast.success(`${item.name} saved`)
    } else {
      setItems((current) => [...current, item])
      toast.success(`${item.name} added to ${categoryById.get(item.categoryId)?.name ?? 'the menu'}`)
    }
    setEditing(null)
    setCreating(false)
  }

  const remove = (item: MenuItem) => {
    setItems((current) => current.filter((i) => i.id !== item.id))
    setEditing(null)
    toast(`${item.name} removed`, { description: 'Past orders keep the line as it was.' })
  }

  const duplicate = (item: MenuItem) => {
    const copy: MenuItem = { ...item, id: `${item.id}_copy_${Date.now().toString(36)}`, name: `${item.name} (copy)`, sold30d: 0, revenue30d: 0, popular: false }
    setItems((current) => [...current, copy])
    setEditing(copy)
  }

  /* ---------- columns ---------- */

  const columns = React.useMemo<DataTableColumn<MenuItem>[]>(
    () => [
      {
        id: 'item',
        header: 'Dish',
        cell: (i) => (
          <span className="flex min-w-[14rem] items-center gap-3">
            <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
              {i.imageUrl ? <Image src={i.imageUrl} alt="" fill sizes="40px" className="object-cover" /> : <ImageOff aria-hidden="true" className="absolute inset-0 m-auto size-4 text-faint" />}
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[0.8125rem] text-foreground">{i.name}</span>
                {i.popular ? <Star aria-hidden="true" className="size-3 shrink-0 fill-warning text-warning" /> : null}
              </span>
              <span className="block max-w-[22rem] truncate text-xs text-subtle">{i.description}</span>
            </span>
          </span>
        ),
      },
      {
        id: 'price',
        header: 'Price',
        align: 'right',
        numeric: true,
        width: '5.5rem',
        cell: (i) => <span className="text-[0.8125rem] text-foreground tabular-nums">{formatCurrency(i.price, currency)}</span>,
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
        cell: (i) => (
          <span className="inline-flex items-center gap-2">
            {(['dine_in', 'pickup', 'delivery'] as OrderChannel[]).map((c) => {
              const Icon = CHANNEL_ICON[c]
              const on = i.channels.includes(c)
              return <Icon key={c} aria-label={`${ORDER_CHANNEL_LABEL[c]} ${on ? 'on' : 'off'}`} className={cn('size-3.5', on ? 'text-muted' : 'text-line-strong')} />
            })}
          </span>
        ),
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
        cell: (i) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton variant="ghost" size="xs" aria-label={`Actions for ${i.name}`} onClick={(e) => e.stopPropagation()}>
                <MoreHorizontal />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => setEditing(i)}>Edit</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => duplicate(i)}>Duplicate</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => update(i.id, (x) => ({ ...x, popular: !x.popular }))}>{i.popular ? 'Remove from popular' : 'Mark as popular'}</DropdownMenuItem>
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
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currency],
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="On sale" hint={`of ${items.length} dishes`} value={stats.onSale} line={`${stats.delivery} also sell on delivery`} tone="bg-success" active={filter === 'available'} onClick={() => setFilter(filter === 'available' ? 'all' : 'available')} />
        <StatTile label="Sold out" hint="switched off" value={stats.soldOut} line={stats.soldOut ? 'Switch back on when it is in' : 'Everything is in'} tone="bg-danger" active={filter === 'sold_out'} onClick={() => setFilter(filter === 'sold_out' ? 'all' : 'sold_out')} />
        <StatTile label="Best seller" hint="last 30 days" value={stats.top ? formatNumber(stats.top.sold30d) : '—'} line={stats.top ? stats.top.name : 'No sales yet'} />
        <StatTile label="Menu revenue" hint="last 30 days" value={formatCurrency(stats.revenue, currency, { compact: true })} line="À la carte, pickup and delivery" />
      </div>

      <Card className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-line-subtle px-3 py-3 sm:px-4">
          <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1">
            {[{ id: 'all', name: 'All' }, ...categories].map((c) => {
              const active = c.id === categoryId
              const count = c.id === 'all' ? items.length : items.filter((i) => i.categoryId === c.id).length
              return (
                <button key={c.id} type="button" aria-pressed={active} onClick={() => setCategoryId(c.id)} className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[0.8125rem] transition-colors', active ? 'bg-foreground text-background' : 'text-muted hover:bg-surface-sunken hover:text-foreground')}>
                  {c.name}
                  <span className={cn('text-xs tabular-nums', active ? 'text-background/70' : 'text-faint')}>{count}</span>
                </button>
              )
            })}
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
            <div className="flex shrink-0 items-center gap-2">
              <Button asChild size="sm" variant="outline" rightIcon={<ArrowUpRight />}>
                <Link href={storefrontHref} target="_blank">
                  See it as a guest
                </Link>
              </Button>
              <Button size="sm" leftIcon={<Plus />} onClick={() => setCreating(true)}>
                Add a dish
              </Button>
            </div>
          </div>
        </div>
        <CardContent className="p-0">
          <DataTable
            columns={columns}
            rows={visible}
            getRowId={(i) => i.id}
            onRowClick={(i) => setEditing(i)}
            stickyHeader
            rowHeight="comfortable"
            ariaLabel="Menu"
            groupBy={categoryId === 'all' ? (i) => i.categoryId : undefined}
            renderGroupHeader={(key, rows) => {
              const c = categoryById.get(key)
              return <BandHeader title={c ? `${c.name}${c.description ? ` · ${c.description}` : ''}` : key} right={`${rows.length} · ${formatCurrency(rows.reduce((s, i) => s + i.revenue30d, 0), currency, { compact: true })} in 30 days`} />
            }}
            getRowClassName={(i) => (i.status === 'available' ? undefined : 'opacity-60')}
            empty={<EmptyState variant="no-results" size="sm" title="Nothing on this part of the menu" description="Add a dish or clear the filter." />}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{hotel ? 'Room service' : 'Tasting menus and events'}</CardTitle>
            <CardDescription>
              {hotel ? 'Dine-in dishes are also offered to rooms from the QR card. Orders arrive on the pass marked with the room number and charge to the folio.' : 'Prepaid seatings with a fixed menu — the chef’s counter, the sunset tasting — live under Experiences, with their own dates, prices and deposits.'}
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
            <CardDescription>The storefront, the QR card on every table, and the delivery partners you have connected. A change here is live everywhere within a minute.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/storefront">Storefront settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <ItemSheet item={editing} creating={creating} categories={categories} defaultCategoryId={categoryId === 'all' ? categories[0]?.id ?? '' : categoryId} currency={currency} tenantId={items[0]?.tenantId ?? ''} onClose={() => { setEditing(null); setCreating(false) }} onSave={save} onRemove={remove} />
    </div>
  )
}

/* --------------------------------------------------------------------------
   Item sheet — edit or create
   -------------------------------------------------------------------------- */

const TAGS = Object.keys(DIETARY_META) as DietaryTag[]

function ItemSheet({ item, creating, categories, defaultCategoryId, currency, tenantId, onClose, onSave, onRemove }: { item: MenuItem | null; creating: boolean; categories: MenuCategory[]; defaultCategoryId: string; currency: CurrencyCode; tenantId: string; onClose: () => void; onSave: (item: MenuItem) => void; onRemove: (item: MenuItem) => void }) {
  const open = item !== null || creating
  const blank = React.useMemo<MenuItem>(
    () => ({
      id: `mi_new_${Date.now().toString(36)}`,
      tenantId,
      categoryId: defaultCategoryId,
      name: '',
      description: '',
      price: 0,
      imageUrl: undefined,
      tags: [],
      channels: ['dine_in', 'pickup', 'delivery'],
      status: 'available',
      popular: false,
      prepMinutes: 12,
      modifiers: [],
      sold30d: 0,
      revenue30d: 0,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  )
  const [draft, setDraft] = React.useState<MenuItem>(item ?? blank)
  React.useEffect(() => {
    setDraft(item ?? blank)
  }, [item, blank])

  const set = <K extends keyof MenuItem>(key: K, value: MenuItem[K]) => setDraft((d) => ({ ...d, [key]: value }))
  const valid = draft.name.trim().length >= 2 && draft.price > 0 && draft.categoryId

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" size="md">
        <SheetHeader>
          <SheetTitle>{item ? 'Edit dish' : 'Add a dish'}</SheetTitle>
          <SheetDescription>{item ? `${formatNumber(item.sold30d)} sold in the last 30 days.` : 'It goes live on every channel you tick as soon as you save.'}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-4">
          <Field label="Name" required>
            {(control) => <Input {...control} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Grilled octopus" />}
          </Field>
          <Field label="Description">
            {(control) => <Textarea {...control} rows={2} value={draft.description} onChange={(e) => set('description', e.target.value)} placeholder="What is in it, how it is cooked, what it comes with." />}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Price" required>
              {(control) => <Input {...control} type="number" inputMode="decimal" min={0} step="0.5" value={draft.price ? (draft.price / 100).toString() : ''} onChange={(e) => set('price', Math.round(Number(e.target.value || 0) * 100))} suffix={currency} placeholder="18.00" />}
            </Field>
            <Field label="Kitchen time">
              {(control) => <Input {...control} type="number" inputMode="numeric" min={1} max={90} value={draft.prepMinutes} onChange={(e) => set('prepMinutes', Number(e.target.value || 0))} suffix="min" />}
            </Field>
          </div>
          <Field label="Category">
            <Select value={draft.categoryId} onValueChange={(v) => set('categoryId', v)}>
              <SelectTrigger aria-label="Category">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Dietary" description="Shown as small letters next to the dish.">
            <div className="flex flex-wrap gap-1.5">
              {TAGS.map((t) => {
                const on = draft.tags.includes(t)
                return (
                  <button key={t} type="button" aria-pressed={on} onClick={() => set('tags', on ? draft.tags.filter((x) => x !== t) : [...draft.tags, t])} className={cn('rounded-md border px-2 py-1 text-xs transition-colors', on ? 'border-foreground bg-foreground text-background' : 'border-line text-muted hover:border-line-strong')}>
                    {DIETARY_META[t].label}
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="Sells on">
            <div className="flex flex-col gap-2">
              {(['dine_in', 'pickup', 'delivery'] as OrderChannel[]).map((c) => (
                <label key={c} className="flex items-center gap-2.5 text-[0.8125rem] text-foreground">
                  <Checkbox checked={draft.channels.includes(c)} onCheckedChange={(checked) => set('channels', checked ? [...draft.channels, c] : draft.channels.filter((x) => x !== c))} />
                  {ORDER_CHANNEL_LABEL[c]}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Photo URL" optional>
            {(control) => <Input {...control} value={draft.imageUrl ?? ''} onChange={(e) => set('imageUrl', e.target.value || undefined)} placeholder="https://…" />}
          </Field>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-sunken px-3 py-2.5">
            <span className="text-[0.8125rem] text-foreground">Show as popular</span>
            <Switch size="sm" checked={draft.popular} onCheckedChange={(v) => set('popular', v)} aria-label="Popular" />
          </div>
          <Field label="Status">
            <Segmented
              size="sm"
              label="Status"
              options={[
                { value: 'available', label: 'On sale' },
                { value: 'sold_out', label: 'Sold out' },
                { value: 'hidden', label: 'Hidden' },
              ]}
              value={draft.status}
              onValueChange={(v) => set('status', v as MenuItemStatus)}
            />
          </Field>
          {draft.modifiers.length ? (
            <div>
              <p className="text-xs font-medium text-muted">Choices</p>
              <ul className="mt-1.5 flex flex-col gap-1 text-[0.8125rem] text-muted">
                {draft.modifiers.map((m) => (
                  <li key={m.id}>
                    <span className="text-foreground">{m.label}</span> · {m.options.map((o) => (o.priceDelta ? `${o.label} +${formatCurrency(o.priceDelta, currency)}` : o.label)).join(', ')}
                    {m.required ? ' · required' : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </SheetBody>
        <SheetFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button size="sm" leftIcon={<Check />} disabled={!valid} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>
              {item ? 'Save' : 'Add to menu'}
            </Button>
            <Button size="sm" variant="ghost" leftIcon={<X />} onClick={onClose}>
              Cancel
            </Button>
          </div>
          {item ? (
            <Button size="sm" variant="ghost" className="text-danger" onClick={() => onRemove(item)}>
              Remove
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
