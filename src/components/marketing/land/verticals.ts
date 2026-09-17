import type { LucideIcon } from 'lucide-react'
import { CalendarHeart, Compass, GraduationCap, Leaf, Utensils, Wine } from 'lucide-react'

import { PHOTOS, type Photo } from '@/components/marketing/story/photos'

/* ==========================================================================
   The businesses the landing page speaks to.

   Each entry drives the hero: the word that completes the headline, the
   photograph on top of the stack, and the booking that lands in the corner.
   The bookings are written the way they would appear in the product, so the
   page shows the software rather than describing it.
   ========================================================================== */

export type LandVerticalKey = 'tours' | 'restaurants' | 'events' | 'classes' | 'wellness' | 'venues'

export interface LandBooking {
  /** What was booked. */
  title: string
  /** When, and for how many. */
  when: string
  /** The money line — deposit, balance or paid. */
  money: string
  /** The one operational fact the software just handled. */
  note: string
}

export interface LandVertical {
  key: LandVerticalKey
  label: string
  icon: LucideIcon
  /** Completes "Take bookings for your …". */
  word: string
  photo: Photo
  booking: LandBooking
}

export const LAND_VERTICALS: LandVertical[] = [
  {
    key: 'tours',
    label: 'Tours',
    icon: Compass,
    word: 'sunrise paddle',
    photo: PHOTOS.kayakSunset,
    booking: {
      title: 'Sunrise paddle',
      when: 'Sat 06:40 · 2 seats',
      money: '$148 paid',
      note: 'Guide roster updated',
    },
  },
  {
    key: 'restaurants',
    label: 'Restaurants',
    icon: Utensils,
    word: "chef's table",
    photo: PHOTOS.chefPlating,
    booking: {
      title: "Chef's table",
      when: 'Tonight 19:30 · party of 4',
      money: '$60 deposit held',
      note: 'Allergy note sent to the pass',
    },
  },
  {
    key: 'events',
    label: 'Events',
    icon: CalendarHeart,
    word: 'wedding venue',
    photo: PHOTOS.weddingVenue,
    booking: {
      title: 'The Okafor wedding',
      when: 'Sat 12 Oct · 120 guests',
      money: 'Balance due 1 Oct',
      note: 'Seating chart shared',
    },
  },
  {
    key: 'classes',
    label: 'Classes',
    icon: GraduationCap,
    word: 'pottery class',
    photo: PHOTOS.potteryClass,
    booking: {
      title: 'Wheel throwing, beginners',
      when: 'Thu 18:00 · 1 of 8 seats',
      money: '$85 paid',
      note: 'Waitlist of 2 notified',
    },
  },
  {
    key: 'wellness',
    label: 'Wellness',
    icon: Leaf,
    word: 'yoga studio',
    photo: PHOTOS.sunsetYoga,
    booking: {
      title: 'Sunrise flow',
      when: 'Tue 07:00 · mat 14 of 20',
      money: '$18 paid',
      note: 'Class pack debited',
    },
  },
  {
    key: 'venues',
    label: 'Bars & venues',
    icon: Wine,
    word: 'rooftop bar',
    photo: PHOTOS.rooftopBar,
    booking: {
      title: 'Terrace table',
      when: 'Fri 21:00 · 6 guests',
      money: '$50 minimum spend',
      note: 'Text confirmation delivered',
    },
  },
]
