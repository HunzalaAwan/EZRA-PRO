/**
 * Competitor facts for the /compare and /alternatives pages.
 *
 * Every claim about another company lives here, once, with the page it came
 * from, the day it was read and whether it is the vendor's own word
 * ('official') or somebody else's ('reported': a competitor's blog, an
 * aggregator, a review site). Pages print a small "Reported" badge beside
 * reported facts and a numbered footnote that leads to the source.
 *
 * Rules the copy follows:
 *   - "Not shown" means the feature was not on the vendor's own pages on the
 *     day checked. It never means the vendor lacks it.
 *   - Review ratings are not shown.
 *   - Prices are list prices in the vendor's own currency. EUR is not
 *     converted. Rezdy's currency may be regional ("exclusive of GST in
 *     Australia").
 *
 * EZRA Pro has one plan: 4% of each booking, $0 a month, no setup fee, no
 * contract. The business chooses whether it pays the 4% or passes it to
 * guests as a booking fee. It is defined here (EZRA_PLAN) rather than read
 * from the pricing page data, so these pages stay simple. Change both
 * together if the price ever changes.
 */

/* ==========================================================================
   DATES
   ========================================================================== */

/** The day every fact below was last read. Change only after a real re-check. */
export const CHECKED_ON = '2026-11-12'
/** First publication of the compare pages. */
export const PUBLISHED_ON = '2026-11-12'
/** The year in titles. Tied to the check, not the calendar. */
export const CHECKED_YEAR = CHECKED_ON.slice(0, 4)

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "12 November 2026" */
export function formatCheckedDate(iso: string = CHECKED_ON) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
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

/** How a system charges, in one chip. */
export type ChargeModel = 'fee-only' | 'subscription' | 'quote'

export const CHARGE_LABEL: Record<ChargeModel, string> = {
  'fee-only': 'No monthly fee',
  subscription: 'Monthly plan + fee',
  quote: 'Priced by quote',
}

/** How a feature reads at a glance. */
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
  { key: 'dynamicPricing', label: 'Prices that follow demand' },
]

export interface Vendor {
  id: VendorId
  name: string
  website: string
  /** A few words: who it suits, in our reading of its own pages. Editorial, not a fact. */
  bestFor: string
  charge: ChargeModel
  /** One short pricing line. */
  pricing: Fact
  /** Who pays the per-booking fee, in a few words. */
  whoPays: Fact
  owner: Fact
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
  captainbookFh: { label: 'CaptainBook (a competitor) on FareHarbor fees', url: 'https://www.captainbook.io/blog/fareharbor-pricing-fees-explained' },
  peek: { label: 'peekpro.com', url: 'https://peekpro.com/' },
  bokunOnPeek: { label: 'Bókun (a competitor) on Peek Pro pricing, 4 Aug 2025', url: 'https://www.bokun.io/peek-pro-pricing' },
  g2Peek: { label: 'G2 discussion on Peek Pro cost', url: 'https://g2.com/discussions/what-does-peek-pro-cost' },
  rezdyPricing: { label: 'Rezdy pricing', url: 'https://www.rezdy.com/pricing/' },
  rezdyFeatures: { label: 'Rezdy features', url: 'https://www.rezdy.com/features/' },
  merger: { label: 'Checkfront blog: merger with Rezdy and Regiondo', url: 'https://checkfront.com/blog/checkfront-announces-global-merger-with-rezdy-and-regiondo' },
  bokunPricing: { label: 'Bókun pricing', url: 'https://www.bokun.io/pricing' },
  bokunFeatures: { label: 'Bókun features', url: 'https://www.bokun.io/features' },
  bokunAbout: { label: 'Bókun about', url: 'https://www.bokun.io/about' },
  checkfrontPricing: { label: 'Checkfront pricing', url: 'https://www.checkfront.com/pricing/' },
  checkfrontFeatures: { label: 'Checkfront features', url: 'https://www.checkfront.com/features/' },
  checkfrontGift: { label: 'Checkfront gift certificates', url: 'https://www.checkfront.com/gift-certificates' },
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
    bestFor: 'A big partner network and no monthly bill',
    charge: 'fee-only',
    pricing: reported('$0 a month; booking fee not published, reported near 6%', S.captainbookFh),
    whoPays: official('Usually the guest', S.fhBlogFees),
    owner: official('Booking Holdings (Booking.com’s parent), since 2018', S.fhSec),
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
    bestFor: 'US rentals and water sports',
    charge: 'quote',
    pricing: reported('By quote; reported up to 6–8% per online booking', S.bokunOnPeek),
    whoPays: reported('Reports conflict', S.g2Peek),
    owner: official('Independent, venture-backed; also runs peek.com', S.peek),
    matrix: {
      walkUp: cell('yes', official('Yes, POS with tipping', S.peek)),
      waivers: cell('yes', official('Yes', S.peek)),
      transport: cell('not-shown', official('Not shown on its pages', S.peek)),
      rentals: cell('yes', official('Yes: deposits, card holds, photo records', S.peek)),
      giftCards: cell('limited', official('Lists “Vouchers”; gift cards not confirmed', S.peek)),
      dynamicPricing: cell('yes', official('Yes, with a minimum and maximum you set', S.peek)),
    },
    hasVsPage: true,
  },
  bokun: {
    id: 'bokun',
    name: 'Bókun',
    website: 'https://www.bokun.io/',
    bestFor: 'Viator sellers who want the lowest fees',
    charge: 'subscription',
    pricing: official('Free plan, or $49–$499 a month + 1–1.5%', S.bokunPricing),
    whoPays: official('You choose', S.bokunPricing),
    owner: official('Tripadvisor, since 2018', S.bokunAbout),
    matrix: {
      walkUp: cell('yes', official('Yes, POS', S.bokunFeatures)),
      waivers: cell('limited', official('Add-on', S.bokunFeatures)),
      transport: cell('yes', official('Pick-up and drop-off points', S.bokunFeatures)),
      rentals: cell('yes', official('Yes', S.bokunFeatures)),
      giftCards: cell('yes', official('From START', S.bokunPricing)),
      dynamicPricing: cell('limited', official('Seasonal pricing', S.bokunFeatures)),
    },
    hasVsPage: true,
  },
  rezdy: {
    id: 'rezdy',
    name: 'Rezdy',
    website: 'https://www.rezdy.com/',
    bestFor: 'Selling through agents and resellers',
    charge: 'subscription',
    pricing: official('$49–$249 a month + 3% online', S.rezdyPricing),
    whoPays: official('You choose', S.rezdyPricing),
    owner: official('Same group as Checkfront and Regiondo since 2023', S.merger),
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
    bestFor: 'Rentals and stays on one simple plan',
    charge: 'subscription',
    pricing: official('$99 a month + 3% online', S.checkfrontPricing),
    whoPays: official('You choose', S.checkfrontPricing),
    owner: official('Same group as Rezdy and Regiondo since 2023', S.merger),
    matrix: {
      walkUp: cell('not-shown', official('Not shown on its features page', S.checkfrontFeatures)),
      waivers: cell('yes', official('Included', S.checkfrontPricing)),
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
    bestFor: 'US attractions that want 24/7 support',
    charge: 'fee-only',
    pricing: official('$0 a month; 6% if guests pay, 3% if you pay', S.xolaGuest),
    whoPays: official('Depends on the plan', S.xolaCompany),
    owner: official('Xola Inc., independent', S.xolaFunding),
    matrix: {
      walkUp: cell('yes', official('POS and kiosk', S.xolaHome)),
      waivers: cell('yes', official('Built in', S.xolaHome)),
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
    bestFor: 'German-speaking ticketing',
    charge: 'subscription',
    pricing: official('€59–€99 a month + an unpublished fee; 1-year contract', S.regiondoPricing),
    whoPays: official('Not stated', S.regiondoPricing),
    owner: official('Same group as Rezdy and Checkfront since 2023', S.techcouver),
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
    bestFor: 'European parks, zoos and museums',
    charge: 'subscription',
    pricing: official('€49–€119 a month + 2–3%, plus ticket and payment fees', S.bookingkitPricing),
    whoPays: official('Not stated', S.bookingkitPricing),
    owner: official('Independent, Berlin', S.bookingkitPress),
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
    bestFor: 'Shuttles, ferries and transfers',
    charge: 'fee-only',
    pricing: official('Free plan + 6% online; Enterprise by quote', S.zauiPricing),
    whoPays: official('You choose', S.zauiPricing),
    owner: official('Independent, Vancouver', S.zauiVancouver),
    matrix: {
      walkUp: cell('yes', official('Booking Desk', S.zauiHome)),
      waivers: cell('limited', official('Through Smartwaiver', S.zauiHome)),
      transport: cell('yes', official('Routes, fleets, tracking, manifests', S.zauiHome)),
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
    bestFor: 'European operators who want set tiers',
    charge: 'subscription',
    pricing: official('€49–€249 a month, billed yearly, + 2–3%', S.trekksoftPricing),
    whoPays: official('Not stated', S.trekksoftPricing),
    owner: official('Tourism Software Group, Barcelona', S.trekksoftAbout),
    matrix: {
      walkUp: cell('yes', official('POS and mobile POS', S.trekksoftAbout)),
      waivers: cell('limited', official('From the €149 plan', S.trekksoftPricing)),
      transport: cell('limited', official('Markets a transport segment', S.trekksoftAbout)),
      rentals: cell('yes', official('Rental items', S.trekksoftAbout)),
      giftCards: cell('limited', official('From the €149 plan', S.trekksoftPricing)),
      dynamicPricing: cell('not-shown', official('Not shown on its pages', S.trekksoftPricing)),
    },
    hasVsPage: false,
  },
  ventrata: {
    id: 'ventrata',
    name: 'Ventrata',
    website: 'https://www.ventrata.com/',
    bestFor: 'Large attractions with turnstiles',
    charge: 'subscription',
    pricing: official('$575–$5,750 a month + 0.5–2%', S.ventrataPlans),
    whoPays: official('Not stated', S.ventrataPlans),
    owner: official('Independent, London', S.ventrataHome),
    matrix: {
      walkUp: cell('yes', official('POS, kiosks and turnstiles', S.ventrataPlans)),
      waivers: cell('not-shown', official('Not confirmed on its pages', S.ventrataHome)),
      transport: cell('not-shown', official('Not shown on its pages', S.ventrataHome)),
      rentals: cell('not-shown', official('Not shown on its pages', S.ventrataHome)),
      giftCards: cell('yes', official('Every plan', S.ventrataPlans)),
      dynamicPricing: cell('yes', official('Yes', S.ventrataHome)),
    },
    hasVsPage: false,
  },
}

/** Display order: the six leaders first, then the rest. */
export const VENDOR_ORDER: VendorId[] = ['fareharbor', 'peek-pro', 'bokun', 'rezdy', 'checkfront', 'xola', 'zaui', 'trekksoft', 'regiondo', 'bookingkit', 'ventrata']

/* ==========================================================================
   EZRA PRO — one plan
   ========================================================================== */

export const EZRA_PLAN = {
  name: 'EZRA Pro',
  /** Percentage of each booking. */
  percent: 4,
  /** Monthly subscription, whole dollars. */
  monthly: 0,
} as const

/** "4% per booking. $0 a month. No setup fee, no contract." */
export const EZRA_PRICE_LINE = `${EZRA_PLAN.percent}% per booking. $${EZRA_PLAN.monthly} a month. No setup fee, no contract.`

export const EZRA = {
  name: EZRA_PLAN.name,
  bestFor: 'Tours, rentals, rides and more in one place',
  charge: 'fee-only' as ChargeModel,
  pricing: official(`$${EZRA_PLAN.monthly} a month + ${EZRA_PLAN.percent}% per booking`, S.ezraPricing),
  whoPays: official('You choose: you, or the guest as a booking fee', S.ezraPricing),
  matrix: {
    walkUp: cell('yes', official('Walk-in desk for counter sales', S.ezraDemo)),
    waivers: cell('yes', official('Per activity; the booker or each guest signs', S.ezraDemo)),
    transport: cell('yes', official('Pickup and drop-off on any activity; rides by trip, hour or seat', S.ezraDemo)),
    rentals: cell('yes', official('Items with their own stock, by hour, day or set length', S.ezraDemo)),
    giftCards: cell('yes', official('Included in the one plan', S.ezraPricing)),
    dynamicPricing: cell('yes', official('Price rules, included in the one plan', S.ezraPricing)),
  } satisfies Record<MatrixKey, MatrixCell>,
}

/* ==========================================================================
   CALCULATOR RATES

   One row per plan whose monthly cost can be worked out from a published,
   or a clearly reported, rate: subscription plus a percentage of online
   bookings. Card processing is left out: few vendors publish it.
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
  /** A few words on who pays the percentage. */
  whoPays: string
  status: FactStatus
  source: Source
}

export const PLAN_RATES: PlanRate[] = [
  {
    id: 'ezra',
    vendor: 'ezra',
    vendorName: 'EZRA Pro',
    plan: 'One plan',
    currency: 'USD',
    monthly: EZRA_PLAN.monthly,
    percent: EZRA_PLAN.percent,
    whoPays: 'you choose who pays',
    status: 'official',
    source: S.ezraPricing,
  },
  { id: 'fareharbor', vendor: 'fareharbor', vendorName: 'FareHarbor', plan: 'Standard', currency: 'USD', monthly: 0, percent: 6, whoPays: 'usually the guest pays', status: 'reported', source: S.captainbookFh },
  { id: 'peek-pro', vendor: 'peek-pro', vendorName: 'Peek Pro', plan: 'Quoted', currency: 'USD', monthly: 0, percent: 6, whoPays: 'reports conflict on who pays', status: 'reported', source: S.bokunOnPeek },
  { id: 'xola-guest', vendor: 'xola', vendorName: 'Xola', plan: 'Guest Pays', currency: 'USD', monthly: 0, percent: 6, whoPays: 'the guest pays', status: 'official', source: S.xolaGuest },
  { id: 'xola-company', vendor: 'xola', vendorName: 'Xola', plan: 'Company Pays', currency: 'USD', monthly: 0, percent: 3, whoPays: 'you pay', status: 'official', source: S.xolaCompany },
  { id: 'zaui-free', vendor: 'zaui', vendorName: 'Zaui', plan: 'Free', currency: 'USD', monthly: 0, percent: 6, whoPays: 'you choose who pays', status: 'official', source: S.zauiPricing },
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
    whoPays: 'you choose who pays',
    status: 'official',
    source: S.rezdyPricing,
  })),
  { id: 'checkfront', vendor: 'checkfront', vendorName: 'Checkfront', plan: 'One plan', currency: 'USD', monthly: 99, percent: 3, whoPays: 'you choose who pays', status: 'official', source: S.checkfrontPricing },
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
    whoPays: 'you choose who pays',
    status: 'official',
    source: S.bokunPricing,
  })),
  { id: 'ventrata-standard', vendor: 'ventrata', vendorName: 'Ventrata', plan: 'Standard', currency: 'USD', monthly: 575, percent: 2, whoPays: 'who pays not stated', status: 'official', source: S.ventrataPlans },
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
    whoPays: 'billed yearly',
    status: 'official',
    source: S.trekksoftPricing,
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
    whoPays: 'plus €0.60 a ticket and a 3% payment fee',
    status: 'official',
    source: S.bookingkitPricing,
  })),
  { id: 'regiondo', vendor: 'regiondo', vendorName: 'Regiondo', plan: 'Grow', currency: 'EUR', monthly: 59, percent: null, whoPays: 'fee not published', status: 'official', source: S.regiondoPricing },
]

/** Platform cost for a month: subscription plus the percentage. null when the rate is unpublished. */
export function platformCost(rate: PlanRate, monthlyValue: number) {
  if (rate.percent === null) return null
  return rate.monthly + (monthlyValue * rate.percent) / 100
}

export function rateById(id: string) {
  const rate = PLAN_RATES.find((r) => r.id === id)
  if (!rate) throw new Error(`Missing plan rate ${id}`)
  return rate
}

/** Monthly online value at which plans `a` and `b` cost the same. null if they never cross. */
export function breakEven(aId: string, bId: string) {
  const a = rateById(aId)
  const b = rateById(bId)
  if (a.percent === null || b.percent === null || a.percent === b.percent) return null
  const value = ((b.monthly - a.monthly) / (a.percent - b.percent)) * 100
  return value > 0 ? value : null
}

/** "$1,549" */
export function money(amount: number, currency: Currency = 'USD') {
  const symbol = currency === 'EUR' ? '€' : '$'
  return `${symbol}${Math.round(amount).toLocaleString('en-US')}`
}

/* ==========================================================================
   PAGE INDEX
   ========================================================================== */

export const VS_SLUGS = ['fareharbor', 'peek-pro', 'bokun', 'rezdy', 'checkfront', 'xola'] as const
export type VsSlug = (typeof VS_SLUGS)[number]

export const ALTERNATIVES_SLUGS = ['fareharbor', 'peek-pro', 'rezdy'] as const
export type AlternativesSlug = (typeof ALTERNATIVES_SLUGS)[number]

export const ERROR_REPORT_EMAIL = 'hello@ezrapro.com'

export const officialFact = official
export const reportedFact = reported
