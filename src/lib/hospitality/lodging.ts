import { NOW, TODAY_KEY, getCustomersByTenant, getUsersByTenant, isoLocal } from '@/lib/demo'
import { addDays, createRng, hashSeed, rngInt, rngPick, rngWeighted, toDateKey } from '@/lib/utils'
import type { Customer, Tenant } from '@/types'

import { LODGING_SETTINGS as SETTINGS, RATE_PLANS, nightlyRate, seasonMultiplier } from './lodging-settings'
import type {
  HousekeepingStatus,
  HousekeepingTask,
  LodgingData,
  Room,
  RoomOccupancy,
  RoomType,
  Stay,
  StayChannel,
  StayExtra,
  StayFlag,
  StayStatus,
} from './types'

/* ==========================================================================
   Lodging — Casa Vela's twenty-eight rooms, the stays that fill them, and
   the housekeeping board for the morning. Generated deterministically
   around the frozen clock (Friday 11 September 2026, 09:00): three parties
   have already checked out, the rest are packing, and this afternoon's
   arrivals are on the board.
   ========================================================================== */

const photo = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=80`

const PAST_DAYS = 45
const FUTURE_DAYS = 60

/* --------------------------------------------------------------------------
   Room types and rooms
   -------------------------------------------------------------------------- */

const ROOM_TYPES: Omit<RoomType, 'tenantId'>[] = [
  {
    id: 'rt_cv_classic',
    slug: 'classic-room',
    name: 'Classic Room',
    description:
      'Twenty-two square metres on the first three floors, with a queen bed, a small desk under the window and the original tiled floor. The quietest rooms in the house; most face the courtyard.',
    size: 22,
    beds: [{ type: 'queen', count: 1 }],
    maxGuests: 2,
    maxAdults: 2,
    baseRate: 16500,
    imageUrls: [photo('photo-1631049307264-da0ec9d70304'), photo('photo-1618773928121-c32242e63f39')],
    amenities: ['Rain shower', 'Air conditioning', 'Fast wifi', 'Nespresso', 'Blackout blinds', 'Safe'],
    view: 'Courtyard',
    count: 12,
    highlights: ['Queen bed', 'Courtyard view', '22 m²'],
  },
  {
    id: 'rt_cv_terrace',
    slug: 'terrace-room',
    name: 'Terrace Room',
    description:
      'A king bed and a private terrace with two chairs and a view over the Alfama rooftops. Breakfast can be brought up. Twenty-eight square metres, on floors one to four.',
    size: 28,
    beds: [{ type: 'king', count: 1 }],
    maxGuests: 2,
    maxAdults: 2,
    baseRate: 21500,
    imageUrls: [photo('photo-1590490360182-c33d57733427'), photo('photo-1566665797739-1674de7a421a')],
    amenities: ['Private terrace', 'King bed', 'Rain shower', 'Air conditioning', 'Nespresso', 'Bathrobes'],
    view: 'Alfama rooftops',
    count: 8,
    highlights: ['Private terrace', 'King bed', '28 m²'],
  },
  {
    id: 'rt_cv_river',
    slug: 'river-view-suite',
    name: 'River View Suite',
    description:
      'The corner rooms. A king bed, a sitting area with a sofa that sleeps a third guest, a bathtub, and the Tagus in the window from bed. Forty-two square metres.',
    size: 42,
    beds: [{ type: 'king', count: 1 }, { type: 'sofa', count: 1 }],
    maxGuests: 3,
    maxAdults: 2,
    baseRate: 32000,
    imageUrls: [photo('photo-1582719478250-c89cae4dc85b'), photo('photo-1564501049412-61c2a3083791')],
    amenities: ['River view', 'Bathtub and shower', 'Sitting area', 'King bed', 'Minibar', 'Bathrobes', 'Late checkout on request'],
    view: 'River Tagus',
    count: 5,
    highlights: ['River view', 'Bathtub', 'Sleeps 3'],
  },
  {
    id: 'rt_cv_loft',
    slug: 'family-loft',
    name: 'Family Loft',
    description:
      'Under the roof: a king bed on the mezzanine, two singles below, and a small kitchen. Fifty-five square metres for up to four, with the beams left showing.',
    size: 55,
    beds: [{ type: 'king', count: 1 }, { type: 'twin', count: 2 }],
    maxGuests: 4,
    maxAdults: 3,
    baseRate: 29000,
    imageUrls: [photo('photo-1595576508898-0ad5c879a061'), photo('photo-1560448204-e02f11c3d0e2')],
    amenities: ['Sleeps 4', 'Kitchenette', 'Two levels', 'Air conditioning', 'Washing machine', 'Cot on request'],
    view: 'Rooftops',
    count: 3,
    highlights: ['Sleeps 4', 'Kitchenette', '55 m²'],
  },
]

/** Room number -> type id. Twenty-eight rooms over four floors. */
const ROOM_PLAN: [string, string, string[]][] = [
  ['101', 'rt_cv_classic', []],
  ['102', 'rt_cv_classic', ['Accessible']],
  ['103', 'rt_cv_classic', []],
  ['104', 'rt_cv_classic', ['Connecting 103']],
  ['105', 'rt_cv_terrace', []],
  ['106', 'rt_cv_terrace', []],
  ['107', 'rt_cv_river', ['Corner']],
  ['201', 'rt_cv_classic', []],
  ['202', 'rt_cv_classic', []],
  ['203', 'rt_cv_classic', ['Connecting 204']],
  ['204', 'rt_cv_classic', ['Connecting 203']],
  ['205', 'rt_cv_terrace', []],
  ['206', 'rt_cv_terrace', []],
  ['207', 'rt_cv_river', ['Corner']],
  ['301', 'rt_cv_classic', []],
  ['302', 'rt_cv_classic', []],
  ['303', 'rt_cv_classic', []],
  ['304', 'rt_cv_classic', []],
  ['305', 'rt_cv_terrace', []],
  ['306', 'rt_cv_terrace', ['Largest terrace']],
  ['307', 'rt_cv_river', ['Corner']],
  ['401', 'rt_cv_river', ['Corner', 'Bathtub by the window']],
  ['402', 'rt_cv_loft', []],
  ['403', 'rt_cv_loft', ['Cot']],
  ['404', 'rt_cv_loft', []],
  ['405', 'rt_cv_terrace', []],
  ['406', 'rt_cv_terrace', []],
  ['407', 'rt_cv_river', ['Corner', 'Best view in the house']],
]


/* --------------------------------------------------------------------------
   Stays
   -------------------------------------------------------------------------- */

const REQUESTS = [
  'High floor if possible.',
  'Arriving on the 23:40 flight, please keep the room.',
  'Anniversary — a bottle of something would be welcome, we will pay.',
  'Feather-free pillows.',
  'Quiet room away from the lift.',
  'Two single beds rather than one king.',
  'Early check-in around 11:00 if a room is ready.',
  'Travelling with a service dog.',
  'Please arrange the airport transfer for the return too.',
]

const CHANNEL_WEIGHTS: [StayChannel, number][] = [
  ['direct', 42],
  ['booking_com', 28],
  ['expedia', 11],
  ['airbnb', 5],
  ['phone', 7],
  ['corporate', 5],
  ['walk_in', 2],
]

function statusFor(checkIn: string, checkOut: string, rng: () => number): StayStatus {
  if (checkOut < TODAY_KEY) return rng() < 0.97 ? 'checked_out' : 'no_show'
  if (checkOut === TODAY_KEY) return rng() < 0.3 ? 'checked_out' : 'departing'
  if (checkIn === TODAY_KEY) return rng() < 0.12 ? 'in_house' : 'arriving'
  if (checkIn < TODAY_KEY) return 'in_house'
  return 'booked'
}

function buildStay(params: {
  tenant: Tenant
  customer: Customer
  type: RoomType
  roomId: string | null
  checkIn: string
  checkOut: string
  rng: () => number
  serial: number
  status?: StayStatus
}): Stay {
  const { tenant, customer, type, roomId, checkIn, checkOut, rng, serial } = params
  const nights = Math.round((new Date(`${checkOut}T12:00:00`).getTime() - new Date(`${checkIn}T12:00:00`).getTime()) / 86_400_000)
  const plan =
    nights >= 4 && rng() < 0.45
      ? RATE_PLANS[3]
      : rngWeighted(rng, [
          [RATE_PLANS[0], 45],
          [RATE_PLANS[1], 30],
          [RATE_PLANS[2], 25],
        ])
  const adults = type.maxAdults === 1 ? 1 : rngWeighted(rng, [[1, 2], [2, 8], [3, type.maxAdults >= 3 ? 1 : 0]])
  const children = type.id === 'rt_cv_loft' ? rngInt(rng, 1, 2) : type.maxGuests > adults && rng() < 0.12 ? 1 : 0
  let roomTotal = 0
  for (let n = 0; n < nights; n++) roomTotal += nightlyRate(type, plan, toDateKey(addDays(new Date(`${checkIn}T12:00:00`), n)))
  const nightly = Math.round(roomTotal / Math.max(1, nights))

  const extras: StayExtra[] = []
  if (!plan.breakfastIncluded && rng() < 0.3) extras.push({ id: 'ex_breakfast', label: 'Rooftop breakfast', amount: 1800 * (adults + children) * nights, qty: (adults + children) * nights })
  if (rng() < 0.18) extras.push({ id: 'ex_parking', label: 'Parking', amount: 2500 * nights, qty: nights })
  if (rng() < 0.15) extras.push({ id: 'ex_transfer', label: 'Airport transfer', amount: 5500, qty: 1 })
  if (rng() < 0.08) extras.push({ id: 'ex_late', label: 'Late checkout (until 14:00)', amount: 4000, qty: 1 })
  if (children > 0 && rng() < 0.4) extras.push({ id: 'ex_cot', label: 'Cot', amount: 0, qty: 1 })
  const cityTax = SETTINGS.cityTaxPerNight * adults * Math.min(nights, 7)
  const total = roomTotal + extras.reduce((sum, e) => sum + e.amount, 0) + cityTax

  const status = params.status ?? statusFor(checkIn, checkOut, rng)
  const channel = rngWeighted(rng, CHANNEL_WEIGHTS)
  let paid = 0
  if (status === 'checked_out') paid = total
  else if (plan.kind === 'non_refundable' || channel === 'expedia') paid = roomTotal
  else if (channel === 'direct' || channel === 'phone') paid = nightly
  else if (channel === 'booking_com') paid = rng() < 0.4 ? roomTotal : 0
  else if (channel === 'corporate') paid = 0
  if (status === 'cancelled') paid = plan.kind === 'non_refundable' ? roomTotal : 0
  if (status === 'no_show') paid = nightly

  const flags: StayFlag[] = []
  if (customer.segment === 'vip') flags.push('vip')
  if (customer.segment === 'returning' || customer.totalBookings > 2) flags.push('repeat')
  if (rng() < 0.1) flags.push('early_checkin')
  if (extras.some((e) => e.id === 'ex_late')) flags.push('late_checkout')
  if (rng() < 0.08) flags.push('allergy')
  if (rng() < 0.05) flags.push('birthday')
  if (roomId === 'room_cv_102') flags.push('accessible')

  const createdDaysBefore = channel === 'walk_in' ? 0 : rngInt(rng, 3, 120)
  const reference = `CV-${(hashSeed(`${tenant.id}:${serial}`) % 46656).toString(36).toUpperCase().padStart(3, '0')}${String.fromCharCode(65 + (serial % 26))}`

  return {
    id: `stay_cv_${serial.toString(36).padStart(4, '0')}`,
    tenantId: tenant.id,
    reference,
    customer,
    roomTypeId: type.id,
    roomId: status === 'booked' && checkIn > toDateKey(addDays(NOW, 2)) && rng() < 0.7 ? null : roomId,
    checkIn,
    checkOut,
    nights,
    adults,
    children,
    ratePlanId: plan.id,
    nightlyRate: nightly,
    roomTotal,
    extras,
    cityTax,
    total,
    paid,
    balance: Math.max(0, total - paid),
    status,
    channel,
    specialRequests: rng() < 0.28 ? rngPick(rng, REQUESTS) : null,
    eta: status === 'arriving' && rng() < 0.6 ? rngPick(rng, ['14:30', '15:00', '15:30', '16:00', '17:15', '18:00', '19:30', '22:45']) : null,
    flags,
    createdAt: isoLocal(addDays(new Date(`${checkIn}T10:00:00`), -createdDaysBefore)),
    checkedInAt: status === 'in_house' || status === 'departing' || status === 'checked_out' ? `${checkIn}T${rngPick(rng, ['14:50', '15:20', '16:05', '17:40', '19:10', '21:30'])}:00` : null,
    checkedOutAt: status === 'checked_out' ? `${checkOut}T${checkOut === TODAY_KEY ? rngPick(rng, ['07:35', '08:10', '08:45']) : rngPick(rng, ['08:40', '09:55', '10:30', '10:58'])}:00` : null,
  }
}

function generate(tenant: Tenant): LodgingData {
  const customers = getCustomersByTenant(tenant.id)
  const rng = createRng(hashSeed(`lodging:${tenant.id}`))
  const roomTypes: RoomType[] = ROOM_TYPES.map((t) => ({ ...t, tenantId: tenant.id }))
  const typeById = new Map(roomTypes.map((t) => [t.id, t]))
  const rooms: Room[] = ROOM_PLAN.map(([number, typeId, features]) => ({
    id: `room_cv_${number}`,
    tenantId: tenant.id,
    typeId,
    number,
    floor: Number(number[0]),
    housekeeping: 'clean',
    occupancy: 'vacant',
    features,
    notes: null,
    currentStayId: null,
    arrivingStayId: null,
  }))

  if (customers.length === 0) {
    return { roomTypes, rooms, settings: SETTINGS, stays: [], housekeeping: [] }
  }

  const stays: Stay[] = []
  let serial = 1

  /* ---- walk each room through the window, one stay after another ---- */
  for (const room of rooms) {
    const type = typeById.get(room.typeId)!
    if (room.number === '303') continue // out of order this week
    let cursor = addDays(NOW, -PAST_DAYS - rngInt(rng, 0, 3))
    const end = addDays(NOW, FUTURE_DAYS)
    while (cursor < end) {
      const monthDemand = seasonMultiplier(toDateKey(cursor)) >= 1.2 ? 0.74 : 0.6
      // Gap nights before the next stay.
      const gap = rng() < monthDemand ? 0 : rngInt(rng, 1, 3)
      cursor = addDays(cursor, gap)
      const nights = rngWeighted(rng, [[1, 1.5], [2, 5], [3, 5], [4, 3], [5, 1.5], [7, 0.8]])
      const checkIn = toDateKey(cursor)
      const checkOut = toDateKey(addDays(cursor, nights))
      stays.push(buildStay({ tenant, customer: rngPick(rng, customers), type, roomId: room.id, checkIn, checkOut, rng, serial: serial++ }))
      cursor = addDays(cursor, nights)
    }
  }

  /* ---- cancellations that never held a room ---- */
  for (let i = 0; i < 14; i++) {
    const type = rngPick(rng, roomTypes)
    const start = addDays(NOW, rngInt(rng, -20, 40))
    const nights = rngInt(rng, 1, 4)
    stays.push(buildStay({ tenant, customer: rngPick(rng, customers), type, roomId: null, checkIn: toDateKey(start), checkOut: toDateKey(addDays(start, nights)), rng, serial: serial++, status: 'cancelled' }))
  }

  stays.sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.reference.localeCompare(b.reference))

  /* ---- what the rooms look like at 09:00 ---- */
  const users = getUsersByTenant(tenant.id)
  const attendants = users.filter((u) => u.title.toLowerCase().includes('attendant') || u.title.toLowerCase().includes('housekeeper'))
  const housekeeping: HousekeepingTask[] = []
  let taskSerial = 1

  for (const room of rooms) {
    const inRoom = stays.find((s) => s.roomId === room.id && s.checkIn < TODAY_KEY && s.checkOut > TODAY_KEY && (s.status === 'in_house' || s.status === 'departing'))
    const departing = stays.find((s) => s.roomId === room.id && s.checkOut === TODAY_KEY && (s.status === 'departing' || s.status === 'checked_out'))
    const arriving = stays.find((s) => s.roomId === room.id && s.checkIn === TODAY_KEY && (s.status === 'arriving' || s.status === 'in_house'))

    let occupancy: RoomOccupancy = 'vacant'
    if (departing && arriving) occupancy = 'turnover'
    else if (departing) occupancy = 'departing'
    else if (arriving) occupancy = 'arriving'
    else if (inRoom) occupancy = 'stayover'

    let hk: HousekeepingStatus = 'clean'
    let notes: string | null = null
    if (room.number === '303') {
      hk = 'out_of_order'
      notes = 'Bathroom leak — plumber Monday. Out of sale until 15 Sep.'
      housekeeping.push({ id: `hk_${taskSerial++}`, tenantId: tenant.id, roomId: room.id, kind: 'maintenance', status: 'in_progress', assigneeId: null, priority: 'normal', dueBy: '17:00', note: 'Plumber booked, check the ceiling in 203 below.', minutes: 120 })
    } else if (departing) {
      const left = departing.status === 'checked_out'
      hk = left ? (rng() < 0.3 ? 'in_progress' : 'dirty') : 'dirty'
      housekeeping.push({
        id: `hk_${taskSerial++}`,
        tenantId: tenant.id,
        roomId: room.id,
        kind: arriving ? 'turnover' : 'departure_clean',
        status: hk === 'in_progress' ? 'in_progress' : 'todo',
        assigneeId: attendants.length ? rngPick(rng, attendants).id : null,
        priority: arriving ? 'rush' : 'normal',
        dueBy: arriving ? (arriving.eta && arriving.eta < '15:00' ? arriving.eta : '15:00') : '16:00',
        note: arriving?.flags.includes('early_checkin') ? 'Guest asked for early check-in.' : null,
        minutes: room.typeId === 'rt_cv_loft' ? 55 : room.typeId === 'rt_cv_river' ? 45 : 35,
      })
    } else if (inRoom) {
      hk = rng() < 0.25 ? 'in_progress' : 'dirty'
      housekeeping.push({
        id: `hk_${taskSerial++}`,
        tenantId: tenant.id,
        roomId: room.id,
        kind: 'stayover',
        status: hk === 'in_progress' ? 'in_progress' : 'todo',
        assigneeId: attendants.length ? rngPick(rng, attendants).id : null,
        priority: 'normal',
        dueBy: '14:00',
        note: inRoom.flags.includes('allergy') ? 'Allergy on file — no feather pillows.' : null,
        minutes: 20,
      })
    } else if (arriving) {
      hk = rng() < 0.5 ? 'inspected' : 'clean'
      housekeeping.push({
        id: `hk_${taskSerial++}`,
        tenantId: tenant.id,
        roomId: room.id,
        kind: 'arrival_inspect',
        status: hk === 'inspected' ? 'done' : 'todo',
        assigneeId: attendants.length ? attendants[0].id : null,
        priority: 'normal',
        dueBy: '14:00',
        note: arriving.flags.includes('vip') ? 'VIP — flowers and a handwritten card.' : arriving.extras.some((e) => e.id === 'ex_cot') ? 'Cot requested.' : null,
        minutes: 10,
      })
    } else {
      hk = rng() < 0.7 ? 'clean' : 'inspected'
    }

    room.housekeeping = hk
    room.occupancy = occupancy
    room.notes = notes
    room.currentStayId = inRoom?.id ?? departing?.id ?? null
    room.arrivingStayId = arriving?.id ?? null
  }

  // Two deep cleans scheduled on vacant rooms.
  const vacant = rooms.filter((r) => r.occupancy === 'vacant' && r.housekeeping !== 'out_of_order').slice(0, 2)
  for (const room of vacant) {
    housekeeping.push({ id: `hk_${taskSerial++}`, tenantId: tenant.id, roomId: room.id, kind: 'deep_clean', status: 'todo', assigneeId: attendants.length ? rngPick(rng, attendants).id : null, priority: 'normal', dueBy: '18:00', note: 'Quarterly: mattress turn, curtains, grout.', minutes: 90 })
  }

  housekeeping.sort((a, b) => (a.priority === b.priority ? a.dueBy.localeCompare(b.dueBy) : a.priority === 'rush' ? -1 : 1))

  return { roomTypes, rooms, settings: SETTINGS, stays, housekeeping }
}

/* --------------------------------------------------------------------------
   Public
   -------------------------------------------------------------------------- */

const cache = new Map<string, LodgingData>()

export function getLodging(tenant: Tenant): LodgingData {
  const cached = cache.get(tenant.id)
  if (cached) return cached
  const data = generate(tenant)
  cache.set(tenant.id, data)
  return data
}

export interface LodgingCounts {
  arrivalsToday: number
  departuresToday: number
  inHouse: number
  roomsToClean: number
  occupancyTonight: number
}

export function getLodgingCounts(tenant: Tenant): LodgingCounts {
  const { stays, housekeeping, rooms } = getLodging(tenant)
  const arrivals = stays.filter((s) => s.checkIn === TODAY_KEY && (s.status === 'arriving' || s.status === 'booked'))
  const departures = stays.filter((s) => s.checkOut === TODAY_KEY && s.status === 'departing')
  const tonight = stays.filter((s) => s.checkIn <= TODAY_KEY && s.checkOut > TODAY_KEY && s.status !== 'cancelled' && s.status !== 'no_show' && s.status !== 'checked_out')
  const sellable = rooms.filter((r) => r.housekeeping !== 'out_of_order').length
  return {
    arrivalsToday: arrivals.length,
    departuresToday: departures.length,
    inHouse: stays.filter((s) => s.status === 'in_house' || s.status === 'departing').length,
    roomsToClean: housekeeping.filter((t) => t.status !== 'done' && t.status !== 'skipped' && t.kind !== 'maintenance').length,
    occupancyTonight: sellable === 0 ? 0 : Math.round((tonight.length / sellable) * 100),
  }
}

/** Nights a room type has free between two dates, for the storefront search. */
export function availableRooms(tenant: Tenant, typeId: string, checkIn: string, checkOut: string): number {
  const { rooms, stays } = getLodging(tenant)
  const ofType = rooms.filter((r) => r.typeId === typeId && r.housekeeping !== 'out_of_order')
  const busy = new Set(
    stays
      .filter((s) => s.roomTypeId === typeId && s.status !== 'cancelled' && s.status !== 'no_show' && s.roomId && s.checkIn < checkOut && s.checkOut > checkIn)
      .map((s) => s.roomId as string),
  )
  return Math.max(0, ofType.filter((r) => !busy.has(r.id)).length)
}
