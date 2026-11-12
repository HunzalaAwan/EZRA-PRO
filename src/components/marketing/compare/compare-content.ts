/**
 * Copy for the /compare pages. Kept short on purpose: a headline, one line
 * under it, three bullets a side, three questions. Facts about other vendors
 * come from `@/lib/data/competitors` with their sources; a line that rests
 * on a vendor's page carries that source, and the page turns it into a
 * numbered footnote.
 *
 * Cost figures are worked out from the plan rates, so the copy cannot drift
 * from the numbers.
 */

import {
  CHECKED_YEAR,
  EZRA_PLAN,
  SOURCES as S,
  breakEven,
  formatCheckedMonth,
  money,
  type Source,
  type VendorId,
  type VsSlug,
} from '@/lib/data/competitors'

const MONTH = formatCheckedMonth()
const Y = CHECKED_YEAR
const P = `${EZRA_PLAN.percent}%`

/** Where EZRA Pro and Bókun START cost the same, rounded to $100. */
const BOKUN_BREAK_EVEN = money(Math.round((breakEven('ezra', 'bokun-start') ?? 0) / 100) * 100)

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
  verdict: { them: string[]; us: string[] }
  /** Starting value for the cost check. */
  costValue: number
  faqs: Faq[]
}

export const VS_CONTENT: Record<VsSlug, VsContent> = {
  fareharbor: {
    slug: 'fareharbor',
    vendor: 'fareharbor',
    title: `EZRA Pro vs FareHarbor: Pricing & Features (${Y})`,
    description: `FareHarbor doesn’t publish its booking fee; reports put it near 6%. EZRA Pro is ${P} per booking, $0 a month, and you choose who pays.`,
    h1: 'EZRA Pro vs FareHarbor',
    subhead: `FareHarbor keeps its fee unpublished. Ours is ${P}, and you choose who pays it.`,
    verdict: {
      them: ['You lean on its partner network', 'You want the best-known name', 'Guests paying the fee suits you'],
      us: ['You want the rate in writing', 'You choose who pays the fee', 'You sell rentals or rides too'],
    },
    costValue: 10_000,
    faqs: [
      { q: 'Is FareHarbor free?', a: 'There’s no monthly fee. Guests usually pay a booking fee at checkout.', source: S.fhBlogFees },
      { q: 'How much is FareHarbor’s booking fee?', a: 'It isn’t published. Third parties put it near 6%.', source: S.captainbookFh, reported: true },
      { q: 'Who owns FareHarbor?', a: 'Booking Holdings, the parent of Booking.com, since 2018.', source: S.fhSec },
    ],
  },

  'peek-pro': {
    slug: 'peek-pro',
    vendor: 'peek-pro',
    title: `EZRA Pro vs Peek Pro: Pricing & Features (${Y})`,
    description: `Peek Pro prices by quote; reports say up to 6–8% a booking. EZRA Pro publishes one price: ${P} per booking, $0 a month. Checked ${MONTH}.`,
    h1: 'EZRA Pro vs Peek Pro',
    subhead: `Peek Pro prices by quote. EZRA Pro is ${P} per booking, right on the page.`,
    verdict: {
      them: ['You need card holds on rentals', 'You want AI tools built in', 'You’d rather negotiate a quote'],
      us: ['You want a price you can read today', 'You count rental stock per item', 'You also run rides with a driver'],
    },
    costValue: 10_000,
    faqs: [
      { q: 'How much does Peek Pro cost?', a: 'Peek prices by quote. One report puts it at up to 6–8% of each online booking.', source: S.bokunOnPeek, reported: true },
      { q: 'Who pays Peek’s booking fee?', a: 'It varies. Ask Peek for your terms in writing.', source: S.g2Peek, reported: true },
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
    verdict: {
      them: ['Viator is a big share of sales', `You sell over ${BOKUN_BREAK_EVEN} a month online`, 'You want its OTA marketplace'],
      us: ['You want no monthly bill', 'Your season has quiet months', 'You want waivers built in'],
    },
    costValue: 3_000,
    faqs: [
      { q: 'Is Bókun cheaper than EZRA Pro?', a: `Above about ${BOKUN_BREAK_EVEN} a month online, yes. Below that, EZRA Pro costs less.`, source: S.bokunPricing },
      { q: 'Does Bókun charge on Viator bookings?', a: 'Not on paid plans, according to its pricing page.', source: S.bokunPricing },
      { q: 'Who owns Bókun?', a: 'Tripadvisor, since 2018. Bókun says it runs independently.', source: S.bokunAbout },
    ],
  },
}

export const HUB = {
  title: `EZRA Pro vs FareHarbor, Peek Pro & Bókun (${Y})`,
  description: `EZRA Pro vs FareHarbor, Peek Pro and Bókun on monthly price, booking fees, who pays and rentals. One ${P} plan, $0 a month. Checked ${MONTH}.`,
  h1: 'EZRA Pro vs FareHarbor, Peek Pro and Bókun',
  subhead: 'One price. Every tool. You choose who pays.',
  fairNote: `To be fair: above about ${BOKUN_BREAK_EVEN} a month online, Bókun’s paid plans cost less than EZRA Pro.`,
}
