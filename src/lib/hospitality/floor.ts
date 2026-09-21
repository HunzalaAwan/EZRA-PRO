import type { DiningSettings, DiningTable, FloorZone, ServicePeriod, TableShape } from './types'

/* ==========================================================================
   The floor and the hours — tables by zone with a grid position for the
   floor map, and the service periods, ordering windows and booking rules
   the reservation engine runs on.
   ========================================================================== */

type TableSpec = [name: string, seats: number, minSeats: number, shape: TableShape, col: number, row: number, colSpan?: number, rowSpan?: number, joinable?: boolean]

interface ZoneSpec {
  id: string
  name: string
  description: string
  outdoor: boolean
  tables: TableSpec[]
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

/* --------------------------------------------------------------------------
   Saltline — rail, terrace, dining room, bar
   -------------------------------------------------------------------------- */

const SALTLINE_ZONES: ZoneSpec[] = [
  {
    id: 'rail',
    name: 'Caldera rail',
    description: 'Six two-tops on the edge with the western view. Booked first every night.',
    outdoor: true,
    tables: [
      ['Rail 1', 2, 1, 'square', 1, 1],
      ['Rail 2', 2, 1, 'square', 2, 1],
      ['Rail 3', 2, 1, 'square', 3, 1],
      ['Rail 4', 2, 1, 'square', 4, 1],
      ['Rail 5', 2, 1, 'square', 5, 1],
      ['Rail 6', 2, 1, 'square', 6, 1],
    ],
  },
  {
    id: 'terrace',
    name: 'Terrace',
    description: 'Eight four-tops under the vines. T7 and T8 push together for eight.',
    outdoor: true,
    tables: [
      ['T1', 4, 2, 'round', 1, 1],
      ['T2', 4, 2, 'round', 2, 1],
      ['T3', 4, 2, 'round', 3, 1],
      ['T4', 4, 2, 'round', 4, 1],
      ['T5', 4, 2, 'square', 1, 2],
      ['T6', 4, 2, 'square', 2, 2],
      ['T7', 4, 2, 'rect', 3, 2, 1, 1, true],
      ['T8', 4, 2, 'rect', 4, 2, 1, 1, true],
    ],
  },
  {
    id: 'room',
    name: 'Dining room',
    description: 'Inside, cool, and the only place we seat parties of eight or more.',
    outdoor: false,
    tables: [
      ['D1', 2, 1, 'square', 1, 1],
      ['D2', 2, 1, 'square', 2, 1],
      ['D3', 4, 2, 'square', 3, 1],
      ['D4', 4, 2, 'square', 4, 1],
      ['D5', 6, 4, 'rect', 1, 2, 2, 1],
      ['D6', 8, 6, 'round', 3, 2, 2, 1],
    ],
  },
  {
    id: 'bar',
    name: 'Bar',
    description: 'Four high tables for two. Walk-ins only, no reservations.',
    outdoor: false,
    tables: [
      ['Bar 1', 2, 1, 'high', 1, 1],
      ['Bar 2', 2, 1, 'high', 2, 1],
      ['Bar 3', 2, 1, 'high', 3, 1],
      ['Bar 4', 2, 1, 'high', 4, 1],
    ],
  },
]

const SALTLINE_PERIODS: ServicePeriod[] = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    startTime: '08:30',
    endTime: '11:30',
    lastSeating: '11:00',
    turnMinutes: { upTo2: 60, upTo4: 75, upTo6: 90, larger: 90 },
    slotMinutes: 30,
    maxCoversPerSlot: 16,
    weekdays: EVERY_DAY,
  },
  {
    id: 'lunch',
    name: 'Lunch',
    startTime: '12:30',
    endTime: '15:30',
    lastSeating: '14:45',
    turnMinutes: { upTo2: 75, upTo4: 90, upTo6: 105, larger: 120 },
    slotMinutes: 15,
    maxCoversPerSlot: 12,
    weekdays: EVERY_DAY,
  },
  {
    id: 'dinner',
    name: 'Dinner',
    startTime: '18:30',
    endTime: '23:00',
    lastSeating: '21:30',
    turnMinutes: { upTo2: 90, upTo4: 120, upTo6: 150, larger: 150 },
    slotMinutes: 15,
    maxCoversPerSlot: 14,
    weekdays: EVERY_DAY,
  },
]

const SALTLINE_SETTINGS: DiningSettings = {
  periods: SALTLINE_PERIODS,
  ordering: {
    pickup: { enabled: true, startTime: '09:00', endTime: '22:00', leadMinutes: 25, weekdays: EVERY_DAY },
    delivery: {
      enabled: true,
      startTime: '12:00',
      endTime: '22:00',
      leadMinutes: 40,
      weekdays: EVERY_DAY,
      zones: [
        { id: 'oia', name: 'Oia village', fee: 300, minOrder: 2000, minutes: 20 },
        { id: 'finikia', name: 'Finikia & Tholos', fee: 500, minOrder: 2500, minutes: 30 },
        { id: 'imerovigli', name: 'Imerovigli', fee: 800, minOrder: 3500, minutes: 40 },
      ],
    },
    dineIn: { enabled: true },
  },
  closures: [
    { date: '2026-10-28', reason: 'Ochi Day' },
    { date: '2026-11-03', reason: 'Kitchen deep clean' },
  ],
  depositFromParty: 6,
  depositPerCover: 2000,
  graceMinutes: 15,
  maxOnlineParty: 8,
}

/* --------------------------------------------------------------------------
   Casa Vela Kitchen — rooftop, kitchen room, courtyard
   -------------------------------------------------------------------------- */

const CASA_VELA_ZONES: ZoneSpec[] = [
  {
    id: 'rooftop',
    name: 'Rooftop',
    description: 'Twenty-four covers facing the river. Closed in heavy wind.',
    outdoor: true,
    tables: [
      ['R1', 2, 1, 'square', 1, 1],
      ['R2', 2, 1, 'square', 2, 1],
      ['R3', 4, 2, 'round', 3, 1],
      ['R4', 4, 2, 'round', 4, 1],
      ['R5', 4, 2, 'rect', 1, 2, 1, 1, true],
      ['R6', 4, 2, 'rect', 2, 2, 1, 1, true],
      ['R7', 4, 2, 'square', 3, 2],
    ],
  },
  {
    id: 'kitchen',
    name: 'Kitchen room',
    description: 'The vaulted room by the pass. Fado on Fridays and Saturdays.',
    outdoor: false,
    tables: [
      ['K1', 2, 1, 'square', 1, 1],
      ['K2', 2, 1, 'square', 2, 1],
      ['K3', 4, 2, 'square', 3, 1],
      ['K4', 4, 2, 'square', 4, 1],
      ['K5', 4, 2, 'square', 1, 2],
      ['K6', 6, 4, 'rect', 2, 2, 2, 1],
      ['K7', 8, 6, 'rect', 4, 2, 2, 1],
      ['K8', 2, 1, 'high', 1, 3],
    ],
  },
  {
    id: 'courtyard',
    name: 'Courtyard',
    description: 'Four tables under the lemon tree, breakfast and lunch only.',
    outdoor: true,
    tables: [
      ['C1', 2, 1, 'round', 1, 1],
      ['C2', 2, 1, 'round', 2, 1],
      ['C3', 4, 2, 'round', 3, 1],
      ['C4', 4, 2, 'round', 4, 1],
    ],
  },
]

const CASA_VELA_PERIODS: ServicePeriod[] = [
  {
    id: 'breakfast',
    name: 'Breakfast',
    startTime: '07:30',
    endTime: '10:30',
    lastSeating: '10:00',
    turnMinutes: { upTo2: 60, upTo4: 60, upTo6: 75, larger: 90 },
    slotMinutes: 30,
    maxCoversPerSlot: 20,
    weekdays: EVERY_DAY,
  },
  {
    id: 'lunch',
    name: 'Lunch',
    startTime: '12:30',
    endTime: '15:00',
    lastSeating: '14:15',
    turnMinutes: { upTo2: 75, upTo4: 90, upTo6: 105, larger: 120 },
    slotMinutes: 15,
    maxCoversPerSlot: 10,
    weekdays: EVERY_DAY,
  },
  {
    id: 'dinner',
    name: 'Dinner',
    startTime: '19:00',
    endTime: '23:00',
    lastSeating: '21:45',
    turnMinutes: { upTo2: 90, upTo4: 120, upTo6: 150, larger: 150 },
    slotMinutes: 15,
    maxCoversPerSlot: 12,
    weekdays: [0, 2, 3, 4, 5, 6],
  },
]

const CASA_VELA_SETTINGS: DiningSettings = {
  periods: CASA_VELA_PERIODS,
  ordering: {
    pickup: { enabled: true, startTime: '12:00', endTime: '22:00', leadMinutes: 20, weekdays: EVERY_DAY },
    delivery: {
      enabled: true,
      startTime: '12:00',
      endTime: '22:30',
      leadMinutes: 35,
      weekdays: EVERY_DAY,
      zones: [
        { id: 'alfama', name: 'Alfama & Baixa', fee: 250, minOrder: 1500, minutes: 20 },
        { id: 'graca', name: 'Graça & Mouraria', fee: 350, minOrder: 2000, minutes: 25 },
        { id: 'chiado', name: 'Chiado & Príncipe Real', fee: 450, minOrder: 2500, minutes: 35 },
      ],
    },
    dineIn: { enabled: true },
  },
  closures: [{ date: '2026-12-24', reason: 'Christmas Eve — hotel guests only' }],
  depositFromParty: 7,
  depositPerCover: 1500,
  graceMinutes: 15,
  maxOnlineParty: 8,
}

/* --------------------------------------------------------------------------
   Build
   -------------------------------------------------------------------------- */

const SHORT: Record<string, string> = { tnt_saltline: 'sl', tnt_casavela: 'cv' }
const ZONES: Record<string, ZoneSpec[]> = { tnt_saltline: SALTLINE_ZONES, tnt_casavela: CASA_VELA_ZONES }
const SETTINGS: Record<string, DiningSettings> = { tnt_saltline: SALTLINE_SETTINGS, tnt_casavela: CASA_VELA_SETTINGS }

export function getFloor(tenantId: string): { zones: FloorZone[]; tables: DiningTable[] } {
  const short = SHORT[tenantId] ?? 'xx'
  const specs = ZONES[tenantId] ?? []
  const zones: FloorZone[] = specs.map((zone, index) => ({
    id: `zone_${short}_${zone.id}`,
    name: zone.name,
    description: zone.description,
    sortOrder: index,
    outdoor: zone.outdoor,
  }))
  const tables: DiningTable[] = specs.flatMap((zone) =>
    zone.tables.map(([name, seats, minSeats, shape, col, row, colSpan = 1, rowSpan = 1, joinable = false]) => ({
      id: `tbl_${short}_${name.toLowerCase().replace(/\s+/g, '')}`,
      tenantId,
      zoneId: `zone_${short}_${zone.id}`,
      name,
      seats,
      minSeats,
      shape,
      status: 'free' as const,
      joinable,
      col,
      row,
      colSpan,
      rowSpan,
      currentReservationId: null,
      nextReservationId: null,
    })),
  )
  return { zones, tables }
}

export function getDiningSettings(tenantId: string): DiningSettings {
  return SETTINGS[tenantId] ?? SALTLINE_SETTINGS
}

/** Turn time for a party under a period's rules. */
export function turnMinutesFor(period: ServicePeriod, partySize: number): number {
  if (partySize <= 2) return period.turnMinutes.upTo2
  if (partySize <= 4) return period.turnMinutes.upTo4
  if (partySize <= 6) return period.turnMinutes.upTo6
  return period.turnMinutes.larger
}

/** "HH:MM" -> minutes since midnight. */
export function hm(value: string): number {
  const [h, m] = value.split(':').map(Number)
  return h * 60 + m
}

/** minutes since midnight -> "HH:MM". */
export function mh(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Every bookable start time in a period. */
export function seatingTimes(period: ServicePeriod): string[] {
  const out: string[] = []
  for (let t = hm(period.startTime); t <= hm(period.lastSeating); t += period.slotMinutes) out.push(mh(t))
  return out
}
