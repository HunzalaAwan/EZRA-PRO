'use client'

import * as React from 'react'
import Link from 'next/link'
import { Pause, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import type { MarketingSettings } from '@/lib/marketing'
import { cn } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   MARKETING SETTINGS
   The rules every marketing email and text follows: one switch to pause it
   all, who it comes from, quiet hours, how often a guest can hear from you,
   and the footer and consent wording the law asks for.
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

export function MarketingSettingsClient({ tenant: tenantRecord, nowIso }: { tenant: Tenant; nowIso: string }) {
  const tenant = useMarketingTenant(tenantRecord)
  const marketing = useMarketing(tenant, nowIso)
  const s = marketing.settings
  const set = (patch: Partial<MarketingSettings>) => marketing.setSettings({ ...s, ...patch })

  return (
    <div className="flex flex-col gap-6">
      <div className={cn('flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-5 py-4', s.paused ? 'border-warning/40 bg-warning-soft/40' : 'border-line bg-surface')}>
        <div className="flex items-start gap-3">
          <Pause className={cn('mt-0.5 size-5', s.paused ? 'text-warning' : 'text-subtle')} aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">{s.paused ? 'All marketing is paused' : 'Pause all marketing'}</p>
            <p className="text-xs text-muted">Stops every campaign and growth automation at once, for a storm week or a full season. Booking confirmations and reminders still go.</p>
          </div>
        </div>
        <Switch checked={s.paused} onCheckedChange={(paused) => { set({ paused }); toast(paused ? 'Marketing paused' : 'Marketing resumed') }} aria-label="Pause all marketing" />
      </div>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle>From</CardTitle>
          <CardDescription>
            The name guests see, and where their replies go. The sending address itself is set in{' '}
            <Link href="/dashboard/settings/channels" className="font-medium text-primary hover:underline">Domains &amp; numbers</Link>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Sender name">
            {(control) => <Input {...control} value={s.senderName} onChange={(e) => set({ senderName: e.target.value })} />}
          </Field>
          <Field label="Replies go to">
            {(control) => <Input {...control} type="email" value={s.replyTo} onChange={(e) => set({ replyTo: e.target.value })} />}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle>When and how often</CardTitle>
          <CardDescription>Keeps marketing welcome. Booking messages are never held back by these.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col divide-y divide-line-subtle">
          <Row title="Quiet hours" text="Nothing goes overnight in the guest’s own time zone; it waits until morning." checked={s.quietHours.enabled} onChange={(enabled) => set({ quietHours: { ...s.quietHours, enabled } })}>
            <Field label="From">
              {(control) => <Input {...control} type="time" className="w-36" value={s.quietHours.from} onChange={(e) => set({ quietHours: { ...s.quietHours, from: e.target.value } })} />}
            </Field>
            <Field label="Until">
              {(control) => <Input {...control} type="time" className="w-36" value={s.quietHours.to} onChange={(e) => set({ quietHours: { ...s.quietHours, to: e.target.value } })} />}
            </Field>
          </Row>
          <Row title="Weekly limit" text="The most marketing messages one guest gets in a week. Extras wait for next week." checked={s.frequencyCap.enabled} onChange={(enabled) => set({ frequencyCap: { ...s.frequencyCap, enabled } })}>
            <Field label="At most">
              {(control) => <Input {...control} type="number" min={1} max={14} className="w-40" suffix="a week" value={s.frequencyCap.perWeek} onChange={(e) => set({ frequencyCap: { ...s.frequencyCap, perWeek: Math.max(1, Number(e.target.value) || 1) } })} />}
            </Field>
          </Row>
          <Row title="Skip guests with a trip coming up" text="No offers to someone already booked for the next few days. They get their reminders instead." checked={s.skipUpcoming.enabled} onChange={(enabled) => set({ skipUpcoming: { ...s.skipUpcoming, enabled } })}>
            <Field label="Within">
              {(control) => <Input {...control} type="number" min={1} max={30} className="w-36" suffix="days" value={s.skipUpcoming.days} onChange={(e) => set({ skipUpcoming: { ...s.skipUpcoming, days: Math.max(1, Number(e.target.value) || 1) } })} />}
            </Field>
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col items-start gap-1">
          <CardTitle>Consent and the small print</CardTitle>
          <CardDescription>Every email carries an unsubscribe link and your address. Every text says how to stop.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Email footer" description="Above the unsubscribe link.">
            {(control) => <Textarea {...control} rows={2} value={s.footer} onChange={(e) => set({ footer: e.target.value })} />}
          </Field>
          <Field label="Text consent line" description="Added to sign-up forms and the first marketing text.">
            {(control) => <Input {...control} value={s.smsConsent} onChange={(e) => set({ smsConsent: e.target.value })} />}
          </Field>
          <div className="flex flex-col divide-y divide-line-subtle">
            <Row title="Double opt-in" text="New sign-ups confirm by email before they join the list. Fewer, better subscribers; required in Germany." checked={s.doubleOptIn} onChange={(doubleOptIn) => set({ doubleOptIn })} />
            <Row title="Track links" text="Adds utm tags to links so Analytics and Google show which message brought the booking." checked={s.utm.enabled} onChange={(enabled) => set({ utm: { ...s.utm, enabled } })}>
              <Field label="utm_source">
                {(control) => <Input {...control} className="w-40" value={s.utm.source} onChange={(e) => set({ utm: { ...s.utm, source: e.target.value } })} />}
              </Field>
              <Field label="utm_medium">
                {(control) => <Input {...control} className="w-40" value={s.utm.medium} onChange={(e) => set({ utm: { ...s.utm, medium: e.target.value } })} />}
              </Field>
            </Row>
          </div>
        </CardContent>
      </Card>

      {marketing.hasEdits ? (
        <div>
          <Button variant="ghost" size="sm" leftIcon={<RotateCcw />} onClick={() => { marketing.reset(); toast('Marketing restored to the defaults') }}>
            Restore every marketing default
          </Button>
        </div>
      ) : null}
    </div>
  )
}
