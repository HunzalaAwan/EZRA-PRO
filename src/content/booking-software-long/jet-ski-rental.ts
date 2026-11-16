import type { NicheLong } from '@/content/booking-software'

const long: NicheLong = {
  things: 'jet skis',
  introTitle: 'What jet ski rental software does',
  intro: [
    'Jet ski rental software sells short rides online, counts how many skis are free each half hour, and gets the paperwork done before guests reach the beach. Waivers, boater cards, ages and damage deposits are the slow part of a jet ski dock, and good software moves all of it to checkout.',
    'In EZRA Pro, a jet ski rental is set up as a Rental. You add your skis, how many you own and how many riders fit on each. Guests pick a length, like 30 minutes or an hour, and book skis, not seats. Every rider signs the waiver online, and the booker confirms the driver holds a boater card.',
    'On the day, Check-in shows each party with its waivers, deposit and notes. Scan the guest’s QR code or type their code, and the party comes up ready to go. A party still missing a signature gets the waiver link again from the same screen.',
  ],
  fits: [
    { label: 'Beach and lake jet ski rentals', hint: 'Short rides, many per day' },
    { label: 'Watersports centres', hint: 'Skis next to paddleboards, tubes and parasailing' },
    { label: 'Hotel and resort beach desks', hint: 'Guests book from the room or at the desk' },
    { label: 'Guided jet ski tours', hint: 'Set start times with a guide out front' },
    { label: 'Seasonal operators', hint: 'Busy summers, closed winters' },
  ],
  day: [
    { time: '08:30', title: 'Fuel and check the skis', body: 'One ski needs an impeller check, so you mark it out of service with a note. Its rides stop showing as available straight away.' },
    { time: '10:00', title: 'The first wave arrives', body: 'Three parties booked for 10:00. Scan each code on Check-in. Waivers are signed, boater cards confirmed, deposits held. Check them in and send them to the briefing.' },
    { time: '10:15', title: 'Briefing, then the water', body: 'On the Rentals screen, tick safety briefing done, ID or licence checked and deposit held, then press Hand out. Each ski shows as out until its ride ends.' },
    { time: '13:00', title: 'Wind picks up', body: 'Open Weather, select the afternoon rides and hold or move them in one go. Guests get one message with a free move, a credit or a refund.' },
    { time: '16:30', title: 'Last skis back', body: 'Press Take back on each ski. A cracked hull panel? Keep part of that deposit and write why. The ski goes to repair, and tomorrow’s first wave is ready on Check-in.' },
  ],
  lookFor: [
    { title: 'A waiver for every rider', body: 'The driver is not the only person at risk. Look for waivers each guest signs before arrival, not just the booker. In EZRA Pro you choose who signs, and Check-in shows how many are still to sign.' },
    { title: 'Riders per ski', body: 'A family of four may need two skis, not four. Set riders per ski once, and guests book skis while the rider count follows. Your stock stays a count of skis, which is what you really own.' },
    { title: 'Short lengths that fill the day', body: 'Jet skis sell in short blocks: 30 minutes, one hour, two hours. Each length is its own price, and buffer minutes between rides leave time to refuel and look the ski over.' },
    { title: 'Age and licence rules', body: 'Set a minimum age on the rental so guests see it before they pay. Turn on the boater card question at checkout, and the dock still checks the ID before pressing Hand out.' },
    { title: 'A fast check-in', body: 'Rides start on the hour and everyone arrives at once. Check-in reads the guest’s QR code or confirmation code, then shows the party size, waivers, balance and notes, so the line keeps moving.' },
    { title: 'Weather in one move', body: 'Wind and storms cancel jet ski rides more than anything else. The Weather screen lists the week’s rides with the forecast, and you hold, move or cancel the ones at risk together, with one message.' },
  ],
  pricing: [
    'Jet ski rentals are busy for a few months and quiet or closed for the rest. EZRA Pro has no monthly fee, so a month with the skis on trailers costs nothing.',
    'In season you pay the same percentage on each booking, whether it is a half-hour ride or a full afternoon on two skis. You choose whether you pay it or the guest sees it as a booking fee at checkout.',
  ],
  faqs: [
    { q: 'Can guests book several skis in one booking?', a: 'Yes. Guests choose how many skis they want for the same time, up to the number free. Riders per ski sets how many people that covers, and the deposit is held per ski.' },
    { q: 'Can a guest check in without a signed waiver?', a: 'Check-in shows how many waivers are still to sign. You can send the link again, or, if the guest signed on paper at the dock, allow check-in and note it.' },
    { q: 'How do I handle a fuel charge?', a: 'Choose a fuel rule on the rental: fuel included, return it full, or fuel charged. Guests see the rule before they book, so nobody is surprised at the dock.' },
    { q: 'Can you move my bookings and waivers from another system?', a: 'Send us an export of your skis, prices, guests and future bookings. We set them up in EZRA Pro for free, and you check a test booking before you switch your booking button.' },
  ],
}

export default long
