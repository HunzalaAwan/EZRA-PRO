import type { DiningSettings, ServicePeriod } from './types'

/* ==========================================================================
   Hours — when each kitchen serves, and the windows it takes orders in.
   Tables are booked by phone everywhere, so there is no capacity here.
   ========================================================================== */

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

/* --------------------------------------------------------------------------
   Saltline Kitchen & Terrace — Oia, Santorini
   -------------------------------------------------------------------------- */

const SALTLINE_PERIODS: ServicePeriod[] = [
  { id: 'breakfast', name: 'Breakfast', startTime: '08:30', endTime: '11:30', lastOrders: '11:00', weekdays: EVERY_DAY },
  { id: 'lunch', name: 'Lunch', startTime: '12:30', endTime: '15:30', lastOrders: '14:45', weekdays: EVERY_DAY },
  { id: 'dinner', name: 'Dinner', startTime: '18:30', endTime: '23:00', lastOrders: '22:00', weekdays: EVERY_DAY },
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
    roomService: { enabled: false, startTime: '00:00', endTime: '00:00', leadMinutes: 0, trayCharge: 0 },
  },
  closures: [
    { date: '2026-10-28', reason: 'Ochi Day' },
    { date: '2026-11-03', reason: 'Kitchen deep clean' },
  ],
}

/* --------------------------------------------------------------------------
   Casa Vela Kitchen — Alfama, Lisbon
   -------------------------------------------------------------------------- */

const CASA_VELA_PERIODS: ServicePeriod[] = [
  { id: 'breakfast', name: 'Breakfast', startTime: '07:30', endTime: '10:30', lastOrders: '10:15', weekdays: EVERY_DAY },
  { id: 'lunch', name: 'Lunch', startTime: '12:30', endTime: '15:00', lastOrders: '14:30', weekdays: EVERY_DAY },
  { id: 'dinner', name: 'Dinner', startTime: '19:00', endTime: '23:00', lastOrders: '22:15', weekdays: [0, 2, 3, 4, 5, 6] },
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
    roomService: { enabled: true, startTime: '07:00', endTime: '23:00', leadMinutes: 30, trayCharge: 300 },
  },
  closures: [{ date: '2026-12-24', reason: 'Christmas Eve — hotel guests only' }],
}

/* --------------------------------------------------------------------------
   Lookup and time helpers
   -------------------------------------------------------------------------- */

const SETTINGS: Record<string, DiningSettings> = { tnt_saltline: SALTLINE_SETTINGS, tnt_casavela: CASA_VELA_SETTINGS }

export function getDiningSettings(tenantId: string): DiningSettings {
  return SETTINGS[tenantId] ?? SALTLINE_SETTINGS
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

/** Whether an ordering window is open at a given "HH:MM". */
export function windowOpen(window: { enabled: boolean; startTime: string; endTime: string }, nowTime: string): boolean {
  const now = hm(nowTime)
  return window.enabled && now >= hm(window.startTime) && now < hm(window.endTime)
}
