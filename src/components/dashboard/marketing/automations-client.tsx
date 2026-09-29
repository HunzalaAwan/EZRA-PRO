'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, Mail, MessageSquareText, Pause, Pencil, RotateCcw, Send, Tag, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useMessageTemplates } from '@/hooks/use-message-templates'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { usePricing } from '@/hooks/use-pricing'
import { useChannels } from '@/hooks/use-channels'
import { storefrontHost } from '@/lib/channels'
import type { MarketingData } from '@/lib/data/guest-marketing'
import { NO_OFFER, audienceSize, automationStats, cleanCode, percent, upsertOfferPromo } from '@/lib/marketing'
import {
  CHANNEL_LABEL,
  PLACEHOLDERS,
  TRIGGER_OPTIONS,
  groupOf,
  offerOf,
  renderTemplate,
  timingLabel,
  type MessageChannel,
  type MessageContext,
  type MessageTemplate,
} from '@/lib/messaging'
import { cn, formatCurrency } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   AUTOMATIONS
   Emails and texts that go on their own. The ones around every booking
   (confirmation, reminders, reviews) and the ones that bring guests back
   (welcome, next trip, win-back, birthdays). Each can be switched off,
   retimed, aimed at an audience, carry a code and test two subject lines.
   ========================================================================== */

const BOOKING_TRIGGERS = new Set(['on_booking', 'before', 'after', 'manual'])

export function AutomationsClient({
  tenant: tenantRecord,
  nowIso,
  data,
  sample: seededSample,
}: {
  tenant: Tenant
  nowIso: string
  data: MarketingData
  sample: MessageContext
}) {
  const tenant = useMarketingTenant(tenantRecord)
  const currency = tenantRecord.currency
  const { templates, update, reset, hasEdits } = useMessageTemplates(tenantRecord.id)
  const marketing = useMarketing(tenant, nowIso)
  const pricing = usePricing(tenant.slug)
  const { settings: channels } = useChannels(tenantRecord)
  const host = storefrontHost(channels, tenant.slug)
  const sample = React.useMemo(
    () => ({
      ...seededSample,
      manage_link: String(seededSample.manage_link ?? '').replace(`${tenant.slug}.ezrapro.com`, host),
      book_link: `${host}`,
    }),
    [seededSample, host, tenant.slug],
  )
  const [editing, setEditing] = React.useState<MessageTemplate | null>(null)
  const [filter, setFilter] = React.useState<'all' | 'on' | 'off'>('all')
  const subscribed = data.contacts.filter((contact) => contact.emailOptIn || contact.smsOptIn).length

  const booking = templates.filter((template) => groupOf(template) === 'booking')
  const growth = templates.filter((template) => groupOf(template) === 'growth')
  const visible = (list: MessageTemplate[]) => list.filter((template) => (filter === 'all' ? true : filter === 'on' ? template.enabled : !template.enabled))
  const growthTotals = growth.reduce(
    (sum, template) => {
      const stats = automationStats(template.key, template.enabled && !marketing.settings.paused, subscribed, data.avgOrder, true)
      return { sent: sum.sent + stats.sent, bookings: sum.bookings + stats.bookings, revenue: sum.revenue + stats.revenue }
    },
    { sent: 0, bookings: 0, revenue: 0 },
  )

  const toggle = (template: MessageTemplate, enabled: boolean) => {
    update(template.key, { enabled })
    if (enabled && offerOf(template).enabled) pricing.setPromos(upsertOfferPromo(pricing.promos, offerOf(template), `From the ${template.name} automation`, template.activitySlugs))
    toast(enabled ? `${template.name} is on` : `${template.name} is off`)
  }

  const row = (template: MessageTemplate) => {
    const growthRow = groupOf(template) === 'growth'
    const stats = automationStats(template.key, template.enabled && !(growthRow && marketing.settings.paused), subscribed, data.avgOrder, growthRow)
    const audience = marketing.audiences.find((entry) => entry.id === template.audienceId)
    return (
      <li key={template.key} className={cn('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start', !template.enabled && 'opacity-60')}>
        <span aria-hidden="true" className="hidden size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-subtle sm:grid">
          {template.channel === 'sms' ? <MessageSquareText className="size-[1.125rem]" /> : <Mail className="size-[1.125rem]" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{template.name}</p>
            <Badge variant="neutral" size="sm">{CHANNEL_LABEL[template.channel]}</Badge>
            {offerOf(template).enabled ? (
              <Badge variant="success" size="sm">
                {offerOf(template).percent}% code
              </Badge>
            ) : null}
            {template.abTest?.enabled ? <Badge variant="info" size="sm">A/B subject</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs text-subtle">
            {timingLabel(template.timing)}
            {growthRow && audience ? ` · ${audience.name}` : ''}
            {template.activitySlugs && template.activitySlugs.length > 0 ? ` · ${template.activitySlugs.length} ${template.activitySlugs.length === 1 ? 'activity' : 'activities'}` : ''}
          </p>
          <p className="mt-1.5 line-clamp-2 text-sm text-muted">
            {renderTemplate(template.body, { ...sample, offer_code: offerOf(template).code, offer_percent: `${offerOf(template).percent}%` })}
          </p>
          {template.enabled && stats.sent > 0 ? (
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
              <div className="flex gap-1"><dt>Sent</dt><dd className="font-medium text-foreground tabular">{stats.sent.toLocaleString('en-US')}</dd></div>
              {template.channel !== 'sms' ? <div className="flex gap-1"><dt>Opened</dt><dd className="font-medium text-foreground tabular">{percent(stats.openRate)}</dd></div> : null}
              <div className="flex gap-1"><dt>Clicked</dt><dd className="font-medium text-foreground tabular">{percent(stats.clickRate, 1)}</dd></div>
              {growthRow ? (
                <div className="flex gap-1">
                  <dt>Booked</dt>
                  <dd className="font-medium text-foreground tabular">{stats.bookings} · {formatCurrency(stats.revenue * 100, currency)}</dd>
                </div>
              ) : null}
              <span className="text-faint">last 30 days</span>
            </dl>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch checked={template.enabled} onCheckedChange={(checked) => toggle(template, checked)} aria-label={`${template.name} on`} />
          <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => setEditing({ ...template })}>
            Edit
          </Button>
        </div>
      </li>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {marketing.settings.paused ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-soft/40 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Pause className="size-4 text-warning" aria-hidden="true" />
            Marketing is paused. Booking messages still go; nothing under “Bring guests back” is sent.
          </p>
          <Button size="sm" variant="secondary" onClick={() => { marketing.setSettings({ ...marketing.settings, paused: false }); toast.success('Marketing is back on') }}>
            Resume marketing
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Show" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {(['all', 'on', 'off'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={filter === value}
              onClick={() => setFilter(value)}
              className={cn('h-8 rounded-md px-3 text-sm font-medium', filter === value ? 'bg-surface-sunken text-foreground' : 'text-muted hover:text-foreground')}
            >
              {value === 'all' ? 'All' : value === 'on' ? `On · ${templates.filter((t) => t.enabled).length}` : `Off · ${templates.filter((t) => !t.enabled).length}`}
            </button>
          ))}
        </div>
        {hasEdits ? (
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={() => { reset(); toast('Automations restored to the defaults') }}>
            Restore defaults
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle>Bring guests back</CardTitle>
          <CardDescription>
            Marketing that runs on its own, only to guests who said yes.{' '}
            {growthTotals.bookings > 0
              ? `In the last 30 days: ${growthTotals.sent.toLocaleString('en-US')} sent, ${growthTotals.bookings} bookings, ${formatCurrency(growthTotals.revenue * 100, currency)}.`
              : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {visible(growth).length > 0 ? (
            <ul className="flex list-none flex-col divide-y divide-line-subtle border-t border-line-subtle p-0">{visible(growth).map(row)}</ul>
          ) : (
            <p className="border-t border-line-subtle px-5 py-4 text-sm text-subtle">Nothing here with this filter.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle>Around every booking</CardTitle>
          <CardDescription>Confirmations, reminders and follow-ups. These go to every guest, subscribed or not, because they are about their trip.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {visible(booking).length > 0 ? (
            <ul className="flex list-none flex-col divide-y divide-line-subtle border-t border-line-subtle p-0">{visible(booking).map(row)}</ul>
          ) : (
            <p className="border-t border-line-subtle px-5 py-4 text-sm text-subtle">Nothing here with this filter.</p>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-subtle">
        Quiet hours, the weekly limit and the unsubscribe footer are in{' '}
        <Link href="/dashboard/marketing/settings" className="font-medium text-primary hover:underline">
          Marketing settings
        </Link>
        . Sender address and texting number are in{' '}
        <Link href="/dashboard/settings/channels" className="font-medium text-primary hover:underline">
          Domains &amp; numbers
        </Link>
        .
      </p>

      <AutomationEditor
        template={editing}
        onClose={() => setEditing(null)}
        sample={sample}
        business={tenant.name}
        audiences={marketing.audiences.map((audience) => ({ id: audience.id, name: audience.name, count: audienceSize(data.contacts, audience.filter, nowIso).count }))}
        activities={data.activities}
        onSave={(draft) => {
          update(draft.key, {
            subject: draft.subject,
            body: draft.body,
            channel: draft.channel,
            timing: draft.timing,
            enabled: draft.enabled,
            audienceId: draft.audienceId,
            activitySlugs: draft.activitySlugs,
            offer: draft.offer ? { ...draft.offer, code: cleanCode(draft.offer.code) } : undefined,
            abTest: draft.abTest,
            stopIfBooked: draft.stopIfBooked,
          })
          if (draft.offer?.enabled) pricing.setPromos(upsertOfferPromo(pricing.promos, draft.offer, `From the ${draft.name} automation`, draft.activitySlugs))
          toast.success(`${draft.name} saved`, { description: draft.offer?.enabled ? `Code ${cleanCode(draft.offer.code)} works at checkout.` : 'New messages use the new wording.' })
          setEditing(null)
        }}
      />
    </div>
  )
}

/* ==========================================================================
   The editor
   ========================================================================== */

function AutomationEditor({
  template,
  onClose,
  onSave,
  sample,
  business,
  audiences,
  activities,
}: {
  template: MessageTemplate | null
  onClose: () => void
  onSave: (template: MessageTemplate) => void
  sample: MessageContext
  business: string
  audiences: { id: string; name: string; count: number }[]
  activities: { slug: string; name: string }[]
}) {
  const [draft, setDraft] = React.useState<MessageTemplate | null>(template)
  const bodyRef = React.useRef<HTMLTextAreaElement>(null)
  React.useEffect(() => setDraft(template), [template])
  if (!draft) return <Sheet open={false} />

  const growth = groupOf(draft) === 'growth'
  const trigger = TRIGGER_OPTIONS.find((option) => option.value === draft.timing.when) ?? TRIGGER_OPTIONS[0]
  const triggers = TRIGGER_OPTIONS.filter((option) => growth || BOOKING_TRIGGERS.has(option.value))
  const offer = offerOf(draft)
  const context = { ...sample, offer_code: cleanCode(offer.code) || 'CODE', offer_percent: `${offer.percent}%`, business }
  const rendered = renderTemplate(draft.body, context)
  const set = (patch: Partial<MessageTemplate>) => setDraft({ ...draft, ...patch })
  const setOffer = (patch: Partial<typeof offer>) => set({ offer: { ...NO_OFFER, ...draft.offer, ...patch } })
  const amount = trigger.unit === 'days' ? Math.round(draft.timing.hours / 24) : draft.timing.hours

  const insert = (token: string) => {
    const el = bodyRef.current
    const at = el?.selectionStart ?? draft.body.length
    set({ body: draft.body.slice(0, at) + token + draft.body.slice(el?.selectionEnd ?? at) })
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(at + token.length, at + token.length)
    })
  }

  return (
    <Sheet open onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" size="lg">
        <SheetHeader>
          <SheetTitle>{draft.name}</SheetTitle>
          <SheetDescription>{draft.purpose}</SheetDescription>
        </SheetHeader>
        <SheetBody className="flex flex-col gap-6">
          <label className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3">
            <span>
              <span className="block text-sm font-medium">{draft.enabled ? 'On' : 'Off'}</span>
              <span className="block text-xs text-subtle">{draft.enabled ? 'Goes on its own when the moment comes.' : 'Nothing is sent until you switch it on.'}</span>
            </span>
            <Switch checked={draft.enabled} onCheckedChange={(enabled) => set({ enabled })} aria-label="On" />
          </label>

          {/* ---------- when ---------- */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">When it goes</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Moment" className="sm:col-span-2">
                <Select
                  value={draft.timing.when}
                  onValueChange={(value) => {
                    const next = TRIGGER_OPTIONS.find((option) => option.value === value)!
                    const hours = next.hours === 'none' ? 0 : next.unit === 'days' ? Math.max(24, draft.timing.hours) : Math.max(1, draft.timing.hours)
                    set({ timing: { when: next.value, hours } })
                  }}
                >
                  <SelectTrigger aria-label="Moment"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {triggers.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {trigger.hours !== 'none' ? (
                <Field label={trigger.unit === 'days' ? 'Days' : 'Hours'}>
                  {(control) => (
                    <Input
                      {...control}
                      type="number"
                      min={0}
                      value={amount}
                      onChange={(e) => {
                        const value = Math.max(0, Number(e.target.value) || 0)
                        set({ timing: { ...draft.timing, hours: trigger.unit === 'days' ? value * 24 : value } })
                      }}
                    />
                  )}
                </Field>
              ) : null}
            </div>
            <p className="text-xs text-subtle">{timingLabel(draft.timing)}.</p>
          </section>

          {/* ---------- who ---------- */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Who gets it</h3>
            {growth ? (
              <Field label="Audience" description="Only guests who said yes to marketing.">
                <Select value={draft.audienceId ?? 'aud_all'} onValueChange={(audienceId) => set({ audienceId })}>
                  <SelectTrigger aria-label="Audience"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {audiences.map((audience) => (
                      <SelectItem key={audience.id} value={audience.id}>{audience.name} · {audience.count.toLocaleString('en-US')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
            <div>
              <p className="text-[0.8125rem] font-medium">Activities</p>
              <p className="mt-0.5 text-xs text-subtle">{(draft.activitySlugs ?? []).length === 0 ? 'Every activity. Tap to limit it to some.' : 'Only guests of these activities.'}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activities.map((activity) => {
                  const on = (draft.activitySlugs ?? []).includes(activity.slug)
                  return (
                    <button
                      key={activity.slug}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set({ activitySlugs: on ? (draft.activitySlugs ?? []).filter((slug) => slug !== activity.slug) : [...(draft.activitySlugs ?? []), activity.slug] })}
                      className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-colors', on ? 'border-primary bg-primary-soft/40 text-foreground' : 'border-line text-muted hover:text-foreground')}
                    >
                      {activity.name}
                    </button>
                  )
                })}
              </div>
            </div>
            {growth ? (
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  Stop once they book
                  <span className="block text-xs text-subtle">Skip it for anyone who has booked since it was due.</span>
                </span>
                <Switch checked={draft.stopIfBooked ?? true} onCheckedChange={(stopIfBooked) => set({ stopIfBooked })} aria-label="Stop once they book" />
              </label>
            ) : null}
          </section>

          {/* ---------- what ---------- */}
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">The message</h3>
            <Field label="Channel">
              <Select value={draft.channel} onValueChange={(value) => set({ channel: value as MessageChannel })}>
                <SelectTrigger aria-label="Channel" className="sm:w-60"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['email', 'sms', 'both'] as MessageChannel[]).map((value) => (
                    <SelectItem key={value} value={value}>{CHANNEL_LABEL[value]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {draft.channel !== 'sms' ? (
              <>
                <Field label="Email subject">
                  {(control) => <Input {...control} value={draft.subject} onChange={(e) => set({ subject: e.target.value })} />}
                </Field>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    Test a second subject
                    <span className="block text-xs text-subtle">Half get each. After a day, the one with more opens goes to everyone.</span>
                  </span>
                  <Switch
                    checked={Boolean(draft.abTest?.enabled)}
                    onCheckedChange={(enabled) => set({ abTest: { subjectB: draft.abTest?.subjectB ?? '', enabled } })}
                    aria-label="Test a second subject"
                  />
                </label>
                {draft.abTest?.enabled ? (
                  <Field label="Subject B">
                    {(control) => <Input {...control} value={draft.abTest?.subjectB ?? ''} placeholder="Another way to say it" onChange={(e) => set({ abTest: { enabled: true, subjectB: e.target.value } })} />}
                  </Field>
                ) : null}
              </>
            ) : null}
            <div>
              <Field
                label="Message"
                description={draft.channel !== 'email' ? `${rendered.length} characters · ${Math.max(1, Math.ceil(rendered.length / 160))} text ${rendered.length > 160 ? 'segments' : 'segment'}` : undefined}
              >
                {(control) => <Textarea {...control} ref={bodyRef} rows={7} value={draft.body} onChange={(e) => set({ body: e.target.value })} />}
              </Field>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PLACEHOLDERS.map((entry) => (
                  <button
                    key={entry.token}
                    type="button"
                    onClick={() => insert(entry.token)}
                    className="rounded-md border border-line px-2 py-0.5 font-mono text-xs text-muted transition-colors hover:border-primary/50 hover:text-foreground"
                    title={`Insert ${entry.label}`}
                  >
                    {entry.token}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* ---------- offer ---------- */}
          <section className="rounded-xl border border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Tag className="size-4 text-subtle" aria-hidden="true" />
                  Include a discount code
                </p>
                <p className="mt-0.5 text-xs text-subtle">Saved in Pricing → Promo codes, so it works at checkout. Use {'{offer_code}'} and {'{offer_percent}'} in the message.</p>
              </div>
              <Switch checked={offer.enabled} onCheckedChange={(enabled) => setOffer({ enabled, code: offer.code || draft.key.toUpperCase().replace(/_/g, '').slice(0, 10) + offer.percent })} aria-label="Include a discount code" />
            </div>
            {offer.enabled ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Code">
                  {(control) => <Input {...control} value={offer.code} onChange={(e) => setOffer({ code: cleanCode(e.target.value) })} className="font-mono" />}
                </Field>
                <Field label="Discount">
                  {(control) => <Input {...control} type="number" min={1} max={100} suffix="%" value={offer.percent} onChange={(e) => setOffer({ percent: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })} />}
                </Field>
                <Field label="Good for">
                  {(control) => <Input {...control} type="number" min={1} suffix="days" value={offer.validDays} onChange={(e) => setOffer({ validDays: Math.max(1, Number(e.target.value) || 1) })} />}
                </Field>
              </div>
            ) : null}
          </section>

          {/* ---------- preview ---------- */}
          <section className="flex flex-col gap-3">
            <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Preview with a real guest</p>
            {draft.channel !== 'sms' ? (
              <div className="rounded-xl border border-line bg-surface">
                <div className="border-b border-line-subtle px-4 py-2.5 text-xs text-subtle">
                  From {business} · <span className="font-medium text-foreground">{renderTemplate(draft.subject, context)}</span>
                </div>
                <p className="px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-foreground">{rendered}</p>
              </div>
            ) : null}
            {draft.channel !== 'email' ? (
              <p className="max-w-[20rem] rounded-2xl rounded-bl-md bg-surface-sunken px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-line text-foreground">{rendered}</p>
            ) : null}
          </section>
        </SheetBody>
        <SheetFooter>
          <Button variant="ghost" leftIcon={<Send />} onClick={() => toast.success('Test sent', { description: 'Check your inbox and phone in a minute.' })}>
            Send me a test
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" leftIcon={<X />} onClick={onClose}>Cancel</Button>
          <Button leftIcon={<Check />} onClick={() => onSave(draft)}>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
