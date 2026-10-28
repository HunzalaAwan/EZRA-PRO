import type {
  Activity,
  BusinessClosure,
  PriceTier,
  TransferBookingDetails,
  TransferConfig,
  TransferDirection,
  TransferFlight,
  TransferHub,
  TransferHubKind,
  TransferLeg,
  TransferRate,
  TransferService,
  TransferTrip,
  TransferVehicle,
  TransferZone,
} from '@/types'
import type { LedgerStore } from '@/lib/booking-ledger'
import { expandDays, normalizeTime, parseSlotId, slotId } from '@/lib/activity-schedule'

/* ==========================================================================
   Transfers — rides from one place to another: a private vehicle priced per
   vehicle, a shared shuttle priced per seat on set runs, or a driver by the
   hour. Destinations (zones) × vehicle sizes × one way / round trip make the
   price table; a vehicle size is a price tier plus a `TransferVehicle`.
   Capacity is vehicles, not seats: a ride holds its vehicles from pickup for
   its busy time (wait + drive there + drive back), and the vehicles free at a
   time are the fleet less what is out of service and the overlapping holds.
   Pure functions, browser- and server-safe. Money in minor units; times are
   local ISO strings ("YYYY-MM-DDTHH:mm:ss"), like every startsAt.
   ========================================================================== */

/** What the transfer functions read from an activity. A full `Activity` fits. */
export type TransferSource = Pick<Activity, 'id' | 'kind' | 'transfer' | 'priceTiers' | 'maxCapacity' | 'locations'>

/* ---------- words ---------- */

export const TRANSFER_SERVICES: { value: TransferService; label: string; hint: string }[] = [
  { value: 'private', label: 'By trip', hint: 'Pickup and drop-off, priced per vehicle' },
  { value: 'hourly', label: 'By the hour', hint: 'A vehicle and driver for as long as they need' },
  { value: 'shared', label: 'Shared seats', hint: 'Guests share set runs, priced per seat' },
]

export const HUB_KINDS: { value: TransferHubKind; label: string; word: string }[] = [
  { value: 'airport', label: 'Airport', word: 'airport' },
  { value: 'port', label: 'Port', word: 'port' },
  { value: 'station', label: 'Train or bus station', word: 'station' },
  { value: 'other', label: 'Other', word: 'pickup point' },
]

const hubKindOf = (hub: TransferHub | undefined) => HUB_KINDS.find((entry) => entry.value === hub?.kind) ?? HUB_KINDS[0]
const capitalise = (text: string) => (text ? text[0].toUpperCase() + text.slice(1) : text)

/** "airport", "port", "station", "pickup point". No hub reads as an airport (the usual case). */
export function hubWord(hub: TransferHub | undefined): string {
  return hubKindOf(hub).word
}

/** "Airport to hotel", "Hotel to port", "Round trip", "Hotel to hotel", "By the hour". */
export function tripLabel(trip: TransferTrip, hub?: TransferHub): string {
  const word = hubWord(hub)
  switch (trip) {
    case 'from_hub':
      return `${capitalise(word)} to hotel`
    case 'to_hub':
      return `Hotel to ${word}`
    case 'round_trip':
      return 'Round trip'
    case 'between':
      return 'Hotel to hotel'
    case 'hourly':
      return 'By the hour'
  }
}

/** One ride's way: "Arrival", "Departure" (ports and stations too), "Hotel to hotel", "By the hour". */
export function directionLabel(direction: TransferDirection, _hub?: TransferHub): string {
  switch (direction) {
    case 'from_hub':
      return 'Arrival'
    case 'to_hub':
      return 'Departure'
    case 'between':
      return 'Hotel to hotel'
    case 'hourly':
      return 'By the hour'
  }
}

/** The time fields' labels: "Flight lands at" / "Flight takes off at", "Ferry arrives at" / "Ferry leaves at"… */
export function timeFieldLabels(hub: TransferHub | undefined): { arrives: string; leaves: string } {
  switch (hubKindOf(hub).value) {
    case 'port':
      return { arrives: 'Ferry arrives at', leaves: 'Ferry leaves at' }
    case 'station':
      return { arrives: 'Train or bus arrives at', leaves: 'Train or bus leaves at' }
    case 'other':
      return { arrives: 'Arrives at', leaves: 'Leaves at' }
    default:
      return { arrives: 'Flight lands at', leaves: 'Flight takes off at' }
  }
}

/** "per vehicle", "per person", "per vehicle an hour". */
export function transferUnit(activity: Pick<Activity, 'kind' | 'transfer'>): string {
  switch (serviceOf(activity)) {
    case 'shared':
      return 'per person'
    case 'hourly':
      return 'per vehicle an hour'
    default:
      return 'per vehicle'
  }
}

/* ---------- the config ---------- */

export const isTransfer = (activity: Pick<Activity, 'kind'>): boolean => activity.kind === 'transfer'

/** The transfer settings of a transfer; undefined for anything else. */
export function transferOf(activity: Pick<Activity, 'kind' | 'transfer'>): TransferConfig | undefined {
  return activity.kind === 'transfer' ? activity.transfer : undefined
}

/** Private, shared or hourly. A transfer with no settings yet reads as private. */
export function serviceOf(activity: Pick<Activity, 'kind' | 'transfer'>): TransferService {
  return transferOf(activity)?.service ?? 'private'
}

const TRIP_ORDER: Exclude<TransferTrip, 'hourly'>[] = ['from_hub', 'to_hub', 'round_trip', 'between']
const HUB_TRIPS = new Set<TransferTrip>(['from_hub', 'to_hub', 'round_trip'])

/** What guests can book, in the usual order. Hourly: ['hourly']. Without a hub, only hotel to hotel. */
export function tripsOffered(config: TransferConfig): TransferTrip[] {
  if (config.service === 'hourly') return ['hourly']
  const hub = Boolean(config.hub?.name?.trim())
  return TRIP_ORDER.filter((trip) => config.trips.includes(trip) && (hub || !HUB_TRIPS.has(trip)))
}

/** Destinations that are sold. */
export function activeZones(config: TransferConfig): TransferZone[] {
  return config.zones.filter((zone) => zone.active !== false)
}

/**
 * A destination has a price: one vehicle (a shared shuttle: one ticket) with
 * a one-way price there, or a hotel-to-hotel price from or to it. Hourly has
 * no destinations: always true.
 */
export function zoneHasPrice(config: TransferConfig, zoneId: string | undefined): boolean {
  if (config.service === 'hourly') return true
  if (!zoneId) return false
  return config.rates.some((rate) => rate.zoneId === zoneId && rate.oneWay > 0) || (config.pairRates ?? []).some((rate) => rate.oneWay > 0 && (rate.fromZoneId === zoneId || rate.toZoneId === zoneId))
}

export function zoneById(config: TransferConfig | undefined, zoneId: string | undefined): TransferZone | undefined {
  if (!config || !zoneId) return undefined
  return config.zones.find((zone) => zone.id === zoneId)
}

export interface ZoneMatch {
  zone: TransferZone
  /** The hotel or area that matched, when it was one of the zone's places. */
  place?: string
}

/** Lower case, no accents, single spaces: "Cancún" finds "cancun". */
const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** How well a name matches: 0 starts with it, 1 a word starts with it, 2 has it anywhere; -1 no match. */
function matchRank(name: string, query: string): number {
  const text = fold(name)
  if (text.startsWith(query)) return 0
  if (text.split(/[\s\-(),/]+/).some((word) => word.startsWith(query))) return 1
  return text.includes(query) ? 2 : -1
}

/**
 * Destinations and hotels for a search box. Empty query: every destination
 * sold. Otherwise zone names first, then hotels and areas, best matches
 * first; each row is a zone, with the hotel that matched.
 */
export function searchZones(config: TransferConfig, query: string, limit = 8): ZoneMatch[] {
  // A destination left without any price isn't offered.
  const zones = activeZones(config).filter((zone) => zone.name.trim() && zoneHasPrice(config, zone.id))
  const q = fold(query)
  if (!q) return zones.slice(0, limit).map((zone) => ({ zone }))
  const found: { match: ZoneMatch; score: number; order: number }[] = []
  let order = 0
  for (const zone of zones) {
    const byName = matchRank(zone.name, q)
    if (byName >= 0) found.push({ match: { zone }, score: byName, order: order++ })
    for (const place of zone.places) {
      const byPlace = matchRank(place, q)
      if (byPlace >= 0) found.push({ match: { zone, place }, score: 10 + byPlace, order: order++ })
    }
  }
  return found
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.match)
}

const whole = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback
const money = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0)
const slugOf = (text: string) =>
  fold(text)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'zone'

/** Default minutes at the hub before a flight or sailing: 120 at an airport, 60 elsewhere. */
export const defaultCheckIn = (kind: TransferHubKind | undefined) => ((kind ?? 'airport') === 'airport' ? 120 : 60)

/**
 * Transfer settings as saved: trimmed names, stable zone ids, whole numbers,
 * prices above nothing, vehicles and prices only for price tiers that exist
 * (a vehicle whose tier is gone stops selling), and only the parts the
 * service uses.
 */
export function cleanTransferConfig(config: TransferConfig, tiers: Pick<PriceTier, 'id'>[]): TransferConfig {
  const service: TransferService = TRANSFER_SERVICES.some((entry) => entry.value === config.service) ? config.service : 'private'
  const tierIds = new Set(tiers.map((tier) => tier.id))
  const hubName = config.hub?.name?.trim() ?? ''
  const hub: TransferHub | undefined =
    config.hub && hubName
      ? {
          name: hubName,
          ...(config.hub.code?.trim() ? { code: config.hub.code.trim().toUpperCase() } : {}),
          kind: HUB_KINDS.some((entry) => entry.value === config.hub!.kind) ? config.hub.kind : 'airport',
          ...(config.hub.meetingNote?.trim() ? { meetingNote: config.hub.meetingNote.trim() } : {}),
        }
      : undefined

  // Zones: named ones, each with a stable id that is unique in the list.
  const ids = new Set<string>()
  const zones: TransferZone[] = []
  for (const zone of config.zones ?? []) {
    const name = zone.name?.trim() ?? ''
    if (!name) continue
    let id = typeof zone.id === 'string' && /^[\w-]+$/.test(zone.id) ? zone.id : `tz_${slugOf(name)}`
    for (let n = 2; ids.has(id); n++) id = `tz_${slugOf(name)}_${n}`
    ids.add(id)
    const places = [...new Set((zone.places ?? []).map((place) => place.trim()).filter(Boolean))]
    zones.push({ id, name, places, driveMinutes: whole(zone.driveMinutes, 5, 600, 30), ...(zone.active === false ? { active: false } : {}) })
  }
  const zoneIds = new Set(zones.map((zone) => zone.id))
  const byVehicle = service !== 'shared'

  const vehicles: TransferVehicle[] = []
  if (byVehicle) {
    for (const tier of tiers) {
      const vehicle = (config.vehicles ?? []).find((entry) => entry.tierId === tier.id)
      if (!vehicle) continue
      const fleet = whole(vehicle.fleet, 0, 500, 0)
      const out = whole(vehicle.outOfService, 0, fleet, 0)
      vehicles.push({
        tierId: tier.id,
        passengers: whole(vehicle.passengers, 1, 99, 1),
        bags: whole(vehicle.bags, 0, 99, 0),
        fleet,
        ...(out > 0 ? { outOfService: out } : {}),
        ...(vehicle.resourceId ? { resourceId: vehicle.resourceId } : {}),
      })
    }
  }

  const seen = new Set<string>()
  const rates: TransferRate[] =
    service === 'hourly'
      ? []
      : (config.rates ?? []).flatMap((rate) => {
          const key = `${rate.zoneId}|${rate.tierId}`
          const oneWay = money(rate.oneWay)
          if (seen.has(key) || !zoneIds.has(rate.zoneId) || !tierIds.has(rate.tierId) || oneWay <= 0) return []
          seen.add(key)
          const roundTrip = money(rate.roundTrip)
          return [{ zoneId: rate.zoneId, tierId: rate.tierId, oneWay, ...(roundTrip > 0 ? { roundTrip } : {}) }]
        })
  const pairs = service === 'hourly' ? [] : (config.pairRates ?? []).filter((pair) => zoneIds.has(pair.fromZoneId) && zoneIds.has(pair.toZoneId) && pair.fromZoneId !== pair.toZoneId && tierIds.has(pair.tierId) && money(pair.oneWay) > 0)
  const hourly = service === 'hourly' ? (config.hourly ?? []).filter((entry) => tierIds.has(entry.tierId) && money(entry.hour) > 0).map((entry) => ({ tierId: entry.tierId, hour: money(entry.hour) })) : []
  const minHours = whole(config.minHours, 1, 24, 1)
  const maxHours = Math.max(minHours, whole(config.maxHours, 1, 24, Math.max(minHours, 10)))
  const times = (list: string[] | undefined) => [...new Set((list ?? []).map((time) => normalizeTime(time)).filter((time): time is string => Boolean(time)))].sort()

  return {
    service,
    ...(hub ? { hub } : {}),
    trips: service === 'hourly' ? [] : TRIP_ORDER.filter((trip) => (config.trips ?? []).includes(trip)),
    zones: service === 'hourly' ? [] : zones,
    ...(byVehicle ? { vehicles } : {}),
    rates: rates.map((rate) => ({ ...rate })),
    ...(pairs.length > 0 ? { pairRates: pairs.map((pair) => ({ fromZoneId: pair.fromZoneId, toZoneId: pair.toZoneId, tierId: pair.tierId, oneWay: money(pair.oneWay) })) } : {}),
    ...(service === 'hourly' ? { hourly, minHours, maxHours } : {}),
    freeWaitMinutes: whole(config.freeWaitMinutes, 0, 600, 60),
    checkInMinutes: whole(config.checkInMinutes, 0, 600, defaultCheckIn(hub?.kind)),
    askFlight: typeof config.askFlight === 'boolean' ? config.askFlight : hub?.kind === 'airport',
    ...(service === 'shared' && config.shared ? { shared: { fromHubTimes: times(config.shared.fromHubTimes), toHubTimes: times(config.shared.toHubTimes) } } : {}),
    ...(byVehicle ? { maxVehicles: whole(config.maxVehicles, 1, 20, 4) } : {}),
  }
}

/**
 * What is missing before the settings can sell, keyed for the wizard:
 * `transfer.hub`, `transfer.trips`, `transfer.vehicles` (Basics) and
 * `transfer.zones`, `transfer.rate.<zoneId>`, `transfer.hourly`, `transfer.hours` (Pricing).
 */
export function transferConfigErrors(config: TransferConfig, tiers: Pick<PriceTier, 'id' | 'label'>[]): Record<string, string> {
  const errors: Record<string, string> = {}
  const tierIds = new Set(tiers.map((tier) => tier.id))
  const hourly = config.service === 'hourly'
  if (!hourly && (config.trips ?? []).length === 0) errors['transfer.trips'] = 'Pick at least one trip'
  if (!hourly && (config.trips ?? []).some((trip) => HUB_TRIPS.has(trip)) && !config.hub?.name?.trim()) errors['transfer.hub'] = 'Name the airport, port or station'
  if (config.service !== 'shared') {
    const usable = (config.vehicles ?? []).some((vehicle) => tierIds.has(vehicle.tierId) && vehicle.passengers >= 1 && vehicle.fleet - (vehicle.outOfService ?? 0) >= 1)
    if (!usable) errors['transfer.vehicles'] = 'Add a vehicle with at least one passenger and one in your fleet'
  }
  if (hourly) {
    if (!(config.hourly ?? []).some((entry) => tierIds.has(entry.tierId) && entry.hour > 0)) errors['transfer.hourly'] = 'Set a price per hour for at least one vehicle'
    if ((config.minHours ?? 1) > (config.maxHours ?? Number.POSITIVE_INFINITY)) errors['transfer.hours'] = "Fewest hours can't be more than the most"
    return errors
  }
  const zones = activeZones(config).filter((zone) => zone.name.trim())
  if (zones.length === 0) errors['transfer.zones'] = 'Add a destination'
  const priced = config.service === 'shared' ? tierIds : new Set((config.vehicles ?? []).map((vehicle) => vehicle.tierId).filter((id) => tierIds.has(id)))
  for (const zone of zones) {
    if (!(config.rates ?? []).some((rate) => rate.zoneId === zone.id && priced.has(rate.tierId) && rate.oneWay > 0)) {
      errors[`transfer.rate.${zone.id}`] = config.service === 'shared' ? 'Set a price for at least one ticket' : 'Set a price for at least one vehicle'
    }
  }
  return errors
}

/* ---------- vehicles ---------- */

export interface TransferVehicleView extends TransferVehicle {
  /** From the price tier: "Private van". */
  name: string
  /** From the price tier: "4 to 9 passengers · up to 9 suitcases". */
  description: string
  /** The fleet less what is out of service. */
  rentable: number
}

/** The vehicle sizes of a private or hourly transfer, in tier order, with their names. Shared: none. */
export function vehiclesOf(activity: Pick<Activity, 'kind' | 'transfer' | 'priceTiers'>): TransferVehicleView[] {
  const config = transferOf(activity)
  if (!config || config.service === 'shared') return []
  return activity.priceTiers.flatMap((tier) => {
    const vehicle = config.vehicles?.find((entry) => entry.tierId === tier.id)
    if (!vehicle) return []
    return [{ ...vehicle, name: tier.label, description: tier.description ?? '', rentable: Math.max(0, vehicle.fleet - (vehicle.outOfService ?? 0)) }]
  })
}

/** Vehicles that can go out at once (private and hourly); a shared shuttle's seats per run. */
export function fleetSize(activity: Pick<Activity, 'kind' | 'transfer' | 'priceTiers' | 'maxCapacity'>): number {
  const vehicles = vehiclesOf(activity)
  if (vehicles.length === 0) return activity.maxCapacity
  return vehicles.reduce((sum, vehicle) => sum + vehicle.rentable, 0)
}

/** Most passengers one vehicle carries. 0 without vehicles. */
export function biggestVehicle(activity: Pick<Activity, 'kind' | 'transfer' | 'priceTiers'>): number {
  return vehiclesOf(activity).reduce((most, vehicle) => Math.max(most, vehicle.passengers), 0)
}

const maxVehiclesOf = (config: TransferConfig) => whole(config.maxVehicles, 1, 20, 4)

/* ---------- prices ---------- */

/** What a ride is priced by: the trip, the destination (and drop-off zone), and hours. */
export interface TransferPricing {
  trip: TransferTrip
  zoneId?: string
  toZoneId?: string
  hours?: number
}

/** A round trip's price: its own when set, else twice the one way. */
export function roundTripOf(rate: Pick<TransferRate, 'oneWay' | 'roundTrip'>): number {
  return rate.roundTrip && rate.roundTrip > 0 ? rate.roundTrip : 2 * rate.oneWay
}

/**
 * One vehicle's price (shared: one ticket's), minor units, for a trip and
 * destination; hourly: per hour. Undefined: not sold there (a zone that is
 * off, no price, or a price of nothing). Hotel to hotel costs the higher of
 * the two destinations unless a price is set for that pair.
 */
export function transferRateFor(config: TransferConfig | undefined, tierId: string, pricing: TransferPricing): number | undefined {
  if (!config) return undefined
  const positive = (value: number | undefined) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined)
  if (pricing.trip === 'hourly') return positive(config.hourly?.find((entry) => entry.tierId === tierId)?.hour)
  const sold = (zoneId: string | undefined) => {
    const zone = zoneById(config, zoneId)
    return zone && zone.active !== false ? zone : undefined
  }
  const rateIn = (zoneId: string | undefined) => (sold(zoneId) ? config.rates.find((rate) => rate.zoneId === zoneId && rate.tierId === tierId) : undefined)
  switch (pricing.trip) {
    case 'from_hub':
    case 'to_hub':
      return positive(rateIn(pricing.zoneId)?.oneWay)
    case 'round_trip': {
      const rate = rateIn(pricing.zoneId)
      if (!rate) return undefined
      if (rate.roundTrip && rate.roundTrip > 0) return Math.round(rate.roundTrip)
      return positive(rate.oneWay) !== undefined ? roundTripOf(rate) : undefined
    }
    case 'between': {
      if (!sold(pricing.zoneId) || !sold(pricing.toZoneId)) return undefined
      const pair = (config.pairRates ?? []).find(
        (entry) =>
          entry.tierId === tierId &&
          ((entry.fromZoneId === pricing.zoneId && entry.toZoneId === pricing.toZoneId) || (entry.fromZoneId === pricing.toZoneId && entry.toZoneId === pricing.zoneId)),
      )
      if (pair && positive(pair.oneWay) !== undefined) return positive(pair.oneWay)
      const a = positive(rateIn(pricing.zoneId)?.oneWay)
      const b = positive(rateIn(pricing.toZoneId)?.oneWay)
      return a === undefined || b === undefined ? undefined : Math.max(a, b)
    }
  }
}

/** The pricing part of a request. */
export function pricingOf(request: Pick<TransferRequest, 'trip' | 'zoneId' | 'toZoneId' | 'hours'>): TransferPricing {
  return {
    trip: request.trip,
    ...(request.zoneId ? { zoneId: request.zoneId } : {}),
    ...(request.toZoneId ? { toZoneId: request.toZoneId } : {}),
    ...(request.hours !== undefined ? { hours: request.hours } : {}),
  }
}

/* ---------- the vehicle plan ---------- */

export interface VehicleNeed {
  passengers: number
  bags: number
}

export interface VehiclePlan {
  /** Vehicles by size, in tier order. */
  lines: { tierId: string; qty: number }[]
  vehicles: number
  /** Passengers the plan carries. */
  seats: number
  /** Suitcases the plan carries. */
  bagRoom: number
  /** What the vehicles cost before any price change, minor units (hourly: for the hours asked). */
  price: number
}

interface Size {
  tierId: string
  passengers: number
  bags: number
  rate: number
  cap: number
}

/** Every vehicle mix of at most `most` vehicles, each size up to its cap. Fleets are small, so all of them. */
function mixes(sizes: Size[], most: number): number[][] {
  const out: number[][] = []
  const counts = sizes.map(() => 0)
  const walk = (index: number, used: number) => {
    if (index === sizes.length) {
      if (used > 0) out.push([...counts])
      return
    }
    for (let qty = 0; qty <= sizes[index].cap && used + qty <= most; qty++) {
      counts[index] = qty
      walk(index + 1, used + qty)
    }
    counts[index] = 0
  }
  walk(0, 0)
  return out
}

const fits = (sizes: Size[], counts: number[], need: VehicleNeed) => {
  let seats = 0
  let bags = 0
  counts.forEach((qty, index) => {
    seats += qty * sizes[index].passengers
    bags += qty * sizes[index].bags
  })
  return seats >= need.passengers && bags >= need.bags
}

/**
 * The cheapest set of vehicles that carries the passengers and their
 * suitcases and is free (`left`, per tier, when given): one bigger vehicle or
 * several, at most `maxVehicles` (default 4). Ties go to fewer vehicles, then
 * fewer empty seats. `options`: up to three other sets, cheapest first, none
 * with a vehicle it doesn't need. `tooBig`: nothing fits even with the whole
 * fleet, so the group sends a request.
 */
export function planVehicles(
  activity: Pick<Activity, 'kind' | 'transfer' | 'priceTiers'>,
  need: VehicleNeed,
  pricing: TransferPricing,
  left?: Record<string, number>,
): { best: VehiclePlan | null; options: VehiclePlan[]; tooBig: boolean } {
  const config = transferOf(activity)
  if (!config) return { best: null, options: [], tooBig: false }
  const most = maxVehiclesOf(config)
  const want: VehicleNeed = { passengers: Math.max(1, Math.floor(need.passengers || 0)), bags: Math.max(0, Math.floor(need.bags || 0)) }
  const span = pricing.trip === 'hourly' ? Math.max(1, Math.floor(pricing.hours ?? 1)) : 1
  const priced = vehiclesOf(activity).flatMap((vehicle) => {
    const rate = transferRateFor(config, vehicle.tierId, pricing)
    return rate !== undefined && vehicle.rentable > 0 ? [{ vehicle, rate }] : []
  })
  const sizesWith = (cap: (view: TransferVehicleView) => number): Size[] =>
    priced
      .map(({ vehicle, rate }) => ({ tierId: vehicle.tierId, passengers: vehicle.passengers, bags: vehicle.bags, rate, cap: Math.max(0, Math.min(most, cap(vehicle))) }))
      .filter((size) => size.cap > 0)

  // With the whole fleet: does anything fit at all?
  const fleet = sizesWith((vehicle) => vehicle.rentable)
  const tooBig = !mixes(fleet, most).some((counts) => fits(fleet, counts, want))

  const sizes = sizesWith((vehicle) => Math.min(vehicle.rentable, left ? Math.max(0, Math.floor(left[vehicle.tierId] ?? 0)) : vehicle.rentable))
  const plans: (VehiclePlan & { key: string })[] = []
  for (const counts of mixes(sizes, most)) {
    if (!fits(sizes, counts, want)) continue
    // Only sets where every vehicle is needed: taking any one away stops it fitting.
    const needless = counts.some((qty, index) => qty > 0 && fits(sizes, counts.map((value, at) => (at === index ? value - 1 : value)), want))
    if (needless) continue
    let seats = 0
    let bagRoom = 0
    let price = 0
    let vehicles = 0
    const lines: VehiclePlan['lines'] = []
    counts.forEach((qty, index) => {
      if (qty <= 0) return
      const size = sizes[index]
      lines.push({ tierId: size.tierId, qty })
      seats += qty * size.passengers
      bagRoom += qty * size.bags
      price += qty * size.rate * span
      vehicles += qty
    })
    plans.push({ lines, vehicles, seats, bagRoom, price, key: lines.map((line) => `${line.tierId}:${line.qty}`).join('|') })
  }
  plans.sort((a, b) => a.price - b.price || a.vehicles - b.vehicles || a.seats - want.passengers - (b.seats - want.passengers) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
  const strip = ({ key: _key, ...plan }: VehiclePlan & { key: string }): VehiclePlan => plan
  const [first, ...rest] = plans
  return { best: first ? strip(first) : null, options: rest.slice(0, 3).map(strip), tooBig }
}

/** A hand-picked set of vehicles still carries the group, within the fleet and the most per booking. */
export function planFits(activity: Pick<Activity, 'kind' | 'transfer' | 'priceTiers'>, lines: { tierId: string; qty: number }[], need: VehicleNeed): boolean {
  const config = transferOf(activity)
  if (!config) return false
  const vehicles = vehiclesOf(activity)
  let seats = 0
  let bags = 0
  let count = 0
  for (const line of lines) {
    const qty = Math.max(0, Math.floor(line.qty || 0))
    if (qty === 0) continue
    const vehicle = vehicles.find((entry) => entry.tierId === line.tierId)
    if (!vehicle || qty > vehicle.rentable) return false
    seats += qty * vehicle.passengers
    bags += qty * vehicle.bags
    count += qty
  }
  return count >= 1 && count <= maxVehiclesOf(config) && seats >= Math.max(1, need.passengers) && bags >= Math.max(0, need.bags)
}

/** "Private van", "2 × Private car", "Private van and Private car". */
export function vehiclesSentence(activity: Pick<Activity, 'priceTiers'>, lines: { tierId: string; qty: number }[]): string {
  const parts = activity.priceTiers.flatMap((tier) => {
    const qty = lines.filter((line) => line.tierId === tier.id).reduce((sum, line) => sum + Math.max(0, Math.floor(line.qty || 0)), 0)
    return qty > 0 ? [qty === 1 ? tier.label : `${qty} × ${tier.label}`] : []
  })
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

/* ---------- times ---------- */

/**
 * What a guest asks for in the widget, and what travels to checkout.
 * Private and hourly: `at` is when the flight lands (from_hub, round_trip),
 * takes off (to_hub), or the pickup (between, hourly). Shared shuttle: `at`
 * (and `returnAt`) is the run's time at the hub.
 */
export interface TransferRequest {
  trip: TransferTrip
  zoneId?: string
  toZoneId?: string
  passengers: number
  bags: number
  /** Local ISO "YYYY-MM-DDTHH:mm:00": lands (from_hub/round_trip), takes off (to_hub), or the pickup (between, hourly). */
  at: string
  /** Round trip: when the return flight takes off. */
  returnAt?: string
  hours?: number
  place?: string
  dropOff?: string
}

export interface PlannedLeg {
  direction: TransferDirection
  /** When the driver collects them, local ISO. */
  pickupAt: string
  /** Hub legs (private): when the flight lands or takes off. */
  flightAt?: string
  /** The time slot the ride sits in: the half hour its pickup falls in (a shared run: the run). */
  slotStartsAt: string
  /** How long the vehicle is out. */
  busyMinutes: number
  from: string
  to: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

/** A local ISO to a Date on the local clock; undefined when it isn't one. */
function dateOf(iso: string | undefined): Date | undefined {
  const match = iso ? ISO_RE.exec(iso) : null
  if (!match) return undefined
  const [, y, m, d, hh, mm] = match.map(Number)
  const date = new Date(y, m - 1, d, hh, mm, 0, 0)
  return Number.isNaN(date.getTime()) ? undefined : date
}
const isoOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
/** "2026-10-31T14:35" and "2026-10-31T14:35:00" are the same time. */
const normalIso = (iso: string) => {
  const date = dateOf(iso)
  return date ? isoOf(date) : iso
}
const plus = (iso: string, minutes: number) => {
  const date = dateOf(iso)
  if (!date) return iso
  date.setMinutes(date.getMinutes() + minutes)
  return isoOf(date)
}

/**
 * When the driver collects them. Arrivals: when the flight lands (the driver
 * waits `freeWaitMinutes` free). Departures: the flight, less the time at the
 * hub, less the drive, rounded down to 5 minutes (it can fall on the day
 * before). Hotel to hotel and hourly: the time picked.
 */
export function pickupFor(config: TransferConfig, zoneId: string | undefined, direction: TransferDirection, at: string): string {
  if (direction !== 'to_hub') return normalIso(at)
  const date = dateOf(at)
  if (!date) return at
  const drive = zoneById(config, zoneId)?.driveMinutes ?? 0
  date.setMinutes(date.getMinutes() - Math.max(0, config.checkInMinutes) - Math.max(0, drive))
  date.setMinutes(date.getMinutes() - (date.getMinutes() % 5))
  return isoOf(date)
}

/**
 * How long a ride keeps its vehicle, from pickup: an arrival waits and drives
 * there and back; a departure drives there and back; hotel to hotel the
 * longer of the two drives, there and back; hourly the hours. At least 30.
 */
export function busyMinutesFor(config: TransferConfig, zoneId: string | undefined, direction: TransferDirection, hours?: number, toZoneId?: string): number {
  const drive = (id: string | undefined) => Math.max(0, zoneById(config, id)?.driveMinutes ?? 0)
  let minutes: number
  switch (direction) {
    case 'from_hub':
      minutes = Math.max(0, config.freeWaitMinutes) + 2 * drive(zoneId)
      break
    case 'to_hub':
      minutes = 2 * drive(zoneId)
      break
    case 'between':
      minutes = 2 * Math.max(drive(zoneId), drive(toZoneId))
      break
    case 'hourly':
      minutes = Math.max(1, Math.floor(hours ?? 1)) * 60
      break
  }
  return Math.max(30, minutes)
}

/** The start of the time slot a time falls in: down to the half hour (or `everyMinutes`). */
export function slotStartOf(localIso: string, everyMinutes = 30): string {
  const date = dateOf(localIso)
  if (!date) return localIso
  const every = Math.max(1, Math.floor(everyMinutes))
  const minutes = date.getHours() * 60 + date.getMinutes()
  const start = minutes - (minutes % every)
  date.setHours(Math.floor(start / 60), start % 60, 0, 0)
  return isoOf(date)
}

/** "Cancun International Airport (CUN)". */
const hubLabelOf = (hub: TransferHub | undefined) => (hub ? `${hub.name}${hub.code ? ` (${hub.code})` : ''}` : '')

/**
 * The rides a request makes: one, or two for a round trip (the arrival at
 * `at`, the departure at `returnAt`), in time order, each with its pickup,
 * time slot and how long the vehicle is out.
 */
export function legsFor(activity: TransferSource, request: TransferRequest): PlannedLeg[] {
  const config = transferOf(activity)
  if (!config) return []
  const shared = config.service === 'shared'
  const zone = zoneById(config, request.zoneId)
  const hub = hubLabelOf(config.hub)
  const stay = request.place?.trim() || zone?.name || ''
  const leg = (direction: TransferDirection, at: string): PlannedLeg | undefined => {
    if (!dateOf(at)) return undefined
    const busyMinutes = busyMinutesFor(config, request.zoneId, direction, request.hours, request.toZoneId)
    if (shared) {
      // A shared run: the time is the run's at the hub. Departures are collected the drive before it.
      const run = normalIso(at)
      const pickupAt = direction === 'to_hub' ? pickupFor({ ...config, checkInMinutes: 0 }, request.zoneId, 'to_hub', run) : run
      return { direction, pickupAt, slotStartsAt: run, busyMinutes, from: direction === 'to_hub' ? stay : hub, to: direction === 'to_hub' ? hub : stay }
    }
    const pickupAt = pickupFor(config, request.zoneId, direction, at)
    const base = { direction, pickupAt, slotStartsAt: slotStartOf(pickupAt), busyMinutes }
    switch (direction) {
      case 'from_hub':
        return { ...base, flightAt: normalIso(at), from: hub, to: stay }
      case 'to_hub':
        return { ...base, flightAt: normalIso(at), from: stay, to: hub }
      case 'between':
        return { ...base, from: stay, to: request.dropOff?.trim() || zoneById(config, request.toZoneId)?.name || '' }
      case 'hourly':
        return { ...base, from: request.place?.trim() ?? '', to: request.dropOff?.trim() || request.place?.trim() || '' }
    }
  }
  const legs: (PlannedLeg | undefined)[] =
    request.trip === 'round_trip'
      ? [leg('from_hub', request.at), request.returnAt ? leg('to_hub', request.returnAt) : undefined]
      : [leg(request.trip, request.at)]
  return legs.filter((entry): entry is PlannedLeg => Boolean(entry)).sort((a, b) => (a.pickupAt < b.pickupAt ? -1 : a.pickupAt > b.pickupAt ? 1 : 0))
}

type ErrorSource = TransferSource & Partial<Pick<Activity, 'noticeHours' | 'schedules' | 'scheduleChanges' | 'bookingWindow' | 'runsOnClosures'>>

/** Start times open on a day, without the notice or the booking window. */
const openTimesOn = (activity: ErrorSource, dateKey: string) =>
  new Set(expandDays(activity, dateKey, dateKey).flatMap((day) => day.slots.map((slot) => slot.time)))

/**
 * What is wrong with a request, under the field it belongs to: `zone`, `at`,
 * `returnAt`, `passengers`, `hours`. Empty when it can be booked now.
 */
export function requestErrors(activity: ErrorSource, request: TransferRequest, nowIso: string): Record<string, string> {
  const errors: Record<string, string> = {}
  const config = transferOf(activity)
  if (!config) return errors
  const hourly = request.trip === 'hourly'
  const zoned = (id: string | undefined) => {
    const zone = zoneById(config, id)
    return Boolean(zone && zone.active !== false)
  }
  if (!hourly && (!zoned(request.zoneId) || (request.trip === 'between' && !zoned(request.toZoneId)))) errors.zone = "Pick where you're going."
  else if (!hourly && (!zoneHasPrice(config, request.zoneId) || (request.trip === 'between' && !zoneHasPrice(config, request.toZoneId)))) {
    errors.zone = "We don't drive there yet. Pick the nearest area, or send us a request."
  }
  if (!(request.passengers >= 1)) errors.passengers = 'Add at least one passenger.'
  if (hourly) {
    const min = config.minHours ?? 1
    const max = config.maxHours ?? 24
    const hours = request.hours ?? 0
    if (!(hours >= min && hours <= max)) errors.hours = `Book between ${min} and ${max} hours.`
  }
  if (!dateOf(request.at)) errors.at = 'Pick a date and time.'
  if (request.trip === 'round_trip') {
    if (!request.returnAt || !dateOf(request.returnAt)) errors.returnAt = 'Pick when you leave.'
    else if (dateOf(request.at) && normalIso(request.returnAt) <= normalIso(request.at)) errors.returnAt = 'Your return has to be after you arrive.'
  }

  const now = normalIso(nowIso)
  const notice = Math.max(0, activity.noticeHours ?? 0)
  const opensAt = notice > 0 ? plus(now, notice * 60) : now
  const timeKey = (direction: TransferDirection) => (request.trip === 'round_trip' && direction === 'to_hub' ? 'returnAt' : 'at')
  const legs = legsFor(activity, request)
  // A round trip's return pickup comes after the arrival has reached the stay (landing, then the drive).
  if (request.trip === 'round_trip' && !errors.returnAt) {
    const arrival = legs.find((leg) => leg.direction === 'from_hub')
    const back = legs.find((leg) => leg.direction === 'to_hub')
    const drive = Math.max(0, zoneById(config, request.zoneId)?.driveMinutes ?? 0)
    if (arrival && back && back.pickupAt < plus(arrival.pickupAt, drive)) errors.returnAt = 'Your return has to be after you arrive.'
  }
  for (const leg of legs) {
    const key = timeKey(leg.direction)
    if (errors[key]) continue
    if (leg.pickupAt < now) errors[key] = "Pick a time that hasn't passed."
    else if (leg.pickupAt < opensAt) errors[key] = `Book at least ${notice} hours ahead. Need it sooner? Send a request.`
    else if (!openTimesOn(activity, leg.slotStartsAt.slice(0, 10)).has(leg.slotStartsAt.slice(11, 16))) {
      errors[key] = `We don't drive at ${leg.pickupAt.slice(11, 16)}. Pick another time or send a request.`
    }
  }
  return errors
}

/**
 * The open start times on a day: the half-hour grid of the hours driven
 * (private and hourly), or the run times (shared). Seasons, closed days and,
 * with `nowIso`, the notice and booking window apply.
 */
export function transferTimesOn(
  activity: Activity,
  dateKey: string,
  ctx: { nowIso?: string; closures?: BusinessClosure[]; holidays?: { country: string; enabled: boolean } | null } = {},
): string[] {
  const days = expandDays(activity, dateKey, dateKey, {
    closures: ctx.closures ?? [],
    holidays: ctx.holidays ?? null,
    ...(ctx.nowIso ? { bookable: { nowIso: ctx.nowIso } } : {}),
  })
  return [...new Set(days.flatMap((day) => day.slots.map((slot) => slot.time)))].sort()
}

/** The time slot id for a ride starting in the slot at `startsAt`: a `gen_…` id the server reads back as the seeded slot at that time. */
export function transferSlotId(activity: Pick<Activity, 'id' | 'locations'>, startsAt: string): string {
  return slotId(activity.id, startsAt.slice(0, 10), startsAt.slice(11, 16), activity.locations[0]?.locationId)
}

/** What a booking keeps of a request: the trip, who, what vehicles, and each leg with its slot and flight. */
export function bookingDetailsOf(
  activity: TransferSource,
  request: TransferRequest,
  args: {
    vehicles: { tierId: string; qty: number }[]
    departureIds: string[]
    flights?: (TransferFlight | undefined)[]
    place: string
    dropOff?: string
    note?: string
  },
): TransferBookingDetails {
  const service = serviceOf(activity)
  const place = args.place.trim()
  const dropOff = args.dropOff?.trim()
  const legs: TransferLeg[] = legsFor(activity, { ...request, place, dropOff }).map((leg, index) => {
    const flight = args.flights?.[index]
    return {
      direction: leg.direction,
      pickupAt: leg.pickupAt,
      departureId: args.departureIds[index] ?? '',
      from: leg.from,
      to: leg.to,
      ...(flight && flight.number.trim() ? { flight: { number: normalizeFlight(flight.number), ...(flight.airline?.trim() ? { airline: flight.airline.trim() } : {}), at: normalIso(flight.at) } } : {}),
    }
  })
  const note = args.note?.trim()
  return {
    service,
    trip: request.trip,
    ...(request.trip !== 'hourly' && request.zoneId ? { zoneId: request.zoneId } : {}),
    ...(request.trip === 'between' && request.toZoneId ? { toZoneId: request.toZoneId } : {}),
    passengers: Math.max(1, Math.floor(request.passengers || 1)),
    bags: Math.max(0, Math.floor(request.bags || 0)),
    vehicles: service === 'shared' ? [] : args.vehicles.filter((line) => line.qty > 0).map((line) => ({ tierId: line.tierId, qty: Math.floor(line.qty) })),
    place,
    ...(dropOff ? { dropOff } : {}),
    ...(request.trip === 'hourly' ? { hours: Math.max(1, Math.floor(request.hours ?? 1)) } : {}),
    legs,
    ...(note ? { note } : {}),
  }
}

/* ---------- flights ---------- */

/** "AA 1234", "aa1234", "B6 512", "Y4 3010A". */
export const FLIGHT_NUMBER: RegExp = /^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/i

/** "aa1234" → "AA 1234". Anything that isn't a flight number comes back trimmed and in capitals. */
export function normalizeFlight(value: string): string {
  const compact = value.trim().toUpperCase().replace(/\s+/g, '')
  const match = /^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/.exec(compact)
  return match ? `${match[1]} ${match[2]}` : value.trim().toUpperCase()
}

const AIRLINES: Record<string, string> = {
  AA: 'American Airlines',
  UA: 'United',
  DL: 'Delta',
  WN: 'Southwest',
  B6: 'JetBlue',
  AS: 'Alaska',
  NK: 'Spirit',
  F9: 'Frontier',
  AC: 'Air Canada',
  WS: 'WestJet',
  BA: 'British Airways',
  VS: 'Virgin Atlantic',
  IB: 'Iberia',
  LH: 'Lufthansa',
  AF: 'Air France',
  KL: 'KLM',
  AM: 'Aeroméxico',
  Y4: 'Volaris',
  VB: 'Viva Aerobus',
  CM: 'Copa',
  AV: 'Avianca',
  LA: 'LATAM',
}

/** The airline from the flight number's two-character code; undefined when we don't know it (the guest types it). */
export function airlineOf(flightNumber: string): string | undefined {
  const number = normalizeFlight(flightNumber)
  if (!FLIGHT_NUMBER.test(number)) return undefined
  return AIRLINES[number.slice(0, 2)]
}

/* ---------- holds: which vehicles are out when ---------- */

/** A booking's vehicles of one size, out from `fromMs` to `toMs`. */
export interface TransferHold {
  reference: string
  tierId: string
  qty: number
  fromMs: number
  toMs: number
}

/** One hold per leg per vehicle size: from pickup for the leg's busy time. A shared shuttle holds no vehicles. */
export function holdsOfDetails(activity: TransferSource, details: TransferBookingDetails, reference: string): TransferHold[] {
  const config = transferOf(activity)
  if (!config) return []
  const holds: TransferHold[] = []
  for (const leg of details.legs) {
    const start = dateOf(leg.pickupAt)
    if (!start) continue
    const fromMs = start.getTime()
    const toMs = fromMs + busyMinutesFor(config, details.zoneId, leg.direction, details.hours, details.toZoneId) * 60_000
    for (const line of details.vehicles) {
      if (line.qty > 0) holds.push({ reference, tierId: line.tierId, qty: line.qty, fromMs, toMs })
    }
  }
  return holds
}

/**
 * Vehicles of each size free for a ride from `startsAt` for `minutes`: what
 * can go out, less every hold that overlaps, never below 0. `exceptReference`
 * leaves a booking's own holds out (when its ride is being changed).
 */
export function vehiclesLeftAt(
  activity: Pick<Activity, 'kind' | 'transfer' | 'priceTiers'>,
  holds: TransferHold[],
  startsAt: string,
  minutes: number,
  exceptReference?: string,
): Record<string, number> {
  const start = dateOf(startsAt)?.getTime() ?? Number.NaN
  const end = start + Math.max(1, minutes) * 60_000
  const out: Record<string, number> = {}
  for (const vehicle of vehiclesOf(activity)) {
    let taken = 0
    if (Number.isFinite(start)) {
      for (const hold of holds) {
        if (hold.tierId !== vehicle.tierId || (exceptReference && hold.reference === exceptReference)) continue
        if (hold.fromMs < end && hold.toMs > start) taken += hold.qty
      }
    }
    out[vehicle.tierId] = Math.max(0, vehicle.rentable - taken)
  }
  return out
}

/** The ride details are this activity's: every vehicle is one of its sizes, and gen slot ids name it. */
function belongsTo(activity: TransferSource, details: TransferBookingDetails): boolean {
  const tiers = new Set(activity.priceTiers.map((tier) => tier.id))
  if (!details.vehicles.every((line) => tiers.has(line.tierId))) return false
  return details.legs.every((leg) => {
    const parsed = leg.departureId ? parseSlotId(leg.departureId) : null
    return !parsed || parsed.activityId === activity.id
  })
}

/**
 * This browser's bookings as holds: ledger entries of this activity with a
 * ride (their changed ride when one was saved; none once cancelled), and
 * changed rides of seeded bookings. `replaced`: seeded bookings whose server
 * holds are stale (moved or cancelled here); leave those references out of
 * the server holds before adding these.
 */
export function ledgerHolds(activity: TransferSource & Pick<Activity, 'slug'>, store: LedgerStore): { holds: TransferHold[]; replaced: string[] } {
  const holds: TransferHold[] = []
  const replaced: string[] = []
  const booked = new Set(store.entries.map((entry) => entry.reference))
  for (const entry of store.entries) {
    if (entry.activitySlug !== activity.slug || !entry.transfer) continue
    const change = store.changes[entry.reference] ?? store.changes[entry.id]
    if (change?.cancelled) continue
    holds.push(...holdsOfDetails(activity, change?.transfer ?? entry.transfer, entry.reference))
  }
  for (const [reference, change] of Object.entries(store.changes)) {
    if (booked.has(reference)) continue
    if (change.transfer && !belongsTo(activity, change.transfer)) continue
    if (!change.transfer && !change.cancelled) continue
    replaced.push(reference)
    if (!change.cancelled && change.transfer) holds.push(...holdsOfDetails(activity, change.transfer, reference))
  }
  return { holds, replaced }
}

/* ---------- links: the widget's request in a checkout URL ---------- */

const TRIPS: TransferTrip[] = ['from_hub', 'to_hub', 'round_trip', 'between', 'hourly']

/**
 * A request as query keys: `tt` trip, `z` zone, `z2` to-zone, `px`
 * passengers, `bg` suitcases, `at` first time, `rt` return time, `hr` hours,
 * `pl` place, `do` drop-off. Times without seconds: "2026-10-31T14:35".
 */
export function encodeTransferQuery(request: TransferRequest): Record<string, string> {
  const out: Record<string, string> = { tt: request.trip }
  if (request.zoneId) out.z = request.zoneId
  if (request.toZoneId) out.z2 = request.toZoneId
  out.px = String(Math.max(1, Math.floor(request.passengers || 1)))
  out.bg = String(Math.max(0, Math.floor(request.bags || 0)))
  if (request.at) out.at = normalIso(request.at).slice(0, 16)
  if (request.returnAt) out.rt = normalIso(request.returnAt).slice(0, 16)
  if (request.hours !== undefined) out.hr = String(Math.max(1, Math.floor(request.hours)))
  if (request.place?.trim()) out.pl = request.place.trim()
  if (request.dropOff?.trim()) out.do = request.dropOff.trim()
  return out
}

/** The request back from a query, with every number clamped. Undefined without a known trip, its zone(s) or a time. */
export function decodeTransferQuery(query: Record<string, string | string[] | undefined>): TransferRequest | undefined {
  const read = (key: string) => {
    const raw = query[key]
    const value = Array.isArray(raw) ? raw[0] : raw
    return typeof value === 'string' ? value.trim() : ''
  }
  const trip = read('tt') as TransferTrip
  if (!TRIPS.includes(trip)) return undefined
  const zoneRe = /^[\w-]{1,80}$/
  const zoneId = read('z')
  const toZoneId = read('z2')
  if (trip !== 'hourly' && !zoneRe.test(zoneId)) return undefined
  if (trip === 'between' && !zoneRe.test(toZoneId)) return undefined
  const at = dateOf(read('at'))
  if (!at) return undefined
  const back = dateOf(read('rt'))
  const count = (key: string, min: number, max: number, fallback: number) => {
    const value = Number(read(key))
    return read(key) !== '' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.floor(value))) : fallback
  }
  const passengers = count('px', 1, 99, 1)
  const text = (key: string) => read(key).slice(0, 200)
  return {
    trip,
    ...(trip !== 'hourly' ? { zoneId } : {}),
    ...(trip === 'between' ? { toZoneId } : {}),
    passengers,
    bags: count('bg', 0, 99, 0),
    at: isoOf(at),
    ...(trip === 'round_trip' && back ? { returnAt: isoOf(back) } : {}),
    ...(trip === 'hourly' ? { hours: count('hr', 1, 24, 1) } : {}),
    ...(text('pl') ? { place: text('pl') } : {}),
    ...(text('do') ? { dropOff: text('do') } : {}),
  }
}
