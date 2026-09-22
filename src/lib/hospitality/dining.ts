import { NOW, TODAY_KEY, getCustomersByTenant } from '@/lib/demo'
import { addDays, createRng, hashSeed, rngInt, rngPick, rngWeighted, toDateKey } from '@/lib/utils'
import type { Customer, Tenant } from '@/types'

import { getDiningSettings, hm, mh } from './hours'
import { getMenu } from './menu'
import type { DiningData, MenuItem, Order, OrderLine, OrderSource, OrderStatus, OrderType } from './types'

/* ==========================================================================
   Dining — the orders a kitchen has taken, generated deterministically per
   tenant around the frozen clock (Friday 11 September 2026, 09:00), so the
   pass has work on it and the last two weeks are in the history.

   Restaurants take pickup and delivery. A hotel kitchen also sends orders
   up to rooms; those carry the room number and charge to the folio.
   ========================================================================== */

const NOW_MIN = NOW.getHours() * 60 + NOW.getMinutes()
const PAST_DAYS = 14

/** Sunday..Saturday */
const WEEKDAY_CURVE = [1.05, 0.7, 0.75, 0.85, 0.95, 1.2, 1.3]

const ADDRESS_LINES: Record<string, { lines: string[] }> = {
  tnt_saltline: { lines: ['Villa Kyma, Oia', 'Canaves Oia Suites, room 14', 'Ammoudi Bay, house 3', 'Finikia Road 22', 'Katikies Hotel, suite 8', 'Tholos village, blue door'] },
  tnt_casavela: { lines: ['Rua dos Remédios 45, 2º', 'Beco do Mexias 7', 'Largo do Chafariz de Dentro 12', 'Rua da Graça 88', 'Rua Garrett 60, 3º esq', 'Travessa do Convento 4'] },
}

const COURIERS = ['Nikos', 'Eleni', 'Giorgos', 'Maria', 'João', 'Carla', 'Pedro', 'Sofia']
const ROOMS = ['102', '105', '107', '203', '206', '207', '301', '305', '307', '401', '403', '406', '407']

function sourceFor(type: OrderType, rng: () => number): OrderSource {
  if (type === 'dine_in') return 'room_service'
  if (type === 'pickup') return rngWeighted(rng, [['storefront', 7], ['phone', 3]])
  return rngWeighted(rng, [['storefront', 6], ['wolt', 2], ['uber_eats', 1], ['deliveroo', 1]])
}

function pickLines(items: MenuItem[], type: OrderType, rng: () => number, serial: number): OrderLine[] {
  const sellable = items.filter((item) => item.status === 'available' && item.channels.includes(type))
  const count = rngWeighted(rng, [[1, 2], [2, 5], [3, 4], [4, 2], [5, 1]])
  const lines: OrderLine[] = []
  const used = new Set<string>()
  for (let i = 0; i < count && sellable.length > 0; i++) {
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

function generateOrders(tenant: Tenant, customers: Customer[]): Order[] {
  const menu = getMenu(tenant.id)
  const settings = getDiningSettings(tenant.id)
  const roomService = settings.ordering.roomService.enabled
  const rng = createRng(hashSeed(`orders:${tenant.id}`))
  const typeWeights: [OrderType, number][] = roomService
    ? [['dine_in', 4], ['pickup', 2], ['delivery', 3]]
    : [['pickup', 5], ['delivery', 4]]
  const addresses = ADDRESS_LINES[tenant.id] ?? ADDRESS_LINES.tnt_saltline
  const taxRate = 0.13
  const out: Order[] = []
  let serial = 1000 + rngInt(rng, 0, 400)

  const push = (params: { dayOffset: number; placedMin: number; type: OrderType; status: OrderStatus; scheduledMin: number | null }) => {
    const day = addDays(NOW, params.dayOffset)
    const dateKey = toDateKey(day)
    const number = `#${serial++}`
    const lines = pickLines(menu.items, params.type, rng, serial)
    if (lines.length === 0) return
    const subtotal = lines.reduce((sum, line) => sum + line.total, 0)
    const zone = params.type === 'delivery' ? rngPick(rng, settings.ordering.delivery.zones) : null
    const deliveryFee = zone ? zone.fee : 0
    const serviceFee = params.type === 'dine_in' ? settings.ordering.roomService.trayCharge : Math.round(subtotal * 0.03)
    const tip = params.type === 'dine_in' ? 0 : rng() < 0.55 ? Math.round(subtotal * rngPick(rng, [0.05, 0.1, 0.15])) : 0
    const discount = rng() < 0.08 ? Math.round(subtotal * 0.1) : 0
    const tax = Math.round((subtotal - discount) * taxRate)
    const total = subtotal - discount + deliveryFee + serviceFee + tip + tax
    const source = sourceFor(params.type, rng)
    const prep = Math.max(...lines.map((l) => menu.items.find((i) => i.id === l.itemId)?.prepMinutes ?? 10)) + 5
    const lead = params.type === 'delivery' ? zone?.minutes ?? 25 : params.type === 'dine_in' ? 10 : 5
    const promisedMin = params.scheduledMin ?? params.placedMin + prep + lead
    const paymentStatus: Order['paymentStatus'] = params.status === 'refunded' ? 'refunded' : source === 'room_service' ? 'room_charge' : source === 'phone' && rng() < 0.4 ? 'pay_at_counter' : 'paid'
    const paymentMethod: Order['paymentMethod'] =
      paymentStatus === 'room_charge' ? 'room_charge' : source === 'uber_eats' || source === 'wolt' || source === 'deliveroo' ? 'platform' : paymentStatus === 'pay_at_counter' ? 'cash' : rngWeighted(rng, [['card', 6], ['apple_pay', 3], ['google_pay', 1]])
    const done = params.status === 'completed' || params.status === 'refunded'

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
      roomNumber: params.type === 'dine_in' ? rngPick(rng, ROOMS) : null,
      address:
        params.type === 'delivery'
          ? { line: rngPick(rng, addresses.lines), area: zone?.name ?? '', instructions: rng() < 0.3 ? rngPick(rng, ['Ring twice', 'Leave at reception', 'Blue gate, call on arrival', 'Third floor, no lift']) : null }
          : null,
      courier:
        params.type === 'delivery' && (params.status === 'out_for_delivery' || params.status === 'ready' || done)
          ? { name: rngPick(rng, COURIERS), status: done ? 'delivered' : params.status === 'out_for_delivery' ? 'on_the_way' : 'picking_up', etaMinutes: done ? 0 : rngInt(rng, 6, 24) }
          : null,
      notes: rng() < 0.1 ? rngPick(rng, ['Birthday — add a candle please', 'Cutlery not needed', 'Call when outside', 'Leave the tray outside the door']) : null,
      late: !done && params.status !== 'new' && promisedMin < NOW_MIN && params.dayOffset === 0,
    })
  }

  /* ---- history: the last fourteen days, all settled ---- */
  for (let offset = -PAST_DAYS; offset < 0; offset++) {
    const weekday = addDays(NOW, offset).getDay()
    const count = Math.round(rngInt(rng, 16, 26) * WEEKDAY_CURVE[weekday])
    for (let i = 0; i < count; i++) {
      const type = rngWeighted(rng, typeWeights)
      const placedMin = rngWeighted(rng, [[rngInt(rng, 8 * 60, 11 * 60), 2], [rngInt(rng, 12 * 60, 15 * 60), 4], [rngInt(rng, 18 * 60, 22 * 60), 5]])
      const status: OrderStatus = rngWeighted(rng, [['completed', 92], ['cancelled', 5], ['refunded', 3]])
      push({ dayOffset: offset, placedMin, type, status, scheduledMin: null })
    }
  }

  /* ---- today: settled breakfast orders, the live board, and pre-orders for later ---- */
  for (let i = 0; i < rngInt(rng, 4, 6); i++) {
    push({ dayOffset: 0, placedMin: rngInt(rng, 7 * 60 + 30, 8 * 60 + 35), type: roomService ? rngWeighted(rng, [['dine_in', 5], ['pickup', 2]]) : 'pickup', status: 'completed', scheduledMin: null })
  }
  const live: { type: OrderType; status: OrderStatus; ago: number }[] = roomService
    ? [
        { type: 'dine_in', status: 'new', ago: 2 },
        { type: 'pickup', status: 'new', ago: 4 },
        { type: 'delivery', status: 'accepted', ago: 7 },
        { type: 'dine_in', status: 'preparing', ago: 11 },
        { type: 'pickup', status: 'preparing', ago: 14 },
        { type: 'dine_in', status: 'ready', ago: 17 },
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
  for (const entry of live) push({ dayOffset: 0, placedMin: NOW_MIN - entry.ago, type: entry.type, status: entry.status, scheduledMin: null })
  for (const scheduled of ['12:30', '12:45', '13:15', '19:30']) {
    push({ dayOffset: 0, placedMin: rngInt(rng, 7 * 60, NOW_MIN - 5), type: rngWeighted(rng, [['pickup', 3], ['delivery', 2]]), status: 'accepted', scheduledMin: hm(scheduled) })
  }

  out.sort((a, b) => b.placedAt.localeCompare(a.placedAt))
  return out
}

/* --------------------------------------------------------------------------
   Public
   -------------------------------------------------------------------------- */

const cache = new Map<string, DiningData>()

export function getDining(tenant: Tenant): DiningData {
  const cached = cache.get(tenant.id)
  if (cached) return cached
  const customers = getCustomersByTenant(tenant.id)
  const menu = getMenu(tenant.id)
  const settings = getDiningSettings(tenant.id)
  const data: DiningData = { menu, settings, orders: customers.length ? generateOrders(tenant, customers) : [] }
  cache.set(tenant.id, data)
  return data
}

/** Orders still moving through the kitchen or on the road. */
export function getLiveOrders(tenant: Tenant): Order[] {
  return getDining(tenant).orders.filter((o) => o.status === 'new' || o.status === 'accepted' || o.status === 'preparing' || o.status === 'ready' || o.status === 'out_for_delivery')
}

export interface DiningCounts {
  liveOrders: number
  ordersToday: number
  /** Minor units, completed orders placed today. */
  revenueToday: number
}

export function getDiningCounts(tenant: Tenant): DiningCounts {
  const { orders } = getDining(tenant)
  const today = orders.filter((o) => o.placedAt.startsWith(TODAY_KEY) && o.status !== 'cancelled' && o.status !== 'refunded')
  return {
    liveOrders: getLiveOrders(tenant).length,
    ordersToday: today.length,
    revenueToday: today.filter((o) => o.status === 'completed').reduce((s, o) => s + o.total, 0),
  }
}
