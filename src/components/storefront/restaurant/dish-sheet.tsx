'use client'

import * as React from 'react'
import Image from 'next/image'
import { Check, Clock, Copy, Minus, Phone, Plus, Trash2, UtensilsCrossed } from 'lucide-react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { MEDIA, useMediaQuery } from '@/hooks/use-media-query'
import { allergensOf, defaultSelection, mealFullPrice, priceSelection, setMeal, setPick, setVariant } from '@/lib/hospitality/menu-pricing'
import { ALLERGEN_LABEL, ORDER_CHANNEL_LABEL, type DishSelection, type Menu, type MenuItem, type OrderChannel } from '@/lib/hospitality/types'
import { cn } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

import {
  NOTE_MAX,
  QTY_MAX,
  QTY_MIN,
  availabilityNote,
  cleanSelection,
  factPills,
  firstInvalidUnit,
  firstIssueAnchor,
  money,
  orderTime,
  plusMoney,
  removeUnit,
  resizeUnits,
  sameAsFirst,
  sheetGroups,
  sheetLines,
  sheetTotal,
  stepLabel,
  submitText,
  type GroupView,
  type OptionRowView,
  type SheetLine,
  type SheetUnit,
} from './dish-sheet-model'

/* ==========================================================================
   <DishSheet> — one dish, made the guest's way.

   The photo and what it is, then a size, then each choice group as a
   fieldset: radio rows for "pick one", tick rows with a −/+ for extras,
   "No onion" rows to leave things out, linked dishes with their own
   choices tucked underneath, and the meal as a switch card. The button
   carries the live price; tapping it with something missing takes the
   guest straight to that group. A bottom sheet on a phone, a dialog
   from tablet up.

   Ordering more than one, the guest can make each one different: a tab
   per dish (1 · 2 · 3), each with its own picks, meal and note.
   ========================================================================== */

export interface DishSheetResult {
  /** One line when every dish is the same; when they differ, a line per different dish with the same ones merged. */
  lines: SheetLine[]
}

export interface DishSheetProps {
  menu: Menu
  item: MenuItem | null
  currency: CurrencyCode
  channel: OrderChannel
  /** 0 = Sunday. */
  weekday: number
  /** 'asap' or "HH:MM". */
  when: string
  nowTime: string
  initial?: { selection: DishSelection; qty: number; note: string | null }
  submitLabel?: 'add' | 'update'
  /** For "Ask about allergies". */
  phone?: string
  onClose(): void
  onSubmit(result: DishSheetResult): void
  onOrderForLater?(time: string): void
}

export function DishSheet(props: DishSheetProps) {
  const desktop = useMediaQuery(MEDIA.sm, true)
  const { item, onClose } = props
  const open = item !== null
  const body = item ? <DishSheetBody key={`${item.id}:${props.initial ? 'edit' : 'new'}`} {...props} item={item} /> : null
  const onOpenChange = (next: boolean) => {
    if (!next) onClose()
  }
  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg" className="max-h-[min(54rem,calc(100dvh-2rem))]">
          {body}
        </DialogContent>
      </Dialog>
    )
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" size="xl">
        {body}
      </SheetContent>
    </Sheet>
  )
}

/* --------------------------------------------------------------------------
   Body
   -------------------------------------------------------------------------- */

const clampQty = (n: number) => Math.min(QTY_MAX, Math.max(QTY_MIN, Math.floor(Number.isFinite(n) ? n : 1)))

function DishSheetBody({ menu, item, currency, channel, weekday, when, nowTime, initial, submitLabel = 'add', phone, onSubmit, onOrderForLater }: DishSheetProps & { item: MenuItem }) {
  const [units, setUnits] = React.useState<SheetUnit[]>(() => [{ selection: initial ? cleanSelection(menu, initial.selection) : defaultSelection(menu, item), note: initial?.note ?? '' }])
  const [qty, setQtyValue] = React.useState(() => clampQty(initial?.qty ?? 1))
  /** Make each one different. Only counts with more than one. */
  const [split, setSplit] = React.useState(false)
  const [active, setActive] = React.useState(0)
  const [attempted, setAttempted] = React.useState(false)
  /** Where to take the guest once the right tab has rendered. */
  const [jump, setJump] = React.useState<{ anchor: string; n: number } | null>(null)
  const anchors = React.useRef(new Map<string, HTMLElement>())
  const tablist = React.useRef<HTMLDivElement>(null)
  const uid = React.useId()
  const noteId = React.useId()
  const sizesId = React.useId()

  const splitOn = split && qty > 1
  const current = splitOn ? Math.min(active, qty - 1) : 0
  const sized = React.useMemo(() => (splitOn ? resizeUnits(units, qty) : [units[0]]), [splitOn, units, qty])
  const pricedAll = React.useMemo(() => sized.map((u) => priceSelection(menu, u.selection)), [menu, sized])
  const unit = sized[current]
  const selection = unit.selection
  const note = unit.note
  const priced = pricedAll[current]

  const groups = React.useMemo(() => sheetGroups(menu, item, selection, priced, currency), [menu, item, selection, priced, currency])
  const dishGroups = groups.filter((g) => g.scope === 'dish')
  const mealGroups = groups.filter((g) => g.scope === 'meal')
  const meal = item.kind !== 'set' ? item.meal ?? null : null
  const mealPrice = meal ? mealFullPrice(menu, item, selection.variantId) : null
  const variants = item.variants && item.variants.length > 1 ? item.variants : []
  const time = orderTime(when, nowTime)
  const available = availabilityNote(menu, item, weekday, time)
  const offChannel = !item.channels.includes(channel)
  const allergens = allergensOf(menu, item)
  const faq = (item.faq ?? []).filter((f) => f.question.trim())
  const pills = factPills(item)
  const sizeIssue = attempted ? priced.issues.find((i) => i.groupKey === null) ?? null : null
  const tabId = (i: number) => `${uid}-tab-${i}`
  const panelId = `${uid}-panel`

  const register = React.useCallback(
    (anchor: string) => (el: HTMLElement | null) => {
      if (el) anchors.current.set(anchor, el)
      else anchors.current.delete(anchor)
    },
    [],
  )

  React.useEffect(() => {
    if (!jump) return
    const frame = requestAnimationFrame(() => {
      const el = anchors.current.get(jump.anchor)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [jump])

  /* the tab in view stays in view when the row scrolls sideways */
  React.useEffect(() => {
    if (!splitOn) return
    tablist.current?.querySelector<HTMLElement>(`[data-unit="${current}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [splitOn, current])

  /** Changes the dish in view (all of them when they're the same). */
  const editUnit = (change: (u: SheetUnit) => SheetUnit) =>
    setUnits((list) => {
      const base = splitOn ? resizeUnits(list, qty) : list
      return base.map((u, i) => (i === current ? change(u) : u))
    })
  const setSelection = (change: (s: DishSelection) => DishSelection) => editUnit((u) => ({ ...u, selection: change(u.selection) }))
  const setNote = (value: string) => editUnit((u) => ({ ...u, note: value }))

  const pick = (view: GroupView, row: OptionRowView, nextQty: number) => setSelection((s) => setPick(menu, s, view.key, row.option.id, nextQty, view.parent))

  const toggle = (view: GroupView, row: OptionRowView) => {
    if (row.picked) {
      if (view.radio && view.rule.required) return
      pick(view, row, 0)
    } else {
      pick(view, row, 1)
    }
  }

  const setQty = (next: number) => {
    const q = clampQty(next)
    setQtyValue(q)
    if (split) setUnits((list) => resizeUnits(list, q))
    setActive((a) => Math.min(a, q - 1))
  }

  const setSplitOn = (on: boolean) => {
    setSplit(on)
    if (on) {
      setUnits((list) => resizeUnits(list, qty))
      setActive(0)
    }
  }

  const copyFirst = () => setUnits((list) => sameAsFirst(resizeUnits(list, qty), current))

  const removeCurrent = () => {
    setUnits((list) => removeUnit(resizeUnits(list, qty), current))
    setQtyValue((q) => clampQty(q - 1))
    setActive(Math.max(0, Math.min(current, qty - 2)))
  }

  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const last = qty - 1
    const to = event.key === 'ArrowRight' ? Math.min(last, current + 1) : event.key === 'ArrowLeft' ? Math.max(0, current - 1) : event.key === 'Home' ? 0 : event.key === 'End' ? last : null
    if (to === null) return
    event.preventDefault()
    setActive(to)
    tablist.current?.querySelector<HTMLElement>(`[data-unit="${to}"]`)?.focus()
  }

  const submit = () => {
    const bad = firstInvalidUnit(pricedAll)
    if (bad !== -1) {
      setAttempted(true)
      if (splitOn) setActive(bad)
      const badGroups = bad === current ? groups : sheetGroups(menu, item, sized[bad].selection, pricedAll[bad], currency)
      const anchor = firstIssueAnchor(item, pricedAll[bad], badGroups) ?? 'top'
      setJump((j) => ({ anchor, n: (j?.n ?? 0) + 1 }))
      return
    }
    onSubmit({ lines: sheetLines(sized, pricedAll, qty, splitOn) })
  }

  const total = sheetTotal(pricedAll, qty, splitOn)

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div ref={register('top')} tabIndex={-1} className="px-5 pt-12 outline-none sm:px-6">
          <div className="relative aspect-[4/3] max-h-72 w-full overflow-hidden rounded-2xl bg-surface-sunken">
            {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="(min-width: 640px) 640px, 100vw" className="object-cover" /> : <UtensilsCrossed className="absolute inset-0 m-auto size-8 text-faint" aria-hidden="true" />}
          </div>
          <DialogTitle className="mt-4 font-display text-xl font-semibold tracking-tight text-foreground">{item.name}</DialogTitle>
          <DialogDescription className="mt-1 text-sm leading-relaxed text-muted">{item.description}</DialogDescription>
          {pills.length ? (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="About this dish">
              {pills.map((p) => (
                <li key={p} className="rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-muted">
                  {p}
                </li>
              ))}
            </ul>
          ) : null}
          {!available.ok && available.line ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-surface-sunken px-3 py-2.5">
              <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-sm text-muted">
                <Clock className="size-4 shrink-0" aria-hidden="true" />
                {available.line}
              </span>
              {available.orderFor && onOrderForLater ? (
                <Button size="sm" variant="outline" onClick={() => onOrderForLater(available.orderFor!)}>
                  Order for {available.orderFor}
                </Button>
              ) : null}
            </div>
          ) : null}
          {offChannel ? <p className="mt-3 rounded-xl bg-surface-sunken px-3 py-2.5 text-sm text-muted">Not on {ORDER_CHANNEL_LABEL[channel].toLowerCase()}</p> : null}
        </div>

        {/* ---------- one tab per dish, when each one is different ---------- */}
        {splitOn ? (
          <div className="sticky top-0 z-10 mt-5 border-b border-line-subtle bg-surface-raised px-5 pt-2.5 pb-2 sm:px-6">
            {/* mr-9 keeps the row clear of the close button once the bar sticks */}
            <div ref={tablist} role="tablist" aria-label={`Each ${item.name}`} className="no-scrollbar mr-9 -ml-1 flex gap-1.5 overflow-x-auto py-0.5 pl-1">
              {sized.map((_, i) => {
                const ready = pricedAll[i].valid
                const selected = i === current
                return (
                  <button
                    key={i}
                    type="button"
                    role="tab"
                    id={tabId(i)}
                    data-unit={i}
                    aria-selected={selected}
                    aria-controls={panelId}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setActive(i)}
                    onKeyDown={onTabKey}
                    className={cn(
                      'inline-flex h-10 min-w-12 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3.5 text-sm font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                      selected ? 'border-foreground bg-foreground text-background' : 'border-line text-foreground hover:border-line-strong',
                    )}
                  >
                    {i + 1}
                    {ready ? (
                      <Check className={cn('size-3.5', selected ? 'text-background' : 'text-success')} aria-hidden="true" />
                    ) : (
                      <span aria-hidden="true" className={cn('size-2 rounded-full', attempted ? 'bg-danger' : 'bg-warning')} />
                    )}
                    <span className="sr-only">{ready ? ', ready' : ', needs picks'}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-2 flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="text-xs text-muted tabular-nums">
                {current + 1} of {qty} · {money(priced.unitPrice, currency)}
              </span>
              <span className="flex items-center gap-1">
                {current > 0 ? (
                  <Button size="xs" variant="ghost" leftIcon={<Copy />} onClick={copyFirst}>
                    Same as 1
                  </Button>
                ) : null}
                <Button size="xs" variant="ghost" leftIcon={<Trash2 />} onClick={removeCurrent} aria-label={`Remove ${item.name} ${current + 1}`}>
                  Remove
                </Button>
              </span>
            </div>
          </div>
        ) : null}

        <div
          role={splitOn ? 'tabpanel' : undefined}
          id={splitOn ? panelId : undefined}
          aria-labelledby={splitOn ? tabId(current) : undefined}
          className="flex flex-col gap-7 px-5 pt-6 pb-6 sm:px-6"
        >
          {/* ---------- sizes ---------- */}
          {variants.length ? (
            <section ref={register('sizes')} tabIndex={-1} aria-labelledby={sizesId} aria-invalid={sizeIssue ? true : undefined} className="scroll-mt-28 outline-none">
              <h3 id={sizesId} className="text-[0.9375rem] font-semibold text-foreground">
                {item.variantLabel || 'Size'}
              </h3>
              {sizeIssue ? <p className="mt-1 text-xs font-medium text-danger">{sizeIssue.message}</p> : null}
              <RadioRows
                labelledBy={sizesId}
                className="mt-2.5 grid grid-cols-2 gap-2"
                items={variants.map((v) => ({ id: v.id, checked: selection.variantId === v.id, disabled: Boolean(v.soldOut) }))}
                onPick={(id) => setSelection((s) => setVariant(menu, s, id))}
                render={(entry, props) => {
                  const v = variants.find((x) => x.id === entry.id)!
                  return (
                    <button
                      {...props}
                      className={cn(
                        'flex min-h-14 flex-col items-start justify-center rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                        entry.checked ? 'border-primary bg-primary-soft/40' : 'border-line hover:border-line-strong',
                      )}
                    >
                      <span className="text-sm font-medium text-foreground">{v.label}</span>
                      <span className="text-xs text-muted tabular-nums">{v.soldOut ? 'Sold out' : money(v.price, currency)}</span>
                    </button>
                  )
                }}
              />
            </section>
          ) : null}

          {/* ---------- choice groups ---------- */}
          {dishGroups.map((view) => (
            <GroupFieldset key={view.anchor} view={view} attempted={attempted} currency={currency} register={register} onToggle={toggle} onPick={pick} />
          ))}

          {/* ---------- meal ---------- */}
          {meal ? (
            <section className="flex flex-col gap-5">
              <label className={cn('flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition-colors', selection.meal ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong')}>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {meal.label} {mealPrice !== null ? <span className="font-normal text-muted tabular-nums">· {money(mealPrice, currency)}</span> : null}
                  </span>
                  {meal.description ? <span className="mt-0.5 block text-xs text-muted">{meal.description}</span> : null}
                </span>
                <Switch checked={selection.meal} onCheckedChange={(on) => setSelection((s) => setMeal(menu, s, on))} aria-label={meal.label} />
              </label>
              {selection.meal && mealGroups.length ? (
                <div className="flex flex-col gap-7 border-l-2 border-primary/30 pl-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Meal</p>
                  {mealGroups.map((view) => (
                    <GroupFieldset key={view.anchor} view={view} attempted={attempted} currency={currency} register={register} onToggle={toggle} onPick={pick} />
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          {/* ---------- note ---------- */}
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={noteId} className="text-[0.9375rem] font-semibold text-foreground">
                Anything for the kitchen?
              </label>
              <span className="text-xs text-subtle tabular-nums">{note.length ? `${note.length}/${NOTE_MAX}` : 'Optional'}</span>
            </div>
            <Textarea id={noteId} rows={2} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))} placeholder="Sauce on the side, well done…" className="mt-2" />
          </div>

          {/* ---------- facts ---------- */}
          {allergens.length || faq.length ? (
            <Accordion type="single" collapsible variant="plain">
              <AccordionItem value="facts">
                <AccordionTrigger className="py-3">Allergens and questions</AccordionTrigger>
                <AccordionContent className="flex flex-col gap-3">
                  <p>
                    <span className="font-medium text-foreground">Contains: </span>
                    {allergens.length ? allergens.map((a) => ALLERGEN_LABEL[a]).join(', ') : 'none of the main allergens'}
                  </p>
                  {faq.length ? (
                    <dl className="flex flex-col gap-2.5">
                      {faq.map((f) => (
                        <div key={f.id}>
                          <dt className="font-medium text-foreground">{f.question}</dt>
                          <dd>{f.answer}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {phone ? (
                    <p className="inline-flex items-center gap-1.5 text-xs">
                      <Phone className="size-3.5" aria-hidden="true" /> Ask about allergies:{' '}
                      <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} className="font-medium text-foreground underline-offset-2 hover:underline">
                        {phone}
                      </a>
                    </p>
                  ) : null}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}
        </div>
      </div>

      {/* ---------- footer ---------- */}
      <div className="flex shrink-0 flex-col gap-2.5 border-t border-line-subtle bg-surface-raised px-5 py-3.5 sm:px-6 sm:py-4">
        {qty > 1 ? (
          <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-foreground">Make each one different</span>
              <span className="block text-xs text-muted">{splitOn ? 'Pick for each one in its tab' : `All ${qty} the same`}</span>
            </span>
            <Switch checked={split} onCheckedChange={setSplitOn} aria-label="Make each one different" />
          </label>
        ) : null}
        <div className="flex items-center gap-3">
          <span className="inline-flex shrink-0 items-center rounded-full border border-line">
            <button type="button" aria-label={stepLabel('fewer', item.name)} disabled={qty <= QTY_MIN} className="grid size-10 place-items-center text-muted disabled:opacity-40" onClick={() => setQty(qty - 1)}>
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className="min-w-[1.75rem] text-center text-sm tabular-nums" aria-live="polite">
              {qty}
            </span>
            <button type="button" aria-label={stepLabel('more', item.name)} disabled={qty >= QTY_MAX} className="grid size-10 place-items-center text-muted disabled:opacity-40" onClick={() => setQty(qty + 1)}>
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </span>
          <Button size="lg" className="flex-1 tabular-nums" disabled={offChannel || item.status !== 'available'} onClick={submit}>
            {submitText(submitLabel, qty, total, currency)}
          </Button>
        </div>
      </div>
    </>
  )
}

/* --------------------------------------------------------------------------
   A choice group
   -------------------------------------------------------------------------- */

interface GroupFieldsetProps {
  view: GroupView
  attempted: boolean
  currency: CurrencyCode
  register: (anchor: string) => (el: HTMLElement | null) => void
  onToggle: (view: GroupView, row: OptionRowView) => void
  onPick: (view: GroupView, row: OptionRowView, qty: number) => void
}

function GroupFieldset({ view, attempted, currency, register, onToggle, onPick }: GroupFieldsetProps) {
  const nameId = React.useId()
  const issueId = React.useId()
  const issue = attempted ? view.issue : null
  /** An optional pick-one with something picked: guests can take it back to nothing. */
  const clearable = view.radio && !view.rule.required ? view.rows.find((r) => r.picked) ?? null : null

  const rowBody = (row: OptionRowView) => (
    <>
      <span aria-hidden="true" className={cn('grid size-5 shrink-0 place-items-center border transition-colors', view.radio ? 'rounded-full' : 'rounded-md', row.picked ? 'border-primary bg-primary text-on-primary' : 'border-line-strong bg-surface')}>
        {row.picked ? view.radio ? <span className="size-2 rounded-full bg-on-primary" /> : <Check className="size-3.5" /> : null}
      </span>
      {row.linked ? (
        <span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-surface-sunken">
          {row.imageUrl ? <Image src={row.imageUrl} alt="" fill sizes="40px" className="object-cover" /> : <UtensilsCrossed className="absolute inset-0 m-auto size-4 text-faint" aria-hidden="true" />}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm', row.picked ? 'font-medium text-foreground' : 'text-foreground')}>{row.label}</span>
        {row.soldOut ? <span className="block text-xs text-subtle">Sold out</span> : null}
      </span>
      {!row.soldOut ? <RowPrice row={row} currency={currency} /> : null}
    </>
  )

  return (
    <fieldset ref={register(view.anchor)} tabIndex={-1} aria-invalid={issue ? true : undefined} aria-describedby={issue ? issueId : undefined} className="min-w-0 scroll-mt-4 outline-none">
      <legend className="w-full p-0">
        <span className="flex w-full items-start justify-between gap-3">
          <span id={nameId} className="min-w-0 text-[0.9375rem] font-semibold text-foreground">
            {view.group.name}
          </span>
          {clearable ? (
            <span className="flex shrink-0 items-center gap-1">
              <RuleChip view={view} />
              <button
                type="button"
                onClick={() => clearable && onPick(view, clearable, 0)}
                aria-label={`Clear ${view.group.name}`}
                className="-my-2.5 inline-flex min-h-10 items-center rounded-md px-2 text-xs font-medium text-foreground underline underline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
              >
                Clear
              </button>
            </span>
          ) : (
            <RuleChip view={view} />
          )}
        </span>
      </legend>
      {view.hint ? <p className="mt-0.5 text-xs text-subtle">{view.hint}</p> : null}
      {issue ? (
        <p id={issueId} className="mt-1 text-xs font-medium text-danger">
          {issue.message}
        </p>
      ) : null}

      {view.radio ? (
        <RadioRows
          labelledBy={nameId}
          className="mt-2.5 flex flex-col gap-1.5"
          items={view.rows.map((row) => ({ id: row.option.id, checked: row.picked, disabled: row.disabled }))}
          onPick={(id) => {
            const row = view.rows.find((r) => r.option.id === id)
            if (row && !row.picked) onPick(view, row, 1)
          }}
          render={(entry, props) => {
            const row = view.rows.find((r) => r.option.id === entry.id)!
            return (
              <div className="flex flex-col">
                <button
                  {...props}
                  onClick={(e) => {
                    if (row.picked && !view.rule.required) {
                      e.preventDefault()
                      onToggle(view, row)
                    } else props.onClick(e)
                  }}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    row.picked ? 'border-primary bg-primary-soft/30' : 'border-line hover:border-line-strong',
                  )}
                >
                  {rowBody(row)}
                </button>
                <Nested row={row} attempted={attempted} currency={currency} register={register} onToggle={onToggle} onPick={onPick} />
              </div>
            )
          }}
        />
      ) : (
        <div role="group" aria-labelledby={nameId} className="mt-2.5 flex flex-col gap-1.5">
          {view.rows.map((row) => (
            <div key={row.option.id} className="flex flex-col">
              <div className={cn('flex min-h-12 items-center rounded-xl border transition-colors', row.picked ? 'border-primary bg-primary-soft/30' : 'border-line', row.disabled && 'opacity-50')}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={row.picked}
                  disabled={row.disabled}
                  onClick={() => onToggle(view, row)}
                  className={cn('flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2 text-left disabled:cursor-not-allowed', !row.picked && !row.disabled && 'hover:bg-surface-sunken/50')}
                >
                  {rowBody(row)}
                </button>
                {row.picked && row.cap > 1 ? (
                  <span className="mr-1.5 inline-flex shrink-0 items-center rounded-full border border-line bg-surface">
                    <button type="button" aria-label={stepLabel('fewer', row.label)} className="grid size-10 place-items-center text-muted" onClick={() => onPick(view, row, row.qty - 1)}>
                      <Minus className="size-3.5" aria-hidden="true" />
                    </button>
                    <span className="min-w-[1.25rem] text-center text-sm tabular-nums">{row.qty}</span>
                    <button type="button" aria-label={stepLabel('more', row.label)} disabled={!row.canMore} className="grid size-10 place-items-center text-muted disabled:opacity-40" onClick={() => onPick(view, row, row.qty + 1)}>
                      <Plus className="size-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ) : null}
              </div>
              <Nested row={row} attempted={attempted} currency={currency} register={register} onToggle={onToggle} onPick={onPick} />
            </div>
          ))}
        </div>
      )}
      {view.fullText ? <p className="mt-2 text-xs text-subtle">{view.fullText}</p> : null}
    </fieldset>
  )
}

/** A linked dish's own choices, indented under its row. */
function Nested({ row, ...rest }: { row: OptionRowView } & Omit<GroupFieldsetProps, 'view'>) {
  if (!row.nested.length) return null
  return (
    <div className="mt-3 mb-1 ml-4 flex flex-col gap-5 border-l border-line pl-4">
      {row.nested.map((view) => (
        <GroupFieldset key={view.anchor} view={view} {...rest} />
      ))}
    </div>
  )
}

function RuleChip({ view }: { view: GroupView }) {
  if (view.rule.required) {
    return view.done ? (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success">
        <Check className="size-3" aria-hidden="true" /> Done
      </span>
    ) : (
      <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-muted">{view.rule.text}</span>
    )
  }
  return <span className="shrink-0 text-xs text-subtle">{view.rule.text}</span>
}

function RowPrice({ row, currency }: { row: OptionRowView; currency: CurrencyCode }) {
  if (row.unit <= 0) return null
  if (row.free) {
    return (
      <span className="shrink-0 text-right text-xs tabular-nums">
        <s className="text-subtle">{plusMoney(row.unit, currency)}</s> <span className="font-medium text-success">Free</span>
      </span>
    )
  }
  return (
    <span className="shrink-0 text-right text-xs text-muted tabular-nums">
      {row.priceText}
      {row.freeCount > 0 ? <span className="block text-success">{row.freeCount} free</span> : null}
    </span>
  )
}

/* --------------------------------------------------------------------------
   Radio rows — buttons with radio semantics and arrow-key movement
   -------------------------------------------------------------------------- */

interface RadioEntry {
  id: string
  checked: boolean
  disabled: boolean
}

interface RadioButtonProps {
  type: 'button'
  role: 'radio'
  'aria-checked': boolean
  disabled: boolean
  tabIndex: number
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  'data-radio-id': string
}

function RadioRows({ items, labelledBy, className, onPick, render }: { items: RadioEntry[]; labelledBy: string; className?: string; onPick: (id: string) => void; render: (entry: RadioEntry, props: RadioButtonProps) => React.ReactNode }) {
  const enabled = items.filter((i) => !i.disabled)
  const focusId = items.find((i) => i.checked && !i.disabled)?.id ?? enabled[0]?.id

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft']
    if (!keys.includes(event.key) || !enabled.length) return
    /* only this group's own radios; a linked dish's choices underneath handle their own keys */
    const current = (event.target as HTMLElement).dataset?.radioId
    const at = enabled.findIndex((i) => i.id === current)
    if (current === undefined || (at === -1 && !items.some((i) => i.id === current))) return
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
    const next = enabled[(Math.max(0, at) + step + enabled.length) % enabled.length]
    event.preventDefault()
    event.stopPropagation()
    onPick(next.id)
    event.currentTarget.querySelector<HTMLElement>(`[data-radio-id="${CSS.escape(next.id)}"]`)?.focus()
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className={className} onKeyDown={onKeyDown}>
      {items.map((entry) => (
        <React.Fragment key={entry.id}>
          {render(entry, {
            type: 'button',
            role: 'radio',
            'aria-checked': entry.checked,
            disabled: entry.disabled,
            tabIndex: entry.id === focusId ? 0 : -1,
            onClick: () => onPick(entry.id),
            'data-radio-id': entry.id,
          })}
        </React.Fragment>
      ))}
    </div>
  )
}
