import { NOW, getBookingRows, getCustomersByTenant } from '@/lib/demo'
import { addDays, createRng, hashSeed, rngInt, toDateKey } from '@/lib/utils'
import type { Customer, HeatmapCell, Insight, KpiMetric, RangePreset, TimeSeriesPoint } from '@/types'

import { getDiningSettings, hm } from './hours'
import { getMenu } from './menu'
import { ORDER_SOURCE_LABEL, ORDER_TYPE_LABEL, type MenuItemStatus, type OrderSource, type OrderType } from './types'

/* ==========================================================================
   Kitchen analytics — what a restaurant or a hotel kitchen steers on.

   Bookings analytics counts departures and seats; a kitchen counts orders,
   tickets, minutes on the pass and what each dish sold. This seam generates
   deterministic daily aggregates for the last four hundred days per tenant
   (never individual orders, so a year costs nothing) and folds them into a
   snapshot for a range: KPIs, a daily series, the mix by type and source,
   the busy hours, every dish, the guests and the changes worth making.
   Server-only: it reads the demo seam.
   ========================================================================== */

export const ORDER_TYPES: OrderType[] = ['dine_in', 'pickup', 'delivery']
const SOURCES: OrderSource[] = ['storefront', 'phone', 'uber_eats', 'wolt', 'deliveroo', 'room_service']

/** What a delivery platform keeps of an order placed through it. Card processing is the rest. */
export const SOURCE_COMMISSION: Record<OrderSource, number> = {
  storefront: 2.6,
  phone: 0,
  uber_eats: 30,
  wolt: 27,
  deliveroo: 28,
  room_service: 0,
}

export interface KitchenDay {
  date: string
  /** 0 = Sunday, as the clock gives it. */
  weekday: number
  orders: Record<OrderType, number>
  revenue: Record<OrderType, number>
  sources: Record<OrderSource, number>
  items: number
  /** Average minutes from placed to ready. */
  prepMinutes: number
  late: number
  cancelled: number
  refunded: number
  refundAmount: number
  newGuests: number
  returningGuests: number
  tips: number
  discounts: number
  platformFees: number
  /** Orders placed in each hour of the day. */
  hours: number[]
}

export interface TypeRow {
  type: OrderType
  label: string
  orders: number
  revenue: number
  /** Percent of orders. */
  share: number
  avgOrder: number
  color: string
}

export interface SourceRow {
  source: OrderSource
  label: string
  orders: number
  revenue: number
  share: number
  avgOrder: number
  commission: number
  fees: number
}

export interface ZoneRow {
  id: string
  name: string
  orders: number
  revenue: number
  fees: number
  minutes: number
  share: number
}

export interface HourRow {
  hour: number
  orders: number
  revenue: number
  prepMinutes: number
  late: number
}

export interface DishRow {
  id: string
  name: string
  categoryId: string
  category: string
  price: number
  portions: number
  revenue: number
  /** Percent of dish revenue in the range. */
  share: number
  perDay: number
  /** Percent change against the previous range. */
  delta: number
  popular: boolean
  status: MenuItemStatus
  imageUrl?: string
}

export interface CategoryRow {
  id: string
  name: string
  portions: number
  revenue: number
  share: number
  dishes: number
}

export interface WeekdayRow {
  /** 0 = Monday, for the calendar order the charts use. */
  weekday: number
  label: string
  orders: number
  revenue: Record<OrderType, number>
  late: number
  lateRate: number
}

export interface WeekRow {
  label: string
  newGuests: number
  returningGuests: number
}

export interface TopGuest {
  customer: Customer
  orders: number
  spend: number
  favourite: string
}

export interface KitchenSnapshot {
  tenantId: string
  preset: RangePreset
  rangeLabel: string
  comparisonLabel: string
  days: number
  roomService: boolean
  kpis: KpiMetric[]
  timeseries: TimeSeriesPoint[]
  totals: {
    revenue: number
    orders: number
    items: number
    tips: number
    discounts: number
    refunds: number
    refundAmount: number
    cancelled: number
    late: number
    platformFees: number
    prepMinutes: number
    newGuests: number
    returningGuests: number
  }
  types: TypeRow[]
  sources: SourceRow[]
  zones: ZoneRow[]
  hours: HourRow[]
  heatmap: HeatmapCell[]
  weekdays: WeekdayRow[]
  dishes: DishRow[]
  categories: CategoryRow[]
  weeks: WeekRow[]
  topGuests: TopGuest[]
  /** What guests said, all time: the score and how the stars fall. */
  ratings: { average: number; count: number; distribution: { star: number; count: number }[] }
  insights: Insight[]
}

/* --------------------------------------------------------------------------
   Daily aggregates
   -------------------------------------------------------------------------- */

const BACK_DAYS = 400
const NOW_MIN = NOW.getHours() * 60 + NOW.getMinutes()
/** Sunday..Saturday */
const WEEKDAY_CURVE = [1.05, 0.7, 0.75, 0.85, 0.95, 1.2, 1.3]
/** January..December */
const SEASON_ISLAND = [0.55, 0.55, 0.65, 0.85, 1.05, 1.2, 1.3, 1.35, 1.2, 0.95, 0.65, 0.6]
const SEASON_CITY = [0.8, 0.85, 0.95, 1.05, 1.1, 1.1, 1.05, 1.0, 1.1, 1.05, 0.9, 0.95]

export const TYPE_TONE: Record<OrderType, string> = {
  pickup: 'var(--chart-1)',
  delivery: 'var(--chart-6)',
  dine_in: 'var(--chart-3)',
}

const CACHE = new Map<string, KitchenDay[]>()

function zero<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>
}

/** How the day's orders spread over the clock, from the services and the ordering windows. */
function hourWeights(tenantId: string): number[] {
  const settings = getDiningSettings(tenantId)
  const weights = new Array<number>(24).fill(0)
  const serviceWeight: Record<string, number> = { breakfast: 0.5, lunch: 1, dinner: 1.15 }
  for (const period of settings.periods) {
    const from = Math.floor(hm(period.startTime) / 60)
    const to = Math.ceil(hm(period.endTime) / 60)
    const w = serviceWeight[period.id] ?? serviceWeight[period.name.toLowerCase()] ?? 0.9
    for (let h = from; h < to; h++) {
      const mid = (from + to) / 2
      const bell = 1 - Math.abs(h + 0.5 - mid) / Math.max(1, to - from)
      weights[h] += w * (0.55 + bell)
    }
  }
  const room = settings.ordering.roomService
  if (room.enabled) {
    for (let h = Math.floor(hm(room.startTime) / 60); h < Math.ceil(hm(room.endTime) / 60); h++) weights[h] += 0.18
  }
  const total = weights.reduce((a, b) => a + b, 0) || 1
  return weights.map((w) => w / total)
}

function daysFor(tenantId: string): KitchenDay[] {
  const cached = CACHE.get(tenantId)
  if (cached) return cached
  const menu = getMenu(tenantId)
  const settings = getDiningSettings(tenantId)
  const roomService = settings.ordering.roomService.enabled
  const rng = createRng(hashSeed(`kitchen:${tenantId}`))
  const avgItem = menu.items.reduce((s, i) => s + i.price, 0) / Math.max(1, menu.items.length)
  const ticket: Record<OrderType, number> = {
    pickup: avgItem * 2.3,
    delivery: avgItem * 2.6 + 350,
    dine_in: avgItem * 2.0 + settings.ordering.roomService.trayCharge,
  }
  const split: Record<OrderType, number> = roomService ? { dine_in: 0.42, pickup: 0.25, delivery: 0.33 } : { dine_in: 0, pickup: 0.55, delivery: 0.45 }
  const weights = hourWeights(tenantId)
  const base = roomService ? 44 : 34
  const season = roomService ? SEASON_CITY : SEASON_ISLAND

  const out: KitchenDay[] = []
  for (let offset = -BACK_DAYS; offset <= 0; offset++) {
    const d = addDays(NOW, offset)
    const weekday = d.getDay()
    const busy = WEEKDAY_CURVE[weekday] * season[d.getMonth()]
    const trend = 1 + 0.0009 * (offset + BACK_DAYS)
    let total = Math.round(base * busy * trend * (0.85 + rng() * 0.3))
    if (offset === 0) total = Math.round(total * Math.min(1, NOW_MIN / (23 * 60)))

    const jitter = ORDER_TYPES.map(() => 0.94 + rng() * 0.12)
    const raw = ORDER_TYPES.map((t, i) => split[t] * jitter[i])
    const rawSum = raw.reduce((a, b) => a + b, 0) || 1
    const orders = zero(ORDER_TYPES)
    const revenue = zero(ORDER_TYPES)
    ORDER_TYPES.forEach((t, i) => {
      orders[t] = Math.round(total * (raw[i] / rawSum))
      revenue[t] = Math.round(orders[t] * ticket[t] * (0.92 + rng() * 0.16))
    })
    total = ORDER_TYPES.reduce((s, t) => s + orders[t], 0)

    const sources = zero(SOURCES)
    const phoneShare = 0.26 + rng() * 0.08
    sources.phone = Math.round(orders.pickup * phoneShare)
    sources.storefront = orders.pickup - sources.phone
    const platformShare = 0.36 + rng() * 0.08
    const platform = Math.round(orders.delivery * platformShare)
    sources.wolt = Math.round(platform * 0.5)
    sources.uber_eats = Math.round(platform * 0.27)
    sources.deliveroo = platform - sources.wolt - sources.uber_eats
    sources.storefront += orders.delivery - platform
    sources.room_service = orders.dine_in
    const deliveryTicket = orders.delivery ? revenue.delivery / orders.delivery : 0
    const platformFees = Math.round(sources.wolt * deliveryTicket * 0.27 + sources.uber_eats * deliveryTicket * 0.3 + sources.deliveroo * deliveryTicket * 0.28)

    const revenueTotal = ORDER_TYPES.reduce((s, t) => s + revenue[t], 0)
    const avgTicket = total ? revenueTotal / total : 0
    const cancelled = Math.round(total * (0.035 + rng() * 0.02))
    const refunded = Math.round(total * (0.012 + rng() * 0.012))
    const newGuests = Math.min(total, Math.round(total * (roomService ? 0.66 : 0.56) * (0.9 + rng() * 0.2)))

    const hours = new Array<number>(24).fill(0)
    let placed = 0
    for (let h = 0; h < 24; h++) {
      hours[h] = Math.round(total * weights[h] * (0.8 + rng() * 0.4))
      placed += hours[h]
    }
    // keep the clock honest with the total
    const peak = hours.indexOf(Math.max(...hours))
    hours[peak] = Math.max(0, hours[peak] + (total - placed))
    if (offset === 0) for (let h = NOW.getHours() + 1; h < 24; h++) hours[h] = 0

    out.push({
      date: toDateKey(d),
      weekday,
      orders,
      revenue,
      sources,
      items: Math.round(total * (2.1 + rng() * 0.5)),
      prepMinutes: Math.round((16 + busy * 3.5 + (rng() - 0.5) * 3) * 10) / 10,
      late: Math.round(total * (0.03 + Math.max(0, busy - 0.9) * 0.06 + rng() * 0.02)),
      cancelled,
      refunded,
      refundAmount: Math.round(refunded * avgTicket),
      newGuests,
      returningGuests: total - newGuests,
      tips: Math.round((revenue.pickup + revenue.delivery) * 0.05),
      discounts: Math.round(revenueTotal * 0.02),
      platformFees,
      hours,
    })
  }
  CACHE.set(tenantId, out)
  return out
}

/* --------------------------------------------------------------------------
   Ranges
   -------------------------------------------------------------------------- */

function presetDays(preset: RangePreset): number {
  switch (preset) {
    case '7d':
      return 7
    case '90d':
      return 90
    case 'mtd':
      return NOW.getDate()
    case 'qtd': {
      const quarterStart = new Date(NOW.getFullYear(), Math.floor(NOW.getMonth() / 3) * 3, 1)
      return Math.max(1, Math.round((NOW.getTime() - quarterStart.getTime()) / 86_400_000) + 1)
    }
    case 'ytd': {
      const yearStart = new Date(NOW.getFullYear(), 0, 1)
      return Math.max(1, Math.round((NOW.getTime() - yearStart.getTime()) / 86_400_000) + 1)
    }
    default:
      return 30
  }
}

function presetLabel(preset: RangePreset, days: number): string {
  switch (preset) {
    case 'mtd':
      return 'Month to date'
    case 'qtd':
      return 'Quarter to date'
    case 'ytd':
      return 'Year to date'
    default:
      return `Last ${days} days`
  }
}

/* --------------------------------------------------------------------------
   Snapshot
   -------------------------------------------------------------------------- */

const sumBy = (rows: KitchenDay[], pick: (d: KitchenDay) => number) => rows.reduce((s, d) => s + pick(d), 0)
const ordersOf = (d: KitchenDay) => ORDER_TYPES.reduce((s, t) => s + d.orders[t], 0)
const revenueOf = (d: KitchenDay) => ORDER_TYPES.reduce((s, t) => s + d.revenue[t], 0)
const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0)
const WEEKDAY_LABEL = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function metric(key: string, label: string, value: number, previous: number, format: KpiMetric['format'], higherIsBetter: boolean, sparkline: number[], comparisonLabel: string, hint?: string): KpiMetric {
  const deltaPercent = previous ? Math.round(((value - previous) / previous) * 1000) / 10 : 0
  return {
    key,
    label,
    value,
    format,
    deltaPercent,
    direction: deltaPercent > 0.5 ? 'up' : deltaPercent < -0.5 ? 'down' : 'flat',
    higherIsBetter,
    comparisonLabel,
    sparkline,
    hint,
  }
}

export function getKitchenAnalytics(tenantId: string, preset: RangePreset = '30d'): KitchenSnapshot {
  const all = daysFor(tenantId)
  const n = Math.min(presetDays(preset), Math.floor(all.length / 2))
  const days = all.slice(all.length - n)
  const prev = all.slice(all.length - 2 * n, all.length - n)
  const menu = getMenu(tenantId)
  const settings = getDiningSettings(tenantId)
  const roomService = settings.ordering.roomService.enabled
  const comparisonLabel = `vs previous ${n} days`
  const rangeLabel = presetLabel(preset, n)

  /* ---------- totals ---------- */
  const total = (rows: KitchenDay[]) => ({
    revenue: sumBy(rows, revenueOf),
    orders: sumBy(rows, ordersOf),
    items: sumBy(rows, (d) => d.items),
    tips: sumBy(rows, (d) => d.tips),
    discounts: sumBy(rows, (d) => d.discounts),
    refunds: sumBy(rows, (d) => d.refunded),
    refundAmount: sumBy(rows, (d) => d.refundAmount),
    cancelled: sumBy(rows, (d) => d.cancelled),
    late: sumBy(rows, (d) => d.late),
    platformFees: sumBy(rows, (d) => d.platformFees),
    prepMinutes: rows.length ? Math.round((sumBy(rows, (d) => d.prepMinutes * ordersOf(d)) / Math.max(1, sumBy(rows, ordersOf))) * 10) / 10 : 0,
    newGuests: sumBy(rows, (d) => d.newGuests),
    returningGuests: sumBy(rows, (d) => d.returningGuests),
  })
  const cur = total(days)
  const before = total(prev)
  const net = cur.revenue - cur.refundAmount
  const netBefore = before.revenue - before.refundAmount
  const aov = cur.orders ? Math.round(net / cur.orders) : 0
  const aovBefore = before.orders ? Math.round(netBefore / before.orders) : 0
  const lateRate = pct(cur.late, cur.orders)
  const lateBefore = pct(before.late, before.orders)
  const cancelRate = pct(cur.cancelled, cur.orders)
  const cancelBefore = pct(before.cancelled, before.orders)
  const deliveryShare = pct(sumBy(days, (d) => d.orders.delivery), cur.orders)
  const deliveryBefore = pct(sumBy(prev, (d) => d.orders.delivery), before.orders)
  const repeatRate = pct(cur.returningGuests, cur.newGuests + cur.returningGuests)
  const repeatBefore = pct(before.returningGuests, before.newGuests + before.returningGuests)

  const kpis: KpiMetric[] = [
    metric('net_revenue', 'Net revenue', net, netBefore, 'currency', true, days.map((d) => revenueOf(d) - d.refundAmount), comparisonLabel, 'After refunds'),
    metric('bookings', 'Orders', cur.orders, before.orders, 'number', true, days.map(ordersOf), comparisonLabel, 'Every ticket the pass took'),
    metric('guests', 'Dishes sold', cur.items, before.items, 'number', true, days.map((d) => d.items), comparisonLabel, 'Lines across all orders'),
    metric('aov', 'Average order', aov, aovBefore, 'currency', true, days.map((d) => (ordersOf(d) ? Math.round(revenueOf(d) / ordersOf(d)) : 0)), comparisonLabel),
    metric('kitchen_time', 'Kitchen time (min)', cur.prepMinutes, before.prepMinutes, 'number', false, days.map((d) => d.prepMinutes), comparisonLabel, 'Order to ready'),
    metric('late_rate', 'Late orders', lateRate, lateBefore, 'percent', false, days.map((d) => pct(d.late, ordersOf(d))), comparisonLabel, 'Past the promised time'),
    metric('cancellation_rate', 'Cancelled', cancelRate, cancelBefore, 'percent', false, days.map((d) => pct(d.cancelled, ordersOf(d))), comparisonLabel),
    metric('delivery_share', 'Delivery share', deliveryShare, deliveryBefore, 'percent', true, days.map((d) => pct(d.orders.delivery, ordersOf(d))), comparisonLabel, 'Of all orders'),
    metric('repeat_rate', 'Returning guests', repeatRate, repeatBefore, 'percent', true, days.map((d) => pct(d.returningGuests, ordersOf(d))), comparisonLabel),
  ]

  /* ---------- series ---------- */
  const timeseries: TimeSeriesPoint[] = days.map((d, i) => ({
    date: d.date,
    revenue: revenueOf(d) - d.refundAmount,
    bookings: ordersOf(d),
    guests: d.items,
    occupancy: pct(d.late, ordersOf(d)),
    prevRevenue: prev[i] ? revenueOf(prev[i]) - prev[i].refundAmount : 0,
    cancellations: d.cancelled,
    avgOrderValue: ordersOf(d) ? Math.round(revenueOf(d) / ordersOf(d)) : 0,
  }))

  /* ---------- mix ---------- */
  const types: TypeRow[] = ORDER_TYPES.filter((t) => sumBy(days, (d) => d.orders[t]) > 0).map((t) => {
    const orders = sumBy(days, (d) => d.orders[t])
    const revenue = sumBy(days, (d) => d.revenue[t])
    return { type: t, label: ORDER_TYPE_LABEL[t], orders, revenue, share: pct(orders, cur.orders), avgOrder: orders ? Math.round(revenue / orders) : 0, color: TYPE_TONE[t] }
  })
  const typeTicket = (t: OrderType) => types.find((r) => r.type === t)?.avgOrder ?? 0
  const sourceType: Record<OrderSource, OrderType> = { storefront: 'pickup', phone: 'pickup', uber_eats: 'delivery', wolt: 'delivery', deliveroo: 'delivery', room_service: 'dine_in' }
  const sources: SourceRow[] = SOURCES.map((s) => {
    const orders = sumBy(days, (d) => d.sources[s])
    // the storefront sells pickup and delivery; weight its ticket between the two
    const ticket = s === 'storefront' ? Math.round((typeTicket('pickup') * sumBy(days, (d) => d.sources.storefront - (d.orders.delivery - (d.sources.wolt + d.sources.uber_eats + d.sources.deliveroo))) + typeTicket('delivery') * sumBy(days, (d) => d.orders.delivery - (d.sources.wolt + d.sources.uber_eats + d.sources.deliveroo))) / Math.max(1, orders)) : typeTicket(sourceType[s])
    const revenue = orders * ticket
    return { source: s, label: ORDER_SOURCE_LABEL[s], orders, revenue, share: pct(orders, cur.orders), avgOrder: ticket, commission: SOURCE_COMMISSION[s], fees: Math.round((revenue * SOURCE_COMMISSION[s]) / 100) }
  })
    .filter((r) => r.orders > 0)
    .sort((a, b) => b.orders - a.orders)

  const zonesRaw = settings.ordering.delivery.zones
  const zoneWeights = zonesRaw.map((_, i) => 1 / (i + 1))
  const zoneWeightSum = zoneWeights.reduce((a, b) => a + b, 0) || 1
  const deliveryOrders = sumBy(days, (d) => d.orders.delivery)
  const deliveryRevenue = sumBy(days, (d) => d.revenue.delivery)
  const zones: ZoneRow[] = zonesRaw.map((z, i) => {
    const share = zoneWeights[i] / zoneWeightSum
    const orders = Math.round(deliveryOrders * share)
    return { id: z.id, name: z.name, orders, revenue: Math.round(deliveryRevenue * share), fees: orders * z.fee, minutes: z.minutes, share: pct(orders, deliveryOrders) }
  })

  /* ---------- clock ---------- */
  const ticketAll = cur.orders ? cur.revenue / cur.orders : 0
  const hours: HourRow[] = Array.from({ length: 24 }, (_, h) => {
    const orders = sumBy(days, (d) => d.hours[h])
    const load = orders / Math.max(1, Math.max(...Array.from({ length: 24 }, (__, k) => sumBy(days, (d) => d.hours[k]))))
    return { hour: h, orders, revenue: Math.round(orders * ticketAll), prepMinutes: orders ? Math.round((cur.prepMinutes - 3 + load * 7) * 10) / 10 : 0, late: Math.round(orders * (0.02 + load * 0.07)) }
  })

  const heatmap: HeatmapCell[] = []
  const perWeekday = Array.from({ length: 7 }, () => new Array<number>(24).fill(0))
  const weekdayCount = new Array<number>(7).fill(0)
  for (const d of days) {
    const wd = (d.weekday + 6) % 7
    weekdayCount[wd] += 1
    for (let h = 0; h < 24; h++) perWeekday[wd][h] += d.hours[h]
  }
  let maxCell = 0
  for (let wd = 0; wd < 7; wd++) for (let h = 0; h < 24; h++) maxCell = Math.max(maxCell, weekdayCount[wd] ? perWeekday[wd][h] / weekdayCount[wd] : 0)
  for (let wd = 0; wd < 7; wd++) {
    for (let h = 0; h < 24; h++) {
      if (hours[h].orders === 0) continue
      const avg = weekdayCount[wd] ? perWeekday[wd][h] / weekdayCount[wd] : 0
      heatmap.push({ weekday: wd, hour: h, occupancy: maxCell ? Math.round((avg / maxCell) * 100) : 0, bookings: Math.round(avg * 10) / 10, revenue: Math.round(avg * ticketAll) })
    }
  }

  const weekdays: WeekdayRow[] = WEEKDAY_LABEL.map((label, wd) => {
    const rows = days.filter((d) => (d.weekday + 6) % 7 === wd)
    const revenue = zero(ORDER_TYPES)
    for (const t of ORDER_TYPES) revenue[t] = rows.length ? Math.round(sumBy(rows, (d) => d.revenue[t]) / rows.length) : 0
    const orders = rows.length ? Math.round(sumBy(rows, ordersOf) / rows.length) : 0
    const late = rows.length ? sumBy(rows, (d) => d.late) / rows.length : 0
    return { weekday: wd, label, orders, revenue, late: Math.round(late * 10) / 10, lateRate: pct(late, orders) }
  })

  /* ---------- dishes ---------- */
  const categoryById = new Map(menu.categories.map((c) => [c.id, c]))
  const dishesRaw = menu.items.map((item) => {
    const rng = createRng(hashSeed(`dish:${tenantId}:${preset}:${item.id}`))
    const portions = Math.round(item.sold30d * (n / 30) * (0.85 + rng() * 0.3))
    const previous = Math.round(item.sold30d * (n / 30) * (0.85 + rng() * 0.3))
    return { item, portions, previous, rng }
  })
  const dishRevenue = dishesRaw.reduce((s, d) => s + d.portions * d.item.price, 0)
  const dishes: DishRow[] = dishesRaw
    .map(({ item, portions, previous }) => ({
      id: item.id,
      name: item.name,
      categoryId: item.categoryId,
      category: categoryById.get(item.categoryId)?.name ?? '',
      price: item.price,
      portions,
      revenue: portions * item.price,
      share: pct(portions * item.price, dishRevenue),
      perDay: Math.round((portions / n) * 10) / 10,
      delta: previous ? Math.round(((portions - previous) / previous) * 1000) / 10 : 0,
      popular: item.popular,
      status: item.status,
      imageUrl: item.imageUrl,
    }))
    .sort((a, b) => b.revenue - a.revenue)
  const categories: CategoryRow[] = menu.categories
    .map((c) => {
      const rows = dishes.filter((d) => d.categoryId === c.id)
      const revenue = rows.reduce((s, d) => s + d.revenue, 0)
      return { id: c.id, name: c.name, portions: rows.reduce((s, d) => s + d.portions, 0), revenue, share: pct(revenue, dishRevenue), dishes: rows.length }
    })
    .sort((a, b) => b.revenue - a.revenue)

  /* ---------- guests ---------- */
  const weeks: WeekRow[] = []
  for (let end = days.length; end > 0; end -= 7) {
    const chunk = days.slice(Math.max(0, end - 7), end)
    // a stub of two or three days at the start of the range would read as a collapse
    if (chunk.length < 4 && weeks.length > 0) break
    const first = new Date(`${chunk[0].date}T12:00:00`)
    weeks.unshift({ label: `${first.getDate()} ${MONTH[first.getMonth()]}`, newGuests: sumBy(chunk, (d) => d.newGuests), returningGuests: sumBy(chunk, (d) => d.returningGuests) })
    if (weeks.length >= 13) break
  }
  const customers = getCustomersByTenant(tenantId)
  const favourites = dishes.slice(0, 8)
  const topGuests: TopGuest[] = customers
    .map((customer) => {
      const rng = createRng(hashSeed(`guest:${tenantId}:${customer.id}`))
      const orders = Math.max(1, Math.round(rngInt(rng, 2, 14) * (n / 30)))
      return { customer, orders, spend: Math.round(orders * ticketAll * (0.8 + rng() * 0.5)), favourite: favourites[rngInt(rng, 0, favourites.length - 1)]?.name ?? '' }
    })
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 6)

  /* ---------- what guests said ---------- */
  const stars = getBookingRows(tenantId)
    .map((r) => r.booking.rating)
    .filter((r): r is number => typeof r === 'number')
  const ratings = {
    average: stars.length ? Math.round((stars.reduce((a, b) => a + b, 0) / stars.length) * 10) / 10 : 0,
    count: stars.length,
    distribution: [5, 4, 3, 2, 1].map((star) => ({ star, count: stars.filter((v) => v === star).length })),
  }

  /* ---------- what to change ---------- */
  const insights: Insight[] = []
  const worstDay = [...weekdays].sort((a, b) => b.lateRate - a.lateRate)[0]
  const peakHour = [...hours].sort((a, b) => b.orders - a.orders)[0]
  if (worstDay && worstDay.lateRate >= 6) {
    insights.push({
      id: 'late-peak',
      severity: worstDay.lateRate >= 9 ? 'critical' : 'warning',
      title: `${worstDay.label} dinners run late`,
      body: `${worstDay.lateRate}% of ${worstDay.label} orders miss the promise, against ${lateRate}% overall. The pass peaks at ${String(peakHour.hour).padStart(2, '0')}:00. One more pair of hands on that shift, or a longer promise on the storefront for those two hours, clears it.`,
      metric: 'Late orders',
      href: '/dashboard/hours',
      actionLabel: 'Adjust the promise',
    })
  }
  const platformFeeShare = pct(cur.platformFees, cur.revenue)
  if (cur.platformFees > 0) {
    insights.push({
      id: 'platform-fees',
      severity: platformFeeShare >= 4 ? 'warning' : 'neutral',
      title: 'Delivery platforms take a real cut',
      body: `Wolt, Uber Eats and Deliveroo kept ${(cur.platformFees / 100).toLocaleString('en', { maximumFractionDigits: 0 })} of the range, ${platformFeeShare}% of everything you took. A first-order code for guests who found you there moves the second order to your own storefront at card cost.`,
      metric: 'Platform fees',
      href: '/dashboard/storefront',
      actionLabel: 'Storefront offers',
    })
  }
  const slow = dishes.filter((d) => d.status === 'available' && d.perDay < 0.6)
  if (slow.length >= 2) {
    insights.push({
      id: 'slow-dishes',
      severity: 'neutral',
      title: `${slow.length} dishes barely move`,
      body: `${slow.slice(0, 3).map((d) => d.name).join(', ')}${slow.length > 3 ? ` and ${slow.length - 3} more` : ''} sell under one portion a day. Rest them for the season or move them to a special so the menu reads shorter and the kitchen preps less.`,
      metric: 'Menu',
      href: '/dashboard/menu',
      actionLabel: 'Open the menu',
    })
  }
  const top = dishes[0]
  if (top) {
    insights.push({
      id: 'top-dish',
      severity: 'positive',
      title: `${top.name} carries ${top.share}% of dish revenue`,
      body: `${top.portions.toLocaleString('en')} portions in the range, ${top.perDay} a day. Keep it at the top of the storefront, and pair it with a side or a drink in the checkout upsell.`,
      metric: 'Menu',
      href: '/dashboard/menu',
      actionLabel: 'See the dish',
    })
  }
  if (deliveryShare - deliveryBefore >= 2) {
    insights.push({
      id: 'delivery-growth',
      severity: 'positive',
      title: 'Delivery is growing',
      body: `${deliveryShare}% of orders now go out on a bike, up from ${deliveryBefore}%. Check the zones' fees and minimums still cover the ride, and that the furthest zone's promise matches what riders actually manage.`,
      metric: 'Delivery',
      href: '/dashboard/hours',
      actionLabel: 'Delivery zones',
    })
  }
  if (repeatRate < 40) {
    insights.push({
      id: 'repeat',
      severity: 'neutral',
      title: 'Most guests order once',
      body: `${repeatRate}% of orders come from a returning guest. A thank-you message the day after with a small code brings a slice of the other ${100 - repeatRate}% back within the month.`,
      metric: 'Guests',
      href: '/dashboard/customers',
      actionLabel: 'Guests',
    })
  }

  return {
    tenantId,
    preset,
    rangeLabel,
    comparisonLabel,
    days: n,
    roomService,
    kpis,
    timeseries,
    totals: cur,
    types,
    sources,
    zones,
    hours,
    heatmap,
    weekdays,
    dishes,
    categories,
    weeks,
    topGuests,
    ratings,
    insights,
  }
}
