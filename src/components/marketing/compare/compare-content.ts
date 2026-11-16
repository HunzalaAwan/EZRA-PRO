/**
 * Copy for the /compare pages. Facts about other vendors come from
 * `@/lib/data/competitors` with their sources; every FAQ answer that rests on
 * a vendor's page carries that source, and it is listed under Sources.
 *
 * Cost figures are worked out from the plan rates, so the copy cannot drift
 * from the numbers. The FAQ answers are printed word for word in the FAQPage
 * schema, so keep them plain sentences.
 */

import type { FeatureTopic, TitledText } from '@/components/marketing/compare/compare-longform'
import { CHECKED_YEAR, EZRA_PLAN, SOURCES as S, breakEven, formatCheckedMonth, money, type RowKey, type Source, type VendorId, type VsSlug } from '@/lib/data/competitors'

const MONTH = formatCheckedMonth()
const Y = CHECKED_YEAR
const P = `${EZRA_PLAN.percent}%`

/** Where EZRA Pro and another plan cost the same, rounded to $100. */
function crossOver(id: string) {
  return money(Math.round((breakEven('ezra', id) ?? 0) / 100) * 100)
}

const BOKUN_BREAK_EVEN = crossOver('bokun-start')
const CHECKFRONT_BREAK_EVEN = crossOver('checkfront')
const BOOKEO_BREAK_EVEN = crossOver('bookeo-standard')

export interface Faq {
  q: string
  a: string
  source?: Source
  reported?: boolean
}

export interface VsContent {
  slug: VsSlug
  vendor: VendorId
  /** <title>, under 60 characters. */
  title: string
  /** Meta description, under 160 characters. */
  description: string
  h1: string
  /** One line under the headline. */
  subhead: string
  /** One fair line under the side-by-side, when the other system wins on something. */
  fairNote?: string
  /** Two short paragraphs: the whole comparison in brief. */
  shortAnswer: string[]
  /** Who the other company is: founded, owner, who it's for. */
  about: string[]
  verdict: { them: string[]; us: string[] }
  /** Over the cost check. */
  costText: string[]
  /** Starting value for the cost check. */
  costValue: number
  switchIntro: string
  switchReasons: TitledText[]
  /** Review pages the reasons come from. */
  switchSources?: Source[]
  topics: FeatureTopic[]
  /** Vendor pages the topics rest on, listed under Sources. */
  topicSources?: Source[]
  /** Step one of moving over: getting your data out of them. */
  exportStep: string
  /** Which testimonial to show (src/content/marketing.ts). */
  quoteId: string
  faqs: Faq[]
}

/* ==========================================================================
   Shared EZRA Pro lines, so every page says the same thing
   ========================================================================== */

const US = {
  payments: `Card payments run through Stripe, built in, and money lands in your bank the next business day. You choose whether you pay the ${P} or guests see it as a booking fee.`,
  otas: 'Two-way sync with Viator, GetYourGuide and Expedia, so a spot sold on one channel closes everywhere else. No extra charge from us on top of the marketplace’s own commission.',
  crm: 'Every guest gets a record with their bookings, notes and waivers. Send emails and texts, run campaigns and set up automatic flows, like a review request the day after a trip.',
  reports: 'Reports show busy and quiet times, where bookings come from and who comes back, with plain-language suggestions on what to change.',
  support: 'Real people seven days a week, including the busy season. The move from your current system is free.',
  sell: 'Tours, private trips, rentals with stock per item, rides with a driver, gift cards and memberships, and even restaurant tables and hotel rooms, under one login.',
}

/** The five steps of moving over. The first is specific to the system you leave. */
export function moveSteps(vendorName: string, exportStep: string): TitledText[] {
  return [
    { title: `Export your data from ${vendorName}`, body: exportStep },
    {
      title: 'Send it to us',
      body: 'We rebuild your activities, prices, add-ons, guest records and every future booking in EZRA Pro. The move is free.',
    },
    {
      title: 'Check your activities',
      body: 'Walk through each activity in the setup screens: times, spots, prices, waivers and cancellation rules. Change anything that isn’t right.',
    },
    {
      title: 'Connect payments and marketplaces',
      body: 'Connect Stripe so payouts land the next business day, then reconnect Viator, GetYourGuide or Expedia so your spots stay in sync.',
    },
    {
      title: 'Switch your Book now buttons',
      body: `Point the buttons on your website to your EZRA Pro booking page. Bookings already made keep their times and guests, so you don’t have to pause sales.`,
    },
  ]
}

/* ==========================================================================
   The seven comparisons
   ========================================================================== */

export const VS_CONTENT: Record<VsSlug, VsContent> = {
  fareharbor: {
    slug: 'fareharbor',
    vendor: 'fareharbor',
    title: `EZRA Pro vs FareHarbor: Pricing & Features (${Y})`,
    description: `FareHarbor doesn’t publish its booking fee; reports put it near 6%. EZRA Pro is ${P} per booking, $0 a month, and you choose who pays.`,
    h1: 'EZRA Pro vs FareHarbor',
    subhead: `FareHarbor keeps its fee unpublished. Ours is ${P}, and you choose who pays it.`,
    shortAnswer: [
      `FareHarbor and EZRA Pro both cost $0 a month. The difference is the fee on each booking. FareHarbor doesn’t publish its fee, and by default the guest pays it at checkout. Third parties put it near 6%. EZRA Pro is ${P}, printed on our pricing page, and you decide whether you pay it or your guests do.`,
      'On features the two are close: both sell on Viator, GetYourGuide and Expedia, both have waivers and gift cards, and both handle equipment rentals. EZRA Pro adds rides with a driver, restaurant tables and hotel rooms, built-in email and text marketing, and next-business-day payouts.',
    ],
    about: [
      "FareHarbor is a booking system for tours, activities and rentals. Booking Holdings, the company behind Booking.com, has owned it since 2018.",
      "It earns mainly from a booking fee that guests pay at checkout, which is why it can offer the software with no monthly bill. Operators can choose a commission model instead, paid by the business.",
    ],
    verdict: {
      them: ['You lean on its partner network', 'You want the best-known name', 'Guests paying the fee suits you'],
      us: ['You want the rate in writing', 'You choose who pays the fee', 'You sell rentals or rides too'],
    },
    costText: [
      `With FareHarbor’s default setup, guests pay the fee, so it costs you nothing directly. Your guests still pay it: at about 6%, a $100 trip costs them $106. With EZRA Pro passed to guests, the same trip costs them $104. If you’d rather absorb the fee yourself, this is what each one costs you in a month.`,
    ],
    costValue: 10_000,
    switchIntro: 'These are the reasons operators give most often in public reviews. They’re what reviewers said, not our own tests.',
    switchReasons: [
      { title: 'The fee on guests feels steep', body: 'Reviewers say a booking fee of around 6% added at checkout puts some guests off, and they can’t see the rate in advance.' },
      { title: 'Reports don’t go deep enough', body: 'Some operators want more detail on deposits and money taken outside the booking system.' },
      { title: 'Setting up tours takes time', body: 'Reviewers describe creating and editing tours as complicated until you’ve learned the system.' },
    ],
    switchSources: [S.capterraFh],
    topics: [
      { title: 'Payments and payouts', them: 'FareHarbor processes payments itself, and its help pages say payouts run daily by default. You can’t bring your own payment processor.', us: US.payments },
      { title: 'Viator, GetYourGuide and Expedia', them: 'FareHarbor connects directly with major marketplaces including Viator, GetYourGuide and Expedia.', us: US.otas },
      { title: 'Guest records and marketing', them: 'FareHarbor keeps customer records and connects to Mailchimp and HubSpot for email marketing.', us: US.crm },
      { title: 'Reports', them: 'FareHarbor offers customizable reports.', us: US.reports },
      { title: 'Support', them: 'FareHarbor says its support team is available 24/7 by email.', us: US.support },
      { title: 'What you can sell', them: 'Tours and activities, equipment rentals with card holds, waivers and gift cards.', us: US.sell },
    ],
    topicSources: [S.fhPayouts, S.fhOtas, S.fhIntegrations, S.fhWelcome],
    exportStep: 'We couldn’t find a self-serve export guide in FareHarbor’s help pages, so ask its support team for your customer list and upcoming bookings. Its terms let either side end the agreement with 15 days’ written notice.',
    quoteId: 'tst-1',
    faqs: [
      { q: 'Is FareHarbor free?', a: 'There’s no monthly fee. By default guests pay FareHarbor a booking fee at checkout.', source: S.fhTos },
      { q: 'How much is FareHarbor’s booking fee?', a: 'It isn’t published. Third parties put it near 6%.', source: S.captainbookFh, reported: true },
      { q: 'Who pays FareHarbor’s booking fee?', a: 'By default the guest pays it. FareHarbor’s terms also offer a commission option that the business pays instead.', source: S.fhTos },
      { q: 'Does FareHarbor connect to Viator?', a: 'Yes. FareHarbor connects directly with marketplaces including Viator, GetYourGuide and Expedia. So does EZRA Pro.', source: S.fhOtas },
      { q: 'Does FareHarbor have digital waivers?', a: 'Yes. Since 2024 FareHarbor has a free built-in waiver tool. EZRA Pro has waivers built in too.', source: S.fhWaivers },
      { q: 'Can I leave FareHarbor anytime?', a: 'Its terms for providers run with no end date, and either side can end them with 15 days’ written notice.', source: S.fhTos },
      { q: 'Who owns FareHarbor?', a: 'Booking Holdings, the parent of Booking.com, since 2018.', source: S.fhSec },
      { q: 'Is EZRA Pro cheaper than FareHarbor?', a: `Yes, at the reported rates. EZRA Pro is ${P} per booking against about 6% at FareHarbor, whoever pays it.` },
    ],
  },

  'peek-pro': {
    slug: 'peek-pro',
    vendor: 'peek-pro',
    title: `EZRA Pro vs Peek Pro: Pricing & Features (${Y})`,
    description: `Peek Pro prices by quote; reports say up to 6–8% a booking. EZRA Pro publishes one price: ${P} per booking, $0 a month. Checked ${MONTH}.`,
    h1: 'EZRA Pro vs Peek Pro',
    subhead: `Peek Pro prices by quote. EZRA Pro is ${P} per booking, right on the page.`,
    shortAnswer: [
      `Peek Pro doesn’t publish a price. It quotes each business, and one report puts its fee at up to 6–8% of each online booking. EZRA Pro has one published price: ${P} per booking and $0 a month, and you choose whether you or your guests pay it.`,
      'Both are full systems: marketplaces, waivers, gift cards, email marketing and rentals. Peek Pro is strong on rentals with card holds and phone support. EZRA Pro adds rides with a driver, restaurants and small hotels, and an agreement you can leave whenever you like.',
    ],
    about: [
      "Peek Pro is booking software for tours, activities and rentals. It quotes each business rather than publishing one price.",
      "Peek runs payments itself and pays out each business day. Its merchant agreement runs for a set term and renews automatically, so check the term in your service order before you sign.",
    ],
    verdict: {
      them: ['You need card holds on rentals', 'You want phone support in Spanish', 'You’d rather negotiate a quote'],
      us: ['You want a price you can read today', 'You don’t want a renewal term', 'You also run rides with a driver'],
    },
    costText: [
      'Peek Pro’s real price is whatever your quote says. The figure below uses the reported 6% so you can see the gap; ask Peek for your rate in writing and compare it with the slider.',
    ],
    costValue: 10_000,
    switchIntro: 'These are the reasons operators give most often in public reviews. They’re what reviewers said, not our own tests, and some of the reviews are a few years old.',
    switchReasons: [
      { title: 'Support is hard to reach', body: 'Reviewers describe long waits and slow replies when something goes wrong in the busy season.' },
      { title: 'The back end is complicated', body: 'Some operators say setting Peek up and making changes takes longer than they expected.' },
      { title: 'Reports don’t suit bookkeeping', body: 'Reviewers want reports they can shape for their accounts, and mention features that didn’t behave reliably.' },
    ],
    switchSources: [S.saPeek, S.capterraPeek],
    topics: [
      { title: 'Payments and payouts', them: 'Peek processes payments itself, with processors it chooses. Its merchant agreement says payouts are made each business day.', us: US.payments },
      { title: 'Viator, GetYourGuide and Expedia', them: 'Peek Pro lists Viator and GetYourGuide among its integrations, with a channel manager that syncs availability.', us: US.otas },
      { title: 'Guest records and marketing', them: 'Peek sends abandoned-booking emails and connects to Mailchimp and Klaviyo.', us: US.crm },
      { title: 'Reports', them: 'Peek Pro lists analytics as part of its paid plans.', us: US.reports },
      { title: 'Support', them: 'Peek answers by phone in English and Spanish, seven days a week, and by in-app chat.', us: US.support },
      { title: 'What you can sell', them: 'Tours and activities, rentals with inventory, deposits and card holds, waivers and gift cards.', us: US.sell },
    ],
    topicSources: [S.peekTerms, S.peekGrow, S.peekHawaii, S.peekSupport, S.peekRentals],
    exportStep: 'Ask Peek for your customer and booking data. Peek Pro also offers data exports through its developer tools. Check your renewal date first: its agreement renews automatically unless you give written notice at least 30 days before the term ends.',
    quoteId: 'tst-6',
    faqs: [
      { q: 'How much does Peek Pro cost?', a: 'Peek prices by quote. One report puts it at up to 6–8% of each online booking.', source: S.bokunOnPeek, reported: true },
      { q: 'Who pays Peek’s booking fee?', a: 'It varies. Ask Peek for your terms in writing.', source: S.g2Peek, reported: true },
      { q: 'Can I cancel Peek Pro anytime?', a: 'Not mid-term. Its agreement renews automatically, and you need to give written notice at least 30 days before the term ends.', source: S.peekTerms },
      { q: 'How fast does Peek Pro pay out?', a: 'Its merchant agreement says payouts are made each business day that isn’t a bank holiday.', source: S.peekTerms },
      { q: 'Does Peek Pro connect to Viator and GetYourGuide?', a: 'Yes. Peek lists both, and its channel manager syncs availability. EZRA Pro syncs with Viator, GetYourGuide and Expedia.', source: S.peek },
      { q: 'Does Peek Pro have waivers?', a: 'Yes, free digital waivers that guests can sign before they arrive. EZRA Pro has waivers built in too.', source: S.peekRentals },
      { q: 'Does EZRA Pro do card holds?', a: 'No. It takes a refundable deposit per rental item instead.' },
    ],
  },

  bokun: {
    slug: 'bokun',
    vendor: 'bokun',
    title: `EZRA Pro vs Bókun: Pricing & Features (${Y})`,
    description: `Bókun (Bokun) charges a monthly plan plus 1–1.5%. EZRA Pro is ${P} per booking with no monthly bill. See which costs less at your volume.`,
    h1: 'EZRA Pro vs Bókun',
    subhead: 'Bókun is cheaper at high volume. EZRA Pro costs nothing in a quiet month.',
    fairNote: `To be fair: above about ${BOKUN_BREAK_EVEN} a month online, Bókun’s paid plans cost less than EZRA Pro.`,
    shortAnswer: [
      `Bókun charges a monthly plan from $49 to $499 plus 1–1.5% of each booking, or a free plan for one user. EZRA Pro is ${P} per booking with no monthly bill. Above about ${BOKUN_BREAK_EVEN} a month in online bookings, Bókun costs less; below that, and in quiet months, EZRA Pro does.`,
      'Bókun is built around marketplaces, with more than 70 connections. EZRA Pro covers the big three, Viator, GetYourGuide and Expedia, and adds waivers, rentals with stock per item, rides, restaurants and stays without add-on apps.',
    ],
    about: [
      "Bókun is a booking system and marketplace for tour operators, owned since 2018 by Tripadvisor, which also owns Viator.",
      "It earns from monthly plans and a small fee on each booking, and it charges no fee on Viator bookings. Many features, like waivers, come from apps in its app store.",
    ],
    verdict: {
      them: ['Viator is a big share of sales', `You sell over ${BOKUN_BREAK_EVEN} a month online`, 'You want its OTA marketplace'],
      us: ['You want no monthly bill', 'Your season has quiet months', 'You want waivers built in'],
    },
    costText: [
      'Bókun has three paid plans; the check below picks whichever costs least at your number. Bókun also has a free plan for one user with manual bookings, and it charges no fee on Viator bookings.',
    ],
    costValue: 3_000,
    switchIntro: 'These are the reasons operators give most often in public reviews. They’re what reviewers said, not our own tests.',
    switchReasons: [
      { title: 'The fees add up', body: 'A monthly plan plus a fee on every booking adds up in a slow month, reviewers say.' },
      { title: 'Worries about who owns the data', body: 'Bókun belongs to Tripadvisor, which also owns Viator. Some operators don’t like a marketplace owning their booking system.' },
      { title: 'Integrations and alerts misfire', body: 'Reviewers mention unreliable notifications and integrations, and a steep learning curve.' },
    ],
    switchSources: [S.capterraBokun],
    topics: [
      { title: 'Payments and payouts', them: 'You connect your own payment provider, such as Stripe, PayPal or Braintree, so payout timing depends on that provider.', us: US.payments },
      { title: 'Viator, GetYourGuide and Expedia', them: 'Bókun connects to more than 70 marketplaces, including Viator and Expedia, and charges no fee on Viator bookings.', us: US.otas },
      { title: 'Guest records and marketing', them: 'Bókun has a simple customer list and targeted emails.', us: US.crm },
      { title: 'Reports', them: 'Custom reports that export to a spreadsheet.', us: US.reports },
      { title: 'Support', them: 'Live chat, every day from 7am to 11:30pm GMT. Priority support on PREMIUM.', us: US.support },
      { title: 'What you can sell', them: 'Tours and activities with shared resources. Waivers come from add-on apps.', us: US.sell },
    ],
    topicSources: [S.bokunPayments, S.bokunExpedia, S.bokunComms, S.bokunReports, S.bokunWaivers],
    exportStep: 'In Bókun, export your customer list from Customers, then Actions. Export the sales feed to a spreadsheet for your bookings; the download link expires after about a week. Bókun has no contract, so you can cancel anytime.',
    quoteId: 'tst-1',
    faqs: [
      { q: 'Is Bókun cheaper than EZRA Pro?', a: `Above about ${BOKUN_BREAK_EVEN} a month online, yes. Below that, EZRA Pro costs less.`, source: S.bokunPricing },
      { q: 'How much does Bókun cost?', a: 'A free plan for one user, or START at $49 a month plus 1.5%, PLUS at $149 plus 1.25%, and PREMIUM at $499 plus 1%.', source: S.bokunPricing },
      { q: 'Does Bókun charge on Viator bookings?', a: 'No, according to its pricing page.', source: S.bokunPricing },
      { q: 'Can I cancel Bókun anytime?', a: 'Yes. Bókun says there’s no 6- or 12-month contract.', source: S.bokunPricing },
      { q: 'Does Bókun have digital waivers?', a: 'Not built in. Waivers come from apps in its app store, such as Adventure Waivers. EZRA Pro has waivers built in.', source: S.bokunWaivers },
      { q: 'Who owns Bókun?', a: 'Tripadvisor, since 2018. Bókun says it runs independently.', source: S.bokunAbout },
      { q: 'Does Bókun connect to Expedia?', a: 'Yes. Bókun connects to more than 70 marketplaces, including Expedia.', source: S.bokunExpedia },
    ],
  },

  checkfront: {
    slug: 'checkfront',
    vendor: 'checkfront',
    title: `EZRA Pro vs Checkfront: Pricing & Features (${Y})`,
    description: `Checkfront is $99 a month plus 3% on online bookings. EZRA Pro is ${P} per booking with no monthly bill. See which costs less for you.`,
    h1: 'EZRA Pro vs Checkfront',
    subhead: 'Checkfront charges $99 every month. EZRA Pro charges only when you get booked.',
    fairNote: `To be fair: above about ${CHECKFRONT_BREAK_EVEN} a month online, Checkfront costs less than EZRA Pro.`,
    shortAnswer: [
      `Checkfront has one plan: $99 a month plus 3% on online bookings, with no fee on bookings you take by phone, through marketplaces or by API. EZRA Pro is ${P} per booking and $0 a month. Below about ${CHECKFRONT_BREAK_EVEN} a month online, EZRA Pro costs less; above it, Checkfront does.`,
      'Both publish their prices, both let you choose who pays the fee, and both include waivers and gift cards. Checkfront is strong on rentals and rooms. EZRA Pro adds rides with a driver, restaurant tables, next-business-day payouts and support seven days a week.',
    ],
    about: [
      "Checkfront is a booking system from Victoria, Canada, launched in 2010. In 2023 it merged with Rezdy, and Regiondo joined the same group later that year.",
      "It’s used by tour operators and by rental businesses for equipment, vehicles and rooms. It has one published plan, with waivers and gift certificates included.",
    ],
    verdict: {
      them: [`You sell over ${CHECKFRONT_BREAK_EVEN} a month online`, 'Many bookings come by phone', 'You rent rooms by the night'],
      us: ['You want no monthly bill', 'Your season has quiet months', 'You want next-day payouts'],
    },
    costText: [
      'Checkfront charges its 3% on online bookings only, so bookings by phone, from marketplaces or through its API carry just the $99 a month. If a lot of your sales come that way, Checkfront’s real cost is lower than the figures below.',
    ],
    costValue: 5_000,
    switchIntro: 'These are the reasons operators give most often in public reviews. They’re what reviewers said, not our own tests.',
    switchReasons: [
      { title: 'Price rises', body: 'One 2025 review reports a 20% rise in the yearly subscription, after 25% the year before.' },
      { title: 'Bugs that stop bookings', body: 'Reviewers mention bugs that interrupt booking, slow fixes and integrations that sometimes fail.' },
      { title: 'Hard to set up', body: 'Some find new items and complex booking flows hard to set up, and support hours don’t suit every time zone.' },
    ],
    switchSources: [S.capterraNzCf, S.capterraCf],
    topics: [
      { title: 'Payments and payouts', them: 'Checkfront Payments, or any of more than 30 other processors. Checkfront Payments pays out on a rolling 2–7 days.', us: US.payments },
      { title: 'Viator, GetYourGuide and Expedia', them: 'Checkfront connects to Viator, GetYourGuide, Expedia and more, with no Checkfront fee on those bookings.', us: US.otas },
      { title: 'Guest records and marketing', them: 'Customer accounts and automated emails.', us: US.crm },
      { title: 'Reports', them: 'Customizable sales reports.', us: US.reports },
      { title: 'Support', them: 'Phone, chat and tickets, 24 hours a day on weekdays.', us: US.support },
      { title: 'What you can sell', them: 'Tours, activities and rentals of equipment, vehicles and rooms, with waivers and gift certificates included.', us: US.sell },
    ],
    topicSources: [S.cfPayments, S.cfTours, S.cfContact, S.cfRentals],
    exportStep: 'In Checkfront, export your Customer Directory, and export your bookings from the Booking Daily List. When you’re done, close the account from Billing in your profile.',
    quoteId: 'tst-6',
    faqs: [
      { q: 'How much does Checkfront cost?', a: 'One plan: $99 a month plus 3% on online bookings. No setup fee, and no fee on phone, marketplace or API bookings.', source: S.cfPricing },
      { q: 'Who pays Checkfront’s 3% fee?', a: 'You choose: absorb it or pass it on to your guests. EZRA Pro works the same way with its 4%.', source: S.cfPricing },
      { q: 'Is Checkfront cheaper than EZRA Pro?', a: `Above about ${CHECKFRONT_BREAK_EVEN} a month in online bookings, yes. Below that, EZRA Pro costs less.` },
      { q: 'Does Checkfront charge for waivers or marketplace bookings?', a: 'No. Waivers are built in, and Checkfront adds no fee on marketplace bookings. The marketplace’s own commission still applies.', source: S.cfPricing },
      { q: 'How fast does Checkfront pay out?', a: 'Checkfront Payments pays out on a rolling schedule of 2–7 days. EZRA Pro pays out the next business day.', source: S.cfPayments },
      { q: 'Who owns Checkfront?', a: 'Checkfront merged with Rezdy in 2023, and Regiondo joined the same group that year.', source: S.cfMerger },
      { q: 'Where is Checkfront based?', a: 'Victoria, British Columbia, in Canada. It launched in 2010.', source: S.cfPress },
    ],
  },

  xola: {
    slug: 'xola',
    vendor: 'xola',
    title: `EZRA Pro vs Xola: Pricing & Features (${Y})`,
    description: `Xola charges 3% or 6% a booking plus card fees, with no subscription. EZRA Pro is ${P} per booking, $0 a month, and you choose who pays.`,
    h1: 'EZRA Pro vs Xola',
    subhead: 'No subscription on either. The difference is the fee, and what it covers.',
    fairNote: 'To be fair: if your account qualifies for Xola’s 3% Flex Level plan, Xola’s fee is lower than EZRA Pro’s. Card fees come on top at Xola.',
    shortAnswer: [
      `Neither Xola nor EZRA Pro charges a subscription. Xola charges a service fee of 6% on its Flex Standard plans, or 3% on Flex Level plans if your account meets its requirements, and Stripe card fees of 2.39% + 30¢ come on top in the US. EZRA Pro is ${P} per booking.`,
      'Both connect to Viator, GetYourGuide and Expedia, and both include waivers and gift certificates. Xola has 24/7 support. EZRA Pro adds rentals with stock per item, rides with a driver, restaurants and small hotels, plus email and text marketing built in.',
    ],
    about: [
      "Xola is a booking system for tours and attractions such as boat tours, ziplines, fishing charters and escape rooms. Scott Zimmerman and Anush Ramani founded it in 2011.",
      "Xola has no subscription. It earns a service fee on each booking, and which plan you get depends on requirements in your Xola account.",
    ],
    verdict: {
      them: ['You qualify for its 3% plan', 'You want support at 3am', 'You only run tours and attractions'],
      us: ['You want one rate for everyone', 'You rent gear or run rides', 'You want marketing built in'],
    },
    costText: [
      'The check below compares the fee you’d pay as the business on Xola’s two Company Pays plans. Xola’s card processing, 2.39% + 30¢ per payment in the US, is extra and isn’t in these figures.',
    ],
    costValue: 10_000,
    switchIntro: 'These are the reasons operators give most often in public reviews. They’re what reviewers said, not our own tests.',
    switchReasons: [
      { title: 'Fees on top of fees', body: 'Reviewers call the service fee high once card processing is added on top.' },
      { title: 'Glitches and slow fixes', body: 'Some mention glitches, rigid rescheduling after cancellations and clumsy moving between locations.' },
      { title: 'No real rentals', body: 'Reviewers miss a rentals module and stock for add-ons, and find editing trips and fees hard.' },
    ],
    switchSources: [S.capterraXola],
    topics: [
      { title: 'Payments and payouts', them: 'Payments run through Stripe inside Xola, with payouts daily, weekly or monthly. Card fees are shown apart from Xola’s fee.', us: US.payments },
      { title: 'Viator, GetYourGuide and Expedia', them: 'Xola connects to Expedia, Viator, Tripadvisor, GetYourGuide and Google Things To Do, and says it adds no fee on those bookings.', us: US.otas },
      { title: 'Guest records and marketing', them: 'A contacts list you can export to Mailchimp.', us: US.crm },
      { title: 'Reports', them: 'Custom reports that can be emailed on a schedule.', us: US.reports },
      { title: 'Support', them: 'Phone, in-app chat and email, 24 hours a day, every day.', us: US.support },
      { title: 'What you can sell', them: 'Tours and attractions, with equipment assigned to trips, waivers and gift certificates.', us: US.sell },
    ],
    topicSources: [S.xolaPayouts, S.xolaOtas, S.xolaContacts, S.xolaReports, S.xolaSupport, S.xolaEquipment],
    exportStep: 'In Xola, export your customers from Contacts, and your bookings from Custom Reports as Excel or CSV.',
    quoteId: 'tst-1',
    faqs: [
      { q: 'How much does Xola cost?', a: 'There’s no subscription. Xola charges a 3% or 6% service fee depending on the plan, plus card processing of 2.39% + 30¢ in the US.', source: S.xolaStdGuest },
      { q: 'Who pays Xola’s service fee?', a: 'It depends on the plan. On Guest Pays plans the guest pays at checkout; on Company Pays plans it comes out of your payout.', source: S.xolaStdCompany },
      { q: 'Is Xola cheaper than EZRA Pro?', a: `On the 6% plans, no. On the 3% Flex Level plans, Xola’s fee is lower, but card processing comes on top. EZRA Pro is ${P} per booking.` },
      { q: 'Does Xola have 24/7 support?', a: 'Yes. Xola says it answers by phone, in-app chat and email every hour of every day.', source: S.xolaSupport },
      { q: 'Does Xola connect to Viator and Expedia?', a: 'Yes. Xola connects to Expedia, Viator, Tripadvisor, GetYourGuide and Google Things To Do.', source: S.xolaOtas },
      { q: 'Which payment processor does Xola use?', a: 'Stripe. Xola’s payouts report shows the Stripe fee apart from Xola’s own fee.', source: S.xolaPayouts },
      { q: 'Who founded Xola?', a: 'Scott Zimmerman and Anush Ramani, in 2011.', source: S.xolaAbout },
    ],
  },

  bookeo: {
    slug: 'bookeo',
    vendor: 'bookeo',
    title: `EZRA Pro vs Bookeo: Pricing & Features (${Y})`,
    description: `Bookeo is a flat $14.95–$119.95 a month with no booking fees. EZRA Pro is ${P} per booking with no monthly bill. Which fits your business?`,
    h1: 'EZRA Pro vs Bookeo',
    subhead: 'Bookeo is a flat monthly fee. EZRA Pro is a small share of what you sell.',
    fairNote: `To be fair: above about ${BOOKEO_BREAK_EVEN} a month in bookings, Bookeo’s flat fee costs less than EZRA Pro. Card processing and waivers are extra at Bookeo.`,
    shortAnswer: [
      `Bookeo charges a flat monthly fee, from $14.95 to $119.95 depending on how many bookings and staff you have, and no fee per booking. EZRA Pro is ${P} per booking and $0 a month. For most businesses past their first few bookings, Bookeo’s platform fee is lower.`,
      'What you get for the fee is different. Bookeo is a lean booking tool: you bring your own payment processor, waivers are a paid add-on, and support is by email. EZRA Pro includes payments, waivers, marketing, rentals and rides, and people to talk to seven days a week.',
    ],
    about: [
      "Bookeo is a booking system from Australia, launched in 2010, with customers in more than 120 countries. Its tours and activities edition suits tours, escape rooms and classes.",
      "It charges a flat monthly fee by plan size and no booking fee. You connect your own payment provider, and you can freeze your account in the off-season for 30% of the fee.",
    ],
    verdict: {
      them: ['You want the lowest fixed price', 'You run simple tours or escape rooms', 'You’re happy with email support'],
      us: ['You want waivers at no extra cost', 'You rent gear or run rides', 'You want help seven days a week'],
    },
    costText: [
      'Bookeo’s plans are priced by the number of bookings, guides and staff logins, not by what you sell, so the check below uses the plan that costs least. Add card processing from your own payment provider, and waivers from $9 a month if you need them.',
    ],
    costValue: 3_000,
    switchIntro: 'These are the reasons operators give most often in public reviews. They’re what reviewers said, not our own tests.',
    switchReasons: [
      { title: 'Support on Australian hours', body: 'Reviewers outside Australia say help is slow to arrive, with emails unanswered and no phone line.' },
      { title: 'Missing features', body: 'Some miss memberships, better text reminders and deeper email automation.' },
      { title: 'No app for staff', body: 'Reviewers would like a mobile app for running the day.' },
    ],
    switchSources: [S.capterraBookeo, S.trustradiusBookeo],
    topics: [
      { title: 'Payments and payouts', them: 'You connect a payment provider such as Square or PayPal, and that provider sets its own fees and payout timing.', us: US.payments },
      { title: 'Viator, GetYourGuide and Expedia', them: 'Bookeo connects to Tripadvisor, Viator, GetYourGuide, Expedia and others, at no extra charge from Bookeo.', us: US.otas },
      { title: 'Guest records and marketing', them: 'A customer database that connects to Mailchimp.', us: US.crm },
      { title: 'Reports', them: 'Reports and statistics on your bookings.', us: US.reports },
      { title: 'Support', them: 'Email and a support portal.', us: US.support },
      { title: 'What you can sell', them: 'Tours, activities, escape rooms and classes, with gift vouchers. Waivers cost $9 to $249 a month extra.', us: US.sell },
    ],
    topicSources: [S.bookeoIntegrations, S.bookeoChannels, S.bookeoCustomers, S.bookeoContact],
    exportStep: 'We couldn’t find a CSV export guide on Bookeo’s pages. Ask Bookeo support for your customer list and upcoming bookings, or pull them through its API. Billing is month to month, so you can cancel from your account.',
    quoteId: 'tst-6',
    faqs: [
      { q: 'How much does Bookeo cost?', a: 'Bookeo for tours and activities runs $14.95 to $119.95 a month. Standard is $39.95 for up to 1,000 bookings a month. Waivers cost extra.', source: S.bookeoPricing },
      { q: 'Does Bookeo charge a booking fee?', a: 'No. Bookeo charges only its monthly fee. Your payment provider charges its own card fees.', source: S.bookeoPricing },
      { q: 'Is Bookeo free?', a: 'No. There’s a 30-day free trial with no card needed, then a monthly plan.', source: S.bookeoPricing },
      { q: 'Is Bookeo cheaper than EZRA Pro?', a: `On platform fees, yes, once you sell more than about ${BOOKEO_BREAK_EVEN} a month. EZRA Pro includes payments, waivers and marketing that cost extra or come from elsewhere with Bookeo.` },
      { q: 'Can I pause Bookeo in the off-season?', a: 'Yes. You can freeze the account for 30% of the monthly fee, but it can’t take bookings while frozen.', source: S.bookeoPricing },
      { q: 'Does Bookeo connect to Viator and GetYourGuide?', a: 'Yes, along with Tripadvisor and Expedia, at no extra charge from Bookeo.', source: S.bookeoTours },
      { q: 'Where is Bookeo based?', a: 'Macquarie Park, New South Wales, in Australia. It launched in 2010.', source: S.bookeoContact },
    ],
  },

  roller: {
    slug: 'roller',
    vendor: 'roller',
    title: `EZRA Pro vs ROLLER: Pricing & Features (${Y})`,
    description: `ROLLER is venue software priced by quote, on a fixed-term contract. EZRA Pro is ${P} per booking, $0 a month, with no contract. Compare them.`,
    h1: 'EZRA Pro vs ROLLER',
    subhead: 'ROLLER is built for venues with tills and wristbands. EZRA Pro is built for bookings.',
    shortAnswer: [
      `ROLLER is software for walk-in venues like trampoline parks, bowling alleys, play centres and water parks: tickets, tills, kiosks, memberships and wristbands. It prices by quote, on a fixed-term contract. EZRA Pro is ${P} per booking and $0 a month, with no contract.`,
      'If you run a venue with tills and walk-in crowds, ROLLER is made for that. If you run tours, trips, rentals or rides that guests book ahead, EZRA Pro fits better and costs nothing in a month with no bookings.',
    ],
    about: [
      "ROLLER is venue management software from Melbourne, Australia, founded by brothers Luke and Mark Finn. It has more than 3,000 customers in over 30 countries.",
      "It’s built for walk-in venues: ticketing, tills, kiosks, memberships, wristbands and food ordering in one system. Plans are quoted per venue, on a fixed-term contract.",
    ],
    verdict: {
      them: ['You run a walk-in venue', 'You need tills, kiosks and wristbands', 'You want support around the clock'],
      us: ['You sell tours, trips or rentals', 'You want no contract', 'You want a price on the page'],
    },
    costText: [
      'ROLLER doesn’t publish prices, so there’s nothing honest to put in a calculator. Its four plans, Lite, Pro, Premium and Enterprise, are quoted per venue, and usage fees are billed monthly on top. A third-party listing puts the plans at $300 to $800 a month billed yearly, but that may be out of date.',
      `EZRA Pro is ${P} of each booking and nothing else: $120 on $3,000 of bookings, $400 on $10,000.`,
    ],
    costValue: 10_000,
    switchIntro: 'These are the reasons operators give most often in public reviews. They’re what reviewers said, not our own tests.',
    switchReasons: [
      { title: 'Rising prices', body: 'Reviewers say prices have gone up over the years, especially on the Pro plan.' },
      { title: 'Locked into a contract', body: 'One reviewer says ROLLER wouldn’t release them from their contract for the rest of the year.' },
      { title: 'Slow to add features', body: 'Some mention basic features still missing and limits on payment methods.' },
    ],
    switchSources: [S.capterraRoller],
    topics: [
      { title: 'Payments and payouts', them: 'ROLLER Payments, its own processing, pays out daily, with money arriving in 0–2 business days.', us: US.payments },
      { title: 'Viator, GetYourGuide and Expedia', them: 'Viator, GetYourGuide, Klook and others through its Advanced Channel Management add-on.', us: US.otas },
      { title: 'Guest records and marketing', them: 'A guest CRM with loyalty and segments.', us: US.crm },
      { title: 'Reports', them: 'Reports and analytics, with CSV export.', us: US.reports },
      { title: 'Support', them: 'Live chat and phone, 24/7, for every customer.', us: US.support },
      { title: 'What you can sell', them: 'Venue tickets, memberships, food and drink ordering, gift cards and waivers.', us: US.sell },
    ],
    topicSources: [S.rollerPayouts, S.rollerChannels, S.rollerHome, S.rollerReports, S.rollerSupport],
    exportStep: 'In ROLLER, export your guest records to CSV and download your booking reports. Check your contract first: ROLLER asks for 90 days’ written notice before your term ends, and you pay until the term finishes.',
    quoteId: 'tst-1',
    faqs: [
      { q: 'How much does ROLLER cost?', a: 'ROLLER doesn’t publish prices. Its four plans are quoted per venue, and there’s a 14-day free trial.', source: S.rollerPricing },
      { q: 'Can I cancel ROLLER anytime?', a: 'No. ROLLER asks for 90 days’ written notice before your contract term ends, and you keep paying until the term finishes.', source: S.rollerCancel },
      { q: 'Who is ROLLER for?', a: 'Leisure venues: trampoline parks, bowling, play centres, roller rinks, climbing gyms, zoos, aquariums, water and theme parks, and museums.', source: S.rollerHome },
      { q: 'Does ROLLER connect to Viator and GetYourGuide?', a: 'Yes, through its Advanced Channel Management add-on. EZRA Pro includes Viator, GetYourGuide and Expedia.', source: S.rollerChannels },
      { q: 'Does ROLLER have 24/7 support?', a: 'Yes. Live chat and phone support run 24/7 for all customers.', source: S.rollerSupport },
      { q: 'How fast does ROLLER pay out?', a: 'ROLLER Payments starts payouts daily, and money arrives within 0–2 business days. EZRA Pro pays out the next business day.', source: S.rollerPayouts },
      { q: 'Who owns ROLLER?', a: 'ROLLER is privately held. It was founded by brothers Luke and Mark Finn, and Insight Partners has led its recent funding rounds.', source: S.rollerPress },
      { q: 'Is EZRA Pro a ROLLER alternative for tours?', a: `Yes. EZRA Pro is built for bookings made ahead, like tours, trips, rentals and rides, at ${P} per booking with no contract.` },
    ],
  },
}

/* ==========================================================================
   The hub
   ========================================================================== */

export const HUB = {
  title: `EZRA Pro vs FareHarbor, Peek Pro, Bókun & More (${Y})`,
  description: `EZRA Pro compared with FareHarbor, Peek Pro, Bókun, Checkfront, Xola, Bookeo and ROLLER on price, fees and features. Checked ${MONTH}.`,
  h1: 'How EZRA Pro compares',
  subhead: 'Seven booking systems, one table. Real prices, with sources.',
  fairNote: `To be fair: Bookeo’s flat fee costs less above about ${BOOKEO_BREAK_EVEN} a month, Bókun’s paid plans above about ${BOKUN_BREAK_EVEN}, and Checkfront above about ${CHECKFRONT_BREAK_EVEN}.`,
  estimatesNote: 'FareHarbor and Peek Pro don’t publish their fees, so those figures are third-party estimates. ROLLER prices by quote.',
  keys: ['monthly', 'fee', 'whoPays', 'otas', 'waivers', 'rentals'] as RowKey[],
  howToChoose: [
    'Start with how you’re charged. Some systems take a share of each booking and nothing else (EZRA Pro, FareHarbor, Xola). Some charge a monthly fee and a smaller share (Bókun, Checkfront). Bookeo charges only a monthly fee, and Peek Pro and ROLLER quote each business.',
    `A share of each booking costs nothing in a quiet month, which suits seasonal businesses. A monthly fee costs less once you sell a lot online. EZRA Pro’s ${P} is the same for everyone, it’s on our pricing page, and you choose whether you pay it or your guests do.`,
    'Then look at what you sell. If you rent gear, run rides with a driver or also run a restaurant or small hotel, check the bottom rows of each comparison: not every system covers those.',
  ],
  faqs: [
    { q: 'Which booking systems publish their prices?', a: 'EZRA Pro, Bókun, Checkfront and Bookeo publish their prices. FareHarbor doesn’t publish its fee, Peek Pro and ROLLER price by quote, and Xola lists its fees in its help pages.' },
    { q: 'Which have no monthly fee?', a: 'EZRA Pro, FareHarbor and Xola charge no subscription. Bókun has a free plan for one user.' },
    { q: 'Which let me choose who pays the booking fee?', a: 'EZRA Pro, Bókun and Checkfront let you choose. Xola sets it by plan, and FareHarbor’s guests pay by default.' },
    { q: 'Do they all connect to Viator and GetYourGuide?', a: 'All eight connect to Viator and GetYourGuide. ROLLER does it through an add-on.' },
    { q: 'Is EZRA Pro the cheapest?', a: `Not always. Bookeo, Bókun and Checkfront cost less once you sell enough online each month. EZRA Pro costs less in quiet months and against systems that charge 6%.` },
    { q: 'Can I move without losing bookings?', a: 'Yes. Send us an export and we rebuild your activities, guests and future bookings for free. Most operators move over a weekend.' },
  ] as Faq[],
}
