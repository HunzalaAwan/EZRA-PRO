'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Info, Minus } from 'lucide-react'

import { SectionHeading } from '@/components/marketing/section-heading'
import { Reveal } from '@/components/motion/reveal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import { SimpleTooltip, TooltipProvider } from '@/components/ui/tooltip'
import { PRICING_PLANS } from '@/content/marketing'
import { cn, formatCurrency } from '@/lib/utils'
import type { PlanTier } from '@/types'

/* ==========================================================================
   FEATURE MATRIX

   Every plan carries the same 16 feature labels in the same order, so the
   matrix is a pivot of `plan.features` rather than a second source of truth.
   Built once at module scope — the data is static and deterministic.
   ========================================================================== */

interface MatrixRow {
  label: string
  hint?: string
  included: boolean[]
}

const MATRIX: MatrixRow[] = PRICING_PLANS[0].features.map((feature, index) => ({
  label: feature.label,
  hint: feature.hint,
  included: PRICING_PLANS.map((plan) => plan.features[index]?.included ?? false),
}))

const LAST_PLAN_INDEX = PRICING_PLANS.length - 1

const PLAN_HREF: Record<PlanTier, string> = {
  starter: '/signup?plan=starter',
  growth: '/signup?plan=growth',
  scale: '/signup?plan=scale',
  enterprise: '/contact?topic=enterprise',
}

function percentLabel(percent: number) {
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`
}

/** The fee line under each plan name, in both the table head and the mobile card. */
function feeLine(planIndex: number) {
  const plan = PRICING_PLANS[planIndex]
  if (plan.id === 'enterprise') return 'agreed on volume'
  if (plan.monthlyPrice === 0) return 'no platform fee'
  return `+ ${formatCurrency(plan.monthlyPrice)} a month`
}

/* ==========================================================================
   Cells — shape carries the meaning, colour only reinforces it
   ========================================================================== */

function IncludedMark({ included }: { included: boolean }) {
  return included ? (
    <span className="inline-flex size-6 items-center justify-center rounded-full bg-success-soft text-success">
      <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
      <span className="sr-only">Included</span>
    </span>
  ) : (
    <span className="inline-flex size-6 items-center justify-center rounded-full border text-subtle">
      <Minus className="size-3.5" aria-hidden="true" />
      <span className="sr-only">Not included</span>
    </span>
  )
}

function HintButton({ label, hint }: { label: string; hint: string }) {
  return (
    <SimpleTooltip label={hint} tone="surface" provider={false} side="top">
      <button
        type="button"
        aria-label={`More about ${label}`}
        className={cn(
          'inline-flex size-4 shrink-0 items-center justify-center rounded-full text-subtle',
          'transition-colors duration-200 ease-[var(--ease-out-expo)] hover:text-primary',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        )}
      >
        <Info className="size-3.5" aria-hidden="true" />
      </button>
    </SimpleTooltip>
  )
}

/* ==========================================================================
   Section
   ========================================================================== */

export interface PricingTableProps {
  id?: string
  className?: string
}

export function PricingTable({ id = 'compare-plans', className }: PricingTableProps) {
  const [selected, setSelected] = useState<PlanTier>('growth')

  const selectedIndex = Math.max(
    PRICING_PLANS.findIndex((plan) => plan.id === selected),
    0,
  )
  const selectedPlan = PRICING_PLANS[selectedIndex]
  const includedCount = selectedPlan.features.filter((feature) => feature.included).length

  return (
    <section id={id} className={cn('relative py-20 sm:py-28', className)}>
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Compare"
          title="Every capability, side by side"
          description="Sixteen things a booking platform has to do, four plans, no asterisks. The only numbers that move are the commission and the platform fee."
          align="center"
        />

        <TooltipProvider delayDuration={180}>
          {/* ---------- Desktop: the full matrix, head sticks while you scan ---------- */}
          <Reveal delay={0.06} className="mt-12 hidden md:block">
            <table className="w-full border-separate border-spacing-0 text-left text-sm">
              <caption className="sr-only">
                EZRA Pro feature comparison across the Starter, Growth, Scale and Enterprise plans
              </caption>

              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky top-16 z-20 lg:top-18 w-[30%] rounded-tl-2xl border-y border-l bg-background px-5 pb-4 pt-5 text-left align-bottom"
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                      What you get
                    </span>
                  </th>
                  {PRICING_PLANS.map((plan, planIndex) => (
                    <th
                      key={plan.id}
                      scope="col"
                      className={cn(
                        'sticky top-16 z-20 lg:top-18 w-[17.5%] border-y px-3 pb-4 pt-5 text-center align-bottom',
                        plan.popular
                          ? 'bg-[color-mix(in_oklab,var(--primary)_9%,var(--bg))]'
                          : 'bg-background',
                        planIndex === LAST_PLAN_INDEX && 'rounded-tr-2xl border-r',
                      )}
                    >
                      {plan.popular && plan.badge ? (
                        <Badge variant="primary" size="sm" className="mb-2">
                          {plan.badge}
                        </Badge>
                      ) : null}
                      <span className="block font-display text-base font-semibold text-foreground">
                        {plan.name}
                      </span>
                      <span className="mt-1 block font-display text-2xl font-semibold tracking-[-0.025em] tabular text-foreground">
                        {plan.id === 'enterprise' ? 'Custom' : percentLabel(plan.commissionPercent)}
                      </span>
                      <span className="mt-0.5 block text-[0.6875rem] leading-snug text-subtle">
                        {feeLine(planIndex)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {MATRIX.map((row) => (
                  <tr
                    key={row.label}
                    className="bg-surface transition-colors duration-200 ease-[var(--ease-out-expo)] hover:bg-background-subtle"
                  >
                    <th
                      scope="row"
                      className="border-b border-b-line-subtle border-l px-5 py-3.5 text-left text-sm font-medium text-foreground"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {row.label}
                        {row.hint ? <HintButton label={row.label} hint={row.hint} /> : null}
                      </span>
                    </th>
                    {row.included.map((included, planIndex) => (
                      <td
                        key={PRICING_PLANS[planIndex].id}
                        className={cn(
                          'border-b border-b-line-subtle px-3 py-3.5 text-center',
                          PRICING_PLANS[planIndex].popular && 'bg-primary-soft/35',
                          planIndex === LAST_PLAN_INDEX && 'border-r',
                        )}
                      >
                        <IncludedMark included={included} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="bg-surface">
                  <td className="rounded-bl-2xl border-b border-l px-5 py-5 align-middle text-xs leading-relaxed text-subtle">
                    Free migration and next-day payouts are on every plan, Starter included.
                  </td>
                  {PRICING_PLANS.map((plan, planIndex) => (
                    <td
                      key={plan.id}
                      className={cn(
                        'border-b px-3 py-5 text-center align-middle',
                        plan.popular && 'bg-primary-soft/35',
                        planIndex === LAST_PLAN_INDEX && 'rounded-br-2xl border-r',
                      )}
                    >
                      <Button
                        asChild
                        fullWidth
                        size="sm"
                        variant={plan.popular ? 'primary' : 'secondary'}
                      >
                        <Link href={PLAN_HREF[plan.id]}>{plan.cta}</Link>
                      </Button>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </Reveal>

          {/* ---------- Mobile: pick a plan, read one column ---------- */}
          <div className="mt-10 md:hidden">
            <div className="-mx-4 overflow-x-auto px-4 no-scrollbar">
              <Segmented
                label="Choose a plan to compare"
                size="sm"
                className="w-max"
                options={PRICING_PLANS.map((plan) => ({ value: plan.id, label: plan.name }))}
                value={selected}
                onValueChange={setSelected}
              />
            </div>

            <div className="mt-5 overflow-hidden rounded-2xl border bg-surface shadow-sm">
              <div className="border-b border-b-line-subtle bg-surface-sunken/60 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base font-semibold text-foreground">
                    {selectedPlan.name}
                  </h3>
                  {selectedPlan.badge ? (
                    <Badge variant={selectedPlan.popular ? 'primary' : 'outline'} size="sm">
                      {selectedPlan.badge}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-2 flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-3xl font-semibold tracking-[-0.03em] tabular text-foreground">
                    {selectedPlan.id === 'enterprise'
                      ? 'Custom'
                      : percentLabel(selectedPlan.commissionPercent)}
                  </span>
                  <span className="text-sm text-muted">
                    {selectedPlan.id === 'enterprise' ? 'commission' : 'per booking'}
                  </span>
                </p>
                <p className="mt-1 text-xs text-subtle">{feeLine(selectedIndex)}</p>
                <p className="mt-3 text-xs font-medium text-muted">
                  {includedCount} of {MATRIX.length} capabilities included
                </p>
              </div>

              <ul className="divide-y divide-line-subtle">
                {selectedPlan.features.map((feature) => (
                  <li
                    key={feature.label}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <span
                      className={cn(
                        'flex min-w-0 items-center gap-1.5 text-sm leading-snug',
                        feature.included ? 'text-foreground' : 'text-subtle',
                      )}
                    >
                      <span className="min-w-0">{feature.label}</span>
                      {feature.hint ? (
                        <HintButton label={feature.label} hint={feature.hint} />
                      ) : null}
                    </span>
                    <IncludedMark included={feature.included} />
                  </li>
                ))}
              </ul>

              <div className="border-t border-t-line-subtle p-4">
                <Button
                  asChild
                  fullWidth
                  size="md"
                  variant={selectedPlan.popular ? 'primary' : 'secondary'}
                >
                  <Link href={PLAN_HREF[selectedPlan.id]}>{selectedPlan.cta}</Link>
                </Button>
                <p className="mt-3 text-center text-xs text-subtle">
                  Free migration and next-day payouts on every plan.
                </p>
              </div>
            </div>
          </div>
        </TooltipProvider>
      </div>
    </section>
  )
}
