import type { EmailDesign } from '@/lib/email-design'

/* ==========================================================================
   Automations as flows — the contract every part shares: the store, the
   builder, the simulator, the health check, the recipes and the reports.
   Browser- and server-safe: plain data only.

   A flow is: something that starts it (trigger), who may enter (who), the
   steps it takes (send, wait, decide, do), and what ends it early (exit).
   ========================================================================== */

export type FlowStatus = 'draft' | 'live' | 'paused'

/**
 * booking: about a booking the guest made (reminders, waivers, balances).
 * Goes to everyone it applies to and ignores marketing consent.
 * marketing: promotional. Needs marketing consent for the channel, follows
 * the weekly limit and quiet hours, and carries an unsubscribe link.
 */
export type FlowPurpose = 'booking' | 'marketing'

/** The goals recipes and flows are filed under. */
export type FlowGoal =
  | 'fill_seats'
  | 'prepare_guests'
  | 'reviews'
  | 'come_back'
  | 'sell_more'
  | 'welcome'
  | 'recover'
  | 'gift_cards'
  | 'team'

/* ---------- triggers ---------- */

export type TriggerType =
  // Bookings
  | 'booking_made'
  | 'booking_changed'
  | 'booking_cancelled'
  // Around the trip
  | 'before_start'
  | 'after_end'
  | 'checked_in'
  | 'no_show'
  // Money
  | 'balance_due'
  | 'payment_failed'
  // Guests and the list
  | 'joined_list'
  | 'checkout_abandoned'
  | 'lapsed'
  | 'became_vip'
  | 'trip_anniversary'
  // Reviews
  | 'review_left'
  // Gift cards
  | 'gift_card_bought'
  | 'gift_card_expiring'
  // Requests and quotes
  | 'request_received'
  // Seats and weather (start from a departure; reach past guests)
  | 'low_fill'
  | 'weather_alert'
  // Started by your team from a booking or a guest
  | 'manual'

/** What a trigger is about: decides which conditions and placeholders make sense. */
export type TriggerSubject = 'booking' | 'guest' | 'departure'

export type TimeUnit = 'minutes' | 'hours' | 'days'

export interface Duration {
  amount: number
  unit: TimeUnit
}

export interface FlowTrigger {
  type: TriggerType
  /**
   * before_start, after_end, balance_due (before start), gift_card_expiring
   * (before expiry), lapsed (since last trip), low_fill (before start),
   * checkout_abandoned (after leaving), trip_anniversary (before the date).
   */
  offset?: Duration
  /** review_left: the star ratings that start it. Empty: any. */
  ratings?: number[]
  /** low_fill: start when a departure is below this % full. */
  fillBelow?: number
  /** joined_list: which forms. Empty: any. */
  sources?: ('popup' | 'footer' | 'checkout' | 'walk_in')[]
  /** low_fill, weather_alert: who hears about it. */
  reach?: 'past_guests_of_activity' | 'audience' | 'booked_guests'
  /** reach = audience. */
  audienceId?: string
}

/* ---------- conditions (shared with audiences) ---------- */

export type ConditionField =
  // Guest
  | 'guest.tags'
  | 'guest.bookings'
  | 'guest.spend'
  | 'guest.country'
  | 'guest.segment'
  | 'guest.daysSinceLastTrip'
  | 'guest.bookedActivity'
  | 'guest.emailOptIn'
  | 'guest.smsOptIn'
  | 'guest.hasUpcomingTrip'
  | 'guest.local'
  // Booking
  | 'booking.activity'
  | 'booking.kind'
  | 'booking.partySize'
  | 'booking.total'
  | 'booking.channel'
  | 'booking.balanceDue'
  | 'booking.hasAddOn'
  | 'booking.usedCode'
  | 'booking.hasChildren'
  | 'booking.waiversMissing'
  | 'booking.daysUntilStart'
  | 'booking.location'
  | 'booking.rating'
  | 'booking.firstBooking'
  // Departure (seats and weather triggers)
  | 'departure.fill'
  | 'departure.weather'
  // What the guest did since they entered this flow
  | 'flow.opened'
  | 'flow.clicked'
  | 'flow.booked'
  | 'flow.replied'

export type ConditionOp =
  | 'is'
  | 'is_not'
  | 'any_of'
  | 'none_of'
  | 'at_least'
  | 'at_most'
  | 'between'
  | 'yes'
  | 'no'

export interface Condition {
  id: string
  field: ConditionField
  op: ConditionOp
  /** Lists for any_of / none_of, a number for at_least / at_most, [min, max] for between, nothing for yes / no. */
  value?: string | number | string[] | [number, number]
}

export interface ConditionGroup {
  /** all: every condition must hold. any: one is enough. */
  match: 'all' | 'any'
  conditions: Condition[]
}

/* ---------- steps ---------- */

export interface EmailStep {
  id: string
  type: 'email'
  subject: string
  preheader?: string
  /** The plain letter, and the text a design starts from. */
  body: string
  design?: EmailDesign
  /** A second subject line for half the guests; the winner is picked by bookings. */
  subjectB?: string
}

export interface SmsStep {
  id: string
  type: 'sms'
  body: string
}

export type WaitMode =
  /** Wait a set time. */
  | 'for'
  /** Wait until the next time of day, optionally on chosen weekdays. */
  | 'until_time'
  /** Wait until a set time before the trip starts (booking flows only). */
  | 'until_before_start'
  /** Wait until the guest does something, up to a limit. */
  | 'until_event'

export interface WaitStep {
  id: string
  type: 'wait'
  mode: WaitMode
  /** for, until_before_start. */
  duration?: Duration
  /** until_time: HH:MM in the business's time. */
  time?: string
  /** until_time: weekdays allowed (0=Sun). Empty: any day. */
  days?: number[]
  /** until_event. */
  event?: 'booked' | 'clicked' | 'opened' | 'replied' | 'paid' | 'waivers_signed'
  /** until_event: give up after this long. */
  timeout?: Duration
}

export interface BranchStep {
  id: string
  type: 'branch'
  /** Plain question shown on the card, e.g. "Did they book?". Generated when empty. */
  label?: string
  when: ConditionGroup
  yes: FlowStep[]
  no: FlowStep[]
}

export interface SplitStep {
  id: string
  type: 'split'
  /** Share of guests on path A, 1–99. */
  percentA: number
  a: FlowStep[]
  b: FlowStep[]
}

export type FlowAction =
  | 'add_tag'
  | 'remove_tag'
  | 'give_code'
  | 'notify_team'
  | 'create_task'
  | 'add_note'
  | 'unsubscribe'

export interface ActionStep {
  id: string
  type: 'action'
  action: FlowAction
  /** add_tag, remove_tag. */
  tag?: string
  /** give_code: a code made for this guest only, so it cannot be shared. */
  code?: { percent: number; validDays: number; prefix: string }
  /** notify_team, create_task, add_note: what it says. Placeholders allowed. */
  message?: string
  /** notify_team, create_task: who. */
  assignee?: 'owner' | 'managers' | 'guides' | 'everyone'
  /** create_task: due this long after it is made. */
  due?: Duration
}

export interface EndStep {
  id: string
  type: 'end'
}

export type FlowStep = EmailStep | SmsStep | WaitStep | BranchStep | SplitStep | ActionStep | EndStep
export type FlowStepType = FlowStep['type']

/* ---------- exits and settings ---------- */

export interface FlowExit {
  /** Leave as soon as they make a new booking (marketing flows). */
  onBooked: boolean
  /** Leave when the booking it is about is cancelled (booking flows). */
  onCancelled: boolean
  /** Leave when they no longer match "who" — checked before every message. */
  whenNoLongerMatching: boolean
}

export interface FlowSettings {
  /** How often one guest can go through it. */
  reentry: 'once' | 'per_booking' | 'every'
  /** reentry = every: at most once in this many days. */
  reentryDays: number
  /** Hold texts and emails until quiet hours end (from Marketing settings). */
  quietHours: boolean
  /** Skip a marketing message if the guest got one in the last 16 hours, and follow the weekly limit. */
  smartSending: boolean
  /** Messages only go on these weekdays (0=Sun). Empty: any day. */
  sendDays: number[]
  /** Keep this % of guests out to measure what the flow really adds. 0: off. */
  holdoutPercent: number
  /** A booking within this many days of a message counts towards it. */
  conversionDays: number
  /** No email address? Send the text instead, and the other way round (only with consent). */
  channelFallback: boolean
}

export interface FlowVersion {
  at: string
  /** "Turned on", "Changed the second email", "Saved". */
  what: string
}

export interface Flow {
  id: string
  name: string
  /** One line of what it is for, shown in the list. */
  description: string
  goal: FlowGoal
  purpose: FlowPurpose
  status: FlowStatus
  trigger: FlowTrigger
  /** Who may enter. Empty conditions: everyone the trigger applies to. */
  who: ConditionGroup
  steps: FlowStep[]
  exit: FlowExit
  settings: FlowSettings
  /** The recipe it started from, if any. */
  recipeId?: string
  /** Ships with the product. Can be edited and paused, not deleted. */
  builtIn?: boolean
  createdAt: string
  updatedAt: string
  /** Newest first, at most 20. */
  history: FlowVersion[]
}

/* ---------- simulation results ---------- */

export type JourneyEventKind =
  | 'entered'
  | 'skipped'
  | 'waited'
  | 'sent'
  | 'held'
  | 'opened'
  | 'clicked'
  | 'booked'
  | 'branched'
  | 'split'
  | 'action'
  | 'exited'
  | 'finished'
  | 'scheduled'

export interface JourneyEvent {
  at: string
  kind: JourneyEventKind
  stepId?: string
  /** Plain sentence: "Sent the email “See you tomorrow”", "Took the No path: they had not booked". */
  text: string
  /** booked: the booking value, minor units. */
  value?: number
  /** Optional. booked: the id of the booking credited. */
  bookingId?: string
}

export interface GuestJourney {
  guestId: string
  guestName: string
  /** The booking it is about, if any. */
  reference?: string
  activityName?: string
  enteredAt: string
  state: 'waiting' | 'finished' | 'exited' | 'skipped' | 'holdout'
  /** waiting: the step they are at. skipped/exited: why, in words. */
  stepId?: string
  reason?: string
  events: JourneyEvent[]
  /** Optional: this guest's own details for filling messages (date, time, party, balance…), by placeholder key. */
  vars?: Record<string, string>
}

export interface StepStats {
  /** Guests who got to this step. */
  reached: number
  /** Waiting at this step right now. */
  waiting: number
  /** Message steps. */
  sent: number
  opened: number
  clicked: number
  /** Bookings made within the conversion window of this message. */
  bookings: number
  /** Minor units. */
  revenue: number
  /** Branch and split steps: how many took each side. */
  yes?: number
  no?: number
}

export interface FlowRun {
  flowId: string
  /** The window replayed, ISO. */
  from: string
  to: string
  entered: number
  /** In the flow right now, waiting for a step. */
  active: number
  finished: number
  exited: number
  /** Why guests were kept out, with counts: "No marketing consent" → 41. */
  skipped: { reason: string; count: number }[]
  holdout: number
  messages: number
  bookings: number
  /** Minor units. */
  revenue: number
  /** Holdout comparison: bookings per 100 guests in the flow vs kept out. Null when there is no holdout. */
  lift: { inFlow: number; heldOut: number } | null
  perStep: Record<string, StepStats>
  /** Messages due in the next 7 days, by day key (YYYY-MM-DD). */
  upcoming: Record<string, number>
  /** Messages sent per day over the window, by day key. */
  daily: Record<string, number>
  /** Up to 60 journeys, newest first, for the people list and the preview. */
  journeys: GuestJourney[]
  /** Optional: why the numbers are empty, in plain words ("Your team starts this one by hand…"). */
  note?: string
  /**
   * Optional: each booking this run credited, with the message it is credited to. One booking can be
   * credited by several flows; totals across flows use these to count it once (see creditedTotals).
   */
  credits?: FlowCredit[]
}

export interface FlowCredit {
  bookingId: string
  /** When the credited message went, local ISO. */
  sentAt: string
  /** When the booking was made, local ISO. */
  at: string
  /** Minor units. */
  value: number
}

/* ---------- health check ---------- */

export interface FlowIssue {
  id: string
  severity: 'blocker' | 'warning' | 'tip'
  /** Plain sentence. */
  text: string
  stepId?: string
  /** A one-click fix the builder can apply. */
  fix?: { label: string; apply: (flow: Flow) => Flow }
}
