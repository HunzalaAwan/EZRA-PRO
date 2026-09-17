import type { ReactNode } from 'react'

import { AppFrame } from '@/components/marketing/app-frame'
import { BookingWidgetPreview } from '@/components/marketing/booking-widget-preview'
import { HeroConsole } from '@/components/marketing/land/hero-console'
import { HostAppMock } from '@/components/marketing/land/host-app-mock'
import { CalendarIllo, DepositIllo, PayoutIllo, SeatMapIllo } from '@/components/marketing/land/illustrations'
import { InsightCard } from '@/components/marketing/land/insight-card'
import { MiniCalendar } from '@/components/marketing/land/mini-calendar'
import { PayoutMock } from '@/components/marketing/land/payout-mock'
import type { PhotoKey } from '@/components/marketing/story/photos'
import { ChannelMarginMock, ChannelSyncMock, GuestProfileMock, SegmentsMock } from './mocks'

/* ==========================================================================
   What each product page says and shows. Plain data with the graphics as
   ready-made nodes, so the server route can hand it to the client sections.
   Icons are lucide names, resolved in the sections.
   ========================================================================== */

export type ProductKey = 'booking' | 'scheduling' | 'analytics' | 'payments' | 'crm' | 'channels'

export type ProductIcon =
  | 'ShoppingCart'
  | 'CalendarDays'
  | 'ChartSpline'
  | 'CreditCard'
  | 'Users'
  | 'Share2'
  | 'Smartphone'
  | 'CloudRain'
  | 'Wallet'
  | 'FileCheck2'
  | 'Star'
  | 'RefreshCw'
  | 'Repeat2'
  | 'Utensils'
  | 'Check'
  | 'Globe'

export type Panel = 'cloud' | 'honeydew' | 'haze' | 'sunbeam' | 'lavender' | 'seafoam'

export interface Chip {
  icon: ProductIcon
  tone: 'primary' | 'success' | 'ink' | 'warning'
  title: string
  detail: string
}

export interface Point {
  icon: ProductIcon
  title: string
  body: string
}

export interface Row {
  label: string
  title: string
  body: string
  points: [string, string, string]
  panel: Panel
  node: ReactNode
}

export interface ProductContent {
  key: ProductKey
  label: string
  icon: ProductIcon
  badge?: string
  headline: string
  body: string
  promises: [string, string, string]
  proofStat: string
  proofLabel: string
  hero: { panel: Panel; node: ReactNode }
  points: [Point, Point, Point]
  rows: Row[]
  field: { photo: PhotoKey; line: string; chips: [Chip, Chip] }
  /** For metadata. */
  description: string
}

function Framed({ children }: { children: ReactNode }) {
  return <div className="w-full max-w-[24rem] rounded-2xl bg-surface p-5 shadow-[var(--shadow-xl)] ring-1 ring-black/[0.05] sm:p-7">{children}</div>
}

export const PRODUCT_CONTENT: Record<ProductKey, ProductContent> = {
  booking: {
    key: 'booking',
    label: 'Online booking',
    icon: 'ShoppingCart',
    headline: 'A checkout guests actually finish.',
    body: 'Three taps on a phone, with Apple Pay and Google Pay on by default and no account to make. Live availability on every device, deposits and add-ons at the same tap, and it embeds in the site you already have.',
    description: 'Online booking for tours, restaurants, events and classes: a three-tap mobile checkout with Apple Pay and Google Pay, live availability, deposits and add-ons, embedded in your own site.',
    promises: ['Three taps from calendar to paid', 'Apple Pay, Google Pay and card', 'Embeds in the site you already have'],
    proofStat: '+26%',
    proofLabel: 'mobile conversion after switching',
    hero: { panel: 'honeydew', node: <BookingWidgetPreview className="w-full max-w-[23rem]" /> },
    points: [
      { icon: 'ShoppingCart', title: 'Live availability, always', body: 'The widget reads the same seats as your calendar and the marketplaces, so a guest never books a seat that is already gone.' },
      { icon: 'Smartphone', title: 'Built for a phone first', body: 'Most guests book on a phone, on a beach, on one bar of signal. The flow is three taps and it loads in under a second.' },
      { icon: 'CreditCard', title: 'Deposits and add-ons at the same tap', body: 'Hold a deposit, sell the private upgrade, add the photo package, apply the gift card. One screen, one payment.' },
    ],
    rows: [
      {
        label: 'Availability',
        title: 'Every channel, one calendar behind the button.',
        body: 'Your website, Viator, GetYourGuide, the phone and the walk-up at the door all draw from one basket of seats. Sell the last one anywhere and it disappears everywhere.',
        points: ['Month, week and day views on the widget', 'Sold-out slots shown, never bookable', 'Seats held for the length of a checkout'],
        panel: 'cloud',
        node: <MiniCalendar />,
      },
      {
        label: 'Money',
        title: 'Deposits, balances and gift cards, set per product.',
        body: 'Take the whole amount, a deposit, or nothing at all, and collect the balance on the day or a week before. Gift cards and prepaid experiences redeem at the same checkout.',
        points: ['Deposit or full payment, per product', 'Balance collected automatically', 'Gift cards and vouchers redeemed in the flow'],
        panel: 'sunbeam',
        node: (
          <Framed>
            <DepositIllo className="h-auto w-full" />
          </Framed>
        ),
      },
    ],
    field: {
      photo: 'dessertCafe',
      line: 'A booking landed while she was serving. The seat was held, the deposit taken, the reminder scheduled, and nobody at the counter had to touch a thing.',
      chips: [
        { icon: 'ShoppingCart', tone: 'primary', title: 'New booking', detail: 'Tasting flight · Sat 15:00 · 2 seats' },
        { icon: 'CreditCard', tone: 'success', title: 'Deposit held', detail: '$30 · balance on the day' },
      ],
    },
  },

  scheduling: {
    key: 'scheduling',
    label: 'Scheduling & calendar',
    icon: 'CalendarDays',
    headline: 'Every departure, guide and resource on one timeline.',
    body: 'Drag a departure to move it. Assign a guide, a boat or a room and watch double-bookings become impossible. See the whole week at a glance or drop into the day’s manifest.',
    description: 'Scheduling for tours and activities: departures, staff, boats, rooms and equipment on one timeline, with conflicts blocked, weather holds and a manifest on every phone.',
    promises: ['Month, week, day and agenda views', 'Conflicts blocked before they happen', 'Weather holds with one-tap notices'],
    proofStat: '−72%',
    proofLabel: 'time spent on daily scheduling',
    hero: {
      panel: 'cloud',
      node: (
        <AppFrame url="app.ezra.pro/blue-horizon/calendar" className="w-full min-w-0">
          <HeroConsole className="h-[19rem] sm:h-[22rem] lg:h-[23rem]" />
        </AppFrame>
      ),
    },
    points: [
      { icon: 'CalendarDays', title: 'Drag a departure to move it', body: 'Shift a sailing by an hour and every guest is told, every guide re-rostered, every marketplace updated.' },
      { icon: 'Users', title: 'Guides, boats and rooms are resources', body: 'Give each a capacity and a calendar. The same boat cannot leave the slip twice, and the same guide cannot be in two places.' },
      { icon: 'CloudRain', title: 'Weather holds in one tap', body: 'Hold a departure, text every guest, queue the refunds, and move the crew to the next slot without opening a spreadsheet.' },
    ],
    rows: [
      {
        label: 'Inventory',
        title: 'Tables, seats, tickets and rooms are the same thing here.',
        body: 'A round-table floor plan, a boat seat map, a timed-entry ticket and a bookable room are all inventory with a clock on it. Set the capacity once and every channel respects it.',
        points: ['Seat maps, floor plans and timed entry', 'Shared resources across products', 'Overselling stops being something that can happen'],
        panel: 'lavender',
        node: (
          <Framed>
            <SeatMapIllo className="h-auto w-full" />
          </Framed>
        ),
      },
      {
        label: 'The day',
        title: 'The manifest on every phone, with or without signal.',
        body: 'Guides and hosts see today’s list, check guests in, take a walk-up and mark a no-show from the dock or the basement. It syncs the moment the phone finds a bar.',
        points: ['Manifests and rosters on the host app', 'Offline check-in that catches up later', 'Walk-ups paid at the door'],
        panel: 'haze',
        node: <HostAppMock />,
      },
    ],
    field: {
      photo: 'guideGroup',
      line: 'Twenty-three guests across six hotels, sorted by pickup time before the driver left the yard. The English and Spanish groups split at the gate, each with their own guide.',
      chips: [
        { icon: 'Users', tone: 'primary', title: 'Guide roster', detail: 'Mara takes the 09:00 in Spanish' },
        { icon: 'Check', tone: 'success', title: 'Checked in', detail: '21 of 23 · 2 running late' },
      ],
    },
  },

  analytics: {
    key: 'analytics',
    label: 'Analytics',
    icon: 'ChartSpline',
    badge: 'New',
    headline: 'Numbers that tell you what to do next.',
    body: 'Not another dashboard of things you already knew. EZRA reads occupancy by weekday and hour and names the slot to cut, add or reprice, with the dollar impact attached.',
    description: 'Analytics for experience operators: occupancy by weekday and hour, channel mix net of commission, repeat-guest cohorts, and written recommendations with the revenue impact attached.',
    promises: ['Occupancy by weekday and hour', 'Channel mix, net of commission', 'Written insights every Monday'],
    proofStat: '$104k',
    proofLabel: 'added revenue in one season, from one moved slot',
    hero: { panel: 'haze', node: <InsightCard className="w-full max-w-[26rem]" /> },
    points: [
      { icon: 'ChartSpline', title: 'Occupancy, by the hour', body: 'See which slots run full and which run at 30%, then move, merge or reprice them with the impact shown before you decide.' },
      { icon: 'Share2', title: 'Margin per channel', body: 'Marketplaces bring guests and take a quarter of the fare. See what each channel really keeps for you, after commission.' },
      { icon: 'Repeat2', title: 'Cohorts and repeat guests', body: 'Know how many first-timers came back, how soon, and what they booked, so the win-back campaign goes to the right people.' },
    ],
    rows: [
      {
        label: 'Channels',
        title: 'What each channel really pays, after commission.',
        body: 'A Viator booking and a website booking are not worth the same. The channel report shows bookings, fee and what you keep, so you know where to spend the next marketing dollar.',
        points: ['Bookings and net revenue per channel', 'Commission shown, not hidden', 'Direct-booking share over time'],
        panel: 'sunbeam',
        node: <ChannelMarginMock />,
      },
      {
        label: 'Retention',
        title: 'Who comes back, and who might.',
        body: 'Guests are grouped by the month they first booked and followed from there. The ones who came once and never returned become a list you can write to.',
        points: ['Cohort retention by first-booking month', 'Lifetime value per guest', 'Segments built straight from the numbers'],
        panel: 'cloud',
        node: <SegmentsMock />,
      },
    ],
    field: {
      photo: 'storeTablet',
      line: 'The Tuesday midday class ran at 31% for two months. The Monday note said to move it to 17:45. She did, and it fills like Thursday’s now.',
      chips: [
        { icon: 'ChartSpline', tone: 'primary', title: 'Worth doing this week', detail: 'Move Tue 12:00 to 17:45' },
        { icon: 'Wallet', tone: 'success', title: 'Impact', detail: 'About +$1,900 a month' },
      ],
    },
  },

  payments: {
    key: 'payments',
    label: 'Payments & payouts',
    icon: 'CreditCard',
    headline: 'Deposits today, payout tomorrow.',
    body: 'Take a deposit at booking and the balance on the day. Split tips to the crew automatically. Money lands the next business day at a flat 4% rate instead of sitting in someone else’s account for a week.',
    description: 'Payments for tours, restaurants and classes: deposits and balances, next-business-day payouts itemised by departure, tips split automatically, one flat 4% fee.',
    promises: ['Next-business-day payouts', 'One flat 4% booking fee', 'Tips split automatically'],
    proofStat: '1 day',
    proofLabel: 'from a card payment to money in the bank',
    hero: { panel: 'sunbeam', node: <PayoutMock /> },
    points: [
      { icon: 'CreditCard', title: 'Deposits and balances', body: 'Decide per product: everything up front, a deposit now and the rest on the day, or nothing until they arrive.' },
      { icon: 'Wallet', title: 'Paid the next business day', body: 'Card money lands in your account the next business day, itemised by departure, sitting or event, with the fee shown plainly.' },
      { icon: 'Users', title: 'Tips to the crew', body: 'Guests tip at checkout or at the dock. The split goes to the guides on the manifest, and the bookkeeper sees every line.' },
    ],
    rows: [
      {
        label: 'Deposits',
        title: 'Hold a deposit at booking. End the no-show.',
        body: 'A table of four that has paid a deposit turns up. Set the amount per product, remind at 24 hours, and release the seat under your own policy if nobody comes.',
        points: ['Deposit amount per product', 'Reminders by text and email', 'Refund rules you set once'],
        panel: 'honeydew',
        node: (
          <Framed>
            <DepositIllo className="h-auto w-full" />
          </Framed>
        ),
      },
      {
        label: 'Reconciliation',
        title: 'Itemised, so the bookkeeper stops asking.',
        body: 'Every payout lists the departures, sittings and classes inside it, the fee, the refunds and the tips. It exports to your accounting tool in one click.',
        points: ['Line items per payout', 'Refunds and partial refunds tracked', 'Exports to Xero and QuickBooks'],
        panel: 'cloud',
        node: (
          <Framed>
            <PayoutIllo className="h-auto w-full" />
          </Framed>
        ),
      },
    ],
    field: {
      photo: 'cafeSmile',
      line: 'Two sittings, forty covers, one payout on Thursday morning, itemised by table. The tips reached the four people who earned them before the shift ended.',
      chips: [
        { icon: 'Wallet', tone: 'ink', title: 'Payout tomorrow', detail: '$6,240.00 · Bank of Maui ····4412' },
        { icon: 'Users', tone: 'success', title: 'Tips split', detail: '$312 to 4 people' },
      ],
    },
  },

  crm: {
    key: 'crm',
    label: 'Guest CRM',
    icon: 'Users',
    headline: 'Know your guests before they arrive.',
    body: 'Every guest carries their history: trips taken, dietary notes, certifications, waivers and reviews. Turn a first-timer into a family that comes back year after year.',
    description: 'A guest CRM for experience operators: one profile per guest with trip history, waivers, dietary notes and reviews, plus segments for win-back and VIP campaigns.',
    promises: ['Trip history on every booking', 'Waivers signed before departure', 'Segments for win-back and VIPs'],
    proofStat: '100%',
    proofLabel: 'waiver completion before arrival',
    hero: { panel: 'cloud', node: <GuestProfileMock /> },
    points: [
      { icon: 'Users', title: 'One profile per guest', body: 'Bookings from the website, Viator and the phone land on the same person. Three trips, one record, no duplicates.' },
      { icon: 'FileCheck2', title: 'Waivers and dietary notes', body: 'Signed on the phone before departure, and on the manifest and the kitchen ticket the moment they matter.' },
      { icon: 'Star', title: 'Reviews, asked at the right moment', body: 'The request goes out the evening after the trip, to the people who had a good one. Ratings go up.' },
    ],
    rows: [
      {
        label: 'Campaigns',
        title: 'Win-back and VIP lists that build themselves.',
        body: 'Guests who came once and not since spring. Guests with three trips or more. Guests who left five stars. Write to each of them with one click, and see who books.',
        points: ['Segments from trips, reviews and waivers', 'Email and text campaigns', 'Bookings attributed to the campaign'],
        panel: 'honeydew',
        node: <SegmentsMock />,
      },
      {
        label: 'The day',
        title: 'The notes reach the host, not just the office.',
        body: 'The nut allergy noted at booking is on the ticket before the amuse-bouche. The child’s age is on the manifest before the life jackets come out.',
        points: ['Notes on the manifest and the host app', 'Certifications checked at check-in', 'Special requests visible to the crew'],
        panel: 'haze',
        node: <HostAppMock />,
      },
    ],
    field: {
      photo: 'waitressOrder',
      line: 'A nut allergy noted at booking reached the pass before the amuse-bouche went out. The guest never had to mention it twice.',
      chips: [
        { icon: 'Utensils', tone: 'warning', title: 'Allergy noted', detail: 'Nut allergy, on the ticket' },
        { icon: 'FileCheck2', tone: 'success', title: 'Waiver signed', detail: 'Three days out, on the phone' },
      ],
    },
  },

  channels: {
    key: 'channels',
    label: 'Channel manager',
    icon: 'Share2',
    headline: 'Marketplaces that never oversell you.',
    body: 'Viator, GetYourGuide and Expedia read the same live availability as your own site. Sell the last seat anywhere and it disappears everywhere, in under a second, with the margin of each channel shown plainly.',
    description: 'A channel manager for tours and activities: two-way sync with Viator, GetYourGuide and Expedia, one inventory with no reconciliation, Google Things to do included, and margin per channel.',
    promises: ['Two-way sync with the big marketplaces', 'One inventory, zero reconciliation', 'Google Things to do included'],
    proofStat: '0',
    proofLabel: 'oversells since launch, across every channel',
    hero: { panel: 'lavender', node: <ChannelSyncMock /> },
    points: [
      { icon: 'Share2', title: 'One basket of seats', body: 'There is one number of seats left, and every channel reads it. No allocations to juggle, no blocks to release at the end of the day.' },
      { icon: 'RefreshCw', title: 'Under a second, both ways', body: 'A sale on Viator closes the seat on your site and on Expedia before the guest has put the phone down. Cancellations reopen it just as fast.' },
      { icon: 'ChartSpline', title: 'Margin per channel', body: 'Marketplaces take a quarter of the fare. See what each one keeps for you, and watch the direct share grow.' },
    ],
    rows: [
      {
        label: 'Sync',
        title: 'Every channel writes to one calendar.',
        body: 'Connect a marketplace once and its bookings land on the same departures as your own, with the guest, the seats and the commission recorded. Nothing to copy across, ever.',
        points: ['Viator, GetYourGuide, Expedia and more', 'Bookings, changes and cancellations both ways', 'Google Things to do listing included free'],
        panel: 'cloud',
        node: (
          <Framed>
            <CalendarIllo className="h-auto w-full" />
          </Framed>
        ),
      },
      {
        label: 'Margin',
        title: 'See what each channel keeps for you.',
        body: 'The channel report lists bookings, the fee and what you keep, month by month, so the marketplaces earn their commission and the website earns its place.',
        points: ['Net revenue per channel', 'Commission shown, not hidden', 'Direct-booking share over time'],
        panel: 'sunbeam',
        node: <ChannelMarginMock />,
      },
    ],
    field: {
      photo: 'groupPond',
      line: 'Viator sold the last two seats on tomorrow’s walk at half past four in the morning. The website showed sold out by the time the office opened.',
      chips: [
        { icon: 'Globe', tone: 'primary', title: 'Viator', detail: '2 seats sold · 04:31' },
        { icon: 'RefreshCw', tone: 'success', title: 'Website updated', detail: '0.4 seconds later' },
      ],
    },
  },
}

export const PRODUCT_KEYS = Object.keys(PRODUCT_CONTENT) as ProductKey[]
