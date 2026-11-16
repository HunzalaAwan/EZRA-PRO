import type { NicheLong, NicheSlug } from '@/content/booking-software'

import airportShuttle from './airport-shuttle'
import bikeRental from './bike-rental'
import boatCharters from './boat-charters'
import boatRental from './boat-rental'
import golfCartRental from './golf-cart-rental'
import jetSkiRental from './jet-ski-rental'
import kayakRental from './kayak-rental'
import skiRental from './ski-rental'

/* The long-form half of each /booking-software page, one file per business. */
export const NICHE_LONG: Record<NicheSlug, NicheLong> = {
  'boat-rental': boatRental,
  'bike-rental': bikeRental,
  'airport-shuttle': airportShuttle,
  'boat-charters': boatCharters,
  'kayak-rental': kayakRental,
  'ski-rental': skiRental,
  'jet-ski-rental': jetSkiRental,
  'golf-cart-rental': golfCartRental,
}
