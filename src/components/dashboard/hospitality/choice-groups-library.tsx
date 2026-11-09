'use client'

import * as React from 'react'
import { Check, Layers, MoreHorizontal, Plus, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { IconButton } from '@/components/ui/icon-button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { checkGroup, groupFreeNote, optionView, sharedGroupUsage } from '@/lib/hospitality/menu-pricing'
import { GROUP_KIND_META, type GroupKind, type Menu, type MenuItem, type MenuOptionGroup } from '@/lib/hospitality/types'
import { cn } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import { duplicateLibraryGroup, money, newLibraryGroup, optionsPreview, ruleLine, withoutBlankRows } from './menu-editor-model'
import { DishThumb, OptionGroupEditor } from './option-group-editor'

/* ==========================================================================
   <ChoiceGroupsLibrary> — saved groups used on many dishes: sauces, sides,
   drinks, milk. Change one here and every dish that uses it follows.
   Option switches work straight from the list, for a busy service.
   ========================================================================== */

const KINDS = Object.keys(GROUP_KIND_META) as GroupKind[]

const dishCount = (n: number) => `${n} ${n === 1 ? 'dish' : 'dishes'}`

/* --------------------------------------------------------------------------
   The sheet: new saved group, or edit one
   -------------------------------------------------------------------------- */

export interface SharedGroupSheetProps {
  open: boolean
  group: MenuOptionGroup | null
  isNew: boolean
  menu: Menu
  currency: CurrencyCode
  /** Dishes that use it now. */
  usage: MenuItem[]
  onClose: () => void
  onSave: (group: MenuOptionGroup) => void
  /** "Save" in the library; "Done" inside the dish editor, where it saves with the dish. */
  saveLabel?: string
}

export function SharedGroupSheet({ open, group, isNew, menu, currency, usage, onClose, onSave, saveLabel = 'Save' }: SharedGroupSheetProps) {
  const [draft, setDraft] = React.useState<MenuOptionGroup | null>(group)
  const [showProblems, setShowProblems] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setDraft(group ? (JSON.parse(JSON.stringify(group)) as MenuOptionGroup) : null)
    setShowProblems(false)
  }, [open, group])

  const save = () => {
    if (!draft) return
    const clean = withoutBlankRows(draft)
    if (checkGroup(clean).length) {
      setShowProblems(true)
      return
    }
    onSave(clean)
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" size="lg" className="w-full">
        <SheetHeader>
          <SheetTitle>{isNew ? 'New saved group' : 'Edit saved group'}</SheetTitle>
          <SheetDescription>{isNew ? 'Make it once, use it on any dish.' : usage.length ? `On ${dishCount(usage.length)}.` : 'Not on any dish yet.'}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-4">
          {usage.length > 1 ? (
            <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-xs text-warning" role="status">
              Changes apply to {dishCount(usage.length)}: {usage.slice(0, 4).map((i) => i.name).join(', ')}
              {usage.length > 4 ? ', …' : ''}
            </p>
          ) : null}
          {draft ? <OptionGroupEditor group={draft} onChange={setDraft} menu={menu} mode="library" currency={currency} context="dish" autoFocus={isNew} showProblems={showProblems} /> : null}
        </SheetBody>
        <SheetFooter className="gap-2">
          <Button size="sm" leftIcon={<Check />} onClick={save}>
            {isNew && saveLabel === 'Save' ? 'Save group' : saveLabel}
          </Button>
          <Button size="sm" variant="ghost" leftIcon={<X />} onClick={onClose}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

/* --------------------------------------------------------------------------
   The library list
   -------------------------------------------------------------------------- */

export interface ChoiceGroupsLibraryProps {
  menu: Menu
  currency: CurrencyCode
  onSave: (group: MenuOptionGroup) => void
  onRemove: (groupId: string) => void
  onOptionSoldOut: (groupId: string, optionId: string, soldOut: boolean) => void
  onOpenDish: (item: MenuItem) => void
}

export function ChoiceGroupsLibrary({ menu, currency, onSave, onRemove, onOptionSoldOut, onOpenDish }: ChoiceGroupsLibraryProps) {
  const groups = menu.sharedGroups ?? []
  const [editing, setEditing] = React.useState<{ group: MenuOptionGroup; isNew: boolean } | null>(null)
  const [deleting, setDeleting] = React.useState<MenuOptionGroup | null>(null)

  const usageOf = (id: string) => sharedGroupUsage(menu, id)

  const save = (group: MenuOptionGroup) => {
    onSave(group)
    toast.success(editing?.isNew ? `${group.name.trim()} saved` : `${group.name.trim()} updated`, {
      description: editing && !editing.isNew && usageOf(group.id).length > 1 ? `Changed on ${dishCount(usageOf(group.id).length)}.` : undefined,
    })
    setEditing(null)
  }

  const askDelete = (group: MenuOptionGroup) => {
    if (usageOf(group.id).length === 0) {
      onRemove(group.id)
      toast(`${group.name} deleted`)
      return
    }
    setDeleting(group)
  }

  const deletingUsage = deleting ? usageOf(deleting.id) : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.8125rem] text-muted">Saved groups go on many dishes. Change one here and every dish follows.</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" leftIcon={<Plus />}>
              New group
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>What kind?</DropdownMenuLabel>
            {KINDS.map((k) => (
              <DropdownMenuItem key={k} onSelect={() => setEditing({ group: newLibraryGroup(k), isNew: true })} className="flex-col items-start gap-0.5">
                <span className="text-[0.8125rem] text-foreground">{GROUP_KIND_META[k].label}</span>
                <span className="text-xs text-subtle">{GROUP_KIND_META[k].hint}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={Layers} size="sm" title="No saved groups yet" description="Save sauces, sides or drinks once and use them on any dish." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {groups.map((g) => {
            const usage = usageOf(g.id)
            return (
              <article key={g.id} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="flex flex-wrap items-center gap-2 text-[0.9375rem] font-medium text-foreground">
                      <button type="button" className="truncate text-left hover:underline focus-visible:outline-2 focus-visible:outline-primary" onClick={() => setEditing({ group: g, isNew: false })}>
                        {g.name || 'Untitled group'}
                      </button>
                      <Badge size="sm" variant="neutral">
                        {GROUP_KIND_META[g.kind].label}
                      </Badge>
                    </h3>
                    <p className="mt-0.5 text-xs text-subtle">{ruleLine(g, groupFreeNote(g))}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <IconButton size="xs" variant="ghost" aria-label={`Actions for ${g.name}`}>
                        <MoreHorizontal />
                      </IconButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing({ group: g, isNew: false })}>Edit</DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          const copy = duplicateLibraryGroup(g)
                          onSave(copy)
                          toast.success(`${copy.name} added`)
                        }}
                      >
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem tone="danger" onSelect={() => askDelete(g)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="line-clamp-2 text-xs text-muted">{optionsPreview(menu, g, currency, 4)}</p>

                <ul className="flex flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle" aria-label={`${g.name} options`}>
                  {g.options.map((o) => {
                    const view = optionView(menu, o)
                    const name = view.label || 'Untitled'
                    return (
                      <li key={o.id} className="flex min-h-10 items-center gap-2.5 px-3 py-1">
                        {o.itemId ? <DishThumb url={view.imageUrl} className="size-7" /> : null}
                        <span className={cn('min-w-0 flex-1 truncate text-[0.8125rem]', o.soldOut ? 'text-subtle line-through' : 'text-foreground')}>{g.kind === 'remove' ? `No ${name.toLowerCase()}` : name}</span>
                        {g.kind !== 'remove' ? <span className="text-xs text-muted tabular-nums">{o.price > 0 ? `+${money(o.price, currency)}` : 'Free'}</span> : null}
                        <Switch size="sm" checked={!o.soldOut} onCheckedChange={(on) => onOptionSoldOut(g.id, o.id, !on)} aria-label={`${name} on sale`} />
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-auto flex items-center justify-between gap-2">
                  {usage.length ? (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button type="button" className="inline-flex min-h-9 items-center rounded-md text-xs font-medium text-muted underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-primary">
                          On {dishCount(usage.length)}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" width="sm" padding="none">
                        <ul className="p-1">
                          {usage.map((d) => (
                            <li key={d.id}>
                              <button type="button" onClick={() => onOpenDish(d)} className="flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[0.8125rem] text-foreground hover:bg-surface-sunken">
                                <DishThumb url={d.imageUrl} className="size-7" />
                                <span className="truncate">{d.name}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </PopoverContent>
                    </Popover>
                  ) : (
                    <span className="text-xs text-subtle">Not on any dish</span>
                  )}
                  <Button size="xs" variant="outline" onClick={() => setEditing({ group: g, isNew: false })}>
                    Edit
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      <SharedGroupSheet
        open={editing !== null}
        group={editing?.group ?? null}
        isNew={editing?.isNew ?? false}
        menu={menu}
        currency={currency}
        usage={editing ? usageOf(editing.group.id) : []}
        onClose={() => setEditing(null)}
        onSave={save}
      />

      <Dialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              It&apos;s on {dishCount(deletingUsage.length)}. Keep a copy on each dish and delete it from saved groups?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                if (deleting) {
                  onRemove(deleting.id)
                  toast(`${deleting.name} deleted`, { description: `Each of the ${dishCount(deletingUsage.length)} keeps its own copy.` })
                }
                setDeleting(null)
              }}
            >
              Keep copies and delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
