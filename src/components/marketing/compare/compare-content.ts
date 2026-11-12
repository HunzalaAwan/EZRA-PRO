/**
 * Copy for the /compare and /alternatives pages.
 *
 * Every page has its own argument, its own table rows, strengths, switching
 * notes and questions: nothing here is a template with the name swapped.
 * Facts about other vendors come from `@/lib/data/competitors` (with their
 * sources and status). Facts about EZRA Pro are the product's own: plan
 * numbers from the pricing page data, checkout lines from the storefront, and
 * features that exist in the dashboard.
 */

import {
  ALTERNATIVES_SLUGS,
  CHECKED_YEAR,
  EZRA,
  EZRA_CHECKOUT,
  EZRA_PLANS,
  SOURCES as S,
  VENDORS,
  VS_SLUGS,
  breakEven,
  formatCheckedMonth,
  money,
  officialFact as official,
  platformCost,
  rateById,
  reportedFact as reported,
  type AlternativesSlug,
  type Fact,
  type Source,
  type VendorId,
  type VsSlug,
} from '@/lib/data/competitors'

/* ==========================================================================
   SHARED NUMBERS
   ========================================================================== */

const MONTH = formatCheckedMonth()
const Y = CHECKED_YEAR

const [STARTER, GROWTH, SCALE] = EZRA_PLANS
const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`

/** Platform cost of a plan rate at a monthly online value, as money. */
const at = (id: string, value: number) => money(platformCost(rateById(id), value) ?? 0)
const roundTo = (n: number, step = 100) => Math.round(n / step) * step
const be = (a: string, b: string) => {
  const v = breakEven(a, b)
  return v === null ? null : money(roundTo(v))
}

const EZRA_RATES_LINE = `${money(STARTER.monthly)} a month on ${STARTER.name}, ${money(GROWTH.monthly)} on ${GROWTH.name} or ${money(SCALE.monthly)} on ${SCALE.name}, with commission of ${pct(STARTER.percent)}, ${pct(GROWTH.percent)} or ${pct(SCALE.percent)}`
const GUEST_LINES = `a ${EZRA_CHECKOUT.bookingFeePercent}% booking fee and ${EZRA_CHECKOUT.processingPercent}% card processing`

/* ==========================================================================
   EZRA PRO FACTS USED IN TABLES (checked in the product)
   ========================================================================== */

const ez = {
  walkIn: official('Walk-in desk: new sale, a log of walk-ins, and walk-in revenue reported apart', S.ezraDemo),
  waivers: official('Yes, set per activity: the booker or each guest signs. Included from Starter', S.ezraPricing),
  transport: official('Pickup, drop-off or both on any activity, by pickup zone, free or priced per guest or per booking; a 7-day pickups board by shuttle run', S.ezraDemo),
  transfers: official('Vehicles with a driver, sold by trip, by the hour or as shared seats', S.ezraDemo),
  rentals: official('Items with their own stock under one link, by hour, day or set length; availability checks overlapping hires; a refundable deposit per item', S.ezraDemo),
  packages: official('Yes: a package books onto each included activity’s own times', S.ezraDemo),
  dining: official('Restaurant ordering and a small-hotel storefront on the same platform', S.ezraDemo),
  capacity: official('Spots per time slot, different by weekday or date, plus extra spots sold at their own price once the usual ones fill', S.ezraDemo),
  priceRules: official(`Seasons, weekdays, time of day, dates, book early, last minute, filling up, quiet times and group size. The pricing page lists dynamic pricing on ${SCALE.name}`, S.ezraPricing),
  channels: official(`OTA channel manager (Viator, GetYourGuide, Expedia) on ${GROWTH.name} and above, per the pricing page`, S.ezraPricing),
  giftCards: official(`Gift cards and promotions on ${SCALE.name} (${money(SCALE.monthly)} a month), per the pricing page`, S.ezraPricing),
  notifications: official('Email and SMS confirmations on every plan; automated message flows built on bookings', S.ezraPricing),
  trial: official(`${STARTER.name} has no monthly fee; ${GROWTH.name} and ${SCALE.name} have a 14-day trial`, S.ezraPricing),
  contract: official('No contract; cancel any time', S.ezraPricing),
  api: official(`Open API and webhooks on ${SCALE.name}`, S.ezraPricing),
  soldOut: official('No waitlist; a full time slot suggests other days and activities you choose', S.ezraDemo),
  unfinished: official('An unfinished bookings list to follow up guests who left checkout', S.ezraDemo),
  support: official('Support 7 days a week on every plan, per the pricing page', S.ezraPricing),
  offline: official('No separate rate for offline or OTA bookings is set out on the pricing page', S.ezraPricing),
  automation: official('Automated flows on real bookings: reminders, follow-ups and offers', S.ezraDemo),
}

/* ==========================================================================
   TYPES
   ========================================================================== */

export interface TableRow {
  label: string
  them: Fact
  us: Fact
}

export interface Point {
  title: string
  body: string
  source?: Source
  reported?: boolean
}

export interface Faq {
  q: string
  a: string
  source?: Source
  reported?: boolean
}

export interface VsContent {
  slug: VsSlug
  vendor: VendorId
  title: string
  description: string
  h1: string
  lede: string
  verdict: { them: string[]; us: string[] }
  rows: TableRow[]
  cost: { intro: string; points: string[]; value: number }
  strengths: Point[]
  differences: Point[]
  switching: { intro: string; steps: Point[] }
  faqs: Faq[]
  alternatives?: AlternativesSlug
  related: VsSlug[]
}

/* ==========================================================================
   VS PAGES
   ========================================================================== */

const FH = VENDORS.fareharbor
const PEEK = VENDORS['peek-pro']
const BOKUN = VENDORS.bokun
const REZDY = VENDORS.rezdy
const CF = VENDORS.checkfront
const XOLA = VENDORS.xola

export const VS_CONTENT: Record<VsSlug, VsContent> = {
  /* ------------------------------------------------------------------ */
  fareharbor: {
    slug: 'fareharbor',
    vendor: 'fareharbor',
    title: `EZRA Pro vs FareHarbor: Fees, Features & Fit (${Y})`,
    description: `FareHarbor adds a booking fee your guests pay at checkout. See how EZRA Pro compares on cost, rentals, transfers and day-of tools. Checked ${MONTH}.`,
    h1: 'EZRA Pro vs FareHarbor',
    lede: `FareHarbor is the system many tour operators start on. It charges nothing a month and adds a booking fee at checkout, but it doesn’t publish the rate. EZRA Pro publishes its rates, and as its storefront is set up today it also shows guests a booking fee. This page compares the two on cost, on what you can sell, and on the work of the day.`,
    verdict: {
      them: [
        'You want the most widely used system in the category. FareHarbor says it has more than 23,000 clients.',
        'Distribution is your priority. FareHarbor claims more than 250 distribution partners.',
        'You want a website (FareHarbor Sites), a walk-up POS (FareHarbor Dock) and a staff app from one supplier.',
        'You are comfortable getting the booking fee rate from sales rather than a price list.',
      ],
      us: [
        `You want every rate in writing before you sign: ${EZRA_RATES_LINE}.`,
        'You sell more than scheduled tours: rentals with their own stock, vehicles with a driver, passes, packages and lessons, from one dashboard.',
        'Pickups are part of your day. EZRA Pro adds pickup and drop-off to any activity and plans the week on a pickups board.',
        'You also run a restaurant, café or a few rooms and want them on the same platform.',
      ],
    },
    rows: [
      { label: 'Monthly subscription', them: FH.monthly, us: EZRA.monthly },
      { label: 'Fee on online bookings', them: FH.fee, us: EZRA.fee },
      { label: 'Who pays at checkout', them: FH.whoPays, us: EZRA.whoPays },
      { label: 'Card processing', them: FH.processing, us: EZRA.processing },
      { label: 'Walk-up sales', them: FH.matrix.walkUp, us: ez.walkIn },
      { label: 'Waivers', them: FH.matrix.waivers, us: ez.waivers },
      { label: 'Pickups and drop-offs', them: FH.matrix.transport, us: ez.transport },
      { label: 'Rentals', them: FH.matrix.rentals, us: ez.rentals },
      { label: 'Packages', them: official('Yes', S.fhWhatIs), us: ez.packages },
      { label: 'Distribution', them: official('Claims 250+ distribution partners', S.fhWhatIs), us: ez.channels },
      { label: 'Restaurant or rooms', them: official('Not shown on its pages', S.fhWhatIs), us: ez.dining },
    ],
    cost: {
      value: 10_000,
      intro: 'FareHarbor’s rate is not published, so its row uses the 6% most third parties report. Change the numbers to match your own season.',
      points: [
        `At $10,000 a month of online bookings, a 6% fee is about ${at('fareharbor', 10_000)}, which FareHarbor says is usually paid by the guest.`,
        `EZRA Pro’s commission on the same month is ${at('ezra-starter', 10_000)} on ${STARTER.name}, ${at('ezra-growth', 10_000)} on ${GROWTH.name} and ${at('ezra-scale', 10_000)} on ${SCALE.name}, subscription included.`,
        `On top of the price, EZRA Pro’s storefront currently shows guests ${GUEST_LINES}. FareHarbor doesn’t publish what its guests see, so the two guest totals can’t be compared line for line.`,
      ],
    },
    strengths: [
      { title: 'Proven at volume', body: 'FareHarbor says it serves more than 23,000 clients and takes 53.5 bookings a minute. Few systems in this category have been run by that many businesses.', source: S.fhWhatIs },
      { title: 'People on the phone', body: 'It reports more than 120 support agents across Denver, Amsterdam and Sydney, which covers most time zones an operator works in.', source: S.fhWhatIs },
      { title: 'A wide product', body: 'Online booking, channel management, waivers, a POS (Dock), waitlists, packages, websites (FareHarbor Sites), memberships, payments, staff tools and an iOS and Android app.', source: S.fhWhatIs },
      { title: 'Nothing to pay in a quiet month', body: 'For a seasonal business, no subscription is a real advantage. The cost sits in the booking fee instead, and FareHarbor passes that to the guest.', source: S.fhBlogFees },
    ],
    differences: [
      { title: 'Our numbers are on the page', body: `EZRA Pro’s pricing page lists ${EZRA_RATES_LINE}. The checkout shows the booking fee and card processing as separate lines. FareHarbor’s rate comes from sales.` },
      { title: 'One dashboard for a mixed catalogue', body: 'Tours, activities, private charters, rentals, lessons, passes, packages and transfers each have their own setup. Rentals keep stock per item and check overlapping hires, so the same kayak isn’t sold twice.' },
      { title: 'Transport built in', body: 'Add pickup, drop-off or both to any activity, free or priced per guest or per booking by pickup zone. Sell vehicles with a driver by the trip, by the hour or as shared seats. FareHarbor’s pages didn’t show a pickup feature when we checked.' },
      { title: 'Capacity that matches your week', body: 'Set spots per time slot, more on busy weekdays or single dates, and extra spots sold at their own price once the usual ones fill.' },
      { title: 'Food and rooms too', body: 'If you also run a café, restaurant or a few rooms, EZRA Pro takes food orders and room bookings on the same platform.' },
    ],
    switching: {
      intro: 'Most of a move from FareHarbor is about what sits outside the booking system: your website and your resellers.',
      steps: [
        { title: 'Ask for your data', body: 'Request an export of your items, schedules, future bookings and customer list from FareHarbor, and keep a copy of your booking history.' },
        { title: 'Rebuild your activities', body: 'Each activity is set up in a seven-step guide: basics, details, photos, pricing, booking, guests, then review. Our pricing page includes free migration on every plan, so we can do this with you.' },
        { title: 'Plan the website first', body: 'If your site runs on FareHarbor Sites, move the website before you move the bookings. Elsewhere, swap the booking buttons for your EZRA Pro storefront links.' },
        { title: 'List your resellers', body: 'Partners who sell you through FareHarbor’s network need connecting to the new system. List them, with what each sells, before you set a date.' },
        { title: 'Bring future bookings across', body: 'Move the bookings already on the calendar with guest details and payment status, then check them against your export before you switch off.' },
      ],
    },
    faqs: [
      { q: 'Is FareHarbor free?', a: 'FareHarbor calls itself “a free booking software, omitting any monthly payment plans or upfront costs” and says its booking fee “is transferred to the customer at checkout.” So the operator pays no subscription and the guest usually pays the fee.', source: S.fhBlogFees },
      { q: 'How much is FareHarbor’s booking fee?', a: 'FareHarbor doesn’t publish it. Third-party guides put it at around 6%, some at 6–8%, possibly lower for large operators. Treat these as reported figures and ask FareHarbor for your rate in writing.', source: S.captainbookFh, reported: true },
      { q: 'Does EZRA Pro charge guests a booking fee too?', a: `Yes. As the storefront is set up today, guests see ${GUEST_LINES} on top of the price. Transfers are the exception: they sell at the owner’s price with nothing added. EZRA Pro’s commission is a separate number on the pricing page: ${pct(STARTER.percent)}, ${pct(GROWTH.percent)} or ${pct(SCALE.percent)} by plan.`, source: S.ezraCheckout },
      { q: 'Who owns FareHarbor?', a: 'Booking Holdings, the parent company of Booking.com. It bought FareHarbor in April 2018.', source: S.fhSec },
      { q: 'Will my reseller partners follow me?', a: `Partners connected through FareHarbor’s network have to connect to your new system. EZRA Pro lists a channel manager for Viator, GetYourGuide and Expedia on ${GROWTH.name} and above. Check every partner you rely on before you move.` },
    ],
    alternatives: 'fareharbor',
    related: ['peek-pro', 'xola', 'bokun'],
  },

  /* ------------------------------------------------------------------ */
  'peek-pro': {
    slug: 'peek-pro',
    vendor: 'peek-pro',
    title: `EZRA Pro vs Peek Pro: Pricing, Rentals & Fees (${Y})`,
    description: `Peek Pro prices by quote. Compare EZRA Pro’s published pricing, rental tools and guest fees side by side. Sources checked ${MONTH}.`,
    h1: 'EZRA Pro vs Peek Pro',
    lede: 'Peek Pro doesn’t publish prices; it quotes each business. Its rental tools are strong, so this page compares how rentals work on each system rather than whether they exist, and puts every fee figure next to where it came from.',
    verdict: {
      them: [
        'You rent boats, ATVs or kayaks and want card holds and photo records at handover. Peek lists both.',
        'You want AI help inside the product. Peek’s current release, Peek Pro 9, includes Copilot and Autopilot.',
        'You want a POS with tipping and native iOS and Android apps.',
        'You would rather negotiate a quote than choose from a public price list.',
      ],
      us: [
        `You want a price list you can read today: ${EZRA_RATES_LINE}.`,
        'Your rentals need stock per item, checks on overlapping hires, and rates by the hour, day or a set length.',
        'You rent vehicles with a driver, or run tours and rentals side by side with pickups.',
        'You also take restaurant orders or room bookings.',
      ],
    },
    rows: [
      { label: 'Pricing', them: PEEK.monthly, us: EZRA.monthly },
      { label: 'Fee on online bookings', them: PEEK.fee, us: EZRA.fee },
      { label: 'Who pays', them: PEEK.whoPays, us: EZRA.whoPays },
      { label: 'Card processing', them: PEEK.processing, us: EZRA.processing },
      { label: 'Rentals', them: PEEK.matrix.rentals, us: ez.rentals },
      { label: 'Rentals with a driver', them: official('Not shown on its pages', S.peek), us: ez.transfers },
      { label: 'Prices that move', them: PEEK.matrix.dynamicPricing, us: ez.priceRules },
      { label: 'When a time is full', them: official('Waitlists', S.peek), us: ez.soldOut },
      { label: 'Abandoned checkouts', them: official('Abandoned-cart recovery', S.peek), us: ez.unfinished },
      { label: 'Walk-up sales', them: PEEK.matrix.walkUp, us: ez.walkIn },
      { label: 'Gift cards', them: PEEK.matrix.giftCards, us: ez.giftCards },
    ],
    cost: {
      value: 10_000,
      intro: 'Peek Pro doesn’t publish a rate. Its row uses the low end of a figure reported by Bókun, a competitor, and is marked as reported.',
      points: [
        `If the reported 6% applies, $10,000 a month online costs about ${at('peek-pro', 10_000)} in fees. Who pays it is unclear: reports conflict.`,
        `EZRA Pro on the same month: ${at('ezra-starter', 10_000)} on ${STARTER.name}, ${at('ezra-growth', 10_000)} on ${GROWTH.name}, ${at('ezra-scale', 10_000)} on ${SCALE.name}.`,
        `EZRA Pro’s storefront currently adds ${GUEST_LINES} for the guest. Ask Peek for a written quote that includes its card fees before you compare totals.`,
      ],
    },
    strengths: [
      { title: 'Rental handover', body: 'Deposits, card holds and photo documentation are all listed. Those are the details that matter when a jet ski comes back scratched.', source: S.peek },
      { title: 'Guests help themselves', body: 'Guests can reschedule on their own, there are waitlists, and abandoned carts get followed up.', source: S.peek },
      { title: 'AI tools', body: 'Peek Pro 9 adds Copilot and Autopilot. If you want software that drafts and suggests for you, Peek is putting the most into it.', source: S.peek },
      { title: 'Connections', body: 'OTA connections through the OCTO standard, Mailchimp and Klaviyo, and pricing with a minimum and maximum you set.', source: S.peek },
    ],
    differences: [
      { title: 'A price list instead of a quote', body: `Plans and commission are published: ${EZRA_RATES_LINE}. You can work out a season’s cost before you speak to anyone.` },
      { title: 'Rentals counted item by item', body: 'Each rental item (two-seat kayaks, paddleboards, lockers) keeps its own stock under one booking link. Availability looks at overlapping hire times, a refundable deposit can be set per item, and a stock and repairs board shows what’s out of service.' },
      { title: 'Rentals with a driver', body: 'Vehicles with a driver live in Rentals and sell by the trip, by the hour or as shared seats, with prices by pickup zone. Peek’s pages didn’t show transfers when we checked.' },
      { title: 'Prices that follow demand', body: `Price rules cover seasons, weekdays, time of day, dates, book early, last minute, filling up and quiet times. The pricing page lists dynamic pricing on ${SCALE.name}.` },
      { title: 'Food and rooms', body: 'Restaurant ordering and a small-hotel storefront run on the same platform, for operators who do more than activities.' },
    ],
    switching: {
      intro: 'Because Peek prices by quote, the terms that matter for a move are in your own agreement.',
      steps: [
        { title: 'Read your agreement', body: 'Check notice periods, payout timing and any fees on leaving before you pick a date.' },
        { title: 'List rentals as items', body: 'Write down each rental product with its stock count, rates and deposit. In EZRA Pro these become items under one rental, so a guest can book two kayaks and a paddleboard together.' },
        { title: 'Rebuild tours and charters', body: 'Set up each activity in the seven-step guide, with pickups where you run them. Our pricing page includes free migration on every plan.' },
        { title: 'Connect payments and test', body: 'Connect your payment account and take a test booking on your storefront, including a rental with a deposit.' },
        { title: 'Move bookings and links', body: 'Bring across future bookings, then swap the booking links on your website, Google profile and social pages.' },
      ],
    },
    faqs: [
      { q: 'How much does Peek Pro cost?', a: 'Peek Pro doesn’t publish prices; it asks you to request a demo for a quote. Bókun, a competitor, reports no subscription and a fee of up to 6–8% on online bookings. Other blogs mention paid tiers and a setup fee that Peek hasn’t confirmed.', source: S.bokunOnPeek, reported: true },
      { q: 'Who pays Peek’s booking fee?', a: 'Reports conflict. A G2 discussion says it can be split with customers or paid by the operator and applies only to online bookings. We couldn’t confirm this on Peek’s own site.', source: S.g2Peek, reported: true },
      { q: 'Does EZRA Pro handle rental deposits?', a: 'Yes. Each rental item can carry a refundable deposit, held at pickup. EZRA Pro doesn’t list card holds or photo records at handover; if those matter most to you, Peek lists both.' },
      { q: 'Does EZRA Pro have a waitlist?', a: 'No. When a time slot is full, the storefront suggests other days and the activities you choose instead. Peek lists waitlists.' },
      { q: 'Is there a free plan?', a: `EZRA Pro ${STARTER.name} has no monthly fee and charges ${pct(STARTER.percent)} commission per booking. Peek Pro has no published plan; you get a quote.` },
    ],
    alternatives: 'peek-pro',
    related: ['fareharbor', 'checkfront', 'xola'],
  },

  /* ------------------------------------------------------------------ */
  bokun: {
    slug: 'bokun',
    vendor: 'bokun',
    title: `EZRA Pro vs Bókun: Pricing, Viator & Features (${Y})`,
    description: `Bókun is owned by Tripadvisor and charges 1–1.5% plus a plan fee. See where EZRA Pro differs on transport, rentals and dining. Checked ${MONTH}.`,
    h1: 'EZRA Pro vs Bókun',
    lede: 'Bókun has the lowest published fees of the systems we checked, and charges 0% on Viator bookings on its paid plans. On cost alone it’s hard to beat, and the numbers below say so. The case for EZRA Pro is breadth: transfers, demand-based prices, food and rooms alongside tours, with waivers in every plan.',
    verdict: {
      them: [
        'Viator is a large share of your sales. Paid Bókun plans charge 0% on Viator and offline bookings.',
        'The lowest published percentage matters most: 1.5% on START, down to 1% on PREMIUM.',
        'You want a large marketplace. Bókun claims more than 2,600 OTAs and resellers.',
        'You want to start free with one user taking manual bookings.',
      ],
      us: [
        'You sell rides as products of their own, by trip, hour or shared seat, not only pickup points on tours.',
        'You want waivers included rather than bought as an add-on.',
        'Your prices should move with demand: filling up, quiet times, book early, last minute.',
        'You run a restaurant or rooms as well as activities.',
      ],
    },
    rows: [
      { label: 'Monthly subscription', them: BOKUN.monthly, us: EZRA.monthly },
      { label: 'Fee on online bookings', them: BOKUN.fee, us: EZRA.fee },
      { label: 'Who pays', them: BOKUN.whoPays, us: EZRA.whoPays },
      { label: 'Card processing', them: BOKUN.processing, us: EZRA.processing },
      { label: 'Viator and offline bookings', them: official('0% on paid plans', S.bokunPricing), us: ez.offline },
      { label: 'Pickups', them: BOKUN.matrix.transport, us: ez.transport },
      { label: 'Transfers with a driver', them: official('Not shown as a product type on its features page', S.bokunFeatures), us: ez.transfers },
      { label: 'Waivers', them: BOKUN.matrix.waivers, us: ez.waivers },
      { label: 'Prices that move', them: BOKUN.matrix.dynamicPricing, us: ez.priceRules },
      { label: 'Automated emails', them: official('Capped at 500 a month on START', S.bokunPricing), us: ez.notifications },
      { label: 'Restaurant or rooms', them: official('Not shown on its pages', S.bokunFeatures), us: ez.dining },
    ],
    cost: {
      value: 10_000,
      intro: 'Every number on this page is published. Bókun shows PLUS at both 1.25% and 1%; we use 1.25%.',
      points: [
        `At $10,000 a month online, Bókun costs ${at('bokun-start', 10_000)} on START, ${at('bokun-plus', 10_000)} on PLUS and ${at('bokun-premium', 10_000)} on PREMIUM.`,
        `EZRA Pro costs ${at('ezra-starter', 10_000)} on ${STARTER.name}, ${at('ezra-growth', 10_000)} on ${GROWTH.name} and ${at('ezra-scale', 10_000)} on ${SCALE.name}. Bókun is cheaper at this volume, and at $50,000 too.`,
        'If much of your volume comes through Viator, Bókun’s 0% on those bookings widens the gap further.',
      ],
    },
    strengths: [
      { title: 'Lowest published fees', body: 'Subscription plus 1–1.5% is less than most of this category charges at any volume. The fee can be absorbed or passed on with a switch.', source: S.bokunPricing },
      { title: 'Built around Viator', body: 'Paid plans charge 0% on Viator and offline bookings, and the marketplace claims more than 2,600 OTAs and resellers.', source: S.bokunPricing },
      { title: 'Close on tour features', body: 'Pick-up and drop-off points, resource management, rentals, a POS, a website builder and AI product import. On tour features it’s the closest all-round match to EZRA Pro.', source: S.bokunFeatures },
      { title: 'Easy to try and to leave', body: 'A free plan, a 14-day trial, and “switch plans or cancel anytime”.', source: S.bokunPricing },
    ],
    differences: [
      { title: 'Rides as products', body: 'Beyond pickups on a tour, EZRA Pro sells vehicles with a driver by the trip, by the hour or as shared seats, priced by zone. Transfers sell at the owner’s price with no booking fee or card processing added at checkout.' },
      { title: 'Waivers on every plan', body: 'The pricing page includes digital waivers from Starter. Each activity says who signs: the booker, or each guest. Bókun lists waivers as an add-on.' },
      { title: 'Prices that follow demand', body: `Bókun lists seasonal pricing. EZRA Pro’s price rules add filling up, quiet times, book early, last minute and group size (dynamic pricing is on ${SCALE.name}).` },
      { title: 'Capacity by weekday and date', body: 'Different spots on different days, a single date’s own spots, and extra spots sold at their own price once the usual ones fill.' },
      { title: 'Food and rooms', body: 'Restaurant ordering and a small-hotel storefront run on the same platform.' },
    ],
    switching: {
      intro: 'The main risk in leaving Bókun is a gap in your Viator sales, so plan that part first.',
      steps: [
        { title: 'Keep Viator selling', body: `Connect Viator through EZRA Pro’s channel manager (${GROWTH.name} and above) before you turn Bókun’s connection off.` },
        { title: 'Map pickup points to zones', body: 'Bókun’s pick-up and drop-off points become pickup zones on each activity, each free or priced per guest or per booking.' },
        { title: 'Rebuild products', body: 'Set up each activity in the seven-step guide. Our pricing page includes free migration on every plan.' },
        { title: 'Move bookings', body: 'Bring across future bookings with guest details, then check them against Bókun’s records.' },
        { title: 'Change or cancel the plan', body: 'Bókun says you can switch plans or cancel any time. Pick a date after your last overlapping booking.' },
      ],
    },
    faqs: [
      { q: 'Is Bókun cheaper than EZRA Pro?', a: `On published fees, usually yes. At $10,000 a month online, START costs ${at('bokun-start', 10_000)} against ${at('ezra-starter', 10_000)} on EZRA Pro ${STARTER.name}. At $50,000, PLUS costs ${at('bokun-plus', 50_000)} against ${at('ezra-scale', 50_000)} on ${SCALE.name}. Run your own numbers in the calculator.`, source: S.bokunPricing },
      { q: 'Does Bókun charge on Viator bookings?', a: 'Its pricing page says paid plans charge 0% on Viator and offline bookings. The same page also mentions a Viator fee for some Channel Manager customers, so confirm which applies to you.', source: S.bokunPricing },
      { q: 'Who owns Bókun?', a: 'Tripadvisor, since 2018. Bókun says it operates independently and doesn’t share data. Whether that matters is your call.', source: S.bokunAbout },
      { q: 'Are waivers extra on Bókun?', a: 'Its features page lists waivers and photos as add-ons. EZRA Pro’s pricing page includes digital waivers from Starter.', source: S.bokunFeatures },
      { q: 'Does Bókun do pickups?', a: 'Yes, with pick-up and drop-off points. EZRA Pro also does pickups, and sells transfers with a driver as products of their own.', source: S.bokunFeatures },
    ],
    related: ['rezdy', 'checkfront', 'fareharbor'],
  },

  /* ------------------------------------------------------------------ */
  rezdy: {
    slug: 'rezdy',
    vendor: 'rezdy',
    title: `EZRA Pro vs Rezdy: 3% Fees, Features & Fit (${Y})`,
    description: `Rezdy charges $49–$249/mo plus 3% on online bookings. Compare total cost, pickups, waivers and walk-ins with EZRA Pro. Checked ${MONTH}.`,
    h1: 'EZRA Pro vs Rezdy',
    lede: 'Rezdy is built around distribution: a channel manager and an agent network it puts at more than 12,000 agents. Its 3% online fee is the same on every plan, so its cost grows with your direct sales. Rezdy has been in the same group as Checkfront and Regiondo since 2023, and the brands still run separately.',
    verdict: {
      them: [
        'Agents and resellers drive your sales. Rezdy claims more than 12,000 agents in its network.',
        'You want unlimited products, users and agents and no contract lock-in, both stated on its pricing page.',
        `Your online volume is mid-sized. Rezdy Foundation ($49 + 3%) costs less than EZRA Pro ${STARTER.name} once you pass about ${be('ezra-starter', 'rezdy-foundation') ?? 'a modest volume'} a month online.`,
        'You need gift cards and packages from $99 a month.',
      ],
      us: [
        `Your online sales are high. ${SCALE.name} (${money(SCALE.monthly)} + ${pct(SCALE.percent)}) costs less than Rezdy Expansion at any volume, and less than Foundation above about ${be('rezdy-foundation', 'ezra-scale') ?? 'a high volume'} a month.`,
        'You want pickups, waivers and walk-in sales in one system. Rezdy’s features page didn’t show pickups or native waivers when we checked.',
        `You want to try before you commit: ${GROWTH.name} and ${SCALE.name} have a 14-day trial. Rezdy offers a demo.`,
        'You rent vehicles with a driver, or run food or rooms too.',
      ],
    },
    rows: [
      { label: 'Monthly subscription', them: REZDY.monthly, us: EZRA.monthly },
      { label: 'Fee on online bookings', them: REZDY.fee, us: EZRA.fee },
      { label: 'Offline and agent bookings', them: official('$1, $0.85 or $0.70 per booking by plan', S.rezdyPricing), us: ez.offline },
      { label: 'Who pays', them: REZDY.whoPays, us: EZRA.whoPays },
      { label: 'Trial', them: official('No free trial; a demo', S.rezdyPricing), us: ez.trial },
      { label: 'Contract', them: official('No contract lock-in', S.rezdyPricing), us: ez.contract },
      { label: 'Pickups', them: REZDY.matrix.transport, us: ez.transport },
      { label: 'Waivers', them: REZDY.matrix.waivers, us: ez.waivers },
      { label: 'Walk-up sales', them: REZDY.matrix.walkUp, us: ez.walkIn },
      { label: 'Gift cards', them: REZDY.matrix.giftCards, us: ez.giftCards },
      { label: 'API and webhooks', them: official('On the $249 plan', S.rezdyPricing), us: ez.api },
    ],
    cost: {
      value: 30_000,
      intro: 'Rezdy’s page says prices are “exclusive of GST in Australia”, so the currency may be regional. We show its numbers at face value in dollars.',
      points: [
        `At $30,000 a month online, Rezdy costs ${at('rezdy-foundation', 30_000)} on Foundation, ${at('rezdy-accelerate', 30_000)} on Accelerate and ${at('rezdy-expansion', 30_000)} on Expansion. The 3% doesn’t fall on higher plans.`,
        `EZRA Pro costs ${at('ezra-starter', 30_000)} on ${STARTER.name}, ${at('ezra-growth', 30_000)} on ${GROWTH.name} and ${at('ezra-scale', 30_000)} on ${SCALE.name}. Our ${pct(STARTER.percent)} plans cost more than Rezdy at this volume; ${SCALE.name} costs about the same as Foundation.`,
        `Rezdy lets you choose who pays its fee. EZRA Pro’s storefront currently shows guests ${GUEST_LINES}.`,
      ],
    },
    strengths: [
      { title: 'Distribution', body: 'A channel manager and an agent network it puts at more than 12,000 agents. If resellers sell most of your seats, this is the reason to stay.', source: S.rezdyFeatures },
      { title: 'Plain terms', body: '“No contract lock-in, unlimited products, users and agents.” Few vendors put that on the pricing page.', source: S.rezdyPricing },
      { title: 'You choose who pays', body: '“You can choose to absorb this fee, or pass it on to your guests.”', source: S.rezdyPricing },
      { title: 'A full kit at $99', body: 'Gift cards, packages and automated notifications start on Accelerate.', source: S.rezdyPricing },
    ],
    differences: [
      { title: 'A rate that falls as you grow', body: `Rezdy’s 3% is the same on every plan. EZRA Pro’s ${SCALE.name} plan is ${pct(SCALE.percent)}. To be fair: our ${STARTER.name} and ${GROWTH.name} plans are ${pct(STARTER.percent)}, which is more than Rezdy’s 3%.` },
      { title: 'Pickups and transfers', body: 'Pickup and drop-off on any activity, a seven-day pickups board by shuttle run, and vehicles with a driver sold by trip, hour or shared seat.' },
      { title: 'Waivers and walk-ins', body: 'Waivers set per activity, signed by the booker or each guest, and a walk-in desk that keeps counter sales apart from online revenue.' },
      { title: 'A trial, not a demo', body: `${STARTER.name} is free to run, and ${GROWTH.name} and ${SCALE.name} have 14 days free, so you can test with your own activities first.` },
      { title: 'Food and rooms', body: 'Restaurant ordering and a small-hotel storefront on the same platform.' },
    ],
    switching: {
      intro: 'If agents sell for you, the move from Rezdy is mostly about them.',
      steps: [
        { title: 'List your agents', body: 'Agents who book you through Rezdy need a new way to book. List who sells for you, what they sell and how much.' },
        { title: 'Check your billing date', body: 'Rezdy states no contract lock-in. Time the switch to your billing date so you don’t pay for an extra month.' },
        { title: 'Rebuild with pickups and waivers', body: 'Set up each activity in the seven-step guide and add the pickups and waivers you may have run outside Rezdy. Our pricing page includes free migration on every plan.' },
        { title: 'Move bookings and gift cards', body: 'Bring across future bookings. List outstanding gift card balances and decide how you will honour them.' },
        { title: 'Close the account in writing', body: 'Ask Rezdy in writing to close your account and confirm the closing date.' },
      ],
    },
    faqs: [
      { q: 'How much does Rezdy cost?', a: '$49 (Foundation), $99 (Accelerate) or $249 (Expansion) a month, plus 3% on online bookings and $1, $0.85 or $0.70 on offline and agent bookings. Prices are listed exclusive of GST in Australia.', source: S.rezdyPricing },
      { q: 'Does Rezdy’s fee go down on higher plans?', a: 'No. The 3% online fee is the same on all three plans; only the offline and agent fee drops.', source: S.rezdyPricing },
      { q: 'Who pays Rezdy’s 3%?', a: 'You choose. Rezdy says you can absorb it or pass it on to your guests.', source: S.rezdyPricing },
      { q: 'Is Rezdy the same company as Checkfront?', a: 'Rezdy, Checkfront and Regiondo have been part of the same group since a 2023 merger. The brands and products run separately.', source: S.merger },
      { q: 'Does EZRA Pro have an agent network like Rezdy’s?', a: `No. EZRA Pro lists a channel manager for Viator, GetYourGuide and Expedia on ${GROWTH.name} and above, but no agent network of Rezdy’s size. If agents drive your sales, weigh that heavily.` },
    ],
    alternatives: 'rezdy',
    related: ['checkfront', 'bokun', 'fareharbor'],
  },

  /* ------------------------------------------------------------------ */
  checkfront: {
    slug: 'checkfront',
    vendor: 'checkfront',
    title: `EZRA Pro vs Checkfront: Rentals, Fees & Walk-ins (${Y})`,
    description: `Checkfront is $99/mo plus 3% online. Compare rentals, walk-in sales, transfers and total cost with EZRA Pro. Checked ${MONTH}.`,
    h1: 'EZRA Pro vs Checkfront',
    lede: 'Checkfront has one published plan and takes tours, rentals and accommodation in one system. That makes it the closest match to EZRA Pro’s mixed catalogue among the subscription vendors. The differences are in the work of the day: counter sales, pickups and rides, and food.',
    verdict: {
      them: [
        'You want one plan and one price: $99 a month plus 3% online, and nothing on offline, OTA or API bookings.',
        'Your business is rentals or lodging with flexible timing. Checkfront books items all day, nightly, by time slot or by “Flextime”.',
        'You want waivers included and no setup fee.',
        'Many of your bookings come by phone or through OTAs, which carry no Checkfront fee.',
      ],
      us: [
        'You sell at a counter or a dock. EZRA Pro has a walk-in desk; Checkfront’s features page didn’t show a POS when we checked.',
        'You run pickups or sell rides with a driver.',
        `Your online volume is high. ${SCALE.name} costs less than Checkfront above about ${be('checkfront', 'ezra-scale') ?? 'a high volume'} a month online.`,
        'You serve food or run a restaurant alongside.',
      ],
    },
    rows: [
      { label: 'Monthly subscription', them: CF.monthly, us: EZRA.monthly },
      { label: 'Fee on online bookings', them: CF.fee, us: EZRA.fee },
      { label: 'Offline and OTA bookings', them: official('No fee', S.checkfrontPricing), us: ez.offline },
      { label: 'Who pays', them: CF.whoPays, us: EZRA.whoPays },
      { label: 'Card processing', them: CF.processing, us: EZRA.processing },
      { label: 'How items are booked', them: official('All day, nightly, time slot or Flextime', S.checkfrontFeatures), us: official('Time slots, private groups, rentals by hour, day or set length, passes by day; room stays on the hotel storefront', S.ezraDemo) },
      { label: 'Walk-up sales', them: CF.matrix.walkUp, us: ez.walkIn },
      { label: 'Pickups and transfers', them: CF.matrix.transport, us: ez.transport },
      { label: 'Waivers', them: CF.matrix.waivers, us: ez.waivers },
      { label: 'Gift cards', them: CF.matrix.giftCards, us: ez.giftCards },
      { label: 'Restaurant ordering', them: official('Not shown on its pages', S.checkfrontFeatures), us: ez.dining },
    ],
    cost: {
      value: 20_000,
      intro: 'Checkfront says its 3% “may vary by region”. Offline, OTA and API bookings carry no Checkfront fee, so only count your online sales.',
      points: [
        `At $20,000 a month online, Checkfront costs ${at('checkfront', 20_000)}. EZRA Pro costs ${at('ezra-starter', 20_000)} on ${STARTER.name}, ${at('ezra-growth', 20_000)} on ${GROWTH.name} and ${at('ezra-scale', 20_000)} on ${SCALE.name}.`,
        `Below that, Checkfront is cheaper than ${SCALE.name}. At $10,000 it is ${at('checkfront', 10_000)}, about the same as ${STARTER.name} at ${at('ezra-starter', 10_000)}.`,
        `Checkfront lets you choose who pays its fee. EZRA Pro’s storefront currently shows guests ${GUEST_LINES}.`,
      ],
    },
    strengths: [
      { title: 'One plan, in public', body: '“One simple plan”: $99 a month plus 3% online. No setup fee.', source: S.checkfrontPricing },
      { title: 'No fee on offline, OTA or API bookings', body: 'Phone, walk-in and marketplace bookings cost nothing extra, which suits businesses with a lot of offline trade.', source: S.checkfrontPricing },
      { title: 'Flexible timing', body: 'Items book all day, nightly, by time slot or by Flextime, with tours, rentals and accommodation in one system.', source: S.checkfrontFeatures },
      { title: 'Ready for your website', body: 'Four booking widget types, waivers, seasonal pricing and email and SMS notifications are on its features page.', source: S.checkfrontFeatures },
    ],
    differences: [
      { title: 'A walk-in desk', body: 'Ring up a sale at the counter, keep a log of walk-ins, and see walk-in revenue reported apart from online sales.' },
      { title: 'Pickups and rides', body: 'Pickup and drop-off on any activity by zone, a seven-day pickups board with drivers, and vehicles with a driver sold by trip, hour or shared seat.' },
      { title: 'Capacity rules', body: 'Spots per time slot, different on busy weekdays or single dates, with extra spots sold at their own price once the usual ones fill.' },
      { title: 'Prices that follow demand', body: `Checkfront lists seasonal pricing. EZRA Pro’s price rules add filling up, quiet times, book early, last minute and group size (dynamic pricing is on ${SCALE.name}).` },
      { title: 'Food as well as stays', body: 'Both systems handle rooms. EZRA Pro also takes restaurant orders on the same platform.' },
    ],
    switching: {
      intro: 'Checkfront and EZRA Pro both cover mixed catalogues, so most of the work is mapping one setup onto the other.',
      steps: [
        { title: 'Map your item types', body: 'Time-slot items become activities with time slots; all-day and Flextime items become rentals by day, hour or set length; nightly items move to the hotel storefront.' },
        { title: 'Count your offline bookings', body: 'Checkfront charges nothing on offline bookings. Work out how much of your trade is offline before you compare totals.' },
        { title: 'Rebuild waivers', body: 'Set waivers per activity and choose who signs: the booker or each guest. Our pricing page includes free migration on every plan.' },
        { title: 'Move bookings and gift certificates', body: 'Bring across future bookings and list any gift certificates still to be redeemed.' },
        { title: 'Tell your OTAs', body: 'Reconnect GetYourGuide and any other channels before you turn Checkfront off.' },
      ],
    },
    faqs: [
      { q: 'How much does Checkfront cost?', a: '$99 a month plus 3% on online bookings, which may vary by region. There is no fee on offline, OTA or API bookings and no setup fee.', source: S.checkfrontPricing },
      { q: 'Does Checkfront have a POS?', a: 'Its features page didn’t show one when we checked. If you sell at a counter, ask Checkfront directly.', source: S.checkfrontFeatures },
      { q: 'Who owns Checkfront?', a: 'Checkfront merged with Rezdy in 2023 and Regiondo joined soon after. The three have been in the same group since then and run as separate brands.', source: S.merger },
      { q: 'Are gift cards included?', a: `Checkfront sells gift certificates as an add-on. On EZRA Pro, gift cards are on ${SCALE.name}.`, source: S.checkfrontGift },
      { q: 'Can both take accommodation bookings?', a: 'Yes. Checkfront books nightly items alongside tours and rentals. EZRA Pro has a small-hotel storefront on the same platform.', source: S.checkfrontFeatures },
    ],
    related: ['rezdy', 'peek-pro', 'bokun'],
  },

  /* ------------------------------------------------------------------ */
  xola: {
    slug: 'xola',
    vendor: 'xola',
    title: `EZRA Pro vs Xola: Guest Fees, Pricing & Fit (${Y})`,
    description: `Xola’s Guest Pays plan adds 6% to your guests’ checkout. Compare who pays what, and what you get, with EZRA Pro. Checked ${MONTH}.`,
    h1: 'EZRA Pro vs Xola',
    lede: 'Xola is one of the few no-subscription systems that publishes both its fee and its card rate, so a straight comparison is possible. Xola’s Guest Pays plan and EZRA Pro’s storefront, as set up today, both show guests a fee at checkout. The differences are in what you can sell and how prices can move.',
    verdict: {
      them: [
        'You want no subscription and an operator-paid option: Company Pays is 3% taken from your payouts.',
        'You want support around the clock. Xola offers 24/7 support.',
        'You run an attraction with gated entry, kiosks and a POS.',
        'You need SOC 2 Type II and 80+ app integrations.',
      ],
      us: [
        'You rent equipment by the item, or sell rides with a driver.',
        'Your prices should change with demand. Xola’s pages didn’t document a dynamic pricing engine when we checked.',
        'You run pickups to your activities.',
        'You also take restaurant orders or room bookings.',
      ],
    },
    rows: [
      { label: 'Monthly subscription', them: XOLA.monthly, us: EZRA.monthly },
      { label: 'Fee on online bookings', them: XOLA.fee, us: EZRA.fee },
      { label: 'Who pays', them: XOLA.whoPays, us: EZRA.whoPays },
      { label: 'Card processing', them: XOLA.processing, us: EZRA.processing },
      { label: 'Walk-up sales', them: XOLA.matrix.walkUp, us: ez.walkIn },
      { label: 'Waivers', them: XOLA.matrix.waivers, us: ez.waivers },
      { label: 'Rentals', them: XOLA.matrix.rentals, us: ez.rentals },
      { label: 'Pickups and transfers', them: XOLA.matrix.transport, us: ez.transport },
      { label: 'Prices that move', them: XOLA.matrix.dynamicPricing, us: ez.priceRules },
      { label: 'Marketing automation', them: official('Xolabot', S.xolaHome), us: ez.automation },
      { label: 'Support hours', them: official('24/7', S.xolaHome), us: ez.support },
    ],
    cost: {
      value: 10_000,
      intro: 'Both of Xola’s fees and its US card rate are published. Average booking value matters here, because Xola’s card rate has a fixed 30¢ per payment.',
      points: [
        `At $10,000 a month online, Guest Pays adds ${at('xola-guest', 10_000)} to your guests’ checkouts; Company Pays takes ${at('xola-company', 10_000)} from your payouts.`,
        `EZRA Pro’s commission on the same month is ${at('ezra-starter', 10_000)} on ${STARTER.name}, ${at('ezra-growth', 10_000)} on ${GROWTH.name} and ${at('ezra-scale', 10_000)} on ${SCALE.name}. Xola Company Pays costs less than our ${pct(STARTER.percent)} plans, and less than ${SCALE.name} below about ${be('xola-company', 'ezra-scale') ?? 'a high volume'} a month.`,
        `EZRA Pro’s storefront currently shows guests ${GUEST_LINES}, close to what a Guest Pays checkout adds.`,
      ],
    },
    strengths: [
      { title: 'Fees in writing', body: 'A published 6% (guest pays) or 3% (company pays), and a published US card rate of 2.39% + $0.30.', source: S.xolaPricing },
      { title: 'Choice of who pays', body: 'Guests pay on Flex Standard; the operator pays a lower rate on Flex Level.', source: S.xolaCompany },
      { title: 'Always on', body: '24/7 support and SOC 2 Type II, with 80+ app integrations.', source: S.xolaHome },
      { title: 'Attraction tools', body: 'Waitlists, gated entry, a kiosk, a POS, reviews and NPS, and built-in waivers.', source: S.xolaHome },
    ],
    differences: [
      { title: 'Rentals by the item', body: 'Each rental item keeps its own stock under one link, with rates by hour, day or set length, checks on overlapping hires and a refundable deposit per item.' },
      { title: 'Transport', body: 'Pickup and drop-off on any activity by zone, and vehicles with a driver sold by trip, hour or shared seat. Xola’s pages didn’t show either when we checked.' },
      { title: 'Prices that follow demand', body: `Price rules for seasons, weekdays, time of day, dates, book early, last minute, filling up and quiet times (dynamic pricing is on ${SCALE.name}).` },
      { title: 'Capacity rules', body: 'Different spots by weekday or date, and extra spots at their own price once the usual ones fill.' },
      { title: 'Food and rooms', body: 'Restaurant ordering and a small-hotel storefront on the same platform.' },
    ],
    switching: {
      intro: 'The thing to settle before leaving Xola is what your guests will see at checkout.',
      steps: [
        { title: 'Compare the checkout', body: `Put a sample booking through both: Xola Guest Pays adds 6% of the subtotal; EZRA Pro’s storefront currently adds ${GUEST_LINES}.` },
        { title: 'Plan the counter', body: 'If you use Xola kiosks or gated entry, plan your counter setup. EZRA Pro’s walk-in desk runs in a web browser.' },
        { title: 'List gift card balances', body: 'Export outstanding Xola gift cards and decide how you will honour them.' },
        { title: 'Rebuild activities', body: 'Set up each activity in the seven-step guide. Our pricing page includes free migration on every plan.' },
        { title: 'Move bookings', body: 'Bring across future bookings, including any paid by deposit, and check balances due.' },
      ],
    },
    faqs: [
      { q: 'Is Xola free?', a: 'Xola has no subscription. It charges a 6% service fee paid by the guest on Flex Standard, Guest Pays, or 3% from your payouts on Flex Level, Company Pays. Plan prices are listed as “Contact for pricing”.', source: S.xolaPricing },
      { q: 'How does Xola’s 6% work with deposits?', a: 'When a guest pays a deposit, the 6% is charged on the full total, and it isn’t refunded on partial refunds.', source: S.xolaGuest },
      { q: 'What does Xola charge for card processing?', a: '2.39% + $0.30 in the US.', source: S.xolaPricing },
      { q: 'Does EZRA Pro add a fee for guests?', a: `Yes. As the storefront is set up today, guests see ${GUEST_LINES} on top of the price, except on transfers.`, source: S.ezraCheckout },
      { q: 'Does Xola have dynamic pricing?', a: 'Its pages didn’t document a dynamic pricing engine when we checked. Ask Xola if you need prices that change with demand.', source: S.xolaHome },
    ],
    related: ['fareharbor', 'peek-pro', 'checkfront'],
  },
}

/* ==========================================================================
   ALTERNATIVES PAGES
   ========================================================================== */

export interface AltEntry {
  vendor: VendorId | 'ezra'
  bestFor: string
  why: string[]
  watch: string[]
  pricing: Fact[]
}

export interface AltGroup {
  title: string
  intro: string
  entries: AltEntry[]
}

export interface AltContent {
  slug: AlternativesSlug
  vendor: VendorId
  title: string
  description: string
  h1: string
  lede: string
  howWeChose: string[]
  groups: AltGroup[]
  beforeYouSwitch: Point[]
  faqs: Faq[]
}

const ezraPricing: Fact[] = [EZRA.monthly, EZRA.fee, EZRA.whoPays]
const vendorPricing = (id: VendorId): Fact[] => [VENDORS[id].monthly, VENDORS[id].fee, VENDORS[id].whoPays]

const countEntries = (groups: AltGroup[]) => groups.reduce((n, g) => n + g.entries.length, 0)

const FH_ALT_GROUPS: AltGroup[] = [
  {
    title: 'No subscription, a fee per booking',
    intro: 'The same broad model as FareHarbor. Of these three, two publish their rate.',
    entries: [
      {
        vendor: 'peek-pro',
        bestFor: 'Rental-heavy US operators who like FareHarbor’s no-subscription model.',
        why: ['Rentals with deposits, card holds and photo records.', 'POS with tipping, AI tools, and iOS and Android apps.', 'Guest self-rescheduling and waitlists.'],
        watch: ['Pricing is by quote, so you won’t see the rate up front either.', 'Fee figures come from competitors, not from Peek.'],
        pricing: vendorPricing('peek-pro'),
      },
      {
        vendor: 'xola',
        bestFor: 'Operators who want FareHarbor’s model with the fee in writing.',
        why: ['Publishes 6% guest-paid or 3% operator-paid.', 'Publishes its US card rate: 2.39% + $0.30.', '24/7 support, kiosk and gated entry.'],
        watch: ['Plan prices are “Contact for pricing”.', 'No dynamic pricing engine documented on its pages.'],
        pricing: vendorPricing('xola'),
      },
      {
        vendor: 'zaui',
        bestFor: 'Shuttle, airport, cruise-port and ferry operators.',
        why: ['Free plan at 6% on online bookings, which you can pass to guests.', 'Routes, fleets, vehicle tracking and seat manifests.', 'Card processing passed through without markup.'],
        watch: ['Zaui itself says it’s “probably not the best fit for pure day-tour operators with a simple single-product setup”.', 'Waivers through Smartwaiver rather than built in.'],
        pricing: vendorPricing('zaui'),
      },
    ],
  },
  {
    title: 'A subscription plus a published percentage',
    intro: 'You pay a monthly fee and a lower, published rate, and usually choose who pays it.',
    entries: [
      {
        vendor: 'bokun',
        bestFor: 'Viator-heavy operators who want the lowest published percentage.',
        why: ['$49 + 1.5% on START, down to 1% on PREMIUM.', '0% on Viator and offline bookings on paid plans.', 'Pick-up and drop-off points, rentals and a POS.'],
        watch: ['Owned by Tripadvisor since 2018.', 'Waivers are an add-on; START caps automated emails at 500 a month.'],
        pricing: vendorPricing('bokun'),
      },
      {
        vendor: 'rezdy',
        bestFor: 'Operators who sell through agents and resellers.',
        why: ['An agent network it puts at more than 12,000 agents.', 'You choose who pays the 3%.', 'No contract lock-in.'],
        watch: ['3% online on every plan; it doesn’t fall as you grow.', 'A demo, not a free trial; prices listed exclusive of GST in Australia.'],
        pricing: vendorPricing('rezdy'),
      },
      {
        vendor: 'checkfront',
        bestFor: 'Rental and accommodation businesses that want one simple plan.',
        why: ['$99 + 3%, nothing on offline, OTA or API bookings.', 'Tours, rentals and accommodation in one system.', 'Waivers included.'],
        watch: ['No POS shown on its features page when we checked.', 'Gift certificates are an add-on.'],
        pricing: vendorPricing('checkfront'),
      },
      {
        vendor: 'trekksoft',
        bestFor: 'European operators who want published tiers and published card fees.',
        why: ['€49 to €249 a month, with the fee falling from 3% to 2%.', 'Publishes Payyo processing: 2.5% + €0.25 in Europe.', 'A free website builder and a POS.'],
        watch: ['Billed annually.', 'Waivers, gift card sales, deposits and packages start on the €149 plan.'],
        pricing: vendorPricing('trekksoft'),
      },
      {
        vendor: 'ezra',
        bestFor: 'Operators selling a mix: tours, rentals, transfers and passes, sometimes with food or rooms.',
        why: [`Published plans: ${EZRA_RATES_LINE}.`, 'Pickup and drop-off on any activity; transfers by trip, hour or shared seat.', 'Walk-in desk, waivers on every plan, capacity by weekday and date.'],
        watch: ['We make it, so weigh this entry with that in mind.', `The storefront currently shows guests ${GUEST_LINES} at checkout, much like a FareHarbor guest fee.`, `Gift cards, price rules and multi-location are on ${SCALE.name} (${money(SCALE.monthly)} a month).`],
        pricing: ezraPricing,
      },
    ],
  },
]

const PEEK_ALT_GROUPS: AltGroup[] = [
  {
    title: 'Strong on rentals',
    intro: 'Peek’s rental tools are a common reason to choose it. These alternatives also take rentals, in different depths.',
    entries: [
      {
        vendor: 'checkfront',
        bestFor: 'Rental-first businesses with flexible timing.',
        why: ['Items book all day, nightly, by time slot or by Flextime.', '$99 a month plus 3% online, published.', 'No fee on offline, OTA or API bookings.'],
        watch: ['No POS shown on its features page when we checked.', 'Gift certificates are an add-on.'],
        pricing: vendorPricing('checkfront'),
      },
      {
        vendor: 'bokun',
        bestFor: 'Rentals and tours with pickups, at the lowest published fees.',
        why: ['Rentals, resources and pick-up and drop-off points.', '1–1.5% plus a plan fee; 0% on Viator on paid plans.', 'A free plan and a 14-day trial.'],
        watch: ['Owned by Tripadvisor since 2018.', 'Waivers are an add-on.'],
        pricing: vendorPricing('bokun'),
      },
      {
        vendor: 'trekksoft',
        bestFor: 'European rental and tour operators.',
        why: ['Rental items and add-ons, with a POS and mobile POS.', 'Published tiers and card processing.', 'A free website builder.'],
        watch: ['Billed annually.', 'Deposits and waivers start on the €149 plan.'],
        pricing: vendorPricing('trekksoft'),
      },
      {
        vendor: 'ezra',
        bestFor: 'Rentals counted item by item, and rentals with a driver.',
        why: ['Items with their own stock under one link, by hour, day or set length.', 'Availability checks overlapping hires; a refundable deposit per item.', 'Vehicles with a driver by trip, hour or shared seat.'],
        watch: ['We make it, so weigh this entry with that in mind.', 'No card holds or photo records at handover are advertised; Peek lists both.', `The storefront currently shows guests ${GUEST_LINES}.`],
        pricing: ezraPricing,
      },
    ],
  },
  {
    title: 'Close to Peek’s model, but published',
    intro: 'No subscription, or a free plan, with the fee in writing.',
    entries: [
      {
        vendor: 'xola',
        bestFor: 'Tours and attractions that want Peek’s no-subscription model with the fee published.',
        why: ['6% guest-paid or 3% operator-paid, published.', 'POS, kiosk, equipment management and built-in waivers.', '24/7 support.'],
        watch: ['Rentals are not confirmed on its pages.', 'No dynamic pricing engine documented.'],
        pricing: vendorPricing('xola'),
      },
      {
        vendor: 'zaui',
        bestFor: 'Operators who rent and run transport.',
        why: ['Free plan at 6% on online bookings.', 'Shuttles, routes and fleets, plus named rental support.', 'Dynamic pricing and a Booking Desk for walk-ins.'],
        watch: ['Its FAQ mentions an onboarding fee without an amount.', 'Waivers through Smartwaiver rather than built in.'],
        pricing: vendorPricing('zaui'),
      },
      {
        vendor: 'rezdy',
        bestFor: 'Rental and tour operators who sell through agents.',
        why: ['Rentals, plus an agent network it puts at more than 12,000.', 'You choose who pays the 3%.', 'No contract lock-in.'],
        watch: ['Gift cards and packages start on the $99 plan.', 'The 3% doesn’t fall on higher plans.'],
        pricing: vendorPricing('rezdy'),
      },
    ],
  },
]

const REZDY_ALT_GROUPS: AltGroup[] = [
  {
    title: 'In the same group as Rezdy',
    intro: 'Rezdy, Checkfront and Regiondo have shared an owner since 2023. Moving between them changes the product, not the company.',
    entries: [
      {
        vendor: 'checkfront',
        bestFor: 'Rezdy users who want a single $99 plan and no fee on offline or OTA bookings.',
        why: ['One published plan: $99 a month plus 3% online.', 'Waivers included at no extra cost.', 'Tours, rentals and accommodation in one system.'],
        watch: ['Same group as Rezdy since 2023.', 'No POS shown on its features page when we checked.'],
        pricing: vendorPricing('checkfront'),
      },
    ],
  },
  {
    title: 'A lower percentage as you grow',
    intro: 'Rezdy’s 3% is the same on every plan. These systems charge less per booking on their higher plans.',
    entries: [
      {
        vendor: 'bokun',
        bestFor: 'Distribution without a 3% fee.',
        why: ['Claims more than 2,600 OTAs and resellers.', '1.5% on START, 1% on PREMIUM; 0% on Viator on paid plans.', 'Pickup points, rentals and a POS.'],
        watch: ['Owned by Tripadvisor since 2018.', 'The pricing page shows PLUS at both 1.25% and 1%.'],
        pricing: vendorPricing('bokun'),
      },
      {
        vendor: 'trekksoft',
        bestFor: 'European operators with an agent network.',
        why: ['3% down to 2% online, published.', 'An agent network and a free website builder.', 'Published card processing.'],
        watch: ['Billed annually.', 'The full API and Zapier are on the top plan only.'],
        pricing: vendorPricing('trekksoft'),
      },
      {
        vendor: 'bookingkit',
        bestFor: 'European attractions that sell through resellers.',
        why: ['A B2B reseller tool and channel management across 50+ networks.', 'Turnstile and POS partners.', '2% booking fee on Businesskit.'],
        watch: ['Fees stack: a booking fee, €0.60 per ticket and a 3% online payment fee.', 'Starterkit is billed yearly only.'],
        pricing: vendorPricing('bookingkit'),
      },
      {
        vendor: 'ezra',
        bestFor: 'Direct sellers with pickups, walk-ins and a mixed catalogue.',
        why: [`${SCALE.name} is ${pct(SCALE.percent)} plus ${money(SCALE.monthly)} a month.`, 'Pickups, waivers and a walk-in desk in one system.', `A 14-day trial on ${GROWTH.name} and ${SCALE.name}.`],
        watch: ['We make it, so weigh this entry with that in mind.', `${STARTER.name} and ${GROWTH.name} are ${pct(STARTER.percent)}, more than Rezdy’s 3%; and there is no agent network.`, `The storefront currently shows guests ${GUEST_LINES}.`],
        pricing: ezraPricing,
      },
    ],
  },
  {
    title: 'No subscription',
    intro: 'If the monthly fee is what you want to drop, these charge per booking instead.',
    entries: [
      {
        vendor: 'fareharbor',
        bestFor: 'Operators who want the most widely used system and no monthly bill.',
        why: ['Claims more than 23,000 clients and 250+ distribution partners.', 'POS, websites, waivers and an app.', 'The booking fee is usually paid by the guest.'],
        watch: ['The fee rate isn’t published.', 'Owned by Booking Holdings since 2018.'],
        pricing: vendorPricing('fareharbor'),
      },
      {
        vendor: 'peek-pro',
        bestFor: 'Rental-heavy US operators.',
        why: ['Rentals with deposits, card holds and photo records.', 'AI tools and a POS with tipping.', 'OTA connections through OCTO.'],
        watch: ['Pricing is by quote.', 'Fee figures come from competitors.'],
        pricing: vendorPricing('peek-pro'),
      },
      {
        vendor: 'xola',
        bestFor: 'Operators who want no subscription and the fee in writing.',
        why: ['6% guest-paid or 3% operator-paid, published.', 'Published US card rate.', '24/7 support.'],
        watch: ['Plan prices are “Contact for pricing”.', 'No dynamic pricing engine documented.'],
        pricing: vendorPricing('xola'),
      },
    ],
  },
]

export const ALT_CONTENT: Record<AlternativesSlug, AltContent> = {
  fareharbor: {
    slug: 'fareharbor',
    vendor: 'fareharbor',
    title: `${countEntries(FH_ALT_GROUPS)} FareHarbor Alternatives for Tour Operators (${Y})`,
    description: `${countEntries(FH_ALT_GROUPS)} FareHarbor alternatives compared on booking fees, monthly cost and features, with who each one suits. Sources checked ${MONTH}.`,
    h1: `${countEntries(FH_ALT_GROUPS)} FareHarbor alternatives, and who each one suits`,
    lede: 'People look past FareHarbor for three reasons: they want the fee rate before they sign, they want a say in who pays it, or they need something FareHarbor’s pages don’t show, such as rentals or pickups. These systems answer at least one of those. They’re grouped by how they charge, not ranked.',
    howWeChose: [
      'Each system takes online bookings for tours or activities and publishes enough about its pricing to compare, or is widely used enough to matter.',
      'We read each vendor’s own pricing and features pages. Anything from a third party is marked “Reported”.',
      'We make EZRA Pro. It’s listed in its pricing group like the others, with its drawbacks.',
    ],
    groups: FH_ALT_GROUPS,
    beforeYouSwitch: [
      { title: 'Get your FareHarbor rate in writing', body: 'You can’t compare costs without it. Ask what percentage your guests pay and whether it changes with volume.' },
      { title: 'Decide who should pay the fee', body: 'On FareHarbor the guest usually pays. Some alternatives let you absorb the fee, which shows a cleaner price on your page.' },
      { title: 'List your resellers and your website', body: 'Partners on FareHarbor’s network and sites on FareHarbor Sites both need moving. They take longer than the booking system itself.' },
    ],
    faqs: [
      { q: 'What is the cheapest FareHarbor alternative?', a: 'On published fees, Bókun: $49 a month plus 1.5% on START, with 0% on Viator bookings on paid plans. Whether that is cheaper than FareHarbor depends on who pays FareHarbor’s fee; usually it’s the guest.', source: S.bokunPricing },
      { q: 'Which alternative has no monthly fee?', a: `Xola, Zaui’s Free plan and EZRA Pro ${STARTER.name} have no subscription. Peek Pro prices by quote.` },
      { q: 'Which alternatives do pickups?', a: 'Bókun lists pick-up and drop-off points, Zaui is built around shuttles and transfers, and EZRA Pro adds pickup and drop-off to any activity and sells transfers with a driver.' },
      { q: 'Is EZRA Pro’s checkout fee-free?', a: `No. As the storefront is set up today, guests see ${GUEST_LINES} on top of the price, except on transfers.`, source: S.ezraCheckout },
    ],
  },
  'peek-pro': {
    slug: 'peek-pro',
    vendor: 'peek-pro',
    title: `${countEntries(PEEK_ALT_GROUPS)} Peek Pro Alternatives With Published Pricing (${Y})`,
    description: `${countEntries(PEEK_ALT_GROUPS)} Peek Pro alternatives that publish their fees, compared on rentals, monthly cost and who pays. Sources checked ${MONTH}.`,
    h1: `${countEntries(PEEK_ALT_GROUPS)} Peek Pro alternatives that publish their prices`,
    lede: 'Peek Pro quotes each business, so the first question when comparing it is usually “what would I pay elsewhere?” Every system below publishes enough of its pricing to answer that. Because Peek is strong on rentals, we also say how each one handles them.',
    howWeChose: [
      'Every entry publishes its subscription or its booking fee on its own site.',
      'Rental support is described from each vendor’s own pages. “Not confirmed” means we couldn’t find it, not that it’s missing.',
      'We make EZRA Pro. It’s listed with its drawbacks, including where Peek does more.',
    ],
    groups: PEEK_ALT_GROUPS,
    beforeYouSwitch: [
      { title: 'Get your Peek quote in writing', body: 'Include the booking fee, card fees, any payout fee and who pays each, and ask how quickly payouts arrive.' },
      { title: 'Count your rental handovers', body: 'If card holds and photo records save you money on damage, check that the alternative does both before you move.' },
      { title: 'Check your notice terms', body: 'Quoted pricing means your agreement sets the notice period. Read it before you pick a date.' },
    ],
    faqs: [
      { q: 'Why doesn’t Peek Pro publish prices?', a: 'Peek says it offers “custom, quote-based pricing tailored to your business rather than a fixed monthly plan.” Fee figures you see online come from third parties.', source: S.peek },
      { q: 'Which alternative is best for rentals?', a: 'It depends on the rentals. Checkfront is built around flexible item timing, Bókun and TrekkSoft include rentals with tours, and EZRA Pro counts stock per item and sells vehicles with a driver.' },
      { q: 'Which alternatives let the operator pay the fee?', a: 'Bókun, Checkfront and Rezdy let you choose. Xola’s Company Pays plan takes 3% from your payouts.', source: S.xolaCompany },
      { q: 'Does EZRA Pro have card holds like Peek?', a: 'EZRA Pro sets a refundable deposit per rental item. It doesn’t advertise card holds or photo records at handover.' },
    ],
  },
  rezdy: {
    slug: 'rezdy',
    vendor: 'rezdy',
    title: `${countEntries(REZDY_ALT_GROUPS)} Rezdy Alternatives for Tour & Activity Operators (${Y})`,
    description: `${countEntries(REZDY_ALT_GROUPS)} Rezdy alternatives compared on fees, distribution and features, including which share Rezdy’s owner. Sources checked ${MONTH}.`,
    h1: `${countEntries(REZDY_ALT_GROUPS)} Rezdy alternatives for tour and activity operators`,
    lede: 'Rezdy’s 3% online fee is the same on every plan, and it has shared an owner with Checkfront and Regiondo since 2023. So the useful questions are whether you want a lower rate as you grow, and whether you want a different company. These systems are grouped by those answers, not ranked.',
    howWeChose: [
      'Each entry takes online bookings for tours or activities and publishes its pricing, or is widely used enough to matter.',
      'Ownership comes from the vendors’ own announcements. Prices are list prices from their own pages.',
      'We make EZRA Pro. It’s listed with its drawbacks, including where Rezdy costs less.',
    ],
    groups: REZDY_ALT_GROUPS,
    beforeYouSwitch: [
      { title: 'Work out your online share', body: 'Rezdy’s 3% applies to online bookings; offline and agent bookings pay $1 or less each. Your mix decides which alternative actually saves money.' },
      { title: 'List your agents', body: 'If agents sell through Rezdy’s network, check how each alternative would reach them.' },
      { title: 'Know your currency', body: 'Rezdy lists prices exclusive of GST in Australia. Check the currency on your invoice before comparing.' },
    ],
    faqs: [
      { q: 'Is Checkfront a real alternative to Rezdy?', a: 'It’s a different product with one plan and no fee on offline or OTA bookings, but it has been in the same group as Rezdy since 2023.', source: S.merger },
      { q: 'Which alternative charges less than 3%?', a: `Bókun (1–1.5%), TrekkSoft (2–2.5% on its higher plans), bookingkit Businesskit (2%, plus other fees) and EZRA Pro ${SCALE.name} (${pct(SCALE.percent)}).` },
      { q: 'Which alternative has the biggest distribution?', a: 'Bókun claims more than 2,600 OTAs and resellers, and FareHarbor claims more than 250 distribution partners. Rezdy itself claims more than 12,000 agents.', source: S.bokunAbout },
      { q: 'Does EZRA Pro cost less than Rezdy?', a: `Not on every plan. ${STARTER.name} and ${GROWTH.name} charge ${pct(STARTER.percent)}, more than Rezdy’s 3%. ${SCALE.name} charges ${pct(SCALE.percent)} and costs less than Rezdy Foundation above about ${be('rezdy-foundation', 'ezra-scale') ?? 'a high volume'} a month online.` },
    ],
  },
}

/* ==========================================================================
   HUB
   ========================================================================== */

export const HUB = {
  title: `Compare Tour Booking Software: Fees & Features (${Y})`,
  description: `Fees, features and fit for 11 tour and activity booking platforms, checked ${MONTH} with sources. Find the right system for your business.`,
  h1: 'Compare tour and activity booking software',
  lede: 'Eleven booking systems and EZRA Pro, side by side: what each charges, who pays, what it does, and who it suits. Every figure comes from the vendor’s own pages unless it’s marked “Reported”, and every row links to its source.',
  ezraSuits: 'Operators who sell a mix of tours, rentals, transfers, passes and packages, and businesses that also run a restaurant or a few rooms.',
  methodology: [
    'We read each vendor’s own pricing and features pages and recorded what they said on the date shown.',
    '“Reported” means a figure comes from a third party, such as a competitor or a review site, because the vendor doesn’t publish it. Confirm those with the vendor.',
    '“Not shown” means we couldn’t find the feature on the vendor’s own pages. It doesn’t mean the vendor lacks it.',
    'Prices are list prices before tax, in the vendor’s own currency. Euro prices are not converted.',
    'Card processing is listed separately and only where the vendor publishes it.',
    'Review ratings are left out until we can check them by hand.',
    'We make EZRA Pro. Its row uses the same rules: plan numbers from our pricing page and fee lines from our checkout as it is today.',
  ],
}

export const ALL_VS = VS_SLUGS
export const ALL_ALTERNATIVES = ALTERNATIVES_SLUGS
