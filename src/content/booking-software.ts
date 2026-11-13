import type { PhotoKey } from '@/components/marketing/story/photos'

/* ==========================================================================
   /booking-software — one page per kind of business (boat rental, bike
   rental, airport shuttle ...) plus a hub that lists them.

   Plain data, no JSX. Every feature named here is a real EZRA Pro feature
   under its product name (Items and prices, Stock and repairs, Walk-ins,
   Pickups, Check-in, Custom requests, Waivers, Locations). Money is in minor
   units and the 4% is always worked out with `ezraFee` from `@/lib/fees`,
   never typed in. Example prices are prices a business might set, and the
   page labels them as examples.

   No competitor names and no ratings on these pages: those stay on /compare.
   Titles go out with `title.absolute`, because the root layout's template
   would otherwise add " · EZRA Pro" a second time.
   ========================================================================== */

export const NICHE_SLUGS = [
  'boat-rental',
  'bike-rental',
  'airport-shuttle',
  'boat-charters',
  'kayak-rental',
  'ski-rental',
  'jet-ski-rental',
  'golf-cart-rental',
] as const

export type NicheSlug = (typeof NICHE_SLUGS)[number]

export type NicheGroup = 'rentals' | 'private' | 'rides'

/** One soft Calendly ground per page, so eight pages never look cloned. */
export type NicheTone = 'rain' | 'honeydew' | 'sunbeam' | 'seafoam' | 'lavender' | 'linen' | 'cloud'

/** Lucide icon names the template knows how to draw. */
export type NicheIcon =
  | 'Anchor'
  | 'Bike'
  | 'CalendarClock'
  | 'CarFront'
  | 'ClipboardCheck'
  | 'CloudRain'
  | 'Fuel'
  | 'Gift'
  | 'GraduationCap'
  | 'IdCard'
  | 'Layers'
  | 'LayoutList'
  | 'MapPin'
  | 'MessageSquareText'
  | 'PackagePlus'
  | 'Plane'
  | 'Route'
  | 'Ruler'
  | 'Sailboat'
  | 'ShieldCheck'
  | 'Ship'
  | 'Signature'
  | 'Snowflake'
  | 'Store'
  | 'Timer'
  | 'Users'
  | 'Wallet'
  | 'Wrench'

export type WizardStep = 'Basics' | 'Pricing' | 'Booking' | 'Guests' | 'Review'

export interface NicheChip {
  icon: NicheIcon
  title: string
  detail: string
}

export interface NicheProblem {
  icon: NicheIcon
  /** The day-to-day problem, 3-6 words. */
  problem: string
  /** How EZRA Pro handles it, one sentence. */
  fix: string
  /** The feature's name in the product. */
  feature: string
}

export type BoardTone = 'success' | 'warning' | 'info' | 'neutral' | 'danger'

export interface BoardRow {
  /** A time or a short code in the first column. */
  lead: string
  title: string
  detail: string
  status: string
  tone: BoardTone
  /** The one button on the row, when there is one. */
  action?: string
}

/** A small, honest picture of the screen the business works from. */
export interface NicheBoard {
  /** The dashboard screen it shows. */
  screen: 'Rentals' | 'Pickups' | 'Calendar' | 'Check-in' | 'Guest list'
  heading: string
  sub: string
  rows: BoardRow[]
  caption: string
}

export interface NicheMonth {
  label: string
  bookings: number
  /** Average booking, minor units. */
  avg: number
}

export interface NicheCost {
  /** "Half-day pontoon, 4 hours". */
  example: string
  /** Minor units. */
  price: number
  /** A second, smaller line: "A shared seat", "A week". */
  also?: { label: string; price: number }
  busy: NicheMonth
  quiet: NicheMonth
}

export interface NicheStep {
  wizard: WizardStep
  /** A second chip when a step covers two wizard steps: Guests → Review. */
  then?: WizardStep
  title: string
  text: string
}

export interface NicheFaq {
  q: string
  a: string
}

export interface Niche {
  slug: NicheSlug
  /** Short name: "Boat rental". Breadcrumbs, cards, the footer. */
  name: string
  /** What the page is, as a link: "Boat charter software". */
  software: string
  group: NicheGroup
  tone: NicheTone
  title: string
  meta: string
  h1: string
  subhead: string
  /** One line on the hub card. */
  card: string
  keywords: { primary: string; secondary: string[] }
  photo: PhotoKey
  /** How EZRA Pro is set up for it, as the wizard names it. */
  setupAs: string
  chips: [NicheChip, NicheChip]
  problems: NicheProblem[]
  board: NicheBoard
  cost: NicheCost
  steps: [NicheStep, NicheStep, NicheStep]
  faqs: NicheFaq[]
  related: [NicheSlug, NicheSlug, NicheSlug]
  product: { href: string; label: string }[]
}

/* ==========================================================================
   THE PAGES
   ========================================================================== */

export const NICHES: Record<NicheSlug, Niche> = {
  /* ---------------------------------------------------------- boat rental */
  'boat-rental': {
    slug: 'boat-rental',
    software: 'Boat rental software',
    name: 'Boat rental',
    group: 'rentals',
    tone: 'seafoam',
    title: 'Boat Rental Software for Online Bookings | EZRA Pro',
    meta: 'Rent out pontoons, boats and yachts online. Every boat counted, deposits held, licence and fuel rules at checkout. 4% per booking, $0 a month.',
    h1: 'Boat rental software that counts every boat',
    subhead: 'Sell by the hour, half day or full day. Every boat tracked, deposits held, no double bookings.',
    card: 'Pontoons, deck boats and yachts by the hour or day.',
    keywords: {
      primary: 'boat rental software',
      secondary: [
        'boat rental management software',
        'boat rental booking software',
        'boat rental reservation software',
        'boat rental scheduling software',
        'party boat rental booking software',
        'yacht rental software',
      ],
    },
    photo: 'pxMotorboatDock',
    setupAs: 'Rental · Self-drive or gear',
    chips: [
      { icon: 'Ship', title: 'Pontoon 2', detail: 'Out · back at 16:00' },
      { icon: 'Wallet', title: 'Deposit held', detail: '$250 · refundable' },
    ],
    problems: [
      {
        icon: 'Layers',
        problem: 'Two people book the same boat',
        fix: 'Each boat type has its own stock. Once one is out, nobody can book it for those hours.',
        feature: 'Items and prices',
      },
      {
        icon: 'Timer',
        problem: 'Boats coming back late',
        fix: 'Charge a late fee per hour, and keep buffer minutes between rentals for fuel and cleaning.',
        feature: 'Rental settings',
      },
      {
        icon: 'IdCard',
        problem: 'Damage, and who is driving',
        fix: 'Hold a refundable deposit per boat. Checkout asks for a boat licence or boater card, and the waiver is signed online.',
        feature: 'Waivers',
      },
      {
        icon: 'Wrench',
        problem: 'A boat in the shop',
        fix: 'Mark it out of service with a note. It stops showing as available straight away.',
        feature: 'Stock and repairs',
      },
    ],
    board: {
      screen: 'Rentals',
      heading: 'Rentals',
      sub: 'Today · 4 boats',
      rows: [
        { lead: '09:00', title: 'Pontoon 1', detail: 'Rivera · back at 13:00', status: 'Out', tone: 'info', action: 'Return' },
        { lead: '12:00', title: 'Pontoon 2', detail: 'Chen · back at 16:00', status: 'Out', tone: 'info', action: 'Return' },
        { lead: '14:00', title: 'Deck boat', detail: 'Okafor · 2 hours', status: 'Ready', tone: 'success', action: 'Hand over' },
        { lead: '—', title: 'Center console', detail: 'New propeller', status: 'In repair', tone: 'warning' },
      ],
      caption: 'The Rentals screen: every boat, who has it and when it is due back.',
    },
    cost: {
      example: 'Half-day pontoon, 4 hours',
      price: 34_000,
      busy: { label: 'A busy summer month', bookings: 120, avg: 30_000 },
      quiet: { label: 'An off-season month', bookings: 0, avg: 0 },
    },
    steps: [
      { wizard: 'Basics', title: 'Add your boats', text: 'Choose Rental, then Self-drive or gear. Add each boat type and how many you own.' },
      { wizard: 'Pricing', title: 'Set prices and rules', text: 'Sell by the hour, by the day or as a half day. Add the deposit, fuel rule and late fee.' },
      { wizard: 'Guests', then: 'Review', title: 'Ask, sign, publish', text: 'Ask for the boat licence, attach your waiver and publish. Share the link or add the button to your site.' },
    ],
    faqs: [
      { q: 'Can I rent different boats under one booking link?', a: 'Yes. Each boat type has its own stock and price, and guests pick from one page.' },
      { q: 'Can I charge by the hour and by the day?', a: 'Yes. Sell by the hour, by the day or both, and add set lengths like "Half day" at one price.' },
      { q: 'Can weekends cost more than weekdays?', a: 'Yes. Add a weekday price rule, or a season for the summer. The booking page shows the right price on each day.' },
      { q: 'What if the weather closes the lake?', a: 'Message everyone booked that day from one screen, then move or refund their bookings.' },
    ],
    related: ['jet-ski-rental', 'boat-charters', 'kayak-rental'],
    product: [
      { href: '/product/booking', label: 'Online booking' },
      { href: '/product/scheduling', label: 'Scheduling' },
      { href: '/product/payments', label: 'Payments and deposits' },
    ],
  },

  /* ---------------------------------------------------------- bike rental */
  'bike-rental': {
    slug: 'bike-rental',
    software: 'Bike rental software',
    name: 'Bike rental',
    group: 'rentals',
    tone: 'honeydew',
    title: 'Bike Rental Software for Bike & E-Bike Shops | EZRA Pro',
    meta: 'Bike and e-bike rental software with sizes, stock per model, helmets as add-ons and walk-up sales. 4% per booking, no monthly fee.',
    h1: 'Bike rental software for bikes, e-bikes and everything between',
    subhead: 'Every model and size counted, booked online or at the counter, and back on time.',
    card: 'Bikes and e-bikes by size, online and at the counter.',
    keywords: {
      primary: 'bike rental software',
      secondary: [
        'bicycle rental software',
        'ebike rental software',
        'bike rental business software',
        'bike rental management software',
        'bike rental reservation software',
        'bike rental booking software',
      ],
    },
    photo: 'pxBikeRow',
    setupAs: 'Rental · Self-drive or gear',
    chips: [
      { icon: 'Bike', title: 'E-bike, medium', detail: '3 of 8 left today' },
      { icon: 'Store', title: 'Walk-in', detail: '2 bikes · paid by card' },
    ],
    problems: [
      {
        icon: 'Ruler',
        problem: 'Running out of one size',
        fix: 'Each model and size has its own stock, so medium e-bikes can sell out while large ones stay open.',
        feature: 'Items and prices',
      },
      {
        icon: 'Store',
        problem: 'Walk-ups at the counter',
        fix: 'Sell from the Walk-ins desk. It takes from the same stock as online bookings, so nothing is sold twice.',
        feature: 'Walk-ins',
      },
      {
        icon: 'PackagePlus',
        problem: 'Helmets, locks and child seats',
        fix: 'Add them as extras at checkout, and ask each rider’s height so the right frame is ready.',
        feature: 'Guest details',
      },
      {
        icon: 'MapPin',
        problem: 'More than one shop',
        fix: 'Each location has its own times, and guests choose where they pick up.',
        feature: 'Locations',
      },
    ],
    board: {
      screen: 'Rentals',
      heading: 'Rentals',
      sub: 'Today · stock',
      rows: [
        { lead: 'M', title: 'E-bike, medium', detail: '5 out · 3 in the shop', status: '3 left', tone: 'warning' },
        { lead: 'L', title: 'E-bike, large', detail: '2 out · 6 in the shop', status: '6 left', tone: 'success' },
        { lead: '—', title: 'City bike', detail: '3 out · 12 in the shop', status: '12 left', tone: 'success' },
        { lead: '—', title: 'Kids bike', detail: '1 in repair · flat tyre', status: 'In repair', tone: 'neutral' },
      ],
      caption: 'Stock by model and size, with online and walk-in sales taken from the same count.',
    },
    cost: {
      example: 'Two e-bikes for a full day, $85 each',
      price: 17_000,
      busy: { label: 'A busy summer month', bookings: 500, avg: 6_000 },
      quiet: { label: 'A winter month', bookings: 20, avg: 6_000 },
    },
    steps: [
      { wizard: 'Basics', title: 'Add your bikes', text: 'Choose Rental, then Self-drive or gear. Add each model or size and how many you own.' },
      { wizard: 'Pricing', title: 'Set lengths and prices', text: '2 hours, half day, full day, or a price per day. Add helmets and locks as extras.' },
      { wizard: 'Guests', then: 'Review', title: 'Ask, choose, publish', text: 'Ask for rider height, add a waiver if you use one, pick your locations and publish.' },
    ],
    faqs: [
      { q: 'Do you handle multi-day bike rentals?', a: 'Yes. Sell by the day with pick-up and return times, and set the fewest and most days.' },
      { q: 'What about bikes in for repair?', a: 'Mark them out of service with a note. They stop showing as available until you put them back.' },
      { q: 'Can I sell guided bike tours too?', a: 'Yes. A tour is an activity with set start times, sold next to your rentals.' },
      { q: 'Can hotels send me guests with a discount?', a: 'Yes. Make a promo code for each hotel to hand to its guests.' },
    ],
    related: ['golf-cart-rental', 'kayak-rental', 'ski-rental'],
    product: [
      { href: '/product/booking', label: 'Online booking' },
      { href: '/product/payments', label: 'Payments' },
      { href: '/product/crm', label: 'Guest CRM' },
    ],
  },

  /* ------------------------------------------------------ airport shuttle */
  'airport-shuttle': {
    slug: 'airport-shuttle',
    software: 'Airport shuttle software',
    name: 'Airport shuttle',
    group: 'rides',
    tone: 'sunbeam',
    title: 'Airport Shuttle & Transfer Booking Software | EZRA Pro',
    meta: 'Sell airport transfers by destination and vehicle, private or shared seats, with flight numbers at checkout. 4% per booking, $0 a month.',
    h1: 'Airport shuttle software that prices every ride for you',
    subhead: 'Private transfers, shared seats or a driver by the hour. Flight numbers in, drivers’ lists out.',
    card: 'Private transfers and shared seats, priced by zone.',
    keywords: {
      primary: 'airport shuttle software',
      secondary: [
        'shuttle booking software',
        'shuttle service software',
        'transportation booking software',
        'airport transfer booking software',
        'airport shuttle booking software',
        'shuttle scheduling software',
      ],
    },
    photo: 'pxAirportTraveller',
    setupAs: 'Rental · With a driver',
    chips: [
      { icon: 'CarFront', title: 'Airport → Hotel zone', detail: 'SUV · $95 one way' },
      { icon: 'Plane', title: 'AA 1234', detail: 'Lands 14:05 · 60 min free wait' },
    ],
    problems: [
      {
        icon: 'Route',
        problem: 'Quoting every ride by hand',
        fix: 'Set your zones and vehicles once. The price table prices each booking, and the vehicle is picked from passengers and bags.',
        feature: 'Rental with a driver',
      },
      {
        icon: 'Plane',
        problem: 'Late flights, missed pickups',
        fix: 'Checkout asks for the flight number. Arrivals get a free wait after landing, 60 minutes unless you change it.',
        feature: 'Flight details',
      },
      {
        icon: 'Users',
        problem: 'Half-empty shared shuttles',
        fix: 'Sell shared seats on set run times each way. Seats are counted per run.',
        feature: 'Shared seats',
      },
      {
        icon: 'LayoutList',
        problem: 'Who is driving what',
        fix: 'Every ride lands on the Pickups board for the next 7 days, grouped by run, with a driver on each.',
        feature: 'Pickups',
      },
    ],
    board: {
      screen: 'Pickups',
      heading: 'Pickups',
      sub: 'Today · 4 rides',
      rows: [
        { lead: '09:30', title: 'Shared run to the hotel zone', detail: '9 of 12 seats · 3 stops', status: 'Luis', tone: 'info' },
        { lead: '11:15', title: 'Airport → Marina · SUV', detail: 'Flight AA 1234 · 3 guests, 4 bags', status: 'Ana', tone: 'info' },
        { lead: '14:05', title: 'Airport → Old town · van', detail: 'Flight lands 14:05 · 7 guests', status: 'No driver', tone: 'warning', action: 'Assign' },
        { lead: '17:40', title: 'Hotel zone → Airport · sedan', detail: 'Leaves 2 hours before the flight', status: 'Marco', tone: 'info' },
      ],
      caption: 'The Pickups board: every ride for the next 7 days, by run, with its driver.',
    },
    cost: {
      example: 'Private SUV, airport to hotel and back',
      price: 19_000,
      also: { label: 'One shared seat, $28', price: 2_800 },
      busy: { label: 'A busy month', bookings: 600, avg: 7_000 },
      quiet: { label: 'A month with no rides', bookings: 0, avg: 0 },
    },
    steps: [
      { wizard: 'Basics', title: 'Pick how you sell', text: 'Choose Rental, then With a driver: by trip, by the hour or shared seats. Add your airport and the zones you drive to.' },
      { wizard: 'Pricing', title: 'Fill the price table', text: 'A price for each zone and vehicle size, a price per hour, or a price per seat.' },
      { wizard: 'Booking', then: 'Review', title: 'Set runs and publish', text: 'Set shared run times, the free wait after landing and the most vehicles one online booking can take.' },
    ],
    faqs: [
      { q: 'Can guests book a return trip in one go?', a: 'Yes. A return books the airport pickup and the ride back together, and both rides show on the Pickups board.' },
      { q: 'Can I hire out a driver by the hour?', a: 'Yes. Sell a vehicle and driver by the hour, next to your airport transfers.' },
      { q: 'What about big groups?', a: 'When a group is too big for your vehicles, the booking becomes a request you can quote.' },
      { q: 'Can I add transport to my tours?', a: 'Yes. Any activity can offer pickup and drop-off from your zones, with a price per zone.' },
    ],
    related: ['golf-cart-rental', 'boat-charters', 'bike-rental'],
    product: [
      { href: '/product/booking', label: 'Online booking' },
      { href: '/product/scheduling', label: 'Scheduling' },
      { href: '/product/channels', label: 'Channel manager' },
    ],
  },

  /* -------------------------------------------------------- boat charters */
  'boat-charters': {
    slug: 'boat-charters',
    software: 'Boat charter software',
    name: 'Boat charters',
    group: 'private',
    tone: 'rain',
    title: 'Boat & Fishing Charter Booking Software | EZRA Pro',
    meta: 'Charter booking software for fishing, sailing and yacht trips. Private trips priced per group, deposits, requests and quotes. 4% per booking.',
    h1: 'Charter booking software for fishing, sailing and yacht trips',
    subhead: 'One group per boat, priced per trip. Take a deposit now and the rest before you sail.',
    card: 'Fishing, sailing and yacht trips, one group per boat.',
    keywords: {
      primary: 'boat charter software',
      secondary: [
        'charter booking software',
        'yacht charter software',
        'charter boat booking software',
        'fishing charter booking software',
        'sailing charter booking software',
        'fishing charter software',
      ],
    },
    photo: 'pxFishingStern',
    setupAs: 'Activity or tour · Private',
    chips: [
      { icon: 'Users', title: 'Half day', detail: 'Up to 6 guests · one price' },
      { icon: 'Wallet', title: 'Deposit 25% paid', detail: 'Balance due 2 days before' },
    ],
    problems: [
      {
        icon: 'Anchor',
        problem: 'You sell the boat, not seats',
        fix: 'A private activity books one group per time, priced per group, up to the most guests you allow. Extra spots sell at a set price.',
        feature: 'Private activity',
      },
      {
        icon: 'Wallet',
        problem: 'Big trips need a deposit',
        fix: 'Take a deposit as a percent, per guest or a fixed amount, and set when the balance is due.',
        feature: 'Booking flow',
      },
      {
        icon: 'MessageSquareText',
        problem: 'Custom trips and big groups',
        fix: 'Turn on request to book with notice hours, or send a custom quote the guest pays online.',
        feature: 'Custom requests',
      },
      {
        icon: 'CloudRain',
        problem: 'Weather calls at dawn',
        fix: 'Message everyone on that trip from one place, then move or refund them.',
        feature: 'Messages',
      },
    ],
    board: {
      screen: 'Calendar',
      heading: 'Charters',
      sub: 'This week',
      rows: [
        { lead: 'Mon', title: 'Half day · 07:00', detail: 'Patel · 5 guests', status: 'Deposit paid', tone: 'success' },
        { lead: 'Tue', title: 'Full day · 06:00', detail: 'Moreau · 6 guests', status: 'Paid', tone: 'success' },
        { lead: 'Wed', title: 'Sunset sail · 17:30', detail: 'Request from Brooks · 8 guests', status: 'Request', tone: 'warning', action: 'Send quote' },
        { lead: 'Thu', title: 'Half day · 07:00', detail: 'Nothing booked yet', status: 'Open', tone: 'neutral' },
      ],
      caption: 'One group per boat per time, with deposits and requests in plain view.',
    },
    cost: {
      example: 'Half-day private fishing charter',
      price: 85_000,
      busy: { label: 'A busy month', bookings: 30, avg: 95_000 },
      quiet: { label: 'A month in dry dock', bookings: 0, avg: 0 },
    },
    steps: [
      { wizard: 'Basics', title: 'Describe the charter', text: 'Choose Activity or tour, then Private. Set how long it runs and the most guests.' },
      { wizard: 'Pricing', title: 'Add trip lengths', text: '4 hours, 6 hours, full day, each at a group price. Add extra spots, tackle or lunch.' },
      { wizard: 'Booking', then: 'Review', title: 'Set rules and publish', text: 'Pick start times or request to book, set the deposit and cancellation rules, add your waiver.' },
    ],
    faqs: [
      { q: 'Do you support bareboat charters?', a: 'Yes. Mark the charter as not crewed, or set up the boat as a rental with a boat licence check.' },
      { q: 'Can I run shared fishing trips too?', a: 'Yes. Sell seats on a shared trip next to your private charters.' },
      { q: 'Can I sell a charter as a gift?', a: 'Yes. Gift cards sell on your booking page, and whoever gets one picks the date.' },
      { q: 'Can peak season cost more?', a: 'Yes. Add a season with its own price, or raise prices on set dates like holidays.' },
    ],
    related: ['boat-rental', 'jet-ski-rental', 'airport-shuttle'],
    product: [
      { href: '/product/booking', label: 'Online booking' },
      { href: '/product/payments', label: 'Deposits and payments' },
      { href: '/product/crm', label: 'Guest CRM' },
    ],
  },

  /* --------------------------------------------------------- kayak rental */
  'kayak-rental': {
    slug: 'kayak-rental',
    software: 'Kayak rental software',
    name: 'Kayak rental',
    group: 'rentals',
    tone: 'cloud',
    title: 'Kayak & Paddleboard Rental Software | EZRA Pro',
    meta: 'Kayak, canoe and paddleboard rental software. Singles and tandems counted, waivers signed before launch, walk-ups at the dock. 4% per booking.',
    h1: 'Kayak and paddleboard rental software',
    subhead: 'Singles, tandems and boards each counted. Waivers signed before anyone reaches the water.',
    card: 'Kayaks, canoes and boards, waivers signed online.',
    keywords: {
      primary: 'kayak rental software',
      secondary: ['kayak rental booking software', 'kayak rental app', 'watersports rental software', 'paddleboard rental software'],
    },
    photo: 'heroPaddler',
    setupAs: 'Rental · Self-drive or gear',
    chips: [
      { icon: 'Sailboat', title: 'Tandem kayak', detail: '4 of 10 left at 10:00' },
      { icon: 'Signature', title: 'Waivers', detail: '3 of 3 signed' },
    ],
    problems: [
      {
        icon: 'Layers',
        problem: 'Singles, tandems and boards together',
        fix: 'Each has its own stock and how many people it fits, so a family books two tandems and a board at once.',
        feature: 'Items and prices',
      },
      {
        icon: 'Signature',
        problem: 'Paper waivers at the launch',
        fix: 'The waiver is signed online, by the booker for everyone or by each guest. Check-in shows who has signed.',
        feature: 'Waivers',
      },
      {
        icon: 'Store',
        problem: 'Walk-ups when the sun comes out',
        fix: 'Sell from the Walk-ins desk on a phone at the dock, from the same stock.',
        feature: 'Walk-ins',
      },
      {
        icon: 'CloudRain',
        problem: 'Wind closes the water',
        fix: 'Message every guest booked that day, then move or refund them.',
        feature: 'Messages',
      },
    ],
    board: {
      screen: 'Check-in',
      heading: 'Check-in',
      sub: 'Today · 10:00',
      rows: [
        { lead: '10:00', title: 'Nguyen · 2 tandems', detail: 'Waivers 4 of 4', status: 'Signed', tone: 'success', action: 'Check in' },
        { lead: '10:00', title: 'Silva · 1 board', detail: 'Waivers 1 of 1', status: 'Checked in', tone: 'info' },
        { lead: '10:00', title: 'Walker · 3 singles', detail: 'Waivers 2 of 3', status: '1 to sign', tone: 'warning', action: 'Send link' },
        { lead: '10:00', title: 'Walk-in · 1 canoe', detail: 'Paid at the dock', status: 'Signed', tone: 'success', action: 'Check in' },
      ],
      caption: 'Check-in: who is here, who has signed, one button per party.',
    },
    cost: {
      example: 'Two tandem kayaks for 2 hours, $65 each',
      price: 13_000,
      busy: { label: 'A busy summer month', bookings: 700, avg: 5_000 },
      quiet: { label: 'A closed winter month', bookings: 0, avg: 0 },
    },
    steps: [
      { wizard: 'Basics', title: 'Add your boats and boards', text: 'Choose Rental, then Self-drive or gear. Add singles, tandems, canoes and boards, with how many you own.' },
      { wizard: 'Pricing', title: 'Set lengths and prices', text: '1 hour, 2 hours, half day. Add dry bags or other extras.' },
      { wizard: 'Guests', then: 'Review', title: 'Waiver on, publish', text: 'Attach your waiver, ask swimming ability if you want it, then publish and share the link.' },
    ],
    faqs: [
      { q: 'Can I rent kayaks and paddleboards from one page?', a: 'Yes. Each has its own stock and price under one booking link.' },
      { q: 'Can I sell sunset or guided paddles?', a: 'Yes. Add each one with its own start times and spots, on the same booking page as your rentals.' },
      { q: 'Can I add dry bags or a second paddle?', a: 'Yes. Add extras at checkout, free or at a price.' },
      { q: 'Do I pay anything in winter?', a: 'No. There is no monthly fee, so a month with no bookings costs $0.' },
    ],
    related: ['jet-ski-rental', 'boat-rental', 'bike-rental'],
    product: [
      { href: '/product/booking', label: 'Online booking' },
      { href: '/product/scheduling', label: 'Scheduling' },
      { href: '/product/crm', label: 'Guest CRM' },
    ],
  },

  /* ----------------------------------------------------------- ski rental */
  'ski-rental': {
    slug: 'ski-rental',
    software: 'Ski rental software',
    name: 'Ski rental',
    group: 'rentals',
    tone: 'lavender',
    title: 'Ski & Snowboard Rental Software | EZRA Pro',
    meta: 'Ski and snowboard rental software with sizes taken at booking, multi-day rentals, lessons and packages. 4% per booking, $0 in summer.',
    h1: 'Ski and snowboard rental software, sized before they arrive',
    subhead: 'Height, weight, shoe size and level taken online, so the fitting line keeps moving.',
    card: 'Skis and boards by the day, sizes taken online.',
    keywords: {
      primary: 'ski rental software',
      secondary: ['snowboard rental software', 'ski shop software'],
    },
    photo: 'pxSkiFlatlay',
    setupAs: 'Rental · Self-drive or gear',
    chips: [
      { icon: 'Ruler', title: '175 cm · shoe 42', detail: 'Intermediate' },
      { icon: 'Snowflake', title: '3 days', detail: 'Family of 4 · ready at 08:30' },
    ],
    problems: [
      {
        icon: 'Ruler',
        problem: 'Long fitting lines',
        fix: 'Ask each skier’s height, weight, shoe size and level at checkout. It is on the guest list before they arrive.',
        feature: 'Guest details',
      },
      {
        icon: 'CalendarClock',
        problem: 'Multi-day family rentals',
        fix: 'Sell by the day with pick-up and return times. Each set (skis, boots, poles) has its own stock.',
        feature: 'Items and prices',
      },
      {
        icon: 'GraduationCap',
        problem: 'Lessons with the gear',
        fix: 'Add a lesson with a level and students per instructor, and bundle it with the rental as a package.',
        feature: 'Lessons and packages',
      },
      {
        icon: 'Gift',
        problem: 'A short, busy season',
        fix: 'No monthly fee, so the summer costs nothing. Gift cards sell on your booking page all year.',
        feature: 'Gift cards',
      },
    ],
    board: {
      screen: 'Guest list',
      heading: 'Guest list',
      sub: 'Tomorrow · pick-up 08:30',
      rows: [
        { lead: 'A', title: 'Anna Berg', detail: '168 cm · 58 kg · shoe 39 · Beginner', status: 'Sport skis', tone: 'info' },
        { lead: 'J', title: 'Jonas Berg', detail: '182 cm · 80 kg · shoe 44 · Intermediate', status: 'Performance', tone: 'info' },
        { lead: 'M', title: 'Mia Berg', detail: '131 cm · 29 kg · shoe 33 · Beginner', status: 'Kids set', tone: 'info' },
        { lead: 'L', title: 'Leo Berg', detail: '140 cm · 34 kg · shoe 35', status: 'Snowboard', tone: 'success', action: 'Set ready' },
      ],
      caption: 'Sizes on the guest list the night before, so sets are ready at pick-up.',
    },
    cost: {
      example: '3-day ski rental for a family of 4, $48 per person per day',
      price: 57_600,
      busy: { label: 'A peak month', bookings: 600, avg: 11_000 },
      quiet: { label: 'A summer month', bookings: 0, avg: 0 },
    },
    steps: [
      { wizard: 'Basics', title: 'Add your sets', text: 'Choose Rental, then Self-drive or gear. Add each set (sport skis, performance skis, snowboard, kids) with how many you have.' },
      { wizard: 'Pricing', title: 'Price by the day', text: 'Set a price per day with the fewest and most days. Add helmets as extras.' },
      { wizard: 'Guests', then: 'Review', title: 'Sizes on, publish', text: 'Turn on height, weight, shoe size and level for each guest, then publish. Add a lesson if you run a school.' },
    ],
    faqs: [
      { q: 'Which sizes can I ask for?', a: 'You pick the fields: height, weight, shoe size and experience level. Each one is asked for every guest.' },
      { q: 'Can I run a shop at the lift and one in town?', a: 'Yes. Add each location with its own hours, and guests choose where they pick up.' },
      { q: 'Can the holidays cost more?', a: 'Yes. Add a price rule for set dates, or a season for the peak weeks.' },
      { q: 'What about skiers who just walk in?', a: 'Sell from the Walk-ins desk. It uses the same stock, so a set booked online is never handed out twice.' },
    ],
    related: ['bike-rental', 'golf-cart-rental', 'kayak-rental'],
    product: [
      { href: '/product/booking', label: 'Online booking' },
      { href: '/product/crm', label: 'Guest CRM' },
      { href: '/product/payments', label: 'Payments' },
    ],
  },

  /* ------------------------------------------------------- jet ski rental */
  'jet-ski-rental': {
    slug: 'jet-ski-rental',
    software: 'Jet ski rental software',
    name: 'Jet ski rental',
    group: 'rentals',
    tone: 'sunbeam',
    title: 'Jet Ski Rental Software with Waivers | EZRA Pro',
    meta: 'Jet ski rental software with riders per ski, boater card checks, waivers and deposits at checkout. 4% per booking, nothing in the off-season.',
    h1: 'Jet ski rental software with the paperwork built in',
    subhead: 'Waivers, boater cards and deposits done at checkout. Your dock does the fun part.',
    card: 'Jet skis by the half hour, waivers and deposits done.',
    keywords: {
      primary: 'jet ski rental software',
      secondary: ['jet ski rental waiver', 'jet ski booking software', 'PWC rental software'],
    },
    photo: 'pxJetSkiShore',
    setupAs: 'Rental · Self-drive or gear',
    chips: [
      { icon: 'Users', title: '2 riders per ski', detail: '3 skis · 6 riders' },
      { icon: 'ClipboardCheck', title: 'Boater card ✓', detail: 'Waivers 6 of 6 signed' },
    ],
    problems: [
      {
        icon: 'Signature',
        problem: 'Paperwork slows the dock',
        fix: 'Every rider signs the waiver online, and checkout asks that the driver has a boater card. Check-in shows what is done.',
        feature: 'Waivers',
      },
      {
        icon: 'Users',
        problem: 'Skis versus riders',
        fix: 'Set riders per ski (2 unless you change it). Guests book skis, and the rider count follows.',
        feature: 'Rental settings',
      },
      {
        icon: 'ShieldCheck',
        problem: 'Damage and fuel',
        fix: 'Hold a refundable damage deposit per ski, and choose a fuel rule.',
        feature: 'Rental settings',
      },
      {
        icon: 'Wrench',
        problem: 'Turnaround between rides',
        fix: 'Keep buffer minutes between rentals for fuel and a check. A ski in repair goes out of service.',
        feature: 'Stock and repairs',
      },
    ],
    board: {
      screen: 'Check-in',
      heading: 'Check-in',
      sub: 'Today · 11:00',
      rows: [
        { lead: '11:00', title: 'Ramos · 2 skis', detail: 'Boater card ✓ · waivers 4 of 4', status: 'Ready', tone: 'success', action: 'Check in' },
        { lead: '11:00', title: 'Hughes · 1 ski', detail: 'Boater card ✓ · waivers 1 of 2', status: '1 to sign', tone: 'warning', action: 'Send link' },
        { lead: '11:30', title: 'Kim · 1 ski', detail: 'Deposit $300 held', status: 'Out', tone: 'info' },
        { lead: '—', title: 'Ski 4', detail: 'Impeller check', status: 'In repair', tone: 'neutral' },
      ],
      caption: 'Check-in: boater card, waivers and deposit for every party at a glance.',
    },
    cost: {
      example: 'Two jet skis for 1 hour, $129 each',
      price: 25_800,
      busy: { label: 'A busy summer month', bookings: 250, avg: 15_000 },
      quiet: { label: 'A closed month', bookings: 0, avg: 0 },
    },
    steps: [
      { wizard: 'Basics', title: 'Add your skis', text: 'Choose Rental, then Self-drive or gear. Add your skis, how many you own and riders per ski.' },
      { wizard: 'Pricing', title: 'Set lengths and rules', text: '30 minutes, 1 hour, 2 hours. Add the damage deposit, fuel rule and late fee.' },
      { wizard: 'Guests', then: 'Review', title: 'Checks on, publish', text: 'Turn on the boater card check and your waiver for each rider, set a minimum age and publish.' },
    ],
    faqs: [
      { q: 'Can every rider sign the jet ski rental waiver online?', a: 'Yes. Choose "each guest" and every rider signs before they arrive.' },
      { q: 'Can I set a minimum age?', a: 'Yes. Set the age on the rental, and guests see it before they book.' },
      { q: 'Can I fill quiet weekday mornings?', a: 'Yes. Add a quiet-times price rule, or a lower price for the first rides of the day.' },
      { q: 'Can I sell guided jet ski tours?', a: 'Yes. Add the tour with its own start times and spots, next to your rentals.' },
    ],
    related: ['boat-rental', 'kayak-rental', 'boat-charters'],
    product: [
      { href: '/product/booking', label: 'Online booking' },
      { href: '/product/payments', label: 'Payments and deposits' },
      { href: '/product/scheduling', label: 'Scheduling' },
    ],
  },

  /* ----------------------------------------------------- golf cart rental */
  'golf-cart-rental': {
    slug: 'golf-cart-rental',
    software: 'Golf cart rental software',
    name: 'Golf cart rental',
    group: 'rentals',
    tone: 'linen',
    title: 'Golf Cart Rental Software & Online Booking | EZRA Pro',
    meta: 'Golf cart rental software for beach towns and resorts. Daily and weekly rentals, driver’s licence checks, deposits held. 4% per booking.',
    h1: 'Golf cart rental software for beach towns and resorts',
    subhead: 'Daily and weekly carts booked online, licences checked, deposits held, every cart on one screen.',
    card: 'Carts by the day or week, licences checked.',
    keywords: {
      primary: 'golf cart rental software',
      secondary: ['golf cart rental booking software', 'golf cart rental management software'],
    },
    photo: 'pxGolfCart',
    setupAs: 'Rental · Self-drive or gear',
    chips: [
      { icon: 'CarFront', title: '6-seat cart', detail: 'Sat to Sat · one price' },
      { icon: 'IdCard', title: 'Driver’s licence ✓', detail: 'Deposit $200 held' },
    ],
    problems: [
      {
        icon: 'CalendarClock',
        problem: 'Week-long bookings that overlap',
        fix: 'Sell by the day with pick-up and return times. Each cart size has its own stock, so overlapping days can’t double-book.',
        feature: 'Items and prices',
      },
      {
        icon: 'IdCard',
        problem: 'Who is driving',
        fix: 'Checkout asks for a driver’s licence, you set a minimum age, and the waiver is signed online.',
        feature: 'Waivers',
      },
      {
        icon: 'ShieldCheck',
        problem: 'Damage and late returns',
        fix: 'Hold a refundable deposit per cart and charge a late fee per hour.',
        feature: 'Rental settings',
      },
      {
        icon: 'LayoutList',
        problem: 'Which carts are out',
        fix: 'The Rentals screen shows every cart for the day. A cart in the shop goes out of service with a note.',
        feature: 'Stock and repairs',
      },
    ],
    board: {
      screen: 'Rentals',
      heading: 'Rentals',
      sub: 'Today · 4 carts',
      rows: [
        { lead: '4', title: '4-seat cart', detail: 'Lopez · back Saturday 10:00', status: 'Out', tone: 'info' },
        { lead: '6', title: '6-seat cart', detail: 'Hart · due back today 10:00', status: 'Due back', tone: 'warning', action: 'Return' },
        { lead: '6', title: '6-seat cart', detail: 'Pick-up 11:00 · licence ✓', status: 'Ready', tone: 'success', action: 'Hand over' },
        { lead: '4', title: '4-seat cart', detail: 'New battery', status: 'In repair', tone: 'neutral' },
      ],
      caption: 'The Rentals screen: out, due back, ready or in repair, one button each.',
    },
    cost: {
      example: '4-seat cart for 3 days at $80 a day',
      price: 24_000,
      also: { label: 'A week capped at $420', price: 42_000 },
      busy: { label: 'A busy month', bookings: 150, avg: 30_000 },
      quiet: { label: 'A quiet month', bookings: 0, avg: 0 },
    },
    steps: [
      { wizard: 'Basics', title: 'Add your carts', text: 'Choose Rental, then Self-drive or gear. Add each cart size, how many you have and the seats in each.' },
      { wizard: 'Pricing', title: 'Price by the day', text: 'A price per day and a cap so a week tops out. Add pick-up and return times, deposit and late fee.' },
      { wizard: 'Guests', then: 'Review', title: 'Checks on, publish', text: 'Turn on the licence check and minimum age, attach your waiver, pick your location and publish.' },
    ],
    faqs: [
      { q: 'Can I rent golf carts by the week?', a: 'Yes. Sell by the day with the fewest and most days, and set a cap so a week has one price.' },
      { q: 'Can I run more than one rental lot?', a: 'Yes. Add each lot with its own hours, and guests choose where they pick up.' },
      { q: 'Can high season cost more?', a: 'Yes. Add a season with its own daily price for the busy months.' },
      { q: 'Can guests get a reminder before pick-up?', a: 'Yes. Turn on a reminder message that goes out the day before.' },
    ],
    related: ['bike-rental', 'airport-shuttle', 'boat-rental'],
    product: [
      { href: '/product/booking', label: 'Online booking' },
      { href: '/product/payments', label: 'Payments and deposits' },
      { href: '/product/scheduling', label: 'Scheduling' },
    ],
  },
}

export const NICHE_LIST: Niche[] = NICHE_SLUGS.map((slug) => NICHES[slug])

export function getNiche(slug: string): Niche | null {
  return (NICHE_SLUGS as readonly string[]).includes(slug) ? NICHES[slug as NicheSlug] : null
}

/* ==========================================================================
   THE HUB
   ========================================================================== */

export const HUB = {
  path: '/booking-software',
  title: 'Rental & Activity Booking Software | EZRA Pro',
  meta: 'Booking software for boat, bike, kayak, jet ski, golf cart and ski rentals, charters and airport shuttles. 4% per booking, $0 a month.',
  h1: 'Booking software for rentals, charters and rides',
  subhead: 'Pick your business. See how it books, what it costs and how to set it up.',
  keywords: { primary: 'rental booking software', secondary: ['activity booking software', 'rental reservation software'] },
} as const

export const NICHE_GROUPS: { key: NicheGroup; label: string; line: string }[] = [
  { key: 'rentals', label: 'Rentals', line: 'Things guests take out and bring back.' },
  { key: 'private', label: 'Private trips', line: 'One group, one boat, one price.' },
  { key: 'rides', label: 'Rides', line: 'Guests moved from A to B.' },
]

/** The tools every one of these businesses gets, whatever it rents. */
export const SHARED_TOOLS: { icon: NicheIcon; label: string }[] = [
  { icon: 'CalendarClock', label: 'Online booking' },
  { icon: 'Signature', label: 'Waivers' },
  { icon: 'Wallet', label: 'Deposits' },
  { icon: 'Gift', label: 'Gift cards' },
  { icon: 'PackagePlus', label: 'Promo codes' },
  { icon: 'Store', label: 'Walk-ins' },
]
