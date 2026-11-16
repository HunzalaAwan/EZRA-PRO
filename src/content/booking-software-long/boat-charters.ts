import type { NicheLong } from '@/content/booking-software'

const long: NicheLong = {
  things: 'trips',
  introTitle: 'What boat charter software does',
  intro: [
    'Boat charter software sells your trips online at a price for the whole group, takes a deposit to hold the date, collects the rest before you sail and keeps the calendar honest. It replaces the back-and-forth by email, the deposit chased by phone and the notebook of who is on board.',
    'In EZRA Pro, a charter is set up as an Activity or tour, then Private. Each time books one group, up to the most guests you allow, at one group price. Sell set lengths like a half day, a full day or a sunset sail, each at its own price, with extra spots, tackle or lunch on top.',
    'Bookings show on the Calendar with the deposit or full payment beside them. Requests for custom trips wait in Custom requests until you send a quote, and the guest list for each trip shows who is coming and who has signed the waiver.',
  ],
  fits: [
    { label: 'Fishing charters', hint: 'Inshore, offshore and half-day trips' },
    { label: 'Sailing and catamaran trips', hint: 'Day sails, sunset sails and private hire' },
    { label: 'Yacht charters', hint: 'Bigger groups, deposits and custom quotes' },
    { label: 'Snorkel and dive boats', hint: 'Private trips next to shared ones' },
    { label: 'Party and event boats', hint: 'Birthdays, weddings and company outings' },
  ],
  day: [
    { time: '05:30', title: 'Check the weather', body: 'Open Weather & conditions. If the wind is up, put the morning trip on hold or move it, with one message to every guest on board.' },
    { time: '06:30', title: 'Check the guest list', body: 'The guest list for the 07:00 half day shows each guest, the crew on the trip and whether the waiver is signed.' },
    { time: '06:50', title: 'Guests arrive', body: 'Scan the code on each guest’s ticket, or type the confirmation code, to check them in. The balance was already charged to the card saved at checkout.' },
    { time: '13:00', title: 'A request comes in', body: 'A group of twelve wants a private sunset sail next month. Open Custom requests and send a quote. They pay the deposit from the link.' },
    { time: '17:00', title: 'Close the day', body: 'Look over the week on the Calendar: which trips are paid, which still owe a balance and which dates are open to sell.' },
  ],
  lookFor: [
    { title: 'A price for the whole group', body: 'Charters sell the boat, not seats. Look for a private booking type that takes one group per time at one price, up to the most guests you allow, with extra spots at a set price above a base number.' },
    { title: 'Deposits and the balance', body: 'Big trips need a deposit to hold the date. In EZRA Pro the deposit can be a share of the total, an amount per guest or an amount per booking, and the rest is charged to the saved card before the trip.' },
    { title: 'Request to book and quotes', body: 'Not every trip fits a fixed menu. Turn on request to book so guests send the date and group they want, then confirm it, or send a custom quote they pay online from a link.' },
    { title: 'Weather calls in one place', body: 'Early-morning calls need to reach everyone at once. Weather & conditions lets you hold, cancel or move the week’s trips together, with one message to every guest booked.' },
    { title: 'Waivers and a guest list', body: 'Captains want to know who is on board. Have the waiver signed online by the booker or by every guest, and check guests in from the guest list or by scanning their ticket.' },
    { title: 'Gift cards and seasons', body: 'Charters make good gifts, and peak months sell for more. Sell gift cards on your booking page, and add a season or date prices so holidays and summer carry their own rate.' },
  ],
  pricing: [
    'Charter prices are high and the number of trips is small, so a fixed monthly fee weighs most in the months the boat is out of the water. There is no monthly fee. A month in dry dock costs nothing.',
    'A half-day fishing trip and a full-day yacht charter pay the same percentage. You choose whether you pay it or add it to the guest’s total as a booking fee.',
  ],
  faqs: [
    { q: 'When is the balance charged?', a: 'You choose: on the day, or a set number of days before the trip. The balance is charged to the card the guest saved at checkout, and guests can choose to pay in full at checkout instead.' },
    { q: 'Can I put a trip on hold for the weather?', a: 'Yes. Weather & conditions shows the week’s trips with guests on them. Hold, cancel or move them together, and every guest gets one message telling them what happens next.' },
    { q: 'Can I add crew to each trip?', a: 'Yes. Assign team members to each trip. The guest list for the day shows every trip, its crew, its guests and who has checked in.' },
    { q: 'Can you bring over my bookings from my current system?', a: 'Yes. Send us an export of your trips, prices, guests and future bookings, deposits included. We set them up in EZRA Pro for free, usually over a weekend.' },
  ],
}

export default long
