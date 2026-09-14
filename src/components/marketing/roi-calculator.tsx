'use client'

import { useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { ArrowRight, Calculator, Info, Sparkles, TrendingDown } from 'lucide-react'

import { SectionHeading } from '@/components/marketing/section-heading'
import { CountUp } from '@/components/motion/count-up'
import { Reveal } from '@/components/motion/reveal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { PRICING_PLANS } from '@/content/marketing'
import { useReducedMotionSafe } from '@/hooks/use-reduced-motion-safe'
import { DURATION, EASE_OUT_EXPO } from '@/lib/motion'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import type { PlanTier } from '@/types'

/* ==========================================================================
   ROI CALCULATOR

   Every figure below is derived from PRICING_PLANS and kept in MINOR UNITS
   until the moment it is formatted. The incumbent rate is the published
   FareHarbor / Peek Pro headline commission.

   Enterprise is deliberately excluded from the comparison: its commission is
   negotiated, so putting its 0% placeholder on a bar chart would be a lie.
   ========================================================================== */

/** Published headline commission for FareHarbor and Peek Pro. */
const INCUMBENT_RATE = 6
const INCUMBENT_LABEL = 'FareHarbor / Peek Pro'

const COMPARED_PLANS = PRICING_PLANS.filter((plan) => plan.id !== 'enterprise')
const BASELINE_PLAN = PRICING_PLANS[0]

/** Annual gross booking value above which we quote Enterprise instead. */
const ENTERPRISE_THRESHOLD = 500_000_00

const VOLUME = { min: 10, max: 1200, step: 10, initial: 220 }
/** Average booking value, in minor units: $25 → $750 in $5 steps. */
const VALUE = { min: 2_500, max: 75_000, step: 500, initial: 14_500 }

const PLAN_HREF: Record<PlanTier, string> = {
  starter: '/signup?plan=starter',
  growth: '/signup?plan=growth',
  scale: '/signup?plan=scale',
  enterprise: '/contact?topic=enterprise',
}

function percentLabel(percent: number) {
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`
}

type BarKind = 'incumbent' | 'plan' | 'best'

const BAR_FILL: Record<BarKind, string> = {
  incumbent: 'bg-line-strong',
  plan: 'bg-[linear-gradient(90deg,color-mix(in_oklab,var(--primary)_45%,transparent),var(--primary))]',
  best: 'bg-[linear-gradient(90deg,var(--primary),var(--accent))]',
}

/* ==========================================================================
   Input row
   ========================================================================== */

function InputRow({
  label,
  valueLabel,
  hint,
  children,
  minLabel,
  maxLabel,
}: {
  label: string
  valueLabel: string
  hint: string
  children: ReactNode
  minLabel: string
  maxLabel: string
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="font-display text-xl font-semibold tracking-[-0.02em] tabular text-primary">
          {valueLabel}
        </span>
      </div>
      <div className="mt-3">{children}</div>
      <div className="mt-2 flex items-center justify-between text-[0.6875rem] text-subtle">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-subtle">{hint}</p>
    </div>
  )
}

/* ==========================================================================
   Section
   ========================================================================== */

export interface RoiCalculatorProps {
  id?: string
  className?: string
}

export function RoiCalculator({ id = 'roi', className }: RoiCalculatorProps) {
  const reduceMotion = useReducedMotionSafe()
  const [volume, setVolume] = useState(VOLUME.initial)
  const [avgValue, setAvgValue] = useState(VALUE.initial)

  const model = useMemo(() => {
    const monthlyGbv = volume * avgValue
    const annualGbv = monthlyGbv * 12
    const incumbentTotal = Math.round((annualGbv * INCUMBENT_RATE) / 100)

    const options = COMPARED_PLANS.map((plan) => {
      const commission = Math.round((annualGbv * plan.commissionPercent) / 100)
      const platform = plan.monthlyPrice * 12
      return { plan, commission, platform, total: commission + platform }
    })

    // Ties keep the earlier (cheaper-to-start) plan, which is the honest default.
    const best = options.reduce((cheapest, option) =>
      option.total < cheapest.total ? option : cheapest,
    )
    const saving = incumbentTotal - best.total
    const scaleMax = Math.max(incumbentTotal, ...options.map((option) => option.total), 1)

    // Where the first paid tier starts winning: its fee divided by the rate it saves.
    const paidTier = options.find((option) => option.platform > 0)
    const rateGap = paidTier
      ? (BASELINE_PLAN.commissionPercent - paidTier.plan.commissionPercent) / 100
      : 0
    const breakEvenMonthlyGbv =
      paidTier && rateGap > 0 ? Math.round(paidTier.plan.monthlyPrice / rateGap) : 0

    return {
      monthlyGbv,
      annualGbv,
      incumbentTotal,
      options,
      best,
      saving,
      scaleMax,
      paidTier,
      breakEvenMonthlyGbv,
    }
  }, [avgValue, volume])

  const beatsIncumbent = model.saving > 0

  const bars: { key: string; name: string; note: string; total: number; kind: BarKind }[] = [
    {
      key: 'incumbent',
      name: INCUMBENT_LABEL,
      note: `${INCUMBENT_RATE}% commission, no platform fee`,
      total: model.incumbentTotal,
      kind: 'incumbent',
    },
    ...model.options.map((option) => ({
      key: option.plan.id,
      name: `EZRA ${option.plan.name}`,
      note:
        option.platform === 0
          ? `${percentLabel(option.plan.commissionPercent)} commission, no platform fee`
          : `${percentLabel(option.plan.commissionPercent)} commission + ${formatCurrency(option.platform)} a year in platform fees`,
      total: option.total,
      kind: (option.plan.id === model.best.plan.id ? 'best' : 'plan') as BarKind,
    })),
  ]

  const reason = beatsIncumbent
    ? `${model.best.plan.name} charges ${percentLabel(model.best.plan.commissionPercent)} instead of ${INCUMBENT_RATE}% — ${formatCurrency(
        model.incumbentTotal - model.best.commission,
      )} less commission a year, which more than covers its ${formatCurrency(model.best.platform)} in platform fees.`
    : `Starter charges the same ${INCUMBENT_RATE}% you already pay and adds no platform fee, so at this volume the commission is a wash. What changes is everything around it — migration, analytics, offline check-in and next-day payouts cost you nothing extra.`

  return (
    <section id={id} className={cn('relative py-20 sm:py-28', className)}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Run the numbers"
          title="What would you actually save?"
          description="Two sliders, your real volume, and the arithmetic every operator does on the back of a napkin before they switch."
          align="center"
        />

        <Reveal delay={0.06} className="mt-12">
          <div className="overflow-hidden rounded-3xl border bg-surface shadow-xl">
            <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              {/* ---------- Inputs ---------- */}
              <div className="border-b p-6 sm:p-8 lg:border-b-0 lg:border-r">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                  <Calculator className="size-4" aria-hidden="true" />
                  Your season
                </p>

                <div className="mt-7 space-y-8">
                  <InputRow
                    label="Bookings a month"
                    valueLabel={formatNumber(volume)}
                    minLabel={formatNumber(VOLUME.min)}
                    maxLabel={`${formatNumber(VOLUME.max)}+`}
                    hint="Across every channel — your own site, the phone, walk-ups and the OTAs."
                  >
                    <Slider
                      value={[volume]}
                      min={VOLUME.min}
                      max={VOLUME.max}
                      step={VOLUME.step}
                      size="lg"
                      thumbLabels={['Bookings a month']}
                      onValueChange={([next]) => setVolume(next)}
                    />
                  </InputRow>

                  <InputRow
                    label="Average booking value"
                    valueLabel={formatCurrency(avgValue)}
                    minLabel={formatCurrency(VALUE.min)}
                    maxLabel={`${formatCurrency(VALUE.max)}+`}
                    hint="Total per booking, not per guest — a family of four on one reservation counts once."
                  >
                    <Slider
                      value={[avgValue]}
                      min={VALUE.min}
                      max={VALUE.max}
                      step={VALUE.step}
                      size="lg"
                      thumbLabels={['Average booking value']}
                      onValueChange={([next]) => setAvgValue(next)}
                    />
                  </InputRow>
                </div>

                <dl className="mt-8 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-line-subtle bg-surface-sunken/60 px-4 py-3">
                    <dt className="text-xs text-subtle">Through checkout, monthly</dt>
                    <dd className="mt-1 font-display text-lg font-semibold tabular text-foreground">
                      {formatCurrency(model.monthlyGbv, 'USD', { compact: true })}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-line-subtle bg-surface-sunken/60 px-4 py-3">
                    <dt className="text-xs text-subtle">Through checkout, yearly</dt>
                    <dd className="mt-1 font-display text-lg font-semibold tabular text-foreground">
                      {formatCurrency(model.annualGbv, 'USD', { compact: true })}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* ---------- Result ---------- */}
              <div className="bg-surface-sunken/45 p-6 sm:p-8">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-subtle">
                  <TrendingDown className="size-4" aria-hidden="true" />
                  Estimated annual saving vs {INCUMBENT_RATE}%
                </p>

                {beatsIncumbent ? (
                  <p className="mt-3 font-display text-display-sm font-semibold tracking-[-0.03em] text-success">
                    <CountUp value={model.saving} format="currency" duration={DURATION.slow} />
                  </p>
                ) : (
                  <>
                    <p className="mt-3 font-display text-display-sm font-semibold tracking-[-0.03em] text-foreground">
                      {formatCurrency(0)}
                    </p>
                    <p className="mt-2 text-sm font-medium text-muted">
                      Nothing saved on commission at this volume — and we would rather say so than
                      dress up a negative number as a win.
                    </p>
                  </>
                )}

                <div className="mt-6 rounded-2xl border border-[color-mix(in_oklab,var(--primary)_30%,transparent)] bg-primary-soft/45 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <p className="text-sm font-semibold text-foreground">
                      Recommended: {model.best.plan.name}
                    </p>
                    <Badge variant="primary" size="sm">
                      {percentLabel(model.best.plan.commissionPercent)} per booking
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{reason}</p>

                  {!beatsIncumbent && model.paidTier && model.breakEvenMonthlyGbv > 0 ? (
                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {model.paidTier.plan.name} starts paying for itself at about{' '}
                      <strong className="font-semibold text-foreground">
                        {formatCurrency(model.breakEvenMonthlyGbv)}
                      </strong>{' '}
                      a month through checkout — roughly{' '}
                      {formatNumber(Math.ceil(model.breakEvenMonthlyGbv / avgValue))} bookings at
                      your current average.
                    </p>
                  ) : null}

                  <Button
                    asChild
                    size="sm"
                    variant="primary"
                    className="mt-4"
                    rightIcon={<ArrowRight aria-hidden="true" />}
                  >
                    <Link href={PLAN_HREF[model.best.plan.id]}>{model.best.plan.cta}</Link>
                  </Button>
                </div>

                {/* ---------- Bars ---------- */}
                <ul className="mt-7 space-y-4">
                  {bars.map((bar) => (
                    <li key={bar.key}>
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                          {bar.name}
                          {bar.kind === 'best' ? (
                            <Badge variant="primary" size="sm">
                              Best value
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-sm font-semibold tabular text-foreground">
                          {formatCurrency(bar.total)}
                          <span className="ml-1 font-normal text-subtle">a year</span>
                        </span>
                      </div>
                      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-line">
                        <motion.div
                          aria-hidden="true"
                          className={cn('h-full w-full origin-left rounded-full', BAR_FILL[bar.kind])}
                          initial={{ scaleX: 0 }}
                          animate={{ scaleX: bar.total / model.scaleMax }}
                          transition={
                            reduceMotion
                              ? { duration: 0 }
                              : { duration: DURATION.slow, ease: EASE_OUT_EXPO }
                          }
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-subtle">{bar.note}</p>
                    </li>
                  ))}
                </ul>

                {model.annualGbv >= ENTERPRISE_THRESHOLD ? (
                  <p className="mt-6 rounded-xl border border-line-subtle bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
                    Above {formatCurrency(ENTERPRISE_THRESHOLD, 'USD', { compact: true })} a year
                    through checkout we quote Enterprise directly — custom commission, a dedicated
                    success manager and a 99.99% SLA.{' '}
                    <Link
                      href={PLAN_HREF.enterprise}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      Talk to sales
                    </Link>
                    .
                  </p>
                ) : null}

                <p className="mt-6 flex items-start gap-2 text-xs leading-relaxed text-subtle">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    An estimate, not a quote. It assumes every booking runs through EZRA Pro,
                    month-to-month billing on the platform fee, and the published{' '}
                    {INCUMBENT_RATE}% headline rate on your current system. Annual billing takes two
                    months off the platform fee.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
