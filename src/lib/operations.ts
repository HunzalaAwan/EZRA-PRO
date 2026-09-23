import {
  NOW,
  getActivitiesByTenant,
  getBookingsByDeparture,
  getDeparturesForDay,
  getCustomerById,
  getLocationById,
  getPickupZonesByTenant,
} from '@/lib/demo'
import { addDays, hashSeed, toDateKey } from '@/lib/utils'
import type { CharterRequest, WeatherSnapshot } from '@/types'

/* ==========================================================================
   Day-of operations — the rentals board, the charter request inbox and the
   shuttle run sheet, computed from the demo dataset. Server-only: pages
   hand the results to client screens as plain props.
   ========================================================================== */

const pad = (n: number) => String(n).padStart(2, '0')
const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
const unitHash = (key: string) => (hashSeed(key) % 1000) / 1000

/* --------------------------------------------------------------------------
   RENTALS BOARD
   -------------------------------------------------------------------------- */

export type RentalStatus = 'booked' | 'out' | 'late' | 'returned'

export interface RentalRow {
  id: string
  reference: string
  activityId: string
  guestName: string
  phone: string
  /** Unit numbers, 1-based. */
  units: number[]
  /** Units booked with no unit free at the start: an overbooking to resolve. */
  short: number
  startsAt: string
  endsAt: string
  minutes: number
  lengthLabel: string
  status: RentalStatus
  /** Minor units held per unit at hand-out. */
  deposit: number
  balance: number
}

export interface RentalFleet {
  id: string
  name: string
  slug: string
  colorKey: string
  units: number
  unitNoun: string
  bufferMinutes: number
  damageDeposit: number
}

export interface RentalBoard {
  dayKey: string
  nowIso: string
  fleets: RentalFleet[]
  rentals: RentalRow[]
}

const UNIT_NOUN: Record<string, string> = { 'jet-ski-rental': 'Ski', 'kayak-sup-rental': 'Board' }

export function getRentalBoard(tenantId: string, day: Date = NOW): RentalBoard {
  const activities = getActivitiesByTenant(tenantId).filter((activity) => activity.kind === 'rental' && activity.status === 'live')
  const departures = getDeparturesForDay(tenantId, day)
  const nowMs = NOW.getTime()
  const fleets: RentalFleet[] = []
  const rentals: RentalRow[] = []

  for (const activity of activities) {
    const config = activity.rental
    const units = config?.units ?? activity.maxCapacity
    const buffer = config?.bufferMinutes ?? 0
    fleets.push({
      id: activity.id,
      name: activity.name,
      slug: activity.slug,
      colorKey: activity.colorKey,
      units,
      unitNoun: UNIT_NOUN[activity.slug] ?? 'Unit',
      bufferMinutes: buffer,
      damageDeposit: config?.damageDeposit ?? 0,
    })

    const lengths = config?.durations ?? [{ tierId: activity.priceTiers[0]?.id ?? '', minutes: activity.durationMinutes }]
    const freeAt = Array.from({ length: units }, () => 0)
    const mine = departures
      .filter((departure) => departure.activityId === activity.id)
      .flatMap((departure) =>
        getBookingsByDeparture(departure.id)
          .filter((booking) => booking.status !== 'cancelled' && booking.status !== 'refunded')
          .map((booking) => ({ booking, departure })),
      )
      .sort((a, b) => (a.departure.startsAt < b.departure.startsAt ? -1 : 1))

    for (const { booking, departure } of mine) {
      const pick = lengths[hashSeed(`len:${booking.id}`) % lengths.length]
      const tier = activity.priceTiers.find((entry) => entry.id === pick.tierId)
      const start = new Date(departure.startsAt)
      const end = new Date(start.getTime() + pick.minutes * 60_000)
      const count = Math.max(1, Math.min(units, booking.partySize))

      // Earliest-free units first, so the board reads like the shack runs it.
      const order = freeAt
        .map((at, index) => ({ at, index }))
        .filter((entry) => entry.at <= start.getTime())
        .sort((a, b) => a.index - b.index)
      const chosen = order.slice(0, count).map((entry) => entry.index)
      for (const index of chosen) freeAt[index] = end.getTime() + buffer * 60_000

      const roll = unitHash(`status:${booking.id}`)
      let status: RentalStatus
      if (start.getTime() > nowMs) status = 'booked'
      else if (end.getTime() > nowMs) status = 'out'
      else if (nowMs - end.getTime() < 45 * 60_000 && roll < 0.35) status = 'late'
      else status = 'returned'

      const customer = getCustomerById(booking.customerId)
      rentals.push({
        id: booking.id,
        reference: booking.reference,
        activityId: activity.id,
        guestName: customer ? `${customer.firstName} ${customer.lastName}` : 'Guest',
        phone: customer?.phone ?? '',
        units: chosen.map((index) => index + 1).sort((a, b) => a - b),
        short: count - chosen.length,
        startsAt: departure.startsAt,
        endsAt: isoLocal(end),
        minutes: pick.minutes,
        lengthLabel: tier?.label ?? `${pick.minutes} min`,
        status,
        deposit: config?.damageDeposit ?? 0,
        balance: Math.max(0, booking.total - booking.amountPaid),
      })
    }
  }

  return { dayKey: toDateKey(day), nowIso: isoLocal(NOW), fleets, rentals }
}

/* --------------------------------------------------------------------------
   CHARTER REQUESTS — a handful of seeded enquiries, so the inbox is not
   empty before a guest sends one from the storefront.
   -------------------------------------------------------------------------- */

const REQUEST_SEEDS: { name: string; email: string; party: number; message: string; status: CharterRequest['status']; daysAgo: number; ahead: number }[] = [
  { name: 'Leilani Okafor', email: 'leilani.okafor@gmail.com', party: 18, message: 'Company offsite, 18 of us. Snorkel stop and lunch aboard if possible. Two vegetarians.', status: 'new', daysAgo: 0, ahead: 9 },
  { name: 'Marcus Feld', email: 'marcus.feld@proton.me', party: 2, message: 'Planning a proposal at sunset. Could the crew keep it a surprise and have champagne ready?', status: 'new', daysAgo: 1, ahead: 16 },
  { name: 'Aiko Brennan', email: 'aiko.b@icloud.com', party: 12, message: "Mum's 60th birthday. Family of 12 with three kids under ten.", status: 'quoted', daysAgo: 3, ahead: 12 },
  { name: 'Diego Ramirez', email: 'diego.ramirez@outlook.com', party: 22, message: 'Wedding party the day after the ceremony. Music allowed?', status: 'paid', daysAgo: 8, ahead: 20 },
  { name: 'Sophie Laurent', email: 'sophie.laurent@hey.com', party: 30, message: 'Group of 30 for a school reunion.', status: 'declined', daysAgo: 5, ahead: 6 },
]

export function getSeedCharterRequests(tenantId: string): CharterRequest[] {
  const charters = getActivitiesByTenant(tenantId).filter((activity) => activity.kind === 'charter' && activity.status === 'live')
  const target = charters.find((activity) => activity.charter?.requestToBook) ?? charters[0]
  if (!target) return []
  return REQUEST_SEEDS.map((seed, index) => {
    const start = addDays(NOW, seed.ahead)
    const time = target.locations[0]?.times[index % Math.max(1, target.locations[0]?.times.length ?? 1)] ?? '10:00'
    const [hh, mm] = time.split(':').map(Number)
    start.setHours(hh, mm, 0, 0)
    const created = addDays(NOW, -seed.daysAgo)
    created.setHours(9 + index, 12 * index, 0, 0)
    const tier = target.priceTiers[index % target.priceTiers.length]
    const request: CharterRequest = {
      id: `req_seed_${index + 1}`,
      tenantId,
      activitySlug: target.slug,
      startsAt: isoLocal(start),
      tierId: tier?.id,
      party: Math.min(seed.party, target.charter?.maxGuests ?? seed.party),
      name: seed.name,
      email: seed.email,
      message: seed.message,
      createdAt: isoLocal(created),
      status: seed.status,
    }
    if (seed.status === 'quoted' || seed.status === 'paid') {
      const sent = addDays(created, 1)
      request.quote = {
        amount: Math.round((tier?.price ?? 200000) * 1.08),
        depositPercent: 30,
        note: 'Includes the snorkel stop and a platter of poke and fruit. Balance is due 14 days before.',
        validUntil: toDateKey(addDays(sent, 7)),
        sentAt: isoLocal(sent),
      }
    }
    if (seed.status === 'paid') request.paidAt = isoLocal(addDays(created, 2))
    return request
  })
}

/* --------------------------------------------------------------------------
   PICKUP RUN SHEET
   -------------------------------------------------------------------------- */

export interface PickupStop {
  bookingId: string
  reference: string
  time: string
  zoneId: string
  stop: string
  guestName: string
  phone: string
  party: number
  activityName: string
  departureAt: string
  status: string
}

export interface PickupRunSheet {
  dayKey: string
  zones: { id: string; name: string; offsetMinutes: number }[]
  stops: PickupStop[]
}

export function getPickupRunSheet(tenantId: string, day: Date = NOW): PickupRunSheet {
  const activities = new Map(getActivitiesByTenant(tenantId).map((activity) => [activity.id, activity]))
  const stops: PickupStop[] = []
  for (const departure of getDeparturesForDay(tenantId, day)) {
    if (departure.status === 'cancelled') continue
    for (const booking of getBookingsByDeparture(departure.id)) {
      if (!booking.pickup || booking.status === 'cancelled' || booking.status === 'refunded') continue
      const customer = getCustomerById(booking.customerId)
      stops.push({
        bookingId: booking.id,
        reference: booking.reference,
        time: booking.pickup.time,
        zoneId: booking.pickup.zoneId,
        stop: booking.pickup.stop,
        guestName: customer ? `${customer.firstName} ${customer.lastName}` : 'Guest',
        phone: customer?.phone ?? '',
        party: booking.partySize,
        activityName: activities.get(departure.activityId)?.name ?? 'Departure',
        departureAt: departure.startsAt,
        status: booking.status,
      })
    }
  }
  stops.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : a.stop.localeCompare(b.stop)))
  return {
    dayKey: toDateKey(day),
    zones: getPickupZonesByTenant(tenantId).map((zone) => ({ id: zone.id, name: zone.name, offsetMinutes: zone.offsetMinutes })),
    stops,
  }
}

/* --------------------------------------------------------------------------
   WEATHER BOARD — the next week's departures with guests, their forecast
   and who would need a message.
   -------------------------------------------------------------------------- */

export interface WeatherRun {
  id: string
  activityId: string
  activityName: string
  usualTimes: string[]
  locationName?: string
  startsAt: string
  endsAt: string
  status: string
  booked: number
  capacity: number
  parties: number
  revenue: number
  weather: WeatherSnapshot | null
}

export function getWeatherBoard(tenantId: string, days = 7): { days: string[]; runs: WeatherRun[] } {
  const activities = new Map(getActivitiesByTenant(tenantId).map((activity) => [activity.id, activity]))
  const runs: WeatherRun[] = []
  const keys: string[] = []
  for (let offset = 0; offset < days; offset++) {
    const day = addDays(NOW, offset)
    keys.push(toDateKey(day))
    for (const departure of getDeparturesForDay(tenantId, day)) {
      if (departure.status === 'cancelled' || departure.status === 'completed') continue
      const activity = activities.get(departure.activityId)
      if (!activity) continue
      const bookings = getBookingsByDeparture(departure.id).filter((booking) => booking.status !== 'cancelled' && booking.status !== 'refunded')
      if (bookings.length === 0) continue
      const site = activity.locations.find((entry) => entry.locationId === departure.locationId)
      runs.push({
        id: departure.id,
        activityId: activity.id,
        activityName: activity.name,
        usualTimes: site?.times ?? activity.locations[0]?.times ?? [],
        locationName: departure.locationId ? getLocationById(departure.locationId)?.name : undefined,
        startsAt: departure.startsAt,
        endsAt: departure.endsAt,
        status: departure.status,
        booked: bookings.reduce((sum, booking) => sum + booking.partySize, 0),
        capacity: departure.capacity,
        parties: bookings.length,
        revenue: bookings.reduce((sum, booking) => sum + booking.total, 0),
        weather: departure.weather ?? null,
      })
    }
  }
  return { days: keys, runs }
}

/* --------------------------------------------------------------------------
   CHECK-IN — today's and tomorrow's tickets, for the scanner.
   -------------------------------------------------------------------------- */

export interface TicketRow {
  id: string
  reference: string
  guestName: string
  party: number
  activityName: string
  startsAt: string
  status: string
  waiversSigned: number
  waiversTotal: number
  balance: number
  pickup?: string
  notes: string[]
}

export function getTicketList(tenantId: string): TicketRow[] {
  const activities = new Map(getActivitiesByTenant(tenantId).map((activity) => [activity.id, activity]))
  const rows: TicketRow[] = []
  for (const offset of [0, 1]) {
    for (const departure of getDeparturesForDay(tenantId, addDays(NOW, offset))) {
      if (departure.status === 'cancelled') continue
      for (const booking of getBookingsByDeparture(departure.id)) {
        if (booking.status === 'cancelled' || booking.status === 'refunded') continue
        const customer = getCustomerById(booking.customerId)
        rows.push({
          id: booking.id,
          reference: booking.reference,
          guestName: customer ? `${customer.firstName} ${customer.lastName}` : 'Guest',
          party: booking.partySize,
          activityName: activities.get(departure.activityId)?.name ?? 'Departure',
          startsAt: departure.startsAt,
          status: booking.status,
          waiversSigned: booking.participants.filter((participant) => participant.waiverSigned).length,
          waiversTotal: booking.participants.length,
          balance: Math.max(0, booking.total - booking.amountPaid),
          pickup: booking.pickup ? booking.pickup.stop : undefined,
          notes: booking.participants.filter((participant) => participant.notes).map((participant) => `${participant.firstName}: ${participant.notes}`),
        })
      }
    }
  }
  return rows.sort((a, b) => (a.startsAt < b.startsAt ? -1 : 1))
}
