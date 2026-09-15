/**
 * EZRA PRO — CHEAP DEMO CONSTANTS
 * =============================================================================
 * The small, instantly-computed slice of the demo seam: tenants, users,
 * resources and the activity catalog (well under 100 records total). No
 * departure/booking/customer/payment generation happens in this module.
 *
 * WHY THIS FILE EXISTS: `@/lib/demo` generates the full operational dataset
 * (thousands of departures, bookings, customers, payments) unconditionally
 * at module load — that is unavoidable in a single JS module, since importing
 * ANY export forces the ENTIRE top-level module body to run first, however
 * cheap that one export is. A 'use client' component that only needs
 * `CURRENT_TENANT` or `NOW` was, before this split, bundling and re-running
 * that entire generation in the browser on every page load.
 *
 * `@/lib/demo` re-exports everything here, so existing imports from it are
 * unaffected. Components that only need the constants below should import
 * from THIS module instead, to keep the heavy dataset out of their bundle.
 * =============================================================================
 */

import type {
  Activity,
  ActivityFeedItem,
  ActivityMedia,
  ActivityPerformance,
  ActivityStatus,
  AddOn,
  AnalyticsSnapshot,
  Booking,
  BookingChannel,
  BookingLineItem,
  BookingStatus,
  ChannelBreakdown,
  CohortRow,
  CurrencyCode,
  Customer,
  Departure,
  DepartureStatus,
  DifficultyLevel,
  FunnelStage,
  GeoSource,
  HeatmapCell,
  Insight,
  KpiMetric,
  NotificationItem,
  Participant,
  Payment,
  PaymentStatus,
  PlanTier,
  PriceTier,
  PricingModel,
  RangePreset,
  Resource,
  Session,
  Tenant,
  TenantFeatures,
  TimeSeriesPoint,
  TrendDirection,
  User,
  WeatherSnapshot,
} from '@/types'

import {
  addDays,
  average,
  bookingReference,
  clamp,
  createRng,
  fillRate,
  formatCurrency,
  formatNumber,
  hashSeed,
  percentChange,
  rngInt,
  rngPick,
  rngWeighted,
  seatsRemaining,
  startOfDay,
  startOfMonth,
  sum,
  toDateKey,
} from '@/lib/utils'

/* ==========================================================================
   TIME — the fixed "now" every screen renders against
   ========================================================================== */

/** The frozen clock for the whole demo. Never call `new Date()` without args. */
export const NOW = new Date('2026-09-11T09:00:00')

/** "2026-09-11" — today's calendar key. */
export const TODAY_KEY = toDateKey(NOW)

export const NOW_MS = NOW.getTime()
export const DAY_MS = 86_400_000

export const pad2 = (n: number) => (n < 10 ? `0${n}` : `${n}`)

/** Local ISO datetime, no timezone suffix — parses back to the same wall clock. */
export function isoLocal(d: Date): string {
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  )
}

export function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0)
  return d
}

/** 0=Mon … 6=Sun — matches HeatmapCell.weekday and the calendar grid. */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

export function round(n: number): number {
  return Math.round(n)
}

/* ==========================================================================
   TENANTS
   ========================================================================== */

const PLAN_RANK: Record<PlanTier, number> = { starter: 0, growth: 1, scale: 2, enterprise: 3 }

function featuresFor(plan: PlanTier): TenantFeatures {
  const t = PLAN_RANK[plan]
  return {
    advancedAnalytics: t >= 1,
    resourceScheduling: t >= 1,
    multiLocation: t >= 2,
    apiAccess: t >= 2,
    customBranding: t >= 1,
    waitlists: t >= 1,
    dynamicPricing: t >= 2,
    channelManager: t >= 2,
    giftCards: t >= 1,
    memberships: t >= 3,
  }
}

export const TENANTS: Tenant[] = [
  {
    id: 'tnt_bluehorizon',
    slug: 'blue-horizon',
    name: 'Blue Horizon Watersports',
    legalName: 'Blue Horizon Watersports LLC',
    vertical: 'watersports',
    plan: 'growth',
    status: 'active',
    currency: 'USD',
    timezone: 'Pacific/Honolulu',
    locale: 'en-US',
    country: 'United States',
    city: 'Maui, HI',
    createdAt: '2021-03-08T08:00:00',
    branding: {
      primaryColor: '#0E7C86',
      accentColor: '#FF6B4A',
      logoText: 'Blue Horizon',
      coverImage:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2000&q=80',
    },
    features: featuresFor('growth'),
    stats: {
      monthlyBookings: 0,
      monthlyRevenue: 0,
      activeActivities: 0,
      teamSize: 0,
      avgRating: 0,
      reviewCount: 0,
    },
    contact: {
      email: 'aloha@bluehorizonmaui.com',
      phone: '+1 (808) 555-0164',
      website: 'https://bluehorizonmaui.com',
      addressLine: '101 Maalaea Boat Harbor Rd, Wailuku, HI 96793',
    },
  },
  {
    id: 'tnt_coralcay',
    slug: 'coral-cay',
    name: 'Coral Cay Expeditions',
    legalName: 'Coral Cay Expeditions Pty Ltd',
    vertical: 'island',
    plan: 'scale',
    status: 'active',
    currency: 'AUD',
    timezone: 'Australia/Brisbane',
    locale: 'en-AU',
    country: 'Australia',
    city: 'Cairns, QLD',
    createdAt: '2019-08-21T08:00:00',
    branding: {
      primaryColor: '#1B6FA8',
      accentColor: '#F59E4B',
      logoText: 'Coral Cay',
      coverImage:
        'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=2000&q=80',
    },
    features: featuresFor('scale'),
    stats: {
      monthlyBookings: 0,
      monthlyRevenue: 0,
      activeActivities: 0,
      teamSize: 0,
      avgRating: 0,
      reviewCount: 0,
    },
    contact: {
      email: 'reef@coralcayexpeditions.com.au',
      phone: '+61 7 4055 0188',
      website: 'https://coralcayexpeditions.com.au',
      addressLine: 'Marlin Marina, Berth C7, Cairns QLD 4870',
    },
  },
  {
    id: 'tnt_saltline',
    slug: 'saltline',
    name: 'Saltline Kitchen & Terrace',
    legalName: 'Saltline Hospitality Single Member P.C.',
    vertical: 'restaurants',
    plan: 'starter',
    status: 'trialing',
    currency: 'EUR',
    timezone: 'Europe/Athens',
    locale: 'el-GR',
    country: 'Greece',
    city: 'Santorini',
    createdAt: '2024-02-14T08:00:00',
    branding: {
      primaryColor: '#1E4E8C',
      accentColor: '#E8743B',
      logoText: 'Saltline',
      coverImage:
        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=2000&q=80',
    },
    features: featuresFor('starter'),
    stats: {
      monthlyBookings: 0,
      monthlyRevenue: 0,
      activeActivities: 0,
      teamSize: 0,
      avgRating: 0,
      reviewCount: 0,
    },
    contact: {
      email: 'reservations@saltline.gr',
      phone: '+30 2286 055 019',
      website: 'https://saltline.gr',
      addressLine: 'Caldera Path 14, Oia 847 02, Santorini',
    },
  },
  {
    id: 'tnt_ridgeline',
    slug: 'ridgeline',
    name: 'Ridgeline Adventure Co.',
    legalName: 'Ridgeline Adventure Company Limited',
    vertical: 'adventure',
    plan: 'enterprise',
    status: 'active',
    currency: 'NZD',
    timezone: 'Pacific/Auckland',
    locale: 'en-NZ',
    country: 'New Zealand',
    city: 'Queenstown',
    createdAt: '2017-11-02T08:00:00',
    branding: {
      primaryColor: '#2A6B54',
      accentColor: '#D9622B',
      logoText: 'Ridgeline',
      coverImage:
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2000&q=80',
    },
    features: featuresFor('enterprise'),
    stats: {
      monthlyBookings: 0,
      monthlyRevenue: 0,
      activeActivities: 0,
      teamSize: 0,
      avgRating: 0,
      reviewCount: 0,
    },
    contact: {
      email: 'basecamp@ridgelineadventure.co.nz',
      phone: '+64 3 442 0177',
      website: 'https://ridgelineadventure.co.nz',
      addressLine: '18 Shotover Street, Queenstown 9300',
    },
  },
]

export const tenantById = new Map(TENANTS.map((t) => [t.id, t]))
export const tenantBySlug = new Map(TENANTS.map((t) => [t.slug, t]))

export const CURRENT_TENANT = TENANTS[0]

export function getTenantBySlug(slug: string): Tenant | undefined {
  return tenantBySlug.get(slug)
}

/** Sales-tax / VAT rate applied to bookings, per tenant. */
export const TAX_RATE: Record<string, number> = {
  tnt_bluehorizon: 0.04712,
  tnt_coralcay: 0.1,
  tnt_saltline: 0.13,
  tnt_ridgeline: 0.15,
}

/* ==========================================================================
   USERS
   ========================================================================== */

export function av(n: number) {
  return `https://i.pravatar.cc/160?img=${n}`
}

export const USERS: User[] = [
  /* ---- Blue Horizon Watersports (10) ---- */
  {
    id: 'usr_bh_owner',
    tenantId: 'tnt_bluehorizon',
    name: 'Kaimana Reyes',
    email: 'kaimana@bluehorizonmaui.com',
    role: 'owner',
    avatarUrl: av(12),
    title: 'Founder & Owner',
    phone: '+1 (808) 555-0101',
    status: 'active',
    lastActiveAt: '2026-09-11T08:41:00',
    isBookable: false,
    certifications: ['USCG Master 100GT', 'Hawaii Ocean Safety'],
  },
  {
    id: 'usr_bh_ops',
    tenantId: 'tnt_bluehorizon',
    name: 'Priya Raghunathan',
    email: 'priya@bluehorizonmaui.com',
    role: 'admin',
    avatarUrl: av(5),
    title: 'Operations Director',
    phone: '+1 (808) 555-0102',
    status: 'active',
    lastActiveAt: '2026-09-11T08:52:00',
    isBookable: false,
  },
  {
    id: 'usr_bh_fleet',
    tenantId: 'tnt_bluehorizon',
    name: 'Diego Salcedo',
    email: 'diego@bluehorizonmaui.com',
    role: 'manager',
    avatarUrl: av(13),
    title: 'Fleet & Scheduling Manager',
    phone: '+1 (808) 555-0103',
    status: 'active',
    lastActiveAt: '2026-09-11T07:18:00',
    isBookable: true,
    certifications: ['USCG Master 50GT', 'Marine Diesel Level 2'],
  },
  {
    id: 'usr_bh_guest',
    tenantId: 'tnt_bluehorizon',
    name: 'Amelia Okonkwo',
    email: 'amelia@bluehorizonmaui.com',
    role: 'manager',
    avatarUrl: av(20),
    title: 'Guest Experience Manager',
    phone: '+1 (808) 555-0104',
    status: 'active',
    lastActiveAt: '2026-09-10T19:04:00',
    isBookable: false,
  },
  {
    id: 'usr_bh_cap_hale',
    tenantId: 'tnt_bluehorizon',
    name: 'Hale Kahananui',
    email: 'hale@bluehorizonmaui.com',
    role: 'staff',
    avatarUrl: av(33),
    title: 'Head Captain',
    phone: '+1 (808) 555-0105',
    status: 'active',
    lastActiveAt: '2026-09-11T06:02:00',
    isBookable: true,
    certifications: ['USCG Master 100GT', 'PADI Rescue Diver', 'Wilderness First Responder'],
  },
  {
    id: 'usr_bh_cap_marisol',
    tenantId: 'tnt_bluehorizon',
    name: 'Marisol Quintero',
    email: 'marisol@bluehorizonmaui.com',
    role: 'staff',
    avatarUrl: av(45),
    title: 'Captain, M/V Kaimana Sky',
    phone: '+1 (808) 555-0106',
    status: 'active',
    lastActiveAt: '2026-09-11T05:47:00',
    isBookable: true,
    certifications: ['USCG Master 50GT', 'AHA CPR/AED'],
  },
  {
    id: 'usr_bh_guide_tui',
    tenantId: 'tnt_bluehorizon',
    name: 'Tui Faletau',
    email: 'tui@bluehorizonmaui.com',
    role: 'guide',
    avatarUrl: av(52),
    title: 'PADI Divemaster',
    phone: '+1 (808) 555-0107',
    status: 'active',
    lastActiveAt: '2026-09-10T21:33:00',
    isBookable: true,
    certifications: ['PADI Divemaster #418822', 'EFR Instructor', 'Nitrox'],
  },
  {
    id: 'usr_bh_guide_noe',
    tenantId: 'tnt_bluehorizon',
    name: 'Noelani Kealoha',
    email: 'noelani@bluehorizonmaui.com',
    role: 'guide',
    avatarUrl: av(26),
    title: 'Lead Snorkel Guide & Naturalist',
    phone: '+1 (808) 555-0108',
    status: 'active',
    lastActiveAt: '2026-09-11T07:55:00',
    isBookable: true,
    certifications: ['NAUI Skin Diving Leader', 'Hawaii Marine Naturalist'],
  },
  {
    id: 'usr_bh_res_sofia',
    tenantId: 'tnt_bluehorizon',
    name: 'Sofia Marchetti',
    email: 'sofia@bluehorizonmaui.com',
    role: 'staff',
    avatarUrl: av(47),
    title: 'Reservations Lead',
    phone: '+1 (808) 555-0109',
    status: 'active',
    lastActiveAt: '2026-09-11T08:58:00',
    isBookable: false,
  },
  {
    id: 'usr_bh_guide_ren',
    tenantId: 'tnt_bluehorizon',
    name: 'Ren Takahashi',
    email: 'ren@bluehorizonmaui.com',
    role: 'guide',
    avatarUrl: av(60),
    title: 'Surf & SUP Instructor',
    phone: '+1 (808) 555-0110',
    status: 'active',
    lastActiveAt: '2026-09-10T17:12:00',
    isBookable: true,
    certifications: ['ISA Level 2 Surf Coach', 'Lifeguard / CPR'],
  },

  /* ---- Coral Cay Expeditions (4) ---- */
  {
    id: 'usr_cc_owner',
    tenantId: 'tnt_coralcay',
    name: 'Harriet Nguyen',
    email: 'harriet@coralcayexpeditions.com.au',
    role: 'owner',
    avatarUrl: av(9),
    title: 'Managing Director',
    phone: '+61 7 4055 0101',
    status: 'active',
    lastActiveAt: '2026-09-11T06:30:00',
    isBookable: false,
  },
  {
    id: 'usr_cc_ops',
    tenantId: 'tnt_coralcay',
    name: 'Joshua Baptiste',
    email: 'josh@coralcayexpeditions.com.au',
    role: 'manager',
    avatarUrl: av(15),
    title: 'Reef Operations Manager',
    phone: '+61 7 4055 0102',
    status: 'active',
    lastActiveAt: '2026-09-11T05:12:00',
    isBookable: true,
  },
  {
    id: 'usr_cc_guide_anika',
    tenantId: 'tnt_coralcay',
    name: 'Anika Rajan',
    email: 'anika@coralcayexpeditions.com.au',
    role: 'guide',
    avatarUrl: av(29),
    title: 'Marine Biologist & Dive Guide',
    phone: '+61 7 4055 0103',
    status: 'active',
    lastActiveAt: '2026-09-10T22:40:00',
    isBookable: true,
    certifications: ['SSI Dive Control Specialist', 'Reef Check Surveyor'],
  },
  {
    id: 'usr_cc_skip_callum',
    tenantId: 'tnt_coralcay',
    name: 'Callum Docherty',
    email: 'callum@coralcayexpeditions.com.au',
    role: 'staff',
    avatarUrl: av(51),
    title: 'Skipper, Reef Sprinter',
    phone: '+61 7 4055 0104',
    status: 'active',
    lastActiveAt: '2026-09-11T04:55:00',
    isBookable: true,
    certifications: ['AMSA Master <24m', 'Coxswain Grade 1'],
  },

  /* ---- Saltline Kitchen & Terrace (4) ---- */
  {
    id: 'usr_sl_owner',
    tenantId: 'tnt_saltline',
    name: 'Eleni Marinakis',
    email: 'eleni@saltline.gr',
    role: 'owner',
    avatarUrl: av(32),
    title: 'Proprietor',
    phone: '+30 2286 055 001',
    status: 'active',
    lastActiveAt: '2026-09-11T08:05:00',
    isBookable: false,
  },
  {
    id: 'usr_sl_maitre',
    tenantId: 'tnt_saltline',
    name: 'Dimitris Kalogeras',
    email: 'dimitris@saltline.gr',
    role: 'manager',
    avatarUrl: av(11),
    title: 'Maitre d’Hotel',
    phone: '+30 2286 055 002',
    status: 'active',
    lastActiveAt: '2026-09-11T07:40:00',
    isBookable: true,
  },
  {
    id: 'usr_sl_chef',
    tenantId: 'tnt_saltline',
    name: 'Yannis Petrou',
    email: 'yannis@saltline.gr',
    role: 'staff',
    avatarUrl: av(56),
    title: 'Head Chef',
    phone: '+30 2286 055 003',
    status: 'active',
    lastActiveAt: '2026-09-10T23:55:00',
    isBookable: true,
    certifications: ['HACCP Level 3'],
  },
  {
    id: 'usr_sl_res',
    tenantId: 'tnt_saltline',
    name: 'Sofia Andreou',
    email: 'sofia@saltline.gr',
    role: 'staff',
    avatarUrl: av(24),
    title: 'Reservations & Events',
    phone: '+30 2286 055 004',
    status: 'invited',
    lastActiveAt: '2026-09-08T10:20:00',
    isBookable: false,
  },

  /* ---- Ridgeline Adventure Co. (4) ---- */
  {
    id: 'usr_rl_owner',
    tenantId: 'tnt_ridgeline',
    name: 'Te Ariki Mahuta',
    email: 'ariki@ridgelineadventure.co.nz',
    role: 'owner',
    avatarUrl: av(59),
    title: 'Managing Director',
    phone: '+64 3 442 0101',
    status: 'active',
    lastActiveAt: '2026-09-11T08:15:00',
    isBookable: false,
  },
  {
    id: 'usr_rl_ops',
    tenantId: 'tnt_ridgeline',
    name: 'Fiona Blackwood',
    email: 'fiona@ridgelineadventure.co.nz',
    role: 'admin',
    avatarUrl: av(44),
    title: 'Head of Operations',
    phone: '+64 3 442 0102',
    status: 'active',
    lastActiveAt: '2026-09-11T07:02:00',
    isBookable: false,
  },
  {
    id: 'usr_rl_guide_lachlan',
    tenantId: 'tnt_ridgeline',
    name: 'Lachlan Wu',
    email: 'lachlan@ridgelineadventure.co.nz',
    role: 'guide',
    avatarUrl: av(68),
    title: 'IFMGA Mountain Guide',
    phone: '+64 3 442 0103',
    status: 'active',
    lastActiveAt: '2026-09-10T18:44:00',
    isBookable: true,
    certifications: ['IFMGA / NZMGA Guide', 'Avalanche Level 3', 'Wilderness First Responder'],
  },
  {
    id: 'usr_rl_guide_hana',
    tenantId: 'tnt_ridgeline',
    name: 'Hana Sorensen',
    email: 'hana@ridgelineadventure.co.nz',
    role: 'guide',
    avatarUrl: av(35),
    title: 'Senior River Guide',
    phone: '+64 3 442 0104',
    status: 'active',
    lastActiveAt: '2026-09-11T06:48:00',
    isBookable: true,
    certifications: ['NZ Jet Boat Master', 'Swiftwater Rescue Technician'],
  },
]

export const userById = new Map(USERS.map((u) => [u.id, u]))
export const usersByTenant = new Map<string, User[]>()
for (const u of USERS) {
  const list = usersByTenant.get(u.tenantId)
  if (list) list.push(u)
  else usersByTenant.set(u.tenantId, [u])
}
export const bookableByTenant = new Map<string, User[]>()
for (const [tid, list] of usersByTenant) {
  bookableByTenant.set(
    tid,
    list.filter((u) => u.isBookable),
  )
}

export const CURRENT_USER = USERS[0]

export const SESSION: Session = {
  user: CURRENT_USER,
  tenant: CURRENT_TENANT,
  availableTenants: TENANTS.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    vertical: t.vertical,
    plan: t.plan,
  })),
}

/* ==========================================================================
   RESOURCES
   ========================================================================== */

/** Fleet photography — each ID was looked at before it was assigned. */
function resourcePhoto(id: string) {
  return `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`
}

export const RESOURCES: Resource[] = [
  /* Blue Horizon — vessels and equipment */
  {
    id: 'res_bh_alii_nui',
    imageUrl: resourcePhoto('photo-1697050891362-17b55eb48346'),
    tenantId: 'tnt_bluehorizon',
    name: 'Alii Nui (49ft sailing catamaran)',
    kind: 'vessel',
    capacity: 49,
    quantity: 1,
    status: 'available',
    location: 'Maalaea Harbor, Slip 61',
    notes: 'Freshwater rinse showers, full galley, USCG certified for 49 passengers.',
  },
  {
    id: 'res_bh_kaimana_sky',
    imageUrl: resourcePhoto('photo-1713849608655-caa62c4df4e5'),
    tenantId: 'tnt_bluehorizon',
    name: 'Kaimana Sky (42ft power catamaran)',
    kind: 'vessel',
    capacity: 38,
    quantity: 1,
    status: 'available',
    location: 'Maalaea Harbor, Slip 58',
  },
  {
    id: 'res_bh_manta_voyager',
    imageUrl: resourcePhoto('photo-1563967949-d97cba787cae'),
    tenantId: 'tnt_bluehorizon',
    name: 'Manta Voyager (36ft dive boat)',
    kind: 'vessel',
    capacity: 24,
    quantity: 1,
    status: 'available',
    location: 'Kihei Boat Ramp',
    notes: 'Twin ladders, 32 tank rack, oxygen kit serviced monthly.',
  },
  {
    id: 'res_bh_pelagic_pursuit',
    imageUrl: resourcePhoto('photo-1551942296-97384c850440'),
    tenantId: 'tnt_bluehorizon',
    name: 'Pelagic Pursuit (38ft sportfisher)',
    kind: 'vessel',
    capacity: 6,
    quantity: 1,
    status: 'available',
    location: 'Lahaina Harbor, Slip 14',
  },
  {
    id: 'res_bh_trade_wind_flyer',
    imageUrl: resourcePhoto('photo-1628690920311-a820459457ba'),
    tenantId: 'tnt_bluehorizon',
    name: 'Trade Wind Flyer (parasail boat)',
    kind: 'vessel',
    capacity: 12,
    quantity: 1,
    status: 'available',
    location: 'Kaanapali Beach launch',
  },
  {
    id: 'res_bh_reef_runner',
    imageUrl: resourcePhoto('photo-1631994299194-1d712dfd19b4'),
    tenantId: 'tnt_bluehorizon',
    name: 'Reef Runner (24ft skiff)',
    kind: 'vessel',
    capacity: 12,
    quantity: 1,
    status: 'maintenance',
    location: 'Boatyard — Wailuku',
    notes: 'Outdrive seal replacement, back in service late September.',
  },
  {
    id: 'res_bh_jetski_fleet',
    imageUrl: resourcePhoto('photo-1554132267-d06483b00adc'),
    tenantId: 'tnt_bluehorizon',
    name: 'Yamaha VX Jet Ski fleet',
    kind: 'equipment',
    capacity: 2,
    quantity: 8,
    status: 'available',
    location: 'Kaanapali beach shack',
  },
  {
    id: 'res_bh_kayak_fleet',
    imageUrl: resourcePhoto('photo-1709771075610-4382004a7e25'),
    tenantId: 'tnt_bluehorizon',
    name: 'Ocean Kayak tandem fleet',
    kind: 'equipment',
    capacity: 2,
    quantity: 14,
    status: 'available',
    location: 'Makena Landing trailer',
  },
  {
    id: 'res_bh_sup_fleet',
    imageUrl: resourcePhoto('photo-1614614098579-7167dd3f4c07'),
    tenantId: 'tnt_bluehorizon',
    name: 'Inflatable SUP fleet',
    kind: 'equipment',
    capacity: 1,
    quantity: 16,
    status: 'available',
    location: 'Kihei storage container',
  },
  {
    id: 'res_bh_surf_fleet',
    imageUrl: resourcePhoto('photo-1743779035871-9653b8c58c24'),
    tenantId: 'tnt_bluehorizon',
    name: 'Soft-top longboard fleet',
    kind: 'equipment',
    capacity: 1,
    quantity: 20,
    status: 'available',
    location: 'Launiupoko beach van',
  },
  {
    id: 'res_bh_shuttle',
    imageUrl: resourcePhoto('photo-1688619103602-35c5b27a6619'),
    tenantId: 'tnt_bluehorizon',
    name: 'Guest shuttle van',
    kind: 'vehicle',
    capacity: 14,
    quantity: 2,
    status: 'available',
    location: 'Wailea / Kihei resort loop',
  },

  /* Coral Cay */
  {
    id: 'res_cc_reef_sprinter',
    imageUrl: resourcePhoto('photo-1758135005218-f18e2a3c3ce8'),
    tenantId: 'tnt_coralcay',
    name: 'Reef Sprinter (24m catamaran)',
    kind: 'vessel',
    capacity: 60,
    quantity: 1,
    status: 'available',
    location: 'Marlin Marina, Berth C7',
  },
  {
    id: 'res_cc_coral_dawn',
    imageUrl: resourcePhoto('photo-1741754952748-179ec003ee7f'),
    tenantId: 'tnt_coralcay',
    name: 'Coral Dawn (dive liveaboard)',
    kind: 'vessel',
    capacity: 28,
    quantity: 1,
    status: 'available',
    location: 'Marlin Marina, Berth D2',
  },
  {
    id: 'res_cc_sailaway',
    imageUrl: resourcePhoto('photo-1413834932717-29e7d4714192'),
    tenantId: 'tnt_coralcay',
    name: 'Sailaway II (18m sailing cat)',
    kind: 'vessel',
    capacity: 42,
    quantity: 1,
    status: 'available',
    location: 'Port Douglas Marina',
  },
  {
    id: 'res_cc_dive_kit',
    imageUrl: resourcePhoto('photo-1682687982502-1529b3b33f85'),
    tenantId: 'tnt_coralcay',
    name: 'Certified dive kit sets',
    kind: 'equipment',
    capacity: 1,
    quantity: 32,
    status: 'available',
  },
  {
    id: 'res_cc_coach',
    imageUrl: resourcePhoto('photo-1509749837427-ac94a2553d0e'),
    tenantId: 'tnt_coralcay',
    name: 'Daintree touring coach',
    kind: 'vehicle',
    capacity: 22,
    quantity: 1,
    status: 'available',
  },

  /* Saltline */
  {
    id: 'res_sl_terrace',
    imageUrl: resourcePhoto('photo-1772352214475-12f9a75618d8'),
    tenantId: 'tnt_saltline',
    name: 'Caldera terrace tables',
    kind: 'table',
    capacity: 4,
    quantity: 14,
    status: 'available',
    location: 'Upper terrace',
  },
  {
    id: 'res_sl_sunset_deck',
    imageUrl: resourcePhoto('photo-1760726743907-ed4907b1ea83'),
    tenantId: 'tnt_saltline',
    name: 'Sunset deck two-tops',
    kind: 'table',
    capacity: 2,
    quantity: 8,
    status: 'available',
    location: 'West deck',
  },
  {
    id: 'res_sl_cellar',
    imageUrl: resourcePhoto('photo-1724882207681-9e7e8c3dd45c'),
    tenantId: 'tnt_saltline',
    name: 'Vaulted wine cellar',
    kind: 'room',
    capacity: 12,
    quantity: 1,
    status: 'available',
  },
  {
    id: 'res_sl_chefs_table',
    imageUrl: resourcePhoto('photo-1550927001-03fd6b9e9262'),
    tenantId: 'tnt_saltline',
    name: 'Chef’s table (kitchen pass)',
    kind: 'table',
    capacity: 8,
    quantity: 1,
    status: 'available',
  },

  /* Ridgeline */
  {
    id: 'res_rl_swing_rig',
    imageUrl: resourcePhoto('photo-1518837993197-f2f59dd4ba8e'),
    tenantId: 'tnt_ridgeline',
    name: 'Canyon swing rig',
    kind: 'equipment',
    capacity: 1,
    quantity: 2,
    status: 'available',
    location: 'Shotover Canyon platform',
  },
  {
    id: 'res_rl_heli',
    imageUrl: resourcePhoto('photo-1620734631260-5a3915458976'),
    tenantId: 'tnt_ridgeline',
    name: 'Squirrel AS350 helicopter',
    kind: 'vehicle',
    capacity: 6,
    quantity: 2,
    status: 'available',
    location: 'Queenstown Airport, Hangar 3',
  },
  {
    id: 'res_rl_jetboat',
    imageUrl: resourcePhoto('photo-1749410351629-529f5f79367f'),
    tenantId: 'tnt_ridgeline',
    name: 'Dart River jet boat',
    kind: 'vessel',
    capacity: 14,
    quantity: 2,
    status: 'available',
    location: 'Glenorchy jetty',
  },
  {
    id: 'res_rl_4wd',
    imageUrl: resourcePhoto('photo-1612934563202-523b120e84d6'),
    tenantId: 'tnt_ridgeline',
    name: 'Land Cruiser 4WD',
    kind: 'vehicle',
    capacity: 8,
    quantity: 3,
    status: 'available',
  },
  {
    id: 'res_rl_ebikes',
    imageUrl: resourcePhoto('photo-1566480047210-b10eaa1f8095'),
    tenantId: 'tnt_ridgeline',
    name: 'Trail e-bike fleet',
    kind: 'equipment',
    capacity: 1,
    quantity: 18,
    status: 'available',
  },
  {
    id: 'res_rl_alpine_kit',
    imageUrl: resourcePhoto('photo-1709517659952-263e00150b65'),
    tenantId: 'tnt_ridgeline',
    name: 'Alpine guiding kit (rope, axe, crampons)',
    kind: 'equipment',
    capacity: 1,
    quantity: 12,
    status: 'available',
  },
]

export const resourcesByTenant = new Map<string, Resource[]>()
for (const r of RESOURCES) {
  const list = resourcesByTenant.get(r.tenantId)
  if (list) list.push(r)
  else resourcesByTenant.set(r.tenantId, [r])
}

/* ==========================================================================
   ACTIVITIES
   ========================================================================== */

/** Unsplash photo ids -> a base alt phrase, composed with the activity name. */
const PHOTO_ALT: Record<string, string> = {
  'photo-1507525428034-b723cf961d3e': 'turquoise shallows meeting an empty white-sand beach',
  'photo-1505228395891-9a51e7e86bf6': 'palms leaning over a tropical shoreline at golden hour',
  'photo-1519046904884-53103b34b206': 'sun loungers and umbrellas on a calm morning beach',
  'photo-1502680390469-be75c86b636f': 'a rider carving across open blue ocean swell',
  'photo-1544551763-46a013bb70d5': 'a diver hovering above a bright coral reef',
  'photo-1518877593221-1f28583780b4': 'a humpback whale breaching clear of the water',
  'photo-1439066615861-d1af74d74000': 'a whale tail slipping beneath a glassy sea',
  'photo-1473116763249-2faaef81ccda': 'clear water washing over a shallow reef flat',
  'photo-1476514525535-07fb3b4ae5f1': 'a winding coast road above deep blue water',
  'photo-1501785888041-af3ef285b470': 'a mirrored alpine lake beneath jagged peaks',
  'photo-1506905925346-21bda4d32df4': 'sunlit mountain ridges above a green valley',
  'photo-1464822759023-fed622ff2c3b': 'a cloud sea breaking across high alpine summits',
  'photo-1519681393784-d120267933ba': 'a snow-covered peak under a clear night sky',
  'photo-1414235077428-338989a2e8c0': 'a warmly lit dining room set for service',
  'photo-1517248135467-4c7edcad34c4': 'guests seated at a candlelit restaurant terrace',
  'photo-1552566626-52f8b828add9': 'an intimate dining room with linen-set tables',
  'photo-1528605248644-14dd04022da1': 'a long table laid for a tasting menu',
}

function buildMedia(slug: string, name: string, ids: string[]): ActivityMedia[] {
  return ids.map((id, i) => ({
    id: `med_${slug}_${i + 1}`,
    url: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1600&q=80`,
    alt: `${name} — ${PHOTO_ALT[id] ?? 'scenic view from the experience'}`,
    type: 'image' as const,
    isPrimary: i === 0,
  }))
}

type TierSpec = [label: string, price: number, min: number, max: number, note?: string]
type AddOnSpec = [label: string, price: number, note: string, max: number | null, icon?: string]

interface ActivitySpec {
  slug: string
  name: string
  tagline: string
  description: string
  highlights: string[]
  included: string[]
  excluded: string[]
  requirements: string[]
  meetingPoint: string
  status?: ActivityStatus
  difficulty: DifficultyLevel
  durationMinutes: number
  minAge: number
  maxCapacity: number
  minParticipants?: number
  pricingModel?: PricingModel
  tiers: TierSpec[]
  addOns: AddOnSpec[]
  photos: string[]
  colorKey: Activity['colorKey']
  rating: number
  reviewCount: number
  featured?: boolean
  resources: string[]
  /** "HH:mm" departure times, tenant-local. */
  times: string[]
  /** JS weekday numbers (0=Sun … 6=Sat). Omit for every day. */
  weekdays?: number[]
  /** 0..1 — drives how full departures run. */
  popularity: number
  freeCancelHours?: number
  lateRefundPercent?: number
  seoTitle?: string
  seoDescription?: string
}

const BLUE_HORIZON_SPECS: ActivitySpec[] = [
  {
    slug: 'sunset-catamaran-sail-snorkel',
    name: 'Sunset Catamaran Sail & Snorkel',
    tagline: 'Trade winds, a private reef stop and the best seat in the house for the green flash.',
    description:
      'Step aboard a 49-foot performance catamaran an hour before golden hour and sail the sheltered lee of West Maui with the trade winds behind you. We drop anchor over a shallow finger reef for a guided snorkel while the light turns amber, then raise the sails for the run home with slack-key guitar, a grazing board and a full bar. Forty-nine guests maximum, trampolines forward, cushioned lounge aft.',
    highlights: [
      'Sail under canvas — engines off for the entire downwind return',
      'Guided snorkel on a protected reef most boats never stop at',
      'Full open bar with Maui-distilled rum and local craft beer',
      'Chef-built grazing board: poke, ahi dip, tropical fruit, warm rolls',
      'Live slack-key guitar for the sunset leg',
    ],
    included: [
      'Professional snorkel gear sized on board',
      'Certified crew of four, two in the water with you',
      'Open bar and grazing board',
      'Freshwater rinse showers and towels',
      'Reef-safe sunscreen',
    ],
    excluded: ['Hotel transfers (add below)', 'Gratuity for the crew', 'Underwater camera rental'],
    requirements: [
      'Comfortable swimming in open water',
      'Guests must be 5 years or older',
      'Arrive 30 minutes before departure for harbour check-in',
    ],
    meetingPoint: 'Maalaea Boat Harbor, Slip 61 — look for the blue Blue Horizon tent by the ramp.',
    difficulty: 'easy',
    durationMinutes: 150,
    minAge: 5,
    maxCapacity: 49,
    tiers: [
      ['Adult', 13900, 1, 12, 'Ages 13 and over'],
      ['Child (4-12)', 8900, 0, 8, 'Includes gear and non-alcoholic drinks'],
      ['Infant (0-3)', 0, 0, 2, 'Lap seat, no gear'],
    ],
    addOns: [
      ['GoPro rental', 4500, 'HERO12 with floaty and 64GB card, yours for the sail.', 4, 'Camera'],
      [
        'Underwater photo package',
        6900,
        'Crew photographer shoots your group, digital gallery the same night.',
        1,
        'Image',
      ],
      ['Hotel transfer (Wailea / Kihei)', 3500, 'Round-trip shuttle from your resort lobby.', 12, 'Bus'],
      ['Premium raw bar upgrade', 5500, 'Oysters, poke flight and sparkling on the sunset leg.', 8, 'Utensils'],
    ],
    photos: [
      'photo-1505228395891-9a51e7e86bf6',
      'photo-1507525428034-b723cf961d3e',
      'photo-1473116763249-2faaef81ccda',
      'photo-1502680390469-be75c86b636f',
    ],
    colorKey: 'sunset',
    rating: 4.9,
    reviewCount: 1284,
    featured: true,
    resources: ['res_bh_alii_nui'],
    times: ['16:30'],
    popularity: 0.9,
    freeCancelHours: 24,
    seoTitle: 'Sunset Catamaran Sail & Snorkel in Maui | Blue Horizon',
    seoDescription:
      'Maui’s highest-rated sunset sail: reef snorkel, open bar, live music and engines-off sailing home from Maalaea Harbor.',
  },
  {
    slug: 'molokini-crater-dawn-patrol',
    name: 'Molokini Crater Dawn Patrol',
    tagline: 'First boat through the channel. Glass water, 150ft visibility, nobody else there.',
    description:
      'We leave the harbour before sunrise to be the first vessel inside Molokini’s sunken caldera — the ninety minutes before the fleet arrives are the clearest water in Hawaii, routinely 150 feet of visibility. Snorkel the inner reef wall with a naturalist, then reposition to Turtle Arches on the way home for a second, shallower stop. Hot breakfast is served underway.',
    highlights: [
      'First-in arrival: an empty crater for the first 90 minutes',
      'Naturalist-led snorkel along the inner caldera wall',
      'Second stop at Turtle Arches for green sea turtles',
      'Hot breakfast burritos and Maui-roasted coffee underway',
      'Optional SCUBA upgrade for certified divers',
    ],
    included: [
      'Snorkel gear, wetsuit tops and flotation',
      'Hot breakfast and unlimited coffee, juice and water',
      'Naturalist briefing on the crater marine reserve',
      'Freshwater showers and towels',
    ],
    excluded: ['SCUBA upgrade', 'Gratuity', 'Hotel transfers'],
    requirements: [
      'Ages 6 and over',
      'Moderate swimming ability — the outer wall carries current',
      'Check-in at 05:30, we leave the dock on time',
    ],
    meetingPoint: 'Maalaea Boat Harbor, Slip 58 — harbour gate opens 05:20.',
    difficulty: 'moderate',
    durationMinutes: 300,
    minAge: 6,
    maxCapacity: 24,
    tiers: [
      ['Adult', 18900, 1, 10, 'Ages 13 and over'],
      ['Child (6-12)', 12900, 0, 6],
      ['Certified diver upgrade', 26900, 0, 8, 'Two tanks, guided, C-card required'],
    ],
    addOns: [
      ['Underwater photos', 5900, 'Divemaster shoots the crater wall, 40+ edited images.', 1, 'Image'],
      ['Prescription mask', 1500, 'Corrective lenses from -2.0 to -8.0.', 4, 'Glasses'],
      ['Hotel transfer (Kihei / Wailea)', 3500, 'Pre-dawn pickup from your resort.', 10, 'Bus'],
    ],
    photos: [
      'photo-1544551763-46a013bb70d5',
      'photo-1473116763249-2faaef81ccda',
      'photo-1507525428034-b723cf961d3e',
    ],
    colorKey: 'reef',
    rating: 4.8,
    reviewCount: 2041,
    featured: true,
    resources: ['res_bh_kaimana_sky'],
    times: ['06:00', '09:30'],
    popularity: 0.86,
    freeCancelHours: 48,
    seoTitle: 'Molokini Crater Snorkel at Dawn | Blue Horizon Maui',
    seoDescription:
      'Be the first boat inside Molokini Crater. 150ft visibility, naturalist guides, hot breakfast and a second turtle stop.',
  },
  {
    slug: 'turtle-town-kayak-snorkel',
    name: 'Turtle Town Kayak & Snorkel',
    tagline: 'Paddle the Makena coast and slip into the water where the honu rest.',
    description:
      'A short, scenic paddle from Makena Landing along a lava coastline riddled with caves and arches, ending over the reef locals call Turtle Town. Guides raft the kayaks together while you snorkel with resident green sea turtles — we see them on better than nine trips in ten. Stable tandem kayaks, calm morning water, no experience needed.',
    highlights: [
      'Green sea turtles on 94% of departures this season',
      'Stable tandem kayaks — first-timers welcome',
      'Lava arches and sea caves along the Makena shoreline',
      'Small groups: eight kayaks maximum per guide',
    ],
    included: [
      'Tandem kayak, paddle and PFD',
      'Mask, snorkel and fins',
      'Guide-led reef interpretation',
      'Cold water, fresh pineapple and granola bars',
    ],
    excluded: ['Parking at Makena Landing', 'Gratuity'],
    requirements: [
      'Ages 5 and over; under 12 paddles with an adult',
      'Basic swimming confidence',
      'Reef-safe sunscreen only — we provide it free',
    ],
    meetingPoint: 'Makena Landing Beach Park — the Blue Horizon trailer on the north lot.',
    difficulty: 'easy',
    durationMinutes: 180,
    minAge: 5,
    maxCapacity: 16,
    tiers: [
      ['Adult', 11900, 1, 8],
      ['Child (5-12)', 7900, 0, 6, 'Shares a tandem with an adult'],
    ],
    addOns: [
      ['GoPro rental', 3900, 'Mounted on the kayak or wrist, card included.', 3, 'Camera'],
      ['Underwater photos', 4900, 'Guide shoots your group with the turtles.', 1, 'Image'],
      ['Dry bag rental', 900, 'Ten-litre roll-top for phones and keys.', 4, 'Backpack'],
    ],
    photos: [
      'photo-1473116763249-2faaef81ccda',
      'photo-1519046904884-53103b34b206',
      'photo-1507525428034-b723cf961d3e',
    ],
    colorKey: 'success',
    rating: 4.7,
    reviewCount: 863,
    resources: ['res_bh_kayak_fleet'],
    times: ['07:30', '10:30'],
    popularity: 0.72,
    freeCancelHours: 24,
  },
  {
    slug: 'private-sportfishing-charter',
    name: 'Private Sportfishing Charter',
    tagline: 'The whole boat, the whole crew, the whole day. Blue marlin country.',
    description:
      'Charter the Pelagic Pursuit, a 38-foot Bertram rigged for the Maui blue-water grounds, with a captain who has fished this channel for nineteen years. Six anglers maximum, all tackle and bait supplied, targeting mahi-mahi, ono, yellowfin and — from July through October — blue marlin. We clean and bag your catch at the dock and can arrange a restaurant to cook it that evening.',
    highlights: [
      'Private boat: no shared charters, ever',
      'Nineteen-year captain with the best marlin record in Lahaina',
      'Penn International tackle, live bait and lures supplied',
      'Catch cleaned, bagged and iced dockside',
      'Cook-your-catch partnership with a Lahaina kitchen',
    ],
    included: [
      'Six hours of fishing time plus run-out and run-in',
      'All rods, reels, terminal tackle and bait',
      'Captain and deckhand',
      'Ice, cooler and catch handling',
      'Bottled water and soft drinks',
    ],
    excluded: ['Alcohol (BYO welcome)', 'Crew gratuity (20% customary)', 'Fish shipping'],
    requirements: [
      'Maximum six anglers',
      'Ages 8 and over',
      'Motion sickness medication recommended — the channel runs',
    ],
    meetingPoint: 'Lahaina Harbor, Slip 14 — the crew is aboard from 05:45.',
    difficulty: 'moderate',
    durationMinutes: 480,
    minAge: 8,
    maxCapacity: 6,
    minParticipants: 1,
    pricingModel: 'per_group',
    tiers: [
      ['Private charter (up to 6)', 189500, 1, 1, 'Eight hours, boat and crew exclusive to you'],
      ['Half-day private charter', 124500, 0, 1, 'Five hours, inshore and near-shore grounds'],
    ],
    addOns: [
      ['Cook-your-catch dinner', 12900, 'Partner restaurant prepares your fish, per guest.', 6, 'Utensils'],
      ['Fish shipping (overnight)', 18900, 'Vacuum-packed, frozen and flown home.', 2, 'Package'],
      ['Extra angler (7th seat waiver)', 9500, 'Subject to captain approval and conditions.', 1, 'UserPlus'],
    ],
    photos: [
      'photo-1502680390469-be75c86b636f',
      'photo-1476514525535-07fb3b4ae5f1',
      'photo-1507525428034-b723cf961d3e',
    ],
    colorKey: 'info',
    rating: 4.9,
    reviewCount: 312,
    resources: ['res_bh_pelagic_pursuit'],
    times: ['06:30'],
    weekdays: [1, 3, 5, 6],
    popularity: 0.62,
    freeCancelHours: 72,
    lateRefundPercent: 50,
  },
  {
    slug: 'jet-ski-safari',
    name: 'Jet Ski Safari',
    tagline: 'Thirty minutes of throttle down the Kaanapali coast, guide out front.',
    description:
      'Not a roped-off circuit — a guided run down the Kaanapali coast on Yamaha VX WaveRunners, with a stop off Black Rock to look for turtles before the return leg. Ride solo or double up, full briefing on the beach, and a lead guide who sets a pace the whole group is comfortable with. Vests and dry bags are on the sand waiting.',
    highlights: [
      'Open-water guided route, not a fenced course',
      'Yamaha VX WaveRunners replaced every season',
      'Turtle spotting stop off Black Rock',
      'Solo or tandem riding, drivers from 16 with a licence',
    ],
    included: [
      'Yamaha VX WaveRunner and fuel',
      'Coast Guard-approved vest and dry bag',
      'Beach safety briefing and guided route',
      'Freshwater rinse at the shack',
    ],
    excluded: ['GoPro rental', 'Gratuity', 'Photos'],
    requirements: [
      'Drivers must be 16+ with a valid licence or state boater card',
      'Passengers 8 and over',
      'Combined weight limit 400 lb per ski',
    ],
    meetingPoint: 'Kaanapali Beach — the Blue Horizon shack by the Whalers Village steps.',
    difficulty: 'moderate',
    durationMinutes: 90,
    minAge: 8,
    maxCapacity: 10,
    tiers: [
      ['Single rider ski', 12900, 1, 6, 'One WaveRunner, one rider'],
      ['Tandem ski (2 riders)', 16900, 0, 5, 'One WaveRunner, driver plus passenger'],
    ],
    addOns: [
      ['GoPro rental', 3500, 'Chest-mounted, footage airdropped at the shack.', 4, 'Camera'],
      ['Action photo set', 4500, 'Shore photographer shoots your run.', 1, 'Image'],
    ],
    photos: [
      'photo-1502680390469-be75c86b636f',
      'photo-1519046904884-53103b34b206',
      'photo-1505228395891-9a51e7e86bf6',
    ],
    colorKey: 'coral',
    rating: 4.6,
    reviewCount: 1547,
    resources: ['res_bh_jetski_fleet'],
    times: ['09:30', '15:00'],
    popularity: 0.68,
    freeCancelHours: 24,
  },
  {
    slug: 'beginner-surf-lesson',
    name: 'Beginner Surf Lesson',
    tagline: 'Stand up in your first session or come back free. Almost everyone stands up.',
    description:
      'Two hours at Launiupoko, the gentlest beginner break on Maui, with a three-to-one student ratio and soft-top longboards that practically catch waves for you. We start on the sand with pop-up technique, then spend most of the session in waist-deep water where your instructor is beside you for every wave. Stand-up rate last season: 96%.',
    highlights: [
      '96% of first-timers stood up last season',
      'Maximum three students per instructor',
      'Soft-top longboards, rash guards and reef booties supplied',
      'Launiupoko: waist-deep takeoff, sand bottom, no reef',
      'Free repeat lesson if you do not stand up',
    ],
    included: [
      'Soft-top longboard and leash',
      'Rash guard and reef-safe sunscreen',
      'Two hours of coached water time',
      'Photos of your first wave',
    ],
    excluded: ['Transport to Launiupoko', 'Gratuity'],
    requirements: [
      'Ages 6 and over',
      'Able to swim 25 metres unassisted',
      'No prior surfing experience needed',
    ],
    meetingPoint: 'Launiupoko Beach Park — the blue Blue Horizon surf van at the south end of the lot.',
    difficulty: 'easy',
    durationMinutes: 120,
    minAge: 6,
    maxCapacity: 12,
    tiers: [
      ['Group lesson', 9900, 1, 8, '3:1 student to instructor'],
      ['Semi-private (2 students)', 16900, 0, 2, 'You and one other, one instructor'],
      ['Private lesson', 24900, 0, 1, 'One-on-one, video review included'],
    ],
    addOns: [
      ['Board rental, extra hour', 2500, 'Keep the board after your lesson.', 4, 'Clock'],
      ['Video coaching review', 4900, 'Filmed session with a frame-by-frame breakdown.', 1, 'Video'],
    ],
    photos: [
      'photo-1502680390469-be75c86b636f',
      'photo-1519046904884-53103b34b206',
      'photo-1473116763249-2faaef81ccda',
    ],
    colorKey: 'sunset',
    rating: 4.9,
    reviewCount: 1102,
    resources: ['res_bh_surf_fleet'],
    times: ['08:00', '11:00'],
    weekdays: [0, 2, 4, 6],
    popularity: 0.74,
    freeCancelHours: 24,
  },
  {
    slug: 'night-manta-ray-dive',
    name: 'Night Manta Ray Dive',
    tagline: 'Kneel on the sand, shine your light up, watch ten-foot wings barrel-roll overhead.',
    description:
      'The single most cinematic thing you can do in Hawaiian water. We anchor over a shallow sand patch, set a ring of dive lights on the bottom, and the plankton column draws in manta rays with wingspans over ten feet. They loop within inches of your mask for forty minutes. Certified divers go to thirty-five feet; snorkellers hang from a lit float board above.',
    highlights: [
      'Manta rays on 91% of departures over the last two seasons',
      'Certified dive or lit-float snorkel — same show, two ways',
      'Small group: eighteen guests, four crew, two divemasters',
      'Hot cocoa, soup and towels for the run home',
    ],
    included: [
      'Tanks, weights, wetsuit and dive light',
      'Two divemasters in the water',
      'Hot drinks and soup after the dive',
      'Naturalist briefing on manta identification',
    ],
    excluded: ['Full rental kit (BCD, regulator) if required', 'Gratuity', 'Photos'],
    requirements: [
      'Divers: open-water certification and a logged dive in the last 24 months',
      'Snorkellers: comfortable floating in open water at night, ages 10+',
      'No alcohol for 8 hours before the dive',
    ],
    meetingPoint: 'Kihei Boat Ramp — check in at the Manta Voyager, boarding 18:30.',
    difficulty: 'moderate',
    durationMinutes: 180,
    minAge: 10,
    maxCapacity: 18,
    tiers: [
      ['Certified diver', 22900, 1, 8, 'Two-tank night dive, C-card required'],
      ['Snorkel (lit float board)', 15900, 0, 10, 'Ages 10 and over'],
      ['Child snorkel (10-14)', 11900, 0, 4],
    ],
    addOns: [
      ['Full rental kit', 4500, 'BCD, regulator, computer and dive light.', 8, 'Package'],
      ['Underwater photos', 7900, 'Divemaster photographer, full gallery next morning.', 1, 'Image'],
      ['Hotel transfer (Wailea / Kihei)', 3500, 'Round-trip evening shuttle.', 10, 'Bus'],
    ],
    photos: [
      'photo-1544551763-46a013bb70d5',
      'photo-1439066615861-d1af74d74000',
      'photo-1473116763249-2faaef81ccda',
    ],
    colorKey: 'info',
    rating: 5,
    reviewCount: 1698,
    featured: true,
    resources: ['res_bh_manta_voyager'],
    times: ['19:00'],
    weekdays: [2, 4, 5, 6],
    popularity: 0.92,
    freeCancelHours: 48,
  },
  {
    slug: 'whale-watch-eco-cruise',
    name: 'Whale Watch Eco Cruise',
    tagline: 'Humpback season on the Auau Channel, researcher on the bow, hydrophone over the side.',
    description:
      'From December through April the Auau Channel holds the densest humpback population on earth, and we run it with a marine researcher aboard and a hydrophone in the water so you hear the song as well as see the breach. Two-hour cruise, guaranteed sighting or your next trip is free. Bookings reopen in November for the winter season.',
    highlights: [
      'Hydrophone drops so you hear the humpback song live',
      'Marine researcher narrates every surface behaviour',
      'Guaranteed sighting or your next cruise is on us',
      'Shallow-draft catamaran reaches the sandbar mothers',
    ],
    included: [
      'Two-hour narrated cruise',
      'Hydrophone listening stations',
      'Hot drinks and light snacks',
      'Donation to the Pacific Whale Research Fund',
    ],
    excluded: ['Alcohol', 'Gratuity', 'Photos'],
    requirements: ['All ages welcome', 'Warm layers — the channel is breezy in winter'],
    meetingPoint: 'Maalaea Boat Harbor, Slip 61.',
    status: 'paused',
    difficulty: 'easy',
    durationMinutes: 120,
    minAge: 0,
    maxCapacity: 45,
    tiers: [
      ['Adult', 10900, 1, 10],
      ['Child (3-12)', 5900, 0, 8],
      ['Infant (0-2)', 0, 0, 2],
    ],
    addOns: [
      ['Hotel transfer', 3500, 'Round-trip from Kihei and Wailea resorts.', 10, 'Bus'],
      ['Photo package', 4900, 'Onboard photographer, digital gallery.', 1, 'Image'],
    ],
    photos: [
      'photo-1518877593221-1f28583780b4',
      'photo-1439066615861-d1af74d74000',
      'photo-1507525428034-b723cf961d3e',
    ],
    colorKey: 'lagoon',
    rating: 4.8,
    reviewCount: 2310,
    resources: ['res_bh_alii_nui'],
    times: ['08:00', '10:30', '13:00'],
    popularity: 0.8,
    freeCancelHours: 24,
  },
  {
    slug: 'sunrise-sup-yoga',
    name: 'Sunrise SUP & Yoga',
    tagline: 'Sixty minutes of flow on glass water before the island wakes up.',
    description:
      'Paddle two hundred metres into a sheltered bay at first light, anchor your board, and move through a slow vinyasa on the water with the West Maui mountains going pink behind you. Boards are wide, stable inflatables built for exactly this — the balance is easier than it looks. Finish with a floating savasana and a swim, then coffee on the sand.',
    highlights: [
      'Glass water at first light, before any wind',
      'Wide 34-inch inflatable boards built for stability',
      'Slow vinyasa sequence tuned for the water',
      'Floating savasana, then coffee and fruit on the beach',
    ],
    included: [
      'Inflatable SUP, paddle, leash and anchor',
      '60-minute guided flow with a registered yoga teacher',
      'Maui-roasted coffee and cut fruit after the session',
      'Dry bag for your phone',
    ],
    excluded: ['Transport', 'Gratuity'],
    requirements: [
      'Ages 12 and over',
      'Comfortable swimming — you will fall in and that is half the fun',
      'No yoga or paddle experience required',
    ],
    meetingPoint: 'Kalepolepo Beach Park, Kihei — the Blue Horizon SUP trailer at the north end.',
    difficulty: 'easy',
    durationMinutes: 105,
    minAge: 12,
    maxCapacity: 14,
    tiers: [
      ['Drop-in', 8900, 1, 6],
      ['Five-class card', 37900, 0, 2, 'Five sessions, valid twelve months'],
    ],
    addOns: [
      ['Board rental, extra hour', 2200, 'Stay out after class and explore the bay.', 3, 'Clock'],
      ['Sunrise photo set', 3900, 'Shoreline photographer, ten edited frames.', 1, 'Image'],
    ],
    photos: [
      'photo-1519046904884-53103b34b206',
      'photo-1505228395891-9a51e7e86bf6',
      'photo-1473116763249-2faaef81ccda',
    ],
    colorKey: 'sunset',
    rating: 4.8,
    reviewCount: 476,
    resources: ['res_bh_sup_fleet'],
    times: ['06:30'],
    weekdays: [0, 1, 3, 5],
    popularity: 0.6,
    freeCancelHours: 12,
  },
  {
    slug: 'family-reef-snorkel',
    name: 'Family Reef Snorkel',
    tagline: 'Shallow, calm, patient guides — the trip built for kids who have never snorkelled.',
    description:
      'Designed from the ground up for families: a ten-minute run to a sheltered reef in eight feet of water, flotation vests for everyone, and guides whose entire job is getting nervous first-timers comfortable with their face in the water. Viewing boards for the kids who are not ready to swim yet, a slide off the stern, full shade and a hot lunch aboard.',
    highlights: [
      'Eight-foot reef, no current, ten minutes from the dock',
      'Flotation vests and viewing boards for every child',
      'Guides trained for first-time and nervous snorkellers',
      'Water slide off the stern between snorkel sessions',
      'Full shade deck and a hot lunch aboard',
    ],
    included: [
      'Gear sized for children from age 4',
      'Flotation vests and viewing boards',
      'Hot lunch, snacks and unlimited drinks',
      'Two in-water guides plus a lookout',
      'Reef-safe sunscreen',
    ],
    excluded: ['Alcohol for adults', 'Gratuity', 'Photos'],
    requirements: [
      'Ages 4 and over',
      'Children under 12 must have an adult in their party',
      'No swimming experience required — vests are mandatory for under 12s',
    ],
    meetingPoint: 'Maalaea Boat Harbor, Slip 58 — family check-in desk opens 60 minutes prior.',
    difficulty: 'easy',
    durationMinutes: 240,
    minAge: 4,
    maxCapacity: 32,
    tiers: [
      ['Adult', 12900, 1, 8],
      ['Child (4-12)', 7900, 0, 8],
      ['Infant (0-3)', 0, 0, 3],
      ['Family pass (2+2)', 36900, 0, 2, 'Two adults and two children, one price'],
    ],
    addOns: [
      ['GoPro rental', 3900, 'Kid-proof housing and floaty.', 3, 'Camera'],
      ['Photo package', 4900, 'Crew shoots the whole family in the water.', 1, 'Image'],
      ['Hotel transfer', 3500, 'Round-trip shuttle, car seats on request.', 12, 'Bus'],
    ],
    photos: [
      'photo-1473116763249-2faaef81ccda',
      'photo-1507525428034-b723cf961d3e',
      'photo-1519046904884-53103b34b206',
    ],
    colorKey: 'reef',
    rating: 4.7,
    reviewCount: 1355,
    featured: true,
    resources: ['res_bh_kaimana_sky'],
    times: ['09:00', '13:00'],
    popularity: 0.78,
    freeCancelHours: 24,
  },
  {
    slug: 'molokai-channel-crossing',
    name: 'Molokai Channel Crossing',
    tagline: 'Twenty-six miles of open ocean downwind. For paddlers who know what that means.',
    description:
      'The Kaiwi Channel is the proving ground of Pacific paddling — twenty-six miles of deep, moving water, and we run an escorted crossing for experienced paddlers in a supported fleet. Escort boat, two safety crew, water and nutrition on the hour, and a captain who has made the crossing forty-one times. Applications are reviewed; this is not a beginner trip.',
    highlights: [
      'Escorted twenty-six mile downwind channel crossing',
      'Captain with forty-one Kaiwi crossings',
      'Full safety escort, radio and medical kit aboard',
      'Six paddlers maximum per escort vessel',
    ],
    included: [
      'Escort vessel, captain and two safety crew',
      'Nutrition, electrolytes and water on the hour',
      'Pre-crossing weather and route briefing',
      'Return transport to Maui',
    ],
    excluded: ['Your board or ski', 'Flights to the start', 'Insurance'],
    requirements: [
      'Documented open-ocean downwind experience',
      'Ages 18 and over',
      'Application reviewed by the captain before confirmation',
    ],
    meetingPoint: 'Kaunakakai Wharf, Molokai — 05:00 briefing, on the water by 05:45.',
    difficulty: 'extreme',
    durationMinutes: 420,
    minAge: 18,
    maxCapacity: 12,
    tiers: [
      ['Paddler seat', 49500, 1, 4, 'Escorted crossing, your own craft'],
      ['Support crew seat', 19500, 0, 4, 'Ride the escort vessel'],
    ],
    addOns: [
      ['Downwind board rental', 14900, '14ft downwinder, fully rigged.', 2, 'Package'],
      ['Crossing film package', 9900, 'Escort-boat video edit of your crossing.', 1, 'Video'],
    ],
    photos: [
      'photo-1502680390469-be75c86b636f',
      'photo-1476514525535-07fb3b4ae5f1',
      'photo-1473116763249-2faaef81ccda',
    ],
    colorKey: 'coral',
    rating: 4.9,
    reviewCount: 87,
    resources: ['res_bh_kaimana_sky'],
    times: ['05:30'],
    weekdays: [6],
    popularity: 0.52,
    freeCancelHours: 168,
    lateRefundPercent: 50,
  },
  {
    slug: 'lanai-coast-snorkel-sail',
    name: 'Lanai Coast Snorkel Sail',
    tagline: 'Cross the channel under sail to a coastline with no roads and no crowds.',
    description:
      'A full day across the Auau Channel to the wild south coast of Lanai, where the reef runs unbroken for miles and the only other boats are the ones that made the same crossing. Two snorkel stops, spinner dolphins on the way over more often than not, a proper barbecue lunch cooked aboard, and the downwind sail home with the rail wet.',
    highlights: [
      'Channel crossing under sail, not motor',
      'Two snorkel stops on an undeveloped south-coast reef',
      'Spinner dolphin pods on most crossings',
      'Barbecue lunch grilled aboard: huli-huli chicken and ahi',
      'Open bar on the sail home',
    ],
    included: [
      'Full day sail and two guided snorkel stops',
      'Snorkel gear, wetsuit tops and flotation',
      'Barbecue lunch, snacks and open bar',
      'Freshwater showers and towels',
    ],
    excluded: ['Hotel transfers', 'Gratuity', 'Photos'],
    requirements: [
      'Ages 8 and over',
      'Comfortable in open water',
      'Motion sickness medication advised for the crossing',
    ],
    meetingPoint: 'Lahaina Harbor, Slip 9 — boarding from 07:45.',
    difficulty: 'moderate',
    durationMinutes: 420,
    minAge: 8,
    maxCapacity: 38,
    tiers: [
      ['Adult', 24900, 1, 10],
      ['Child (8-12)', 16900, 0, 6],
    ],
    addOns: [
      ['Underwater photo package', 6900, 'Two-stop gallery, delivered that evening.', 1, 'Image'],
      ['Hotel transfer (Kaanapali)', 3500, 'Round-trip from the resort strip.', 12, 'Bus'],
      ['Premium lunch upgrade', 4500, 'Grilled ono, poke bowl and dessert plate.', 10, 'Utensils'],
    ],
    photos: [
      'photo-1507525428034-b723cf961d3e',
      'photo-1505228395891-9a51e7e86bf6',
      'photo-1473116763249-2faaef81ccda',
      'photo-1476514525535-07fb3b4ae5f1',
    ],
    colorKey: 'lagoon',
    rating: 4.8,
    reviewCount: 654,
    resources: ['res_bh_alii_nui'],
    times: ['08:00'],
    weekdays: [0, 2, 4, 6],
    popularity: 0.7,
    freeCancelHours: 48,
  },
  {
    slug: 'west-maui-parasail-flight',
    name: 'West Maui Parasail Flight',
    tagline: 'Eight hundred feet up, feet dry, the whole island in one frame.',
    description:
      'A winch-boat parasail off Kaanapali that takes you to eight hundred feet with a dry takeoff from the deck and a dry landing back on it — no swimming, no dunking unless you ask for it. Fly solo, tandem or in a three, with the West Maui mountains on one side and Lanai and Molokai across the channel on the other. Ten to twelve minutes of airtime per flight.',
    highlights: [
      'Dry takeoff and landing straight off the boat deck',
      '800ft flight line — the highest permitted off Kaanapali',
      'Fly solo, tandem or as a three',
      'Ride along free if you are not flying',
    ],
    included: [
      'Ten to twelve minutes of flight time',
      'Harness, briefing and certified winch crew',
      'Ride-along seat for non-flying companions',
      'Bottled water aboard',
    ],
    excluded: ['Photos and video', 'Gratuity', 'Parking at Kaanapali'],
    requirements: [
      'Ages 6 and over; under 18 with a guardian',
      'Combined flight weight 100-450 lb',
      'No flights within 24 hours of scuba diving',
    ],
    meetingPoint: 'Kaanapali Beach — launch in front of Whalers Village, check in 20 minutes prior.',
    difficulty: 'easy',
    durationMinutes: 75,
    minAge: 6,
    maxCapacity: 12,
    tiers: [
      ['Single flyer', 11900, 1, 6],
      ['Tandem flight (2)', 19900, 0, 4],
      ['Triple flight (3)', 26900, 0, 2],
      ['Ride-along seat', 3900, 0, 6, 'Boat seat only, no flight'],
    ],
    addOns: [
      ['Flight photo & video', 5900, 'Boat-mounted camera, full-resolution download.', 1, 'Video'],
      ['800ft line upgrade', 2900, 'Extra 300 feet of altitude on your flight.', 3, 'ArrowUp'],
    ],
    photos: [
      'photo-1505228395891-9a51e7e86bf6',
      'photo-1519046904884-53103b34b206',
      'photo-1476514525535-07fb3b4ae5f1',
    ],
    colorKey: 'coral',
    rating: 4.5,
    reviewCount: 921,
    resources: ['res_bh_trade_wind_flyer'],
    times: ['12:00'],
    popularity: 0.64,
    freeCancelHours: 24,
  },
  {
    slug: 'blue-water-freedive-course',
    name: 'Blue Water Freedive Course',
    tagline: 'Two days to a confident, safe sixty-foot dive on a single breath.',
    description:
      'A two-day Level 1 freediving course run by an instructor who competes at depth: breath-hold physiology and safety theory in the morning, confined-water static and dynamic work at midday, then two open-water sessions on the line to sixty feet. You leave certified, with a buddy protocol you can actually use and a personal best you will want to beat.',
    highlights: [
      'Level 1 freediving certification on completion',
      'Two open-water line sessions to twenty metres',
      'Competitive-depth instructor, four students maximum',
      'Full breath-hold physiology and rescue protocol',
    ],
    included: [
      'Two days of instruction and all course materials',
      'Long-blade fins, low-volume mask and wetsuit',
      'Digital certification card',
      'Line, buoy and safety diver for all open-water sessions',
    ],
    excluded: ['Accommodation', 'Meals', 'Personal equipment purchase'],
    requirements: [
      'Ages 16 and over',
      'Able to swim 200m unaided and 40m underwater',
      'Medical questionnaire, physician sign-off if any condition applies',
    ],
    meetingPoint: 'Blue Horizon dive loft, 1847 S Kihei Rd — classroom session 08:00 day one.',
    status: 'draft',
    difficulty: 'challenging',
    durationMinutes: 480,
    minAge: 16,
    maxCapacity: 4,
    tiers: [
      ['Level 1 course seat', 54900, 1, 2, 'Two days, certification included'],
      ['Refresher session', 18900, 0, 2, 'One day, certified freedivers only'],
    ],
    addOns: [
      ['Long-blade fin purchase', 28900, 'Carbon blades, fitted and taken home.', 1, 'Package'],
      ['Dive computer rental', 4900, 'Freedive-mode computer for the course.', 2, 'Watch'],
    ],
    photos: [
      'photo-1544551763-46a013bb70d5',
      'photo-1473116763249-2faaef81ccda',
      'photo-1507525428034-b723cf961d3e',
    ],
    colorKey: 'info',
    rating: 4.9,
    reviewCount: 41,
    resources: ['res_bh_manta_voyager'],
    times: ['08:00'],
    weekdays: [1, 4],
    popularity: 0.4,
    freeCancelHours: 72,
  },
]

const CORAL_CAY_SPECS: ActivitySpec[] = [
  {
    slug: 'great-barrier-reef-day-cruise',
    name: 'Great Barrier Reef Day Cruise',
    tagline: 'Two outer-reef sites, a marine biologist, and a fast cat that gets you there first.',
    description:
      'A full day on the outer Great Barrier Reef aboard a 24-metre catamaran, with two anchorages chosen the morning of the trip for the best visibility. A resident marine biologist briefs each site and swims with the snorkel group, while certified divers run two guided dives from the back deck. Buffet lunch, tropical afternoon tea, and the reef to yourselves before the tourist fleet arrives.',
    highlights: [
      'Two outer-reef sites selected the morning of the cruise',
      'Marine biologist in the water with the snorkel group',
      'Optional guided certified or introductory dives',
      'Buffet lunch and afternoon tea aboard',
      'Fast 24m catamaran — ninety minutes to the reef',
    ],
    included: [
      'Return reef transfer and Marine Park fees',
      'All snorkel gear, wetsuits and flotation',
      'Buffet lunch, morning and afternoon tea',
      'Marine biologist presentation and guided snorkel tour',
    ],
    excluded: ['Certified and introductory dives', 'Alcohol', 'Underwater photography'],
    requirements: [
      'Ages 4 and over',
      'Divers must present certification and complete a medical form',
      'Check-in at Marlin Marina by 07:30',
    ],
    meetingPoint: 'Marlin Marina, Berth C7, Cairns — check-in desk opens 07:00.',
    difficulty: 'easy',
    durationMinutes: 480,
    minAge: 4,
    maxCapacity: 60,
    tiers: [
      ['Adult', 27900, 1, 10],
      ['Child (4-14)', 15900, 0, 8],
      ['Family (2+2)', 74900, 0, 2, 'Two adults and two children'],
    ],
    addOns: [
      ['Introductory dive', 12900, 'No certification required, one-on-one with an instructor.', 4, 'Waves'],
      ['Certified dive (2 tanks)', 15900, 'Guided, all equipment included.', 6, 'Anchor'],
      ['Reef photo package', 8900, 'Onboard photographer, full digital gallery.', 1, 'Image'],
    ],
    photos: [
      'photo-1544551763-46a013bb70d5',
      'photo-1473116763249-2faaef81ccda',
      'photo-1507525428034-b723cf961d3e',
    ],
    colorKey: 'reef',
    rating: 4.8,
    reviewCount: 3120,
    featured: true,
    resources: ['res_cc_reef_sprinter'],
    times: ['08:00'],
    popularity: 0.84,
    freeCancelHours: 48,
  },
  {
    slug: 'outer-reef-liveaboard-dive',
    name: 'Outer Reef Liveaboard Dive',
    tagline: 'Three days, eleven dives, ribbon reefs the day boats never reach.',
    description:
      'Three days and two nights aboard the Coral Dawn on the Ribbon Reefs and Cod Hole, with up to eleven dives including two night dives under the boat lights. Twenty-eight guests, four instructors, nitrox on tap and a dive deck laid out so nobody queues. Cabins are twin-share with ensuite; the sundeck is where everyone ends up.',
    highlights: [
      'Up to eleven dives including two night dives',
      'Cod Hole and the northern Ribbon Reefs',
      'Nitrox included for certified nitrox divers',
      'Twin-share ensuite cabins, all meals aboard',
    ],
    included: [
      'Two nights accommodation and all meals',
      'Up to eleven guided dives',
      'Tanks, weights and nitrox fills',
      'Marine Park and reef levies',
    ],
    excluded: ['Full equipment rental', 'Alcohol', 'Dive insurance'],
    requirements: [
      'Open Water certification minimum, 15 logged dives recommended',
      'Ages 15 and over',
      'Dive medical within 12 months',
    ],
    meetingPoint: 'Marlin Marina, Berth D2 — boarding from 16:00 the day before departure.',
    difficulty: 'challenging',
    durationMinutes: 2880,
    minAge: 15,
    maxCapacity: 28,
    tiers: [
      ['Twin-share berth', 129500, 1, 6],
      ['Private cabin (2 guests)', 219500, 0, 3],
    ],
    addOns: [
      ['Full equipment rental', 14900, 'BCD, regulator, computer and wetsuit for the trip.', 6, 'Package'],
      ['Underwater camera hire', 9900, 'Compact rig with strobe and tuition.', 4, 'Camera'],
    ],
    photos: [
      'photo-1544551763-46a013bb70d5',
      'photo-1473116763249-2faaef81ccda',
      'photo-1502680390469-be75c86b636f',
    ],
    colorKey: 'info',
    rating: 4.9,
    reviewCount: 486,
    featured: true,
    resources: ['res_cc_coral_dawn', 'res_cc_dive_kit'],
    times: ['07:00'],
    weekdays: [1, 5],
    popularity: 0.66,
    freeCancelHours: 168,
    lateRefundPercent: 50,
  },
  {
    slug: 'low-isles-sail-snorkel',
    name: 'Low Isles Sail & Snorkel',
    tagline: 'A coral cay, a lighthouse and a sailing catamaran with thirty guests, not three hundred.',
    description:
      'Sail from Port Douglas to Low Isles, a coral cay ringed by a lagoon shallow enough that the snorkelling starts at your ankles. Guided reef walk with a marine guide, glass-bottom boat for non-swimmers, and a long lunch stop in the shade of the pisonia trees. Thirty guests maximum on a boat licensed for forty-two.',
    highlights: [
      'Coral cay lagoon — snorkelling starts in waist-deep water',
      'Guided reef walk and glass-bottom boat tour',
      'Maximum thirty guests on a 42-berth catamaran',
      'Long shaded lunch stop on the island',
    ],
    included: [
      'Return sail from Port Douglas',
      'Snorkel gear, wetsuits and flotation',
      'Guided snorkel tour and glass-bottom boat',
      'Tropical lunch, morning and afternoon tea',
    ],
    excluded: ['Alcohol', 'Stinger suit purchase', 'Gratuity'],
    requirements: ['Ages 3 and over', 'Basic water confidence', 'Check-in 08:00 at Port Douglas Marina'],
    meetingPoint: 'Port Douglas Marina, Reef Terminal — Sailaway II, berth 12.',
    difficulty: 'easy',
    durationMinutes: 420,
    minAge: 3,
    maxCapacity: 42,
    tiers: [
      ['Adult', 23900, 1, 10],
      ['Child (3-14)', 13900, 0, 8],
    ],
    addOns: [
      ['Photo package', 6900, 'Guide shoots your group on the cay and in the lagoon.', 1, 'Image'],
      ['Port Douglas transfer', 3500, 'Return coach from Cairns hotels.', 10, 'Bus'],
    ],
    photos: [
      'photo-1507525428034-b723cf961d3e',
      'photo-1519046904884-53103b34b206',
      'photo-1473116763249-2faaef81ccda',
    ],
    colorKey: 'lagoon',
    rating: 4.7,
    reviewCount: 1204,
    resources: ['res_cc_sailaway'],
    times: ['08:30'],
    popularity: 0.72,
    freeCancelHours: 24,
  },
  {
    slug: 'rainforest-reef-combo',
    name: 'Rainforest & Reef Combo',
    tagline: 'Daintree in the morning, outer reef in the afternoon. Two World Heritage sites, one day.',
    description:
      'The only place on earth where two World Heritage areas meet, done properly in a single day: a guided Daintree rainforest walk and Mossman Gorge swim in the morning, then a fast transfer to the reef pontoon for an afternoon of snorkelling. Small coach, one guide the whole way through, and a schedule that never feels rushed.',
    highlights: [
      'Daintree rainforest boardwalk with an Indigenous guide',
      'Mossman Gorge freshwater swim',
      'Afternoon outer-reef snorkel session',
      'Twenty-two-seat coach, one guide all day',
    ],
    included: [
      'Coach transfer and national park fees',
      'Guided rainforest walk and gorge visit',
      'Reef transfer, snorkel gear and Marine Park fees',
      'Lunch and refreshments',
    ],
    excluded: ['Alcohol', 'Optional dives', 'Gratuity'],
    requirements: ['Ages 6 and over', 'Moderate walking on boardwalk and steps', 'Long day — 06:45 to 19:00'],
    meetingPoint: 'Cairns Esplanade coach bay, opposite the Lagoon — 06:45 pickup.',
    difficulty: 'moderate',
    durationMinutes: 735,
    minAge: 6,
    maxCapacity: 22,
    tiers: [
      ['Adult', 31900, 1, 8],
      ['Child (6-14)', 18900, 0, 6],
    ],
    addOns: [
      ['Hotel pickup (Palm Cove)', 2500, 'Northern beaches pickup and return.', 8, 'Bus'],
      ['Reef photo package', 7900, 'Afternoon snorkel gallery.', 1, 'Image'],
    ],
    photos: [
      'photo-1506905925346-21bda4d32df4',
      'photo-1473116763249-2faaef81ccda',
      'photo-1544551763-46a013bb70d5',
    ],
    colorKey: 'success',
    rating: 4.6,
    reviewCount: 742,
    resources: ['res_cc_coach', 'res_cc_reef_sprinter'],
    times: ['06:45'],
    weekdays: [0, 2, 4, 6],
    popularity: 0.6,
    freeCancelHours: 48,
  },
  {
    slug: 'sunset-cocktail-catamaran',
    name: 'Sunset Cocktail Catamaran',
    tagline: 'Ninety minutes, two cocktails, the Coral Sea turning pink behind Cairns.',
    description:
      'A short, civilised sail out of Cairns as the day cools: two cocktails from a proper bar, a grazing board of Queensland cheese and prawns, and the Coral Sea going pink behind the Trinity Inlet mangroves. Adults-only on Friday and Saturday sailings, families welcome the rest of the week.',
    highlights: [
      'Two included cocktails from a full bar',
      'Queensland grazing board: prawns, cheese, tropical fruit',
      'Ninety minutes, back in time for dinner',
      'Adults-only Friday and Saturday sailings',
    ],
    included: ['Ninety-minute sail', 'Two cocktails per adult', 'Grazing board', 'Live acoustic set'],
    excluded: ['Additional drinks', 'Gratuity'],
    requirements: ['Ages 12 and over', 'Flat shoes recommended'],
    meetingPoint: 'Marlin Marina, Berth C7 — boarding from 17:15.',
    difficulty: 'easy',
    durationMinutes: 90,
    minAge: 12,
    maxCapacity: 45,
    tiers: [
      ['Adult', 10900, 1, 10],
      ['Youth (12-17)', 6900, 0, 6, 'Non-alcoholic drinks'],
    ],
    addOns: [
      ['Bottle of sparkling', 6500, 'Chilled and waiting at your seat.', 3, 'Wine'],
      ['Private front trampoline', 8900, 'Reserved net space for your group.', 1, 'Star'],
    ],
    photos: [
      'photo-1505228395891-9a51e7e86bf6',
      'photo-1507525428034-b723cf961d3e',
      'photo-1519046904884-53103b34b206',
    ],
    colorKey: 'sunset',
    rating: 4.7,
    reviewCount: 968,
    resources: ['res_cc_sailaway'],
    times: ['17:30'],
    popularity: 0.74,
    freeCancelHours: 24,
  },
]

const SALTLINE_SPECS: ActivitySpec[] = [
  {
    slug: 'caldera-sunset-tasting-menu',
    name: 'Caldera Sunset Tasting Menu',
    tagline: 'Seven courses timed so the fourth lands exactly as the sun hits the water.',
    description:
      'A seven-course tasting menu served on the caldera terrace, paced against the sunset so the fish course arrives at the moment the light goes gold. Everything is island-sourced: fava from Santorini, capers from the cliffs below, tomatoes that only grow in this volcanic soil. One seating a night, thirty-eight covers, no second turn.',
    highlights: [
      'Seven courses timed to the sunset, not the kitchen',
      'Santorini fava, cliff capers and volcanic-soil tomatoes',
      'One seating a night — the table is yours until you leave',
      'Assyrtiko-led wine pairing from Santorini vineyards',
    ],
    included: [
      'Seven-course tasting menu',
      'Bread service, amuse-bouche and petits fours',
      'Still and sparkling water',
      'Sommelier consultation',
    ],
    excluded: ['Wine pairing', 'Service charge (discretionary)'],
    requirements: [
      'Smart casual — no beachwear on the terrace',
      'Dietary requirements 48 hours in advance',
      'Ages 10 and over',
    ],
    meetingPoint: 'Saltline, Caldera Path 14, Oia — the blue door below the bell tower.',
    difficulty: 'easy',
    durationMinutes: 180,
    minAge: 10,
    maxCapacity: 38,
    tiers: [
      ['Tasting menu', 14500, 1, 6],
      ['Vegetarian tasting menu', 13500, 0, 6],
    ],
    addOns: [
      ['Assyrtiko wine pairing', 8500, 'Six pours from Santorini and the Cyclades.', 6, 'Wine'],
      ['Reserve pairing', 14500, 'Older vintages and a barrel-aged Vinsanto to close.', 4, 'Wine'],
      ['Caldera-edge table', 4500, 'The two-top on the outer terrace wall.', 1, 'Star'],
    ],
    photos: [
      'photo-1517248135467-4c7edcad34c4',
      'photo-1414235077428-338989a2e8c0',
      'photo-1528605248644-14dd04022da1',
    ],
    colorKey: 'sunset',
    rating: 4.9,
    reviewCount: 812,
    featured: true,
    resources: ['res_sl_terrace', 'res_sl_sunset_deck'],
    times: ['19:30'],
    popularity: 0.88,
    freeCancelHours: 48,
  },
  {
    slug: 'aegean-lunch-terrace',
    name: 'Aegean Lunch on the Terrace',
    tagline: 'Long lunch, cold Assyrtiko, whatever the boats brought in this morning.',
    description:
      'An unhurried a la carte lunch on the shaded terrace: grilled catch from the Ammoudi boats, tomatokeftedes, white aubergine, and a wine list that leans hard on Santorini whites. Two hours with the caldera in front of you and nobody hurrying you toward the bill.',
    highlights: [
      'Catch landed at Ammoudi that morning',
      'Shaded terrace with the full caldera view',
      'Santorini-led wine list, twenty by the glass',
      'Two-hour table, no rush',
    ],
    included: ['Two-hour terrace table', 'Bread and olive service', 'Still and sparkling water'],
    excluded: ['Food and beverage (a la carte)', 'Service charge'],
    requirements: ['All ages welcome', 'Shaded seating subject to availability'],
    meetingPoint: 'Saltline, Caldera Path 14, Oia.',
    difficulty: 'easy',
    durationMinutes: 120,
    minAge: 0,
    maxCapacity: 34,
    tiers: [
      ['Table reservation (per guest)', 2500, 1, 8, 'Held against your final bill'],
      ['Set lunch menu', 6500, 0, 8, 'Three courses, chef selection'],
    ],
    addOns: [
      ['Bottle of Assyrtiko on arrival', 4800, 'Chilled and poured as you sit.', 3, 'Wine'],
      ['Front-row terrace table', 2500, 'The four-tops on the caldera rail.', 1, 'Star'],
    ],
    photos: [
      'photo-1414235077428-338989a2e8c0',
      'photo-1552566626-52f8b828add9',
      'photo-1517248135467-4c7edcad34c4',
    ],
    colorKey: 'lagoon',
    rating: 4.6,
    reviewCount: 1140,
    resources: ['res_sl_terrace'],
    times: ['13:00'],
    popularity: 0.66,
    freeCancelHours: 12,
  },
  {
    slug: 'volcanic-wine-cellar-tasting',
    name: 'Volcanic Wine Cellar Tasting',
    tagline: 'Twelve people, eight wines, one vaulted cellar cut into the cliff.',
    description:
      'A seated tasting in the vaulted cellar beneath the restaurant, led by our sommelier: eight wines that explain why volcanic soil, sea spray and a hundred-year-old kouloura vine make Santorini whites taste like nowhere else. Cheese, cured fish and bread between pours. Twelve seats only.',
    highlights: [
      'Eight pours including a thirty-year Vinsanto',
      'Led by the head sommelier, twelve seats maximum',
      'Kouloura vine-training explained with the glass in your hand',
      'Cheese, cured fish and bread served between flights',
    ],
    included: ['Eight-wine guided flight', 'Cheese and cured fish service', 'Tasting notes to take home'],
    excluded: ['Bottle purchases', 'Service charge'],
    requirements: ['Ages 18 and over', 'Ninety minutes, seated', 'Cellar is down twenty steps'],
    meetingPoint: 'Saltline — cellar entrance on the lower terrace, arrive five minutes early.',
    difficulty: 'easy',
    durationMinutes: 90,
    minAge: 18,
    maxCapacity: 12,
    tiers: [['Cellar seat', 9500, 1, 6]],
    addOns: [
      ['Vinsanto flight upgrade', 4500, 'Three aged Vinsanto to finish.', 4, 'Wine'],
      ['Bottle to take away', 3800, 'Any tasted wine at cellar price.', 4, 'Package'],
    ],
    photos: [
      'photo-1552566626-52f8b828add9',
      'photo-1528605248644-14dd04022da1',
      'photo-1414235077428-338989a2e8c0',
    ],
    colorKey: 'reef',
    rating: 4.8,
    reviewCount: 296,
    resources: ['res_sl_cellar'],
    times: ['17:30'],
    weekdays: [2, 4, 6],
    popularity: 0.7,
    freeCancelHours: 24,
  },
  {
    slug: 'chefs-table-experience',
    name: "Chef's Table Experience",
    tagline: 'Eight seats at the pass. Yannis cooks, explains, and pours as he goes.',
    description:
      'Eight seats at the kitchen pass for a ten-course menu built the same afternoon around whatever the boats and the farm sent up. Yannis plates in front of you, explains each dish, and drinks are poured by the sommelier throughout. Runs Friday and Saturday only, books out four weeks ahead.',
    highlights: [
      'Ten courses plated at the pass in front of you',
      'Menu built the same afternoon around the day market',
      'Eight seats, Friday and Saturday only',
      'Full pairing poured throughout, included',
    ],
    included: [
      'Ten-course chef’s menu',
      'Full wine and cocktail pairing',
      'Kitchen tour before service',
      'Signed menu to take home',
    ],
    excluded: ['Service charge (discretionary)', 'Additional bottles'],
    requirements: ['Ages 16 and over', 'Dietary needs 72 hours ahead', 'Non-refundable within 7 days'],
    meetingPoint: 'Saltline — kitchen entrance on Caldera Path, ring the brass bell.',
    difficulty: 'easy',
    durationMinutes: 210,
    minAge: 16,
    maxCapacity: 8,
    tiers: [["Chef's table seat", 28500, 1, 4, 'Ten courses with full pairing']],
    addOns: [
      ['Reserve wine supplement', 12500, 'Three collector pours added to the pairing.', 2, 'Wine'],
      ['Private cellar aperitif', 5500, 'Thirty minutes in the cellar before service.', 4, 'Sparkles'],
    ],
    photos: [
      'photo-1528605248644-14dd04022da1',
      'photo-1552566626-52f8b828add9',
      'photo-1517248135467-4c7edcad34c4',
    ],
    colorKey: 'coral',
    rating: 5,
    reviewCount: 184,
    featured: true,
    resources: ['res_sl_chefs_table'],
    times: ['20:00'],
    weekdays: [5, 6],
    popularity: 0.9,
    freeCancelHours: 168,
    lateRefundPercent: 0,
  },
]

const RIDGELINE_SPECS: ActivitySpec[] = [
  {
    slug: 'shotover-canyon-swing',
    name: 'Shotover Canyon Swing',
    tagline: '109 metres of freefall, seventy metres above the river, and eight ways to be launched.',
    description:
      'The original Shotover canyon swing: a 60-metre freefall into a 200-metre arc across the canyon at 150kph, seventy metres above the river. Eight release styles from the simple Gunslinger to the Indian Rope Trick where you go in upside down and blindfolded. Crew who have run this cliff for a decade and will talk you off the edge, or over it.',
    highlights: [
      '60m freefall into a 200m swing arc at 150kph',
      'Eight release styles, choose on the platform',
      'Return transfers from Queenstown included',
      'Unlimited extra swings at a discount on the day',
    ],
    included: [
      'Return transfer from Queenstown',
      'All harness and safety equipment',
      'One swing of your chosen style',
      'Cliff-edge crew and safety briefing',
    ],
    excluded: ['Photos and video', 'Extra swings', 'Gratuity'],
    requirements: ['Ages 10 and over', 'Weight 45-140 kg', 'Not suitable with back, neck or heart conditions'],
    meetingPoint: 'Ridgeline base, 18 Shotover Street, Queenstown — check in 45 minutes prior.',
    difficulty: 'challenging',
    durationMinutes: 210,
    minAge: 10,
    maxCapacity: 12,
    tiers: [
      ['Single swing', 26900, 1, 8],
      ['Tandem swing', 44900, 0, 4, 'Two people, one harness rig'],
      ['Extra swing (same day)', 5900, 0, 6],
    ],
    addOns: [
      ['Photo & video package', 6900, 'Four-camera edit of your swing.', 1, 'Video'],
      ['Spectator seat', 2500, 'Transfer and platform viewing for non-jumpers.', 6, 'Eye'],
    ],
    photos: [
      'photo-1506905925346-21bda4d32df4',
      'photo-1464822759023-fed622ff2c3b',
      'photo-1501785888041-af3ef285b470',
    ],
    colorKey: 'coral',
    rating: 4.9,
    reviewCount: 2640,
    featured: true,
    resources: ['res_rl_swing_rig', 'res_rl_4wd'],
    times: ['09:30', '14:00'],
    popularity: 0.82,
    freeCancelHours: 24,
  },
  {
    slug: 'alpine-heli-hike',
    name: 'Alpine Heli-Hike',
    tagline: 'Twelve minutes up, four hours on a ridge no track reaches.',
    description:
      'A Squirrel AS350 lifts you onto a high ridge above the Rees Valley, and an IFMGA guide walks you along it for four hours — tussock, tarns, and a summit lunch with the Southern Alps stacked to the horizon. No technical skill needed, just decent fitness and boots. Pickup from a different ridge, so you never walk the same ground twice.',
    highlights: [
      'Helicopter access to a ridge with no walking track',
      'IFMGA-certified mountain guide, six guests maximum',
      'Four hours of alpine ridge walking with a summit lunch',
      'Different landing and pickup points — no repeated ground',
    ],
    included: [
      'Return helicopter flights',
      'IFMGA guide and all safety equipment',
      'Packed alpine lunch and hot drinks',
      'Poles, pack and wet-weather shell',
    ],
    excluded: ['Hiking boots (hire available)', 'Personal insurance', 'Gratuity'],
    requirements: [
      'Ages 12 and over',
      'Able to walk 8km over uneven ground',
      'Weather-dependent — we reschedule free of charge',
    ],
    meetingPoint: 'Queenstown Airport, Hangar 3 — Ridgeline check-in, 45 minutes before flight.',
    difficulty: 'moderate',
    durationMinutes: 360,
    minAge: 12,
    maxCapacity: 6,
    tiers: [
      ['Heli-hike seat', 74900, 1, 4],
      ['Private charter (up to 5)', 329500, 0, 1, 'Exclusive helicopter and guide'],
    ],
    addOns: [
      ['Boot and gaiter hire', 3500, 'Sized at check-in.', 5, 'Footprints'],
      ['Summit champagne', 7900, 'Chilled bottle carried up and poured at the top.', 2, 'Wine'],
      ['Photographer', 19900, 'Dedicated shooter on the ridge, full gallery.', 1, 'Camera'],
    ],
    photos: [
      'photo-1464822759023-fed622ff2c3b',
      'photo-1506905925346-21bda4d32df4',
      'photo-1519681393784-d120267933ba',
    ],
    colorKey: 'info',
    rating: 5,
    reviewCount: 418,
    featured: true,
    resources: ['res_rl_heli', 'res_rl_alpine_kit'],
    times: ['09:00'],
    popularity: 0.76,
    freeCancelHours: 48,
  },
  {
    slug: 'dart-river-jet-safari',
    name: 'Dart River Jet Safari',
    tagline: 'Braided glacial river, 360-degree spins, and a beech forest walk in the middle.',
    description:
      'A jet boat run up the braided Dart River into Mount Aspiring National Park, threading channels a hand-span deep at eighty kilometres an hour, with 360-degree spins wherever the driver finds room. Halfway up we stop for a guided walk through ancient beech forest, then run the river back down with the glacier behind us.',
    highlights: [
      'Jet boat into Mount Aspiring National Park',
      '360-degree spins in shallow braided channels',
      'Guided beech forest walk at the turnaround',
      'Glenorchy scenery that stood in for half of Middle-earth',
    ],
    included: [
      'Return coach from Queenstown',
      'Jet boat safari and national park entry',
      'Guided forest walk',
      'Warm jackets and life vests',
    ],
    excluded: ['Meals', 'Photos', 'Gratuity'],
    requirements: ['Ages 5 and over', 'Under 15 with an adult', 'Warm layers — the river is glacier-fed'],
    meetingPoint: 'Ridgeline base, 18 Shotover Street — coach departs 08:00 sharp.',
    difficulty: 'easy',
    durationMinutes: 360,
    minAge: 5,
    maxCapacity: 14,
    tiers: [
      ['Adult', 33900, 1, 8],
      ['Child (5-15)', 19900, 0, 6],
      ['Family (2+2)', 96900, 0, 2],
    ],
    addOns: [
      ['Onboard photo package', 5900, 'Bow-camera stills and video of the spins.', 1, 'Camera'],
      ['Glenorchy lunch box', 2900, 'Packed lunch for the forest stop.', 8, 'Utensils'],
    ],
    photos: [
      'photo-1501785888041-af3ef285b470',
      'photo-1506905925346-21bda4d32df4',
      'photo-1476514525535-07fb3b4ae5f1',
    ],
    colorKey: 'lagoon',
    rating: 4.8,
    reviewCount: 1876,
    resources: ['res_rl_jetboat', 'res_rl_4wd'],
    times: ['08:30'],
    popularity: 0.74,
    freeCancelHours: 24,
  },
  {
    slug: 'remarkables-guided-ascent',
    name: 'Remarkables Guided Ascent',
    tagline: 'Single Cone at dawn, roped up, back at the car park before the crowds park.',
    description:
      'A guided alpine ascent of Single Cone on the Remarkables: an early start from Wye Creek, scrambling and short roped sections on good rock, and a summit that puts the whole Wakatipu basin under your boots. Four climbers per guide, all technical gear supplied, and a guide who will turn you around if the mountain says so.',
    highlights: [
      'Summit Single Cone, 2319m, with an IFMGA guide',
      'Four climbers per guide, all technical gear supplied',
      'Short roped sections on excellent schist',
      'Dawn start — summit before the wind builds',
    ],
    included: [
      'IFMGA guide and technical equipment',
      'Harness, helmet, rope and axe',
      'Trailhead transfer from Queenstown',
      'Summit snacks and hot drink',
    ],
    excluded: ['Boots (hire available)', 'Personal insurance', 'Lunch'],
    requirements: [
      'Ages 16 and over',
      'Good hill fitness — 1,100m of ascent',
      'Prior scrambling experience recommended, not required',
    ],
    meetingPoint: 'Wye Creek car park, State Highway 6 — 05:30 briefing.',
    difficulty: 'challenging',
    durationMinutes: 540,
    minAge: 16,
    maxCapacity: 8,
    tiers: [
      ['Guided ascent seat', 59900, 1, 4],
      ['Private guiding (1:1)', 129500, 0, 1],
    ],
    addOns: [
      ['Boot and crampon hire', 4500, 'Fitted the evening before.', 4, 'Footprints'],
      ['Summit photo set', 8900, 'Guide shoots the ascent and summit.', 1, 'Camera'],
    ],
    photos: [
      'photo-1519681393784-d120267933ba',
      'photo-1464822759023-fed622ff2c3b',
      'photo-1506905925346-21bda4d32df4',
    ],
    colorKey: 'reef',
    rating: 4.9,
    reviewCount: 227,
    resources: ['res_rl_alpine_kit', 'res_rl_4wd'],
    times: ['05:30'],
    weekdays: [0, 3, 6],
    popularity: 0.58,
    freeCancelHours: 72,
  },
  {
    slug: 'glenorchy-e-bike-tour',
    name: 'Glenorchy E-Bike Tour',
    tagline: 'Forty kilometres of lakeside trail with a motor doing the hills for you.',
    description:
      'A relaxed forty-kilometre loop on the Glenorchy trails with full-suspension e-bikes that flatten every climb. Lagoon boardwalks, braided river flats, a cafe stop in Glenorchy and a guide who knows which bends deserve a photograph. Suitable for anyone who has ridden a bike in the last decade.',
    highlights: [
      'Full-suspension e-bikes — every hill flattened',
      'Lagoon boardwalk and braided river flats',
      'Coffee and scone stop in Glenorchy',
      'Coach transfer with bikes trailered both ways',
    ],
    included: ['E-bike, helmet and repair kit', 'Guide for the full loop', 'Coach transfer from Queenstown', 'Coffee stop'],
    excluded: ['Lunch', 'Gratuity', 'Rain shell (hire available)'],
    requirements: ['Ages 12 and over', 'Able to ride a bicycle confidently', 'Height 150cm minimum'],
    meetingPoint: 'Ridgeline base, 18 Shotover Street — bikes loaded at 09:00.',
    difficulty: 'easy',
    durationMinutes: 300,
    minAge: 12,
    maxCapacity: 18,
    tiers: [
      ['Adult', 22900, 1, 8],
      ['Youth (12-17)', 15900, 0, 6],
    ],
    addOns: [
      ['Picnic lunch', 3500, 'Made at the Glenorchy bakery, carried for you.', 10, 'Utensils'],
      ['Rain shell hire', 1500, 'Sized at the base.', 6, 'Umbrella'],
    ],
    photos: [
      'photo-1501785888041-af3ef285b470',
      'photo-1476514525535-07fb3b4ae5f1',
      'photo-1506905925346-21bda4d32df4',
    ],
    colorKey: 'success',
    rating: 4.7,
    reviewCount: 534,
    resources: ['res_rl_ebikes', 'res_rl_4wd'],
    times: ['09:30'],
    weekdays: [1, 2, 4, 5, 6],
    popularity: 0.6,
    freeCancelHours: 24,
  },
]

export const SPEC_BY_TENANT: [string, ActivitySpec[]][] = [
  ['tnt_bluehorizon', BLUE_HORIZON_SPECS],
  ['tnt_coralcay', CORAL_CAY_SPECS],
  ['tnt_saltline', SALTLINE_SPECS],
  ['tnt_ridgeline', RIDGELINE_SPECS],
]

function buildActivity(tenant: Tenant, spec: ActivitySpec): Activity {
  const id = `act_${spec.slug}`
  const priceTiers: PriceTier[] = spec.tiers.map(([label, price, min, max, note]) => ({
    id: `tier_${spec.slug}_${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`,
    label,
    price,
    compareAtPrice: undefined,
    minQuantity: min,
    maxQuantity: max,
    description: note,
    countsTowardCapacity: !/infant|ride-along|support crew|spectator/i.test(label),
  }))
  const addOns: AddOn[] = spec.addOns.map(([label, price, note, max, icon]) => ({
    id: `add_${spec.slug}_${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`,
    label,
    price,
    description: note,
    maxPerBooking: max,
    required: false,
    icon,
  }))
  const freeHours = spec.freeCancelHours ?? 24
  const lateRefund = spec.lateRefundPercent ?? (freeHours >= 72 ? 50 : 0)
  const seededAt = createRng(hashSeed(`created:${id}`))
  const createdOffset = rngInt(seededAt, 240, 1500)
  const updatedOffset = rngInt(seededAt, 1, 34)
  return {
    id,
    tenantId: tenant.id,
    slug: spec.slug,
    name: spec.name,
    tagline: spec.tagline,
    description: spec.description,
    highlights: spec.highlights,
    included: spec.included,
    excluded: spec.excluded,
    requirements: spec.requirements,
    meetingPoint: spec.meetingPoint,
    category: tenant.vertical,
    status: spec.status ?? 'live',
    difficulty: spec.difficulty,
    durationMinutes: spec.durationMinutes,
    minAge: spec.minAge,
    maxCapacity: spec.maxCapacity,
    minParticipants: spec.minParticipants ?? 1,
    pricingModel: spec.pricingModel ?? 'per_person',
    basePrice: priceTiers[0].price,
    currency: tenant.currency,
    priceTiers,
    addOns,
    media: buildMedia(spec.slug, spec.name, spec.photos),
    colorKey: spec.colorKey,
    cancellationPolicy: {
      freeCancellationHours: freeHours,
      lateRefundPercent: lateRefund,
      summary:
        lateRefund > 0
          ? `Free cancellation up to ${freeHours} hours before departure. Inside ${freeHours} hours we refund ${lateRefund}%.`
          : `Free cancellation up to ${freeHours} hours before departure. No refund inside ${freeHours} hours.`,
    },
    requiredResourceIds: spec.resources,
    rating: spec.rating,
    reviewCount: spec.reviewCount,
    totalBookings: 0,
    createdAt: isoLocal(addDays(NOW, -createdOffset)),
    updatedAt: isoLocal(addDays(NOW, -updatedOffset)),
    seoTitle: spec.seoTitle ?? `${spec.name} | ${tenant.name}`,
    seoDescription: spec.seoDescription ?? spec.tagline,
    featured: spec.featured ?? false,
  }
}

export const ACTIVITIES: Activity[] = SPEC_BY_TENANT.flatMap(([tenantId, specs]) => {
  const tenant = tenantById.get(tenantId)!
  return specs.map((s) => buildActivity(tenant, s))
})

export const activityById = new Map(ACTIVITIES.map((a) => [a.id, a]))
const specById = new Map<string, ActivitySpec>()
for (const [, specs] of SPEC_BY_TENANT) for (const s of specs) specById.set(`act_${s.slug}`, s)

export const activitiesByTenant = new Map<string, Activity[]>()
for (const a of ACTIVITIES) {
  const list = activitiesByTenant.get(a.tenantId)
  if (list) list.push(a)
  else activitiesByTenant.set(a.tenantId, [a])
}
const activityBySlugKey = new Map(ACTIVITIES.map((a) => [`${a.tenantId}::${a.slug}`, a]))

export function getActivitiesByTenant(tenantId: string): Activity[] {
  return activitiesByTenant.get(tenantId) ?? []
}

export function getActivityById(id: string): Activity | undefined {
  return activityById.get(id)
}

export function getActivityBySlug(tenantId: string, slug: string): Activity | undefined {
  return activityBySlugKey.get(`${tenantId}::${slug}`)
}


export function getUsersByTenant(tenantId: string): User[] {
  return usersByTenant.get(tenantId) ?? []
}

export function getResourcesByTenant(tenantId: string): Resource[] {
  return resourcesByTenant.get(tenantId) ?? []
}

export const CHANNEL_LABELS: Record<BookingChannel, string> = {
  website_widget: 'Website widget',
  direct: 'Direct',
  ota: 'OTA marketplace',
  phone: 'Phone',
  walk_in: 'Walk-in',
  reseller: 'Reseller',
  concierge: 'Hotel concierge',
  google: 'Google Things to do',
}
