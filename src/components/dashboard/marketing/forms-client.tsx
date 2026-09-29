'use client'

import * as React from 'react'
import Link from 'next/link'
import { ExternalLink, Tag, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import { usePricing } from '@/hooks/use-pricing'
import { cleanCode, upsertOfferPromo, type SignupForms } from '@/lib/marketing'
import type { Tenant } from '@/types'

/* ==========================================================================
   SIGN-UP FORMS
   Where the list grows: a pop-up on the storefront with a first-trip code,
   a sign-up in the footer, and the opt-in boxes at checkout. Each one on or
   off, in your own words. Changes show on the storefront straight away.
   ========================================================================== */

export function FormsClient({ tenant: tenantRecord, nowIso }: { tenant: Tenant; nowIso: string }) {
  const tenant = useMarketingTenant(tenantRecord)
  const marketing = useMarketing(tenant, nowIso)
  const pricing = usePricing(tenant.slug)
  const forms = marketing.forms
  const popup = forms.popup
  const bySource = (source: 'popup' | 'footer' | 'checkout') => marketing.signups.filter((signup) => signup.source === source).length

  const save = (next: SignupForms, message?: string) => {
    marketing.setForms(next)
    if (next.popup.enabled && next.popup.offer.enabled) pricing.setPromos(upsertOfferPromo(pricing.promos, next.popup.offer, 'From the sign-up pop-up'))
    if (message) toast(message)
  }
  const setPopup = (patch: Partial<SignupForms['popup']>) => save({ ...forms, popup: { ...popup, ...patch } })
  const setFooter = (patch: Partial<SignupForms['footer']>) => save({ ...forms, footer: { ...forms.footer, ...patch } })
  const setCheckout = (patch: Partial<SignupForms['checkout']>) => save({ ...forms, checkout: { ...forms.checkout, ...patch } })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {marketing.signups.length > 0 ? `${marketing.signups.length} people have joined from your forms.` : 'Changes save as you go and show on your storefront straight away.'}
        </p>
        <Button asChild variant="secondary" size="sm" rightIcon={<ExternalLink />}>
          <Link href={`/book/${tenant.slug}`} target="_blank">Open storefront</Link>
        </Button>
      </div>

      {/* ---------- pop-up ---------- */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Storefront pop-up</CardTitle>
            <CardDescription>Shows once to new visitors, offers a code for the first trip and adds them to the list. {bySource('popup') > 0 ? `${bySource('popup')} sign-ups so far.` : ''}</CardDescription>
          </div>
          <Switch checked={popup.enabled} onCheckedChange={(enabled) => setPopup({ enabled })} aria-label="Storefront pop-up" />
        </CardHeader>
        {popup.enabled ? (
          <CardContent className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="flex flex-col gap-4">
              <Field label="Headline">
                {(control) => <Input {...control} value={popup.headline} onChange={(e) => setPopup({ headline: e.target.value })} />}
              </Field>
              <Field label="Text">
                {(control) => <Textarea {...control} rows={3} value={popup.text} onChange={(e) => setPopup({ text: e.target.value })} />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Button">
                  {(control) => <Input {...control} value={popup.button} onChange={(e) => setPopup({ button: e.target.value })} />}
                </Field>
                <Field label="Opens">
                  <Select value={popup.trigger} onValueChange={(value) => setPopup({ trigger: value as SignupForms['popup']['trigger'] })}>
                    <SelectTrigger aria-label="Opens"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delay">After a few seconds</SelectItem>
                      <SelectItem value="scroll">When they scroll down</SelectItem>
                      <SelectItem value="exit">When they go to leave</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {popup.trigger === 'delay' ? (
                  <Field label="Wait">
                    {(control) => <Input {...control} type="number" min={0} max={120} suffix="seconds" value={popup.delaySeconds} onChange={(e) => setPopup({ delaySeconds: Math.max(0, Number(e.target.value) || 0) })} />}
                  </Field>
                ) : popup.trigger === 'scroll' ? (
                  <Field label="Scrolled">
                    {(control) => <Input {...control} type="number" min={10} max={100} suffix="%" value={popup.scrollPercent} onChange={(e) => setPopup({ scrollPercent: Math.min(100, Math.max(10, Number(e.target.value) || 50)) })} />}
                  </Field>
                ) : (
                  <p className="self-end pb-2 text-xs text-subtle">On a computer, when the mouse heads for the tab bar. On a phone, after 20 seconds.</p>
                )}
                <Field label="Show again after" description="For people who closed it.">
                  {(control) => <Input {...control} type="number" min={1} suffix="days" value={popup.againAfterDays} onChange={(e) => setPopup({ againAfterDays: Math.max(1, Number(e.target.value) || 1) })} />}
                </Field>
              </div>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  Ask for a mobile number too
                  <span className="block text-xs text-subtle">Optional for them. Adds them to texts, with the consent line from Settings.</span>
                </span>
                <Switch checked={popup.collectPhone} onCheckedChange={(collectPhone) => setPopup({ collectPhone })} aria-label="Ask for a mobile number" />
              </label>
              <div className="rounded-xl border border-line p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Tag className="size-4 text-subtle" aria-hidden="true" />
                    First-trip code
                  </p>
                  <Switch checked={popup.offer.enabled} onCheckedChange={(enabled) => setPopup({ offer: { ...popup.offer, enabled } })} aria-label="First-trip code" />
                </div>
                {popup.offer.enabled ? (
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <Field label="Code">
                      {(control) => <Input {...control} className="font-mono" value={popup.offer.code} onChange={(e) => setPopup({ offer: { ...popup.offer, code: cleanCode(e.target.value) } })} />}
                    </Field>
                    <Field label="Discount">
                      {(control) => <Input {...control} type="number" min={1} max={100} suffix="%" value={popup.offer.percent} onChange={(e) => setPopup({ offer: { ...popup.offer, percent: Math.min(100, Math.max(1, Number(e.target.value) || 1)) } })} />}
                    </Field>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-subtle">No code: the pop-up only asks them to join the list.</p>
                )}
              </div>
            </div>

            {/* live preview */}
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Preview</p>
              <div className="relative rounded-2xl bg-surface-sunken p-4">
                <div className="relative rounded-2xl border border-line bg-surface p-5 shadow-md">
                  <X className="absolute top-3 right-3 size-4 text-subtle" aria-hidden="true" />
                  {popup.offer.enabled ? <p className="text-xs font-semibold tracking-wide text-primary uppercase">{popup.offer.percent}% off</p> : null}
                  <p className="mt-1 pr-4 font-display text-lg font-semibold leading-snug text-foreground">{popup.headline || 'Your headline'}</p>
                  <p className="mt-1.5 text-sm text-muted">{popup.text}</p>
                  <div className="mt-4 h-10 rounded-lg border border-line bg-surface px-3 text-sm leading-10 text-faint">Email address</div>
                  {popup.collectPhone ? <div className="mt-2 h-10 rounded-lg border border-line bg-surface px-3 text-sm leading-10 text-faint">Mobile (optional)</div> : null}
                  <div className="mt-2 h-10 rounded-lg bg-primary text-center text-sm leading-10 font-semibold text-primary-foreground">{popup.button || 'Join'}</div>
                  <p className="mt-2 text-center text-xs text-faint">No thanks</p>
                </div>
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>

      {/* ---------- footer ---------- */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Footer sign-up</CardTitle>
            <CardDescription>A small email box at the bottom of every storefront page. {bySource('footer') > 0 ? `${bySource('footer')} sign-ups so far.` : ''}</CardDescription>
          </div>
          <Switch checked={forms.footer.enabled} onCheckedChange={(enabled) => setFooter({ enabled })} aria-label="Footer sign-up" />
        </CardHeader>
        {forms.footer.enabled ? (
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Headline">
              {(control) => <Input {...control} value={forms.footer.headline} onChange={(e) => setFooter({ headline: e.target.value })} />}
            </Field>
            <Field label="Small print">
              {(control) => <Input {...control} value={forms.footer.text} onChange={(e) => setFooter({ text: e.target.value })} />}
            </Field>
          </CardContent>
        ) : null}
      </Card>

      {/* ---------- checkout ---------- */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Checkout opt-in</CardTitle>
            <CardDescription>A tick box under the guest&rsquo;s details. Most of your list comes from here. {bySource('checkout') > 0 ? `${bySource('checkout')} sign-ups so far.` : ''}</CardDescription>
          </div>
          <Switch checked={forms.checkout.enabled} onCheckedChange={(enabled) => setCheckout({ enabled })} aria-label="Checkout opt-in" />
        </CardHeader>
        {forms.checkout.enabled ? (
          <CardContent className="flex flex-col gap-4">
            <Field label="Email opt-in wording">
              {(control) => <Input {...control} value={forms.checkout.label} onChange={(e) => setCheckout({ label: e.target.value })} />}
            </Field>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Ticked for them
                <span className="block text-xs text-subtle">Some countries (the EU, UK and Canada) require it unticked. Leave off to be safe.</span>
              </span>
              <Switch checked={forms.checkout.preChecked} onCheckedChange={(preChecked) => setCheckout({ preChecked })} aria-label="Ticked for them" />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                A separate box for texts
                <span className="block text-xs text-subtle">Marketing texts need their own consent in the US.</span>
              </span>
              <Switch checked={forms.checkout.sms} onCheckedChange={(sms) => setCheckout({ sms })} aria-label="A separate box for texts" />
            </label>
            {forms.checkout.sms ? (
              <Field label="Text opt-in wording">
                {(control) => <Input {...control} value={forms.checkout.smsLabel} onChange={(e) => setCheckout({ smsLabel: e.target.value })} />}
              </Field>
            ) : null}
          </CardContent>
        ) : null}
      </Card>
    </div>
  )
}
