/**
 * EZRA PRO — public-site content.
 *
 * Everything an operator reads before they trust us with their season. The
 * audience is someone already running another booking platform who is doing the
 * maths on switching mid-year, so the copy answers the questions they actually
 * ask — what it costs against what they pay now, how long migration takes, who
 * owns the guest list, what happens when the harbour loses signal — instead of
 * gesturing at "powerful features".
 *
 * Pricing is not defined here: EZRA Pro has one price (4% of each booking,
 * $0 a month), kept in `@/content/marketing` and re-exported below so the two
 * can never disagree.
 */

import type { FaqItem, FeatureBlock, Integration, PricingPlan, Testimonial } from '@/types'
import { PRICING_PLANS } from '@/content/marketing'
import { avatarUrl } from './constants'

/* ==========================================================================
   PRICING
   ========================================================================== */

export { PRICING_PLANS }

export function getPricingPlan(id: string): PricingPlan | undefined {
  return PRICING_PLANS.find((plan) => plan.id === id)
}

/** Everything included, in order. */
export const PRICING_FEATURE_LABELS: string[] = PRICING_PLANS[0].features.map((feature) => feature.label)

/* ==========================================================================
   SOCIAL PROOF
   ========================================================================== */

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 'tst_kaimana',
    quote:
      'We were paying a six percent booking fee and still rekeying OTA reservations into a spreadsheet at 5am. Eleven months on EZRA and 38% more of our volume comes through our own site — the fee saving alone paid for a second rescue tender.',
    author: 'Kaimana Reyes',
    role: 'Owner',
    company: 'Blue Horizon Watersports',
    avatarUrl: avatarUrl(12, 120),
    vertical: 'watersports',
    metric: { value: '+38%', label: 'direct bookings in 11 months' },
    rating: 5,
  },
  {
    id: 'tst_imogen',
    quote:
      'The occupancy heatmap told us our Tuesday reef run had been half empty for two seasons and our Saturday was turning people away. We moved one departure. That single change added about $6,400 a month and took ten minutes.',
    author: 'Imogen Blackwood',
    role: 'General Manager',
    company: 'Coral Cay Expeditions',
    avatarUrl: avatarUrl(45, 120),
    vertical: 'island',
    metric: { value: '$6.4k', label: 'a month from one schedule change' },
    rating: 5,
  },
  {
    id: 'tst_dimitri',
    quote:
      'Prepayment killed our no-shows. We were losing four covers a night to people who never turned up; now a seat costs something to abandon and the number is under one. The room feels calmer because the pass is not cooking for ghosts.',
    author: 'Dimitri Alexopoulos',
    role: 'Chef-Patron',
    company: 'Saltline Taverna',
    avatarUrl: avatarUrl(59, 120),
    vertical: 'restaurants',
    metric: { value: '-81%', label: 'no-shows after prepayment' },
    rating: 5,
  },
  {
    id: 'tst_hana',
    quote:
      'Migration was the part I dreaded. They rebuilt eleven products, four seasonal schedules and six years of guest history, then ran both systems in parallel for two weeks. We cut over on a Tuesday and nobody on the crew noticed.',
    author: 'Hana Whitiora',
    role: 'Operations Director',
    company: 'Ridgeline Alpine Guiding',
    avatarUrl: avatarUrl(31, 120),
    vertical: 'adventure',
    metric: { value: '9 days', label: 'from contract to cutover' },
    rating: 5,
  },
  {
    id: 'tst_marco',
    quote:
      'Our guides used to carry printed manifests because the harbour has no signal past the breakwater. EZRA caches the whole day on the phone — they check guests in on the pontoon and it syncs when we come back around the headland.',
    author: 'Marco Ferretti',
    role: 'Fleet Manager',
    company: 'Cala Verde Charters',
    avatarUrl: avatarUrl(52, 120),
    vertical: 'watersports',
    metric: { value: '0', label: 'printed manifests since April' },
    rating: 5,
  },
  {
    id: 'tst_priya',
    quote:
      'Our old system could tell me what I sold. It could not tell me that guests who book more than three weeks out spend 22% more and almost never cancel. We shifted our ad spend to that window and the season paid for the whole platform by June.',
    author: 'Priya Raghunathan',
    role: 'Founder',
    company: 'Lantern Street Food Tours',
    avatarUrl: avatarUrl(26, 120),
    vertical: 'tours',
    metric: { value: '+22%', label: 'AOV on early bookers' },
    rating: 5,
  },
  {
    id: 'tst_soren',
    quote:
      'Weather holds used to mean forty phone calls and a morning gone. Now I flag the departure, everyone gets a message with a one-tap rebook link, and by nine most of them have already moved themselves to Thursday.',
    author: 'Søren Lindqvist',
    role: 'Head Skipper',
    company: 'Nordlys Fjord Safari',
    avatarUrl: avatarUrl(14, 120),
    vertical: 'adventure',
    metric: { value: '40 min', label: 'saved per weather hold' },
    rating: 5,
  },
  {
    id: 'tst_aroha',
    quote:
      'Memberships were the thing nobody else would build for us. Eight hundred locals now pay monthly for studio access and their class bookings flow through the same calendar as the retreats. Retention went from guesswork to a number I check on Mondays.',
    author: 'Aroha Ngata',
    role: 'Studio Director',
    company: 'Tidewell Coastal Retreats',
    avatarUrl: avatarUrl(47, 120),
    vertical: 'wellness',
    metric: { value: '812', label: 'active members in year one' },
    rating: 5,
  },
  {
    id: 'tst_ben',
    quote:
      'The bit that sold me was the export button. I asked for my data on the trial and it was a zip file in forty seconds — bookings, guests, payouts, waivers. After three years of raising tickets to get a CSV, that told me everything.',
    author: 'Ben Ashworth',
    role: 'Managing Director',
    company: 'Harbourline Day Cruises',
    avatarUrl: avatarUrl(68, 120),
    vertical: 'tours',
    metric: { value: '40 sec', label: 'to export six years of data' },
    rating: 5,
  },
  {
    id: 'tst_celeste',
    quote:
      'We run four islands on three currencies. Before, that was three logins, three payout schedules and a monthly reconciliation I did by hand. It is now one screen and I got my last Sunday of the month back.',
    author: 'Celeste Moreau',
    role: 'Finance Lead',
    company: 'Archipel Island Hopping',
    avatarUrl: avatarUrl(49, 120),
    vertical: 'island',
    metric: { value: '3 → 1', label: 'systems to close the month' },
    rating: 4,
  },
]

/* ==========================================================================
   FAQ
   ========================================================================== */

export const FAQS: FaqItem[] = [
  {
    id: 'faq_commission',
    category: 'pricing',
    question: 'What does EZRA Pro cost?',
    answer:
      '4% of each booking. That is the entire bill: no monthly fee, no setup fee, no contract, and every feature is included.',
  },
  {
    id: 'faq_guest_fee',
    category: 'pricing',
    question: 'Can I pass the 4% to the guest?',
    answer:
      'Yes. You choose in Settings: pay it yourself and guests pay the price you set, or pass it on as one “Booking fee (4%)” line at checkout. Card fees stay between you and your payment provider.',
  },
  {
    id: 'faq_contract',
    category: 'pricing',
    question: 'Is there a contract or a minimum term?',
    answer:
      'No. There is no contract and no monthly fee, so there is nothing to cancel: you pay 4% of the bookings you take and can leave whenever you like, including mid-season.',
  },
  {
    id: 'faq_migration_effort',
    category: 'migration',
    question: 'How much work is migrating off my current system?',
    answer:
      'For a single-location operator with under twenty products, most of a day. You export your products, schedules, guests and booking history; we import them and rebuild your seasonal calendars, then send you a diff to check line by line. We can run both systems in parallel for two weeks before cutover, so there is never a day where your bookings only exist in one place.',
  },
  {
    id: 'faq_future_bookings',
    category: 'migration',
    question: 'What happens to bookings already on the calendar for next season?',
    answer:
      'They come with you — guest details, party composition, payment status, signed waivers and any outstanding balance. Future departures keep their original confirmation codes so a guest who searches their inbox still finds the right reference, and balance-due reminders pick up on the schedule they were already on.',
  },
  {
    id: 'faq_payout_timing',
    category: 'payments',
    question: 'When do I actually get paid?',
    answer:
      'Next business day: everything captured by midnight lands in your account the following working morning, including the deposit portion of part-paid bookings. You are paid on capture, not on departure, so a guest booking in March for an August trip funds your March.',
  },
  {
    id: 'faq_chargebacks',
    category: 'payments',
    question: 'Who handles chargebacks and disputes?',
    answer:
      'We do, and we do not charge you for it. When a dispute lands we automatically assemble the evidence pack — the booking record, the timestamped waiver, the check-in scan, the confirmation and reminder emails with delivery receipts, and the cancellation policy the guest accepted — and file it. That pack is why our win rate on activity disputes runs above eighty percent; the signed waiver with a device timestamp is usually the whole argument.',
  },
  {
    id: 'faq_deposits',
    category: 'payments',
    question: 'Can I take a deposit now and the balance later?',
    answer:
      'Yes, as a percentage or a flat amount, set per activity. The balance is collected automatically on a schedule you choose — a fixed number of days before departure, or at check-in for walk-up balances. Failed balance captures retry on a decay schedule and escalate to your team with a payment link you can text the guest.',
  },
  {
    id: 'faq_offline',
    category: 'product',
    question: 'Does check-in work when there is no signal at the dock?',
    answer:
      'Yes. The day’s manifests cache on the device each morning, so scanning passes, checking guests in, countersigning waivers and adding walk-ups all work fully offline. Actions queue locally and reconcile when you come back into range, with conflicts surfaced rather than silently resolved. This is the single most common reason harbour and backcountry operators switch to us.',
  },
  {
    id: 'faq_ota',
    category: 'product',
    question: 'Do you connect to Viator, GetYourGuide and Expedia?',
    answer:
      'Yes, through a live two-way connection rather than a nightly file. Availability is one pool: a seat sold on Viator disappears from your widget in seconds and from Google Things to do just as fast. Pricing and cut-offs are managed per channel from one screen, so you can hold back inventory on marketplaces without maintaining a second calendar.',
  },
  {
    id: 'faq_resources',
    category: 'product',
    question: 'Can it stop me double-booking the same boat?',
    answer:
      'That is the point of modelling resources rather than just time slots. Vessels, vehicles, guides, gear sets and tables are real inventory with their own capacity and maintenance windows. If two products need the same hull at overlapping times, the second one cannot be scheduled — and if a vessel goes into maintenance, every affected departure is flagged with the seats at risk and the alternatives that could cover it.',
  },
  {
    id: 'faq_data_export',
    category: 'product',
    question: 'Who owns my guest list, and can I take it with me?',
    answer:
      'You own it, unambiguously, and export is a button rather than a support ticket. Bookings, guests, payments, payouts, waivers and reviews all export as CSV or Parquet, and there is a REST API and webhooks for continuous sync into your own warehouse. We will never sell your guests a competing product or market to them on our own behalf.',
  },
  {
    id: 'faq_support',
    category: 'support',
    question: 'What does support look like in the middle of a busy Saturday?',
    answer:
      'Live chat and phone seven days a week, staffed 05:00–22:00 in your local time because that is when trips actually run. Median first response is under four minutes in season. Everyone on the support team has worked operations for an activity business — you will not be asked to clear your cache when a boat is leaving in ten minutes.',
  },
  {
    id: 'faq_training',
    category: 'support',
    question: 'How long does it take to train seasonal crew?',
    answer:
      'The guide app is one screen: today’s departures, the manifest, a scanner. New seasonal staff are typically running check-in unaided after a ten-minute walkthrough. Admin roles are granular, so a guide can check guests in and add a walk-up without ever seeing revenue, refunds or another guide’s roster.',
  },
  {
    id: 'faq_multi_location',
    category: 'product',
    question: 'We run several sites in different currencies. Does that work?',
    answer:
      'Yes. Each location keeps its own products, staff, tax treatment, payout account and currency, while you get one login and a consolidated view that converts at the day’s rate for reporting without touching the underlying books. Staff permissions are scoped per location by default.',
  },
  {
    id: 'faq_trial',
    category: 'pricing',
    question: 'Can I trial it during my season without risking live bookings?',
    answer:
      'Yes. Trials start in a sandbox seeded with your real products and a copy of last season’s pattern, so you can run a full day, take test payments and put your crew through check-in before a single guest is involved. When you are ready, flipping to live is one switch and the sandbox data is discarded.',
  },
]

/* ==========================================================================
   PRODUCT PILLARS
   ========================================================================== */

export const FEATURE_BLOCKS: FeatureBlock[] = [
  {
    id: 'feat_calendar',
    eyebrow: 'Operations',
    title: 'A calendar that understands boats, not just time slots',
    line: 'Departures are built from resources — hulls, vehicles, guides, gear, tables — so the schedule refuses to sell something you cannot physically run.',
    description:
      'Departures are built from resources — hulls, vehicles, guides, gear, tables — so the schedule refuses to sell something you cannot physically run. Drag a departure and every dependency moves with it.',
    icon: 'CalendarRange',
    bullets: [
      'Month, week, day, timeline and agenda views on the same data',
      'Conflict detection across vessels, crew and equipment',
      'Maintenance windows that flag the seats at risk before they sell',
      'Weather holds that message every affected guest in one action',
    ],
    accent: 'lagoon',
  },
  {
    id: 'feat_analytics',
    eyebrow: 'Analytics',
    title: 'Numbers you can click into',
    line: 'Every figure on every chart traces back to the bookings that produced it.',
    description:
      'Every figure on every chart traces back to the bookings that produced it. No parallel reporting warehouse, no "why does this not match the manifest" — one set of rows, read many ways.',
    icon: 'LineChart',
    bullets: [
      'Occupancy heatmaps by weekday and hour, down to the slot',
      'Cohort retention and repeat-guest economics',
      'Channel attribution with true commission cost per booking',
      'Prior-period and year-on-year comparison on every metric',
    ],
    accent: 'reef',
  },
  {
    id: 'feat_checkout',
    eyebrow: 'Conversion',
    title: 'A checkout that does not lose the sale',
    line: 'Three steps, no account required, Apple Pay and Google Pay on the first tap.',
    description:
      'Three steps, no account required, Apple Pay and Google Pay on the first tap. It loads in under a second on a phone with two bars at the beach, which is where most of your traffic actually is.',
    icon: 'Smartphone',
    bullets: [
      'Real-time availability with held seats during checkout',
      'Add-ons, promo codes and gift cards inline',
      'Abandoned-cart recovery with a one-tap resume link',
      'Guest checkout with optional account creation after payment',
    ],
    accent: 'coral',
  },
  {
    id: 'feat_manifest',
    eyebrow: 'On the ground',
    title: 'The dock works without signal',
    line: 'Manifests cache to the device each morning.',
    description:
      'Manifests cache to the device each morning. Scan passes, check guests in, countersign waivers and add walk-ups with no connection at all — everything reconciles when you come back into range.',
    icon: 'ScanLine',
    bullets: [
      'Offline-first check-in with conflict-aware sync',
      'Digital waivers countersigned on the guest’s own phone',
      'Dietary, medical and accessibility flags on the manifest',
      'Walk-up sales and on-the-spot payment at the gangway',
    ],
    accent: 'sunset',
  },
  {
    id: 'feat_channels',
    eyebrow: 'Distribution',
    title: 'One availability pool, every channel',
    line: 'Viator, GetYourGuide, Expedia, Google Things to do, your own site and your concierge partners all draw from the same seats.',
    description:
      'Viator, GetYourGuide, Expedia, Google Things to do, your own site and your concierge partners all draw from the same seats. Sell one, and it is gone everywhere in seconds.',
    icon: 'Globe',
    bullets: [
      'Live two-way connections, not nightly file drops',
      'Per-channel pricing, cut-offs and inventory ceilings',
      'Commission cost surfaced per booking, not per invoice',
      'Automatic reconciliation of marketplace remittances',
    ],
    accent: 'lagoon',
  },
  {
    id: 'feat_pricing',
    eyebrow: 'Yield',
    title: 'Pricing that reacts to the season',
    line: 'Rules on lead time, day of week, forecast occupancy and weather confidence, with hard floors and ceilings so a guest never sees a number you would not defend.',
    description:
      'Rules on lead time, day of week, forecast occupancy and weather confidence, with hard floors and ceilings so a guest never sees a number you would not defend. Every adjustment is logged and reversible.',
    icon: 'SlidersHorizontal',
    bullets: [
      'Occupancy-triggered surge with an operator-set cap',
      'Last-minute release pricing to clear perishable seats',
      'Group, resident and shoulder-season rate cards',
      'Simulated impact before a rule ever goes live',
    ],
    accent: 'sunset',
  },
  {
    id: 'feat_crm',
    eyebrow: 'Guests',
    title: 'A guest record, not a row in a booking list',
    line: 'Every guest carries their history, party, waivers, preferences, spend and the reason they came back.',
    description:
      'Every guest carries their history, party, waivers, preferences, spend and the reason they came back. Segments are queryable and sync to your marketing tools without a CSV round-trip.',
    icon: 'Users',
    bullets: [
      'Lifetime value, visit cadence and churn risk per guest',
      'Automatic segmentation: new, returning, VIP, lapsed',
      'Post-trip review requests timed to when people actually reply',
      'Two-way sync with Klaviyo, Mailchimp and HubSpot',
    ],
    accent: 'coral',
  },
  {
    id: 'feat_payments',
    eyebrow: 'Money',
    title: 'Deposits, balances and payouts that reconcile themselves',
    line: 'Take a deposit in March, collect the balance automatically in July, refund to policy in one click.',
    description:
      'Take a deposit in March, collect the balance automatically in July, refund to policy in one click. Payouts arrive next business day with a statement that ties to the bookings behind it.',
    icon: 'Banknote',
    bullets: [
      'Deposit schedules and automatic balance capture with retries',
      'Policy-aware refunds, partial refunds and store credit',
      'Chargeback evidence packs assembled and filed for you',
      'Payout statements that reconcile line by line to bookings',
    ],
    accent: 'reef',
  },
  {
    id: 'feat_team',
    eyebrow: 'Team',
    title: 'Rosters, certifications and roles that fit a seasonal crew',
    line: 'Assign guides by qualification, not by memory.',
    description:
      'Assign guides by qualification, not by memory. Certifications expire loudly, permissions are scoped to the job, and a summer hire sees today’s manifest and nothing else.',
    icon: 'UserCheck',
    bullets: [
      'Certification tracking with expiry warnings before rostering',
      'Guide-level permissions that hide revenue and guest contacts',
      'Availability, shift swaps and no-clash assignment',
      'Per-departure staffing ratios enforced at schedule time',
    ],
    accent: 'lagoon',
  },
  {
    id: 'feat_platform',
    eyebrow: 'Platform',
    title: 'Your data, your domain, your rules',
    line: 'White-label storefront on your own domain, an open API, webhooks for everything, and an export button that actually works.',
    description:
      'White-label storefront on your own domain, an open API, webhooks for everything, and an export button that actually works. Leaving is easy, which is the only honest reason to stay.',
    icon: 'PlugZap',
    bullets: [
      'Storefront and emails on your domain and brand',
      'REST API, webhooks and signed event delivery',
      'CSV and Parquet exports of every object, on demand',
      'SSO/SAML, granular roles and a complete audit log',
    ],
    accent: 'reef',
  },
]

/* ==========================================================================
   INTEGRATIONS
   ========================================================================== */

export const INTEGRATIONS: Integration[] = [
  {
    id: 'int_stripe',
    name: 'Stripe',
    category: 'payments',
    description:
      'Cards, Apple Pay, Google Pay and bank debits with next-business-day payouts and dispute handling built in.',
    mark: 'S',
  },
  {
    id: 'int_square',
    name: 'Square',
    category: 'payments',
    description:
      'Bring your existing terminal to the dock. Walk-up sales land on the same manifest as online bookings.',
    mark: '□',
  },
  {
    id: 'int_adyen',
    name: 'Adyen',
    category: 'payments',
    description:
      'Multi-entity, multi-currency acquiring for operators settling in more than one country.',
    mark: 'A',
  },
  {
    id: 'int_paypal',
    name: 'PayPal',
    category: 'payments',
    description:
      'Offered at checkout as a second wallet — measurably lifts conversion on long-haul source markets.',
    mark: 'P',
  },
  {
    id: 'int_viator',
    name: 'Viator',
    category: 'ota',
    description:
      'Live two-way availability and instant confirmation across Viator and Tripadvisor Experiences.',
    mark: 'V',
  },
  {
    id: 'int_gyg',
    name: 'GetYourGuide',
    category: 'ota',
    description:
      'Real-time inventory sync with per-channel pricing, cut-offs and an inventory ceiling you control.',
    mark: 'G',
  },
  {
    id: 'int_expedia',
    name: 'Expedia Local Expert',
    category: 'ota',
    description:
      'Distribute into Expedia’s activities marketplace without maintaining a second calendar.',
    mark: 'E',
  },
  {
    id: 'int_google',
    name: 'Google Things to do',
    category: 'ota',
    description:
      'Free booking links straight from Search and Maps, pointed at your own checkout rather than a marketplace.',
    mark: 'G',
  },
  {
    id: 'int_klook',
    name: 'Klook',
    category: 'ota',
    description:
      'Reach the APAC source markets that dominate shoulder season, with redemption codes scanned at check-in.',
    mark: 'K',
  },
  {
    id: 'int_tripadvisor',
    name: 'Tripadvisor',
    category: 'marketing',
    description:
      'Review requests routed to your listing, with ratings pulled back onto your storefront automatically.',
    mark: 'T',
  },
  {
    id: 'int_klaviyo',
    name: 'Klaviyo',
    category: 'marketing',
    description:
      'Segments sync continuously — lapsed guests, VIPs, high-lead-time bookers — with booking events as triggers.',
    mark: 'K',
  },
  {
    id: 'int_mailchimp',
    name: 'Mailchimp',
    category: 'marketing',
    description:
      'Audience sync with consent state respected, so marketing opt-out actually means opted out.',
    mark: 'M',
  },
  {
    id: 'int_hubspot',
    name: 'HubSpot',
    category: 'marketing',
    description:
      'Push corporate, group and charter enquiries into your pipeline with the departure attached.',
    mark: 'H',
  },
  {
    id: 'int_meta',
    name: 'Meta Pixel & CAPI',
    category: 'marketing',
    description:
      'Server-side conversion events with real booking values, so attribution survives the browser.',
    mark: 'M',
  },
  {
    id: 'int_ga4',
    name: 'Google Analytics 4',
    category: 'marketing',
    description:
      'Full ecommerce event stream from the widget — availability checks, add-ons, abandonment and purchase.',
    mark: 'G',
  },
  {
    id: 'int_quickbooks',
    name: 'QuickBooks',
    category: 'accounting',
    description:
      'Daily journals for takings, refunds, fees and payouts, mapped to your chart of accounts.',
    mark: 'Q',
  },
  {
    id: 'int_xero',
    name: 'Xero',
    category: 'accounting',
    description:
      'Payout-level reconciliation with tax treatment preserved per location and per activity.',
    mark: 'X',
  },
  {
    id: 'int_twilio',
    name: 'Twilio',
    category: 'comms',
    description:
      'SMS reminders, weather-hold alerts and rebooking links at carrier cost with no markup.',
    mark: 'T',
  },
  {
    id: 'int_slack',
    name: 'Slack',
    category: 'comms',
    description:
      'Booking, cancellation, capacity and weather alerts routed to the channel your crew already watches.',
    mark: '#',
  },
  {
    id: 'int_zapier',
    name: 'Zapier',
    category: 'ops',
    description:
      'Seven hundred triggers and actions for the one workflow nobody else has built for you yet.',
    mark: 'Z',
  },
  {
    id: 'int_wheretheapp',
    name: 'Whereabouts GPS',
    category: 'ops',
    description:
      'Live vessel and vehicle positions on the dispatch board, with delay alerts to waiting guests.',
    mark: 'W',
  },
  {
    id: 'int_zendesk',
    name: 'Zendesk',
    category: 'ops',
    description:
      'Guest tickets open with the booking, manifest and payment history already attached.',
    mark: 'Z',
  },
]

export function getIntegrationsByCategory(category: Integration['category']): Integration[] {
  return INTEGRATIONS.filter((integration) => integration.category === category)
}

/** Category order and display names for the integrations directory. */
export const INTEGRATION_CATEGORIES: { key: Integration['category']; label: string }[] = [
  { key: 'payments', label: 'Payments' },
  { key: 'ota', label: 'Distribution' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'comms', label: 'Communications' },
  { key: 'ops', label: 'Operations' },
]

/* ==========================================================================
   LANDING-PAGE PROOF
   ========================================================================== */

export const STATS: { value: string; label: string; hint?: string }[] = [
  {
    value: '$1.4B',
    label: 'booked through EZRA Pro',
    hint: 'Gross booking value processed across all operators in the last twelve months.',
  },
  {
    value: '2,900+',
    label: 'operators in 41 countries',
    hint: 'From single-boat charters to fleets running a quarter of a million guests a season.',
  },
  {
    value: '+31%',
    label: 'median lift in direct bookings',
    hint: 'Measured over the first two seasons after switching, against the operator’s own prior baseline.',
  },
  {
    value: '<4 min',
    label: 'median support response',
    hint: 'In-season, seven days a week, from people who have run operations themselves.',
  },
]

export const LOGO_MARKS: { name: string; mark: string }[] = [
  { name: 'Blue Horizon Watersports', mark: 'BH' },
  { name: 'Coral Cay Expeditions', mark: 'CC' },
  { name: 'Saltline Taverna', mark: 'SL' },
  { name: 'Ridgeline Alpine Guiding', mark: 'RA' },
  { name: 'Cala Verde Charters', mark: 'CV' },
  { name: 'Nordlys Fjord Safari', mark: 'NF' },
  { name: 'Lantern Street Food Tours', mark: 'LS' },
  { name: 'Archipel Island Hopping', mark: 'AI' },
  { name: 'Tidewell Coastal Retreats', mark: 'TW' },
  { name: 'Harbourline Day Cruises', mark: 'HL' },
]
