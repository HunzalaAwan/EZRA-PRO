'use client'

import { CalendarCheck2, Gauge, Users, Wallet, type LucideIcon } from 'lucide-react'

import { Reveal } from '@/components/motion/reveal'
import { cn } from '@/lib/utils'
import type { CurrencyCode, KpiMetric } from '@/types'
import { KpiCard, type MiniTrendKind } from './kpi-card'

/* ==========================================================================
   KpiRow — the four numbers the overview opens with.

   Owns the icon and mini-chart choice per metric so the page can stay a
   Server Component (component references cannot cross that boundary).
   Money and guests read as a line; counts and rates read as bars.
   ========================================================================== */

const LEAD_KEYS = ['net_revenue', 'bookings', 'guests', 'occupancy'] as const

const LOOK: Record<(typeof LEAD_KEYS)[number], { icon: LucideIcon; trend: MiniTrendKind }> = {
  net_revenue: { icon: Wallet, trend: 'area' },
  bookings: { icon: CalendarCheck2, trend: 'bars' },
  guests: { icon: Users, trend: 'area' },
  occupancy: { icon: Gauge, trend: 'bars' },
}

export interface KpiRowProps {
  kpis: KpiMetric[]
  currency: CurrencyCode
  className?: string
}

export function KpiRow({ kpis, currency, className }: KpiRowProps) {
  const byKey = new Map(kpis.map((k) => [k.key, k]))
  const lead = LEAD_KEYS.map((key) => {
    const metric = byKey.get(key)
    return metric ? { key, metric, ...LOOK[key] } : null
  }).filter((m): m is NonNullable<typeof m> => m !== null)

  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
      {lead.map((item, i) => (
        <Reveal key={item.key} delay={i * 0.06} distance={14} className="min-w-0">
          <KpiCard
            metric={item.metric}
            currency={currency}
            icon={item.icon}
            trend={item.trend}
            hero={item.key === 'net_revenue'}
            className="h-full"
          />
        </Reveal>
      ))}
    </div>
  )
}
