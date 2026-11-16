import type { NicheLong } from '@/content/booking-software'

const long: NicheLong = {
  things: 'kayaks and boards',
  introTitle: 'What kayak rental software does',
  intro: [
    'Kayak rental software takes bookings for your kayaks, canoes and paddleboards online, counts how many of each are free at every time, and gets the waiver signed before anyone reaches the water. It replaces the paper sign-up sheet, the clipboard of waivers and the call-ahead line on busy weekends.',
    'In EZRA Pro, a kayak rental is set up as a Rental. Singles, tandems, canoes and boards are each an item with their own stock and how many people they fit. A family can book two tandems and a board in one go, and each one sells out on its own.',
    'At the launch, Check-in finds each party by the QR code on their ticket or their confirmation code, and shows whether every waiver is signed. Walk-ups are sold on a phone from the same stock, and when the wind picks up you can hold or move the day’s bookings together.',
  ],
  fits: [
    { label: 'Kayak and canoe rentals on lakes and rivers', hint: 'By the hour or the half day' },
    { label: 'Paddleboard rentals at the beach', hint: 'Lots of walk-ups when the sun is out' },
    { label: 'River outfitters', hint: 'Rentals next to guided trips' },
    { label: 'Parks and campgrounds with a boat shed', hint: 'Guests book ahead or on the day' },
    { label: 'Watersports centres', hint: 'Kayaks, boards and lessons on one page' },
  ],
  day: [
    { time: '07:00', title: 'Check the conditions', body: 'Open Weather & conditions. The week’s time slots are listed with their guests and the forecast, so you can see early if the afternoon looks windy.' },
    { time: '09:45', title: 'Check in the 10:00 group', body: 'Scan each party’s ticket. Check-in shows how many waivers are signed. One guest still has to sign, so they do it on their phone before launch.' },
    { time: '11:30', title: 'Walk-ups at the dock', body: 'The sun is out and people are queueing. Sell singles and boards from the Walk-ins desk on a phone, by card or cash, from the same stock.' },
    { time: '14:00', title: 'Wind picks up', body: 'Select the afternoon’s time slots on Weather & conditions, hold or move them together, and send one message to every guest.' },
    { time: '17:00', title: 'Close the day', body: 'Mark a cracked kayak out of service with a note, see who was a no-show, and check tomorrow’s bookings before you lock the shed.' },
  ],
  lookFor: [
    { title: 'Singles, tandems and boards counted apart', body: 'A tandem fits two and a board fits one, and they run out at different times. In EZRA Pro each is an item with its own stock and people per item, under Items and prices.' },
    { title: 'Waivers signed before launch', body: 'Paper waivers slow the line and get wet. Look for waivers signed online, either by the booker for the whole group or by each guest, with Check-in showing who still has to sign.' },
    { title: 'Fast check-in at the dock', body: 'Check-in should take seconds. Scan the QR code on the ticket or type the confirmation code, see the party and its waivers, and check them in, or mark them as a no-show.' },
    { title: 'Walk-up sales on a phone', body: 'Good weather brings walk-ups. The Walk-ins desk runs on a phone, takes card or cash, and sells from the same stock as your booking page, so nothing is sold twice.' },
    { title: 'Weather tools', body: 'Wind and storms close the water with little warning. Weather & conditions lets you hold, move or cancel a day’s time slots together, with one message to every guest booked.' },
    { title: 'Guest questions that keep people safe', body: 'Ask each guest’s swimming ability, or anything else you need to know, at checkout. The answers sit on the guest list before the group arrives.' },
  ],
  pricing: [
    'Most kayak rentals close for part of the year. EZRA Pro has no monthly fee, so the months the water is closed cost nothing at all.',
    'In season you pay the same percentage on every booking, from a one-hour board to a family’s half day. You choose whether you pay it or add it to the guest’s total as a booking fee.',
  ],
  faqs: [
    { q: 'Can a family book different boats in one booking?', a: 'Yes. Guests pick two tandems, a single and a board on one page. Each comes out of its own stock, and the booking counts how many people each one fits.' },
    { q: 'What if a guest hasn’t signed the waiver?', a: 'Check-in shows how many waivers are still to sign, so the guest can sign on their phone before launch. If they signed on paper, you can still let them check in.' },
    { q: 'Can I keep time between rentals to rinse and check boats?', a: 'Yes. Set a gap between rentals, and the next booking can only start once that time has passed.' },
    { q: 'How do I move from the system I use now?', a: 'Send us an export of your boats, boards, prices, guests and future bookings. We set it all up in EZRA Pro for free, usually in a few days.' },
  ],
}

export default long
