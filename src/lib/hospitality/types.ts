import type { Customer } from '@/types'

/* ==========================================================================
   Hospitality — the shapes a restaurant and a hotel run on.

   Dining: a menu, a floor of tables, service periods, table reservations
   and orders (dine-in, pickup, delivery).
   Lodging: room types, rooms, rate plans, stays and housekeeping.

   Money is in minor units throughout, like the rest of the product.
   Dates are local "YYYY-MM-DD" keys and local ISO datetimes with no zone,
   matching the frozen demo clock.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Menu
   -------------------------------------------------------------------------- */

export type DietaryTag = 'vegetarian' | 'vegan' | 'gluten_free' | 'dairy_free' | 'nuts' | 'spicy' | 'shellfish'

export const DIETARY_META: Record<DietaryTag, { short: string; label: string }> = {
  vegetarian: { short: 'V', label: 'Vegetarian' },
  vegan: { short: 'VG', label: 'Vegan' },
  gluten_free: { short: 'GF', label: 'Gluten free' },
  dairy_free: { short: 'DF', label: 'Dairy free' },
  nuts: { short: 'N', label: 'Contains nuts' },
  spicy: { short: '🌶', label: 'Spicy' },
  shellfish: { short: 'SF', label: 'Contains shellfish' },
}

/** Where an item can be sold. */
export type OrderChannel = 'dine_in' | 'pickup' | 'delivery'

export const ORDER_CHANNEL_LABEL: Record<OrderChannel, string> = {
  dine_in: 'Dine-in',
  pickup: 'Pickup',
  delivery: 'Delivery',
}

export interface MenuModifierOption {
  id: string
  label: string
  /** Added to the item price; 0 for a free choice. */
  priceDelta: number
}

export interface MenuModifier {
  id: string
  label: string
  required: boolean
  /** More than one option may be picked. */
  multiple: boolean
  options: MenuModifierOption[]
}

export type MenuItemStatus = 'available' | 'sold_out' | 'hidden'

export interface MenuCategory {
  id: string
  tenantId: string
  name: string
  description?: string
  sortOrder: number
  /** Which service the category belongs to; 'all' shows on every menu. */
  service: 'all' | 'breakfast' | 'lunch' | 'dinner' | 'drinks'
}

export interface MenuItem {
  id: string
  tenantId: string
  categoryId: string
  name: string
  description: string
  price: number
  imageUrl?: string
  tags: DietaryTag[]
  channels: OrderChannel[]
  status: MenuItemStatus
  popular: boolean
  /** Kitchen time for the order board and pickup promises. */
  prepMinutes: number
  modifiers: MenuModifier[]
  /** Portions sold in the trailing 30 days. */
  sold30d: number
  /** Revenue in the trailing 30 days. */
  revenue30d: number
}

export interface Menu {
  categories: MenuCategory[]
  items: MenuItem[]
}

/* --------------------------------------------------------------------------
   Service and hours
   -------------------------------------------------------------------------- */

export type ServiceKey = 'breakfast' | 'lunch' | 'dinner'

export interface ServicePeriod {
  id: ServiceKey
  name: string
  /** "HH:MM" local. */
  startTime: string
  endTime: string
  /** Kitchen closes; printed on the menu. */
  lastOrders: string
  /** 0 = Sunday … 6 = Saturday */
  weekdays: number[]
}

export interface DeliveryZone {
  id: string
  name: string
  fee: number
  minOrder: number
  /** Promised door-to-door minutes on top of prep. */
  minutes: number
}

export interface OrderingHours {
  pickup: { enabled: boolean; startTime: string; endTime: string; leadMinutes: number; weekdays: number[] }
  delivery: {
    enabled: boolean
    startTime: string
    endTime: string
    leadMinutes: number
    weekdays: number[]
    zones: DeliveryZone[]
  }
  /** Orders sent up to rooms; hotels only. `dine_in` orders carry the room number. */
  roomService: { enabled: boolean; startTime: string; endTime: string; leadMinutes: number; trayCharge: number }
}

export interface Closure {
  /** "YYYY-MM-DD" */
  date: string
  reason: string
}

export interface DiningSettings {
  periods: ServicePeriod[]
  ordering: OrderingHours
  closures: Closure[]
}

/* --------------------------------------------------------------------------
   Orders
   -------------------------------------------------------------------------- */

/** `dine_in` orders are room service: the only way food is eaten on site without a table book. */
export type OrderType = OrderChannel

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: 'Room service',
  pickup: 'Pickup',
  delivery: 'Delivery',
}

export type OrderStatus =
  | 'new'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export const ORDER_STATUS_META: Record<OrderStatus, { label: string; tone: string }> = {
  new: { label: 'New', tone: 'bg-warning' },
  accepted: { label: 'Accepted', tone: 'bg-info' },
  preparing: { label: 'Preparing', tone: 'bg-primary' },
  ready: { label: 'Ready', tone: 'bg-success' },
  out_for_delivery: { label: 'Out for delivery', tone: 'bg-info' },
  completed: { label: 'Completed', tone: 'bg-line-strong' },
  cancelled: { label: 'Cancelled', tone: 'bg-danger' },
  refunded: { label: 'Refunded', tone: 'bg-line-strong' },
}

/** The statuses a live board shows, in column order. */
export const LIVE_ORDER_STATUSES: OrderStatus[] = ['new', 'accepted', 'preparing', 'ready', 'out_for_delivery']

export type OrderSource = 'storefront' | 'phone' | 'uber_eats' | 'wolt' | 'deliveroo' | 'room_service'

export const ORDER_SOURCE_LABEL: Record<OrderSource, string> = {
  storefront: 'Online',
  phone: 'Phone',
  uber_eats: 'Uber Eats',
  wolt: 'Wolt',
  deliveroo: 'Deliveroo',
  room_service: 'Room service',
}

export type OrderPaymentStatus = 'paid' | 'unpaid' | 'refunded' | 'pay_at_counter' | 'room_charge'

export interface OrderLine {
  id: string
  itemId: string
  name: string
  qty: number
  unitPrice: number
  /** Chosen modifier option labels. */
  modifiers: string[]
  note: string | null
  total: number
}

export interface Order {
  id: string
  tenantId: string
  /** Short number for the pass: "#1042" */
  number: string
  type: OrderType
  status: OrderStatus
  customer: Customer
  lines: OrderLine[]
  subtotal: number
  deliveryFee: number
  serviceFee: number
  tip: number
  discount: number
  tax: number
  total: number
  paymentStatus: OrderPaymentStatus
  paymentMethod: 'card' | 'apple_pay' | 'google_pay' | 'cash' | 'room_charge' | 'platform'
  source: OrderSource
  placedAt: string
  /** null = as soon as possible. */
  scheduledFor: string | null
  /** When we told the guest it would be ready or arrive. */
  promisedAt: string
  readyAt: string | null
  completedAt: string | null
  /** Room service only. */
  roomNumber: string | null
  /** Delivery only. */
  address: { line: string; area: string; instructions: string | null } | null
  courier: { name: string; status: 'assigned' | 'picking_up' | 'on_the_way' | 'delivered'; etaMinutes: number } | null
  notes: string | null
  /** True when prep is running past the promise. */
  late: boolean
}

/* --------------------------------------------------------------------------
   Lodging
   -------------------------------------------------------------------------- */

export type BedType = 'king' | 'queen' | 'twin' | 'bunk' | 'sofa'

export interface RoomType {
  id: string
  tenantId: string
  slug: string
  name: string
  description: string
  /** Square metres. */
  size: number
  beds: { type: BedType; count: number }[]
  maxGuests: number
  maxAdults: number
  /** Nightly, before season and plan. */
  baseRate: number
  imageUrls: string[]
  amenities: string[]
  view: string
  /** How many physical rooms exist of this type. */
  count: number
  highlights: string[]
}

export type HousekeepingStatus = 'clean' | 'dirty' | 'in_progress' | 'inspected' | 'out_of_order'

export const HOUSEKEEPING_META: Record<HousekeepingStatus, { label: string; tone: string }> = {
  clean: { label: 'Clean', tone: 'bg-success' },
  inspected: { label: 'Inspected', tone: 'bg-success' },
  in_progress: { label: 'In progress', tone: 'bg-info' },
  dirty: { label: 'Dirty', tone: 'bg-danger' },
  out_of_order: { label: 'Out of order', tone: 'bg-line-strong' },
}

export type RoomOccupancy = 'vacant' | 'arriving' | 'stayover' | 'departing' | 'turnover'

export const OCCUPANCY_META: Record<RoomOccupancy, { label: string; hint: string }> = {
  vacant: { label: 'Vacant', hint: 'Nobody in tonight.' },
  arriving: { label: 'Arriving', hint: 'A guest checks in today.' },
  stayover: { label: 'Stayover', hint: 'Occupied, staying on.' },
  departing: { label: 'Departing', hint: 'Checking out today, nobody in tonight.' },
  turnover: { label: 'Turnover', hint: 'One party out, another in today.' },
}

export interface Room {
  id: string
  tenantId: string
  typeId: string
  /** "204" */
  number: string
  floor: number
  housekeeping: HousekeepingStatus
  occupancy: RoomOccupancy
  features: string[]
  notes: string | null
  /** The stay in the room now or due today, if any. */
  currentStayId: string | null
  arrivingStayId: string | null
}

export type RatePlanKind = 'flexible' | 'non_refundable' | 'breakfast' | 'long_stay'

export interface RatePlan {
  id: string
  kind: RatePlanKind
  name: string
  description: string
  /** Multiplier on the room type's seasonal rate. */
  multiplier: number
  breakfastIncluded: boolean
  cancellation: string
  minNights: number
}

export interface Season {
  id: string
  name: string
  /** "YYYY-MM-DD" inclusive. */
  startDate: string
  endDate: string
  multiplier: number
}

export interface LodgingSettings {
  checkInFrom: string
  checkOutBy: string
  ratePlans: RatePlan[]
  seasons: Season[]
  /** Nightly city tax per adult. */
  cityTaxPerNight: number
  cityTaxLabel: string
  vatRate: number
  /** Extras sold at booking and at the desk. */
  extras: { id: string; label: string; price: number; per: 'stay' | 'night' | 'person' }[]
  /** Blocks of rooms the front desk takes out of sale. */
  minStayWeekends: number
}

export type StayStatus = 'booked' | 'arriving' | 'in_house' | 'departing' | 'checked_out' | 'cancelled' | 'no_show'

export const STAY_STATUS_META: Record<StayStatus, { label: string; tone: string }> = {
  booked: { label: 'Booked', tone: 'bg-info' },
  arriving: { label: 'Arriving', tone: 'bg-warning' },
  in_house: { label: 'In house', tone: 'bg-success' },
  departing: { label: 'Departing', tone: 'bg-primary' },
  checked_out: { label: 'Checked out', tone: 'bg-line-strong' },
  cancelled: { label: 'Cancelled', tone: 'bg-danger' },
  no_show: { label: 'No-show', tone: 'bg-danger' },
}

export type StayChannel = 'direct' | 'booking_com' | 'expedia' | 'airbnb' | 'phone' | 'walk_in' | 'corporate'

export const STAY_CHANNEL_LABEL: Record<StayChannel, string> = {
  direct: 'Direct',
  booking_com: 'Booking.com',
  expedia: 'Expedia',
  airbnb: 'Airbnb',
  phone: 'Phone',
  walk_in: 'Walk-in',
  corporate: 'Corporate',
}

export type StayFlag = 'vip' | 'repeat' | 'early_checkin' | 'late_checkout' | 'allergy' | 'birthday' | 'accessible'

export const STAY_FLAG_LABEL: Record<StayFlag, string> = {
  vip: 'VIP',
  repeat: 'Repeat guest',
  early_checkin: 'Early check-in',
  late_checkout: 'Late checkout',
  allergy: 'Allergy on file',
  birthday: 'Birthday during stay',
  accessible: 'Accessible room',
}

export interface StayExtra {
  id: string
  label: string
  amount: number
  qty: number
}

export interface Stay {
  id: string
  tenantId: string
  /** "CV-7K2Q" */
  reference: string
  customer: Customer
  roomTypeId: string
  /** Assigned at or before arrival; null while unassigned. */
  roomId: string | null
  /** "YYYY-MM-DD" */
  checkIn: string
  checkOut: string
  nights: number
  adults: number
  children: number
  ratePlanId: string
  nightlyRate: number
  roomTotal: number
  extras: StayExtra[]
  cityTax: number
  total: number
  paid: number
  balance: number
  status: StayStatus
  channel: StayChannel
  specialRequests: string | null
  /** "HH:MM" expected arrival, when the guest told us. */
  eta: string | null
  flags: StayFlag[]
  createdAt: string
  checkedInAt: string | null
  checkedOutAt: string | null
}

export type HousekeepingTaskKind = 'departure_clean' | 'stayover' | 'arrival_inspect' | 'turnover' | 'deep_clean' | 'maintenance'

export const HOUSEKEEPING_TASK_LABEL: Record<HousekeepingTaskKind, string> = {
  departure_clean: 'Departure clean',
  stayover: 'Stayover service',
  arrival_inspect: 'Arrival inspection',
  turnover: 'Turnover',
  deep_clean: 'Deep clean',
  maintenance: 'Maintenance',
}

export type HousekeepingTaskStatus = 'todo' | 'in_progress' | 'done' | 'skipped'

export interface HousekeepingTask {
  id: string
  tenantId: string
  roomId: string
  kind: HousekeepingTaskKind
  status: HousekeepingTaskStatus
  assigneeId: string | null
  priority: 'rush' | 'normal'
  /** "HH:MM" the room is needed by. */
  dueBy: string
  note: string | null
  /** Minutes the task usually takes. */
  minutes: number
}

/* --------------------------------------------------------------------------
   The bundle a hospitality workspace loads
   -------------------------------------------------------------------------- */

export interface DiningData {
  menu: Menu
  settings: DiningSettings
  orders: Order[]
}

export interface LodgingData {
  roomTypes: RoomType[]
  rooms: Room[]
  settings: LodgingSettings
  stays: Stay[]
  housekeeping: HousekeepingTask[]
}
