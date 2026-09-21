import type { PhotoKey } from '@/components/marketing/story/photos'
import type { MarketingVerticalKey as VerticalKey } from '@/types'

/* ==========================================================================
   What each solutions page shows that the generic pitch cannot: the pictures
   of that trade, three small pieces of the product as that operator sees
   them, and three moments the software handled.

   Plain data, no JSX, so the server route can import it and hand it down.
   Icons are lucide names resolved in the client components.
   ========================================================================== */

export type TokenIcon =
  | 'CloudRain'
  | 'Ship'
  | 'FileCheck2'
  | 'Bus'
  | 'Users'
  | 'BadgePlus'
  | 'ConciergeBell'
  | 'Percent'
  | 'Anchor'
  | 'Scale'
  | 'Backpack'
  | 'Landmark'
  | 'ListOrdered'
  | 'Utensils'
  | 'Ticket'
  | 'Repeat2'
  | 'CalendarClock'
  | 'Waves'

export type TokenTone = 'primary' | 'accent' | 'success' | 'info'

export interface SolutionToken {
  key: string
  icon: TokenIcon
  tone: TokenTone
  title: string
  detail: string
  /** Where it floats around the hero stage, desktop only. */
  className: string
  depth: number
}

export interface SolutionMoment {
  key: string
  time: string
  label: string
  photo: PhotoKey
  line: string
  did: [string, string]
}

/** One thing the product does for this trade, said the way the operator would. */
export interface SolutionPoint {
  icon: TokenIcon
  title: string
  detail: string
}

export interface SolutionContent {
  /** The photograph on the hero stage. */
  hero: PhotoKey
  /** The photograph on this trade's card when another page links to it: a local file, so it stays sharp. */
  card: PhotoKey
  /** A second frame that sits behind it, for depth. */
  behind: PhotoKey
  /** The photographs on the hero's ring, in the order they go round. */
  ring: PhotoKey[]
  tokens: SolutionToken[]
  moments: SolutionMoment[]
  /** The line above the console. */
  consoleLine: string
}

const TOKEN_SLOTS = ['left-[46%] top-[7%]', 'right-[3%] bottom-[9%]', 'left-[48%] bottom-[5%]'] as const

function tokens(list: Omit<SolutionToken, 'className' | 'depth'>[]): SolutionToken[] {
  return list.map((token, i) => ({ ...token, className: TOKEN_SLOTS[i] ?? TOKEN_SLOTS[0], depth: [1.4, 0.8, 1.1][i] ?? 1 }))
}

export const SOLUTION_CONTENT: Record<VerticalKey, SolutionContent> = {
  watersports: {
    hero: 'kayakCliffs',
    card: 'solBoatParty',
    behind: 'kayakSunset',
    ring: ['heroKayakBay', 'solBoatParty', 'solSailingBay', 'kayakCliffs', 'solLongtail', 'diverWave', 'solFloaters', 'heroKayakRiver'],
    consoleLine: 'Two hulls, nine departures, and the tide on every one of them.',
    tokens: tokens([
      { key: 'hold', icon: 'CloudRain', tone: 'info', title: 'Weather hold · 06:40', detail: '18 guests texted, refunds queued' },
      { key: 'seats', icon: 'Ship', tone: 'primary', title: 'Nalu · 36 of 49 seats', detail: 'Sunset sail, tonight' },
      { key: 'waiver', icon: 'FileCheck2', tone: 'success', title: 'Waivers signed', detail: '2 of 2, before the slip' },
    ]),
    moments: [
      {
        key: 'hold',
        time: '05:40',
        label: 'Before launch',
        photo: 'diversReef',
        line: 'Swell came up overnight. The 06:40 snorkel went on weather hold and every guest knew before breakfast.',
        did: ['One tap, eighteen texts, refunds queued', 'Crew moved to the 10:15'],
      },
      {
        key: 'slip',
        time: '11:20',
        label: 'At the slip',
        photo: 'kayakSunset',
        line: 'A walk-up family of five joined the afternoon sail from the host app, with no signal at the dock.',
        did: ['Waivers signed on the phone', 'Manifest caught up when the signal returned'],
      },
      {
        key: 'close',
        time: 'Sunday',
        label: 'The week closed',
        photo: 'goldenShore',
        line: 'Nine departures, two hulls, one payout on Monday morning, itemised by boat.',
        did: ['Next-business-day payout', 'Crew tips split automatically'],
      },
    ],
  },

  tours: {
    hero: 'groupPond',
    card: 'solTouristsMap',
    behind: 'fujiPagoda',
    ring: ['solTouristsMap', 'groupPond', 'solCoupleTravel', 'guideGroup', 'solRowboat', 'solRetroFamilies', 'guideBook', 'solOffroad'],
    consoleLine: 'Six hotels, twenty-three guests, two languages, one departure board.',
    tokens: tokens([
      { key: 'pickup', icon: 'Bus', tone: 'primary', title: 'Pickup list', detail: 'Hotel Aurora · 07:15 · 6 guests' },
      { key: 'guide', icon: 'Users', tone: 'info', title: 'Guide roster', detail: 'Mara takes the 09:00 in Spanish' },
      { key: 'upgrade', icon: 'BadgePlus', tone: 'accent', title: 'Private upgrade', detail: '+$180 · party of four' },
    ]),
    moments: [
      {
        key: 'pickup',
        time: '06:50',
        label: 'The pickup loop',
        photo: 'citySkyline',
        line: 'Twenty-three guests across six hotels, sorted by pickup time before the driver left the yard.',
        did: ['Pickup list by hotel and time', 'Guests texted their pickup window'],
      },
      {
        key: 'languages',
        time: '09:00',
        label: 'Two languages, one departure',
        photo: 'fujiPagoda',
        line: 'The English and Spanish groups left together and split at the gate, each with its own guide.',
        did: ['Guide roster with no double-booking', 'Language on the manifest'],
      },
      {
        key: 'ota',
        time: '16:30',
        label: 'Sold while the office slept',
        photo: 'waterTemple',
        line: "Viator sold the last two seats on tomorrow's volcano drive at half past four in the morning.",
        did: ['One basket of seats across every channel', 'Commission tracked per booking'],
      },
    ],
  },

  island: {
    hero: 'diversPrep',
    card: 'solLongtail',
    behind: 'diversReef',
    ring: ['solIslandAerial', 'solLongtail', 'solBeachChair', 'diversPrep', 'solSailingBay', 'solPool', 'diverWave', 'solFloaters'],
    consoleLine: 'Twenty operators, one desk, every commission where it should be.',
    tokens: tokens([
      { key: 'concierge', icon: 'ConciergeBell', tone: 'primary', title: 'Quick-book · Room 412', detail: 'Reef day, charged to the room' },
      { key: 'commission', icon: 'Percent', tone: 'accent', title: 'Sea Flame · 18%', detail: 'Settled to the partner on Friday' },
      { key: 'ship', icon: 'Anchor', tone: 'info', title: 'Ship in port · Thursday', detail: '2,400 guests, extra boats opened' },
    ]),
    moments: [
      {
        key: 'desk',
        time: '08:10',
        label: 'At the concierge desk',
        photo: 'goldenShore',
        line: "A guest asked about the reef. Booked onto a partner's boat, charged to room 412, in under a minute.",
        did: ['Quick-book across twenty operators', 'Charge to room, settle to partner'],
      },
      {
        key: 'ship',
        time: 'Thursday',
        label: 'A ship in port',
        photo: 'diversReef',
        line: 'Two thousand four hundred passengers due at nine. The desk saw it a week out and opened extra departures.',
        did: ['Cruise arrivals feed the forecast', 'Partners added capacity themselves'],
      },
      {
        key: 'settle',
        time: 'Friday',
        label: 'Settlement',
        photo: 'sunsetShore',
        line: 'Every partner paid their share, every commission reconciled, and nobody opened a spreadsheet.',
        did: ['Per-partner commission', 'Statements that tie to bookings'],
      },
    ],
  },

  adventure: {
    hero: 'cliffClimb',
    card: 'solQuadRider',
    behind: 'summitLedge',
    ring: ['solParagliders', 'cliffClimb', 'solAtv', 'solHiker', 'solQuadRider', 'summitLedge', 'solOffroad', 'skierJump'],
    consoleLine: 'Guides, gear and weather, checked before anyone reaches the trailhead.',
    tokens: tokens([
      { key: 'waiver', icon: 'FileCheck2', tone: 'success', title: 'Waiver signed · 09:12', detail: 'On the phone, three days out' },
      { key: 'weight', icon: 'Scale', tone: 'info', title: 'Heli weight gate', detail: '3 of 4 cleared, one rebooked' },
      { key: 'gear', icon: 'Backpack', tone: 'primary', title: 'Gear set #14', detail: 'Harness M · helmet · pack' },
    ]),
    moments: [
      {
        key: 'gate',
        time: 'Three days out',
        label: 'At checkout',
        photo: 'skierJump',
        line: 'A guest over the heli weight limit was told at checkout, not at the pad, and moved to the glacier walk.',
        did: ['Weight and age gating at booking', 'An alternative offered in the same flow'],
      },
      {
        key: 'trailhead',
        time: '07:30',
        label: 'At the trailhead',
        photo: 'hikersTrail',
        line: 'Every harness, helmet and pack allocated by name before the van doors opened.',
        did: ['Equipment sets per participant', 'Nothing assigned twice'],
      },
      {
        key: 'conditions',
        time: '05:00',
        label: 'Avalanche warning',
        photo: 'summitLedge',
        line: 'Conditions turned. The 08:00 ascent went on hold, guests were told, deposits were kept under the policy they accepted.',
        did: ['Condition holds with one tap', 'Policy applied automatically'],
      },
    ],
  },

  restaurants: {
    hero: 'waitressOrder',
    card: 'solCafeFriends',
    behind: 'restaurantRoom',
    ring: ['solCafeFriends', 'waitressOrder', 'solBarmanCouple', 'chefPlating', 'solWomenFood', 'heroToastService', 'solNfcPay', 'solCafeGift'],
    consoleLine: 'Forty covers a sitting, two sittings a night, every allergy on the pass.',
    tokens: tokens([
      { key: 'deposit', icon: 'Landmark', tone: 'success', title: 'Deposit held · $60', detail: 'Party of four, 19:30' },
      { key: 'waitlist', icon: 'ListOrdered', tone: 'primary', title: 'Table 9 resold', detail: 'From the waitlist, in order' },
      { key: 'allergy', icon: 'Utensils', tone: 'accent', title: 'Nut allergy', detail: 'On the ticket before the amuse-bouche' },
    ]),
    moments: [
      {
        key: 'cancel',
        time: '17:10',
        label: 'Before service',
        photo: 'restaurantRoom',
        line: 'A four-top cancelled at ten past five and was resold from the waitlist before the first cover sat down.',
        did: ['Deposit kept under your policy', 'Waitlist offered in order'],
      },
      {
        key: 'pass',
        time: '19:30',
        label: 'On the pass',
        photo: 'plated',
        line: 'A nut allergy noted at booking reached the pass before the amuse-bouche went out.',
        did: ['Dietary notes on the ticket', "Chef's counter seatings timed"],
      },
      {
        key: 'buyout',
        time: 'Saturday',
        label: 'Private dining',
        photo: 'vineyardGlass',
        line: 'A buyout for forty, prepaid in two instalments, with the floor plan on every phone.',
        did: ['Buyouts and prepaid menus', 'Balance collected two weeks out'],
      },
    ],
  },

  wellness: {
    hero: 'yogaSea',
    card: 'solSpaFacial',
    behind: 'spaTreatment',
    ring: ['heroYogaClass', 'solSpaFacial', 'heroYogaSplit', 'solPool', 'yogaSea', 'solSpaMask', 'sunsetYoga', 'solFloaters'],
    consoleLine: 'Classes, packs and memberships on one calendar, with retention you can read.',
    tokens: tokens([
      { key: 'pack', icon: 'Ticket', tone: 'primary', title: 'Class pack · 8 of 10', detail: 'Renews when the last one is used' },
      { key: 'promote', icon: 'Repeat2', tone: 'success', title: 'Waitlist promoted', detail: 'Sunrise yoga, one seat, 05:41' },
      { key: 'retreat', icon: 'CalendarClock', tone: 'accent', title: 'Retreat instalment', detail: '2 of 3 paid · $1,200' },
    ]),
    moments: [
      {
        key: 'sunrise',
        time: '06:00',
        label: 'Sunrise class',
        photo: 'sunsetYoga',
        line: 'A cancellation at twenty to six. The first person on the waitlist was on the mat by six.',
        did: ['Waitlist promotes itself', 'Packs debited only on attendance'],
      },
      {
        key: 'renewals',
        time: 'Month end',
        label: 'Memberships',
        photo: 'spaTreatment',
        line: 'Two hundred memberships renewed overnight, the failed cards retried, three people gently nudged.',
        did: ['Renewals with retry schedules', 'Lapsed members flagged for win-back'],
      },
      {
        key: 'retreat',
        time: 'The weekend',
        label: 'A reset retreat',
        photo: 'goldenShore',
        line: 'Twelve guests, three instalments each, one roster for the instructors and the kitchen.',
        did: ['Instalment billing for retreats', 'Instructor pay rates on the roster'],
      },
    ],
  },
}

/* ==========================================================================
   Under the hero copy: four things the product does for this trade, each a
   short claim and the concrete line behind it. Written as the operator would
   say it, with the time, the count or the name in it.
   ========================================================================== */

export const SOLUTION_POINTS: Record<VerticalKey, SolutionPoint[]> = {
  watersports: [
    { icon: 'Ship', title: 'Capacity per hull', detail: 'Two boats, two counts. A full 09:00 on one never blocks the other.' },
    { icon: 'CloudRain', title: 'Weather call at 06:40', detail: 'One tap texts every guest on the departure and queues the refunds.' },
    { icon: 'FileCheck2', title: 'Waivers before the dock', detail: 'Signed at checkout, cert card photographed, both on the manifest.' },
    { icon: 'Waves', title: 'Tide and swell on the manifest', detail: 'The skipper sees the swell beside the guest count, not in another app.' },
  ],
  tours: [
    { icon: 'Bus', title: 'Pickups in hotel order', detail: 'The driver’s list runs the route north to south, not alphabetically.' },
    { icon: 'Users', title: 'Guides rostered, never doubled', detail: 'Put Mara on the 09:00 and the 09:30 will not offer her.' },
    { icon: 'ListOrdered', title: 'As many departures as the day holds', detail: 'Add a 16:30 for June and it is gone again in September.' },
    { icon: 'Percent', title: 'Private and group, side by side', detail: 'Same slot, two prices, one seat count.' },
  ],
  island: [
    { icon: 'Landmark', title: 'Twenty operators, one desk', detail: 'Every partner’s trips on the concierge’s screen, live.' },
    { icon: 'Percent', title: 'Commission per partner', detail: 'Settled monthly with the statement attached. Nothing to reconcile.' },
    { icon: 'ConciergeBell', title: 'Charged to the room', detail: 'Book the guest into the 14:00 snorkel and it lands on their folio.' },
    { icon: 'Ship', title: 'Cruise days forecast', detail: 'Arrival manifests feed the week, so the desk staffs for 3,000, not 300.' },
  ],
  adventure: [
    { icon: 'FileCheck2', title: 'Waiver signed before arrival', detail: 'No signature, no seat. The trailhead never has the argument.' },
    { icon: 'Scale', title: 'Weight, age and fitness gates', detail: 'Set the limits once and checkout declines the booking politely.' },
    { icon: 'Backpack', title: 'Kit per participant', detail: 'Helmets, harnesses and boots allocated by size when they book.' },
    { icon: 'CloudRain', title: 'Condition holds', detail: 'A weather or avalanche rating closes the day and tells everyone at once.' },
  ],
  restaurants: [
    { icon: 'CalendarClock', title: 'Seatings, not tables', detail: 'The 17:30 and the 20:00 sell separately, each with its own cover count.' },
    { icon: 'BadgePlus', title: 'Deposits that end no-shows', detail: '$60 a head held at booking and released the moment they sit.' },
    { icon: 'Utensils', title: 'Allergies on the pass', detail: 'The nut allergy from the booking prints on the kitchen ticket.' },
    { icon: 'Ticket', title: 'Buyouts and private events', detail: 'Close the terrace for forty and the widget stops selling it.' },
  ],
  wellness: [
    { icon: 'Repeat2', title: 'Packs, memberships and drop-ins', detail: 'All three on the same calendar, under one guest profile.' },
    { icon: 'CalendarClock', title: 'Retreats on instalments', detail: 'Five days in October, paid in three parts by August.' },
    { icon: 'ListOrdered', title: 'Waitlists that fill themselves', detail: 'A cancellation at 06:10 is filled from the list by 06:11.' },
    { icon: 'Users', title: 'Instructors and their rates', detail: 'Cover a class and the pay follows the person who taught it.' },
  ],
}
