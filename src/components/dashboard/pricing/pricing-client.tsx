'use client'

import * as React from 'react'
import { Ban, Check, Gift, Pencil, Plus, RotateCcw, Tag, TrendingUp, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { usePricing } from '@/hooks/use-pricing'
import {
  RULE_KIND_LABEL,
  applyRules,
  newGiftCode,
  ruleSummary,
  type GiftCard,
  type PricingRule,
  type PromoCode,
  type RuleKind,
} from '@/lib/pricing'
import { cn, formatCurrency, formatDateLong, pluralize } from '@/lib/utils'
import type { CurrencyCode } from '@/types'

/* ==========================================================================
   PRICING
   Rules that move the price, promo codes and gift cards, in one place. The
   storefront, checkout and the walk-in screen read the same store, so a
   change here shows on the next price a guest sees.
   ========================================================================== */

export interface PricingActivity {
  slug: string
  name: string
  basePrice: number
}

type TabKey = 'rules' | 'promos' | 'gifts'

export function PricingClient({
  tenantSlug,
  currency,
  activities,
  nowIso,
}: {
  tenantSlug: string
  currency: CurrencyCode
  activities: PricingActivity[]
  nowIso: string
}) {
  const pricing = usePricing(tenantSlug)
  const [tab, setTab] = React.useState<TabKey>('rules')
  const todayKey = nowIso.slice(0, 10)
  const liability = pricing.giftCards.filter((card) => card.status === 'active').reduce((sum, card) => sum + card.balance, 0)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Section"
          value={tab}
          onValueChange={setTab}
          options={[
            { value: 'rules', label: 'Price rules', count: pricing.rules.filter((rule) => rule.active).length },
            { value: 'promos', label: 'Promo codes', count: pricing.promos.filter((promo) => promo.active).length },
            { value: 'gifts', label: 'Gift cards', count: pricing.giftCards.filter((card) => card.status === 'active').length },
          ]}
        />
        {pricing.hasEdits ? (
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={() => { pricing.reset(); toast('Pricing restored to the defaults') }}>
            Restore defaults
          </Button>
        ) : null}
      </div>

      {tab === 'rules' ? <RulesTab pricing={pricing} activities={activities} currency={currency} nowIso={nowIso} /> : null}
      {tab === 'promos' ? <PromosTab pricing={pricing} activities={activities} currency={currency} todayKey={todayKey} /> : null}
      {tab === 'gifts' ? <GiftsTab pricing={pricing} currency={currency} todayKey={todayKey} liability={liability} /> : null}
    </div>
  )
}

type Pricing = ReturnType<typeof usePricing>

/* --------------------------------------------------------------------------
   Rules
   -------------------------------------------------------------------------- */

const BLANK_RULE: PricingRule = { id: '', name: '', kind: 'early_bird', percent: -10, activitySlugs: [], daysAhead: 30, active: true }

function RulesTab({ pricing, activities, currency, nowIso }: { pricing: Pricing; activities: PricingActivity[]; currency: CurrencyCode; nowIso: string }) {
  const [editing, setEditing] = React.useState<PricingRule | null>(null)
  const [previewSlug, setPreviewSlug] = React.useState(activities[0]?.slug ?? '')
  const [previewDays, setPreviewDays] = React.useState('35')
  const [previewGuests, setPreviewGuests] = React.useState(2)

  const activity = activities.find((entry) => entry.slug === previewSlug)
  const start = new Date(new Date(nowIso).getTime() + Number(previewDays) * 86_400_000)
  start.setHours(10, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  const startIso = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T10:00:00`
  const preview = applyRules(pricing.rules, { activitySlug: previewSlug, startsAt: startIso, nowIso, guests: previewGuests })

  const save = (rule: PricingRule) => {
    if (!rule.name.trim()) return
    const exists = pricing.rules.some((entry) => entry.id === rule.id)
    pricing.setRules(exists ? pricing.rules.map((entry) => (entry.id === rule.id ? rule : entry)) : [...pricing.rules, { ...rule, id: `rule_${Date.now().toString(36)}` }])
    toast.success(`${rule.name} saved`, { description: 'Prices on the storefront update straight away.' })
    setEditing(null)
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Price rules</CardTitle>
            <CardDescription>Applied one after another to the ticket price. They never take a price below half.</CardDescription>
          </div>
          <Button size="sm" leftIcon={<Plus />} onClick={() => setEditing({ ...BLANK_RULE })}>Add rule</Button>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
            {pricing.rules.map((rule) => (
              <li key={rule.id} className={cn('flex items-start gap-4 px-5 py-4', !rule.active && 'opacity-60')}>
                <span aria-hidden="true" className={cn('grid size-10 shrink-0 place-items-center rounded-xl', rule.percent < 0 ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning')}>
                  <TrendingUp className={cn('size-[1.125rem]', rule.percent < 0 && 'rotate-180')} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    {rule.name}
                    <Badge variant="neutral" size="sm">{RULE_KIND_LABEL[rule.kind]}</Badge>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">{ruleSummary(rule)}</p>
                  <p className="mt-0.5 text-xs text-subtle">
                    {rule.activitySlugs.length === 0 ? 'Every activity' : rule.activitySlugs.map((slug) => activities.find((entry) => entry.slug === slug)?.name ?? slug).join(', ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Switch checked={rule.active} onCheckedChange={(checked) => pricing.setRules(pricing.rules.map((entry) => (entry.id === rule.id ? { ...entry, active: checked } : entry)))} aria-label={`${rule.name} on`} />
                  <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => setEditing({ ...rule })}>Edit</Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle>Price check</CardTitle>
          <CardDescription>What a guest pays, with the rules as they are now.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Select value={previewSlug} onValueChange={setPreviewSlug}>
            <SelectTrigger aria-label="Activity"><SelectValue /></SelectTrigger>
            <SelectContent>
              {activities.map((entry) => (
                <SelectItem key={entry.slug} value={entry.slug}>{entry.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Select value={previewDays} onValueChange={setPreviewDays}>
              <SelectTrigger aria-label="When"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[['0', 'Later today'], ['1', 'Tomorrow'], ['7', 'In a week'], ['35', 'In five weeks'], ['100', 'In December']].map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="number" min={1} value={previewGuests} onChange={(e) => setPreviewGuests(Math.max(1, Number(e.target.value) || 1))} aria-label="Guests" />
          </div>
          <div className="rounded-xl bg-surface-sunken px-4 py-3 text-sm">
            <div className="flex justify-between text-muted"><span>Base price</span><span className="tabular-nums">{formatCurrency(activity?.basePrice ?? 0, currency)}</span></div>
            {preview.applied.map((rule) => (
              <div key={rule.id} className="flex justify-between text-muted">
                <span>{rule.name}</span>
                <span className={cn('tabular-nums', rule.percent < 0 ? 'text-success' : 'text-warning')}>{rule.percent > 0 ? '+' : ''}{rule.percent}%</span>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-line pt-2 font-semibold">
              <span>Per guest on {formatDateLong(start)}</span>
              <span className="tabular-nums">{formatCurrency(Math.round((activity?.basePrice ?? 0) * preview.multiplier), currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <RuleDialog rule={editing} activities={activities} onClose={() => setEditing(null)} onSave={save} onDelete={(id) => { pricing.setRules(pricing.rules.filter((entry) => entry.id !== id)); setEditing(null); toast('Rule removed') }} />
    </div>
  )
}

function ActivityPicker({ value, onChange, activities }: { value: string[]; onChange: (value: string[]) => void; activities: PricingActivity[] }) {
  return (
    <div>
      <label className="mb-2 inline-flex items-center gap-2 text-sm">
        <Checkbox checked={value.length === 0} onCheckedChange={(checked) => onChange(checked === true ? [] : [activities[0]?.slug ?? ''])} />
        Every activity
      </label>
      {value.length > 0 ? (
        <div className="grid max-h-44 gap-1.5 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-2">
          {activities.map((entry) => (
            <label key={entry.slug} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={value.includes(entry.slug)}
                onCheckedChange={(checked) => {
                  const next = checked === true ? [...value, entry.slug] : value.filter((slug) => slug !== entry.slug)
                  onChange(next.length === 0 ? [entry.slug] : next)
                }}
              />
              <span className="truncate">{entry.name}</span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function RuleDialog({ rule, activities, onClose, onSave, onDelete }: { rule: PricingRule | null; activities: PricingActivity[]; onClose: () => void; onSave: (rule: PricingRule) => void; onDelete: (id: string) => void }) {
  const [draft, setDraft] = React.useState<PricingRule | null>(rule)
  React.useEffect(() => setDraft(rule), [rule])
  if (!draft) return null
  const set = (patch: Partial<PricingRule>) => setDraft({ ...draft, ...patch })
  return (
    <Dialog open={rule !== null} onOpenChange={(value) => !value && onClose()}>
      <DialogContent size="md">
        <DialogHeader divider>
          <DialogTitle>{draft.id ? `Edit ${draft.name}` : 'Add a price rule'}</DialogTitle>
          <DialogDescription>Negative percentages are discounts; positive ones raise the price.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 py-4">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_8rem]">
            <Field label="Name" required>
              {(control) => <Input {...control} value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Early bird" />}
            </Field>
            <Field label="Change %">
              {(control) => <Input {...control} type="number" min={-50} max={100} value={draft.percent} onChange={(e) => set({ percent: Math.max(-50, Math.min(100, Number(e.target.value) || 0)) })} />}
            </Field>
          </div>
          <Field label="When it applies">
            <Select value={draft.kind} onValueChange={(value) => set({ kind: value as RuleKind })}>
              <SelectTrigger aria-label="Rule type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(RULE_KIND_LABEL) as RuleKind[]).map((kind) => (
                  <SelectItem key={kind} value={kind}>{RULE_KIND_LABEL[kind]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {draft.kind === 'season' ? (
            <div className="grid grid-cols-2 gap-4">
              <Field label="From (MM-DD)">{(control) => <Input {...control} value={draft.from ?? ''} placeholder="12-18" onChange={(e) => set({ from: e.target.value })} />}</Field>
              <Field label="To (MM-DD)">{(control) => <Input {...control} value={draft.to ?? ''} placeholder="01-04" onChange={(e) => set({ to: e.target.value })} />}</Field>
            </div>
          ) : null}
          {draft.kind === 'weekday' ? (
            <div className="flex flex-wrap gap-1.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, day) => {
                const on = (draft.weekdays ?? []).includes(day)
                return (
                  <button key={label} type="button" aria-pressed={on} onClick={() => set({ weekdays: on ? (draft.weekdays ?? []).filter((entry) => entry !== day) : [...(draft.weekdays ?? []), day] })} className={cn('rounded-lg border px-3 py-1.5 text-sm', on ? 'border-primary bg-primary-soft text-primary' : 'border-line')}>
                    {label}
                  </button>
                )
              })}
            </div>
          ) : null}
          {draft.kind === 'early_bird' ? <Field label="Booked at least this many days ahead">{(control) => <Input {...control} type="number" min={1} value={draft.daysAhead ?? 30} onChange={(e) => set({ daysAhead: Math.max(1, Number(e.target.value) || 1) })} />}</Field> : null}
          {draft.kind === 'last_minute' ? <Field label="Within this many hours of the start">{(control) => <Input {...control} type="number" min={1} value={draft.hoursWithin ?? 24} onChange={(e) => set({ hoursWithin: Math.max(1, Number(e.target.value) || 1) })} />}</Field> : null}
          {draft.kind === 'group' ? <Field label="Guests at least">{(control) => <Input {...control} type="number" min={2} value={draft.minGuests ?? 8} onChange={(e) => set({ minGuests: Math.max(2, Number(e.target.value) || 2) })} />}</Field> : null}
          <Field label="Activities">
            <ActivityPicker value={draft.activitySlugs} onChange={(activitySlugs) => set({ activitySlugs })} activities={activities} />
          </Field>
        </DialogBody>
        <DialogFooter divider>
          {draft.id ? <Button variant="ghost" size="sm" className="mr-auto text-danger" onClick={() => onDelete(draft.id)}>Remove rule</Button> : null}
          <Button variant="ghost" size="sm" leftIcon={<X />} onClick={onClose}>Cancel</Button>
          <Button size="sm" leftIcon={<Check />} disabled={!draft.name.trim()} onClick={() => onSave(draft)}>Save rule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------------------------------------------------------
   Promo codes
   -------------------------------------------------------------------------- */

const BLANK_PROMO: PromoCode = { code: '', kind: 'percent', value: 10, activitySlugs: [], minSubtotal: 0, maxUses: 100, used: 0, active: true }

function PromosTab({ pricing, activities, currency, todayKey }: { pricing: Pricing; activities: PricingActivity[]; currency: CurrencyCode; todayKey: string }) {
  const [draft, setDraft] = React.useState<PromoCode | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  /** The code being edited, or null for a new one. */
  const [original, setOriginal] = React.useState<string | null>(null)

  const save = () => {
    if (!draft) return
    const code = draft.code.trim().toUpperCase().replace(/\s+/g, '')
    if (code.length < 3) return setError('Codes need at least three characters.')
    if (code !== original && pricing.promos.some((promo) => promo.code === code)) return setError('That code already exists.')
    pricing.setPromos(original ? pricing.promos.map((promo) => (promo.code === original ? { ...draft, code } : promo)) : [{ ...draft, code }, ...pricing.promos])
    toast.success(`${code} saved`, { description: 'Guests can use it at checkout now.' })
    setDraft(null)
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Promo codes</CardTitle>
          <CardDescription>Guests enter them at checkout; the walk-in screen takes them too.</CardDescription>
        </div>
        <Button size="sm" leftIcon={<Plus />} onClick={() => { setDraft({ ...BLANK_PROMO }); setOriginal(null); setError(null) }}>New code</Button>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
          {pricing.promos.map((promo) => {
            const expired = Boolean(promo.endsOn && todayKey > promo.endsOn)
            const share = promo.maxUses > 0 ? promo.used / promo.maxUses : 0
            return (
              <li key={promo.code} className={cn('flex flex-wrap items-center gap-4 px-5 py-4', (!promo.active || expired) && 'opacity-60')}>
                <span className="inline-flex items-center gap-2 font-mono text-sm font-semibold">
                  <Tag className="size-4 text-primary" aria-hidden="true" />
                  {promo.code}
                </span>
                <span className="min-w-0 flex-1 text-sm text-muted">
                  {promo.kind === 'percent' ? `${promo.value}% off` : `${formatCurrency(promo.value, currency)} off`}
                  {promo.activitySlugs.length > 0 ? ` · ${promo.activitySlugs.map((slug) => activities.find((entry) => entry.slug === slug)?.name ?? slug).join(', ')}` : ' · every activity'}
                  {promo.minSubtotal > 0 ? ` · over ${formatCurrency(promo.minSubtotal, currency)}` : ''}
                  {promo.note ? <span className="block text-xs text-subtle">{promo.note}</span> : null}
                </span>
                <span className="w-36">
                  <span className="block text-xs text-subtle tabular-nums">{promo.used} of {promo.maxUses} used</span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                    <span className={cn('block h-full rounded-full', share >= 0.9 ? 'bg-warning' : 'bg-primary')} style={{ width: `${Math.min(100, share * 100)}%` }} />
                  </span>
                </span>
                {expired ? <Badge variant="neutral" size="sm">Expired</Badge> : null}
                <Switch checked={promo.active} onCheckedChange={(checked) => pricing.setPromos(pricing.promos.map((entry) => (entry.code === promo.code ? { ...entry, active: checked } : entry)))} aria-label={`${promo.code} on`} />
                <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => { setDraft({ ...promo }); setOriginal(promo.code); setError(null) }}>Edit</Button>
              </li>
            )
          })}
        </ul>
      </CardContent>

      <Dialog open={draft !== null} onOpenChange={(value) => !value && setDraft(null)}>
        <DialogContent size="md">
          {draft ? (
            <>
              <DialogHeader divider>
                <DialogTitle>{draft.code ? `Code ${draft.code}` : 'New promo code'}</DialogTitle>
                <DialogDescription>Share it in a newsletter, with hotel partners or on a flyer.</DialogDescription>
              </DialogHeader>
              <DialogBody className="flex flex-col gap-4 py-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Code" required error={error ?? undefined}>
                    {(control) => <Input {...control} className="font-mono uppercase" value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} placeholder="SPRING15" />}
                  </Field>
                  <Field label="Type">
                    <Select value={draft.kind} onValueChange={(value) => setDraft({ ...draft, kind: value as PromoCode['kind'] })}>
                      <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percent off</SelectItem>
                        <SelectItem value="fixed">Amount off</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={draft.kind === 'percent' ? 'Percent' : 'Amount'}>
                    {(control) => <Input {...control} type="number" min={1} value={draft.kind === 'percent' ? draft.value : draft.value / 100} onChange={(e) => setDraft({ ...draft, value: Math.max(1, draft.kind === 'percent' ? Math.min(100, Number(e.target.value) || 1) : Math.round((Number(e.target.value) || 1) * 100)) })} />}
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Minimum spend">{(control) => <Input {...control} type="number" min={0} value={draft.minSubtotal / 100} onChange={(e) => setDraft({ ...draft, minSubtotal: Math.max(0, Math.round((Number(e.target.value) || 0) * 100)) })} />}</Field>
                  <Field label="Uses allowed">{(control) => <Input {...control} type="number" min={1} value={draft.maxUses} onChange={(e) => setDraft({ ...draft, maxUses: Math.max(1, Number(e.target.value) || 1) })} />}</Field>
                  <Field label="Ends on" optional>{(control) => <Input {...control} type="date" value={draft.endsOn ?? ''} onChange={(e) => setDraft({ ...draft, endsOn: e.target.value || undefined })} />}</Field>
                </div>
                <Field label="Activities">
                  <ActivityPicker value={draft.activitySlugs} onChange={(activitySlugs) => setDraft({ ...draft, activitySlugs })} activities={activities} />
                </Field>
                <Field label="Note for the team" optional>{(control) => <Input {...control} value={draft.note ?? ''} onChange={(e) => setDraft({ ...draft, note: e.target.value || undefined })} placeholder="Concierge partners" />}</Field>
              </DialogBody>
              <DialogFooter divider>
                <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>Cancel</Button>
                <Button size="sm" leftIcon={<Check />} onClick={save}>Save code</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

/* --------------------------------------------------------------------------
   Gift cards
   -------------------------------------------------------------------------- */

function GiftsTab({ pricing, currency, todayKey, liability }: { pricing: Pricing; currency: CurrencyCode; todayKey: string; liability: number }) {
  const [issuing, setIssuing] = React.useState(false)
  const [form, setForm] = React.useState({ amount: 10000, recipient: '', recipientEmail: '', message: '' })
  const issued = pricing.giftCards.reduce((sum, card) => sum + card.initial, 0)
  const redeemed = pricing.giftCards.reduce((sum, card) => sum + (card.initial - card.balance), 0)

  const issue = () => {
    if (form.recipient.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(form.recipientEmail)) return
    const expires = new Date(`${todayKey}T12:00:00`)
    expires.setFullYear(expires.getFullYear() + 3)
    const card: GiftCard = {
      code: newGiftCode(),
      initial: form.amount,
      balance: form.amount,
      purchaser: 'Issued by the team',
      recipient: form.recipient.trim(),
      recipientEmail: form.recipientEmail.trim(),
      message: form.message.trim() || undefined,
      issuedAt: todayKey,
      expiresAt: expires.toISOString().slice(0, 10),
      status: 'active',
    }
    pricing.setGiftCards([card, ...pricing.giftCards])
    toast.success(`Gift card ${card.code} issued`, { description: `${formatCurrency(card.initial, currency)} emailed to ${card.recipient}.` })
    setIssuing(false)
    setForm({ amount: 10000, recipient: '', recipientEmail: '', message: '' })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Outstanding balance', value: formatCurrency(liability, currency), hint: 'Owed to guests on active cards' },
          { label: 'Sold and issued', value: formatCurrency(issued, currency), hint: `${pricing.giftCards.length} ${pluralize(pricing.giftCards.length, 'card')}` },
          { label: 'Redeemed', value: formatCurrency(redeemed, currency), hint: 'Spent on bookings' },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface px-4 py-3.5">
            <p className="text-xs font-medium text-muted">{tile.label}</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{tile.value}</p>
            <p className="text-xs text-subtle">{tile.hint}</p>
          </div>
        ))}
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Gift cards</CardTitle>
            <CardDescription>Sold on the storefront or issued here. Guests spend them at checkout or at the desk.</CardDescription>
          </div>
          <Button size="sm" leftIcon={<Gift />} onClick={() => setIssuing(true)}>Issue a gift card</Button>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="flex list-none flex-col divide-y divide-line-subtle p-0">
            {pricing.giftCards.map((card) => (
              <li key={card.code} className={cn('flex flex-wrap items-center gap-4 px-5 py-4', card.status !== 'active' && 'opacity-60')}>
                <span className="font-mono text-sm font-semibold">{card.code}</span>
                <span className="min-w-0 flex-1 text-sm text-muted">
                  For {card.recipient} · from {card.purchaser}
                  <span className="block text-xs text-subtle">Issued {formatDateLong(new Date(`${card.issuedAt}T12:00:00`))} · expires {formatDateLong(new Date(`${card.expiresAt}T12:00:00`))}</span>
                </span>
                <span className="text-right text-sm">
                  <span className="block font-semibold tabular-nums">{formatCurrency(card.balance, currency)}</span>
                  <span className="block text-xs text-subtle tabular-nums">of {formatCurrency(card.initial, currency)}</span>
                </span>
                <Badge variant={card.status === 'active' ? 'success' : 'neutral'} size="sm">{card.status === 'active' ? 'Active' : card.status === 'redeemed' ? 'Used up' : 'Void'}</Badge>
                {card.status === 'active' ? (
                  <Button variant="ghost" size="sm" leftIcon={<Ban />} onClick={() => { pricing.setGiftCards(pricing.giftCards.map((entry) => (entry.code === card.code ? { ...entry, status: 'void' } : entry))); toast(`${card.code} voided`) }}>
                    Void
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Dialog open={issuing} onOpenChange={setIssuing}>
        <DialogContent size="md">
          <DialogHeader divider>
            <DialogTitle>Issue a gift card</DialogTitle>
            <DialogDescription>For a prize, an apology or a partner. The recipient gets it by email.</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4 py-4">
            <div className="flex flex-wrap gap-2">
              {[5000, 10000, 20000, 30000].map((amount) => (
                <button key={amount} type="button" aria-pressed={form.amount === amount} onClick={() => setForm((f) => ({ ...f, amount }))} className={cn('rounded-xl border px-4 py-2 text-sm font-semibold', form.amount === amount ? 'border-primary bg-primary-soft text-primary' : 'border-line')}>
                  {formatCurrency(amount, currency)}
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Recipient" required>{(control) => <Input {...control} value={form.recipient} onChange={(e) => setForm((f) => ({ ...f, recipient: e.target.value }))} />}</Field>
              <Field label="Their email" required>{(control) => <Input {...control} type="email" value={form.recipientEmail} onChange={(e) => setForm((f) => ({ ...f, recipientEmail: e.target.value }))} />}</Field>
            </div>
            <Field label="Message" optional>{(control) => <Textarea {...control} rows={2} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} />}</Field>
          </DialogBody>
          <DialogFooter divider>
            <Button variant="ghost" size="sm" onClick={() => setIssuing(false)}>Cancel</Button>
            <Button size="sm" leftIcon={<Gift />} disabled={form.recipient.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(form.recipientEmail)} onClick={issue}>Issue {formatCurrency(form.amount, currency)}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
