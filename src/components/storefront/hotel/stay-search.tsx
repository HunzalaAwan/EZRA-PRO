'use client'

import * as React from 'react'
import { CalendarDays, Minus, Plus, Search, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStaySearch } from '@/hooks/use-stay-search'
import { nightKeys } from '@/lib/hospitality/lodging-settings'
import { cn } from '@/lib/utils'

/* ==========================================================================
   <StaySearch> — check-in, check-out, guests. Lives in the hero and again
   above the rooms; both edit the same remembered search.
   ========================================================================== */

export function StaySearch({ slug, todayKey, onDark = false, cta = true, className }: { slug: string; todayKey: string; onDark?: boolean; cta?: boolean; className?: string }) {
  const { search, update } = useStaySearch(slug, todayKey)
  const nights = nightKeys(search.checkIn, search.checkOut).length

  const counter = (label: string, value: number, min: number, max: number, onChange: (v: number) => void) => (
    <span className={cn('inline-flex h-11 items-center rounded-lg border', onDark ? 'border-white/20 bg-white/10 text-white' : 'border-line bg-surface text-foreground')}>
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} className="grid size-11 place-items-center disabled:opacity-40" onClick={() => onChange(value - 1)}>
        <Minus className="size-4" />
      </button>
      <span className="min-w-[4.5rem] text-center text-sm tabular-nums">
        {value} {label}
      </span>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} className="grid size-11 place-items-center disabled:opacity-40" onClick={() => onChange(value + 1)}>
        <Plus className="size-4" />
      </button>
    </span>
  )

  return (
    <div className={cn('flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-end sm:gap-2', onDark ? 'bg-white/10 backdrop-blur-md ring-1 ring-white/15' : 'border border-line bg-surface shadow-sm', className)}>
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn('px-1 text-[0.6875rem] font-medium uppercase tracking-[0.1em]', onDark ? 'text-white/60' : 'text-subtle')}>Check-in</span>
        <Input type="date" min={todayKey} value={search.checkIn} onChange={(e) => e.target.value && update({ checkIn: e.target.value, checkOut: e.target.value >= search.checkOut ? nightKeys(e.target.value, search.checkOut).length === 0 ? shiftKey(e.target.value, 2) : search.checkOut : search.checkOut })} leftIcon={<CalendarDays />} aria-label="Check-in" className={onDark ? 'border-white/20 bg-white/10 text-white [&_input]:text-white' : undefined} />
      </label>
      <label className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn('px-1 text-[0.6875rem] font-medium uppercase tracking-[0.1em]', onDark ? 'text-white/60' : 'text-subtle')}>Check-out · {nights} {nights === 1 ? 'night' : 'nights'}</span>
        <Input type="date" min={shiftKey(search.checkIn, 1)} value={search.checkOut} onChange={(e) => e.target.value && e.target.value > search.checkIn && update({ checkOut: e.target.value })} leftIcon={<CalendarDays />} aria-label="Check-out" className={onDark ? 'border-white/20 bg-white/10 text-white [&_input]:text-white' : undefined} />
      </label>
      <div className="flex flex-col gap-1">
        <span className={cn('px-1 text-[0.6875rem] font-medium uppercase tracking-[0.1em]', onDark ? 'text-white/60' : 'text-subtle')}>
          <Users className="mr-1 inline size-3" aria-hidden="true" />
          Guests
        </span>
        <div className="flex gap-2">
          {counter('adults', search.adults, 1, 4, (v) => update({ adults: v }))}
          {counter('children', search.children, 0, 3, (v) => update({ children: v }))}
        </div>
      </div>
      {cta ? (
        <Button asChild size="lg" leftIcon={<Search aria-hidden="true" />} className="sm:self-end">
          <a href="#rooms">See rooms</a>
        </Button>
      ) : null}
    </div>
  )
}

function shiftKey(dateKey: string, days: number) {
  const d = new Date(`${dateKey}T12:00:00`)
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
