'use client'

/**
 * DepartureChip — the atom every calendar surface is built from.
 *
 * Two shapes share one visual language:
 *   • `chip`  — a single dense line for month cells and popovers.
 *   • `block` — an absolutely-positioned card for the week/day time grids.
 *
 * Colour comes from the activity's `colorKey`, injected as a single custom
 * property (`--evt`) so every tint, border, rail and ink shade derives from one
 * source. Text ink is mixed against `--fg`, which means it darkens on the light
 * theme and lightens on the dark one without a single `dark:` text override.
 */

import * as React from 'react'
import { CloudRain, Lock, Ban } from 'lucide-react'

import { cn, formatTime, fillRate as toFillRate } from '@/lib/utils'
import type { CalendarEvent } from '@/lib/demo'
import type { Activity, Departure } from '@/types'

/* ==========================================================================
   PALETTE
   ========================================================================== */

export type EventColorKey = Activity['colorKey']

/**
 * One class per colour key, defining `--evt`. Brand ramps step brighter on the
 * dark theme so a 1px rail keeps its presence on both grounds; the semantic
 * tokens already flip themselves.
 */
export const EVENT_VAR: Record<EventColorKey, string> = {
  lagoon: '[--evt:var(--color-lagoon-600)] dark:[--evt:var(--color-lagoon-400)]',
  coral: '[--evt:var(--color-coral-600)] dark:[--evt:var(--color-coral-400)]',
  sunset: '[--evt:var(--color-sunset-600)] dark:[--evt:var(--color-sunset-400)]',
  reef: '[--evt:var(--color-reef-600)] dark:[--evt:var(--color-reef-400)]',
  info: '[--evt:var(--info)]',
  success: '[--evt:var(--success)]',
}

/** Fill, border and ink derived from whatever `--evt` currently resolves to. */
export const EVENT_TINT = 'bg-[color:color-mix(in_oklab,var(--evt)_12%,transparent)]'
export const EVENT_TINT_STRONG = 'bg-[color:color-mix(in_oklab,var(--evt)_20%,transparent)]'
export const EVENT_BORDER = 'border-[color-mix(in_oklab,var(--evt)_28%,transparent)]'
export const EVENT_INK = 'text-[color:color-mix(in_oklab,var(--evt)_50%,var(--fg))]'
export const EVENT_SOLID = 'bg-[color:var(--evt)]'

export function eventVar(colorKey: EventColorKey) {
  return EVENT_VAR[colorKey] ?? EVENT_VAR.lagoon
}

/* ==========================================================================
   DERIVED FIGURES
   Shared by the agenda rows, the day rail and the detail sheet so a departure
   is never valued two different ways on two different surfaces.
   ========================================================================== */

// Revenue/paid live on CalendarEvent (folded in server-side) — see @/lib/demo toCalendarEvent.

export function departureMinutes(departure: Departure) {
  const start = new Date(departure.startsAt).getTime()
  const end = new Date(departure.endsAt).getTime()
  return Math.max(15, Math.round((end - start) / 60_000))
}

/* ==========================================================================
   STATUS TREATMENT
   ========================================================================== */

type Treatment = 'normal' | 'cancelled' | 'weather' | 'sold_out'

function treatmentFor(departure: Departure): Treatment {
  if (departure.status === 'cancelled') return 'cancelled'
  if (departure.status === 'weather_hold') return 'weather'
  if (departure.status === 'sold_out') return 'sold_out'
  return 'normal'
}

const WEATHER_SHELL = cn(
  'border-[color-mix(in_oklab,var(--warning)_38%,transparent)]',
  'bg-[color:color-mix(in_oklab,var(--warning)_14%,transparent)]',
  'text-[color:color-mix(in_oklab,var(--warning)_52%,var(--fg))]',
)

const CANCELLED_SHELL = cn(
  'border-dashed border-line-strong bg-surface-sunken text-faint',
)

/** Sold out keeps the activity's hue but reads denser, with an inset hairline. */
const SOLD_OUT_RING =
  'ring-1 ring-inset ring-[color:color-mix(in_oklab,var(--evt)_45%,transparent)]'

/* ==========================================================================
   CHIP
   ========================================================================== */

export interface DepartureChipProps extends Omit<React.ComponentProps<'button'>, 'onSelect'> {
  event: CalendarEvent
  /** `chip` for month cells and lists, `block` for the time grids. */
  variant?: 'chip' | 'block'
  onSelect?: (departureId: string) => void
  /** Block height in px — drives how much metadata survives. */
  heightPx?: number
  /** Hide the seat counter on very narrow month cells. */
  hideSeats?: boolean
}

export function DepartureChip({
  event,
  variant = 'chip',
  onSelect,
  heightPx,
  hideSeats = false,
  className,
  style,
  ...props
}: DepartureChipProps) {
  const { departure, activity, seatsLeft } = event
  const treatment = treatmentFor(departure)
  const percent = toFillRate(departure.booked, departure.capacity)
  const time = formatTime(departure.startsAt)
  const soldOut = treatment === 'sold_out' || seatsLeft <= 0
  const cancelled = treatment === 'cancelled'

  const shell =
    treatment === 'cancelled'
      ? CANCELLED_SHELL
      : treatment === 'weather'
        ? WEATHER_SHELL
        : treatment === 'sold_out'
          ? cn(EVENT_TINT_STRONG, EVENT_BORDER, EVENT_INK, SOLD_OUT_RING)
          : cn(EVENT_TINT, EVENT_BORDER, EVENT_INK)

  const accessibleName = `${time} · ${activity.name} · ${departure.booked} of ${departure.capacity} seats booked${
    cancelled ? ' · cancelled' : soldOut ? ' · sold out' : ''
  }`

  /* ---------------------------------------------------------------- chip -- */
  if (variant === 'chip') {
    return (
      <button
        type="button"
        title={accessibleName}
        aria-label={accessibleName}
        onClick={() => onSelect?.(departure.id)}
        style={style}
        className={cn(
          'group/chip relative flex w-full items-center gap-1.5 overflow-hidden rounded-md border',
          'px-1.5 py-[3px] text-left text-[0.6875rem] leading-tight',
          'transition-all duration-200 ease-[var(--ease-out-expo)]',
          'hover:-translate-y-px hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1',
          'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
          eventVar(activity.colorKey),
          shell,
          className,
        )}
        {...props}
      >
        <span
          aria-hidden="true"
          className={cn(
            'h-3 w-[3px] shrink-0 rounded-full',
            cancelled ? 'bg-line-strong' : treatment === 'weather' ? 'bg-warning' : EVENT_SOLID,
          )}
        />
        <span className="tabular shrink-0 font-semibold opacity-90">{time}</span>
        <span className={cn('min-w-0 flex-1 truncate font-medium', cancelled && 'line-through')}>
          {activity.name}
        </span>

        {treatment === 'weather' ? (
          <CloudRain aria-hidden="true" className="size-3 shrink-0" />
        ) : cancelled ? (
          <Ban aria-hidden="true" className="size-3 shrink-0" />
        ) : !hideSeats ? (
          <span className="tabular shrink-0 text-[0.625rem] font-semibold opacity-75">
            {soldOut ? 'Full' : `${departure.booked}/${departure.capacity}`}
          </span>
        ) : null}
      </button>
    )
  }

  /* --------------------------------------------------------------- block -- */
  const height = heightPx ?? 64
  const tight = height < 46
  const roomy = height >= 74

  return (
    <button
      type="button"
      title={accessibleName}
      aria-label={accessibleName}
      onClick={() => onSelect?.(departure.id)}
      style={style}
      className={cn(
        'group/block absolute flex flex-col overflow-hidden rounded-lg border text-left',
        'transition-all duration-200 ease-[var(--ease-out-expo)]',
        'hover:z-20 hover:-translate-y-px hover:shadow-lg',
        'focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-1',
        'motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        tight ? 'gap-0 px-1.5 py-0.5' : 'gap-0.5 px-2 py-1.5',
        eventVar(activity.colorKey),
        shell,
        className,
      )}
      {...props}
    >
      {/* Left rail — the fastest read of "which activity is this". */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-0 left-0 w-[3px]',
          cancelled ? 'bg-line-strong' : treatment === 'weather' ? 'bg-warning' : EVENT_SOLID,
        )}
      />

      <span className={cn('flex items-center gap-1.5', tight && 'min-w-0')}>
        <span className="tabular shrink-0 text-[0.6875rem] font-semibold opacity-90">{time}</span>
        {treatment === 'weather' ? (
          <CloudRain aria-hidden="true" className="size-3 shrink-0" />
        ) : null}
        {soldOut && !cancelled && treatment !== 'weather' ? (
          <Lock aria-hidden="true" className="size-3 shrink-0" />
        ) : null}
        {tight ? (
          <span className={cn('min-w-0 flex-1 truncate text-[0.6875rem] font-medium', cancelled && 'line-through')}>
            {activity.name}
          </span>
        ) : null}
      </span>

      {!tight ? (
        <span
          className={cn(
            'line-clamp-2 text-[0.75rem] leading-[1.2] font-semibold tracking-[-0.01em]',
            cancelled && 'line-through',
          )}
        >
          {activity.name}
        </span>
      ) : null}

      {roomy ? (
        <span className="tabular flex items-center gap-1.5 text-[0.625rem] font-medium opacity-80">
          <span>
            {departure.booked}/{departure.capacity} seats
          </span>
          {!cancelled ? (
            <span className="opacity-70">{soldOut ? 'sold out' : `${seatsLeft} left`}</span>
          ) : (
            <span className="opacity-70">cancelled</span>
          )}
        </span>
      ) : null}

      {/* Capacity fill — a hairline so it reads at 22px of block height. */}
      {!cancelled ? (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[3px] bg-[color:color-mix(in_oklab,var(--fg)_8%,transparent)]"
        >
          <span
            className={cn(
              'block h-full rounded-r-full',
              treatment === 'weather' ? 'bg-warning' : EVENT_SOLID,
            )}
            style={{ width: `${percent}%` }}
          />
        </span>
      ) : null}
    </button>
  )
}
