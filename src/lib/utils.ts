import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { CurrencyCode } from '@/types'

/** Tailwind-aware class merge. Used by every component in the system. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ==========================================================================
   DETERMINISTIC RANDOMNESS
   Seeded so server and client render identical values — no hydration drift.
   ========================================================================== */

/** Mulberry32 — small, fast, good enough for demo data. */
export function createRng(seed: number) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Stable 32-bit hash of a string — turns any id into a seed. */
export function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function rngInt(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function rngPick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

export function rngWeighted<T>(rng: () => number, entries: readonly [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let r = rng() * total
  for (const [value, weight] of entries) {
    r -= weight
    if (r <= 0) return value
  }
  return entries[entries.length - 1][0]
}

/* ==========================================================================
   MONEY — all amounts are minor units (cents)
   ========================================================================== */

const CURRENCY_LOCALE: Record<CurrencyCode, string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  AUD: 'en-AU',
  NZD: 'en-NZ',
  CAD: 'en-CA',
}

export function formatCurrency(
  minorUnits: number,
  currency: CurrencyCode = 'USD',
  options: { compact?: boolean; decimals?: boolean } = {},
) {
  const { compact = false, decimals = false } = options
  const value = minorUnits / 100
  return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? 'en-US', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : decimals ? 2 : 0,
    minimumFractionDigits: compact ? 0 : decimals ? 2 : 0,
  }).format(value)
}

/** Currency symbol only — for inline unit labels and axis ticks. */
export function currencySymbol(currency: CurrencyCode = 'USD') {
  return (
    new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? '$'
  )
}

export function formatNumber(value: number, options: { compact?: boolean; decimals?: number } = {}) {
  const { compact = false, decimals = 0 } = options
  return new Intl.NumberFormat('en-US', {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : decimals,
    minimumFractionDigits: compact ? 0 : decimals,
  }).format(value)
}

export function formatPercent(value: number, decimals = 0) {
  return `${value >= 0 ? '' : ''}${value.toFixed(decimals)}%`
}

/** Signed percent for deltas: "+12.4%" / "-3.1%". */
export function formatDelta(value: number, decimals = 1) {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function formatCompactCurrency(minorUnits: number, currency: CurrencyCode = 'USD') {
  return formatCurrency(minorUnits, currency, { compact: true })
}

/* ==========================================================================
   TIME
   ========================================================================== */

export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** "2:30 PM" */
export function formatTime(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(d)
}

/** "Mar 14" */
export function formatDateShort(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d)
}

/** "Fri, Mar 14, 2026" */
export function formatDateLong(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}

/** "Mar 14, 2:30 PM" */
export function formatDateTime(iso: string | Date) {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return `${formatDateShort(d)}, ${formatTime(d)}`
}

/**
 * Relative time from a fixed reference. Pass `now` explicitly on the server
 * to keep SSR and client output identical.
 */
export function formatRelative(iso: string, now: Date) {
  const then = new Date(iso).getTime()
  const diffMs = then - now.getTime()
  const abs = Math.abs(diffMs)
  const rtf = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' })
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  if (abs < min) return 'just now'
  if (abs < hour) return rtf.format(Math.round(diffMs / min), 'minute')
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour')
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), 'day')
  if (abs < 365 * day) return rtf.format(Math.round(diffMs / (30 * day)), 'month')
  return rtf.format(Math.round(diffMs / (365 * day)), 'year')
}

/** "YYYY-MM-DD" in local time — safe for keying calendar cells. */
export function toDateKey(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse "YYYY-MM-DD" as a local-midnight Date (avoids UTC shift bugs). */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(d: Date, n: number) {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

export function addMinutes(d: Date, n: number) {
  return new Date(d.getTime() + n * 60_000)
}

export function startOfDay(d: Date) {
  const next = new Date(d)
  next.setHours(0, 0, 0, 0)
  return next
}

export function endOfDay(d: Date) {
  const next = new Date(d)
  next.setHours(23, 59, 59, 999)
  return next
}

/** Week starts Monday — matches the calendar grid. */
export function startOfWeek(d: Date) {
  const next = startOfDay(d)
  const day = (next.getDay() + 6) % 7
  next.setDate(next.getDate() - day)
  return next
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
}

export function isSameDay(a: Date, b: Date) {
  return toDateKey(a) === toDateKey(b)
}

/** The 42-cell (6x7) grid a month calendar renders. */
export function buildMonthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function minutesSinceMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes()
}

/* ==========================================================================
   STRINGS
   ========================================================================== */

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function titleCase(input: string) {
  return input
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function truncate(input: string, max: number) {
  return input.length <= max ? input : `${input.slice(0, max - 1).trimEnd()}…`
}

export function pluralize(count: number, singular: string, plural?: string) {
  return count === 1 ? singular : (plural ?? `${singular}s`)
}

/* ==========================================================================
   MATH / DATA
   ========================================================================== */

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0)
}

export function average(values: number[]) {
  return values.length === 0 ? 0 : sum(values) / values.length
}

/** Percent change from `previous` to `current`. Guards divide-by-zero. */
export function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100
  return ((current - previous) / Math.abs(previous)) * 100
}

export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K) {
  return items.reduce(
    (acc, item) => {
      const k = key(item)
      ;(acc[k] ||= []).push(item)
      return acc
    },
    {} as Record<K, T[]>,
  )
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

export function sortBy<T>(items: T[], key: (item: T) => number | string, dir: 'asc' | 'desc' = 'asc') {
  return [...items].sort((a, b) => {
    const av = key(a)
    const bv = key(b)
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return dir === 'asc' ? cmp : -cmp
  })
}

/** Build an SVG path for a sparkline from raw values. */
export function sparklinePath(values: number[], width: number, height: number, pad = 1) {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const stepX = (width - pad * 2) / Math.max(values.length - 1, 1)
  return values
    .map((v, i) => {
      const x = pad + i * stepX
      const y = pad + (height - pad * 2) * (1 - (v - min) / span)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

/* ==========================================================================
   DOMAIN HELPERS
   ========================================================================== */

/** Seats still sellable on a departure. */
export function seatsRemaining(capacity: number, booked: number, held = 0) {
  return Math.max(0, capacity - booked - held)
}

export function fillRate(booked: number, capacity: number) {
  return capacity === 0 ? 0 : clamp((booked / capacity) * 100, 0, 100)
}

/** Generates a stable, human-friendly confirmation code from an id. */
export function bookingReference(id: string) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const rng = createRng(hashSeed(id))
  const code = Array.from({ length: 5 }, () => alphabet[Math.floor(rng() * alphabet.length)]).join('')
  return `EZR-${code}`
}
