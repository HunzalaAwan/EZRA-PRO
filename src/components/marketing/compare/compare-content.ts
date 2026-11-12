/**
 * Copy for the /compare and /alternatives pages.
 *
 * Short on purpose: one idea per section, plain sentences, a few bullets.
 * Each page argues its own case (no name-swapped templates). Facts about
 * other vendors come from `@/lib/data/competitors` with their sources; a
 * bullet that rests on a vendor's page carries that source, and the page
 * turns it into a numbered footnote.
 *
 * Every cost figure is worked out from the plan rates, so the copy cannot
 * drift from the numbers.
 */

import type { PHOTOS } from '@/components/marketing/story/photos'
import {
  CHECKED_YEAR,
  EZRA_PLAN,
  SOURCES as S,
  breakEven,
  formatCheckedMonth,
  money,
  platformCost,
  rateById,
  type AlternativesSlug,
  type Source,
  type VendorId,
  type VsSlug,
} from '@/lib/data/competitors'

/* ==========================================================================
   SHARED NUMBERS
   ========================================================================== */

const MONTH = formatCheckedMonth()
const Y = CHECKED_YEAR
const P = `${EZRA_PLAN.percent}%`

/** Monthly platform cost of a plan at a monthly online value, as money. */
const at = (id: string, value: number) => money(platformCost(rateById(id), value) ?? 0)
/** Where two plans cost the same, rounded to $100. */
const be = (a: string, b: string) => {
  const v = breakEven(a, b)
  return v === null ? '' : money(Math.round(v / 100) * 100)
}

/* ==========================================================================
   TYPES
   ========================================================================== */

export type PhotoKey = keyof typeof PHOTOS

/** A sentence or bullet, optionally resting on a source (rendered as a footnote). */
export interface Line {
  text: string
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
  photo: PhotoKey
  verdict: { them: string[]; us: string[] }
  cost: { value: number; summary: string }
  strengths: Line[]
  differences: { title: string; body: string }[]
  switching: string[]
  faqs: Faq[]
  alternatives?: AlternativesSlug
  related: VsSlug[]
}

/* ==========================================================================
   VS PAGES
   ========================================================================== */

export const VS_CONTENT: Record<VsSlug, VsContent> = {
  fareharbor: {
    slug: 'fareharbor',
    vendor: 'fareharbor',
    title: `EZRA Pro vs FareHarbor: Fees and Fit (${Y})`,
    description: `FareHarbor doesn’t publish its guest fee; reports put it near 6%. EZRA Pro is ${P} per booking, $0 a month, and you choose who pays. Checked ${MONTH}.`,
    h1: 'EZRA Pro vs FareHarbor',
    lede: `FareHarbor costs nothing a month and adds a booking fee at checkout, but it doesn’t publish the rate. EZRA Pro has one published price: ${P} per booking, and you decide who pays it.`,
    photo: 'kayakCliffs',
    verdict: {
      them: [
        'You want the most widely used system in the category.',
        'You rely on its large network of distribution partners.',
        'You want its website builder, POS and staff app from one supplier.',
      ],
      us: [
        `You want the rate in writing: ${P}, $0 a month.`,
        'You want to choose who pays the fee: you or the guest.',
        'You sell rentals, pickups or rides, not only tours.',
      ],
    },
    cost: {
      value: 10_000,
      summary: `FareHarbor’s fee is reported at about 6%, usually paid by guests: around ${at('fareharbor', 10_000)} on $10,000 of bookings. EZRA Pro’s ${P} is ${at('ezra', 10_000)}, paid by you or passed to guests.`,
    },
    strengths: [
      { text: 'Proven at scale: more than 23,000 clients, by its own count.', source: S.fhWhatIs },
      { text: 'More than 120 support agents across Denver, Amsterdam and Sydney.', source: S.fhWhatIs },
      { text: 'No monthly bill, which suits a seasonal business.', source: S.fhBlogFees },
    ],
    differences: [
      { title: 'One published price', body: `${P} per booking, $0 a month. No sales call to find out the rate.` },
      { title: 'Rentals and rides', body: 'Rental items keep their own stock. Vehicles with a driver sell by trip, hour or shared seat.' },
      { title: 'Pickups on any activity', body: 'Add pickup zones, free or priced, and plan each day’s runs on one board.' },
    ],
    switching: [
      'Ask FareHarbor for an export of your bookings and customers.',
      'If your site runs on FareHarbor Sites, move the website first.',
      'List the resellers on its network and reconnect each one.',
    ],
    faqs: [
      { q: 'Is FareHarbor free?', a: 'For you, there’s no monthly fee. Guests usually pay a booking fee at checkout.', source: S.fhBlogFees },
      { q: 'How much is FareHarbor’s booking fee?', a: 'It isn’t published. Third parties report about 6%, some say 6–8%. Ask FareHarbor for your rate in writing.', source: S.captainbookFh, reported: true },
      { q: 'Who owns FareHarbor?', a: 'Booking Holdings, the parent of Booking.com, since 2018.', source: S.fhSec },
    ],
    alternatives: 'fareharbor',
    related: ['peek-pro', 'xola', 'bokun'],
  },

  'peek-pro': {
    slug: 'peek-pro',
    vendor: 'peek-pro',
    title: `EZRA Pro vs Peek Pro: Pricing and Rentals (${Y})`,
    description: `Peek Pro prices by quote. EZRA Pro publishes one price: ${P} per booking, $0 a month. Compare rentals, fees and fit. Checked ${MONTH}.`,
    h1: 'EZRA Pro vs Peek Pro',
    lede: 'Peek Pro quotes each business, and its rental tools are strong. EZRA Pro publishes one price and counts rental stock item by item.',
    photo: 'solQuadRider',
    verdict: {
      them: [
        'You rent boats or ATVs and want card holds and photo records at handover.',
        'You want AI tools built into the product.',
        'You’d rather negotiate a quote than read a price list.',
      ],
      us: [
        `You want a price you can read today: ${P}, $0 a month.`,
        'Your rentals need stock per item and checks on overlapping hires.',
        'You also rent vehicles with a driver.',
      ],
    },
    cost: {
      value: 10_000,
      summary: `Peek doesn’t publish its rate. A competitor reports up to 6–8%; at 6%, $10,000 of bookings costs about ${at('peek-pro', 10_000)}. EZRA Pro costs ${at('ezra', 10_000)}.`,
    },
    strengths: [
      { text: 'Rental handover: deposits, card holds and photo records.', source: S.peek },
      { text: 'Guests can reschedule themselves, and there are waitlists.', source: S.peek },
      { text: 'AI help inside the product with Peek Pro 9.', source: S.peek },
    ],
    differences: [
      { title: 'A price list, not a quote', body: `${P} per booking and nothing a month. Work out a season’s cost before you talk to anyone.` },
      { title: 'Rentals counted by item', body: 'Kayaks, boards and lockers each keep their own stock under one link, with a deposit per item.' },
      { title: 'Rides with a driver', body: 'Sell transfers by trip, hour or shared seat. Peek’s pages didn’t show this when we checked.' },
    ],
    switching: [
      'Read your Peek agreement for notice terms.',
      'List each rental item with its stock, rates and deposit.',
      'Take a test booking with a deposit before you swap links.',
    ],
    faqs: [
      { q: 'How much does Peek Pro cost?', a: 'Peek prices by quote. A competitor reports no subscription and up to 6–8% on online bookings.', source: S.bokunOnPeek, reported: true },
      { q: 'Who pays Peek’s booking fee?', a: 'Reports conflict. One discussion says it can be paid by you or passed to guests.', source: S.g2Peek, reported: true },
      { q: 'Does EZRA Pro do card holds?', a: 'No. It sets a refundable deposit per rental item. Peek lists card holds and photo records.' },
    ],
    alternatives: 'peek-pro',
    related: ['fareharbor', 'checkfront', 'xola'],
  },

  bokun: {
    slug: 'bokun',
    vendor: 'bokun',
    title: `EZRA Pro vs Bókun: Fees, Viator and Fit (${Y})`,
    description: `Bókun charges a plan fee plus 1–1.5%, and above about ${be('ezra', 'bokun-start')} a month it costs less than EZRA Pro’s ${P}. Here’s when each fits. Checked ${MONTH}.`,
    h1: 'EZRA Pro vs Bókun',
    lede: `Bókun has the lowest published fees we found. Above about ${be('ezra', 'bokun-start')} a month online, it costs less than EZRA Pro. The case for EZRA Pro is no monthly bill and more you can sell.`,
    photo: 'guideBook',
    verdict: {
      them: [
        'Viator is a big share of your sales: paid plans charge 0% on those bookings.',
        `You sell more than about ${be('ezra', 'bokun-start')} a month online and low fees come first.`,
        'You want its large OTA and reseller marketplace.',
      ],
      us: [
        'You want no monthly bill, only a fee when you sell.',
        'Your sales are small or seasonal.',
        'You want waivers built in and rides sold as their own products.',
      ],
    },
    cost: {
      value: 10_000,
      summary: `At $10,000 a month, Bókun START is ${at('bokun-start', 10_000)} and EZRA Pro is ${at('ezra', 10_000)}. Bókun is cheaper here. In a month under about ${be('ezra', 'bokun-start')}, EZRA Pro costs less.`,
    },
    strengths: [
      { text: 'The lowest published fees: 1.5% on START, down to 1% on PREMIUM.', source: S.bokunPricing },
      { text: '0% on Viator and offline bookings on paid plans.', source: S.bokunPricing },
      { text: 'Pick-up points, rentals and a POS.', source: S.bokunFeatures },
    ],
    differences: [
      { title: 'Nothing to pay in a quiet month', body: `No plan fee. You pay ${P} only on bookings you take.` },
      { title: 'Waivers built in', body: 'Set per activity, signed by the booker or each guest. Bókun lists waivers as an add-on.' },
      { title: 'Food and rooms too', body: 'Restaurant ordering and a small-hotel storefront run on the same platform.' },
    ],
    switching: [
      'Connect Viator in EZRA Pro before you turn Bókun’s link off.',
      'Turn Bókun pick-up points into pickup zones.',
      'Cancel after your last overlapping booking.',
    ],
    faqs: [
      { q: 'Is Bókun cheaper than EZRA Pro?', a: `Usually, yes. Above about ${be('ezra', 'bokun-start')} a month online, START ($49 + 1.5%) costs less than ${P}.`, source: S.bokunPricing },
      { q: 'Does Bókun charge on Viator bookings?', a: 'Not on paid plans, per its pricing page. Confirm which applies to you.', source: S.bokunPricing },
      { q: 'Who owns Bókun?', a: 'Tripadvisor, since 2018. Bókun says it runs independently.', source: S.bokunAbout },
    ],
    related: ['rezdy', 'checkfront', 'fareharbor'],
  },

  rezdy: {
    slug: 'rezdy',
    vendor: 'rezdy',
    title: `EZRA Pro vs Rezdy: Fees, Agents and Fit (${Y})`,
    description: `Rezdy is $49–$249 a month plus 3% online. EZRA Pro is $0 a month plus ${P}. See which costs less at your volume. Checked ${MONTH}.`,
    h1: 'EZRA Pro vs Rezdy',
    lede: `Rezdy is built for selling through agents, with 3% on online bookings on every plan. EZRA Pro has no monthly fee, so it costs less up to about ${be('ezra', 'rezdy-foundation')} a month online.`,
    photo: 'solTouristsMap',
    verdict: {
      them: [
        'Agents and resellers sell most of your seats.',
        `You sell more than about ${be('ezra', 'rezdy-foundation')} a month online.`,
        'You want unlimited users and agents.',
      ],
      us: [
        'You want no monthly fee while you grow.',
        'You want pickups, waivers and walk-in sales in one place.',
        'You’d rather start today than book a demo.',
      ],
    },
    cost: {
      value: 10_000,
      summary: `At $3,000 a month online, Rezdy Foundation is ${at('rezdy-foundation', 3_000)} and EZRA Pro is ${at('ezra', 3_000)}. At $10,000, Rezdy is ${at('rezdy-foundation', 10_000)} and EZRA Pro is ${at('ezra', 10_000)}.`,
    },
    strengths: [
      { text: 'A big agent network: more than 12,000 agents, it says.', source: S.rezdyFeatures },
      { text: 'No contract lock-in, and unlimited users and agents.', source: S.rezdyPricing },
      { text: 'You choose who pays its 3%.', source: S.rezdyPricing },
    ],
    differences: [
      { title: 'No monthly fee', body: `${P} per booking and $0 a month, so a slow month costs little.` },
      { title: 'Pickups and waivers built in', body: 'Rezdy’s features page didn’t show pickups or native waivers when we checked.' },
      { title: 'A walk-in desk', body: 'Sell at the counter and see walk-in revenue apart from online sales.' },
    ],
    switching: [
      'List the agents who sell you and how they’ll book.',
      'Time the switch to your Rezdy billing date.',
      'List any gift card balances you need to honour.',
    ],
    faqs: [
      { q: 'How much does Rezdy cost?', a: '$49, $99 or $249 a month, plus 3% online and up to $1 per offline booking.', source: S.rezdyPricing },
      { q: 'Does Rezdy’s 3% fall on higher plans?', a: 'No. It’s 3% on every plan.', source: S.rezdyPricing },
      { q: 'Is Rezdy the same company as Checkfront?', a: 'They’ve shared a group since 2023, with Regiondo. The products run separately.', source: S.merger },
    ],
    alternatives: 'rezdy',
    related: ['checkfront', 'bokun', 'fareharbor'],
  },

  checkfront: {
    slug: 'checkfront',
    vendor: 'checkfront',
    title: `EZRA Pro vs Checkfront: Fees, Rentals and Walk-ins (${Y})`,
    description: `Checkfront is $99 a month plus 3% online. EZRA Pro is $0 a month plus ${P}. Compare cost, rentals and counter sales. Checked ${MONTH}.`,
    h1: 'EZRA Pro vs Checkfront',
    lede: `Checkfront has one published plan for tours, rentals and stays. EZRA Pro has one too, with no monthly fee. They cost about the same at ${be('ezra', 'checkfront')} a month online.`,
    photo: 'solSailingBay',
    verdict: {
      them: [
        `You sell more than about ${be('ezra', 'checkfront')} a month online.`,
        'Many bookings come by phone or OTA, which carry no Checkfront fee.',
        'You book items nightly or with flexible times.',
      ],
      us: [
        `You sell less than about ${be('ezra', 'checkfront')} a month, or have quiet seasons.`,
        'You sell at a counter or a dock.',
        'You run pickups or serve food.',
      ],
    },
    cost: {
      value: 10_000,
      summary: `At $5,000 a month online, Checkfront is ${at('checkfront', 5_000)} and EZRA Pro is ${at('ezra', 5_000)}. At $20,000, Checkfront is ${at('checkfront', 20_000)} and EZRA Pro is ${at('ezra', 20_000)}.`,
    },
    strengths: [
      { text: 'One simple plan, published, with no setup fee.', source: S.checkfrontPricing },
      { text: 'No fee on offline, OTA or API bookings.', source: S.checkfrontPricing },
      { text: 'Items book all day, nightly, by time slot or flexibly.', source: S.checkfrontFeatures },
    ],
    differences: [
      { title: 'A walk-in desk', body: 'Ring up counter sales. Checkfront’s features page didn’t show a POS when we checked.' },
      { title: 'Pickups and rides', body: 'Pickup zones on any activity, and vehicles with a driver by trip, hour or seat.' },
      { title: 'Restaurant orders', body: 'Take food orders on the same platform as your bookings.' },
    ],
    switching: [
      'Map item types: time slots to activities, all-day items to rentals.',
      'Count your offline bookings before you compare cost.',
      'Reconnect your OTAs before you turn Checkfront off.',
    ],
    faqs: [
      { q: 'How much does Checkfront cost?', a: '$99 a month plus 3% online. No fee on offline, OTA or API bookings.', source: S.checkfrontPricing },
      { q: 'Does Checkfront have a POS?', a: 'Its features page didn’t show one when we checked. Ask Checkfront directly.', source: S.checkfrontFeatures },
      { q: 'Who owns Checkfront?', a: 'It merged with Rezdy in 2023, and Regiondo joined. The brands run separately.', source: S.merger },
    ],
    related: ['rezdy', 'peek-pro', 'bokun'],
  },

  xola: {
    slug: 'xola',
    vendor: 'xola',
    title: `EZRA Pro vs Xola: Guest Fees and Pricing (${Y})`,
    description: `Xola charges guests 6% or you 3%. EZRA Pro is ${P} and you choose who pays. Compare checkout cost, features and fit. Checked ${MONTH}.`,
    h1: 'EZRA Pro vs Xola',
    lede: `Xola publishes two fees: 6% if guests pay, 3% if you do. EZRA Pro has one rate, ${P}, whoever pays it.`,
    photo: 'fairSwing',
    verdict: {
      them: [
        `You’ll pay the fee yourself: 3% is less than our ${P}.`,
        'You want support around the clock.',
        'You run an attraction with kiosks and gated entry.',
      ],
      us: [
        `You pass the fee to guests: ${P} instead of 6%.`,
        'You rent equipment by the item or sell rides.',
        'You want prices that follow demand.',
      ],
    },
    cost: {
      value: 10_000,
      summary: `On $10,000 a month, Xola Guest Pays adds ${at('xola-guest', 10_000)} to guests’ checkouts; EZRA Pro passed on adds ${at('ezra', 10_000)}. If you pay it yourself, Xola (${at('xola-company', 10_000)}) costs less than EZRA Pro.`,
    },
    strengths: [
      { text: 'Both fees published, and its US card rate too.', source: S.xolaPricing },
      { text: '24/7 support and SOC 2 Type II.', source: S.xolaHome },
      { text: 'Attraction tools: gated entry, a kiosk and a POS.', source: S.xolaHome },
    ],
    differences: [
      { title: 'A lower guest fee', body: `Passed on, our ${P} is less than Xola’s 6% Guest Pays fee.` },
      { title: 'Rentals and rides', body: 'Rental items with their own stock, and pickups or rides with a driver. Xola’s pages didn’t show these.' },
      { title: 'Prices that follow demand', body: 'Rules for seasons, last minute, filling up and quiet times.' },
    ],
    switching: [
      'Put a sample booking through both checkouts.',
      'If you use Xola kiosks, plan your counter setup.',
      'Export any gift card balances to honour.',
    ],
    faqs: [
      { q: 'Is Xola free?', a: 'There’s no subscription. Guests pay 6%, or you pay 3% from your payouts.', source: S.xolaPricing },
      { q: 'How does Xola’s 6% work with deposits?', a: 'It’s charged on the full total and isn’t refunded on partial refunds.', source: S.xolaGuest },
      { q: 'Does Xola have dynamic pricing?', a: 'Its pages didn’t document it when we checked. Ask Xola directly.', source: S.xolaHome },
    ],
    related: ['fareharbor', 'peek-pro', 'checkfront'],
  },
}

/* ==========================================================================
   ALTERNATIVES PAGES
   ========================================================================== */

export interface AltEntry {
  vendor: VendorId | 'ezra'
  /** Two short sentences, written for this page. */
  about: string
  features: string[]
  /** One honest drawback. */
  watch: string
  /** Optional override for the vendor's "best for". */
  bestFor?: string
}

export interface AltContent {
  slug: AlternativesSlug
  vendor: VendorId
  title: string
  description: string
  h1: string
  lede: string
  photo: PhotoKey
  entries: AltEntry[]
  howToChoose: string[]
  faqs: Faq[]
}

const FH_ENTRIES: AltEntry[] = [
  {
    vendor: 'ezra',
    about: `One published price: ${P} per booking and nothing a month. Unlike FareHarbor, you choose whether you or the guest pays it.`,
    features: ['Rentals with stock per item', 'Pickups on any activity, and rides with a driver', 'Walk-in desk and waivers built in'],
    watch: 'We make it. And there’s no reseller network the size of FareHarbor’s.',
  },
  {
    vendor: 'xola',
    about: 'The same no-subscription model as FareHarbor, with the fee in writing. You pick a guest-paid or an operator-paid plan.',
    features: ['6% guest-paid or 3% operator-paid', 'Published US card rate', 'Kiosk and gated entry'],
    watch: 'No dynamic pricing documented on its pages.',
  },
  {
    vendor: 'peek-pro',
    about: 'Strongest on rentals. Like FareHarbor, it doesn’t publish its rate: it quotes each business.',
    features: ['Card holds and photo records at handover', 'POS with tipping', 'AI tools in Peek Pro 9'],
    watch: 'Fee figures come from competitors, not from Peek.',
  },
  {
    vendor: 'bokun',
    about: 'A monthly plan, but the lowest percentage we found. Paid plans take 0% on Viator bookings.',
    features: ['1–1.5% per booking', 'Pick-up and drop-off points', 'Free plan and a 14-day trial'],
    watch: 'Owned by Tripadvisor; waivers are an add-on.',
  },
  {
    vendor: 'checkfront',
    about: 'One plan at $99 a month plus 3%. Phone, walk-in and OTA bookings carry no fee.',
    features: ['Tours, rentals and stays together', 'Waivers included', 'No setup fee'],
    watch: 'No POS on its features page when we checked.',
  },
  {
    vendor: 'rezdy',
    about: 'Built for agents and resellers, closest to FareHarbor on distribution. A monthly plan plus 3% online.',
    features: ['12,000+ agents, it says', 'You choose who pays the 3%', 'No contract lock-in'],
    watch: 'The 3% stays the same on every plan.',
  },
  {
    vendor: 'zaui',
    about: 'A free plan at 6% online, built around shuttles and transfers rather than day tours.',
    features: ['Routes, fleets and seat manifests', 'Booking desk for walk-ins', 'Card fees passed through at cost'],
    watch: 'Zaui says it isn’t the best fit for simple day tours.',
  },
]

const PEEK_ENTRIES: AltEntry[] = [
  {
    vendor: 'ezra',
    about: `A published price instead of a quote: ${P} per booking, $0 a month. Rentals are counted item by item.`,
    features: ['Stock per item, with overlap checks', 'A refundable deposit per item', 'Rides with a driver by trip, hour or seat'],
    watch: 'We make it. No card holds or photo records at handover.',
    bestFor: 'Rentals by the item, plus tours and rides',
  },
  {
    vendor: 'checkfront',
    about: 'A rental-first system with one published plan. Items book all day, nightly or by time slot.',
    features: ['$99 a month + 3% online', 'Flexible item timing', 'Waivers included'],
    watch: 'Gift certificates are an add-on.',
  },
  {
    vendor: 'bokun',
    about: 'Rentals and tours together at the lowest published fees. A free plan to start.',
    features: ['Rentals and resources', 'Pick-up and drop-off points', 'POS for walk-ups'],
    watch: 'Waivers are an add-on.',
  },
  {
    vendor: 'xola',
    about: 'Close to Peek’s no-subscription model, but the fee is published. Strong on attraction tools.',
    features: ['6% or 3%, in writing', 'Equipment management', 'Kiosk and POS'],
    watch: 'Rentals aren’t confirmed on its pages.',
  },
  {
    vendor: 'zaui',
    about: 'For operators who rent and run transport. A free plan, with a fee per online booking.',
    features: ['Rentals named', 'Shuttles and fleets', 'Dynamic pricing'],
    watch: 'Waivers come through a partner, Smartwaiver.',
  },
  {
    vendor: 'trekksoft',
    about: 'Published tiers for European operators. Rental items and a mobile POS.',
    features: ['€49–€249 a month', 'Published card fees', 'Free website builder'],
    watch: 'Billed yearly; deposits start on the €149 plan.',
  },
  {
    vendor: 'rezdy',
    about: 'Rentals plus a big agent network. A monthly plan and 3% online.',
    features: ['Rentals', 'Agent network', 'You choose who pays'],
    watch: 'Gift cards start on the $99 plan.',
  },
]

const REZDY_ENTRIES: AltEntry[] = [
  {
    vendor: 'ezra',
    about: `No monthly fee, just ${P} per booking. It costs less than Rezdy Foundation up to about ${be('ezra', 'rezdy-foundation')} a month online.`,
    features: ['Pickups and waivers built in', 'Walk-in desk', 'Start today, no demo needed'],
    watch: 'We make it. Above that volume, Rezdy costs less, and we have no agent network.',
    bestFor: 'Direct sellers who want no monthly fee',
  },
  {
    vendor: 'bokun',
    about: 'The way to keep distribution and pay a lower rate. Its marketplace lists thousands of OTAs and resellers.',
    features: ['1–1.5% instead of 3%', '0% on Viator on paid plans', 'Pick-up points and POS'],
    watch: 'Owned by Tripadvisor since 2018.',
  },
  {
    vendor: 'checkfront',
    about: 'One $99 plan with no fee on offline or OTA bookings. Note: it shares Rezdy’s owner.',
    features: ['One simple plan', 'Waivers included', 'Tours, rentals and stays'],
    watch: 'Same group as Rezdy since 2023.',
  },
  {
    vendor: 'trekksoft',
    about: 'A rate that falls as you grow, from 3% to 2%. Includes an agent network.',
    features: ['Published tiers', 'Agent network', 'Published card fees'],
    watch: 'Billed yearly, in euros.',
  },
  {
    vendor: 'bookingkit',
    about: 'Reseller tools for European attractions, with a 2% fee on Businesskit.',
    features: ['B2B reseller tool', '50+ channel networks', 'Turnstile partners'],
    watch: 'Fees stack: booking, per-ticket and payment fees.',
  },
  {
    vendor: 'fareharbor',
    about: 'No monthly bill, and a large partner network. Guests usually pay the fee.',
    features: ['23,000+ clients, it says', 'POS, websites and an app', 'Big distribution network'],
    watch: 'The fee rate isn’t published.',
  },
  {
    vendor: 'xola',
    about: 'No subscription and the fee in writing: 6% guest-paid or 3% operator-paid.',
    features: ['Published fees', '24/7 support', 'Kiosk and gated entry'],
    watch: 'No agent network shown on its pages when we checked.',
  },
]

export const ALT_CONTENT: Record<AlternativesSlug, AltContent> = {
  fareharbor: {
    slug: 'fareharbor',
    vendor: 'fareharbor',
    title: `${FH_ENTRIES.length} FareHarbor Alternatives for Tour Operators (${Y})`,
    description: `${FH_ENTRIES.length} FareHarbor alternatives compared on price, who pays the fee and who each one suits. Sources checked ${MONTH}.`,
    h1: `${FH_ENTRIES.length} FareHarbor alternatives, and who each one suits`,
    lede: 'Most people look past FareHarbor to see the fee before they sign, to choose who pays it, or to sell rentals and pickups. Here are the options, in plain terms.',
    photo: 'heroKayakGuide',
    entries: FH_ENTRIES,
    howToChoose: [
      'Get your FareHarbor rate in writing first. You can’t compare without it.',
      'Decide who should pay the fee: you, or your guests.',
      'List your resellers and your website. They take longest to move.',
    ],
    faqs: [
      { q: 'What’s the cheapest FareHarbor alternative?', a: `At most volumes, Bókun: $49 a month plus 1.5% on START. Under about ${be('ezra', 'bokun-start')} a month, EZRA Pro’s ${P} costs less.`, source: S.bokunPricing },
      { q: 'Which alternatives have no monthly fee?', a: `EZRA Pro (${P} per booking), Xola and Zaui’s free plan.` },
      { q: 'Which ones do pickups?', a: 'Bókun lists pick-up points, Zaui is built for transfers, and EZRA Pro adds pickups to any activity.' },
    ],
  },
  'peek-pro': {
    slug: 'peek-pro',
    vendor: 'peek-pro',
    title: `${PEEK_ENTRIES.length} Peek Pro Alternatives With Published Prices (${Y})`,
    description: `${PEEK_ENTRIES.length} Peek Pro alternatives that publish their fees, compared on rentals, price and who pays. Checked ${MONTH}.`,
    h1: `${PEEK_ENTRIES.length} Peek Pro alternatives that publish their prices`,
    lede: 'Peek Pro quotes each business, so the first question is what you’d pay elsewhere. Every option here shows its price. Because Peek is strong on rentals, we say how each handles them.',
    photo: 'solAtv',
    entries: PEEK_ENTRIES,
    howToChoose: [
      'Get your Peek quote in writing, card fees included.',
      'If card holds save you money on damage, check the alternative has them.',
      'Read your notice terms before you pick a date.',
    ],
    faqs: [
      { q: 'Why doesn’t Peek Pro publish prices?', a: 'It offers custom, quote-based pricing. Figures online come from third parties.', source: S.peek },
      { q: 'Which alternative is best for rentals?', a: 'Checkfront for flexible timing, Bókun for rentals with tours, EZRA Pro for stock per item and rides.' },
      { q: 'Which let you pay the fee yourself?', a: 'EZRA Pro, Bókun, Checkfront, Rezdy and Zaui let you choose. Xola has an operator-paid plan.' },
    ],
  },
  rezdy: {
    slug: 'rezdy',
    vendor: 'rezdy',
    title: `${REZDY_ENTRIES.length} Rezdy Alternatives for Tour Operators (${Y})`,
    description: `${REZDY_ENTRIES.length} Rezdy alternatives compared on fees, distribution and who each suits, including which share Rezdy’s owner. Checked ${MONTH}.`,
    h1: `${REZDY_ENTRIES.length} Rezdy alternatives for tour and activity operators`,
    lede: 'Rezdy takes 3% online on every plan, and shares an owner with Checkfront and Regiondo. So the questions are simple: do you want a lower rate, no monthly fee, or a different company?',
    photo: 'groupPond',
    entries: REZDY_ENTRIES,
    howToChoose: [
      'Work out how much of your trade is online. Rezdy’s 3% only applies there.',
      'List the agents who sell you, and check each alternative can reach them.',
      'Check the currency on your Rezdy invoice before you compare.',
    ],
    faqs: [
      { q: 'Which alternatives charge less than 3%?', a: 'Bókun (1–1.5%), TrekkSoft (2–2.5% on higher plans) and bookingkit Businesskit (2%, plus other fees).' },
      { q: 'Is EZRA Pro cheaper than Rezdy?', a: `Up to about ${be('ezra', 'rezdy-foundation')} a month online, yes. Above that, Rezdy Foundation costs less.` },
      { q: 'Is Checkfront a real alternative?', a: 'It’s a different product, but the same group as Rezdy since 2023.', source: S.merger },
    ],
  },
}

/* ==========================================================================
   HUB
   ========================================================================== */

export const HUB = {
  title: `Compare Tour Booking Software: Pricing and Fit (${Y})`,
  description: `FareHarbor, Peek Pro, Bókun, Rezdy, Checkfront, Xola and more: what each charges, who pays and who it suits. Sources checked ${MONTH}.`,
  h1: 'Compare tour booking software',
  lede: 'What each system charges, who pays, and who it suits. Every figure has a source and a date.',
  photo: 'guideGroup' as PhotoKey,
  models: [
    {
      title: 'No monthly fee',
      body: 'A fee on each booking, often around 6% and often paid by guests.',
      who: 'FareHarbor, Xola, Zaui, and EZRA Pro at 4%',
    },
    {
      title: 'Monthly plan + fee',
      body: 'A subscription plus 1–3%. Cheaper at high volume, a fixed cost in quiet months.',
      who: 'Bókun, Rezdy, Checkfront, TrekkSoft, bookingkit, Regiondo',
    },
    {
      title: 'By quote or large venue',
      body: 'Priced per business, or built for big attractions at hundreds a month.',
      who: 'Peek Pro, Ventrata',
    },
  ],
  method: [
    'We read each vendor’s own pricing and features pages on the date shown.',
    '“Reported” means a third party’s figure, because the vendor doesn’t publish it.',
    '“Not shown” means not on the vendor’s pages, not that it’s missing.',
    'List prices before tax, in the vendor’s currency. No review ratings.',
  ],
}
