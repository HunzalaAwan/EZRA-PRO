import type { NicheLong } from '@/content/booking-software'

const long: NicheLong = {
  things: 'carts',
  introTitle: 'What golf cart rental software does',
  intro: [
    'Golf cart rental software books carts by the day or the week, keeps count of which carts are free on which dates, and takes payment, a licence check and a deposit before the guest arrives. In beach towns and resort areas, where most rentals run for days, the hard part is overlapping dates, not hours.',
    'In EZRA Pro, a golf cart rental is set up as a Rental. Each cart size, like 4-seat and 6-seat, gets its own stock, a daily price and an optional cap so a week tops out at one price. You set pick-up and return times, the fewest and most days, and a refundable deposit per cart.',
    'On pick-up day, the Rentals screen lists every cart going out, coming back and still out from earlier in the week. Tick the three checks, press Hand out, and the cart is out until its return date. When it comes back, press Take back and it is free for the next guest.',
  ],
  fits: [
    { label: 'Beach town cart rentals', hint: 'Weekly rentals for holiday homes' },
    { label: 'Resorts and holiday parks', hint: 'Carts for guests staying several nights' },
    { label: 'Island and lake communities', hint: 'Where carts are how people get around' },
    { label: 'Rental lots with several sizes', hint: '4-seat, 6-seat and lifted carts' },
    { label: 'Businesses with more than one lot', hint: 'Each location with its own hours' },
  ],
  day: [
    { time: '08:00', title: 'See the changeover', body: 'Saturday is changeover day. The Rentals screen shows six carts due back at 10:00 and eight going out from 11:00, with any late ones marked Late.' },
    { time: '10:00', title: 'Carts come back', body: 'Press Take back on each cart as it returns. A bent bumper? Keep part of that deposit and write a note. The rest go straight back into stock.' },
    { time: '11:00', title: 'A family picks up', body: 'Their licence was entered at checkout and the waiver signed online. Check the driver’s ID, tick the three checks and press Hand out. The cart is theirs until next Saturday.' },
    { time: '13:00', title: 'A walk-in at the lot', body: 'Someone needs a cart for two days. Sell it from the Walk-ins desk, by card or cash, from the same stock as the booking page.' },
    { time: '17:00', title: 'Plan the week', body: 'One cart needs a new battery, so mark it out of service with a note. It stops showing for those dates, and every other booking for the week stays as it is.' },
  ],
  lookFor: [
    { title: 'Days, not hours', body: 'Most golf cart rentals last several days. Look for a price per day with pick-up and return times, and the fewest and most days a guest can book, so a one-night booking can’t block your best week.' },
    { title: 'A weekly price cap', body: 'Guests staying a week expect one weekly price. In EZRA Pro each cart size can have a cap, the most one cart costs per rental, so a week tops out at your weekly price automatically.' },
    { title: 'Overlap-aware stock', body: 'A cart out Tuesday to Saturday can’t also go out Thursday. Each cart size has its own count, and the booking page only offers dates where a cart is free for the whole stay.' },
    { title: 'Licence and age checks', body: 'Many towns treat carts like cars on the road. Ask for a driver’s licence at checkout, set a minimum age on the rental, and have the waiver signed online before pick-up.' },
    { title: 'Deposits for long rentals', body: 'A week is a long time for a cart to be out. Hold a refundable deposit per cart at checkout, and keep part of it with a note if the cart comes back damaged.' },
    { title: 'Reminders before pick-up', body: 'Long-stay guests book weeks ahead and forget the details. A reminder flow sends the pick-up time, the lot address and what to bring the day before the rental starts.' },
  ],
  pricing: [
    'Golf cart rentals follow the holiday calendar: full in summer and on holiday weekends, quiet in between. EZRA Pro has no monthly fee, so the quiet months cost nothing.',
    'On every booking you pay the same percentage of what the guest pays, whether it is a two-day rental or a capped week. You choose whether you pay it or add it to the guest’s total as a booking fee.',
  ],
  faqs: [
    { q: 'Can guests choose the cart size?', a: 'Yes. Each size, like 4-seat or 6-seat, is its own item with its own stock, price and deposit. Guests see only the sizes free for all of their dates.' },
    { q: 'What happens when a cart comes back late?', a: 'It shows as Late on the Rentals screen so you can call the guest. A late return fee per hour is set on the rental, and guests see it before they book.' },
    { q: 'Can holiday-home owners or hotels send me guests?', a: 'Yes. Make a promo code for each partner to hand to their guests. Each code can take money or a percent off, and you can stop it at any time.' },
    { q: 'Can you bring my carts and bookings over from another system?', a: 'Yes. Send us an export of your carts, prices, guests and future bookings. We set them up in EZRA Pro for free, and you look over a test booking before you switch.' },
  ],
}

export default long
