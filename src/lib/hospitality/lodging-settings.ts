import type { LodgingSettings, RatePlan, RoomType } from './types'

/* ==========================================================================
   Rates and house rules — plain data with no dataset behind it, so the
   storefront and the dashboard forms can price a stay in the browser.
   ========================================================================== */

export const RATE_PLANS: RatePlan[] = [
  {
    id: 'rp_flex',
    kind: 'flexible',
    name: 'Flexible',
    description: 'Cancel free until 48 hours before arrival. Pay at the hotel.',
    multiplier: 1,
    breakfastIncluded: false,
    cancellation: 'Free cancellation until 48 hours before arrival, then the first night is charged.',
    minNights: 1,
  },
  {
    id: 'rp_nonref',
    kind: 'non_refundable',
    name: 'Non-refundable',
    description: 'Twelve percent off, paid now, no changes.',
    multiplier: 0.88,
    breakfastIncluded: false,
    cancellation: 'Paid in full at booking. No refund on cancellation or change.',
    minNights: 1,
  },
  {
    id: 'rp_bb',
    kind: 'breakfast',
    name: 'Bed & breakfast',
    description: 'Flexible, with breakfast on the rooftop for everyone in the room.',
    multiplier: 1.1,
    breakfastIncluded: true,
    cancellation: 'Free cancellation until 48 hours before arrival, then the first night is charged.',
    minNights: 1,
  },
  {
    id: 'rp_long',
    kind: 'long_stay',
    name: 'Stay four nights',
    description: 'Fifteen percent off from the fourth night, breakfast included.',
    multiplier: 0.85,
    breakfastIncluded: true,
    cancellation: 'Free cancellation until 7 days before arrival.',
    minNights: 4,
  },
]

export const LODGING_SETTINGS: LodgingSettings = {
  checkInFrom: '15:00',
  checkOutBy: '11:00',
  ratePlans: RATE_PLANS,
  seasons: [
    { id: 'ssn_summer', name: 'High summer', startDate: '2026-06-15', endDate: '2026-09-15', multiplier: 1.25 },
    { id: 'ssn_autumn', name: 'Autumn', startDate: '2026-09-16', endDate: '2026-11-15', multiplier: 1.05 },
    { id: 'ssn_winter', name: 'Winter', startDate: '2026-11-16', endDate: '2027-02-28', multiplier: 0.8 },
    { id: 'ssn_spring', name: 'Spring', startDate: '2027-03-01', endDate: '2027-06-14', multiplier: 1.1 },
  ],
  cityTaxPerNight: 400,
  cityTaxLabel: 'Lisbon city tax',
  vatRate: 0.06,
  extras: [
    { id: 'ex_breakfast', label: 'Rooftop breakfast', price: 1800, per: 'person' },
    { id: 'ex_parking', label: 'Parking', price: 2500, per: 'night' },
    { id: 'ex_transfer', label: 'Airport transfer', price: 5500, per: 'stay' },
    { id: 'ex_late', label: 'Late checkout (until 14:00)', price: 4000, per: 'stay' },
    { id: 'ex_cot', label: 'Cot', price: 0, per: 'stay' },
    { id: 'ex_flowers', label: 'Flowers in the room', price: 3500, per: 'stay' },
  ],
  minStayWeekends: 2,
}

export function seasonMultiplier(dateKey: string, settings: LodgingSettings = LODGING_SETTINGS): number {
  const season = settings.seasons.find((s) => dateKey >= s.startDate && dateKey <= s.endDate)
  return season?.multiplier ?? 1
}

/** Nightly rate for a room type on one night under a plan. Fridays and Saturdays carry a small premium. */
export function nightlyRate(type: Pick<RoomType, 'baseRate'>, plan: Pick<RatePlan, 'multiplier'>, dateKey: string, settings: LodgingSettings = LODGING_SETTINGS): number {
  const weekday = new Date(`${dateKey}T12:00:00`).getDay()
  const weekend = weekday === 5 || weekday === 6 ? 1.12 : 1
  return Math.round((type.baseRate * seasonMultiplier(dateKey, settings) * plan.multiplier * weekend) / 100) * 100
}

/** Every night key from check-in (inclusive) to check-out (exclusive). */
export function nightKeys(checkIn: string, checkOut: string): string[] {
  const out: string[] = []
  const cursor = new Date(`${checkIn}T12:00:00`)
  const end = new Date(`${checkOut}T12:00:00`)
  while (cursor < end) {
    out.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`)
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

export interface StayQuote {
  nights: number
  nightly: number
  roomTotal: number
  cityTax: number
  extras: { id: string; label: string; amount: number }[]
  total: number
  /** What is taken now: everything for non-refundable, one night otherwise. */
  dueNow: number
}

export function quoteStay(params: {
  type: Pick<RoomType, 'baseRate'>
  plan: RatePlan
  checkIn: string
  checkOut: string
  adults: number
  children: number
  extraIds: string[]
  settings?: LodgingSettings
}): StayQuote {
  const settings = params.settings ?? LODGING_SETTINGS
  const nights = nightKeys(params.checkIn, params.checkOut)
  const roomTotal = nights.reduce((sum, key) => sum + nightlyRate(params.type, params.plan, key, settings), 0)
  const guests = params.adults + params.children
  const extras = settings.extras
    .filter((e) => params.extraIds.includes(e.id))
    .map((e) => ({ id: e.id, label: e.label, amount: e.per === 'person' ? e.price * guests * nights.length : e.per === 'night' ? e.price * nights.length : e.price }))
  const cityTax = settings.cityTaxPerNight * params.adults * Math.min(nights.length, 7)
  const total = roomTotal + extras.reduce((s, e) => s + e.amount, 0) + cityTax
  const dueNow = params.plan.kind === 'non_refundable' ? total : Math.round(roomTotal / Math.max(1, nights.length))
  return { nights: nights.length, nightly: nights.length ? Math.round(roomTotal / nights.length) : 0, roomTotal, cityTax, extras, total, dueNow }
}
