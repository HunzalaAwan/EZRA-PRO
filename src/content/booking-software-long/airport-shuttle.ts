import type { NicheLong } from '@/content/booking-software'

const long: NicheLong = {
  things: 'rides',
  introTitle: 'What airport shuttle software does',
  intro: [
    'Airport shuttle software takes ride bookings online, prices each one from where it starts, where it ends and how many people are coming, and gets every ride to a driver in time. It replaces quoting by email, the whiteboard in the office and the late-night calls about who is collecting which flight.',
    'In EZRA Pro, a shuttle is set up as a Rental charged by trip, or per seat for shared runs. You add the areas you drive between, like the airport and the hotel zones, and your vehicles, with how many passengers and suitcases each one takes. The price table does the rest, and a group too big for your vehicles turns into a request.',
    'Every booked ride lands on the Pickups board with its pickup, its drop-off, its passengers and its bags, and the flight number when you ask for one. You pick a driver and a vehicle for each one, and the driver moves it along from On the way to Picked up to Done.',
  ],
  fits: [
    { label: 'Airport shuttle and transfer companies', hint: 'Private rides and shared seats to and from the airport' },
    { label: 'Private car services', hint: 'A vehicle and driver from one address to another' },
    { label: 'Hotel and resort shuttles', hint: 'Scheduled runs between the airport and your area' },
    { label: 'Event and wedding shuttles', hint: 'Shared seats on set runs between venues' },
    { label: 'Tour operators adding rides', hint: 'Pickups sold next to the tours guests book' },
  ],
  day: [
    { time: '06:00', title: 'Check the day', body: 'Open Pickups. The day’s rides are in time order, with passengers, suitcases and the first pickup at the top. Print the sheet if a driver wants paper.' },
    { time: '09:30', title: 'The first shared run', body: 'The Shuttle runs tab lists who to collect on the 09:30 run to the hotel zone, at which stop, with seats left on board.' },
    { time: '11:15', title: 'An airport pickup', body: 'The driver checks the flight number on the ride, presses On the way, then Picked up when the guests are in.' },
    { time: '14:05', title: 'A ride with no driver', body: 'The board counts rides still without a driver. Pick one from the list on the ride, and a vehicle, so nothing is left to the last minute.' },
    { time: '17:40', title: 'A ride to the airport', body: 'The guest picked a pickup time that leaves room for the drive. The driver collects them at the hotel and presses Done at the terminal.' },
  ],
  lookFor: [
    { title: 'Prices by area and vehicle', body: 'Quoting every ride by hand does not scale. Look for a price table you fill once: each area, each vehicle size. In EZRA Pro the vehicle is chosen from the passengers and suitcases, and bigger groups get a bigger vehicle or more than one.' },
    { title: 'Flight numbers on airport rides', body: 'Airport pickups depend on the flight, not the clock. Checkout should ask for the flight number, so the driver can check it before leaving. Guests can buy extra waiting time if they expect a slow passport line.' },
    { title: 'Shared seats on set runs', body: 'Shared shuttles only pay when the seats fill. Sell seats on set run times between your areas, with tickets like adult and child, and choose which tickets take a seat. Seats are counted on each run.' },
    { title: 'A board for drivers', body: 'Your team needs one list, not ten messages. The Pickups board shows every ride for the next 7 days, by run, with the driver and vehicle on each, and a button to move each ride along.' },
    { title: 'Changes without phone calls', body: 'Plans change. Guests can change a ride from their booking page under your rules, or you change it on the booking, and EZRA Pro checks a vehicle is free at the new time.' },
    { title: 'Sales at the desk', body: 'Not every rider books ahead. Sell a ride at a hotel desk or airport counter from the Walk-ins desk, from the same vehicles as your online bookings, paid by card or cash.' },
  ],
  pricing: [
    'Ride prices are often small and the volume is high, so a percentage keeps the bill in line with what you actually carry. There is no monthly fee, so a month with no rides costs nothing.',
    'A private transfer and a single shared seat pay the same percentage. You choose whether you pay it or add it to the rider’s total as a booking fee.',
  ],
  faqs: [
    { q: 'What happens when a guest’s plans change?', a: 'The guest can change the ride on their booking page under your rules, or you can change it on the booking. EZRA Pro checks that a vehicle is free at the new time.' },
    { q: 'Can riders add a child seat or extra waiting time?', a: 'Yes. Add extras with their own price, like a child seat or extra waiting time in 30-minute blocks. Riders pick them at checkout and they show on the ride.' },
    { q: 'Can I drive between hotels, not just the airport?', a: 'Yes. Rides go from any pickup area to any drop-off area you serve: the airport, hotel zones, the port, downtown. A ride costs the higher of its two areas.' },
    { q: 'Can you move my rides over from my current system?', a: 'Yes. Send us an export of your areas, prices, vehicles and future rides. We set them up in EZRA Pro for free, usually over a weekend, and your booking link keeps working until you switch.' },
  ],
}

export default long
