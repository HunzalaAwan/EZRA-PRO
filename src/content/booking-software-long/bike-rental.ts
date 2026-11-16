import type { NicheLong } from '@/content/booking-software'

const long: NicheLong = {
  things: 'bikes',
  introTitle: 'What bike rental software does',
  intro: [
    'Bike rental software takes bookings for your bikes online, keeps count of every model and size, and takes payment before the rider walks in. It replaces the clipboard by the door, the spreadsheet of who has which bike and the guesswork about whether a medium e-bike is free on Saturday.',
    'In EZRA Pro, a bike shop is set up as a Rental. Each model and size is its own item, with how many you own and a price per hour or per day. City bikes, e-bikes, kids bikes and tandems all sit under one booking link, and each sells out on its own.',
    'Online bookings and counter sales take from the same count. On the day, the Rentals screen shows what is out, what is due back and what is late, with one button to hand bikes out and one to take them back. Bikes in for repair stop selling until you put them back.',
  ],
  fits: [
    { label: 'City bike and e-bike rental shops', hint: 'By the hour, half day or full day' },
    { label: 'Mountain bike rentals at trail heads', hint: 'Sizes and frames counted one by one' },
    { label: 'Beach and boardwalk rentals', hint: 'Lots of walk-ups on sunny days' },
    { label: 'Hotels and campsites with a bike fleet', hint: 'Guests book ahead or at the desk' },
    { label: 'Shops with more than one pick-up point', hint: 'Each location with its own hours' },
  ],
  day: [
    { time: '08:00', title: 'Check the day', body: 'Open the Rentals screen. You see every booking going out today, the sizes each rider needs and how many of each model are left.' },
    { time: '09:30', title: 'Hand out the first bikes', body: 'A family of four arrives. Their heights were taken at checkout, so the frames are ready. Tick the checks, press Hand out, and the bikes show as out.' },
    { time: '11:00', title: 'A walk-up at the counter', body: 'Two cyclists walk in. Sell two e-bikes from the Walk-ins desk, by card or cash. They come out of the same stock as online bookings.' },
    { time: '15:00', title: 'A late return', body: 'One booking shows as Late on the board, so you call the rider. When the bikes are back, press Take back and they are free for the next rental.' },
    { time: '18:00', title: 'Close the day', body: 'A bent wheel? Keep part of that deposit with a note, and mark the bike out of service. Then check the cash drawer and tomorrow’s bookings.' },
  ],
  lookFor: [
    { title: 'Stock by model and size', body: 'A shop with eight medium e-bikes and six large ones needs the software to count them apart. In EZRA Pro each model and size is an item with its own stock, under Items and prices, so one can sell out while the other stays open.' },
    { title: 'Hourly, daily and multi-day prices', body: 'Riders want two hours, a half day or a whole week. Look for a price per hour and per day, the fewest and most days, and pick-up and return times for longer rentals.' },
    { title: 'Counter sales from the same stock', body: 'Walk-ups are a big part of bike rental. The Walk-ins desk sells from the same count as your booking page, takes card or cash, and reports walk-in takings on their own.' },
    { title: 'Rider details before they arrive', body: 'Ask each rider’s height, and helmet size if you hand out helmets, at checkout. Fitting goes faster when the right frames are already lined up.' },
    { title: 'Extras like helmets and locks', body: 'Helmets, locks, child seats and baskets should be added at checkout, free or at a price, so they are packed before the rider gets there.' },
    { title: 'Repairs that stop sales', body: 'Flat tyres and worn brakes happen daily. Under Stock and repairs, mark a bike out of service with a note and it stops showing as available until it is fixed.' },
  ],
  pricing: [
    'Bike rental is busy in summer and slow in winter, so a fixed monthly fee costs the most when you earn the least. EZRA Pro has no monthly fee. A quiet month costs only the percentage on the few rentals you take.',
    'Walk-in sales and online bookings are charged the same way, a percentage of each booking. You choose whether you pay it or add it to the rider’s total as a booking fee.',
  ],
  faqs: [
    { q: 'Can riders book bikes of different sizes in one booking?', a: 'Yes. A family can pick two medium e-bikes, one large and a kids bike in a single booking. Each comes out of its own stock, and each rider’s height is asked at checkout.' },
    { q: 'Can I take a deposit on e-bikes?', a: 'Yes. Set a security deposit per item. It is held at pick-up and given back on return, or you keep part of it with a note if a bike comes back damaged.' },
    { q: 'Can I sell gift cards for bike rentals?', a: 'Yes. Gift cards sell on your booking page all year, and whoever gets one picks the day and the bike.' },
    { q: 'How do I move from the system I use now?', a: 'Send us an export of your bikes, prices, customers and future bookings. We set it all up in EZRA Pro for free, and you switch the booking button on your site when you are ready.' },
  ],
}

export default long
