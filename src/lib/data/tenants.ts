/**
 * The four demo operators.
 *
 * Each one is a fully realised business with its own currency, timezone, plan
 * tier and personality — enough contrast to prove the product is genuinely
 * multi-tenant and multi-vertical, not one dataset wearing four hats.
 *
 * Branding colours are written as `oklch()` strings drawn from the same ramps as
 * the design system (see globals.css) so tenant theming composes with the token
 * palette instead of fighting it.
 */

import type { Tenant, TenantFeatures } from '@/types'
import { DEFAULT_TENANT_SLUG, unsplashUrl } from './constants'

/**
 * Baseline entitlements per plan. Real tenants then apply a small number of
 * per-account overrides (sales concessions, vertical necessities) on top.
 */
const PLAN_FEATURES: Record<Tenant['plan'], TenantFeatures> = {
  starter: {
    advancedAnalytics: false,
    resourceScheduling: false,
    multiLocation: false,
    apiAccess: false,
    customBranding: false,
    waitlists: false,
    dynamicPricing: false,
    channelManager: false,
    giftCards: true,
    memberships: false,
  },
  growth: {
    advancedAnalytics: true,
    resourceScheduling: true,
    multiLocation: false,
    apiAccess: false,
    customBranding: true,
    waitlists: true,
    dynamicPricing: false,
    channelManager: true,
    giftCards: true,
    memberships: false,
  },
  scale: {
    advancedAnalytics: true,
    resourceScheduling: true,
    multiLocation: true,
    apiAccess: true,
    customBranding: true,
    waitlists: true,
    dynamicPricing: true,
    channelManager: true,
    giftCards: true,
    memberships: false,
  },
  enterprise: {
    advancedAnalytics: true,
    resourceScheduling: true,
    multiLocation: true,
    apiAccess: true,
    customBranding: true,
    waitlists: true,
    dynamicPricing: true,
    channelManager: true,
    giftCards: true,
    memberships: true,
  },
}

function features(plan: Tenant['plan'], overrides: Partial<TenantFeatures> = {}): TenantFeatures {
  return { ...PLAN_FEATURES[plan], ...overrides }
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
    city: 'Kihei, Maui',
    createdAt: '2021-03-18T07:40:00',
    branding: {
      primaryColor: 'oklch(0.615 0.113 196)',
      accentColor: 'oklch(0.700 0.176 35)',
      logoText: 'Blue Horizon',
      coverImage: unsplashUrl('1505228395891-9a51e7e86bf6', 2000),
    },
    // Dynamic pricing was unlocked outside the growth baseline during the 2026
    // renewal — Molokini dawn slots were being left underpriced in peak weeks.
    features: features('growth', { dynamicPricing: true }),
    stats: {
      monthlyBookings: 1284,
      monthlyRevenue: 38_742_500,
      activeActivities: 13,
      teamSize: 12,
      avgRating: 4.9,
      reviewCount: 3847,
    },
    contact: {
      email: 'aloha@bluehorizonmaui.com',
      phone: '+1 (808) 555-0147',
      website: 'https://bluehorizonmaui.com',
      addressLine: "Ma'alaea Harbor, Slip 42, Wailuku, HI 96793",
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
    city: 'Port Douglas, QLD',
    createdAt: '2019-08-02T09:10:00',
    branding: {
      primaryColor: 'oklch(0.520 0.096 198)',
      accentColor: 'oklch(0.786 0.157 76)',
      logoText: 'Coral Cay',
      coverImage: unsplashUrl('1544551763-46a013bb70d5', 2000),
    },
    // Memberships shipped as an enterprise feature; Coral Cay pilots the reef
    // conservation membership under a design-partner agreement.
    features: features('scale', { memberships: true }),
    stats: {
      monthlyBookings: 2164,
      monthlyRevenue: 91_486_000,
      activeActivities: 6,
      teamSize: 4,
      avgRating: 4.8,
      reviewCount: 6120,
    },
    contact: {
      email: 'reservations@coralcayexpeditions.com.au',
      phone: '+61 7 4099 0188',
      website: 'https://coralcayexpeditions.com.au',
      addressLine: 'Marina Mirage, Berth 14, Wharf Street, Port Douglas QLD 4877',
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
    city: 'Oia, Santorini',
    createdAt: '2026-06-29T11:25:00',
    branding: {
      primaryColor: 'oklch(0.627 0.186 32)',
      accentColor: 'oklch(0.706 0.122 194)',
      logoText: 'Saltline',
      coverImage: unsplashUrl('1414235077428-338989a2e8c0', 2000),
    },
    // Table-plan scheduling and waitlists are table stakes for a restaurant, so
    // they ship inside the starter "Table Pack" rather than gating to growth.
    features: features('starter', { resourceScheduling: true, waitlists: true }),
    stats: {
      monthlyBookings: 946,
      monthlyRevenue: 12_648_000,
      activeActivities: 6,
      teamSize: 3,
      avgRating: 4.7,
      reviewCount: 1289,
    },
    contact: {
      email: 'reserve@saltline.gr',
      phone: '+30 2286 071 940',
      website: 'https://saltline.gr',
      addressLine: 'Nikolaou Nomikou 24, Oia, Santorini 847 02',
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
    city: 'Queenstown, Otago',
    createdAt: '2017-11-14T10:05:00',
    branding: {
      primaryColor: 'oklch(0.505 0.180 299)',
      accentColor: 'oklch(0.700 0.149 62)',
      logoText: 'Ridgeline',
      coverImage: unsplashUrl('1506905925346-21bda4d32df4', 2000),
    },
    features: features('enterprise'),
    stats: {
      monthlyBookings: 1735,
      monthlyRevenue: 128_965_000,
      activeActivities: 6,
      teamSize: 4,
      avgRating: 4.9,
      reviewCount: 5402,
    },
    contact: {
      email: 'crew@ridgelineadventure.co.nz',
      phone: '+64 3 441 0922',
      website: 'https://ridgelineadventure.co.nz',
      addressLine: '18 Brecon Street, Queenstown 9300',
    },
  },
]

export function getTenantBySlug(slug: string): Tenant | undefined {
  return TENANTS.find((tenant) => tenant.slug === slug)
}

export function getTenantById(id: string): Tenant | undefined {
  return TENANTS.find((tenant) => tenant.id === id)
}

/** Blue Horizon — the operator the demo signs you in as. */
export const DEFAULT_TENANT: Tenant =
  getTenantBySlug(DEFAULT_TENANT_SLUG) ?? TENANTS[0]
