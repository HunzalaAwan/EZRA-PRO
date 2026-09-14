'use client'

import * as React from 'react'
import {
  CalendarCheck2,
  Gauge,
  Receipt,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

import { StaggerGroup, StaggerItem } from '@/components/motion/stagger'
import { StatCard, type StatAccent } from '@/components/ui/stat'
import { cn } from '@/lib/utils'
import type { KpiMetric } from '@/types'

/* ==========================================================================
   KpiRow — the five headline numbers the operator checks first.

   `<StatCard metric={…}>` already derives delta colour from `direction` AND
   `higherIsBetter`, counts the value up without re-rendering, and draws the
   sparkline. All this component adds is ordering, iconography, the accent
   rotation and the entrance cascade.
   ========================================================================== */

interface KpiPresentation {
  icon: LucideIcon
  accent: StatAccent
  /** Abbreviate above this value, in MINOR units. Only money ever needs it. */
  compactAbove?: number
}

/** Keyed by `KpiMetric.key` as emitted by `getKpis()`. */
const PRESENTATION: Record<string, KpiPresentation> = {
  net_revenue: { icon: Wallet, accent: 'lagoon', compactAbove: 10_000_000 /* $100k */ },
  bookings: { icon: CalendarCheck2, accent: 'coral' },
  guests: { icon: Users, accent: 'reef' },
  aov: { icon: Receipt, accent: 'sunset', compactAbove: 10_000_000 /* $100k */ },
  occupancy: { icon: Gauge, accent: 'lagoon' },
  cancellation_rate: { icon: Receipt, accent: 'coral' },
  repeat_rate: { icon: Users, accent: 'reef' },
  avg_rating: { icon: Gauge, accent: 'sunset' },
  lead_time: { icon: CalendarCheck2, accent: 'lagoon' },
}

const FALLBACK: KpiPresentation = { icon: Gauge, accent: 'lagoon' }

/** The five that lead the overview, in reading order. */
const DEFAULT_KEYS = ['net_revenue', 'bookings', 'guests', 'aov', 'occupancy'] as const

export interface KpiRowProps {
  kpis: KpiMetric[]
  /** Override which metrics appear, and in what order. */
  keys?: readonly string[]
  className?: string
}

export function KpiRow({ kpis, keys = DEFAULT_KEYS, className }: KpiRowProps) {
  const byKey = React.useMemo(() => new Map(kpis.map((k) => [k.key, k])), [kpis])

  const shown = React.useMemo(() => {
    const picked = keys.map((key) => byKey.get(key)).filter((m): m is KpiMetric => Boolean(m))
    // Never render an empty row: fall back to whatever the snapshot did return.
    return picked.length > 0 ? picked : kpis.slice(0, 5)
  }, [keys, byKey, kpis])

  if (shown.length === 0) return null

  return (
    <StaggerGroup
      as="ul"
      stagger={0.055}
      className={cn(
        'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
        className,
      )}
    >
      {shown.map((metric) => {
        const look = PRESENTATION[metric.key] ?? FALLBACK
        const compact =
          metric.format === 'currency' &&
          typeof look.compactAbove === 'number' &&
          metric.value >= look.compactAbove

        return (
          <StaggerItem as="li" key={metric.key} distance={14}>
            <StatCard
              metric={metric}
              icon={look.icon}
              accent={look.accent}
              compact={compact}
              className="h-full"
            />
          </StaggerItem>
        )
      })}
    </StaggerGroup>
  )
}
