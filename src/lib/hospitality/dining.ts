import { NOW, TODAY_KEY, getCustomersByTenant, isoLocal } from '@/lib/demo'
import { addDays, createRng, hashSeed, rngInt, rngPick, rngWeighted, toDateKey } from '@/lib/utils'
import type { Customer, Tenant } from '@/types'
import { getWorkspaceProfile } from '@/lib/workspace-profile'

import { getDiningSettings, getFloor, hm, mh, seatingTimes, turnMinutesFor } from './floor'
import { getMenu } from './menu'
import type {
  DiningData,
  DiningTable,
  MenuItem,
  Occasion,
  Order,
  OrderLine,
  OrderSource,
  OrderStatus,
  OrderType,
  ReservationSource,
  ReservationStatus,
  ServicePeriod,
  TableReservation,
  TableStatus,
} from './types'

/* ==========================================================================
   Dining — reservations and orders, generated deterministically per tenant
   around the frozen clock (Friday 11 September 2026, 09:00), so the floor is
   mid-breakfast, tonight is nearly full, and the order board has work on it.
   ========================================================================== */

const NOW_MIN = NOW.getHours() * 60 + NOW.getMinutes()

/** How many days either side of today we generate. */
const PAST_DAYS = 14
const FUTURE_DAYS = 21

const RESERVATION_NOTES = [
  'Window or rail table if at all possible.',
  'Celebrating a 40th — a candle in the dessert would be lovely.',
  'One guest uses a wheelchair.',
  'Running 10 minutes late from the ferry, please hold the table.',
  'Quiet corner please, business dinner.',
  'Two of us are vegetarian.',
  'Bringing a bottle from the vineyard visit — corkage OK?',
  'Proposal planned before dessert. Please do not rush the courses.',
]

const ALLERGIES = ['Shellfish', 'Nuts', 'Gluten (coeliac)', 'Dairy', 'Sesame', 'Eggs']

const ADDRESS_LINES: Record<string, { lines: string[]; areas: string[] }> = {
  tnt_saltline: {
    lines: ['Villa Kyma, Oia', 'Canaves Oia Suites, room 14', 'Ammoudi Bay, house 3', 'Finikia Road 22', 'Katikies Hotel, suite 8', 'Tholos village, blue door'],
    areas: ['Oia village', 'Finikia & Tholos', 'Imerovigli'],
  },
  tnt_casavela: {
    lines: ['Rua dos Remédios 45, 2º', 'Beco do Mexias 7', 'Largo do Chafariz de Dentro 12', 'Rua da Graça 88', 'Rua Garrett 60, 3º esq', 'Travessa do Convento 4'],
    areas: ['Alfama & Baixa', 'Graça & Mouraria', 'Chiado & Príncipe Real'],
  },
}

const COURIERS = ['Nikos', 'Eleni', 'Giorgos', 'Maria', 'João', 'Carla', 'Pedro', 'Sofia']

/* --------------------------------------------------------------------------
   Demand shape
   -------------------------------------------------------------------------- */

/** Reservations per service per day, before the weekday curve. */
const BASE_COUNT: Record<string, Record<ServicePeriod['id'], number>> = {
  tnt_saltline: { breakfast: 7, lunch: 11, dinner: 19 },
  tnt_casavela: { breakfast: 12, lunch: 8, dinner: 14 },
}

/** Sunday..Saturday */
const WEEKDAY_CURVE = [1.05, 0.7, 0.75, 0.85, 0.95, 1.2, 1.3]

const PARTY_WEIGHTS: [number, number][] = [
  [1, 1],
  [2, 9],
  [3, 3],
  [4, 5],
  [5, 1.5],
  [6, 1.5],
  [7, 0.4],
  [8, 0.6],
]

const SOURCE_WEIGHTS: Record<string, [ReservationSource, number][]> = {
  tnt_saltline: [
    ['online', 6],
    ['phone', 2],
    ['google', 2],
    ['walk_in', 1.5],
    ['concierge', 1.5],
  ],
  tnt_casavela: [
    ['online', 4],
    ['hotel_guest', 4],
    ['phone', 1.5],
    ['google', 1.5],
    ['walk_in', 1],
    ['concierge', 0.5],
  ],
}

/* --------------------------------------------------------------------------
   Table assignment — first table that fits and is free for the turn.
   -------------------------------------------------------------------------- */

interface Hold {
  start: number
  end: number
}

class TablePlanner {
  private holds = new Map<string, Hold[]>()

  constructor(private tables: DiningTable[]) {}

  private isFree(tableId: string, start: number, end: number) {
    const list = this.holds.get(tableId) ?? []
    return list.every((hold) => end <= hold.start || start >= hold.end)
  }

  private hold(tableId: string, start: number, end: number) {
    const list = this.holds.get(tableId) ?? []
    list.push({ start, end })
    this.holds.set(tableId, list)
  }

  /** Bar tables are walk-in only; the rail is kept for twos. */
  assign(party: number, start: number, end: number, rng: () => number): string[] {
    const candidates = this.tables
      .filter((t) => t.shape !== 'high' && t.seats >= party && t.minSeats <= party)
      .sort((a, b) => a.seats - b.seats || (rng() < 0.5 ? -1 : 1))
    for (const table of candidates) {
      if (this.isFree(table.id, start, end)) {
        this.hold(table.id, start, end)
        return [table.id]
      }
    }
    // Join two joinable neighbours.
    const joinable = this.tables.filter((t) => t.joinable)
    for (let i = 0; i < joinable.length; i++) {
      for (let j = i + 1; j < joinable.length; j++) {
        const a = joinable[i]
        const b = joinable[j]
        if (a.zoneId !== b.zoneId || a.seats + b.seats < party) continue
        if (this.isFree(a.id, start, end) && this.isFree(b.id, start, end)) {
          this.hold(a.id, start, end)
          this.hold(b.id, start, end)
          return [a.id, b.id]
        }
      }
    }
    return []
  }
}

/* --------------------------------------------------------------------------
   Reservations
   -------------------------------------------------------------------------- */

function statusFor(dayOffset: number, startMin: number, endMin: number, source: ReservationSource, rng: () => number): ReservationStatus {
  if (dayOffset < 0) {
    return rngWeighted(rng, [
      ['finished', 86],
      ['no_show', 5],
      ['cancelled', 9],
    ])
  }
  if (dayOffset > 0) {
    if (rng() < 0.07) return 'cancelled'
    return source === 'online' || source === 'hotel_guest' ? (rng() < 0.55 ? 'confirmed' : 'booked') : 'booked'
  }
  // Today, mid-breakfast.
  if (endMin <= NOW_MIN) return rng() < 0.92 ? 'finished' : 'no_show'
  if (startMin <= NOW_MIN) return rng() < 0.85 ? 'seated' : 'arrived'
  if (startMin - NOW_MIN <= 20) return rng() < 0.4 ? 'arrived' : 'confirmed'
  return rng() < 0.7 ? 'confirmed' : 'booked'
}

function generateReservations(tenant: Tenant, customers: Customer[], tables: DiningTable[]): TableReservation[] {
  const settings = getDiningSettings(tenant.id)
  const rng = createRng(hashSeed(`reservations:${tenant.id}`))
  const base = BASE_COUNT[tenant.id] ?? BASE_COUNT.tnt_saltline
  const sources = SOURCE_WEIGHTS[tenant.id] ?? SOURCE_WEIGHTS.tnt_saltline
  const closures = new Set(settings.closures.map((c) => c.date))
  const out: TableReservation[] = []
  let serial = 0

  for (let offset = -PAST_DAYS; offset <= FUTURE_DAYS; offset++) {
    const day = addDays(NOW, offset)
    const dateKey = toDateKey(day)
    if (closures.has(dateKey)) continue
    const weekday = day.getDay()
    const planner = new TablePlanner(tables)

    for (const period of settings.periods) {
      if (!period.weekdays.includes(weekday)) continue
      const times = seatingTimes(period)
      const count = Math.round(base[period.id] * WEEKDAY_CURVE[weekday] * (0.85 + rng() * 0.3))
      const dayRows: TableReservation[] = []

      for (let i = 0; i < count; i++) {
        const partySize = rngWeighted(rng, PARTY_WEIGHTS)
        // Dinner leans late; breakfast leans early.
        const bias = period.id === 'dinner' ? 0.35 + rng() * 0.65 : period.id === 'breakfast' ? rng() * 0.8 : rng()
        const time = times[Math.min(times.length - 1, Math.floor(bias * times.length))]
        const startMin = hm(time)
        const duration = turnMinutesFor(period, partySize)
        const endMin = startMin + duration
        const source = rngWeighted(rng, sources)
        const status = statusFor(offset, startMin, endMin, source, rng)
        const customer = rngPick(rng, customers)
        const occasion: Occasion | null =
          rng() < 0.22 ? rngWeighted(rng, [['birthday', 4], ['anniversary', 3], ['business', 2], ['date', 3], ['celebration', 2], ['family', 3]]) : null
        const wantsDeposit = partySize >= settings.depositFromParty && source !== 'walk_in'
        const tableIds = status === 'cancelled' || status === 'no_show' ? [] : planner.assign(partySize, startMin, endMin, rng)
        const createdDaysBefore = source === 'walk_in' ? 0 : rngInt(rng, 0, 21)
        const startsAt = `${dateKey}T${time}:00`

        dayRows.push({
          id: `rsv_${tenant.id.slice(4, 6)}_${(serial++).toString(36).padStart(4, '0')}`,
          tenantId: tenant.id,
          customer,
          partySize,
          date: dateKey,
          time,
          startsAt,
          durationMinutes: duration,
          period: period.id,
          tableIds,
          status,
          source,
          occasion,
          notes: rng() < 0.18 ? rngPick(rng, RESERVATION_NOTES) : null,
          allergies: rng() < 0.12 ? rngPick(rng, ALLERGIES) : null,
          highChairs: partySize >= 3 && rng() < 0.12 ? 1 : 0,
          deposit: wantsDeposit
            ? { amount: settings.depositPerCover * partySize, status: status === 'no_show' ? 'charged' : status === 'cancelled' ? 'refunded' : 'held' }
            : null,
          stayId: null,
          createdAt: isoLocal(addDays(new Date(`${dateKey}T${mh(Math.max(0, startMin - rngInt(rng, 60, 600)))}:00`), -createdDaysBefore)),
          seatedAt: status === 'seated' || status === 'finished' ? `${dateKey}T${mh(startMin + rngInt(rng, 0, 12))}:00` : null,
          finishedAt: status === 'finished' ? `${dateKey}T${mh(Math.min(endMin, startMin + rngInt(rng, 45, duration)))}:00` : null,
        })
      }

      // Two or three on the waitlist for tonight's dinner, one for tomorrow.
      if ((offset === 0 && period.id === 'dinner') || (offset === 1 && period.id === 'dinner')) {
        const n = offset === 0 ? rngInt(rng, 2, 3) : 1
        for (let i = 0; i < n; i++) {
          const partySize = rngWeighted(rng, [[2, 5], [4, 3]])
          const time = rngPick(rng, ['19:30', '20:00', '20:30'])
          dayRows.push({
            id: `rsv_${tenant.id.slice(4, 6)}_${(serial++).toString(36).padStart(4, '0')}`,
            tenantId: tenant.id,
            customer: rngPick(rng, customers),
            partySize,
            date: dateKey,
            time,
            startsAt: `${dateKey}T${time}:00`,
            durationMinutes: turnMinutesFor(period, partySize),
            period: 'dinner',
            tableIds: [],
            status: 'waitlist',
            source: 'online',
            occasion: null,
            notes: null,
            allergies: null,
            highChairs: 0,
            deposit: null,
            stayId: null,
            createdAt: isoLocal(addDays(NOW, -rngInt(rng, 0, 2))),
            seatedAt: null,
            finishedAt: null,
          })
        }
      }

      out.push(...dayRows)
    }
  }

  out.sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  return out
}

/* --------------------------------------------------------------------------
   Orders
   -------------------------------------------------------------------------- */

const ORDER_TYPE_WEIGHTS: Record<string, [OrderType, number][]> = {
  tnt_saltline: [
    ['dine_in', 4],
    ['pickup', 4],
    ['delivery', 3],
  ],
  tnt_casavela: [
    ['dine_in', 5],
    ['pickup', 2],
    ['delivery', 3],
  ],
}

function sourceFor(type: OrderType, tenantId: string, rng: () => number): OrderSource {
  if (type === 'dine_in') {
    return tenantId === 'tnt_casavela'
      ? rngWeighted(rng, [['qr', 5], ['counter', 3], ['room_service', 4]])
      : rngWeighted(rng, [['qr', 6], ['counter', 4]])
  }
  if (type === 'pickup') return rngWeighted(rng, [['storefront', 7], ['phone', 3]])
  return tenantId === 'tnt_casavela'
    ? rngWeighted(rng, [['storefront', 5], ['uber_eats', 3], ['wolt', 1]])
    : rngWeighted(rng, [['storefront', 6], ['wolt', 3], ['deliveroo', 1]])
}

function pickLines(items: MenuItem[], type: OrderType, rng: () => number, serial: number): OrderLine[] {
  const sellable = items.filter((item) => item.status === 'available' && item.channels.includes(type))
  const count = rngWeighted(rng, [[1, 2], [2, 5], [3, 4], [4, 2], [5, 1]])
  const lines: OrderLine[] = []
  const used = new Set<string>()
  for (let i = 0; i < count && sellable.length > 0; i++) {
    // Popular items sell more.
    let item = rngPick(rng, sellable)
    if (!item.popular && rng() < 0.4) item = rngPick(rng, sellable)
    if (used.has(item.id)) continue
    used.add(item.id)
    const qty = rngWeighted(rng, [[1, 7], [2, 3], [3, 1]])
    const modifiers: string[] = []
    let delta = 0
    for (const modifier of item.modifiers) {
      if (modifier.required || rng() < 0.4) {
        const option = rngPick(rng, modifier.options)
        modifiers.push(option.label)
        delta += option.priceDelta
      }
    }
    const unitPrice = item.price + delta
    lines.push({
      id: `ol_${serial}_${i}`,
      itemId: item.id,
      name: item.name,
      qty,
      unitPrice,
      modifiers,
      note: rng() < 0.12 ? rngPick(rng, ['No onion', 'Extra lemon', 'Sauce on the side', 'Well done', 'Allergy: nuts — please check']) : null,
      total: unitPrice * qty,
    })
  }
  return lines
}

function generateOrders(tenant: Tenant, customers: Customer[], tables: DiningTable[], reservations: TableReservation[], tablesInUse: boolean): Order[] {
  const menu = getMenu(tenant.id)
  const settings = getDiningSettings(tenant.id)
  const rng = createRng(hashSeed(`orders:${tenant.id}`))
  const typeWeights = (ORDER_TYPE_WEIGHTS[tenant.id] ?? ORDER_TYPE_WEIGHTS.tnt_saltline).filter(([type]) => tablesInUse || type !== 'dine_in')
  const addresses = ADDRESS_LINES[tenant.id] ?? ADDRESS_LINES.tnt_saltline
  const taxRate = 0.13
  const out: Order[] = []
  let serial = 1000 + rngInt(rng, 0, 400)

  const seatedTables = reservations
    .filter((r) => r.date === TODAY_KEY && (r.status === 'seated' || r.status === 'arrived'))
    .flatMap((r) => r.tableIds)

  const push = (params: {
    dayOffset: number
    placedMin: number
    type: OrderType
    status: OrderStatus
    scheduledMin: number | null
    tableId?: string | null
  }) => {
    const day = addDays(NOW, params.dayOffset)
    const dateKey = toDateKey(day)
    const number = `#${serial++}`
    const lines = pickLines(menu.items, params.type, rng, serial)
    if (lines.length === 0) return
    const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
    const zone = params.type === 'delivery' ? rngPick(rng, settings.ordering.delivery.zones) : null
    const deliveryFee = zone ? zone.fee : 0
    const serviceFee = params.type === 'dine_in' ? 0 : Math.round(subtotal * 0.03)
    const tip = params.type === 'dine_in' ? 0 : rng() < 0.55 ? Math.round(subtotal * rngPick(rng, [0.05, 0.1, 0.15])) : 0
    const discount = rng() < 0.08 ? Math.round(subtotal * 0.1) : 0
    const tax = Math.round((subtotal - discount) * taxRate)
    const total = subtotal - discount + deliveryFee + serviceFee + tip + tax
    const source = sourceFor(params.type, tenant.id, rng)
    const prep = Math.max(...lines.map((l) => menu.items.find((i) => i.id === l.itemId)?.prepMinutes ?? 10)) + 5
    const promisedMin =
      params.scheduledMin ?? params.placedMin + prep + (params.type === 'delivery' ? (zone?.minutes ?? 25) : params.type === 'pickup' ? 5 : 0)
    const paymentStatus: Order['paymentStatus'] =
      params.status === 'refunded'
        ? 'refunded'
        : source === 'room_service'
          ? 'room_charge'
          : source === 'counter' || (source === 'qr' && rng() < 0.4)
            ? 'pay_at_counter'
            : 'paid'
    const paymentMethod: Order['paymentMethod'] =
      paymentStatus === 'room_charge'
        ? 'room_charge'
        : source === 'uber_eats' || source === 'wolt' || source === 'deliveroo'
          ? 'platform'
          : paymentStatus === 'pay_at_counter'
            ? 'cash'
            : rngWeighted(rng, [['card', 6], ['apple_pay', 3], ['google_pay', 1]])
    const done = params.status === 'completed' || params.status === 'refunded'
    const tableId = params.type === 'dine_in' ? (params.tableId ?? rngPick(rng, tables).id) : null

    out.push({
      id: `ord_${tenant.id.slice(4, 6)}_${number.slice(1)}`,
      tenantId: tenant.id,
      number,
      type: params.type,
      status: params.status,
      customer: rngPick(rng, customers),
      lines,
      subtotal,
      deliveryFee,
      serviceFee,
      tip,
      discount,
      tax,
      total,
      paymentStatus,
      paymentMethod,
      source,
      placedAt: `${dateKey}T${mh(params.placedMin)}:00`,
      scheduledFor: params.scheduledMin === null ? null : `${dateKey}T${mh(params.scheduledMin)}:00`,
      promisedAt: `${dateKey}T${mh(promisedMin)}:00`,
      readyAt: params.status === 'ready' || params.status === 'out_for_delivery' || done ? `${dateKey}T${mh(Math.min(promisedMin, params.placedMin + prep))}:00` : null,
      completedAt: done ? `${dateKey}T${mh(promisedMin + rngInt(rng, -4, 9))}:00` : null,
      tableId,
      roomNumber: source === 'room_service' ? `${rngInt(rng, 1, 4)}0${rngInt(rng, 1, 7)}` : null,
      address:
        params.type === 'delivery'
          ? { line: rngPick(rng, addresses.lines), area: zone?.name ?? addresses.areas[0], instructions: rng() < 0.3 ? rngPick(rng, ['Ring twice', 'Leave at reception', 'Blue gate, call on arrival', 'Third floor, no lift']) : null }
          : null,
      courier:
        params.type === 'delivery' && (params.status === 'out_for_delivery' || params.status === 'ready' || done)
          ? { name: rngPick(rng, COURIERS), status: done ? 'delivered' : params.status === 'out_for_delivery' ? 'on_the_way' : 'picking_up', etaMinutes: done ? 0 : rngInt(rng, 6, 24) }
          : null,
      notes: rng() < 0.1 ? rngPick(rng, ['Birthday — add a candle please', 'Cutlery not needed', 'Call when outside', 'Guest is in room 305']) : null,
      late: !done && params.status !== 'new' && promisedMin < NOW_MIN && params.dayOffset === 0,
    })
  }

  /* ---- history: the last fourteen days, all settled ---- */
  for (let offset = -PAST_DAYS; offset < 0; offset++) {
    const weekday = addDays(NOW, offset).getDay()
    const count = Math.round(rngInt(rng, 16, 26) * WEEKDAY_CURVE[weekday])
    for (let i = 0; i < count; i++) {
      const type = rngWeighted(rng, typeWeights)
      const placedMin = rngWeighted(rng, [[rngInt(rng, 9 * 60, 11 * 60), 2], [rngInt(rng, 12 * 60, 15 * 60), 4], [rngInt(rng, 18 * 60, 22 * 60), 5]])
      const status: OrderStatus = rngWeighted(rng, [['completed', 92], ['cancelled', 5], ['refunded', 3]])
      push({ dayOffset: offset, placedMin, type, status, scheduledMin: null })
    }
  }

  /* ---- today: settled breakfast orders, the live board, and lunch pre-orders ---- */
  for (let i = 0; i < rngInt(rng, 4, 6); i++) {
    push({ dayOffset: 0, placedMin: rngInt(rng, 8 * 60, 8 * 60 + 35), type: tablesInUse ? rngWeighted(rng, [['dine_in', 5], ['pickup', 3]]) : 'pickup', status: 'completed', scheduledMin: null })
  }
  const live: { type: OrderType; status: OrderStatus; ago: number; tableId?: string }[] = tablesInUse
    ? [
        { type: 'dine_in', status: 'new', ago: 2, tableId: seatedTables[0] },
        { type: 'pickup', status: 'new', ago: 4 },
        { type: 'delivery', status: 'accepted', ago: 7 },
        { type: 'dine_in', status: 'preparing', ago: 11, tableId: seatedTables[1] },
        { type: 'pickup', status: 'preparing', ago: 14 },
        { type: 'dine_in', status: 'ready', ago: 17, tableId: seatedTables[2] },
        { type: 'delivery', status: 'out_for_delivery', ago: 26 },
        { type: 'pickup', status: 'ready', ago: 19 },
      ]
    : [
        { type: 'pickup', status: 'new', ago: 2 },
        { type: 'delivery', status: 'new', ago: 4 },
        { type: 'delivery', status: 'accepted', ago: 7 },
        { type: 'pickup', status: 'preparing', ago: 11 },
        { type: 'pickup', status: 'preparing', ago: 14 },
        { type: 'delivery', status: 'preparing', ago: 16 },
        { type: 'pickup', status: 'ready', ago: 19 },
        { type: 'delivery', status: 'out_for_delivery', ago: 26 },
      ]
  for (const entry of live) {
    push({ dayOffset: 0, placedMin: NOW_MIN - entry.ago, type: entry.type, status: entry.status, scheduledMin: null, tableId: entry.tableId })
  }
  for (const scheduled of ['12:30', '12:45', '13:15', '19:30']) {
    push({ dayOffset: 0, placedMin: rngInt(rng, 7 * 60, NOW_MIN - 5), type: rngWeighted(rng, [['pickup', 3], ['delivery', 2]]), status: 'accepted', scheduledMin: hm(scheduled) })
  }

  out.sort((a, b) => b.placedAt.localeCompare(a.placedAt))
  return out
}

/* --------------------------------------------------------------------------
   Table status right now
   -------------------------------------------------------------------------- */

function applyTableStatus(tables: DiningTable[], reservations: TableReservation[], orders: Order[]): DiningTable[] {
  const today = reservations.filter((r) => r.date === TODAY_KEY && r.status !== 'cancelled' && r.status !== 'waitlist')
  const liveDineIn = new Set(orders.filter((o) => o.type === 'dine_in' && o.tableId && (o.status === 'accepted' || o.status === 'preparing' || o.status === 'ready' || o.status === 'new')).map((o) => o.tableId as string))

  return tables.map((table, index) => {
    const onTable = today.filter((r) => r.tableIds.includes(table.id))
    const current = onTable.find((r) => r.status === 'seated' || r.status === 'arrived')
    const justLeft = onTable.find((r) => r.status === 'finished' && r.finishedAt && hm(r.finishedAt.slice(11, 16)) >= NOW_MIN - 12)
    const next = onTable
      .filter((r) => (r.status === 'booked' || r.status === 'confirmed') && hm(r.time) > NOW_MIN)
      .sort((a, b) => a.time.localeCompare(b.time))[0]

    let status: TableStatus = 'free'
    if (current) {
      status = liveDineIn.has(table.id) ? 'ordered' : current.status === 'arrived' ? 'seated' : 'seated'
      // A couple of tables have asked for the bill.
      if (current.status === 'seated' && current.seatedAt && hm(current.seatedAt.slice(11, 16)) < NOW_MIN - 40 && index % 3 === 0) status = 'bill'
    } else if (justLeft) {
      status = 'needs_reset'
    } else if (next && hm(next.time) - NOW_MIN <= 60) {
      status = 'reserved'
    }
    if (table.name === 'T8' && !current) status = 'blocked'

    return {
      ...table,
      status,
      currentReservationId: current?.id ?? null,
      nextReservationId: next?.id ?? null,
    }
  })
}

/* --------------------------------------------------------------------------
   Public
   -------------------------------------------------------------------------- */

const cache = new Map<string, DiningData>()

export function getDining(tenant: Tenant): DiningData {
  const cached = cache.get(tenant.id)
  if (cached) return cached
  const customers = getCustomersByTenant(tenant.id)
  const { zones, tables } = getFloor(tenant.id)
  const menu = getMenu(tenant.id)
  const settings = getDiningSettings(tenant.id)
  if (customers.length === 0 || tables.length === 0) {
    const empty: DiningData = { menu, zones, tables, settings, reservations: [], orders: [] }
    cache.set(tenant.id, empty)
    return empty
  }
  const tablesInUse = getWorkspaceProfile(tenant.vertical).modules.reservations
  const reservations = tablesInUse ? generateReservations(tenant, customers, tables) : []
  const orders = generateOrders(tenant, customers, tables, reservations, tablesInUse)
  const data: DiningData = {
    menu,
    zones,
    tables: tablesInUse ? applyTableStatus(tables, reservations, orders) : tables,
    settings,
    reservations,
    orders,
  }
  cache.set(tenant.id, data)
  return data
}

/** Reservations for one day, in seating order. */
export function getReservationsForDay(tenant: Tenant, dateKey: string): TableReservation[] {
  return getDining(tenant).reservations.filter((r) => r.date === dateKey)
}

/** Orders still moving through the kitchen or on the road. */
export function getLiveOrders(tenant: Tenant): Order[] {
  return getDining(tenant).orders.filter((o) => o.status === 'new' || o.status === 'accepted' || o.status === 'preparing' || o.status === 'ready' || o.status === 'out_for_delivery')
}

export interface DiningCounts {
  reservationsToday: number
  coversToday: number
  liveOrders: number
}

export function getDiningCounts(tenant: Tenant): DiningCounts {
  const today = getReservationsForDay(tenant, TODAY_KEY).filter((r) => r.status !== 'cancelled' && r.status !== 'no_show' && r.status !== 'finished' && r.status !== 'waitlist')
  return {
    reservationsToday: today.length,
    coversToday: today.reduce((sum, r) => sum + r.partySize, 0),
    liveOrders: getLiveOrders(tenant).length,
  }
}
