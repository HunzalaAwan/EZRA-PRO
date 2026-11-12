/**
 * Competitor facts for the /compare pages: EZRA Pro against FareHarbor,
 * Peek Pro and Bókun, and nobody else.
 *
 * Every claim about another company lives here, once, with the page it came
 * from, the day it was read and whether it is the vendor's own word
 * ('official') or somebody else's ('reported': a competitor's blog, a review
 * site). Pages print a small "Reported" badge beside reported facts and a
 * numbered footnote that leads to the source.
 *
 * Rules the copy follows:
 *   - "Not shown" means the feature was not on the vendor's own pages on the
 *     day checked. It never means the vendor lacks it.
 *   - Review ratings are not shown.
 *   - Prices are list prices in US dollars.
 *
 * EZRA Pro has one plan: 4% of each booking, $0 a month, no setup fee, no
 * contract. The business chooses whether it pays the 4% or passes it to
 * guests as a booking fee. Change EZRA_PLAN and the pricing page together if
 * the price ever changes.
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

/**
 * How a cell reads at a glance.
 *   value  a plain figure ("$0", "4%")
 *   yes    built in
 *   partly part of it, or an add-on
 *   no     not offered, or not shown on the vendor's pages
 */
export type CellTone = 'value' | 'yes' | 'partly' | 'no'

export interface Cell extends Fact {
  tone: CellTone
}

export type RowKey = 'monthly' | 'fee' | 'whoPays' | 'published' | 'rentals' | 'venues'

/** The six rows every comparison shows, in order. */
export const ROWS: { key: RowKey; label: string }[] = [
  { key: 'monthly', label: 'Monthly price' },
  { key: 'fee', label: 'Fee per booking' },
  { key: 'whoPays', label: 'Who pays the fee' },
  { key: 'published', label: 'Price published?' },
  { key: 'rentals', label: 'Rentals & transfers' },
  { key: 'venues', label: 'Restaurants & stays' },
]

export type VendorId = 'fareharbor' | 'peek-pro' | 'bokun'

export interface Vendor {
  id: VendorId
  name: string
  website: string
  /** One short line for link cards: the main difference on price. */
  hook: string
  cells: Record<RowKey, Cell>
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
  bokunPricing: { label: 'Bókun pricing', url: 'https://www.bokun.io/pricing' },
  bokunFeatures: { label: 'Bókun features', url: 'https://www.bokun.io/features' },
  bokunAbout: { label: 'Bókun about', url: 'https://www.bokun.io/about' },
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

function cell(tone: CellTone, fact: Fact): Cell {
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
    hook: 'Fee not published, reported near 6%',
    cells: {
      monthly: cell('value', official('$0', S.fhBlogFees)),
      fee: cell('value', reported('About 6%', S.captainbookFh)),
      whoPays: cell('value', official('Usually the guest', S.fhBlogFees)),
      published: cell('no', official('No', S.fhBlogFees)),
      rentals: cell('no', official('Not shown', S.fhWhatIs)),
      venues: cell('no', official('Not shown', S.fhWhatIs)),
    },
  },
  'peek-pro': {
    id: 'peek-pro',
    name: 'Peek Pro',
    website: 'https://peekpro.com/',
    hook: 'Priced by quote, reported up to 6–8%',
    cells: {
      monthly: cell('value', official('By quote', S.peek)),
      fee: cell('value', reported('Up to 6–8%', S.bokunOnPeek)),
      whoPays: cell('value', reported('Varies', S.g2Peek)),
      published: cell('no', official('No, by quote', S.peek)),
      rentals: cell('partly', official('Rentals only', S.peek)),
      venues: cell('no', official('Not shown', S.peek)),
    },
  },
  bokun: {
    id: 'bokun',
    name: 'Bókun',
    website: 'https://www.bokun.io/',
    hook: 'Lower fees, plus a monthly plan',
    cells: {
      monthly: cell('value', official('Free, or $49–$499', S.bokunPricing)),
      fee: cell('value', official('1–1.5% on paid plans', S.bokunPricing)),
      whoPays: cell('yes', official('You choose', S.bokunPricing)),
      published: cell('yes', official('Yes', S.bokunPricing)),
      rentals: cell('yes', official('Rentals and pickups', S.bokunFeatures)),
      venues: cell('no', official('Not shown', S.bokunFeatures)),
    },
  },
}

/** Display order. */
export const VENDOR_ORDER: VendorId[] = ['fareharbor', 'peek-pro', 'bokun']

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
  cells: {
    monthly: cell('value', official(`$${EZRA_PLAN.monthly}`, S.ezraPricing)),
    fee: cell('value', official(`${EZRA_PLAN.percent}%`, S.ezraPricing)),
    whoPays: cell('yes', official('You choose', S.ezraPricing)),
    published: cell('yes', official('Yes', S.ezraPricing)),
    rentals: cell('yes', official('Both, built in', S.ezraDemo)),
    venues: cell('yes', official('Both, built in', S.ezraDemo)),
  } satisfies Record<RowKey, Cell>,
}

/* ==========================================================================
   COST RATES

   Subscription plus a percentage of online bookings, from a published or a
   clearly reported rate. Card processing is left out: not every vendor
   publishes it.
   ========================================================================== */

export interface PlanRate {
  id: string
  vendor: VendorId | 'ezra'
  vendorName: string
  plan: string
  /** Monthly subscription in whole dollars. */
  monthly: number
  /** Percentage on online bookings. */
  percent: number
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
    monthly: EZRA_PLAN.monthly,
    percent: EZRA_PLAN.percent,
    whoPays: 'you choose who pays',
    status: 'official',
    source: S.ezraPricing,
  },
  { id: 'fareharbor', vendor: 'fareharbor', vendorName: 'FareHarbor', plan: 'Standard', monthly: 0, percent: 6, whoPays: 'usually the guest pays', status: 'reported', source: S.captainbookFh },
  { id: 'peek-pro', vendor: 'peek-pro', vendorName: 'Peek Pro', plan: 'Quoted', monthly: 0, percent: 6, whoPays: 'reports conflict on who pays', status: 'reported', source: S.bokunOnPeek },
  ...([
    ['START', 49, 1.5],
    ['PLUS', 149, 1.25],
    ['PREMIUM', 499, 1],
  ] as const).map<PlanRate>(([plan, monthly, percent]) => ({
    id: `bokun-${plan.toLowerCase()}`,
    vendor: 'bokun',
    vendorName: 'Bókun',
    plan,
    monthly,
    percent,
    whoPays: 'you choose who pays',
    status: 'official',
    source: S.bokunPricing,
  })),
]

/** Platform cost for a month: subscription plus the percentage. */
export function platformCost(rate: PlanRate, monthlyValue: number) {
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
  if (a.percent === b.percent) return null
  const value = ((b.monthly - a.monthly) / (a.percent - b.percent)) * 100
  return value > 0 ? value : null
}

/** "$1,549" */
export function money(amount: number) {
  return `$${Math.round(amount).toLocaleString('en-US')}`
}

/* ==========================================================================
   PAGE INDEX
   ========================================================================== */

export const VS_SLUGS = ['fareharbor', 'peek-pro', 'bokun'] as const satisfies readonly VendorId[]
export type VsSlug = (typeof VS_SLUGS)[number]

export const ERROR_REPORT_EMAIL = 'hello@ezrapro.com'
