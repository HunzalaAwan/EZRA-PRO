'use client'

import * as React from 'react'
import Link from 'next/link'
import { Copy, Mail, MessageSquareText, Pause, Pencil, Plus, RotateCcw, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/components/ui/toaster'
import { AutomationEditor } from '@/components/dashboard/marketing/automation-editor'
import { useMessageTemplates } from '@/hooks/use-message-templates'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { usePricing } from '@/hooks/use-pricing'
import { brandColors, useEmailContext } from '@/hooks/use-email-context'
import type { MarketingData } from '@/lib/data/guest-marketing'
import { EMAIL_TEMPLATES } from '@/lib/email-design'
import { audienceSize, automationStats, cleanCode, percent, upsertOfferPromo } from '@/lib/marketing'
import { CHANNEL_LABEL, groupOf, offerOf, renderTemplate, rulesOf, timingLabel, type MessageContext, type MessageTemplate } from '@/lib/messaging'
import { cn, formatCurrency } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   AUTOMATIONS
   Emails and texts that go on their own: around every booking, the ones
   that bring guests back, and the business's own. Each has its own switch
   and an editor for the trigger, send window, audience, conditions,
   follow-up steps, exit, frequency, code and a designed email.
   ========================================================================== */

type Recipe = { id: string; name: string; hint: string; build: (activities: MarketingData['activities']) => Omit<MessageTemplate, 'key'> }

const RECIPES: Recipe[] = [
  {
    id: 'blank',
    name: 'Start from scratch',
    hint: 'Pick the trigger, write the message',
    build: () => ({
      name: 'New automation',
      purpose: 'Your own automation.',
      group: 'growth',
      channel: 'email',
      subject: 'A note from {business}',
      body: 'Hi {first_name},\n\n',
      timing: { when: 'after', hours: 48 },
      enabled: false,
      audienceId: 'aud_all',
      custom: true,
    }),
  },
  {
    id: 'post_trip',
    name: 'After-trip journey',
    hint: 'Thanks, then a review nudge, then a next-trip code',
    build: () => ({
      name: 'After-trip journey',
      purpose: 'Three messages across the two weeks after a trip.',
      group: 'growth',
      channel: 'email',
      subject: 'Thank you for coming out, {first_name}',
      body: 'Hi {first_name}, thank you for joining us on {activity}. Your photos are in your booking: {manage_link}',
      timing: { when: 'after', hours: 6 },
      enabled: false,
      audienceId: 'aud_all',
      custom: true,
      offer: { enabled: true, percent: 10, validDays: 30, code: 'AGAIN10' },
      rules: { exitOn: 'booked', repeat: 'every' },
      steps: [
        { id: 'st_a', waitDays: 2, onlyIf: 'always', channel: 'email', subject: 'How was it?', body: 'Hi {first_name}, if you have a minute, a review helps us a lot: {manage_link}' },
        { id: 'st_b', waitDays: 10, onlyIf: 'not_booked', channel: 'email', subject: '{offer_percent} off your next trip', body: 'Hi {first_name}, ready for the next one? {offer_code} takes {offer_percent} off: {book_link}' },
      ],
    }),
  },
  {
    id: 'win_back_2',
    name: 'Two-step win-back',
    hint: 'An email, then a text if they did not click',
    build: () => ({
      name: 'Two-step win-back',
      purpose: 'Lapsed guests: an email with a code, then a text a week later.',
      group: 'growth',
      channel: 'email',
      subject: 'We saved you a seat, {first_name}',
      body: 'Hi {first_name}, it has been a while. Here is {offer_percent} off to come back: {offer_code}. {book_link}',
      timing: { when: 'since_last', hours: 150 * 24 },
      enabled: false,
      audienceId: 'aud_lapsed',
      custom: true,
      offer: { enabled: true, percent: 20, validDays: 21, code: 'MISSYOU20' },
      rules: { exitOn: 'clicked', repeat: 'cooldown', cooldownDays: 180, days: [2, 4], sendAt: '10:00' },
      steps: [{ id: 'st_c', waitDays: 7, onlyIf: 'not_clicked', channel: 'sms', subject: '', body: '{business}: your {offer_percent} code {offer_code} runs out soon. {book_link}' }],
    }),
  },
  {
    id: 'upsell',
    name: 'Before-trip upgrade',
    hint: 'Photos or gear, a few days before',
    build: () => ({
      name: 'Before-trip upgrade',
      purpose: 'Offer the photo pack or gear before the day.',
      group: 'growth',
      channel: 'email',
      subject: 'Make {activity} even better',
      body: 'Hi {first_name}, add the photo pack or a GoPro before the day: {manage_link}',
      timing: { when: 'before', hours: 96 },
      enabled: false,
      audienceId: 'aud_all',
      custom: true,
      rules: { repeat: 'every', exitOn: 'never', minPartySize: 2 },
    }),
  },
  {
    id: 'vip',
    name: 'VIP first look',
    hint: 'Your best guests hear about new dates first',
    build: () => ({
      name: 'VIP first look',
      purpose: 'A thank-you to VIPs, two days after each trip.',
      group: 'growth',
      channel: 'email',
      subject: 'For our regulars: first pick of new dates',
      body: 'Hi {first_name}, as one of our regulars you get first pick of next season’s dates, before anyone else: {book_link}',
      timing: { when: 'after', hours: 48 },
      enabled: false,
      audienceId: 'aud_vip',
      custom: true,
      rules: { repeat: 'cooldown', cooldownDays: 60, exitOn: 'never' },
    }),
  },
]

export function AutomationsClient({ tenant: tenantRecord, nowIso, data, sample }: { tenant: Tenant; nowIso: string; data: MarketingData; sample: MessageContext }) {
  const tenant = useMarketingTenant(tenantRecord)
  const currency = tenantRecord.currency
  const { templates, update, create, remove, reset, hasEdits } = useMessageTemplates(tenantRecord.id)
  const marketing = useMarketing(tenant, nowIso)
  const pricing = usePricing(tenant.slug)
  const ctx = useEmailContext(tenantRecord, data.activities, sample as unknown as Record<string, string>)
  const brand = React.useMemo(() => brandColors(tenantRecord), [tenantRecord])
  const [editing, setEditing] = React.useState<{ template: MessageTemplate; isNew: boolean } | null>(null)
  const [picking, setPicking] = React.useState(false)
  const [filter, setFilter] = React.useState<'all' | 'on' | 'off'>('all')
  const subscribed = data.contacts.filter((contact) => contact.emailOptIn || contact.smsOptIn).length

  const own = templates.filter((template) => template.custom)
  const booking = templates.filter((template) => !template.custom && groupOf(template) === 'booking')
  const growth = templates.filter((template) => !template.custom && groupOf(template) === 'growth')
  const visible = (list: MessageTemplate[]) => list.filter((template) => (filter === 'all' ? true : filter === 'on' ? template.enabled : !template.enabled))
  const growthTotals = [...growth, ...own].reduce(
    (sum, template) => {
      const stats = automationStats(template.key, template.enabled && !marketing.settings.paused, subscribed, data.avgOrder, true)
      return { sent: sum.sent + stats.sent, bookings: sum.bookings + stats.bookings, revenue: sum.revenue + stats.revenue }
    },
    { sent: 0, bookings: 0, revenue: 0 },
  )

  const syncOffer = (template: MessageTemplate) => {
    if (offerOf(template).enabled) pricing.setPromos(upsertOfferPromo(pricing.promos, offerOf(template), `From the ${template.name} automation`, template.activitySlugs))
  }
  const toggle = (template: MessageTemplate, enabled: boolean) => {
    update(template.key, { enabled })
    if (enabled) syncOffer(template)
    toast(enabled ? `${template.name} is on` : `${template.name} is off`)
  }
  const startRecipe = (recipe: Recipe) => {
    setPicking(false)
    setEditing({ template: { ...recipe.build(data.activities), key: `custom_${Date.now().toString(36)}` }, isNew: true })
  }

  const row = (template: MessageTemplate) => {
    const growthRow = template.custom || groupOf(template) === 'growth'
    const stats = automationStats(template.key, template.enabled && !(growthRow && marketing.settings.paused), subscribed, data.avgOrder, growthRow)
    const audience = marketing.audiences.find((entry) => entry.id === template.audienceId)
    const rules = rulesOf(template)
    const steps = template.steps?.length ?? 0
    return (
      <li key={template.key} className={cn('flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start', !template.enabled && 'opacity-60')}>
        <span aria-hidden="true" className="hidden size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-subtle sm:grid">
          {template.channel === 'sms' ? <MessageSquareText className="size-[1.125rem]" /> : <Mail className="size-[1.125rem]" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{template.name}</p>
            <Badge variant="neutral" size="sm">{CHANNEL_LABEL[template.channel]}</Badge>
            {steps > 0 ? <Badge variant="info" size="sm">{steps + 1} messages</Badge> : null}
            {template.design ? <Badge variant="primary" size="sm">Designed</Badge> : null}
            {offerOf(template).enabled ? <Badge variant="success" size="sm">{offerOf(template).percent}% code</Badge> : null}
            {template.abTest?.enabled ? <Badge variant="neutral" size="sm">A/B subject</Badge> : null}
          </div>
          <p className="mt-0.5 text-xs text-subtle">
            {timingLabel(template.timing)}
            {rules.days.length > 0 ? ` · ${rules.days.map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ')}` : ''}
            {rules.sendAt ? ` at ${rules.sendAt}` : ''}
            {growthRow && audience ? ` · ${audience.name}` : ''}
            {template.activitySlugs && template.activitySlugs.length > 0 ? ` · ${template.activitySlugs.length} ${template.activitySlugs.length === 1 ? 'activity' : 'activities'}` : ''}
          </p>
          <p className="mt-1.5 line-clamp-2 text-sm text-muted">{renderTemplate(template.body, { ...ctx.vars, offer_code: offerOf(template).code, offer_percent: `${offerOf(template).percent}%` })}</p>
          {template.enabled && stats.sent > 0 ? (
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-subtle">
              <div className="flex gap-1"><dt>Sent</dt><dd className="font-medium text-foreground tabular">{stats.sent.toLocaleString('en-US')}</dd></div>
              {template.channel !== 'sms' ? <div className="flex gap-1"><dt>Opened</dt><dd className="font-medium text-foreground tabular">{percent(stats.openRate)}</dd></div> : null}
              <div className="flex gap-1"><dt>Clicked</dt><dd className="font-medium text-foreground tabular">{percent(stats.clickRate, 1)}</dd></div>
              {growthRow ? <div className="flex gap-1"><dt>Booked</dt><dd className="font-medium text-foreground tabular">{stats.bookings} · {formatCurrency(stats.revenue * 100, currency)}</dd></div> : null}
              <span className="text-faint">last 30 days</span>
            </dl>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Switch checked={template.enabled} onCheckedChange={(checked) => toggle(template, checked)} aria-label={`${template.name} on`} />
          <Button variant="ghost" size="sm" leftIcon={<Pencil />} onClick={() => setEditing({ template: { ...template }, isNew: false })}>Edit</Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Copy ${template.name}`}
            onClick={() => setEditing({ template: { ...template, key: `custom_${Date.now().toString(36)}`, name: `${template.name} (copy)`, custom: true, group: 'growth', enabled: false }, isNew: true })}
          >
            <Copy className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </li>
    )
  }

  const section = (title: string, description: React.ReactNode, list: MessageTemplate[]) => (
    <Card>
      <CardHeader className="flex flex-col items-start gap-1">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {visible(list).length > 0 ? (
          <ul className="flex list-none flex-col divide-y divide-line-subtle border-t border-line-subtle p-0">{visible(list).map(row)}</ul>
        ) : (
          <p className="border-t border-line-subtle px-5 py-4 text-sm text-subtle">Nothing here with this filter.</p>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="flex flex-col gap-6">
      {marketing.settings.paused ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning-soft/40 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-foreground">
            <Pause className="size-4 text-warning" aria-hidden="true" />
            Marketing is paused. Booking messages still go; marketing automations wait.
          </p>
          <Button size="sm" variant="secondary" onClick={() => { marketing.setSettings({ ...marketing.settings, paused: false }); toast.success('Marketing is back on') }}>Resume marketing</Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Show" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {(['all', 'on', 'off'] as const).map((value) => (
            <button key={value} type="button" role="radio" aria-checked={filter === value} onClick={() => setFilter(value)} className={cn('h-8 rounded-md px-3 text-sm font-medium', filter === value ? 'bg-surface-sunken text-foreground' : 'text-muted hover:text-foreground')}>
              {value === 'all' ? 'All' : value === 'on' ? `On · ${templates.filter((t) => t.enabled).length}` : `Off · ${templates.filter((t) => !t.enabled).length}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {hasEdits ? (
            <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={() => { reset(); toast('Built-in automations restored', { description: 'Your own automations are kept.' }) }}>
              Restore defaults
            </Button>
          ) : null}
          <Button leftIcon={<Plus />} onClick={() => setPicking(true)}>New automation</Button>
        </div>
      </div>

      {picking ? (
        <Card>
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">Start from</p>
              <Button variant="ghost" size="sm" leftIcon={<X />} onClick={() => setPicking(false)}>Close</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {RECIPES.map((recipe) => (
                <button key={recipe.id} type="button" onClick={() => startRecipe(recipe)} className="rounded-xl border border-line px-3.5 py-3 text-left transition-colors hover:border-primary/50">
                  <span className="block text-sm font-medium">{recipe.name}</span>
                  <span className="block text-xs text-subtle">{recipe.hint}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {own.length > 0 ? section('Your automations', 'Made by you. Rename, change or delete them any time.', own) : null}
      {section(
        'Bring guests back',
        <>
          Marketing that runs on its own, only to guests who said yes.{' '}
          {growthTotals.bookings > 0 ? `Last 30 days: ${growthTotals.sent.toLocaleString('en-US')} sent, ${growthTotals.bookings} bookings, ${formatCurrency(growthTotals.revenue * 100, currency)}.` : null}
        </>,
        growth,
      )}
      {section('Around every booking', 'Confirmations, reminders and follow-ups. These go to every guest, subscribed or not, because they are about their trip.', booking)}

      <p className="text-xs text-subtle">
        Quiet hours, the weekly limit and the unsubscribe footer are in{' '}
        <Link href="/dashboard/marketing/settings" className="font-medium text-primary hover:underline">Marketing settings</Link>. Designs you save are in{' '}
        <Link href="/dashboard/marketing/templates" className="font-medium text-primary hover:underline">Email templates</Link>. {EMAIL_TEMPLATES.length} ready-made designs to start from.
      </p>

      {editing ? (
        <AutomationEditor
          template={editing.template}
          ctx={ctx}
          brand={brand}
          savedTemplates={marketing.emailTemplates}
          onSaveTemplate={(name, design) => {
            marketing.saveEmailTemplate({ id: `tpl_${Date.now().toString(36)}`, name, design, updatedAt: new Date().toISOString() })
            toast.success(`${name} saved to Email templates`)
          }}
          audiences={marketing.audiences.map((audience) => ({ id: audience.id, name: audience.name, count: audienceSize(data.contacts, audience.filter, nowIso).count }))}
          activities={data.activities}
          tags={data.tags}
          countries={data.countries}
          onClose={() => setEditing(null)}
          onDelete={
            editing.template.custom && !editing.isNew
              ? () => {
                  remove(editing.template.key)
                  toast(`${editing.template.name} deleted`)
                  setEditing(null)
                }
              : undefined
          }
          onSave={(draft) => {
            const clean = { ...draft, offer: draft.offer ? { ...draft.offer, code: cleanCode(draft.offer.code) } : undefined }
            if (draft.custom) create(clean)
            else update(draft.key, clean)
            if (draft.enabled) syncOffer(clean)
            toast.success(`${draft.name} saved`, { description: clean.offer?.enabled ? `Code ${clean.offer.code} works at checkout.` : undefined })
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}
