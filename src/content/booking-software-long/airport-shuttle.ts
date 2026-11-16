import type { NicheLong } from '@/content/booking-software'

const long: NicheLong = {
  things: 'rides',
  introTitle: 'What airport shuttle software does',
  intro: [
    'Airport shuttle software takes ride bookings online, prices each one from where it starts, where it ends and how many people are coming, and gets every ride to a driver in time. It replaces quoting by email, the whiteboard in the office and the late-night calls about who is collecting which flight.',
    'In EZRA Pro, a shuttle is set up as a Rental with a driver. You add your airport, the zones you drive to and your vehicles, with how many passengers and suitcases each one takes. Then you choose how you charge: by trip, by the hour, or by the seat on shared runs. The price table does the rest, and a group too big for your vehicles turns into a request.',
    'Every booked ride lands on the Pickups board with its flight, its passengers and its bags. You pick a driver and a vehicle for each one, and the driver moves it along from On the way to Picked up to Done.',
  ],
  fits: [
    { label: 'Airport shuttle and transfer companies', hint: 'Private rides and shared seats from one airport' },
    { label: 'Private car and chauffeur services', hint: 'A vehicle and driver by the trip or the hour' },
    { label: 'Hotel and resort shuttles', hint: 'Scheduled runs between the airport and your zone' },
    { label: 'Ferry port and train station transfers', hint: 'Ferry names or train numbers in place of flights' },
    { label: 'Tour operators adding rides', hint: 'Pickups sold next to the tours guests book' },
  ],
  day: [
    { time: '06:00', title: 'Check the day', body: 'Open Pickups. The day’s rides are split into arrivals and departures, with passengers, suitcases and the first pickup at the top. Print the sheet if a driver wants paper.' },
    { time: '09:30', title: 'The first shared run', body: 'The Shuttle runs tab lists who to collect on the 09:30 run to the hotel zone, at which stop, with seats left on board.' },
    { time: '11:15', title: 'An arrival', body: 'The driver presses On the way, then Picked up when the guests are in. The flight number is on the ride, and the meeting point was on the guest’s confirmation.' },
    { time: '14:05', title: 'A ride with no driver', body: 'The board counts rides still without a driver. Pick one from the list on the ride, and a vehicle, so nothing is left to the last minute.' },
    { time: '17:40', title: 'A departure', body: 'The pickup time was worked out from the flight time, less the time you want guests at the airport, less the drive. The driver presses Done at the terminal.' },
  ],
  lookFor: [
    { title: 'Prices by zone and vehicle', body: 'Quoting every ride by hand does not scale. Look for a price table you fill once: each zone, each vehicle size. In EZRA Pro the vehicle is chosen from the passengers and suitcases, and bigger groups get a bigger vehicle or more than one.' },
    { title: 'Flight numbers and free waiting', body: 'Arrivals depend on the flight, not the clock. Checkout should ask for the flight number and time, and give a free wait after landing. Guests can buy extra waiting time if they expect a slow passport line.' },
    { title: 'Shared seats on set runs', body: 'Shared shuttles only pay when the seats fill. Sell seats on set run times each way, with tickets like adult and child, and choose which tickets take a seat. Seats are counted on each run.' },
    { title: 'A board for drivers', body: 'Your team needs one list, not ten messages. The Pickups board shows every ride for the next 7 days, by run, with the driver and vehicle on each, and a button to move each ride along.' },
    { title: 'Changes that redo the ride', body: 'Flights change. When a guest changes their flight on their booking page, or you change it on the booking, EZRA Pro works out the new pickup time again and checks the vehicles are free.' },
    { title: 'Sales at the desk', body: 'Not every rider books ahead. Sell a ride at a hotel desk or airport counter from the Walk-ins desk, from the same vehicles as your online bookings, paid by card or cash.' },
  ],
  pricing: [
    'Ride prices are often small and the volume is high, so a percentage keeps the bill in line with what you actually carry. There is no monthly fee, so a month with no rides costs nothing.',
    'A private transfer and a single shared seat pay the same percentage. You choose whether you pay it or add it to the rider’s total as a booking fee.',
  ],
  faqs: [
    { q: 'What happens when a guest’s flight changes?', a: 'The guest can change the flight on their booking page, or you can change it on the booking. EZRA Pro works out the new pickup time again and checks that a vehicle is free at the new time.' },
    { q: 'Can riders add a child seat or extra waiting time?', a: 'Yes. Add extras with their own price, like a child seat or extra waiting time in 30-minute blocks past the free wait. Riders pick them at checkout and they show on the ride.' },
    { q: 'Can I run transfers from a ferry port or train station?', a: 'Yes. Set where rides start or end as an airport, a port, a station or somewhere else. Checkout then asks for the ferry name, the train or bus number, or a reference.' },
    { q: 'Can you move my rides over from my current system?', a: 'Yes. Send us an export of your zones, prices, vehicles and future rides. We set them up in EZRA Pro for free, usually over a weekend, and your booking link keeps working until you switch.' },
  ],
}

export default long
