'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Sparkles } from 'lucide-react'

import { SectionHeading } from '@/components/marketing/section-heading'
import { GlowOrb } from '@/components/motion/backgrounds'
import { CountUp } from '@/components/motion/count-up'
import { Reveal } from '@/components/motion/reveal'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { PRICING_PLANS } from '@/content/marketing'
import { cn, formatCurrency } from '@/lib/utils'
import type { PlanTier, PricingPlan } from '@/types'

/* ==========================================================================
   PRICING — four plans, commission as the hero number.

   Operators shop on the per-booking commission, not the platform fee: a 1.5
   point difference on a $400k season is $6,000, while the fee difference is
   $948. So the commission is the display number and the fee is the supporting
   line, which is the inverse of how FareHarbor and Peek present themselves.
   ========================================================================== */

export type BillingPeriod = 'monthly' | 'annual'

const BILLING_OPTIONS: { value: BillingPeriod; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
]

const PLAN_HREF: Record<PlanTier, string> = {
  starter: '/signup?plan=starter',
  growth: '/signup?plan=growth',
  scale: '/signup?plan=scale',
  enterprise: '/contact?topic=enterprise',
}

const PLAN_FOOTNOTE: Record<PlanTier, string> = {
  starter: 'No card required — ever',
  growth: '14 days free · no card required',
  scale: '14 days free · no card required',
  enterprise: 'A human replies within one business day',
}

/** "6" / "4.5" — the hero digits, without their unit. */
export function commissionDigits(percent: number) {
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
}

/* ==========================================================================
   Platform fee — the secondary line, animated across the billing toggle
   ========================================================================== */

function PlatformFee({ plan, billing }: { plan: PricingPlan; billing: BillingPeriod }) {
  if (plan.id === 'enterprise') {
    return (
      <>
        <p className="font-display text-lg font-semibold text-foreground">Custom agreement</p>
        <p className="mt-0.5 text-xs text-subtle">Priced on volume, locations and SLA</p>
      </>
    )
  }

  if (plan.monthlyPrice === 0) {
    return (
      <>
        <p className="font-display text-lg font-semibold text-foreground">No platform fee</p>
        <p className="mt-0.5 text-xs text-subtle">
          {formatCurrency(0)} a month, on either billing period
        </p>
      </>
    )
  }

  const annual = billing === 'annual'
  const amount = annual ? plan.annualPrice : plan.monthlyPrice
  const perMonth = formatCurrency(Math.round(plan.annualPrice / 12), 'USD', { decimals: true })

  return (
    <>
      <p className="flex items-baseline gap-1">
        <CountUp
          value={amount}
          format="currency"
          duration={0.5}
          className="font-display text-lg font-semibold text-foreground"
        />
        <span className="text-sm font-medium text-subtle">{annual ? '/ year' : '/ month'}</span>
      </p>
      <p className="mt-0.5 text-xs text-subtle">
        {annual ? `${perMonth} a month · two months free` : 'Billed monthly · cancel any time'}
      </p>
    </>
  )
}

/* ==========================================================================
   Plan card
   ========================================================================== */

function PlanCard({ plan, billing }: { plan: PricingPlan; billing: BillingPeriod }) {
  const popular = plan.popular
  const enterprise = plan.id === 'enterprise'

  return (
    <div
      className={cn(
        'group relative flex w-full rounded-3xl p-px',
        'transition-[transform,box-shadow] duration-500 ease-[var(--ease-out-expo)]',
        'hover:-translate-y-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        popular
          ? [
              'shadow-xl xl:scale-[1.035]',
              'bg-primary',
            ]
          : 'bg-transparent',
      )}
    >
      {popular && plan.badge ? (
        <div className="absolute -top-3.5 left-1/2 z-20 -translate-x-1/2">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 shadow-lg',
              'text-[0.6875rem] font-semibold uppercase tracking-[0.09em] text-white',
              'bg-lagoon-800',
            )}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            {plan.badge}
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          'flex w-full flex-col rounded-[calc(var(--radius-3xl)-1px)] bg-surface p-6 sm:p-7',
          !popular &&
            'border border-line shadow-sm transition-[border-color,box-shadow] duration-500 ease-[var(--ease-out-expo)] group-hover:border-primary/40 group-hover:shadow-lg',
        )}
      >
        <header>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-semibold tracking-[-0.015em] text-foreground">
              {plan.name}
            </h3>
            {!popular && plan.badge ? (
              <Badge variant="outline" size="sm">
                {plan.badge}
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted lg:min-h-[4.5rem]">{plan.blurb}</p>
        </header>

        {/* Hero: the number operators actually shop on. */}
        <div className="mt-6">
          {enterprise ? (
            <p className="font-display text-[2.75rem] font-semibold leading-none tracking-[-0.035em] text-foreground">
              Custom
            </p>
          ) : (
            <p
              className={cn(
                'flex items-baseline gap-1 font-display font-semibold leading-none tracking-[-0.035em] tabular',
                popular ? 'text-primary' : 'text-foreground',
              )}
            >
              <span className="text-[3.25rem]">{commissionDigits(plan.commissionPercent)}</span>
              <span className="text-2xl">%</span>
            </p>
          )}
          <p className="mt-2.5 text-sm font-medium text-muted">
            {enterprise ? 'commission agreed on volume' : 'commission per booking'}
          </p>
        </div>

        <div className="mt-5 rounded-xl border border-line-subtle bg-surface-sunken/60 px-4 py-3">
          <PlatformFee plan={plan} billing={billing} />
        </div>

        <ul className="mt-6 space-y-2.5">
          {plan.highlights.map((highlight) => (
            <li key={highlight} className="flex items-start gap-2.5 text-sm text-foreground">
              <span className="mt-px inline-flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
                <Check className="size-3" strokeWidth={3} aria-hidden="true" />
              </span>
              <span className="leading-snug">{highlight}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-7">
          <Button
            asChild
            fullWidth
            size="lg"
            variant={popular ? 'primary' : 'secondary'}
            rightIcon={<ArrowRight aria-hidden="true" />}
          >
            <Link href={PLAN_HREF[plan.id]}>{plan.cta}</Link>
          </Button>
          <p className="mt-3 text-center text-xs text-subtle">{PLAN_FOOTNOTE[plan.id]}</p>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   Section
   ========================================================================== */

export interface PricingSectionProps {
  id?: string
  className?: string
}

export function PricingSection({ id = 'pricing', className }: PricingSectionProps) {
  const [billing, setBilling] = useState<BillingPeriod>('monthly')

  return (
    <section id={id} className={cn('relative isolate overflow-hidden py-20 sm:py-28', className)}>
      <GlowOrb color="lagoon" size={520} opacity={0.14} blur={110} className="-top-40 left-[-8%]" />
      <GlowOrb
        color="coral"
        size={460}
        opacity={0.12}
        blur={110}
        float={false}
        className="-bottom-32 right-[-6%]"
      />

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Pricing"
          title={
            <>
              Pay less per booking.
              <br className="hidden sm:block" /> Keep more of the season.
            </>
          }
          description="Commission is the number that decides your year. Ours starts where FareHarbor and Peek finish, and drops from there. No setup fee, no contract, free migration on every plan."
          align="center"
        />

        <Reveal
          delay={0.08}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4"
        >
          <Segmented
            label="Billing period"
            size="lg"
            options={BILLING_OPTIONS}
            value={billing}
            onValueChange={setBilling}
          />
          <Badge
            variant={billing === 'annual' ? 'primary' : 'outline'}
            size="md"
            className="transition-colors duration-300 ease-[var(--ease-out-expo)]"
          >
            Save 2 months on annual
          </Badge>
        </Reveal>

        <StaggerGroup
          as="ul"
          stagger={0.08}
          startDelay={0.08}
          className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6"
        >
          {PRICING_PLANS.map((plan) => (
            <StaggerItem
              as="li"
              key={plan.id}
              className={cn('relative isolate flex', plan.popular && 'xl:z-10')}
            >
              {plan.popular ? (
                <div
                  aria-hidden="true"
                  className={cn(
                    'pointer-events-none absolute -inset-3 -z-10 rounded-[2.25rem] blur-2xl',
                    'bg-primary',
                    'opacity-20 dark:opacity-30',
                  )}
                />
              ) : null}
              <PlanCard plan={plan} billing={billing} />
            </StaggerItem>
          ))}
        </StaggerGroup>

        <Reveal delay={0.12} className="mx-auto mt-12 max-w-3xl">
          <p className="text-center text-sm leading-relaxed text-muted">
            Every plan includes unlimited activities, unlimited team members, free migration from
            FareHarbor or Peek Pro, and next-day payouts. Commission is charged only on bookings you
            actually take.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
