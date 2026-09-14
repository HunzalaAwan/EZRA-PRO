/**
 * Static marketing content for the public site.
 *
 * Lives outside `src/lib/data/` deliberately: none of this depends on the seeded
 * operational data, so it must not be coupled to that generation chain.
 */

import type {
  FaqItem,
  FeatureBlock,
  Integration,
  PricingPlan,
  Testimonial,
  VerticalKey,
} from '@/types'

/* ==========================================================================
   HERO / PROOF
   ========================================================================== */

export const HERO = {
  eyebrow: 'Built for tour & activity operators',
  headlineLead: 'Booking & experience software for',
  headlineRotators: ['guided tours.', 'outdoor adventures.', 'dining & hospitality.', 'attractions & wellness.', 'watersports & charters.'],
  subhead:
    'EZRA Pro runs availability, checkout, rosters, manifests and next-day payouts for experience operators worldwide — from city sightseeing and mountain ziplines to dive charters and sunset dining.',
  primaryCta: { label: 'Start free — no card', href: '/signup' },
  secondaryCta: { label: 'See a live demo', href: '/dashboard' },
  microProof: '4% flat booking fee · Free migration from FareHarbor or Peek Pro · Live in a weekend',
} as const

export const STATS: { value: string; label: string; hint?: string }[] = [
  { value: '$2.4B+', label: 'Processed for operators', hint: 'Gross booking value across the platform in the last 12 months' },
  { value: '11,800+', label: 'Experiences live', hint: 'Tours & activities actively selling on EZRA Pro today' },
  { value: '+31%', label: 'Average lift in direct bookings', hint: 'Median across operators in their first 6 months' },
  { value: '99.98%', label: 'Checkout uptime', hint: 'Rolling 90-day availability of the booking path' },
]

export const LOGO_MARKS: { name: string; mark: string }[] = [
  { name: 'Ridgeline Adventure Co.', mark: 'RIDGELINE' },
  { name: 'Blue Horizon Watersports', mark: 'BLUE HORIZON' },
  { name: 'Saltline Kitchen & Terrace', mark: 'SALTLINE' },
  { name: 'Summit Heli Tours', mark: 'SUMMIT HELI' },
  { name: 'Coral Cay Expeditions', mark: 'CORAL CAY' },
  { name: 'Cabo Azul Excursions', mark: 'CABO AZUL' },
  { name: 'Tidewater Sailing', mark: 'TIDEWATER' },
  { name: 'Northshore Surf School', mark: 'NORTHSHORE' },
  { name: 'Kona Deep Charters', mark: 'KONA DEEP' },
  { name: 'Lagoon Paddle Club', mark: 'LAGOON PADDLE' },
]

/* ==========================================================================
   PRODUCT PILLARS
   ========================================================================== */

export const FEATURE_BLOCKS: FeatureBlock[] = [
  {
    id: 'feat-checkout',
    eyebrow: 'Conversion',
    title: 'A checkout guests actually finish',
    description:
      'Most booking flows lose a third of guests between "check availability" and "pay". Ours is three taps on a phone with Apple Pay and Google Pay on by default.',
    icon: 'ShoppingCart',
    bullets: [
      'Live availability — never oversell a tour again',
      'Apple Pay, Google Pay and card, no account required',
      'Abandoned-cart recovery that actually converts',
      'Works on mobile signal at any location',
    ],
    accent: 'lagoon',
  },
  {
    id: 'feat-calendar',
    eyebrow: 'Operations',
    title: 'Every departure, guide and resource on one timeline',
    description:
      'Drag a departure to move it. Assign a guide or a vehicle and watch double-bookings become impossible. See the whole week at a glance or drop into a daily manifest.',
    icon: 'CalendarDays',
    bullets: [
      'Month, week, day and agenda views',
      'Resource conflicts blocked before they happen',
      'Weather holds with one-tap guest notification',
      'Offline check-in that syncs when signal returns',
    ],
    accent: 'coral',
  },
  {
    id: 'feat-analytics',
    eyebrow: 'Revenue',
    title: 'Analytics that tell you what to do next',
    description:
      'Not another dashboard of numbers you already knew. EZRA Pro reads your occupancy by weekday and hour and names the specific slot to cut, add or reprice — with the dollar impact attached.',
    icon: 'ChartSpline',
    bullets: [
      'Occupancy heatmap by weekday and hour',
      'Channel mix with true net-of-commission margin',
      'Repeat-guest and cohort retention tracking',
      'Written insights, not just charts',
    ],
    accent: 'reef',
  },
  {
    id: 'feat-payments',
    eyebrow: 'Cash flow',
    title: 'Deposits today, payout tomorrow',
    description:
      'Take a deposit at booking and the balance on the day. Split tips to the guides automatically. Money lands next business day at a flat 4% rate instead of sitting in someone else&rsquo;s account for a week.',
    icon: 'CreditCard',
    bullets: [
      'Next-day payouts as standard',
      'Flat 4% booking rate',
      'Deposits, balances and partial refunds',
      'Automatic guide tip splitting',
    ],
    accent: 'sunset',
  },
  {
    id: 'feat-crm',
    eyebrow: 'Retention',
    title: 'Know your guests before they arrive',
    description:
      'Every guest carries their history: trips taken, dietary preferences, certifications, and special notes. Turn a first-timer into a family that comes back year after year.',
    icon: 'Users',
    bullets: [
      'Full guest profile with trip history',
      'Digital waivers signed before departure',
      'Automated review requests that lift ratings',
      'Segments for win-back and VIP campaigns',
    ],
    accent: 'lagoon',
  },
  {
    id: 'feat-channels',
    eyebrow: 'Distribution',
    title: 'OTAs that never oversell you',
    description:
      'Viator, GetYourGuide and Expedia read the same live availability as your own site. Sell the last seat anywhere and it disappears everywhere, in under a second.',
    icon: 'Share2',
    bullets: [
      'Two-way sync with major OTAs',
      'One inventory pool, zero manual reconciliation',
      'Per-channel margin reporting',
      'Google Things to do included free',
    ],
    accent: 'coral',
  },
  {
    id: 'feat-storefront',
    eyebrow: 'Brand',
    title: 'A storefront that looks like you',
    description:
      'Your colours, your photography, your domain. Embed the booking flow in the site you already have, or let EZRA Pro host the whole thing. Guests never see our logo unless you want them to.',
    icon: 'Store',
    bullets: [
      'Custom domain and full white-label',
      'Embeddable widget for any website',
      'SEO-ready pages that rank for your trips',
      'Gift cards and prepaid experiences',
    ],
    accent: 'reef',
  },
  {
    id: 'feat-team',
    eyebrow: 'Team',
    title: 'Roles that match how you actually work',
    description:
      'Your tour guide sees today&rsquo;s manifest. Your bookkeeper sees payouts. Your guide sees the roster on their phone and nothing else. Nobody sees the bank account who shouldn&rsquo;t.',
    icon: 'UserCog',
    bullets: [
      'Six role levels, permissions down to the field',
      'Mobile manifest and check-in for staff',
      'Full audit log of every change',
      'Multi-location and multi-brand support',
    ],
    accent: 'sunset',
  },
]

/* ==========================================================================
   VERTICAL POSITIONING (landing page switcher)
   ========================================================================== */

export const VERTICAL_PITCHES: Record<
  VerticalKey,
  { headline: string; body: string; proofStat: string; proofLabel: string; bullets: string[] }
> = {
  tours: {
    headline: 'Built for guided tours at scale',
    body: 'Multi-departure days, guide rostering, multi-language groups and private upgrades — with a manifest your guides can run from a phone.',
    proofStat: '−72%',
    proofLabel: 'time spent on daily scheduling',
    bullets: [
      'Unlimited daily departures per tour',
      'Guide rostering with conflict detection',
      'Private and group pricing side by side',
      'Pickup lists sorted by hotel and time',
    ],
  },
  adventure: {
    headline: 'Built for high-consequence experiences',
    body: 'Risk waivers, weight and age limits, equipment allocation and weather gating — enforced at checkout so an unqualified guest never reaches your trailhead.',
    proofStat: '100%',
    proofLabel: 'waiver completion before arrival',
    bullets: [
      'Digital waivers signed before departure',
      'Weight, age and fitness gating at booking',
      'Equipment sets allocated per participant',
      'Weather and avalanche condition holds',
    ],
  },
  restaurants: {
    headline: 'Built for seatings, not just tables',
    body: 'Tasting menus, chef&rsquo;s counters, terrace sunset slots and private events — with deposits that end no-shows and prepaid covers that guarantee the night.',
    proofStat: '−64%',
    proofLabel: 'no-show rate after deposits',
    bullets: [
      'Timed seatings with per-table capacity',
      'Deposits and prepaid tasting menus',
      'Allergy and dietary notes on the pass',
      'Private events and buyouts',
    ],
  },
  wellness: {
    headline: 'Built for classes, courses and retreats',
    body: 'Drop-ins, class packs, memberships and multi-day retreats with instalment plans — all on the same calendar, all in one guest profile.',
    proofStat: '+2.4x',
    proofLabel: 'lifetime value from memberships',
    bullets: [
      'Class packs, memberships and drop-ins',
      'Multi-day retreats with instalment billing',
      'Waitlists that auto-promote on cancellation',
      'Instructor scheduling and pay rates',
    ],
  },
  watersports: {
    headline: 'Built for boats, charters and dives',
    body: 'Capacity per vessel, certification checks at booking, weather holds that notify every guest at once, and a wet-hands check-in that works with no signal at the slip.',
    proofStat: '+38%',
    proofLabel: 'direct bookings, Blue Horizon',
    bullets: [
      'Per-vessel capacity and crew assignment',
      'Certification and waiver capture at checkout',
      'One-tap weather cancellation with auto-refunds',
      'Tide and swell context on every departure',
    ],
  },
  island: {
    headline: 'Built for resorts and excursion desks',
    body: 'One desk selling twenty operators&rsquo; trips, commission tracked per partner, and a concierge view that books a guest into anything in seconds.',
    proofStat: '3.1x',
    proofLabel: 'excursion attachment rate',
    bullets: [
      'Multi-operator reseller marketplace',
      'Per-partner commission and settlement',
      'Concierge quick-book with room charging',
      'Cruise-ship arrival demand forecasting',
    ],
  },
}

/* ==========================================================================
   PRICING
   ========================================================================== */

const FEATURE_MATRIX = [
  'Unlimited activities & departures',
  'Live availability & online checkout',
  'Calendar, manifest & mobile check-in',
  'Guest CRM & digital waivers',
  'Next-day payouts',
  'Email & SMS confirmations',
  'Custom-branded storefront',
  'Advanced analytics & insights',
  'OTA channel manager',
  'Resource & staff scheduling',
  'Dynamic pricing & promotions',
  'Gift cards & memberships',
  'Multi-location & multi-brand',
  'Open REST API & webhooks',
  'Priority support & SLA',
  'Dedicated success manager',
] as const

/** index at which each plan stops including features */
const PLAN_DEPTH: Record<PricingPlan['id'], number> = {
  starter: 6,
  growth: 10,
  scale: 14,
  enterprise: 16,
}

function buildFeatures(planId: PricingPlan['id']) {
  const depth = PLAN_DEPTH[planId]
  const hints: Record<string, string> = {
    'Next-day payouts': 'Funds settle the next business day, not weekly',
    'Advanced analytics & insights': 'Occupancy heatmap, cohorts and written recommendations',
    'OTA channel manager': 'Two-way sync with Viator, GetYourGuide and Expedia',
    'Dynamic pricing & promotions': 'Rules by season, lead time and remaining capacity',
    'Open REST API & webhooks': 'Build anything on top of your own data',
  }
  return FEATURE_MATRIX.map((label, i) => ({
    label,
    included: i < depth,
    hint: hints[label],
  }))
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    commissionPercent: 4,
    monthlyPrice: 0,
    annualPrice: 0,
    blurb: 'Flat 4% per booking. For new operators taking their first bookings online.',
    highlights: ['No monthly fee', 'Flat 4% rate', 'Unlimited activities', 'Next-day payouts'],
    features: buildFeatures('starter'),
    cta: 'Start free',
    popular: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    commissionPercent: 4,
    monthlyPrice: 4900,
    annualPrice: 49000,
    blurb: '4% flat rate with full channel manager and advanced analytics.',
    highlights: ['Flat 4% rate', 'Advanced analytics', 'OTA channel manager'],
    features: buildFeatures('growth'),
    cta: 'Start 14-day trial',
    popular: true,
    badge: 'Most popular',
  },
  {
    id: 'scale',
    name: 'Scale',
    commissionPercent: 2.5,
    monthlyPrice: 19900,
    annualPrice: 199000,
    blurb: 'Reduced 2.5% rate for high-volume operators and multi-location businesses.',
    highlights: ['2.5% volume rate', 'Dynamic pricing', 'Multi-location'],
    features: buildFeatures('scale'),
    cta: 'Start 14-day trial',
    popular: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    commissionPercent: 0,
    monthlyPrice: 0,
    annualPrice: 0,
    blurb: 'For large attractions, resort groups and marketplaces with custom volumes.',
    highlights: ['Custom rate', 'Dedicated CSM', '99.99% SLA'],
    features: buildFeatures('enterprise'),
    cta: 'Talk to sales',
    popular: false,
    badge: 'Custom',
  },
]

/* ==========================================================================
   SOCIAL PROOF
   ========================================================================== */

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 'tst-1',
    quote:
      'We came off FareHarbor mid-season, which everyone told us was insane. The migration took a weekend and we did not drop a single booking. Commission went from 6% to 4.5% — that is a crew member&rsquo;s salary back in our pocket.',
    author: 'Kaimana Reyes',
    role: 'Owner',
    company: 'Blue Horizon Watersports',
    avatarUrl: 'https://i.pravatar.cc/120?img=12',
    vertical: 'watersports',
    metric: { value: '+38%', label: 'direct bookings in 6 months' },
    rating: 5,
  },
  {
    id: 'tst-2',
    quote:
      'The occupancy heatmap paid for the whole platform in a fortnight. It showed our Tuesday 10am dive was running at 41% while Saturday was turning people away. We moved one boat. That was it.',
    author: 'Freya Lindqvist',
    role: 'Operations Director',
    company: 'Coral Cay Expeditions',
    avatarUrl: 'https://i.pravatar.cc/120?img=45',
    vertical: 'island',
    metric: { value: '$104k', label: 'added revenue, first season' },
    rating: 5,
  },
  {
    id: 'tst-3',
    quote:
      'Deposits ended our no-show problem overnight. We were losing four covers a night on the terrace. Now the seat is paid for before they walk up the hill.',
    author: 'Nikos Adamos',
    role: 'General Manager',
    company: 'Saltline Kitchen & Terrace',
    avatarUrl: 'https://i.pravatar.cc/120?img=33',
    vertical: 'restaurants',
    metric: { value: '−64%', label: 'no-show rate' },
    rating: 5,
  },
  {
    id: 'tst-4',
    quote:
      'Our guides run the whole day off their phones now. Manifest, check-in, waivers, emergency contacts. No more printed sheets blowing off the boat.',
    author: 'Tane Whitiora',
    role: 'Head Guide',
    company: 'Ridgeline Adventure Co.',
    avatarUrl: 'https://i.pravatar.cc/120?img=59',
    vertical: 'adventure',
    metric: { value: '−72%', label: 'time on daily admin' },
    rating: 5,
  },
  {
    id: 'tst-5',
    quote:
      'I have used three booking platforms in twelve years. This is the first one where support answers in minutes and actually knows what a tide table is.',
    author: 'Marisol Vega',
    role: 'Founder',
    company: 'Cabo Azul Excursions',
    avatarUrl: 'https://i.pravatar.cc/120?img=26',
    vertical: 'tours',
    metric: { value: '4 min', label: 'median support response' },
    rating: 5,
  },
  {
    id: 'tst-6',
    quote:
      'Switching cost us nothing and took a weekend. The part I did not expect was the checkout — our mobile conversion went up by a quarter without us changing a single photo.',
    author: 'Daniel Okafor',
    role: 'Managing Partner',
    company: 'Tidewater Sailing',
    avatarUrl: 'https://i.pravatar.cc/120?img=68',
    vertical: 'watersports',
    metric: { value: '+26%', label: 'mobile conversion' },
    rating: 5,
  },
  {
    id: 'tst-7',
    quote:
      'Running six locations used to mean six spreadsheets and a phone call every morning. Now it is one screen and I can see which site is soft by 9am.',
    author: 'Ana Beatriz Costa',
    role: 'COO',
    company: 'Northshore Surf School',
    avatarUrl: 'https://i.pravatar.cc/120?img=47',
    vertical: 'wellness',
    metric: { value: '6 sites', label: 'managed from one dashboard' },
    rating: 5,
  },
  {
    id: 'tst-8',
    quote:
      'The OTA sync is the quiet hero. We used to oversell a heli seat maybe twice a month and eat the cost. That has happened exactly zero times since we moved.',
    author: 'Rhys Calder',
    role: 'Director',
    company: 'Summit Heli Tours',
    avatarUrl: 'https://i.pravatar.cc/120?img=52',
    vertical: 'adventure',
    metric: { value: '0', label: 'oversells since launch' },
    rating: 5,
  },
]

/* ==========================================================================
   FAQ — written for an operator evaluating a switch
   ========================================================================== */

export const FAQS: FaqItem[] = [
  {
    id: 'faq-1',
    category: 'migration',
    question: 'How hard is it to move off FareHarbor or Peek Pro?',
    answer:
      'Easier than you are expecting. Send us an export and we rebuild your activities, pricing tiers, add-ons, guest records and every future booking inside EZRA Pro — then you flip the switch when you are ready. Most operators go live over a weekend, mid-season, without pausing sales. Migration is free on every plan, including Starter.',
  },
  {
    id: 'faq-2',
    category: 'migration',
    question: 'What happens to bookings already on the old system?',
    answer:
      'They come with you. Future departures, guest details, deposits paid and outstanding balances all land in EZRA Pro with the same confirmation references, so your guests never notice anything changed. We keep both systems readable during the cutover in case you want to compare.',
  },
  {
    id: 'faq-3',
    category: 'pricing',
    question: 'Is the commission really lower, or is there a catch?',
    answer:
      'Starter is 6% with no monthly fee — the same headline rate as FareHarbor and Peek, so you can move at zero risk. Growth drops it to 4.5% for $79/month and Scale to 3% for $249/month. If you take more than about $18k a month, Growth is already cheaper. We will do the arithmetic with your real numbers before you commit.',
  },
  {
    id: 'faq-4',
    category: 'pricing',
    question: 'Who pays the commission — me or the guest?',
    answer:
      'Your call, per activity. Absorb it into your price, or pass it on as a booking fee at checkout the way most operators do. EZRA Pro shows you the net-of-commission margin either way, per channel, so you always know what a booking is actually worth.',
  },
  {
    id: 'faq-5',
    category: 'payments',
    question: 'When do I actually get paid?',
    answer:
      'Next business day, as standard, on every plan. Not weekly, not on a rolling seven-day hold. You can also take a deposit at booking and the balance on the day of the trip, which is how most charter and multi-day operators run.',
  },
  {
    id: 'faq-6',
    category: 'payments',
    question: 'What about chargebacks and disputes?',
    answer:
      'We fight them for you. EZRA Pro automatically assembles the evidence package — waiver signature, check-in timestamp, communication history, cancellation policy shown at checkout — and submits it. Operators on EZRA Pro win roughly three quarters of disputes they contest.',
  },
  {
    id: 'faq-7',
    category: 'product',
    question: 'Does it work when there is no signal at the dock?',
    answer:
      'Yes. The crew app caches today&rsquo;s manifest on the device. You can check guests in, mark no-shows and capture signatures completely offline, and everything syncs the moment you get a bar of service. This is the single most requested feature from marine operators and it is on every plan.',
  },
  {
    id: 'faq-8',
    category: 'product',
    question: 'Can I stop the system overselling a boat?',
    answer:
      'That is the core of it. Capacity is held at the departure, and every channel — your site, the widget, the phone, Viator, GetYourGuide — draws from the same pool with a row lock at checkout. If you attach a vessel or a guide to a departure, EZRA Pro will also refuse to double-book that resource.',
  },
  {
    id: 'faq-9',
    category: 'product',
    question: 'How is your analytics different from the reports I already have?',
    answer:
      'Most booking platforms show you what happened. EZRA Pro tells you what to do. It reads occupancy by weekday and hour and writes plain-English recommendations with dollar figures attached — which slot to cut, which to duplicate, which activity has a cancellation rate that is quietly bleeding you. You can act on it in a five-minute Monday review.',
  },
  {
    id: 'faq-10',
    category: 'product',
    question: 'Will it match my brand, or will guests see your logo?',
    answer:
      'Your storefront runs on your own domain with your colours, typography and photography. EZRA Pro branding is off by default on Growth and above. You can embed just the booking widget into the website you already have, or let us host the whole storefront.',
  },
  {
    id: 'faq-11',
    category: 'product',
    question: 'Do the OTAs stay in sync automatically?',
    answer:
      'Two-way, in under a second. Viator, GetYourGuide, Expedia and Google Things to do read the same live availability as your own site. Sell the last seat anywhere and it disappears everywhere. Per-channel margin reporting shows you what each one is really contributing after commission.',
  },
  {
    id: 'faq-12',
    category: 'support',
    question: 'What does support actually look like in peak season?',
    answer:
      'Humans who understand the industry, seven days a week, with a median first response under five minutes during operating hours. Scale and Enterprise get a named success manager and a phone number that reaches a person. We staff up for your season, not ours.',
  },
  {
    id: 'faq-13',
    category: 'support',
    question: 'Am I locked into a contract?',
    answer:
      'No. Monthly plans are month to month and you can leave whenever you like. There is no termination fee and no notice period. We would rather earn the renewal than trap you into it.',
  },
  {
    id: 'faq-14',
    category: 'support',
    question: 'Can I get my data out if I leave?',
    answer:
      'Any time, in full, without asking. Guests, bookings, payments, reviews and activity configuration export to CSV or through the API on every plan including Starter. It is your business — holding your data hostage is not a retention strategy we are interested in.',
  },
  {
    id: 'faq-15',
    category: 'pricing',
    question: 'Is there really a free plan?',
    answer:
      'Starter has no monthly fee and no card required. You pay 6% only when you actually take a booking, so it costs nothing to run a season on it and decide later. Most operators move to Growth once the maths tips in their favour, and we will tell you when it does.',
  },
  {
    id: 'faq-16',
    category: 'migration',
    question: 'What if my activities are unusual?',
    answer:
      'Multi-day retreats with instalments, private charters priced per boat, tasting menus with timed seatings, class packs, gift cards, resort excursion desks reselling other operators — all of it is supported. If you have something genuinely strange, show us on the demo call and we will tell you honestly whether it fits.',
  },
]

/* ==========================================================================
   INTEGRATIONS
   ========================================================================== */

export const INTEGRATIONS: Integration[] = [
  { id: 'int-stripe', name: 'Stripe', category: 'payments', description: 'Card, wallet and bank payments with next-day payouts.', mark: 'stripe' },
  { id: 'int-square', name: 'Square', category: 'payments', description: 'In-person terminal payments for walk-ups.', mark: 'square' },
  { id: 'int-paypal', name: 'PayPal', category: 'payments', description: 'Offer PayPal and Pay Later at checkout.', mark: 'paypal' },
  { id: 'int-viator', name: 'Viator', category: 'ota', description: 'Two-way availability sync with Tripadvisor&rsquo;s marketplace.', mark: 'viator' },
  { id: 'int-gyg', name: 'GetYourGuide', category: 'ota', description: 'Live inventory sync and per-channel margin reporting.', mark: 'gyg' },
  { id: 'int-expedia', name: 'Expedia', category: 'ota', description: 'Reach Expedia&rsquo;s activities marketplace.', mark: 'expedia' },
  { id: 'int-google', name: 'Google Things to do', category: 'ota', description: 'Free booking links directly in Google Search and Maps.', mark: 'google' },
  { id: 'int-tripadvisor', name: 'Tripadvisor', category: 'ota', description: 'Sync reviews and availability with your listing.', mark: 'tripadvisor' },
  { id: 'int-klaviyo', name: 'Klaviyo', category: 'marketing', description: 'Segment guests and run win-back flows automatically.', mark: 'klaviyo' },
  { id: 'int-mailchimp', name: 'Mailchimp', category: 'marketing', description: 'Sync guest lists and post-trip campaigns.', mark: 'mailchimp' },
  { id: 'int-meta', name: 'Meta Pixel', category: 'marketing', description: 'Track booking conversions from Facebook and Instagram ads.', mark: 'meta' },
  { id: 'int-ga4', name: 'Google Analytics 4', category: 'marketing', description: 'Full-funnel ecommerce tracking out of the box.', mark: 'ga4' },
  { id: 'int-hubspot', name: 'HubSpot', category: 'marketing', description: 'Push corporate and group enquiries into your CRM.', mark: 'hubspot' },
  { id: 'int-quickbooks', name: 'QuickBooks', category: 'accounting', description: 'Nightly sync of sales, fees and payouts.', mark: 'quickbooks' },
  { id: 'int-xero', name: 'Xero', category: 'accounting', description: 'Reconcile payouts against invoices automatically.', mark: 'xero' },
  { id: 'int-twilio', name: 'Twilio', category: 'comms', description: 'SMS confirmations, reminders and weather alerts.', mark: 'twilio' },
  { id: 'int-slack', name: 'Slack', category: 'comms', description: 'New bookings and cancellations in your ops channel.', mark: 'slack' },
  { id: 'int-intercom', name: 'Intercom', category: 'comms', description: 'Live chat on your storefront with booking context.', mark: 'intercom' },
  { id: 'int-zapier', name: 'Zapier', category: 'ops', description: 'Connect EZRA Pro to 6,000+ other tools.', mark: 'zapier' },
  { id: 'int-docusign', name: 'DocuSign', category: 'ops', description: 'Countersigned waivers for high-consequence activities.', mark: 'docusign' },
]

/* ==========================================================================
   CTA
   ========================================================================== */

export const FINAL_CTA = {
  eyebrow: 'Switch in a weekend',
  headline: 'Your next season starts with better software',
  body: 'Free migration from FareHarbor or Peek Pro. No contract, no setup fee, no card to start. See your own numbers in EZRA Pro before you commit to anything.',
  primary: { label: 'Start free', href: '/signup' },
  secondary: { label: 'Book a 20-min demo', href: '/contact' },
  reassurance: ['Live in a weekend', 'Keep your bookings', 'Cancel any time'],
} as const
