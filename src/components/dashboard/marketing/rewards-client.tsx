'use client'

import * as React from 'react'
import { Gift, Sparkles } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/toaster'
import { useMarketing, useMarketingTenant } from '@/hooks/use-marketing'
import type { MarketingData } from '@/lib/data/guest-marketing'
import { steady, type Rewards } from '@/lib/marketing'
import { currencySymbol, formatCurrency } from '@/lib/utils'
import type { Tenant } from '@/types'

/* ==========================================================================
   REFERRALS & REWARDS
   Guests who loved it bring friends: the friend gets money off the first
   trip and the guest gets credit. Loyalty points turn regulars into
   repeat bookings. Both optional, both in your own numbers.
   ========================================================================== */

export function RewardsClient({ tenant: tenantRecord, nowIso, data }: { tenant: Tenant; nowIso: string; data: MarketingData }) {
  const tenant = useMarketingTenant(tenantRecord)
  const currency = tenantRecord.currency
  const symbol = currencySymbol(currency)
  const marketing = useMarketing(tenant, nowIso)
  const { referral, loyalty } = marketing.rewards
  const setReferral = (patch: Partial<Rewards['referral']>) => marketing.setRewards({ ...marketing.rewards, referral: { ...referral, ...patch } })
  const setLoyalty = (patch: Partial<Rewards['loyalty']>) => marketing.setRewards({ ...marketing.rewards, loyalty: { ...loyalty, ...patch } })

  // Steady demo figures: how the programme has done so far.
  const guests = data.contacts.length
  const referred = referral.enabled ? Math.round(guests * (0.004 + steady(`ref-${tenant.slug}`) * 0.004)) : 0
  const referredRevenue = referred * data.avgOrder
  const members = loyalty.enabled ? data.contacts.filter((contact) => contact.totalBookings > 0).length : 0
  const pointsOut = loyalty.enabled ? data.contacts.reduce((sum, contact) => sum + contact.spend * loyalty.pointsPerUnit, 0) : 0
  const exampleBooking = Math.max(50, data.avgOrder)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex gap-3">
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-subtle">
              <Gift className="size-[1.125rem]" />
            </span>
            <div>
              <CardTitle>Refer a friend</CardTitle>
              <CardDescription>
                Every guest gets a personal link. A friend who books through it gets money off; the guest gets credit on their next trip.
                {referral.enabled && referred > 0 ? ` So far: ${referred} friends booked, ${formatCurrency(referredRevenue * 100, currency)}.` : ''}
              </CardDescription>
            </div>
          </div>
          <Switch checked={referral.enabled} onCheckedChange={(enabled) => { setReferral({ enabled }); toast(enabled ? 'Referrals on' : 'Referrals off') }} aria-label="Refer a friend" />
        </CardHeader>
        {referral.enabled ? (
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="The friend gets" description="Off their first booking.">
                {(control) => <Input {...control} type="number" min={1} max={100} suffix="%" value={referral.friendPercent} onChange={(e) => setReferral({ friendPercent: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })} />}
              </Field>
              <Field label="Your guest gets" description="Credit for their next trip.">
                {(control) => <Input {...control} type="number" min={0} leftIcon={<span className="text-sm text-muted">{symbol}</span>} value={referral.referrerCredit} onChange={(e) => setReferral({ referrerCredit: Math.max(0, Number(e.target.value) || 0) })} />}
              </Field>
              <Field label="Friend spends at least" description="So tiny bookings do not earn credit.">
                {(control) => <Input {...control} type="number" min={0} leftIcon={<span className="text-sm text-muted">{symbol}</span>} value={referral.minSpend} onChange={(e) => setReferral({ minSpend: Math.max(0, Number(e.target.value) || 0) })} />}
              </Field>
            </div>
            <Field label="Share message" description="What guests send with their link. {business} and {friend_percent} fill in for you.">
              {(control) => <Textarea {...control} rows={2} value={referral.message} onChange={(e) => setReferral({ message: e.target.value })} />}
            </Field>
            <div className="flex flex-col gap-3 border-t border-line-subtle pt-4">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  Show it after booking
                  <span className="block text-xs text-subtle">On the confirmation screen, with copy and share buttons.</span>
                </span>
                <Switch checked={referral.showAfterBooking} onCheckedChange={(showAfterBooking) => setReferral({ showAfterBooking })} aria-label="Show it after booking" />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  Ask after a great review
                  <span className="block text-xs text-subtle">Turns on the “Refer a friend” automation for 4 and 5 star reviews.</span>
                </span>
                <Switch checked={referral.inReviewEmail} onCheckedChange={(inReviewEmail) => setReferral({ inReviewEmail })} aria-label="Ask after a great review" />
              </label>
            </div>
            <p className="rounded-xl bg-surface-sunken px-4 py-3 text-sm text-muted">
              Example: a friend books a {formatCurrency(exampleBooking * 100, currency)} trip and pays {formatCurrency(Math.round(exampleBooking * (100 - referral.friendPercent)) , currency)}. Your guest gets {formatCurrency(referral.referrerCredit * 100, currency)} to spend next time.
            </p>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex gap-3">
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-sunken text-subtle">
              <Sparkles className="size-[1.125rem]" />
            </span>
            <div>
              <CardTitle>Loyalty points</CardTitle>
              <CardDescription>
                Guests earn points on every booking and swap them for money off. Shown on their confirmation and booking page.
                {loyalty.enabled ? ` ${members.toLocaleString('en-US')} members hold ${pointsOut.toLocaleString('en-US')} points.` : ''}
              </CardDescription>
            </div>
          </div>
          <Switch checked={loyalty.enabled} onCheckedChange={(enabled) => { setLoyalty({ enabled }); toast(enabled ? 'Loyalty points on' : 'Loyalty points off') }} aria-label="Loyalty points" />
        </CardHeader>
        {loyalty.enabled ? (
          <CardContent className="flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={`Points per ${symbol}1`}>
                {(control) => <Input {...control} type="number" min={1} value={loyalty.pointsPerUnit} onChange={(e) => setLoyalty({ pointsPerUnit: Math.max(1, Number(e.target.value) || 1) })} />}
              </Field>
              <Field label="Points for a reward">
                {(control) => <Input {...control} type="number" min={10} value={loyalty.rewardAt} onChange={(e) => setLoyalty({ rewardAt: Math.max(10, Number(e.target.value) || 10) })} />}
              </Field>
              <Field label="Reward worth">
                {(control) => <Input {...control} type="number" min={1} leftIcon={<span className="text-sm text-muted">{symbol}</span>} value={loyalty.rewardValue} onChange={(e) => setLoyalty({ rewardValue: Math.max(1, Number(e.target.value) || 1) })} />}
              </Field>
              <Field label="Bonus for a review">
                {(control) => <Input {...control} type="number" min={0} suffix="points" value={loyalty.reviewBonus} onChange={(e) => setLoyalty({ reviewBonus: Math.max(0, Number(e.target.value) || 0) })} />}
              </Field>
            </div>
            <p className="rounded-xl bg-surface-sunken px-4 py-3 text-sm text-muted">
              A {formatCurrency(exampleBooking * 100, currency)} booking earns {(exampleBooking * loyalty.pointsPerUnit).toLocaleString('en-US')} points. That is{' '}
              {((exampleBooking * loyalty.pointsPerUnit * loyalty.rewardValue) / loyalty.rewardAt / exampleBooking * 100).toFixed(1)}% back, and a reward after about{' '}
              {Math.max(1, Math.ceil(loyalty.rewardAt / (exampleBooking * loyalty.pointsPerUnit)))} {Math.ceil(loyalty.rewardAt / (exampleBooking * loyalty.pointsPerUnit)) === 1 ? 'booking' : 'bookings'}.
            </p>
          </CardContent>
        ) : null}
      </Card>
    </div>
  )
}
