/**
 * Competitor facts for the /compare and /alternatives pages.
 *
 * Every claim about another company lives here, once, with the page it came
 * from, the day it was read and whether it is the vendor's own word
 * ('official') or somebody else's ('reported': a competitor's blog, an
 * aggregator, a review site). Pages render the status as a visible
 * "Reported" badge and link the source, so nothing reaches a reader without
 * its basis.
 *
 * Rules the copy follows (from the research report's claims table):
 *   - "Not shown" means the feature was not on the vendor's own pages on the
 *     day checked. It never means the vendor lacks it.
 *   - Review ratings are not shown at all until someone re-reads them by hand.
 *   - Prices are list prices in the vendor's own currency. EUR is not
 *     converted. Rezdy's currency is uncertain (its page says "exclusive of
 *     GST in Australia").
 *
 * EZRA Pro's own numbers are read from the same plan data the pricing page
 * renders (`PRICING_PLANS`), so the two cannot drift. The checkout lines are
 * mirrored from `src/components/storefront/booking-widget.tsx`
 * (BOOKING_FEE_RATE, PROCESSING_FEE); that module is a client module, so the
 * values are restated here. Change both together.
 */

import { PRICING_PLANS } from '@/content/marketing'

/* ==========================================================================
   DATES
   ========================================================================== */

/** The day every fact below was last read. Change only after a real re-check. */
export const CHECKED_ON = '2026-11-12'
/** First publication of the compare pages. */
export const PUBLISHED_ON = '2026-11-12'
/** The year in titles. Tied to the check, not the calendar. */
export const CHECKED_YEAR = CHECKED_ON.slice(0, 4)

/** "12 November 2026" */
export function formatCheckedDate(iso: string = CHECKED_ON) {
  const [y, m, d] = iso.split('-').map(Number)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return `${d} ${months[m - 1]} ${y}`
}

/** "November 2026" */
export function formatCheckedMonth(iso: string = CHECKED_ON) {
  return formatCheckedDate(iso).split(' ').slice(1).join(' ')
}

/* ==========================================================================
   TYPES
   ========================================================================== */

export type FactStatus = 'official' | 'reported'

export interface Source {
  label: string
  url: string
}

export interface Fact {
  text: string
  status: FactStatus
  source: Source
  checkedOn: string
}

export type VendorId =
  | 'fareharbor'
  | 'peek-pro'
  | 'bokun'
  | 'rezdy'
  | 'checkfront'
  | 'xola'
  | 'regiondo'
  | 'bookingkit'
  | 'zaui'
  | 'trekksoft'
  | 'ventrata'

/** How a matrix cell reads at a glance. */
export type CellTone = 'yes' | 'limited' | 'not-shown'

export interface MatrixCell extends Fact {
  tone: CellTone
}

export type MatrixKey = 'walkUp' | 'waivers' | 'transport' | 'rentals' | 'giftCards' | 'dynamicPricing'

export const MATRIX_COLUMNS: { key: MatrixKey; label: string }[] = [
  { key: 'walkUp', label: 'Walk-up sales' },
  { key: 'waivers', label: 'Waivers' },
  { key: 'transport', label: 'Pickups or transfers' },
  { key: 'rentals', label: 'Rentals' },
  { key: 'giftCards', label: 'Gift cards' },
  { key: 'dynamicPricing', label: 'Demand-based pricing' },
]

export interface Vendor {
  id: VendorId
  name: string
  website: string
  /** One plain line: who it suits best, in our reading of its own pages. Editorial, not a fact. */
  suits: string
  owner: Fact
  model: Fact
  monthly: Fact
  fee: Fact
  whoPays: Fact
  processing: Fact
  matrix: Record<MatrixKey, MatrixCell>
  /** Has its own /compare/[slug] page. */
  hasVsPage: boolean
}

/* ==========================================================================
   SOURCES
   ========================================================================== */

const S = {
  fhBlogFees: { label: 'FareHarbor blog, 21 Aug 2024', url: 'https://fareharbor.com/blog/what-to-look-for-in-your-next-booking-system/' },
  fhWhatIs: { label: 'FareHarbor blog, 11 Jun 2026', url: 'https://fareharbor.com/blog/what-is-fareharbor/' },
  fhSec: { label: 'Booking Holdings 10-K, FY2018', url: 'https://www.sec.gov/Archives/edgar/data/1075531/000107553119000009/bkng1231201810k.htm' },
  captainbookFh: { label: 'CaptainBook (a competitor)', url: 'https://www.captainbook.io/blog/fareharbor-pricing-fees-explained' },
  trekksoftFh: { label: 'TrekkSoft (a competitor)', url: 'https://www.trekksoft.com/en/blog/fareharbor-pricing-guidewhat-to-know-before-you-buy' },
  peek: { label: 'peekpro.com', url: 'https://peekpro.com/' },
  bokunOnPeek: { label: 'Bókun (a competitor), 4 Aug 2025', url: 'https://www.bokun.io/peek-pro-pricing' },
  g2Peek: { label: 'G2 discussion', url: 'https://g2.com/discussions/what-does-peek-pro-cost' },
  rezdyPricing: { label: 'Rezdy pricing', url: 'https://www.rezdy.com/pricing/' },
  rezdyFeatures: { label: 'Rezdy features', url: 'https://www.rezdy.com/features/' },
  merger: { label: 'Checkfront blog: merger with Rezdy and Regiondo', url: 'https://checkfront.com/blog/checkfront-announces-global-merger-with-rezdy-and-regiondo' },
  bokunPricing: { label: 'Bókun pricing', url: 'https://www.bokun.io/pricing' },
  bokunFeatures: { label: 'Bókun features', url: 'https://www.bokun.io/features' },
  bokunAbout: { label: 'Bókun about', url: 'https://www.bokun.io/about' },
  checkfrontPricing: { label: 'Checkfront pricing', url: 'https://www.checkfront.com/pricing/' },
  checkfrontFeatures: { label: 'Checkfront features', url: 'https://www.checkfront.com/features/' },
  checkfrontGift: { label: 'Checkfront gift certificates', url: 'https://www.checkfront.com/gift-certificates' },
  checkfrontPayments: { label: 'Checkfront Payments', url: 'https://checkfront.com/payments' },
  betakit: { label: 'BetaKit', url: 'https://betakit.com/checkfront-merges-with-australias-rezdy-to-scale-online-tourism-reservations/' },
  xolaPricing: { label: 'Xola pricing', url: 'https://www.xola.com/pricing' },
  xolaGuest: { label: 'Xola support: Flex Standard, Guest Pays', url: 'https://support.xola.com/flex-standard-guest-pays' },
  xolaCompany: { label: 'Xola support: Flex Level, Company Pays', url: 'https://support.xola.com/flex-level-company-pays' },
  xolaHome: { label: 'xola.com', url: 'https://www.xola.com/' },
  xolaGifts: { label: 'Xola support: gifts', url: 'https://support.xola.com/gifts-and-gift-offers' },
  xolaFunding: { label: 'Xola news, 2016', url: 'https://www.xola.com/articles/xola-lands-series-led-rakuten-takes-120-billion-global-tours-activities-market' },
  regiondoPricing: { label: 'Regiondo pricing', url: 'https://go.regiondo.com/pricing' },
  techcouver: { label: 'TechCouver, Aug 2023', url: 'https://techcouver.com/2023/08/15/checkfront-joins-forces-rezdy-regiondo-merger/' },
  bookingkitPricing: { label: 'bookingkit pricing', url: 'https://bookingkit.com/pricing/' },
  bookingkitHome: { label: 'bookingkit.com', url: 'https://bookingkit.com/' },
  bookingkitPress: { label: 'bookingkit press release, Jun 2023', url: 'https://bookingkit.com/wp-content/uploads/2023/06/230606_bookingkit_press-release_financing.pdf' },
  zauiPricing: { label: 'Zaui pricing', url: 'https://www.zaui.com/pricing' },
  zauiHome: { label: 'zaui.com', url: 'https://www.zaui.com/' },
  zauiFit: { label: 'Zaui blog, Nov 2025', url: 'https://www.zaui.com/resources/blog/zaui-software-reviews' },
  zauiVancouver: { label: 'Tourism Vancouver listing', url: 'https://www.tourismvancouver.com/listings/zaui-software/42507/' },
  trekksoftPricing: { label: 'TrekkSoft pricing', url: 'https://www.trekksoft.com/en/pricing' },
  trekksoftAbout: { label: 'TrekkSoft about', url: 'https://www.trekksoft.com/en/newsroom/about-trekksoft' },
  ventrataPlans: { label: 'Ventrata plans', url: 'https://www.ventrata.com/compare-our-plans' },
  ventrataHome: { label: 'ventrata.com', url: 'https://www.ventrata.com/' },
  arival: { label: 'Arival guide to booking system pricing', url: 'https://arival.travel/arival-guide-to-res-system-pricing/' },
  ezraPricing: { label: 'EZRA Pro pricing', url: '/pricing' },
  ezraCheckout: { label: 'EZRA Pro storefront checkout', url: '/book/blue-horizon' },
  ezraDemo: { label: 'EZRA Pro live demo', url: '/dashboard' },
} satisfies Record<string, Source>

export const SOURCES = S

function official(text: string, source: Source, checkedOn = CHECKED_ON): Fact {
  return { text, status: 'official', source, checkedOn }
}

function reported(text: string, source: Source, checkedOn = CHECKED_ON): Fact {
  return { text, status: 'reported', source, checkedOn }
}

function cell(tone: CellTone, fact: Fact): MatrixCell {
  return { ...fact, tone }
}

/* ==========================================================================
   VENDORS
   ========================================================================== */

export const VENDORS: Record<VendorId, Vendor> = {
  fareharbor: {
    id: 'fareharbor',
    name: 'FareHarbor',
    website: 'https://fareharbor.com/',
    suits: 'Operators who want the most widely used system, a large partner network and no monthly bill, and are content for guests to pay an unpublished booking fee.',
    owner: official('Booking Holdings (Booking.com’s parent), since April 2018', S.fhSec),
    model: official('No subscription; a booking fee is added at checkout', S.fhBlogFees),
    monthly: official('$0', S.fhBlogFees),
    fee: reported('Not published; widely reported at around 6% (some sources say 6–8%)', S.captainbookFh),
    whoPays: official('Usually the guest: the fee “is transferred to the customer at checkout”', S.fhBlogFees),
    processing: reported('Not published; third-party figures conflict', S.captainbookFh),
    matrix: {
      walkUp: cell('yes', official('Yes, FareHarbor Dock', S.fhWhatIs)),
      waivers: cell('yes', official('Yes', S.fhWhatIs)),
      transport: cell('not-shown', official('Not shown on its pages', S.fhWhatIs)),
      rentals: cell('not-shown', official('Not shown on its pages', S.fhWhatIs)),
      giftCards: cell('not-shown', official('Not confirmed on its pages', S.fhWhatIs)),
      dynamicPricing: cell('not-shown', official('Not confirmed on its pages', S.fhWhatIs)),
    },
    hasVsPage: true,
  },
  'peek-pro': {
    id: 'peek-pro',
    name: 'Peek Pro',
    website: 'https://peekpro.com/',
    suits: 'US water, land and attraction operators who want AI-assisted tools and rental handover features, and are happy to price by quote.',
    owner: official('Independent, venture-backed; also runs the peek.com marketplace', S.peek),
    model: official('Custom, quote-based pricing', S.peek),
    monthly: official('Quote only', S.peek),
    fee: reported('Reported up to 6–8% on online bookings', S.bokunOnPeek),
    whoPays: reported('Reports conflict; can be passed to guests or paid by the operator', S.g2Peek),
    processing: reported('Reported 2.3% + 30¢ per ticket', S.bokunOnPeek),
    matrix: {
      walkUp: cell('yes', official('Yes, POS with tipping', S.peek)),
      waivers: cell('yes', official('Yes', S.peek)),
      transport: cell('not-shown', official('Not shown on its pages', S.peek)),
      rentals: cell('yes', official('Yes: deposits, card holds, photo records', S.peek)),
      giftCards: cell('limited', official('Lists “Vouchers”; gift cards not confirmed', S.peek)),
      dynamicPricing: cell('yes', official('Yes, with operator-set minimum and maximum', S.peek)),
    },
    hasVsPage: true,
  },
  bokun: {
    id: 'bokun',
    name: 'Bókun',
    website: 'https://www.bokun.io/',
    suits: 'Operators who sell heavily through Viator and want the lowest published percentage, with pickup points and a large OTA marketplace.',
    owner: official('Tripadvisor, since 2018; says it operates independently', S.bokunAbout),
    model: official('Free plan, or a subscription plus 1–1.5%', S.bokunPricing),
    monthly: official('$0 (FREE, 1 user, manual bookings); $49 START; $149 PLUS; $499 PREMIUM', S.bokunPricing),
    fee: official('1.5% START, 1.25% PLUS (the page also shows 1%), 1% PREMIUM; 0% on Viator and offline bookings on paid plans', S.bokunPricing),
    whoPays: official('Operator chooses; “Pass the fee” can be switched on or off', S.bokunPricing),
    processing: official('Stripe Connect; rate not published', S.bokunPricing),
    matrix: {
      walkUp: cell('yes', official('Yes, POS', S.bokunFeatures)),
      waivers: cell('limited', official('Add-on', S.bokunFeatures)),
      transport: cell('yes', official('Yes, pick-up and drop-off points', S.bokunFeatures)),
      rentals: cell('yes', official('Yes', S.bokunFeatures)),
      giftCards: cell('yes', official('From START', S.bokunPricing)),
      dynamicPricing: cell('limited', official('Seasonal pricing; no dynamic pricing named', S.bokunFeatures)),
    },
    hasVsPage: true,
  },
  rezdy: {
    id: 'rezdy',
    name: 'Rezdy',
    website: 'https://www.rezdy.com/',
    suits: 'Operators whose growth runs through agents and resellers, who want unlimited users and agents and no contract lock-in.',
    owner: official('Same group as Checkfront and Regiondo since 2023', S.merger),
    model: official('Subscription plus a fee per booking', S.rezdyPricing),
    monthly: official('$49 Foundation, $99 Accelerate, $249 Expansion (excl. GST in Australia; currency may be regional)', S.rezdyPricing),
    fee: official('3% on online bookings on every plan; $1 / $0.85 / $0.70 on offline and agent bookings', S.rezdyPricing),
    whoPays: official('Operator chooses: “absorb this fee, or pass it on to your guests”', S.rezdyPricing),
    processing: official('Rezdy Payment Gateway; rate not published', S.rezdyPricing),
    matrix: {
      walkUp: cell('not-shown', official('Not clear from its pages', S.rezdyFeatures)),
      waivers: cell('limited', official('Mentioned in passing only', S.rezdyFeatures)),
      transport: cell('not-shown', official('Not shown on its features page', S.rezdyFeatures)),
      rentals: cell('yes', official('Yes', S.rezdyFeatures)),
      giftCards: cell('yes', official('From the $99 plan', S.rezdyPricing)),
      dynamicPricing: cell('limited', official('Rate adjustments', S.rezdyFeatures)),
    },
    hasVsPage: true,
  },
  checkfront: {
    id: 'checkfront',
    name: 'Checkfront',
    website: 'https://www.checkfront.com/',
    suits: 'Rental, tour and accommodation businesses that want one simple published plan, waivers included and no fee on offline or OTA bookings.',
    owner: official('Same group as Rezdy and Regiondo since 2023', S.merger),
    model: official('“One simple plan”: subscription plus a fee on online bookings', S.checkfrontPricing),
    monthly: official('$99', S.checkfrontPricing),
    fee: official('3% on online bookings (may vary by region); none on offline, OTA or API bookings', S.checkfrontPricing),
    whoPays: official('Operator absorbs it or passes it on', S.checkfrontPricing),
    processing: official('Checkfront Payments, “a simple fixed fee”; rate not published', S.checkfrontPayments),
    matrix: {
      walkUp: cell('not-shown', official('Not shown on its features page', S.checkfrontFeatures)),
      waivers: cell('yes', official('Yes, included at no extra cost', S.checkfrontPricing)),
      transport: cell('not-shown', official('Not shown on its features page', S.checkfrontFeatures)),
      rentals: cell('yes', official('Yes, a core use', S.checkfrontFeatures)),
      giftCards: cell('limited', official('Gift certificates, as an add-on', S.checkfrontGift)),
      dynamicPricing: cell('limited', official('Seasonal pricing', S.checkfrontFeatures)),
    },
    hasVsPage: true,
  },
  xola: {
    id: 'xola',
    name: 'Xola',
    website: 'https://www.xola.com/',
    suits: 'US tours and attractions that want no subscription, a published fee, 24/7 support, kiosks and gated entry.',
    owner: official('Xola Inc., independent; last disclosed round a Series A led by Rakuten Travel (2016)', S.xolaFunding),
    model: official('No subscription; a per-booking service fee', S.xolaPricing),
    monthly: official('$0 subscription; plan prices by “Contact for pricing”', S.xolaPricing),
    fee: official('6% paid by the guest (Flex Standard, Guest Pays) or 3% paid by the operator (Flex Level, Company Pays)', S.xolaGuest),
    whoPays: official('Depends on the plan: the guest on Guest Pays, the operator on Company Pays', S.xolaCompany),
    processing: official('2.39% + $0.30 (US)', S.xolaPricing),
    matrix: {
      walkUp: cell('yes', official('Yes, POS and kiosk', S.xolaHome)),
      waivers: cell('yes', official('Yes, built in', S.xolaHome)),
      transport: cell('not-shown', official('Not shown on its pages', S.xolaHome)),
      rentals: cell('limited', official('Equipment management; rentals not confirmed', S.xolaHome)),
      giftCards: cell('yes', official('Yes', S.xolaGifts)),
      dynamicPricing: cell('not-shown', official('Not documented', S.xolaHome)),
    },
    hasVsPage: true,
  },
  regiondo: {
    id: 'regiondo',
    name: 'Regiondo',
    website: 'https://www.regiondo.com/',
    suits: 'German-speaking and European operators who want ticketing with a scan app and EUR pricing, and accept a one-year contract.',
    owner: official('Same group as Rezdy and Checkfront since 2023', S.techcouver),
    model: official('Subscription on a one-year contract, plus a per-booking fee', S.regiondoPricing),
    monthly: official('€59 Grow, €99 Pro (billed monthly on a one-year contract)', S.regiondoPricing),
    fee: official('“A small per-booking fee” on online bookings; amount not published', S.regiondoPricing),
    whoPays: official('Not stated', S.regiondoPricing),
    processing: official('Stripe and PayPal; rates not listed', S.regiondoPricing),
    matrix: {
      walkUp: cell('not-shown', official('POS listed as “Coming Soon”', S.regiondoPricing)),
      waivers: cell('not-shown', official('Not found on its pages', S.regiondoPricing)),
      transport: cell('not-shown', official('Not found on its pages', S.regiondoPricing)),
      rentals: cell('not-shown', official('Not found on its pages', S.regiondoPricing)),
      giftCards: cell('limited', official('Vouchers', S.regiondoPricing)),
      dynamicPricing: cell('not-shown', official('Not shown on its pricing page', S.regiondoPricing)),
    },
    hasVsPage: false,
  },
  bookingkit: {
    id: 'bookingkit',
    name: 'bookingkit',
    website: 'https://bookingkit.com/',
    suits: 'European attractions such as parks, zoos, museums and escape rooms that need turnstile partners and reseller tools.',
    owner: official('Independent bookingkit GmbH, Berlin', S.bookingkitPress),
    model: official('Subscription plus stacked booking, ticket and payment fees', S.bookingkitPricing),
    monthly: official('€49 Starterkit (yearly only); €99 Businesskit yearly or €119 monthly; Prokit on request', S.bookingkitPricing),
    fee: official('Booking fee 3% (Starterkit) or 2% (Businesskit), plus €0.60 per ticket, plus a 3% online payment fee', S.bookingkitPricing),
    whoPays: official('Not stated', S.bookingkitPricing),
    processing: official('3% online payment fee', S.bookingkitPricing),
    matrix: {
      walkUp: cell('limited', official('Via partners (turnstiles and POS)', S.bookingkitHome)),
      waivers: cell('not-shown', official('Not named on its pages', S.bookingkitHome)),
      transport: cell('not-shown', official('Not named on its pages', S.bookingkitHome)),
      rentals: cell('not-shown', official('Not named on its pages', S.bookingkitHome)),
      giftCards: cell('limited', official('Vouchers', S.bookingkitHome)),
      dynamicPricing: cell('limited', official('Claimed by the vendor', S.bookingkitHome)),
    },
    hasVsPage: false,
  },
  zaui: {
    id: 'zaui',
    name: 'Zaui',
    website: 'https://www.zaui.com/',
    suits: 'Shuttle, bus, airport, cruise-port and ferry operators who need routes, fleets, vehicle tracking and seat manifests.',
    owner: official('Independent, Vancouver, founded 1999', S.zauiVancouver),
    model: official('Free plan with a fee per online booking, or Enterprise', S.zauiPricing),
    monthly: official('$0 Free; Enterprise custom', S.zauiPricing),
    fee: official('6% on online bookings on Free; Enterprise “as low as 1%”; none on offline bookings', S.zauiPricing),
    whoPays: official('Operator can pass it to the guest', S.zauiPricing),
    processing: official('Passed through without markup (gives roughly 1.9% + $0.30 as a Stripe example)', S.zauiPricing),
    matrix: {
      walkUp: cell('yes', official('Yes, Booking Desk', S.zauiHome)),
      waivers: cell('limited', official('Not native (links to Smartwaiver)', S.zauiHome)),
      transport: cell('yes', official('Yes: routes, fleets, tracking, manifests', S.zauiHome)),
      rentals: cell('yes', official('Named', S.zauiHome)),
      giftCards: cell('yes', official('Yes', S.zauiHome)),
      dynamicPricing: cell('yes', official('Yes', S.zauiHome)),
    },
    hasVsPage: false,
  },
  trekksoft: {
    id: 'trekksoft',
    name: 'TrekkSoft',
    website: 'https://www.trekksoft.com/',
    suits: 'European and international operators who want published tiers, a free website builder and published card processing.',
    owner: official('Part of Tourism Software Group; head office in Barcelona', S.trekksoftAbout),
    model: official('Annual subscription plus a fee per booking', S.trekksoftPricing),
    monthly: official('€49 Starter, €149 Accelerate, €249 Ultimate (billed annually)', S.trekksoftPricing),
    fee: official('3% / 2.5% / 2% online; €1.50 / €1.00 / €0.50 per offline booking', S.trekksoftPricing),
    whoPays: official('Not stated', S.trekksoftPricing),
    processing: official('Payyo: 2.5% + €0.25 in Europe, 3% + €0.25 outside', S.trekksoftPricing),
    matrix: {
      walkUp: cell('yes', official('Yes, including mobile POS', S.trekksoftAbout)),
      waivers: cell('limited', official('From the €149 Accelerate plan', S.trekksoftPricing)),
      transport: cell('limited', official('Markets a transport segment; no transfer documentation found', S.trekksoftAbout)),
      rentals: cell('yes', official('Rental items', S.trekksoftAbout)),
      giftCards: cell('limited', official('Gift card sales from the €149 plan', S.trekksoftPricing)),
      dynamicPricing: cell('not-shown', official('Not shown on its pages', S.trekksoftPricing)),
    },
    hasVsPage: false,
  },
  ventrata: {
    id: 'ventrata',
    name: 'Ventrata',
    website: 'https://www.ventrata.com/',
    suits: 'Large attractions and sightseeing brands that need turnstiles, kiosks and offline-capable hardware.',
    owner: official('Independent, London, founded 2016', S.ventrataHome),
    model: official('Subscription plus a fee per booking', S.ventrataPlans),
    monthly: official('$575 Standard, $2,300 Premium, $5,750 Elite', S.ventrataPlans),
    fee: official('2% / 1% / 0.5%', S.ventrataPlans),
    whoPays: official('Not stated', S.ventrataPlans),
    processing: official('Adyen or Viva; rates not published', S.ventrataPlans),
    matrix: {
      walkUp: cell('yes', official('Yes, POS, kiosks and turnstiles', S.ventrataPlans)),
      waivers: cell('not-shown', official('Not confirmed on its pages', S.ventrataHome)),
      transport: cell('not-shown', official('Not shown on its pages', S.ventrataHome)),
      rentals: cell('not-shown', official('Not shown on its pages', S.ventrataHome)),
      giftCards: cell('yes', official('Yes, every plan', S.ventrataPlans)),
      dynamicPricing: cell('yes', official('Yes', S.ventrataHome)),
    },
    hasVsPage: false,
  },
}

/** Display order: the six leaders first, then the second tier. */
export const VENDOR_ORDER: VendorId[] = ['fareharbor', 'peek-pro', 'bokun', 'rezdy', 'checkfront', 'xola', 'zaui', 'trekksoft', 'regiondo', 'bookingkit', 'ventrata']

export function getVendor(id: VendorId) {
  return VENDORS[id]
}

/* ==========================================================================
   EZRA PRO — its own row, from its own pricing page and checkout
   ========================================================================== */

const planById = (id: 'starter' | 'growth' | 'scale') => {
  const plan = PRICING_PLANS.find((p) => p.id === id)
  if (!plan) throw new Error(`Missing plan ${id}`)
  return plan
}

const STARTER = planById('starter')
const GROWTH = planById('growth')
const SCALE = planById('scale')

/** Whole dollars from minor units: 4900 -> 49. */
const dollars = (minor: number) => Math.round(minor / 100)

/** The checkout lines the storefront adds, mirrored from booking-widget.tsx. */
export const EZRA_CHECKOUT = {
  /** `BOOKING_FEE_RATE`: a "Booking fee" line on the subtotal. */
  bookingFeePercent: 6,
  /** `PROCESSING_FEE`: a "Card processing (2.5%)" line on the subtotal. */
  processingPercent: 2.5,
} as const

export const EZRA_PLANS = [STARTER, GROWTH, SCALE].map((plan) => ({
  id: plan.id,
  name: plan.name,
  monthly: dollars(plan.monthlyPrice),
  percent: plan.commissionPercent,
}))

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`

export const EZRA = {
  name: 'EZRA Pro',
  monthly: official(
    EZRA_PLANS.map((p) => `$${p.monthly} ${p.name}`).join(', ') + ', Enterprise quoted',
    S.ezraPricing,
  ),
  fee: official(
    `Commission of ${pct(STARTER.commissionPercent)} (${STARTER.name}), ${pct(GROWTH.commissionPercent)} (${GROWTH.name}) or ${pct(SCALE.commissionPercent)} (${SCALE.name}) per booking`,
    S.ezraPricing,
  ),
  whoPays: official(
    `The guest, as the storefront is set up today: a ${EZRA_CHECKOUT.bookingFeePercent}% “Booking fee” line and a “Card processing (${EZRA_CHECKOUT.processingPercent}%)” line at checkout. Transfers are sold at the owner’s price with nothing added.`,
    S.ezraCheckout,
  ),
  processing: official(`${EZRA_CHECKOUT.processingPercent}%, shown to the guest as its own line`, S.ezraCheckout),
  model: official('A free plan with commission, or a monthly plan with commission', S.ezraPricing),
  /** Matrix row. Plan names come from the pricing page's feature list. */
  matrix: {
    walkUp: cell('yes', official('Yes, a walk-in desk for counter sales', S.ezraDemo)),
    waivers: cell('yes', official('Yes, per activity; the booker or each guest signs', S.ezraDemo)),
    transport: cell('yes', official('Yes: pickup and drop-off on any activity, and transfers by trip, hour or shared seat', S.ezraDemo)),
    rentals: cell('yes', official('Yes: items with their own stock, by hour, day or set length', S.ezraDemo)),
    giftCards: cell('limited', official(`Yes, on ${SCALE.name} ($${dollars(SCALE.monthlyPrice)}/mo)`, S.ezraPricing)),
    dynamicPricing: cell('limited', official(`Price rules, on ${SCALE.name} ($${dollars(SCALE.monthlyPrice)}/mo)`, S.ezraPricing)),
  } satisfies Record<MatrixKey, MatrixCell>,
}

export const EZRA_PLAN_NAMES = { starter: STARTER.name, growth: GROWTH.name, scale: SCALE.name }
export const EZRA_SCALE_MONTHLY = dollars(SCALE.monthlyPrice)

/* ==========================================================================
   CALCULATOR RATES

   One row per plan whose cost can be worked out from a published (or a
   clearly reported) rate. Card processing is kept apart because most vendors
   do not publish it.
   ========================================================================== */

export type Currency = 'USD' | 'EUR'

export interface PlanRate {
  id: string
  vendor: VendorId | 'ezra'
  vendorName: string
  plan: string
  currency: Currency
  /** Monthly subscription in whole currency units. */
  monthly: number
  /** Percentage on online bookings. null = not published, cannot be calculated. */
  percent: number | null
  /** Extra per-booking amount, in the plan's currency (bookingkit's ticket fee is per ticket; see note). */
  perBooking?: number
  /** Published card processing, when the vendor publishes it. */
  processing?: { percent: number; fixed: number; label: string }
  whoPays: string
  status: FactStatus
  source: Source
  note?: string
}

/** Shown once above the calculator whenever EZRA Pro rows are in it. */
export const EZRA_CALC_NOTE = `EZRA Pro rows use the commission on our pricing page. On top of the price, our storefront currently shows guests a ${EZRA_CHECKOUT.bookingFeePercent}% booking fee line and a ${EZRA_CHECKOUT.processingPercent}% card processing line (transfers excepted, where the owner’s price includes every fee).`

export const PLAN_RATES: PlanRate[] = [
  ...EZRA_PLANS.map<PlanRate>((p) => ({
    id: `ezra-${p.id}`,
    vendor: 'ezra',
    vendorName: 'EZRA Pro',
    plan: p.name,
    currency: 'USD',
    monthly: p.monthly,
    percent: p.percent,
    processing: { percent: EZRA_CHECKOUT.processingPercent, fixed: 0, label: `${EZRA_CHECKOUT.processingPercent}%, a line the guest sees` },
    whoPays: `Guest by default: a ${EZRA_CHECKOUT.bookingFeePercent}% booking fee line at checkout`,
    status: 'official',
    source: S.ezraPricing,
  })),
  {
    id: 'fareharbor',
    vendor: 'fareharbor',
    vendorName: 'FareHarbor',
    plan: 'Standard',
    currency: 'USD',
    monthly: 0,
    percent: 6,
    whoPays: 'Usually the guest, at checkout',
    status: 'reported',
    source: S.captainbookFh,
    note: 'The rate is not published. 6% is the figure most often reported by third parties.',
  },
  {
    id: 'peek-pro',
    vendor: 'peek-pro',
    vendorName: 'Peek Pro',
    plan: 'Quoted',
    currency: 'USD',
    monthly: 0,
    percent: 6,
    whoPays: 'Reports conflict',
    status: 'reported',
    source: S.bokunOnPeek,
    note: 'Peek Pro prices by quote. 6% is the low end of a figure reported by a competitor.',
  },
  {
    id: 'xola-guest',
    vendor: 'xola',
    vendorName: 'Xola',
    plan: 'Flex Standard, Guest Pays',
    currency: 'USD',
    monthly: 0,
    percent: 6,
    processing: { percent: 2.39, fixed: 0.3, label: '2.39% + $0.30 (US)' },
    whoPays: 'Guest',
    status: 'official',
    source: S.xolaGuest,
  },
  {
    id: 'xola-company',
    vendor: 'xola',
    vendorName: 'Xola',
    plan: 'Flex Level, Company Pays',
    currency: 'USD',
    monthly: 0,
    percent: 3,
    processing: { percent: 2.39, fixed: 0.3, label: '2.39% + $0.30 (US)' },
    whoPays: 'Operator',
    status: 'official',
    source: S.xolaCompany,
  },
  {
    id: 'zaui-free',
    vendor: 'zaui',
    vendorName: 'Zaui',
    plan: 'Free',
    currency: 'USD',
    monthly: 0,
    percent: 6,
    whoPays: 'Operator can pass it to the guest',
    status: 'official',
    source: S.zauiPricing,
  },
  ...([
    ['Foundation', 49],
    ['Accelerate', 99],
    ['Expansion', 249],
  ] as const).map<PlanRate>(([plan, monthly]) => ({
    id: `rezdy-${plan.toLowerCase()}`,
    vendor: 'rezdy',
    vendorName: 'Rezdy',
    plan,
    currency: 'USD',
    monthly,
    percent: 3,
    whoPays: 'Operator chooses',
    status: 'official',
    source: S.rezdyPricing,
    note: 'Listed “exclusive of GST in Australia”; the currency may be regional.',
  })),
  {
    id: 'checkfront',
    vendor: 'checkfront',
    vendorName: 'Checkfront',
    plan: 'One plan',
    currency: 'USD',
    monthly: 99,
    percent: 3,
    whoPays: 'Operator chooses',
    status: 'official',
    source: S.checkfrontPricing,
    note: '3% “may vary by region”. No fee on offline, OTA or API bookings.',
  },
  ...([
    ['START', 49, 1.5],
    ['PLUS', 149, 1.25],
    ['PREMIUM', 499, 1],
  ] as const).map<PlanRate>(([plan, monthly, percent]) => ({
    id: `bokun-${plan.toLowerCase()}`,
    vendor: 'bokun',
    vendorName: 'Bókun',
    plan,
    currency: 'USD',
    monthly,
    percent,
    whoPays: 'Operator chooses',
    status: 'official',
    source: S.bokunPricing,
    note: plan === 'PLUS' ? 'The pricing page shows PLUS at both 1.25% and 1%; we use 1.25%. 0% on Viator and offline bookings.' : '0% on Viator and offline bookings.',
  })),
  ...([
    ['Starter', 49, 3],
    ['Accelerate', 149, 2.5],
    ['Ultimate', 249, 2],
  ] as const).map<PlanRate>(([plan, monthly, percent]) => ({
    id: `trekksoft-${plan.toLowerCase()}`,
    vendor: 'trekksoft',
    vendorName: 'TrekkSoft',
    plan,
    currency: 'EUR',
    monthly,
    percent,
    processing: { percent: 2.5, fixed: 0.25, label: '2.5% + €0.25 (Europe)' },
    whoPays: 'Not stated',
    status: 'official',
    source: S.trekksoftPricing,
    note: 'Billed annually.',
  })),
  ...([
    ['Starterkit', 49, 3],
    ['Businesskit', 99, 2],
  ] as const).map<PlanRate>(([plan, monthly, percent]) => ({
    id: `bookingkit-${plan.toLowerCase()}`,
    vendor: 'bookingkit',
    vendorName: 'bookingkit',
    plan,
    currency: 'EUR',
    monthly,
    percent,
    processing: { percent: 3, fixed: 0, label: '3% online payment fee' },
    whoPays: 'Not stated',
    status: 'official',
    source: S.bookingkitPricing,
    note: 'Plus €0.60 per ticket, which is not included here. Businesskit is €99 billed yearly.',
  })),
  {
    id: 'regiondo-pro',
    vendor: 'regiondo',
    vendorName: 'Regiondo',
    plan: 'Grow / Pro',
    currency: 'EUR',
    monthly: 59,
    percent: null,
    whoPays: 'Not stated',
    status: 'official',
    source: S.regiondoPricing,
    note: 'The per-booking fee is not published, so the total cannot be calculated. One-year contract.',
  },
  {
    id: 'ventrata-standard',
    vendor: 'ventrata',
    vendorName: 'Ventrata',
    plan: 'Standard',
    currency: 'USD',
    monthly: 575,
    percent: 2,
    whoPays: 'Not stated',
    status: 'official',
    source: S.ventrataPlans,
  },
]

/** Platform cost for a month: subscription plus the percentage. null when the rate is unpublished. */
export function platformCost(rate: PlanRate, monthlyValue: number) {
  if (rate.percent === null) return null
  return rate.monthly + (monthlyValue * rate.percent) / 100
}

/* ==========================================================================
   PAGE INDEX
   ========================================================================== */

export const VS_SLUGS = ['fareharbor', 'peek-pro', 'bokun', 'rezdy', 'checkfront', 'xola'] as const
export type VsSlug = (typeof VS_SLUGS)[number]

export const ALTERNATIVES_SLUGS = ['fareharbor', 'peek-pro', 'rezdy'] as const
export type AlternativesSlug = (typeof ALTERNATIVES_SLUGS)[number]

export const ERROR_REPORT_EMAIL = 'hello@ezrapro.com'

/* ==========================================================================
   HELPERS FOR PAGE COPY
   ========================================================================== */

export const officialFact = official
export const reportedFact = reported

export function rateById(id: string) {
  const rate = PLAN_RATES.find((r) => r.id === id)
  if (!rate) throw new Error(`Missing plan rate ${id}`)
  return rate
}

/** Monthly online value above which plan `b` costs less than plan `a`. null if it never does. */
export function breakEven(aId: string, bId: string) {
  const a = rateById(aId)
  const b = rateById(bId)
  if (a.percent === null || b.percent === null || a.percent <= b.percent) return null
  return ((b.monthly - a.monthly) / (a.percent - b.percent)) * 100
}

/** "$1,549" */
export function money(amount: number, currency: Currency = 'USD') {
  const symbol = currency === 'EUR' ? '€' : '$'
  return `${symbol}${Math.round(amount).toLocaleString('en-US')}`
}
