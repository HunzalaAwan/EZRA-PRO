import type { ActivityKind, BookingChannel, Customer } from '@/types'
import { ACTIVITY_KINDS, ACTIVITY_KIND_META } from '@/lib/activity-kinds'
import type {
  ActionStep,
  Condition,
  ConditionField,
  ConditionOp,
  Duration,
  EmailStep,
  EndStep,
  Flow,
  FlowAction,
  FlowExit,
  FlowGoal,
  FlowPurpose,
  FlowSettings,
  FlowStep,
  FlowStepType,
  FlowTrigger,
  SmsStep,
  SplitStep,
  TimeUnit,
  TriggerSubject,
  TriggerType,
  WaitStep,
  BranchStep,
} from './types'

/* ==========================================================================
   Flows catalog — everything the builder offers and the words it uses: the
   moments that start an automation, the things it can check, the steps it
   can take, the goals recipes are filed under, the personal details a
   message can carry, and the safe defaults every new automation starts
   with. Browser- and server-safe: icons are lucide export names resolved by
   the caller, and nothing here touches React or the window.
   ========================================================================== */

/** The lucide icons the catalog names. The UI maps each to its component. */
export type IconName =
  | 'Armchair'
  | 'AlarmClock'
  | 'Backpack'
  | 'BellOff'
  | 'BellRing'
  | 'CalendarCheck'
  | 'CalendarClock'
  | 'CalendarHeart'
  | 'CalendarPlus'
  | 'CalendarX'
  | 'CircleStop'
  | 'Clock'
  | 'CloudLightning'
  | 'CreditCard'
  | 'Crown'
  | 'Gift'
  | 'GitBranch'
  | 'Hand'
  | 'History'
  | 'Hourglass'
  | 'Inbox'
  | 'LifeBuoy'
  | 'ListTodo'
  | 'Mail'
  | 'MailPlus'
  | 'MessageSquare'
  | 'Repeat'
  | 'ShoppingBag'
  | 'ShoppingCart'
  | 'Smile'
  | 'Split'
  | 'Star'
  | 'StickyNote'
  | 'Tag'
  | 'TagX'
  | 'TicketPercent'
  | 'UserCheck'
  | 'UserX'
  | 'Users'
  | 'Wallet'

/* --------------------------------------------------------------------------
   Triggers — what starts an automation
   -------------------------------------------------------------------------- */

export type TriggerGroup =
  | 'Bookings'
  | 'Around the activity'
  | 'Money'
  | 'Guests and your list'
  | 'Reviews'
  | 'Gift cards'
  | 'Requests'
  | 'Spots and weather'
  | 'Your team'

/** Display order of the trigger picker. */
export const TRIGGER_GROUPS: TriggerGroup[] = [
  'Bookings',
  'Around the activity',
  'Money',
  'Guests and your list',
  'Reviews',
  'Gift cards',
  'Requests',
  'Spots and weather',
  'Your team',
]

export interface TriggerOffsetMeta {
  /** Reads after the amount: "2 days before the start". */
  label: string
  default: Duration
  units: TimeUnit[]
}

export interface TriggerMeta {
  type: TriggerType
  /** A sentence fragment for the picker: "A guest books". */
  label: string
  /** Chip text: "Booking made". */
  short: string
  group: TriggerGroup
  subject: TriggerSubject
  icon: IconName
  /** Triggers that start a set time before or after their moment. */
  offset?: TriggerOffsetMeta
  defaultPurpose: FlowPurpose
  /** The goal a new automation from this trigger is filed under. */
  goal: FlowGoal
  /** One plain sentence with an example. */
  help: string
  /** The booking is still ahead when it starts, so "wait until before the start" works. */
  startsAhead?: boolean
  /** Reaches people about something they have not booked: always marketing. */
  marketingOnly?: boolean
  /** How often it starts in practice. none: only by hand. low: rarely. */
  volume?: 'none' | 'low'
}

export const TRIGGERS: TriggerMeta[] = [
  /* ---------- Bookings ---------- */
  {
    type: 'booking_made',
    label: 'A guest books',
    short: 'Booking made',
    group: 'Bookings',
    subject: 'booking',
    icon: 'CalendarPlus',
    defaultPurpose: 'booking',
    goal: 'prepare_guests',
    help: 'Starts the moment a booking comes in, for example to send a welcome note with what happens next.',
    startsAhead: true,
  },
  {
    type: 'booking_changed',
    label: 'A booking is changed',
    short: 'Booking changed',
    group: 'Bookings',
    subject: 'booking',
    icon: 'CalendarClock',
    defaultPurpose: 'booking',
    goal: 'prepare_guests',
    help: 'Starts when the date, time or number of guests changes, for example to send the new details.',
    startsAhead: true,
    volume: 'low',
  },
  {
    type: 'booking_cancelled',
    label: 'A booking is cancelled',
    short: 'Booking cancelled',
    group: 'Bookings',
    subject: 'booking',
    icon: 'CalendarX',
    defaultPurpose: 'marketing',
    goal: 'recover',
    help: 'Starts when a guest or your team cancels, for example to offer another date before they look elsewhere.',
  },
  /* ---------- Around the activity ---------- */
  {
    type: 'before_start',
    label: 'Before a booking starts',
    short: 'Before the start',
    group: 'Around the activity',
    subject: 'booking',
    icon: 'AlarmClock',
    offset: { label: 'before the start', default: { amount: 2, unit: 'days' }, units: ['minutes', 'hours', 'days'] },
    defaultPurpose: 'booking',
    goal: 'prepare_guests',
    help: 'Starts a set time before each booking begins, for example a reminder with the meeting point the day before.',
    startsAhead: true,
  },
  {
    type: 'after_end',
    label: 'After a booking ends',
    short: 'After it ends',
    group: 'Around the activity',
    subject: 'booking',
    icon: 'CalendarCheck',
    offset: { label: 'after it ends', default: { amount: 3, unit: 'hours' }, units: ['minutes', 'hours', 'days'] },
    defaultPurpose: 'booking',
    goal: 'reviews',
    help: 'Starts a set time after each booking ends, for example a thank-you with a review link that evening.',
  },
  {
    type: 'checked_in',
    label: 'A guest checks in',
    short: 'Checked in',
    group: 'Around the activity',
    subject: 'booking',
    icon: 'UserCheck',
    defaultPurpose: 'booking',
    goal: 'prepare_guests',
    help: 'Starts when your team checks a guest in on the day, for example to send the wifi password or the photo link.',
  },
  {
    type: 'no_show',
    label: 'A guest doesn’t show up',
    short: 'No-show',
    group: 'Around the activity',
    subject: 'booking',
    icon: 'UserX',
    defaultPurpose: 'booking',
    goal: 'recover',
    help: 'Starts when a booking is marked as a no-show, for example to check they are all right and offer another date.',
  },
  /* ---------- Money ---------- */
  {
    type: 'balance_due',
    label: 'A balance is still owed',
    short: 'Balance owed',
    group: 'Money',
    subject: 'booking',
    icon: 'Wallet',
    offset: { label: 'before the start', default: { amount: 2, unit: 'days' }, units: ['hours', 'days'] },
    defaultPurpose: 'booking',
    goal: 'prepare_guests',
    help: 'Starts a set time before the start for bookings that paid a deposit and still owe the rest, for example a link to pay it.',
    startsAhead: true,
  },
  {
    type: 'payment_failed',
    label: 'A payment fails',
    short: 'Payment failed',
    group: 'Money',
    subject: 'booking',
    icon: 'CreditCard',
    defaultPurpose: 'booking',
    goal: 'recover',
    help: 'Starts when a card is declined, for example to ask the guest to try another card before the spots go.',
    startsAhead: true,
    volume: 'low',
  },
  /* ---------- Guests and your list ---------- */
  {
    type: 'joined_list',
    label: 'Someone joins your list',
    short: 'Joined your list',
    group: 'Guests and your list',
    subject: 'guest',
    icon: 'MailPlus',
    defaultPurpose: 'marketing',
    goal: 'welcome',
    help: 'Starts when someone signs up on your website, at checkout or at the desk, for example a welcome with a first-booking code.',
    marketingOnly: true,
  },
  {
    type: 'checkout_abandoned',
    label: 'Someone leaves checkout without booking',
    short: 'Left checkout',
    group: 'Guests and your list',
    subject: 'guest',
    icon: 'ShoppingCart',
    offset: { label: 'after they leave', default: { amount: 1, unit: 'hours' }, units: ['minutes', 'hours', 'days'] },
    defaultPurpose: 'marketing',
    goal: 'recover',
    help: 'Starts a set time after someone gives their email at checkout and leaves, for example a note that their spots are still open.',
  },
  {
    type: 'lapsed',
    label: 'A guest hasn’t booked in a while',
    short: 'Not back in a while',
    group: 'Guests and your list',
    subject: 'guest',
    icon: 'History',
    offset: { label: 'since their last booking', default: { amount: 120, unit: 'days' }, units: ['days'] },
    defaultPurpose: 'marketing',
    goal: 'come_back',
    help: 'Starts when this long has passed since a guest last came out with you, for example a “we miss you” note with a code.',
    marketingOnly: true,
  },
  {
    type: 'became_vip',
    label: 'A guest becomes a regular',
    short: 'Became a regular',
    group: 'Guests and your list',
    subject: 'guest',
    icon: 'Crown',
    defaultPurpose: 'marketing',
    goal: 'come_back',
    help: 'Starts when a guest makes their third booking, for example to thank them and tag them as a VIP.',
    marketingOnly: true,
  },
  {
    type: 'trip_anniversary',
    label: 'A year since their booking',
    short: 'Booking anniversary',
    group: 'Guests and your list',
    subject: 'booking',
    icon: 'CalendarHeart',
    offset: { label: 'before the anniversary', default: { amount: 0, unit: 'days' }, units: ['days'] },
    defaultPurpose: 'marketing',
    goal: 'come_back',
    help: 'Starts a year after a booking, or a little before, for example “a year ago today you were out with us”.',
    marketingOnly: true,
  },
  /* ---------- Reviews ---------- */
  {
    type: 'review_left',
    label: 'A guest leaves a review',
    short: 'Review left',
    group: 'Reviews',
    subject: 'booking',
    icon: 'Star',
    defaultPurpose: 'marketing',
    goal: 'reviews',
    help: 'Starts when a guest rates their activity, for example a thank-you for 4 and 5 stars, or a note to your team for 1 to 3.',
  },
  /* ---------- Gift cards ---------- */
  {
    type: 'gift_card_bought',
    label: 'Someone buys a gift card',
    short: 'Gift card bought',
    group: 'Gift cards',
    subject: 'guest',
    icon: 'Gift',
    defaultPurpose: 'booking',
    goal: 'gift_cards',
    help: 'Starts when a gift card is bought, for example a thank-you to the buyer with tips for giving it.',
    volume: 'low',
  },
  {
    type: 'gift_card_expiring',
    label: 'A gift card is about to run out',
    short: 'Gift card running out',
    group: 'Gift cards',
    subject: 'guest',
    icon: 'Hourglass',
    offset: { label: 'before it runs out', default: { amount: 30, unit: 'days' }, units: ['days'] },
    defaultPurpose: 'booking',
    goal: 'gift_cards',
    help: 'Starts a set time before a gift card with credit left expires, for example a reminder to book and use it.',
    volume: 'low',
  },
  /* ---------- Requests ---------- */
  {
    type: 'request_received',
    label: 'A guest sends a request',
    short: 'Request received',
    group: 'Requests',
    subject: 'guest',
    icon: 'Inbox',
    defaultPurpose: 'booking',
    goal: 'team',
    help: 'Starts when someone asks for a quote or a booking you need to confirm, for example to tell them when you will reply.',
    volume: 'low',
  },
  /* ---------- Spots and weather ---------- */
  {
    type: 'low_fill',
    label: 'A time slot has empty spots',
    short: 'Empty spots',
    group: 'Spots and weather',
    subject: 'departure',
    icon: 'Armchair',
    offset: { label: 'before it starts', default: { amount: 3, unit: 'days' }, units: ['hours', 'days'] },
    defaultPurpose: 'marketing',
    goal: 'fill_seats',
    help: 'Starts when a time slot is still under a set share full, for example to offer the spare spots to past guests 3 days out.',
    startsAhead: true,
    marketingOnly: true,
  },
  {
    type: 'weather_alert',
    label: 'The weather puts a time slot at risk',
    short: 'Weather risk',
    group: 'Spots and weather',
    subject: 'departure',
    icon: 'CloudLightning',
    defaultPurpose: 'booking',
    goal: 'prepare_guests',
    help: 'Starts when a time slot is put on weather hold or the forecast looks doubtful, for example a heads-up to everyone booked on it.',
    startsAhead: true,
  },
  /* ---------- Your team ---------- */
  {
    type: 'manual',
    label: 'Your team starts it',
    short: 'Started by your team',
    group: 'Your team',
    subject: 'guest',
    icon: 'Hand',
    defaultPurpose: 'booking',
    goal: 'team',
    help: 'Only starts when someone on your team adds a guest to it from a booking or a guest record, for example a group organiser pack.',
    volume: 'none',
  },
]

const TRIGGER_BY_TYPE = new Map(TRIGGERS.map((meta) => [meta.type, meta]))

export function triggerMeta(type: TriggerType): TriggerMeta {
  return TRIGGER_BY_TYPE.get(type) ?? TRIGGERS[0]
}

/** What the trigger is about: decides which conditions, details and waits make sense. */
export function subjectOf(trigger: Pick<FlowTrigger, 'type'>): TriggerSubject {
  return triggerMeta(trigger.type).subject
}

/** Who a seats or weather automation goes to, with the default filled in. Undefined for other triggers. */
export function reachOf(trigger: Pick<FlowTrigger, 'type' | 'reach'>): FlowTrigger['reach'] {
  if (trigger.type === 'low_fill') return trigger.reach ?? 'past_guests_of_activity'
  if (trigger.type === 'weather_alert') return trigger.reach ?? 'booked_guests'
  return undefined
}

/**
 * Everything an automation knows about when it starts. A seats or weather
 * automation that goes to the guests booked on it also knows each guest's
 * booking, so booking checks and details work there too.
 */
export function subjectsOf(trigger: Pick<FlowTrigger, 'type' | 'reach'>): TriggerSubject[] {
  const subject = subjectOf(trigger)
  return subject === 'departure' && reachOf(trigger) === 'booked_guests' ? ['departure', 'booking'] : [subject]
}

/** The automation knows a booking for each guest it reaches. */
export function knowsBooking(trigger: Pick<FlowTrigger, 'type' | 'reach'>): boolean {
  return subjectsOf(trigger).includes('booking')
}

/** It reaches people about something they haven't booked, so it has to be marketing. */
export function mustBeMarketing(trigger: Pick<FlowTrigger, 'type' | 'reach'>): boolean {
  if (subjectOf(trigger) === 'departure') return reachOf(trigger) !== 'booked_guests'
  return Boolean(triggerMeta(trigger.type).marketingOnly)
}

/** "Wait until before the start" only makes sense while the start is still ahead. */
export function canWaitUntilStart(type: TriggerType): boolean {
  return Boolean(triggerMeta(type).startsAhead)
}

/** A trigger with its sensible starting settings. */
export function defaultTrigger(type: TriggerType): FlowTrigger {
  const meta = triggerMeta(type)
  const trigger: FlowTrigger = { type }
  if (meta.offset) trigger.offset = { ...meta.offset.default }
  if (type === 'review_left') trigger.ratings = []
  if (type === 'joined_list') trigger.sources = []
  if (type === 'low_fill') {
    trigger.fillBelow = 50
    trigger.reach = 'past_guests_of_activity'
  }
  if (type === 'weather_alert') trigger.reach = 'booked_guests'
  return trigger
}

export const TRIGGER_REACH_LABEL: Record<NonNullable<FlowTrigger['reach']>, string> = {
  past_guests_of_activity: 'Past guests of that activity',
  audience: 'An audience you choose',
  booked_guests: 'Guests booked on it',
}

export const JOIN_SOURCE_LABEL: Record<NonNullable<FlowTrigger['sources']>[number], string> = {
  popup: 'Website pop-up',
  footer: 'Website footer form',
  checkout: 'Checkout',
  walk_in: 'At the desk',
}

/* --------------------------------------------------------------------------
   Conditions — what "who can enter" and questions can check
   -------------------------------------------------------------------------- */

export type ConditionFieldKind = 'list' | 'number' | 'money' | 'days' | 'bool' | 'enum'

export type ConditionFieldGroup = 'About the guest' | 'About the booking' | 'About the time slot' | 'What they did in this automation'

export const CONDITION_FIELD_GROUPS: ConditionFieldGroup[] = ['About the guest', 'About the booking', 'About the time slot', 'What they did in this automation']

/** Where a list field's choices come from. The fixed ones resolve with `optionsFor`. */
export type ConditionOptionSource = 'activities' | 'tags' | 'countries' | 'channels' | 'segments' | 'kinds' | 'locations' | 'addOns'

export interface ConditionOption {
  value: string
  label: string
}

export interface ConditionFieldMeta {
  field: ConditionField
  /** The row label: "Group size". */
  label: string
  group: ConditionFieldGroup
  /** The triggers it makes sense for. */
  subjects: TriggerSubject[]
  kind: ConditionFieldKind
  ops: ConditionOp[]
  defaultOp: ConditionOp
  /** Value a new row starts with. Lists start empty, yes/no rows need none. */
  defaultValue?: number | [number, number]
  options?: ConditionOptionSource | ConditionOption[]
  /** Shown after a number: "guests", "days", "%". Money rows show the currency instead. */
  unit?: string
  /** Only inside a question step, never in "who can enter". */
  branchOnly?: boolean
  help: string
}

const LIST_OPS: ConditionOp[] = ['any_of', 'none_of']
const NUMBER_OPS: ConditionOp[] = ['at_least', 'at_most', 'between', 'is']
const RANGE_OPS: ConditionOp[] = ['at_least', 'at_most', 'between']
const BOOL_OPS: ConditionOp[] = ['yes', 'no']
const EVERYWHERE: TriggerSubject[] = ['guest', 'booking', 'departure']

/** The forecast values the simulator reads, plus 'hold' (put on weather hold) and 'risky' (it may not go ahead). */
export const WEATHER_OPTIONS: ConditionOption[] = [
  { value: 'clear', label: 'Clear' },
  { value: 'cloudy', label: 'Cloudy' },
  { value: 'rain', label: 'Rain' },
  { value: 'storm', label: 'Storms' },
  { value: 'wind', label: 'Strong wind' },
  { value: 'hold', label: 'On weather hold' },
  { value: 'risky', label: 'May not go ahead' },
]

export const CONDITION_FIELDS: ConditionFieldMeta[] = [
  /* ---------- About the guest ---------- */
  {
    field: 'guest.tags',
    label: 'Tags',
    group: 'About the guest',
    subjects: EVERYWHERE,
    kind: 'list',
    ops: LIST_OPS,
    defaultOp: 'any_of',
    options: 'tags',
    help: 'The tags on their guest record, like VIP, Local or Group leader.',
  },
  {
    field: 'guest.bookings',
    label: 'Number of bookings',
    group: 'About the guest',
    subjects: EVERYWHERE,
    kind: 'number',
    ops: NUMBER_OPS,
    defaultOp: 'at_least',
    defaultValue: 2,
    unit: 'bookings',
    help: 'How many times they have booked with you, counting this one.',
  },
  {
    field: 'guest.spend',
    label: 'Total spent',
    group: 'About the guest',
    subjects: EVERYWHERE,
    kind: 'money',
    ops: RANGE_OPS,
    defaultOp: 'at_least',
    defaultValue: 50_000,
    help: 'Everything they have paid you across all their bookings.',
  },
  {
    field: 'guest.country',
    label: 'Country',
    group: 'About the guest',
    subjects: EVERYWHERE,
    kind: 'list',
    ops: LIST_OPS,
    defaultOp: 'any_of',
    options: 'countries',
    help: 'Where they live, from the details they gave when booking.',
  },
  {
    field: 'guest.segment',
    label: 'Type of guest',
    group: 'About the guest',
    subjects: EVERYWHERE,
    kind: 'enum',
    ops: LIST_OPS,
    defaultOp: 'any_of',
    options: 'segments',
    help: 'First-timers have booked once, returning guests more than once, VIPs spend the most, and lapsed guests have not been back in a long time.',
  },
  {
    field: 'guest.daysSinceLastTrip',
    label: 'Days since their last booking',
    group: 'About the guest',
    subjects: EVERYWHERE,
    kind: 'days',
    ops: RANGE_OPS,
    defaultOp: 'at_least',
    defaultValue: 90,
    unit: 'days',
    help: 'How long ago their most recent booking was.',
  },
  {
    field: 'guest.bookedActivity',
    label: 'Activities they have booked',
    group: 'About the guest',
    subjects: EVERYWHERE,
    kind: 'list',
    ops: LIST_OPS,
    defaultOp: 'any_of',
    options: 'activities',
    help: 'Any activity they have booked before, at any time.',
  },
  {
    field: 'guest.emailOptIn',
    label: 'Agreed to marketing emails',
    group: 'About the guest',
    subjects: EVERYWHERE,
    kind: 'bool',
    ops: BOOL_OPS,
    defaultOp: 'yes',
    help: 'They said yes to hearing about offers and news by email.',
  },
  {
    field: 'guest.smsOptIn',
    label: 'Agreed to marketing texts',
    group: 'About the guest',
    subjects: EVERYWHERE,
    kind: 'bool',
    ops: BOOL_OPS,
    defaultOp: 'yes',
    help: 'They said yes to hearing about offers and news by text.',
  },
  {
    field: 'guest.hasUpcomingTrip',
    label: 'Has a booking coming up',
    group: 'About the guest',
    subjects: EVERYWHERE,
    kind: 'bool',
    ops: BOOL_OPS,
    defaultOp: 'no',
    help: 'They already have a booking in the future. Handy for not offering an activity to someone who is already coming.',
  },
  {
    field: 'guest.local',
    label: 'Lives locally',
    group: 'About the guest',
    subjects: EVERYWHERE,
    kind: 'bool',
    ops: BOOL_OPS,
    defaultOp: 'yes',
    help: 'They live in the same country as your business, so a last-minute offer can work for them.',
  },
  /* ---------- About the booking ---------- */
  {
    field: 'booking.activity',
    label: 'Activity',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'list',
    ops: LIST_OPS,
    defaultOp: 'any_of',
    options: 'activities',
    help: 'The activity this booking is for.',
  },
  {
    field: 'booking.kind',
    label: 'Type of activity',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'enum',
    ops: LIST_OPS,
    defaultOp: 'any_of',
    options: 'kinds',
    help: 'Activity or tour, private activity, rental, lesson, pass or package.',
  },
  {
    field: 'booking.partySize',
    label: 'Group size',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'number',
    ops: NUMBER_OPS,
    defaultOp: 'at_least',
    defaultValue: 6,
    unit: 'guests',
    help: 'How many people are on the booking.',
  },
  {
    field: 'booking.total',
    label: 'Booking total',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'money',
    ops: RANGE_OPS,
    defaultOp: 'at_least',
    defaultValue: 50_000,
    help: 'The full price of the booking, including extras.',
  },
  {
    field: 'booking.channel',
    label: 'Booked through',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'enum',
    ops: LIST_OPS,
    defaultOp: 'any_of',
    options: 'channels',
    help: 'Where the booking came from: your booking page, the phone, the desk, a reseller and so on.',
  },
  {
    field: 'booking.balanceDue',
    label: 'Balance still owed',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'money',
    ops: RANGE_OPS,
    defaultOp: 'at_least',
    defaultValue: 1,
    help: 'What is left to pay on the booking. “Is at least” the smallest amount finds every booking not paid in full.',
  },
  {
    field: 'booking.hasAddOn',
    label: 'Extras added',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'list',
    ops: LIST_OPS,
    defaultOp: 'any_of',
    options: 'addOns',
    help: 'Extras on the booking, like a photo package, lunch or gear hire.',
  },
  {
    field: 'booking.usedCode',
    label: 'Used a discount code',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'bool',
    ops: BOOL_OPS,
    defaultOp: 'yes',
    help: 'A promo or gift code was used on this booking.',
  },
  {
    field: 'booking.hasChildren',
    label: 'Children in the group',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'bool',
    ops: BOOL_OPS,
    defaultOp: 'yes',
    help: 'At least one guest on the booking is a child.',
  },
  {
    field: 'booking.waiversMissing',
    label: 'Waivers still to sign',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'bool',
    ops: BOOL_OPS,
    defaultOp: 'yes',
    help: 'Someone on the booking has not signed their waiver yet.',
  },
  {
    field: 'booking.daysUntilStart',
    label: 'Days until the start',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'days',
    ops: RANGE_OPS,
    defaultOp: 'at_least',
    defaultValue: 3,
    unit: 'days',
    help: 'How far away the booking is right now.',
  },
  {
    field: 'booking.location',
    label: 'Location',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'list',
    ops: LIST_OPS,
    defaultOp: 'any_of',
    options: 'locations',
    help: 'Which of your locations it runs from.',
  },
  {
    field: 'booking.rating',
    label: 'Star rating',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'number',
    ops: NUMBER_OPS,
    defaultOp: 'at_least',
    defaultValue: 4,
    unit: 'stars',
    help: 'The stars they gave in their review, from 1 to 5.',
  },
  {
    field: 'booking.firstBooking',
    label: 'Their first booking',
    group: 'About the booking',
    subjects: ['booking'],
    kind: 'bool',
    ops: BOOL_OPS,
    defaultOp: 'yes',
    help: 'This is the first time they have booked with you.',
  },
  /* ---------- About the time slot (spot and weather starts) ---------- */
  {
    field: 'departure.fill',
    label: 'How full it is',
    group: 'About the time slot',
    subjects: ['departure'],
    kind: 'number',
    ops: RANGE_OPS,
    defaultOp: 'at_most',
    defaultValue: 50,
    unit: '% full',
    help: 'Spots booked as a share of the spots it has.',
  },
  {
    field: 'departure.weather',
    label: 'Weather forecast',
    group: 'About the time slot',
    subjects: ['departure'],
    kind: 'enum',
    ops: LIST_OPS,
    defaultOp: 'any_of',
    options: WEATHER_OPTIONS,
    help: 'The forecast for that start time.',
  },
  /* ---------- What they did in this automation ---------- */
  {
    field: 'flow.opened',
    label: 'Opened a message',
    group: 'What they did in this automation',
    subjects: EVERYWHERE,
    kind: 'bool',
    ops: BOOL_OPS,
    defaultOp: 'yes',
    branchOnly: true,
    help: 'They opened an email from this automation. Some email apps hide opens, so this is a best guess.',
  },
  {
    field: 'flow.clicked',
    label: 'Clicked a link',
    group: 'What they did in this automation',
    subjects: EVERYWHERE,
    kind: 'bool',
    ops: BOOL_OPS,
    defaultOp: 'yes',
    branchOnly: true,
    help: 'They clicked a link in an email or text from this automation.',
  },
  {
    field: 'flow.booked',
    label: 'Booked',
    group: 'What they did in this automation',
    subjects: EVERYWHERE,
    kind: 'bool',
    ops: BOOL_OPS,
    defaultOp: 'yes',
    branchOnly: true,
    help: 'They made a new booking since they started this automation.',
  },
  {
    field: 'flow.replied',
    label: 'Replied',
    group: 'What they did in this automation',
    subjects: EVERYWHERE,
    kind: 'bool',
    ops: BOOL_OPS,
    defaultOp: 'yes',
    branchOnly: true,
    help: 'They replied to an email or text from this automation.',
  },
]

const FIELD_BY_KEY = new Map(CONDITION_FIELDS.map((meta) => [meta.field, meta]))

export function fieldMeta(field: ConditionField): ConditionFieldMeta {
  return FIELD_BY_KEY.get(field) ?? CONDITION_FIELDS[0]
}

const fitsSubject = (meta: ConditionFieldMeta, subject: TriggerSubject | TriggerSubject[]) =>
  Array.isArray(subject) ? subject.some((one) => meta.subjects.includes(one)) : meta.subjects.includes(subject)

/**
 * The fields offered for a trigger's subject (or `subjectsOf(trigger)`).
 * "who" leaves out what the guest did in this automation, which only
 * questions can check.
 */
export function fieldsFor(subject: TriggerSubject | TriggerSubject[], where: 'who' | 'branch' = 'who'): ConditionFieldMeta[] {
  return CONDITION_FIELDS.filter((meta) => fitsSubject(meta, subject) && (where === 'branch' || !meta.branchOnly))
}

/** Is this field usable for this subject (and place)? */
export function fieldFits(field: ConditionField, subject: TriggerSubject | TriggerSubject[], where: 'who' | 'branch' = 'who'): boolean {
  const meta = fieldMeta(field)
  return fitsSubject(meta, subject) && (where === 'branch' || !meta.branchOnly)
}

/** Operator labels for the condition row, by field kind. */
export const OP_LABEL: Record<ConditionFieldKind, Partial<Record<ConditionOp, string>>> = {
  list: { any_of: 'is any of', none_of: 'is none of' },
  enum: { any_of: 'is any of', none_of: 'is none of' },
  number: { at_least: 'is at least', at_most: 'is at most', between: 'is between', is: 'is exactly' },
  money: { at_least: 'is at least', at_most: 'is at most', between: 'is between', is: 'is exactly' },
  days: { at_least: 'is at least', at_most: 'is at most', between: 'is between', is: 'is exactly' },
  bool: { yes: 'Yes', no: 'No' },
}

export function opLabel(field: ConditionField, op: ConditionOp): string {
  return OP_LABEL[fieldMeta(field).kind][op] ?? op.replace('_', ' ')
}

const SEGMENT_OPTIONS: ConditionOption[] = (['new', 'returning', 'vip', 'lapsed'] as Customer['segment'][]).map((value) => ({
  value,
  label: { new: 'First-timer', returning: 'Returning guest', vip: 'VIP', lapsed: 'Lapsed guest' }[value],
}))

const CHANNEL_OPTION_LABEL: Record<BookingChannel, string> = {
  direct: 'Your booking page',
  website_widget: 'Booking widget on your website',
  phone: 'Phone',
  walk_in: 'Walk-in at the desk',
  ota: 'Online travel sites',
  reseller: 'Resellers and agents',
  concierge: 'Hotel concierge',
  google: 'Google',
}

/** Kinds as they read mid-sentence: "it’s a private charter". */
export const ACTIVITY_KIND_LOWER: Record<string, string> = {
  trip: 'a group activity',
  activity: 'an activity',
  charter: 'a private charter',
  rental: 'a rental',
  lesson: 'a lesson',
  pass: 'a pass',
  package: 'a package',
  transfer: 'a rental with a driver',
} satisfies Record<ActivityKind, string>

// A rental with a driver counts as a rental, as an older "activity" counts as an activity or tour.
const KIND_OPTIONS: ConditionOption[] = ACTIVITY_KINDS.filter((kind) => kind !== 'activity' && kind !== 'transfer').map((kind: ActivityKind) => ({ value: kind, label: ACTIVITY_KIND_META[kind].label }))

/** The fixed choices; activities, tags, countries, locations and extras come from the business. */
export const STATIC_OPTIONS: Record<'channels' | 'segments' | 'kinds', ConditionOption[]> = {
  channels: (Object.keys(CHANNEL_OPTION_LABEL) as BookingChannel[]).map((value) => ({ value, label: CHANNEL_OPTION_LABEL[value] })),
  segments: SEGMENT_OPTIONS,
  kinds: KIND_OPTIONS,
}

/** The fixed choices for a field, or null when they come from the business. */
export function optionsFor(meta: ConditionFieldMeta): ConditionOption[] | null {
  if (!meta.options) return null
  if (Array.isArray(meta.options)) return meta.options
  if (meta.options === 'channels' || meta.options === 'segments' || meta.options === 'kinds') return STATIC_OPTIONS[meta.options]
  return null
}

/** A fresh condition row for a field, with its default operator and value. */
export function newCondition(field: ConditionField): Condition {
  const meta = fieldMeta(field)
  const condition: Condition = { id: newId('cond'), field, op: meta.defaultOp }
  if (meta.kind === 'list' || meta.kind === 'enum') condition.value = []
  else if (meta.kind !== 'bool') condition.value = typeof meta.defaultValue === 'number' ? meta.defaultValue : 0
  return condition
}

/* --------------------------------------------------------------------------
   Steps — the "Add a step" menu
   -------------------------------------------------------------------------- */

export type StepPaletteGroup = 'Send' | 'Wait' | 'Decide' | 'Do' | 'End'

export interface StepPaletteItem {
  type: FlowStepType
  action?: FlowAction
  label: string
  help: string
  icon: IconName
}

export const STEP_PALETTE: { group: StepPaletteGroup; items: StepPaletteItem[] }[] = [
  {
    group: 'Send',
    items: [
      { type: 'email', label: 'Email', help: 'A letter or a designed email, with their details filled in.', icon: 'Mail' },
      { type: 'sms', label: 'Text message', help: 'A short text to their phone. Best for things that matter today.', icon: 'MessageSquare' },
    ],
  },
  {
    group: 'Wait',
    items: [{ type: 'wait', label: 'Wait', help: 'Pause for a while, until a time of day, or until they do something.', icon: 'Clock' }],
  },
  {
    group: 'Decide',
    items: [
      { type: 'branch', label: 'If / else', help: 'Ask a yes-or-no question, like “Did they book?”, and do something different for each answer.', icon: 'GitBranch' },
      { type: 'split', label: 'A/B test', help: 'Send half your guests one way and half another, to see which brings more bookings.', icon: 'Split' },
    ],
  },
  {
    group: 'Do',
    items: [
      { type: 'action', action: 'add_tag', label: 'Add a tag', help: 'Label the guest, like “Group leader”, so you can find them later.', icon: 'Tag' },
      { type: 'action', action: 'remove_tag', label: 'Remove a tag', help: 'Take a label off the guest.', icon: 'TagX' },
      { type: 'action', action: 'give_code', label: 'Give a discount code', help: 'Make a code for this guest only, so it cannot be shared around.', icon: 'TicketPercent' },
      { type: 'action', action: 'notify_team', label: 'Tell your team', help: 'Send your team a heads-up in the app and by email.', icon: 'BellRing' },
      { type: 'action', action: 'create_task', label: 'Add a to-do', help: 'Put a task on someone’s list, like “Call to confirm the pickup”.', icon: 'ListTodo' },
      { type: 'action', action: 'add_note', label: 'Add a note to the guest', help: 'Write a note on their guest record for your team to see.', icon: 'StickyNote' },
      { type: 'action', action: 'unsubscribe', label: 'Stop marketing to them', help: 'Stop all marketing emails and texts to this guest. Booking messages still go.', icon: 'BellOff' },
    ],
  },
  {
    group: 'End',
    items: [{ type: 'end', label: 'End here', help: 'The guest leaves the automation at this point.', icon: 'CircleStop' }],
  },
]

/** The palette entry for a step, for its icon and name. */
export function paletteItem(step: Pick<FlowStep, 'type'> & { action?: FlowAction }): StepPaletteItem {
  const items = STEP_PALETTE.flatMap((group) => group.items)
  return (
    items.find((item) => item.type === step.type && (step.type !== 'action' || item.action === step.action)) ??
    items.find((item) => item.type === step.type) ??
    items[0]
  )
}

export const ASSIGNEE_LABEL: Record<NonNullable<ActionStep['assignee']>, string> = {
  owner: 'the owner',
  managers: 'managers',
  guides: 'your guides',
  everyone: 'everyone on your team',
}

/* --------------------------------------------------------------------------
   Goals
   -------------------------------------------------------------------------- */

export interface FlowGoalMeta {
  goal: FlowGoal
  label: string
  blurb: string
  icon: IconName
}

export const FLOW_GOALS: FlowGoalMeta[] = [
  { goal: 'fill_seats', label: 'Fill empty spots', blurb: 'Offer spare spots to the guests most likely to take them.', icon: 'Armchair' },
  { goal: 'prepare_guests', label: 'Get guests ready', blurb: 'Reminders, what to bring, waivers and balances, so the day runs smoothly.', icon: 'Backpack' },
  { goal: 'reviews', label: 'Get more reviews', blurb: 'Ask at the right moment, thank the happy ones and hear the unhappy ones first.', icon: 'Star' },
  { goal: 'come_back', label: 'Bring guests back', blurb: 'Turn one booking into the next with timely offers.', icon: 'Repeat' },
  { goal: 'sell_more', label: 'Sell more extras', blurb: 'Photos, upgrades and add-ons offered before and after the day.', icon: 'ShoppingBag' },
  { goal: 'welcome', label: 'Welcome new subscribers', blurb: 'Greet people who join your list and help them make a first booking.', icon: 'Smile' },
  { goal: 'recover', label: 'Save lost bookings', blurb: 'Win back left checkouts, cancellations, no-shows and failed payments.', icon: 'LifeBuoy' },
  { goal: 'gift_cards', label: 'Gift cards', blurb: 'Thank buyers and remind holders to use their credit before it runs out.', icon: 'Gift' },
  { goal: 'team', label: 'Keep your team in the loop', blurb: 'Heads-ups and to-dos for your team when something needs a person.', icon: 'Users' },
]

export function goalMeta(goal: FlowGoal): FlowGoalMeta {
  return FLOW_GOALS.find((meta) => meta.goal === goal) ?? FLOW_GOALS[0]
}

/* --------------------------------------------------------------------------
   Personal details a message can carry. Tokens match messaging.ts so
   renderTemplate fills them; the UI shows the label, never the token.
   -------------------------------------------------------------------------- */

export interface FlowPlaceholder {
  /** With braces, as stored in the text: "{first_name}". */
  token: string
  label: string
  /** What it might look like, for menus and previews. */
  sample: string
}

const P = {
  first_name: { token: '{first_name}', label: 'First name', sample: 'Maya' },
  business: { token: '{business}', label: 'Business name', sample: 'your business name' },
  book_link: { token: '{book_link}', label: 'Booking page link', sample: 'a link to your booking page' },
  activity: { token: '{activity}', label: 'Activity', sample: 'Sunset Cruise' },
  date: { token: '{date}', label: 'Date', sample: 'Sat 24 Oct' },
  time: { token: '{time}', label: 'Start time', sample: '9:00 AM' },
  meeting_point: { token: '{meeting_point}', label: 'Meeting point', sample: 'Harbour gate 3' },
  party: { token: '{party}', label: 'Guests on the booking', sample: '2 adults, 1 child' },
  reference: { token: '{reference}', label: 'Booking code', sample: 'EZ-4821' },
  balance: { token: '{balance}', label: 'Balance owed', sample: '$120' },
  manage_link: { token: '{manage_link}', label: 'Manage booking link', sample: 'a link to manage their booking' },
  seats_left: { token: '{seats_left}', label: 'Spots left', sample: '4' },
  offer_code: { token: '{offer_code}', label: 'Discount code', sample: 'THANKS-7QK2' },
  offer_percent: { token: '{offer_percent}', label: 'Discount %', sample: '10%' },
} satisfies Record<string, FlowPlaceholder>

export type PlaceholderKey = keyof typeof P

/** Every detail flows know about, for lookups by token. */
export const ALL_PLACEHOLDERS: FlowPlaceholder[] = Object.values(P)

const BOOKING_ONLY: PlaceholderKey[] = ['meeting_point', 'party', 'reference', 'balance', 'manage_link']

/**
 * The details a message can use for a trigger's subject. A guest flow knows
 * the guest; a booking flow adds the booking; a departure flow adds the
 * start time and its seats. Discount details appear once a step gives a code.
 */
export function PLACEHOLDERS_FOR(
  subject: TriggerSubject,
  opts: { hasCode?: boolean; trigger?: TriggerType; withBooking?: boolean } = {},
): FlowPlaceholder[] {
  const list: FlowPlaceholder[] = [P.first_name, P.business]
  if (subject === 'booking') list.push(P.activity, P.date, P.time, P.meeting_point, P.party, P.reference, P.balance, P.manage_link)
  else if (subject === 'departure') {
    list.push(P.activity, P.date, P.time, P.seats_left)
    // Sent to the guests booked on it: each one's booking details are known too.
    if (opts.withBooking) list.push(P.meeting_point, P.party, P.reference, P.balance, P.manage_link)
  }
  // A left checkout still knows what they were booking.
  else if (opts.trigger === 'checkout_abandoned') list.push(P.activity, P.date, P.time)
  list.push(P.book_link)
  if (opts.hasCode) list.push(P.offer_code, P.offer_percent)
  return list
}

/** The details a flow's messages can use, from its trigger and whether it gives a code. */
export function placeholdersForFlow(flow: Pick<Flow, 'trigger' | 'steps'>): FlowPlaceholder[] {
  return PLACEHOLDERS_FOR(subjectOf(flow.trigger), { hasCode: givesCode(flow.steps), trigger: flow.trigger.type, withBooking: knowsBooking(flow.trigger) })
}

/** Tokens a booking flow can fill and others cannot. */
export const BOOKING_ONLY_TOKENS: string[] = BOOKING_ONLY.map((key) => P[key].token)

export function placeholderByToken(token: string): FlowPlaceholder | undefined {
  const bare = token.startsWith('{') ? token : `{${token}}`
  return ALL_PLACEHOLDERS.find((item) => item.token === bare)
}

/** The tokens in a text, with braces, in order of first use. */
export function tokensIn(text: string): string[] {
  const found = new Set<string>()
  for (const match of text.matchAll(/\{([a-z_]+)\}/g)) found.add(match[0])
  return [...found]
}

/** A text with each token shown as its label in brackets: "Hi [First name]". Unknown tokens are left as typed. */
export function humanizeTokens(text: string): string {
  return text.replace(/\{([a-z_]+)\}/g, (match) => {
    const item = placeholderByToken(match)
    return item ? `[${item.label}]` : match
  })
}

function givesCode(steps: FlowStep[]): boolean {
  return steps.some((step) => {
    if (step.type === 'action') return step.action === 'give_code'
    if (step.type === 'branch') return givesCode(step.yes) || givesCode(step.no)
    if (step.type === 'split') return givesCode(step.a) || givesCode(step.b)
    return false
  })
}

/* --------------------------------------------------------------------------
   Safe defaults
   -------------------------------------------------------------------------- */

/** What ends an automation early, by purpose. Marketing stops once they book; booking messages stop if the booking is cancelled. */
export const DEFAULT_EXIT: Record<FlowPurpose, FlowExit> = {
  booking: { onBooked: false, onCancelled: true, whenNoLongerMatching: true },
  marketing: { onBooked: true, onCancelled: true, whenNoLongerMatching: true },
}

/** Settings a new automation starts with, by purpose. */
export const DEFAULT_SETTINGS: Record<FlowPurpose, FlowSettings> = {
  booking: {
    reentry: 'per_booking',
    reentryDays: 30,
    quietHours: true,
    smartSending: false,
    sendDays: [],
    holdoutPercent: 0,
    conversionDays: 5,
    channelFallback: true,
  },
  marketing: {
    reentry: 'once',
    reentryDays: 30,
    quietHours: true,
    smartSending: true,
    sendDays: [],
    holdoutPercent: 0,
    conversionDays: 5,
    channelFallback: true,
  },
}

/** A fresh copy of the default exit rules for a purpose. */
export function exitFor(purpose: FlowPurpose): FlowExit {
  return { ...DEFAULT_EXIT[purpose] }
}

/** A fresh copy of the default settings for a purpose. */
export function settingsFor(purpose: FlowPurpose): FlowSettings {
  const base = DEFAULT_SETTINGS[purpose]
  return { ...base, sendDays: [...base.sendDays] }
}

/* --------------------------------------------------------------------------
   Making things
   -------------------------------------------------------------------------- */

let idCounter = 0

/** A short unique id: "step_k3x9a1". */
export function newId(prefix: string): string {
  idCounter = (idCounter + 1) % 1_296
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${idCounter.toString(36)}`
}

type StepOf<T extends FlowStepType> = Extract<FlowStep, { type: T }>

const EMAIL_DEFAULT: Record<TriggerSubject, { subject: string; body: string }> = {
  guest: {
    subject: 'A note from {business}',
    body: 'Hi {first_name},\n\nThank you for being part of {business}. We have new dates coming up and would love to see you. Have a look and pick one that suits you: {book_link}\n\nSee you soon,\n{business}',
  },
  booking: {
    subject: 'About your {activity} on {date}',
    body: 'Hi {first_name},\n\nA quick note about your {activity} on {date} at {time}. If you need to change anything, you can do it here: {manage_link}\n\nSee you soon,\n{business}',
  },
  departure: {
    subject: 'Spots open on {activity}, {date}',
    body: 'Hi {first_name},\n\nWe still have {seats_left} spots on {activity} on {date} at {time}. If you have been meaning to join us, now is a good time: {book_link}\n\nSee you soon,\n{business}',
  },
}

// Texts keep to plain characters (no curly quotes) so they stay one part long.
const SMS_DEFAULT: Record<TriggerSubject, string> = {
  guest: 'Hi {first_name}, this is {business}. New dates are open, book here: {book_link}',
  booking: 'Hi {first_name}, this is {business} about {activity} on {date} at {time}. Details: {manage_link}',
  departure: 'Hi {first_name}, {business} here. {seats_left} spots left on {activity}, {date} at {time}. Book: {book_link}',
}

/** Weather news goes to guests already booked, so it gets its own starting words. */
const WEATHER_DEFAULT = {
  email: {
    subject: 'Weather update for {activity} on {date}',
    body: 'Hi {first_name},\n\nA quick heads-up: the forecast for {activity} on {date} at {time} is uncertain. We are keeping an eye on it and will confirm well before the start.\n\nYou do not need to do anything for now. Any questions, just reply.\n\n{business}',
  },
  sms: 'Hi {first_name}, the forecast for {activity} on {date} is uncertain. We will confirm soon. {business}',
}

const TEAM_DEFAULT: Record<TriggerSubject, { notify: string; task: string }> = {
  guest: { notify: 'Heads-up about {first_name}. Worth a look.', task: 'Get in touch with {first_name}' },
  booking: {
    notify: '{first_name}: {party} on {activity}, {date} at {time} (booking {reference}).',
    task: 'Call {first_name} about {activity} on {date}',
  },
  departure: { notify: '{activity} on {date} at {time} still has {seats_left} spots.', task: 'Check the spots on {activity}, {date}' },
}

/**
 * A new step with sensible starting content, ready to edit. Pass the
 * automation's trigger (or just its subject) for wording that fits what it
 * is about.
 */
export function newStep<T extends FlowStepType>(type: T, action?: FlowAction, about: TriggerSubject | FlowTrigger = 'guest'): StepOf<T> {
  return makeStep(type, action, about) as StepOf<T>
}

function makeStep(type: FlowStepType, action: FlowAction | undefined, about: TriggerSubject | FlowTrigger): FlowStep {
  const subject = typeof about === 'string' ? about : subjectOf(about)
  const weather = typeof about !== 'string' && about.type === 'weather_alert'
  switch (type) {
    case 'email': {
      const words = weather ? WEATHER_DEFAULT.email : EMAIL_DEFAULT[subject]
      const step: EmailStep = { id: newId('step'), type: 'email', subject: words.subject, preheader: '', body: words.body }
      return step
    }
    case 'sms': {
      const step: SmsStep = { id: newId('step'), type: 'sms', body: weather ? WEATHER_DEFAULT.sms : SMS_DEFAULT[subject] }
      return step
    }
    case 'wait': {
      const step: WaitStep = { id: newId('step'), type: 'wait', mode: 'for', duration: { amount: 2, unit: 'days' } }
      return step
    }
    case 'branch': {
      const step: BranchStep = {
        id: newId('step'),
        type: 'branch',
        when: { match: 'all', conditions: [{ id: newId('cond'), field: 'flow.booked', op: 'yes' }] },
        yes: [],
        no: [],
      }
      return step
    }
    case 'split': {
      const step: SplitStep = { id: newId('step'), type: 'split', percentA: 50, a: [], b: [] }
      return step
    }
    case 'action':
      return newAction(action ?? 'add_tag', subject)
    case 'end': {
      const step: EndStep = { id: newId('step'), type: 'end' }
      return step
    }
  }
}

function newAction(action: FlowAction, subject: TriggerSubject): ActionStep {
  const base: ActionStep = { id: newId('step'), type: 'action', action }
  switch (action) {
    case 'add_tag':
    case 'remove_tag':
      return { ...base, tag: '' }
    case 'give_code':
      return { ...base, code: { percent: 10, validDays: 14, prefix: 'THANKS' } }
    case 'notify_team':
      return { ...base, message: TEAM_DEFAULT[subject].notify, assignee: 'managers' }
    case 'create_task':
      return { ...base, message: TEAM_DEFAULT[subject].task, assignee: 'owner', due: { amount: 1, unit: 'days' } }
    case 'add_note':
      return { ...base, message: 'Got a message from an automation.' }
    case 'unsubscribe':
      return base
  }
}

/** An empty automation for a trigger, with the safe defaults on. */
export function blankFlow({
  trigger,
  purpose,
  name,
  nowIso,
  goal,
  steps = [],
}: {
  trigger: FlowTrigger | TriggerType
  purpose?: FlowPurpose
  name?: string
  nowIso: string
  goal?: FlowGoal
  steps?: FlowStep[]
}): Flow {
  const start = typeof trigger === 'string' ? defaultTrigger(trigger) : trigger
  const meta = triggerMeta(start.type)
  const chosen = purpose ?? meta.defaultPurpose
  return {
    id: newId('flow'),
    name: name?.trim() || 'New automation',
    description: '',
    goal: goal ?? meta.goal,
    purpose: chosen,
    status: 'draft',
    trigger: start,
    who: { match: 'all', conditions: [] },
    steps,
    exit: exitFor(chosen),
    settings: settingsFor(chosen),
    createdAt: nowIso,
    updatedAt: nowIso,
    history: [{ at: nowIso, what: 'Created' }],
  }
}

/* --------------------------------------------------------------------------
   Small shared words
   -------------------------------------------------------------------------- */

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const WAIT_EVENT_LABEL: Record<NonNullable<WaitStep['event']>, string> = {
  booked: 'to book',
  clicked: 'to click a link',
  opened: 'to open it',
  replied: 'to reply',
  paid: 'to pay',
  waivers_signed: 'to sign their waivers',
}

/** Wait events that need a booking to watch. */
export const BOOKING_WAIT_EVENTS: NonNullable<WaitStep['event']>[] = ['paid', 'waivers_signed']

export const PURPOSE_LABEL: Record<FlowPurpose, string> = { booking: 'Booking message', marketing: 'Marketing' }

export const PURPOSE_HELP: Record<FlowPurpose, string> = {
  booking:
    'About a booking they made, like reminders and balances. Goes to everyone it applies to, because they need it for their booking.',
  marketing:
    'Offers and news. Only goes to guests who agreed to hear from you on that channel, follows your weekly limit and quiet hours, and always carries an unsubscribe link.',
}

export const STATUS_LABEL: Record<Flow['status'], string> = { draft: 'Draft', live: 'Live', paused: 'Paused' }
