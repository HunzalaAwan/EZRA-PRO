'use client'

import { ChevronRight } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatCurrency, formatPercent } from '@/lib/utils'
import type { ChannelBreakdown, CurrencyCode } from '@/types'
import { CHANNEL_TONE, DeltaPill } from './overview-cards'

/* ==========================================================================
   ChannelMixCard — the three biggest channels as headline shares, the whole
   mix as one strip, and the numbers underneath.
   ========================================================================== */

export interface ChannelMixCardProps {
  channels: ChannelBreakdown[]
  currency: CurrencyCode
  loading?: boolean
  onSeeAll?: () => void
  className?: string
}

export function ChannelMixCard({ channels, currency, loading = false, onSeeAll, className }: ChannelMixCardProps) {
  const ordered = [...channels].sort((a, b) => b.share - a.share)
  const lead = ordered.slice(0, 3)
  const rows = ordered.slice(0, 5)
  const rest = ordered.length - rows.length

  if (loading) {
    return (
      <Card className={cn('p-5', className)}>
        <Skeleton shape="line" className="h-3.5 w-32" />
        <Skeleton shape="block" className="mt-5 h-8 w-full rounded-lg" />
        <Skeleton shape="line" className="mt-5 h-2.5 w-full" />
        <Skeleton shape="line" className="mt-2 h-2.5 w-5/6" />
        <Skeleton shape="line" className="mt-2 h-2.5 w-2/3" />
      </Card>
    )
  }

  return (
    <Card className={cn('flex flex-col p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-[0.9375rem] font-semibold tracking-[-0.015em] text-foreground">Channel mix</h3>
          <p className="mt-0.5 text-xs text-subtle">Net revenue by where the booking came from</p>
        </div>
      </div>

      {/* ---------- headline shares ---------- */}
      <dl className="mt-4 grid grid-cols-3 gap-3">
        {lead.map((channel) => (
          <div key={channel.channel} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[0.6875rem] text-subtle">
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: CHANNEL_TONE[channel.channel] }} />
              <span className="truncate">{channel.label}</span>
            </dt>
            <dd className="mt-1 font-display text-xl font-semibold tracking-[-0.02em] text-foreground tabular-nums">
              {formatPercent(channel.share, 1)}
            </dd>
          </div>
        ))}
      </dl>

      {/* ---------- the whole mix as one strip ---------- */}
      <div className="mt-4 flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Revenue share by channel">
        {ordered.map((channel) => (
          <span
            key={channel.channel}
            title={`${channel.label} · ${formatPercent(channel.share, 1)}`}
            className="h-full rounded-full"
            style={{ width: `${Math.max(1.5, channel.share)}%`, background: CHANNEL_TONE[channel.channel] }}
          />
        ))}
      </div>

      {/* ---------- numbers ---------- */}
      <table className="mt-4 w-full table-fixed text-[0.8125rem]">
        <colgroup>
          <col />
          <col className="w-[4.5rem]" />
          <col className="w-[7.5rem]" />
        </colgroup>
        <thead>
          <tr className="text-[0.6875rem] tracking-[0.08em] text-subtle uppercase">
            <th scope="col" className="pb-2 text-left font-semibold">
              Channel
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              Share
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              Revenue
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {rows.map((channel) => (
            <tr key={channel.channel}>
              <td className="py-2 pr-2">
                <span className="flex min-w-0 items-center gap-2 text-foreground">
                  <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: CHANNEL_TONE[channel.channel] }} />
                  <span className="truncate font-medium">{channel.label}</span>
                </span>
              </td>
              <td className="py-2 text-right text-muted tabular-nums whitespace-nowrap">{formatPercent(channel.share, 1)}</td>
              <td className="py-2 pl-2 text-right whitespace-nowrap">
                <span className="font-semibold text-foreground tabular-nums">{formatCurrency(channel.revenue, currency, { compact: true })}</span>
                <DeltaPill value={channel.deltaPercent} className="ml-1.5" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {onSeeAll ? (
        <button
          type="button"
          onClick={onSeeAll}
          className="mt-3 inline-flex w-fit items-center gap-1 text-xs font-semibold text-primary transition-colors hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {rest > 0 ? `${rest} more ${rest === 1 ? 'channel' : 'channels'}` : 'Channel detail'}
          <ChevronRight aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </Card>
  )
}
