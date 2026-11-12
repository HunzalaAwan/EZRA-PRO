import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

import { SectionHeading } from '@/components/marketing/section-heading'
import { Reveal } from '@/components/motion/reveal'
import { Button } from '@/components/ui/button'
import { PRICING_PLANS } from '@/content/marketing'
import { cn, formatCurrency } from '@/lib/utils'

/* ==========================================================================
   PRICING — one price for everyone.

   4% of each booking, $0 a month, no setup fee, no contract, every feature
   included. The business chooses who pays the 4%. One card: the number on
   the left, everything it includes on the right.
   ========================================================================== */

const PLAN = PRICING_PLANS[0]

/** "4" / "4.5": the hero digits, without their unit. */
function percentDigits(percent: number) {
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(1)
}

const FACTS = [`${formatCurrency(PLAN.monthlyPrice)} a month`, 'No setup fee', 'No contract']

export interface PricingSectionProps {
  id?: string
  className?: string
}

export function PricingSection({ id = 'pricing', className }: PricingSectionProps) {
  const percent = percentDigits(PLAN.commissionPercent)

  return (
    <section id={id} className={cn('relative isolate py-20 sm:py-28', className)}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Pricing"
          title="One price. Everything included."
          description="You pay when a guest books, and only then."
          align="center"
        />

        <Reveal delay={0.08} className="mt-12">
          <div className="grid overflow-hidden rounded-3xl border border-line bg-surface shadow-sm lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            {/* ---------- The price ---------- */}
            <div className="flex flex-col gap-6 border-b border-line p-6 sm:p-8 lg:border-r lg:border-b-0 lg:p-10">
              <div>
                <p
                  className="flex items-baseline gap-1 font-display font-semibold leading-none tracking-[-0.035em] text-foreground tabular"
                  aria-label={`${percent}% of each booking`}
                >
                  <span className="text-[4.5rem] sm:text-[5.5rem]">{percent}</span>
                  <span className="text-3xl sm:text-4xl">%</span>
                </p>
                <p className="mt-3 text-lg font-medium text-foreground">of each booking.</p>
                <p className="mt-1 text-base text-muted">That is the entire bill.</p>
              </div>

              <ul className="flex flex-wrap gap-2">
                {FACTS.map((fact) => (
                  <li
                    key={fact}
                    className="rounded-full border border-line bg-background-subtle px-3 py-1.5 text-sm font-medium text-foreground"
                  >
                    {fact}
                  </li>
                ))}
              </ul>

              <div className="rounded-2xl border border-line-subtle bg-background-subtle p-4">
                <p className="text-sm font-semibold text-foreground">You choose who pays the {percent}%</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Take it from the booking and guests pay exactly the price you set. Or add it at
                  checkout as one booking fee line. Change it any time in Settings.
                </p>
              </div>

              <div className="mt-auto flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" variant="ink" rightIcon={<ArrowRight aria-hidden="true" />}>
                  <Link href="/signup">{PLAN.cta}</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href="/contact?topic=pricing">Ask a question</Link>
                </Button>
              </div>
              <p className="text-xs text-subtle">No card needed to start.</p>
            </div>

            {/* ---------- Everything included ---------- */}
            <div className="p-6 sm:p-8 lg:p-10">
              <h3 className="font-display text-lg font-semibold tracking-[-0.015em] text-foreground">
                Everything is included
              </h3>
              <p className="mt-1 text-sm text-muted">No plans, no add-ons, nothing to unlock later.</p>
              <ul className="mt-6 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {PLAN.features.map((feature) => (
                  <li key={feature.label} className="flex items-start gap-2.5 text-sm text-foreground">
                    <span className="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span className="leading-snug">
                      {feature.label}
                      {feature.hint ? <span className="mt-0.5 block text-xs text-subtle">{feature.hint}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-muted">
          Card fees are between you and your payment provider, so guests never see a card fee line. Free
          move from your current platform.
        </p>
      </div>
    </section>
  )
}
