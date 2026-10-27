import type { ActivityPickup, BookingPickup, CurrencyCode, DropOffPoint, PickupZone, RequestTransport, TransportCharge, TransportFare, TransportTrip } from '@/types'
import { formatCurrency, formatTime } from '@/lib/utils'

/* ==========================================================================
   TRANSPORT — pickup and drop-off as part of an activity: a tour with hotel
   pickup included, a trip guests can add a ride to (one way or both ways),
   a sail that drops guests in town. Different from the 'transfer' kind,
   which sells the ride itself.

   The activity carries one setup (`Activity.pickup`, read through
   `transportOf`); the guest makes one choice (`TransportChoice`), priced by
   the engine (`priceTransport`) and kept on the booking (`BookingPickup`).
   ========================================================================== */

export const TRANSPORT_TRIPS: TransportTrip[] = ['pickup', 'dropoff', 'both']

/** What guests see for each trip. */
export const TRIP_WORDS: Record<TransportTrip | 'meet', string> = {
  meet: 'Meet there',
  pickup: 'Pickup',
  dropoff: 'Drop-off',
  both: 'Pickup and drop-off',
}

/** The setup as the storefront, checkout and operations read it. */
export interface TransportSetup {
  mode: 'included' | 'optional'
  /** No meet-there option: included, or the activity collects every guest. */
  required: boolean
  /** The trips offered (included: the one trip), in the order guests see them. */
  trips: TransportTrip[]
  zoneIds: string[]
  /** Empty: guests are dropped back at their pickup point. */
  dropOffs: DropOffPoint[]
  charge: TransportCharge
  fare: TransportFare
  zoneFares: Record<string, TransportFare>
}

const whole = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback
/** A price, or undefined when it is not set (empty: the standard price counts). */
const priceOrNone = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined)

function cleanFare(fare: TransportFare | undefined): TransportFare {
  const oneWay = priceOrNone(fare?.oneWay)
  const back = priceOrNone(fare?.return)
  return { ...(oneWay !== undefined ? { oneWay } : {}), ...(back !== undefined ? { return: back } : {}) }
}

export function cleanDropOffs(list: DropOffPoint[] | undefined): DropOffPoint[] {
  const seen = new Set<string>()
  return (list ?? []).flatMap((point, index) => {
    const name = (point?.name ?? '').trim()
    if (!name) return []
    let id = (point.id ?? '').trim() || `dp_${index + 1}`
    while (seen.has(id)) id = `${id}_${index + 1}`
    seen.add(id)
    return [{ id, name, afterMinutes: whole(point.afterMinutes, 0, 600, 15) }]
  })
}

/** Trips a setup can actually run: pickup needs pickup points; drop-off needs points or a pickup point to go back to. */
function runnable(trips: TransportTrip[], zoneIds: string[], dropOffs: DropOffPoint[]): TransportTrip[] {
  return TRANSPORT_TRIPS.filter((trip) => trips.includes(trip) && (trip === 'dropoff' ? zoneIds.length > 0 || dropOffs.length > 0 : zoneIds.length > 0))
}

/**
 * The activity's transport, cleaned, or undefined when it has none. An older
 * save (zones with one price each) reads as pickup only: free when no zone
 * costs anything, else optional (or required, when the activity collects
 * every guest) at those prices.
 */
export function transportOf(pickup: ActivityPickup | null | undefined): TransportSetup | undefined {
  if (!pickup || !Array.isArray(pickup.zoneIds)) return undefined
  const zoneIds = [...new Set(pickup.zoneIds.filter((id) => typeof id === 'string' && id))]
  const dropOffs = cleanDropOffs(pickup.dropOffs)
  const modern = pickup.mode !== undefined || pickup.trips !== undefined || pickup.charge !== undefined
  if (modern) {
    const mode = pickup.mode === 'included' ? 'included' : 'optional'
    const wanted = runnable(Array.isArray(pickup.trips) && pickup.trips.length > 0 ? pickup.trips : ['pickup'], zoneIds, dropOffs)
    if (wanted.length === 0) return undefined
    const charge: TransportCharge = mode === 'included' ? 'free' : pickup.charge === 'guest' || pickup.charge === 'booking' ? pickup.charge : 'free'
    const zoneFares = Object.fromEntries(
      Object.entries(pickup.zoneFares ?? {})
        .filter(([id]) => zoneIds.includes(id))
        .map(([id, fare]) => [id, cleanFare(fare)] as const)
        .filter(([, fare]) => fare.oneWay !== undefined || fare.return !== undefined),
    )
    return {
      mode,
      required: mode === 'included' || Boolean(pickup.required),
      // Included is one trip; with a choice, the trips in a fixed order.
      trips: mode === 'included' ? [wanted.includes('both') ? 'both' : wanted[0]] : wanted,
      zoneIds,
      dropOffs: wanted.some((trip) => trip !== 'pickup') ? dropOffs : [],
      charge,
      fare: cleanFare(pickup.fare),
      zoneFares,
    }
  }
  // Older saves: pickup only, one price per zone.
  if (zoneIds.length === 0) return undefined
  const prices = pickup.prices ?? {}
  const paid = zoneIds.map((id) => prices[id]).find((price) => price && price.fee > 0)
  const charge: TransportCharge = paid ? paid.per : 'free'
  const zoneFares = Object.fromEntries(zoneIds.flatMap((id) => (prices[id] ? [[id, { oneWay: Math.max(0, Math.round(prices[id].fee)) }]] : [])))
  return {
    mode: paid ? 'optional' : pickup.required ? 'included' : 'optional',
    required: Boolean(pickup.required),
    trips: ['pickup'],
    zoneIds,
    dropOffs: [],
    charge,
    fare: {},
    zoneFares,
  }
}

/** True for a trip that collects guests before the start. */
export const collects = (trip: TransportTrip | 'meet') => trip === 'pickup' || trip === 'both'
/** True for a trip that takes guests somewhere after the end. */
export const drops = (trip: TransportTrip | 'meet') => trip === 'dropoff' || trip === 'both'

/** What a guest picks from: meet there (unless every guest is collected), then each trip offered. */
export function guestOptions(setup: TransportSetup): (TransportTrip | 'meet')[] {
  return setup.required ? setup.trips : ['meet', ...setup.trips]
}

/** One way (pickup or drop-off) or both ways, from one pickup point; 0 when free. */
export function fareOf(setup: TransportSetup, zoneId: string | undefined, trip: TransportTrip): number {
  if (setup.charge === 'free') return 0
  const own = zoneId ? setup.zoneFares[zoneId] : undefined
  const oneWay = own?.oneWay ?? setup.fare.oneWay ?? 0
  if (trip !== 'both') return oneWay
  if (own && (own.oneWay !== undefined || own.return !== undefined)) return own.return ?? 2 * oneWay
  return setup.fare.return ?? 2 * oneWay
}

/** The lowest price of a trip across the pickup points, for "from" hints. */
export function lowestFare(setup: TransportSetup, trip: TransportTrip, zoneIds: string[] = setup.zoneIds): number {
  if (setup.charge === 'free') return 0
  // A drop-off at one of the drop-off points has no pickup point: the standard price.
  const ids = trip === 'dropoff' && setup.dropOffs.length > 0 ? [''] : zoneIds.length > 0 ? zoneIds : ['']
  return Math.min(...ids.map((id) => fareOf(setup, id || undefined, trip)))
}

/** True when the pickup points don't all cost the same for a trip. */
export function faresVary(setup: TransportSetup, trip: TransportTrip, zoneIds: string[] = setup.zoneIds): boolean {
  if (setup.charge === 'free' || (trip === 'dropoff' && setup.dropOffs.length > 0)) return false
  return new Set(zoneIds.map((id) => fareOf(setup, id, trip))).size > 1
}

/** "a guest" / "a booking". */
export const chargeWords = (charge: TransportCharge) => (charge === 'booking' ? 'a booking' : 'a guest')

/** A trip's price in words: "Free", "$15 a guest", or by pickup point "Free to $20 a guest", "$25 to $45 a booking". */
export function fareWords(setup: TransportSetup, trip: TransportTrip, currency: CurrencyCode, zoneId?: string, zoneIds: string[] = setup.zoneIds): string {
  if (setup.mode === 'included') return 'Included'
  const money = (amount: number) => (amount === 0 ? 'Free' : formatCurrency(amount, currency))
  if (zoneId === undefined && faresVary(setup, trip, zoneIds)) {
    const prices = zoneIds.map((id) => fareOf(setup, id, trip))
    return `${money(Math.min(...prices))} to ${formatCurrency(Math.max(...prices), currency)} ${chargeWords(setup.charge)}`
  }
  const amount = zoneId !== undefined ? fareOf(setup, zoneId || undefined, trip) : lowestFare(setup, trip, zoneIds)
  return amount === 0 ? 'Free' : `${formatCurrency(amount, currency)} ${chargeWords(setup.charge)}`
}

/* ---------- the guest's choice ---------- */

export interface TransportChoice {
  trip: TransportTrip | 'meet'
  /** The pickup zone of their hotel or stop. */
  zoneId: string
  /** The hotel, stop or address in that zone. */
  stop: string
  /** One of the drop-off points; '' is back to their pickup point. */
  dropOffId: string
}

export const NO_TRANSPORT: TransportChoice = { trip: 'meet', zoneId: '', stop: '', dropOffId: '' }

/** Where a choice starts: meet there, or the trip included or required. */
export function defaultChoice(setup: TransportSetup | undefined): TransportChoice {
  if (!setup || !setup.required) return NO_TRANSPORT
  return { ...NO_TRANSPORT, trip: setup.trips[0] }
}

/** The trip asks for the guest's hotel: every pickup, and a drop-off back to it. */
export const needsPlace = (setup: TransportSetup, trip: TransportTrip | 'meet') => collects(trip) || (trip === 'dropoff' && setup.dropOffs.length === 0)
/** The trip asks which drop-off point. */
export const needsDropOffPoint = (setup: TransportSetup, trip: TransportTrip | 'meet') => drops(trip) && setup.dropOffs.length > 0

/** A choice kept within what the setup offers now: an offered trip, a served zone, an existing drop-off point. */
export function cleanChoice(setup: TransportSetup | undefined, choice: TransportChoice, zones: Pick<PickupZone, 'id'>[]): TransportChoice {
  if (!setup) return NO_TRANSPORT
  const options = guestOptions(setup)
  const trip = options.includes(choice.trip) ? choice.trip : setup.required ? setup.trips[0] : 'meet'
  if (trip === 'meet') return NO_TRANSPORT
  const served = zones.some((zone) => zone.id === choice.zoneId) && setup.zoneIds.includes(choice.zoneId)
  const place = needsPlace(setup, trip)
  const dropOffId = needsDropOffPoint(setup, trip) && setup.dropOffs.some((point) => point.id === choice.dropOffId) ? choice.dropOffId : ''
  return { trip, zoneId: place && served ? choice.zoneId : '', stop: place && served ? choice.stop : '', dropOffId }
}

/** What is still missing, keyed for the form: the hotel and the drop-off point. */
export function choiceErrors(setup: TransportSetup | undefined, choice: TransportChoice): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!setup || choice.trip === 'meet') return errors
  if (needsPlace(setup, choice.trip)) {
    if (!choice.zoneId) errors['transport.place'] = collects(choice.trip) ? 'Choose where we collect you' : 'Choose where we drop you'
    else if (choice.stop.trim().length < 3) errors['transport.place'] = 'Add your hotel or address'
  }
  if (needsDropOffPoint(setup, choice.trip) && !choice.dropOffId) errors['transport.dropOff'] = 'Choose a drop-off point'
  return errors
}

/* ---------- times ---------- */

const pad = (n: number) => String(n).padStart(2, '0')
/** A local ISO moved by some minutes, as a local ISO. */
export function plusMinutes(iso: string, minutes: number): string {
  const d = new Date(new Date(iso).getTime() + minutes * 60_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

/**
 * The booking's transport, with its times: pickup the zone's minutes before
 * the start; drop-off a drop-off point's minutes after the end, or back at
 * the pickup point as long after the end as the pickup was before the start.
 */
export function bookingPickupOf(
  setup: TransportSetup | undefined,
  choice: TransportChoice,
  zones: Pick<PickupZone, 'id' | 'offsetMinutes'>[],
  startsAt: string,
  endsAt: string,
): BookingPickup | undefined {
  if (!setup || choice.trip === 'meet') return undefined
  const zone = zones.find((entry) => entry.id === choice.zoneId)
  const place = needsPlace(setup, choice.trip)
  if (place && !zone) return undefined
  const point = setup.dropOffs.find((entry) => entry.id === choice.dropOffId)
  const stop = place ? choice.stop.trim() : ''
  return {
    zoneId: place && zone ? zone.id : '',
    stop,
    time: collects(choice.trip) && zone ? plusMinutes(startsAt, -zone.offsetMinutes) : '',
    trip: choice.trip,
    ...(drops(choice.trip)
      ? {
          dropOff: point
            ? { stop: point.name, time: plusMinutes(endsAt, point.afterMinutes), pointId: point.id }
            : { stop, time: plusMinutes(endsAt, zone?.offsetMinutes ?? 0) },
        }
      : {}),
  }
}

/** A booking's transport at a new time (moved, or the zone's minutes changed): the same places, the times worked out again. */
export function retimed(
  pickup: BookingPickup,
  setup: TransportSetup | undefined,
  zones: Pick<PickupZone, 'id' | 'offsetMinutes'>[],
  startsAt: string,
  endsAt: string,
): BookingPickup {
  const zone = zones.find((entry) => entry.id === pickup.zoneId)
  const trip = pickup.trip ?? 'pickup'
  const point = pickup.dropOff?.pointId ? setup?.dropOffs.find((entry) => entry.id === pickup.dropOff?.pointId) : undefined
  return {
    ...pickup,
    time: collects(trip) && zone ? plusMinutes(startsAt, -zone.offsetMinutes) : pickup.time,
    ...(pickup.dropOff
      ? {
          dropOff: {
            ...pickup.dropOff,
            time: point ? plusMinutes(endsAt, point.afterMinutes) : !pickup.dropOff.pointId && zone ? plusMinutes(endsAt, zone.offsetMinutes) : pickup.dropOff.time,
          },
        }
      : {}),
  }
}

/** The choice as a request keeps it (no time slot yet, so no times), or undefined for meet there. */
export function requestTransportOf(setup: TransportSetup | undefined, choice: TransportChoice, zones: Pick<PickupZone, 'id' | 'name'>[]): RequestTransport | undefined {
  if (!setup || choice.trip === 'meet') return undefined
  const place = needsPlace(setup, choice.trip)
  const zone = place ? zones.find((entry) => entry.id === choice.zoneId) : undefined
  const point = needsDropOffPoint(setup, choice.trip) ? setup.dropOffs.find((entry) => entry.id === choice.dropOffId) : undefined
  return {
    trip: choice.trip,
    zoneId: zone?.id ?? '',
    ...(zone ? { zoneName: zone.name } : {}),
    stop: zone ? choice.stop.trim() : '',
    ...(point ? { dropOff: point.name } : {}),
  }
}

/** A request's transport in one line: "Pickup and drop-off · Westin Maui, Kaanapali · drop-off Front Street, Lahaina". */
export function requestTransportLine(transport: RequestTransport): string {
  const place = [transport.stop, transport.zoneName].filter(Boolean).join(', ')
  const back = drops(transport.trip) ? (transport.dropOff ? `drop-off ${transport.dropOff}` : collects(transport.trip) ? 'back to the same place' : '') : ''
  return [TRIP_WORDS[transport.trip], place, back].filter(Boolean).join(' · ')
}

/** The choice a booking's transport was made with, to change it. */
export function choiceOfBooking(pickup: BookingPickup | undefined): TransportChoice {
  if (!pickup) return NO_TRANSPORT
  return { trip: pickup.trip ?? 'pickup', zoneId: pickup.zoneId, stop: pickup.stop, dropOffId: pickup.dropOff?.pointId ?? '' }
}

/* ---------- the checkout link ---------- */

/** The choice as checkout link params: tr (trip), pz (zone), ps (hotel), dp (drop-off point). */
export function encodeChoice(choice: TransportChoice): Record<string, string | undefined> {
  if (choice.trip === 'meet') return {}
  return { tr: choice.trip, pz: choice.zoneId || undefined, ps: choice.stop.trim() || undefined, dp: choice.dropOffId || undefined }
}

export function decodeChoice(query: Record<string, string | string[] | undefined>): TransportChoice | undefined {
  const one = (key: string) => (typeof query[key] === 'string' ? (query[key] as string) : '')
  const trip = one('tr')
  if (!trip) return undefined
  return {
    trip: trip === 'pickup' || trip === 'dropoff' || trip === 'both' ? trip : 'meet',
    zoneId: one('pz'),
    stop: one('ps').slice(0, 120),
    dropOffId: one('dp'),
  }
}

/* ---------- finding a pickup point ---------- */

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export interface PointMatch {
  zone: PickupZone
  /** A hotel or stop in the zone; absent for the zone itself. */
  stop?: string
}

/** Pickup points that match what was typed: zones by name, then their hotels and stops. Nothing typed: every stop. */
export function searchPoints(zones: PickupZone[], query: string, limit = 8): PointMatch[] {
  const q = fold(query)
  const found: { match: PointMatch; score: number; order: number }[] = []
  let order = 0
  for (const zone of zones) {
    const name = fold(zone.name)
    if (!q || name.includes(q)) found.push({ match: { zone }, score: !q ? 1 : name.startsWith(q) ? 0 : 1, order: order++ })
    for (const stop of zone.stops) {
      const words = fold(stop)
      if (!q) found.push({ match: { zone, stop }, score: 2, order: order++ })
      else if (words.includes(q)) found.push({ match: { zone, stop }, score: words.startsWith(q) ? 0 : 1, order: order++ })
    }
  }
  // Nothing typed: the stops, zone by zone; typed: the best matches first.
  const list = q ? found.sort((a, b) => a.score - b.score || a.order - b.order) : found.filter((entry) => entry.match.stop)
  return list.slice(0, Math.max(0, limit)).map((entry) => entry.match)
}

/* ---------- in words ---------- */

/** "Pickup included", "Pickup from $15 a guest", for the review step and summaries. */
export function transportSummary(setup: TransportSetup | undefined, currency: CurrencyCode): string {
  if (!setup) return 'No transport'
  if (setup.mode === 'included') return `${TRIP_WORDS[setup.trips[0]]} included`
  return setup.trips.map((trip) => `${TRIP_WORDS[trip]} ${fareWords(setup, trip, currency).replace(/^Free/, 'free')}`).join(' · ')
}

/** A booking's transport as lines: "Pickup 5:20 AM · Grand Wailea", "Drop-off about 8:10 PM · Front Street, Lahaina". */
export function transportLines(pickup: BookingPickup | undefined): string[] {
  if (!pickup) return []
  const lines: string[] = []
  if (pickup.time) lines.push(`Pickup ${formatTime(pickup.time)} · ${pickup.stop}`)
  if (pickup.dropOff?.time) lines.push(`Drop-off about ${formatTime(pickup.dropOff.time)} · ${pickup.dropOff.stop}`)
  return lines
}

/** One stop of a booking's transport, for the driver: a pickup before the start, a drop-off after the end. */
export interface TransportStop {
  kind: 'pickup' | 'dropoff'
  /** Local ISO. */
  time: string
  /** The pickup zone ('' for a drop-off point). */
  zoneId: string
  stop: string
}

export function stopsOfPickup(pickup: BookingPickup | undefined): TransportStop[] {
  if (!pickup) return []
  const stops: TransportStop[] = []
  if (pickup.time) stops.push({ kind: 'pickup', time: pickup.time, zoneId: pickup.zoneId, stop: pickup.stop })
  if (pickup.dropOff?.time) stops.push({ kind: 'dropoff', time: pickup.dropOff.time, zoneId: pickup.dropOff.pointId ? '' : pickup.zoneId, stop: pickup.dropOff.stop })
  return stops
}
