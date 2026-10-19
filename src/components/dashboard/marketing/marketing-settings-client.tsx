'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Info, Pause, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useChannels } from '@/hooks/use-channels'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { usePricing } from '@/hooks/use-pricing'
import { NumberInput } from '@/components/dashboard/marketing/number-input'
import { fromAddress, storefrontHost } from '@/lib/channels'
import { campaignPromoNote, defaultSettings, marketingSender, retireOfferPromo, upsertOfferPromo, type MarketingSettings } from '@/lib/marketing'
import { cn, formatDateTime } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   MARKETING SETTINGS
   The rules every marketing email and text follows: one switch to pause it
   all, quiet hours, how often a guest can hear from you, and the footer and
   consent wording the law asks for. Who it comes from is set once, in
   Domains & numbers, and shown here.
   ========================================================================== */

function Row({ title, text, checked, onChange, children }: { title: string; text: string; checked: boolean; onChange: (value: boolean) => void; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <label className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-sm font-medium">{title}</span>
          <span className="block text-xs text-subtle">{text}</span>
        </span>
        <Switch checked={checked} onCheckedChange={onChange} aria-label={title} />
      </label>
      {checked && children ? <div className="flex flex-wrap items-end gap-3">{children}</div> : null}
    </div>
  )
}

function SenderLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="w-32 shrink-0 text-xs text-subtle">{label}</dt>
      <dd className="min-w-0 truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  )
}

export function MarketingSettingsClient({ tenant: tenantRecord, nowIso }: { tenant: Tenant; nowIso: string }) {
  const tenant = useMarketingTenant(tenantRecord)
  const marketing = useMarketing(tenant, nowIso)
  const channels = useChannels(tenantRecord)
  const pricing = usePricing(tenant.slug)
  const [confirmReset, setConfirmReset] = React.useState(false)
  const [confirmResume, setConfirmResume] = React.useState(false)
  const s = marketing.settings
  const set = (patch: Partial<MarketingSettings>) => marketing.setSettings({ ...s, ...patch })

  const defaults = { name: tenant.name, email: tenant.email }
  const sender = marketingSender(s, channels.settings.email, defaults)
  const legacy = sender.legacy.name || sender.legacy.replyTo
  const address = fromAddress(channels.settings, tenant.slug)
  const host = storefrontHost(channels.settings, tenant.slug)

  // A sender typed on this page before it moved: carry it over, or let Domains & numbers win.
  const keepLegacy = () => {
    channels.save((current) => ({
      ...current,
      email: {
        ...current.email,
        senderName: sender.legacy.name ? s.senderName : current.email.senderName,
        replyTo: sender.legacy.replyTo ? s.replyTo : current.email.replyTo,
      },
    }))
    toast.success('Sender saved in Domains & numbers', { description: 'Booking messages and marketing now come from the same name.' })
  }
  const dropLegacy = () => {
    set({ senderName: defaults.name, replyTo: defaults.email })
    toast('Marketing now uses the sender from Domains & numbers')
  }

  // Resuming with campaigns that waited: ask whether they go now or back to drafts, rather than send them unseen.
  const resume = (mode?: 'send' | 'draft') => {
    const held = marketing.held
    set({ paused: false })
    if (mode && held.length > 0) {
      marketing.releaseHeld(mode)
      let promos = pricing.promos
      for (const campaign of held) {
        if (!campaign.offer.enabled) continue
        // Sent now: the code's days start today, not on the day it was first meant to go.
        promos = mode === 'draft' ? retireOfferPromo(promos, campaign.offer.code, campaignPromoNote(campaign)) : upsertOfferPromo(promos, campaign.offer, campaignPromoNote(campaign), [], nowIso)
      }
      if (promos !== pricing.promos) pricing.setPromos(promos)
    }
    setConfirmResume(false)
    const many = held.length > 1
    toast(
      'Marketing resumed',
      mode && held.length > 0
        ? {
            description:
              mode === 'send'
                ? `${many ? `${held.length} held campaigns go` : 'The held campaign goes'} out now.`
                : `${many ? `${held.length} held campaigns are` : 'The held campaign is'} back in drafts.`,
          }
        : undefined,
    )
  }

  const example = `https://${host}/?utm_source=${encodeURIComponent(s.utm.source || 'ezra')}&utm_medium=${encodeURIComponent(s.utm.medium || 'email')}&utm_campaign=spring-newsletter`
  const base = defaultSettings(tenant.name, tenant.email)

  return (
    <div className="flex flex-col gap-6">
      <div className={cn('flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4', s.paused ? 'border-warning/40 bg-warning-soft/40' : 'border-line bg-surface')}>
        <div className="flex items-start gap-3">
          <Pause className={cn('mt-0.5 size-5', s.paused ? 'text-warning' : 'text-subtle')} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">{s.paused ? 'All marketing is paused' : 'Pause all marketing'}</p>
            <p className="text-xs text-muted">
              Stops every campaign and marketing automation at once, for a storm week or a full season. Scheduled campaigns wait. Booking confirmations and reminders still go.
              {marketing.held.length > 0 ? ` ${marketing.held.length === 1 ? 'One campaign is' : `${marketing.held.length} campaigns are`} waiting to go.` : ''}
            </p>
          </div>
        </div>
        <Switch
          checked={s.paused}
          onCheckedChange={(paused) => {
            if (!paused) return marketing.held.length > 0 ? setConfirmResume(true) : resume()
            set({ paused: true })
            toast('Marketing paused', { description: 'Campaigns due while it is paused wait. You choose what happens to them when you resume.' })
          }}
          aria-label="Pause all marketing"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Who it comes from</CardTitle>
            <CardDescription>The same sender as your booking messages, so guests always know it is you.</CardDescription>
          </div>
          <Button asChild variant="secondary" size="sm" rightIcon={<ArrowRight />}>
            <Link href="/dashboard/settings/channels#email">Change in Domains &amp; numbers</Link>
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="flex flex-col gap-2.5 rounded-xl bg-surface-sunken/60 px-4 py-3.5">
            <SenderLine label="Guests see" value={`${sender.name} <${address}>`} />
            <SenderLine label="Replies go to" value={sender.replyTo} />
          </dl>
          {legacy ? (
            <div className="flex flex-col gap-3 rounded-xl border border-line px-4 py-3.5">
              <p className="flex items-start gap-2 text-sm text-muted">
                <Info className="mt-0.5 size-4 shrink-0 text-subtle" aria-hidden="true" />
                <span>
                  You set marketing to come from{' '}
                  {[sender.legacy.name ? `“${s.senderName}”` : null, sender.legacy.replyTo ? `replies to ${s.replyTo}` : null].filter(Boolean).join(', ')} on this page before, and it still does.
                  Booking messages use {channels.settings.email.senderName}. Pick one for both.
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={keepLegacy}>
                  Use {sender.legacy.name ? `“${s.senderName}”` : s.replyTo} for everything
                </Button>
                <Button size="sm" variant="ghost" onClick={dropLegacy}>
                  Use {channels.settings.email.senderName}
                </Button>
              </div>
            </div>
          ) : null}
          {channels.settings.email.status !== 'verified' ? (
            <p className="text-xs text-subtle">Sent from our shared address until your own email domain is connected. Replies still reach you.</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle>When and how often</CardTitle>
          <CardDescription>Keeps marketing welcome. Campaigns and marketing automations follow these; booking messages never wait for them.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-line-subtle">
          <Row
            title="Quiet hours"
            text="Nothing goes overnight. A message due in quiet hours waits until they end, in your business’s time."
            checked={s.quietHours.enabled}
            onChange={(enabled) => set({ quietHours: { ...s.quietHours, enabled } })}
          >
            <Field label="From">
              {(control) => <Input {...control} type="time" className="w-36" value={s.quietHours.from} onChange={(e) => set({ quietHours: { ...s.quietHours, from: e.target.value } })} />}
            </Field>
            <Field label="Until">
              {(control) => <Input {...control} type="time" className="w-36" value={s.quietHours.to} onChange={(e) => set({ quietHours: { ...s.quietHours, to: e.target.value } })} />}
            </Field>
            {s.quietHours.from === s.quietHours.to ? <p className="w-full text-xs text-warning">From and Until are the same time, so there are no quiet hours. Pick an end time.</p> : null}
          </Row>
          <Row
            title="Weekly limit"
            text="The most marketing messages one guest gets in a week. Anyone over it is left out of the next campaign; automations hold theirs."
            checked={s.frequencyCap.enabled}
            onChange={(enabled) => set({ frequencyCap: { ...s.frequencyCap, enabled } })}
          >
            <Field label="At most">
              {(control) => (
                <NumberInput
                  {...control}
                  min={1}
                  max={14}
                  className="w-40"
                  suffix="a week"
                  value={s.frequencyCap.perWeek}
                  onValueChange={(perWeek) => set({ frequencyCap: { ...s.frequencyCap, perWeek } })}
                />
              )}
            </Field>
          </Row>
          <Row
            title="Skip guests with a trip coming up"
            text="No offers to someone already booked for the next few days. They get their reminders instead."
            checked={s.skipUpcoming.enabled}
            onChange={(enabled) => set({ skipUpcoming: { ...s.skipUpcoming, enabled } })}
          >
            <Field label="Within">
              {(control) => (
                <NumberInput
                  {...control}
                  min={1}
                  max={30}
                  className="w-36"
                  suffix="days"
                  value={s.skipUpcoming.days}
                  onValueChange={(days) => set({ skipUpcoming: { ...s.skipUpcoming, days } })}
                />
              )}
            </Field>
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle>Consent and the small print</CardTitle>
          <CardDescription>Every marketing email carries an unsubscribe link and your address. Every marketing text says how to stop.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Email footer" description="Shown above the unsubscribe link in campaign letters. Say why they are getting it.">
            {(control) => <Textarea {...control} rows={2} value={s.footer} onChange={(e) => set({ footer: e.target.value })} />}
          </Field>
          <Field label="Text consent line" description="Shown under the mobile number box on the sign-up pop-up.">
            {(control) => <Input {...control} value={s.smsConsent} onChange={(e) => set({ smsConsent: e.target.value })} />}
          </Field>
          <div className="flex flex-col divide-y divide-line-subtle">
            <Row
              title="Ask new subscribers to confirm"
              text="New sign-ups get an email with a link to confirm before they join the list. Fewer but surer subscribers; expected in Germany and Austria."
              checked={s.doubleOptIn}
              onChange={(doubleOptIn) => set({ doubleOptIn })}
            />
            <Row
              title="Tag links so you can see what brought each booking"
              text="Adds a short label to the end of every link in marketing, so Google Analytics and similar tools can tell which message a visitor came from."
              checked={s.utm.enabled}
              onChange={(enabled) => set({ utm: { ...s.utm, enabled } })}
            >
              <Field label="Where they came from" description="Usually your platform or brand.">
                {(control) => <Input {...control} className="w-48" value={s.utm.source} placeholder={base.utm.source} onChange={(e) => set({ utm: { ...s.utm, source: e.target.value.replace(/\s+/g, '-').toLowerCase() } })} />}
              </Field>
              <Field label="How they came" description="Email or text is filled in for you.">
                {(control) => <Input {...control} className="w-48" value={s.utm.medium} placeholder={base.utm.medium} onChange={(e) => set({ utm: { ...s.utm, medium: e.target.value.replace(/\s+/g, '-').toLowerCase() } })} />}
              </Field>
              <p className="w-full truncate rounded-lg bg-surface-sunken/60 px-3 py-2 font-mono text-xs text-muted" title={example}>
                {example}
              </p>
            </Row>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-subtle">Changes save as you go.</p>
        {marketing.settingsEdited ? (
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={() => setConfirmReset(true)}>
            Restore default settings
          </Button>
        ) : null}
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Restore the default settings?</DialogTitle>
            <DialogDescription>Quiet hours, the weekly limit, the footer, the consent line and link tags go back to how they started.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="pb-2 text-sm text-muted">
              Your campaigns, audiences, sign-up forms and saved email templates stay as they are.
              {legacy ? ` The sender typed here before is dropped; marketing comes from ${channels.settings.email.senderName}, as set in Domains & numbers.` : ''}
              {s.paused ? ' Marketing stays paused until you switch it back on.' : ''}
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Keep my settings
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                // Keep the pause as it is: restoring the rules must not start sending anything.
                if (s.paused) marketing.setSettings({ ...base, paused: true })
                else marketing.resetSettings()
                setConfirmReset(false)
                toast('Settings restored to the defaults')
              }}
            >
              Restore defaults
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmResume} onOpenChange={setConfirmResume}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {marketing.held.length === 1 ? 'A campaign waited while marketing was paused' : `${marketing.held.length} campaigns waited while marketing was paused`}
            </DialogTitle>
            <DialogDescription>Send now, or move back to drafts to look at again. Either way marketing is switched back on.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <ul className="flex list-none flex-col gap-1.5 p-0 pb-2 text-sm">
              {marketing.held.map((campaign) => (
                <li key={campaign.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium text-foreground">{campaign.name}</span>
                  <span className="shrink-0 text-xs text-subtle">{campaign.sendAt ? `Was due ${formatDateTime(campaign.sendAt)}` : ''}</span>
                </li>
              ))}
            </ul>
          </DialogBody>
          <DialogFooter className="flex-wrap">
            <Button variant="ghost" onClick={() => setConfirmResume(false)}>
              Stay paused
            </Button>
            <Button variant="secondary" onClick={() => resume('draft')}>
              Move to drafts
            </Button>
            <Button onClick={() => resume('send')}>Send now</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
