/**
 * Competitor facts for the /compare pages: EZRA Pro against FareHarbor,
 * Peek Pro, Bókun, Checkfront, Xola, Bookeo and ROLLER.
 *
 * Every claim about another company lives here, once, with the page it came
 * from and whether it is the vendor's own word ('official') or somebody
 * else's ('reported': a review site, a competitor's blog, the press). Pages
 * list every source at the end, and the note under each table says which
 * figures are third-party estimates.
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
 * the price ever changes. EZRA Pro's own cells repeat what the pricing page
 * promises (src/content/marketing.ts, INCLUDED).
 */

/* ==========================================================================
   DATES
   ========================================================================== */

/** The day every fact below was last read. Change only after a real re-check. */
export const CHECKED_ON = '2026-11-16'
/** First publication of the compare pages. */
export const PUBLISHED_ON = '2026-11-12'
/** The year in titles. Tied to the check, not the calendar. */
export const CHECKED_YEAR = CHECKED_ON.slice(0, 4)

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** "16 November 2026" */
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

export type RowKey =
  | 'monthly'
  | 'fee'
  | 'whoPays'
  | 'published'
  | 'payments'
  | 'payouts'
  | 'otas'
  | 'crm'
  | 'reporting'
  | 'support'
  | 'waivers'
  | 'giftCards'
  | 'rentals'
  | 'venues'

export type RowGroup = 'Price' | 'Running the business' | 'What you can sell'

/** The rows every comparison shows, in order, under three headings. */
export const ROWS: { key: RowKey; label: string; group: RowGroup }[] = [
  { key: 'monthly', label: 'Monthly price', group: 'Price' },
  { key: 'fee', label: 'Fee per booking', group: 'Price' },
  { key: 'whoPays', label: 'Who pays the fee', group: 'Price' },
  { key: 'published', label: 'Price published?', group: 'Price' },
  { key: 'payments', label: 'Card payments', group: 'Running the business' },
  { key: 'payouts', label: 'Payouts', group: 'Running the business' },
  { key: 'otas', label: 'Viator, GetYourGuide & co.', group: 'Running the business' },
  { key: 'crm', label: 'Guest records & marketing', group: 'Running the business' },
  { key: 'reporting', label: 'Reports', group: 'Running the business' },
  { key: 'support', label: 'Support', group: 'Running the business' },
  { key: 'waivers', label: 'Digital waivers', group: 'What you can sell' },
  { key: 'giftCards', label: 'Gift cards', group: 'What you can sell' },
  { key: 'rentals', label: 'Rentals & transfers', group: 'What you can sell' },
  { key: 'venues', label: 'Restaurants & stays', group: 'What you can sell' },
]

export type VendorId = 'fareharbor' | 'peek-pro' | 'bokun' | 'checkfront' | 'xola' | 'bookeo' | 'roller'

export interface Vendor {
  id: VendorId
  name: string
  website: string
  /** One short line for link cards: the main difference on price. */
  hook: string
  /** Under the table: which of its figures are estimates, if any. */
  estimatesNote?: string
  cells: Record<RowKey, Cell>
}

/* ==========================================================================
   SOURCES
   ========================================================================== */

const S = {
  // FareHarbor
  fhBlogFees: { label: 'FareHarbor blog, 21 Aug 2024', url: 'https://fareharbor.com/blog/what-to-look-for-in-your-next-booking-system/' },
  fhWhatIs: { label: 'FareHarbor blog, 11 Jun 2026', url: 'https://fareharbor.com/blog/what-is-fareharbor/' },
  fhTos: { label: 'FareHarbor terms for providers', url: 'https://fareharbor.com/legal/tos' },
  fhPayouts: { label: 'FareHarbor help: payouts', url: 'https://help.fareharbor.com/hc/en-us/articles/40898001686043-Payouts' },
  fhOtas: { label: 'FareHarbor Compass: partners and resellers', url: 'https://compass.fareharbor.com/guides/articles/increase-online-bookings-with-partnerships-resellers' },
  fhIntegrations: { label: 'FareHarbor blog: Mailchimp and HubSpot integrations', url: 'https://fareharbor.com/blog/powering-smarter-operations-new-integrations-with-lightspeed-mailchimp-and-hubspot' },
  fhRentals: { label: 'FareHarbor rentals', url: 'https://fareharbor.com/solutions/rentals' },
  fhWelcome: { label: 'FareHarbor welcome page', url: 'https://fareharbor.com/about/welcome-newcompany' },
  fhWaivers: { label: 'FareHarbor blog: free waivers', url: 'https://fareharbor.com/blog/waiver-management-made-easy-our-free-in-house-waiver-solution-is-here' },
  fhGift: { label: 'FareHarbor blog: 2023 product updates', url: 'https://fareharbor.com/blog/6-fareharbor-product-updates-that-will-improve-your-operations-in-2023' },
  fhSec: { label: 'Booking Holdings 10-K, FY2018', url: 'https://www.sec.gov/Archives/edgar/data/1075531/000107553119000009/bkng1231201810k.htm' },
  captainbookFh: { label: 'CaptainBook (a competitor) on FareHarbor fees', url: 'https://www.captainbook.io/blog/fareharbor-pricing-fees-explained' },
  capterraFh: { label: 'Capterra: FareHarbor reviews', url: 'https://www.capterra.com/p/135106/FareHarbor/reviews/' },
  // Peek Pro
  peek: { label: 'peekpro.com', url: 'https://www.peekpro.com/' },
  peekTerms: { label: 'Peek merchant agreement', url: 'https://www.peekpro.com/terms' },
  peekGrow: { label: 'Peek Pro: grow bookings', url: 'https://www.peekpro.com/product/grow-revenue' },
  peekHawaii: { label: 'Peek Pro plan table', url: 'https://www.peekpro.com/hawaii' },
  peekSupport: { label: 'Peek Pro support', url: 'https://www.peekpro.com/support' },
  peekRentals: { label: 'Peek Pro rentals', url: 'https://www.peekpro.com/rentals' },
  bokunOnPeek: { label: 'Bókun (a competitor) on Peek Pro pricing, 4 Aug 2025', url: 'https://www.bokun.io/peek-pro-pricing' },
  g2Peek: { label: 'G2 discussion on Peek Pro cost', url: 'https://g2.com/discussions/what-does-peek-pro-cost' },
  saPeek: { label: 'Software Advice: Peek Pro reviews', url: 'https://www.softwareadvice.com/scheduling/peek-pro-profile/reviews/' },
  capterraPeek: { label: 'Capterra: Peek Pro reviews', url: 'https://www.capterra.com/p/142459/Peek-PRO-Tour-Operator-Software/reviews/' },
  // Bókun
  bokunPricing: { label: 'Bókun pricing', url: 'https://www.bokun.io/pricing' },
  bokunFeatures: { label: 'Bókun features', url: 'https://www.bokun.io/features' },
  bokunAbout: { label: 'Bókun about', url: 'https://www.bokun.io/about' },
  bokunPayments: { label: 'Bókun docs: payment providers', url: 'https://docs.bokun.io/en/articles/280-payment-providers' },
  bokunExpedia: { label: 'Bókun: Expedia supplier guide', url: 'https://www.bokun.io/expedia-supplier' },
  bokunComms: { label: 'Bókun: customer communications', url: 'https://www.bokun.io/manage/customer-communications' },
  bokunReports: { label: 'Bókun docs: custom reports', url: 'https://docs.bokun.io/docs/apps-and-the-bokun-app-store/custom-reports' },
  bokunWaivers: { label: 'Bókun docs: Adventure Waivers app', url: 'https://docs.bokun.io/docs/apps-and-the-bokun-app-store/adventure-waivers' },
  bokunGift: { label: 'Bókun docs: gift cards', url: 'https://docs.bokun.io/en/articles/346-creating-value-gift-cards-to-sell-your-products' },
  bokunResources: { label: 'Bókun: resource management', url: 'https://www.bokun.io/resource-management' },
  bokunExport: { label: 'Bókun docs: managing customers', url: 'https://docs.bokun.io/docs/operations/customers/how-to-manage-your-customers-pro' },
  capterraBokun: { label: 'Capterra: Bókun reviews', url: 'https://www.capterra.com/p/178518/Bokun/reviews/' },
  // Checkfront
  cfPricing: { label: 'Checkfront pricing', url: 'https://www.checkfront.com/pricing/' },
  cfPayments: { label: 'Checkfront Payments', url: 'https://www.checkfront.com/payments' },
  cfTours: { label: 'Checkfront for tours', url: 'https://checkfront.com/tours' },
  cfContact: { label: 'Checkfront contact', url: 'https://www.checkfront.com/contact' },
  cfGift: { label: 'Checkfront gift certificates', url: 'https://www.checkfront.com/gift-certificates' },
  cfRentals: { label: 'Checkfront rentals', url: 'https://www.checkfront.com/rentals' },
  cfMerger: { label: 'Checkfront blog: merger with Rezdy and Regiondo', url: 'https://checkfront.com/blog/checkfront-announces-global-merger-with-rezdy-and-regiondo' },
  cfPress: { label: 'Checkfront press', url: 'https://checkfront.com/company/press' },
  cfExport: { label: 'Checkfront help: export your customer directory', url: 'https://support.checkfront.com/hc/articles/19868609492508' },
  capterraCf: { label: 'Capterra: Checkfront reviews', url: 'https://www.capterra.com/p/99249/Checkfront/reviews/' },
  capterraNzCf: { label: 'Capterra NZ: Checkfront reviews', url: 'https://www.capterra.co.nz/reviews/99249/checkfront' },
  // Xola
  xolaPricing: { label: 'Xola pricing', url: 'https://www.xola.com/pricing' },
  xolaStdGuest: { label: 'Xola help: Flex Standard (guest pays)', url: 'https://support.xola.com/flex-standard-guest-pays' },
  xolaStdCompany: { label: 'Xola help: Flex Standard (company pays)', url: 'https://support.xola.com/flex-standard-company-pays' },
  xolaLevelCompany: { label: 'Xola help: Flex Level (company pays)', url: 'https://support.xola.com/flex-level-company-pays' },
  xolaPayouts: { label: 'Xola help: payouts report', url: 'https://support.xola.com/payouts-reports' },
  xolaOtas: { label: 'Xola distribution', url: 'https://www.xola.com/distribution-resale-otas/' },
  xolaContacts: { label: 'Xola help: contacts', url: 'https://support.xola.com/xolas-contacts' },
  xolaReports: { label: 'Xola help: custom reports', url: 'https://support.xola.com/custom-reports' },
  xolaSupport: { label: 'Xola support', url: 'https://www.xola.com/support/' },
  xolaHome: { label: 'xola.com', url: 'https://www.xola.com/' },
  xolaGift: { label: 'Xola help: gifts', url: 'https://support.xola.com/gifts-and-gift-offers' },
  xolaEquipment: { label: 'Xola equipment management', url: 'https://www.xola.com/equipment-management/' },
  xolaAbout: { label: 'Xola about', url: 'https://www.xola.com/about/' },
  capterraXola: { label: 'Capterra: Xola reviews', url: 'https://www.capterra.com/p/132175/Xola-Booking-and-Marketing-System/reviews/' },
  // Bookeo
  bookeoPricing: { label: 'Bookeo tours pricing', url: 'https://www.bookeo.com/tours/pricing/' },
  bookeoTours: { label: 'Bookeo tours and activities', url: 'https://www.bookeo.com/tours/' },
  bookeoPayments: { label: 'Bookeo online payments', url: 'https://www.bookeo.com/tours/features/online-payments/' },
  bookeoIntegrations: { label: 'Bookeo integrations', url: 'https://www.bookeo.com/integrations/' },
  bookeoChannels: { label: 'Bookeo distribution channels', url: 'https://www.bookeo.com/distribution-channels/' },
  bookeoCustomers: { label: 'Bookeo customer database', url: 'https://www.bookeo.com/tours/features/customer-database/' },
  bookeoAnalytics: { label: 'Bookeo reports', url: 'https://www.bookeo.com/tours/features/analytics/' },
  bookeoContact: { label: 'Bookeo contact', url: 'https://www.bookeo.com/contact/' },
  bookeoMarketing: { label: 'Bookeo marketing features', url: 'https://www.bookeo.com/tours/features/marketing-features/' },
  bookeoApi: { label: 'Bookeo API', url: 'https://www.bookeo.com/api/' },
  capterraBookeo: { label: 'Capterra: Bookeo reviews', url: 'https://capterra.com/p/117299/Bookeo/reviews/' },
  trustradiusBookeo: { label: 'TrustRadius: Bookeo reviews', url: 'https://www.trustradius.com/products/bookeo/reviews/all' },
  // ROLLER
  rollerHome: { label: 'roller.software', url: 'https://www.roller.software/' },
  rollerPricing: { label: 'ROLLER pricing', url: 'https://www.roller.software/pricing/' },
  rollerPayments: { label: 'ROLLER help: ROLLER Payments', url: 'https://mysupport.roller.software/docs/get-started-with-roller-payments' },
  rollerPayouts: { label: 'ROLLER help: settlements and payouts', url: 'https://mysupport.roller.software/docs/how-roller-payments-handles-settlements-payouts-and-refunds' },
  rollerChannels: { label: 'ROLLER help: channel management', url: 'https://mysupport.roller.software/docs/channel-management-faqs' },
  rollerReports: { label: 'ROLLER help: download reports', url: 'https://mysupport.roller.software/docs/download-reports' },
  rollerSupport: { label: 'ROLLER help: contact support', url: 'https://mysupport.roller.software/docs/contact-roller-support' },
  rollerCancel: { label: 'ROLLER help: cancellations', url: 'https://mysupport.roller.software/docs/subscription-upgrades-downgrades-cancellations' },
  rollerExport: { label: 'ROLLER help: export guest records', url: 'https://mysupport.roller.software/docs/export-guest-records-to-a-csv-file' },
  rollerPress: { label: 'ROLLER press release, Oct 2025', url: 'https://www.aap.com.au/aapreleases/cision20251022ae03813' },
  trustradiusRoller: { label: 'TrustRadius: ROLLER pricing', url: 'https://trustradius.com/products/roller/pricing' },
  capterraRoller: { label: 'Capterra: ROLLER reviews', url: 'https://www.capterra.com/p/164715/ROLLER/reviews/' },
  // EZRA Pro
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
    estimatesNote: 'FareHarbor doesn’t publish its fee, so that figure is a third-party estimate.',
    cells: {
      monthly: cell('value', official('$0', S.fhBlogFees)),
      fee: cell('value', reported('About 6%', S.captainbookFh)),
      whoPays: cell('value', official('The guest, by default', S.fhTos)),
      published: cell('no', official('No', S.fhBlogFees)),
      payments: cell('value', official('Its own payments', S.fhTos)),
      payouts: cell('yes', official('Daily by default', S.fhPayouts)),
      otas: cell('yes', official('Viator, GetYourGuide, Expedia', S.fhOtas)),
      crm: cell('partly', official('Through Mailchimp, HubSpot', S.fhIntegrations)),
      reporting: cell('yes', official('Custom reports', S.fhRentals)),
      support: cell('yes', official('24/7 by email', S.fhWelcome)),
      waivers: cell('yes', official('Built in, free', S.fhWaivers)),
      giftCards: cell('yes', official('Yes', S.fhGift)),
      rentals: cell('partly', official('Equipment rentals', S.fhRentals)),
      venues: cell('no', official('Not shown', S.fhWhatIs)),
    },
  },
  'peek-pro': {
    id: 'peek-pro',
    name: 'Peek Pro',
    website: 'https://www.peekpro.com/',
    hook: 'Priced by quote, reported up to 6–8%',
    estimatesNote: 'Peek Pro prices by quote, so its fee is a third-party estimate.',
    cells: {
      monthly: cell('value', official('By quote', S.peek)),
      fee: cell('value', reported('Up to 6–8%', S.bokunOnPeek)),
      whoPays: cell('value', reported('Varies', S.g2Peek)),
      published: cell('no', official('No, by quote', S.peek)),
      payments: cell('value', official('Its own payments', S.peekTerms)),
      payouts: cell('yes', official('Each business day', S.peekTerms)),
      otas: cell('yes', official('Viator, GetYourGuide', S.peek)),
      crm: cell('yes', official('Emails, Mailchimp, Klaviyo', S.peekGrow)),
      reporting: cell('partly', official('Analytics, by plan', S.peekHawaii)),
      support: cell('yes', official('Phone and chat, 7 days', S.peekSupport)),
      waivers: cell('yes', official('Built in, free', S.peekRentals)),
      giftCards: cell('yes', official('Yes', S.peekGrow)),
      rentals: cell('partly', official('Rentals, card holds', S.peekRentals)),
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
      payments: cell('yes', official('Your choice of processor', S.bokunPayments)),
      payouts: cell('partly', official('Set by your processor', S.bokunPayments)),
      otas: cell('yes', official('70+, incl. Viator, Expedia', S.bokunExpedia)),
      crm: cell('yes', official('Simple CRM, emails', S.bokunComms)),
      reporting: cell('yes', official('Custom reports', S.bokunReports)),
      support: cell('partly', official('Chat, 7am–11:30pm GMT', S.bokunPricing)),
      waivers: cell('partly', official('Through an add-on app', S.bokunWaivers)),
      giftCards: cell('yes', official('Yes, on paid plans', S.bokunGift)),
      rentals: cell('partly', official('Shared resources', S.bokunResources)),
      venues: cell('no', official('Not shown', S.bokunFeatures)),
    },
  },
  checkfront: {
    id: 'checkfront',
    name: 'Checkfront',
    website: 'https://www.checkfront.com/',
    hook: '$99 a month plus 3% online',
    cells: {
      monthly: cell('value', official('$99', S.cfPricing)),
      fee: cell('value', official('3% on online bookings', S.cfPricing)),
      whoPays: cell('yes', official('You choose', S.cfPricing)),
      published: cell('yes', official('Yes', S.cfPricing)),
      payments: cell('yes', official('Its own, or 30+ others', S.cfPayments)),
      payouts: cell('partly', official('Rolling, 2–7 days', S.cfPayments)),
      otas: cell('yes', official('Viator, GetYourGuide, Expedia', S.cfTours)),
      crm: cell('partly', official('Customer accounts, emails', S.cfTours)),
      reporting: cell('yes', official('Sales reports', S.cfTours)),
      support: cell('partly', official('Phone and chat, 24/5', S.cfContact)),
      waivers: cell('yes', official('Built in, free', S.cfPricing)),
      giftCards: cell('yes', official('Gift certificates', S.cfGift)),
      rentals: cell('partly', official('Equipment stock', S.cfRentals)),
      venues: cell('partly', official('Rooms, no tables', S.cfRentals)),
    },
  },
  xola: {
    id: 'xola',
    name: 'Xola',
    website: 'https://www.xola.com/',
    hook: 'No subscription, 3% or 6% a booking',
    cells: {
      monthly: cell('value', official('$0', S.xolaPricing)),
      fee: cell('value', official('3% or 6%, plus card fees', S.xolaStdGuest)),
      whoPays: cell('yes', official('Guest or you, by plan', S.xolaLevelCompany)),
      published: cell('partly', official('In its help pages', S.xolaPricing)),
      payments: cell('value', official('Built in (Stripe)', S.xolaPayouts)),
      payouts: cell('yes', official('Daily, weekly or monthly', S.xolaPayouts)),
      otas: cell('yes', official('Viator, GetYourGuide, Expedia', S.xolaOtas)),
      crm: cell('partly', official('Contacts, Mailchimp export', S.xolaContacts)),
      reporting: cell('yes', official('Custom reports', S.xolaReports)),
      support: cell('yes', official('24/7 phone and chat', S.xolaSupport)),
      waivers: cell('yes', official('Built in', S.xolaHome)),
      giftCards: cell('yes', official('Gift certificates', S.xolaGift)),
      rentals: cell('partly', official('Equipment for tours', S.xolaEquipment)),
      venues: cell('no', official('Not shown', S.xolaHome)),
    },
  },
  bookeo: {
    id: 'bookeo',
    name: 'Bookeo',
    website: 'https://www.bookeo.com/',
    hook: 'Flat monthly fee, no booking fee',
    cells: {
      monthly: cell('value', official('$14.95–$119.95', S.bookeoPricing)),
      fee: cell('value', official('None', S.bookeoPayments)),
      whoPays: cell('value', official('No fee to pass on', S.bookeoPricing)),
      published: cell('yes', official('Yes', S.bookeoPricing)),
      payments: cell('yes', official('Your choice of processor', S.bookeoIntegrations)),
      payouts: cell('partly', official('Set by your processor', S.bookeoPayments)),
      otas: cell('yes', official('Viator, GetYourGuide, Expedia', S.bookeoChannels)),
      crm: cell('partly', official('Customer list, Mailchimp', S.bookeoCustomers)),
      reporting: cell('yes', official('Reports', S.bookeoAnalytics)),
      support: cell('partly', official('Email and help portal', S.bookeoContact)),
      waivers: cell('partly', official('Add-on, from $9 a month', S.bookeoPricing)),
      giftCards: cell('yes', official('Gift vouchers', S.bookeoMarketing)),
      rentals: cell('no', official('Not shown', S.bookeoTours)),
      venues: cell('no', official('Not shown', S.bookeoTours)),
    },
  },
  roller: {
    id: 'roller',
    name: 'ROLLER',
    website: 'https://www.roller.software/',
    hook: 'Venue software, priced by quote',
    estimatesNote: 'ROLLER prices by quote and doesn’t publish its fees.',
    cells: {
      monthly: cell('value', official('By quote', S.rollerPricing)),
      fee: cell('value', official('Usage fees, not published', S.rollerPricing)),
      whoPays: cell('no', official('Not shown', S.rollerPricing)),
      published: cell('no', official('No, by quote', S.rollerPricing)),
      payments: cell('value', official('Its own payments', S.rollerPayments)),
      payouts: cell('yes', official('Daily, 0–2 days', S.rollerPayouts)),
      otas: cell('partly', official('Viator, GetYourGuide (add-on)', S.rollerChannels)),
      crm: cell('yes', official('CRM and loyalty', S.rollerHome)),
      reporting: cell('yes', official('Reports, CSV export', S.rollerReports)),
      support: cell('yes', official('24/7 chat and phone', S.rollerSupport)),
      waivers: cell('yes', official('Built in', S.rollerHome)),
      giftCards: cell('yes', official('Yes', S.rollerHome)),
      rentals: cell('no', official('Not shown', S.rollerHome)),
      venues: cell('partly', official('Food ordering only', S.rollerPricing)),
    },
  },
}

/** Display order. */
export const VENDOR_ORDER: VendorId[] = ['fareharbor', 'peek-pro', 'bokun', 'checkfront', 'xola', 'bookeo', 'roller']

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
    payments: cell('yes', official('Stripe, built in', S.ezraPricing)),
    payouts: cell('yes', official('Next business day', S.ezraPricing)),
    otas: cell('yes', official('Viator, GetYourGuide, Expedia', S.ezraPricing)),
    crm: cell('yes', official('Guest records, emails, texts', S.ezraDemo)),
    reporting: cell('yes', official('Reports and plain insights', S.ezraPricing)),
    support: cell('yes', official('7 days a week', S.ezraPricing)),
    waivers: cell('yes', official('Built in', S.ezraPricing)),
    giftCards: cell('yes', official('Gift cards, memberships', S.ezraPricing)),
    rentals: cell('yes', official('Both, built in', S.ezraDemo)),
    venues: cell('yes', official('Both, built in', S.ezraDemo)),
  } satisfies Record<RowKey, Cell>,
}

/* ==========================================================================
   COST RATES

   Subscription plus a percentage of online bookings, from a published or a
   clearly reported rate, as the business pays it. Card processing is left
   out: not every vendor publishes it. ROLLER has no rate: it prices by quote.
   ========================================================================== */

export interface PlanRate {
  id: string
  vendor: VendorId | 'ezra'
  vendorName: string
  plan: string
  /** Monthly subscription in dollars. */
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
  { id: 'checkfront', vendor: 'checkfront', vendorName: 'Checkfront', plan: 'One plan', monthly: 99, percent: 3, whoPays: 'you choose who pays', status: 'official', source: S.cfPricing },
  { id: 'xola-standard', vendor: 'xola', vendorName: 'Xola', plan: 'Flex Standard', monthly: 0, percent: 6, whoPays: 'you pay (Company Pays)', status: 'official', source: S.xolaStdCompany },
  { id: 'xola-level', vendor: 'xola', vendorName: 'Xola', plan: 'Flex Level', monthly: 0, percent: 3, whoPays: 'you pay (Company Pays)', status: 'official', source: S.xolaLevelCompany },
  ...([
    ['Standard', 39.95],
    ['Large', 79.95],
    ['X-large', 119.95],
  ] as const).map<PlanRate>(([plan, monthly]) => ({
    id: `bookeo-${plan.toLowerCase()}`,
    vendor: 'bookeo',
    vendorName: 'Bookeo',
    plan,
    monthly,
    percent: 0,
    whoPays: 'no booking fee',
    status: 'official',
    source: S.bookeoPricing,
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

export const VS_SLUGS = ['fareharbor', 'peek-pro', 'bokun', 'checkfront', 'xola', 'bookeo', 'roller'] as const satisfies readonly VendorId[]
export type VsSlug = (typeof VS_SLUGS)[number]

export const ERROR_REPORT_EMAIL = 'hello@ezrapro.com'
