import type { NicheLong } from '@/content/booking-software'

const long: NicheLong = {
  things: 'ski sets',
  introTitle: 'What ski rental software does',
  intro: [
    'Ski rental software takes bookings for your skis and snowboards online, collects each skier’s sizes before they arrive, and keeps count of every set for every day of the season. It replaces the paper fitting form, the long line at the counter and the spreadsheet of which sets are out for the week.',
    'In EZRA Pro, a ski shop is set up as a Rental. Sport skis, performance skis, snowboards and kids sets are each an item with their own stock and a price per day. Guests choose their days, and each set is counted across every day it is out.',
    'At checkout, each guest gives their height, weight, shoe size and experience level. The night before, it is all on the guest list, so your team can set up the gear before the morning rush. Lessons can be sold next to the rentals, or together with them as a package.',
  ],
  fits: [
    { label: 'Ski and snowboard rental shops', hint: 'By the day, through a whole holiday' },
    { label: 'Shops at the lift and in town', hint: 'Each location with its own hours' },
    { label: 'Ski schools that rent gear', hint: 'Lessons and rentals on one page' },
    { label: 'Hotels and chalets with a ski room', hint: 'Guests book their sets before they travel' },
    { label: 'Cross-country and snowshoe rentals', hint: 'Simple day prices, sizes taken online' },
  ],
  day: [
    { time: 'Night before', title: 'Set up tomorrow', body: 'Open the guest list for tomorrow’s pick-ups. Every skier’s height, weight, shoe size and level is there, so the sets are tuned and lined up.' },
    { time: '08:30', title: 'Hand out the first sets', body: 'A family of four arrives with their sets ready. Tick the checks, press Hand out, and their skis show as out for three days.' },
    { time: '10:00', title: 'Walk-ins from the lift', body: 'A skier walks in without a booking. Sell a set from the Walk-ins desk by card or cash. It comes out of the same stock as online bookings.' },
    { time: '13:00', title: 'Lessons going out', body: 'The beginner lesson meets at the school. Its students were booked on their own or as part of a rental and lesson package.' },
    { time: '17:00', title: 'Returns', body: 'Sets come back at the end of their last day. Press Take back, keep part of a deposit with a note if a base is damaged, and mark skis that need a tune out of service.' },
  ],
  lookFor: [
    { title: 'Sizes taken before arrival', body: 'Fitting is the slowest part of a ski rental. Look for height, weight, shoe size and experience level asked for each guest at checkout. In EZRA Pro these are Guest details, and they appear on the guest list.' },
    { title: 'Multi-day rentals that count every day', body: 'A family renting for five days takes five days of stock. Sell by the day with the fewest and most days and pick-up and return times, so overlapping rentals can’t double-book a set.' },
    { title: 'Stock for every kind of set', body: 'Sport skis, performance skis, snowboards and kids sets each run out at different times. In EZRA Pro each is an item with its own count, under Items and prices.' },
    { title: 'Lessons and packages', body: 'Many skiers want a lesson with their gear. Add a lesson with a level and the days in the course, and bundle it with a rental as a package that books each part at its own times.' },
    { title: 'Peak-week prices', body: 'Holidays and school breaks sell out. Look for a season with its own daily price, or price rules for set dates, so the busiest weeks are priced to match.' },
    { title: 'Counter sales from the same stock', body: 'Skiers still walk in from the lift. The Walk-ins desk sells from the same count as your booking page and takes card or cash, so a set booked online is never handed out twice.' },
  ],
  pricing: [
    'A ski shop earns most of its year in a few months. EZRA Pro has no monthly fee, so the summer costs nothing, and gift cards keep selling on your booking page all year.',
    'In the season you pay the same percentage on every booking, whether it is one day for one skier or a week for a family. You choose whether you pay it or add it to the guest’s total as a booking fee.',
  ],
  faqs: [
    { q: 'Can guests add a helmet to their rental?', a: 'Yes. Add helmets as an extra at checkout, free or at a price, and ask each guest’s helmet size so the right one is ready.' },
    { q: 'Can I sell a rental and a lesson together?', a: 'Yes. Make a package from the rental and the lesson. Guests book it in one go, and each part is booked onto its own times.' },
    { q: 'Can I hold a deposit on performance skis?', a: 'Yes. Set a security deposit per item. It is held at pick-up and given back on return, or you keep part of it with a note if the skis come back damaged.' },
    { q: 'How do I move from the system I use now?', a: 'Send us an export of your sets, prices, customers and future bookings before the season starts. We set it all up in EZRA Pro for free.' },
  ],
}

export default long
