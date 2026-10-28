import type { Activity, ActivityKind, ActivityTheme, TransferConfig, TransferHub, TransferPairRate, TransferService, TransferTrip, TransferZone } from '@/types'
import { TRANSFER_SERVICES, defaultCheckIn, fleetSize, serviceOf, transferConfigErrors } from '@/lib/transfers'
import { blankTier, type DraftTier } from './pricing-tier-editor'

/* ==========================================================================
   Transfer draft — the wizard's copy of a transfer's settings (service, hub,
   trips, destinations, vehicles, the price table, ride timing), and the
   helpers that turn it into the saved `TransferConfig` and back. A vehicle
   size is a price tier (its name) plus its numbers here, keyed by tier id;
   a shared shuttle's tiers are its tickets. Pure; browser- and server-safe.
   ========================================================================== */

/** The trips a config can offer (hourly is its own service). */
export type DraftTrip = Exclude<TransferTrip, 'hourly'>

export interface DraftVehicle {
  passengers: number
  bags: number
  fleet: number
  outOfService: number
  /** The Resources entry it is (seeded vehicles), carried through an edit. */
  resourceId?: string
}

export interface DraftTransfer {
  service: TransferService
  /** Name may be empty while it is typed. */
  hub: TransferHub
  /** No airport or port: rides between areas only. */
  noHub: boolean
  trips: DraftTrip[]
  zones: TransferZone[]
  /** Per tier id. */
  vehicles: Record<string, DraftVehicle>
  /** `${zoneId}|${tierId}` → minor units; roundTrip 0 = 2 × one way. */
  rates: Record<string, { oneWay: number; roundTrip: number }>
  /** Per tier id: per hour, minor units. */
  hourly: Record<string, number>
  minHours: number
  maxHours: number
  freeWaitMinutes: number
  checkInMinutes: number
  askFlight: boolean
  maxVehicles: number
  /** Shared: which run times go which way. A time in neither list goes both ways. */
  shared: { fromHubTimes: string[]; toHubTimes: string[] }
  /** Hotel-to-hotel prices for given pairs: kept from the saved settings, not edited here. */
  pairRates?: TransferPairRate[]
  /** The rows set aside by a switch to or from a shared shuttle (vehicles ↔ tickets). Never saved. */
  setAside?: DraftTier[] | null
  /** The transfer's own rows (vehicles or tickets), kept while another kind is picked, so switching back brings them and their prices back. Never saved. */
  kept?: DraftTier[] | null
  /**
   * The schedule as it was before another kind was picked (`before`), and as
   * that switch left it (`left`): picked again with the schedule untouched,
   * the run times or hours come back. Never saved.
   */
  keptSchedule?: { before: unknown; left: unknown } | null
  /** The kind, arrival and category it had before With a driver was picked, so Self-drive gives them back. Never saved. */
  keptOther?: { kind: ActivityKind; arrivalMode: 'meet' | 'venue' | 'pickup'; theme: ActivityTheme } | null
}

export const TRIP_ORDER: DraftTrip[] = ['from_hub', 'to_hub', 'round_trip', 'between']

export function defaultTransferDraft(): DraftTransfer {
  return {
    service: 'private',
    hub: { name: '', kind: 'airport' },
    noHub: false,
    trips: ['from_hub', 'to_hub', 'round_trip'],
    // A fixed id so the server and the browser agree on a new draft.
    zones: [{ id: 'tz_first', name: '', places: [], driveMinutes: 30 }],
    vehicles: {},
    rates: {},
    hourly: {},
    minHours: 3,
    maxHours: 10,
    freeWaitMinutes: 60,
    checkInMinutes: 120,
    askFlight: true,
    maxVehicles: 4,
    shared: { fromHubTimes: [], toHubTimes: [] },
  }
}

/** A draft saved before a field existed picks up its default. */
export function normalizeTransferDraft(value: Partial<DraftTransfer> | undefined): DraftTransfer {
  const base = defaultTransferDraft()
  if (!value) return base
  return {
    ...base,
    ...value,
    hub: { ...base.hub, ...value.hub },
    shared: { ...base.shared, ...value.shared },
    zones: Array.isArray(value.zones) ? value.zones : base.zones,
    trips: Array.isArray(value.trips) ? value.trips : base.trips,
    vehicles: value.vehicles ?? {},
    rates: value.rates ?? {},
    hourly: value.hourly ?? {},
  }
}

/* ---------- vehicles and tickets ---------- */

export interface VehiclePreset {
  /** The chip: "Van · 9". */
  short: string
  /** The row's name: "Private van". */
  label: string
  passengers: number
  bags: number
}

/** One click adds a vehicle size with its usual numbers; the name and numbers can be changed. */
export const TRANSFER_VEHICLE_PRESETS: VehiclePreset[] = [
  { short: 'Car', label: 'Private car', passengers: 3, bags: 3 },
  { short: 'SUV', label: 'Private SUV', passengers: 5, bags: 5 },
  { short: 'Van', label: 'Private van', passengers: 9, bags: 9 },
  { short: 'Sprinter', label: 'Sprinter', passengers: 14, bags: 14 },
  { short: 'Minibus', label: 'Minibus', passengers: 20, bags: 20 },
]

/** A vehicle row: a price tier for its name, and its numbers. */
export function vehicleTier(preset: Pick<VehiclePreset, 'label' | 'passengers' | 'bags'>, taken: readonly { id: string }[]): { tier: DraftTier; vehicle: DraftVehicle } {
  const tier = { ...blankTier(preset.label, 0, taken), minQuantity: 0, countsTowardCapacity: true }
  return { tier, vehicle: { passengers: preset.passengers, bags: preset.bags, fleet: 1, outOfService: 0 } }
}

/** A shared shuttle's first tickets: adults, children, and infants on a lap (free, no seat). */
export function starterTickets(taken: readonly { id: string }[]): DraftTier[] {
  const adult = { ...blankTier('Adult', 0, taken), minQuantity: 1 }
  const child = { ...blankTier('Child', 0, [...taken, adult]), ageMin: 3, ageMax: 11 }
  const infant = { ...blankTier('Infant', 0, [...taken, adult, child]), ageMax: 2, countsTowardCapacity: false }
  return [adult, child, infant]
}

/** The rows a service starts with: a car and a van (private, by the hour), or tickets (shared). */
export function starterRows(service: TransferService, taken: readonly { id: string }[]): { tiers: DraftTier[]; vehicles: Record<string, DraftVehicle> } {
  if (service === 'shared') return { tiers: starterTickets(taken), vehicles: {} }
  const car = vehicleTier(TRANSFER_VEHICLE_PRESETS[0], taken)
  const van = vehicleTier(TRANSFER_VEHICLE_PRESETS[2], [...taken, car.tier])
  return { tiers: [car.tier, van.tier], vehicles: { [car.tier.id]: car.vehicle, [van.tier.id]: van.vehicle } }
}

/** One vehicle's numbers, with defaults for a row that has none yet. */
export function vehicleOf(transfer: DraftTransfer, tierId: string): DraftVehicle {
  return transfer.vehicles[tierId] ?? { passengers: 1, bags: 0, fleet: 1, outOfService: 0 }
}

/** Vehicles that can go out: the fleet less what is off the road, across sizes. */
export function fleetOfDraft(transfer: DraftTransfer, tiers: Pick<DraftTier, 'id'>[]): number {
  return tiers.reduce((sum, tier) => {
    const vehicle = vehicleOf(transfer, tier.id)
    return sum + Math.max(0, vehicle.fleet - vehicle.outOfService)
  }, 0)
}

/** "Up to 9 passengers · 9 suitcases" (by the hour: passengers only). */
export function vehicleBlurb(vehicle: Pick<DraftVehicle, 'passengers' | 'bags'>, service: TransferService): string {
  const people = `Up to ${vehicle.passengers} ${vehicle.passengers === 1 ? 'passenger' : 'passengers'}`
  return service === 'hourly' ? people : `${people} · ${vehicle.bags} ${vehicle.bags === 1 ? 'suitcase' : 'suitcases'}`
}

/**
 * A vehicle row's description follows its numbers: written when empty, and
 * rewritten when it names passengers or suitcases that are no longer right.
 * Anything else the owner wrote is kept.
 */
export function vehicleDescription(description: string, vehicle: Pick<DraftVehicle, 'passengers' | 'bags'>, service: TransferService): string {
  const text = description.trim()
  if (!text) return vehicleBlurb(vehicle, service)
  const stalePeople = /\bpassengers?\b/i.test(text) && !new RegExp(`\\b${vehicle.passengers} passengers?\\b`, 'i').test(text)
  const staleBags = /\bsuitcases?\b/i.test(text) && !new RegExp(`\\b${vehicle.bags} suitcases?\\b`, 'i').test(text)
  return stalePeople || staleBags ? vehicleBlurb(vehicle, service) : description
}

/* ---------- prices ---------- */

export const rateKey = (zoneId: string, tierId: string) => `${zoneId}|${tierId}`

/** The lowest price a row sells at: its lowest one way (by the hour: its hourly price). 0 when it has none. */
export function lowestRateOf(transfer: DraftTransfer, tierId: string): number {
  if (transfer.service === 'hourly') return Math.max(0, Math.round(transfer.hourly[tierId] ?? 0))
  const prices = transfer.zones
    .filter((zone) => zone.name.trim() && zone.active !== false)
    .map((zone) => transfer.rates[rateKey(zone.id, tierId)]?.oneWay ?? 0)
    .filter((price) => price > 0)
  return prices.length > 0 ? Math.min(...prices) : 0
}

/** How long a transfer runs, for lists and the calendar: its longest drive, or a driver's fewest hours. */
export function transferLengthOf(transfer: DraftTransfer): number {
  if (transfer.service === 'hourly') return Math.max(1, transfer.minHours) * 60
  const longest = Math.max(0, ...transfer.zones.filter((zone) => zone.name.trim()).map((zone) => Math.floor(zone.driveMinutes || 0)))
  return longest > 0 ? Math.max(15, longest) : 60
}

/* ---------- shared run directions ---------- */

/** Does a run time go from the hub, and to it? A time in neither list goes both ways. */
export function runDirections(shared: DraftTransfer['shared'], time: string): { from: boolean; to: boolean } {
  const from = shared.fromHubTimes.includes(time)
  const to = shared.toHubTimes.includes(time)
  return from || to ? { from, to } : { from: true, to: true }
}

/** The run directions as saved: undefined when every run goes both ways. */
export function sharedOfDraft(shared: DraftTransfer['shared'], runTimes: string[]): TransferConfig['shared'] {
  const times = [...new Set(runTimes)].sort()
  if (times.length === 0) return undefined
  const ways = times.map((time) => ({ time, ...runDirections(shared, time) }))
  if (ways.every((way) => way.from && way.to)) return undefined
  return { fromHubTimes: ways.filter((way) => way.from).map((way) => way.time), toHubTimes: ways.filter((way) => way.to).map((way) => way.time) }
}

/* ---------- draft ↔ config ---------- */

/**
 * The settings as the engine reads them (before `cleanTransferConfig`):
 * the hub only when it is named and on, its meeting note from the Guests
 * step, vehicles and prices on the tier ids, and only the service's parts.
 */
export function configOfDraft(transfer: DraftTransfer, tiers: Pick<DraftTier, 'id'>[], options: { meetingNote?: string; runTimes?: string[] } = {}): TransferConfig {
  const service = transfer.service
  const named = !transfer.noHub && transfer.hub.name.trim().length > 0
  const note = options.meetingNote?.trim()
  const hub: TransferHub | undefined = named
    ? { name: transfer.hub.name, ...(transfer.hub.code?.trim() ? { code: transfer.hub.code } : {}), kind: transfer.hub.kind, ...(note ? { meetingNote: note } : {}) }
    : undefined
  const trips = service === 'hourly' ? [] : transfer.noHub ? transfer.trips.filter((trip) => trip === 'between') : TRIP_ORDER.filter((trip) => transfer.trips.includes(trip))
  const zones = service === 'hourly' ? [] : transfer.zones.map((zone) => ({ ...zone, places: [...zone.places] }))
  const rates =
    service === 'hourly'
      ? []
      : zones.flatMap((zone) =>
          tiers.flatMap((tier) => {
            const rate = transfer.rates[rateKey(zone.id, tier.id)]
            return rate && rate.oneWay > 0 ? [{ zoneId: zone.id, tierId: tier.id, oneWay: rate.oneWay, ...(rate.roundTrip > 0 ? { roundTrip: rate.roundTrip } : {}) }] : []
          }),
        )
  const shared = service === 'shared' ? sharedOfDraft(transfer.shared, options.runTimes ?? []) : undefined
  return {
    service,
    ...(hub ? { hub } : {}),
    trips,
    zones,
    ...(service !== 'shared'
      ? {
          vehicles: tiers.map((tier) => {
            const vehicle = vehicleOf(transfer, tier.id)
            return {
              tierId: tier.id,
              passengers: vehicle.passengers,
              bags: vehicle.bags,
              fleet: vehicle.fleet,
              ...(vehicle.outOfService > 0 ? { outOfService: vehicle.outOfService } : {}),
              ...(vehicle.resourceId ? { resourceId: vehicle.resourceId } : {}),
            }
          }),
        }
      : {}),
    rates,
    ...(service !== 'hourly' && transfer.pairRates && transfer.pairRates.length > 0 ? { pairRates: transfer.pairRates.map((pair) => ({ ...pair })) } : {}),
    ...(service === 'hourly'
      ? { hourly: tiers.flatMap((tier) => ((transfer.hourly[tier.id] ?? 0) > 0 ? [{ tierId: tier.id, hour: transfer.hourly[tier.id] }] : [])), minHours: transfer.minHours, maxHours: transfer.maxHours }
      : {}),
    freeWaitMinutes: transfer.freeWaitMinutes,
    checkInMinutes: transfer.checkInMinutes,
    askFlight: hub ? transfer.askFlight : false,
    ...(shared ? { shared } : {}),
    ...(service !== 'shared' ? { maxVehicles: transfer.maxVehicles } : {}),
  }
}

/** The wizard's draft of saved settings. None saved: a new private transfer's. */
export function transferDraftOf(config: TransferConfig | undefined): DraftTransfer {
  const base = defaultTransferDraft()
  if (!config) return base
  return {
    ...base,
    service: config.service,
    hub: config.hub ? { name: config.hub.name, ...(config.hub.code ? { code: config.hub.code } : {}), kind: config.hub.kind } : base.hub,
    noHub: config.service !== 'hourly' && !config.hub,
    trips: config.trips.length > 0 ? TRIP_ORDER.filter((trip) => config.trips.includes(trip)) : base.trips,
    zones: config.zones.length > 0 ? config.zones.map((zone) => ({ ...zone, places: [...zone.places] })) : base.zones,
    vehicles: Object.fromEntries(
      (config.vehicles ?? []).map((vehicle) => [
        vehicle.tierId,
        { passengers: vehicle.passengers, bags: vehicle.bags, fleet: vehicle.fleet, outOfService: vehicle.outOfService ?? 0, ...(vehicle.resourceId ? { resourceId: vehicle.resourceId } : {}) },
      ]),
    ),
    rates: Object.fromEntries(config.rates.map((rate) => [rateKey(rate.zoneId, rate.tierId), { oneWay: rate.oneWay, roundTrip: rate.roundTrip ?? 0 }])),
    hourly: Object.fromEntries((config.hourly ?? []).map((entry) => [entry.tierId, entry.hour])),
    minHours: config.minHours ?? base.minHours,
    maxHours: config.maxHours ?? base.maxHours,
    freeWaitMinutes: config.freeWaitMinutes,
    checkInMinutes: config.checkInMinutes,
    askFlight: config.askFlight,
    maxVehicles: config.maxVehicles ?? base.maxVehicles,
    shared: config.shared ? { fromHubTimes: [...config.shared.fromHubTimes], toHubTimes: [...config.shared.toHubTimes] } : base.shared,
    ...(config.pairRates && config.pairRates.length > 0 ? { pairRates: config.pairRates.map((pair) => ({ ...pair })) } : {}),
  }
}

/** Switching the hub's type: the time at the hub follows it while it is still the old type's default. */
export function withHubKind(transfer: DraftTransfer, kind: TransferHub['kind']): DraftTransfer {
  const untouched = transfer.checkInMinutes === defaultCheckIn(transfer.hub.kind)
  return {
    ...transfer,
    hub: { ...transfer.hub, kind },
    ...(untouched ? { checkInMinutes: defaultCheckIn(kind) } : {}),
    // A flight number is asked at airports; elsewhere it stays as the owner set it.
    ...(kind === 'airport' && transfer.hub.kind !== 'airport' ? { askFlight: true } : {}),
  }
}

/* ---------- checks ---------- */

const BASICS_KEYS = new Set(['transfer.hub', 'transfer.trips', 'transfer.vehicles', 'transfer.tickets'])

/**
 * What a transfer needs before it can sell, keyed for the field that shows
 * it. Basics: the hub, the trips, the vehicles (or tickets) and their names.
 * Pricing: destinations and their names, a price in each, hourly prices and hours.
 */
export function transferDraftErrors(transfer: DraftTransfer, tiers: Pick<DraftTier, 'id' | 'label' | 'countsTowardCapacity'>[], step: 'basics' | 'pricing'): Record<string, string> {
  const all: Record<string, string> = { ...transferConfigErrors(configOfDraft(transfer, tiers), tiers) }
  if (transfer.service === 'shared' && !tiers.some((tier) => tier.countsTowardCapacity)) all['transfer.tickets'] = 'Add a ticket that takes a seat'
  if (transfer.service !== 'hourly') {
    for (const zone of transfer.zones) if (!zone.name.trim()) all[`transfer.zone.${zone.id}.name`] = 'Name this destination, or remove it'
  }
  tiers.forEach((tier, index) => {
    if (tier.label.trim().length < 2) all[`tiers.${index}.label`] = transfer.service === 'shared' ? 'Name this ticket' : 'Name this vehicle'
  })
  const out: Record<string, string> = {}
  for (const [key, message] of Object.entries(all)) {
    const basics = BASICS_KEYS.has(key) || key.startsWith('tiers.')
    if ((step === 'basics') === basics) out[key] = message
  }
  return out
}

/* ---------- words ---------- */

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** "With a driver, by trip · 5 destinations · 2 vehicles (10 in all)": the Review step's setup line. */
export function transferFacts(transfer: DraftTransfer, tiers: Pick<DraftTier, 'id' | 'label'>[]): string[] {
  const service = `With a driver, ${(TRANSFER_SERVICES.find((entry) => entry.value === transfer.service)?.label ?? 'By trip').toLowerCase()}`
  const zones = transfer.zones.filter((zone) => zone.name.trim()).length
  const fleet = fleetOfDraft(transfer, tiers)
  if (transfer.service === 'hourly') return [service, `${plural(tiers.length, 'vehicle')} (${fleet} in all)`, `${transfer.minHours}–${transfer.maxHours} hours`]
  if (transfer.service === 'shared') return [service, plural(zones, 'destination'), plural(tiers.length, 'ticket')]
  return [service, plural(zones, 'destination'), `${plural(tiers.length, 'vehicle')} (${fleet} in all)`]
}

/** "10 vehicles", "14 seats per run": a transfer's capacity in a few words; null for anything else. */
export function transferCapacityLabel(activity: Pick<Activity, 'kind' | 'transfer' | 'priceTiers' | 'maxCapacity'>): string | null {
  if (activity.kind !== 'transfer') return null
  if (serviceOf(activity) === 'shared') return `${plural(activity.maxCapacity, 'seat')} per run`
  return plural(fleetSize(activity), 'vehicle')
}
