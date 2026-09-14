'use client'

import Link from 'next/link'
import { ArrowRight, CalendarCheck2, Receipt, Users, type LucideIcon } from 'lucide-react'

import { ChartDeltaChip } from '@/components/charts/chart-container'
import { CountUp } from '@/components/motion/count-up'
import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { CurrencyCode, KpiMetric } from '@/types'

/* ==========================================================================
   StatTiles — three supporting reads in one card.

   The hero carries revenue; these carry what produced it. One card rather
   than three keeps them reading as a set, and each tile is deliberately
   sparse: icon, label, the number, the change. The sparklines live on the
   analytics page where there is room to read them.
   ========================================================================== */

interface TileLook {
  icon: LucideIcon
  chip: string
}

const LOOK: Record<string, TileLook> = {
  bookings: { icon: CalendarCheck2, chip: 'bg-primary-soft text-primary' },
  guests: { icon: Users, chip: 'bg-info-soft text-info' },
  aov: { icon: Receipt, chip: 'bg-warning-soft text-warning' },
}

const FALLBACK: TileLook = { icon: Receipt, chip: 'bg-surface-sunken text-muted' }

const DEFAULT_KEYS = ['bookings', 'guests', 'aov'] as const

export interface StatTilesProps {
  kpis: KpiMetric[]
  currency: CurrencyCode
  keys?: readonly string[]
  className?: string
}

export function StatTiles({ kpis, currency, keys = DEFAULT_KEYS, className }: StatTilesProps) {
  const byKey = new Map(kpis.map((k) => [k.key, k]))
  const shown = keys.map((k) => byKey.get(k)).filter((m): m is KpiMetric => Boolean(m))
  if (shown.length === 0) return null

  return (
    <Card className={cn('flex h-full flex-col overflow-hidden', className)}>
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
        <div>
          <h2 className="font-display text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground">
            Performance
          </h2>
          <p className="mt-0.5 text-[0.6875rem] text-subtle">{shown[0].comparisonLabel}</p>
        </div>
        <Link
          href="/dashboard/analytics"
          className="inline-flex items-center gap-1 rounded-md text-[0.6875rem] font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          All analytics
          <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
      </div>

      <StaggerGroup
        as="ul"
        stagger={0.07}
        startDelay={0.1}
        className="grid flex-1 grid-cols-1 divide-y divide-line-subtle border-t border-line-subtle sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        {shown.map((metric) => {
          const look = LOOK[metric.key] ?? FALLBACK
          const Icon = look.icon
          const isMoney = metric.format === 'currency'

          return (
            <StaggerItem as="li" key={metric.key} distance={10} className="flex flex-col gap-3 px-5 py-4">
              <span className="flex items-center gap-2">
                <span className={cn('grid size-7 place-items-center rounded-full', look.chip)}>
                  <Icon aria-hidden="true" className="size-3.5" strokeWidth={2} />
                </span>
                <span className="text-xs font-medium text-muted">{metric.label}</span>
              </span>

              <CountUp
                value={metric.value}
                format={isMoney ? 'currency' : metric.format === 'percent' ? 'percent' : 'number'}
                currency={currency}
                decimals={metric.format === 'percent' ? 1 : 0}
                duration={1.1}
                className="font-display text-[1.5rem] leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums"
              />

              <ChartDeltaChip
                value={metric.deltaPercent}
                higherIsBetter={metric.higherIsBetter}
                size="xs"
                className="w-fit"
              />
            </StaggerItem>
          )
        })}
      </StaggerGroup>
    </Card>
  )
}
