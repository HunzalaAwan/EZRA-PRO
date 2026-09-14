/**
 * EZRA PRO — seed data constants.
 *
 * Everything time-related in this product hangs off {@link NOW}. The demo has to
 * render identically on the server and on the client (and identically on every
 * reload), so nothing anywhere may read the wall clock. Import NOW instead of
 * calling `new Date()` and the whole app stays hydration-safe and screenshot-stable.
 */

import { toDateKey } from '@/lib/utils'

/**
 * The fixed "now" for the entire application.
 *
 * Friday 11 September 2026, 09:00 local — deliberately mid-morning on a weekday
 * so the operations screens open with departures already completed, one in
 * progress, and a full afternoon still ahead.
 *
 * No timezone suffix: it is parsed in the runtime's local zone, which keeps
 * calendar-cell keys aligned with the dates users see.
 */
export const NOW = new Date('2026-09-11T09:00:00')

/** "2026-09-11" — the key every calendar surface treats as today. */
export const TODAY_KEY = toDateKey(NOW)

/** NOW as an ISO string, for entity fields that store timestamps as text. */
export const NOW_ISO = NOW.toISOString()

/* ==========================================================================
   TENANCY
   ========================================================================== */

/** Blue Horizon Watersports — the tenant every unauthenticated demo lands on. */
export const DEFAULT_TENANT_SLUG = 'blue-horizon'
export const DEFAULT_TENANT_ID = 'tnt_bluehorizon'

/* ==========================================================================
   PLATFORM
   ========================================================================== */

export const PLATFORM_NAME = 'EZRA Pro'
export const PLATFORM_DOMAIN = 'ezra.pro'
export const SUPPORT_EMAIL = 'support@ezra.pro'

/* ==========================================================================
   DATA HORIZON
   Generators downstream (departures, bookings, analytics) fan out from NOW by
   these amounts. Keeping the window here means one place controls how much
   history the charts have and how far the calendar can be paged forward.
   ========================================================================== */

/** Days of history synthesised behind NOW (≈13 months, so YoY deltas work). */
export const HISTORY_DAYS = 400
/** Days of future inventory synthesised ahead of NOW. */
export const FUTURE_DAYS = 90

/** Operating window the calendar day/week grids render, in local hours. */
export const DAY_START_HOUR = 5
export const DAY_END_HOUR = 22

/* ==========================================================================
   SEEDING
   ========================================================================== */

/**
 * Namespace prefixed onto every RNG seed string. Bumping it reshuffles all
 * generated data at once without touching call sites.
 */
export const SEED_NAMESPACE = 'ezra-pro-v1'

/** Build a namespaced seed key: `seedKey('bookings', activityId)`. */
export function seedKey(...parts: (string | number)[]): string {
  return [SEED_NAMESPACE, ...parts].join(':')
}

/* ==========================================================================
   MEDIA
   ========================================================================== */

/**
 * Unsplash delivery URL. Centralised so image sizing/quality can be tuned in one
 * place — activity galleries, tenant covers and OG images all route through it.
 */
export function unsplashUrl(photoId: string, width = 1600, quality = 80): string {
  return `https://images.unsplash.com/photo-${photoId}?auto=format&fit=crop&w=${width}&q=${quality}`
}

/** Deterministic avatar for demo people. `n` must be stable per person. */
export function avatarUrl(n: number, size = 160): string {
  return `https://i.pravatar.cc/${size}?img=${n}`
}
