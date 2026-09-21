'use client'

import * as React from 'react'

import { cn, formatNumber } from '@/lib/utils'

export { guestName, clock, minutesBetween, shortDuration } from './format'

/* ==========================================================================
   Shared pieces for the hospitality screens — the same calm grammar as the
   rest of the dashboard: one type size, at most one weight, a dot and a
   word for status, numbers in tabular figures.
   ========================================================================== */

export function Dot({ tone, className }: { tone: string; className?: string }) {
  return <span aria-hidden="true" className={cn('inline-block size-1.5 shrink-0 rounded-full', tone, className)} />
}

export function StatusWord({ label, tone, className, title }: { label: string; tone: string; className?: string; title?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap text-[0.8125rem] text-muted', className)} title={title}>
      <Dot tone={tone} />
      {label}
    </span>
  )
}

export interface StatTileProps {
  label: string
  hint?: string
  value: string | number
  line?: string
  tone?: string
  active?: boolean
  onClick?: () => void
  className?: string
}

/** A quiet number. Clickable when it doubles as a filter. */
export function StatTile({ label, hint, value, line, tone, active = false, onClick, className }: StatTileProps) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-[0.8125rem] text-muted">
        {tone ? <span aria-hidden="true" className={cn('size-2 rounded-full', tone)} /> : null}
        <span className="font-medium text-foreground">{label}</span>
        {hint ? <span className="truncate text-subtle">· {hint}</span> : null}
      </span>
      <span className="mt-3 text-[1.75rem] leading-none font-medium tracking-tight text-foreground tabular-nums">
        {typeof value === 'number' ? formatNumber(value) : value}
      </span>
      {line ? <span className="mt-2 text-xs text-muted tabular-nums">{line}</span> : null}
    </>
  )
  const classes = cn(
    'flex min-w-0 flex-col rounded-2xl border p-4 text-left',
    onClick && 'transition-[border-color,background-color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
    active ? 'border-primary/50 bg-primary-soft/40' : 'border-line bg-surface',
    onClick && !active && 'hover:border-line-strong',
    className,
  )
  if (onClick) {
    return (
      <button type="button" aria-pressed={active} onClick={onClick} className={classes}>
        {body}
      </button>
    )
  }
  return <div className={classes}>{body}</div>
}

/** Small grey band header for grouped lists. */
export function BandHeader({ title, right }: { title: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-muted">{title}</span>
      {right ? <span className="hidden text-xs text-faint tabular-nums sm:inline">{right}</span> : null}
    </div>
  )
}

export function Stepper({ value, min = 1, max = 20, onChange, label }: { value: number; min?: number; max?: number; onChange: (value: number) => void; label: string }) {
  return (
    <div className="inline-flex h-9 items-center rounded-lg border border-line bg-surface" role="group" aria-label={label}>
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className="grid size-9 place-items-center text-muted disabled:opacity-40">
        −
      </button>
      <span className="min-w-[2rem] text-center text-sm text-foreground tabular-nums">{value}</span>
      <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className="grid size-9 place-items-center text-muted disabled:opacity-40">
        +
      </button>
    </div>
  )
}
