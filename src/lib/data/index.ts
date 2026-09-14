/**
 * EZRA PRO — the seed data barrel.
 *
 * One import path for the whole generated graph. Symbols are re-exported
 * explicitly rather than with `export *` so that adding a name to any module
 * cannot silently shadow one already exported here, and so this file doubles as
 * the readable inventory of what the data layer actually offers.
 *
 * Import order below mirrors the dependency order the modules are generated in:
 * constants → verticals → tenants → users → resources → activities → customers
 * → departures → bookings → payments → analytics → marketing → notifications.
 *
 * Page components should generally reach for `@/lib/queries` instead; this
 * barrel is for the query layer and for surfaces that genuinely want a raw
 * collection (a seed inspector, a demo switcher, a sitemap).
 */

/* --- constants ---------------------------------------------------------- */
export {
  avatarUrl,
  DAY_END_HOUR,
  DAY_START_HOUR,
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_SLUG,
  FUTURE_DAYS,
  HISTORY_DAYS,
  NOW,
  NOW_ISO,
  PLATFORM_DOMAIN,
  PLATFORM_NAME,
  SEED_NAMESPACE,
  seedKey,
  SUPPORT_EMAIL,
  TODAY_KEY,
  unsplashUrl,
} from './constants'

/* --- verticals ---------------------------------------------------------- */
export { getVertical, VERTICALS } from './verticals'

/* --- tenants ------------------------------------------------------------- */
export { DEFAULT_TENANT, getTenantById, getTenantBySlug, TENANTS } from './tenants'

/* --- users --------------------------------------------------------------- */
export { CURRENT_USER, getBookableStaff, getUserById, getUsersByTenant, USERS } from './users'

/* --- resources ----------------------------------------------------------- */
export {
  getAvailableResources,
  getResourceById,
  getResourcesByTenant,
  RESOURCES,
} from './resources'

/* --- activities ---------------------------------------------------------- */
export {
  ACTIVITIES,
  ACTIVITIES_BY_TENANT,
  getActivitiesByTenant,
  getActivityById,
  getActivityBySlug,
  getFeaturedActivities,
  getLiveActivities,
} from './activities'

/* --- customers ----------------------------------------------------------- */
export {
  COUNTRY_NAMES,
  CUSTOMERS,
  getCountryName,
  getCustomerById,
  getCustomersByTenant,
  getTopCustomers,
  pickLocalName,
} from './customers'

/* --- departures ---------------------------------------------------------- */
export {
  CALENDAR_END,
  CALENDAR_PAST_DAYS,
  CALENDAR_START,
  DEPARTURES,
  getDepartureById,
  getDeparturesByActivity,
  getDeparturesByTenant,
  getDeparturesForDay,
  getDeparturesInRange,
  getUpcomingDepartures,
} from './departures'

/* --- bookings ------------------------------------------------------------ */
export {
  BOOKINGS,
  getBookingById,
  getBookingsByActivity,
  getBookingsByCustomer,
  getBookingsByDeparture,
  getBookingsByTenant,
  getBookingsInRange,
  getRecentBookings,
} from './bookings'

/* --- payments ------------------------------------------------------------ */
export { getPaymentById, getPaymentsByBooking, getPaymentsByTenant, PAYMENTS } from './payments'

/* --- analytics ----------------------------------------------------------- */
export {
  bookingNetRevenue,
  formatKpiValue,
  getActivityPerformance,
  getAnalytics,
  getInsights,
  getKpiById,
  getPreviousRangeBounds,
  getRangeBounds,
  getRangeTotals,
  getTradingDays,
  RANGE_LABELS,
  RANGE_PRESETS,
  rangeDayCount,
} from './analytics'

/* --- marketing ----------------------------------------------------------- */
export {
  FAQS,
  FEATURE_BLOCKS,
  getIntegrationsByCategory,
  getPricingPlan,
  INTEGRATION_CATEGORIES,
  INTEGRATIONS,
  LOGO_MARKS,
  PRICING_FEATURE_LABELS,
  PRICING_PLANS,
  STATS,
  TESTIMONIALS,
} from './marketing'

/* --- notifications ------------------------------------------------------- */
export { getActivityFeed, getNotifications, getUnreadNotificationCount } from './notifications'
