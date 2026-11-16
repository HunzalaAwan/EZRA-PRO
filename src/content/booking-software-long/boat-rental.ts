import type { NicheLong } from '@/content/booking-software'

const long: NicheLong = {
  things: 'boats',
  introTitle: 'What boat rental software does',
  intro: [
    'Boat rental software takes bookings for your boats online, keeps count of which boat is out and when it comes back, and takes payment and a deposit before anyone reaches the dock. It replaces the paper calendar, the phone tag and the spreadsheet of who has which pontoon.',
    'In EZRA Pro, a boat rental is set up as a Rental. Each boat type, from pontoons to deck boats to a center console, gets its own stock and its own prices by the hour, half day or full day. When every pontoon is booked from 9 to 1, nobody can book a pontoon for those hours, online or at the counter.',
    'On the day, the Rentals screen shows every boat, who has it and when it is due back, with one button to hand it out and one to take it back. Waivers are signed before arrival, licence details are collected at checkout, and the deposit is already held.',
  ],
  fits: [
    { label: 'Pontoon and party boat rentals', hint: 'Lakes and rivers, by the hour or the day' },
    { label: 'Marinas renting out a small fleet', hint: 'Several boat types under one booking link' },
    { label: 'Yacht and day boat rentals', hint: 'Higher prices, bigger deposits' },
    { label: 'Boat clubs and resorts', hint: 'Guests and members book the same boats' },
    { label: 'Rental shops with more than one dock', hint: 'Each location with its own hours' },
  ],
  day: [
    { time: '07:30', title: 'Check the day', body: 'Open the Rentals screen. Every boat booked today is listed with its time, its guest and whether the waiver is signed.' },
    { time: '09:00', title: 'Hand over the first boats', body: 'Guests arrive with the waiver signed and the deposit held. Tick the safety briefing and licence checks, press Hand out, and the boat shows as out until 13:00.' },
    { time: '11:00', title: 'A walk-up at the dock', body: 'Sell the last free deck boat from the Walk-ins desk. It comes out of the same stock, so it can’t also sell online.' },
    { time: '13:15', title: 'A late return', body: 'Pontoon 1 shows as Late on the board, so you call the guest. When it is back, press Take back. Your buffer time covers fuel and cleaning before the next rental.' },
    { time: '17:30', title: 'Close the day', body: 'Every boat is back. A scraped hull? Keep part of that deposit with a note. Mark the center console in repair, and see what is booked for tomorrow.' },
  ],
  lookFor: [
    { title: 'Stock for each boat type', body: 'The software should know you own three pontoons and one deck boat, and stop selling a type once they are all out. In EZRA Pro each boat type is an item with its own count, under Items and prices.' },
    { title: 'Hours, half days and full days', body: 'Most boat renters sell more than one length. Look for prices by the hour, by the day and set lengths like “Half day, 4 hours” at one price, with weekend and summer prices on top.' },
    { title: 'Deposits that release easily', body: 'A refundable deposit protects you against damage without a fight at the dock. EZRA Pro holds a deposit per boat at checkout and lets you release it, or keep part of it with a note, when the boat is taken back.' },
    { title: 'Licence checks and waivers', body: 'Many states want proof of a boater card before someone drives. Ask for it at checkout, set a minimum age, and have the waiver signed online by the booker or by every guest.' },
    { title: 'Late fees and buffer time', body: 'Boats come back late and need fuel and a clean. Set a late fee per hour and buffer minutes between rentals, so the next booking starts with a ready boat.' },
    { title: 'Weather tools', body: 'When wind or storms close the water, you need to reach everyone fast. Message all of today’s guests from one screen, then move or refund their bookings in a few taps.' },
  ],
  pricing: [
    'Boat rental is seasonal, so a monthly fee hurts most in the months the water is closed. EZRA Pro has no monthly fee. In a winter month with no rentals, the bill is zero.',
    'In summer you pay the same percentage on every booking, whether it is a two-hour pontoon or a full-day yacht. You choose whether you pay it or add it to the guest’s total as a booking fee.',
  ],
  faqs: [
    { q: 'Can guests add extras like tubes, fuel or a cooler?', a: 'Yes. Add extras with their own price and stock, like towables, a cooler or a fuel package. Guests pick them at checkout, and the extra goes out with the boat.' },
    { q: 'How do deposits work?', a: 'Set a refundable deposit per boat. It is taken at checkout with the booking, and you release it or keep part of it when the boat comes back. Guests see the deposit before they pay.' },
    { q: 'Can I take bookings at the dock?', a: 'Yes. The Walk-ins desk sells from the same stock as your booking page, takes payment by card or cash, and shows walk-in takings apart from online bookings.' },
    { q: 'Can I move bookings from my current system?', a: 'Yes. Send us an export of your boats, prices, guests and future bookings. We set them up in EZRA Pro for free, usually over a weekend.' },
  ],
}

export default long
